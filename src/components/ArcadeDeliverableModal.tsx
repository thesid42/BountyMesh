"use client";

import { useState } from "react";
import { X, Copy, Check, CheckCircle2, ShieldAlert, CircleAlert } from "lucide-react";
import type { Bounty } from "@/lib/contracts";

interface ArcadeDeliverableModalProps {
  bounty: Bounty | null;
  onClose: () => void;
}

export function ArcadeDeliverableModal({ bounty, onClose }: ArcadeDeliverableModalProps) {
  const [copied, setCopied] = useState(false);

  if (!bounty) return null;

  const failed = bounty.status === "failed";
  const reviewPassed = ["verified", "settling", "paid"].includes(bounty.status);
  const statusColor = failed ? "var(--accent-red)" : reviewPassed ? "var(--accent-green)" : "#64748b";

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
            <span
              className="rpg-badge"
              style={{
                background: statusColor,
                color: failed ? "#ffffff" : "#000",
              }}
            >
              {bounty.status === "paid" ? "CLEARED" : failed ? "REJECTED (REFUNDED)" : bounty.status.toUpperCase()}
            </span>
            <div>
              <h2 className="rpg-name">{bounty.title}</h2>
              <span className="rpg-subtext">Task Artifact #{bounty.id.slice(0, 8)} · Escrow: ${(bounty.rewardCents / 100).toFixed(2)}</span>
            </div>
          </div>

          <button onClick={onClose} className="arcade-close-btn" aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {/* Client Specification */}
        <div style={{ marginTop: 14 }}>
          <span className="rpg-section-title">Client Specification</span>
          <p className="rpg-lore-text" style={{ fontSize: 13, background: "var(--bg-input)", padding: 12, borderRadius: 4, border: "2px solid var(--border-outer)" }}>
            {bounty.description}
          </p>
        </div>

        {/* Specialist Deliverable */}
        {bounty.deliverable && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="rpg-section-title">Specialist Deliverable</span>
              <button
                className="arcade-btn-pill"
                onClick={() => handleCopy(bounty.deliverable?.content ?? "")}
                style={{ fontSize: 11, padding: "5px 12px" }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy Deliverable"}
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

        {/* Rubric Audit Verdict */}
        {bounty.review && (
          <div style={{ marginTop: 16 }}>
            <span
              className="rpg-section-title"
              style={{ color: failed ? "var(--accent-red)" : "var(--accent-green)" }}
            >
              {failed ? "Run Failure / Rubric Rejection" : "Rubric Audit Verdict"}
            </span>
            <div
              style={{
                background: failed ? "rgba(201, 107, 107, 0.12)" : "rgba(132, 169, 110, 0.12)",
                border: `2px solid ${failed ? "var(--accent-red)" : "var(--border-outer)"}`,
                borderRadius: 4,
                padding: 12,
                fontSize: 13,
                color: "var(--text-main)",
                lineHeight: 1.55,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                  fontWeight: 700,
                  color: failed ? "var(--accent-red)" : "var(--accent-green-bright)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
              >
                {failed ? <ShieldAlert size={14} /> : reviewPassed ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}
                {failed
                  ? "VERIFICATION FAILED · RUBRIC UNSATISFIED (ESCROW REFUNDED)"
                  : reviewPassed
                  ? "VERIFICATION PASSED · 100% RUBRIC SATISFACTION"
                  : "REVIEW NOTE"}
              </div>
              {bounty.review}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          {bounty.deliverable && (
            <button
              onClick={() => handleCopy(bounty.deliverable?.content ?? "")}
              className="arcade-btn-pill"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy Deliverable"}
            </button>
          )}
          <button onClick={onClose} className="arcade-btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
