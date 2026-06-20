const TEACHER_REPORT_DEADLINE_HOUR = 10
const TEACHER_REPORT_DEADLINE_MINUTE = 0
const ADMIN_REVIEW_DEADLINE_HOURS = 48
const ADMIN_REVIEW_SOURCES = new Set(['admin', 'consultant'])

export function getTeacherReportDeadline(session = {}) {
  const occurrenceDate = normalizeDateKey(session.occurrenceDate || session.date)

  if (!occurrenceDate) {
    return null
  }

  const deadline = parseLocalDate(occurrenceDate)
  if (!deadline) {
    return null
  }

  deadline.setDate(deadline.getDate() + 1)
  deadline.setHours(TEACHER_REPORT_DEADLINE_HOUR, TEACHER_REPORT_DEADLINE_MINUTE, 0, 0)
  return deadline
}

export function isTeacherReportOverdue(session = {}, now = new Date()) {
  const deadline = getTeacherReportDeadline(session)
  return Boolean(deadline && normalizeDate(now).getTime() > deadline.getTime())
}

export function getAdminReviewDeadline(session = {}) {
  const occurrenceEnd = getSessionOccurrenceEnd(session)

  if (!occurrenceEnd) {
    return null
  }

  const deadline = new Date(occurrenceEnd.getTime())
  deadline.setHours(deadline.getHours() + ADMIN_REVIEW_DEADLINE_HOURS)
  return deadline
}

export function isAdminReviewOverdue(session = {}, now = new Date()) {
  const deadline = getAdminReviewDeadline(session)
  return Boolean(deadline && normalizeDate(now).getTime() > deadline.getTime())
}

export function getTeacherReportStatus({
  session = {},
  attendanceRecords = [],
  sessionReports = [],
  now = new Date(),
} = {}) {
  const occurrenceDate = normalizeDateKey(session.occurrenceDate || session.date)
  const sessionId = normalizeText(session.id)
  const deadline = getTeacherReportDeadline(session)

  if (!occurrenceDate || !sessionId || !deadline) {
    return createTeacherDeadlineStatus('unknown', session, deadline, {
      teacherSubmitted: false,
      adminHandled: false,
    })
  }

  const currentTime = normalizeDate(now)
  const occurrenceEnd = getSessionOccurrenceEnd(session)
  const teacherSubmitted =
    hasTeacherAttendanceRecord(session, attendanceRecords) ||
    hasMeaningfulTeacherSessionReport(session, sessionReports)
  const adminHandled = hasAdminAttendanceRecord(session, attendanceRecords)

  if (teacherSubmitted) {
    return createTeacherDeadlineStatus('teacherSubmitted', session, deadline, {
      teacherSubmitted,
      adminHandled,
    })
  }

  if (occurrenceEnd && currentTime.getTime() <= occurrenceEnd.getTime()) {
    return createTeacherDeadlineStatus('upcoming', session, deadline, {
      teacherSubmitted,
      adminHandled,
    })
  }

  if (currentTime.getTime() <= deadline.getTime()) {
    return createTeacherDeadlineStatus('waitingTeacher', session, deadline, {
      teacherSubmitted,
      adminHandled,
    })
  }

  return createTeacherDeadlineStatus(
    adminHandled ? 'adminHandledMissingTeacherReport' : 'overdueTeacher',
    session,
    deadline,
    {
      teacherSubmitted,
      adminHandled,
    },
  )
}

export function getAdminReviewStatus({
  session = {},
  attendanceRecords = [],
  sessionReports = [],
  now = new Date(),
} = {}) {
  const occurrenceDate = normalizeDateKey(session.occurrenceDate || session.date)
  const sessionId = normalizeText(session.id)
  const deadline = getAdminReviewDeadline(session)

  if (!occurrenceDate || !sessionId || !deadline) {
    return createAdminReviewStatus('unknown', session, deadline, {
      teacherSubmitted: false,
      adminHandled: false,
    })
  }

  const currentTime = normalizeDate(now)
  const occurrenceEnd = getSessionOccurrenceEnd(session)
  const teacherSubmitted =
    hasTeacherAttendanceRecord(session, attendanceRecords) ||
    hasMeaningfulTeacherSessionReport(session, sessionReports)
  const adminHandled = hasAdminReviewRecord(session, attendanceRecords)

  if (adminHandled) {
    return createAdminReviewStatus('adminHandled', session, deadline, {
      teacherSubmitted,
      adminHandled,
    })
  }

  if (occurrenceEnd && currentTime.getTime() <= occurrenceEnd.getTime()) {
    return createAdminReviewStatus('upcoming', session, deadline, {
      teacherSubmitted,
      adminHandled,
    })
  }

  if (currentTime.getTime() <= deadline.getTime()) {
    return createAdminReviewStatus(
      teacherSubmitted ? 'teacherSubmittedWaitingAdminReview' : 'adminReviewWaiting',
      session,
      deadline,
      {
        teacherSubmitted,
        adminHandled,
      },
    )
  }

  return createAdminReviewStatus('qtvAttentionNeeded', session, deadline, {
    teacherSubmitted,
    adminHandled,
  })
}

export function buildTeacherDeadlineAlerts({
  sessions = [],
  attendanceRecords = [],
  sessionReports = [],
  teachers = [],
  now = new Date(),
} = {}) {
  const teacherLookup = new Map(
    (Array.isArray(teachers) ? teachers : [])
      .filter((teacher) => teacher?.id)
      .map((teacher) => [String(teacher.id), teacher]),
  )

  return (Array.isArray(sessions) ? sessions : [])
    .map((session) => {
      const status = getTeacherReportStatus({
        session,
        attendanceRecords,
        sessionReports,
        now,
      })

      if (!['overdueTeacher', 'adminHandledMissingTeacherReport'].includes(status.status)) {
        return null
      }

      const teacher = session.teacherId ? teacherLookup.get(String(session.teacherId)) : null
      return {
        ...status,
        id: [
          'teacher-deadline',
          session.id || 'session',
          session.occurrenceDate || session.date || 'date',
        ].join('::'),
        sessionId: normalizeText(session.id),
        occurrenceDate: normalizeDateKey(session.occurrenceDate || session.date),
        title: normalizeText(session.title) || 'Buổi học',
        timeLabel: formatSessionTime(session),
        teacherName: getTeacherDisplayName(teacher, session),
        message:
          status.status === 'adminHandledMissingTeacherReport'
            ? 'Admin đã điểm danh thay, còn thiếu báo cáo Giáo viên.'
            : 'Giáo viên chưa gửi điểm danh/báo cáo đúng hạn.',
      }
    })
    .filter(Boolean)
}

export function buildAdminReviewDeadlineAlerts({
  sessions = [],
  attendanceRecords = [],
  sessionReports = [],
  teachers = [],
  now = new Date(),
} = {}) {
  const teacherLookup = createTeacherLookup(teachers)

  return (Array.isArray(sessions) ? sessions : [])
    .map((session) => {
      const status = getAdminReviewStatus({
        session,
        attendanceRecords,
        sessionReports,
        now,
      })

      if (status.status !== 'qtvAttentionNeeded') {
        return null
      }

      const teacher = session.teacherId ? teacherLookup.get(String(session.teacherId)) : null
      return {
        ...status,
        id: [
          'admin-review-deadline',
          session.id || 'session',
          session.occurrenceDate || session.date || 'date',
        ].join('::'),
        group: 'adminReview',
        sessionId: normalizeText(session.id),
        occurrenceDate: normalizeDateKey(session.occurrenceDate || session.date),
        title: normalizeText(session.title) || 'Buổi học',
        timeLabel: formatSessionTime(session),
        teacherName: getTeacherDisplayName(teacher, session),
        deadlineKind: 'adminReview',
        deadlineTitle: 'Hạn Admin/Tư vấn kiểm',
        message: 'Admin/Tư vấn chưa kiểm điểm danh đúng hạn.',
        escalationMessage: 'Ca này đã quá hạn xử lý tại cơ sở. Cần QTV/anh Hải chú ý.',
      }
    })
    .filter(Boolean)
}

export function buildScheduleDeadlineAlerts({
  sessions = [],
  attendanceRecords = [],
  sessionReports = [],
  teachers = [],
  now = new Date(),
} = {}) {
  return [
    ...buildTeacherDeadlineAlerts({
      sessions,
      attendanceRecords,
      sessionReports,
      teachers,
      now,
    }).map((alert) => ({
      ...alert,
      group: 'teacher',
      deadlineKind: 'teacherReport',
      deadlineTitle: 'Hạn gửi',
    })),
    ...buildAdminReviewDeadlineAlerts({
      sessions,
      attendanceRecords,
      sessionReports,
      teachers,
      now,
    }),
  ]
}

function createTeacherDeadlineStatus(status, session, deadline, flags = {}) {
  return {
    status,
    deadline,
    deadlineLabel: formatDeadlineLabel(deadline),
    occurrenceDate: normalizeDateKey(session?.occurrenceDate || session?.date),
    teacherSubmitted: Boolean(flags.teacherSubmitted),
    adminHandled: Boolean(flags.adminHandled),
  }
}

function createAdminReviewStatus(status, session, deadline, flags = {}) {
  return {
    status,
    deadline,
    deadlineLabel: formatDeadlineLabel(deadline),
    occurrenceDate: normalizeDateKey(session?.occurrenceDate || session?.date),
    teacherSubmitted: Boolean(flags.teacherSubmitted),
    adminHandled: Boolean(flags.adminHandled),
  }
}

function hasTeacherAttendanceRecord(session, attendanceRecords = []) {
  return hasMatchingAttendanceRecord(session, attendanceRecords, 'teacher')
}

function hasAdminAttendanceRecord(session, attendanceRecords = []) {
  return hasMatchingAttendanceRecord(session, attendanceRecords, 'admin')
}

function hasAdminReviewRecord(session, attendanceRecords = []) {
  return (Array.isArray(attendanceRecords) ? attendanceRecords : []).some((record) =>
    ADMIN_REVIEW_SOURCES.has(record?.source) &&
    normalizeText(record.studentId) &&
    normalizeDateKey(record.date || record.occurrenceDate) === normalizeDateKey(session?.occurrenceDate || session?.date) &&
    getRecordSessionKey(record) === normalizeText(session?.id),
  )
}

function hasMatchingAttendanceRecord(session, attendanceRecords = [], source) {
  const sessionId = normalizeText(session?.id)
  const occurrenceDate = normalizeDateKey(session?.occurrenceDate || session?.date)

  return (Array.isArray(attendanceRecords) ? attendanceRecords : []).some((record) =>
    record?.source === source &&
    normalizeText(record.studentId) &&
    normalizeDateKey(record.date || record.occurrenceDate) === occurrenceDate &&
    getRecordSessionKey(record) === sessionId,
  )
}

function createTeacherLookup(teachers = []) {
  return new Map(
    (Array.isArray(teachers) ? teachers : [])
      .filter((teacher) => teacher?.id)
      .map((teacher) => [String(teacher.id), teacher]),
  )
}

function hasMeaningfulTeacherSessionReport(session, sessionReports = []) {
  const report = (Array.isArray(sessionReports) ? sessionReports : []).find((item) =>
    normalizeText(item?.sessionId) === normalizeText(session?.id) &&
    normalizeDateKey(item?.occurrenceDate) === normalizeDateKey(session?.occurrenceDate || session?.date),
  )

  if (!report || isDemoSessionReport(report)) {
    return false
  }

  return hasMeaningfulAttendance(report.attendance) ||
    hasMeaningfulGuestParticipants(report.guestParticipants) ||
    hasMeaningfulLearningGroups(report.learningGroups) ||
    hasMeaningfulText(report.teachingAssistantNotes) ||
    hasMeaningfulText(report.classSituation) ||
    hasMeaningfulText(report.suggestions) ||
    hasMeaningfulText(report.trelloReportText) ||
    hasMeaningfulText(report.reportText)
}

function hasMeaningfulAttendance(attendance) {
  return (Array.isArray(attendance) ? attendance : []).some((item) =>
    normalizeText(item?.studentId) && normalizeText(item?.attendanceStatus),
  )
}

function hasMeaningfulGuestParticipants(guestParticipants) {
  return (Array.isArray(guestParticipants) ? guestParticipants : []).some((guest) =>
    hasMeaningfulText(guest?.displayName),
  )
}

function hasMeaningfulLearningGroups(learningGroups) {
  return (Array.isArray(learningGroups) ? learningGroups : []).some((group) =>
    hasMeaningfulText(group?.title) ||
    hasMeaningfulText(group?.note) ||
    (Array.isArray(group?.contentLines) && group.contentLines.some((line) => hasMeaningfulText(line))) ||
    (Array.isArray(group?.studentIds) && group.studentIds.length > 0),
  )
}

function isDemoSessionReport(report = {}) {
  return Boolean(
    report.isDemoAttendance ||
    report.sourceModule === 'bang-diem-danh-demo' ||
    report.demoBatchId === 'attendance-board-demo-foundation',
  )
}

function getSessionOccurrenceEnd(session = {}) {
  const occurrenceDate = normalizeDateKey(session.occurrenceDate || session.date)

  if (!occurrenceDate) {
    return null
  }

  const endTime = normalizeTime(session.endTime)
  if (!endTime) {
    const endOfDay = parseLocalDate(occurrenceDate)
    if (!endOfDay) {
      return null
    }
    endOfDay.setHours(23, 59, 59, 999)
    return endOfDay
  }

  return parseLocalDateTime(occurrenceDate, endTime)
}

function getRecordSessionKey(record = {}) {
  return normalizeText(
    record.sessionId ||
      record.scheduleSessionId ||
      record.classSessionId,
  )
}

function normalizeDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function normalizeDateKey(value) {
  return String(value ?? '').trim().slice(0, 10)
}

function normalizeTime(value) {
  const text = String(value ?? '').trim()
  return /^\d{2}:\d{2}$/.test(text) ? text : ''
}

function parseLocalDate(value) {
  const dateKey = normalizeDateKey(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null
  }

  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function parseLocalDateTime(dateValue, timeValue) {
  const date = parseLocalDate(dateValue)
  const time = normalizeTime(timeValue)
  if (!date || !time) {
    return null
  }

  const [hours, minutes] = time.split(':').map(Number)
  date.setHours(hours, minutes, 0, 0)
  return date
}

function formatDeadlineLabel(deadline) {
  if (!(deadline instanceof Date) || Number.isNaN(deadline.getTime())) {
    return ''
  }

  return `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}, ${deadline.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })}`
}

function formatSessionTime(session = {}) {
  return [session.startTime, session.endTime].map(normalizeTime).filter(Boolean).join('-') || 'Chưa rõ giờ'
}

function getTeacherDisplayName(teacher, session = {}) {
  return normalizeText(teacher?.displayName || teacher?.fullName || teacher?.name || session.teacherName) ||
    'Chưa rõ giáo viên'
}

function hasMeaningfulText(value) {
  return normalizeText(value).length > 0
}

function normalizeText(value) {
  return String(value ?? '').trim()
}
