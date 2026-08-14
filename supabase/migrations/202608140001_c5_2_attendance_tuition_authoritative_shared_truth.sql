begin;

create table public.center_operational_command_result (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  intent_digest bytea not null,
  mutation_count integer not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint center_operational_command_result_mutation_count_check
    check (mutation_count between 1 and 500),
  constraint center_operational_command_result_intent_digest_check
    check (octet_length(intent_digest) = 32),
  constraint center_operational_command_result_snapshot_check
    check (
      jsonb_typeof(result_snapshot) = 'object'
      and result_snapshot->>'outcome_code' = 'COMMITTED'
      and jsonb_typeof(result_snapshot->'results') = 'array'
      and jsonb_array_length(result_snapshot->'results') = mutation_count
    ),
  constraint center_operational_command_result_scope_unique
    unique (center_id, actor_user_id, idempotency_key)
);

create index center_operational_command_result_created_idx
  on public.center_operational_command_result (center_id, created_at desc);

alter table public.center_operational_command_result enable row level security;
alter table public.center_operational_command_result force row level security;
revoke all on table public.center_operational_command_result
  from public, anon, authenticated, service_role;

drop policy if exists "c5_1 center writers insert noncore cloud entities"
  on public.center_cloud_entities;
drop policy if exists "c5_1 center writers update noncore cloud entities"
  on public.center_cloud_entities;
drop policy if exists "c5_1 center writers delete noncore cloud entities"
  on public.center_cloud_entities;

create policy "c5_2 center writers insert remaining noncore cloud entities"
  on public.center_cloud_entities
  for insert
  to authenticated
  with check (
    public.can_write_center(center_id)
    and entity_type not in (
      'student', 'teacher', 'class_session', 'schedule_session',
      'attendance_record', 'attendance_baseline_state', 'session_report',
      'tuition_record_package'
    )
  );

create policy "c5_2 center writers update remaining noncore cloud entities"
  on public.center_cloud_entities
  for update
  to authenticated
  using (
    public.can_write_center(center_id)
    and entity_type not in (
      'student', 'teacher', 'class_session', 'schedule_session',
      'attendance_record', 'attendance_baseline_state', 'session_report',
      'tuition_record_package'
    )
  )
  with check (
    public.can_write_center(center_id)
    and entity_type not in (
      'student', 'teacher', 'class_session', 'schedule_session',
      'attendance_record', 'attendance_baseline_state', 'session_report',
      'tuition_record_package'
    )
  );

create policy "c5_2 center writers delete remaining noncore cloud entities"
  on public.center_cloud_entities
  for delete
  to authenticated
  using (
    public.can_write_center(center_id)
    and entity_type not in (
      'student', 'teacher', 'class_session', 'schedule_session',
      'attendance_record', 'attendance_baseline_state', 'session_report',
      'tuition_record_package'
    )
  );

create or replace function public.c5_2_mutate_attendance_tuition_entities(
  p_center_id text,
  p_mutations jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_role text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_mutation jsonb;
  v_entity_type text;
  v_local_id text;
  v_operation text;
  v_expected_version bigint;
  v_payload jsonb;
  v_normalized_mutations jsonb := '[]'::jsonb;
  v_mutation_count integer;
  v_unique_mutation_count integer;
  v_intent_digest bytea;
  v_existing_result public.center_operational_command_result%rowtype;
  v_entity public.center_cloud_entities%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_baseline_mutation_count integer := 0;
  v_touches_baseline_records boolean := false;
  v_current_baseline_status text := 'notStarted';
  v_next_baseline_status text := null;
begin
  if v_actor_user_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;

  if v_center_id = '' or pg_catalog.length(v_center_id) > 160 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;

  if p_idempotency_key is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_IDEMPOTENCY_KEY');
  end if;

  if p_mutations is null or pg_catalog.jsonb_typeof(p_mutations) <> 'array' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;

  v_mutation_count := pg_catalog.jsonb_array_length(p_mutations);
  if v_mutation_count < 1 or v_mutation_count > 500
     or pg_catalog.octet_length(pg_catalog.convert_to(p_mutations::text, 'UTF8')) > 2097152 then
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

  -- Current product policy keeps teacher/consultant/viewer read-only. The
  -- schedule UI's teacher gateway is an admin-operated mode, not a browser
  -- authorization boundary.
  if v_role not in ('owner', 'qtv', 'center_admin', 'admin') then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
  end if;

  for v_mutation in
    select value
    from pg_catalog.jsonb_array_elements(p_mutations)
  loop
    if pg_catalog.jsonb_typeof(v_mutation) <> 'object' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
    end if;

    v_entity_type := pg_catalog.lower(pg_catalog.btrim(coalesce(v_mutation->>'entity_type', '')));
    v_local_id := pg_catalog.btrim(coalesce(v_mutation->>'local_id', ''));
    v_operation := pg_catalog.upper(pg_catalog.btrim(coalesce(v_mutation->>'operation', '')));

    if v_entity_type not in (
      'attendance_record', 'attendance_baseline_state', 'session_report',
      'tuition_record_package'
    ) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_ENTITY_TYPE');
    end if;

    if v_local_id = '' or pg_catalog.length(v_local_id) > 200
       or v_local_id ~ '[[:cntrl:]]' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_LOCAL_ID');
    end if;

    if v_operation not in ('UPSERT', 'DELETE')
       or coalesce(v_mutation->>'expected_version', '') !~ '^[0-9]+$' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
    end if;

    v_expected_version := (v_mutation->>'expected_version')::bigint;

    if v_operation = 'UPSERT' then
      v_payload := v_mutation->'payload';
      if v_payload is null
         or pg_catalog.jsonb_typeof(v_payload) <> 'object'
         or pg_catalog.octet_length(pg_catalog.convert_to(v_payload::text, 'UTF8')) > 262144 then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;

      v_payload := v_payload
        - 'cloudVersion'
        - 'cloudUpdatedAt'
        - 'cloudDeletedAt'
        - 'updatedAt';

      if v_payload ? 'centerId'
         and pg_catalog.btrim(coalesce(v_payload->>'centerId', '')) <> v_center_id then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CENTER_PAYLOAD_MISMATCH');
      end if;

      if v_entity_type = 'attendance_record' then
        if pg_catalog.btrim(coalesce(v_payload->>'id', '')) = ''
           or pg_catalog.btrim(coalesce(v_payload->>'studentId', '')) = ''
           or coalesce(v_payload->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
           or v_payload->>'source' not in ('initialBaseline', 'admin', 'teacher', 'consultant', 'correction')
           or coalesce(v_payload->>'attendanceStatus', v_payload->>'status', '')
             not in ('present', 'absent', 'excused', 'excusedAbsent', 'unexcusedAbsent', 'makeup', 'trial') then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
      elsif v_entity_type = 'attendance_baseline_state' then
        if v_payload->>'status' not in ('notStarted', 'draft', 'locked', 'unlocked')
           or (v_payload ? 'auditLog' and pg_catalog.jsonb_typeof(v_payload->'auditLog') <> 'array') then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
        v_baseline_mutation_count := v_baseline_mutation_count + 1;
        v_next_baseline_status := v_payload->>'status';
      elsif v_entity_type = 'session_report' then
        if pg_catalog.btrim(coalesce(v_payload->>'id', '')) = ''
           or pg_catalog.btrim(coalesce(v_payload->>'sessionId', '')) = ''
           or (coalesce(v_payload->>'occurrenceDate', '') <> ''
             and coalesce(v_payload->>'occurrenceDate', '') !~ '^\d{4}-\d{2}-\d{2}$')
           or (v_payload ? 'attendance' and pg_catalog.jsonb_typeof(v_payload->'attendance') <> 'array')
           or (v_payload ? 'learningGroups' and pg_catalog.jsonb_typeof(v_payload->'learningGroups') <> 'array')
           or (v_payload ? 'guestParticipants' and pg_catalog.jsonb_typeof(v_payload->'guestParticipants') <> 'array') then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
        v_payload := v_payload
          || pg_catalog.jsonb_build_object(
            'attendanceIsCanonical', false,
            'canonicalAttendanceEntity', 'attendance_record'
          );
      elsif v_entity_type = 'tuition_record_package' then
        if pg_catalog.btrim(coalesce(v_payload->>'id', '')) = ''
           or pg_catalog.btrim(coalesce(v_payload->>'studentId', '')) = ''
           or pg_catalog.jsonb_typeof(v_payload->'totalSessions') <> 'number'
           or pg_catalog.jsonb_typeof(v_payload->'usedSessions') <> 'number'
           or pg_catalog.jsonb_typeof(v_payload->'totalAmount') <> 'number'
           or pg_catalog.jsonb_typeof(v_payload->'paidAmount') <> 'number'
           or (v_payload->>'totalSessions')::numeric < 0
           or (v_payload->>'usedSessions')::numeric < 0
           or (v_payload->>'totalAmount')::numeric < 0
           or (v_payload->>'paidAmount')::numeric < 0
           or (v_payload ? 'payments' and pg_catalog.jsonb_typeof(v_payload->'payments') <> 'array')
           or (v_payload ? 'termHistory' and pg_catalog.jsonb_typeof(v_payload->'termHistory') <> 'array') then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
        if pg_catalog.lower(coalesce(v_payload->>'attendanceLinked', 'false')) = 'true'
           or pg_catalog.lower(coalesce(v_payload->>'attendanceAutoUpdateEnabled', 'false')) = 'true'
           or pg_catalog.lower(coalesce(v_payload->>'usedSessionsAutoUpdateFromAttendance', 'false')) = 'true'
           or pg_catalog.lower(coalesce(v_payload->>'remainingSessionsAutoUpdateFromAttendance', 'false')) = 'true' then
          return pg_catalog.jsonb_build_object(
            'ok', false,
            'outcome_code', 'ATTENDANCE_TUITION_BOUNDARY_VIOLATION'
          );
        end if;
        v_payload := v_payload
          || pg_catalog.jsonb_build_object(
            'attendanceLinked', false,
            'attendanceAutoUpdateEnabled', false,
            'usedSessionsAutoUpdateFromAttendance', false,
            'remainingSessionsAutoUpdateFromAttendance', false
          );
      end if;
    else
      v_payload := '{}'::jsonb;
      if v_entity_type = 'attendance_baseline_state' then
        v_baseline_mutation_count := v_baseline_mutation_count + 1;
      end if;
    end if;

    v_normalized_mutations := v_normalized_mutations || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'entity_type', v_entity_type,
        'local_id', v_local_id,
        'expected_version', v_expected_version,
        'operation', v_operation,
        'payload', v_payload
      )
    );
  end loop;

  select pg_catalog.count(distinct (item->>'entity_type', item->>'local_id'))
    into v_unique_mutation_count
  from pg_catalog.jsonb_array_elements(v_normalized_mutations) item;

  if v_unique_mutation_count <> v_mutation_count then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'DUPLICATE_MUTATION');
  end if;

  v_intent_digest := extensions.digest(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_object(
        'contract_version', 1,
        'center_id', v_center_id,
        'mutations', v_normalized_mutations
      )::text,
      'UTF8'
    ),
    'sha256'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'c5.2.operational.command|' || v_center_id || '|' || v_actor_user_id::text || '|' || p_idempotency_key::text,
      0
    )
  );

  select *
    into v_existing_result
  from public.center_operational_command_result r
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

  -- Serialize first-create and existing-row mutations in deterministic order.
  for v_mutation in
    select value
    from pg_catalog.jsonb_array_elements(v_normalized_mutations)
    order by value->>'entity_type', value->>'local_id'
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'c5.2.operational.entity|' || v_center_id || '|' ||
          (v_mutation->>'entity_type') || '|' || (v_mutation->>'local_id'),
        0
      )
    );
  end loop;

  -- Validate currentness for the whole batch before changing any row.
  for v_mutation in
    select value
    from pg_catalog.jsonb_array_elements(v_normalized_mutations)
    order by value->>'entity_type', value->>'local_id'
  loop
    v_entity_type := v_mutation->>'entity_type';
    v_local_id := v_mutation->>'local_id';
    v_operation := v_mutation->>'operation';
    v_expected_version := (v_mutation->>'expected_version')::bigint;
    v_payload := v_mutation->'payload';

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
      if v_expected_version <> 0 then
        return pg_catalog.jsonb_build_object(
          'ok', false,
          'outcome_code', 'VERSION_CONFLICT',
          'entity_type', v_entity_type,
          'local_id', v_local_id,
          'current_version', 0
        );
      end if;
    elsif v_entity.entity_version <> v_expected_version then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'outcome_code', 'VERSION_CONFLICT',
        'entity_type', v_entity_type,
        'local_id', v_local_id,
        'current_version', v_entity.entity_version
      );
    end if;

    if v_entity_type = 'attendance_record' and (
      v_payload->>'source' = 'initialBaseline'
      or (found and v_entity.payload->>'source' = 'initialBaseline')
    ) then
      v_touches_baseline_records := true;
    end if;

    if v_entity_type = 'attendance_baseline_state' then
      if found then
        v_current_baseline_status := coalesce(v_entity.payload->>'status', 'notStarted');
      else
        v_current_baseline_status := 'notStarted';
      end if;
    end if;
  end loop;

  if v_touches_baseline_records and v_baseline_mutation_count <> 1 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'BASELINE_STATE_REQUIRED');
  end if;

  if v_current_baseline_status = 'locked' and (
    v_touches_baseline_records
    or v_next_baseline_status is distinct from 'unlocked'
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'BASELINE_LOCKED');
  end if;

  for v_mutation in
    select value
    from pg_catalog.jsonb_array_elements(v_normalized_mutations)
  loop
    v_entity_type := v_mutation->>'entity_type';
    v_local_id := v_mutation->>'local_id';
    v_operation := v_mutation->>'operation';
    v_expected_version := (v_mutation->>'expected_version')::bigint;
    v_payload := v_mutation->'payload';

    select *
      into v_entity
    from public.center_cloud_entities e
    where e.center_id = v_center_id
      and e.entity_type = v_entity_type
      and e.local_id = v_local_id;

    if v_operation = 'UPSERT' then
      v_payload := pg_catalog.jsonb_set(v_payload, '{updatedAt}', pg_catalog.to_jsonb(v_now), true);

      if not found then
        insert into public.center_cloud_entities (
          center_id, entity_type, local_id, payload, source_module,
          source_version, entity_version, created_by, updated_by, deleted_at
        ) values (
          v_center_id,
          v_entity_type,
          v_local_id,
          v_payload,
          case v_entity_type
            when 'tuition_record_package' then 'tuition'
            when 'session_report' then 'sessionReports'
            when 'attendance_baseline_state' then 'attendanceBaselineState'
            else 'attendanceRecords'
          end,
          'c5.2-authoritative-attendance-tuition-v1',
          1,
          v_actor_user_id,
          v_actor_user_id,
          null
        )
        returning * into v_entity;
      else
        update public.center_cloud_entities e
        set payload = v_payload,
            source_module = case v_entity_type
              when 'tuition_record_package' then 'tuition'
              when 'session_report' then 'sessionReports'
              when 'attendance_baseline_state' then 'attendanceBaselineState'
              else 'attendanceRecords'
            end,
            source_version = 'c5.2-authoritative-attendance-tuition-v1',
            entity_version = e.entity_version + 1,
            updated_by = v_actor_user_id,
            deleted_at = null
        where e.id = v_entity.id
        returning * into v_entity;
      end if;
    else
      update public.center_cloud_entities e
      set entity_version = e.entity_version + 1,
          source_version = 'c5.2-authoritative-attendance-tuition-v1',
          updated_by = v_actor_user_id,
          deleted_at = v_now
      where e.id = v_entity.id
      returning * into v_entity;
    end if;

    v_results := v_results || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'ok', true,
        'outcome_code', case when v_operation = 'DELETE' then 'DELETED' else 'COMMITTED' end,
        'center_id', v_entity.center_id,
        'entity_type', v_entity.entity_type,
        'local_id', v_entity.local_id,
        'entity_version', v_entity.entity_version,
        'updated_at', v_entity.updated_at,
        'deleted_at', v_entity.deleted_at,
        'payload', v_entity.payload
      )
    );
  end loop;

  v_result := pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'COMMITTED',
    'center_id', v_center_id,
    'results', v_results,
    'replayed', false
  );

  insert into public.center_operational_command_result (
    center_id, actor_user_id, idempotency_key, intent_digest,
    mutation_count, result_snapshot
  ) values (
    v_center_id, v_actor_user_id, p_idempotency_key, v_intent_digest,
    v_mutation_count, v_result
  );

  return v_result;
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
end;
$function$;

revoke all on function public.c5_2_mutate_attendance_tuition_entities(text, jsonb, uuid)
  from public, anon, service_role;
grant execute on function public.c5_2_mutate_attendance_tuition_entities(text, jsonb, uuid)
  to authenticated;

comment on function public.c5_2_mutate_attendance_tuition_entities(text, jsonb, uuid) is
  'C5.2 authenticated exact-center atomic authoritative command for attendance records, baseline lifecycle, session reports, and tuition record/package state. Current product write roles are owner/qtv/center_admin/admin; teacher/consultant/viewer remain read-only.';

commit;
