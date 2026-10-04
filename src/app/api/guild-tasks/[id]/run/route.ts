import { readGuildTask } from "@/lib/guild-tasks";
import { authorize, safeError } from "@/lib/http";
import { runWork } from "@/lib/engine";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    authorize(request, true);
    const { id } = await context.params, task = await readGuildTask(null, id);
    const run = await runWork({ goal: task.goal, rewardCents: task.rewardCents, idempotencyKey: task.idempotencyKey });
    return Response.json({ run }, { headers: { "cache-control": "no-store" } });
  } catch (error) { const e = safeError(error); return Response.json({ error: e.message }, { status: e.status, headers: { "cache-control": "no-store" } }); }
}
