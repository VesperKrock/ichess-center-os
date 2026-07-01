import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-6g-3-service-role-grants-cho-admin-provisioning.md')
const applySqlPath = path.join(root, 'docs', 'supabase-c7-6g-3-manual-apply-service-role-grants.sql')
const verifySqlPath = path.join(root, 'docs', 'supabase-c7-6g-3-post-apply-verify-service-role-grants.sql')
const functionPath = path.join(root, 'supabase', 'functions', 'provision-center-admin-account', 'index.ts')
const testPath = path.join(root, 'tests', 'supabase-c7-6g-3-service-role-grants-cho-admin-provisioning-smoke.js')

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

assert(fs.existsSync(docPath), 'Docs C7.6G.3 must exist')
assert(fs.existsSync(applySqlPath), 'Manual apply SQL C7.6G.3 must exist')
assert(fs.existsSync(verifySqlPath), 'Post-apply verify SQL C7.6G.3 must exist')
assert(fs.existsSync(functionPath), 'Edge Function source must exist')
assert(fs.existsSync(testPath), 'Smoke C7.6G.3 must exist')

const docs = readUtf8(docPath)
const applySql = readUtf8(applySqlPath)
const verifySql = readUtf8(verifySqlPath)

;[
  'C7.6G.3 STATUS: SERVICE ROLE GRANTS FOR ADMIN PROVISIONING',
  'C7_6G_DEPLOY_BY_USER: PASS',
  'C7_6G_2_REDEPLOY_BY_USER: PASS',
  'C7_6G_2_DEBUG_ERROR_CODE: 42501',
  'C7_6G_2_DEBUG_ERROR_MESSAGE: permission denied for table center_members',
  'C7_6G_2_DEBUG_ERROR_HINT_CAPTURED: YES',
  'ROOT_CAUSE: service_role_missing_table_privileges',
  'SERVICE_ROLE_GRANTS_MANUAL_APPLY_SQL_CREATED: YES',
  'SERVICE_ROLE_GRANTS_POST_APPLY_VERIFY_SQL_CREATED: YES',
  'GRANT_PUBLIC_SCHEMA_USAGE_TO_SERVICE_ROLE: YES',
  'GRANT_CENTERS_SELECT_TO_SERVICE_ROLE: YES',
  'GRANT_CENTER_MEMBERS_SELECT_TO_SERVICE_ROLE: YES',
  'GRANT_CENTER_MEMBERS_INSERT_TO_SERVICE_ROLE: YES',
  'GRANT_CENTER_MEMBERS_DELETE_TO_SERVICE_ROLE: YES',
  'GRANT_ACCOUNT_AUDIT_LOGS_SELECT_TO_SERVICE_ROLE: YES',
  'GRANT_ACCOUNT_AUDIT_LOGS_INSERT_TO_SERVICE_ROLE: YES',
  'GRANT_UPDATE_TO_SERVICE_ROLE: NO',
  'GRANT_ALL_PRIVILEGES_TO_SERVICE_ROLE: NO',
  'GRANT_AUTHENTICATED_OR_ANON: NO',
  'RLS_POLICY_CHANGED: NO',
  'DATA_INSERTED_BY_CODEX: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'EDGE_FUNCTION_REDEPLOYED_BY_CODEX: NO',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED_IN_SUPABASE: NO',
  'ADMIN_PHONGTRONG_CREATED: NO',
  'RUNTIME_UI_CHANGE: NO',
  'C7_6H_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'không cần redeploy function nếu chỉ apply GRANT privilege',
  'center_admin_already_exists',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '-- C7.6G.3 MANUAL APPLY: service_role grants for admin provisioning Edge Function',
  'grant usage on schema public to service_role;',
  'grant select on table public.centers to service_role;',
  'grant select, insert, delete on table public.center_members to service_role;',
  'grant select, insert on table public.account_audit_logs to service_role;',
].forEach((needle) => assertIncludes(applySql.toLowerCase(), needle.toLowerCase()))

;[
  'has_schema_privilege',
  'has_table_privilege',
  "'service_role'",
  "'public.centers'",
  "'public.center_members'",
  "'public.account_audit_logs'",
  'information_schema.role_table_grants',
].forEach((needle) => assertIncludes(verifySql, needle))

assertNotIncludes(applySql.toLowerCase(), 'grant all privileges', 'GRANT ALL PRIVILEGES')
assert(!/to\s+(authenticated|anon)\b/i.test(applySql), 'Apply SQL must not grant authenticated or anon')
assert(!/^\s*(insert|update|delete|drop|truncate|alter|create)\b/im.test(applySql), 'Apply SQL must not contain DML/DDL data statements')
assert(!/policy\b/i.test(applySql), 'Apply SQL must not modify RLS policies')
assert(!/update\s+on\s+table/i.test(applySql), 'Apply SQL must not grant UPDATE')

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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.6G.3 scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src runtime diff allowed in C7.6G.3: ${changedPath}`)
  assert(!/teacher-portal|account-management|runtime-ui/i.test(changedPath), `No runtime UI/action file allowed: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(applySqlPath)
assertNoMojibake(verifySqlPath)
assertNoMojibake(testPath)

console.log('C7.6G.3 smoke: PASS')
