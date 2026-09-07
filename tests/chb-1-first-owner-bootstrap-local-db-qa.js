import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const container = 'supabase_db_ichess-center-os'
const databases = ['chb1_fresh_qa', 'chb1_populated_qa']
const migration = readFileSync(
  'supabase/migrations/202609070001_chb_1_first_owner_bootstrap_governance.sql',
  'utf8',
)
const cleanSchema = readFileSync('supabase/clean-install/schema.sql', 'utf8')

function docker(args, { input = '', allowRestoreWarning = false } = {}) {
  const result = spawnSync('docker', ['exec', ...(input ? ['-i'] : []), container, ...args], {
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (allowRestoreWarning && result.status === 1) {
    const errors = String(result.stderr || '').split(/\r?\n/).filter((line) => line.includes('pg_restore: error:'))
    const knownOnly = errors.length === 1 && String(result.stderr).includes('permission denied to set parameter "log_min_messages"')
    if (knownOnly) return result
  }
  assert.equal(result.status, 0, `${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`)
  return result
}

function psql(database, sql, tuplesOnly = false) {
  return docker([
    'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database,
    ...(tuplesOnly ? ['-At', '-F', '|'] : []),
  ], { input: sql }).stdout.trim()
}

function createDatabase(database) {
  assert(/^chb1_[a-z]+_qa$/.test(database), 'QA database name must remain bounded.')
  docker(['dropdb', '-U', 'postgres', '--if-exists', database])
  docker(['createdb', '-U', 'postgres', '-T', 'template0', database])
  docker(['pg_restore', '-U', 'postgres', '-d', database, '--no-owner', '--no-privileges', '/tmp/chb1_schema_only.dump'], {
    allowRestoreWarning: true,
  })
}

const authFixture = (id, email) => `
  insert into auth.users(
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
  ) values (
    '${id}', 'authenticated', 'authenticated', '${email}', 'not-a-real-password', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), false, false
  );
`

const serviceClaims = `select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', false);`

try {
  docker(['pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema-only', '-Fc', '-f', '/tmp/chb1_schema_only.dump'])

  createDatabase('chb1_fresh_qa')
  psql('chb1_fresh_qa', `
    drop schema public cascade;
    create schema public authorization postgres;
    grant usage on schema public to anon, authenticated, service_role;
  `)
  psql('chb1_fresh_qa', cleanSchema)
  psql('chb1_fresh_qa', migration)
  psql('chb1_fresh_qa', `
    ${authFixture('10000000-0000-4000-8000-000000000001', 'bootstrap-target@example.invalid')}
    begin;
    set local role authenticated;
    select pg_catalog.set_config(
      'request.jwt.claims',
      '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001"}',
      true
    );
    do $qa$
    begin
      begin
        perform public.provision_center_for_owner('Unauthorized Public Signup');
        raise exception 'public_signup_center_provision_was_not_denied';
      exception when others then
        if sqlerrm not like '%owner_membership_required%' then raise; end if;
      end;
    end;
    $qa$;
    rollback;
    select count(*) from public.centers;
    select count(*) from public.center_members;
  `)
  psql('chb1_fresh_qa', `
    ${authFixture('10000000-0000-4000-8000-000000000002', 'race-loser@example.invalid')}
    ${serviceClaims}
    do $qa$
    declare v_result jsonb;
    begin
      if (select installation_state <> 'FRESH_UNINITIALIZED' or bootstrap_state <> 'UNCONFIGURED'
          from public.installation_handoff_control where singleton_id = 1)
         or (select count(*) from public.centers) <> 0
         or (select count(*) from public.center_members) <> 0 then
        raise exception 'fresh_initial_state_failed';
      end if;
      v_result := public.chb1_configure_fresh_bootstrap(
        '10000000-0000-4000-8000-000000000001', repeat('a',64), now() + interval '1 day'
      );
      v_result := public.chb1_claim_first_owner(
        'fresh-claim-request-0001', repeat('b',64),
        '10000000-0000-4000-8000-000000000001', repeat('a',64),
        'Cơ sở Đầu Tiên', 'co-so-dau-tien', repeat('c',64)
      );
      if v_result->>'state' <> 'OPERATIONAL_LOCKED' then raise exception 'fresh_claim_failed'; end if;
      if (select count(*) from public.centers where status='active') <> 1
         or (select count(*) from public.center_members where role='owner' and status='active') <> 1
         or (select count(*) from public.center_access_governance where status='active') <> 1 then
        raise exception 'fresh_one_center_owner_failed';
      end if;
      v_result := public.chb1_claim_first_owner(
        'fresh-claim-request-0001', repeat('b',64),
        '10000000-0000-4000-8000-000000000001', repeat('a',64),
        'Cơ sở Đầu Tiên', 'co-so-dau-tien', repeat('c',64)
      );
      if not (v_result->>'exact_retry')::boolean then raise exception 'fresh_exact_retry_failed'; end if;
      begin
        perform public.chb1_claim_first_owner(
          'fresh-claim-request-0001', repeat('d',64),
          '10000000-0000-4000-8000-000000000001', repeat('a',64),
          'Changed', 'changed', repeat('c',64)
        );
        raise exception 'changed_intent_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_changed_intent_conflict%' then raise; end if;
      end;
      begin
        perform public.chb1_claim_first_owner(
          'race-loser-request-0001', repeat('e',64),
          '10000000-0000-4000-8000-000000000002', repeat('a',64),
          'Second Center', 'second-center', repeat('f',64)
        );
        raise exception 'second_claim_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_bootstrap_claim_denied%' then raise; end if;
      end;
    end;
    $qa$;
  `)
  const freshEvidence = psql('chb1_fresh_qa', `
    select installation_state,janitor_state,bootstrap_state,
      (select count(*) from public.centers where status='active'),
      (select count(*) from public.center_members where role='owner' and status='active'),
      (select count(*) from public.center_members where role in ('admin','center_admin') and status='active'),
      (select count(*) from public.account_recovery_custodians where status='active')
    from public.installation_handoff_control;
  `, true)
  assert.equal(freshEvidence, 'OPERATIONAL_LOCKED|LOCKED|CLAIMED|1|1|0|0')

  createDatabase('chb1_populated_qa')
  psql('chb1_populated_qa', `
    create or replace function public.arg2_internal_require_service_role()
    returns void language plpgsql security definer set search_path=''
    as $fixture$ begin
      if (auth.jwt()->>'role') is distinct from 'service_role' then
        raise exception 'arg2_service_role_required';
      end if;
    end $fixture$;
    ${authFixture('20000000-0000-4000-8000-000000000001', 'tester-owner@example.invalid')}
    ${authFixture('20000000-0000-4000-8000-000000000002', 'handoff-target@example.invalid')}
    ${authFixture('20000000-0000-4000-8000-000000000003', 'subset-owner@example.invalid')}
    ${authFixture('20000000-0000-4000-8000-000000000004', 'tester-admin@example.invalid')}
    insert into public.centers(id,name,slug,environment,status) values
      ('qa-center-a','QA Center A','qa-center-a','production','active'),
      ('qa-center-b','QA Center B','qa-center-b','production','active'),
      ('qa-center-c','QA Center C','qa-center-c','production','active');
    insert into public.center_members(id,center_id,user_id,role,status) values
      ('21000000-0000-4000-8000-000000000001','qa-center-a','20000000-0000-4000-8000-000000000001','owner','active'),
      ('21000000-0000-4000-8000-000000000002','qa-center-b','20000000-0000-4000-8000-000000000001','owner','active'),
      ('21000000-0000-4000-8000-000000000003','qa-center-c','20000000-0000-4000-8000-000000000003','owner','active'),
      ('21000000-0000-4000-8000-000000000004','qa-center-a','20000000-0000-4000-8000-000000000004','admin','active');
    insert into storage.buckets(id,name,public) values
      ('transaction-images','transaction-images',false)
      on conflict (id) do nothing;
    insert into storage.objects(id,bucket_id,name,owner,owner_id) values
      ('22000000-0000-4000-8000-000000000001','transaction-images',
       'qa-center-a/2026/09/retained-evidence.jpg',
       '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
    insert into public.transaction_attachments(
      id,center_id,transaction_code,transaction_date,month_key,amount,cashflow_type,
      original_name,file_name,mime_type,size_bytes,storage_bucket,storage_path,uploaded_by
    ) values (
      '22000000-0000-4000-8000-000000000002','qa-center-a','QA-TX-001','2026-09-07','2026-09',1,'expense',
      'retained-evidence.jpg','retained-evidence.jpg','image/jpeg',1,'transaction-images',
      'qa-center-a/2026/09/retained-evidence.jpg','20000000-0000-4000-8000-000000000001'
    );
    ${serviceClaims}
    select public.arg2_activate_center_governance('qa-center-a','21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000004');
    select public.arg2_activate_center_governance('qa-center-b','21000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',null);
    select public.arg2_activate_center_governance('qa-center-c','21000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003',null);
  `)
  psql('chb1_populated_qa', migration)
  psql('chb1_populated_qa', `
    ${serviceClaims}
    do $qa$
    declare
      v_restore uuid;
      v_result jsonb;
      v_command uuid;
      v_center_updated_at timestamptz;
    begin
      if (select installation_state <> 'TESTER_ACTIVE' or janitor_state <> 'AVAILABLE'
          or bootstrap_state <> 'LOCKED_EXISTING'
          from public.installation_handoff_control where singleton_id=1) then
        raise exception 'populated_install_must_stay_tester_active';
      end if;
      if public.chb1_internal_actor_owns_complete_scope('20000000-0000-4000-8000-000000000001') then
        raise exception 'subset_owner_was_not_denied';
      end if;
      perform pg_catalog.set_config('app.chb1_internal_transition', 'on', true);
      update public.center_access_governance set status='disabled', governance_version=governance_version+1
        where center_id='qa-center-c';
      update public.center_members set status='revoked', membership_version=membership_version+1
        where center_id='qa-center-c';
      update public.centers set status='archived', updated_at=pg_catalog.transaction_timestamp()
        where id='qa-center-c';
      update public.installation_center_epochs set epoch_status='SEALED', sealed_at=pg_catalog.transaction_timestamp()
        where center_id='qa-center-c';
      if not public.chb1_internal_actor_owns_complete_scope('20000000-0000-4000-8000-000000000001') then
        raise exception 'complete_scope_owner_failed';
      end if;
      begin
        perform public.chb1_prepare_handoff_reset(
          'qa-missing-backup', repeat('0',64),
          '20000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000002', 1,
          '29999999-0000-4000-8000-000000000099',
          repeat('3',64), repeat('4',64), now()+interval '8 days', repeat('5',64)
        );
        raise exception 'missing_restore_gate_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_restore_verified_backup_required%' then raise; end if;
      end;
      insert into public.account_governance_commands(
        center_id,request_id,action,state,stage,intent_hash,actor_user_id,
        actor_membership_id,expected_governance_version
      ) values (
        'qa-center-a','qa-active-command','reset_admin','prepared','prepared',repeat('f',64),
        '20000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001',1
      );
      begin
        perform public.chb1_prepare_handoff_reset(
          'qa-active-command-block', repeat('0',64),
          '20000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000002', 1,
          '29999999-0000-4000-8000-000000000099',
          repeat('3',64), repeat('4',64), now()+interval '8 days', repeat('5',64)
        );
        raise exception 'active_command_gate_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_active_governance_or_business_command%' then raise; end if;
      end;
      update public.account_governance_commands set state='cancelled' where request_id='qa-active-command';
      v_restore := public.chb1_register_restore_verification(
        'qa-restore-manifest', repeat('1',64), now()-interval '2 hours', now()-interval '1 hour',
        'local_harness', now()+interval '1 day'
      );
      v_result := public.chb1_prepare_handoff_reset(
        'qa-reset-request-0001', repeat('2',64),
        '20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002', 1, v_restore,
        repeat('3',64), repeat('4',64), now()+interval '8 days', repeat('5',64)
      );
      v_command := (v_result->>'command_id')::uuid;
      if (v_result->>'center_count')::integer <> 2 then raise exception 'complete_scope_not_frozen'; end if;
      begin
        perform public.chb1_arm_handoff_reset(
          v_command,'20000000-0000-4000-8000-000000000001',repeat('3',64),
          'CHUáº¨N Bá» BĂ€N GIAO Há»† THá»NG',repeat('6',64)
        );
        raise exception 'cooling_gate_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_cooling_period_not_complete%' then raise; end if;
      end;
      update public.installation_handoff_commands set cooling_until=now()-interval '1 minute' where id=v_command;
      begin
        perform public.chb1_arm_handoff_reset(
          v_command,'20000000-0000-4000-8000-000000000001',repeat('3',64),
          'SAI CUM TU XAC NHAN',repeat('6',64)
        );
        raise exception 'exact_phrase_gate_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_exact_confirmation_required%' then raise; end if;
      end;
      select updated_at into v_center_updated_at from public.centers where id='qa-center-a';
      update public.centers set updated_at=updated_at+interval '1 second' where id='qa-center-a';
      begin
        perform public.chb1_arm_handoff_reset(
          v_command,'20000000-0000-4000-8000-000000000001',repeat('3',64),
          'CHUáº¨N Bá» BĂ€N GIAO Há»† THá»NG',repeat('6',64)
        );
        raise exception 'scope_drift_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_frozen_manifest_drift%' and sqlerrm not like '%chb1_frozen_scope_drift%' then raise; end if;
      end;
      update public.centers set updated_at=v_center_updated_at where id='qa-center-a';
      v_result := public.chb1_arm_handoff_reset(
        v_command,'20000000-0000-4000-8000-000000000001',repeat('3',64),
        'CHUẨN BỊ BÀN GIAO HỆ THỐNG',repeat('6',64)
      );
      if v_result->>'state' <> 'ARMED' then raise exception 'arm_failed'; end if;
      v_result := public.chb1_execute_handoff_reset(v_command,'20000000-0000-4000-8000-000000000001');
      if v_result->>'state' <> 'SESSION_DRAINING' then raise exception 'seal_failed'; end if;
      if (select count(*) from public.centers where status='active') <> 0
         or (select count(*) from public.center_members where status='active') <> 0
         or (select count(*) from public.center_members
              where user_id='20000000-0000-4000-8000-000000000002' and status='active') <> 0 then
        raise exception 'authority_was_not_revoked_before_session_repair';
      end if;
      begin
        perform public.chb1_get_bootstrap_context('20000000-0000-4000-8000-000000000001');
        raise exception 'old_owner_target_repair_path_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_bootstrap_target_required%' then raise; end if;
      end;
      begin
        perform public.chb1_get_bootstrap_context('20000000-0000-4000-8000-000000000004');
        raise exception 'admin_target_repair_path_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_bootstrap_target_required%' then raise; end if;
      end;
      v_result := public.chb1_get_bootstrap_context('20000000-0000-4000-8000-000000000002');
      if pg_catalog.jsonb_array_length(v_result->'server_drain_targets') <> 3 then
        raise exception 'exact_target_repair_scope_not_bounded';
      end if;
      perform public.chb1_claim_session_drain(v_command,'20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
      perform public.chb1_record_session_drain(v_command,'20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
        repeat('7',64),false,'qa_invalidation_failure');
      if (select installation_state from public.installation_handoff_control where singleton_id=1)
           <> 'RESET_REPAIR_REQUIRED'
         or (select bootstrap_state from public.installation_handoff_control where singleton_id=1)
           = 'READY' then
        raise exception 'failed_drain_exposed_false_handoff_ready';
      end if;
      perform pg_catalog.set_config('request.jwt.claims',
        '{"role":"authenticated","sub":"20000000-0000-4000-8000-000000000002"}', true);
      v_result := public.chb1_get_handoff_capability();
      if not (v_result->>'target_session_drain_required')::boolean
         or (v_result->>'bootstrap_available')::boolean
         or public.is_center_member('qa-center-a')
         or public.can_write_center('qa-center-a') then
        raise exception 'target_repair_capability_not_fail_closed';
      end if;
      perform pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
      begin
        perform public.chb1_execute_handoff_reset(v_command,'20000000-0000-4000-8000-000000000004');
        raise exception 'admin_reset_repair_path_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_reset_owner_required%' then raise; end if;
      end;
      if (select count(*) from public.centers where status='active') <> 0
         or (select count(*) from public.center_members where status='active') <> 0 then
        raise exception 'failed_repair_restored_old_authority';
      end if;
      begin
        perform public.chb1_promote_uninitialized_if_drained(v_command);
        raise exception 'failed_session_drain_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_session_drain_incomplete%' then raise; end if;
      end;
      perform public.chb1_claim_session_drain(v_command,'20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
      perform public.chb1_record_session_drain(v_command,'20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',
        repeat('7',64),true,null);
      perform public.chb1_claim_session_drain(v_command,'20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003');
      perform public.chb1_record_session_drain(v_command,'20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003',
        repeat('8',64),true,null);
      begin
        perform public.chb1_claim_session_drain(v_command,'20000000-0000-4000-8000-000000000004',
          '20000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000004');
        raise exception 'admin_session_drain_repair_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_reset_actor_or_target_drain_required%' then raise; end if;
      end;
      perform public.chb1_claim_session_drain(v_command,'20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000005');
      v_result := public.chb1_claim_session_drain(v_command,'20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000006');
      if (v_result->>'claimed')::boolean or (v_result->>'ok')::boolean then
        raise exception 'concurrent_session_mutation_claim_was_not_denied';
      end if;
      perform public.chb1_record_session_drain(v_command,'20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000005',
        repeat('b',64),true,null);
      v_result := public.chb1_record_session_drain(v_command,'20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000005',
        repeat('b',64),true,null);
      if not (v_result->>'exact_retry')::boolean then raise exception 'target_repair_retry_not_idempotent'; end if;
      v_result := public.chb1_claim_session_drain(v_command,'20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000006');
      if not (v_result->>'already_succeeded')::boolean then
        raise exception 'completed_session_mutation_was_not_reconciled';
      end if;
      perform public.chb1_claim_session_drain(v_command,'20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000007');
      perform public.chb1_record_session_drain(v_command,'20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000007',
        repeat('c',64),true,null);
      begin
        perform public.chb1_promote_uninitialized_if_drained(v_command);
        raise exception 'private_url_quarantine_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_private_url_quarantine_incomplete%' then raise; end if;
      end;
      update public.installation_handoff_control set session_drain_until=now()-interval '1 minute' where singleton_id=1;
      perform public.chb1_promote_uninitialized_if_drained(v_command);
      v_result := public.chb1_claim_first_owner(
        'post-reset-claim-0001', repeat('9',64),
        '20000000-0000-4000-8000-000000000002', repeat('4',64),
        'Cơ sở Bàn Giao', 'co-so-ban-giao', repeat('a',64)
      );
      if v_result->>'state' <> 'OPERATIONAL_LOCKED' then raise exception 'post_reset_bootstrap_failed'; end if;
      if (select count(*) from public.centers where status='active') <> 1
         or (select count(*) from public.centers where status='archived') <> 3
         or (select count(*) from public.center_members where status='active') <> 1
         or (select count(*) from public.account_recovery_custodians where status='active') <> 0 then
        raise exception 'business_clean_invariant_failed';
      end if;
      perform pg_catalog.set_config('request.jwt.claims',
        '{"role":"authenticated","sub":"20000000-0000-4000-8000-000000000002"}', true);
      v_result := public.chb1_get_handoff_capability();
      if (v_result->>'bootstrap_available')::boolean
         or (v_result->>'janitor_available')::boolean
         or (v_result->>'target_session_drain_required')::boolean then
        raise exception 'consumed_bootstrap_or_reset_reopened';
      end if;
      perform pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
      begin
        update public.installation_handoff_events set metadata='{}'::jsonb where command_id=v_command;
        raise exception 'event_update_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_handoff_event_is_immutable%' then raise; end if;
      end;
      begin
        perform public.chb1_prepare_handoff_reset(
          'qa-second-reset', repeat('d',64),
          '20000000-0000-4000-8000-000000000002',
          '20000000-0000-4000-8000-000000000001',
          (select control_version from public.installation_handoff_control where singleton_id=1),
          v_restore,repeat('3',64),repeat('4',64),now()+interval '8 days',repeat('5',64)
        );
        raise exception 'second_reset_was_not_denied';
      exception when others then
        if sqlerrm not like '%chb1_reset_not_available_or_stale%' then raise; end if;
      end;
    end;
    $qa$;
  `)
  const populatedEvidence = psql('chb1_populated_qa', `
    select installation_state,janitor_state,bootstrap_state,installation_epoch,
      (select count(*) from public.centers where status='active'),
      (select count(*) from public.centers where status='archived'),
      (select count(*) from public.center_members where status='active'),
      (select count(*) from public.installation_handoff_events),
      (select count(*) from public.installation_session_drain_targets where drain_state='SUCCEEDED'),
      (select count(*) from public.installation_handoff_commands where action='RESET' and state='FINALIZED'),
      (select count(*) from public.installation_handoff_commands where action='BOOTSTRAP' and state='FINALIZED'),
      (select count(*) from storage.objects)
    from public.installation_handoff_control;
  `, true)
  assert.equal(populatedEvidence, 'OPERATIONAL_LOCKED|LOCKED|CLAIMED|2|1|3|1|12|4|1|1|1')

  const retainedEventEvidence = psql('chb1_populated_qa', `
    select string_agg(event_type, ',' order by command_id nulls first,event_sequence)
    from public.installation_handoff_events;
  `, true)
  for (const requiredEvent of [
    'RESET_PREPARED', 'RESET_ARMED', 'RESET_EXECUTING', 'HISTORY_SEALED',
    'SESSION_DRAINING', 'SESSION_INVALIDATED',
    'UNINITIALIZED_NEXT_EPOCH', 'FIRST_OWNER_BOOTSTRAP_COMPLETE'
  ]) {
    assert.ok(retainedEventEvidence.split(',').includes(requiredEvent), `missing retained event ${requiredEvent}`)
  }

  const securityEvidence = psql('chb1_populated_qa', `
    select
      (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.installation_handoff_control'::regclass),
      (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.installation_handoff_events'::regclass),
      has_table_privilege('authenticated','public.installation_handoff_control','INSERT'),
      has_table_privilege('authenticated','public.installation_handoff_events','UPDATE'),
      has_function_privilege('authenticated','public.chb1_claim_first_owner(text,text,uuid,text,text,text,text)','EXECUTE'),
      has_function_privilege('service_role','public.chb1_claim_first_owner(text,text,uuid,text,text,text,text)','EXECUTE'),
      has_function_privilege('authenticated','public.chb1_claim_session_drain(uuid,uuid,uuid,uuid)','EXECUTE'),
      has_function_privilege('service_role','public.chb1_claim_session_drain(uuid,uuid,uuid,uuid)','EXECUTE'),
      (select count(*) from pg_policies where schemaname='public' and tablename='transaction_attachments'
        and policyname like 'members can % transaction attachments'),
      (select count(*) from pg_policies where schemaname='public' and tablename='transaction_attachments'
        and policyname like 'sup_cf_1 % transaction attachments by center role'),
      (select count(*) from pg_policies where schemaname='storage' and policyname like 'members can % transaction images'),
      (select count(*) from pg_policies where schemaname='storage' and policyname like 'sup_cf_1 % transaction image objects by center role');
  `, true)
  assert.equal(securityEvidence, 't|t|f|f|f|t|f|t|0|4|0|4')

  const retainedStorageVisibility = psql('chb1_populated_qa', `
    grant usage on schema storage to authenticated;
    grant select on storage.objects to authenticated;
    grant usage on schema public to authenticated;
    grant select on public.center_staff_document_attachments, public.transaction_attachments,
      public.center_members, public.centers to authenticated;
    grant execute on function public.can_manage_staff_document_attachments(text) to authenticated;
    grant execute on function public.can_manage_transaction_attachments(text) to authenticated;
    grant execute on function public.is_valid_transaction_attachment_path(text,text) to authenticated;
    grant execute on function storage.foldername(text) to authenticated;
    begin;
    set local role authenticated;
    select pg_catalog.set_config('request.jwt.claims',
      '{"role":"authenticated","sub":"20000000-0000-4000-8000-000000000001"}', true);
    select count(*) from storage.objects;
    select count(*) from public.transaction_attachments;
    rollback;
  `, true).split(/\r?\n/).filter((line) => /^\d+$/.test(line.trim()))
  assert.deepEqual(retainedStorageVisibility, ['0', '0'],
    'Retained Storage object and metadata history must be invisible to a sealed-epoch user.')

  const epochEvidence = psql('chb1_populated_qa', `
    select
      public.is_center_member('qa-center-a'),
      public.can_write_center('qa-center-a'),
      (select count(*) from public.centers),
      (select count(*) from public.center_members),
      (select count(*) from auth.users);
  `, true)
  assert.equal(epochEvidence, 'f|f|4|5|4')

  const guardBypass = spawnSync('docker', ['exec', '-i', container, 'psql', '-v', 'ON_ERROR_STOP=1',
    '-U', 'postgres', '-d', 'chb1_populated_qa'], {
    input: `
      select pg_catalog.set_config('request.jwt.claims',
        '{"role":"authenticated","sub":"20000000-0000-4000-8000-000000000001"}', false);
      select pg_catalog.set_config('app.chb1_internal_transition','on',false);
      update public.center_access_governance set updated_at=now() where center_id='qa-center-a';
    `,
    encoding: 'utf8',
  })
  assert.notEqual(guardBypass.status, 0, 'Authenticated caller must not bypass sealed-epoch write fence with a custom GUC.')
  assert.match(`${guardBypass.stdout}\n${guardBypass.stderr}`, /chb1_installation_write_fenced/)

  console.log('CHB-1 guarded local clone DB QA: PASS')
} finally {
  for (const database of databases) {
    if (/^chb1_[a-z]+_qa$/.test(database)) docker(['dropdb', '-U', 'postgres', '--if-exists', database])
  }
  docker(['rm', '-f', '/tmp/chb1_schema_only.dump'])
}
