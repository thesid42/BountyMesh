import { ownedAgent, setAgentAvailability, verifyAgent } from "@/lib/agent-registry";
import { agentDb, checkDb } from "@/lib/agent-db";
import { encryptCredential, endpointUrl } from "@/lib/agent-connector";
import { requireOwner, setOwnerCookies } from "@/lib/owner-auth";
import { readJsonBody, requireSameOrigin, safeError, HttpError } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const owner = await requireOwner(request), { id } = await context.params, body = await readJsonBody(request);
    let result: unknown = { saved: true };
    if (body.action === "verify") result = await verifyAgent(owner.user.id, id);
    else if (body.action === "activate" || body.action === "pause") await setAgentAvailability(owner.user.id, id, body.action === "activate");
    else if (body.action === "connection") {
      const agent = await ownedAgent(owner.user.id, id);
      if (agent.status === "working") throw new HttpError(409, "Wait for the current task to finish before editing the connection");
      const endpoint = endpointUrl(body.endpoint).href;
      if (typeof body.token !== "string" || body.token.length < 16 || body.token.length > 512 || /[\s\x00-\x1f\x7f]/.test(body.token)) throw new HttpError(400, "Connection token must contain 16 to 512 characters without whitespace");
      const updated = await agentDb().rpc("update_agent_connection", { p_owner: owner.user.id, p_id: id, p_endpoint: endpoint, p_credential: encryptCredential(body.token, id) });
      if (updated.error?.message.includes("active task")) throw new HttpError(409, "Wait for the current task to finish");
      checkDb(updated.error);
    } else throw new HttpError(400, "Choose verify, activate, pause, or connection");
    const response = Response.json(result, { headers: { "cache-control": "no-store" } });
    return owner.session ? setOwnerCookies(response, request, owner.session) : response;
  } catch (error) { const e = safeError(error); return Response.json({ error: e.message }, { status: e.status, headers: { "cache-control": "no-store" } }); }
}
