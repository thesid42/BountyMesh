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
  let lastRequestBody: Record<string, any> | null = null;
  function respond(body: unknown, status = 200) {
    globalThis.fetch = async (_input, init) => {
      lastRequestBody = init?.body ? JSON.parse(String(init.body)) as Record<string, any> : null;
      return Response.json(body, { status });
    };
  }
  await t.test("valid structured plans and deliverables are accepted", async () => {
    respond({ content: [{ type: "text", text: JSON.stringify({ title: "Specialist opportunity brief", description: "Compare candidate specialist roles and propose a useful chart specification." }) }] });
    assert.equal((await planBounty(goal)).title, "Specialist opportunity brief");
    assert.equal(lastRequestBody?.max_tokens, 1200);
    assert.deepEqual(lastRequestBody?.output_config?.format, {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "8–120 characters" },
          description: { type: "string", description: "20–1800 characters" },
        },
        required: ["title", "description"],
        additionalProperties: false,
      },
    });
    respond({ candidates: [{ content: { parts: [{ text: JSON.stringify(deliverable) }] } }] });
    assert.deepEqual(await produceDeliverable(goal, "Create a comparison brief."), deliverable);
  });
  await t.test("planner accepts bounded full-length plans and rejects oversized descriptions", async () => {
    const description = ("Create a concise market research brief with an evidence table and visualization specification. " + "Include comparable criteria, assumptions, and limitations. ".repeat(20)).slice(0, 1230);
    respond({ content: [{ type: "text", text: JSON.stringify({ title: "Specialist opportunity brief", description }) }] });
    assert.equal((await planBounty(goal)).description.length, 1230);

    respond({ content: [{ type: "text", text: JSON.stringify({ title: "Specialist opportunity brief", description: "d".repeat(1801) }) }] });
    await assert.rejects(planBounty(goal), /invalid task description/);
  });
  await t.test("planner parse diagnostics expose only allowlisted metadata", async () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => { warnings.push(args); };
    const providerText = "private provider output that is not JSON";
    const privateGoal = "private user goal that must not be logged";
    try {
      respond({ stop_reason: "end_turn", content: [{ type: "text", text: providerText }, { type: "internal_secret_type", secret: "provider body" }] });
      await assert.rejects(planBounty(privateGoal), /invalid structured output/);
    } finally {
      console.warn = originalWarn;
    }
    assert.equal(warnings.length, 1);
    const warningText = JSON.stringify(warnings[0]);
    assert.match(warningText, /end_turn/);
    assert.match(warningText, /textLength/);
    assert.match(warningText, /contentBlockTypes/);
    assert.doesNotMatch(warningText, /private provider output|private user goal|provider body|internal_secret_type/);
  });
  await t.test("a rejected review cannot authorize settlement", async () => {
    respond({ content: [{ type: "text", text: JSON.stringify({ approved: false, review: "The response does not address the requested comparison." }) }] });
    await assert.rejects(reviewDeliverable(goal, "Compare roles.", deliverable), /Quality review failed/);
    assert.deepEqual(lastRequestBody?.output_config?.format, {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          approved: { type: "boolean", description: "Whether the deliverable satisfies the assigned task" },
          review: { type: "string", description: "10–500 characters" },
        },
        required: ["approved", "review"],
        additionalProperties: false,
      },
    });
  });
  await t.test("planner rejects parseable output marked truncated or refused", async () => {
    const validText = JSON.stringify({ title: "Specialist opportunity brief", description: "Compare candidate roles and propose a chart specification." });
    for (const stopReason of ["max_tokens", "refusal"]) {
      respond({ stop_reason: stopReason, content: [{ type: "text", text: validText }] });
      await assert.rejects(planBounty(goal), /incomplete or refused response/);
    }
    respond({ content: [{ type: "text", text: validText }] });
    assert.equal((await planBounty(goal)).title, "Specialist opportunity brief");
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
