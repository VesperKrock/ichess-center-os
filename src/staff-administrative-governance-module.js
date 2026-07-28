export const STAFF_ADMINISTRATIVE_GOVERNANCE_SCHEMA_VERSION = 1
export const STAFF_ADMINISTRATIVE_REQUEST_STALE_MESSAGE =
  'Yêu cầu đã thay đổi. Vui lòng mở lại để tiếp tục.'
export const STAFF_ADMINISTRATIVE_POLICY_STALE_MESSAGE =
  'Chính sách đã thay đổi. Vui lòng mở lại để tiếp tục.'
export const STAFF_ADMINISTRATIVE_SEPARATION_MESSAGE =
  'Cần một Owner khác phê duyệt'

export const STAFF_ADMINISTRATIVE_ACTIONS = Object.freeze([
  'administrative-profile.view',
  'administrative-profile.reveal-sensitive',
  'administrative-profile.edit',
  'staff-document.view',
  'staff-document.create',
  'staff-document.edit',
  'staff-document.archive',
  'staff-document.restore',
  'staff-document.attachment-upload',
  'staff-document.attachment-replace',
  'staff-document.attachment-view',
  'staff-document.attachment-download',
  'staff-document.attachment-remove',
  'staff-document.attachment-deletion-request',
  'staff-document.attachment-deletion-cancel',
  'staff-document.attachment-deletion-review',
  'staff-document.attachment-deletion-execute',
  'staff-document.attachment-legal-hold',
  'staff-document.attachment-retention-configure',
  'privacy-audit.view',
  'retention-policy.view',
  'retention-policy.manage',
  'deletion-request.create',
  'deletion-request.cancel',
  'deletion-request.review',
  'deletion-request.approve',
  'deletion-request.deny',
])

export const STAFF_ADMINISTRATIVE_AUDIT_ACTIONS = Object.freeze([
  'administrative-profile.open',
  'administrative-profile.reveal-sensitive',
  'administrative-profile.create',
  'administrative-profile.edit',
  'staff-document.create',
  'staff-document.edit',
  'staff-document.archive',
  'staff-document.restore',
  'staff-document.attachment-upload-start',
  'staff-document.attachment-upload-success',
  'staff-document.attachment-upload-failed',
  'staff-document.attachment-replacement-prepared',
  'staff-document.attachment-replacement-completed',
  'staff-document.attachment-replacement-failed',
  'staff-document.attachment-version-view',
  'staff-document.attachment-version-download',
  'staff-document.attachment-view',
  'staff-document.attachment-download',
  'staff_document_attachment_removed',
  'staff_document_attachment_deletion_requested',
  'staff_document_attachment_deletion_approved',
  'staff_document_attachment_deletion_rejected',
  'staff_document_attachment_deletion_canceled',
  'staff_document_attachment_deletion_execution_started',
  'staff_document_attachment_deletion_completed',
  'staff_document_attachment_deletion_failed',
  'staff_document_attachment_legal_hold_placed',
  'staff_document_attachment_legal_hold_released',
  'retention-policy.update',
  'deletion-request.create',
  'deletion-request.cancel',
  'deletion-request.approve',
  'deletion-request.deny',
])

export const STAFF_ADMINISTRATIVE_AUDIT_OUTCOMES = Object.freeze([
  'success',
  'denied',
  'validation-failed',
  'stale',
  'cancelled',
  'failed',
])

export const STAFF_ADMINISTRATIVE_DELETION_SCOPES = Object.freeze([
  ['administrative-profile', 'Hồ sơ hành chính'],
  ['staff-documents', 'Tài liệu nhân sự'],
  ['administrative-profile-and-documents', 'Hồ sơ hành chính và tài liệu'],
])

export const STAFF_ADMINISTRATIVE_DELETION_REASONS = Object.freeze([
  ['data-subject-request', 'Yêu cầu của chủ thể dữ liệu'],
  ['duplicate-record', 'Bản ghi trùng'],
  ['incorrect-record', 'Bản ghi không chính xác'],
  ['retention-review', 'Rà soát thời hạn lưu trữ'],
  ['other', 'Lý do khác'],
])

export const initialStaffAdministrativeAuditFilters = Object.freeze({
  action: 'all',
  outcome: 'all',
})

const OWNER_PERMISSIONS = new Set(STAFF_ADMINISTRATIVE_ACTIONS)
const CENTER_ADMIN_PERMISSIONS = new Set([
  'administrative-profile.view',
  'administrative-profile.reveal-sensitive',
  'administrative-profile.edit',
  'staff-document.view',
  'staff-document.create',
  'staff-document.edit',
  'staff-document.archive',
  'staff-document.restore',
  'staff-document.attachment-upload',
  'staff-document.attachment-replace',
  'staff-document.attachment-view',
  'staff-document.attachment-download',
  'staff-document.attachment-remove',
  'staff-document.attachment-deletion-request',
  'staff-document.attachment-deletion-cancel',
  'privacy-audit.view',
  'deletion-request.create',
  'deletion-request.cancel',
])
const ACTION_SET = new Set(STAFF_ADMINISTRATIVE_ACTIONS)
const AUDIT_ACTION_SET = new Set(STAFF_ADMINISTRATIVE_AUDIT_ACTIONS)
const AUDIT_OUTCOME_SET = new Set(STAFF_ADMINISTRATIVE_AUDIT_OUTCOMES)
const DELETION_SCOPE_SET = new Set(STAFF_ADMINISTRATIVE_DELETION_SCOPES.map(([key]) => key))
const DELETION_REASON_SET = new Set(STAFF_ADMINISTRATIVE_DELETION_REASONS.map(([key]) => key))
const DELETION_STATUS_SET = new Set([
  'pending-review',
  'approved',
  'denied',
  'cancelled',
  'execution-pending',
  'executed',
  'failed',
])
const EXECUTION_STATE_SET = new Set([
  'not-approved',
  'waiting-backend',
  'executed',
  'failed',
])
const AUDIT_REASON_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/
const SAFE_AUDIT_SUMMARY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,119}$/i
const AUDIT_TARGET_TYPE_SET = new Set([
  'administrative-profile',
  'staff-document',
  'staff-document-attachment',
  'retention-policy',
  'deletion-request',
  'staff-member',
])
const AUDIT_ALLOWED_FIELD_SET = new Set([
  'id',
  'schemaVersion',
  'centerId',
  'actorUserId',
  'actorMembershipId',
  'actorRole',
  'action',
  'targetType',
  'targetId',
  'staffMemberId',
  'administrativeProfileId',
  'documentId',
  'attachmentId',
  'outcome',
  'reasonCode',
  'noteSummary',
  'requestId',
  'createdAt',
])
const RETENTION_WARNING_DAYS = 30
const POLICY_MAX_DAYS = 36_500
const GRACE_MAX_DAYS = 3_650

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function normalizeText(value) {
  if (value === null || value === undefined || typeof value === 'object') return ''
  return String(value).trim()
}

function normalizeRole(role) {
  const normalized = normalizeText(role).toLowerCase().replace(/[\s-]+/g, '_')
  return normalized === 'admin' ? 'center_admin' : normalized
}

function attachIssues(record, issues) {
  Object.defineProperty(record, '__normalizationIssues', {
    configurable: true,
    enumerable: false,
    value: [...issues],
    writable: false,
  })
  return record
}

function normalizeOwnedText(record, field, issues) {
  const value = record?.[field]
  if (value !== undefined && value !== null && typeof value === 'object') {
    issues.push(`${field}:malformed-value`)
    return ''
  }
  return normalizeText(value)
}

function normalizeMembershipId(membership, centerId, userId) {
  const canonicalId = normalizeText(
    membership?.id || membership?.membership_id || membership?.membershipId,
  )
  return canonicalId || `membership-ref:${centerId}:${userId}`
}

export function resolveStaffAdministrativeActionAccess({
  user,
  binding,
  storageCenterId,
  action = 'administrative-profile.view',
} = {}) {
  const requestedAction = normalizeText(action)
  const userId = normalizeText(user?.id)
  const centerId = normalizeText(binding?.currentCenterId)
  const localCenterId = normalizeText(storageCenterId)
  const membership = binding?.membership
  const membershipCenterId = normalizeText(membership?.center_id || membership?.centerId)
  const membershipUserId = normalizeText(membership?.user_id || membership?.userId)
  const role = normalizeRole(membership?.role)
  const base = {
    ok: false,
    allowed: false,
    action: requestedAction,
    centerId,
    role,
    membership,
    actorUserId: userId,
    actorMembershipId: normalizeMembershipId(membership, centerId, userId),
    permissions: new Set(),
    reason: '',
    error: 'Bạn không có quyền truy cập Hồ sơ hành chính.',
  }

  if (!ACTION_SET.has(requestedAction)) return { ...base, reason: 'action-unknown' }
  if (!userId || binding?.status !== 'bound' || !isPlainObject(membership)) {
    return { ...base, reason: 'membership-missing' }
  }
  if (!centerId || !localCenterId || centerId !== localCenterId) {
    return { ...base, reason: 'center-mismatch' }
  }
  if (membershipCenterId !== centerId || (membershipUserId && membershipUserId !== userId)) {
    return { ...base, reason: 'membership-malformed' }
  }
  if (normalizeText(membership.status).toLowerCase() !== 'active') {
    return { ...base, reason: 'membership-inactive' }
  }

  const permissions = role === 'owner'
    ? OWNER_PERMISSIONS
    : role === 'center_admin'
      ? CENTER_ADMIN_PERMISSIONS
      : new Set()
  const allowed = permissions.has(requestedAction)
  return {
    ...base,
    ok: allowed,
    allowed,
    permissions: new Set(permissions),
    reason: allowed ? '' : 'action-denied',
    error: allowed ? '' : base.error,
  }
}

export function hasStaffAdministrativeAction(access, action) {
  return Boolean(access?.permissions instanceof Set && access.permissions.has(action))
}

export function createStaffAdministrativeAuditEventId(now = Date.now()) {
  return `staff-admin-audit-${now}-${Math.random().toString(36).slice(2, 9)}`
}

export function buildStaffAdministrativeAuditEvent(payload = {}) {
  const createdAt = normalizeText(payload.createdAt) || new Date().toISOString()
  const noteSummary = normalizeText(payload.noteSummary)
  return {
    id: normalizeText(payload.id) || createStaffAdministrativeAuditEventId(new Date(createdAt).getTime()),
    schemaVersion: STAFF_ADMINISTRATIVE_GOVERNANCE_SCHEMA_VERSION,
    centerId: normalizeText(payload.centerId),
    actorUserId: normalizeText(payload.actorUserId),
    actorMembershipId: normalizeText(payload.actorMembershipId),
    actorRole: normalizeRole(payload.actorRole),
    action: normalizeText(payload.action),
    targetType: normalizeText(payload.targetType),
    targetId: normalizeText(payload.targetId),
    staffMemberId: normalizeText(payload.staffMemberId),
    administrativeProfileId: normalizeText(payload.administrativeProfileId),
    documentId: normalizeText(payload.documentId),
    attachmentId: normalizeText(payload.attachmentId),
    outcome: normalizeText(payload.outcome),
    reasonCode: normalizeText(payload.reasonCode),
    noteSummary: SAFE_AUDIT_SUMMARY_PATTERN.test(noteSummary) ? noteSummary : '',
    requestId: normalizeText(payload.requestId),
    createdAt,
  }
}

export function normalizeStaffAdministrativeAuditEvent(event, { currentCenterId = '' } = {}) {
  if (!isPlainObject(event)) return null
  const issues = []
  const explicitCenterId = normalizeOwnedText(event, 'centerId', issues)
  const scopedCenterId = normalizeText(currentCenterId)
  const normalized = {
    ...event,
    id: normalizeOwnedText(event, 'id', issues),
    schemaVersion: Number(event.schemaVersion),
    centerId: explicitCenterId || scopedCenterId,
    actorUserId: normalizeOwnedText(event, 'actorUserId', issues),
    actorMembershipId: normalizeOwnedText(event, 'actorMembershipId', issues),
    actorRole: normalizeRole(normalizeOwnedText(event, 'actorRole', issues)),
    action: normalizeOwnedText(event, 'action', issues),
    targetType: normalizeOwnedText(event, 'targetType', issues),
    targetId: normalizeOwnedText(event, 'targetId', issues),
    staffMemberId: normalizeOwnedText(event, 'staffMemberId', issues),
    administrativeProfileId: normalizeOwnedText(event, 'administrativeProfileId', issues),
    documentId: normalizeOwnedText(event, 'documentId', issues),
    attachmentId: normalizeOwnedText(event, 'attachmentId', issues),
    outcome: normalizeOwnedText(event, 'outcome', issues),
    reasonCode: normalizeOwnedText(event, 'reasonCode', issues),
    noteSummary: normalizeOwnedText(event, 'noteSummary', issues),
    requestId: normalizeOwnedText(event, 'requestId', issues),
    createdAt: normalizeOwnedText(event, 'createdAt', issues),
  }
  if (explicitCenterId && scopedCenterId && explicitCenterId !== scopedCenterId) {
    issues.push('centerId:mismatch')
  }
  return attachIssues(normalized, issues)
}

export function normalizeStaffAdministrativeAuditEvents(events, options = {}) {
  return (Array.isArray(events) ? events : [])
    .map((event) => normalizeStaffAdministrativeAuditEvent(event, options))
    .filter(Boolean)
}

export function getStaffAdministrativeAuditEventIssues(event, currentCenterId = '') {
  if (!isPlainObject(event)) return ['event:not-plain-object']
  const issues = [...(event.__normalizationIssues || [])]
  if (!normalizeText(event.id)) issues.push('id:missing')
  if (!normalizeText(event.centerId)) issues.push('centerId:missing')
  if (currentCenterId && event.centerId !== currentCenterId) issues.push('centerId:mismatch')
  if (!normalizeText(event.actorUserId)) issues.push('actorUserId:missing')
  if (!normalizeText(event.actorMembershipId)) issues.push('actorMembershipId:missing')
  if (!['owner', 'center_admin', 'teacher', 'consultant'].includes(event.actorRole)) {
    issues.push('actorRole:invalid')
  }
  if (!AUDIT_ACTION_SET.has(event.action)) issues.push('action:invalid')
  if (!AUDIT_TARGET_TYPE_SET.has(event.targetType)) issues.push('targetType:invalid')
  if (!normalizeText(event.targetId)) issues.push('targetId:missing')
  if (!normalizeText(event.staffMemberId)) issues.push('staffMemberId:missing')
  if (event.targetType !== 'staff-member' && !normalizeText(event.administrativeProfileId)) {
    issues.push('administrativeProfileId:missing')
  }
  if (
    ['staff-document', 'staff-document-attachment'].includes(event.targetType) &&
    !normalizeText(event.documentId)
  ) {
    issues.push('documentId:missing')
  }
  if (
    event.targetType === 'staff-document-attachment' &&
    !normalizeText(event.attachmentId)
  ) issues.push('attachmentId:missing')
  if (event.targetType === 'deletion-request' && !normalizeText(event.requestId)) {
    issues.push('requestId:missing')
  }
  if (!AUDIT_OUTCOME_SET.has(event.outcome)) issues.push('outcome:invalid')
  if (!AUDIT_REASON_CODE_PATTERN.test(event.reasonCode)) issues.push('reasonCode:invalid')
  if (event.noteSummary && !SAFE_AUDIT_SUMMARY_PATTERN.test(event.noteSummary)) {
    issues.push('noteSummary:unsafe')
  }
  if (!isIsoDateTime(event.createdAt)) issues.push('createdAt:invalid')
  if (Number(event.schemaVersion) !== STAFF_ADMINISTRATIVE_GOVERNANCE_SCHEMA_VERSION) {
    issues.push('schemaVersion:unsupported')
  }
  if (containsForbiddenAuditKey(event)) issues.push('event:contains-forbidden-field')
  if (Object.keys(event).some((field) => !AUDIT_ALLOWED_FIELD_SET.has(field))) {
    issues.push('event:contains-unknown-field')
  }
  if (safeSerializedLength(event) > 8_192) issues.push('event:too-large')
  return [...new Set(issues)]
}

function containsForbiddenAuditKey(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return false
  if (seen.has(value)) return true
  seen.add(value)
  const forbidden = /(?:number|address|phone|birth|note$|filename|filedata|filecontent|path|bucket|url|blob|base64|binary|snapshot|payload|html|token|before|after|profiledata|documentdata)/i
  return Object.entries(value).some(([key, child]) =>
    forbidden.test(key) || (typeof child === 'object' && containsForbiddenAuditKey(child, seen)),
  )
}

export function getStaffAdministrativeAuditCollectionIssues(events, currentCenterId) {
  const issues = []
  const ids = new Map()
  ;(Array.isArray(events) ? events : []).forEach((event, index) => {
    getStaffAdministrativeAuditEventIssues(event, currentCenterId).forEach((issue) => {
      issues.push(`${index}:${issue}`)
    })
    if (event?.id) ids.set(event.id, (ids.get(event.id) || 0) + 1)
  })
  ids.forEach((count, id) => {
    if (count > 1) issues.push(`eventId:${id}:duplicate`)
  })
  return issues
}

export function appendStaffAdministrativeAuditEvent(events, event, currentCenterId) {
  const current = Array.isArray(events) ? events : []
  if (
    getStaffAdministrativeAuditCollectionIssues(current, currentCenterId).length ||
    getStaffAdministrativeAuditEventIssues(event, currentCenterId).length ||
    current.some((item) => item.id === event.id)
  ) return null
  return [...current, event]
}

export function createStaffAdministrativeRetentionPolicyId(now = Date.now()) {
  return `staff-retention-policy-${now}-${Math.random().toString(36).slice(2, 9)}`
}

export function createStaffAdministrativeRetentionPolicyDraft(policy = null) {
  return {
    profileRetentionDaysAfterEmploymentEnd:
      policy?.profileRetentionDaysAfterEmploymentEnd ?? 1825,
    documentRetentionDaysAfterEmploymentEnd:
      policy?.documentRetentionDaysAfterEmploymentEnd ?? 1825,
    deletionReviewGraceDays: policy?.deletionReviewGraceDays ?? 30,
    enabled: policy?.enabled ?? true,
  }
}

export function setStaffAdministrativeRetentionPolicyDraftValue(values, field, value) {
  if (![
    'profileRetentionDaysAfterEmploymentEnd',
    'documentRetentionDaysAfterEmploymentEnd',
    'deletionReviewGraceDays',
    'enabled',
  ].includes(field)) return values
  return { ...values, [field]: field === 'enabled' ? Boolean(value) : String(value ?? '') }
}

export function validateStaffAdministrativeRetentionPolicy(values) {
  const errors = {}
  const checkInteger = (field, label, max) => {
    const raw = String(values?.[field] ?? '').trim()
    const number = Number(raw)
    if (!/^\d+$/.test(raw) || !Number.isInteger(number) || number < 0 || number > max) {
      errors[field] = `${label} phải là số nguyên từ 0 đến ${max}.`
    }
  }
  checkInteger(
    'profileRetentionDaysAfterEmploymentEnd',
    'Số ngày giữ Hồ sơ hành chính',
    POLICY_MAX_DAYS,
  )
  checkInteger(
    'documentRetentionDaysAfterEmploymentEnd',
    'Số ngày giữ tài liệu',
    POLICY_MAX_DAYS,
  )
  checkInteger('deletionReviewGraceDays', 'Số ngày chờ thực thi', GRACE_MAX_DAYS)
  return errors
}

export function buildStaffAdministrativeRetentionPolicy(values, existingPolicy, {
  centerId,
  policyId = '',
  now = new Date().toISOString(),
} = {}) {
  const previous = existingPolicy || null
  return {
    ...(previous || {}),
    id: normalizeText(previous?.id || policyId),
    schemaVersion: STAFF_ADMINISTRATIVE_GOVERNANCE_SCHEMA_VERSION,
    centerId: normalizeText(centerId),
    profileRetentionDaysAfterEmploymentEnd: Number(values.profileRetentionDaysAfterEmploymentEnd),
    documentRetentionDaysAfterEmploymentEnd: Number(values.documentRetentionDaysAfterEmploymentEnd),
    deletionReviewGraceDays: Number(values.deletionReviewGraceDays),
    enabled: Boolean(values.enabled),
    revision: previous ? Number(previous.revision) + 1 : 1,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  }
}

export function normalizeStaffAdministrativeRetentionPolicy(policy, { currentCenterId = '' } = {}) {
  if (!isPlainObject(policy)) return null
  const issues = []
  const explicitCenterId = normalizeOwnedText(policy, 'centerId', issues)
  const scopedCenterId = normalizeText(currentCenterId)
  if (typeof policy.enabled !== 'boolean') issues.push('enabled:malformed-value')
  if (explicitCenterId && scopedCenterId && explicitCenterId !== scopedCenterId) {
    issues.push('centerId:mismatch')
  }
  return attachIssues({
    ...policy,
    id: normalizeOwnedText(policy, 'id', issues),
    schemaVersion: Number(policy.schemaVersion),
    centerId: explicitCenterId || scopedCenterId,
    profileRetentionDaysAfterEmploymentEnd: Number(policy.profileRetentionDaysAfterEmploymentEnd),
    documentRetentionDaysAfterEmploymentEnd: Number(policy.documentRetentionDaysAfterEmploymentEnd),
    deletionReviewGraceDays: Number(policy.deletionReviewGraceDays),
    enabled: Boolean(policy.enabled),
    revision: Number(policy.revision),
    createdAt: normalizeOwnedText(policy, 'createdAt', issues),
    updatedAt: normalizeOwnedText(policy, 'updatedAt', issues),
  }, issues)
}

export function getStaffAdministrativeRetentionPolicyIssues(policy, currentCenterId = '') {
  if (!isPlainObject(policy)) return ['policy:not-plain-object']
  const issues = [...(policy.__normalizationIssues || [])]
  if (!policy.id) issues.push('id:missing')
  if (!policy.centerId) issues.push('centerId:missing')
  if (currentCenterId && policy.centerId !== currentCenterId) issues.push('centerId:mismatch')
  if (Number(policy.schemaVersion) !== STAFF_ADMINISTRATIVE_GOVERNANCE_SCHEMA_VERSION) {
    issues.push('schemaVersion:unsupported')
  }
  if (Object.keys(validateStaffAdministrativeRetentionPolicy(policy)).length) {
    issues.push('policy:invalid-values')
  }
  if (!Number.isInteger(policy.revision) || policy.revision < 1) issues.push('revision:invalid')
  if (!isIsoDateTime(policy.createdAt)) issues.push('createdAt:invalid')
  if (!isIsoDateTime(policy.updatedAt)) issues.push('updatedAt:invalid')
  if (containsForbiddenLocalPayload(policy) || safeSerializedLength(policy) > 16_384) {
    issues.push('policy:unsafe-payload')
  }
  return [...new Set(issues)]
}

export function deriveStaffAdministrativeRetentionStatus({
  staffMember,
  policy,
  deletionRequests = [],
  today = getTodayDate(),
} = {}) {
  const activeRequest = [...(Array.isArray(deletionRequests) ? deletionRequests : [])]
    .filter((request) => ['pending-review', 'approved', 'execution-pending'].includes(request.status))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))[0] || null
  if (activeRequest?.status === 'execution-pending' || activeRequest?.status === 'approved') {
    return createRetentionResult('backend-execution-pending', activeRequest, '', '')
  }
  if (activeRequest?.status === 'pending-review') {
    return createRetentionResult('deletion-request-active', activeRequest, '', '')
  }
  const endDate = normalizeText(staffMember?.endDate)
  if (staffMember?.employmentStatus !== 'terminated' || !isRealDate(endDate)) {
    return createRetentionResult('not-applicable', null, '', '')
  }
  if (!policy || !policy.enabled || getStaffAdministrativeRetentionPolicyIssues(
    policy,
    normalizeText(staffMember?.centerId || policy?.centerId),
  ).length) {
    return createRetentionResult('policy-missing', null, '', '')
  }
  const profileReviewDate = addDays(endDate, policy.profileRetentionDaysAfterEmploymentEnd)
  const documentReviewDate = addDays(endDate, policy.documentRetentionDaysAfterEmploymentEnd)
  const earliestReviewDate = [profileReviewDate, documentReviewDate].sort()[0]
  const warningDate = addDays(today, RETENTION_WARNING_DAYS)
  const status = earliestReviewDate <= today
    ? 'review-due'
    : earliestReviewDate <= warningDate
      ? 'review-due-soon'
      : 'retained'
  return createRetentionResult(status, null, profileReviewDate, documentReviewDate)
}

function createRetentionResult(status, activeRequest, profileReviewDate, documentReviewDate) {
  return {
    status,
    label: {
      'not-applicable': 'Không áp dụng',
      'policy-missing': 'Chưa thiết lập chính sách lưu trữ',
      retained: 'Đang lưu trữ',
      'review-due-soon': 'Sắp đến hạn rà soát',
      'review-due': 'Đến hạn rà soát',
      'deletion-request-active': 'Đang có yêu cầu xóa',
      'backend-execution-pending': 'Chờ thực thi backend',
    }[status] || 'Cần kiểm tra',
    activeRequest,
    profileReviewDate,
    documentReviewDate,
  }
}

export function createStaffAdministrativeDeletionRequestId(now = Date.now()) {
  return `staff-deletion-request-${now}-${Math.random().toString(36).slice(2, 9)}`
}

export function createStaffAdministrativeDeletionRequestDraft() {
  return {
    scope: 'administrative-profile-and-documents',
    reasonCode: 'data-subject-request',
    reasonNote: '',
    confirmed: false,
  }
}

export function setStaffAdministrativeDeletionRequestDraftValue(values, field, value) {
  if (!['scope', 'reasonCode', 'reasonNote', 'confirmed'].includes(field)) return values
  return { ...values, [field]: field === 'confirmed' ? Boolean(value) : String(value ?? '') }
}

export function validateStaffAdministrativeDeletionRequest(values, { forbiddenValues = [] } = {}) {
  const errors = {}
  const reasonNote = normalizeText(values?.reasonNote)
  if (!DELETION_SCOPE_SET.has(values?.scope)) errors.scope = 'Phạm vi yêu cầu không hợp lệ.'
  if (!DELETION_REASON_SET.has(values?.reasonCode)) errors.reasonCode = 'Lý do không hợp lệ.'
  if (reasonNote.length < 12 || reasonNote.length > 500) {
    errors.reasonNote = 'Ghi chú cần từ 12 đến 500 ký tự.'
  }
  const normalizedNote = reasonNote.toLocaleLowerCase('vi')
  const containsKnownSensitiveValue = forbiddenValues
    .map(normalizeText)
    .filter((value) => value.length >= 4)
    .some((value) => normalizedNote.includes(value.toLocaleLowerCase('vi')))
  if (containsKnownSensitiveValue) {
    errors.reasonNote = 'Ghi chú không được chứa dữ liệu nhạy cảm hoặc metadata tài liệu thô.'
  }
  if (!values?.confirmed) {
    errors.confirmed = 'Cần xác nhận phase này không xóa dữ liệu ngay.'
  }
  return errors
}

export function buildStaffAdministrativeDeletionRequest(values, {
  id = '',
  centerId,
  staffMemberId,
  administrativeProfileId,
  actor,
  now = new Date().toISOString(),
} = {}) {
  return {
    id: normalizeText(id),
    schemaVersion: STAFF_ADMINISTRATIVE_GOVERNANCE_SCHEMA_VERSION,
    centerId: normalizeText(centerId),
    staffMemberId: normalizeText(staffMemberId),
    administrativeProfileId: normalizeText(administrativeProfileId),
    scope: normalizeText(values.scope),
    reasonCode: normalizeText(values.reasonCode),
    reasonNote: normalizeText(values.reasonNote),
    status: 'pending-review',
    requestedByUserId: normalizeText(actor?.actorUserId),
    requestedByMembershipId: normalizeText(actor?.actorMembershipId),
    requestedByRole: normalizeRole(actor?.role),
    requestedAt: now,
    reviewedByUserId: '',
    reviewedByMembershipId: '',
    reviewedByRole: '',
    reviewedAt: '',
    reviewNote: '',
    approvedAt: '',
    deniedAt: '',
    cancelledAt: '',
    executionEligibleAt: '',
    executionState: 'not-approved',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  }
}

export function normalizeStaffAdministrativeDeletionRequest(request, { currentCenterId = '' } = {}) {
  if (!isPlainObject(request)) return null
  const issues = []
  const explicitCenterId = normalizeOwnedText(request, 'centerId', issues)
  const scopedCenterId = normalizeText(currentCenterId)
  const textFields = [
    'id', 'staffMemberId', 'administrativeProfileId', 'scope', 'reasonCode', 'reasonNote',
    'status', 'requestedByUserId', 'requestedByMembershipId', 'requestedByRole', 'requestedAt',
    'reviewedByUserId', 'reviewedByMembershipId', 'reviewedByRole', 'reviewedAt', 'reviewNote',
    'approvedAt', 'deniedAt', 'cancelledAt', 'executionEligibleAt', 'executionState',
    'createdAt', 'updatedAt',
  ]
  const normalized = {
    ...request,
    schemaVersion: Number(request.schemaVersion),
    centerId: explicitCenterId || scopedCenterId,
    revision: Number(request.revision),
    ...Object.fromEntries(textFields.map((field) => [field, normalizeOwnedText(request, field, issues)])),
  }
  if (explicitCenterId && scopedCenterId && explicitCenterId !== scopedCenterId) {
    issues.push('centerId:mismatch')
  }
  normalized.requestedByRole = normalizeRole(normalized.requestedByRole)
  normalized.reviewedByRole = normalizeRole(normalized.reviewedByRole)
  return attachIssues(normalized, issues)
}

export function normalizeStaffAdministrativeDeletionRequests(requests, options = {}) {
  return (Array.isArray(requests) ? requests : [])
    .map((request) => normalizeStaffAdministrativeDeletionRequest(request, options))
    .filter(Boolean)
}

export function getStaffAdministrativeDeletionRequestIssues(request, currentCenterId = '') {
  if (!isPlainObject(request)) return ['request:not-plain-object']
  const issues = [...(request.__normalizationIssues || [])]
  ;['id', 'centerId', 'staffMemberId', 'administrativeProfileId', 'requestedByUserId',
    'requestedByMembershipId'].forEach((field) => {
    if (!normalizeText(request[field])) issues.push(`${field}:missing`)
  })
  if (currentCenterId && request.centerId !== currentCenterId) issues.push('centerId:mismatch')
  if (!DELETION_SCOPE_SET.has(request.scope)) issues.push('scope:invalid')
  if (!DELETION_REASON_SET.has(request.reasonCode)) issues.push('reasonCode:invalid')
  if (request.reasonNote.length < 12 || request.reasonNote.length > 500) issues.push('reasonNote:invalid')
  if (!['owner', 'center_admin'].includes(request.requestedByRole)) {
    issues.push('requestedByRole:invalid')
  }
  if (!DELETION_STATUS_SET.has(request.status)) issues.push('status:invalid')
  if (!EXECUTION_STATE_SET.has(request.executionState)) issues.push('executionState:invalid')
  if (request.status === 'executed') issues.push('status:future-only')
  if (!Number.isInteger(request.revision) || request.revision < 1) issues.push('revision:invalid')
  ;['requestedAt', 'createdAt', 'updatedAt'].forEach((field) => {
    if (!isIsoDateTime(request[field])) issues.push(`${field}:invalid`)
  })
  ;['reviewedAt', 'approvedAt', 'deniedAt', 'cancelledAt', 'executionEligibleAt'].forEach((field) => {
    if (request[field] && !isIsoDateTime(request[field])) issues.push(`${field}:invalid`)
  })
  if (Number(request.schemaVersion) !== STAFF_ADMINISTRATIVE_GOVERNANCE_SCHEMA_VERSION) {
    issues.push('schemaVersion:unsupported')
  }
  if (request.reviewNote.length > 500) issues.push('reviewNote:invalid')
  if (request.status === 'cancelled' && !request.cancelledAt) issues.push('cancelledAt:missing')
  if (request.status === 'denied' || request.status === 'execution-pending') {
    if (!request.reviewedByUserId || !request.reviewedByMembershipId) {
      issues.push('reviewer:missing')
    }
    if (request.reviewedByRole !== 'owner') issues.push('reviewedByRole:invalid')
    if (!request.reviewedAt) issues.push('reviewedAt:missing')
  }
  if (request.status === 'denied' && !request.deniedAt) issues.push('deniedAt:missing')
  if (request.status === 'execution-pending') {
    if (!request.approvedAt || !request.executionEligibleAt) issues.push('approvalDate:missing')
    if (request.executionState !== 'waiting-backend') issues.push('executionState:invalid')
  }
  if (containsForbiddenLocalPayload(request) || safeSerializedLength(request) > 32_768) {
    issues.push('request:unsafe-payload')
  }
  return [...new Set(issues)]
}

export function getStaffAdministrativeDeletionRequestCollectionIssues(requests, currentCenterId) {
  const issues = []
  const ids = new Map()
  ;(Array.isArray(requests) ? requests : []).forEach((request, index) => {
    getStaffAdministrativeDeletionRequestIssues(request, currentCenterId).forEach((issue) => {
      issues.push(`${index}:${issue}`)
    })
    if (request?.id) ids.set(request.id, (ids.get(request.id) || 0) + 1)
  })
  ids.forEach((count, id) => {
    if (count > 1) issues.push(`requestId:${id}:duplicate`)
  })
  return issues
}

export function cancelStaffAdministrativeDeletionRequest(request, actor, now = new Date().toISOString()) {
  if (!request || request.status !== 'pending-review') return null
  const actorRole = normalizeRole(actor?.role)
  const isCreator = request.requestedByUserId === actor?.actorUserId &&
    request.requestedByMembershipId === actor?.actorMembershipId
  if (actorRole !== 'owner' && !(actorRole === 'center_admin' && isCreator)) return null
  return {
    ...request,
    status: 'cancelled',
    cancelledAt: now,
    updatedAt: now,
    revision: Number(request.revision) + 1,
  }
}

export function reviewStaffAdministrativeDeletionRequest(request, actor, decision, {
  reviewNote = '',
  deletionReviewGraceDays = 0,
  now = new Date().toISOString(),
} = {}) {
  if (!request || request.status !== 'pending-review' || normalizeRole(actor?.role) !== 'owner') {
    return { ok: false, error: 'Chỉ Owner đang hoạt động được xem xét yêu cầu.', request: null }
  }
  if (
    request.requestedByUserId === actor.actorUserId ||
    request.requestedByMembershipId === actor.actorMembershipId
  ) {
    return { ok: false, error: STAFF_ADMINISTRATIVE_SEPARATION_MESSAGE, request: null }
  }
  if (!['approve', 'deny'].includes(decision)) {
    return { ok: false, error: 'Quyết định không hợp lệ.', request: null }
  }
  const normalizedReviewNote = normalizeText(reviewNote)
  if (normalizedReviewNote.length > 500) {
    return { ok: false, error: 'Ghi chú xem xét không được quá 500 ký tự.', request: null }
  }
  const approved = decision === 'approve'
  const next = {
    ...request,
    status: approved ? 'execution-pending' : 'denied',
    reviewedByUserId: normalizeText(actor.actorUserId),
    reviewedByMembershipId: normalizeText(actor.actorMembershipId),
    reviewedByRole: 'owner',
    reviewedAt: now,
    reviewNote: normalizedReviewNote,
    approvedAt: approved ? now : '',
    deniedAt: approved ? '' : now,
    executionEligibleAt: approved ? addDaysToIsoDateTime(now, deletionReviewGraceDays) : '',
    executionState: approved ? 'waiting-backend' : 'not-approved',
    updatedAt: now,
    revision: Number(request.revision) + 1,
  }
  return { ok: true, error: '', request: next }
}

export function getStaffAdministrativeDeletionStatusLabel(status) {
  return {
    'pending-review': 'Chờ xem xét',
    approved: 'Đã phê duyệt',
    denied: 'Đã từ chối',
    cancelled: 'Đã hủy',
    'execution-pending': 'Đã phê duyệt — chờ thực thi backend',
    executed: 'Trạng thái future-only',
    failed: 'Thực thi backend thất bại',
  }[status] || 'Cần kiểm tra'
}

export function renderStaffAdministrativeGovernanceSection({
  windowId,
  access,
  staffMember,
  profile,
  auditEvents = [],
  policy = null,
  deletionRequests = [],
  state = {},
  storageHealthy = true,
} = {}) {
  if (!access?.allowed || !profile || !staffMember) return ''
  const scopedRequests = deletionRequests.filter(
    (request) => request.administrativeProfileId === profile.id && request.staffMemberId === staffMember.id,
  )
  const scopedEvents = auditEvents.filter(
    (event) =>
      event.staffMemberId === staffMember.id ||
      (event.targetType === 'retention-policy' && event.centerId === access.centerId),
  )
  const retention = deriveStaffAdministrativeRetentionStatus({
    staffMember,
    policy,
    deletionRequests: scopedRequests,
  })
  return `
    <section class="staff-administrative-section staff-governance-section" id="${escapeAttribute(`${windowId}-governance`)}" data-staff-governance-section>
      <div class="staff-governance-heading">
        <div><h4>Quyền &amp; lưu trữ</h4><p>Quyền theo hành động, audit đã lược bỏ dữ liệu nhạy cảm và workflow không xóa vật lý.</p></div>
      </div>
      ${!storageHealthy ? '<p class="staff-governance-notice is-warning" role="alert">Dữ liệu quản trị quyền và lưu trữ cần kiểm tra. Hệ thống đã khóa mutation.</p>' : ''}
      ${state.message ? `<p class="staff-governance-notice" role="status">${escapeHtml(state.message)}</p>` : ''}
      ${renderAccessPanel(access)}
      ${renderAuditPanel(scopedEvents, state)}
      ${renderRetentionPanel({ access, staffMember, policy, requests: scopedRequests, retention, state, storageHealthy })}
    </section>
  `
}

function renderAccessPanel(access) {
  const checks = [
    ['Xem Hồ sơ hành chính', 'administrative-profile.view'],
    ['Reveal dữ liệu nhạy cảm', 'administrative-profile.reveal-sensitive'],
    ['Sửa Hồ sơ hành chính', 'administrative-profile.edit'],
    ['Quản lý tài liệu', 'staff-document.edit'],
    ['Tải tệp tài liệu riêng tư', 'staff-document.attachment-upload'],
    ['Thay tệp và lưu phiên bản cũ', 'staff-document.attachment-replace'],
    ['Xem / tải tệp tài liệu', 'staff-document.attachment-view'],
    ['Tạo yêu cầu xóa', 'deletion-request.create'],
    ['Xem xét / phê duyệt', 'deletion-request.approve'],
  ]
  return `
    <div class="staff-governance-panel" data-staff-governance-panel="access">
      <h5>Quyền truy cập</h5>
      <div class="staff-governance-access-summary">
        <div><span>Vai trò hiện tại</span><strong>${escapeHtml(getActorRoleLabel(access.role))}</strong></div>
        <div><span>Cơ sở hiện tại</span><strong>${escapeHtml(access.centerId)}</strong></div>
      </div>
      <ul class="staff-governance-permission-list">${checks.map(([label, action]) => `
        <li class="${hasStaffAdministrativeAction(access, action) ? 'is-allowed' : 'is-denied'}">
          <span>${hasStaffAdministrativeAction(access, action) ? '✓' : '—'}</span>${escapeHtml(label)}
        </li>`).join('')}
      </ul>
    </div>`
}

function renderAuditPanel(events, state) {
  const filters = normalizeAuditFilters(state.auditFilters)
  return `
    <div class="staff-governance-panel" data-staff-governance-panel="audit">
      <h5>Nhật ký hành động</h5>
      <div class="staff-governance-audit-filters">
        <label><span>Hành động</span><select data-staff-governance-audit-filter="action">
          <option value="all">Tất cả hành động</option>
          ${STAFF_ADMINISTRATIVE_AUDIT_ACTIONS.map((action) => `<option value="${escapeAttribute(action)}" ${filters.action === action ? 'selected' : ''}>${escapeHtml(getAuditActionLabel(action))}</option>`).join('')}
        </select></label>
        <label><span>Kết quả</span><select data-staff-governance-audit-filter="outcome">
          <option value="all">Tất cả kết quả</option>
          ${STAFF_ADMINISTRATIVE_AUDIT_OUTCOMES.map((outcome) => `<option value="${outcome}" ${filters.outcome === outcome ? 'selected' : ''}>${escapeHtml(getAuditOutcomeLabel(outcome))}</option>`).join('')}
        </select></label>
      </div>
      <div data-staff-governance-audit-results>${renderStaffAdministrativeAuditResults(events, filters, state.auditLimit)}</div>
    </div>`
}

export function renderStaffAdministrativeAuditResults(events, filters, auditLimit = 25) {
  const normalizedFilters = normalizeAuditFilters(filters)
  const filtered = [...events]
    .filter((event) => normalizedFilters.action === 'all' || event.action === normalizedFilters.action)
    .filter((event) => normalizedFilters.outcome === 'all' || event.outcome === normalizedFilters.outcome)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  const safeLimit = Math.min(100, Math.max(25, Number(auditLimit) || 25))
  if (!events.length) return '<div class="staff-governance-empty"><strong>Chưa có nhật ký hành động.</strong></div>'
  if (!filtered.length) return '<div class="staff-governance-empty"><strong>Không có sự kiện phù hợp với bộ lọc hiện tại.</strong></div>'
  return `
    <div class="staff-governance-audit-list">${filtered.slice(0, safeLimit).map((event) => `
      <article>
        <div><strong>${escapeHtml(getAuditActionLabel(event.action))}</strong><span>${escapeHtml(formatDateTime(event.createdAt))}</span></div>
        <p>${escapeHtml(getActorRoleLabel(event.actorRole))} · ${escapeHtml(getAuditTargetLabel(event.targetType))} · ${escapeHtml(getAuditOutcomeLabel(event.outcome))}</p>
        <small>${escapeHtml(getAuditReasonLabel(event.reasonCode))}</small>
      </article>`).join('')}</div>
    ${filtered.length > safeLimit && safeLimit < 100 ? '<button type="button" data-staff-governance-action="load-more-audit">Xem thêm</button>' : ''}
  `
}

function renderRetentionPanel({ access, staffMember, policy, requests, retention, state, storageHealthy }) {
  const canManagePolicy = hasStaffAdministrativeAction(access, 'retention-policy.manage')
  const canViewPolicy = hasStaffAdministrativeAction(access, 'retention-policy.view')
  const canCreateRequest = hasStaffAdministrativeAction(access, 'deletion-request.create')
  return `
    <div class="staff-governance-panel" data-staff-governance-panel="retention">
      <div class="staff-governance-panel-heading"><h5>Lưu trữ &amp; yêu cầu xóa</h5>
        ${storageHealthy && canManagePolicy && state.mode !== 'policy-form' ? '<button type="button" data-staff-governance-action="open-policy-form">Thiết lập chính sách lưu trữ</button>' : ''}
      </div>
      <div class="staff-governance-retention-summary">
        <div><span>Trạng thái làm việc</span><strong>${escapeHtml(getEmploymentLabel(staffMember.employmentStatus))}</strong></div>
        <div><span>Ngày kết thúc</span><strong>${escapeHtml(formatDate(staffMember.endDate))}</strong></div>
        <div><span>Trạng thái retention</span><strong>${escapeHtml(retention.label)}</strong></div>
        <div><span>Rà soát Hồ sơ hành chính</span><strong>${escapeHtml(formatDate(retention.profileReviewDate))}</strong></div>
        <div><span>Rà soát tài liệu</span><strong>${escapeHtml(formatDate(retention.documentReviewDate))}</strong></div>
      </div>
      ${canViewPolicy
        ? (!policy ? '<p class="staff-governance-notice">Chưa thiết lập chính sách lưu trữ.</p>' : renderPolicySummary(policy))
        : '<p class="staff-governance-notice">Chỉ Owner được xem cấu hình chi tiết của chính sách lưu trữ.</p>'}
      ${state.mode === 'policy-form' ? renderPolicyForm(state) : ''}
      <p class="staff-governance-legal-note">Chính sách này là cấu hình vận hành nội bộ, không thay thế tư vấn pháp lý.</p>
      <div class="staff-governance-request-heading"><h6>Yêu cầu xóa dữ liệu</h6>
        ${storageHealthy && canCreateRequest && state.mode !== 'request-form' ? '<button type="button" data-staff-governance-action="open-request-form">Tạo yêu cầu xóa</button>' : ''}
      </div>
      ${staffMember.employmentStatus === 'active' ? '<p class="staff-governance-notice is-warning">Nhân viên đang làm việc. Mọi yêu cầu phải có lý do thủ công rõ ràng; retention tự động không áp dụng.</p>' : ''}
      ${state.mode === 'request-form' ? renderDeletionRequestForm(state) : ''}
      ${state.mode === 'deny-form' ? renderDenyRequestForm(state) : ''}
      ${renderDeletionRequests(requests, access, storageHealthy)}
    </div>`
}

function renderPolicySummary(policy) {
  return `<div class="staff-governance-policy-summary">
    <span>Hồ sơ: ${policy.profileRetentionDaysAfterEmploymentEnd} ngày</span>
    <span>Tài liệu: ${policy.documentRetentionDaysAfterEmploymentEnd} ngày</span>
    <span>Chờ backend: ${policy.deletionReviewGraceDays} ngày</span>
    <span>${policy.enabled ? 'Đang áp dụng' : 'Đang tạm tắt'}</span>
  </div>`
}

function renderPolicyForm(state) {
  const values = state.values || createStaffAdministrativeRetentionPolicyDraft()
  const errors = state.errors || {}
  const field = (name, label) => `<label><span>${escapeHtml(label)}</span><input type="number" min="0" step="1" value="${escapeAttribute(values[name])}" data-staff-governance-field="${name}" aria-invalid="${Boolean(errors[name])}" />${errors[name] ? `<small>${escapeHtml(errors[name])}</small>` : ''}</label>`
  return `<form class="staff-governance-form" data-staff-governance-form="policy" novalidate>
    <div class="staff-governance-form-grid">
      ${field('profileRetentionDaysAfterEmploymentEnd', 'Số ngày giữ Hồ sơ hành chính sau ngày nghỉ việc')}
      ${field('documentRetentionDaysAfterEmploymentEnd', 'Số ngày giữ tài liệu sau ngày nghỉ việc')}
      ${field('deletionReviewGraceDays', 'Số ngày chờ sau phê duyệt')}
      <label class="staff-governance-checkbox"><input type="checkbox" data-staff-governance-field="enabled" ${values.enabled ? 'checked' : ''} /><span>Áp dụng policy</span></label>
    </div>
    <div class="staff-governance-form-actions"><button type="button" data-staff-governance-action="cancel-form">Hủy</button><button type="submit" ${state.isSaving ? 'disabled' : ''}>${state.isSaving ? 'Đang lưu…' : 'Lưu chính sách'}</button></div>
  </form>`
}

function renderDeletionRequestForm(state) {
  const values = state.values || createStaffAdministrativeDeletionRequestDraft()
  const errors = state.errors || {}
  return `<form class="staff-governance-form" data-staff-governance-form="request" novalidate>
    <div class="staff-governance-form-grid">
      <label><span>Phạm vi</span><select data-staff-governance-field="scope">${STAFF_ADMINISTRATIVE_DELETION_SCOPES.map(([key, label]) => `<option value="${key}" ${values.scope === key ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>${errors.scope ? `<small>${escapeHtml(errors.scope)}</small>` : ''}</label>
      <label><span>Lý do</span><select data-staff-governance-field="reasonCode">${STAFF_ADMINISTRATIVE_DELETION_REASONS.map(([key, label]) => `<option value="${key}" ${values.reasonCode === key ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>${errors.reasonCode ? `<small>${escapeHtml(errors.reasonCode)}</small>` : ''}</label>
      <label class="is-wide"><span>Ghi chú lý do</span><textarea rows="4" data-staff-governance-field="reasonNote">${escapeHtml(values.reasonNote)}</textarea><small>${errors.reasonNote ? escapeHtml(errors.reasonNote) : 'Không nhập số giấy tờ, tài khoản, địa chỉ, note hồ sơ hoặc metadata tài liệu thô.'}</small></label>
      <label class="staff-governance-checkbox is-wide"><input type="checkbox" data-staff-governance-field="confirmed" ${values.confirmed ? 'checked' : ''} /><span>Phase này chỉ tạo yêu cầu và không xóa dữ liệu ngay.</span>${errors.confirmed ? `<small>${escapeHtml(errors.confirmed)}</small>` : ''}</label>
    </div>
    <div class="staff-governance-form-actions"><button type="button" data-staff-governance-action="cancel-form">Hủy</button><button type="submit" ${state.isSaving ? 'disabled' : ''}>${state.isSaving ? 'Đang tạo…' : 'Tạo yêu cầu xóa'}</button></div>
  </form>`
}

function renderDenyRequestForm(state) {
  return `<form class="staff-governance-form" data-staff-governance-form="deny" novalidate>
    <label class="is-wide"><span>Ghi chú từ chối</span><textarea rows="3" data-staff-governance-field="reviewNote">${escapeHtml(state.values?.reviewNote || '')}</textarea>${state.errors?.reviewNote ? `<small>${escapeHtml(state.errors.reviewNote)}</small>` : ''}</label>
    <div class="staff-governance-form-actions"><button type="button" data-staff-governance-action="cancel-form">Hủy</button><button type="submit" ${state.isSaving ? 'disabled' : ''}>${state.isSaving ? 'Đang lưu…' : 'Từ chối yêu cầu'}</button></div>
  </form>`
}

function renderDeletionRequests(requests, access, storageHealthy) {
  if (!requests.length) return '<div class="staff-governance-empty"><strong>Chưa có yêu cầu xóa dữ liệu.</strong></div>'
  return `<div class="staff-governance-request-list">${[...requests]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .map((request) => {
      const isCreator = request.requestedByUserId === access.actorUserId && request.requestedByMembershipId === access.actorMembershipId
      const canCancel = storageHealthy && request.status === 'pending-review' && (access.role === 'owner' || (access.role === 'center_admin' && isCreator))
      const canReview = storageHealthy && request.status === 'pending-review' && access.role === 'owner' && !isCreator
      return `<article class="staff-governance-request-card">
        <div><strong>${escapeHtml(getStaffAdministrativeDeletionStatusLabel(request.status))}</strong><span>${escapeHtml(formatDateTime(request.requestedAt))}</span></div>
        <p>${escapeHtml(getDeletionScopeLabel(request.scope))} · ${escapeHtml(getDeletionReasonLabel(request.reasonCode))}</p>
        <p>${escapeHtml(request.reasonNote)}</p>
        <small>Người yêu cầu: ${escapeHtml(getActorRoleLabel(request.requestedByRole))}${request.reviewedAt ? ` · Người xem xét: ${escapeHtml(getActorRoleLabel(request.reviewedByRole))} lúc ${escapeHtml(formatDateTime(request.reviewedAt))}` : ''}</small>
        ${request.executionEligibleAt ? `<small>Có thể thực thi backend từ: ${escapeHtml(formatDateTime(request.executionEligibleAt))} · Chờ thực thi backend</small>` : ''}
        ${request.status === 'pending-review' && access.role === 'owner' && isCreator ? `<p class="staff-governance-separation">${STAFF_ADMINISTRATIVE_SEPARATION_MESSAGE}</p>` : ''}
        <div class="staff-governance-request-actions">
          ${canCancel ? `<button type="button" data-staff-governance-action="cancel-request" data-request-id="${escapeAttribute(request.id)}">Hủy yêu cầu</button>` : ''}
          ${canReview ? `<button type="button" data-staff-governance-action="approve-request" data-request-id="${escapeAttribute(request.id)}">Phê duyệt</button><button type="button" data-staff-governance-action="open-deny-form" data-request-id="${escapeAttribute(request.id)}">Từ chối</button>` : ''}
        </div>
      </article>`
    }).join('')}</div>`
}

function normalizeAuditFilters(filters = {}) {
  return {
    action: filters.action === 'all' || AUDIT_ACTION_SET.has(filters.action) ? filters.action : 'all',
    outcome: filters.outcome === 'all' || AUDIT_OUTCOME_SET.has(filters.outcome) ? filters.outcome : 'all',
  }
}

function getAuditActionLabel(action) {
  const attachmentGovernanceLabel = {
    staff_document_attachment_removed: 'Gỡ tệp khỏi tài liệu',
    staff_document_attachment_deletion_requested: 'Yêu cầu xóa vĩnh viễn tệp',
    staff_document_attachment_deletion_approved: 'Phê duyệt xóa vĩnh viễn tệp',
    staff_document_attachment_deletion_rejected: 'Từ chối xóa vĩnh viễn tệp',
    staff_document_attachment_deletion_canceled: 'Hủy yêu cầu xóa tệp',
    staff_document_attachment_deletion_execution_started: 'Bắt đầu thực thi xóa tệp',
    staff_document_attachment_deletion_completed: 'Hoàn tất xóa object tệp',
    staff_document_attachment_deletion_failed: 'Xóa tệp thất bại',
    staff_document_attachment_legal_hold_placed: 'Đặt legal hold cho tệp',
    staff_document_attachment_legal_hold_released: 'Giải phóng legal hold cho tệp',
  }[action]
  if (attachmentGovernanceLabel) return attachmentGovernanceLabel
  return {
    'administrative-profile.open': 'Mở Hồ sơ hành chính',
    'administrative-profile.reveal-sensitive': 'Reveal trường nhạy cảm',
    'administrative-profile.create': 'Tạo Hồ sơ hành chính',
    'administrative-profile.edit': 'Sửa Hồ sơ hành chính',
    'staff-document.create': 'Tạo tài liệu',
    'staff-document.edit': 'Sửa tài liệu',
    'staff-document.archive': 'Lưu trữ tài liệu',
    'staff-document.restore': 'Khôi phục tài liệu',
    'staff-document.attachment-upload-start': 'Bắt đầu tải tệp tài liệu',
    'staff-document.attachment-upload-success': 'Tải tệp tài liệu thành công',
    'staff-document.attachment-upload-failed': 'Tải tệp tài liệu thất bại',
    'staff-document.attachment-replacement-prepared': 'Chuẩn bị phiên bản tệp thay thế',
    'staff-document.attachment-replacement-completed': 'Thay tệp tài liệu thành công',
    'staff-document.attachment-replacement-failed': 'Thay tệp tài liệu thất bại',
    'staff-document.attachment-version-view': 'Xem phiên bản tệp tài liệu',
    'staff-document.attachment-version-download': 'Tải xuống phiên bản tệp tài liệu',
    'staff-document.attachment-view': 'Xem tệp tài liệu',
    'staff-document.attachment-download': 'Tải xuống tệp tài liệu',
    'retention-policy.update': 'Cập nhật chính sách lưu trữ',
    'deletion-request.create': 'Tạo yêu cầu xóa',
    'deletion-request.cancel': 'Hủy yêu cầu xóa',
    'deletion-request.approve': 'Phê duyệt yêu cầu xóa',
    'deletion-request.deny': 'Từ chối yêu cầu xóa',
  }[action] || 'Hành động cần kiểm tra'
}

function getAuditOutcomeLabel(outcome) {
  return {
    success: 'Thành công',
    denied: 'Bị từ chối',
    'validation-failed': 'Validation không đạt',
    stale: 'Dữ liệu đã thay đổi',
    cancelled: 'Đã hủy',
    failed: 'Thất bại',
  }[outcome] || 'Cần kiểm tra'
}

function getAuditTargetLabel(targetType) {
  return {
    'administrative-profile': 'Hồ sơ hành chính',
    'staff-document': 'Tài liệu nhân sự',
    'staff-document-attachment': 'Tệp tài liệu nhân sự',
    'retention-policy': 'Chính sách lưu trữ',
    'deletion-request': 'Yêu cầu xóa',
    'staff-member': 'Nhân viên',
  }[targetType] || 'Đối tượng quản trị'
}

function getAuditReasonLabel(reasonCode) {
  return {
    'explicit-open': 'Mở theo thao tác rõ ràng',
    'field-reveal': 'Reveal theo canonical field key',
    'explicit-save': 'Lưu theo thao tác rõ ràng',
    'explicit-archive': 'Lưu trữ theo thao tác rõ ràng',
    'explicit-restore': 'Khôi phục theo thao tác rõ ràng',
    'explicit-request': 'Yêu cầu được tạo rõ ràng',
    'explicit-cancel': 'Yêu cầu được hủy rõ ràng',
    'owner-approval': 'Owner phê duyệt',
    'owner-denial': 'Owner từ chối',
    'access-denied': 'Không đủ quyền theo action',
    'validation-failed': 'Dữ liệu nhập chưa hợp lệ',
    'stale-revision': 'Revision mới nhất không khớp',
    'attachment-upload-start': 'Bắt đầu lượt tải tệp rõ ràng',
    'attachment-upload-success': 'Backend xác nhận tệp sẵn sàng',
    'attachment-upload-failed': 'Lượt tải tệp chưa hoàn tất',
    'attachment-replacement-prepared': 'Backend đã tạo metadata phiên bản mới',
    'attachment-replacement-completed': 'Backend đã chuyển phiên bản mới thành hiện hành',
    'attachment-version-view': 'Yêu cầu URL xem phiên bản ngắn hạn',
    'attachment-version-download': 'Yêu cầu URL tải phiên bản ngắn hạn',
    'attachment-view': 'Yêu cầu URL xem ngắn hạn',
    'attachment-download': 'Yêu cầu URL tải xuống ngắn hạn',
  }[reasonCode] || 'Lý do hệ thống an toàn'
}

function getActorRoleLabel(role) {
  return { owner: 'Owner', center_admin: 'Quản trị viên cơ sở', teacher: 'Giáo viên', consultant: 'Tư vấn viên' }[normalizeRole(role)] || 'Vai trò không hợp lệ'
}

function getDeletionScopeLabel(scope) {
  return new Map(STAFF_ADMINISTRATIVE_DELETION_SCOPES).get(scope) || 'Phạm vi cần kiểm tra'
}

function getDeletionReasonLabel(reason) {
  return new Map(STAFF_ADMINISTRATIVE_DELETION_REASONS).get(reason) || 'Lý do cần kiểm tra'
}

function getEmploymentLabel(status) {
  return { active: 'Đang làm việc', 'on-leave': 'Tạm nghỉ', terminated: 'Đã nghỉ việc' }[status] || 'Chưa xác định'
}

function addDays(dateValue, days) {
  if (!isRealDate(dateValue) || !Number.isInteger(Number(days))) return ''
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + Number(days))).toISOString().slice(0, 10)
}

function addDaysToIsoDateTime(dateTime, days) {
  const parsed = new Date(dateTime)
  if (Number.isNaN(parsed.getTime()) || !Number.isInteger(Number(days))) return ''
  parsed.setUTCDate(parsed.getUTCDate() + Number(days))
  return parsed.toISOString()
}

function getTodayDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizeText(value))) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isIsoDateTime(value) {
  const date = new Date(value)
  return Boolean(value && !Number.isNaN(date.getTime()) && date.toISOString() === value)
}

function safeSerializedLength(value) {
  try {
    return JSON.stringify(value).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function containsForbiddenLocalPayload(value, seen = new Set()) {
  if (typeof value === 'string') {
    return /(?:data:[^,]*;base64,|blob:|https?:\/\/|x-amz-signature|\/object\/(?:sign|public)\/)/i.test(value)
  }
  if (!value || typeof value !== 'object') return false
  if (seen.has(value)) return true
  seen.add(value)
  const objectTag = Object.prototype.toString.call(value)
  if (['[object Blob]', '[object File]', '[object ArrayBuffer]'].includes(objectTag)) return true
  const forbiddenKey = /(?:attachment|filename|filedata|filecontent|blob|base64|binary|objecturl|signedurl|storagepath|bucket)/i
  return Object.entries(value).some(
    ([key, child]) => forbiddenKey.test(key) || containsForbiddenLocalPayload(child, seen),
  )
}

function formatDate(value) {
  const normalized = normalizeText(value)
  if (!isRealDate(normalized)) return 'Không áp dụng'
  const [year, month, day] = normalized.split('-')
  return `${day}/${month}/${year}`
}

function formatDateTime(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return 'Cần kiểm tra'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;')
}
