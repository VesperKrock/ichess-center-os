import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'c8-0-teacher-portal-ho-so-va-roadmap.md')
const smokePath = path.join(root, 'tests', 'c8-0-teacher-portal-ho-so-va-roadmap-smoke.js')

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

assert(fs.existsSync(docPath), 'C8.0 docs must exist')
assert(fs.existsSync(smokePath), 'C8.0 smoke must exist')

const docs = readUtf8(docPath)

;[
  'C8.0 STATUS: TEACHER PORTAL PROFILE ROADMAP DESIGN',
  'C7_9_STATUS: ACCOUNT_LIFECYCLE_READY_FOR_TEACHER',
  'TEACHER_IS_REAL_PERSON: YES',
  'TEACHER_USES_REAL_EMAIL: YES',
  'TEACHER_PUBLIC_SIGNUP_ALLOWED: NO',
  'TEACHER_DIFFERS_FROM_CENTER_ADMIN: YES',
  'CENTER_ADMIN_EMAIL_PATTERN_PRESERVED: YES',
  'TEACHER_PROFILE_DESIGNED: YES',
  'MY_SCHEDULE_DESIGNED: YES',
  'MY_SESSION_DETAIL_DESIGNED: YES',
  'CHECKIN_DESIGNED: YES',
  'CHECKOUT_DESIGNED: YES',
  'CHECKIN_ONE_IMAGE_ONLY: YES',
  'CHECKOUT_MULTIPLE_IMAGES_ALLOWED: YES',
  'GPS_REQUIRED: NO',
  'MEDIA_STORAGE_RISK_NOTED: YES',
  'ATTENDANCE_STAYS_IN_SESSION_TKB_FLOW: YES',
  'CLASS_REPORT_STAYS_IN_SESSION_TKB_FLOW: YES',
  'STUDENT_DETAIL_FOR_TEACHER_DESIGNED: YES',
  'STUDENT_CREATE_BY_TEACHER_ALLOWED: NO',
  'STUDENT_TEST_HANDOFF_DESIGNED: YES',
  'PROGRESS_REPORT_DESIGNED: YES',
  'C8_ROADMAP_SHORT_INCLUDED: YES',
  'C8_ROADMAP_DETAILED_INCLUDED: YES',
  'RUNTIME_CHANGED: NO',
  'SQL_CREATED: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'Gmail thật',
  'Teacher khác admin',
  'teacher là một người thật',
  'admin.*',
  'admin.dreamhome@ichess.vn',
  'hồ sơ giáo viên',
  'Lịch dạy của tôi',
  'Check-in one image',
  'Check-out multiple images',
  'Không cần GPS',
  '30 phút trước ca dạy',
  '15 phút trước ca dạy',
  'Grace 5 phút',
  'Điểm danh trong TKB/session',
  'Báo cáo trong TKB/session',
  'Chi tiết học viên',
  'không phải "Thêm học viên"',
  'Teacher không tự tạo học viên chính thức',
  'Phiếu test bé',
  'học thử',
  'Báo cáo học tập cuối kỳ',
  'Roadmap rút gọn C8',
  'Roadmap chi tiết C8',
  'Teacher task center',
  'Supabase Storage',
  'Không lưu ảnh base64 trong localStorage',
  'Không nhét ảnh vào `center_cloud_entities`',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'Module TKB hiện đã có dữ liệu ca dạy',
  '`sessionReports`',
  'Module Học viên đã có hồ sơ học viên',
  'Module Giáo viên đã có dữ liệu/hồ sơ giáo viên phía admin side',
  'Teacher Portal chưa tách riêng',
  'Teacher account/role chưa hoàn thiện thành portal riêng',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'C8.1 - Hồ sơ giáo viên + teacher account model',
  'C8.2 - Teacher login shell + Lịch dạy của tôi',
  'C8.3 - My session detail',
  'C8.4 - Check-in / Check-out + media storage plan',
  'C8.5 - Điểm danh + báo cáo tình hình lớp trong ca dạy',
  'C8.6 - Hồ sơ học viên cho giáo viên',
  'C8.7 - Phiếu test bé / học thử gửi admin duyệt',
  'C8.8 - Báo cáo học tập cuối kỳ',
  'C8.9 - Teacher task center + checkpoint MVP',
].forEach((marker) => assertIncludes(docs, marker))

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

const c81RuntimePaths = new Set([
  'src/teacher-module.js',
  'src/teacher-data.js',
  'src/storage.js',
  'src/styles.css',
  'src/main.js',
])

for (const changedPath of getStatusPaths()) {
  assert(allowedPaths.has(changedPath), `Unexpected C8.0 changed file: ${changedPath}`)
  assert(!changedPath.startsWith('src/') || c81RuntimePaths.has(changedPath), `Runtime must not change outside C8.1 scope: ${changedPath}`)
  assert(!changedPath.startsWith('supabase/functions/'), `Edge Function must not change: ${changedPath}`)
  assert(!changedPath.endsWith('.sql'), `C8.0 must not create SQL: ${changedPath}`)
}

const sensitivePatterns = [
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /service_role\s*[:=]/i,
  /authorization:\s*bearer/i,
  /access_token\s*[:=]/i,
  /refresh_token\s*[:=]/i,
]

for (const pattern of sensitivePatterns) {
  assert(!pattern.test(docs), `Docs must not include secret-like content: ${pattern}`)
}

assertNoMojibake(docPath)
assertNoMojibake(smokePath)

console.log('C8.0 teacher portal profile roadmap smoke: PASS')
