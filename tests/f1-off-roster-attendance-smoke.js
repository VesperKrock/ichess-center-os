import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { f1Fixture, f1Record } from './fixtures/f1-off-roster-fixture.js'
import { buildCanonicalAttendanceLedger } from '../src/attendance-ledger.js'
import { renderCanonicalAttendanceLedgerModule } from '../src/attendance-ledger-module.js'
import { createAttendanceBoardDraft, canEditAttendanceCell, stageAttendanceCell,
  attendanceDraftCount, buildAttendanceDraftChanges, saveAttendanceBoardDraft } from '../src/attendance-board-editor.js'

const input=f1Fixture(), original=structuredClone(input), draft=createAttendanceBoardDraft(input.centerId)
const model=()=>buildCanonicalAttendanceLedger(input)
const row=m=>m.rows.find(r=>r.student.id===input.studentId)
const cell=(schedule,m=model())=>row(m).cells.find(c=>c.occurrence.scheduleSessionId===schedule)
const stage=(status,extra={})=>stageAttendanceCell(draft,{centerId:input.centerId,studentId:input.studentId,
  cell:cell('saturday'),records:input.attendanceRecords,status,canWrite:true,now:input.now,...extra})
const render=detailState=>renderCanonicalAttendanceLedgerModule({students:input.students,classSessions:input.classSessions,
  filters:input.filters,draft,detailState,availability:{canWrite:true,attendanceAvailable:true,tuitionAvailable:true,
    packageCycleReady:true,packageCycleStudentStates:input.packageCycleStudentStates,attendanceRecords:input.attendanceRecords,
    ledgerContext:{status:'ready',occurrences:input.occurrences,makeupBookings:input.makeupBookings},now:input.now}})
const detail={studentId:input.studentId,scheduleSessionId:'saturday',dateKey:'2026-10-03'}
assert.equal(cell('saturday').state,'notExpected');assert.equal(cell('saturday').mark,'—')
assert(cell('saturday').offRoster && canEditAttendanceCell(cell('saturday'),{canWrite:true,now:input.now}))
assert(!stage('absent'));assert(!stage('unmarked'));assert(!stage('makeup',{makeupTarget:'fabricated'}))
assert.equal(attendanceDraftCount(draft),0);assert.equal(draft.error,'','Cell candidate errors stay local to the popover')
const editor=render(detail).match(/<section class="attendance-ledger-editor"[\s\S]*?<\/section>/)[0]
assert.deepEqual([...editor.matchAll(/data-attendance-edit-status="([^"]+)"/g)].map(m=>m[1]),['present','makeup'])
assert(!editor.includes('data-attendance-makeup-source'))
assert(stage('present'));assert.equal(buildAttendanceDraftChanges(draft)[0].action,'SET')
assert.match(render(detail),/data-attendance-revert-draft/)
assert(stage(null));assert.equal(attendanceDraftCount(draft),0,'Unsaved cancellation sends no UNMARK')
assert(stage('present'))
const sent=[]
let lost=true
const supabase={rpc:async(name,args)=>{
  sent.push({name,args});if(lost){lost=false;throw Error('lost response')}
  return {data:{ok:true,outcome_code:'COMMITTED',audit_batch_id:'audit',change_count:1,results:[{}],replayed:true}}
}}
assert(!(await saveAttendanceBoardDraft(draft,{supabase,centerId:input.centerId,canWrite:true})).ok)
assert(draft.uncertain);assert(!stage('absent'))
assert((await saveAttendanceBoardDraft(draft,{supabase,centerId:input.centerId,canWrite:true})).ok)
assert(sent.every(call=>call.name==='v2_9_mutate_attendance_batch'))
assert.deepEqual(sent[0],sent[1],'Unknown-result retry retains exact approved intent/idempotency key')
assert.deepEqual(sent[0].args.p_command.changes[0].expectedRecords,[])
assert.equal(sent[0].args.p_command.changes[0].occurrenceDate,'2026-10-03')
input.attendanceRecords.push(f1Record('saturday','2026-10-03',input.studentId,'present'))
assert.equal(cell('saturday').mark,'✓','Actual PRESENT wins after authoritative reload without a booking')
assert(!stage(null));assert(!stage('absent'));assert(!render(detail).includes('data-attendance-revert-draft'))
const future=row(model()).cells.filter(c=>c.occurrence.date>'2026-10-08')
assert(future.every(c=>c.state==='future'&&c.mark===''&&!canEditAttendanceCell(c,{canWrite:true,now:input.now})))
const advanced=buildCanonicalAttendanceLedger({...input,now:new Date('2026-10-12T07:00:00Z')})
assert(row(advanced).cells.filter(c=>c.occurrence.date>='2026-10-10').every(c=>c.mark==='—'))
const specificBefore=buildCanonicalAttendanceLedger({...original,filters:{month:'2026-10',classSessionId:'weekend'}})
const specificAfter=buildCanonicalAttendanceLedger({...input,filters:{month:'2026-10',classSessionId:'weekend'}})
assert.deepEqual(specificAfter.rows.map(r=>r.student.id),specificBefore.rows.map(r=>r.student.id))
assert(!specificAfter.rows.some(r=>r.student.id===input.studentId),'Specific-Ca population is not broadened')
const source=input.attendanceRecords[0]
input.makeupBookings.push({id:'booking',center_id:input.centerId,student_local_id:input.studentId,
  source_attendance_local_id:source.authorityLocalId,source_date:source.date,source_class_local_id:'evening',
  destination_class_local_id:'weekend',destination_schedule_local_id:'sunday',destination_date:'2026-10-04',state:'PLANNED',version:1})
const makeupCell=cell('sunday')
assert(makeupCell.offRoster);assert.equal(makeupCell.mark,'—')
assert(stage('makeup',{cell:makeupCell,makeupTarget:source.authorityLocalId}))
assert.equal(buildAttendanceDraftChanges(draft)[0].makeupForAttendanceLocalId,source.authorityLocalId)
const regular=cell('wednesday')
for(const status of ['present','absent',null])assert(stage(status,{cell:regular}))
assert(stage('makeup',{cell:regular,makeupTarget:source.authorityLocalId}))
for(const key of ['students','classSessions','scheduleSessions','occurrences','enrollmentSets'])assert.deepEqual(input[key],original[key])
const html=render()
assert(!html.includes('<h3>Bảng điểm danh</h3>'));assert(!html.includes('Giáo viên chính:'))
assert(!html.includes('Gói/Buổi'));assert(html.includes('Số buổi còn lại'))
assert([...html.matchAll(/data-attendance-occurrence-detail[\s\S]*?<strong>([^<]+)<\/strong>/g)].every(m=>/^\d{2}$/.test(m[1])))
const migration=readFileSync('supabase/migrations/202610080001_f1_off_roster_present_admission.sql','utf8')
assert.equal((migration.match(/execute v_(?:writer|guard);/g)||[]).length,2)
assert(!/create\s+(?:table|function)|grant|revoke|insert\s+into|update\s+public/i.test(migration))
console.log('F1_OFF_ROSTER_ATTENDANCE_SMOKE: PASS')
