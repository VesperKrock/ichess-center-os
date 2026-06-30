import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-2b-1-truy-nguon-badge-3-thong-bao-kho-hang.md')
const mainPath = path.join(root, 'src', 'main.js')
const sampleInventoryRequestPath = path.join(root, 'src', 'inventory-request-data.js')

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

assert(fs.existsSync(docPath), 'C6.2B.1 docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const sampleInventoryRequests = readUtf8(sampleInventoryRequestPath)

;[
  'C6.2B.1 STATUS: TRACE FIX BADGE 3 NOTIFICATION INVENTORY SOURCE',
  'PRODUCTION_CENTER_ID: dreamhome_prod',
  'STAGING_CENTER_ID: dreamhome',
  'C6_2B_MANUAL_QA_FAILED: YES',
  'DEVTOOLS_EVIDENCE_DREAMHOME_PROD_NOTIFICATIONS_EMPTY: YES',
  'DEVTOOLS_EVIDENCE_DREAMHOME_STAGING_NOTIFICATIONS_EXIST: YES',
  'BADGE_THREE_SOURCE_TRACED: YES',
  'STARTUP_BADGE_FLICKER_FIXED: YES',
  'BELL_BADGE_CENTER_AWARE: YES',
  'INVENTORY_BADGE_CENTER_AWARE: YES',
  'BADGES_GATED_UNTIL_CENTER_READY: YES',
  'PRODUCTION_EMPTY_BADGE_HIDDEN: YES',
  'SIGNED_IN_PRODUCTION_READS_DREAMHOME_CACHE: NO',
  'PRODUCTION_EMPTY_SEEDS_DEMO_NOTIFICATIONS: NO',
  'ANGEL_WINGS_DELETED: NO',
  'ANGEL_WINGS_MIGRATED: NO',
  'DREAMHOME_CACHE_DELETED: NO',
  'DREAMHOME_CACHE_MIGRATED: NO',
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
  'C6.2B manual QA failed',
  'DevTools',
  'ichessCenterOS.notifications.dreamhome_prod = []',
  'ichessCenterOS.notifications.dreamhome = [...]',
  '`Kho hàng` badge và chuông tổng cùng hiện `3`',
  'sampleInventoryRequests` có đúng 3 request',
  'sync `notifications` trước khi reload `inventoryRequests`',
  'reload inventory trước khi gọi `syncAppNotifications()`',
  'activeNotificationDataCenterId',
  'getCenterScopedNotificationsForRender()',
  'không xóa hay migrate các key này',
  'C6.3',
  'C6.4',
  'C6.5',
  'C7',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(sampleInventoryRequests, "status: 'new'")
assertIncludes(sampleInventoryRequests, "status: 'pending'")
assertIncludes(sampleInventoryRequests, "status: 'preparing'")
assertIncludes(sampleInventoryRequests, "status: 'fulfilled'")

assertIncludes(main, 'activeNotificationDataCenterId')
assertIncludes(main, 'getCenterScopedNotificationsForRender()')
assertIncludes(main, 'activeNotificationDataCenterId === binding.currentCenterId')
assertIncludes(main, 'countUnreadNotifications(getCenterScopedNotificationsForRender())')
assertIncludes(main, 'filterNotifications(getCenterScopedNotificationsForRender(),')
assertIncludes(main, 'const renderableNotifications = getCenterScopedNotificationsForRender()')
assertIncludes(main, 'getUnreadNotificationCountsByModule(getCenterScopedNotificationsForRender())')

const reloadStart = main.indexOf('function reloadLocalDataForResolvedCenter')
const reloadEnd = main.indexOf('function render()', reloadStart)
assert(reloadStart >= 0 && reloadEnd > reloadStart, 'reloadLocalDataForResolvedCenter block must exist')
const reloadBlock = main.slice(reloadStart, reloadEnd)
const inventoryReloadIndex = reloadBlock.indexOf('inventoryRequests = getStoredInventoryRequests')
const notificationSyncIndex = reloadBlock.indexOf('notifications = syncAppNotifications')
assert(inventoryReloadIndex >= 0, 'reload must load inventoryRequests')
assert(notificationSyncIndex >= 0, 'reload must sync notifications')
assert(
  inventoryReloadIndex < notificationSyncIndex,
  'C6.2B.1 regression: inventoryRequests must reload before syncAppNotifications',
)

assertNotIncludes(main, 'filterNotifications(notifications,')
assertNotIncludes(main, 'countUnreadNotifications(notifications)')
assertNotIncludes(main, 'notifications.length - unreadCount')
assertNotIncludes(main, 'Cloud trống (production empty center)')
assertNotIncludes(main, '/internal/centers')
assertNotIncludes(main, 'Thêm cơ sở')
assertNotIncludes(main, 'username login')
assertNotIncludes(main, 'Teacher Portal')
assertNotIncludes(main, 'Super Admin')
assertNotIncludes(main, '.module-notification-badge { display: none')
assertNotIncludes(main, '.notification-badge { display: none')

const setTimeoutHacks = main.match(/setTimeout\([^)]*(badge|notification|inventory|module)/gi) || []
assert.strictEqual(setTimeoutHacks.length, 0, 'C6.2B.1 must not use setTimeout badge/inventory/module hacks')

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
  'tests/supabase-c6-0-production-readiness-audit-truoc-dreamhome-production-smoke.js',
  'tests/supabase-c6-1a-thiet-ke-dreamhome-production-empty-center-smoke.js',
  'tests/supabase-c6-1b-readonly-verification-pack-dreamhome-production-empty-center-smoke.js',
  'tests/supabase-c6-1c-production-staging-split-them-co-so-trong-smoke.js',
  'tests/supabase-c6-1d-account-based-center-resolver-cache-guard-smoke.js',
  'tests/supabase-c6-1d-1-taskbar-profile-wording-polish-smoke.js',
  'tests/supabase-c6-1e-checkpoint-review-dreamhome-production-empty-center-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.2B.1 scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath) || /supabase-c6-3(b-(readonly-inspect-centers-schema|manual-apply-centers-schema-hardening-template)|c-readonly-verify-centers-schema-hardening-applied)\.sql$/i.test(changedPath), `C6.2B.1 must not add SQL: ${changedPath}`)
  assert(!/c6-3(?![abcde])|c6-4|c6-5|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.2B.1 must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)

console.log('C6.2B.1 smoke: PASS')
