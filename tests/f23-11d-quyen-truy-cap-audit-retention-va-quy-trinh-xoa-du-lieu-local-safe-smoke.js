import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  STAFF_ADMINISTRATIVE_ACTIONS,
  STAFF_ADMINISTRATIVE_AUDIT_ACTIONS,
  STAFF_ADMINISTRATIVE_POLICY_STALE_MESSAGE,
  STAFF_ADMINISTRATIVE_REQUEST_STALE_MESSAGE,
  STAFF_ADMINISTRATIVE_SEPARATION_MESSAGE,
  appendStaffAdministrativeAuditEvent,
  buildStaffAdministrativeAuditEvent,
  buildStaffAdministrativeDeletionRequest,
  buildStaffAdministrativeRetentionPolicy,
  cancelStaffAdministrativeDeletionRequest,
  createStaffAdministrativeDeletionRequestDraft,
  createStaffAdministrativeRetentionPolicyDraft,
  deriveStaffAdministrativeRetentionStatus,
  getStaffAdministrativeAuditCollectionIssues,
  getStaffAdministrativeAuditEventIssues,
  getStaffAdministrativeDeletionRequestCollectionIssues,
  getStaffAdministrativeDeletionRequestIssues,
  getStaffAdministrativeRetentionPolicyIssues,
  hasStaffAdministrativeAction,
  initialStaffAdministrativeAuditFilters,
  normalizeStaffAdministrativeAuditEvent,
  normalizeStaffAdministrativeDeletionRequest,
  normalizeStaffAdministrativeRetentionPolicy,
  renderStaffAdministrativeAuditResults,
  renderStaffAdministrativeGovernanceSection,
  resolveStaffAdministrativeActionAccess,
  reviewStaffAdministrativeDeletionRequest,
  setStaffAdministrativeDeletionRequestDraftValue,
  setStaffAdministrativeRetentionPolicyDraftValue,
  validateStaffAdministrativeDeletionRequest,
  validateStaffAdministrativeRetentionPolicy,
} from '../src/staff-administrative-governance-module.js'
import { renderStaffAdministrativeProfileWindow } from '../src/staff-administrative-profile-module.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const governanceSource = read('src/staff-administrative-governance-module.js')
const profileSource = read('src/staff-administrative-profile-module.js')
const storageSource = read('src/storage.js')
const main = read('src/main.js')
const styles = read('src/styles.css')
const docs = read('docs/f23-11d-quyen-truy-cap-audit-retention-va-quy-trinh-xoa-du-lieu-local-safe.md')

const actionAccess = (
  role,
  action,
  {
    status = 'active',
    centerId = 'center-a',
    membershipCenterId = centerId,
    userId = 'actor-1',
    membershipUserId = userId,
    membershipId = 'membership-1',
    bindingStatus = 'bound',
  } = {},
) => resolveStaffAdministrativeActionAccess({
  user: userId ? { id: userId } : null,
  binding: {
    status: bindingStatus,
    currentCenterId: centerId,
    membership: {
      id: membershipId,
      center_id: membershipCenterId,
      user_id: membershipUserId,
      role,
      status,
    },
  },
  storageCenterId: 'center-a',
  action,
})

const ownerAccess = actionAccess('owner', 'administrative-profile.view')
const adminAccess = actionAccess('center_admin', 'administrative-profile.view')
assert.equal(STAFF_ADMINISTRATIVE_ACTIONS.length, 27)
assert(STAFF_ADMINISTRATIVE_ACTIONS.includes('staff-document.attachment-replace'))
assert(STAFF_ADMINISTRATIVE_AUDIT_ACTIONS.includes('administrative-profile.reveal-sensitive'))
assert(STAFF_ADMINISTRATIVE_AUDIT_ACTIONS.includes('staff-document.attachment-replacement-completed'))
assert(STAFF_ADMINISTRATIVE_AUDIT_ACTIONS.includes('staff-document.attachment-version-download'))
assert(STAFF_ADMINISTRATIVE_AUDIT_ACTIONS.includes('deletion-request.approve'))
assert.equal(STAFF_ADMINISTRATIVE_REQUEST_STALE_MESSAGE, 'Yêu cầu đã thay đổi. Vui lòng mở lại để tiếp tục.')
assert.equal(STAFF_ADMINISTRATIVE_POLICY_STALE_MESSAGE, 'Chính sách đã thay đổi. Vui lòng mở lại để tiếp tục.')
assert.equal(STAFF_ADMINISTRATIVE_SEPARATION_MESSAGE, 'Cần một Owner khác phê duyệt')
assert.equal(ownerAccess.ok, true)
assert.equal(ownerAccess.actorMembershipId, 'membership-1')
for (const action of STAFF_ADMINISTRATIVE_ACTIONS) {
  assert.equal(hasStaffAdministrativeAction(ownerAccess, action), true, `Owner missing ${action}`)
}
for (const action of [
  'administrative-profile.view',
  'administrative-profile.reveal-sensitive',
  'administrative-profile.edit',
  'staff-document.view',
  'staff-document.create',
  'staff-document.edit',
  'staff-document.archive',
  'staff-document.restore',
  'staff-document.attachment-remove',
  'staff-document.attachment-deletion-request',
  'staff-document.attachment-deletion-cancel',
  'privacy-audit.view',
  'deletion-request.create',
  'deletion-request.cancel',
]) {
  assert.equal(hasStaffAdministrativeAction(adminAccess, action), true, `Admin missing ${action}`)
}
for (const action of [
  'retention-policy.view',
  'retention-policy.manage',
  'deletion-request.review',
  'deletion-request.approve',
  'deletion-request.deny',
  'staff-document.attachment-deletion-review',
  'staff-document.attachment-deletion-execute',
  'staff-document.attachment-legal-hold',
  'staff-document.attachment-retention-configure',
]) {
  assert.equal(hasStaffAdministrativeAction(adminAccess, action), false, `Admin must deny ${action}`)
}
assert.equal(actionAccess('admin', 'deletion-request.create').ok, true)
assert.equal(actionAccess('teacher', 'administrative-profile.view').ok, false)
assert.equal(actionAccess('consultant', 'administrative-profile.view').ok, false)
assert.equal(actionAccess('owner', 'administrative-profile.view', { status: 'inactive' }).ok, false)
assert.equal(actionAccess('owner', 'administrative-profile.view', { membershipCenterId: 'center-b' }).ok, false)
assert.equal(actionAccess('owner', 'administrative-profile.view', { membershipUserId: 'other' }).ok, false)
assert.equal(actionAccess('owner', 'administrative-profile.view', { userId: '' }).ok, false)
assert.equal(actionAccess('owner', 'unknown.action').reason, 'action-unknown')
assert.equal(actionAccess('owner', 'administrative-profile.view', { membershipId: '' }).actorMembershipId, 'membership-ref:center-a:actor-1')

const validAudit = buildStaffAdministrativeAuditEvent({
  id: 'audit-1',
  centerId: 'center-a',
  actorUserId: 'actor-1',
  actorMembershipId: 'membership-1',
  actorRole: 'owner',
  action: 'administrative-profile.reveal-sensitive',
  targetType: 'administrative-profile',
  targetId: 'profile-1',
  staffMemberId: 'staff-1',
  administrativeProfileId: 'profile-1',
  outcome: 'success',
  reasonCode: 'field-reveal',
  noteSummary: 'identityDocument.number',
  createdAt: '2026-07-27T01:00:00.000Z',
})
assert.deepEqual(getStaffAdministrativeAuditEventIssues(validAudit, 'center-a'), [])
assert.equal(validAudit.noteSummary, 'identityDocument.number')
assert.equal(Object.hasOwn(validAudit, 'payload'), false)
assert.equal(buildStaffAdministrativeAuditEvent({ ...validAudit, noteSummary: 'raw value 001234' }).noteSummary, '')
assert(getStaffAdministrativeAuditEventIssues({ ...validAudit, identityDocumentNumber: '001234' }, 'center-a').includes('event:contains-forbidden-field'))
assert(getStaffAdministrativeAuditEventIssues({ ...validAudit, profileSnapshot: {} }, 'center-a').includes('event:contains-forbidden-field'))
assert(getStaffAdministrativeAuditEventIssues({ ...validAudit, outcome: 'unknown' }, 'center-a').includes('outcome:invalid'))
assert(getStaffAdministrativeAuditEventIssues({ ...validAudit, centerId: 'center-b' }, 'center-a').includes('centerId:mismatch'))
assert(getStaffAdministrativeAuditEventIssues({ ...validAudit, targetId: '' }, 'center-a').includes('targetId:missing'))
assert(getStaffAdministrativeAuditEventIssues({ ...validAudit, documentId: '', targetType: 'staff-document' }, 'center-a').includes('documentId:missing'))
const normalizedAudit = normalizeStaffAdministrativeAuditEvent(
  { ...validAudit, futureAuditField: { keep: true } },
  { currentCenterId: 'center-a' },
)
assert.deepEqual(normalizedAudit.futureAuditField, { keep: true })
assert(getStaffAdministrativeAuditEventIssues(normalizedAudit, 'center-a').includes('event:contains-unknown-field'))
const appendedAudit = appendStaffAdministrativeAuditEvent([], validAudit, 'center-a')
assert.equal(appendedAudit.length, 1)
assert.equal(appendStaffAdministrativeAuditEvent(appendedAudit, validAudit, 'center-a'), null)
assert(getStaffAdministrativeAuditCollectionIssues([validAudit, { ...validAudit }], 'center-a').some((issue) => issue.includes('duplicate')))
const auditHtml = renderStaffAdministrativeAuditResults(
  [validAudit],
  initialStaffAdministrativeAuditFilters,
)
assert(auditHtml.includes('Reveal trường nhạy cảm'))
assert(!auditHtml.includes('identityDocument.number'))
assert(!auditHtml.includes('actor-1'))
assert(!auditHtml.includes('profile-1'))
const manyAuditEvents = Array.from({ length: 125 }, (_, index) => ({
  ...validAudit,
  id: `audit-${index + 10}`,
  createdAt: new Date(Date.UTC(2026, 6, 27, 2, 0, index)).toISOString(),
}))
const cappedAuditHtml = renderStaffAdministrativeAuditResults(manyAuditEvents, initialStaffAdministrativeAuditFilters, 500)
assert.equal((cappedAuditHtml.match(/<article>/g) || []).length, 100)
assert(renderStaffAdministrativeAuditResults([], initialStaffAdministrativeAuditFilters).includes('Chưa có nhật ký hành động.'))
assert(renderStaffAdministrativeAuditResults([validAudit], { action: 'deletion-request.deny', outcome: 'all' }).includes('Không có sự kiện phù hợp'))

let policyDraft = createStaffAdministrativeRetentionPolicyDraft()
assert.deepEqual(policyDraft, {
  profileRetentionDaysAfterEmploymentEnd: 1825,
  documentRetentionDaysAfterEmploymentEnd: 1825,
  deletionReviewGraceDays: 30,
  enabled: true,
})
policyDraft = setStaffAdministrativeRetentionPolicyDraftValue(
  policyDraft,
  'profileRetentionDaysAfterEmploymentEnd',
  '365',
)
assert.equal(policyDraft.profileRetentionDaysAfterEmploymentEnd, '365')
assert.deepEqual(validateStaffAdministrativeRetentionPolicy(policyDraft), {})
assert(validateStaffAdministrativeRetentionPolicy({ ...policyDraft, deletionReviewGraceDays: '-1' }).deletionReviewGraceDays)
assert(validateStaffAdministrativeRetentionPolicy({ ...policyDraft, documentRetentionDaysAfterEmploymentEnd: 'NaN' }).documentRetentionDaysAfterEmploymentEnd)
const policy = buildStaffAdministrativeRetentionPolicy(policyDraft, null, {
  centerId: 'center-a',
  policyId: 'policy-1',
  now: '2026-07-27T02:00:00.000Z',
})
assert.equal(policy.revision, 1)
assert.deepEqual(getStaffAdministrativeRetentionPolicyIssues(policy, 'center-a'), [])
const normalizedPolicy = normalizeStaffAdministrativeRetentionPolicy(
  { ...policy, futurePolicyField: { keep: true } },
  { currentCenterId: 'center-a' },
)
assert.deepEqual(normalizedPolicy.futurePolicyField, { keep: true })
const editedPolicy = buildStaffAdministrativeRetentionPolicy(
  { ...policyDraft, deletionReviewGraceDays: '45' },
  normalizedPolicy,
  { centerId: 'center-a', now: '2026-07-27T03:00:00.000Z' },
)
assert.equal(editedPolicy.revision, 2)
assert.equal(editedPolicy.createdAt, policy.createdAt)
assert.deepEqual(editedPolicy.futurePolicyField, { keep: true })
assert(getStaffAdministrativeRetentionPolicyIssues({ ...policy, centerId: 'center-b' }, 'center-a').includes('centerId:mismatch'))
assert(getStaffAdministrativeRetentionPolicyIssues(
  normalizeStaffAdministrativeRetentionPolicy({ ...policy, enabled: 'false' }, { currentCenterId: 'center-a' }),
  'center-a',
).includes('enabled:malformed-value'))
assert(getStaffAdministrativeRetentionPolicyIssues({ ...policy, dataUrl: 'data:text/plain;base64,QQ==' }, 'center-a').includes('policy:unsafe-payload'))

const activeStaff = {
  id: 'staff-1',
  centerId: 'center-a',
  employmentStatus: 'active',
  endDate: '',
  archivedAt: '',
}
const terminatedStaff = { ...activeStaff, employmentStatus: 'terminated', endDate: '2026-07-01' }
assert.equal(deriveStaffAdministrativeRetentionStatus({ staffMember: activeStaff, policy }).status, 'not-applicable')
assert.equal(deriveStaffAdministrativeRetentionStatus({ staffMember: { ...terminatedStaff, endDate: '' }, policy }).status, 'not-applicable')
assert.equal(deriveStaffAdministrativeRetentionStatus({ staffMember: terminatedStaff, policy: null }).status, 'policy-missing')
const retainedPolicy = { ...policy, profileRetentionDaysAfterEmploymentEnd: 365, documentRetentionDaysAfterEmploymentEnd: 365 }
assert.equal(deriveStaffAdministrativeRetentionStatus({ staffMember: terminatedStaff, policy: retainedPolicy, today: '2026-07-27' }).status, 'retained')
const soonPolicy = { ...policy, profileRetentionDaysAfterEmploymentEnd: 40, documentRetentionDaysAfterEmploymentEnd: 40 }
assert.equal(deriveStaffAdministrativeRetentionStatus({ staffMember: terminatedStaff, policy: soonPolicy, today: '2026-07-20' }).status, 'review-due-soon')
const duePolicy = { ...policy, profileRetentionDaysAfterEmploymentEnd: 5, documentRetentionDaysAfterEmploymentEnd: 5 }
assert.equal(deriveStaffAdministrativeRetentionStatus({ staffMember: terminatedStaff, policy: duePolicy, today: '2026-07-27' }).status, 'review-due')

let requestDraft = createStaffAdministrativeDeletionRequestDraft()
requestDraft = setStaffAdministrativeDeletionRequestDraftValue(requestDraft, 'scope', 'administrative-profile')
requestDraft = setStaffAdministrativeDeletionRequestDraftValue(requestDraft, 'reasonCode', 'data-subject-request')
requestDraft = setStaffAdministrativeDeletionRequestDraftValue(requestDraft, 'reasonNote', 'Yêu cầu riêng tư hợp lệ.')
requestDraft = setStaffAdministrativeDeletionRequestDraftValue(requestDraft, 'confirmed', true)
assert.deepEqual(validateStaffAdministrativeDeletionRequest(requestDraft), {})
assert(validateStaffAdministrativeDeletionRequest({ ...requestDraft, scope: 'staff-operational-record' }).scope)
assert(validateStaffAdministrativeDeletionRequest({ ...requestDraft, reasonCode: 'other-system' }).reasonCode)
assert(validateStaffAdministrativeDeletionRequest({ ...requestDraft, reasonNote: 'ngắn' }).reasonNote)
assert(validateStaffAdministrativeDeletionRequest({ ...requestDraft, confirmed: false }).confirmed)
assert(validateStaffAdministrativeDeletionRequest(requestDraft, { forbiddenValues: ['riêng tư hợp lệ'] }).reasonNote)
const request = buildStaffAdministrativeDeletionRequest(requestDraft, {
  id: 'request-1',
  centerId: 'center-a',
  staffMemberId: 'staff-1',
  administrativeProfileId: 'profile-1',
  actor: adminAccess,
  now: '2026-07-27T04:00:00.000Z',
})
assert.equal(request.status, 'pending-review')
assert.equal(request.executionState, 'not-approved')
assert.equal(request.revision, 1)
assert.deepEqual(getStaffAdministrativeDeletionRequestIssues(request, 'center-a'), [])
const normalizedRequest = normalizeStaffAdministrativeDeletionRequest(
  { ...request, futureRequestField: { keep: true } },
  { currentCenterId: 'center-a' },
)
assert.deepEqual(normalizedRequest.futureRequestField, { keep: true })
assert(getStaffAdministrativeDeletionRequestCollectionIssues([request, { ...request }], 'center-a').some((issue) => issue.includes('duplicate')))
assert(getStaffAdministrativeDeletionRequestIssues({ ...request, dataUrl: 'data:text/plain;base64,QQ==' }, 'center-a').includes('request:unsafe-payload'))
assert(getStaffAdministrativeDeletionRequestIssues({ ...request, status: 'executed', executionState: 'executed' }, 'center-a').includes('status:future-only'))

const adminCancelled = cancelStaffAdministrativeDeletionRequest(
  request,
  adminAccess,
  '2026-07-27T05:00:00.000Z',
)
assert.equal(adminCancelled.status, 'cancelled')
assert.equal(adminCancelled.revision, 2)
const otherAdminAccess = actionAccess('center_admin', 'deletion-request.cancel', {
  userId: 'actor-2',
  membershipUserId: 'actor-2',
  membershipId: 'membership-2',
})
assert.equal(cancelStaffAdministrativeDeletionRequest(request, otherAdminAccess), null)
assert.equal(cancelStaffAdministrativeDeletionRequest(request, ownerAccess)?.status, 'cancelled')
assert.equal(cancelStaffAdministrativeDeletionRequest({ ...request, status: 'execution-pending' }, ownerAccess), null)

const otherOwnerAccess = actionAccess('owner', 'deletion-request.approve', {
  userId: 'owner-2',
  membershipUserId: 'owner-2',
  membershipId: 'membership-owner-2',
})
const approvedResult = reviewStaffAdministrativeDeletionRequest(
  request,
  otherOwnerAccess,
  'approve',
  {
    deletionReviewGraceDays: 30,
    now: '2026-07-27T06:00:00.000Z',
  },
)
assert.equal(approvedResult.ok, true)
assert.equal(approvedResult.request.status, 'execution-pending')
assert.equal(approvedResult.request.executionState, 'waiting-backend')
assert.equal(approvedResult.request.executionEligibleAt, '2026-08-26T06:00:00.000Z')
assert.equal(approvedResult.request.revision, 2)
assert.equal(Object.hasOwn(approvedResult.request, 'deletedAt'), false)
assert.equal(reviewStaffAdministrativeDeletionRequest(request, adminAccess, 'approve').ok, false)
const creatorOwnerRequest = { ...request, requestedByUserId: 'actor-1', requestedByMembershipId: 'membership-1', requestedByRole: 'owner' }
assert.equal(reviewStaffAdministrativeDeletionRequest(creatorOwnerRequest, ownerAccess, 'approve').error, STAFF_ADMINISTRATIVE_SEPARATION_MESSAGE)
const deniedResult = reviewStaffAdministrativeDeletionRequest(
  request,
  otherOwnerAccess,
  'deny',
  { reviewNote: '<script>alert(1)</script>', now: '2026-07-27T07:00:00.000Z' },
)
assert.equal(deniedResult.request.status, 'denied')
assert.equal(deniedResult.request.executionState, 'not-approved')
assert.equal(deriveStaffAdministrativeRetentionStatus({ staffMember: terminatedStaff, policy, deletionRequests: [request] }).status, 'deletion-request-active')
assert.equal(deriveStaffAdministrativeRetentionStatus({ staffMember: terminatedStaff, policy, deletionRequests: [approvedResult.request] }).status, 'backend-execution-pending')

const profile = {
  id: 'profile-1',
  schemaVersion: 1,
  centerId: 'center-a',
  staffMemberId: 'staff-1',
  legalFullName: 'Nguyễn An',
  permanentAddress: {},
  currentAddress: {},
  emergencyContact: {},
  identityDocument: {},
  taxInformation: {},
  insuranceInformation: {},
  bankInformation: {},
  employmentAdministration: {},
  note: '',
  completionStatus: 'incomplete',
  completionReview: {},
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
  archivedAt: '',
  revision: 1,
}
const escapedRequest = { ...request, reasonNote: '<script>alert(1)</script>' }
const ownerGovernanceHtml = renderStaffAdministrativeGovernanceSection({
  windowId: 'window-1',
  access: otherOwnerAccess,
  staffMember: activeStaff,
  profile,
  auditEvents: [validAudit],
  policy,
  deletionRequests: [escapedRequest],
  state: { mode: 'view', auditFilters: initialStaffAdministrativeAuditFilters, auditLimit: 25 },
  storageHealthy: true,
})
assert(ownerGovernanceHtml.includes('Quyền &amp; lưu trữ'))
assert(ownerGovernanceHtml.includes('Thiết lập chính sách lưu trữ'))
assert(ownerGovernanceHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
assert(!ownerGovernanceHtml.includes('<script>alert(1)</script>'))
assert(!ownerGovernanceHtml.includes('actor-1'))
assert(!ownerGovernanceHtml.includes('membership-1'))
assert(!ownerGovernanceHtml.includes('profile-1'))
assert(!ownerGovernanceHtml.includes('Xóa ngay'))
assert(!ownerGovernanceHtml.includes('Thực thi'))
const adminGovernanceHtml = renderStaffAdministrativeGovernanceSection({
  windowId: 'window-2',
  access: adminAccess,
  staffMember: activeStaff,
  profile,
  auditEvents: [],
  policy,
  deletionRequests: [request],
  state: { mode: 'view', auditFilters: initialStaffAdministrativeAuditFilters, auditLimit: 25 },
  storageHealthy: true,
})
assert(adminGovernanceHtml.includes('Tạo yêu cầu xóa'))
assert(adminGovernanceHtml.includes('Chỉ Owner được xem cấu hình chi tiết'))
assert(!adminGovernanceHtml.includes('Hồ sơ: 365 ngày'))
assert(!adminGovernanceHtml.includes('data-staff-governance-action="approve-request"'))
assert(!adminGovernanceHtml.includes('data-staff-governance-action="open-deny-form"'))
const selfOwnerGovernanceHtml = renderStaffAdministrativeGovernanceSection({
  windowId: 'window-3',
  access: ownerAccess,
  staffMember: activeStaff,
  profile,
  auditEvents: [],
  policy,
  deletionRequests: [creatorOwnerRequest],
  state: { mode: 'view', auditFilters: initialStaffAdministrativeAuditFilters, auditLimit: 25 },
  storageHealthy: true,
})
assert(selfOwnerGovernanceHtml.includes(STAFF_ADMINISTRATIVE_SEPARATION_MESSAGE))
assert(!selfOwnerGovernanceHtml.includes('data-staff-governance-action="approve-request"'))
assert.equal(renderStaffAdministrativeGovernanceSection({ access: actionAccess('teacher', 'administrative-profile.view'), profile, staffMember: activeStaff }), '')

const profileWindowHtml = renderStaffAdministrativeProfileWindow({
  windowId: 'window-4',
  staffMember: { ...activeStaff, employeeCode: 'NV001', fullName: 'Nguyễn An' },
  lookup: { status: 'incomplete', profile },
  state: { mode: 'view', profileId: profile.id, revealedFields: new Set() },
  accessAllowed: true,
  governanceAccess: ownerAccess,
  auditEvents: [validAudit],
  retentionPolicy: policy,
  deletionRequests: [],
  governanceState: { mode: 'view', auditFilters: initialStaffAdministrativeAuditFilters },
  governanceStorageHealthy: true,
})
assert(profileWindowHtml.includes('data-section-id="window-4-governance"'))
assert(profileWindowHtml.includes('data-staff-governance-section'))
assert.equal((profileWindowHtml.match(/staff-administrative-content-scroll/g) || []).length, 1)

globalThis.localStorage = createMemoryStorage()
const storage = await import('../src/storage.js')
storage.setCurrentStorageCenterId('center-a')
const auditKeyA = 'ichessCenterOS.centerStaffAdministrativeAuditEvents.center-a'
const policyKeyA = 'ichessCenterOS.centerStaffAdministrativeRetentionPolicies.center-a'
const requestKeyA = 'ichessCenterOS.centerStaffAdministrativeDeletionRequests.center-a'
assert.deepEqual(storage.getStoredCenterStaffAdministrativeAuditEvents([]), [])
assert.equal(globalThis.localStorage.getItem(auditKeyA), null)
assert.equal(storage.appendStoredCenterStaffAdministrativeAuditEvent(validAudit), true)
assert.equal(storage.getStoredCenterStaffAdministrativeAuditEvents([]).length, 1)
const auditSnapshot = globalThis.localStorage.getItem(auditKeyA)
assert.equal(storage.appendStoredCenterStaffAdministrativeAuditEvent(validAudit), false)
assert.equal(globalThis.localStorage.getItem(auditKeyA), auditSnapshot)
assert.equal(storage.getStoredCenterStaffAdministrativeRetentionPolicy(null), null)
assert.equal(globalThis.localStorage.getItem(policyKeyA), null)
assert.equal(storage.saveStoredCenterStaffAdministrativeRetentionPolicy(policy), true)
assert.equal(storage.getStoredCenterStaffAdministrativeRetentionPolicy(null).revision, 1)
const policySnapshot = globalThis.localStorage.getItem(policyKeyA)
assert.equal(storage.saveStoredCenterStaffAdministrativeRetentionPolicy({ ...policy, centerId: 'center-b' }), false)
assert.equal(globalThis.localStorage.getItem(policyKeyA), policySnapshot)
assert.deepEqual(storage.getStoredCenterStaffAdministrativeDeletionRequests([]), [])
assert.equal(globalThis.localStorage.getItem(requestKeyA), null)
assert.equal(storage.saveStoredCenterStaffAdministrativeDeletionRequests([request]), true)
assert.equal(storage.getStoredCenterStaffAdministrativeDeletionRequests([])[0].revision, 1)
const requestSnapshot = globalThis.localStorage.getItem(requestKeyA)
assert.equal(storage.saveStoredCenterStaffAdministrativeDeletionRequests([request, { ...request }]), false)
assert.equal(globalThis.localStorage.getItem(requestKeyA), requestSnapshot)
storage.setCurrentStorageCenterId('center-b')
assert.deepEqual(storage.getStoredCenterStaffAdministrativeAuditEvents([]), [])
assert.equal(globalThis.localStorage.getItem('ichessCenterOS.centerStaffAdministrativeAuditEvents.center-b'), null)
globalThis.localStorage.setItem('ichessCenterOS.centerStaffAdministrativeAuditEvents.center-b', '{malformed')
assert.deepEqual(storage.getStoredCenterStaffAdministrativeAuditEvents([]), [])
assert.equal(storage.getStoredCenterStaffAdministrativeAuditEventsReadStatus().ok, false)
assert.equal(globalThis.localStorage.getItem('ichessCenterOS.centerStaffAdministrativeAuditEvents.center-b'), '{malformed')
storage.setCurrentStorageCenterId('center-c')
globalThis.localStorage.setItem('ichessCenterOS.centerStaffAdministrativeRetentionPolicies.center-c', '{malformed')
assert.equal(storage.getStoredCenterStaffAdministrativeRetentionPolicy(null), null)
assert.equal(storage.getStoredCenterStaffAdministrativeRetentionPolicyReadStatus().ok, false)
assert.equal(globalThis.localStorage.getItem('ichessCenterOS.centerStaffAdministrativeRetentionPolicies.center-c'), '{malformed')
globalThis.localStorage.setItem('ichessCenterOS.centerStaffAdministrativeDeletionRequests.center-c', '{malformed')
assert.deepEqual(storage.getStoredCenterStaffAdministrativeDeletionRequests([]), [])
assert.equal(storage.getStoredCenterStaffAdministrativeDeletionRequestsReadStatus().ok, false)
assert.equal(globalThis.localStorage.getItem('ichessCenterOS.centerStaffAdministrativeDeletionRequests.center-c'), '{malformed')

assert(storageSource.includes("'centerStaffAdministrativeAuditEvents'"))
assert(storageSource.includes("'centerStaffAdministrativeRetentionPolicies'"))
assert(storageSource.includes("'centerStaffAdministrativeDeletionRequests'"))
assert(storageSource.includes('appendStoredCenterStaffAdministrativeAuditEvent'))
assert(!storageSource.includes('saveStoredCenterStaffAdministrativeAuditEvents'))
assert(profileSource.includes("['governance', 'Quyền & lưu trữ']"))
assert(profileSource.includes('renderStaffAdministrativeGovernanceSection({'))
assert(main.includes("'retention-policy.manage'"))
assert(main.includes("'deletion-request.approve'"))
assert(main.includes("'deletion-request.deny'"))
assert(main.includes('savingStaffAdministrativeGovernanceWindowIds.has(windowId)'))
assert(main.includes('STAFF_ADMINISTRATIVE_REQUEST_STALE_MESSAGE'))
assert(main.includes('STAFF_ADMINISTRATIVE_POLICY_STALE_MESSAGE'))
assert(main.includes('getLatestStaffAdministrativeProfileAccessContext'))
assert(main.includes('focusWindow(existingWindow.id)'))
assert(main.includes('data-taskbar-window-id'))
assert(main.includes("windowItem.type === 'staff-administrative-profile'"))
assert(main.includes('refreshStaffAdministrativeAuditResultsRegion'))
assert(styles.includes('.staff-governance-section'))
const governanceStyles = styles.slice(
  styles.indexOf('.staff-governance-section'),
  styles.indexOf('.staff-documents-empty'),
)
assert(!governanceStyles.includes('overflow: auto'))
assert(!governanceSource.includes('type="file"'))
assert(!governanceSource.includes('localStorage'))
assert(!governanceSource.includes('console.'))
assert(!governanceSource.includes('setTimeout'))
assert(!governanceSource.includes('Supabase'))
const governanceRuntime = main.slice(
  main.indexOf('function getStaffAdministrativeGovernanceWindowContext'),
  main.indexOf('function focusFirstStaffAdministrativeProfileError'),
)
assert(!governanceRuntime.includes('console.'))
assert(!governanceRuntime.includes('setTimeout'))
assert(!governanceRuntime.includes('saveStoredCenterStaffMembers'))
assert(!governanceRuntime.includes('saveStoredCenterStaffAdministrativeProfiles'))
assert(!governanceRuntime.includes('saveStoredCenterStaffDocuments'))
assert(!governanceRuntime.includes('queueCoreCloudSync'))
assert(!governanceRuntime.includes('writeTeacherThroughCloud'))
assert(!governanceRuntime.includes('removeItem'))
assert(!governanceRuntime.includes('localStorage.clear'))
assert(!governanceRuntime.includes('JSON.stringify(profile)'))
assert(!governanceRuntime.includes('JSON.stringify(document'))

for (const marker of [
  'Action-level access matrix',
  'centerStaffAdministrativeAuditEvents',
  'Append-only audit',
  'Audit allowlist và redaction',
  'centerStaffAdministrativeRetentionPolicies',
  'Derived retention status',
  'centerStaffAdministrativeDeletionRequests',
  'Separation of duties',
  'Chờ thực thi backend',
  'Revision, stale guard và double-submit',
  'Center scope, window, taskbar, focus và scroll',
  'Migration và backward compatibility',
  'Membership ID compatibility',
  'No-binary và private URL',
  'Manual QA chưa được tự động kết luận PASS',
]) {
  assert(docs.includes(marker), `Missing F23.11D docs marker: ${marker}`)
}

const publicSecretMarker = ['SERVICE', 'ROLE', 'KEY'].join('_')
for (const source of [governanceSource, profileSource, storageSource, main, docs]) {
  assert(!source.includes(publicSecretMarker), 'Public service-role secret marker found.')
}
const mojibakeFragments = [
  `Cá${'º'}`,
  '\u00c3',
  `Æ${'°'}`,
  `Há${'º'}`,
  `á${'»'}`,
  `Buá${'»'}•i há${'»'}c má${'»'}›i`,
]
for (const source of [governanceSource, docs, governanceRuntime]) {
  assert(!mojibakeFragments.some((fragment) => source.includes(fragment)), 'Mojibake marker found.')
}

assert.deepEqual(activeStaff, {
  id: 'staff-1',
  centerId: 'center-a',
  employmentStatus: 'active',
  endDate: '',
  archivedAt: '',
})
assert.equal(profile.revision, 1)

console.log('F23.11D administrative governance local-safe smoke: PASS')

function createMemoryStorage() {
  const values = new Map()
  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      const normalizedKey = String(key)
      return values.has(normalizedKey) ? values.get(normalizedKey) : null
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key) {
      values.delete(String(key))
    },
    setItem(key, value) {
      values.set(String(key), String(value))
    },
  }
}
