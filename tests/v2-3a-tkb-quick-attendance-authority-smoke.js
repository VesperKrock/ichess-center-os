import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  buildUnifiedAttendanceRecords,
  normalizeStoredAttendanceRecord,
} from '../src/attendance-records.js'
import {
  V23_ATTENDANCE_CAPABILITY_STATUS,
  buildV23OccurrenceAttendanceCommand,
  createV23AttendanceCapabilityState,
  getV23OccurrenceAttendanceRecords,
  isV23AttendanceBackendUnavailable,
  isV23AttendanceCapabilityReady,
  mutateV23OccurrenceAttendance,
  pullV23AttendanceCapability,
  selectCurrentV23OccurrenceAttendanceRecord,
} from '../src/cloud-authoritative-occurrence-attendance.js'
import { createAttendanceRecordCloudLocalId } from '../src/cloud-attendance-records.js'
import { renderScheduleModule } from '../src/schedule-module.js'

const read = (path) => readFileSync(path, 'utf8')
const migrationPath = 'supabase/migrations/202609100001_v2_3_schedule_occurrence_attendance_authority.sql'
const migration = read(migrationPath)
const main = read('src/main.js')

assert.deepEqual(Object.values(V23_ATTENDANCE_CAPABILITY_STATUS), [
  'idle', 'loading', 'ready', 'unavailable', 'failed',
])
for (const status of Object.values(V23_ATTENDANCE_CAPABILITY_STATUS)) {
  assert.equal(isV23AttendanceCapabilityReady(
    createV23AttendanceCapabilityState({ centerId: 'center-a', status }),
    'center-a',
  ), status === 'ready')
}
assert.equal(isV23AttendanceCapabilityReady(
  createV23AttendanceCapabilityState({ centerId: 'center-a', status: 'ready' }),
  'center-b',
), false)

const occurrence = {
  id: 'schedule-wed-fri',
  classSessionId: 'class-wed-fri',
  occurrenceDate: '2026-09-11',
  studentIds: ['student-a'],
}
const legacyAdmin = normalizeStoredAttendanceRecord({
  id: 'legacy-admin', studentId: 'student-a', date: '2026-09-11',
  scheduleSessionId: occurrence.id, sessionId: occurrence.id,
  source: 'admin', attendanceStatus: 'present', status: 'present', cloudVersion: 3,
})
const legacyTeacher = normalizeStoredAttendanceRecord({
  id: 'legacy-teacher', studentId: 'student-a', date: '2026-09-11',
  scheduleSessionId: occurrence.id, sessionId: occurrence.id,
  source: 'teacher', attendanceStatus: 'absent', status: 'absent', cloudVersion: 2,
})
const unrelated = normalizeStoredAttendanceRecord({
  id: 'other-date', studentId: 'student-a', date: '2026-09-12',
  scheduleSessionId: occurrence.id, sessionId: occurrence.id,
  source: 'admin', attendanceStatus: 'present', status: 'present', cloudVersion: 1,
})
assert.equal(getV23OccurrenceAttendanceRecords(
  [legacyTeacher, unrelated, legacyAdmin], occurrence, 'student-a',
).length, 2)
assert.equal(selectCurrentV23OccurrenceAttendanceRecord(
  [legacyTeacher, legacyAdmin], occurrence, 'student-a',
)?.source, 'admin')
assert.deepEqual(buildUnifiedAttendanceRecords({
  sessionReports: [],
  storedRecords: [legacyTeacher, legacyAdmin],
}), [legacyAdmin], 'Legacy source collisions must project one deterministic operational truth')

const command = buildV23OccurrenceAttendanceCommand({
  centerId: 'center-a', occurrence,
  attendanceInputs: [{
    studentId: 'student-a', source: 'admin', attendanceStatus: 'excused',
    note: 'Có phép', counted: false, creditValue: 0,
  }],
  currentRecords: [legacyTeacher, unrelated, legacyAdmin],
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
})
assert.equal(command.rpc, 'v2_3_mutate_occurrence_attendance')
assert.equal(command.params.p_schedule_session_id, occurrence.id)
assert.deepEqual(command.params.p_attendance[0].expected_records, [
  { local_id: createAttendanceRecordCloudLocalId(legacyAdmin), version: 3 },
  { local_id: createAttendanceRecordCloudLocalId(legacyTeacher), version: 2 },
].sort((a, b) => a.local_id.localeCompare(b.local_id)))
assert.equal(command.params.p_attendance[0].payload.tuitionPolicyDefined, false)
assert.equal(command.params.p_attendance[0].payload.tuitionAutoUpdateEnabled, false)
assert.equal(command.params.p_attendance[0].payload.tuitionConsumptionApplied, false)

const canonical = normalizeStoredAttendanceRecord({
  id: 'attendance_record::v2-3::hash',
  authorityLocalId: 'attendance_record::v2-3::hash',
  attendanceAuthority: 'v2.3-occurrence-v1',
  studentId: 'student-a', date: occurrence.occurrenceDate,
  scheduleSessionId: occurrence.id, sessionId: occurrence.id,
  source: 'admin', attendanceStatus: 'excused', status: 'excused', cloudVersion: 1,
})
assert.equal(createAttendanceRecordCloudLocalId(canonical), canonical.authorityLocalId)
assert.deepEqual(buildUnifiedAttendanceRecords({
  sessionReports: [{
    id: 'report-legacy', sessionId: occurrence.id, occurrenceDate: occurrence.occurrenceDate,
    attendance: [{ studentId: 'student-a', attendanceStatus: 'absent', source: 'teacher' }],
  }],
  storedRecords: [legacyAdmin, legacyTeacher, canonical],
}), [canonical], 'Canonical occurrence truth must hide retired/adapter compatibility evidence')

const rpcCalls = []
const saveResult = await mutateV23OccurrenceAttendance({
  supabase: { rpc: async (name, params) => {
    rpcCalls.push({ name, params })
    return { data: {
      ok: true, center_id: 'center-a', schedule_session_id: occurrence.id,
      occurrence_date: occurrence.occurrenceDate, results: [],
    }, error: null }
  } },
  centerId: 'center-a', occurrence,
  attendanceInputs: [{ studentId: 'student-a', source: 'admin', attendanceStatus: 'present' }],
  currentRecords: [],
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
})
assert.equal(saveResult.ok, true)
assert.equal(rpcCalls[0].name, 'v2_3_mutate_occurrence_attendance')

for (const code of ['PGRST202', 'PGRST205', '42P01', '42883']) {
  assert.equal(isV23AttendanceBackendUnavailable({ code }), true)
  const absent = await pullV23AttendanceCapability({
    centerId: 'center-a',
    supabase: { rpc: async () => ({ data: null, error: { code, message: 'missing' } }) },
  })
  assert.equal(absent.outcome_code, 'BACKEND_NOT_DEPLOYED')
}
const capabilityCalls = []
const ready = await pullV23AttendanceCapability({
  centerId: 'center-a',
  supabase: { rpc: async (name, params) => {
    capabilityCalls.push({ name, params })
    return { data: { ok: true, status: 'READY', center_id: 'center-a', contract: 'v2.3-occurrence-v1' }, error: null }
  } },
})
assert.equal(ready.ok, true)
assert.equal(capabilityCalls[0].name, 'v2_3_get_attendance_capability')
assert.equal((await pullV23AttendanceCapability({
  centerId: 'center-b',
  supabase: { rpc: async () => ({ data: { ok: true, status: 'READY', center_id: 'center-a' }, error: null }) },
})).outcome_code, 'INVALID_SERVER_RESULT')

const baseRenderArgs = [
  [{ ...occurrence, scheduleType: 'oneOff', date: occurrence.occurrenceDate, startTime: '19:00', endTime: '20:30', status: 'scheduled' }],
  null,
  { sessionId: occurrence.id, occurrenceDate: occurrence.occurrenceDate, mode: 'roleGateway' },
  [], null, null, null, null, false, null, [], [{ id: 'student-a', fullName: 'A' }],
  '2026-09-07', null,
]
const unavailableHtml = renderScheduleModule(...baseRenderArgs, {
  attendanceAvailable: true, occurrenceAttendanceReady: false, occurrenceAttendanceStatus: 'unavailable',
})
assert.match(unavailableHtml, /Điểm danh tại thời khóa biểu hiện chưa khả dụng/)
assert.match(unavailableHtml, /data-schedule-report-role="admin" disabled/)
const readyHtml = renderScheduleModule(...baseRenderArgs, {
  attendanceAvailable: true, occurrenceAttendanceReady: true, occurrenceAttendanceStatus: 'ready',
})
assert.doesNotMatch(readyHtml, /data-schedule-report-role="admin" disabled/)

for (const token of [
  'create table public.center_occurrence_attendance_command_results',
  'v2_3_internal_occurrence_attendance_local_id',
  'v2_3_guard_occurrence_attendance',
  'v2_3_get_attendance_capability',
  'v2_3_mutate_occurrence_attendance',
  'v2_3_canonical_occurrence_required',
  'v2_3_attendance_version_conflict',
  "v_role is null or v_role not in ('owner', 'qtv', 'center_admin', 'admin')",
  'v2_3_student_not_in_occurrence_roster',
  'public.center_student_enrollment_sets',
  'tuitionPolicyDefined',
  'tuitionAutoUpdateEnabled',
  'tuitionConsumptionApplied',
  "'counted', false",
  "'countsTowardTuition', false",
  "'creditValue', 0",
  'force row level security',
]) assert.match(migration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
assert.doesNotMatch(migration, /update\s+public\.tuition|tuition_record_package[^\n]*UPSERT/i)
assert.match(main, /writeV23OccurrenceAttendanceThroughCloud/)
assert.match(main, /admin-attendance-save-v2-3/)
assert.match(main, /teacher-session-report-attendance-v2-3/)
assert.doesNotMatch(main, /attendanceInputs:[\s\S]{0,300}writeC52AttendanceSessionReportThroughCloud/)

const hash = createHash('sha256').update(readFileSync(migrationPath)).digest('hex').toUpperCase()
console.log(`V2_3A_TKB_QUICK_ATTENDANCE_AUTHORITY_SMOKE: PASS (${hash})`)
