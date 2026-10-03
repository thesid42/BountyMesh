-- BountyMesh schema. Run in the Supabase SQL editor as the project owner.
-- All writes and reads are restricted to the server-side service role.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table if not exists public.agents (
  id uuid primary key,
  name text not null,
  role text not null check (role in ('orchestrator', 'worker')),
  model text not null,
  skills text[] not null default '{}',
  "balanceCents" integer not null default 0 check ("balanceCents" >= 0),
  "earnedCents" integer not null default 0 check ("earnedCents" >= 0),
  "tasksCompleted" integer not null default 0 check ("tasksCompleted" >= 0),
  status text not null default 'online' check (status in ('online', 'working')),
  embedding extensions.vector(768)
);

create table if not exists public.runs (
  id uuid primary key,
  goal text not null check (length(goal) between 10 and 2000),
  "rewardCents" integer not null check ("rewardCents" between 50 and 500),
  status text not null check (status in ('running', 'completed', 'failed')),
  "idempotencyKey" text not null unique,
  error text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.bounties (
  id uuid primary key,
  "runId" uuid not null references public.runs(id),
  title text not null,
  description text not null,
  "rewardCents" integer not null check ("rewardCents" between 50 and 500),
  status text not null check (status in ('funding','open','claimed','delivered','verified','settling','paid','failed')),
  "workerId" uuid references public.agents(id),
  "escrowStatus" text not null default 'unfunded' check ("escrowStatus" in ('unfunded','held','captured','settled','released')),
  deliverable jsonb,
  similarity double precision check (similarity between -1 and 1),
  review text,
  "paymentIntentId" text,
  "transferId" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  embedding extensions.vector(768),
  unique ("runId")
);

create table if not exists public.activity (
  id uuid primary key,
  "runId" uuid not null references public.runs(id),
  "bountyId" uuid references public.bounties(id),
  "actorId" uuid references public.agents(id),
  type text not null check (type in ('system','planning','funding','matching','claim','delivery','verification','payment','error')),
  message text not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.ledger (
  id uuid primary key default gen_random_uuid(),
  "runId" uuid not null references public.runs(id),
  "bountyId" uuid not null references public.bounties(id),
  "agentId" uuid not null references public.agents(id),
  kind text not null check (kind in ('hold','payout','refund')),
  "amountCents" integer not null check ("amountCents" > 0),
  provider text not null check (provider in ('demo','stripe')),
  reference text not null,
  "createdAt" timestamptz not null default now(),
  unique ("bountyId", kind)
);

create index if not exists bounties_status_idx on public.bounties(status);
create index if not exists activity_created_idx on public.activity("createdAt" desc);
create index if not exists ledger_created_idx on public.ledger("createdAt" desc);
create index if not exists runs_created_idx on public.runs("createdAt" desc);

-- Durable ownership prevents two server instances from running/refunding one contract.
create table if not exists public.execution_leases (
  "runId" uuid primary key references public.runs(id),
  owner uuid not null,
  "expiresAt" timestamptz not null
);
alter table public.execution_leases enable row level security;
revoke all on public.execution_leases from anon,authenticated;
grant all on public.execution_leases to service_role;

create or replace function public.acquire_run(p_id uuid,p_owner uuid,p_ttl_seconds integer default 600)
returns boolean language plpgsql security invoker set search_path=public,extensions as $$
declare affected integer;
begin
  insert into public.execution_leases("runId",owner,"expiresAt")
    values(p_id,p_owner,now()+make_interval(secs=>least(greatest(p_ttl_seconds,60),900)))
  on conflict("runId") do update set owner=excluded.owner,"expiresAt"=excluded."expiresAt"
    where public.execution_leases."expiresAt" < now() or public.execution_leases.owner=p_owner;
  get diagnostics affected = row_count;
  return affected=1;
end $$;

create or replace function public.release_run(p_id uuid,p_owner uuid)
returns void language sql security invoker set search_path=public,extensions as $$
  delete from public.execution_leases where "runId"=p_id and owner=p_owner;
$$;
revoke all on function public.acquire_run(uuid,uuid,integer),public.release_run(uuid,uuid) from public,anon,authenticated;
grant execute on function public.acquire_run(uuid,uuid,integer),public.release_run(uuid,uuid) to service_role;

alter table public.agents enable row level security;
alter table public.runs enable row level security;
alter table public.bounties enable row level security;
alter table public.activity enable row level security;
alter table public.ledger enable row level security;
revoke all on public.agents, public.runs, public.bounties, public.activity, public.ledger from anon, authenticated;
grant all on public.agents, public.runs, public.bounties, public.activity, public.ledger to service_role;

-- A retry recovers the original run rather than minting a second bounty.
create or replace function public.create_run(p_run jsonb)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare result public.runs;
begin
  insert into public.runs select (jsonb_populate_record(null::public.runs, p_run)).*
  on conflict ("idempotencyKey") do nothing;
  select * into strict result from public.runs where "idempotencyKey" = p_run->>'idempotencyKey';
  if result.goal <> p_run->>'goal' then raise exception 'Idempotency key belongs to a different goal'; end if;
  if result."rewardCents" <> (p_run->>'rewardCents')::integer then raise exception 'Idempotency key belongs to a different reward'; end if;
  return to_jsonb(result);
end $$;

create or replace function public.create_bounty(p_bounty jsonb)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare result public.bounties;
begin
  insert into public.bounties select (jsonb_populate_record(null::public.bounties, p_bounty)).*
  on conflict ("runId") do nothing;
  select * into strict result from public.bounties where "runId" = (p_bounty->>'runId')::uuid;
  if result."rewardCents" <> (p_bounty->>'rewardCents')::integer then
    raise exception 'Run already has a different reward';
  end if;
  return to_jsonb(result) - 'embedding';
end $$;

-- Compare-and-set transition; identity, reward, and run cannot be patched.
create or replace function public.transition_bounty(p_id uuid, p_expected text, p_next text, p_patch jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare result public.bounties;
begin
  if not ((p_expected = 'funding' and p_next in ('open','failed'))
    or (p_expected = 'open' and p_next in ('claimed','failed'))
    or (p_expected = 'claimed' and p_next in ('delivered','failed'))
    or (p_expected = 'delivered' and p_next in ('verified','failed'))
    or (p_expected = 'verified' and p_next in ('settling','failed'))
    or (p_expected = 'settling' and p_next = 'paid')) then
    raise exception 'Invalid bounty transition';
  end if;
  if p_next in ('open','claimed','paid','failed') then
    raise exception 'Use the dedicated funding, claim, settlement, or release RPC';
  end if;
  if p_next = 'delivered' and (p_patch->'deliverable' is null or p_patch->'deliverable' = 'null'::jsonb) then
    raise exception 'Deliverable required';
  end if;
  update public.bounties set
    status = p_next,
    deliverable = case when p_patch ? 'deliverable' then p_patch->'deliverable' else deliverable end,
    review = case when p_patch ? 'review' then p_patch->>'review' else review end,
    "paymentIntentId" = case when p_patch ? 'paymentIntentId' then p_patch->>'paymentIntentId' else "paymentIntentId" end,
    "transferId" = case when p_patch ? 'transferId' then p_patch->>'transferId' else "transferId" end,
    "escrowStatus" = case when p_patch ? 'escrowStatus' then p_patch->>'escrowStatus' else "escrowStatus" end,
    "updatedAt" = now()
  where id = p_id and status = p_expected returning * into result;
  if not found then raise exception 'Bounty changed concurrently'; end if;
  return to_jsonb(result) - 'embedding';
end $$;

-- A single atomic UPDATE decides the winner of competing worker claims.
create or replace function public.claim_bounty(p_id uuid, p_worker uuid, p_similarity double precision)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare result public.bounties;
begin
  if not exists (select 1 from public.agents where id = p_worker and role = 'worker') then
    raise exception 'Unknown worker';
  end if;
  update public.bounties set status='claimed', "workerId"=p_worker, similarity=p_similarity, "updatedAt"=now()
  where id=p_id and status='open' and "workerId" is null and "escrowStatus"='held' returning * into result;
  if not found then return null; end if;
  update public.agents set status='working' where id=p_worker;
  return to_jsonb(result) - 'embedding';
end $$;

create or replace function public.record_hold(p_id uuid, p_reference text, p_provider text)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare result public.bounties; owner_id uuid := '11111111-1111-4111-8111-111111111111';
begin
  if p_provider not in ('demo','stripe') then raise exception 'Invalid provider'; end if;
  select * into strict result from public.bounties where id=p_id for update;
  if exists (select 1 from public.ledger where "bountyId"=p_id and kind='hold') then
    return to_jsonb(result) - 'embedding';
  end if;
  if result.status <> 'funding' then raise exception 'Bounty is not awaiting funding'; end if;
  if p_provider='demo' then
    update public.agents set "balanceCents"="balanceCents"-result."rewardCents"
    where id=owner_id and "balanceCents">=result."rewardCents";
    if not found then raise exception 'Insufficient demo credits'; end if;
  end if;
  insert into public.ledger ("runId","bountyId","agentId",kind,"amountCents",provider,reference)
    values (result."runId",p_id,owner_id,'hold',result."rewardCents",p_provider,p_reference);
  update public.bounties set status='open', "escrowStatus"='held',
    "paymentIntentId"=case when p_provider='stripe' then p_reference else null end, "updatedAt"=now()
    where id=p_id returning * into result;
  return to_jsonb(result) - 'embedding';
end $$;

-- Called only after external transfer succeeds. Ledger and balances commit together.
create or replace function public.settle_bounty(p_id uuid, p_reference text, p_provider text, p_transfer_id text default null)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare result public.bounties; inserted_count integer;
begin
  if p_provider not in ('demo','stripe') then raise exception 'Invalid provider'; end if;
  if p_provider='stripe' and (p_transfer_id is null or p_transfer_id not like 'tr_%') then
    raise exception 'Confirmed transfer receipt required';
  end if;
  select * into strict result from public.bounties where id=p_id for update;
  if result.status='paid' then return to_jsonb(result) - 'embedding'; end if;
  if result.status<>'settling' or result."workerId" is null or result.deliverable is null then
    raise exception 'Bounty is not ready to settle';
  end if;
  if not exists (select 1 from public.ledger where "bountyId"=p_id and kind='hold' and provider=p_provider) then
    raise exception 'Matching hold required';
  end if;
  insert into public.ledger ("runId","bountyId","agentId",kind,"amountCents",provider,reference)
    values(result."runId",p_id,result."workerId",'payout',result."rewardCents",p_provider,p_reference)
    on conflict ("bountyId",kind) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count=1 then
    update public.agents set "balanceCents"="balanceCents"+result."rewardCents",
      "earnedCents"="earnedCents"+result."rewardCents", "tasksCompleted"="tasksCompleted"+1, status='online'
      where id=result."workerId";
  end if;
  update public.bounties set status='paid', "escrowStatus"='settled', "transferId"=p_transfer_id, "updatedAt"=now()
    where id=p_id returning * into result;
  return to_jsonb(result) - 'embedding';
end $$;

create or replace function public.release_bounty(p_id uuid, p_reference text, p_provider text, p_reason text)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare result public.bounties; inserted_count integer; owner_id uuid := '11111111-1111-4111-8111-111111111111';
begin
  select * into strict result from public.bounties where id=p_id for update;
  if result.status='failed' then return to_jsonb(result) - 'embedding'; end if;
  if result.status in ('settling','paid') then raise exception 'Settlement cannot be automatically released'; end if;
  if exists (select 1 from public.ledger where "bountyId"=p_id and kind='hold' and provider=p_provider) then
    insert into public.ledger ("runId","bountyId","agentId",kind,"amountCents",provider,reference)
      values(result."runId",p_id,owner_id,'refund',result."rewardCents",p_provider,p_reference)
      on conflict ("bountyId",kind) do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count=1 and p_provider='demo' then
      update public.agents set "balanceCents"="balanceCents"+result."rewardCents" where id=owner_id;
    end if;
  end if;
  update public.bounties set status='failed', "escrowStatus"='released', review=p_reason, "updatedAt"=now()
    where id=p_id returning * into result;
  update public.agents set status='online' where id=result."workerId";
  return to_jsonb(result) - 'embedding';
end $$;

create or replace function public.append_activity(p_activity jsonb)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare result public.activity;
begin
  insert into public.activity select (jsonb_populate_record(null::public.activity,p_activity)).*
    on conflict(id) do nothing;
  select * into strict result from public.activity where id=(p_activity->>'id')::uuid;
  return to_jsonb(result);
end $$;

create or replace function public.update_run(p_id uuid,p_status text,p_error text default null)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare result public.runs;
begin
  if p_status='completed' and not exists(select 1 from public.bounties where "runId"=p_id and status='paid') then
    raise exception 'Run requires a settled bounty';
  end if;
  update public.runs set status=p_status,error=p_error,"updatedAt"=now() where id=p_id returning * into result;
  if not found then raise exception 'Run not found'; end if;
  return to_jsonb(result);
end $$;

create or replace function public.match_agents(query_embedding extensions.vector(768),match_count integer default 3)
returns table(id uuid,name text,role text,model text,skills text[],"balanceCents" integer,"earnedCents" integer,"tasksCompleted" integer,status text,similarity double precision)
language sql stable security invoker set search_path=public,extensions as $$
  select a.id,a.name,a.role,a.model,a.skills,a."balanceCents",a."earnedCents",a."tasksCompleted",a.status,
    1-(a.embedding <=> query_embedding) as similarity
  from public.agents a where a.role='worker' and a.embedding is not null
  order by a.embedding <=> query_embedding limit least(greatest(match_count,1),10);
$$;

-- Functions are never callable by untrusted browser roles.
revoke all on function public.create_run(jsonb),public.create_bounty(jsonb),
  public.transition_bounty(uuid,text,text,jsonb),public.claim_bounty(uuid,uuid,double precision),
  public.record_hold(uuid,text,text),public.settle_bounty(uuid,text,text,text),
  public.release_bounty(uuid,text,text,text),public.append_activity(jsonb),
  public.update_run(uuid,text,text),public.match_agents(extensions.vector,integer) from public,anon,authenticated;
grant execute on function public.create_run(jsonb),public.create_bounty(jsonb),
  public.transition_bounty(uuid,text,text,jsonb),public.claim_bounty(uuid,uuid,double precision),
  public.record_hold(uuid,text,text),public.settle_bounty(uuid,text,text,text),
  public.release_bounty(uuid,text,text,text),public.append_activity(jsonb),
  public.update_run(uuid,text,text),public.match_agents(extensions.vector,integer) to service_role;

-- Idempotent seed. Live worker skill embeddings are generated by the server before matching.
insert into public.agents(id,name,role,model,skills,"balanceCents",embedding) values
 ('11111111-1111-4111-8111-111111111111','Atlas','orchestrator','Claude Sonnet',array['planning','verification','coordination'],0,null),
 ('22222222-2222-4222-8222-222222222222','Pixel','worker','Gemini Flash',array['data analysis','visualization','research'],0,null),
 ('33333333-3333-4333-8333-333333333333','Scout','worker','Gemini Flash',array['market research','writing','strategy'],0,null)
 on conflict(id) do nothing;

-- Service-side Realtime subscriptions receive private database changes.
do $$
declare table_name text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach table_name in array array['agents','bounties','activity','ledger','runs'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
        execute format('alter publication supabase_realtime add table public.%I',table_name);
      end if;
    end loop;
  end if;
end $$;
