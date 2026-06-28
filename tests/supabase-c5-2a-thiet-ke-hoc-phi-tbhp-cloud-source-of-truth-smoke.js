import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const repoRoot = process.cwd()
const docPath = path.join(
  repoRoot,
  'docs',
  'supabase-c5-2a-thiet-ke-hoc-phi-tbhp-cloud-source-of-truth.md',
)

assert(fs.existsSync(docPath), 'Docs C5.2A must exist.')

const doc = fs.readFileSync(docPath, 'utf8')

const requiredText = [
  '# C5.2A - Thiết kế Học phí / TBHP cloud source-of-truth',
  'tuition_record_package',
  'C5.2A không runtime implementation',
  'không SQL',
  'không Supabase action',
  'C5.2A không nối attendance sang học phí',
  'không cập nhật `usedSessions`',
  'không cập nhật `remainingSessions`',
  'Teacher/consultant direct write: HOLD',
  '`owner`',
  '`qtv`',
  '`center_admin`',
  '`admin`',
  'Local fallback',
  'source-of-truth',
  'Đề xuất phase tiếp theo',
  'Cloud/core sync entities hiện có',
  'Realtime subscriptions wired hiện có',
  '`class_session` có cloud/core sync, nhưng không có dedicated realtime subscription riêng',
]

for (const text of requiredText) {
  assert(doc.includes(text), `Docs must include: ${text}`)
}

const requiredSections = [
  '## 1. Trạng thái hiện tại',
  '## 2. Phạm vi C5.2A',
  '## 3. Những gì C5.2A không làm',
  '## 4. Audit dữ liệu Học phí/TBHP hiện tại',
  '## 5. Đề xuất canonical entity: tuition_record_package',
  '## 6. Đề xuất payload model',
  '## 7. Natural key / local_id strategy',
  '## 8. Luồng đọc dữ liệu',
  '## 9. Luồng ghi dữ liệu',
  '## 10. Role guard',
  '## 11. Local fallback',
  '## 12. Realtime strategy',
  '## 13. Conflict strategy tối thiểu',
  '## 14. Không nối attendance sang học phí trong C5.2A',
  '## 15. Quan hệ tương lai với attendance/session_report',
  '## 16. TBHP strategy',
  '## 17. Migration/backfill strategy cho phase sau',
  '## 18. SQL/manual pack cần hay không, để phase sau quyết định',
  '## 19. Manual QA plan',
  '## 20. Risks / blockers',
  '## 21. Đề xuất phase tiếp theo',
]

for (const section of requiredSections) {
  assert(doc.includes(section), `Docs must include section: ${section}`)
}

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

for (const token of forbiddenMojibake) {
  assert(!doc.includes(token), `Docs must not include mojibake token: ${token}`)
}

const testSource = fs.readFileSync(new URL(import.meta.url), 'utf8')

for (const token of forbiddenMojibake) {
  assert(!testSource.includes(token), `Smoke test must not include mojibake token: ${token}`)
}

assert(
  !/from\s+['"]\.\.\/src\//.test(testSource) &&
    !/import\s*\([^)]*['"]\.\.\/src\//.test(testSource),
  'Smoke test must not import or require C5.2 runtime files.',
)

console.log('Smoke C5.2A: PASS')
