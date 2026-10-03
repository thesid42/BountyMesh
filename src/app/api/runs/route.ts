import { runWork, getSnapshot } from "@/lib/engine";
import { authorize, readRunInput, safeError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    authorize(request, true);
    const input = await readRunInput(request);
    const run = await runWork(input);
    const snapshot = await getSnapshot();
    return Response.json({ run, snapshot }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const result = safeError(error);
    return Response.json({ error: result.message }, { status: result.status, headers: { "cache-control": "no-store" } });
  }
}
