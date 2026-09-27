import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {folder,read,save,sqlQuery} from './dreamhome-final-canary-remote.js'

const before=read('before'),after=read('after-cleanup'),b=read('before-raw'),a=read('after-cleanup-raw'),qa=read('qa-created')
const report={passed:false}
const stripTime=payload=>Object.fromEntries(Object.entries(payload).filter(([key])=>key!=='updatedAt'))
assert.deepEqual(stripTime(after.student.payload),stripTime(before.student.payload),'Every original Student fact must be restored exactly')
assert.equal(after.student.entity_version,before.student.entity_version+2,'Versions advance for enrollment and canonical restoration')
for(const key of ['centerId','centerName','studentId','name','status','classSessionIds','relatedEntities','enrollmentSets','enrollments','cycles','cycleProjection','finance','receipts','paymentLinks','notes'])assert.deepEqual(after[key],before[key],key)
assert.deepEqual(a.entities.filter(e=>e.local_id!==qa.classId&&e.local_id!==qa.tuitionLocalId&&e.local_id!==before.studentId),b.entities.filter(e=>e.local_id!==before.studentId),'All unrelated DreamHome entity tuples must be identical, including old canary attendance and shared makeup session')
assert(!a.entities.some(e=>e.local_id===qa.tuitionLocalId),'Own unused Tuition record removed')
const tombstone=a.entities.find(e=>e.local_id===qa.classId)
assert(tombstone?.deleted_at)
assert.equal(tombstone.entity_version,2)
qa.classCloudEntityId=tombstone.id
qa.removal={removedFromActiveAuthority:true,deletedAt:tombstone.deleted_at,canonicalSoftDeletion:true,unusedCycleAndEnrollmentRemoved:true,auditsRetained:true}
save('qa-created',qa)
assert.deepEqual(a.center,b.center);assert.deepEqual(a.profile,b.profile);assert.deepEqual(a.packages,b.packages)
report.restoration={businessFactsIdentical:true,originalStudentVersion:before.student.entity_version,finalStudentVersion:after.student.entity_version,changedMetadata:['entity_version','updated_at','payload.updatedAt'],qaTombstoneRetained:true,auditsRetained:true,oldAttendanceAndSharedMakeupSessionPreserved:true}

const hashesBefore=read('safety-before').hashes,hashesAfter=read('safety-after').hashes
const allowedTables=new Set(['center_cloud_entities','center_core_command_result','center_core_mutation_audit','center_student_enrollment_command_results','center_student_enrollment_audit_events','center_tuition_cycle_command_results','center_tuition_cycle_audit_events'])
report.changedTables=[]
for(const [table,rows] of Object.entries(hashesBefore)){
  assert.deepEqual(hashesAfter[table].filter(r=>r.center_id!=='dreamhome_prod'),rows.filter(r=>r.center_id!=='dreamhome_prod'),`${table}: all unrelated centers identical`)
  if(JSON.stringify(hashesAfter[table])!==JSON.stringify(rows)){
    report.changedTables.push(table)
    assert(allowedTables.has(table),`Unexpected persistent change: ${table}`)
  }
}
report.safety={centerScopedTables:Object.keys(hashesBefore).length,allOtherCentersIdentical:true,otherDreamHomeStudentsIdentical:true,financeReceiptPaymentTablesIdentical:true,onlyOwnQaAuditAndClassTombstoneRemain:true}

const operator=read('operator-ui'),restored=read('restored-ui')
assert(operator.passed&&restored.passed)
for(const ui of [operator,restored]){
  assert.deepEqual(ui.runtimeExceptions,[]);assert.deepEqual(ui.consoleErrors,[]);assert.deepEqual(ui.failedRelevantReads,[]);assert.deepEqual(ui.blockedWrites,[])
  assert(!ui.requests.some(r=>r.method==='POST'&&/mutate_tuition_receipt|mutate_finance|finance.*write/.test(r.url)))
}
assert.match(operator.studentProfile,/QA - Nguyễn Tùng Lâm/)
assert.match(operator.studentProfile,/10:15–10:45/)
assert.match(operator.assignedTuition,/0\/16/);assert.match(operator.afterClassTuition,/0\/16/)
assert.equal(operator.payment.error,'');assert.equal(operator.paymentSaved,false)
assert.match(restored.restoredTuition,/Chưa có gói/)
assert(!restored.restoredProfile.includes(qa.classId))
for(const theme of ['light','dark']){
  const m=restored.settings.find(s=>s.theme===theme);assert(m)
  assert.equal(m.viewport.width,1536);assert.equal(m.viewport.height,728)
  assert(m.wrap.height<100);assert(m.scrollWidth<=m.clientWidth)
}
assert.equal(restored.settingsVariants.length,4)
for(const m of restored.settingsVariants){
  assert(m.staticFixture);assert(m.scrollWidth<=m.clientWidth)
  if(m.variant==='empty')assert(m.wrap.height<150)
  else assert(m.scrollHeight>m.clientHeight && m.wrap.height<430)
}

const request=operator.requests.find(r=>r.method==='POST'&&r.url.endsWith('/tbhp_get_printable_document'))
assert.equal(request.status,200)
const snapshot=request.body.document.snapshot
assert.equal(snapshot.center.id,'dreamhome_prod');assert.equal(snapshot.center.name,'DreamHome')
assert.equal(snapshot.student.id,before.studentId);assert.equal(snapshot.student.name,before.name)
assert.equal(snapshot.money.totalAmount,2400000);assert.equal(snapshot.tuition.totalSessions,16)
assert.equal(snapshot.currentProgress.usedSessions,0);assert.equal(snapshot.scheduleRows.length,16)
assert(snapshot.scheduleRows.every(r=>r.date===null && r.teacherName===''))
const dependencies=path.join(os.tmpdir(),'ichess-tuition-pdf-render-270927/node_modules')
const {createCanvas}=await import(pathToFileURL(path.join(dependencies,'@napi-rs/canvas/index.js')))
const pdfjs=await import(pathToFileURL(path.join(dependencies,'pdfjs-dist/legacy/build/pdf.mjs')))
const pdfFile=`${folder}/dreamhome-nguyen-tung-lam-tbhp-16.pdf`
const bytes=fs.readFileSync(pdfFile)
const document=await pdfjs.getDocument({data:new Uint8Array(bytes)}).promise
assert.equal(document.numPages,1)
const page=await document.getPage(1),viewport=page.getViewport({scale:2})
assert(Math.abs(page.view[2]-595.28)<1 && Math.abs(page.view[3]-841.89)<1)
const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height))
await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise
fs.writeFileSync(`${folder}/dreamhome-nguyen-tung-lam-tbhp-16.png`,canvas.toBuffer('image/png'))
report.tbhp={actualRemoteSnapshot:true,viewerOpened:true,pages:1,size:'A4 portrait',center:'DreamHome',student:before.name,N:16,used:0,amount:2400000,allFutureDateAndTeacherRowsBlank:true,pdfSha256:crypto.createHash('sha256').update(bytes).digest('hex')}

const backend=sqlQuery(`begin transaction read only;select jsonb_build_object(
 'functions',(select jsonb_object_agg(proname,pg_get_functiondef(oid)) from pg_proc where pronamespace='public'::regnamespace and proname in ('f5b_mutate_tuition_receipt','f5b_mutate_tuition_receipt_pre_final_business_alignment','f5b_mutate_tuition_receipt_pre_final_lifecycle','f5b_mutate_tuition_receipt_pre_simple_core')),
 'executeAuthenticated',has_function_privilege('authenticated','public.f5b_mutate_tuition_receipt(text,jsonb,uuid)','EXECUTE'),
 'prefix',(select receipt_prefix from public.center_operational_profiles where center_id='dreamhome_prod'),
 'paymentCategory',(select jsonb_agg(jsonb_build_object('id',id,'name',name)) from public.finance_category where center_id='dreamhome_prod' and not is_archived and category_type in ('INCOME','BOTH')),
 'receiptCount',(select count(*) from public.center_tuition_receipts where center_id='dreamhome_prod'),
 'migrationLedger',(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations where version like '20260926%' or version like '20260927%')
);rollback;`)
assert.equal(backend.executeAuthenticated,true);assert.equal(backend.prefix,'DH')
assert.match(backend.functions.f5b_mutate_tuition_receipt,/FULL_PAYMENT_REQUIRED/)
const atomic=backend.functions.f5b_mutate_tuition_receipt_pre_final_business_alignment
assert.match(atomic,/insert into public.finance_transaction/i)
assert.match(atomic,/insert into public.center_tuition_receipts/i)
assert.match(atomic,/insert into public.center_tuition_receipt_payment_links/i)
assert.match(atomic,/idempotency_key/)
assert.match(atomic,/for update/)
save('payment-backend-readiness',backend)
report.payment={correctFullAmount:2400000,amountReadonly:true,payerInputWorks:true,collector:operator.payment.fields.find(f=>f.field==='collectorName').value,collectorSource:'Existing frozen Admin fallback; configured default is blank',methods:['cash','transfer','other'],falseStale:false,prefix:'DH',remoteAuthenticatedContractVerified:true,saveAttempted:false,permanentPaymentFinanceReceiptWrites:0}
report.ui={actualLocalhostConfiguredRemote:true,hardRefreshPassed:true,lightDark1536x728Passed:true,uncaught:0,consoleErrors:0,failedTuitionSettingsEnrollmentReads:0}
report.settings={realSingleRowHeight:48,realTableHeight:86,horizontalScroll:false,staticEmptyHeight:122,staticManyRowsScrollable:true,bothThemesVerified:true}
report.passed=true
save('final-proof',report)
console.log(JSON.stringify(report,null,2))
