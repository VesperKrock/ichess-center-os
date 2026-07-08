import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import { buildUnifiedAttendanceRecords } from '../src/attendance-records.js'
import { buildTuitionRows, renderTuitionModule } from '../src/tuition-module.js'

const repoRoot = process.cwd()
const docs = fs.readFileSync(
  path.join(repoRoot, 'docs/fb-admin-dreamhome-hoc-phi-doi-chieu-diem-danh-readonly.md'),
  'utf8',
)
const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main.js'), 'utf8')
const tuitionSource = fs.readFileSync(path.join(repoRoot, 'src/tuition-module.js'), 'utf8')
const cloudTuitionRecordsSource = fs.readFileSync(path.join(repoRoot, 'src/cloud-tuition-records.js'), 'utf8')
const cloudTuitionTermsSource = fs.readFileSync(path.join(repoRoot, 'src/cloud-tuition-terms.js'), 'utf8')
const cloudTuitionPackageBridgeSource = fs.readFileSync(path.join(repoRoot, 'src/cloud-tuition-record-package-bridge.js'), 'utf8')

for (const marker of [
  'FB ADMIN DREAMHOME STATUS: TUITION ATTENDANCE READONLY LINK',
  'ATTENDANCE_TO_TUITION_LINK_EXISTS_BEFORE: NO',
  'TUITION_CURRENT_SOURCE_BEFORE: MANUAL_USED_SESSIONS',
  'TUITION_ATTENDANCE_READONLY_DISPLAY_ADDED: YES',
  'TUITION_USED_SESSIONS_STORAGE_MUTATION: NO',
  'TUITION_CLOUD_PAYLOAD_CHANGED: NO',
  'TUITION_ATTENDANCE_AUTOMATION_ENABLED: NO',
  'TUITION_ATTENDANCE_MISMATCH_WARNING_ADDED: YES',
  'ATTENDANCE_CORE_REGRESSION_CHECKED: YES',
  'C8_TEACHER_ROADMAP_SCOPE: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]) {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
}

const students = [
  {
    id: 'student-readonly-link',
    fullName: 'Hoc vien doi chieu',
    parentName: 'Phu huynh A',
    parentPhone: '0900000001',
    classSessionIds: ['class-session-a'],
  },
  {
    id: 'student-no-attendance',
    fullName: 'Hoc vien chua diem danh',
    parentName: 'Phu huynh B',
    parentPhone: '0900000002',
    classSessionIds: ['class-session-b'],
  },
]
const tuitionRecords = [
  {
    id: 'tuition-readonly-link',
    studentId: 'student-readonly-link',
    packageName: 'Goi 8 buoi',
    totalSessions: 8,
    usedSessions: 0,
    totalAmount: 1600000,
    paidAmount: 1600000,
    dueDate: '2026-07-31',
    note: '',
  },
  {
    id: 'tuition-no-attendance',
    studentId: 'student-no-attendance',
    packageName: 'Goi 8 buoi',
    totalSessions: 8,
    usedSessions: 3,
    totalAmount: 1600000,
    paidAmount: 1600000,
    dueDate: '2026-07-31',
    note: '',
  },
]
const beforeRenderJson = JSON.stringify(tuitionRecords)
const attendanceRecords = buildUnifiedAttendanceRecords({
  sessionReports: [],
  storedRecords: [
    {
      id: 'baseline-readonly-link-1',
      studentId: 'student-readonly-link',
      date: '2026-07-01',
      attendanceStatus: 'present',
      status: 'present',
      counted: true,
      creditValue: 1,
      source: 'initialBaseline',
    },
    {
      id: 'baseline-readonly-link-2',
      studentId: 'student-readonly-link',
      date: '2026-07-03',
      attendanceStatus: 'makeup',
      status: 'makeup',
      counted: true,
      creditValue: 1,
      source: 'initialBaseline',
    },
  ],
})

const rows = buildTuitionRows(students, tuitionRecords, attendanceRecords)
const linkedRow = rows.find((row) => row.student.id === 'student-readonly-link')
const emptyRow = rows.find((row) => row.student.id === 'student-no-attendance')

assert.equal(linkedRow.remainingSessions, 8, 'Remaining sessions should still use manual tuition.usedSessions')
assert.equal(linkedRow.tuition.usedSessions, 0, 'Manual usedSessions should be preserved')
assert.equal(linkedRow.attendanceTuitionPreview.attendanceCreditCount, 2)
assert.equal(linkedRow.attendanceTuitionPreview.attendanceRecordCount, 2)
assert.equal(linkedRow.attendanceTuitionPreview.isMismatch, true)
assert.equal(linkedRow.attendanceTuitionPreview.difference, 2)
assert.equal(emptyRow.attendanceTuitionPreview.hasAttendanceData, false)

const html = renderTuitionModule(
  students,
  tuitionRecords,
  { query: '', status: 'all', package: 'all' },
  null,
  null,
  { studentId: 'student-readonly-link' },
  [],
  [],
  '2026-07',
  null,
  attendanceRecords,
)

assert(html.includes('Theo điểm danh: 2'), 'Tuition UI should show attendance-derived count')
assert(html.includes('Đang lưu học phí: 0'), 'Tuition UI should show stored manual usedSessions in tooltip/detail')
assert(html.includes('Lệch 2 buổi'), 'Tuition UI should show mismatch size')
assert(html.includes('Cần kiểm tra: số buổi học phí đang lưu khác dữ liệu điểm danh.'), 'Mismatch warning should be product-facing')
assert(html.includes('Chưa có dữ liệu điểm danh'), 'Rows without attendance should be safe')
assert.equal(JSON.stringify(tuitionRecords), beforeRenderJson, 'Rendering attendance comparison must not mutate tuition records')

assert(
  mainSource.includes('buildUnifiedAttendanceRecords({') &&
    mainSource.includes('renderTuitionModule(') &&
    mainSource.includes('loadStoredAttendanceRecords(getCurrentResolvedCenterId())'),
  'Main should pass canonical attendance records into tuition module',
)
assert(tuitionSource.includes('attendanceRecords = []'), 'Tuition module should accept attendance records optionally')
assert(tuitionSource.includes('buildTuitionAttendancePreviewMap'), 'Tuition module should derive read-only attendance preview')
assert(tuitionSource.includes('getStudentAttendanceCredits'), 'Tuition preview should use canonical attendance credit helper')
assert(tuitionSource.includes('const remainingSessions = tuition.totalSessions - tuition.usedSessions'), 'Official remaining sessions should still use manual usedSessions')
assert(!/tuition\.usedSessions\s*=/.test(tuitionSource), 'Tuition module must not mutate usedSessions')
assert(!/usedSessionsAutoUpdateEnabled:\s*true/.test(cloudTuitionTermsSource), 'Tuition term automation must stay disabled')
assert(cloudTuitionRecordsSource.includes('attendanceLinked: false'), 'Cloud tuition record payload should not be changed')
assert(cloudTuitionPackageBridgeSource.includes('usedSessionsAutoUpdateFromAttendance: false'), 'Cloud tuition package bridge should keep auto update disabled')

const changedFiles = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
assert(!/C8|teacher-roadmap|Teacher Roadmap/i.test(changedFiles), 'C8 Teacher files should not be changed')
assert(!/\.sql$/im.test(changedFiles), 'SQL files should not be changed')

console.log('FB Admin DreamHome tuition attendance readonly comparison smoke passed')
