import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createContext,runInContext} from 'node:vm'
import {createCenterSwitchDraftTracker} from '../src/center-switch-drafts.js'
import {ledgerFixture} from './a6-attendance-ledger-fixtures.js'
import {buildCanonicalAttendanceLedger} from '../src/attendance-ledger.js'
import {renderCanonicalAttendanceLedgerModule} from '../src/attendance-ledger-module.js'
import {buildAttendanceRecordCloudEntity} from '../src/cloud-attendance-records.js'
import {projectC51AuthoritativeRecords} from '../src/cloud-attendance-realtime.js'
import {createAttendanceBoardDraft,attendanceDraftCount,attendanceDraftCellKey,
  stageAttendanceCell,canEditAttendanceCell,buildAttendanceDraftChanges,
  reconcileAttendanceDraft,saveAttendanceBoardDraft} from '../src/attendance-board-editor.js'

const input=ledgerFixture(),model=buildCanonicalAttendanceLedger(input),centerId='a6-fixture'
const cell=(student,schedule,board=model)=>board.rows.find(row=>row.student.id===student).cells
  .find(item=>item.occurrence.scheduleSessionId===schedule)
const draft=createAttendanceBoardDraft(centerId)
const stage=(student,schedule,status,extra={})=>stageAttendanceCell(draft,{centerId,studentId:student,
  cell:cell(student,schedule),records:input.attendanceRecords,status,canWrite:true,now:input.now,...extra})
const options={students:input.students,classSessions:input.classSessions,filters:input.filters,draft,
  availability:{canWrite:true,centerName:'Cơ sở kiểm thử',attendanceAvailable:true,tuitionAvailable:true,
    ledgerContext:{status:'ready',occurrences:input.occurrences},attendanceRecords:input.attendanceRecords,
    packageCycleReady:true,packageCycleStudentStates:input.packageCycleStudentStates,now:input.now}}
const resting=renderCanonicalAttendanceLedgerModule(options)
for(const mark of ['✓','V','B','?'])assert(resting.includes(`>${mark}</span>`),`${mark} renders compactly`)
assert(!/<th[^>]*>Lý do vắng/.test(resting))
assert(resting.includes('còn 4')&&resting.includes('<strong>4/8</strong>'))
assert(resting.indexOf('Tiến độ / còn lại')>resting.indexOf('data-attendance-occurrence-key'))
assert(resting.includes('data-attendance-save disabled'))
const endedCycle=renderCanonicalAttendanceLedgerModule({...options,availability:{...options.availability,
 packageCycleStudentStates:input.packageCycleStudentStates.map(state=>({...state,currentCycle:{...state.currentCycle,
  manuallyEndedAt:'2026-09-28T00:00:00Z',remainingSessions:0}}))}})
assert(endedCycle.includes('<strong>4/8</strong><small>còn 0</small>'),'Progress keeps authoritative used/N for ended cycles too')
const before=structuredClone(input)
assert(stage('student-left','held','present'))
assert(stage('student-a','held','absent'))
assert.equal(attendanceDraftCount(draft),2)
assert.deepEqual(input,before,'Draft edits cannot mutate canonical reads, progress or records')
let exportModel
renderCanonicalAttendanceLedgerModule({...options,onModel:model=>{exportModel=model}})
assert.equal(cell('student-left','held',exportModel).state,'unmarked','PDF keeps the canonical cell while a present draft is visible')
let changes=buildAttendanceDraftChanges(draft)
assert.equal(changes.length,2)
assert.equal(changes.find(change=>change.studentId==='student-a').absenceReason,null)
assert.equal(changes.find(change=>change.studentId==='student-a').expectedRecords[0].version,1)
assert(stage('student-a','held','absent',{reason:'Bệnh'}))
assert.equal(buildAttendanceDraftChanges(draft).find(change=>change.studentId==='student-a').absenceReason,'Bệnh')
assert(stage('student-a','held','present'))
assert.equal(attendanceDraftCount(draft),1,'Returning to the canonical value clears the dirty cell')
assert(stage('student-a','held','absent',{reason:'Bệnh'}))
assert(stage('student-a','held',null))
const unmark=buildAttendanceDraftChanges(draft).find(change=>change.studentId==='student-a')
assert.equal(unmark.action,'UNMARK');assert(!('absenceReason' in unmark))
assert.equal(stage('student-a','held','absent',{reason:'Chưa có lý do'}),false)
assert(stage('student-a','held','absent'))
const detail=renderCanonicalAttendanceLedgerModule({...options,detailState:{studentId:'student-a',scheduleSessionId:'held',dateKey:'2026-09-21'}})
assert(detail.includes('Chưa có lý do'))
assert(detail.includes('value="" placeholder="Để trống'))
assert(!buildAttendanceDraftChanges(draft).some(change=>change.absenceReason==='Chưa có lý do'))
for(const schedule of ['future','cancelled']){
 assert.equal(canEditAttendanceCell(cell('student-a',schedule),{canWrite:true,now:input.now}),false)
 assert.equal(stage('student-a',schedule,'absent'),false)
}
assert.equal(stage('student-a','held','present',{centerId:'other-center'}),false)
assert.equal(stage('student-a','held','present',{canWrite:false}),false)
for(const status of ['trial','excused','excusedAbsent','unexcusedAbsent']){
 const records=input.attendanceRecords.map(row=>row.studentId==='student-a'&&row.scheduleSessionId==='held'
  ?{...row,attendanceStatus:status,absenceReason:'Lý do lịch sử'}:row)
 const history=buildCanonicalAttendanceLedger({...input,attendanceRecords:records})
 assert.equal(canEditAttendanceCell(cell('student-a','held',history),{canWrite:true,now:input.now}),false)
 const readOnly=renderCanonicalAttendanceLedgerModule({...options,draft:createAttendanceBoardDraft(centerId),availability:{...options.availability,
  attendanceRecords:records},detailState:{studentId:'student-a',scheduleSessionId:'held',dateKey:'2026-09-21'}})
 assert(readOnly.includes('Chỉ xem'));assert(!readOnly.includes('data-attendance-edit-status'))
 if(status!=='trial')assert(readOnly.includes('<p>Lý do lịch sử</p>'),'Historical absence reasons remain readable')
}
assert.equal(stage('student-left','held','makeup'),false,'No invalid makeup without a source')
assert(stage('student-left','held','makeup',{makeupTarget:'missed-source'}))
assert.equal(buildAttendanceDraftChanges(draft).find(change=>change.studentId==='student-left').makeupForAttendanceLocalId,'missed-source')
const noSource=renderCanonicalAttendanceLedgerModule({...options,detailState:{studentId:'student-a',
 scheduleSessionId:'held',dateKey:'2026-09-21',makeupPicking:true,makeupCandidates:[]}})
assert(noSource.includes('Chưa có buổi vắng phù hợp'))

const calls=[]
let fail=true
const client={rpc:async(name,args)=>{
 calls.push({name,args})
 if(fail)return {error:{message:'network unavailable',code:'FETCH_ERROR'}}
 return {data:{ok:true,outcome_code:'COMMITTED',audit_batch_id:'batch',
  change_count:args.p_command.changes.length,results:args.p_command.changes.map(()=>({}))}}
}}
const savedChanges=structuredClone(draft.changes)
let result=await saveAttendanceBoardDraft(draft,{supabase:client,centerId,canWrite:true})
assert.equal(result.ok,false);assert.deepEqual(draft.changes,savedChanges)
assert(draft.uncertain);assert.equal(draft.saving,false)
assert.equal(stage('student-a','held','present'),false,'Unconfirmed writes retry the original intent')
fail=false
result=await saveAttendanceBoardDraft(draft,{supabase:client,centerId,canWrite:true})
assert(result.ok);assert.equal(draft.message,'Đã lưu điểm danh');assert.equal(attendanceDraftCount(draft),0)
assert.deepEqual(calls[0],calls[1],'A network retry keeps the same command and idempotency key')
assert(calls.every(call=>call.name==='v2_9_mutate_attendance_batch'))
assert.equal(calls[0].args.p_command.changes.length,2,'All dirty cells use one atomic batch')
assert(stage('student-a','held','absent'))
const staleChanges=structuredClone(draft.changes)
result=await saveAttendanceBoardDraft(draft,{supabase:{rpc:async()=>({error:{message:'n2_attendance_version_conflict'}})},centerId,canWrite:true})
assert.equal(result.ok,false);assert.equal(attendanceDraftCount(draft),1)
assert(draft.changes[Object.keys(draft.changes)[0]].conflict)
let overwrites=0
result=await saveAttendanceBoardDraft(draft,{supabase:{rpc:()=>{overwrites++}},centerId,canWrite:true})
assert.equal(result.outcome_code,'REVIEW_REQUIRED');assert.equal(overwrites,0)
const latestRecords=input.attendanceRecords.map(row=>row.studentId==='student-a'&&row.scheduleSessionId==='held'
 ?{...row,cloudVersion:2,absenceReason:'Remote',attendanceStatus:'absent'}:row)
reconcileAttendanceDraft(draft,latestRecords)
assert.equal(draft.changes[Object.keys(draft.changes)[0]].expectedRecords[0].version,staleChanges[Object.keys(staleChanges)[0]].expectedRecords[0].version)
const latest=buildCanonicalAttendanceLedger({...input,attendanceRecords:latestRecords})
assert(stageAttendanceCell(draft,{centerId,studentId:'student-a',cell:cell('student-a','held',latest),
 records:latestRecords,status:'present',canWrite:true,now:input.now}))
assert.equal(buildAttendanceDraftChanges(draft)[0].expectedRecords[0].version,2,'Explicit review adopts current expected records')
let resolve
const saving=saveAttendanceBoardDraft(draft,{supabase:{rpc:()=>new Promise(done=>{resolve=done})},centerId,canWrite:true})
assert(draft.saving)
assert.equal((await saveAttendanceBoardDraft(draft,{supabase:client,centerId,canWrite:true})).ok,false)
resolve({data:{ok:true,outcome_code:'COMMITTED',audit_batch_id:'second',change_count:1,results:[{}]}})
await saving
assert.equal(attendanceDraftCount(draft),0)
// Corrections arrive through the existing realtime read bridge as well as reloads.
const realtimeEntity=buildAttendanceRecordCloudEntity({centerId,record:{id:'realtime-qa',studentId:'student-a',
 date:'2026-09-21',sessionId:'held',scheduleSessionId:'held',source:'admin',status:'absent',attendanceStatus:'absent'}})
assert(realtimeEntity.ok)
const cloudRow={...realtimeEntity.data,entity_version:1,updated_at:'2026-09-21T12:00:00Z'}
const first=projectC51AuthoritativeRecords({cloudRecords:[cloudRow]}).attendanceRecords
const correctedRow={...cloudRow,entity_version:2,payload:{...cloudRow.payload,status:'present',attendanceStatus:'present'}}
const corrected=projectC51AuthoritativeRecords({attendanceRecords:first,cloudRecords:[correctedRow]}).attendanceRecords
assert.equal(corrected[0].attendanceStatus,'present');assert.equal(corrected[0].cloudVersion,2)
assert.deepEqual(projectC51AuthoritativeRecords({attendanceRecords:corrected,cloudRecords:[cloudRow]}).attendanceRecords,corrected)
const tracker=createCenterSwitchDraftTracker(),navigationDraft=createAttendanceBoardDraft(centerId)
const tracked=()=>[{key:'attendance-board',identity:centerId,value:navigationDraft.changes}]
tracker.observe(tracked());assert(stageAttendanceCell(navigationDraft,{centerId,studentId:'student-a',
 cell:cell('student-a','held'),records:input.attendanceRecords,status:'absent',canWrite:true,now:input.now}))
tracker.observe(tracked());assert.equal(tracker.dirty(tracked()).length,1)
let confirmations=0,alerts=0,accept=false
const navigation=createContext({attendanceBoardDraft:navigationDraft,attendanceBoardDetailState:{studentId:'student-a'},
 attendanceDraftCount,createAttendanceBoardDraft,
 window:{confirm:()=>{confirmations++;return accept},alert:()=>{alerts++}}})
runInContext('function getCurrentAttendanceBoardDraft(){return attendanceBoardDraft}',navigation)
const main=readFileSync('src/main.js','utf8')
runInContext(main.match(/function confirmAttendanceBoardNavigation\(\) \{[\s\S]*?\n\}/)[0],navigation)
assert.equal(runInContext('confirmAttendanceBoardNavigation()',navigation),false)
assert.equal(attendanceDraftCount(navigation.attendanceBoardDraft),1,'Cancelling navigation preserves the draft')
navigationDraft.saving=true
assert.equal(runInContext('confirmAttendanceBoardNavigation()',navigation),false)
assert.equal(confirmations,1);assert.equal(alerts,1,'In-flight saves block navigation without a discard prompt')
navigationDraft.saving=false;accept=true
assert.equal(runInContext('confirmAttendanceBoardNavigation()',navigation),true)
assert.equal(attendanceDraftCount(navigation.attendanceBoardDraft),0)
assert.equal(navigation.attendanceBoardDraft.centerId,centerId)
assert.equal(confirmations,2,'One confirmation per attempted dirty navigation')
const schedule=readFileSync('src/schedule-module.js','utf8')
assert(!/data-admin-attendance|mutateAttendanceBatch|v2_9_mutate_attendance_batch/.test(schedule))
console.log('N3_OPERATIONAL_ATTENDANCE_BOARD_SMOKE: PASS')
