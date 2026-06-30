import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-6f-post-create-verify-polish-enter-center-design.md')
const mainPath = path.join(root, 'src', 'main.js')
const stylesPath = path.join(root, 'src', 'styles.css')

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
  const forbidden = [
    [0x0043, 0x0102, 0x00a1, 0x00c2, 0x00ba].map((code) => String.fromCharCode(code)).join(''),
    [0x0102, 0x0192].map((code) => String.fromCharCode(code)).join(''),
    [0x0102, 0x2020, 0x00c2, 0x00b0].map((code) => String.fromCharCode(code)).join(''),
    [0x0048, 0x0102, 0x00a1, 0x00c2, 0x00ba].map((code) => String.fromCharCode(code)).join(''),
    '\uFFFD',
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

assert(fs.existsSync(docPath), 'C6.6F docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C6.6F STATUS: POST CREATE VERIFY POLISH ENTER CENTER DESIGN',
  'C6_6E_STATUS: PASS',
  'C6_6E_MANUAL_QA: PASS',
  'PHONG_TRONG_CREATED_BY_USER: YES',
  'PHONG_TRONG_CENTER_ID: phongtrong_prod',
  'PHONG_TRONG_SLUG: phongtrong',
  'PHONG_TRONG_ENVIRONMENT: production',
  'PHONG_TRONG_STATUS: active',
  'INTERNAL_CONSOLE_POLISH_APPLIED: YES',
  'LONG_OWNER_DESCRIPTION_REMOVED: YES',
  'LONG_ADD_CENTER_DESCRIPTION_REMOVED: YES',
  'RUNTIME_LOGIC_PRESERVED: YES',
  'OWNER_ADD_CENTER_FORM_PRESERVED: YES',
  'CENTERS_LIST_PRESERVED: YES',
  'CENTER_ADMIN_DENIED_PRESERVED: YES',
  'SIGNED_OUT_DENIED_PRESERVED: YES',
  'CENTER_SWITCH_IMPLEMENTED: NO',
  'CENTER_SWITCH_DEFERRED_TO_C6_6G: YES',
  'ACTING_MODE_IMPLEMENTED: NO',
  'ACTING_MODE_DEFERRED_TO_C7_4: YES',
  'ADMIN_ACCOUNT_CREATION_IMPLEMENTED: NO',
  'TEACHER_ACCOUNT_CREATION_IMPLEMENTED: NO',
  'ACCOUNT_MANAGEMENT_DEFERRED_TO_C7: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'RPC_CALLED_BY_CODEX: NO',
  'AUTH_USER_CREATED: NO',
  'CENTER_CREATED_BY_CODEX: NO',
  'MEMBERSHIP_CREATED_BY_CODEX: NO',
  'RUNTIME_CHANGE: YES',
  'RUNTIME_CHANGE_SCOPE: INTERNAL_CONSOLE_TEXT_POLISH_ONLY',
  'C6_6G_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.6F',
  '## 2. Trạng thái sau C6.6E',
  '## 3. C6.6E manual QA PASS',
  '## 4. Phòng Trống post-create summary',
  '## 5. UI polish summary',
  '## 6. Text removed',
  '## 7. Runtime logic preserved',
  '## 8. Cách vào Phòng Trống hiện tại',
  '## 9. Vì sao hiện chưa có center switch',
  '## 10. Center switch khác acting mode thế nào',
  '## 11. Định hướng C6.6G Owner center switch / Mở OS cơ sở',
  '## 12. Panel tạo Giáo viên là gì',
  '## 13. Panel tạo admin là gì',
  '## 14. Vì sao admin/teacher account defer C7',
  '## 15. Risk list',
  '## 16. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  'Hiện tại chưa có cách vào Phòng Trống bằng UI nếu chưa có center switch.',
  'center switch = user chọn một center mà chính user có active membership.',
  'acting mode = super/owner giả lập vai trò người khác/cơ sở khác',
  'Tạo Giáo viên có 2 nghĩa',
  'Tài khoản teacher/admin thuộc C7 Account Management',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'Khu vực này dành cho owner. Danh sách bên dưới chỉ đọc từ Cloud.',
  'Mặc định chỉ hiển thị cơ sở production active.',
  'Owner nhập một trường duy nhất, hệ thống tạo cơ sở production trống qua RPC đã apply.',
].forEach((needle) => assertNotIncludes(main, needle))

;[
  'Thêm cơ sở',
  'Tên cơ sở',
  'provision_center_for_owner',
  'p_center_name',
  'createCompactCenterSlug',
  'Mã cơ sở sẽ tạo',
  "from('centers')",
  ".eq('environment', 'production')",
  ".eq('status', 'active')",
  'Không thể truy cập',
].forEach((needle) => assertIncludes(main, needle))

assertIncludes(styles, '.internal-add-center-form')
assertIncludes(styles, '.internal-centers-table')

assert(!/\.from\('centers'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate centers')
assert(!/\.from\("centers"\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate centers')
assert(!/\.from\('center_members'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate center_members')
assert(!/\.from\("center_members"\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate center_members')

;[
  'acting mode',
  'username login',
  'account management',
  'Teacher Portal',
  'Super Admin',
].forEach((needle) => assertNotIncludes(main, needle, `runtime ${needle}`))

const changedFiles = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
}).split(/\r?\n/).filter(Boolean).map((fileName) => fileName.replace(/\\/g, '/'))

for (const fileName of changedFiles.filter((fileName) => fileName.startsWith('src/'))) {
  assert(
    ['src/main.js', 'src/styles.css'].includes(fileName),
    `Unexpected runtime file in C6.6F scope: ${fileName}`,
  )
}

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C6.6F smoke: PASS')
