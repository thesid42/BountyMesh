"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  Gamepad2,
  Trophy,
  Users,
  Receipt,
  Search,
  Coins,
  Terminal,
} from "lucide-react";
import type { Agent, Bounty, Snapshot } from "@/lib/contracts";
import { ArcadeRoom, ArcadeCharacter } from "@/components/ArcadeRoom";
import { ArcadeCharacterModal } from "@/components/ArcadeCharacterModal";
import { ArcadeDeliverableModal } from "@/components/ArcadeDeliverableModal";
import { arcadeAudio } from "@/lib/arcadeAudio";
import { GuildLogo } from "@/components/GuildLogo";

const EMPTY: Snapshot = {
  agents: [],
  bounties: [],
  activity: [],
  ledger: [],
  runs: [],
  config: { mode: "live", storage: "supabase", payments: "stripe", ready: false, missing: [], orchestratorModel: "", workerModel: "" },
};

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<Snapshot>;
  return Array.isArray(data.agents) && Array.isArray(data.bounties) && Array.isArray(data.activity)
    && Array.isArray(data.ledger) && Array.isArray(data.runs) && !!data.config
    && data.config.mode === "live";
}

const LIVE_DEMO_GOAL = "Create a clearly hypothetical analysis comparing three fictional AI agent marketplace fee models. Include an illustrative comparison table and a simple chart specification, label every assumption as fictional, and do not claim external research or live market data.";

const BUDGET_PRESETS = [
  { label: "$0.50", cents: 50 },
  { label: "$1.00", cents: 100 },
  { label: "$2.50", cents: 250 },
  { label: "$5.00", cents: 500 },
];

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false);
  const [activeTab, setActiveTab] = useState<"arcade" | "bounties" | "agents" | "ledger">("arcade");
  const [goal, setGoal] = useState("");
  const [rewardCents, setRewardCents] = useState(50);
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [needsToken, setNeedsToken] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionCookieAuth, setSessionCookieAuth] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState(false);
  const [pendingRun, setPendingRun] = useState<{ goal: string; rewardCents: number; idempotencyKey: string } | null>(null);
  const [terminalRunFailure, setTerminalRunFailure] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const sessionRecoveryAttempted = useRef(false);
  const requestInFlight = useRef(false);

  // Modals state
  const [inspectedAgent, setInspectedAgent] = useState<{ agent: Agent | null; char?: ArcadeCharacter } | null>(null);
  const [inspectedBounty, setInspectedBounty] = useState<Bounty | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const headers = useCallback((): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const bootstrapSession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return false;
      const result: unknown = await response.json();
      return !!result && typeof result === "object" && (result as { authenticated?: unknown }).authenticated === true;
    } catch {
      return false;
    }
  }, []);

  const refresh = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        let response = await fetch("/api/state", { headers: headers(), credentials: "same-origin", cache: "no-store" });
        if (response.status === 401 && sessionCookieAuth && !sessionRecoveryAttempted.current) {
          sessionRecoveryAttempted.current = true;
          if (await bootstrapSession()) {
            response = await fetch("/api/state", { headers: headers(), credentials: "same-origin", cache: "no-store" });
          }
        }
        if (response.status === 401) {
          setSessionCookieAuth(false);
          setNeedsToken(true);
          setConnectionError("");
          return;
        }
        if (!response.ok) throw new Error(`Could not load network state (${response.status})`);
        const data: unknown = await response.json();
        if (!isSnapshot(data)) throw new Error("Invalid snapshot returned.");
        setSnapshot(data);
        setHasLoadedSnapshot(true);
        setNeedsToken(false);
        setConnectionError("");
        setTokenInput("");
        sessionRecoveryAttempted.current = false;
      } catch (e) {
        setConnectionError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [bootstrapSession, headers, sessionCookieAuth]
  );

  useEffect(() => {
    const savedRun = sessionStorage.getItem("bountymesh_pending_run");
    if (savedRun) {
      try {
        const pending = JSON.parse(savedRun) as { goal: string; rewardCents: number; idempotencyKey: string };
        if (typeof pending.goal === "string" && pending.goal.length >= 10 && Number.isInteger(pending.rewardCents)
          && pending.rewardCents >= 50 && pending.rewardCents <= 500 && typeof pending.idempotencyKey === "string" && pending.idempotencyKey) {
          setPendingRun(pending);
          setGoal(pending.goal);
          setRewardCents(pending.rewardCents);
        }
      } catch { sessionStorage.removeItem("bountymesh_pending_run"); }
    }
    const savedActiveRunId = sessionStorage.getItem("bountymesh_active_run_id");
    if (savedActiveRunId) setActiveRunId(savedActiveRunId);

    let active = true;
    void (async () => {
      const established = await bootstrapSession();
      if (!active) return;
      if (established) {
        sessionStorage.removeItem("bountymesh_token");
        setToken("");
        setSessionCookieAuth(true);
        setNeedsToken(false);
      } else {
        const savedToken = sessionStorage.getItem("bountymesh_token") || "";
        setToken(savedToken);
        setSessionCookieAuth(false);
        setNeedsToken(!savedToken);
      }
      setAuthReady(true);
    })();
    return () => { active = false; };
  }, [bootstrapSession]);

  useEffect(() => { if (authReady) void refresh(); }, [authReady, refresh]);

  // Poll for recovery while the live stream is disconnected.
  useEffect(() => {
    if (!authReady || needsToken) return;
    const interval = setInterval(() => void refresh(true), submitting ? 1200 : realtimeConnected ? 15000 : 3000);
    return () => clearInterval(interval);
  }, [authReady, needsToken, refresh, submitting, realtimeConnected]);

  // Authenticated SSE stream; polling remains active as a recovery path.
  useEffect(() => {
    if (!authReady || needsToken || snapshot.config.mode !== "live") {
      setRealtimeConnected(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    const pause = (ms: number) => new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, ms);
      controller.signal.addEventListener("abort", () => { window.clearTimeout(timer); resolve(); }, { once: true });
    });

    async function streamSnapshots() {
      let retryDelay = 1000;
      while (!controller.signal.aborted) {
        try {
          const response = await fetch("/api/events", {
            headers: { ...headers(), Accept: "text/event-stream" },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          });
          if (response.status === 401 && active) {
            if (sessionCookieAuth) void refresh(true);
            else setNeedsToken(true);
          }
          if (!response.ok || !response.body) throw new Error(`Realtime stream unavailable (${response.status}).`);

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          if (active) {
            setRealtimeConnected(true);
            setNeedsToken(false);
            setConnectionError("");
          }
          retryDelay = 1000;

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
                if (active && isSnapshot(next)) {
                  setSnapshot(next);
                  setHasLoadedSnapshot(true);
                }
              } catch { /* Ignore malformed event payloads; the next snapshot can recover. */ }
            }
          }
          if (!controller.signal.aborted) throw new Error("Realtime stream ended.");
        } catch (e) {
          if (controller.signal.aborted) break;
          if (active) {
            setRealtimeConnected(false);
            if (e instanceof Error && e.name !== "AbortError") setConnectionError("Realtime disconnected; polling the API while reconnecting.");
          }
        }
        if (!controller.signal.aborted) {
          await pause(retryDelay);
          retryDelay = Math.min(retryDelay * 2, 15000);
        }
      }
    }

    void streamSnapshots();
    return () => {
      active = false;
      controller.abort();
      setRealtimeConnected(false);
    };
  }, [authReady, needsToken, snapshot.config.mode, headers, refresh, sessionCookieAuth]);

  const networkReady = authReady && hasLoadedSnapshot && snapshot.config.mode === "live" && snapshot.config.ready && !needsToken;
  const canStartWork = networkReady && !pendingRun && !submitting;
  const canRunLiveDemo = canStartWork && snapshot.config.mode === "live";

  const submitRun = async (goalValue: string, rewardValue: number) => {
    if (requestInFlight.current || submitting) return;
    if (!networkReady) {
      setError(needsToken ? "Connect an operator session before submitting work." : "Waiting for a ready network snapshot before starting work.");
      return;
    }
    const cleanGoal = goalValue.trim();
    if (cleanGoal.length < 10) {
      setError("Please describe the task with at least 10 characters.");
      return;
    }
    if (pendingRun && (cleanGoal !== pendingRun.goal || rewardValue !== pendingRun.rewardCents)) {
      setError("Retry the pending request unchanged, or start a new request after a confirmed failure.");
      return;
    }

    const request = pendingRun ?? { goal: cleanGoal, rewardCents: rewardValue, idempotencyKey: crypto.randomUUID() };
    if (!pendingRun) {
      setPendingRun(request);
      setActiveRunId(null);
      sessionStorage.removeItem("bountymesh_active_run_id");
      sessionStorage.setItem("bountymesh_pending_run", JSON.stringify(request));
    }

    requestInFlight.current = true;
    arcadeAudio.playCoin();
    setSubmitting(true);
    setActionSuccess(false);
    setError("");

    try {
      let response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        credentials: "same-origin",
        body: JSON.stringify(request),
      });

      let result = await response.json().catch(() => ({}));
      if (response.status === 401 && sessionCookieAuth && !sessionRecoveryAttempted.current) {
        sessionRecoveryAttempted.current = true;
        if (await bootstrapSession()) {
          response = await fetch("/api/runs", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers() },
            credentials: "same-origin",
            body: JSON.stringify(request),
          });
          result = await response.json().catch(() => ({}));
        }
      }
      if (response.status === 401) {
        setSessionCookieAuth(false);
        setNeedsToken(true);
        throw new Error("Operator token required.");
      }
      if (!response.ok) throw new Error(result.error || `Task failed (${response.status})`);
      sessionRecoveryAttempted.current = false;

      if (typeof result.run?.id === "string") {
        setActiveRunId(result.run.id);
        sessionStorage.setItem("bountymesh_active_run_id", result.run.id);
      }

      const runSnapshot: Snapshot | null = isSnapshot(result.snapshot) ? result.snapshot : null;
      if (runSnapshot) {
        setSnapshot(runSnapshot);
        setHasLoadedSnapshot(true);
      }
      else await refresh(true);

      if (result.run?.status === "failed") {
        const safeToStartNewRequest = result.canStartNewRequest === true;
        setTerminalRunFailure(safeToStartNewRequest);
        throw new Error(result.run.error || (safeToStartNewRequest
          ? "This request failed and its escrow is clear. Retry with the same key or start a new request."
          : "This run may still have escrow pending. Retry with the same request key while it recovers."));
      }

      setPendingRun(null);
      sessionStorage.removeItem("bountymesh_pending_run");
      setTerminalRunFailure(false);
      setActionSuccess(true);
      setGoal("");
      arcadeAudio.playFanfare();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to subcontract task.");
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitRun(goal, rewardCents);
  };

  const connectToken = () => {
    const nextToken = tokenInput.trim();
    if (!nextToken) return;
    sessionStorage.setItem("bountymesh_token", nextToken);
    setToken(nextToken);
    setSessionCookieAuth(false);
    sessionRecoveryAttempted.current = false;
    setNeedsToken(false);
  };

  const startNewRequest = () => {
    setPendingRun(null);
    setTerminalRunFailure(false);
    sessionStorage.removeItem("bountymesh_pending_run");
    setError("");
    setActionSuccess(false);
  };

  const runLiveDemo = () => {
    if (!canRunLiveDemo || requestInFlight.current) return;
    setGoal(LIVE_DEMO_GOAL);
    setRewardCents(50);
    void submitRun(LIVE_DEMO_GOAL, 50);
  };

  const orchestrator = snapshot.agents.find((a) => a.role === "orchestrator");
  const balance = orchestrator ? `$${(orchestrator.balanceCents / 100).toFixed(2)}` : "—";
  const totalPaid = snapshot.ledger.filter((e) => e.kind === "payout").reduce((s, e) => s + e.amountCents, 0);
  const stripeTestPaid = snapshot.ledger.filter((e) => e.kind === "payout" && e.provider === "stripe").reduce((s, e) => s + e.amountCents, 0);
  const liveStripe = hasLoadedSnapshot && snapshot.config.mode === "live" && snapshot.config.payments === "stripe";

  const filteredBounties = snapshot.bounties.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.id.includes(q);
  });
  const currentInspectedBounty = inspectedBounty
    ? snapshot.bounties.find((bounty) => bounty.id === inspectedBounty.id) ?? inspectedBounty
    : null;

  return (
    <div className="app-viewport">
      {/* RPG Guild Hall Header */}
      <header className="site-header">
        <div className="header-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="site-brand" onClick={() => setActiveTab("arcade")} role="button" tabIndex={0}>
              <GuildLogo size={36} />
              <div className="brand-text-group">
                <div className="brand-title">Bounty<span>Mesh</span></div>
                <div className="brand-subtitle">Autonomous Agent Guild</div>
              </div>
            </div>

            <span className={`mode-badge ${hasLoadedSnapshot && snapshot.config.mode === "live" ? "live" : "demo"}`}>
              <span className="status-dot-ping" />
              {needsToken ? "Authorization required" : !hasLoadedSnapshot ? (connectionError ? "API unavailable" : "Connecting") : snapshot.config.mode === "live" ? `Live Network${snapshot.config.payments === "stripe" ? " · Stripe test" : ""}` : "Demo Mode"}
            </span>
            {hasLoadedSnapshot && snapshot.config.mode === "live" && !needsToken && (
              <span className={`mode-badge ${realtimeConnected ? "live" : "demo"}`}>
                <span className="status-dot-ping" />{realtimeConnected ? "Realtime connected" : "Polling API"}
              </span>
            )}
          </div>

          {/* Navigation Tabs */}
          <nav className="nav-links">
            <button
              onClick={() => {
                arcadeAudio.playClick();
                setActiveTab("arcade");
              }}
              className={`nav-link-item ${activeTab === "arcade" ? "active" : ""}`}
            >
              <Gamepad2 size={13} />
              <span>Guild Hall</span>
            </button>
            <button
              onClick={() => {
                arcadeAudio.playClick();
                setActiveTab("bounties");
              }}
              className={`nav-link-item ${activeTab === "bounties" ? "active" : ""}`}
            >
              <Trophy size={13} />
              <span>Quests</span>
              {snapshot.bounties.length > 0 && <span className="nav-count-badge">{snapshot.bounties.length}</span>}
            </button>
            <button
              onClick={() => {
                arcadeAudio.playClick();
                setActiveTab("agents");
              }}
              className={`nav-link-item ${activeTab === "agents" ? "active" : ""}`}
            >
              <Users size={13} />
              <span>Agents</span>
              <span className="nav-count-badge">{snapshot.agents.length}</span>
            </button>
            <button
              onClick={() => {
                arcadeAudio.playClick();
                setActiveTab("ledger");
              }}
              className={`nav-link-item ${activeTab === "ledger" ? "active" : ""}`}
            >
              <Receipt size={13} />
              <span>Vault</span>
            </button>
          </nav>

          {/* Escrow Balance & Refresh */}
          <div className="header-actions">
            <div className="wallet-chip">
              <Coins size={14} style={{ color: "#fbbf24" }} />
              <span className="wallet-label">{needsToken ? "AUTH REQUIRED:" : !hasLoadedSnapshot ? "CONNECTING:" : liveStripe ? "TEST PAYOUTS:" : snapshot.config.mode === "live" ? "TOTAL PAID:" : "ESCROW BALANCE:"}</span>
              <span className="wallet-value">{!hasLoadedSnapshot || needsToken ? "—" : liveStripe ? `$${(stripeTestPaid / 100).toFixed(2)}` : snapshot.config.mode === "live" ? `$${(totalPaid / 100).toFixed(2)}` : balance}</span>
            </div>

            <button
              className="action-icon-btn"
              onClick={() => {
                arcadeAudio.playClick();
                void refresh();
              }}
              title="Refresh State"
            >
              <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="app-main-content">
        {needsToken && (
          <section className="clean-card" style={{ padding: 18, marginBottom: 20, border: "1px solid rgba(251, 191, 36, 0.35)", background: "rgba(120, 83, 12, 0.12)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <ShieldAlert size={18} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <b style={{ color: "#f8fafc", fontSize: 13 }}>Operator authorization required</b>
                <p style={{ color: "#cbd5e1", fontSize: 12, margin: "5px 0 12px" }}>
                  Enter the deployment operator token to load protected network state and submit work. It stays in this browser session only.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="password"
                    autoComplete="off"
                    aria-label="Operator token"
                    placeholder="OPERATOR_TOKEN"
                    value={tokenInput}
                    onChange={(event) => setTokenInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") connectToken(); }}
                    style={{ minWidth: 240, flex: "1 1 240px", color: "#f8fafc", background: "rgba(2, 6, 23, 0.75)", border: "1px solid rgba(148, 163, 184, 0.3)", borderRadius: 6, padding: "9px 11px", outline: "none", fontFamily: "var(--font-mono)", fontSize: 12 }}
                  />
                  <button type="button" className="arcade-btn-primary" onClick={connectToken} disabled={!tokenInput.trim()} style={{ padding: "9px 14px", fontSize: 11 }}>
                    Connect operator session
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
        {connectionError && !needsToken && (
          <div style={{ color: "#fda4af", fontSize: 11, marginBottom: 14, fontFamily: "var(--font-mono)" }}>{connectionError}</div>
        )}
        {/* TAB 1: INTERACTIVE GUILD HALL ROOM */}
        {activeTab === "arcade" && (
          <div>
            {/* The Living Guild Hall Stage */}
            <ArcadeRoom
              snapshot={snapshot}
              isExecuting={submitting}
              activeRunId={activeRunId ?? undefined}
              activeRequestKey={pendingRun?.idempotencyKey}
              onRunLiveDemo={runLiveDemo}
              canRunLiveDemo={canRunLiveDemo}
              canStartWork={canStartWork}
              authHeaders={headers()}
              onSelectCharacter={(agent, customChar) => setInspectedAgent({ agent, char: customChar })}
              onSelectBounty={(bounty) => setInspectedBounty(bounty)}
              onFillGoal={(text) => { if (canStartWork && !pendingRun && !submitting) setGoal(text); }}
              onSwitchTab={(tab) => setActiveTab(tab)}
            />

            {/* Quest Notice Board Creator */}
            <div className="task-creator-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Terminal size={17} style={{ color: "var(--accent-gold)" }} />
                  <h3 className="panel-arcade-title">
                    Guild Notice Board
                  </h3>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-blue)" }}>
                  pgvector matching · escrow secured
                </span>
              </div>

              {/* Live Task Specification */}
              <label htmlFor="task-specification" className="task-field-label">
                Task Specification
              </label>
              {/* Form Input */}
              <form onSubmit={handleSubmit}>
                <textarea
                  id="task-specification"
                  className="task-textarea"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Describe what research, analysis, or code artifact you want delivered by autonomous specialist agents..."
                  disabled={!canStartWork || submitting || !!pendingRun}
                  required
                  minLength={10}
                  rows={3}
                />

                {error && (
                  <div style={{ color: "var(--accent-red)", fontSize: 12, marginTop: 10, display: "flex", alignItems: "center", gap: 8, background: "rgba(201, 107, 107, 0.12)", padding: "10px 14px", borderRadius: "var(--radius-xs)", border: "1px solid var(--accent-red)" }}>
                    <ShieldAlert size={15} />
                    <span>{error}</span>
                  </div>
                )}

                {actionSuccess && (
                  <div style={{ color: "var(--accent-green-bright)", fontSize: 12, marginTop: 10, display: "flex", alignItems: "center", gap: 8, background: "rgba(132, 169, 110, 0.15)", padding: "10px 14px", borderRadius: "var(--radius-xs)", border: "1px solid var(--accent-green)" }}>
                    <CheckCircle2 size={15} />
                    <span>Task run completed. Review the returned deliverable and recorded payment status below.</span>
                  </div>
                )}

                {/* Form Controls */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, flexWrap: "wrap", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-muted)" }}>
                      Reward:
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      {BUDGET_PRESETS.map((p) => (
                        <button
                          key={p.cents}
                          type="button"
                          className={`arcade-coin-btn ${rewardCents === p.cents ? "active" : ""}`}
                          onClick={() => {
                            arcadeAudio.playCoin();
                            setRewardCents(p.cents);
                          }}
                          disabled={!canStartWork || submitting || !!pendingRun}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    {!goal && (
                      <button
                        type="button"
                        className="arcade-btn-pill"
                        onClick={runLiveDemo}
                        disabled={!canRunLiveDemo || submitting || !!pendingRun}
                        title={canRunLiveDemo ? "Posts the safe example as a real live task with a 50¢ Stripe test authorization" : "Requires a ready authenticated live network"}
                      >
                        Run Live Demo · $0.50
                      </button>
                    )}

                    <button
                      type="submit"
                      className="arcade-btn-primary"
                      disabled={!networkReady || submitting || goal.trim().length < 10}
                      style={{ fontSize: 11, padding: "10px 18px" }}
                    >
                      {submitting ? (
                        <>
                          <RefreshCw size={13} className="spin-icon" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />
                          {snapshot.config.mode === "live" ? "Running live task…" : "Matching Agents..."}
                        </>
                      ) : (
                        <>
                          {pendingRun ? "Retry Same Request →" : "Start Live Task →"}
                        </>
                      )}
                    </button>
                    {pendingRun && terminalRunFailure && (
                      <button type="button" className="arcade-btn-pill" onClick={startNewRequest} disabled={submitting}>
                        Start a New Request
                      </button>
                    )}
                  </div>
                </div>
                {pendingRun && (
                  <div style={{ color: terminalRunFailure ? "#fbbf24" : "#94a3b8", fontSize: 10, marginTop: 10, fontFamily: "var(--font-mono)" }}>
                    {terminalRunFailure
                      ? "This run is confirmed failed. Retry keeps the same request key; start a new request to use a new key."
                      : "This request is not safe to replace yet. Goal and reward stay locked; retry the same key to resume escrow recovery."}
                  </div>
                )}
              </form>
            </div>

            {/* Recent Completed Quests Preview */}
            <div className="clean-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Trophy size={16} style={{ color: "var(--accent-gold)" }} />
                  <h3 className="panel-arcade-title">
                    Recently Completed Quests
                  </h3>
                </div>
                <button
                  onClick={() => {
                    arcadeAudio.playClick();
                    setActiveTab("bounties");
                  }}
                  className="arcade-btn-pill"
                >
                  View All ({snapshot.bounties.length})
                </button>
              </div>

              {snapshot.bounties.length > 0 ? (
                <table className="fintech-table">
                  <thead>
                    <tr>
                      <th>Quest Title</th>
                      <th>Status</th>
                      <th>Assigned Agent</th>
                      <th style={{ textAlign: "right" }}>Reward</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.bounties.slice(0, 4).map((b) => (
                      <tr
                        key={b.id}
                        className="fintech-row"
                        onClick={() => {
                          arcadeAudio.playClick();
                          setInspectedBounty(b);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <b style={{ color: "var(--text-main)", display: "block", fontSize: 13 }}>{b.title}</b>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                            #{b.id.slice(0, 8)}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill status-${b.status}`}>
                            {b.status === "paid" ? "CLEARED" : b.status}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                            {snapshot.agents.find((a) => a.id === b.workerId)?.name || "Specialist"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="mono-amount emerald">
                            ${(b.rewardCents / 100).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 11, color: "var(--accent-gold)", fontWeight: 600 }}>
                            View Deliverable
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  No completed tasks yet. Post an autonomous task in the Arcade Hall to see completed bounties here.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: QUEST BOARD & REPOSITORY */}
        {activeTab === "bounties" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 className="panel-arcade-title" style={{ fontSize: 16, marginBottom: 6 }}>
                  Quest Board & Deliverable Archive
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  Inspect specialist research deliverables, automated rubric audits, and cryptographic escrow proofs.
                </p>
              </div>

              {/* Search */}
              <div style={{ position: "relative", minWidth: 260 }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search quests by keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--bg-input)",
                    border: "2px solid var(--border-outer)",
                    borderRadius: "var(--radius-xs)",
                    padding: "8px 12px 8px 34px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--text-main)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div className="clean-card" style={{ padding: 0, overflow: "hidden" }}>
              {filteredBounties.length > 0 ? (
                <table className="fintech-table">
                  <thead>
                    <tr>
                      <th style={{ padding: "14px 18px 8px" }}>Quest Title</th>
                      <th style={{ padding: "14px 18px 8px" }}>Status</th>
                      <th style={{ padding: "14px 18px 8px" }}>Assigned Agent</th>
                      <th style={{ padding: "14px 18px 8px", textAlign: "right" }}>Reward</th>
                      <th style={{ padding: "14px 18px 8px", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBounties.map((b) => (
                      <tr
                        key={b.id}
                        className="fintech-row"
                        onClick={() => {
                          arcadeAudio.playClick();
                          setInspectedBounty(b);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ padding: "14px 18px" }}>
                          <b style={{ color: "var(--text-main)", display: "block", fontSize: 13 }}>{b.title}</b>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                            #{b.id.slice(0, 8)} · {new Date(b.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span className={`status-pill status-${b.status}`}>
                            {b.status === "paid" ? "CLEARED" : b.status}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                            {snapshot.agents.find((a) => a.id === b.workerId)?.name || "Specialist"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <span className="mono-amount emerald" style={{ fontSize: 14 }}>
                            ${(b.rewardCents / 100).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <span style={{ fontSize: 11, color: "var(--accent-gold)", fontWeight: 600 }}>
                            View Deliverable
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  No quests found. Post a task in the Guild Hall to see autonomous execution!
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: AGENTS GUILD ROSTER */}
        {activeTab === "agents" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 className="panel-arcade-title" style={{ fontSize: 16, marginBottom: 6 }}>
                Guild Agent Roster
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Autonomous specialist agents registered with 768-dimensional pgvector capability embeddings.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16 }}>
              {snapshot.agents.map((agent) => {
                const isOrchestrator = agent.role === "orchestrator";
                const roleBadgeColor = isOrchestrator ? "var(--accent-purple)" : "var(--accent-blue)";

                return (
                  <div
                    key={agent.id}
                    className="fighter-card"
                    onClick={() => {
                      arcadeAudio.playClick();
                      setInspectedAgent({ agent });
                    }}
                  >
                    <div className="fighter-portrait-strip">
                      <div>
                        <h3 className="fighter-name">{agent.name}</h3>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "block", marginTop: 4 }}>
                          {agent.model}
                        </span>
                      </div>
                      <span className="rpg-badge" style={{ background: roleBadgeColor, color: "#1a1411" }}>
                        {isOrchestrator ? "ORCHESTRATOR" : "SPECIALIST"}
                      </span>
                    </div>

                    <div className="fighter-stat-meter">
                      <div>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "block" }}>Vault Balance</span>
                        <b style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--accent-gold)" }}>
                          ${(agent.earnedCents / 100).toFixed(2)}
                        </b>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "block" }}>Tasks Delivered</span>
                        <b style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--accent-green-bright)" }}>
                          {agent.tasksCompleted}
                        </b>
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                        Specialties
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {agent.skills.map((s, idx) => (
                          <span key={idx} className="rpg-skill-chip">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border-inner)", display: "flex", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 11, color: "var(--accent-gold)", fontWeight: 600 }}>
                        View Agent Dossier
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: ESCROW VAULT & SETTLEMENT LOG */}
        {activeTab === "ledger" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 className="panel-arcade-title" style={{ fontSize: 16, marginBottom: 6 }}>
                Escrow Settlement Ledger
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Recorded escrow holds, worker payouts, and refunds.
              </p>
            </div>

            <div className="clean-card" style={{ padding: 0, overflow: "hidden" }}>
              {snapshot.ledger.length > 0 ? (
                <table className="fintech-table">
                  <thead>
                    <tr>
                      <th style={{ padding: "14px 18px 8px" }}>Event Kind</th>
                      <th style={{ padding: "14px 18px 8px" }}>Task Reference</th>
                      <th style={{ padding: "14px 18px 8px" }}>Settlement Rail</th>
                      <th style={{ padding: "14px 18px 8px" }}>Timestamp</th>
                      <th style={{ padding: "14px 18px 8px", textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.ledger.map((entry) => (
                      <tr key={entry.id} className="fintech-row" style={{ cursor: "default" }}>
                        <td style={{ padding: "14px 18px" }}>
                          <b style={{ color: entry.kind === "payout" ? "var(--accent-green-bright)" : "var(--accent-gold)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                            {entry.kind === "payout" ? "Payout Released" : entry.kind === "refund" ? "Refund Issued" : "Escrow Locked"}
                          </b>
                          <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                            tx_{entry.id.slice(0, 8)}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                            #{entry.bountyId.slice(0, 8)}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", background: "var(--bg-input)", border: "1px solid var(--border-inner)", padding: "2px 8px", borderRadius: 3 }}>
                            {entry.provider.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                          {new Date(entry.createdAt).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <span className="mono-amount" style={{ color: entry.kind === "payout" ? "var(--accent-green-bright)" : "var(--text-main)", fontSize: 15 }}>
                            ${(entry.amountCents / 100).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  No transactions recorded yet. Post a task in the Guild Hall to create the first deposit!
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Agent Dossier Modal */}
      {inspectedAgent && (
        <ArcadeCharacterModal
          agent={inspectedAgent.agent}
          customChar={inspectedAgent.char}
          onClose={() => setInspectedAgent(null)}
          onAssignTask={() => {
            setActiveTab("arcade");
            setInspectedAgent(null);
          }}
        />
      )}

      {currentInspectedBounty && (
        <ArcadeDeliverableModal
          bounty={currentInspectedBounty}
          onClose={() => setInspectedBounty(null)}
        />
      )}

      {/* Guild Hall Footer */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <GuildLogo size={26} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "var(--accent-gold)", fontWeight: 700, fontSize: 13, letterSpacing: "-0.2px" }}>
                BountyMesh · Adventurer&apos;s Guild
              </span>
              <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
                Autonomous AI Agent Micro-Work & Escrow Settlement
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <button onClick={() => setActiveTab("arcade")} style={{ color: "var(--text-muted)", cursor: "pointer" }}>Guild Hall</button>
            <button onClick={() => setActiveTab("bounties")} style={{ color: "var(--text-muted)", cursor: "pointer" }}>Quests</button>
            <button onClick={() => setActiveTab("agents")} style={{ color: "var(--text-muted)", cursor: "pointer" }}>Agents</button>
            <button onClick={() => setActiveTab("ledger")} style={{ color: "var(--text-muted)", cursor: "pointer" }}>Vault</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
