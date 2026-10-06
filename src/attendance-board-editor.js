import { getCanonicalLedgerAttendance, isAttendanceLedgerOccurrenceFuture } from './attendance-ledger.js'
import { getV23OccurrenceAttendanceRecords } from './cloud-authoritative-occurrence-attendance.js'
import { mutateAttendanceBatch } from './cloud-authoritative-attendance-batch.js'
import { createOperationalCommandIdempotencyKey } from './cloud-authoritative-attendance-tuition.js'

const historical = new Set(['trial', 'excused', 'excusedAbsent', 'unexcusedAbsent'])
export const attendanceDraftCellKey = (studentId, occurrence) => JSON.stringify([
  studentId, occurrence.scheduleSessionId, occurrence.date,
])
export const createAttendanceBoardDraft = (centerId = '') => ({
  centerId, changes: {}, saving: false, message: '', error: '', attempt: null, uncertain: false,
})
export const attendanceDraftCount = draft => Object.keys(draft?.changes || {}).length

export function canEditAttendanceCell(cell, { canWrite = false, saving = false, uncertain = false, now = new Date() } = {}) {
  return Boolean(canWrite && !saving && !uncertain && cell
    && !['future', 'cancelled', 'notExpected'].includes(cell.state)
    && cell.occurrence.lifecycleState !== 'CANCELLED'
    && !isAttendanceLedgerOccurrenceFuture(cell.occurrence, now)
    && !historical.has(cell.record?.attendanceStatus || cell.record?.status))
}

const recordsFor = (records, studentId, occurrence) => getV23OccurrenceAttendanceRecords(
  getCanonicalLedgerAttendance(records), { id: occurrence.scheduleSessionId, occurrenceDate: occurrence.date }, studentId,
)
const expected = records => records.map(record => ({ localId: record.authorityLocalId, version: Number(record.cloudVersion) }))
  .sort((a, b) => a.localId.localeCompare(b.localId))
const valueOf = record => ({
  status: record?.attendanceStatus || record?.status || null,
  reason: ['absent', 'excused', 'excusedAbsent', 'unexcusedAbsent'].includes(record?.attendanceStatus || record?.status)
    ? String(record.absenceReason || '').trim() || null : null,
  makeupTarget: (record?.attendanceStatus || record?.status) === 'makeup' ? record.makeupForAttendanceLocalId || null : null,
})
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function attendanceCellDraftValue(draft, studentId, cell) {
  return draft?.changes?.[attendanceDraftCellKey(studentId, cell.occurrence)]?.value || valueOf(cell.record)
}

export function stageAttendanceCell(draft, { centerId, studentId, cell, records = [], status,
  reason = null, makeupTarget = null, canWrite = false, now = new Date() } = {}) {
  if (draft.centerId !== centerId || !canEditAttendanceCell(cell, { canWrite, saving: draft.saving, uncertain: draft.uncertain, now })) return false
  if (![null, 'present', 'absent', 'makeup'].includes(status)) return false
  if (cell.makeupOnly && (status !== null && status !== 'makeup'
    || status === 'makeup' && makeupTarget !== cell.makeupBooking.source_attendance_local_id)) return false
  if ((cell.sourceBooking || cell.completedMakeup) && status !== 'absent') return false
  const normalizedReason = status === 'absent' ? String(reason || '').trim() || null : null
  if (normalizedReason && (normalizedReason === 'Chưa có lý do' || normalizedReason.length > 1000 || /[\x00-\x1f\x7f]/.test(normalizedReason))) {
    draft.error = 'Nhập lý do vắng hoặc để trống.'
    return false
  }
  if (status === 'makeup' && !makeupTarget) return false
  const key = attendanceDraftCellKey(studentId, cell.occurrence)
  const previous = draft.changes[key]
  const currentRecords = recordsFor(records, studentId, cell.occurrence)
  // An explicit choice after a conflict acknowledges the newly read cell.
  // Background refreshes never replace expected records or overwrite remote edits.
  const base = previous && !previous.conflict ? previous.base : valueOf(cell.record)
  const versions = previous && !previous.conflict ? previous.expectedRecords : expected(currentRecords)
  const value = { status, reason: normalizedReason, makeupTarget: status === 'makeup' ? makeupTarget : null }
  if (same(base, value)) delete draft.changes[key]
  else draft.changes[key] = { studentId, scheduleSessionId: cell.occurrence.scheduleSessionId,
    occurrenceDate: cell.occurrence.date, expectedRecords: versions, base, value, conflict: false }
  draft.message = ''; draft.error = ''; draft.attempt = null
  return true
}

export function reconcileAttendanceDraft(draft, records = []) {
  if (draft.saving || draft.uncertain) return
  for (const change of Object.values(draft.changes)) {
    const current = expected(recordsFor(records, change.studentId,
      { scheduleSessionId: change.scheduleSessionId, date: change.occurrenceDate }))
    if (!same(current, change.expectedRecords)) change.conflict = true
  }
}

export function buildAttendanceDraftChanges(draft) {
  return Object.values(draft.changes).map(change => {
    const base = { action: change.value.status ? 'SET' : 'UNMARK', studentId: change.studentId,
      scheduleSessionId: change.scheduleSessionId, occurrenceDate: change.occurrenceDate,
      expectedRecords: change.expectedRecords.map(record => ({ ...record })) }
    return change.value.status ? { ...base, attendanceStatus: change.value.status,
      absenceReason: change.value.reason, makeupForAttendanceLocalId: change.value.makeupTarget } : base
  })
}

export async function saveAttendanceBoardDraft(draft, { supabase, centerId, canWrite = false, onChange = () => {} } = {}) {
  if (draft.saving || !canWrite || draft.centerId !== centerId || !attendanceDraftCount(draft)) return { ok: false }
  if (Object.values(draft.changes).some(change => change.conflict) && !draft.uncertain) {
    draft.error = 'Dữ liệu vừa được thay đổi. Vui lòng kiểm tra lại các ô đã sửa.'
    onChange(); return { ok: false, outcome_code: 'REVIEW_REQUIRED' }
  }
  const changes = buildAttendanceDraftChanges(draft)
  const fingerprint = JSON.stringify(changes)
  if (!draft.attempt || draft.attempt.fingerprint !== fingerprint) draft.attempt = {
    fingerprint, changes, idempotencyKey: createOperationalCommandIdempotencyKey(),
  }
  draft.saving = true; draft.error = ''; draft.message = ''; onChange()
  const result = await mutateAttendanceBatch({ supabase, centerId, ...draft.attempt })
  draft.saving = false
  if (result.ok) {
    draft.changes = {}; draft.attempt = null; draft.uncertain = false
    draft.message = 'Đã lưu điểm danh'
  } else {
    const conflict = result.outcome_code === 'N2_ATTENDANCE_VERSION_CONFLICT'
    if (conflict) {
      draft.attempt = null
      for (const change of Object.values(draft.changes)) change.conflict = true
    }
    draft.uncertain = ['SERVER_COMMAND_FAILED', 'INVALID_SERVER_RESULT'].includes(result.outcome_code)
    draft.error = conflict ? 'Dữ liệu vừa được thay đổi. Vui lòng kiểm tra lại các ô đã sửa.'
      : draft.uncertain ? 'Chưa xác nhận được đã lưu. Bấm Lưu điểm danh để thử lại.'
        : result.error || 'Chưa lưu được điểm danh. Các thay đổi vẫn được giữ.'
  }
  onChange()
  return result
}
