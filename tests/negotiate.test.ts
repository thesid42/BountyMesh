import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { WORKER_ID, type Bounty, type Run } from "../src/lib/contracts";
import { claimBounty, createBounty, createRun, recordHold } from "../src/lib/repository";
import { POST } from "../src/app/api/negotiate/route";
import { synthesizeNegotiationVoice } from "../src/lib/negotiation-audio";

async function withLocalFixture(fn: () => Promise<void>) {
  const cwd = process.cwd();
  const dir = await mkdtemp(join(tmpdir(), "bountymesh-negotiate-"));
  const names = ["NODE_ENV", "BOUNTYMESH_TEST_FIXTURES", "BOUNTYMESH_MODE"];
  const old = names.map((name) => process.env[name]);
  process.chdir(dir);
  const fixture: Record<string, string> = { NODE_ENV: "test", BOUNTYMESH_TEST_FIXTURES: "local", BOUNTYMESH_MODE: "demo" };
  Object.entries(fixture).forEach(([key, value]) => { process.env[key] = value; });
  try { await fn(); } finally {
    process.chdir(cwd);
    names.forEach((name, index) => old[index] === undefined ? delete process.env[name] : process.env[name] = old[index]!);
    await rm(dir, { recursive: true, force: true });
  }
}

async function savedRun() {
  const stamp = new Date().toISOString();
  const run: Run = { id: randomUUID(), idempotencyKey: randomUUID(), goal: "Prepare a persisted market brief for review", rewardCents: 50, status: "running", error: null, createdAt: stamp, updatedAt: stamp };
  const bounty: Bounty = { id: randomUUID(), runId: run.id, title: "Market brief", description: "A concise analysis and data visualization task.", rewardCents: 50, status: "funding", workerId: null, escrowStatus: "unfunded", deliverable: null, similarity: null, review: null, paymentIntentId: null, transferId: null, createdAt: stamp, updatedAt: stamp };
  await createRun(run);
  await createBounty(bounty);
  await recordHold(bounty.id, `fixture-hold-${bounty.id}`, "demo");
  await claimBounty(bounty.id, WORKER_ID, 0.823);
  return { run, bounty };
}

test("negotiate rejects an unauthorized request before parsing or calling providers", async () => withLocalFixture(async () => {
  const saved = [process.env.BOUNTYMESH_MODE, process.env.OPERATOR_TOKEN];
  process.env.BOUNTYMESH_MODE = "live";
  process.env.OPERATOR_TOKEN = "negotiate-test-token";
  try {
    const response = await POST(new Request("http://localhost:3000/api/negotiate", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" },
      body: "{ malformed JSON",
    }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Operator authorization required" });
  } finally {
    if (saved[0] === undefined) delete process.env.BOUNTYMESH_MODE; else process.env.BOUNTYMESH_MODE = saved[0];
    if (saved[1] === undefined) delete process.env.OPERATOR_TOKEN; else process.env.OPERATOR_TOKEN = saved[1];
  }
}));

test("missing online configuration rejects narration before storage or provider access", async () => withLocalFixture(async () => {
  const saved = [process.env.BOUNTYMESH_MODE, process.env.OPERATOR_TOKEN];
  const integrationKeys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_CONNECTED_ACCOUNT_ID"];
  const priorIntegrationKeys = integrationKeys.map((key) => process.env[key]);
  process.env.BOUNTYMESH_MODE = "live";
  process.env.OPERATOR_TOKEN = "negotiate-test-token";
  integrationKeys.forEach((key) => { process.env[key] = ""; });
  try {
    const response = await POST(new Request("http://localhost:3000/api/negotiate", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000", authorization: "Bearer negotiate-test-token", "content-type": "application/json" },
      body: JSON.stringify({ runId: randomUUID(), synthesizeAudio: true }),
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "The connected online workspace is not fully configured" });
  } finally {
    if (saved[0] === undefined) delete process.env.BOUNTYMESH_MODE; else process.env.BOUNTYMESH_MODE = saved[0];
    if (saved[1] === undefined) delete process.env.OPERATOR_TOKEN; else process.env.OPERATOR_TOKEN = saved[1];
    integrationKeys.forEach((key, index) => priorIntegrationKeys[index] === undefined ? delete process.env[key] : process.env[key] = priorIntegrationKeys[index]!);
  }
}));

test("narration uses only persisted run, worker, match, and escrow facts without invoking providers", async () => withLocalFixture(async () => {
  const { run } = await savedRun();
  const response = await POST(new Request("http://localhost:3000/api/negotiate", {
    method: "POST",
    headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" },
    body: JSON.stringify({ idempotencyKey: run.idempotencyKey }),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  const text = result.turns.map((turn: { text: string }) => turn.text).join(" ");
  assert.match(text, /Gemini Researcher/);
  assert.match(text, /82\.3% recorded similarity/);
  assert.match(text, /hold is recorded/);
  assert.doesNotMatch(text, /A \$0\.50 payout is recorded|transfer receipt/);
  assert.equal(result.audioStatus, "not-requested");
}));

test("negotiate refuses client-authored task text and requires an existing run identifier", async () => withLocalFixture(async () => {
  const response = await POST(new Request("http://localhost:3000/api/negotiate", {
    method: "POST",
    headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" },
    body: JSON.stringify({ goal: "pretend task", rewardCents: 500, synthesizeAudio: false }),
  }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /persisted run identifiers/);
}));

test("optional narration audio uses the server key header and accepts bounded WAV clips", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/wav", data: "UklGRg==" } }] } }] });
  };
  const clip = await synthesizeNegotiationVoice("Payout status recorded.", "Kore", "server-only-test-key", fakeFetch);
  assert.deepEqual(clip, { data: "UklGRg==", mimeType: "audio/wav" });
  assert.match(requestedUrl, /gemini-3\.8-flash-tts:generateContent$/);
  assert.doesNotMatch(requestedUrl, /key=/i);
  assert.equal(new Headers(requestedInit?.headers).get("x-goog-api-key"), "server-only-test-key");
  const payload = JSON.parse(String(requestedInit?.body));
  assert.deepEqual(payload.generationConfig.speechConfig.voiceConfig, { voice: "Kore" });
  assert.equal(payload.contents[0].parts[0].text, "Payout status recorded.");
  assert.equal(await synthesizeNegotiationVoice("x".repeat(241), "Kore", "server-only-test-key", fakeFetch), null);
});
