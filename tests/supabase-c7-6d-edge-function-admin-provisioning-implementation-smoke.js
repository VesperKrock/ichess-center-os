import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-6d-edge-function-admin-provisioning-implementation.md')
const functionPath = path.join(root, 'supabase', 'functions', 'provision-center-admin-account', 'index.ts')
const denoPath = path.join(root, 'supabase', 'functions', 'provision-center-admin-account', 'deno.json')
const testPath = path.join(root, 'tests', 'supabase-c7-6d-edge-function-admin-provisioning-implementation-smoke.js')

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
  const status = execFileSync('git', ['status', '--short'], {
    cwd: root,
    encoding: 'utf8',
  })

  return status
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/\\/g, '/'))
}

assert(fs.existsSync(docPath), 'Docs C7.6D must exist')
assert(fs.existsSync(functionPath), 'Edge Function index.ts must exist')
assert(fs.existsSync(denoPath), 'Edge Function deno.json must exist')
assert(fs.existsSync(testPath), 'Smoke C7.6D must exist')

const docs = readUtf8(docPath)
const fn = readUtf8(functionPath)
const deno = readUtf8(denoPath)

;[
  'C7.6D STATUS: EDGE FUNCTION ADMIN PROVISIONING IMPLEMENTATION PACK',
  'C7_1_STATUS: PASS',
  'C7_2_STATUS: PASS',
  'C7_3_STATUS: PASS',
  'C7_4_STATUS: PASS',
  'C7_5_STATUS: PASS',
  'C7_6A_STATUS: PASS',
  'C7_6B_STATUS: PASS',
  'C7_6C_STATUS: PASS',
  'C7_6C_1_STATUS: PASS',
  'AUDIT_TABLE_APPLIED_AND_VERIFIED: YES',
  'EDGE_FUNCTION_FILE_CREATED: YES',
  'EDGE_FUNCTION_NAME: provision-center-admin-account',
  'FUNCTION_BUSINESS_NAME: provision_center_admin_account',
  'VERIFY_JWT_REQUIRED: YES',
  'VERIFY_JWT_DISABLED: NO',
  'SERVICE_ROLE_SERVER_SIDE_ONLY: YES',
  'SERVICE_ROLE_FRONTEND_EXPOSURE_ALLOWED: NO',
  'REQUEST_CONTRACT_IMPLEMENTED: YES',
  'FORBIDDEN_CLIENT_FIELDS_REJECTED: YES',
  'AUTH_CALLER_VERIFICATION_IMPLEMENTED: YES',
  'OWNER_GUARD_IMPLEMENTED: YES',
  'TARGET_CENTER_VALIDATION_IMPLEMENTED: YES',
  'ADMIN_EMAIL_GENERATION_IMPLEMENTED: YES',
  'ADMIN_EMAIL_PATTERN: admin.<slug>@ichess.vn',
  'EXISTING_ADMIN_DUPLICATE_PROTECTION_IMPLEMENTED: YES',
  'DREAMHOME_DUPLICATE_PROTECTION_IMPLEMENTED: YES',
  'PHONGTRONG_TARGET_SUPPORTED: YES',
  'IDEMPOTENCY_CHECK_IMPLEMENTED: YES',
  'TEMPORARY_PASSWORD_CRYPTO_RANDOM: YES',
  'MATH_RANDOM_PASSWORD_ALLOWED: NO',
  'AUTH_ADMIN_CREATE_USER_IMPLEMENTED: YES',
  'MEMBERSHIP_INSERT_IMPLEMENTED: YES',
  'AUDIT_LOG_INSERT_IMPLEMENTED: YES',
  'PLAINTEXT_PASSWORD_AUDIT_LOG_ALLOWED: NO',
  'ROLLBACK_CLEANUP_IMPLEMENTED: YES',
  'ERROR_RESPONSES_RETURN_PASSWORD: NO',
  'SUCCESS_RETURNS_PASSWORD_ONCE: YES',
  'EDGE_FUNCTION_DEPLOYED: NO',
  'SECRETS_SET_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED_IN_SUPABASE: NO',
  'ADMIN_PHONGTRONG_CREATED: NO',
  'RUNTIME_UI_CHANGE: NO',
  'C7_6E_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C7.6D',
  '## 2. Trạng thái audit sau C7.6C.1',
  '## 3. Function files created',
  '## 4. Request contract',
  '## 5. Response contract',
  '## 6. Auth/JWT caller verification',
  '## 7. Owner guard',
  '## 8. Target center validation',
  '## 9. Admin email generation',
  '## 10. Existing admin duplicate protection',
  '## 11. Idempotency behavior',
  '## 12. Temporary password generation',
  '## 13. Auth user creation',
  '## 14. Membership insert',
  '## 15. Audit log insert',
  '## 16. Rollback cleanup',
  '## 17. Logging/secrets safety',
  '## 18. What C7.6D does not do',
  '## 19. C7.6E deploy/secrets/no-op QA recommendation',
  '## 20. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

assertIncludes(deno, '"@supabase/supabase-js": "npm:@supabase/supabase-js@2"')

;[
  'Deno.serve',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'Authorization',
  'Bearer',
  'auth.getUser',
  "from('center_members')",
  ".eq('role', 'owner')",
  ".eq('status', 'active')",
  "from('centers')",
  "center.environment !== 'production'",
  "center.status !== 'active'",
  'makeAdminEmail',
  '`admin.${slug}@${ADMIN_EMAIL_DOMAIN}`',
  'FORBIDDEN_CLIENT_FIELDS',
  "'temporary_password'",
  "from('account_audit_logs')",
  'duplicate_request_already_processed',
  'crypto.getRandomValues',
  'auth.admin.createUser',
  "role: 'center_admin'",
  "status: 'active'",
  'account_audit_logs',
  'credential_handoff_required',
  'auth.admin.deleteUser',
  'safeDeleteMembership',
  'temporary_password: temporaryPassword',
].forEach((needle) => assertIncludes(fn, needle))

assert(!/Math\.random/.test(fn), 'Function must not use Math.random')
assert(!/console\.log/.test(fn), 'Function must not console.log secrets or passwords')
assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/.test(fn), 'Function must not hardcode service role key')
assert(!/temporary_password['"]?\s*:\s*['"][^'"]+['"]/.test(fn), 'Function must not hardcode real temporary password')
assert(!/admin\.phongtrong@ichess\.vn/.test(fn), 'Function must not create admin.phongtrong at build/test time')
assert(!/metadata:\s*{[\s\S]{0,300}temporary_password/.test(fn), 'Audit metadata must not include temporary_password')
assert(!/before_state:\s*{[\s\S]{0,220}temporary_password/.test(fn), 'Audit before_state must not include temporary_password')
assert(!/after_state:\s*{[\s\S]{0,220}temporary_password/.test(fn), 'Audit after_state must not include temporary_password')

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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.6D scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src diff allowed in C7.6D: ${changedPath}`)
  assert(!/teacher-portal|account-management|runtime-ui/i.test(changedPath), `No C7 runtime UI/action file allowed: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(functionPath)
assertNoMojibake(denoPath)
assertNoMojibake(testPath)

console.log('C7.6D smoke: PASS')
