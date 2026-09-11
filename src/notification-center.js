export const notificationSourceLabels = {
  'hoc-vien': 'Học viên',
  'hoc-phi': 'Học phí',
  'khach-hang-tu-van': 'Phụ huynh / Tư vấn',
  'kho-hang': 'Kho hàng',
  'giao-vien': 'Giáo viên',
  'thoi-khoa-bieu': 'Thời khóa biểu',
  'thu-chi': 'Thu chi',
  'so-quy': 'Sổ quỹ',
  'cai-dat-co-so': 'Cài đặt cơ sở',
  'he-thong': 'Hệ thống',
}

const activeInventoryRequestStatuses = new Set(['new', 'pending', 'preparing'])
const inactiveStudentStatuses = new Set(['Ngưng học'])
const oneOffAttentionLabels = {
  makeup: 'Học bù',
  trial: 'Học thử',
  extra: 'Buổi học thêm',
  event: 'Hoạt động',
  other: 'Buổi đột xuất',
}

const tuitionNotificationConfig = {
  'remaining-2': {
    severity: 'warning',
    titleSuffix: 'còn 2 buổi',
    message: 'Cần nhắc phụ huynh chuẩn bị tái đăng ký.',
  },
  'remaining-1': {
    severity: 'warning',
    titleSuffix: 'còn 1 buổi',
    message: 'Cần nhắc phụ huynh sớm.',
  },
  due: {
    severity: 'danger',
    titleSuffix: 'đến hạn học phí',
    message: 'Đã hết số buổi trong gói. Cần xử lý học phí hoặc tái đăng ký.',
  },
  overdue: {
    severity: 'danger',
    titleSuffix: 'quá hạn học phí',
    message: 'Đã học vượt số buổi đã đăng ký. Cần xử lý ngay.',
  },
}

const inventoryRequestStatusConfig = {
  new: { severity: 'info', label: 'mới' },
  pending: { severity: 'warning', label: 'chờ xử lý' },
  preparing: { severity: 'info', label: 'đang chuẩn bị' },
}

const derivedNotificationTypes = new Set([
  'student',
  'schedule',
  'report',
  'inventory',
  'tuition',
  'tuition-advisory',
  'inventory-request',
  'parent-followup',
])

export function buildStudentBirthdayNotificationCandidates(students, options = {}) {
  const today = normalizeDateKey(options.today || new Date())
  const centerId = String(options.centerId || '').trim()
  const timestamp = getDateKeyTimestamp(today)

  if (!today) {
    return []
  }

  return (students ?? [])
    .filter((student) => {
      const birthDate = normalizeDateKey(student?.birthDate)
      return student?.id
        && birthDate
        && birthDate.slice(5) === today.slice(5)
        && !inactiveStudentStatuses.has(String(student.currentStatus || '').trim())
        && (!centerId || !student.centerId || String(student.centerId) === centerId)
    })
    .map((student) => ({
      dedupeKey: `student-birthday:${student.id}:${today}`,
      sourceModule: 'hoc-vien',
      sourceLabel: notificationSourceLabels['hoc-vien'],
      type: 'student',
      severity: 'info',
      title: `Sinh nhật hôm nay: ${getEntityLabel(student, 'Học viên')}`,
      message: 'Mở hồ sơ học viên để xem thông tin liên hệ.',
      entityId: student.id,
      entityType: 'student',
      entityLabel: getEntityLabel(student, 'Học viên'),
      createdAt: timestamp,
      updatedAt: timestamp,
      meta: {
        studentId: String(student.id),
        signal: 'birthday-today',
        date: today,
      },
    }))
}

export function buildV24TuitionNotificationCandidates(studentStates, students, options = {}) {
  const today = normalizeDateKey(options.today || new Date())
  const centerId = String(options.centerId || '').trim()
  const timestamp = getDateKeyTimestamp(today)
  const studentsById = new Map((students ?? []).map((student) => [String(student?.id || ''), student]))

  if (!today) {
    return []
  }

  return (studentStates ?? []).flatMap((studentState) => {
    const studentId = String(studentState?.studentId || '').trim()
    const cycle = studentState?.currentCycle
    if (!studentId || !cycle?.id || studentState?.readiness !== 'READY') {
      return []
    }
    if (centerId && String(studentState.centerId || cycle.centerId || '') !== centerId) {
      return []
    }

    const student = studentsById.get(studentId)
    if (!student || (centerId && student.centerId && String(student.centerId) !== centerId)) {
      return []
    }
    const studentLabel = getEntityLabel(student, 'Học viên')
    const candidates = []
    const common = {
      sourceModule: 'hoc-phi',
      sourceLabel: notificationSourceLabels['hoc-phi'],
      type: 'tuition',
      entityId: studentId,
      entityType: 'student',
      entityLabel: studentLabel,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const addCandidate = (signal, severity, title, message) => {
      candidates.push({
        ...common,
        dedupeKey: `v2-4:${cycle.id}:${signal}`,
        severity,
        title,
        message,
        meta: {
          studentId,
          cycleId: String(cycle.id),
          signal,
          remainingSessions: cycle.remainingSessions,
          cycleNumber: cycle.cycleNumber,
        },
      })
    }

    const needsPackageSelection = cycle.lifecycleStatus === 'NEEDS_PACKAGE_SELECTION'
      || cycle.reminderState === 'PACKAGE_SELECTION_REQUIRED'
    const provisionalUnpaid = cycle.lifecycleStatus === 'PROVISIONAL_UNPAID'
      && cycle.paymentStatus !== 'PAID'

    if (needsPackageSelection) {
      addCandidate(
        'needs-package-selection',
        'danger',
        `${studentLabel} cần chọn gói học`,
        'Chu kỳ tạm thời chưa có đủ thông tin gói học.',
      )
    } else if (provisionalUnpaid) {
      addCandidate(
        'provisional-unpaid',
        'warning',
        `${studentLabel} có chu kỳ chưa thanh toán`,
        'Chu kỳ tiếp theo đang tạm thời chưa thanh toán.',
      )
    }

    if (cycle.renewalReminder) {
      const exhausted = Boolean(cycle.urgentRenewal)
      addCandidate(
        exhausted ? 'package-exhausted' : 'renewal-due',
        exhausted ? 'danger' : 'warning',
        exhausted
          ? `${studentLabel} đã hết buổi trong gói`
          : `${studentLabel} sắp hết gói học`,
        exhausted
          ? 'Cần xác nhận thanh toán hoặc gói học tiếp theo.'
          : 'Cần chuẩn bị gia hạn, thanh toán hoặc gói học tiếp theo.',
      )
    }

    if (cycle.bchtReminder) {
      addCandidate(
        'bcht-due',
        cycle.urgentRenewal ? 'danger' : 'warning',
        `Cần hoàn thành BCHT: ${studentLabel}`,
        'Báo cáo hết chuỗi của chu kỳ hiện tại chưa hoàn thành.',
      )
    }

    return candidates
  })
}

export function buildScheduleAttentionNotificationCandidates(occurrences, options = {}) {
  const today = normalizeDateKey(options.today || new Date())
  const centerId = String(options.centerId || '').trim()
  const timestamp = getDateKeyTimestamp(today)

  if (!today) {
    return []
  }

  return (occurrences ?? [])
    .filter((occurrence) => occurrence?.id
      && occurrence.scheduleType === 'oneOff'
      && normalizeDateKey(occurrence.occurrenceDate || occurrence.date) === today
      && occurrence.status !== 'cancelled'
      && (!centerId || !occurrence.centerId || String(occurrence.centerId) === centerId))
    .map((occurrence) => {
      const reason = String(occurrence.occurrenceReason || 'other').trim()
      const reasonLabel = oneOffAttentionLabels[reason] || oneOffAttentionLabels.other
      const sessionLabel = String(occurrence.title || occurrence.groupName || '').trim()

      return {
        dedupeKey: `schedule-attention:${occurrence.id}:${today}`,
        sourceModule: 'thoi-khoa-bieu',
        sourceLabel: notificationSourceLabels['thoi-khoa-bieu'],
        type: 'schedule',
        severity: ['makeup', 'trial'].includes(reason) ? 'warning' : 'info',
        title: `${reasonLabel} hôm nay${sessionLabel ? `: ${sessionLabel}` : ''}`,
        message: `${formatTimeRange(occurrence.startTime, occurrence.endTime)}${occurrence.room ? ` · ${occurrence.room}` : ''}`,
        entityId: occurrence.id,
        entityType: 'scheduleOccurrence',
        entityLabel: sessionLabel || reasonLabel,
        createdAt: timestamp,
        updatedAt: timestamp,
        meta: {
          sessionId: String(occurrence.id),
          occurrenceDate: today,
          occurrenceReason: reason,
          signal: 'today-one-off',
        },
      }
    })
}

export function buildMissingSessionReportNotificationCandidates(occurrences, sessionReports, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now())
  const today = normalizeDateKey(options.today || now)
  const centerId = String(options.centerId || '').trim()
  const timestamp = getDateKeyTimestamp(today)
  const reportKeys = new Set((sessionReports ?? [])
    .filter((report) => !centerId || !report?.centerId || String(report.centerId) === centerId)
    .map((report) => `${String(report?.sessionId || '').trim()}|${normalizeDateKey(report?.occurrenceDate)}`))

  if (!today || Number.isNaN(now.getTime())) {
    return []
  }

  return (occurrences ?? [])
    .filter((occurrence) => {
      const occurrenceDate = normalizeDateKey(occurrence?.occurrenceDate || occurrence?.date)
      const identityKey = `${String(occurrence?.id || '').trim()}|${occurrenceDate}`
      return occurrence?.id
        && occurrenceDate
        && occurrence.status !== 'cancelled'
        && (!centerId || !occurrence.centerId || String(occurrence.centerId) === centerId)
        && hasOccurrenceEnded(occurrence, occurrenceDate, today, now)
        && !reportKeys.has(identityKey)
    })
    .map((occurrence) => {
      const occurrenceDate = normalizeDateKey(occurrence.occurrenceDate || occurrence.date)
      const sessionLabel = String(occurrence.title || occurrence.groupName || 'Buổi học').trim()
      return {
        dedupeKey: `missing-session-report:${occurrence.id}:${occurrenceDate}`,
        sourceModule: 'thoi-khoa-bieu',
        sourceLabel: notificationSourceLabels['thoi-khoa-bieu'],
        type: 'report',
        severity: 'warning',
        title: `Chưa có báo cáo: ${sessionLabel}`,
        message: `Buổi học ${occurrenceDate} đã kết thúc nhưng chưa có báo cáo buổi học.`,
        entityId: occurrence.id,
        entityType: 'scheduleOccurrence',
        entityLabel: sessionLabel,
        createdAt: timestamp,
        updatedAt: timestamp,
        meta: {
          sessionId: String(occurrence.id),
          occurrenceDate,
          signal: 'missing-session-report',
        },
      }
    })
}

export function buildInventoryDueNotificationCandidates(inventoryRequests, options = {}) {
  const today = normalizeDateKey(options.today || new Date())
  const centerId = String(options.centerId || '').trim()
  const timestamp = getDateKeyTimestamp(today)

  if (!today) {
    return []
  }

  return (inventoryRequests ?? [])
    .filter((request) => {
      const neededDate = normalizeDateKey(request?.neededDate)
      return request?.id
        && neededDate
        && neededDate <= today
        && activeInventoryRequestStatuses.has(request.status)
        && (!centerId || !request.centerId || String(request.centerId) === centerId)
    })
    .map((request) => {
      const neededDate = normalizeDateKey(request.neededDate)
      const requestCode = request.requestCode || request.id
      const overdue = neededDate < today
      return {
        dedupeKey: `inventory-due:${request.id}:${neededDate}`,
        sourceModule: 'kho-hang',
        sourceLabel: notificationSourceLabels['kho-hang'],
        type: 'inventory',
        severity: overdue ? 'danger' : 'warning',
        title: `${overdue ? 'Quá hạn' : 'Đến hạn'} xử lý: ${requestCode}`,
        message: `Đề xuất kho cần xử lý vào ${neededDate}.`,
        entityId: request.id,
        entityType: 'inventoryRequest',
        entityLabel: requestCode,
        createdAt: timestamp,
        updatedAt: timestamp,
        meta: {
          requestId: String(request.id),
          neededDate,
          status: request.status,
          signal: overdue ? 'inventory-overdue' : 'inventory-due-today',
        },
      }
    })
}

// These legacy builders remain exported for historical fixture tests only.
// The active V2-5 read model is wired exclusively to the providers above.
export function buildTuitionNotificationCandidates(tuitionRows, monthKey) {
  return (tuitionRows ?? [])
    .map((row) => {
      const statusKey = row?.status?.key
      const config = tuitionNotificationConfig[statusKey]

      if (!row?.student || !row?.tuition || !config) {
        return null
      }

      const timestamp = row.tuition.updatedAt || row.tuition.createdAt || new Date().toISOString()

      return {
        dedupeKey: `tuition-advisory:${row.student.id}:${monthKey}:${statusKey}`,
        sourceModule: 'hoc-phi',
        sourceLabel: notificationSourceLabels['hoc-phi'],
        type: 'tuition-advisory',
        severity: config.severity,
        title: `${row.student.fullName} ${config.titleSuffix}`,
        message: config.message,
        entityId: row.student.id,
        entityType: 'student',
        entityLabel: row.student.fullName,
        createdAt: timestamp,
        updatedAt: timestamp,
        meta: {
          monthKey,
          tuitionId: row.tuition.id,
          status: statusKey,
          remainingSessions: row.remainingSessions,
        },
      }
    })
    .filter(Boolean)
}

export function buildInventoryRequestNotificationCandidates(inventoryRequests) {
  return (inventoryRequests ?? [])
    .map((request) => {
      const config = inventoryRequestStatusConfig[request?.status]

      if (!request || !config) {
        return null
      }

      const requestCode = request.requestCode || request.id
      const itemSummary = summarizeList(request.itemTypes, request.otherItemText, 'vật tư')
      const studentLabel = request.studentName || 'chưa gắn học viên'

      const timestamp = request.updatedAt || request.createdAt || new Date().toISOString()

      return {
        dedupeKey: `inventory-request:${request.id}:${request.status}`,
        sourceModule: 'kho-hang',
        sourceLabel: notificationSourceLabels['kho-hang'],
        type: 'inventory-request',
        severity: config.severity,
        title: `Đề xuất kho ${config.label}: ${requestCode}`,
        message: `${request.requestedByName || 'Người đề xuất'} đề xuất ${itemSummary} cho ${studentLabel}.`,
        entityId: request.id,
        entityType: 'inventoryRequest',
        entityLabel: requestCode,
        createdAt: timestamp,
        updatedAt: timestamp,
        meta: {
          status: request.status,
          neededDate: request.neededDate || '',
        },
      }
    })
    .filter(Boolean)
}

export function buildParentFollowupNotificationCandidates(parentConsultations) {
  return (parentConsultations ?? [])
    .map((contact) => {
      const nextAction = String(contact?.nextAction || '').trim()

      if (!contact || !nextAction || contact.consultationStatus === 'closed') {
        return null
      }

      const timestamp = contact.updatedAt || contact.lastContactAt || contact.createdAt || new Date().toISOString()

      return {
        dedupeKey: `parent-followup:${contact.id}:${contact.consultationStatus}:${nextAction}`,
        sourceModule: 'khach-hang-tu-van',
        sourceLabel: notificationSourceLabels['khach-hang-tu-van'],
        type: 'parent-followup',
        severity: contact.consultationStatus === 'waitingResponse' ? 'warning' : 'info',
        title: `Cần follow-up: ${contact.parentName || contact.name || 'Phụ huynh'}`,
        message: nextAction,
        entityId: contact.id,
        entityType: 'parentConsultation',
        entityLabel: contact.parentName || contact.name || '',
        createdAt: timestamp,
        updatedAt: timestamp,
        meta: {
          consultationStatus: contact.consultationStatus || '',
        },
      }
    })
    .filter(Boolean)
}

export function upsertNotificationCandidates(currentNotifications, candidates) {
  const now = new Date().toISOString()
  const existingByDedupeKey = new Map()
  const normalizedExisting = (currentNotifications ?? []).filter(Boolean)

  normalizedExisting.forEach((notification) => {
    existingByDedupeKey.set(notification.dedupeKey || notification.id, notification)
  })

  const candidateDedupeKeys = new Set()
  const upsertedCandidates = (candidates ?? [])
    .map((candidate) => normalizeCandidate(candidate, now))
    .filter((candidate) => {
      if (!candidate || candidateDedupeKeys.has(candidate.dedupeKey)) {
        return false
      }

      candidateDedupeKeys.add(candidate.dedupeKey)
      return true
    })
    .map((candidate) => {
      const existingNotification = existingByDedupeKey.get(candidate.dedupeKey)

      if (!existingNotification) {
        return candidate
      }

      return {
        ...existingNotification,
        ...candidate,
        id: existingNotification.id,
        createdAt: existingNotification.createdAt || candidate.createdAt,
        readAt: existingNotification.readAt || '',
        read: Boolean(existingNotification.readAt),
      }
    })

  const derivedKeys = new Set(upsertedCandidates.map((notification) => notification.dedupeKey))
  const retainedNotifications = normalizedExisting.filter((notification) => {
    const key = notification.dedupeKey || notification.id

    if (derivedKeys.has(key)) {
      return false
    }

    return !derivedNotificationTypes.has(notification.type)
  })

  return [...upsertedCandidates, ...retainedNotifications].sort(
    (firstNotification, secondNotification) =>
      new Date(secondNotification.createdAt).getTime() - new Date(firstNotification.createdAt).getTime(),
  )
}

export function getUnreadNotificationCount(notifications) {
  return (notifications ?? []).filter((notification) => !notification.readAt).length
}

export function getUnreadNotificationCountsByModule(notifications) {
  return (notifications ?? []).reduce((counts, notification) => {
    if (!notification.readAt) {
      counts[notification.sourceModule] = (counts[notification.sourceModule] || 0) + 1
    }

    return counts
  }, {})
}

export function filterNotifications(notifications, filters = {}) {
  const sourceModule = filters.sourceModule || 'all'
  const readState = filters.readState || 'unread'

  return (notifications ?? []).filter((notification) => {
    const moduleMatches = sourceModule === 'all' || notification.sourceModule === sourceModule
    const readMatches =
      readState === 'all' ||
      (readState === 'unread' && !notification.readAt) ||
      (readState === 'read' && Boolean(notification.readAt))

    return moduleMatches && readMatches
  })
}

export function markNotificationReadById(notifications, notificationId, readAt = new Date().toISOString()) {
  return (notifications ?? []).map((notification) =>
    notification.id === notificationId
      ? {
          ...notification,
          readAt: notification.readAt || readAt,
          read: true,
        }
      : notification,
  )
}

export function markNotificationsReadByIds(notifications, notificationIds, readAt = new Date().toISOString()) {
  const targetIds = new Set(notificationIds)

  return (notifications ?? []).map((notification) =>
    targetIds.has(notification.id)
      ? {
          ...notification,
          readAt: notification.readAt || readAt,
          read: true,
        }
      : notification,
  )
}

export function getNotificationSourceLabel(sourceModule) {
  return notificationSourceLabels[sourceModule] || sourceModule || notificationSourceLabels['he-thong']
}

function normalizeCandidate(candidate, fallbackDate) {
  if (!candidate || !candidate.dedupeKey) {
    return null
  }

  const createdAt = normalizeDate(candidate.createdAt, fallbackDate)
  const severity = ['info', 'warning', 'danger', 'success'].includes(candidate.severity)
    ? candidate.severity
    : 'info'
  const sourceModule = candidate.sourceModule || 'he-thong'

  return {
    id: candidate.id || `notification-${slugify(candidate.dedupeKey)}`,
    dedupeKey: String(candidate.dedupeKey),
    sourceModule,
    sourceLabel: candidate.sourceLabel || getNotificationSourceLabel(sourceModule),
    type: candidate.type || 'system',
    severity,
    title: String(candidate.title || 'Thông báo'),
    message: String(candidate.message || ''),
    entityId: candidate.entityId ? String(candidate.entityId) : '',
    entityType: candidate.entityType ? String(candidate.entityType) : '',
    entityLabel: candidate.entityLabel ? String(candidate.entityLabel) : '',
    createdAt,
    updatedAt: normalizeDate(candidate.updatedAt, fallbackDate),
    readAt: candidate.readAt ? normalizeDate(candidate.readAt, '') : '',
    read: Boolean(candidate.readAt),
    meta: candidate.meta && typeof candidate.meta === 'object' ? candidate.meta : {},
  }
}

function summarizeList(items = [], fallbackText = '', emptyLabel = '') {
  const values = [...(items ?? []), fallbackText].map((item) => String(item || '').trim()).filter(Boolean)

  return values.length ? values.join(', ') : emptyLabel
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function normalizeDate(value, fallbackDate) {
  if (!value && !fallbackDate) {
    return ''
  }

  const date = new Date(value || fallbackDate)
  return Number.isNaN(date.getTime()) ? fallbackDate : date.toISOString()
}

function normalizeDateKey(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return ''
    }
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const text = String(value || '').trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return ''
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    ? ''
    : `${match[1]}-${match[2]}-${match[3]}`
}

function getDateKeyTimestamp(dateKey) {
  return dateKey ? `${dateKey}T00:00:00.000Z` : ''
}

function getEntityLabel(entity, fallback) {
  return String(entity?.fullName || entity?.name || fallback || '').trim()
}

function formatTimeRange(startTime, endTime) {
  const start = String(startTime || '').trim()
  const end = String(endTime || '').trim()
  if (start && end) {
    return `${start}–${end}`
  }
  return start || end || 'Hôm nay'
}

function hasOccurrenceEnded(occurrence, occurrenceDate, today, now) {
  if (occurrenceDate < today) {
    return true
  }
  if (occurrenceDate > today) {
    return false
  }

  const endTime = String(occurrence?.endTime || '').trim()
  if (!/^\d{2}:\d{2}$/.test(endTime)) {
    return false
  }

  const [hours, minutes] = endTime.split(':').map(Number)
  const occurrenceEnd = new Date(now)
  occurrenceEnd.setHours(hours, minutes, 0, 0)
  return occurrenceEnd.getTime() <= now.getTime()
}
