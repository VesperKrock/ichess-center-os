import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c7-6c-ha-tang-audit-server-side-apply-readiness.md')
const manualSqlPath = path.join(root, 'docs', 'supabase-c7-6c-manual-apply-account-audit-log.sql')
const verifySqlPath = path.join(root, 'docs', 'supabase-c7-6c-post-apply-verify-account-audit-log.sql')
const testPath = path.join(root, 'tests', 'supabase-c7-6c-ha-tang-audit-server-side-apply-readiness-smoke.js')

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

assert(fs.existsSync(docPath), 'Docs C7.6C must exist')
assert(fs.existsSync(manualSqlPath), 'Manual apply SQL C7.6C must exist')
assert(fs.existsSync(verifySqlPath), 'Post-apply verify SQL C7.6C must exist')
assert(fs.existsSync(testPath), 'Smoke C7.6C must exist')

const docs = readUtf8(docPath)
const manualSql = readUtf8(manualSqlPath)
const verifySql = readUtf8(verifySqlPath)
const manualSqlWithoutComments = stripSqlComments(manualSql)
const verifySqlWithoutComments = stripSqlComments(verifySql)

;[
  'C7.6C STATUS: AUDIT INFRASTRUCTURE APPLY READINESS',
  'C7_6C_1_STATUS: AUDIT SQL IDEMPOTENT SYNC AND VERIFY PASS',
  'C7_1_STATUS: PASS',
  'C7_2_STATUS: PASS',
  'C7_3_STATUS: PASS',
  'C7_4_STATUS: PASS',
  'C7_5_STATUS: PASS',
  'C7_6A_STATUS: PASS',
  'C7_6B_STATUS: PASS',
  'C7_6B_MANUAL_INSPECTION: PASS',
  'AUDIT_SQL_APPLIED_BY_USER: YES',
  'AUDIT_SQL_APPLIED_BY_CODEX: NO',
  'AUDIT_SQL_VERIFY_BY_USER: PASS',
  'ACCOUNT_AUDIT_LOGS_TABLE_EXISTS_VERIFIED: YES',
  'ACCOUNT_AUDIT_LOGS_COLUMNS_VERIFIED: YES',
  'ACCOUNT_AUDIT_LOGS_CONSTRAINTS_VERIFIED: YES',
  'ACCOUNT_AUDIT_LOGS_INDEXES_VERIFIED: YES',
  'ACCOUNT_AUDIT_LOGS_RLS_TRUE_VERIFIED: YES',
  'ACCOUNT_AUDIT_LOGS_POLICIES_NONE_VERIFIED: YES',
  'ACCOUNT_AUDIT_LOGS_CONSTRAINTS_NOT_VALID_NOTED: YES',
  'AUDIT_SQL_IDEMPOTENT_TEMPLATE_SYNCED: YES',
  'EDGE_FUNCTIONS_AVAILABLE: YES',
  'EDGE_FUNCTION_SECRETS_UI_AVAILABLE: YES',
  'EMAIL_PROVIDER_ENABLED: YES',
  'DEDICATED_AUDIT_TABLE_CURRENTLY_MISSING: YES',
  'GENERIC_CLOUD_AUDIT_ENTRY_STAGING_NOTED: YES',
  'AUDIT_INFRASTRUCTURE_MANUAL_APPLY_SQL_CREATED: YES',
  'AUDIT_INFRASTRUCTURE_POST_APPLY_VERIFY_SQL_CREATED: YES',
  'ACCOUNT_AUDIT_LOGS_TABLE_DESIGNED: YES',
  'ACCOUNT_AUDIT_LOGS_TABLE_NAME: public.account_audit_logs',
  'PLAINTEXT_PASSWORD_STORAGE_ALLOWED: NO',
  'PLAINTEXT_PASSWORD_AUDIT_LOG_ALLOWED: NO',
  'PASSWORD_KEY_GUARD_DESIGNED: YES',
  'AUDIT_LOG_RLS_ENABLED_DESIGNED: YES',
  'BROAD_AUTHENTICATED_INSERT_POLICY_DESIGNED: NO',
  'BROAD_AUTHENTICATED_SELECT_POLICY_DESIGNED: NO',
  'SERVICE_ROLE_WRITE_MODEL_DESIGNED: YES',
  'OWNER_AUDIT_UI_DEFERRED: YES',
  'SEED_AUDIT_ROW_CREATED: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'EDGE_FUNCTION_CREATED: NO',
  'EDGE_FUNCTION_DEPLOYED: NO',
  'SECRETS_SET_BY_CODEX: NO',
  'RUNTIME_CHANGE: NO',
  'C7_6D_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C7.6C',
  '## 2. Trạng thái sau C7.6B',
  '## 3. Manual inspection summary',
  '## 4. Vì sao cần dedicated audit table',
  '## 5. Vì sao không dùng center_cloud_entities audit_log_entry hiện tại',
  '## 6. SQL safety statement',
  '## 7. Manual apply SQL created',
  '## 8. Proposed table: public.account_audit_logs',
  '## 9. Column design',
  '## 10. Constraint design',
  '## 11. Plaintext password guard',
  '## 12. Index design',
  '## 13. RLS/policy design',
  '## 14. Service role write model',
  '## 15. Owner audit UI deferred',
  '## 16. No seed/test row',
  '## 17. Post-apply verify SQL created',
  '## 18. Expected post-apply result',
  '## 18.1 C7.6C.1 - User manual apply/verify result',
  '## 19. Risk list',
  '## 20. C7.6D recommendation',
  '## 21. PASS / NEEDS REVIEW criteria',
].forEach((section) => assertIncludes(docs, section))

;[
  'Edge Functions: có',
  'Secrets UI: có',
  'Email: Enabled',
  'admin.dreamhome@ichess.vn',
  'admin.phongtrong@ichess.vn',
  'Dedicated audit/log table: Success. No rows returned',
  'audit_log_entry,dreamhome,1',
  'generic cloud/staging entity',
  'public.account_audit_logs',
  'account.provision_center_admin',
  'account.reset_password',
  'account.ban',
  'membership.revoke',
  'center.archive',
  'temporary_password',
  'plaintext_password',
  'alter table public.account_audit_logs enable row level security',
  'Không tạo broad authenticated INSERT policy',
  'Không tạo broad authenticated SELECT policy',
  'Service role',
  'Owner audit UI read policy được defer',
  'không insert seed row',
  'Không tạo admin thật trước khi audit table apply/verify PASS',
  'Apply result:',
  'Success. No rows returned.',
  'RLS true',
  'Policies: Success. No rows returned.',
  'No broad authenticated select policy',
  'No broad authenticated insert policy',
  'Các CHECK constraint hiện là NOT VALID',
  'NOT VALID accepted for C7.6C',
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
  'C7_6D_STARTED: YES',
  'COMMIT: DONE',
  'PUSH: DONE',
].forEach((needle) => assertNotIncludes(docs, needle))

;[
  '-- C7.6C MANUAL APPLY: account/server-side audit infrastructure',
  '-- Run manually in Supabase SQL Editor only after user approval.',
  '-- Purpose: create dedicated server-side audit log table for sensitive account/center governance actions.',
  '-- This file does not create Auth users.',
  '-- This file does not create memberships.',
  '-- This file does not create centers.',
  '-- This file does not create Edge Functions.',
  '-- This file must not log plaintext passwords.',
  '-- Idempotent version: safe to run again without duplicate constraint errors.',
].forEach((header) => assertIncludes(manualSql, header))

;[
  'create table if not exists public.account_audit_logs',
  'do $$',
  'if not exists (',
  "conname = 'account_audit_logs_action_not_empty'",
  "conname = 'account_audit_logs_target_type_not_empty'",
  "conname = 'account_audit_logs_actor_email_sane'",
  "conname = 'account_audit_logs_target_email_sane'",
  "conname = 'account_audit_logs_metadata_no_plaintext_password_keys'",
  "conname = 'account_audit_logs_before_state_no_plaintext_password_keys'",
  "conname = 'account_audit_logs_after_state_no_plaintext_password_keys'",
  'id uuid primary key default gen_random_uuid()',
  'actor_user_id uuid null',
  'actor_email text null',
  'action text not null',
  'target_type text not null',
  'target_user_id uuid null',
  'target_email text null',
  'center_id text null',
  'before_state jsonb null',
  'after_state jsonb null',
  'request_id text null',
  "metadata jsonb not null default '{}'::jsonb",
  "not (metadata ? 'temporary_password')",
  "not (metadata ? 'password')",
  "not (metadata ? 'plaintext_password')",
  'create index if not exists account_audit_logs_created_at_desc_idx',
  'alter table public.account_audit_logs enable row level security',
].forEach((needle) => assertIncludes(manualSql, needle))

assert(!/\binsert\s+into\b/i.test(manualSqlWithoutComments), 'Manual apply SQL must not insert seed rows')
assert(!/create\s+policy[\s\S]{0,220}authenticated/i.test(manualSqlWithoutComments), 'Manual apply SQL must not add broad authenticated policy')
assert(!/^alter table public\.account_audit_logs\s+add constraint account_audit_logs_/im.test(manualSqlWithoutComments), 'Manual apply SQL constraints must be idempotent inside DO blocks')
assert(!/auth\.users/i.test(manualSqlWithoutComments), 'Manual apply SQL must not create Auth users')
assert(!/center_members/i.test(manualSqlWithoutComments), 'Manual apply SQL must not create memberships')
assert(!/supabase\/functions/i.test(manualSql), 'Manual apply SQL must not create Edge Function files')

;[
  '-- C7.6C POST-APPLY VERIFY: account/server-side audit infrastructure',
  '-- Read-only verification.',
  '-- This file does not modify data.',
  'from information_schema.tables',
  "table_name = 'account_audit_logs'",
  'from information_schema.columns',
  'from pg_constraint con',
  'from pg_indexes',
  'from pg_tables',
  'rowsecurity',
  'from pg_policies',
].forEach((needle) => assertIncludes(verifySql, needle))

assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge|call)\b/i.test(verifySqlWithoutComments), 'Post-apply verify SQL must be read-only')

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
  assert(allowedPaths.has(changedPath), `Unexpected changed file in C7.6C scope: ${changedPath}`)
  assert(!changedPath.startsWith('src/'), `No src diff allowed in C7.6C: ${changedPath}`)
  assert(
    !changedPath.startsWith('supabase/functions/') ||
      changedPath.startsWith('supabase/functions/provision-center-admin-account/'),
    `No unexpected Edge Function file allowed in C7.6C: ${changedPath}`,
  )
  assert(!/teacher-portal|account-management|runtime-ui/i.test(changedPath), `No C7 runtime UI/action file allowed: ${changedPath}`)
}

assert(fs.existsSync(path.join(root, 'supabase', 'functions', 'provision-center-admin-account')), 'C7.6D function folder is expected after C7.6D')

assertNoMojibake(docPath)
assertNoMojibake(manualSqlPath)
assertNoMojibake(verifySqlPath)
assertNoMojibake(testPath)

console.log('C7.6C smoke: PASS')
