import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import {
  buildV28AMarkTbhpSentCommand,
  buildV28AUpsertCellNoteCommand,
  createV28AAttendanceOperationsCapabilityState,
  isV28AAttendanceOperationsCapabilityReady,
  mutateV28AAttendanceOperation,
  pullV28AAttendanceOperations,
  V28A_ATTENDANCE_OPERATIONS_CAPABILITY_STATUS,
} from '../src/cloud-authoritative-attendance-operations.js'
import {
  buildV28AAttendanceNotificationCandidates,
  getV28AAttendanceReminderPresentation,
  groupV28AAttendanceRemindersByStudent,
} from '../src/attendance-operational-reminders.js'
import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import {
  markNotificationReadById,
  upsertNotificationCandidates,
} from '../src/notification-center.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const centerA = 'dreamhome'
const centerB = 'another-center'
const cycleA = '28000000-0000-4000-8000-000000000020'
const cycleB = '28000000-0000-4000-8000-000000000021'
const noteId = '28000000-0000-4000-8000-000000000401'
const reminders = [
  {
    centerId: centerA,
    studentId: 'student-a',
    cycleId: cycleA,
    cycleNumber: 1,
    signal: 'REVIEW_UPDATE_DUE',
    label: 'Cập nhật nhận xét',
    severity: 'warning',
    remainingSessions: 4,
    triggerDate: '2026-09-04',
    checkpointVersion: 0,
  },
  {
    centerId: centerA,
    studentId: 'student-a',
    cycleId: cycleA,
    cycleNumber: 1,
    signal: 'TBHP_SEND_DUE',
    label: 'Cần gửi TBHP',
    severity: 'warning',
    remainingSessions: 2,
    triggerDate: '2026-09-06',
    checkpointVersion: 0,
  },
  {
    centerId: centerB,
    studentId: 'student-b',
    cycleId: cycleB,
    cycleNumber: 2,
    signal: 'PAYMENT_CHECK_DUE',
    label: 'Kiểm tra đã hoàn tất thu chưa',
    severity: 'danger',
    remainingSessions: 7,
    triggerDate: '2026-09-09',
    checkpointVersion: 0,
  },
]

const groupedA = groupV28AAttendanceRemindersByStudent(reminders, centerA)
assert.deepEqual([...groupedA.keys()], ['student-a'])
assert.equal(groupedA.get('student-a').length, 2)
assert.deepEqual(getV28AAttendanceReminderPresentation(groupedA.get('student-a')), {
  count: 2,
  tone: 'danger',
  statusText: '2 nhắc việc',
})
assert.equal(getV28AAttendanceReminderPresentation([reminders[0]]).tone, 'warning')
assert.equal(getV28AAttendanceReminderPresentation([]).tone, 'normal')

const serverSnapshot = {
  ok: true,
  outcome_code: 'AUTHORITATIVE_SNAPSHOT',
  status: 'READY',
  contract: 'v2.8a-attendance-operations-v1',
  center_id: centerA,
  reminders: reminders.slice(0, 2).map((reminder) => ({
    center_id: reminder.centerId,
    student_id: reminder.studentId,
    cycle_id: reminder.cycleId,
    cycle_number: reminder.cycleNumber,
    signal: reminder.signal,
    label: reminder.label,
    severity: reminder.severity,
    remaining_sessions: reminder.remainingSessions,
    trigger_date: reminder.triggerDate,
    checkpoint_version: reminder.checkpointVersion,
  })),
  tbhp_checkpoints: [],
  cell_notes: [{
    center_id: centerA,
    id: noteId,
    student_id: 'student-a',
    schedule_session_id: 'occurrence-absent',
    occurrence_date: '2026-09-02',
    note: 'Phụ huynh đã báo vắng',
    version: 1,
    created_at: '2026-09-14T07:00:00.000Z',
    updated_at: '2026-09-14T07:00:00.000Z',
  }],
}
const rpcCalls = []
const mockSupabase = {
  async rpc(name, args) {
    rpcCalls.push({ name, args })
    if (name === 'v2_8a_list_attendance_operations') return { data: serverSnapshot, error: null }
    return {
      data: {
        ok: true,
        outcome_code: 'COMMITTED',
        center_id: centerA,
        operation: args.p_command.operation,
      },
      error: null,
    }
  },
}
const pulled = await pullV28AAttendanceOperations({ supabase: mockSupabase, centerId: centerA })
assert(pulled.ok)
assert.equal(pulled.reminders.length, 2)
assert.equal(pulled.cellNotes[0].scheduleSessionId, 'occurrence-absent')
assert(isV28AAttendanceOperationsCapabilityReady(createV28AAttendanceOperationsCapabilityState({
  centerId: centerA,
  status: V28A_ATTENDANCE_OPERATIONS_CAPABILITY_STATUS.READY,
}), centerA))
assert(!isV28AAttendanceOperationsCapabilityReady(createV28AAttendanceOperationsCapabilityState({
  centerId: centerA,
  status: V28A_ATTENDANCE_OPERATIONS_CAPABILITY_STATUS.READY,
}), centerB))

const tbhpCommand = buildV28AMarkTbhpSentCommand(reminders[1])
assert.deepEqual(tbhpCommand, {
  operation: 'MARK_TBHP_SENT',
  cycle_id: cycleA,
  expected_version: 0,
})
const cellNoteCommand = buildV28AUpsertCellNoteCommand({
  id: noteId,
  version: 1,
  studentId: 'student-a',
  scheduleSessionId: 'occurrence-absent',
  occurrenceDate: '2026-09-02',
  note: '  Phụ huynh xác nhận vắng có phép  ',
})
assert.equal(cellNoteCommand.operation, 'UPSERT_CELL_NOTE')
assert.equal(cellNoteCommand.note, 'Phụ huynh xác nhận vắng có phép')
assert.equal(cellNoteCommand.expected_version, 1)
assert.throws(() => buildV28AMarkTbhpSentCommand(reminders[0]))
const mutation = await mutateV28AAttendanceOperation({
  supabase: mockSupabase,
  centerId: centerA,
  command: cellNoteCommand,
  idempotencyKey: '28000000-0000-4000-8000-000000000499',
})
assert(mutation.ok)
assert.equal(rpcCalls.at(-1).args.p_center_id, centerA)

const students = [
  { id: 'student-a', centerId: centerA, fullName: 'Nguyễn Minh Anh' },
  { id: 'student-b', centerId: centerB, fullName: 'Trần Gia Bảo' },
]
const centerACandidates = buildV28AAttendanceNotificationCandidates(reminders, students, {
  centerId: centerA,
  today: '2026-09-14',
})
assert.equal(centerACandidates.length, 2)
assert(centerACandidates.every((candidate) => candidate.sourceModule === 'bang-diem-danh'))
assert(centerACandidates.every((candidate) => candidate.type === 'attendance-operation'))
let notificationState = upsertNotificationCandidates([], centerACandidates)
const notificationId = notificationState[0].id
notificationState = markNotificationReadById(notificationState, notificationId, '2026-09-14T08:00:00.000Z')
notificationState = upsertNotificationCandidates(notificationState, centerACandidates)
assert.equal(notificationState.find((item) => item.id === notificationId).readAt, '2026-09-14T08:00:00.000Z')
assert.equal(notificationState.length, 2, 'Reading a notification must not complete its business reminder.')

const centerBCandidates = buildV28AAttendanceNotificationCandidates(reminders, students, {
  centerId: centerB,
  today: '2026-09-14',
})
notificationState = upsertNotificationCandidates(notificationState, centerBCandidates)
assert.equal(notificationState.length, 1)
assert.equal(notificationState[0].entityId, 'student-b')
assert(!JSON.stringify(notificationState).includes('student-a'))
notificationState = upsertNotificationCandidates(notificationState, centerACandidates)
assert.equal(notificationState.length, 2)
assert(notificationState.every((item) => item.entityId === 'student-a'))
assert(!JSON.stringify(notificationState).includes('student-b'))
assert.equal(upsertNotificationCandidates(notificationState, []).length, 0,
  'Only authoritative signal resolution removes the derived reminder.')

const classSessions = [
  { id: 'class-tue', daysOfWeek: ['tue'], startTime: '17:00', endTime: '18:30', status: 'active' },
  { id: 'class-sat', daysOfWeek: ['sat'], startTime: '09:00', endTime: '10:30', status: 'active' },
  { id: 'class-sun', daysOfWeek: ['sun'], startTime: '15:00', endTime: '16:30', status: 'active' },
]
const projectedStudents = [{
  id: 'student-a',
  centerId: centerA,
  fullName: 'Nguyễn Minh Anh',
  studentCode: 'HV-001',
  classSessionIds: classSessions.map((item) => item.id),
  recurringEnrollments: [
    { classSessionId: 'class-tue', weekdays: ['tue'] },
    { classSessionId: 'class-sat', weekdays: ['sat'] },
    { classSessionId: 'class-sun', weekdays: ['sun'] },
  ],
  useAuthoritativeEnrollment: true,
}]
const storedRecords = [
  {
    id: 'record-absent', studentId: 'student-a', date: '2026-09-02',
    scheduleSessionId: 'occurrence-absent', classSessionId: 'class-tue',
    attendanceStatus: 'absent', status: 'absent', counted: false, source: 'admin',
  },
  {
    id: 'record-makeup', studentId: 'student-a', date: '2026-09-05',
    scheduleSessionId: 'occurrence-makeup', classSessionId: 'class-sat',
    attendanceStatus: 'makeup', status: 'makeup', counted: true, source: 'admin',
  },
  {
    id: 'record-present', studentId: 'student-a', date: '2026-09-06',
    scheduleSessionId: 'occurrence-present', classSessionId: 'class-sun',
    attendanceStatus: 'present', status: 'present', counted: true, source: 'admin',
  },
]
const renderArgs = [
  projectedStudents,
  classSessions,
  [{ id: 'tuition-a', studentId: 'student-a', usedSessions: 2, totalSessions: 8 }],
  [],
  [],
  { month: '2026-09', classSessionId: 'all', query: '' },
  null,
  [],
  null,
  false,
  storedRecords,
  0,
  { status: 'locked' },
  false,
  {},
]
const availability = {
  attendanceAvailable: true,
  tuitionAvailable: true,
  calendarNotesAvailable: true,
  packageCycleReady: false,
  attendanceOperationsReady: true,
  attendanceReminders: reminders.slice(0, 2),
  attendanceCellNotes: pulled.cellNotes,
  isReminderPanelOpen: true,
  isBaselineManagerOpen: true,
}
const boardHtml = renderAttendanceBoardModule(...renderArgs, availability)
for (const expected of [
  'Cần xử lý · 1 học viên',
  '2 nhắc việc',
  'T3 · 17:00–18:30',
  'T7 · 09:00–10:30',
  'CN · 15:00–16:30',
  'data-attendance-student-schedule-edit',
  '>Bù<',
  '>Vắng<',
  'attendance-cell-note-indicator',
  'attendance-baseline-manager-modal',
]) {
  assert(boardHtml.includes(expected), `Attendance render is missing ${expected}`)
}
const baselineModalIndex = boardHtml.indexOf('attendance-baseline-manager-modal')
const baselineClearIndex = boardHtml.indexOf('data-attendance-baseline-action="clear"')
assert(baselineModalIndex >= 0 && baselineClearIndex > baselineModalIndex,
  'Baseline controls must remain isolated inside the background-data modal.')
assert(!/RPC|PGRST|schema|migration|SQL/.test(boardHtml))

const contextHtml = renderAttendanceBoardModule(...renderArgs, {
  ...availability,
  isBaselineManagerOpen: false,
  attendanceCellNoteContextState: {
    studentId: 'student-a',
    dateKey: '2026-09-02',
    x: 320,
    y: 240,
    occurrences: [{
      scheduleSessionId: 'occurrence-absent',
      occurrenceDate: '2026-09-02',
      classSessionId: 'class-tue',
    }],
  },
})
assert(contextHtml.includes('attendance-cell-note-context'))
assert(contextHtml.includes('Ghi chú ô điểm danh'))
assert(contextHtml.includes('Xem / sửa ghi chú'))
assert(!contextHtml.includes('>occurrence-absent<'))
const modalHtml = renderAttendanceBoardModule(...renderArgs, {
  ...availability,
  isBaselineManagerOpen: false,
  attendanceCellNoteFormState: {
    id: noteId,
    version: 1,
    studentId: 'student-a',
    scheduleSessionId: 'occurrence-absent',
    occurrenceDate: '2026-09-02',
    classSessionId: 'class-tue',
    note: 'Phụ huynh đã báo vắng',
  },
})
assert(modalHtml.includes('attendance-cell-note-modal'))
assert(modalHtml.includes('Phụ huynh đã báo vắng'))

const migrationSource = readFileSync(new URL('../supabase/migrations/202609140001_v2_8a_attendance_operational_hardening.sql', import.meta.url), 'utf8')
for (const invariant of [
  "cycle.remaining_sessions <= 4",
  "cycle.remaining_sessions <= 2",
  "cycle.origin = 'AUTOMATIC_ROLLOVER'",
  "cycle.lifecycle_status = 'PROVISIONAL_UNPAID'",
  "cycle.payment_status <> 'PAID'",
  "review_note.care_status = 'sentComment'",
  "v_role is null or v_role not in",
  'force row level security',
]) {
  assert(migrationSource.toLowerCase().includes(invariant.toLowerCase()), `Migration is missing ${invariant}`)
}
assert(!migrationSource.includes('insert into public.finance_transaction'))
assert(!migrationSource.includes('update public.finance_transaction'))
assert(!migrationSource.includes('update public.center_cloud_entities'))

const migrationFiles = readdirSync(new URL('../supabase/migrations/', import.meta.url))
  .filter((name) => name.startsWith('20260914') && name.endsWith('.sql'))
assert.deepEqual(migrationFiles, ['202609140001_v2_8a_attendance_operational_hardening.sql'])
const trackedMigrationDrift = execFileSync('git', [
  'diff', '--name-only', '64b49aff7c2733431b9a97ee042e44623049acaa', '--', 'supabase/migrations',
], { encoding: 'utf8' }).trim()
assert.equal(trackedMigrationDrift, '', 'Historical tracked migration drift must remain zero.')

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const registrySource = readFileSync(new URL('../src/module-authority-registry.js', import.meta.url), 'utf8')
const notificationSource = readFileSync(new URL('../src/notification-center.js', import.meta.url), 'utf8')
const themeSource = readFileSync(new URL('../src/attendance-theme.css', import.meta.url), 'utf8')
for (const expected of [
  "case 'attendance-operations'",
  'buildV28AAttendanceNotificationCandidates',
  'getStudentsWithCanonicalProjections()',
  'openStudentEditForm(button.dataset.studentId',
  "openModuleWindowFromChildInteraction('hoc-phi')",
  "careStatus: 'sentComment'",
  'data-attendance-cell-context',
]) {
  assert(mainSource.includes(expected), `Main wiring is missing ${expected}`)
}
assert(registrySource.includes("['tuition', 'calendar-notes', 'attendance-operations']"))
assert(notificationSource.includes("'attendance-operation'"))
assert(!notificationSource.includes("'provisional-unpaid',\n        'danger'"))
assert(themeSource.includes('.desktop-window.is-attendance-window'))
assert(themeSource.includes(":root[data-ui-theme='dark'] .desktop-window.is-attendance-window"))
assert(themeSource.includes('min-width: 310px'))
assert(!mainSource.includes('tailwind'))

console.log('V2_8A_ATTENDANCE_OPERATIONAL_HARDENING_SMOKE: PASS')
