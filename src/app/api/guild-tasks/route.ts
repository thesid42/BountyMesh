import { guildTasks } from "@/lib/guild-tasks";
import { authorize, safeError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { authorize(request); return Response.json({ tasks: await guildTasks() }, { headers: { "cache-control": "no-store" } }); }
  catch (error) { const e = safeError(error); return Response.json({ error: e.message }, { status: e.status, headers: { "cache-control": "no-store" } }); }
}
