export const notificationSourceLabels = {
  'hoc-vien': 'Học viên',
  'hoc-phi': 'Học phí',
  'phu-huynh-tu-van': 'Phụ huynh / Tư vấn',
  'kho-hang': 'Kho hàng',
  'giao-vien': 'Giáo viên',
  'thoi-khoa-bieu': 'Thời khóa biểu',
  'thu-chi': 'Thu chi',
  'so-quy': 'Sổ quỹ',
  'cai-dat-co-so': 'Cài đặt cơ sở',
  'he-thong': 'Hệ thống',
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
  'tuition',
  'tuition-advisory',
  'inventory-request',
  'parent-followup',
])

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
        sourceModule: 'phu-huynh-tu-van',
        sourceLabel: notificationSourceLabels['phu-huynh-tu-van'],
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
