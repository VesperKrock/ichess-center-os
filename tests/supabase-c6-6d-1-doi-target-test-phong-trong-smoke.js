import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-6d-1-doi-target-test-phong-trong.md')
const c66dDocPath = path.join(root, 'docs', 'supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack.md')
const readonlySqlPath = path.join(root, 'docs', 'supabase-c6-6d-readonly-verify-rpc-applied.sql')
const controlledSqlPath = path.join(root, 'docs', 'supabase-c6-6d-controlled-create-center-rpc-template.sql')
const postCreateSqlPath = path.join(root, 'docs', 'supabase-c6-6d-post-create-verify-center.sql')
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

assert(fs.existsSync(docPath), 'C6.6D.1 docs must exist')
assert(fs.existsSync(c66dDocPath), 'C6.6D docs must exist')
assert(fs.existsSync(readonlySqlPath), 'C6.6D read-only SQL must exist')
assert(fs.existsSync(controlledSqlPath), 'C6.6D controlled template must exist')
assert(fs.existsSync(postCreateSqlPath), 'C6.6D post-create verify SQL must exist')

const docs = readUtf8(docPath)
const c66dDocs = readUtf8(c66dDocPath)
const readonlySql = readUtf8(readonlySqlPath)
const controlledSql = readUtf8(controlledSqlPath)
const postCreateSql = readUtf8(postCreateSqlPath)
const main = readUtf8(mainPath)

;[
  'C6.6D.1 STATUS: CONTROLLED TEST TARGET UPDATED TO PHONG TRONG',
  'C6_6D_STATUS: PASS',
  'OLD_DEFAULT_TARGET: Gò Vấp',
  'OLD_DEFAULT_TARGET_CENTER_ID: govap_prod',
  'OLD_DEFAULT_TARGET_SLUG: govap',
  'NEW_DEFAULT_TARGET: Phòng Trống',
  'NEW_DEFAULT_TARGET_CENTER_ID: phongtrong_prod',
  'NEW_DEFAULT_TARGET_SLUG: phongtrong',
  'REASON_NOT_USE_GO_VAP_FOR_TEST: FUTURE_REAL_CENTER_CONFLICT_RISK',
  'READONLY_PRECHECK_UPDATED: YES',
  'CONTROLLED_CREATE_TEMPLATE_UPDATED: YES',
  'POST_CREATE_VERIFY_UPDATED: YES',
  'INTERNAL_CONSOLE_QA_UPDATED: YES',
  'SQL_EDITOR_AUTH_UID_LIMITATION_PRESERVED: YES',
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
  '## 1. Mục tiêu C6.6D.1',
  '## 2. Lý do đổi target test',
  '## 3. Vì sao không dùng Gò Vấp',
  '## 4. Target mới Phòng Trống',
  '## 5. Files updated',
  '## 6. Read-only precheck updated',
  '## 7. Controlled create template updated',
  '## 8. Post-create verify updated',
  '## 9. Internal Console QA updated',
  '## 10. SQL Editor auth.uid() limitation vẫn giữ nguyên',
  '## 11. Safety checklist',
  '## 12. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  'Không dùng Gò Vấp làm target test vì Gò Vấp có thể là cơ sở thật trong tương lai.',
  'Nếu tạo `govap_prod` để test, sau này anh Hải tạo Gò Vấp thật sẽ bị conflict',
  'Phòng Trống / `phongtrong_prod` / `phongtrong` / `production` / `active`',
  'SQL Editor chạy với role `postgres` có thể không có `auth.uid()`.',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'DEFAULT_REAL_TARGET_FOR_CONTROLLED_TEST: Phòng Trống',
  'DEFAULT_REAL_TARGET_CENTER_ID: phongtrong_prod',
  'DEFAULT_REAL_TARGET_SLUG: phongtrong',
  'không dùng Gò Vấp làm target test',
].forEach((needle) => assertIncludes(c66dDocs, needle))

;[
  'phongtrong_prod',
  'phongtrong',
  'ichess_slugify_center_name_compact',
  'owner.duchai@ichess.vn',
].forEach((needle) => assertIncludes(readonlySql, needle))

const readonlyExecutable = stripSqlComments(readonlySql)
assert(!/(select|perform)\s+public\.provision_center_for_owner\s*\(/i.test(readonlyExecutable), 'read-only SQL must not call provisioning RPC')
assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge)\b/i.test(readonlyExecutable), 'read-only SQL must not mutate data/schema')

;[
  "-- select public.provision_center_for_owner('Phòng Trống');",
  'Do not use Gò Vấp / govap_prod for test because it may become a real future center.',
  '-- DO NOT RUN UNLESS USER CONFIRMS THE TARGET CENTER NAME.',
].forEach((needle) => assertIncludes(controlledSql, needle))

assert(!/Target option A:[\s\S]{0,160}Gò Vấp/i.test(controlledSql), 'Gò Vấp must not remain default target')
const controlledExecutable = stripSqlComments(controlledSql)
assert(!/public\.provision_center_for_owner\s*\(/i.test(controlledExecutable), 'controlled template must not execute RPC outside comments')
assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge)\b/i.test(controlledExecutable), 'controlled template must not mutate outside commented examples')

;[
  "id = 'phongtrong_prod'",
  "slug = 'phongtrong'",
  "cm.center_id = 'phongtrong_prod'",
].forEach((needle) => assertIncludes(postCreateSql, needle))
assertNotIncludes(postCreateSql, "id = 'govap_prod'", 'old govap default center id')
assertNotIncludes(postCreateSql, "cm.center_id = 'govap_prod'", 'old govap default membership verify')

const postCreateExecutable = stripSqlComments(postCreateSql)
assert(!/public\.provision_center_for_owner\s*\(/i.test(postCreateExecutable), 'post-create SQL must not call provisioning RPC')
assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge)\b/i.test(postCreateExecutable), 'post-create SQL must not mutate data/schema')

assert(!/\.from\('centers'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not mutate public.centers')
assert(!/\.from\("centers"\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not mutate public.centers')
assertNotIncludes(main, 'username login', 'C7 username UI')
assertNotIncludes(main, 'account management', 'C7 account management UI')

const changedFiles = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
}).split(/\r?\n/).filter(Boolean).map((fileName) => fileName.replace(/\\/g, '/'))


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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.6D.1 scope: ${changedPath}`)
  assert(!/c6-6(?![abcdefgh])|c7|teacher-portal|super-admin/i.test(changedPath), `C6.6D.1 must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(c66dDocPath)
assertNoMojibake(readonlySqlPath)
assertNoMojibake(controlledSqlPath)
assertNoMojibake(postCreateSqlPath)
assertNoMojibake(mainPath)

console.log('C6.6D.1 smoke: PASS')
