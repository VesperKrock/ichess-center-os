const COUNTED_ATTENDANCE_STATUSES = new Set([
  'present',
  'makeup',
  'unexcusedAbsent',
])

export const advisoryCareStatusLabels = {
  auto: 'Tự động',
  needReview: 'Cần chăm sóc',
  sentComment: 'Đã gửi nhận xét',
  contactedParent: 'Đã liên hệ phụ huynh',
  waitingParent: 'Chờ phụ huynh phản hồi',
  completed: 'Đã xử lý',
}

export function getCurrentMonthKey(referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function buildAttendanceAdvisoryRows(
  students = [],
  tuitionRecords = [],
  sessionReports = [],
  advisoryNotes = [],
  monthKey = getCurrentMonthKey(),
) {
  const tuitionByStudentId = new Map(
    tuitionRecords
      .filter((record) => record?.studentId)
      .map((record) => [String(record.studentId), record]),
  )
  const notesByStudentId = new Map(
    advisoryNotes
      .filter((note) => note?.studentId && note.monthKey === monthKey)
      .map((note) => [String(note.studentId), note]),
  )
  const reportCounts = getAttendanceCountsByStudent(sessionReports, monthKey)

  return students
    .filter((student) => student && !student.isDeleted)
    .map((student) => {
      const studentId = String(student.id ?? '')
      const tuition = tuitionByStudentId.get(studentId) ?? null
      const reportCount = reportCounts.get(studentId)
      const hasTuitionUsedSessions =
        tuition &&
        tuition.hasUsedSessionsData !== false &&
        tuition.usedSessions !== null &&
        tuition.usedSessions !== undefined &&
        Number.isFinite(Number(tuition.usedSessions))
      const learnedSessions = reportCount?.hasAttendance
        ? reportCount.count
        : hasTuitionUsedSessions
          ? Math.max(0, Number(tuition.usedSessions))
          : 0
      const totalSessions =
        tuition &&
        tuition.hasTotalSessionsData !== false &&
        tuition.totalSessions !== null &&
        tuition.totalSessions !== undefined &&
        Number.isFinite(Number(tuition.totalSessions))
          ? Math.max(0, Number(tuition.totalSessions))
          : null
      const hasLearningData = Boolean(reportCount?.hasAttendance || hasTuitionUsedSessions)
      const remainingSessions =
        totalSessions === null || !hasLearningData ? null : totalSessions - learnedSessions
      const warning = getAttendanceAdvisoryWarning({
        hasPackage: Boolean(tuition),
        hasLearningData,
        remainingSessions,
      })
      const savedNote = notesByStudentId.get(studentId)

      return {
        student,
        tuition,
        monthKey,
        totalSessions,
        learnedSessions,
        remainingSessions,
        warning,
        careStatus: savedNote?.careStatus || 'auto',
        careStatusLabel:
          savedNote?.careStatus && savedNote.careStatus !== 'auto'
            ? advisoryCareStatusLabels[savedNote.careStatus]
            : getAutomaticCareSuggestion(remainingSessions, warning.key),
        note: savedNote?.note || '',
        source: reportCount?.hasAttendance
          ? 'Điểm danh report'
          : hasTuitionUsedSessions
            ? 'Dữ liệu Học phí'
            : 'Chưa đủ dữ liệu',
      }
    })
}

export function getAttendanceCountsByStudent(sessionReports = [], monthKey) {
  const counts = new Map()
  const seenOccurrences = new Set()

  sessionReports.forEach((report) => {
    if (!report?.sessionId || !String(report.occurrenceDate ?? '').startsWith(monthKey)) {
      return
    }

    ;(Array.isArray(report.attendance) ? report.attendance : []).forEach((item) => {
      const studentId = String(item?.studentId ?? '').trim()

      if (!studentId) {
        return
      }

      const occurrenceKey = `${studentId}:${report.sessionId}:${report.occurrenceDate}`
      const current = counts.get(studentId) ?? { count: 0, hasAttendance: false }
      current.hasAttendance = true

      if (
        COUNTED_ATTENDANCE_STATUSES.has(item.attendanceStatus) &&
        !seenOccurrences.has(occurrenceKey)
      ) {
        current.count += 1
        seenOccurrences.add(occurrenceKey)
      }

      counts.set(studentId, current)
    })
  })

  return counts
}

export function getAttendanceAdvisoryWarning({
  hasPackage,
  hasLearningData,
  remainingSessions,
}) {
  if (!hasPackage) {
    return { key: 'no-package', label: 'Chưa có gói', tone: 'muted' }
  }

  if (!hasLearningData || remainingSessions === null) {
    return { key: 'missing-data', label: 'Chưa đủ dữ liệu', tone: 'muted' }
  }

  if (remainingSessions > 2) {
    return { key: 'normal', label: 'Bình thường', tone: 'normal' }
  }

  if (remainingSessions === 2) {
    return { key: 'remaining-2', label: 'Còn 2 buổi', tone: 'info' }
  }

  if (remainingSessions === 1) {
    return { key: 'remaining-1', label: 'Còn 1 buổi', tone: 'warning' }
  }

  if (remainingSessions === 0) {
    return { key: 'remaining-0', label: 'Còn 0 buổi', tone: 'due' }
  }

  if (remainingSessions === -1) {
    return { key: 'overdue-1', label: 'Quá hạn 1 buổi', tone: 'danger' }
  }

  return { key: 'overdue-many', label: 'Quá hạn nhiều buổi', tone: 'danger' }
}

function getAutomaticCareSuggestion(remainingSessions, warningKey) {
  if (warningKey === 'remaining-2') {
    return 'Chuẩn bị gửi file nhận xét/chăm sóc'
  }

  if (warningKey === 'remaining-1') {
    return 'Cần nhắc phụ huynh sắp hết khóa'
  }

  if (warningKey === 'remaining-0') {
    return 'Cần tư vấn khóa tiếp theo'
  }

  if (Number.isFinite(remainingSessions) && remainingSessions < 0) {
    return 'Cần xử lý quá hạn/gói tiếp theo'
  }

  return warningKey === 'missing-data' ? 'Cần kiểm tra dữ liệu' : 'Theo dõi bình thường'
}
