import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-3-account-provisioning-ux-security-design.md')
const testPath = path.join(root, 'tests', 'supabase-c7-3-account-provisioning-ux-security-design-smoke.js')

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

assert(fs.existsSync(docPath), 'Docs C7.3 must exist')
assert(fs.existsSync(testPath), 'Smoke C7.3 must exist')

const docs = readUtf8(docPath)

;[
  'C7.3 STATUS: ACCOUNT PROVISIONING UX SECURITY DESIGN',
  'C7_1_STATUS: PASS',
  'C7_2_STATUS: PASS',
  'C7_2_MANUAL_SQL_INSPECTION: PASS',
  'PRODUCTION_CENTERS_INSPECTED: YES',
  'PRODUCTION_OWNER_MEMBERSHIP_VALIDATED: YES',
  'CENTER_ADMIN_ONE_CENTER_VIOLATION_RESULT: 0',
  'TEACHER_MEMBERSHIP_CURRENTLY_EMPTY: YES',
  'TEACHER_GLOBAL_TABLE_CURRENTLY_MISSING: YES',
  'STAGING_LEGACY_ADMIN_ROLE_NOTED: YES',
  'CENTER_CLOUD_TEACHER_DATA_STAGING_NOTED: YES',
  'ADMIN_ACCOUNT_EMAIL_PATTERN_DESIGNED: admin.<slug>@ichess.vn',
  'TEMPORARY_PASSWORD_RANDOM_REQUIRED: YES',
  'FIXED_DEFAULT_PASSWORD_RECOMMENDED: NO',
  'CREDENTIAL_HANDOFF_PANEL_REQUIRED: YES',
  'CREDENTIAL_HANDOFF_PANEL_SHOWS_EMAIL: YES',
  'CREDENTIAL_HANDOFF_PANEL_SHOWS_TEMP_PASSWORD: YES',
  'CREDENTIAL_COPY_ACTIONS_DESIGNED: YES',
  'PASSWORD_DISPLAY_ONCE_DESIGNED: YES',
  'PLAINTEXT_PASSWORD_STORAGE_ALLOWED: NO',
  'FRONTEND_DIRECT_AUTH_USER_CREATION_ALLOWED: NO',
  'SERVER_SIDE_PRIVILEGED_FLOW_REQUIRED: YES',
  'ADMIN_ACCOUNT_PROVISIONING_FLOW_DESIGNED: YES',
  'TEACHER_ACCOUNT_PROVISIONING_FLOW_DESIGNED: YES',
  'TEACHER_MULTI_CENTER_ASSIGNMENT_DESIGNED: YES',
  'CENTER_ADMIN_CAN_CREATE_GLOBAL_TEACHERS: NO',
  'MODULE_6_RUNTIME_CHANGED: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'EDGE_FUNCTION_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C7_4_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C7.3',
  '## 2. C7.2 manual SQL inspection summary',
  '## 3. Account provisioning principle',
  '## 4. Why frontend must not create Auth users directly',
  '## 5. Server-side privileged flow concept',
  '## 6. Admin account convention',
  '## 7. admin.<slug>@ichess.vn convention',
  '## 8. center_admin one-center rule',
  '## 9. Teacher account/profile convention',
  '## 10. Teacher multi-center assignment',
  '## 11. Temporary password principle',
  '## 12. Credential handoff panel requirement',
  '## 13. Notification wording',
  '## 14. Copy credential actions',
  '## 15. Password storage/logging safety',
  '## 16. Reset/change password future',
  '## 17. Admin account provisioning flow',
  '## 18. Teacher account provisioning flow',
  '## 19. Failure/rollback handling',
  '## 20. Module 6 teacher button impact',
  '## 21. Role and permission guard',
  '## 22. Risk list',
  '## 23. C7.4 implementation recommendation',
  '## 24. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  'dreamhome_prod,DreamHome,dreamhome,production,active',
  'phongtrong_prod,Phòng Trống,phongtrong,production,active',
  'owner.duchai@ichess.vn',
  'admin.dreamhome@ichess.vn',
  'Success. No rows returned',
  'teacher membership query',
  'teacher,dreamhome,6',
  '`admin.<slug>@ichess.vn`',
  'mật khẩu tạm thời random',
  'Không dùng mật khẩu mặc định cố định',
  'Credential handoff panel là requirement bắt buộc',
  'Copy email',
  'Copy mật khẩu',
  'Copy toàn bộ thông tin',
  'chỉ hiển thị một lần',
  'không lưu plaintext password',
  'Auth account không được tạo trực tiếp từ frontend public client',
  'server-side privileged endpoint',
  'Create Auth user server-side',
  'Create teacher profile',
  'Assign teacher to selected centers',
  'center_admin không được tạo global teachers',
  'Module 6 runtime không sửa ở C7.3',
  'C7.4 nên là design/apply readiness',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'SQL_APPLIED_BY_CODEX: YES',
  'AUTH_USER_CREATED: YES',
  'MEMBERSHIP_CREATED: YES',
  'EDGE_FUNCTION_CREATED: YES',
  'RUNTIME_CHANGE: YES',
  'C7_4_STARTED: YES',
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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.3 scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src diff allowed in C7.3: ${changedPath}`)
  assert(
    !changedPath.startsWith('supabase/functions/') ||
      changedPath.startsWith('supabase/functions/provision-center-admin-account/'),
    `No unexpected Edge Function file allowed in C7.3: ${changedPath}`,
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
      `No SQL apply file allowed in C7.3: ${changedPath}`,
    )
  }
}

assertNoMojibake(docPath)
assertNoMojibake(testPath)

console.log('C7.3 smoke: PASS')
