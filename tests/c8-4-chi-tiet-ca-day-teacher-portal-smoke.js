import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  getTeacherScheduleSessions,
  getTeacherSessionReportSummary,
  renderTeacherModule,
} from '../src/teacher-module.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const teacherModulePath = path.join(root, 'src', 'teacher-module.js')
const stylesPath = path.join(root, 'src', 'styles.css')
const docsPath = path.join(root, 'docs', 'c8-4-chi-tiet-ca-day-teacher-portal.md')
const smokePath = path.join(root, 'tests', 'c8-4-chi-tiet-ca-day-teacher-portal-smoke.js')

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`)
}

function assertNotIncludes(content, needle, label = needle) {
  assert(!content.includes(needle), `Unexpected ${label}`)
}

function assertNoMojibake(filePath) {
  const content = readUtf8(filePath)

  for (const marker of getMojibakeMarkers()) {
    assert(!content.includes(marker), `Unexpected mojibake marker ${marker} in ${path.relative(root, filePath)}`)
  }
}

const teacher = {
  id: 'teacher-c8-4',
  fullName: 'Teacher C8.4',
  displayName: 'Coach C84',
  email: 'teacher.c84@example.com',
  loginEmail: 'teacher.c84@example.com',
  status: 'active',
  accountStatus: 'not_invited',
}

const otherTeacher = {
  id: 'teacher-other-c8-4',
  fullName: 'Other Teacher',
  displayName: 'Other Coach',
  status: 'active',
  accountStatus: 'not_invited',
}

const students = [
  {
    id: 'student-c8-4-1',
    fullName: 'Student Alpha',
    level: 'beginner',
    status: 'active',
    note: 'Needs tactics practice',
  },
  {
    id: 'student-c8-4-2',
    fullName: 'Student Beta',
    currentLevel: 'Level 3',
    currentStatus: 'trial',
    teacherReview: 'Good focus',
  },
]

const classSessions = [
  {
    id: 'class-session-c8-4-fixed',
    displayLabel: 'Fixed Slot C8.4',
    name: 'Fixed Slot C8.4',
    status: 'active',
  },
]

const scheduleSessions = [
  {
    id: 'session-c8-4-mine',
    title: 'C8.4 detail class',
    scheduleType: 'recurring',
    classSessionId: 'class-session-c8-4-fixed',
    dayOfWeek: 'monday',
    startTime: '18:00',
    endTime: '19:30',
    room: 'Room C8.4',
    teacherId: 'teacher-c8-4',
    teacherName: 'Teacher C8.4',
    studentIds: ['student-c8-4-1', 'student-c8-4-2', 'student-c8-4-missing'],
    level: 'beginner',
    status: 'scheduled',
    note: 'Read-only C8.4 note',
  },
  {
    id: 'session-c8-4-other',
    title: 'Other teacher class',
    scheduleType: 'oneOff',
    date: '2099-02-02',
    startTime: '19:00',
    endTime: '20:30',
    room: 'Room Other',
    teacherId: 'teacher-other-c8-4',
    studentIds: ['student-c8-4-1'],
  },
  {
    id: 'session-c8-4-no-teacher',
    title: 'Missing teacher slot',
    scheduleType: 'oneOff',
    date: '2099-02-03',
    startTime: '18:00',
    endTime: '19:00',
    room: 'Room Empty',
    studentIds: ['student-c8-4-1'],
  },
]

const sessionReports = [
  {
    id: 'report-c8-4-mine',
    sessionId: 'session-c8-4-mine',
    summary: 'Existing read-only report summary',
    note: 'Report note must be read only',
  },
]

const teacherSessions = getTeacherScheduleSessions(teacher, scheduleSessions)
assert.deepEqual(teacherSessions.map((session) => session.id), ['session-c8-4-mine'])

const reportSummary = getTeacherSessionReportSummary(scheduleSessions[0], sessionReports)
assert.equal(reportSummary.statusLabel, 'Đã có báo cáo')
assert.equal(reportSummary.summary, 'Existing read-only report summary')

const missingReportSummary = getTeacherSessionReportSummary(scheduleSessions[1], [])
assert.equal(missingReportSummary.status, 'missing')

const html = renderTeacherModule(
  [teacher, otherTeacher],
  {},
  null,
  teacher.id,
  students,
  scheduleSessions,
  classSessions,
  sessionReports,
)

assertIncludes(html, 'teacher-my-schedule')
assertIncludes(html, 'Xem ca dạy')
assertIncludes(html, 'teacher-session-detail-body')
assertIncludes(html, 'Chi tiết ca dạy của tôi')
assertIncludes(html, 'Thông tin ca')
assertIncludes(html, 'C8.4 detail class')
assertIncludes(html, '18:00-19:30')
assertIncludes(html, 'Room C8.4')
assertIncludes(html, 'Lịch cố định từ Cài đặt cơ sở')
assertIncludes(html, 'Teacher C8.4')
assertIncludes(html, 'teacher.c84@example.com')
assertIncludes(html, 'Student Alpha')
assertIncludes(html, 'Student Beta')
assertIncludes(html, 'student-c8-4-missing')
assertIncludes(html, 'Thiếu hồ sơ học viên')
assertIncludes(html, 'Đã có báo cáo')
assertIncludes(html, 'Existing read-only report summary')
assertIncludes(html, 'Read-only')
assertIncludes(html, 'Không chụp ảnh vào/ra')
assertNotIncludes(html, 'Other teacher class')
assertNotIncludes(html, 'Missing teacher slot')

const teacherModule = readUtf8(teacherModulePath)
const styles = readUtf8(stylesPath)
const docs = readUtf8(docsPath)
const smoke = readUtf8(smokePath)

assertIncludes(teacherModule, 'renderTeacherScheduleSessionDetailCard')
assertIncludes(teacherModule, 'getTeacherSessionReportSummary')
assertIncludes(teacherModule, 'findSessionReportForScheduleSession')
assertIncludes(teacherModule, 'teacher-session-detail-body')
assertIncludes(styles, 'teacher-session-detail-section')
assertIncludes(styles, 'teacher-session-student-list')
assertIncludes(docs, 'Không tạo Teacher Auth/login thật')
assertIncludes(docs, 'Không tạo/sửa/xóa session report')

;[
  'auth.admin',
  'createUser',
  'signUp',
  'magicLink',
  'signInWithOtp',
  'SUPABASE_SERVICE_ROLE_KEY',
  'upload(',
  'Storage',
  'attendance-to-tuition',
  'usedSessions',
  'saveStoredSessionReports(',
  'saveStoredAttendance',
  'saveStoredTuition',
].forEach((forbidden) => {
  assertNotIncludes(teacherModule, forbidden, `forbidden runtime marker ${forbidden}`)
})

;[docsPath, smokePath].forEach(assertNoMojibake)
assertNoMojibakeContent(smoke, 'C8.4 smoke')

function assertNoMojibakeContent(content, label) {
  for (const marker of getMojibakeMarkers()) {
    assert(!content.includes(marker), `Unexpected mojibake marker ${marker} in ${label}`)
  }
}

function getMojibakeMarkers() {
  return [
    [0x0043, 0x0102, 0x00a1, 0x00c2, 0x00ba].map((code) => String.fromCharCode(code)).join(''),
    [0x0102, 0x0192].map((code) => String.fromCharCode(code)).join(''),
    [0x0102, 0x2020, 0x00c2, 0x00b0].map((code) => String.fromCharCode(code)).join(''),
    [0x0048, 0x0102, 0x00a1, 0x00c2, 0x00ba].map((code) => String.fromCharCode(code)).join(''),
    '\uFFFD',
  ]
}

console.log('C8.4 teacher portal session detail smoke: PASS')
