import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-4a-minimal-owner-admin-role-binding-audit-design.md')
const optionalSqlPath = path.join(root, 'docs', 'supabase-c6-4a-readonly-inspect-role-membership-readiness.sql')

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

assert(fs.existsSync(docPath), 'C6.4A docs must exist')

const docs = readUtf8(docPath)
const srcMain = readUtf8(path.join(root, 'src', 'main.js'))
const accessControl = readUtf8(path.join(root, 'src', 'online-access-control.js'))
const auth = readUtf8(path.join(root, 'src', 'supabase-auth.js'))

;[
  'C6.4A STATUS: MINIMAL OWNER ADMIN ROLE BINDING AUDIT DESIGN',
  'C6_3_DONE: YES',
  'OWNER_ROLE_DESIGNED: YES',
  'CENTER_ADMIN_ROLE_DESIGNED: YES',
  'VIEWER_ROLE_OPTIONAL: YES',
  'OWNER_CAN_READ_CENTERS_METADATA_DESIGNED: YES',
  'OWNER_CAN_EDIT_CENTER_DATA_BY_DEFAULT: NO',
  'ACTING_MODE_DEFERRED_TO_C7_4: YES',
  'WILDCARD_CENTER_ID_RECOMMENDED: NO',
  'GLOBAL_ROLE_SCHEMA_APPLIED: NO',
  'MEMBERSHIP_PER_CENTER_OPTION_REVIEWED: YES',
  'HYBRID_RECOMMENDATION: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'NEW_CENTER_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C6_5_INTERNAL_CONSOLE_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'C6.3 đã hoàn thành',
  '`owner`',
  '`center_admin`',
  '`viewer`',
  'owner',
  'center_admin',
  'viewer',
  'đọc danh sách cơ sở',
  'không mặc định chỉnh dữ liệu vận hành',
  'Acting mode / hỗ trợ cơ sở defer C7.4',
  "Không dùng `center_id = '*'`",
  'Option A biểu diễn owner bằng nhiều rows trong `center_members`',
  'Option B tạo global role',
  'Khuyến nghị C6.4A: chọn Option C',
  'C6.5 Internal Center Console cần C6.4',
  'C7 vẫn deferred',
  'không tạo/sửa Auth user',
  'Không tạo Auth user, không gán membership thật',
  'không runtime change',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(accessControl, 'OWNER')
assertIncludes(accessControl, 'QTV')
assertIncludes(accessControl, 'CENTER_ADMIN')
assertIncludes(accessControl, 'VIEWER')
assertIncludes(auth, 'resolveActiveCenterMembership')
assertIncludes(auth, ".from('center_members')")

if (fs.existsSync(optionalSqlPath)) {
  const sql = readUtf8(optionalSqlPath)
  assertIncludes(sql.toLowerCase(), 'read only')
  assertIncludes(sql, 'center_members')
  assertIncludes(sql, 'centers')
  const strippedSql = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'[^']*'/g, "''")
  assert(!/\\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge)\\b/i.test(strippedSql), 'C6.4A optional SQL must be read-only')
}

assertNotIncludes(srcMain, '/internal/centers')
assertNotIncludes(srcMain, 'Thêm cơ sở')
assertNotIncludes(srcMain, 'username login')
assertNotIncludes(srcMain, 'Teacher Portal')
assertNotIncludes(srcMain, 'Super Admin')

const status = execFileSync('git', ['status', '--short'], {
  cwd: root,
  encoding: 'utf8',
})

const allowedChangedPaths = new Set([
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
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.4A scope: ${changedPath}`)
  assert(!/c6-4(?![abcdef])|c6-5|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.4A must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(path.join(root, 'tests', 'supabase-c6-4a-minimal-owner-admin-role-binding-audit-design-smoke.js'))

console.log('C6.4A smoke: PASS')
