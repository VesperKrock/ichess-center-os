import {
  getStaffAdministrativeAuditCollectionIssues,
  getStaffAdministrativeDeletionRequestCollectionIssues,
  getStaffAdministrativeRetentionPolicyIssues,
  normalizeStaffAdministrativeAuditEvents,
  normalizeStaffAdministrativeDeletionRequests,
  normalizeStaffAdministrativeRetentionPolicy,
} from './staff-administrative-governance-module.js'
import {
  getStaffAdministrativeProfileCollectionIssues,
  normalizeStaffAdministrativeProfiles,
} from './staff-administrative-profile-module.js'
import {
  getStaffDocumentCollectionIssues,
  getStaffDocumentRelationshipIssues,
  normalizeStaffDocuments,
} from './staff-documents-module.js'

export const C55_STAFF_HR_SHARED_TRUTH_SOURCE_VERSION =
  'c5.5-staff-hr-authoritative-shared-truth-v1'

export const C55_STAFF_HR_CAPABILITY_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
})

const C55_BACKEND_UNAVAILABLE_CODES = new Set([
  '42P01',
  '42883',
  'PGRST202',
  'PGRST205',
  'BACKEND_NOT_DEPLOYED',
  'SCHEMA_NOT_READY',
])

const WRITE_ROLES = new Set(['owner', 'center_admin'])
const ENTITY_TYPES = new Set([
  'department',
  'staff_member',
  'administrative_profile',
  'staff_document',
  'retention_policy',
  'deletion_request',
])

export function createC55StaffHrCapabilityState(overrides = {}) {
  return {
    centerId: '',
    status: C55_STAFF_HR_CAPABILITY_STATUS.IDLE,
    isLoading: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    ...overrides,
  }
}

export function isC55StaffHrCapabilityReady(state = {}, centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return Boolean(
    normalizedCenterId
      && state.status === C55_STAFF_HR_CAPABILITY_STATUS.READY
      && state.centerId === normalizedCenterId,
  )
}

export function isC55StaffHrBackendUnavailable(result = {}) {
  const code = cleanText(result.outcome_code || result.code).toUpperCase()
  const detail = [
    result.error,
    result.message,
    result.details,
    result.hint,
    result.detail?.code,
    result.detail?.message,
    result.detail?.details,
    result.detail?.hint,
  ].map(cleanText).join(' ').toUpperCase()
  return C55_BACKEND_UNAVAILABLE_CODES.has(code)
    || [...C55_BACKEND_UNAVAILABLE_CODES].some((candidate) => detail.includes(candidate))
    || (
      detail.includes('C5_5_LIST_STAFF_HR_SHARED_TRUTH')
      && (detail.includes('NOT FIND') || detail.includes('NOT FOUND'))
    )
}

export function createC55StaffHrIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không hỗ trợ crypto.randomUUID cho lệnh Staff/HR C5.5.')
  }
  return globalThis.crypto.randomUUID()
}

export function canWriteC55StaffHrSharedTruth(accessState = {}) {
  const role = normalizeRole(accessState?.role || accessState?.membership?.role)
  const canWrite = Boolean(accessState?.canWrite !== false && WRITE_ROLES.has(role))
  return {
    ok: canWrite,
    canWrite,
    role,
    error: canWrite
      ? ''
      : 'Vai trò hiện tại không được ghi Staff/HR; dữ liệu chưa được lưu.',
  }
}

export async function pullC55StaffHrSharedTruth({ supabase, centerId } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY')
  }
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER')

  try {
    const { data, error } = await supabase.rpc('c5_5_list_staff_hr_shared_truth', {
      p_center_id: normalizedCenterId,
    })
    if (error) return failure('STAFF_HR_SHARED_TRUTH_READ_FAILED', error)
    if (!data?.ok || data.outcome_code !== 'AUTHORITATIVE_SNAPSHOT'
      || String(data.center_id || '') !== normalizedCenterId
      || !Array.isArray(data.departments)
      || !Array.isArray(data.staff_members)
      || !Array.isArray(data.administrative_profiles)
      || !Array.isArray(data.documents)
      || !Array.isArray(data.deletion_requests)
      || !Array.isArray(data.audit_events)) {
      return failure(String(data?.outcome_code || 'INVALID_SERVER_RESULT'), data)
    }

    const departments = projectScopedCollection(data.departments, normalizedCenterId)
    const staffMembers = projectScopedCollection(data.staff_members, normalizedCenterId)
    const administrativeProfiles = normalizeStaffAdministrativeProfiles(
      projectScopedCollection(data.administrative_profiles, normalizedCenterId),
      { currentCenterId: normalizedCenterId },
    )
    const documents = normalizeStaffDocuments(
      projectScopedCollection(data.documents, normalizedCenterId),
      { currentCenterId: normalizedCenterId },
    )
    const deletionRequests = normalizeStaffAdministrativeDeletionRequests(
      projectScopedCollection(data.deletion_requests, normalizedCenterId),
      { currentCenterId: normalizedCenterId },
    )
    const auditEvents = normalizeStaffAdministrativeAuditEvents(
      projectScopedAuditCollection(data.audit_events, normalizedCenterId),
      { currentCenterId: normalizedCenterId },
    )
    const retentionPolicy = data.retention_policy
      ? normalizeStaffAdministrativeRetentionPolicy(
          projectScopedEntity(data.retention_policy, normalizedCenterId),
          { currentCenterId: normalizedCenterId },
        )
      : null

    const profileIssues = getStaffAdministrativeProfileCollectionIssues(
        administrativeProfiles,
        normalizedCenterId,
      )
    const documentIssues = getStaffDocumentCollectionIssues(documents, normalizedCenterId)
    const relationshipIssues = getStaffDocumentRelationshipIssues(documents, {
        centerId: normalizedCenterId,
        staffMembers,
        administrativeProfiles,
      })
    const deletionIssues = getStaffAdministrativeDeletionRequestCollectionIssues(
        deletionRequests,
        normalizedCenterId,
      )
    const auditIssues = getStaffAdministrativeAuditCollectionIssues(auditEvents, normalizedCenterId)
    const retentionIssues = retentionPolicy
      ? getStaffAdministrativeRetentionPolicyIssues(retentionPolicy, normalizedCenterId)
      : []
    const countMismatch = departments.length !== data.departments.length
      || staffMembers.length !== data.staff_members.length
      || administrativeProfiles.length !== data.administrative_profiles.length
      || documents.length !== data.documents.length
      || deletionRequests.length !== data.deletion_requests.length
      || auditEvents.length !== data.audit_events.length
      || (data.retention_policy !== null && !retentionPolicy)
    const invalidProjection = countMismatch
      || profileIssues.length > 0
      || !administrativeProfiles.every((profile) => profile.sensitiveFieldsWithheld === true)
      || documentIssues.length > 0
      || relationshipIssues.length > 0
      || deletionIssues.length > 0
      || auditIssues.length > 0
      || retentionIssues.length > 0
      || !hasUniqueIds(departments)
      || !hasUniqueIds(staffMembers)
      || !staffMembers.every(isValidStaffMemberProjection)
      || !departments.every(isValidDepartmentProjection)

    if (invalidProjection) {
      return failure('INVALID_SERVER_RESULT', {
        message: 'Authoritative Staff/HR projection failed structural validation.',
        validationFailures: {
          countMismatch,
          profileIssues,
          sensitiveProfileLeak: !administrativeProfiles
            .every((profile) => profile.sensitiveFieldsWithheld === true),
          documentIssues,
          relationshipIssues,
          deletionIssues,
          auditIssues,
          retentionIssues,
          staffShapeInvalid: !staffMembers.every(isValidStaffMemberProjection),
          departmentShapeInvalid: !departments.every(isValidDepartmentProjection),
        },
      })
    }

    return {
      ok: true,
      outcome_code: data.outcome_code,
      centerId: normalizedCenterId,
      departments,
      staffMembers,
      administrativeProfiles,
      documents,
      retentionPolicy,
      deletionRequests,
      auditEvents,
    }
  } catch (error) {
    return failure('STAFF_HR_SHARED_TRUTH_READ_FAILED', error)
  }
}

export async function mutateC55StaffHrSharedTruth({
  supabase,
  centerId,
  command,
  idempotencyKey = createC55StaffHrIdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', null, idempotencyKey)
  }
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER', null, idempotencyKey)
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    return failure('INVALID_COMMAND', null, idempotencyKey)
  }

  try {
    const { data, error } = await supabase.rpc('c5_5_mutate_staff_hr_shared_truth', {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return failure('SERVER_COMMAND_FAILED', error, idempotencyKey)
    if (!data?.ok) {
      return failure(String(data?.outcome_code || 'SERVER_COMMAND_FAILED'), data, idempotencyKey)
    }
    if (data.outcome_code !== 'COMMITTED'
      || !ENTITY_TYPES.has(String(data.entity_type || ''))
      || !cleanText(data.entity_id)
      || !Number.isSafeInteger(Number(data.entity_version))
      || Number(data.entity_version) < 1) {
      return failure('INVALID_SERVER_RESULT', data, idempotencyKey)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return failure('SERVER_COMMAND_FAILED', error, idempotencyKey)
  }
}

export async function recordC55StaffHrAccessAudit({
  supabase,
  centerId,
  action,
  staffMemberId,
  administrativeProfileId = '',
  noteSummary = '',
  idempotencyKey = createC55StaffHrIdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', null, idempotencyKey)
  }
  const normalizedCenterId = cleanText(centerId)
  const normalizedAction = cleanText(action)
  const normalizedStaffMemberId = cleanText(staffMemberId)
  const normalizedProfileId = cleanText(administrativeProfileId)
  if (!normalizedCenterId || !normalizedStaffMemberId
    || !['administrative-profile.open', 'administrative-profile.reveal-sensitive']
      .includes(normalizedAction)) {
    return failure('INVALID_COMMAND', null, idempotencyKey)
  }

  try {
    const { data, error } = await supabase.rpc('c5_5_record_staff_hr_access_audit', {
      p_center_id: normalizedCenterId,
      p_action: normalizedAction,
      p_staff_member_id: normalizedStaffMemberId,
      p_administrative_profile_id: normalizedProfileId || null,
      p_note_summary: cleanText(noteSummary),
      p_idempotency_key: idempotencyKey,
    })
    if (error) return failure('SERVER_COMMAND_FAILED', error, idempotencyKey)
    const auditEvent = data?.audit_event
    if (!data?.ok) {
      return failure(String(data?.outcome_code || 'SERVER_COMMAND_FAILED'), data, idempotencyKey)
    }
    if (data.outcome_code !== 'COMMITTED'
      || !auditEvent || typeof auditEvent !== 'object' || Array.isArray(auditEvent)
      || cleanText(auditEvent.centerId) !== normalizedCenterId
      || cleanText(auditEvent.staffMemberId) !== normalizedStaffMemberId
      || cleanText(auditEvent.action) !== normalizedAction
      || !cleanText(auditEvent.id) || !cleanText(auditEvent.actorUserId)
      || !cleanText(auditEvent.actorMembershipId) || !cleanText(auditEvent.createdAt)) {
      return failure('INVALID_SERVER_RESULT', data, idempotencyKey)
    }
    return {
      ...data,
      ok: true,
      auditEvent: normalizeIsoAtFields(auditEvent),
      idempotencyKey,
    }
  } catch (error) {
    return failure('SERVER_COMMAND_FAILED', error, idempotencyKey)
  }
}

export async function readC55StaffAdministrativeProfile({
  supabase,
  centerId,
  staffMemberId,
  administrativeProfileId,
  idempotencyKey = createC55StaffHrIdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', null, idempotencyKey)
  }
  const normalizedCenterId = cleanText(centerId)
  const normalizedStaffMemberId = cleanText(staffMemberId)
  const normalizedProfileId = cleanText(administrativeProfileId)
  if (!normalizedCenterId || !normalizedStaffMemberId || !normalizedProfileId) {
    return failure('INVALID_COMMAND', null, idempotencyKey)
  }

  try {
    const { data, error } = await supabase.rpc('hr_1_read_staff_administrative_profile', {
      p_center_id: normalizedCenterId,
      p_staff_member_id: normalizedStaffMemberId,
      p_administrative_profile_id: normalizedProfileId,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return failure('SERVER_COMMAND_FAILED', error, idempotencyKey)
    if (!data?.ok || data.outcome_code !== 'SENSITIVE_PROFILE_READ'
      || cleanText(data.center_id) !== normalizedCenterId
      || !Array.isArray(data.documents)) {
      return failure(String(data?.outcome_code || 'INVALID_SERVER_RESULT'), data, idempotencyKey)
    }

    const profile = normalizeStaffAdministrativeProfiles(
      [projectScopedEntity(data.profile, normalizedCenterId)],
      { currentCenterId: normalizedCenterId },
    )[0]
    const auditEvent = data.audit_event
    const documents = normalizeStaffDocuments(
      projectScopedCollection(data.documents, normalizedCenterId),
      { currentCenterId: normalizedCenterId },
    )
    const profileIssues = profile
      ? getStaffAdministrativeProfileCollectionIssues([profile], normalizedCenterId)
      : ['profile:missing']
    const documentIssues = getStaffDocumentCollectionIssues(documents, normalizedCenterId)
    const relationshipIssues = profile
      ? getStaffDocumentRelationshipIssues(documents, {
          centerId: normalizedCenterId,
          staffMembers: [{ id: normalizedStaffMemberId, centerId: normalizedCenterId }],
          administrativeProfiles: [profile],
        })
      : ['profile:missing']
    if (!profile
      || profile.sensitiveFieldsWithheld === true
      || profile.staffMemberId !== normalizedStaffMemberId
      || profile.id !== normalizedProfileId
      || profileIssues.length
      || documents.length !== data.documents.length
      || documentIssues.length
      || relationshipIssues.length
      || !auditEvent || typeof auditEvent !== 'object' || Array.isArray(auditEvent)
      || cleanText(auditEvent.centerId) !== normalizedCenterId
      || cleanText(auditEvent.staffMemberId) !== normalizedStaffMemberId
      || cleanText(auditEvent.administrativeProfileId) !== normalizedProfileId
      || cleanText(auditEvent.action) !== 'administrative-profile.open'
      || !cleanText(auditEvent.id) || !cleanText(auditEvent.createdAt)) {
      return failure('INVALID_SERVER_RESULT', data, idempotencyKey)
    }

    return {
      ...data,
      ok: true,
      profile,
      documents,
      auditEvent: normalizeIsoAtFields(auditEvent),
      idempotencyKey,
    }
  } catch (error) {
    return failure('SERVER_COMMAND_FAILED', error, idempotencyKey)
  }
}

export function buildC55StaffHrUpsertCommand(entityType, entity, {
  auditAction = '',
  operation = 'UPSERT',
} = {}) {
  const normalizedEntityType = cleanText(entityType).toLowerCase()
  if (!ENTITY_TYPES.has(normalizedEntityType)) throw new Error('Loại Staff/HR không hợp lệ.')
  if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
    throw new Error('Payload Staff/HR không hợp lệ.')
  }
  const entityId = requireStableId(entity.id)
  const expectedVersion = getCloudVersion(entity)
  const payload = JSON.parse(JSON.stringify(entity))
  delete payload.cloudVersion
  delete payload.cloudUpdatedAt
  return {
    operation: cleanText(operation).toUpperCase() || 'UPSERT',
    entity_type: normalizedEntityType,
    entity_id: entityId,
    expected_version: expectedVersion,
    audit_action: cleanText(auditAction),
    payload,
  }
}

export function createC55StaffHrRetryFingerprint(command = {}) {
  const semantic = cloneWithoutVolatileFields(command)
  if (Number(semantic.expected_version) === 0) {
    delete semantic.entity_id
    if (semantic.payload && typeof semantic.payload === 'object') delete semantic.payload.id
  }
  return JSON.stringify(sortObjectDeep(semantic))
}

export function getC55StaffHrOutcomeMessage(outcomeCode) {
  const messages = {
    NOT_AUTHENTICATED: 'Phiên đăng nhập không còn hợp lệ; thay đổi chưa được lưu.',
    CLIENT_NOT_READY: 'Chưa kết nối được dữ liệu nhân sự; thay đổi chưa được lưu.',
    INVALID_CENTER: 'Chưa xác định được cơ sở; thay đổi chưa được lưu.',
    CENTER_ACCESS_DENIED: 'Tài khoản không có quyền tại cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Chỉ Owner hoặc Quản trị viên cơ sở được cập nhật nhân sự.',
    INVALID_COMMAND: 'Yêu cầu cập nhật nhân sự không hợp lệ.',
    INVALID_ENTITY_TYPE: 'Loại bản ghi nhân sự không hợp lệ.',
    INVALID_PAYLOAD: 'Dữ liệu nhân sự không hợp lệ.',
    INVALID_REFERENCE: 'Liên kết nhân viên, giáo viên, tài khoản hoặc tài liệu không hợp lệ.',
    RESOURCE_NOT_FOUND_OR_DENIED: 'Không tìm thấy hồ sơ trong cơ sở hiện tại.',
    VERSION_STALE: 'Dữ liệu đã được tài khoản khác cập nhật; hãy Làm mới trước khi lưu.',
    IDEMPOTENCY_CONFLICT: 'Yêu cầu thử lại không khớp với thay đổi trước đó.',
    UNIQUE_CONFLICT: 'Mã hoặc liên kết nhân sự đã tồn tại trong cơ sở này.',
    SEPARATION_OF_DUTIES_REQUIRED: 'Yêu cầu xóa cần một Owner khác phê duyệt.',
    INVALID_STATE_TRANSITION: 'Chuyển trạng thái quản trị nhân sự không hợp lệ.',
    CONCURRENT_CONFLICT: 'Dữ liệu đang được cập nhật; hãy Làm mới rồi thử lại.',
    INVALID_SERVER_RESULT: 'Dữ liệu nhân sự nhận về không hợp lệ; danh sách cũ đã được ẩn.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đã thay đổi; dữ liệu của cơ sở trước đã được ẩn.',
    STAFF_HR_SHARED_TRUTH_READ_FAILED: 'Chưa tải được dữ liệu nhân sự.',
    BACKEND_NOT_DEPLOYED: 'Quản lý nhân sự hiện chưa khả dụng.',
    ACCESS_AUDIT_FAILED: 'Không thể ghi nhật ký truy cập; hồ sơ nhạy cảm không được mở.',
    SERVER_COMMAND_FAILED: 'Không lưu được thay đổi; nội dung đang nhập vẫn được giữ nguyên.',
  }
  return messages[String(outcomeCode || '')]
    || 'Không thể cập nhật dữ liệu nhân sự.'
}

function projectScopedCollection(rows, centerId) {
  return rows.map((row) => projectScopedEntity(row, centerId)).filter(Boolean)
}

function projectScopedAuditCollection(rows, centerId) {
  return rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)
    && cleanText(row.centerId) === centerId && cleanText(row.id))
    .map(normalizeIsoAtFields)
}

function projectScopedEntity(row, centerId) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const version = Number(row.cloudVersion)
  if (cleanText(row.centerId) !== centerId
    || !cleanText(row.id)
    || !Number.isSafeInteger(version)
    || version < 1) return null
  return normalizeIsoAtFields({ ...row, cloudVersion: version })
}

function normalizeIsoAtFields(value) {
  if (Array.isArray(value)) return value.map(normalizeIsoAtFields)
  if (!value || typeof value !== 'object') return value
  return Object.entries(value).reduce((result, [key, child]) => {
    if (key.endsWith('At') && child) {
      const date = new Date(child)
      result[key] = Number.isNaN(date.getTime()) ? child : date.toISOString()
    } else {
      result[key] = normalizeIsoAtFields(child)
    }
    return result
  }, {})
}

function isValidStaffMemberProjection(item) {
  return ['active', 'on-leave', 'terminated'].includes(cleanText(item.employmentStatus))
    && ['full-time', 'part-time', 'collaborator', 'contract', 'unspecified']
      .includes(cleanText(item.employmentType))
    && (!item.departmentId || cleanText(item.departmentId))
}

function isValidDepartmentProjection(item) {
  return Boolean(cleanText(item.name) && ['active', 'archived'].includes(cleanText(item.status)))
}

function hasUniqueIds(items) {
  return new Set(items.map((item) => item.id)).size === items.length
}

function getCloudVersion(entity) {
  const version = Number(entity?.cloudVersion)
  return Number.isSafeInteger(version) && version > 0 ? version : 0
}

function requireStableId(value) {
  const id = cleanText(value)
  if (!id || id.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    throw new Error('Stable ID Staff/HR không hợp lệ.')
  }
  return id
}

function cloneWithoutVolatileFields(value) {
  if (Array.isArray(value)) return value.map(cloneWithoutVolatileFields)
  if (!value || typeof value !== 'object') return value
  return Object.entries(value).reduce((result, [key, child]) => {
    if (['createdAt', 'updatedAt', 'cloudUpdatedAt'].includes(key)) return result
    result[key] = cloneWithoutVolatileFields(child)
    return result
  }, {})
}

function sortObjectDeep(value) {
  if (Array.isArray(value)) return value.map(sortObjectDeep)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortObjectDeep(value[key])
    return result
  }, {})
}

function failure(outcomeCode, detail = null, idempotencyKey = '') {
  const detailMessage = detail instanceof Error
    ? detail.message
    : typeof detail?.message === 'string'
      ? detail.message
      : ''
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: detailMessage || getC55StaffHrOutcomeMessage(outcomeCode),
    detail,
    idempotencyKey,
  }
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function normalizeRole(value) {
  const role = cleanText(value).toLowerCase().replace(/[\s-]+/g, '_')
  return role === 'admin' ? 'center_admin' : role
}
