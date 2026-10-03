"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon, ArrowDownLeft, ArrowUpRight, BadgeCheck, Bolt, Bot,
  ChevronDown, ChevronRight, CircleDollarSign, Clock3, Command, Copy, ExternalLink,
  FileText, Fingerprint, Gauge, Layers3, LockKeyhole, Menu, Plus, Radio, RefreshCw,
  ShieldCheck, Sparkles, Wallet, X,
} from "lucide-react";
import type { Activity, Agent, Bounty, LedgerEntry, Snapshot } from "@/lib/contracts";
import { DEFAULT_GOAL } from "@/lib/contracts";

type Section = "overview" | "bounties" | "agents" | "ledger";
const EMPTY: Snapshot = {
  agents: [], bounties: [], activity: [], ledger: [], runs: [],
  config: { mode: "demo", storage: "local", payments: "demo", ready: false, missing: [], orchestratorModel: "", workerModel: "" },
};
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const dateTime = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const shortId = (id: string) => id.slice(0, 8).toUpperCase();
const lifecycle = ["funding", "open", "claimed", "delivered", "verified", "settling", "paid"];

function statusLabel(status: string) { return status.replaceAll("_", " "); }
function initials(name: string) { return name.split(/[\s-]+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }
function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<Snapshot>;
  return Array.isArray(data.agents) && Array.isArray(data.bounties) && Array.isArray(data.activity)
    && Array.isArray(data.ledger) && Array.isArray(data.runs) && !!data.config
    && (data.config.mode === "demo" || data.config.mode === "live");
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [section, setSection] = useState<Section>("overview");
  const [goal, setGoal] = useState("");
  const [reward, setReward] = useState("0.50");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [needsToken, setNeedsToken] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [pendingRun, setPendingRun] = useState<{ goal: string; rewardCents: number; idempotencyKey: string } | null>(null);
  const [terminalRunFailure, setTerminalRunFailure] = useState(false);

  const headers = useCallback((): Record<string, string> => token ? { Authorization: `Bearer ${token}` } : {}, [token]);
  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/state", { headers: headers(), cache: "no-store" });
      if (response.status === 401) { setNeedsToken(true); setLoadError(""); return; }
      if (!response.ok) throw new Error(`Could not load network state (${response.status})`);
      const data: unknown = await response.json();
      if (!isSnapshot(data)) throw new Error("The network returned an invalid state snapshot.");
      setSnapshot(data);
      setNeedsToken(false);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not connect to BountyMesh.");
    } finally { if (!quiet) setLoading(false); }
  }, [headers]);

  useEffect(() => {
    const saved = sessionStorage.getItem("bountymesh_operator_token");
    if (saved) setToken(saved);
    const pending = sessionStorage.getItem("bountymesh_pending_run");
    if (pending) {
      try {
        const restored = JSON.parse(pending) as { goal: string; rewardCents: number; idempotencyKey: string };
        if (restored.goal && restored.rewardCents >= 50 && restored.rewardCents <= 500 && restored.idempotencyKey) {
          setPendingRun(restored);
          setGoal(restored.goal);
          setReward((restored.rewardCents / 100).toFixed(2));
        }
      } catch { sessionStorage.removeItem("bountymesh_pending_run"); }
    }
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(true), submitting ? 1000 : realtimeConnected ? 15000 : 3000);
    return () => window.clearInterval(timer);
  }, [refresh, submitting, realtimeConnected]);

  useEffect(() => {
    if (snapshot.config.mode !== "live") {
      setRealtimeConnected(false);
      return;
    }
    const controller = new AbortController();
    let mounted = true;
    const pause = (ms: number) => new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, ms);
      controller.signal.addEventListener("abort", () => { window.clearTimeout(timer); resolve(); }, { once: true });
    });
    async function consumeEvents() {
      let delay = 1000;
      while (!controller.signal.aborted) {
        try {
          const response = await fetch("/api/events", {
            headers: { ...headers(), Accept: "text/event-stream" },
            cache: "no-store", signal: controller.signal,
          });
          if (response.status === 401) setNeedsToken(true);
          if (!response.ok || !response.body) throw new Error(`Realtime stream unavailable (${response.status}).`);
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          if (mounted) { setRealtimeConnected(true); setNeedsToken(false); setLoadError(""); }
          delay = 1000;
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const messages = buffer.split(/\r?\n\r?\n/);
            buffer = messages.pop() ?? "";
            for (const message of messages) {
              let eventName = "message";
              const dataLines: string[] = [];
              for (const line of message.split(/\r?\n/)) {
                if (line.startsWith("event:")) eventName = line.slice(6).trim();
                else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
              }
              if (eventName !== "snapshot" || dataLines.length === 0) continue;
              try {
                const next: unknown = JSON.parse(dataLines.join("\n"));
                if (isSnapshot(next) && mounted) setSnapshot(next);
              } catch { /* Ignore malformed event payloads and wait for the next snapshot. */ }
            }
          }
          if (!controller.signal.aborted) throw new Error("Realtime stream ended.");
        } catch (e) {
          if (controller.signal.aborted) break;
          if (mounted) setRealtimeConnected(false);
          if (e instanceof Error && e.name !== "AbortError") setLoadError((current) => current || "Realtime updates disconnected; polling the API.");
        }
        if (!controller.signal.aborted) {
          await pause(delay);
          delay = Math.min(delay * 2, 15000);
        }
      }
    }
    void consumeEvents();
    return () => {
      mounted = false;
      controller.abort();
      setRealtimeConnected(false);
    };
  }, [snapshot.config.mode, headers]);

  const stats = useMemo(() => {
    const paid = snapshot.ledger.filter((entry) => entry.kind === "payout").reduce((sum, entry) => sum + entry.amountCents, 0);
    const held = snapshot.bounties.filter((b) => b.escrowStatus === "held").reduce((sum, b) => sum + b.rewardCents, 0);
    return { paid, held, bounties: snapshot.bounties.length, agents: snapshot.agents.length, working: snapshot.agents.filter((a) => a.status === "working").length };
  }, [snapshot]);
  const selected = selectedId ? snapshot.bounties.find((bounty) => bounty.id === selectedId) ?? null : null;

  async function submitGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanGoal = goal.trim();
    const cents = Math.round(Number(reward) * 100);
    if (pendingRun && (cleanGoal !== pendingRun.goal || cents !== pendingRun.rewardCents)) {
      setActionError("Retry the existing request unchanged, or wait until its outcome is confirmed."); return;
    }
    if (cleanGoal.length < 10 || cents < 50 || cents > 500) { setActionError("Add a goal of at least 10 characters and set a reward between $0.50 and $5.00."); return; }
    const request = pendingRun ?? { goal: cleanGoal, rewardCents: cents, idempotencyKey: crypto.randomUUID() };
    if (!pendingRun) {
      setPendingRun(request);
      sessionStorage.setItem("bountymesh_pending_run", JSON.stringify(request));
    }
    setSubmitting(true); setActionError("");
    try {
      const response = await fetch("/api/runs", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify(request),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { setNeedsToken(true); throw new Error("This network needs an operator token. Enter it in the connection panel, then retry this same request."); }
      if (!response.ok) throw new Error(result.error || `The run could not start (${response.status}).`);
      if (result.snapshot) setSnapshot(result.snapshot as Snapshot);
      else await refresh(true);
      if (result.run?.status === "failed") {
        setTerminalRunFailure(true);
        throw new Error(result.run.error || "The run failed. Retry will use the same request key, or start a new request.");
      }
      setTerminalRunFailure(false);
      setPendingRun(null);
      sessionStorage.removeItem("bountymesh_pending_run");
      setGoal("");
      setActionError("");
      await refresh(true);
    } catch (e) { setActionError(e instanceof Error ? e.message : "The run could not start. Retry uses the same request key."); }
    finally { setSubmitting(false); }
  }

  function navigate(next: Section) {
    setSection(next); setMobileNav(false);
    document.getElementById(next === "overview" ? "overview" : next)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function connectToken() {
    sessionStorage.setItem("bountymesh_operator_token", token);
    setNeedsToken(false); void refresh();
  }
  function startFreshRequest() {
    setPendingRun(null);
    setTerminalRunFailure(false);
    sessionStorage.removeItem("bountymesh_pending_run");
    setActionError("");
  }

  const navItems: { id: Section; label: string; icon: typeof Gauge }[] = [
    { id: "overview", label: "Overview", icon: Gauge }, { id: "bounties", label: "Bounties", icon: Layers3 },
    { id: "agents", label: "Agents", icon: Bot }, { id: "ledger", label: "Ledger", icon: Wallet },
  ];
  const connectionLabel = loading ? "Connecting" : loadError ? "Connection issue" : snapshot.config.mode === "live"
    ? !snapshot.config.ready ? "Configuration needed" : realtimeConnected ? "Realtime connected" : "Polling API"
    : "Demo API connected";
  const bountyRows = section === "bounties" ? snapshot.bounties : snapshot.bounties.slice(0, 5);
  const ledgerRows = section === "ledger" ? snapshot.ledger : snapshot.ledger.slice(0, 6);
  const metricLabel = snapshot.config.payments === "stripe" ? "Funds held" : "Credits held";

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <a className="brand" href="#overview" onClick={() => navigate("overview")}>
        <span className="brand-mark"><Command size={21} strokeWidth={2.2} /></span><span>Bounty<span className="brand-light">Mesh</span><small>AGENT ECONOMY</small></span>
      </a>
      <div className="workspace"><span className="workspace-icon"><Layers3 size={15} /></span><span><b>Mesh network</b><small>Personal workspace</small></span><ChevronDown size={15} className="muted" /></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="side-nav">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? "nav-active" : ""} onClick={() => navigate(id)}><Icon size={17} /><span>{label}</span>{id === "bounties" && snapshot.bounties.length > 0 && <em>{snapshot.bounties.length}</em>}</button>)}</nav>
      <div className="sidebar-divider" />
      <div className="nav-label">NETWORK</div>
      <div className="network-mini"><div className="online-pulse" /><div><b>{snapshot.config.mode === "live" ? "Live network" : "Demo network"}</b><small>{snapshot.config.storage === "supabase" ? "Supabase connected" : "Local storage"}</small></div><ChevronRight size={14} className="muted" /></div>
      <div className="sidebar-bottom"><div className="avatar avatar-you">Y</div><div className="account"><b>Your workspace</b><small>Operator account</small></div><ChevronDown size={15} className="muted" /></div>
    </aside>
    {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <main className="main-area" id="overview">
      <header className="topbar"><button className="mobile-menu icon-btn" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu size={19} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{navItems.find((n) => n.id === section)?.label}</strong></div><div className="topbar-right"><div className="live-indicator"><span className={`online-pulse ${loadError ? "offline-pulse" : ""}`} />{loading ? "Connecting" : loadError ? "API unavailable" : snapshot.config.mode === "live" && realtimeConnected ? "Realtime connected" : "Polling API"}</div><span className="topbar-separator" /><button className="icon-btn" aria-label="Refresh network" onClick={() => void refresh()}><RefreshCw size={16} className={loading ? "spin" : ""} /></button><div className="avatar avatar-top">Y</div></div></header>
      <div className="content-wrap">
        {(loadError || actionError || needsToken) && <div className={`alert ${needsToken ? "alert-connect" : ""}`}><div className="alert-icon"><LockKeyhole size={17} /></div><div className="alert-body"><b>{needsToken ? "Operator access required" : actionError ? "Run needs attention" : "Network update"}</b>{needsToken && <p>This deployment protects its API. Enter the operator token to connect and trigger work.</p>}{loadError && <p>{loadError}</p>}{actionError && <p>{actionError}</p>}{needsToken && <div className="token-row"><input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="OPERATOR_TOKEN" aria-label="Operator token" /><button onClick={connectToken}>Connect</button></div>}</div>{!needsToken && <button className="alert-dismiss" onClick={() => { setLoadError(""); setActionError(""); }} aria-label="Dismiss"><X size={16} /></button>}</div>}

        <section className="hero-row"><div><div className="eyebrow"><span className="eyebrow-line" />AUTONOMOUS WORK, SETTLED</div><h1>Agents hire agents<span className="period">.</span></h1><p className="hero-sub">A labor market where specialist agents pick up work, deliver proof, and get paid.</p></div><div className="hero-status"><div className="status-icon"><Radio size={19} /></div><div><span>NETWORK STATUS</span><b><i className={`status-dot ${loadError || needsToken ? "offline-pulse" : ""}`} />{needsToken ? "Operator access required" : connectionLabel}</b></div><span className="status-divider" /><div className="status-stack"><small>STORAGE</small><b>{snapshot.config.storage === "supabase" ? "Supabase" : "Local"}</b></div></div></section>

        <section className="stats-grid" aria-label="Network metrics">
          <Stat label={metricLabel} value={money(stats.held)} note={stats.held ? "Secured for active work" : "Nothing currently held"} icon={<LockKeyhole size={17} />} accent="mint" />
          <Stat label="Total paid" value={money(stats.paid)} note={stats.paid ? "Settled to worker agents" : "Settlements will show here"} icon={<ArrowUpRight size={17} />} />
          <Stat label="Bounties" value={String(stats.bounties).padStart(2, "0")} note={stats.bounties ? "Across all work cycles" : "No work posted yet"} icon={<Layers3 size={17} />} />
          <Stat label="Active agents" value={String(stats.agents).padStart(2, "0")} note={stats.working ? `${stats.working} currently working` : "Registered on this network"} icon={<Bot size={17} />} />
        </section>

        <section className="workbench-grid">
          <div className="composer-card panel"><div className="panel-heading"><div><div className="eyebrow compact"><Sparkles size={13} />ORCHESTRATOR</div><h2>Put an agent to work</h2></div><span className="model-pill"><span className="model-dot" />{snapshot.config.orchestratorModel || "Orchestrator"}</span></div><p className="panel-description">Describe the outcome. The orchestrator will find a specialist and manage the handoff.</p>
            <form onSubmit={submitGoal}><label className="field-label" htmlFor="goal">YOUR GOAL</label><textarea id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={DEFAULT_GOAL} rows={3} minLength={10} maxLength={2000} disabled={submitting || (!!pendingRun && !terminalRunFailure)} /><div className="compose-footer"><div className="reward-control"><CircleDollarSign size={16} /><span>Reward</span><span className="currency-symbol">$</span><input type="number" value={reward} onChange={(e) => setReward(e.target.value)} min="0.50" max="5.00" step="0.01" aria-label="Reward in dollars" disabled={submitting || (!!pendingRun && !terminalRunFailure)} /><span className="reward-cap">USD</span></div><span className="char-count">{goal.length}/2,000</span></div>{pendingRun && <div className="retry-note"><LockKeyhole size={12} />{terminalRunFailure ? "This request has a confirmed failed run. Retry reuses its key; a fresh request gets a new key." : "Request key retained. Retry uses the same goal, reward, and idempotency key."}</div>}<div className="composer-actions"><button className="submit-button" type="submit" disabled={submitting || (goal.trim().length < 10 && !pendingRun)}>{submitting ? <><span className="button-spinner" />Running the network…</> : pendingRun ? <><RefreshCw size={15} />Retry same request<ArrowUpRight size={16} /></> : <><Bolt size={16} fill="currentColor" />Trigger autonomous work<ArrowUpRight size={16} /></>}</button>{pendingRun && terminalRunFailure ? <button type="button" className="demo-fill" onClick={startFreshRequest}>Start a new request</button> : !goal && !pendingRun && <button type="button" className="demo-fill" onClick={() => { setGoal(DEFAULT_GOAL); setReward("0.50"); setActionError(""); }}>Use demo goal</button>}</div></form><div className="composer-footnote"><ShieldCheck size={13} />{snapshot.config.payments === "stripe" ? "Stripe test authorization · transfer after approval" : "Demo credits · no real funds are moved"}<span>·</span><span>$0.50–$5.00 per run</span></div>
          </div>
          <div className="activity-card panel"><div className="panel-heading"><div><div className="eyebrow compact"><ActivityIcon size={13} />LIVE FEED</div><h2>Network activity</h2></div><span className="feed-live"><span className="online-pulse" />{snapshot.config.mode === "live" && realtimeConnected ? "LIVE" : "POLLING"}</span></div>{snapshot.activity.length ? <div className="activity-list">{snapshot.activity.slice(0, 6).map((item) => <ActivityRow key={item.id} item={item} />)}</div> : <div className="empty-feed"><div className="empty-orbit"><ActivityIcon size={20} /></div><b>Quiet on the network</b><p>When agents start collaborating, their activity will appear here in real time.</p></div>}<div className="feed-footer"><span><span className="tiny-dot" />{snapshot.activity.length} events recorded</span><span>{snapshot.config.mode === "live" && realtimeConnected ? "Realtime stream" : "API polling fallback"}</span></div></div>
        </section>

        <section className="lower-grid"><div className="panel table-panel" id="bounties"><div className="panel-heading section-heading"><div><div className="eyebrow compact"><Layers3 size={13} />MARKETPLACE</div><h2>{section === "bounties" ? "All bounties" : "Recent bounties"}</h2></div>{section !== "bounties" && <button className="text-action" onClick={() => navigate("bounties")}>View all<ArrowUpRight size={14} /></button>}</div>{bountyRows.length ? <div className="bounty-list">{bountyRows.map((bounty) => <BountyRow key={bounty.id} bounty={bounty} onClick={() => setSelectedId(bounty.id)} />)}</div> : <div className="empty-table"><div className="empty-icon"><Layers3 size={18} /></div><div><b>No bounties yet</b><p>Autonomous work you trigger will show up here, from escrow to payout.</p></div><button className="subtle-button" onClick={() => document.getElementById("goal")?.focus()}><Plus size={14} />Create one</button></div>}<div className="table-bottom"><span>Showing {bountyRows.length} of {snapshot.bounties.length} bounties</span><span className="ledger-link" onClick={() => navigate("ledger")}>View ledger<ChevronRight size={13} /></span></div></div>
          <div className="panel agents-panel" id="agents"><div className="panel-heading section-heading"><div><div className="eyebrow compact"><Bot size={13} />THE WORKFORCE</div><h2>Registered agents</h2></div><button className="icon-btn small" onClick={() => navigate("agents")} aria-label="View agents"><ArrowUpRight size={15} /></button></div>{snapshot.agents.length ? <div className="agent-list">{snapshot.agents.slice(0, 4).map((agent) => <AgentRow key={agent.id} agent={agent} />)}</div> : <div className="agents-empty"><div className="agent-orbit"><Bot size={20} /></div><b>Waiting for the first agent</b><p>Agents register their skills here so the orchestrator can match each bounty to the right specialist.</p><div className="skill-empty"><span>RESEARCH</span><span>ANALYSIS</span><span>BUILD</span></div></div>}<div className="agent-panel-footer"><span><span className="online-pulse" />{snapshot.agents.filter((a) => a.status !== "working").length} online</span><span>{stats.working} working</span></div></div></section>

        <section className="ledger-panel panel" id="ledger"><div className="panel-heading section-heading"><div><div className="eyebrow compact"><Fingerprint size={13} />TRANSPARENT BY DESIGN</div><h2>Settlement ledger</h2></div><span className="ledger-secure"><LockKeyhole size={13} />AUDITABLE</span></div>{snapshot.ledger.length ? <div className="ledger-table"><div className="ledger-head"><span>TRANSACTION</span><span>BOUNTY</span><span>PROVIDER</span><span>DATE</span><span>AMOUNT</span></div>{ledgerRows.map((entry) => <LedgerRow key={entry.id} entry={entry} />)}</div> : <div className="ledger-empty"><div className="ledger-empty-icon"><Wallet size={17} /></div><div><b>Every cent has a paper trail.</b><p>When work is funded or paid, each movement will be recorded here with a verifiable reference.</p></div><span className="ledger-zero">$0.00<br /><small>IN ACTIVITY</small></span></div>}<div className="ledger-bottom"><span><ShieldCheck size={13} />{snapshot.config.payments === "stripe" ? "Stripe test mode · transfers follow approval" : "Demo mode · balances are simulated credits"}</span><span>Showing {ledgerRows.length} of {snapshot.ledger.length} ledger entries</span></div></section>
        <footer className="page-footer"><span><span className="brand-mini"><Command size={12} /></span>BountyMesh <span className="footer-divider">/</span> The agent-to-agent labor market</span><span>Built for autonomous work <span className="mint">✳</span></span></footer>
      </div>
    </main>
    {selected && <BountyDrawer bounty={selected} onClose={() => setSelectedId(null)} />}
  </div>;
}

function Stat({ label, value, note, icon, accent }: { label: string; value: string; note: string; icon: React.ReactNode; accent?: string }) {
  return <div className={`stat-card ${accent === "mint" ? "stat-mint" : ""}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div><div className="stat-note"><span className="note-marker" />{note}</div></div>;
}
function ActivityRow({ item }: { item: Activity }) {
  const icon = item.type === "payment" ? <CircleDollarSign /> : item.type === "delivery" ? <FileText /> : item.type === "verification" ? <BadgeCheck /> : item.type === "error" ? <X /> : item.type === "funding" ? <LockKeyhole /> : <Sparkles />;
  return <div className="activity-row"><span className={`activity-type type-${item.type}`}>{icon}</span><div className="activity-copy"><p>{item.message}</p><span>{dateTime(item.createdAt)}{item.bountyId ? ` · ${shortId(item.bountyId)}` : ""}</span></div><ChevronRight size={14} className="activity-chevron" /></div>;
}
function BountyRow({ bounty, onClick }: { bounty: Bounty; onClick: () => void }) {
  const idx = lifecycle.indexOf(bounty.status);
  return <button className="bounty-row" onClick={onClick}><div className="bounty-name"><span className="bounty-glyph"><FileText size={15} /></span><span><b>{bounty.title}</b><small>#{shortId(bounty.id)} <i>·</i> {dateTime(bounty.createdAt)}</small></span></div><div className="bounty-progress"><div className="progress-track"><span style={{ width: `${bounty.status === "failed" ? 100 : Math.max(8, ((idx + 1) / lifecycle.length) * 100)}%` }} /></div><span>{bounty.status === "failed" ? "Failed" : `${Math.max(idx + 1, 0)}/${lifecycle.length}`}</span></div><span className={`status-badge status-${bounty.status}`}>{statusLabel(bounty.status)}</span><b className="bounty-amount">{money(bounty.rewardCents)}</b><ChevronRight size={15} className="row-chevron" /></button>;
}
function AgentRow({ agent }: { agent: Agent }) {
  return <div className="agent-row"><span className={`avatar agent-avatar ${agent.role === "orchestrator" ? "agent-orchestrator" : ""}`}>{initials(agent.name)}</span><span className="agent-info"><b>{agent.name}</b><small>{agent.model || agent.role}</small></span><span className={`agent-status ${agent.status}`}><i />{agent.status}</span><span className="agent-earned">{money(agent.earnedCents)}<small>earned</small></span></div>;
}
function LedgerRow({ entry }: { entry: LedgerEntry }) {
  return <div className="ledger-row"><span className="transaction-kind"><span className={`transaction-icon ${entry.kind}`}><ArrowDownLeft size={14} /></span><b>{entry.kind === "hold" ? "Escrow held" : entry.kind === "payout" ? "Agent payout" : "Refund issued"}</b></span><span className="ledger-id">#{shortId(entry.bountyId)}</span><span><span className={`provider-tag ${entry.provider}`}>{entry.provider}</span></span><span className="ledger-date">{dateTime(entry.createdAt)}</span><b className={`ledger-amount ${entry.kind === "payout" ? "positive" : ""}`}>{entry.kind === "refund" ? "+" : "−"}{money(entry.amountCents)}</b></div>;
}
function BountyDrawer({ bounty, onClose }: { bounty: Bounty; onClose: () => void }) {
  const currentIndex = lifecycle.indexOf(bounty.status);
  const workerName = bounty.workerId;
  async function copyId() { await navigator.clipboard.writeText(bounty.id); }
  return <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><aside className="detail-drawer"><div className="drawer-top"><span className="eyebrow compact"><Layers3 size={13} />BOUNTY DETAIL</span><button className="icon-btn" onClick={onClose} aria-label="Close detail"><X size={18} /></button></div><div className="drawer-title"><h2>{bounty.title}</h2><span className={`status-badge status-${bounty.status}`}>{statusLabel(bounty.status)}</span></div><p className="drawer-desc">{bounty.description}</p><div className="drawer-reward"><span>REWARD</span><b>{money(bounty.rewardCents)}</b><span className={`escrow-chip ${bounty.escrowStatus}`}><LockKeyhole size={13} />Escrow {bounty.escrowStatus}</span></div><div className="drawer-section"><h3>Lifecycle</h3><div className="timeline">{lifecycle.map((step, i) => { const done = currentIndex >= i && bounty.status !== "failed"; const active = currentIndex === i; return <div className={`timeline-step ${done ? "done" : ""} ${active ? "current" : ""}`} key={step}><span className="timeline-node">{done ? <span /> : null}</span><span>{statusLabel(step)}</span>{active && <small>Current</small>}</div>; })}{bounty.status === "failed" && <div className="timeline-failed"><X size={13} />Run failed</div>}</div></div><div className="drawer-section"><h3>Assignment</h3><div className="detail-pair"><span>Worker</span><b>{workerName ? `Agent ${shortId(workerName)}` : "Matching in progress"}</b></div><div className="detail-pair"><span>Similarity match</span><b>{bounty.similarity === null ? "Pending" : `${Math.round(bounty.similarity * 100)}%`}</b></div><div className="detail-pair"><span>Created</span><b>{dateTime(bounty.createdAt)}</b></div><div className="detail-pair"><span>Bounty ID</span><button className="copy-id" onClick={copyId}>{shortId(bounty.id)}<Copy size={12} /></button></div></div>{bounty.review && <div className="drawer-section"><h3>Orchestrator review</h3><p className="review-text">{bounty.review}</p></div>}<div className="drawer-section"><h3>Deliverable</h3>{bounty.deliverable ? <div className="deliverable"><div className="deliverable-header"><FileText size={14} />{bounty.deliverable.summary}<span>{bounty.deliverable.kind.toUpperCase()}</span></div><pre>{bounty.deliverable.content}</pre></div> : <div className="deliverable-pending"><Clock3 size={15} />The agent has not submitted a deliverable yet.</div>}</div><div className="drawer-run-link">RUN <code>{shortId(bounty.runId)}</code><ExternalLink size={13} /></div></aside></div>;
}
