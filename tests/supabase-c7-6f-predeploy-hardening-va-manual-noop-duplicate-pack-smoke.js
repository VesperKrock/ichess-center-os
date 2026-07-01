import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-6f-predeploy-hardening-va-manual-noop-duplicate-pack.md')
const functionPath = path.join(root, 'supabase', 'functions', 'provision-center-admin-account', 'index.ts')
const testPath = path.join(root, 'tests', 'supabase-c7-6f-predeploy-hardening-va-manual-noop-duplicate-pack-smoke.js')

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

function getStatusPaths() {
  const status = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })
  return status
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/\\/g, '/'))
}

assert(fs.existsSync(docPath), 'Docs C7.6F must exist')
assert(fs.existsSync(functionPath), 'Edge Function source must exist')
assert(fs.existsSync(testPath), 'Smoke C7.6F must exist')

const docs = readUtf8(docPath)
const fn = readUtf8(functionPath)

;[
  'C7.6F STATUS: PREDEPLOY HARDENING AND MANUAL NOOP DUPLICATE PACK',
  'C7_6E_STATUS: PASS',
  'C7_6E_PREFLIGHT_BY_USER: PASS',
  'DREAMHOME_ADMIN_EXISTS_PREFLIGHT: YES',
  'PHONGTRONG_ADMIN_ABSENT_PREFLIGHT: YES',
  'ADMIN_PHONGTRONG_EMAIL_UNUSED_PREFLIGHT: YES',
  'AUDIT_TABLE_RLS_TRUE_PREFLIGHT: YES',
  'SOURCE_HARDENING_CHECKLIST_COMPLETED: YES',
  'DENO_CHECK_ATTEMPTED: YES',
  'DENO_CHECK_RESULT: NOT RUN - DENO NOT INSTALLED',
  'MATH_RANDOM_PASSWORD_ALLOWED: NO',
  'CRYPTO_RANDOM_PASSWORD_REQUIRED: YES',
  'SERVICE_ROLE_FRONTEND_EXPOSURE_ALLOWED: NO',
  'VERIFY_JWT_REQUIRED: YES',
  'VERIFY_JWT_DISABLED_ALLOWED: NO',
  'MANUAL_DEPLOY_CHECKLIST_CREATED: YES',
  'MANUAL_DREAMHOME_NOOP_INVOCATION_TEMPLATE_CREATED: YES',
  'DREAMHOME_EXPECTED_CODE: center_admin_already_exists',
  'OWNER_ACCESS_TOKEN_REQUIRED_FOR_TEST: YES',
  'SERVICE_ROLE_AS_OWNER_TEST_TOKEN_ALLOWED: NO',
  'POST_TEST_VERIFY_CHECKLIST_CREATED: YES',
  'PASSWORD_LEAK_EXPECTED_ROWS: 0',
  'C7_6G_RECOMMENDED: YES',
  'EDGE_FUNCTION_DEPLOYED: NO',
  'SECRETS_SET_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED_IN_SUPABASE: NO',
  'ADMIN_PHONGTRONG_CREATED: NO',
  'RUNTIME_UI_CHANGE: NO',
  'C7_6G_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'DreamHome có `admin.dreamhome@ichess.vn`',
  'Phòng Trống chưa có center_admin',
  '`admin.phongtrong@ichess.vn` does not exist',
  '`account_audit_logs` rowsecurity = true',
  'Không hardcode service role key.',
  'Không dùng `Math.random`.',
  'Có `crypto.getRandomValues`.',
  'Có Authorization Bearer handling.',
  'Có `auth.getUser(token)`.',
  'Owner guard: `role = owner`, `status = active`, target center.',
  'supabase functions deploy provision-center-admin-account',
  'Không chạy command này trong C7.6F.',
  'Không dùng `--no-verify-jwt`',
  'SERVICE_ROLE_AS_OWNER_TEST_TOKEN_ALLOWED: NO',
  'Authorization phải dùng access token của owner',
  'Không paste owner JWT vào chat.',
  'center_admin_already_exists',
  'temporary_password',
  'C7.6G - Manual deploy + DreamHome no-op duplicate test',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'Deno.serve',
  'crypto.getRandomValues',
  'auth.getUser',
  'center_admin_already_exists',
  'account_audit_logs',
  'auth.admin.createUser',
  'auth.admin.deleteUser',
  'Could not write required audit log.',
].forEach((needle) => assertIncludes(fn, needle))

assert(!/Math\.random/.test(fn), 'Function must not use Math.random')
assert(!/console\.log/.test(fn), 'Function must not console.log')
assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/.test(fn), 'Function must not hardcode service role key')
assert(!/service[_ -]?role[\s\S]{0,80}console\.(log|error)/i.test(fn), 'Function must not log service role')
assert(!/jwt[\s\S]{0,80}console\.(log|error)/i.test(fn), 'Function must not log JWT')
assert(!/temporaryPassword[\s\S]{0,80}console\.(log|error)/.test(fn), 'Function must not log temporary password')
assert(!/CÆ¡|YĂªu|KhĂ´ng|Ä‘/.test(fn), 'Function source should not keep mojibake messages')

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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.6F scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src runtime diff allowed in C7.6F: ${changedPath}`)
  assert(!/teacher-portal|account-management|runtime-ui/i.test(changedPath), `No runtime UI/action file allowed: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(functionPath)
assertNoMojibake(testPath)

console.log('C7.6F smoke: PASS')
