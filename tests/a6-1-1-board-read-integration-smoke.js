import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createContext,runInContext} from 'node:vm'
import {buildCanonicalAttendanceLedger} from '../src/attendance-ledger.js'
import {getVisibleScheduleSessions} from '../src/schedule-module.js'
import {getModuleRefreshContract,evaluateModuleRefreshResults} from '../src/module-authority-registry.js'
import {normalizeTuitionCyclePresentation} from '../src/tuition-module.js'
import {renderAttendanceBoardModule} from '../src/attendance-board-module.js'
import {ledgerFixture} from './a6-attendance-ledger-fixtures.js'

const classSessions=[{id:'class-a',name:'Class',daysOfWeek:['tue','thu'],startTime:'17:30',endTime:'18:30',status:'active'}]
const recurring=day=>({id:`recurring-${day}`,cloudVersion:1,scheduleType:'recurring',classSessionId:'class-a',dayOfWeek:day,title:'Class',startDate:'2026-09-28',endDate:'2026-10-10',startTime:'17:30',endTime:'18:30',studentIds:['student-a']})
const schedules=[recurring('tuesday'),recurring('thursday')]
const fact=(id,date,values={})=>({center_id:'test',schedule_session_local_id:id,class_session_local_id:'class-a',schedule_type:'recurring',occurrence_date:date,lifecycle_state:'PLANNED',planned_start_time:'17:30:00',planned_end_time:'18:30:00',roster_student_ids:['student-a'],planned_teacher_id:'historical',planned_teacher_name:'Historical teacher',...values})
const visible=getVisibleScheduleSessions(schedules,'2026-09-28',classSessions)
assert.equal(visible.find(row=>row.dayOfWeek==='tuesday').id,'recurring-tuesday','Schedule keeps the Tuesday assignment identity')
const input={students:[{id:'student-a',fullName:'Student'}],classSessions,scheduleSessions:schedules,plannedOccurrences:visible,
  occurrences:[fact('recurring-tuesday','2026-09-29'),fact('recurring-thursday','2026-10-01')],
  filters:{fromDate:'2026-09-01',toDate:'2026-10-10'},now:new Date('2026-09-28T05:00:00Z')}
const columns=buildCanonicalAttendanceLedger(input).columns
assert.equal(columns.length,2,'Canonical A2 fact + derived slot alias must be one column')
assert(columns.every(column=>column.materialized))
assert.deepEqual(columns.map(column=>column.key),['recurring-tuesday|2026-09-29','recurring-thursday|2026-10-01'])
for(const lifecycle of ['HELD','CANCELLED']){
  const preserved=fact('recurring-tuesday','2026-09-29',{lifecycle_state:lifecycle,roster_student_ids:['historical-student'],actual_teacher_override:true,actual_teacher_id:'substitute',actual_teacher_name:'Substitute'})
  const result=buildCanonicalAttendanceLedger({...input,occurrences:[preserved]})
  assert.equal(result.columns.length,2)
  const actual=result.columns.find(column=>column.date==='2026-09-29')
  assert.equal(actual.lifecycleState,lifecycle);assert.equal(actual.scheduleSessionId,'recurring-tuesday')
  assert.equal(actual.teacherId,'substitute');assert(actual.isSubstitute)
  assert.deepEqual(actual.studentIds,['historical-student'])
}
const derived=buildCanonicalAttendanceLedger({...input,occurrences:[],plannedOccurrences:[...visible,...visible]})
assert.equal(derived.columns.length,2,'Each unmaterialized canonical future assignment/date appears once')
assert.deepEqual(derived.columns.map(column=>column.key),columns.map(column=>column.key))
assert(derived.rows[0].cells.every(cell=>cell.state==='future'&&!cell.record))
const distinct=fact('different-same-day','2026-09-29',{class_session_local_id:'class-b',schedule_type:'oneoff',planned_start_time:'19:00:00'})
const sameTime=fact('genuine-separate-id','2026-09-29',{schedule_type:'oneoff'})
const separate=buildCanonicalAttendanceLedger({...input,occurrences:[...input.occurrences,distinct,sameTime]})
assert.equal(separate.columns.length,4,'Preserve separate canonical identities, including same class/date/time one-offs')
assert.equal(separate.columns.filter(column=>column.date==='2026-09-29').length,3)
assert(separate.columns.some(column=>column.scheduleSessionId==='different-same-day'&&column.startTime==='19:00'))
const oneOff={id:'future-oneoff',scheduleType:'oneOff',occurrenceDate:'2026-09-29',date:'2026-09-29',classSessionId:'class-a',startTime:'17:30',endTime:'18:30',studentIds:['student-a']}
assert.equal(buildCanonicalAttendanceLedger({...input,plannedOccurrences:[...visible,oneOff]}).columns.length,3,'A real one-off is not a recurring slot alias even with matching labels/times')
const single=buildCanonicalAttendanceLedger({...input,scheduleSessions:[schedules[0]],plannedOccurrences:getVisibleScheduleSessions([schedules[0]],'2026-09-28',classSessions),occurrences:[]})
assert.deepEqual(single.columns.map(column=>column.key),['recurring-tuesday|2026-09-29','schedule-slot-class-a-thursday|2026-10-01'],'An unassigned Thursday remains its own class slot')

const fixture=ledgerFixture()
fixture.students[1].fullName=fixture.students[0].fullName
fixture.packageCycleStudentStates[0].currentCycle={...fixture.packageCycleStudentStates[0].currentCycle,usedSessions:5,totalSessions:16,remainingSessions:11,tuitionLocalId:'tuition_record_package::tuition-initial:canonical-id'}
const expected=normalizeTuitionCyclePresentation({packageCycleState:fixture.packageCycleStudentStates[0],packageCycleReady:true,packageCycleStatus:'ready'})
const tuitionModel=buildCanonicalAttendanceLedger(fixture)
assert.equal(tuitionModel.rows.find(row=>row.student.id==='student-a').tuition.progressLabel,expected.progressLabel)
assert.equal(expected.progressLabel,'5/16')
assert.equal(tuitionModel.rows.find(row=>row.student.id==='student-b').tuition.progressLabel,'—','Equal names must not substitute for canonical Student ID')
const noRecords=buildCanonicalAttendanceLedger({...fixture,attendanceRecords:[]})
assert.equal(noRecords.rows.find(row=>row.student.id==='student-a').tuition.progressLabel,'5/16','Board never recounts its attendance cells')
const unavailable=buildCanonicalAttendanceLedger({...fixture,packageCycleReady:false})
assert(unavailable.rows.every(row=>row.tuition.progressLabel==='—'),'Failed cycle read must not use a local Tuition fallback')

assert.deepEqual(getModuleRefreshContract('bang-diem-danh').optional,['package-cycles'],'Board must depend on the canonical cycle upstream, not the generic ID-rewriting Tuition bridge')
assert.equal(evaluateModuleRefreshResults('bang-diem-danh',[...['core','attendance','attendance-ledger','package-cycles'].map(upstream=>({upstream,ok:true})),{upstream:'tuition',ok:false}]).status,'fresh')
const main=readFileSync('src/main.js','utf8')
assert.match(main,/const tuitionAvailable = isModuleUpstreamCurrent\('bang-diem-danh', 'package-cycles'\)/)
const branch=main.slice(main.indexOf("  if (moduleItem.id === 'bang-diem-danh')"),main.indexOf('\n  return `',main.indexOf("  if (moduleItem.id === 'bang-diem-danh')")))
let options
const vm=createContext({moduleItem:{id:'bang-diem-danh'},isModuleUpstreamCurrent:(_,upstream)=>upstream!=='tuition',getCurrentAttendanceLedgerContext:()=>({status:'ready',occurrences:fixture.occurrences}),
  renderAttendanceBoardModule:input=>{options=input;return renderAttendanceBoardModule(input)},getStudentsWithCanonicalProjections:()=>fixture.students,classSessions:fixture.classSessions,attendanceBoardFilters:fixture.filters,attendanceBoardDetailState:null,
  attendanceRecords:fixture.attendanceRecords,getCanonicalLedgerAttendance:rows=>rows,getAttendanceLedgerPlannedOccurrences:()=>[],scheduleSessions:[],
  isV24PackageCycleCapabilityReady:()=>true,v24PackageCycleCapabilityState:{},getCurrentCanonicalCenterContext:()=>({centerId:'test'}),v24PackageCycleStudentStates:fixture.packageCycleStudentStates})
const rendered=runInContext(`(()=>{${branch}})()`,vm)
assert(options.availability.tuitionAvailable);assert(options.availability.packageCycleReady)
assert.equal(options.students[0].id,fixture.packageCycleStudentStates[0].studentId)
assert.equal(options.availability.packageCycleStudentStates,fixture.packageCycleStudentStates)
assert.match(rendered,/>5\/16<\/td>/,'Actual Board branch must render canonical cycle value despite failed unrelated generic Tuition read')
assert.doesNotMatch(rendered,/data-admin-attendance-status|Lưu điểm danh/)
const refreshBranch=main.slice(main.indexOf("  if (moduleId === 'bang-diem-danh') {",main.indexOf('async function refreshModuleAuthoritativeUpstreams')),main.indexOf('\n  const latestContext',main.indexOf('async function refreshModuleAuthoritativeUpstreams')))
assert.doesNotMatch(refreshBranch,/refreshV24PackageCycles/,'The cycle upstream owns its one refresh; do not race a second cycle read')
console.log('A6_1_1_BOARD_READ_INTEGRATION_SMOKE_PASS')
