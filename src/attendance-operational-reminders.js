const reminderOrder = Object.freeze({
  REVIEW_UPDATE_DUE: 1,
  TBHP_SEND_DUE: 2,
  PAYMENT_CHECK_DUE: 3,
})

export function groupV28AAttendanceRemindersByStudent(reminders = [], centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return (Array.isArray(reminders) ? reminders : []).reduce((grouped, reminder) => {
    const studentId = cleanText(reminder?.studentId)
    if (!studentId || (normalizedCenterId && cleanText(reminder?.centerId) !== normalizedCenterId)) {
      return grouped
    }
    const current = grouped.get(studentId) || []
    current.push(reminder)
    current.sort((first, second) => {
      const severityDelta = severityRank(second.severity) - severityRank(first.severity)
      if (severityDelta) return severityDelta
      const cycleDelta = Number(first.cycleNumber) - Number(second.cycleNumber)
      if (cycleDelta) return cycleDelta
      return (reminderOrder[first.signal] || 99) - (reminderOrder[second.signal] || 99)
    })
    grouped.set(studentId, current)
    return grouped
  }, new Map())
}

export function getV28AAttendanceReminderPresentation(reminders = []) {
  const normalized = Array.isArray(reminders) ? reminders.filter(Boolean) : []
  const isDanger = normalized.length > 1 || normalized.some((reminder) => reminder.severity === 'danger')
  return {
    count: normalized.length,
    tone: isDanger ? 'danger' : normalized.length ? 'warning' : 'normal',
    statusText: normalized.length > 1
      ? `${normalized.length} nhắc việc`
      : normalized[0]?.label || '',
  }
}

export function buildV28AAttendanceNotificationCandidates(reminders = [], students = [], options = {}) {
  const centerId = cleanText(options.centerId)
  const today = normalizeDateKey(options.today || new Date())
  if (!centerId || !today) return []
  const timestamp = `${today}T00:00:00.000Z`
  const studentsById = new Map(
    (Array.isArray(students) ? students : [])
      .filter((student) => student?.id && (!student.centerId || cleanText(student.centerId) === centerId))
      .map((student) => [cleanText(student.id), student]),
  )
  return (Array.isArray(reminders) ? reminders : [])
    .filter((reminder) => cleanText(reminder?.centerId) === centerId)
    .map((reminder) => {
      const student = studentsById.get(cleanText(reminder.studentId))
      if (!student) return null
      const studentLabel = cleanText(student.fullName || student.name) || 'Học viên'
      return {
        dedupeKey: `v2-8a:${reminder.cycleId}:${reminder.signal}`,
        sourceModule: 'bang-diem-danh',
        sourceLabel: 'Bảng điểm danh',
        type: 'attendance-operation',
        severity: reminder.severity === 'danger' ? 'danger' : 'warning',
        title: `${studentLabel}: ${reminder.label}`,
        message: getReminderMessage(reminder),
        entityId: cleanText(reminder.studentId),
        entityType: 'student',
        entityLabel: studentLabel,
        createdAt: `${reminder.triggerDate}T00:00:00.000Z`,
        updatedAt: timestamp,
        meta: {
          studentId: cleanText(reminder.studentId),
          cycleId: cleanText(reminder.cycleId),
          cycleNumber: Number(reminder.cycleNumber),
          signal: cleanText(reminder.signal),
          remainingSessions: Number(reminder.remainingSessions),
        },
      }
    })
    .filter(Boolean)
}

function getReminderMessage(reminder = {}) {
  if (reminder.signal === 'REVIEW_UPDATE_DUE') {
    return 'Cập nhật nhận xét cần thiết cho chu kỳ học hiện tại.'
  }
  if (reminder.signal === 'TBHP_SEND_DUE') {
    return 'Xác nhận gửi TBHP bằng đúng bước nghiệp vụ; đọc thông báo không hoàn tất việc này.'
  }
  return 'Kiểm tra giao dịch thu đã được ghi nhận hợp lệ trong Tài chính.'
}

function severityRank(value) {
  return value === 'danger' ? 2 : value === 'warning' ? 1 : 0
}

function normalizeDateKey(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  const normalized = cleanText(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : ''
}

function cleanText(value) {
  return String(value ?? '').trim()
}
