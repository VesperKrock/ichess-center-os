import assert from 'node:assert/strict'
import { buildCanonicalAttendanceLedger } from '../src/attendance-ledger.js'
import { buildReportData } from '../src/report-module.js'
const date = '2026-10-16'
const occurrence = { center_id: 'fixture', schedule_session_local_id: 'lesson', occurrence_date: date,
  lifecycle_state: 'HELD', roster_student_ids: ['regular', 'absent'], planned_start_time: '00:15:00', planned_end_time: '00:30:00' }
const record = (studentId, attendanceStatus) => ({ id: studentId, authorityLocalId: studentId, studentId, attendanceStatus,
  scheduleSessionId: 'lesson', sessionId: 'lesson', date, source: 'admin', attendanceAuthority: 'v2.3-occurrence-v1', cloudVersion: 1 })
const records = [record('regular', 'present'), record('absent', 'absent'), record('off-roster', 'present')]
const students = ['regular', 'absent', 'off-roster'].map(id => ({ id, fullName: id }))
const filters = { fromDate: date, toDate: date }, base = { students, occurrences: [occurrence], attendanceRecords: records, filters, now: new Date(date+'T10:00:00+07:00') }
for (const monthlyProjection of [false, true]) {
  const model = buildCanonicalAttendanceLedger({ ...base, monthlyProjection })
  const summary = buildReportData({ filters: { reportDate: date, weekStartDate: '2026-10-12' }, attendanceLedger: model }).attendanceSummary
  assert.equal(summary.presentCount, 2, 'Authorized off-roster PRESENT must appear in both monthly Board and canonical reports')
  assert.equal(summary.absentCount, 1); assert.equal(summary.totalCount, 3)
  assert.equal(model.rows.find(r => r.student.id === 'off-roster').cells[0].offRoster, true)
}
assert.deepEqual(occurrence.roster_student_ids, ['regular', 'absent'], 'Reporting must not rewrite the frozen roster')
const withoutExtra = buildCanonicalAttendanceLedger({ ...base, attendanceRecords: records.slice(0, 2) })
assert.equal(withoutExtra.rows.length, 2, 'Enrollment alone must not add an off-roster participation')
console.log('Canonical off-roster report parity: PASS (Board/report 2 present + 1 absent, frozen roster unchanged)')
