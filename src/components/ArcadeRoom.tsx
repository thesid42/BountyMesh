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
  const [gameLog, setGameLog] = useState<string[]>([
    "The Guild Hall is open. Fireplace crackles softly.",
    "Claude Orchestrator reviews the quest parchment.",
    "Ready: Click any character to inspect or click floor to walk.",
  ]);
  const [stagePhase, setStagePhase] = useState<"idle" | "entering" | "announcing" | "bidding" | "matched" | "executing" | "verified" | "paid">("idle");
  const [activeSpeech, setActiveSpeech] = useState<{ charId: string; text: string; tag: string } | null>(null);

  // Characters in Game State
  const charactersRef = useRef<ArcadeCharacter[]>([
    {
      id: "questor-player",
      name: "Traveler",
      role: "questor",
      model: "Client Model",
      color: "#d4b86a",
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
      name: "Claude",
      role: "orchestrator",
      model: "claude-sonnet-5",
      color: "#8f79a6",
      x: 480,
      y: 190,
      targetX: 480,
      targetY: 190,
      facing: "down",
      state: "idle",
      dialogue: "Awaiting quests...",
      dialogueColor: "#8f79a6",
      avatarType: "claude",
      level: 99,
      gold: 900,
      skills: ["planning", "research", "quality review", "market analysis"],
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Gemini",
      role: "worker",
      model: "gemini-3.8-flash",
      color: "#6d8e9c",
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
      name: "Specialist",
      role: "worker",
      model: "gemini-3.8-flash",
      color: "#84a96e",
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
      name: "Sentinel",
      role: "worker",
      model: "claude-3-haiku",
      color: "#c96b6b",
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
        char.name = snapAgent.name.split(" ")[0];
        char.gold = snapAgent.balanceCents;
        char.skills = snapAgent.skills;
        char.level = Math.max(1, snapAgent.tasksCompleted * 5 + 10);
      }
    });
  }, [snapshot.agents]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    arcadeAudio.enabled = next;
    if (next) arcadeAudio.playClick();
  };

  const addLog = useCallback((msg: string) => {
    setGameLog((prev) => [msg, ...prev.slice(0, 9)]);
  }, []);

  // Run the full Bidding Sequence
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
      addLog(`Traveler arrived at the Guild.`);
      questor.x = 120;
      questor.y = 110;
      questor.targetX = 420;
      questor.targetY = 220;
      questor.state = "walking";
      questor.facing = "right";

      // 2. Announce Task at Center Stage
      setTimeout(() => {
        setStagePhase("announcing");
        questor.state = "idle";
        questor.facing = "down";
        questor.dialogue = `QUEST: ${goalText.slice(0, 28)}... [${rewardFormatted}]`;
        questor.dialogueColor = "#d4b86a";
        setActiveSpeech({ charId: questor.id, text: `Seeking specialist: "${goalText}". Offering ${rewardFormatted} gold in escrow.`, tag: "NEW QUEST" });
        arcadeAudio.playCoin();
        addLog(`New quest posted: ${rewardFormatted} gold secured in Vault.`);

        // 3. Claude Broadcasts & Workers Gather for Bidding
        setTimeout(() => {
          setStagePhase("bidding");
          claude.dialogue = "Matching capability vectors...";
          claude.dialogueColor = "#8f79a6";
          arcadeAudio.playBid();
          addLog(`Claude computing 768-D pgvector embeddings. Gathering bids.`);

          gemini.targetX = 550;
          gemini.targetY = 250;
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
            gemini.dialogue = "BID $0.50 (94% FIT) · Ready!";
            gemini.dialogueColor = "#6d8e9c";
            addLog(`Gemini bids with 94.2% cosine match.`);

            specialist.state = "bidding";
            specialist.bidSimilarity = 88;
            specialist.dialogue = "BID $0.50 (88% FIT) · Ready!";
            specialist.dialogueColor = "#84a96e";

            // 4. Claude selects Winner (Gemini)
            setTimeout(() => {
              setStagePhase("matched");
              arcadeAudio.playFanfare();
              claude.dialogue = "Matched: Gemini wins contract!";
              claude.dialogueColor = "#84a96e";
              gemini.state = "celebrating";
              specialist.dialogue = null;
              specialist.targetX = 740;
              specialist.targetY = 380;
              specialist.state = "walking";
              addLog(`Subcontract awarded to Gemini!`);

              // 5. Winner executes at workstation
              setTimeout(() => {
                setStagePhase("executing");
                gemini.targetX = 740;
                gemini.targetY = 250;
                gemini.state = "working";
                gemini.facing = "left";
                gemini.dialogue = "Writing research brief...";
                gemini.dialogueColor = "#6d8e9c";
                addLog(`Gemini executing deliverable at research desk...`);

                // 6. Deliverable submitted for Rubric Audit
                setTimeout(() => {
                  setStagePhase("verified");
                  gemini.targetX = 540;
                  gemini.targetY = 230;
                  gemini.state = "walking";
                  gemini.dialogue = "Deliverable ready!";
                  arcadeAudio.playClick();
                  addLog(`Deliverable submitted for quality review.`);

                  setTimeout(() => {
                    claude.dialogue = "Rubric check: Passed 100%!";
                    claude.dialogueColor = "#84a96e";

                    // 7. Coin shower / Payout from Vault
                    setStagePhase("paid");
                    arcadeAudio.playPayout();
                    gemini.state = "celebrating";
                    gemini.dialogue = `+${rewardFormatted} Escrow Settled!`;
                    gemini.dialogueColor = "#d4b86a";
                    gemini.gold += rewardVal;
                    questor.dialogue = "Deliverable accepted!";
                    addLog(`Escrow released: ${rewardFormatted} transferred to Gemini Wallet.`);

                    setTimeout(() => {
                      setStagePhase("idle");
                      questor.dialogue = null;
                      claude.dialogue = "Awaiting quests...";
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

  useEffect(() => {
    if (isExecuting && stagePhase === "idle") {
      runArcadeSequence();
    }
  }, [isExecuting, stagePhase, runArcadeSequence]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 960 / rect.width;
    const scaleY = 480 / rect.height;
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
      return;
    }

    // Move Questor to clicked location
    const questor = charactersRef.current.find((c) => c.role === "questor");
    if (questor && stagePhase === "idle") {
      arcadeAudio.playClick();
      questor.targetX = Math.max(80, Math.min(960 - 80, clickX));
      questor.targetY = Math.max(120, Math.min(480 - 80, clickY));
      questor.state = "walking";
      questor.facing = questor.targetX > questor.x ? "right" : "left";
    }
  };

  // 60FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animId: number;
    let ticks = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 960 * dpr;
    canvas.height = 480 * dpr;
    ctx.scale(dpr, dpr);

    const render = () => {
      ticks++;
      animId = requestAnimationFrame(render);

      const width = 960;
      const height = 480;

      ctx.clearRect(0, 0, width, height);

      // =======================================================================
      // 1. COZY GUILD HALL INTERIOR
      // =======================================================================
      // Wooden floorboards (Tavern style)
      ctx.fillStyle = "#2c211a";
      ctx.fillRect(0, 100, width, height - 100);

      // Floor plank lines
      ctx.lineWidth = 1.5;
      const plankH = 34;
      for (let y = 100; y < height; y += plankH) {
        ctx.strokeStyle = "#1b140f";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Staggered vertical plank joints
        const rowIdx = Math.floor((y - 100) / plankH);
        const offset = (rowIdx % 3) * 60;
        for (let x = offset; x < width; x += 140) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + plankH);
          ctx.stroke();
        }
      }

      // Warm rug in the center
      const rugX = width / 2 - 170;
      const rugY = 190;
      const rugW = 340;
      const rugH = 150;
      ctx.fillStyle = "#3e241e";
      ctx.beginPath();
      ctx.roundRect(rugX, rugY, rugW, rugH, 12);
      ctx.fill();
      ctx.strokeStyle = "#d4b86a";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Back Wall (Dark warm wood & stone)
      ctx.fillStyle = "#1e1612";
      ctx.fillRect(0, 0, width, 100);

      // Wooden crossbeams on wall
      ctx.strokeStyle = "#120d0b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 100);
      ctx.lineTo(width, 100);
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#382921";
      for (let x = 80; x < width; x += 160) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 100);
        ctx.stroke();
      }

      // Cozy Fireplace in center of back wall
      const fpX = width / 2 - 40;
      ctx.fillStyle = "#2e241e";
      ctx.fillRect(fpX, 28, 80, 72);
      ctx.strokeStyle = "#0a0705";
      ctx.lineWidth = 2;
      ctx.strokeRect(fpX, 28, 80, 72);

      // Fireplace hearth opening
      ctx.fillStyle = "#120a06";
      ctx.fillRect(fpX + 16, 52, 48, 48);

      // Animated gentle campfire flame
      const flameH = 14 + Math.sin(ticks * 0.15) * 4;
      ctx.fillStyle = "#e07a2a";
      ctx.beginPath();
      ctx.arc(fpX + 40, 84 - flameH / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f5c542";
      ctx.beginPath();
      ctx.arc(fpX + 40, 86 - flameH / 2, 6, 0, Math.PI * 2);
      ctx.fill();

      // Header Banner
      ctx.font = "600 13px 'DM Sans', sans-serif";
      ctx.fillStyle = "#d4b86a";
      ctx.fillText("BountyMesh Adventurer's Guild", 24, 42);

      ctx.font = "500 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#84a96e";
      ctx.fillText("Autonomous Agent Escrow Dispatch / 768-D Router", 24, 64);

      // =======================================================================
      // 2. STATIONS & ROOM FURNITURE
      // =======================================================================
      // A. Entrance Wooden Doors (Top Left)
      ctx.fillStyle = "#2c1f17";
      ctx.fillRect(96, 44, 76, 56);
      ctx.strokeStyle = "#0a0705";
      ctx.lineWidth = 2;
      ctx.strokeRect(96, 44, 76, 56);
      // Door handles
      ctx.fillStyle = "#d4b86a";
      ctx.fillRect(128, 70, 4, 8);
      ctx.fillRect(136, 70, 4, 8);

      ctx.fillStyle = "#d4b86a";
      ctx.font = "600 10px 'DM Sans', sans-serif";
      ctx.fillText("Entrance", 114, 36);

      // B. Escrow Gold Vault Chest (Top Right)
      ctx.fillStyle = "#3a281c";
      ctx.fillRect(width - 170, 40, 140, 60);
      ctx.strokeStyle = "#0a0705";
      ctx.lineWidth = 2;
      ctx.strokeRect(width - 170, 40, 140, 60);

      // Gold bands on chest
      ctx.fillStyle = "#d4b86a";
      ctx.fillRect(width - 150, 40, 6, 60);
      ctx.fillRect(width - 50, 40, 6, 60);

      ctx.fillStyle = "#d4b86a";
      ctx.font = "600 10px 'DM Sans', sans-serif";
      ctx.fillText("Escrow Vault", width - 136, 32);

      ctx.font = "600 12px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#84a96e";
      const totalPayoutStr = (snapshot.ledger.filter((e) => e.kind === "payout").reduce((s, e) => s + e.amountCents, 0) / 100).toFixed(2);
      ctx.fillText(`$${totalPayoutStr} Settled`, width - 134, 86);

      // C. Guildmaster Claude's Table
      const stageCenterX = width / 2;
      const stageCenterY = 220;

      // Wooden meeting table
      ctx.beginPath();
      ctx.ellipse(stageCenterX, stageCenterY + 40, 110, 42, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#3a281c";
      ctx.fill();
      ctx.strokeStyle = "#1b120c";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Parchment map spread on table
      ctx.fillStyle = "#e0d4be";
      ctx.fillRect(stageCenterX - 30, stageCenterY + 28, 60, 26);
      ctx.strokeStyle = "#8f7959";
      ctx.lineWidth = 1;
      ctx.strokeRect(stageCenterX - 30, stageCenterY + 28, 60, 26);

      // Floating crystal focus
      const floatY = Math.sin(ticks * 0.05) * 4;
      ctx.fillStyle = "#8f79a6";
      ctx.beginPath();
      ctx.arc(stageCenterX, stageCenterY - 14 + floatY, 8, 0, Math.PI * 2);
      ctx.fill();

      // D. Specialist Work Desks (Wooden tables with scrolls)
      const renderDesk = (x: number, y: number, label: string) => {
        ctx.fillStyle = "#332318";
        ctx.fillRect(x - 30, y - 22, 60, 44);
        ctx.strokeStyle = "#140c08";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 30, y - 22, 60, 44);

        // Parchment scroll
        ctx.fillStyle = "#ede2ce";
        ctx.fillRect(x - 16, y - 16, 24, 18);
        ctx.strokeStyle = "#9e8b70";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 16, y - 16, 24, 18);

        // Candle holder
        ctx.fillStyle = "#d4b86a";
        ctx.fillRect(x + 12, y - 14, 5, 8);
        // Flame
        ctx.fillStyle = "#f5c542";
        ctx.beginPath();
        ctx.arc(x + 14.5, y - 17, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "600 10px 'DM Sans', sans-serif";
        ctx.fillStyle = "#d4b86a";
        ctx.fillText(label, x - 26, y + 36);
      };

      renderDesk(740, 250, "Gemini Desk");
      renderDesk(740, 380, "Specialist Desk");
      renderDesk(230, 380, "Sentinel Desk");

      // E. Soft Bidding Connections during Sequence
      if (stagePhase === "bidding" || stagePhase === "matched") {
        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -ticks * 1.2;

        ctx.beginPath();
        ctx.moveTo(550, 250);
        ctx.lineTo(stageCenterX, stageCenterY + 20);
        ctx.strokeStyle = "#6d8e9c";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(460, 280);
        ctx.lineTo(stageCenterX, stageCenterY + 20);
        ctx.strokeStyle = "#84a96e";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
      }

      // =======================================================================
      // 3. CHARACTERS & ANIMATIONS
      // =======================================================================
      charactersRef.current.forEach((char) => {
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

        // Soft drop shadow
        ctx.beginPath();
        ctx.ellipse(char.x, char.y + 4, 15, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fill();

        // Step cycle bob
        const bob = char.state === "walking" ? Math.sin(ticks * 0.35) * 3 : Math.sin(ticks * 0.08) * 1.5;
        const charY = char.y + bob;

        ctx.save();
        ctx.translate(char.x, charY);

        ctx.fillStyle = char.color;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.5;

        if (char.avatarType === "questor") {
          // Traveler (Brown traveler cloak & gold tunic)
          ctx.fillStyle = "#5c4033";
          ctx.fillRect(-8, -26, 16, 18);
          ctx.fillStyle = "#f0d59e";
          ctx.fillRect(-6, -34, 12, 10);
          ctx.fillStyle = "#d4b86a";
          ctx.fillRect(char.facing === "right" ? -1 : -5, -31, 6, 3);
        } else if (char.avatarType === "claude") {
          // Guildmaster Claude (Purple robe & crown)
          ctx.fillStyle = "#6b5480";
          ctx.fillRect(-10, -28, 20, 20);
          ctx.fillStyle = "#8f79a6";
          ctx.fillRect(-7, -36, 14, 10);
          ctx.fillStyle = "#e8e1d7";
          ctx.fillRect(-4, -32, 8, 3);
          // Small crown
          ctx.fillStyle = "#d4b86a";
          ctx.fillRect(-6, -42 + Math.sin(ticks * 0.1) * 2, 12, 3);
        } else if (char.avatarType === "gemini") {
          // Scholar Gemini (Teal robe & scroll)
          ctx.fillStyle = "#527380";
          ctx.fillRect(-8, -26, 16, 18);
          ctx.fillStyle = "#6d8e9c";
          ctx.fillRect(-6, -34, 12, 10);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(char.facing === "right" ? 0 : -4, -31, 4, 3);
        } else {
          // Ranger Specialist (Hunter green)
          ctx.fillStyle = "#628251";
          ctx.fillRect(-8, -26, 16, 18);
          ctx.fillStyle = "#84a96e";
          ctx.fillRect(-6, -34, 12, 10);
          ctx.fillStyle = "#1c140f";
          ctx.fillRect(-4, -31, 8, 3);
        }

        // Celebrate indicator
        if (char.state === "celebrating") {
          ctx.fillStyle = "#d4b86a";
          ctx.font = "bold 13px sans-serif";
          ctx.fillText("+", -14, -42);
          ctx.fillText("+", 8, -42);
        }

        ctx.restore();

        // Character Name & Balance Tag
        ctx.font = "600 11px 'DM Sans', sans-serif";
        ctx.fillStyle = "#f0eae1";
        ctx.textAlign = "center";
        ctx.fillText(`${char.name}`, char.x, char.y - 42);

        ctx.font = "600 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = char.color;
        ctx.fillText(`$${(char.gold / 100).toFixed(2)}`, char.x, char.y - 28);

        // Cozy Speech Bubble
        if (char.dialogue) {
          const bubbleText = char.dialogue;
          ctx.font = "500 12px 'DM Sans', sans-serif";
          const textMetrics = ctx.measureText(bubbleText);
          const bubbleW = Math.max(90, textMetrics.width + 24);
          const bubbleH = 26;
          const bubbleX = char.x - bubbleW / 2;
          const bubbleY = char.y - 78;

          // Warm box
          ctx.fillStyle = "#251d19";
          ctx.beginPath();
          ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 4);
          ctx.fill();

          ctx.strokeStyle = char.dialogueColor || "#d4b86a";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Pointer tail
          ctx.beginPath();
          ctx.moveTo(char.x - 4, bubbleY + bubbleH);
          ctx.lineTo(char.x, bubbleY + bubbleH + 5);
          ctx.lineTo(char.x + 4, bubbleY + bubbleH);
          ctx.fillStyle = char.dialogueColor || "#d4b86a";
          ctx.fill();

          // Text
          ctx.fillStyle = "#f0eae1";
          ctx.fillText(bubbleText, char.x, bubbleY + 17);
        }
      });

      ctx.textAlign = "left";
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [snapshot, stagePhase, speed]);

  return (
    <div className="arcade-cabinet-container">
      {/* Header Marquee Bar */}
      <div className="arcade-marquee-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 className="arcade-marquee-title">
            The Adventurer&apos;s Guild Hall
          </h2>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setSpeed((prev) => (prev === 1 ? 2 : 1))}
            className={`arcade-btn-pill ${speed === 2 ? "active" : ""}`}
            title="Toggle simulation speed"
          >
            {speed}x Speed
          </button>

          <button
            onClick={toggleSound}
            className={`arcade-btn-pill ${soundEnabled ? "active" : ""}`}
            title="Toggle audio effects"
          >
            {soundEnabled ? "Sound: On" : "Sound: Muted"}
          </button>

          <button
            onClick={() => runArcadeSequence()}
            className="arcade-btn-primary"
            disabled={stagePhase !== "idle"}
          >
            Simulate Quest Dispatch
          </button>
        </div>
      </div>

      {/* Living Interactive Game Stage Canvas */}
      <div className="arcade-stage-wrap">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="arcade-canvas"
        />

        {/* Live Active Dialogue Bar */}
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

      {/* Event Stream Ticker */}
      <div className="arcade-console-log-ticker">
        <span className="log-title">EVENT STREAM:</span>
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
