"use client";

import { X, FileText, CheckCircle2, ArrowRight, ShieldCheck, Plus, Sparkles } from "lucide-react";
import type { Bounty } from "@/lib/contracts";

interface GuildNoticeBoardModalProps {
  bounties: Bounty[];
  onClose: () => void;
  onSelectBounty: (bounty: Bounty) => void;
  onLoadGoal: (text: string) => void;
}

export function GuildNoticeBoardModal({
  bounties,
  onClose,
  onSelectBounty,
  onLoadGoal,
}: GuildNoticeBoardModalProps) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="arcade-rpg-dialog" style={{ maxWidth: 740 }}>
        {/* Header */}
        <div className="rpg-dialog-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="rpg-badge" style={{ background: "var(--accent-gold)", color: "var(--border-outer)" }}>
              GUILD NOTICE BOARD
            </span>
            <div>
              <h2 className="rpg-name">Adventurer&apos;s Quest Board</h2>
              <span className="rpg-subtext">Pinned bounties and client task directives</span>
            </div>
          </div>

          <button onClick={onClose} className="arcade-close-btn" aria-label="Close Notice Board">
            <X size={16} />
          </button>
        </div>

        {/* Board Description */}
        <p className="rpg-lore-text" style={{ margin: "14px 0 10px" }}>
          The wooden board is covered with pinned parchment sheets. Travelers post requirements with gold in escrow, while specialist agents claim and deliver verified artifacts.
        </p>

        {/* Pinned Parchment Quest Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12, maxHeight: 340, overflowY: "auto", padding: "4px 2px" }}>
          {bounties.length > 0 ? (
            bounties.map((b) => (
              <div
                key={b.id}
                style={{
                  background: "var(--bg-surface)",
                  border: "2px solid var(--border-outer)",
                  boxShadow: "inset 0 0 0 1px var(--border-inner), 0 3px 0 var(--border-outer)",
                  borderRadius: "var(--radius-xs)",
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
                      #{b.id.slice(0, 8)}
                    </span>
                    <span className={`status-pill status-${b.status}`}>
                      {b.status === "paid" ? "CLEARED" : b.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", marginBottom: 4, lineHeight: 1.3 }}>
                    {b.title}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45, maxHeight: 48, overflow: "hidden" }}>
                    {b.description}
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--border-inner)" }}>
                  <span className="mono-amount emerald" style={{ fontSize: 15 }}>
                    ${(b.rewardCents / 100).toFixed(2)}
                  </span>

                  <button
                    onClick={() => {
                      onClose();
                      onSelectBounty(b);
                    }}
                    className="arcade-btn-pill"
                    style={{ fontSize: 10, padding: "5px 10px" }}
                  >
                    View Deliverable →
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              No quests currently pinned on the board. Create one below to deploy specialist agents!
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 14, borderTop: "2px solid var(--border-inner)" }}>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            {bounties.length} quests recorded in guild ledger
          </span>

          <button onClick={onClose} className="arcade-btn-primary">
            Close Notice Board
          </button>
        </div>
      </div>
    </div>
  );
}
