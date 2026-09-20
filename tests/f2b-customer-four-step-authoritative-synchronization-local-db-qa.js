import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

import {
  buildC53AppendCareLogCommand,
  buildC53CreateLeadCommand,
  buildC53SaveCaseCommand,
  mutateC53CrmSharedTruth,
  pullC53CrmSharedTruth,
} from '../src/cloud-authoritative-crm.js'

assert.equal(process.env.ICHESS_F2B_LOCAL_QA_ALLOW, 'YES', 'ICHESS_F2B_LOCAL_QA_ALLOW=YES is required')
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked production project references are forbidden')

const qaWorkdir = String(process.env.ICHESS_F2B_LOCAL_QA_WORKDIR || '').trim()
assert(qaWorkdir, 'ICHESS_F2B_LOCAL_QA_WORKDIR is required')
const config = readFileSync(`${qaWorkdir}/supabase/config.toml`, 'utf8')
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1]
assert(projectId?.startsWith('ichess-f2b-authoritative-qa-'), 'A disposable F2B project is required')

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
  ? run(process.env.ComSpec, [
      '/d',
      '/s',
      '/c',
      'npx --no-install supabase status -o json',
    ], { cwd: qaWorkdir })
  : run('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], { cwd: qaWorkdir })
const status = JSON.parse(statusOutput)
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) assert.equal(typeof status[key], 'string')
for (const url of [status.DB_URL, status.API_URL]) {
  assert(new Set(['127.0.0.1', 'localhost', '::1']).has(new URL(url).hostname.toLowerCase()))
}

const containerRows = run('docker', [
  'ps',
  '--filter',
  `label=com.supabase.cli.project=${projectId}`,
  '--filter',
  'status=running',
  '--format',
  '{{.ID}}|{{.Names}}|{{.Image}}',
]).trim().split(/\r?\n/).filter(Boolean).map((row) => row.split('|'))
const dbRows = containerRows.filter(([, name, image]) => name === `supabase_db_${projectId}` && /supabase\/postgres/i.test(image))
assert.equal(dbRows.length, 1, 'Exactly one disposable local database must be running')
const containerId = dbRows[0][0]

const psql = (sql, user = 'postgres') => run('docker', [
  'exec', '-i', containerId,
  'psql', '-X', '--no-psqlrc', '-U', user, '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
], { input: sql }).trim()
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
const uuid = (value) => `${quote(value)}::uuid`

assert.equal(psql("select count(*) from supabase_migrations.schema_migrations where version='202609200002';"), '1')
assert.equal(psql("select pg_catalog.pg_get_userbyid(p.proowner) || '|' || p.prosecdef::text || '|' || coalesce(array_to_string(p.proconfig, ','),'') from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='c5_3_list_crm_shared_truth';"), 'postgres|true|search_path=""')
assert.equal(psql("select pg_catalog.pg_get_userbyid(p.proowner) || '|' || p.prosecdef::text || '|' || coalesce(array_to_string(p.proconfig, ','),'') from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='c5_3_mutate_crm_shared_truth';"), 'postgres|true|search_path=""')
psql(`
  grant execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
  grant execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
  grant execute on function vault._crypto_aead_det_noncegen() to postgres;
  select vault.create_secret(
    pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),
    'f23_3e_p4a_contact_lookup_epoch_1',
    'F2B disposable local QA'
  );
`, 'supabase_admin')

const suffix = randomUUID()
const password = `F2B!${randomUUID()}aA1`
const emails = Object.fromEntries(['owner', 'admin', 'outsider'].map((role) => [role, `f2b.${role}.${suffix}@example.invalid`]))
const centers = {
  primary: `f2b-primary-${suffix}`,
  other: `f2b-other-${suffix}`,
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
const mutate = (client, centerId, command) => mutateC53CrmSharedTruth({
  supabase: client,
  centerId,
  command,
  idempotencyKey: randomUUID(),
})

const users = {
  owner: await makeUser(emails.owner),
  admin: await makeUser(emails.admin),
  outsider: await makeUser(emails.outsider),
}

psql(`
  begin;
  select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select pg_catalog.set_config('app.chb1_internal_transition', 'on', true);
  insert into public.centers(id,name,status) values
    (${quote(centers.primary)}, 'F2B primary', 'active'),
    (${quote(centers.other)}, 'F2B other', 'active');
  insert into public.installation_center_epochs(center_id, installation_epoch, epoch_status) values
    (${quote(centers.primary)}, 1, 'CURRENT'),
    (${quote(centers.other)}, 1, 'CURRENT');
  update public.installation_handoff_control
  set installation_state='TESTER_ACTIVE', bootstrap_state='LOCKED_EXISTING'
  where singleton_id=1;
  update public.center_crm_control
  set crm_state='ACTIVE', feature_flag_state='ENABLED', control_version=control_version+1
  where center_id in (${quote(centers.primary)}, ${quote(centers.other)});
  insert into public.center_members(center_id,user_id,role,status) values
    (${quote(centers.primary)}, ${uuid(users.owner.id)}, 'owner', 'active'),
    (${quote(centers.primary)}, ${uuid(users.admin.id)}, 'center_admin', 'active'),
    (${quote(centers.other)}, ${uuid(users.outsider.id)}, 'owner', 'active');
  insert into public.center_access_governance(
    center_id, status, canonical_owner_membership_id, canonical_admin_membership_id, activated_at
  )
  values (
    ${quote(centers.primary)}, 'active',
    (select id from public.center_members where center_id=${quote(centers.primary)} and role='owner' limit 1),
    (select id from public.center_members where center_id=${quote(centers.primary)} and role='center_admin' limit 1),
    pg_catalog.transaction_timestamp()
  );
  insert into public.center_access_governance(
    center_id, status, canonical_owner_membership_id, canonical_admin_membership_id, activated_at
  )
  values (
    ${quote(centers.other)}, 'active',
    (select id from public.center_members where center_id=${quote(centers.other)} and role='owner' limit 1),
    null,
    pg_catalog.transaction_timestamp()
  );
  commit;
`)

const [owner, centerAdmin, outsider] = await Promise.all([
  signIn(emails.owner),
  signIn(emails.admin),
  signIn(emails.outsider),
])

const contact = {
  id: `contact-${suffix}`,
  contactType: 'consultingLead',
  customerStage: 'consulting',
  parentName: 'Phụ huynh F2B',
  phone: '0900000001',
  leadStudentName: 'Bé F2B',
  studentBirthYear: '2017',
  leadNeed: 'Mục tiêu bước 2',
  consultationStatus: 'activeCare',
  source: 'website',
  interestedProgram: 'Chương trình cờ vua giáo dục',
  preferredSchedule: 'Tối thứ 3',
  registeredAt: '2026-09-21',
  nextAction: 'Hẹn học thử',
  careLogs: [],
  appointments: [],
  enrollmentDraft: {
    interestedProgram: 'Giá trị trùng cũ',
    preferredSchedule: 'Lịch trùng cũ',
    learningGoal: 'Mục tiêu trùng cũ',
    advisorName: 'Tư vấn trùng cũ',
    expectedTrialDate: '2026-09-27',
    childChessLevel: 'new',
    note: 'Dữ liệu riêng bước 4',
  },
}

const created = await mutate(owner, centers.primary, buildC53CreateLeadCommand(contact))
assert.equal(created.ok, true, JSON.stringify(created))
let adminRead = await pullC53CrmSharedTruth({ supabase: centerAdmin, centerId: centers.primary })
assert.equal(adminRead.ok, true, JSON.stringify(adminRead))
assert.equal(adminRead.records.length, 1)
assert.equal(adminRead.records[0].studentBirthYear, '2017')
assert.equal(adminRead.records[0].interestedProgram, contact.interestedProgram)
assert.equal(adminRead.records[0].preferredSchedule, contact.preferredSchedule)
assert.equal(adminRead.records[0].registeredAt, contact.registeredAt)
assert.equal(adminRead.records[0].leadNeed, contact.leadNeed)
assert.equal(adminRead.records[0].enrollmentDraft.expectedTrialDate, '2026-09-27')
for (const duplicateField of ['interestedProgram', 'preferredSchedule', 'learningGoal', 'advisorName']) {
  assert(!Object.hasOwn(adminRead.records[0].enrollmentDraft, duplicateField))
}

const adminEdit = {
  ...adminRead.records[0],
  interestedProgram: 'Chương trình cờ vua thể thao',
  preferredSchedule: 'Sáng cuối tuần',
  registeredAt: '2026-09-22',
  leadNeed: 'Mục tiêu đã sửa từ bước 2',
}
const savedByAdmin = await mutate(centerAdmin, centers.primary, buildC53SaveCaseCommand(adminEdit))
assert.equal(savedByAdmin.ok, true, JSON.stringify(savedByAdmin))
let ownerRead = await pullC53CrmSharedTruth({ supabase: owner, centerId: centers.primary })
assert.equal(ownerRead.ok, true, JSON.stringify(ownerRead))
assert.equal(ownerRead.records[0].interestedProgram, adminEdit.interestedProgram)
assert.equal(ownerRead.records[0].preferredSchedule, adminEdit.preferredSchedule)
assert.equal(ownerRead.records[0].registeredAt, adminEdit.registeredAt)
assert.equal(ownerRead.records[0].leadNeed, adminEdit.leadNeed)
assert.equal(ownerRead.records[0].enrollmentDraft.expectedTrialDate, '2026-09-27')

const nextAction = await mutate(owner, centers.primary, buildC53AppendCareLogCommand(ownerRead.records[0], {
  contactedAt: '2026-09-21T08:00:00.000Z',
  channel: 'note',
  content: 'Cập nhật các công việc tiếp theo trong hồ sơ khách hàng.',
  nextAction: 'Hẹn phản hồi',
}))
assert.equal(nextAction.ok, true, JSON.stringify(nextAction))
adminRead = await pullC53CrmSharedTruth({ supabase: centerAdmin, centerId: centers.primary })
assert.equal(adminRead.records[0].nextAction, 'Hẹn phản hồi')

const blankBirthContact = {
  ...contact,
  id: `contact-blank-${suffix}`,
  phone: '0900000002',
  leadStudentName: 'Bé chưa có năm sinh',
  studentBirthYear: '',
  interestedProgram: '',
  preferredSchedule: '',
  registeredAt: '',
  enrollmentDraft: { expectedTrialDate: '', note: '' },
}
const blankCreated = await mutate(owner, centers.primary, buildC53CreateLeadCommand(blankBirthContact))
assert.equal(blankCreated.ok, true, JSON.stringify(blankCreated))
ownerRead = await pullC53CrmSharedTruth({ supabase: owner, centerId: centers.primary })
const blankReloaded = ownerRead.records.find((record) => record.id === blankBirthContact.id)
assert(blankReloaded)
assert.equal(blankReloaded.studentBirthYear, '')
assert.equal(blankReloaded.interestedProgram, '')

const crossRead = await pullC53CrmSharedTruth({ supabase: outsider, centerId: centers.primary })
assert.equal(crossRead.ok, false)
assert.equal(crossRead.outcome_code, 'CENTER_ACCESS_DENIED')
const crossMutation = await mutate(outsider, centers.primary, buildC53SaveCaseCommand(ownerRead.records[0]))
assert.equal(crossMutation.ok, false)
assert.equal(crossMutation.outcome_code, 'CENTER_ACCESS_DENIED')
const otherCenterRead = await pullC53CrmSharedTruth({ supabase: outsider, centerId: centers.other })
assert.equal(otherCenterRead.ok, true)
assert.equal(otherCenterRead.records.length, 0)

console.log('F2B_LOCAL_LEDGER_SECURITY_CONTEXT: PASS')
console.log('F2B_LOCAL_OWNER_ADMIN_AUTHORITATIVE_ROUND_TRIP: PASS')
console.log('F2B_LOCAL_EXISTING_AND_BLANK_RECORD_COMPATIBILITY: PASS')
console.log('F2B_LOCAL_NEXT_ACTION_RELOAD: PASS')
console.log('F2B_LOCAL_CROSS_CENTER_READ_MUTATION_DENIAL: PASS')
