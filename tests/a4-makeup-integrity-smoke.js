import assert from 'node:assert/strict'
import {
  buildV23OccurrenceAttendanceCommand,
  mutateV23OccurrenceAttendance,
  pullA4EligibleMissedOccurrences,
} from '../src/cloud-authoritative-occurrence-attendance.js'
import { normalizeStoredAttendanceRecord } from '../src/attendance-records.js'

const base = {
  centerId: 'center-a',
  occurrence: { id: 'makeup-session', occurrenceDate: '2026-09-28' },
  currentRecords: [],
  idempotencyKey: 'a4000000-0000-4000-8000-000000000301',
}
const input = { studentId: 'student-a', source: 'admin', attendanceStatus: 'makeup' }
assert.throws(() => buildV23OccurrenceAttendanceCommand({
  ...base, attendanceInputs: [input],
}), /Chọn buổi Vắng gốc/)
const corrected = buildV23OccurrenceAttendanceCommand({
  ...base, attendanceInputs: [{ ...input, attendanceStatus: 'present', makeupForAttendanceLocalId: 'missed-a' }],
})
assert.equal(corrected.params.p_attendance[0].makeup_for_attendance_local_id, null)
assert.equal(corrected.params.p_attendance[0].payload.makeupForAttendanceLocalId, null)

const command = buildV23OccurrenceAttendanceCommand({
  ...base,
  attendanceInputs: [{ ...input, makeupForAttendanceLocalId: 'missed-a' }],
})
assert.equal(command.rpc, 'v2_3_mutate_occurrence_attendance')
assert.equal(command.params.p_attendance[0].makeup_for_attendance_local_id, 'missed-a')
assert.equal(command.params.p_attendance[0].payload.makeupForAttendanceLocalId, 'missed-a')
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
assert.deepEqual(calls[0].params, {
  p_center_id: 'center-a', p_student_id: 'student-a', p_makeup_date: '2026-09-28',
})

for (const [serverCode, expected] of [
  ['a4_makeup_already_compensated', 'Buổi vắng này đã được học bù.'],
  ['a4_makeup_target_not_absent', 'Buổi được chọn không còn là buổi vắng.'],
  ['a4_makeup_target_future', 'Không thể học bù cho một buổi trong tương lai.'],
  ['a4_makeup_occurrence_not_held', 'Buổi học bù chưa diễn ra.'],
]) {
  const result = await mutateV23OccurrenceAttendance({
    supabase: { rpc: async () => ({ error: { message: serverCode } }) },
    ...base,
    attendanceInputs: [{ ...input, makeupForAttendanceLocalId: 'missed-a' }],
  })
  assert.equal(result.error, expected)
  assert.equal(result.detail.message, serverCode)
}

console.log('A4_MAKEUP_INTEGRITY_SMOKE_PASS')
