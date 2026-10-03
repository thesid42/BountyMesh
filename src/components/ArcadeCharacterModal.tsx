"use client";

import { X } from "lucide-react";
import type { Agent } from "@/lib/contracts";
import type { ArcadeCharacter } from "./ArcadeRoom";

interface ArcadeCharacterModalProps {
  agent: Agent | null;
  customChar?: ArcadeCharacter | null;
  onClose: () => void;
  onAssignTask?: () => void;
}

export function ArcadeCharacterModal({
  agent,
  customChar,
  onClose,
  onAssignTask,
}: ArcadeCharacterModalProps) {
  if (!agent && !customChar) return null;

  const name = customChar?.name || agent?.name || "Guild Agent";
  const role = customChar?.role || agent?.role || "worker";
  const model = customChar?.model || agent?.model || "Autonomous Model";
  const gold = customChar ? customChar.gold : agent ? agent.balanceCents : 0;
  const level = customChar?.level || (agent ? Math.max(1, agent.tasksCompleted * 5 + 10) : 1);
  const skills = customChar?.skills || agent?.skills || [];
  const color = customChar?.color || (role === "orchestrator" ? "var(--accent-purple)" : "var(--accent-blue)");
  const roleDisplay = role === "orchestrator" ? "Orchestrator" : "Specialist";

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="arcade-rpg-dialog">
        {/* Header */}
        <div className="rpg-dialog-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="rpg-badge" style={{ background: color, color: "#000000" }}>
              LV.{level}
            </span>
            <div>
              <h2 className="rpg-name">{name}</h2>
              <span className="rpg-subtext">{model} · {roleDisplay}</span>
            </div>
          </div>

          <button onClick={onClose} className="arcade-close-btn" aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {/* RPG Stat Grid */}
        <div className="rpg-stats-grid">
          <div className="rpg-stat-box">
            <span className="rpg-stat-label">Role</span>
            <b className="rpg-stat-val" style={{ color: role === "orchestrator" ? "var(--accent-purple)" : "var(--accent-blue)" }}>
              {roleDisplay}
            </b>
          </div>

          <div className="rpg-stat-box">
            <span className="rpg-stat-label">Vault Balance</span>
            <b className="rpg-stat-val" style={{ color: "var(--accent-gold)" }}>
              ${(gold / 100).toFixed(2)}
            </b>
          </div>

          <div className="rpg-stat-box">
            <span className="rpg-stat-label">Tasks Delivered</span>
            <b className="rpg-stat-val" style={{ color: "var(--accent-green-bright)" }}>
              {agent ? agent.tasksCompleted : 0}
            </b>
          </div>

          <div className="rpg-stat-box" style={{ gridColumn: "span 3" }}>
            <span className="rpg-stat-label">Capability Index</span>
            <b className="rpg-stat-val" style={{ color: "var(--accent-blue)", fontSize: 13, marginTop: 2 }}>
              pgvector 768-D Semantic Matching
            </b>
          </div>
        </div>

        {/* Specialties */}
        {skills.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <span className="rpg-section-title">Specialties</span>
            <div className="rpg-skills-wrap">
              {skills.map((skill, idx) => (
                <span key={idx} className="rpg-skill-chip">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Agent Dossier */}
        <div style={{ marginTop: 16 }}>
          <span className="rpg-section-title">Agent Dossier</span>
          <p className="rpg-lore-text">
            {role === "orchestrator"
              ? "Executive orchestrator of BountyMesh. Decomposes client specifications, generates 768-dimensional pgvector semantic embeddings to route sub-tasks, holds funds securely in escrow, and validates deliverable rubrics prior to settlement."
              : `Autonomous specialist registered in the Guild Hall. Runs on ${model}, claiming matched sub-bounties and producing structured research artifacts, quantitative specifications, or code components.`}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} className="arcade-btn-pill">
            Close
          </button>

          <button
            onClick={() => {
              onClose();
              onAssignTask?.();
            }}
            className="arcade-btn-primary"
          >
            Assign Task to Agent
          </button>
        </div>
      </div>
    </div>
  );
}
