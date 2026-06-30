import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack.md')
const readonlySqlPath = path.join(root, 'docs', 'supabase-c6-6d-readonly-verify-rpc-applied.sql')
const controlledSqlPath = path.join(root, 'docs', 'supabase-c6-6d-controlled-create-center-rpc-template.sql')
const postCreateSqlPath = path.join(root, 'docs', 'supabase-c6-6d-post-create-verify-center.sql')
const smokePath = path.join(root, 'tests', 'supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack-smoke.js')
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

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
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

assert(fs.existsSync(docPath), 'C6.6D docs must exist')
assert(fs.existsSync(readonlySqlPath), 'C6.6D read-only verify SQL must exist')
assert(fs.existsSync(controlledSqlPath), 'C6.6D controlled create template must exist')
assert(fs.existsSync(postCreateSqlPath), 'C6.6D post-create verify SQL must exist')

const docs = readUtf8(docPath)
const readonlySql = readUtf8(readonlySqlPath)
const controlledSql = readUtf8(controlledSqlPath)
const postCreateSql = readUtf8(postCreateSqlPath)
const main = readUtf8(mainPath)

;[
  'C6.6D STATUS: POST APPLY VERIFY CONTROLLED RPC TEST PACK',
  'C6_6C_STATUS: PASS',
  'C6_6C_MANUAL_APPLY_BY_USER: PASS',
  'C6_6C_SLUG_VERIFY_BY_USER: PASS',
  'READONLY_VERIFY_RPC_APPLIED_SQL_CREATED: YES',
  'CONTROLLED_CREATE_RPC_TEMPLATE_CREATED: YES',
  'POST_CREATE_VERIFY_SQL_CREATED: YES',
  'RPC_NAME: provision_center_for_owner',
  'RPC_SQL_INPUT: p_center_name',
  'VISIBLE_REQUIRED_FIELD: Tên cơ sở',
  'COMPACT_SLUG_CONVENTION_CONFIRMED: YES',
  'SLUG_EXAMPLE_GO_VAP: govap',
  'SLUG_EXAMPLE_PHU_NHUAN: phunhuan',
  'SLUG_EXAMPLE_THU_DUC: thuduc',
  'SLUG_EXAMPLE_QUAN_12: quan12',
  'TARGET_PRECHECK_DESIGNED: YES',
  'DEFAULT_REAL_TARGET_FOR_CONTROLLED_TEST: Phòng Trống',
  'DEFAULT_REAL_TARGET_CENTER_ID: phongtrong_prod',
  'DEFAULT_REAL_TARGET_SLUG: phongtrong',
  'SQL_EDITOR_AUTH_UID_LIMITATION_DOCUMENTED: YES',
  'NO_FAKE_TEST_CENTER_RECOMMENDED_WITHOUT_CLEANUP: YES',
  'NO_REAL_CENTER_CREATED_BY_CODEX: YES',
  'NO_RPC_CALL_BY_CODEX: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED_BY_CODEX: NO',
  'NEW_CENTER_CREATED_BY_CODEX: NO',
  'RUNTIME_CHANGE: NO',
  'C6_6E_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.6D',
  '## 2. Trạng thái sau C6.6C apply',
  '## 3. SQL safety statement',
  '## 4. Files created',
  '## 5. Read-only verify RPC applied',
  '## 6. Slug verify expected',
  '## 7. Target center precheck',
  '## 8. Controlled create RPC template',
  '## 9. Vì sao không tạo fake/test center nếu chưa có cleanup',
  '## 10. Vì sao ưu tiên target test Phòng Trống sau C6.6D.1',
  '## 11. SQL Editor auth.uid() limitation',
  '## 12. Supabase authenticated app/session test option',
  '## 13. Post-create verify SQL',
  '## 14. Internal Center Console manual QA after create',
  '## 15. Rollback/cleanup risk note',
  '## 16. C6.6E runtime plan',
  '## 17. C7 deferred',
  '## 18. PASS / NEEDS REVIEW criteria',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'SQL Editor chạy với role `postgres` có thể không có `auth.uid()`.',
  'Nếu gọi RPC trong SQL Editor bị `not_authenticated` hoặc `owner_membership_required`, không tự sửa RPC để bỏ guard.',
  'Không khuyến nghị fake/test center nếu chưa có cleanup/archive plan',
  'Expected thấy thêm Phòng Trống / `phongtrong_prod` / `phongtrong` / `production` / `active`.',
  'không dùng Gò Vấp làm target test',
].forEach((needle) => assertIncludes(docs, needle))

;[
  '-- C6.6D READ-ONLY VERIFY RPC APPLIED',
  '-- This file must not create centers.',
  '-- This file must not create memberships.',
  '-- This file must not call provision_center_for_owner.',
  'ichess_slugify_center_name_compact',
  'provision_center_for_owner',
  'public.ichess_slugify_center_name_compact',
  'owner.duchai@ichess.vn',
  'phongtrong_prod',
  'phongtrong',
  'govap_prod',
  'phunhuan_prod',
  'thuduc_prod',
  'quan12_prod',
  'binhthanh_prod',
].forEach((needle) => assertIncludes(readonlySql, needle))

const readonlyExecutable = stripSqlComments(readonlySql)
assert(!/(select|perform)\s+public\.provision_center_for_owner\s*\(/i.test(readonlyExecutable), 'read-only verify SQL must not call provisioning RPC')
assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge)\b/i.test(readonlyExecutable), 'read-only verify SQL must not mutate data/schema')

;[
  '-- C6.6D CONTROLLED CREATE CENTER RPC TEMPLATE',
  '-- DO NOT RUN UNLESS USER CONFIRMS THE TARGET CENTER NAME.',
  '-- This SQL will create a real production center and owner membership',
  'Supabase SQL Editor usually runs as role postgres, so auth.uid() can be null.',
  "-- select public.provision_center_for_owner('Phòng Trống');",
  'Do not use Gò Vấp / govap_prod for test because it may become a real future center.',
  "-- select public.provision_center_for_owner('Phú Nhuận');",
  "-- select public.provision_center_for_owner('Thủ Đức');",
  "-- select public.provision_center_for_owner('Quận 12');",
  'This does not clone DreamHome.',
  'This does not copy Angel Wings.',
].forEach((needle) => assertIncludes(controlledSql, needle))

const controlledExecutable = stripSqlComments(controlledSql)
assert(!/public\.provision_center_for_owner\s*\(/i.test(controlledExecutable), 'controlled template must not execute RPC outside comments')
assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge)\b/i.test(controlledExecutable), 'controlled template must not mutate outside commented RPC examples')

;[
  '-- C6.6D POST-CREATE VERIFY CENTER',
  '-- Read-only verification after a controlled RPC create.',
  '-- This file must not create centers.',
  '-- This file must not create memberships.',
  '-- This file must not call provision_center_for_owner.',
  "id = 'phongtrong_prod'",
  "slug = 'phongtrong'",
  "cm.center_id = 'phongtrong_prod'",
].forEach((needle) => assertIncludes(postCreateSql, needle))

const postCreateExecutable = stripSqlComments(postCreateSql)
assert(!/public\.provision_center_for_owner\s*\(/i.test(postCreateExecutable), 'post-create verify SQL must not call provisioning RPC')
assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge)\b/i.test(postCreateExecutable), 'post-create verify SQL must not mutate data/schema')

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
  'docs/supabase-c6-6a-them-co-so-mot-truong-audit-design.md',
  'docs/supabase-c6-6b-provisioning-rpc-design-inspection-pack.md',
  'docs/supabase-c6-6b-readonly-inspect-add-center-provisioning-readiness.sql',
  'docs/supabase-c6-6b-manual-apply-provision-center-rpc-template.sql',
  'docs/supabase-c6-6c-rpc-apply-decision-ready.md',
  'docs/supabase-c6-6c-manual-apply-provision-center-rpc.sql',
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
  'tests/supabase-c6-6a-them-co-so-mot-truong-audit-design-smoke.js',
  'tests/supabase-c6-6b-provisioning-rpc-design-inspection-pack-smoke.js',
  'tests/supabase-c6-6c-rpc-apply-decision-ready-smoke.js',
  'tests/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack-smoke.js',
  'tests/supabase-c6-6d-1-doi-target-test-phong-trong-smoke.js',
  'tests/supabase-c6-6e-runtime-add-center-form-rpc-smoke.js',
  'tests/supabase-c6-6f-post-create-verify-polish-enter-center-design-smoke.js',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.6D scope: ${changedPath}`)
  assert(!/c6-6(?![abcdefgh])|c7|teacher-portal|super-admin/i.test(changedPath), `C6.6D must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(readonlySqlPath)
assertNoMojibake(controlledSqlPath)
assertNoMojibake(postCreateSqlPath)
assertNoMojibake(smokePath)
assertNoMojibake(mainPath)

console.log('C6.6D smoke: PASS')
