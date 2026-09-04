import assert from 'node:assert/strict'
import { createHash, randomUUID, webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  C55_STAFF_HR_CAPABILITY_STATUS,
  canWriteC55StaffHrSharedTruth,
  createC55StaffHrCapabilityState,
  isC55StaffHrBackendUnavailable,
  isC55StaffHrCapabilityReady,
  pullC55StaffHrSharedTruth,
  readC55StaffAdministrativeProfile,
} from '../src/cloud-authoritative-staff-hr.js'
import { getModuleAuthorityEntry } from '../src/module-authority-registry.js'
import { renderStaffModule } from '../src/staff-module.js'
import { renderTeacherModule } from '../src/teacher-module.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const read = (path) => readFileSync(path, 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
const migrationPath = 'supabase/migrations/202608290001_hr_1_staff_hr_privacy_capability_forward_fix.sql'
const migration = read(migrationPath)
const main = read('src/main.js')
const staffSource = read('src/staff-module.js')
const getFunctionSource = (name) => {
  const start = main.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `Missing function: ${name}`)
  const tail = main.slice(start + 1)
  const next = tail.search(/\n(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\(/)
  return next === -1 ? main.slice(start) : main.slice(start, start + 1 + next)
}

for (const [path, expected] of new Map([
  ['supabase/migrations/202608140007_c5_5_staff_hr_authoritative_shared_truth.sql', '63642029F0C6FA298EFCD9577C50F8FB4FD7F93F44190A24EEC602AE064D992C'],
  ['supabase/migrations/202608140008_c5_5_independent_review_access_projection_attachment_hardening.sql', '932CB8B12F25465D0CA685F303BD24B2F5B4A665CD1C5D493C10E6EDBE55D34F'],
  ['supabase/migrations/202607280001_f23_11e_staff_document_private_attachments.sql', 'E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C'],
  ['supabase/migrations/202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql', 'CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8'],
  ['supabase/migrations/202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql', '2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984'],
])) assert.equal(sha256(path), expected, `Frozen migration drift: ${path}`)

for (const token of [
  "when pg_catalog.lower(pg_catalog.btrim(cm.role)) = 'admin' then 'center_admin'",
  "in ('owner', 'center_admin', 'admin')",
  'create or replace function public.hr_1_read_staff_administrative_profile',
  "'sensitiveFieldsWithheld', true",
  "'sensitiveFieldsWithheld', false",
  "jsonb_set(v_snapshot, '{documents}', '[]'::jsonb, true)",
  "'administrative-profile.open'",
  'v_audit := public.c5_5_record_staff_hr_access_audit(',
  "v_audit->>'outcome_code' <> 'COMMITTED'",
  "raise exception 'HR_1_PROFILE_CHANGED_AFTER_ACCESS_AUDIT'",
  'security definer',
  "set search_path = ''",
  'revoke all on function public.hr_1_read_staff_administrative_profile',
  'grant execute on function public.hr_1_read_staff_administrative_profile',
]) assert(migration.includes(token), `Missing HR-1 SQL marker: ${token}`)
assert(migration.indexOf('v_audit := public.c5_5_record_staff_hr_access_audit(')
  < migration.indexOf('select jsonb_build_object(', migration.indexOf('v_audit := public.c5_5_record_staff_hr_access_audit(')))
for (const forbidden of [
  'alter table public.center_staff_administrative_profiles disable row level security',
  'grant select on table public.center_staff_administrative_profiles',
  'grant insert on table public.center_staff_administrative_profiles',
  'delete from public.center_staff',
  'insert into public.center_cloud_entities',
  'localStorage',
]) assert(!migration.includes(forbidden), `Forbidden HR-1 SQL marker: ${forbidden}`)

assert.equal(canWriteC55StaffHrSharedTruth({ role: 'owner' }).ok, true)
assert.equal(canWriteC55StaffHrSharedTruth({ role: 'center_admin' }).ok, true)
assert.equal(canWriteC55StaffHrSharedTruth({ role: 'admin' }).ok, true)
assert.equal(canWriteC55StaffHrSharedTruth({ role: 'teacher' }).ok, false)

const idle = createC55StaffHrCapabilityState()
const loading = createC55StaffHrCapabilityState({ centerId: 'center-a', status: C55_STAFF_HR_CAPABILITY_STATUS.LOADING, isLoading: true })
const ready = createC55StaffHrCapabilityState({ centerId: 'center-a', status: C55_STAFF_HR_CAPABILITY_STATUS.READY })
const unavailable = createC55StaffHrCapabilityState({ centerId: 'center-a', status: C55_STAFF_HR_CAPABILITY_STATUS.UNAVAILABLE })
const failed = createC55StaffHrCapabilityState({ centerId: 'center-a', status: C55_STAFF_HR_CAPABILITY_STATUS.FAILED })
assert.equal(idle.status, 'idle')
assert.equal(loading.isLoading, true)
assert.equal(isC55StaffHrCapabilityReady(ready, 'center-a'), true)
assert.equal(isC55StaffHrCapabilityReady(ready, 'center-b'), false)
assert.equal(isC55StaffHrCapabilityReady(unavailable, 'center-a'), false)
assert.equal(isC55StaffHrCapabilityReady(failed, 'center-a'), false)
assert.equal(isC55StaffHrBackendUnavailable({ detail: { code: 'PGRST202' } }), true)
assert.equal(isC55StaffHrBackendUnavailable({ code: 'PGRST205' }), true)
assert.equal(isC55StaffHrBackendUnavailable({ code: '42501', message: 'denied' }), false)

const empty = Object.freeze({})
const blankAddress = { addressLine: '', wardOrCommune: '', district: '', provinceOrCity: '', country: '' }
const blankProfile = (overrides = {}) => ({
  id: 'profile-a', schemaVersion: 1, centerId: 'center-a', staffMemberId: 'staff-a',
  legalFullName: '', dateOfBirth: '', gender: '', nationality: '',
  permanentAddress: blankAddress, currentAddress: blankAddress,
  emergencyContact: { name: '', phone: '', relationship: '' },
  identityDocument: { type: '', number: '', issuedDate: '', issuedPlace: '', expiryDate: '' },
  taxInformation: { taxNumber: '', registeredDate: '', registeredPlace: '' },
  insuranceInformation: { socialInsuranceNumber: '', healthInsuranceNumber: '' },
  bankInformation: { bankName: '', accountNumber: '', accountHolderName: '', branch: '' },
  employmentAdministration: { contractNumber: '', contractType: '', signedDate: '', effectiveDate: '', expiryDate: '', signingEntity: '', note: '' },
  note: '', completionStatus: 'incomplete',
  completionReview: { reviewedAt: '', reviewedBy: '', reviewedByLabel: '', checklistVersion: '' },
  revision: 1, createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z',
  archivedAt: '', cloudVersion: 1, sensitiveFieldsWithheld: true, ...overrides,
})
const snapshot = (profiles) => ({
  ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a',
  departments: [], staff_members: [], administrative_profiles: profiles,
  documents: [], retention_policy: null, deletion_requests: [], audit_events: [],
})
const maskedPull = await pullC55StaffHrSharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: snapshot([blankProfile()]), error: null }) },
})
assert.equal(maskedPull.ok, true, JSON.stringify(maskedPull))
assert.equal(maskedPull.administrativeProfiles[0].sensitiveFieldsWithheld, true)
const leakingPull = await pullC55StaffHrSharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: snapshot([blankProfile({
    legalFullName: 'Should never appear', sensitiveFieldsWithheld: false,
  })]), error: null }) },
})
assert.equal(leakingPull.ok, false)
assert.equal(leakingPull.outcome_code, 'INVALID_SERVER_RESULT')

const auditId = randomUUID()
const sensitiveProfile = blankProfile({
  legalFullName: 'Nguyễn QA',
  identityDocument: { type: 'CCCD', number: 'SECRET-ONLY-EXPLICIT', issuedDate: '', issuedPlace: '', expiryDate: '' },
  sensitiveFieldsWithheld: false,
})
const sensitiveRead = await readC55StaffAdministrativeProfile({
  centerId: 'center-a', staffMemberId: 'staff-a', administrativeProfileId: 'profile-a',
  idempotencyKey: auditId,
  supabase: { rpc: async (name, args) => {
    assert.equal(name, 'hr_1_read_staff_administrative_profile')
    assert.equal(args.p_center_id, 'center-a')
    return { data: {
      ok: true, outcome_code: 'SENSITIVE_PROFILE_READ', center_id: 'center-a',
      profile: sensitiveProfile,
      documents: [],
      audit_event: {
        id: auditId, centerId: 'center-a', staffMemberId: 'staff-a',
        administrativeProfileId: 'profile-a', action: 'administrative-profile.open',
        actorUserId: randomUUID(), actorMembershipId: randomUUID(), actorRole: 'center_admin',
        createdAt: '2026-08-29T00:00:01.000Z',
      },
    }, error: null }
  } },
})
assert.equal(sensitiveRead.ok, true, JSON.stringify(sensitiveRead))
assert.equal(sensitiveRead.profile.identityDocument.number, 'SECRET-ONLY-EXPLICIT')
const unauditedRead = await readC55StaffAdministrativeProfile({
  centerId: 'center-a', staffMemberId: 'staff-a', administrativeProfileId: 'profile-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'SENSITIVE_PROFILE_READ', center_id: 'center-a', profile: sensitiveProfile,
    documents: [],
    audit_event: empty,
  }, error: null }) },
})
assert.equal(unauditedRead.ok, false)
assert.equal(Object.hasOwn(unauditedRead, 'profile'), false)

const authority = getModuleAuthorityEntry('nhan-vien')
assert.deepEqual(authority.requiredRefreshUpstreams, ['staff'])
assert.deepEqual(authority.optionalRefreshUpstreams, ['core', 'attendance'])

const teacherLoading = renderTeacherModule([], undefined, null, null, [], [], [], [], {
  staffAvailable: false, staffCapabilityStatus: 'loading', staffManagementAvailable: false,
})
assert.match(teacherLoading, /Nhân sự &amp; hồ sơ · Đang tải/)
assert.match(teacherLoading, /data-teacher-action="open-staff-management"[\s\S]*disabled/)
assert.doesNotMatch(teacherLoading, /Quản lý nhân sự hiện chưa khả dụng/)
const teacherIdle = renderTeacherModule([], undefined, null, null, [], [], [], [], {
  staffAvailable: false, staffCapabilityStatus: 'idle', staffManagementAvailable: false,
})
assert.match(teacherIdle, /data-teacher-action="open-staff-management"[\s\S]*disabled/)
assert.doesNotMatch(teacherIdle, /Chưa khả dụng|Chưa tải được/)
const teacherUnavailable = renderTeacherModule([], undefined, null, null, [], [], [], [], {
  staffAvailable: false, staffCapabilityStatus: 'unavailable', staffManagementAvailable: false,
})
assert.match(teacherUnavailable, /Nhân sự &amp; hồ sơ · Chưa khả dụng/)
assert.match(teacherUnavailable, /Quản lý nhân sự hiện chưa khả dụng/)
const teacherFailed = renderTeacherModule([], undefined, null, null, [], [], [], [], {
  staffAvailable: false, staffCapabilityStatus: 'failed', staffManagementAvailable: false,
})
assert.match(teacherFailed, /Nhân sự &amp; hồ sơ · Chưa tải được/)
assert.match(teacherFailed, /Thông tin nhân sự hiện chưa tải được/)
const teacherReady = renderTeacherModule([], undefined, null, null, [], [], [], [], {
  staffAvailable: true, staffCapabilityStatus: 'ready', staffManagementAvailable: true,
})
assert.match(teacherReady, /data-teacher-action="open-staff-management"/)
assert.doesNotMatch(teacherReady, /open-staff-management"[\s\S]{0,100}disabled/)

const staffNoCore = renderStaffModule({ coreAvailable: false, attendanceAvailable: false })
assert.match(staffNoCore, /\+ Thêm nhân viên/)
assert.match(staffNoCore, /Thông tin liên kết Giáo viên và tài khoản hiện chưa tải được/)
assert.match(staffNoCore, /Tổng hợp chấm công hiện chưa tải được/)
assert.doesNotMatch(staffNoCore, /authoritative truth|reference tường minh/i)

for (const token of [
  'const staffAdministrativeSensitiveProfiles = new Map()',
  'const staffAdministrativeSensitiveDocuments = new Map()',
  'staffAdministrativeSensitiveProfiles.clear()',
  'staffAdministrativeSensitiveDocuments.clear()',
  'purgeStaffAdministrativeSensitiveProfile(windowItem.centerId, windowItem.staffMemberId)',
  "moduleId === 'nhan-vien'",
  'isC55StaffHrCapabilityReady(',
  'readC55StaffAdministrativeProfile({',
  'if (!guardC55CoreReferenceAction())',
]) assert(main.includes(token), `Missing HR-1 runtime marker: ${token}`)
for (const name of [
  'commitC55StaffHrAccessAudit',
  'loadC55StaffAdministrativeSensitiveProfile',
  'refreshC55StaffHrSharedTruth',
  'writeC55StaffHrCommand',
]) {
  const source = getFunctionSource(name)
  assert(source.includes('getCloudDbContext('), `${name} must use exact-center session context`)
  assert(!source.includes('checkCloudDbReadiness('), `${name} must not depend on Core readiness`)
}
const staffWriteSource = getFunctionSource('writeC55StaffHrCommand')
assert.match(staffWriteSource, /buildCurrentOnlineAccessState\(\{[\s\S]*cloudReady:\s*true/)
assert(!staffWriteSource.includes("cloudDbState.readinessStatus === 'ready'"))
const sensitiveRuntimeLines = main.split(/\r?\n/)
  .filter((line) => /staffAdministrativeSensitive(?:Profiles|Documents)/.test(line))
assert(sensitiveRuntimeLines.length > 0)
assert(!sensitiveRuntimeLines.some((line) => /console\.|localStorage|sessionStorage/.test(line)))
assert(staffSource.includes('referenceActionsAvailable'))
assert(!main.includes('saveStoredCenterStaffAdministrativeProfiles'))

console.log(`HR_1_MIGRATION_SHA256: ${sha256(migrationPath)}`)
console.log('HR_1_STAFF_HR_PRIVACY_CAPABILITY_FORWARD_FIX_SMOKE: PASS')
