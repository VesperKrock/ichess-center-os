import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-6a-them-co-so-mot-truong-audit-design.md')
const smokePath = path.join(root, 'tests', 'supabase-c6-6a-them-co-so-mot-truong-audit-design-smoke.js')
const mainPath = path.join(root, 'src', 'main.js')

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

assert(fs.existsSync(docPath), 'C6.6A docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)

;[
  'C6.6A STATUS: ADD CENTER ONE FIELD AUDIT DESIGN',
  'C6_5_DONE: YES',
  'ADD_CENTER_ONE_FIELD_UX_DESIGNED: YES',
  'VISIBLE_REQUIRED_FIELD_COUNT: 1',
  'VISIBLE_REQUIRED_FIELD: Tên cơ sở',
  'AUTO_GENERATE_SLUG_DESIGNED: YES',
  'AUTO_GENERATE_CENTER_ID_DESIGNED: YES',
  'CENTER_ID_PATTERN_DESIGNED: <slug>_prod',
  'DEFAULT_ENVIRONMENT_DESIGNED: production',
  'DEFAULT_STATUS_DESIGNED: active',
  'EMPTY_CENTER_DESIGNED: YES',
  'CLONE_DREAMHOME: NO',
  'CLONE_ANGEL_WINGS: NO',
  'COPY_STAGING_STUDENTS: NO',
  'OWNER_MEMBERSHIP_FOR_NEW_CENTER_DESIGNED: YES',
  'CENTER_ADMIN_CREATION_REQUIRED_NOW: NO',
  'CENTER_ADMIN_DEFERRED: YES',
  'DUPLICATE_CONFLICT_HANDLING_DESIGNED: YES',
  'FRONTEND_DIRECT_INSERT_RECOMMENDED: NO',
  'GUARDED_RPC_OPTION_REVIEWED: YES',
  'MANUAL_APPLY_OPTION_REVIEWED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'NEW_CENTER_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C6_6B_STARTED: NO',
  'C6_6C_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.6A',
  '## 2. Trạng thái sau C6.5',
  '## 3. UX một trường cho anh Hải',
  '## 4. Field bắt buộc duy nhất: Tên cơ sở',
  '## 5. Preview readonly tự sinh',
  '## 6. Slug generation design',
  '## 7. Center ID generation design',
  '## 8. Environment/status mặc định',
  '## 9. Định nghĩa ngôi nhà trống',
  '## 10. Owner membership requirement',
  '## 11. Admin cơ sở defer',
  '## 12. Duplicate/conflict handling',
  '## 13. Option A frontend direct insert',
  '## 14. Option B guarded SQL/RPC',
  '## 15. Option C manual apply/admin-only before UI',
  '## 16. Recommendation cho C6.6B/C',
  '## 17. Vì sao không clone DreamHome/Angel Wings',
  '## 18. Vì sao không làm C7 account management',
  '## 19. Risk list',
  '## 20. C6.6 phase split',
  '## 21. PASS / NEEDS REVIEW criteria',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'Tên cơ sở',
  'Gò Vấp -> slug govap -> center_id govap_prod',
  'Quận 12 -> slug quan12 -> center_id quan12_prod',
  'center_id = <slug>_prod',
  'environment = production',
  'status = active',
  'user_id = current owner user id',
  'role = owner',
  'status = active',
  'Tên cơ sở này tạo ra mã đã tồn tại. Vui lòng đổi tên hoặc thêm khu vực phân biệt.',
  'provision_center_for_owner(center_name text)',
  'C6.6B - Provisioning SQL/RPC design + read-only inspection pack.',
  'C6.6C - Manual apply RPC/policy or SQL function, nếu được xác nhận.',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(main, "from('centers')", 'C6.5 readonly centers read remains')
assert(!/\.from\('centers'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not mutate public.centers')
assert(!/\.from\("centers"\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not mutate public.centers')
assertNotIncludes(main, 'username login', 'C7 username UI')
assertNotIncludes(main, 'account management', 'C7 account management UI')
assertNotIncludes(main, 'Super Admin', 'Super Admin advanced')

const diffNames = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
})
const changedFiles = diffNames.split(/\r?\n/).filter(Boolean).map((fileName) => fileName.replace(/\\/g, '/'))

const allowedChangedPaths = new Set([
  'src/main.js',
  'src/styles.css',
  'tests/supabase-c6-6a-them-co-so-mot-truong-audit-design-smoke.js',
  'tests/supabase-c6-6b-provisioning-rpc-design-inspection-pack-smoke.js',
  'tests/supabase-c6-6c-rpc-apply-decision-ready-smoke.js',
  'tests/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack-smoke.js',
  'tests/supabase-c6-6d-1-doi-target-test-phong-trong-smoke.js',
  'tests/supabase-c6-6e-runtime-add-center-form-rpc-smoke.js',
  'tests/supabase-c6-6f-post-create-verify-polish-enter-center-design-smoke.js',
  'docs/supabase-c6-6a-them-co-so-mot-truong-audit-design.md',
  'docs/supabase-c6-6b-manual-apply-provision-center-rpc-template.sql',
  'docs/supabase-c6-6c-post-apply-verify-provision-center-rpc.sql',
  'docs/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack.md',
  'docs/supabase-c6-6d-readonly-verify-rpc-applied.sql',
  'docs/supabase-c6-6d-controlled-create-center-rpc-template.sql',
  'docs/supabase-c6-6d-post-create-verify-center.sql',
  'docs/supabase-c6-6d-1-doi-target-test-phong-trong.md',
  'docs/supabase-c6-6e-runtime-add-center-form-rpc.md',
  'docs/supabase-c6-6f-post-create-verify-polish-enter-center-design.md',
  'docs/supabase-c6-6g-owner-center-switch-mo-os-co-so.md',
  'docs/supabase-c6-6h-checkpoint-review-add-center-center-switch.md',
  'docs/supabase-c6-6c-manual-apply-provision-center-rpc.sql',
  'docs/supabase-c6-6c-rpc-apply-decision-ready.md',
  'docs/supabase-c6-6b-readonly-inspect-add-center-provisioning-readiness.sql',
  'docs/supabase-c6-6b-provisioning-rpc-design-inspection-pack.md',
  'docs/supabase-c6-6a-them-co-so-mot-truong-audit-design.md',
  'tests/supabase-c6-6a-them-co-so-mot-truong-audit-design-smoke.js',
])

for (const fileName of fs.readdirSync(path.join(root, 'tests'))) {
  if (/^supabase-c6-.*-smoke\.js$/.test(fileName)) {
    allowedChangedPaths.add(`tests/${fileName}`)
  }
}

const status = execFileSync('git', ['status', '--short'], {
  cwd: root,
  encoding: 'utf8',
})

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.6A scope: ${changedPath}`)
  assert(!/c6-6(?![abcdefgh])|c7|teacher-portal|super-admin/i.test(changedPath), `C6.6A must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(smokePath)
assertNoMojibake(mainPath)

console.log('C6.6A smoke: PASS')
