import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import {
  ANGEL_WINGS_PACKAGE_CATALOG_KEY,
  ANGEL_WINGS_SOURCE_TAG,
  buildAngelWingsRealDataset,
  createF15K5BackupSnapshot,
  parseAngelWingsAttendanceCell,
  removeLegacyDemoAttendanceReports,
  summarizeAngelWingsDataset,
  writeAngelWingsPackageCatalog,
} from '../src/attendance-board-angel-wings-data.js'

const sourceText = fs.readFileSync(new URL('../src/attendance-board-angel-wings-data.js', import.meta.url), 'utf8')
assert(!sourceText.includes('localStorage.clear()'), 'importer must not clear all localStorage')

const firstDataset = buildAngelWingsRealDataset()
const secondDataset = buildAngelWingsRealDataset()
assert.deepEqual(secondDataset.summary, firstDataset.summary, 'dataset must be idempotent')

assert.equal(firstDataset.summary.students, 29)
assert.equal(firstDataset.summary.teachers, 1)
assert.equal(firstDataset.summary.parentConsultations, 29)
assert.equal(firstDataset.summary.classSessions, 4)
assert.equal(firstDataset.summary.tuitionPackages, 3)
assert.equal(firstDataset.summary.tuitionRecords, 29)
assert.equal(firstDataset.summary.sessionReports, 23)
assert.equal(firstDataset.summary.attendanceCells, 71)
assert.equal(firstDataset.summary.attendanceCredits, 75)
assert.equal(firstDataset.summary.demoReportsInRealMode, 0)

const packageCatalog = new Map(firstDataset.tuitionPackages.map((item) => [item.id, item]))
assert.equal(packageCatalog.get('package-8-sessions')?.price, 1000000)
assert.equal(packageCatalog.get('package-16-sessions')?.sessionCount, 16)
assert.equal(packageCatalog.get('package-32-sessions')?.price, 3200000)

const teacher = firstDataset.teachers.find((item) => item.fullName === 'Phạm Đức Thắng')
assert(teacher, 'expected main teacher')

const firstStudent = firstDataset.students[0]
assert(firstDataset.parentConsultations.some((contact) => contact.studentId === firstStudent.id))
assert(firstStudent.classSessionIds.length > 0)
assert(firstDataset.tuitionRecords.some((record) => record.studentId === firstStudent.id))

const scheduleSession = firstDataset.schedule[0]
assert(scheduleSession.classSessionId)
assert.equal(scheduleSession.teacherId, teacher.id)
assert(Array.isArray(scheduleSession.studentIds) && scheduleSession.studentIds.length > 0)

const attendanceItems = firstDataset.sessionReports.flatMap((report) => report.attendance)
assert(attendanceItems.every((item) => item.studentId))
assert(attendanceItems.every((item) => item.sourceTag === ANGEL_WINGS_SOURCE_TAG))

const trialCell = parseAngelWingsAttendanceCell('T')
assert.equal(trialCell.status, 'trial')
assert.equal(trialCell.countsTowardTuition, false)
assert.equal(trialCell.credits.length, 1)

const combinedCell = parseAngelWingsAttendanceCell('3+4')
assert.equal(combinedCell.displayValue, '3+4')
assert.deepEqual(
  combinedCell.credits.map((credit) => credit.sessionNumber),
  [3, 4],
)

const cleanedReports = removeLegacyDemoAttendanceReports([
  ...firstDataset.sessionReports,
  {
    id: 'legacy-demo',
    sessionId: 'legacy-demo',
    occurrenceDate: '2026-06-01',
    sourceModule: 'bang-diem-danh-demo',
    isDemoAttendance: true,
    attendance: [],
  },
])
assert.equal(summarizeAngelWingsDataset({ ...firstDataset, sessionReports: cleanedReports }).demoReportsInRealMode, 0)

const html = renderAttendanceBoardModule(
  firstDataset.students,
  firstDataset.classSessions,
  firstDataset.tuitionRecords,
  [
    ...firstDataset.sessionReports,
    {
      id: 'legacy-demo',
      sessionId: 'legacy-demo',
      occurrenceDate: '2026-06-01',
      sourceModule: 'bang-diem-danh-demo',
      isDemoAttendance: true,
      attendance: [{ studentId: firstStudent.id, attendanceStatus: 'present' }],
    },
  ],
  [],
  { month: '2026-06', classSessionId: 'all', query: 'Nguyen Khanh Ngoc' },
)
assert(html.includes('Angel Wings'))
assert(!html.includes('legacy-demo'))

const storage = new Map()
const localStorageMock = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null
  },
  setItem(key, value) {
    storage.set(key, value)
  },
}
localStorageMock.setItem('ichessCenterOS.students.dreamhome', 'old-students')
const backup = createF15K5BackupSnapshot(localStorageMock)
assert(backup.backupKey.startsWith('ichessCenterOS.backup.beforeF15K5AngelWings.'))
writeAngelWingsPackageCatalog(localStorageMock, firstDataset.tuitionPackages)
assert(JSON.parse(localStorageMock.getItem(ANGEL_WINGS_PACKAGE_CATALOG_KEY)).length === 3)

assert(!storage.has('ichessCenterOS.cashflow.dreamhome'), 'smoke must not write cashflow')
assert(!storage.has('ichessCenterOS.cashbookSettings.dreamhome'), 'smoke must not write cashbook')

console.log('F15K.5 Angel Wings real dataset smoke passed')
