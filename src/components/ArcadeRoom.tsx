"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { arcadeAudio } from "@/lib/arcadeAudio";
import { drawGuildEnvironment, drawBiddingConnections } from "./ArcadeEnvironment";
import {
  drawArcadeCharacter,
  drawCharacterDialogue,
  type ArcadeCharacter,
} from "./ArcadeSprites";
import { GuildNoticeBoardModal } from "./GuildNoticeBoardModal";
import { GuildVaultModal } from "./GuildVaultModal";
import { GuildBookshelfModal } from "./GuildBookshelfModal";
import type { Agent, Bounty, Snapshot } from "@/lib/contracts";

export type { ArcadeCharacter };

interface ArcadeRoomProps {
  snapshot: Snapshot;
  activeGoal?: string;
  rewardCents?: number;
  isExecuting?: boolean;
  onSelectCharacter?: (agent: Agent | null, customChar?: ArcadeCharacter) => void;
  onSelectBounty?: (bounty: Bounty) => void;
  onFillGoal?: (goal: string) => void;
  onSwitchTab?: (tab: "arcade" | "bounties" | "agents" | "ledger") => void;
}

interface InteractiveTarget {
  type: string;
  id?: string;
  name: string;
  hint: string;
  char?: ArcadeCharacter;
  box?: { x: number; y: number; w: number; h: number };
}

function getInteractiveTarget(
  mx: number,
  my: number,
  chars: ArcadeCharacter[]
): InteractiveTarget | null {
  // 1. Character hit test (centered around char.x, char.y - 18)
  for (const c of chars) {
    const dx = Math.abs(c.x - mx);
    const dy = Math.abs(c.y - 18 - my);
    if (dx < 26 && dy < 34) {
      return {
        type: "character",
        id: c.id,
        name: c.name,
        hint: "Click to inspect agent dossier",
        char: c,
        box: { x: c.x - 22, y: c.y - 44, w: 44, h: 54 },
      };
    }
  }

  // 2. Guild Notice Board (x: 176..310, y: 14..92)
  if (mx >= 176 && mx <= 310 && my >= 14 && my <= 92) {
    return {
      type: "notice-board",
      name: "Guild Notice Board",
      hint: "Click to browse quests & directives",
      box: { x: 176, y: 14, w: 134, h: 78 },
    };
  }

  // 3. Escrow Gold Vault (x: 772..934, y: 20..96)
  if (mx >= 772 && mx <= 934 && my >= 20 && my <= 96) {
    return {
      type: "vault",
      name: "Guild Escrow Vault",
      hint: "Click to inspect treasury & payouts",
      box: { x: 772, y: 20, w: 162, h: 76 },
    };
  }

  // 4. Ancient Bookshelf & Codex (x: 572..704, y: 10..96)
  if (mx >= 572 && mx <= 704 && my >= 10 && my <= 96) {
    return {
      type: "bookshelf",
      name: "Ancient Library Bookshelf",
      hint: "Click to read guild lore & codices",
      box: { x: 572, y: 10, w: 132, h: 86 },
    };
  }

  // 5. Hearth / Fireplace (x: 420..540, y: 12..104)
  if (mx >= 420 && mx <= 540 && my >= 12 && my <= 104) {
    return {
      type: "fireplace",
      name: "Guild Hearth Fire",
      hint: "Click to stoke the hearth fire",
      box: { x: 420, y: 12, w: 120, h: 92 },
    };
  }

  // 6. Tavern Bar & Potions (x: 6..112, y: 110..290)
  if (mx >= 6 && mx <= 112 && my >= 110 && my <= 290) {
    return {
      type: "tavern-bar",
      name: "Tavern Bar & Alchemy Potions",
      hint: "Click to inspect potions & brews",
      box: { x: 6, y: 110, w: 106, h: 180 },
    };
  }

  // 7. Research Desks:
  // Gemini Desk (center: 820, 240, w: 72, h: 48)
  if (mx >= 780 && mx <= 860 && my >= 212 && my <= 268) {
    return {
      type: "desk-gemini",
      id: "22222222-2222-4222-8222-222222222222",
      name: "Scholar's Research Desk",
      hint: "Click to inspect Gemini Scholar",
      box: { x: 784, y: 216, w: 72, h: 48 },
    };
  }
  // Specialist Desk (center: 820, 370, w: 72, h: 48)
  if (mx >= 780 && mx <= 860 && my >= 342 && my <= 398) {
    return {
      type: "desk-specialist",
      id: "33333333-3333-4333-8333-333333333333",
      name: "Ranger's Workstation",
      hint: "Click to inspect Specialist Ranger",
      box: { x: 784, y: 346, w: 72, h: 48 },
    };
  }
  // Sentinel Desk (center: 170, 370, w: 72, h: 48)
  if (mx >= 130 && mx <= 210 && my >= 342 && my <= 398) {
    return {
      type: "desk-sentinel",
      id: "sentinel-worker",
      name: "Sentinel's Watch Desk",
      hint: "Click to inspect Code Sentinel",
      box: { x: 134, y: 346, w: 72, h: 48 },
    };
  }

  // 8. Strategy Table (Center Stage: Math.hypot((mx - 480)/110, (my - 255)/42) <= 1)
  if (Math.hypot((mx - 480) / 110, (my - 255) / 42) <= 1) {
    return {
      type: "strategy-table",
      name: "Guild Strategy Table",
      hint: "Click to activate quest bidding simulation",
      box: { x: 370, y: 213, w: 220, h: 84 },
    };
  }

  // 9. Guild Entrance Doors (x: 94..174, y: 42..102)
  if (mx >= 94 && mx <= 174 && my >= 42 && my <= 102) {
    return {
      type: "doors",
      name: "Guild Entrance Doors",
      hint: "Click to welcome traveler",
      box: { x: 96, y: 44, w: 76, h: 56 },
    };
  }

  return null;
}

function drawHoverCornerBrackets(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  ticks: number
): void {
  ctx.save();
  const pulse = Math.sin(ticks * 0.12) * 0.2 + 0.8;
  ctx.strokeStyle = `rgba(212, 184, 106, ${pulse})`;
  ctx.lineWidth = 1.5;

  const bX = box.x - 2;
  const bY = box.y - 2;
  const bW = box.w + 4;
  const bH = box.h + 4;
  const corner = Math.min(10, Math.floor(Math.min(bW, bH) / 3));

  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(bX, bY + corner);
  ctx.lineTo(bX, bY);
  ctx.lineTo(bX + corner, bY);
  ctx.stroke();

  // Top-right corner
  ctx.beginPath();
  ctx.moveTo(bX + bW - corner, bY);
  ctx.lineTo(bX + bW, bY);
  ctx.lineTo(bX + bW, bY + corner);
  ctx.stroke();

  // Bottom-left corner
  ctx.beginPath();
  ctx.moveTo(bX, bY + bH - corner);
  ctx.lineTo(bX, bY + bH);
  ctx.lineTo(bX + corner, bY + bH);
  ctx.stroke();

  // Bottom-right corner
  ctx.beginPath();
  ctx.moveTo(bX + bW - corner, bY + bH);
  ctx.lineTo(bX + bW, bY + bH);
  ctx.lineTo(bX + bW, bY + bH - corner);
  ctx.stroke();

  ctx.restore();
}

export function ArcadeRoom({
  snapshot,
  activeGoal = "",
  rewardCents = 50,
  isExecuting = false,
  onSelectCharacter,
  onSelectBounty,
  onFillGoal,
  onSwitchTab,
}: ArcadeRoomProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gameLog, setGameLog] = useState<string[]>([
    "The Guild Hall is open. Fireplace crackles softly.",
    "Claude Orchestrator reviews the quest parchment.",
    "Ready: Click any character, notice board, or object to interact.",
  ]);
  const [stagePhase, setStagePhase] = useState<"idle" | "entering" | "announcing" | "bidding" | "matched" | "executing" | "verified" | "paid">("idle");
  const [activeSpeech, setActiveSpeech] = useState<{ charId: string; text: string; tag: string } | null>(null);

  // Interactive Hover & Modals State
  const [hoveredTarget, setHoveredTarget] = useState<InteractiveTarget | null>(null);
  const hoveredTargetRef = useRef<InteractiveTarget | null>(null);
  hoveredTargetRef.current = hoveredTarget;

  const [showNoticeBoardModal, setShowNoticeBoardModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [showBookshelfModal, setShowBookshelfModal] = useState(false);

  // Characters in Game State
  const charactersRef = useRef<ArcadeCharacter[]>([
    {
      id: "questor-player",
      name: "Traveler",
      role: "questor",
      model: "Client Model",
      color: "#d4b86a",
      x: 130,
      y: 130,
      targetX: 130,
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
      y: 175,
      targetX: 480,
      targetY: 175,
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
      y: 240,
      targetX: 740,
      targetY: 240,
      facing: "right",
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
      y: 370,
      targetX: 740,
      targetY: 370,
      facing: "right",
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
      x: 250,
      y: 370,
      targetX: 250,
      targetY: 370,
      facing: "left",
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
      questor.x = 130;
      questor.y = 110;
      questor.targetX = 340;
      questor.targetY = 255;
      questor.state = "walking";
      questor.facing = "right";

      // 2. Announce Task at Center Stage
      setTimeout(() => {
        setStagePhase("announcing");
        questor.state = "idle";
        questor.facing = "right";
        questor.dialogue = `QUEST: ${goalText.slice(0, 26)}... [${rewardFormatted}]`;
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

          gemini.targetX = 620;
          gemini.targetY = 245;
          gemini.state = "walking";
          gemini.facing = "left";

          specialist.targetX = 480;
          specialist.targetY = 330;
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
              specialist.targetY = 370;
              specialist.state = "walking";
              specialist.facing = "right";
              addLog(`Subcontract awarded to Gemini!`);

              // 5. Winner executes at workstation
              setTimeout(() => {
                setStagePhase("executing");
                gemini.targetX = 740;
                gemini.targetY = 240;
                gemini.state = "working";
                gemini.facing = "right";
                gemini.dialogue = "Writing research brief...";
                gemini.dialogueColor = "#6d8e9c";
                addLog(`Gemini executing deliverable at research desk...`);

                // 6. Deliverable submitted for Rubric Audit
                setTimeout(() => {
                  setStagePhase("verified");
                  gemini.targetX = 480;
                  gemini.targetY = 250;
                  gemini.state = "walking";
                  gemini.facing = "up";
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
                      questor.targetX = 130;
                      questor.targetY = 130;
                      questor.state = "walking";
                      questor.facing = "down";

                      claude.dialogue = "Awaiting quests...";
                      gemini.dialogue = null;
                      gemini.targetX = 740;
                      gemini.targetY = 240;
                      gemini.state = "idle";
                      gemini.facing = "right";

                      specialist.state = "idle";
                      specialist.facing = "right";
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

  // Track hover on interactive objects
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 960 / rect.width;
    const scaleY = 480 / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const target = getInteractiveTarget(mx, my, charactersRef.current);
    setHoveredTarget(target);
  };

  const handleCanvasMouseLeave = () => {
    setHoveredTarget(null);
  };

  // Interactive Click on Canvas Objects
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 960 / rect.width;
    const scaleY = 480 / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const target = getInteractiveTarget(clickX, clickY, charactersRef.current);

    if (target) {
      if (target.type === "character" && target.char) {
        arcadeAudio.playClick();
        const realAgent = snapshot.agents.find((a) => a.id === target.char?.id) || null;
        onSelectCharacter?.(realAgent, target.char);
        addLog(`Opened character dossier: ${target.char.name}.`);
        return;
      }

      if (target.type === "notice-board") {
        arcadeAudio.playPaper();
        setShowNoticeBoardModal(true);
        addLog("Inspecting Guild Notice Board.");
        return;
      }

      if (target.type === "vault") {
        arcadeAudio.playChest();
        setShowVaultModal(true);
        addLog("Auditing the Guild Escrow Vault.");
        return;
      }

      if (target.type === "bookshelf") {
        arcadeAudio.playBook();
        setShowBookshelfModal(true);
        addLog("Reading ancient codices in the guild library.");
        return;
      }

      if (target.type === "fireplace") {
        arcadeAudio.playHearth();
        addLog("You stoke the hearth fire. Warm glowing embers crackle.");
        setActiveSpeech({ charId: "hearth", text: "The hearth fire crackles with comforting warmth.", tag: "GUILD HEARTH" });
        return;
      }

      if (target.type === "tavern-bar") {
        arcadeAudio.playPotion();
        addLog("You inspect the alchemical potion vials and fresh cider kegs.");
        setActiveSpeech({ charId: "tavern", text: "Health draughts, mana vials, and fresh oak-cask cider.", tag: "TAVERN BAR" });
        return;
      }

      if (target.type === "strategy-table") {
        arcadeAudio.playClick();
        if (stagePhase === "idle") {
          runArcadeSequence();
        }
        addLog("Activated the strategy table for quest dispatch simulation.");
        return;
      }

      if (target.type.startsWith("desk-")) {
        arcadeAudio.playClick();
        const deskAgent = snapshot.agents.find((a) => a.id === target.id) || null;
        const deskChar = charactersRef.current.find((c) => c.id === target.id);
        onSelectCharacter?.(deskAgent, deskChar);
        addLog(`Inspecting ${target.name}.`);
        return;
      }

      if (target.type === "doors") {
        arcadeAudio.playWarp();
        const questor = charactersRef.current.find((c) => c.role === "questor");
        if (questor && stagePhase === "idle") {
          questor.targetX = 130;
          questor.targetY = 110;
          questor.state = "walking";
          questor.facing = "up";
          addLog("Traveler walked to the guild entrance.");
        }
        return;
      }
    }

    // Move Questor to clicked location on floor
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

      const totalPayoutStr = (
        snapshot.ledger
          .filter((e) => e.kind === "payout")
          .reduce((s, e) => s + e.amountCents, 0) / 100
      ).toFixed(2);

      // 1. Authentic 16-bit RPG Cozy Guild Hall Environment
      drawGuildEnvironment(ctx, width, height, ticks, stagePhase, totalPayoutStr);

      // 2. Dynamic Bidding Connections
      const geminiChar = charactersRef.current.find((c) => c.id.includes("2222"));
      const specialistChar = charactersRef.current.find((c) => c.id.includes("3333"));
      drawBiddingConnections(
        ctx,
        stagePhase,
        { x: geminiChar ? geminiChar.x : 550, y: geminiChar ? geminiChar.y : 250 },
        { x: specialistChar ? specialistChar.x : 460, y: specialistChar ? specialistChar.y : 280 },
        { x: width / 2, y: 255 },
        ticks
      );

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

        // Draw authentic 16-bit Cozy RPG pixel character and floating UI
        drawArcadeCharacter(ctx, char, ticks);

        if (char.dialogue) {
          drawCharacterDialogue(ctx, char);
        }
      });

      // 4. Interactive Hover Highlight Brackets on Canvas
      const hovered = hoveredTargetRef.current;
      if (hovered && hovered.box) {
        drawHoverCornerBrackets(ctx, hovered.box, ticks);
      }

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
      <div
        className="arcade-stage-wrap"
        style={{ cursor: hoveredTarget ? "pointer" : "crosshair" }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
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
              [ESC / x]
            </button>
          </div>
        )}

        {/* Dynamic Contextual Hint Overlay at bottom of canvas */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 16,
            right: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "none",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          <span style={{ color: hoveredTarget ? "var(--accent-gold)" : "var(--text-dim)", fontWeight: 600 }}>
            {hoveredTarget
              ? `${hoveredTarget.name} · ${hoveredTarget.hint}`
              : "Click the Notice Board, Vault, Bookshelf, or characters to interact"}
          </span>
          <span style={{ color: "var(--text-dim)", fontSize: 10 }}>
            Point & Click
          </span>
        </div>
      </div>

      {/* Interactive Notice Board Modal */}
      {showNoticeBoardModal && (
        <GuildNoticeBoardModal
          bounties={snapshot.bounties}
          onClose={() => setShowNoticeBoardModal(false)}
          onSelectBounty={(b) => {
            setShowNoticeBoardModal(false);
            onSelectBounty?.(b);
          }}
          onLoadGoal={(text) => {
            setShowNoticeBoardModal(false);
            onFillGoal?.(text);
          }}
        />
      )}

      {/* Interactive Escrow Vault Modal */}
      {showVaultModal && (
        <GuildVaultModal
          ledger={snapshot.ledger}
          bounties={snapshot.bounties}
          providerName={snapshot.config.payments}
          onClose={() => setShowVaultModal(false)}
          onViewFullLedger={() => {
            setShowVaultModal(false);
            onSwitchTab?.("ledger");
          }}
        />
      )}

      {/* Interactive Library Bookshelf Modal */}
      {showBookshelfModal && (
        <GuildBookshelfModal onClose={() => setShowBookshelfModal(false)} />
      )}
    </div>
  );
}
