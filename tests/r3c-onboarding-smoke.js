import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createEmptyStudentFormState,createEditStudentFormState,validateStudentForm,buildStudentFromForm,
  getStudentFormSaveDisabledReason,isStudentParentCareInfoIncomplete,renderStudentModule,initialStudentFilters} from '../src/student-module.js'
import {buildV24ImportInitialBaselineCommand,projectVerifiedInitialBaseline} from '../src/excel-initial-baseline.js'
import {parseV24PackageCycleSnapshot} from '../src/cloud-authoritative-tuition-cycles.js'
import {normalizeTuitionCyclePresentation,renderTuitionModule} from '../src/tuition-module.js'
// Run r3c-initial-source-overage-local-db-qa.js first to generate the native
// synthetic snapshot. No production evidence or real student data is required.
const values={...createEmptyStudentFormState().values,fullName:'LOCAL no guardian',birthYearOnly:true,birthYear:'2021',birthDate:'',schoolName:'',level:'Turtle 2',fatherName:'',fatherPhone:'',motherName:'',motherPhone:'',parentName:'',parentPhone:''}
assert.deepEqual(validateStudentForm(values),{})
assert.equal(getStudentFormSaveDisabledReason(values),'')
assert.equal(isStudentParentCareInfoIncomplete(values),false)
const created=buildStudentFromForm(values)
assert.equal(String(created.birthYear),'2021');assert.equal(created.birthDate,'');assert.equal(created.parentName,'');assert.equal(created.parentPhone,'')
const edit=createEditStudentFormState({...created,id:'local-21'})
assert.deepEqual(validateStudentForm(edit.values),{})
const edited=buildStudentFromForm({...edit.values,homeName:'LOCAL edit'},created)
assert.equal(edited.parentName,'');assert.equal(edited.parentPhone,'');assert.equal(edited.birthDate,'')
for(const contact of [{fatherName:'LOCAL Father'},{fatherPhone:'0900000001'},{motherName:'LOCAL Mother'},{parentName:'LOCAL legacy'},
  {motherName:'LOCAL Mother',motherPhone:'123'},{fatherName:'Thiếu',fatherPhone:'Thiếu'}]){
 const v={...values,...contact};assert(Object.keys(validateStudentForm(v)).length>0,'Partial/invalid contact stays rejected')
}
assert.deepEqual(validateStudentForm({...values,motherName:'LOCAL Mother',motherPhone:'0900000001'}),{})
const form={...createEditStudentFormState(created),step:2}
assert(renderStudentModule([created],initialStudentFilters,form).includes('Thông tin phụ huynh (có thể bổ sung sau)'))
const facts={discountKind:'PERCENT',percent:5,fixedMinor:0,siblingVoucherMinor:0,paymentState:'PAID_BEFORE_ICHESS',sourceDueMinor:3918750,collectedMinor:3918750,remainingMinor:0}
const input={studentId:'local-overage',packageCatalog:{id:'17101700-0000-4000-8000-000000000024',version:1,totalSessions:24,defaultAmount:4125000},used:25,total:24,cutoff:'2026-10-16',sourceSha256:'c'.repeat(64),sourceKey:'d'.repeat(64),reviewNote:'Verified source 25/24, unpriced excess',financialFacts:facts}
assert.throws(()=>buildV24ImportInitialBaselineCommand(input),/PACKAGE_AB_MISMATCH/)
assert.equal(buildV24ImportInitialBaselineCommand({...input,sourceOverageSessions:1}).baseline_used_sessions,25)
for(const x of [0,2,-1,'1',null,1.5])assert.throws(()=>buildV24ImportInitialBaselineCommand({...input,sourceOverageSessions:x}))
const raw={id:'17101700-0000-4000-8000-000000006005',state:'PENDING_FINANCIAL_REVIEW',version:1,total_sessions:24,baseline_used_sessions:25,
  contributed_sessions:0,used_sessions:25,remaining_sessions:0,financial_facts:facts,listed_price_minor:4125000,package_name:'LOCAL 24',baseline_cutoff_date:'2026-10-16',source_overage_sessions:1}
const baseline=projectVerifiedInitialBaseline(raw)
assert.equal(baseline.baselineUsed,25);assert.equal(baseline.sourceOverageSessions,1)
assert.throws(()=>projectVerifiedInitialBaseline({...raw,source_overage_sessions:0}))
assert.throws(()=>projectVerifiedInitialBaseline({...raw,baseline_used_sessions:24,used_sessions:24,source_overage_sessions:null}))
const pending=normalizeTuitionCyclePresentation({packageCycleState:{verifiedInitialBaseline:baseline}})
assert.equal(pending.progressLabel,'25/24');assert.equal(pending.sourceOverageSessions,1);assert(!pending.canCollectPayment)
const native=JSON.parse(fs.readFileSync('artifacts/R3C/Tan-Binh/20261017/evidence/local-native-snapshot.json','utf8'))
const parsed=parseV24PackageCycleSnapshot(native.r3c_snapshot,'recurring_local_qa');assert(parsed.ok)
const student=parsed.students.find(s=>s.studentId==='r3c-overage'),cycle=student.cycles.find(c=>c.initialImport)
assert.equal(cycle.usedSessions,25);assert.equal(cycle.initialImport.sourceOverageSessions,1)
const context={students:[{id:'r3c-overage',fullName:'LOCAL overage'}],cycleStates:[student],catalog:parsed.packageCatalog,readStatus:'ready',receiptStatus:'ready',receipts:[]}
const markup=renderTuitionModule(context,{filters:{query:'',status:'all',package:'all'},panel:{kind:'detail',studentId:'r3c-overage',cycleId:cycle.id,busy:false}})
assert(markup.includes('25/24'));assert(markup.includes('Nguồn vượt 1 buổi'));assert(markup.includes('chưa tính thành tiền'))
assert.equal(cycle.initialImport.outstandingAmount,0)
const invalid=structuredClone(native.r3c_snapshot)
invalid.students.find(s=>s.student_id==='r3c-overage').current_cycle.initial_import.source_overage_sessions=0
assert(!parseV24PackageCycleSnapshot(invalid,'recurring_local_qa').ok,'A>N without exact typed overage fails closed')
console.log('R3C_ONBOARDING_SMOKE_PASS: guardian-free create/edit,no fake DOB/contact,partial contacts rejected,explicit exact25/24,unpriced warning,legacy compatibility')
