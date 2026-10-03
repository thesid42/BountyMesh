import { getSnapshot } from "@/lib/engine";
import { authorize, safeError } from "@/lib/http";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try { authorize(request); return Response.json(await getSnapshot(), { headers: { "cache-control": "no-store" } }); }
  catch (error) { const result = safeError(error); return Response.json({ error: result.message }, { status: result.status, headers: { "cache-control": "no-store" } }); }
}
