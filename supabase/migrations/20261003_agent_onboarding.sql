-- Apply after schema.sql. Existing agents, balances and receipts are preserved.
begin;
create table if not exists public.agent_owners (
  id uuid primary key references auth.users(id) on delete restrict,
  name text not null check (length(name) between 1 and 60),
  "stripeAccountId" text unique,
  "transfersEnabled" boolean not null default false,
  "payoutsEnabled" boolean not null default false
);
alter table public.agents add column if not exists "ownerId" uuid references public.agent_owners(id) on delete restrict;
alter table public.agents add column if not exists origin text not null default 'platform' check (origin in ('platform','external'));
alter table public.agents add column if not exists description text not null default '';
alter table public.agents add column if not exists "registrationState" text not null default 'active' check ("registrationState" in ('draft','active','paused'));
alter table public.agents add column if not exists "connectionState" text not null default 'verified' check ("connectionState" in ('unverified','verified','unreachable'));
alter table public.agents add column if not exists "lastVerifiedAt" timestamptz;
alter table public.agents add column if not exists "minimumRewardCents" integer not null default 50 check ("minimumRewardCents" between 50 and 500);
alter table public.agents add column if not exists "createdAt" timestamptz not null default now();
alter table public.bounties add column if not exists "payoutDestination" text;
create table if not exists public.agent_connections (
  "agentId" uuid primary key references public.agents(id) on delete cascade,
  endpoint text not null,
  credential text not null,
  "lastCheckAt" timestamptz,
  "lastError" text
);
alter table public.agent_connections add column if not exists "registrationFingerprint" text not null default '';
create table if not exists public.guild_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 120),
  goal text not null check (length(goal) between 10 and 2000),
  "rewardCents" integer not null check ("rewardCents" between 50 and 500),
  "idempotencyKey" uuid not null unique,
  "createdAt" timestamptz not null default now(),
  source text not null default 'mcp' check (source in ('mcp','ui'))
);
alter table public.guild_tasks add column if not exists "ownerId" uuid references public.agent_owners(id) on delete restrict;
create table if not exists public.owner_mcp_tokens (
  "ownerId" uuid primary key references public.agent_owners(id) on delete cascade,
  hash text not null unique,
  "createdAt" timestamptz not null default now()
);
alter table public.owner_mcp_tokens enable row level security;
revoke all on public.owner_mcp_tokens from public,anon,authenticated;
grant all on public.owner_mcp_tokens to service_role;
alter table public.agent_owners enable row level security;
alter table public.agent_connections enable row level security;
alter table public.guild_tasks enable row level security;
revoke all on public.agent_owners, public.agent_connections, public.guild_tasks from public, anon, authenticated;
grant all on public.agent_owners, public.agent_connections, public.guild_tasks to service_role;
create index if not exists agents_owner_idx on public.agents("ownerId");

create or replace function public.register_external_agent(p_owner uuid,p_owner_name text,p_agent jsonb,p_endpoint text,p_credential text)
returns uuid language plpgsql security invoker set search_path=public,extensions as $$
declare agent_id uuid := (p_agent->>'id')::uuid;
begin
  insert into public.agent_owners(id,name) values(p_owner,p_owner_name) on conflict(id) do update set name=excluded.name;
  perform 1 from public.agent_owners where id=p_owner for update;
  if exists(select 1 from public.agents where id=agent_id) then
    if not exists(select 1 from public.agents a join public.agent_connections c on c."agentId"=a.id where a.id=agent_id and a."ownerId"=p_owner and c."registrationFingerprint"=p_agent->>'fingerprint') then raise exception 'Registration key already used'; end if;
    return agent_id;
  end if;
  if (select count(*) from public.agents where "ownerId"=p_owner)>=10 then raise exception 'Maximum ten agents per owner'; end if;
  insert into public.agents(id,name,role,model,skills,"ownerId",origin,description,"registrationState","connectionState","minimumRewardCents")
  values(agent_id,p_agent->>'name','worker',p_agent->>'model',array(select jsonb_array_elements_text(p_agent->'skills')),p_owner,'external',p_agent->>'description','draft','unverified',(p_agent->>'minimumRewardCents')::integer);
  insert into public.agent_connections("agentId",endpoint,credential,"registrationFingerprint") values(agent_id,p_endpoint,p_credential,p_agent->>'fingerprint');
  return agent_id;
end $$;
revoke all on function public.register_external_agent(uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.register_external_agent(uuid,text,jsonb,text,text) to service_role;

create or replace function public.update_agent_connection(p_owner uuid,p_id uuid,p_endpoint text,p_credential text)
returns void language plpgsql security invoker set search_path=public,extensions as $$
declare worker public.agents;
begin
  select * into worker from public.agents where id=p_id and "ownerId"=p_owner for update;
  if not found then raise exception 'Agent not found'; end if;
  if worker.status='working' then raise exception 'Agent has an active task'; end if;
  update public.agents set "registrationState"='draft',"connectionState"='unverified',"lastVerifiedAt"=null where id=p_id;
  update public.agent_connections set endpoint=p_endpoint,credential=p_credential,"lastCheckAt"=null,"lastError"=null where "agentId"=p_id;
end $$;
create or replace function public.finish_agent_check(p_owner uuid,p_id uuid,p_credential text,p_checked_at timestamptz,p_embedding extensions.vector(768),p_error text)
returns boolean language plpgsql security invoker set search_path=public,extensions as $$
begin
  perform 1 from public.agents where id=p_id and "ownerId"=p_owner for update;
  if not found then return false; end if;
  perform 1 from public.agent_connections where "agentId"=p_id and credential=p_credential and "lastCheckAt"=p_checked_at for update;
  if not found then return false; end if;
  update public.agents set "connectionState"=case when p_error is null then 'verified' else 'unreachable' end,
    "lastVerifiedAt"=case when p_error is null then now() else "lastVerifiedAt" end,
    embedding=coalesce(p_embedding,embedding) where id=p_id;
  update public.agent_connections set "lastError"=p_error where "agentId"=p_id;
  return true;
end $$;
revoke all on function public.update_agent_connection(uuid,uuid,text,text), public.finish_agent_check(uuid,uuid,text,timestamptz,extensions.vector,text) from public,anon,authenticated;
grant execute on function public.update_agent_connection(uuid,uuid,text,text), public.finish_agent_check(uuid,uuid,text,timestamptz,extensions.vector,text) to service_role;

create or replace function public.post_guild_task(p_owner uuid,p_task jsonb)
returns jsonb language plpgsql security invoker set search_path=public,extensions as $$
declare existing public.guild_tasks; result public.guild_tasks;
begin
  if p_owner is not null then perform 1 from public.agent_owners where id=p_owner for update; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_task->>'idempotencyKey',0));
  select * into existing from public.guild_tasks where "idempotencyKey"=(p_task->>'idempotencyKey')::uuid;
  if found then
    if existing."ownerId" is distinct from p_owner or existing.goal<>p_task->>'goal' or existing.title<>p_task->>'title' or existing."rewardCents"<>(p_task->>'rewardCents')::integer then raise exception 'Request key already used with different task details'; end if;
    return to_jsonb(existing);
  end if;
  if p_owner is not null and (select count(*) from public.guild_tasks where "ownerId"=p_owner and "createdAt">now()-interval '24 hours')>=20 then raise exception 'Daily task posting limit reached'; end if;
  insert into public.guild_tasks(title,goal,"rewardCents","idempotencyKey","ownerId") values(p_task->>'title',p_task->>'goal',(p_task->>'rewardCents')::integer,(p_task->>'idempotencyKey')::uuid,p_owner) returning * into result;
  return to_jsonb(result);
end $$;
revoke all on function public.post_guild_task(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.post_guild_task(uuid,jsonb) to service_role;

-- Public listing data is projected by the API. Never expose credentials or balances.
-- Authenticated owners can read their agents; all edits run through the server.
drop policy if exists agent_owner_read on public.agents;
create policy agent_owner_read on public.agents for select to authenticated using ("ownerId" = (select auth.uid()));
grant select on public.agents to authenticated;

create or replace function public.match_agents(query_embedding extensions.vector(768),match_count integer default 3)
returns table(id uuid,name text,role text,model text,skills text[],"balanceCents" integer,"earnedCents" integer,"tasksCompleted" integer,status text,similarity double precision)
language sql stable security invoker set search_path=public,extensions as $$
  select a.id,a.name,a.role,a.model,a.skills,a."balanceCents",a."earnedCents",a."tasksCompleted",a.status,
    1-(a.embedding <=> query_embedding) as similarity
  from public.agents a left join public.agent_owners o on o.id=a."ownerId"
  where a.role='worker' and a.embedding is not null and a.status='online' and a."registrationState"='active'
    and (a.origin='platform' or (a."connectionState"='verified' and o."transfersEnabled" and o."payoutsEnabled" and o."stripeAccountId" is not null))
  order by a.embedding <=> query_embedding limit least(greatest(match_count,1),10);
$$;

create or replace function public.claim_bounty(p_id uuid,p_worker uuid,p_similarity double precision)
returns jsonb language plpgsql security invoker set search_path=public,extensions as $$
declare result public.bounties; worker public.agents; destination text;
begin
  select * into worker from public.agents where id=p_worker and role='worker' for update;
  if not found then raise exception 'Unknown worker'; end if;
  if worker.status <> 'online' or worker."registrationState" <> 'active' then return null; end if;
  if worker.origin='external' then
    select "stripeAccountId" into destination from public.agent_owners where id=worker."ownerId" and "transfersEnabled" and "payoutsEnabled";
    if destination is null or worker."connectionState" <> 'verified' then return null; end if;
  end if;
  update public.bounties set status='claimed',"workerId"=p_worker,similarity=p_similarity,"payoutDestination"=destination,"updatedAt"=now()
  where id=p_id and status='open' and "workerId" is null and "escrowStatus"='held' and "rewardCents">=worker."minimumRewardCents" returning * into result;
  if not found then return null; end if;
  update public.agents set status='working' where id=p_worker;
  return to_jsonb(result)-'embedding';
end $$;
revoke all on function public.match_agents(extensions.vector,integer), public.claim_bounty(uuid,uuid,double precision) from public,anon,authenticated;
grant execute on function public.match_agents(extensions.vector,integer), public.claim_bounty(uuid,uuid,double precision) to service_role;
notify pgrst, 'reload schema';
commit;
