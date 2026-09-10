import {
  createAttendanceRecordCloudLocalId,
} from './cloud-attendance-records.js'
import {
  buildSessionReportCloudEntity,
} from './cloud-session-reports.js'
import {
  createOperationalCommandIdempotencyKey,
} from './cloud-authoritative-attendance-tuition.js'

export const V23_ATTENDANCE_CONTRACT = 'v2.3-occurrence-v1'
export const V23_ATTENDANCE_CAPABILITY_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
})

const BACKEND_UNAVAILABLE_CODES = new Set(['PGRST202', 'PGRST205', '42P01', '42883'])
const OPERATIONAL_SOURCES = new Set(['admin', 'teacher', 'correction'])
const OPERATIONAL_STATUSES = new Set([
  'present', 'absent', 'excused', 'excusedAbsent', 'unexcusedAbsent', 'makeup', 'trial',
])

export function createV23AttendanceCapabilityState({
  centerId = '',
  status = V23_ATTENDANCE_CAPABILITY_STATUS.IDLE,
  message = '',
} = {}) {
  const normalizedStatus = Object.values(V23_ATTENDANCE_CAPABILITY_STATUS).includes(status)
    ? status
    : V23_ATTENDANCE_CAPABILITY_STATUS.IDLE
  return { centerId: normalizeText(centerId), status: normalizedStatus, message: String(message || '') }
}

export function isV23AttendanceCapabilityReady(state = {}, centerId = '') {
  return state?.status === V23_ATTENDANCE_CAPABILITY_STATUS.READY
    && normalizeText(state?.centerId) === normalizeText(centerId)
}

export function isV23AttendanceBackendUnavailable(error = {}) {
  const code = normalizeText(error?.code || error?.cause?.code)
  const message = normalizeText(error?.message || error?.details || error?.hint).toLowerCase()
  return BACKEND_UNAVAILABLE_CODES.has(code)
    || message.includes('v2_3_get_attendance_capability') && message.includes('does not exist')
    || message.includes('v2_3_mutate_occurrence_attendance') && message.includes('does not exist')
}

export async function pullV23AttendanceCapability({ supabase, centerId } = {}) {
  const normalizedCenterId = normalizeText(centerId)
  if (!supabase || typeof supabase.rpc !== 'function' || !normalizedCenterId) {
    return { ok: false, outcome_code: 'CLIENT_NOT_READY', error: 'Chưa thể kiểm tra tính năng điểm danh nhanh.' }
  }
  let response
  try {
    response = await supabase.rpc('v2_3_get_attendance_capability', {
      p_center_id: normalizedCenterId,
    })
  } catch (error) {
    return { ok: false, outcome_code: 'SERVER_COMMAND_FAILED', error: getV23AttendanceOutcomeMessage('SERVER_COMMAND_FAILED'), detail: error }
  }
  if (response?.error) {
    return isV23AttendanceBackendUnavailable(response.error)
      ? { ok: false, outcome_code: 'BACKEND_NOT_DEPLOYED', unavailable: true, error: 'Điểm danh nhanh tại thời khóa biểu hiện chưa khả dụng.' }
      : { ok: false, outcome_code: 'SERVER_COMMAND_FAILED', error: getV23AttendanceOutcomeMessage('SERVER_COMMAND_FAILED'), detail: response.error }
  }
  const data = response?.data
  if (!data?.ok || data?.status !== 'READY' || normalizeText(data?.center_id) !== normalizedCenterId) {
    return { ok: false, outcome_code: 'INVALID_SERVER_RESULT', error: getV23AttendanceOutcomeMessage('INVALID_SERVER_RESULT') }
  }
  return { ok: true, outcome_code: 'READY', centerId: normalizedCenterId, contract: data.contract }
}

export function getV23OccurrenceAttendanceRecords(records = [], occurrence = {}, studentId = '') {
  const scheduleSessionId = normalizeText(occurrence?.id || occurrence?.scheduleSessionId || occurrence?.sessionId)
  const occurrenceDate = normalizeText(occurrence?.occurrenceDate || occurrence?.date)
  const normalizedStudentId = normalizeText(studentId)
  return (Array.isArray(records) ? records : [])
    .filter((record) =>
      record?.source !== 'initialBaseline'
      && normalizeText(record?.studentId) === normalizedStudentId
      && normalizeText(record?.date || record?.occurrenceDate) === occurrenceDate
      && normalizeText(record?.scheduleSessionId || record?.sessionId) === scheduleSessionId,
    )
    .sort(compareOccurrenceRecords)
}

export function selectCurrentV23OccurrenceAttendanceRecord(records = [], occurrence = {}, studentId = '') {
  const matches = getV23OccurrenceAttendanceRecords(records, occurrence, studentId)
  return matches.find((record) => record?.attendanceAuthority === V23_ATTENDANCE_CONTRACT)
    || matches[0]
    || null
}

export function buildV23OccurrenceAttendanceCommand({
  centerId,
  occurrence,
  attendanceInputs = [],
  currentRecords = [],
  sessionReport = null,
  idempotencyKey = createOperationalCommandIdempotencyKey(),
  userId = null,
} = {}) {
  const normalizedCenterId = normalizeText(centerId)
  const scheduleSessionId = normalizeText(occurrence?.id || occurrence?.scheduleSessionId || occurrence?.sessionId)
  const occurrenceDate = normalizeText(occurrence?.occurrenceDate || occurrence?.date)
  if (!normalizedCenterId || !scheduleSessionId || !isDateKey(occurrenceDate)) {
    throw new Error('Không xác định được buổi học cần điểm danh.')
  }
  const seenStudents = new Set()
  const attendance = (Array.isArray(attendanceInputs) ? attendanceInputs : []).map((input) => {
    const studentId = normalizeText(input?.studentId)
    const source = normalizeText(input?.source)
    const attendanceStatus = normalizeText(input?.attendanceStatus || input?.status)
    if (!studentId || seenStudents.has(studentId) || !OPERATIONAL_SOURCES.has(source)
      || !OPERATIONAL_STATUSES.has(attendanceStatus)) {
      throw new Error('Thông tin điểm danh không hợp lệ hoặc bị trùng học viên.')
    }
    seenStudents.add(studentId)
    const expectedRecords = getV23OccurrenceAttendanceRecords(currentRecords, occurrence, studentId)
      .map((record) => {
        const localId = createAttendanceRecordCloudLocalId(record)
        const version = Number(record?.cloudVersion)
        if (!localId || !Number.isSafeInteger(version) || version < 1) {
          throw new Error('Dữ liệu điểm danh chưa đủ mới. Vui lòng làm mới trước khi lưu.')
        }
        return { local_id: localId, version }
      })
      .sort((a, b) => a.local_id.localeCompare(b.local_id))
    return {
      student_id: studentId,
      source,
      attendance_status: attendanceStatus,
      expected_records: expectedRecords,
      payload: stripCloudFields({
        ...input,
        studentId,
        date: occurrenceDate,
        scheduleSessionId,
        sessionId: scheduleSessionId,
        classSessionId: normalizeText(occurrence?.classSessionId || input?.classSessionId),
        attendanceStatus,
        status: attendanceStatus,
        source,
        tuitionPolicyDefined: false,
        tuitionAutoUpdateEnabled: false,
        tuitionConsumptionApplied: false,
      }),
    }
  })
  if (!attendance.length) throw new Error('Chưa có trạng thái điểm danh để lưu.')

  let sessionReportCommand = null
  if (sessionReport) {
    const built = buildSessionReportCloudEntity({ centerId: normalizedCenterId, report: sessionReport, userId })
    if (!built.ok) throw new Error(built.error || 'Báo cáo buổi học không hợp lệ.')
    sessionReportCommand = {
      local_id: built.localId,
      expected_version: Number(sessionReport?.cloudVersion) || 0,
      payload: built.data.payload,
    }
  }
  return {
    centerId: normalizedCenterId,
    idempotencyKey,
    rpc: 'v2_3_mutate_occurrence_attendance',
    params: {
      p_center_id: normalizedCenterId,
      p_schedule_session_id: scheduleSessionId,
      p_occurrence_date: occurrenceDate,
      p_attendance: attendance,
      p_session_report: sessionReportCommand,
      p_idempotency_key: idempotencyKey,
    },
  }
}

export async function mutateV23OccurrenceAttendance({ supabase, ...options } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return { ok: false, outcome_code: 'CLIENT_NOT_READY', error: getV23AttendanceOutcomeMessage('CLIENT_NOT_READY') }
  }
  let command
  try {
    command = buildV23OccurrenceAttendanceCommand(options)
  } catch (error) {
    return { ok: false, outcome_code: 'INVALID_COMMAND', error: String(error?.message || error) }
  }
  let response
  try {
    response = await supabase.rpc(command.rpc, command.params)
  } catch (error) {
    return { ok: false, outcome_code: 'SERVER_COMMAND_FAILED', error: getV23AttendanceOutcomeMessage('SERVER_COMMAND_FAILED'), detail: error, idempotencyKey: command.idempotencyKey }
  }
  if (response?.error) {
    const unavailable = isV23AttendanceBackendUnavailable(response.error)
    return {
      ok: false,
      unavailable,
      outcome_code: unavailable ? 'BACKEND_NOT_DEPLOYED' : mapRpcErrorCode(response.error),
      error: unavailable
        ? 'Điểm danh nhanh tại thời khóa biểu hiện chưa khả dụng.'
        : getV23AttendanceOutcomeMessage(mapRpcErrorCode(response.error)),
      detail: response.error,
      idempotencyKey: command.idempotencyKey,
    }
  }
  const data = response?.data
  if (!data?.ok) {
    return { ...data, ok: false, error: getV23AttendanceOutcomeMessage(data?.outcome_code), idempotencyKey: command.idempotencyKey }
  }
  if (normalizeText(data?.center_id) !== command.centerId
    || normalizeText(data?.schedule_session_id) !== command.params.p_schedule_session_id
    || normalizeText(data?.occurrence_date) !== command.params.p_occurrence_date
    || !Array.isArray(data?.results)) {
    return { ok: false, outcome_code: 'INVALID_SERVER_RESULT', error: getV23AttendanceOutcomeMessage('INVALID_SERVER_RESULT'), idempotencyKey: command.idempotencyKey }
  }
  return { ...data, ok: true, records: data.results, idempotencyKey: command.idempotencyKey }
}

export function getV23AttendanceOutcomeMessage(outcomeCode) {
  const messages = {
    CLIENT_NOT_READY: 'Chưa thể kết nối để lưu điểm danh. Thông tin bạn nhập vẫn được giữ nguyên.',
    BACKEND_NOT_DEPLOYED: 'Điểm danh nhanh tại thời khóa biểu hiện chưa khả dụng.',
    INVALID_COMMAND: 'Thông tin điểm danh không hợp lệ.',
    INVALID_SERVER_RESULT: 'Chưa thể xác nhận dữ liệu đã lưu. Vui lòng làm mới trước khi tiếp tục.',
    VERSION_CONFLICT: 'Điểm danh đã được tài khoản khác cập nhật. Vui lòng làm mới trước khi lưu.',
    ATTENDANCE_VERSION_CONFLICT: 'Điểm danh đã thay đổi. Vui lòng làm mới trước khi lưu.',
    IDEMPOTENCY_CONFLICT: 'Yêu cầu lưu lại không còn khớp với thông tin hiện tại.',
    CENTER_ACCESS_DENIED: 'Tài khoản không còn quyền tại cơ sở này.',
    SERVER_COMMAND_FAILED: 'Chưa thể xác nhận đã lưu. Thông tin bạn nhập vẫn được giữ nguyên; vui lòng làm mới trước khi thử lại.',
  }
  return messages[normalizeText(outcomeCode)] || 'Chưa lưu được điểm danh. Thông tin bạn nhập vẫn được giữ nguyên.'
}

function mapRpcErrorCode(error = {}) {
  const message = normalizeText(error?.message).toLowerCase()
  if (message.includes('v2_3_attendance_version_conflict')) return 'ATTENDANCE_VERSION_CONFLICT'
  if (message.includes('v2_3_idempotency_conflict')) return 'IDEMPOTENCY_CONFLICT'
  if (message.includes('v2_3_center_access_denied')) return 'CENTER_ACCESS_DENIED'
  return 'SERVER_COMMAND_FAILED'
}

function compareOccurrenceRecords(a = {}, b = {}) {
  const aCanonical = a?.attendanceAuthority === V23_ATTENDANCE_CONTRACT ? 1 : 0
  const bCanonical = b?.attendanceAuthority === V23_ATTENDANCE_CONTRACT ? 1 : 0
  if (aCanonical !== bCanonical) return bCanonical - aCanonical
  const priority = { correction: 3, admin: 2, teacher: 1 }
  const sourceDelta = (priority[b?.source] || 0) - (priority[a?.source] || 0)
  if (sourceDelta) return sourceDelta
  const versionDelta = (Number(b?.cloudVersion) || 0) - (Number(a?.cloudVersion) || 0)
  if (versionDelta) return versionDelta
  return normalizeText(a?.id).localeCompare(normalizeText(b?.id))
}

function stripCloudFields(value = {}) {
  const result = { ...value }
  for (const key of ['cloudVersion', 'cloudUpdatedAt', 'cloudDeletedAt', 'updatedAt', 'authorityLocalId', 'attendanceAuthority']) {
    delete result[key]
  }
  return result
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
