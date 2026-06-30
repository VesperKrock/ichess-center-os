import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-3b-centers-schema-hardening-provisioning-pack.md')
const readonlySqlPath = path.join(root, 'docs', 'supabase-c6-3b-readonly-inspect-centers-schema.sql')
const manualSqlPath = path.join(root, 'docs', 'supabase-c6-3b-manual-apply-centers-schema-hardening-template.sql')

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
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

function assertNoMojibake(filePath) {
  const content = readUtf8(filePath)
  const forbidden = [
    [0x0043, 0x0102, 0x00a1, 0x00c2, 0x00ba].map((code) => String.fromCharCode(code)).join(''),
    [0x0102, 0x0192].map((code) => String.fromCharCode(code)).join(''),
    [0x0102, 0x2020, 0x00c2, 0x00b0].map((code) => String.fromCharCode(code)).join(''),
    [0x0048, 0x0102, 0x00a1, 0x00c2, 0x00ba].map((code) => String.fromCharCode(code)).join(''),
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

assert(fs.existsSync(docPath), 'C6.3B docs must exist')
assert(fs.existsSync(readonlySqlPath), 'C6.3B read-only SQL must exist')
assert(fs.existsSync(manualSqlPath), 'C6.3B manual apply template must exist')

const docs = readUtf8(docPath)
const readonlySql = readUtf8(readonlySqlPath)
const manualSql = readUtf8(manualSqlPath)
const readonlyExecutableSql = stripSqlComments(readonlySql)
const manualExecutableSql = stripSqlComments(manualSql)
const main = readUtf8(path.join(root, 'src', 'main.js'))

;[
  'C6.3B STATUS: CENTERS SCHEMA HARDENING PROVISIONING PACK',
  'C6_3A_STATUS: PASS',
  'CURRENT_CENTERS_SCHEMA_MINIMAL: YES',
  'PROPOSED_CENTER_COLUMNS: slug, environment, status, updated_at',
  'PROPOSED_UNIQUE_SLUG_ENVIRONMENT: YES',
  'BACKFILL_DREAMHOME_STAGING: YES',
  'BACKFILL_DREAMHOME_PRODUCTION: YES',
  'FUTURE_CENTER_ID_EXAMPLE_GOVAP: govap_prod',
  'FUTURE_CENTER_ID_EXAMPLE_QUAN12: quan12_prod',
  'ADD_CENTER_NOT_CLONE: YES',
  'READONLY_SQL_CREATED: YES',
  'MANUAL_APPLY_SQL_TEMPLATE_CREATED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'NEW_CENTER_CREATED: NO',
  'GOVAP_CREATED: NO',
  'QUAN12_CREATED: NO',
  'ANGEL_WINGS_DELETED: NO',
  'ANGEL_WINGS_MIGRATED: NO',
  'RUNTIME_CHANGE: NO',
  'C6_4_STARTED: NO',
  'C6_5_INTERNAL_CONSOLE_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'slug',
  'environment',
  'status',
  'updated_at',
  'unique index `(slug, environment)`',
  '`dreamhome` staging',
  '`dreamhome_prod` production',
  'govap_prod',
  'quan12_prod',
  'add center, not clone',
  'SQL safety/risk/order',
  'C6.3C manual apply centers schema hardening',
  'C6.5 Internal Center Console vẫn deferred',
  'C7 vẫn deferred',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(readonlySql, 'READ ONLY')
assertIncludes(readonlySql, 'centers')
assertIncludes(readonlySql, 'center_members')
assertIncludes(readonlySql, 'center_cloud_entities')
assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge|upsert)\b/i.test(readonlyExecutableSql), 'Read-only SQL must not contain mutating operations')

assertIncludes(manualSql, 'MANUAL APPLY TEMPLATE ONLY')
;['slug', 'environment', 'status', 'updated_at', 'dreamhome', 'dreamhome_prod', 'staging', 'production'].forEach((needle) =>
  assertIncludes(manualSql, needle),
)
assert(!/insert\s+into[\s\S]*govap_prod/i.test(manualExecutableSql), 'Manual template must not insert govap_prod')
assert(!/insert\s+into[\s\S]*quan12_prod/i.test(manualExecutableSql), 'Manual template must not insert quan12_prod')
assert(!/\b(delete|drop|truncate)\b/i.test(manualExecutableSql), 'Manual template must not delete/drop/truncate')
assert(!/\brename\b[\s\S]*dreamhome/i.test(manualExecutableSql), 'Manual template must not rename dreamhome')

assertNotIncludes(main, 'Thêm cơ sở')
assertNotIncludes(main, 'username login')
assertNotIncludes(main, 'Teacher Portal')
assertNotIncludes(main, 'Super Admin')

const status = execFileSync('git', ['status', '--short'], {
  cwd: root,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  'docs/supabase-c6-3a-multi-center-foundation-audit-design.md',
  'docs/supabase-c6-3b-centers-schema-hardening-provisioning-pack.md',
  'docs/supabase-c6-3b-readonly-inspect-centers-schema.sql',
  'docs/supabase-c6-3b-manual-apply-centers-schema-hardening-template.sql',
        'docs/supabase-c6-3c-readonly-verify-centers-schema-hardening-applied.sql',
  'docs/supabase-c6-3d-runtime-readiness-audit-sau-centers-schema-hardening.md',
  'docs/supabase-c6-3e-checkpoint-review-multi-center-foundation.md',
  'docs/supabase-c6-3c-verify-centers-schema-hardening-applied.md',
  'docs/supabase-c6-3c-readonly-verify-centers-schema-hardening-applied.sql',
  'docs/supabase-c6-3d-runtime-readiness-audit-sau-centers-schema-hardening.md',
  'docs/supabase-c6-3e-checkpoint-review-multi-center-foundation.md',
  'tests/supabase-c6-3a-multi-center-foundation-audit-design-smoke.js',
  'tests/supabase-c6-3b-centers-schema-hardening-provisioning-pack-smoke.js',
  'tests/supabase-c6-3c-verify-centers-schema-hardening-applied-smoke.js',
  'tests/supabase-c6-3d-runtime-readiness-audit-sau-centers-schema-hardening-smoke.js',
  'tests/supabase-c6-3e-checkpoint-review-multi-center-foundation-smoke.js',
  'docs/supabase-c6-4a-minimal-owner-admin-role-binding-audit-design.md',
  'tests/supabase-c6-4a-minimal-owner-admin-role-binding-audit-design-smoke.js',
  'docs/supabase-c6-4b-owner-membership-readiness-provisioning-pack.md',
  'docs/supabase-c6-4b-readonly-inspect-owner-membership-readiness.sql',
  'docs/supabase-c6-4b-manual-apply-owner-membership-template.sql',
  'tests/supabase-c6-4b-owner-membership-readiness-provisioning-pack-smoke.js',
  'docs/supabase-c6-4c-owner-membership-apply-decision-ready.md',
  'tests/supabase-c6-4c-owner-membership-apply-decision-ready-smoke.js',
  'docs/supabase-c6-4d-verify-owner-membership-applied.md',
  'tests/supabase-c6-4d-verify-owner-membership-applied-smoke.js',
  'docs/supabase-c6-4e-runtime-manual-qa-owner-login.md',
  'tests/supabase-c6-4e-runtime-manual-qa-owner-login-smoke.js',
  'docs/supabase-c6-4f-checkpoint-review-owner-role-binding.md',
  'tests/supabase-c6-4f-checkpoint-review-owner-role-binding-smoke.js',
  'tests/supabase-c6-0-production-readiness-audit-truoc-dreamhome-production-smoke.js',
  'tests/supabase-c6-1a-thiet-ke-dreamhome-production-empty-center-smoke.js',
  'tests/supabase-c6-1b-readonly-verification-pack-dreamhome-production-empty-center-smoke.js',
  'tests/supabase-c6-1c-production-staging-split-them-co-so-trong-smoke.js',
  'tests/supabase-c6-1d-account-based-center-resolver-cache-guard-smoke.js',
  'tests/supabase-c6-1d-1-taskbar-profile-wording-polish-smoke.js',
  'tests/supabase-c6-1e-checkpoint-review-dreamhome-production-empty-center-smoke.js',
  'tests/supabase-c6-2a-online-local-production-staging-qa-audit-smoke.js',
  'tests/supabase-c6-2b-startup-badge-cache-flicker-hotfix-smoke.js',
  'tests/supabase-c6-2b-1-truy-nguon-badge-3-thong-bao-kho-hang-smoke.js',
  'tests/supabase-c6-2e-checkpoint-review-production-staging-hardening-smoke.js',
  'docs/supabase-c6-5a-internal-center-console-audit-design.md',
  'tests/supabase-c6-5a-internal-center-console-audit-design-smoke.js',
  'docs/supabase-c6-5b-hidden-route-skeleton-owner-guard.md',
  'docs/supabase-c6-5c-centers-list-readonly.md',
  'docs/supabase-c6-5d-checkpoint-review-internal-center-console.md',
  'docs/supabase-c6-6a-them-co-so-mot-truong-audit-design.md',
  'docs/supabase-c6-6b-manual-apply-provision-center-rpc-template.sql',
  'docs/supabase-c6-6c-post-apply-verify-provision-center-rpc.sql',
  'docs/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack.md',
  'docs/supabase-c6-6d-readonly-verify-rpc-applied.sql',
  'docs/supabase-c6-6d-controlled-create-center-rpc-template.sql',
  'docs/supabase-c6-6d-post-create-verify-center.sql',
  'docs/supabase-c6-6c-manual-apply-provision-center-rpc.sql',
  'docs/supabase-c6-6c-rpc-apply-decision-ready.md',
  'docs/supabase-c6-6b-readonly-inspect-add-center-provisioning-readiness.sql',
  'docs/supabase-c6-6b-provisioning-rpc-design-inspection-pack.md',
  'src/main.js',
  'src/styles.css',
  'tests/supabase-c6-5b-hidden-route-skeleton-owner-guard-smoke.js',
  'tests/supabase-c6-5c-centers-list-readonly-smoke.js',
  'tests/supabase-c6-5d-checkpoint-review-internal-center-console-smoke.js',
  'tests/supabase-c6-6a-them-co-so-mot-truong-audit-design-smoke.js',
  'tests/supabase-c6-6b-provisioning-rpc-design-inspection-pack-smoke.js',
  'tests/supabase-c6-6c-rpc-apply-decision-ready-smoke.js',
  'tests/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.3B scope: ${changedPath}`)
  assert(!/c6-4(?![abcdef])|c6-5(?![abcd])|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.3B must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)

console.log('C6.3B smoke: PASS')
