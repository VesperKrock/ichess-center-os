begin;

-- PH-1 adds only the missing operational relationship between the canonical
-- P4A CRM Contact and the existing C5.1 Student aggregate.  It deliberately
-- does not create Guardian/Student conversion projections, backfill legacy
-- parent fields, or depend on the frozen P3D/P4B conversion executors.
do $ph_1_prerequisites$
begin
  if pg_catalog.to_regclass('public.crm_contact') is null
     or pg_catalog.to_regclass('public.crm_contact_lookup_control') is null
     or pg_catalog.to_regclass('public.crm_contact_lookup_evidence') is null
     or pg_catalog.to_regclass('public.crm_shared_command_result') is null
     or pg_catalog.to_regclass('public.center_cloud_entities') is null
     or pg_catalog.to_regclass('public.crm_audit_event') is null
     or pg_catalog.to_regclass('public.crm_outbox_event') is null
     or pg_catalog.to_regprocedure('public.c5_3_internal_assert_access(text,boolean,boolean)') is null
     or pg_catalog.to_regprocedure('public.c5_3_contains_protected_identity(text)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p1d_internal_append_audit_outbox(text,text,uuid,text,uuid,uuid,integer,integer,text,text,text,uuid)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3c_internal_source_aad(text,uuid,integer)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p4a_internal_canonical_payload(text[],text[])') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p4a_internal_parse_payload_v1(bytea)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p4a_internal_lookup_key(integer)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p4a_internal_lookup_digest(bytea,text,text,text,integer)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p4a_internal_target_epochs(text)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3c_internal_unwrap_contact_source_evidence(text,uuid,integer)') is null
     or pg_catalog.to_regprocedure('vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea)') is null
     or pg_catalog.to_regprocedure('vault._crypto_aead_det_noncegen()') is null then
    raise exception 'ph_1_missing_frozen_prerequisite';
  end if;

  if pg_catalog.to_regclass('public.crm_contact_student_operational_link') is not null
     or pg_catalog.to_regprocedure('public.ph_1_list_parent_student_links(text,boolean)') is not null
     or pg_catalog.to_regprocedure('public.ph_1_create_parent_student_link(text,uuid,uuid,text,text,boolean,text,text,uuid)') is not null
     or pg_catalog.to_regprocedure('public.ph_1_update_parent_student_link(text,uuid,integer,text,boolean,text,text,uuid)') is not null
     or pg_catalog.to_regprocedure('public.ph_1_end_parent_student_link(text,uuid,integer,text,uuid)') is not null
     or pg_catalog.to_regprocedure('public.ph_1_update_crm_contact_identity(text,uuid,integer,text,text[],text[],uuid)') is not null then
    raise exception 'ph_1_contract_already_exists';
  end if;
end;
$ph_1_prerequisites$;

create table public.crm_contact_student_operational_link (
  link_id uuid primary key,
  center_id text not null,
  crm_contact_id uuid not null,
  student_entity_type text not null default 'student',
  student_local_id text not null,
  relationship_type text not null,
  is_primary_contact boolean not null default false,
  financial_contact_role text not null default 'NONE',
  academic_contact_role text not null default 'NONE',
  link_status text not null default 'ACTIVE',
  link_version integer not null default 1,
  ended_reason_code text,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  ended_at timestamptz,
  constraint crm_contact_student_operational_link_center_fkey
    foreign key (center_id) references public.centers(id) on delete restrict,
  constraint crm_contact_student_operational_link_root_fkey
    foreign key (center_id) references public.center_crm_control(center_id) on delete restrict,
  constraint crm_contact_student_operational_link_contact_fkey
    foreign key (center_id, crm_contact_id)
    references public.crm_contact(center_id, crm_contact_id) on delete restrict,
  constraint crm_contact_student_operational_link_student_fkey
    foreign key (center_id, student_entity_type, student_local_id)
    references public.center_cloud_entities(center_id, entity_type, local_id) on delete restrict,
  constraint crm_contact_student_operational_link_created_by_fkey
    foreign key (created_by_user_id) references auth.users(id) on delete restrict,
  constraint crm_contact_student_operational_link_updated_by_fkey
    foreign key (updated_by_user_id) references auth.users(id) on delete restrict,
  constraint crm_contact_student_operational_link_center_link_key
    unique (center_id, link_id),
  constraint crm_contact_student_operational_link_student_type_check
    check (student_entity_type = 'student'),
  constraint crm_contact_student_operational_link_student_id_check
    check (
      pg_catalog.length(pg_catalog.btrim(student_local_id)) between 1 and 200
      and student_local_id = pg_catalog.btrim(student_local_id)
      and student_local_id !~ '[[:cntrl:]]'
    ),
  constraint crm_contact_student_operational_link_relationship_type_check
    check (relationship_type in ('PARENT', 'LEGAL_GUARDIAN', 'CAREGIVER', 'EMERGENCY_CONTACT', 'OTHER_REVIEWED')),
  constraint crm_contact_student_operational_link_contact_roles_check
    check (
      financial_contact_role in ('NONE', 'PRIMARY', 'SECONDARY')
      and academic_contact_role in ('NONE', 'PRIMARY', 'SECONDARY')
    ),
  constraint crm_contact_student_operational_link_status_check
    check (link_status in ('ACTIVE', 'ENDED')),
  constraint crm_contact_student_operational_link_version_check
    check (link_version >= 1),
  constraint crm_contact_student_operational_link_end_shape_check
    check (
      (link_status = 'ACTIVE' and ended_at is null and ended_reason_code is null)
      or (
        link_status = 'ENDED'
        and ended_at is not null
        and ended_reason_code ~ '^[A-Z0-9_]{1,80}$'
      )
    ),
  constraint crm_contact_student_operational_link_timestamp_check
    check (updated_at >= created_at and (ended_at is null or ended_at >= created_at))
);

create unique index crm_contact_student_operational_link_active_equivalent_idx
  on public.crm_contact_student_operational_link(
    center_id, crm_contact_id, student_local_id, relationship_type
  ) where link_status = 'ACTIVE';

create unique index crm_contact_student_operational_link_active_primary_idx
  on public.crm_contact_student_operational_link(center_id, student_local_id)
  where link_status = 'ACTIVE' and is_primary_contact;

create index crm_contact_student_operational_link_contact_idx
  on public.crm_contact_student_operational_link(center_id, crm_contact_id, link_status);

create index crm_contact_student_operational_link_student_idx
  on public.crm_contact_student_operational_link(center_id, student_local_id, link_status);

alter table public.crm_contact_student_operational_link enable row level security;
alter table public.crm_contact_student_operational_link force row level security;
revoke all on table public.crm_contact_student_operational_link
  from public, anon, authenticated, service_role;

create function public.ph_1_internal_guard_parent_student_link()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if pg_catalog.current_setting('ichess.ph_1_link_write', true) is distinct from 'on' then
    raise exception using errcode = '42501', message = 'PARENT_STUDENT_LINK_DIRECT_WRITE_DENIED';
  end if;

  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'PARENT_STUDENT_LINK_DELETE_DENIED';
  end if;

  if tg_op = 'INSERT' then
    if new.link_status <> 'ACTIVE' or new.link_version <> 1
       or new.ended_at is not null or new.ended_reason_code is not null then
      raise exception 'PARENT_STUDENT_LINK_INITIAL_STATE_INVALID';
    end if;
    return new;
  end if;

  if new.link_id is distinct from old.link_id
     or new.center_id is distinct from old.center_id
     or new.crm_contact_id is distinct from old.crm_contact_id
     or new.student_entity_type is distinct from old.student_entity_type
     or new.student_local_id is distinct from old.student_local_id
     or new.created_by_user_id is distinct from old.created_by_user_id
     or new.created_at is distinct from old.created_at
     or new.link_version <> old.link_version + 1
     or old.link_status <> 'ACTIVE'
     or new.link_status not in ('ACTIVE', 'ENDED') then
    raise exception 'PARENT_STUDENT_LINK_IMMUTABLE_OR_VERSION_INVALID';
  end if;

  new.updated_at := pg_catalog.transaction_timestamp();
  if new.link_status = 'ACTIVE' then
    new.ended_at := null;
    new.ended_reason_code := null;
  else
    new.ended_at := pg_catalog.transaction_timestamp();
  end if;
  return new;
end;
$function$;

create trigger ph_1_parent_student_link_guard
before insert or update or delete on public.crm_contact_student_operational_link
for each row execute function public.ph_1_internal_guard_parent_student_link();

create function public.ph_1_internal_begin_command(
  p_center_id text,
  p_idempotency_key uuid,
  p_operation text,
  p_intent jsonb
)
returns table(actor_user_id uuid, intent_digest bytea, replay_snapshot jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing public.crm_shared_command_result%rowtype;
  v_actor_user_id uuid := auth.uid();
begin
  actor_user_id := v_actor_user_id;
  if v_actor_user_id is null or p_idempotency_key is null
     or p_operation is null or p_operation = ''
     or p_intent is null or pg_catalog.jsonb_typeof(p_intent) <> 'object' then
    raise exception 'INVALID_COMMAND';
  end if;

  perform public.c5_3_internal_assert_access(p_center_id, true, true);
  intent_digest := extensions.digest(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_object(
        'contract_version', 1,
        'center_id', p_center_id,
        'operation', p_operation,
        'intent', p_intent
      )::text,
      'UTF8'
    ),
    'sha256'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_center_id || ':' || v_actor_user_id::text || ':' || p_idempotency_key::text,
      250801
    )
  );

  select r.* into v_existing
  from public.crm_shared_command_result r
  where r.center_id = p_center_id
    and r.actor_user_id = v_actor_user_id
    and r.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.intent_digest is distinct from intent_digest then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED_WITH_CHANGED_INTENT';
    end if;
    replay_snapshot := v_existing.result_snapshot
      || pg_catalog.jsonb_build_object('replayed', true);
  else
    replay_snapshot := null;
  end if;
  return next;
end;
$function$;

create function public.ph_1_internal_store_command(
  p_center_id text,
  p_actor_user_id uuid,
  p_idempotency_key uuid,
  p_intent_digest bytea,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_result is null or p_result->>'outcome_code' is distinct from 'COMMITTED'
     or p_result->>'replayed' is distinct from 'false' then
    raise exception 'COMMAND_RESULT_INVALID';
  end if;
  insert into public.crm_shared_command_result(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (
    p_center_id, p_actor_user_id, p_idempotency_key, p_intent_digest, p_result
  );
  return p_result;
end;
$function$;

create function public.ph_1_internal_assert_current_student(
  p_center_id text,
  p_student_local_id text
)
returns public.center_cloud_entities
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_student public.center_cloud_entities%rowtype;
begin
  select e.* into v_student
  from public.center_cloud_entities e
  where e.center_id = p_center_id
    and e.entity_type = 'student'
    and e.local_id = p_student_local_id
  for share;

  if not found or v_student.deleted_at is not null
     or pg_catalog.jsonb_typeof(v_student.payload) <> 'object'
     or pg_catalog.btrim(coalesce(v_student.payload->>'id', '')) <> p_student_local_id then
    raise exception using errcode = 'P0001', message = 'STUDENT_NOT_CURRENT_OR_NOT_FOUND';
  end if;
  return v_student;
end;
$function$;

create function public.ph_1_internal_assert_mutable_contact(
  p_center_id text,
  p_contact_id uuid
)
returns public.crm_contact
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_contact public.crm_contact%rowtype;
begin
  select c.* into v_contact
  from public.crm_contact c
  where c.center_id = p_center_id and c.crm_contact_id = p_contact_id
  for share;

  if not found or v_contact.contact_status = 'ARCHIVED' then
    raise exception using errcode = 'P0001', message = 'CONTACT_NOT_FOUND';
  end if;
  if v_contact.legacy_source_kind is distinct from 'local.parent_consultation.v1'
     or v_contact.contact_methods_crypto_version <> 2
     or v_contact.normalization_version <> 1 then
    raise exception using errcode = 'P0001', message = 'CONTACT_IDENTITY_UPDATE_UNSUPPORTED';
  end if;
  return v_contact;
end;
$function$;

create function public.ph_1_list_parent_student_links(
  p_center_id text,
  p_include_ended boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_links jsonb;
begin
  perform public.c5_3_internal_assert_access(v_center_id, false, true);

  select coalesce(pg_catalog.jsonb_agg(projected.item order by projected.created_at, projected.link_id), '[]'::jsonb)
    into v_links
  from (
    select l.created_at, l.link_id,
      pg_catalog.jsonb_build_object(
        'link_id', l.link_id,
        'link_version', l.link_version,
        'link_status', l.link_status,
        'relationship_type', l.relationship_type,
        'is_primary_contact', l.is_primary_contact,
        'financial_contact_role', l.financial_contact_role,
        'academic_contact_role', l.academic_contact_role,
        'ended_reason_code', l.ended_reason_code,
        'ended_at', l.ended_at,
        'crm_contact_id', c.crm_contact_id,
        'contact_version', c.contact_version,
        'contact_status', c.contact_status,
        'contact_display_name', c.display_name,
        'contact_phones', coalesce(identity_data.canonical_phones, array[]::text[]),
        'contact_emails', coalesce(identity_data.canonical_emails, array[]::text[]),
        'contact_identity_available', c.contact_status <> 'ARCHIVED',
        'student_local_id', l.student_local_id,
        'student_available', (
          s.deleted_at is null
          and pg_catalog.jsonb_typeof(s.payload) = 'object'
          and pg_catalog.btrim(coalesce(s.payload->>'id', '')) = l.student_local_id
        ),
        'student_entity_version', s.entity_version,
        'student_updated_at', s.updated_at,
        'created_at', l.created_at,
        'updated_at', l.updated_at
      ) as item
    from public.crm_contact_student_operational_link l
    join public.crm_contact c
      on c.center_id = l.center_id and c.crm_contact_id = l.crm_contact_id
    join public.center_cloud_entities s
      on s.center_id = l.center_id and s.entity_type = l.student_entity_type
      and s.local_id = l.student_local_id
    left join lateral (
      select parsed.canonical_phones, parsed.canonical_emails
      from public.f23_3e_p4a_internal_parse_payload_v1(
        public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
          c.center_id, c.crm_contact_id, c.contact_version
        )
      ) parsed
      where c.contact_status <> 'ARCHIVED'
    ) identity_data on true
    where l.center_id = v_center_id
      and (coalesce(p_include_ended, false) or l.link_status = 'ACTIVE')
  ) projected;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'PARENT_STUDENT_LINKS_READ',
    'center_id', v_center_id,
    'links', v_links,
    'read_at', pg_catalog.clock_timestamp()
  );
end;
$function$;

create function public.ph_1_create_parent_student_link(
  p_center_id text,
  p_link_id uuid,
  p_crm_contact_id uuid,
  p_student_local_id text,
  p_relationship_type text,
  p_is_primary_contact boolean,
  p_financial_contact_role text,
  p_academic_contact_role text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_student_local_id text := pg_catalog.btrim(coalesce(p_student_local_id, ''));
  v_relationship_type text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_relationship_type, '')));
  v_financial_role text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_financial_contact_role, '')));
  v_academic_role text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_academic_contact_role, '')));
  v_command record;
  v_student public.center_cloud_entities%rowtype;
  v_contact public.crm_contact%rowtype;
  v_link public.crm_contact_student_operational_link%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_result jsonb;
begin
  if p_link_id is null or p_crm_contact_id is null
     or v_student_local_id = '' or pg_catalog.length(v_student_local_id) > 200
     or v_student_local_id ~ '[[:cntrl:]]'
     or v_relationship_type not in ('PARENT', 'LEGAL_GUARDIAN', 'CAREGIVER', 'EMERGENCY_CONTACT', 'OTHER_REVIEWED')
     or v_financial_role not in ('NONE', 'PRIMARY', 'SECONDARY')
     or v_academic_role not in ('NONE', 'PRIMARY', 'SECONDARY') then
    raise exception 'INVALID_COMMAND';
  end if;

  select * into strict v_command
  from public.ph_1_internal_begin_command(
    v_center_id,
    p_idempotency_key,
    'CREATE_LINK',
    pg_catalog.jsonb_build_object(
      'link_id', p_link_id,
      'crm_contact_id', p_crm_contact_id,
      'student_local_id', v_student_local_id,
      'relationship_type', v_relationship_type,
      'is_primary_contact', coalesce(p_is_primary_contact, false),
      'financial_contact_role', v_financial_role,
      'academic_contact_role', v_academic_role
    )
  );
  if v_command.replay_snapshot is not null then return v_command.replay_snapshot; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_center_id || ':student:' || v_student_local_id, 250802)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_center_id || ':contact:' || p_crm_contact_id::text, 250803)
  );
  v_student := public.ph_1_internal_assert_current_student(v_center_id, v_student_local_id);
  v_contact := public.ph_1_internal_assert_mutable_contact(v_center_id, p_crm_contact_id);

  if exists (
    select 1 from public.crm_contact_student_operational_link l
    where l.link_id = p_link_id
  ) or exists (
    select 1 from public.crm_contact_student_operational_link l
    where l.center_id = v_center_id
      and l.crm_contact_id = p_crm_contact_id
      and l.student_local_id = v_student_local_id
      and l.relationship_type = v_relationship_type
      and l.link_status = 'ACTIVE'
  ) or (
    coalesce(p_is_primary_contact, false) and exists (
      select 1 from public.crm_contact_student_operational_link l
      where l.center_id = v_center_id
        and l.student_local_id = v_student_local_id
        and l.is_primary_contact
        and l.link_status = 'ACTIVE'
    )
  ) then
    raise exception using errcode = 'P0001', message = 'LINK_COLLISION_REVIEW_REQUIRED';
  end if;

  perform pg_catalog.set_config('ichess.ph_1_link_write', 'on', true);
  insert into public.crm_contact_student_operational_link(
    link_id, center_id, crm_contact_id, student_local_id,
    relationship_type, is_primary_contact, financial_contact_role,
    academic_contact_role, created_by_user_id, updated_by_user_id
  ) values (
    p_link_id, v_center_id, p_crm_contact_id, v_student_local_id,
    v_relationship_type, coalesce(p_is_primary_contact, false), v_financial_role,
    v_academic_role, v_command.actor_user_id, v_command.actor_user_id
  ) returning * into v_link;

  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.parent_student_link.created', v_command.actor_user_id,
    'crm_contact_student_operational_link', v_link.link_id, null,
    null, v_link.link_version, v_link.link_status, null,
    'PARENT_STUDENT_LINK_CREATED', v_correlation_id
  );

  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'operation', 'CREATE_LINK',
    'replayed', false, 'changed', true, 'link_id', v_link.link_id,
    'link_version', v_link.link_version, 'contact_version', v_contact.contact_version,
    'student_entity_version', v_student.entity_version,
    'correlation_id', v_correlation_id
  );
  return public.ph_1_internal_store_command(
    v_center_id, v_command.actor_user_id, p_idempotency_key,
    v_command.intent_digest, v_result
  );
end;
$function$;

create function public.ph_1_update_parent_student_link(
  p_center_id text,
  p_link_id uuid,
  p_expected_link_version integer,
  p_relationship_type text,
  p_is_primary_contact boolean,
  p_financial_contact_role text,
  p_academic_contact_role text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_relationship_type text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_relationship_type, '')));
  v_financial_role text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_financial_contact_role, '')));
  v_academic_role text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_academic_contact_role, '')));
  v_command record;
  v_link public.crm_contact_student_operational_link%rowtype;
  v_previous_version integer;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_result jsonb;
begin
  if p_link_id is null or p_expected_link_version is null or p_expected_link_version < 1
     or v_relationship_type not in ('PARENT', 'LEGAL_GUARDIAN', 'CAREGIVER', 'EMERGENCY_CONTACT', 'OTHER_REVIEWED')
     or v_financial_role not in ('NONE', 'PRIMARY', 'SECONDARY')
     or v_academic_role not in ('NONE', 'PRIMARY', 'SECONDARY') then
    raise exception 'INVALID_COMMAND';
  end if;

  select * into strict v_command
  from public.ph_1_internal_begin_command(
    v_center_id,
    p_idempotency_key,
    'UPDATE_LINK',
    pg_catalog.jsonb_build_object(
      'link_id', p_link_id,
      'expected_link_version', p_expected_link_version,
      'relationship_type', v_relationship_type,
      'is_primary_contact', coalesce(p_is_primary_contact, false),
      'financial_contact_role', v_financial_role,
      'academic_contact_role', v_academic_role
    )
  );
  if v_command.replay_snapshot is not null then return v_command.replay_snapshot; end if;

  select l.* into v_link
  from public.crm_contact_student_operational_link l
  where l.center_id = v_center_id and l.link_id = p_link_id
  for update;
  if not found or v_link.link_status <> 'ACTIVE' then
    raise exception using errcode = 'P0001', message = 'LINK_NOT_FOUND_OR_ENDED';
  end if;
  if v_link.link_version <> p_expected_link_version then
    raise exception using errcode = 'P0001', message = 'LINK_VERSION_STALE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_center_id || ':student:' || v_link.student_local_id, 250802)
  );
  perform public.ph_1_internal_assert_current_student(v_center_id, v_link.student_local_id);
  perform public.ph_1_internal_assert_mutable_contact(v_center_id, v_link.crm_contact_id);

  if coalesce(p_is_primary_contact, false) and exists (
    select 1 from public.crm_contact_student_operational_link l
    where l.center_id = v_center_id
      and l.student_local_id = v_link.student_local_id
      and l.link_id <> v_link.link_id
      and l.is_primary_contact
      and l.link_status = 'ACTIVE'
  ) then
    raise exception using errcode = 'P0001', message = 'LINK_COLLISION_REVIEW_REQUIRED';
  end if;

  if exists (
    select 1 from public.crm_contact_student_operational_link l
    where l.center_id = v_center_id
      and l.crm_contact_id = v_link.crm_contact_id
      and l.student_local_id = v_link.student_local_id
      and l.relationship_type = v_relationship_type
      and l.link_id <> v_link.link_id
      and l.link_status = 'ACTIVE'
  ) then
    raise exception using errcode = 'P0001', message = 'LINK_COLLISION_REVIEW_REQUIRED';
  end if;

  if v_link.relationship_type = v_relationship_type
     and v_link.is_primary_contact = coalesce(p_is_primary_contact, false)
     and v_link.financial_contact_role = v_financial_role
     and v_link.academic_contact_role = v_academic_role then
    v_result := pg_catalog.jsonb_build_object(
      'ok', true, 'outcome_code', 'COMMITTED', 'operation', 'UPDATE_LINK',
      'replayed', false, 'changed', false, 'link_id', v_link.link_id,
      'link_version', v_link.link_version, 'correlation_id', null
    );
  else
    v_previous_version := v_link.link_version;
    perform pg_catalog.set_config('ichess.ph_1_link_write', 'on', true);
    update public.crm_contact_student_operational_link l set
      relationship_type = v_relationship_type,
      is_primary_contact = coalesce(p_is_primary_contact, false),
      financial_contact_role = v_financial_role,
      academic_contact_role = v_academic_role,
      link_version = l.link_version + 1,
      updated_by_user_id = v_command.actor_user_id
    where l.center_id = v_center_id and l.link_id = p_link_id
    returning * into v_link;

    perform public.f23_3e_p1d_internal_append_audit_outbox(
      v_center_id, 'crm.parent_student_link.updated', v_command.actor_user_id,
      'crm_contact_student_operational_link', v_link.link_id, null,
      v_previous_version, v_link.link_version, v_link.link_status, null,
      'PARENT_STUDENT_LINK_UPDATED', v_correlation_id
    );
    v_result := pg_catalog.jsonb_build_object(
      'ok', true, 'outcome_code', 'COMMITTED', 'operation', 'UPDATE_LINK',
      'replayed', false, 'changed', true, 'link_id', v_link.link_id,
      'link_version', v_link.link_version, 'correlation_id', v_correlation_id
    );
  end if;

  return public.ph_1_internal_store_command(
    v_center_id, v_command.actor_user_id, p_idempotency_key,
    v_command.intent_digest, v_result
  );
end;
$function$;

create function public.ph_1_end_parent_student_link(
  p_center_id text,
  p_link_id uuid,
  p_expected_link_version integer,
  p_safe_reason_code text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_reason text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_safe_reason_code, '')));
  v_command record;
  v_link public.crm_contact_student_operational_link%rowtype;
  v_previous_version integer;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_result jsonb;
begin
  if p_link_id is null or p_expected_link_version is null or p_expected_link_version < 1
     or v_reason !~ '^[A-Z0-9_]{1,80}$' then
    raise exception 'INVALID_COMMAND';
  end if;

  select * into strict v_command
  from public.ph_1_internal_begin_command(
    v_center_id,
    p_idempotency_key,
    'END_LINK',
    pg_catalog.jsonb_build_object(
      'link_id', p_link_id,
      'expected_link_version', p_expected_link_version,
      'safe_reason_code', v_reason
    )
  );
  if v_command.replay_snapshot is not null then return v_command.replay_snapshot; end if;

  select l.* into v_link
  from public.crm_contact_student_operational_link l
  where l.center_id = v_center_id and l.link_id = p_link_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'LINK_NOT_FOUND_OR_ENDED';
  end if;
  if v_link.link_status <> 'ACTIVE' or v_link.link_version <> p_expected_link_version then
    raise exception using errcode = 'P0001', message = 'LINK_VERSION_STALE';
  end if;

  v_previous_version := v_link.link_version;
  perform pg_catalog.set_config('ichess.ph_1_link_write', 'on', true);
  update public.crm_contact_student_operational_link l set
    link_status = 'ENDED',
    ended_reason_code = v_reason,
    link_version = l.link_version + 1,
    updated_by_user_id = v_command.actor_user_id
  where l.center_id = v_center_id and l.link_id = p_link_id
  returning * into v_link;

  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.parent_student_link.ended', v_command.actor_user_id,
    'crm_contact_student_operational_link', v_link.link_id, null,
    v_previous_version, v_link.link_version, v_link.link_status,
    pg_catalog.replace(pg_catalog.lower(v_reason), '_', '-'),
    'PARENT_STUDENT_LINK_ENDED', v_correlation_id
  );
  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'operation', 'END_LINK',
    'replayed', false, 'changed', true, 'link_id', v_link.link_id,
    'link_version', v_link.link_version, 'link_status', v_link.link_status,
    'correlation_id', v_correlation_id
  );
  return public.ph_1_internal_store_command(
    v_center_id, v_command.actor_user_id, p_idempotency_key,
    v_command.intent_digest, v_result
  );
end;
$function$;

create function public.ph_1_update_crm_contact_identity(
  p_center_id text,
  p_crm_contact_id uuid,
  p_expected_contact_version integer,
  p_display_name text,
  p_phones text[],
  p_emails text[],
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_display_name text := pg_catalog.btrim(coalesce(p_display_name, ''));
  v_command record;
  v_contact public.crm_contact%rowtype;
  v_payload record;
  v_current_payload bytea;
  v_current_identity record;
  v_epochs integer[];
  v_epoch integer;
  v_key bytea;
  v_value text;
  v_digest bytea;
  v_digests bytea[] := array[]::bytea[];
  v_nonce bytea;
  v_sealed bytea;
  v_envelope bytea;
  v_previous_version integer;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_result jsonb;
begin
  if p_crm_contact_id is null or p_expected_contact_version is null
     or p_expected_contact_version < 1
     or v_display_name = '' or pg_catalog.length(v_display_name) > 240
     or v_display_name ~ '[[:cntrl:]]'
     or public.c5_3_contains_protected_identity(v_display_name) then
    raise exception 'INVALID_COMMAND';
  end if;

  select * into strict v_payload
  from public.f23_3e_p4a_internal_canonical_payload(p_phones, p_emails);

  select * into strict v_command
  from public.ph_1_internal_begin_command(
    v_center_id,
    p_idempotency_key,
    'UPDATE_CONTACT_IDENTITY',
    pg_catalog.jsonb_build_object(
      'crm_contact_id', p_crm_contact_id,
      'expected_contact_version', p_expected_contact_version,
      'display_name', v_display_name,
      'phones', v_payload.canonical_phones,
      'emails', v_payload.canonical_emails
    )
  );
  if v_command.replay_snapshot is not null then return v_command.replay_snapshot; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_center_id || ':contact:' || p_crm_contact_id::text, 250803)
  );
  perform c.center_id from public.crm_contact_lookup_control c
  where c.center_id = v_center_id for update;
  if not found then raise exception 'LOOKUP_CONTROL_UNAVAILABLE'; end if;

  select c.* into v_contact
  from public.crm_contact c
  where c.center_id = v_center_id and c.crm_contact_id = p_crm_contact_id
  for update;
  if not found or v_contact.contact_status = 'ARCHIVED' then
    raise exception using errcode = 'P0001', message = 'CONTACT_NOT_FOUND';
  end if;
  if v_contact.contact_version <> p_expected_contact_version then
    raise exception using errcode = 'P0001', message = 'CONTACT_VERSION_STALE';
  end if;
  if v_contact.legacy_source_kind is distinct from 'local.parent_consultation.v1'
     or v_contact.contact_methods_crypto_version <> 2
     or v_contact.normalization_version <> 1 then
    raise exception using errcode = 'P0001', message = 'CONTACT_IDENTITY_UPDATE_UNSUPPORTED';
  end if;

  v_current_payload := public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
    v_center_id, p_crm_contact_id, v_contact.contact_version
  );
  select * into strict v_current_identity
  from public.f23_3e_p4a_internal_parse_payload_v1(v_current_payload);

  v_epochs := public.f23_3e_p4a_internal_target_epochs(v_center_id);
  foreach v_epoch in array v_epochs loop
    v_key := public.f23_3e_p4a_internal_lookup_key(v_epoch);
    foreach v_value in array v_payload.canonical_phones loop
      v_digest := public.f23_3e_p4a_internal_lookup_digest(
        v_key, v_center_id, 'PHONE', v_value, v_epoch
      );
      v_digests := v_digests || v_digest;
    end loop;
    foreach v_value in array v_payload.canonical_emails loop
      v_digest := public.f23_3e_p4a_internal_lookup_digest(
        v_key, v_center_id, 'EMAIL', v_value, v_epoch
      );
      v_digests := v_digests || v_digest;
    end loop;
  end loop;
  select pg_catalog.array_agg(x order by x) into v_digests
  from (select distinct pg_catalog.unnest(v_digests) x) q;

  for v_digest in select x from pg_catalog.unnest(v_digests) x order by x
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_center_id || ':identity:' || pg_catalog.encode(v_digest, 'hex'), 250804)
    );
  end loop;

  if exists (
    select 1
    from public.crm_contact_lookup_evidence e
    join public.crm_contact other
      on other.center_id = e.center_id and other.crm_contact_id = e.crm_contact_id
    where e.center_id = v_center_id
      and e.crm_contact_id <> p_crm_contact_id
      and e.evidence_status = 'ACTIVE'
      and e.lookup_digest = any(v_digests)
  ) then
    raise exception using errcode = 'P0001', message = 'CONTACT_IDENTITY_COLLISION_REVIEW_REQUIRED';
  end if;

  if exists (
    select 1 from public.crm_contact_lookup_evidence e
    where e.center_id = v_center_id
      and e.crm_contact_id = p_crm_contact_id
      and e.evidence_status = 'RETIRED'
      and e.lookup_digest = any(v_digests)
  ) then
    raise exception using errcode = 'P0001', message = 'CONTACT_IDENTITY_REACTIVATION_REVIEW_REQUIRED';
  end if;

  -- Even an unchanged save must pass collision review. P4A intentionally
  -- permits duplicate candidates for later human review; PH-1 must never
  -- bless one of those collisions merely by returning early as a no-op.
  if v_contact.display_name = v_display_name
     and v_current_identity.canonical_phones is not distinct from v_payload.canonical_phones
     and v_current_identity.canonical_emails is not distinct from v_payload.canonical_emails then
    v_result := pg_catalog.jsonb_build_object(
      'ok', true, 'outcome_code', 'COMMITTED',
      'operation', 'UPDATE_CONTACT_IDENTITY', 'replayed', false,
      'changed', false, 'crm_contact_id', p_crm_contact_id,
      'contact_version', v_contact.contact_version, 'correlation_id', null
    );
    return public.ph_1_internal_store_command(
      v_center_id, v_command.actor_user_id, p_idempotency_key,
      v_command.intent_digest, v_result
    );
  end if;

  begin
    v_nonce := vault._crypto_aead_det_noncegen();
    if pg_catalog.octet_length(v_nonce) <> 16 then raise exception 'bad nonce'; end if;
    v_sealed := vault._crypto_aead_det_encrypt(
      v_payload.payload,
      public.f23_3e_p3c_internal_source_aad(v_center_id, p_crm_contact_id, 1),
      1::bigint, pg_catalog.convert_to('iC3Src01', 'UTF8'), v_nonce
    );
    if pg_catalog.octet_length(v_sealed) not between 33 and 65568 then raise exception 'bad sealed'; end if;
    v_envelope := pg_catalog.convert_to('IC3CSE01', 'UTF8')
      || public.f23_3e_p3c_internal_u8(1)
      || public.f23_3e_p3c_internal_u8(1)
      || public.f23_3e_p3c_internal_u32(1)
      || public.f23_3e_p3c_internal_u16(16)
      || v_nonce
      || public.f23_3e_p3c_internal_u32(pg_catalog.octet_length(v_sealed))
      || v_sealed;
  exception when others then
    raise exception using errcode = 'P0001', message = 'CONTACT_IDENTITY_PROTECTION_FAILED';
  end;

  perform pg_catalog.set_config('ichess.p4a_lookup_write', 'on', true);
  foreach v_epoch in array v_epochs loop
    v_key := public.f23_3e_p4a_internal_lookup_key(v_epoch);
    foreach v_value in array v_payload.canonical_phones loop
      v_digest := public.f23_3e_p4a_internal_lookup_digest(
        v_key, v_center_id, 'PHONE', v_value, v_epoch
      );
      insert into public.crm_contact_lookup_evidence(
        center_id, crm_contact_id, field_kind, normalizer_version,
        digest_contract_version, key_epoch, lookup_digest
      ) values (
        v_center_id, p_crm_contact_id, 'PHONE', 1, 1, v_epoch, v_digest
      ) on conflict do nothing;
    end loop;
    foreach v_value in array v_payload.canonical_emails loop
      v_digest := public.f23_3e_p4a_internal_lookup_digest(
        v_key, v_center_id, 'EMAIL', v_value, v_epoch
      );
      insert into public.crm_contact_lookup_evidence(
        center_id, crm_contact_id, field_kind, normalizer_version,
        digest_contract_version, key_epoch, lookup_digest
      ) values (
        v_center_id, p_crm_contact_id, 'EMAIL', 1, 1, v_epoch, v_digest
      ) on conflict do nothing;
    end loop;
  end loop;
  update public.crm_contact_lookup_evidence e set
    evidence_status = 'RETIRED',
    evidence_version = e.evidence_version + 1
  where e.center_id = v_center_id
    and e.crm_contact_id = p_crm_contact_id
    and e.evidence_status = 'ACTIVE'
    and not (e.lookup_digest = any(v_digests));

  v_previous_version := v_contact.contact_version;
  update public.crm_contact c set
    display_name = v_display_name,
    protected_contact_methods_ciphertext = v_envelope,
    contact_methods_crypto_version = 2,
    normalized_lookup_digests = v_digests,
    normalization_version = 1,
    contact_version = c.contact_version + 1
  where c.center_id = v_center_id and c.crm_contact_id = p_crm_contact_id
  returning * into v_contact;

  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.contact.identity_updated', v_command.actor_user_id,
    'crm_contact', p_crm_contact_id, null,
    v_previous_version, v_contact.contact_version, v_contact.contact_status,
    'operator-explicit-identity-update', 'CONTACT_IDENTITY_UPDATED', v_correlation_id
  );
  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED',
    'operation', 'UPDATE_CONTACT_IDENTITY', 'replayed', false,
    'changed', true, 'crm_contact_id', p_crm_contact_id,
    'contact_version', v_contact.contact_version,
    'correlation_id', v_correlation_id
  );
  return public.ph_1_internal_store_command(
    v_center_id, v_command.actor_user_id, p_idempotency_key,
    v_command.intent_digest, v_result
  );
end;
$function$;

do $ph_1_revoke_all$
declare
  v_signature text;
begin
  for v_signature in
    select p.oid::pg_catalog.regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'ph_1_%'
  loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_signature
    );
  end loop;
end;
$ph_1_revoke_all$;

grant execute on function public.ph_1_list_parent_student_links(text,boolean) to authenticated;
grant execute on function public.ph_1_create_parent_student_link(text,uuid,uuid,text,text,boolean,text,text,uuid) to authenticated;
grant execute on function public.ph_1_update_parent_student_link(text,uuid,integer,text,boolean,text,text,uuid) to authenticated;
grant execute on function public.ph_1_end_parent_student_link(text,uuid,integer,text,uuid) to authenticated;
grant execute on function public.ph_1_update_crm_contact_identity(text,uuid,integer,text,text[],text[],uuid) to authenticated;

comment on table public.crm_contact_student_operational_link is
  'PH-1 explicit exact-center operational link between a canonical CRM Contact and a C5.1 Student; no implicit conversion, import, or hard delete.';
comment on function public.ph_1_update_crm_contact_identity(text,uuid,integer,text,text[],text[],uuid) is
  'Authenticated Owner/Admin exact-center protected Contact identity update with expected-version, collision review, idempotency, audit and outbox.';

commit;
