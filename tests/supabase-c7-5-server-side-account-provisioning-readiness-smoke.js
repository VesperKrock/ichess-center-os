import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-5-server-side-account-provisioning-readiness.md')
const testPath = path.join(root, 'tests', 'supabase-c7-5-server-side-account-provisioning-readiness-smoke.js')

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

assert(fs.existsSync(docPath), 'Docs C7.5 must exist')
assert(fs.existsSync(testPath), 'Smoke C7.5 must exist')

const docs = readUtf8(docPath)

;[
  'C7.5 STATUS: SERVER SIDE ACCOUNT PROVISIONING READINESS',
  'C7_1_STATUS: PASS',
  'C7_2_STATUS: PASS',
  'C7_3_STATUS: PASS',
  'C7_4_STATUS: PASS',
  'SERVER_SIDE_PROVISIONING_ARCHITECTURE_DESIGNED: YES',
  'FRONTEND_DIRECT_AUTH_USER_CREATION_ALLOWED: NO',
  'SERVICE_ROLE_FRONTEND_EXPOSURE_ALLOWED: NO',
  'SERVICE_ROLE_SERVER_SIDE_ONLY_DESIGNED: YES',
  'OWNER_GUARD_DESIGNED: YES',
  'CLIENT_ROLE_BODY_TRUSTED: NO',
  'ADMIN_ACCOUNT_PROVISIONING_CONTRACT_DESIGNED: YES',
  'ADMIN_EMAIL_PATTERN: admin.<slug>@ichess.vn',
  'PHONGTRONG_ADMIN_READY_FOR_FUTURE_PROVISIONING: YES',
  'DREAMHOME_DUPLICATE_ADMIN_PROTECTION_DESIGNED: YES',
  'TEMPORARY_PASSWORD_RANDOM_REQUIRED: YES',
  'MATH_RANDOM_PASSWORD_ALLOWED: NO',
  'CREDENTIAL_HANDOFF_RESPONSE_DESIGNED: YES',
  'PASSWORD_DISPLAY_ONCE_DESIGNED: YES',
  'PLAINTEXT_PASSWORD_LOGGING_ALLOWED: NO',
  'EMAIL_CONFIRMATION_LOGIN_CAVEAT_NOTED: YES',
  'DUPLICATE_EMAIL_HANDLING_DESIGNED: YES',
  'IDEMPOTENCY_HANDLING_DESIGNED: YES',
  'ROLLBACK_CLEANUP_STRATEGY_DESIGNED: YES',
  'AUDIT_LOG_CONTRACT_DESIGNED: YES',
  'RESET_PASSWORD_READINESS_DESIGNED: YES',
  'REVOKE_BAN_READINESS_DESIGNED: YES',
  'CENTER_LIFECYCLE_READINESS_DESIGNED: YES',
  'UI_SEPARATE_PANEL_WINDOW_REQUIRED: YES',
  'DASHBOARD_INLINE_DANGEROUS_FORMS_ALLOWED: NO',
  'C7_6_SPLIT_RECOMMENDED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'EDGE_FUNCTION_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C7_6_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C7.5',
  '## 2. Trạng thái sau C7.4',
  '## 3. Architecture principle',
  '## 4. Future endpoint/function list',
  '## 5. Owner guard',
  '## 6. Service role safety',
  '## 7. Admin account provisioning contract',
  '## 8. Existing admin handling',
  '## 9. Phòng Trống readiness',
  '## 10. DreamHome duplicate protection',
  '## 11. Admin account success response',
  '## 12. Credential handoff panel response',
  '## 13. Temporary password generation',
  '## 14. Email confirmation/login caveat',
  '## 15. Duplicate email handling',
  '## 16. Idempotency/double-click handling',
  '## 17. Rollback/cleanup strategy',
  '## 18. Audit log contract',
  '## 19. Reset password readiness',
  '## 20. Revoke/ban readiness',
  '## 21. Center lifecycle readiness',
  '## 22. UI readiness: panel/window not inline',
  '## 23. C7.6 proposed target/split',
  '## 24. Risk list',
  '## 25. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  'Frontend/browser không được tạo Auth user trực tiếp',
  'Service role chỉ được dùng ở server-side/Edge Function/secrets',
  'không expose service role key ra frontend',
  'Endpoint không được tin request body',
  'CLIENT_ROLE_BODY_TRUSTED: NO',
  '`provision_center_admin_account`',
  '`admin.<slug>@ichess.vn`',
  'PHONGTRONG_ADMIN_READY_FOR_FUTURE_PROVISIONING: YES',
  'DREAMHOME_DUPLICATE_ADMIN_PROTECTION_DESIGNED: YES',
  'Không dùng `Math.random` cho password',
  'not logged',
  'not stored plaintext',
  'returned once',
  'credential_handoff_required',
  'password_display_once',
  'email confirmation',
  'Duplicate email handling',
  'idempotency_key',
  'double-click',
  'cleanup/disable/delete pending user',
  'Do not log',
  'temporary_password',
  'account.reset_password',
  'revoke_center_access',
  'ban_account',
  'center.archive',
  'After success, credential handoff panel/window opens',
  'C7.6A - Edge Function/admin provisioning implementation design pack',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'SQL_APPLIED_BY_CODEX: YES',
  'AUTH_USER_CREATED: YES',
  'MEMBERSHIP_CREATED: YES',
  'EDGE_FUNCTION_CREATED: YES',
  'RUNTIME_CHANGE: YES',
  'C7_6_STARTED: YES',
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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.5 scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src diff allowed in C7.5: ${changedPath}`)
  assert(
    !changedPath.startsWith('supabase/functions/') ||
      changedPath.startsWith('supabase/functions/provision-center-admin-account/'),
    `No unexpected Edge Function file allowed in C7.5: ${changedPath}`,
  )
  assert(!/edge-functions|teacher-portal|account-management|runtime-ui/i.test(changedPath), `No C7 runtime UI/action file allowed: ${changedPath}`)

  if (/\.sql$/i.test(changedPath)) {
    assert(
      changedPath === 'docs/supabase-c7-2-readonly-inspect-auth-membership-teacher-data.sql' ||
        changedPath === 'docs/supabase-c7-6b-readonly-inspect-admin-provisioning-readiness.sql' ||
        changedPath === 'docs/supabase-c7-6c-manual-apply-account-audit-log.sql' ||
        changedPath === 'docs/supabase-c7-6c-post-apply-verify-account-audit-log.sql' ||
        changedPath === 'docs/supabase-c7-6e-readonly-preflight-admin-provisioning-qa.sql' ||
        changedPath === 'docs/supabase-c7-6e-readonly-post-qa-admin-provisioning-verify.sql' ||
        changedPath === 'docs/supabase-c7-6g-3-manual-apply-service-role-grants.sql' ||
        changedPath === 'docs/supabase-c7-6g-3-post-apply-verify-service-role-grants.sql' ||
        changedPath === 'docs/supabase-c7-6h-readonly-preinvoke-phongtrong-admin.sql' ||
        changedPath === 'docs/supabase-c7-6h-readonly-post-provision-verify-phongtrong-admin.sql' ||
        changedPath === 'docs/supabase-c7-6i-readonly-post-reset-verify-phongtrong-admin.sql' ||
        changedPath === 'docs/supabase-c7-7b-readonly-post-revoke-verify-phongtrong-admin.sql',
      `No SQL apply file allowed in C7.5: ${changedPath}`,
    )
  }
}

assertNoMojibake(docPath)
assertNoMojibake(testPath)

console.log('C7.5 smoke: PASS')
