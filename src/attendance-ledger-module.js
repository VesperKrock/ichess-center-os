import { ATTENDANCE_LEDGER_STATES, buildCanonicalAttendanceLedger, getAttendanceLedgerMonthRange } from './attendance-ledger.js'
import { attendanceDraftCellKey, attendanceDraftCount, attendanceCellDraftValue, canEditAttendanceCell } from './attendance-board-editor.js'
import { currentClassMainTeacher } from './cloud-makeup-bookings.js'
import { bindAttendanceBoardToolbar } from './attendance-board-toolbar.js'

let toolbarRenderId = 0
const monthNames = ['Một', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Mười Một', 'Mười Hai']

const html = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const dateLabel = date => date ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : 'Chưa cập nhật'
const timeLabel = occurrence => occurrence.startTime ? `${occurrence.startTime}${occurrence.endTime ? `–${occurrence.endTime}` : ''}` : 'Chưa có giờ lịch sử'
const teacherLabel = occurrence => `${occurrence.teacherName || 'Chưa có giáo viên lịch sử'}${occurrence.isSubstitute ? ' · Dạy thay' : ''}`
const occurrenceState = occurrence => occurrence.lifecycleState === 'CANCELLED' ? 'Đã hủy' : occurrence.lifecycleState === 'HELD' ? 'Đã diễn ra' : 'Theo lịch'
const contextLabel = occurrence => `${dateLabel(occurrence.date)} · ${timeLabel(occurrence)} · ${occurrence.classLabel} · ${teacherLabel(occurrence)}`
const field = (label, value) => `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>`
const route = occurrence => `<button type="button" data-attendance-open-occurrence data-schedule-session-id="${html(occurrence.scheduleSessionId)}" data-occurrence-date="${html(occurrence.date)}">Mở ca học</button>`

export function renderCanonicalAttendanceLedgerModule({ students = [], classSessions = [], filters = {}, detailState = null,
  notificationReview = null, availability = {}, onModel = null, draft = null } = {}) {
  const context = availability.ledgerContext || {}
  const ready = availability.attendanceAvailable === true && context.status === 'ready'
  const model = buildCanonicalAttendanceLedger({
    students, classSessions, filters: {...filters, ...getAttendanceLedgerMonthRange(filters.month || filters.fromDate?.slice(0, 7))},
    scheduleSessions: availability.scheduleSessions || [],
    occurrences: ready ? context.occurrences : [],
    plannedOccurrences: ready ? availability.plannedOccurrences || [] : [],
    attendanceRecords: ready ? availability.attendanceRecords || [] : [],
    makeupBookings: ready ? context.makeupBookings || [] : [],
    packageCycleStudentStates: availability.packageCycleStudentStates || [],
    packageCycleReady: availability.tuitionAvailable === true && availability.packageCycleReady === true,
    now: availability.now || new Date(),
    monthlyProjection: true,
  })
  const exportReady = ready && !model.filters.error && model.columns.length > 0 && model.rows.length > 0
  // Pass the exact matrix rendered below, including the applied filters. PDF
  // export never reconstructs attendance from DOM marks or another read source.
  onModel?.(model, exportReady)
  const selected = model.filters
  const classOptions = [...new Map([
    ...classSessions.map(item => [String(item.id), item.displayLabel || item.name || 'Lớp học']),
    ...model.columns.filter(item => item.classSessionId).map(item => [item.classSessionId, item.classLabel]),
  ]).entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'))
  const options = (items, selectedId, missingLabel) => [
    ...items,
    ...(selectedId !== 'all' && !items.some(([id]) => id === selectedId) ? [[selectedId, missingLabel]] : []),
  ].map(([id, name]) => `<option value="${html(id)}" ${selectedId === id ? 'selected' : ''}>${html(name)}</option>`).join('')
  const message = selected.error || (!ready ? context.status === 'loading'
    ? 'Đang tải các buổi học…' : 'Chưa tải được dữ liệu điểm danh. Vui lòng bấm Làm mới.' : '')
  const dirtyCount = attendanceDraftCount(draft)
  const month = selected.fromDate.slice(0, 7)
  const monthLabel = `Tháng ${monthNames[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`
  const selectedClass = classOptions.find(([id]) => id === selected.classSessionId)?.[1] || 'Tất cả ca học'
  const mainTeacher = currentClassMainTeacher(context.assignments, selected.classSessionId, availability.now)
  const times = [...new Set(model.columns.map(item => timeLabel(item)))]
  const writeReady = ready && availability.canWrite === true
  const renderId = ++toolbarRenderId
  const access = { canWrite: writeReady, saving: draft?.saving, uncertain: draft?.uncertain, now: availability.now }
  // Attendance-only enhancement: keep the already-verified shared N5 runtime
  // byte-identical. Bind after the app installs this exact rendered section.
  if (typeof document !== 'undefined') queueMicrotask(() => bindAttendanceBoardToolbar(
    document.querySelector(`[data-attendance-toolbar-render="${renderId}"]`), {
      draft, model, exportReady,
      exportContext: { centerName: availability.centerName, classLabel: selectedClass, mainTeacher,
        teacherLabel: model.teacherOptions.find(item => item.id === selected.teacherId)?.name
          || (selected.teacherId === 'all' ? 'Tất cả giáo viên' : 'Giáo viên đã chọn') },
      renderCanonicalMatrix: () => renderMatrix(model, null, access),
    }))
  return `<section class="attendance-board-module attendance-ledger" aria-label="Bảng điểm danh" data-attendance-toolbar-render="${renderId}" data-attendance-overdue-unmarked-count="${model.overdueUnmarkedCount}">
    <header class="attendance-board-heading">
      <div class="attendance-board-heading-copy"><h3>Bảng điểm danh</h3></div>
      <p class="attendance-ledger-context"><span data-attendance-main-teacher>Giáo viên chính: ${html(mainTeacher)}</span>${times.length === 1 ? ` · ${html(times[0])}` : ''}</p>
    </header>
    <div class="attendance-board-toolbar" aria-label="Bộ lọc bảng điểm danh">
      <button type="button" data-attendance-month-step="-1">‹ Tháng trước</button>
      <label class="attendance-ledger-month-control"><span>${html(monthLabel)}</span><input type="month" data-attendance-board-filter="month" value="${html(month)}" aria-label="${html(`Chọn tháng · ${monthLabel}`)}"></label>
      <button type="button" data-attendance-month-step="1">Tháng sau ›</button>
      <select data-attendance-board-filter="classSessionId" aria-label="Ca học"><option value="all">Tất cả ca học</option>${options(classOptions, selected.classSessionId, 'Ca đã chọn')}</select>
      <select data-attendance-board-filter="teacherId" aria-label="Giáo viên"><option value="all">Tất cả giáo viên</option>${options(model.teacherOptions.map(item => [item.id, item.name]), selected.teacherId, 'Giáo viên đã chọn')}</select>
      <label class="attendance-ledger-search"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input type="search" data-attendance-board-filter="query" value="${html(selected.query)}" placeholder="Tên, mã học viên, phụ huynh..." aria-label="Tìm tên, mã học viên, phụ huynh"></label>
      ${availability.canWrite === true ? `<button type="button" class="attendance-ledger-save" data-attendance-save ${writeReady && dirtyCount && !draft?.saving ? '' : 'disabled'} ${draft?.saving ? 'aria-busy="true"' : ''}>${draft?.saving ? 'Đang lưu…' : 'Lưu điểm danh'}</button>
      <button type="button" data-attendance-discard ${dirtyCount && !draft?.saving && !draft?.uncertain && !draft?.bookingAttempt ? '' : 'disabled'}>Hủy thay đổi</button>` : '<span class="attendance-ledger-readonly">Chỉ xem</span>'}
    </div>
    <div class="attendance-ledger-meta">
    <div class="attendance-ledger-legend" aria-label="Chú giải điểm danh">${Object.entries(ATTENDANCE_LEDGER_STATES).filter(([state]) => ['present', 'absent', 'makeup', 'unmarked'].includes(state) || ['cancelled', 'historicalTrial'].includes(state) && model.rows.some(row => row.cells.some(cell => cell.state === state)))
      .map(([state, item]) => `<span><b class="attendance-ledger-mark is-${state}">${html(item.mark)}</b>${html(item.label)}</span>`).join('')}
    </div>
    <span class="attendance-ledger-save-message ${draft?.error ? 'is-error' : ''}" role="status" aria-live="polite">${html(draft?.error || draft?.message || (dirtyCount ? `${dirtyCount} thay đổi` : ''))}</span>
    <div class="attendance-ledger-export-count"><details class="attendance-ledger-export" data-attendance-export-menu><summary aria-label="In hoặc xuất bảng điểm danh" ${exportReady ? '' : 'aria-disabled="true"'}>In / Xuất <span aria-hidden="true">▾</span></summary>
      <div class="attendance-ledger-export-options"><button type="button" data-attendance-export-pdf ${exportReady ? '' : 'disabled'}>In / Xuất PDF</button><button type="button" data-attendance-export-xlsx ${exportReady ? '' : 'disabled'}>Xuất Excel (.xlsx)</button></div></details>
      <span>${model.rows.length} học viên · ${model.columns.length} buổi</span></div>
    </div>
    ${message ? `<p class="attendance-board-empty" role="status">${html(message)}</p>`
      : !model.columns.length ? '<p class="attendance-board-empty">Không có buổi học trong khoảng thời gian này.</p>'
        : !model.rows.length ? '<p class="attendance-board-empty">Không có học viên phù hợp với bộ lọc.</p>' : renderMatrix(model, draft, { canWrite: writeReady, saving: draft?.saving, uncertain: draft?.uncertain, now: availability.now })}
    ${ready && model.columns.some(item => item.partialHistoricalRoster) ? '<p class="attendance-ledger-history-note">Một số buổi cũ chỉ có danh sách học viên đã được ghi nhận trong lịch sử.</p>' : ''}
    ${ready ? renderHistoricalOpeningEvidence(availability.historicalBaselineRecords || [], students) : ''}
    ${ready ? renderDetail(detailState, model, draft, { canWrite: writeReady, saving: draft?.saving, uncertain: draft?.uncertain, now: availability.now }) : ''}
    ${notificationReview ? `<div class="attendance-ledger-detail-overlay" data-attendance-detail-close>
      <section class="attendance-ledger-detail attendance-ledger-notification-context" role="dialog" aria-modal="true" aria-label="Chi tiết nhắc nhận xét" tabindex="-1">
        <header><h4>Cần cập nhật nhận xét</h4><button type="button" data-attendance-detail-close aria-label="Đóng chi tiết">×</button></header>
        <dl>${field('Học viên', notificationReview.studentName)}${field('Kỳ học', `Kỳ ${notificationReview.cycleNumber}`)}
          ${field('Ngày nhắc', dateLabel(notificationReview.triggerDate))}</dl>
        <p>Kiểm tra đúng học viên và kỳ học trước khi cập nhật nhận xét.</p>
        <footer><button type="button" data-attendance-detail-close>Đóng chi tiết</button>
          <button type="button" data-attendance-review-workflow-open>Mở cập nhật nhận xét</button></footer>
      </section></div>` : ''}
  </section>`
}

function renderHistoricalOpeningEvidence(records, students) {
  if (!records.length) return ''
  const studentById = new Map(students.map(student => [student.id, student]))
  const ordered = [...records].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)))
  return `<details class="attendance-ledger-history"><summary>Dữ liệu điểm danh ban đầu · Chỉ xem</summary>
    <p>Chứng cứ lịch sử được lưu riêng. Thiết lập số buổi ban đầu tại Học phí.</p>
    <table><caption class="sr-only">Chứng cứ điểm danh ban đầu đã lưu</caption><thead><tr><th>Học viên</th><th>Ngày đã lưu</th><th>Ghi nhận đã lưu</th></tr></thead><tbody>
      ${ordered.map(record => `<tr><td>${html(studentById.get(record.studentId)?.fullName || 'Học viên lịch sử')}</td><td>${html(dateLabel(record.date))}</td><td>${html(record.displayValue || record.creditLabel || record.creditNumber || '—')}</td></tr>`).join('')}
    </tbody></table></details>`
}

function renderMatrix(model, draft, access) {
  const weekday = date => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(`${date}T12:00:00Z`).getUTCDay()]
  const year = student => {
    const value = String(student.birthYear || student.birthDate || student.dateOfBirth || '')
    return /^\d{4}(?:-|$)/.test(value) ? value.slice(0, 4) : '—'
  }
  return `<div class="attendance-board-sheet-wrap attendance-ledger-scroll" tabindex="0" aria-label="Bảng điểm danh theo tháng">
    <table class="attendance-board-sheet attendance-ledger-sheet${model.columns.length > 12 ? ' is-dense-month' : ''}" style="--attendance-date-columns:${model.columns.length}"><caption class="sr-only">Học viên theo từng buổi học</caption>
      <colgroup><col class="attendance-grid-index"><col class="attendance-grid-student"><col class="attendance-grid-year"><col class="attendance-grid-package"><col class="attendance-grid-level">
        ${model.columns.map(() => '<col class="attendance-grid-date">').join('')}<col class="attendance-grid-progress"></colgroup>
      <thead><tr><th scope="col" class="attendance-ledger-index">STT</th><th scope="col" class="attendance-ledger-student">Họ và tên</th>
        <th scope="col" class="attendance-ledger-year">Năm sinh</th><th scope="col" class="attendance-ledger-package">Gói/Buổi</th><th scope="col" class="attendance-ledger-level">Level</th>
        ${model.columns.map(occurrence => `<th scope="col" class="attendance-ledger-column" data-attendance-occurrence-key="${html(occurrence.key)}">
          <button type="button" data-attendance-occurrence-detail data-schedule-session-id="${html(occurrence.scheduleSessionId)}" data-occurrence-date="${html(occurrence.date)}"
            title="${html(`${contextLabel(occurrence)} · ${occurrenceState(occurrence)}`)}"><small>${weekday(occurrence.date)}</small><strong>${html(dateLabel(occurrence.date).slice(0, 5))}</strong><small>${html(occurrence.startTime || '—')}</small></button>
        </th>`).join('')}<th scope="col" class="attendance-ledger-progress">Tiến độ / còn lại</th></tr></thead>
      <tbody>${model.rows.map((row, index) => `<tr data-attendance-ledger-student="${html(row.student.id)}">
        <td class="attendance-ledger-index">${index + 1}</td>
        <th scope="row" class="attendance-ledger-student"><strong>${html(row.student.fullName)}${row.cells.some(c => c.makeupOnly) ? ' <span class="attendance-ledger-makeup-context">Bù</span>' : ''}</strong><small>${html(row.student.studentCode || '')}</small></th>
        <td class="attendance-ledger-year">${html(year(row.student))}</td><td class="attendance-ledger-package" title="${html(row.tuition.packageLabel)}">${row.tuition.hasKnownPackage ? `${row.tuition.totalSessions} buổi` : '—'}</td>
        <td class="attendance-ledger-level">${html(typeof row.student.level === 'string' ? row.student.level : '—')}</td>
        ${row.cells.map(cell => {
          const change = draft?.changes?.[attendanceDraftCellKey(row.student.id, cell.occurrence)]
          const value = attendanceCellDraftValue(draft, row.student.id, cell)
          const state = change ? value.status || cell.unmarkedState : cell.state
          const mark = change ? ATTENDANCE_LEDGER_STATES[state].mark : cell.mark
          const label = change ? ATTENDANCE_LEDGER_STATES[state].label : cell.label
          const editable = canEditAttendanceCell(cell, access)
          const locked = ['future', 'cancelled', 'notExpected'].includes(cell.state)
          const reason = state === 'absent' ? ` · Lý do: ${value.reason || 'Chưa có lý do'}` : ''
          const booking = cell.sourceBooking
          const bookingDetail = booking ? ` · ${booking.state === 'COMPLETED' ? 'Đã học bù' : 'Đã xếp học bù'} ${dateLabel(booking.destination_date)}` : ''
          return `<td class="attendance-ledger-cell is-${state}${change ? ' is-dirty' : ''}${change?.conflict ? ' is-conflict' : ''}" data-attendance-ledger-state="${state}">
          <button type="button" data-attendance-cell-detail data-student-id="${html(row.student.id)}" data-schedule-session-id="${html(cell.occurrence.scheduleSessionId)}" data-date-key="${html(cell.occurrence.date)}"
            ${locked ? 'disabled' : ''} data-attendance-editable="${editable}" aria-label="${html(`${row.student.fullName} · ${label} · ${contextLabel(cell.occurrence)}${change ? ' · Chưa lưu' : ''}`)}" title="${html(`${label}${reason}${bookingDetail} · ${contextLabel(cell.occurrence)}${cell.originalDate ? ` · Học bù cho buổi ${dateLabel(cell.originalDate)}` : ''}`)}">
            <span class="attendance-ledger-mark is-${state}" aria-hidden="true">${html(mark)}</span>
          </button></td>`
        }).join('')}
        <td class="attendance-ledger-progress" title="${html(row.tuition.packageLabel)}">${row.tuition.hasKnownPackage ? `<strong>${row.tuition.usedSessions}/${row.tuition.totalSessions}</strong><small>còn ${row.tuition.remainingSessions}</small>` : '—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`
}

function renderDetail(state, model, draft, access) {
  if (!state) return ''
  const occurrence = model.columns.find(item => item.scheduleSessionId === state.scheduleSessionId && item.date === state.dateKey)
  if (!occurrence) return ''
  const row = state.studentId ? model.rows.find(item => item.student.id === state.studentId) : null
  const cell = row?.cells.find(item => item.occurrence.key === occurrence.key)
  if (cell) return renderCellEditor(state, row, cell, draft, access, model)
  const original = cell?.originalOccurrence
  return `<div class="attendance-ledger-detail-overlay" data-attendance-detail-close>
    <section class="attendance-ledger-detail" role="dialog" aria-modal="true" aria-labelledby="attendance-ledger-detail-title" tabindex="-1">
      <header><h4 id="attendance-ledger-detail-title">${html(cell ? cell.label : 'Chi tiết buổi học')}</h4><button type="button" data-attendance-detail-close aria-label="Đóng chi tiết">×</button></header>
      <dl>${row ? field('Học viên', row.student.fullName) : ''}${field('Ngày học', dateLabel(occurrence.date))}
        ${field('Giờ học', timeLabel(occurrence))}${field('Lớp', occurrence.classLabel)}
        ${field('Giáo viên thực tế', teacherLabel(occurrence))}${field('Buổi học', occurrenceState(occurrence))}
        ${cell?.isTrial ? field('Ghi nhận', 'Học thử') : ''}${cell?.isExcused ? field('Ghi nhận', 'Vắng có phép') : ''}
      </dl>
      ${cell?.state === 'makeup' ? `<div class="attendance-ledger-makeup"><strong>${html(cell.originalDate ? `Học bù cho buổi ${dateLabel(cell.originalDate).slice(0, 5)}` : 'Chưa tải được buổi Vắng gốc')}</strong>
        ${original ? `<dl>${field('Ngày Vắng gốc', dateLabel(original.date))}${field('Lớp gốc', original.classLabel)}${field('Giáo viên buổi gốc', teacherLabel(original))}</dl>` : '<p>Vui lòng làm mới để xem đầy đủ buổi Vắng gốc.</p>'}</div>` : ''}
      ${occurrence.partialHistoricalRoster ? '<p>Danh sách lịch sử chỉ có học viên đã được ghi nhận.</p>' : ''}
      <footer>${route(occurrence)}</footer>
    </section></div>`
}

function renderCellEditor(state, row, cell, draft, access, model) {
  const value = attendanceCellDraftValue(draft, row.student.id, cell)
  const change = draft?.changes?.[attendanceDraftCellKey(row.student.id, cell.occurrence)]
  const editable = canEditAttendanceCell(cell, access)
  const status = value.status || 'unmarked'
  const picker = state.makeupPicking
  const booking = cell.sourceBooking
  const sourceId = cell.record?.authorityLocalId
  const completed = cell.completedMakeup
  const destination = booking && (model.occurrenceByKey.get(`${booking.destination_schedule_local_id}|${booking.destination_date}`)
    || {classLabel: booking.destinationClassLabel, date: booking.destination_date})
  const statusOptions = cell.makeupOnly ? [['makeup', 'B', 'Học bù'], ['unmarked', '?', 'Chưa điểm danh']]
    : booking || completed ? [['absent', 'V', 'Vắng']]
      : [['present', '✓', 'Có mặt'], ['absent', 'V', 'Vắng'], ['makeup', 'B', 'Học bù'], ['unmarked', '?', 'Chưa điểm danh']]
  const candidates = (state.makeupCandidates || []).filter(candidate => !Object.values(draft?.changes || {}).some(item =>
    item.studentId === row.student.id && item.value.makeupTarget === candidate.attendance_local_id && item.occurrenceDate !== cell.occurrence.date))
  return `<section class="attendance-ledger-editor" role="dialog" aria-modal="false" aria-labelledby="attendance-cell-editor-title" tabindex="-1" data-attendance-cell-editor>
    <header><div><strong id="attendance-cell-editor-title">${html(row.student.fullName)}</strong><small>${html(dateLabel(cell.occurrence.date))} · ${html(cell.occurrence.startTime)}</small></div><button type="button" data-attendance-editor-close aria-label="Đóng">×</button></header>
    ${change?.conflict ? `<p class="attendance-ledger-editor-error">Dữ liệu vừa được thay đổi. Hiện tại: ${html(cell.label)}. Kiểm tra rồi chọn lại.</p>` : ''}
    ${editable ? `<div class="attendance-ledger-status-picker" aria-label="Chọn điểm danh">${statusOptions.map(([id, mark, label]) => `<button type="button" data-attendance-edit-status="${id}" aria-pressed="${status === id && !picker}"><b>${mark}</b><span>${label}</span></button>`).join('')}</div>` : `<p>${html(cell.label)} · Chỉ xem</p>`}
    ${!picker && (status === 'absent' || !change && cell.state === 'absent') ? `<div class="attendance-ledger-reason"><label for="attendance-absence-reason">Lý do vắng <small>(không bắt buộc)</small></label>
      ${editable ? `<input id="attendance-absence-reason" data-attendance-edit-reason type="text" maxlength="1000" value="${html(value.reason || '')}" placeholder="Để trống nếu chưa có lý do">` : ''}
      <p>${html(value.reason || 'Chưa có lý do')}</p></div>` : ''}
    ${picker ? `<div class="attendance-ledger-makeup-picker"><strong>Chọn buổi vắng gốc</strong>${state.makeupLoading ? '<p>Đang tìm buổi vắng…</p>' : state.makeupError ? `<p>${html(state.makeupError)}</p>` : candidates.length ? candidates.map(candidate => `<button type="button" data-attendance-makeup-source="${html(candidate.attendance_local_id)}">${html(dateLabel(candidate.occurrence_date))} · ${html(String(candidate.start_time || '').slice(0, 5))}<small>${html(candidate.teacher_name || '')}</small></button>`).join('') : '<p>Chưa có buổi vắng phù hợp để học bù.</p>'}</div>` : ''}
    ${!picker && (status === 'makeup' || cell.makeupBooking) ? `<p>${status === 'makeup' ? 'Học bù' : 'Đã xếp học bù'} · Bù cho: ${html(cell.originalOccurrence?.classLabel || cell.makeupBooking?.sourceClassLabel || 'Ca học')} · ${html(dateLabel(cell.originalDate || cell.makeupBooking?.source_date))}</p>` : ''}
    ${!change && cell.state === 'absent' && sourceId ? `<div class="attendance-ledger-booking-detail">
      ${booking ? `<strong>${booking.state === 'COMPLETED' ? 'Đã học bù' : 'Đã xếp học bù'}</strong><p>${html(destination.classLabel)} · ${html(dateLabel(booking.destination_date))}</p>`
        : completed ? `<strong>Đã học bù</strong><p>${html(model.occurrenceByKey.get(`${completed.scheduleSessionId}|${completed.date}`)?.classLabel || 'Ca học')} · ${html(dateLabel(completed.date))}</p>` : ''}
      ${access.canWrite && !access.saving && !access.uncertain && !completed && booking?.state !== 'COMPLETED' ? `<div class="attendance-ledger-booking-actions"><button type="button" data-attendance-book-makeup>${booking ? 'Đổi buổi' : 'Xếp học bù'}</button>${booking ? '<button type="button" data-attendance-cancel-makeup>Hủy lịch bù</button>' : ''}</div>` : ''}
    </div>` : ''}
    ${state.bookingPicking ? `<div class="attendance-ledger-makeup-picker"><strong>Chọn buổi học bù</strong><p>Chọn một buổi để xếp học bù.</p>${state.bookingLoading ? '<p>Đang tải buổi học…</p>' : (state.bookingDestinations || []).map(o => `<button type="button" data-attendance-book-destination="${html(`${o.schedule_session_local_id}|${o.occurrence_date}`)}" ${state.bookingSaving ? 'disabled' : ''}>${html(new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(`${o.occurrence_date}T12:00:00Z`)))}<small>${html(o.classLabel)} · ${html(String(o.planned_start_time || '').slice(0,5))}–${html(String(o.planned_end_time || '').slice(0,5))}</small></button>`).join('') || '<p>Chưa có buổi học phù hợp.</p>'}</div>` : ''}
    ${state.bookingError ? `<p class="attendance-ledger-editor-error" role="alert">${html(state.bookingError)}</p>${state.bookingAttempt ? '<button type="button" data-attendance-book-retry>Thử lại</button>' : ''}` : ''}
    ${draft?.error ? `<p class="attendance-ledger-editor-error" role="alert">${html(draft.error)}</p>` : ''}
    ${editable ? '<footer>Thay đổi được lưu khi bấm Lưu điểm danh.</footer>' : ''}
  </section>`
}
