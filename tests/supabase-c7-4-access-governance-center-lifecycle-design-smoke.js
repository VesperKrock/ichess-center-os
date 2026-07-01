import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-4-access-governance-center-lifecycle-design.md')
const testPath = path.join(root, 'tests', 'supabase-c7-4-access-governance-center-lifecycle-design-smoke.js')

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

assert(fs.existsSync(docPath), 'Docs C7.4 must exist')
assert(fs.existsSync(testPath), 'Smoke C7.4 must exist')

const docs = readUtf8(docPath)

;[
  'C7.4 STATUS: ACCESS GOVERNANCE CENTER LIFECYCLE DESIGN',
  'C7_1_STATUS: PASS',
  'C7_2_STATUS: PASS',
  'C7_3_STATUS: PASS',
  'OWNER_AUTHORITY_DESIGNED: YES',
  'OWNER_CAN_BAN_ACCOUNTS_DESIGNED: YES',
  'OWNER_CAN_REVOKE_ACCESS_DESIGNED: YES',
  'OWNER_CAN_RESET_PASSWORD_DESIGNED: YES',
  'OWNER_CAN_MANAGE_CENTER_LIFECYCLE_DESIGNED: YES',
  'CENTER_LIFECYCLE_DESIGNED: YES',
  'CENTER_STATUS_ACTIVE_DESIGNED: YES',
  'CENTER_STATUS_PAUSED_DESIGNED: YES',
  'CENTER_STATUS_ARCHIVED_DESIGNED: YES',
  'HARD_DELETE_CENTER_DEFAULT_ALLOWED: NO',
  'PHONG_TRONG_CAN_BE_ARCHIVED_LATER: YES',
  'CENTER_INFO_EDIT_DESIGNED: YES',
  'ACCOUNT_LIFECYCLE_DESIGNED: YES',
  'MEMBERSHIP_LIFECYCLE_DESIGNED: YES',
  'BAN_VS_REVOKE_DESIGNED: YES',
  'RESET_PASSWORD_TEMP_CREDENTIAL_HANDOFF_DESIGNED: YES',
  'PASSWORD_PLAINTEXT_AUDIT_LOG_ALLOWED: NO',
  'UI_SEPARATE_PANEL_WINDOW_REQUIRED: YES',
  'DASHBOARD_INLINE_DANGEROUS_FORMS_ALLOWED: NO',
  'CONFIRMATION_UX_REQUIRED: YES',
  'AUDIT_LOG_REQUIRED_FOR_SENSITIVE_ACTIONS: YES',
  'PERMISSION_GUARD_MATRIX_DESIGNED: YES',
  'CENTER_ADMIN_CAN_BAN_ACCOUNTS: NO',
  'CENTER_ADMIN_CAN_RESET_OTHERS_PASSWORD: NO',
  'CENTER_ADMIN_CAN_ARCHIVE_CENTER: NO',
  'SUPER_ADMIN_ADVANCED_DEFERRED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'EDGE_FUNCTION_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C7_5_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C7.4',
  '## 2. Trạng thái sau C7.3',
  '## 3. Owner authority principle',
  '## 4. Center lifecycle',
  '## 5. Center info/edit rules',
  '## 6. Phòng Trống handling',
  '## 7. Account lifecycle',
  '## 8. Membership lifecycle',
  '## 9. Ban vs revoke',
  '## 10. Reset password / thay ổ khóa',
  '## 11. Credential handoff after reset',
  '## 12. UI pattern: button opens separate panel/window',
  '## 13. Internal Console action design',
  '## 14. Confirmation UX',
  '## 15. Audit log requirement',
  '## 16. Audit action examples',
  '## 17. Permission guard matrix',
  '## 18. center_admin limitations',
  '## 19. Teacher access implications',
  '## 20. Super Admin/internal operator deferred',
  '## 21. Risk list',
  '## 22. C7.5 implementation/readiness recommendation',
  '## 23. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  'iChess là của owner/anh Hải',
  'ban account toàn hệ thống',
  'thu hồi quyền truy cập khỏi cơ sở',
  'reset mật khẩu',
  'tạo/sửa/ngừng/lưu trữ cơ sở',
  '`active`: đang hoạt động',
  '`paused`: tạm ngừng',
  '`archived`: lưu trữ',
  'Hard delete center default allowed: NO',
  'Phòng Trống là production center thật',
  'Account lifecycle đề xuất',
  'Membership lifecycle đề xuất',
  '`revoke access`',
  '`ban account`',
  'mật khẩu tạm thời random mới',
  'không log mật khẩu tạm thời',
  'UI_SEPARATE_PANEL_WINDOW_REQUIRED: YES',
  'DASHBOARD_INLINE_DANGEROUS_FORMS_ALLOWED: NO',
  'Gõ ARCHIVE để xác nhận',
  'Gõ BAN để xác nhận',
  'Gõ REVOKE để xác nhận',
  'Gõ RESET để xác nhận',
  'Mọi action nhạy cảm phải ghi audit log',
  '| View Internal Console | YES | NO | NO |',
  'center_admin` không được',
  'archive center',
  'reset password người khác',
  'Super Admin/internal operator advanced deferred',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'SQL_APPLIED_BY_CODEX: YES',
  'AUTH_USER_CREATED: YES',
  'MEMBERSHIP_CREATED: YES',
  'EDGE_FUNCTION_CREATED: YES',
  'RUNTIME_CHANGE: YES',
  'C7_5_STARTED: YES',
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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.4 scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src diff allowed in C7.4: ${changedPath}`)
  assert(
    !changedPath.startsWith('supabase/functions/') ||
      changedPath.startsWith('supabase/functions/provision-center-admin-account/'),
    `No unexpected Edge Function file allowed in C7.4: ${changedPath}`,
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
      `No SQL apply file allowed in C7.4: ${changedPath}`,
    )
  }
}

assertNoMojibake(docPath)
assertNoMojibake(testPath)

console.log('C7.4 smoke: PASS')
