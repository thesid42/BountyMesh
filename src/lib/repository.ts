import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfig, getEnv } from "./config";
import { canTransition, ORCHESTRATOR_ID, RESEARCHER_ID, WORKER_ID, type Activity, type Agent, type Bounty, type BountyStatus, type LedgerEntry, type Run, type Snapshot } from "./contracts";
import { embedText } from "./providers/models";

interface Store { agents: Agent[]; bounties: Bounty[]; activity: Activity[]; ledger: LedgerEntry[]; runs: Run[] }
const now = () => new Date().toISOString();
const seed: Store = {
  agents: [
    { id: ORCHESTRATOR_ID, name: "Claude Orchestrator", role: "orchestrator", model: getConfig().orchestratorModel, skills: ["planning", "research", "quality review", "market analysis"], balanceCents: 1000, earnedCents: 0, tasksCompleted: 0, status: "online" },
    { id: WORKER_ID, name: "Gemini Researcher", role: "worker", model: getConfig().workerModel, skills: ["data visualization", "market research", "analysis", "report writing"], balanceCents: 0, earnedCents: 0, tasksCompleted: 0, status: "online" },
    { id: RESEARCHER_ID, name: "Specialist Researcher", role: "worker", model: getConfig().workerModel, skills: ["competitive research", "synthesis", "business strategy"], balanceCents: 0, earnedCents: 0, tasksCompleted: 0, status: "online" },
  ], bounties: [], activity: [], ledger: [], runs: [],
};

let localQueue: Promise<unknown> = Promise.resolve();
const localLeases = new Map<string, { owner: string; expiresAt: number }>();
let supabase: SupabaseClient | null = null;
const isSupabase = () => getConfig().storage === "supabase";
function client(): SupabaseClient {
  if (!supabase) {
    const url = getEnv("NEXT_PUBLIC_SUPABASE_URL"); const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Supabase storage is not configured");
    supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return supabase;
}
function statePath() { return join(process.cwd(), ".bountymesh", "state.json"); }
async function readLocal(): Promise<Store> {
  const path = statePath();
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    if (!Array.isArray(parsed.agents) || !Array.isArray(parsed.bounties) || !Array.isArray(parsed.activity) || !Array.isArray(parsed.ledger) || !Array.isArray(parsed.runs)) throw new Error("state file has an invalid shape");
    return parsed as Store;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Unable to read BountyMesh local state", { cause: error });
    await mkdir(join(process.cwd(), ".bountymesh"), { recursive: true });
    await writeFile(path, JSON.stringify(seed, null, 2), { flag: "wx" }).catch(async (writeError: NodeJS.ErrnoException) => { if (writeError.code !== "EEXIST") throw writeError; });
    return readLocal();
  }
}
async function mutate<T>(fn: (state: Store) => T | Promise<T>): Promise<T> {
  const op = localQueue.then(async () => {
    const state = await readLocal(); const result = await fn(state);
    const dir = join(process.cwd(), ".bountymesh"); await mkdir(dir, { recursive: true });
    const temp = join(dir, `.state-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(state, null, 2), { flag: "wx" });
    await rename(temp, statePath());
    return result;
  });
  localQueue = op.then(() => undefined, () => undefined);
  return op;
}
function rpcError(error: { message: string }): never { throw new Error(`Database operation failed: ${error.message}`); }
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(name, args); if (error) rpcError(error); return data as T;
}
function snapshotOf(s: Store): Snapshot { return { ...s, config: getConfig() }; }

export async function getSnapshot(): Promise<Snapshot> {
  if (!isSupabase()) return snapshotOf(await readLocal());
  const db = client();
  const tables = await Promise.all([
    db.from("agents").select("id,name,role,model,skills,balanceCents,earnedCents,tasksCompleted,status,origin,ownerId,description,registrationState,connectionState,minimumRewardCents,lastVerifiedAt").order("name"),
    db.from("bounties").select("id,runId,title,description,rewardCents,status,workerId,escrowStatus,deliverable,similarity,review,paymentIntentId,transferId,createdAt,updatedAt").order("createdAt", { ascending: false }).limit(100),
    db.from("activity").select("*").order("createdAt", { ascending: false }).limit(200), db.from("ledger").select("*").order("createdAt", { ascending: false }).limit(200),
    db.from("runs").select("*").order("createdAt", { ascending: false }).limit(100),
  ]);
  const bad = tables.find((r) => r.error); if (bad?.error) rpcError(bad.error);
  return { agents: tables[0].data as Agent[], bounties: tables[1].data as Bounty[], activity: tables[2].data as Activity[], ledger: tables[3].data as LedgerEntry[], runs: tables[4].data as Run[], config: getConfig() };
}
export async function createRun(run: Run): Promise<Run> {
  if (isSupabase()) return rpc<Run>("create_run", { p_run: run });
  return mutate((s) => { const old = s.runs.find((r) => r.idempotencyKey === run.idempotencyKey); if (old) return old; s.runs.unshift(run); return run; });
}
export async function acquireRunLease(runId: string, owner: string, ttlSeconds = 600): Promise<boolean> {
  if (isSupabase()) return rpc<boolean>("acquire_run", { p_id: runId, p_owner: owner, p_ttl_seconds: ttlSeconds });
  return mutate(() => {
    const current = localLeases.get(runId); const currentTime = Date.now();
    if (current && current.expiresAt > currentTime && current.owner !== owner) return false;
    localLeases.set(runId, { owner, expiresAt: currentTime + ttlSeconds * 1000 }); return true;
  });
}
export async function releaseRunLease(runId: string, owner: string): Promise<void> {
  if (isSupabase()) { await rpc("release_run", { p_id: runId, p_owner: owner }); return; }
  await mutate(() => { if (localLeases.get(runId)?.owner === owner) localLeases.delete(runId); });
}
export async function getBountyByRunId(runId: string): Promise<Bounty | null> {
  if (isSupabase()) {
    const { data, error } = await client().from("bounties").select("*").eq("runId", runId).maybeSingle();
    if (error) rpcError(error); return data as Bounty | null;
  }
  return (await readLocal()).bounties.find((b) => b.runId === runId) ?? null;
}
export async function updateRun(id: string, status: Run["status"], error: string | null = null): Promise<void> {
  if (isSupabase()) { await rpc("update_run", { p_id: id, p_status: status, p_error: error }); return; }
  await mutate((s) => { const r = s.runs.find((x) => x.id === id); if (!r) throw new Error("Run not found"); r.status = status; r.error = error; r.updatedAt = now(); });
}
export async function createBounty(bounty: Bounty): Promise<Bounty> {
  if (isSupabase()) return rpc<Bounty>("create_bounty", { p_bounty: bounty });
  return mutate((s) => { const prior = s.bounties.find((x) => x.runId === bounty.runId); if (prior) return prior; s.bounties.unshift(bounty); return bounty; });
}
export async function transitionBounty(id: string, expected: BountyStatus, next: BountyStatus, patch: Partial<Bounty> = {}): Promise<Bounty> {
  if (!canTransition(expected, next)) throw new Error(`Invalid bounty transition: ${expected} to ${next}`);
  const allowed: Record<string, string[]> = { "claimed:delivered": ["deliverable"], "delivered:verified": ["review"], "verified:settling": [] };
  const key = `${expected}:${next}`;
  if (!(key in allowed) || Object.keys(patch).some((field) => !allowed[key].includes(field))) throw new Error("Unsupported bounty transition or patch");
  if (isSupabase()) return rpc<Bounty>("transition_bounty", { p_id: id, p_expected: expected, p_next: next, p_patch: patch });
  return mutate((s) => { const b = s.bounties.find((x) => x.id === id); if (!b || b.status !== expected) throw new Error("Bounty state changed; transition rejected"); if (next === "delivered" && (!patch.deliverable || !b.workerId || b.escrowStatus !== "held")) throw new Error("Delivery requires a held bounty and an assigned worker"); if (next === "verified" && !patch.review) throw new Error("Verification requires a review"); Object.assign(b, patch, { status: next, updatedAt: now() }); return b; });
}
export async function recordHold(id: string, reference: string, provider: LedgerEntry["provider"]): Promise<Bounty> {
  if (isSupabase()) return rpc<Bounty>("record_hold", { p_id: id, p_reference: reference, p_provider: provider });
  return mutate((s) => {
    const b = s.bounties.find((x) => x.id === id); if (!b) throw new Error("Bounty not found");
    if (s.ledger.some((x) => x.bountyId === id && x.kind === "hold")) return b;
    if (b.status !== "funding") throw new Error("Bounty is not awaiting funding");
    const orchestrator = s.agents.find((a) => a.id === ORCHESTRATOR_ID)!; if (orchestrator.balanceCents < b.rewardCents) throw new Error("Demo escrow balance is insufficient");
    orchestrator.balanceCents -= b.rewardCents;
    s.ledger.unshift({ id: randomUUID(), runId: b.runId, bountyId: id, agentId: ORCHESTRATOR_ID, kind: "hold", amountCents: b.rewardCents, provider, reference, createdAt: now() });
    Object.assign(b, { status: "open" as const, escrowStatus: "held" as const, paymentIntentId: reference, updatedAt: now() }); return b;
  });
}
export async function claimBounty(id: string, workerId: string, similarity: number): Promise<Bounty | null> {
  if (isSupabase()) return rpc<Bounty | null>("claim_bounty", { p_id: id, p_worker: workerId, p_similarity: similarity });
  return mutate((s) => { const b = s.bounties.find((x) => x.id === id); if (!b || b.status !== "open" || b.escrowStatus !== "held") return null; const worker = s.agents.find((x) => x.id === workerId && x.role === "worker"); if (!worker) return null; b.status = "claimed"; b.workerId = workerId; b.similarity = similarity; b.updatedAt = now(); worker.status = "working"; return b; });
}
export async function settleBounty(id: string, reference: string, provider: LedgerEntry["provider"], transferId: string | null): Promise<Bounty> {
  if (isSupabase()) return rpc<Bounty>("settle_bounty", { p_id: id, p_reference: reference, p_provider: provider, p_transfer_id: transferId });
  return mutate((s) => {
    const b = s.bounties.find((x) => x.id === id); if (!b) throw new Error("Bounty not found");
    if (b.status === "paid" && s.ledger.some((x) => x.bountyId === id && x.kind === "payout")) return b;
    if (b.status !== "settling" || !b.workerId || !b.deliverable || b.escrowStatus !== "held") throw new Error("Bounty is not ready to settle");
    if (!s.ledger.some((x) => x.bountyId === id && x.kind === "hold" && x.provider === provider)) throw new Error("A matching escrow hold was not found");
    if (provider === "stripe" && !transferId) throw new Error("Stripe payout receipt is required");
    if (!s.ledger.some((x) => x.bountyId === id && x.kind === "payout")) {
      const worker = s.agents.find((x) => x.id === b.workerId); if (!worker) throw new Error("Worker not found");
      worker.balanceCents += b.rewardCents; worker.earnedCents += b.rewardCents; worker.tasksCompleted += 1; worker.status = "online";
      s.ledger.unshift({ id: randomUUID(), runId: b.runId, bountyId: id, agentId: b.workerId, kind: "payout", amountCents: b.rewardCents, provider, reference, createdAt: now() });
    }
    b.status = "paid"; b.escrowStatus = "settled"; b.transferId = transferId; b.updatedAt = now(); return b;
  });
}
export async function releaseBounty(id: string, reference: string, provider: LedgerEntry["provider"], reason: string): Promise<Bounty> {
  if (isSupabase()) return rpc<Bounty>("release_bounty", { p_id: id, p_reference: reference, p_provider: provider, p_reason: reason });
  return mutate((s) => {
    const b = s.bounties.find((x) => x.id === id); if (!b) throw new Error("Bounty not found");
    if (b.status === "failed" && s.ledger.some((x) => x.bountyId === id && x.kind === "refund")) return b;
    if (b.status === "settling" || b.status === "paid") throw new Error("A settlement may be in progress and cannot be released");
    if (b.status !== "failed") { if (!canTransition(b.status, "failed")) throw new Error("Bounty cannot be failed"); b.status = "failed"; }
    if (b.escrowStatus === "held" && !s.ledger.some((x) => x.bountyId === id && x.kind === "refund")) {
      const orchestrator = s.agents.find((a) => a.id === ORCHESTRATOR_ID)!; orchestrator.balanceCents += b.rewardCents;
      s.ledger.unshift({ id: randomUUID(), runId: b.runId, bountyId: id, agentId: ORCHESTRATOR_ID, kind: "refund", amountCents: b.rewardCents, provider, reference, createdAt: now() });
      b.escrowStatus = "released";
    }
    b.review = reason; b.updatedAt = now(); if (b.workerId) { const worker = s.agents.find((a) => a.id === b.workerId); if (worker) worker.status = "online"; } return b;
  });
}
export async function addActivity(activity: Omit<Activity, "id" | "createdAt"> & Partial<Pick<Activity, "id" | "createdAt">>): Promise<Activity> {
  const row: Activity = { ...activity, id: activity.id ?? randomUUID(), createdAt: activity.createdAt ?? now() };
  if (isSupabase()) { const { error } = await client().from("activity").insert(row); if (error) rpcError(error); return row; }
  return mutate((s) => { s.activity.unshift(row); return row; });
}
export async function matchAgents(query: number[], count = 3): Promise<Array<{ agent: Agent; similarity: number }>> {
  if (isSupabase()) {
    const { data: workers, error } = await client().from("agents").select("id,skills,embedding").eq("role", "worker");
    if (error) rpcError(error);
    for (const agent of workers ?? []) {
      if (!agent.embedding) {
        const vector = await embedText((agent.skills as string[]).join(", "));
        const { error: updateError } = await client().from("agents").update({ embedding: vector }).eq("id", agent.id);
        if (updateError) rpcError(updateError);
      }
    }
    const rows = await rpc<Array<Agent & { similarity: number }>>("match_agents", { query_embedding: query, match_count: count });
    return rows.map(({ similarity, ...agent }) => ({ agent: agent as Agent, similarity }));
  }
  const weights: Record<string, number[]> = { [WORKER_ID]: [0.93, 0.78, 0.91, 0.87, 0.73, 0.84, 0.96, 0.79], [RESEARCHER_ID]: [0.68, 0.92, 0.86, 0.71, 0.94, 0.82, 0.75, 0.89] };
  const all = await readLocal();
  return all.agents.filter((a) => a.role === "worker").map((agent) => {
    const features = weights[agent.id] ?? [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7];
    const score = features.reduce((sum, x, i) => sum + x * (query[i] ?? 0), 0) / Math.max(0.01, Math.sqrt(query.reduce((s, x) => s + x * x, 0) * features.reduce((s, x) => s + x * x, 0)));
    return { agent, similarity: Number(Math.min(0.99, score).toFixed(3)) };
  }).sort((a, b) => b.similarity - a.similarity).slice(0, count);
}

export function subscribeSupabaseChanges(supabaseClient: SupabaseClient, onChange: () => void): () => void {
  const channel = supabaseClient.channel("bountymesh-snapshot-stream-" + randomUUID())
    .on("postgres_changes", { event: "*", schema: "public", table: "activity" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "bounties" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "ledger" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, onChange)
    .subscribe();
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    void supabaseClient.removeChannel(channel).catch(() => undefined);
  };
}

export function subscribeChanges(onChange: () => void): () => void {
  if (!isSupabase()) return () => undefined;
  return subscribeSupabaseChanges(client(), onChange);
}
