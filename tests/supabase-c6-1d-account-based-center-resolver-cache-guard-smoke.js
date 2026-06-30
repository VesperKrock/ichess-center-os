import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-1d-account-based-center-resolver-cache-guard.md')
const testPath = __filename

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`)
}

function assertNotIncludes(content, needle, label = needle) {
  assert(!content.includes(needle), `Unexpected ${label}`)
}

const docs = readUtf8(docPath)
const supabaseAuth = readUtf8(path.join(root, 'src', 'supabase-auth.js'))
const appCenterBinding = readUtf8(path.join(root, 'src', 'app-center-binding.js'))
const storage = readUtf8(path.join(root, 'src', 'storage.js'))
const main = readUtf8(path.join(root, 'src', 'main.js'))
const cloudBootstrap = readUtf8(path.join(root, 'src', 'cloud-bootstrap.js'))
const cloudDbSync = readUtf8(path.join(root, 'src', 'cloud-db-sync.js'))
const cloudStatus = readUtf8(path.join(root, 'src', 'cloud-status.js'))

assert(fs.existsSync(docPath), 'C6.1D docs must exist')

;[
  'C6.1D STATUS: RUNTIME MINIMAL + DOCS/SMOKE',
  'ACCOUNT_BASED_CENTER_RESOLVER: YES',
  'CENTER_MEMBERS_SOURCE_OF_TRUTH: YES',
  'PRODUCTION_CENTER_ID: dreamhome_prod',
  'HARDCODE_DREAMHOME_FOR_SIGNED_IN_USER: REMOVED',
  'PRODUCTION_EMPTY_CACHE_GUARD: YES',
  'ANGEL_WINGS_MODIFIED: NO',
  'SQL_APPLIED: NO',
  'SUPABASE_ACTION: NOT RUN',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'resolveActiveCenterMembership',
  'listActiveCenterMemberships',
  "export const PRODUCTION_CENTER_ID = 'dreamhome_prod'",
  ".from('center_members')",
  ".eq('status', 'active')",
  'getCenterDisplayName',
].forEach((needle) => assertIncludes(supabaseAuth, needle))

;[
  'source: \'account-membership\'',
  'missing-center-membership',
  'center-members-loading',
].forEach((needle) => assertIncludes(appCenterBinding, needle))
assertNotIncludes(appCenterBinding, 'single-center-fallback')

;[
  'setCurrentStorageCenterId',
  'getCurrentStorageCenterId',
  'normalizeStorageCenterId',
  'createCenterScopedStorageKey',
  'currentStorageCenterId',
].forEach((needle) => assertIncludes(storage, needle))

;[
  'resolveActiveCenterMembership',
  'setCurrentStorageCenterId',
  'reloadLocalDataForResolvedCenter',
  'getCurrentResolvedCenterId',
  'isProductionCenter',
  'PRODUCTION_CENTER_ID',
  'cloud-empty',
  'checkCloudDbReadiness(getCurrentResolvedCenterId())',
  'pullCoreEntitiesFromCloud(getCurrentResolvedCenterId())',
  'centerId: getCurrentResolvedCenterId()',
  'saveStoredAttendanceRecords(getCurrentResolvedCenterId()',
  'saveAttendanceBaselineState(getCurrentResolvedCenterId()',
].forEach((needle) => assertIncludes(main, needle))

assertNotIncludes(main, "centerId: 'dreamhome'", 'hardcoded online access center')
assertNotIncludes(main, "centerId = 'dreamhome'", 'hardcoded schedule runtime default')
assertNotIncludes(main, "saveStoredAttendanceRecords('dreamhome'", 'hardcoded attendance record save')
assertNotIncludes(main, "saveAttendanceBaselineState('dreamhome'", 'hardcoded attendance baseline save')

assertIncludes(cloudBootstrap, "return state.message || 'Dữ liệu: Cloud trống'")
assertIncludes(cloudDbSync, 'centerId = detail.centerId')
assertIncludes(cloudStatus, 'status.centerName || status.centerId')

const status = execFileSync('git', ['status', '--short'], {
  cwd: root,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
  'docs/supabase-c6-0-production-readiness-audit-truoc-dreamhome-production.md',
  'tests/supabase-c6-0-production-readiness-audit-truoc-dreamhome-production-smoke.js',
  'docs/supabase-c6-1a-thiet-ke-dreamhome-production-empty-center.md',
  'tests/supabase-c6-1a-thiet-ke-dreamhome-production-empty-center-smoke.js',
  'docs/supabase-c6-1b-readonly-verify-dreamhome-production-empty-center.sql',
  'docs/supabase-c6-1b-readonly-verification-pack-dreamhome-production-empty-center.md',
  'tests/supabase-c6-1b-readonly-verification-pack-dreamhome-production-empty-center-smoke.js',
  'docs/supabase-c6-1c-production-staging-split-them-co-so-trong.md',
  'docs/supabase-c6-1c-readonly-preflight-dreamhome-prod.sql',
  'docs/supabase-c6-1c-manual-apply-dreamhome-prod-membership-template.sql',
  'tests/supabase-c6-1c-production-staging-split-them-co-so-trong-smoke.js',
  'docs/supabase-c6-1d-account-based-center-resolver-cache-guard.md',
  'tests/supabase-c6-1d-account-based-center-resolver-cache-guard-smoke.js',
  'docs/supabase-c6-1d-1-taskbar-profile-wording-polish.md',
  'tests/supabase-c6-1d-1-taskbar-profile-wording-polish-smoke.js',
  'docs/supabase-c6-1e-checkpoint-review-dreamhome-production-empty-center.md',
  'tests/supabase-c6-1e-checkpoint-review-dreamhome-production-empty-center-smoke.js',
  'docs/supabase-c6-2a-online-local-production-staging-qa-audit.md',
  'docs/supabase-c6-2b-startup-badge-cache-flicker-hotfix.md',
  'docs/supabase-c6-2b-1-truy-nguon-badge-3-thong-bao-kho-hang.md',
  'docs/supabase-c6-2e-checkpoint-review-production-staging-hardening.md',
  'docs/supabase-c6-3a-multi-center-foundation-audit-design.md',
  'docs/supabase-c6-3b-centers-schema-hardening-provisioning-pack.md',
  'docs/supabase-c6-3b-readonly-inspect-centers-schema.sql',
  'docs/supabase-c6-3b-manual-apply-centers-schema-hardening-template.sql',
        'docs/supabase-c6-3c-readonly-verify-centers-schema-hardening-applied.sql',
        'docs/supabase-c6-4b-readonly-inspect-owner-membership-readiness.sql',
        'docs/supabase-c6-4b-manual-apply-owner-membership-template.sql',
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
  'src/styles.css',
  'src/supabase-auth.js',
  'src/app-center-binding.js',
  'src/storage.js',
  'src/main.js',
  'src/cloud-status.js',
  'src/cloud-bootstrap.js',
  'src/cloud-db-sync.js',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.1D scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath) || changedPath.includes('c6-1b') || changedPath.includes('c6-1c') || changedPath.includes('c6-3b') || changedPath.includes('c6-3c') || changedPath.includes('c6-4b'), `C6.1D must not add SQL: ${changedPath}`)
  assert(!/c7|teacher-portal|super-admin/i.test(changedPath), `C6.1D must not create C7/future-hold files: ${changedPath}`)
}

assertIncludes(readUtf8(testPath), 'C6.1D smoke: PASS')

console.log('C6.1D smoke: PASS')
