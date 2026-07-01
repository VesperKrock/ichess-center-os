import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-6h-controlled-phongtrong-admin-provisioning.md')
const preSqlPath = path.join(root, 'docs', 'supabase-c7-6h-readonly-preinvoke-phongtrong-admin.sql')
const postSqlPath = path.join(root, 'docs', 'supabase-c7-6h-readonly-post-provision-verify-phongtrong-admin.sql')
const invokePath = path.join(root, 'docs', 'supabase-c7-6h-browser-console-invoke-phongtrong-admin.js')
const functionPath = path.join(root, 'supabase', 'functions', 'provision-center-admin-account', 'index.ts')
const testPath = path.join(root, 'tests', 'supabase-c7-6h-controlled-phongtrong-admin-provisioning-smoke.js')

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`)
}

function assertNotIncludes(content, needle, label = needle) {
  assert(!content.includes(needle), `Unexpected ${label}`)
}

function getStatusPaths() {
  const status = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })
  return status
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/\\/g, '/'))
}

function assertReadOnlySql(sql, label) {
  assert(!/^\s*(insert|update|delete|drop|truncate|alter|create|grant|revoke)\b/im.test(sql), `${label} must be read-only`)
}

function assertNoMojibake(filePath) {
  const content = readUtf8(filePath)
  const forbidden = [
    [0x0043, 0x0102].map((code) => String.fromCharCode(code)).join(''),
    [0x004b, 0x0068, 0x0102].map((code) => String.fromCharCode(code)).join(''),
    [0x0050, 0x0068, 0x0102].map((code) => String.fromCharCode(code)).join(''),
    [0x00c3, 0x00a1, 0x00bb].map((code) => String.fromCharCode(code)).join(''),
    '\uFFFD',
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

assert(fs.existsSync(docPath), 'Docs C7.6H must exist')
assert(fs.existsSync(preSqlPath), 'Preinvoke SQL C7.6H must exist')
assert(fs.existsSync(postSqlPath), 'Post-provision verify SQL C7.6H must exist')
assert(fs.existsSync(invokePath), 'Browser Console invoke script C7.6H must exist')
assert(fs.existsSync(functionPath), 'Edge Function source must exist')
assert(fs.existsSync(testPath), 'Smoke C7.6H must exist')

const docs = readUtf8(docPath)
const preSql = readUtf8(preSqlPath)
const postSql = readUtf8(postSqlPath)
const invoke = readUtf8(invokePath)

;[
  'C7.6H STATUS: CONTROLLED PHONGTRONG ADMIN PROVISIONING PACK',
  'C7_6G_DREAMHOME_NOOP_PASS: YES',
  'C7_6G_POST_TEST_VERIFY_PASS: YES',
  'PHONGTRONG_TARGET_CENTER_ID: phongtrong_prod',
  'PHONGTRONG_EXPECTED_EMAIL: admin.phongtrong@ichess.vn',
  'PHONGTRONG_PREINVOKE_SQL_CREATED: YES',
  'PHONGTRONG_BROWSER_CONSOLE_INVOKE_SCRIPT_CREATED: YES',
  'PHONGTRONG_POST_PROVISION_VERIFY_SQL_CREATED: YES',
  'CREDENTIAL_HANDOFF_CHECKLIST_CREATED: YES',
  'TEMPORARY_PASSWORD_DISPLAY_ONCE_REQUIRED: YES',
  'TEMPORARY_PASSWORD_CHAT_ALLOWED: NO',
  'TEMPORARY_PASSWORD_REPO_ALLOWED: NO',
  'PASSWORD_LEAK_VERIFY_QUERY_CREATED: YES',
  'MANUAL_LOGIN_SMOKE_CREATED: YES',
  'ROLLBACK_MANUAL_CLEANUP_PLAN_CREATED: YES',
  'EDGE_FUNCTION_INVOKED_BY_CODEX: NO',
  'AUTH_USER_CREATED_BY_CODEX: NO',
  'MEMBERSHIP_CREATED_BY_CODEX: NO',
  'SQL_MUTATION_BY_CODEX: NO',
  'RUNTIME_UI_CHANGE: NO',
  'C7_6I_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'admin.phongtrong@ichess.vn',
  'temporary_password',
  'Manual login smoke',
  'Rollback/manual cleanup plan',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'select',
  'dreamhome_prod',
  'phongtrong_prod',
  'admin.dreamhome@ichess.vn',
  'admin.phongtrong@ichess.vn',
  'account.provision_center_admin',
].forEach((needle) => assertIncludes(preSql, needle))

;[
  'select',
  'active_center_admin_count',
  'admin.phongtrong@ichess.vn',
  'account.provision_center_admin',
  "metadata ? 'temporary_password'",
  "metadata ? 'password'",
  "before_state ? 'plaintext_password'",
  "after_state ? 'plaintext_password'",
].forEach((needle) => assertIncludes(postSql, needle))

;[
  'phongtrong_prod',
  'admin.phongtrong@ichess.vn',
  'provision-center-admin-account',
  'idempotency_key',
  'Admin Phong Trong',
  'center_admin_created',
  'TEMPORARY_PASSWORD_DISPLAY_ONCE',
  'Do not paste it into chat',
  'localStorage.getItem',
  'findAccessToken',
].forEach((needle) => assertIncludes(invoke, needle))

assertReadOnlySql(preSql, 'Preinvoke SQL')
assertReadOnlySql(postSql, 'Post-provision verify SQL')
assertNotIncludes(invoke, 'eyJ', 'hardcoded JWT')
assertNotIncludes(invoke, 'service_role', 'service role key in invoke script')
assertNotIncludes(invoke, 'temporary_password: ', 'hardcoded temporary password')
assert(/if \(json\.ok === true && json\.code === "center_admin_created"\)[\s\S]*json\.temporary_password/.test(invoke), 'Script must print temporary password only on success branch')

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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.6H scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src runtime diff allowed in C7.6H: ${changedPath}`)
  assert(!/teacher-portal|account-management|runtime-ui/i.test(changedPath), `No runtime UI/action file allowed: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(preSqlPath)
assertNoMojibake(postSqlPath)
assertNoMojibake(invokePath)
assertNoMojibake(testPath)

console.log('C7.6H smoke: PASS')
