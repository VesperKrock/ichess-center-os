import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const readinessDocPath = path.join(
  repoRoot,
  'docs',
  'supabase-c3-2-1-membership-realtime-readiness.md',
)
const patchPlanPath = path.join(
  repoRoot,
  'docs',
  'supabase-c3-2-1-membership-realtime-readiness.sql',
)

assert(fs.existsSync(readinessDocPath), 'C3.2.1 readiness doc must exist.')
assert(fs.existsSync(patchPlanPath), 'C3.2.1 SQL patch plan must exist.')

const readinessDoc = fs.readFileSync(readinessDocPath, 'utf8')
const patchPlan = fs.readFileSync(patchPlanPath, 'utf8')

for (const term of [
  'NEEDS MEMBERSHIP SQL PATCH',
  'NEEDS SUPABASE REALTIME PATCH',
  'center_members',
  'center_cloud_entities',
  'student',
  'Hai tab cung user',
  'Hai tai khoan',
  'Viewer/read-only',
  'Cross-center isolation',
  'Go / no-go for C3.3',
]) {
  assert(readinessDoc.includes(term), `Readiness doc missing: ${term}`)
}

for (const term of [
  'PLAN ONLY',
  'create table if not exists public.center_members',
  'status text',
  'public.is_center_member',
  'public.can_write_center',
  'alter publication supabase_realtime add table public.center_cloud_entities',
  'replica identity full',
]) {
  assert(patchPlan.includes(term), `Patch plan missing: ${term}`)
}

const destructivePatterns = [
  /\bdrop\s+table\b/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
]

for (const pattern of destructivePatterns) {
  assert(!pattern.test(patchPlan), `Patch plan must not contain destructive SQL: ${pattern}`)
}

assert(!/insert\s+into\s+public\.center_members/i.test(patchPlan), 'Patch plan must not seed real memberships.')
assert(!/anh\s*hai|anh\s*hải|@/i.test(patchPlan), 'Patch plan must not hardcode personal user/email access.')

const cloudRealtimeStudents = fs.readFileSync(
  path.join(repoRoot, 'src', 'cloud-realtime-students.js'),
  'utf8',
)
assert(cloudRealtimeStudents.includes("STUDENT_REALTIME_ENTITY_TYPE = CLOUD_ENTITY_TYPES.STUDENT"))
assert(cloudRealtimeStudents.includes("table: 'center_cloud_entities'"))
assert(cloudRealtimeStudents.includes("filter: `center_id=eq.${normalizedCenterId}`"))
assert(cloudRealtimeStudents.includes("candidate.entity_type !== STUDENT_REALTIME_ENTITY_TYPE"))
assert(!cloudRealtimeStudents.includes('CLOUD_ENTITY_TYPES.TEACHER'))
assert(!cloudRealtimeStudents.includes('CLOUD_ENTITY_TYPES.CLASS_SESSION'))
assert(!cloudRealtimeStudents.includes('attendance_record'))
assert(!cloudRealtimeStudents.includes('session_report'))
assert(!cloudRealtimeStudents.includes('tuition_record'))

const accessControl = fs.readFileSync(path.join(repoRoot, 'src', 'online-access-control.js'), 'utf8')
assert(accessControl.includes('NEEDS MEMBERSHIP SQL PATCH'))
assert(accessControl.includes('center_admin'))
assert(accessControl.includes('viewer'))

const c22Sql = fs.readFileSync(path.join(repoRoot, 'docs', 'supabase-c2-2-cloud-db-permissions-fix.sql'), 'utf8')
assert(c22Sql.includes('center_cloud_entities'))
assert(c22Sql.includes("'student'"))
assert(c22Sql.includes('center_members'))
assert(!/alter\s+publication\s+supabase_realtime/i.test(c22Sql), 'Existing C2.2 SQL should not already claim realtime publication.')

console.log('C3.2.1 membership realtime readiness smoke passed')
