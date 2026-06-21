import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const runbookPath = path.join(repoRoot, 'docs', 'supabase-c3-2-2-sql-apply-runbook.md')
const patchPlanPath = path.join(
  repoRoot,
  'docs',
  'supabase-c3-2-1-membership-realtime-readiness.sql',
)

assert(fs.existsSync(runbookPath), 'C3.2.2 runbook must exist.')
assert(fs.existsSync(patchPlanPath), 'C3.2.1 SQL patch plan must still exist.')

const runbook = fs.readFileSync(runbookPath, 'utf8')
const patchPlan = fs.readFileSync(patchPlanPath, 'utf8')

for (const term of [
  'C3.2.2 khong apply SQL',
  'WAITING USER CONFIRMATION BEFORE APPLYING SQL',
  'center_members',
  'center_cloud_entities',
  'supabase_realtime',
  'REPLICA IDENTITY FULL',
  'Suggested apply order',
  'Step 0 - Backup / preflight',
  'Step 1 - Membership table/check',
  'Step 2 - Membership indexes',
  'Step 3 - Membership RLS/policies',
  'Step 4 - Cloud entity RLS/permissions',
  'Step 5 - Realtime publication',
  'Verification queries',
  'Manual QA checklist',
  'Viewer/read-only',
  'Cross-center isolation',
  'Safety audit',
  'NEEDS SQL REVIEW',
  'NEEDS SUPABASE CONFIRMATION',
]) {
  assert(runbook.includes(term), `Runbook missing required term: ${term}`)
}

for (const queryTerm of [
  'information_schema.tables',
  'information_schema.columns',
  'pg_policies',
  'pg_publication_tables',
  'pg_constraint',
  'pg_class',
]) {
  assert(runbook.includes(queryTerm), `Runbook missing verification query term: ${queryTerm}`)
}

assert(!/SQL (has been|was) applied/i.test(runbook), 'Runbook must not claim SQL was applied.')
assert(!/live realtime (has passed|passed)/i.test(runbook), 'Runbook must not claim live realtime passed.')

const destructivePatterns = [
  /\bdrop\s+table\b/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
]

for (const pattern of destructivePatterns) {
  assert(!pattern.test(patchPlan), `Patch plan must not contain destructive SQL: ${pattern}`)
}

assert(patchPlan.includes('create table if not exists public.center_members'))
assert(patchPlan.includes('alter table public.center_members enable row level security'))
assert(patchPlan.includes('create policy "members can read own center memberships"'))
assert(patchPlan.includes('alter publication supabase_realtime add table public.center_cloud_entities'))
assert(patchPlan.includes('replica identity full'))
assert(!/insert\s+into\s+public\.center_members/i.test(patchPlan), 'Patch plan must not seed memberships.')
assert(!/@/i.test(patchPlan), 'Patch plan must not hardcode emails.')

const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main.js'), 'utf8')
const realtimeSource = fs.readFileSync(path.join(repoRoot, 'src', 'cloud-realtime-students.js'), 'utf8')

assert(!realtimeSource.includes('CLOUD_ENTITY_TYPES.TEACHER'), 'Student realtime helper must remain student-only.')
assert(!realtimeSource.includes('teacher-realtime'), 'Student realtime helper must not expand to teacher realtime.')
assert(!mainSource.includes('cloud-realtime-schedules'), 'C3.2.2/C3.3 must not add schedule realtime runtime.')
assert(!mainSource.includes('cloud-realtime-tuition'), 'C3.2.2/C3.3 must not add tuition realtime runtime.')
assert(!mainSource.includes('cloud-realtime-attendance'), 'C3.2.2/C3.3 must not add attendance realtime runtime.')

console.log('C3.2.2 SQL patch review runbook smoke passed')
