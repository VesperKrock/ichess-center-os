import {isOwnerAuditContext,defaultOwnerAuditPeriod,getOwnerAuditRange,shiftOwnerAuditPeriod,buildOwnerAuditGroups,filterOwnerAuditGroups} from './owner-attendance-audit.js'
import {createOwnerAuditCursor,loadOwnerAttendanceAuditBatches} from './cloud-owner-attendance-audit.js'
const initial=()=>({events:[],profile:null,filters:{...defaultOwnerAuditPeriod(),actorId:'all',query:''},expanded:[],loading:false,error:'',hasMore:false,cursor:createOwnerAuditCursor(),exporting:false,exportedBatches:0,exportMenuOpen:false})
const errorLabel=error=>error.code==='AUDIT_READ_LIMIT'?'Kỳ này vượt giới hạn đọc hiện tại. Không thể tải hoặc xuất PDF đầy đủ.'
 :error.code==='AUDIT_BOUNDARY_MOVED'?'Nhật ký vừa thay đổi. Vui lòng làm mới để tải đầy đủ.':'Chưa tải được nhật ký. Vui lòng làm mới.'
const guardedReader=(supabase,valid)=>({rpc:async(...args)=>{
  if(!valid())throw Error('Audit context changed')
  const result=await supabase.rpc(...args)
  if(!valid())throw Error('Audit context changed')
  return result
}})
export function createOwnerAttendanceAuditController({getContext,getSupabase,onChange=()=>{}}){
  let state=initial(),key='',runId=0
  const current=()=>{
    const context=getContext(),next=isOwnerAuditContext(context)?`${context.centerId}:${context.accountId}`:''
    if(next!==key||!next){key=next;runId++;state=initial()}
    return state
  }
  const load=async(append=false)=>{
    const snapshot=current(),context=getContext()
    if(!isOwnerAuditContext(context)||snapshot.loading)return{ok:false}
    const id=++runId,supabase=getSupabase()
    const reader=guardedReader(supabase,()=>current()===snapshot&&id===runId&&isOwnerAuditContext(getContext()))
    snapshot.loading=true;snapshot.exporting=false;snapshot.error=''
    if(!append){snapshot.events=[];snapshot.expanded=[];snapshot.cursor=createOwnerAuditCursor();snapshot.hasMore=false}
    onChange()
    try{
      const [result,user]=await Promise.all([
        loadOwnerAttendanceAuditBatches({supabase:reader,centerId:context.centerId,period:snapshot.filters,cursor:snapshot.cursor}),
        supabase?.auth?.getUser?.().catch(()=>null)??null,
      ])
      if(current()!==snapshot||id!==runId||!isOwnerAuditContext(getContext()))return{ok:false,contextChanged:true}
      snapshot.events=append?[...snapshot.events,...result.events]:result.events
      snapshot.cursor=result.cursor;snapshot.hasMore=result.hasMore
      snapshot.profile=user?.data?.user?.id===context.accountId?user.data.user:null
      snapshot.loading=false;onChange();return{ok:true}
    }catch(error){
      if(current()!==snapshot||id!==runId)return{ok:false,contextChanged:true}
      snapshot.loading=false;snapshot.error=errorLabel(error);onChange();return{ok:false}
    }
  }
  const selectPeriod=period=>{
    const snapshot=current();if(!isOwnerAuditContext(getContext()))return
    try{getOwnerAuditRange(period)}catch{return}
    runId++;snapshot.loading=false;snapshot.exporting=false;snapshot.exportMenuOpen=false;snapshot.filters={...snapshot.filters,...period};return load()
  }
  const exportPdf=async({projection,centerName,pdfOptions}={})=>{
    const snapshot=current(),context=getContext()
    if(!isOwnerAuditContext(context)||snapshot.loading||snapshot.exporting||projection?.centerId!==context.centerId)return{ok:false}
    const id=++runId,filters=structuredClone(snapshot.filters),supabase=getSupabase()
    snapshot.exporting=true;snapshot.exportMenuOpen=false;snapshot.error='';snapshot.exportedBatches=0;onChange()
    const valid=()=>current()===snapshot&&id===runId&&isOwnerAuditContext(getContext())
    const reader=guardedReader(supabase,valid)
    try{
      let cursor=createOwnerAuditCursor(),events=[]
      while(true){
        if(!valid())return{ok:false,contextChanged:true}
        const result=await loadOwnerAttendanceAuditBatches({supabase:reader,centerId:context.centerId,period:filters,cursor})
        if(!valid())return{ok:false,contextChanged:true}
        events.push(...result.events);cursor=result.cursor
        snapshot.exportedBatches=new Set(events.map(e=>e.audit_batch_id)).size;onChange()
        if(!result.hasMore)break
      }
      const groups=filterOwnerAuditGroups(buildOwnerAuditGroups(events,projection),filters)
      const {generateOwnerAuditPdf}=await import('./owner-attendance-audit-pdf.js')
      if(!valid())return{ok:false,contextChanged:true}
      const result=await generateOwnerAuditPdf({groups,period:filters,centerName,filters},pdfOptions)
      if(!valid())return{ok:false,contextChanged:true}
      snapshot.exporting=false;onChange();return{ok:true,...result}
    }catch(error){
      if(!valid())return{ok:false,contextChanged:true}
      snapshot.exporting=false;snapshot.error=error.code?errorLabel(error):'Chưa tạo được PDF đầy đủ. Vui lòng thử lại.';onChange();return{ok:false}
    }
  }
  return {getState:current,load,exportPdf,more:()=>load(true),reset(){key='';runId++;state=initial()},
    open:()=>selectPeriod({...defaultOwnerAuditPeriod(),actorId:'all',query:''}),
    toggleExportMenu(){const snapshot=current();if(isOwnerAuditContext(getContext())){snapshot.exportMenuOpen=!snapshot.exportMenuOpen;onChange()}},
    selectScope(scope){if(['day','month','year'].includes(scope))selectPeriod({...current().filters,scope})},
    selectDate(value){const scope=current().filters.scope;selectPeriod({scope,date:scope==='year'?`${value}-01-01`:scope==='month'?`${value}-01`:value})},
    step(direction){try{selectPeriod(shiftOwnerAuditPeriod(current().filters,direction))}catch{}},
    setFilter(field,value){
      const snapshot=current();if(!isOwnerAuditContext(getContext()))return
      if(field==='query'||field==='actorId'){
        if(snapshot.exporting){runId++;snapshot.exporting=false}
        snapshot.filters={...snapshot.filters,[field]:String(value|| (field==='actorId'?'all':''))};onChange()
      }
    },expand(batchId){const snapshot=current();if(!isOwnerAuditContext(getContext()))return
      if(!snapshot.events.some(e=>e.audit_batch_id===batchId))return
      snapshot.expanded=snapshot.expanded.includes(batchId)?snapshot.expanded.filter(id=>id!==batchId):[...snapshot.expanded,batchId];onChange()
    },
  }
}
