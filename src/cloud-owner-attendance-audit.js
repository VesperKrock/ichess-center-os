import {isAttendanceLedgerDate} from './attendance-ledger.js'
import {auditBusinessDate,getOwnerAuditRange} from './owner-attendance-audit.js'
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const validState=value=>value===null||Boolean(value&&typeof value==='object'&&!Array.isArray(value))
export async function readOwnerAttendanceAuditPage({supabase,centerId,year,batchId=null,offset=0,limit=100}) {
  if(!supabase?.rpc||!centerId||!Number.isInteger(year)||year<2000||year>9999||!Number.isInteger(offset)
    ||offset<0||offset>1000000||!Number.isInteger(limit)||limit<1||limit>200||(batchId&&!uuid(batchId)))throw Error('Invalid audit request')
  const {data,error}=await supabase.rpc('v2_9_list_attendance_audit_events',{
    p_center_id:centerId,p_year:year,p_student_local_id:null,p_schedule_session_local_id:null,
    p_audit_batch_id:batchId,p_limit:limit,p_offset:offset,
  })
  if(error||data?.ok!==true||data.center_id!==centerId||data.year!==year||data.limit!==limit||data.offset!==offset
    ||!Array.isArray(data.events)||data.events.length>limit)throw Error('Audit read denied or invalid')
  for(const e of data.events){
    if(e.center_id!==centerId||e.domain!=='ATTENDANCE'||e.batch_action!=='SAVE_ATTENDANCE'||e.entity_type!=='attendance_record'
      ||!Number.isSafeInteger(e.id)||!uuid(e.audit_batch_id)||!uuid(e.actor_user_id)||!e.student_local_id||!e.schedule_session_local_id
      ||!isAttendanceLedgerDate(e.occurrence_date)||!Number.isFinite(Date.parse(e.created_at))
      ||Number(auditBusinessDate(e.created_at).slice(0,4))!==year||!Number.isInteger(e.batch_ordinal)||e.batch_ordinal<1||e.batch_ordinal>500
      ||!validState(e.before_state)||!validState(e.after_state)||(batchId&&e.audit_batch_id!==batchId)
      ||![e.absence_reason_before,e.absence_reason_after].every(reason=>reason===null||typeof reason==='string'))throw Error('Audit event context mismatch')
  }
  return data.events
}
export const createOwnerAuditCursor=()=>({yearIndex:0,offset:0,pending:[],seen:[],finished:false,seeked:false})
export const ownerAuditLimitError=()=>Object.assign(Error('Audit period exceeds frozen read limit'),{code:'AUDIT_READ_LIMIT'})
// The frozen RPC permits random OFFSET reads in timestamp order. Locate the
// upper date boundary with single-event probes, without transferring the
// preceding year's events. At most 34 probes plus a boundary verification.
async function seekPeriodOffset(request,end){
  const probe=async offset=>(await readOwnerAttendanceAuditPage({...request,offset,limit:1}))[0]
  const newer=event=>event&&Date.parse(event.created_at)>=end
  if(!newer(await probe(0)))return 0
  let low=0,high=100
  while(true){
    high=Math.min(high,1000000)
    if(!newer(await probe(high)))break
    if(high===1000000)throw ownerAuditLimitError()
    low=high;high*=2
  }
  while(high-low>1){
    const middle=Math.floor((low+high)/2)
    if(newer(await probe(middle)))low=middle;else high=middle
  }
  const boundary=await readOwnerAttendanceAuditPage({...request,offset:high-1,limit:2})
  if(!newer(boundary[0])||newer(boundary[1]))throw Object.assign(Error('Audit boundary moved'),{code:'AUDIT_BOUNDARY_MOVED'})
  return high
}
async function readCompleteBatch(request,candidate){
  const readYear=async year=>{
    const events=[]
    for(let offset=0;offset<=400;offset+=200){
      const page=await readOwnerAttendanceAuditPage({...request,year,batchId:candidate.id,limit:200,offset})
      events.push(...page);if(page.length<200)return events
    }
    throw Error('Audit batch exceeds frozen writer bound')
  }
  const events=await readYear(candidate.year)
  if(events.some(e=>auditBusinessDate(e.created_at)===`${candidate.year}-01-01`)&&candidate.year>2000)events.push(...await readYear(candidate.year-1))
  if(events.some(e=>auditBusinessDate(e.created_at)===`${candidate.year}-12-31`)&&candidate.year<9999)events.push(...await readYear(candidate.year+1))
  if(!events.length||events.length>500||new Set(events.map(e=>e.id)).size!==events.length
    ||new Set(events.map(e=>e.actor_user_id)).size!==1||new Set(events.map(e=>e.batch_ordinal)).size!==events.length)throw Error('Incomplete or inconsistent audit batch')
  return events
}
export async function loadOwnerAttendanceAuditBatches({supabase,centerId,period='30',cursor=createOwnerAuditCursor(),now=new Date()}){
  const next=structuredClone(cursor),range=getOwnerAuditRange(period,now)
  if(period&&typeof period==='object'&&!next.seeked){
    try{next.offset=await seekPeriodOffset({supabase,centerId,year:range.years[0]},range.end)}catch(error){
      if(error.code!=='AUDIT_BOUNDARY_MOVED')throw error
      next.offset=await seekPeriodOffset({supabase,centerId,year:range.years[0]},range.end)
    }
    next.seeked=true
  }
  for(let pages=0;pages<5&&next.pending.length<10&&!next.finished;pages++){
    const year=range.years[next.yearIndex]
    if(next.offset>1000000)throw ownerAuditLimitError()
    const limit=next.offset===1000000?200:100
    const page=await readOwnerAttendanceAuditPage({supabase,centerId,year,offset:next.offset,limit})
    next.offset+=page.length
    for(const event of page){
      const time=Date.parse(event.created_at)
      if(time>=range.start&&time<range.end&&!next.seen.includes(event.audit_batch_id)
        &&!next.pending.some(c=>c.id===event.audit_batch_id))next.pending.push({id:event.audit_batch_id,year})
    }
    if(page.length<limit||page.some(e=>Date.parse(e.created_at)<range.start)){
      next.yearIndex++;next.offset=0;next.finished=next.yearIndex>=range.years.length
    }
  }
  const chosen=next.pending.splice(0,10),events=[]
  // Bounded independent reads; every top-level row has its complete batch.
  for(let index=0;index<chosen.length;index+=3){
    const batches=await Promise.all(chosen.slice(index,index+3).map(candidate=>readCompleteBatch({supabase,centerId},candidate)))
    for(const batch of batches){
      next.seen.push(batch[0].audit_batch_id)
      const time=Math.max(...batch.map(e=>Date.parse(e.created_at)))
      if(time>=range.start&&time<range.end)events.push(...batch)
    }
  }
  return {events,cursor:next,hasMore:next.pending.length>0||!next.finished}
}
