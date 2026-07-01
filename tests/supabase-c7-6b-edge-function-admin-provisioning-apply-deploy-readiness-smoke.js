import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-6b-edge-function-admin-provisioning-apply-deploy-readiness.md')
const sqlPath = path.join(root, 'docs', 'supabase-c7-6b-readonly-inspect-admin-provisioning-readiness.sql')
const testPath = path.join(root, 'tests', 'supabase-c7-6b-edge-function-admin-provisioning-apply-deploy-readiness-smoke.js')

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`)
}

function assertNotIncludes(content, needle, label = needle) {
  assert(!content.includes(needle), `Unexpected ${label}`)
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
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

assert(fs.existsSync(docPath), 'Docs C7.6B must exist')
assert(fs.existsSync(sqlPath), 'Read-only SQL C7.6B must exist')
assert(fs.existsSync(testPath), 'Smoke C7.6B must exist')

const docs = readUtf8(docPath)
const sql = readUtf8(sqlPath)
const executableSql = stripSqlComments(sql)

;[
  'C7.6B STATUS: EDGE FUNCTION ADMIN PROVISIONING APPLY DEPLOY READINESS',
  'C7_1_STATUS: PASS',
  'C7_2_STATUS: PASS',
  'C7_3_STATUS: PASS',
  'C7_4_STATUS: PASS',
  'C7_5_STATUS: PASS',
  'C7_6A_STATUS: PASS',
  'READONLY_INSPECT_SQL_CREATED: YES',
  'TARGET_CENTERS_READINESS_DESIGNED: YES',
  'EXISTING_CENTER_ADMIN_READINESS_DESIGNED: YES',
  'DREAMHOME_DUPLICATE_ADMIN_CHECK_DESIGNED: YES',
  'PHONGTRONG_ADMIN_ABSENCE_CHECK_DESIGNED: YES',
  'DUPLICATE_ADMIN_EMAIL_CHECK_DESIGNED: YES',
  'CENTER_ADMIN_ONE_CENTER_CHECK_DESIGNED: YES',
  'CONSTRAINTS_INDEXES_POLICIES_CHECK_DESIGNED: YES',
  'AUDIT_INFRASTRUCTURE_CHECK_DESIGNED: YES',
  'EXISTING_FUNCTIONS_CHECK_DESIGNED: YES',
  'EDGE_FUNCTIONS_UI_CHECKLIST_DESIGNED: YES',
  'SECRETS_READINESS_CHECKLIST_DESIGNED: YES',
  'AUTH_SETTINGS_READINESS_CHECKLIST_DESIGNED: YES',
  'EMAIL_CONFIRMATION_LOGIN_CHECK_REQUIRED: YES',
  'AUDIT_READINESS_REQUIRED_BEFORE_REAL_PROVISIONING: YES',
  'PRODUCTION_DATA_SAFETY_CHECKLIST_DESIGNED: YES',
  'READINESS_DECISION_MATRIX_DESIGNED: YES',
  'C7_6C_OR_AUDIT_PACK_RECOMMENDED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'EDGE_FUNCTION_CREATED: NO',
  'EDGE_FUNCTION_DEPLOYED: NO',
  'SECRETS_SET_BY_CODEX: NO',
  'RUNTIME_CHANGE: NO',
  'C7_6C_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C7.6B',
  '## 2. Trạng thái sau C7.6A',
  '## 3. Read-only SQL created',
  '## 4. SQL safety statement',
  '## 5. Target centers readiness',
  '## 6. Existing center_admin readiness',
  '## 7. Duplicate admin email readiness',
  '## 8. center_admin one-center rule readiness',
  '## 9. Constraints/indexes/policies readiness',
  '## 10. Audit infrastructure readiness',
  '## 11. Existing functions readiness',
  '## 12. Edge Functions UI checklist',
  '## 13. Secrets readiness checklist',
  '## 14. Auth settings readiness checklist',
  '## 15. Audit readiness checklist',
  '## 16. Production data safety',
  '## 17. Readiness decision matrix',
  '## 18. C7.6C/C7.6D recommendation',
  '## 19. What C7.6B does not do',
  '## 20. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  '`provision_center_admin_account`',
  'admin.<slug>@ichess.vn',
  'temporary password random',
  'credential handoff',
  'DreamHome duplicate',
  'Phòng Trống',
  'admin.dreamhome@ichess.vn',
  'admin.phongtrong@ichess.vn',
  'phongtrong_prod',
  'dreamhome_prod',
  'center_admin one-center',
  'constraints/indexes/policies',
  'audit_log_entry,dreamhome,1',
  'dedicated server-side audit table',
  'provision_center_for_owner',
  'Edge Functions',
  'SUPABASE_SERVICE_ROLE_KEY',
  'Email/password sign-in enabled?',
  'Confirm email required?',
  'Không nên tạo admin account thật nếu không có audit path',
  'NEEDS AUDIT PACK FIRST',
  'C7.6C - Audit infrastructure/apply readiness pack',
  'C7.6D - Edge Function implementation pack',
  'Không tạo thư mục `supabase/functions`',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'SQL_APPLIED_BY_CODEX: YES',
  'SUPABASE_ACTION_BY_CODEX: RUN',
  'AUTH_USER_CREATED: YES',
  'MEMBERSHIP_CREATED: YES',
  'EDGE_FUNCTION_CREATED: YES',
  'EDGE_FUNCTION_DEPLOYED: YES',
  'SECRETS_SET_BY_CODEX: YES',
  'RUNTIME_CHANGE: YES',
  'C7_6C_STARTED: YES',
  'COMMIT: DONE',
  'PUSH: DONE',
].forEach((needle) => assertNotIncludes(docs, needle))

;[
  '-- C7.6B READ-ONLY INSPECTION ONLY',
  '-- Do not run as apply/migration.',
  '-- This file does not create Auth users.',
  '-- This file does not create memberships.',
  '-- This file does not create Edge Functions.',
  '-- This file does not modify data.',
  '-- Purpose: inspect database readiness before future admin account provisioning.',
].forEach((header) => assertIncludes(sql, header))

;[
  'from public.centers',
  "where id in ('dreamhome_prod', 'phongtrong_prod', 'dreamhome')",
  'from public.centers c',
  'left join public.center_members cm',
  "and cm.role = 'center_admin'",
  'left join auth.users u on u.id = cm.user_id',
  "'admin.dreamhome@ichess.vn'",
  "'admin.phongtrong@ichess.vn'",
  'having count(distinct cm.center_id) > 1',
  'from pg_constraint con',
  'from pg_indexes',
  'from pg_policies',
  'from information_schema.tables',
  'from information_schema.columns',
  'from public.center_cloud_entities',
  "entity_type ilike '%audit%'",
  'from pg_proc p',
  "p.proname ilike '%provision%'",
].forEach((needle) => assertIncludes(sql, needle))

const mutatingSqlPattern = /\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge|call)\b/i
assert(!mutatingSqlPattern.test(executableSql), 'Read-only SQL must not contain mutating executable SQL')
assert(!/provision_center_admin_account\s*\(/i.test(executableSql), 'Read-only SQL must not call admin provisioning')
assert(!/provision_center_for_owner\s*\(/i.test(executableSql), 'Read-only SQL must not call center provisioning')

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

const readonlySqlPaths = new Set([
  'docs/supabase-c7-2-readonly-inspect-auth-membership-teacher-data.sql',
  'docs/supabase-c7-6b-readonly-inspect-admin-provisioning-readiness.sql',
  'docs/supabase-c7-6c-manual-apply-account-audit-log.sql',
  'docs/supabase-c7-6c-post-apply-verify-account-audit-log.sql',
  'docs/supabase-c7-6e-readonly-preflight-admin-provisioning-qa.sql',
  'docs/supabase-c7-6e-readonly-post-qa-admin-provisioning-verify.sql',
  'docs/supabase-c7-6g-3-manual-apply-service-role-grants.sql',
  'docs/supabase-c7-6g-3-post-apply-verify-service-role-grants.sql',
  'docs/supabase-c7-6h-readonly-preinvoke-phongtrong-admin.sql',
  'docs/supabase-c7-6h-readonly-post-provision-verify-phongtrong-admin.sql',
  'docs/supabase-c7-6i-readonly-post-reset-verify-phongtrong-admin.sql',
  'docs/supabase-c7-7b-readonly-post-revoke-verify-phongtrong-admin.sql',
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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.6B scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src diff allowed in C7.6B: ${changedPath}`)
  assert(
    !changedPath.startsWith('supabase/functions/') ||
      changedPath.startsWith('supabase/functions/provision-center-admin-account/'),
    `No unexpected Edge Function file allowed in C7.6B: ${changedPath}`,
  )
  assert(!/teacher-portal|account-management|runtime-ui/i.test(changedPath), `No C7 runtime UI/action file allowed: ${changedPath}`)

  if (/\.sql$/i.test(changedPath)) {
    assert(readonlySqlPaths.has(changedPath), `No SQL apply file allowed in C7.6B: ${changedPath}`)
  }
}

assert(fs.existsSync(path.join(root, 'supabase', 'functions', 'provision-center-admin-account')), 'C7.6D function folder is expected after C7.6D')

assertNoMojibake(docPath)
assertNoMojibake(sqlPath)
assertNoMojibake(testPath)

console.log('C7.6B smoke: PASS')
