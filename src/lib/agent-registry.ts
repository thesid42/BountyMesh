import { createHash, randomBytes, randomUUID } from "node:crypto";
import Stripe from "stripe";
import type { Agent, Bounty, Deliverable } from "./contracts";
import type { User } from "@supabase/supabase-js";
import { agentDb, checkDb } from "./agent-db";
import { callAgent, decryptCredential, encryptCredential, endpointUrl, parseAgentDeliverable } from "./agent-connector";
import { getEnv } from "./config";
import { HttpError } from "./http";
import { embedText } from "./providers/models";

export const AGENT_PROTOCOL = "bountymesh-agent/v1";
const publicFields = "id,name,role,model,skills,description,origin,status,tasksCompleted,registrationState,connectionState,minimumRewardCents,lastVerifiedAt,ownerId,agent_owners(name)";
export async function directory() {
  const { data, error } = await agentDb().from("agents").select(publicFields).eq("registrationState", "active").order("name").limit(200);
  checkDb(error);
  return (data ?? []).map(row => {
    const { ownerId: _private, agent_owners, ...agent } = row;
    const relation = agent_owners as unknown as { name: string } | null;
    return { ...agent, ownerName: relation?.name ?? "BountyMesh" };
  });
}
export async function ownerAgents(ownerId: string) {
  const db = agentDb();
  const { data, error } = await db.from("agents").select("id,name,role,model,skills,description,origin,status,tasksCompleted,registrationState,connectionState,minimumRewardCents,lastVerifiedAt,balanceCents,earnedCents,agent_connections(endpoint,lastCheckAt,lastError)").eq("ownerId", ownerId).order("name");
  checkDb(error);
  const owner = await db.from("agent_owners").select("stripeAccountId,transfersEnabled,payoutsEnabled").eq("id", ownerId).maybeSingle(); checkDb(owner.error);
  return { agents: data ?? [], payouts: owner.data ?? { stripeAccountId: null, transfersEnabled: false, payoutsEnabled: false } };
}
export async function ownedAgent(ownerId: string, agentId: string): Promise<Agent> {
  if (!/^[\da-f-]{36}$/i.test(agentId)) throw new HttpError(400, "Invalid agent ID");
  const { data, error } = await agentDb().from("agents").select("*").eq("id", agentId).eq("ownerId", ownerId).maybeSingle();
  checkDb(error); if (!data) throw new HttpError(404, "Agent not found"); return data as Agent;
}
function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new HttpError(400, `${label} must contain ${min} to ${max} characters`);
  return value.trim();
}
export async function registerAgent(user: User, body: Record<string, unknown>) {
  const name = text(body.name, "Name", 2, 60), description = text(body.description, "Description", 16, 500), model = text(body.model, "Model or framework", 2, 80);
  const skills = Array.isArray(body.skills) ? [...new Set(body.skills.map(x => text(x, "Skill", 2, 40)))] : [];
  if (skills.length < 1 || skills.length > 8) throw new HttpError(400, "Choose one to eight skills");
  const minimumRewardCents = body.minimumRewardCents;
  if (!Number.isInteger(minimumRewardCents) || (minimumRewardCents as number) < 50 || (minimumRewardCents as number) > 500) throw new HttpError(400, "Minimum reward must be 50 to 500 cents");
  const endpoint = endpointUrl(body.endpoint).href;
  const id = text(body.registrationKey, "Registration key", 36, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(400, "Registration key must be a UUID");
  // Only per-agent connector tokens belong here; owners retain their model API keys.
  const token = text(body.token, "Connection token", 16, 512);
  if (/[\s\x00-\x1f\x7f]/.test(token)) throw new HttpError(400, "Connection tokens cannot contain spaces or control characters");
  const ownerName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.slice(0, 60).trim() || "Agent owner" : "Agent owner";
  const fingerprint = createHash("sha256").update(JSON.stringify({ name, description, model, skills, minimumRewardCents, endpoint, token })).digest("hex");
  const result = await agentDb().rpc("register_external_agent", { p_owner: user.id, p_owner_name: ownerName, p_agent: { id, name, description, model, skills, minimumRewardCents, fingerprint }, p_endpoint: endpoint, p_credential: encryptCredential(token, id) });
  if (result.error?.message.includes("Registration key already used")) throw new HttpError(409, "Registration details changed. Start a new registration or edit the saved agent.");
  if (result.error?.message.includes("Maximum ten agents")) throw new HttpError(409, "You can register up to ten agents");
  checkDb(result.error); return { id: result.data as string };
}
export async function verifyAgent(ownerId: string, agentId: string) {
  const agent = await ownedAgent(ownerId, agentId);
  if (agent.status === "working") throw new HttpError(409, "Wait for the active task to complete");
  const db = agentDb(), now = new Date().toISOString();
  // Compare-and-set throttles repeated and concurrent verification requests.
  const reserved = await db.from("agent_connections").update({ lastCheckAt: now }).eq("agentId", agentId).or(`lastCheckAt.is.null,lastCheckAt.lt.${new Date(Date.now() - 60_000).toISOString()}`).select("endpoint,credential").maybeSingle();
  checkDb(reserved.error); if (!reserved.data) throw new HttpError(429, "Wait one minute before checking this connection again");
  try {
    const challenge = randomBytes(24).toString("base64url"), taskId = randomUUID();
    const data = await callAgent(reserved.data.endpoint, decryptCredential(reserved.data.credential, agentId), { protocol: AGENT_PROTOCOL, type: "verification", taskId, challenge, goal: "Describe your registered skills and explain the limits of your text deliverables. This is an unpaid connection check.", task: { title: "Agent connection check", description: `Registered skills: ${agent.skills.join(", ")}. Return a short Markdown report.`, rewardCents: 0 } }, taskId);
    if (data.protocol !== AGENT_PROTOCOL || data.challenge !== challenge || data.taskId !== taskId) throw new HttpError(502, "Agent did not return the verification challenge and task ID");
    const deliverable = parseAgentDeliverable(data.deliverable);
    const embedding = await embedText(`${agent.name}\n${agent.description}\n${agent.skills.join(", ")}`);
    const completed = await db.rpc("finish_agent_check", { p_owner: ownerId, p_id: agentId, p_credential: reserved.data.credential, p_checked_at: now, p_embedding: embedding, p_error: null });
    checkDb(completed.error); if (!completed.data) throw new HttpError(409, "The connection changed during verification. Check the new connection again.");
    return { verified: true, deliverable };
  } catch (error) {
    const message = error instanceof HttpError ? error.message : "Connection check failed. Check your endpoint and token.";
    checkDb((await db.rpc("finish_agent_check", { p_owner: ownerId, p_id: agentId, p_credential: reserved.data.credential, p_checked_at: now, p_embedding: null, p_error: message })).error);
    throw new HttpError(502, message);
  }
}
export function testStripe() {
  const key = getEnv("STRIPE_SECRET_KEY"); if (!/^(sk|rk)_test_/.test(key)) throw new HttpError(503, "Stripe test mode is not configured");
  return new Stripe(key, { timeout: 20_000, maxNetworkRetries: 1 });
}
export async function syncPayoutAccount(ownerId: string) {
  const db = agentDb(), owner = await db.from("agent_owners").select("stripeAccountId").eq("id", ownerId).maybeSingle(); checkDb(owner.error);
  if (!owner.data?.stripeAccountId) throw new HttpError(409, "Connect your Stripe payout account first");
  const account = await testStripe().accounts.retrieve(owner.data.stripeAccountId);
  if (account.deleted) throw new HttpError(409, "Payout account is unavailable");
  const ready = account.capabilities?.transfers === "active" && account.payouts_enabled;
  checkDb((await db.from("agent_owners").update({ transfersEnabled: account.capabilities?.transfers === "active", payoutsEnabled: account.payouts_enabled }).eq("id", ownerId)).error);
  return { ready };
}
export async function setAgentAvailability(ownerId: string, agentId: string, active: boolean) {
  const agent = await ownedAgent(ownerId, agentId);
  if (active) {
    if (agent.connectionState !== "verified") throw new HttpError(409, "Verify the live connection before activation");
    if (!(await syncPayoutAccount(ownerId)).ready) throw new HttpError(409, "Finish Stripe onboarding before taking paid work");
  }
  let update = agentDb().from("agents").update({ registrationState: active ? "active" : "paused" }).eq("id", agentId).eq("ownerId", ownerId);
  if (active) update = update.eq("connectionState", "verified");
  const result = await update.select("id").maybeSingle(); checkDb(result.error);
  if (!result.data) throw new HttpError(409, "Connection changed. Verify it before activation.");
}
export async function executeRegisteredWorker(bounty: Bounty, goal: string): Promise<Deliverable | null> {
  const db = agentDb(), worker = await db.from("agents").select("origin").eq("id", bounty.workerId).single(); checkDb(worker.error);
  if (!worker.data) throw new HttpError(409, "Assigned agent is unavailable");
  if (worker.data.origin === "platform") return null;
  if (!bounty.payoutDestination) throw new HttpError(409, "External agent payout destination is missing");
  const connection = await db.from("agent_connections").select("endpoint,credential").eq("agentId", bounty.workerId).single(); checkDb(connection.error);
  if (!connection.data) throw new HttpError(409, "Assigned agent connection is unavailable");
  try {
    const data = await callAgent(connection.data.endpoint, decryptCredential(connection.data.credential, bounty.workerId!), { protocol: AGENT_PROTOCOL, type: "task", taskId: bounty.id, goal, task: { title: bounty.title, description: bounty.description, rewardCents: bounty.rewardCents } }, bounty.id);
    if (data.protocol !== AGENT_PROTOCOL || data.taskId !== bounty.id) throw new HttpError(502, "Agent response does not match the assigned task");
    return parseAgentDeliverable(data.deliverable);
  } catch (error) {
    await db.from("agents").update({ connectionState: "unreachable" }).eq("id", bounty.workerId);
    throw error;
  }
}
