import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { ORCHESTRATOR_ID, RESEARCHER_ID, WORKER_ID, type Bounty, type Run } from "../src/lib/contracts";

test("Supabase migration and transactional bounty guarantees", async (t) => {
  const db = new PGlite({ extensions: { vector } });
  t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  await db.exec(schema);
  await db.exec(schema); // Applying the initial schema twice must preserve balances.
  const timestamp = new Date().toISOString();
  const run: Run = { id: randomUUID(), goal: "Compare the most useful specialist agent opportunities.", rewardCents: 50, status: "running", idempotencyKey: randomUUID(), error: null, createdAt: timestamp, updatedAt: timestamp };
  const bounty: Bounty = { id: randomUUID(), runId: run.id, title: "Opportunity comparison", description: "Prepare a concise brief with a comparison chart specification.", rewardCents: 50, status: "funding", workerId: null, escrowStatus: "unfunded", deliverable: null, similarity: null, review: null, paymentIntentId: null, transferId: null, createdAt: timestamp, updatedAt: timestamp };
  async function scalar<T>(sql: string, args: unknown[] = []): Promise<T> {
    const result = await db.query<{ value: T }>(sql, args);
    return result.rows[0].value;
  }
  await scalar("select public.create_run($1::jsonb) as value", [JSON.stringify(run)]);
  await scalar("select public.create_bounty($1::jsonb) as value", [JSON.stringify(bounty)]);

  await t.test("run keys are bound to the goal and reward", async () => {
    const replay = await scalar<Run>("select public.create_run($1::jsonb) as value", [JSON.stringify({ ...run, id: randomUUID() })]);
    assert.equal(replay.id, run.id);
    await assert.rejects(scalar("select public.create_run($1::jsonb) as value", [JSON.stringify({ ...run, rewardCents: 100 })]), /different reward/);
    await assert.rejects(scalar("select public.create_run($1::jsonb) as value", [JSON.stringify({ ...run, goal: "A completely different valid goal." })]), /different goal/);
  });
  await t.test("durable execution leases have a single owner", async () => {
    const owner = randomUUID();
    const competitor = randomUUID();
    assert.equal(await scalar("select public.acquire_run($1,$2) as value", [run.id, owner]), true);
    assert.equal(await scalar("select public.acquire_run($1,$2) as value", [run.id, competitor]), false);
    await db.query("select public.release_run($1,$2)", [run.id, competitor]);
    assert.equal(await scalar("select public.acquire_run($1,$2) as value", [run.id, competitor]), false);
    await db.query("select public.release_run($1,$2)", [run.id, owner]);
    assert.equal(await scalar("select public.acquire_run($1,$2) as value", [run.id, competitor]), true);
  });
  await t.test("funding requires a recorded hold and Stripe does not mint platform balance", async () => {
    await assert.rejects(scalar("select public.transition_bounty($1,'funding','open') as value", [bounty.id]), /dedicated/);
    const funded = await scalar<Bounty>("select public.record_hold($1,'pi_test_hold','stripe') as value", [bounty.id]);
    assert.equal(funded.status, "open");
    await scalar("select public.record_hold($1,'pi_test_hold','stripe') as value", [bounty.id]);
    assert.equal(await scalar("select count(*)::int as value from public.ledger where kind='hold'"), 1);
    assert.equal(await scalar('select "balanceCents" as value from public.agents where id=$1', [ORCHESTRATOR_ID]), 0);
  });
  await t.test("competing workers produce exactly one claim", async () => {
    const claims = await Promise.all([
      scalar<Bounty | null>("select public.claim_bounty($1,$2,0.92) as value", [bounty.id, WORKER_ID]),
      scalar<Bounty | null>("select public.claim_bounty($1,$2,0.81) as value", [bounty.id, RESEARCHER_ID]),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(claims.find(Boolean)?.workerId, WORKER_ID);
  });
  await t.test("delivery verification and transfer receipt precede one atomic payout", async () => {
    await assert.rejects(scalar("select public.transition_bounty($1,'claimed','paid') as value", [bounty.id]), /Invalid bounty transition/);
    await assert.rejects(scalar("select public.transition_bounty($1,'claimed','delivered') as value", [bounty.id]), /Deliverable required/);
    await scalar("select public.transition_bounty($1,'claimed','delivered',$2::jsonb) as value", [bounty.id, JSON.stringify({ deliverable: { kind: "markdown", summary: "Useful analysis", content: "A comparison brief and visualization specification." }, rewardCents: 500 })]);
    assert.equal(await scalar('select "rewardCents" as value from public.bounties where id=$1', [bounty.id]), 50);
    await scalar("select public.transition_bounty($1,'delivered','verified',$2::jsonb) as value", [bounty.id, JSON.stringify({ review: "Approved after checking the scope and assumptions." })]);
    await scalar("select public.transition_bounty($1,'verified','settling') as value", [bounty.id]);
    await assert.rejects(scalar("select public.settle_bounty($1,'pi_test_hold','stripe') as value", [bounty.id]), /transfer receipt/);
    await assert.rejects(scalar("select public.release_bounty($1,'pi_test_hold','stripe','failed') as value", [bounty.id]), /cannot be automatically released/);
    const paid = await scalar<Bounty>("select public.settle_bounty($1,'pi_test_hold','stripe','tr_test_receipt') as value", [bounty.id]);
    assert.equal(paid.status, "paid");
    await scalar("select public.settle_bounty($1,'pi_test_hold','stripe','tr_test_receipt') as value", [bounty.id]);
    assert.equal(await scalar("select count(*)::int as value from public.ledger where kind='payout'"), 1);
    assert.equal(await scalar('select "earnedCents" as value from public.agents where id=$1', [WORKER_ID]), 50);
    assert.equal(await scalar('select "tasksCompleted" as value from public.agents where id=$1', [WORKER_ID]), 1);
    await scalar("select public.update_run($1,'completed') as value", [run.id]);
  });
  await t.test("pgvector ranks real 768-dimensional vectors", async () => {
    const first = Array.from({ length: 768 }, (_, i) => i === 0 ? 1 : 0);
    const second = Array.from({ length: 768 }, (_, i) => i === 1 ? 1 : 0);
    await db.query("update public.agents set embedding=$1::extensions.vector where id=$2", [JSON.stringify(first), WORKER_ID]);
    await db.query("update public.agents set embedding=$1::extensions.vector where id=$2", [JSON.stringify(second), RESEARCHER_ID]);
    const result = await db.query<{ id: string; similarity: number }>("select id,similarity from public.match_agents($1::extensions.vector,2)", [JSON.stringify(first)]);
    assert.equal(result.rows[0].id, WORKER_ID);
    assert.equal(result.rows[0].similarity, 1);
  });
  await t.test("untrusted roles cannot read balances or invoke payment functions", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        await assert.rejects(db.query("select * from public.ledger"), /permission denied/);
        await assert.rejects(db.query("select public.claim_bounty($1,$2,0.8)", [bounty.id, WORKER_ID]), /permission denied/);
      } finally { await db.exec("reset role"); }
    }
  });
});
