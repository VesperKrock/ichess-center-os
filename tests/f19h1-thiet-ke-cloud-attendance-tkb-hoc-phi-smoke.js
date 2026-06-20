import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const designPath = path.join(repoRoot, 'docs', 'supabase-attendance-tkb-tuition-design.md')
const doc = fs.readFileSync(designPath, 'utf8')

const requiredSections = [
  '## 1. Executive Summary',
  '## 2. Current Local Data Sources',
  '## 3. Proposed Cloud Entities',
  '## 4. Attendance Model',
  '## 5. Session Reports Model',
  '## 6. Schedule/TKB Model',
  '## 7. Tuition/Học phí Model',
  '## 8. Deadline/Status Model',
  '## 9. Sync Strategy By Phase',
  '## 10. Readiness Gate And Safety',
  '## 11. RLS/Security Design',
  '## 12. Migration Plan',
  '## 13. Open Questions',
]

for (const section of requiredSections) {
  assert(doc.includes(section), `Missing design section: ${section}`)
}

const requiredTerms = [
  'ichessCenterOS.attendanceRecords.dreamhome',
  'ichessCenterOS.sessionReports.dreamhome',
  'ichessCenterOS.schedule.dreamhome',
  'ichessCenterOS.tuition.dreamhome',
  'ichessCenterOS.tuitionPackages.dreamhome',
  'ichessCenterOS.attendanceBaselineState.dreamhome',
  'attendance_record',
  'session_report',
  'schedule_session',
  'tuition_record',
  'deadline_state',
  'initialBaseline',
  'consultant',
  'center_cloud_entities',
  'created_by',
  'updated_by',
]

for (const term of requiredTerms) {
  assert(doc.includes(term), `Missing required term: ${term}`)
}

assert(
  doc.includes('không tạo bảng Supabase thật') ||
    doc.includes('không tạo SQL') ||
    doc.includes('không tạo bảng'),
  'Design doc must state that F19H.1 does not create real Supabase tables.',
)
assert(
  doc.includes('không push/pull cloud') || doc.includes('không bật sync runtime'),
  'Design doc must state that F19H.1 does not perform real cloud sync.',
)
assert(doc.includes('Học phí'), 'Design doc should contain Vietnamese text with accents.')

const docsDir = path.join(repoRoot, 'docs')
const sqlFiles = fs
  .readdirSync(docsDir)
  .filter((fileName) => fileName.toLowerCase().endsWith('.sql'))
  .sort()

assert.deepEqual(
  sqlFiles,
  [
    'supabase-c1-cloud-db-foundation.sql',
    'supabase-c2-2-cloud-db-permissions-fix.sql',
    'supabase-f19h2b1-attendance-record-allowlist.sql',
    'supabase-f19h2c-baseline-session-report-allowlist.sql',
    'supabase-f19h2d-schedule-session-allowlist.sql',
    'supabase-f19h2e-tuition-record-package-allowlist.sql',
    'supabase-f19h2f-tuition-term-payment-allowlist.sql',
    'supabase-s5-user-profiles.sql',
  ],
  'Only reviewed Supabase SQL docs/patch files should exist.',
)

const cloudEntitiesPath = path.join(repoRoot, 'src', 'cloud-db-entities.js')
const cloudEntitiesSource = fs.readFileSync(cloudEntitiesPath, 'utf8')

assert(!cloudEntitiesSource.includes('attendance_record'))
assert(!cloudEntitiesSource.includes('tuition_record'))
assert(!cloudEntitiesSource.includes('session_report'))

console.log('F19H.1 thiết kế cloud Attendance/TKB/Học phí smoke passed')
