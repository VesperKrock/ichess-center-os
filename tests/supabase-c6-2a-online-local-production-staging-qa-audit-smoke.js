import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-2a-online-local-production-staging-qa-audit.md')

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

assert(fs.existsSync(docPath), 'C6.2A docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(path.join(root, 'src', 'main.js'))
const appCenterBinding = readUtf8(path.join(root, 'src', 'app-center-binding.js'))
const storage = readUtf8(path.join(root, 'src', 'storage.js'))

;[
  'C6.2A STATUS: ONLINE LOCAL PRODUCTION STAGING QA AUDIT',
  'LATEST_C6_COMMIT: 542ddf2',
  'PRODUCTION_CENTER_ID: dreamhome_prod',
  'STAGING_CENTER_ID: dreamhome',
  'ANGEL_WINGS_KEPT_AS_TEST_SANDBOX: YES',
  'PRODUCTION_EMPTY_EXPECTED: YES',
  'LOCAL_STORAGE_NAMESPACE_SEPARATION_REQUIRED: YES',
  'SIGNED_IN_MEMBERSHIP_WINS_OVER_HARDCODE: YES',
  'GITHUB_PAGES_DEPLOY_QA_REQUIRED: YES',
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
  'C6.2 - Production/staging separation hardening + online QA - CURRENT',
  'C6.3 - Multi-center foundation - NEXT',
  'C6.4 - Minimal owner/admin role binding - DEFERRED',
  'C6.5 - Internal Center Console - DEFERRED',
  'C7 - Account/permission/portal system - DEFERRED',
  'GitHub Pages',
  'index-CNHhNFOp.js',
  'index-DfpCLjpD.css',
  'admin.dreamhome@ichess.vn',
  'Không thấy 29 học viên staging',
  'Không thấy Angel Wings',
  'Cơ sở: DreamHome',
  'Object.keys(localStorage)',
  'key.includes("ichessCenterOS")',
  'key.includes("dreamhome_prod")',
  'user thuộc center `dreamhome`',
  'Hardcode `dreamhome` classification',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(main, 'getCurrentResolvedCenterId')
assertIncludes(main, 'resolveActiveCenterMembership')
assertIncludes(appCenterBinding, "source: 'account-membership'")
assertIncludes(storage, 'createCenterScopedStorageKey')

assertNotIncludes(main, 'Cloud trống (production empty center)')
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
  'src/main.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.2A scope: ${changedPath}`)
  assert(!/\.sql$/i.test(changedPath), `C6.2A must not add SQL: ${changedPath}`)
  assert(!/c6-3|c6-4|c6-5|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.2A must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(path.join(root, 'src', 'main.js'))
assertNoMojibake(path.join(root, 'src', 'app-center-binding.js'))
assertNoMojibake(path.join(root, 'src', 'storage.js'))

console.log('C6.2A smoke: PASS')
