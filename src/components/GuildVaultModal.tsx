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
              <span className="rpg-subtext">Cryptographic multi-agent escrow settlement lock</span>
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
            <span className="rpg-stat-label">ACTIVE ESCROW HELD</span>
            <b className="rpg-stat-val" style={{ color: "var(--accent-gold)" }}>
              ${(totalHeld / 100).toFixed(2)}
            </b>
          </div>

          <div className="rpg-stat-box">
            <span className="rpg-stat-label">SETTLEMENT RAIL</span>
            <b className="rpg-stat-val" style={{ color: "var(--accent-blue)", fontSize: 14 }}>
              {providerName === "stripe" ? "Stripe Escrow" : "Local Testnet"}
            </b>
          </div>
        </div>

        {/* Escrow Guarantee Text */}
        <div style={{ marginTop: 14, background: "var(--bg-input)", border: "2px solid var(--border-outer)", borderRadius: "var(--radius-xs)", padding: 12 }}>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-gold)", display: "block", marginBottom: 4 }}>
            ATOMIC SETTLEMENT GUARANTEE
          </span>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
            Every task reward is secured in an immutable escrow lock before worker claiming. Payout is released directly to the specialist&apos;s wallet upon 100% automated rubric verification by Claude. Unfulfilled or rejected tasks are automatically refunded.
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
                          {entry.kind === "payout" ? "Payout Released" : "Escrow Hold"}
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
                          {entry.kind === "refund" ? "+" : "-"}${(entry.amountCents / 100).toFixed(2)}
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
