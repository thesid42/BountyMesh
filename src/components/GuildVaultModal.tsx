"use client";

import { X, Lock, ArrowUpRight, ArrowDownLeft, ShieldCheck, Receipt, ExternalLink } from "lucide-react";
import type { LedgerEntry, Bounty } from "@/lib/contracts";

interface GuildVaultModalProps {
  ledger: LedgerEntry[];
  bounties: Bounty[];
  providerName: string;
  onClose: () => void;
  onViewFullLedger: () => void;
}

export function GuildVaultModal({
  ledger,
  bounties,
  providerName,
  onClose,
  onViewFullLedger,
}: GuildVaultModalProps) {
  const totalPaid = ledger
    .filter((e) => e.kind === "payout")
    .reduce((sum, e) => sum + e.amountCents, 0);

  const totalHeld = bounties
    .filter((b) => b.escrowStatus === "held")
    .reduce((sum, b) => sum + b.rewardCents, 0);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="arcade-rpg-dialog" style={{ maxWidth: 700 }}>
        {/* Header */}
        <div className="rpg-dialog-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="rpg-badge" style={{ background: "var(--accent-gold)", color: "var(--border-outer)" }}>
              ESCROW VAULT
            </span>
            <div>
              <h2 className="rpg-name">Guild Escrow Vault & Treasury</h2>
              <span className="rpg-subtext">Recorded payment holds and worker transfers</span>
            </div>
          </div>

          <button onClick={onClose} className="arcade-close-btn" aria-label="Close Vault">
            <X size={16} />
          </button>
        </div>

        {/* Treasury Metrics Grid */}
        <div className="rpg-stats-grid" style={{ marginTop: 14 }}>
          <div className="rpg-stat-box">
            <span className="rpg-stat-label">TOTAL PAID TO WORKERS</span>
            <b className="rpg-stat-val" style={{ color: "var(--accent-green-bright)" }}>
              ${(totalPaid / 100).toFixed(2)}
            </b>
          </div>

          <div className="rpg-stat-box">
            <span className="rpg-stat-label">FUNDS PENDING SETTLEMENT</span>
            <b className="rpg-stat-val" style={{ color: "var(--accent-gold)" }}>
              ${(totalHeld / 100).toFixed(2)}
            </b>
          </div>

          <div className="rpg-stat-box">
            <span className="rpg-stat-label">SETTLEMENT RAIL</span>
            <b className="rpg-stat-val" style={{ color: "var(--accent-blue)", fontSize: 14 }}>
              {providerName === "stripe" ? "Stripe test" : "Demo credits"}
            </b>
          </div>
        </div>

        {/* Escrow Guarantee Text */}
        <div style={{ marginTop: 14, background: "var(--bg-input)", border: "2px solid var(--border-outer)", borderRadius: "var(--radius-xs)", padding: 12 }}>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-gold)", display: "block", marginBottom: 4 }}>
            PAYMENT WORKFLOW
          </span>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
            {providerName === "stripe"
              ? "Stripe test mode authorizes the reward before matching, captures it after Claude approves the deliverable, and transfers it to the configured connected account. A recorded payout confirms settlement. Failed work releases its authorization when possible; interrupted settlement can require a retry."
              : "Demo credits are held before matching and recorded as a worker payout after review. Failed work releases the held credits. These entries do not move money."}
          </p>
        </div>

        {/* Recent Ledger Entries */}
        <div style={{ marginTop: 16 }}>
          <span className="rpg-section-title">RECENT TREASURY TRANSACTIONS</span>
          <div style={{ maxHeight: 180, overflowY: "auto", border: "2px solid var(--border-outer)", borderRadius: "var(--radius-xs)", background: "var(--bg-surface)" }}>
            {ledger.length > 0 ? (
              <table className="fintech-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "8px 12px" }}>EVENT</th>
                    <th style={{ padding: "8px 12px" }}>TASK</th>
                    <th style={{ padding: "8px 12px" }}>DATE</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.slice(0, 5).map((entry) => (
                    <tr key={entry.id} className="fintech-row">
                      <td style={{ padding: "8px 12px", fontSize: 12 }}>
                        <span style={{ color: entry.kind === "payout" ? "var(--accent-green-bright)" : "var(--accent-gold)", fontWeight: 600 }}>
                          {entry.kind === "payout" ? "Worker payout" : entry.kind === "refund" ? "Hold released" : "Payment hold"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-blue)" }}>
                        #{entry.bountyId.slice(0, 8)}
                      </td>
                      <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        <span className="mono-amount" style={{ color: entry.kind === "payout" ? "var(--accent-green-bright)" : "var(--text-main)", fontSize: 13 }}>
                          ${(entry.amountCents / 100).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                No treasury transactions recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <button
            onClick={() => {
              onClose();
              onViewFullLedger();
            }}
            className="arcade-btn-pill"
          >
            Open Full Ledger Tab →
          </button>

          <button onClick={onClose} className="arcade-btn-primary">
            Close Vault
          </button>
        </div>
      </div>
    </div>
  );
}
