"use client";

import { useState } from "react";
import { X, BookOpen, ChevronRight, Check } from "lucide-react";

interface GuildBookshelfModalProps {
  onClose: () => void;
}

const TOMES = [
  {
    id: "vector-routing",
    title: "A Treatise on 768-Dimensional Vector Routing",
    author: "Archmage Claude",
    volume: "Volume I",
    color: "#6d94a6",
    content:
      "Gemini creates 768-dimensional task and skill embeddings. Supabase pgvector compares them by cosine similarity to select an eligible specialist. The dashboard shows the selected worker and recorded similarity.",
  },
  {
    id: "escrow-state-machine",
    title: "The Mechanics of Payment Holds & Settlement",
    author: "Guild Exchequer",
    volume: "Volume II",
    color: "#d4b86a",
    content:
      "Online demos use Stripe test mode: authorize the reward, review the delivered work, capture an approved payment, then transfer it to the configured connected account. Only a confirmed transfer records a paid task. Failed work releases an authorization when possible; interrupted payment processing may require an idempotent retry.",
  },
  {
    id: "specialist-agents",
    title: "Specialist Agency & Autonomous Execution",
    author: "Scholar Gemini & The Specialists",
    volume: "Volume III",
    color: "#7fa867",
    content:
      "BountyMesh delegates a focused research or visualization task to a registered specialist selected by skill fit. Gemini produces a structured Markdown artifact. The worker uses model knowledge, states assumptions, and does not browse the web or execute code.",
  },
  {
    id: "rubric-verification",
    title: "The Deliverable Review Rubric",
    author: "Council of Auditors",
    volume: "Volume IV",
    color: "#957fa8",
    content:
      "Claude reviews whether the text addresses the task, remains internally consistent, and states its limits. The server also validates the artifact's format and size. Chart specifications are text instructions rather than executed charts. A successful review permits payment settlement.",
  },
];

export function GuildBookshelfModal({ onClose }: GuildBookshelfModalProps) {
  const [selectedTome, setSelectedTome] = useState(TOMES[0]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="arcade-rpg-dialog" style={{ maxWidth: 740 }}>
        {/* Header */}
        <div className="rpg-dialog-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="rpg-badge" style={{ background: "var(--accent-purple)", color: "#140c08" }}>
              GUILD LIBRARY
            </span>
            <div>
              <h2 className="rpg-name">Ancient Bookshelf & Codex Archive</h2>
              <span className="rpg-subtext">Arcane documentation on autonomous agent protocols</span>
            </div>
          </div>

          <button onClick={onClose} className="arcade-close-btn" aria-label="Close Library">
            <X size={16} />
          </button>
        </div>

        {/* Library Split Layout: Book Spine Selector + Open Reading Pane */}
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, marginTop: 16, minHeight: 280 }}>
          {/* Bookshelf Spines List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, borderRight: "2px solid var(--border-inner)", paddingRight: 14 }}>
            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-gold)", letterSpacing: 0.5, textTransform: "uppercase" }}>
              ARCHIVED TOMES
            </span>

            {TOMES.map((tome) => {
              const isSelected = tome.id === selectedTome.id;
              return (
                <button
                  key={tome.id}
                  onClick={() => setSelectedTome(tome)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    background: isSelected ? "var(--bg-surface-elevated)" : "var(--bg-surface)",
                    border: "2px solid var(--border-outer)",
                    boxShadow: isSelected ? "inset 0 0 0 1px var(--accent-gold)" : "inset 0 0 0 1px var(--border-inner)",
                    borderRadius: "var(--radius-xs)",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.1s ease",
                  }}
                >
                  <div style={{ width: 4, height: 24, borderRadius: 2, background: tome.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", display: "block" }}>
                      {tome.volume}
                    </span>
                    <b style={{ fontSize: 11, color: isSelected ? "var(--accent-gold)" : "var(--text-main)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tome.title}
                    </b>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Open Tome Reading Page */}
          <div
            style={{
              background: "var(--bg-input)",
              border: "2px solid var(--border-outer)",
              borderRadius: "var(--radius-xs)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "inset 0 0 0 1px var(--border-inner), inset 0 2px 10px rgba(0,0,0,0.5)",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-inner)", paddingBottom: 10, marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent-gold)" }}>
                    {selectedTome.volume} · {selectedTome.author}
                  </span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
                    {selectedTome.title}
                  </h3>
                </div>
              </div>

              <p style={{ fontSize: 13, color: "var(--text-main)", lineHeight: 1.65, margin: 0 }}>
                {selectedTome.content}
              </p>
            </div>

            <div style={{ borderTop: "1px solid var(--border-inner)", paddingTop: 10, marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                Source: BountyMesh Protocol Architecture
              </span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent-green-bright)" }}>
                Workflow Guide
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} className="arcade-btn-primary">
            Close Library
          </button>
        </div>
      </div>
    </div>
  );
}
