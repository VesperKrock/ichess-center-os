export const initialStaffFilters = {
  weekStartDate: getWeekStartDate(getTodayDate()),
  location: 'all',
  person: 'all',
}

const attendanceStatuses = ['Có mặt', 'Vắng', 'Dạy bù', 'Nghỉ phép', 'Chưa chấm']
const emptyStaffStateText = 'Chưa có đủ dữ liệu chấm công/ca dạy trong khoảng thời gian này.'

export function renderStaffModule({
  teachers = [],
  scheduleSessions = [],
  sessionReports = [],
  filters = initialStaffFilters,
} = {}) {
  const activeFilters = normalizeStaffFilters(filters)
  const staffData = buildStaffAttendanceData({
    teachers,
    scheduleSessions,
    sessionReports,
    filters: activeFilters,
  })

  return `
    <section class="staff-module" aria-label="Nhân viên / Chấm công">
      <div class="staff-filters" aria-label="Bộ lọc chấm công nhân viên">
        <label>
          <span>Tuần hiện tại</span>
          <input type="date" value="${escapeAttribute(activeFilters.weekStartDate)}" data-staff-filter="weekStartDate" />
        </label>
        <label>
          <span>Địa điểm dạy</span>
          <select data-staff-filter="location">
            ${renderOption('all', 'Tất cả địa điểm', activeFilters.location)}
            ${staffData.locationOptions
              .map((location) => renderOption(location, location, activeFilters.location))
              .join('')}
          </select>
        </label>
        <label>
          <span>Nhân sự / Giáo viên</span>
          <select data-staff-filter="person">
            ${renderOption('all', 'Tất cả nhân sự', activeFilters.person)}
            ${staffData.personOptions
              .map((person) => renderOption(person.key, person.name, activeFilters.person))
              .join('')}
          </select>
        </label>
      </div>

      <div class="staff-summary" aria-label="Tổng quan chấm công">
        ${renderStaffStat('Tổng nhân sự / giáo viên hoạt động', staffData.summary.activePeople, 'neutral')}
        ${renderStaffStat('Tổng buổi trong kỳ', staffData.summary.totalSessions, 'sessions')}
        ${renderStaffStat('Địa điểm dạy đang có', staffData.summary.locationCount, 'location')}
        ${renderStaffStat('Người hoạt động nhiều nhất', staffData.summary.topPersonLabel, 'top')}
      </div>

      <div class="staff-layout">
        <section class="staff-panel" aria-labelledby="staff-summary-table-title">
          <div class="staff-panel-heading">
            <h4 id="staff-summary-table-title">Tổng buổi theo nhân sự</h4>
            <span>${escapeHtml(staffData.weekLabel)}</span>
          </div>
          ${
            staffData.personRows.length
              ? renderStaffPersonTable(staffData.personRows)
              : `<p class="staff-empty">${emptyStaffStateText}</p>`
          }
        </section>

        <section class="staff-panel" aria-labelledby="staff-attendance-table-title">
          <div class="staff-panel-heading">
            <h4 id="staff-attendance-table-title">Bảng chấm công</h4>
            <span>${attendanceStatuses.join(' · ')}</span>
          </div>
          ${
            staffData.attendanceRows.length
              ? renderStaffAttendanceTable(staffData.attendanceRows)
              : `<p class="staff-empty">${emptyStaffStateText}</p>`
          }
        </section>
      </div>
    </section>
  `
}

export function buildStaffAttendanceData({
  teachers = [],
  scheduleSessions = [],
  sessionReports = [],
  filters = initialStaffFilters,
} = {}) {
  const activeFilters = normalizeStaffFilters(filters)
  const weekDays = buildWeekDays(activeFilters.weekStartDate)
  const teacherLookup = createTeacherLookup(teachers)
  const reportLookup = createSessionReportLookup(sessionReports)
  const allRows = buildAttendanceRows(scheduleSessions, weekDays, teacherLookup, reportLookup)
  const locationOptions = Array.from(new Set(allRows.map((row) => row.location).filter(Boolean))).sort(
    compareText,
  )
  const personOptions = buildPersonOptions(teachers, allRows)
  const filteredRows = allRows.filter((row) => {
    const matchesLocation = activeFilters.location === 'all' || row.location === activeFilters.location
    const matchesPerson = activeFilters.person === 'all' || row.personKey === activeFilters.person

    return matchesLocation && matchesPerson
  })
  const personRows = buildPersonRows(filteredRows)
  const topPerson = personRows[0] ?? null

  return {
    filters: activeFilters,
    weekLabel: `${formatDate(weekDays[0])} - ${formatDate(weekDays[weekDays.length - 1])}`,
    locationOptions,
    personOptions,
    attendanceRows: filteredRows,
    personRows,
    summary: {
      activePeople: personRows.length,
      totalSessions: filteredRows.length,
      locationCount: new Set(filteredRows.map((row) => row.location).filter(Boolean)).size,
      topPersonLabel: topPerson
        ? `${topPerson.personName} · ${topPerson.totalSessions.toLocaleString('vi-VN')} buổi`
        : 'Chưa có dữ liệu',
    },
  }
}

function buildAttendanceRows(scheduleSessions, weekDays, teacherLookup, reportLookup) {
  return (Array.isArray(scheduleSessions) ? scheduleSessions : [])
    .flatMap((session) => expandSessionToWeekRows(session, weekDays))
    .filter((row) => row.personName || row.teacherId)
    .map((row) => {
      const teacher = row.teacherId ? teacherLookup.get(String(row.teacherId)) : null
      const personName = getTeacherDisplayName(teacher) || row.personName || 'Chưa rõ giáo viên'
      const personKey = row.teacherId ? `teacher:${row.teacherId}` : `name:${normalizeText(personName)}`
      const report = reportLookup.get(`${row.sessionId}:${row.date}`)

      return {
        ...row,
        personName,
        personKey,
        status: getAttendanceStatus(row, report),
        note: report?.classSituation || report?.teachingAssistantNotes || row.note || '—',
      }
    })
    .sort(
      (firstRow, secondRow) =>
        String(firstRow.date).localeCompare(String(secondRow.date)) ||
        String(firstRow.startTime).localeCompare(String(secondRow.startTime)) ||
        compareText(firstRow.personName, secondRow.personName),
    )
}

function expandSessionToWeekRows(session, weekDays) {
  if (!session || session.status === 'archived') {
    return []
  }

  if (session.scheduleType === 'oneOff') {
    const date = String(session.date ?? '').slice(0, 10)

    if (!weekDays.includes(date)) {
      return []
    }

    return [buildAttendanceRow(session, date)]
  }

  return weekDays
    .filter((date) => {
      if (getDayOfWeekId(date) !== session.dayOfWeek) {
        return false
      }

      const startDate = String(session.startDate ?? '')
      const endDate = String(session.endDate ?? '')

      return (!startDate || date >= startDate) && (!endDate || date <= endDate)
    })
    .map((date) => buildAttendanceRow(session, date))
}

function buildAttendanceRow(session, date) {
  return {
    id: `${session.id}-${date}`,
    sessionId: session.id,
    date,
    teacherId: String(session.teacherId || ''),
    personName: String(session.teacherName || ''),
    location: String(session.room || 'Chưa có địa điểm'),
    className: session.title || session.groupName || 'Ca dạy',
    startTime: session.startTime || '',
    endTime: session.endTime || '',
    scheduleStatus: session.status || 'scheduled',
    occurrenceReason: session.occurrenceReason || '',
    note: session.note || '',
  }
}

function buildPersonRows(attendanceRows) {
  const rowMap = new Map()

  attendanceRows.forEach((row) => {
    if (!rowMap.has(row.personKey)) {
      rowMap.set(row.personKey, {
        personName: row.personName,
        locations: new Set(),
        totalSessions: 0,
        latestSession: '',
        notes: new Set(),
      })
    }

    const item = rowMap.get(row.personKey)
    item.locations.add(row.location)
    item.totalSessions += 1
    item.latestSession = !item.latestSession || row.date > item.latestSession ? row.date : item.latestSession

    if (row.status === 'Chưa chấm') {
      item.notes.add('Có buổi chưa chấm')
    }
  })

  return Array.from(rowMap.values())
    .map((item) => ({
      ...item,
      locations: Array.from(item.locations).sort(compareText),
      note: item.notes.size ? Array.from(item.notes).join(', ') : 'Theo ca dạy hiện có',
    }))
    .sort(
      (firstRow, secondRow) =>
        secondRow.totalSessions - firstRow.totalSessions ||
        compareText(firstRow.personName, secondRow.personName),
    )
}

function buildPersonOptions(teachers, attendanceRows) {
  const optionMap = new Map()

  ;(teachers ?? []).forEach((teacher) => {
    const teacherName = getTeacherDisplayName(teacher)

    if (teacher?.id && teacherName) {
      optionMap.set(`teacher:${teacher.id}`, teacherName)
    }
  })

  attendanceRows.forEach((row) => {
    optionMap.set(row.personKey, row.personName)
  })

  return Array.from(optionMap, ([key, name]) => ({ key, name })).sort((first, second) =>
    compareText(first.name, second.name),
  )
}

function renderStaffPersonTable(rows) {
  return `
    <div class="staff-table-wrap">
      <table class="staff-table">
        <thead>
          <tr>
            <th>Nhân sự</th>
            <th>Địa điểm dạy</th>
            <th>Tổng buổi</th>
            <th>Buổi gần nhất</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.personName)}</td>
                  <td>${escapeHtml(row.locations.join(', ') || 'Chưa có địa điểm')}</td>
                  <td><strong>${row.totalSessions.toLocaleString('vi-VN')}</strong></td>
                  <td>${formatDate(row.latestSession)}</td>
                  <td>${escapeHtml(row.note)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderStaffAttendanceTable(rows) {
  return `
    <div class="staff-table-wrap staff-attendance-table-wrap">
      <table class="staff-table staff-attendance-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Nhân sự/Giáo viên</th>
            <th>Địa điểm dạy</th>
            <th>Ca/Lớp</th>
            <th>Trạng thái</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(renderStaffAttendanceRow).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderStaffAttendanceRow(row) {
  return `
    <tr>
      <td>
        <strong>${formatDate(row.date)}</strong>
        <span>${escapeHtml(formatTimeRange(row))}</span>
      </td>
      <td>${escapeHtml(row.personName)}</td>
      <td>${escapeHtml(row.location)}</td>
      <td>${escapeHtml(row.className)}</td>
      <td><span class="staff-status is-${getStatusTone(row.status)}">${escapeHtml(row.status)}</span></td>
      <td title="${escapeAttribute(row.note)}">${escapeHtml(row.note)}</td>
    </tr>
  `
}

function renderStaffStat(label, value, tone) {
  return `
    <article class="staff-stat is-${tone}">
      <span>${label}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `
}

function getAttendanceStatus(row, report) {
  if (row.scheduleStatus === 'cancelled') {
    return 'Vắng'
  }

  if (row.occurrenceReason === 'makeup') {
    return 'Dạy bù'
  }

  if (report) {
    return 'Có mặt'
  }

  return 'Chưa chấm'
}

function getStatusTone(status) {
  const tones = {
    'Có mặt': 'present',
    Vắng: 'absent',
    'Dạy bù': 'makeup',
    'Nghỉ phép': 'leave',
    'Chưa chấm': 'pending',
  }

  return tones[status] ?? 'pending'
}

function createTeacherLookup(teachers) {
  return new Map((teachers ?? []).map((teacher) => [String(teacher.id), teacher]))
}

function createSessionReportLookup(sessionReports) {
  return new Map(
    (sessionReports ?? []).map((report) => [
      `${report.sessionId}:${report.occurrenceDate || report.date}`,
      report,
    ]),
  )
}

function normalizeStaffFilters(filters = {}) {
  return {
    weekStartDate: isDateKey(filters.weekStartDate)
      ? getWeekStartDate(filters.weekStartDate)
      : getWeekStartDate(getTodayDate()),
    location: String(filters.location || 'all'),
    person: String(filters.person || 'all'),
  }
}

function buildWeekDays(weekStartDate) {
  const startDate = parseDateKey(weekStartDate) ?? new Date()
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(startDate, index)))
}

function getWeekStartDate(value) {
  const date = parseDateKey(value) ?? new Date()
  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day

  return toDateKey(addDays(date, mondayOffset))
}

function getDayOfWeekId(value) {
  const date = parseDateKey(value)

  if (!date) {
    return ''
  }

  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    date.getDay()
  ]
}

function getTodayDate() {
  return toDateKey(new Date())
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function parseDateKey(value) {
  if (!isDateKey(value)) {
    return null
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))
}

function formatDate(value) {
  const [year, month, day] = String(value ?? '').split('-')
  return year && month && day ? `${day}/${month}/${year}` : '—'
}

function formatTimeRange(row) {
  return [row.startTime, row.endTime].filter(Boolean).join(' - ') || 'Chưa có giờ'
}

function getTeacherDisplayName(teacher) {
  return String(teacher?.displayName || teacher?.fullName || teacher?.name || '').trim()
}

function compareText(firstValue, secondValue) {
  return String(firstValue ?? '').localeCompare(String(secondValue ?? ''), 'vi', {
    sensitivity: 'base',
  })
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function renderOption(value, label, selectedValue) {
  return `<option value="${escapeAttribute(value)}" ${
    String(value) === String(selectedValue) ? 'selected' : ''
  }>${escapeHtml(label)}</option>`
}

function escapeAttribute(value) {
  return String(value ?? '').replace(/"/g, '&quot;')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
