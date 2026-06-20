import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const decisionPath = path.join(repoRoot, 'docs', 'supabase-cloud-entity-strategy-f19h2a.md')
const decisionDoc = fs.readFileSync(decisionPath, 'utf8')

const requiredSections = [
  '## 2. Decision',
  '## 3. Option Comparison',
  '## 4. Entity Plan',
  '## 6. Unique Key And Conflict Strategy',
  '## 7. Safety / Readiness Gate For F19H.2b',
  '## 8. RLS / Security Direction',
  '## 9. Migration / Rollout Plan',
  '## 10. Open Questions',
]

for (const section of requiredSections) {
  assert(decisionDoc.includes(section), `Missing decision section: ${section}`)
}

const requiredTerms = [
  'Quyết định alpha',
  'center_cloud_entities',
  'bảng riêng',
  'attendance_record',
  'attendance_baseline_state',
  'session_report',
  'schedule_session',
  'tuition_record',
  'tuition_package',
  'tuition_term',
  'tuition_payment',
  'session_followup_status',
  'F19H.2b',
  'F19H.2c',
  'F19H.2d',
  'F19H.2e',
  'F19H.2f',
  'No auto pull',
  'created_by',
  'updated_by',
  'deleted_at',
]

for (const term of requiredTerms) {
  assert(decisionDoc.includes(term), `Missing required term: ${term}`)
}

assert(
  decisionDoc.includes('tiếp tục mở rộng `center_cloud_entities`'),
  'Decision doc must clearly choose center_cloud_entities for alpha.',
)
assert(
  decisionDoc.includes('không tạo SQL') ||
    decisionDoc.includes('Không tạo SQL migration'),
  'Decision doc must state that F19H.2a does not create SQL.',
)
assert(
  decisionDoc.includes('Không push/pull cloud'),
  'Decision doc must state that F19H.2a does not push or pull cloud.',
)
assert(decisionDoc.includes('Học phí'), 'Decision doc should contain Vietnamese text with accents.')

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

const cloudEntitiesSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'cloud-db-entities.js'),
  'utf8',
)

assert(!cloudEntitiesSource.includes('attendance_record'))
assert(!cloudEntitiesSource.includes('tuition_record'))
assert(!cloudEntitiesSource.includes('session_report'))

console.log('F19H.2a chốt chiến lược entity cloud smoke passed')
