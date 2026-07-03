import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import {
  buildTeacherFromForm,
  createEditTeacherFormState,
  validateTeacherForm,
} from '../src/teacher-module.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'c8-1-ho-so-giao-vien-va-teacher-account-model.md')
const smokePath = path.join(root, 'tests', 'c8-1-ho-so-giao-vien-va-teacher-account-model-smoke.js')
const teacherModulePath = path.join(root, 'src', 'teacher-module.js')
const teacherDataPath = path.join(root, 'src', 'teacher-data.js')
const storagePath = path.join(root, 'src', 'storage.js')
const stylesPath = path.join(root, 'src', 'styles.css')

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

assert(fs.existsSync(docPath), 'C8.1 docs must exist')
assert(fs.existsSync(smokePath), 'C8.1 smoke must exist')

const docs = readUtf8(docPath)
const teacherModule = readUtf8(teacherModulePath)
const teacherData = readUtf8(teacherDataPath)
const storage = readUtf8(storagePath)
const styles = readUtf8(stylesPath)

;[
  'C8.1 STATUS: TEACHER PROFILE AND ACCOUNT MODEL',
  'C8_0_STATUS: TEACHER_PORTAL_DESIGN_DONE',
  'TEACHER_IS_REAL_PERSON: YES',
  'TEACHER_USES_REAL_EMAIL: YES',
  'TEACHER_PUBLIC_SIGNUP_ALLOWED: NO',
  'CENTER_ADMIN_EMAIL_PATTERN_PRESERVED: YES',
  'TEACHER_PROFILE_FIELDS_NORMALIZED: YES',
  'TEACHER_LOGIN_EMAIL_MODELED: YES',
  'TEACHER_AUTH_ACCOUNT_CREATED: NO',
  'TEACHER_PORTAL_LOGIN_CREATED: NO',
  'TEACHER_ACCOUNT_READINESS_UI_ADDED: YES',
  'TEACHER_FORM_UPDATED: YES',
  'TEACHER_PROFILE_UI_UPDATED: YES',
  'SCHEDULE_TKB_CHANGED: NO',
  'CHECKIN_CHECKOUT_CREATED: NO',
  'SQL_CREATED: NO',
  'DEPLOY_BY_CODEX: NO',
  'RUNTIME_CHANGED: YES',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'Teacher vs admin',
  'admin.dreamhome@ichess.vn',
  'admin.phongtrong@ichess.vn',
  'Gmail thật',
  'loginEmail',
  'accountStatus',
  'not_invited',
  'Chưa tạo tài khoản đăng nhập',
  'Email đăng nhập tương lai',
  'Không Teacher Portal',
  'Manual QA checklist',
  'Recommendation C8.2',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'loginEmail',
  'birthYear',
  'hometown',
  'currentArea',
  'accountStatus',
  'accountLinkedAt',
  'accountUserId',
  'accountNotes',
  'teacherAccountStatuses',
  'Email/Gmail thật',
  'Email đăng nhập tương lai',
  'Tài khoản giáo viên',
  'Chưa tạo tài khoản đăng nhập',
  'chưa tạo tài khoản đăng nhập',
  '/^admin\\./i',
].forEach((marker) => assertIncludes(teacherModule, marker, marker))

;[
  'VALID_TEACHER_ACCOUNT_STATUSES',
  'loginEmail',
  'birthDate',
  'birthYear',
  'hometown',
  'currentArea',
  'acceptNewStudents',
  'accountStatus',
  'accountLinkedAt',
  'accountUserId',
  'accountNotes',
].forEach((marker) => assertIncludes(storage, marker))

assertIncludes(teacherData, '@gmail.com')
assertIncludes(teacherData, 'loginEmail')
assertIncludes(teacherData, "accountStatus: 'not_invited'")
assertIncludes(styles, 'teacher-account-readiness-card')
assertIncludes(styles, 'teacher-account-readiness')

const createdTeacher = buildTeacherFromForm({
  fullName: 'Nguyễn Đức Thắng',
  displayName: 'Thầy Thắng',
  phone: '0909000000',
  email: 'ducthang.ichess@gmail.com',
  loginEmail: '',
  birthYear: '1995',
  hometown: 'Hà Nội',
  currentArea: 'Quận 7',
  status: 'active',
  teacherType: 'parttime',
  specialties: 'Khai cuộc',
  levels: ['beginner'],
  teachingGroups: 'Dolphin',
  teachingModes: ['group'],
  strengths: 'Thiếu nhi',
  internalTags: 'mvp',
  availableDays: ['monday'],
  preferredTimeSlots: ['evening'],
  availableClassSessionIds: [],
  maxSessionsPerWeek: '4',
  canTakeNewClass: true,
  scheduleNote: '',
  mainRole: 'Giáo viên cờ vua',
  note: '',
  accountStatus: 'not_invited',
  accountNotes: 'Chờ C8.2',
})

assert.equal(createdTeacher.email, 'ducthang.ichess@gmail.com')
assert.equal(createdTeacher.loginEmail, 'ducthang.ichess@gmail.com')
assert.equal(createdTeacher.accountStatus, 'not_invited')
assert.equal(createdTeacher.birthYear, '1995')
assert.equal(createdTeacher.hometown, 'Hà Nội')
assert.equal(createdTeacher.currentArea, 'Quận 7')
assert.equal(createdTeacher.acceptNewStudents, true)
assert.equal(createdTeacher.accountUserId, '')
assert.equal(createdTeacher.accountLinkedAt, null)

const editState = createEditTeacherFormState(createdTeacher)
assert.equal(editState.values.loginEmail, 'ducthang.ichess@gmail.com')
assert.equal(editState.values.accountStatus, 'not_invited')
assert.equal(editState.values.accountNotes, 'Chờ C8.2')

const adminPatternErrors = validateTeacherForm({
  ...editState.values,
  loginEmail: 'admin.teacher@ichess.vn',
})
assert(adminPatternErrors.loginEmail, 'Teacher login email must reject admin.* pattern.')

const changedPaths = getStatusPaths()
const allowedPaths = new Set([
  'docs/c8-0-teacher-portal-ho-so-va-roadmap.md',
  'tests/c8-0-teacher-portal-ho-so-va-roadmap-smoke.js',
  'src/teacher-module.js',
  'src/teacher-data.js',
  'src/storage.js',
  'src/styles.css',
  'src/main.js',
  'docs/c8-1-ho-so-giao-vien-va-teacher-account-model.md',
  'tests/c8-1-ho-so-giao-vien-va-teacher-account-model-smoke.js',
  'docs/c8-2-teacher-portal-shell-lich-day-cua-toi.md',
  'tests/c8-2-teacher-portal-shell-lich-day-cua-toi-smoke.js',
  'docs/fb-c8-2-teacher-profile-modal-taskbar-safe-height.md',
  'tests/fb-c8-2-teacher-profile-modal-taskbar-safe-height-smoke.js',
])

for (const changedPath of changedPaths) {
  assert(allowedPaths.has(changedPath), `Unexpected C8.1 changed file: ${changedPath}`)
  assert(!changedPath.startsWith('supabase/functions/'), `Edge Function must not change: ${changedPath}`)
  assert(!changedPath.endsWith('.sql'), `C8.1 must not create SQL: ${changedPath}`)
  assert(!changedPath.includes('schedule'), `TKB/schedule files must not change: ${changedPath}`)
}

const runtimeCombined = [teacherModule, teacherData, storage].join('\n')
;[
  'auth.admin',
  'createUser',
  'signUp',
  'magicLink',
  'signInWithOtp',
  'SUPABASE_SERVICE_ROLE_KEY',
].forEach((forbidden) => {
  assert(!runtimeCombined.includes(forbidden), `Runtime must not create/open teacher auth: ${forbidden}`)
})

assert(!/teacher\.[a-z0-9_-]+@ichess\.vn/i.test(runtimeCombined), 'Teacher runtime must not generate teacher.* internal email pattern.')
assert(!/admin\.[a-z0-9_-]+@ichess\.vn/i.test(teacherData), 'Teacher seed must not use admin.* emails.')

;[docPath, smokePath, teacherModulePath, teacherDataPath].forEach(assertNoMojibake)

console.log('C8.1 teacher profile and account model smoke: PASS')
