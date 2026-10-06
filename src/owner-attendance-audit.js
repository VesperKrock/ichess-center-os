import {isAttendanceLedgerDate} from './attendance-ledger.js'

export const isOwnerAuditContext = context => context?.ok===true && context.role?.trim().toLowerCase()==='owner'
  && context.membershipStatus==='active' && Boolean(context.centerId&&context.accountId)
export const auditBusinessDate = time => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(time))
export function getOwnerAuditRange(period='30',now=new Date()) {
  if(period&&typeof period==='object'){
    const {scope,date}=period
    if(!['day','month','year'].includes(scope)||!isAttendanceLedgerDate(date)||Number(date.slice(0,4))<2000)throw Error('Invalid audit period')
    const year=Number(date.slice(0,4)),month=Number(date.slice(5,7))
    const from=scope==='year'?`${year}-01-01`:scope==='month'?`${date.slice(0,7)}-01`:date
    const endDate=new Date(`${from}T00:00:00Z`)
    if(scope==='year')endDate.setUTCFullYear(year+1)
    else if(scope==='month')endDate.setUTCMonth(month)
    else endDate.setUTCDate(endDate.getUTCDate()+1)
    return {start:Date.parse(from+'T00:00:00+07:00'),end:endDate.getTime()-7*3600000,years:[year]}
  }
  const days=['1','7','30'].includes(String(period))?Number(period):30,today=auditBusinessDate(now)
  const shift=days=>new Date(Date.parse(today+'T12:00:00Z')+days*86400000).toISOString().slice(0,10)
  const start=shift(1-days),end=shift(1)
  return {start:Date.parse(start+'T00:00:00+07:00'),end:Date.parse(end+'T00:00:00+07:00'),
    years:[...new Set([Number(today.slice(0,4)),Number(start.slice(0,4))])]}
}
export const defaultOwnerAuditPeriod=(now=new Date())=>({scope:'month',date:auditBusinessDate(now)})
export const ownerAuditPeriodLabel=({scope,date})=>scope==='day'?`Ngày ${date.split('-').reverse().join('/')}`
  :scope==='month'?`Tháng ${date.slice(5,7)}/${date.slice(0,4)}`:`Năm ${date.slice(0,4)}`
export function shiftOwnerAuditPeriod(period,direction){
  const date=new Date(`${period.date}T12:00:00Z`)
  if(period.scope==='day')date.setUTCDate(date.getUTCDate()+direction)
  else {date.setUTCDate(1);if(period.scope==='month')date.setUTCMonth(date.getUTCMonth()+direction);else date.setUTCFullYear(date.getUTCFullYear()+direction)}
  const next={...period,date:date.toISOString().slice(0,10)}
  getOwnerAuditRange(next);return next
}
export const formatOwnerAuditClock=time=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(time))
export const formatOwnerAuditTime = time => {
  const date=new Date(time)
  return `${new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date)} · ${auditBusinessDate(date).split('-').reverse().join('/')}`
}
const labels={present:'Có mặt',absent:'Vắng',makeup:'Học bù',unmarked:'Chưa điểm danh',trial:'Học thử',
 excused:'Vắng',excusedAbsent:'Vắng',unexcusedAbsent:'Vắng'}
export const auditStatusLabel = state => !state||state.deleted===true||state.current===false||!state.attendanceStatus
 ?labels.unmarked:labels[state.attendanceStatus]||'Trạng thái cũ chưa rõ'
const text=value=>String(value??'').trim()
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
export function resolveOwnerAuditActor(event,{centerId,profile,teachers=[],staffMembers=[]}={}) {
  if(event.center_id!==centerId)return 'Người dùng chưa rõ tên'
  const matches=[...teachers,...staffMembers].filter(p=>p.centerId===centerId&&p.accountUserId===event.actor_user_id)
  const names=[...new Set(matches.map(p=>text(p.fullName||p.displayName||p.name)).filter(Boolean))]
  if(names.length===1)return names[0]
  if(profile?.id===event.actor_user_id){
    const meta=profile.user_metadata||{}
    const name=text(meta.full_name||meta.display_name||meta.name||profile.email)
    if(name)return name
  }
  return event.actor_role==='owner'?'Owner · Chưa rõ tên':'Người dùng chưa rõ tên'
}
export function buildOwnerAuditGroups(events=[],projection={}) {
  const {centerId,students=[],classSessions=[],scheduleSessions=[]}=projection,batches=new Map()
  for(const event of events){
    if(event.center_id!==centerId||event.domain!=='ATTENDANCE')throw Error('Audit context mismatch')
    const batch=batches.get(event.audit_batch_id)||{id:event.audit_batch_id,actorId:event.actor_user_id,
      actor:resolveOwnerAuditActor(event,projection),timestamp:event.created_at,lastEventId:event.id,cells:new Map()}
    if(batch.actorId!==event.actor_user_id)throw Error('Audit actor mismatch')
    if(Date.parse(event.created_at)>Date.parse(batch.timestamp))batch.timestamp=event.created_at
    batch.lastEventId=Math.max(batch.lastEventId,event.id)
    const key=JSON.stringify([event.student_local_id,event.schedule_session_local_id,event.occurrence_date])
    const student=students.find(s=>s.id===event.student_local_id&&s.centerId===centerId)
    const schedule=scheduleSessions.find(s=>s.id===event.schedule_session_local_id&&s.centerId===centerId)
    const ca=classSessions.find(c=>c.id===schedule?.classSessionId&&c.centerId===centerId)
    const previous=batch.cells.get(key)
    const cell={key,student:text(student?.fullName)||'Học viên chưa rõ tên',date:event.occurrence_date,
      ca:text(ca?.name||ca?.displayLabel),before:event.before_state,after:event.after_state,
      reasonBefore:text(event.absence_reason_before),reasonAfter:text(event.absence_reason_after),ordinal:event.batch_ordinal,
      firstOrdinal:event.batch_ordinal,lastOrdinal:event.batch_ordinal}
    if(previous){
      // A cell remains one counted change, even if a historical batch includes
      // multiple property events. Corrections in other batches stay separate.
      if(previous.firstOrdinal<cell.ordinal){cell.before=previous.before;cell.reasonBefore=previous.reasonBefore;cell.firstOrdinal=previous.firstOrdinal}
      if(previous.lastOrdinal>cell.ordinal){cell.after=previous.after;cell.reasonAfter=previous.reasonAfter;cell.lastOrdinal=previous.lastOrdinal}
      cell.ordinal=cell.firstOrdinal
    }
    batch.cells.set(key,cell);batches.set(batch.id,batch)
  }
  return [...batches.values()].map(batch=>({...batch,cells:[...batch.cells.values()].sort((a,b)=>a.ordinal-b.ordinal)}))
    .sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)||b.lastEventId-a.lastEventId)
}
export function filterOwnerAuditGroups(groups,{actorId='all',query=''}={}) {
  const needle=text(query).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase()
  return groups.filter(group=>(actorId==='all'||group.actorId===actorId)&&(!needle||group.cells.some(cell=>
    cell.student.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().includes(needle))))
}
export function ownerAuditActorOptions(groups,events,projection={}) {
  const roles={owner:'Owner',admin:'Admin',center_admin:'Admin'}
  const actors=[...new Map(groups.map(group=>[group.actorId,group.actor])).entries()].map(([id,name])=>{
    const recordedRoles=[...new Set(events.filter(event=>event.center_id===projection.centerId&&event.actor_user_id===id)
      .map(event=>text(event.actor_role).toLowerCase()))]
    const role=recordedRoles.length===1?roles[recordedRoles[0]]:''
    const knownName=!['Owner · Chưa rõ tên','Người dùng chưa rõ tên'].includes(name)?name:''
    return {id,name:knownName,label:role||knownName||'Người dùng'}
  })
  // Labels are presentation only: distinct canonical actors always remain
  // distinct options, including actors without a trusted profile name.
  for(const actor of actors){
    if(actors.filter(other=>other.label===actor.label).length>1&&actor.name)actor.display=`${actor.label} · ${actor.name}`
    else actor.display=actor.label
  }
  const ordered=[...actors].sort((a,b)=>a.id.localeCompare(b.id))
  return actors.map(actor=>{
    const peers=ordered.filter(other=>other.display===actor.display)
    return {id:actor.id,label:peers.length>1?`${actor.display} · Người dùng ${peers.indexOf(actor)+1}`:actor.display}
  })
}
export function renderOwnerAttendanceAudit(state,projection={},allowed=false) {
  if(!allowed)return ''
  const groups=buildOwnerAuditGroups(state.events,projection),visible=filterOwnerAuditGroups(groups,state.filters)
  const actors=ownerAuditActorOptions(groups,state.events,projection)
  const period=state.filters.scope?state.filters:defaultOwnerAuditPeriod(),scopeLabel={day:'Ngày',month:'Tháng',year:'Năm'}[period.scope]
  let lastDay='',lastMonth=''
  return `<section class="owner-audit" aria-label="Nhật ký thay đổi">
    <header class="owner-audit-heading"><p>Bảng điểm danh</p></header>
    <div class="owner-audit-toolbar">
      <div class="owner-audit-scopes" role="group" aria-label="Phạm vi nhật ký">${[['day','Ngày'],['month','Tháng'],['year','Năm']].map(([value,label])=>`<button type="button" data-owner-audit-scope="${value}" aria-pressed="${period.scope===value}">${label}</button>`).join('')}</div>
      <div class="owner-audit-navigation" role="group" aria-label="Chọn kỳ nhật ký">
      <button type="button" data-owner-audit-step="-1">‹ ${scopeLabel} trước</button>
      <label class="owner-audit-period"><span>${ownerAuditPeriodLabel(period).replace(/^(Ngày |Năm )/,'')}</span>
        <input aria-label="Chọn ${scopeLabel.toLowerCase()}" data-owner-audit-date type="${period.scope==='day'?'date':period.scope==='month'?'month':'number'}" value="${period.scope==='day'?period.date:period.scope==='month'?period.date.slice(0,7):period.date.slice(0,4)}" ${period.scope==='year'?'min="2000" max="9999"':'min="2000-01'+(period.scope==='day'?'-01':'')+'" max="9999-12'+(period.scope==='day'?'-31':'')+'"'}>
      </label>
      <button type="button" data-owner-audit-step="1">${scopeLabel} sau ›</button>
      </div>
      <label class="owner-audit-actor-filter">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M3 21v-2a9 9 0 0 1 18 0v2Z"/></svg>
        <select aria-label="Người thay đổi" title="${escape(actors.find(actor=>actor.id===state.filters.actorId)?.label||'Tất cả người dùng')}" data-owner-audit-filter="actorId"><option value="all">Tất cả người dùng</option>${actors.map(({id,label})=>`<option value="${escape(id)}" ${state.filters.actorId===id?'selected':''}>${escape(label)}</option>`).join('')}</select>
      </label>
      <label class="owner-audit-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg>
        <input type="search" aria-label="Tìm học viên trong nhật ký đã tải" data-owner-audit-filter="query" value="${escape(state.filters.query)}" placeholder="Tìm học viên...">
      </label>
      <button type="button" data-owner-audit-refresh ${state.loading?'disabled':''}>Làm mới</button>
      <details class="owner-audit-export" ${state.exportMenuOpen?'open':''}><summary data-owner-audit-export-menu>In / Xuất PDF ▾</summary><button type="button" data-owner-audit-export ${state.loading||state.exporting?'disabled':''}>Xuất PDF ${scopeLabel.toLowerCase()}</button></details>
    </div>
    ${state.error?`<p class="owner-audit-message" role="status">${escape(state.error)}</p>`:''}
    ${state.loading?'<p class="owner-audit-message" role="status">Đang tải nhật ký…</p>':''}
    ${state.exporting?`<p class="owner-audit-message" role="status">Đang tạo PDF · ${state.exportedBatches||0} lượt lưu đã tải…</p>`:''}
    <div class="owner-audit-list">${visible.map(group=>{
      const expanded=state.expanded.includes(group.id)
      const day=auditBusinessDate(group.timestamp),month=day.slice(0,7)
      const monthHeading=period.scope==='year'&&month!==lastMonth?`<h5 class="owner-audit-month">Tháng ${month.slice(5)}/${month.slice(0,4)}</h5>`:''
      const dayHeading=period.scope!=='day'&&day!==lastDay?`<h6 class="owner-audit-day">${day.split('-').reverse().join('/')}</h6>`:''
      lastDay=day;lastMonth=month
      return `${monthHeading}${dayHeading}<article class="owner-audit-batch" data-owner-audit-batch="${escape(group.id)}">
        <button type="button" class="owner-audit-summary" data-owner-audit-expand="${escape(group.id)}" aria-expanded="${expanded}" aria-controls="audit-detail-${escape(group.id)}">
          <span class="owner-audit-actor">${escape(group.actor)}</span><span class="owner-audit-count">Đã sửa ${group.cells.length} ô điểm danh</span>
          <time datetime="${escape(group.timestamp)}">${formatOwnerAuditClock(group.timestamp)}</time><span class="owner-audit-chevron" aria-hidden="true">${expanded?'⌄':'›'}</span>
        </button>
        <div class="owner-audit-detail" id="audit-detail-${escape(group.id)}" ${expanded?'':'hidden'}>${expanded?group.cells.map(cell=>{
          const date=isAttendanceLedgerDate(cell.date)?cell.date.slice(5).split('-').reverse().join('/'):'Chưa rõ ngày'
          return `<div class="owner-audit-cell"><strong>${escape(cell.student)} · ${date}${cell.ca?` <span>· ${escape(cell.ca)}</span>`:''}</strong>
            <p>${auditStatusLabel(cell.before)} → ${auditStatusLabel(cell.after)}</p>
            ${cell.reasonBefore!==cell.reasonAfter?`<p class="owner-audit-reason">Lý do: ${escape(cell.reasonBefore||'—')} → ${escape(cell.reasonAfter||'—')}</p>`:''}</div>`
        }).join(''):''}</div></article>`
    }).join('')}</div>
    ${!visible.length&&!state.loading&&!state.error?`<p class="owner-audit-message">${groups.length?'Không có thay đổi phù hợp với bộ lọc.':'Chưa có thay đổi nào được ghi nhận.'}</p>`:''}
    ${state.hasMore?`<button type="button" class="owner-audit-more" data-owner-audit-more ${state.loading?'disabled':''}>Tải thêm</button>`:''}
    ${groups.length?`<p class="owner-audit-footnote">${visible.length===groups.length?`${groups.length} lượt lưu đã tải`:`${visible.length} lượt lưu phù hợp · ${groups.length} lượt lưu đã tải`}${state.filters.query?' · Tìm trong học viên của các lượt lưu đã tải':''}</p>`:''}
  </section>`
}
