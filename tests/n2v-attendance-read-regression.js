// N2V retains historical roster/filter/center-isolation reads from the retired A6 test.
// Schedule editing and obsolete Board UI markers are intentionally excluded.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createContext,runInContext} from 'node:vm'
import {buildCanonicalAttendanceLedger,getCanonicalLedgerAttendance,normalizeAttendanceLedgerFilters} from '../src/attendance-ledger.js'
import {pullCanonicalAttendanceLedgerContext} from '../src/cloud-attendance-ledger.js'
import {ledgerFixture} from './a6-attendance-ledger-fixtures.js'
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


for (const status of ['trial','excused','excusedAbsent','unexcusedAbsent']) {
 const records=fixture.attendanceRecords.map(record=>record.scheduleSessionId==='held'&&record.studentId==='student-a'?{...record,attendanceStatus:status}:record);
 const historical=buildCanonicalAttendanceLedger({...fixture,attendanceRecords:records}).rows.find(row=>row.student.id==='student-a').cells.find(cell=>cell.occurrence.scheduleSessionId==='held');
 assert.equal(historical.state,status==='trial'?'historicalTrial':'absent');
 assert.equal(historical.record.attendanceStatus,status);
 assert.equal(historical.isTrial,status==='trial');
}
// A delayed read from the previous center must never repaint current Attendance.
const source=readFileSync('src/main.js','utf8')
const start=source.indexOf('async function refreshAttendanceLedgerContext(')
const end=source.indexOf('\nfunction getAttendanceLedgerPlannedOccurrences(',start)
assert(start>=0&&end>start)
let activeCenter='n2v-center-a', releaseOld
const staleResponse=new Promise(resolve=>{releaseOld=resolve})
const renders=[]
const runtime=createContext({
 attendanceBoardFilters:{...fixture.filters},attendanceLedgerReadRunId:0,
 attendanceLedgerContext:{status:'idle',centerId:''},attendanceRecords:fixture.attendanceRecords,
 getCurrentCanonicalCenterContext:()=>({centerId:activeCenter}),normalizeAttendanceLedgerFilters,
 getSupabaseClient:()=>({}),
 pullCanonicalAttendanceLedgerContext:({centerId})=>centerId==='n2v-center-a'?staleResponse:
   Promise.resolve({ok:true,centerId,occurrences:fixture.occurrences,assignments:[]}),
 render:()=>renders.push(`${activeCenter}:${runtime.attendanceLedgerContext.status}`),
})
runInContext(source.slice(start,end),runtime)
const staleRead=runtime.refreshAttendanceLedgerContext()
activeCenter='n2v-center-b'
await runtime.refreshAttendanceLedgerContext()
const renderCount=renders.length
releaseOld({ok:true,centerId:'n2v-center-a',occurrences:[],assignments:[]})
await staleRead
assert.equal(runtime.attendanceLedgerContext.centerId,'n2v-center-b')
assert.equal(runtime.attendanceLedgerContext.status,'ready')
assert.equal(renders.length,renderCount,'Late response must not render old-center data')
console.log('N2V_ATTENDANCE_READ_REGRESSION_PASS')
