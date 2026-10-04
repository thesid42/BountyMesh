import { agentDb, checkDb } from "@/lib/agent-db";
import { syncPayoutAccount, testStripe } from "@/lib/agent-registry";
import { getEnv } from "@/lib/config";
import { HttpError, safeError } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const secret = getEnv("STRIPE_WEBHOOK_SECRET"), signature = request.headers.get("stripe-signature");
    if (!secret) throw new HttpError(503, "Stripe webhook is not configured");
    if (!signature || !request.body) throw new HttpError(400, "Missing Stripe signature");
    const reader = request.body.getReader(), chunks: Uint8Array[] = []; let total = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; total += value.byteLength; if (total > 65_536) { await reader.cancel(); throw new HttpError(413, "Webhook is too large"); } chunks.push(value); }
    let event; try { event = testStripe().webhooks.constructEvent(Buffer.concat(chunks), signature, secret); } catch { throw new HttpError(400, "Invalid Stripe signature"); }
    if (!event.livemode && event.type === "account.updated") {
      const owner = await agentDb().from("agent_owners").select("id").eq("stripeAccountId", event.data.object.id).maybeSingle(); checkDb(owner.error);
      // Retrieve current state so out-of-order events cannot restore old eligibility.
      if (owner.data) await syncPayoutAccount(owner.data.id);
    }
    return Response.json({ received: true });
  } catch (error) { const e = safeError(error); return Response.json({ error: e.message }, { status: e.status }); }
}
