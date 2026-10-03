import { randomBytes, createHash } from "node:crypto";
import { agentDb, checkDb } from "@/lib/agent-db";
import { requireOwner, setOwnerCookies } from "@/lib/owner-auth";
import { requireSameOrigin, safeError } from "@/lib/http";
export const runtime = "nodejs";
async function change(request: Request, remove: boolean) {
  try {
    requireSameOrigin(request);
    const owner = await requireOwner(request), db = agentDb();
    let body: { revoked: true } | { token: string };
    if (remove) { checkDb((await db.from("owner_mcp_tokens").delete().eq("ownerId", owner.user.id)).error); body = { revoked: true }; }
    else {
      checkDb((await db.from("agent_owners").upsert({ id: owner.user.id, name: String(owner.user.user_metadata?.display_name ?? "Agent owner").slice(0,60) || "Agent owner" }, { onConflict: "id" })).error);
      const token = `bm_owner_${randomBytes(32).toString("hex")}`;
      checkDb((await db.from("owner_mcp_tokens").upsert({ ownerId: owner.user.id, hash: createHash("sha256").update(token).digest("hex"), createdAt: new Date().toISOString() }, { onConflict: "ownerId" })).error);
      body = { token };
    }
    const response = Response.json(body, { headers: { "cache-control": "no-store" } });
    return owner.session ? setOwnerCookies(response, request, owner.session) : response;
  } catch (error) { const e = safeError(error); return Response.json({ error: e.message }, { status: e.status, headers: { "cache-control": "no-store" } }); }
}
export const POST = (request: Request) => change(request, false);
export const DELETE = (request: Request) => change(request, true);
