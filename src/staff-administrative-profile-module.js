export const STAFF_ADMINISTRATIVE_PROFILE_SCHEMA_VERSION = 1
export const STAFF_ADMINISTRATIVE_PROFILE_CHECKLIST_VERSION = 'f23.11b-v1'
export const STAFF_ADMINISTRATIVE_PROFILE_ACCESS_DENIED_MESSAGE =
  'Bạn không có quyền truy cập Hồ sơ hành chính.'

const COMPLETION_STATUSES = new Set(['incomplete', 'complete', 'needs-review'])
const ADMINISTRATIVE_ROLES = new Set(['owner', 'center_admin'])
const SENSITIVE_FIELD_PATHS = new Set([
  'identityDocument.number',
  'taxInformation.taxNumber',
  'insuranceInformation.socialInsuranceNumber',
  'insuranceInformation.healthInsuranceNumber',
  'bankInformation.accountNumber',
  'employmentAdministration.contractNumber',
])

const ADDRESS_FIELDS = [
  'addressLine',
  'wardOrCommune',
  'district',
  'provinceOrCity',
  'country',
]
const EMERGENCY_CONTACT_FIELDS = ['name', 'phone', 'relationship']
const IDENTITY_DOCUMENT_FIELDS = ['type', 'number', 'issuedDate', 'issuedPlace', 'expiryDate']
const TAX_INFORMATION_FIELDS = ['taxNumber', 'registeredDate', 'registeredPlace']
const INSURANCE_INFORMATION_FIELDS = ['socialInsuranceNumber', 'healthInsuranceNumber']
const BANK_INFORMATION_FIELDS = ['bankName', 'accountNumber', 'accountHolderName', 'branch']
const EMPLOYMENT_ADMINISTRATION_FIELDS = [
  'contractNumber',
  'contractType',
  'signedDate',
  'effectiveDate',
  'expiryDate',
  'signingEntity',
  'note',
]
const COMPLETION_REVIEW_FIELDS = [
  'reviewedAt',
  'reviewedBy',
  'reviewedByLabel',
  'checklistVersion',
]

const EMPTY_PROFILE_VALUES = Object.freeze({
  legalFullName: '',
  dateOfBirth: '',
  gender: '',
  nationality: '',
  permanentAddress: Object.freeze(createEmptyObject(ADDRESS_FIELDS)),
  currentAddress: Object.freeze(createEmptyObject(ADDRESS_FIELDS)),
  emergencyContact: Object.freeze(createEmptyObject(EMERGENCY_CONTACT_FIELDS)),
  identityDocument: Object.freeze(createEmptyObject(IDENTITY_DOCUMENT_FIELDS)),
  taxInformation: Object.freeze(createEmptyObject(TAX_INFORMATION_FIELDS)),
  insuranceInformation: Object.freeze(createEmptyObject(INSURANCE_INFORMATION_FIELDS)),
  bankInformation: Object.freeze(createEmptyObject(BANK_INFORMATION_FIELDS)),
  employmentAdministration: Object.freeze(createEmptyObject(EMPLOYMENT_ADMINISTRATION_FIELDS)),
  note: '',
})

function createEmptyObject(fields) {
  return Object.fromEntries(fields.map((field) => [field, '']))
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeRole(role) {
  const normalized = normalizeText(role).toLowerCase().replace(/[\s-]+/g, '_')
  return normalized === 'admin' ? 'center_admin' : normalized
}

function normalizeNestedObject(value, fields, path, issues) {
  if (value === undefined || value === null) {
    return createEmptyObject(fields)
  }

  if (!isPlainObject(value)) {
    issues.push(`${path}:malformed-nested-value`)
    return value
  }

  return {
    ...value,
    ...Object.fromEntries(fields.map((field) => [field, normalizeText(value[field])])),
  }
}

function attachNormalizationIssues(record, issues) {
  Object.defineProperty(record, '__normalizationIssues', {
    configurable: true,
    enumerable: false,
    value: [...issues],
    writable: false,
  })
  return record
}

export function normalizeStaffAdministrativeProfile(profile, { currentCenterId = '' } = {}) {
  if (!isPlainObject(profile)) {
    return null
  }

  const issues = []
  const explicitCenterId = normalizeText(profile.centerId)
  const scopedCenterId = normalizeText(currentCenterId)
  const centerId = explicitCenterId || scopedCenterId
  const normalized = {
    ...profile,
    id: normalizeText(profile.id),
    schemaVersion: Number(profile.schemaVersion),
    centerId,
    staffMemberId: normalizeText(profile.staffMemberId),
    legalFullName: normalizeText(profile.legalFullName),
    dateOfBirth: normalizeText(profile.dateOfBirth),
    gender: normalizeText(profile.gender),
    nationality: normalizeText(profile.nationality),
    permanentAddress: normalizeNestedObject(
      profile.permanentAddress,
      ADDRESS_FIELDS,
      'permanentAddress',
      issues,
    ),
    currentAddress: normalizeNestedObject(
      profile.currentAddress,
      ADDRESS_FIELDS,
      'currentAddress',
      issues,
    ),
    emergencyContact: normalizeNestedObject(
      profile.emergencyContact,
      EMERGENCY_CONTACT_FIELDS,
      'emergencyContact',
      issues,
    ),
    identityDocument: normalizeNestedObject(
      profile.identityDocument,
      IDENTITY_DOCUMENT_FIELDS,
      'identityDocument',
      issues,
    ),
    taxInformation: normalizeNestedObject(
      profile.taxInformation,
      TAX_INFORMATION_FIELDS,
      'taxInformation',
      issues,
    ),
    insuranceInformation: normalizeNestedObject(
      profile.insuranceInformation,
      INSURANCE_INFORMATION_FIELDS,
      'insuranceInformation',
      issues,
    ),
    bankInformation: normalizeNestedObject(
      profile.bankInformation,
      BANK_INFORMATION_FIELDS,
      'bankInformation',
      issues,
    ),
    employmentAdministration: normalizeNestedObject(
      profile.employmentAdministration,
      EMPLOYMENT_ADMINISTRATION_FIELDS,
      'employmentAdministration',
      issues,
    ),
    note: normalizeText(profile.note),
    completionStatus: COMPLETION_STATUSES.has(profile.completionStatus)
      ? profile.completionStatus
      : 'incomplete',
    completionReview: normalizeNestedObject(
      profile.completionReview,
      COMPLETION_REVIEW_FIELDS,
      'completionReview',
      issues,
    ),
    createdAt: normalizeText(profile.createdAt),
    updatedAt: normalizeText(profile.updatedAt),
    archivedAt: normalizeText(profile.archivedAt),
    revision: Number(profile.revision),
  }

  if (!explicitCenterId && !scopedCenterId) {
    issues.push('centerId:missing')
  }
  if (explicitCenterId && scopedCenterId && explicitCenterId !== scopedCenterId) {
    issues.push('centerId:mismatch')
  }
  if (profile.completionStatus && !COMPLETION_STATUSES.has(profile.completionStatus)) {
    issues.push('completionStatus:invalid')
  }

  return attachNormalizationIssues(normalized, issues)
}

export function normalizeStaffAdministrativeProfiles(profiles, options = {}) {
  return (Array.isArray(profiles) ? profiles : [])
    .map((profile) => normalizeStaffAdministrativeProfile(profile, options))
    .filter(Boolean)
}

export function getStaffAdministrativeProfileIntegrityIssues(profile, { currentCenterId = '' } = {}) {
  if (!isPlainObject(profile)) {
    return ['profile:not-plain-object']
  }

  const issues = [...(profile.__normalizationIssues || [])]
  const centerId = normalizeText(profile.centerId)
  const scopedCenterId = normalizeText(currentCenterId)

  if (!normalizeText(profile.id)) issues.push('id:missing')
  if (!normalizeText(profile.staffMemberId)) issues.push('staffMemberId:missing')
  if (!centerId) issues.push('centerId:missing')
  if (centerId && scopedCenterId && centerId !== scopedCenterId) issues.push('centerId:mismatch')
  if (Number(profile.schemaVersion) !== STAFF_ADMINISTRATIVE_PROFILE_SCHEMA_VERSION) {
    issues.push('schemaVersion:unsupported')
  }
  if (!Number.isInteger(Number(profile.revision)) || Number(profile.revision) < 1) {
    issues.push('revision:invalid')
  }
  if (!isIsoDateTime(profile.createdAt)) issues.push('createdAt:invalid')
  if (!isIsoDateTime(profile.updatedAt)) issues.push('updatedAt:invalid')
  if (profile.archivedAt && !isIsoDateTime(profile.archivedAt)) issues.push('archivedAt:invalid')
  if (
    profile.completionStatus === 'complete' &&
    (
      !isIsoDateTime(profile.completionReview?.reviewedAt) ||
      !normalizeText(profile.completionReview?.reviewedBy) ||
      profile.completionReview?.checklistVersion !== STAFF_ADMINISTRATIVE_PROFILE_CHECKLIST_VERSION
    )
  ) {
    issues.push('completionReview:incoherent')
  }

  return [...new Set(issues)]
}

export function getStaffAdministrativeProfileCollectionIssues(profiles, currentCenterId) {
  const issues = []
  const profileIds = new Map()
  const staffLinks = new Map()

  ;(Array.isArray(profiles) ? profiles : []).forEach((profile, index) => {
    getStaffAdministrativeProfileIntegrityIssues(profile, { currentCenterId }).forEach((issue) => {
      issues.push(`${index}:${issue}`)
    })

    const profileId = normalizeText(profile?.id)
    const staffMemberId = normalizeText(profile?.staffMemberId)
    const centerId = normalizeText(profile?.centerId)
    if (profileId) profileIds.set(profileId, (profileIds.get(profileId) || 0) + 1)
    if (centerId && staffMemberId) {
      const linkKey = `${centerId}:${staffMemberId}`
      staffLinks.set(linkKey, (staffLinks.get(linkKey) || 0) + 1)
    }
  })

  profileIds.forEach((count, profileId) => {
    if (count > 1) issues.push(`profileId:${profileId}:duplicate`)
  })
  staffLinks.forEach((count, linkKey) => {
    if (count > 1) issues.push(`staffLink:${linkKey}:duplicate`)
  })

  return issues
}

export function resolveStaffAdministrativeProfileForStaff(
  profiles,
  staffMemberId,
  currentCenterId,
) {
  const stableStaffMemberId = normalizeText(staffMemberId)
  const centerId = normalizeText(currentCenterId)
  const candidates = (Array.isArray(profiles) ? profiles : []).filter(
    (profile) => normalizeText(profile?.staffMemberId) === stableStaffMemberId,
  )
  const sameCenterCandidates = candidates.filter(
    (profile) => normalizeText(profile?.centerId) === centerId,
  )

  if (!stableStaffMemberId || !centerId) {
    return { status: 'malformed', profile: null, candidates, issues: ['scope:missing'] }
  }
  if (candidates.length !== sameCenterCandidates.length) {
    return { status: 'malformed', profile: null, candidates, issues: ['centerId:mismatch'] }
  }
  if (sameCenterCandidates.length > 1) {
    return { status: 'duplicate', profile: null, candidates, issues: ['one-to-one:duplicate'] }
  }
  if (!sameCenterCandidates.length) {
    return { status: 'not-created', profile: null, candidates: [], issues: [] }
  }

  const profile = sameCenterCandidates[0]
  const issues = getStaffAdministrativeProfileIntegrityIssues(profile, { currentCenterId: centerId })
  if (issues.length) {
    return { status: 'malformed', profile: null, candidates: sameCenterCandidates, issues }
  }

  return {
    status: profile.archivedAt ? 'archived' : profile.completionStatus,
    profile,
    candidates: sameCenterCandidates,
    issues: [],
  }
}

export function getStaffAdministrativeProfileListStatus(profiles, staffMember, currentCenterId) {
  const lookup = resolveStaffAdministrativeProfileForStaff(
    profiles,
    staffMember?.id,
    currentCenterId,
  )

  if (lookup.status === 'not-created') return { label: 'Chưa tạo', tone: 'not-created' }
  if (lookup.status === 'incomplete') return { label: 'Chưa hoàn thiện', tone: 'incomplete' }
  if (lookup.status === 'complete') return { label: 'Đã hoàn thiện', tone: 'complete' }
  if (lookup.status === 'archived') return { label: 'Đã lưu trữ', tone: 'archived' }
  return { label: 'Cần kiểm tra', tone: 'needs-review' }
}

export function resolveStaffAdministrativeProfileAccess({ user, binding, storageCenterId } = {}) {
  const userId = normalizeText(user?.id)
  const centerId = normalizeText(binding?.currentCenterId)
  const localCenterId = normalizeText(storageCenterId)
  const membership = binding?.membership
  const membershipCenterId = normalizeText(membership?.center_id || membership?.centerId)
  const membershipUserId = normalizeText(membership?.user_id || membership?.userId)
  const role = normalizeRole(membership?.role)

  if (!userId || binding?.status !== 'bound' || !isPlainObject(membership)) {
    return denyAccess('membership-missing')
  }
  if (!centerId || !localCenterId || centerId !== localCenterId) {
    return denyAccess('center-mismatch')
  }
  if (membershipCenterId !== centerId || (membershipUserId && membershipUserId !== userId)) {
    return denyAccess('membership-malformed')
  }
  if (normalizeText(membership.status).toLowerCase() !== 'active') {
    return denyAccess('membership-inactive')
  }
  if (!ADMINISTRATIVE_ROLES.has(role)) {
    return denyAccess('role-denied')
  }

  return { ok: true, centerId, role, membership, error: '', reason: '' }
}

function denyAccess(reason) {
  return {
    ok: false,
    centerId: '',
    role: '',
    membership: null,
    error: STAFF_ADMINISTRATIVE_PROFILE_ACCESS_DENIED_MESSAGE,
    reason,
  }
}

export function createStaffAdministrativeProfileId(now = Date.now()) {
  const randomPart = Math.random().toString(36).slice(2, 9)
  return `admin-profile-${now}-${randomPart}`
}

export function createStaffAdministrativeProfileDraft(staffMember = null) {
  return {
    ...cloneProfileValues(EMPTY_PROFILE_VALUES),
    legalFullName: normalizeText(staffMember?.fullName),
  }
}

export function createEditStaffAdministrativeProfileDraft(profile) {
  return cloneProfileValues(profile || EMPTY_PROFILE_VALUES)
}

function cloneProfileValues(source) {
  return {
    legalFullName: normalizeText(source?.legalFullName),
    dateOfBirth: normalizeText(source?.dateOfBirth),
    gender: normalizeText(source?.gender),
    nationality: normalizeText(source?.nationality),
    permanentAddress: cloneNestedValues(source?.permanentAddress, ADDRESS_FIELDS),
    currentAddress: cloneNestedValues(source?.currentAddress, ADDRESS_FIELDS),
    emergencyContact: cloneNestedValues(source?.emergencyContact, EMERGENCY_CONTACT_FIELDS),
    identityDocument: cloneNestedValues(source?.identityDocument, IDENTITY_DOCUMENT_FIELDS),
    taxInformation: cloneNestedValues(source?.taxInformation, TAX_INFORMATION_FIELDS),
    insuranceInformation: cloneNestedValues(source?.insuranceInformation, INSURANCE_INFORMATION_FIELDS),
    bankInformation: cloneNestedValues(source?.bankInformation, BANK_INFORMATION_FIELDS),
    employmentAdministration: cloneNestedValues(
      source?.employmentAdministration,
      EMPLOYMENT_ADMINISTRATION_FIELDS,
    ),
    note: normalizeText(source?.note),
  }
}

function cloneNestedValues(value, fields) {
  if (!isPlainObject(value)) {
    return createEmptyObject(fields)
  }
  return {
    ...value,
    ...Object.fromEntries(fields.map((field) => [field, normalizeText(value[field])])),
  }
}

export function setStaffAdministrativeProfileDraftValue(values, fieldPath, value) {
  const path = normalizeText(fieldPath).split('.').filter(Boolean)
  if (!path.length || path.length > 2) {
    return values
  }

  if (path.length === 1) {
    return { ...values, [path[0]]: String(value ?? '') }
  }

  const [section, field] = path
  return {
    ...values,
    [section]: {
      ...(isPlainObject(values?.[section]) ? values[section] : {}),
      [field]: String(value ?? ''),
    },
  }
}

export function validateStaffAdministrativeProfile(values, { today = getTodayDate() } = {}) {
  const errors = {}
  const checkText = (path, maxLength, label, minLength = 0) => {
    const value = getPathValue(values, path)
    if (value && value.length < minLength) errors[path] = `${label} cần ít nhất ${minLength} ký tự.`
    if (value.length > maxLength) errors[path] = `${label} không được quá ${maxLength} ký tự.`
  }
  const checkDate = (path, label, { notFuture = false } = {}) => {
    const value = getPathValue(values, path)
    if (!value) return
    if (!isRealDate(value)) errors[path] = `${label} phải là ngày hợp lệ.`
    else if (notFuture && value > today) errors[path] = `${label} không được sau ngày hiện tại.`
  }

  checkText('legalFullName', 200, 'Tên pháp lý')
  checkText('nationality', 100, 'Quốc tịch')
  ;['permanentAddress', 'currentAddress'].forEach((section) => {
    ADDRESS_FIELDS.forEach((field) => checkText(`${section}.${field}`, 300, 'Địa chỉ'))
  })
  checkText('emergencyContact.name', 200, 'Tên người liên hệ')
  checkText('emergencyContact.phone', 30, 'Số điện thoại', 6)
  checkText('emergencyContact.relationship', 100, 'Mối quan hệ')
  IDENTITY_DOCUMENT_FIELDS.filter((field) => !field.toLowerCase().includes('date')).forEach((field) =>
    checkText(`identityDocument.${field}`, field === 'number' ? 64 : 200, 'Thông tin giấy tờ'),
  )
  checkText('taxInformation.taxNumber', 64, 'Mã số thuế')
  checkText('taxInformation.registeredPlace', 200, 'Nơi đăng ký thuế')
  INSURANCE_INFORMATION_FIELDS.forEach((field) =>
    checkText(`insuranceInformation.${field}`, 64, 'Mã bảo hiểm'),
  )
  BANK_INFORMATION_FIELDS.forEach((field) =>
    checkText(`bankInformation.${field}`, field === 'accountNumber' ? 64 : 200, 'Thông tin ngân hàng'),
  )
  EMPLOYMENT_ADMINISTRATION_FIELDS.forEach((field) =>
    checkText(
      `employmentAdministration.${field}`,
      field === 'note' ? 2000 : field === 'contractNumber' ? 120 : 200,
      'Thông tin hợp đồng',
    ),
  )
  checkText('note', 2000, 'Ghi chú')

  checkDate('dateOfBirth', 'Ngày sinh', { notFuture: true })
  checkDate('identityDocument.issuedDate', 'Ngày cấp', { notFuture: true })
  checkDate('identityDocument.expiryDate', 'Ngày hết hạn')
  checkDate('taxInformation.registeredDate', 'Ngày đăng ký thuế', { notFuture: true })
  checkDate('employmentAdministration.signedDate', 'Ngày ký', { notFuture: true })
  checkDate('employmentAdministration.effectiveDate', 'Ngày hiệu lực')
  checkDate('employmentAdministration.expiryDate', 'Ngày hết hạn hợp đồng')
  checkDateOrder(
    values,
    errors,
    'identityDocument.issuedDate',
    'identityDocument.expiryDate',
    'Ngày cấp không được sau ngày hết hạn.',
  )
  checkDateOrder(
    values,
    errors,
    'employmentAdministration.signedDate',
    'employmentAdministration.effectiveDate',
    'Ngày ký không được sau ngày hiệu lực.',
  )
  checkDateOrder(
    values,
    errors,
    'employmentAdministration.effectiveDate',
    'employmentAdministration.expiryDate',
    'Ngày hiệu lực không được sau ngày hết hạn hợp đồng.',
  )

  return errors
}

function checkDateOrder(values, errors, startPath, endPath, message) {
  const start = getPathValue(values, startPath)
  const end = getPathValue(values, endPath)
  if (isRealDate(start) && isRealDate(end) && start > end) {
    errors[endPath] = message
  }
}

export function getStaffAdministrativeCompletionChecklist(profile) {
  const checks = [
    ['legalFullName', 'Tên pháp lý', Boolean(getPathValue(profile, 'legalFullName'))],
    ['dateOfBirth', 'Ngày sinh', isRealDate(getPathValue(profile, 'dateOfBirth'))],
    [
      'currentAddress',
      'Địa chỉ hiện tại',
      Boolean(
        getPathValue(profile, 'currentAddress.addressLine') &&
          getPathValue(profile, 'currentAddress.provinceOrCity'),
      ),
    ],
    [
      'emergencyContact',
      'Liên hệ khẩn cấp',
      Boolean(
        getPathValue(profile, 'emergencyContact.name') &&
          getPathValue(profile, 'emergencyContact.phone') &&
          getPathValue(profile, 'emergencyContact.relationship'),
      ),
    ],
  ]

  return {
    complete: checks.every(([, , done]) => done),
    items: checks.map(([key, label, done]) => ({ key, label, done })),
  }
}

export function buildStaffAdministrativeProfileFromDraft(
  values,
  existingProfile,
  { centerId, staffMemberId, now = new Date().toISOString(), profileId = '' } = {},
) {
  const draft = cloneProfileValues(values)
  const previous = existingProfile || null
  const next = {
    ...(previous || {}),
    ...draft,
    permanentAddress: mergeNested(previous?.permanentAddress, draft.permanentAddress),
    currentAddress: mergeNested(previous?.currentAddress, draft.currentAddress),
    emergencyContact: mergeNested(previous?.emergencyContact, draft.emergencyContact),
    identityDocument: mergeNested(previous?.identityDocument, draft.identityDocument),
    taxInformation: mergeNested(previous?.taxInformation, draft.taxInformation),
    insuranceInformation: mergeNested(previous?.insuranceInformation, draft.insuranceInformation),
    bankInformation: mergeNested(previous?.bankInformation, draft.bankInformation),
    employmentAdministration: mergeNested(
      previous?.employmentAdministration,
      draft.employmentAdministration,
    ),
    id: normalizeText(previous?.id || profileId),
    schemaVersion: STAFF_ADMINISTRATIVE_PROFILE_SCHEMA_VERSION,
    centerId: normalizeText(centerId),
    staffMemberId: normalizeText(staffMemberId),
    completionStatus: previous?.completionStatus || 'incomplete',
    completionReview: mergeNested(
      previous?.completionReview,
      previous?.completionReview || createEmptyObject(COMPLETION_REVIEW_FIELDS),
    ),
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    archivedAt: normalizeText(previous?.archivedAt),
    revision: previous ? Number(previous.revision) + 1 : 1,
  }

  if (previous?.completionStatus === 'complete' && didReviewedDataChange(previous, next)) {
    next.completionStatus = 'needs-review'
    next.completionReview = {
      ...(isPlainObject(previous.completionReview) ? previous.completionReview : {}),
      reviewedAt: '',
      reviewedBy: '',
      reviewedByLabel: '',
      checklistVersion: STAFF_ADMINISTRATIVE_PROFILE_CHECKLIST_VERSION,
    }
  }

  return next
}

function mergeNested(previous, next) {
  return {
    ...(isPlainObject(previous) ? previous : {}),
    ...(isPlainObject(next) ? next : {}),
  }
}

function didReviewedDataChange(previous, next) {
  const reviewedFields = [
    'legalFullName',
    'dateOfBirth',
    'currentAddress',
    'emergencyContact',
    'identityDocument',
    'taxInformation',
    'insuranceInformation',
    'bankInformation',
    'employmentAdministration',
    'note',
  ]
  return reviewedFields.some(
    (field) => JSON.stringify(previous?.[field] ?? '') !== JSON.stringify(next?.[field] ?? ''),
  )
}

export function markStaffAdministrativeProfileReviewed(
  profile,
  { reviewedBy, reviewedByLabel = '', now = new Date().toISOString() } = {},
) {
  const actorId = normalizeText(reviewedBy)
  if (
    !actorId ||
    !getStaffAdministrativeCompletionChecklist(profile).complete ||
    Object.keys(validateStaffAdministrativeProfile(profile)).length
  ) {
    return null
  }

  return {
    ...profile,
    completionStatus: 'complete',
    completionReview: {
      ...(isPlainObject(profile.completionReview) ? profile.completionReview : {}),
      reviewedAt: now,
      reviewedBy: actorId,
      reviewedByLabel: normalizeText(reviewedByLabel),
      checklistVersion: STAFF_ADMINISTRATIVE_PROFILE_CHECKLIST_VERSION,
    },
    updatedAt: now,
    revision: Number(profile.revision) + 1,
  }
}

export function isStaffAdministrativeSensitiveField(fieldPath) {
  return SENSITIVE_FIELD_PATHS.has(normalizeText(fieldPath))
}

export function getStaffAdministrativeSensitiveValue(profile, fieldPath) {
  if (!isStaffAdministrativeSensitiveField(fieldPath)) return ''
  return normalizeSensitiveDisplayText(getPathValue(profile, fieldPath))
}

export function toggleStaffAdministrativeRevealedField(revealedFields, fieldPath) {
  const nextFields = new Set(
    revealedFields instanceof Set
      ? Array.from(revealedFields).filter(isStaffAdministrativeSensitiveField)
      : [],
  )

  if (!isStaffAdministrativeSensitiveField(fieldPath)) {
    return nextFields
  }
  if (nextFields.has(fieldPath)) nextFields.delete(fieldPath)
  else nextFields.add(fieldPath)
  return nextFields
}

export function getStaffAdministrativeRevealedFieldsForProfile(state, profile) {
  if (
    !profile ||
    normalizeText(state?.centerId) !== normalizeText(profile.centerId) ||
    normalizeText(state?.profileId) !== normalizeText(profile.id)
  ) {
    return new Set()
  }

  return new Set(
    state?.revealedFields instanceof Set
      ? Array.from(state.revealedFields).filter(isStaffAdministrativeSensitiveField)
      : [],
  )
}

export function maskStaffAdministrativeValue(value) {
  const normalized = normalizeSensitiveDisplayText(value)
  if (!normalized) return 'Chưa cập nhật'
  if (normalized.length <= 4) return '••••'
  const suffix = normalized.slice(-4)
  return `•••• ${suffix}`
}

function normalizeSensitiveDisplayText(value) {
  if (value === null || value === undefined || typeof value === 'object') return ''
  const normalized = String(value).trim()
  if (['undefined', 'null', '[object object]'].includes(normalized.toLowerCase())) return ''
  return normalized
}

export function getStaffAdministrativeWindowTitle(staffMember) {
  const identity = [normalizeText(staffMember?.employeeCode), normalizeText(staffMember?.fullName)]
    .filter(Boolean)
    .join(' · ')
  return identity ? `Hồ sơ hành chính · ${identity}` : 'Hồ sơ hành chính'
}

export function renderStaffAdministrativeProfileWindow({
  windowId,
  staffMember,
  departmentName = '',
  lookup,
  state = {},
  accessAllowed = false,
} = {}) {
  if (!accessAllowed) {
    return renderAdministrativeSafeState(STAFF_ADMINISTRATIVE_PROFILE_ACCESS_DENIED_MESSAGE)
  }
  if (!staffMember || !lookup) {
    return renderAdministrativeSafeState('Không tìm thấy duy nhất một hồ sơ Nhân viên trong cơ sở hiện tại.')
  }
  if (['malformed', 'duplicate'].includes(lookup.status)) {
    return renderAdministrativeSafeState(
      'Dữ liệu hồ sơ hành chính cần được kiểm tra. Hệ thống đã khóa chỉnh sửa để tránh ghi đè sai.',
    )
  }

  const isArchivedStaff = Boolean(staffMember.archivedAt)
  const profile = lookup.profile
  const isFormMode = ['create', 'edit'].includes(state.mode)
  const content = isFormMode
    ? renderAdministrativeForm({ windowId, state, staffMember, isArchivedStaff })
    : renderAdministrativeOverview({ windowId, profile, lookup, state, staffMember, isArchivedStaff })
  const completionLabel = getAdministrativeStatusLabel(lookup.status)
  const employmentLabel = getEmploymentStatusLabel(staffMember.employmentStatus)

  return `
    <section class="staff-administrative-profile-window" aria-label="Hồ sơ hành chính">
      <header class="staff-administrative-header">
        <div>
          <span class="staff-administrative-eyebrow">Hồ sơ hành chính riêng</span>
          <h3>${escapeHtml(staffMember.employeeCode || 'Nhân viên')} · ${escapeHtml(staffMember.fullName || 'Chưa có tên')}</h3>
          <p>${escapeHtml([
            departmentName || 'Chưa có phòng ban',
            staffMember.positionTitle || 'Chưa có chức danh',
            employmentLabel,
            staffMember.archivedAt ? 'Đã lưu trữ' : 'Đang sử dụng',
            `Hồ sơ hành chính: ${completionLabel}`,
          ].join(' · '))}</p>
        </div>
        ${renderAdministrativeHeaderActions({ windowId, profile, lookup, state, isArchivedStaff })}
      </header>
      ${
        isArchivedStaff
          ? '<p class="staff-administrative-banner is-warning" role="status">Hồ sơ Nhân viên đã lưu trữ. Hồ sơ hành chính chỉ đọc; hãy khôi phục Nhân viên trước khi chỉnh sửa.</p>'
          : ''
      }
      <div class="staff-administrative-workspace">
        ${renderAdministrativeNavigation(windowId)}
        <main
          class="staff-administrative-content-scroll"
          data-preserve-scroll-key="${escapeAttribute(`${windowId}:${staffMember.id}`)}"
          tabindex="-1"
        >
          ${state.message ? `<p class="staff-administrative-message" role="status">${escapeHtml(state.message)}</p>` : ''}
          ${content}
        </main>
      </div>
    </section>
  `
}

function renderAdministrativeSafeState(message) {
  return `
    <section class="staff-administrative-profile-window is-safe-state" aria-label="Hồ sơ hành chính">
      <div class="staff-administrative-safe-state" role="alert">
        <h3>Hồ sơ hành chính</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    </section>
  `
}

function renderAdministrativeHeaderActions({ windowId, profile, lookup, state, isArchivedStaff }) {
  if (['create', 'edit'].includes(state.mode)) {
    return `
      <div class="staff-administrative-header-actions">
        <button type="button" data-staff-administrative-action="cancel-edit" data-window-id="${escapeAttribute(windowId)}">Hủy</button>
        <button type="submit" form="${escapeAttribute(windowId)}-staff-administrative-form" ${state.isSaving ? 'disabled' : ''}>${state.isSaving ? 'Đang lưu…' : state.mode === 'create' ? 'Tạo hồ sơ' : 'Lưu hồ sơ'}</button>
      </div>
    `
  }
  if (!profile) {
    return isArchivedStaff
      ? ''
      : `<button type="button" data-staff-administrative-action="start-create" data-window-id="${escapeAttribute(windowId)}">Tạo hồ sơ hành chính</button>`
  }

  const checklist = getStaffAdministrativeCompletionChecklist(profile)
  return `
    <div class="staff-administrative-header-actions">
      <button type="button" data-staff-administrative-action="start-edit" data-window-id="${escapeAttribute(windowId)}" ${isArchivedStaff ? 'disabled' : ''}>Chỉnh sửa</button>
      <button
        type="button"
        data-staff-administrative-action="mark-reviewed"
        data-window-id="${escapeAttribute(windowId)}"
        ${isArchivedStaff || !checklist.complete || lookup.status === 'complete' || state.isSaving ? 'disabled' : ''}
      >Đánh dấu đã kiểm tra</button>
    </div>
  `
}

function renderAdministrativeNavigation(windowId) {
  const sections = [
    ['overview', 'Tổng quan'],
    ['personal', 'Thông tin cá nhân'],
    ['addresses', 'Địa chỉ'],
    ['emergency', 'Liên hệ khẩn cấp'],
    ['identity', 'Giấy tờ'],
    ['tax-insurance', 'Thuế & bảo hiểm'],
    ['bank', 'Ngân hàng'],
    ['contract', 'Hợp đồng'],
    ['notes', 'Ghi chú & kiểm tra'],
  ]
  return `
    <nav class="staff-administrative-navigation" aria-label="Mục hồ sơ hành chính">
      ${sections.map(([section, label]) => `
        <button
          type="button"
          data-staff-administrative-action="navigate"
          data-section-id="${escapeAttribute(`${windowId}-${section}`)}"
        >${escapeHtml(label)}</button>
      `).join('')}
    </nav>
  `
}

function renderAdministrativeOverview({ windowId, profile, lookup, state, staffMember, isArchivedStaff }) {
  if (!profile) {
    return `
      <div class="staff-administrative-empty">
        <h4>Chưa có Hồ sơ hành chính.</h4>
        <p>Hồ sơ này tách khỏi dữ liệu vận hành, có thể chứa dữ liệu nhạy cảm và chỉ người có quyền mới được truy cập. Việc mở cửa sổ không tự ghi local storage.</p>
        ${isArchivedStaff ? '' : `<button type="button" data-staff-administrative-action="start-create" data-window-id="${escapeAttribute(windowId)}">Tạo hồ sơ hành chính</button>`}
      </div>
    `
  }

  const revealedFields = getStaffAdministrativeRevealedFieldsForProfile(state, profile)
  return `
    ${renderViewSection(windowId, 'overview', 'Tổng quan', [
      renderViewField('Mức độ hoàn thiện', getAdministrativeStatusLabel(lookup.status)),
      renderViewField('Cập nhật lúc', profile.updatedAt),
      renderViewField('Trạng thái làm việc', getEmploymentStatusLabel(staffMember?.employmentStatus)),
      renderViewField('Lưu trữ Nhân viên', staffMember?.archivedAt ? 'Đã lưu trữ' : 'Không'),
      renderCompletionCard(profile, lookup.status),
    ])}
    ${renderViewSection(windowId, 'personal', 'Thông tin cá nhân', [
      renderViewField('Họ tên theo giấy tờ', profile.legalFullName),
      renderViewField('Ngày sinh', profile.dateOfBirth),
      renderViewField('Giới tính/xưng hô', profile.gender || 'Reserved — phase này không thu thập'),
      renderViewField('Quốc tịch', profile.nationality),
    ])}
    ${renderViewSection(windowId, 'addresses', 'Địa chỉ', [
      renderAddressView('Địa chỉ thường trú', profile.permanentAddress),
      renderAddressView('Địa chỉ hiện tại', profile.currentAddress),
    ])}
    ${renderViewSection(windowId, 'emergency', 'Liên hệ khẩn cấp', [
      renderViewField('Họ tên', getPathValue(profile, 'emergencyContact.name')),
      renderViewField('Điện thoại', getPathValue(profile, 'emergencyContact.phone')),
      renderViewField('Mối quan hệ', getPathValue(profile, 'emergencyContact.relationship')),
    ])}
    ${renderViewSection(windowId, 'identity', 'Giấy tờ tùy thân', [
      renderViewField('Loại giấy tờ', getPathValue(profile, 'identityDocument.type')),
      renderSensitiveViewField(windowId, profile, 'identityDocument.number', 'Số giấy tờ', revealedFields),
      renderViewField('Ngày cấp', getPathValue(profile, 'identityDocument.issuedDate')),
      renderViewField('Nơi cấp', getPathValue(profile, 'identityDocument.issuedPlace')),
      renderViewField('Ngày hết hạn', getPathValue(profile, 'identityDocument.expiryDate')),
    ])}
    ${renderViewSection(windowId, 'tax-insurance', 'Thuế và bảo hiểm', [
      renderSensitiveViewField(windowId, profile, 'taxInformation.taxNumber', 'Mã số thuế', revealedFields),
      renderViewField('Ngày đăng ký thuế', getPathValue(profile, 'taxInformation.registeredDate')),
      renderViewField('Nơi đăng ký thuế', getPathValue(profile, 'taxInformation.registeredPlace')),
      renderSensitiveViewField(windowId, profile, 'insuranceInformation.socialInsuranceNumber', 'Số BHXH', revealedFields),
      renderSensitiveViewField(windowId, profile, 'insuranceInformation.healthInsuranceNumber', 'Số BHYT', revealedFields),
    ])}
    ${renderViewSection(windowId, 'bank', 'Tài khoản ngân hàng', [
      renderViewField('Ngân hàng', getPathValue(profile, 'bankInformation.bankName')),
      renderSensitiveViewField(windowId, profile, 'bankInformation.accountNumber', 'Số tài khoản', revealedFields),
      renderViewField('Chủ tài khoản', getPathValue(profile, 'bankInformation.accountHolderName')),
      renderViewField('Chi nhánh', getPathValue(profile, 'bankInformation.branch')),
    ])}
    ${renderViewSection(windowId, 'contract', 'Hành chính hợp đồng', [
      renderSensitiveViewField(windowId, profile, 'employmentAdministration.contractNumber', 'Số hợp đồng', revealedFields),
      renderViewField('Loại hợp đồng', getPathValue(profile, 'employmentAdministration.contractType')),
      renderViewField('Ngày ký', getPathValue(profile, 'employmentAdministration.signedDate')),
      renderViewField('Ngày hiệu lực', getPathValue(profile, 'employmentAdministration.effectiveDate')),
      renderViewField('Ngày hết hạn', getPathValue(profile, 'employmentAdministration.expiryDate')),
      renderViewField('Đơn vị ký', getPathValue(profile, 'employmentAdministration.signingEntity')),
      renderViewField('Ghi chú hợp đồng', getPathValue(profile, 'employmentAdministration.note'), true),
    ])}
    ${renderViewSection(windowId, 'notes', 'Ghi chú và mức độ hoàn thiện', [
      renderViewField('Ghi chú hành chính', profile.note, true),
    ])}
  `
}

function renderAdministrativeForm({ windowId, state, isArchivedStaff }) {
  if (isArchivedStaff) {
    return '<p class="staff-administrative-message" role="alert">Không thể sửa khi hồ sơ Nhân viên đã lưu trữ.</p>'
  }
  const values = cloneProfileValues(state.values || EMPTY_PROFILE_VALUES)
  const errors = state.errors || {}
  const revealedFields = state.revealedFields instanceof Set ? state.revealedFields : new Set()
  const formId = `${windowId}-staff-administrative-form`

  return `
    <form id="${escapeAttribute(formId)}" class="staff-administrative-form" data-staff-administrative-form autocomplete="off" novalidate>
      ${renderFormSection(windowId, 'personal', 'Thông tin cá nhân', [
        renderFormField('legalFullName', 'Họ tên theo giấy tờ', values, errors),
        renderFormField('dateOfBirth', 'Ngày sinh', values, errors, 'date'),
        '<div class="staff-administrative-reserved-field"><span>Giới tính/xưng hô</span><p>Reserved — phase này không thu thập hoặc tự suy diễn.</p></div>',
        renderFormField('nationality', 'Quốc tịch', values, errors),
      ])}
      ${renderFormSection(windowId, 'addresses', 'Địa chỉ thường trú', renderAddressFormFields('permanentAddress', values, errors))}
      ${renderFormSection(windowId, 'addresses-current', 'Địa chỉ hiện tại', renderAddressFormFields('currentAddress', values, errors))}
      ${renderFormSection(windowId, 'emergency', 'Liên hệ khẩn cấp', [
        renderFormField('emergencyContact.name', 'Họ tên', values, errors),
        renderFormField('emergencyContact.phone', 'Điện thoại', values, errors, 'tel'),
        renderFormField('emergencyContact.relationship', 'Mối quan hệ', values, errors),
      ])}
      ${renderFormSection(windowId, 'identity', 'Giấy tờ tùy thân', [
        renderFormField('identityDocument.type', 'Loại giấy tờ', values, errors),
        renderFormField('identityDocument.number', 'Số giấy tờ', values, errors, 'text', revealedFields),
        renderFormField('identityDocument.issuedDate', 'Ngày cấp', values, errors, 'date'),
        renderFormField('identityDocument.issuedPlace', 'Nơi cấp', values, errors),
        renderFormField('identityDocument.expiryDate', 'Ngày hết hạn', values, errors, 'date'),
      ])}
      ${renderFormSection(windowId, 'tax-insurance', 'Thuế và bảo hiểm', [
        renderFormField('taxInformation.taxNumber', 'Mã số thuế', values, errors, 'text', revealedFields),
        renderFormField('taxInformation.registeredDate', 'Ngày đăng ký thuế', values, errors, 'date'),
        renderFormField('taxInformation.registeredPlace', 'Nơi đăng ký thuế', values, errors),
        renderFormField('insuranceInformation.socialInsuranceNumber', 'Số BHXH', values, errors, 'text', revealedFields),
        renderFormField('insuranceInformation.healthInsuranceNumber', 'Số BHYT', values, errors, 'text', revealedFields),
      ])}
      ${renderFormSection(windowId, 'bank', 'Tài khoản ngân hàng', [
        renderFormField('bankInformation.bankName', 'Ngân hàng', values, errors),
        renderFormField('bankInformation.accountNumber', 'Số tài khoản', values, errors, 'text', revealedFields),
        renderFormField('bankInformation.accountHolderName', 'Chủ tài khoản', values, errors),
        renderFormField('bankInformation.branch', 'Chi nhánh', values, errors),
      ])}
      ${renderFormSection(windowId, 'contract', 'Hành chính hợp đồng', [
        renderFormField('employmentAdministration.contractNumber', 'Số hợp đồng', values, errors, 'text', revealedFields),
        renderFormField('employmentAdministration.contractType', 'Loại hợp đồng', values, errors),
        renderFormField('employmentAdministration.signedDate', 'Ngày ký', values, errors, 'date'),
        renderFormField('employmentAdministration.effectiveDate', 'Ngày hiệu lực', values, errors, 'date'),
        renderFormField('employmentAdministration.expiryDate', 'Ngày hết hạn', values, errors, 'date'),
        renderFormField('employmentAdministration.signingEntity', 'Đơn vị ký', values, errors),
        renderFormField('employmentAdministration.note', 'Ghi chú hợp đồng', values, errors, 'textarea'),
      ])}
      ${renderFormSection(windowId, 'notes', 'Ghi chú hành chính', [
        renderFormField('note', 'Ghi chú', values, errors, 'textarea'),
      ])}
      ${errors.form ? `<p class="staff-administrative-message" role="alert">${escapeHtml(errors.form)}</p>` : ''}
      <div class="staff-administrative-form-actions">
        <button type="button" data-staff-administrative-action="cancel-edit">Hủy</button>
        <button type="submit" ${state.isSaving ? 'disabled' : ''}>${state.isSaving ? 'Đang lưu…' : state.mode === 'create' ? 'Tạo hồ sơ' : 'Lưu hồ sơ'}</button>
      </div>
    </form>
  `
}

function renderViewSection(windowId, section, title, fields) {
  return `
    <section class="staff-administrative-section" id="${escapeAttribute(`${windowId}-${section}`)}">
      <h4>${escapeHtml(title)}</h4>
      <div class="staff-administrative-view-grid">${fields.join('')}</div>
    </section>
  `
}

function renderFormSection(windowId, section, title, fields) {
  return `
    <section class="staff-administrative-section" id="${escapeAttribute(`${windowId}-${section}`)}">
      <h4>${escapeHtml(title)}</h4>
      <div class="staff-administrative-form-grid">${fields.join('')}</div>
    </section>
  `
}

function renderViewField(label, value, wide = false) {
  return `
    <div class="staff-administrative-view-field ${wide ? 'is-wide' : ''}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(normalizeText(value) || '—')}</strong>
    </div>
  `
}

function renderSensitiveViewField(windowId, profile, fieldPath, label, revealedFields) {
  const value = getPathValue(profile, fieldPath)
  const revealed = revealedFields.has(fieldPath)
  return `
    <div class="staff-administrative-view-field is-sensitive">
      <span>${escapeHtml(label)}</span>
      <div class="staff-administrative-sensitive-control">
        <strong data-staff-administrative-sensitive-value="${escapeAttribute(fieldPath)}">${escapeHtml(revealed && value ? value : maskStaffAdministrativeValue(value))}</strong>
        ${value ? `<button type="button" data-staff-administrative-action="toggle-sensitive" data-sensitive-field="${escapeAttribute(fieldPath)}" data-window-id="${escapeAttribute(windowId)}" aria-pressed="${revealed}">${revealed ? 'Ẩn' : 'Hiện'}</button>` : ''}
      </div>
    </div>
  `
}

function renderAddressView(label, address) {
  const value = ADDRESS_FIELDS.map((field) => getPathValue(address, field)).filter(Boolean).join(', ')
  return renderViewField(label, value, true)
}

function renderAddressFormFields(section, values, errors) {
  const labels = {
    addressLine: 'Địa chỉ',
    wardOrCommune: 'Phường/xã',
    district: 'Quận/huyện',
    provinceOrCity: 'Tỉnh/thành phố',
    country: 'Quốc gia',
  }
  return ADDRESS_FIELDS.map((field) =>
    renderFormField(`${section}.${field}`, labels[field], values, errors),
  )
}

function renderFormField(fieldPath, label, values, errors, type = 'text', revealedFields = new Set()) {
  const value = getPathValue(values, fieldPath)
  const error = errors[fieldPath]
  const sensitive = isStaffAdministrativeSensitiveField(fieldPath)
  const revealed = sensitive && revealedFields.has(fieldPath)
  const inputType = sensitive && !revealed ? 'password' : type
  const control = type === 'textarea'
    ? `<textarea rows="4" data-staff-administrative-field="${escapeAttribute(fieldPath)}" aria-invalid="${Boolean(error)}">${escapeHtml(value)}</textarea>`
    : `<input type="${escapeAttribute(inputType)}" value="${escapeAttribute(value)}" data-staff-administrative-field="${escapeAttribute(fieldPath)}" autocomplete="off" ${sensitive ? 'spellcheck="false"' : ''} aria-invalid="${Boolean(error)}" />`

  return `
    <label class="staff-administrative-form-field ${type === 'textarea' ? 'is-wide' : ''}">
      <span>${escapeHtml(label)}</span>
      <div class="staff-administrative-input-row">
        ${control}
        ${sensitive && value ? `<button type="button" data-staff-administrative-action="toggle-sensitive" data-sensitive-field="${escapeAttribute(fieldPath)}" aria-pressed="${revealed}">${revealed ? 'Ẩn' : 'Hiện'}</button>` : ''}
      </div>
      ${error ? `<small class="staff-administrative-field-error">${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderCompletionCard(profile, status) {
  const checklist = getStaffAdministrativeCompletionChecklist(profile)
  const statusLabels = {
    incomplete: 'Chưa hoàn thiện',
    complete: 'Đã hoàn thiện',
    'needs-review': 'Cần kiểm tra',
    archived: 'Đã lưu trữ',
  }
  return `
    <div class="staff-administrative-completion-card is-wide">
      <div><span>Trạng thái</span><strong>${escapeHtml(statusLabels[status] || 'Cần kiểm tra')}</strong></div>
      <ul>
        ${checklist.items.map((item) => `<li class="${item.done ? 'is-done' : ''}">${item.done ? '✓' : '○'} ${escapeHtml(item.label)}</li>`).join('')}
      </ul>
    </div>
  `
}

function getAdministrativeStatusLabel(status) {
  const labels = {
    'not-created': 'Chưa tạo',
    incomplete: 'Chưa hoàn thiện',
    complete: 'Đã hoàn thiện',
    'needs-review': 'Cần kiểm tra',
    archived: 'Đã lưu trữ',
    malformed: 'Cần kiểm tra',
    duplicate: 'Cần kiểm tra',
  }
  return labels[status] || 'Cần kiểm tra'
}

function getEmploymentStatusLabel(status) {
  const labels = {
    active: 'Đang làm việc',
    'on-leave': 'Tạm nghỉ',
    terminated: 'Đã nghỉ việc',
  }
  return labels[status] || 'Chưa xác định'
}

function getPathValue(source, fieldPath) {
  return normalizeText(
    normalizeText(fieldPath)
      .split('.')
      .filter(Boolean)
      .reduce((value, field) => (value && typeof value === 'object' ? value[field] : ''), source),
  )
}

function isRealDate(value) {
  const normalized = normalizeText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false
  const date = new Date(`${normalized}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized
}

function isIsoDateTime(value) {
  const normalized = normalizeText(value)
  if (!normalized) return false
  const date = new Date(normalized)
  return !Number.isNaN(date.getTime()) && date.toISOString() === normalized
}

function getTodayDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
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
  return escapeHtml(value)
}
