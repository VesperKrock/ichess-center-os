import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const repoRoot = process.cwd()
const docPath = 'docs/c4-8-no-push-checkpoint-review.md'
const smokePath = 'tests/c4-8-no-push-checkpoint-review-smoke.js'

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

const doc = read(docPath)
const smoke = read(smokePath)

assert(doc.includes('# C4.8 - No-push Checkpoint Review'))
assert(doc.includes('| Phase | Status | Notes |'))

for (const phase of [
  'C4.0',
  'C4.1',
  'C4.2',
  'C4.3',
  'C4.4',
  'C4.5',
  'C4.5.1',
  'C4.5.2',
  'C4.6A',
  'C4.6B',
  'C4.7',
  'C4.7.1',
]) {
  assert(doc.includes(`| ${phase} |`), `Missing phase row ${phase}`)
}

assert(doc.includes('T/P same cloud data: PASS'))
assert(doc.includes('Student count 29 -> 30 after UI add: PASS'))
assert(doc.includes('Teacher count 6: PASS'))
assert(doc.includes('Student realtime/write-through MVP: PASS'))

assert(doc.includes('SQL applied by user: YES'))
assert(doc.includes('User đã chạy SQL C4.6B tới Step 6'))
assert(doc.includes('Data loss reported: NO'))
assert(doc.includes('RLS/realtime/constraint verify: expected PASS by user screenshots/report'))

assert(doc.includes('Scroll retention Học viên still fails manual QA'))
assert(doc.includes('Form Tab order Học viên/Phụ huynh still not smooth enough'))
assert(doc.includes('C4.7.1 artifact docs/test missing in retry'))
assert(doc.includes('required smoke is skipped by C4.9 retry'))
assert(doc.includes('C4.7.1 manual browser UX chưa pass'))
assert(doc.includes('Treat as UX debt, not blocker for C4 shared-cloud checkpoint'))

assert(doc.includes('## Worktree Audit'))
assert(doc.includes('69c47e9 C3 online guarded foundation'))
assert(doc.includes('src/main.js'))
assert(doc.includes('src/student-module.js'))
assert(doc.includes('docs/c4-8-no-push-checkpoint-review.md'))
assert(doc.includes('tests/c4-8-no-push-checkpoint-review-smoke.js'))

assert(doc.includes('Risk level: MEDIUM'))
assert(doc.includes('Legacy policies cũ có thể còn tồn tại song song với C4.6B policies'))
assert(doc.includes('schedule_session'))

assert(doc.includes('Ready for local commit C4 checkpoint: YES, after user confirmation.'))
assert(doc.includes('Ready for push: NO, unless user explicitly requests'))
assert(doc.includes('Suggested commit message: `C4 shared cloud login and realtime MVP`'))

assert(doc.includes('C5.1 - Điểm danh / báo cáo ca dạy realtime'))
assert(doc.includes('C5.2 - Học phí / TBHP cloud source of truth'))
assert(doc.includes('C5.3 - Audit log / conflict / rollback'))

const forbiddenDocClaims = [
  /production ready/i,
  /C4\.7\.1\s*\|\s*SMOKE PASS/i,
  /scroll\/tab manual pass/i,
  /browser UX pass/i,
  /Ready for push:\s*YES/i,
  /Commit\/push:\s*DONE/i,
]

for (const pattern of forbiddenDocClaims) {
  assert(!pattern.test(doc), `Forbidden checkpoint claim: ${pattern}`)
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
  assert(!pattern.test(doc), `Doc must not contain SQL apply text: ${pattern}`)
}

const forbiddenRuntimePatterns = [
  /\bsignUp\s*\(/,
  /seedCloud29/i,
  /supabase\.from\([^)]*\)\.insert/i,
]

for (const pattern of forbiddenRuntimePatterns) {
  assert(!pattern.test(doc), `Forbidden runtime/data-change pattern in doc: ${pattern}`)
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

console.log('C4.8 no-push checkpoint review smoke passed')
