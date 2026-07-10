import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import {
  buildTeacherPortalSummary,
  getTeacherScheduleSessions,
  isScheduleSessionAssignedToTeacher,
} from '../src/teacher-module.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'c8-2-teacher-portal-shell-lich-day-cua-toi.md')
const smokePath = path.join(root, 'tests', 'c8-2-teacher-portal-shell-lich-day-cua-toi-smoke.js')
const teacherModulePath = path.join(root, 'src', 'teacher-module.js')
const stylesPath = path.join(root, 'src', 'styles.css')
const mainPath = path.join(root, 'src', 'main.js')

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`)
}

function getStatusPaths() {
  const output = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/\\/g, '/'))
}

function assertNoMojibake(filePath) {
  const content = readUtf8(filePath)
  const forbidden = [
    [0x0043, 0x0102].map((code) => String.fromCharCode(code)).join(''),
    [0x0048, 0x0102].map((code) => String.fromCharCode(code)).join(''),
    [0x0050, 0x0068, 0x0102].map((code) => String.fromCharCode(code)).join(''),
    [0x00c3, 0x00a1, 0x00bb].map((code) => String.fromCharCode(code)).join(''),
    '\uFFFD',
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

assert(fs.existsSync(docPath), 'C8.2 docs must exist')
assert(fs.existsSync(smokePath), 'C8.2 smoke must exist')

const docs = readUtf8(docPath)
const teacherModule = readUtf8(teacherModulePath)
const styles = readUtf8(stylesPath)
const main = readUtf8(mainPath)

;[
  'C8.2 STATUS: TEACHER PORTAL SHELL MY SCHEDULE',
  'C8_1_STATUS: TEACHER_PROFILE_ACCOUNT_MODEL_DONE',
  'TEACHER_PORTAL_SHELL_ADDED: YES',
  'TEACHER_LOGIN_REAL_AUTH_CREATED: NO',
  'PUBLIC_SIGNUP_CREATED: NO',
  'TEACHER_PORTAL_ENTRY_FROM_PROFILE: YES',
  'MY_SCHEDULE_ADDED: YES',
  'TEACHER_SCHEDULE_MATCH_BY_ID_OR_NAME: YES',
  'MY_SESSION_DETAIL_PREVIEW_ADDED: YES',
  'TKB_REPORT_LOGIC_MOVED: NO',
  'ATTENDANCE_LOGIC_CHANGED: NO',
  'CHECKIN_CHECKOUT_CREATED: NO',
  'SQL_CREATED: NO',
  'DEPLOY_BY_CODEX: NO',
  'TEACHER_PROFILE_MODAL_HEIGHT_POLISHED: YES',
  'TEACHER_PROFILE_HEADER_COMPACTED: YES',
  'RUNTIME_CHANGED: YES',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'Hiện trạng source',
  'Mở Teacher Portal',
  'Lịch dạy của tôi',
  'teacherId',
  'teacherName',
  'My session detail preview',
  'Polish hồ sơ giáo viên',
  'Không làm trong C8.2',
  'Recommendation C8.3',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'renderTeacherPortalShell',
  'Bản xem trước Teacher Portal',
  'Mở Teacher Portal',
  'Lịch dạy của tôi',
  'Chưa có ca dạy nào được gắn với giáo viên này',
  'Xem ca dạy',
  'Điểm danh và báo cáo ca dạy sẽ được chuyển vào Teacher Portal ở phase sau.',
  'getTeacherScheduleSessions',
  'isScheduleSessionAssignedToTeacher',
  'buildTeacherPortalSummary',
  'session?.teacherId',
  'session?.teacherName',
].forEach((marker) => assertIncludes(teacherModule, marker))

;[
  'teacher-portal-shell',
  'teacher-portal-preview',
  'teacher-my-schedule',
  'teacher-session-preview',
  'teacher-profile-title-compact',
  '--app-taskbar-safe-height',
  'position: fixed',
  'calc(var(--app-taskbar-safe-height) + var(--teacher-profile-modal-gap))',
  'max-height: 100%',
].forEach((marker) => assertIncludes(styles, marker))

assertIncludes(main, 'sessionReports,')
assertIncludes(main, 'renderTeacherModule(')

const teacher = {
  id: 'teacher-001',
  fullName: 'Nguyễn Đức Thắng',
  displayName: 'Thầy Thắng',
}
const sessions = [
  { id: 's1', teacherId: 'teacher-001', date: '2099-01-01', scheduleType: 'oneOff', studentIds: ['st1'] },
  { id: 's2', teacherName: 'Thầy Thắng', date: '2099-01-02', scheduleType: 'oneOff', studentIds: [] },
  { id: 's3', teacherId: 'teacher-999', teacherName: 'Cô Khác', date: '2099-01-03', scheduleType: 'oneOff' },
]

assert.equal(isScheduleSessionAssignedToTeacher(sessions[0], teacher), true)
assert.equal(isScheduleSessionAssignedToTeacher(sessions[1], teacher), false)
assert.equal(isScheduleSessionAssignedToTeacher(sessions[2], teacher), false)
assert.deepEqual(getTeacherScheduleSessions(teacher, sessions).map((session) => session.id), ['s1'])

const summary = buildTeacherPortalSummary(teacher, [
  { id: 'past', teacherId: 'teacher-001', date: '2000-01-01', scheduleType: 'oneOff' },
  { id: 'future', teacherId: 'teacher-001', date: '2099-01-01', scheduleType: 'oneOff' },
], [{ scheduleSessionId: 'past', date: '2000-01-01' }])

assert.equal(summary.past, 1)
assert.equal(summary.upcoming, 1)
assert.equal(summary.missingReport, 0)

const runtimeCombined = [teacherModule, main].join('\n')
;[
  'auth.admin',
  'createUser',
  'signUp',
  'magicLink',
  'signInWithOtp',
  'SUPABASE_SERVICE_ROLE_KEY',
  'check-in',
  'checkout',
  'checkOut',
].forEach((forbidden) => {
  assert(!runtimeCombined.includes(forbidden), `C8.2 must not create auth/check-in behavior: ${forbidden}`)
})

const changedPaths = getStatusPaths()
const allowedPaths = new Set([
  'docs/c8-0-teacher-portal-ho-so-va-roadmap.md',
  'tests/c8-0-teacher-portal-ho-so-va-roadmap-smoke.js',
  'docs/c8-1-ho-so-giao-vien-va-teacher-account-model.md',
  'tests/c8-1-ho-so-giao-vien-va-teacher-account-model-smoke.js',
  'src/teacher-module.js',
  'src/teacher-data.js',
  'src/storage.js',
  'src/styles.css',
  'src/main.js',
  'src/schedule-module.js',
  'docs/c8-2-teacher-portal-shell-lich-day-cua-toi.md',
  'tests/c8-2-teacher-portal-shell-lich-day-cua-toi-smoke.js',
  'docs/c8-3-lich-day-cua-toi-teacher-portal.md',
  'tests/c8-3-lich-day-cua-toi-teacher-portal-smoke.js',
  'docs/c8-4-chi-tiet-ca-day-teacher-portal.md',
  'tests/c8-4-chi-tiet-ca-day-teacher-portal-smoke.js',
  'tests/fb-c8-3-tkb-them-buoi-hoc-khong-tao-card-smoke.js',
  'tests/fb-c8-3-tkb-khong-chon-duoc-hoc-vien-smoke.js',
  'tests/fb-c8-3-tkb-student-picker-save-ux-smoke.js',
  'tests/fb-c8-3-teacher-portal-button-va-tkb-lich-co-dinh-ca-hoc-smoke.js',
  'tests/fb-c8-3-tkb-lich-co-dinh-slot-trong-tu-cai-dat-co-so-smoke.js',
  'tests/fb-c8-3-tkb-khong-tao-lich-co-dinh-tu-tkb-smoke.js',
  'tests/fb-c8-3-tkb-bo-loai-lich-va-hint-du-thua-smoke.js',
  'docs/fb-c8-2-teacher-profile-modal-taskbar-safe-height.md',
  'tests/fb-c8-2-teacher-profile-modal-taskbar-safe-height-smoke.js',
])

for (const changedPath of changedPaths) {
  assert(allowedPaths.has(changedPath), `Unexpected C8.2 changed file: ${changedPath}`)
  assert(!changedPath.startsWith('supabase/functions/'), `Edge Function must not change: ${changedPath}`)
  assert(!changedPath.endsWith('.sql'), `C8.2 must not create SQL: ${changedPath}`)
  assert(changedPath !== 'src/attendance-records.js', 'C8.2 must not change attendance logic.')
}

;[docPath, smokePath, teacherModulePath, stylesPath].forEach(assertNoMojibake)

console.log('C8.2 teacher portal shell my schedule smoke: PASS')
