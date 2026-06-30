import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-4e-runtime-manual-qa-owner-login.md')

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

assert(fs.existsSync(docPath), 'C6.4E docs must exist')

const docs = readUtf8(docPath)
const srcMain = readUtf8(path.join(root, 'src', 'main.js'))
const accessControl = readUtf8(path.join(root, 'src', 'online-access-control.js'))
const auth = readUtf8(path.join(root, 'src', 'supabase-auth.js'))

;[
  'C6.4E STATUS: RUNTIME MANUAL QA OWNER LOGIN',
  'C6_4D_STATUS: PASS',
  'OWNER_MEMBERSHIP_VERIFIED: YES',
  'OWNER_EMAIL: owner.duchai@ichess.vn',
  'OWNER_AUTH_USER_ID: 9683b2c8-3970-4eac-99b3-985d503bdeb9',
  'TARGET_CENTER_ID: dreamhome_prod',
  'TARGET_ROLE: owner',
  'TARGET_MEMBERSHIP_STATUS: active',
  'OWNER_ROLE_RUNTIME_REVIEWED: YES',
  'OWNER_ROLE_RUNTIME_SUPPORTED: YES',
  'CENTER_RESOLVER_RUNTIME_REVIEWED: YES',
  'SIGNED_IN_MEMBERSHIP_WINS_OVER_HARDCODE: YES',
  'PRODUCTION_STAGING_SEPARATION_REVIEWED: YES',
  'BADGE_THREE_FIX_STILL_REQUIRED: YES',
  'INTERNAL_CENTER_CONSOLE_EXPECTED_NOW: NO',
  'CENTER_LIST_UI_EXPECTED_NOW: NO',
  'ADD_CENTER_BUTTON_EXPECTED_NOW: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED_BY_CODEX: NO',
  'MEMBERSHIP_CREATED_BY_CODEX: NO',
  'NEW_CENTER_CREATED: NO',
  'ANGEL_WINGS_DELETED: NO',
  'ANGEL_WINGS_MIGRATED: NO',
  'RUNTIME_CHANGE: NO',
  'C6_5_INTERNAL_CONSOLE_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'owner.duchai@ichess.vn',
  '9683b2c8-3970-4eac-99b3-985d503bdeb9',
  'dreamhome_prod',
  'role `owner`',
  'status = active',
  'OWNER_ROLE_RUNTIME_SUPPORTED: YES',
  'resolveActiveCenterMembership',
  'setCurrentStorageCenterId',
  '.dreamhome_prod',
  '.dreamhome',
  'Không thấy Angel Wings',
  'Không thấy 29 học viên staging',
  'activeNotificationDataCenterId',
  'getCenterScopedNotificationsForRender()',
  'không badge đỏ `3`',
  'chưa có Internal Center Console là đúng',
  'chưa có danh sách centers là đúng',
  'C6.4E.1 minimal owner runtime support',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(accessControl, "OWNER: 'owner'")
assertIncludes(accessControl, 'ONLINE_ACCESS_ROLES.OWNER')
assertIncludes(accessControl, 'CLOUD_WRITE_ROLES')
assertIncludes(accessControl, 'CLOUD_READ_ROLES')
assertIncludes(auth, 'resolveActiveCenterMembership')
assertIncludes(auth, ".from('center_members')")
assertIncludes(auth, ".eq('status', 'active')")
assertIncludes(srcMain, 'setCurrentStorageCenterId(resolvedMembership.centerId)')
assertIncludes(srcMain, 'useSampleFallback: !isProductionCenter(resolvedMembership.centerId)')
assertIncludes(srcMain, 'activeNotificationDataCenterId')
assertIncludes(srcMain, 'getCenterScopedNotificationsForRender()')
assertIncludes(srcMain, 'inventoryRequests = getStoredInventoryRequests')
assertIncludes(srcMain, 'notifications = syncAppNotifications')

assertNotIncludes(srcMain, 'Thêm cơ sở')
assertNotIncludes(srcMain, 'username login')
assertNotIncludes(srcMain, 'Teacher Portal')
assertNotIncludes(srcMain, 'Super Admin')

const diffNames = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
})

const changedFiles = diffNames.split(/\r?\n/).filter(Boolean).map((fileName) => fileName.replace(/\\/g, '/'))
const c65bStarted = fs.existsSync(path.join(root, 'docs', 'supabase-c6-5b-hidden-route-skeleton-owner-guard.md'))

if (!c65bStarted) {
  assert(!changedFiles.some((fileName) => fileName.startsWith('src/')), 'C6.4E RUNTIME_CHANGE: NO means no src diff before C6.5B')
} else {
  assert(changedFiles.includes('src/main.js'), 'C6.5B runtime route should live in src/main.js')
  assert(changedFiles.includes('src/styles.css'), 'C6.5B minimal styles should live in src/styles.css')
}

const status = execFileSync('git', ['status', '--short'], {
  cwd: root,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  'docs/supabase-c6-4a-minimal-owner-admin-role-binding-audit-design.md',
  'docs/supabase-c6-4b-owner-membership-readiness-provisioning-pack.md',
  'docs/supabase-c6-4b-readonly-inspect-owner-membership-readiness.sql',
  'docs/supabase-c6-4b-manual-apply-owner-membership-template.sql',
  'docs/supabase-c6-4c-owner-membership-apply-decision-ready.md',
  'docs/supabase-c6-4d-verify-owner-membership-applied.md',
  'docs/supabase-c6-4e-runtime-manual-qa-owner-login.md',
  'tests/supabase-c6-4a-minimal-owner-admin-role-binding-audit-design-smoke.js',
  'tests/supabase-c6-4b-owner-membership-readiness-provisioning-pack-smoke.js',
  'tests/supabase-c6-4c-owner-membership-apply-decision-ready-smoke.js',
  'tests/supabase-c6-4d-verify-owner-membership-applied-smoke.js',
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
  'tests/supabase-c6-3a-multi-center-foundation-audit-design-smoke.js',
  'tests/supabase-c6-3b-centers-schema-hardening-provisioning-pack-smoke.js',
  'tests/supabase-c6-3c-verify-centers-schema-hardening-applied-smoke.js',
  'tests/supabase-c6-3d-runtime-readiness-audit-sau-centers-schema-hardening-smoke.js',
  'tests/supabase-c6-3e-checkpoint-review-multi-center-foundation-smoke.js',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.4E scope: ${changedPath}`)
  assert(!/c6-4(?![abcdef])|c6-5(?![abcd])|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.4E must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(path.join(root, 'tests', 'supabase-c6-4e-runtime-manual-qa-owner-login-smoke.js'))

console.log('C6.4E smoke: PASS')
