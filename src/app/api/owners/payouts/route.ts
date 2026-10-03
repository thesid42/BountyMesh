import { agentDb, checkDb } from "@/lib/agent-db";
import { testStripe, syncPayoutAccount } from "@/lib/agent-registry";
import { requireOwner, setOwnerCookies } from "@/lib/owner-auth";
import { readJsonBody, requireSameOrigin, safeError, HttpError } from "@/lib/http";
import Stripe from "stripe";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const owner = await requireOwner(request), body = await readJsonBody(request), db = agentDb();
    let result: Record<string, unknown>;
    if (body.action === "refresh") result = await syncPayoutAccount(owner.user.id);
    else if (body.action === "connect") {
      const existing = await db.from("agent_owners").select("stripeAccountId").eq("id", owner.user.id).maybeSingle(); checkDb(existing.error);
      if (!existing.data) throw new HttpError(409, "Register your first agent before setting up payouts");
      const stripe = testStripe(); let accountId: string = existing.data.stripeAccountId;
      if (!accountId) {
        const account = await stripe.accounts.create({ email: owner.user.email, controller: { fees: { payer: "application" }, losses: { payments: "application" }, stripe_dashboard: { type: "express" } }, capabilities: { transfers: { requested: true } }, metadata: { bountymeshOwnerId: owner.user.id } }, { idempotencyKey: `bm_owner_account_${owner.user.id}` });
        accountId = account.id;
        checkDb((await db.from("agent_owners").update({ stripeAccountId: accountId }).eq("id", owner.user.id).is("stripeAccountId", null)).error);
      }
      const origin = new URL(request.url).origin;
      const link = await stripe.accountLinks.create({ account: accountId, type: "account_onboarding", refresh_url: `${origin}/agents?payout=refresh`, return_url: `${origin}/agents?payout=return` });
      result = { url: link.url };
    } else throw new HttpError(400, "Choose connect or refresh");
    const response = Response.json(result, { headers: { "cache-control": "no-store" } });
    return owner.session ? setOwnerCookies(response, request, owner.session) : response;
  } catch (error) {
    const setupBlocked = error instanceof Stripe.errors.StripeInvalidRequestError && /losses collector|losses_collector|negative balances/i.test(error.message);
    const e = safeError(setupBlocked ? new HttpError(503, "Stripe has not enabled this platform to create payout accounts for separate charges and transfers. Complete the loss-liability acknowledgement in Stripe Settings → Connect → Platform profile, then retry payout setup.") : error);
    return Response.json({ error: e.message }, { status: e.status, headers: { "cache-control": "no-store" } });
  }
}
