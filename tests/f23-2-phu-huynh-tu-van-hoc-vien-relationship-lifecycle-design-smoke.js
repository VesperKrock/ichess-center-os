import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const design = read('docs/f23-2-phu-huynh-tu-van-hoc-vien-relationship-lifecycle-design.md')
const crmSource = read('src/parent-consultation-module.js')
const storageSource = read('src/storage.js')
const studentSource = read('src/student-module.js')
const studentData = read('src/student-data.js')
const studentTuitionSource = read('src/student-tuition-links.js')
const tuitionCloudSource = read('src/cloud-tuition-record-package-bridge.js')
const mfaDesign = read('docs/f23-13c-mfa-enrollment-enforcement-recovery-va-step-up.md')
const consultantDesign = read('docs/f23-13d-consultant-provisioning-capability-matrix-va-server-enforcement.md')
const roadmap = read('RoadmapRealTime.txt')
const canonicalRoadmapMirror = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')

const includesAll = (content, markers, message) => {
  for (const marker of markers) assert(content.includes(marker), `${message}: ${marker}`)
}

const semanticSection = (startMarker, endMarker) => {
  const start = design.indexOf(startMarker)
  const end = design.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0 && end > start, `Missing semantic section: ${startMarker} -> ${endMarker}`)
  return design.slice(start, end)
}

const assertOrdered = (content, markers, message) => {
  let cursor = -1
  for (const marker of markers) {
    const next = content.indexOf(marker, cursor + 1)
    assert(next > cursor, `${message}: ${marker}`)
    cursor = next
  }
}

includesAll(design, [
  'F23_2_STATUS: DONE DESIGN',
  'F23_2_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_2_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_2_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_2_SQL_CHANGE: NO',
  'F23_2_MIGRATION_CHANGE: NO',
  'F23_2_RLS_CHANGE: NO',
  'F23_2_AUTH_CHANGE: NO',
  'F23_2_SUPABASE_ACTION: NOT RUN',
  'F23_2_REAL_DATA_CHANGE: NO',
  'F23_2_CANONICAL_BACKEND_IMPLEMENTED: NO',
  'F23_2_REAL_CONVERSION_IMPLEMENTED: NO',
], 'Missing F23.2 design-only status boundary')

for (const classification of ['REPO FACT', 'PARTIAL FOUNDATION', 'DESIGN PROPOSAL', 'DEFERRED']) {
  assert(design.includes(classification), `Missing evidence classification: ${classification}`)
}

const audit = semanticSection('## 2. Repo truth audit', '## 3. Canonical entity boundary')
includesAll(audit, [
  'src/parent-consultation-module.js:15-21',
  '`lead`, `consulting`, `converted`',
  'wizard bốn bước',
  'Detail và care logs',
  'F23.3D convert preview',
  '`contact-${Date.now()}`',
  'ichessCenterOS.parentConsultations.<currentStorageCenterId>',
  'Module Học viên và student ID',
  'Parent-like data',
  'Học viên ↔ Học phí',
  'không có relationship row',
  'Generic cloud/localStorage',
  'Consultant role hiện tại',
  'F23.13D contract',
  'Direct bypass paths',
  'không phải reviewed identity decision',
  'không exact-center server-authorized',
  'không khóa identity race',
], 'Repo-truth audit is not substantive')

includesAll(crmSource, [
  "export const parentCustomerStages = ['lead', 'consulting', 'converted']",
  'export function buildParentConvertPreview',
  'Không auto merge theo số điện thoại hoặc tên.',
  'Xác nhận chuyển đổi - chưa mở',
  'function getParentContactGroupKey',
  'return `phone:${phone}`',
], 'Audited CRM repo facts changed')
includesAll(storageSource, [
  "const PARENT_CONSULTATIONS_KEY = createCenterScopedStorageKey('parentConsultations')",
  'export function getStoredParentConsultations',
  'export function saveStoredParentConsultations',
  'linkedStudentIds: normalizeParentLinkedStudentIds',
], 'Audited CRM storage facts changed')
includesAll(studentData, [
  "export const studentStatuses = ['Đang theo học', 'Bảo lưu', 'Ngưng học']",
  "id: 'stu-001'",
], 'Audited student vocabulary/ID facts changed')
assert(studentSource.includes('id: existingStudent?.id ?? `stu-${Date.now()}`'), 'Student create ID strategy changed.')
assert(
  studentTuitionSource.includes('String(record?.studentId ?? \'\').trim() === studentId'),
  'Student-to-tuition linkage no longer matches the audited studentId equality.',
)
includesAll(tuitionCloudSource, [
  "export const TUITION_RECORD_PACKAGE_ENTITY_TYPE = 'tuition_record_package'",
  'const studentId = String(tuitionRecord.studentId || \'\').trim()',
  'return id ? `${TUITION_RECORD_PACKAGE_ENTITY_TYPE}::${slugifyIdPart(id)}`',
], 'Audited tuition cloud identity facts changed')

const entities = semanticSection('## 3. Canonical entity boundary', '## 4. Cardinality và ownership')
includesAll(design, [
  'CONTACT_OR_LEAD_IS_PARENT_PROFILE: NO',
  'CONTACT_OR_LEAD_IS_STUDENT_PROFILE: NO',
  'CONSULTATION_CASE_IS_A_PERSON: NO',
  'CONSULTANT_ASSIGNMENT_IS_PERSON_OWNERSHIP: NO',
  'PARENT_PROFILE_IS_AUTH_ACCOUNT: NO',
  'STUDENT_PROFILE_IS_AUTH_ACCOUNT: NO',
], 'Canonical distinction markers are incomplete')
includesAll(entities, [
  'crm_contact',
  'consultation_case',
  'consultation_case_candidate_student',
  'guardian_profile',
  'student_profile',
  'guardian_student_relationship',
  'Relationship là entity riêng',
  'ONE_GUARDIAN_CAN_LINK_MULTIPLE_STUDENTS: YES',
  'ONE_STUDENT_CAN_LINK_MULTIPLE_GUARDIANS: YES',
  'ONE_STUDENT_MUST_HAVE_EXACTLY_ONE_PRIMARY_CONTACT: APPROVAL_REQUIRED',
  'ONE_GUARDIAN_CAN_HAVE_MULTIPLE_CONSULTATION_CASES: YES',
  'ONE_CONSULTATION_CASE_CAN_DESCRIBE_MULTIPLE_CANDIDATE_STUDENTS: YES',
], 'Canonical entity/cardinality distinction is incomplete')

const cardinality = semanticSection('## 4. Cardinality và ownership', '## 5. Source → target mapping')
includesAll(cardinality, [
  '| Guardian | M:N | Student |',
  'Chỉ qua explicit relationship row.',
  'CONSULTANT_ASSIGNMENT_TARGET_IS_CASE_OR_RESOURCE: YES',
  'CONSULTANT_ASSIGNMENT_TARGET_IS_GUARDIAN_IDENTITY: NO',
  'CONSULTANT_ASSIGNMENT_TARGET_IS_STUDENT_IDENTITY: NO',
  'CONSULTANT_UNASSIGN_DELETES_PERSON_DATA: NO',
  'prior consultant mất authority ngay',
], 'Relationship or consultant ownership boundary is incomplete')

const mapping = semanticSection('## 5. Source → target mapping', '## 6. Lifecycle models và mappings')
includesAll(mapping, [
  '`parentName` | `crm_contact.display_name`',
  '`phone`, `secondaryPhone`, `email`',
  '`leadStudentName`, `leadStudentAge`, `studentBirthYear`',
  '`consultantId`, `consultantName`, `advisorName`',
  '`careLogs[]` | Case care logs',
  '`enrollmentDraft` | Case enrollment draft',
  '`studentId`, `linkedStudentIds`',
  '`student.id` | `student_id`',
  '`student.currentStatus` | `student_status`',
  '`tuition_record_package.studentId`',
  'CREATE_NEW_GUARDIAN',
  'REUSE_REVIEWED_GUARDIAN',
  'CREATE_NEW_STUDENT',
  'REUSE_REVIEWED_STUDENT',
  'CREATE_RELATIONSHIP',
  'REUSE_EXISTING_RELATIONSHIP',
  'UPDATE_APPROVED_RELATIONSHIP_ROLE',
  'REQUIRE_RELATIONSHIP_REVIEW',
  'DO_NOT_CREATE_RELATIONSHIP',
  'Empty/missing relationship actions are invalid input, not a business outcome.',
  'Không có `AUTO_MERGE_EVERYTHING`.',
], 'Source-target mapping or explicit conversion decisions are incomplete')

const lifecycle = semanticSection('## 6. Lifecycle models và mappings', '## 7. Identity evidence')
includesAll(lifecycle, [
  'Contact: NEW | CONTACTED | QUALIFIED | UNQUALIFIED | ARCHIVED',
  'Case: OPEN | CONSULTING | PAUSED | READY_FOR_CONVERSION | CONVERTED | LOST | CANCELLED | ARCHIVED',
  'Guardian: ACTIVE | INACTIVE | MERGE_REVIEW | ARCHIVED',
  'Student: Đang theo học | Bảo lưu | Ngưng học',
  'CRM_STAGE_DIRECTLY_MUTATES_STUDENT_STATUS: NO',
  'CRM_STAGE_DIRECTLY_MUTATES_GUARDIAN_STATUS: NO',
  'CONVERTED_CASE_CAN_RETURN_TO_OPEN_WITHOUT_REVERSAL_FLOW: NO',
  '`customerStage=lead`',
  '`customerStage=consulting`',
  '`customerStage=converted`',
  'Contact `NEW → CONTACTED`',
  'Contact `CONTACTED → QUALIFIED`',
  'Qualified contact → case `OPEN`',
  'Case `OPEN → CONSULTING`',
  'Case `OPEN/CONSULTING → READY_FOR_CONVERSION`',
  'Case `READY_FOR_CONVERSION → CONVERTED`',
  'Case `OPEN/CONSULTING → LOST`',
  'Case `OPEN/CONSULTING → CANCELLED`',
  'Case `PAUSED → CONSULTING`',
  'Case `PAUSED → CANCELLED`',
  'source_version',
  'target_version = source_version + 1',
  'idempotency',
  'terminal',
  'reversal requires protected',
], 'Lifecycle mapping/transitions are not substantive')

const identity = semanticSection('## 7. Identity evidence', '## 8. Stable roots')
includesAll(identity, [
  'PHONE_MATCH_AUTO_MERGES_GUARDIAN: NO',
  'EMAIL_MATCH_AUTO_MERGES_GUARDIAN: NO',
  'NAME_MATCH_AUTO_MERGES_PERSON: NO',
  'CONTACT_MATCH_AUTO_LINKS_AUTH_ACCOUNT: NO',
  'CROSS_CENTER_PERSON_AUTO_MERGE_ALLOWED: NO',
  'NO_MATCH',
  'POSSIBLE_MATCH',
  'PROBABLE_MATCH',
  'EXACT_REVIEWED_MATCH',
  'CONFLICT',
  'target ID + version',
  'normalization/policy versions',
  'reviewer/authority',
  'F23_2_RELATIONSHIP_SCOPE: EXACT_CENTER',
  'F23_2_CROSS_CENTER_PROFILE_REUSE_ALLOWED: NO',
  'F23_2_CROSS_CENTER_DUPLICATE_LOOKUP_ALLOWED: NO',
  'Không query, disclose candidate count, reuse hoặc merge profile center khác.',
], 'Identity evidence/review or exact-center boundary is incomplete')

const rootsAndLocks = semanticSection('## 8. Stable roots', '## 9. F23.3E handoff contract')
includesAll(rootsAndLocks, [
  'center_crm_control',
  'crm_schema_version',
  'identity_policy_version',
  'conversion_policy_version',
  'CENTER_CRM_CONTROL_ROW_REQUIRED_COUNT: EXACTLY_ONE',
  'CENTER_CRM_MUTATION_ROOT: CENTER_CRM_CONTROL_ROW',
  'EMPTY_CONTACT_SET_PROVIDES_SERIALIZATION: NO',
  'EMPTY_GUARDIAN_SET_PROVIDES_SERIALIZATION: NO',
  'EMPTY_STUDENT_SET_PROVIDES_SERIALIZATION: NO',
  'identity_match_mutex_key =',
  'versioned_digest(',
  'environment_fingerprint',
  'canonical_normalized_identity_digest',
  'RAW_PHONE_OR_EMAIL_USED_AS_MUTEX_VALUE: NO',
  'IDENTITY_MATCH_UNIQUENESS_REPLACES_MUTEX: NO',
  'SAME_MATCH_EVIDENCE_SHARES_ONE_MUTEX: YES',
  'dual-key equivalence/barrier',
  'F23_2_CONVERSION_LOCK_ORDER_DEFINED: YES',
  'CENTER_CRM_ROOT_PRECEDES_IDENTITY_MATCH_MUTEX: YES',
  'IDENTITY_MATCH_MUTEX_PRECEDES_PROFILE_ROWS: YES',
  'F23_2_LOCK_ORDER_INVERSION_ALLOWED: NO',
], 'Stable root/mutex contract is incomplete')
assertOrdered(rootsAndLocks, [
  '0. CENTER_CRM_CONTROL_ROW',
  '1. IDENTITY_MATCH_MUTEX_ROWS',
  '2. CONSULTATION_CASE_AND_CONTACT_ROWS',
  '3. GUARDIAN_PROFILE_ROWS',
  '4. STUDENT_PROFILE_ROWS',
  '5. GUARDIAN_STUDENT_RELATIONSHIP_ROWS',
  '6. CONSULTANT_ASSIGNMENT_AND_CARE_LOG_ROWS',
  '7. CONVERSION_REQUEST_ROWS',
  '8. AUDIT_OUTBOX_ROWS',
], 'Canonical conversion lock order changed')

const handoff = semanticSection('## 9. F23.3E handoff contract', '## 10. Atomicity')
includesAll(handoff, [
  'crm_conversion_request',
  'conversion_request_id',
  'consultation_case_id',
  'source_case_version',
  'source_contact_version',
  'source_assignment_version',
  'requested_guardian_actions',
  'requested_student_actions',
  'requested_relationship_actions',
  'match_decisions',
  'action_graph_digest',
  'crm_conversion_approval',
  'approval_id',
  'approval_status',
  'approved_by_user_id',
  'approved_at',
  'approval_expires_at',
  'approval_version',
  'approved_action',
  'approved_purpose',
  'approved_action_graph_digest',
  'approved_source_case_version',
  'approved_source_contact_version',
  'approved_assignment_version',
  'approved_identity_policy_version',
  'approved_conversion_policy_version',
  'approved_match_decision_versions',
  'approver_security_version',
  'approver_session_version',
  'step_up_assertion_id',
  'opaque reference',
  'idempotency_key',
  'DRAFT',
  'READY_FOR_REVIEW',
  'APPROVED',
  'EXECUTING',
  'COMPLETED',
  'CONFLICT',
  'COMPENSATION_REQUIRED',
  'CANCELLED',
  'F23_2_CONVERSION_EXECUTES_REAL_MUTATION: NO',
  'F23_3E_MUST_USE_IDEMPOTENCY_KEY: YES',
  'F23_3E_MUST_RECHECK_SOURCE_VERSIONS: YES',
  'F23_3E_MUST_NOT_AUTO_MERGE_POSSIBLE_MATCH: YES',
  '`crm.conversion.preview_assigned` and request review',
  '`crm.conversion.approve` with MFA + fresh step-up',
  'Consultant/client never self-claims approval',
  'same key + different intent returns `crm_conversion_conflict`',
], 'F23.3E request/capability/idempotency handoff is incomplete')

const actionGraph = semanticSection('### 9.2 Conversion action graph', '### 9.3 Conversion approval')
includesAll(actionGraph, [
  'action_id',
  'source_candidate_id',
  'decision',
  'target_id',
  'target_version',
  'reason_code',
  'review_evidence_id',
  'policy_version',
  'CREATE_RELATIONSHIP',
  'REUSE_EXISTING_RELATIONSHIP',
  'UPDATE_APPROVED_RELATIONSHIP_ROLE',
  'REQUIRE_RELATIONSHIP_REVIEW',
  'DO_NOT_CREATE_RELATIONSHIP',
  'Khi guardian và student đều create/reuse, không được silently omit relationship.',
  '`DO_NOT_CREATE_GUARDIAN`',
  '`DO_NOT_CREATE_STUDENT`',
  'Duplicate decisions cho cùng normalized pair là conflict',
  'Empty list hoặc omitted payload không có authority',
  'exact guardian/student action IDs và decisions',
  'approved exception/reason code',
  'relationship policy version',
  'review evidence cùng reviewer/approver identity',
  'primary-contact/safeguarding invariant',
  'current source versions và endpoint target versions',
  'MISSING_RELATIONSHIP_ACTION_IS_APPROVED_NO_RELATIONSHIP: NO',
  'DO_NOT_CREATE_RELATIONSHIP_REQUIRES_EXPLICIT_APPROVAL: YES',
  'EMPTY_RELATIONSHIP_ACTION_LIST_IS_BUSINESS_DECISION: NO',
  'EXISTING_GUARDIAN_AND_STUDENT_MAY_SILENTLY_OMIT_RELATIONSHIP: NO',
  'CONVERSION_ACTION_GRAPH_MUST_BE_INTERNALLY_CONSISTENT: YES',
  'CONVERSION_APPROVAL_BINDS_EXACT_ACTION_GRAPH_DIGEST: YES',
  'EXECUTOR_ACCEPTS_ACTION_GRAPH_DIFFERENT_FROM_APPROVAL: NO',
], 'Conversion action-graph/explicit relationship outcome contract is incomplete')

const approvalPolicy = semanticSection('### 9.3 Conversion approval', '### 9.4 Independent approval')
includesAll(approvalPolicy, [
  'F23_2_CONVERSION_APPROVAL_REQUIRES_MFA_POLICY_MET: YES',
  'F23_2_CONVERSION_APPROVAL_REQUIRES_FRESH_STEP_UP: YES',
  'F23_2_CONVERSION_APPROVAL_CLIENT_CLAIM_IS_AUTHORITY: NO',
  'F23_2_STEP_UP_CONSUMPTION_MUST_BE_ATOMIC_WITH_APPROVAL: YES',
  'CONVERSION_APPROVAL_BINDS_SOURCE_AND_POLICY_VERSIONS: YES',
  'CONVERSION_APPROVAL_BINDS_APPROVER_SECURITY_SESSION_VERSIONS: YES',
  'EXPIRED_OR_STALE_CONVERSION_APPROVAL_CAN_EXECUTE: NO',
  'action = crm.conversion.approve',
  'exact action-graph digest',
  'step-up assertion ID/version',
  'security_version',
  'session_version',
  '`approved=true`',
], 'Conversion approval evidence/MFA/step-up policy is incomplete')

const independentApproval = semanticSection('### 9.4 Independent approval', '### 9.5 Protected executor')
includesAll(independentApproval, [
  'CONVERSION_APPROVAL_ATOMIC_BEGIN',
  'CONVERSION_APPROVAL_ATOMIC_END',
  'CENTER_CRM_ROOT_PRECEDES_APPROVER_ACCOUNT_SECURITY_LOCK: YES',
  'APPROVER_ACCOUNT_SECURITY_LOCK_PRECEDES_STEP_UP_ASSERTION_LOCK: YES',
  'STEP_UP_ASSERTION_CONSUMED_BEFORE_APPROVAL_COMMIT_ONLY_WITHIN_ATOMIC_TRANSACTION: YES',
  'CONSUME_STEP_UP_THEN_CALL_CONVERSION_APPROVAL_API_ALLOWED: NO',
  'rechecks canonical account, membership, role/capability, MFA policy, security/session versions',
  'assertion consumption rollback',
], 'Independent conversion approval atomicity is incomplete')
assertOrdered(independentApproval, [
  '0. CENTER_CRM_CONTROL_ROW',
  '1. ACCOUNT_SECURITY_CONTROL_ROW, approver',
  '2. STEP_UP_ASSERTION_ROW',
  '3. CONVERSION_REQUEST_AND_APPROVAL_ROWS',
  '4. AUDIT_OUTBOX_ROWS',
  '5. COMMIT_ATOMIC',
], 'Independent approval lock order changed')

const protectedExecutor = semanticSection('### 9.5 Protected executor', '### 9.6 Combined approve-and-execute')
includesAll(protectedExecutor, [
  'approve with MFA met + fresh resource-bound step-up',
  'không consume lại assertion đã dùng cho approval',
  'current/non-expired/non-revoked approval evidence',
  'exact approved action-graph digest',
  'source case/contact/assignment versions',
  'match-decision versions',
  'target versions',
  'identity/conversion/relationship policy versions',
  'approver security/session versions',
  'consistent current-version/invalidation check',
  'PROTECTED_CONVERSION_EXECUTOR_REUSES_RAW_STEP_UP_ASSERTION: NO',
  'PROTECTED_CONVERSION_EXECUTOR_RECHECKS_CURRENT_APPROVAL_EVIDENCE: YES',
  'PROTECTED_CONVERSION_EXECUTOR_MAY_EXPAND_APPROVED_ACTIONS: NO',
  'approval expired/revoked/stale',
], 'Protected conversion executor recheck contract is incomplete')

const combinedApprovalExecution = semanticSection('### 9.6 Combined approve-and-execute', '### 9.7 Server preflight')
includesAll(combinedApprovalExecution, [
  'CONVERSION_APPROVE_EXECUTE_ATOMIC_BEGIN',
  'CONVERSION_APPROVE_EXECUTE_ATOMIC_END',
  'F23_2_STEP_UP_COMPOSITE_LOCK_ORDER_DEFINED: YES',
  'BUSINESS_ROOTS_PRECEDE_CONVERSION_ACCOUNT_SECURITY_LOCK: YES',
  'CONVERSION_ACCOUNT_SECURITY_LOCK_PRECEDES_ASSERTION_LOCK: YES',
  'CONVERSION_ASSERTION_LOCK_PRECEDES_REMAINING_TARGET_ROWS: YES',
  'F23_2_STEP_UP_LOCK_ORDER_INVERSION_ALLOWED: NO',
  'CONSUME_ASSERTION_THEN_CALL_CONVERSION_EXECUTOR_ALLOWED: NO',
  'approved reservation/finalize protocol',
  'không tuyên bố atomic giả',
], 'Combined approve/execute step-up composition is incomplete')
assertOrdered(combinedApprovalExecution, [
  '0. CENTER_CRM_CONTROL_ROW',
  '1. IDENTITY_MATCH_MUTEX_ROWS, stable sorted order',
  '2. ACCOUNT_SECURITY_CONTROL_ROW, approver',
  '3. STEP_UP_ASSERTION_ROW',
  '4. CONSULTATION_CASE_AND_CONTACT_ROWS',
  '5. GUARDIAN_PROFILE_ROWS',
  '6. STUDENT_PROFILE_ROWS',
  '7. GUARDIAN_STUDENT_RELATIONSHIP_ROWS',
  '8. CONSULTANT_ASSIGNMENT_AND_CARE_LOG_ROWS',
  '9. CONVERSION_REQUEST_AND_APPROVAL_ROWS',
  '10. AUDIT_OUTBOX_ROWS',
  '11. COMMIT_ATOMIC',
], 'Combined approve/execute lock order changed')

includesAll(mfaDesign, [
  'MFA_POLICY_SERVER_DERIVED: YES',
  'STEP_UP_ASSERTION_SINGLE_USE: YES',
  'STEP_UP_ASSERTION_REUSABLE_ACROSS_PURPOSES: NO',
  'STEP_UP_REPLACES_BUSINESS_AUTHORIZATION: NO',
  'BUSINESS_DOMAIN_ROOT_PRECEDES_ACCOUNT_SECURITY_FOR_COMPOSITE_MUTATION: YES',
  'STEP_UP_ASSERTION_PRECEDES_PROTECTED_TARGET_MUTATION: YES',
  'CONSUME_ASSERTION_THEN_CALL_BUSINESS_API_ALLOWED: NO',
], 'Inherited F23.13C step-up composition contract changed')

const atomicity = semanticSection('## 10. Atomicity', '## 11. Forbidden automatic effects')
includesAll(atomicity, [
  'guardian create/reuse decision',
  'student create/reuse decision',
  'guardian-student relationship decision',
  'case CONVERTED state',
  'conversion request terminal state',
  'audit/outbox',
  'F23_3E_PARTIAL_PARENT_WITHOUT_STUDENT_OUTCOME_ALLOWED: NO',
  'F23_3E_CASE_CONVERTED_WITHOUT_TARGET_OUTCOME_ALLOWED: NO',
  'F23_3E_AUDIT_FAILURE_CAN_COMMIT_CONVERSION: NO',
  'Approval thiếu MFA/fresh exact assertion',
  'rollback assertion + approval/business/audit',
  'Independent approval stale/expired/revoked',
  'Approved action graph khác execution payload',
  'toàn transaction rollback',
  'protected reservation/saga/compensation',
  'không tuyên bố rollback atomic giả',
  'Security/capability service unavailable',
], 'Atomicity/failure outcomes are incomplete')

const forbiddenEffects = semanticSection('## 11. Forbidden automatic effects', '## 12. Consultant security')
includesAll(forbiddenEffects, [
  'CREATE_AUTH_ACCOUNT',
  'CREATE_CENTER_MEMBERSHIP',
  'CREATE_TUITION_PACKAGE',
  'CREATE_PAYMENT',
  'CREATE_CASHFLOW_TRANSACTION',
  'CREATE_CLASS_ASSIGNMENT',
  'CREATE_SCHEDULE_SESSION',
  'CREATE_ATTENDANCE_RECORD',
  'CREATE_GRADE_RECORD',
  'CRM_CONVERSION_AUTO_CREATES_AUTH_ACCOUNT: NO',
  'CRM_CONVERSION_AUTO_CREATES_TUITION: NO',
  'CRM_CONVERSION_AUTO_ENROLLS_CLASS: NO',
  'CRM_CONVERSION_AUTO_CREATES_ATTENDANCE: NO',
  'Student có thể tồn tại mà chưa enrolled',
], 'Forbidden conversion auto-effects are incomplete')

const consultantSecurity = semanticSection('## 12. Consultant security', '## 13. Audit and safe errors')
includesAll(consultantSecurity, [
  'F23_2_CLIENT_ROLE_IS_AUTHORITY: NO',
  'F23_2_CLIENT_ASSIGNMENT_IS_AUTHORITY: NO',
  'F23_2_MASKING_MUST_BE_SERVER_SIDE: YES',
  'F23_2_GENERIC_RAW_CRM_READ_ALLOWED: NO',
  'F23_2_GENERIC_CRM_WRITE_ALLOWED: NO',
  'exact-center and current assigned-resource check',
  'server-derived capability with deny precedence',
  'full contact reveal only for exact resource/purpose with MFA and fresh step-up',
  'no generic `center_cloud_entities`/table read',
  'no generic arbitrary payload write',
  'care_log',
  'consultation_case_id',
  'cannot mutate guardian/student',
  'stale writer fails',
], 'Consultant security/masking/care-log boundary is incomplete')
includesAll(consultantDesign, [
  'CONSULTANT_ROLE_SCOPE: EXACT_CENTER',
  'CONSULTANT_DEFAULT_RESOURCE_SCOPE: ASSIGNED_ONLY',
  'CONSULTANT_CAPABILITY_SERVER_DERIVED: YES',
  'CONSULTANT_MASKING_MUST_BE_SERVER_SIDE: YES',
  'CONSULTANT_FULL_CONTACT_REVEAL_REQUIRES_STEP_UP: YES',
  'CONSULTANT_GENERIC_ENTITY_READ_PATH_ENABLED: NO',
  'CONSULTANT_GENERIC_ENTITY_WRITE_PATH_ENABLED: NO',
], 'Inherited F23.13D security contract changed')

const auditErrors = semanticSection('## 13. Audit and safe errors', '## 14. Negative matrix')
includesAll(auditErrors, [
  'crm.contact_created',
  'crm.case_opened',
  'crm.case_reassigned',
  'crm.conversion_requested',
  'crm.conversion_approved',
  'crm.conversion_approval_denied',
  'crm.match_reviewed',
  'crm.conversion_completed',
  'crm.relationship_created',
  'crm.access_denied',
  'crm_center_scope_denied',
  'crm_assignment_required',
  'crm_step_up_required',
  'crm_conversion_approval_stale',
  'crm_conversion_approval_mismatch',
  'crm_conversion_already_completed',
  'crm_conversion_source_stale',
  'crm_security_service_unavailable',
  'excludes raw phone/email/address',
  'do not reveal another center',
], 'Audit/error privacy contract is incomplete')

const assertMatrix = ({
  sectionStart,
  sectionEnd,
  prefix,
  expectedCount,
  minColumns,
  outcomeColumn,
  minOutcomeLength = 24,
}) => {
  const content = semanticSection(sectionStart, sectionEnd)
  const rowPattern = new RegExp(`^\\| (${prefix}\\d+)(?: [^|]*)? \\|`)
  const ids = content
    .split('\n')
    .map((line) => line.match(rowPattern)?.[1])
    .filter(Boolean)
  assert.equal(ids.length, expectedCount, `${prefix} matrix must contain exactly ${expectedCount} rows.`)
  assert.deepEqual(ids, Array.from({ length: expectedCount }, (_, index) => `${prefix}${index + 1}`), `${prefix} IDs must be contiguous and ordered.`)

  for (const line of content.split('\n').filter((item) => rowPattern.test(item))) {
    const columns = line.split('|').slice(1, -1).map((item) => item.trim())
    assert(columns.length >= minColumns, `${prefix} row lacks required columns: ${line}`)
    assert(columns.every((column) => column.length >= 2), `${prefix} row has an empty/substantiveless column: ${line}`)
    if (Number.isInteger(outcomeColumn)) {
      assert(columns[outcomeColumn].length >= minOutcomeLength, `${prefix} outcome is not substantive: ${line}`)
    }
  }
}

assertMatrix({
  sectionStart: '## 14. Negative matrix',
  sectionEnd: '## 15. Threat model',
  prefix: 'F2-N',
  expectedCount: 36,
  minColumns: 3,
  outcomeColumn: 2,
})
assertMatrix({
  sectionStart: '## 15. Threat model',
  sectionEnd: '## 16. Approval gates',
  prefix: 'F2-T',
  expectedCount: 26,
  minColumns: 6,
  outcomeColumn: 3,
})
assertMatrix({
  sectionStart: '## 16. Approval gates',
  sectionEnd: '## 17. Implementation blockers',
  prefix: 'F2-AG',
  expectedCount: 19,
  minColumns: 6,
  outcomeColumn: 2,
  minOutcomeLength: 15,
})

const negativeMatrix = semanticSection('## 14. Negative matrix', '## 15. Threat model')
includesAll(negativeMatrix, [
  'F2-N33 | Conversion approval không có fresh exact-purpose/resource step-up',
  'Deny `crm_step_up_required`',
  'assertion khác purpose/resource không consumed',
  'F2-N34 | Assertion consumed rồi approval/executor hoặc audit fail',
  'same-store rollback assertion + approval/business/audit',
  'executor-only sau committed independent approval không consume/reuse assertion',
  'distributed store dùng reservation/finalize',
  'F2-N35 | `DO_NOT_CREATE_GUARDIAN` nhưng relationship action bị bỏ trống',
  'require explicit approved `DO_NOT_CREATE_RELATIONSHIP`',
  'F2-N36 | Guardian và student đều create/reuse nhưng request thiếu relationship decision',
  'Deny `crm_relationship_conflict`',
  'no orphan pair from omitted payload',
], 'F2-N33–F2-N36 outcomes are incomplete')

const threatMatrix = semanticSection('## 15. Threat model', '## 16. Approval gates')
includesAll(threatMatrix, [
  'F2-T25 Step-up/approval atomicity bypass | Medium | Critical',
  'Business roots → account security → assertion → approval/targets',
  'Alternate endpoint or distributed integration defect',
  'Approval/security integration + concurrency QA',
  'F2-T26 Implicit relationship omission | Medium | High',
  'explicit `DO_NOT_CREATE_RELATIONSHIP`',
  'Migration adapter omits legacy pair decision',
  'F23.3E request/relationship QA',
], 'F2-T25–F2-T26 threat fields are incomplete')

const approvalGates = semanticSection('## 16. Approval gates', '## 17. Implementation blockers')
includesAll(approvalGates, [
  'F2-AG19 Step-up consume tại approval hay execution?',
  'Independent approval consumes fresh resource-bound step-up atomically',
  'executor rechecks current evidence/graph',
  'combined flow only in one transaction',
  'Separation of duty',
  'distributed composition defects',
  'Security + Architecture + Product',
  'Conversion approval/executor design',
], 'F2-AG19 recommendation/rationale/risk/approver/phase is incomplete')

const blockers = semanticSection('## 17. Implementation blockers', '## 18. F23.3E design readiness')
includesAll(blockers, [
  'canonical center-scoped CRM backend',
  'exactly-one `center_crm_control` root',
  'stable identity registry/mutex',
  'guardian canonical service',
  'explicit M:N guardian–student relationship service',
  'F23.13D capability resolver',
  'broad active-member write RLS remediation',
  'complete generic SELECT/realtime/export/cache/read-path remediation',
  'direct API/RLS',
  'F23.13C MFA-met/fresh step-up approval integration',
  'exact action-graph digest',
  'explicit no-relationship decision',
  'F23_2_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_2_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_2_REAL_CONVERSION_IMPLEMENTED: NO',
], 'Implementation blockers are incomplete')

includesAll(design, [
  'F23.3E DESIGN: SAFE TO START',
  'This does **not** mean F23.3E runtime or production is ready.',
  '`FINAL_TECHNICAL_AUDIT: PASS`',
  'implementation `BLOCKED`; runtime remains `NOT STARTED`',
  'External final technical audit đã approve design closeout',
], 'F23.3E design-only readiness/closeout boundary is missing')

const canonicalRoadmapLines = [
  'F23.2 DONE design / Nối dây Phụ huynh ↔ Tư vấn ↔ Học viên: entity, relationship và lifecycle canonical',
  'F23.3 PARTIAL public / Module Phụ huynh-Tư vấn CRM nhẹ',
  'F23.3E TODO design / Convert thật có idempotency, rollback và chống trùng Phụ huynh-Học viên',
]
includesAll(roadmap, canonicalRoadmapLines, 'RoadmapRealTime F23.2/F23.3 canonical closeout is incomplete')
includesAll(canonicalRoadmapMirror, canonicalRoadmapLines, 'Canonical roadmap mirror F23.2/F23.3 closeout is incomplete')
for (const roadmapContent of [roadmap, canonicalRoadmapMirror]) {
  assert(!roadmapContent.includes('F23.2 TODO design'), 'F23.2 must not remain TODO after final audit PASS.')
  assert(!roadmapContent.includes('F23.3E DONE'), 'F23.3E must remain TODO design.')
  assert(!roadmapContent.includes('F23.3E READY'), 'F23.3E must not be marked runtime-ready.')
}

for (const forbiddenClaim of [
  'F23_2_FINAL_TECHNICAL_AUDIT: NOT RUN',
  'F23_2_IMPLEMENTATION_READINESS: READY',
  'F23_2_RUNTIME_IMPLEMENTATION: DONE',
  'F23_2_REAL_CONVERSION_IMPLEMENTED: YES',
  'CONTACT_OR_LEAD_IS_PARENT_PROFILE: YES',
  'CONTACT_OR_LEAD_IS_STUDENT_PROFILE: YES',
  'PHONE_MATCH_AUTO_MERGES_GUARDIAN: YES',
  'EMAIL_MATCH_AUTO_MERGES_GUARDIAN: YES',
  'CROSS_CENTER_PERSON_AUTO_MERGE_ALLOWED: YES',
  'CRM_CONVERSION_AUTO_CREATES_AUTH_ACCOUNT: YES',
  'CRM_CONVERSION_AUTO_CREATES_TUITION: YES',
  'CRM_CONVERSION_AUTO_ENROLLS_CLASS: YES',
  'CONSUME_ASSERTION_THEN_CALL_CONVERSION_EXECUTOR_ALLOWED: YES',
  'MISSING_RELATIONSHIP_ACTION_IS_APPROVED_NO_RELATIONSHIP: YES',
  'EMPTY_RELATIONSHIP_ACTION_LIST_IS_BUSINESS_DECISION: YES',
  'EXISTING_GUARDIAN_AND_STUDENT_MAY_SILENTLY_OMIT_RELATIONSHIP: YES',
  'EXECUTOR_ACCEPTS_ACTION_GRAPH_DIFFERENT_FROM_APPROVAL: YES',
]) assert(!design.includes(forbiddenClaim), `Forbidden implementation/identity claim: ${forbiddenClaim}`)

const mojibakeMarkers = [
  '\u0043\u0102\u00A1\u00C2\u00BA',
  '\u0102\u0192',
  '\u0102\u2020\u00C2\u00B0',
  '\u0048\u0102\u00A1\u00C2\u00BA',
  '\u0102\u00A1\u00C2\u00BB',
  '\u0042\u0075\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00A2\u0069\u0020\u0068\u0102\u00A1\u00C2\u00BB\u00C2\u008D\u0063\u0020\u006D\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00BA\u0069',
]
for (const marker of mojibakeMarkers) assert(!design.includes(marker), `Mojibake marker present: ${marker}`)

assert(!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(design), 'Design must not contain a real-looking email fixture.')
assert(!/\b(?:\+?84|0)\d{8,10}\b/.test(design), 'Design must not contain a raw phone fixture.')
assert(!/(?:eyJ[a-zA-Z0-9_-]{10,}|service_role\s*[:=]\s*\S+|password\s*[:=]\s*\S+)/i.test(design), 'Design must not contain credentials/tokens.')

assert(!design.includes('READY FOR TECHNICAL AUDIT'), 'Completed audit handoff must be removed after final closeout.')
assert(
  design.trimEnd().endsWith('F23.2 FINAL CLOSEOUT COMPLETE - READY FOR CHECKPOINT'),
  'Final closeout marker is missing.',
)

console.log('F23.2 final technical audit closeout semantic smoke passed')
