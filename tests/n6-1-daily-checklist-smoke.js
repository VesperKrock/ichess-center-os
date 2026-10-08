import assert from 'node:assert/strict'
import fs from 'node:fs'
import {DAILY_CHECKLIST_TEMPLATES,createDailyChecklistState,renderDailyChecklist,renderReportWorkspace,
  getChecklistToday,shiftChecklistDate} from '../src/report-daily-checklist.js'
import {pullDailyChecklist,setDailyChecklistItem} from '../src/cloud-daily-checklist.js'
import {createReportChecklistController} from '../src/report-checklist-controller.js'
import {renderReportModule,buildReportData} from '../src/report-module.js'

const now=new Date('2026-10-06T01:00:00Z'),centerId='n61-fixture',businessDate=getChecklistToday(),templateKey='tvv-parttime-v1'
assert.equal(getChecklistToday(new Date('2026-10-05T17:01:00Z')),'2026-10-06')
assert.equal(shiftChecklistDate('2026-10-01',-1),'2026-09-30')
assert.deepEqual(DAILY_CHECKLIST_TEMPLATES.map(t=>t.items.length),[5,10])
assert.deepEqual(DAILY_CHECKLIST_TEMPLATES[0].items.map(i=>i.timeline),['16:00','16:00–16:30','16:30–18:00','18:00–19:30','19:30–20:00'])
assert.deepEqual(DAILY_CHECKLIST_TEMPLATES[1].items.map(i=>i.timeline),['13:30–14:00','14:00–14:30','14:30–15:00','15:00–15:30','15:45–16:00','16:00–17:30','18:00–18:30','18:30–19:00','19:15–20:15','20:30'])
for(const t of DAILY_CHECKLIST_TEMPLATES){
 const state={...createDailyChecklistState(centerId,now),templateKey:t.key,status:'ready'}
 const html=renderDailyChecklist(state,{canWrite:true,now})
 assert.equal((html.match(/type="checkbox"/g)||[]).length,t.items.length,'One checkbox per reference row, never per bullet')
 assert.equal((html.match(/class="checklist-row-detail"[^>]+hidden/g)||[]).length,t.items.length,'Details collapse at rest')
 assert(html.includes(`0/${t.items.length} hoàn thành`))
 assert(!/data-report-action|data-notification|overdue|alarm|supabase/.test(html))
}

const db=new Map(),calls=[]
const key=a=>`${a.p_center_id}|${a.p_business_date}|${a.p_template_key}|${a.p_item_key}`
const fake={rpc:async(name,args)=>{
 calls.push({name,args})
 const context={ok:true,center_id:args.p_center_id,business_date:args.p_business_date,template_key:args.p_template_key}
 if(name==='n6_1_list_daily_checklist')return{data:{...context,items:[...db.values()].filter(i=>i.center_id===args.p_center_id&&i.business_date===args.p_business_date&&i.template_key===args.p_template_key)}}
 assert.equal(name,'n6_1_set_daily_checklist_item')
 const item={center_id:args.p_center_id,business_date:args.p_business_date,template_key:args.p_template_key,item_key:args.p_item_key,
  completed:args.p_completed,completed_by:args.p_completed?'actor-server':null,completed_by_name:args.p_completed?'Cô An':null,
  completed_at:args.p_completed?now.toISOString():null,updated_by:'actor-server',updated_at:now.toISOString()}
 db.set(key(args),item);return{data:{...context,item}}
}}
let context={centerId,accountId:'actor-a'},changes=0
const options={getContext:()=>context,getSupabase:()=>fake,canWrite:()=>true,onChange:()=>changes++}
const controller=createReportChecklistController(options)
await controller.load();assert.equal(controller.getState().status,'ready')
assert((await controller.setCompleted('pt-01',true)).ok)
const completed=controller.getState().items[0]
assert.equal(completed.completed_by,'actor-server');assert.equal(completed.completed_at,now.toISOString())
assert(!Object.keys(calls.at(-1).args).some(k=>/actor|time|name/.test(k)),'Client cannot supply checked-by/time')
let html=renderDailyChecklist(controller.getState(),{canWrite:true})
assert(html.includes('1/5 hoàn thành')&&html.includes('checked'))
controller.expand('pt-01');html=renderDailyChecklist(controller.getState(),{canWrite:true})
assert(html.includes('Hoàn thành bởi: Cô An'));assert(html.includes('aria-expanded="true"'))
await controller.load();assert.equal(controller.getState().items[0].completed,true,'Refresh reads shared canonical state')
context={centerId,accountId:'actor-b'}
const other=createReportChecklistController(options);await other.load()
assert.equal(other.getState().items[0].completed_by,'actor-server','Another authorized operator sees the same completion')
await other.select({templateKey:'tvv-fulltime-v1'});assert.equal(other.getState().items.length,0)
await other.select({templateKey});await other.select({businessDate:shiftChecklistDate(businessDate,-1)})
assert.equal(other.getState().items.length,0,'Date state is independent')
await other.select({businessDate});assert((await other.setCompleted('pt-01',false)).ok)
await other.load();assert.equal(other.getState().items[0].completed,false)
assert.equal(other.getState().items[0].completed_by,null)
context={centerId:'another-fixture',accountId:'actor-b'};await other.load();assert.equal(other.getState().items.length,0)
context={centerId,accountId:'actor-b'};await other.select({businessDate:shiftChecklistDate(businessDate,1)})
const before=calls.length;assert.equal((await other.setCompleted('pt-01',true)).ok,false);assert.equal(calls.length,before,'Future dates never issue a write')
assert(renderDailyChecklist(other.getState(),{canWrite:true}).includes('type="checkbox" data-checklist-item="pt-01"') )
assert.equal((renderDailyChecklist(other.getState(),{canWrite:true}).match(/type="checkbox"[^>]+disabled/g)||[]).length,5)

const request={supabase:fake,centerId,businessDate,templateKey}
assert.equal((await setDailyChecklistItem({...request,itemKey:'ft-01',completed:true})).ok,false)
const foreign={...completed,center_id:'other'}
assert.equal((await pullDailyChecklist({...request,supabase:{rpc:async()=>({data:{ok:true,center_id:centerId,business_date:businessDate,template_key:templateKey,items:[foreign]}})}})).ok,false)
assert.equal((await pullDailyChecklist({...request,supabase:{rpc:async()=>({data:{ok:true,center_id:centerId,business_date:businessDate,template_key:templateKey,items:[{...completed,completed_at:'bad'}]}})}})).ok,false)
assert.equal((await setDailyChecklistItem({...request,itemKey:'pt-01',completed:true,supabase:{rpc:async()=>({error:{message:'denied'}})}})).ok,false)
const failedController=createReportChecklistController({...options,getSupabase:()=>({rpc:async(name,args)=>name==='n6_1_list_daily_checklist'?fake.rpc(name,args):{error:{message:'offline'}}})})
await failedController.load();assert.equal((await failedController.setCompleted('pt-02',true)).ok,false)
assert(!failedController.getState().items.some(i=>i.item_key==='pt-02'&&i.completed),'Failure cannot optimistically complete a row')
let release
const pendingController=createReportChecklistController({...options,getSupabase:()=>({rpc:()=>new Promise(resolve=>{release=resolve})})})
const pending=pendingController.load();context={centerId:'switched-fixture',accountId:'actor-b'}
release({data:{ok:true,center_id:centerId,business_date:businessDate,template_key:templateKey,items:[completed]}})
await pending;assert.equal(pendingController.getState().centerId,'switched-fixture');assert.equal(pendingController.getState().items.length,0,'Late replies cannot leak across centers')

const overview=renderReportModule({viewMode:'week',filters:{reportDate:'2026-10-06',weekStartDate:'2026-10-05'}})
const beforeData=buildReportData({filters:{reportDate:'2026-10-06',weekStartDate:'2026-10-05'}})
assert(renderReportWorkspace({mode:'overview',body:overview}).includes(overview),'Overview renderer is embedded unchanged')
assert.deepEqual(buildReportData({filters:beforeData.filters,checklistState:{completed:true}}),beforeData,'Completion never contributes to chart inputs')
const main=fs.readFileSync('src/main.js','utf8'),sql=fs.readFileSync('supabase/migrations/202610060002_n6_1_daily_checklist_state.sql','utf8')
const deferBody=main.split('function shouldDeferRenderForTextEditing() {')[1].split('\nfunction shouldAllowImmediateRenderForActiveElement')[0]
const defer=new Function('document','shouldDelayTextEditingRenderFlushForAction','isNativeSelectElement',
 'shouldAllowNativeSelectChangeRender','shouldAllowImmediateRenderForActiveElement','isTextEditingElement',deferBody.slice(0,deferBody.lastIndexOf('}')))
for(const attr of ['data-checklist-item','data-checklist-template-picker']){
 const activeElement={matches:selectors=>selectors.includes(`[${attr}]`)}
 assert.equal(defer({activeElement},()=>false,()=>attr==='data-checklist-template-picker',()=>false,()=>false,()=>true),false,
  'Focused checklist controls immediately render authoritative replies')
}
assert.equal(defer({activeElement:{matches:()=>false}},()=>false,()=>false,()=>false,()=>false,()=>true),true,
 'Other text editing retains its existing deferral')
assert(main.includes('reportChecklistController?.reset()'))
for(const file of ['src/notification-center.js','src/notification-operational-assistant.js'])assert(!fs.readFileSync(file,'utf8').includes('checklist'),'Zero Bell providers')
assert.equal((sql.match(/create table /g)||[]).length,1)
assert(sql.includes('enable row level security')&&sql.includes('force row level security'))
assert(sql.includes('revoke all on public.center_daily_checklist_state from public,anon,authenticated,service_role'))
assert(sql.includes('v_actor uuid:=auth.uid()')&&sql.includes('pg_catalog.clock_timestamp()'))
assert(sql.includes("m.center_id=p_center_id and m.user_id=auth.uid() and m.status='active' and c.status='active'"))
assert(sql.includes('where existing.completed is distinct from excluded.completed'),'Repeated desired-state requests preserve attribution/time')
assert(!/center_cloud_entities|finance_transaction|center_tuition|notification|trigger|cron/.test(sql))
assert(changes>0)
console.log('N6_1_DAILY_CHECKLIST_SMOKE PASS')
