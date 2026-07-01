import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-6e-deploy-secrets-no-op-duplicate-qa-readiness.md')
const preflightSqlPath = path.join(root, 'docs', 'supabase-c7-6e-readonly-preflight-admin-provisioning-qa.sql')
const postQaSqlPath = path.join(root, 'docs', 'supabase-c7-6e-readonly-post-qa-admin-provisioning-verify.sql')
const testPath = path.join(root, 'tests', 'supabase-c7-6e-deploy-secrets-no-op-duplicate-qa-readiness-smoke.js')

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
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '')
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

function getStatusPaths() {
  const status = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })
  return status
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/\\/g, '/'))
}

assert(fs.existsSync(docPath), 'Docs C7.6E must exist')
assert(fs.existsSync(preflightSqlPath), 'Preflight SQL C7.6E must exist')
assert(fs.existsSync(postQaSqlPath), 'Post-QA SQL C7.6E must exist')
assert(fs.existsSync(testPath), 'Smoke C7.6E must exist')

const docs = readUtf8(docPath)
const preflightSql = readUtf8(preflightSqlPath)
const postQaSql = readUtf8(postQaSqlPath)
const preflightExecutableSql = stripSqlComments(preflightSql)
const postQaExecutableSql = stripSqlComments(postQaSql)

;[
  'C7.6E STATUS: DEPLOY SECRETS NO-OP DUPLICATE QA READINESS',
  'C7_6D_STATUS: PASS',
  'EDGE_FUNCTION_IMPLEMENTED: YES',
  'AUDIT_TABLE_APPLIED_AND_VERIFIED: YES',
  'SOURCE_PREFLIGHT_CHECKLIST_CREATED: YES',
  'SECRETS_READINESS_CHECKLIST_CREATED: YES',
  'DEPLOY_CHECKLIST_CREATED: YES',
  'VERIFY_JWT_REQUIRED: YES',
  'VERIFY_JWT_DISABLED_ALLOWED: NO',
  'DREAMHOME_NO_OP_DUPLICATE_QA_PLAN_CREATED: YES',
  'DREAMHOME_EXPECTED_CODE: center_admin_already_exists',
  'PHONGTRONG_CONTROLLED_QA_PLAN_CREATED: YES',
  'PHONGTRONG_EXPECTED_EMAIL: admin.phongtrong@ichess.vn',
  'READONLY_PREFLIGHT_SQL_CREATED: YES',
  'READONLY_POST_QA_VERIFY_SQL_CREATED: YES',
  'ROLLBACK_MANUAL_CLEANUP_PLAN_CREATED: YES',
  'PASSWORD_LEAK_VERIFY_QUERY_CREATED: YES',
  'EDGE_FUNCTION_DEPLOYED: NO',
  'SECRETS_SET_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED_IN_SUPABASE: NO',
  'ADMIN_PHONGTRONG_CREATED: NO',
  'RUNTIME_UI_CHANGE: NO',
  'C7_6F_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 3. Source preflight checklist',
  'Không hardcode service role key.',
  'Không dùng `Math.random`.',
  'Có `crypto.getRandomValues`.',
  'Có Authorization/Bearer handling.',
  'Có `auth.getUser`.',
  'Có owner guard `role = owner` và `status = active`.',
  'Có center validation `production` và `active`.',
  'Audit `metadata`/`before_state`/`after_state` không chứa password key.',
  '## 4. Secrets readiness checklist',
  'SUPABASE_SERVICE_ROLE_KEY',
  'verify_jwt` phải enabled/không tắt',
  '## 5. Deploy checklist',
  'supabase functions deploy provision-center-admin-account',
  'Không chạy command này trong C7.6E.',
  '## 7. DreamHome no-op duplicate QA',
  '"code": "center_admin_already_exists"',
  '## 8. Phòng Trống controlled QA',
  'admin.phongtrong@ichess.vn',
  '## 10. Password leak verify',
  'Expected password leak query: 0 rows.',
  '## 11. Rollback/manual cleanup plan',
  'Case A - Auth user created but membership missing',
  'Case B - membership created but audit missing',
  'Case C - audit created but password not displayed',
].forEach((needle) => assertIncludes(docs, needle))

;[
  '-- C7.6E READ-ONLY PREFLIGHT ONLY',
  '-- Do not modify data.',
  '-- Do not create Auth users.',
  '-- Do not create memberships.',
  '-- Do not invoke Edge Functions.',
  'from public.centers',
  "where id in ('dreamhome_prod', 'phongtrong_prod')",
  'from auth.users',
  'from public.account_audit_logs',
].forEach((needle) => assertIncludes(preflightSql, needle))

;[
  '-- C7.6E POST-QA VERIFY READ-ONLY',
  '-- Do not modify data.',
  'active_center_admin_count',
  'admin.dreamhome@ichess.vn',
  'admin.phongtrong@ichess.vn',
  "action = 'account.provision_center_admin'",
  "metadata ? 'temporary_password'",
  "metadata ? 'password'",
  "metadata ? 'plaintext_password'",
  "before_state ? 'temporary_password'",
  "after_state ? 'plaintext_password'",
].forEach((needle) => assertIncludes(postQaSql, needle))

const mutatingSqlPattern = /\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge|call)\b/i
assert(!mutatingSqlPattern.test(preflightExecutableSql), 'Preflight SQL must be read-only')
assert(!mutatingSqlPattern.test(postQaExecutableSql), 'Post-QA SQL must be read-only')

;[
  'EDGE_FUNCTION_DEPLOYED: YES',
  'SECRETS_SET_BY_CODEX: YES',
  'SUPABASE_ACTION_BY_CODEX: RUN',
  'AUTH_USER_CREATED: YES',
  'MEMBERSHIP_CREATED_IN_SUPABASE: YES',
  'ADMIN_PHONGTRONG_CREATED: YES',
  'RUNTIME_UI_CHANGE: YES',
  'C7_6F_STARTED: YES',
  'COMMIT: DONE',
  'PUSH: DONE',
].forEach((needle) => assertNotIncludes(docs, needle))

const changedPaths = getStatusPaths()
const allowedPaths = new Set([
  'docs/supabase-c7-1-account-people-model-audit-design.md',
  'tests/supabase-c7-1-account-people-model-audit-design-smoke.js',
  'docs/supabase-c7-2-readonly-inspection-auth-membership-teacher-data.md',
  'docs/supabase-c7-2-readonly-inspect-auth-membership-teacher-data.sql',
  'tests/supabase-c7-2-readonly-inspection-auth-membership-teacher-data-smoke.js',
  'docs/supabase-c7-3-account-provisioning-ux-security-design.md',
  'tests/supabase-c7-3-account-provisioning-ux-security-design-smoke.js',
  'docs/supabase-c7-4-access-governance-center-lifecycle-design.md',
  'tests/supabase-c7-4-access-governance-center-lifecycle-design-smoke.js',
  'docs/supabase-c7-5-server-side-account-provisioning-readiness.md',
  'tests/supabase-c7-5-server-side-account-provisioning-readiness-smoke.js',
  'docs/supabase-c7-6a-edge-function-admin-provisioning-implementation-design-pack.md',
  'tests/supabase-c7-6a-edge-function-admin-provisioning-implementation-design-pack-smoke.js',
  'docs/supabase-c7-6b-edge-function-admin-provisioning-apply-deploy-readiness.md',
  'docs/supabase-c7-6b-readonly-inspect-admin-provisioning-readiness.sql',
  'tests/supabase-c7-6b-edge-function-admin-provisioning-apply-deploy-readiness-smoke.js',
  'docs/supabase-c7-6c-ha-tang-audit-server-side-apply-readiness.md',
  'docs/supabase-c7-6c-manual-apply-account-audit-log.sql',
  'docs/supabase-c7-6c-post-apply-verify-account-audit-log.sql',
  'tests/supabase-c7-6c-ha-tang-audit-server-side-apply-readiness-smoke.js',
  'supabase/functions/provision-center-admin-account/index.ts',
  'supabase/functions/provision-center-admin-account/deno.json',
  'supabase/',
  'docs/supabase-c7-6d-edge-function-admin-provisioning-implementation.md',
  'tests/supabase-c7-6d-edge-function-admin-provisioning-implementation-smoke.js',
  'docs/supabase-c7-6e-deploy-secrets-no-op-duplicate-qa-readiness.md',
  'docs/supabase-c7-6e-readonly-preflight-admin-provisioning-qa.sql',
  'docs/supabase-c7-6e-readonly-post-qa-admin-provisioning-verify.sql',
  'tests/supabase-c7-6e-deploy-secrets-no-op-duplicate-qa-readiness-smoke.js',
  'docs/supabase-c7-6f-predeploy-hardening-va-manual-noop-duplicate-pack.md',
  'tests/supabase-c7-6f-predeploy-hardening-va-manual-noop-duplicate-pack-smoke.js',
  'docs/supabase-c7-6g-1-hotfix-owner-guard-sau-deploy-noop.md',
  'tests/supabase-c7-6g-1-hotfix-owner-guard-sau-deploy-noop-smoke.js',
  'docs/supabase-c7-6g-2-owner-guard-diagnostics-service-role-hardening.md',
  'tests/supabase-c7-6g-2-owner-guard-diagnostics-service-role-hardening-smoke.js',
  'docs/supabase-c7-6g-3-service-role-grants-cho-admin-provisioning.md',
  'docs/supabase-c7-6g-3-manual-apply-service-role-grants.sql',
  'docs/supabase-c7-6g-3-post-apply-verify-service-role-grants.sql',
  'tests/supabase-c7-6g-3-service-role-grants-cho-admin-provisioning-smoke.js',
  'docs/supabase-c7-6h-controlled-phongtrong-admin-provisioning.md',
  'docs/supabase-c7-6h-readonly-preinvoke-phongtrong-admin.sql',
  'docs/supabase-c7-6h-readonly-post-provision-verify-phongtrong-admin.sql',
  'docs/supabase-c7-6h-browser-console-invoke-phongtrong-admin.js',
  'tests/supabase-c7-6h-controlled-phongtrong-admin-provisioning-smoke.js',
  'supabase/functions/reset-center-admin-password/index.ts',
  'supabase/functions/reset-center-admin-password/deno.json',
  'supabase/config.toml',
  'docs/supabase-c7-6i-reset-mat-khau-tam-admin-va-handoff-tien-loi.md',
  'docs/supabase-c7-6i-browser-console-reset-phongtrong-admin-password.js',
  'docs/supabase-c7-6i-readonly-post-reset-verify-phongtrong-admin.sql',
  'tests/supabase-c7-6i-reset-mat-khau-tam-admin-va-handoff-tien-loi-smoke.js',
  'supabase/functions/revoke-center-admin-access/index.ts',
  'supabase/functions/revoke-center-admin-access/deno.json',
  'docs/supabase-c7-7b-revoke-disable-admin-access-pack.md',
  'docs/supabase-c7-7b-browser-console-revoke-phongtrong-admin-access.js',
  'docs/supabase-c7-7b-readonly-post-revoke-verify-phongtrong-admin.sql',
  'tests/supabase-c7-7b-revoke-disable-admin-access-pack-smoke.js',
  'docs/supabase-c7-7c-checkpoint-account-ops-readiness.md',
  'tests/supabase-c7-7c-checkpoint-account-ops-readiness-smoke.js',
])

const preExistingUnrelatedPaths = new Set([
  '.gitignore',
  '.env.local',
  'Roadmap.txt',
  'RoadmapRealTime.txt',
  'dist/',
  'matkhausupabase.txt',
  'node_modules/',
  'prompts/',
  'testgmailtk.txt',
  'vite-dev.err.log',
  'vite-dev.log',
])

for (const changedPath of changedPaths) {
  if (preExistingUnrelatedPaths.has(changedPath)) continue
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.6E scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src runtime diff allowed in C7.6E: ${changedPath}`)
  assert(!/teacher-portal|account-management|runtime-ui/i.test(changedPath), `No runtime UI/action file allowed: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(preflightSqlPath)
assertNoMojibake(postQaSqlPath)
assertNoMojibake(testPath)

console.log('C7.6E smoke: PASS')
