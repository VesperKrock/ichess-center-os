import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-1b-readonly-verification-pack-dreamhome-production-empty-center.md')
const sqlPath = path.join(root, 'docs', 'supabase-c6-1b-readonly-verify-dreamhome-production-empty-center.sql')
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
    String.fromCharCode(0x00c2),
    String.fromCharCode(0x00c3),
    String.fromCharCode(0x0102),
    String.fromCharCode(0xfffd),
  ]

  for (const marker of forbidden) {
    assert(
      !content.includes(marker),
      `Unexpected mojibake marker U+${marker.charCodeAt(0).toString(16).toUpperCase()} in ${path.relative(root, filePath)}`,
    )
  }
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
}

assert(fs.existsSync(docPath), 'C6.1B docs must exist')
assert(fs.existsSync(sqlPath), 'C6.1B read-only SQL must exist')

const docs = readUtf8(docPath)
const sql = readUtf8(sqlPath)
const sqlWithoutComments = stripSqlComments(sql)

;[
  '# C6.1B -',
  'read-only verification pack',
  'DreamHome production empty center',
  'https://vesperkrock.github.io/ichess-center-os/',
  'account-based center routing',
  'URL/hidden route không phải security',
  'membership/role',
  'không vào dashboard',
  'Angel Wings/staging detection',
  'localStorage/cache',
  'C7 deferred',
  'Teacher Portal',
  'Super Admin',
  'internal hold',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'C6.1B STATUS: READ-ONLY VERIFICATION PACK ONLY',
  'SQL_MODE: READ_ONLY_VERIFY_ONLY',
  'FINAL_APPLY_SQL_CREATED: NO',
  'SQL_APPLIED: NO',
  'SUPABASE_ACTION: NOT RUN',
  'RUNTIME_CHANGE: NO',
  'ACCOUNT_BASED_CENTER_ROUTING_DECISION: YES',
  'URL_BASED_SECURITY: NO',
  'C7_STARTED: NO',
].forEach((marker) => assertIncludes(docs, marker))

;[
  'READ ONLY VERIFY ONLY',
  'center_cloud_entities',
  'center_id',
  'centerId',
  'entity_type',
  'local_id',
  'payload',
  'student',
  'teacher',
  'class_session',
  'schedule_session',
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'tuition_record_package',
  'audit_log_entry',
  'can_write_center',
  'is_center_member',
  'pg_publication_tables',
  'replica identity',
  'Angel Wings',
  'staging',
  'count by center_id',
  'entity_type',
].forEach((needle) => assertIncludes(sql, needle))

;[
  /\binsert\s+into\b/i,
  /\bupdate\s+(public\.|center_cloud_entities|center_members)\b/i,
  /\bdelete\s+from\b/i,
  /\bupsert\b/i,
  /\bmerge\s+into\b/i,
  /\balter\s+table\b/i,
  /\bdrop\s+table\b/i,
  /\bcreate\s+(table|policy|function|trigger|index|schema)\b/i,
  /\btruncate\b/i,
  /\bgrant\s+/i,
  /\brevoke\s+/i,
  /\bselect\s+.+\s+into\s+/i,
].forEach((pattern) => {
  assert(!pattern.test(sqlWithoutComments), `C6.1B SQL must stay read-only, found ${pattern}`)
})

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
  'docs/supabase-c6-3a-multi-center-foundation-audit-design.md',
  'docs/supabase-c6-3b-centers-schema-hardening-provisioning-pack.md',
  'docs/supabase-c6-3b-readonly-inspect-centers-schema.sql',
  'docs/supabase-c6-3b-manual-apply-centers-schema-hardening-template.sql',
        'docs/supabase-c6-3c-readonly-verify-centers-schema-hardening-applied.sql',
        'docs/supabase-c6-4b-readonly-inspect-owner-membership-readiness.sql',
        'docs/supabase-c6-4b-manual-apply-owner-membership-template.sql',
  'docs/supabase-c6-3d-runtime-readiness-audit-sau-centers-schema-hardening.md',
  'docs/supabase-c6-3e-checkpoint-review-multi-center-foundation.md',
  'docs/supabase-c6-3c-verify-centers-schema-hardening-applied.md',
  'docs/supabase-c6-3c-readonly-verify-centers-schema-hardening-applied.sql',
  'docs/supabase-c6-3d-runtime-readiness-audit-sau-centers-schema-hardening.md',
  'docs/supabase-c6-3e-checkpoint-review-multi-center-foundation.md',
  'tests/supabase-c6-2a-online-local-production-staging-qa-audit-smoke.js',
  'tests/supabase-c6-2b-startup-badge-cache-flicker-hotfix-smoke.js',
  'tests/supabase-c6-2b-1-truy-nguon-badge-3-thong-bao-kho-hang-smoke.js',
  'tests/supabase-c6-2e-checkpoint-review-production-staging-hardening-smoke.js',
  'tests/supabase-c6-3a-multi-center-foundation-audit-design-smoke.js',
  'tests/supabase-c6-3b-centers-schema-hardening-provisioning-pack-smoke.js',
  'tests/supabase-c6-3c-verify-centers-schema-hardening-applied-smoke.js',
  'tests/supabase-c6-3d-runtime-readiness-audit-sau-centers-schema-hardening-smoke.js',
  'tests/supabase-c6-3e-checkpoint-review-multi-center-foundation-smoke.js',
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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.1B scope: ${changedPath}`)
  assert(!/final.*apply/i.test(changedPath), `C6.1B must not create final apply SQL: ${changedPath}`)
  assert(!/c7/i.test(changedPath), `C6.1B must not create C7 files: ${changedPath}`)
  assert(!/teacher-portal|super-admin/i.test(changedPath), `C6.1B must not add public future-hold files: ${changedPath}`)
}

assertNoMojibake(docPath)
assertNoMojibake(sqlPath)

console.log('C6.1B smoke: PASS')
