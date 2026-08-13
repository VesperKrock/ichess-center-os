import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const design = read('docs/f23-3e-convert-that-phu-huynh-hoc-vien-idempotency-rollback-chong-trung.md')
const foundation = read('docs/f23-2-phu-huynh-tu-van-hoc-vien-relationship-lifecycle-design.md')
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
const cloudAuditSource = read('src/cloud-audit-log.js')
const schemaSnapshot = read('supabase/migrations/20260722000000_remote_schema.sql')
const roadmap = read('RoadmapRealTime.txt')
const canonicalRoadmapMirror = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')
const smokeSource = read('tests/f23-3e-convert-that-phu-huynh-hoc-vien-idempotency-rollback-chong-trung-smoke.js')

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

const assertMatrix = ({ sectionStart, sectionEnd, prefix, expectedCount, minColumns, outcomeColumn }) => {
  const section = semanticSection(sectionStart, sectionEnd)
  const pattern = new RegExp(`^\\| F3E-${prefix}(\\d+)\\b`)
  const rows = section.split('\n').filter((line) => pattern.test(line))
  const ids = rows.map((line) => Number(line.match(pattern)?.[1]))
  assert.equal(rows.length, expectedCount, `F3E-${prefix} matrix count mismatch`)
  assert.deepEqual(ids, Array.from({ length: expectedCount }, (_, index) => index + 1), `F3E-${prefix} IDs must be exact and sequential`)

  for (const row of rows) {
    const columns = row.split('|').slice(1, -1).map((value) => value.trim())
    assert(columns.length >= minColumns, `F3E-${prefix} row lacks required columns: ${row}`)
    assert((columns[outcomeColumn] || '').length >= 28, `F3E-${prefix} row is not substantive: ${row}`)
  }
}

includesAll(design, [
  'F23_3E_STATUS: DONE DESIGN',
  'F23_3E_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_3E_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_3E_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
  'F23_3E_SQL_CHANGE: NO',
  'F23_3E_MIGRATION_CHANGE: NO',
  'F23_3E_RLS_CHANGE: NO',
  'F23_3E_AUTH_CHANGE: NO',
  'F23_3E_SUPABASE_ACTION: NOT RUN',
  'F23_3E_REAL_DATA_CHANGE: NO',
], 'F23.3E design-only status boundary is incomplete')

for (const classification of ['REPO FACT', 'PARTIAL FOUNDATION', 'DESIGN PROPOSAL', 'DEFERRED']) {
  assert(design.includes(classification), `Missing evidence classification: ${classification}`)
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
  'CONVERSION_APPROVAL_BINDS_EXACT_ACTION_GRAPH_DIGEST: YES',
  'DO_NOT_CREATE_RELATIONSHIP_REQUIRES_EXPLICIT_APPROVAL: YES',
  'F23_2_IMPLEMENTATION_READINESS: BLOCKED',
], 'F23.2 inherited final-audit contract changed')

includesAll(mfaDesign, [
  'F23_13C_FINAL_TECHNICAL_AUDIT: PASS',
  'MFA_POLICY_SERVER_DERIVED: YES',
  'STEP_UP_ASSERTION_SINGLE_USE: YES',
  'STEP_UP_ASSERTION_REUSABLE_ACROSS_PURPOSES: NO',
  'STEP_UP_REPLACES_BUSINESS_AUTHORIZATION: NO',
  'BUSINESS_DOMAIN_ROOT_PRECEDES_ACCOUNT_SECURITY_FOR_COMPOSITE_MUTATION: YES',
  'STEP_UP_ASSERTION_PRECEDES_PROTECTED_TARGET_MUTATION: YES',
  'CONSUME_ASSERTION_THEN_CALL_BUSINESS_API_ALLOWED: NO',
], 'F23.13C inherited step-up contract changed')

includesAll(consultantDesign, [
  'F23_13D_FINAL_TECHNICAL_AUDIT: PASS',
  'CONSULTANT_ROLE_SCOPE: EXACT_CENTER',
  'CONSULTANT_DEFAULT_RESOURCE_SCOPE: ASSIGNED_ONLY',
  'CONSULTANT_CAPABILITY_SERVER_DERIVED: YES',
  'CONSULTANT_MASKING_MUST_BE_SERVER_SIDE: YES',
  'CONSULTANT_GENERIC_ENTITY_READ_PATH_ENABLED: NO',
  'CONSULTANT_GENERIC_ENTITY_WRITE_PATH_ENABLED: NO',
  'F23_13D_RLS_REMEDIATION_REQUIRED_BEFORE_RUNTIME: YES',
  'ACCOUNT_SECURITY_VERSION_CANONICAL_SOURCE_COUNT: EXACTLY_ONE',
], 'F23.13D inherited consultant contract changed')

const repoAudit = semanticSection('## 2. Repo-truth audit', '## 3. Conversion scope')
includesAll(repoAudit, [
  'src/parent-consultation-module.js:2492-2516',
  'src/parent-consultation-module.js:2613-2741',
  'src/parent-consultation-module.js:1377-1389',
  'src/main.js:20653-20712',
  'src/storage.js:48-59,88,1107-1129',
  'src/student-module.js:331-381,415-440',
  'src/student-data.js:3',
  'src/student-tuition-links.js:127-151',
  'src/cloud-db-sync.js:135-179',
  'supabase/migrations/20260722000000_remote_schema.sql:365-400',
  'CURRENT_AUDIT_LOG_IS_TRANSACTIONAL_CONVERSION_OUTBOX: NO',
  'F23_3D_PREVIEW_IS_CONVERSION_AUTHORITY: NO',
  'CRM_LOCALSTORAGE_IS_CANONICAL_CONVERSION_SOURCE: NO',
  'GENERIC_CLOUD_UPSERT_IS_CONVERSION_EXECUTOR: NO',
], 'Repo-truth audit is incomplete')

includesAll(parentSource, [
  "export const parentCustomerStages = ['lead', 'consulting', 'converted']",
  'export function buildParentConvertPreview',
  'export function getParentConvertCandidates',
  'Gợi ý kiểm tra, không phải kết luận trùng hồ sơ',
  'Xác nhận chuyển đổi - chưa mở',
  "level = 'high'",
  "level = level || 'medium'",
  "level = level || 'low'",
], 'F23.3D source facts changed')
includesAll(mainSource, [
  'let parentConvertPreviewState = null',
  'data-parent-convert-preview-action="open"',
  'selectedCandidateKey: button.dataset.candidateKey ||',
  'createInternalCreateAdminIdempotencyKey',
  '`c7-8d-create-admin-${centerId}-${Date.now()}`',
], 'Preview/idempotency source facts changed')
includesAll(storageSource, [
  "const PARENT_CONSULTATIONS_KEY = createCenterScopedStorageKey('parentConsultations')",
  'export function getStoredParentConsultations',
  'export function saveStoredParentConsultations',
  'linkedStudentIds: normalizeParentLinkedStudentIds',
  'careLogs: normalizeParentCareLogs',
  'appointments: normalizeParentAppointments',
  'enrollmentDraft: normalizeParentEnrollmentDraft',
], 'CRM localStorage facts changed')
includesAll(studentData, [
  "export const studentStatuses = ['Đang theo học', 'Bảo lưu', 'Ngưng học']",
], 'Student status vocabulary changed')
includesAll(studentSource, [
  "currentStatus: 'Đang theo học'",
  'id: existingStudent?.id ?? `stu-${Date.now()}`',
  'parentName: student.parentName ??',
  'fatherPhone: formatPhoneNumber',
  'motherPhone: formatPhoneNumber',
  "errors.motherPhone = 'Cần nhập ít nhất một SĐT ba hoặc SĐT mẹ.'",
], 'Student create/embedded-parent facts changed')
assert(studentTuitionSource.includes("String(record?.studentId ?? '').trim() === studentId"), 'Student-to-tuition equality changed')
includesAll(tuitionCloudSource, [
  "export const TUITION_RECORD_PACKAGE_ENTITY_TYPE = 'tuition_record_package'",
  "const studentId = String(tuitionRecord.studentId || '').trim()",
  ".from('center_cloud_entities')",
  '.upsert(records',
], 'Tuition cloud facts changed')
includesAll(cloudSyncSource, [
  'export async function listCloudEntities',
  'export async function upsertCloudEntities',
  ".from('center_cloud_entities')",
  '.map((record) => record.payload)',
], 'Generic cloud path facts changed')
includesAll(cloudAuditSource, [
  "export const AUDIT_LOG_ENTRY_ENTITY_TYPE = 'audit_log_entry'",
  'export async function writeC53AuditLogEntry',
  ".from('center_cloud_entities')",
  '.upsert([recordResult.data]',
], 'Generic audit foundation changed')
includesAll(schemaSnapshot, [
  'CREATE POLICY "center members can insert cloud entities"',
  'CREATE POLICY "center members can select cloud entities"',
  'CREATE POLICY "center members can update cloud entities"',
  'CREATE TABLE public.account_audit_logs',
], 'RLS/audit snapshot changed')
includesAll(previewDesign, [
  'Dedupe chỉ là gợi ý kiểm tra read-only, không auto merge.',
  'Button `Xác nhận chuyển đổi - chưa mở` bị disabled.',
], 'F23.3D preview design changed')

const scope = semanticSection('## 3. Conversion scope', '## 4. Actors')
includesAll(scope, [
  'F23_3E_CONVERSION_TARGETS_GUARDIAN_STUDENT_RELATIONSHIP_ONLY: YES',
  'F23_3E_CONVERSION_AUTO_CREATES_AUTH_ACCOUNT: NO',
  'F23_3E_CONVERSION_AUTO_CREATES_MEMBERSHIP: NO',
  'F23_3E_CONVERSION_AUTO_CREATES_TUITION: NO',
  'F23_3E_CONVERSION_AUTO_CREATES_PAYMENT: NO',
  'F23_3E_CONVERSION_AUTO_CREATES_CASHFLOW: NO',
  'F23_3E_CONVERSION_AUTO_ENROLLS_CLASS: NO',
  'F23_3E_CONVERSION_AUTO_CREATES_SCHEDULE: NO',
  'F23_3E_CONVERSION_AUTO_CREATES_ATTENDANCE: NO',
], 'Conversion target/side-effect boundary is incomplete')

const actors = semanticSection('## 4. Actors', '## 5. Canonical request')
includesAll(actors, [
  'crm.conversion.request_assigned',
  'crm.conversion.approve',
  'crm.conversion.execute',
  'CONVERSION_REQUESTER_MAY_SELF_APPROVE: NO',
  'CLIENT_MAY_CLAIM_CONVERSION_APPROVER: NO',
  'CLIENT_MAY_SET_CONVERSION_COMPLETED: NO',
  'CONVERSION_EXECUTOR_IS_PROTECTED_SERVER_OPERATION: YES',
], 'Actors/separation-of-duty contract is incomplete')

const requestLifecycle = semanticSection('## 5. Canonical request', '## 6. Request creation')
includesAll(requestLifecycle, [
  'conversion_request_id',
  'source_assignment_version',
  'relationship_policy_version',
  'student_profile_policy_version',
  'action_graph_digest',
  'request_version',
  'idempotency_scope',
  'intent_digest',
  'terminal_outcome_digest',
  'DRAFT → READY_FOR_REVIEW',
  'READY_FOR_REVIEW → APPROVED',
  'APPROVED → EXECUTING',
  'EXECUTING → COMPLETED',
  'EXECUTING → CONFLICT',
  'EXECUTING → COMPENSATION_REQUIRED',
  'CONVERSION_REQUEST_STATUS_CLIENT_AUTHORITY: NO',
  'COMPLETED_CONVERSION_CAN_REEXECUTE: NO',
], 'Request lifecycle is incomplete')

const requestCreation = semanticSection('## 6. Request creation', '## 7. Scoped idempotency')
assertOrdered(requestCreation, [
  'CONVERSION_REQUEST_CREATION_LOCK_ORDER_BEGIN',
  '0. CENTER_CRM_CONTROL_ROW',
  '1. CONSULTATION_CASE_ROW',
  '2. CURRENT_ASSIGNMENT_ROW',
  '3. CONVERSION_REQUEST_IDEMPOTENCY_ROW_OR_PREALLOCATED_REQUEST_ROW',
  '4. AUDIT_OUTBOX_ROWS',
  '5. COMMIT_ATOMIC',
  'CONVERSION_REQUEST_CREATION_LOCK_ORDER_END',
], 'Request creation lock order is invalid')
includesAll(requestCreation, [
  'EMPTY_CONVERSION_REQUEST_SET_PROVIDES_SERIALIZATION: NO',
  'ONE_ACTIVE_EXECUTABLE_CONVERSION_REQUEST_PER_CASE: YES',
  'ONE_COMPLETED_CANONICAL_CONVERSION_OUTCOME_PER_CASE: YES',
], 'Request creation serialization is incomplete')

const idempotency = semanticSection('## 7. Scoped idempotency', '## 8. Canonical action graph')
includesAll(idempotency, [
  'environment_fingerprint',
  '+ center_id',
  '+ consultation_case_id',
  '+ operation = crm.conversion.execute',
  '+ idempotency_key',
  'intent_digest',
  'action_graph_digest',
  'SAME_IDEMPOTENCY_KEY_SAME_INTENT_RETURNS_PRIOR_OUTCOME: YES',
  'SAME_IDEMPOTENCY_KEY_DIFFERENT_INTENT_ALLOWED: NO',
  'IDEMPOTENCY_KEY_ALONE_IS_AUTHORITY: NO',
  'IDEMPOTENCY_UNIQUE_CONSTRAINT_REPLACES_CASE_ROOT_LOCK: NO',
  'crm_conversion_idempotency_conflict',
], 'Scoped idempotency contract is incomplete')

const actionGraph = semanticSection('## 8. Canonical action graph', '## 9. Identity matching')
includesAll(actionGraph, [
  'entity_kind',
  'evidence_set_id',
  'action_version',
  'CREATE_NEW_GUARDIAN',
  'REUSE_REVIEWED_GUARDIAN',
  'DO_NOT_CREATE_GUARDIAN',
  'CREATE_NEW_STUDENT',
  'REUSE_REVIEWED_STUDENT',
  'DO_NOT_CREATE_STUDENT',
  'CREATE_RELATIONSHIP',
  'REUSE_EXISTING_RELATIONSHIP',
  'UPDATE_APPROVED_RELATIONSHIP_ROLE',
  'DO_NOT_CREATE_RELATIONSHIP',
  'REQUIRE_RELATIONSHIP_REVIEW',
  'CONVERSION_ACTION_GRAPH_SERVER_VALIDATED: YES',
  'EMPTY_ACTION_GRAPH_IS_EXECUTABLE: NO',
  'MISSING_RELATIONSHIP_DECISION_IS_EXECUTABLE: NO',
  'EXECUTOR_ACCEPTS_DIFFERENT_ACTION_GRAPH_THAN_APPROVAL: NO',
], 'Action graph contract is incomplete')

const matching = semanticSection('## 9. Identity matching', '## 10. Stable identity mutex')
includesAll(matching, [
  'NO_MATCH',
  'POSSIBLE_MATCH',
  'PROBABLE_MATCH',
  'EXACT_REVIEWED_MATCH',
  'INSUFFICIENT_EVIDENCE',
  'NO_MATCH_IS_AUTOMATIC_CREATE_AUTHORITY: NO',
  'POSSIBLE_MATCH_MAY_AUTO_REUSE: NO',
  'PROBABLE_MATCH_MAY_AUTO_REUSE: NO',
  'NAME_ONLY_MATCH_MAY_REUSE_PROFILE: NO',
  'CROSS_CENTER_MATCH_RESULT_MAY_BE_DISCLOSED: NO',
], 'Identity matching contract is incomplete')

const identityMutex = semanticSection('## 10. Stable identity mutex', '## 11. Create-new reservation')
includesAll(identityMutex, [
  'versioned_digest(',
  'environment_fingerprint',
  'canonical_normalized_identity_digest',
  'deduped, sorted bytewise',
  'ALL_RELEVANT_IDENTITY_MUTEX_KEYS_LOCKED_BEFORE_MATCH_RECHECK: YES',
  'MATCH_REVIEW_RESULT_WITHOUT_MUTEX_RECHECK_CAN_EXECUTE: NO',
  'IDENTITY_UNIQUE_INDEX_REPLACES_MUTEX: NO',
  'dual-key/equivalence locking',
], 'Identity mutex/normalization contract is incomplete')

const reservation = semanticSection('## 11. Create-new reservation', '## 12. Student chưa enrolled')
includesAll(reservation, [
  'profile_creation_reservation',
  'preallocated_target_id',
  'identity_mutex_keys_digest',
  'NEW_GUARDIAN_CREATION_LOCKS_EMPTY_GUARDIAN_SET: NO',
  'NEW_STUDENT_CREATION_LOCKS_EMPTY_STUDENT_SET: NO',
  'EMPTY_PROFILE_SET_PROVIDES_DUPLICATE_SERIALIZATION: NO',
  'PROFILE_CREATION_RESERVATION_GRANTS_PROFILE_AUTHORITY: NO',
  'PROFILE_UNIQUE_CONSTRAINT_REPLACES_CREATION_PROTOCOL: NO',
  'PREALLOCATED_TARGET_ID_MAY_BE_REUSED_BY_DIFFERENT_INTENT: NO',
], 'Create-new reservation contract is incomplete')

const studentLegacy = semanticSection('## 12. Student chưa enrolled', '## 13. Approval evidence')
includesAll(studentLegacy, [
  'student_profile_status = ACTIVE | INACTIVE | ARCHIVED',
  'enrollment_status = separate domain',
  'CREATE_NEW_STUDENT = BLOCKED',
  'CONVERSION_CREATED_STUDENT_DEFAULTS_TO_DANG_THEO_HOC: NO',
  'CREATE_NEW_STUDENT_WITHOUT_APPROVED_UNENROLLED_MAPPING_ALLOWED: NO',
  'CRM_CASE_STATUS_IS_STUDENT_ENROLLMENT_STATUS: NO',
  'DO_NOT_CREATE_RELATIONSHIP',
  'guardian/relationship = canonical authority',
  'derived compatibility projection or untouched legacy snapshot',
  'LEGACY_STUDENT_PARENT_FIELDS_ARE_CANONICAL_RELATIONSHIP_AUTHORITY: NO',
  'CONVERSION_MAY_AUTO_OVERWRITE_LEGACY_PARENT_FIELDS_WITHOUT_POLICY: NO',
  'LEGACY_FIELDS_MAY_CREATE_RELATIONSHIP_BY_REVERSE_INFERENCE: NO',
], 'Student/relationship/legacy contract is incomplete')

const approval = semanticSection('## 13. Approval evidence', '## 14. Fresh step-up')
includesAll(approval, [
  'approval_expires_at',
  'approved_action_graph_digest',
  'approved_request_version',
  'approved_match_decision_versions',
  'approved_relationship_policy_version',
  'approved_student_profile_policy_version',
  'approver_security_version',
  'approver_session_version',
  'step_up_assertion_id',
  'PENDING',
  'APPROVED',
  'REVOKED',
  'EXPIRED',
  'CONSUMED',
  'SUPERSEDED',
  'CONVERSION_APPROVAL_SINGLE_USE: YES',
  'PENDING → APPROVED',
  'APPROVED → CONSUMED',
  'APPROVED → REVOKED',
  'APPROVED → EXPIRED',
  'APPROVED → SUPERSEDED',
  'Terminal approval states never return to `APPROVED`.',
  'CONVERSION_APPROVAL_MAY_AUTHORIZE_DIFFERENT_GRAPH: NO',
  'EXPIRED_APPROVAL_MAY_EXECUTE: NO',
  'REVOKED_APPROVAL_MAY_EXECUTE: NO',
  'CONSUMED_APPROVAL_MAY_EXECUTE_AGAIN: NO',
], 'Approval evidence/single-use contract is incomplete')

const approvalAtomicity = semanticSection('## 14. Fresh step-up', '## 15. Protected executor')
assertOrdered(approvalAtomicity, [
  'CONVERSION_APPROVAL_ATOMIC_BEGIN',
  '0. CENTER_CRM_CONTROL_ROW',
  '1. ACCOUNT_SECURITY_CONTROL_ROW, approver',
  '2. STEP_UP_ASSERTION_ROW',
  '3. CONVERSION_REQUEST_AND_APPROVAL_ROWS',
  '4. AUDIT_OUTBOX_ROWS',
  '5. COMMIT_ATOMIC',
  'CONVERSION_APPROVAL_ATOMIC_END',
], 'Approval atomic order is invalid')
includesAll(approvalAtomicity, [
  'F23_3E_APPROVAL_REQUIRES_MFA_POLICY_MET: YES',
  'F23_3E_APPROVAL_REQUIRES_FRESH_RESOURCE_BOUND_STEP_UP: YES',
  'STEP_UP_CONSUMPTION_ATOMIC_WITH_CONVERSION_APPROVAL: YES',
  'CONSUME_STEP_UP_THEN_CALL_APPROVAL_API_ALLOWED: NO',
  'APPROVAL_AUDIT_FAILURE_ROLLS_BACK_ASSERTION_CONSUMPTION: YES',
], 'Approval step-up atomicity is incomplete')

const executor = semanticSection('## 15. Protected executor', '## 16. Single-use approval')
assertOrdered(executor, [
  'CONVERSION_EXECUTOR_ATOMIC_BEGIN',
  '0. CENTER_CRM_CONTROL_ROW',
  '1. IDENTITY_MATCH_MUTEX_ROWS, stable sorted order',
  '2. ACCOUNT_SECURITY_CONTROL_ROWS, approver/executor subjects theo sorted canonical_user_id',
  '3. CONVERSION_REQUEST_AND_APPROVAL_ROWS',
  '4. CONSULTATION_CASE_AND_CONTACT_ROWS',
  '5. GUARDIAN_PROFILE_ROWS',
  '6. STUDENT_PROFILE_ROWS',
  '7. GUARDIAN_STUDENT_RELATIONSHIP_ROWS',
  '8. CONSULTANT_ASSIGNMENT_AND_CARE_LOG_ROWS',
  '9. PROFILE_CREATION_RESERVATION_ROWS',
  '10. AUDIT_OUTBOX_ROWS',
  '11. COMMIT_ATOMIC',
  'CONVERSION_EXECUTOR_ATOMIC_END',
], 'Executor lock order is invalid')
includesAll(executor, [
  'Account-security rows are real locks, not unlocked reads',
  'approval revoke/expiry',
  'Security-only account revoke may lock account-security without business roots',
  'CONVERSION_EXECUTOR_SECURITY_LOCK_ORDER_DEFINED: YES',
  'BUSINESS_ROOTS_PRECEDE_EXECUTOR_ACCOUNT_SECURITY_LOCKS: YES',
  'EXECUTOR_ACCOUNT_SECURITY_LOCKS_PRECEDE_APPROVAL_ROW: YES',
  'APPROVAL_ROW_LOCK_PRECEDES_TARGET_MUTATION: YES',
  'CONVERSION_EXECUTOR_LOCK_ORDER_INVERSION_ALLOWED: NO',
  'EXECUTOR_SECURITY_VERSION_READ_WITHOUT_LOCK_IS_SUFFICIENT: NO',
  'PROTECTED_EXECUTOR_REUSES_RAW_STEP_UP_ASSERTION: NO',
], 'Executor security/revocation serialization is incomplete')

const approvalConsumption = semanticSection('## 16. Single-use approval', '## 17. Atomic conversion graph')
includesAll(approvalConsumption, [
  'mark approval `CONSUMED` and request `EXECUTING` inside transaction',
  'Conversion/audit failure rolls back approval consumption',
  'deterministic no-write conflict terminalizes approval as `SUPERSEDED`',
  'APPROVAL_CONSUMPTION_ATOMIC_WITH_CONVERSION_COMMIT: YES',
  'APPROVAL_CONSUMED_BEFORE_TARGET_COMMIT_OUTSIDE_TRANSACTION: NO',
  'CONVERSION_FAILURE_MAY_LEAVE_APPROVAL_CONSUMED_WITHOUT_OUTCOME: NO',
], 'Approval consumption contract is incomplete')

const atomicGraph = semanticSection('## 17. Atomic conversion graph', '## 18. Failure')
includesAll(atomicGraph, [
  'approved Guardian decisions',
  'approved Student decisions',
  'approved Relationship decisions',
  'approval status CONSUMED',
  'case status CONVERTED',
  'request status COMPLETED',
  'F23_3E_CONVERSION_GRAPH_ALL_OR_NOTHING: YES',
  'PARTIAL_GUARDIAN_STUDENT_GRAPH_COMMIT_ALLOWED: NO',
  'CASE_CONVERTED_WITH_PARTIAL_ACTION_GRAPH_ALLOWED: NO',
  'APPROVAL_CONSUMED_WITHOUT_COMPLETED_OR_ROLLED_BACK_OUTCOME_ALLOWED: NO',
], 'Atomic conversion graph is incomplete')

const failure = semanticSection('## 18. Failure', '## 19. Preview-to-real')
includesAll(failure, [
  'rolls back the entire transaction',
  'Outbox delivery failure after a committed outbox row',
  'COMPENSATION_REQUIRED',
  'ROLLBACK_HARD_DELETES_PREEXISTING_PROFILE: NO',
  'COMPENSATION_MAY_DELETE_UNRELATED_CANONICAL_PROFILE: NO',
  'CROSS_DOMAIN_ATOMICITY_MAY_BE_CLAIMED_WITHOUT_SAGA: NO',
], 'Rollback/compensation contract is incomplete')

const ui = semanticSection('## 19. Preview-to-real', '## 20. Exact typed')
includesAll(ui, [
  'F23.3D remains a non-authoritative shell',
  'MATCH_REVIEW_REQUIRED',
  'masked duplicate candidates',
  'does not receive raw cross-center candidates',
  'server-reviewed match evidence',
  'Confirm never calls local save or generic table upsert',
], 'Preview-to-real UI contract is incomplete')

const operations = semanticSection('## 20. Exact typed', '## 21. Read/write')
for (const operation of [
  'crm.conversion.create_draft',
  'crm.conversion.update_draft',
  'crm.conversion.preview_assigned',
  'crm.conversion.submit_review',
  'crm.conversion.review_matches',
  'crm.conversion.approve',
  'crm.conversion.reject',
  'crm.conversion.cancel',
  'crm.conversion.revoke_approval',
  'crm.conversion.execute',
  'crm.conversion.get_status',
  'crm.conversion.get_result',
]) assert(operations.includes(`\`${operation}\``), `Missing typed server operation: ${operation}`)
includesAll(operations, [
  'Authority + assignment',
  'Current version/policy guards',
  'Input allowlist',
  'Safe response projection',
  'Idempotency',
  'Audit + rate limit',
  'Primary safe errors',
  'generic entityType + arbitrary payload',
], 'Typed server operation columns are incomplete')

const readWrite = semanticSection('## 21. Read/write', '## 22. Audit events')
includesAll(readWrite, [
  'F23_3E_UI_ONLY_SECURITY_ALLOWED: NO',
  'F23_3E_BROWSER_DIRECT_TABLE_CONVERSION_ALLOWED: NO',
  'F23_3E_GENERIC_CLOUD_WRITE_CONVERSION_ALLOWED: NO',
  'F23_3E_RUNTIME_REQUIRES_RLS_AND_READ_PATH_REMEDIATION: YES',
  'No raw PII is shipped for browser masking.',
], 'Read/write/RLS boundary is incomplete')

const auditErrors = semanticSection('## 22. Audit events', '## 23. Race matrix')
includesAll(auditErrors, [
  'crm.conversion_draft_created',
  'crm.conversion_approval_revoked',
  'crm.conversion_execution_started',
  'crm.conversion_completed',
  'crm.profile_creation_reserved',
  'crm.relationship_exception_approved',
  'crm_conversion_idempotency_conflict',
  'crm_conversion_approval_expired',
  'crm_conversion_approval_revoked',
  'crm_conversion_approval_consumed',
  'crm_conversion_security_state_stale',
  'crm_security_service_unavailable',
  'excludes raw phone/email/address',
], 'Audit/error contract is incomplete')

assertMatrix({
  sectionStart: '## 23. Race matrix',
  sectionEnd: '## 24. Negative matrix',
  prefix: 'R',
  expectedCount: 24,
  minColumns: 8,
  outcomeColumn: 6,
})
assertMatrix({
  sectionStart: '## 24. Negative matrix',
  sectionEnd: '## 25. Threat model',
  prefix: 'N',
  expectedCount: 40,
  minColumns: 3,
  outcomeColumn: 2,
})
assertMatrix({
  sectionStart: '## 25. Threat model',
  sectionEnd: '## 26. Approval gates',
  prefix: 'T',
  expectedCount: 28,
  minColumns: 6,
  outcomeColumn: 3,
})
assertMatrix({
  sectionStart: '## 26. Approval gates',
  sectionEnd: '## 27. Future implementation',
  prefix: 'AG',
  expectedCount: 20,
  minColumns: 6,
  outcomeColumn: 1,
})

const raceMatrix = semanticSection('## 23. Race matrix', '## 24. Negative matrix')
includesAll(raceMatrix, [
  'F3E-R4 Two cases create same Guardian',
  'F3E-R12 Approval revoke vs execute',
  'F3E-R14 Security/session revoke vs execute',
  'Security-only revoke never waits business row; executor waits/rechecks account lock',
  'F3E-R17 Normalizer rollout vs pending review',
  'F3E-R20 Audit/outbox failure',
  'F3E-R24 Legacy projection vs canonical relationship',
], 'Race outcomes are incomplete')

const negativeMatrix = semanticSection('## 24. Negative matrix', '## 25. Threat model')
includesAll(negativeMatrix, [
  'F3E-N19 | Approval expired',
  'no consume, execute or target/case mutation',
  'F3E-N24 | Same idempotency key different intent',
  'prior registry/outcome immutable',
  'F3E-N30 | Student mới mặc định `Đang theo học`',
  '`CREATE_NEW_STUDENT` blocked',
  'F3E-N34 | Approval consumed nhưng audit fails',
  'rolls back approval consumption',
  'F3E-N35 | Security revoke đồng thời execute',
  'Shared account-security lock orders events',
  'F3E-N40 | Generic direct table write bypass executor',
], 'Negative matrix key outcomes are incomplete')

const threatMatrix = semanticSection('## 25. Threat model', '## 26. Approval gates')
includesAll(threatMatrix, [
  'F3E-T7 Security-revoke race | Medium | Critical',
  'Lock approver/executor account-security rows before approval/targets',
  'F3E-T18 Partial graph commit | Medium | Critical',
  'F3E-T22 Student enrollment-status conflation | High | High',
  'F3E-T27 Alternate executor endpoint | Medium | Critical',
  'F3E-T28 Outbox/notification delivery ambiguity | Medium | High',
], 'Threat matrix key mitigations are incomplete')

const approvalGates = semanticSection('## 26. Approval gates', '## 27. Future implementation')
includesAll(approvalGates, [
  'F3E-AG1 Student chưa enrolled dùng model nào?',
  'block `CREATE_NEW_STUDENT`',
  'F3E-AG4 Consultant có self-approve không? | NO; requester/consultant cannot self-approve',
  'F3E-AG5 Approval TTL bao lâu? | Short-lived; đề xuất 15 phút',
  'F3E-AG6 Approval single-use hay reusable? | Single-use; never reusable for another execution',
  'F3E-AG12 Multi-guardian conversion atomic toàn graph không? | YES; atomic across the full graph in initial rollout',
  'F3E-AG15 Legacy embedded parent fields? | Canonical Relationship authority + projection adapter',
  'F3E-AG17 Compensation hard-delete profile? | NO',
  'F3E-AG18 Cross-center duplicate lookup? | NO initial rollout; exact-center evidence only',
  'F3E-AG19 Production rollout feature flag? | YES',
  'F3E-AG20 Điều kiện bật runtime?',
  'Security + Architecture + Product',
], 'Approval gate defaults are incomplete')

const implementation = semanticSection('## 27. Future implementation', '## 29. Final technical audit closeout')
includesAll(implementation, [
  'Package 1 — Canonical CRM foundation',
  'Package 2 — Identity and duplicate review',
  'Package 3 — Approval and executor',
  'Package 4 — Compatibility and UI wiring',
  'Package 5 — Production hardening',
  'exactly-one `center_crm_control` root',
  'scoped idempotency registry',
  'profile-creation reservations/preallocated IDs',
  'approved Student profile/enrollment status decision',
  'F23.13D canonical capability resolver',
  'F23.13C MFA/fresh step-up',
  'account security/session invalidation and executor locking integration',
  'broad RLS/generic write remediation',
  'immutable audit/transactional outbox',
  'concurrency/deadlock/race tests',
  'F23_3E_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_3E_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: NO',
], 'Implementation decomposition/blockers are incomplete')

includesAll(design, [
  'F23.3E IMPLEMENTATION PLANNING: SAFE TO START',
  'External final technical audit đã `PASS`',
  'It does not mean runtime or production is ready',
  'roadmap is now synchronized as `F23.3E DONE design`',
  'never runtime/implementation done',
], 'Design readiness boundary is incomplete')

const currentRoadmapLines = [
  'F23.2 DONE design / Nối dây Phụ huynh ↔ Tư vấn ↔ Học viên: entity, relationship và lifecycle canonical',
  'F23.3 PARTIAL public/backend',
  'F23.3A DONE design / Thiết kế Module Phụ huynh-Tư vấn CRM nhẹ',
  'F23.3B DONE public / CRM shell local-safe',
  'F23.3C DONE qua F23.3B / Form khách mới local-safe',
  'F23.3D DONE public / Convert preview',
  'F23.3E PARTIAL public/backend/QA',
  'F23.3E-P1 DONE backend/local verified',
  'F23.3E-P2 DONE backend/local verified',
  'F23.3E-P3 DONE backend/local verified',
  'F23.3E-P3D DONE backend/local verified',
  'F23.3E-P4 PARTIAL public/backend/QA',
  'F23.3E-P4A DONE backend/local verified',
]
includesAll(roadmap, currentRoadmapLines, 'RoadmapRealTime current F23.3E state is incomplete')
assert(!roadmap.includes('F23.3E TODO design'), 'F23.3E must not regress to the design-era TODO state')
assert(!roadmap.includes('CURRENT CHECKPOINT —'), 'Completed F23.3E milestones must not retain checkpoint prefixes')
assert(!roadmap.includes('Historical checkpoint compatibility note'), 'Current roadmap must not keep a compatibility museum')
assert(canonicalRoadmapMirror.includes('F23.3E DONE design'), 'Historical design-closeout evidence drifted')

for (const forbiddenClaim of [
  'F23_3E_FINAL_TECHNICAL_AUDIT: NOT RUN',
  'F23_3E_IMPLEMENTATION_READINESS: READY',
  'F23_3E_RUNTIME_IMPLEMENTATION: DONE',
  'F23_3E_REAL_CONVERSION_IMPLEMENTED: YES',
  'CONVERSION_REQUESTER_MAY_SELF_APPROVE: YES',
  'CONVERSION_APPROVAL_SINGLE_USE: NO',
  'CONSUME_STEP_UP_THEN_CALL_APPROVAL_API_ALLOWED: YES',
  'EXECUTOR_SECURITY_VERSION_READ_WITHOUT_LOCK_IS_SUFFICIENT: YES',
  'APPROVAL_CONSUMED_WITHOUT_COMPLETED_OR_ROLLED_BACK_OUTCOME_ALLOWED: YES',
  'NO_MATCH_IS_AUTOMATIC_CREATE_AUTHORITY: YES',
  'POSSIBLE_MATCH_MAY_AUTO_REUSE: YES',
  'EMPTY_PROFILE_SET_PROVIDES_DUPLICATE_SERIALIZATION: YES',
  'PROFILE_UNIQUE_CONSTRAINT_REPLACES_CREATION_PROTOCOL: YES',
  'CONVERSION_CREATED_STUDENT_DEFAULTS_TO_DANG_THEO_HOC: YES',
  'LEGACY_STUDENT_PARENT_FIELDS_ARE_CANONICAL_RELATIONSHIP_AUTHORITY: YES',
  'F23_3E_BROWSER_DIRECT_TABLE_CONVERSION_ALLOWED: YES',
  'F23_3E_CONVERSION_AUTO_CREATES_AUTH_ACCOUNT: YES',
  'F23_3E_CONVERSION_AUTO_CREATES_MEMBERSHIP: YES',
  'F23_3E_CONVERSION_AUTO_CREATES_TUITION: YES',
  'F23_3E_CONVERSION_AUTO_CREATES_PAYMENT: YES',
  'F23_3E_CONVERSION_AUTO_CREATES_CASHFLOW: YES',
  'F23_3E_CONVERSION_AUTO_ENROLLS_CLASS: YES',
]) assert(!design.includes(forbiddenClaim), `Forbidden F23.3E claim: ${forbiddenClaim}`)

const mojibakeMarkers = [
  '\u0043\u0102\u00A1\u00C2\u00BA',
  '\u0102\u0192',
  '\u0102\u2020\u00C2\u00B0',
  '\u0048\u0102\u00A1\u00C2\u00BA',
  '\u0102\u00A1\u00C2\u00BB',
  '\u0042\u0075\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00A2\u0069\u0020\u0068\u0102\u00A1\u00C2\u00BB\u00C2\u008D\u0063\u0020\u006D\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00BA\u0069',
]
for (const marker of mojibakeMarkers) assert(!design.includes(marker), `Mojibake marker present: ${marker}`)

assert(!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(design), 'Design must not contain a real-looking email fixture')
assert(!/\b(?:\+?84|0)\d{8,10}\b/.test(design), 'Design must not contain a raw phone fixture')
assert(!/(?:eyJ[a-zA-Z0-9_-]{10,}|service_role\s*[:=]\s*\S+|password\s*[:=]\s*\S+)/i.test(design), 'Design must not contain credentials/tokens')
const privateWorkspaceLabels = [
  ['Teacher', 'Workspace'].join(' '),
  ['Module', '14'].join(' '),
  ['Nhà của giáo', 'viên'].join(' '),
  ['teacher', 'workspace'].join('-'),
  ['private', 'teacher'].join('-'),
  ['secret', 'workspace'].join('-'),
]
for (const publicArtifact of [design, smokeSource]) {
  for (const label of privateWorkspaceLabels) {
    assert(!publicArtifact.toLowerCase().includes(label.toLowerCase()), `Public F23.3E artifact must not contain private route/workspace label: ${label}`)
  }
}

assert(!design.includes('READY FOR TECHNICAL AUDIT'), 'Completed technical-audit handoff must be removed after closeout')
assert(
  design.trimEnd().endsWith('F23.3E FINAL CLOSEOUT COMPLETE - READY FOR CHECKPOINT'),
  'Final closeout marker is missing',
)

console.log('F23.3E real conversion idempotency rollback and duplicate-safety docs smoke passed')
