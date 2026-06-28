import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const repoRoot = process.cwd()
const docsPath = path.join(repoRoot, 'docs', 'supabase-c5-2d-qa-hai-browser-hoc-phi-tbhp-cloud-parity.md')
const bridgePath = path.join(repoRoot, 'src', 'cloud-tuition-record-package-bridge.js')

assert(fs.existsSync(docsPath), 'Docs C5.2D must exist.')
assert(fs.existsSync(bridgePath), 'Runtime bridge file must exist.')

const docs = fs.readFileSync(docsPath, 'utf8')
const bridge = fs.readFileSync(bridgePath, 'utf8')
const testSource = fs.readFileSync(new URL(import.meta.url), 'utf8')

for (const text of [
  '# C5.2D - QA hai browser Học phí/TBHP cloud parity + fallback',
  'QA hai browser',
  'tuition_record_package',
  'ichessCenterOS.tuition.dreamhome',
  'center_cloud_entities',
  'cloud parity',
  'realtime parity',
  'local fallback',
  'role guard',
  'teacher/consultant direct write',
  'TEACHER_CONSULTANT_DIRECT_WRITE: HOLD',
  'ATTENDANCE_TO_TUITION_AUTO_LINK: NO',
  'Không tự cập nhật `usedSessions` từ attendance',
  'Không tự cập nhật `remainingSessions` từ attendance',
  'SQL: NOT CREATED / NOT RUN',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'RUNTIME CHANGE: NO, UNLESS BLOCKER HOTFIX IS EXPLICITLY REPORTED',
]) {
  assert(docs.includes(text), `Docs must include: ${text}`)
}

for (const section of [
  '## 1. Mục tiêu C5.2D',
  '## 2. Trạng thái trước C5.2D',
  '## 3. C5.2B verification PASS',
  '## 4. C5.2C runtime summary',
  '## 5. Những gì C5.2D không làm',
  '## 6. Điều kiện chuẩn bị QA',
  '## 7. Checklist QA một browser',
  '## 8. Checklist QA hai browser T/P',
  '## 9. Checklist cloud parity',
  '## 10. Checklist realtime parity',
  '## 11. Checklist local fallback',
  '## 12. Checklist cloud empty/error không xóa local',
  '## 13. Checklist role guard',
  '## 14. Checklist teacher/consultant direct write HOLD',
  '## 15. Checklist TBHP behavior',
  '## 16. Checklist không attendance -> tuition auto-link',
  '## 17. Dữ liệu cần quan sát trong Supabase',
  '## 18. Kỳ vọng kết quả',
  '## 19. Cách phân loại PASS / NEEDS REVIEW',
  '## 20. Risks / limitations',
  '## 21. Next recommendation',
]) {
  assert(docs.includes(section), `Docs must include section: ${section}`)
}

for (const text of [
  "TUITION_RECORD_PACKAGE_ENTITY_TYPE = 'tuition_record_package'",
  'center_cloud_entities',
  'C52_WRITE_ROLES',
  'C52_TEACHER_CONSULTANT_WRITE_HOLD',
  'Cloud soft delete observed; local tuition record preserved for safety.',
  'attendanceLinked: false',
  'usedSessionsAutoUpdateFromAttendance: false',
  'remainingSessionsAutoUpdateFromAttendance: false',
]) {
  assert(bridge.includes(text), `Bridge must include: ${text}`)
}

assert(!/\.delete\s*\(/i.test(bridge), 'Bridge must not hard delete cloud data.')
assert(!/localStorage\.removeItem|localStorage\.clear/i.test(bridge), 'Bridge must not hard delete local data.')
assert(!/attendance_record.*usedSessions|session_report.*usedSessions/i.test(bridge), 'Bridge must not use attendance/session_report to update tuition sessions.')

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
  ['smoke test', testSource],
]) {
  for (const token of forbiddenMojibake) {
    assert(!content.includes(token), `${label} must not include mojibake token: ${token}`)
  }
}

console.log('Smoke C5.2D: PASS')
