import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

import {
  buildC53AssignCaseCommand,
  buildC53CreateLeadCommand,
  mutateC53CrmSharedTruth,
  pullC53CrmSharedTruth,
} from '../src/cloud-authoritative-crm.js'

assert.equal(process.env.ICHESS_F4B_LOCAL_QA_ALLOW, 'YES', 'ICHESS_F4B_LOCAL_QA_ALLOW=YES is required')
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked production project references are forbidden')

const qaWorkdir = String(process.env.ICHESS_F4B_LOCAL_QA_WORKDIR || '').trim()
assert(qaWorkdir, 'ICHESS_F4B_LOCAL_QA_WORKDIR is required')
const config = readFileSync(`${qaWorkdir}/supabase/config.toml`, 'utf8')
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1]
assert(projectId?.startsWith('ichess-f4b-authority-qa-'), 'A disposable F4B project is required')

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`)
  return result.stdout
}

const statusOutput = process.platform === 'win32'
  ? run(process.env.ComSpec, ['/d', '/s', '/c', 'npx --no-install supabase status -o json'], { cwd: qaWorkdir })
  : run('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], { cwd: qaWorkdir })
const status = JSON.parse(statusOutput)
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) assert.equal(typeof status[key], 'string')
for (const url of [status.DB_URL, status.API_URL]) {
  assert(new Set(['127.0.0.1', 'localhost', '::1']).has(new URL(url).hostname.toLowerCase()))
}

const containerRows = run('docker', [
  'ps', '--filter', `label=com.supabase.cli.project=${projectId}`,
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]).trim().split(/\r?\n/).filter(Boolean).map((row) => row.split('|'))
const dbRows = containerRows.filter(([, name, image]) => name === `supabase_db_${projectId}` && /supabase\/postgres/i.test(image))
assert.equal(dbRows.length, 1, 'Exactly one disposable local database must be running')
const containerId = dbRows[0][0]

const psql = (sql, user = 'postgres') => run('docker', [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', user, '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
], { input: sql }).trim()
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const uuid = (value) => `${quote(value)}::uuid`

for (const table of [
  'crm_contact_student_operational_link',
  'center_tuition_package_catalog',
  'center_tuition_package_cycles',
]) {
  assert.equal(psql(`select (relrowsecurity and relforcerowsecurity)::text from pg_class where oid=${quote(`public.${table}`)}::regclass;`), 'true')
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(psql(`select has_table_privilege(${quote(role)},${quote(`public.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f')
  }
}

const functionContext = (name, args) => psql(`
  select pg_catalog.pg_get_userbyid(p.proowner) || '|' || p.prosecdef::text || '|' || coalesce(array_to_string(p.proconfig, ','),'')
  from pg_catalog.pg_proc p
  where p.oid=${quote(`public.${name}(${args})`)}::regprocedure;
`)
assert.equal(functionContext('f4b_convert_crm_case_to_student', 'text,uuid,uuid,integer,integer,text,text,bigint,jsonb,text,text,uuid'), 'postgres|true|search_path=""')
assert.equal(functionContext('f4b_internal_snapshot_result', 'crm_contact_student_operational_link,consultation_case,consultation_case_candidate_student,center_cloud_entities,text,boolean,uuid'), 'postgres|false|search_path=""')
assert.equal(functionContext('ph_1_list_parent_student_links', 'text,boolean'), 'postgres|true|search_path=""')
assert.equal(functionContext('v2_1_mutate_center_settings', 'text,jsonb,uuid'), 'postgres|true|search_path=""')
assert.equal(functionContext('v2_4_list_package_cycle_state', 'text'), 'postgres|true|search_path=""')

const conversionSignature = 'public.f4b_convert_crm_case_to_student(text,uuid,uuid,integer,integer,text,text,bigint,jsonb,text,text,uuid)'
assert.equal(psql(`select has_function_privilege('authenticated',${quote(conversionSignature)},'EXECUTE');`), 't')
for (const role of ['anon', 'service_role']) {
  assert.equal(psql(`select has_function_privilege(${quote(role)},${quote(conversionSignature)},'EXECUTE');`), 'f')
}

psql(`
  grant execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
  grant execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
  grant execute on function vault._crypto_aead_det_noncegen() to postgres;
  do $qa$
  begin
    if not exists (
      select 1 from vault.decrypted_secrets
      where name='f23_3e_p4a_contact_lookup_epoch_1'
    ) then
      perform vault.create_secret(
        pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),
        'f23_3e_p4a_contact_lookup_epoch_1',
        'F4B disposable local QA'
      );
    end if;
  end
  $qa$;
`, 'supabase_admin')

const suffix = randomUUID()
const password = `F4B!${randomUUID()}aA1`
const emails = Object.fromEntries(['owner', 'admin', 'consultant', 'outsider']
  .map((role) => [role, `f4b.${role}.${suffix}@example.invalid`]))
const centers = {
  primary: `f4b-primary-${suffix}`,
  other: `f4b-other-${suffix}`,
}
const adminClient = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const makeUser = async (email) => {
  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return data.user
}
const signIn = async (email) => {
  const client = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  assert(data.session?.access_token)
  return client
}

const users = {
  owner: await makeUser(emails.owner),
  admin: await makeUser(emails.admin),
  consultant: await makeUser(emails.consultant),
  outsider: await makeUser(emails.outsider),
}

psql(`
  begin;
  select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select pg_catalog.set_config('app.chb1_internal_transition', 'on', true);
  insert into public.centers(id,name,status) values
    (${quote(centers.primary)}, 'F4B primary', 'active'),
    (${quote(centers.other)}, 'F4B other', 'active');
  update public.center_crm_control
  set crm_state='ACTIVE', feature_flag_state='ENABLED', control_version=control_version+1
  where center_id in (${quote(centers.primary)}, ${quote(centers.other)});
  insert into public.center_members(center_id,user_id,role,status) values
    (${quote(centers.primary)}, ${uuid(users.owner.id)}, 'owner', 'active'),
    (${quote(centers.primary)}, ${uuid(users.admin.id)}, 'center_admin', 'active'),
    (${quote(centers.primary)}, ${uuid(users.consultant.id)}, 'consultant', 'active'),
    (${quote(centers.other)}, ${uuid(users.outsider.id)}, 'owner', 'active');
  insert into public.center_access_governance(
    center_id, status, canonical_owner_membership_id, canonical_admin_membership_id, activated_at
  ) values
  (
    ${quote(centers.primary)}, 'active',
    (select id from public.center_members where center_id=${quote(centers.primary)} and role='owner'),
    (select id from public.center_members where center_id=${quote(centers.primary)} and role='center_admin'),
    pg_catalog.transaction_timestamp()
  ),
  (
    ${quote(centers.other)}, 'active',
    (select id from public.center_members where center_id=${quote(centers.other)} and role='owner'),
    null, pg_catalog.transaction_timestamp()
  );
  commit;
  select pg_notify('pgrst', 'reload schema');
`)

const [owner, centerAdmin, consultant, outsider] = await Promise.all([
  signIn(emails.owner), signIn(emails.admin), signIn(emails.consultant), signIn(emails.outsider),
])

const mutateCrm = (client, centerId, command, key = randomUUID()) => mutateC53CrmSharedTruth({
  supabase: client,
  centerId,
  command,
  idempotencyKey: key,
})

const createEligibleCustomer = async ({
  client = owner,
  centerId = centers.primary,
  marker,
  birthYear = '2017',
  withHistory = false,
} = {}) => {
  const contact = {
    id: `f4b-${marker}-${suffix}`,
    contactType: 'consultingLead',
    customerStage: 'consulting',
    consultationStatus: 'pendingEnrollment',
    parentName: `Synthetic Parent ${marker}`,
    phone: `090${String(Math.abs(marker.split('').reduce((n, c) => n + c.charCodeAt(0), 0))).padStart(7, '0').slice(-7)}`,
    leadStudentName: `Synthetic Student ${marker}`,
    studentBirthYear: birthYear,
    leadNeed: `Learning need ${marker}`,
    parentFeedbackAboutChild: `Safe CRM note ${marker}`,
    source: 'website',
    interestedProgram: 'Synthetic program',
    preferredSchedule: 'Weekend',
    locationArea: 'Synthetic area',
    nextAction: 'Hẹn học thử',
    careLogs: withHistory ? [{
      channel: 'note', content: `Preserved care history ${marker}`,
      contactedAt: '2026-09-21T08:00:00.000Z',
    }] : [],
    appointments: withHistory ? [{
      id: `appointment-${marker}-${suffix}`,
      appointmentType: 'trialLesson',
      status: 'scheduled',
      scheduledAt: '2026-09-28T08:00:00.000Z',
      channel: 'direct',
      note: `Preserved appointment ${marker}`,
    }] : [],
    enrollmentDraft: { isReady: true, childChessLevel: 'new', note: `Draft ${marker}` },
  }
  const created = await mutateCrm(client, centerId, buildC53CreateLeadCommand(contact))
  assert.equal(created.ok, true, JSON.stringify(created))
  let read = await pullC53CrmSharedTruth({ supabase: client, centerId })
  assert.equal(read.ok, true, JSON.stringify(read))
  let record = read.records.find((item) => item.id === contact.id)
  assert(record?.canonicalCaseId && record?.canonicalCandidateId)
  if (withHistory) {
    const assigned = await mutateCrm(client, centerId, buildC53AssignCaseCommand(record, users.consultant.id))
    assert.equal(assigned.ok, true, JSON.stringify(assigned))
    read = await pullC53CrmSharedTruth({ supabase: client, centerId })
    record = read.records.find((item) => item.id === contact.id)
  }
  return record
}

const studentPayload = (birthDate = '2017-04-16') => ({
  birthDate,
  schoolName: 'Synthetic School',
  level: 'Beginner',
  gender: '',
  currentStatus: 'Đang theo học',
  classSessionIds: [],
  recurringEnrollments: [],
  parentJob: '',
  careNotes: [],
})

const convert = async (client, record, {
  centerId = centers.primary,
  mode = 'CREATE_NEW',
  studentLocalId = '',
  expectedStudentVersion = 0,
  payload = studentPayload(),
  guardianRole = 'MOTHER',
  guardianOccupation = 'Synthetic occupation',
  key = randomUUID(),
} = {}) => {
  const { data, error } = await client.rpc('f4b_convert_crm_case_to_student', {
    p_center_id: centerId,
    p_case_id: record.canonicalCaseId,
    p_candidate_id: record.canonicalCandidateId,
    p_expected_case_version: record.cloudCaseVersion,
    p_expected_candidate_version: record.cloudCandidateVersion,
    p_mode: mode,
    p_student_local_id: studentLocalId,
    p_expected_student_version: expectedStudentVersion,
    p_student_payload: payload,
    p_guardian_role: guardianRole,
    p_guardian_occupation: guardianOccupation,
    p_idempotency_key: key,
  })
  assert.ifError(error)
  return data
}

const primary = await createEligibleCustomer({ marker: 'create-new', withHistory: true })
const historyBefore = psql(`
  select jsonb_build_object(
    'care', (select count(*) from public.crm_care_log where consultation_case_id=${uuid(primary.canonicalCaseId)}),
    'appointments', (select count(*) from public.crm_case_appointment where consultation_case_id=${uuid(primary.canonicalCaseId)}),
    'assignments', (select count(*) from public.consultation_case_assignment where consultation_case_id=${uuid(primary.canonicalCaseId)}),
    'source', (select safe_state->>'source' from public.crm_case_shared_state where consultation_case_id=${uuid(primary.canonicalCaseId)}),
    'summary', (select safe_case_summary from public.consultation_case where consultation_case_id=${uuid(primary.canonicalCaseId)})
  )::text;
`)
const createKey = randomUUID()
const created = await convert(owner, primary, { key: createKey })
assert.equal(created.ok, true, JSON.stringify(created))
assert.equal(created.outcome_code, 'COMMITTED')
assert.equal(created.replayed, false)
assert.equal(created.mode, 'CREATE_NEW')
assert.equal(psql(`select payload->>'birthDate' from public.center_cloud_entities where center_id=${quote(centers.primary)} and entity_type='student' and local_id=${quote(created.student_id)};`), '2017-04-16')
assert.equal(psql(`select count(*) from public.center_cloud_entities where center_id=${quote(centers.primary)} and entity_type='student' and local_id=${quote(created.student_id)};`), '1')
assert.equal(psql(`select status||'|'||conversion_state from public.consultation_case where consultation_case_id=${uuid(primary.canonicalCaseId)};`), 'CONVERTED|COMPLETED')
assert.equal(psql(`select candidate_status from public.consultation_case_candidate_student where candidate_student_id=${uuid(primary.canonicalCandidateId)};`), 'CONVERTED')
assert.equal(psql(`select guardian_role||'|'||occupation from public.crm_contact_student_operational_link where origin_candidate_student_id=${uuid(primary.canonicalCandidateId)};`), 'MOTHER|Synthetic occupation')
assert.equal(psql(`
  select jsonb_build_object(
    'care', (select count(*) from public.crm_care_log where consultation_case_id=${uuid(primary.canonicalCaseId)}),
    'appointments', (select count(*) from public.crm_case_appointment where consultation_case_id=${uuid(primary.canonicalCaseId)}),
    'assignments', (select count(*) from public.consultation_case_assignment where consultation_case_id=${uuid(primary.canonicalCaseId)}),
    'source', (select safe_state->>'source' from public.crm_case_shared_state where consultation_case_id=${uuid(primary.canonicalCaseId)}),
    'summary', (select safe_case_summary from public.consultation_case where consultation_case_id=${uuid(primary.canonicalCaseId)})
  )::text;
`), historyBefore)

const sameKeyRetry = await convert(owner, primary, { key: createKey })
assert.equal(sameKeyRetry.ok, true)
assert.equal(sameKeyRetry.student_id, created.student_id)
const newKeyRetry = await convert(centerAdmin, primary, { key: randomUUID() })
assert.equal(newKeyRetry.ok, true, JSON.stringify(newKeyRetry))
assert.equal(newKeyRetry.student_id, created.student_id)
assert.equal(newKeyRetry.business_replayed, true)
assert.equal(psql(`select count(*) from public.center_cloud_entities where center_id=${quote(centers.primary)} and entity_type='student' and local_id=${quote(created.student_id)};`), '1')

const concurrentRecord = await createEligibleCustomer({ marker: 'concurrency' })
const concurrentResults = await Promise.all([
  convert(owner, concurrentRecord, { key: randomUUID(), guardianRole: 'FATHER' }),
  convert(centerAdmin, concurrentRecord, { key: randomUUID(), guardianRole: 'FATHER' }),
])
assert(concurrentResults.every((result) => result.ok), JSON.stringify(concurrentResults))
assert.equal(new Set(concurrentResults.map((result) => result.student_id)).size, 1)
assert.equal(psql(`select count(*) from public.center_cloud_entities where center_id=${quote(centers.primary)} and entity_type='student' and local_id=${quote(concurrentResults[0].student_id)};`), '1')
assert.equal(psql(`select count(*) from public.crm_contact_student_operational_link where origin_candidate_student_id=${uuid(concurrentRecord.canonicalCandidateId)};`), '1')

const failureRecord = await createEligibleCustomer({ marker: 'atomic-failure' })
psql(`
  create function public.f4b_qa_force_terminal_failure() returns trigger language plpgsql set search_path='' as $$
  begin
    if new.consultation_case_id=${uuid(failureRecord.canonicalCaseId)} and new.status='CONVERTED' then
      raise exception 'F4B_QA_FORCED_LATE_FAILURE';
    end if;
    return new;
  end $$;
  create trigger f4b_qa_force_terminal_failure before update on public.consultation_case
  for each row execute function public.f4b_qa_force_terminal_failure();
`)
const failed = await convert(owner, failureRecord)
assert.equal(failed.ok, false, JSON.stringify(failed))
assert.equal(failed.outcome_code, 'F4B_CONVERSION_FAILED')
psql(`drop trigger f4b_qa_force_terminal_failure on public.consultation_case; drop function public.f4b_qa_force_terminal_failure();`)
const failedStudentId = `student-crm-${failureRecord.canonicalCandidateId}`
assert.equal(psql(`select count(*) from public.center_cloud_entities where center_id=${quote(centers.primary)} and entity_type='student' and local_id=${quote(failedStudentId)};`), '0')
assert.equal(psql(`select count(*) from public.crm_contact_student_operational_link where origin_candidate_student_id=${uuid(failureRecord.canonicalCandidateId)};`), '0')
assert.equal(psql(`select status||'|'||conversion_state from public.consultation_case where consultation_case_id=${uuid(failureRecord.canonicalCaseId)};`), 'READY_FOR_CONVERSION|NOT_STARTED')
assert.equal(psql(`select candidate_status from public.consultation_case_candidate_student where candidate_student_id=${uuid(failureRecord.canonicalCandidateId)};`), 'DRAFT')

const mismatchRecord = await createEligibleCustomer({ marker: 'birth-mismatch', birthYear: '2016' })
const mismatch = await convert(owner, mismatchRecord, { payload: studentPayload('2017-04-16') })
assert.equal(mismatch.ok, false)
assert.equal(mismatch.outcome_code, 'STUDENT_BIRTH_YEAR_MISMATCH')
assert.equal(psql(`select count(*) from public.center_cloud_entities where center_id=${quote(centers.primary)} and entity_type='student' and local_id=${quote(`student-crm-${mismatchRecord.canonicalCandidateId}`)};`), '0')

const existingStudentId = `f4b-existing-${suffix}`
const { data: existingCreated, error: existingError } = await owner.rpc('c5_1_mutate_core_entity', {
  p_center_id: centers.primary,
  p_entity_type: 'student',
  p_local_id: existingStudentId,
  p_expected_version: 0,
  p_payload: { id: existingStudentId, fullName: 'Synthetic Existing Student', currentStatus: 'Đang theo học', classSessionIds: [] },
  p_idempotency_key: randomUUID(),
  p_operation: 'UPSERT',
})
assert.ifError(existingError)
assert.equal(existingCreated.outcome_code, 'COMMITTED')
const linkRecord = await createEligibleCustomer({ marker: 'link-existing', birthYear: '' })
const linked = await convert(owner, linkRecord, {
  mode: 'LINK_EXISTING',
  studentLocalId: existingStudentId,
  expectedStudentVersion: 1,
  payload: null,
  guardianRole: 'FATHER',
  guardianOccupation: 'Existing guardian occupation',
})
assert.equal(linked.ok, true, JSON.stringify(linked))
assert.equal(linked.student_id, existingStudentId)
assert.equal(psql(`select count(*) from public.center_cloud_entities where center_id=${quote(centers.primary)} and entity_type='student' and local_id=${quote(existingStudentId)};`), '1')

const otherRecord = await createEligibleCustomer({ client: outsider, centerId: centers.other, marker: 'other-center' })
const { data: otherStudentCreated, error: otherStudentError } = await outsider.rpc('c5_1_mutate_core_entity', {
  p_center_id: centers.other,
  p_entity_type: 'student',
  p_local_id: `f4b-other-student-${suffix}`,
  p_expected_version: 0,
  p_payload: { id: `f4b-other-student-${suffix}`, fullName: 'Synthetic Other Student', currentStatus: 'Đang theo học', classSessionIds: [] },
  p_idempotency_key: randomUUID(),
  p_operation: 'UPSERT',
})
assert.ifError(otherStudentError)
assert.equal(otherStudentCreated.outcome_code, 'COMMITTED')
const wrongCenter = await convert(outsider, failureRecord)
assert.equal(wrongCenter.ok, false)
assert.equal(wrongCenter.outcome_code, 'CENTER_ACCESS_DENIED')
const crossLink = await convert(owner, failureRecord, {
  mode: 'LINK_EXISTING',
  studentLocalId: `f4b-other-student-${suffix}`,
  expectedStudentVersion: 1,
  payload: null,
})
assert.equal(crossLink.ok, false)
assert.equal(crossLink.outcome_code, 'STUDENT_NOT_CURRENT_OR_NOT_FOUND')
assert.equal(psql(`select count(*) from public.center_cloud_entities where center_id=${quote(centers.primary)} and entity_type='student' and local_id=${quote(`f4b-other-student-${suffix}`)};`), '0')
const { data: deniedLinks, error: deniedLinksError } = await outsider.rpc('ph_1_list_parent_student_links', {
  p_center_id: centers.primary,
  p_include_ended: false,
})
assert.equal(deniedLinks, null)
assert(deniedLinksError)
const { error: directProtectedWriteError } = await centerAdmin.from('crm_contact_student_operational_link')
  .update({ occupation: 'Direct write forbidden' }).eq('center_id', centers.primary)
assert(directProtectedWriteError)
assert(otherRecord.canonicalCaseId)

const packageId = randomUUID()
const blankProgramPackageId = randomUUID()
const mutatePackage = async (client, command) => {
  const { data, error } = await client.rpc('v2_1_mutate_center_settings', {
    p_center_id: centers.primary,
    p_command: command,
    p_idempotency_key: randomUUID(),
  })
  assert.ifError(error)
  return data
}
assert.equal((await mutatePackage(centerAdmin, {
  operation: 'CREATE_TUITION_PACKAGE', package_id: packageId, expected_version: 0,
  package_name: 'Synthetic Program Package', program_name: 'Synthetic Program A',
  total_sessions: 12, default_amount: 3600000, is_active: true, note: 'F4B QA',
})).outcome_code, 'COMMITTED')
assert.equal((await mutatePackage(centerAdmin, {
  operation: 'CREATE_TUITION_PACKAGE', package_id: blankProgramPackageId, expected_version: 0,
  package_name: 'Legacy Compatible Package', program_name: '',
  total_sessions: 8, default_amount: 2400000, is_active: true, note: 'F4B blank program QA',
})).outcome_code, 'COMMITTED')
const { data: settingsRead, error: settingsError } = await owner.rpc('v2_1_list_center_settings', { p_center_id: centers.primary })
assert.ifError(settingsError)
const programPackage = settingsRead.tuition_packages.find((item) => item.id === packageId)
const blankProgramPackage = settingsRead.tuition_packages.find((item) => item.id === blankProgramPackageId)
assert.equal(programPackage.program_name, 'Synthetic Program A')
assert.equal(blankProgramPackage.program_name, null)
const cycleId = randomUUID()
psql(`
  insert into public.center_tuition_package_cycles(
    id, center_id, student_local_id, tuition_local_id, cycle_number,
    package_catalog_id, package_name_snapshot, total_sessions_snapshot, price_snapshot,
    payment_period_id, baseline_used_sessions, baseline_cutoff_date, baseline_review_note,
    lifecycle_status, origin, created_by, updated_by
  ) values (
    ${uuid(cycleId)}, ${quote(centers.primary)}, ${quote(existingStudentId)}, ${quote(`tuition-${suffix}`)}, 1,
    ${uuid(packageId)}, 'Synthetic Program Package', 12, 3600000,
    ${quote(`period-${suffix}`)}, 0, current_date, 'F4B synthetic baseline',
    'ACTIVE', 'OPERATOR_BASELINE', ${uuid(users.owner.id)}, ${uuid(users.owner.id)}
  );
`)
assert.equal(psql(`select program_name_snapshot from public.center_tuition_package_cycles where id=${uuid(cycleId)};`), 'Synthetic Program A')
assert.equal((await mutatePackage(owner, {
  operation: 'UPDATE_TUITION_PACKAGE', package_id: packageId, expected_version: 1,
  package_name: 'Synthetic Program Package', program_name: 'Synthetic Program B',
  total_sessions: 12, default_amount: 3600000, is_active: true, note: 'F4B QA updated',
})).outcome_code, 'COMMITTED')
assert.equal(psql(`select program_name_snapshot from public.center_tuition_package_cycles where id=${uuid(cycleId)};`), 'Synthetic Program A')
const { data: cycleState, error: cycleError } = await owner.rpc('v2_4_list_package_cycle_state', { p_center_id: centers.primary })
assert.ifError(cycleError)
assert.equal(cycleState.students.find((item) => item.student_id === existingStudentId).current_cycle.program_name, 'Synthetic Program A')
const { data: crossSettings, error: crossSettingsError } = await outsider.rpc('v2_1_list_center_settings', { p_center_id: centers.primary })
assert.equal(crossSettings, null)
assert(crossSettingsError)

assert.equal(psql(`select count(*) from public.crm_shared_command_result where result_snapshot->>'operation'='CONVERT_CRM_CASE_TO_STUDENT' and center_id=${quote(centers.primary)};`) > 0, true)
assert.equal(psql(`select count(*) from public.crm_contact_student_operational_link where center_id=${quote(centers.other)} and origin_consultation_case_id=${uuid(primary.canonicalCaseId)};`), '0')

console.log('F4B_LOCAL_SECURITY_CONTEXT_RLS_GRANTS: PASS')
console.log('F4B_LOCAL_CREATE_NEW_RETRY_CONCURRENCY: PASS')
console.log('F4B_LOCAL_FAILURE_ATOMICITY_ZERO_RESIDUE: PASS')
console.log('F4B_LOCAL_LINK_EXISTING_AND_CROSS_CENTER_DENIAL: PASS')
console.log('F4B_LOCAL_CRM_HISTORY_AND_PROTECTED_CONTACT: PASS')
console.log('F4B_LOCAL_BIRTH_DATE_YEAR_CONSISTENCY: PASS')
console.log('F4B_LOCAL_PACKAGE_PROGRAM_ROUND_TRIP_AND_SNAPSHOT: PASS')
