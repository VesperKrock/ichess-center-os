import { isAttendanceLedgerDate } from './attendance-ledger.js'

// Hải's reference rows. Timelines and descriptive bullets are guidance only.
export const DAILY_CHECKLIST_TEMPLATES = Object.freeze([
  { key:'tvv-parttime-v1', label:'TVV Part-time', items:[
    { key:'pt-01', timeline:'16:00', title:'Khởi động & rà soát, phản hồi', details:[
      'Chuẩn bị không gian tiếp đón PHHV: đảm bảo bàn tư vấn gọn gàng, ngăn nắp, form mẫu, salekit đầy đủ, bảng giá ở trạng thái sẵn sàng.',
      'Quản trị Data tiềm năng: kiểm tra danh sách khách hàng cần gọi lại (follow-up) và danh sách học viên đăng ký học thử trong ngày.',
      'Rà soát Công nợ: lọc danh sách phụ huynh đến hạn đóng phí hoặc đang nợ học phí để đảm bảo note nhắc nhở tại bàn lễ tân.' ] },
    { key:'pt-02', timeline:'16:00–16:30', title:'Rà soát – phản hồi – thông báo', details:[
      'Check và phản hồi thông tin từ PHHV trên các máy hotline / máy hỗ trợ công việc đang đảm nhiệm.',
      'Cập nhật nhanh các thông tin quan trọng đến phòng ban có liên quan.', 'Liên hệ nhắc lịch học viên học thử.' ] },
    { key:'pt-03', timeline:'16:30–18:00', title:'Công tác vận hành', details:[
      'Đón học viên.', 'Thông báo điểm danh.', 'Trả học viên / giao ca.' ] },
    { key:'pt-04', timeline:'18:00–19:30', title:'Xử lý Data – Thúc đẩy doanh thu', details:[
      'Đón học viên / thông báo điểm danh.', 'Gọi Telesale tối thiểu 15 cuộc.',
      'Chăm sóc, kết nối liên hệ lại với các số đã kết bạn Zalo.', 'Đăng bài trên kênh Zalo / Facebook theo quy trình vận hành hiện tại.' ] },
    { key:'pt-05', timeline:'19:30–20:00', title:'Đóng ca – Xác nhận nhập liệu', details:[
      'Trả học viên cuối ngày.', 'Đảm bảo nhập liệu chính xác, đầy đủ doanh thu phát sinh trong ngày vào hệ thống quản lý.',
      'Ghi chú các vấn đề tồn đọng cần xử lý.' ] },
  ] },
  { key:'tvv-fulltime-v1', label:'TVV Full-time', items:[
    { key:'ft-01', timeline:'13:30–14:00', title:'Khởi động & rà soát, phản hồi', details:[
      'Chuẩn bị không gian / khu vực bàn tư vấn.', 'Kiểm tra danh sách khách hàng cần follow-up và học viên đăng ký học thử.',
      'Rà soát công nợ / phụ huynh đến hạn đóng phí hoặc đang nợ học phí.' ] },
    { key:'ft-02', timeline:'14:00–14:30', title:'Rà soát tin nhắn & thông báo', details:[
      'Check và phản hồi tin nhắn PH trên Hotline / CSKH.', 'Gửi nhắc lịch học thử theo danh sách đã cập nhật.',
      'Gửi thông báo học phí / tái phí / lịch học bù nếu có.' ] },
    { key:'ft-03', timeline:'14:30–15:00', title:'Xử lý Data – Thúc đẩy doanh thu', details:[
      'Gửi tin, hình ảnh, bài đăng cơ sở vào nhóm cộng đồng PH / khu vực.', 'Đăng bài trên kênh Zalo tư vấn theo quy trình hiện tại.' ] },
    { key:'ft-04', timeline:'15:00–15:30', title:'Xử lý Data – Thúc đẩy doanh thu', details:[
      'Gọi Telesale tối thiểu 15 cuộc.', 'Chăm sóc, kết nối lại với các số liên hệ đã kết bạn Zalo.' ] },
    { key:'ft-05', timeline:'15:45–16:00', title:'Chuẩn bị đón PHHV', details:[
      'Chuẩn bị không gian tiếp đón.', 'Đảm bảo bàn tư vấn gọn gàng.', 'Form mẫu / salekit / bảng giá sẵn sàng.' ] },
    { key:'ft-06', timeline:'16:00–17:30', title:'Công tác hỗ trợ vận hành', details:[
      'Chuẩn bị đón học viên.', 'Thông báo điểm danh.', 'Trả học viên / giao ca.' ] },
    { key:'ft-07', timeline:'18:00–18:30', title:'Giờ nghỉ chiều', details:[ 'Nghỉ 30 phút dành cho TVV Full-time.' ] },
    { key:'ft-08', timeline:'18:30–19:00', title:'Công tác hỗ trợ vận hành', details:[ 'Chuẩn bị đón và trả học viên / giao ca.' ] },
    { key:'ft-09', timeline:'19:15–20:15', title:'Xử lý Data – Thúc đẩy doanh thu', details:[
      'Gọi Telesale tối thiểu 15 cuộc.', 'Chăm sóc, kết nối lại với các số liên hệ đã kết bạn Zalo.',
      'Đăng bài trên kênh Facebook theo quy trình hiện tại.' ] },
    { key:'ft-10', timeline:'20:30', title:'Đóng ca – Xác nhận nhập liệu', details:[
      'Chuẩn bị đón / trả học viên cuối ngày.', 'Đảm bảo nhập liệu chính xác, đầy đủ doanh thu phát sinh trong ngày vào hệ thống quản lý.',
      'Ghi chú các vấn đề tồn đọng cần xử lý.' ] },
  ] },
])

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
export const getChecklistToday = (now = new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(now)
export const getDailyChecklistTemplate = key => DAILY_CHECKLIST_TEMPLATES.find(t=>t.key===key)
export const shiftChecklistDate = (date,days) => isAttendanceLedgerDate(date)
  ? new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10) : getChecklistToday()
export const createDailyChecklistState = (centerId='',now=new Date()) => ({centerId,businessDate:getChecklistToday(now),
  templateKey:DAILY_CHECKLIST_TEMPLATES[0].key,status:'idle',items:[],savingKey:'',error:'',expandedKeys:[]})

export function renderReportWorkspace({mode='overview',body=''}) {
  return `<div class="report-workspace" data-report-workspace-mode="${mode}">
    <nav class="report-workspace-tabs" aria-label="Chọn nội dung Báo cáo">
      ${[['overview','Tổng quan'],['checklist','Checklist']].map(([key,label])=>`<button type="button" data-report-workspace-mode="${key}" aria-pressed="${mode===key}" class="${mode===key?'is-active':''}">${label}</button>`).join('')}
    </nav>${body}</div>`
}

export function renderDailyChecklist(state, {canWrite=false,now=new Date()}={}) {
  const template=getDailyChecklistTemplate(state.templateKey),today=getChecklistToday(now)
  const ready=state.status==='ready',future=state.businessDate>today,locked=!ready||!canWrite||future||Boolean(state.savingKey)
  const items=new Map(state.items.map(item=>[item.item_key,item]))
  const count=template.items.filter(row=>items.get(row.key)?.completed===true).length
  const dateLabel=state.businessDate.split('-').reverse().join('/')
  const loading=state.status==='loading'||state.status==='idle'
  return `<section class="report-module report-daily-checklist" aria-label="Checklist công việc ngày" data-checklist-date="${escape(state.businessDate)}" data-checklist-template="${template.key}">
    <header class="checklist-header"><div class="checklist-date-nav">
      <button type="button" data-checklist-day-step="-1" ${state.savingKey?'disabled':''}>‹ Ngày trước</button>
      <button type="button" data-checklist-today ${state.savingKey?'disabled':''}>${state.businessDate===today?'Hôm nay · '+dateLabel:'Hôm nay'}</button>
      <button type="button" data-checklist-day-step="1" ${state.savingKey?'disabled':''}>Ngày sau ›</button>
      <input type="date" aria-label="Ngày checklist" data-checklist-date-picker value="${escape(state.businessDate)}" ${state.savingKey?'disabled':''}>
    </div><div class="checklist-tools"><select aria-label="Chọn checklist TVV" data-checklist-template-picker ${state.savingKey?'disabled':''}>
      ${DAILY_CHECKLIST_TEMPLATES.map(t=>`<option value="${t.key}" ${t.key===template.key?'selected':''}>${t.label}</option>`).join('')}
    </select><button type="button" data-checklist-refresh ${loading||state.savingKey?'disabled':''}>Làm mới</button></div></header>
    <div class="checklist-summary"><div><h3>Checklist ${template.label}</h3><p>${dateLabel}</p></div>
      <span data-checklist-completion-count aria-live="polite">${ready?`${count}/${template.items.length} hoàn thành`:'Đang tải…'}</span></div>
    ${state.error?`<p class="checklist-message" role="status">${escape(state.error)}</p>`:''}
    ${future?'<p class="checklist-message">Checklist ngày sắp tới chỉ để xem.</p>':''}
    <div class="checklist-rows" data-report-scroll-region="daily-checklist">
      ${template.items.map(row=>{
        const item=items.get(row.key),completed=item?.completed===true,expanded=state.expandedKeys.includes(row.key)
        const when=completed?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(item.completed_at)):''
        return `<article class="checklist-row ${completed?'is-completed':''}" data-checklist-row="${row.key}">
          <div class="checklist-row-line"><input type="checkbox" data-checklist-item="${row.key}" aria-label="Hoàn thành: ${escape(row.title)} (${row.timeline})" ${completed?'checked':''} ${locked?'disabled':''}>
            <button type="button" class="checklist-row-expand" data-checklist-expand="${row.key}" aria-expanded="${expanded}" aria-controls="checklist-detail-${row.key}">
              <span class="checklist-timeline">${row.timeline}</span><strong>${escape(row.title)}</strong><span class="checklist-chevron" aria-hidden="true">${expanded?'⌃':'⌄'}</span>
            </button>${state.savingKey===row.key?'<span class="checklist-saving" role="status">Đang lưu…</span>':''}</div>
          <div class="checklist-row-detail" id="checklist-detail-${row.key}" ${expanded?'':'hidden'}>
            <ul>${row.details.map(detail=>`<li>${escape(detail)}</li>`).join('')}</ul>
            ${completed?`<p class="checklist-completed-by">Hoàn thành bởi: ${escape(item.completed_by_name || 'Người dùng')} · ${escape(when)}</p>`:''}
          </div></article>`
      }).join('')}
    </div></section>`
}
