import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-0-production-readiness-audit-truoc-dreamhome-production.md')
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

assert(fs.existsSync(docPath), 'C6.0 docs must exist')

const docs = readUtf8(docPath)

;[
  '# C6.0 - Production readiness audit',
  'production readiness audit',
  'DreamHome production empty center',
  'staging',
  'Angel Wings',
  'migrate Angel Wings sang DreamHome production',
  'center_id',
  'centerId',
  'center_cloud_entities',
  'auth/membership/role',
  'localStorage/cache',
  'student',
  'teacher',
  'class_session',
  'schedule_session',
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'tuition_record_package',
  'audit_log_entry',
  'overclaim dedicated realtime subscription',
  'read-only verification plan',
  'SQL/manual Supabase plan',
  'Teacher Portal / Super Admin internal hold',
  'anh Hải',
  'INTERNAL ONLY',
  "NOT CUSTOMER-FACING",
  'C6.1A',
  'C6.1B',
  'C6.1C',
  'C6.1D',
  'C6.1E',
  'C6.1F',
].forEach((needle) => assertIncludes(docs, needle))

;[
  'C6.0 STATUS: PRODUCTION READINESS AUDIT ONLY',
  'SQL: NOT CREATED / NOT RUN',
  'SUPABASE ACTION: NOT RUN',
  'RUNTIME_CHANGE: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'PRODUCTION_CENTER_CREATED: NO',
  'PRODUCTION_DATA_SEEDED: NO',
  'STAGING_DATA_MIGRATED: NO',
  'ANGEL_WINGS_MODIFIED: NO',
  'LOCAL_STORAGE_RESET: NO',
  'TEACHER_PORTAL_PUBLIC_DISCLOSURE: NO',
  'SUPER_ADMIN_PUBLIC_DISCLOSURE: NO',
  'CUSTOMER_FACING_DOCS_FOR_TEACHER_OR_SUPER_ADMIN: NO',
  'C6.1_STARTED: NO',
].forEach((marker) => assertIncludes(docs, marker))

;[
  '## 1.',
  '## 2.',
  '## 3.',
  '## 4. Production vs staging',
  '## 5. Current cloud/auth/center architecture',
  '## 6. Entity readiness',
  '## 7. Realtime readiness',
  '## 8. Auth/membership/role readiness',
  '## 9. LocalStorage/cache readiness',
  '## 10. Production DreamHome empty center',
  '## 11.',
  '## 12.',
  '## 13.',
  '## 14. Safety rules cho C6.1',
  '## 15. Read-only verification plan cho C6.1 nếu cần',
  '## 16. SQL/manual Supabase plan nếu cần',
  '## 17. Teacher Portal / Super Admin internal hold',
  '## 18. C6.1 proposal',
  '## 19. PASS / NEEDS REVIEW criteria',
  '## 20. Recommendation',
].forEach((heading) => assertIncludes(docs, heading))

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
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.0 scope: ${changedPath}`)
  assert(
    !/\.sql$/i.test(changedPath) ||
      [
        'docs/supabase-c6-1b-readonly-verify-dreamhome-production-empty-center.sql',
        'docs/supabase-c6-1c-readonly-preflight-dreamhome-prod.sql',
        'docs/supabase-c6-1c-manual-apply-dreamhome-prod-membership-template.sql',
      ].includes(changedPath),
    `C6.0 must not change SQL files outside C6.1B read-only verify: ${changedPath}`,
  )
  assert(!/teacher-portal|super-admin/i.test(changedPath), `C6.0 must not add future-hold public files: ${changedPath}`)
}

assertNoMojibake(docPath)

console.log('C6.0 smoke: PASS')
