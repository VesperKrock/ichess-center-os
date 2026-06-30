import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-6b-provisioning-rpc-design-inspection-pack.md')
const inspectSqlPath = path.join(root, 'docs', 'supabase-c6-6b-readonly-inspect-add-center-provisioning-readiness.sql')
const templateSqlPath = path.join(root, 'docs', 'supabase-c6-6b-manual-apply-provision-center-rpc-template.sql')
const smokePath = path.join(root, 'tests', 'supabase-c6-6b-provisioning-rpc-design-inspection-pack-smoke.js')
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

assert(fs.existsSync(docPath), 'C6.6B docs must exist')
assert(fs.existsSync(inspectSqlPath), 'C6.6B read-only inspect SQL must exist')
assert(fs.existsSync(templateSqlPath), 'C6.6B manual apply RPC template must exist')

const docs = readUtf8(docPath)
const inspectSql = readUtf8(inspectSqlPath)
const templateSql = readUtf8(templateSqlPath)
const main = readUtf8(mainPath)

;[
  'C6.6B STATUS: PROVISIONING RPC DESIGN INSPECTION PACK',
  'C6_6A_STATUS: PASS',
  'READONLY_INSPECT_SQL_CREATED: YES',
  'MANUAL_APPLY_RPC_TEMPLATE_CREATED: YES',
  'ADD_CENTER_RPC_DESIGNED: YES',
  'RPC_NAME_DESIGNED: provision_center_for_owner',
  'RPC_VISIBLE_INPUT_FIELD_COUNT: 1',
  'RPC_VISIBLE_INPUT_FIELD: Tên cơ sở',
  'RPC_SQL_INPUT: p_center_name',
  'COMPACT_SLUG_CONVENTION_CONFIRMED: YES',
  'SLUG_EXAMPLE_GO_VAP: govap',
  'SLUG_EXAMPLE_PHU_NHUAN: phunhuan',
  'SLUG_EXAMPLE_THU_DUC: thuduc',
  'SLUG_EXAMPLE_QUAN_12: quan12',
  'CENTER_ID_PATTERN_DESIGNED: <slug>_prod',
  'DEFAULT_ENVIRONMENT_DESIGNED: production',
  'DEFAULT_STATUS_DESIGNED: active',
  'EMPTY_CENTER_TRANSACTION_DESIGNED: YES',
  'OWNER_AUTHORIZATION_DESIGNED: YES',
  'OWNER_MEMBERSHIP_FOR_NEW_CENTER_DESIGNED: YES',
  'FRONTEND_DIRECT_INSERT_RECOMMENDED: NO',
  'GUARDED_RPC_RECOMMENDED: YES',
  'UNACCENT_EXTENSION_REVIEW_REQUIRED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'SUPABASE_ACTION_BY_CODEX: NOT RUN',
  'AUTH_USER_CREATED: NO',
  'MEMBERSHIP_CREATED: NO',
  'NEW_CENTER_CREATED: NO',
  'RUNTIME_CHANGE: NO',
  'C6_6C_STARTED: NO',
  'C6_6D_STARTED: NO',
  'C7_STARTED: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1. Mục tiêu C6.6B',
  '## 2. Trạng thái sau C6.6A',
  '## 3. Provisioning approach',
  '## 4. Vì sao không frontend direct insert',
  '## 5. Read-only inspection pack',
  '## 6. Manual apply RPC template',
  '## 7. Compact slug convention',
  '## 8. Slug helper design',
  '## 9. Center ID generation design',
  '## 10. RPC input/output design',
  '## 11. Owner authorization design',
  '## 12. Empty center transaction design',
  '## 13. Owner membership creation design',
  '## 14. Conflict handling',
  '## 15. RLS/security considerations',
  '## 16. Extension unaccent considerations',
  '## 17. C6.6C apply plan',
  '## 18. C6.6D/E runtime plan',
  '## 19. C7 deferred',
  '## 20. PASS / NEEDS REVIEW criteria',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'Gò Vấp -> govap',
  'Phú Nhuận -> phunhuan',
  'Thủ Đức -> thuduc',
  'Quận 12 -> quan12',
  'Bình Thạnh -> binhthanh',
  'govap_prod',
  'phunhuan_prod',
  'thuduc_prod',
  'quan12_prod',
  'p_center_name',
  'auth.uid()',
  'security definer',
].forEach((needle) => assertIncludes(docs, needle))

;[
  '-- C6.6B READ-ONLY INSPECT ONLY',
  '-- Do not run as apply/migration.',
  '-- This file does not create centers.',
  '-- This file does not create memberships.',
  '-- This file does not create functions.',
  '-- This file does not modify data.',
  'information_schema.columns',
  "table_name = 'centers'",
  "table_name = 'center_members'",
  'pg_constraint',
  'pg_indexes',
  'centers_slug_environment_unique_idx',
  'public.centers',
  'public.center_members',
  'owner.duchai@ichess.vn',
  'pg_proc',
  'pg_extension',
  'pg_policies',
].forEach((needle) => assertIncludes(inspectSql, needle))

const inspectSqlWithoutComments = stripSqlComments(inspectSql)
assert(!/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge)\b/i.test(inspectSqlWithoutComments), 'read-only inspect SQL must not contain mutating SQL outside comments')

;[
  '-- MANUAL APPLY TEMPLATE ONLY',
  '-- DO NOT RUN IN C6.6B.',
  'provision_center_for_owner',
  'p_center_name',
  'ichess_slugify_center_name_compact',
  'auth.uid()',
  'owner_membership_required',
  "generated_slug || '_prod'",
  "'production'",
  "'active'",
  'security definer',
  'insert into public.centers',
  'insert into public.center_members',
  'This does not create Auth users.',
  'This does not clone DreamHome.',
  'This does not touch Angel Wings.',
  'Gò Vấp -> govap',
  'Phú Nhuận -> phunhuan',
  'Thủ Đức -> thuduc',
  'Quận 12 -> quan12',
].forEach((needle) => assertIncludes(templateSql, needle))

assertNotIncludes(templateSql, 'govap_prod', 'manual template must not hardcode real Gò Vấp center_id')
assertNotIncludes(templateSql, 'Gò Vấp\')', 'manual template must not call RPC for real Gò Vấp')
assertNotIncludes(templateSql, 'auth.users', 'manual template must not create or edit Auth users')
assert(!/select\s+public\.provision_center_for_owner/i.test(templateSql), 'manual template must not execute provisioning RPC')

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
  'docs/supabase-c6-6c-manual-apply-provision-center-rpc.sql',
  'docs/supabase-c6-6c-rpc-apply-decision-ready.md',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.6B scope: ${changedPath}`)
  assert(!/c6-6(?![abcdefgh])|c7|teacher-portal|super-admin/i.test(changedPath), `C6.6B must not create future scope files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(inspectSqlPath)
assertNoMojibake(templateSqlPath)
assertNoMojibake(smokePath)
assertNoMojibake(mainPath)

console.log('C6.6B smoke: PASS')
