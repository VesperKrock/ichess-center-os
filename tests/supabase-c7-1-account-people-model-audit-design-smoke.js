import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-1-account-people-model-audit-design.md')
const testPath = path.join(root, 'tests', 'supabase-c7-1-account-people-model-audit-design-smoke.js')

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

assert(fs.existsSync(docPath), 'Docs C7.1 must exist')
assert(fs.existsSync(testPath), 'Smoke C7.1 must exist')

const docs = readUtf8(docPath)

;[
  'C7.1 STATUS: ACCOUNT PEOPLE MODEL AUDIT DESIGN',
  'C6_6_DONE: YES',
  'OWNER_CAN_CREATE_TEACHERS_DESIGNED: YES',
  'CENTER_ADMIN_CAN_CREATE_GLOBAL_TEACHERS: NO',
  'TEACHER_CAN_BELONG_TO_MULTIPLE_CENTERS: YES',
  'CENTER_ADMIN_ONE_CENTER_ONLY_DESIGNED: YES',
  'CENTER_TEACHER_ASSIGNMENT_DESIGNED: YES',
  'TEACHER_GLOBAL_PROFILE_DESIGNED: YES',
  'MODULE_6_TEACHER_BUTTON_REUSE_RECOMMENDED: YES',
  'MODULE_6_RUNTIME_CHANGED: NO',
  'CENTER_ADMIN_ACCOUNT_AUTO_EMAIL_CONCEPT_DESIGNED: YES',
  'CENTER_ADMIN_EMAIL_PATTERN: admin.<slug>@ichess.vn',
  'AUTH_USER_CREATION_SERVER_SIDE_REQUIRED: YES',
  'FRONTEND_DIRECT_AUTH_USER_CREATION_RECOMMENDED: NO',
  'ACCOUNT_MANAGEMENT_DEFERRED_TO_LATER_C7: YES',
  'TEACHER_PORTAL_DEFERRED: YES',
  'ACTING_MODE_IMPLEMENTED: NO',
  'ACTING_MODE_DEFERRED_TO_LATER_C7: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C7_2_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C7.1',
  '## 2. Trạng thái sau C6.6',
  '## 3. Role model tổng quan',
  '## 4. Owner responsibilities',
  '## 5. center_admin responsibilities and one-center rule',
  '## 6. teacher responsibilities and multi-center rule',
  '## 7. center_members hiện tại và gap',
  '## 8. teacher_profiles concept',
  '## 9. center_teacher_assignments concept',
  '## 10. Module 6 future behavior',
  '## 11. Tạo giáo viên: owner-only',
  '## 12. Admin không tạo giáo viên global',
  '## 13. Admin account provisioning concept',
  '## 14. admin.<slug>@ichess.vn convention',
  '## 15. Auth user creation safety',
  '## 16. Account lifecycle',
  '## 17. Acting mode deferred',
  '## 18. Risk list',
  '## 19. C7 phase split',
  '## 20. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  'C6.6 đã DONE',
  'owner tạo giáo viên global',
  '`center_admin` không được tạo giáo viên global',
  'một teacher có thể thuộc nhiều cơ sở',
  'một `center_admin` chỉ được có 1 active center membership role `center_admin`',
  'teacher_profiles',
  'center_teacher_assignments',
  'Module 6 hiện có local teacher CRUD/prototype',
  'C7.1 không xóa và không sửa runtime Module 6',
  '`admin.<slug>@ichess.vn`',
  'Tạo Auth user là thao tác privileged',
  'Không làm bằng frontend direct insert',
  'Teacher Portal foundation',
  'Acting mode chưa implement',
  'không SQL/Supabase action/Auth user/membership/runtime',
  'Không sang C7.2 trong C7.1',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'SQL_APPLIED_BY_CODEX: YES',
  'AUTH_USER_CREATED: YES',
  'MEMBERSHIP_CREATED: YES',
  'RUNTIME_CHANGE: YES',
  'C7_2_STARTED: YES',
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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.1 scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src diff allowed in C7.1: ${changedPath}`)
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
      `No SQL apply file allowed in C7.1: ${changedPath}`,
    )
  }
  assert(
    !changedPath.startsWith('supabase/functions/') ||
      changedPath.startsWith('supabase/functions/provision-center-admin-account/'),
    `No unexpected Edge Function file allowed in C7.1: ${changedPath}`,
  )
  assert(!/teacher-portal|account-management|runtime-ui/i.test(changedPath), `No C7 runtime UI/action file allowed: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(testPath)

console.log('C7.1 smoke: PASS')
