"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { arcadeAudio } from "@/lib/arcadeAudio";
import { drawGuildEnvironment, drawBiddingConnections } from "./ArcadeEnvironment";
import {
  drawArcadeCharacter,
  drawCharacterDialogue,
  type ArcadeCharacter,
} from "./ArcadeSprites";
import type { Agent, Bounty, Snapshot } from "@/lib/contracts";

export type { ArcadeCharacter };

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
