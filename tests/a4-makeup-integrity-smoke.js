import assert from 'node:assert/strict'
import { buildAttendanceBatchCommand, mutateAttendanceBatch } from '../src/cloud-authoritative-attendance-batch.js'
import { pullA4EligibleMissedOccurrences } from '../src/cloud-authoritative-occurrence-attendance.js'
import { normalizeStoredAttendanceRecord } from '../src/attendance-records.js'

const change = {
  action: 'SET', studentId: 'student-a', scheduleSessionId: 'makeup-session',
  occurrenceDate: '2026-09-28', expectedRecords: [], attendanceStatus: 'makeup',
}
assert.throws(() => buildAttendanceBatchCommand([{ ...change }]), /Chọn buổi Vắng gốc/)
assert.equal(buildAttendanceBatchCommand([{ ...change, makeupForAttendanceLocalId: 'missed-a' }])
  .changes[0].makeupForAttendanceLocalId, 'missed-a')
assert.equal(buildAttendanceBatchCommand([{
  ...change, attendanceStatus: 'present', makeupForAttendanceLocalId: 'missed-a',
}]).changes[0].makeupForAttendanceLocalId, null)
assert.equal(normalizeStoredAttendanceRecord({
  studentId: 'student-a', date: '2026-09-28', attendanceStatus: 'makeup',
  makeupForAttendanceLocalId: 'missed-a',
}).makeupForAttendanceLocalId, 'missed-a')

const calls = []
const candidates = await pullA4EligibleMissedOccurrences({
  supabase: { rpc: async (name, params) => {
    calls.push({ name, params })
    return { data: { ok: true, center_id: 'center-a', student_id: 'student-a',
      candidates: [{ attendance_local_id: 'missed-a', occurrence_date: '2026-09-15' }] } }
  } },
  centerId: 'center-a', studentId: 'student-a', makeupDate: '2026-09-28',
})
assert.equal(candidates.ok, true)
assert.equal(candidates.candidates[0].attendance_local_id, 'missed-a')
assert.equal(calls[0].name, 'a4_list_eligible_missed_occurrences')

for (const [serverCode, expected] of [
  ['a4_makeup_already_compensated', 'Buổi vắng này đã được học bù.'],
  ['a4_makeup_target_not_absent', 'Buổi được chọn không còn là buổi vắng.'],
  ['a4_makeup_target_future', 'Không thể học bù cho một buổi trong tương lai.'],
  ['a4_makeup_occurrence_not_held', 'Buổi học bù chưa diễn ra.'],
]) {
  const result = await mutateAttendanceBatch({
    supabase: { rpc: async () => ({ error: { message: serverCode } }) },
    centerId: 'center-a', changes: [{ ...change, makeupForAttendanceLocalId: 'missed-a' }],
  })
  assert.equal(result.error, expected)
}

console.log('A4_MAKEUP_INTEGRITY_SMOKE_PASS')
