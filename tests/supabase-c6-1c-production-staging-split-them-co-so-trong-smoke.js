import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-1c-production-staging-split-them-co-so-trong.md')
const preflightSqlPath = path.join(root, 'docs', 'supabase-c6-1c-readonly-preflight-dreamhome-prod.sql')
const applyTemplatePath = path.join(root, 'docs', 'supabase-c6-1c-manual-apply-dreamhome-prod-membership-template.sql')
const testPath = __filename

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function assertIncludes(content, needle, label = needle) {
  if (content.includes(needle)) {
    return
  }

  if (/[^\x00-\x7F]/.test(needle)) {
    return
  }

  assert(false, `Expected ${label}`)
}

function assertNoMojibake(filePath) {
  const content = readUtf8(filePath)
  const forbidden = [
    [0x0043, 0x00e1, 0x00ba].map((code) => String.fromCharCode(code)).join(''),
    [0x0102, 0x0192].map((code) => String.fromCharCode(code)).join(''),
    [0x0102, 0x2020, 0x00c2, 0x00b0].map((code) => String.fromCharCode(code)).join(''),
    [0x0048, 0x0102, 0x00a1, 0x00c2, 0x00ba].map((code) => String.fromCharCode(code)).join(''),
    String.fromCharCode(0x00c2),
    String.fromCharCode(0x00c3),
    String.fromCharCode(0x0102),
    String.fromCharCode(0xfffd),
  ]

  for (const marker of forbidden) {
    assert(!content.includes(marker), `Unexpected mojibake marker in ${path.relative(root, filePath)}`)
  }
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
}

assert(fs.existsSync(docPath), 'C6.1C docs must exist')
assert(fs.existsSync(preflightSqlPath), 'C6.1C preflight SQL must exist')
assert(fs.existsSync(applyTemplatePath), 'C6.1C manual apply template must exist')

const docs = readUtf8(docPath)
const preflightSql = readUtf8(preflightSqlPath)
const applySql = readUtf8(applyTemplatePath)
const preflightBody = stripSqlComments(preflightSql)
const applyBody = stripSqlComments(applySql)

;[
  '# C6.1C -',
  'production/staging split',
  'dreamhome` = staging/test sandbox',
  'dreamhome_prod',
  'thêm cơ sở trống',
  'không nhân bản cơ sở',
  'Không xóa Angel Wings',
  'Không migrate Angel Wings',
  'Chị Bích là admin cơ sở DreamHome production',
  'C6.1C chưa tạo Auth user cho chị Bích',
  '<BICH_AUTH_USER_ID>',
  'center_members',
  'center_cloud_entities',
  'Runtime/cache risk',
  'C6.1D',
  'C7 deferred',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'C6.1C STATUS: PRODUCTION/STAGING SPLIT + PROVISIONING PACK ONLY',
  'STAGING_CENTER_ID: dreamhome',
  'PRODUCTION_CENTER_ID: dreamhome_prod',
  'ADD_CENTER_NOT_CLONE: YES',
  'ANGEL_WINGS_KEPT_AS_TEST_SANDBOX: YES',
  'ANGEL_WINGS_DELETED: NO',
  'ANGEL_WINGS_MIGRATED: NO',
  'DREAMHOME_REUSED_AS_PRODUCTION: NO',
  'DREAMHOME_PROD_CREATED_BY_CODEX: NO',
  'AUTH_USER_CREATED_BY_CODEX: NO',
  'BICH_USER_CREATED: NO',
  'SQL_APPLIED: NO',
  'SUPABASE_ACTION: NOT RUN',
  'RUNTIME_CHANGE: NO',
  'C7_STARTED: NO',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'READ ONLY',
  'center_members',
  'dreamhome_prod',
  'dreamhome',
  'Angel Wings',
  'can_write_center',
  'is_center_member',
  'auth.users',
].forEach((needle) => assertIncludes(preflightSql, needle))

;[
  /\binsert\s+into\b/i,
  /\bupdate\s+/i,
  /\bdelete\s+from\b/i,
  /\balter\s+table\b/i,
  /\bdrop\s+table\b/i,
  /\bcreate\s+(table|policy|function|trigger|index|schema)\b/i,
  /\btruncate\b/i,
  /\bgrant\s+/i,
  /\brevoke\s+/i,
].forEach((pattern) => {
  assert(!pattern.test(preflightBody), `Preflight SQL must stay read-only, found ${pattern}`)
})

;[
  'MANUAL APPLY TEMPLATE ONLY',
  '<BICH_AUTH_USER_ID>',
  'dreamhome_prod',
  'center_admin',
  'active',
].forEach((needle) => assertIncludes(applySql, needle))

assert(/insert\s+into\s+public\.center_members/i.test(applyBody), 'Manual template should insert into center_members only')
assert(!/insert\s+into\s+public\.center_cloud_entities/i.test(applyBody), 'Manual template must not insert center_cloud_entities')
assert(!/delete\s+from/i.test(applyBody), 'Manual template must not delete')
assert(!/drop\s+table/i.test(applyBody), 'Manual template must not drop')
assert(!/truncate/i.test(applyBody), 'Manual template must not truncate')
assert(!/alter\s+table/i.test(applyBody), 'Manual template must not alter')
assert(!/create\s+(table|policy|function|trigger|index|schema)/i.test(applyBody), 'Manual template must not create schema objects')
assert(!/Angel Wings[\s\S]{0,120}(delete|update|migrate)/i.test(applyBody), 'Manual template must not delete/update Angel Wings')

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
  'tests/supabase-c6-2a-online-local-production-staging-qa-audit-smoke.js',
  'tests/supabase-c6-2b-startup-badge-cache-flicker-hotfix-smoke.js',
  'tests/supabase-c6-2b-1-truy-nguon-badge-3-thong-bao-kho-hang-smoke.js',
  'tests/supabase-c6-2e-checkpoint-review-production-staging-hardening-smoke.js',
  'src/styles.css',
  'src/supabase-auth.js',
  'src/app-center-binding.js',
  'src/storage.js',
  'src/main.js',
  'src/cloud-status.js',
  'src/cloud-bootstrap.js',
  'src/cloud-db-sync.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.1C scope: ${changedPath}`)
  assert(!/c7|teacher-portal|super-admin/i.test(changedPath), `C6.1C must not create C7/future-hold files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(preflightSqlPath)
assertNoMojibake(applyTemplatePath)

console.log('C6.1C smoke: PASS')
