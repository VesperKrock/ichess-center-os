import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {ledgerFixture} from './a6-attendance-ledger-fixtures.js'
import {buildCanonicalAttendanceLedger} from '../src/attendance-ledger.js'
import {renderCanonicalAttendanceLedgerModule} from '../src/attendance-ledger-module.js'
import {createAttendanceBoardDraft,stageAttendanceCell,buildAttendanceDraftChanges,saveAttendanceBoardDraft} from '../src/attendance-board-editor.js'
import {currentClassMainTeacher,pullMakeupBookingContext,mutateMakeupBooking} from '../src/cloud-makeup-bookings.js'
import {pullCanonicalAttendanceLedgerContext} from '../src/cloud-attendance-ledger.js'
const input=ledgerFixture(), center='a6-fixture'
const source=input.attendanceRecords.find(r=>r.scheduleSessionId==='original'&&r.studentId==='student-b')
const dest=input.occurrences.find(o=>o.schedule_session_local_id==='second')
dest.roster_student_ids=dest.roster_student_ids.filter(id=>id!=='student-b')
input.attendanceRecords=input.attendanceRecords.filter(r=>!(r.studentId==='student-b'
  && (r.scheduleSessionId==='second'||r.attendanceStatus==='makeup')))
const original=structuredClone(input)
assert(!dest.roster_student_ids.includes('student-b'))
const booking={id:'booking',center_id:center,student_local_id:'student-b',source_attendance_local_id:source.authorityLocalId,
  source_date:source.date,source_schedule_local_id:source.scheduleSessionId,source_class_local_id:'class-a',
  destination_schedule_local_id:'second',destination_date:dest.occurrence_date,destination_class_local_id:'class-b',state:'PLANNED',version:1}
const model=buildCanonicalAttendanceLedger({...input,makeupBookings:[booking]})
const row=model.rows.find(r=>r.student.id==='student-b'),cell=row.cells.find(c=>c.occurrence.scheduleSessionId==='second')
assert.equal(cell.state,'unmarked');assert(cell.makeupOnly)
assert.deepEqual(cell.occurrence.regularStudentIds,dest.roster_student_ids)
assert.equal(row.tuition.progressLabel,buildCanonicalAttendanceLedger(input).rows.find(r=>r.student.id==='student-b').tuition.progressLabel)
assert(row.cells.filter(c=>c.makeupOnly).length===1)
assert.deepEqual(input,original,'Projection must not mutate frozen facts, enrollment or Attendance')
for(const lifecycle of ['PLANNED','CANCELLED']) {
  const protectedModel=buildCanonicalAttendanceLedger({...input,makeupBookings:[booking],
    occurrences:input.occurrences.map(o=>o===dest?{...o,lifecycle_state:lifecycle}:o),
    now: lifecycle==='PLANNED'?new Date('2026-09-20T00:00:00Z'):input.now})
  const protectedCell=protectedModel.rows.find(r=>r.student.id==='student-b').cells.find(c=>c.occurrence.scheduleSessionId==='second')
  assert.equal(protectedCell.state,lifecycle==='PLANNED'?'future':'cancelled')
  assert(!stageAttendanceCell(createAttendanceBoardDraft(center),{centerId:center,studentId:'student-b',
    cell:protectedCell,status:'makeup',makeupTarget:source.authorityLocalId,canWrite:true,
    now:lifecycle==='PLANNED'?new Date('2026-09-20T00:00:00Z'):input.now}))
}
const draft=createAttendanceBoardDraft(center)
const stage=(status,target)=>stageAttendanceCell(draft,{centerId:center,studentId:'student-b',cell,
  records:input.attendanceRecords,status,makeupTarget:target,canWrite:true,now:input.now})
assert(!stage('present'));assert(!stage('absent'));assert(!stage('makeup','wrong'))
assert(stage('makeup',source.authorityLocalId))
const command=buildAttendanceDraftChanges(draft)[0]
assert.equal(command.attendanceStatus,'makeup');assert.equal(command.makeupForAttendanceLocalId,source.authorityLocalId)
assert.deepEqual(command.expectedRecords,[])
const rejected=await saveAttendanceBoardDraft(draft,{centerId:center,canWrite:true,
  supabase:{rpc:async()=>({error:{message:'n3_booking_destination_mismatch'}})}})
assert(!rejected.ok);assert.equal(draft.uncertain,false);assert.equal(Object.keys(draft.changes).length,1)
const opts={students:input.students,classSessions:input.classSessions,filters:{month:'2026-09'},
  availability:{attendanceAvailable:true,canWrite:true,ledgerContext:{status:'ready',occurrences:input.occurrences,
    makeupBookings:[booking],assignments:[{class_session_local_id:'class-b',effective_from:'2026-01-01',teacher_name:'Cô Chính'}]},
    attendanceRecords:input.attendanceRecords,now:input.now}}
const html=renderCanonicalAttendanceLedgerModule({...opts,filters:{...opts.filters,classSessionId:'class-b'}})
assert.match(html,/Tháng trước/);assert.match(html,/Tháng sau/);assert.match(html,/Tháng Chín 2026/)
assert.doesNotMatch(html,/Từ ngày|Đến ngày|Khoảng ngày/)
assert.match(html,/Giáo viên chính: Cô Chính/);assert.match(html,/attendance-ledger-makeup-context">Bù/)
const detail=renderCanonicalAttendanceLedgerModule({...opts,detailState:{studentId:'student-b',scheduleSessionId:'second',dateKey:dest.occurrence_date}})
assert.match(detail,/Bù cho:/);assert.doesNotMatch(detail,/data-attendance-edit-status="present"/)
assert.equal(currentClassMainTeacher([], 'class-b',input.now),'Chưa rõ')
assert.equal(currentClassMainTeacher([{class_session_local_id:'class-b',teacher_name:'Old',effective_from:'2026-01-01',effective_to:'2026-08-01'}], 'class-b',input.now),'Chưa rõ')
const responses={bookings:[booking],destinations:[dest],ok:true,center_id:center}
const supabase={rpc:async(name,args)=>({data:name==='n3_list_makeup_booking_context'?responses:
  {ok:true,center_id:center,assignments:[],occurrences:input.occurrences.filter(o=>o.occurrence_date>=args.p_from_date&&o.occurrence_date<=args.p_to_date)}})}
assert((await pullMakeupBookingContext({supabase,centerId:center})).ok)
assert((await pullCanonicalAttendanceLedgerContext({supabase,centerId:center,filters:input.filters,includeMakeupBookings:true})).makeupBookings.length===1)
assert(!(await pullMakeupBookingContext({supabase:{rpc:async()=>({data:{...responses,center_id:'other'}})},centerId:center})).ok)
let request
const attempt={operation:'BOOK',studentId:'student-b',sourceAttendanceLocalId:source.authorityLocalId}
const retry=await mutateMakeupBooking({supabase:{rpc:async(name,args)=>{request={name,args};throw Error('lost response')}},centerId:center,command:attempt,idempotencyKey:'fixed'})
assert(!retry.ok&&retry.uncertain);assert.equal(request.args.p_idempotency_key,'fixed')
const main=readFileSync('src/main.js','utf8')
assert.match(main,/draft\.bookingAttempt/);assert.match(main,/includeMakeupBookings: true/)
assert.match(main,/status === 'makeup' && cell\.makeupBooking/)
console.log('N3_MAKEUP_BOOKING_SMOKE: PASS')
