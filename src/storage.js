const VIEW_MODE_KEY = 'ichess-center-os:view-mode'
const DESKTOP_ORDER_KEY = 'ichess-center-os:desktop-module-order'
const STUDENTS_KEY = 'ichessCenterOS.students.dreamhome'
const NOTIFICATIONS_KEY = 'ichessCenterOS.notifications.dreamhome'
const NOTIFICATIONS_VERSION_KEY = 'ichessCenterOS.notifications.version.dreamhome'
const DELETED_NOTIFICATION_IDS_KEY = 'ichessCenterOS.notifications.deletedIds.dreamhome'
const TUITION_KEY = 'ichessCenterOS.tuition.dreamhome'
const TEACHERS_KEY = 'ichessCenterOS.teachers.dreamhome'
const SCHEDULE_KEY = 'ichessCenterOS.schedule.dreamhome'
const SESSION_REPORTS_KEY = 'ichessCenterOS.sessionReports.dreamhome'
const CASHFLOW_KEY = 'ichessCenterOS.cashflow.dreamhome'
const CASHFLOW_CATEGORIES_KEY = 'ichessCenterOS.cashflowCategories.dreamhome'
const CASHBOOK_SETTINGS_KEY = 'ichessCenterOS.cashbookSettings.dreamhome'
const CASHBOOK_RECONCILIATIONS_KEY = 'ichessCenterOS.cashbookReconciliations.dreamhome'
const INVENTORY_KEY = 'ichessCenterOS.inventory.dreamhome'
const INVENTORY_MOVEMENTS_KEY = 'ichessCenterOS.inventoryMovements.dreamhome'
const CURRENT_NOTIFICATIONS_VERSION = '1A.1'
const VALID_VIEW_MODES = ['grid', 'list']
const VALID_NOTIFICATION_LEVELS = ['info', 'warning', 'danger', 'success']
const VALID_NOTIFICATION_TYPES = ['system', 'tuition', 'student', 'schedule', 'inventory', 'report']
const VALID_TEACHER_STATUSES = ['active', 'paused', 'inactive']
const VALID_TEACHER_TYPES = ['fulltime', 'parttime', 'collaborator']
const CASHFLOW_ATTACHMENT_MAX_SIZE = 1024 * 1024
const VALID_SCHEDULE_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const VALID_SCHEDULE_LEVELS = ['beginner', 'intermediate', 'advanced', 'mixed']
const VALID_SCHEDULE_STATUSES = ['scheduled', 'done', 'cancelled']
const VALID_SCHEDULE_TYPES = ['recurring', 'oneOff']
const VALID_SCHEDULE_OCCURRENCE_REASONS = ['makeup', 'trial', 'extra', 'event', 'other']
const VALID_ATTENDANCE_STATUSES = [
  'present',
  'excusedAbsent',
  'unexcusedAbsent',
  'makeup',
  'trial',
]
const VALID_GUEST_PARTICIPATION_TYPES = ['trial', 'makeup']
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

export function getStoredTeachers(defaultTeachers) {
  try {
    const storedTeachers = JSON.parse(localStorage.getItem(TEACHERS_KEY))

    if (Array.isArray(storedTeachers)) {
      const normalizedTeachers = normalizeTeachers(storedTeachers)
      saveStoredTeachers(normalizedTeachers)
      return normalizedTeachers
    }
  } catch {
    localStorage.removeItem(TEACHERS_KEY)
  }

  const normalizedDefaultTeachers = normalizeTeachers(defaultTeachers)
  saveStoredTeachers(normalizedDefaultTeachers)
  return normalizedDefaultTeachers
}

export function saveStoredTeachers(teachers) {
  localStorage.setItem(TEACHERS_KEY, JSON.stringify(normalizeTeachers(teachers)))
}

export function getStoredSchedule(defaultSessions) {
  try {
    const storedSessions = JSON.parse(localStorage.getItem(SCHEDULE_KEY))

    if (Array.isArray(storedSessions)) {
      const normalizedSessions = normalizeScheduleSessions(storedSessions)
      saveStoredSchedule(normalizedSessions)
      return normalizedSessions
    }
  } catch {
    localStorage.removeItem(SCHEDULE_KEY)
  }

  const normalizedDefaultSessions = normalizeScheduleSessions(defaultSessions)
  saveStoredSchedule(normalizedDefaultSessions)
  return normalizedDefaultSessions
}

export function saveStoredSchedule(sessions) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(normalizeScheduleSessions(sessions)))
}

export function getStoredSessionReports(defaultReports = []) {
  try {
    const storedReports = JSON.parse(localStorage.getItem(SESSION_REPORTS_KEY))

    if (Array.isArray(storedReports)) {
      const normalizedReports = normalizeSessionReports(storedReports)
      saveStoredSessionReports(normalizedReports)
      return normalizedReports
    }
  } catch {
    localStorage.removeItem(SESSION_REPORTS_KEY)
  }

  const normalizedDefaultReports = normalizeSessionReports(defaultReports)
  saveStoredSessionReports(normalizedDefaultReports)
  return normalizedDefaultReports
}

export function saveStoredSessionReports(reports) {
  localStorage.setItem(SESSION_REPORTS_KEY, JSON.stringify(normalizeSessionReports(reports)))
}

export function getStoredCashflow(defaultTransactions) {
  try {
    const storedTransactions = JSON.parse(localStorage.getItem(CASHFLOW_KEY))

    if (Array.isArray(storedTransactions)) {
      const normalizedTransactions = normalizeCashflowTransactions(storedTransactions)
      saveStoredCashflow(normalizedTransactions)
      return normalizedTransactions
    }
  } catch {
    localStorage.removeItem(CASHFLOW_KEY)
  }

  const normalizedDefaultTransactions = normalizeCashflowTransactions(defaultTransactions)
  saveStoredCashflow(normalizedDefaultTransactions)
  return normalizedDefaultTransactions
}

export function saveStoredCashflow(transactions) {
  localStorage.setItem(CASHFLOW_KEY, JSON.stringify(normalizeCashflowTransactions(transactions)))
}

export function getStoredCashflowCategories(defaultCategories) {
  try {
    const storedCategories = JSON.parse(localStorage.getItem(CASHFLOW_CATEGORIES_KEY))

    if (Array.isArray(storedCategories)) {
      const normalizedCategories = normalizeCashflowCategories(storedCategories)
      saveStoredCashflowCategories(normalizedCategories)
      return normalizedCategories
    }
  } catch {
    localStorage.removeItem(CASHFLOW_CATEGORIES_KEY)
  }

  const normalizedDefaultCategories = normalizeCashflowCategories(defaultCategories)
  saveStoredCashflowCategories(normalizedDefaultCategories)
  return normalizedDefaultCategories
}

export function saveStoredCashflowCategories(categories) {
  localStorage.setItem(
    CASHFLOW_CATEGORIES_KEY,
    JSON.stringify(normalizeCashflowCategories(categories)),
  )
}

export function getStoredCashbookSettings(defaultSettings) {
  try {
    const storedSettings = JSON.parse(localStorage.getItem(CASHBOOK_SETTINGS_KEY))

    if (storedSettings && typeof storedSettings === 'object') {
      const normalizedSettings = normalizeCashbookSettings(storedSettings, defaultSettings)
      saveStoredCashbookSettings(normalizedSettings)
      return normalizedSettings
    }
  } catch {
    localStorage.removeItem(CASHBOOK_SETTINGS_KEY)
  }

  return normalizeCashbookSettings(defaultSettings, defaultSettings)
}

export function saveStoredCashbookSettings(settings) {
  localStorage.setItem(CASHBOOK_SETTINGS_KEY, JSON.stringify(normalizeCashbookSettings(settings)))
}

export function getStoredCashbookReconciliations(defaultReconciliations = []) {
  try {
    const storedReconciliations = JSON.parse(
      localStorage.getItem(CASHBOOK_RECONCILIATIONS_KEY),
    )

    if (Array.isArray(storedReconciliations)) {
      const normalizedReconciliations = normalizeCashbookReconciliations(storedReconciliations)
      saveStoredCashbookReconciliations(normalizedReconciliations)
      return normalizedReconciliations
    }
  } catch {
    localStorage.removeItem(CASHBOOK_RECONCILIATIONS_KEY)
  }

  return normalizeCashbookReconciliations(defaultReconciliations)
}

export function saveStoredCashbookReconciliations(reconciliations) {
  localStorage.setItem(
    CASHBOOK_RECONCILIATIONS_KEY,
    JSON.stringify(normalizeCashbookReconciliations(reconciliations)),
  )
}

export function getStoredInventory(defaultItems) {
  try {
    const storedItems = JSON.parse(localStorage.getItem(INVENTORY_KEY))

    if (Array.isArray(storedItems)) {
      const normalizedItems = normalizeInventoryItems(storedItems)
      saveStoredInventory(normalizedItems)
      return normalizedItems
    }
  } catch {
    localStorage.removeItem(INVENTORY_KEY)
  }

  const normalizedDefaultItems = normalizeInventoryItems(defaultItems)
  saveStoredInventory(normalizedDefaultItems)
  return normalizedDefaultItems
}

export function saveStoredInventory(items) {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(normalizeInventoryItems(items)))
}

export function getStoredInventoryMovements(defaultMovements = []) {
  try {
    const storedMovements = JSON.parse(localStorage.getItem(INVENTORY_MOVEMENTS_KEY))

    if (Array.isArray(storedMovements)) {
      const normalizedMovements = normalizeInventoryMovements(storedMovements)
      saveStoredInventoryMovements(normalizedMovements)
      return normalizedMovements
    }
  } catch {
    localStorage.removeItem(INVENTORY_MOVEMENTS_KEY)
  }

  const normalizedDefaultMovements = normalizeInventoryMovements(defaultMovements)
  saveStoredInventoryMovements(normalizedDefaultMovements)
  return normalizedDefaultMovements
}

export function saveStoredInventoryMovements(movements) {
  localStorage.setItem(
    INVENTORY_MOVEMENTS_KEY,
    JSON.stringify(normalizeInventoryMovements(movements)),
  )
}

function normalizeStudents(students) {
  return students.map((student) => {
    const mainTeacherName = normalizeStudentTeacherName(student.mainTeacherName)
    const assignedTeacherId = normalizeStudentAssignedTeacherId(student.assignedTeacherId)
    const deletionState = normalizeStudentDeletionState(student)

    if (Array.isArray(student.careNotes)) {
      return {
        ...student,
        mainTeacherName,
        assignedTeacherId,
        ...deletionState,
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
      assignedTeacherId,
      ...deletionState,
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

function normalizeStudentDeletionState(student) {
  // Future approval flow can replace this with deleteRequestedAt/deleteApprovedBy metadata.
  return {
    isDeleted: Boolean(student.isDeleted),
    deletedAt: student.isDeleted ? student.deletedAt || '' : '',
  }
}

function normalizeStudentTeacherName(mainTeacherName) {
  return LEGACY_SAMPLE_TEACHER_NAMES.includes(mainTeacherName)
    ? UNASSIGNED_TEACHER_NAME
    : mainTeacherName
}

function normalizeStudentAssignedTeacherId(value) {
  const teacherId = String(value ?? '').trim()
  return teacherId || null
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
      discountType: normalizeTuitionDiscountType(record.discountType, record.discountAmount),
      discountValue: normalizeTuitionDiscountValue(record.discountType, record.discountValue, record.discountAmount),
      discountAmount: normalizeNumber(record.discountAmount),
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

function normalizeTeachers(teachers) {
  return (teachers ?? [])
    .filter((teacher) => teacher && typeof teacher === 'object')
    .map((teacher, index) => {
      const now = new Date().toISOString()
      const status = VALID_TEACHER_STATUSES.includes(teacher.status)
        ? teacher.status
        : 'active'
      const teacherType = VALID_TEACHER_TYPES.includes(teacher.teacherType)
        ? teacher.teacherType
        : 'fulltime'

      return {
        id: String(teacher.id || `teacher-${String(index + 1).padStart(3, '0')}`),
        fullName: String(teacher.fullName || teacher.name || 'Giáo viên'),
        displayName: String(teacher.displayName || ''),
        phone: String(teacher.phone || ''),
        email: String(teacher.email || ''),
        status,
        teacherType,
        specialties: normalizeStringArray(teacher.specialties),
        levels: normalizeStringArray(teacher.levels),
        teachingGroups: normalizeStringArray(teacher.teachingGroups),
        teachingModes: normalizeStringArray(teacher.teachingModes).filter((mode) =>
          ['group', 'oneOnOne', 'competition', 'online'].includes(mode),
        ),
        strengths: normalizeStringArray(teacher.strengths),
        internalTags: normalizeStringArray(teacher.internalTags),
        availableDays: normalizeStringArray(teacher.availableDays).filter((day) =>
          ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(day),
        ),
        preferredTimeSlots: normalizeStringArray(teacher.preferredTimeSlots).filter((slot) =>
          ['morning', 'afternoon', 'evening', 'weekendMorning', 'weekendAfternoon'].includes(slot),
        ),
        maxSessionsPerWeek: normalizeNullablePositiveNumber(teacher.maxSessionsPerWeek),
        canTakeNewClass:
          typeof teacher.canTakeNewClass === 'boolean' ? teacher.canTakeNewClass : true,
        scheduleNote: String(teacher.scheduleNote || ''),
        mainRole: String(teacher.mainRole || 'Giáo viên cờ vua'),
        note: String(teacher.note || ''),
        createdAt: teacher.createdAt ? normalizeDateTime(teacher.createdAt) : now,
        updatedAt: teacher.updatedAt ? normalizeDateTime(teacher.updatedAt) : now,
      }
    })
}

function normalizeScheduleSessions(sessions) {
  return (sessions ?? [])
    .filter((session) => session && typeof session === 'object')
    .map((session, index) => {
      const now = new Date().toISOString()

      return {
        id: String(session.id || `schedule-${String(index + 1).padStart(3, '0')}`),
        scheduleType: VALID_SCHEDULE_TYPES.includes(session.scheduleType)
          ? session.scheduleType
          : 'recurring',
        title: String(session.title || 'Buổi học mẫu'),
        dayOfWeek: VALID_SCHEDULE_DAYS.includes(session.dayOfWeek)
          ? session.dayOfWeek
          : 'monday',
        startDate: normalizeScheduleDate(session.startDate),
        endDate: normalizeScheduleDate(session.endDate),
        date: normalizeScheduleDate(session.date),
        occurrenceReason: VALID_SCHEDULE_OCCURRENCE_REASONS.includes(session.occurrenceReason)
          ? session.occurrenceReason
          : '',
        startTime: normalizeScheduleTime(session.startTime),
        endTime: normalizeScheduleTime(session.endTime),
        room: String(session.room || ''),
        teacherId: normalizeNullableId(session.teacherId),
        teacherName: String(session.teacherName || ''),
        studentIds: normalizeStringArray(session.studentIds),
        groupName: String(session.groupName || ''),
        level: VALID_SCHEDULE_LEVELS.includes(session.level) ? session.level : 'mixed',
        status: VALID_SCHEDULE_STATUSES.includes(session.status) ? session.status : 'scheduled',
        note: String(session.note || ''),
        createdAt: session.createdAt ? normalizeDateTime(session.createdAt) : now,
        updatedAt: session.updatedAt ? normalizeDateTime(session.updatedAt) : now,
      }
    })
}

function normalizeScheduleTime(value) {
  const timeText = String(value ?? '').trim()
  return /^\d{2}:\d{2}$/.test(timeText) ? timeText : ''
}

function normalizeScheduleDate(value) {
  const dateText = String(value ?? '').trim()
  return isValidDateString(dateText) ? dateText : null
}

function normalizeSessionReports(reports) {
  return (reports ?? [])
    .filter((report) => report && typeof report === 'object')
    .map((report) => {
      const sessionId = String(report.sessionId ?? '').trim()
      const occurrenceDate = String(report.occurrenceDate ?? '').trim()

      if (!sessionId || !isValidDateString(occurrenceDate)) {
        return null
      }

      const now = new Date().toISOString()
      const createdAt = report.createdAt ? normalizeDateTime(report.createdAt) : now

      return {
        id: String(report.id || createSessionReportId(sessionId, occurrenceDate)),
        sessionId,
        occurrenceDate,
        attendance: normalizeSessionReportAttendance(report.attendance),
        learningGroups: normalizeSessionReportLearningGroups(report.learningGroups),
        guestParticipants: normalizeSessionReportGuestParticipants(report.guestParticipants),
        teachingAssistantNotes: String(report.teachingAssistantNotes || ''),
        classSituation: String(report.classSituation || ''),
        suggestions: String(report.suggestions || ''),
        createdAt,
        updatedAt: report.updatedAt ? normalizeDateTime(report.updatedAt) : createdAt,
      }
    })
    .filter(Boolean)
}

function normalizeSessionReportAttendance(attendance) {
  return (Array.isArray(attendance) ? attendance : [])
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const studentId = String(item.studentId ?? '').trim()

      if (!studentId) {
        return null
      }

      return {
        studentId,
        attendanceStatus: VALID_ATTENDANCE_STATUSES.includes(item.attendanceStatus)
          ? item.attendanceStatus
          : 'present',
        note: String(item.note || ''),
      }
    })
    .filter(Boolean)
}

function normalizeSessionReportLearningGroups(learningGroups) {
  return (Array.isArray(learningGroups) ? learningGroups : [])
    .filter((group) => group && typeof group === 'object')
    .map((group, index) => ({
      id: String(group.id || `learning-group-${String(index + 1).padStart(3, '0')}`),
      title: String(group.title || ''),
      studentIds: normalizeStringArray(group.studentIds),
      contentLines: normalizeStringArray(group.contentLines),
      note: String(group.note || ''),
    }))
}

function normalizeSessionReportGuestParticipants(guestParticipants) {
  return (Array.isArray(guestParticipants) ? guestParticipants : [])
    .filter((guest) => guest && typeof guest === 'object')
    .map((guest, index) => {
      const participationType = VALID_GUEST_PARTICIPATION_TYPES.includes(guest.participationType)
        ? guest.participationType
        : 'trial'

      return {
        id: String(guest.id || `guest-${String(index + 1).padStart(3, '0')}`),
        displayName: String(guest.displayName || ''),
        participationType,
        attendanceStatus: participationType,
        note: String(guest.note || ''),
      }
    })
    .filter((guest) => guest.displayName)
}

function createSessionReportId(sessionId, occurrenceDate) {
  const safeSessionId = String(sessionId).replace(/[^a-zA-Z0-9_-]+/g, '-')
  return `report-${safeSessionId}-${occurrenceDate}`
}

function normalizeNullableId(value) {
  const id = String(value ?? '').trim()
  return id || null
}

function normalizeCashflowTransactions(transactions) {
  return transactions.map((transaction, index) => {
    const normalizedTransaction = {
      id: String(transaction.id || `cashflow-${String(index + 1).padStart(3, '0')}`),
      type: transaction.type === 'expense' ? 'expense' : 'income',
      category: String(transaction.category || 'Khác'),
      amount: normalizeMoneyNumber(transaction.amount),
      transactionDate: transaction.transactionDate ? String(transaction.transactionDate) : '',
      method: String(transaction.method || 'Khác'),
      personName: String(transaction.personName || ''),
      recordedBy: String(transaction.recordedBy || 'Admin DreamHome'),
      note: String(transaction.note || ''),
      sourceModule: String(transaction.sourceModule || 'manual'),
      sourceType: String(transaction.sourceType || ''),
      sourcePaymentId: String(transaction.sourcePaymentId || ''),
      sourceTuitionId: String(transaction.sourceTuitionId || ''),
      sourceStudentId: String(transaction.sourceStudentId || ''),
      sourceTermId: String(transaction.sourceTermId || ''),
      sourceMovementId: String(transaction.sourceMovementId || ''),
      sourceItemId: String(transaction.sourceItemId || ''),
      createdAt: transaction.createdAt || new Date().toISOString(),
      updatedAt: transaction.updatedAt || transaction.createdAt || new Date().toISOString(),
    }
    const attachment = normalizeCashflowAttachment(transaction.attachment)

    if (attachment) {
      normalizedTransaction.attachment = attachment
    }

    return normalizedTransaction
  })
}

function normalizeCashflowAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') {
    return null
  }

  const type = String(attachment.type || '')
  const dataUrl = String(attachment.dataUrl || '')
  const size = normalizeNumber(attachment.size)

  if (!type.startsWith('image/') || !dataUrl.startsWith('data:image/') || size > CASHFLOW_ATTACHMENT_MAX_SIZE) {
    return null
  }

  return {
    id: String(attachment.id || `attachment-${Date.now()}`),
    name: String(attachment.name || 'anh-giao-dich'),
    type,
    size,
    dataUrl,
    createdAt: attachment.createdAt || new Date().toISOString(),
  }
}

function normalizeCashflowCategories(categories) {
  return categories.map((category, index) => {
    const categoryName = typeof category === 'string' ? category : category.name
    const categoryType = typeof category === 'string' ? 'both' : category.type
    const now = new Date().toISOString()

    return {
      id: String(
        typeof category === 'string'
          ? `cash-cat-${index + 1}`
          : category.id || `cash-cat-${index + 1}`,
      ),
      name: String(categoryName || 'Khác'),
      type: ['income', 'expense', 'both'].includes(categoryType) ? categoryType : 'both',
      isArchived: Boolean(typeof category === 'string' ? false : category.isArchived),
      createdAt: typeof category === 'string' ? now : category.createdAt || now,
      updatedAt: typeof category === 'string' ? now : category.updatedAt || now,
    }
  })
}

function normalizeCashbookSettings(settings = {}, fallbackSettings = {}) {
  const openingDate = isValidDateString(settings.openingDate)
    ? String(settings.openingDate)
    : isValidDateString(fallbackSettings.openingDate)
      ? String(fallbackSettings.openingDate)
      : new Date().toISOString().slice(0, 10)

  return {
    openingBalance: Math.max(0, normalizeMoneyNumber(settings.openingBalance)),
    openingDate,
    updatedAt: settings.updatedAt ? normalizeDateTime(settings.updatedAt) : '',
    updatedBy: String(settings.updatedBy || fallbackSettings.updatedBy || 'Admin'),
    isConfigured: Boolean(settings.isConfigured),
  }
}

function normalizeCashbookReconciliations(reconciliations) {
  const reconciliationsByDate = new Map()

  reconciliations
    .filter((reconciliation) => reconciliation && typeof reconciliation === 'object')
    .forEach((reconciliation, index) => {
      if (!isValidDateString(reconciliation.date)) {
        return
      }

      const systemClosingBalance = normalizeMoneyNumber(reconciliation.systemClosingBalance)
      const actualCash = normalizeMoneyNumber(reconciliation.actualCash)
      const difference =
        Number.isFinite(Number(reconciliation.difference))
          ? Number(reconciliation.difference)
          : actualCash - systemClosingBalance
      const status =
        reconciliation.status === 'matched' || reconciliation.status === 'mismatched'
          ? reconciliation.status
          : difference === 0
            ? 'matched'
            : 'mismatched'
      const checkedAt = reconciliation.checkedAt
        ? normalizeDateTime(reconciliation.checkedAt)
        : new Date().toISOString()

      reconciliationsByDate.set(String(reconciliation.date), {
        id: String(reconciliation.id || `cashbook-reconciliation-${index + 1}`),
        date: String(reconciliation.date),
        systemClosingBalance,
        actualCash,
        difference,
        status,
        checkedBy: String(reconciliation.checkedBy || 'Admin'),
        note: String(reconciliation.note || ''),
        checkedAt,
        updatedAt: reconciliation.updatedAt ? normalizeDateTime(reconciliation.updatedAt) : checkedAt,
        isClosed: Boolean(reconciliation.isClosed),
        closedAt: reconciliation.closedAt ? normalizeDateTime(reconciliation.closedAt) : null,
        closedBy: reconciliation.closedBy ? String(reconciliation.closedBy) : null,
      })
    })

  return Array.from(reconciliationsByDate.values()).sort((firstItem, secondItem) =>
    secondItem.date.localeCompare(firstItem.date),
  )
}

function normalizeInventoryItems(items) {
  return (items ?? [])
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      id: String(item.id || `inventory-${String(index + 1).padStart(3, '0')}`),
      name: String(item.name || 'Vật tư'),
      category: String(item.category || 'Khác'),
      unit: String(item.unit || 'cái'),
      quantity: normalizeInventoryNumber(item.quantity),
      lowStockThreshold: normalizeInventoryNumber(item.lowStockThreshold),
      condition: String(item.condition || 'Đang dùng'),
      location: String(item.location || ''),
      note: String(item.note || ''),
      createdAt: item.createdAt ? normalizeDateTime(item.createdAt) : '',
      updatedAt: item.updatedAt ? normalizeDateTime(item.updatedAt) : new Date().toISOString(),
    }))
}

function normalizeInventoryMovements(movements) {
  return (movements ?? [])
    .filter((movement) => movement && typeof movement === 'object')
    .map((movement, index) => ({
      id: String(movement.id || `inventory-movement-${String(index + 1).padStart(3, '0')}`),
      itemId: String(movement.itemId || ''),
      itemName: String(movement.itemName || 'Vật tư'),
      type: movement.type === 'out' ? 'out' : 'in',
      quantity: normalizeInventoryNumber(movement.quantity),
      movementDate: isValidDateString(movement.movementDate)
        ? String(movement.movementDate)
        : new Date().toISOString().slice(0, 10),
      reason: String(movement.reason || 'Khác'),
      handledBy: String(movement.handledBy || 'Admin'),
      note: String(movement.note || ''),
      costAmount: normalizeMoneyNumber(movement.costAmount),
      costMethod: String(movement.costMethod || ''),
      supplierName: String(movement.supplierName || ''),
      beforeQuantity: normalizeInventoryNumber(movement.beforeQuantity),
      afterQuantity: normalizeInventoryNumber(movement.afterQuantity),
      createdAt: movement.createdAt ? normalizeDateTime(movement.createdAt) : new Date().toISOString(),
    }))
    .filter((movement) => movement.itemId)
    .sort(
      (firstMovement, secondMovement) =>
        new Date(secondMovement.createdAt) - new Date(firstMovement.createdAt),
    )
}

function normalizeInventoryNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0
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
      discountType: normalizeTuitionDiscountType(term.discountType, term.discountAmount),
      discountValue: normalizeTuitionDiscountValue(term.discountType, term.discountValue, term.discountAmount),
      discountAmount: normalizeNumber(term.discountAmount),
      paidAmount: normalizeNumber(term.paidAmount),
      dueDate: term.dueDate ? String(term.dueDate) : '',
      note: String(term.note || ''),
      status: ['completed', 'archived'].includes(term.status) ? term.status : 'archived',
      startedAt: term.startedAt ? normalizeDateTime(term.startedAt) : '',
      endedAt: term.endedAt ? normalizeDateTime(term.endedAt) : '',
      payments: normalizeTuitionPayments(term.payments),
    }))
}

function normalizeTuitionDiscountType(discountType, discountAmount = 0) {
  if (['none', 'percent', 'fixed'].includes(discountType)) {
    return discountType
  }

  return normalizeNumber(discountAmount) > 0 ? 'fixed' : 'none'
}

function normalizeTuitionDiscountValue(discountType, discountValue, discountAmount = 0) {
  if (['percent', 'fixed'].includes(discountType)) {
    return Math.max(0, normalizeNumber(discountValue))
  }

  return normalizeNumber(discountAmount) > 0 ? normalizeNumber(discountAmount) : 0
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

function normalizeMoneyNumber(value) {
  const numberValue =
    typeof value === 'string' ? Number(value.replace(/[^\d]/g, '')) : Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) {
    return false
  }

  const dateValue = new Date(value)
  return !Number.isNaN(dateValue.getTime()) && dateValue.toISOString().slice(0, 10) === value
}

function normalizeNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function normalizeNullablePositiveNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : null
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? '').trim()).filter(Boolean)
    : []
}

function normalizeDateTime(value) {
  const dateValue = new Date(value)
  return Number.isNaN(dateValue.getTime()) ? new Date().toISOString() : dateValue.toISOString()
}
