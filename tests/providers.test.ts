import assert from "node:assert/strict";
import test from "node:test";
import { embedText, planBounty, produceDeliverable, reviewDeliverable } from "../src/lib/providers/models";

test("provider responses are validated without contacting provider accounts", async (t) => {
  const savedFetch = globalThis.fetch;
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  process.env.ANTHROPIC_API_KEY = "fixture-anthropic-key";
  process.env.GEMINI_API_KEY = "fixture-gemini-key";
  t.after(() => {
    globalThis.fetch = savedFetch;
    if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
  });
  const goal = "Compare specialist agent opportunities for a startup.";
  const deliverable = { summary: "A concise comparison of useful agent opportunities.", kind: "markdown" as const, content: "Research requires comparable source evidence. A horizontal bar chart should compare demand, cost, and uncertainty for the relevant opportunities." };
  function respond(body: unknown, status = 200) {
    globalThis.fetch = async () => Response.json(body, { status });
  }
  await t.test("valid structured plans and deliverables are accepted", async () => {
    respond({ content: [{ type: "text", text: JSON.stringify({ title: "Specialist opportunity brief", description: "Compare candidate specialist roles and propose a useful chart specification." }) }] });
    assert.equal((await planBounty(goal)).title, "Specialist opportunity brief");
    respond({ candidates: [{ content: { parts: [{ text: JSON.stringify(deliverable) }] } }] });
    assert.deepEqual(await produceDeliverable(goal, "Create a comparison brief."), deliverable);
  });
  await t.test("a rejected review cannot authorize settlement", async () => {
    respond({ content: [{ type: "text", text: JSON.stringify({ approved: false, review: "The response does not address the requested comparison." }) }] });
    await assert.rejects(reviewDeliverable(goal, "Compare roles.", deliverable), /Quality review failed/);
  });
  await t.test("malformed output and executable formats are rejected", async () => {
    respond({ candidates: [{ content: { parts: [{ text: "not structured JSON" }] } }] });
    await assert.rejects(produceDeliverable(goal, "Create a brief."), /invalid structured output/);
    respond({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...deliverable, kind: "javascript" }) }] } }] });
    await assert.rejects(produceDeliverable(goal, "Create a brief."), /unsupported deliverable format/);
  });
  await t.test("embeddings must have the schema's 768 finite dimensions", async () => {
    const values = Array.from({ length: 768 }, (_, i) => i === 0 ? 1 : 0);
    respond({ embedding: { values } });
    assert.deepEqual(await embedText("data visualization research"), values);
    respond({ embedding: { values: [1, 0, 0] } });
    await assert.rejects(embedText("data visualization research"), /invalid vector/);
  });
  await t.test("provider errors do not disclose provider response bodies", async () => {
    respond({ error: "private provider debug context" }, 429);
    await assert.rejects(planBounty(goal), (error: unknown) => error instanceof Error && error.message === "Anthropic provider returned HTTP 429");
  });
});
