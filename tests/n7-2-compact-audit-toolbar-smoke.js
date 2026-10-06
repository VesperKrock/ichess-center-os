import assert from 'node:assert/strict'
import {buildOwnerAuditGroups,filterOwnerAuditGroups,ownerAuditActorOptions,renderOwnerAttendanceAudit} from '../src/owner-attendance-audit.js'

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const centerId='n7-2-fixture',owner=uuid(1),admin=uuid(2)
const event=(id,actor=owner,role='owner')=>({id,center_id:centerId,domain:'ATTENDANCE',actor_user_id:actor,actor_role:role,
 audit_batch_id:uuid(100+id),batch_ordinal:1,student_local_id:'student',schedule_session_local_id:'session',occurrence_date:'2026-10-01',
 created_at:'2026-10-06T05:00:00Z',before_state:{attendanceStatus:'present'},after_state:{attendanceStatus:'absent'},
 absence_reason_before:null,absence_reason_after:'Nghỉ bệnh'})
const projection={centerId,profile:{id:owner,email:'owner@example.test'},students:[{id:'student',centerId,fullName:'Gia Hân'}]}
const options=(events,context=projection)=>ownerAuditActorOptions(buildOwnerAuditGroups(events,context),events,context)
assert.deepEqual(options([event(1)]),[{id:owner,label:'Owner'}],'A sole trusted Owner uses a friendly selector label')
assert.deepEqual(options([event(1),event(2,admin,'center_admin')]),[{id:admin,label:'Admin'},{id:owner,label:'Owner'}])
const names={...projection,teachers:[{centerId,accountUserId:owner,fullName:'Phạm Đức Thắng'},{centerId,accountUserId:admin,fullName:'Trần Bình'}]}
assert.deepEqual(new Set(options([event(1),event(2,admin,'owner')],names).map(actor=>actor.label)),new Set(['Owner · Phạm Đức Thắng','Owner · Trần Bình']))
const unknown={centerId},twoOwners=[event(1),event(2,admin,'owner')]
const unnamed=options(twoOwners,unknown)
assert.equal(new Set(unnamed.map(actor=>actor.label)).size,2,'Distinct actors without names stay distinguishable')
assert.deepEqual(new Map(options([...twoOwners].reverse(),unknown).map(actor=>[actor.id,actor.label])),new Map(unnamed.map(actor=>[actor.id,actor.label])),'Fallback labels do not change with event order')
assert(unnamed.every(actor=>!actor.label.includes(actor.id)))
const duplicateNames={...names,teachers:names.teachers.map(person=>({...person,fullName:'Cùng tên'}))}
assert.equal(new Set(options(twoOwners,duplicateNames).map(actor=>actor.label)).size,2)
assert.throws(()=>options([event(1)],{...projection,centerId:'foreign'}),/context mismatch/)

for(const [scope,label,type,value] of [['day','06/10/2026','date','2026-10-06'],['month','Tháng 10/2026','month','2026-10'],['year','2026','number','2026']]){
 const events=[event(1)],state={events,filters:{scope,date:'2026-10-06',actorId:owner,query:''},expanded:[],loading:false,error:'',hasMore:false}
 const html=renderOwnerAttendanceAudit(state,projection,true)
 assert(!html.includes('<h4>Nhật ký thay đổi</h4>'))
 assert(html.includes('<p>Bảng điểm danh</p>'))
 assert(html.includes(`<span>${label}</span>`))
 assert(html.includes(`type="${type}" value="${value}"`),'Functional native picker preserved')
 const scopeName={day:'Ngày',month:'Tháng',year:'Năm'}[scope]
 assert(html.includes(`‹ ${scopeName} trước`)&&html.includes(`${scopeName} sau ›`))
 const order=['owner-audit-toolbar','owner-audit-scopes','owner-audit-navigation','owner-audit-actor-filter','owner-audit-search','data-owner-audit-refresh','owner-audit-export','owner-audit-list']
 const positions=order.map(marker=>html.indexOf(marker))
 assert(positions.every((position,index)=>position>=0&&(index===0||position>positions[index-1])))
 assert(html.includes(`<option value="${owner}" selected>Owner</option>`))
 assert(html.includes('class="owner-audit-actor">owner@example.test</span>'),'Immutable history actor projection is preserved')
 assert(!/data-.*(?:restore|undo|delete|edit)/.test(html))
 assert.equal(filterOwnerAuditGroups(buildOwnerAuditGroups(twoOwners,names),{actorId:owner}).length,1)
 assert.equal(renderOwnerAttendanceAudit(state,projection,false),'')
}
console.log('N7_2_COMPACT_AUDIT_TOOLBAR_SMOKE PASS')
