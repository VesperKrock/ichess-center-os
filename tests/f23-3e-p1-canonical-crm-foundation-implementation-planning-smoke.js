import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const plan = read('docs/f23-3e-p1-canonical-crm-foundation-implementation-planning.md')
const foundation = read('docs/f23-2-phu-huynh-tu-van-hoc-vien-relationship-lifecycle-design.md')
const conversionDesign = read('docs/f23-3e-convert-that-phu-huynh-hoc-vien-idempotency-rollback-chong-trung.md')
const mfaDesign = read('docs/f23-13c-mfa-enrollment-enforcement-recovery-va-step-up.md')
const consultantDesign = read('docs/f23-13d-consultant-provisioning-capability-matrix-va-server-enforcement.md')
const previewDesign = read('docs/f23-3d-convert-preview-phu-huynh-hoc-vien-local-safe.md')
const parentSource = read('src/parent-consultation-module.js')
const mainSource = read('src/main.js')
const storageSource = read('src/storage.js')
const studentSource = read('src/student-module.js')
const studentData = read('src/student-data.js')
const studentTuitionSource = read('src/student-tuition-links.js')
const tuitionCloudSource = read('src/cloud-tuition-record-package-bridge.js')
const cloudSyncSource = read('src/cloud-db-sync.js')
const cloudEntitySource = read('src/cloud-db-entities.js')
const cloudAuditSource = read('src/cloud-audit-log.js')
const accessSource = read('src/online-access-control.js')
const schemaSnapshot = read('supabase/migrations/20260722000000_remote_schema.sql')
const roadmap = read('RoadmapRealTime.txt')
const canonicalRoadmapMirror = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')
const smokeSource = read('tests/f23-3e-p1-canonical-crm-foundation-implementation-planning-smoke.js')

const includesAll = (content, markers, message) => {
  for (const marker of markers) assert(content.includes(marker), `${message}: ${marker}`)
}

const section = (startMarker, endMarker) => {
  const start = plan.indexOf(startMarker)
  const end = plan.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0 && end > start, `Missing semantic section: ${startMarker} -> ${endMarker}`)
  return plan.slice(start, end)
}

const assertOrdered = (content, markers, message) => {
  let cursor = -1
  for (const marker of markers) {
    const next = content.indexOf(marker, cursor + 1)
    assert(next > cursor, `${message}: ${marker}`)
    cursor = next
  }
}

const atomicBlockFrom = (content, startMarker, endMarker) => {
  const start = content.indexOf(startMarker)
  const end = content.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0 && end > start, `Missing atomic block: ${startMarker}`)
  return content.slice(start, end + endMarker.length)
}
const atomicBlock = (startMarker, endMarker) => atomicBlockFrom(plan, startMarker, endMarker)

const assertMatrix = ({ startMarker, endMarker, prefix, count, columns, substantiveIndexes }) => {
  const content = section(startMarker, endMarker)
  const pattern = new RegExp(`^\\| F3E-P1-${prefix}(\\d+)\\b`)
  const rows = content.split('\n').filter((line) => pattern.test(line))
  const ids = rows.map((line) => Number(line.match(pattern)?.[1]))
  assert.equal(rows.length, count, `F3E-P1-${prefix} matrix count mismatch`)
  assert.deepEqual(ids, Array.from({ length: count }, (_, index) => index + 1), `F3E-P1-${prefix} IDs must be contiguous`)

  for (const row of rows) {
    const values = row.split('|').slice(1, -1).map((value) => value.trim())
    assert.equal(values.length, columns, `F3E-P1-${prefix} row column mismatch: ${row}`)
    for (const index of substantiveIndexes) {
      assert((values[index] || '').length >= 24, `F3E-P1-${prefix} row is not substantive: ${row}`)
    }
  }
}

includesAll(plan, [
  'F23_3E_P1_STATUS: DONE IMPLEMENTATION PLANNING',
  'F23_3E_P1_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_P1_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_3E_P1_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_3E_P1_SQL_CHANGE: NO',
  'F23_3E_P1_MIGRATION_CHANGE: NO',
  'F23_3E_P1_RLS_CHANGE: NO',
  'F23_3E_P1_AUTH_CHANGE: NO',
  'F23_3E_P1_SUPABASE_ACTION: NOT RUN',
  'F23_3E_P1_REAL_DATA_CHANGE: NO',
  'F23_3E_P1_REMOTE_DATABASE_ACTION_ALLOWED: NO',
], 'Package 1 planning-only status boundary is incomplete')

for (const classification of ['REPO FACT', 'PARTIAL FOUNDATION', 'DESIGN PROPOSAL', 'DEFERRED']) {
  assert(plan.includes(classification), `Missing evidence classification: ${classification}`)
}

includesAll(foundation, [
  'F23_2_FINAL_TECHNICAL_AUDIT: PASS',
  'CONTACT_OR_LEAD_IS_PARENT_PROFILE: NO',
  'CONSULTATION_CASE_IS_A_PERSON: NO',
  'ONE_GUARDIAN_CAN_LINK_MULTIPLE_STUDENTS: YES',
  'ONE_STUDENT_CAN_LINK_MULTIPLE_GUARDIANS: YES',
  'CONSULTANT_ASSIGNMENT_TARGET_IS_CASE_OR_RESOURCE: YES',
  'F23_2_RELATIONSHIP_SCOPE: EXACT_CENTER',
  'PHONE_MATCH_AUTO_MERGES_GUARDIAN: NO',
  'EMAIL_MATCH_AUTO_MERGES_GUARDIAN: NO',
  'CENTER_CRM_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE',
  'SAME_MATCH_EVIDENCE_SHARES_ONE_MUTEX: YES',
  'F23_2_IMPLEMENTATION_READINESS: BLOCKED',
], 'F23.2 inherited final-audit contract changed')

includesAll(conversionDesign, [
  'F23_3E_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_3E_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
  'ONE_ACTIVE_EXECUTABLE_CONVERSION_REQUEST_PER_CASE: YES',
  'SAME_IDEMPOTENCY_KEY_SAME_INTENT_RETURNS_PRIOR_OUTCOME: YES',
  'CONVERSION_ACTION_GRAPH_SERVER_VALIDATED: YES',
  'CONVERSION_EXECUTOR_ATOMIC_BEGIN',
  'ACCOUNT_SECURITY_CONTROL_ROWS, approver/executor subjects',
], 'F23.3E inherited final-audit contract changed')

const inheritedExecutor = atomicBlockFrom(conversionDesign, 'CONVERSION_EXECUTOR_ATOMIC_BEGIN', 'CONVERSION_EXECUTOR_ATOMIC_END')
assertOrdered(inheritedExecutor, [
  'CENTER_CRM_CONTROL_ROW',
  'IDENTITY_MATCH_MUTEX_ROWS',
  'ACCOUNT_SECURITY_CONTROL_ROWS',
  'CONVERSION_REQUEST_AND_APPROVAL_ROWS',
  'CONSULTATION_CASE_AND_CONTACT_ROWS',
  'CONSULTANT_ASSIGNMENT_AND_CARE_LOG_ROWS',
  'AUDIT_OUTBOX_ROWS',
  'COMMIT_ATOMIC',
], 'Inherited F23.3E executor relative order changed')

includesAll(mfaDesign, [
  'F23_13C_FINAL_TECHNICAL_AUDIT: PASS',
  'MFA_POLICY_SERVER_DERIVED: YES',
  'STEP_UP_ASSERTION_SINGLE_USE: YES',
  'BUSINESS_DOMAIN_ROOT_PRECEDES_ACCOUNT_SECURITY_FOR_COMPOSITE_MUTATION: YES',
  'CONSUME_ASSERTION_THEN_CALL_BUSINESS_API_ALLOWED: NO',
], 'F23.13C inherited account-security/step-up contract changed')

includesAll(consultantDesign, [
  'F23_13D_FINAL_TECHNICAL_AUDIT: PASS',
  'CONSULTANT_ROLE_SCOPE: EXACT_CENTER',
  'CONSULTANT_DEFAULT_RESOURCE_SCOPE: ASSIGNED_ONLY',
  'CONSULTANT_MASKING_MUST_BE_SERVER_SIDE: YES',
  'CONSULTANT_CLIENT_SIDE_MASKING_ONLY_ALLOWED: NO',
  'CONSULTANT_DIRECT_GENERIC_ENTITY_WRITE_ALLOWED: NO',
  'F23_13D_RLS_REMEDIATION_REQUIRED_BEFORE_RUNTIME: YES',
], 'F23.13D inherited consultant contract changed')

includesAll(plan, [
  'F23_3E_P1_INHERITS_F23_2_WITHOUT_RELAXATION: YES',
  'F23_3E_P1_INHERITS_F23_3E_WITHOUT_RELAXATION: YES',
  'F23_3E_P1_CHANGES_DOMAIN_MODEL: NO',
  'F23_3E_P1_CHANGES_CONVERSION_EXECUTOR_CONTRACT: NO',
  'Contact, consultation case, Guardian, Student and Guardian–Student Relationship remain separate entities',
  'Guardian–Student remains M:N',
  'Consultant assignment belongs to a case/resource',
  'FAIL / NEEDS REVIEW',
], 'Inherited Package 1 boundary is incomplete')

includesAll(parentSource, [
  "export const parentCustomerStages = ['lead', 'consulting', 'converted']",
  'export function createEmptyParentContactFormState()',
  'export function buildParentContactFromForm(values, existingContact = null, students = [])',
  'id: existingContact?.id || `contact-${Date.now()}`',
  'careLogs,',
  'appointments: sortAppointments',
  'enrollmentDraft:',
  'linkedStudentIds:',
  'export function buildParentConvertPreview',
  'export function getParentConvertCandidates',
  'Trùng số điện thoại',
  'Xác nhận chuyển đổi - chưa mở',
], 'CRM/F23.3D source truth changed')
assert(parentSource.includes('<button type="button" disabled>Xác nhận chuyển đổi - chưa mở</button>'), 'Real conversion confirmation must remain disabled')
includesAll(previewDesign, [
  'chỉ là bản xem trước',
  'chưa ghi `linkedStudentIds`',
  'chưa gọi Auth/Supabase/SQL/cloud/deploy',
], 'F23.3D preview-only boundary changed')

includesAll(storageSource, [
  "const PARENT_CONSULTATIONS_KEY = createCenterScopedStorageKey('parentConsultations')",
  'return `ichessCenterOS.${scope}.${currentStorageCenterId}`',
  'export function getStoredParentConsultations',
  'localStorage.getItem(PARENT_CONSULTATIONS_KEY)',
  'export function saveStoredParentConsultations',
  'localStorage.setItem(',
  'studentId: normalizeNullableId(contact.studentId)',
  'linkedStudentIds: normalizeParentLinkedStudentIds',
  'careLogs: normalizeParentCareLogs',
  'appointments: normalizeParentAppointments',
  'enrollmentDraft: normalizeParentEnrollmentDraft',
  'export function createCloudDbPullBackup',
], 'localStorage/migration repo facts changed')

includesAll(studentSource, [
  'export function buildStudentFromForm',
  'id: existingStudent?.id ?? `stu-${Date.now()}`',
  'parentName:',
  'fatherPhone:',
  'motherPhone:',
  'parentPhone:',
], 'Student identity/embedded parent facts changed')
assert(studentData.includes("export const studentStatuses = ['Đang theo học', 'Bảo lưu', 'Ngưng học']"), 'Student status vocabulary changed')
includesAll(studentTuitionSource, [
  'export function buildStudentTuitionLink',
  "return tuitionRecords.find((record) => String(record?.studentId ?? '').trim() === studentId) ?? null",
  'parentName: displayValue(student?.parentName)',
], 'Student/Tuition linkage facts changed')
includesAll(tuitionCloudSource, [
  "export const TUITION_RECORD_PACKAGE_ENTITY_TYPE = 'tuition_record_package'",
  ".from('center_cloud_entities')",
  ".upsert(records, { onConflict: 'center_id,entity_type,local_id' })",
], 'Tuition generic cloud bridge facts changed')

includesAll(cloudSyncSource, [
  'export async function listCloudEntities',
  ".from('center_cloud_entities')",
  '.select(CLOUD_ENTITY_SELECT_FIELDS)',
  'export async function upsertCloudEntities',
  ".upsert(records, { onConflict: 'center_id,entity_type,local_id' })",
], 'Generic cloud list/upsert facts changed')
includesAll(cloudEntitySource, [
  'export function buildCloudEntityRecord',
  'payload: sanitizeCloudPayload(payload)',
  'export function sanitizeCloudPayload',
], 'Generic cloud payload facts changed')
includesAll(cloudAuditSource, [
  'export async function writeC53AuditLogEntry',
  ".from('center_cloud_entities')",
  '.upsert([recordResult.data]',
], 'Generic audit repo fact changed')
includesAll(accessSource, [
  'export function buildOnlineAccessState',
  'const membership = input.membership ?? null',
  'export function canWriteEntity',
  "return ['student', 'teacher', 'class_session'].includes",
], 'Current role/membership checks changed')
includesAll(schemaSnapshot, [
  'CREATE POLICY "c4_6b center writers insert cloud entities"',
  'CREATE POLICY "center members can insert cloud entities"',
  'CREATE POLICY "center members can select cloud entities"',
  'CREATE POLICY "center members can update cloud entities"',
  'CREATE POLICY "center members can delete cloud entities"',
], 'Broad RLS snapshot facts changed')
assert(mainSource.includes('let parentConsultations = getStoredParentConsultations'), 'Main CRM still must load localStorage records')

includesAll(plan, [
  'CURRENT_CRM_LOCALSTORAGE_IS_CANONICAL_BACKEND: NO',
  'CURRENT_GENERIC_CLOUD_ENTITY_API_IS_CANONICAL_CRM_SERVICE: NO',
  'CURRENT_CRM_AUDIT_IS_TRANSACTIONAL_OUTBOX: NO',
  'F23_3D_PREVIEW_IS_CANONICAL_REQUEST: NO',
], 'Repo-truth conclusions are incomplete')

for (const entity of [
  'center_crm_control',
  'crm_contact',
  'consultation_case',
  'consultation_case_candidate_student',
  'consultation_case_assignment',
  'crm_care_log',
  'crm_conversion_request',
  'crm_idempotency_registry',
  'crm_audit_event',
  'crm_outbox_event',
]) assert(plan.includes(entity), `Missing Package 1 entity: ${entity}`)

includesAll(plan, [
  'F23_3E_P1_CREATES_GUARDIAN_RUNTIME: NO',
  'F23_3E_P1_CREATES_STUDENT_RUNTIME: NO',
  'F23_3E_P1_CREATES_RELATIONSHIP_RUNTIME: NO',
  'F23_3E_P1_EXECUTES_REAL_CONVERSION: NO',
  'F23_3E_P1_AUTO_CREATES_AUTH_ACCOUNT: NO',
  'F23_3E_P1_AUTO_CREATES_MEMBERSHIP: NO',
  'F23_3E_P1_AUTO_CREATES_TUITION_OR_PAYMENT: NO',
  'F23_3E_P1_AUTO_CREATES_CLASS_SCHEDULE_ATTENDANCE: NO',
  '`crm_case_appointment` and `crm_case_enrollment_draft` are **DEFERRED**',
], 'Package boundary is incomplete')

includesAll(plan, [
  'CRM_BROWSER_LOCALSTORAGE_IS_MULTI_USER_AUTHORITY: NO',
  'CRM_CLIENT_CENTER_ID_IS_AUTHORITY: NO',
  'CRM_CLIENT_ROLE_IS_AUTHORITY: NO',
  'CRM_CLIENT_ASSIGNMENT_IS_AUTHORITY: NO',
  'P1_SERVER_DERIVES_CANONICAL_USER_AND_CENTER: YES',
  'P1_SERVER_DERIVES_CAPABILITY_AND_ASSIGNMENT: YES',
], 'Canonical source-of-truth derivation is incomplete')

const control = section('## 5. Exactly-one `center_crm_control`', '## 6. Identifier')
includesAll(control, [
  'PLANNED',
  'MIGRATING',
  'READ_ONLY',
  'ACTIVE',
  'SUSPENDED',
  'CENTER_CRM_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE',
  'CENTER_CRM_CONTROL_ROW_IS_MUTATION_ROOT: YES',
  'CENTER_CRM_CONTROL_MISSING_FAILS_CLOSED: YES',
  'CENTER_CRM_CONTROL_DUPLICATE_FAILS_CLOSED: YES',
  'CENTER_CRM_ACTIVE_IMPLIES_CONVERSION_RUNTIME_ENABLED: NO',
  'EMPTY_CONTACT_OR_CASE_SET_PROVIDES_SERIALIZATION: NO',
], 'Center CRM root contract is incomplete')

const identifiers = section('## 6. Identifier', '## 7. `crm_contact`')
includesAll(identifiers, [
  'CLIENT_TIMESTAMP_ID_IS_CANONICAL_ID: NO',
  'LEGACY_CONTACT_ID_IS_GLOBAL_PERSON_ID: NO',
  'CANONICAL_ID_MAY_CONTAIN_RAW_PII: NO',
  'CANONICAL_ID_REUSE_ALLOWED: NO',
  'SUCCESSFUL_MUTATION_INCREMENTS_VERSION_BY_ONE: YES',
  'CLIENT_MAY_SET_TARGET_VERSION: NO',
  'EXPECTED_VERSION_REQUIRED_FOR_MUTATION: YES',
  'STALE_VERSION_MUTATION_ALLOWED: NO',
  'UPDATED_AT_ALONE_IS_CONCURRENCY_CONTROL: NO',
], 'ID/version policy is incomplete')

const contact = section('## 7. `crm_contact`', '## 8. `consultation_case`')
includesAll(contact, [
  'NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`, `ARCHIVED',
  'CRM_CONTACT_IS_GUARDIAN_PROFILE: NO',
  'CRM_CONTACT_IS_AUTH_ACCOUNT: NO',
  'RAW_CONTACT_METHOD_IS_AUDIT_FIELD: NO',
  'CONTACT_TRANSITION_CREATES_CASE_IMPLICITLY: NO',
  'keyed/versioned lookup digest',
  'protected raw value',
  'server-masked projection',
], 'Contact model/lifecycle is incomplete')

const caseCandidate = section('## 8. `consultation_case`', '## 9. Care log')
includesAll(caseCandidate, [
  'OPEN`, `CONSULTING`, `PAUSED`, `READY_FOR_CONVERSION`, `CONVERTED`, `LOST`, `CANCELLED`, `ARCHIVED',
  'only Package 3 executor may set `CONVERTED`',
  'CASE_PRIMARY_CONTACT_EXACT_CENTER_REQUIRED: YES',
  'CASE_STATUS_CLIENT_AUTHORITY: NO',
  'CASE_CONVERTED_WITHOUT_COMPLETED_CONVERSION_REQUEST_ALLOWED: NO',
  'CANDIDATE_STUDENT_IS_CANONICAL_STUDENT: NO',
  'CANDIDATE_STATUS_MAY_CREATE_STUDENT: NO',
  'CANDIDATE_BIRTH_EVIDENCE_MAY_BE_RETURNED_RAW_BY_DEFAULT: NO',
], 'Case/candidate model is incomplete')

const care = section('## 9. Care log', '## 10. Assignment')
includesAll(care, [
  'Care logs are append-only initially',
  'belong to a case',
  'current exact assignment/capability',
  'does not change contact/case status',
  'copy to Student notes',
  '**DEFERRED**',
], 'Care-log/supporting-resource scope is incomplete')

const assignment = section('## 10. Assignment', '## 11. Conversion request')
includesAll(assignment, [
  'ACTIVE`, `ENDED`, `REVOKED`, `SUPERSEDED',
  'ONE_ACTIVE_EXCLUSIVE_ASSIGNMENT_PER_CASE: YES',
  'ASSIGNMENT_HISTORY_REWRITTEN_ON_REASSIGN: NO',
  'ASSIGNMENT_CHANGE_TRANSFERS_PERSON_OWNERSHIP: NO',
  'CLIENT_MAY_SELF_ASSIGN: NO',
  'ASSIGNMENT_UNIQUENESS_REPLACES_CASE_ROOT_LOCK: NO',
  'P1_CONSULTANT_CASE_ASSIGNMENT_GRANTS_GLOBAL_CONTACT_MUTATION: NO',
  'P1_CONSULTANT_DIRECT_CANONICAL_CONTACT_UPDATE_ALLOWED: NO',
  'P1_CONSULTANT_DIRECT_CANONICAL_CONTACT_STATUS_TRANSITION_ALLOWED: NO',
  'P1_CONSULTANT_DIRECT_CANONICAL_CONTACT_ARCHIVE_ALLOWED: NO',
  'CONTACT_AUTHORITY_MAY_BE_INFERRED_FROM_ANY_LINKED_CASE: NO',
  'ASSIGNMENT_TARGET_SECURITY_READ_WITHOUT_LOCK_IS_SUFFICIENT: NO',
  'ASSIGNMENT_TARGET_MEMBERSHIP_STAFF_READ_WITHOUT_LOCK_IS_SUFFICIENT: NO',
  'ASSIGNMENT_CREATION_ATOMIC_WITH_TARGET_ELIGIBILITY_RECHECK: YES',
  'SECURITY_ONLY_REVOKE_WAITS_FOR_CRM_CASE_LOCK: NO',
  'WAITING_ASSIGNMENT_RECHECKS_SECURITY_AFTER_ACCOUNT_LOCK: YES',
  'CONCURRENT_TARGET_REVOKE_CAN_BE_MISSED_BY_ASSIGNMENT: NO',
  'ACCOUNT_SECURITY_TO_CENTER_ROOT_LOCK_INVERSION_ALLOWED: NO',
], 'Assignment contract is incomplete')

const request = section('## 11. Conversion request', '## 12. Scoped idempotency')
includesAll(request, [
  'DRAFT`, `READY_FOR_REVIEW`, `REJECTED`, `CANCELLED`, `SUPERSEDED',
  'Reserved but not P1-mutable: `APPROVED`, `EXECUTING`, `COMPLETED`, `COMPENSATION_REQUIRED`',
  'P1_CLIENT_MAY_SET_APPROVED: NO',
  'P1_CLIENT_MAY_SET_EXECUTING: NO',
  'P1_CLIENT_MAY_SET_COMPLETED: NO',
  'P1_REQUEST_FOUNDATION_IS_CONVERSION_EXECUTOR: NO',
  'ONE_ACTIVE_REVIEWABLE_CONVERSION_REQUEST_PER_CASE: YES',
], 'Conversion request foundation is incomplete')

const idempotency = section('## 12. Scoped idempotency', '## 13. Transactional audit')
includesAll(idempotency, [
  'environment_fingerprint + center_id + consultation_case_id + operation + idempotency_key',
  'RESERVED`, `IN_PROGRESS`, `COMPLETED`, `CONFLICT`, `EXPIRED',
  'SAME_KEY_SAME_INTENT_RETURNS_PRIOR_RESULT: YES',
  'SAME_KEY_DIFFERENT_INTENT_CONFLICTS: YES',
  'IDEMPOTENCY_KEY_GRANTS_BUSINESS_AUTHORITY: NO',
  'IDEMPOTENCY_UNIQUE_CONSTRAINT_REPLACES_ROOT_LOCK: NO',
  'IDEMPOTENCY_RECORD_MAY_BE_OVERWRITTEN_BY_DIFFERENT_INTENT: NO',
], 'Scoped idempotency contract is incomplete')

const auditOutbox = section('## 13. Transactional audit', '## 14. Canonical lock')
includesAll(auditOutbox, [
  'one database transaction',
  'CRM_AUDIT_INSERT_FAILURE_ALLOWS_BUSINESS_COMMIT: NO',
  'CRM_AUDIT_CONTAINS_RAW_PHONE_EMAIL: NO',
  'CRM_AUDIT_CONTAINS_CHILD_BIRTH_DATA: NO',
  'CRM_AUDIT_IS_CLIENT_AUTHORED: NO',
  'OUTBOX_ROW_INSERT_FAILURE_ALLOWS_BUSINESS_COMMIT: NO',
  'OUTBOX_DELIVERY_FAILURE_ROLLS_BACK_COMMITTED_BUSINESS_MUTATION: NO',
  'OUTBOX_DELIVERY_IS_EXACTLY_ONCE_NETWORK_GUARANTEE: NO',
  'OUTBOX_DELIVERY_IS_IDEMPOTENT_AT_LEAST_ONCE: YES',
  'claim_expires_at',
  'DEAD_LETTER',
  'Consumer effects are idempotent',
], 'Transactional audit/outbox contract is incomplete')

const lockExpectations = [
  {
    start: 'CONTACT_CREATE_ATOMIC_BEGIN',
    end: 'CONTACT_CREATE_ATOMIC_END',
    rows: ['0. CENTER_CRM_CONTROL_ROW', '1. CONTACT_IDEMPOTENCY_OR_PREALLOCATED_CONTACT_ROW', '2. CRM_CONTACT_ROW', '3. AUDIT_OUTBOX_ROWS', '4. COMMIT_ATOMIC'],
  },
  {
    start: 'CASE_CREATE_ATOMIC_BEGIN',
    end: 'CASE_CREATE_ATOMIC_END',
    rows: ['0. CENTER_CRM_CONTROL_ROW', '1. ACCOUNT_SECURITY_CONTROL_ROWS', '2. TARGET_CENTER_MEMBERSHIP_AND_STAFF_ELIGIBILITY_ROWS_IF_INITIAL_ASSIGNMENT', '3. CRM_CONTACT_ROW', '4. CASE_IDEMPOTENCY_OR_PREALLOCATED_CASE_ROW', '5. CONSULTATION_CASE_ROW', '6. INITIAL_ASSIGNMENT_ROW_IF_ANY', '7. AUDIT_OUTBOX_ROWS', '8. COMMIT_ATOMIC'],
  },
  {
    start: 'CONTACT_GOVERNANCE_MUTATION_ATOMIC_BEGIN',
    end: 'CONTACT_GOVERNANCE_MUTATION_ATOMIC_END',
    rows: ['0. CENTER_CRM_CONTROL_ROW', '1. ACCOUNT_SECURITY_CONTROL_ROW, actor', '2. CRM_CONTACT_ROW', '3. RELATED_OPEN_CASE_ROWS_IF_SEMANTICALLY_MUTATED', '4. AUDIT_OUTBOX_ROWS', '5. COMMIT_ATOMIC'],
  },
  {
    start: 'CONTACT_GOVERNANCE_WITH_REQUEST_MUTATION_ATOMIC_BEGIN',
    end: 'CONTACT_GOVERNANCE_WITH_REQUEST_MUTATION_ATOMIC_END',
    rows: ['0. CENTER_CRM_CONTROL_ROW', '1. ACCOUNT_SECURITY_CONTROL_ROW, actor', '2. IDEMPOTENCY_REGISTRY_AND_OVERLAPPING_CONVERSION_REQUEST_ROWS', '3. CRM_CONTACT_ROW', '4. RELATED_OPEN_CASE_ROWS_IF_SEMANTICALLY_MUTATED', '5. AUDIT_OUTBOX_ROWS', '6. COMMIT_ATOMIC'],
  },
  {
    start: 'CASE_WITH_REQUEST_MUTATION_ATOMIC_BEGIN',
    end: 'CASE_WITH_REQUEST_MUTATION_ATOMIC_END',
    rows: ['0. CENTER_CRM_CONTROL_ROW', '1. ACCOUNT_SECURITY_CONTROL_ROW, actor', '2. OVERLAPPING_CONVERSION_REQUEST_ROWS', '3. CONSULTATION_CASE_ROW', '4. CURRENT_ASSIGNMENT_ROW_IF_REQUIRED', '5. AUDIT_OUTBOX_ROWS', '6. COMMIT_ATOMIC'],
  },
  {
    start: 'CASE_ASSIGNMENT_SECURITY_ATOMIC_BEGIN',
    end: 'CASE_ASSIGNMENT_SECURITY_ATOMIC_END',
    rows: ['0. CENTER_CRM_CONTROL_ROW', '1. ACCOUNT_SECURITY_CONTROL_ROWS, actor and target consultant sorted by canonical_user_id', '2. TARGET_CENTER_MEMBERSHIP_AND_STAFF_ELIGIBILITY_ROWS', '3. CONSULTATION_CASE_ROW', '4. CURRENT_ASSIGNMENT_ROW_IF_ANY', '5. PREALLOCATED_NEW_ASSIGNMENT_ROW_IF_ANY', '6. AUDIT_OUTBOX_ROWS', '7. COMMIT_ATOMIC'],
  },
  {
    start: 'CASE_ASSIGNMENT_WITH_REQUEST_SECURITY_ATOMIC_BEGIN',
    end: 'CASE_ASSIGNMENT_WITH_REQUEST_SECURITY_ATOMIC_END',
    rows: ['0. CENTER_CRM_CONTROL_ROW', '1. ACCOUNT_SECURITY_CONTROL_ROWS', '2. TARGET_CENTER_MEMBERSHIP_AND_STAFF_ELIGIBILITY_ROWS', '3. IDEMPOTENCY_REGISTRY_AND_OVERLAPPING_CONVERSION_REQUEST_ROWS', '4. CONSULTATION_CASE_ROW', '5. CURRENT_ASSIGNMENT_ROW_IF_ANY', '6. PREALLOCATED_NEW_ASSIGNMENT_ROW_IF_ANY', '7. AUDIT_OUTBOX_ROWS', '8. COMMIT_ATOMIC'],
  },
  {
    start: 'CASE_ASSIGNMENT_END_WITH_REQUEST_SECURITY_ATOMIC_BEGIN',
    end: 'CASE_ASSIGNMENT_END_WITH_REQUEST_SECURITY_ATOMIC_END',
    rows: ['0. CENTER_CRM_CONTROL_ROW', '1. ACCOUNT_SECURITY_CONTROL_ROW, actor', '2. IDEMPOTENCY_REGISTRY_AND_OVERLAPPING_CONVERSION_REQUEST_ROWS', '3. CONSULTATION_CASE_ROW', '4. CURRENT_ASSIGNMENT_ROW', '5. AUDIT_OUTBOX_ROWS', '6. COMMIT_ATOMIC'],
  },
  {
    start: 'CONVERSION_DRAFT_CREATE_ATOMIC_BEGIN',
    end: 'CONVERSION_DRAFT_CREATE_ATOMIC_END',
    rows: ['0. CENTER_CRM_CONTROL_ROW', '1. ACCOUNT_SECURITY_CONTROL_ROW, requester', '2. IDEMPOTENCY_REGISTRY_AND_PREALLOCATED_CONVERSION_REQUEST_ROW', '3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS', '4. CURRENT_ASSIGNMENT_ROW', '5. AUDIT_OUTBOX_ROWS', '6. COMMIT_ATOMIC'],
  },
  {
    start: 'CONVERSION_REQUEST_MUTATION_ATOMIC_BEGIN',
    end: 'CONVERSION_REQUEST_MUTATION_ATOMIC_END',
    rows: ['0. CENTER_CRM_CONTROL_ROW', '1. ACCOUNT_SECURITY_CONTROL_ROWS', '2. IDEMPOTENCY_REGISTRY_AND_CONVERSION_REQUEST_ROWS', '3. CRM_CONTACT_AND_CONSULTATION_CASE_ROWS', '4. CURRENT_ASSIGNMENT_ROW_IF_REQUIRED', '5. AUDIT_OUTBOX_ROWS', '6. COMMIT_ATOMIC'],
  },
]
for (const expectation of lockExpectations) {
  assertOrdered(atomicBlock(expectation.start, expectation.end), expectation.rows, `Lock order changed for ${expectation.start}`)
}
includesAll(plan, [
  'F23_3E_P1_REQUEST_LOCK_ORDER_COMPOSES_WITH_F23_3E_EXECUTOR: YES',
  'P1_CASE_OR_ASSIGNMENT_LOCK_PRECEDES_OVERLAPPING_REQUEST_LOCK: NO',
  'P1_REQUEST_LOCK_ORDER_INVERSION_ALLOWED: NO',
  'P1_REQUEST_ROW_LOCK_PRECEDES_SOURCE_CASE_CONTACT_LOCKS: YES',
  'P1_SOURCE_CASE_CONTACT_LOCKS_PRECEDE_ASSIGNMENT_LOCK: YES',
  'CASE_ASSIGNMENT_END_ATOMIC_BEGIN',
  'CARE_LOG_APPEND_ATOMIC_BEGIN',
  'LOCK_CASE_THEN_RETURN_TO_CENTER_ROOT: NO',
  'All same-tier rows sort by stable opaque ID',
  'No external call or human wait occurs while locks are held',
], 'Canonical lock-order rules are incomplete')

const staleRequestOrder = ['root', 'case', 'assignment', 'idempotency', 'request'].join(' → ')
assert(!plan.toLowerCase().includes(staleRequestOrder), 'Stale Case → Assignment → Request lock order is forbidden')

const operations = section('## 15. Typed service operation plan', '## 16. PII classification')
for (const operation of [
  'crm.contact.create',
  'crm.contact.update',
  'crm.contact.transition_status',
  'crm.contact.archive',
  'crm.case.create',
  'crm.case.update',
  'crm.case.transition_status',
  'crm.case.archive',
  'crm.assignment.assign',
  'crm.assignment.reassign',
  'crm.assignment.end',
  'crm.care_log.append',
  'crm.conversion.create_draft',
  'crm.conversion.update_draft',
  'crm.conversion.submit_review',
  'crm.conversion.cancel',
  'crm.conversion.get_status',
  'crm.outbox.claim',
  'crm.outbox.mark_delivered',
  'crm.outbox.mark_retry',
]) assert(operations.includes(`\`${operation}\``), `Missing typed operation: ${operation}`)
includesAll(operations, [
  'Caller authority',
  'Center derivation',
  'Assignment',
  'Expected version',
  'Policy/version guard',
  'Typed input allowlist',
  'Idempotency scope',
  'Lock order',
  'Audit / outbox',
  'Safe response',
  'Safe errors',
  'Rate limit',
  'Package',
  'No operation accepts `entityType + arbitrary payload`',
], 'Typed operation columns/boundary are incomplete')

const operationRow = (operation) => {
  const row = operations.split('\n').find((line) => line.startsWith(`| \`${operation}\` |`))
  assert(row, `Missing typed operation row: ${operation}`)
  return row
}

const contactUpdateRow = operationRow('crm.contact.update')
const contactStatusRow = operationRow('crm.contact.transition_status')
const contactArchiveRow = operationRow('crm.contact.archive')
includesAll(contactUpdateRow, ['Owner/Admin or exact `crm.contact.govern`', 'case assignment is never Contact authority', 'C1R Request → Contact/Case if overlap'], 'Contact update authority is unsafe')
includesAll(contactStatusRow, ['Owner/Admin or exact `crm.contact.govern_status`', 'no arbitrary linked-case proof', 'C1R Request → Contact/Case if overlap'], 'Contact status authority is unsafe')
includesAll(contactArchiveRow, ['Owner/Admin or exact `crm.contact.govern_archive`', 'consultant direct archive denied', 'C1R Request → Contact/Case'], 'Contact archive authority is unsafe')
for (const row of [contactUpdateRow, contactStatusRow, contactArchiveRow]) {
  assert(!row.includes('crm.lead.update_assigned'), 'Assigned-case capability must not govern canonical Contact')
  assert(!row.includes('Required for consultant'), 'Case assignment must not be required/accepted as Contact authority')
  assert(!row.includes('Consultant only assigned case/resource'), 'Linked case cannot prove Contact governance')
}

const assignmentAssignRow = operationRow('crm.assignment.assign')
const assignmentReassignRow = operationRow('crm.assignment.reassign')
includesAll(assignmentAssignRow, ['Target security, exact-center membership and Staff eligibility locked/rechecked', 'Actor/target security + eligibility', 'C4; C4R Request → Case → Assignment if overlap'], 'Assignment create security composition is incomplete')
includesAll(assignmentReassignRow, ['target security/eligibility locked', 'Actor/target security + eligibility', 'concurrent revoke', 'C4; C4R Request → Case → Assignment if overlap'], 'Reassignment security composition is incomplete')
includesAll(operationRow('crm.assignment.end'), ['C4ER Request → Case → Assignment if overlap'], 'Assignment end request composition is incomplete')

includesAll(operationRow('crm.conversion.create_draft'), ['Account security → idempotency/request → Contact/Case → Assignment'], 'Conversion draft typed order is stale')
for (const operation of ['crm.conversion.update_draft', 'crm.conversion.submit_review', 'crm.conversion.cancel']) {
  includesAll(operationRow(operation), ['C7 Request → Contact/Case → Assignment'], `Conversion request mutation order is stale for ${operation}`)
}
for (const operation of ['crm.case.transition_status', 'crm.case.archive']) {
  includesAll(operationRow(operation), ['C3 Request → Case → Assignment'], `Case/request composition is stale for ${operation}`)
}
includesAll(operationRow('crm.case.update'), ['C3 Request → Case → Assignment if overlap'], 'Case update/request composition is stale')

const pii = section('## 16. PII classification', '## 17. RLS')
includesAll(pii, [
  'Authorized resource-safe',
  'Protected PII',
  'Forbidden by default',
  'P1_SERVER_SIDE_MASKING_REQUIRED: YES',
  'P1_RAW_PII_SENT_FOR_CLIENT_MASKING: NO',
  'P1_GENERIC_CENTER_WIDE_CONSULTANT_READ_ALLOWED: NO',
  'P1_REVEALED_PII_PERSISTENT_BROWSER_CACHE_ALLOWED: NO',
  'MFA met, fresh step-up',
], 'PII/read projection contract is incomplete')

const rls = section('## 17. RLS', '## 18. LocalStorage')
includesAll(rls, [
  'generic `center_cloud_entities` SELECT',
  'broad INSERT/UPDATE/DELETE policies',
  'direct browser REST/table calls',
  'realtime subscriptions',
  'export/search/report endpoints',
  'service worker/offline/persistent browser caches',
  'P1_RUNTIME_WITH_BROAD_ACTIVE_MEMBER_WRITE_ALLOWED: NO',
  'P1_RUNTIME_WITH_GENERIC_RAW_SELECT_ALLOWED: NO',
  'P1_UI_GUARD_REPLACES_RLS: NO',
  'P1_TYPED_ENDPOINT_REPLACES_ALL_DIRECT_TABLE_WRITES: YES',
  'P1_RUNTIME_REQUIRES_DIRECT_API_RLS_TESTS: YES',
], 'RLS/read-path prerequisite plan is incomplete')

const migration = section('## 18. LocalStorage', '## 19. Failure outcomes')
includesAll(migration, [
  'Phase A — read-only inventory',
  'Phase B — controlled export bundle',
  'export_version',
  'record counts',
  'checksums',
  'local legacy IDs',
  'Phase C — server import preview',
  'Phase D — approved import',
  'Phase E — local freeze/backup',
  'SERVER_CAN_AUTOMATICALLY_BACKFILL_ALL_BROWSER_LOCALSTORAGE: NO',
  'LOCALSTORAGE_CONTACT_IS_TRUSTED_CANONICAL_IMPORT: NO',
  'LOCALSTORAGE_IMPORT_MAY_BYPASS_REVIEW: NO',
  'LOCALSTORAGE_IMPORT_AUTO_CREATES_GUARDIAN_STUDENT: NO',
  'LEGACY_CONVERTED_STAGE_CREATES_CANONICAL_CONVERSION: NO',
], 'LocalStorage import strategy is incomplete')

const failures = section('## 19. Failure outcomes', '## 20. Race matrix')
const failureRows = failures.split('\n').filter((line) => /^\| (?:Center root missing|Center root duplicate|Stale expected version|Invalid lifecycle transition|Assignment stale|Same key\/different intent|Audit insert failure|Outbox insert failure|Outbox delivery failure|PII protection unavailable|Capability resolver unavailable|Server masking unavailable|RLS\/read path incomplete|Import malformed|Import center mismatch|Duplicate legacy ID|Browser retry after timeout|Partial local export|Policy version change|Feature flag suspended) \|/.test(line))
assert.equal(failureRows.length, 20, 'Failure outcome matrix must cover exactly the 20 required cases')
for (const row of failureRows) {
  const values = row.split('|').slice(1, -1).map((value) => value.trim())
  assert.equal(values.length, 6, `Failure row column mismatch: ${row}`)
  assert(values[4].length >= 18 && values[5].length >= 24, `Failure outcome/retry must be substantive: ${row}`)
}

assertMatrix({
  startMarker: '## 20. Race matrix F3E-P1-R1–F3E-P1-R20',
  endMarker: '## 21. Negative matrix',
  prefix: 'R',
  count: 20,
  columns: 8,
  substantiveIndexes: [6, 7],
})
assertMatrix({
  startMarker: '## 21. Negative matrix F3E-P1-N1–F3E-P1-N36',
  endMarker: '## 22. Threat model',
  prefix: 'N',
  count: 36,
  columns: 3,
  substantiveIndexes: [2],
})
assertMatrix({
  startMarker: '## 22. Threat model F3E-P1-T1–F3E-P1-T24',
  endMarker: '## 23. Approval gates',
  prefix: 'T',
  count: 24,
  columns: 6,
  substantiveIndexes: [3],
})
assertMatrix({
  startMarker: '## 23. Approval gates F3E-P1-AG1–F3E-P1-AG18',
  endMarker: '## 24. Future implementation sequence',
  prefix: 'AG',
  count: 18,
  columns: 6,
  substantiveIndexes: [1],
})

const raceMatrix = section('## 20. Race matrix', '## 21. Negative matrix')
includesAll(raceMatrix, [
  'Two contact creates same idempotency key',
  'Same key different contact intent',
  'Case status vs reassignment with request overlap',
  'assign versus target account-security disable',
  'Revoke-first makes target stale/ineligible and no assignment is created',
  'Reassign vs conversion submit',
  'Root → account security/eligibility → Request → Case → Assignment',
  'Draft update vs submit review',
  'Root → account security → idempotency/Request → Contact/Case → Assignment',
  'Two active requests same case',
  'Outbox double claim',
  'Two imports same legacy contact',
  'Local edit after import',
  'Exactly one create audit/outbox',
], 'Race outcomes are incomplete')

const negatives = section('## 21. Negative matrix', '## 22. Threat model')
includesAll(negatives, [
  'Browser changes `center_id`',
  'Client sends forged owner/consultant role',
  'Client sets case `CONVERTED`',
  'Client self-assigns consultant or supplies stale eligible target',
  'Consultant uses one case assignment to read or mutate shared canonical Contact',
  'child order locks Case/Assignment before Request',
  'Under account-security → idempotency/Request → Contact/Case → Assignment locks',
  'assignment target concurrently revoked',
  'Raw phone written to audit',
  'Generic cloud upsert creates canonical CRM',
  'LocalStorage imported as trusted canonical data',
  'Import creates Guardian/Student',
  'Capability/masking unavailable or assignment target concurrently revoked',
  'Package 1 claims conversion runtime done',
], 'Negative fail-closed coverage is incomplete')

const threats = section('## 22. Threat model', '## 23. Approval gates')
includesAll(threats, [
  'Cross-center IDOR',
  'shared Contact authority bleed',
  'Generic table write bypass',
  'Browser-side masking',
  'Duplicate active assignment / stale target eligibility',
  'Assignment authority linger / concurrent target revoke',
  'Audit contains PII',
  'Outbox duplicate delivery',
  'Legacy converted-stage falsification',
  'Alternate generic endpoint / cross-package request-order drift',
  'Premature Package 2/3 coupling / Case-before-Request inversion',
], 'Threat model coverage is incomplete')

const gates = section('## 23. Approval gates', '## 24. Future implementation sequence')
includesAll(gates, [
  'F3E-P1-AG2 ID format? | Server-generated opaque UUID-family IDs',
  'F3E-P1-AG4 Exactly-one center root provisioning? | Controlled provisioning, exactly one row before activation',
  'F3E-P1-AG5 CRM feature states? | `PLANNED/MIGRATING/READ_ONLY/ACTIVE/SUSPENDED`',
  'F3E-P1-AG8 Active assignment model? | One exclusive active **case** assignee initially; no global Contact mutation authority',
  'F3E-P1-AG9 Who can assign/reassign? | Owner/Center Admin or exact CRM supervisor capability; lock actor/target security and target eligibility',
  'F3E-P1-AG10 Care-log edit/delete? | Append-only initially; correction by new event',
  'F3E-P1-AG11 Idempotency retention? | Retain terminal outcome with business/audit retention',
  'F3E-P1-AG13 Outbox retry/dead-letter? | Lease + idempotent delivery + capped exponential retry + reviewed dead letter',
  'F3E-P1-AG14 Is local import mandatory? | Optional controlled import; no automatic browser harvesting',
  'F3E-P1-AG16 Legacy `converted` handling? | Import as legacy claim requiring review, never canonical conversion',
  'F3E-P1-AG17 Rollout feature flag? | Server-authoritative center allowlist plus kill switch',
  'F3E-P1-AG18 Start implementation conditions? | External audit PASS plus explicit approval of Request → Contact/Case → Assignment composition and account-security/eligibility assignment locking',
], 'Approval-gate defaults are incomplete')

const future = section('## 24. Future implementation sequence', '## 25. Implementation blockers')
includesAll(future, [
  'P1-A — Schema and control root',
  'P1-B — Request and idempotency',
  'P1-C — Transactional audit/outbox',
  'P1-D — Typed service layer',
  'P1-E — Security and migration readiness',
  'P1-F — QA and rollout',
  'No package below is implemented by this task',
  'Package 3 approval/executor cannot use P1 reserved status fields',
], 'Future implementation sequence is incomplete')

const blockers = section('## 25. Implementation blockers', '## 26. Final technical audit closeout')
includesAll(blockers, [
  'approved physical database/schema and immutable migration naming/order',
  'exactly-one center root provisioning/runbook',
  'typed service/API architecture and exact capability catalog',
  'F23.13D resolver',
  'approved F23.3E Request → Contact/Case → Assignment composition',
  'exact Contact-governance capabilities',
  'actor/target account-security and target membership/Staff eligibility locking',
  'F23.13C MFA/fresh step-up plan',
  'RLS/direct read/realtime/export/cache/generic-write remediation plan',
  'transactional audit/outbox design',
  'idempotency retention/digest/key-rotation decisions',
  'concurrency/deadlock/fault-injection/direct-API test plan',
  'explicit user approval before any SQL, migration or Supabase action',
  'F23_3E_P1_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_3E_P1_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_3E_P1_REMOTE_DATABASE_ACTION_ALLOWED: NO',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
], 'Implementation blockers/readiness boundary is incomplete')

const closeout = plan.slice(plan.indexOf('## 26. Final technical audit closeout'))
includesAll(closeout, [
  'External final technical audit đã `PASS`',
  'F23.3E-P1 DONE implementation planning',
  'does not mean implementation/runtime is done',
  'grants no authority to run SQL, migration, RLS, Auth or Supabase actions',
  'F23.3E-P1 IMPLEMENTATION DESIGN: SAFE TO START AFTER EXPLICIT APPROVAL',
], 'Final technical audit closeout is incomplete')

const currentRoadmapState = 'F23.3E PARTIAL public/backend/QA / Design và backend P1-P3 DONE; đang thực hiện P4 UI conversion thật, legacy projection và manual E2E; remote Supabase apply/deploy chưa chạy'
const currentP1RoadmapState = 'F23.3E-P1 DONE backend/local verified / Nền CRM canonical, Request-idempotency, Audit-Outbox, typed operations, masked reads và rollout-gate QA PASS'
includesAll(roadmap, [currentRoadmapState, currentP1RoadmapState, 'F23.3E-P4A DONE backend/local verified'], 'Current F23.3E roadmap state is incomplete')
assert(!roadmap.includes('F23.3E-P1 READY'), 'P1 roadmap must not claim a non-terminal READY state')
assert(!roadmap.includes('Supabase applied'), 'Roadmap must not claim remote apply')
assert(canonicalRoadmapMirror.includes('F23.3E-P1 DONE implementation planning'), 'Historical P1 design evidence drifted')

for (const forbiddenClaim of [
  'F23_3E_P1_FINAL_TECHNICAL_AUDIT: NOT RUN',
  'F23_3E_P1_IMPLEMENTATION_READINESS: READY',
  'F23_3E_P1_RUNTIME_IMPLEMENTATION: DONE',
  'F23_3E_P1_REMOTE_DATABASE_ACTION_ALLOWED: YES',
  'F23_3E_P1_SQL_CHANGE: YES',
  'F23_3E_P1_MIGRATION_CHANGE: YES',
  'F23_3E_P1_RLS_CHANGE: YES',
  'F23_3E_P1_AUTH_CHANGE: YES',
  'F23_3E_P1_SUPABASE_ACTION: RUN',
  'CURRENT_CRM_LOCALSTORAGE_IS_CANONICAL_BACKEND: YES',
  'CURRENT_GENERIC_CLOUD_ENTITY_API_IS_CANONICAL_CRM_SERVICE: YES',
  'CURRENT_CRM_AUDIT_IS_TRANSACTIONAL_OUTBOX: YES',
  'F23_3D_PREVIEW_IS_CANONICAL_REQUEST: YES',
  'CRM_CLIENT_CENTER_ID_IS_AUTHORITY: YES',
  'CRM_CLIENT_ROLE_IS_AUTHORITY: YES',
  'CRM_CLIENT_ASSIGNMENT_IS_AUTHORITY: YES',
  'CLIENT_TIMESTAMP_ID_IS_CANONICAL_ID: YES',
  'CLIENT_MAY_SET_TARGET_VERSION: YES',
  'LOCK_CASE_THEN_RETURN_TO_CENTER_ROOT: YES',
  'P1_CASE_OR_ASSIGNMENT_LOCK_PRECEDES_OVERLAPPING_REQUEST_LOCK: YES',
  'P1_REQUEST_LOCK_ORDER_INVERSION_ALLOWED: YES',
  'P1_CONSULTANT_CASE_ASSIGNMENT_GRANTS_GLOBAL_CONTACT_MUTATION: YES',
  'P1_CONSULTANT_DIRECT_CANONICAL_CONTACT_UPDATE_ALLOWED: YES',
  'P1_CONSULTANT_DIRECT_CANONICAL_CONTACT_STATUS_TRANSITION_ALLOWED: YES',
  'P1_CONSULTANT_DIRECT_CANONICAL_CONTACT_ARCHIVE_ALLOWED: YES',
  'CONTACT_AUTHORITY_MAY_BE_INFERRED_FROM_ANY_LINKED_CASE: YES',
  'ASSIGNMENT_TARGET_SECURITY_READ_WITHOUT_LOCK_IS_SUFFICIENT: YES',
  'ASSIGNMENT_TARGET_MEMBERSHIP_STAFF_READ_WITHOUT_LOCK_IS_SUFFICIENT: YES',
  'CONCURRENT_TARGET_REVOKE_CAN_BE_MISSED_BY_ASSIGNMENT: YES',
  'ACCOUNT_SECURITY_TO_CENTER_ROOT_LOCK_INVERSION_ALLOWED: YES',
  'CRM_AUDIT_INSERT_FAILURE_ALLOWS_BUSINESS_COMMIT: YES',
  'OUTBOX_ROW_INSERT_FAILURE_ALLOWS_BUSINESS_COMMIT: YES',
  'OUTBOX_DELIVERY_IS_EXACTLY_ONCE_NETWORK_GUARANTEE: YES',
  'P1_RAW_PII_SENT_FOR_CLIENT_MASKING: YES',
  'P1_GENERIC_CENTER_WIDE_CONSULTANT_READ_ALLOWED: YES',
  'P1_RUNTIME_WITH_BROAD_ACTIVE_MEMBER_WRITE_ALLOWED: YES',
  'P1_RUNTIME_WITH_GENERIC_RAW_SELECT_ALLOWED: YES',
  'P1_UI_GUARD_REPLACES_RLS: YES',
  'SERVER_CAN_AUTOMATICALLY_BACKFILL_ALL_BROWSER_LOCALSTORAGE: YES',
  'LOCALSTORAGE_CONTACT_IS_TRUSTED_CANONICAL_IMPORT: YES',
  'LOCALSTORAGE_IMPORT_MAY_BYPASS_REVIEW: YES',
  'F23_3E_P1_CREATES_GUARDIAN_RUNTIME: YES',
  'F23_3E_P1_CREATES_STUDENT_RUNTIME: YES',
  'F23_3E_P1_CREATES_RELATIONSHIP_RUNTIME: YES',
  'F23_3E_P1_EXECUTES_REAL_CONVERSION: YES',
]) assert(!plan.includes(forbiddenClaim), `Forbidden Package 1 claim: ${forbiddenClaim}`)

const mojibakeMarkers = [
  '\u0043\u0102\u00A1\u00C2\u00BA',
  '\u0102\u0192',
  '\u0102\u2020\u00C2\u00B0',
  '\u0048\u0102\u00A1\u00C2\u00BA',
  '\u0102\u00A1\u00C2\u00BB',
  '\u0042\u0075\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00A2\u0069\u0020\u0068\u0102\u00A1\u00C2\u00BB\u00C2\u008D\u0063\u0020\u006D\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00BA\u0069',
]
for (const artifact of [plan, smokeSource]) {
  for (const marker of mojibakeMarkers) assert(!artifact.includes(marker), `Mojibake marker present: ${marker}`)
}

assert(!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(plan), 'Planning doc must not contain a real-looking email fixture')
assert(!/\b(?:\+?84|0)\d{8,10}\b/.test(plan), 'Planning doc must not contain a raw phone fixture')
assert(!/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/.test(plan), 'Planning doc must not contain a date-shaped child identity fixture')
assert(!/(?:eyJ[a-zA-Z0-9_-]{10,}|password\s*[:=]\s*\S+|secret[_-]?key\s*[:=]\s*\S+)/i.test(plan), 'Planning doc must not contain credentials/tokens')

const privateLabels = [
  ['Teacher', 'Workspace'].join(' '),
  ['Module', '14'].join(' '),
  ['Nhà của giáo', 'viên'].join(' '),
  ['teacher', 'workspace'].join('-'),
  ['private', 'teacher'].join('-'),
  ['secret', 'workspace'].join('-'),
  ['dream', 'home'].join(''),
]
for (const artifact of [plan, smokeSource]) {
  for (const label of privateLabels) {
    assert(!artifact.toLowerCase().includes(label.toLowerCase()), `Public Package 1 artifact contains private label: ${label}`)
  }
}

assert(!plan.includes('READY FOR TECHNICAL AUDIT'), 'Completed Package 1 technical-audit handoff must be removed')
assert(
  plan.trimEnd().endsWith('F23.3E-P1 FINAL CLOSEOUT COMPLETE - READY FOR CHECKPOINT'),
  'Package 1 final closeout marker is missing',
)

console.log('F23.3E-P1 canonical CRM foundation implementation-planning docs smoke passed')
