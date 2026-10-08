import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createReportChecklistController} from '../src/report-checklist-controller.js'
import {DAILY_CHECKLIST_TEMPLATES,createDailyChecklistState,renderReportWorkspace,shiftChecklistDate,getChecklistToday} from '../src/report-daily-checklist.js'
import {renderReportModule,buildReportData,initialReportDraft} from '../src/report-module.js'
import {createReportPdfProjection} from '../src/report-pdf.js'

const centerId='f3-center-a',businessDate='2026-10-07',templateKey='tvv-parttime-v1'
let context={centerId,accountId:'admin-a',businessDate},failRead=false,failWrite=false
const rows=new Map(),calls=[]
const rpc=async(name,args)=>{
 calls.push({name,args})
 const result={ok:true,center_id:args.p_center_id,business_date:args.p_business_date,template_key:args.p_template_key}
 if(name==='n6_1_list_daily_checklist')return failRead?{error:{message:'unavailable'}}:{data:{...result,
  items:[...rows.values()].filter(r=>r.center_id===args.p_center_id&&r.business_date===args.p_business_date&&r.template_key===args.p_template_key)}}
 assert.equal(name,'n6_1_set_daily_checklist_item','Only existing N6.1 writer is used')
 if(failWrite)return{error:{message:'denied'}}
 const key=[args.p_center_id,args.p_business_date,args.p_template_key,args.p_item_key].join('|')
 const item={center_id:args.p_center_id,business_date:args.p_business_date,template_key:args.p_template_key,item_key:args.p_item_key,
  completed:args.p_completed,completed_by:args.p_completed?'server-actor':null,completed_by_name:args.p_completed?'Admin QA':null,
  completed_at:args.p_completed?'2026-10-08T06:00:00Z':null,updated_by:'server-actor',updated_at:'2026-10-08T06:00:00Z'}
 rows.set(key,item);return{data:{...result,item}}
}
const options={getContext:()=>context,getSupabase:()=>({rpc}),canWrite:()=>true}
const controller=createReportChecklistController(options)
const filters={reportDate:businessDate,weekStartDate:'2026-10-05'}
const legacy={...initialReportDraft,dailyTasks:'Lịch sử việc ngày',operationNote:'Giữ ghi chú',ownerName:'Người phụ trách cũ',
 otherPendingTasks:'Việc khác đã ghi',pendingTasks:{diemDanh:true,tbhp:false,nhacThuHp:true,unknownHistory:true}}
const legacyBefore=structuredClone(legacy)
const html=()=>renderReportModule({filters:{...filters,reportDate:context.businessDate},centerInfo:{ok:true,centerId:context.centerId},
 draft:legacy,checklistState:controller.getState(),checklistCanWrite:true})

assert.equal(controller.getState().businessDate,businessDate,'Historical Report date controls initial read')
await controller.load()
assert.deepEqual(calls.at(-1).args,{p_center_id:centerId,p_business_date:businessDate,p_template_key:templateKey})
assert.equal((html().match(/data-checklist-item=/g)||[]).length,5)
assert(!/data-report-pending-task|data-report-draft-field="(?:ownerName|otherPendingTasks)"|data-checklist-date-picker|data-checklist-day-step|data-checklist-today/.test(html()))
const workspace=renderReportWorkspace({body:html()})
assert(!/report-workspace-tabs|data-report-workspace-mode|>Tổng quan<|>Checklist<\/button/.test(workspace))
assert.deepEqual(legacy,legacyBefore,'Rendering cannot clear retired legacy fields')
for(const template of DAILY_CHECKLIST_TEMPLATES){
 await controller.select({templateKey:template.key})
 const rendered=html()
 assert.equal((rendered.match(/data-checklist-item=/g)||[]).length,template.items.length)
 for(const task of template.items)assert(rendered.includes(`data-checklist-row="${task.key}"`))
 assert(rendered.includes(template.label),'Canonical registry supplies all current template choices')
 const field=rendered.match(/<select[^>]+data-checklist-template-picker[^>]*>/)[0]
 assert(!field.includes('disabled'),'Same Admin freely selects every template')
 assert((await controller.setCompleted(template.items[0].key,true)).ok)
 assert.equal(controller.getState().items[0].completed_by,'server-actor','Actor attribution comes from server')
 assert(!Object.keys(calls.at(-1).args).some(k=>/actor|role|owner|name|note|pending/i.test(k)))
 assert.deepEqual(legacy,legacyBefore,'Canonical completion does not write Report notes/legacy fields')
}
await controller.select({templateKey})
assert(html().includes('1/5 hoàn thành'))
controller.expand('pt-01');assert(html().includes('Hoàn thành bởi: Admin QA'))
const reload=createReportChecklistController(options);await reload.load()
assert.equal(reload.getState().items[0].completed,true,'Reopened Report reads same authoritative state')

context={...context,businessDate:'2026-10-06'}
assert.equal(controller.getState().status,'idle');assert.equal(controller.getState().items.length,0)
assert(html().includes('Đang tải…')&&!html().includes('1/5 hoàn thành'),'Never show stale count while date changes')
await controller.load();assert.equal(controller.getState().items.length,0)
context={...context,businessDate};await controller.load();assert.equal(controller.getState().items[0].completed,true)
await controller.select({templateKey:'tvv-fulltime-v1'})
context={...context,businessDate:'2026-10-06'}
assert.equal(controller.getState().templateKey,'tvv-fulltime-v1','Date change preserves chosen operational template')
await controller.load();assert.equal(controller.getState().items.length,0)
context={...context,centerId:'f3-center-b'}
assert.equal(controller.getState().items.length,0);await controller.load();assert.equal(controller.getState().items.length,0)
context={centerId,accountId:'admin-b',businessDate};await controller.load()
assert.equal(controller.getState().items[0].completed,true,'Shared completion is not account-bound')

failRead=true;await controller.load()
assert.equal(controller.getState().status,'failed')
assert(html().includes('Chưa tải được checklist')&&!html().includes('Đang tải…')&&!html().includes('0/0'))
failRead=false;await controller.load();failWrite=true
assert.equal((await controller.setCompleted('pt-02',true)).ok,false)
assert(!controller.getState().items.some(r=>r.item_key==='pt-02'&&r.completed))
assert(html().includes('Chưa xác nhận được thay đổi'))
failWrite=false
context={...context,businessDate:shiftChecklistDate(getChecklistToday(),1)}
await controller.load();const beforeFuture=calls.length
assert.equal((await controller.setCompleted('pt-02',true)).ok,false)
assert.equal(calls.length,beforeFuture);assert.equal((html().match(/data-checklist-item="[^"]+"[^>]+disabled/g)||[]).length,5)

// A delayed old-day read must never replace the current Report date projection.
let release
context={centerId,accountId:'admin-a',businessDate}
const delayed=createReportChecklistController({...options,getSupabase:()=>({rpc:()=>new Promise(r=>{release=r})})})
const pending=delayed.load()
context={...context,businessDate:'2026-10-06'};delayed.getState()
release({data:{ok:true,center_id:centerId,business_date:businessDate,template_key:templateKey,items:[]}})
await pending;assert.equal(delayed.getState().businessDate,'2026-10-06');assert.equal(delayed.getState().status,'idle')
const mismatch=renderReportModule({filters,centerInfo:{centerId},checklistState:{...createDailyChecklistState('foreign'),status:'ready'}})
assert(mismatch.includes(`data-checklist-date="${businessDate}"`)&&mismatch.includes('Đang tải…'),'Renderer rejects foreign/date-mismatched state')

const main=fs.readFileSync('src/main.js','utf8')
const binding=main.slice(main.indexOf("  document.querySelectorAll('[data-report-draft-field]')"),main.indexOf("  document.querySelectorAll('[data-finance-workspace-view]')",main.indexOf("  document.querySelectorAll('[data-report-draft-field]')")))
const handlers=new Map()
const runtime={reportState:{draft:structuredClone(legacyBefore)},document:{querySelectorAll:()=>[
 {dataset:{reportDraftField:'dailyTasks'},value:'Ghi chú mới',addEventListener:(event,fn)=>handlers.set(event,fn)}]}}
vm.createContext(runtime);vm.runInContext(binding,runtime);handlers.get('input')()
assert.equal(runtime.reportState.draft.dailyTasks,'Ghi chú mới')
for(const key of ['pendingTasks','ownerName','otherPendingTasks'])assert.deepEqual(runtime.reportState.draft[key],legacyBefore[key],'Unrelated note edits preserve '+key)
assert(!/rpc\(|save|supabase|setCompleted/.test(binding),'Report notes remain memory-only; no new Save workflow')
const countBeforeNote=calls.length
const data=buildReportData({filters}),exported=createReportPdfProjection({viewMode:'day',data,draft:runtime.reportState.draft})
assert.deepEqual(exported.draft.pendingTasks,legacyBefore.pendingTasks)
assert.equal(exported.draft.ownerName,legacyBefore.ownerName);assert.equal(exported.draft.otherPendingTasks,legacyBefore.otherPendingTasks)
assert.equal(calls.length,countBeforeNote,'Report export/notes cannot invoke checklist writes')
const weekly=renderReportModule({viewMode:'week',filters,checklistState:controller.getState(),draft:legacy})
assert(!/data-checklist-item|data-checklist-template-picker|data-report-pending-task/.test(weekly))
assert(weekly.includes('Thu / Chi theo tuần')&&weekly.includes('Có mặt / Vắng / Học bù')&&weekly.includes('data-report-week-action="previous"'))
assert.deepEqual(buildReportData({filters,checklistState:{items:[{completed:true}]}}),data,'Checklist does not affect charts/finance/attendance totals')
assert(!/reportWorkspaceMode|data-report-workspace-mode|data-report-pending-task|data-checklist-date-picker/.test(main))
const dateHandler=main.slice(main.indexOf('function applyReportPeriodControl('),main.indexOf('async function exportReportPdf('))
assert(dateHandler.includes("if (key === 'reportDate') void getReportChecklistController().load()"))
assert(main.includes('businessDate: reportState.filters.reportDate'))
const adapter=fs.readFileSync('src/cloud-daily-checklist.js','utf8')
assert.deepEqual([...adapter.matchAll(/\.rpc\('([^']+)'/g)].map(m=>m[1]),['n6_1_list_daily_checklist','n6_1_set_daily_checklist_item'])
console.log('F3_REPORT_CHECKLIST_UNIFICATION_SMOKE PASS: registry, navigation, date/center/actor isolation, reload, failures, legacy safety, note/export isolation, weekly')
