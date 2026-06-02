const VIEW_MODE_KEY = 'ichess-center-os:view-mode'
const DESKTOP_ORDER_KEY = 'ichess-center-os:desktop-module-order'
const STUDENTS_KEY = 'ichessCenterOS.students.dreamhome'
const NOTIFICATIONS_KEY = 'ichessCenterOS.notifications.dreamhome'
const NOTIFICATIONS_VERSION_KEY = 'ichessCenterOS.notifications.version.dreamhome'
const DELETED_NOTIFICATION_IDS_KEY = 'ichessCenterOS.notifications.deletedIds.dreamhome'
const TUITION_KEY = 'ichessCenterOS.tuition.dreamhome'
const CURRENT_NOTIFICATIONS_VERSION = '1A.1'
const VALID_VIEW_MODES = ['grid', 'list']
const VALID_NOTIFICATION_LEVELS = ['info', 'warning', 'danger', 'success']
const VALID_NOTIFICATION_TYPES = ['system', 'tuition', 'student', 'schedule', 'inventory', 'report']
const LEGACY_SAMPLE_TEACHER_NAMES = ['Thầy Thắng', 'Cô Vân', 'Thầy Hải']
const UNASSIGNED_TEACHER_NAME = 'Chưa phân công'

export function getViewMode() {
  const savedMode = localStorage.getItem(VIEW_MODE_KEY)
  return VALID_VIEW_MODES.includes(savedMode) ? savedMode : 'grid'
}

export function saveViewMode(mode) {
  if (VALID_VIEW_MODES.includes(mode)) {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }
}

export function getDesktopModuleOrder(validModuleIds) {
  try {
    const savedOrder = JSON.parse(localStorage.getItem(DESKTOP_ORDER_KEY))

    if (!Array.isArray(savedOrder)) {
      return validModuleIds
    }

    const knownSavedIds = savedOrder.filter((id) => validModuleIds.includes(id))
    const newIds = validModuleIds.filter((id) => !knownSavedIds.includes(id))
    return [...knownSavedIds, ...newIds]
  } catch {
    return validModuleIds
  }
}

export function saveDesktopModuleOrder(moduleIds) {
  localStorage.setItem(DESKTOP_ORDER_KEY, JSON.stringify(moduleIds))
}

export function getStoredStudents(defaultStudents) {
  try {
    const storedStudents = JSON.parse(localStorage.getItem(STUDENTS_KEY))

    if (Array.isArray(storedStudents)) {
      const migratedStudents = normalizeStudents(storedStudents)
      saveStoredStudents(migratedStudents)
      return migratedStudents
    }
  } catch {
    localStorage.removeItem(STUDENTS_KEY)
  }

  const migratedDefaultStudents = normalizeStudents(defaultStudents)
  saveStoredStudents(migratedDefaultStudents)
  return migratedDefaultStudents
}

export function saveStoredStudents(students) {
  localStorage.setItem(STUDENTS_KEY, JSON.stringify(normalizeStudents(students)))
}

export function getStoredNotifications(defaultNotifications) {
  try {
    const storedNotifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY))

    if (Array.isArray(storedNotifications)) {
      const savedVersion = localStorage.getItem(NOTIFICATIONS_VERSION_KEY)

      if (
        savedVersion !== CURRENT_NOTIFICATIONS_VERSION &&
        isDemoNotificationSeed(storedNotifications)
      ) {
        const migratedNotifications = mergeDemoNotificationReadState(
          normalizeNotifications(defaultNotifications),
          storedNotifications,
        )
        saveStoredNotifications(migratedNotifications)
        return migratedNotifications
      }

      const normalizedNotifications = normalizeNotifications(storedNotifications)
      saveStoredNotifications(normalizedNotifications)
      return normalizedNotifications
    }
  } catch {
    localStorage.removeItem(NOTIFICATIONS_KEY)
  }

  const normalizedDefaultNotifications = normalizeNotifications(defaultNotifications)
  saveStoredNotifications(normalizedDefaultNotifications)
  return normalizedDefaultNotifications
}

export function saveStoredNotifications(notifications) {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(normalizeNotifications(notifications)))
  localStorage.setItem(NOTIFICATIONS_VERSION_KEY, CURRENT_NOTIFICATIONS_VERSION)
}

export function getDeletedNotificationIds() {
  try {
    const storedIds = JSON.parse(localStorage.getItem(DELETED_NOTIFICATION_IDS_KEY))
    return Array.isArray(storedIds) ? storedIds.map(String) : []
  } catch {
    localStorage.removeItem(DELETED_NOTIFICATION_IDS_KEY)
    return []
  }
}

export function saveDeletedNotificationIds(notificationIds) {
  localStorage.setItem(
    DELETED_NOTIFICATION_IDS_KEY,
    JSON.stringify(Array.from(new Set(notificationIds.map(String)))),
  )
}

export function getStoredTuition(defaultTuitionRecords) {
  try {
    const storedTuition = JSON.parse(localStorage.getItem(TUITION_KEY))

    if (Array.isArray(storedTuition)) {
      const normalizedTuition = normalizeTuitionRecords(storedTuition)
      saveStoredTuition(normalizedTuition)
      return normalizedTuition
    }
  } catch {
    localStorage.removeItem(TUITION_KEY)
  }

  const normalizedDefaultTuition = normalizeTuitionRecords(defaultTuitionRecords)
  saveStoredTuition(normalizedDefaultTuition)
  return normalizedDefaultTuition
}

export function saveStoredTuition(tuitionRecords) {
  localStorage.setItem(TUITION_KEY, JSON.stringify(normalizeTuitionRecords(tuitionRecords)))
}

function normalizeStudents(students) {
  return students.map((student) => {
    const mainTeacherName = normalizeStudentTeacherName(student.mainTeacherName)

    if (Array.isArray(student.careNotes)) {
      return {
        ...student,
        mainTeacherName,
      }
    }

    const legacyNote = String(student.latestCareNote ?? '').trim()
    const hasRealLegacyNote =
      legacyNote &&
      legacyNote !== 'Chưa có ghi chú chăm sóc.' &&
      !legacyNote.toLowerCase().includes('chưa có ghi chú')

    return {
      ...student,
      mainTeacherName,
      careNotes: hasRealLegacyNote
        ? [
            {
              id: `note_legacy_${student.id}`,
              createdAt: student.updatedAt
                ? new Date(student.updatedAt).toISOString()
                : new Date().toISOString(),
              author: 'Admin DreamHome',
              content: legacyNote,
              tags: [],
            },
          ]
        : [],
    }
  })
}

function normalizeStudentTeacherName(mainTeacherName) {
  return LEGACY_SAMPLE_TEACHER_NAMES.includes(mainTeacherName)
    ? UNASSIGNED_TEACHER_NAME
    : mainTeacherName
}

function normalizeNotifications(notifications) {
  return notifications
    .filter((notification) => notification && typeof notification === 'object')
    .map((notification, index) => ({
      id: String(notification.id || `notif-${String(index + 1).padStart(3, '0')}`),
      type: normalizeNotificationType(notification.type),
      level: normalizeNotificationLevel(notification.level),
      title: String(notification.title || 'Thông báo'),
      message: String(notification.message || ''),
      sourceModule: String(notification.sourceModule || 'system'),
      createdAt: normalizeNotificationCreatedAt(notification.createdAt),
      read: Boolean(notification.read),
    }))
}

function normalizeNotificationType(type) {
  return VALID_NOTIFICATION_TYPES.includes(type) ? type : 'system'
}

function normalizeNotificationLevel(level) {
  return VALID_NOTIFICATION_LEVELS.includes(level) ? level : 'info'
}

function normalizeNotificationCreatedAt(createdAt) {
  const createdDate = createdAt ? new Date(createdAt) : new Date()
  return Number.isNaN(createdDate.getTime()) ? new Date().toISOString() : createdDate.toISOString()
}

function isDemoNotificationSeed(notifications) {
  return (
    notifications.length > 0 &&
    notifications.every((notification) =>
      ['notif-001', 'notif-002', 'notif-003', 'notif-004'].includes(notification?.id),
    )
  )
}

function mergeDemoNotificationReadState(defaultNotifications, storedNotifications) {
  const storedReadStateById = new Map(
    storedNotifications
      .filter((notification) => notification?.id)
      .map((notification) => [notification.id, Boolean(notification.read)]),
  )

  return defaultNotifications.map((notification) => ({
    ...notification,
    read: storedReadStateById.has(notification.id)
      ? storedReadStateById.get(notification.id)
      : notification.read,
  }))
}

function normalizeTuitionRecords(tuitionRecords) {
  return tuitionRecords
    .filter((record) => record && typeof record === 'object')
    .map((record, index) => ({
      id: String(record.id || `tuition-${String(index + 1).padStart(3, '0')}`),
      studentId: String(record.studentId || ''),
      packageName: String(record.packageName || 'Gói học'),
      totalSessions: normalizeNumber(record.totalSessions),
      usedSessions: normalizeNumber(record.usedSessions),
      totalAmount: normalizeNumber(record.totalAmount),
      paidAmount: normalizeNumber(record.paidAmount),
      dueDate: record.dueDate ? String(record.dueDate) : '',
      note: String(record.note || ''),
      payments: normalizeTuitionPayments(record.payments),
      currentTermNumber: Math.max(1, normalizeNumber(record.currentTermNumber) || 1),
      currentTermId: String(
        record.currentTermId ||
          `term-${record.id || String(index + 1).padStart(3, '0')}-${Math.max(1, normalizeNumber(record.currentTermNumber) || 1)}`,
      ),
      startedAt: record.startedAt ? normalizeDateTime(record.startedAt) : '',
      termHistory: normalizeTuitionTermHistory(record.termHistory),
    }))
    .filter((record) => record.studentId)
}

function normalizeTuitionTermHistory(termHistory) {
  if (!Array.isArray(termHistory)) {
    return []
  }

  return termHistory
    .filter((term) => term && typeof term === 'object')
    .map((term, index) => ({
      id: String(term.id || `term-history-${String(index + 1).padStart(3, '0')}`),
      termNumber: Math.max(1, normalizeNumber(term.termNumber) || index + 1),
      packageName: String(term.packageName || 'Gói học'),
      totalSessions: normalizeNumber(term.totalSessions),
      usedSessions: normalizeNumber(term.usedSessions),
      totalAmount: normalizeNumber(term.totalAmount),
      paidAmount: normalizeNumber(term.paidAmount),
      dueDate: term.dueDate ? String(term.dueDate) : '',
      note: String(term.note || ''),
      status: ['completed', 'archived'].includes(term.status) ? term.status : 'archived',
      startedAt: term.startedAt ? normalizeDateTime(term.startedAt) : '',
      endedAt: term.endedAt ? normalizeDateTime(term.endedAt) : '',
      payments: normalizeTuitionPayments(term.payments),
    }))
}

function normalizeTuitionPayments(payments) {
  if (!Array.isArray(payments)) {
    return []
  }

  return payments
    .filter((payment) => payment && typeof payment === 'object')
    .map((payment, index) => ({
      id: String(payment.id || `payment-${String(index + 1).padStart(3, '0')}`),
      amount: normalizeNumber(payment.amount),
      paidAt: payment.paidAt ? String(payment.paidAt) : '',
      method: ['cash', 'transfer', 'other'].includes(payment.method) ? payment.method : 'other',
      collectorName: String(payment.collectorName || ''),
      note: String(payment.note || ''),
      createdAt: payment.createdAt
        ? normalizeDateTime(payment.createdAt)
        : new Date().toISOString(),
    }))
}

function normalizeNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function normalizeDateTime(value) {
  const dateValue = new Date(value)
  return Number.isNaN(dateValue.getTime()) ? new Date().toISOString() : dateValue.toISOString()
}
