import assert from 'node:assert/strict'
import fs from 'node:fs'
import {f1Fixture} from './fixtures/f1-off-roster-fixture.js'
import {buildCanonicalAttendanceLedger} from '../src/attendance-ledger.js'
import {renderCanonicalAttendanceLedgerModule} from '../src/attendance-ledger-module.js'
import {createAttendanceBoardDraft,stageAttendanceCell,saveAttendanceBoardDraft} from '../src/attendance-board-editor.js'
import {pullAttendanceBoardMakeupSources} from '../src/attendance-board-makeup.js'

function fixture({cancelled=false,resolveFails=false,switchAfterResolve=false}={}) {
  const input=f1Fixture(),{centerId,studentId}=input,draft=createAttendanceBoardDraft(centerId)
  const destination={id:'oneoff',scheduleType:'oneOff',occurrenceDate:'2026-10-07',startTime:'16:30',endTime:'17:15',studentIds:[],status:'scheduled'}
  input.plannedOccurrences=[destination]
  const cell=buildCanonicalAttendanceLedger(input).rows.find(r=>r.student.id===studentId).cells.find(c=>c.occurrence.scheduleSessionId==='oneoff')
  assert.equal(cell.offRoster,true);assert.equal(cell.state,'notExpected');assert.equal(cell.occurrence.materialized,false)
  const source=input.attendanceRecords[0],calls=[],bookings=[],facts=[...input.occurrences]
  let units=0,current=true
  const supabase={rpc:async(name,args)=>{
    calls.push({name,args});assert.equal(args.p_center_id,centerId)
    if(name==='a4_list_eligible_missed_occurrences')return {data:{ok:true,center_id:centerId,student_id:studentId,candidates:[{
      attendance_local_id:source.authorityLocalId,schedule_session_id:source.scheduleSessionId,occurrence_date:source.date,start_time:'19:00:00',
    }]}}
    if(name==='n3_list_makeup_booking_context')return {data:{ok:true,center_id:centerId,bookings:bookings.filter(b=>[b.source_date,b.destination_date].some(d=>d>=args.p_from_date&&d<=args.p_to_date)),
      destinations:facts.filter(o=>o.lifecycle_state!=='CANCELLED'&&o.occurrence_date>=args.p_from_date&&o.occurrence_date<=args.p_to_date)}}
    if(name==='a2_manage_occurrence'){
      assert.equal(args.p_action,'RESOLVE');assert.equal(args.p_schedule_session_id,'oneoff');assert.equal(args.p_occurrence_date,'2026-10-07')
      if(resolveFails)return {error:{message:'a2_schedule_occurrence_not_found'}}
      const fact={center_id:centerId,schedule_session_local_id:'oneoff',occurrence_date:'2026-10-07',lifecycle_state:cancelled?'CANCELLED':'PLANNED',
        roster_student_ids:[],planned_start_time:'16:30:00',planned_end_time:'17:15:00'}
      facts.push(fact);if(switchAfterResolve)current=false
      return {data:{ok:true,center_id:centerId,occurrence:fact}}
    }
    if(name==='n3_mutate_makeup_booking'){
      assert.equal(units,0);assert(facts.some(f=>f.schedule_session_local_id==='oneoff'&&f.lifecycle_state!=='CANCELLED'),'N3 requires a real persisted destination')
      assert.equal(bookings.length,0);const c=args.p_command
      bookings.push({id:'booking',version:1,state:'PLANNED',center_id:centerId,student_local_id:studentId,source_attendance_local_id:c.sourceAttendanceLocalId,
        source_date:source.date,destination_schedule_local_id:c.destinationScheduleId,destination_date:c.destinationDate})
      return {data:{ok:true,center_id:centerId,outcome_code:'COMMITTED',results:bookings}}
    }
    assert.equal(name,'v2_9_mutate_attendance_batch');assert.equal(bookings.length,1);assert.equal(units,0)
    assert.equal(args.p_command.changes[0].attendanceStatus,'makeup');units=1
    return {data:{ok:true,outcome_code:'COMMITTED',audit_batch_id:'audit',change_count:1,results:[{}]}}
  }}
  const preview=()=>pullAttendanceBoardMakeupSources({supabase,centerId,studentId,scheduleSessionId:'oneoff',occurrenceDate:'2026-10-07',occurrence:cell.occurrence,draft})
  const stage=candidate=>stageAttendanceCell(draft,{centerId,studentId,cell,records:input.attendanceRecords,status:'makeup',makeupTarget:candidate.attendance_local_id,
    makeupSource:candidate,canWrite:true,now:input.now})
  const save=()=>saveAttendanceBoardDraft(draft,{supabase,centerId,canWrite:true,isContextCurrent:()=>current})
  return {input,cell,draft,calls,bookings,facts,preview,stage,save,get units(){return units}}
}
const f=fixture(),original=structuredClone(f.input)
const sources=await f.preview()
assert(sources.ok,'Unmaterialized off-roster destination must allow persisted-source preview (F1.1 fails here)')
assert.equal(sources.candidates.length,1);assert.equal(f.units,0);assert.equal(f.bookings.length,0)
assert(!f.calls.some(c=>/manage|mutate/.test(c.name)),'Preview never materializes or writes a booking')
assert(f.stage(sources.candidates[0]));assert((await f.save()).ok);assert.equal(f.units,1)
assert.deepEqual(f.calls.filter(c=>/manage|mutate/.test(c.name)).map(c=>c.name),['a2_manage_occurrence','n3_mutate_makeup_booking','v2_9_mutate_attendance_batch'])
assert.deepEqual(f.facts.at(-1).roster_student_ids,[]);assert.deepEqual(f.input,original)
for(const options of [{cancelled:true},{resolveFails:true},{switchAfterResolve:true}]){
  const blocked=fixture(options);assert(blocked.stage((await blocked.preview()).candidates[0]));assert(!(await blocked.save()).ok)
  assert.equal(blocked.bookings.length,0);assert.equal(blocked.units,0)
  if(options.cancelled)assert.match(blocked.draft.error,/đã bị hủy/)
}
const html=renderCanonicalAttendanceLedgerModule({students:f.input.students,classSessions:f.input.classSessions,filters:f.input.filters,
  detailState:{studentId:f.input.studentId,scheduleSessionId:'saturday',dateKey:'2026-10-03',makeupPicking:true,makeupLoading:true},
  availability:{canWrite:true,attendanceAvailable:true,attendanceRecords:f.input.attendanceRecords,ledgerContext:{status:'ready',occurrences:f.input.occurrences},now:f.input.now}})
assert.match(html,/Đang tìm buổi vắng/);assert(!html.includes('Buổi học chưa sẵn sàng'))
assert.match(fs.readFileSync('src/main.js','utf8'),/occurrenceDate:cell\.occurrence\.date, occurrence:cell\.occurrence, draft/,'Real Board must pass its projected identity to preview')
console.log('F1_2_MAKEUP_DESTINATION_READINESS_SMOKE: PASS')
