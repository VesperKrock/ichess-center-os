import assert from 'node:assert/strict'
import fs from 'node:fs'
import {f1Fixture} from './fixtures/f1-off-roster-fixture.js'
import {buildCanonicalAttendanceLedger} from '../src/attendance-ledger.js'
import {renderCanonicalAttendanceLedgerModule} from '../src/attendance-ledger-module.js'
import {createAttendanceBoardDraft,stageAttendanceCell,saveAttendanceBoardDraft} from '../src/attendance-board-editor.js'
import {pullAttendanceBoardMakeupSources,MAKEUP_PARTIAL_SAVE,NO_MAKEUP_SOURCE,SAVE_ABSENCE_FIRST} from '../src/attendance-board-makeup.js'

function fixture(count=1) {
  const input=f1Fixture(),centerId=input.centerId,studentId=input.studentId,draft=createAttendanceBoardDraft(centerId)
  const cell=buildCanonicalAttendanceLedger(input).rows.find(r=>r.student.id===studentId).cells.find(c=>c.occurrence.scheduleSessionId==='saturday')
  const candidates=Array.from({length:count},(_,i)=>({attendance_local_id:`source-${i}`,schedule_session_id:`source-schedule-${i}`,
    occurrence_date:['2026-10-02','2026-09-30','2026-09-25'][i],start_time:'19:00:00'}))
  const facts=[...input.occurrences,...candidates.map(c=>({center_id:centerId,schedule_session_local_id:c.schedule_session_id,
    occurrence_date:c.occurrence_date,lifecycle_state:'HELD',planned_start_time:'19:00:00',planned_end_time:'20:30:00'}))]
  const calls=[],bookings=[];let failAttendance=false,loseBooking=false,switchAfterBooking=false,current=true,units=0,n2Key
  const supabase={rpc:async(name,args)=>{
    calls.push({name,args});assert.equal(args.p_center_id,centerId)
    if(name==='a4_list_eligible_missed_occurrences')return {data:{ok:true,center_id:centerId,student_id:studentId,candidates}}
    if(name==='n3_list_makeup_booking_context')return {data:{ok:true,center_id:centerId,bookings:bookings.filter(b=>
      [b.source_date,b.destination_date].some(d=>d>=args.p_from_date&&d<=args.p_to_date)),
      destinations:facts.filter(o=>o.occurrence_date>=args.p_from_date&&o.occurrence_date<=args.p_to_date)}}
    if(name==='n3_mutate_makeup_booking'){
      assert.equal(args.p_command.operation,'BOOK');assert(!bookings.length)
      const c=args.p_command
      bookings.push({id:'booking',version:1,state:'PLANNED',center_id:centerId,student_local_id:studentId,
        source_attendance_local_id:c.sourceAttendanceLocalId,source_date:candidates.find(s=>s.attendance_local_id===c.sourceAttendanceLocalId).occurrence_date,
        destination_schedule_local_id:c.destinationScheduleId,destination_date:c.destinationDate})
      if(switchAfterBooking)current=false
      if(loseBooking){loseBooking=false;throw Error('lost N3 response')}
      return {data:{ok:true,center_id:centerId,outcome_code:'COMMITTED',results:[bookings[0]]}}
    }
    assert.equal(name,'v2_9_mutate_attendance_batch')
    assert.equal(args.p_command.changes[0].attendanceStatus,'makeup')
    assert(bookings.some(b=>b.source_attendance_local_id===args.p_command.changes[0].makeupForAttendanceLocalId))
    if(n2Key)assert.equal(args.p_idempotency_key,n2Key)
    n2Key=args.p_idempotency_key
    if(failAttendance){failAttendance=false;throw Error('N2 unavailable')}
    units=1;bookings[0].state='COMPLETED'
    return {data:{ok:true,outcome_code:'COMMITTED',audit_batch_id:'audit',change_count:1,results:[{}]}}
  }}
  const resolve=()=>pullAttendanceBoardMakeupSources({supabase,centerId,studentId,scheduleSessionId:'saturday',occurrenceDate:'2026-10-03',draft})
  const stage=source=>stageAttendanceCell(draft,{centerId,studentId,cell,records:input.attendanceRecords,status:'makeup',
    makeupTarget:source.attendance_local_id,makeupSource:source,canWrite:true,now:input.now})
  const save=()=>saveAttendanceBoardDraft(draft,{supabase,centerId,canWrite:true,isContextCurrent:()=>current})
  return {input,centerId,studentId,draft,cell,candidates,facts,calls,bookings,resolve,stage,save,
    failAttendance:()=>{failAttendance=true},loseBooking:()=>{loseBooking=true},switchAfterBooking:()=>{switchAfterBooking=true},
    get units(){return units}}
}
const mutations=f=>f.calls.filter(c=>['n3_mutate_makeup_booking','v2_9_mutate_attendance_batch'].includes(c.name))
const none=fixture(0)
assert.equal((await none.resolve()).error,NO_MAKEUP_SOURCE);assert.deepEqual(mutations(none),[])
none.draft.changes['local-draft-v']={studentId:none.studentId,scheduleSessionId:'friday',occurrenceDate:'2026-10-02',value:{status:'absent'}}
assert.equal((await none.resolve()).error,SAVE_ABSENCE_FIRST);assert.deepEqual(mutations(none),[])
const single=fixture(),original=structuredClone(single.input)
const result=await single.resolve();assert.equal(result.candidates.length,1);assert(single.stage(result.candidates[0]))
assert.deepEqual(mutations(single),[],'Source selection and draft preview have no business writes')
const html=renderCanonicalAttendanceLedgerModule({students:single.input.students,classSessions:single.input.classSessions,
  filters:single.input.filters,draft:single.draft,detailState:{studentId:single.studentId,scheduleSessionId:'saturday',dateKey:'2026-10-03'},
  availability:{canWrite:true,attendanceAvailable:true,tuitionAvailable:true,attendanceRecords:single.input.attendanceRecords,
    ledgerContext:{status:'ready',occurrences:single.input.occurrences},now:single.input.now}})
assert.match(html,/Bù cho: T6 02\/10 · 19:00–20:30/)
assert(!/data-attendance-edit-status="(?:absent|unmarked)"/.test(html))
assert((await single.save()).ok);assert.equal(single.units,1)
assert.deepEqual(mutations(single).map(c=>c.name),['n3_mutate_makeup_booking','v2_9_mutate_attendance_batch'])
assert.deepEqual(single.input,original,'Inputs/enrollment/future roster remain unchanged')
const multiple=fixture(3)
const list=await multiple.resolve();assert.equal(list.candidates.length,3);assert.equal(Object.keys(multiple.draft.changes).length,0)
const multiHtml=renderCanonicalAttendanceLedgerModule({students:multiple.input.students,classSessions:multiple.input.classSessions,
  filters:multiple.input.filters,draft:multiple.draft,detailState:{studentId:multiple.studentId,scheduleSessionId:'saturday',dateKey:'2026-10-03',
    makeupPicking:true,makeupCandidates:list.candidates},availability:{canWrite:true,attendanceAvailable:true,
    attendanceRecords:multiple.input.attendanceRecords,ledgerContext:{status:'ready',occurrences:multiple.input.occurrences},now:multiple.input.now}})
assert.equal((multiHtml.match(/data-attendance-makeup-source=/g)||[]).length,3,'Multiple-source popover renders every explicit choice')
assert(multiple.stage(list.candidates[1]));assert((await multiple.save()).ok)
assert.equal(multiple.bookings[0].source_attendance_local_id,'source-1')
const cancel=fixture();cancel.stage((await cancel.resolve()).candidates[0])
assert(stageAttendanceCell(cancel.draft,{centerId:cancel.centerId,studentId:cancel.studentId,cell:cancel.cell,
  status:null,canWrite:true,now:cancel.input.now}));assert.equal(Object.keys(cancel.draft.changes).length,0)
assert.deepEqual(mutations(cancel),[])
for(const loseBooking of [false,true]){
  const retry=fixture();retry.stage((await retry.resolve()).candidates[0])
  if(loseBooking)retry.loseBooking();else retry.failAttendance()
  assert(!(await retry.save()).ok);assert.equal(retry.units,0);assert.equal(retry.bookings.length,1)
  if(!loseBooking)assert.match(retry.draft.error,/Lịch học bù đã được tạo; chưa xác nhận được điểm danh/)
  assert((await retry.save()).ok);assert.equal(retry.units,1)
  assert.equal(mutations(retry).filter(c=>c.name==='n3_mutate_makeup_booking').length,1,'Fresh exact booking reuse after either lost command')
}
const existing=fixture()
existing.bookings.push({id:'existing',version:1,state:'PLANNED',center_id:existing.centerId,student_local_id:existing.studentId,
  source_attendance_local_id:'source-0',source_date:'2026-10-02',destination_schedule_local_id:'saturday',destination_date:'2026-10-03'})
existing.stage((await existing.resolve()).candidates[0]);assert((await existing.save()).ok)
assert.equal(mutations(existing).filter(c=>c.name==='n3_mutate_makeup_booking').length,0)
const conflict=fixture();conflict.bookings.push({...existing.bookings[0],state:'PLANNED',destination_date:'2026-10-04',destination_schedule_local_id:'sunday'})
assert.equal((await conflict.resolve()).candidates.length,0,'Booked source elsewhere is not offered')
const missingFact=fixture();missingFact.facts.splice(missingFact.facts.findIndex(f=>f.schedule_session_local_id==='source-schedule-0'),1)
assert.equal((await missingFact.resolve()).candidates.length,0,'A4 legacy fallback must still satisfy N3 frozen source requirement')
const switched=fixture();switched.stage((await switched.resolve()).candidates[0]);switched.switchAfterBooking()
assert(!(await switched.save()).ok);assert.equal(mutations(switched).filter(c=>c.name==='v2_9_mutate_attendance_batch').length,0)
assert.equal(switched.bookings.length,1,'Valid partial booking is not deleted on context invalidation')
const busy=fixture();busy.stage((await busy.resolve()).candidates[0])
const first=busy.save();assert(busy.draft.saving);assert(!(await busy.save()).ok);await first
assert.equal(busy.bookings.length,1)
const main=fs.readFileSync('src/main.js','utf8')
assert.match(main,/chooseAttendanceBoardMakeupSource/);assert.match(main,/isContextCurrent: \(\) => attendanceBoardDraft === draft/)
assert(!main.includes("draft.error = 'Chưa có lịch học bù hợp lệ cho buổi này.'"))
console.log('F1_1_MAKEUP_BOARD_FLOW_SMOKE: PASS')
