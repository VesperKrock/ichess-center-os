import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-6g-2-owner-guard-diagnostics-service-role-hardening.md')
const functionPath = path.join(root, 'supabase', 'functions', 'provision-center-admin-account', 'index.ts')
const testPath = path.join(root, 'tests', 'supabase-c7-6g-2-owner-guard-diagnostics-service-role-hardening-smoke.js')

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

assert(fs.existsSync(docPath), 'Docs C7.6G.2 must exist')
assert(fs.existsSync(functionPath), 'Edge Function source must exist')
assert(fs.existsSync(testPath), 'Smoke C7.6G.2 must exist')

const docs = readUtf8(docPath)
const fn = readUtf8(functionPath)

;[
  'C7.6G.2 STATUS: OWNER GUARD DIAGNOSTICS SERVICE ROLE HARDENING',
  'C7_6G_DEPLOY_BY_USER: PASS',
  'C7_6G_1_REDEPLOY_BY_USER: PASS',
  'C7_6G_1_DREAMHOME_NOOP_ACTUAL_CODE: owner_guard_query_failed',
  'OWNER_MEMBERSHIP_SQL_VERIFIED: YES',
  'OWNER_EMAIL_VERIFIED: owner.duchai@ichess.vn',
  'OWNER_USER_ID_VERIFIED: 9683b2c8-3970-4eac-99b3-985d503bdeb9',
  'OWNER_DREAMHOME_ACTIVE_VERIFIED: YES',
  'CENTER_MEMBERS_POLICY_CONTEXT_CAPTURED: YES',
  'SERVICE_ROLE_DB_CLIENT_HARDENED: YES',
  'USER_AUTHORIZATION_HEADER_GLOBAL_OVERRIDE_ALLOWED: NO',
  'USER_TOKEN_USED_ONLY_FOR_AUTH_GET_USER: YES',
  'OWNER_GUARD_SAFE_DIAGNOSTICS_IMPLEMENTED: YES',
  'OWNER_GUARD_QUERY_ERROR_DEBUG_FIELDS: code_message_details_hint',
  'PASSWORD_LEAK_ALLOWED: NO',
  'TEMPORARY_PASSWORD_ERROR_RESPONSE_ALLOWED: NO',
  'MATH_RANDOM_PASSWORD_ALLOWED: NO',
  'SERVICE_ROLE_FRONTEND_EXPOSURE_ALLOWED: NO',
  'DREAMHOME_DUPLICATE_EXPECTED_CODE_AFTER_REDEPLOY: center_admin_already_exists',
  'EDGE_FUNCTION_REDEPLOYED_BY_CODEX: NO',
  'SECRETS_SET_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED_IN_SUPABASE: NO',
  'ADMIN_PHONGTRONG_CREATED: NO',
  'RUNTIME_UI_CHANGE: NO',
  'C7_6H_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'npx supabase functions deploy provision-center-admin-account',
  'center_admin_already_exists',
  'owner_guard_query_failed',
  'forbidden_owner_required',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'createClient(supabaseUrl, serviceRoleKey',
  'global:',
  'headers:',
  'apikey: serviceRoleKey',
  'Authorization: `Bearer ${serviceRoleKey}`',
  'auth.getUser(token)',
  'getSafeSupabaseErrorDebug',
  'owner_guard_query_failed',
  'error_code',
  'error_message',
  'error_details',
  'error_hint',
  '{ debug }',
  'forbidden_owner_required',
  'center_members',
  ".select('user_id, center_id, role, status')",
  ".eq('center_id', centerId)",
  ".eq('user_id', actorUser.id)",
  ".eq('role', 'owner')",
  ".eq('status', 'active')",
  '.maybeSingle()',
  'center_admin_already_exists',
  'auth.admin.createUser',
  'account_audit_logs',
  'crypto.getRandomValues',
].forEach((needle) => assertIncludes(fn, needle))

assertNotIncludes(fn, 'global: { headers: { Authorization: token', 'user token global Authorization')
assertNotIncludes(fn, 'Authorization: `Bearer ${token}`', 'user token global Authorization')
assertNotIncludes(fn, 'Authorization: token', 'raw token global Authorization')
assert(!/Math\.random/.test(fn), 'Function must not use Math.random')
assert(!/console\.log/.test(fn), 'Function must not console.log')
assert(!/temporaryPassword[\s\S]{0,100}console\.(log|error)/.test(fn), 'Function must not log temporary password')
assert(!/password[\s\S]{0,100}console\.(log|error)/i.test(fn), 'Function must not log password')
assert(!/jwt[\s\S]{0,100}console\.(log|error)/i.test(fn), 'Function must not log JWT')
assert(!/token[\s\S]{0,100}console\.(log|error)/i.test(fn), 'Function must not log tokens')
assert(!/service[_ -]?role[\s\S]{0,100}console\.(log|error)/i.test(fn), 'Function must not log service role')
assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/.test(fn), 'Function must not hardcode service role key')
assert(!/temporary_password[\s\S]{0,160}safeError/i.test(fn), 'Function must not return temporary password in errors')

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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.6G.2 scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src runtime diff allowed in C7.6G.2: ${changedPath}`)
  assert(!/teacher-portal|account-management|runtime-ui/i.test(changedPath), `No runtime UI/action file allowed: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(functionPath)
assertNoMojibake(testPath)

console.log('C7.6G.2 smoke: PASS')
