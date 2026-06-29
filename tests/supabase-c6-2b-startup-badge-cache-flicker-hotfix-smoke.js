import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-2b-startup-badge-cache-flicker-hotfix.md')
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

assert(fs.existsSync(docPath), 'C6.2B docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)

;[
  'C6.2B STATUS: STARTUP BADGE CACHE FLICKER HOTFIX',
  'PRODUCTION_CENTER_ID: dreamhome_prod',
  'STAGING_CENTER_ID: dreamhome',
  'STARTUP_BADGE_FLICKER_FIXED: YES',
  'BADGES_GATED_UNTIL_CENTER_READY: YES',
  'INVENTORY_BADGE_CENTER_AWARE: YES',
  'PRODUCTION_EMPTY_BADGE_HIDDEN: YES',
  'SIGNED_IN_PRODUCTION_READS_DREAMHOME_CACHE: NO',
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
  'Kho hàng',
  'badge đỏ `3`',
  'dreamhome_prod',
  'dreamhome',
  'center binding',
  'module badges chỉ được tính sau khi center binding sẵn sàng',
  'Kho hàng` badge chỉ hợp lệ sau khi local data đã được reload trong namespace production',
  'Production empty là trạng thái hợp lệ',
  'không seed sample',
  'không được tính từ `.dreamhome`',
  'không xóa `.dreamhome`',
  'không xóa hoặc migrate Angel Wings',
  'C6.2E checkpoint review',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(main, 'activeLocalDataCenterId')
assertIncludes(main, 'function canRenderCenterScopedModuleBadges()')
assertIncludes(main, "cloudStatus.authStatus === 'signed-in'")
assertIncludes(main, "binding.status === 'bound'")
assertIncludes(main, 'activeLocalDataCenterId === binding.currentCenterId')
assertIncludes(main, 'storageCenterId === binding.currentCenterId')
assertIncludes(main, 'activeLocalDataCenterId = getCurrentStorageCenterId()')
assertIncludes(main, 'canRenderCenterScopedModuleBadges()')
assertIncludes(main, 'getUnreadNotificationCountsByModule(getCenterScopedNotificationsForRender())')
assertIncludes(main, ': {}')
assertIncludes(main, 'setCurrentStorageCenterId(resolvedMembership.centerId)')
assertIncludes(main, 'useSampleFallback: !isProductionCenter(resolvedMembership.centerId)')

assertNotIncludes(main, 'Cloud trống (production empty center)')
assertNotIncludes(main, '/internal/centers')
assertNotIncludes(main, 'Thêm cơ sở')
assertNotIncludes(main, 'username login')
assertNotIncludes(main, 'Teacher Portal')
assertNotIncludes(main, 'Super Admin')

const setTimeoutHacks = main.match(/setTimeout\([^)]*(badge|notification|inventory|module)/gi) || []
assert.strictEqual(setTimeoutHacks.length, 0, 'C6.2B must not use setTimeout badge/inventory/module hacks')

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
  'tests/supabase-c6-2a-online-local-production-staging-qa-audit-smoke.js',
  'tests/supabase-c6-2b-startup-badge-cache-flicker-hotfix-smoke.js',
  'tests/supabase-c6-2b-1-truy-nguon-badge-3-thong-bao-kho-hang-smoke.js',
  'tests/supabase-c6-2e-checkpoint-review-production-staging-hardening-smoke.js',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.2B scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath), `C6.2B must not add SQL: ${changedPath}`)
  assert(!/c6-3|c6-4|c6-5|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.2B must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)

console.log('C6.2B smoke: PASS')
