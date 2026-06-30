import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-3c-verify-centers-schema-hardening-applied.md')
const verifySqlPath = path.join(root, 'docs', 'supabase-c6-3c-readonly-verify-centers-schema-hardening-applied.sql')

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

assert(fs.existsSync(docPath), 'C6.3C docs must exist')
assert(fs.existsSync(verifySqlPath), 'C6.3C read-only verify SQL must exist')

const docs = readUtf8(docPath)
const verifySql = readUtf8(verifySqlPath)
const verifyExecutableSql = stripSqlComments(verifySql)
const main = readUtf8(path.join(root, 'src', 'main.js'))

;[
  'C6.3C STATUS: VERIFY CENTERS SCHEMA HARDENING APPLIED',
  'C6_3B_STATUS: PASS',
  'SQL_APPLIED_BY_USER: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'CENTERS_SCHEMA_HARDENED: YES',
  'DREAMHOME_BACKFILLED_AS_STAGING: YES',
  'DREAMHOME_PROD_BACKFILLED_AS_PRODUCTION: YES',
  'CENTERS_ENVIRONMENT_CHECK_EXISTS: YES',
  'CENTERS_STATUS_CHECK_EXISTS: YES',
  'CENTERS_SLUG_ENVIRONMENT_UNIQUE_INDEX_EXISTS: YES',
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
  'dreamhome',
  'staging',
  'dreamhome_prod',
  'production',
  'centers_environment_check',
  'centers_status_check',
  'centers_slug_environment_unique_idx',
  'Gò Vấp',
  'Quận 12',
  'Angel Wings',
  'C6.5 Internal Center Console remains deferred',
  'C7 remains deferred',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(verifySql, 'READ ONLY')
assertIncludes(verifySql, 'centers')
assertIncludes(verifySql, 'centers_environment_check')
assertIncludes(verifySql, 'centers_status_check')
assertIncludes(verifySql, 'centers_slug_environment_unique_idx')
assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/i.test(verifyExecutableSql), 'C6.3C verify SQL must be read-only')

assertNotIncludes(main, '/internal/centers')
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
  'docs/supabase-c6-3c-verify-centers-schema-hardening-applied.md',
  'docs/supabase-c6-3c-readonly-verify-centers-schema-hardening-applied.sql',
  'docs/supabase-c6-3d-runtime-readiness-audit-sau-centers-schema-hardening.md',
  'docs/supabase-c6-3e-checkpoint-review-multi-center-foundation.md',
  'tests/supabase-c6-3a-multi-center-foundation-audit-design-smoke.js',
  'tests/supabase-c6-3b-centers-schema-hardening-provisioning-pack-smoke.js',
  'tests/supabase-c6-3c-verify-centers-schema-hardening-applied-smoke.js',
  'tests/supabase-c6-3d-runtime-readiness-audit-sau-centers-schema-hardening-smoke.js',
  'tests/supabase-c6-3e-checkpoint-review-multi-center-foundation-smoke.js',
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
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.3C scope: ${changedPath}`)
  assert(!/c6-4|c6-5|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.3C must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)

console.log('C6.3C smoke: PASS')
