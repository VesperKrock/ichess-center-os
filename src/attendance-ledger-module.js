import { ATTENDANCE_LEDGER_STATES, buildCanonicalAttendanceLedger } from './attendance-ledger.js'

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
  notificationReview = null, availability = {}, onModel = null } = {}) {
  const context = availability.ledgerContext || {}
  const ready = availability.attendanceAvailable === true && context.status === 'ready'
  const model = buildCanonicalAttendanceLedger({
    students, classSessions, filters,
    scheduleSessions: availability.scheduleSessions || [],
    occurrences: ready ? context.occurrences : [],
    plannedOccurrences: ready ? availability.plannedOccurrences || [] : [],
    attendanceRecords: ready ? availability.attendanceRecords || [] : [],
    packageCycleStudentStates: availability.packageCycleStudentStates || [],
    packageCycleReady: availability.tuitionAvailable === true && availability.packageCycleReady === true,
    now: availability.now || new Date(),
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
  return `<section class="attendance-board-module attendance-ledger" aria-label="Bảng điểm danh" data-attendance-read-only>
    <header class="attendance-board-heading">
      <div class="attendance-board-heading-intro"><span>BẢNG ĐIỂM DANH</span>
        <div class="attendance-board-heading-copy"><h3>Bảng điểm danh</h3><p>Theo dõi buổi học · Chỉ xem</p></div>
      </div><div class="attendance-ledger-actions"><span class="attendance-ledger-readonly">Chỉnh điểm danh tại Thời khóa biểu</span>
        <button type="button" data-attendance-export-pdf ${exportReady ? '' : 'disabled'}>In / Xuất PDF</button></div>
    </header>
    <div class="attendance-board-toolbar" aria-label="Bộ lọc bảng điểm danh">
      <label><span>Lớp</span><select data-attendance-board-filter="classSessionId"><option value="all">Tất cả lớp</option>${options(classOptions, selected.classSessionId, 'Lớp đã chọn')}</select></label>
      <label><span>Giáo viên buổi học</span><select data-attendance-board-filter="teacherId"><option value="all">Tất cả giáo viên</option>${options(model.teacherOptions.map(item => [item.id, item.name]), selected.teacherId, 'Giáo viên đã chọn')}</select></label>
      <label><span>Từ ngày</span><input type="date" data-attendance-board-filter="fromDate" value="${html(selected.fromDate)}"></label>
      <label><span>Đến ngày</span><input type="date" data-attendance-board-filter="toDate" value="${html(selected.toDate)}"></label>
      <label><span>Tìm học viên</span><input type="search" data-attendance-board-filter="query" value="${html(selected.query)}" placeholder="Tên, mã học viên, phụ huynh"></label>
    </div>
    <div class="attendance-ledger-legend" aria-label="Chú giải điểm danh">${Object.entries(ATTENDANCE_LEDGER_STATES).filter(([state]) => state !== 'notExpected')
      .map(([state, item]) => `<span><b class="attendance-ledger-mark is-${state}">${html(item.mark)}</b>${html(item.label)}</span>`).join('')}
      <span>${model.rows.length} học viên · ${model.columns.length} buổi</span>
    </div>
    ${message ? `<p class="attendance-board-empty" role="status">${html(message)}</p>`
      : !model.columns.length ? '<p class="attendance-board-empty">Không có buổi học trong khoảng thời gian này.</p>'
        : !model.rows.length ? '<p class="attendance-board-empty">Không có học viên phù hợp với bộ lọc.</p>' : renderMatrix(model)}
    ${ready && model.columns.some(item => item.partialHistoricalRoster) ? '<p class="attendance-ledger-history-note">Một số buổi cũ chỉ có danh sách học viên đã được ghi nhận trong lịch sử.</p>' : ''}
    ${ready ? renderHistoricalOpeningEvidence(availability.historicalBaselineRecords || [], students) : ''}
    ${ready ? renderDetail(detailState, model) : ''}
    ${notificationReview ? `<div class="attendance-ledger-detail-overlay" data-attendance-detail-close>
      <section class="attendance-ledger-detail attendance-ledger-notification-context" role="dialog" aria-modal="true" aria-label="Chi tiết nhắc nhận xét" tabindex="-1">
        <header><h4>Cần cập nhật nhận xét</h4><button type="button" data-attendance-detail-close aria-label="Đóng chi tiết">×</button></header>
        <dl>${field('Học viên', notificationReview.studentName)}${field('Kỳ học', `Kỳ ${notificationReview.cycleNumber}`)}
          ${field('Ngày nhắc', dateLabel(notificationReview.triggerDate))}</dl>
        <p>Kiểm tra đúng học viên và kỳ học trước khi cập nhật nhận xét.</p>
        <footer><button type="button" data-attendance-detail-close>Đóng chi tiết</button></footer>
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

function renderMatrix(model) {
  return `<div class="attendance-board-sheet-wrap attendance-ledger-scroll" tabindex="0" aria-label="Bảng buổi học, cuộn ngang để xem thêm">
    <table class="attendance-board-sheet attendance-ledger-sheet"><caption class="sr-only">Học viên theo từng buổi học</caption>
      <thead><tr><th scope="col" class="attendance-ledger-student">Học viên</th><th scope="col" class="attendance-ledger-progress">Số buổi</th>
        ${model.columns.map(occurrence => `<th scope="col" class="attendance-ledger-column" data-attendance-occurrence-key="${html(occurrence.key)}">
          <button type="button" data-attendance-occurrence-detail data-schedule-session-id="${html(occurrence.scheduleSessionId)}" data-occurrence-date="${html(occurrence.date)}"
            title="${html(`${contextLabel(occurrence)} · ${occurrenceState(occurrence)}`)}"><strong>${html(dateLabel(occurrence.date).slice(0, 5))}</strong><small>${html(occurrence.startTime || '—')}</small></button>
        </th>`).join('')}</tr></thead>
      <tbody>${model.rows.map(row => `<tr data-attendance-ledger-student="${html(row.student.id)}">
        <th scope="row" class="attendance-ledger-student"><strong>${html(row.student.fullName)}</strong><small>${html(row.student.studentCode || '')}</small></th>
        <td class="attendance-ledger-progress" title="${html(row.tuition.packageLabel)}">${html(row.tuition.hasKnownPackage ? row.tuition.progressLabel : '—')}</td>
        ${row.cells.map(cell => `<td class="attendance-ledger-cell is-${cell.state}" data-attendance-ledger-state="${cell.state}">
          <button type="button" data-attendance-cell-detail data-student-id="${html(row.student.id)}" data-schedule-session-id="${html(cell.occurrence.scheduleSessionId)}" data-date-key="${html(cell.occurrence.date)}"
            aria-label="${html(`${row.student.fullName} · ${cell.label} · ${contextLabel(cell.occurrence)}`)}" title="${html(`${cell.label} · ${contextLabel(cell.occurrence)}${cell.originalDate ? ` · Học bù cho buổi ${dateLabel(cell.originalDate)}` : ''}`)}">
            <span class="attendance-ledger-mark is-${cell.state}" aria-hidden="true">${html(cell.mark)}</span>
          </button></td>`).join('')}
      </tr>`).join('')}</tbody>
    </table></div>`
}

function renderDetail(state, model) {
  if (!state) return ''
  const occurrence = model.columns.find(item => item.scheduleSessionId === state.scheduleSessionId && item.date === state.dateKey)
  if (!occurrence) return ''
  const row = state.studentId ? model.rows.find(item => item.student.id === state.studentId) : null
  const cell = row?.cells.find(item => item.occurrence.key === occurrence.key)
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
