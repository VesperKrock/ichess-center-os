import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-3a-multi-center-foundation-audit-design.md')
const optionalSqlPath = path.join(root, 'docs', 'supabase-c6-3a-readonly-inspect-centers-memberships.sql')

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
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

assert(fs.existsSync(docPath), 'C6.3A docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(path.join(root, 'src', 'main.js'))

;[
  'C6.3A STATUS: MULTI CENTER FOUNDATION AUDIT DESIGN',
  'C6_2_DONE: YES',
  'PRODUCTION_CENTER_ID_EXAMPLE: dreamhome_prod',
  'STAGING_CENTER_ID_EXAMPLE: dreamhome',
  'FUTURE_CENTER_ID_EXAMPLE_GOVAP: govap_prod',
  'FUTURE_CENTER_ID_EXAMPLE_QUAN12: quan12_prod',
  'ADD_CENTER_NOT_CLONE: YES',
  'ONE_SHARED_LINK_ACCOUNT_BASED_ROUTING: YES',
  'URL_BASED_SECURITY: NO',
  'CURRENT_SCHEMA_REVIEWED: YES',
  'CENTERS_SCHEMA_RUNTIME_CHANGE: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'NEW_CENTER_CREATED: NO',
  'ANGEL_WINGS_DELETED: NO',
  'ANGEL_WINGS_MIGRATED: NO',
  'C6_4_STARTED: NO',
  'C6_5_INTERNAL_CONSOLE_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'C6.2 đã hoàn tất',
  'public.centers',
  'public.center_members',
  'localStorage',
  'DreamHome',
  'Gò Vấp',
  'Quận 12',
  'govap_prod',
  'quan12_prod',
  'add center, not clone',
  'một link chung',
  'URL không quyết định security',
  'C6.4 minimal owner/admin role binding vẫn deferred',
  'C6.5 Internal Center Console deferred',
  'C7 mới xử lý',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(docs, 'Không tạo `govap_prod`')
assertIncludes(docs, 'không tạo `quan12_prod`')
assertIncludes(docs, 'Không migrate/xóa localStorage')

if (fs.existsSync(optionalSqlPath)) {
  const sql = readUtf8(optionalSqlPath)
  assertIncludes(sql, 'READ ONLY')
  assertIncludes(sql, 'centers')
  assertIncludes(sql, 'center_members')
  assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/i.test(sql), 'C6.3A SQL must be read-only')
}

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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.3A scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath) || /supabase-c6-3(b-(readonly-inspect-centers-schema|manual-apply-centers-schema-hardening-template)|c-readonly-verify-centers-schema-hardening-applied)\.sql$/i.test(changedPath), `C6.3A/C6.3B SQL scope mismatch: ${changedPath}`)
  assert(!/c6-4|c6-5|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.3A must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)

console.log('C6.3A smoke: PASS')
