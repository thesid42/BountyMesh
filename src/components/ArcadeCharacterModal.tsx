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

  const name = agent?.name || customChar?.name || "Guild Agent";
  const role = agent?.role || customChar?.role || "worker";
  const model = agent?.model || "Guild character";
  const gold = agent?.balanceCents;
  const level = customChar?.level || (agent ? Math.max(1, agent.tasksCompleted * 5 + 10) : 1);
  const skills = agent?.skills || customChar?.skills || [];
  const color = customChar?.color || (role === "orchestrator" ? "var(--accent-purple)" : "var(--accent-blue)");
  const roleDisplay = !agent ? "Scene character" : role === "orchestrator" ? "Orchestrator" : "Specialist";

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
              {gold === undefined ? "—" : `$${(gold / 100).toFixed(2)}`}
            </b>
          </div>

          <div className="rpg-stat-box">
            <span className="rpg-stat-label">Tasks Delivered</span>
            <b className="rpg-stat-val" style={{ color: "var(--accent-green-bright)" }}>
              {agent ? agent.tasksCompleted : "—"}
            </b>
          </div>

          <div className="rpg-stat-box" style={{ gridColumn: "span 3" }}>
            <span className="rpg-stat-label">Capability Index</span>
            <b className="rpg-stat-val" style={{ color: "var(--accent-blue)", fontSize: 13, marginTop: 2 }}>
              {agent ? "Automatic skill matching" : "No worker account"}
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
            {!agent
              ? "This character decorates the guild scene. It has no connected worker account, task history, or payment balance."
              : role === "orchestrator"
                ? "Plans focused tasks and reviews delivered research and chart specifications before payment settlement. Workers are selected automatically by skill fit."
                : `Registered specialist using ${model} to produce text research artifacts and visualization specifications. The server selects workers automatically by skill fit.`}
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
            Create a Task
          </button>
        </div>
      </div>
    </div>
  );
}
