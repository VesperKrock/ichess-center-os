import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-6i-reset-mat-khau-tam-admin-va-handoff-tien-loi.md')
const functionPath = path.join(root, 'supabase', 'functions', 'reset-center-admin-password', 'index.ts')
const denoPath = path.join(root, 'supabase', 'functions', 'reset-center-admin-password', 'deno.json')
const configPath = path.join(root, 'supabase', 'config.toml')
const resetScriptPath = path.join(root, 'docs', 'supabase-c7-6i-browser-console-reset-phongtrong-admin-password.js')
const verifySqlPath = path.join(root, 'docs', 'supabase-c7-6i-readonly-post-reset-verify-phongtrong-admin.sql')
const testPath = path.join(root, 'tests', 'supabase-c7-6i-reset-mat-khau-tam-admin-va-handoff-tien-loi-smoke.js')

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

assert(fs.existsSync(docPath), 'Docs C7.6I must exist')
assert(fs.existsSync(functionPath), 'Reset Edge Function source must exist')
assert(fs.existsSync(denoPath), 'Reset Edge Function deno.json must exist')
assert(fs.existsSync(resetScriptPath), 'Browser Console reset script must exist')
assert(fs.existsSync(verifySqlPath), 'Post-reset verify SQL must exist')
assert(fs.existsSync(testPath), 'Smoke C7.6I must exist')

const docs = readUtf8(docPath)
const fn = readUtf8(functionPath)
const deno = readUtf8(denoPath)
const config = readUtf8(configPath)
const script = readUtf8(resetScriptPath)
const verifySql = readUtf8(verifySqlPath)

;[
  'C7.6I STATUS: RESET TEMP ADMIN PASSWORD AND HANDOFF UX PACK',
  'C7_6H_PROVISION_PASS: YES',
  'C7_6H_LOGIN_SMOKE_PASS: YES',
  'PHONGTRONG_ADMIN_EMAIL: admin.phongtrong@ichess.vn',
  'PHONGTRONG_ADMIN_USER_ID: e4582453-8373-4c31-947c-d49eb879b027',
  'TEMPORARY_PASSWORD_EXPOSED_IN_SCREENSHOT: YES',
  'RESET_EDGE_FUNCTION_CREATED: YES',
  'RESET_EDGE_FUNCTION_NAME: reset-center-admin-password',
  'RESET_BUSINESS_NAME: reset_center_admin_password',
  'RESET_AUDIT_ACTION: account.reset_center_admin_password',
  'VERIFY_JWT_REQUIRED: YES',
  'VERIFY_JWT_DISABLED_ALLOWED: NO',
  'SERVICE_ROLE_SERVER_SIDE_ONLY: YES',
  'USER_TOKEN_USED_ONLY_FOR_AUTH_GET_USER: YES',
  'OWNER_GUARD_IMPLEMENTED: YES',
  'TARGET_ADMIN_VALIDATION_IMPLEMENTED: YES',
  'TEMPORARY_PASSWORD_CRYPTO_RANDOM: YES',
  'MATH_RANDOM_PASSWORD_ALLOWED: NO',
  'AUTH_ADMIN_UPDATE_PASSWORD_IMPLEMENTED: YES',
  'RESET_AUDIT_LOG_INSERT_IMPLEMENTED: YES',
  'PLAINTEXT_PASSWORD_AUDIT_LOG_ALLOWED: NO',
  'TEMPORARY_PASSWORD_ERROR_RESPONSE_ALLOWED: NO',
  'SUCCESS_RETURNS_PASSWORD_ONCE: YES',
  'HANDOFF_UX_CONTRACT_CREATED: YES',
  'OWNER_CAN_CREATE_RESET_KEYS: YES',
  'PLAINTEXT_PASSWORD_LONG_TERM_STORAGE_ALLOWED: NO',
  'BROWSER_CONSOLE_RESET_SCRIPT_CREATED: YES',
  'POST_RESET_VERIFY_SQL_CREATED: YES',
  'EDGE_FUNCTION_DEPLOYED_BY_CODEX: NO',
  'EDGE_FUNCTION_INVOKED_BY_CODEX: NO',
  'PASSWORD_RESET_BY_CODEX: NO',
  'AUTH_USER_CREATED_BY_CODEX: NO',
  'MEMBERSHIP_CREATED_BY_CODEX: NO',
  'RUNTIME_UI_CHANGE: NO',
  'C7_6J_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'Credential handoff UX contract',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'Deno.serve',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'createClient(supabaseUrl, serviceRoleKey',
  'Authorization: `Bearer ${serviceRoleKey}`',
  'auth.getUser(token)',
  'FORBIDDEN_CLIENT_FIELDS',
  "'password'",
  "'temporary_password'",
  "'new_password'",
  'owner_guard_query_failed',
  ".eq('role', 'owner')",
  ".eq('status', 'active')",
  '.maybeSingle()',
  'center_admin_state_invalid',
  'target_center_admin_not_found',
  'auth.admin.getUserById',
  'auth.admin.updateUserById',
  'crypto.getRandomValues',
  'account_audit_logs',
  'account.reset_center_admin_password',
  'center_admin_password_reset',
  'password_reset_audit_failed_manual_reset_required',
  'temporary_password: temporaryPassword',
].forEach((needle) => assertIncludes(fn, needle))

assertIncludes(deno, 'npm:@supabase/supabase-js@2')
assertIncludes(config, '[functions.reset-center-admin-password]')
assertIncludes(config, 'verify_jwt = true')

assert(!/Math\.random/.test(fn), 'Function must not use Math.random')
assert(!/console\.log/.test(fn), 'Function must not console.log')
assert(!/temporaryPassword[\s\S]{0,100}console\.(log|error)/.test(fn), 'Function must not log temporary password')
assert(!/jwt[\s\S]{0,100}console\.(log|error)/i.test(fn), 'Function must not log JWT')
assert(!/token[\s\S]{0,100}console\.(log|error)/i.test(fn), 'Function must not log tokens')
assert(!/service[_ -]?role[\s\S]{0,100}console\.(log|error)/i.test(fn), 'Function must not log service role')
assert(!/temporary_password[\s\S]{0,180}safeError/i.test(fn), 'Function must not return temporary password in errors')
assert(!/new_password[\s\S]{0,180}safeError/i.test(fn), 'Function must not return new password in errors')
assert(!/metadata:\s*{[\s\S]{0,260}(temporary_password|plaintext_password|new_password)/i.test(fn), 'Audit metadata must not include plaintext password keys')
assert(!/before_state:\s*{[\s\S]{0,200}(temporary_password|plaintext_password|new_password)/i.test(fn), 'Audit before_state must not include plaintext password keys')
assert(!/after_state:\s*{[\s\S]{0,200}(temporary_password|plaintext_password|new_password)/i.test(fn), 'Audit after_state must not include plaintext password keys')

;[
  'reset-center-admin-password',
  'phongtrong_prod',
  'admin.phongtrong@ichess.vn',
  'rotate_exposed_temporary_password',
  'center_admin_password_reset',
  'TEMPORARY_PASSWORD_DISPLAY_ONCE',
  'Do not paste it into chat',
  'localStorage.getItem',
  'findAccessToken',
].forEach((needle) => assertIncludes(script, needle))

assertNotIncludes(script, 'eyJ', 'hardcoded JWT')
assertNotIncludes(script, 'service_role', 'service role key in reset script')
assert(/if \(json\.ok === true && json\.code === "center_admin_password_reset"\)[\s\S]*json\.temporary_password/.test(script), 'Reset script must print temporary password only on success branch')

;[
  'select',
  'admin.phongtrong@ichess.vn',
  'account.reset_center_admin_password',
  "metadata ? 'temporary_password'",
  "metadata ? 'new_password'",
  "before_state ? 'plaintext_password'",
  "after_state ? 'new_password'",
].forEach((needle) => assertIncludes(verifySql, needle))
assertReadOnlySql(verifySql, 'Post-reset verify SQL')

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
  'supabase/functions/reset-center-admin-password/index.ts',
  'supabase/functions/reset-center-admin-password/deno.json',
  'supabase/config.toml',
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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.6I scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src runtime diff allowed in C7.6I: ${changedPath}`)
  assert(!/teacher-portal|account-management|runtime-ui/i.test(changedPath), `No runtime UI/action file allowed: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(functionPath)
assertNoMojibake(denoPath)
assertNoMojibake(resetScriptPath)
assertNoMojibake(verifySqlPath)
assertNoMojibake(testPath)

console.log('C7.6I smoke: PASS')
