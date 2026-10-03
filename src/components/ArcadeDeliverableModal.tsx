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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="rpg-badge" style={{ background: "#10b981", color: "#000" }}>
              {bounty.status.toUpperCase()}
            </span>
            <div>
              <h2 className="rpg-name">{bounty.title}</h2>
              <span className="rpg-subtext">TASK #{bounty.id.slice(0, 8)} · ESCROW: ${(bounty.rewardCents / 100).toFixed(2)} USD</span>
            </div>
          </div>

          <button onClick={onClose} className="arcade-close-btn">
            <X size={16} />
          </button>
        </div>

        {/* Task Specification Given */}
        <div style={{ marginTop: 14 }}>
          <span className="rpg-section-title">TASK SPECIFICATION</span>
          <p className="rpg-lore-text" style={{ fontSize: 13, background: "rgba(0,0,0,0.5)", padding: 12, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
            {bounty.description}
          </p>
        </div>

        {/* Specialist Deliverable Terminal */}
        {bounty.deliverable && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span className="rpg-section-title" style={{ color: "var(--accent-emerald-light)" }}>
                DELIVERABLE ARTIFACT ({bounty.deliverable.kind.toUpperCase()})
              </span>
              <button
                className="arcade-btn-pill"
                onClick={() => handleCopy(bounty.deliverable?.content ?? "")}
                style={{ fontSize: 11, padding: "4px 10px" }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "COPIED!" : "COPY"}
              </button>
            </div>

            {bounty.deliverable.summary && (
              <p style={{ fontSize: 12, color: "#ffffff", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
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
            <span className="rpg-section-title" style={{ color: "#34d399" }}>
              ORCHESTRATOR RUBRIC AUDIT
            </span>
            <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: 6, padding: 12, fontSize: 12, color: "#d1fae5", lineHeight: 1.55 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontWeight: 700, color: "var(--accent-emerald-light)" }}>
                <CheckCircle2 size={14} /> RUBRIC CHECK: PASSED
              </div>
              {bounty.review}
            </div>
          </div>
        )}

        {/* Modal Close Button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} className="arcade-btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
