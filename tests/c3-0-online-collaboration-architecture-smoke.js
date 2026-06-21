import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const docPath = path.join(repoRoot, 'docs', 'online-collaboration-architecture-c3-0.md')
const doc = fs.readFileSync(docPath, 'utf8')

const requiredSections = [
  '## 1. Executive summary',
  '## 2. Current state',
  '## 3. Target online model',
  '## 4. Multi-center model',
  '## 5. Staging vs production',
  '## 6. Auth model',
  '## 7. Role model',
  '## 8. Permission matrix',
  '## 9. Realtime design',
  '## 10. Source of truth and cache model',
  '## 11. Conflict strategy',
  '## 12. Production empty center strategy',
  '## 13. Rollout roadmap C3.1->C3.9',
  '## 14. Risks and open questions',
]

for (const section of requiredSections) {
  assert(doc.includes(section), `Missing design section: ${section}`)
}

const requiredTerms = [
  'Supabase Auth',
  'center_members',
  'center_cloud_entities',
  'centerId',
  'Angel Wings',
  'angel-wings-staging',
  'DreamHome production empty center',
  'dreamhome-production',
  'owner',
  'qtv',
  'center_admin',
  'teacher',
  'consultant',
  'viewer',
  'Permission matrix',
  'Realtime',
  'localStorage',
  'source of truth',
  'conflict',
  'C3.1',
  'C3.2',
]

for (const term of requiredTerms) {
  assert(doc.includes(term), `Missing required term: ${term}`)
}

assert(
  doc.includes('chưa triển khai realtime code') &&
    doc.includes('chưa chạy SQL') &&
    doc.includes('chưa sửa dữ liệu local/cloud') &&
    doc.includes('chưa tạo production center thật'),
  'C3.0 doc must explicitly preserve the design-only non-scope.',
)

assert(
  doc.includes('Frontend chỉ dùng publishable key') &&
    doc.includes('không dùng service role') &&
    doc.includes('không đọc `auth.users`'),
  'C3.0 doc must state the auth/security boundary.',
)

assert(
  doc.includes('Không cho realtime subscription không lọc `center_id`') ||
    doc.includes('Filter by `center_id = selectedCenterId`'),
  'C3.0 doc must require center-scoped realtime subscriptions.',
)

const forbiddenSqlPatterns = [
  /create\s+table/i,
  /alter\s+table/i,
  /drop\s+policy/i,
  /grant\s+/i,
  /insert\s+into/i,
  /service_role\s+key/i,
]

for (const pattern of forbiddenSqlPatterns) {
  assert(!pattern.test(doc), `C3.0 design doc should not contain runnable SQL: ${pattern}`)
}

const docsDir = path.join(repoRoot, 'docs')
const c3SqlFiles = fs
  .readdirSync(docsDir)
  .filter((fileName) => /^supabase-c3/i.test(fileName) && fileName.toLowerCase().endsWith('.sql'))
  .filter((fileName) => fileName !== 'supabase-c3-2-1-membership-realtime-readiness.sql')

assert.deepEqual(c3SqlFiles, [], 'C3.0 must not add Supabase SQL patch files.')

const runtimeSources = ['src/main.js', 'src/cloud-db-sync.js', 'src/cloud-db-entities.js']
  .map((filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8'))
  .join('\n')

assert(!runtimeSources.includes('supabase.channel('), 'C3.0 must not add realtime runtime code.')
assert(!runtimeSources.includes('angel-wings-staging'), 'C3.0 must not add staging center runtime code.')
assert(!runtimeSources.includes('dreamhome-production'), 'C3.0 must not add production center runtime code.')

console.log('C3.0 online collaboration architecture smoke passed')
