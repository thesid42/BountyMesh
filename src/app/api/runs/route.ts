import { runWork, getSnapshot } from "@/lib/engine";
import { authorize, readRunInput, safeError } from "@/lib/http";
import { getBountyByRunId } from "@/lib/repository";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    authorize(request, true);
    const input = await readRunInput(request);
    const run = await runWork(input);
    const [snapshot, bounty] = await Promise.all([getSnapshot(), getBountyByRunId(run.id)]);
    const canStartNewRequest = run.status === "failed"
      && !/operator|review|attention/i.test(run.error ?? "")
      && (!bounty || (bounty.status === "failed" && ["released", "unfunded"].includes(bounty.escrowStatus)));
    return Response.json({ run, bounty, canStartNewRequest, snapshot }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const result = safeError(error);
    return Response.json({ error: result.message }, { status: result.status, headers: { "cache-control": "no-store" } });
  }
}
