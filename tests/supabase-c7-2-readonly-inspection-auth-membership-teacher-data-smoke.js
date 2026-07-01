import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-2-readonly-inspection-auth-membership-teacher-data.md')
const sqlPath = path.join(root, 'docs', 'supabase-c7-2-readonly-inspect-auth-membership-teacher-data.sql')
const testPath = path.join(root, 'tests', 'supabase-c7-2-readonly-inspection-auth-membership-teacher-data-smoke.js')

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

assert(fs.existsSync(docPath), 'Docs C7.2 must exist')
assert(fs.existsSync(sqlPath), 'Read-only SQL C7.2 must exist')
assert(fs.existsSync(testPath), 'Smoke C7.2 must exist')

const docs = readUtf8(docPath)
const sql = readUtf8(sqlPath)
const executableSql = stripSqlComments(sql)

;[
  'C7.2 STATUS: READONLY INSPECTION AUTH MEMBERSHIP TEACHER DATA',
  'C7_1_STATUS: PASS',
  'READONLY_INSPECT_SQL_CREATED: YES',
  'AUTH_USERS_INSPECTION_DESIGNED: YES',
  'CENTERS_INSPECTION_DESIGNED: YES',
  'CENTER_MEMBERS_INSPECTION_DESIGNED: YES',
  'ROLE_COUNTS_INSPECTION_DESIGNED: YES',
  'CENTER_ADMIN_ONE_CENTER_VIOLATION_CHECK_DESIGNED: YES',
  'OWNER_MEMBERSHIP_INSPECTION_DESIGNED: YES',
  'TEACHER_MEMBERSHIP_INSPECTION_DESIGNED: YES',
  'TEACHER_RELATED_TABLE_FUNCTION_INSPECTION_DESIGNED: YES',
  'CENTER_CLOUD_ENTITIES_TEACHER_INSPECTION_DESIGNED: YES',
  'CONSTRAINTS_INDEXES_POLICIES_INSPECTION_DESIGNED: YES',
  'EXPECTED_OWNER_DREAMHOME_PROD_MEMBERSHIP: YES',
  'EXPECTED_OWNER_PHONGTRONG_PROD_MEMBERSHIP: YES',
  'EXPECTED_ADMIN_DREAMHOME_PROD_MEMBERSHIP: YES',
  'EXPECTED_CENTER_ADMIN_MULTI_CENTER_VIOLATIONS: 0',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C7_3_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C7.2',
  '## 2. Trạng thái sau C7.1',
  '## 3. Read-only SQL created',
  '## 4. SQL safety statement',
  '## 5. Auth users inspection',
  '## 6. Centers inspection',
  '## 7. center_members inspection',
  '## 8. Role counts',
  '## 9. center_admin one-center violation check',
  '## 10. owner membership overview',
  '## 11. teacher membership overview',
  '## 12. Teacher-related table/function inspection',
  '## 13. center_cloud_entities teacher data inspection',
  '## 14. Constraints/indexes/policies inspection',
  '## 15. Expected findings',
  '## 16. What C7.2 does not do',
  '## 17. Recommendation for user manual SQL run',
  '## 18. C7.3 dependency',
  '## 19. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  'owner.duchai@ichess.vn',
  'dreamhome_prod',
  'phongtrong_prod',
  'admin.dreamhome@ichess.vn',
  'center_admin multi-center violation query nên trả 0 rows',
  'teacher role memberships có thể đang 0 rows',
  'teacher data hiện chủ yếu nằm ở app/module/local/cloud generic',
  'không SQL/Supabase action/Auth user/membership/runtime',
  'C7.3 chỉ nên bắt đầu sau khi có kết quả read-only inspection',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'SQL_APPLIED_BY_CODEX: YES',
  'AUTH_USER_CREATED: YES',
  'MEMBERSHIP_CREATED: YES',
  'RUNTIME_CHANGE: YES',
  'C7_3_STARTED: YES',
  'COMMIT: DONE',
  'PUSH: DONE',
].forEach((needle) => assertNotIncludes(docs, needle))

;[
  '-- C7.2 READ-ONLY INSPECTION ONLY',
  '-- Do not run as apply/migration.',
  '-- This file does not create Auth users.',
  '-- This file does not create memberships.',
  '-- This file does not create teacher profiles.',
  '-- This file does not modify data.',
  '-- Purpose: inspect current auth/users/memberships/teacher-related readiness before C7 account model work.',
].forEach((header) => assertIncludes(sql, header))

;[
  'from auth.users',
  'from public.centers',
  'from public.center_members cm',
  "where cm.role = 'center_admin'",
  'having count(distinct cm.center_id) > 1',
  "where cm.role = 'owner'",
  "where cm.role = 'teacher'",
  'from information_schema.tables',
  'from information_schema.columns',
  'from pg_proc p',
  'from public.center_cloud_entities',
  "entity_type ilike '%teacher%'",
  'from pg_constraint con',
  'from pg_indexes',
  'from pg_policies',
].forEach((needle) => assertIncludes(sql, needle))

const mutatingSqlPattern = /\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge|call)\b/i
assert(!mutatingSqlPattern.test(executableSql), 'Read-only SQL must not contain mutating executable SQL')
assert(!/provision_center_for_owner\s*\(/i.test(executableSql), 'Read-only SQL must not call provisioning RPC')

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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.2 scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src diff allowed in C7.2: ${changedPath}`)
  assert(
    !changedPath.startsWith('supabase/functions/') ||
      changedPath.startsWith('supabase/functions/provision-center-admin-account/'),
    `No unexpected Edge Function file allowed in C7.2: ${changedPath}`,
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
      `No SQL apply file allowed in C7.2: ${changedPath}`,
    )
  }
}

assertNoMojibake(docPath)
assertNoMojibake(sqlPath)
assertNoMojibake(testPath)

console.log('C7.2 smoke: PASS')
