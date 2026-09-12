export const V26_TEACHER_REGISTRY_CAPABILITY_STATUS = Object.freeze({
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
  'BACKEND_NOT_DEPLOYED',
  'SCHEMA_NOT_READY',
])

const TEACHER_STATUSES = new Set(['active', 'paused', 'inactive'])
const TEACHER_TYPES = new Set(['fulltime', 'parttime', 'collaborator'])
const ASSIGNMENT_STATUSES = new Set(['assigned', 'removed'])
const EVENT_TYPES = new Set(['teacher_created', 'teacher_updated', 'assigned', 'removed', 'transferred'])

export function createV26TeacherRegistryCapabilityState(overrides = {}) {
  return {
    centerId: '',
    status: V26_TEACHER_REGISTRY_CAPABILITY_STATUS.IDLE,
    role: '',
    canManageRegistry: false,
    authorityEstablished: false,
    assignedTeachers: [],
    registryTeachers: [],
    managedCenters: [],
    assignmentEvents: [],
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    ...overrides,
  }
}

export function isV26TeacherRegistryCapabilityReady(state = {}, centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return Boolean(
    normalizedCenterId
      && state.status === V26_TEACHER_REGISTRY_CAPABILITY_STATUS.READY
      && state.centerId === normalizedCenterId,
  )
}

export function isV26TeacherRegistryBackendUnavailable(result = {}) {
  const code = cleanText(result.outcome_code || result.code).toUpperCase()
  const detail = [result.error, result.message, result.details, result.hint]
    .map(cleanText)
    .join(' ')
    .toUpperCase()
  return BACKEND_UNAVAILABLE_CODES.has(code)
    || [...BACKEND_UNAVAILABLE_CODES].some((candidate) => detail.includes(candidate))
    || (
      detail.includes('V2_6_LIST_TEACHER_REGISTRY')
      && (detail.includes('NOT FIND') || detail.includes('NOT FOUND'))
    )
}

export function createV26TeacherRegistryIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không thể tạo mã an toàn cho thao tác Giáo viên.')
  }
  return globalThis.crypto.randomUUID()
}

export function createV26TeacherRegistryRetryFingerprint(command = {}) {
  return stableStringify(command)
}

export async function pullV26TeacherRegistry({ supabase, centerId } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY')
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER')

  try {
    const { data, error } = await supabase.rpc('v2_6_list_teacher_registry', {
      p_center_id: normalizedCenterId,
    })
    if (error) return rpcFailure(error, 'TEACHER_REGISTRY_READ_FAILED')
    if (!data?.ok || cleanText(data.center_id) !== normalizedCenterId) {
      return failure(cleanText(data?.outcome_code) || 'INVALID_SERVER_RESULT')
    }

    const role = normalizeRole(data.role)
    const canManageRegistry = data.can_manage_registry === true
    const assignedTeachers = projectTeacherList(data.assigned_teachers, normalizedCenterId, true)
    const registryTeachers = projectTeacherList(data.registry_teachers, normalizedCenterId, false)
    const managedCenters = projectManagedCenters(data.managed_centers)
    const assignmentEvents = projectAssignmentEvents(data.assignment_events, normalizedCenterId)

    if (!['owner', 'center_admin'].includes(role)
      || canManageRegistry !== (role === 'owner')
      || !assignedTeachers || !registryTeachers || !managedCenters || !assignmentEvents
      || (!canManageRegistry && (registryTeachers.length || managedCenters.length))) {
      return failure('INVALID_SERVER_RESULT')
    }

    return {
      ok: true,
      outcome_code: 'AUTHORITATIVE_SNAPSHOT',
      centerId: normalizedCenterId,
      role,
      canManageRegistry,
      assignedTeachers,
      registryTeachers,
      managedCenters,
      assignmentEvents,
    }
  } catch (error) {
    return rpcFailure(error, 'TEACHER_REGISTRY_READ_FAILED')
  }
}

export async function mutateV26TeacherRegistry({
  supabase,
  centerId,
  command,
  idempotencyKey = createV26TeacherRegistryIdempotencyKey(),
} = {}) {
  return mutateV26Rpc({
    supabase,
    rpcName: 'v2_6_mutate_teacher_registry',
    centerId,
    command,
    idempotencyKey,
  })
}

export async function mutateV26TeacherAssignment({
  supabase,
  centerId,
  command,
  idempotencyKey = createV26TeacherRegistryIdempotencyKey(),
} = {}) {
  return mutateV26Rpc({
    supabase,
    rpcName: 'v2_6_mutate_teacher_assignment',
    centerId,
    command,
    idempotencyKey,
  })
}

export function buildV26TeacherCommand(values = {}, currentTeacher = null) {
  const currentVersion = authoritativeVersion(currentTeacher)
  const teacherId = currentVersion
    ? requireUuid(currentTeacher.id, 'Không xác định được giáo viên cần cập nhật.')
    : createV26TeacherRegistryIdempotencyKey()
  const status = cleanText(values.status || currentTeacher?.status || 'active').toLowerCase()
  const teacherType = cleanText(values.teacherType || currentTeacher?.teacherType || 'fulltime').toLowerCase()
  const birthYearText = cleanText(values.birthYear)
  const email = cleanText(values.email).toLowerCase()
  if (!TEACHER_STATUSES.has(status)) throw new Error('Trạng thái giáo viên không hợp lệ.')
  if (!TEACHER_TYPES.has(teacherType)) throw new Error('Hình thức giáo viên không hợp lệ.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email giáo viên không hợp lệ.')
  if (birthYearText && (!/^\d{4}$/.test(birthYearText)
    || Number(birthYearText) < 1900 || Number(birthYearText) > 2100)) {
    throw new Error('Năm sinh giáo viên không hợp lệ.')
  }
  return {
    operation: currentVersion ? 'UPDATE_TEACHER' : 'CREATE_TEACHER',
    teacher_id: teacherId,
    expected_version: currentVersion,
    full_name: requireText(values.fullName, 'Vui lòng nhập họ tên giáo viên.'),
    display_name: requireText(values.displayName || values.fullName, 'Vui lòng nhập tên hiển thị.'),
    phone: cleanText(values.phone),
    email,
    birth_year: birthYearText,
    status,
    teacher_type: teacherType,
    specialties: normalizeTextArray(values.specialties),
    levels: normalizeTextArray(values.levels),
    main_role: cleanText(values.mainRole),
    note: cleanText(values.note),
  }
}

export function buildV26AssignTeacherCommand(teacher, targetCenter, currentAssignment = null) {
  return {
    operation: 'ASSIGN',
    teacher_id: requireUuid(teacher?.id, 'Không xác định được giáo viên.'),
    to_center_id: requireText(targetCenter?.centerId, 'Vui lòng chọn cơ sở nhận phân công.'),
    expected_version: authoritativeAssignmentVersion(currentAssignment),
  }
}

export function buildV26RemoveTeacherCommand(teacher, assignment) {
  return {
    operation: 'REMOVE',
    teacher_id: requireUuid(teacher?.id, 'Không xác định được giáo viên.'),
    from_center_id: requireText(assignment?.centerId, 'Không xác định được cơ sở cần gỡ.'),
    expected_version: requireAssignmentVersion(assignment),
  }
}

export function buildV26TransferTeacherCommand(teacher, sourceAssignment, targetCenter, targetAssignment = null) {
  const sourceCenterId = requireText(sourceAssignment?.centerId, 'Không xác định được cơ sở chuyển đi.')
  const targetCenterId = requireText(targetCenter?.centerId, 'Vui lòng chọn cơ sở nhận giáo viên.')
  if (sourceCenterId === targetCenterId) throw new Error('Cơ sở chuyển đi và nhận giáo viên phải khác nhau.')
  return {
    operation: 'TRANSFER',
    teacher_id: requireUuid(teacher?.id, 'Không xác định được giáo viên.'),
    from_center_id: sourceCenterId,
    to_center_id: targetCenterId,
    expected_version: requireAssignmentVersion(sourceAssignment),
    target_expected_version: authoritativeAssignmentVersion(targetAssignment),
  }
}

export function buildV26TeacherDirectoryProjection({
  legacyTeachers = [],
  capabilityState = {},
  ownerView = capabilityState.canManageRegistry === true,
} = {}) {
  const canonicalSource = ownerView
    ? capabilityState.registryTeachers
    : capabilityState.assignedTeachers
  const canonicalTeachers = (Array.isArray(canonicalSource) ? canonicalSource : [])
    .map((teacher) => ({ ...teacher, v26Canonical: true, legacyReviewRequired: false }))
  const canonicalIds = new Set(canonicalTeachers.map((teacher) => cleanText(teacher.id)))
  const legacyProjection = (ownerView && Array.isArray(legacyTeachers) ? legacyTeachers : [])
    .filter((teacher) => cleanText(teacher?.id) && !canonicalIds.has(cleanText(teacher.id)))
    .map((teacher) => ({
      ...teacher,
      v26Canonical: false,
      legacyReviewRequired: true,
    }))
  return [...canonicalTeachers, ...legacyProjection]
}

export function buildV26TeacherReferenceProjection({ legacyTeachers = [], capabilityState = {} } = {}) {
  const canonicalTeachers = buildV26TeacherDirectoryProjection({
    legacyTeachers,
    capabilityState: {
      ...capabilityState,
      registryTeachers: capabilityState.assignedTeachers,
    },
    ownerView: false,
  })
  const canonicalIds = new Set(canonicalTeachers.map((teacher) => cleanText(teacher.id)))
  const legacyProjection = (Array.isArray(legacyTeachers) ? legacyTeachers : [])
    .filter((teacher) => cleanText(teacher?.id) && !canonicalIds.has(cleanText(teacher.id)))
    .map((teacher) => ({
      ...teacher,
      v26Canonical: false,
      legacyReviewRequired: true,
    }))
  return [...canonicalTeachers, ...legacyProjection]
}

export function getV26TeacherRegistryOutcomeMessage(outcomeCode = '') {
  const messages = {
    BACKEND_NOT_DEPLOYED: 'Danh bạ giáo viên dùng chung hiện chưa khả dụng.',
    INVALID_CENTER: 'Chưa xác định được cơ sở đang hoạt động.',
    CLIENT_NOT_READY: 'Cần đăng nhập lại trước khi tải danh bạ giáo viên.',
    CENTER_ACCESS_DENIED: 'Tài khoản hiện tại không có quyền xem giáo viên của cơ sở này.',
    OWNER_REQUIRED: 'Chỉ Owner được quản lý hồ sơ giáo viên chuẩn và phân công cơ sở.',
    TEACHER_SCOPE_DENIED: 'Giáo viên này không thuộc phạm vi Owner đang quản lý.',
    TARGET_CENTER_DENIED: 'Bạn không có quyền Owner tại cơ sở nhận phân công.',
    SOURCE_CENTER_DENIED: 'Bạn không có quyền Owner tại cơ sở chuyển đi.',
    STALE_VERSION: 'Phân công hoặc hồ sơ đã thay đổi. Hãy tải lại trước khi tiếp tục.',
    IDEMPOTENCY_CONFLICT: 'Nội dung thao tác đã thay đổi. Hãy kiểm tra và thực hiện lại.',
    TEACHER_IDENTITY_CONFLICT: 'Email hoặc mã giáo viên đã thuộc một hồ sơ khác.',
    ASSIGNMENT_ALREADY_ACTIVE: 'Giáo viên đã được phân công tại cơ sở này.',
    LAST_ASSIGNMENT_REQUIRED: 'Giáo viên cần còn ít nhất một cơ sở đang phụ trách. Hãy dùng thao tác chuyển cơ sở.',
    TARGET_ASSIGNMENT_CONFLICT: 'Cơ sở nhận đã có phân công hoặc trạng thái vừa thay đổi.',
    CONCURRENT_CONFLICT: 'Phân công vừa được thay đổi ở nơi khác. Hãy tải lại trước khi tiếp tục.',
    TEACHER_REGISTRY_READ_FAILED: 'Chưa tải được danh bạ giáo viên dùng chung.',
    TEACHER_REGISTRY_WRITE_FAILED: 'Chưa thể lưu thay đổi. Nội dung đang nhập vẫn được giữ nguyên.',
    INVALID_SERVER_RESULT: 'Dữ liệu danh bạ giáo viên trả về chưa hợp lệ.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đã thay đổi; kết quả cũ không được sử dụng.',
  }
  return messages[cleanText(outcomeCode).toUpperCase()]
    || 'Chưa thể hoàn tất thao tác Giáo viên lúc này.'
}

async function mutateV26Rpc({ supabase, rpcName, centerId, command, idempotencyKey }) {
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY', idempotencyKey)
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER', idempotencyKey)
  if (!isPlainObject(command)) return failure('INVALID_COMMAND', idempotencyKey)
  try {
    const { data, error } = await supabase.rpc(rpcName, {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return rpcFailure(error, 'TEACHER_REGISTRY_WRITE_FAILED', idempotencyKey)
    if (!data?.ok || cleanText(data.center_id) !== normalizedCenterId
      || cleanText(data.outcome_code) !== 'COMMITTED') {
      return failure(cleanText(data?.outcome_code) || 'INVALID_SERVER_RESULT', idempotencyKey, data)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return rpcFailure(error, 'TEACHER_REGISTRY_WRITE_FAILED', idempotencyKey)
  }
}

function projectTeacherList(rows, expectedCenterId, requireCurrentAssignment) {
  if (!Array.isArray(rows)) return null
  const projected = rows.map((row) => projectTeacher(row, expectedCenterId, requireCurrentAssignment))
  return projected.some((row) => !row) ? null : projected
}

function projectTeacher(row = {}, expectedCenterId = '', requireCurrentAssignment = false) {
  const id = cleanText(row.id)
  const version = Number(row.version)
  const status = cleanText(row.status).toLowerCase()
  const teacherType = cleanText(row.teacher_type).toLowerCase()
  if (!isUuid(id) || !cleanText(row.full_name) || !cleanText(row.display_name)
    || !Number.isSafeInteger(version) || version < 1
    || !TEACHER_STATUSES.has(status) || !TEACHER_TYPES.has(teacherType)) return null
  const assignments = Array.isArray(row.assignments)
    ? row.assignments.map(projectAssignment)
    : []
  if (assignments.some((assignment) => !assignment)) return null
  const currentAssignment = requireCurrentAssignment
    ? projectAssignment({
        id: row.assignment_id,
        center_id: expectedCenterId,
        status: row.assignment_status,
        version: row.assignment_version,
        updated_at: row.assignment_updated_at,
      })
    : assignments.find((assignment) => assignment.centerId === expectedCenterId) || null
  if (requireCurrentAssignment && (!currentAssignment || currentAssignment.status !== 'assigned')) return null
  return {
    id,
    canonicalTeacherId: id,
    fullName: cleanText(row.full_name),
    displayName: cleanText(row.display_name),
    phone: cleanText(row.phone),
    email: cleanText(row.email),
    birthYear: row.birth_year == null ? '' : String(row.birth_year),
    status,
    teacherType,
    specialties: normalizeTextArray(row.specialties),
    levels: normalizeTextArray(row.levels),
    mainRole: cleanText(row.main_role),
    note: cleanText(row.note),
    cloudVersion: version,
    registryVersion: version,
    updatedAt: cleanText(row.updated_at),
    assignment: currentAssignment,
    assignments,
  }
}

function projectAssignment(row = {}) {
  const id = cleanText(row.id)
  const centerId = cleanText(row.center_id)
  const status = cleanText(row.status).toLowerCase()
  const version = Number(row.version)
  if (!isUuid(id) || !centerId || !ASSIGNMENT_STATUSES.has(status)
    || !Number.isSafeInteger(version) || version < 1) return null
  return {
    id,
    centerId,
    centerName: cleanText(row.center_name) || centerId,
    status,
    version,
    assignedAt: cleanText(row.assigned_at),
    removedAt: cleanText(row.removed_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function projectManagedCenters(rows) {
  if (!Array.isArray(rows)) return null
  const projected = rows.map((row) => ({
    centerId: cleanText(row?.center_id),
    centerName: cleanText(row?.center_name) || cleanText(row?.center_id),
  }))
  return projected.some((row) => !row.centerId) ? null : projected
}

function projectAssignmentEvents(rows, expectedCenterId) {
  if (!Array.isArray(rows)) return null
  const projected = rows.map((row) => {
    const id = cleanText(row?.id)
    const teacherId = cleanText(row?.teacher_id)
    const eventType = cleanText(row?.event_type).toLowerCase()
    const fromCenterId = cleanText(row?.from_center_id)
    const toCenterId = cleanText(row?.to_center_id)
    if (!isUuid(id) || !isUuid(teacherId) || !EVENT_TYPES.has(eventType)
      || (fromCenterId !== expectedCenterId && toCenterId !== expectedCenterId)) return null
    return {
      id,
      teacherId,
      eventType,
      fromCenterId,
      toCenterId,
      assignmentId: cleanText(row?.assignment_id),
      relatedAssignmentId: cleanText(row?.related_assignment_id),
      teacherVersion: Number(row?.teacher_version) || 0,
      assignmentVersion: Number(row?.assignment_version) || 0,
      occurredAt: cleanText(row?.occurred_at),
    }
  })
  return projected.some((row) => !row) ? null : projected
}

function rpcFailure(error = {}, fallbackCode = 'TEACHER_REGISTRY_WRITE_FAILED', idempotencyKey = '') {
  const unavailable = isV26TeacherRegistryBackendUnavailable(error)
  const detail = [error?.code, error?.message, error?.details, error?.hint]
    .map(cleanText)
    .join(' ')
    .toLowerCase()
  const known = [
    ['v2_6_center_access_denied', 'CENTER_ACCESS_DENIED'],
    ['v2_6_owner_required', 'OWNER_REQUIRED'],
    ['v2_6_teacher_scope_denied', 'TEACHER_SCOPE_DENIED'],
    ['v2_6_target_center_denied', 'TARGET_CENTER_DENIED'],
    ['v2_6_source_center_denied', 'SOURCE_CENTER_DENIED'],
    ['v2_6_stale_version', 'STALE_VERSION'],
    ['v2_6_idempotency_conflict', 'IDEMPOTENCY_CONFLICT'],
    ['v2_6_teacher_identity_conflict', 'TEACHER_IDENTITY_CONFLICT'],
    ['v2_6_assignment_already_active', 'ASSIGNMENT_ALREADY_ACTIVE'],
    ['v2_6_last_assignment_required', 'LAST_ASSIGNMENT_REQUIRED'],
    ['v2_6_target_assignment_conflict', 'TARGET_ASSIGNMENT_CONFLICT'],
    ['v2_6_concurrent_conflict', 'CONCURRENT_CONFLICT'],
  ].find(([token]) => detail.includes(token))
  return failure(unavailable ? 'BACKEND_NOT_DEPLOYED' : known?.[1] || fallbackCode, idempotencyKey, error)
}

function failure(outcomeCode, idempotencyKey = '', detail = null) {
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: getV26TeacherRegistryOutcomeMessage(outcomeCode),
    idempotencyKey,
    detail,
  }
}

function normalizeRole(role) {
  const normalized = cleanText(role).toLowerCase()
  if (['admin', 'qtv', 'centeradmin', 'center_admin'].includes(normalized)) return 'center_admin'
  return normalized
}

function normalizeTextArray(value) {
  const source = Array.isArray(value)
    ? value
    : cleanText(value).split(',')
  return [...new Set(source.map(cleanText).filter(Boolean))].slice(0, 20)
}

function authoritativeVersion(value = {}) {
  const version = Number(value?.registryVersion || value?.cloudVersion || value?.version)
  return Number.isSafeInteger(version) && version > 0 ? version : 0
}

function authoritativeAssignmentVersion(value = {}) {
  const version = Number(value?.version)
  return Number.isSafeInteger(version) && version > 0 ? version : 0
}

function requireAssignmentVersion(value = {}) {
  const version = authoritativeAssignmentVersion(value)
  if (!version) throw new Error('Phân công chưa có phiên bản hợp lệ. Hãy tải lại.')
  return version
}

function requireText(value, error) {
  const normalized = cleanText(value)
  if (!normalized) throw new Error(error)
  return normalized
}

function requireUuid(value, error) {
  const normalized = cleanText(value)
  if (!isUuid(normalized)) throw new Error(error)
  return normalized
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value))
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}
