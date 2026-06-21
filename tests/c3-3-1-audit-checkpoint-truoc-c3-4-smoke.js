import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

const requiredFiles = [
  'docs/online-collaboration-architecture-c3-0.md',
  'docs/online-access-control-c3-1.md',
  'docs/online-student-realtime-c3-2.md',
  'docs/supabase-c3-2-1-membership-realtime-readiness.md',
  'docs/supabase-c3-2-1-membership-realtime-readiness.sql',
  'docs/supabase-c3-2-2-sql-apply-runbook.md',
  'docs/online-teacher-realtime-c3-3.md',
  'docs/c3-3-1-audit-checkpoint-truoc-c3-4.md',
  'src/online-access-control.js',
  'src/cloud-realtime-students.js',
  'src/cloud-realtime-teachers.js',
  'tests/c3-0-online-collaboration-architecture-smoke.js',
  'tests/c3-1-auth-membership-readonly-gate-smoke.js',
  'tests/c3-2-online-hoc-vien-realtime-mvp-smoke.js',
  'tests/c3-2-1-membership-realtime-readiness-smoke.js',
  'tests/c3-2-2-review-sql-patch-membership-realtime-smoke.js',
  'tests/c3-3-online-giao-vien-realtime-mvp-smoke.js',
  'tests/c3-3-1-audit-checkpoint-truoc-c3-4-smoke.js',
]

for (const filePath of requiredFiles) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C3.3.1 required file: ${filePath}`)
}

const c3Docs = [
  'docs/online-collaboration-architecture-c3-0.md',
  'docs/online-access-control-c3-1.md',
  'docs/online-student-realtime-c3-2.md',
  'docs/supabase-c3-2-1-membership-realtime-readiness.md',
  'docs/supabase-c3-2-2-sql-apply-runbook.md',
  'docs/online-teacher-realtime-c3-3.md',
  'docs/c3-3-1-audit-checkpoint-truoc-c3-4.md',
].map((filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8'))

const docsText = c3Docs.join('\n')

assert(docsText.includes('NEEDS MEMBERSHIP SQL PATCH'))
assert(docsText.includes('NEEDS SUPABASE REALTIME PATCH'))
assert(docsText.includes('NEEDS SUPABASE CONFIRMATION'))
assert(docsText.includes('class_session'))
assert(docsText.includes('schedule_session'))
assert(docsText.includes('Option C - split C3.4A/C3.4B'))
assert(docsText.includes('WAITING USER CONFIRMATION BEFORE APPLYING SQL'))
assert(!/SQL (has been|was) applied/i.test(docsText), 'C3 docs must not claim SQL was applied.')
assert(!/live realtime (has passed|passed)/i.test(docsText), 'C3 docs must not claim live realtime passed.')
assert(!/production realtime (has passed|passed|da pass|đã pass)/i.test(docsText), 'C3 docs must not claim production realtime passed.')
assert(!/Manual QA[^:\n]*:\s*PASS/i.test(docsText), 'C3 docs must not claim manual QA passed.')
assert(!/Manual QA[^\n]*(da|đã)\s+pass/i.test(docsText), 'C3 docs must not claim manual QA passed.')

const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main.js'), 'utf8')
const studentHelper = fs.readFileSync(path.join(repoRoot, 'src', 'cloud-realtime-students.js'), 'utf8')
const teacherHelper = fs.readFileSync(path.join(repoRoot, 'src', 'cloud-realtime-teachers.js'), 'utf8')
const scheduleDryRun = fs.readFileSync(path.join(repoRoot, 'src', 'cloud-schedule-sessions.js'), 'utf8')

assert(mainSource.includes('startStudentRealtimeSubscription'))
assert(mainSource.includes('startTeacherRealtimeSubscription'))
assert(studentHelper.includes('STUDENT_REALTIME_ENTITY_TYPE'))
assert(teacherHelper.includes('TEACHER_REALTIME_ENTITY_TYPE'))
assert.equal(studentHelper.includes('CLOUD_ENTITY_TYPES.TEACHER'), false)
assert.equal(teacherHelper.includes('CLOUD_ENTITY_TYPES.STUDENT'), false)

for (const forbiddenRuntime of [
  'subscribeToScheduleCloudRealtime',
  'subscribeToTuitionCloudRealtime',
  'subscribeToAttendanceCloudRealtime',
  'upsertScheduleCloudEntity',
  'upsertTuitionCloudEntity',
  'upsertAttendanceCloudEntity',
]) {
  assert(!mainSource.includes(forbiddenRuntime), `C3.3.1 must not add runtime: ${forbiddenRuntime}`)
}

assert(scheduleDryRun.includes("SCHEDULE_SESSION_CLOUD_ENTITY_TYPE = 'schedule_session'"))
assert(scheduleDryRun.includes('createScheduleSessionCloudDryRun'))
assert(!scheduleDryRun.includes('subscribeToScheduleCloudRealtime'))

const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8')
assert(gitignore.includes('RoadmapRealTime.txt'))
assert(!gitignore.includes('src/'))
assert(!gitignore.includes('docs/'))
assert(!gitignore.includes('tests/'))
assert(!gitignore.includes('*.sql'))

console.log('C3.3.1 audit checkpoint truoc C3.4 smoke passed')
