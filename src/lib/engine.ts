import { randomUUID, createHash } from "node:crypto";
import Stripe from "stripe";
import { getConfig, getEnv } from "./config";
import { HttpError } from "./http";
import { DEFAULT_REWARD_CENTS, ORCHESTRATOR_ID, type Bounty, type Run, type RunInput, type Snapshot } from "./contracts";
import { acquireRunLease, addActivity, claimBounty, createBounty, createRun, getBountyByRunId, getSnapshot, matchAgents, recordHold, releaseBounty, releaseRunLease, settleBounty, transitionBounty, updateRun } from "./repository";
import { embedText, planBounty, produceDeliverable, reviewDeliverable } from "./providers/models";

const active = new Map<string, { goal: string; rewardCents: number; promise: Promise<Run> }>();
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const stableKey = (prefix: string, id: string) => `${prefix}_${createHash("sha256").update(id).digest("hex").slice(0, 32)}`;
function shortError(error: unknown): string { return error instanceof Error ? error.message.slice(0, 350) : "The run failed unexpectedly"; }
async function log(runId: string, bountyId: string | null, type: Parameters<typeof addActivity>[0]["type"], message: string, actorId: string | null = null) {
  await addActivity({ runId, bountyId, type, message, actorId });
}

async function stripeClient(): Promise<Stripe> {
  const key = getEnv("STRIPE_SECRET_KEY");
  if (!/^sk_test_|^rk_test_/.test(key)) throw new Error("Live mode requires a Stripe test secret key");
  return new Stripe(key, { timeout: 20_000, maxNetworkRetries: 1 });
}
async function createHold(bounty: Bounty): Promise<string> {
  if (getConfig().payments !== "stripe") return `demo_pi_${bounty.id}`;
  const stripe = await stripeClient();
  const pi = await stripe.paymentIntents.create({ amount: bounty.rewardCents, currency: "usd", payment_method: getEnv("STRIPE_PAYMENT_METHOD_ID") || "pm_card_visa", confirm: true, off_session: true, capture_method: "manual", description: `BountyMesh escrow ${bounty.id}`, metadata: { bountyId: bounty.id, runId: bounty.runId } }, { idempotencyKey: stableKey("bm_hold", bounty.id) });
  if (pi.livemode || pi.status !== "requires_capture" || pi.amount !== bounty.rewardCents || pi.currency !== "usd" || pi.capture_method !== "manual") throw new Error("Stripe did not create a valid test-mode escrow hold");
  return pi.id;
}
async function settleStripe(bounty: Bounty): Promise<{ reference: string; transferId: string | null }> {
  if (getConfig().payments !== "stripe") return { reference: bounty.paymentIntentId ?? `demo_pi_${bounty.id}`, transferId: `demo_tr_${bounty.id}` };
  if (!bounty.paymentIntentId || !bounty.workerId) throw new Error("Escrow or worker details are missing");
  const stripe = await stripeClient(); let pi = await stripe.paymentIntents.retrieve(bounty.paymentIntentId);
  if (pi.livemode || pi.amount !== bounty.rewardCents || pi.currency !== "usd") throw new Error("Stripe intent does not match the test-mode bounty amount");
  if (pi.status === "requires_capture") pi = await stripe.paymentIntents.capture(pi.id, {}, { idempotencyKey: stableKey("bm_capture", bounty.id) });
  if (pi.status !== "succeeded") throw new Error(`Escrow capture is not complete (status ${pi.status})`);
  const charge = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
  if (!charge) throw new Error("Captured payment has no charge to fund the transfer");
  const transfer = await stripe.transfers.create({ amount: bounty.rewardCents, currency: "usd", destination: getEnv("STRIPE_CONNECTED_ACCOUNT_ID"), source_transaction: charge, description: `BountyMesh payout ${bounty.id}`, metadata: { bountyId: bounty.id, runId: bounty.runId, workerId: bounty.workerId } }, { idempotencyKey: stableKey("bm_transfer", bounty.id) });
  return { reference: pi.id, transferId: transfer.id };
}
async function cancelHold(bounty: Bounty): Promise<void> {
  if (getConfig().payments !== "stripe" || !bounty.paymentIntentId) return;
  const stripe = await stripeClient(); const pi = await stripe.paymentIntents.retrieve(bounty.paymentIntentId);
  if (pi.status === "requires_capture") await stripe.paymentIntents.cancel(pi.id, {}, { idempotencyKey: stableKey("bm_release", bounty.id) });
  else if (pi.status !== "canceled") throw new Error("Stripe escrow can no longer be safely released");
}
async function progress(run: Run, bounty: Bounty, goal: string, shouldFail = false): Promise<Bounty> {
  let b = bounty;
  if (b.status === "funding") {
    if (getConfig().payments === "stripe" && Date.now() - Date.parse(b.updatedAt) > 23 * 60 * 60 * 1000) throw new Error("Funding requires operator review because the Stripe retry window may have expired");
    const reference = await createHold(b);
    b = await recordHold(b.id, reference, getConfig().payments);
    await log(run.id, b.id, "funding", `Escrow hold confirmed for $${(b.rewardCents / 100).toFixed(2)}.`, ORCHESTRATOR_ID);
  }
  if (getConfig().mode === "demo") await pause(500);
  if (b.status === "open") {
    const vec = getConfig().mode === "live" ? await embedText(`${b.title}\n${b.description}`) : [0.45, 0.22, 0.38, 0.16, 0.51, 0.2, 0.37, 0.31];
    await log(run.id, b.id, "matching", "Matching the bounty to workers by skill fit.");
    const matches = await matchAgents(vec, 3); if (!matches.length) throw new Error("No eligible worker agents are available");
    const selected = matches[0];
    b = await claimBounty(b.id, selected.agent.id, selected.similarity) ?? b;
    if (b.status !== "claimed") throw new Error("The bounty was claimed by another worker");
    await log(run.id, b.id, "claim", `${selected.agent.name} claimed the task with ${Math.round(selected.similarity * 100)}% skill similarity.`, selected.agent.id);
  }
  if (getConfig().mode === "demo") await pause(500);
  if (b.status === "claimed") {
    const deliverable = getConfig().mode === "demo"
      ? (shouldFail
          ? {
              summary: `Cryptographic proof and benchmark audit for: ${goal.slice(0, 100)}`,
              kind: "markdown" as const,
              content: `## Cryptographic Proof & Financial Benchmark Audit\n\n- Signature Proof: FAILED (Truncated hash block: 0x8f2a...invalid)\n- Cosine Alignment: 38% (Under required threshold: 85%)\n- Benchmark Tables: Hallucinated data detected in columns B-D.\n\n## Verification Note\n\nArtifact fails automated verification rubric criteria 2, 4, and 5. Escrow release denied.`,
            }
          : { summary: `A focused brief and visualization plan for: ${goal.slice(0, 100)}`, kind: "markdown" as const, content: `## Research brief\n\nThis demo assignment turns the requested goal into a compact research brief. It identifies the decision to support, the audience, and the evidence that should be gathered before publication.\n\n## Visualization specification\n\n- **Chart:** horizontal ranked bar chart, with one bar per opportunity.\n- **Measures:** estimated market demand, execution effort, and confidence; show confidence in a separate column.\n- **Encoding:** sort by demand-to-effort ratio and use a restrained accent color for the top three.\n- **Caveat:** populate values from cited, current sources before using this as a factual market estimate.\n\n## Suggested next step\n\nCollect comparable evidence for each opportunity, record source dates, then replace the illustrative ranking with measured values.` })
      : await produceDeliverable(goal, b.description);
    b = await transitionBounty(b.id, "claimed", "delivered", { deliverable });
    await log(run.id, b.id, "delivery", "Worker submitted a text deliverable and visualization specification.", b.workerId);
  }
  if (getConfig().mode === "demo") await pause(500);
  if (b.status === "delivered") {
    if (shouldFail) {
      const failedReview = "RUBRIC FAILED: Score 34/100 · Missing evidence and failed cryptographic proof. Escrow payout denied.";
      await log(run.id, b.id, "verification", failedReview, ORCHESTRATOR_ID);
      throw new Error(`Quality review failed: ${failedReview}`);
    }
    const review = getConfig().mode === "demo" ? "The deliverable addresses the assigned task, distinguishes assumptions from verified evidence, and includes a usable visualization specification." : await reviewDeliverable(goal, b.description, b.deliverable!);
    b = await transitionBounty(b.id, "delivered", "verified", { review });
    await log(run.id, b.id, "verification", review, ORCHESTRATOR_ID);
  }
  if (b.status === "verified") {
    b = await transitionBounty(b.id, "verified", "settling");
    await log(run.id, b.id, "payment", "Quality review passed; settlement has started.", ORCHESTRATOR_ID);
  }
  if (b.status === "settling") {
    const settlementAge = Date.now() - Date.parse(b.updatedAt);
    if (getConfig().payments === "stripe" && !b.transferId && settlementAge > 23 * 60 * 60 * 1000) throw new Error("Settlement requires operator review because the Stripe retry window may have expired");
    const result = await settleStripe(b);
    b = await settleBounty(b.id, result.reference, getConfig().payments, result.transferId);
    await log(run.id, b.id, "payment", `Payout completed for $${(b.rewardCents / 100).toFixed(2)}.`, b.workerId);
  }
  return b;
}

async function processRun(input: RunInput, run: Run): Promise<Run> {
  const timestamp = new Date().toISOString();
  if (run.goal !== input.goal) throw new Error("This idempotency key was already used for a different goal");
  let bounty = await getBountyByRunId(run.id);
  if (run.rewardCents !== undefined && run.rewardCents !== input.rewardCents) throw new HttpError(409, "This idempotency key was already used with a different reward");
  if (run.status === "failed" && run.error?.includes("escrow release needs operator attention")) return run;
  if (bounty && bounty.rewardCents !== input.rewardCents) throw new Error("This idempotency key was already used with a different reward");
  if (bounty?.status === "paid") { if (run.status !== "completed") await updateRun(run.id, "completed"); return { ...run, status: "completed", error: null }; }
  if (bounty?.status === "failed") return run;
  if (!bounty) {
    try {
      await log(run.id, null, "planning", "The orchestrator is planning a focused subcontract.", ORCHESTRATOR_ID);
      const plan = getConfig().mode === "demo" ? { title: "Market opportunity brief & chart plan", description: `Research one focused part of this goal: ${input.goal}. Deliver a concise evidence plan and a chart specification that helps a decision-maker compare relevant options. State assumptions and do not claim live research.` } : await planBounty(input.goal);
      bounty = { id: randomUUID(), runId: run.id, title: plan.title, description: plan.description, rewardCents: input.rewardCents || DEFAULT_REWARD_CENTS, status: "funding", workerId: null, escrowStatus: "unfunded", deliverable: null, similarity: null, review: null, paymentIntentId: null, transferId: null, createdAt: timestamp, updatedAt: timestamp };
      bounty = await createBounty(bounty);
      await log(run.id, bounty.id, "planning", `Created bounty: ${bounty.title}.`, ORCHESTRATOR_ID);
    } catch (error) {
      await updateRun(run.id, "failed", "The orchestrator could not create the task plan.");
      try { await log(run.id, null, "error", "The orchestrator could not create the task plan."); } catch { /* retain original failure */ }
      return { ...run, status: "failed", error: "The orchestrator could not create the task plan.", updatedAt: new Date().toISOString() };
    }
  }
  if (run.status !== "running") { await updateRun(run.id, "running"); run = { ...run, status: "running", error: null }; }
  try {
    bounty = await progress(run, bounty, input.goal, Boolean(input.shouldFail));
    if (bounty.status !== "paid") throw new Error("Bounty processing did not reach a paid state");
    await updateRun(run.id, "completed");
    return { ...run, status: "completed", error: null, updatedAt: new Date().toISOString() };
  } catch (error) {
    const message = shortError(error);
    // Once settlement starts, retain it for an idempotent recovery attempt; never issue a competing refund.
    try { bounty = await getBountyByRunId(run.id) ?? bounty; } catch { /* preserve the last durable state observed */ }
    if (bounty.status === "paid") {
      try { await updateRun(run.id, "completed"); } catch { /* payout is durable; a later request can repair run status */ }
      return { ...run, status: "completed", error: null, updatedAt: new Date().toISOString() };
    }
    let releaseNeedsReview = false;
    if (bounty.status !== "settling" && !(bounty.status === "funding" && getConfig().mode === "live")) {
      try {
        await cancelHold(bounty);
        await releaseBounty(bounty.id, bounty.paymentIntentId ?? `demo_pi_${bounty.id}`, getConfig().payments, message);
      } catch (releaseError) { releaseNeedsReview = true; await log(run.id, bounty.id, "error", "The run failed and escrow release needs operator attention."); }
    }
    const reviewRequired = message.includes("operator review");
    const publicError = releaseNeedsReview
      ? "The run failed; escrow release needs operator attention."
      : bounty.status === "settling"
        ? (reviewRequired ? "Settlement needs operator review before it can be retried." : "Settlement is pending recovery. Retry with the same idempotency key.")
        : bounty.status === "funding"
          ? (reviewRequired ? "Funding needs operator review before it can be retried." : "Funding did not complete. Retry with the same idempotency key.")
          : (message.includes("Quality review failed") ? message : "The run failed; any confirmed escrow was released.");
    await log(run.id, bounty.id, "error", publicError);
    await updateRun(run.id, "failed", publicError);
    return { ...run, status: "failed", error: publicError, updatedAt: new Date().toISOString() };
  }
}

async function perform(input: RunInput): Promise<Run> {
  if (getConfig().mode === "live" && !getConfig().ready) throw new Error(`Live mode is not configured: ${getConfig().missing.join(", ")}`);
  const timestamp = new Date().toISOString();
  const proposed: Run = { id: randomUUID(), goal: input.goal, status: "running", rewardCents: input.rewardCents, idempotencyKey: input.idempotencyKey, error: null, createdAt: timestamp, updatedAt: timestamp };
  const run = await createRun(proposed);
  if (run.goal !== input.goal) throw new HttpError(409, "This idempotency key was already used for a different goal");
  const owner = randomUUID();
  if (!await acquireRunLease(run.id, owner, 600)) throw new HttpError(409, "This run is already in progress; retry with the same idempotency key");
  try { return await processRun(input, run); }
  finally { try { await releaseRunLease(run.id, owner); } catch (error) { console.error("BountyMesh run lease release failed", error); } }
}

export async function runWork(input: RunInput): Promise<Run> {
  const existing = active.get(input.idempotencyKey);
  if (existing) {
    if (existing.goal !== input.goal || existing.rewardCents !== input.rewardCents) throw new HttpError(409, "This idempotency key is already running with different inputs");
    return existing.promise;
  }
  const promise = perform(input);
  const entry = { goal: input.goal, rewardCents: input.rewardCents, promise };
  active.set(input.idempotencyKey, entry);
  try { return await promise; } finally { if (active.get(input.idempotencyKey) === entry) active.delete(input.idempotencyKey); }
}
export { getSnapshot };
export type { RunInput, Snapshot };
