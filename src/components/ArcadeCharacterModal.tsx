"use client";

import { X, Shield, Swords, Zap, Award, Coins, Terminal, ArrowRight } from "lucide-react";
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

  const name = customChar?.name || agent?.name || "Arcade Agent";
  const role = customChar?.role || agent?.role || "worker";
  const model = customChar?.model || agent?.model || "Autonomous Model";
  const gold = customChar ? customChar.gold : agent ? agent.balanceCents : 0;
  const level = customChar?.level || (agent ? Math.max(1, agent.tasksCompleted * 5 + 10) : 1);
  const skills = customChar?.skills || agent?.skills || [];
  const color = customChar?.color || (role === "orchestrator" ? "#a855f7" : "#06b6d4");

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="arcade-rpg-dialog">
        {/* Pixel Header Bar */}
        <div className="rpg-dialog-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="rpg-badge" style={{ background: color, color: "#000" }}>
              {role.toUpperCase()}
            </span>
            <div>
              <h2 className="rpg-name">{name}</h2>
              <span className="rpg-subtext">{model}</span>
            </div>
          </div>

          <button onClick={onClose} className="arcade-close-btn">
            <X size={16} />
          </button>
        </div>

        {/* RPG Stat Grid */}
        <div className="rpg-stats-grid">
          <div className="rpg-stat-box">
            <span className="rpg-stat-label">BALANCE EARNED</span>
            <b className="rpg-stat-val" style={{ color: "#fbbf24" }}>
              ${(gold / 100).toFixed(2)} USD
            </b>
          </div>

          <div className="rpg-stat-box">
            <span className="rpg-stat-label">TASKS COMPLETED</span>
            <b className="rpg-stat-val" style={{ color: "#34d399" }}>
              {agent ? agent.tasksCompleted : 0} DELIVERED
            </b>
          </div>

          <div className="rpg-stat-box">
            <span className="rpg-stat-label">MATCHING ENGINE</span>
            <b className="rpg-stat-val" style={{ color: "#38bdf8" }}>
              pgvector 768-D
            </b>
          </div>
        </div>

        {/* RPG Skill Inventory */}
        <div style={{ marginTop: 16 }}>
          <span className="rpg-section-title">VERIFIED SKILLS</span>
          <div className="rpg-skills-wrap">
            {skills.map((skill, idx) => (
              <span key={idx} className="rpg-skill-chip">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Character Lore / Background */}
        <div style={{ marginTop: 16 }}>
          <span className="rpg-section-title">AGENT ARCHITECTURE</span>
          <p className="rpg-lore-text">
            {role === "orchestrator"
              ? "The orchestrator of BountyMesh. Claude 3.5 Sonnet processes incoming task objectives, computes normalized semantic vector embeddings, executes cosine matching to select specialist workers, holds escrow securely, and validates deliverable rubrics before authorizing atomic payout."
              : `A specialist autonomous agent registered on the BountyMesh network. Runs on ${model}, ready to claim sub-bounties and deliver structured research artifacts, visualization specifications, or code components.`}
          </p>
        </div>

        {/* Action Button */}
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
            Assign Task to Agent <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
