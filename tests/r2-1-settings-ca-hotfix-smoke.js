import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { randomUUID } from 'node:crypto'
import { createEmptySettingsClassSessionFormState, createEditSettingsClassSessionFormState,
  buildSettingsClassSessionFromForm, validateSettingsClassSessionForm, normalizeSettingsClassSessionTime,
  renderSettingsModule } from '../src/settings-module.js'
import { prepareAuthoritativeCoreFormCommand } from '../src/core-save-recovery.js'
import { mutateAuthoritativeCoreEntity } from '../src/cloud-authoritative-core.js'
import { changeA3ClassTeacher, resolveA3TeacherForDate } from '../src/cloud-authoritative-teacher-history.js'

for (const value of ['6:30','06:30','6h30','06h30','6g30','06g30'])
  assert.equal(normalizeSettingsClassSessionTime(value),'06:30')
for (const value of ['10h30','10g30','10:30']) assert.equal(normalizeSettingsClassSessionTime(value),'10:30')
assert.equal(normalizeSettingsClassSessionTime('10h'),'10:00')
for (const value of ['25:00','18:75','6:30 PM','chiều T3']) assert.equal(normalizeSettingsClassSessionTime(value),'')
const values = { ...createEmptySettingsClassSessionFormState().values,
  daysOfWeek:['tue'],startTime:'6:30',endTime:'8h',note:'Ghi chú thật' }
assert.deepEqual(validateSettingsClassSessionForm(values),{})
for (const endTime of ['06:30','05:00']) assert(validateSettingsClassSessionForm({...values,endTime}).endTime)
assert(validateSettingsClassSessionForm({...values,daysOfWeek:['mon','tue','wed']}).daysOfWeek)
const created = buildSettingsClassSessionFromForm({...values,instructorName:'Do not write',teacherId:'not-a-Ca-field'})
assert(!Object.hasOwn(created,'instructorName'))
assert(!Object.hasOwn(created,'teacherId'))
assert.equal(created.startTime,'06:30')
const legacy={...created,id:'legacy',instructorName:'  legacy evidence  ',cloudVersion:1}
const edited=buildSettingsClassSessionFromForm({...values,instructorName:'changed'},legacy)
assert.equal(edited.instructorName,legacy.instructorName,'Preserve frozen legacy evidence unchanged')
const teacher = {id:'00000000-0000-4000-8000-000000000002',displayName:'Teacher Local',status:'active',
  assignment:{centerId:'local-a',status:'assigned'}}
const html=renderSettingsModule([{...created,currentTeacherName:'Teacher Local'}],[],undefined,
  {...createEmptySettingsClassSessionFormState(),values},null,{activeTab:'class-sessions',teacherOptions:[teacher]})
assert(html.includes('Giáo viên hiện tại (không bắt buộc)'))
assert(html.includes('Teacher Local'))
assert(html.includes('settings-ca-action-cell'))
const editHtml=renderSettingsModule([legacy],[],undefined,createEditSettingsClassSessionFormState(legacy),null)
assert(!editHtml.includes('data-settings-class-session-field="teacherId"'),'Edit keeps existing A3 workflow')

const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8')
function declaration(name) {
  const start=source.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'))
  assert(start>=0)
  const next=source.slice(start+1).search(/\n(?:async )?function /)
  return source.slice(start,next<0?source.length:start+1+next)
}
function fixture({selected='',failA3=false,uncertainA3=false,edit=false,registryReady=true}={}) {
  const calls=[],alerts=[],assignments=[]
  const context={console,Intl,Date,centerId:'local-a',classSessions:edit?[legacy]:[],
    settingsClassSessionFormState:edit?createEditSettingsClassSessionFormState(legacy):{
      ...createEmptySettingsClassSessionFormState(),values:{...values,teacherId:selected}},
    v26TeacherRegistryCapabilityState:{assignedTeachers:[teacher]},
    authoritativeCoreSavesInFlight:new Set(),
    getCurrentCanonicalCenterContext:()=>({centerId:context.centerId}),
    isV26TeacherRegistryCapabilityReady:()=>registryReady,
    validateSettingsClassSessionForm,buildSettingsClassSessionFromForm,prepareAuthoritativeCoreFormCommand,
    createCoreCommandIdempotencyKey:randomUUID,changeA3ClassTeacher,resolveA3TeacherForDate,
    window:{alert:value=>alerts.push(value)},render:()=>{},
    refreshA3TeacherContext:async()=>({ok:true,assignments}),
  }
  context.supabase={rpc:async(name,args)=>{
    calls.push({name,args})
    assert(['c5_1_mutate_core_entity','a3_change_class_teacher'].includes(name),'No other writer')
    if(name==='a3_change_class_teacher') {
      if(!failA3) assignments.push({class_session_local_id:args.p_class_id,teacher_id:args.p_teacher_id,
        teacher_name:teacher.displayName,effective_from:args.p_effective_from})
      return failA3||uncertainA3?{error:{message:'mock network failure'}}:{data:{ok:true}}
    }
    return {data:{ok:true,outcome_code:'COMMITTED',entity_version:args.p_expected_version+1,
      payload:args.p_payload,updated_at:new Date().toISOString()}}
  }}
  context.getSupabaseClient=()=>context.supabase
  context.commitClassSessionProjection=async(entity,reason,key)=>{
    const result=await mutateAuthoritativeCoreEntity({supabase:context.supabase,centerId:context.centerId,
      entityType:'class_session',entity,idempotencyKey:key})
    if(result.ok)context.classSessions=[result.entity]
    return {...result,committed:result.ok,refreshOk:true}
  }
  vm.createContext(context)
  for(const name of ['getEligibleSettingsCaTeachers','saveSettingsClassSessionForm'])
    vm.runInContext(declaration(name),context)
  return {context,calls,alerts,assignments}
}
const blank=fixture({registryReady:false})
await blank.context.saveSettingsClassSessionForm()
assert.equal(blank.calls.length,1,'Blank teacher works even if registry not ready')
assert(!Object.hasOwn(blank.calls[0].args.p_payload,'instructorName'))
assert.equal(blank.context.settingsClassSessionFormState,null)
const assigned=fixture({selected:teacher.id})
await assigned.context.saveSettingsClassSessionForm()
assert.deepEqual(assigned.calls.map(c=>c.name),['c5_1_mutate_core_entity','a3_change_class_teacher'])
assert.equal(assigned.calls[1].args.p_class_id,assigned.calls[0].args.p_local_id)
assert.equal(assigned.calls[1].args.p_effective_from,new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date()))
assert.equal(assigned.calls[1].args.p_idempotency_key,assigned.calls[0].args.p_idempotency_key)
assert.equal(assigned.alerts.length,0)
const failed=fixture({selected:teacher.id,failA3:true})
await failed.context.saveSettingsClassSessionForm()
assert.equal(failed.context.classSessions.length,1)
assert.equal(failed.context.settingsClassSessionFormState,null)
assert.match(failed.alerts[0],/Ca đã được tạo nhưng chưa gán được giáo viên/)
await failed.context.saveSettingsClassSessionForm()
assert.equal(failed.calls.filter(c=>c.name==='c5_1_mutate_core_entity').length,1,'No duplicate create retry')
const uncertain=fixture({selected:teacher.id,uncertainA3:true})
await uncertain.context.saveSettingsClassSessionForm()
assert.equal(uncertain.alerts.length,0,'Read-back confirms committed A3 after uncertain response')
const edit=fixture({edit:true})
edit.context.settingsClassSessionFormState.values={...values,status:'inactive',teacherId:''}
await edit.context.saveSettingsClassSessionForm()
assert.equal(edit.calls.length,1,'Blank edit never clears or rewrites A3')
assert.equal(edit.calls[0].args.p_payload.instructorName,legacy.instructorName)
assert.equal(edit.calls[0].args.p_payload.status,'inactive')
const invalid=fixture()
invalid.context.settingsClassSessionFormState.values.endTime='06:00'
await invalid.context.saveSettingsClassSessionForm()
assert.equal(invalid.calls.length,0)
assert(invalid.context.settingsClassSessionFormState.errors.endTime)
const pending=fixture({selected:teacher.id})
let releaseCore,releaseTeacher
const original=pending.context.supabase.rpc
pending.context.supabase.rpc=async(name,args)=>{
  await new Promise(resolve=>{if(name==='c5_1_mutate_core_entity')releaseCore=resolve;else releaseTeacher=resolve})
  return original(name,args)
}
const save=pending.context.saveSettingsClassSessionForm()
assert.equal(pending.context.authoritativeCoreSavesInFlight.size,1)
await pending.context.saveSettingsClassSessionForm()
releaseCore()
while(!releaseTeacher)await new Promise(resolve=>setTimeout(resolve,0))
assert.equal(pending.context.authoritativeCoreSavesInFlight.size,1,'N8 switch lock spans A3 stage')
releaseTeacher();await save
assert.equal(pending.context.authoritativeCoreSavesInFlight.size,0)
assert.equal(pending.calls.length,2,'Double-click is ignored across both stages')
const switched=fixture({selected:teacher.id})
const originalCommit=switched.context.commitClassSessionProjection
switched.context.commitClassSessionProjection=async(...args)=>{
 const result=await originalCommit(...args);switched.context.centerId='local-b';return result
}
await switched.context.saveSettingsClassSessionForm()
assert.equal(switched.calls.length,1,'Never send old Ca A3 command under another center')
const renderFailure=fixture()
let renderAttempt=0
renderFailure.context.render=()=>{if(renderAttempt++===0)throw Error('Local renderer failure')}
await renderFailure.context.saveSettingsClassSessionForm()
assert.equal(renderFailure.context.authoritativeCoreSavesInFlight.size,0,'A renderer exception must release the switch lock')
assert.equal(renderFailure.calls.length,0)
const policy=fs.readFileSync(new URL('../docs/business-reference/import/R2_EXCEL_IMPORT_RULES.md',import.meta.url),'utf8')
assert(policy.includes('24-hour clock') && policy.includes('06:30'))
assert(!/may mean morning or evening|without proof/.test(policy))
assert(policy.includes('REUSE_CA') && policy.includes('PROPOSE_CREATE_CA'))
console.log('R2_1_SETTINGS_CA_HOTFIX_SMOKE: PASS — real renderer/builders/save handler; mock RPC only')
