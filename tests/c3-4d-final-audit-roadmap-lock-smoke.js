import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const roadmapPath = path.join(repoRoot, 'docs', 'online-roadmap-c3-c6.md')
const roadmap = fs.readFileSync(roadmapPath, 'utf8')

assert(fs.existsSync(roadmapPath), 'Roadmap C3-C6 must exist.')

for (const term of [
  'No signup in app',
  'Accounts are created manually in Supabase/Admin tools',
  'valid account plus center binding opens dashboard',
  'localStorage is cache/fallback, not production source of truth',
  'Cloud is source of truth when online',
  'No SQL apply without user confirmation',
  'No push until T/P online QA pass',
  'C3 - Online guarded foundation',
  'C3.4D - Final audit + roadmap lock + commit local only',
  'C4 - Login Portal + Shared Cloud Source of Truth',
  'C4.4 - Shared staging dataset: bo seed 8 cu khoi default path, dung goi 29 de T/P test',
  'C5 - Realtime nghiep vu nhay cam',
  'C6 - Production / Expansion',
  'Teacher Portal future wire',
  'Teacher may be approved/assigned to one or more centers',
  'Teacher app can select center if assigned to multiple centers',
  'view own TKB',
  'diem danh',
  'bao cao lop/Trello',
  'Prefer one Supabase project with many centers first',
]) {
  assert(roadmap.includes(term), `Roadmap missing term: ${term}`)
}

assert(!/SQL (has been|was) applied/i.test(roadmap), 'Roadmap must not claim SQL was applied.')
assert(!/production realtime (has passed|passed|da pass)/i.test(roadmap), 'Roadmap must not claim production realtime passed.')
assert(!/live realtime (has passed|passed)/i.test(roadmap), 'Roadmap must not claim live realtime passed.')

const c3Files = [
  'docs/online-roadmap-c3-c6.md',
  'docs/online-collaboration-architecture-c3-0.md',
  'docs/online-access-control-c3-1.md',
  'docs/online-student-realtime-c3-2.md',
  'docs/online-teacher-realtime-c3-3.md',
  'docs/online-schedule-bridge-c3-4a.md',
  'docs/online-schedule-session-bridge-c3-4b.md',
  'docs/online-schedule-session-realtime-c3-4c.md',
  'docs/supabase-c3-2-1-membership-realtime-readiness.md',
  'docs/supabase-c3-2-2-sql-apply-runbook.md',
  'docs/c3-3-1-audit-checkpoint-truoc-c3-4.md',
  'src/online-access-control.js',
  'src/cloud-realtime-students.js',
  'src/cloud-realtime-teachers.js',
  'src/cloud-schedule-session-bridge.js',
  'src/cloud-realtime-schedule-sessions.js',
  'tests/c3-0-online-collaboration-architecture-smoke.js',
  'tests/c3-1-auth-membership-readonly-gate-smoke.js',
  'tests/c3-2-online-hoc-vien-realtime-mvp-smoke.js',
  'tests/c3-2-1-membership-realtime-readiness-smoke.js',
  'tests/c3-2-2-review-sql-patch-membership-realtime-smoke.js',
  'tests/c3-3-online-giao-vien-realtime-mvp-smoke.js',
  'tests/c3-3-1-audit-checkpoint-truoc-c3-4-smoke.js',
  'tests/c3-4a-audit-bridge-class-session-schedule-session-smoke.js',
  'tests/c3-4b-schedule-session-bridge-readiness-guarded-smoke.js',
  'tests/c3-4c-schedule-session-realtime-guarded-runtime-smoke.js',
  'tests/c3-4d-final-audit-roadmap-lock-smoke.js',
]

for (const filePath of c3Files) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C3 audit file: ${filePath}`)
}

const mojibakePatterns = [
  [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x0192],
  [0x0102, 0x2020, 0x00c2, 0x00b0],
  [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x00a1, 0x00c2, 0x00bb, 0xfffd],
].map((codes) => String.fromCodePoint(...codes))

for (const filePath of c3Files) {
  const source = fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${filePath} contains mojibake pattern`)
  }
}

const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main.js'), 'utf8')
assert(!mainSource.includes('createSignup'), 'C3.4D must not open signup runtime.')
assert(!mainSource.includes('TeacherPortal'), 'C3.4D must not build Teacher Portal runtime.')
assert(!mainSource.includes('SuperAdmin'), 'C3.4D must not build Super Admin runtime.')

console.log('C3.4D final audit roadmap lock smoke passed')
