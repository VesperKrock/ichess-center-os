import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildAttendanceBatchCommand, mutateAttendanceBatch } from '../src/cloud-authoritative-attendance-batch.js'
import { createAuthoritativeAttendanceTuitionMutation, mutateAuthoritativeAttendanceTuitionEntities } from '../src/cloud-authoritative-attendance-tuition.js'
import { upsertC51AttendanceSessionReportCloudEntities } from '../src/cloud-attendance-realtime.js'
import { buildCanonicalAttendanceLedger } from '../src/attendance-ledger.js'
import { createAttendancePdfProjection, planAttendancePdfPages } from '../src/attendance-pdf.js'
import { buildTrelloReportText, renderScheduleModule } from '../src/schedule-module.js'

const read = path => readFileSync(path, 'utf8')
const migration = read('supabase/migrations/202610050001_n2_attendance_write_authority_audit_foundation.sql')
const main = read('src/main.js')
const schedule = read('src/schedule-module.js')
const oldClient = read('src/cloud-authoritative-occurrence-attendance.js')
assert.match(migration, /drop function public\.v2_3_mutate_occurrence_attendance\(/)
assert.match(migration, /v_type='attendance_record'[\s\S]*ATTENDANCE_TYPED_COMMAND_REQUIRED/)
assert.match(migration, /create function public\.v2_9_mutate_attendance_batch\(/)
assert.match(migration, /create function public\.v2_9_list_attendance_audit_events\(/)
assert.match(migration, /force row level security/)
assert.match(migration, /n2_guard_business_audit_update_delete/)
assert.match(migration, /n2_internal_append_business_audit_event/)
assert.doesNotMatch(main + schedule + oldClient, /v2_3_mutate_occurrence_attendance|mutateV23OccurrenceAttendance|writeV23OccurrenceAttendanceThroughCloud/)
assert.doesNotMatch(main + oldClient, /v2_3_get_attendance_capability|refreshV23AttendanceCapability/)
assert.doesNotMatch(main + schedule, /data-admin-attendance|data-a5-attendance|data-session-report-attendance|save-attendance|Chỉnh điểm danh tại Thời khóa biểu/)
assert.doesNotMatch(read('src/attendance-records.js'), /export function (createAdminAttendanceRecord|upsertAdminAttendanceRecords|createTeacherAttendanceRecord|upsertTeacherAttendanceRecords)/)

const base = { action: 'SET', studentId: 'student-a', scheduleSessionId: 'session-a',
  occurrenceDate: '2026-10-05', expectedRecords: [] }
assert.deepEqual(buildAttendanceBatchCommand([{ ...base, attendanceStatus: 'absent' }]).changes[0].absenceReason, null)
assert.deepEqual(buildAttendanceBatchCommand([{ ...base, attendanceStatus: 'present', absenceReason: 'old' }]).changes[0].absenceReason, null)
assert.throws(() => buildAttendanceBatchCommand([{ ...base, attendanceStatus: 'trial' }]), /Trạng thái/)
assert.throws(() => buildAttendanceBatchCommand([{ ...base, attendanceStatus: 'excused' }]), /Trạng thái/)
assert.throws(() => buildAttendanceBatchCommand([{ ...base, attendanceStatus: 'excusedAbsent' }]), /Trạng thái/)
assert.throws(() => buildAttendanceBatchCommand([{ ...base, attendanceStatus: 'unexcusedAbsent' }]), /Trạng thái/)
assert.throws(() => buildAttendanceBatchCommand([{ ...base, attendanceStatus: 'makeup' }]), /buổi Vắng gốc/)
assert.deepEqual(buildAttendanceBatchCommand([{ ...base, action: 'UNMARK' }]).changes[0], {
  action: 'UNMARK', studentId: 'student-a', scheduleSessionId: 'session-a',
  occurrenceDate: '2026-10-05', expectedRecords: [],
})
assert.throws(() => buildAttendanceBatchCommand([
  { ...base, attendanceStatus: 'present' }, { ...base, attendanceStatus: 'absent' },
]), /trùng/)
assert.throws(() => createAuthoritativeAttendanceTuitionMutation({
  entityType: 'attendance_record', localId: 'forbidden', entity: {},
}), /Loại dữ liệu/)
const noC52 = await mutateAuthoritativeAttendanceTuitionEntities({
  supabase: { rpc: () => { throw Error('C5.2 must not be called') } }, centerId: 'center-a',
  mutations: [{ entityType: 'attendance_record', localId: 'forbidden', entity: {} }],
})
assert.equal(noC52.outcome_code, 'ATTENDANCE_TYPED_COMMAND_REQUIRED')
const noRealtime = await upsertC51AttendanceSessionReportCloudEntities({
  supabase: { rpc: () => { throw Error('C5.2 must not be called') } }, centerId: 'center-a',
  accessState: { isSupabaseConfigured: true, isSignedIn: true, cloudReady: true,
    canWrite: true, role: 'owner' }, attendanceRecords: [{ id: 'forbidden' }],
})
assert.equal(noRealtime.ok, false)
const calls = []
const saved = await mutateAttendanceBatch({
  supabase: { rpc: async (name, params) => {
    calls.push({ name, params })
    return { data: { ok: true, outcome_code: 'COMMITTED', audit_batch_id: 'batch-id',
      change_count: 1, results: [{ entity_type: 'attendance_record' }] } }
  } }, centerId: 'center-a', changes: [{ ...base, attendanceStatus: 'present' }],
  idempotencyKey: 'key-a',
})
assert.equal(saved.auditBatchId, 'batch-id')
assert.equal(calls[0].name, 'v2_9_mutate_attendance_batch')
assert.equal(calls[0].params.p_command.changes[0].attendanceStatus, 'present')

const date = '2026-09-21'
const occurrence = { center_id: 'center-a', schedule_session_local_id: 'session-a',
  occurrence_date: date, class_session_local_id: 'class-a', roster_student_ids: ['student-a'],
  lifecycle_state: 'HELD', context_origin: 'CURRENT_SCHEDULE',
  planned_start_time: '09:00:00', planned_end_time: '10:00:00', room: 'A',
  planned_teacher_name: 'Teacher', actual_teacher_override: false }
const trial = { id: 'trial-a', authorityLocalId: 'attendance_record::v2-3::trial-a',
  attendanceAuthority: 'v2.3-occurrence-v1', cloudVersion: 1,
  studentId: 'student-a', scheduleSessionId: 'session-a', sessionId: 'session-a',
  date, source: 'admin', attendanceStatus: 'trial' }
const model = buildCanonicalAttendanceLedger({
  students: [{ id: 'student-a', fullName: 'Trial Student' }],
  classSessions: [{ id: 'class-a', name: 'Class A' }], occurrences: [occurrence],
  attendanceRecords: [trial], filters: { fromDate: date, toDate: date },
  now: new Date('2026-10-05T12:00:00Z'),
})
assert.equal(model.rows[0].cells[0].state, 'historicalTrial')
assert.equal(model.rows[0].cells[0].mark, 'T')
const pdf = createAttendancePdfProjection(model)
assert.equal(pdf.rows[0].cells[0].mark, 'T')
assert.deepEqual(planAttendancePdfPages(pdf, text => text.length * 5).length > 0, true)
for (const status of ['excused', 'excusedAbsent', 'unexcusedAbsent']) {
  const absent = buildCanonicalAttendanceLedger({
    students: [{ id: 'student-a', fullName: 'Student' }], occurrences: [occurrence],
    attendanceRecords: [{ ...trial, attendanceStatus: status }],
    filters: { fromDate: date, toDate: date }, now: new Date('2026-10-05T12:00:00Z'),
  })
  assert.equal(absent.rows[0].cells[0].state, 'absent')
}
const scheduleHtml = renderScheduleModule([{
  id: 'session-a', scheduleType: 'oneOff', title: 'QA session', date,
  occurrenceDate: date, startTime: '09:00', endTime: '10:00',
  room: 'A', studentIds: ['student-a'], status: 'scheduled',
}], null, { sessionId: 'session-a', occurrenceDate: date, mode: 'teacherReport' },
[], null, null, null, null, false, null, [],
[{ id: 'student-a', fullName: 'Student' }], date)
for (const selector of ['session-report-guests', 'session-report-learning',
  'session-report-extra-fields', 'session-report-trello']) {
  assert.match(scheduleHtml, new RegExp(selector))
}
assert.doesNotMatch(scheduleHtml, /data-admin-attendance|data-session-report-attendance|save-attendance/)
const trello = buildTrelloReportText({
  session: { occurrenceDate: date, studentIds: ['student-a'] },
  report: { attendance: [{ studentId: 'student-a', attendanceStatus: 'trial' }] },
  students: [{ id: 'student-a', fullName: 'Trial Student' }],
})
assert.match(trello, /0\/1/)
assert.doesNotMatch(trello, /Trial Student/)
console.log('N2_ATTENDANCE_AUTHORITY_AUDIT_SMOKE: PASS')
