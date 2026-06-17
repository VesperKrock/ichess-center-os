export const initialAttendanceBoardFilters = {
  month: getCurrentMonthValue(),
  classSessionId: 'all',
  query: '',
}

import { ANGEL_WINGS_SOURCE_MODULE, ANGEL_WINGS_SOURCE_TAG } from './attendance-board-angel-wings-data.js'
import { computeAttendanceCycleState, getPaidCycleCountFromTuition } from './attendance-board-cycle.js'

export const ATTENDANCE_BOARD_DEMO_BATCH_ID = 'attendance-board-demo-foundation'
export const ATTENDANCE_BOARD_DEMO_SOURCE = 'bang-diem-danh-demo'

const weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const presentAttendanceStatuses = new Set(['present', 'makeup'])
const attendanceStatusLabels = {
  present: 'Có mặt',
  excusedAbsent: 'Vắng phép',
  unexcusedAbsent: 'Vắng',
  makeup: 'Học bù',
  trial: 'Học thử',
}

export function renderAttendanceBoardModule(
  students = [],
  classSessions = [],
  tuitionRecords = [],
  sessionReports = [],
  attendanceAdvisoryNotes = [],
  filters = initialAttendanceBoardFilters,
  detailState = null,
  attendanceBoardNotes = [],
  noteFormState = null,
) {
  const normalizedFilters = normalizeAttendanceBoardFilters(filters)
  const activeClassSessions = classSessions.filter((classSession) => classSession.status !== 'inactive')
  const filteredRows = buildAttendanceBoardRows(
    students,
    classSessions,
    tuitionRecords,
    sessionReports,
    attendanceAdvisoryNotes,
    normalizedFilters,
    attendanceBoardNotes,
  )
  const visibleDates = getVisibleAttendanceDates(filteredRows, classSessions, normalizedFilters)
  const stats = getAttendanceBoardStats(students, classSessions)

  return `
    <section class="attendance-board-module" aria-label="Bảng điểm danh">
      <header class="attendance-board-header">
        <div>
          <h3>Bảng điểm danh</h3>
        </div>
        <div class="attendance-board-stats" aria-label="Tổng quan bảng điểm danh">
          <span>Tổng học viên: <strong>${stats.totalStudents}</strong></span>
          <span>Đã phân lớp: <strong>${stats.assignedStudents}</strong></span>
          <span>Chưa phân lớp: <strong>${stats.unassignedStudents}</strong></span>
          <span>Tổng ca học: <strong>${stats.totalClassSessions}</strong></span>
        </div>
      </header>

      <div class="attendance-board-toolbar" aria-label="Bộ lọc bảng điểm danh">
        <label>
          <span>Tháng/Năm</span>
          <input type="month" data-attendance-board-filter="month" value="${escapeAttribute(normalizedFilters.month)}">
        </label>
        <label>
          <span>Ca học / Lớp</span>
          <select data-attendance-board-filter="classSessionId">
            <option value="all" ${normalizedFilters.classSessionId === 'all' ? 'selected' : ''}>Tất cả ca học</option>
            <option value="unassigned" ${normalizedFilters.classSessionId === 'unassigned' ? 'selected' : ''}>Chưa phân lớp</option>
            ${activeClassSessions
              .map(
                (classSession) => `
                  <option value="${escapeAttribute(classSession.id)}" ${normalizedFilters.classSessionId === classSession.id ? 'selected' : ''}>
                    ${escapeHtml(getClassSessionLabel(classSession))}
                  </option>
                `,
              )
              .join('')}
          </select>
        </label>
        <label>
          <span>Tìm kiếm học viên</span>
          <input
            type="search"
            data-attendance-board-filter="query"
            value="${escapeAttribute(normalizedFilters.query)}"
            placeholder="Tên, mã học viên, phụ huynh, số điện thoại"
          >
        </label>
      </div>

      ${renderAttendanceBoardContent(filteredRows, visibleDates, classSessions, students)}
      ${renderAttendanceDetailModal(detailState, filteredRows, classSessions)}
      ${renderAttendanceNoteModal(noteFormState, filteredRows, normalizedFilters)}
    </section>
  `
}

export function buildAttendanceBoardRows(
  students = [],
  classSessions = [],
  tuitionRecords = [],
  sessionReports = [],
  attendanceAdvisoryNotes = [],
  filters = initialAttendanceBoardFilters,
  attendanceBoardNotes = [],
) {
  const normalizedFilters = normalizeAttendanceBoardFilters(filters)
  const classSessionById = buildAttendanceClassSessionMap(classSessions, sessionReports)
  const tuitionByStudentId = new Map(tuitionRecords.map((record) => [record.studentId, record]))
  const reportLookup = buildAttendanceReportLookup(sessionReports, normalizedFilters.month)
  const advisoryNoteByStudentId = buildAdvisoryNoteLookup(attendanceAdvisoryNotes, normalizedFilters.month)
  const attendanceBoardNoteByStudentId = buildAttendanceBoardNoteLookup(attendanceBoardNotes, normalizedFilters.month)
  const normalizedQuery = normalizeSearchText(normalizedFilters.query)

  return students
    .filter((student) => !student.isDeleted)
    .map((student, index) => {
      const reportClassSessionIds = normalizeIdList(
        (reportLookup.get(student.id) || []).map((attendanceItem) => attendanceItem.classSessionId),
      )
      const classSessionIds = Array.from(new Set([...normalizeIdList(student.classSessionIds), ...reportClassSessionIds]))
      const studentClassSessions = classSessionIds
        .map((classSessionId) => classSessionById.get(classSessionId) || buildFallbackClassSessionFromId(classSessionId))
        .filter(Boolean)
      const tuition = tuitionByStudentId.get(student.id)
      const attendanceSummary = getStudentAttendanceSummary(student.id, reportLookup, tuition)
      const advisoryNote = advisoryNoteByStudentId.get(student.id)

      return {
        index,
        student,
        classSessionIds,
        classSessions: studentClassSessions,
        tuition,
        attendanceSummary,
        careStatus: getCareStatusLabel(tuition),
        note: getAttendanceBoardNote(student, advisoryNote, attendanceBoardNoteByStudentId.get(student.id)),
        attendanceBoardNote: attendanceBoardNoteByStudentId.get(student.id) || null,
        searchableText: normalizeSearchText(
          [
            student.studentCode,
            student.fullName,
            student.parentName,
            student.parentPhone,
            student.fatherPhone,
            student.motherPhone,
          ].join(' '),
        ),
      }
    })
    .filter((row) => {
      const matchesClassSession =
        normalizedFilters.classSessionId === 'all' ||
        (normalizedFilters.classSessionId === 'unassigned' && row.classSessionIds.length === 0) ||
        row.classSessionIds.includes(normalizedFilters.classSessionId)
      const matchesQuery = !normalizedQuery || row.searchableText.includes(normalizedQuery)

      return matchesClassSession && matchesQuery
    })
}

export function buildDemoAttendanceReports(
  students = [],
  classSessions = [],
  tuitionRecords = [],
  monthValue = getCurrentMonthValue(),
  existingReports = [],
) {
  const classSessionById = new Map(classSessions.map((classSession) => [classSession.id, classSession]))
  const tuitionByStudentId = new Map(tuitionRecords.map((record) => [record.studentId, record]))
  const existingReportIds = new Set((existingReports ?? []).map((report) => report.id))
  const candidateStudents = students
    .filter((student) => !student.isDeleted && normalizeIdList(student.classSessionIds).length > 0)
    .slice(0, 12)

  return candidateStudents.flatMap((student, studentIndex) => {
    const studentClassSessions = normalizeIdList(student.classSessionIds)
      .map((classSessionId) => classSessionById.get(classSessionId))
      .filter(Boolean)

    if (!studentClassSessions.length) {
      return []
    }

    const tuition = tuitionByStudentId.get(student.id)
    const packageTotalSessions = getPackageTotalSessions(tuition)
    const plannedDates = studentClassSessions
      .flatMap((classSession) =>
        getAttendanceDatesForClassSession(classSession, monthValue).map((dateItem) => ({
          ...dateItem,
          classSession,
        })),
      )
      .sort((firstDate, secondDate) => firstDate.dateKey.localeCompare(secondDate.dateKey))
      .filter((dateItem, index, dateItems) =>
        dateItems.findIndex((candidateDate) => candidateDate.dateKey === dateItem.dateKey) === index,
      )
    const demoCount = getDemoAttendanceCountForStudent(studentIndex, packageTotalSessions, plannedDates.length)

    return plannedDates
      .slice(0, demoCount)
      .map((dateItem, eventIndex) => {
        const id = `attendance-demo-${student.id}-${dateItem.dateKey}`
        const isWrapEvent = packageTotalSessions ? eventIndex + 1 > packageTotalSessions : false
        const demoPaymentStatus = isWrapEvent && studentIndex % 2 === 1 ? 'unpaid' : 'paid'

        if (existingReportIds.has(id)) {
          return null
        }

        return {
          id,
          sessionId: `attendance-demo-session-${dateItem.classSession.id}`,
          occurrenceDate: dateItem.dateKey,
          attendance: [
            {
              studentId: student.id,
              attendanceStatus: 'present',
              note: isWrapEvent
                ? demoPaymentStatus === 'unpaid'
                  ? 'Dữ liệu mẫu kiểm thử: chưa đóng kỳ mới.'
                  : 'Dữ liệu mẫu kiểm thử: đã đóng kỳ mới.'
                : 'Dữ liệu mẫu kiểm thử.',
              isDemoAttendance: true,
              sourceModule: ATTENDANCE_BOARD_DEMO_SOURCE,
              demoPaymentStatus,
            },
          ],
          isDemoAttendance: true,
          sourceModule: ATTENDANCE_BOARD_DEMO_SOURCE,
          demoBatchId: ATTENDANCE_BOARD_DEMO_BATCH_ID,
          learningGroups: [],
          guestParticipants: [],
          teachingAssistantNotes: 'Dữ liệu mẫu kiểm thử bảng điểm danh.',
          classSituation: '',
          suggestions: '',
          createdAt: `${dateItem.dateKey}T00:00:00.000Z`,
          updatedAt: `${dateItem.dateKey}T00:00:00.000Z`,
        }
      })
      .filter(Boolean)
  })
}

export function removeDemoAttendanceReports(sessionReports = []) {
  return sessionReports.filter((report) => !isDemoAttendanceReport(report))
}

export function getDemoAttendanceReportCount(sessionReports = []) {
  return sessionReports.filter(isDemoAttendanceReport).length
}

export function getAngelWingsReportCount(sessionReports = []) {
  return sessionReports.filter(isAngelWingsReport).length
}

export function isAngelWingsReport(report) {
  return Boolean(report?.sourceTag === ANGEL_WINGS_SOURCE_TAG || report?.sourceModule === ANGEL_WINGS_SOURCE_MODULE)
}

export function isDemoAttendanceReport(report) {
  return Boolean(
    report?.isDemoAttendance ||
      report?.sourceModule === ATTENDANCE_BOARD_DEMO_SOURCE ||
      report?.demoBatchId === ATTENDANCE_BOARD_DEMO_BATCH_ID,
  )
}

export function getAttendanceDatesForClassSession(classSession, monthValue) {
  const weekdayIndexes = getClassSessionWeekdayIndexes(classSession)

  if (!weekdayIndexes.length) {
    return []
  }

  const [year, month] = parseMonthValue(monthValue)
  const daysInMonth = new Date(year, month, 0).getDate()

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const date = new Date(year, month - 1, day)

    if (!weekdayIndexes.includes(date.getDay())) {
      return null
    }

    return {
      dateKey: formatDateKey(year, month, day),
      day,
      weekdayLabel: weekdayLabels[date.getDay()],
    }
  }).filter(Boolean)
}

function getClassSessionWeekdayIndexes(classSession) {
  const dayIndexByValue = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  }
  const daysOfWeek = Array.isArray(classSession?.daysOfWeek) ? classSession.daysOfWeek : []
  const indexes = daysOfWeek
    .map((day) => dayIndexByValue[String(day || '').trim().toLowerCase()])
    .filter((index) => Number.isInteger(index))

  return indexes.length
    ? Array.from(new Set(indexes)).sort((firstIndex, secondIndex) => firstIndex - secondIndex)
    : parseClassSessionDayIndexes(
        classSession?.daysLabel || classSession?.dayLabel || classSession?.displayLabel || classSession?.name,
      )
}

export function parseClassSessionDayIndexes(dayLabel = '') {
  const source = String(dayLabel).toUpperCase()
  const tokens = source.match(/CN|T[2-7]/g) || []
  const indexes = new Set()

  tokens.forEach((token) => {
    const startIndex = getWeekdayIndex(token)

    if (startIndex === null) {
      return
    }

    indexes.add(startIndex)
  })

  return Array.from(indexes).sort((firstIndex, secondIndex) => firstIndex - secondIndex)
}

function renderAttendanceBoardContent(rows, dates, classSessions, students) {
  if (!students.length) {
    return '<p class="attendance-board-empty">Chưa có học viên để lập bảng điểm danh.</p>'
  }

  if (!classSessions.length && !rows.some((row) => row.classSessions.length)) {
    return '<p class="attendance-board-empty">Chưa có danh mục ca học. Vui lòng cấu hình tại Cài đặt cơ sở.</p>'
  }

  if (!rows.length) {
    return '<p class="attendance-board-empty">Không có học viên phù hợp với bộ lọc.</p>'
  }

  return `
    <div class="attendance-board-sheet-wrap">
      <table class="attendance-board-sheet">
        <thead>
          <tr>
            <th class="is-sticky">STT</th>
            <th class="is-sticky">Họ và tên</th>
            <th>Ca học / Lớp</th>
            ${dates
              .map(
                (dateItem) => `
                  <th class="attendance-date-column" data-attendance-date-key="${escapeAttribute(dateItem.dateKey)}">
                    <span>${escapeHtml(dateItem.weekdayLabel)}</span>
                    <strong>${String(dateItem.day).padStart(2, '0')}</strong>
                  </th>
                `,
              )
              .join('')}
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, rowIndex) => renderAttendanceBoardRow(row, rowIndex, dates)).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderAttendanceBoardRow(row, rowIndex, dates) {
  return `
    <tr>
      <td class="is-sticky">${rowIndex + 1}</td>
      <td class="is-sticky">
        <strong>${escapeHtml(cleanDisplayText(row.student.fullName || ''))}</strong>
      </td>
      <td>${renderClassSessionList(row.classSessions)}</td>
      ${dates.map((dateItem) => renderAttendanceCell(row, dateItem)).join('')}
      <td class="attendance-note-cell">${renderAttendanceNoteCell(row)}</td>
    </tr>
  `
}

function renderAttendanceNoteCell(row) {
  const hasNote = Boolean(String(row.attendanceBoardNote?.note || '').trim())
  const buttonLabel = hasNote ? 'Sửa ghi chú' : 'Điền ghi chú'

  return `
    <div class="attendance-note-action">
      ${hasNote ? `<p>${escapeHtml(cleanDisplayText(row.attendanceBoardNote.note))}</p>` : '<span>—</span>'}
      <button
        type="button"
        data-attendance-note-open
        data-student-id="${escapeAttribute(row.student.id)}"
      >
        ${buttonLabel}
      </button>
    </div>
  `
}

function renderAttendanceCell(row, dateItem) {
  const attendance = row.attendanceSummary.byDate.get(dateItem.dateKey)

  if (attendance) {
    const isAngelWings = isAngelWingsAttendanceItem(attendance)
    const sourceLabel = isAngelWings ? 'Angel Wings 06/2026' : 'Báo cáo buổi học'
    const titleParts = [
      attendance.warning || attendanceStatusLabels[attendance.attendanceStatus] || 'Có dữ liệu',
      attendance.cycleLabel,
      attendance.remainingLabel,
      `Nguồn: ${sourceLabel}`,
    ].filter(Boolean)
    const cellClasses = [
      'attendance-cell',
      'is-recorded',
      getAttendanceCellStatusClass(attendance),
      isCombinedAttendanceItem(attendance) ? 'attendance-cell-combined' : '',
    ].filter(Boolean)

    return `
      <td class="${escapeAttribute(cellClasses.join(' '))}">
        <button
          type="button"
          class="attendance-cell-button"
          data-attendance-cell-detail
          data-student-id="${escapeAttribute(row.student.id)}"
          data-date-key="${escapeAttribute(dateItem.dateKey)}"
          title="${escapeAttribute(titleParts.join(' · '))}"
        >
          ${renderAttendanceCellDisplay(attendance)}
        </button>
      </td>
    `
  }

  const isPlanned = row.classSessions.some((classSession) =>
    getAttendanceDatesForClassSession(classSession, dateItem.dateKey.slice(0, 7))
      .some((sessionDate) => sessionDate.dateKey === dateItem.dateKey),
  )

  return `
    <td class="attendance-cell ${isPlanned ? 'is-planned' : 'is-empty'}" ${isPlanned ? 'title="Dự kiến theo Ca học / Lớp"' : ''}>
      ${isPlanned ? '<span>·</span>' : '<span>—</span>'}
    </td>
  `
}

function renderClassSessionList(classSessions) {
  if (!classSessions.length) {
    return `
      <span class="attendance-unassigned">Chưa phân lớp</span>
    `
  }

  return `
    <div class="attendance-class-session-list">
      ${classSessions
        .map(
          (classSession) => `
            <span class="${classSession.status === 'inactive' ? 'is-inactive' : ''}">
              ${escapeHtml(getClassSessionLabel(classSession))}
            </span>
          `,
        )
        .join('')}
    </div>
  `
}

function renderAttendanceCellDisplay(attendance) {
  const credits = Array.isArray(attendance.credits) ? attendance.credits : []

  if (attendance.attendanceStatus === 'trial' || String(attendance.displayValue || '').toUpperCase() === 'T') {
    return '<span class="attendance-credit-chip is-trial">T</span>'
  }

  if (isCombinedAttendanceItem(attendance)) {
    return credits
      .map((credit) => {
        const value = getAttendanceCreditDisplayValue(credit)
        return `<span class="attendance-credit-chip is-combined">${escapeHtml(value)}</span>`
      })
      .join('')
  }

  return `<span class="attendance-credit-chip">${escapeHtml(attendance.displayValue || attendanceStatusLabels[attendance.attendanceStatus] || '✓')}</span>`
}

function renderAttendanceDetailModal(detailState, rows, classSessions) {
  if (!detailState?.studentId || !detailState?.dateKey) {
    return ''
  }

  const row = rows.find((candidate) => candidate.student.id === detailState.studentId)
  const attendance = row?.attendanceSummary.byDate.get(detailState.dateKey)

  if (!row || !attendance) {
    return ''
  }

  const classSessionById = new Map(classSessions.map((classSession) => [classSession.id, classSession]))
  const actualClassSession = classSessionById.get(attendance.classSessionId) || row.classSessions[0] || null
  const originalClassSession = row.classSessions[0] || actualClassSession
  const isAngelWings = isAngelWingsAttendanceItem(attendance)
  const sourceLabel = isAngelWings ? 'Angel Wings 06/2026' : 'Báo cáo buổi học'
  const typeLabel = getAttendanceDetailTypeLabel(attendance)
  const credits = Array.isArray(attendance.credits) ? attendance.credits : []
  const creditRows = credits.length
    ? `
      <div class="attendance-detail-credits">
        ${credits
          .map(
            (credit) => `
              <span>
                ${escapeHtml(getAttendanceCreditLabel(credit, attendance))}
              </span>
            `,
          )
          .join('')}
      </div>
    `
    : ''

  return `
    <div class="attendance-detail-backdrop" role="presentation" data-attendance-detail-close></div>
    <section class="attendance-detail-modal" role="dialog" aria-modal="true" aria-label="Chi tiết điểm danh">
      <header>
        <div>
          <h4>Chi tiết điểm danh</h4>
          <p>${escapeHtml(formatAttendanceDate(detailState.dateKey))}</p>
        </div>
        <button type="button" aria-label="Đóng" data-attendance-detail-close>×</button>
      </header>
      <div class="attendance-detail-grid">
        ${renderAttendanceDetailField('Học viên', cleanDisplayText(row.student.fullName || ''))}
        ${renderAttendanceDetailField('Ngày học', formatAttendanceDate(detailState.dateKey))}
        ${renderAttendanceDetailField('Giá trị ô', getAttendanceDisplayValueForDetail(attendance))}
        ${renderAttendanceDetailField('Loại buổi', typeLabel)}
        ${renderAttendanceDetailField('Ca học thực tế', getClassSessionLabel(actualClassSession))}
        ${renderAttendanceDetailField('Ca gốc của học viên', getClassSessionLabel(originalClassSession))}
        ${renderAttendanceDetailField('Giáo viên', cleanDisplayText(attendance.teacherName || row.student.mainTeacherName || 'Chưa cập nhật'))}
        ${renderAttendanceDetailField('Kỳ / gói học phí', attendance.countsTowardTuition ? attendance.cycleLabel || 'Chưa đủ dữ liệu gói' : 'Học thử, không tính vào gói')}
        ${renderAttendanceDetailField('Số buổi còn lại', attendance.remainingLabel || 'Không áp dụng')}
        ${renderAttendanceDetailField('Nguồn dữ liệu', sourceLabel)}
      </div>
      ${creditRows}
      ${
        attendance.needsMakeupReview
          ? '<p class="attendance-detail-warning">Ô này có nhiều credit trong cùng ngày. Cần kiểm tra học bù/ghi nhận gộp nếu dữ liệu nguồn chưa nêu rõ ca bù.</p>'
          : ''
      }
      ${attendance.note ? `<p class="attendance-detail-note">${escapeHtml(cleanDisplayText(attendance.note))}</p>` : ''}
    </section>
  `
}

function buildAttendanceClassSessionMap(classSessions = [], sessionReports = []) {
  const classSessionById = new Map(
    classSessions
      .filter((classSession) => classSession?.id)
      .map((classSession) => [String(classSession.id), classSession]),
  )

  ;(sessionReports || []).forEach((report) => {
    const candidateClassSessionIds = [
      report.classSessionId,
      ...(report.attendance || []).map((attendanceItem) => attendanceItem.classSessionId),
    ]

    candidateClassSessionIds.forEach((classSessionId) => {
      const id = String(classSessionId || '').trim()

      if (!id || classSessionById.has(id)) {
        return
      }

      classSessionById.set(id, buildFallbackClassSessionFromId(id))
    })
  })

  return classSessionById
}

function buildFallbackClassSessionFromId(id) {
  const normalizedId = String(id || '')
  const timeMatch = normalizedId.match(/(\d{4})-(\d{4})$/)
  const startTime = timeMatch ? `${timeMatch[1].slice(0, 2)}:${timeMatch[1].slice(2)}` : ''
  const endTime = timeMatch ? `${timeMatch[2].slice(0, 2)}:${timeMatch[2].slice(2)}` : ''
  const dayLabel = normalizedId.includes('t4-t6')
    ? 'T4-T6'
    : normalizedId.includes('t7-cn')
      ? 'T7-CN'
      : ''
  const displayLabel =
    dayLabel && startTime && endTime ? `${dayLabel} ${startTime}-${endTime}` : normalizedId

  return {
    id: normalizedId,
    name: displayLabel,
    daysLabel: dayLabel,
    dayLabel,
    startTime,
    endTime,
    displayLabel,
    status: 'active',
  }
}

function renderAttendanceDetailField(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || 'Chưa cập nhật')}</strong>
    </div>
  `
}

function renderAttendanceNoteModal(noteFormState, rows, filters) {
  if (!noteFormState?.studentId) {
    return ''
  }

  const row = rows.find((candidate) => candidate.student.id === noteFormState.studentId)
  const month = noteFormState.month || filters.month
  const note = String(noteFormState.note || '')

  return `
    <div class="attendance-detail-backdrop" role="presentation" data-attendance-note-cancel></div>
    <section class="attendance-note-modal" role="dialog" aria-modal="true" aria-label="Ghi chú điểm danh">
      <header>
        <div>
          <h4>Ghi chú điểm danh</h4>
          <p>${escapeHtml(cleanDisplayText(row?.student.fullName || 'Học viên'))} · ${escapeHtml(month)}</p>
        </div>
        <button type="button" aria-label="Đóng" data-attendance-note-cancel>×</button>
      </header>
      <label>
        <span>Nội dung ghi chú</span>
        <textarea data-attendance-note-field placeholder="Nhập ghi chú riêng cho bảng điểm danh">${escapeHtml(note)}</textarea>
      </label>
      <div class="attendance-note-modal-actions">
        <button type="button" data-attendance-note-cancel>Hủy</button>
        <button type="button" data-attendance-note-save>Lưu ghi chú</button>
      </div>
    </section>
  `
}

function getAttendanceDetailTypeLabel(attendance) {
  if (attendance.attendanceStatus === 'trial' || attendance.countingStatus === 'trial') {
    return 'Học thử'
  }

  if (isCombinedAttendanceItem(attendance)) {
    return 'Học bù / ghi nhận nhiều buổi'
  }

  return attendanceStatusLabels[attendance.attendanceStatus] || 'Buổi học'
}

function getAttendanceCreditLabel(credit, attendance) {
  if (credit?.creditType === 'trial' || String(credit?.displayValue || '').toUpperCase() === 'T') {
    return 'T · Học thử'
  }

  const value = getAttendanceCreditDisplayValue(credit)
  const packageLabel = attendance.cycleLabel ? ` · ${attendance.cycleLabel}` : ''
  return `${value}${packageLabel}`
}

function getAttendanceDisplayValueForDetail(attendance) {
  if (isCombinedAttendanceItem(attendance)) {
    return attendance.displayValue || attendance.credits.map((credit) => getAttendanceCreditDisplayValue(credit)).join(' ')
  }

  return attendance.displayValue || attendanceStatusLabels[attendance.attendanceStatus] || 'Có dữ liệu'
}

function getAttendanceCreditDisplayValue(credit) {
  if (credit && typeof credit === 'object') {
    return String(credit.displayValue ?? credit.sessionNumber ?? credit.value ?? '')
  }

  return String(credit ?? '')
}

function isCombinedAttendanceItem(attendance) {
  return Boolean(
    attendance?.isCombinedCredit ||
      attendance?.needsMakeupReview ||
      (Array.isArray(attendance?.credits) && attendance.credits.length > 1),
  )
}

function renderStudiedSessions(attendanceSummary) {
  if (!attendanceSummary.hasReportData) {
    return '<span class="attendance-muted">Chưa có dữ liệu</span>'
  }

  return `<strong>${attendanceSummary.studiedCount}</strong><small>Nguồn: ${escapeHtml(getAttendanceSummarySourceLabel(attendanceSummary))}</small>`
}

function renderRemainingSessions(tuition, attendanceSummary) {
  if (!tuition) {
    return '<span class="attendance-muted">Chưa có gói</span><small>Nguồn: Học phí</small>'
  }

  const totalSessions = Number(tuition.totalSessions)
  const usedSessions = Number(tuition.usedSessions)

  if (!Number.isFinite(totalSessions) || totalSessions <= 0 || !Number.isFinite(usedSessions) || usedSessions < 0) {
    return '<span class="attendance-muted">Chưa đủ dữ liệu</span><small>Nguồn: Học phí</small>'
  }

  const studiedCount = attendanceSummary?.hasReportData ? attendanceSummary.studiedCount : usedSessions
  const normalizedStudiedCount = Math.max(0, Number(studiedCount) || 0)
  const cycleIndex = normalizedStudiedCount > 0 ? Math.floor((normalizedStudiedCount - 1) / totalSessions) + 1 : 1
  const sessionNumberInCycle = normalizedStudiedCount > 0 ? ((normalizedStudiedCount - 1) % totalSessions) + 1 : 0
  const remainingInCycle = sessionNumberInCycle ? totalSessions - sessionNumberInCycle : totalSessions
  const primaryLabel =
    normalizedStudiedCount > 0
      ? `Kỳ ${cycleIndex} · Buổi ${sessionNumberInCycle}/${totalSessions} · còn ${remainingInCycle}/${totalSessions}`
      : `${totalSessions}/${totalSessions} còn lại`

  return `
    <strong>${escapeHtml(primaryLabel)}</strong>
    <small>Đã học ${normalizedStudiedCount}/${totalSessions} · Gói ${totalSessions} buổi</small>
    <small>Nguồn: Học phí</small>
  `
}

function renderDataLineagePanel() {
  return `
    <details class="attendance-data-lineage">
      <summary>Kiểm tra dây dữ liệu</summary>
      <div>
        <p><strong>Nguồn dữ liệu thật:</strong> tên, mã học viên, phụ huynh, số điện thoại và classSessionIds đọc từ Module Học viên; ca học/lớp đọc từ Cài đặt cơ sở; gói buổi và số buổi còn lại đọc từ Học phí.</p>
        <p><strong>Ô ngày:</strong> số đã học đọc từ Báo cáo buổi học/sessionReports. Ô có badge Angel Wings là dữ liệu nhập từ bảng Angel Wings 06/2026; demo cũ không được dùng trong real mode.</p>
        <ol>
          <li>Sửa ca học của một học viên trong Module Học viên, quay lại Bảng điểm danh để kiểm tra học viên xuất hiện theo filter.</li>
          <li>Sửa gói hoặc số buổi trong Module Học phí, quay lại Bảng điểm danh để kiểm tra mẫu số như 8/12/16/32 thay đổi đúng.</li>
          <li>Xóa demo cũ, nạp Angel Wings, rồi filter từng ca để kiểm tra ô ngày, T học thử và các ô có dấu +.</li>
        </ol>
      </div>
    </details>
  `
}

function getVisibleAttendanceDates(rows, classSessions, filters) {
  const relevantClassSessions =
    filters.classSessionId !== 'all' && filters.classSessionId !== 'unassigned'
      ? classSessions.filter((classSession) => classSession.id === filters.classSessionId)
      : rows.flatMap((row) => row.classSessions).filter((classSession) => classSession.status !== 'inactive')
  const uniqueClassSessions = Array.from(
    new Map(relevantClassSessions.map((classSession) => [classSession.id, classSession])).values(),
  )
  const datesByKey = new Map()

  uniqueClassSessions.forEach((classSession) => {
    getAttendanceDatesForClassSession(classSession, filters.month).forEach((dateItem) => {
      datesByKey.set(dateItem.dateKey, dateItem)
    })
  })

  rows.forEach((row) => {
    row.attendanceSummary.byDate.forEach((_, dateKey) => {
      if (shouldShowAttendanceReportDate(dateKey, filters.month)) {
        const [year, month, day] = dateKey.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        datesByKey.set(dateKey, {
          dateKey,
          day,
          weekdayLabel: weekdayLabels[date.getDay()],
        })
      }
    })
  })

  if (!datesByKey.size) {
    return getAllDatesInMonth(filters.month)
  }

  return Array.from(datesByKey.values()).sort((firstDate, secondDate) =>
    firstDate.dateKey.localeCompare(secondDate.dateKey),
  )
}

function getStudentAttendanceSummary(studentId, reportLookup, tuition) {
  const attendanceItems = [...(reportLookup.get(studentId) || [])].sort((firstItem, secondItem) =>
    firstItem.dateKey.localeCompare(secondItem.dateKey),
  )
  const byDate = new Map()
  const packageTotalSessions = getPackageTotalSessions(tuition)
  const paidCycleCount = getPaidCycleCountFromTuition(tuition)
  let studiedCount = 0
  let creditCycleOffset = 0
  let lastDisplayedCredit = null

  attendanceItems.forEach((item) => {
    const countsTowardTuition =
      item.countsTowardTuition !== false && presentAttendanceStatuses.has(item.attendanceStatus)
    const credits = Array.isArray(item.credits) && item.credits.length ? item.credits : countsTowardTuition ? [1] : []

    if (countsTowardTuition) {
      if (packageTotalSessions && hasExplicitAttendanceCredits(item)) {
        credits.forEach((credit) => {
          const sessionNumber = getAttendanceCreditSessionNumber(credit)

          if (!Number.isFinite(sessionNumber)) {
            return
          }

          if (lastDisplayedCredit !== null && sessionNumber <= lastDisplayedCredit) {
            creditCycleOffset += packageTotalSessions
          }

          studiedCount = Math.max(studiedCount, creditCycleOffset + sessionNumber)
          lastDisplayedCredit = sessionNumber
        })
      } else {
        studiedCount += credits.length
      }
    }

    byDate.set(
      item.dateKey,
      decorateAttendanceCountingItem(
        {
          ...item,
          credits,
          countsTowardTuition,
        },
        studiedCount,
        packageTotalSessions,
        paidCycleCount,
      ),
    )
  })

  return {
    byDate,
    studiedCount,
    hasReportData: attendanceItems.length > 0,
    hasAngelWingsData: attendanceItems.some(isAngelWingsAttendanceItem),
    hasRealData: attendanceItems.some((item) => !isAngelWingsAttendanceItem(item)),
  }
}

function hasExplicitAttendanceCredits(item) {
  return Boolean(item?.displayValue && Array.isArray(item.credits) && item.credits.length > 0)
}

function getAttendanceCreditSessionNumber(credit) {
  if (credit && typeof credit === 'object') {
    return Number(credit.sessionNumber ?? credit.value ?? credit.displayValue)
  }

  return Number(credit)
}

function decorateAttendanceCountingItem(item, studiedCount, packageTotalSessions, paidCycleCount) {
  if (!item.countsTowardTuition) {
    return {
      ...item,
      displayValue: item.displayValue || attendanceStatusLabels[item.attendanceStatus] || '—',
      countingStatus: item.attendanceStatus === 'trial' ? 'trial' : 'warning',
      warning: item.note || '',
    }
  }

  const cycleState = computeAttendanceCycleState({
    packageTotalSessions,
    attendedPaidCredits: studiedCount,
    paidCycleCount,
    cellCredits: item.credits,
    countsTowardTuition: item.countsTowardTuition,
  })

  return {
    ...item,
    displayValue: item.displayValue || String(cycleState.sessionNumberInCycle || ''),
    isWrapStart: cycleState.startsNewCycle,
    countingStatus: cycleState.countingStatus,
    cycleLabel: cycleState.displayValue,
    remainingLabel: cycleState.remainingLabel,
    warning: cycleState.warning || item.note || '',
  }
}

function getAttendanceCellStatusClass(attendance) {
  if (attendance.countingStatus === 'unpaid') {
    return 'attendance-cell-unpaid'
  }

  if (attendance.countingStatus === 'warning') {
    return 'attendance-cell-warning'
  }

  if (attendance.countingStatus === 'trial') {
    return 'attendance-cell-trial'
  }

  return attendance.isWrapStart ? 'attendance-cell-paid is-wrap-start' : 'attendance-cell-paid'
}

function buildAttendanceReportLookup(sessionReports, monthValue) {
  return (sessionReports ?? []).reduce((lookup, report) => {
    if (isDemoAttendanceReport(report)) {
      return lookup
    }

    const dateKey = String(report.occurrenceDate || '')

    if (!dateKey || !shouldReadAttendanceReportForMonth(report, dateKey, monthValue)) {
      return lookup
    }

    ;(report.attendance ?? []).forEach((attendanceItem) => {
      const studentId = String(attendanceItem.studentId || '')

      if (!studentId) {
        return
      }

      const items = lookup.get(studentId) || []
      items.push({
        dateKey,
        attendanceStatus: attendanceItem.attendanceStatus || 'present',
        note: attendanceItem.note || '',
        studentName: attendanceItem.studentName || '',
        classSessionId: attendanceItem.classSessionId || report.classSessionId || '',
        teacherId: attendanceItem.teacherId || report.teacherId || '',
        teacherName: attendanceItem.teacherName || report.teacherName || '',
        occurrenceDate: attendanceItem.occurrenceDate || report.occurrenceDate || dateKey,
        status: attendanceItem.status || attendanceItem.attendanceStatus || 'present',
        isDemoAttendance: Boolean(attendanceItem.isDemoAttendance || report.isDemoAttendance),
        isImportedAttendance: Boolean(attendanceItem.isImportedAttendance || report.isImportedAttendance),
        sourceModule: attendanceItem.sourceModule || report.sourceModule || '',
        sourceTag: attendanceItem.sourceTag || report.sourceTag || '',
        importBatchId: attendanceItem.importBatchId || report.importBatchId || '',
        demoPaymentStatus: attendanceItem.demoPaymentStatus || '',
        displayValue: attendanceItem.displayValue || '',
        credits: Array.isArray(attendanceItem.credits) ? attendanceItem.credits : [],
        countsTowardTuition: attendanceItem.countsTowardTuition !== false,
        isCombinedCredit: Boolean(attendanceItem.isCombinedCredit),
        needsMakeupReview: Boolean(attendanceItem.needsMakeupReview),
      })
      lookup.set(studentId, items)
    })

    return lookup
  }, new Map())
}

function shouldReadAttendanceReportForMonth(report, dateKey, monthValue) {
  return dateKey.startsWith(monthValue)
}

function shouldShowAttendanceReportDate(dateKey, monthValue) {
  return dateKey.startsWith(monthValue)
}

function getAttendanceSummarySourceLabel(attendanceSummary) {
  if (attendanceSummary.hasAngelWingsData && attendanceSummary.hasRealData) {
    return 'Báo cáo buổi học + Angel Wings'
  }

  if (attendanceSummary.hasAngelWingsData) {
    return 'Angel Wings'
  }

  return 'Báo cáo buổi học'
}

function isAngelWingsAttendanceItem(item) {
  return Boolean(item?.sourceTag === ANGEL_WINGS_SOURCE_TAG || item?.sourceModule === ANGEL_WINGS_SOURCE_MODULE)
}

function buildAdvisoryNoteLookup(attendanceAdvisoryNotes, monthValue) {
  return (attendanceAdvisoryNotes ?? []).reduce((lookup, note) => {
    if (note.monthKey !== monthValue || !note.studentId) {
      return lookup
    }

    lookup.set(note.studentId, note)
    return lookup
  }, new Map())
}

function buildAttendanceBoardNoteLookup(attendanceBoardNotes, monthValue) {
  return (attendanceBoardNotes ?? []).reduce((lookup, note) => {
    const month = note.month || note.monthKey

    if (month !== monthValue || !note.studentId) {
      return lookup
    }

    lookup.set(note.studentId, note)
    return lookup
  }, new Map())
}

function getAttendanceBoardNote(_student, _advisoryNote, attendanceBoardNote) {
  const boardNote = String(attendanceBoardNote?.note || '').trim()

  return boardNote || '—'
}

function getCareStatusLabel(tuition) {
  if (!tuition || !Number.isFinite(Number(tuition.totalSessions)) || !Number.isFinite(Number(tuition.usedSessions))) {
    return 'Chưa đủ dữ liệu'
  }

  const remainingSessions = Number(tuition.totalSessions) - Number(tuition.usedSessions)

  if (remainingSessions < 0) {
    return 'Quá hạn'
  }

  if (remainingSessions === 0) {
    return 'Đến hạn'
  }

  if (remainingSessions <= 2) {
    return `Còn ${remainingSessions} buổi`
  }

  return 'Theo dõi bình thường'
}

function getAttendanceBoardStats(students, classSessions) {
  const activeStudents = students.filter((student) => !student.isDeleted)

  return {
    totalStudents: activeStudents.length,
    assignedStudents: activeStudents.filter((student) => normalizeIdList(student.classSessionIds).length > 0).length,
    unassignedStudents: activeStudents.filter((student) => normalizeIdList(student.classSessionIds).length === 0).length,
    totalClassSessions: classSessions.length,
  }
}

function getPackageTotalSessions(tuition) {
  const totalSessions = Number(tuition?.totalSessions)

  return Number.isFinite(totalSessions) && totalSessions > 0 ? totalSessions : 0
}

function getDemoAttendanceCountForStudent(studentIndex, packageTotalSessions, availableDateCount) {
  if (!availableDateCount) {
    return 0
  }

  if (!packageTotalSessions) {
    return Math.min(3, availableDateCount)
  }

  const targetCounts = [
    packageTotalSessions + 1,
    packageTotalSessions + 1,
    packageTotalSessions,
    Math.min(packageTotalSessions + 2, 12),
    Math.min(5, packageTotalSessions),
  ]
  const targetCount = targetCounts[studentIndex % targetCounts.length] || Math.min(4, packageTotalSessions)

  return Math.min(targetCount, availableDateCount)
}

function getAllDatesInMonth(monthValue) {
  const [year, month] = parseMonthValue(monthValue)
  const daysInMonth = new Date(year, month, 0).getDate()

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const date = new Date(year, month - 1, day)

    return {
      dateKey: formatDateKey(year, month, day),
      day,
      weekdayLabel: weekdayLabels[date.getDay()],
    }
  })
}

function getWeekdayIndex(label) {
  const normalizedLabel = String(label || '').trim().toUpperCase()

  if (normalizedLabel === 'CN') {
    return 0
  }

  const match = normalizedLabel.match(/^T([2-7])$/)

  if (!match) {
    return null
  }

  return Number(match[1]) - 1
}

function getClassSessionLabel(classSession) {
  return cleanDisplayText(classSession?.displayLabel || classSession?.name || classSession?.daysLabel || 'Ca học chưa đặt tên')
}

function normalizeAttendanceBoardFilters(filters) {
  return {
    month: isValidMonthValue(filters?.month) ? filters.month : getCurrentMonthValue(),
    classSessionId: String(filters?.classSessionId || 'all'),
    query: String(filters?.query || ''),
  }
}

function normalizeIdList(values) {
  return Array.isArray(values) ? values.map((value) => String(value || '').trim()).filter(Boolean) : []
}

function parseMonthValue(monthValue) {
  const [yearText, monthText] = String(monthValue || getCurrentMonthValue()).split('-')
  const year = Number(yearText)
  const month = Number(monthText)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const now = new Date()
    return [now.getFullYear(), now.getMonth() + 1]
  }

  return [year, month]
}

function isValidMonthValue(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))
}

function getCurrentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatAttendanceDate(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-')

  if (!year || !month || !day) {
    return String(dateKey || '')
  }

  return `${day}/${month}/${year}`
}

function cleanDisplayText(value) {
  const source = String(value ?? '')

  if (!/[ÃÂÄÆáºá»â€ï¿½]/.test(source)) {
    return source
  }

  const cp1252Bytes = []

  for (const char of source) {
    const codePoint = char.codePointAt(0)
    const mappedByte = getWindows1252Byte(codePoint)

    if (mappedByte === null) {
      return source
    }

    cp1252Bytes.push(mappedByte)
  }

  try {
    const decoded = new TextDecoder('utf-8').decode(new Uint8Array(cp1252Bytes))
    const sourceMarkerCount = countMojibakeMarkers(source)
    const decodedMarkerCount = countMojibakeMarkers(decoded)

    return decodedMarkerCount < sourceMarkerCount ? decoded : source
  } catch {
    return source
  }
}

function getWindows1252Byte(codePoint) {
  if (codePoint <= 0xff) {
    return codePoint
  }

  const windows1252Map = new Map([
    [0x20ac, 0x80],
    [0x201a, 0x82],
    [0x0192, 0x83],
    [0x201e, 0x84],
    [0x2026, 0x85],
    [0x2020, 0x86],
    [0x2021, 0x87],
    [0x02c6, 0x88],
    [0x2030, 0x89],
    [0x0160, 0x8a],
    [0x2039, 0x8b],
    [0x0152, 0x8c],
    [0x017d, 0x8e],
    [0x2018, 0x91],
    [0x2019, 0x92],
    [0x201c, 0x93],
    [0x201d, 0x94],
    [0x2022, 0x95],
    [0x2013, 0x96],
    [0x2014, 0x97],
    [0x02dc, 0x98],
    [0x2122, 0x99],
    [0x0161, 0x9a],
    [0x203a, 0x9b],
    [0x0153, 0x9c],
    [0x017e, 0x9e],
    [0x0178, 0x9f],
  ])

  return windows1252Map.get(codePoint) ?? null
}

function countMojibakeMarkers(value) {
  return (String(value || '').match(/Ã|Â|Ä|Æ|áº|á»|â€|ï¿½/g) || []).length
}

function normalizeSearchText(value) {
  return cleanDisplayText(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttribute(value) {
  return escapeHtml(value)
}
