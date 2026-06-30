import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-3e-checkpoint-review-multi-center-foundation.md')

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

assert(fs.existsSync(docPath), 'C6.3E docs must exist')

const docs = readUtf8(docPath)
const srcMain = readUtf8(path.join(root, 'src', 'main.js'))
const srcAuth = readUtf8(path.join(root, 'src', 'supabase-auth.js'))

;[
  'C6.3E STATUS: CHECKPOINT REVIEW BEFORE COMMIT PUSH',
  'C6_3A_STATUS: PASS',
  'C6_3B_STATUS: PASS',
  'C6_3C_STATUS: PASS',
  'C6_3D_STATUS: PASS',
  'MANUAL_QA_AFTER_C6_3D: PASS',
  'SQL_APPLIED_BY_USER: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'CENTERS_SCHEMA_HARDENED: YES',
  'DREAMHOME_ENVIRONMENT: staging',
  'DREAMHOME_PROD_ENVIRONMENT: production',
  'CENTERS_ENVIRONMENT_CHECK_EXISTS: YES',
  'CENTERS_STATUS_CHECK_EXISTS: YES',
  'CENTERS_SLUG_ENVIRONMENT_UNIQUE_INDEX_EXISTS: YES',
  'FUTURE_CENTER_ID_EXAMPLE_GOVAP: govap_prod',
  'FUTURE_CENTER_ID_EXAMPLE_QUAN12: quan12_prod',
  'ADD_CENTER_NOT_CLONE: YES',
  'ONE_SHARED_LINK_ACCOUNT_BASED_ROUTING: YES',
  'URL_BASED_SECURITY: NO',
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
  'C6.3A: PASS',
  'C6.3B: PASS',
  'C6.3C: PASS',
  'C6.3D: PASS',
  'Manual QA sau C6.3D',
  'SQL centers schema hardening đã do user apply thủ công',
  'SQL_APPLIED_BY_CODEX: NO',
  'centers_environment_check',
  'centers_status_check',
  'centers_slug_environment_unique_idx',
  '`dreamhome`: `name = DreamHome`, `slug = dreamhome`, `environment = staging`, `status = active`',
  '`dreamhome_prod`: `name = DreamHome`, `slug = dreamhome`, `environment = production`, `status = active`',
  'govap_prod',
  'quan12_prod',
  'add center, not clone',
  'Một link chung, account/membership quyết định center',
  'URL based security: NO',
  'Không tạo Gò Vấp',
  'Không tạo Quận 12',
  'Không xóa/migrate Angel Wings',
  'Runtime: none in C6.3E',
  'C6.4 minimal owner/admin role binding vẫn deferred',
  'C6.5 Internal Center Console vẫn deferred',
  'C7 vẫn deferred',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(srcAuth, 'resolveActiveCenterMembership')
assertIncludes(srcAuth, ".from('center_members')")
assertIncludes(srcMain, 'setCurrentStorageCenterId(resolvedMembership.centerId)')
assertIncludes(srcMain, 'activeNotificationDataCenterId')
assertIncludes(srcMain, 'getCenterScopedNotificationsForRender()')

assertNotIncludes(srcMain, 'Thêm cơ sở')
assertNotIncludes(srcMain, 'username login')
assertNotIncludes(srcMain, 'Teacher Portal')
assertNotIncludes(srcMain, 'Super Admin')

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
  'docs/supabase-c6-3c-verify-centers-schema-hardening-applied.md',
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
  'src/main.js',
  'src/styles.css',
  'tests/supabase-c6-5b-hidden-route-skeleton-owner-guard-smoke.js',
  'tests/supabase-c6-5c-centers-list-readonly-smoke.js',
  'tests/supabase-c6-5d-checkpoint-review-internal-center-console-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.3E scope: ${changedPath}`)
  assert(!/c6-4(?![abcdef])|c6-5(?![abcd])|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.3E must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(path.join(root, 'tests', 'supabase-c6-3e-checkpoint-review-multi-center-foundation-smoke.js'))

console.log('C6.3E smoke: PASS')
