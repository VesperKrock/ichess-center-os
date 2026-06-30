import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-1d-1-taskbar-profile-wording-polish.md')
const mainPath = path.join(root, 'src', 'main.js')
const stylesPath = path.join(root, 'src', 'styles.css')

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
    String.fromCharCode(0x00c2),
    String.fromCharCode(0x00c3),
    String.fromCharCode(0x0102),
    String.fromCharCode(0xfffd),
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

assert(fs.existsSync(docPath), 'C6.1D.1 docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C6.1D.1 STATUS: TASKBAR PROFILE WORDING POLISH',
  'TASKBAR_TECHNICAL_EMPTY_TEXT_VISIBLE: NO',
  'CENTER_PROFILE_POPOVER: YES',
  'CENTER_CHIP_IS_PROFILE_ENTRY: YES',
  'PRODUCTION_EMPTY_TEXT_MOVED_OUT_OF_TASKBAR: YES',
  'CENTER_RESOLVER_CHANGED: NO',
  'CACHE_GUARD_CHANGED: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'C6_5_INTERNAL_CONSOLE_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'taskbar',
  'center/profile popover',
  'Cơ sở: DreamHome',
  'production empty center',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'isCenterProfilePopoverOpen',
  'renderCenterProfilePopover',
  'getTaskbarCenterProfileState',
  'center-profile-chip',
  'toggle-center-profile',
  'Tài khoản',
  'Vai trò',
  'Dữ liệu',
  'Trạng thái',
  'Mã cơ sở',
  'Cơ sở: ${escapeHtml(centerProfile.centerName)}',
].forEach((needle) => assertIncludes(main, needle))

assertIncludes(styles, '.center-profile-popover')
assertIncludes(styles, '.center-profile-chip')

const taskbarFunction = main.slice(main.indexOf('function renderTaskbar()'), main.indexOf('function getTaskbarWindowGroups'))
assertNotIncludes(taskbarFunction, 'getCloudBootstrapStatusLabel', 'taskbar technical data status')
assertNotIncludes(taskbarFunction, 'production empty center', 'taskbar production empty wording')
assertNotIncludes(taskbarFunction, 'Cloud trống (production empty center)', 'taskbar cloud empty wording')
assertNotIncludes(taskbarFunction, 'Vai trò: Quản lý cơ sở', 'taskbar role clutter')

assertNotIncludes(main, 'Cloud trống (production empty center)', 'runtime technical production empty wording')
assertNotIncludes(main, 'Thêm cơ sở')
assertNotIncludes(main, 'username login')
assertNotIncludes(main, 'Teacher Portal')
assertNotIncludes(main, 'Super Admin')

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
  'src/supabase-auth.js',
  'src/app-center-binding.js',
  'src/storage.js',
  'src/main.js',
  'src/styles.css',
  'src/cloud-status.js',
  'src/cloud-bootstrap.js',
  'src/cloud-db-sync.js',
  'docs/supabase-c6-5a-internal-center-console-audit-design.md',
  'tests/supabase-c6-5a-internal-center-console-audit-design-smoke.js',
  'docs/supabase-c6-5b-hidden-route-skeleton-owner-guard.md',
  'docs/supabase-c6-5c-centers-list-readonly.md',
  'docs/supabase-c6-5d-checkpoint-review-internal-center-console.md',
  'tests/supabase-c6-5b-hidden-route-skeleton-owner-guard-smoke.js',
  'tests/supabase-c6-5c-centers-list-readonly-smoke.js',
  'tests/supabase-c6-5d-checkpoint-review-internal-center-console-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.1D.1 scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath) || changedPath.includes('c6-1b') || changedPath.includes('c6-1c') || changedPath.includes('c6-3b') || changedPath.includes('c6-3c') || changedPath.includes('c6-4b'), `C6.1D.1 must not add SQL: ${changedPath}`)
  assert(!/c6-5(?![abcd])|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.1D.1 must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(mainPath)
assertNoMojibake(stylesPath)

console.log('C6.1D.1 smoke: PASS')
