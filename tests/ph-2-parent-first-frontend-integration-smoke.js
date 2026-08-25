import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createParentFirstCapabilityState,
  createParentStudentLink,
  getParentFirstOutcomeMessage,
  isParentFirstBackendUnavailable,
  isParentFirstCapabilityReady,
  PARENT_FIRST_CAPABILITY_STATUS,
  pullParentStudentLinks,
  updateProtectedContactIdentity,
} from '../src/cloud-authoritative-parent-student-links.js'
import {
  buildDerivedParentContactsFromStudents,
  mergeParentContactsWithStudents,
  renderParentConsultationModule,
} from '../src/parent-consultation-module.js'
import {
  getProductionLauncherModules,
  isProductionModuleAvailable,
} from '../src/modules.js'

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const moduleSource = readFileSync(new URL('../src/parent-consultation-module.js', import.meta.url), 'utf8')
const registrySource = readFileSync(new URL('../src/module-authority-registry.js', import.meta.url), 'utf8')
const migrationSource = readFileSync(
  new URL('../supabase/migrations/202608250001_ph_1_authoritative_parent_student_link_and_contact_identity_update.sql', import.meta.url),
  'utf8',
)

const centerId = 'center_a'
const contactId = '11111111-1111-4111-8111-111111111111'
const linkId = '22222222-2222-4222-8222-222222222222'
const idempotencyKey = '33333333-3333-4333-8333-333333333333'
const sampleStudent = Object.freeze({
  id: 'student-1',
  fullName: 'QA Student',
  parentName: 'Student Parent Source',
  motherPhone: '0900000001',
  fatherPhone: '0900000002',
  entityVersion: 4,
  updatedAt: '2026-08-25T00:00:00.000Z',
})
const sampleContact = Object.freeze({
  id: 'case-local-1',
  canonicalCaseId: '44444444-4444-4444-8444-444444444444',
  canonicalContactId: contactId,
  parentName: 'Masked parent',
  contactType: 'currentParent',
  consultationStatus: 'activeCare',
  customerStage: 'converted',
  source: 'oldStudent',
  careLogs: [],
  appointments: [],
  enrollmentDraft: {},
})
const sampleLinkRow = Object.freeze({
  link_id: linkId,
  link_version: 1,
  link_status: 'ACTIVE',
  relationship_type: 'PARENT',
  is_primary_contact: true,
  financial_contact_role: 'PRIMARY',
  academic_contact_role: 'PRIMARY',
  ended_reason_code: null,
  ended_at: null,
  crm_contact_id: contactId,
  contact_version: 3,
  contact_status: 'ACTIVE',
  contact_display_name: 'Reviewed Parent',
  contact_phones: ['0900000099'],
  contact_emails: ['parent@example.test'],
  contact_identity_available: true,
  student_local_id: sampleStudent.id,
  student_available: true,
  student_entity_version: 4,
  student_updated_at: sampleStudent.updatedAt,
  created_at: '2026-08-25T00:01:00.000Z',
  updated_at: '2026-08-25T00:01:00.000Z',
})

function createRpcMock(handler) {
  const calls = []
  return {
    calls,
    rpc: async (name, params) => {
      calls.push({ name, params: structuredClone(params) })
      return handler(name, params, calls)
    },
  }
}

// Capability states: absent/loading/failed/ready remain distinct.
const idle = createParentFirstCapabilityState()
const loading = createParentFirstCapabilityState({ centerId, status: PARENT_FIRST_CAPABILITY_STATUS.LOADING, isLoading: true })
const ready = createParentFirstCapabilityState({ centerId, status: PARENT_FIRST_CAPABILITY_STATUS.READY })
assert.equal(isParentFirstCapabilityReady(idle, centerId), false)
assert.equal(isParentFirstCapabilityReady(loading, centerId), false)
assert.equal(isParentFirstCapabilityReady(ready, centerId), true)
assert.equal(isParentFirstCapabilityReady(ready, 'center_b'), false)
assert.equal(isParentFirstBackendUnavailable({ outcome_code: 'PGRST202' }), true)
assert.equal(isParentFirstBackendUnavailable({ error: 'function ph_1_list_parent_student_links was not found' }), true)

const absentClient = createRpcMock(async () => ({
  data: null,
  error: { code: 'PGRST202', message: 'Could not find function ph_1_list_parent_student_links' },
}))
const absent = await pullParentStudentLinks({ supabase: absentClient, centerId })
assert.equal(absent.ok, false)
assert.equal(absent.outcome_code, 'BACKEND_NOT_DEPLOYED')
assert.match(absent.error, /chưa khả dụng/i)

const readyClient = createRpcMock(async () => ({
  data: {
    ok: true,
    outcome_code: 'PARENT_STUDENT_LINKS_READ',
    center_id: centerId,
    links: [sampleLinkRow],
    read_at: '2026-08-25T00:02:00.000Z',
  },
  error: null,
}))
const pulled = await pullParentStudentLinks({ supabase: readyClient, centerId })
assert.equal(pulled.ok, true)
assert.equal(pulled.links.length, 1)
assert.equal(pulled.links[0].contactId, contactId)
assert.equal(pulled.links[0].studentId, sampleStudent.id)
assert.equal(readyClient.calls[0].params.p_include_ended, false)

const wrongCenterClient = createRpcMock(async () => ({
  data: { ok: true, outcome_code: 'PARENT_STUDENT_LINKS_READ', center_id: 'center_b', links: [] },
  error: null,
}))
const wrongCenter = await pullParentStudentLinks({ supabase: wrongCenterClient, centerId })
assert.equal(wrongCenter.ok, false)
assert.equal(wrongCenter.outcome_code, 'INVALID_SERVER_RESULT')

const malformedClient = createRpcMock(async () => ({
  data: {
    ok: true,
    outcome_code: 'PARENT_STUDENT_LINKS_READ',
    center_id: centerId,
    links: [sampleLinkRow, { ...sampleLinkRow, student_entity_version: 0 }],
  },
  error: null,
}))
assert.equal((await pullParentStudentLinks({ supabase: malformedClient, centerId })).ok, false)

// Exact retry sends the same server intent and never creates a browser-side authority.
const mutationClient = createRpcMock(async (_name, params, calls) => ({
  data: {
    ok: true,
    outcome_code: 'COMMITTED',
    replayed: calls.length > 1,
    operation: 'CREATE_LINK',
    link_id: params.p_link_id,
    link_version: 1,
  },
  error: null,
}))
const createInput = {
  supabase: mutationClient,
  centerId,
  linkId,
  contactId,
  studentId: sampleStudent.id,
  relationshipType: 'PARENT',
  isPrimaryContact: true,
  financialContactRole: 'PRIMARY',
  academicContactRole: 'PRIMARY',
  idempotencyKey,
}
assert.equal((await createParentStudentLink(createInput)).ok, true)
assert.equal((await createParentStudentLink(createInput)).replayed, true)
assert.deepEqual(mutationClient.calls[0], mutationClient.calls[1])

const staleClient = createRpcMock(async () => ({
  data: null,
  error: { code: 'P0001', message: 'CONTACT_VERSION_STALE' },
}))
const stale = await updateProtectedContactIdentity({
  supabase: staleClient,
  centerId,
  contactId,
  expectedVersion: 2,
  displayName: 'Parent',
  phones: ['0900000000'],
  emails: [],
  idempotencyKey,
})
assert.equal(stale.ok, false)
assert.equal(stale.outcome_code, 'CONTACT_VERSION_STALE')
assert.match(stale.error, /đã được người khác cập nhật/i)
assert.match(getParentFirstOutcomeMessage('LINK_COLLISION_REVIEW_REQUIRED'), /kiểm tra/i)

// No name/phone fuzzy match: only exact link IDs can join CRM Contact and Student.
const studentBefore = structuredClone(sampleStudent)
const derived = buildDerivedParentContactsFromStudents([sampleStudent])
assert.equal(derived.length, 1)
assert.equal(derived[0].requiresExplicitCrmLink, true)
assert.equal(derived[0].linkedStudentIds.length, 0)
const samePhoneContact = { ...sampleContact, canonicalContactId: '55555555-5555-4555-8555-555555555555', phone: sampleStudent.motherPhone }
const withoutLink = mergeParentContactsWithStudents([samePhoneContact], [sampleStudent], [])
assert.equal(withoutLink.length, 2, 'Matching phone must not auto-link or auto-merge')
assert.equal(withoutLink.find((item) => item.id === samePhoneContact.id).relatedStudents.length, 0)
assert.deepEqual(sampleStudent, studentBefore, 'UI projection must never mutate Student payload')

const withLink = mergeParentContactsWithStudents([sampleContact], [sampleStudent], pulled.links)
assert.equal(withLink.length, 1)
assert.equal(withLink[0].relatedStudents[0].id, sampleStudent.id)
assert.equal(withLink[0].parentName, 'Reviewed Parent')
assert.equal(withLink[0].phone, '0900000099')
assert.equal(withLink[0].contactVersion, 3)

const readyHtml = renderParentConsultationModule(
  [sampleContact],
  undefined,
  [sampleStudent],
  null,
  null,
  null,
  sampleContact.id,
  { malicious: 'conversion-state-must-be-ignored' },
  { isLoading: false, isSaving: false, message: '', messageTone: '', lastLoadedAt: '2026-08-25T00:02:00.000Z', eligibleConsultants: [] },
  { status: 'ready', moduleRefreshStatus: 'fresh', links: pulled.links },
)
assert.match(readyHtml, /Học viên liên quan/)
assert.match(readyHtml, /data-parent-linked-student-id="student-1"/)
assert.match(readyHtml, /Sửa thông tin liên hệ/)
assert.doesNotMatch(readyHtml, /data-p4b-|Chuẩn bị chuyển đổi|Chuyển đổi canonical/)
assert.doesNotMatch(readyHtml, /C5\.3|PH-1|\bRPC\b|\bschema\b|\bprojection\b|identity collision/i)

const derivedHtml = renderParentConsultationModule(
  [], undefined, [sampleStudent], null, null, null, derived[0].id, null,
  { isLoading: false, isSaving: false, message: '', messageTone: '', lastLoadedAt: '2026-08-25T00:02:00.000Z', eligibleConsultants: [] },
  { status: 'ready', moduleRefreshStatus: 'fresh', links: [] },
)
assert.match(derivedHtml, /Tạo\/ghép hồ sơ CRM/)
assert.match(derivedHtml, /Chỉ đọc từ hồ sơ học viên/)
assert.doesNotMatch(derivedHtml, /data-parent-quick-note-contact-id/)

const loadingHtml = renderParentConsultationModule(
  [sampleContact], undefined, [sampleStudent], null, null, null, null, null,
  { isLoading: false, isSaving: false },
  { status: 'loading', moduleRefreshStatus: 'loading', links: [] },
)
assert.match(loadingHtml, /Đang tải hồ sơ phụ huynh/)
assert.doesNotMatch(loadingHtml, /Reviewed Parent/)

const failedHtml = renderParentConsultationModule(
  [sampleContact], undefined, [sampleStudent], null, null, null, null, null,
  { isLoading: false, isSaving: false },
  { status: 'failed', moduleRefreshStatus: 'failed', message: 'Dữ liệu phụ huynh hiện chưa tải được.', links: [] },
)
assert.match(failedHtml, /chưa tải được/i)
assert.doesNotMatch(failedHtml, /Student Parent Source/)

const crmRefreshFailedHtml = renderParentConsultationModule(
  [sampleContact], undefined, [sampleStudent], null, null, null, null, null,
  { isLoading: false, isSaving: false, message: 'Hồ sơ đã được lưu nhưng chưa tải lại được danh sách.', messageTone: 'error', lastLoadedAt: '' },
  { status: 'ready', moduleRefreshStatus: 'failed', message: 'Đã tải liên kết.', links: [] },
)
assert.match(crmRefreshFailedHtml, /Hồ sơ đã được lưu nhưng chưa tải lại/)
assert.doesNotMatch(crmRefreshFailedHtml, /Đã tải liên kết/)

// Default production-like launcher remains 12 visible / 10 actionable / 2 unavailable.
const visibleModules = getProductionLauncherModules()
assert.equal(visibleModules.length, 12)
assert.equal(visibleModules.filter((item) => isProductionModuleAvailable(item.id)).length, 10)
assert.equal(isProductionModuleAvailable('khach-hang-tu-van'), false)
assert.equal(10 + Number(isParentFirstCapabilityReady(ready, centerId)), 11)

// Runtime activation is capability-driven; switch boundaries clear old links before I/O.
for (const token of [
  "if (moduleId === 'khach-hang-tu-van')",
  'isParentFirstCapabilityReady(parentFirstCapabilityState',
  "refreshParentStudentLinksSharedTruth({ reason: 'capability-probe' })",
  "case 'parent-links':",
  "entry('khach-hang-tu-van'",
  "['core', 'crm', 'parent-links']",
  'parentStudentLinks = []',
  'runId !== parentFirstCapabilityRunId',
  'centerId !== getCurrentCanonicalCenterContext().centerId',
  'data-parent-link-action="open-derived"',
  'data-parent-link-action="open-contact"',
  'data-parent-identity-action="open"',
  'updateProtectedContactIdentity',
  'createParentStudentLink',
  'updateParentStudentLink',
  'endParentStudentLink',
]) {
  assert(mainSource.includes(token) || moduleSource.includes(token) || registrySource.includes(token), `Missing PH-2 runtime boundary: ${token}`)
}
assert(!mainSource.includes("from './crm-conversion-bridge.js'"))
assert(!mainSource.includes('data-p4b-conversion-action'))
assert(!mainSource.includes('prepareCanonicalConversion('))
assert(!mainSource.includes('reviewCanonicalConversion('))
assert(!mainSource.includes('approveAndExecuteCanonicalConversion('))
assert(!mainSource.includes('saveStoredParentConsultations('))
assert(!mainSource.includes('localStorage.setItem(PARENT'))
const parentLinkRefreshBlock = mainSource.match(/async function refreshParentStudentLinksSharedTruth[\s\S]*?async function runParentFirstMutation/)?.[0] || ''
assert(parentLinkRefreshBlock)
assert(!parentLinkRefreshBlock.includes('parentLinkReviewState = null'), 'Manual refresh must preserve an in-progress explicit link review.')
assert(!parentLinkRefreshBlock.includes('parentIdentityEditState = null'), 'Manual refresh must preserve an in-progress protected identity edit.')
assert(mainSource.includes('result = await execute(readiness.supabase, centerContext.centerId)'))
assert(mainSource.includes("outcome_code: 'COMMITTED_PROJECTION_REFRESH_FAILED'"))

for (const sqlToken of [
  'ph_1_list_parent_student_links',
  'ph_1_create_parent_student_link',
  'ph_1_update_parent_student_link',
  'ph_1_end_parent_student_link',
  'ph_1_update_crm_contact_identity',
  'force row level security',
]) {
  assert(migrationSource.toLowerCase().includes(sqlToken.toLowerCase()))
}
assert(!migrationSource.includes('p4b_'))
assert(!migrationSource.includes('p3d_'))

console.log('PH_2_PARENT_FIRST_FRONTEND_INTEGRATION_SMOKE: PASS')
