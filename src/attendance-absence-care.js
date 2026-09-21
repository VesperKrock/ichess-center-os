const ABSENCE_STATUSES = new Set([
  'absent',
  'unexcusedAbsent',
  'excused',
  'excusedAbsent',
])

export function buildMonthlyAbsenceCareStates(
  attendanceRecords = [],
  monthKey = '',
  options = {},
) {
  const normalizedMonthKey = normalizeMonthKey(monthKey)
  const throughDate = normalizeDateKey(options.throughDate || new Date())
  const occurrencesByStudent = new Map()

  if (!normalizedMonthKey || !throughDate) {
    return new Map()
  }

  ;(Array.isArray(attendanceRecords) ? attendanceRecords : []).forEach((record) => {
    const studentId = String(record?.studentId || '').trim()
    const dateKey = normalizeDateKey(record?.date || record?.occurrenceDate)
    const attendanceStatus = String(record?.attendanceStatus || record?.status || '').trim()

    if (
      !studentId ||
      !dateKey.startsWith(`${normalizedMonthKey}-`) ||
      dateKey > throughDate ||
      !ABSENCE_STATUSES.has(attendanceStatus) ||
      isCancelledAttendanceOccurrence(record)
    ) {
      return
    }

    const occurrences = occurrencesByStudent.get(studentId) || new Set()
    occurrences.add(getAttendanceOccurrenceKey(record, studentId, dateKey))
    occurrencesByStudent.set(studentId, occurrences)
  })

  return new Map(
    Array.from(occurrencesByStudent.entries()).map(([studentId, occurrences]) => {
      const count = occurrences.size
      return [studentId, {
        studentId,
        monthKey: normalizedMonthKey,
        count,
        ...getMonthlyAbsenceCarePresentation(count),
      }]
    }),
  )
}

export function getMonthlyAbsenceCarePresentation(countValue) {
  const count = Number.isSafeInteger(Number(countValue))
    ? Math.max(0, Number(countValue))
    : 0

  if (count === 2) {
    return { key: 'absence-2', label: 'Vắng học 2 buổi', tone: 'info' }
  }

  if (count === 3) {
    return { key: 'absence-3', label: 'Vắng học 3 buổi', tone: 'warning' }
  }

  if (count === 4) {
    return { key: 'absence-4', label: 'Cần liên lạc phụ huynh', tone: 'danger' }
  }

  if (count > 4) {
    return {
      key: 'absence-high',
      label: `Cảnh báo: Vắng học ${count} buổi`,
      tone: 'critical',
    }
  }

  return { key: 'none', label: '', tone: 'normal' }
}

function getAttendanceOccurrenceKey(record, studentId, dateKey) {
  const sourceReportId = String(record?.sourceReportId || '').trim()
  const sourceAttendanceIndex = Number.isInteger(record?.sourceAttendanceIndex)
    ? record.sourceAttendanceIndex
    : null

  if (sourceReportId && sourceAttendanceIndex !== null) {
    return `${studentId}::${dateKey}::report::${sourceReportId}::${sourceAttendanceIndex}`
  }

  const occurrenceId = String(
    record?.scheduleSessionId ||
      record?.sessionId ||
      record?.raw?.attendanceItem?.scheduleSessionId ||
      record?.raw?.attendanceItem?.sessionId ||
      record?.raw?.report?.scheduleSessionId ||
      record?.raw?.report?.sessionId ||
      record?.classSessionId ||
      record?.authorityLocalId ||
      record?.id ||
      'attendance',
  ).trim()

  return `${studentId}::${dateKey}::occurrence::${occurrenceId}`
}

function isCancelledAttendanceOccurrence(record = {}) {
  const attendanceItem = record?.raw?.attendanceItem || {}
  const report = record?.raw?.report || {}
  if (
    record.isCancelled === true ||
    attendanceItem.isCancelled === true ||
    report.isCancelled === true
  ) {
    return true
  }

  return [
    record.occurrenceStatus,
    attendanceItem.occurrenceStatus,
    attendanceItem.scheduleStatus,
    report.occurrenceStatus,
    report.scheduleStatus,
    report.sessionStatus,
  ].some((status) => ['cancelled', 'canceled'].includes(String(status || '').trim().toLowerCase()))
}

function normalizeMonthKey(value) {
  const normalized = String(value || '').trim()
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) ? normalized : ''
}

function normalizeDateKey(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }

  const normalized = String(value || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return ''
  const [year, month, day] = normalized.split('-').map(Number)
  const candidate = new Date(year, month - 1, day)
  return candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
    ? normalized
    : ''
}
