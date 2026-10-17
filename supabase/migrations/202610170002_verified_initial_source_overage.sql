-- LOCAL CANDIDATE ONLY. A verified source overage is not a priced new term.
begin;
do $preimage$
declare expected record;
begin
  for expected in select * from (values
    ('public.v2_4_mutate_package_cycle(text,jsonb,uuid)','a2775a47906bfb9a512aa9ed5e3c38ac1d510403fe776d2d52f848e4e6eb2b98'),
    ('public.tuition_final_guard_cycle_terms()','a785645f154e342a32f6804a560ced8c7be54062f0c000ddc1872d78f429d92e'),
    ('public.tuition_final_cycle_json(text,uuid,jsonb)','1148db3c77bf2609ccb38715d5a4cdb2ecd3c9d00c2acb4d5407f9811247a2a3'),
    ('public.v2_4_list_package_cycle_state(text)','0a91307816cd7496316dd6f854d64dd7c142b2be2f1efce9c6a36b2d518c494a')
  ) t(signature,sha) loop
    if encode(sha256(convert_to(pg_get_functiondef(expected.signature::regprocedure),'UTF8')),'hex')<>expected.sha
    then raise exception 'INITIAL_OVERAGE_PREIMAGE_DRIFT'; end if;
  end loop;
  if exists(select 1 from pg_attribute where attrelid='public.center_tuition_initial_import_baselines'::regclass
    and attname='source_overage_sessions' and not attisdropped)
    or (select encode(sha256(convert_to(pg_get_constraintdef(oid),'UTF8')),'hex') from pg_constraint
      where conrelid='public.center_tuition_initial_import_baselines'::regclass and conname='center_tuition_initial_import_baselines_check')
       is distinct from 'd9d9898350271938203ab65d61e1d6d9ee1b27b4742eed028f6b830b6beb702c'
    or (select encode(sha256(convert_to(pg_get_constraintdef(oid),'UTF8')),'hex') from pg_constraint
      where conrelid='public.center_tuition_package_cycles'::regclass and conname='center_tuition_package_cycles_snapshot_check')
       is distinct from '070a8e6c3433e8b94eb9931e20ba4944663325e677617503a6b81d61548f7eb9'
  then raise exception 'INITIAL_OVERAGE_SCHEMA_DRIFT'; end if;
end $preimage$;

alter table public.center_tuition_initial_import_baselines
  add column source_overage_sessions integer not null default 0;
alter table public.center_tuition_initial_import_baselines
  drop constraint center_tuition_initial_import_baselines_check,
  add constraint center_tuition_initial_import_baselines_check check (
    baseline_used_sessions>=0 and source_overage_sessions>=0 and (
      (source_overage_sessions=0 and baseline_used_sessions<=total_sessions_snapshot)
      or (source_overage_sessions>0 and baseline_used_sessions::bigint=total_sessions_snapshot::bigint+source_overage_sessions::bigint)
    ));
do $cycle_constraint$
declare definition text;
begin
  select pg_get_constraintdef(oid) into strict definition from pg_constraint
    where conrelid='public.center_tuition_package_cycles'::regclass and conname='center_tuition_package_cycles_snapshot_check';
  definition:=replace(definition,'(baseline_used_sessions <= total_sessions_snapshot)',
    '((baseline_used_sessions <= total_sessions_snapshot) or (initial_import_baseline_id is not null and origin=''OPERATOR_BASELINE'' and cycle_number=1 and predecessor_cycle_id is null))');
  alter table public.center_tuition_package_cycles drop constraint center_tuition_package_cycles_snapshot_check;
  execute 'alter table public.center_tuition_package_cycles add constraint center_tuition_package_cycles_snapshot_check '||definition;
end $cycle_constraint$;

do $patch$
declare d text; original_contract jsonb; after_contract jsonb;
begin
  select jsonb_object_agg(proname,jsonb_build_object('owner',proowner,'acl',proacl,'args',proargtypes::text,
    'returns',prorettype,'security',prosecdef,'config',proconfig)) into original_contract from pg_proc
    where oid in ('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure,
      'public.tuition_final_guard_cycle_terms()'::regprocedure,'public.tuition_final_cycle_json(text,uuid,jsonb)'::regprocedure,
      'public.v2_4_list_package_cycle_state(text)'::regprocedure);
  d:=pg_get_functiondef('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure);
  d:=replace(d,'cutoff date; used integer; intent bytea;','cutoff date; used integer; overage integer; intent bytea;');
  d:=replace(d,'  if used is null or used not between 0 and package.total_sessions or cutoff is null',
    $overage$
  overage:=0;
  if p_command ? 'source_overage_sessions' then
    if jsonb_typeof(p_command->'source_overage_sessions')<>'number'
      or coalesce(p_command->>'source_overage_sessions','') !~ '^[0-9]+$'
      or (p_command->>'source_overage_sessions')::numeric>2147483647
    then raise exception 'INITIAL_IMPORT_OVERAGE_REVIEW_REQUIRED'; end if;
    overage:=(p_command->>'source_overage_sessions')::integer;
  end if;
  if overage<>greatest(used-package.total_sessions,0)
  then raise exception 'INITIAL_IMPORT_OVERAGE_REVIEW_REQUIRED'; end if;
  if used is null or used<0 or cutoff is null$overage$);
  d:=replace(d,'financial_facts,review_note,created_by)', 'financial_facts,review_note,created_by,source_overage_sessions)');
  d:=replace(d,'p_command->>''review_note'',actor) returning * into existing;',
    'p_command->>''review_note'',actor,overage) returning * into existing;');
  execute d;

  d:=pg_get_functiondef('public.tuition_final_guard_cycle_terms()'::regprocedure);
  d:=replace(d,'  return new;', $guard$
  -- Only the exact verified import may exceed N; ordinary cycles stay bounded.
  if new.total_sessions_snapshot is not null and new.baseline_used_sessions>new.total_sessions_snapshot then
    if new.origin<>'OPERATOR_BASELINE' or new.cycle_number<>1 or new.predecessor_cycle_id is not null
      or not exists(select 1 from public.center_tuition_initial_import_baselines b
        where b.id=new.initial_import_baseline_id and b.center_id=new.center_id and b.student_local_id=new.student_local_id
          and b.package_catalog_id=new.package_catalog_id and b.total_sessions_snapshot=new.total_sessions_snapshot
          and b.baseline_used_sessions=new.baseline_used_sessions
          and b.source_overage_sessions=new.baseline_used_sessions-new.total_sessions_snapshot and b.source_overage_sessions>0)
    then raise exception 'INITIAL_OVERAGE_SOURCE_CONFLICT'; end if;
  end if;
  return new;$guard$);
  execute d;

  d:=pg_get_functiondef('public.tuition_final_cycle_json(text,uuid,jsonb)'::regprocedure);
  d:=replace(d,'''review_note'',cycle.baseline_review_note),',
    '''review_note'',cycle.baseline_review_note) || case when baseline.source_overage_sessions>0 then jsonb_build_object(''source_overage_sessions'',baseline.source_overage_sessions) else ''{}''::jsonb end,');
  execute d;

  d:=pg_get_functiondef('public.v2_4_list_package_cycle_state(text)'::regprocedure);
  d:=replace(d,'declare snapshot jsonb;','declare snapshot jsonb; students jsonb;');
  d:=replace(d,' return snapshot ||', $projection$
 select coalesce(jsonb_agg(case when b.source_overage_sessions>0 and s.value ? 'initial_import_baseline'
   then jsonb_set(s.value,'{initial_import_baseline,source_overage_sessions}',to_jsonb(b.source_overage_sessions))
   else s.value end order by s.ordinal),'[]'::jsonb) into students
 from jsonb_array_elements(snapshot->'students') with ordinality s(value,ordinal)
 left join public.center_tuition_initial_import_baselines b
   on b.center_id=p_center_id and b.student_local_id=s.value->>'student_id';
 snapshot:=jsonb_set(snapshot,'{students}',students);
 return snapshot || jsonb_build_object('initial_import_overage_capability','verified-source-overage-v1') ||$projection$);
  execute d;
  select jsonb_object_agg(proname,jsonb_build_object('owner',proowner,'acl',proacl,'args',proargtypes::text,
    'returns',prorettype,'security',prosecdef,'config',proconfig)) into after_contract from pg_proc
    where oid in ('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure,
      'public.tuition_final_guard_cycle_terms()'::regprocedure,'public.tuition_final_cycle_json(text,uuid,jsonb)'::regprocedure,
      'public.v2_4_list_package_cycle_state(text)'::regprocedure);
  if after_contract is distinct from original_contract then raise exception 'INITIAL_OVERAGE_AUTH_CONTRACT_DRIFT'; end if;
end $patch$;
comment on column public.center_tuition_initial_import_baselines.source_overage_sessions is
  'Explicit verified source excess above N. Source A/B stays exact. No automatic price, attendance contribution, settlement or successor is implied.';
notify pgrst,'reload schema';
commit;
