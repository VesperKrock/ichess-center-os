import assert from 'node:assert/strict'

import {
  buildAttendanceRecordsFromSessionReports,
  createAttendanceRecordId,
  getAttendanceRecordSource,
  isCountedAttendanceRecord,
  normalizeAttendanceRecordFromSessionReport,
} from '../src/attendance-records.js'
import {
  ANGEL_WINGS_SOURCE_TAG,
  buildAngelWingsRealDataset,
} from '../src/attendance-board-angel-wings-data.js'

const dataset = buildAngelWingsRealDataset()
const sourceReports = JSON.parse(JSON.stringify(dataset.sessionReports))
const sourceSnapshot = JSON.stringify(sourceReports)
const records = buildAttendanceRecordsFromSessionReports(sourceReports)

assert(records.length > 0, 'Adapter should return canonical attendance records')
assert.equal(JSON.stringify(sourceReports), sourceSnapshot, 'Adapter must not mutate sessionReports')

const firstRecord = records[0]
assert(firstRecord.id, 'Record should have deterministic id')
assert(firstRecord.studentId, 'Record should preserve studentId')
assert(firstRecord.date, 'Record should have attendance date')
assert(firstRecord.sourceReportId, 'Record should keep sourceReportId')
assert(Number.isInteger(firstRecord.sourceAttendanceIndex), 'Record should keep sourceAttendanceIndex')
assert(firstRecord.status, 'Record should preserve status')
assert(firstRecord.attendanceStatus, 'Record should preserve attendanceStatus')
assert.equal(firstRecord.source, 'imported', 'Angel Wings records should map to imported source')
assert.equal(firstRecord.raw.report.sourceTag, ANGEL_WINGS_SOURCE_TAG)
assert.equal(firstRecord.raw.attendanceItem.sourceTag, ANGEL_WINGS_SOURCE_TAG)

const trialRecord = records.find((record) => record.attendanceStatus === 'trial')
assert(trialRecord, 'Adapter should preserve trial attendance')
assert.equal(trialRecord.counted, false, 'Trial attendance should follow source countsTowardTuition=false')
assert.equal(trialRecord.creditLabel, 'T')
assert.equal(trialRecord.creditValue, 0)
assert(trialRecord.note.includes('Học thử'), 'Trial note should be preserved')

const combinedReport = sourceReports.find((report) =>
  report.attendance.some((item) => item.displayValue === '3+4'),
)
const combinedItemIndex = combinedReport.attendance.findIndex((item) => item.displayValue === '3+4')
const combinedItem = combinedReport.attendance[combinedItemIndex]
const combinedRecords = normalizeAttendanceRecordFromSessionReport(
  combinedReport,
  combinedItem,
  combinedItemIndex,
)
assert.equal(combinedRecords.length, 2, 'Combined credits should become one canonical record per credit')
assert.deepEqual(
  combinedRecords.map((record) => record.creditNumber),
  [3, 4],
)
assert(combinedRecords.every((record) => record.counted === true))
assert(combinedRecords.every((record) => record.classSessionId === combinedItem.classSessionId))
assert(combinedRecords.every((record) => record.teacherId === combinedItem.teacherId))
assert(combinedRecords.every((record) => record.teacherName === combinedReport.teacherName))

const demoReport = {
  id: 'legacy-demo-report',
  sessionId: 'legacy-demo-session',
  occurrenceDate: '2026-06-01',
  sourceModule: 'bang-diem-danh-demo',
  isDemoAttendance: true,
  attendance: [{ studentId: 'student-demo', attendanceStatus: 'present' }],
}
const demoRecords = buildAttendanceRecordsFromSessionReports([demoReport])
assert.equal(demoRecords.length, 0, 'Legacy demo attendance reports should be skipped')

const minimalReport = {
  id: 'minimal-report',
  sessionId: 'schedule-minimal',
  occurrenceDate: '2026-06-19',
  attendance: [
    {
      studentId: 'student-minimal',
      attendanceStatus: 'excusedAbsent',
      note: 'Có phép.',
    },
    {
      attendanceStatus: 'present',
    },
  ],
}
const minimalRecords = buildAttendanceRecordsFromSessionReports([minimalReport])
assert.equal(minimalRecords.length, 1, 'Items without studentId should be skipped')
assert.equal(minimalRecords[0].classSessionId, null)
assert.equal(minimalRecords[0].teacherId, null)
assert.equal(minimalRecords[0].teacherName, null)
assert.equal(minimalRecords[0].counted, false, 'Excused absent should not count')
assert.equal(minimalRecords[0].note, 'Có phép.')

assert.equal(
  createAttendanceRecordId(minimalReport, minimalReport.attendance[0], 0, 0),
  createAttendanceRecordId(minimalReport, minimalReport.attendance[0], 0, 0),
  'Record id should be deterministic',
)
assert.equal(getAttendanceRecordSource({ sourceModule: 'schedule-report' }, {}), 'legacyReport')
assert.equal(isCountedAttendanceRecord({ attendanceStatus: 'present' }), true)
assert.equal(isCountedAttendanceRecord({ attendanceStatus: 'unexcusedAbsent' }), false)

const storage = new Map()
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null
  },
  setItem(key, value) {
    storage.set(key, value)
  },
  removeItem(key) {
    storage.delete(key)
  },
}
buildAttendanceRecordsFromSessionReports(sourceReports)
assert(
  !Array.from(storage.keys()).some((key) => key.toLowerCase().includes('attendancerecord')),
  'Adapter must not write attendanceRecords storage',
)

console.log('F19B.2 attendance records adapter smoke passed')
