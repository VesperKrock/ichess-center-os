import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-6a-edge-function-admin-provisioning-implementation-design-pack.md')
const testPath = path.join(root, 'tests', 'supabase-c7-6a-edge-function-admin-provisioning-implementation-design-pack-smoke.js')

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

assert(fs.existsSync(docPath), 'Docs C7.6A must exist')
assert(fs.existsSync(testPath), 'Smoke C7.6A must exist')

const docs = readUtf8(docPath)

;[
  'C7.6A STATUS: EDGE FUNCTION ADMIN PROVISIONING IMPLEMENTATION DESIGN PACK',
  'C7_1_STATUS: PASS',
  'C7_2_STATUS: PASS',
  'C7_3_STATUS: PASS',
  'C7_4_STATUS: PASS',
  'C7_5_STATUS: PASS',
  'FUNCTION_NAME_DESIGNED: provision_center_admin_account',
  'EDGE_FUNCTION_FILE_CREATED: NO',
  'EDGE_FUNCTION_DEPLOYED: NO',
  'REQUEST_CONTRACT_DESIGNED: YES',
  'AUTH_CALLER_VERIFICATION_DESIGNED: YES',
  'OWNER_GUARD_DESIGNED: YES',
  'CLIENT_ROLE_BODY_TRUSTED: NO',
  'TARGET_CENTER_VALIDATION_DESIGNED: YES',
  'ADMIN_EMAIL_GENERATION_DESIGNED: YES',
  'ADMIN_EMAIL_PATTERN: admin.<slug>@ichess.vn',
  'EXISTING_ADMIN_HANDLING_DESIGNED: YES',
  'DREAMHOME_DUPLICATE_ADMIN_PROTECTION_DESIGNED: YES',
  'PHONGTRONG_PROVISIONING_TARGET_DESIGNED: YES',
  'DUPLICATE_EMAIL_HANDLING_DESIGNED: YES',
  'CENTER_ADMIN_ONE_CENTER_RULE_DESIGNED: YES',
  'TEMPORARY_PASSWORD_RANDOM_REQUIRED: YES',
  'MATH_RANDOM_PASSWORD_ALLOWED: NO',
  'SUPABASE_AUTH_ADMIN_CREATE_USER_CAVEAT_NOTED: YES',
  'SERVICE_ROLE_SERVER_SIDE_ONLY_DESIGNED: YES',
  'SERVICE_ROLE_FRONTEND_EXPOSURE_ALLOWED: NO',
  'PROVISIONING_SEQUENCE_DESIGNED: YES',
  'ROLLBACK_CLEANUP_DESIGNED: YES',
  'AUDIT_LOG_DESIGNED: YES',
  'PLAINTEXT_PASSWORD_AUDIT_LOG_ALLOWED: NO',
  'SUCCESS_RESPONSE_CONTRACT_DESIGNED: YES',
  'ERROR_RESPONSE_CONTRACT_DESIGNED: YES',
  'CREDENTIAL_HANDOFF_UI_CONTRACT_DESIGNED: YES',
  'PASSWORD_DISPLAY_ONCE_DESIGNED: YES',
  'MANUAL_QA_PLAN_DESIGNED: YES',
  'C7_6B_RECOMMENDED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'EDGE_FUNCTION_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C7_6B_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C7.6A',
  '## 2. Trạng thái sau C7.5',
  '## 3. Function name',
  '## 4. Request contract',
  '## 5. Auth/caller verification',
  '## 6. Owner guard',
  '## 7. Target center validation',
  '## 8. Admin email generation',
  '## 9. Existing admin handling',
  '## 10. Duplicate email handling',
  '## 11. center_admin one-center rule',
  '## 12. Temporary password generation',
  '## 13. Supabase Auth admin creation caveat',
  '## 14. Service role / environment secrets',
  '## 15. Provisioning operation sequence',
  '## 16. Rollback/cleanup design',
  '## 17. Audit log design',
  '## 18. Success response contract',
  '## 19. Error response contract',
  '## 20. Credential handoff UI contract',
  '## 21. Manual QA plan for C7.6 future',
  '## 22. DreamHome duplicate protection test',
  '## 23. Phòng Trống provisioning target',
  '## 24. C7.6B recommendation',
  '## 25. Risk list',
  '## 26. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  '`provision_center_admin_account`',
  '`center_id`',
  '`idempotency_key`',
  'Không nhận `role` từ client',
  'Không nhận `email` từ client',
  'Không nhận `password` từ client',
  'Authorization: Bearer',
  'auth.getUser',
  'owner_required',
  'centers.status = active',
  '`admin.<slug>@ichess.vn`',
  '`admin.dreamhome@ichess.vn`',
  '`admin.phongtrong@ichess.vn`',
  '`center_admin_already_exists`',
  '`admin_email_already_used`',
  '`center_admin` chỉ được có một cơ sở active',
  'crypto.getRandomValues',
  'Không dùng `Math.random`',
  'email confirmation',
  'SUPABASE_SERVICE_ROLE_KEY',
  'Không expose service role key ra frontend',
  'Create Auth user',
  'Create `center_members` row',
  'disable/ban/delete pending Auth user',
  'cleanup_status: needs_manual_review',
  'account.provision_center_admin',
  'Plaintext temporary password',
  'temporary_password',
  'password_display_once',
  'credential_handoff_required',
  'Đã tạo tài khoản',
  'Mật khẩu chỉ hiển thị một lần',
  'phongtrong_prod',
  'DreamHome',
  'Phòng Trống',
  'Không tạo file `supabase/functions/provision_center_admin_account/*`',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'SQL_APPLIED_BY_CODEX: YES',
  'SUPABASE_ACTION_BY_CODEX: YES',
  'AUTH_USER_CREATED: YES',
  'MEMBERSHIP_CREATED: YES',
  'EDGE_FUNCTION_CREATED: YES',
  'EDGE_FUNCTION_DEPLOYED: YES',
  'RUNTIME_CHANGE: YES',
  'C7_6B_STARTED: YES',
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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.6A scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src diff allowed in C7.6A: ${changedPath}`)
  assert(
    !changedPath.startsWith('supabase/functions/') ||
      changedPath.startsWith('supabase/functions/provision-center-admin-account/'),
    `No unexpected Edge Function file allowed in C7.6A: ${changedPath}`,
  )
  assert(!/teacher-portal|account-management|runtime-ui/i.test(changedPath), `No C7 runtime UI/action file allowed: ${changedPath}`)

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
      `No SQL apply file allowed in C7.6A: ${changedPath}`,
    )
  }
}

assert(fs.existsSync(path.join(root, 'supabase', 'functions', 'provision-center-admin-account')), 'C7.6D function folder is expected after C7.6D')

assertNoMojibake(docPath)
assertNoMojibake(testPath)

console.log('C7.6A smoke: PASS')
