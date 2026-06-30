import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const docPath = path.join(root, 'docs', 'supabase-c6-1a-thiet-ke-dreamhome-production-empty-center.md')
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

assert(fs.existsSync(docPath), 'C6.1A docs must exist')

const docs = readUtf8(docPath)

;[
  '# C6.1A -',
  'DreamHome production empty center',
  'staging',
  'Angel Wings',
  'Không migrate Angel Wings',
  'không seed production',
  'center_id',
  'centerId',
  'Supabase Auth user ≠ quyền trong app',
  'membership/role',
  'Không có membership hợp lệ thì không được vào dashboard',
  'localStorage/cache',
  'Cloud empty behavior risk',
  'C6.1B read-only verification plan',
  'C6.1C runtime/cache guard plan',
  'C6.1D manual QA',
  'Username login thay email',
  'Advanced account management defer C7',
  'Permission overrides',
  'Acting mode',
  'Teacher Portal',
  'Super Admin/internal operator console',
  'Không public/customer-facing',
  'C7 mới xử lý chi tiết',
].forEach((needle) => assertIncludes(docs, needle))

;[
  '## 1. Mục tiêu C6.1A',
  '## 2. Trạng thái trước C6.1A',
  '## 3. Tóm tắt C6.0',
  '## 4. Định nghĩa DreamHome production empty center',
  '## 5. Production vs staging boundary',
  '## 6. Angel Wings không được migrate',
  '## 7. Production data model tối thiểu',
  '## 8. Minimal center identity',
  '## 9. Minimal membership/role binding',
  '## 10. Auth users hiện tại và nguyên tắc mapping',
  '## 11. LocalStorage/cache risk',
  '## 12. Cloud bootstrap / cloud empty behavior risk',
  '## 13. Entity readiness cho production',
  '## 14. Realtime readiness cho production',
  '## 15. RLS / helper function readiness nếu cần',
  '## 16. C6.1B read-only verification plan',
  '## 17. C6.1C runtime/cache guard plan nếu cần',
  '## 18. C6.1D manual QA plan',
  '## 19. Những gì C6.1A không làm',
  '## 20. C7 deferred items',
  '## 21. Risks / blockers',
  '## 22. PASS / NEEDS REVIEW criteria',
  '## 23. Recommendation',
].forEach((heading) => assertIncludes(docs, heading))

;[
  'C6.1A STATUS: DESIGN ONLY',
  'SQL: NOT CREATED / NOT RUN',
  'SUPABASE ACTION: NOT RUN',
  'RUNTIME_CHANGE: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'PRODUCTION_CENTER_CREATED: NO',
  'PRODUCTION_DATA_SEEDED: NO',
  'STAGING_DATA_MIGRATED: NO',
  'ANGEL_WINGS_MIGRATED: NO',
  'ANGEL_WINGS_MODIFIED: NO',
  'LOCAL_STORAGE_RESET: NO',
  'ACCOUNT_MANAGEMENT_UI_CREATED: NO',
  'USERNAME_LOGIN_CREATED: NO',
  'PERMISSION_OVERRIDE_CREATED: NO',
  'ACTING_MODE_CREATED: NO',
  'TEACHER_PORTAL_PUBLIC_DISCLOSURE: NO',
  'SUPER_ADMIN_PUBLIC_DISCLOSURE: NO',
  'CUSTOMER_FACING_DOCS_FOR_TEACHER_OR_SUPER_ADMIN: NO',
  'C7_STARTED: NO',
].forEach((marker) => assertIncludes(docs, marker))

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
  'docs/supabase-c6-5a-internal-center-console-audit-design.md',
  'tests/supabase-c6-5a-internal-center-console-audit-design-smoke.js',
  'docs/supabase-c6-5b-hidden-route-skeleton-owner-guard.md',
  'docs/supabase-c6-5c-centers-list-readonly.md',
  'docs/supabase-c6-5d-checkpoint-review-internal-center-console.md',
  'tests/supabase-c6-5b-hidden-route-skeleton-owner-guard-smoke.js',
  'tests/supabase-c6-5c-centers-list-readonly-smoke.js',
  'tests/supabase-c6-5d-checkpoint-review-internal-center-console-smoke.js',
])

for (const line of status.split(/\r?\n/).filter(Boolean)) {
  const changedPath = line.slice(3).replace(/\\/g, '/')
  assert(allowedChangedPaths.has(changedPath), `Unexpected changed file in C6.1A scope: ${changedPath}`)
  assert(
    !/\.sql$/i.test(changedPath) ||
      [
        'docs/supabase-c6-1b-readonly-verify-dreamhome-production-empty-center.sql',
        'docs/supabase-c6-1c-readonly-preflight-dreamhome-prod.sql',
        'docs/supabase-c6-1c-manual-apply-dreamhome-prod-membership-template.sql',
        'docs/supabase-c6-3b-readonly-inspect-centers-schema.sql',
        'docs/supabase-c6-3b-manual-apply-centers-schema-hardening-template.sql',
        'docs/supabase-c6-3c-readonly-verify-centers-schema-hardening-applied.sql',
  'docs/supabase-c6-3d-runtime-readiness-audit-sau-centers-schema-hardening.md',
  'docs/supabase-c6-3e-checkpoint-review-multi-center-foundation.md',
  'docs/supabase-c6-3c-verify-centers-schema-hardening-applied.md',
  'docs/supabase-c6-3c-readonly-verify-centers-schema-hardening-applied.sql',
  'docs/supabase-c6-3d-runtime-readiness-audit-sau-centers-schema-hardening.md',
  'docs/supabase-c6-3e-checkpoint-review-multi-center-foundation.md',
        'docs/supabase-c6-4b-readonly-inspect-owner-membership-readiness.sql',
        'docs/supabase-c6-4b-manual-apply-owner-membership-template.sql',
      ].includes(changedPath),
    `C6.1A must not change SQL files outside C6.1B read-only verify: ${changedPath}`,
  )
  assert(!/c7/i.test(changedPath), `C6.1A must not create C7 files: ${changedPath}`)
  assert(!/teacher-portal|super-admin/i.test(changedPath), `C6.1A must not add public future-hold files: ${changedPath}`)
}

assertNoMojibake(docPath)

console.log('C6.1A smoke: PASS')
