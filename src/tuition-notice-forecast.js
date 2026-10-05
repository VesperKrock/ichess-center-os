import {
  getV22ClassSessionWeekdays, normalizeV22Weekday, projectStudentsWithV22Enrollments,
} from './student-recurring-enrollment.js'

// Presentation only: reuse the Student's selected days, never the whole class
// cadence when an individualized enrollment selects fewer days.
export function projectTuitionNoticeWeekdays(student, enrollmentSets, classSessions) {
  if (!student || student.isDeleted || String(student.currentStatus || '').trim().toLowerCase() !== 'đang theo học') return []
  const [projected] = projectStudentsWithV22Enrollments([student], enrollmentSets, classSessions, true)
  const weekdays = []
  for (const entry of projected.recurringEnrollments) {
    const ca = classSessions.find(item => item.id === entry.classSessionId)
    if (!ca) return []
    if (ca.isDeleted || ca.cloudDeletedAt || ca.status !== 'active') continue
    const available = getV22ClassSessionWeekdays(ca)
    if (entry.legacyReviewRequired || !entry.weekdays.length || entry.weekdays.some(day => !available.includes(day))) return []
    weekdays.push(...entry.weekdays)
  }
  return weekdays
}

export function getTuitionNoticeGenerationDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)
}

export function forecastTuitionNotice({ generatedDate, packageSessions, usedSessions, weekdays = [] } = {}) {
  const days = Array.isArray(weekdays) ? weekdays.map(normalizeV22Weekday) : []
  if (!Number.isSafeInteger(packageSessions) || packageSessions < 1 || !days.length || days.some(day => !day)) return null
  const sessionsPerWeek = days.length
  const estimatedWeeks = Math.ceil(packageSessions / sessionsPerWeek) + 1
  let estimatedNextCycleStartDate = ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(generatedDate || '') ? new Date(`${generatedDate}T00:00:00Z`) : null
  if (date && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === generatedDate
    && Number.isSafeInteger(usedSessions) && usedSessions >= 0) {
    let remaining = Math.max(packageSessions - usedSessions, 0)
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    // Skip complete weeks, then enumerate strictly after the generation day.
    date.setUTCDate(date.getUTCDate() + Math.floor(remaining / sessionsPerWeek) * 7)
    remaining %= sessionsPerWeek
    for (let offset = 1; offset <= 7; offset++) {
      date.setUTCDate(date.getUTCDate() + 1)
      const occurrences = days.filter(day => day === dayKeys[date.getUTCDay()]).length
      if (occurrences > remaining) {
        estimatedNextCycleStartDate = date.toISOString().slice(0, 10)
        break
      }
      remaining -= occurrences
    }
  }
  return Object.freeze({ sessionsPerWeek, estimatedWeeks, estimatedNextCycleStartDate })
}

export function buildTuitionNoticeForecastLines(forecast) {
  if (!forecast) return []
  const lines = [`Với lịch học ${forecast.sessionsPerWeek} buổi/tuần, thời gian dự kiến hoàn thành khóa học khoảng ${forecast.estimatedWeeks} tuần.`]
  if (forecast.estimatedNextCycleStartDate) {
    const date = forecast.estimatedNextCycleStartDate
    const weekday = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][new Date(`${date}T00:00:00Z`).getUTCDay()]
    const [year, month, day] = date.split('-')
    lines.push(`Buổi học đầu tiên của khóa mới dự kiến bắt đầu từ ${weekday}, ${day}/${month}/${year}.`)
  }
  return lines
}
