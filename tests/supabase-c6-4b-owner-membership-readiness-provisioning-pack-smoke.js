import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-4b-owner-membership-readiness-provisioning-pack.md')
const readonlySqlPath = path.join(root, 'docs', 'supabase-c6-4b-readonly-inspect-owner-membership-readiness.sql')
const manualSqlPath = path.join(root, 'docs', 'supabase-c6-4b-manual-apply-owner-membership-template.sql')

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function assertIncludes(content, needle, label = needle) {
  assert(content.includes(needle), `Expected ${label}`)
}

function assertNotIncludes(content, needle, label = needle) {
  assert(!content.includes(needle), `Unexpected ${label}`)
}

function stripSqlCommentsAndStrings(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'[^']*'/g, "''")
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

assert(fs.existsSync(docPath), 'C6.4B docs must exist')
assert(fs.existsSync(readonlySqlPath), 'C6.4B read-only inspect SQL must exist')
assert(fs.existsSync(manualSqlPath), 'C6.4B manual apply template must exist')

const docs = readUtf8(docPath)
const readonlySql = readUtf8(readonlySqlPath)
const manualSql = readUtf8(manualSqlPath)
const srcMain = readUtf8(path.join(root, 'src', 'main.js'))

;[
  'C6.4B STATUS: OWNER MEMBERSHIP READINESS PROVISIONING PACK',
  'C6_4A_STATUS: PASS',
  'OWNER_MEMBERSHIP_READINESS_PACK_CREATED: YES',
  'READONLY_INSPECT_SQL_CREATED: YES',
  'MANUAL_APPLY_TEMPLATE_CREATED: YES',
  'OWNER_ROLE_READY_FOR_LATER_APPLY: YES',
  'OWNER_AUTH_USER_CREATED: NO',
  'OWNER_MEMBERSHIP_CREATED: NO',
  'OWNER_USER_ID_SELECTED: NO',
  'TARGET_CENTER_SELECTED_FOR_OWNER_APPLY: NO',
  'WILDCARD_CENTER_ID_RECOMMENDED: NO',
  'MEMBERSHIP_PER_CENTER_SHORT_TERM: YES',
  'GLOBAL_ROLE_DEFERRED_TO_C7: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'NEW_CENTER_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C6_5_INTERNAL_CONSOLE_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'C6.4A đã chốt',
  'owner membership readiness/provisioning pack',
  'Read-only inspect SQL',
  'Manual apply template',
  'role sẽ là `owner`',
  'OWNER_AUTH_USER_CREATED: NO',
  'OWNER_MEMBERSHIP_CREATED: NO',
  'OWNER_USER_ID_SELECTED: NO',
  'TARGET_CENTER_SELECTED_FOR_OWNER_APPLY: NO',
  "Không dùng `center_id = '*'`",
  'membership per center',
  'Global role/permission system defer C7',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'Runtime không đổi',
  'C6.5 Internal Center Console',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((needle) => assertIncludes(docs, needle))

assertIncludes(readonlySql, '-- C6.4B READ-ONLY INSPECT ONLY')
assertIncludes(readonlySql, 'public.centers')
assertIncludes(readonlySql, 'public.center_members')
assertIncludes(readonlySql, 'OWNER_EMAIL_HERE')
assertIncludes(readonlySql, 'is_center_member')
assertIncludes(readonlySql, 'can_write_center')
assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge)\b/i.test(stripSqlCommentsAndStrings(readonlySql)), 'C6.4B read-only SQL must not contain mutating executable keywords')

assertIncludes(manualSql, '-- DO NOT RUN IN C6.4B.')
assertIncludes(manualSql, 'OWNER_USER_ID_HERE')
assertIncludes(manualSql, 'TARGET_CENTER_ID_HERE')
assertIncludes(manualSql, "'owner'")
assertIncludes(manualSql.toLowerCase(), 'rollback;')
assertIncludes(manualSql, '-- insert into public.center_members')
assertNotIncludes(manualSql, "center_id = '*'")
assert(!/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(manualSql), 'Manual template must not hardcode a real UUID')

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
  'docs/supabase-c6-4b-owner-membership-readiness-provisioning-pack.md',
  'docs/supabase-c6-4b-readonly-inspect-owner-membership-readiness.sql',
  'docs/supabase-c6-4b-manual-apply-owner-membership-template.sql',
  'tests/supabase-c6-4a-minimal-owner-admin-role-binding-audit-design-smoke.js',
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
  'docs/supabase-c6-5a-internal-center-console-audit-design.md',
  'tests/supabase-c6-5a-internal-center-console-audit-design-smoke.js',
  'docs/supabase-c6-5b-hidden-route-skeleton-owner-guard.md',
  'docs/supabase-c6-5c-centers-list-readonly.md',
  'docs/supabase-c6-5d-checkpoint-review-internal-center-console.md',
  'src/main.js',
  'src/styles.css',
  'tests/supabase-c6-5b-hidden-route-skeleton-owner-guard-smoke.js',
  'tests/supabase-c6-5c-centers-list-readonly-smoke.js',
  'tests/supabase-c6-5d-checkpoint-review-internal-center-console-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.4B scope: ${changedPath}`)
  assert(!/c6-4(?![abcdef])|c6-5(?![abcd])|internal-centers|c7|teacher-portal|super-admin/i.test(changedPath), `C6.4B must not create future scope files: ${changedPath}`)
}

;[docPath, readonlySqlPath, manualSqlPath, path.join(root, 'tests', 'supabase-c6-4b-owner-membership-readiness-provisioning-pack-smoke.js')].forEach(assertNoMojibake)

console.log('C6.4B smoke: PASS')
