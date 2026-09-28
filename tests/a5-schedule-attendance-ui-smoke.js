import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext, runInNewContext } from 'node:vm'
import { buildV23OccurrenceAttendanceCommand, selectCurrentV23OccurrenceAttendanceRecord } from '../src/cloud-authoritative-occurrence-attendance.js'
import { getA5ScheduleAttendanceCardState, renderScheduleModule } from '../src/schedule-module.js'

const studentIds = ['student-a', 'student-b']
const base = {
  id: 'schedule-a5', scheduleType: 'oneOff', date: '2026-09-21',
  startTime: '17:30', endTime: '18:30', studentIds,
  teacherName: 'Teacher today', title: 'Turtle 2', status: 'scheduled',
}
const occurrence = { ...base, occurrenceDate: '2026-09-21', a2LifecycleState: 'HELD' }
const record = (studentId, attendanceStatus) => ({
  attendanceAuthority: 'v2.3-occurrence-v1', scheduleSessionId: base.id,
  date: base.date, studentId, attendanceStatus,
})

assert.equal(getA5ScheduleAttendanceCardState(occurrence, []).kind, 'unmarked')
assert.equal(getA5ScheduleAttendanceCardState(occurrence, []).label, 'Chưa điểm danh')
assert.equal(getA5ScheduleAttendanceCardState(occurrence, [record('student-a', 'present')]).kind, 'partial')
assert.equal(getA5ScheduleAttendanceCardState(occurrence, [record('student-a', 'present'), record('student-b', 'absent')]).kind, 'complete')
assert.equal(getA5ScheduleAttendanceCardState({ ...occurrence, a2LifecycleState: 'CANCELLED' }, []).kind, 'cancelled')
assert.equal(getA5ScheduleAttendanceCardState({ ...base, occurrenceDate: '2030-09-21' }, []).kind, 'future')

const fact = {
  schedule_session_local_id: base.id, occurrence_date: base.date,
  roster_student_ids: studentIds, lifecycle_state: 'HELD',
  planned_start_time: '17:30:00', planned_end_time: '18:30:00', room: 'Room A',
  planned_teacher_name: 'Teacher then', actual_teacher_name: 'Substitute then',
  actual_teacher_override: true,
}
const render = (session, rows = [], options = {}) => renderScheduleModule(
  [session], null, options.reportState ?? null, [], null, null, null, null, false, null,
  [], studentIds.map((id) => ({ id, fullName: id })),
  options.weekStart || session.date,
  options.adminState ?? { rows },
  {
    attendanceAvailable: true, occurrenceAttendanceReady: true, a3TeacherReady: true,
    a3TeacherContext: { occurrences: [fact] }, attendanceRecords: options.records || [],
  },
)
const pastHtml = render(base, [], { weekStart: '2026-09-21' })
assert.match(pastHtml, /data-a5-attendance-action="open"/)
assert.match(pastHtml, /Chưa điểm danh/)
assert.doesNotMatch(pastHtml, /Đã điểm danh một phần/)
assert.match(pastHtml, /Substitute then/)

const futureHtml = render({ ...base, date: '2030-09-21' }, [], { weekStart: '2030-09-16' })
assert.match(futureHtml, /Chưa đến giờ học/)
assert.doesNotMatch(futureHtml, /data-a5-attendance-action="open"/)
const cancelledHtml = render({ ...base, status: 'cancelled' }, [], { weekStart: '2026-09-21' })
assert.match(cancelledHtml, /Đã hủy/)
assert.doesNotMatch(cancelledHtml, /data-a5-attendance-action="open"/)

const reportState = { sessionId: base.id, occurrenceDate: base.date, mode: 'adminPlaceholder' }
const panelHtml = render(base, [
  { studentId: 'student-a', attendanceStatus: '', dirty: false },
  { studentId: 'student-b', attendanceStatus: 'makeup', dirty: false,
    originalMakeupForAttendanceLocalId: 'missed-a', makeupForAttendanceLocalId: 'missed-a',
    currentMakeupTarget: { attendance_local_id: 'missed-a', occurrence_date: '2026-09-14' },
    makeupCandidates: [], candidateState: 'ready' },
], { weekStart: '2026-09-21', reportState })
assert.match(panelHtml, /Có mặt/)
assert.match(panelHtml, /Vắng/)
assert.match(panelHtml, /Học bù/)
assert.match(panelHtml, /Chưa chọn/)
assert.match(panelHtml, /Học bù cho buổi nào\?/)
assert.match(panelHtml, /value="missed-a" selected/)
assert.match(panelHtml, /14\/09\/2026/)
assert.match(panelHtml, /Giáo viên: Substitute then/)
assert.match(panelHtml, /data-admin-attendance-action="save"/)
assert.doesNotMatch(panelHtml, /data-admin-attendance-action="mark-all-present"/)

const noCandidateHtml = render(base, [{ studentId: 'student-a', attendanceStatus: 'makeup', candidateState: 'ready', makeupCandidates: [] }],
  { weekStart: '2026-09-21', reportState })
assert.match(noCandidateHtml, /Không có buổi vắng đủ điều kiện để học bù/)

const command = buildV23OccurrenceAttendanceCommand({
  centerId: 'center-a', occurrence, currentRecords: [],
  attendanceInputs: [{ studentId: 'student-b', attendanceStatus: 'makeup', source: 'admin',
    teacherName: 'Substitute then', makeupForAttendanceLocalId: 'missed-a' }],
  idempotencyKey: 'a5000000-0000-4000-8000-000000000001',
})
assert.equal(command.rpc, 'v2_3_mutate_occurrence_attendance')
assert.equal(command.params.p_attendance.length, 1)
assert.equal(command.params.p_attendance[0].makeup_for_attendance_local_id, 'missed-a')
assert.equal(command.params.p_attendance[0].payload.teacherName, 'Substitute then')

const main = readFileSync('src/main.js', 'utf8')
assert.match(main, /\.filter\(\(row\) => row\.dirty && row\.attendanceStatus\)/)
assert.match(main, /pullA4EligibleMissedOccurrences\(/)
assert.match(main, /needsReload: isAttendanceConflict/)
assert.match(main, /currentRecords: draft\.baseRecords/)

// Execute the actual draft/payload functions without booting the desktop app.
const sourceFunction = (name) => main.slice(main.indexOf(`function ${name}(`),
  main.indexOf('\nfunction ', main.indexOf(`function ${name}(`) + 1))
const openedRecord = { ...record('student-a', 'present'), id: 'existing-a',
  authorityLocalId: 'existing-a', source: 'admin', cloudVersion: 2 }
const draft = runInNewContext(`
  ${sourceFunction('createScheduleAdminAttendanceState')}
  ${sourceFunction('buildScheduleAdminAttendanceInputs')}
  const draft = createScheduleAdminAttendanceState(occurrence, existingRecords);
  draft.rows[0].attendanceStatus = 'absent';
  draft.rows[0].dirty = true;
  existingRecords[0].cloudVersion = 3;
  ({ baseRecords: draft.baseRecords, inputs: buildScheduleAdminAttendanceInputs(occurrence, draft.rows) });
`, {
  occurrence, existingRecords: [structuredClone(openedRecord)],
  crypto: { randomUUID: () => 'draft-a5' },
  selectCurrentV23OccurrenceAttendanceRecord,
  V23_ATTENDANCE_CONTRACT: 'v2.3-occurrence-v1',
  getScheduleAdminStudentIds: (item) => item.studentIds,
  getScheduleAdminTeacherName: () => 'Historical teacher',
  cloneC52OperationalCommandValue: structuredClone,
})
assert.equal(draft.inputs.length, 1, 'Unselected student must not become absent')
assert.equal(draft.inputs[0].studentId, 'student-a')
const staleCommand = buildV23OccurrenceAttendanceCommand({
  centerId: 'center-a', occurrence, currentRecords: draft.baseRecords,
  attendanceInputs: draft.inputs, idempotencyKey: 'a5000000-0000-4000-8000-000000000002',
})
assert.equal(staleCommand.params.p_attendance[0].expected_records[0].version, 2,
  'A realtime update must not advance the expected version of an open draft')

const conflictHtml = render(base, [], {
  weekStart: '2026-09-21', reportState,
  adminState: { rows: [], needsReload: true, error: 'Dữ liệu vừa được thay đổi. Tải lại để xem bản mới nhất.' },
})
assert.match(conflictHtml, /data-admin-attendance-action="reload"/)
assert.match(conflictHtml, /data-admin-attendance-action="save" disabled/)
assert.doesNotMatch(conflictHtml, /expectedVersion|v2_3_mutate/)

// Execute the existing Save event handler with controlled RPC results. This
// checks draft retention and validation, while remote SQL QA checks authority.
const handlerStart = main.indexOf("  document.querySelectorAll('[data-admin-attendance-action]')")
const handlerEnd = main.indexOf("  document.querySelectorAll('[data-session-report-attendance-status]')", handlerStart)
async function saveDraft(rows, result = { ok: false, outcome_code: 'ATTENDANCE_VERSION_CONFLICT' }) {
  const calls = []
  let save
  const a3TeacherContext = {}
  const context = createContext({
    crypto: { randomUUID: () => 'draft-a5' },
    scheduleAdminAttendanceState: { draftId: 'draft-a5', rows: structuredClone(rows), baseRecords: [openedRecord] },
    document: { querySelectorAll: () => [{ dataset: { adminAttendanceAction: 'save' },
      addEventListener: (_, handler) => { save = handler } }] },
    a3TeacherContext, getCurrentA3TeacherContext: () => a3TeacherContext,
    getScheduleAdminAttendanceOccurrence: () => occurrence,
    getScheduleAdminTeacherName: () => 'Historical teacher',
    isPastScheduleOccurrence: () => true, render: () => {},
    writeV23OccurrenceAttendanceThroughCloud: async command => { calls.push(command); return result },
    loadScheduleMakeupCandidates: () => {},
  })
  runInContext(sourceFunction('buildScheduleAdminAttendanceInputs') + main.slice(handlerStart, handlerEnd), context)
  await save()
  return { calls, state: context.scheduleAdminAttendanceState }
}
const noTargetSave = await saveDraft([
  { studentId: 'student-a', attendanceStatus: 'makeup', dirty: true, candidateState: 'ready', makeupCandidates: [] },
])
assert.equal(noTargetSave.calls.length, 0, 'Makeup without an eligible target must never be submitted')
assert.match(noTargetSave.state.error, /buổi vắng đủ điều kiện/)

const conflictedSave = await saveDraft([
  { studentId: 'student-a', attendanceStatus: 'absent', dirty: true },
  { studentId: 'student-b', attendanceStatus: '', dirty: false },
])
assert.equal(conflictedSave.calls[0].attendanceInputs.length, 1)
assert.equal(conflictedSave.calls[0].currentRecords[0].cloudVersion, 2)
assert.equal(conflictedSave.state.rows[0].attendanceStatus, 'absent')
assert.equal(conflictedSave.state.needsReload, true)
assert.match(conflictedSave.state.error, /Dữ liệu vừa được thay đổi/)

const makeupConflict = await saveDraft([
  { studentId: 'student-a', attendanceStatus: 'present', dirty: true },
  { studentId: 'student-b', attendanceStatus: 'makeup', dirty: true, candidateState: 'ready',
    makeupForAttendanceLocalId: 'missed-b', makeupCandidates: [{ attendance_local_id: 'missed-b' }] },
], { ok: false, outcome_code: 'MAKEUP_ALREADY_COMPENSATED', error: 'Buổi vắng này đã được học bù.' })
assert.equal(makeupConflict.calls[0].attendanceInputs[1].makeupForAttendanceLocalId, 'missed-b')
assert.equal(makeupConflict.state.rows[0].attendanceStatus, 'present', 'Unrelated selections must survive a makeup conflict')
assert.equal(makeupConflict.state.rows[1].attendanceStatus, 'makeup')
assert.match(makeupConflict.state.error, /đã được học bù/)
console.log('A5_SCHEDULE_ATTENDANCE_UI_SMOKE_PASS')
