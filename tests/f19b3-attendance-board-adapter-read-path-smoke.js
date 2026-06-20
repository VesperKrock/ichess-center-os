import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildAttendanceBoardRows,
  renderAttendanceBoardModule,
} from '../src/attendance-board-module.js'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'

const boardSource = fs.readFileSync(new URL('../src/attendance-board-module.js', import.meta.url), 'utf8')
assert(
  boardSource.includes("from './attendance-records.js'"),
  'Module 13 should import the canonical attendance adapter',
)
assert(
  boardSource.includes('buildUnifiedAttendanceRecords'),
  'Module 13 read path should build canonical attendance records through the unified adapter',
)

const dataset = buildAngelWingsRealDataset()
const sessionReports = JSON.parse(JSON.stringify(dataset.sessionReports))
const sessionReportsSnapshot = JSON.stringify(sessionReports)
const legacyDemoReport = {
  id: 'legacy-demo-f19b3',
  sessionId: 'legacy-demo-f19b3',
  occurrenceDate: '2026-06-06',
  sourceModule: 'bang-diem-danh-demo',
  isDemoAttendance: true,
  attendance: [
    {
      studentId: dataset.students[0].id,
      attendanceStatus: 'present',
      note: 'Dữ liệu demo cũ không được hiển thị.',
    },
  ],
}

const rows = buildAttendanceBoardRows(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  [...sessionReports, legacyDemoReport],
  [],
  { month: '2026-06', classSessionId: 'all', query: 'Đỗ Minh Tuyết' },
)
const combinedRow = rows.find((row) => row.student.fullName === 'Đỗ Minh Tuyết')
assert(combinedRow, 'Expected Angel Wings combined-credit student row')

const combinedAttendance = combinedRow.attendanceSummary.byDate.get('2026-06-06')
assert(combinedAttendance, 'Expected attendance on 2026-06-06')
assert.equal(combinedAttendance.sourceTag, 'angel-wings-2026-06')
assert.equal(combinedAttendance.attendanceStatus, 'present')
assert.equal(combinedAttendance.isImportedAttendance, true)
assert.equal(combinedAttendance.needsMakeupReview, true)
assert.equal(combinedAttendance.isCombinedCredit, true)
assert.deepEqual(
  combinedAttendance.credits.map((credit) => credit.sessionNumber),
  [7, 8],
  'Multi-credit cell should stay grouped as one board cell with two credits',
)

const html = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  [...sessionReports, legacyDemoReport],
  [],
  { month: '2026-06', classSessionId: 'all', query: 'Đỗ Minh Tuyết' },
  { studentId: combinedRow.student.id, dateKey: '2026-06-06' },
)
assert(html.includes('data-attendance-cell-detail'))
assert(html.includes('>7</span>') && html.includes('>8</span>'))
assert(html.includes('Angel Wings 06/2026'))
assert(!html.includes('legacy-demo-f19b3'))
assert(!html.includes('Dữ liệu demo cũ không được hiển thị.'))
assert.equal(JSON.stringify(sessionReports), sessionReportsSnapshot, 'Board read path must not mutate sessionReports')

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
renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
)
assert.equal(storage.size, 0, 'Adapter read path must not write localStorage')

console.log('F19B.3 attendance board adapter read path smoke passed')
