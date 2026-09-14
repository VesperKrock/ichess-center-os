export const V28A_ATTENDANCE_OPERATIONS_CONTRACT = 'v2.8a-attendance-operations-v1'

export const V28A_ATTENDANCE_OPERATIONS_CAPABILITY_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
})

const BACKEND_UNAVAILABLE_CODES = new Set(['PGRST202', 'PGRST205', '42P01', '42883'])
const REMINDER_SIGNALS = new Set(['REVIEW_UPDATE_DUE', 'TBHP_SEND_DUE', 'PAYMENT_CHECK_DUE'])

export function createV28AAttendanceOperationsCapabilityState(overrides = {}) {
  return {
    centerId: '',
    status: V28A_ATTENDANCE_OPERATIONS_CAPABILITY_STATUS.IDLE,
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    ...overrides,
  }
}

export function isV28AAttendanceOperationsCapabilityReady(state = {}, centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return Boolean(
    normalizedCenterId
      && state.status === V28A_ATTENDANCE_OPERATIONS_CAPABILITY_STATUS.READY
      && cleanText(state.centerId) === normalizedCenterId,
  )
}

export function isV28AAttendanceOperationsBackendUnavailable(result = {}) {
  const codes = [result?.outcome_code, result?.code, result?.detail?.code]
    .map((value) => cleanText(value).toUpperCase())
  const detail = [result?.error, result?.message, result?.details, result?.hint, result?.detail?.message]
    .map(cleanText)
    .join(' ')
    .toLowerCase()
  return codes.some((code) => BACKEND_UNAVAILABLE_CODES.has(code))
    || detail.includes('v2_8a_list_attendance_operations') && detail.includes('does not exist')
}

export async function pullV28AAttendanceOperations({ supabase, centerId } = {}) {
  const normalizedCenterId = cleanText(centerId)
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY')
  if (!normalizedCenterId) return failure('INVALID_CENTER')
  try {
    const { data, error } = await supabase.rpc('v2_8a_list_attendance_operations', {
      p_center_id: normalizedCenterId,
    })
    if (error) return rpcFailure(error, 'READ_FAILED')
    if (!data?.ok || data.status !== 'READY'
      || data.contract !== V28A_ATTENDANCE_OPERATIONS_CONTRACT
      || cleanText(data.center_id) !== normalizedCenterId
      || !Array.isArray(data.reminders)
      || !Array.isArray(data.tbhp_checkpoints)
      || !Array.isArray(data.cell_notes)) {
      return failure('INVALID_SERVER_RESULT')
    }
    const reminders = data.reminders.map((row) => projectReminder(row, normalizedCenterId))
    const tbhpCheckpoints = data.tbhp_checkpoints.map((row) => projectTbhpCheckpoint(row, normalizedCenterId))
    const cellNotes = data.cell_notes.map((row) => projectCellNote(row, normalizedCenterId))
    if (reminders.some((row) => !row) || tbhpCheckpoints.some((row) => !row)
      || cellNotes.some((row) => !row)) return failure('INVALID_SERVER_RESULT')
    return {
      ok: true,
      outcome_code: 'AUTHORITATIVE_SNAPSHOT',
      centerId: normalizedCenterId,
      reminders,
      tbhpCheckpoints,
      cellNotes,
    }
  } catch (error) {
    return rpcFailure(error, 'READ_FAILED')
  }
}

export async function mutateV28AAttendanceOperation({
  supabase,
  centerId,
  command,
  idempotencyKey = createV28AAttendanceOperationIdempotencyKey(),
} = {}) {
  const normalizedCenterId = cleanText(centerId)
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY', idempotencyKey)
  if (!normalizedCenterId || !isPlainObject(command)) return failure('INVALID_COMMAND', idempotencyKey)
  try {
    const { data, error } = await supabase.rpc('v2_8a_mutate_attendance_operation', {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return rpcFailure(error, 'WRITE_FAILED', idempotencyKey)
    if (!data?.ok || cleanText(data.center_id) !== normalizedCenterId
      || cleanText(data.outcome_code) !== 'COMMITTED') {
      return failure(cleanText(data?.outcome_code) || 'INVALID_SERVER_RESULT', idempotencyKey)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return rpcFailure(error, 'WRITE_FAILED', idempotencyKey)
  }
}

export function buildV28AMarkTbhpSentCommand(reminder = {}) {
  if (cleanText(reminder.signal) !== 'TBHP_SEND_DUE') {
    throw new Error('Nhắc việc này không phải bước gửi TBHP.')
  }
  return {
    operation: 'MARK_TBHP_SENT',
    cycle_id: requireUuid(reminder.cycleId, 'Không xác định được chu kỳ cần gửi TBHP.'),
    expected_version: requireNonNegativeInteger(
      reminder.checkpointVersion,
      'Trạng thái gửi TBHP chưa đủ mới. Hãy làm mới rồi thử lại.',
    ),
  }
}

export function buildV28AUpsertCellNoteCommand(note = {}) {
  const version = requireNonNegativeInteger(note.version ?? note.cloudVersion ?? 0, 'Ghi chú chưa đủ mới.')
  const noteId = cleanText(note.id)
  return {
    operation: 'UPSERT_CELL_NOTE',
    note_id: version ? requireUuid(noteId, 'Không xác định được ghi chú cần sửa.') : null,
    expected_version: version,
    student_id: requireText(note.studentId, 'Không xác định được học viên.'),
    schedule_session_id: requireText(note.scheduleSessionId, 'Không xác định được buổi học.'),
    occurrence_date: requireDateKey(note.occurrenceDate, 'Ngày điểm danh không hợp lệ.'),
    note: cleanText(note.note).slice(0, 4000),
  }
}

export function createV28AAttendanceOperationIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không thể tạo mã an toàn cho thao tác này.')
  }
  return globalThis.crypto.randomUUID()
}

export function createV28AAttendanceOperationRetryFingerprint(command = {}) {
  return stableStringify(command)
}

export function getV28AAttendanceOperationOutcomeMessage(outcomeCode = '') {
  const messages = {
    CLIENT_NOT_READY: 'Cần đăng nhập và chọn đúng cơ sở trước khi cập nhật điểm danh.',
    INVALID_CENTER: 'Chưa xác định được cơ sở đang hoạt động.',
    INVALID_COMMAND: 'Thông tin thao tác điểm danh chưa hợp lệ.',
    INVALID_PAYLOAD: 'Nội dung cần lưu chưa hợp lệ.',
    BACKEND_NOT_DEPLOYED: 'Ghi chú ô điểm danh và nhắc việc hiện chưa khả dụng.',
    CENTER_ACCESS_DENIED: 'Tài khoản hiện tại không có quyền cập nhật tại cơ sở này.',
    RESOURCE_NOT_FOUND_OR_DENIED: 'Chu kỳ không còn tồn tại hoặc không thuộc cơ sở hiện tại.',
    OCCURRENCE_NOT_FOUND_OR_DENIED: 'Ô điểm danh không còn tồn tại hoặc không thuộc cơ sở hiện tại.',
    REMINDER_NOT_DUE: 'Chu kỳ này chưa đến mốc gửi TBHP.',
    VERSION_STALE: 'Dữ liệu đã thay đổi ở nơi khác. Hãy làm mới trước khi lưu.',
    IDEMPOTENCY_CONFLICT: 'Lần thử lại không còn khớp với nội dung ban đầu.',
    READ_FAILED: 'Chưa tải được ghi chú ô điểm danh và nhắc việc mới nhất.',
    WRITE_FAILED: 'Chưa thể xác nhận đã lưu. Nội dung bạn nhập vẫn được giữ nguyên.',
    INVALID_SERVER_RESULT: 'Chưa thể xác nhận dữ liệu điểm danh mới nhất.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đã thay đổi; kết quả cũ không được sử dụng.',
  }
  return messages[cleanText(outcomeCode).toUpperCase()]
    || 'Chưa thể hoàn tất thao tác điểm danh lúc này.'
}

function projectReminder(row = {}, centerId = '') {
  const cycleNumber = Number(row.cycle_number)
  const remainingSessions = Number(row.remaining_sessions)
  const checkpointVersion = Number(row.checkpoint_version)
  const signal = cleanText(row.signal).toUpperCase()
  const severity = cleanText(row.severity).toLowerCase()
  if (cleanText(row.center_id) !== centerId || !cleanText(row.student_id)
    || !isUuid(row.cycle_id) || !Number.isSafeInteger(cycleNumber) || cycleNumber < 1
    || !REMINDER_SIGNALS.has(signal) || !['warning', 'danger'].includes(severity)
    || !Number.isSafeInteger(remainingSessions) || remainingSessions < 0
    || !Number.isSafeInteger(checkpointVersion) || checkpointVersion < 0
    || !isDateKey(row.trigger_date)) return null
  return {
    centerId,
    studentId: cleanText(row.student_id),
    cycleId: cleanText(row.cycle_id),
    cycleNumber,
    signal,
    label: cleanText(row.label),
    severity,
    remainingSessions,
    triggerDate: cleanText(row.trigger_date),
    checkpointVersion,
  }
}

function projectTbhpCheckpoint(row = {}, centerId = '') {
  const version = Number(row.version)
  if (cleanText(row.center_id) !== centerId || !isUuid(row.cycle_id)
    || !cleanText(row.student_id) || !Number.isSafeInteger(version) || version < 1
    || !isIsoDate(row.tbhp_sent_at) || !isIsoDate(row.created_at) || !isIsoDate(row.updated_at)) return null
  return {
    centerId,
    cycleId: cleanText(row.cycle_id),
    studentId: cleanText(row.student_id),
    sentAt: cleanText(row.tbhp_sent_at),
    sentByUserId: cleanText(row.tbhp_sent_by_user_id),
    version,
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function projectCellNote(row = {}, centerId = '') {
  const version = Number(row.version)
  if (cleanText(row.center_id) !== centerId || !isUuid(row.id)
    || !cleanText(row.student_id) || !cleanText(row.schedule_session_id)
    || !isDateKey(row.occurrence_date) || !Number.isSafeInteger(version) || version < 1
    || cleanText(row.note).length > 4000 || !isIsoDate(row.created_at) || !isIsoDate(row.updated_at)) return null
  return {
    id: cleanText(row.id),
    centerId,
    studentId: cleanText(row.student_id),
    scheduleSessionId: cleanText(row.schedule_session_id),
    occurrenceDate: cleanText(row.occurrence_date),
    note: String(row.note || ''),
    version,
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function rpcFailure(error = {}, fallback, idempotencyKey = '') {
  const unavailable = isV28AAttendanceOperationsBackendUnavailable({ detail: error })
  const result = failure(unavailable ? 'BACKEND_NOT_DEPLOYED' : fallback, idempotencyKey, error)
  result.unavailable = unavailable
  return result
}

function failure(outcomeCode, idempotencyKey = '', detail = null) {
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: getV28AAttendanceOperationOutcomeMessage(outcomeCode),
    idempotencyKey,
    detail,
  }
}

function requireText(value, message) {
  const normalized = cleanText(value)
  if (!normalized) throw new Error(message)
  return normalized
}

function requireUuid(value, message) {
  const normalized = cleanText(value)
  if (!isUuid(normalized)) throw new Error(message)
  return normalized
}

function requireDateKey(value, message) {
  const normalized = cleanText(value)
  if (!isDateKey(normalized)) throw new Error(message)
  return normalized
}

function requireNonNegativeInteger(value, message) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(message)
  return number
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value))
}

function isDateKey(value) {
  const normalized = cleanText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false
  const date = new Date(`${normalized}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized
}

function isIsoDate(value) {
  const date = new Date(cleanText(value))
  return !Number.isNaN(date.getTime())
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function cleanText(value) {
  return String(value ?? '').trim()
}
