import { directory, ownerAgents, registerAgent } from "@/lib/agent-registry";
import { requireOwner, setOwnerCookies } from "@/lib/owner-auth";
import { readJsonBody, requireSameOrigin, safeError } from "@/lib/http";
export const runtime = "nodejs";
const headers = { "cache-control": "no-store" };
export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("mine") === "1") {
      const owner = await requireOwner(request);
      const response = Response.json(await ownerAgents(owner.user.id), { headers });
      return owner.session ? setOwnerCookies(response, request, owner.session) : response;
    }
    return Response.json({ agents: await directory() }, { headers });
  } catch (error) { const e = safeError(error); return Response.json({ error: e.message }, { status: e.status, headers }); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const owner = await requireOwner(request), body = await readJsonBody(request);
    const response = Response.json(await registerAgent(owner.user, body), { status: 201, headers });
    return owner.session ? setOwnerCookies(response, request, owner.session) : response;
  } catch (error) { const e = safeError(error); return Response.json({ error: e.message }, { status: e.status, headers }); }
}
