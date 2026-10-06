import { getBirthdayLocalDateKey, getStudentBirthInformation } from './student-birth-information.js'

export const notificationSourceLabels = {
  'hoc-vien': 'Học viên',
  'hoc-phi': 'Học phí',
  'khach-hang-tu-van': 'Phụ huynh / Tư vấn',
  'kho-hang': 'Kho hàng',
  'giao-vien': 'Giáo viên',
  'thoi-khoa-bieu': 'Lịch làm việc tuần',
  'thu-chi': 'Thu chi',
  'so-quy': 'Sổ quỹ',
  'cai-dat-co-so': 'Cài đặt cơ sở',
  'bang-diem-danh': 'Bảng điểm danh',
  'he-thong': 'Hệ thống',
}

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
  'inventory-cycle-count',
  'parent-followup',
  'attendance-operation',
])

export function buildStudentBirthdayNotificationCandidates(students, options = {}) {
  const today = getBirthdayLocalDateKey(options.today || new Date())
  const centerId = String(options.centerId || '').trim()
  const timestamp = today ? new Date(`${today}T00:00:00+07:00`).toISOString() : ''

  if (!today || !centerId) {
    return []
  }

  return getBirthdayStudents(students, centerId)
    .filter(student => getStudentBirthInformation(student).birthDate.slice(5) === today.slice(5))
    .map((student) => ({
      dedupeKey: `student-birthday:${student.id}:${today}`,
      sourceModule: 'hoc-vien',
      sourceLabel: notificationSourceLabels['hoc-vien'],
      type: 'student',
      severity: 'info',
      title: `Hôm nay là sinh nhật của ${getEntityLabel(student, 'Học viên')} 🎂`,
      message: `Sinh nhật ${today.slice(8, 10)}/${today.slice(5, 7)}`,
      entityId: student.id,
      entityType: 'student',
      entityLabel: getEntityLabel(student, 'Học viên'),
      createdAt: timestamp,
      updatedAt: timestamp,
      meta: {
        studentId: String(student.id),
        signal: 'birthday-today',
        date: today,
        centerId,
        providerId: 'birthdays',
        operational: true,
        actionLabel: 'Mở học viên',
      },
    }))
}

function getBirthdayStudents(students, centerId) {
  // The caller passes the authoritative active-center Student projection.
  // Explicit foreign-center rows and tombstones are still rejected here.
  return [...new Map((students ?? []).filter(student => student?.id
    && !student.isDeleted && !student.deletedAt && !student.cloudDeletedAt
    && !inactiveStudentStatuses.has(String(student.currentStatus || '').trim())
    && (!student.centerId || String(student.centerId) === centerId)
    && getStudentBirthInformation(student).kind === 'full')
    .map(student => [String(student.id), student])).values()]
}

export function buildStudentBirthdayMonthNotificationCandidates(students, options = {}) {
  const today = getBirthdayLocalDateKey(options.today || new Date())
  const centerId = String(options.centerId || '').trim()
  if (!today || !centerId) return []
  const month = today.slice(0, 7)
  const birthdays = getBirthdayStudents(students, centerId)
    .filter(student => getStudentBirthInformation(student).birthDate.slice(5, 7) === today.slice(5, 7))
    .sort((first, second) => getStudentBirthInformation(first).date.day - getStudentBirthInformation(second).date.day
      || getEntityLabel(first).localeCompare(getEntityLabel(second), 'vi')
      || String(first.id).localeCompare(String(second.id)))
  if (!birthdays.length) return []
  const timestamp = new Date(`${month}-01T00:00:00+07:00`).toISOString()
  return [{
    dedupeKey: `student-birthday-month:${centerId}:${month}`,
    sourceModule: 'hoc-vien', sourceLabel: notificationSourceLabels['hoc-vien'], type: 'student', severity: 'info',
    title: `Sinh nhật tháng ${Number(today.slice(5, 7))}`,
    message: birthdays.map(student => {
      const date = getStudentBirthInformation(student).date
      return `${getEntityLabel(student, 'Học viên')} (${String(date.day).padStart(2, '0')}/${String(date.month).padStart(2, '0')})`
    }).join(' · '),
    entityId: '', entityType: 'studentBirthdayMonth', entityLabel: '', createdAt: timestamp, updatedAt: timestamp,
    meta: { centerId, providerId: 'birthday-month', operational: false, signal: 'birthday-month', month,
      studentIds: birthdays.map(student => String(student.id)) },
  }]
}

export function pruneExpiredStudentBirthdayNotifications(notifications, { today = new Date(), centerId } = {}) {
  const date = getBirthdayLocalDateKey(today)
  if (!date || !centerId) return notifications ?? []
  return (notifications ?? []).filter(item => {
    if (item.meta?.centerId && item.meta.centerId !== centerId) return true
    const provider = getNotificationProvider(item)
    if (provider === 'birthdays') return (item.meta?.date || String(item.dedupeKey).split(':').at(-1)) === date
    if (provider === 'birthday-month') return item.meta?.month === date.slice(0, 7)
    return true
  })
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
    const addCandidate = (targetCycle, signal, severity, title, message) => {
      candidates.push({
        ...common,
        dedupeKey: `v2-4:${targetCycle.id}:${signal}`,
        severity,
        title,
        message,
        meta: {
          studentId,
          cycleId: String(targetCycle.id),
          signal,
          remainingSessions: targetCycle.remainingSessions,
          cycleNumber: targetCycle.cycleNumber,
        },
      })
    }

    const needsPackageSelection = cycle.lifecycleStatus === 'NEEDS_PACKAGE_SELECTION'
      || cycle.reminderState === 'PACKAGE_SELECTION_REQUIRED'
    if (needsPackageSelection) {
      addCandidate(
        cycle,
        'needs-package-selection',
        'danger',
        `${studentLabel} cần chọn gói học`,
        'Chu kỳ tạm thời chưa có đủ thông tin gói học.',
      )
    }

    const preparedPaid = studentState?.preparedNextCycle?.paymentStatus === 'PAID'
    if (cycle.renewalReminder && !preparedPaid) {
      const remainingValue = Number(cycle.remainingSessions)
      const remaining = Number.isFinite(remainingValue)
        ? remainingValue
        : cycle.urgentRenewal ? 0 : 2
      const severity = remaining <= 0 ? 'danger' : remaining <= 1 ? 'warning' : 'info'
      const title = remaining <= 0
        ? `Đến hạn · Chưa thanh toán học phí: ${studentLabel}`
        : remaining === 1
          ? `Còn 1 buổi · Học phí sắp đến hạn: ${studentLabel}`
          : `Còn 2 buổi · Chuẩn bị thu học phí: ${studentLabel}`
      addCandidate(
        cycle,
        'tuition-due',
        severity,
        title,
        'In Thông báo học phí (TBHP) cho Tái đăng ký; Phiếu Thu chỉ có sau khi đã nhận tiền.',
      )
    }

    const bchtCycle = [cycle, ...(studentState.cycles || [])]
      .filter((item, index, items) => item?.id
        && item.bchtReminder
        && item.bchtStatus !== 'COMPLETED'
        && items.findIndex((candidate) => candidate?.id === item.id) === index)
      .sort((first, second) => Number(second.cycleNumber) - Number(first.cycleNumber))[0]
    if (bchtCycle) {
      const remainingValue = Number(bchtCycle.remainingSessions)
      const remaining = Number.isFinite(remainingValue) ? remainingValue : 4
      const severity = remaining <= 0 ? 'danger' : remaining <= 2 ? 'warning' : 'info'
      const sessionLabel = remaining <= 0 ? 'Đến hạn' : `Còn ${remaining} buổi`
      addCandidate(
        bchtCycle,
        'bcht-due',
        severity,
        `${sessionLabel} · Cần hoàn tất BCHT: ${studentLabel}`,
        'Nhắc giáo viên hoàn tất Báo Cáo Học Tập cho chu kỳ này.',
      )
    }

    return candidates
  })
}

export function buildScheduleAttentionNotificationCandidates(occurrences, options = {}) {
  const today = getBirthdayLocalDateKey(options.today || new Date())
  const centerId = String(options.centerId || '').trim()
  const timestamp = getDateKeyTimestamp(today)

  if (!today) {
    return []
  }

  return (occurrences ?? [])
    .filter((occurrence) => occurrence?.id
      && occurrence.scheduleType === 'oneOff'
      && normalizeScheduleDateKey(occurrence.occurrenceDate || occurrence.date) === today
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
  const today = getBirthdayLocalDateKey(options.today || now)
  const centerId = String(options.centerId || '').trim()
  const timestamp = getDateKeyTimestamp(today)
  const reportKeys = new Set((sessionReports ?? [])
    .filter((report) => !centerId || !report?.centerId || String(report.centerId) === centerId)
    .map((report) => `${String(report?.sessionId || '').trim()}|${normalizeScheduleDateKey(report?.occurrenceDate)}`))

  if (!today || Number.isNaN(now.getTime())) {
    return []
  }

  return (occurrences ?? [])
    .filter((occurrence) => {
      const occurrenceDate = normalizeScheduleDateKey(occurrence?.occurrenceDate || occurrence?.date)
      const identityKey = `${String(occurrence?.id || '').trim()}|${occurrenceDate}`
      return occurrence?.id
        && occurrenceDate
        && occurrence.status !== 'cancelled'
        && (!centerId || !occurrence.centerId || String(occurrence.centerId) === centerId)
        && hasOccurrenceEnded(occurrence, occurrenceDate, today, now)
        && !reportKeys.has(identityKey)
    })
    .map((occurrence) => {
      const occurrenceDate = normalizeScheduleDateKey(occurrence.occurrenceDate || occurrence.date)
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

export function buildInventoryDueNotificationCandidates(cycleCounts, options = {}) {
  const centerId = String(options.centerId || '').trim()
  if (!centerId) return []

  return (cycleCounts ?? [])
    .filter((count) => {
      const dueDate = normalizeDateKey(count?.dueDate)
      return count?.id
        && dueDate
        && ['draft', 'submitted'].includes(count.status)
        && ['due', 'overdue'].includes(count.dueState)
        && String(count.centerId || '') === centerId
    })
    .map((count) => {
      const dueDate = normalizeDateKey(count.dueDate)
      const countCode = count.countCode || count.id
      const overdue = count.dueState === 'overdue'
      const timestamp = count.updatedAt || count.createdAt || getDateKeyTimestamp(dueDate)
      return {
        dedupeKey: `inventory-cycle-count-due:${centerId}:${count.id}`,
        sourceModule: 'kho-hang',
        sourceLabel: notificationSourceLabels['kho-hang'],
        type: 'inventory-cycle-count',
        severity: overdue ? 'danger' : 'warning',
        title: `${overdue ? 'Quá hạn' : 'Đến hạn'} kiểm kê: ${countCode}`,
        message: `Phiên kiểm kê cần hoàn tất vào ${dueDate}.`,
        entityId: count.id,
        entityType: 'inventoryCycleCount',
        entityLabel: countCode,
        createdAt: timestamp,
        updatedAt: timestamp,
        meta: {
          cycleCountId: String(count.id),
          dueDate,
          dueState: count.dueState,
          status: count.status,
          signal: overdue ? 'inventory-cycle-count-overdue' : 'inventory-cycle-count-due',
        },
      }
    })
}

export function resolveCurrentInventoryDueNotification(notification, cycleCounts, centerId) {
  const targetCenterId = String(centerId || '').trim()
  const cycleCountId = String(notification?.meta?.cycleCountId || '').trim()
  if (!targetCenterId || !cycleCountId || notification?.meta?.centerId !== targetCenterId) return null
  return buildInventoryDueNotificationCandidates(cycleCounts, { centerId: targetCenterId })
    .find((candidate) => candidate.meta.cycleCountId === cycleCountId
      && candidate.dedupeKey === notification.dedupeKey) || null
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
        title: `Cần theo dõi & chăm sóc: ${contact.parentName || contact.name || 'Phụ huynh'}`,
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

export function getNotificationProvider(notification = {}) {
  const key = String(notification.dedupeKey || '')
  const meta = notification.meta || {}
  if (key.startsWith('attention:') && meta.centerId) {
    if (meta.signal === 'attendance-overdue' && meta.classSessionId && meta.month
      && key === `attention:${meta.centerId}:${meta.classSessionId}:${meta.month}:attendance-overdue`) return 'attendance-overdue'
    if (meta.signal === 'attendance-incomplete' && meta.sessionId && meta.occurrenceDate
      && key === `attention:${meta.centerId}:${meta.sessionId}|${meta.occurrenceDate}:attendance-incomplete`) return 'attendance-attention'
    if (meta.studentId && meta.cycleId
      && key === `attention:${meta.centerId}:${meta.studentId}:${meta.cycleId}:${meta.signal}`) {
      if (meta.signal === 'tuition-n2') return 'tuition-n2'
      if (meta.signal === 'payment-check') return 'payment-attention'
    }
  }
  if (key.startsWith('student-birthday:')) return 'birthdays'
  if (key.startsWith('student-birthday-month:')) return 'birthday-month'
  if (key.startsWith('schedule-attention:')) return 'schedule-attention'
  if (key.startsWith('missing-session-report:')) return 'session-reports'
  if (key.startsWith('inventory-cycle-count-due:')) return 'inventory-due'
  if (key.startsWith('v2-4:')) return notification.meta?.signal === 'tuition-due' ? 'tuition-n2' : 'tuition-existing'
  if (key.startsWith('v2-8a:')) return notification.meta?.signal === 'TBHP_SEND_DUE' ? 'tuition-n2'
    : notification.meta?.signal === 'PAYMENT_CHECK_DUE' ? 'payment-attention' : 'reviews-existing'
  return ''
}

export function tagNotificationCandidates(candidates, { centerId, providerId, operational = false }) {
  return candidates.map(candidate => ({ ...candidate,
    meta: { ...candidate.meta, centerId, providerId, operational, stale: false } }))
}

export function upsertNotificationCandidates(currentNotifications, candidates, options = {}) {
  const now = new Date().toISOString()
  const readyProviders = options.readyProviders == null ? null : new Set(options.readyProviders)
  const existingByDedupeKey = new Map()
  const normalizedExisting = (currentNotifications ?? []).filter(Boolean)

  normalizedExisting.forEach((notification) => {
    const key = notification.dedupeKey || notification.id
    const previous = existingByDedupeKey.get(key)
    existingByDedupeKey.set(key, previous?.readAt && !notification.readAt ? previous : notification)
  })

  const candidateDedupeKeys = new Set()
  const upsertedCandidates = (candidates ?? [])
    .filter(candidate => !readyProviders || readyProviders.has(getNotificationProvider(candidate)))
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
        id: candidate.dedupeKey.startsWith('attention:') ? candidate.id : existingNotification.id,
        createdAt: existingNotification.createdAt || candidate.createdAt,
        readAt: existingNotification.readAt || '',
        read: Boolean(existingNotification.readAt),
        meta: { ...candidate.meta, stale: false },
      }
    })

  const derivedKeys = new Set(upsertedCandidates.map((notification) => notification.dedupeKey))
  const retainedNotifications = [...existingByDedupeKey.values()].filter((notification) => {
    const key = notification.dedupeKey || notification.id

    if (derivedKeys.has(key)) {
      return false
    }

    if (readyProviders) return !readyProviders.has(getNotificationProvider(notification))
    return !derivedNotificationTypes.has(notification.type)
  }).map(notification => readyProviders && getNotificationProvider(notification)
    ? { ...notification, meta: { ...notification.meta, stale: true } } : notification)

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
      (readState === 'attention' && notification.meta?.operational === true
        && notification.meta?.stale !== true && Boolean(getNotificationProvider(notification))) ||
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
    id: candidate.id || `notification-${String(candidate.dedupeKey).startsWith('attention:')
      ? encodeURIComponent(candidate.dedupeKey) : slugify(candidate.dedupeKey)}`,
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

function normalizeScheduleDateKey(value) {
  return value instanceof Date ? getBirthdayLocalDateKey(value) : normalizeDateKey(value)
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
  if (hours > 23 || minutes > 59) return false
  const occurrenceEnd = Date.parse(`${occurrenceDate}T${endTime}:00+07:00`)
  return Number.isFinite(occurrenceEnd) && occurrenceEnd <= now.getTime()
}
