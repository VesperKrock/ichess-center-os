import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createContext,runInContext} from 'node:vm'
import {getVisibleScheduleSessions,getCurrentScheduleWeekStartDate,getNextScheduleWeekStartDate} from '../src/schedule-module.js'
import {buildCanonicalAttendanceLedger,getAttendanceLedgerMonthRange,getAttendanceLedgerOverdueUnmarkedCount} from '../src/attendance-ledger.js'
import {renderCanonicalAttendanceLedgerModule} from '../src/attendance-ledger-module.js'
import {createAttendanceBoardDraft,canEditAttendanceCell,stageAttendanceCell,attendanceDraftCount,saveAttendanceBoardDraft} from '../src/attendance-board-editor.js'
import {ledgerFixture} from './a6-attendance-ledger-fixtures.js'
import {createAttendancePdfProjection} from '../src/attendance-pdf.js'

const center='month-fixture', now=new Date('2026-10-06T01:00:00Z') // 08:00 VN; today's class starts later.
const classSessions=[{id:'turtle',displayLabel:'Turtle',status:'active',daysOfWeek:['tue','thu'],startTime:'17:30',endTime:'18:30'}]
const scheduleSessions=['tuesday','thursday'].map(dayOfWeek=>({id:dayOfWeek,classSessionId:'turtle',dayOfWeek,
 scheduleType:'recurring',cloudVersion:1,startDate:'2026-09-01',endDate:'2026-10-31',studentIds:['s1','s2']}))
const students=[{id:'s1',fullName:'Nguyễn Minh Anh',studentCode:'HV001',birthYear:2018,level:'Level 1'},
 {id:'s2',fullName:'Trần An Bình',studentCode:'HV002',birthYear:2017}]
const main=readFileSync('src/main.js','utf8')
// Exercise the actual application helper; roster/teacher projections are
// identity stand-ins here because their authority is separately regression-tested.
const sandbox=createContext({Date,normalizeAttendanceLedgerFilters: (await import('../src/attendance-ledger.js')).normalizeAttendanceLedgerFilters,
 getCurrentScheduleWeekStartDate,getNextScheduleWeekStartDate,getVisibleScheduleSessions,classSessions,scheduleSessions,
 getStudentsWithCanonicalProjections:()=>students,v22StudentEnrollmentSets:[],v22StudentEnrollmentCapabilityState:{},
 isV22StudentEnrollmentCapabilityReady:()=>true,deriveV22ScheduleRosters:({sessions})=>sessions,
 projectA3ScheduleSessions:s=>s})
runInContext(main.match(/function getAttendanceLedgerPlannedOccurrences\([\s\S]*?\n\}/)[0],sandbox)
const planned=(month,schedules=scheduleSessions)=>{
 sandbox.scheduleSessions=schedules;sandbox.filters={month}
 return JSON.parse(JSON.stringify(runInContext('getAttendanceLedgerPlannedOccurrences({status:"ready",centerId:"month-fixture",assignments:[]},filters)',sandbox)))
}
const september=['01','03','08','10','15','17','22','24','29'].map(d=>'2026-09-'+d)
const october=['01','06','08','13','15','20','22','27','29'].map(d=>'2026-10-'+d)
assert.deepEqual(planned('2026-09').map(o=>o.occurrenceDate),september)
assert.deepEqual(planned('2026-10').map(o=>o.occurrenceDate),october)
assert.deepEqual(planned('2026-10',scheduleSessions.map(s=>({...s,startDate:'2026-10-06',endDate:'2026-10-15'}))).map(o=>o.occurrenceDate),october.slice(1,5))
assert.equal(planned('2026-10',scheduleSessions.map(s=>({...s,cloudVersion:0}))).length,0)
assert.equal(planned('2026-11').length,0,'No invented dates beyond the effective schedule period')
const replacement={...scheduleSessions[0],id:'tuesday-new',startDate:'2026-10-13'}
const changedSchedules=[...scheduleSessions,replacement]
const projected=planned('2026-10',changedSchedules)
const base={students,classSessions,scheduleSessions:changedSchedules,plannedOccurrences:projected,filters:{month:'2026-10',classSessionId:'turtle'},now,
 monthlyProjection:true,packageCycleReady:true,packageCycleStudentStates:[{studentId:'s1',currentCycle:{id:'cycle',usedSessions:7,totalSessions:16,remainingSessions:9}}]}
const model=buildCanonicalAttendanceLedger(base)
assert.deepEqual(model.columns.map(o=>o.date),october)
assert.equal(model.columns.find(o=>o.date==='2026-10-13').scheduleSessionId,'tuesday-new','Use Schedule-selected effective assignment, not an old weekday alias')
const cell=(student,date,m=model)=>m.rows.find(r=>r.student.id===student).cells.find(c=>c.occurrence.date===date)
assert.equal(cell('s1','2026-10-01').mark,'?');assert.equal(cell('s1','2026-10-01').occurrence.materialized,false)
assert.equal(cell('s1','2026-10-06').mark,'?');assert.equal(cell('s1','2026-10-06').state,'today')
assert(canEditAttendanceCell(cell('s1','2026-10-06'),{canWrite:true,now}),'Today is editable before the study start time; backend held authority remains unchanged')
for(const date of october.slice(2)) {
 assert.equal(cell('s1',date).mark,'');assert.equal(cell('s1',date).state,'future')
 assert(!canEditAttendanceCell(cell('s1',date),{canWrite:true,now}))
}
assert.equal(model.overdueUnmarkedCount,2);assert.equal(getAttendanceLedgerOverdueUnmarkedCount(model),2)
const pdf=createAttendancePdfProjection(model)
assert(pdf.rows.every(row=>row.cells.slice(1).every(c=>c.mark==='')),'Today/future blanks also remain exportable through the existing Attendance PDF')
const filtered=buildCanonicalAttendanceLedger({...base,filters:{...base.filters,query:'Minh Anh'}})
assert.equal(filtered.rows.length,1);assert.equal(filtered.columns.length,9);assert.equal(filtered.overdueUnmarkedCount,1)
assert.equal(buildCanonicalAttendanceLedger({...base,filters:{...base.filters,month:'2026-09'},plannedOccurrences:planned('2026-09')}).rows[0].tuition.progressLabel,model.rows[0].tuition.progressLabel)
const fact={schedule_session_local_id:'thursday',occurrence_date:'2026-10-01',class_session_local_id:'turtle',
 lifecycle_state:'CANCELLED',roster_student_ids:['s1'],planned_start_time:'17:30',planned_end_time:'18:30'}
const cancelled=buildCanonicalAttendanceLedger({...base,occurrences:[fact]})
assert.equal(cell('s1','2026-10-01',cancelled).mark,'×');assert.equal(cell('s2','2026-10-01',cancelled).state,'notExpected')
assert.equal(cancelled.overdueUnmarkedCount,0,'Cancelled cells and students outside the frozen roster are not overdue')
const real={id:'present',authorityLocalId:'present',cloudVersion:1,attendanceAuthority:'v2.3-occurrence-v1',source:'admin',studentId:'s1',
 scheduleSessionId:'thursday',date:'2026-10-01',classSessionId:'turtle',attendanceStatus:'present'}
const marked=buildCanonicalAttendanceLedger({...base,occurrences:[{...fact,lifecycle_state:'HELD'}],attendanceRecords:[real]})
assert.equal(cell('s1','2026-10-01',marked).mark,'✓');assert.equal(marked.overdueUnmarkedCount,0)
const two=buildCanonicalAttendanceLedger({...base,occurrences:[{...fact,lifecycle_state:'HELD'},
 {...fact,schedule_session_local_id:'real-other-oneoff',lifecycle_state:'HELD',planned_start_time:'19:00'}]})
assert.equal(two.columns.filter(o=>o.date==='2026-10-01').length,2,'Distinct canonical occurrences retain their identities')
const oneOff={id:'one-off',scheduleType:'oneOff',cloudVersion:1,classSessionId:'turtle',date:'2026-10-01',studentIds:['s1']}
const override=planned('2026-10',[...scheduleSessions,oneOff])
assert.equal(override.filter(o=>o.occurrenceDate==='2026-10-01').length,1)
assert.equal(override.find(o=>o.occurrenceDate==='2026-10-01').id,'one-off')
const before=structuredClone(base),draft=createAttendanceBoardDraft(center)
assert.equal(attendanceDraftCount(draft),0)
const options={students,classSessions,filters:base.filters,draft,availability:{canWrite:true,attendanceAvailable:true,
 ledgerContext:{status:'ready',occurrences:[]},plannedOccurrences:projected,packageCycleReady:true,
 packageCycleStudentStates:base.packageCycleStudentStates,now}}
const html=renderCanonicalAttendanceLedgerModule(options)
assert.equal(attendanceDraftCount(draft),0,'Rendering all reminders never creates a dirty change')
assert(html.includes('data-attendance-overdue-unmarked-count="2"'))
assert(html.includes('--attendance-date-columns:9'))
for(const label of ['STT','Họ và tên','Năm sinh','Gói','Level','Số buổi còn lại'])assert(html.includes(label))
assert(html.includes('data-attendance-save disabled'))
assert(!html.includes('attendance-ledger-mark is-future" aria-hidden="true">?'))
assert(stageAttendanceCell(draft,{centerId:center,studentId:'s1',cell:cell('s1','2026-10-01'),status:'present',records:[],canWrite:true,now}))
assert.equal(attendanceDraftCount(draft),1);assert.deepEqual(base,before)
assert.equal(model.overdueUnmarkedCount,2,'Dirty overlays do not change canonical overdue read truth')
const calls=[]
const saved=await saveAttendanceBoardDraft(draft,{centerId:center,canWrite:true,supabase:{rpc:async(name,args)=>{
 calls.push({name,args});return {data:{ok:true,outcome_code:'COMMITTED',audit_batch_id:'audit',change_count:1,results:[{}]}}
}}})
assert(saved.ok);assert.equal(calls.length,1);assert.equal(calls[0].name,'v2_9_mutate_attendance_batch')
assert.equal(calls[0].args.p_command.changes[0].occurrenceDate,'2026-10-01')
assert.deepEqual(calls[0].args.p_command.changes[0].expectedRecords,[])
assert(!JSON.stringify(calls[0].args).includes('?'))
assert.equal(draft.message,'Đã lưu điểm danh')
assert(stageAttendanceCell(draft,{centerId:center,studentId:'s1',cell:cell('s1','2026-10-06'),status:'present',canWrite:true,now}))
const notHeld=await saveAttendanceBoardDraft(draft,{centerId:center,canWrite:true,supabase:{rpc:async()=>({error:{message:'a2_occurrence_not_held'}})}})
assert.equal(notHeld.outcome_code,'A2_OCCURRENCE_NOT_HELD')
assert.equal(draft.uncertain,false);assert.equal(attendanceDraftCount(draft),1)
assert.match(draft.error,/Các thay đổi vẫn được giữ/)
// N2 performs occurrence resolution inside the same transaction as this batch.
assert.match(readFileSync('supabase/migrations/202610050001_n2_attendance_write_authority_audit_foundation.sql','utf8'),/a2_internal_ensure_held_occurrence/)
const makeup=ledgerFixture(),source=makeup.attendanceRecords.find(r=>r.scheduleSessionId==='original'&&r.studentId==='student-b')
makeup.occurrences.find(o=>o.schedule_session_local_id==='second').roster_student_ids=['student-a']
makeup.attendanceRecords=makeup.attendanceRecords.filter(r=>r.studentId!=='student-b'||r.scheduleSessionId==='original')
const booking={id:'booking',student_local_id:'student-b',source_attendance_local_id:source.authorityLocalId,
 destination_schedule_local_id:'second',destination_date:'2026-09-21',state:'PLANNED'}
const booked=buildCanonicalAttendanceLedger({...makeup,monthlyProjection:true,makeupBookings:[booking]})
const makeupCells=booked.rows.find(r=>r.student.id==='student-b').cells
assert.equal(makeupCells.filter(c=>c.makeupOnly).length,1)
assert.equal(makeupCells.find(c=>c.occurrence.scheduleSessionId==='second').mark,'—')
assert.equal(makeupCells.find(c=>c.occurrence.scheduleSessionId==='original'),undefined,'Source August does not enter September columns')
const css=readFileSync('src/attendance-ledger-theme.css','utf8')
assert.match(css,/table-layout: fixed/);assert.match(css,/var\(--attendance-date-columns\) \* 40px/)
console.log('N3_FULL_MONTH_GRID_SMOKE: PASS')
