import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-2e-checkpoint-review-production-staging-hardening.md')
const mainPath = path.join(root, 'src', 'main.js')

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

assert(fs.existsSync(docPath), 'C6.2E docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)

;[
  'C6.2E STATUS: CHECKPOINT REVIEW BEFORE COMMIT PUSH',
  'LATEST_C6_COMMIT: 542ddf2',
  'C6_2A_STATUS: PASS',
  'C6_2B_STATUS: SUPERSEDED_BY_C6_2B_1',
  'C6_2B_MANUAL_QA_FAILED: YES',
  'C6_2B_1_STATUS: PASS',
  'BADGE_THREE_SOURCE_TRACED: YES',
  'BADGE_THREE_ROOT_CAUSE: NOTIFICATION_SYNC_BEFORE_INVENTORY_RELOAD',
  'PRODUCTION_CENTER_ID: dreamhome_prod',
  'STAGING_CENTER_ID: dreamhome',
  'ANGEL_WINGS_KEPT_AS_TEST_SANDBOX: YES',
  'PRODUCTION_EMPTY_EXPECTED: YES',
  'LOCAL_STORAGE_NAMESPACE_SEPARATION_REQUIRED: YES',
  'SIGNED_IN_MEMBERSHIP_WINS_OVER_HARDCODE: YES',
  'BELL_BADGE_CENTER_AWARE: YES',
  'INVENTORY_BADGE_CENTER_AWARE: YES',
  'PRODUCTION_EMPTY_BADGE_HIDDEN: YES',
  'MANUAL_QA_RELOAD_BADGE_REQUIRED_BEFORE_C6_2F: YES',
  'RUNTIME_CHANGE: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'C6_3_STARTED: NO',
  'C6_4_STARTED: NO',
  'C6_5_INTERNAL_CONSOLE_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'C6.2B CodeX report PASS nhưng manual QA failed',
  'C6.2B.1 PASS và supersedes C6.2B',
  'NOTIFICATION_SYNC_BEFORE_INVENTORY_RELOAD',
  'Reload `inventoryRequests` trước `syncAppNotifications()`',
  'activeNotificationDataCenterId',
  'getCenterScopedNotificationsForRender()',
  'dreamhome_prod',
  'dreamhome',
  'Angel Wings',
  'Namespace separation',
  'Bell/notification badge',
  'Inventory/Kho hàng badge',
  'Reload 5-10 lần',
  'không C6.2F, tạo C6.2B.2',
  'C6.3 multi-center foundation chưa mở',
  'C6.4 minimal owner/admin role binding chưa mở',
  'C6.5 Internal Center Console chưa mở',
  'C7 account/permission/portal system chưa mở',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(main, 'activeNotificationDataCenterId')
assertIncludes(main, 'getCenterScopedNotificationsForRender()')
assertIncludes(main, 'inventoryRequests = getStoredInventoryRequests')
assertIncludes(main, 'notifications = syncAppNotifications')

assertNotIncludes(main, 'Thêm cơ sở')
assertNotIncludes(main, 'username login')
assertNotIncludes(main, 'Teacher Portal')
assertNotIncludes(main, 'Super Admin')

const status = execFileSync('git', ['status', '--short'], {
  cwd: root,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  'src/main.js',
  'docs/supabase-c6-2a-online-local-production-staging-qa-audit.md',
  'docs/supabase-c6-2b-startup-badge-cache-flicker-hotfix.md',
  'docs/supabase-c6-2b-1-truy-nguon-badge-3-thong-bao-kho-hang.md',
  'docs/supabase-c6-2e-checkpoint-review-production-staging-hardening.md',
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
  'tests/supabase-c6-2a-online-local-production-staging-qa-audit-smoke.js',
  'tests/supabase-c6-2b-startup-badge-cache-flicker-hotfix-smoke.js',
  'tests/supabase-c6-2b-1-truy-nguon-badge-3-thong-bao-kho-hang-smoke.js',
  'tests/supabase-c6-2e-checkpoint-review-production-staging-hardening-smoke.js',
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
  'docs/supabase-c6-5a-internal-center-console-audit-design.md',
  'tests/supabase-c6-5a-internal-center-console-audit-design-smoke.js',
  'docs/supabase-c6-5b-hidden-route-skeleton-owner-guard.md',
  'docs/supabase-c6-5c-centers-list-readonly.md',
  'docs/supabase-c6-5d-checkpoint-review-internal-center-console.md',
  'src/styles.css',
  'tests/supabase-c6-5b-hidden-route-skeleton-owner-guard-smoke.js',
  'tests/supabase-c6-5c-centers-list-readonly-smoke.js',
  'tests/supabase-c6-5d-checkpoint-review-internal-center-console-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.2E scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath) || /supabase-c6-(3(b-(readonly-inspect-centers-schema|manual-apply-centers-schema-hardening-template)|c-readonly-verify-centers-schema-hardening-applied)|4b-(readonly-inspect-owner-membership-readiness|manual-apply-owner-membership-template))\.sql$/i.test(changedPath), `C6.2E must not add SQL: ${changedPath}`)
  assert(!/c6-3(?![abcde])|c6-4(?![abcdef])|c6-5(?![abcd])|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.2E must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)

console.log('C6.2E smoke: PASS')
