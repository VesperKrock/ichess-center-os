import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'fb-c8-2-teacher-profile-modal-taskbar-safe-height.md')
const smokePath = path.join(root, 'tests', 'fb-c8-2-teacher-profile-modal-taskbar-safe-height-smoke.js')
const stylesPath = path.join(root, 'src', 'styles.css')
const teacherModulePath = path.join(root, 'src', 'teacher-module.js')

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

assert(fs.existsSync(docPath), 'Feedback docs must exist')
assert(fs.existsSync(smokePath), 'Feedback smoke must exist')

const docs = readUtf8(docPath)
const styles = readUtf8(stylesPath)
const teacherModule = readUtf8(teacherModulePath)

;[
  'FB C8.2 STATUS: TEACHER PROFILE MODAL TASKBAR SAFE HEIGHT',
  'FEEDBACK_SCOPE: C8_2_LAYOUT_POLISH',
  'TEACHER_PROFILE_MODAL_BOTTOM_ABOVE_TASKBAR: YES',
  'TEACHER_PROFILE_MODAL_RESPONSIVE_HEIGHT: YES',
  'TEACHER_PROFILE_MODAL_BODY_SCROLLS_INTERNALLY: YES',
  'TEACHER_PROFILE_MODAL_FOOTER_VISIBLE: YES',
  'TASKBAR_PRIORITY_PRESERVED: YES',
  'TEACHER_PORTAL_LOGIC_CHANGED: NO',
  'AUTH_CREATED: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '--app-taskbar-safe-height',
  '--teacher-profile-modal-gap',
  '.teacher-profile-backdrop',
  'position: fixed',
  'calc(var(--app-taskbar-safe-height) + var(--teacher-profile-modal-gap))',
  'z-index: 9',
  '.teacher-profile-panel',
  'height: min(100%, 900px)',
  'max-height: 100%',
  '.teacher-profile-pane',
  'overflow: auto',
  '.teacher-profile-actions',
  'flex-shrink: 0',
  '100dvh',
].forEach((marker) => assertIncludes(styles, marker))

assertIncludes(teacherModule, 'renderTeacherPortalShell')
assertIncludes(teacherModule, 'Lịch dạy của tôi')
assertIncludes(teacherModule, 'Xem ca dạy')

const runtimeCombined = [styles, teacherModule].join('\n')
;[
  'auth.admin',
  'createUser',
  'signUp',
  'signInWithOtp',
  'SUPABASE_SERVICE_ROLE_KEY',
].forEach((forbidden) => {
  assert(!runtimeCombined.includes(forbidden), `Feedback must not add auth/signup behavior: ${forbidden}`)
})

const allowedPaths = new Set([
  'docs/c8-0-teacher-portal-ho-so-va-roadmap.md',
  'tests/c8-0-teacher-portal-ho-so-va-roadmap-smoke.js',
  'docs/c8-1-ho-so-giao-vien-va-teacher-account-model.md',
  'tests/c8-1-ho-so-giao-vien-va-teacher-account-model-smoke.js',
  'docs/c8-2-teacher-portal-shell-lich-day-cua-toi.md',
  'tests/c8-2-teacher-portal-shell-lich-day-cua-toi-smoke.js',
  'src/main.js',
  'src/storage.js',
  'src/styles.css',
  'src/teacher-data.js',
  'src/teacher-module.js',
  'docs/fb-c8-2-teacher-profile-modal-taskbar-safe-height.md',
  'tests/fb-c8-2-teacher-profile-modal-taskbar-safe-height-smoke.js',
])

for (const changedPath of getStatusPaths()) {
  assert(allowedPaths.has(changedPath), `Unexpected feedback changed file: ${changedPath}`)
  assert(!changedPath.endsWith('.sql'), `Feedback must not create SQL: ${changedPath}`)
  assert(!changedPath.startsWith('supabase/functions/'), `Feedback must not change Edge Functions: ${changedPath}`)
  assert(changedPath !== 'src/schedule-module.js', 'Feedback must not change TKB logic.')
  assert(changedPath !== 'src/attendance-records.js', 'Feedback must not change attendance logic.')
}

;[docPath, smokePath, stylesPath, teacherModulePath].forEach(assertNoMojibake)

console.log('FB C8.2 teacher profile modal taskbar-safe height smoke: PASS')
