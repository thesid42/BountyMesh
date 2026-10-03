"use client";

import { useState } from "react";
import { X, Copy, Check, Terminal, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";
import type { Bounty } from "@/lib/contracts";

interface ArcadeDeliverableModalProps {
  bounty: Bounty | null;
  onClose: () => void;
}

export function ArcadeDeliverableModal({ bounty, onClose }: ArcadeDeliverableModalProps) {
  const [copied, setCopied] = useState(false);

  if (!bounty) return null;

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="arcade-rpg-dialog" style={{ maxWidth: 760 }}>
        {/* Header */}
        <div className="rpg-dialog-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="rpg-badge" style={{ background: "var(--accent-green)", color: "var(--border-outer)" }}>
              {bounty.status === "paid" ? "CLEARED" : bounty.status.toUpperCase()}
            </span>
            <div>
              <h2 className="rpg-name">{bounty.title}</h2>
              <span className="rpg-subtext">QUEST #{bounty.id.slice(0, 8)} · ESCROW: ${(bounty.rewardCents / 100).toFixed(2)}</span>
            </div>
          </div>

          <button onClick={onClose} className="arcade-close-btn">
            <X size={16} />
          </button>
        </div>

        {/* Task Specification Given */}
        <div style={{ marginTop: 14 }}>
          <span className="rpg-section-title">CLIENT SPECIFICATION & OBJECTIVE</span>
          <p className="rpg-lore-text" style={{ fontSize: 13, background: "var(--bg-input)", padding: 12, borderRadius: 4, border: "2px solid var(--border-outer)" }}>
            {bounty.description}
          </p>
        </div>

        {/* Specialist Deliverable Terminal */}
        {bounty.deliverable && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="rpg-section-title">
                SPECIALIST DELIVERABLE ({bounty.deliverable.kind.toUpperCase()})
              </span>
              <button
                className="arcade-btn-pill"
                onClick={() => handleCopy(bounty.deliverable?.content ?? "")}
                style={{ fontSize: 10, padding: "5px 12px" }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied!" : "Copy Deliverable"}
              </button>
            </div>

            {bounty.deliverable.summary && (
              <p style={{ fontSize: 13, color: "var(--text-main)", marginBottom: 8, fontWeight: 500 }}>
                {bounty.deliverable.summary}
              </p>
            )}

            <div className="arcade-deliverable-screen">
              {bounty.deliverable.content}
            </div>
          </div>
        )}

        {/* Orchestrator Rubric Review */}
        {bounty.review && (
          <div style={{ marginTop: 16 }}>
            <span className="rpg-section-title" style={{ color: "var(--accent-green)" }}>
              ORCHESTRATOR RUBRIC AUDIT & VERDICT
            </span>
            <div style={{ background: "rgba(132, 169, 110, 0.12)", border: "2px solid var(--border-outer)", borderRadius: 4, padding: 12, fontSize: 13, color: "var(--text-main)", lineHeight: 1.55 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontWeight: 700, color: "var(--accent-green-bright)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                <CheckCircle2 size={14} /> VERIFICATION PASSED · 100% RUBRIC SATISFACTION
              </div>
              {bounty.review}
            </div>
          </div>
        )}

        {/* Modal Close Button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} className="arcade-btn-primary">
            Close Deliverable
          </button>
        </div>
      </div>
    </div>
  );
}
