import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildAttendanceBoardRows,
  renderAttendanceBoardModule,
} from '../src/attendance-board-module.js'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'
import {
  createInitialBaselineAttendanceRecord,
  getAttendanceRecordsStorageKey,
} from '../src/attendance-records.js'

function createLocalStorageMock() {
  const values = new Map()
  let writeCount = 0

  return {
    values,
    get writeCount() {
      return writeCount
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      writeCount += 1
      values.set(key, value)
    },
    removeItem(key) {
      writeCount += 1
      values.delete(key)
    },
  }
}

const boardSource = fs.readFileSync(new URL('../src/attendance-board-module.js', import.meta.url), 'utf8')
assert(
  boardSource.includes('buildUnifiedAttendanceRecords'),
  'Module 13 should read through the unified attendance records helper',
)
assert(
  boardSource.includes('loadStoredAttendanceRecords'),
  'Module 13 should load stored canonical attendance records',
)

const dataset = buildAngelWingsRealDataset()
const sessionReports = JSON.parse(JSON.stringify(dataset.sessionReports))
const sessionReportsSnapshot = JSON.stringify(sessionReports)
const baselineDate = '2026-06-19'
const baselineStudent = dataset.students[0]
const baselineRecord = createInitialBaselineAttendanceRecord({
  id: 'baseline-f19c2-001',
  studentId: baselineStudent.id,
  date: baselineDate,
  attendanceStatus: 'present',
  status: 'present',
  note: 'Dữ liệu nền chuyển từ bảng cũ.',
  creditNumber: 5,
  creditLabel: '5',
  creditValue: 1,
  createdAt: '2026-06-19T07:00:00.000Z',
  updatedAt: '2026-06-19T07:00:00.000Z',
})
const storedRecords = [JSON.parse(JSON.stringify(baselineRecord))]
const storedRecordsSnapshot = JSON.stringify(storedRecords)
const legacyDemoReport = {
  id: 'legacy-demo-f19c2',
  sessionId: 'legacy-demo-f19c2',
  occurrenceDate: baselineDate,
  sourceModule: 'bang-diem-danh-demo',
  isDemoAttendance: true,
  attendance: [
    {
      studentId: baselineStudent.id,
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
  { month: '2026-06', classSessionId: 'all', query: '' },
  [],
  storedRecords,
)
assert.equal(JSON.stringify(sessionReports), sessionReportsSnapshot, 'Board read path must not mutate sessionReports')
assert.equal(JSON.stringify(storedRecords), storedRecordsSnapshot, 'Board read path must not mutate stored records')

const baselineRow = rows.find((row) => row.student.id === baselineStudent.id)
assert(baselineRow, 'Expected baseline student row')
const baselineAttendance = baselineRow.attendanceSummary.byDate.get(baselineDate)
assert(baselineAttendance, 'Stored baseline record should appear in board lookup')
assert.equal(baselineAttendance.source, 'initialBaseline')
assert.equal(baselineAttendance.isInitialBaseline, true)
assert.equal(baselineAttendance.note, 'Dữ liệu nền chuyển từ bảng cũ.')
assert.equal(baselineAttendance.attendanceStatus, 'present')
assert.equal(baselineAttendance.credits[0].sessionNumber, 5)

const combinedRow = rows.find((row) =>
  row.attendanceSummary.byDate.get('2026-06-06')?.credits?.some((credit) => credit.sessionNumber === 8),
)
assert(combinedRow, 'Expected existing Angel Wings multi-credit row')
const combinedAttendance = combinedRow.attendanceSummary.byDate.get('2026-06-06')
assert.equal(combinedAttendance.sourceTag, 'angel-wings-2026-06')
assert.equal(combinedAttendance.isImportedAttendance, true)
assert.equal(combinedAttendance.isCombinedCredit, true)
assert.deepEqual(
  combinedAttendance.credits.map((credit) => credit.sessionNumber),
  [7, 8],
  'Multi-credit sessionReports should still group into one board cell',
)

const storage = createLocalStorageMock()
const recordsKey = getAttendanceRecordsStorageKey('dreamhome')
storage.values.set(recordsKey, JSON.stringify([baselineRecord]))
storage.values.set('ichessCenterOS.sessionReports.dreamhome', JSON.stringify([{ id: 'report-cu' }]))
globalThis.localStorage = storage
const storageSnapshot = JSON.stringify(Array.from(storage.values.entries()))
const html = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  [...sessionReports, legacyDemoReport],
  [],
  { month: '2026-06', classSessionId: 'all', query: baselineStudent.fullName },
  { studentId: baselineStudent.id, dateKey: baselineDate },
)
assert(html.includes('Dữ liệu nền ban đầu'), 'Rendered board detail should label baseline source')
assert(html.includes('Dữ liệu nền chuyển từ bảng cũ.'))
assert(!html.includes('Dữ liệu demo cũ không được hiển thị.'))
assert.equal(
  JSON.stringify(Array.from(storage.values.entries())),
  storageSnapshot,
  'Rendering Module 13 must not write localStorage',
)
assert.equal(storage.writeCount, 0, 'Rendering Module 13 must not set/remove localStorage keys')
assert.equal(storage.values.has(recordsKey), true, 'Stored attendanceRecords key should be read, not backfilled')

console.log('F19C.2 bảng điểm danh đọc dữ liệu điểm danh hợp nhất smoke passed')
