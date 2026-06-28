import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const repoRoot = process.cwd()
const docsPath = path.join(repoRoot, 'docs', 'supabase-c5-2b-goi-sql-readiness-hoc-phi-tbhp.md')
const readonlySqlPath = path.join(repoRoot, 'docs', 'supabase-c5-2b-readonly-verify-hoc-phi-tbhp.sql')
const finalApplyPath = path.join(repoRoot, 'docs', 'supabase-c5-2b-final-apply-hoc-phi-tbhp.sql')

assert(fs.existsSync(docsPath), 'Docs C5.2B must exist.')
assert(fs.existsSync(readonlySqlPath), 'Read-only verify SQL must exist.')

const docs = fs.readFileSync(docsPath, 'utf8')
const readonlySql = fs.readFileSync(readonlySqlPath, 'utf8')
const testSource = fs.readFileSync(new URL(import.meta.url), 'utf8')

const requiredDocsText = [
  '# C5.2B - Gói SQL/readiness cho Học phí / TBHP cloud source-of-truth',
  'tuition_record_package',
  'center_cloud_entities',
  'SQL APPLY: NO',
  'SUPABASE ACTION: NO',
  'SUPABASE DATA CHANGE: NO',
  'RUNTIME CHANGE: NO',
  'COMMIT: NO',
  'PUSH: NO',
  'không runtime',
  'không commit',
  'không push',
  'không nối attendance sang học phí',
  'Không tự cập nhật `usedSessions`',
  'Không tự cập nhật `remainingSessions`',
  'Teacher/consultant direct write: HOLD',
  '`owner`',
  '`qtv`',
  '`center_admin`',
  '`admin`',
  'read-only verification',
  'C5.2B FINAL APPLY SQL: NOT REQUIRED BASED ON CURRENT WORKSPACE/HANDOVER',
  'Không tạo bảng tuition riêng',
]

for (const text of requiredDocsText) {
  assert(docs.includes(text), `Docs must include: ${text}`)
}

const requiredSections = [
  '## 1. Mục tiêu C5.2B',
  '## 2. Trạng thái trước C5.2B',
  '## 3. Kết quả C5.2A liên quan SQL/readiness',
  '## 4. C5.2B không làm gì',
  '## 5. Supabase readiness cần kiểm tra',
  '## 6. Read-only verification queries',
  '## 7. Expected result',
  '## 8. Nếu verification pass thì không cần apply SQL',
  '## 9. Nếu verification fail thì hướng xử lý phase sau',
  '## 10. Có cần final apply SQL không?',
  '## 11. RLS/helper function readiness',
  '## 12. Realtime readiness',
  '## 13. Replica identity readiness',
  '## 14. Entity allowlist readiness',
  '## 15. Role guard policy',
  '## 16. Không runtime trong C5.2B',
  '## 17. Không attendance -> tuition auto-link',
  '## 18. Không teacher/consultant direct write',
  '## 19. Manual QA/verification plan cho user',
  '## 20. Risks/blockers',
  '## 21. Next recommendation',
]

for (const section of requiredSections) {
  assert(docs.includes(section), `Docs must include section: ${section}`)
}

const requiredSqlText = [
  'C5.2B READ-ONLY VERIFY',
  'SQL APPLY: NO',
  'SUPABASE ACTION: NO',
  'SUPABASE DATA CHANGE: NO',
  'center_cloud_entities',
  'tuition_record_package',
  'supabase_realtime',
  'can_write_center',
  'is_center_member',
  'pg_policies',
  'select',
]

for (const text of requiredSqlText) {
  assert(readonlySql.includes(text), `Read-only SQL must include: ${text}`)
}

const sqlWithoutComments = readonlySql
  .replace(/--.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const forbiddenSqlStatements = [
  'insert',
  'update',
  'delete',
  'alter',
  'create',
  'drop',
  'truncate',
  'grant',
  'revoke',
]

for (const statement of forbiddenSqlStatements) {
  assert(
    !new RegExp(`\\b${statement}\\b`, 'i').test(sqlWithoutComments),
    `Read-only SQL must not contain statement: ${statement}`,
  )
}

assert(!fs.existsSync(finalApplyPath), 'C5.2B final apply SQL should not be created when not required.')

const forbiddenMojibake = [
  String.fromCharCode(0x0102),
  String.fromCharCode(0x00c2),
  String.fromCharCode(0x00c6),
  String.fromCharCode(0x00c4),
  String.fromCharCode(0x00e1, 0x00ba),
  String.fromCharCode(0x00e1, 0x00bb),
  String.fromCharCode(0x00e2, 0x20ac, 0x201d),
  String.fromCharCode(0x00e2, 0x2020),
  String.fromCharCode(0x00ef, 0x00bf, 0x00bd),
  String.fromCharCode(0xfffd),
]

for (const [label, content] of [
  ['docs', docs],
  ['read-only sql', readonlySql],
  ['smoke test', testSource],
]) {
  for (const token of forbiddenMojibake) {
    assert(!content.includes(token), `${label} must not include mojibake token: ${token}`)
  }
}

assert(
  !/from\s+['"]\.\.\/src\//.test(testSource) &&
    !/import\s*\([^)]*['"]\.\.\/src\//.test(testSource),
  'Smoke test must not import or require runtime files.',
)

console.log('Smoke C5.2B: PASS')
