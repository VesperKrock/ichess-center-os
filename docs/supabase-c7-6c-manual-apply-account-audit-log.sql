-- C7.6C MANUAL APPLY: account/server-side audit infrastructure
-- Run manually in Supabase SQL Editor only after user approval.
-- Purpose: create dedicated server-side audit log table for sensitive account/center governance actions.
-- This file does not create Auth users.
-- This file does not create memberships.
-- This file does not create centers.
-- This file does not create Edge Functions.
-- This file must not log plaintext passwords.
-- Idempotent version: safe to run again without duplicate constraint errors.

create table if not exists public.account_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid null,
  actor_email text null,
  action text not null,
  target_type text not null,
  target_user_id uuid null,
  target_email text null,
  center_id text null,
  before_state jsonb null,
  after_state jsonb null,
  reason text null,
  request_id text null,
  metadata jsonb not null default '{}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_audit_logs_action_not_empty'
      and conrelid = 'public.account_audit_logs'::regclass
  ) then
    alter table public.account_audit_logs
      add constraint account_audit_logs_action_not_empty
      check (length(trim(action)) > 0) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_audit_logs_target_type_not_empty'
      and conrelid = 'public.account_audit_logs'::regclass
  ) then
    alter table public.account_audit_logs
      add constraint account_audit_logs_target_type_not_empty
      check (length(trim(target_type)) > 0) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_audit_logs_actor_email_sane'
      and conrelid = 'public.account_audit_logs'::regclass
  ) then
    alter table public.account_audit_logs
      add constraint account_audit_logs_actor_email_sane
      check (actor_email is null or length(actor_email) between 3 and 320) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_audit_logs_target_email_sane'
      and conrelid = 'public.account_audit_logs'::regclass
  ) then
    alter table public.account_audit_logs
      add constraint account_audit_logs_target_email_sane
      check (target_email is null or length(target_email) between 3 and 320) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_audit_logs_metadata_no_plaintext_password_keys'
      and conrelid = 'public.account_audit_logs'::regclass
  ) then
    alter table public.account_audit_logs
      add constraint account_audit_logs_metadata_no_plaintext_password_keys
      check (
        not (metadata ? 'temporary_password')
        and not (metadata ? 'password')
        and not (metadata ? 'plaintext_password')
      ) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_audit_logs_before_state_no_plaintext_password_keys'
      and conrelid = 'public.account_audit_logs'::regclass
  ) then
    alter table public.account_audit_logs
      add constraint account_audit_logs_before_state_no_plaintext_password_keys
      check (
        before_state is null
        or (
          not (before_state ? 'temporary_password')
          and not (before_state ? 'password')
          and not (before_state ? 'plaintext_password')
        )
      ) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_audit_logs_after_state_no_plaintext_password_keys'
      and conrelid = 'public.account_audit_logs'::regclass
  ) then
    alter table public.account_audit_logs
      add constraint account_audit_logs_after_state_no_plaintext_password_keys
      check (
        after_state is null
        or (
          not (after_state ? 'temporary_password')
          and not (after_state ? 'password')
          and not (after_state ? 'plaintext_password')
        )
      ) not valid;
  end if;
end $$;

create index if not exists account_audit_logs_created_at_desc_idx
  on public.account_audit_logs (created_at desc);

create index if not exists account_audit_logs_actor_user_id_idx
  on public.account_audit_logs (actor_user_id);

create index if not exists account_audit_logs_target_user_id_idx
  on public.account_audit_logs (target_user_id);

create index if not exists account_audit_logs_target_email_idx
  on public.account_audit_logs (target_email);

create index if not exists account_audit_logs_center_id_idx
  on public.account_audit_logs (center_id);

create index if not exists account_audit_logs_action_idx
  on public.account_audit_logs (action);

create index if not exists account_audit_logs_request_id_idx
  on public.account_audit_logs (request_id);

alter table public.account_audit_logs enable row level security;

-- C7.6C intentionally adds no broad authenticated select policy.
-- C7.6C intentionally adds no broad authenticated insert policy.
-- Edge Function service role writes server-side and bypasses RLS.
-- Owner audit UI read policy is deferred to a later dedicated phase.
-- No seed/test audit row is inserted by this template.
