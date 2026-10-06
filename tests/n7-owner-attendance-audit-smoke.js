import assert from 'node:assert/strict'
import fs from 'node:fs'
import {isOwnerAuditContext,getOwnerAuditRange,formatOwnerAuditTime,auditStatusLabel,buildOwnerAuditGroups,
 filterOwnerAuditGroups,renderOwnerAttendanceAudit} from '../src/owner-attendance-audit.js'
import {readOwnerAttendanceAuditPage,loadOwnerAttendanceAuditBatches,createOwnerAuditCursor} from '../src/cloud-owner-attendance-audit.js'
import {createOwnerAttendanceAuditController} from '../src/owner-attendance-audit-controller.js'
import {renderSettingsModule} from '../src/settings-module.js'

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const centerId='n7-fixture',actor=id(1),batch=id(2),now=new Date('2026-10-06T13:00:00Z')
const event=(n,options={})=>({id:n,center_id:centerId,domain:'ATTENDANCE',batch_action:'SAVE_ATTENDANCE',entity_type:'attendance_record',
 actor_user_id:actor,actor_role:'owner',audit_batch_id:batch,batch_ordinal:n,student_local_id:`student-${n}`,schedule_session_local_id:'session',
 occurrence_date:'2026-10-01',created_at:'2026-10-06T11:42:17.100Z',before_state:null,after_state:{attendanceStatus:'present'},
 absence_reason_before:null,absence_reason_after:null,...options})
let context={ok:true,centerId,accountId:actor,role:'owner',membershipStatus:'active'}
assert(isOwnerAuditContext(context))
for(const role of ['admin','qtv','center_admin','teacher','consultant','viewer',''])assert(!isOwnerAuditContext({...context,role}))
assert(!isOwnerAuditContext({...context,membershipStatus:'revoked'}));assert(!isOwnerAuditContext({...context,ok:false}))
const projection={centerId,students:[{centerId,id:'student-1',fullName:'Minh Anh'},{centerId,id:'student-2',fullName:'Gia Hân'}],
 profile:{id:actor,user_metadata:{full_name:'Phạm Đức Thắng'}},classSessions:[{centerId,id:'ca',name:'Ca Turtle'}],
 scheduleSessions:[{centerId,id:'session',classSessionId:'ca'}]}
const events=[event(1),event(2,{before_state:{attendanceStatus:'present'},after_state:{attendanceStatus:'absent',absenceReason:'Bệnh'},absence_reason_after:'Bệnh'}),
 event(3,{audit_batch_id:id(3),batch_ordinal:1,student_local_id:'student-2',before_state:{attendanceStatus:'absent'},after_state:{attendanceStatus:'present'},absence_reason_before:'Bệnh'})]
const groups=buildOwnerAuditGroups(events,projection)
assert.equal(groups.length,2,'Corrections remain separate saves')
assert.equal(groups.find(g=>g.id===batch).cells.length,2,'Status+reason still one cell')
assert.equal(groups[0].actor,'Phạm Đức Thắng');assert.equal(formatOwnerAuditTime(events[0].created_at),'18:42:17 · 06/10/2026')
assert.equal(auditStatusLabel({deleted:true,attendanceStatus:'absent'}),'Chưa điểm danh')
for(const [status,label] of [['present','Có mặt'],['absent','Vắng'],['makeup','Học bù'],['trial','Học thử'],['excusedAbsent','Vắng']])assert.equal(auditStatusLabel({attendanceStatus:status}),label)
assert.equal(filterOwnerAuditGroups(groups,{query:'gia han'}).length,2)
assert.equal(filterOwnerAuditGroups(groups,{query:'student-2'}).length,0,'Search does not match internal IDs')
assert.equal(filterOwnerAuditGroups(groups,{actorId:id(9)}).length,0)
assert.throws(()=>buildOwnerAuditGroups([event(1,{center_id:'foreign'})],projection),/context mismatch/)
const state={events,filters:{period:'30',actorId:'all',query:''},expanded:[],loading:false,error:'',hasMore:false}
let html=renderOwnerAttendanceAudit(state,projection,true)
assert.equal((html.match(/class="owner-audit-batch"/g)||[]).length,2)
assert.equal((html.match(/class="owner-audit-detail"[^>]*hidden/g)||[]).length,2)
html=renderOwnerAttendanceAudit({...state,expanded:[batch,id(3)]},projection,true)
assert(html.includes('Minh Anh · 01/10')&&html.includes('Chưa điểm danh → Có mặt')&&html.includes('Có mặt → Vắng')&&html.includes('Lý do: — → Bệnh'))
assert(html.includes('Lý do: Bệnh → —'))
assert(!/data-.*(?:restore|undo|delete|edit)|Khôi phục|Hoàn tác|Rollback|null|undefined/.test(html))
assert.equal(renderOwnerAttendanceAudit(state,projection,false),'')
assert(renderOwnerAttendanceAudit({...state,events:[]},projection,true).includes('Chưa có thay đổi nào được ghi nhận.'))
assert(!renderSettingsModule([],[],{},null,null,{activeTab:'audit-log',auditAccess:false,auditBody:'PRIVATE'}).includes('PRIVATE'))
assert(!renderSettingsModule([],[],{},null,null,{auditAccess:false}).includes('data-settings-tab="audit-log"'))
assert(renderSettingsModule([],[],{},null,null,{activeTab:'audit-log',auditAccess:true,auditBody:html}).includes('data-settings-tab="audit-log"'))
const escaped=renderOwnerAttendanceAudit(state,{...projection,profile:{id:actor,user_metadata:{full_name:'<script>unsafe</script>'}}},true)
assert(!escaped.includes('<script>unsafe'))
const split=Array.from({length:250},(_,index)=>event(index+1,{student_local_id:`large-${index}`,batch_ordinal:index+1}))
const calls=[]
const fake={rpc:async(name,args)=>{
 assert.equal(name,'v2_9_list_attendance_audit_events');calls.push(args)
 const rows=(args.p_audit_batch_id?split.filter(e=>e.audit_batch_id===args.p_audit_batch_id):split)
  .filter(e=>Number(e.created_at.slice(0,4))===args.p_year).slice(args.p_offset,args.p_offset+args.p_limit)
 return {data:{ok:true,center_id:args.p_center_id,year:args.p_year,limit:args.p_limit,offset:args.p_offset,events:rows}}
},auth:{getUser:async()=>({data:{user:projection.profile}})}}
const result=await loadOwnerAttendanceAuditBatches({supabase:fake,centerId,now})
assert.equal(result.events.length,250,'Event pages cannot undercount a batch')
assert.equal(buildOwnerAuditGroups(result.events,{centerId})[0].cells.length,250)
assert(calls.some(call=>call.p_audit_batch_id===batch&&call.p_offset===200))
assert.equal(result.hasMore,false)
const foreignFake={rpc:async(name,args)=>({data:{ok:true,center_id:centerId,year:2026,limit:100,offset:0,events:[event(1,{center_id:'foreign'})]}})}
await assert.rejects(readOwnerAttendanceAuditPage({supabase:foreignFake,centerId,year:2026}),/context mismatch/)
assert.deepEqual(getOwnerAuditRange('30',new Date('2027-01-03T13:00:00Z')).years,[2027,2026])
let changes=0
const controller=createOwnerAttendanceAuditController({getContext:()=>context,getSupabase:()=>fake,onChange:()=>changes++})
assert((await controller.load()).ok);assert.equal(controller.getState().events.length,250)
context={...context,role:'qtv'};const before=calls.length
assert.equal((await controller.load()).ok,false);assert.equal(calls.length,before);assert.equal(controller.getState().events.length,0)
context={...context,role:'owner'}
let release
const pending=createOwnerAttendanceAuditController({getContext:()=>context,getSupabase:()=>({rpc:()=>new Promise(resolve=>{release=resolve})})})
const promise=pending.load();context={...context,centerId:'switched'}
release({data:{ok:true,center_id:centerId,year:2026,limit:100,offset:0,events:[]}})
await promise;assert.equal(pending.getState().events.length,0,'Late replies cannot cross centers')
const failed=createOwnerAttendanceAuditController({getContext:()=>context,getSupabase:()=>({rpc:async()=>({error:{message:'denied'}})})})
assert.equal((await failed.load()).ok,false);assert.equal(failed.getState().events.length,0)
const main=fs.readFileSync('src/main.js','utf8'),client=fs.readFileSync('src/cloud-owner-attendance-audit.js','utf8')
assert(main.includes("button.dataset.settingsTab === 'audit-log' && !isOwnerAuditContext"))
assert(main.includes('ownerAttendanceAuditController?.reset()'))
assert(!/\.from\(|mutate|\.insert\(|\.update\(|\.delete\(/.test(client),'No table read or write path')
assert(!fs.readFileSync('src/modules.js','utf8').includes('Nhật ký thay đổi'),'No launcher tile')
assert(changes>0)
console.log('N7_OWNER_ATTENDANCE_AUDIT_SMOKE PASS')
