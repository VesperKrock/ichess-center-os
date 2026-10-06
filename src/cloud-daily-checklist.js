import {isAttendanceLedgerDate} from './attendance-ledger.js'
import {getDailyChecklistTemplate} from './report-daily-checklist.js'

function validItem(item,context) {
  return item?.center_id===context.centerId && item.business_date===context.businessDate
    && item.template_key===context.templateKey && getDailyChecklistTemplate(context.templateKey)?.items.some(row=>row.key===item.item_key)
    && typeof item.completed==='boolean' && Boolean(item.updated_by) && Number.isFinite(Date.parse(item.updated_at))
    && (item.completed ? Boolean(item.completed_by) && typeof item.completed_by_name==='string' && Number.isFinite(Date.parse(item.completed_at))
      : item.completed_by===null && item.completed_at===null && item.completed_by_name===null)
}
const validContext = context => Boolean(context.centerId) && isAttendanceLedgerDate(context.businessDate)
  && Boolean(getDailyChecklistTemplate(context.templateKey))
const validResult = (data,context) => data?.ok===true && data.center_id===context.centerId
  && data.business_date===context.businessDate && data.template_key===context.templateKey

export async function pullDailyChecklist({supabase,...context}) {
  if(!supabase?.rpc||!validContext(context))return{ok:false,error:'Chưa xác định được checklist.'}
  try {
    const {data,error}=await supabase.rpc('n6_1_list_daily_checklist',{p_center_id:context.centerId,
      p_business_date:context.businessDate,p_template_key:context.templateKey})
    if(error||!validResult(data,context)||!Array.isArray(data.items)||data.items.some(item=>!validItem(item,context))
      ||new Set(data.items.map(item=>item.item_key)).size!==data.items.length)throw Error('invalid')
    return{ok:true,items:data.items}
  }catch{return{ok:false,error:'Chưa tải được checklist. Vui lòng làm mới.'}}
}

export async function setDailyChecklistItem({supabase,itemKey,completed,...context}) {
  if(!supabase?.rpc||!validContext(context)||typeof completed!=='boolean'
    ||!getDailyChecklistTemplate(context.templateKey).items.some(item=>item.key===itemKey))return{ok:false,error:'Mục checklist chưa hợp lệ.'}
  try {
    const {data,error}=await supabase.rpc('n6_1_set_daily_checklist_item',{p_center_id:context.centerId,
      p_business_date:context.businessDate,p_template_key:context.templateKey,p_item_key:itemKey,p_completed:completed})
    if(error||!validResult(data,context)||!validItem(data.item,context)||data.item.item_key!==itemKey||data.item.completed!==completed)throw Error('invalid')
    return{ok:true,item:data.item}
  }catch{return{ok:false,error:'Chưa xác nhận được thay đổi. Làm mới để kiểm tra rồi thử lại.'}}
}
