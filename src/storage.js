const VIEW_MODE_KEY = 'ichess-center-os:view-mode'
const DESKTOP_ORDER_KEY = 'ichess-center-os:desktop-module-order'
const STUDENTS_KEY = 'ichessCenterOS.students.dreamhome'
const CLASS_SESSIONS_KEY = 'ichessCenterOS.classSessions.dreamhome'
const NOTIFICATIONS_KEY = 'ichessCenterOS.notifications.dreamhome'
const NOTIFICATIONS_VERSION_KEY = 'ichessCenterOS.notifications.version.dreamhome'
const DELETED_NOTIFICATION_IDS_KEY = 'ichessCenterOS.notifications.deletedIds.dreamhome'
const TUITION_KEY = 'ichessCenterOS.tuition.dreamhome'
const TEACHERS_KEY = 'ichessCenterOS.teachers.dreamhome'
const SCHEDULE_KEY = 'ichessCenterOS.schedule.dreamhome'
const SESSION_REPORTS_KEY = 'ichessCenterOS.sessionReports.dreamhome'
const ATTENDANCE_ADVISORY_NOTES_KEY = 'ichessCenterOS.attendanceAdvisoryNotes.dreamhome'
const ATTENDANCE_BOARD_NOTES_KEY = 'ichessCenterOS.attendanceBoardNotes.dreamhome'
const PARENT_CONSULTATIONS_KEY = 'ichessCenterOS.parentConsultations.dreamhome'
const CASHFLOW_KEY = 'ichessCenterOS.cashflow.dreamhome'
const CASHFLOW_CATEGORIES_KEY = 'ichessCenterOS.cashflowCategories.dreamhome'
const CASHBOOK_SETTINGS_KEY = 'ichessCenterOS.cashbookSettings.dreamhome'
const CASHBOOK_RECONCILIATIONS_KEY = 'ichessCenterOS.cashbookReconciliations.dreamhome'
const INVENTORY_KEY = 'ichessCenterOS.inventory.dreamhome'
const INVENTORY_MOVEMENTS_KEY = 'ichessCenterOS.inventoryMovements.dreamhome'
const INVENTORY_REQUESTS_KEY = 'ichessCenterOS.inventoryRequests.dreamhome'
const CURRENT_NOTIFICATIONS_VERSION = '15J.1'
const VALID_VIEW_MODES = ['grid', 'list']
const VALID_NOTIFICATION_LEVELS = ['info', 'warning', 'danger', 'success']
const VALID_NOTIFICATION_TYPES = [
  'system',
  'tuition',
  'tuition-advisory',
  'student',
  'schedule',
  'inventory',
  'inventory-request',
  'parent-followup',
  'report',
]
const VALID_TEACHER_STATUSES = ['active', 'paused', 'inactive']
const VALID_TEACHER_TYPES = ['fulltime', 'parttime', 'collaborator']
const CASHFLOW_ATTACHMENT_MAX_SIZE = 1024 * 1024
const VALID_SCHEDULE_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const VALID_CLASS_SESSION_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
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
const VALID_ADVISORY_CARE_STATUSES = [
  'auto',
  'needReview',
  'sentComment',
  'contactedParent',
  'waitingParent',
  'completed',
]
const VALID_PARENT_CONTACT_TYPES = ['currentParent', 'consultingLead', 'reservedParent', 'stoppedParent']
const VALID_CONSULTATION_STATUSES = [
  'activeCare',
  'newLead',
  'waitingResponse',
  'trialScheduled',
  'pendingEnrollment',
  'converted',
  'paused',
  'closed',
]
const VALID_PARENT_CONTACT_SOURCES = [
  'parentReferral',
  'facebook',
  'zalo',
  'walkIn',
  'school',
  'oldStudent',
  'website',
  'eventTournament',
  'unknown',
]
const VALID_PARENT_CARE_LOG_CHANNELS = ['phone', 'zalo', 'facebook', 'direct', 'email', 'note', 'other']
const VALID_PARENT_APPOINTMENT_TYPES = [
  'consultation',
  'trialLesson',
  'callback',
  'followUp',
  'other',
]
const VALID_PARENT_APPOINTMENT_STATUSES = [
  'scheduled',
  'completed',
  'missed',
  'cancelled',
  'rescheduled',
]
const VALID_INVENTORY_REQUEST_STATUSES = [
  'new',
  'pending',
  'preparing',
  'fulfilled',
  'rejected',
  'cancelled',
]
const VALID_INVENTORY_REQUEST_ITEM_TYPES = [
  'book',
  'pencil',
  'eraser',
  'test',
  'standardChessSet',
  'chessClock',
  'scoreSheet',
  'other',
]
const VALID_INVENTORY_REQUEST_USAGE_MODES = [
  'homeTutoring',
  'onlinePrivate',
  'onlineGroup',
  'centerClass',
  'clubPartner',
  'other',
]
const LEGACY_SAMPLE_TEACHER_NAMES = ['Tháº§y Tháº¯ng', 'CĂ´ VĂ¢n', 'Tháº§y Háº£i']
const UNASSIGNED_TEACHER_NAME = 'ChÆ°a phĂ¢n cĂ´ng'
const STUDENT_LEVELS = [
  'Dolphin 1',
  'Dolphin 2',
  'Dolphin 3',
  'Dolphin 4',
  'Turtle 1',
  'Turtle 2',
  'Turtle 3',
  'Bee 1',
  'Bee 2',
  'Bee 3',
  'Monkey 1',
  'Monkey 2',
  'Monkey 3',
  'Elephant 1',
  'Elephant 2',
  'Elephant 3',
  'Jaguar',
  'Lion',
  'Eagle',
]

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

export function getStoredClassSessions(defaultClassSessions = []) {
  try {
    const storedClassSessions = JSON.parse(localStorage.getItem(CLASS_SESSIONS_KEY))

    if (Array.isArray(storedClassSessions)) {
      const normalizedClassSessions = normalizeClassSessions(storedClassSessions)
      saveStoredClassSessions(normalizedClassSessions)
      return normalizedClassSessions
    }
  } catch {
    localStorage.removeItem(CLASS_SESSIONS_KEY)
  }

  const normalizedDefaultClassSessions = normalizeClassSessions(defaultClassSessions)
  saveStoredClassSessions(normalizedDefaultClassSessions)
  return normalizedDefaultClassSessions
}

export function saveStoredClassSessions(classSessions) {
  localStorage.setItem(
    CLASS_SESSIONS_KEY,
    JSON.stringify(normalizeClassSessions(classSessions)),
  )
}

export function getClassSessions(defaultClassSessions = []) {
  return getStoredClassSessions(defaultClassSessions)
}

export function saveClassSessions(classSessions) {
  saveStoredClassSessions(classSessions)
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

export function getStoredAttendanceAdvisoryNotes(defaultNotes = []) {
  try {
    const storedNotes = JSON.parse(localStorage.getItem(ATTENDANCE_ADVISORY_NOTES_KEY))

    if (Array.isArray(storedNotes)) {
      return normalizeAttendanceAdvisoryNotes(storedNotes)
    }
  } catch {
    localStorage.removeItem(ATTENDANCE_ADVISORY_NOTES_KEY)
  }

  return normalizeAttendanceAdvisoryNotes(defaultNotes)
}

export function saveStoredAttendanceAdvisoryNotes(notes) {
  localStorage.setItem(
    ATTENDANCE_ADVISORY_NOTES_KEY,
    JSON.stringify(normalizeAttendanceAdvisoryNotes(notes)),
  )
}

export function getStoredAttendanceBoardNotes(defaultNotes = []) {
  try {
    const storedNotes = JSON.parse(localStorage.getItem(ATTENDANCE_BOARD_NOTES_KEY))

    if (Array.isArray(storedNotes)) {
      return normalizeAttendanceBoardNotes(storedNotes)
    }
  } catch {
    localStorage.removeItem(ATTENDANCE_BOARD_NOTES_KEY)
  }

  return normalizeAttendanceBoardNotes(defaultNotes)
}

export function saveStoredAttendanceBoardNotes(notes) {
  localStorage.setItem(
    ATTENDANCE_BOARD_NOTES_KEY,
    JSON.stringify(normalizeAttendanceBoardNotes(notes)),
  )
}

export function getStoredParentConsultations(defaultContacts) {
  try {
    const storedContacts = JSON.parse(localStorage.getItem(PARENT_CONSULTATIONS_KEY))

    if (Array.isArray(storedContacts)) {
      const normalizedContacts = normalizeParentConsultations(storedContacts)
      saveStoredParentConsultations(normalizedContacts)
      return normalizedContacts
    }
  } catch {
    localStorage.removeItem(PARENT_CONSULTATIONS_KEY)
  }

  const normalizedDefaultContacts = normalizeParentConsultations(defaultContacts)
  saveStoredParentConsultations(normalizedDefaultContacts)
  return normalizedDefaultContacts
}

export function saveStoredParentConsultations(contacts) {
  localStorage.setItem(
    PARENT_CONSULTATIONS_KEY,
    JSON.stringify(normalizeParentConsultations(contacts)),
  )
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

export function getStoredInventoryRequests(defaultRequests = []) {
  try {
    const storedRequests = JSON.parse(localStorage.getItem(INVENTORY_REQUESTS_KEY))

    if (Array.isArray(storedRequests)) {
      const normalizedRequests = normalizeInventoryRequests(storedRequests)
      saveStoredInventoryRequests(normalizedRequests)
      return normalizedRequests
    }
  } catch {
    localStorage.removeItem(INVENTORY_REQUESTS_KEY)
  }

  const normalizedDefaultRequests = normalizeInventoryRequests(defaultRequests)
  saveStoredInventoryRequests(normalizedDefaultRequests)
  return normalizedDefaultRequests
}

export function saveStoredInventoryRequests(requests) {
  localStorage.setItem(
    INVENTORY_REQUESTS_KEY,
    JSON.stringify(normalizeInventoryRequests(requests)),
  )
}

function normalizeStudents(students) {
  return students.map((student, index) => {
    const mainTeacherName = normalizeStudentTeacherName(student.mainTeacherName)
    const assignedTeacherId = normalizeStudentAssignedTeacherId(student.assignedTeacherId)
    const deletionState = normalizeStudentDeletionState(student)
    const level = normalizeStudentLevel(student.level)
    const fatherPhone = String(student.fatherPhone ?? '')
    const motherPhone = String(
      student.motherPhone ?? (!fatherPhone ? student.parentPhone : '') ?? '',
    )
    const parentPhone = String(student.parentPhone || motherPhone || fatherPhone)
    const classSessionIds = normalizeStringArray(student.classSessionIds)
    const studentCode = normalizeStudentCode(student.studentCode || student.code || student.internalCode, index)

    if (Array.isArray(student.careNotes)) {
      return {
        ...student,
        studentCode,
        mainTeacherName,
        assignedTeacherId,
        level,
        fatherPhone,
        motherPhone,
        parentPhone,
        classSessionIds,
        ...deletionState,
      }
    }

    const legacyNote = String(student.latestCareNote ?? '').trim()
    const hasRealLegacyNote =
      legacyNote &&
      legacyNote !== 'ChÆ°a cĂ³ ghi chĂº chÄƒm sĂ³c.' &&
      !legacyNote.toLowerCase().includes('chÆ°a cĂ³ ghi chĂº')

    return {
      ...student,
      studentCode,
      mainTeacherName,
      assignedTeacherId,
      level,
      fatherPhone,
      motherPhone,
      parentPhone,
      classSessionIds,
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

export function normalizeClassSessions(classSessions) {
  return (classSessions ?? [])
    .filter((classSession) => classSession && typeof classSession === 'object')
    .map((classSession, index) => normalizeClassSession(classSession, index))
}

export function normalizeClassSession(classSession, index = 0) {
  const now = new Date().toISOString()
  const name = String(classSession.name || classSession.displayLabel || '').trim()
  const sourceDaysLabel = String(classSession.daysLabel || classSession.dayLabel || '').trim()
  const daysOfWeek = normalizeClassSessionDaysOfWeek(classSession.daysOfWeek, sourceDaysLabel)
  const daysLabel = buildClassSessionDaysLabel(daysOfWeek) || sourceDaysLabel
  const startTime = String(classSession.startTime || '').trim()
  const endTime = String(classSession.endTime || '').trim()
  const generatedLabel =
    daysLabel && startTime && endTime ? `${daysLabel} ${startTime}-${endTime}` : name

  return {
    ...classSession,
    id: String(classSession.id || `class-session-${index + 1}`).trim(),
    name: name || generatedLabel || `Ca học ${index + 1}`,
    daysOfWeek,
    daysLabel,
    dayLabel: daysLabel,
    startTime,
    endTime,
    displayLabel: String(classSession.displayLabel || generatedLabel || name || `Ca học ${index + 1}`).trim(),
    status: classSession.status === 'inactive' ? 'inactive' : 'active',
    note: String(classSession.note || ''),
    createdAt: classSession.createdAt ? normalizeDateTime(classSession.createdAt) : now,
    updatedAt: classSession.updatedAt ? normalizeDateTime(classSession.updatedAt) : now,
  }
}

export function getActiveClassSessions(classSessions = []) {
  return normalizeClassSessions(classSessions).filter(
    (classSession) => classSession.status !== 'inactive',
  )
}

export function buildClassSessionMap(classSessions = []) {
  return new Map(
    normalizeClassSessions(classSessions)
      .filter((classSession) => classSession.id)
      .map((classSession) => [String(classSession.id), classSession]),
  )
}

export function getClassSessionById(classSessions = [], id) {
  return buildClassSessionMap(classSessions).get(String(id ?? '')) ?? null
}

function normalizeClassSessionDaysOfWeek(daysOfWeek, fallbackLabel = '') {
  const values = Array.isArray(daysOfWeek) ? daysOfWeek : []
  const normalized = values
    .map((day) => String(day || '').trim().toLowerCase())
    .map((day) => {
      const aliasMap = {
        monday: 'mon',
        t2: 'mon',
        tuesday: 'tue',
        t3: 'tue',
        wednesday: 'wed',
        t4: 'wed',
        thursday: 'thu',
        t5: 'thu',
        friday: 'fri',
        t6: 'fri',
        saturday: 'sat',
        t7: 'sat',
        sunday: 'sun',
        cn: 'sun',
      }
      return aliasMap[day] || day
    })
    .filter((day) => VALID_CLASS_SESSION_DAYS.includes(day))

  const uniqueDays = Array.from(new Set(normalized)).sort(
    (firstDay, secondDay) => VALID_CLASS_SESSION_DAYS.indexOf(firstDay) - VALID_CLASS_SESSION_DAYS.indexOf(secondDay),
  )

  return uniqueDays.length ? uniqueDays : parseClassSessionDaysLabel(fallbackLabel)
}

function parseClassSessionDaysLabel(label = '') {
  const source = String(label || '').toUpperCase()
  const tokens = source.match(/CN|T[2-7]/g) || []
  const indexes = new Set()

  tokens.forEach((token) => {
    const startIndex = getClassSessionDayIndex(token)

    if (startIndex === null) {
      return
    }

    indexes.add(startIndex)
  })

  return Array.from(indexes)
    .sort((firstIndex, secondIndex) => firstIndex - secondIndex)
    .map((index) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][index])
}

function buildClassSessionDaysLabel(daysOfWeek = []) {
  const dayLabels = {
    mon: 'T2',
    tue: 'T3',
    wed: 'T4',
    thu: 'T5',
    fri: 'T6',
    sat: 'T7',
    sun: 'CN',
  }
  return (Array.isArray(daysOfWeek) ? daysOfWeek : [])
    .filter((day) => VALID_CLASS_SESSION_DAYS.includes(day))
    .map((day) => dayLabels[day])
    .join('-')
}

function getClassSessionDayIndex(label) {
  const normalizedLabel = String(label || '').trim().toUpperCase()

  if (normalizedLabel === 'CN') {
    return 0
  }

  const match = normalizedLabel.match(/^T([2-7])$/)

  return match ? Number(match[1]) - 1 : null
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

function normalizeStudentLevel(value) {
  const levelText = String(value ?? '').trim()
  const normalizedLevelText = normalizeStudentText(levelText)
  const canonicalLevel = STUDENT_LEVELS.find(
    (level) => normalizeStudentText(level) === normalizedLevelText,
  )

  if (canonicalLevel) {
    return canonicalLevel
  }

  const legacyNamedLevels = {
    'nhap mon': 'Dolphin 1',
    'co ban': 'Dolphin 2',
    'trung cap': 'Dolphin 3',
    'nang cao': 'Dolphin 4',
  }

  if (legacyNamedLevels[normalizedLevelText]) {
    return legacyNamedLevels[normalizedLevelText]
  }

  const legacyLevelMatch = levelText.match(/^(?:level\s*)?(\d{1,2})$/i)
  const legacyLevelNumber = legacyLevelMatch ? Number(legacyLevelMatch[1]) : null

  return legacyLevelNumber && legacyLevelNumber >= 1 && legacyLevelNumber <= 15
    ? STUDENT_LEVELS[legacyLevelNumber - 1]
    : 'Dolphin 1'
}

function normalizeStudentText(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeStudentCode(value, index) {
  const existingCode = String(value ?? '').trim()

  if (existingCode) {
    return existingCode
  }

  return `HV-${String(index + 1).padStart(4, '0')}`
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

function normalizeNotifications(notifications) {
  return notifications
    .filter((notification) => notification && typeof notification === 'object')
    .map((notification, index) => {
      const id = String(notification.id || `notif-${String(index + 1).padStart(3, '0')}`)
      const createdAt = normalizeNotificationCreatedAt(notification.createdAt)
      const readAt = normalizeNotificationReadAt(notification.readAt, notification.read, createdAt)
      const severity = normalizeNotificationLevel(notification.severity || notification.level)
      const sourceModule = normalizeNotificationSourceModule(notification.sourceModule)

      return {
        id,
        dedupeKey: String(notification.dedupeKey || id),
        sourceModule,
        sourceLabel: String(notification.sourceLabel || getNotificationSourceLabel(sourceModule)),
        type: normalizeNotificationType(notification.type),
        severity,
        level: severity,
        title: String(notification.title || 'ThÄ‚Â´ng bÄ‚Â¡o'),
        message: String(notification.message || ''),
        entityId: notification.entityId ? String(notification.entityId) : '',
        entityType: notification.entityType ? String(notification.entityType) : '',
        entityLabel: notification.entityLabel ? String(notification.entityLabel) : '',
        createdAt,
        updatedAt: normalizeNotificationCreatedAt(notification.updatedAt || createdAt),
        readAt,
        read: Boolean(readAt),
        meta: notification.meta && typeof notification.meta === 'object' ? notification.meta : {},
      }
    })
}

function normalizeNotificationReadAt(readAt, legacyRead, fallbackDate) {
  if (readAt) {
    const readDate = new Date(readAt)
    return Number.isNaN(readDate.getTime()) ? '' : readDate.toISOString()
  }

  return legacyRead ? fallbackDate : ''
}

function normalizeNotificationSourceModule(sourceModule) {
  const sourceModuleMap = {
    system: 'he-thong',
    student: 'hoc-vien',
    tuition: 'hoc-phi',
    inventory: 'kho-hang',
    schedule: 'thoi-khoa-bieu',
    report: 'he-thong',
  }
  const normalizedSourceModule = String(sourceModule || 'he-thong')

  return sourceModuleMap[normalizedSourceModule] || normalizedSourceModule
}

function getNotificationSourceLabel(sourceModule) {
  const sourceLabels = {
    'hoc-vien': 'Há»c viĂªn',
    'hoc-phi': 'Há»c phĂ­',
    'phu-huynh-tu-van': 'Phá»¥ huynh / TÆ° váº¥n',
    'kho-hang': 'Kho hĂ ng',
    'giao-vien': 'GiĂ¡o viĂªn',
    'thoi-khoa-bieu': 'Thá»i khĂ³a biá»ƒu',
    'thu-chi': 'Thu chi',
    'so-quy': 'Sá»• quá»¹',
    'cai-dat-co-so': 'CĂ i Ä‘áº·t cÆ¡ sá»Ÿ',
    'he-thong': 'Há»‡ thá»‘ng',
  }

  return sourceLabels[sourceModule] || sourceModule || sourceLabels['he-thong']
}

function normalizeTuitionRecords(tuitionRecords) {
  return tuitionRecords
    .filter((record) => record && typeof record === 'object')
    .map((record, index) => {
      const totalAmount = normalizeNumber(record.totalAmount)
      const hasTotalSessionsData =
        record.hasTotalSessionsData !== false &&
        record.totalSessions !== null &&
        record.totalSessions !== undefined &&
        Number.isFinite(Number(record.totalSessions))
      const hasUsedSessionsData =
        record.hasUsedSessionsData !== false &&
        record.usedSessions !== null &&
        record.usedSessions !== undefined &&
        Number.isFinite(Number(record.usedSessions))
      const discountType = normalizeTuitionDiscountType(record.discountType, record.discountAmount)
      const discountValue = normalizeTuitionDiscountValue(
        discountType,
        record.discountValue,
        record.discountAmount,
      )
      const discountAmount = calculateNormalizedTuitionDiscount(
        totalAmount,
        discountType,
        discountValue,
      )

      return {
        ...record,
        id: String(record.id || `tuition-${String(index + 1).padStart(3, '0')}`),
        studentId: String(record.studentId || ''),
        packageName: String(record.packageName || 'GĂ³i há»c'),
        totalSessions: normalizeNumber(record.totalSessions),
        usedSessions: normalizeNumber(record.usedSessions),
        hasTotalSessionsData,
        hasUsedSessionsData,
        totalAmount,
        discountType,
        discountValue,
        discountAmount,
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
      }
    })
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
        ...teacher,
        id: String(teacher.id || `teacher-${String(index + 1).padStart(3, '0')}`),
        fullName: String(teacher.fullName || teacher.name || 'GiĂ¡o viĂªn'),
        displayName: String(teacher.displayName || ''),
        phone: String(teacher.phone || ''),
        email: String(teacher.email || ''),
        status,
        teacherType,
        specialties: normalizeStringArray(teacher.specialties),
        levels: normalizeStringArray(teacher.levels ?? teacher.teachingLevels),
        teachingLevels: normalizeStringArray(teacher.teachingLevels ?? teacher.levels),
        teachingGroups: normalizeStringArray(teacher.teachingGroups),
        teachingModes: normalizeStringArray(teacher.teachingModes).filter((mode) =>
          ['group', 'oneOnOne', 'competition', 'online'].includes(mode),
        ),
        strengths: normalizeStringArray(teacher.strengths),
        internalTags: normalizeStringArray(teacher.internalTags),
        assignedClassNames: normalizeStringArray(teacher.assignedClassNames),
        assignedStudentIds: normalizeStringArray(teacher.assignedStudentIds),
        currentStudentCount: Math.max(0, normalizeNumber(teacher.currentStudentCount)),
        availableDays: normalizeStringArray(teacher.availableDays).filter((day) =>
          ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(day),
        ),
        preferredTimeSlots: normalizeStringArray(teacher.preferredTimeSlots).filter((slot) =>
          ['morning', 'afternoon', 'evening', 'weekendMorning', 'weekendAfternoon'].includes(slot),
        ),
        availableClassSessionIds: normalizeStringArray(teacher.availableClassSessionIds),
        maxSessionsPerWeek: normalizeNullablePositiveNumber(teacher.maxSessionsPerWeek),
        canTakeNewClass:
          typeof teacher.canTakeNewClass === 'boolean'
            ? teacher.canTakeNewClass
            : typeof teacher.acceptNewStudents === 'boolean'
              ? teacher.acceptNewStudents
              : true,
        scheduleNote: String(teacher.scheduleNote || ''),
        mainRole: String(teacher.mainRole || 'GiĂ¡o viĂªn cá» vua'),
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
        ...session,
        id: String(session.id || `schedule-${String(index + 1).padStart(3, '0')}`),
        scheduleType: VALID_SCHEDULE_TYPES.includes(session.scheduleType)
          ? session.scheduleType
          : 'recurring',
        title: String(session.title || 'Buá»•i há»c máº«u'),
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
        classSessionId: String(session.classSessionId || ''),
        teacherId: normalizeNullableId(session.teacherId),
        teacherName: String(session.teacherName || ''),
        studentIds: normalizeStringArray(session.studentIds),
        groupName: String(session.groupName || ''),
        level: VALID_SCHEDULE_LEVELS.includes(session.level) ? session.level : 'mixed',
        status: VALID_SCHEDULE_STATUSES.includes(session.status) ? session.status : 'scheduled',
        note: String(session.note || ''),
        sourceModule: String(session.sourceModule || ''),
        sourceTag: String(session.sourceTag || ''),
        importBatchId: String(session.importBatchId || ''),
        datasetId: String(session.datasetId || ''),
        datasetVersion: String(session.datasetVersion || ''),
        isControlledFixture: Boolean(session.isControlledFixture),
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
        classSessionId: String(report.classSessionId || ''),
        occurrenceDate,
        attendance: normalizeSessionReportAttendance(report.attendance),
        isDemoAttendance: Boolean(report.isDemoAttendance),
        isImportedAttendance: Boolean(report.isImportedAttendance),
        sourceModule: String(report.sourceModule || ''),
        sourceTag: String(report.sourceTag || ''),
        importBatchId: String(report.importBatchId || ''),
        demoBatchId: String(report.demoBatchId || ''),
        teacherName: String(report.teacherName || ''),
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
        isDemoAttendance: Boolean(item.isDemoAttendance),
        isImportedAttendance: Boolean(item.isImportedAttendance),
        sourceModule: String(item.sourceModule || ''),
        sourceTag: String(item.sourceTag || ''),
        importBatchId: String(item.importBatchId || ''),
        demoPaymentStatus: String(item.demoPaymentStatus || ''),
        studentName: String(item.studentName || ''),
        status: String(item.status || ''),
        displayValue: String(item.displayValue || ''),
        credits: normalizeAttendanceCredits(item.credits),
        countsTowardTuition: item.countsTowardTuition !== false,
      }
    })
    .filter(Boolean)
}

function normalizeAttendanceCredits(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => {
      if (value && typeof value === 'object') {
        const sessionNumber = Number(value.sessionNumber ?? value.value ?? value.displayValue)

        if (!Number.isFinite(sessionNumber) && !value.displayValue) {
          return null
        }

        return {
          displayValue: String(value.displayValue || sessionNumber),
          sessionNumber: Number.isFinite(sessionNumber) ? sessionNumber : null,
          creditType: String(value.creditType || ''),
        }
      }

      const sessionNumber = Number(value)

      return Number.isFinite(sessionNumber)
        ? {
            displayValue: String(value),
            sessionNumber,
          }
        : null
    })
    .filter(Boolean)
}

function normalizeAttendanceAdvisoryNotes(notes) {
  const notesByIdentity = new Map()

  ;(Array.isArray(notes) ? notes : []).forEach((note) => {
    const studentId = String(note?.studentId ?? '').trim()
    const monthKey = /^\d{4}-\d{2}$/.test(String(note?.monthKey ?? ''))
      ? String(note.monthKey)
      : ''

    if (!studentId || !monthKey) {
      return
    }

    const careStatus = VALID_ADVISORY_CARE_STATUSES.includes(note.careStatus)
      ? note.careStatus
      : 'auto'

    notesByIdentity.set(`${studentId}:${monthKey}`, {
      id: String(note.id || `advisory-note-${studentId}-${monthKey}`),
      studentId,
      monthKey,
      careStatus,
      note: String(note.note || ''),
      updatedAt: note.updatedAt ? normalizeDateTime(note.updatedAt) : new Date().toISOString(),
    })
  })

  return Array.from(notesByIdentity.values())
}

function normalizeAttendanceBoardNotes(notes) {
  const notesByIdentity = new Map()

  ;(Array.isArray(notes) ? notes : []).forEach((note) => {
    const studentId = String(note?.studentId ?? '').trim()
    const month = /^\d{4}-\d{2}$/.test(String(note?.month ?? note?.monthKey ?? ''))
      ? String(note.month ?? note.monthKey)
      : ''
    const content = String(note?.note ?? note?.content ?? '').trim()

    if (!studentId || !month) {
      return
    }

    const updatedAt = note.updatedAt ? normalizeDateTime(note.updatedAt) : new Date().toISOString()
    notesByIdentity.set(`${studentId}:${month}`, {
      id: String(note.id || `attendance-board-note-${studentId}-${month}`),
      studentId,
      month,
      note: content,
      createdAt: note.createdAt ? normalizeDateTime(note.createdAt) : updatedAt,
      updatedAt,
    })
  })

  return Array.from(notesByIdentity.values())
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

function normalizeParentConsultations(contacts) {
  return (contacts ?? [])
    .filter((contact) => contact && typeof contact === 'object')
    .map((contact, index) => {
      const now = new Date().toISOString()
      const createdAt = contact.createdAt ? normalizeDateTime(contact.createdAt) : now
      const studentBirthYear = normalizeParentStudentBirthYear(contact.studentBirthYear)
      const calculatedAge = calculateAgeFromBirthYear(studentBirthYear)

      return {
        ...contact,
        id: String(contact.id || `contact-${String(index + 1).padStart(3, '0')}`),
        contactType: normalizeParentContactType(contact.contactType),
        parentName: String(contact.parentName || contact.name || ''),
        phone: String(contact.phone || ''),
        secondaryPhone: String(contact.secondaryPhone || ''),
        email: String(contact.email || ''),
        studentName: String(contact.studentName || ''),
        studentId: normalizeNullableId(contact.studentId),
        leadStudentName: String(contact.leadStudentName || ''),
        studentBirthYear,
        leadStudentAge: String(contact.leadStudentAge || calculatedAge || ''),
        leadNeed: String(contact.leadNeed || ''),
        parentFeedbackAboutChild: String(contact.parentFeedbackAboutChild || ''),
        consultationStatus: VALID_CONSULTATION_STATUSES.includes(contact.consultationStatus)
          ? contact.consultationStatus
          : 'newLead',
        source: VALID_PARENT_CONTACT_SOURCES.includes(contact.source) ? contact.source : 'unknown',
        interestedProgram: String(contact.interestedProgram || ''),
        preferredSchedule: String(contact.preferredSchedule || ''),
        locationArea: String(contact.locationArea || ''),
        consultedAt: isValidDateString(contact.consultedAt) ? String(contact.consultedAt) : '',
        registeredAt: isValidDateString(contact.registeredAt) ? String(contact.registeredAt) : '',
        lastContactAt: contact.lastContactAt ? normalizeDateTime(contact.lastContactAt) : '',
        lastNote: String(contact.lastNote || ''),
        nextAction: String(contact.nextAction || ''),
        careLogs: normalizeParentCareLogs(contact.careLogs, {
          createdAt,
          updatedAt: contact.updatedAt ? normalizeDateTime(contact.updatedAt) : createdAt,
        }),
        appointments: normalizeParentAppointments(contact.appointments),
        enrollmentDraft: normalizeParentEnrollmentDraft(contact.enrollmentDraft, contact),
        sourceModule: String(contact.sourceModule || ''),
        sourceTag: String(contact.sourceTag || ''),
        importBatchId: String(contact.importBatchId || ''),
        datasetId: String(contact.datasetId || ''),
        datasetVersion: String(contact.datasetVersion || ''),
        isControlledFixture: Boolean(contact.isControlledFixture),
        createdAt,
        updatedAt: contact.updatedAt ? normalizeDateTime(contact.updatedAt) : createdAt,
      }
    })
}

function normalizeParentContactType(contactType) {
  const value = String(contactType || '').trim()
  const normalizedText = normalizeStudentText(value)

  if (value === 'formerParent' || normalizedText === 'phu huynh cu') {
    return 'reservedParent'
  }

  return VALID_PARENT_CONTACT_TYPES.includes(value) ? value : 'consultingLead'
}

function normalizeParentStudentBirthYear(value) {
  const birthYear = String(value || '').trim()
  return /^\d{4}$/.test(birthYear) ? birthYear : ''
}

function calculateAgeFromBirthYear(birthYear) {
  if (!birthYear) {
    return ''
  }

  const year = Number.parseInt(birthYear, 10)
  const currentYear = new Date().getFullYear()

  if (!Number.isFinite(year) || year < 1900 || year > currentYear) {
    return ''
  }

  return String(currentYear - year)
}

function normalizeParentCareLogs(careLogs, contactTimestamps = {}) {
  return (Array.isArray(careLogs) ? careLogs : [])
    .filter((log) => log && typeof log === 'object')
    .map((log, index) => {
      const fallbackTime =
        log.createdAt ||
        contactTimestamps.updatedAt ||
        contactTimestamps.createdAt ||
        new Date().toISOString()
      const contactedAt = log.contactedAt ? normalizeDateTime(log.contactedAt) : normalizeDateTime(fallbackTime)

      return {
        id: String(log.id || `care-log-${String(index + 1).padStart(3, '0')}`),
        contactedAt,
        channel: VALID_PARENT_CARE_LOG_CHANNELS.includes(log.channel) ? log.channel : 'other',
        content: String(log.content || ''),
        result: String(log.result || ''),
        nextAction: String(log.nextAction || ''),
        createdAt: log.createdAt ? normalizeDateTime(log.createdAt) : contactedAt,
      }
    })
    .sort(
      (firstLog, secondLog) =>
        new Date(secondLog.contactedAt || secondLog.createdAt || 0) -
        new Date(firstLog.contactedAt || firstLog.createdAt || 0),
    )
}

function normalizeParentAppointments(appointments) {
  return (Array.isArray(appointments) ? appointments : [])
    .filter((appointment) => appointment && typeof appointment === 'object')
    .map((appointment, index) => {
      const scheduledAt = appointment.scheduledAt
        ? normalizeDateTime(appointment.scheduledAt)
        : new Date().toISOString()
      const createdAt = appointment.createdAt ? normalizeDateTime(appointment.createdAt) : scheduledAt

      return {
        id: String(appointment.id || `appointment-${String(index + 1).padStart(3, '0')}`),
        appointmentType: VALID_PARENT_APPOINTMENT_TYPES.includes(appointment.appointmentType)
          ? appointment.appointmentType
          : 'consultation',
        scheduledAt,
        channel: VALID_PARENT_CARE_LOG_CHANNELS.includes(appointment.channel)
          ? appointment.channel
          : 'other',
        location: String(appointment.location || ''),
        status: VALID_PARENT_APPOINTMENT_STATUSES.includes(appointment.status)
          ? appointment.status
          : 'scheduled',
        note: String(appointment.note || ''),
        sourceType: String(appointment.sourceType || ''),
        sourceDraftId: String(appointment.sourceDraftId || ''),
        createdAt,
        updatedAt: appointment.updatedAt ? normalizeDateTime(appointment.updatedAt) : createdAt,
      }
    })
    .sort((firstAppointment, secondAppointment) => {
      const now = Date.now()
      const firstTime = new Date(firstAppointment.scheduledAt || 0).getTime()
      const secondTime = new Date(secondAppointment.scheduledAt || 0).getTime()
      const firstUpcoming = firstAppointment.status === 'scheduled' && firstTime >= now
      const secondUpcoming = secondAppointment.status === 'scheduled' && secondTime >= now

      if (firstUpcoming && secondUpcoming) {
        return firstTime - secondTime
      }

      if (firstUpcoming !== secondUpcoming) {
        return firstUpcoming ? -1 : 1
      }

      return secondTime - firstTime
    })
}

function normalizeParentEnrollmentDraft(enrollmentDraft, contact = {}) {
  const draft =
    enrollmentDraft && typeof enrollmentDraft === 'object'
      ? enrollmentDraft
      : {}
  const hasSavedDraft = Boolean(draft.createdAt || draft.updatedAt)
  const expectedStartDate = isValidDateString(draft.expectedStartDate)
    ? String(draft.expectedStartDate)
    : ''
  const expectedTrialDate = isValidDateString(draft.expectedTrialDate)
    ? String(draft.expectedTrialDate)
    : expectedStartDate

  return {
    isReady: Boolean(draft.isReady),
    studentName: String(
      hasSavedDraft ? draft.studentName || '' : draft.studentName || contact.leadStudentName || contact.studentName || '',
    ),
    studentAge: String(
      hasSavedDraft ? draft.studentAge || '' : draft.studentAge || contact.leadStudentAge || '',
    ),
    studentBirthYear: String(hasSavedDraft ? draft.studentBirthYear || '' : draft.studentBirthYear || contact.studentBirthYear || ''),
    parentName: String(hasSavedDraft ? draft.parentName || '' : draft.parentName || contact.parentName || ''),
    phone: String(hasSavedDraft ? draft.phone || '' : draft.phone || contact.phone || ''),
    interestedProgram: String(
      hasSavedDraft ? draft.interestedProgram || '' : draft.interestedProgram || contact.interestedProgram || '',
    ),
    preferredSchedule: String(
      hasSavedDraft ? draft.preferredSchedule || '' : draft.preferredSchedule || contact.preferredSchedule || '',
    ),
    learningGoal: String(hasSavedDraft ? draft.learningGoal || '' : draft.learningGoal || contact.leadNeed || ''),
    expectedStartDate,
    expectedTrialDate,
    childChessLevel: ['new', 'basic', 'advanced'].includes(draft.childChessLevel)
      ? String(draft.childChessLevel)
      : '',
    trialDraftId: String(draft.trialDraftId || ''),
    trialAppointmentId: String(draft.trialAppointmentId || ''),
    trialScheduledAt: draft.trialScheduledAt ? normalizeDateTime(draft.trialScheduledAt) : '',
    note: String(draft.note || ''),
    advisorName: String(draft.advisorName || ''),
    readyAt: draft.readyAt ? normalizeDateTime(draft.readyAt) : null,
    createdAt: draft.createdAt ? normalizeDateTime(draft.createdAt) : null,
    updatedAt: draft.updatedAt ? normalizeDateTime(draft.updatedAt) : null,
  }
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
      category: String(transaction.category || 'KhĂ¡c'),
      amount: normalizeMoneyNumber(transaction.amount),
      transactionDate: transaction.transactionDate ? String(transaction.transactionDate) : '',
      method: String(transaction.method || 'KhĂ¡c'),
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
      name: String(categoryName || 'KhĂ¡c'),
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
      name: String(item.name || 'Váº­t tÆ°'),
      category: String(item.category || 'KhĂ¡c'),
      unit: String(item.unit || 'cĂ¡i'),
      quantity: normalizeInventoryNumber(item.quantity),
      lowStockThreshold: normalizeInventoryNumber(item.lowStockThreshold),
      condition: String(item.condition || 'Äang dĂ¹ng'),
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
      itemName: String(movement.itemName || 'Váº­t tÆ°'),
      type: movement.type === 'out' ? 'out' : 'in',
      quantity: normalizeInventoryNumber(movement.quantity),
      movementDate: isValidDateString(movement.movementDate)
        ? String(movement.movementDate)
        : new Date().toISOString().slice(0, 10),
      reason: String(movement.reason || 'KhĂ¡c'),
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

function normalizeInventoryRequests(requests) {
  return (requests ?? [])
    .filter((request) => request && typeof request === 'object')
    .map((request, index) => {
      const now = new Date().toISOString()
      const createdAt = request.createdAt ? normalizeDateTime(request.createdAt) : now
      const status = VALID_INVENTORY_REQUEST_STATUSES.includes(request.status)
        ? request.status
        : 'new'

      return {
        ...request,
        id: String(request.id || `inventory-request-${String(index + 1).padStart(3, '0')}`),
        requestCode: String(request.requestCode || createFallbackInventoryRequestCode(createdAt, index)),
        requestedByName: String(request.requestedByName || ''),
        requestedByRole: String(request.requestedByRole || ''),
        requestedByPhone: String(request.requestedByPhone || ''),
        studentName: String(request.studentName || ''),
        linkedStudentId: String(request.linkedStudentId || ''),
        itemTypes: normalizeInventoryRequestEnumArray(
          request.itemTypes,
          VALID_INVENTORY_REQUEST_ITEM_TYPES,
        ),
        otherItemText: String(request.otherItemText || ''),
        itemDetails: String(request.itemDetails || ''),
        usageModes: normalizeInventoryRequestEnumArray(
          request.usageModes,
          VALID_INVENTORY_REQUEST_USAGE_MODES,
        ),
        otherUsageText: String(request.otherUsageText || ''),
        usageLocationDetail: String(request.usageLocationDetail || ''),
        neededDate: isValidDateString(request.neededDate) ? String(request.neededDate) : '',
        priority: ['low', 'normal', 'high', 'urgent'].includes(request.priority)
          ? request.priority
          : 'normal',
        status,
        adminNote: String(request.adminNote || ''),
        handledBy: String(request.handledBy || ''),
        handledAt: request.handledAt ? normalizeDateTime(request.handledAt) : '',
        createdAt,
        updatedAt: request.updatedAt ? normalizeDateTime(request.updatedAt) : createdAt,
      }
    })
    .sort(
      (firstRequest, secondRequest) =>
        new Date(secondRequest.createdAt) - new Date(firstRequest.createdAt),
    )
}

function normalizeInventoryRequestEnumArray(values, allowedValues) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value ?? '').trim())
        .filter((value) => allowedValues.includes(value)),
    ),
  )
}

function createFallbackInventoryRequestCode(createdAt, index) {
  const date = new Date(createdAt)
  const dateKey = Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10).replace(/-/g, '')
    : date.toISOString().slice(0, 10).replace(/-/g, '')

  return `DXK-${dateKey}-${String(index + 1).padStart(4, '0')}`
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
    .map((term, index) => {
      const totalAmount = normalizeNumber(term.totalAmount)
      const discountType = normalizeTuitionDiscountType(term.discountType, term.discountAmount)
      const discountValue = normalizeTuitionDiscountValue(
        discountType,
        term.discountValue,
        term.discountAmount,
      )

      return {
        ...term,
        id: String(term.id || `term-history-${String(index + 1).padStart(3, '0')}`),
        termNumber: Math.max(1, normalizeNumber(term.termNumber) || index + 1),
        packageName: String(term.packageName || 'GĂ³i há»c'),
        totalSessions: normalizeNumber(term.totalSessions),
        usedSessions: normalizeNumber(term.usedSessions),
        totalAmount,
        discountType,
        discountValue,
        discountAmount: calculateNormalizedTuitionDiscount(
          totalAmount,
          discountType,
          discountValue,
        ),
        paidAmount: normalizeNumber(term.paidAmount),
        dueDate: term.dueDate ? String(term.dueDate) : '',
        note: String(term.note || ''),
        status: ['completed', 'archived'].includes(term.status) ? term.status : 'archived',
        startedAt: term.startedAt ? normalizeDateTime(term.startedAt) : '',
        endedAt: term.endedAt ? normalizeDateTime(term.endedAt) : '',
        payments: normalizeTuitionPayments(term.payments),
      }
    })
}

function normalizeTuitionDiscountType(discountType, discountAmount = 0) {
  if (discountType === 'percent') {
    return 'percent'
  }

  if (discountType === 'amount' || discountType === 'fixed') {
    return 'amount'
  }

  return normalizeNumber(discountAmount) > 0 ? 'amount' : 'none'
}

function normalizeTuitionDiscountValue(discountType, discountValue, discountAmount = 0) {
  if (discountType === 'percent') {
    return Math.min(Math.max(0, normalizeNumber(discountValue)), 100)
  }

  if (discountType === 'amount') {
    return Math.max(0, normalizeNumber(discountValue ?? discountAmount))
  }

  return normalizeNumber(discountAmount) > 0 ? normalizeNumber(discountAmount) : 0
}

function calculateNormalizedTuitionDiscount(totalAmount, discountType, discountValue) {
  const calculatedAmount =
    discountType === 'percent'
      ? Math.round((totalAmount * discountValue) / 100)
      : discountType === 'amount'
        ? discountValue
        : 0

  return Math.min(Math.max(calculatedAmount, 0), totalAmount)
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
    ? Array.from(new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean)))
    : []
}

function normalizeDateTime(value) {
  const dateValue = new Date(value)
  return Number.isNaN(dateValue.getTime()) ? new Date().toISOString() : dateValue.toISOString()
}
