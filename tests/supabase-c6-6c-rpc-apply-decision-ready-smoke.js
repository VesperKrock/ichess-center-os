import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-6c-rpc-apply-decision-ready.md')
const applySqlPath = path.join(root, 'docs', 'supabase-c6-6c-manual-apply-provision-center-rpc.sql')
const verifySqlPath = path.join(root, 'docs', 'supabase-c6-6c-post-apply-verify-provision-center-rpc.sql')
const smokePath = path.join(root, 'tests', 'supabase-c6-6c-rpc-apply-decision-ready-smoke.js')
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

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
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

assert(fs.existsSync(docPath), 'C6.6C docs must exist')
assert(fs.existsSync(applySqlPath), 'C6.6C manual apply SQL must exist')
assert(fs.existsSync(verifySqlPath), 'C6.6C post-apply verify SQL must exist')

const docs = readUtf8(docPath)
const applySql = readUtf8(applySqlPath)
const verifySql = readUtf8(verifySqlPath)
const main = readUtf8(mainPath)

;[
  'C6.6C STATUS: RPC APPLY DECISION READY',
  'C6_6B_STATUS: PASS',
  'MANUAL_APPLY_SQL_CREATED: YES',
  'POST_APPLY_VERIFY_SQL_CREATED: YES',
  'RPC_APPLY_READY_FOR_USER_REVIEW: YES',
  'RPC_NAME: provision_center_for_owner',
  'RPC_SQL_INPUT: p_center_name',
  'VISIBLE_REQUIRED_FIELD_COUNT: 1',
  'VISIBLE_REQUIRED_FIELD: Tên cơ sở',
  'COMPACT_SLUG_CONVENTION_CONFIRMED: YES',
  'SLUG_HELPER_NAME: ichess_slugify_center_name_compact',
  'SLUG_EXAMPLE_GO_VAP: govap',
  'SLUG_EXAMPLE_PHU_NHUAN: phunhuan',
  'SLUG_EXAMPLE_THU_DUC: thuduc',
  'SLUG_EXAMPLE_QUAN_12: quan12',
  'CENTER_ID_PATTERN: <slug>_prod',
  'DEFAULT_ENVIRONMENT: production',
  'DEFAULT_STATUS: active',
  'OWNER_AUTHORIZATION_REVIEWED: YES',
  'OWNER_MEMBERSHIP_FOR_NEW_CENTER_REVIEWED: YES',
  'EMPTY_CENTER_BEHAVIOR_REVIEWED: YES',
  'CONFLICT_HANDLING_REVIEWED: YES',
  'EXECUTE_GRANT_REVIEWED: YES',
  'NO_REAL_CENTER_CREATION_IN_APPLY_SQL: YES',
  'NO_PROVISION_RPC_CALL_IN_VERIFY_SQL: YES',
  'BACKUP_RECOMMENDED_BEFORE_APPLY: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'NEW_CENTER_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C6_6D_STARTED: NO',
  'C6_6E_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.6C',
  '## 2. Trạng thái sau C6.6B',
  '## 3. SQL safety statement',
  '## 4. Files created',
  '## 5. Manual apply SQL summary',
  '## 6. Post-apply verify SQL summary',
  '## 7. RPC design final review',
  '## 8. Slug helper final review',
  '## 9. Compact slug examples',
  '## 10. Owner authorization review',
  '## 11. Empty center behavior review',
  '## 12. Conflict handling review',
  '## 13. Privilege/grant review',
  '## 14. No real center creation guarantee',
  '## 15. Backup/apply order',
  '## 16. C6.6D recommendation',
  '## 17. C6.6E/F runtime/test center deferred',
  '## 18. C7 deferred',
  '## 19. PASS / NEEDS REVIEW criteria',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'Purpose:',
  'Environment:',
  'Data impact:',
  'Destructive impact:',
  'Backup:',
  'Apply order:',
  'Gò Vấp -> govap',
  'Phú Nhuận -> phunhuan',
  'Thủ Đức -> thuduc',
  'Quận 12 -> quan12',
].forEach((needle) => assertIncludes(docs, needle))

;[
  '-- C6.6C MANUAL APPLY SQL - DO NOT RUN UNLESS USER CONFIRMS',
  '-- Purpose: create guarded RPC',
  '-- Environment: Supabase project for iChess Center OS.',
  '-- Data impact: does not create centers by itself',
  'public.ichess_slugify_center_name_compact(input text)',
  'public.provision_center_for_owner(p_center_name text)',
  'auth.uid()',
  'owner_membership_required',
  "generated_slug || '_prod'",
  "'production'",
  "'active'",
  'security definer',
  'revoke all on function public.provision_center_for_owner(text) from public;',
  'grant execute on function public.provision_center_for_owner(text) to authenticated;',
  'Gò Vấp -> govap',
  'Phú Nhuận -> phunhuan',
  'Thủ Đức -> thuduc',
  'Quận 12 -> quan12',
].forEach((needle) => assertIncludes(applySql, needle))

const applySqlWithoutComments = stripSqlComments(applySql)
assert(!/select\s+public\.provision_center_for_owner\s*\(/i.test(applySqlWithoutComments), 'manual apply SQL must not call provisioning RPC')
assert(!/values\s*\(\s*'govap_prod'/i.test(applySqlWithoutComments), 'manual apply SQL must not insert hardcoded Gò Vấp center')
assert(!/values\s*\(\s*'quan12_prod'/i.test(applySqlWithoutComments), 'manual apply SQL must not insert hardcoded Quận 12 center')
assert(!/DreamHome/i.test(applySqlWithoutComments), 'manual apply SQL must not hardcode DreamHome outside comments')
assert(!/Angel Wings/i.test(applySqlWithoutComments), 'manual apply SQL must not hardcode Angel Wings outside comments')
assert(!/\bauth\.users\b/i.test(applySqlWithoutComments), 'manual apply SQL must not create or edit Auth users')

;[
  '-- C6.6C POST-APPLY VERIFY SQL',
  '-- Read-only verification after manual apply.',
  '-- This file must not create centers.',
  '-- This file must not create memberships.',
  '-- This file must not call provision_center_for_owner with a real center name.',
  'ichess_slugify_center_name_compact',
  'provision_center_for_owner',
  'pg_get_function_identity_arguments',
  'has_function_privilege',
  "public.ichess_slugify_center_name_compact('Gò Vấp') as govap",
  "public.ichess_slugify_center_name_compact('Phú Nhuận') as phunhuan",
  "public.ichess_slugify_center_name_compact('Thủ Đức') as thuduc",
  "public.ichess_slugify_center_name_compact('Quận 12') as quan12",
].forEach((needle) => assertIncludes(verifySql, needle))

const verifySqlWithoutComments = stripSqlComments(verifySql)
assert(!/(select|perform)\s+public\.provision_center_for_owner\s*\(/i.test(verifySqlWithoutComments), 'post-apply verify SQL must not call provisioning RPC')
assert(!/\bcall\s+public\.provision_center_for_owner\s*\(/i.test(verifySqlWithoutComments), 'post-apply verify SQL must not call provisioning RPC')
assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge)\b/i.test(verifySqlWithoutComments), 'post-apply verify SQL must not mutate data/schema')

assertIncludes(main, "from('centers')", 'C6.5 readonly centers read remains')
assert(!/\.from\('centers'\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not mutate public.centers')
assert(!/\.from\("centers"\)[\s\S]{0,500}\.(insert|update|upsert|delete)\s*\(/i.test(main), 'runtime must not mutate public.centers')
assertNotIncludes(main, 'username login', 'C7 username UI')
assertNotIncludes(main, 'account management', 'C7 account management UI')
assertNotIncludes(main, 'Super Admin', 'Super Admin advanced')

const diffNames = execFileSync('git', ['diff', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
})
const changedFiles = diffNames.split(/\r?\n/).filter(Boolean).map((fileName) => fileName.replace(/\\/g, '/'))

const allowedChangedPaths = new Set([
  'src/main.js',
  'src/styles.css',
  'docs/supabase-c6-6a-them-co-so-mot-truong-audit-design.md',
  'docs/supabase-c6-6b-provisioning-rpc-design-inspection-pack.md',
  'docs/supabase-c6-6b-readonly-inspect-add-center-provisioning-readiness.sql',
  'docs/supabase-c6-6b-manual-apply-provision-center-rpc-template.sql',
  'docs/supabase-c6-6c-rpc-apply-decision-ready.md',
  'docs/supabase-c6-6c-manual-apply-provision-center-rpc.sql',
  'docs/supabase-c6-6c-post-apply-verify-provision-center-rpc.sql',
  'docs/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack.md',
  'docs/supabase-c6-6d-readonly-verify-rpc-applied.sql',
  'docs/supabase-c6-6d-controlled-create-center-rpc-template.sql',
  'docs/supabase-c6-6d-post-create-verify-center.sql',
  'docs/supabase-c6-6d-1-doi-target-test-phong-trong.md',
  'docs/supabase-c6-6e-runtime-add-center-form-rpc.md',
  'docs/supabase-c6-6f-post-create-verify-polish-enter-center-design.md',
  'docs/supabase-c6-6g-owner-center-switch-mo-os-co-so.md',
  'docs/supabase-c6-6h-checkpoint-review-add-center-center-switch.md',
  'tests/supabase-c6-6a-them-co-so-mot-truong-audit-design-smoke.js',
  'tests/supabase-c6-6b-provisioning-rpc-design-inspection-pack-smoke.js',
  'tests/supabase-c6-6c-rpc-apply-decision-ready-smoke.js',
  'tests/supabase-c6-6d-post-apply-verify-controlled-rpc-test-pack-smoke.js',
  'tests/supabase-c6-6d-1-doi-target-test-phong-trong-smoke.js',
  'tests/supabase-c6-6e-runtime-add-center-form-rpc-smoke.js',
  'tests/supabase-c6-6f-post-create-verify-polish-enter-center-design-smoke.js',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.6C scope: ${changedPath}`)
  assert(!/c6-6(?![abcdefgh])|c7|teacher-portal|super-admin/i.test(changedPath), `C6.6C must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(applySqlPath)
assertNoMojibake(verifySqlPath)
assertNoMojibake(smokePath)
assertNoMojibake(mainPath)

console.log('C6.6C smoke: PASS')
