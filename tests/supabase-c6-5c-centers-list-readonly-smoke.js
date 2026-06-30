import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-5c-centers-list-readonly.md')
const smokePath = path.join(root, 'tests', 'supabase-c6-5c-centers-list-readonly-smoke.js')
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

assert(fs.existsSync(docPath), 'C6.5C docs must exist')

const docs = readUtf8(docPath)
const main = readUtf8(mainPath)
const styles = readUtf8(stylesPath)

;[
  'C6.5C STATUS: CENTERS LIST READONLY',
  'C6_5B_STATUS: PASS',
  'C6_5B_MANUAL_QA: PASS',
  'HIDDEN_ROUTE_PRESERVED: YES',
  'OWNER_GUARD_PRESERVED: YES',
  'OWNER_ONLY_ACCESS_PRESERVED: YES',
  'CENTER_ADMIN_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'SIGNED_OUT_ACCESS_TO_INTERNAL_CONSOLE: NO',
  'CENTERS_LIST_QUERY_IMPLEMENTED: YES',
  'CENTERS_LIST_READONLY_IMPLEMENTED: YES',
  'CENTERS_LIST_SOURCE: public.centers',
  'CENTERS_LIST_FIELDS: id,name,slug,environment,status,created_at,updated_at',
  'CENTERS_LIST_DEFAULT_FILTER_ENVIRONMENT: production',
  'CENTERS_LIST_DEFAULT_FILTER_STATUS: active',
  'CENTERS_LIST_EXPECTED_DREAMHOME_PROD: YES',
  'STAGING_DREAMHOME_VISIBLE_IN_DEFAULT_LIST: NO',
  'LOADING_STATE_IMPLEMENTED: YES',
  'EMPTY_STATE_IMPLEMENTED: YES',
  'ERROR_STATE_IMPLEMENTED: YES',
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
  'RUNTIME_CHANGE_SCOPE: INTERNAL_CENTERS_LIST_READONLY_ONLY',
  'C6_5D_STARTED: NO',
  'C6_6_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.5C',
  '## 2. Trạng thái sau C6.5B',
  '## 3. Runtime changes summary',
  '## 4. Owner guard preserved',
  '## 5. Centers readonly query',
  '## 6. Default filter production/active',
  '## 7. Readonly UI fields',
  '## 8. Loading/empty/error states',
  '## 9. Manual QA checklist',
  '## 10. RLS/policy risk',
  '## 11. Vì sao chưa có Add center',
  '## 12. Vì sao chưa có acting mode',
  '## 13. C6.5D/C6.6 dependency',
  '## 14. C7 deferred',
  '## 15. PASS / NEEDS REVIEW criteria',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(main, 'getSupabaseClient', 'runtime uses existing Supabase client')
assertIncludes(main, "from('centers')", 'runtime reads public.centers')
assertIncludes(main, 'id,name,slug,environment,status,created_at,updated_at', 'runtime centers select fields')
assertIncludes(main, ".eq('environment', 'production')", 'runtime production filter')
assertIncludes(main, ".eq('status', 'active')", 'runtime active filter')
assertIncludes(main, ".order('name', { ascending: true })", 'runtime stable order')
assertIncludes(main, 'Đang tải danh sách cơ sở...', 'runtime loading state')
assertIncludes(main, 'Chưa có cơ sở production active.', 'runtime empty state')
assertIncludes(main, 'Không tải được danh sách cơ sở.', 'runtime error state')
assertIncludes(main, 'Tên cơ sở', 'runtime UI label')
assertIncludes(main, 'Mã cơ sở', 'runtime UI label')
assertIncludes(main, 'Slug', 'runtime UI label')
assertIncludes(main, 'Môi trường', 'runtime UI label')
assertIncludes(main, 'Trạng thái', 'runtime UI label')
assertIncludes(main, 'Cập nhật', 'runtime UI label')
assertIncludes(main, 'ONLINE_ACCESS_ROLES.OWNER', 'owner guard remains')
assertIncludes(main, 'Bạn không có quyền truy cập khu vực nội bộ.', 'access denied remains')
assertIncludes(styles, '.internal-centers-table', 'centers table styles')
assertIncludes(styles, '.internal-centers-filter-note', 'centers filter note styles')

assert(!/\.from\('centers'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'C6.5C must not mutate public.centers')
assertNotIncludes(main, 'Thêm cơ sở', 'runtime add center copy/button')
assertNotIncludes(main, 'Tạo cơ sở', 'runtime create center copy/button')
assertNotIncludes(main, 'Add center', 'runtime add center copy/button')
assertNotIncludes(main, 'Create center', 'runtime create center copy/button')
assertNotIncludes(main, 'Vào cơ sở', 'runtime acting entry')
assertNotIncludes(main, 'Biến thành admin', 'runtime acting entry')
assertNotIncludes(main, 'Acting as', 'runtime acting entry')
assertNotIncludes(main, 'Support center', 'runtime acting entry')
assertNotIncludes(main, 'username login', 'C7 username UI')
assertNotIncludes(main, 'Teacher Portal', 'Teacher Portal')
assertNotIncludes(main, 'Super Admin', 'Super Admin advanced')

const diffNames = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
})
const changedFiles = diffNames.split(/\r?\n/).filter(Boolean).map((fileName) => fileName.replace(/\\/g, '/'))
const changedSrcFiles = changedFiles.filter((fileName) => fileName.startsWith('src/'))
assert.deepEqual(
  changedSrcFiles.sort(),
  ['src/main.js', 'src/styles.css'],
  'C6.5C runtime diff must stay in main.js/styles.css only',
)

const allowedChangedPaths = new Set([
  'docs/supabase-c6-5a-internal-center-console-audit-design.md',
  'docs/supabase-c6-5b-hidden-route-skeleton-owner-guard.md',
  'docs/supabase-c6-5c-centers-list-readonly.md',
  'docs/supabase-c6-5d-checkpoint-review-internal-center-console.md',
  'src/main.js',
  'src/styles.css',
  'tests/supabase-c6-5a-internal-center-console-audit-design-smoke.js',
  'tests/supabase-c6-5b-hidden-route-skeleton-owner-guard-smoke.js',
  'tests/supabase-c6-5c-centers-list-readonly-smoke.js',
  'tests/supabase-c6-5d-checkpoint-review-internal-center-console-smoke.js',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.5C scope: ${changedPath}`)
  assert(!/c6-5(?![abcd])|c6-6|c7|teacher-portal|super-admin/i.test(changedPath), `C6.5C must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(smokePath)
assertNoMojibake(mainPath)

console.log('C6.5C smoke: PASS')
