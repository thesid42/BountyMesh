"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { arcadeAudio } from "@/lib/arcadeAudio";
import { drawGuildEnvironment, drawBiddingConnections } from "./ArcadeEnvironment";
import {
  drawArcadeCharacter,
  drawCharacterDialogue,
  type ArcadeCharacter,
  type ArcadeFacing,
} from "./ArcadeSprites";
import { GuildNoticeBoardModal } from "./GuildNoticeBoardModal";
import { GuildVaultModal } from "./GuildVaultModal";
import { GuildBookshelfModal } from "./GuildBookshelfModal";
import type { Agent, Bounty, Snapshot } from "@/lib/contracts";

export type { ArcadeCharacter };

export const FAILED_DEMO_GOAL = "Provide a verified cryptographic proof and financial benchmark audit";
type ArcadePhase = "idle" | "planning" | "funding" | "bidding" | "executing" | "delivered" | "verified" | "settling" | "paid" | "failed";

interface ArcadeRoomProps {
  snapshot: Snapshot;
  isExecuting?: boolean;
  canRunLiveDemo?: boolean;
  canStartWork?: boolean;
  onRunLiveDemo?: () => void;
  activeRequestKey?: string;
  activeRunId?: string;
  authHeaders?: Record<string, string>;
  shouldFail?: boolean;
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

interface GuildStation {
  id: string;
  name: string;
  x: number;
  y: number;
  facing: ArcadeFacing;
  stationType: "bookshelf" | "hearth" | "bar" | "table" | "desk" | "notice-board" | "vault";
  preferredCharIds?: string[];
  arrivalChatter?: string[];
}

const FLOOR_MIN_X = 160;
const FLOOR_MAX_X = 770;
const FLOOR_MIN_Y = 145;
const FLOOR_MAX_Y = 415;

const TABLE_CENTER_X = 480;
const TABLE_CENTER_Y = 255;
const TABLE_RADIUS_X = 105;
const TABLE_RADIUS_Y = 42;

function pathIntersectsTable(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  const rx = TABLE_RADIUS_X + 14;
  const ry = TABLE_RADIUS_Y + 14;
  const ax = (x1 - TABLE_CENTER_X) / rx;
  const ay = (y1 - TABLE_CENTER_Y) / ry;
  const bx = (x2 - TABLE_CENTER_X) / rx;
  const by = (y2 - TABLE_CENTER_Y) / ry;

  const vx = bx - ax;
  const vy = by - ay;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) return ax * ax + ay * ay < 1.0;

  const t = Math.max(0, Math.min(1, -(ax * vx + ay * vy) / lenSq));
  const px = ax + t * vx;
  const py = ay + t * vy;
  return px * px + py * py < 1.0;
}

function computeRouteWaypoint(
  startX: number,
  startY: number,
  destX: number,
  destY: number
): { x: number; y: number } | null {
  if (!pathIntersectsTable(startX, startY, destX, destY)) return null;

  const dx = Math.abs(destX - startX);
  const dy = Math.abs(destY - startY);

  // If path is mainly vertical across table:
  if (dy >= dx) {
    const avgX = (startX + destX) / 2;
    const detourX = avgX < TABLE_CENTER_X ? 345 : 615;
    return { x: detourX, y: TABLE_CENTER_Y };
  } else {
    // If path is mainly horizontal across table:
    const avgY = (startY + destY) / 2;
    const detourY = avgY < TABLE_CENTER_Y ? 160 : 345;
    return { x: TABLE_CENTER_X, y: detourY };
  }
}

const OPEN_WANDER_SPOTS = [
  { x: 340, y: 155, facing: "down" as const },
  { x: 550, y: 155, facing: "down" as const },
  { x: 260, y: 280, facing: "right" as const },
  { x: 700, y: 280, facing: "left" as const },
  { x: 300, y: 350, facing: "up" as const },
  { x: 480, y: 360, facing: "up" as const },
  { x: 650, y: 350, facing: "up" as const },
];

const GUILD_STATIONS: GuildStation[] = [
  // 1. Notice Board (x: 245, y: 155) - standing on floor looking up
  {
    id: "notice-board",
    name: "Guild Notice Board",
    x: 245,
    y: 155,
    facing: "up",
    stationType: "notice-board",
    preferredCharIds: ["questor-player", "sentinel-worker"],
    arrivalChatter: [
      "Inspecting newly posted guild directives...",
      "Checking reward tiers on the notice board...",
    ],
  },
  // 2. Guild Hearth Fireplace West (x: 430, y: 155)
  {
    id: "hearth-west",
    name: "Guild Hearth Fireplace",
    x: 430,
    y: 155,
    facing: "right",
    stationType: "hearth",
    preferredCharIds: ["11111111-1111-4111-8111-111111111111", "questor-player"],
    arrivalChatter: [
      "Warming hands by the hearth fire...",
      "Warm embers crackling softly in the grate...",
    ],
  },
  // 3. Guild Hearth Fireplace East (x: 530, y: 155)
  {
    id: "hearth-east",
    name: "Guild Hearth Fireplace",
    x: 530,
    y: 155,
    facing: "left",
    stationType: "hearth",
    preferredCharIds: ["33333333-3333-4333-8333-333333333333", "questor-player"],
    arrivalChatter: [
      "Resting before the next bounty assignment...",
      "Comforting hearth warmth radiates through the hall...",
    ],
  },
  // 4. Ancient Library Bookshelf (x: 640, y: 155)
  {
    id: "library-main",
    name: "Ancient Library Bookshelf",
    x: 640,
    y: 155,
    facing: "up",
    stationType: "bookshelf",
    preferredCharIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
    arrivalChatter: [
      "Referencing foundational agent codices...",
      "Reviewing prompt engineering scrolls...",
      "Consulting ancient algorithmic codices...",
    ],
  },
  // 5. Guild Escrow Vault (x: 755, y: 155)
  {
    id: "vault",
    name: "Guild Escrow Vault",
    x: 755,
    y: 155,
    facing: "up",
    stationType: "vault",
    preferredCharIds: ["11111111-1111-4111-8111-111111111111", "questor-player"],
    arrivalChatter: [
      "Verifying cryptographic escrow balances...",
      "Ledger balances match vault reserve gold.",
    ],
  },
  // 6. Tavern Bar Counter (x: 185, y: 250)
  {
    id: "tavern-bar",
    name: "Tavern Bar & Cider Kegs",
    x: 185,
    y: 250,
    facing: "left",
    stationType: "bar",
    preferredCharIds: ["questor-player", "33333333-3333-4333-8333-333333333333", "sentinel-worker"],
    arrivalChatter: [
      "Inspecting oak-cask cider kegs...",
      "Taking a brief refreshment break...",
      "Checking alchemical stamina draughts...",
    ],
  },
  // 7. Strategy Table Stations (surrounding oak table at 480, 255)
  {
    id: "table-north",
    name: "Strategy Table (North)",
    x: 480,
    y: 190,
    facing: "down",
    stationType: "table",
    preferredCharIds: ["11111111-1111-4111-8111-111111111111"],
    arrivalChatter: [
      "Reviewing realm map and bounty routes...",
      "Assessing regional contract requirements...",
    ],
  },
  {
    id: "table-south",
    name: "Strategy Table (South)",
    x: 480,
    y: 320,
    facing: "up",
    stationType: "table",
    preferredCharIds: ["33333333-3333-4333-8333-333333333333", "questor-player"],
    arrivalChatter: [
      "Examining expedition markers on the map...",
      "Evaluating quest collateral margins...",
    ],
  },
  {
    id: "table-west",
    name: "Strategy Table (West)",
    x: 345,
    y: 255,
    facing: "right",
    stationType: "table",
    preferredCharIds: ["questor-player", "sentinel-worker"],
    arrivalChatter: [
      "Inspecting dispatch queue priorities...",
      "Reviewing verification criteria...",
    ],
  },
  {
    id: "table-east",
    name: "Strategy Table (East)",
    x: 615,
    y: 255,
    facing: "left",
    stationType: "table",
    preferredCharIds: ["22222222-2222-4222-8222-222222222222"],
    arrivalChatter: [
      "Coordinating multi-agent workflow graph...",
      "Analyzing capability embeddings...",
    ],
  },
  // 8. Research Desks
  {
    id: "desk-gemini",
    name: "Scholar's Research Desk",
    x: 735,
    y: 245,
    facing: "right",
    stationType: "desk",
    preferredCharIds: ["22222222-2222-4222-8222-222222222222"],
    arrivalChatter: [
      "Drafting market synthesis report...",
      "Updating data visualization specifications...",
    ],
  },
  {
    id: "desk-specialist",
    name: "Ranger's Workstation",
    x: 735,
    y: 370,
    facing: "right",
    stationType: "desk",
    preferredCharIds: ["33333333-3333-4333-8333-333333333333"],
    arrivalChatter: [
      "Testing edge cases in rubric criteria...",
      "Calibrating benchmark evaluation suites...",
    ],
  },
  {
    id: "desk-sentinel",
    name: "Sentinel's Watch Desk",
    x: 245,
    y: 370,
    facing: "left",
    stationType: "desk",
    preferredCharIds: ["sentinel-worker"],
    arrivalChatter: [
      "Running invariant unit test checks...",
      "Auditing escrow lock invariants...",
    ],
  },
  // 9. Central Rug / Open Floor Lounges
  {
    id: "lounge-west",
    name: "Tavern Hearthside Lounge",
    x: 300,
    y: 350,
    facing: "right",
    stationType: "table",
    preferredCharIds: ["questor-player", "33333333-3333-4333-8333-333333333333"],
    arrivalChatter: [
      "Taking a well-earned rest in the guild hall...",
      "Reviewing upcoming adventurer credentials...",
    ],
  },
  {
    id: "lounge-east",
    name: "Guild Research Alcove",
    x: 660,
    y: 350,
    facing: "left",
    stationType: "table",
    preferredCharIds: ["22222222-2222-4222-8222-222222222222", "11111111-1111-4111-8111-111111111111"],
    arrivalChatter: [
      "Comparing benchmark results across agents...",
      "Optimizing latency and quality trade-offs...",
    ],
  },
];

const PROXIMITY_CHATTER: Record<string, string[]> = {
  // Claude Orchestrator
  "11111111-1111-4111-8111-111111111111": [
    "Reviewing escrow ledger...",
    "Synthesizing agent capability matrix...",
    "Calibrating rubric verification criteria...",
    "Treasury gold reserves verified and locked.",
    "Ensuring prompt alignment standards across guild.",
    "Evaluating semantic embeddings for incoming contracts.",
  ],
  // Gemini Scholar
  "22222222-2222-4222-8222-222222222222": [
    "Optimizing pgvector index...",
    "Analyzing multimodal embedding clusters...",
    "Synthesizing market intelligence brief...",
    "Running semantic similarity benchmarks...",
    "Indexing research archives for the guild...",
    "Cross-referencing token efficiency scores.",
  ],
  // Specialist Ranger
  "33333333-3333-4333-8333-333333333333": [
    "Verifying cryptographic proof...",
    "Sharpening benchmark criteria...",
    "Inspecting competitive market vectors...",
    "Testing edge cases in settlement logic...",
    "Calibrating worker execution latency...",
    "Verifying zero-knowledge proofs on chain...",
  ],
  // Sentinel
  "sentinel-worker": [
    "Auditing escrow payment channel...",
    "Validating invariant test suites...",
    "Standing watch over the guild vault...",
    "Inspecting code security signatures...",
    "All room contracts verified.",
    "Checking state machine transition guards.",
  ],
  // Traveler / Questor
  "questor-player": [
    "Inspecting quest board...",
    "Drafting new objective specifications...",
    "Checking bounty collateral in vault...",
    "Consulting the guildmaster on bounties...",
    "Awaiting specialist bids on new quest...",
    "Reviewing milestone deliverables.",
  ],
};

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
      hint: "Click to submit the live task",
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
  isExecuting = false,
  canRunLiveDemo = false,
  canStartWork = false,
  activeRequestKey,
  activeRunId,
  authHeaders,
  shouldFail = false,
  onRunLiveDemo,
  onSelectCharacter,
  onSelectBounty,
  onFillGoal,
  onSwitchTab,
}: ArcadeRoomProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [gameLog, setGameLog] = useState<string[]>([
    "The Guild Hall is open. Fireplace crackles softly.",
    "Claude Orchestrator reviews the quest parchment.",
    "Ready: Click any character, notice board, or object to interact.",
  ]);
  const [activeSpeech, setActiveSpeech] = useState<{ charId: string; text: string; tag: string } | null>(null);
  const narrationRequestKey = useRef("");
  const narrationHeaders = useRef(authHeaders);
  narrationHeaders.current = authHeaders;

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
      x: 240,
      y: 220,
      targetX: 240,
      targetY: 220,
      facing: "down",
      state: "idle",
      dialogue: null,
      avatarType: "questor",
      level: 12,
      gold: 0,
      skills: ["task architect", "escrow funder", "prompt design"],
      homeX: 240,
      homeY: 220,
      idlePauseTimer: 3.5,
      chatCooldownTimer: 4.0,
    },
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Claude",
      role: "orchestrator",
      model: "claude-sonnet-5",
      color: "#8f79a6",
      x: 480,
      y: 205,
      targetX: 480,
      targetY: 205,
      facing: "down",
      state: "idle",
      dialogue: "Awaiting quests...",
      dialogueColor: "#8f79a6",
      avatarType: "claude",
      level: 99,
      gold: 0,
      skills: ["planning", "research", "quality review", "market analysis"],
      homeX: 480,
      homeY: 205,
      idlePauseTimer: 5.5,
      chatCooldownTimer: 5.0,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Gemini",
      role: "worker",
      model: "gemini-3.8-flash",
      color: "#6d8e9c",
      x: 745,
      y: 245,
      targetX: 745,
      targetY: 245,
      facing: "right",
      state: "idle",
      dialogue: null,
      avatarType: "gemini",
      level: 45,
      gold: 0,
      skills: ["data visualization", "market research", "analysis", "report writing"],
      homeX: 745,
      homeY: 245,
      idlePauseTimer: 7.5,
      chatCooldownTimer: 6.0,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Specialist",
      role: "worker",
      model: "gemini-3.8-flash",
      color: "#84a96e",
      x: 745,
      y: 370,
      targetX: 745,
      targetY: 370,
      facing: "right",
      state: "idle",
      dialogue: null,
      avatarType: "specialist",
      level: 52,
      gold: 0,
      skills: ["competitive research", "synthesis", "business strategy"],
      homeX: 745,
      homeY: 370,
      idlePauseTimer: 4.5,
      chatCooldownTimer: 5.0,
    },
    {
      id: "sentinel-worker",
      name: "Sentinel",
      role: "worker",
      model: "claude-3-haiku",
      color: "#c96b6b",
      x: 245,
      y: 370,
      targetX: 245,
      targetY: 370,
      facing: "left",
      state: "idle",
      dialogue: null,
      avatarType: "sentinel",
      level: 38,
      gold: 0,
      skills: ["code audit", "rubric verification", "unit testing"],
      homeX: 245,
      homeY: 370,
      idlePauseTimer: 6.5,
      chatCooldownTimer: 7.0,
    },
  ]);

  // Sync snapshot agent gold/stats with game state
  useEffect(() => {
    snapshot.agents.forEach((snapAgent) => {
      const char = charactersRef.current.find((c) => c.id === snapAgent.id);
      if (char) {
        char.name = snapAgent.name;
        char.model = snapAgent.model;

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
      const ctx = arcadeAudio.initCtx();
      if (ctx && ctx.state === "suspended") {
        void ctx.resume();
      }
      arcadeAudio.playClick();
      const greeting = "Adventurer's Guild voice narration active. Standing by for task briefings.";
      setActiveSpeech({
        charId: "11111111-1111-4111-8111-111111111111",
        tag: "CLAUDE ORCHESTRATOR",
        text: greeting,
      });
      void arcadeAudio.playNegotiationTurn({
        speaker: "claude",
        text: greeting,
      });
    }
  };

  useEffect(() => {
    arcadeAudio.voiceEnabled = voiceEnabled;
    if (!voiceEnabled) arcadeAudio.stopSpeech();
    return () => arcadeAudio.stopSpeech();
  }, [voiceEnabled]);

  const addLog = useCallback((msg: string) => {
    setGameLog((prev) => [msg, ...prev.slice(0, 9)]);
  }, []);

  // Selected request identity wins over snapshot recency. Since snapshots are
  // capped, a missing selected row means "awaiting", never "not persisted".
  // Only evaluate a current run if an active request or run was explicitly initiated.
  const hasSelectedIdentity = Boolean(activeRequestKey || activeRunId);
  const currentRun = activeRequestKey
    ? snapshot.runs.find((run) => run.id === activeRequestKey || run.idempotencyKey === activeRequestKey) ?? null
    : activeRunId
      ? snapshot.runs.find((run) => run.id === activeRunId) ?? null
      : null;
  const awaitingSelectedRun = hasSelectedIdentity && !currentRun;
  const currentBounty = snapshot.bounties.find((bounty) => bounty.runId === currentRun?.id) ?? null;
  const currentWorker = snapshot.agents.find((agent) => agent.id === currentBounty?.workerId) ?? null;
  const runActivity = currentRun ? snapshot.activity.filter((entry) => entry.runId === currentRun.id).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).slice(-10) : [];
  const actualPhase: ArcadePhase = !currentRun
    ? isExecuting || awaitingSelectedRun ? "planning" : "idle"
    : currentBounty?.status === "paid" ? "paid"
      : currentBounty?.status === "failed" || (currentRun.status === "failed" && currentBounty?.status !== "settling") ? "failed"
        : !currentBounty ? "planning"
          : currentBounty.status === "funding" ? "funding"
            : currentBounty.status === "open" ? "bidding"
              : currentBounty.status === "claimed" ? "executing"
                : currentBounty.status === "delivered" ? "delivered"
                  : currentBounty.status === "verified" ? "verified"
                    : currentBounty.status === "settling" ? "settling" : "planning";
  const stagePhase = actualPhase;
  const canStartRoomAction = snapshot.config.mode === "live"
    && canRunLiveDemo && !isExecuting && currentRun?.status !== "running";

  useEffect(() => {
    if (!currentRun) {
      if (isExecuting || awaitingSelectedRun) {
        setActiveSpeech({ charId: "questor-player", text: "Awaiting selected run state from the persisted snapshot.", tag: "LIVE REQUEST" });
        setGameLog(["REQUEST: Awaiting selected run state."]);
      }
      return;
    }
    const entries = runActivity.slice().reverse().map((entry) => {
      const actor = snapshot.agents.find((agent) => agent.id === entry.actorId);
      return `${entry.actorId ? actor?.name ?? "AGENT" : "SYSTEM"}: ${entry.message}`;
    });
    setGameLog(entries.length ? entries : [`SYSTEM: Run ${currentRun.status}; waiting for agent activity.`]);
  }, [currentRun?.id, currentRun?.status, isExecuting, runActivity.map((entry) => entry.id).join("|"), snapshot.agents, awaitingSelectedRun]);

  useEffect(() => {
    if (!currentRun) return;
    const latest = runActivity[runActivity.length - 1];
    if (latest) {
      const actor = snapshot.agents.find((agent) => agent.id === latest.actorId);
      setActiveSpeech({ charId: latest.actorId ?? "11111111-1111-4111-8111-111111111111", text: latest.message, tag: actor?.name ?? latest.type.toUpperCase() });
    }
  }, [currentRun?.id, runActivity.at(-1)?.id, snapshot.agents]);

  // Optional speech is derived exclusively from the authenticated, persisted run.
  // Narrate only once per selected persisted run; lifecycle text below continues
  // to update from snapshots without another paid TTS request.
  useEffect(() => {
    const statusKey = currentRun
      ? currentRun.id
      : "";
    if (snapshot.config.mode !== "live" || !currentRun || !statusKey) {
      if (!voiceEnabled) arcadeAudio.stopSpeech();
      return;
    }
    if (narrationRequestKey.current === statusKey) return;
    narrationRequestKey.current = statusKey;

    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/negotiate", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...narrationHeaders.current },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            runId: currentRun.id,
            idempotencyKey: currentRun.idempotencyKey,
            synthesizeAudio: voiceEnabled,
          }),
        });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object") return;
        const narration = payload as { success?: unknown; mode?: unknown; turns?: unknown };
        if (narration.success !== true || narration.mode !== "live" || !Array.isArray(narration.turns)) return;
        const turns = narration.turns;
        for (const candidate of turns) {
          if (!active || !candidate || typeof candidate !== "object") return;
          const turn = candidate as {
            speaker?: unknown;
            speakerName?: unknown;
            text?: unknown;
            audioBase64?: unknown;
            audioMimeType?: unknown;
          };
          const speaker = String(turn.speaker ?? "");
          const speakerName = typeof turn.speakerName === "string" ? turn.speakerName : "";
          const text = typeof turn.text === "string" ? turn.text : "";
          if (!(["traveler", "claude", "gemini", "specialist"].includes(speaker) && speakerName && text && text.length <= 2000)) continue;
          setActiveSpeech({ charId: currentRun.id, text, tag: speakerName });
          if (voiceEnabled) {
            await arcadeAudio.playNegotiationTurn({
              speaker: speaker as "traveler" | "claude" | "gemini" | "specialist",
              text,
              ...(typeof turn.audioBase64 === "string" ? { audioBase64: turn.audioBase64 } : {}),
              ...(typeof turn.audioMimeType === "string" ? { audioMimeType: turn.audioMimeType } : {}),
            });
          } else {
            await new Promise((r) => setTimeout(r, Math.max(1800, Math.min(text.length * 28, 2800))));
          }
        }
      } catch {
        // Narration is optional; keep the persisted lifecycle UI available.
      }
    })();
    return () => {
      active = false;
      controller.abort();
      arcadeAudio.stopSpeech();
    };
  }, [voiceEnabled, snapshot.config.mode, currentRun?.id, currentRun?.idempotencyKey]);

  const lastPaidBountyId = useRef<string | null>(null);
  useEffect(() => {
    if (currentBounty?.status === "paid" && lastPaidBountyId.current !== currentBounty.id) {
      if (lastPaidBountyId.current !== null) {
        arcadeAudio.playPayout();
      }
      lastPaidBountyId.current = currentBounty.id;
    }
  }, [currentBounty?.id, currentBounty?.status]);

  const lastFailedBountyId = useRef<string | null>(null);
  useEffect(() => {
    if (currentBounty?.status === "failed" && lastFailedBountyId.current !== currentBounty.id) {
      if (lastFailedBountyId.current !== null) {
        arcadeAudio.playReject();
        setTimeout(() => arcadeAudio.playRefund(), 400);
      }
      lastFailedBountyId.current = currentBounty.id;
    }
  }, [currentBounty?.id, currentBounty?.status]);

  useEffect(() => {
    const chars = charactersRef.current;
    const questor = chars.find((char) => char.role === "questor");
    const claude = chars.find((char) => char.id === "11111111-1111-4111-8111-111111111111");
    if (!currentRun) {
      if (awaitingSelectedRun || isExecuting) {
        if (questor) questor.dialogue = isExecuting ? "SUBMITTING REQUEST..." : "AWAITING RUN STATE";
        if (claude) { claude.state = "idle"; claude.dialogue = "Waiting for persisted work..."; }
        chars.filter((char) => char.role === "worker").forEach((char) => { char.state = "idle"; char.dialogue = null; char.bidSimilarity = undefined; });
      }
      return;
    }
    const worker = currentWorker ? chars.find((char) => char.id === currentWorker.id) : null;
    const latest = runActivity[runActivity.length - 1];
    if (questor) {
      questor.dialogue = currentBounty ? `${currentBounty.status.toUpperCase()}: ${currentBounty.title.slice(0, 24)}` : currentRun.status === "failed" ? "REQUEST FAILED · NO BOUNTY" : "REQUEST RECORDED";
      questor.dialogueColor = currentBounty?.status === "failed" || currentRun.status === "failed" ? "#fbbf24" : "#fbbf24";
    }
    if (claude) {
      claude.state = "working";
      claude.dialogue = latest?.message ?? (currentBounty ? `Bounty ${currentBounty.status}` : `Run ${currentRun.status}`);
      claude.dialogueColor = currentRun.status === "failed" ? "#fbbf24" : "#c084fc";
    }
    chars.filter((char) => char.role === "worker").forEach((char) => {
      if (char.id === worker?.id) {
        char.bidSimilarity = currentBounty?.similarity == null ? undefined : Math.round(currentBounty.similarity * 100);
        char.state = currentBounty?.status === "paid" ? "celebrating" : currentBounty?.status === "open" ? "bidding" : currentBounty?.status === "claimed" || currentBounty?.status === "delivered" || currentBounty?.status === "verified" || currentBounty?.status === "settling" ? "working" : "idle";
        char.dialogue = currentBounty?.status === "paid" ? `PAID $${(currentBounty.rewardCents / 100).toFixed(2)} · VERIFIED TRANSFER` : currentBounty?.similarity != null ? `MATCH ${Math.round(currentBounty.similarity * 100)}% · ${currentBounty.status.toUpperCase()}` : currentBounty?.status.toUpperCase() ?? null;
        char.dialogueColor = currentBounty?.status === "paid" ? "#34d399" : "#38bdf8";
      } else {
        char.bidSimilarity = undefined;
        char.state = "idle";
        char.dialogue = null;
      }
    });
  }, [currentBounty?.id, currentBounty?.status, currentBounty?.similarity, currentBounty?.rewardCents, currentRun?.id, currentRun?.status, currentWorker?.id, isExecuting, runActivity.at(-1)?.id, awaitingSelectedRun]);

  const runArcadeSequence = useCallback(() => {
    if (canStartRoomAction) onRunLiveDemo?.();
  }, [canStartRoomAction, onRunLiveDemo]);

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
        if (voiceEnabled) {
          const charName = target.char.name;
          const greeting =
            target.char.role === "orchestrator"
              ? "Claude Orchestrator ready. Standing by to review and route quest specifications."
              : target.char.role === "questor"
              ? "Traveler logged in. Ready to fund verified escrow for autonomous deliverables."
              : `${charName} ready for subcontracting. Specialized capabilities online.`;
          void arcadeAudio.playNegotiationTurn({
            speaker:
              target.char.role === "questor" ? "traveler" :
              target.char.avatarType === "claude" ? "claude" :
              target.char.avatarType === "gemini" ? "gemini" :
              target.char.avatarType === "specialist" ? "specialist" : "sentinel",
            text: greeting,
          });
        }
        return;
      }

      if (target.type === "notice-board") {
        if (!canStartWork || snapshot.config.mode !== "live") {
          addLog("Notice board presets are unavailable until the workspace is ready.");
          return;
        }
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
        if (canStartRoomAction) {
          runArcadeSequence();
          addLog("Submitting a real live task request.");
        } else {
          addLog("The guild table is unavailable until the workspace is ready and no request is pending.");
        }
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
          questor.targetX = 240;
          questor.targetY = 215;
          questor.wanderWaypoint = null;
          questor.state = "walking";
          questor.idlePauseTimer = 7.0;
          addLog("Traveler walked to the guild entrance.");
        }
        return;
      }
    }

    // Move Questor to clicked location on floor
    const questor = charactersRef.current.find((c) => c.role === "questor");
    if (questor && stagePhase === "idle") {
      arcadeAudio.playClick();
      questor.targetX = Math.max(FLOOR_MIN_X, Math.min(FLOOR_MAX_X, clickX));
      questor.targetY = Math.max(FLOOR_MIN_Y, Math.min(FLOOR_MAX_Y, clickY));
      questor.state = "walking";
      questor.wanderWaypoint = computeRouteWaypoint(questor.x, questor.y, questor.targetX, questor.targetY);
      questor.idlePauseTimer = 8.0; // Wait 8 seconds before resuming autonomous roaming
    }
  };

  // Refs for animation loop stability
  const stagePhaseRef = useRef(stagePhase);
  stagePhaseRef.current = stagePhase;

  // 60FPS Game Loop with Delta-Time & Physics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animId: number;
    let ticks = 0;
    let lastTime = performance.now();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 960 * dpr;
    canvas.height = 480 * dpr;
    ctx.scale(dpr, dpr);

    const render = (currentTime: number) => {
      animId = requestAnimationFrame(render);

      // Delta-time clamped to avoid large jumps on tab switch
      const dt = Math.min(Math.max((currentTime - lastTime) / 1000, 0.001), 0.08);
      lastTime = currentTime;
      ticks++;

      const width = 960;
      const height = 480;
      const currentPhase = stagePhaseRef.current;
      const chars = charactersRef.current;

      ctx.clearRect(0, 0, width, height);

      // -----------------------------------------------------------------------
      // 1. UPDATE CHARACTER TIMERS
      // -----------------------------------------------------------------------
      chars.forEach((c) => {
        if (c.dialogueTimer && c.dialogueTimer > 0) {
          c.dialogueTimer -= dt;
          if (c.dialogueTimer <= 0) {
            c.dialogue = null;
            c.dialogueTimer = 0;
          }
        }
        if (c.chatCooldownTimer && c.chatCooldownTimer > 0) {
          c.chatCooldownTimer -= dt;
          if (c.chatCooldownTimer < 0) c.chatCooldownTimer = 0;
        }
      });

      // -----------------------------------------------------------------------
      // 2. AUTONOMOUS IDLE STATION SELECTION (when hall is in "idle" stage)
      // -----------------------------------------------------------------------
      if (currentPhase === "idle") {
        chars.forEach((char) => {
          if (char.state === "idle") {
            if (char.idlePauseTimer === undefined) {
              char.idlePauseTimer = 2.0 + Math.random() * 4.0;
            } else {
              char.idlePauseTimer -= dt;
            }

            if (char.idlePauseTimer <= 0) {
              // Find stations not already occupied or targeted by another character
              const availableStations = GUILD_STATIONS.filter((s) => {
                return !chars.some(
                  (other) =>
                    other.id !== char.id &&
                    (Math.hypot(other.x - s.x, other.y - s.y) < 45 ||
                      Math.hypot(other.targetX - s.x, other.targetY - s.y) < 45)
                );
              });

              interface CandidateDest {
                x: number;
                y: number;
                facing: ArcadeFacing;
                weight: number;
              }

              const candidatePool: CandidateDest[] = [];

              availableStations.forEach((s) => {
                // Don't immediately re-pick current position
                if (Math.hypot(char.x - s.x, char.y - s.y) < 32) return;

                let weight = 1;
                if (s.preferredCharIds && s.preferredCharIds.includes(char.id)) {
                  weight = 4;
                }
                candidatePool.push({ x: s.x, y: s.y, facing: s.facing, weight });
              });

              // Also candidate: return to home workstation
              const homeX = char.homeX || char.x;
              const homeY = char.homeY || char.y;
              if (Math.hypot(char.x - homeX, char.y - homeY) > 35) {
                const homeFacing: ArcadeFacing =
                  char.role === "orchestrator" ? "down" :
                  char.avatarType === "gemini" ? "right" :
                  char.avatarType === "specialist" ? "right" :
                  char.avatarType === "sentinel" ? "left" : "down";
                candidatePool.push({ x: homeX, y: homeY, facing: homeFacing, weight: 3 });
              }

              // Guarantee candidatePool is never empty so characters constantly explore the room
              if (candidatePool.length <= 1) {
                OPEN_WANDER_SPOTS.forEach((spot) => {
                  if (Math.hypot(char.x - spot.x, char.y - spot.y) > 30) {
                    candidatePool.push({ x: spot.x, y: spot.y, facing: spot.facing, weight: 2 });
                  }
                });
              }

              if (candidatePool.length > 0) {
                const totalWeight = candidatePool.reduce((sum, c) => sum + c.weight, 0);
                let rand = Math.random() * totalWeight;
                let chosen = candidatePool[0];
                for (const cand of candidatePool) {
                  if (rand < cand.weight) {
                    chosen = cand;
                    break;
                  }
                  rand -= cand.weight;
                }

                char.targetX = Math.max(FLOOR_MIN_X, Math.min(FLOOR_MAX_X, chosen.x));
                char.targetY = Math.max(FLOOR_MIN_Y, Math.min(FLOOR_MAX_Y, chosen.y));
                char.state = "walking";
                char.stuckTimer = 0;
                char.lastPosX = char.x;
                char.lastPosY = char.y;

                // Path routing: check if direct path crosses the central strategy table
                char.wanderWaypoint = computeRouteWaypoint(char.x, char.y, char.targetX, char.targetY);
              } else {
                // No station available right now; brief pause before retrying
                char.idlePauseTimer = 2.0 + Math.random() * 2.0;
              }
            }
          }
        });
      }

      // -----------------------------------------------------------------------
      // 3. MOVEMENT & NAVIGATION WITH DELTA-TIME
      // -----------------------------------------------------------------------
      chars.forEach((char) => {
        const curDestX = char.wanderWaypoint ? char.wanderWaypoint.x : char.targetX;
        const curDestY = char.wanderWaypoint ? char.wanderWaypoint.y : char.targetY;
        const dx = curDestX - char.x;
        const dy = curDestY - char.y;
        const dist = Math.hypot(dx, dy);

        const isWalking = char.state === "walking";
        const baseSpeed = currentPhase === "idle" ? 75 : 125;
        const moveSpeed = (isWalking ? baseSpeed : 0) * dt;

        if (isWalking) {
          if (dist > 6) {
            let vx = (dx / dist) * Math.min(moveSpeed, dist);
            let vy = (dy / dist) * Math.min(moveSpeed, dist);

            // 1. Smooth sliding along elliptical strategy table
            const nextX = char.x + vx;
            const nextY = char.y + vy;
            const normX = (nextX - TABLE_CENTER_X) / TABLE_RADIUS_X;
            const normY = (nextY - TABLE_CENTER_Y) / TABLE_RADIUS_Y;
            const distSq = normX * normX + normY * normY;
            if (distSq < 1.0) {
              const nx = normX / TABLE_RADIUS_X;
              const ny = normY / TABLE_RADIUS_Y;
              const nLen = Math.hypot(nx, ny) || 1;
              const unx = nx / nLen;
              const uny = ny / nLen;
              const dot = vx * unx + vy * uny;
              if (dot < 0) {
                vx -= dot * unx;
                vy -= dot * uny;
                const tx = -uny;
                const ty = unx;
                const slip = 0.5 * Math.min(moveSpeed, 2.0);
                vx += tx * slip;
                vy += ty * slip;
              }
            }

            // 2. Apply position clamped within safe floor boundaries
            char.x = Math.max(FLOOR_MIN_X, Math.min(FLOOR_MAX_X, char.x + vx));
            char.y = Math.max(FLOOR_MIN_Y, Math.min(FLOOR_MAX_Y, char.y + vy));

            // 3. Update facing based on actual movement vector with hysteresis
            if (Math.abs(vx) > Math.abs(vy) + 0.1) {
              char.facing = vx > 0 ? "right" : "left";
            } else if (Math.abs(vy) > 0.1) {
              char.facing = vy > 0 ? "down" : "up";
            }

            // Clear intermediate waypoint once reached
            if (char.wanderWaypoint && Math.hypot(char.x - char.wanderWaypoint.x, char.y - char.wanderWaypoint.y) <= 18) {
              char.wanderWaypoint = null;
            }

            // Anti-stuck progress verification
            const progress = Math.hypot(char.x - (char.lastPosX ?? char.x), char.y - (char.lastPosY ?? char.y));
            if (progress < 0.12) {
              char.stuckTimer = (char.stuckTimer || 0) + dt;
            } else {
              char.stuckTimer = 0;
              char.lastPosX = char.x;
              char.lastPosY = char.y;
            }

            // If completely blocked for more than 1.4s, recover cleanly to idle
            if (char.stuckTimer > 1.4) {
              char.stuckTimer = 0;
              char.wanderWaypoint = null;
              char.state = "idle";
              char.idlePauseTimer = 1.0 + Math.random() * 2.0;
            }
          } else {
            // Reached destination!
            if (char.wanderWaypoint) {
              char.wanderWaypoint = null;
            } else {
              char.x = char.targetX;
              char.y = char.targetY;
              char.state = "idle";
              char.stuckTimer = 0;
              char.lastPosX = char.x;
              char.lastPosY = char.y;

              if (currentPhase === "idle") {
                const station = GUILD_STATIONS.find(
                  (s) => Math.hypot(s.x - char.x, s.y - char.y) < 32
                );
                if (station) {
                  char.facing = station.facing;
                  char.idlePauseTimer = 3.5 + Math.random() * 4.5;
                  if (
                    station.arrivalChatter &&
                    Math.random() < 0.35 &&
                    (!char.chatCooldownTimer || char.chatCooldownTimer <= 0) &&
                    !char.dialogue
                  ) {
                    const thoughts = station.arrivalChatter;
                    const thought = thoughts[Math.floor(Math.random() * thoughts.length)];
                    char.dialogue = thought;
                    char.dialogueColor = char.color;
                    char.dialogueTimer = 2.5;
                    char.chatCooldownTimer = 10.0;
                  }
                } else {
                  char.idlePauseTimer = 3.0 + Math.random() * 3.5;
                }
              }
            }
          }
        } else {
          char.stuckTimer = 0;
          char.lastPosX = char.x;
          char.lastPosY = char.y;
        }
      });

      // -----------------------------------------------------------------------
      // 4. SOFT STEERING / REPULSION PHYSICS & YIELDING
      // -----------------------------------------------------------------------
      for (let i = 0; i < chars.length; i++) {
        for (let j = i + 1; j < chars.length; j++) {
          const c1 = chars[i];
          const c2 = chars[j];
          const dx = c1.x - c2.x;
          const dy = c1.y - c2.y;
          const dist = Math.hypot(dx, dy);

          const minSpacing = 32;
          if (dist < minSpacing && dist > 0.001) {
            const overlap = (minSpacing - dist) / minSpacing;
            const nx = dx / dist;
            const ny = dy / dist;
            const push = overlap * 1.5;

            // If one character is idle, push the walking character around them
            if (c1.state === "walking" && c2.state === "walking") {
              c1.x += nx * push * 0.5;
              c1.y += ny * push * 0.5;
              c2.x -= nx * push * 0.5;
              c2.y -= ny * push * 0.5;
            } else if (c1.state === "walking") {
              c1.x += nx * push;
              c1.y += ny * push;
            } else if (c2.state === "walking") {
              c2.x -= nx * push;
              c2.y -= ny * push;
            }
          }

          // Lateral yielding when walking paths cross
          if (dist < 48 && c1.state === "walking" && c2.state === "walking") {
            const nx = dx / (dist || 1);
            const ny = dy / (dist || 1);
            const steerFactor = 0.35 * ((48 - dist) / 48);
            c1.x += -ny * steerFactor;
            c1.y += nx * steerFactor;
            c2.x -= -ny * steerFactor;
            c2.y -= nx * steerFactor;
          }
        }
      }

      // -----------------------------------------------------------------------
      // 5. BOUNDARY CLAMPING
      // -----------------------------------------------------------------------
      chars.forEach((char) => {
        char.x = Math.max(FLOOR_MIN_X, Math.min(FLOOR_MAX_X, char.x));
        char.y = Math.max(FLOOR_MIN_Y, Math.min(FLOOR_MAX_Y, char.y));
      });

      // -----------------------------------------------------------------------
      // 6. INTER-CHARACTER PROXIMITY INTERACTIONS (distance < 50px)
      // -----------------------------------------------------------------------
      if (currentPhase === "idle") {
        for (let i = 0; i < chars.length; i++) {
          for (let j = i + 1; j < chars.length; j++) {
            const c1 = chars[i];
            const c2 = chars[j];
            const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);

            if (dist < 50) {
              const c1Ready = (!c1.chatCooldownTimer || c1.chatCooldownTimer <= 0) && !c1.dialogue;
              const c2Ready = (!c2.chatCooldownTimer || c2.chatCooldownTimer <= 0) && !c2.dialogue;

              if (c1Ready && c2Ready) {
                const speaker = Math.random() < 0.5 ? c1 : c2;
                const listener = speaker === c1 ? c2 : c1;

                // Briefly turn to face each other
                const fdx = listener.x - speaker.x;
                const fdy = listener.y - speaker.y;
                if (Math.abs(fdx) > Math.abs(fdy)) {
                  speaker.facing = fdx > 0 ? "right" : "left";
                  listener.facing = fdx > 0 ? "left" : "right";
                } else {
                  speaker.facing = fdy > 0 ? "down" : "up";
                  listener.facing = fdy > 0 ? "up" : "down";
                }

                // In-character guild chatter
                const lines = PROXIMITY_CHATTER[speaker.id] || [
                  "Reviewing active guild operations...",
                ];
                const remark = lines[Math.floor(Math.random() * lines.length)];

                speaker.dialogue = remark;
                speaker.dialogueColor = speaker.color;
                speaker.dialogueTimer = 2.5; // Clear after 2.5s to keep screen clean
                speaker.chatCooldownTimer = 14.0;
                listener.chatCooldownTimer = 14.0;

                const speakerKey =
                  speaker.role === "questor" ? "traveler" :
                  speaker.avatarType === "claude" ? "claude" :
                  speaker.avatarType === "gemini" ? "gemini" :
                  speaker.avatarType === "specialist" ? "specialist" :
                  speaker.avatarType === "sentinel" ? "sentinel" : "traveler";
                arcadeAudio.playTalkChirp(speakerKey);
                if (voiceEnabled) {
                  void arcadeAudio.playNegotiationTurn({
                    speaker: speakerKey,
                    text: remark,
                  });
                }
              }
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // 7. ENVIRONMENT RENDERING
      // -----------------------------------------------------------------------
      const totalPayoutStr = (
        snapshot.ledger
          .filter((e) => e.kind === "payout")
          .reduce((s, e) => s + e.amountCents, 0) / 100
      ).toFixed(2);

      // 16-bit RPG Cozy Guild Hall Environment
      drawGuildEnvironment(ctx, width, height, ticks, currentPhase, totalPayoutStr);

      // Dynamic Bidding Connections
      const geminiChar = chars.find((c) => c.id.includes("2222"));
      const specialistChar = chars.find((c) => c.id.includes("3333"));
      drawBiddingConnections(
        ctx,
        currentPhase,
        { x: geminiChar ? geminiChar.x : 550, y: geminiChar ? geminiChar.y : 250 },
        { x: specialistChar ? specialistChar.x : 460, y: specialistChar ? specialistChar.y : 280 },
        { x: width / 2, y: 255 },
        ticks
      );

      // -----------------------------------------------------------------------
      // 8. SPRITE RENDERING WITH DEPTH Y-SORTING
      // -----------------------------------------------------------------------
      [...chars]
        .sort((a, b) => a.y - b.y)
        .forEach((char) => {
          drawArcadeCharacter(ctx, char, ticks);
          if (char.dialogue) {
            drawCharacterDialogue(ctx, char);
          }
        });

      // Interactive Hover Highlight Brackets on Canvas
      const hovered = hoveredTargetRef.current;
      if (hovered && hovered.box) {
        drawHoverCornerBrackets(ctx, hovered.box, ticks);
      }

      ctx.textAlign = "left";
    };

    render(performance.now());

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [currentWorker, snapshot, stagePhase]);

  return (
    <div className="arcade-cabinet-container">
      {/* Header Marquee Bar */}
      <div className="arcade-marquee-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <h2 className="arcade-marquee-title">The Adventurer&apos;s Guild Hall</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background:
                    stagePhase === "failed"
                      ? "#fbbf24"
                      : stagePhase === "paid"
                      ? "#34d399"
                      : isExecuting || awaitingSelectedRun
                      ? "#38bdf8"
                      : "var(--accent-green-bright)",
                }}
              />
              <span
                style={{
                  color:
                    stagePhase === "failed"
                      ? "#fbbf24"
                      : stagePhase === "paid"
                      ? "#34d399"
                      : "#cbd5e1",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                }}
              >
                {currentRun
                  ? `${stagePhase.toUpperCase()} · ${currentWorker?.name ?? "No worker assigned"}`
                  : isExecuting || awaitingSelectedRun
                  ? "AWAITING SELECTED RUN STATE"
                  : "LIVE GUILD · READY FOR QUESTS"}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: voiceEnabled ? "var(--accent-green-bright)" : "var(--accent-gold)",
              background: "var(--bg-input)",
              padding: "5px 10px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--border-inner)",
              letterSpacing: "0.4px",
            }}
          >
            {voiceEnabled ? "Listening to Voices" : "Text Only Mode"}
          </span>

          <button
            onClick={toggleVoice}
            className={`arcade-btn-pill ${voiceEnabled ? "active" : ""}`}
            title="Toggle between listening to spoken model voice audio or reading text-only dialogue"
          >
            {voiceEnabled ? "Voice Audio: Active" : "Voice Audio: Off"}
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
            disabled={!canStartRoomAction}
            title={canStartRoomAction ? "Submit a real task to the live network" : "Requires a ready authenticated live network"}
          >
            Run Live Demo
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
              onClick={() => {
                arcadeAudio.stopSpeech();
                setActiveSpeech(null);
              }}
              className="dialogue-dismiss"
              title="Dismiss"
            >
              [x]
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
            {voiceEnabled ? "Live Spoken Voice Active" : "Text Dialogue Mode"}
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
            if (!canStartWork) {
              addLog("Preset selection is unavailable until the workspace is ready.");
              return;
            }
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
