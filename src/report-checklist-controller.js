import {isAttendanceLedgerDate} from './attendance-ledger.js'
import {pullDailyChecklist,setDailyChecklistItem} from './cloud-daily-checklist.js'
import {createDailyChecklistState,getDailyChecklistTemplate,getChecklistToday} from './report-daily-checklist.js'

export function createReportChecklistController({getContext,getSupabase,canWrite,onChange=()=>{}}) {
  let state=createDailyChecklistState(),accountId='',readId=0
  const current=()=>{
    const context=getContext()
    if(state.centerId!==context.centerId||accountId!==context.accountId){
      readId++;accountId=context.accountId;state=createDailyChecklistState(context.centerId)
    }
    // Report owns the date. Invalidate the old projection before any render/read.
    if(isAttendanceLedgerDate(context.businessDate)&&state.businessDate!==context.businessDate){
      readId++;state={...state,businessDate:context.businessDate,status:'idle',items:[],
        savingKey:'',expandedKeys:[],error:''}
    }
    return state
  }
  const stillCurrent=(snapshot,actor)=>current()===snapshot&&accountId===actor
  const load=async()=>{
    const snapshot=current(),actor=accountId,id=++readId
    if(snapshot.savingKey)return
    snapshot.status='loading';snapshot.error='';onChange()
    const result=await pullDailyChecklist({supabase:getSupabase(),...snapshot})
    if(id!==readId||!stillCurrent(snapshot,actor))return
    snapshot.status=result.ok?'ready':'failed';snapshot.items=result.ok?result.items:[]
    snapshot.error=result.ok?'':result.error;onChange()
    return result
  }
  return {
    getState:current,
    load,
    reset(){readId++;state=createDailyChecklistState();accountId=''},
    async select({businessDate,templateKey}={}){
      const previous=current()
      if(previous.savingKey)return false
      if(businessDate!==undefined&&!isAttendanceLedgerDate(businessDate))return false
      if(templateKey!==undefined&&!getDailyChecklistTemplate(templateKey))return false
      state={...previous,businessDate:businessDate??previous.businessDate,templateKey:templateKey??previous.templateKey,
        status:'idle',items:[],expandedKeys:[],error:''}
      return load()
    },
    expand(itemKey){
      const s=current()
      if(!getDailyChecklistTemplate(s.templateKey).items.some(item=>item.key===itemKey))return
      s.expandedKeys=s.expandedKeys.includes(itemKey)?s.expandedKeys.filter(key=>key!==itemKey):[...s.expandedKeys,itemKey]
      onChange()
    },
    async setCompleted(itemKey,completed){
      const snapshot=current(),actor=accountId
      if(snapshot.status!=='ready'||snapshot.savingKey||!canWrite()||snapshot.businessDate>getChecklistToday())return{ok:false}
      snapshot.savingKey=itemKey;snapshot.error='';onChange()
      const result=await setDailyChecklistItem({supabase:getSupabase(),...snapshot,itemKey,completed})
      if(!stillCurrent(snapshot,actor))return{ok:false,contextChanged:true}
      snapshot.savingKey=''
      if(result.ok)snapshot.items=[...snapshot.items.filter(item=>item.item_key!==itemKey),result.item]
      else snapshot.error=result.error
      onChange();return result
    },
  }
}
