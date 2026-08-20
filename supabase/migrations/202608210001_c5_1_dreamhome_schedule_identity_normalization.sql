do $migration$
declare
  v_target_count integer;
  v_updated_count integer;
  v_total_core_rows_before integer;
  v_student_digest_before text;
  v_teacher_digest_before text;
  v_class_digest_before text;
  v_student_digest_after text;
  v_teacher_digest_after text;
  v_class_digest_after text;
  v_payload_digest_before text;
  v_payload_digest_after text;
  v_provenance_digest_before text;
  v_provenance_digest_after text;
  v_immutable_schedule_digest_before text;
  v_immutable_schedule_digest_after text;
  v_full_schedule_digest text;
begin
  if pg_catalog.to_regclass('public.center_cloud_entities') is null then
    raise exception 'C5.1 DreamHome repair stopped: center_cloud_entities is absent.';
  end if;

  if pg_catalog.to_regclass('public.center_core_command_result') is null then
    raise exception 'C5.1 DreamHome repair stopped: center_core_command_result is absent.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'center_cloud_entities'
      and column_name = 'entity_version'
  ) then
    raise exception 'C5.1 DreamHome repair stopped: entity_version is absent.';
  end if;

  -- Prevent any concurrent core write from changing a reviewed precondition
  -- between validation and commit. The exact nine rows are also row-locked
  -- below and remain the only rows eligible for the UPDATE.
  lock table public.center_cloud_entities in share row exclusive mode;
  lock table public.center_core_command_result in share mode;

  create temporary table c5_1_dreamhome_schedule_repair_allowlist (
    fingerprint text primary key,
    expected_updated_at timestamptz not null,
    expected_controlled_fixture boolean not null,
    expected_schedule_type text not null
  ) on commit drop;

  insert into c5_1_dreamhome_schedule_repair_allowlist (
    fingerprint,
    expected_updated_at,
    expected_controlled_fixture,
    expected_schedule_type
  ) values
    ('32cf091afeef8a9e9952b82a3f9ddad4509a974cb417e9b364df30ddff9711e6', '2026-06-17 00:00:00+00', true, 'oneOff'),
    ('4f2447475eaa04731d17887b1c94424740cf2ae8eb6e0107e1e10b32052a9c79', '2026-06-17 00:00:00+00', true, 'oneOff'),
    ('70802b0cdbfef47dfe7cceacd3e4d643dabc7b9ac57d6571c699f045cb370205', '2026-06-17 00:00:00+00', true, 'oneOff'),
    ('7c8c6b5bbfb6a25306c09d84f69c5468a3d4014e36bda04b764927fa3135ce11', '2026-06-17 00:00:00+00', true, 'oneOff'),
    ('84fa8c17571342f1898b6eb291325d55ef449de073c0162170ae46b64eb876b1', '2026-06-17 00:00:00+00', true, 'oneOff'),
    ('985733b6f94a41e0981c5ace0a435c31f8c1b06de6bee92544266e3b32cefab1', '2026-07-09 02:34:22.040515+00', false, 'recurring'),
    ('adeba41a3ae045da0ea3329fc7727ad32a3671182606bee217a673ea6dc2fd67', '2026-06-17 00:00:00+00', true, 'oneOff'),
    ('c5fd808eb9f1b5e9694355efeb6d257dafc8df52bb12261732b1840fa0240dbb', '2026-06-17 00:00:00+00', true, 'oneOff'),
    ('eb9dc74eee78249dc9acb0e899c98b7ec91e2505ae5be56914d529f485930cbf', '2026-06-17 00:00:00+00', true, 'oneOff');

  if (select pg_catalog.count(*) from c5_1_dreamhome_schedule_repair_allowlist) <> 9 then
    raise exception 'C5.1 DreamHome repair stopped: allowlist count is not 9.';
  end if;

  select pg_catalog.count(*)
  into v_target_count
  from public.center_cloud_entities e
  where e.center_id = 'dreamhome'
    and e.entity_type = 'schedule_session'
    and e.deleted_at is null;

  if v_target_count <> 9 then
    raise exception 'C5.1 DreamHome repair stopped: active Schedule count is %, expected 9.', v_target_count;
  end if;

  if (select pg_catalog.count(*) from public.center_cloud_entities e where e.center_id = 'dreamhome' and e.entity_type = 'student' and e.deleted_at is null) <> 30
    or (select pg_catalog.count(*) from public.center_cloud_entities e where e.center_id = 'dreamhome' and e.entity_type = 'teacher' and e.deleted_at is null) <> 6
    or (select pg_catalog.count(*) from public.center_cloud_entities e where e.center_id = 'dreamhome' and e.entity_type = 'class_session' and e.deleted_at is null) <> 4 then
    raise exception 'C5.1 DreamHome repair stopped: Student/Teacher/Class counts drifted.';
  end if;

  create temporary table c5_1_dreamhome_schedule_repair_targets on commit drop as
  select
    e.id,
    e.local_id as old_local_id,
    pg_catalog.btrim(e.payload->>'id') as new_local_id,
    e.entity_version as old_entity_version,
    e.updated_at as old_updated_at
  from public.center_cloud_entities e
  join c5_1_dreamhome_schedule_repair_allowlist a
    on a.fingerprint = pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(e.center_id || '|' || e.entity_type || '|' || e.local_id, 'UTF8'),
        'sha256'
      ),
      'hex'
    )
  where e.center_id = 'dreamhome'
    and e.entity_type = 'schedule_session'
    and e.deleted_at is null
    and e.entity_version = 1
    and e.updated_at = a.expected_updated_at
    and coalesce((e.payload->>'isControlledFixture')::boolean, false) = a.expected_controlled_fixture
    and pg_catalog.btrim(coalesce(e.payload->>'scheduleType', '')) = a.expected_schedule_type
    and e.source_module = 'schedule'
    and e.source_version = 'f19h-schedule-session-alpha-v1'
    and pg_catalog.jsonb_typeof(e.payload) = 'object'
    and pg_catalog.btrim(coalesce(e.payload->>'id', '')) <> ''
    and e.local_id = 'schedule-session::' || pg_catalog.btrim(e.payload->>'id')
  for update of e;

  select pg_catalog.count(*) into v_target_count
  from c5_1_dreamhome_schedule_repair_targets;

  if v_target_count <> 9 then
    raise exception 'C5.1 DreamHome repair stopped: exact guarded target count is %, expected 9.', v_target_count;
  end if;

  if (select pg_catalog.count(distinct new_local_id) from c5_1_dreamhome_schedule_repair_targets) <> 9 then
    raise exception 'C5.1 DreamHome repair stopped: payload identities are not nine unique values.';
  end if;

  if exists (
    select 1
    from c5_1_dreamhome_schedule_repair_targets t
    join public.center_cloud_entities collision
      on collision.center_id = 'dreamhome'
      and collision.entity_type = 'schedule_session'
      and collision.local_id = t.new_local_id
      and collision.id <> t.id
  ) then
    raise exception 'C5.1 DreamHome repair stopped: normalized local_id collision detected.';
  end if;

  if exists (
    select 1
    from c5_1_dreamhome_schedule_repair_targets t
    join public.center_core_command_result r
      on r.center_id = 'dreamhome'
      and r.entity_type = 'schedule_session'
      and r.local_id in (t.old_local_id, t.new_local_id)
  ) then
    raise exception 'C5.1 DreamHome repair stopped: related core command history exists.';
  end if;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(pg_catalog.string_agg(pg_catalog.to_jsonb(e)::text, E'\n' order by e.id), 'UTF8'),
      'sha256'
    ),
    'hex'
  ) into v_full_schedule_digest
  from public.center_cloud_entities e
  where e.center_id = 'dreamhome'
    and e.entity_type = 'schedule_session'
    and e.deleted_at is null;

  if v_full_schedule_digest <> '2ea8ded7cf155fb17b8ee58a2b98c83f42ef8273fb8cf332847b9d69951b9447' then
    raise exception 'C5.1 DreamHome repair stopped: full Schedule row digest drifted.';
  end if;

  select pg_catalog.count(*) into v_total_core_rows_before
  from public.center_cloud_entities e
  where e.center_id = 'dreamhome'
    and e.entity_type in ('student', 'teacher', 'class_session', 'schedule_session');

  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg(pg_catalog.to_jsonb(e)::text, E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex')
  into v_student_digest_before
  from public.center_cloud_entities e
  where e.center_id = 'dreamhome' and e.entity_type = 'student' and e.deleted_at is null;

  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg(pg_catalog.to_jsonb(e)::text, E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex')
  into v_teacher_digest_before
  from public.center_cloud_entities e
  where e.center_id = 'dreamhome' and e.entity_type = 'teacher' and e.deleted_at is null;

  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg(pg_catalog.to_jsonb(e)::text, E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex')
  into v_class_digest_before
  from public.center_cloud_entities e
  where e.center_id = 'dreamhome' and e.entity_type = 'class_session' and e.deleted_at is null;

  select
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg(e.payload::text, E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex'),
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg(coalesce(e.source_module, '') || '|' || coalesce(e.source_version, ''), E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex'),
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg((pg_catalog.to_jsonb(e) - 'local_id' - 'entity_version' - 'updated_at')::text, E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex')
  into v_payload_digest_before, v_provenance_digest_before, v_immutable_schedule_digest_before
  from public.center_cloud_entities e
  join c5_1_dreamhome_schedule_repair_targets t on t.id = e.id;

  if v_payload_digest_before <> '61fb4a7037443398d1948ee9c86d7802e377b14d849d00d1843becb83aaebf51'
    or v_provenance_digest_before <> '74a8f82403ebe9830d6f72e9554e3c072f76c7a31f15e124edbfeeae7dc64a31' then
    raise exception 'C5.1 DreamHome repair stopped: payload or provenance digest drifted.';
  end if;

  update public.center_cloud_entities e
  set local_id = t.new_local_id,
      entity_version = e.entity_version + 1,
      updated_at = pg_catalog.transaction_timestamp()
  from c5_1_dreamhome_schedule_repair_targets t
  where e.id = t.id
    and e.center_id = 'dreamhome'
    and e.entity_type = 'schedule_session'
    and e.deleted_at is null
    and e.local_id = t.old_local_id
    and e.entity_version = t.old_entity_version
    and e.updated_at = t.old_updated_at;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 9 then
    raise exception 'C5.1 DreamHome repair stopped: updated % rows, expected 9.', v_updated_count;
  end if;

  if (select pg_catalog.count(*) from public.center_cloud_entities e where e.center_id = 'dreamhome' and e.entity_type = 'schedule_session' and e.deleted_at is null) <> 9
    or (select pg_catalog.count(*) from public.center_cloud_entities e where e.center_id = 'dreamhome' and e.entity_type = 'schedule_session' and e.deleted_at is null and e.local_id = pg_catalog.btrim(e.payload->>'id') and e.entity_version = 2) <> 9
    or (select pg_catalog.count(*) from public.center_cloud_entities e where e.center_id = 'dreamhome' and e.entity_type in ('student', 'teacher', 'class_session', 'schedule_session')) <> v_total_core_rows_before then
    raise exception 'C5.1 DreamHome repair stopped: post-update count/identity/version invariant failed.';
  end if;

  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg(pg_catalog.to_jsonb(e)::text, E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex')
  into v_student_digest_after
  from public.center_cloud_entities e
  where e.center_id = 'dreamhome' and e.entity_type = 'student' and e.deleted_at is null;

  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg(pg_catalog.to_jsonb(e)::text, E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex')
  into v_teacher_digest_after
  from public.center_cloud_entities e
  where e.center_id = 'dreamhome' and e.entity_type = 'teacher' and e.deleted_at is null;

  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg(pg_catalog.to_jsonb(e)::text, E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex')
  into v_class_digest_after
  from public.center_cloud_entities e
  where e.center_id = 'dreamhome' and e.entity_type = 'class_session' and e.deleted_at is null;

  if v_student_digest_after <> v_student_digest_before
    or v_teacher_digest_after <> v_teacher_digest_before
    or v_class_digest_after <> v_class_digest_before then
    raise exception 'C5.1 DreamHome repair stopped: non-Schedule core rows changed.';
  end if;

  select
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg(e.payload::text, E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex'),
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg(coalesce(e.source_module, '') || '|' || coalesce(e.source_version, ''), E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex'),
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.string_agg((pg_catalog.to_jsonb(e) - 'local_id' - 'entity_version' - 'updated_at')::text, E'\n' order by e.id), 'UTF8'), 'sha256'), 'hex')
  into v_payload_digest_after, v_provenance_digest_after, v_immutable_schedule_digest_after
  from public.center_cloud_entities e
  join c5_1_dreamhome_schedule_repair_targets t on t.id = e.id;

  if v_payload_digest_after <> v_payload_digest_before
    or v_provenance_digest_after <> v_provenance_digest_before
    or v_immutable_schedule_digest_after <> v_immutable_schedule_digest_before then
    raise exception 'C5.1 DreamHome repair stopped: a non-approved Schedule field changed.';
  end if;
end
$migration$;
