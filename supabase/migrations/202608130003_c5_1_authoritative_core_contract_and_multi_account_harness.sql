begin;

alter table public.center_cloud_entities
  add column entity_version bigint not null default 1;

alter table public.center_cloud_entities
  add constraint center_cloud_entities_entity_version_positive_check
  check (entity_version >= 1);

create table public.center_core_command_result (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  operation text not null,
  entity_type text not null,
  local_id text not null,
  expected_version bigint not null,
  intent_digest bytea not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint center_core_command_result_operation_check
    check (operation in ('UPSERT', 'DELETE')),
  constraint center_core_command_result_entity_type_check
    check (entity_type in ('student', 'teacher', 'class_session', 'schedule_session')),
  constraint center_core_command_result_expected_version_check
    check (expected_version >= 0),
  constraint center_core_command_result_intent_digest_check
    check (octet_length(intent_digest) = 32),
  constraint center_core_command_result_snapshot_check
    check (
      jsonb_typeof(result_snapshot) = 'object'
      and result_snapshot->>'outcome_code' in ('COMMITTED', 'DELETED')
      and (result_snapshot->>'entity_version')::bigint >= 1
    ),
  constraint center_core_command_result_scope_unique
    unique (center_id, actor_user_id, idempotency_key)
);

create index center_core_command_result_entity_idx
  on public.center_core_command_result (center_id, entity_type, local_id, created_at desc);

alter table public.center_core_command_result enable row level security;
alter table public.center_core_command_result force row level security;
revoke all on table public.center_core_command_result from public, anon, authenticated, service_role;

drop policy if exists "c4_6b center members read cloud entities" on public.center_cloud_entities;
drop policy if exists "c4_6b center writers insert cloud entities" on public.center_cloud_entities;
drop policy if exists "c4_6b center writers update cloud entities" on public.center_cloud_entities;
drop policy if exists "center members can delete cloud entities" on public.center_cloud_entities;
drop policy if exists "center members can insert cloud entities" on public.center_cloud_entities;
drop policy if exists "center members can select cloud entities" on public.center_cloud_entities;
drop policy if exists "center members can update cloud entities" on public.center_cloud_entities;

create policy "c5_1 active center members read cloud entities"
  on public.center_cloud_entities
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.center_members cm
      join public.centers c on c.id = cm.center_id
      where cm.center_id = center_cloud_entities.center_id
        and cm.user_id = auth.uid()
        and coalesce(cm.status, 'active') = 'active'
        and c.status = 'active'
    )
  );

create policy "c5_1 center writers insert noncore cloud entities"
  on public.center_cloud_entities
  for insert
  to authenticated
  with check (
    public.can_write_center(center_id)
    and entity_type not in ('student', 'teacher', 'class_session', 'schedule_session')
  );

create policy "c5_1 center writers update noncore cloud entities"
  on public.center_cloud_entities
  for update
  to authenticated
  using (
    public.can_write_center(center_id)
    and entity_type not in ('student', 'teacher', 'class_session', 'schedule_session')
  )
  with check (
    public.can_write_center(center_id)
    and entity_type not in ('student', 'teacher', 'class_session', 'schedule_session')
  );

create policy "c5_1 center writers delete noncore cloud entities"
  on public.center_cloud_entities
  for delete
  to authenticated
  using (
    public.can_write_center(center_id)
    and entity_type not in ('student', 'teacher', 'class_session', 'schedule_session')
  );

create or replace function public.c5_1_mutate_core_entity(
  p_center_id text,
  p_entity_type text,
  p_local_id text,
  p_expected_version bigint,
  p_payload jsonb,
  p_idempotency_key uuid,
  p_operation text default 'UPSERT'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_entity_type text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, '')));
  v_local_id text := pg_catalog.btrim(coalesce(p_local_id, ''));
  v_operation text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_operation, '')));
  v_role text;
  v_payload jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_intent_digest bytea;
  v_existing_result public.center_core_command_result%rowtype;
  v_entity public.center_cloud_entities%rowtype;
  v_result jsonb;
begin
  if v_actor_user_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;

  if v_center_id = '' or pg_catalog.length(v_center_id) > 160 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;

  if v_entity_type not in ('student', 'teacher', 'class_session', 'schedule_session') then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_ENTITY_TYPE');
  end if;

  if v_local_id = '' or pg_catalog.length(v_local_id) > 200 or v_local_id ~ '[[:cntrl:]]' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_LOCAL_ID');
  end if;

  if p_idempotency_key is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_IDEMPOTENCY_KEY');
  end if;

  if v_operation not in ('UPSERT', 'DELETE') or p_expected_version is null or p_expected_version < 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;

  select pg_catalog.lower(cm.role)
    into v_role
  from public.center_members cm
  join public.centers c on c.id = cm.center_id
  where cm.center_id = v_center_id
    and cm.user_id = v_actor_user_id
    and coalesce(cm.status, 'active') = 'active'
    and c.status = 'active'
  for share of cm, c;

  if v_role is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED');
  end if;

  if v_role not in ('owner', 'qtv', 'center_admin', 'admin') then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
  end if;

  if v_operation = 'UPSERT' then
    if p_payload is null
       or pg_catalog.jsonb_typeof(p_payload) <> 'object'
       or pg_catalog.octet_length(pg_catalog.convert_to(p_payload::text, 'UTF8')) > 262144 then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;

    -- Client timestamps and cloud projection metadata are cache concerns, not
    -- semantic command input.  Excluding them keeps a network retry with the
    -- same idempotency key stable even when the browser rebuilds the form
    -- object; the authoritative timestamp is always written below by SQL.
    v_payload := p_payload
      - 'cloudVersion'
      - 'cloudUpdatedAt'
      - 'cloudDeletedAt'
      - 'updatedAt';

    if pg_catalog.btrim(coalesce(v_payload->>'id', '')) <> v_local_id then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'PAYLOAD_ID_MISMATCH');
    end if;

  else
    v_payload := '{}'::jsonb;
  end if;

  v_intent_digest := extensions.digest(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_object(
        'contract_version', 1,
        'center_id', v_center_id,
        'entity_type', v_entity_type,
        'local_id', v_local_id,
        'expected_version', p_expected_version,
        'operation', v_operation,
        'payload', v_payload
      )::text,
      'UTF8'
    ),
    'sha256'
  );

  if v_operation = 'UPSERT' then
    v_payload := pg_catalog.jsonb_set(
      v_payload,
      '{updatedAt}',
      pg_catalog.to_jsonb(v_now),
      true
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'c5.1.core.command|' || v_center_id || '|' || v_actor_user_id::text || '|' || p_idempotency_key::text,
      0
    )
  );

  select *
    into v_existing_result
  from public.center_core_command_result r
  where r.center_id = v_center_id
    and r.actor_user_id = v_actor_user_id
    and r.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing_result.intent_digest <> v_intent_digest then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;

    return v_existing_result.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  select *
    into v_entity
  from public.center_cloud_entities e
  where e.center_id = v_center_id
    and e.entity_type = v_entity_type
    and e.local_id = v_local_id
  for update;

  if not found then
    if v_operation = 'DELETE' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'ENTITY_NOT_FOUND');
    end if;

    if p_expected_version <> 0 then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'outcome_code', 'VERSION_CONFLICT',
        'current_version', 0
      );
    end if;

    insert into public.center_cloud_entities (
      center_id,
      entity_type,
      local_id,
      payload,
      source_module,
      source_version,
      entity_version,
      created_by,
      updated_by,
      deleted_at
    ) values (
      v_center_id,
      v_entity_type,
      v_local_id,
      v_payload,
      'c5.1-authoritative-core',
      'c5.1-authoritative-core-v1',
      1,
      v_actor_user_id,
      v_actor_user_id,
      null
    )
    returning * into v_entity;
  else
    if v_entity.entity_version <> p_expected_version then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'outcome_code', 'VERSION_CONFLICT',
        'current_version', v_entity.entity_version
      );
    end if;

    if v_operation = 'UPSERT' then
      update public.center_cloud_entities e
      set payload = v_payload,
          source_module = 'c5.1-authoritative-core',
          source_version = 'c5.1-authoritative-core-v1',
          entity_version = e.entity_version + 1,
          updated_by = v_actor_user_id,
          deleted_at = null
      where e.id = v_entity.id
      returning * into v_entity;
    else
      update public.center_cloud_entities e
      set entity_version = e.entity_version + 1,
          updated_by = v_actor_user_id,
          deleted_at = v_now
      where e.id = v_entity.id
      returning * into v_entity;
    end if;
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', case when v_operation = 'DELETE' then 'DELETED' else 'COMMITTED' end,
    'center_id', v_entity.center_id,
    'entity_type', v_entity.entity_type,
    'local_id', v_entity.local_id,
    'entity_version', v_entity.entity_version,
    'updated_at', v_entity.updated_at,
    'deleted_at', v_entity.deleted_at,
    'payload', case when v_operation = 'DELETE' then null else v_entity.payload end,
    'replayed', false
  );

  insert into public.center_core_command_result (
    center_id,
    actor_user_id,
    idempotency_key,
    operation,
    entity_type,
    local_id,
    expected_version,
    intent_digest,
    result_snapshot
  ) values (
    v_center_id,
    v_actor_user_id,
    p_idempotency_key,
    v_operation,
    v_entity_type,
    v_local_id,
    p_expected_version,
    v_intent_digest,
    v_result
  );

  return v_result;
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
end;
$function$;

revoke all on function public.c5_1_mutate_core_entity(text, text, text, bigint, jsonb, uuid, text)
  from public, anon, service_role;
grant execute on function public.c5_1_mutate_core_entity(text, text, text, bigint, jsonb, uuid, text)
  to authenticated;

comment on function public.c5_1_mutate_core_entity(text, text, text, bigint, jsonb, uuid, text) is
  'C5.1 authenticated exact-center authoritative command for Student, Teacher, Class Session, and Schedule Session. Actor and role derive from auth.uid(); optimistic version and idempotency are server enforced.';

commit;
