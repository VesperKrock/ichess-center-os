import assert from 'node:assert/strict'
import fs from 'node:fs'
import {PDFDocument} from 'pdf-lib'
import {auditBusinessDate,defaultOwnerAuditPeriod,getOwnerAuditRange,shiftOwnerAuditPeriod,buildOwnerAuditGroups,filterOwnerAuditGroups,renderOwnerAttendanceAudit} from '../src/owner-attendance-audit.js'
import {loadOwnerAttendanceAuditBatches,createOwnerAuditCursor} from '../src/cloud-owner-attendance-audit.js'
import {createOwnerAttendanceAuditController} from '../src/owner-attendance-audit-controller.js'
import {generateOwnerAuditPdf} from '../src/owner-attendance-audit-pdf.js'

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const centerId='n7-1-fixture',actor=uuid(1),now=new Date('2026-10-06T01:00:00Z')
const event=(id,time,options={})=>({id,center_id:centerId,domain:'ATTENDANCE',batch_action:'SAVE_ATTENDANCE',entity_type:'attendance_record',
 actor_user_id:actor,actor_role:'owner',audit_batch_id:uuid(id+10),batch_ordinal:1,student_local_id:'student',schedule_session_local_id:'session',
 occurrence_date:'2026-10-01',created_at:time,before_state:{attendanceStatus:'present'},after_state:{attendanceStatus:'absent'},
 absence_reason_before:null,absence_reason_after:'Nghỉ bệnh',...options})
const dates=[
 event(1,'2025-12-31T16:59:59.999Z'),event(2,'2025-12-31T17:00:00Z'),
 event(3,'2026-09-30T16:59:59.999Z'),event(4,'2026-09-30T17:00:00Z'),
 event(5,'2026-10-05T16:59:59.999Z'),event(6,'2026-10-05T17:00:00Z'),
 event(7,'2026-10-06T16:59:59.999Z'),event(8,'2026-10-06T17:00:00Z'),
 event(9,'2026-10-31T16:59:59.999Z'),event(10,'2026-10-31T17:00:00Z'),
 event(11,'2026-12-31T16:59:59.999Z'),event(12,'2026-12-31T17:00:00Z'),
].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id)
const fake=(events,calls=[])=>({rpc:async(name,args)=>{
 assert.equal(name,'v2_9_list_attendance_audit_events');calls.push(args)
 assert(args.p_offset<=1000000&&args.p_limit<=200)
 const rows=events.filter(e=>Number(auditBusinessDate(e.created_at).slice(0,4))===args.p_year&&(!args.p_audit_batch_id||e.audit_batch_id===args.p_audit_batch_id)).slice(args.p_offset,args.p_offset+args.p_limit)
 return {data:{ok:true,center_id:centerId,year:args.p_year,offset:args.p_offset,limit:args.p_limit,events:rows}}
},auth:{getUser:async()=>({data:{user:{id:actor,email:'owner@example.test'}}})}})
const all=async(supabase,period)=>{
 let cursor=createOwnerAuditCursor(),events=[],iterations=0
 while(true){assert(iterations++<100);const result=await loadOwnerAttendanceAuditBatches({supabase,centerId,period,cursor});events.push(...result.events);cursor=result.cursor;if(!result.hasMore)return events}
}
assert.deepEqual(defaultOwnerAuditPeriod(now),{scope:'month',date:'2026-10-06'})
assert.equal(shiftOwnerAuditPeriod({scope:'month',date:'2026-01-31'},-1).date,'2025-12-01')
assert.equal(shiftOwnerAuditPeriod({scope:'day',date:'2026-03-01'},-1).date,'2026-02-28')
assert.equal(shiftOwnerAuditPeriod({scope:'day',date:'2024-03-01'},-1).date,'2024-02-29')
for(const [scope,expected] of [['day',[6,7]],['month',[4,5,6,7,8,9]],['year',[2,3,4,5,6,7,8,9,10,11]]]){
 const period={scope,date:'2026-10-06'},rows=await all(fake(dates),period),range=getOwnerAuditRange(period)
 assert.deepEqual(rows.map(e=>e.id).sort((a,b)=>a-b),expected,`${scope} excludes adjacent periods at Vietnam midnight`)
 assert(rows.every(e=>Date.parse(e.created_at)>=range.start&&Date.parse(e.created_at)<range.end))
}
// A virtually large year proves old-period navigation never downloads the
// prefix. All newer events share Student/session keys, so those filters cannot
// bypass the chronology. Only one-row probes may touch the prefix.
for(const prefix of [101,10000,900000]){
 const target=event(1,'2026-01-01T05:00:00Z'),calls=[]
 const virtual={rpc:async(name,args)=>{
  calls.push(args)
  const rows=args.p_year!==2026?[]:args.p_audit_batch_id?[target].filter(e=>e.audit_batch_id===args.p_audit_batch_id).slice(args.p_offset,args.p_offset+args.p_limit)
   :Array.from({length:Math.min(args.p_limit,Math.max(0,prefix+1-args.p_offset))},(_,i)=>args.p_offset+i===prefix?target:event(2+args.p_offset+i,'2026-12-01T05:00:00Z'))
  return {data:{ok:true,center_id:centerId,year:args.p_year,limit:args.p_limit,offset:args.p_offset,events:rows}}
 }}
 const rows=await all(virtual,{scope:'day',date:'2026-01-01'})
 assert.equal(rows.length,1)
 assert(calls.length<=38,`bounded probe count: ${calls.length}`)
 assert(calls.filter(c=>!c.p_audit_batch_id&&c.p_offset<prefix).every(c=>c.p_limit<=2),'No client prefix scan')
}
const unreachable={rpc:async(name,args)=>({data:{ok:true,center_id:centerId,year:2026,limit:args.p_limit,offset:args.p_offset,
 events:[event(args.p_offset+1,'2026-12-01T05:00:00Z')]}})}
await assert.rejects(all(unreachable,{scope:'day',date:'2026-01-01'}),error=>error.code==='AUDIT_READ_LIMIT')
// Split raw pages still yield one complete 250-cell save.
const batch=uuid(500),split=Array.from({length:250},(_,i)=>event(1000+i,'2026-10-06T05:00:00Z',{
 audit_batch_id:batch,batch_ordinal:i+1,student_local_id:`student-${i}`,
})).reverse()
const splitRows=await all(fake(split),{scope:'month',date:'2026-10-06'})
assert.equal(splitRows.length,250)
assert.equal(buildOwnerAuditGroups(splitRows,{centerId})[0].cells.length,250)
const projection={centerId,profile:{id:actor,user_metadata:{full_name:'Phạm Đức Thắng'}},students:[{centerId,id:'student',fullName:'Gia Hân'}]}
const yearRows=await all(fake(dates),{scope:'year',date:'2026-10-06'}),groups=buildOwnerAuditGroups(yearRows,projection)
let state={events:yearRows,filters:{scope:'year',date:'2026-10-06',actorId:'all',query:''},expanded:[],loading:false,error:'',hasMore:false}
const html=renderOwnerAttendanceAudit(state,projection,true)
assert.equal((html.match(/class="owner-audit-month"/g)||[]).length,5)
assert.equal((html.match(/class="owner-audit-day"/g)||[]).length,9)
assert(!html.includes('30 ngày gần đây'))
assert(!/data-.*(?:restore|undo|delete|rollback|excel)/.test(html))
assert.equal(filterOwnerAuditGroups(groups,{query:'gia han'}).length,groups.length)
assert.equal(filterOwnerAuditGroups(groups,{actorId:uuid(9)}).length,0)
assert.equal(renderOwnerAttendanceAudit(state,projection,false),'')
const pagingDates=[...dates,event(13,'2026-10-06T05:00:00Z'),event(14,'2026-10-06T06:00:00Z')].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id)
const firstYear=await loadOwnerAttendanceAuditBatches({supabase:fake(pagingDates),centerId,period:{scope:'year',date:'2026-10-06'}})
assert(firstYear.hasMore)
const secondYear=await loadOwnerAttendanceAuditBatches({supabase:fake(pagingDates),centerId,period:{scope:'year',date:'2026-10-06'},cursor:firstYear.cursor})
const appended=renderOwnerAttendanceAudit({...state,events:[...firstYear.events,...secondYear.events]},projection,true)
assert.equal((appended.match(/class="owner-audit-month"/g)||[]).length,5,'Appending raw pages preserves unique month/day headings')
assert.equal((appended.match(/class="owner-audit-day"/g)||[]).length,9)

const pdfOptions={includeLayoutProof:true,fetchImpl:async url=>new Response(fs.readFileSync(`public/forms/tuition-receipt/fonts/${url.split('/').at(-1)}`))}
for(const scope of ['day','month','year']){
 const period={scope,date:'2026-10-06'},events=await all(fake(dates),period),selected=buildOwnerAuditGroups(events,projection)
 const pdf=await generateOwnerAuditPdf({groups:selected,period,centerName:'Phòng Trống'},pdfOptions)
 const parsed=await PDFDocument.load(pdf.bytes)
 assert.equal(pdf.batchCount,selected.length);assert.equal(parsed.getPageCount(),pdf.pageCount)
 assert(pdf.layoutProof.some(t=>t.value.includes('Có mặt → Vắng')))
 assert(pdf.layoutProof.some(t=>t.value.includes('Lý do: — → Nghỉ bệnh')))
 assert(!pdf.layoutProof.some(t=>/00000000-|audit_batch|student_local|attendance_record/.test(t.value)))
 assert(pdf.layoutProof.every(t=>t.x+t.width<=595.28-36+.1&&t.top+t.size<=841.89-44+.1))
}
const empty=await generateOwnerAuditPdf({groups:[],period:{scope:'day',date:'2026-10-04'},centerName:'Phòng Trống'},pdfOptions)
assert.equal(empty.pageCount,1);assert(empty.layoutProof.some(t=>t.value==='Chưa có thay đổi nào được ghi nhận.'))
const largePdf=await generateOwnerAuditPdf({groups:buildOwnerAuditGroups(splitRows,projection),period:{scope:'month',date:'2026-10-06'},centerName:'Phòng Trống'},pdfOptions)
assert(largePdf.pageCount>1)
assert.equal(largePdf.layoutProof.filter(t=>t.value==='Có mặt → Vắng').length,250,'Large batches retain every detail across PDF pages')
assert(largePdf.layoutProof.some(t=>t.value.endsWith(' · tiếp')),'Split batches repeat actor and timestamp on the next page')
// Year export must fetch every lazy page, even if the UI has only ten rows.
const many=Array.from({length:45},(_,i)=>event(5000+i,'2026-10-06T05:00:00Z')).reverse()
let context={ok:true,centerId,accountId:actor,membershipStatus:'active',role:'owner'},reads=[]
const controller=createOwnerAttendanceAuditController({getContext:()=>context,getSupabase:()=>fake(many,reads)})
assert((await controller.load()).ok);assert.equal(buildOwnerAuditGroups(controller.getState().events,{centerId}).length,10)
const complete=await controller.exportPdf({projection,centerName:'Phòng Trống',pdfOptions})
assert(complete.ok);assert.equal(complete.batchCount,45);assert(complete.pageCount>1)
context={...context,role:'center_admin'};const before=reads.length
assert.equal((await controller.exportPdf({projection,centerName:'Phòng Trống',pdfOptions})).ok,false)
assert.equal(reads.length,before);assert.equal(controller.getState().events.length,0)
context={...context,role:'owner'}
let release
const pending=createOwnerAttendanceAuditController({getContext:()=>context,getSupabase:()=>({rpc:()=>new Promise(resolve=>{release=resolve})})})
const exportPromise=pending.exportPdf({projection,centerName:'Phòng Trống',pdfOptions})
context={...context,centerId:'changed'}
release({data:{ok:true,center_id:centerId,year:2026,limit:1,offset:0,events:[]}})
assert.equal((await exportPromise).ok,false,'Center switch cancels PDF before any download')
console.log('N7_1_PERIOD_AUDIT_PDF_SMOKE PASS')
