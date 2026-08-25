export const PARENT_FIRST_CAPABILITY_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
})

const BACKEND_UNAVAILABLE_CODES = new Set([
  '42P01',
  '42883',
  'PGRST202',
  'PGRST205',
  'CRM_RUNTIME_NOT_ACTIVE',
  'CRM_READ_NOT_ACTIVE',
  'LOOKUP_CONTROL_UNAVAILABLE',
])

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_CENTER_PATTERN = /^[A-Za-z0-9_-]{1,160}$/
const LINK_STATUSES = new Set(['ACTIVE', 'ENDED'])
const RELATIONSHIP_TYPES = new Set(['PARENT', 'LEGAL_GUARDIAN', 'CAREGIVER', 'EMERGENCY_CONTACT', 'OTHER_REVIEWED'])
const CONTACT_ROLES = new Set(['NONE', 'PRIMARY', 'SECONDARY'])

export function createParentFirstCapabilityState(overrides = {}) {
  return {
    centerId: '',
    status: PARENT_FIRST_CAPABILITY_STATUS.IDLE,
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    ...overrides,
  }
}

export function isParentFirstCapabilityReady(state = {}, centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return Boolean(
    normalizedCenterId
      && state.status === PARENT_FIRST_CAPABILITY_STATUS.READY
      && state.centerId === normalizedCenterId,
  )
}

export function isParentFirstBackendUnavailable(result = {}) {
  const code = cleanText(result.outcome_code || result.code).toUpperCase()
  const detail = `${cleanText(result.error)} ${cleanText(result.message)} ${cleanText(result.details)}`.toUpperCase()
  return BACKEND_UNAVAILABLE_CODES.has(code)
    || [...BACKEND_UNAVAILABLE_CODES].some((candidate) => detail.includes(candidate))
    || detail.includes('PH_1_LIST_PARENT_STUDENT_LINKS') && (detail.includes('NOT FIND') || detail.includes('NOT FOUND'))
}

export async function pullParentStudentLinks({ supabase, centerId, includeEnded = false } = {}) {
  const input = validateClientAndCenter(supabase, centerId)
  if (!input.ok) return input

  try {
    const { data, error } = await supabase.rpc('ph_1_list_parent_student_links', {
      p_center_id: input.centerId,
      p_include_ended: Boolean(includeEnded),
    })
    if (error) return rpcFailure(error)
    if (
      !data?.ok
      || data.outcome_code !== 'PARENT_STUDENT_LINKS_READ'
      || data.center_id !== input.centerId
      || !Array.isArray(data.links)
    ) {
      return failure('INVALID_SERVER_RESULT', getParentFirstOutcomeMessage('INVALID_SERVER_RESULT'))
    }

    const links = data.links.map(projectParentStudentLink)
    if (links.some((link) => !link)) {
      return failure('INVALID_SERVER_RESULT', getParentFirstOutcomeMessage('INVALID_SERVER_RESULT'))
    }

    return {
      ok: true,
      outcome_code: data.outcome_code,
      centerId: input.centerId,
      links,
      readAt: cleanText(data.read_at),
    }
  } catch (error) {
    return rpcFailure(error)
  }
}

export async function createParentStudentLink({
  supabase,
  centerId,
  linkId,
  contactId,
  studentId,
  relationshipType = 'PARENT',
  isPrimaryContact = true,
  financialContactRole = 'PRIMARY',
  academicContactRole = 'PRIMARY',
  idempotencyKey,
} = {}) {
  return mutateParentFirst(supabase, centerId, 'ph_1_create_parent_student_link', {
    p_center_id: centerId,
    p_link_id: requireUuid(linkId),
    p_crm_contact_id: requireUuid(contactId),
    p_student_local_id: requireSafeId(studentId),
    p_relationship_type: requireEnum(relationshipType, RELATIONSHIP_TYPES),
    p_is_primary_contact: Boolean(isPrimaryContact),
    p_financial_contact_role: requireEnum(financialContactRole, CONTACT_ROLES),
    p_academic_contact_role: requireEnum(academicContactRole, CONTACT_ROLES),
    p_idempotency_key: requireUuid(idempotencyKey),
  })
}

export async function updateParentStudentLink({
  supabase,
  centerId,
  linkId,
  expectedVersion,
  relationshipType,
  isPrimaryContact,
  financialContactRole,
  academicContactRole,
  idempotencyKey,
} = {}) {
  return mutateParentFirst(supabase, centerId, 'ph_1_update_parent_student_link', {
    p_center_id: centerId,
    p_link_id: requireUuid(linkId),
    p_expected_link_version: requireVersion(expectedVersion),
    p_relationship_type: requireEnum(relationshipType, RELATIONSHIP_TYPES),
    p_is_primary_contact: Boolean(isPrimaryContact),
    p_financial_contact_role: requireEnum(financialContactRole, CONTACT_ROLES),
    p_academic_contact_role: requireEnum(academicContactRole, CONTACT_ROLES),
    p_idempotency_key: requireUuid(idempotencyKey),
  })
}

export async function endParentStudentLink({
  supabase,
  centerId,
  linkId,
  expectedVersion,
  reasonCode = 'OPERATOR_UNLINKED',
  idempotencyKey,
} = {}) {
  return mutateParentFirst(supabase, centerId, 'ph_1_end_parent_student_link', {
    p_center_id: centerId,
    p_link_id: requireUuid(linkId),
    p_expected_link_version: requireVersion(expectedVersion),
    p_safe_reason_code: requireReasonCode(reasonCode),
    p_idempotency_key: requireUuid(idempotencyKey),
  })
}

export async function updateProtectedContactIdentity({
  supabase,
  centerId,
  contactId,
  expectedVersion,
  displayName,
  phones = [],
  emails = [],
  idempotencyKey,
} = {}) {
  const normalizedName = cleanText(displayName)
  const normalizedPhones = normalizeStringArray(phones)
  const normalizedEmails = normalizeStringArray(emails)
  if (!normalizedName || normalizedName.length > 240 || (!normalizedPhones.length && !normalizedEmails.length)) {
    return failure('INVALID_COMMAND', getParentFirstOutcomeMessage('INVALID_COMMAND'))
  }
  return mutateParentFirst(supabase, centerId, 'ph_1_update_crm_contact_identity', {
    p_center_id: centerId,
    p_crm_contact_id: requireUuid(contactId),
    p_expected_contact_version: requireVersion(expectedVersion),
    p_display_name: normalizedName,
    p_phones: normalizedPhones,
    p_emails: normalizedEmails,
    p_idempotency_key: requireUuid(idempotencyKey),
  })
}

export function projectParentStudentLink(row = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const linkId = cleanText(row.link_id)
  const contactId = cleanText(row.crm_contact_id)
  const studentId = cleanText(row.student_local_id)
  const linkVersion = Number(row.link_version)
  const contactVersion = Number(row.contact_version)
  const studentEntityVersion = Number(row.student_entity_version)
  const linkStatus = cleanText(row.link_status).toUpperCase()
  const relationshipType = cleanText(row.relationship_type).toUpperCase()
  const financialContactRole = cleanText(row.financial_contact_role).toUpperCase()
  const academicContactRole = cleanText(row.academic_contact_role).toUpperCase()
  if (
    !UUID_PATTERN.test(linkId)
    || !UUID_PATTERN.test(contactId)
    || !studentId
    || studentId.length > 200
    || !Number.isSafeInteger(linkVersion)
    || linkVersion < 1
    || !Number.isSafeInteger(contactVersion)
    || contactVersion < 1
    || !Number.isSafeInteger(studentEntityVersion)
    || studentEntityVersion < 1
    || !LINK_STATUSES.has(linkStatus)
    || !RELATIONSHIP_TYPES.has(relationshipType)
    || !CONTACT_ROLES.has(financialContactRole)
    || !CONTACT_ROLES.has(academicContactRole)
    || typeof row.contact_identity_available !== 'boolean'
    || typeof row.student_available !== 'boolean'
  ) return null

  return {
    linkId,
    linkVersion,
    linkStatus,
    relationshipType,
    isPrimaryContact: Boolean(row.is_primary_contact),
    financialContactRole,
    academicContactRole,
    endedReasonCode: cleanText(row.ended_reason_code),
    endedAt: cleanText(row.ended_at),
    contactId,
    contactVersion,
    contactStatus: cleanText(row.contact_status),
    contactDisplayName: cleanText(row.contact_display_name),
    contactPhones: normalizeStringArray(row.contact_phones),
    contactEmails: normalizeStringArray(row.contact_emails),
    contactIdentityAvailable: row.contact_identity_available,
    studentId,
    studentAvailable: row.student_available,
    studentEntityVersion,
    studentUpdatedAt: cleanText(row.student_updated_at),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

export function getParentFirstOutcomeMessage(outcomeCode = '') {
  const messages = {
    BACKEND_NOT_DEPLOYED: 'Hồ sơ Phụ huynh / Tư vấn hiện chưa khả dụng.',
    CLIENT_NOT_READY: 'Chưa thể kết nối để tải hồ sơ phụ huynh.',
    INVALID_CENTER: 'Chưa xác định được cơ sở đang hoạt động.',
    INVALID_COMMAND: 'Thông tin cần lưu chưa đầy đủ hoặc chưa hợp lệ.',
    INVALID_SERVER_RESULT: 'Dữ liệu phụ huynh trả về chưa hợp lệ; thông tin cũ đã được ẩn.',
    CENTER_ACCESS_DENIED: 'Tài khoản không có quyền xem dữ liệu của cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Tài khoản hiện tại không được phép thay đổi hồ sơ phụ huynh.',
    STUDENT_NOT_FOUND_OR_STALE: 'Học viên không còn ở trạng thái hiện tại. Hãy làm mới và chọn lại.',
    CONTACT_NOT_FOUND: 'Không tìm thấy hồ sơ phụ huynh cần cập nhật.',
    CONTACT_IDENTITY_UPDATE_UNSUPPORTED: 'Hồ sơ liên hệ này chưa hỗ trợ cập nhật thông tin bảo vệ.',
    CONTACT_VERSION_STALE: 'Thông tin liên hệ đã được người khác cập nhật. Hãy làm mới trước khi lưu lại.',
    LINK_VERSION_STALE: 'Liên kết học viên đã thay đổi. Hãy làm mới trước khi lưu lại.',
    LINK_NOT_FOUND_OR_ENDED: 'Liên kết này không còn hoạt động.',
    LINK_COLLISION_REVIEW_REQUIRED: 'Học viên hoặc phụ huynh đã có liên kết tương tự. Hãy kiểm tra trước khi ghép.',
    CONTACT_IDENTITY_COLLISION_REVIEW_REQUIRED: 'Số điện thoại hoặc email trùng với hồ sơ khác. Hãy kiểm tra trước khi lưu.',
    CONTACT_IDENTITY_REACTIVATION_REVIEW_REQUIRED: 'Thông tin này từng thuộc hồ sơ khác. Cần kiểm tra trước khi dùng lại.',
    IDEMPOTENCY_CONFLICT: 'Lần thử lại không còn khớp với thao tác ban đầu. Hãy làm mới và thực hiện lại.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đã thay đổi; kết quả từ cơ sở trước không được hiển thị.',
    PARENT_STUDENT_LINKS_READ_FAILED: 'Dữ liệu phụ huynh hiện chưa tải được. Vui lòng thử lại.',
    SERVER_COMMAND_FAILED: 'Chưa thể lưu thay đổi. Nội dung đang nhập vẫn được giữ nguyên.',
  }
  return messages[cleanText(outcomeCode).toUpperCase()] || messages.SERVER_COMMAND_FAILED
}

async function mutateParentFirst(supabase, centerId, rpcName, params) {
  const input = validateClientAndCenter(supabase, centerId)
  if (!input.ok) return input
  try {
    const { data, error } = await supabase.rpc(rpcName, { ...params, p_center_id: input.centerId })
    if (error) return rpcFailure(error)
    if (!data?.ok || data.outcome_code !== 'COMMITTED') {
      const outcomeCode = cleanText(data?.outcome_code || 'INVALID_SERVER_RESULT')
      return failure(outcomeCode, getParentFirstOutcomeMessage(outcomeCode), data)
    }
    return { ...data, ok: true }
  } catch (error) {
    return rpcFailure(error)
  }
}

function validateClientAndCenter(supabase, centerId) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', getParentFirstOutcomeMessage('CLIENT_NOT_READY'))
  }
  const normalizedCenterId = cleanText(centerId)
  if (!SAFE_CENTER_PATTERN.test(normalizedCenterId)) {
    return failure('INVALID_CENTER', getParentFirstOutcomeMessage('INVALID_CENTER'))
  }
  return { ok: true, centerId: normalizedCenterId }
}

function rpcFailure(error) {
  const outcomeCode = extractOutcomeCode(error)
  const unavailable = isParentFirstBackendUnavailable({
    outcome_code: outcomeCode,
    error: error?.message,
    details: error?.details,
  })
  const finalCode = unavailable ? 'BACKEND_NOT_DEPLOYED' : outcomeCode
  return failure(finalCode, getParentFirstOutcomeMessage(finalCode), error)
}

function extractOutcomeCode(error = {}) {
  const values = [error.code, error.message, error.details, error.hint]
    .map((value) => cleanText(value))
    .filter(Boolean)
  const knownCodes = [
    ...BACKEND_UNAVAILABLE_CODES,
    'CENTER_ACCESS_DENIED',
    'WRITE_ROLE_REQUIRED',
    'STUDENT_NOT_FOUND_OR_STALE',
    'CONTACT_NOT_FOUND',
    'CONTACT_IDENTITY_UPDATE_UNSUPPORTED',
    'CONTACT_VERSION_STALE',
    'LINK_VERSION_STALE',
    'LINK_NOT_FOUND_OR_ENDED',
    'LINK_COLLISION_REVIEW_REQUIRED',
    'CONTACT_IDENTITY_COLLISION_REVIEW_REQUIRED',
    'CONTACT_IDENTITY_REACTIVATION_REVIEW_REQUIRED',
    'IDEMPOTENCY_CONFLICT',
  ]
  const upperText = values.join(' ').toUpperCase()
  return knownCodes.find((code) => upperText.includes(code)) || cleanText(error.code) || 'SERVER_COMMAND_FAILED'
}

function failure(outcomeCode, error, detail = null) {
  return { ok: false, outcome_code: outcomeCode, error, detail }
}

function requireUuid(value) {
  const normalized = cleanText(value)
  if (!UUID_PATTERN.test(normalized)) throw new Error(getParentFirstOutcomeMessage('INVALID_COMMAND'))
  return normalized
}

function requireVersion(value) {
  const version = Number(value)
  if (!Number.isSafeInteger(version) || version < 1) throw new Error(getParentFirstOutcomeMessage('INVALID_COMMAND'))
  return version
}

function requireEnum(value, allowed) {
  const normalized = cleanText(value).toUpperCase()
  if (!allowed.has(normalized)) throw new Error(getParentFirstOutcomeMessage('INVALID_COMMAND'))
  return normalized
}

function requireSafeId(value) {
  const normalized = cleanText(value)
  if (!normalized || normalized.length > 200 || /[\x00-\x1f\x7f]/.test(normalized)) {
    throw new Error(getParentFirstOutcomeMessage('INVALID_COMMAND'))
  }
  return normalized
}

function requireReasonCode(value) {
  const normalized = cleanText(value).toUpperCase()
  if (!/^[A-Z0-9_]{1,80}$/.test(normalized)) throw new Error(getParentFirstOutcomeMessage('INVALID_COMMAND'))
  return normalized
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(cleanText).filter(Boolean))]
}

function cleanText(value) {
  return String(value ?? '').trim()
}
