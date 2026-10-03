"use client";

import { useCallback, useEffect, useState } from "react";
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
import { DEFAULT_GOAL } from "@/lib/contracts";
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
  config: { mode: "demo", storage: "local", payments: "demo", ready: false, missing: [], orchestratorModel: "", workerModel: "" },
};

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<Snapshot>;
  return Array.isArray(data.agents) && Array.isArray(data.bounties) && Array.isArray(data.activity)
    && Array.isArray(data.ledger) && Array.isArray(data.runs) && !!data.config
    && (data.config.mode === "demo" || data.config.mode === "live");
}

const EXAMPLE_TASKS = [
  { label: "Market Opportunity Brief", text: DEFAULT_GOAL },
  { label: "Competitive Pricing Matrix", text: "Analyze competitive pricing, fee structures, and escrow hold mechanics across autonomous agent marketplaces." },
  { label: "Vector Routing Benchmark", text: "Benchmark semantic similarity thresholds and latency for pgvector matching in agent subcontracting pipelines." },
  { label: "Code Quality Rubric", text: "Draft an automated verification checklist and rubric for code artifacts delivered by autonomous specialist agents." },
];

const BUDGET_PRESETS = [
  { label: "$0.50", cents: 50 },
  { label: "$1.00", cents: 100 },
  { label: "$2.50", cents: 250 },
  { label: "$5.00", cents: 500 },
];

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [activeTab, setActiveTab] = useState<"arcade" | "bounties" | "agents" | "ledger">("arcade");
  const [goal, setGoal] = useState("");
  const [rewardCents, setRewardCents] = useState(50);
  const [token, setToken] = useState("");
  const [, setNeedsToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState(false);

  // Modals state
  const [inspectedAgent, setInspectedAgent] = useState<{ agent: Agent | null; char?: ArcadeCharacter } | null>(null);
  const [inspectedBounty, setInspectedBounty] = useState<Bounty | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const headers = useCallback((): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const refresh = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const response = await fetch("/api/state", { headers: headers(), cache: "no-store" });
        if (response.status === 401) {
          setNeedsToken(true);
          return;
        }
        if (!response.ok) throw new Error(`Could not load network state (${response.status})`);
        const data: unknown = await response.json();
        if (!isSnapshot(data)) throw new Error("Invalid snapshot returned.");
        setSnapshot(data);
        setNeedsToken(false);
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [headers]
  );

  useEffect(() => {
    const saved = sessionStorage.getItem("bountymesh_token");
    if (saved) setToken(saved);
    void refresh();
  }, [refresh]);

  // Polling state refresh
  useEffect(() => {
    const interval = setInterval(() => void refresh(true), submitting ? 1200 : 4000);
    return () => clearInterval(interval);
  }, [refresh, submitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGoal = goal.trim();
    if (cleanGoal.length < 10) {
      setError("Please describe the task with at least 10 characters.");
      return;
    }

    arcadeAudio.playCoin();
    setSubmitting(true);
    setActionSuccess(false);
    setError("");

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({
          goal: cleanGoal,
          rewardCents,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setNeedsToken(true);
        throw new Error("Operator token required.");
      }
      if (!response.ok) throw new Error(result.error || `Task failed (${response.status})`);

      if (result.snapshot) setSnapshot(result.snapshot as Snapshot);
      else await refresh(true);

      setActionSuccess(true);
      setGoal("");
      arcadeAudio.playFanfare();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to subcontract task.");
    } finally {
      setSubmitting(false);
    }
  };

  const orchestrator = snapshot.agents.find((a) => a.role === "orchestrator");
  const balance = orchestrator ? `$${(orchestrator.balanceCents / 100).toFixed(2)}` : "$10.00";

  const filteredBounties = snapshot.bounties.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.id.includes(q);
  });

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

            <span className={`mode-badge ${snapshot.config.mode === "live" ? "live" : "demo"}`}>
              <span className="status-dot-ping" />
              {snapshot.config.mode === "live" ? "Live Network" : "Demo Guild"}
            </span>
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
              <Coins size={14} style={{ color: "var(--accent-gold)" }} />
              <span className="wallet-label">Escrow:</span>
              <span className="wallet-value">{balance}</span>
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
        {/* TAB 1: INTERACTIVE GUILD HALL ROOM */}
        {activeTab === "arcade" && (
          <div>
            {/* The Living Guild Hall Stage */}
            <ArcadeRoom
              snapshot={snapshot}
              activeGoal={goal}
              rewardCents={rewardCents}
              isExecuting={submitting}
              onSelectCharacter={(agent, customChar) => setInspectedAgent({ agent, char: customChar })}
              onSelectBounty={(bounty) => setInspectedBounty(bounty)}
              onFillGoal={(text) => setGoal(text)}
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

              {/* Task Specification & Example Presets */}
              <label htmlFor="task-specification" className="task-field-label">
                Task Specification
              </label>
              <div className="example-chips-row">
                {EXAMPLE_TASKS.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    className="example-chip"
                    onClick={() => {
                      arcadeAudio.playClick();
                      setGoal(ex.text);
                    }}
                    disabled={submitting}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>

              {/* Form Input */}
              <form onSubmit={handleSubmit}>
                <textarea
                  id="task-specification"
                  className="task-textarea"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Describe what research, analysis, or code artifact you want delivered by autonomous specialist agents..."
                  disabled={submitting}
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
                    <span>Task cleared and verified. Escrow payout settled. Review deliverable below.</span>
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
                          disabled={submitting}
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
                        onClick={() => {
                          arcadeAudio.playClick();
                          setGoal(DEFAULT_GOAL);
                        }}
                        disabled={submitting}
                      >
                        Load Example
                      </button>
                    )}

                    <button
                      type="submit"
                      className="arcade-btn-primary"
                      disabled={submitting || goal.trim().length < 10}
                    >
                      {submitting ? (
                        <>
                          <RefreshCw size={13} className="spin-icon" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />
                          Matching Agents...
                        </>
                      ) : (
                        "Post Task to Guild"
                      )}
                    </button>
                  </div>
                </div>
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
                  No completed quests yet. Post your first task on the notice board above!
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
                Cryptographic transaction log of all micro-escrow deposits, worker settlement transfers, and refunds.
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
                            {entry.kind === "payout" ? "Payout Released" : "Escrow Locked"}
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
                            {entry.kind === "refund" ? "+" : "-"}${(entry.amountCents / 100).toFixed(2)}
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

      {/* Deliverable Debrief Modal */}
      {inspectedBounty && (
        <ArcadeDeliverableModal
          bounty={inspectedBounty}
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
