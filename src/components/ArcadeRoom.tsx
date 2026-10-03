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
import type { NegotiationTurn } from "@/app/api/negotiate/route";
import type { Agent, Bounty, Snapshot } from "@/lib/contracts";

export type { ArcadeCharacter };

interface ArcadeRoomProps {
  snapshot: Snapshot;
  activeGoal?: string;
  rewardCents?: number;
  isExecuting?: boolean;
  triggerSequenceKey?: number;
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
  triggerSequenceKey,
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
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const sequenceRunIdRef = useRef(0);

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

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    arcadeAudio.voiceEnabled = next;
    if (!next) {
      arcadeAudio.stopSpeech();
    } else {
      arcadeAudio.initCtx();
      arcadeAudio.playClick();
    }
  };

  useEffect(() => {
    return () => {
      arcadeAudio.stopSpeech();
    };
  }, []);

  const addLog = useCallback((msg: string) => {
    setGameLog((prev) => [msg, ...prev.slice(0, 9)]);
  }, []);

  // Run the full Live Model Negotiation & Bidding Sequence
  const runArcadeSequence = useCallback(
    async (customGoal?: string, customReward?: number) => {
      // Initialize and resume browser AudioContext on user action
      arcadeAudio.initCtx();

      const runId = ++sequenceRunIdRef.current;
      const goalText = customGoal || activeGoal || "Analyze the top opportunities for an AI agent marketplace and create a concise market brief.";
      const rewardVal = customReward || rewardCents || 50;
      const rewardFormatted = `$${(rewardVal / 100).toFixed(2)}`;

      const chars = charactersRef.current;
      const questor = chars.find((c) => c.role === "questor")!;
      const claude = chars.find((c) => c.id.includes("1111"))!;
      const gemini = chars.find((c) => c.id.includes("2222"))!;
      const specialist = chars.find((c) => c.id.includes("3333"))!;

      const speedFactor = speed === 2 ? 0.7 : 1;
      const sleep = (ms: number) =>
        new Promise<boolean>((resolve) => {
          setTimeout(() => {
            resolve(sequenceRunIdRef.current === runId);
          }, ms * speedFactor);
        });

      // Step 1: Traveler arrives at Guild immediately
      setStagePhase("entering");
      arcadeAudio.playWarp();
      addLog("Traveler entered the Guild Hall.");
      questor.x = 130;
      questor.y = 110;
      questor.targetX = 340;
      questor.targetY = 255;
      questor.state = "walking";
      questor.facing = "right";
      questor.dialogue = "Entering Guild Hall...";

      // Fetch live multi-agent dialogue & spoken audio generated by Google Gemini concurrently
      const fetchPromise = (async () => {
        try {
          const res = await fetch("/api/negotiate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ goal: goalText, rewardCents: rewardVal }),
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.turns) && data.turns.length >= 5) {
              return data.turns as NegotiationTurn[];
            }
          }
        } catch {
          // ignore
        }
        return null;
      })();

      if (!(await sleep(850))) return;

      questor.state = "idle";
      questor.facing = "right";
      questor.dialogue = "Preparing quest briefing...";

      const turns = await fetchPromise;
      if (sequenceRunIdRef.current !== runId) return;

      const turn1 = turns?.[0] || {
        id: "turn-1",
        speaker: "traveler" as const,
        speakerName: "Traveler",
        voice: "Kore" as const,
        text: `Traveler seeking guild assistance for this quest: "${goalText}". I am locking ${rewardFormatted} in verified escrow.`,
        dialogueBadge: `QUEST: ${goalText.slice(0, 24)}... [${rewardFormatted}]`,
        color: "#d4b86a",
      };
      const turn2 = turns?.[1] || {
        id: "turn-2",
        speaker: "claude" as const,
        speakerName: "Claude Orchestrator",
        voice: "Charon" as const,
        text: `Quest directive logged. Generating 768-dimensional capability embeddings and requesting specialist bids.`,
        dialogueBadge: "Matching capability vectors...",
        color: "#8f79a6",
      };
      const turn3 = turns?.[2] || {
        id: "turn-3",
        speaker: "gemini" as const,
        speakerName: "Gemini Scholar",
        voice: "Puck" as const,
        text: `Gemini Scholar bidding. Capability fit 94.2% on market synthesis and visualization planning.`,
        dialogueBadge: "BID: 94.2% Fit · Ready to execute",
        color: "#6d8e9c",
      };
      const turn4 = turns?.[3] || {
        id: "turn-4",
        speaker: "specialist" as const,
        speakerName: "Specialist Ranger",
        voice: "Fenrir" as const,
        text: `Specialist Ranger bidding. Prepared for competitive rubric verification with 88.5% vector similarity.`,
        dialogueBadge: "BID: 88.5% Fit · Standby",
        color: "#84a96e",
      };
      const turn5 = turns?.[4] || {
        id: "turn-5",
        speaker: "claude" as const,
        speakerName: "Claude Orchestrator",
        voice: "Charon" as const,
        text: `Evaluation complete. Gemini Scholar demonstrates optimal semantic alignment at 94.2%. Contract awarded at ${rewardFormatted}. Escrow secured.`,
        dialogueBadge: `Awarded to Gemini for ${rewardFormatted}`,
        color: "#84a96e",
      };

      // Step 2: Traveler speaks & posts quest (Turn 1 with voice audio)
      setStagePhase("announcing");
      questor.state = "idle";
      questor.facing = "right";
      questor.dialogue = turn1.dialogueBadge;
      questor.dialogueColor = turn1.color || "#d4b86a";
      setActiveSpeech({ charId: questor.id, text: turn1.text, tag: "TRAVELER" });
      arcadeAudio.playTalkChirp(turn1.speaker);
      arcadeAudio.playCoin();
      addLog(`Traveler: "${turn1.text}"`);
      await arcadeAudio.playNegotiationTurn(turn1);
      if (sequenceRunIdRef.current !== runId) return;

      if (!(await sleep(400))) return;

      // Step 3: Claude Orchestrator addresses the room and requests specialist bids (Turn 2 with voice audio)
      setStagePhase("bidding");
      claude.dialogue = turn2.dialogueBadge;
      claude.dialogueColor = turn2.color || "#8f79a6";
      claude.facing = "down";
      arcadeAudio.playTalkChirp(turn2.speaker);
      arcadeAudio.playBid();
      setActiveSpeech({ charId: claude.id, text: turn2.text, tag: "CLAUDE ORCHESTRATOR" });
      addLog(`Claude: "${turn2.text}"`);

      // Workers gather at center strategy table to respond
      gemini.targetX = 620;
      gemini.targetY = 245;
      gemini.state = "walking";
      gemini.facing = "left";

      specialist.targetX = 480;
      specialist.targetY = 330;
      specialist.state = "walking";
      specialist.facing = "up";

      await arcadeAudio.playNegotiationTurn(turn2);
      if (sequenceRunIdRef.current !== runId) return;

      if (!(await sleep(500))) return;

      // Step 4: Gemini Scholar steps up and bids (Turn 3 with voice audio)
      gemini.state = "bidding";
      gemini.facing = "left";
      gemini.dialogue = turn3.dialogueBadge;
      gemini.dialogueColor = turn3.color || "#6d8e9c";
      arcadeAudio.playTalkChirp(turn3.speaker);
      arcadeAudio.playBid();
      setActiveSpeech({ charId: gemini.id, text: turn3.text, tag: "GEMINI SCHOLAR" });
      addLog(`Gemini: "${turn3.text}"`);
      await arcadeAudio.playNegotiationTurn(turn3);
      if (sequenceRunIdRef.current !== runId) return;

      if (!(await sleep(400))) return;

      // Step 5: Specialist Ranger bids / acknowledges (Turn 4 with voice audio)
      specialist.state = "bidding";
      specialist.facing = "up";
      specialist.dialogue = turn4.dialogueBadge;
      specialist.dialogueColor = turn4.color || "#84a96e";
      arcadeAudio.playTalkChirp(turn4.speaker);
      setActiveSpeech({ charId: specialist.id, text: turn4.text, tag: "SPECIALIST RANGER" });
      addLog(`Specialist: "${turn4.text}"`);
      await arcadeAudio.playNegotiationTurn(turn4);
      if (sequenceRunIdRef.current !== runId) return;

      if (!(await sleep(400))) return;

      // Step 6: Claude awards contract to Gemini (Turn 5 with voice audio)
      setStagePhase("matched");
      claude.dialogue = turn5.dialogueBadge;
      claude.dialogueColor = turn5.color || "#84a96e";
      claude.facing = "down";
      gemini.state = "celebrating";
      specialist.dialogue = null;
      specialist.targetX = 740;
      specialist.targetY = 370;
      specialist.state = "walking";
      specialist.facing = "right";

      arcadeAudio.playTalkChirp("claude");
      arcadeAudio.playFanfare();
      setActiveSpeech({ charId: claude.id, text: turn5.text, tag: "CONTRACT AWARD" });
      addLog(`Claude: "${turn5.text}"`);
      await arcadeAudio.playNegotiationTurn(turn5);
      if (sequenceRunIdRef.current !== runId) return;

      if (!(await sleep(500))) return;

      // Step 7: Gemini works at research desk
      setStagePhase("executing");
      gemini.targetX = 740;
      gemini.targetY = 240;
      gemini.state = "working";
      gemini.facing = "right";
      gemini.dialogue = "Writing research brief...";
      gemini.dialogueColor = "#6d8e9c";
      addLog("Gemini executing deliverable at research desk...");

      if (!(await sleep(2200))) return;

      // Step 8: Deliverable presented & verified
      setStagePhase("verified");
      gemini.targetX = 480;
      gemini.targetY = 250;
      gemini.state = "walking";
      gemini.facing = "up";
      gemini.dialogue = "Deliverable ready!";
      arcadeAudio.playClick();
      arcadeAudio.playTalkChirp("gemini");
      setActiveSpeech({ charId: gemini.id, text: "Gemini: Deliverable generated with executive evidence and visualization spec.", tag: "DELIVERABLE PROOF" });
      addLog("Gemini: Deliverable submitted for quality review.");

      if (!(await sleep(1400))) return;

      claude.dialogue = "Rubric check: Passed 100%!";
      claude.dialogueColor = "#84a96e";
      arcadeAudio.playTalkChirp("claude");
      setActiveSpeech({ charId: claude.id, text: "Claude: Quality review passed. Deliverable satisfies all rubric criteria. Releasing escrow.", tag: "ORCHESTRATOR AUDIT" });
      addLog("Claude: Quality review passed. Escrow release authorized.");

      if (!(await sleep(1500))) return;

      // Step 9: Settlement & Gold Payout
      setStagePhase("paid");
      arcadeAudio.playPayout();
      arcadeAudio.playTalkChirp("gemini");
      gemini.state = "celebrating";
      gemini.dialogue = `+${rewardFormatted} Escrow Settled!`;
      gemini.dialogueColor = "#d4b86a";
      gemini.gold += rewardVal;
      questor.dialogue = "Deliverable accepted!";
      setActiveSpeech({ charId: questor.id, text: `Traveler: Deliverable accepted. ${rewardFormatted} transferred to Gemini Wallet.`, tag: "ESCROW SETTLEMENT" });
      addLog(`Escrow released: ${rewardFormatted} transferred to Gemini Wallet.`);

      if (!(await sleep(3500))) return;

      // Reset
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
      setActiveSpeech(null);
    },
    [activeGoal, rewardCents, speed, addLog]
  );

  useEffect(() => {
    if ((isExecuting || (triggerSequenceKey && triggerSequenceKey > 0)) && stagePhase === "idle") {
      void runArcadeSequence();
    }
  }, [isExecuting, triggerSequenceKey, stagePhase, runArcadeSequence]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--accent-green-bright)",
              background: "var(--bg-input)",
              padding: "5px 10px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--border-inner)",
              letterSpacing: "0.4px",
            }}
          >
            Live Model Voices
          </span>

          <button
            onClick={() => {
              const next = speed === 1 ? 2 : 1;
              setSpeed(next);
              arcadeAudio.playbackRate = next === 2 ? 1.5 : 1.0;
            }}
            className={`arcade-btn-pill ${speed === 2 ? "active" : ""}`}
            title="Toggle simulation speed"
          >
            {speed}x Speed
          </button>

          <button
            onClick={toggleVoice}
            className={`arcade-btn-pill ${voiceEnabled ? "active" : ""}`}
            title="Toggle character voice audio"
          >
            {voiceEnabled ? "Voice: Speaking" : "Voice: Muted"}
          </button>

          <button
            onClick={toggleSound}
            className={`arcade-btn-pill ${soundEnabled ? "active" : ""}`}
            title="Toggle audio sound effects"
          >
            {soundEnabled ? "SFX: On" : "SFX: Muted"}
          </button>

          <button
            onClick={() => void runArcadeSequence()}
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
          <span style={{ color: "var(--accent-gold)", fontSize: 10, letterSpacing: "0.5px" }}>
            Live Multi-Agent Dialogue
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
