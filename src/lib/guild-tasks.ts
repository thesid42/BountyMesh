import { createHash } from "node:crypto";
import { agentDb, checkDb } from "./agent-db";
import { authorize, HttpError, requireSameOrigin } from "./http";

export interface GuildTask {
  id: string; title: string; goal: string; rewardCents: number; idempotencyKey: string; createdAt: string; ownerId: string | null;
  runId?: string | null; status?: string;
}
export interface GuildTaskInput { title: string; goal: string; rewardCents: number; idempotencyKey: string }
export async function authorizeGuildMcp(request: Request): Promise<string | null> {
  requireSameOrigin(request);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token.length > 512) throw new HttpError(401, "Provide a Guild MCP bearer token");
  if (token.startsWith("bm_owner_")) {
    const { data, error } = await agentDb().from("owner_mcp_tokens").select("ownerId").eq("hash", createHash("sha256").update(token).digest("hex")).maybeSingle();
    checkDb(error); if (!data) throw new HttpError(401, "Invalid or revoked Guild MCP token"); return data.ownerId as string;
  }
  authorize(request, true); return null;
}
export async function postGuildTask(ownerId: string | null, task: GuildTaskInput): Promise<GuildTask> {
  const result = await agentDb().rpc("post_guild_task", { p_owner: ownerId, p_task: task });
  if (result.error?.message.includes("Request key already used")) throw new HttpError(409, "This request key belongs to different task details");
  if (result.error?.message.includes("Daily task posting limit")) throw new HttpError(429, "You can post up to 20 tasks per day");
  checkDb(result.error); return result.data as GuildTask;
}
export async function readGuildTask(ownerId: string | null, id: string): Promise<GuildTask> {
  let query = agentDb().from("guild_tasks").select("*").eq("id", id);
  if (ownerId) query = query.eq("ownerId", ownerId);
  const { data, error } = await query.maybeSingle(); checkDb(error);
  if (!data) throw new HttpError(404, "Guild task not found");
  const run = await agentDb().from("runs").select("id,status").eq("idempotencyKey", data.idempotencyKey).maybeSingle(); checkDb(run.error);
  return { ...data, runId: run.data?.id ?? null, status: run.data?.status ?? "posted" } as GuildTask;
}
export async function guildTasks(): Promise<GuildTask[]> {
  const db = agentDb(), rows = await db.from("guild_tasks").select("*").order("createdAt", { ascending: false }).limit(100); checkDb(rows.error);
  if (!rows.data?.length) return [];
  const runs = await db.from("runs").select("id,status,idempotencyKey").in("idempotencyKey", rows.data.map(x => x.idempotencyKey)); checkDb(runs.error);
  return rows.data.map(task => { const run = runs.data?.find(x => x.idempotencyKey === task.idempotencyKey); return { ...task, runId: run?.id ?? null, status: run?.status ?? "posted" } as GuildTask; });
}
