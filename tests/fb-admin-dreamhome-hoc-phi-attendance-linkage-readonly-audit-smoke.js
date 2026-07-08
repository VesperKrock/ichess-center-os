import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import { buildAttendanceAdvisoryRows } from '../src/attendance-advisory.js'
import { buildUnifiedAttendanceRecords, getStudentAttendanceCredits } from '../src/attendance-records.js'
import { buildTuitionRows } from '../src/tuition-module.js'

const repoRoot = process.cwd()
const docs = fs.readFileSync(
  path.join(repoRoot, 'docs/fb-admin-dreamhome-hoc-phi-attendance-linkage-readonly-audit.md'),
  'utf8',
)
const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main.js'), 'utf8')
const tuitionSource = fs.readFileSync(path.join(repoRoot, 'src/tuition-module.js'), 'utf8')
const studentTuitionLinksSource = fs.readFileSync(path.join(repoRoot, 'src/student-tuition-links.js'), 'utf8')
const advisorySource = fs.readFileSync(path.join(repoRoot, 'src/attendance-advisory.js'), 'utf8')
const cloudTuitionRecordsSource = fs.readFileSync(path.join(repoRoot, 'src/cloud-tuition-records.js'), 'utf8')
const cloudTuitionTermsSource = fs.readFileSync(path.join(repoRoot, 'src/cloud-tuition-terms.js'), 'utf8')
const cloudTuitionPackageBridgeSource = fs.readFileSync(path.join(repoRoot, 'src/cloud-tuition-record-package-bridge.js'), 'utf8')
const tuitionRenderBlock = mainSource.slice(
  mainSource.indexOf("moduleItem.id === 'hoc-phi'"),
  mainSource.indexOf("moduleItem.id === 'nhom-tai-chinh'"),
)

for (const marker of [
  'FB ADMIN DREAMHOME STATUS: TUITION ATTENDANCE LINKAGE READONLY AUDIT',
  'RUNTIME_CHANGED_BY_CODEX: NO',
  'ATTENDANCE_CANONICAL_RECORDS_EXIST: YES',
  'REPORT_MODULE_USES_CANONICAL_ATTENDANCE: YES',
  'TUITION_MODULE_RECEIVES_CANONICAL_ATTENDANCE: NO',
  'TUITION_USED_SESSIONS_AUTO_FROM_ATTENDANCE: NO',
  'TUITION_ADVISORY_USES_SESSION_REPORTS_ONLY: YES',
  'TUITION_BASELINE_USED_SESSIONS_LINKED: NO',
  'TUITION_CLOUD_MARKS_ATTENDANCE_LINKED_FALSE: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]) {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
}

const student = {
  id: 'student-audit-linkage',
  fullName: 'Hoc vien audit',
  parentName: 'Phu huynh audit',
  parentPhone: '0900000000',
  classSessionIds: ['class-session-audit'],
}
const tuitionRecord = {
  id: 'tuition-audit-linkage',
  studentId: student.id,
  packageName: 'Goi 8 buoi',
  totalSessions: 8,
  usedSessions: 0,
  totalAmount: 1600000,
  paidAmount: 1600000,
  dueDate: '2026-07-31',
  note: '',
}
const attendanceRecords = buildUnifiedAttendanceRecords({
  sessionReports: [],
  storedRecords: [
    {
      id: 'baseline-audit-1',
      studentId: student.id,
      date: '2026-07-01',
      attendanceStatus: 'present',
      status: 'present',
      counted: true,
      creditValue: 1,
      source: 'initialBaseline',
    },
    {
      id: 'baseline-audit-2',
      studentId: student.id,
      date: '2026-07-03',
      attendanceStatus: 'makeup',
      status: 'makeup',
      counted: true,
      creditValue: 1,
      source: 'initialBaseline',
    },
  ],
})

assert.equal(getStudentAttendanceCredits(attendanceRecords, student.id).length, 2, 'Canonical attendance has counted credits')

const tuitionRows = buildTuitionRows([student], [tuitionRecord])
assert.equal(tuitionRows[0].tuition.usedSessions, 0, 'Tuition row preserves manual usedSessions')
assert.equal(tuitionRows[0].remainingSessions, 8, 'Tuition row does not derive remaining sessions from canonical attendance yet')

const advisoryWithoutSessionReports = buildAttendanceAdvisoryRows(
  [student],
  [tuitionRecord],
  [],
  [],
  '2026-07',
)
assert.equal(advisoryWithoutSessionReports[0].learnedSessions, 0, 'Advisory does not read baseline/canonical attendance records')

const advisoryWithSessionReports = buildAttendanceAdvisoryRows(
  [student],
  [tuitionRecord],
  [
    {
      id: 'report-audit-1',
      sessionId: 'session-audit-1',
      occurrenceDate: '2026-07-05',
      attendance: [{ studentId: student.id, attendanceStatus: 'present' }],
    },
  ],
  [],
  '2026-07',
)
assert.equal(advisoryWithSessionReports[0].learnedSessions, 1, 'Advisory uses sessionReports only for attendance count')
assert.equal(advisoryWithSessionReports[0].source, 'Điểm danh report')

assert(
  /moduleItem\.id === 'bao-cao'[\s\S]*buildUnifiedAttendanceRecords/.test(mainSource),
  'Report module receives canonical attendance records',
)
assert(
  /renderTuitionModule\(\s*students,\s*tuitionRecords,\s*tuitionFilters,[\s\S]*sessionReports/.test(tuitionRenderBlock),
  'Tuition module receives sessionReports',
)
assert(
  tuitionRenderBlock.includes('buildUnifiedAttendanceRecords'),
  'Follow-up read-only phase should now pass canonical attendance into tuition render path',
)
assert(tuitionSource.includes('const rows = buildTuitionRows(students, tuitionRecords, attendanceRecords)'), 'Tuition rows receive attendance records for read-only comparison')
assert(tuitionSource.includes('const remainingSessions = tuition.totalSessions - tuition.usedSessions'), 'Tuition remaining sessions use stored usedSessions')
assert(tuitionSource.includes('getStudentAttendanceCredits'), 'Read-only follow-up uses canonical attendance credit helper for comparison')
assert(studentTuitionLinksSource.includes('const usedSessions = normalizeSafeNumber(tuition?.usedSessions)'), 'Student tuition links use stored usedSessions')
assert(advisorySource.includes('const reportCounts = getAttendanceCountsByStudent(sessionReports, monthKey)'), 'Advisory reads sessionReports')
assert(!advisorySource.includes('buildUnifiedAttendanceRecords'), 'Advisory does not read canonical attendance records')
assert(cloudTuitionRecordsSource.includes('attendanceLinked: false'), 'Tuition cloud records mark attendance linkage disabled')
assert(cloudTuitionTermsSource.includes('usedSessionsAutoUpdateEnabled: false'), 'Tuition terms dry-run marks usedSessions auto update disabled')
assert(cloudTuitionPackageBridgeSource.includes('usedSessionsAutoUpdateFromAttendance: false'), 'Tuition package bridge marks attendance auto update disabled')

const changedFiles = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
assert(!/C8|teacher-roadmap|Teacher Roadmap/i.test(changedFiles), 'C8 Teacher files should not be changed')
assert(!/\.sql$/im.test(changedFiles), 'SQL files should not be changed')

console.log('FB Admin DreamHome tuition attendance linkage readonly audit smoke passed')
