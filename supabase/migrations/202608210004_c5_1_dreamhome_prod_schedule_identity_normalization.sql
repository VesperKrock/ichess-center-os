begin;

do $migration$
declare
  v_target_count integer;
  v_updated_count integer;
  v_table_row_count_before bigint;
  v_migration_timestamp timestamptz := pg_catalog.transaction_timestamp();
  v_payload_digest_before text;
  v_payload_digest_after text;
  v_immutable_digest_before text;
  v_immutable_digest_after text;
  v_non_target_digest_before text;
  v_non_target_digest_after text;
begin
  if pg_catalog.to_regclass('public.center_cloud_entities') is null then
    raise exception 'OV1.4 dreamhome_prod repair stopped: center_cloud_entities is absent.';
  end if;

  if pg_catalog.to_regclass('public.center_core_command_result') is null then
    raise exception 'OV1.4 dreamhome_prod repair stopped: center_core_command_result is absent.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'center_cloud_entities'
      and column_name = 'entity_version'
  ) then
    raise exception 'OV1.4 dreamhome_prod repair stopped: entity_version is absent.';
  end if;

  lock table public.center_cloud_entities in share row exclusive mode;
  lock table public.center_core_command_result in share mode;

  create temporary table ov1_4_dreamhome_prod_schedule_allowlist (
    row_fingerprint text primary key,
    expected_updated_at timestamptz not null
  ) on commit drop;

  insert into ov1_4_dreamhome_prod_schedule_allowlist (
    row_fingerprint,
    expected_updated_at
  ) values
    ('d8f954450feae470534cfcf2b3c91487afe483951ffab2546e0e4dd007ff93dc', '2026-07-10 06:04:06.505867+00'),
    ('471c1ec4f8a54fa6e9976e418bb9e9a315d52568abc9b08111c85e55ebe5be19', '2026-07-10 08:40:11.603819+00'),
    ('fb6ee730cbc667655e52d184d16b64af183261257f5fe202c0fae4a40c17e6ab', '2026-07-10 08:42:20.563606+00'),
    ('bb122e4a28e4b0942b4eb8a791e45610d2b0c372facc2db5dba6c5d8d106669c', '2026-07-17 02:19:36.578874+00');

  if (select pg_catalog.count(*) from ov1_4_dreamhome_prod_schedule_allowlist) <> 4 then
    raise exception 'OV1.4 dreamhome_prod repair stopped: allowlist count is not 4.';
  end if;

  select pg_catalog.count(*)
  into v_target_count
  from public.center_cloud_entities e
  where e.center_id = 'dreamhome_prod'
    and e.entity_type = 'schedule_session'
    and e.deleted_at is null;

  if v_target_count <> 4 then
    raise exception 'OV1.4 dreamhome_prod repair stopped: active Schedule count is %, expected 4.', v_target_count;
  end if;

  create temporary table ov1_4_dreamhome_prod_schedule_targets on commit drop as
  select
    e.id,
    e.local_id as old_local_id,
    pg_catalog.btrim(e.payload->>'id') as new_local_id,
    e.entity_version as old_entity_version,
    e.updated_at as old_updated_at,
    a.row_fingerprint
  from public.center_cloud_entities e
  join ov1_4_dreamhome_prod_schedule_allowlist a
    on a.row_fingerprint = pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          pg_catalog.jsonb_build_object(
            'center_id', e.center_id,
            'entity_type', e.entity_type,
            'local_id', e.local_id,
            'payload', e.payload,
            'source_module', e.source_module,
            'source_version', e.source_version,
            'entity_version', e.entity_version,
            'created_at', e.created_at,
            'updated_at', e.updated_at,
            'deleted_at', e.deleted_at
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
    and e.updated_at = a.expected_updated_at
  where e.center_id = 'dreamhome_prod'
    and e.entity_type = 'schedule_session'
    and e.deleted_at is null
    and e.entity_version = 1
    and e.source_module = 'schedule'
    and e.source_version = 'f19h-schedule-session-alpha-v1'
    and pg_catalog.jsonb_typeof(e.payload) = 'object'
    and pg_catalog.btrim(coalesce(e.payload->>'id', '')) <> ''
    and e.local_id = 'schedule-session::' || pg_catalog.btrim(e.payload->>'id')
    and pg_catalog.btrim(coalesce(e.payload->>'scheduleType', '')) in ('recurring', 'oneOff')
    and (
      (
        pg_catalog.btrim(e.payload->>'scheduleType') = 'recurring'
        and pg_catalog.btrim(coalesce(e.payload->>'dayOfWeek', '')) in (
          'monday', 'tuesday', 'wednesday', 'thursday',
          'friday', 'saturday', 'sunday'
        )
      )
      or (
        pg_catalog.btrim(e.payload->>'scheduleType') = 'oneOff'
        and pg_catalog.btrim(coalesce(e.payload->>'date', '')) ~ '^\d{4}-\d{2}-\d{2}$'
        and pg_catalog.to_char((pg_catalog.btrim(e.payload->>'date'))::date, 'YYYY-MM-DD')
          = pg_catalog.btrim(e.payload->>'date')
      )
    )
    and pg_catalog.btrim(coalesce(e.payload->>'startTime', '')) ~ '^\d{2}:\d{2}$'
    and pg_catalog.btrim(coalesce(e.payload->>'endTime', '')) ~ '^\d{2}:\d{2}$'
    and pg_catalog.btrim(e.payload->>'endTime') > pg_catalog.btrim(e.payload->>'startTime');

  select pg_catalog.count(*)
  into v_target_count
  from ov1_4_dreamhome_prod_schedule_targets;

  if v_target_count <> 4
    or (select pg_catalog.count(distinct row_fingerprint) from ov1_4_dreamhome_prod_schedule_targets) <> 4 then
    raise exception 'OV1.4 dreamhome_prod repair stopped: exact guarded target count is %, expected 4.', v_target_count;
  end if;

  if (select pg_catalog.count(distinct new_local_id) from ov1_4_dreamhome_prod_schedule_targets) <> 4 then
    raise exception 'OV1.4 dreamhome_prod repair stopped: payload identities are not four unique values.';
  end if;

  if exists (
    select 1
    from ov1_4_dreamhome_prod_schedule_targets t
    join public.center_cloud_entities collision
      on collision.center_id = 'dreamhome_prod'
      and collision.entity_type = 'schedule_session'
      and collision.local_id = t.new_local_id
      and collision.id <> t.id
  ) then
    raise exception 'OV1.4 dreamhome_prod repair stopped: normalized local_id collision detected.';
  end if;

  if exists (
    select 1
    from ov1_4_dreamhome_prod_schedule_targets t
    join public.center_core_command_result r
      on r.center_id = 'dreamhome_prod'
      and r.entity_type = 'schedule_session'
      and r.local_id in (t.old_local_id, t.new_local_id)
  ) then
    raise exception 'OV1.4 dreamhome_prod repair stopped: related C5.1 command history exists.';
  end if;

  select pg_catalog.count(*)
  into v_table_row_count_before
  from public.center_cloud_entities;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.string_agg(e.payload::text, E'\n' order by e.id),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ),
  pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.string_agg(
          (pg_catalog.to_jsonb(e) - 'local_id' - 'entity_version' - 'updated_at')::text,
          E'\n' order by e.id
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  into v_payload_digest_before, v_immutable_digest_before
  from public.center_cloud_entities e
  join ov1_4_dreamhome_prod_schedule_targets t on t.id = e.id;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.string_agg(pg_catalog.to_jsonb(e)::text, E'\n' order by e.id),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  into v_non_target_digest_before
  from public.center_cloud_entities e
  where not exists (
    select 1
    from ov1_4_dreamhome_prod_schedule_targets t
    where t.id = e.id
  );

  update public.center_cloud_entities e
  set local_id = t.new_local_id,
      entity_version = e.entity_version + 1,
      updated_at = v_migration_timestamp
  from ov1_4_dreamhome_prod_schedule_targets t
  where e.id = t.id
    and e.center_id = 'dreamhome_prod'
    and e.entity_type = 'schedule_session'
    and e.deleted_at is null
    and e.local_id = t.old_local_id
    and e.entity_version = t.old_entity_version
    and e.updated_at = t.old_updated_at;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 4 then
    raise exception 'OV1.4 dreamhome_prod repair stopped: updated % rows, expected 4.', v_updated_count;
  end if;

  if (select pg_catalog.count(*) from public.center_cloud_entities) <> v_table_row_count_before
    or (
      select pg_catalog.count(*)
      from public.center_cloud_entities e
      join ov1_4_dreamhome_prod_schedule_targets t on t.id = e.id
      where e.center_id = 'dreamhome_prod'
        and e.entity_type = 'schedule_session'
        and e.deleted_at is null
        and e.local_id = t.new_local_id
        and e.local_id = pg_catalog.btrim(e.payload->>'id')
        and e.entity_version = 2
        and e.updated_at = v_migration_timestamp
    ) <> 4
    or exists (
      select 1
      from public.center_cloud_entities e
      join ov1_4_dreamhome_prod_schedule_targets t
        on e.center_id = 'dreamhome_prod'
        and e.entity_type = 'schedule_session'
        and e.local_id = t.old_local_id
    ) then
    raise exception 'OV1.4 dreamhome_prod repair stopped: post-update count/identity/version invariant failed.';
  end if;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.string_agg(e.payload::text, E'\n' order by e.id),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ),
  pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.string_agg(
          (pg_catalog.to_jsonb(e) - 'local_id' - 'entity_version' - 'updated_at')::text,
          E'\n' order by e.id
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  into v_payload_digest_after, v_immutable_digest_after
  from public.center_cloud_entities e
  join ov1_4_dreamhome_prod_schedule_targets t on t.id = e.id;

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.string_agg(pg_catalog.to_jsonb(e)::text, E'\n' order by e.id),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  into v_non_target_digest_after
  from public.center_cloud_entities e
  where not exists (
    select 1
    from ov1_4_dreamhome_prod_schedule_targets t
    where t.id = e.id
  );

  if v_payload_digest_after is distinct from v_payload_digest_before
    or v_immutable_digest_after is distinct from v_immutable_digest_before
    or v_non_target_digest_after is distinct from v_non_target_digest_before then
    raise exception 'OV1.4 dreamhome_prod repair stopped: an unapproved row or field changed.';
  end if;
end
$migration$;

commit;
