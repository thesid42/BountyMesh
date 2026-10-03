"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { arcadeAudio } from "@/lib/arcadeAudio";
import type { Agent, Bounty, Snapshot } from "@/lib/contracts";

export interface ArcadeCharacter {
  id: string;
  name: string;
  role: "questor" | "orchestrator" | "worker";
  model: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: "left" | "right" | "down" | "up";
  state: "idle" | "walking" | "bidding" | "working" | "celebrating";
  dialogue: string | null;
  dialogueColor?: string;
  bidSimilarity?: number;
  avatarType: "questor" | "claude" | "gemini" | "specialist" | "sentinel";
  level: number;
  gold: number;
  skills: string[];
}

interface ArcadeRoomProps {
  snapshot: Snapshot;
  activeGoal?: string;
  rewardCents?: number;
  isExecuting?: boolean;
  onSelectCharacter?: (agent: Agent | null, customChar?: ArcadeCharacter) => void;
  onSelectBounty?: (bounty: Bounty) => void;
}

export function ArcadeRoom({
  snapshot,
  activeGoal = "",
  rewardCents = 50,
  isExecuting = false,
  onSelectCharacter,
  onSelectBounty,
}: ArcadeRoomProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanlines, setScanlines] = useState(false);
  const [gameLog, setGameLog] = useState<string[]>([
    "★ SYSTEM: Arcade Guild Hall initialized.",
    "★ CLAUDE: Standing by for autonomous micro-work.",
    "★ READY: Click characters or floor to interact.",
  ]);
  const [stagePhase, setStagePhase] = useState<"idle" | "entering" | "announcing" | "bidding" | "matched" | "executing" | "verified" | "paid">("idle");
  const [activeSpeech, setActiveSpeech] = useState<{ charId: string; text: string; tag: string } | null>(null);

  // Characters List in Game State
  const charactersRef = useRef<ArcadeCharacter[]>([
    {
      id: "questor-player",
      name: "The Questor",
      role: "questor",
      model: "Client Model",
      color: "#f59e0b",
      x: 140,
      y: 130,
      targetX: 140,
      targetY: 130,
      facing: "down",
      state: "idle",
      dialogue: null,
      avatarType: "questor",
      level: 12,
      gold: 500,
      skills: ["task architect", "escrow funder", "prompt design"],
    },
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Claude Orchestrator",
      role: "orchestrator",
      model: "claude-sonnet-5",
      color: "#a855f7",
      x: 480,
      y: 190,
      targetX: 480,
      targetY: 190,
      facing: "down",
      state: "idle",
      dialogue: "Awaiting Bounties...",
      dialogueColor: "#c084fc",
      avatarType: "claude",
      level: 99,
      gold: 900,
      skills: ["planning", "research", "quality review", "market analysis"],
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Gemini Researcher",
      role: "worker",
      model: "gemini-3.8-flash",
      color: "#06b6d4",
      x: 740,
      y: 250,
      targetX: 740,
      targetY: 250,
      facing: "left",
      state: "idle",
      dialogue: null,
      avatarType: "gemini",
      level: 45,
      gold: 150,
      skills: ["data visualization", "market research", "analysis", "report writing"],
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Specialist Researcher",
      role: "worker",
      model: "gemini-3.8-flash",
      color: "#10b981",
      x: 740,
      y: 380,
      targetX: 740,
      targetY: 380,
      facing: "left",
      state: "idle",
      dialogue: null,
      avatarType: "specialist",
      level: 52,
      gold: 250,
      skills: ["competitive research", "synthesis", "business strategy"],
    },
    {
      id: "sentinel-worker",
      name: "Code Sentinel",
      role: "worker",
      model: "claude-3-haiku",
      color: "#38bdf8",
      x: 230,
      y: 380,
      targetX: 230,
      targetY: 380,
      facing: "right",
      state: "idle",
      dialogue: null,
      avatarType: "sentinel",
      level: 38,
      gold: 100,
      skills: ["code audit", "rubric verification", "unit testing"],
    },
  ]);

  // Sync snapshot agent gold/stats with game state
  useEffect(() => {
    snapshot.agents.forEach((snapAgent) => {
      const char = charactersRef.current.find((c) => c.id === snapAgent.id);
      if (char) {
        char.name = snapAgent.name;
        char.gold = snapAgent.balanceCents;
        char.skills = snapAgent.skills;
        char.level = Math.max(1, snapAgent.tasksCompleted * 5 + 10);
      }
    });
  }, [snapshot.agents]);

  // Sound toggle sync
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    arcadeAudio.enabled = next;
    if (next) arcadeAudio.playClick();
  };

  const addLog = useCallback((msg: string) => {
    setGameLog((prev) => [msg, ...prev.slice(0, 9)]);
  }, []);

  // Run the full Arcade Bidding Showdown Animation Sequence
  const runArcadeSequence = useCallback(
    (customGoal?: string, customReward?: number) => {
      const goalText = customGoal || activeGoal || "Analyze the top opportunities for an AI agent marketplace and create a concise market brief.";
      const rewardVal = customReward || rewardCents || 50;
      const rewardFormatted = `$${(rewardVal / 100).toFixed(2)}`;

      const chars = charactersRef.current;
      const questor = chars.find((c) => c.role === "questor")!;
      const claude = chars.find((c) => c.id.includes("1111"))!;
      const gemini = chars.find((c) => c.id.includes("2222"))!;
      const specialist = chars.find((c) => c.id.includes("3333"))!;

      const speedFactor = speed === 2 ? 0.5 : 1;

      // 1. Enter Room & Warp Sound
      setStagePhase("entering");
      arcadeAudio.playWarp();
      addLog(`⚡ QUEST: Client enters the Arcade Guild Hall!`);
      questor.x = 120;
      questor.y = 110;
      questor.targetX = 420;
      questor.targetY = 220;
      questor.state = "walking";
      questor.facing = "right";

      // 2. Announce at Podium
      setTimeout(() => {
        setStagePhase("announcing");
        questor.state = "idle";
        questor.facing = "down";
        questor.dialogue = `NEW BOUNTY: ${goalText.slice(0, 36)}... [${rewardFormatted}]`;
        questor.dialogueColor = "#fbbf24";
        setActiveSpeech({ charId: questor.id, text: `I need this micro-task solved: "${goalText}". Offering ${rewardFormatted} in verified escrow!`, tag: "CLIENT BOUNTY" });
        arcadeAudio.playCoin();
        addLog(`📢 CLIENT: "Posting ${rewardFormatted} bounty: ${goalText.slice(0, 45)}..."`);

        // 3. Claude Broadcasts & Workers Gather for Bidding
        setTimeout(() => {
          setStagePhase("bidding");
          claude.dialogue = "pgvector 768-D EMBEDDINGS BROADCASTING...";
          claude.dialogueColor = "#c084fc";
          arcadeAudio.playBid();
          addLog(`🔮 CLAUDE: "Generating pgvector embeddings. Calling all registered specialist agents!"`);

          // Workers rush to bidding ring around the stage
          gemini.targetX = 540;
          gemini.targetY = 260;
          gemini.state = "walking";
          gemini.facing = "left";

          specialist.targetX = 460;
          specialist.targetY = 280;
          specialist.state = "walking";
          specialist.facing = "up";

          // Bidding dialogue
          setTimeout(() => {
            arcadeAudio.playBid();
            gemini.state = "bidding";
            gemini.bidSimilarity = 94;
            gemini.dialogue = "BID $0.50 (94.2% FIT) · Market Brief Ready!";
            gemini.dialogueColor = "#38bdf8";
            addLog(`🤖 GEMINI: "I bid on this quest! Cosine similarity: 0.942 (Market Research specialty)!"`);

            specialist.state = "bidding";
            specialist.bidSimilarity = 88;
            specialist.dialogue = "BID $0.50 (88% FIT) · Competitive Matrix Ready!";
            specialist.dialogueColor = "#34d399";

            // 4. Claude selects Winner (Gemini)
            setTimeout(() => {
              setStagePhase("matched");
              arcadeAudio.playFanfare();
              claude.dialogue = "🏆 MATCH: Gemini Researcher wins contract!";
              claude.dialogueColor = "#34d399";
              gemini.state = "celebrating";
              specialist.dialogue = null;
              specialist.targetX = 740;
              specialist.targetY = 380;
              specialist.state = "walking";
              addLog(`🎉 CLAUDE: "Winner selected via highest cosine ranking: Gemini Researcher!"`);

              // 5. Winner rushes to workstation to code/research
              setTimeout(() => {
                setStagePhase("executing");
                gemini.targetX = 740;
                gemini.targetY = 250;
                gemini.state = "working";
                gemini.facing = "left";
                gemini.dialogue = "⌨️ HACKING: Generating structured brief & spec...";
                gemini.dialogueColor = "#38bdf8";
                addLog(`⚙️ GEMINI: "Specialist claimed task lease. Executing deliverable artifact..."`);

                // 6. Deliverable presented to Claude for Rubric Audit
                setTimeout(() => {
                  setStagePhase("verified");
                  gemini.targetX = 540;
                  gemini.targetY = 230;
                  gemini.state = "walking";
                  gemini.dialogue = "📦 PROOF SUBMITTED: Structured Brief Ready!";
                  arcadeAudio.playClick();
                  addLog(`📝 PROOF: Deliverable submitted to Claude for automated rubric audit.`);

                  setTimeout(() => {
                    claude.dialogue = "✅ RUBRIC PASS: Evidence verified! 100% Score.";
                    claude.dialogueColor = "#10b981";

                    // 7. Coin shower / Payout from Vault!
                    setStagePhase("paid");
                    arcadeAudio.playPayout();
                    gemini.state = "celebrating";
                    gemini.dialogue = `💰 +${rewardFormatted} ESCROW TRANSFERRED!`;
                    gemini.dialogueColor = "#34d399";
                    gemini.gold += rewardVal;
                    questor.dialogue = "DELIVERABLE ACCEPTED! GG!";
                    addLog(`🏆 SETTLEMENT: Atomic escrow released! ${rewardFormatted} transferred to Gemini Wallet!`);

                    setTimeout(() => {
                      setStagePhase("idle");
                      questor.dialogue = null;
                      claude.dialogue = "Awaiting next quest...";
                      gemini.dialogue = null;
                      gemini.state = "idle";
                      specialist.state = "idle";
                    }, 4000 * speedFactor);
                  }, 1800 * speedFactor);
                }, 2400 * speedFactor);
              }, 2000 * speedFactor);
            }, 2200 * speedFactor);
          }, 1200 * speedFactor);
        }, 1800 * speedFactor);
      }, 1500 * speedFactor);
    },
    [activeGoal, rewardCents, speed, addLog]
  );

  // Automatically trigger when parent page starts submitting a task
  useEffect(() => {
    if (isExecuting && stagePhase === "idle") {
      runArcadeSequence();
    }
  }, [isExecuting, stagePhase, runArcadeSequence]);

  // Click on floor to move Questor or click on an agent to inspect
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check if clicked on a character
    const clickedChar = charactersRef.current.find((c) => {
      const dx = Math.abs(c.x - clickX);
      const dy = Math.abs(c.y - 20 - clickY);
      return dx < 36 && dy < 44;
    });

    if (clickedChar) {
      arcadeAudio.playClick();
      const realAgent = snapshot.agents.find((a) => a.id === clickedChar.id) || null;
      onSelectCharacter?.(realAgent, clickedChar);
      addLog(`🔍 INSPECT: Selected ${clickedChar.name} [Lv.${clickedChar.level}]`);
      return;
    }

    // Move Questor to clicked location
    const questor = charactersRef.current.find((c) => c.role === "questor");
    if (questor && stagePhase === "idle") {
      arcadeAudio.playClick();
      questor.targetX = Math.max(80, Math.min(canvas.width - 80, clickX));
      questor.targetY = Math.max(120, Math.min(canvas.height - 80, clickY));
      questor.state = "walking";
      questor.facing = questor.targetX > questor.x ? "right" : "left";
      addLog(`👟 QUESTOR: Walking to (${Math.round(clickX)}, ${Math.round(clickY)})`);
    }
  };

  // 60FPS Game Loop Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let ticks = 0;

    const render = () => {
      ticks++;
      animId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // 1. DRAW RETRO CYBER-ARCADE GUILD HALL ROOM
      // Floor Background with Synthwave Isometric Grid
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#080b14");
      grad.addColorStop(1, "#030407");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Floor Grid Tiles (Neon Cyber Floor)
      ctx.strokeStyle = "rgba(16, 185, 129, 0.08)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 100);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 100; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Back Wall Border & Neon Trim
      ctx.fillStyle = "#0c101d";
      ctx.fillRect(0, 0, width, 100);

      ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 100);
      ctx.lineTo(width, 100);
      ctx.stroke();

      // Ambient Top Wall
      ctx.font = "600 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.fillText("BountyMesh Autonomous Chamber", 24, 38);

      // 2. ROOM STATIONS & FURNITURE
      // A. Entrance Portal (Top Left)
      ctx.fillStyle = "rgba(6, 182, 212, 0.12)";
      ctx.fillRect(100, 70, 70, 50);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(100, 70, 70, 50);

      // B. Escrow Gold Vault (Top Right)
      ctx.fillStyle = "rgba(245, 158, 11, 0.12)";
      ctx.fillRect(width - 170, 40, 140, 70);
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.strokeRect(width - 170, 40, 140, 70);
      // Vault Door Wheel
      ctx.beginPath();
      ctx.arc(width - 100, 75, 18, 0, Math.PI * 2);
      ctx.strokeStyle = "#fbbf24";
      ctx.stroke();
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.fillText("ESCROW VAULT", width - 146, 32);
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`$${(snapshot.ledger.filter((e) => e.kind === "payout").reduce((s, e) => s + e.amountCents, 0) / 100).toFixed(2)} PAID`, width - 138, 98);

      // C. Central Holographic Bidding Stage & Arcade Cabinet
      const stageCenterX = width / 2;
      const stageCenterY = 220;
      // Holographic Ring on Floor
      ctx.beginPath();
      ctx.ellipse(stageCenterX, stageCenterY + 40, 120, 45, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(139, 92, 246, 0.12)";
      ctx.fill();
      ctx.strokeStyle = stagePhase === "bidding" ? "#c084fc" : "rgba(139, 92, 246, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rotating Hologram Ring Pulse
      const ringPulse = Math.sin(ticks * 0.05) * 6;
      ctx.beginPath();
      ctx.ellipse(stageCenterX, stageCenterY + 40, 100 + ringPulse, 35 + ringPulse * 0.4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.stroke();

      // Holo Podium Pillar
      ctx.fillStyle = "#1e1b4b";
      ctx.fillRect(stageCenterX - 24, stageCenterY - 10, 48, 40);
      ctx.strokeStyle = "#8b5cf6";
      ctx.strokeRect(stageCenterX - 24, stageCenterY - 10, 48, 40);
      // Floating 3D Polyhedron / Quest Terminal on podium
      const floatY = Math.sin(ticks * 0.06) * 4;
      ctx.fillStyle = "#a855f7";
      ctx.beginPath();
      ctx.arc(stageCenterX, stageCenterY - 20 + floatY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // D. Worker Stations (Desks with monitors on Right)
      const renderDesk = (x: number, y: number, label: string, color: string, active: boolean) => {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(x - 28, y - 18, 56, 36);
        ctx.strokeStyle = active ? color : "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 28, y - 18, 56, 36);

        // Pixel Monitor
        ctx.fillStyle = active ? color : "#1e293b";
        ctx.fillRect(x - 14, y - 14, 28, 16);
        ctx.strokeStyle = "#475569";
        ctx.strokeRect(x - 14, y - 14, 28, 16);

        ctx.font = "8px 'JetBrains Mono', monospace";
        ctx.fillStyle = color;
        ctx.fillText(label, x - 22, y + 30);
      };

      renderDesk(740, 250, "GEMINI TERMINAL", "#38bdf8", stagePhase === "executing");
      renderDesk(740, 380, "SPECIALIST DESK", "#34d399", false);
      renderDesk(230, 380, "SENTINEL CONSOLE", "#a855f7", false);

      // 3. UPDATE & RENDER CHARACTERS
      charactersRef.current.forEach((char) => {
        // Pathfinding / Lerp movement
        const moveSpeed = (char.state === "walking" ? 3.2 : 0) * (speed === 2 ? 1.6 : 1);
        const dx = char.targetX - char.x;
        const dy = char.targetY - char.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 4 && char.state === "walking") {
          char.x += (dx / dist) * Math.min(moveSpeed, dist);
          char.y += (dy / dist) * Math.min(moveSpeed, dist);
          char.facing = dx > 0 ? "right" : "left";
        } else if (dist <= 4 && char.state === "walking") {
          char.x = char.targetX;
          char.y = char.targetY;
          char.state = "idle";
        }

        // Draw Character Shadow
        ctx.beginPath();
        ctx.ellipse(char.x, char.y + 4, 14, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.fill();

        // Idle bobbing / walk leg cycle
        const bob = char.state === "walking" ? Math.sin(ticks * 0.35) * 3 : Math.sin(ticks * 0.08) * 1.5;
        const charY = char.y + bob;

        // Draw Arcade Character Body (Pixel Art Aesthetic)
        ctx.save();
        ctx.translate(char.x, charY);

        // Body outline
        ctx.fillStyle = char.color;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;

        // Custom avatar sprites per character
        if (char.avatarType === "questor") {
          // Questor (Cyber Detective / Trenchcoat with Gold Visor)
          ctx.fillStyle = "#d97706";
          ctx.fillRect(-8, -26, 16, 18); // Coat
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(-6, -34, 12, 10); // Head
          ctx.fillStyle = "#10b981";
          ctx.fillRect(char.facing === "right" ? -1 : -5, -31, 6, 3); // Neon Visor
        } else if (char.avatarType === "claude") {
          // Claude (Wizard Robot with Floating Crown)
          ctx.fillStyle = "#7e22ce";
          ctx.fillRect(-10, -28, 20, 20); // Robe
          ctx.fillStyle = "#c084fc";
          ctx.fillRect(-7, -36, 14, 10); // Head
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(-4, -32, 8, 3); // Cyan eyes
          // Floating crown
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(-6, -42 + Math.sin(ticks * 0.1) * 2, 12, 3);
        } else if (char.avatarType === "gemini") {
          // Gemini (Cyborg with Jetpack)
          ctx.fillStyle = "#0284c7";
          ctx.fillRect(-8, -26, 16, 18);
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(-6, -34, 12, 10);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(char.facing === "right" ? 0 : -4, -31, 4, 3);
          // Jetpack thrusters
          if (char.state === "walking" || char.state === "celebrating") {
            ctx.fillStyle = "#f59e0b";
            ctx.fillRect(char.facing === "right" ? -12 : 8, -20, 4, 6 + Math.random() * 4);
          }
        } else {
          // Specialist Worker
          ctx.fillStyle = "#059669";
          ctx.fillRect(-8, -26, 16, 18);
          ctx.fillStyle = "#34d399";
          ctx.fillRect(-6, -34, 12, 10);
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(-4, -31, 8, 3);
        }

        // Celebrate Victory Jump!
        if (char.state === "celebrating") {
          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 12px sans-serif";
          ctx.fillText("✨", -14, -42);
          ctx.fillText("✨", 8, -42);
        }

        ctx.restore();

        // Character Name & Level Tag
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(`${char.name}`, char.x, char.y - 42);

        ctx.font = "8px 'JetBrains Mono', monospace";
        ctx.fillStyle = char.color;
        ctx.fillText(`Lv.${char.level} · $${(char.gold / 100).toFixed(2)}`, char.x, char.y - 32);

        // Floating Speech Bubble / Dialogue Balloon
        if (char.dialogue) {
          const bubbleText = char.dialogue;
          ctx.font = "bold 9px 'JetBrains Mono', monospace";
          const textMetrics = ctx.measureText(bubbleText);
          const bubbleW = Math.max(80, textMetrics.width + 16);
          const bubbleH = 22;
          const bubbleX = char.x - bubbleW / 2;
          const bubbleY = char.y - 68;

          // Bubble background & border
          ctx.fillStyle = "rgba(9, 12, 20, 0.92)";
          ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
          ctx.strokeStyle = char.dialogueColor || "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bubbleX, bubbleY, bubbleW, bubbleH);

          // Pointer tail
          ctx.beginPath();
          ctx.moveTo(char.x - 4, bubbleY + bubbleH);
          ctx.lineTo(char.x, bubbleY + bubbleH + 5);
          ctx.lineTo(char.x + 4, bubbleY + bubbleH);
          ctx.fillStyle = char.dialogueColor || "#ffffff";
          ctx.fill();

          // Bubble text
          ctx.fillStyle = char.dialogueColor || "#ffffff";
          ctx.fillText(bubbleText, char.x, bubbleY + 14);
        }
      });

      ctx.textAlign = "left"; // reset
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [snapshot, stagePhase, speed]);

  return (
    <div className="arcade-cabinet-container">
      {/* Arcade Header Marquee */}
      <div className="arcade-marquee-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 className="arcade-marquee-title">Agent Bidding Room</h2>
        </div>

        {/* Arcade Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setSpeed((prev) => (prev === 1 ? 2 : 1))}
            className={`arcade-btn-pill ${speed === 2 ? "active" : ""}`}
            title="Toggle playback speed"
          >
            {speed}x Speed
          </button>

          <button
            onClick={toggleSound}
            className={`arcade-btn-pill ${soundEnabled ? "active" : ""}`}
            title="Toggle sound effects"
          >
            {soundEnabled ? "Sound: On" : "Sound: Off"}
          </button>

          <button
            onClick={() => runArcadeSequence()}
            className="arcade-btn-primary"
            disabled={stagePhase !== "idle"}
          >
            ▶ Simulate Bidding
          </button>
        </div>
      </div>

      {/* Living Interactive Game Stage Canvas */}
      <div className={`arcade-stage-wrap ${scanlines ? "crt-scanlines-active" : ""}`}>
        <canvas
          ref={canvasRef}
          width={960}
          height={480}
          onClick={handleCanvasClick}
          className="arcade-canvas"
        />

        {/* Live Active Dialogue Bar (when a character speaks) */}
        {activeSpeech && (
          <div className="arcade-dialogue-modal-bar">
            <span className="dialogue-tag">{activeSpeech.tag}:</span>
            <span className="dialogue-content">{activeSpeech.text}</span>
            <button
              onClick={() => setActiveSpeech(null)}
              className="dialogue-dismiss"
            >
              [ESC / ×]
            </button>
          </div>
        )}
      </div>

      {/* Terminal Game Log Ticker */}
      <div className="arcade-console-log-ticker">
        <span className="log-title">GAME EVENT STREAM:</span>
        <div className="log-scroller">
          {gameLog.slice(0, 3).map((item, idx) => (
            <span key={idx} className="log-entry">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
