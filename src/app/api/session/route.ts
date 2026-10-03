import { createOperatorSession, safeError } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const cookie = createOperatorSession(request);
    const headers: Record<string, string> = { "cache-control": "no-store" };
    if (cookie) headers["set-cookie"] = cookie;
    return Response.json({ authenticated: true }, { headers });
  } catch (error) {
    const result = safeError(error);
    return Response.json({ error: result.message }, { status: result.status, headers: { "cache-control": "no-store" } });
  }
}
