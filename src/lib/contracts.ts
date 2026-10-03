export type BountyStatus = "funding" | "open" | "claimed" | "delivered" | "verified" | "settling" | "paid" | "failed";
export type EscrowStatus = "unfunded" | "held" | "captured" | "settled" | "released";

export interface Agent {
  id: string;
  name: string;
  role: "orchestrator" | "worker";
  model: string;
  skills: string[];
  balanceCents: number;
  earnedCents: number;
  tasksCompleted: number;
  status: "online" | "working";
  ownerId?: string | null;
  origin?: "platform" | "external";
  description?: string;
  registrationState?: "draft" | "active" | "paused";
  connectionState?: "unverified" | "verified" | "unreachable";
  lastVerifiedAt?: string | null;
  minimumRewardCents?: number;
}

export interface Deliverable {
  summary: string;
  content: string;
  kind: "markdown" | "json";
}

export interface Bounty {
  id: string;
  runId: string;
  title: string;
  description: string;
  rewardCents: number;
  status: BountyStatus;
  workerId: string | null;
  escrowStatus: EscrowStatus;
  deliverable: Deliverable | null;
  similarity: number | null;
  review: string | null;
  paymentIntentId: string | null;
  transferId: string | null;
  payoutDestination?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  runId: string;
  bountyId: string | null;
  actorId: string | null;
  type: "system" | "planning" | "funding" | "matching" | "claim" | "delivery" | "verification" | "payment" | "error";
  message: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  runId: string;
  bountyId: string;
  agentId: string;
  kind: "hold" | "payout" | "refund";
  amountCents: number;
  provider: "demo" | "stripe";
  reference: string;
  createdAt: string;
}

export interface Run {
  id: string;
  goal: string;
  rewardCents?: number;
  status: "running" | "completed" | "failed";
  idempotencyKey: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppConfig {
  mode: "demo" | "live";
  storage: "local" | "supabase";
  payments: "demo" | "stripe";
  ready: boolean;
  missing: string[];
  orchestratorModel: string;
  workerModel: string;
}

export interface Snapshot {
  agents: Agent[];
  bounties: Bounty[];
  activity: Activity[];
  ledger: LedgerEntry[];
  runs: Run[];
  config: AppConfig;
}

export interface RunInput {
  goal: string;
  rewardCents: number;
  idempotencyKey: string;
  shouldFail?: boolean;
}

export const DEFAULT_GOAL = "Analyze the top opportunities for an AI agent marketplace and create a concise market brief with a data visualization specification.";
export const DEFAULT_REWARD_CENTS = 50;
export const ORCHESTRATOR_ID = "11111111-1111-4111-8111-111111111111";
export const WORKER_ID = "22222222-2222-4222-8222-222222222222";
export const RESEARCHER_ID = "33333333-3333-4333-8333-333333333333";

export const BOUNTY_TRANSITIONS: Record<BountyStatus, readonly BountyStatus[]> = {
  funding: ["open", "failed"],
  open: ["claimed", "failed"],
  claimed: ["delivered", "failed"],
  delivered: ["verified", "failed"],
  verified: ["settling", "failed"],
  settling: ["paid"],
  paid: [],
  failed: [],
};

export function canTransition(from: BountyStatus, to: BountyStatus): boolean {
  return BOUNTY_TRANSITIONS[from].includes(to);
}
