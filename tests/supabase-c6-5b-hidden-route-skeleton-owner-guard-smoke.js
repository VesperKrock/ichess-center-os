import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-5b-hidden-route-skeleton-owner-guard.md')
const smokePath = path.join(root, 'tests', 'supabase-c6-5b-hidden-route-skeleton-owner-guard-smoke.js')
const mainPath = path.join(root, 'src', 'main.js')
const stylesPath = path.join(root, 'src', 'styles.css')
const c65cDocPath = path.join(root, 'docs', 'supabase-c6-5c-centers-list-readonly.md')
const c65cStarted = fs.existsSync(c65cDocPath)

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
    '\uFFFD',
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

assert(fs.existsSync(docPath), 'C6.5B docs must exist')
assert(fs.existsSync(mainPath), 'main runtime must exist')
assert(fs.existsSync(stylesPath), 'styles runtime must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C6.5B STATUS: HIDDEN ROUTE SKELETON OWNER GUARD',
  'C6_5A_STATUS: PASS',
  'HIDDEN_ROUTE_IMPLEMENTED: YES',
  'HIDDEN_ROUTE: #/internal/centers',
  'OWNER_GUARD_IMPLEMENTED: YES',
  'OWNER_ONLY_ACCESS_IMPLEMENTED: YES',
  'SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'INTERNAL_CENTER_CONSOLE_SKELETON_IMPLEMENTED: YES',
  'CENTERS_LIST_QUERY_IMPLEMENTED: NO',
  'CENTERS_LIST_READONLY_IMPLEMENTED: NO',
  'ADD_CENTER_IMPLEMENTED: NO',
  'ACTING_MODE_IMPLEMENTED: NO',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'NEW_CENTER_CREATED: NO',
  'ANGEL_WINGS_DELETED: NO',
  'ANGEL_WINGS_MIGRATED: NO',
  'RUNTIME_CHANGE: YES',
  'RUNTIME_CHANGE_SCOPE: HIDDEN_ROUTE_SKELETON_OWNER_GUARD_ONLY',
  'C6_5C_STARTED: NO',
  'C6_6_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.5B',
  '## 2. Trạng thái sau C6.5A',
  '## 3. Runtime changes summary',
  '## 4. Hidden route implemented',
  '## 5. Owner guard implemented',
  '## 6. Signed-out behavior',
  '## 7. Non-owner behavior',
  '## 8. Owner skeleton behavior',
  '## 9. Vì sao chưa query centers list',
  '## 10. Vì sao chưa có nút Thêm cơ sở',
  '## 11. Vì sao chưa acting mode',
  '## 12. Manual QA checklist',
  '## 13. Risk list',
  '## 14. C6.5C dependency',
  '## 15. C6.6 deferred',
  '## 16. C7 deferred',
  '## 17. PASS / NEEDS REVIEW criteria',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(main, "'#/internal/centers'", 'runtime hidden route hash')
assertIncludes(main, 'hashchange', 'runtime hashchange listener')
assertIncludes(main, 'ONLINE_ACCESS_ROLES.OWNER', 'runtime owner-only guard')
assertIncludes(main, "membershipStatus === 'active'", 'runtime active membership guard')
assertIncludes(main, 'Quản trị nội bộ', 'runtime owner skeleton')
assertIncludes(main, 'Internal Center Console', 'runtime internal console copy')
assertIncludes(main, 'Bạn không có quyền truy cập khu vực nội bộ.', 'runtime access denied text')
assertIncludes(main, 'renderInternalCenterConsoleSkeleton', 'runtime skeleton renderer')
assertIncludes(main, 'renderInternalCenterConsoleDenied', 'runtime denied renderer')
assertIncludes(main, 'renderDashboard()', 'dashboard default route remains available')
assertIncludes(styles, '.internal-console-screen', 'internal console styles')
assertIncludes(styles, '.internal-console-panel', 'internal console panel styles')

if (!c65cStarted) {
  assertNotIncludes(main, 'renderCentersList', 'centers list renderer must wait for C6.5C')
  assertNotIncludes(main, 'listCenters', 'centers list query must wait for C6.5C')
  assertNotIncludes(main, '.from(\'centers\')', 'must not query public.centers in C6.5B')
  assertNotIncludes(main, '.from("centers")', 'must not query public.centers in C6.5B')
} else {
  assertIncludes(main, "from('centers')", 'C6.5C readonly centers query')
  assertIncludes(main, 'id,name,slug,environment,status,created_at,updated_at', 'C6.5C centers select fields')
  assertIncludes(main, ".eq('environment', 'production')", 'C6.5C production filter')
  assertIncludes(main, ".eq('status', 'active')", 'C6.5C active filter')
  assert(!/\.from\('centers'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'C6.5C must not mutate public.centers')
}
assertNotIncludes(main, 'acting mode', 'acting mode must not be in runtime')
assertNotIncludes(main, 'username login', 'C7 username UI must not be in runtime')
assertNotIncludes(main, 'Super Admin', 'Super Admin advanced must not be in runtime')

const diffNames = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
})
const changedFiles = diffNames.split(/\r?\n/).filter(Boolean).map((fileName) => fileName.replace(/\\/g, '/'))
const changedSrcFiles = changedFiles.filter((fileName) => fileName.startsWith('src/'))
assert(
  changedSrcFiles.length === 0 ||
    JSON.stringify(changedSrcFiles.sort()) === JSON.stringify(['src/main.js', 'src/styles.css']),
  'C6.5B runtime diff must be committed or stay in main.js/styles.css only',
)

const allowedChangedPaths = new Set([
  'docs/supabase-c6-5a-internal-center-console-audit-design.md',
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
  'docs/supabase-c6-6d-1-doi-target-test-phong-trong.md',
  'docs/supabase-c6-6e-runtime-add-center-form-rpc.md',
  'docs/supabase-c6-6c-manual-apply-provision-center-rpc.sql',
  'docs/supabase-c6-6c-rpc-apply-decision-ready.md',
  'docs/supabase-c6-6b-readonly-inspect-add-center-provisioning-readiness.sql',
  'docs/supabase-c6-6b-provisioning-rpc-design-inspection-pack.md',
  'src/main.js',
  'src/styles.css',
  'tests/supabase-c6-5a-internal-center-console-audit-design-smoke.js',
  'tests/supabase-c6-5b-hidden-route-skeleton-owner-guard-smoke.js',
  'tests/supabase-c6-5c-centers-list-readonly-smoke.js',
  'tests/supabase-c6-5d-checkpoint-review-internal-center-console-smoke.js',
  'tests/supabase-c6-6a-them-co-so-mot-truong-audit-design-smoke.js',
  'tests/supabase-c6-6b-provisioning-rpc-design-inspection-pack-smoke.js',
  'tests/supabase-c6-6c-rpc-apply-decision-ready-smoke.js',
  'tests/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack-smoke.js',
  'tests/supabase-c6-6d-1-doi-target-test-phong-trong-smoke.js',
  'tests/supabase-c6-6e-runtime-add-center-form-rpc-smoke.js',
])

for (const fileName of fs.readdirSync(path.join(root, 'tests'))) {
  if (/^supabase-c6-.*-smoke\.js$/.test(fileName)) {
    allowedChangedPaths.add(`tests/${fileName}`)
  }
}

const status = execFileSync('git', ['status', '--short'], {
  cwd: root,
  encoding: 'utf8',
})

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.5B scope: ${changedPath}`)
  assert(!/c6-5(?![abcd])|c6-6(?![abcde])|c7|teacher-portal|super-admin/i.test(changedPath), `C6.5B must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(smokePath)
assertNoMojibake(mainPath)

console.log('C6.5B smoke: PASS')
