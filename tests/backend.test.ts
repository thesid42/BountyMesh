import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ORCHESTRATOR_ID, WORKER_ID, type Bounty, type Run } from "../src/lib/contracts";
import { addActivity, claimBounty, createBounty, createRun, getSnapshot, recordHold, releaseBounty, settleBounty, transitionBounty } from "../src/lib/repository";
import { authorize, HttpError, readRunInput } from "../src/lib/http";
import { runWork } from "../src/lib/engine";

async function inFreshState(fn: () => Promise<void>) {
  const previous = process.cwd(); const dir = await mkdtemp(join(tmpdir(), "bountymesh-test-"));
  process.chdir(dir); process.env.BOUNTYMESH_MODE = "demo";
  try { await fn(); } finally { process.chdir(previous); await rm(dir, { recursive: true, force: true }); }
}
async function seededBounty() {
  const stamp = new Date().toISOString(); const id = randomUUID();
  const run: Run = { id, goal: "Prepare a useful market brief", status: "running", rewardCents: 50, idempotencyKey: randomUUID(), error: null, createdAt: stamp, updatedAt: stamp };
  await createRun(run);
  const bounty: Bounty = { id: randomUUID(), runId: id, title: "Market brief task", description: "Prepare a short brief and a chart plan for decision makers.", rewardCents: 50, status: "funding", workerId: null, escrowStatus: "unfunded", deliverable: null, similarity: null, review: null, paymentIntentId: null, transferId: null, createdAt: stamp, updatedAt: stamp };
  await createBounty(bounty); await recordHold(bounty.id, `demo_pi_${bounty.id}`, "demo");
  return { run, bounty };
}

test("concurrent claims are serialized and only one worker can claim", async () => inFreshState(async () => {
  const { bounty } = await seededBounty();
  const [first, second] = await Promise.all([claimBounty(bounty.id, WORKER_ID, 0.88), claimBounty(bounty.id, "33333333-3333-4333-8333-333333333333", 0.71)]);
  assert.equal(Number(Boolean(first)) + Number(Boolean(second)), 1);
  assert.equal((await getSnapshot()).bounties[0].status, "claimed");
}));

test("settlement is idempotent and credits the worker once", async () => inFreshState(async () => {
  const { bounty } = await seededBounty();
  await claimBounty(bounty.id, WORKER_ID, 0.88);
  await transitionBounty(bounty.id, "claimed", "delivered", { deliverable: { summary: "A compact result summary.", content: "A sufficiently detailed market brief and visualization description for review.", kind: "markdown" } });
  await transitionBounty(bounty.id, "delivered", "verified", { review: "The task is complete and the chart specification is clear." });
  await transitionBounty(bounty.id, "verified", "settling");
  const result = await settleBounty(bounty.id, `demo_pi_${bounty.id}`, "demo", `demo_tr_${bounty.id}`);
  await settleBounty(bounty.id, `demo_pi_${bounty.id}`, "demo", `demo_tr_${bounty.id}`);
  const snapshot = await getSnapshot(); const worker = snapshot.agents.find((agent) => agent.id === WORKER_ID)!;
  assert.equal(result.status, "paid"); assert.equal(worker.balanceCents, 50); assert.equal(worker.earnedCents, 50);
  assert.equal(snapshot.ledger.filter((entry) => entry.bountyId === bounty.id && entry.kind === "payout").length, 1);
}));

test("same-origin mutation authorization and run input validation reject unsafe requests", async () => inFreshState(async () => {
  const request = new Request("http://localhost:3000/api/runs", { method: "POST", headers: { origin: "http://attacker.invalid" } });
  assert.throws(() => authorize(request, true), (error) => error instanceof HttpError && error.status === 403);
  const forwarded = new Request("http://localhost:3000/api/runs", { method: "POST", headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" } });
  assert.doesNotThrow(() => authorize(forwarded, true));
  const badJson = new Request("http://localhost:3000/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: "{bad" });
  await assert.rejects(readRunInput(badJson), (error) => error instanceof HttpError && error.status === 400);
  const badInput = new Request("http://localhost:3000/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal: "tiny", rewardCents: 50, idempotencyKey: randomUUID() }) });
  await assert.rejects(readRunInput(badInput), (error) => error instanceof HttpError && error.status === 400);
  const valid = new Request("http://localhost:3000/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal: "Prepare a market research brief", rewardCents: 50, idempotencyKey: randomUUID() }) });
  assert.equal((await readRunInput(valid)).rewardCents, 50);
  assert.equal(ORCHESTRATOR_ID, "11111111-1111-4111-8111-111111111111");
}));

test("live reads require the configured operator bearer token", async () => inFreshState(async () => {
  const previousMode = process.env.BOUNTYMESH_MODE; const previousToken = process.env.OPERATOR_TOKEN;
  process.env.BOUNTYMESH_MODE = "live"; process.env.OPERATOR_TOKEN = "unit-test-operator-secret";
  try {
    const missing = new Request("https://service.example/api/state");
    assert.throws(() => authorize(missing), (error) => error instanceof HttpError && error.status === 401);
    const authorized = new Request("https://service.example/api/state", { headers: { authorization: "Bearer unit-test-operator-secret" } });
    assert.doesNotThrow(() => authorize(authorized));
  } finally {
    if (previousMode === undefined) delete process.env.BOUNTYMESH_MODE; else process.env.BOUNTYMESH_MODE = previousMode;
    if (previousToken === undefined) delete process.env.OPERATOR_TOKEN; else process.env.OPERATOR_TOKEN = previousToken;
  }
}));

test("failed work returns a held demo balance through an idempotent refund", async () => inFreshState(async () => {
  const { bounty } = await seededBounty();
  await releaseBounty(bounty.id, `demo_pi_${bounty.id}`, "demo", "worker quality check failed");
  await releaseBounty(bounty.id, `demo_pi_${bounty.id}`, "demo", "retry");
  const snapshot = await getSnapshot();
  assert.equal(snapshot.bounties[0].status, "failed");
  assert.equal(snapshot.agents.find((agent) => agent.id === ORCHESTRATOR_ID)?.balanceCents, 1000);
  assert.equal(snapshot.ledger.filter((entry) => entry.bountyId === bounty.id && entry.kind === "refund").length, 1);
}));

test("demo run executes its full lifecycle and repeated key does not pay twice", async () => inFreshState(async () => {
  const input = { goal: "Prepare a short market brief with a chart plan", rewardCents: 50, idempotencyKey: randomUUID() };
  const [first, concurrent] = await Promise.all([runWork(input), runWork(input)]);
  const retry = await runWork(input);
  assert.equal(first.status, "completed"); assert.equal(concurrent.status, "completed"); assert.equal(retry.status, "completed");
  const snapshot = await getSnapshot();
  assert.equal(snapshot.runs.length, 1); assert.equal(snapshot.bounties.length, 1); assert.equal(snapshot.bounties[0].status, "paid");
  assert.equal(snapshot.ledger.filter((entry) => entry.kind === "payout").length, 1);
  await assert.rejects(runWork({ ...input, rewardCents: 100 }), (error) => error instanceof HttpError && error.status === 409);
}));

