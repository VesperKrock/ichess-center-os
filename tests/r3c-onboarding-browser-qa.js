// Actual rendered form + validation + V2.2 adapter -> authenticated canonical
// SQL on pinned LOCAL Docker only. Every fixture is rolled back.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {r3cLocalQaSetup} from './r3c-initial-source-overage-local-db-qa.js'
const {chromium}=createRequire(path.join(os.tmpdir(),'ichess-r3b-recurring-browser/package.json'))('playwright')
const output='artifacts/R3C/Tan-Binh/20261017/evidence'
fs.mkdirSync(output,{recursive:true})
const db=spawn('docker',['exec','-i','supabase_db_ichess-center-os','psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres','-q','-A','-t'],{windowsHide:true})
let buffer='',stderr='',waiter,index=0
db.stdout.setEncoding('utf8');db.stderr.setEncoding('utf8')
db.stdout.on('data',chunk=>{
 buffer+=chunk
 if(waiter&&buffer.includes(waiter.marker+'\n')){
  const result=buffer.slice(0,buffer.indexOf(waiter.marker+'\n'))
  buffer=buffer.slice(buffer.indexOf(waiter.marker+'\n')+waiter.marker.length+1)
  const pending=waiter;waiter=null;clearTimeout(pending.timer);pending.resolve(result.trim())
 }
})
db.stderr.on('data',chunk=>{stderr+=chunk})
db.on('exit',code=>{if(waiter){clearTimeout(waiter.timer);waiter.reject(Error('Local psql exit '+code+': '+stderr.slice(-1800)));waiter=null}})
const query=sql=>new Promise((resolve,reject)=>{
 assert(!waiter,'Sequential local SQL bridge')
 const marker='R3C_BROWSER_END_'+ ++index
 const timer=setTimeout(()=>reject(Error('Local SQL timeout '+stderr.slice(-1800))),30000)
 waiter={marker,resolve,reject,timer};db.stdin.write(sql+"\nselect '"+marker+"';\n")
})
const jsonQuery=async sql=>JSON.parse((await query(sql)).split('\n').filter(x=>x.startsWith('{')).at(-1))
const q=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb"
const countsSql="select jsonb_build_object('cycles',(select count(*) from public.center_tuition_package_cycles where center_id='recurring_local_qa'),'finance',(select count(*) from public.finance_transaction where center_id='recurring_local_qa'),'receipts',(select count(*) from public.center_tuition_receipts where center_id='recurring_local_qa'),'attendance',(select count(*) from public.center_cloud_entities where center_id='recurring_local_qa' and entity_type='attendance_record'));"
const report={status:'RUNNING',at:new Date().toISOString(),productionCalls:0,writes:[],errors:[],cases:[]}
// Serve only the explicit module dependency closure and styles; never env/auth.
const allowed=new Set(['styles.css','student-theme.css','tuition-theme.css'])
function allowModule(name){
 if(allowed.has(name))return
 assert(/^[a-z0-9-]+\.js$/.test(name));allowed.add(name)
 for(const match of fs.readFileSync('src/'+name,'utf8').matchAll(/from\s+['"]\.\/([a-z0-9-]+\.js)['"]/g))allowModule(match[1])
}
for(const name of ['student-module.js','student-birth-information.js','cloud-authoritative-student-enrollments.js','tuition-module.js','cloud-authoritative-tuition-cycles.js'])allowModule(name)
const html=`<!doctype html><html lang="vi"><meta charset="utf-8"><link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/student-theme.css"><link rel="stylesheet" href="/src/tuition-theme.css"><style>body{display:block!important;overflow:auto!important;background:#eef2f6}.desktop-window{position:relative!important;inset:0!important;width:100vw!important;height:100vh!important;min-width:0!important}</style><body><main id="root" class="desktop-window is-student-window"></main><script type="module">
import {renderStudentModule,createEmptyStudentFormState,createEditStudentFormState,initialStudentFilters,mergeStudentFormControlValues,validateStudentForm,buildStudentFromForm} from '/src/student-module.js';
import {setStudentBirthYearOnly} from '/src/student-birth-information.js';
import {mutateV22StudentWithEnrollments} from '/src/cloud-authoritative-student-enrollments.js';
import {parseV24PackageCycleSnapshot} from '/src/cloud-authoritative-tuition-cycles.js';
import {renderTuitionModule} from '/src/tuition-module.js';
const root=document.querySelector('#root'),classes=[{id:'r3c-local-class',name:'LOCAL R3C class',daysOfWeek:['sat','sun'],startTime:'08:30',endTime:'10:00',status:'active'}];
let form=createEmptyStudentFormState({useAuthoritativeEnrollment:true}),saved=null,saveCount=0;
form.values={...form.values,recurringEnrollments:[{classSessionId:'r3c-local-class',weekdays:['sat','sun']}],classSessionIds:['r3c-local-class']};
const rpc=async(name,args)=>({data:await(await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json()});
function merge(){form.values=mergeStudentFormControlValues(form.values,root.querySelectorAll('[data-student-form-field]'))}
function render(){
 root.className='desktop-window is-student-form-window';
 root.innerHTML=renderStudentModule(saved?[saved]:[],initialStudentFilters,form,[],classes,{enrollmentCapabilityStatus:'ready'});
 root.querySelectorAll('[data-student-form-step]').forEach(button=>button.onclick=()=>{merge();form.step=Number(button.dataset.studentFormStep);render()});
 const yearOnly=root.querySelector('[data-student-birth-year-only]');if(yearOnly)yearOnly.onchange=()=>{merge();form.values=setStudentBirthYearOnly(form.values,yearOnly.checked);render()};
 root.querySelector('[data-student-action="save-form"]').onclick=async()=>{
  merge();form.errors=validateStudentForm(form.values,classes,{allowLegacyUnknownBirth:form.allowLegacyUnknownBirth===true});
  if(Object.keys(form.errors).length){render();return}
  form.isSaving=true;render();
  const student={...buildStudentFromForm(form.values,saved),id:'r3c-browser-no-guardian'};
  const r=await mutateV22StudentWithEnrollments({supabase:{rpc},centerId:'recurring_local_qa',student,enrollments:form.values.recurringEnrollments,expectedEnrollmentVersion:saved?.enrollmentVersion||0});
  if(!r.ok)throw Error(JSON.stringify(r));saved={...r.student,recurringEnrollments:r.enrollmentSet.enrollments,enrollmentVersion:r.enrollmentSet.version,useAuthoritativeEnrollment:true};saveCount++;form=createEditStudentFormState(saved);form.step=2;render();
 };
}
window.state=()=>({form,saved,saveCount});window.reopen=()=>{form=createEditStudentFormState(saved);render()};
window.openTuition=async()=>{const {data}=await rpc('read',{});const parsed=parseV24PackageCycleSnapshot(data,'recurring_local_qa');if(!parsed.ok)throw Error('Invalid canonical snapshot');root.className='desktop-window is-tuition-window';root.innerHTML=renderTuitionModule({students:[{id:'r3c-overage',fullName:'LOCAL source25/24'}],cycleStates:parsed.students,catalog:parsed.packageCatalog,readStatus:'ready',receiptStatus:'ready',receipts:[]},{filters:{query:'',status:'all',package:'all'},panel:{kind:'detail',studentId:'r3c-overage',busy:false}})};
render();window.fixtureReady=true;
</script></body></html>`
const server=createServer(async(request,response)=>{
 try{
  if(request.method==='GET'&&request.url==='/'){response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);return}
  const file=request.url?.replace('/src/','')
  if(request.method==='GET'&&allowed.has(file)){response.setHeader('Content-Type',file.endsWith('.css')?'text/css':'application/javascript');response.end(fs.readFileSync('src/'+file));return}
  if(request.method==='POST'&&request.url==='/rpc'){
   let raw='';for await(const chunk of request)raw+=chunk
   const {name,args}=JSON.parse(raw);let result
   if(name==='read')result=await jsonQuery("select public.v2_4_list_package_cycle_state('recurring_local_qa');")
   else{
    assert.equal(name,'v2_2_mutate_student_with_enrollments');assert.equal(args.p_center_id,'recurring_local_qa');assert.equal(args.p_student_local_id,'r3c-browser-no-guardian');assert.equal(args.p_operation,'UPSERT');assert(/^[a-f0-9-]{36}$/.test(args.p_idempotency_key))
    assert.equal(args.p_student_payload.parentName,'');assert.equal(args.p_student_payload.parentPhone,'');assert.equal(args.p_student_payload.birthDate,'');assert.equal(String(args.p_student_payload.birthYear),'2021')
    report.writes.push(args)
    result=await jsonQuery("select public.v2_2_mutate_student_with_enrollments('recurring_local_qa','r3c-browser-no-guardian',"+Number(args.p_expected_student_version)+','+q(args.p_student_payload)+','+Number(args.p_expected_enrollment_version)+','+q(args.p_enrollments)+",'"+args.p_idempotency_key+"'::uuid,'UPSERT');")
   }
   response.setHeader('Content-Type','application/json');response.end(JSON.stringify(result));return
  }
  response.writeHead(404);response.end()
 }catch(error){report.errors.push(error.message);response.writeHead(500);response.end(JSON.stringify({error:error.message}))}
})
let browser
try{
 await query(r3cLocalQaSetup);report.before=await jsonQuery(countsSql);await query('set local role authenticated;')
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port
 browser=await chromium.launch({headless:true});report.browser=browser.version()
 const context=await browser.newContext({viewport:{width:1440,height:1080},locale:'vi-VN',serviceWorkers:'block'})
 await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort())
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message))
 await page.goto(origin);await page.waitForFunction(()=>window.fixtureReady)
 await page.locator('[data-student-form-field="fullName"]').fill('LOCAL browser guardian-free')
 await page.locator('[data-student-birth-year-only]').check()
 await page.locator('[data-student-form-field="birthYear"]').fill('2021')
 await page.locator('[data-student-form-step="2"]').click()
 assert((await page.locator('.student-form-panel').innerText()).includes('Thông tin phụ huynh (có thể bổ sung sau)'))
 await page.locator('[data-student-form-field="fatherName"]').fill('LOCAL partial contact')
 await page.locator('[data-student-action="save-form"]').click()
 assert((await page.evaluate(()=>window.state())).form.errors.fatherPhone);assert.equal(report.writes.length,0)
 await page.locator('[data-student-form-field="fatherName"]').fill('')
 await page.locator('[data-student-action="save-form"]').click();await page.waitForFunction(()=>window.state().saveCount===1)
 const created=await page.evaluate(()=>window.state().saved);assert.equal(created.cloudVersion,1);assert.equal(created.enrollmentVersion,1);assert.equal(created.parentPhone,'');assert.equal(created.birthDate,'')
 assert.equal(await page.locator('.student-form-grid > *').count(),2,'Keep the existing two-section form layout')
 for(const field of ['fatherName','fatherPhone','motherName','motherPhone'])assert.equal(await page.locator('[data-student-form-field="'+field+'"]').inputValue(),'','Placeholder is not stored contact data')
 await page.locator('.student-form-panel').screenshot({path:output+'/browser-guardian-free-saved.png'})
 await page.evaluate(()=>window.reopen())
 await page.locator('[data-student-form-field="homeName"]').fill('LOCAL edited after create')
 await page.locator('[data-student-form-step="2"]').click();await page.locator('[data-student-action="save-form"]').click();await page.waitForFunction(()=>window.state().saveCount===2)
 const edited=await page.evaluate(()=>window.state().saved);assert.equal(edited.cloudVersion,2);assert.equal(edited.enrollmentVersion,2);assert.equal(edited.homeName,'LOCAL edited after create');assert.equal(edited.parentName,'');assert.equal(edited.parentPhone,'')
 report.cases.push('Partial contact rejected before RPC','Real create and later edit with blank guardian and year-only DOB; full V2.2 weekday enrollment preserved')
 await page.evaluate(()=>window.openTuition());const panel=page.locator('.tuition-detail-panel');await panel.waitFor({state:'visible'})
 const detail=await panel.innerText();assert(detail.includes('25/24'));assert(detail.includes('Nguồn vượt 1 buổi'));assert(detail.includes('chưa tính thành tiền'));assert(detail.includes('Ưu đãi định kỳ: Giảm 5%'))
 await panel.screenshot({path:output+'/browser-source25-over24-1440.png'})
 await page.setViewportSize({width:1024,height:900});await panel.screenshot({path:output+'/browser-source25-over24-1024.png'})
 const geometry=await panel.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth}));assert(geometry.width>300&&geometry.scrollWidth<=geometry.width+1)
 report.cases.push('Real tuition detail25/24; excess1 unpriced; recurring5%; readable1440/1024')
 await query('reset role;');report.after=await jsonQuery(countsSql);assert.deepEqual(report.after,report.before,'UI creates no cycle/finance/receipt/attendance');assert.equal(report.writes.length,2);assert.equal(report.errors.length,0,JSON.stringify(report.errors))
 report.status='LOCAL_BROWSER_R3C_CREATE_EDIT_AND_SOURCE25_OVER24_PASS'
}catch(error){report.status='FAIL';report.error=error.stack;throw error}
finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve))
 if(db.exitCode===null){await query('rollback;');db.stdin.end();report.rolledBack=true}
 fs.writeFileSync(output+'/browser-qa.json',JSON.stringify(report,null,2)+'\n')
}
console.log(report.status+'; real form/adapter/authenticated SQL; partial contact rejected; no added money/attendance/cycles; rollback; production calls=0')
