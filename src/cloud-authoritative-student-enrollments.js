import { normalizeV22Enrollments } from './student-recurring-enrollment.js'

export const V22_STUDENT_ENROLLMENT_CAPABILITY_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
})

const BACKEND_UNAVAILABLE_CODES = new Set([
  '42P01', '42883', 'PGRST202', 'PGRST205', 'BACKEND_NOT_DEPLOYED', 'SCHEMA_NOT_READY',
])

export function createV22StudentEnrollmentCapabilityState(overrides = {}) {
  return {
    centerId: '',
    status: V22_STUDENT_ENROLLMENT_CAPABILITY_STATUS.IDLE,
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    authorityEstablished: false,
    ...overrides,
  }
}

export function isV22StudentEnrollmentCapabilityReady(state = {}, centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return Boolean(normalizedCenterId
    && state.status === V22_STUDENT_ENROLLMENT_CAPABILITY_STATUS.READY
    && state.centerId === normalizedCenterId)
}

export function isV22StudentEnrollmentBackendUnavailable(result = {}) {
  const code = cleanText(result.outcome_code || result.code).toUpperCase()
  const detail = [result.error, result.message, result.details, result.hint]
    .map(cleanText).join(' ').toUpperCase()
  return BACKEND_UNAVAILABLE_CODES.has(code)
    || [...BACKEND_UNAVAILABLE_CODES].some((candidate) => detail.includes(candidate))
    || (detail.includes('V2_2_LIST_STUDENT_ENROLLMENTS')
      && (detail.includes('NOT FIND') || detail.includes('NOT FOUND')))
}

export function createV22EnrollmentIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không thể tạo mã an toàn cho thao tác đăng ký học.')
  }
  return globalThis.crypto.randomUUID()
}

export async function pullV22StudentEnrollments({ supabase, centerId } = {}) {
  const normalizedCenterId = cleanText(centerId)
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY')
  if (!normalizedCenterId) return failure('INVALID_CENTER')
  try {
    const { data, error } = await supabase.rpc('v2_2_list_student_enrollments', {
      p_center_id: normalizedCenterId,
    })
    if (error) return rpcFailure(error, 'ENROLLMENT_READ_FAILED')
    if (!data?.ok || cleanText(data.center_id) !== normalizedCenterId
      || !Array.isArray(data.enrollment_sets)) return failure('INVALID_SERVER_RESULT')
    const enrollmentSets = data.enrollment_sets.map(projectEnrollmentSet)
    if (enrollmentSets.some((item) => !item)) return failure('INVALID_SERVER_RESULT')
    return {
      ok: true,
      outcome_code: cleanText(data.outcome_code) || 'AUTHORITATIVE_SNAPSHOT',
      centerId: normalizedCenterId,
      enrollmentSets,
    }
  } catch (error) {
    return rpcFailure(error, 'ENROLLMENT_READ_FAILED')
  }
}

export async function mutateV22StudentWithEnrollments({
  supabase,
  centerId,
  student,
  enrollments,
  expectedEnrollmentVersion = 0,
  idempotencyKey = createV22EnrollmentIdempotencyKey(),
  operation = 'UPSERT',
} = {}) {
  const normalizedCenterId = cleanText(centerId)
  const studentId = cleanText(student?.id)
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY', idempotencyKey)
  if (!normalizedCenterId) return failure('INVALID_CENTER', idempotencyKey)
  if (!studentId) return failure('INVALID_STUDENT', idempotencyKey)
  try {
    const { data, error } = await supabase.rpc('v2_2_mutate_student_with_enrollments', {
      p_center_id: normalizedCenterId,
      p_student_local_id: studentId,
      p_expected_student_version: authoritativeVersion(student),
      p_student_payload: operation === 'DELETE' ? {} : student,
      p_expected_enrollment_version: Number(expectedEnrollmentVersion) || 0,
      p_enrollments: normalizeV22Enrollments(enrollments).map((entry) => ({
        class_session_id: entry.classSessionId,
        weekdays: entry.weekdays,
      })),
      p_idempotency_key: idempotencyKey,
      p_operation: String(operation || 'UPSERT').toUpperCase(),
    })
    if (error) return rpcFailure(error, 'ENROLLMENT_WRITE_FAILED', idempotencyKey)
    if (!data?.ok || cleanText(data.center_id) !== normalizedCenterId) {
      return failure(cleanText(data?.outcome_code) || 'INVALID_SERVER_RESULT', idempotencyKey, data)
    }
    const projectedStudent = operation === 'DELETE' ? null : projectStudent(data)
    const enrollmentSet = operation === 'DELETE' ? null : projectEnrollmentSet(data.enrollment_set)
    if (operation !== 'DELETE' && (!projectedStudent || !enrollmentSet)) {
      return failure('INVALID_SERVER_RESULT', idempotencyKey)
    }
    return { ...data, ok: true, student: projectedStudent, enrollmentSet, idempotencyKey }
  } catch (error) {
    return rpcFailure(error, 'ENROLLMENT_WRITE_FAILED', idempotencyKey)
  }
}

export function getV22EnrollmentOutcomeMessage(outcomeCode = '') {
  const messages = {
    BACKEND_NOT_DEPLOYED: 'Đăng ký lịch học theo ngày hiện chưa khả dụng.',
    CLIENT_NOT_READY: 'Cần đăng nhập lại trước khi tải đăng ký lịch học.',
    INVALID_CENTER: 'Chưa xác định được cơ sở đang hoạt động.',
    INVALID_STUDENT: 'Không xác định được học viên cần lưu.',
    CENTER_ACCESS_DENIED: 'Tài khoản hiện tại không có quyền xem cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Tài khoản hiện tại không có quyền cập nhật đăng ký học.',
    CLASS_SESSION_NOT_FOUND: 'Ca học đã chọn không còn tồn tại. Hãy tải lại và kiểm tra.',
    WEEKDAY_REQUIRED: 'Mỗi ca học đã chọn cần ít nhất một ngày học.',
    WEEKDAY_NOT_IN_CLASS: 'Ngày học đã chọn không còn thuộc ca học. Hãy tải lại và kiểm tra.',
    ENROLLMENT_VERSION_CONFLICT: 'Đăng ký học đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.',
    VERSION_CONFLICT: 'Hồ sơ học viên đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.',
    IDEMPOTENCY_CONFLICT: 'Nội dung thao tác đã thay đổi. Hãy kiểm tra và lưu lại.',
    CLASS_WEEKDAY_IN_USE: 'Không thể bỏ ngày đang có học viên đăng ký. Hãy cập nhật học viên trước.',
    SCHEDULE_CLASS_LINK_REQUIRED: 'Lịch cố định cần liên kết đúng ca học trong Cài đặt cơ sở.',
    ENROLLMENT_READ_FAILED: 'Chưa tải được đăng ký lịch học theo ngày.',
    ENROLLMENT_WRITE_FAILED: 'Chưa thể lưu đăng ký học. Nội dung đang nhập vẫn được giữ nguyên.',
    INVALID_SERVER_RESULT: 'Máy chủ trả về dữ liệu đăng ký học chưa hợp lệ.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đang hoạt động đã thay đổi; kết quả cũ không được sử dụng.',
  }
  return messages[cleanText(outcomeCode).toUpperCase()] || 'Chưa thể hoàn tất thao tác đăng ký học lúc này.'
}

function projectEnrollmentSet(row = {}) {
  const studentId = cleanText(row.student_id || row.student_local_id)
  const version = Number(row.version)
  if (!studentId || !Number.isSafeInteger(version) || version < 1 || !Array.isArray(row.enrollments)) return null
  return { studentId, version, enrollments: normalizeV22Enrollments(row.enrollments) }
}

function projectStudent(data = {}) {
  const version = Number(data.student_version)
  if (!data.student_payload || typeof data.student_payload !== 'object'
    || cleanText(data.student_payload.id) !== cleanText(data.student_local_id)
    || !Number.isSafeInteger(version) || version < 1) return null
  return {
    ...data.student_payload,
    cloudVersion: version,
    cloudUpdatedAt: cleanText(data.student_updated_at),
  }
}

function rpcFailure(error = {}, fallbackCode, idempotencyKey = '') {
  const unavailable = isV22StudentEnrollmentBackendUnavailable(error)
  const detail = [error?.code, error?.message, error?.details, error?.hint]
    .map(cleanText).join(' ').toLowerCase()
  const known = [
    ['v2_2_center_access_denied', 'CENTER_ACCESS_DENIED'],
    ['v2_2_write_role_required', 'WRITE_ROLE_REQUIRED'],
    ['v2_2_class_session_not_found', 'CLASS_SESSION_NOT_FOUND'],
    ['v2_2_weekday_required', 'WEEKDAY_REQUIRED'],
    ['v2_2_weekday_not_in_class', 'WEEKDAY_NOT_IN_CLASS'],
    ['v2_2_enrollment_version_conflict', 'ENROLLMENT_VERSION_CONFLICT'],
    ['v2_2_idempotency_conflict', 'IDEMPOTENCY_CONFLICT'],
    ['v2_2_class_weekday_in_use', 'CLASS_WEEKDAY_IN_USE'],
    ['v2_2_schedule_class_link_required', 'SCHEDULE_CLASS_LINK_REQUIRED'],
  ].find(([token]) => detail.includes(token))
  return failure(unavailable ? 'BACKEND_NOT_DEPLOYED' : known?.[1] || fallbackCode, idempotencyKey, error)
}

function failure(outcomeCode, idempotencyKey = '', detail = null) {
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: getV22EnrollmentOutcomeMessage(outcomeCode),
    idempotencyKey,
    detail,
  }
}

function authoritativeVersion(value = {}) {
  const version = Number(value?.cloudVersion)
  return Number.isSafeInteger(version) && version > 0 ? version : 0
}

function cleanText(value) {
  return String(value ?? '').trim()
}
