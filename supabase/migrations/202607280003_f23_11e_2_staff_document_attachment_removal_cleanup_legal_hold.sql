-- F23.11E.2.1 - soft removal plus fail-closed deletion governance.
-- Migration-ready only. This migration must be reviewed and applied manually.
-- Permanent deletion is intentionally unavailable: this repository has neither
-- a canonical server-side Staff employment lifecycle nor an approved server
-- executor capable of binding a nonce/legal-hold check to the Storage DELETE.

create or replace function public.is_staff_document_attachment_owner(
  requested_center_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and nullif(btrim(requested_center_id), '') is not null
    and exists (
      select 1
      from public.center_members cm
      where cm.center_id = requested_center_id
        and cm.user_id = auth.uid()
        and lower(btrim(coalesce(cm.status::text, ''))) = 'active'
        and lower(
          replace(
            replace(btrim(coalesce(cm.role::text, '')), '-', '_'),
            ' ',
            '_'
          )
        ) = 'owner'
    );
$$;

revoke all on function public.is_staff_document_attachment_owner(text)
  from public, anon;
grant execute on function public.is_staff_document_attachment_owner(text)
  to authenticated;

create table if not exists public.center_staff_document_attachment_retention_policies (
  center_id text primary key,
  profile_retention_days_after_employment_end integer not null default 1825,
  document_retention_days_after_employment_end integer not null default 1825,
  deletion_review_grace_days integer not null default 30,
  enabled boolean not null default true,
  configured_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint center_staff_document_attachment_retention_center_check
    check (center_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_document_attachment_retention_profile_days_check
    check (profile_retention_days_after_employment_end = 1825),
  constraint center_staff_document_attachment_retention_document_days_check
    check (document_retention_days_after_employment_end = 1825),
  constraint center_staff_document_attachment_retention_grace_days_check
    check (deletion_review_grace_days = 30),
  constraint center_staff_document_attachment_retention_enabled_check
    check (enabled = true)
);

alter table public.center_staff_document_attachment_retention_policies enable row level security;

create policy "f23_11e_2 select attachment retention policy by center role"
on public.center_staff_document_attachment_retention_policies
for select
to authenticated
using (public.can_manage_staff_document_attachments(center_id));

revoke all on table public.center_staff_document_attachment_retention_policies
  from public, anon, authenticated;
grant select on table public.center_staff_document_attachment_retention_policies
  to authenticated;

alter table public.center_staff_document_attachments
  add column if not exists removed_at timestamptz null,
  add column if not exists removed_by_user_id uuid null,
  add column if not exists removal_reason text null,
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by_user_id uuid null,
  add column if not exists deletion_request_id uuid null;

alter table public.center_staff_document_attachments
  drop constraint if exists center_staff_document_attachments_state_check,
  drop constraint if exists center_staff_document_attachments_archive_check,
  drop constraint if exists center_staff_document_attachments_archive_reason_check;

alter table public.center_staff_document_attachments
  add constraint center_staff_document_attachments_state_check
    check (state in ('pending', 'available', 'failed', 'archived', 'deleted')),
  add constraint center_staff_document_attachments_archive_check
    check (
      (
        state in ('archived', 'deleted')
        and archived_at is not null
        and archived_by_user_id is not null
      )
      or (
        state not in ('archived', 'deleted')
        and archived_at is null
        and archived_by_user_id is null
      )
    ),
  add constraint center_staff_document_attachments_archive_reason_check
    check (
      archive_reason is null
      or (
        state in ('archived', 'deleted')
        and archive_reason in ('replaced', 'removed')
      )
    ),
  add constraint center_staff_document_attachments_removal_check
    check (
      (
        removal_reason is null
        and removed_at is null
        and removed_by_user_id is null
      )
      or (
        state in ('archived', 'deleted')
        and archive_reason = 'removed'
        and removal_reason in (
          'user_requested',
          'incorrect_attachment',
          'retention_review',
          'other'
        )
        and removed_at is not null
        and removed_by_user_id is not null
      )
    ),
  add constraint center_staff_document_attachments_deletion_tombstone_check
    check (
      (
        state = 'deleted'
        and is_primary = false
        and deleted_at is not null
        and deleted_by_user_id is not null
        and deletion_request_id is not null
      )
      or (
        state <> 'deleted'
        and deleted_at is null
        and deleted_by_user_id is null
        and deletion_request_id is null
      )
    );

drop index if exists public.center_staff_document_attachments_document_version_unique;
create unique index center_staff_document_attachments_document_version_unique
  on public.center_staff_document_attachments (center_id, document_id, version)
  where state in ('available', 'archived', 'deleted');

drop index if exists public.center_staff_document_attachments_successful_replacement_unique;
create unique index center_staff_document_attachments_successful_replacement_unique
  on public.center_staff_document_attachments (replaces_attachment_id)
  where replaces_attachment_id is not null
    and state in ('available', 'archived', 'deleted');

create table if not exists public.center_staff_document_attachment_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  center_id text not null,
  attachment_id uuid not null,
  status text not null default 'requested',
  reason_code text not null,
  requested_by_user_id uuid not null,
  requested_at timestamptz not null default now(),
  eligible_after timestamptz null,
  approved_by_user_id uuid null,
  approved_at timestamptz null,
  rejected_by_user_id uuid null,
  rejected_at timestamptz null,
  canceled_by_user_id uuid null,
  canceled_at timestamptz null,
  execution_started_by_user_id uuid null,
  execution_started_at timestamptz null,
  execution_expires_at timestamptz null,
  execution_nonce uuid null,
  completed_by_user_id uuid null,
  completed_at timestamptz null,
  failure_reason text null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint center_staff_document_attachment_deletion_request_center_check
    check (center_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_document_attachment_deletion_request_attachment_fk
    foreign key (attachment_id)
    references public.center_staff_document_attachments (id)
    on delete restrict,
  constraint center_staff_document_attachment_deletion_request_status_check
    check (status in ('requested', 'approved', 'rejected', 'canceled', 'executing', 'completed', 'failed')),
  constraint center_staff_document_attachment_deletion_request_reason_check
    check (reason_code in ('user_requested', 'duplicate', 'incorrect_attachment', 'retention_review', 'other')),
  constraint center_staff_document_attachment_deletion_request_failure_check
    check (
      failure_reason is null
      or failure_reason in (
        'storage_delete_failed',
        'execution_expired',
        'object_still_present',
        'permission_changed',
        'legal_hold_placed'
      )
    ),
  constraint center_staff_document_attachment_deletion_request_revision_check
    check (revision >= 1),
  constraint center_staff_document_attachment_deletion_request_transition_shape_check
    check (
      (status = 'requested' and approved_at is null and rejected_at is null and canceled_at is null)
      or (status = 'approved' and approved_by_user_id is not null and approved_at is not null)
      or (status = 'rejected' and rejected_by_user_id is not null and rejected_at is not null)
      or (status = 'canceled' and canceled_by_user_id is not null and canceled_at is not null)
      or (
        status = 'executing'
        and approved_by_user_id is not null
        and approved_at is not null
        and execution_started_by_user_id is not null
        and execution_started_at is not null
        and execution_expires_at is not null
        and execution_nonce is not null
      )
      or (
        status = 'completed'
        and completed_by_user_id is not null
        and completed_at is not null
      )
      or (
        status = 'failed'
        and failure_reason is not null
        and execution_started_by_user_id is null
        and execution_started_at is null
        and execution_expires_at is null
        and execution_nonce is null
      )
    )
);

create unique index if not exists center_staff_document_attachment_deletion_request_active_unique
  on public.center_staff_document_attachment_deletion_requests (center_id, attachment_id)
  where status in ('requested', 'approved', 'executing');

create index if not exists center_staff_document_attachment_deletion_request_lookup_idx
  on public.center_staff_document_attachment_deletion_requests (
    center_id,
    attachment_id,
    created_at desc
  );

alter table public.center_staff_document_attachments
  add constraint center_staff_document_attachments_deletion_request_fk
  foreign key (deletion_request_id)
  references public.center_staff_document_attachment_deletion_requests (id)
  on delete restrict
  not valid;

alter table public.center_staff_document_attachments
  validate constraint center_staff_document_attachments_deletion_request_fk;

create table if not exists public.center_staff_document_attachment_deletion_request_events (
  id uuid primary key default gen_random_uuid(),
  center_id text not null,
  request_id uuid not null,
  attachment_id uuid not null,
  from_status text null,
  to_status text not null,
  reason_code text not null,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint center_staff_document_attachment_deletion_event_center_check
    check (center_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_document_attachment_deletion_event_request_fk
    foreign key (request_id)
    references public.center_staff_document_attachment_deletion_requests (id)
    on delete restrict,
  constraint center_staff_document_attachment_deletion_event_attachment_fk
    foreign key (attachment_id)
    references public.center_staff_document_attachments (id)
    on delete restrict,
  constraint center_staff_document_attachment_deletion_event_status_check
    check (
      (from_status is null or from_status in ('requested', 'approved', 'rejected', 'canceled', 'executing', 'completed', 'failed'))
      and to_status in ('requested', 'approved', 'rejected', 'canceled', 'executing', 'completed', 'failed')
    ),
  constraint center_staff_document_attachment_deletion_event_reason_check
    check (reason_code ~ '^[a-z0-9][a-z0-9._-]{0,79}$')
);

create index if not exists center_staff_document_attachment_deletion_event_lookup_idx
  on public.center_staff_document_attachment_deletion_request_events (
    center_id,
    request_id,
    created_at asc
  );

create table if not exists public.center_staff_document_attachment_legal_holds (
  id uuid primary key default gen_random_uuid(),
  center_id text not null,
  attachment_id uuid not null,
  status text not null default 'active',
  reason_code text not null,
  placed_by_user_id uuid not null,
  placed_at timestamptz not null default now(),
  released_by_user_id uuid null,
  released_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint center_staff_document_attachment_legal_hold_center_check
    check (center_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'),
  constraint center_staff_document_attachment_legal_hold_attachment_fk
    foreign key (attachment_id)
    references public.center_staff_document_attachments (id)
    on delete restrict,
  constraint center_staff_document_attachment_legal_hold_status_check
    check (status in ('active', 'released')),
  constraint center_staff_document_attachment_legal_hold_reason_check
    check (reason_code in ('legal_requirement', 'dispute', 'investigation', 'audit', 'other')),
  constraint center_staff_document_attachment_legal_hold_release_check
    check (
      (status = 'active' and released_by_user_id is null and released_at is null)
      or (status = 'released' and released_by_user_id is not null and released_at is not null)
    )
);

create unique index if not exists center_staff_document_attachment_legal_hold_active_unique
  on public.center_staff_document_attachment_legal_holds (center_id, attachment_id)
  where status = 'active';

create index if not exists center_staff_document_attachment_legal_hold_lookup_idx
  on public.center_staff_document_attachment_legal_holds (
    center_id,
    attachment_id,
    created_at desc
  );

create table if not exists public.center_staff_document_attachment_governance_audit_events (
  id uuid primary key default gen_random_uuid(),
  center_id text not null,
  staff_member_id text not null,
  administrative_profile_id text not null,
  document_id text not null,
  attachment_id uuid not null,
  request_id uuid null,
  version integer not null,
  action text not null,
  actor_user_id uuid not null,
  reason_code text not null,
  created_at timestamptz not null default now(),
  constraint center_staff_document_attachment_governance_audit_attachment_fk
    foreign key (attachment_id)
    references public.center_staff_document_attachments (id)
    on delete restrict,
  constraint center_staff_document_attachment_governance_audit_request_fk
    foreign key (request_id)
    references public.center_staff_document_attachment_deletion_requests (id)
    on delete restrict,
  constraint center_staff_document_attachment_governance_audit_action_check
    check (action in (
      'staff_document_attachment_removed',
      'staff_document_attachment_deletion_requested',
      'staff_document_attachment_deletion_approved',
      'staff_document_attachment_deletion_rejected',
      'staff_document_attachment_deletion_canceled',
      'staff_document_attachment_deletion_execution_started',
      'staff_document_attachment_deletion_completed',
      'staff_document_attachment_deletion_failed',
      'staff_document_attachment_legal_hold_placed',
      'staff_document_attachment_legal_hold_released'
    )),
  constraint center_staff_document_attachment_governance_audit_reason_check
    check (reason_code ~ '^[a-z0-9][a-z0-9._-]{0,79}$')
);

create index if not exists center_staff_document_attachment_governance_audit_lookup_idx
  on public.center_staff_document_attachment_governance_audit_events (
    center_id,
    attachment_id,
    created_at asc
  );

alter table public.center_staff_document_attachment_deletion_requests enable row level security;
alter table public.center_staff_document_attachment_deletion_request_events enable row level security;
alter table public.center_staff_document_attachment_legal_holds enable row level security;
alter table public.center_staff_document_attachment_governance_audit_events enable row level security;

create policy "f23_11e_2 select attachment deletion requests by center role"
on public.center_staff_document_attachment_deletion_requests
for select
to authenticated
using (public.can_manage_staff_document_attachments(center_id));

create policy "f23_11e_2 select attachment deletion request events by center role"
on public.center_staff_document_attachment_deletion_request_events
for select
to authenticated
using (public.can_manage_staff_document_attachments(center_id));

create policy "f23_11e_2 select attachment legal holds by center role"
on public.center_staff_document_attachment_legal_holds
for select
to authenticated
using (public.can_manage_staff_document_attachments(center_id));

create policy "f23_11e_2 select attachment governance audit by center role"
on public.center_staff_document_attachment_governance_audit_events
for select
to authenticated
using (public.can_manage_staff_document_attachments(center_id));

revoke all on table public.center_staff_document_attachment_deletion_requests
  from public, anon, authenticated;
revoke all on table public.center_staff_document_attachment_deletion_request_events
  from public, anon, authenticated;
revoke all on table public.center_staff_document_attachment_legal_holds
  from public, anon, authenticated;
revoke all on table public.center_staff_document_attachment_governance_audit_events
  from public, anon, authenticated;
grant select on table public.center_staff_document_attachment_deletion_requests
  to authenticated;
grant select on table public.center_staff_document_attachment_deletion_request_events
  to authenticated;
grant select on table public.center_staff_document_attachment_legal_holds
  to authenticated;
grant select on table public.center_staff_document_attachment_governance_audit_events
  to authenticated;

create or replace function public.write_staff_document_attachment_governance_audit(
  p_center_id text,
  p_attachment_id uuid,
  p_request_id uuid,
  p_action text,
  p_reason_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment public.center_staff_document_attachments%rowtype;
begin
  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = p_attachment_id
    and a.center_id = p_center_id;
  if not found then
    raise exception 'staff_document_attachment_not_found';
  end if;
  if p_request_id is not null and not exists (
    select 1
    from public.center_staff_document_attachment_deletion_requests r
    where r.id = p_request_id
      and r.center_id = p_center_id
      and r.attachment_id = p_attachment_id
  ) then
    raise exception 'staff_document_attachment_deletion_request_stale';
  end if;
  insert into public.center_staff_document_attachment_governance_audit_events (
    center_id,
    staff_member_id,
    administrative_profile_id,
    document_id,
    attachment_id,
    request_id,
    version,
    action,
    actor_user_id,
    reason_code
  ) values (
    v_attachment.center_id,
    v_attachment.staff_member_id,
    v_attachment.administrative_profile_id,
    v_attachment.document_id,
    v_attachment.id,
    p_request_id,
    v_attachment.version,
    p_action,
    auth.uid(),
    p_reason_code
  );
end;
$$;

revoke all on function public.write_staff_document_attachment_governance_audit(
  text, uuid, uuid, text, text
) from public, anon, authenticated;

create or replace function public.touch_staff_document_attachment_governance_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_staff_document_attachment_governance_updated_at()
  from public, anon, authenticated;

create trigger touch_staff_document_attachment_deletion_request_updated_at
before update on public.center_staff_document_attachment_deletion_requests
for each row execute function public.touch_staff_document_attachment_governance_updated_at();

create trigger touch_staff_document_attachment_legal_hold_updated_at
before update on public.center_staff_document_attachment_legal_holds
for each row execute function public.touch_staff_document_attachment_governance_updated_at();

create trigger touch_staff_document_attachment_retention_policy_updated_at
before update on public.center_staff_document_attachment_retention_policies
for each row execute function public.touch_staff_document_attachment_governance_updated_at();

create or replace function public.guard_staff_document_attachment_deletion_request_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.id,
    new.center_id,
    new.attachment_id,
    new.reason_code,
    new.requested_by_user_id,
    new.requested_at,
    new.eligible_after,
    new.created_at
  ) is distinct from row(
    old.id,
    old.center_id,
    old.attachment_id,
    old.reason_code,
    old.requested_by_user_id,
    old.requested_at,
    old.eligible_after,
    old.created_at
  ) then
    raise exception 'staff_document_attachment_deletion_request_identity_immutable';
  end if;

  if new.revision <> old.revision + 1 then
    raise exception 'staff_document_attachment_deletion_request_revision_invalid';
  end if;

  if not (
    (old.status = 'requested' and new.status in ('approved', 'rejected', 'canceled'))
    or (old.status = 'approved' and new.status in ('executing', 'canceled'))
    or (old.status = 'executing' and new.status in ('executing', 'completed', 'failed'))
    or (old.status = 'failed' and new.status = 'executing')
  ) then
    raise exception 'staff_document_attachment_deletion_request_transition_invalid';
  end if;

  if old.status in ('rejected', 'canceled', 'completed') then
    raise exception 'staff_document_attachment_deletion_request_terminal';
  end if;
  return new;
end;
$$;

create trigger guard_staff_document_attachment_deletion_request_update
before update on public.center_staff_document_attachment_deletion_requests
for each row execute function public.guard_staff_document_attachment_deletion_request_update();

revoke all on function public.guard_staff_document_attachment_deletion_request_update()
  from public, anon, authenticated;

create or replace function public.guard_staff_document_attachment_legal_hold_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.id,
    new.center_id,
    new.attachment_id,
    new.reason_code,
    new.placed_by_user_id,
    new.placed_at,
    new.created_at
  ) is distinct from row(
    old.id,
    old.center_id,
    old.attachment_id,
    old.reason_code,
    old.placed_by_user_id,
    old.placed_at,
    old.created_at
  ) then
    raise exception 'staff_document_attachment_legal_hold_identity_immutable';
  end if;
  if old.status <> 'active'
    or new.status <> 'released'
    or new.released_by_user_id is distinct from auth.uid()
    or new.released_at is null then
    raise exception 'staff_document_attachment_legal_hold_transition_invalid';
  end if;
  return new;
end;
$$;

create trigger guard_staff_document_attachment_legal_hold_update
before update on public.center_staff_document_attachment_legal_holds
for each row execute function public.guard_staff_document_attachment_legal_hold_update();

revoke all on function public.guard_staff_document_attachment_legal_hold_update()
  from public, anon, authenticated;

create or replace function public.guard_center_staff_document_attachment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.id,
    new.center_id,
    new.staff_member_id,
    new.administrative_profile_id,
    new.document_id,
    new.bucket_id,
    new.object_path,
    new.original_file_name,
    new.safe_file_name,
    new.mime_type,
    new.size_bytes,
    new.checksum,
    new.uploaded_by_user_id,
    new.created_at,
    new.version,
    new.replaces_attachment_id
  ) is distinct from row(
    old.id,
    old.center_id,
    old.staff_member_id,
    old.administrative_profile_id,
    old.document_id,
    old.bucket_id,
    old.object_path,
    old.original_file_name,
    old.safe_file_name,
    old.mime_type,
    old.size_bytes,
    old.checksum,
    old.uploaded_by_user_id,
    old.created_at,
    old.version,
    old.replaces_attachment_id
  ) then
    raise exception 'staff_document_attachment_identity_immutable';
  end if;

  if old.state = new.state then
    if new.is_primary is distinct from old.is_primary
      or new.upload_failure_reason is distinct from old.upload_failure_reason
      or new.archived_at is distinct from old.archived_at
      or new.archived_by_user_id is distinct from old.archived_by_user_id
      or new.archive_reason is distinct from old.archive_reason
      or new.removed_at is distinct from old.removed_at
      or new.removed_by_user_id is distinct from old.removed_by_user_id
      or new.removal_reason is distinct from old.removal_reason
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by_user_id is distinct from old.deleted_by_user_id
      or new.deletion_request_id is distinct from old.deletion_request_id then
      raise exception 'staff_document_attachment_transition_invalid';
    end if;
    return new;
  end if;

  if old.state = 'pending' and new.state = 'available' then
    if new.is_primary is not true
      or new.upload_failure_reason is not null
      or new.archived_at is not null
      or new.archive_reason is not null
      or new.removed_at is not null
      or new.deleted_at is not null then
      raise exception 'staff_document_attachment_transition_invalid';
    end if;
    return new;
  end if;

  if old.state = 'pending' and new.state = 'failed' then
    if new.is_primary is distinct from old.is_primary
      or new.upload_failure_reason is null
      or new.archived_at is not null
      or new.archive_reason is not null
      or new.removed_at is not null
      or new.deleted_at is not null then
      raise exception 'staff_document_attachment_transition_invalid';
    end if;
    return new;
  end if;

  if old.state = 'available' and new.state = 'archived' then
    if old.is_primary is not true
      or new.is_primary is not false
      or new.archived_at is null
      or new.archived_by_user_id is distinct from auth.uid()
      or new.archive_reason is null
      or new.archive_reason not in ('replaced', 'removed')
      or new.upload_failure_reason is distinct from old.upload_failure_reason
      or new.deleted_at is not null
      or new.deleted_by_user_id is not null
      or new.deletion_request_id is not null then
      raise exception 'staff_document_attachment_transition_invalid';
    end if;
    if new.archive_reason = 'replaced' and (
      new.removed_at is not null
      or new.removed_by_user_id is not null
      or new.removal_reason is not null
    ) then
      raise exception 'staff_document_attachment_transition_invalid';
    end if;
    if new.archive_reason = 'removed' and (
      new.removed_at is null
      or new.removed_by_user_id is distinct from auth.uid()
      or new.removal_reason is null
      or new.removal_reason not in (
        'user_requested',
        'incorrect_attachment',
        'retention_review',
        'other'
      )
    ) then
      raise exception 'staff_document_attachment_transition_invalid';
    end if;
    return new;
  end if;

  if old.state = 'archived' and new.state = 'deleted' then
    if old.is_primary is not false
      or new.is_primary is not false
      or new.archived_at is distinct from old.archived_at
      or new.archived_by_user_id is distinct from old.archived_by_user_id
      or new.archive_reason is distinct from old.archive_reason
      or new.removed_at is distinct from old.removed_at
      or new.removed_by_user_id is distinct from old.removed_by_user_id
      or new.removal_reason is distinct from old.removal_reason
      or new.deleted_at is null
      or new.deleted_by_user_id is distinct from auth.uid()
      or new.deletion_request_id is null then
      raise exception 'staff_document_attachment_transition_invalid';
    end if;
    return new;
  end if;

  raise exception 'staff_document_attachment_transition_invalid';
end;
$$;

revoke all on function public.guard_center_staff_document_attachment_update()
  from public, anon, authenticated;

create or replace function public.staff_document_attachment_retention_eligible_at(
  p_center_id text,
  p_attachment_id uuid
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Fail closed until a reviewed canonical server-side Staff lifecycle exists.
  -- The exact center/attachment authorization prevents this SECURITY DEFINER
  -- helper from becoming a cross-center existence oracle.
  if not public.can_manage_staff_document_attachments(p_center_id) then
    raise exception 'staff_document_attachment_access_denied';
  end if;
  if not exists (
    select 1
    from public.center_staff_document_attachments a
    where a.id = p_attachment_id
      and a.center_id = p_center_id
  ) then
    raise exception 'staff_document_attachment_not_found';
  end if;
  return null;
end;
$$;

revoke all on function public.staff_document_attachment_retention_eligible_at(text, uuid)
  from public, anon, authenticated;

create or replace function public.remove_staff_document_attachment_from_document(
  p_center_id text,
  p_attachment_id uuid,
  p_expected_current_attachment_id uuid,
  p_reason_code text
)
returns setof public.center_staff_document_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment public.center_staff_document_attachments%rowtype;
begin
  if not public.can_manage_staff_document_attachments(p_center_id) then
    raise exception 'staff_document_attachment_access_denied';
  end if;
  if p_attachment_id is null
    or p_expected_current_attachment_id is null
    or p_attachment_id is distinct from p_expected_current_attachment_id then
    raise exception 'staff_document_attachment_removal_stale';
  end if;
  if p_reason_code not in (
    'user_requested',
    'incorrect_attachment',
    'retention_review',
    'other'
  ) then
    raise exception 'staff_document_attachment_removal_reason_invalid';
  end if;

  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = p_attachment_id
    and a.center_id = p_center_id;
  if not found then
    raise exception 'staff_document_attachment_removal_stale';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_center_id || ':' || v_attachment.document_id, 0)
  );

  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = p_attachment_id
    and a.center_id = p_center_id
    and a.state = 'available'
    and a.is_primary = true
    and a.archived_at is null
    and a.deleted_at is null
  for update;
  if not found then
    raise exception 'staff_document_attachment_removal_stale';
  end if;

  update public.center_staff_document_attachments
  set
    state = 'archived',
    is_primary = false,
    archived_at = now(),
    archived_by_user_id = auth.uid(),
    archive_reason = 'removed',
    removed_at = now(),
    removed_by_user_id = auth.uid(),
    removal_reason = p_reason_code
  where id = v_attachment.id
  returning * into v_attachment;

  perform public.write_staff_document_attachment_governance_audit(
    p_center_id,
    v_attachment.id,
    null,
    'staff_document_attachment_removed',
    p_reason_code
  );

  return next v_attachment;
end;
$$;

create or replace function public.request_staff_document_attachment_deletion(
  p_center_id text,
  p_attachment_id uuid,
  p_reason_code text
)
returns setof public.center_staff_document_attachment_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attachment public.center_staff_document_attachments%rowtype;
  v_request public.center_staff_document_attachment_deletion_requests%rowtype;
  v_eligible_after timestamptz;
begin
  if not public.can_manage_staff_document_attachments(p_center_id) then
    raise exception 'staff_document_attachment_access_denied';
  end if;
  if p_reason_code not in (
    'user_requested',
    'duplicate',
    'incorrect_attachment',
    'retention_review',
    'other'
  ) then
    raise exception 'staff_document_attachment_deletion_reason_invalid';
  end if;

  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = p_attachment_id
    and a.center_id = p_center_id;
  if not found then
    raise exception 'staff_document_attachment_not_found';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(p_center_id || ':' || v_attachment.document_id, 0)
  );
  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = p_attachment_id
    and a.center_id = p_center_id
  for update;
  if not found then
    raise exception 'staff_document_attachment_not_found';
  end if;
  if v_attachment.state <> 'archived'
    or v_attachment.is_primary <> false
    or v_attachment.deleted_at is not null then
    raise exception 'staff_document_attachment_deletion_not_archived';
  end if;
  if exists (
    select 1
    from public.center_staff_document_attachment_legal_holds h
    where h.center_id = p_center_id
      and h.attachment_id = p_attachment_id
      and h.status = 'active'
  ) then
    raise exception 'staff_document_attachment_legal_hold_active';
  end if;
  if exists (
    select 1
    from public.center_staff_document_attachment_deletion_requests r
    where r.center_id = p_center_id
      and r.attachment_id = p_attachment_id
      and r.status in ('requested', 'approved', 'executing')
  ) then
    raise exception 'staff_document_attachment_deletion_request_active';
  end if;

  v_eligible_after := public.staff_document_attachment_retention_eligible_at(
    p_center_id,
    p_attachment_id
  );
  -- A request records deletion intent and two-person review even while canonical
  -- retention is unavailable. NULL remains permanently ineligible for execution.

  insert into public.center_staff_document_attachment_deletion_requests (
    center_id,
    attachment_id,
    status,
    reason_code,
    requested_by_user_id,
    eligible_after
  ) values (
    p_center_id,
    p_attachment_id,
    'requested',
    p_reason_code,
    auth.uid(),
    v_eligible_after
  ) returning * into v_request;

  insert into public.center_staff_document_attachment_deletion_request_events (
    center_id,
    request_id,
    attachment_id,
    from_status,
    to_status,
    reason_code,
    actor_user_id
  ) values (
    p_center_id,
    v_request.id,
    p_attachment_id,
    null,
    'requested',
    p_reason_code,
    auth.uid()
  );

  perform public.write_staff_document_attachment_governance_audit(
    p_center_id,
    p_attachment_id,
    v_request.id,
    'staff_document_attachment_deletion_requested',
    p_reason_code
  );

  return next v_request;
end;
$$;

create or replace function public.approve_staff_document_attachment_deletion(
  p_center_id text,
  p_request_id uuid,
  p_reason_code text
)
returns setof public.center_staff_document_attachment_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.center_staff_document_attachment_deletion_requests%rowtype;
  v_attachment public.center_staff_document_attachments%rowtype;
begin
  if not public.is_staff_document_attachment_owner(p_center_id) then
    raise exception 'staff_document_attachment_owner_access_denied';
  end if;
  if p_reason_code not in ('owner_approved', 'retention_review') then
    raise exception 'staff_document_attachment_deletion_reason_invalid';
  end if;

  select a.* into v_attachment
  from public.center_staff_document_attachment_deletion_requests r
  join public.center_staff_document_attachments a
    on a.id = r.attachment_id
   and a.center_id = r.center_id
  where r.id = p_request_id
    and r.center_id = p_center_id;
  if not found then
    raise exception 'staff_document_attachment_deletion_request_stale';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_center_id || ':' || v_attachment.document_id, 0)
  );
  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = v_attachment.id
    and a.center_id = p_center_id
  for update;
  if not found
    or v_attachment.state <> 'archived'
    or v_attachment.is_primary <> false
    or v_attachment.deleted_at is not null then
    raise exception 'staff_document_attachment_deletion_not_archived';
  end if;

  select * into v_request
  from public.center_staff_document_attachment_deletion_requests r
  where r.id = p_request_id
    and r.center_id = p_center_id
    and r.attachment_id = v_attachment.id
  for update;
  if not found or v_request.status <> 'requested' then
    raise exception 'staff_document_attachment_deletion_request_stale';
  end if;
  if v_request.requested_by_user_id = auth.uid() then
    raise exception 'staff_document_attachment_deletion_self_approval_denied';
  end if;
  if exists (
    select 1
    from public.center_staff_document_attachment_legal_holds h
    where h.center_id = p_center_id
      and h.attachment_id = v_attachment.id
      and h.status = 'active'
  ) then
    raise exception 'staff_document_attachment_legal_hold_active';
  end if;

  update public.center_staff_document_attachment_deletion_requests
  set
    status = 'approved',
    approved_by_user_id = auth.uid(),
    approved_at = now(),
    failure_reason = null,
    revision = revision + 1
  where id = v_request.id
  returning * into v_request;

  insert into public.center_staff_document_attachment_deletion_request_events (
    center_id, request_id, attachment_id, from_status, to_status, reason_code, actor_user_id
  ) values (
    p_center_id, v_request.id, v_request.attachment_id,
    'requested', 'approved', p_reason_code, auth.uid()
  );
  perform public.write_staff_document_attachment_governance_audit(
    p_center_id,
    v_request.attachment_id,
    v_request.id,
    'staff_document_attachment_deletion_approved',
    p_reason_code
  );
  return next v_request;
end;
$$;

create or replace function public.reject_staff_document_attachment_deletion(
  p_center_id text,
  p_request_id uuid,
  p_reason_code text
)
returns setof public.center_staff_document_attachment_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.center_staff_document_attachment_deletion_requests%rowtype;
begin
  if not public.is_staff_document_attachment_owner(p_center_id) then
    raise exception 'staff_document_attachment_owner_access_denied';
  end if;
  if p_reason_code not in ('owner_rejected', 'insufficient_basis', 'other') then
    raise exception 'staff_document_attachment_deletion_reason_invalid';
  end if;
  select * into v_request
  from public.center_staff_document_attachment_deletion_requests r
  where r.id = p_request_id
    and r.center_id = p_center_id
  for update;
  if not found or v_request.status <> 'requested' then
    raise exception 'staff_document_attachment_deletion_request_stale';
  end if;
  if v_request.requested_by_user_id = auth.uid() then
    raise exception 'staff_document_attachment_deletion_self_approval_denied';
  end if;
  update public.center_staff_document_attachment_deletion_requests
  set
    status = 'rejected',
    rejected_by_user_id = auth.uid(),
    rejected_at = now(),
    revision = revision + 1
  where id = v_request.id
  returning * into v_request;
  insert into public.center_staff_document_attachment_deletion_request_events (
    center_id, request_id, attachment_id, from_status, to_status, reason_code, actor_user_id
  ) values (
    p_center_id, v_request.id, v_request.attachment_id,
    'requested', 'rejected', p_reason_code, auth.uid()
  );
  perform public.write_staff_document_attachment_governance_audit(
    p_center_id,
    v_request.attachment_id,
    v_request.id,
    'staff_document_attachment_deletion_rejected',
    p_reason_code
  );
  return next v_request;
end;
$$;

create or replace function public.cancel_staff_document_attachment_deletion(
  p_center_id text,
  p_request_id uuid,
  p_reason_code text
)
returns setof public.center_staff_document_attachment_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.center_staff_document_attachment_deletion_requests%rowtype;
  v_is_owner boolean;
  v_from_status text;
begin
  if not public.can_manage_staff_document_attachments(p_center_id) then
    raise exception 'staff_document_attachment_access_denied';
  end if;
  if p_reason_code not in ('requester_canceled', 'owner_canceled') then
    raise exception 'staff_document_attachment_deletion_reason_invalid';
  end if;
  v_is_owner := public.is_staff_document_attachment_owner(p_center_id);
  select * into v_request
  from public.center_staff_document_attachment_deletion_requests r
  where r.id = p_request_id
    and r.center_id = p_center_id
  for update;
  if not found or v_request.status not in ('requested', 'approved') then
    raise exception 'staff_document_attachment_deletion_request_stale';
  end if;
  if not v_is_owner and (
    v_request.status <> 'requested'
    or v_request.requested_by_user_id <> auth.uid()
  ) then
    raise exception 'staff_document_attachment_deletion_cancel_denied';
  end if;
  if (v_is_owner and p_reason_code <> 'owner_canceled')
    or (not v_is_owner and p_reason_code <> 'requester_canceled') then
    raise exception 'staff_document_attachment_deletion_reason_invalid';
  end if;
  v_from_status := v_request.status;
  update public.center_staff_document_attachment_deletion_requests
  set
    status = 'canceled',
    canceled_by_user_id = auth.uid(),
    canceled_at = now(),
    revision = revision + 1
  where id = v_request.id
  returning * into v_request;
  insert into public.center_staff_document_attachment_deletion_request_events (
    center_id, request_id, attachment_id, from_status, to_status, reason_code, actor_user_id
  ) values (
    p_center_id, v_request.id, v_request.attachment_id,
    v_from_status, 'canceled', p_reason_code, auth.uid()
  );
  perform public.write_staff_document_attachment_governance_audit(
    p_center_id,
    v_request.attachment_id,
    v_request.id,
    'staff_document_attachment_deletion_canceled',
    p_reason_code
  );
  return next v_request;
end;
$$;

create or replace function public.place_staff_document_attachment_legal_hold(
  p_center_id text,
  p_attachment_id uuid,
  p_reason_code text
)
returns setof public.center_staff_document_attachment_legal_holds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.center_staff_document_attachment_legal_holds%rowtype;
  v_attachment public.center_staff_document_attachments%rowtype;
  v_request public.center_staff_document_attachment_deletion_requests%rowtype;
  v_hold_already_active boolean := false;
  v_request_from_status text;
begin
  if not public.is_staff_document_attachment_owner(p_center_id) then
    raise exception 'staff_document_attachment_owner_access_denied';
  end if;
  if p_reason_code not in ('legal_requirement', 'dispute', 'investigation', 'audit', 'other') then
    raise exception 'staff_document_attachment_legal_hold_reason_invalid';
  end if;
  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = p_attachment_id
    and a.center_id = p_center_id;
  if not found then
    raise exception 'staff_document_attachment_not_found';
  end if;

  -- Every mutation for one document uses the same advisory-lock domain, then
  -- attachment row, then request row. This serializes hold versus execution.
  perform pg_advisory_xact_lock(
    hashtextextended(p_center_id || ':' || v_attachment.document_id, 0)
  );
  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = p_attachment_id
    and a.center_id = p_center_id
  for update;
  if not found
    or v_attachment.state = 'deleted'
    or v_attachment.deleted_at is not null then
    raise exception 'staff_document_attachment_not_found';
  end if;
  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = v_attachment.bucket_id
      and o.name = v_attachment.object_path
  ) then
    raise exception 'staff_document_attachment_object_missing_finalize_required';
  end if;

  select * into v_hold
  from public.center_staff_document_attachment_legal_holds h
  where h.center_id = p_center_id
    and h.attachment_id = p_attachment_id
    and h.status = 'active'
  for update;
  v_hold_already_active := found;

  select * into v_request
  from public.center_staff_document_attachment_deletion_requests r
  where r.center_id = p_center_id
    and r.attachment_id = p_attachment_id
    and r.status in ('requested', 'approved', 'executing')
  order by r.created_at desc
  limit 1
  for update;

  if found and v_request.status = 'executing' then
    v_request_from_status := v_request.status;
    update public.center_staff_document_attachment_deletion_requests
    set
      status = 'failed',
      execution_started_by_user_id = null,
      execution_started_at = null,
      execution_expires_at = null,
      execution_nonce = null,
      failure_reason = 'legal_hold_placed',
      revision = revision + 1
    where id = v_request.id
    returning * into v_request;

    insert into public.center_staff_document_attachment_deletion_request_events (
      center_id, request_id, attachment_id, from_status, to_status, reason_code, actor_user_id
    ) values (
      p_center_id, v_request.id, p_attachment_id,
      v_request_from_status, 'failed', 'legal_hold_placed', auth.uid()
    );
    perform public.write_staff_document_attachment_governance_audit(
      p_center_id,
      p_attachment_id,
      v_request.id,
      'staff_document_attachment_deletion_failed',
      'legal_hold_placed'
    );
  end if;

  if v_hold_already_active then
    return next v_hold;
    return;
  end if;
  insert into public.center_staff_document_attachment_legal_holds (
    center_id, attachment_id, status, reason_code, placed_by_user_id
  ) values (
    p_center_id, p_attachment_id, 'active', p_reason_code, auth.uid()
  ) returning * into v_hold;
  perform public.write_staff_document_attachment_governance_audit(
    p_center_id,
    p_attachment_id,
    null,
    'staff_document_attachment_legal_hold_placed',
    p_reason_code
  );
  return next v_hold;
end;
$$;

create or replace function public.release_staff_document_attachment_legal_hold(
  p_center_id text,
  p_attachment_id uuid,
  p_reason_code text
)
returns setof public.center_staff_document_attachment_legal_holds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.center_staff_document_attachment_legal_holds%rowtype;
  v_attachment public.center_staff_document_attachments%rowtype;
begin
  if not public.is_staff_document_attachment_owner(p_center_id) then
    raise exception 'staff_document_attachment_owner_access_denied';
  end if;
  if p_reason_code not in ('hold_released', 'matter_resolved') then
    raise exception 'staff_document_attachment_legal_hold_reason_invalid';
  end if;
  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = p_attachment_id
    and a.center_id = p_center_id;
  if not found then
    raise exception 'staff_document_attachment_not_found';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(p_center_id || ':' || v_attachment.document_id, 0)
  );
  select * into v_attachment
  from public.center_staff_document_attachments a
  where a.id = p_attachment_id
    and a.center_id = p_center_id
  for update;
  if not found then
    raise exception 'staff_document_attachment_not_found';
  end if;
  select * into v_hold
  from public.center_staff_document_attachment_legal_holds h
  where h.center_id = p_center_id
    and h.attachment_id = p_attachment_id
    and h.status = 'active'
  for update;
  if not found then
    raise exception 'staff_document_attachment_legal_hold_not_found';
  end if;
  update public.center_staff_document_attachment_legal_holds
  set
    status = 'released',
    released_by_user_id = auth.uid(),
    released_at = now()
  where id = v_hold.id
  returning * into v_hold;
  -- Releasing a hold only records release. It never changes a failed request,
  -- recreates its cleared nonce, or resumes an old execution capability.
  perform public.write_staff_document_attachment_governance_audit(
    p_center_id,
    p_attachment_id,
    null,
    'staff_document_attachment_legal_hold_released',
    p_reason_code
  );
  return next v_hold;
end;
$$;

-- No prepare/fail/finalize deletion RPC is created in this migration.
-- An approved server executor and canonical Staff lifecycle are prerequisites.

create or replace function public.staff_document_attachment_governance_snapshot(
  p_center_id text,
  p_document_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_staff_member_id text;
  v_retention_eligible_after timestamptz;
begin
  if not public.can_manage_staff_document_attachments(p_center_id) then
    raise exception 'staff_document_attachment_access_denied';
  end if;
  if p_document_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$' then
    raise exception 'staff_document_attachment_identity_invalid';
  end if;
  select lower(
    replace(replace(btrim(coalesce(cm.role::text, '')), '-', '_'), ' ', '_')
  ) into v_role
  from public.center_members cm
  where cm.center_id = p_center_id
    and cm.user_id = auth.uid()
    and lower(btrim(coalesce(cm.status::text, ''))) = 'active'
  limit 1;

  select a.staff_member_id into v_staff_member_id
  from public.center_staff_document_attachments a
  where a.center_id = p_center_id
    and a.document_id = p_document_id
  order by a.version desc
  limit 1;

  -- No canonical server-side employment lifecycle exists in this repository.
  -- Never derive retention eligibility from browser-owned/local Staff fields.
  v_retention_eligible_after := null;

  return jsonb_build_object(
    'viewer_role', v_role,
    'viewer_user_id', auth.uid(),
    'retention', jsonb_build_object(
      'configured', v_retention_eligible_after is not null,
      'eligible_after', v_retention_eligible_after,
      'eligible_now', v_retention_eligible_after is not null and now() >= v_retention_eligible_after
    ),
    'requests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'attachment_id', r.attachment_id,
          'status', r.status,
          'reason_code', r.reason_code,
          'requested_by_user_id', r.requested_by_user_id,
          'requested_at', r.requested_at,
          'eligible_after', r.eligible_after,
          'approved_by_user_id', r.approved_by_user_id,
          'approved_at', r.approved_at,
          'rejected_at', r.rejected_at,
          'canceled_at', r.canceled_at,
          'execution_started_at', r.execution_started_at,
          'execution_expires_at', r.execution_expires_at,
          'completed_at', r.completed_at,
          'failure_reason', r.failure_reason,
          'can_execute', false,
          'revision', r.revision
        ) order by r.created_at desc
      )
      from public.center_staff_document_attachment_deletion_requests r
      join public.center_staff_document_attachments a on a.id = r.attachment_id
      where r.center_id = p_center_id
        and a.document_id = p_document_id
    ), '[]'::jsonb),
    'holds', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'attachment_id', h.attachment_id,
          'status', h.status,
          'reason_code', h.reason_code,
          'placed_at', h.placed_at,
          'released_at', h.released_at
        ) order by h.created_at desc
      )
      from public.center_staff_document_attachment_legal_holds h
      join public.center_staff_document_attachments a on a.id = h.attachment_id
      where h.center_id = p_center_id
        and a.document_id = p_document_id
    ), '[]'::jsonb)
  );
end;
$$;

drop policy if exists "f23_11e select staff document attachments by center role"
  on public.center_staff_document_attachments;
create policy "f23_11e select staff document attachments by center role"
on public.center_staff_document_attachments
for select
to authenticated
using (
  public.can_manage_staff_document_attachments(center_id)
  and (
    state in ('available', 'archived', 'deleted')
    or (state = 'pending' and uploaded_by_user_id = auth.uid())
  )
);

drop policy if exists "f23_11e_2 delete exact staff document object by execution"
  on storage.objects;
-- Browser Storage DELETE carries only the object path, not an execution nonce.
-- Therefore F23.11E.2.1 intentionally creates no authenticated Storage DELETE
-- policy and no Storage UPDATE policy. Exact deletion requires an approved
-- server-side executor that rechecks lifecycle, hold and request state.

revoke all on function public.remove_staff_document_attachment_from_document(text, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.request_staff_document_attachment_deletion(text, uuid, text)
  from public, anon;
revoke all on function public.approve_staff_document_attachment_deletion(text, uuid, text)
  from public, anon;
revoke all on function public.reject_staff_document_attachment_deletion(text, uuid, text)
  from public, anon;
revoke all on function public.cancel_staff_document_attachment_deletion(text, uuid, text)
  from public, anon;
revoke all on function public.place_staff_document_attachment_legal_hold(text, uuid, text)
  from public, anon;
revoke all on function public.release_staff_document_attachment_legal_hold(text, uuid, text)
  from public, anon;
revoke all on function public.staff_document_attachment_governance_snapshot(text, text)
  from public, anon;

grant execute on function public.remove_staff_document_attachment_from_document(text, uuid, uuid, text)
  to authenticated;
grant execute on function public.request_staff_document_attachment_deletion(text, uuid, text)
  to authenticated;
grant execute on function public.approve_staff_document_attachment_deletion(text, uuid, text)
  to authenticated;
grant execute on function public.reject_staff_document_attachment_deletion(text, uuid, text)
  to authenticated;
grant execute on function public.cancel_staff_document_attachment_deletion(text, uuid, text)
  to authenticated;
grant execute on function public.place_staff_document_attachment_legal_hold(text, uuid, text)
  to authenticated;
grant execute on function public.release_staff_document_attachment_legal_hold(text, uuid, text)
  to authenticated;
grant execute on function public.staff_document_attachment_governance_snapshot(text, text)
  to authenticated;

create or replace function public.staff_document_attachment_governance_readiness(
  p_center_id text
)
returns table (
  soft_removal_ready boolean,
  deletion_request_ready boolean,
  permanent_execution_ready boolean,
  blocker_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.can_manage_staff_document_attachments(p_center_id)
      and to_regclass('public.center_staff_document_attachments') is not null
      and exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'center_staff_document_attachments'
          and c.column_name = 'deleted_at'
      )
      and to_regprocedure(
        'public.remove_staff_document_attachment_from_document(text,uuid,uuid,text)'
      ) is not null
      and exists (
        select 1
        from storage.buckets b
        where b.id = 'staff-administrative-documents'
          and b.public = false
      )
      and not exists (
        select 1
        from pg_policies p
        where p.schemaname = 'storage'
          and p.tablename = 'objects'
          and p.cmd in ('DELETE', 'UPDATE')
          and p.policyname like 'f23_11e%staff document%'
      ),
    public.can_manage_staff_document_attachments(p_center_id)
      and to_regclass('public.center_staff_document_attachment_deletion_requests') is not null
      and to_regclass('public.center_staff_document_attachment_deletion_request_events') is not null
      and to_regclass('public.center_staff_document_attachment_legal_holds') is not null
      and to_regprocedure(
        'public.request_staff_document_attachment_deletion(text,uuid,text)'
      ) is not null
      and to_regprocedure(
        'public.approve_staff_document_attachment_deletion(text,uuid,text)'
      ) is not null
      and to_regprocedure(
        'public.staff_document_attachment_governance_snapshot(text,text)'
      ) is not null,
    false,
    'server_executor_and_canonical_lifecycle_required'::text;
$$;

revoke all on function public.staff_document_attachment_governance_readiness(text)
  from public, anon, authenticated;
grant execute on function public.staff_document_attachment_governance_readiness(text)
  to authenticated;

notify pgrst, 'reload schema';
