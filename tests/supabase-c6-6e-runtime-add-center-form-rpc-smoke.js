import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-6e-runtime-add-center-form-rpc.md')
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

assert(fs.existsSync(docPath), 'C6.6E docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C6.6E STATUS: RUNTIME ADD CENTER FORM RPC',
  'C6_6D_1_STATUS: PASS',
  'PHONGTRONG_PRECHECK_BY_USER: PASS',
  'RUNTIME_ADD_CENTER_FORM_IMPLEMENTED: YES',
  'OWNER_ONLY_FORM: YES',
  'VISIBLE_REQUIRED_FIELD_COUNT: 1',
  'VISIBLE_REQUIRED_FIELD: Tên cơ sở',
  'CLIENT_PREVIEW_SLUG_IMPLEMENTED: YES',
  'CLIENT_PREVIEW_CENTER_ID_IMPLEMENTED: YES',
  'CLIENT_COMPACT_SLUG_CONVENTION: YES',
  'RPC_CALL_IMPLEMENTED: YES',
  'RPC_NAME: provision_center_for_owner',
  'RPC_SQL_INPUT: p_center_name',
  'FRONTEND_DIRECT_INSERT_USED: NO',
  'DEFAULT_ENVIRONMENT: production',
  'DEFAULT_STATUS: active',
  'CONTROLLED_MANUAL_QA_TARGET: Phòng Trống',
  'CONTROLLED_MANUAL_QA_TARGET_SLUG: phongtrong',
  'CONTROLLED_MANUAL_QA_TARGET_CENTER_ID: phongtrong_prod',
  'GO_VAP_USED_AS_TEST_TARGET: NO',
  'CENTERS_LIST_REFRESH_AFTER_CREATE: YES',
  'LOADING_STATE_IMPLEMENTED: YES',
  'SUCCESS_STATE_IMPLEMENTED: YES',
  'ERROR_STATE_IMPLEMENTED: YES',
  'CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'RPC_CALLED_BY_CODEX: NO',
  'AUTH_USER_CREATED: NO',
  'CENTER_CREATED_BY_CODEX: NO',
  'MEMBERSHIP_CREATED_BY_CODEX: NO',
  'RUNTIME_CHANGE: YES',
  'RUNTIME_CHANGE_SCOPE: INTERNAL_CENTER_CONSOLE_ADD_CENTER_FORM_RPC_ONLY',
  'C6_6F_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.6E',
  '## 2. Trạng thái sau C6.6D.1',
  '## 3. SQL safety statement',
  '## 4. Runtime changes summary',
  '## 5. Owner-only access',
  '## 6. Form một field `Tên cơ sở`',
  '## 7. Preview slug/center_id',
  '## 8. Client-side validation',
  '## 9. RPC call design',
  '## 10. Vì sao không direct insert',
  '## 11. Loading/success/error states',
  '## 12. Duplicate/conflict handling',
  '## 13. Manual QA target Phòng Trống',
  '## 14. Manual QA after create',
  '## 15. Non-owner/signed-out regression',
  '## 16. C6.6F post-create verification dependency',
  '## 17. C7 deferred',
  '## 18. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  'Tên cơ sở',
  'Thêm cơ sở',
  'Tạo cơ sở',
  'Slug',
  'Mã cơ sở sẽ tạo',
  'production',
  'active',
  'createCompactCenterSlug',
  "replace(/đ/g, 'd')",
  "replace(/[^a-z0-9]/g, '')",
  'validateInternalAddCenterName',
  'Vui lòng nhập tên cơ sở.',
  'Tên cơ sở quá ngắn.',
  'Tên cơ sở chưa tạo được mã hợp lệ.',
  "supabase.rpc('provision_center_for_owner'",
  'p_center_name: centerName',
  'Đang tạo cơ sở...',
  'Đã tạo cơ sở',
  'Không tạo được cơ sở.',
  'Mã cơ sở đã tồn tại hoặc tên cơ sở đã được dùng trong production.',
  'loadInternalCentersList',
  'access.isOwner',
  'Không thể truy cập',
].forEach((needle) => assertIncludes(main, needle))

assertIncludes(styles, '.internal-add-center-form')
assertIncludes(styles, '.internal-add-center-preview')

assert(!/\.from\('centers'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate centers')
assert(!/\.from\("centers"\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate centers')
assert(!/\.from\('center_members'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate center_members')
assert(!/\.from\("center_members"\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not directly mutate center_members')

assert(!/provision_center_for_owner[\s\S]{0,300}Phòng Trống/i.test(main), 'runtime must not hardcode auto-create Phòng Trống')
assert(!/setTimeout[\s\S]{0,300}provision_center_for_owner/i.test(main), 'runtime must not auto-call RPC')
assert(!/addEventListener\('load'[\s\S]{0,500}provision_center_for_owner/i.test(main), 'runtime must not call RPC on load')
assertNotIncludes(main, 'acting mode', 'acting mode')
assertNotIncludes(main, 'username login', 'C7 username UI')
assertNotIncludes(main, 'account management', 'C7 account management UI')

const changedFiles = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
}).split(/\r?\n/).filter(Boolean).map((fileName) => fileName.replace(/\\/g, '/'))

assert(changedFiles.includes('src/main.js'), 'C6.6E must touch src/main.js')
assert(changedFiles.includes('src/styles.css'), 'C6.6E must touch src/styles.css')

for (const fileName of changedFiles.filter((fileName) => fileName.startsWith('src/'))) {
  assert(
    ['src/main.js', 'src/styles.css'].includes(fileName),
    `Unexpected runtime file in C6.6E scope: ${fileName}`,
  )
}

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C6.6E smoke: PASS')
