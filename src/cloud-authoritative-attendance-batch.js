import { createOperationalCommandIdempotencyKey } from './cloud-authoritative-attendance-tuition.js'

export const ATTENDANCE_BATCH_RPC = 'v2_9_mutate_attendance_batch'
export const ATTENDANCE_WRITE_STATUSES = Object.freeze(['present', 'absent', 'makeup'])
const statuses = new Set(ATTENDANCE_WRITE_STATUSES)
const dateKey = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function buildAttendanceBatchCommand(changes = []) {
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > 500) {
    throw new Error('Chọn từ 1 đến 500 thay đổi điểm danh để lưu.')
  }
  const seen = new Set()
  return {
    operation: 'SAVE_ATTENDANCE',
    changes: changes.map(change => {
      const action = String(change?.action || '').trim().toUpperCase()
      const studentId = String(change?.studentId || '').trim()
      const scheduleSessionId = String(change?.scheduleSessionId || '').trim()
      const occurrenceDate = String(change?.occurrenceDate || '').trim()
      const key = JSON.stringify([studentId, scheduleSessionId, occurrenceDate])
      if (!['SET', 'UNMARK'].includes(action) || !studentId || !scheduleSessionId
        || !dateKey(occurrenceDate) || seen.has(key)) {
        throw new Error('Thay đổi điểm danh không hợp lệ hoặc trùng học viên và buổi học.')
      }
      seen.add(key)
      if (!Array.isArray(change?.expectedRecords)) {
        throw new Error('Phiên bản điểm danh không hợp lệ. Vui lòng tải lại.')
      }
      const expectedRecords = change.expectedRecords
        .map(row => ({ localId: String(row?.localId || '').trim(), version: Number(row?.version) }))
      if (expectedRecords.some(row => !row.localId || !Number.isSafeInteger(row.version) || row.version < 1)
        || new Set(expectedRecords.map(row => row.localId)).size !== expectedRecords.length) {
        throw new Error('Phiên bản điểm danh không hợp lệ. Vui lòng tải lại.')
      }
      const base = { action, studentId, scheduleSessionId, occurrenceDate, expectedRecords }
      if (action === 'UNMARK') return base
      const attendanceStatus = String(change?.attendanceStatus || '').trim()
      if (!statuses.has(attendanceStatus)) throw new Error('Trạng thái điểm danh không hợp lệ.')
      const makeupForAttendanceLocalId = attendanceStatus === 'makeup'
        ? String(change?.makeupForAttendanceLocalId || '').trim() : null
      if (attendanceStatus === 'makeup' && !makeupForAttendanceLocalId) {
        throw new Error('Chọn buổi Vắng gốc để học bù.')
      }
      const absenceReason = attendanceStatus === 'absent' && change?.absenceReason != null
        ? String(change.absenceReason).trim() : null
      if (attendanceStatus === 'absent' && change?.absenceReason != null
        && (!absenceReason || absenceReason.length > 1000 || absenceReason === 'Chưa có lý do')) {
        throw new Error('Lý do vắng không hợp lệ.')
      }
      return { ...base, attendanceStatus, absenceReason, makeupForAttendanceLocalId }
    }),
  }
}

export function normalizeAttendanceBatchError(error) {
  const message = String(error?.message || error || '')
  const code = [
    'n2_attendance_version_conflict', 'n2_idempotency_conflict',
    'n2_student_not_in_occurrence_roster', 'n2_unsupported_attendance_status',
    'n2_makeup_target_required', 'a4_makeup_already_compensated',
    'a4_makeup_target_not_absent', 'a4_makeup_target_future',
    'a4_makeup_occurrence_not_held', 'a4_makeup_wrong_student',
    'a4_makeup_target_not_found', 'a4_compensated_absence_locked',
    'n3_booked_absence_locked', 'n3_booking_destination_mismatch',
    'a2_occurrence_not_held',
  ].find(item => message.includes(item))
    || (error?.code === '23505' && message.includes('center_cloud_entities_a4_makeup_target_unique')
      ? 'a4_makeup_already_compensated' : 'SERVER_COMMAND_FAILED')
  const labels = {
    n2_attendance_version_conflict: 'Điểm danh đã thay đổi. Vui lòng tải lại trước khi lưu.',
    n2_idempotency_conflict: 'Yêu cầu lưu này đã được dùng cho thay đổi khác.',
    n2_student_not_in_occurrence_roster: 'Học viên không thuộc danh sách buổi học.',
    n2_unsupported_attendance_status: 'Trạng thái điểm danh không hợp lệ.',
    n2_makeup_target_required: 'Chọn buổi Vắng gốc để học bù.',
    a4_makeup_already_compensated: 'Buổi vắng này đã được học bù.',
    a4_makeup_target_not_absent: 'Buổi được chọn không còn là buổi vắng.',
    a4_makeup_target_future: 'Không thể học bù cho một buổi trong tương lai.',
    a4_makeup_occurrence_not_held: 'Buổi học bù chưa diễn ra.',
    a4_makeup_wrong_student: 'Buổi vắng được chọn không thuộc học viên này.',
    a4_makeup_target_not_found: 'Không tìm thấy buổi Vắng gốc tại cơ sở này.',
    a4_compensated_absence_locked: 'Hãy bỏ hoặc đổi liên kết Học bù trước khi sửa buổi Vắng gốc.',
    n3_booked_absence_locked: 'Hủy lịch học bù trước khi thay đổi buổi Vắng gốc.',
    n3_booking_destination_mismatch: 'Lịch học bù đã đổi. Vui lòng làm mới rồi chọn đúng buổi.',
    a2_occurrence_not_held: 'Buổi học chưa kết thúc. Các thay đổi vẫn được giữ để lưu sau.',
    SERVER_COMMAND_FAILED: 'Chưa thể xác nhận đã lưu điểm danh. Vui lòng tải lại trước khi thử lại.',
  }
  return { outcome_code: code.toUpperCase(), error: labels[code] }
}

export async function mutateAttendanceBatch({ supabase, centerId, changes,
  idempotencyKey = createOperationalCommandIdempotencyKey() } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function' || !String(centerId || '').trim()) {
    return { ok: false, outcome_code: 'CLIENT_NOT_READY', error: 'Chưa thể kết nối để lưu điểm danh.' }
  }
  let command
  try { command = buildAttendanceBatchCommand(changes) }
  catch (error) { return { ok: false, outcome_code: 'INVALID_COMMAND', error: String(error.message || error) } }
  try {
    const { data, error } = await supabase.rpc(ATTENDANCE_BATCH_RPC, {
      p_center_id: String(centerId).trim(), p_command: command, p_idempotency_key: idempotencyKey,
    })
    if (error) return { ok: false, ...normalizeAttendanceBatchError(error), idempotencyKey }
    if (!data?.ok || data?.outcome_code !== 'COMMITTED' || !data?.audit_batch_id
      || data?.change_count !== command.changes.length || !Array.isArray(data?.results)) {
      return { ok: false, outcome_code: 'INVALID_SERVER_RESULT', error: 'Phản hồi lưu điểm danh không đầy đủ.', idempotencyKey }
    }
    return { ...data, ok: true, auditBatchId: data.audit_batch_id, idempotencyKey }
  } catch (error) {
    return { ok: false, ...normalizeAttendanceBatchError(error), idempotencyKey }
  }
}
