import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-5a-internal-center-console-audit-design.md')
const smokePath = path.join(root, 'tests', 'supabase-c6-5a-internal-center-console-audit-design-smoke.js')

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

assert(fs.existsSync(docPath), 'C6.5A docs must exist')

const docs = readUtf8(docPath)
const srcMain = readUtf8(path.join(root, 'src', 'main.js'))
const c65bDocPath = path.join(root, 'docs', 'supabase-c6-5b-hidden-route-skeleton-owner-guard.md')
const c65bStarted = fs.existsSync(c65bDocPath)

;[
  'C6.5A STATUS: INTERNAL CENTER CONSOLE AUDIT DESIGN',
  'C6_4_DONE: YES',
  'OWNER_LOGIN_MANUAL_QA_PASS: YES',
  'INTERNAL_CENTER_CONSOLE_DESIGNED: YES',
  'HIDDEN_ROUTE_DESIGNED: YES',
  'HIDDEN_ROUTE_PROPOSAL: #/internal/centers',
  'OWNER_GUARD_DESIGNED: YES',
  'OWNER_ONLY_ACCESS_DESIGNED: YES',
  'CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'CENTERS_LIST_READONLY_DESIGNED: YES',
  'CENTERS_LIST_DEFAULT_FILTER_ENVIRONMENT: production',
  'CENTERS_LIST_DEFAULT_FILTER_STATUS: active',
  'ADD_CENTER_IMPLEMENTED: NO',
  'ADD_CENTER_DEFERRED_TO_C6_6: YES',
  'ACTING_MODE_IMPLEMENTED: NO',
  'ACTING_MODE_DEFERRED_TO_C7_4: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'NEW_CENTER_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C6_5B_STARTED: NO',
  'C6_5C_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.5A',
  '## 2. Trạng thái sau C6.4',
  '## 3. Internal Center Console là gì',
  '## 4. Internal Center Console không phải gì',
  '## 5. Actor/role được phép vào',
  '## 6. Hidden route proposal',
  '## 7. Owner guard proposal',
  '## 8. Centers list readonly design',
  '## 9. Default filter production/active',
  '## 10. Data fields dự kiến',
  '## 11. Empty/loading/error states',
  '## 12. LocalStorage/cache considerations',
  '## 13. Production/staging separation',
  '## 14. Vì sao chưa làm Add center',
  '## 15. Vì sao chưa làm acting mode',
  '## 16. C6.5B/C/D roadmap',
  '## 17. C6.6 Add center deferred',
  '## 18. C7 deferred',
  '## 19. Risk list',
  '## 20. PASS / NEEDS REVIEW criteria',
  'owner.duchai@ichess.vn',
  '9683b2c8-3970-4eac-99b3-985d503bdeb9',
  '`dreamhome_prod`',
  '`dreamhome` = staging/test sandbox',
  'Route đề xuất: `#/internal/centers`',
  '`center_admin`: không được phép vào Internal Center Console',
  'signed-out user: không được phép vào',
  'Nếu RLS hiện tại chưa cho owner đọc danh sách centers phù hợp, C6.5B/C phải dừng và báo NEEDS REVIEW',
  'không hiện nút `Thêm cơ sở` trong C6.5',
  'Acting mode defer C7.4',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'username login',
  'Teacher Portal',
  'Super Admin',
].forEach((needle) => assertNotIncludes(srcMain, needle, `runtime ${needle}`))

if (!c65bStarted) {
}

const diffNames = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
})
const changedFiles = diffNames.split(/\r?\n/).filter(Boolean).map((fileName) => fileName.replace(/\\/g, '/'))

if (!c65bStarted) {
  } else {
  const changedSrcFiles = changedFiles.filter((fileName) => fileName.startsWith('src/')).sort()
  assert(
    changedSrcFiles.length === 0 ||
      JSON.stringify(changedSrcFiles) === JSON.stringify(['src/main.js', 'src/styles.css']),
    'C6.5 runtime should be either committed or limited to src/main.js/src/styles.css',
  )
  assertIncludes(srcMain, "'#/internal/centers'", 'C6.5B runtime route should live in src/main.js')
}

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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.5A scope: ${changedPath}`)
  assert(!/c6-5(?![abcd])|c6-6(?![abcde])|c7|teacher-portal|super-admin/i.test(changedPath), `C6.5A must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(smokePath)

console.log('C6.5A smoke: PASS')
