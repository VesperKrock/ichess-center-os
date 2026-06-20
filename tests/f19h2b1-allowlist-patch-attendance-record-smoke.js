import assert from 'node:assert/strict'
import fs from 'node:fs'

const docs = fs.readFileSync(
  new URL('../docs/supabase-attendance-record-allowlist-patch-f19h2b1.md', import.meta.url),
  'utf8',
)
const sqlPatch = fs.readFileSync(
  new URL('../docs/supabase-f19h2b1-attendance-record-allowlist.sql', import.meta.url),
  'utf8',
)
const c1Sql = fs.readFileSync(
  new URL('../docs/supabase-c1-cloud-db-foundation.sql', import.meta.url),
  'utf8',
)
const c22Sql = fs.readFileSync(
  new URL('../docs/supabase-c2-2-cloud-db-permissions-fix.sql', import.meta.url),
  'utf8',
)
const cloudEntitiesSource = fs.readFileSync(
  new URL('../src/cloud-db-entities.js', import.meta.url),
  'utf8',
)
const attendanceCloudSource = fs.readFileSync(
  new URL('../src/cloud-attendance-records.js', import.meta.url),
  'utf8',
)

assert(docs.includes('attendance_record'))
assert(docs.includes('student'))
assert(docs.includes('teacher'))
assert(docs.includes('class_session'))
assert(docs.includes('docs/supabase-f19h2b1-attendance-record-allowlist.sql'))
assert(docs.includes('NEEDS SQL/ALLOWLIST PATCH'))
assert(docs.includes('F19H.2b.2'))
assert(docs.includes('Học phí'))
assert(docs.includes('Chưa chạy SQL lên Supabase.'))
assert(docs.includes('Chưa real push/pull cloud.'))
assert(docs.includes('Chưa auto sync.'))

assert(sqlPatch.includes('F19H.2b.1: allow attendance_record entity in center_cloud_entities'))
assert(sqlPatch.includes('drop constraint if exists center_cloud_entities_entity_type_check'))
assert(sqlPatch.includes("check (entity_type in ('student', 'teacher', 'class_session', 'attendance_record'))"))
assert(sqlPatch.includes("notify pgrst, 'reload schema'"))
assert(!/create\s+table/i.test(sqlPatch), 'Allowlist patch must not create a new table.')
assert(!/to\s+anon/i.test(sqlPatch), 'Allowlist patch must not grant anon access.')
assert(!/service_role/i.test(sqlPatch), 'Allowlist patch must not mention service_role.')

assert(c1Sql.includes("entity_type in ('student', 'teacher', 'class_session')"))
assert(c22Sql.includes("entity_type in ('student', 'teacher', 'class_session')"))
assert(
  !c1Sql.includes('attendance_record') && !c22Sql.includes('attendance_record'),
  'F19H.2b.1 must not edit existing production SQL files.',
)

assert(!cloudEntitiesSource.includes('ATTENDANCE_RECORD'))
assert(!cloudEntitiesSource.includes('attendance_record'))
assert(attendanceCloudSource.includes("ATTENDANCE_RECORD_CLOUD_ENTITY_TYPE = 'attendance_record'"))

const runtimeSources = [
  '../src/main.js',
  '../src/cloud-db-sync.js',
  '../src/cloud-db-entities.js',
].map((filePath) => fs.readFileSync(new URL(filePath, import.meta.url), 'utf8')).join('\n')
assert(!runtimeSources.includes('attendance_record'))
assert(!runtimeSources.includes('session_report'))
assert(!runtimeSources.includes('schedule_session'))
assert(!runtimeSources.includes('tuition_record'))
assert(!runtimeSources.includes('realtime'))

console.log('F19H.2b.1 allowlist patch attendance_record smoke passed')
