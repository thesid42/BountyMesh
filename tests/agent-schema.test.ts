import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { ORCHESTRATOR_ID } from "../src/lib/contracts";

test("owner registry migration enforces isolation, eligibility and task idempotency", async t => {
  const db = new PGlite({ extensions: { vector } }); t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;");
  await db.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
  const migration = await readFile(new URL("../supabase/migrations/20261003_agent_onboarding.sql", import.meta.url), "utf8");
  await db.exec(migration); await db.exec(migration);
  async function scalar<T>(sql: string, args: unknown[] = []): Promise<T> { return (await db.query<{ value: T }>(sql,args)).rows[0].value; }
  const owner = randomUUID(), other = randomUUID(), id = randomUUID(), embedding = JSON.stringify(Array.from({length:768}, (_,i) => i===0 ? 1 : 0));
  await db.query("insert into auth.users(id) values($1),($2)", [owner,other]);
  const profile = { id, name:"Owner Research Agent", description:"Actual hosted worker for bounded analysis.", model:"Owner framework", skills:["analysis"], minimumRewardCents:50, fingerprint:"registration-fingerprint" };
  const register = (who: string, p = profile) => scalar<string>("select public.register_external_agent($1,'Test owner',$2::jsonb,'https://agent.example/tasks','encrypted-token') as value", [who,JSON.stringify(p)]);
  assert.equal(await register(owner), id); assert.equal(await register(owner), id);
  await assert.rejects(register(other), /Registration key already used/);
  await assert.rejects(register(owner, { ...profile, fingerprint:"different-details" }), /Registration key already used/);
  assert.equal(await scalar('select "balanceCents" as value from public.agents where id=$1',[ORCHESTRATOR_ID]),0);
  await db.query('insert into public.agent_owners(id,name) values($1,$2)',[other,"Other owner"]);
  await t.test("drafts, disconnected accounts and paused workers cannot get matched", async () => {
    await db.query('update public.agents set embedding=$1::extensions.vector where id=$2',[embedding,id]);
    assert.equal((await db.query("select id from public.match_agents($1::extensions.vector,10)",[embedding])).rows.length,0);
    await db.query('update public.agents set "registrationState"=\'active\',"connectionState"=\'verified\' where id=$1',[id]);
    assert.equal((await db.query("select id from public.match_agents($1::extensions.vector,10)",[embedding])).rows.length,0);
    await db.query('update public.agent_owners set "stripeAccountId"=\'acct_owner_test\',"transfersEnabled"=true,"payoutsEnabled"=true where id=$1',[owner]);
    assert.equal((await db.query<{id:string}>("select id from public.match_agents($1::extensions.vector,10)",[embedding])).rows[0].id,id);
    await db.query('update public.agents set "registrationState"=\'paused\' where id=$1',[id]);
    assert.equal((await db.query("select id from public.match_agents($1::extensions.vector,10)",[embedding])).rows.length,0);
  });
  await t.test("an old verification cannot bless an edited connection", async () => {
    const checked = new Date().toISOString();
    await db.query('update public.agent_connections set "lastCheckAt"=$1 where "agentId"=$2',[checked,id]);
    await assert.rejects(db.query("select public.update_agent_connection($1,$2,'https://new.example/tasks','new-encrypted-token')",[other,id]), /Agent not found/);
    await db.query("select public.update_agent_connection($1,$2,'https://new.example/tasks','new-encrypted-token')",[owner,id]);
    assert.equal(await scalar("select public.finish_agent_check($1,$2,'encrypted-token',$3,$4::extensions.vector,null) as value",[owner,id,checked,embedding]),false);
    assert.equal(await scalar('select "connectionState" as value from public.agents where id=$1',[id]),"unverified");
  });
  await t.test("owners see only their agents and cannot read stored credentials", async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]); await db.exec("set role authenticated");
    try { assert.equal((await db.query("select id from public.agents")).rows.length,1); await assert.rejects(db.query("select * from public.agent_connections"),/permission denied/); await assert.rejects(db.query("select public.post_guild_task(null,'{}')"),/permission denied/); } finally { await db.exec("reset role"); }
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]); await db.exec("set role authenticated");
    try { assert.equal((await db.query("select id from public.agents")).rows.length,0); } finally { await db.exec("reset role"); }
  });
  await t.test("MCP posting creates one task without holding funds and rejects changed retries", async () => {
    const task = { title:"Live integration check", goal:"Compare the owner onboarding options.", rewardCents:50, idempotencyKey:randomUUID() };
    const post = (who: string, value = task) => scalar<{id:string}>("select public.post_guild_task($1,$2::jsonb) as value",[who,JSON.stringify(value)]);
    const posted = await post(owner); assert.equal((await post(owner)).id,posted.id);
    await assert.rejects(post(owner,{...task,rewardCents:100}),/different task details/);
    await assert.rejects(post(other),/different task details/);
    assert.equal(await scalar("select count(*)::int as value from public.guild_tasks"),1);
    assert.equal(await scalar("select count(*)::int as value from public.ledger"),0);
    for(let i=0;i<19;i++) await post(owner,{...task,idempotencyKey:randomUUID()});
    await assert.rejects(post(owner,{...task,idempotencyKey:randomUUID()}),/Daily task posting limit/);
  });
});
