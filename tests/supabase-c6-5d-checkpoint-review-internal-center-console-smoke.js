import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-5d-checkpoint-review-internal-center-console.md')
const smokePath = path.join(root, 'tests', 'supabase-c6-5d-checkpoint-review-internal-center-console-smoke.js')
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
    '\uFFFD',
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

assert(fs.existsSync(docPath), 'C6.5D docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)

;[
  'C6.5D STATUS: CHECKPOINT REVIEW INTERNAL CENTER CONSOLE',
  'C6_5A_STATUS: PASS',
  'C6_5B_STATUS: PASS',
  'C6_5C_STATUS: PASS',
  'C6_5B_MANUAL_QA: PASS',
  'C6_5C_MANUAL_QA: PASS',
  'INTERNAL_CENTER_CONSOLE_AVAILABLE: YES',
  'HIDDEN_ROUTE: #/internal/centers',
  'OWNER_GUARD_ACTIVE: YES',
  'OWNER_ONLY_ACCESS: YES',
  'CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'CENTERS_LIST_READONLY_AVAILABLE: YES',
  'CENTERS_LIST_DEFAULT_FILTER_ENVIRONMENT: production',
  'CENTERS_LIST_DEFAULT_FILTER_STATUS: active',
  'DREAMHOME_PROD_VISIBLE: YES',
  'STAGING_DREAMHOME_VISIBLE_IN_DEFAULT_LIST: NO',
  'ADD_CENTER_IMPLEMENTED: NO',
  'ADD_CENTER_DEFERRED_TO_C6_6: YES',
  'ADD_CENTER_UX_ONE_VISIBLE_REQUIRED_FIELD_DESIGNED: YES',
  'ADD_CENTER_VISIBLE_REQUIRED_FIELD: Tên cơ sở',
  'ACTING_MODE_IMPLEMENTED: NO',
  'ACTING_MODE_DEFERRED_TO_C7_4: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'NEW_CENTER_CREATED: NO',
  'ANGEL_WINGS_DELETED: NO',
  'ANGEL_WINGS_MIGRATED: NO',
  'RUNTIME_CHANGE_NEW_IN_C6_5D: NO',
  'C6_6_STARTED: NO',
  'C7_STARTED: NO',
  'READY_FOR_C6_5E_COMMIT_PUSH: YES',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.5D',
  '## 2. Trạng thái trước checkpoint',
  '## 3. Tổng hợp C6.5A',
  '## 4. Tổng hợp C6.5B',
  '## 5. Tổng hợp C6.5C',
  '## 6. Manual QA C6.5B PASS',
  '## 7. Manual QA C6.5C PASS',
  '## 8. Internal Center Console hiện tại',
  '## 9. Owner guard hiện tại',
  '## 10. Centers list readonly hiện tại',
  '## 11. Production/staging behavior',
  '## 12. Vì sao dreamhome staging không hiện mặc định',
  '## 13. Vì sao chưa có Add center',
  '## 14. UX định hướng cho Add center C6.6',
  '## 15. Vì sao chưa có acting mode',
  '## 16. Files changed summary',
  '## 17. Risk list',
  '## 18. C6.6 dependency',
  '## 19. C7 deferred',
  '## 20. PASS / NEEDS REVIEW criteria',
  '## 21. Recommendation sang C6.5E commit/push',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'Manual QA C6.5C: PASS',
  'Owner account: owner.duchai@ichess.vn',
  'Route: #/internal/centers',
  'Visible center: DreamHome',
  'Visible center_id: dreamhome_prod',
  'Visible slug: dreamhome',
  'Visible environment: production',
  'Visible status: active',
  'Staging dreamhome visible by default: NO',
  'Add center button visible: NO',
  'Acting mode visible: NO',
  'DreamHome / dreamhome_prod / production / active',
  '`dreamhome` là staging/test sandbox',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'Anh Hải chỉ cần nhập Tên cơ sở.',
  'Hệ thống tự sinh slug.',
  'Hệ thống tự sinh center_id dạng `<slug>_prod`.',
  'Hệ thống đặt `environment=production`.',
  'Hệ thống đặt `status=active`.',
  'Hệ thống tạo "ngôi nhà trống".',
  'Owner membership cho owner hiện tại cần được tạo/đảm bảo theo checklist.',
  'Nếu slug/id trùng, UI phải báo rõ và gợi ý tên/mã khác.',
  'C6.5D không implement Add center.',
  'C6.6 mới làm Add center provisioning flow.',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(main, "'#/internal/centers'", 'hidden route remains')
assertIncludes(main, 'ONLINE_ACCESS_ROLES.OWNER', 'owner guard remains')
assertIncludes(main, "from('centers')", 'C6.5C readonly centers query remains')
assertIncludes(main, ".eq('environment', 'production')", 'production filter remains')
assertIncludes(main, ".eq('status', 'active')", 'active filter remains')
assert(!/\.from\('centers'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not mutate public.centers')
assertNotIncludes(main, 'acting mode', 'runtime acting mode')
assertNotIncludes(main, 'Acting as', 'runtime acting entry')
assertNotIncludes(main, 'username login', 'C7 username UI')
assertNotIncludes(main, 'Super Admin', 'Super Admin advanced')

const diffNames = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
})
const changedFiles = diffNames.split(/\r?\n/).filter(Boolean).map((fileName) => fileName.replace(/\\/g, '/'))
const changedSrcFiles = changedFiles.filter((fileName) => fileName.startsWith('src/'))
assert(
  changedSrcFiles.length === 0 ||
    JSON.stringify(changedSrcFiles.sort()) === JSON.stringify(['src/main.js', 'src/styles.css']),
  'C6.5D must not add runtime diff beyond existing C6.5B/C files',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.5D scope: ${changedPath}`)
  assert(!/c6-5(?![abcd])|c6-6(?![abcde])|c7|teacher-portal|super-admin/i.test(changedPath), `C6.5D must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(smokePath)
assertNoMojibake(mainPath)

console.log('C6.5D smoke: PASS')
