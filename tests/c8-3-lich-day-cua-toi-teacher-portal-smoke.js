import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  buildTeacherPortalScheduleAudit,
  buildTeacherPortalSummary,
  getTeacherScheduleSessions,
  isScheduleSessionAssignedToTeacher,
  renderTeacherModule,
} from '../src/teacher-module.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const teacherModulePath = path.join(root, 'src', 'teacher-module.js')
const stylesPath = path.join(root, 'src', 'styles.css')
const docsPath = path.join(root, 'docs', 'c8-3-lich-day-cua-toi-teacher-portal.md')
const smokePath = path.join(root, 'tests', 'c8-3-lich-day-cua-toi-teacher-portal-smoke.js')

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
  const forbidden = getMojibakeMarkers()

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker ${marker} in ${path.relative(root, filePath)}`)
  }
}

const teacher = {
  id: 'teacher-c8-3',
  fullName: 'Teacher C8.3',
  displayName: 'Coach C83',
  email: 'teacher.c83@example.com',
  loginEmail: 'teacher.c83@example.com',
  status: 'active',
  accountStatus: 'not_invited',
}

const otherTeacher = {
  id: 'teacher-other',
  fullName: 'Other Teacher',
  displayName: 'Other Coach',
  status: 'active',
  accountStatus: 'not_invited',
}

const students = [
  { id: 'student-1', fullName: 'Student One' },
  { id: 'student-2', fullName: 'Student Two' },
]

const scheduleSessions = [
  {
    id: 'session-mine',
    title: 'C8.3 own session',
    scheduleType: 'oneOff',
    date: '2099-01-10',
    startTime: '18:00',
    endTime: '19:30',
    room: 'Room A',
    teacherId: 'teacher-c8-3',
    teacherName: 'Teacher C8.3',
    studentIds: ['student-1', 'student-2'],
    status: 'scheduled',
    note: 'Read-only note',
  },
  {
    id: 'session-other',
    title: 'Other teacher session',
    scheduleType: 'oneOff',
    date: '2099-01-11',
    startTime: '19:00',
    endTime: '20:00',
    room: 'Room B',
    teacherId: 'teacher-other',
    teacherName: 'Other Teacher',
    studentIds: ['student-1'],
    status: 'scheduled',
  },
  {
    id: 'session-legacy-name-only',
    title: 'Legacy name-only session',
    scheduleType: 'oneOff',
    date: '2099-01-12',
    startTime: '20:00',
    endTime: '21:00',
    room: 'Room C',
    teacherName: 'Teacher C8.3',
    studentIds: ['student-1'],
    status: 'scheduled',
  },
  {
    id: 'session-missing-teacher',
    title: 'Missing teacher session',
    scheduleType: 'oneOff',
    date: '2099-01-13',
    startTime: '',
    endTime: '',
    room: 'Room D',
    studentIds: [],
    status: 'scheduled',
  },
]

assert.equal(isScheduleSessionAssignedToTeacher(scheduleSessions[0], teacher), true)
assert.equal(isScheduleSessionAssignedToTeacher(scheduleSessions[1], teacher), false)
assert.equal(
  isScheduleSessionAssignedToTeacher(scheduleSessions[2], teacher),
  false,
  'Legacy teacherName-only session must not be auto-mapped to current teacher.',
)

const teacherSessions = getTeacherScheduleSessions(teacher, scheduleSessions)
assert.deepEqual(teacherSessions.map((session) => session.id), ['session-mine'])

const emptySessions = getTeacherScheduleSessions({ ...teacher, id: 'teacher-empty' }, scheduleSessions)
assert.deepEqual(emptySessions, [])

const audit = buildTeacherPortalScheduleAudit(teacher, scheduleSessions)
assert.equal(audit.assignedByTeacherId, 1)
assert.equal(audit.legacyNameOnlyCandidates, 1)
assert.equal(audit.missingTeacherId, 1)

const summary = buildTeacherPortalSummary(teacher, teacherSessions, [])
assert.equal(summary.upcoming, 1)
assert.equal(summary.teacherId, 'teacher-c8-3')

const html = renderTeacherModule(
  [teacher, otherTeacher],
  {},
  null,
  teacher.id,
  students,
  scheduleSessions,
  [],
  [],
)

assertIncludes(html, 'teacher-my-schedule')
assertIncludes(html, 'teacher-session-detail')
assertIncludes(html, 'C8.3 own session')
assertIncludes(html, 'Read-only note')
assertIncludes(html, 'legacy')
assertNotIncludes(html, 'Other teacher session')
assertNotIncludes(html, 'Legacy name-only session')
assertIncludes(html, 'Chi tiết ca')

const emptyHtml = renderTeacherModule(
  [teacher],
  {},
  null,
  'teacher-empty',
  students,
  scheduleSessions,
  [],
  [],
)
assert(!emptyHtml.includes('C8.3 own session'), 'Empty teacher must not see another teacher schedule.')

const teacherModule = readUtf8(teacherModulePath)
const styles = readUtf8(stylesPath)
const docs = readUtf8(docsPath)
const smoke = readUtf8(smokePath)

assertIncludes(teacherModule, 'buildTeacherPortalScheduleAudit')
assertIncludes(teacherModule, 'teacher-session-detail')
assertIncludes(teacherModule, 'renderTeacherScheduleAuditNotice')
assertIncludes(styles, 'teacher-my-schedule-notice')
assertIncludes(styles, 'teacher-session-warnings')
assertIncludes(docs, 'TEACHER_SCHEDULE_FILTER_BY_TEACHER_ID: YES')
assertIncludes(docs, 'LEGACY_NAME_ONLY_AUTO_MATCH: NO')

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
].forEach((forbidden) => {
  assertNotIncludes(teacherModule, forbidden, `forbidden runtime marker ${forbidden}`)
})

;[docsPath, smokePath].forEach(assertNoMojibake)
assertNoMojibakeContent(smoke, 'C8.3 smoke')

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

console.log('C8.3 teacher portal my schedule smoke: PASS')
