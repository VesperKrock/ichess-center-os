import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { buildCanonicalAttendanceLedger, getCanonicalLedgerAttendance, normalizeAttendanceLedgerFilters } from '../src/attendance-ledger.js'
import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import { pullCanonicalAttendanceLedgerContext } from '../src/cloud-attendance-ledger.js'
import { getModuleRefreshContract } from '../src/module-authority-registry.js'
import { projectA3ScheduleSessions } from '../src/cloud-authoritative-teacher-history.js'
import { ledgerFixture } from './a6-attendance-ledger-fixtures.js'

const fixture = ledgerFixture()
const model = buildCanonicalAttendanceLedger(fixture)
const cell = (student, schedule) => model.rows.find(row => row.student.id === student).cells.find(item => item.occurrence.scheduleSessionId === schedule)
assert.equal(model.columns.length, 5)
assert.equal(new Set(model.columns.map(column => column.key)).size, 5)
assert.deepEqual(model.columns.filter(column => column.date === '2026-09-21').map(column => column.startTime), ['17:30', '19:00'])
assert.equal(cell('student-a', 'held').state, 'present')
assert.equal(cell('student-b', 'held').state, 'absent')
assert.equal(cell('student-left', 'held').state, 'unmarked', 'Untouched historical student must stay unmarked')
assert(!model.rows.some(row => row.student.id === 'student-later'), 'Today membership must not expand historical rosters')
assert.equal(cell('student-b', 'makeup').state, 'makeup')
assert.equal(cell('student-b', 'makeup').originalOccurrence.teacherName, 'Thầy Lịch sử')
assert.equal(cell('student-b', 'makeup').originalOccurrence.classLabel, 'Lớp A')
assert.equal(cell('student-b', 'makeup').originalDate, '2026-08-24')
assert.equal(cell('student-a', 'future').state, 'future')
assert.equal(cell('student-a', 'cancelled').state, 'cancelled')
assert.equal(cell('student-a', 'held').occurrence.teacherName, 'Thầy Lịch sử')
assert.equal(cell('student-a', 'second').occurrence.teacherName, 'Cô Dạy thay')
assert(cell('student-a', 'second').occurrence.isSubstitute)
assert.equal(model.rows.find(row => row.student.id === 'student-a').tuition.progressLabel, '4/8')
assert.equal(model.rows.find(row => row.student.id === 'student-b').tuition.progressLabel, '—')
assert.equal(getCanonicalLedgerAttendance(fixture.attendanceRecords).length, 7)
const witnessed = buildCanonicalAttendanceLedger({ ...fixture, occurrences: [], plannedOccurrences: [] })
assert(witnessed.columns.every(item => item.partialHistoricalRoster))
assert.equal(witnessed.columns.filter(item => item.date === '2026-09-21').length, 2)
assert(!witnessed.rows.some(row => row.student.id === 'student-left'), 'A missing A2 roster may only show canonically witnessed students')
assert(!witnessed.rows.some(row => row.student.id === 'student-later'))

const filtered = values => buildCanonicalAttendanceLedger({ ...fixture, filters: { ...fixture.filters, ...values } })
assert.deepEqual(filtered({ classSessionId: 'class-b' }).columns.map(item => item.scheduleSessionId), ['second'])
assert.deepEqual(filtered({ teacherId: 'substitute' }).columns.map(item => item.scheduleSessionId), ['second'])
assert.equal(filtered({ teacherId: 'teacher-history' }).columns.length, 4)
assert.equal(filtered({ fromDate: '2026-09-21', toDate: '2026-09-21' }).columns.length, 2)
assert.equal(filtered({ query: 'nguyen hoang' }).rows.length, 1)
assert.equal(filtered({ query: 'nguyen hoang' }).columns.length, 5, 'Student search must not mutate occurrence truth')
assert(normalizeAttendanceLedgerFilters({ fromDate: '2026-09-31', toDate: '2026-09-30' }).error)
assert(normalizeAttendanceLedgerFilters({ fromDate: '2026-09-30', toDate: '2026-09-01' }).error)
assert(normalizeAttendanceLedgerFilters({ fromDate: '2025-01-01', toDate: '2026-09-01' }).error)

const future = { id: 'planned', occurrenceDate: '2026-09-29', startTime: '10:00', endTime: '11:00',
  classSessionId: 'class-a', teacherName: 'Thầy Lịch sử', studentIds: ['student-later'] }
const planning = buildCanonicalAttendanceLedger({ ...fixture, plannedOccurrences: [future, { ...future, id: 'unresolved-past', occurrenceDate: '2026-09-15' }] })
assert(planning.columns.some(item => item.scheduleSessionId === 'planned'))
assert(!planning.columns.some(item => item.scheduleSessionId === 'unresolved-past'), 'Do not reconstruct a past roster from current membership')
assert.equal(planning.rows.find(row => row.student.id === 'student-later').cells[0].state, 'notExpected')

const render = (extra = {}) => renderAttendanceBoardModule({
  students: fixture.students, classSessions: fixture.classSessions, filters: fixture.filters,
  detailState: { studentId: 'student-b', scheduleSessionId: 'makeup', dateKey: '2026-09-22' },
  availability: { ...fixture, attendanceAvailable: true, tuitionAvailable: true,
    ledgerContext: { status: 'ready', occurrences: fixture.occurrences },
    // Legacy write-state flags must have no effect on the normal renderer.
    isBaselineManagerOpen: true, baselineUndoAvailable: true, ...extra },
})
const output = render()
assert.match(output, /data-attendance-read-only/)
for (const state of ['present', 'absent', 'makeup', 'unmarked', 'future', 'cancelled']) assert.match(output, new RegExp(`data-attendance-ledger-state="${state}"`))
for (const field of ['classSessionId', 'teacherId', 'fromDate', 'toDate', 'query']) assert.match(output, new RegExp(`data-attendance-board-filter="${field}"`))
assert.match(output, /Học bù cho buổi 24\/08/)
assert.match(output, /Giáo viên buổi gốc/)
assert.match(output, /data-attendance-open-occurrence/)
assert.match(output, />4\/8<\/td>/)
assert.doesNotMatch(render({ packageCycleReady: false }), />4\/8<\/td>/)
const historyOutput = render({ historicalBaselineRecords: [{ studentId: 'student-a', date: '2026-08-01', creditNumber: 3 }] })
assert.match(historyOutput, /Dữ liệu điểm danh ban đầu · Chỉ xem/)
assert.match(historyOutput, /Thiết lập số buổi ban đầu tại Học phí/)
assert.doesNotMatch(historyOutput, /data-attendance-baseline|data-attendance-note-open/)
assert.match(render({ attendanceAvailable: false }), /Vui lòng bấm Làm mới/)
for (const forbidden of [
  'data-attendance-baseline', 'data-attendance-note-open', 'data-attendance-cell-note',
  'data-admin-attendance-status', 'data-admin-attendance-action', 'data-attendance-student-schedule-edit',
  'Lưu điểm danh', 'Xóa điểm danh', 'Hoàn tác', 'localStorage',
]) assert(!output.includes(forbidden), `Retired Board control remains: ${forbidden}`)
assert(!output.includes('Giáo viên hiện tại khác'))
const rendererSource = readFileSync('src/attendance-ledger-module.js', 'utf8')
assert.doesNotMatch(rendererSource, /sessionReports|storedRecords|buildUnifiedAttendanceRecords|computeAttendanceCycleState|localStorage/)
assert.deepEqual(getModuleRefreshContract('bang-diem-danh').required, ['core', 'attendance', 'attendance-ledger'])

const reads = []
const supabase = { rpc: async (name, params) => {
  reads.push({ name, params })
  return { data: { ok: true, center_id: 'a6-fixture', assignments: [],
    occurrences: fixture.occurrences.filter(fact => fact.occurrence_date >= params.p_from_date && fact.occurrence_date <= params.p_to_date) } }
} }
const context = await pullCanonicalAttendanceLedgerContext({ supabase, centerId: 'a6-fixture', filters: fixture.filters, attendanceRecords: fixture.attendanceRecords })
assert(context.ok)
assert.equal(reads.length, 2, 'Read original makeup occurrence outside current date filter')
assert(context.occurrences.some(item => item.schedule_session_local_id === 'original'))
assert(reads.every(item => item.name === 'a3_list_teacher_context'), 'Board may only call the stable read RPC')
reads.length = 0
assert((await pullCanonicalAttendanceLedgerContext({ supabase, centerId: 'a6-fixture', filters: { fromDate: '2026-01-01', toDate: '2026-12-31' } })).ok)
assert.equal(reads.length, 6)
assert(reads.every(({ params }) => (Date.parse(params.p_to_date) - Date.parse(params.p_from_date)) / 86400000 <= 62))
for (const data of [{ ok: true, center_id: 'wrong', assignments: [], occurrences: [] }, { ok: true, center_id: 'a6-fixture' }]) {
  assert.equal((await pullCanonicalAttendanceLedgerContext({ supabase: { rpc: async () => ({ data }) }, centerId: 'a6-fixture', filters: fixture.filters })).ok, false)
}

// Execute the actual Board route handler. It must focus Schedule and its exact
// occurrence, including two sessions on the same day, without a Board write.
const main = readFileSync('src/main.js', 'utf8')
const start = main.indexOf("  document.querySelectorAll('[data-attendance-open-occurrence]')")
const end = main.indexOf("  document.querySelectorAll('[data-attendance-note-open]')", start)
const routeCalls = []
let handler
const button = { dataset: { scheduleSessionId: 'second', occurrenceDate: '2026-09-21' }, addEventListener: (_, callback) => { handler = callback } }
const card = { dataset: { scheduleSessionId: 'second', scheduleOccurrenceDate: '2026-09-21' },
  click: () => routeCalls.push('open-exact-occurrence'), scrollIntoView: () => {} }
const vm = createContext({
  document: { querySelectorAll: selector => selector === '[data-attendance-open-occurrence]' ? [button] : [card] },
  attendanceBoardDetailState: {}, scheduleWeekStartDate: '',
  scheduleFormState: {}, resetScheduleReportPanels: () => routeCalls.push('clear-previous-schedule-panel'),
  getCurrentCanonicalCenterContext: () => ({ centerId: 'a6-fixture' }),
  getCurrentScheduleWeekStartDate: () => '2026-09-21',
  openModuleWindowFromChildInteraction: module => routeCalls.push(module),
  refreshModuleAuthoritativeUpstreams: async module => routeCalls.push(`refresh:${module}`),
  openCanonicalScheduleOccurrence: async (schedule, date) => {
    assert.equal(schedule, 'second'); assert.equal(date, '2026-09-21'); card.click()
  },
})
runInContext(main.slice(start, end), vm)
await handler()
assert.deepEqual(routeCalls, ['clear-previous-schedule-panel', 'thoi-khoa-bieu', 'refresh:thoi-khoa-bieu', 'open-exact-occurrence'])
assert.equal(vm.attendanceBoardDetailState, null)
assert.equal(vm.scheduleFormState, null)

// Existing V2.3 rows with missing A2 context may be resolved only after the
// route enters Schedule. Opening/refreshing Board itself remains a stable read.
const helperStart = main.indexOf('async function openCanonicalScheduleOccurrence(')
const helperEnd = main.indexOf('\nfunction ', helperStart)
let materialized = false
const scheduleCalls = []
const helperVm = createContext({
  document: { querySelectorAll: () => materialized ? [card] : [] },
  getCanonicalLedgerAttendance, attendanceRecords: fixture.attendanceRecords,
  getSupabaseClient: () => ({ rpc: async (name, params) => {
    scheduleCalls.push({ name, params }); return { data: { ok: true } }
  } }),
  refreshA3TeacherContext: async () => { materialized = true },
  getCurrentCanonicalCenterContext: () => ({ centerId: 'a6-fixture' }),
})
runInContext(main.slice(helperStart, helperEnd), helperVm)
await helperVm.openCanonicalScheduleOccurrence('second', '2026-09-21', 'a6-fixture')
assert.equal(scheduleCalls.length, 1)
assert.equal(scheduleCalls[0].name, 'a2_manage_occurrence')
assert.equal(scheduleCalls[0].params.p_action, 'RESOLVE')
const retainedFuture = projectA3ScheduleSessions([], { occurrences: [{
  ...fixture.occurrences[0], occurrence_date: '2099-01-01', lifecycle_state: 'PLANNED',
}] }, { scheduleSessions: [], classSessions: fixture.classSessions })
assert.equal(retainedFuture.length, 1, 'A real future A2 occurrence must remain routable if its assignment later disappears')
assert.match(main, /outcome_code: 'READ_ONLY_LEDGER'/)
assert.match(main, /openWindows\.some\(item => item\.moduleId === 'bang-diem-danh'\)/)
console.log('A6_ATTENDANCE_BOARD_READ_ONLY_SMOKE_PASS')
