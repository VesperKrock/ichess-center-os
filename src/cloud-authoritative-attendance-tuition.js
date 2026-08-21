import { sanitizeCloudPayload } from './cloud-db-entities.js'

export const AUTHORITATIVE_ATTENDANCE_TUITION_CONTRACT_VERSION = 1
export const AUTHORITATIVE_ATTENDANCE_TUITION_SOURCE_VERSION =
  'c5.2-authoritative-attendance-tuition-v1'
export const AUTHORITATIVE_ATTENDANCE_TUITION_ENTITY_TYPES = Object.freeze([
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'tuition_record_package',
])

const ENTITY_TYPE_SET = new Set(AUTHORITATIVE_ATTENDANCE_TUITION_ENTITY_TYPES)

export function isAuthoritativeAttendanceTuitionEntityType(entityType) {
  return ENTITY_TYPE_SET.has(String(entityType || '').trim())
}

export function getAuthoritativeAttendanceTuitionVersion(entity = {}) {
  const value = Number(entity?.cloudVersion)
  return Number.isSafeInteger(value) && value > 0 ? value : 0
}

export function createOperationalCommandIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  throw new Error('Không thể chuẩn bị mã chống lưu trùng. Vui lòng tải lại trang rồi thử lại.')
}

export function projectAuthoritativeAttendanceTuitionRecord(record = {}) {
  const payload = record?.payload
  const entityVersion = Number(record?.entity_version)

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  if (!Number.isSafeInteger(entityVersion) || entityVersion < 1) {
    return null
  }

  return {
    ...payload,
    cloudVersion: entityVersion,
    cloudUpdatedAt: String(record.updated_at || ''),
    cloudDeletedAt: String(record.deleted_at || ''),
  }
}

export function createAuthoritativeAttendanceTuitionMutation({
  entityType,
  localId,
  entity = {},
  expectedVersion = getAuthoritativeAttendanceTuitionVersion(entity),
  operation = 'UPSERT',
} = {}) {
  const normalizedEntityType = String(entityType || '').trim()
  const normalizedLocalId = String(localId || '').trim()
  const normalizedOperation = String(operation || '').trim().toUpperCase()

  if (!isAuthoritativeAttendanceTuitionEntityType(normalizedEntityType)) {
    throw new Error('Loại dữ liệu cần lưu không hợp lệ.')
  }

  if (!normalizedLocalId) {
    throw new Error('Mã dữ liệu cần lưu không hợp lệ.')
  }

  if (!['UPSERT', 'DELETE'].includes(normalizedOperation)) {
    throw new Error('Thao tác lưu không hợp lệ.')
  }

  const normalizedExpectedVersion = Number(expectedVersion)
  if (!Number.isSafeInteger(normalizedExpectedVersion) || normalizedExpectedVersion < 0) {
    throw new Error('Phiên bản dữ liệu cần lưu không hợp lệ.')
  }

  return {
    entity_type: normalizedEntityType,
    local_id: normalizedLocalId,
    expected_version: normalizedExpectedVersion,
    operation: normalizedOperation,
    payload: normalizedOperation === 'DELETE' ? {} : sanitizeCloudPayload(entity),
  }
}

export async function mutateAuthoritativeAttendanceTuitionEntities({
  supabase,
  centerId,
  mutations = [],
  idempotencyKey = createOperationalCommandIdempotencyKey(),
} = {}) {
  const normalizedCenterId = String(centerId || '').trim()
  const normalizedMutations = Array.isArray(mutations) ? mutations : []

  if (!supabase || typeof supabase.rpc !== 'function') {
    return {
      ok: false,
      outcome_code: 'CLIENT_NOT_READY',
      error: 'Chưa thể kết nối để lưu dữ liệu. Thông tin bạn nhập vẫn được giữ nguyên.',
    }
  }

  if (!normalizedCenterId) {
    return { ok: false, outcome_code: 'INVALID_CENTER', error: 'Chưa xác định được cơ sở đang hoạt động.' }
  }

  if (!normalizedMutations.length) {
    return { ok: true, outcome_code: 'NO_CHANGES', count: 0, records: [], idempotencyKey }
  }

  let commandMutations
  try {
    commandMutations = normalizedMutations.map((mutation) =>
      createAuthoritativeAttendanceTuitionMutation(mutation),
    )
  } catch (error) {
    return {
      ok: false,
      outcome_code: 'INVALID_COMMAND',
      error: String(error?.message || error),
    }
  }

  let data
  let error
  try {
    const response = await supabase.rpc('c5_2_mutate_attendance_tuition_entities', {
      p_center_id: normalizedCenterId,
      p_mutations: commandMutations,
      p_idempotency_key: idempotencyKey,
    })
    data = response?.data
    error = response?.error
  } catch (rpcError) {
    return {
      ok: false,
      outcome_code: 'SERVER_COMMAND_FAILED',
      error: getAuthoritativeAttendanceTuitionOutcomeMessage('SERVER_COMMAND_FAILED'),
      detail: rpcError,
      idempotencyKey,
    }
  }

  if (error) {
    return {
      ok: false,
      outcome_code: 'SERVER_COMMAND_FAILED',
      error: getAuthoritativeAttendanceTuitionOutcomeMessage('SERVER_COMMAND_FAILED'),
      detail: error,
      idempotencyKey,
    }
  }

  if (!data?.ok) {
    return {
      ...data,
      ok: false,
      error: getAuthoritativeAttendanceTuitionOutcomeMessage(data?.outcome_code),
      idempotencyKey,
    }
  }

  const records = Array.isArray(data.results)
    ? data.results.map((record) => ({
        ...record,
        isDeleted: Boolean(record.deleted_at || record.outcome_code === 'DELETED'),
      }))
    : []

  if (records.length !== commandMutations.length) {
    return {
      ok: false,
      outcome_code: 'INVALID_SERVER_RESULT',
      error: getAuthoritativeAttendanceTuitionOutcomeMessage('INVALID_SERVER_RESULT'),
      idempotencyKey,
    }
  }

  return {
    ...data,
    ok: true,
    count: records.length,
    records,
    idempotencyKey,
  }
}

export function getAuthoritativeAttendanceTuitionOutcomeMessage(outcomeCode) {
  const messages = {
    NOT_AUTHENTICATED: 'Phiên đăng nhập không hợp lệ. Dữ liệu chưa được lưu.',
    INVALID_CENTER: 'Cơ sở không hợp lệ. Dữ liệu chưa được lưu.',
    CENTER_ACCESS_DENIED: 'Tài khoản không còn quyền tại cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Tài khoản hiện tại chỉ được xem, không được lưu thay đổi này.',
    INVALID_ENTITY_TYPE: 'Loại dữ liệu cần lưu không hợp lệ.',
    INVALID_LOCAL_ID: 'Mã dữ liệu không hợp lệ.',
    INVALID_IDEMPOTENCY_KEY: 'Không tạo được khóa chống gửi trùng.',
    INVALID_COMMAND: 'Yêu cầu lưu không hợp lệ.',
    INVALID_PAYLOAD: 'Dữ liệu cần lưu không hợp lệ hoặc quá lớn.',
    CENTER_PAYLOAD_MISMATCH: 'Dữ liệu không thuộc cơ sở hiện tại.',
    DUPLICATE_MUTATION: 'Yêu cầu lưu có nhiều thay đổi trùng nhau.',
    ENTITY_NOT_FOUND: 'Dữ liệu này không còn tồn tại. Vui lòng làm mới trước khi tiếp tục.',
    VERSION_CONFLICT: 'Dữ liệu đã được tài khoản khác cập nhật. Hãy tải lại trước khi lưu.',
    BASELINE_STATE_REQUIRED: 'Cần lưu trạng thái khởi tạo cùng các thay đổi điểm danh.',
    BASELINE_LOCKED: 'Dữ liệu khởi tạo đã được khóa. Hãy làm mới trước khi chỉnh sửa.',
    IDEMPOTENCY_CONFLICT: 'Khóa gửi lại đã được dùng cho một thay đổi khác.',
    CONCURRENT_CONFLICT: 'Có thay đổi đồng thời. Hãy tải lại và thử lại.',
    ATTENDANCE_TUITION_BOUNDARY_VIOLATION:
      'Điểm danh chỉ dùng để đối chiếu; hệ thống chưa tự động trừ buổi học.',
    INVALID_SERVER_RESULT:
      'Hệ thống đã nhận phản hồi không đầy đủ. Chưa thể xác nhận màn hình đã cập nhật; vui lòng làm mới trước khi thao tác tiếp.',
    SERVER_COMMAND_FAILED:
      'Chưa thể xác nhận đã lưu. Thông tin bạn nhập vẫn được giữ nguyên; vui lòng làm mới trước khi thử lại.',
  }

  return messages[String(outcomeCode || '')] || 'Chưa lưu được dữ liệu. Thông tin bạn nhập vẫn được giữ nguyên.'
}
