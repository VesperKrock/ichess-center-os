import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const repoRoot = process.cwd()
const docPath = 'docs/feedback-anh-hai-22-06-triage-f22-0.md'
const smokePath = 'tests/f22-0-feedback-triage-scope-lock-smoke.js'

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

const doc = read(docPath)
const smoke = read(smokePath)

assert(doc.includes('# F22.0 - Feedback anh Hải 22/06: Triage + Scope Lock'))
assert(doc.includes('F22.0 là phase triage feedback và khóa phạm vi, không code runtime'))
assert(doc.includes('dc43dbb C4 shared cloud login and realtime MVP'))
assert(doc.includes('Push: NO'))
assert(doc.includes('chưa push'))

for (const required of [
  '### Báo cáo',
  '### Kho hàng',
  '### Nối dữ liệu',
  '### Nhân viên',
  '### UI/Icon/Background',
  '### Giá trị phần mềm / vận hành cơ sở',
]) {
  assert(doc.includes(required), `Missing feedback group: ${required}`)
}

assert(doc.includes('Học viên -> Phụ huynh -> Học phí'))
assert(doc.includes('Nhân viên/chấm công MVP'))
assert(doc.includes('F22.5 chỉ giữ khung chờ designer/asset sau'))

for (const deadline of ['29/06', '01/07', '10/07', 'Sau F22']) {
  assert(doc.includes(deadline), `Missing deadline ${deadline}`)
}

for (const phase of ['F22.1', 'F22.2', 'F22.3', 'F22.4', 'F22.5']) {
  assert(doc.includes(phase), `Missing phase ${phase}`)
}

assert(doc.includes('F22.1 Kho: làm trước vì quick win'))
assert(doc.includes('F22.2 Báo cáo'))
assert(doc.includes('F22.3 Nhân viên'))
assert(doc.includes('F22.4 Nối dây'))
assert(doc.includes('F22.5 UI placeholder'))

assert(doc.includes('Push: NO until F22.4 done, unless user explicitly asks.'))
assert(doc.includes('online alpha, chưa phải bản nghiệm thu feedback 22/06'))
assert(doc.includes('Next: F22.1 - Kho hàng quick polish'))

const forbiddenRuntimeClaims = [
  /runtime implemented/i,
  /SQL applied/i,
  /Supabase data changed/i,
  /Teacher Portal MVP implemented/i,
  /Super Admin implemented/i,
  /C5 implemented/i,
  /C6 implemented/i,
]

for (const pattern of forbiddenRuntimeClaims) {
  assert(!pattern.test(doc), `Forbidden implementation claim found: ${pattern}`)
}

const forbiddenSqlPatterns = [
  /\bcreate\s+table\b/i,
  /\balter\s+table\b/i,
  /\bdrop\s+table\b/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\s+\w+\s+set\b/i,
]

for (const pattern of forbiddenSqlPatterns) {
  assert(!pattern.test(doc), `F22.0 doc must not contain SQL: ${pattern}`)
}

const mojibakePatterns = [
  /\u00c3[\u0080-\u00bf]/u,
  /\u00c2[\u0080-\u00bf]/u,
  /\u00e2\u20ac[\u0080-\u00bf]/u,
  /\u00ef\u00bf\u00bd/u,
  /\ufffd/u,
]

for (const [label, source] of [
  [docPath, doc],
  [smokePath, smoke],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!pattern.test(source), `${label} has mojibake pattern ${pattern}`)
  }
}

console.log('F22.0 feedback triage scope lock smoke passed')
