import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-6h-checkpoint-review-add-center-center-switch.md')
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

assert(fs.existsSync(docPath), 'C6.6H docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C6.6H STATUS: CHECKPOINT REVIEW ADD CENTER CENTER SWITCH',
  'C6_6A_STATUS: PASS',
  'C6_6B_STATUS: PASS',
  'C6_6C_STATUS: PASS',
  'C6_6D_STATUS: PASS',
  'C6_6D_1_STATUS: PASS',
  'C6_6E_STATUS: PASS',
  'C6_6F_STATUS: PASS',
  'C6_6G_STATUS: PASS',
  'C6_6E_MANUAL_QA: PASS',
  'C6_6G_MANUAL_QA: PASS',
  'ADD_CENTER_FLOW_WORKING: YES',
  'OWNER_CENTER_SWITCH_WORKING: YES',
  'PHONG_TRONG_CREATED_BY_USER: YES',
  'PHONG_TRONG_OPENED_BY_OWNER: YES',
  'PHONG_TRONG_CENTER_ID: phongtrong_prod',
  'PHONG_TRONG_SLUG: phongtrong',
  'PHONG_TRONG_ENVIRONMENT: production',
  'PHONG_TRONG_STATUS: active',
  'DREAMHOME_STILL_AVAILABLE: YES',
  'PRODUCTION_STAGING_SEPARATION_PRESERVED: YES',
  'ANGEL_WINGS_CLONED_TO_PHONG_TRONG: NO',
  'STAGING_STUDENTS_COPIED_TO_PHONG_TRONG: NO',
  'OWNER_ONLY_INTERNAL_CONSOLE: YES',
  'CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'CENTER_SWITCH_IS_ACTING_MODE: NO',
  'ACTING_MODE_IMPLEMENTED: NO',
  'ACTING_MODE_DEFERRED_TO_C7_4: YES',
  'ADMIN_ACCOUNT_CREATION_IMPLEMENTED: NO',
  'TEACHER_ACCOUNT_CREATION_IMPLEMENTED: NO',
  'ACCOUNT_MANAGEMENT_DEFERRED_TO_C7: YES',
  'MODULE_6_TEACHER_BUTTON_REUSE_RECOMMENDED: YES',
  'INTERNAL_CONSOLE_WIDTH_POLISH_REQUESTED: YES',
  'INTERNAL_CONSOLE_WIDTH_POLISH_BLOCKER: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'RPC_CALLED_BY_CODEX: NO',
  'AUTH_USER_CREATED_BY_CODEX: NO',
  'CENTER_CREATED_BY_CODEX: NO',
  'MEMBERSHIP_CREATED_BY_CODEX: NO',
  'RUNTIME_CHANGE_NEW_IN_C6_6H: NO',
  'READY_FOR_C6_6I_COMMIT_PUSH: YES',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.6H',
  '## 2. Trạng thái trước checkpoint',
  '## 3. Tổng hợp C6.6A',
  '## 4. Tổng hợp C6.6B',
  '## 5. Tổng hợp C6.6C',
  '## 6. Tổng hợp C6.6D',
  '## 7. Tổng hợp C6.6D.1',
  '## 8. Tổng hợp C6.6E',
  '## 9. Tổng hợp C6.6F',
  '## 10. Tổng hợp C6.6G',
  '## 11. Manual QA C6.6E PASS',
  '## 12. Manual QA C6.6G PASS',
  '## 13. Add Center flow current behavior',
  '## 14. Owner center switch current behavior',
  '## 15. Phòng Trống current state',
  '## 16. DreamHome current state',
  '## 17. Production/staging separation',
  '## 18. Data safety / no clone / no Angel Wings copy',
  '## 19. Account/admin/teacher model deferred C7',
  '## 20. Module 6 teacher button future note',
  '## 21. UI width polish follow-up',
  '## 22. Risk list',
  '## 23. Recommendation C6.6I commit/push',
  '## 24. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  'Admin cơ sở không nên tạo giáo viên global.',
  'Owner/anh Hải tạo giáo viên',
  'giáo viên có thể được phân vào nhiều cơ sở',
  'mỗi cơ sở chỉ thấy giáo viên được phân vào cơ sở đó',
  'center_admin chỉ thuộc một cơ sở',
  'Teacher/admin account management defer C7',
  'Nút tạo giáo viên hiện tại trong Module 6 không xóa ngay ở C6.',
  'owner tạo giáo viên global',
  'center_admin xem giáo viên được phân vào cơ sở',
  'Internal Console/table rộng hơn',
  'không phải blocker logic cho C6.6H',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(main, 'Mở OS cơ sở')
assertIncludes(main, 'handleInternalOpenCenter')
assertIncludes(main, 'provision_center_for_owner')
assertIncludes(styles, '.internal-centers-open')

assert(!/\.from\('centers'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate centers')
assert(!/\.from\("centers"\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate centers')
assert(!/\.from\('center_members'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate center_members')
assert(!/\.from\("center_members"\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate center_members')

;[
  'acting mode',
  'Impersonate',
  'Biến thành admin',
  'username login',
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
    `Unexpected runtime file in C6.6H scope: ${fileName}`,
  )
}

const status = execFileSync('git', ['status', '--short'], {
  cwd: root,
  encoding: 'utf8',
})

const allowedHPaths = new Set([
  'docs/supabase-c6-6h-checkpoint-review-add-center-center-switch.md',
  'tests/supabase-c6-6h-checkpoint-review-add-center-center-switch-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  if (changedPath.includes('c6-6h')) {
    assert(allowedHPaths.has(changedPath), `Unexpected C6.6H file: ${changedPath}`)
  }
  assert(!/c6-6i|c7|teacher-portal|super-admin/i.test(changedPath), `C6.6H must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C6.6H smoke: PASS')
