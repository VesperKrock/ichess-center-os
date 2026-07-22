import {
  scheduleDays,
  scheduleLevels,
  scheduleOccurrenceReasons,
  scheduleStatuses,
  scheduleTypes,
} from './schedule-data.js'
import { buildScheduleDeadlineAlerts } from './schedule-deadline.js'
import {
  CENTER_CALENDAR_ITEM_TYPES,
  CENTER_CALENDAR_ITEM_TYPE_LABELS,
  CENTER_CALENDAR_COLOR_PRESETS,
  CENTER_CALENDAR_ITEM_TYPE_DEFAULT_COLOR_KEYS,
  CENTER_CALENDAR_TAG_LABEL_MAX_LENGTH,
  getCenterCalendarItemsForRange,
  getCenterCalendarPresetByColorKey,
  getCenterCalendarPresetForType,
  getCenterCalendarTagById,
  isRejectedClassCalendarItemType,
  normalizeCenterCalendarItem,
  normalizeCenterCalendarTag,
  normalizeCenterCalendarTagLabel,
  normalizeCenterCalendarTags,
} from './center-calendar-data.js'
import {
  CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES,
  CENTER_CALENDAR_WEEKDAY_KEYS,
  CENTER_CALENDAR_RECURRENCE_TIMEZONE,
  createCenterCalendarRecurrenceRuleFromFormValues,
  expandWeeklyCenterCalendarOccurrences,
  formatCenterCalendarRecurrenceSummary,
  getCenterCalendarRecurrenceFormValues,
  getCenterCalendarSeriesRange,
  getCenterCalendarWeekdayKeyFromDate,
  getCenterCalendarWeekdayOptions,
  isWeeklyRecurringCenterCalendarItem,
  validateCenterCalendarRecurrenceRule,
} from './center-calendar-recurrence.js'

const DAY_INDEX_BY_ID = new Map(scheduleDays.map((day, index) => [day.id, index]))
const scheduleCreateOccurrenceReasons = scheduleOccurrenceReasons
  .filter((reason) => reason.id !== 'event')
  .map((reason) =>
    reason.id === 'other'
      ? { ...reason, label: 'Buổi học khác', shortLabel: 'Buổi học khác' }
      : reason,
  )
const centerCalendarColorPaletteKeys = [
  'blue',
  'green',
  'yellow',
  'orange',
  'red',
  'purple',
  'pink',
  'gray',
  'emerald',
]
const centerCalendarAllFilterValue = 'all'
const centerCalendarNoTagFilterValue = '__none__'

export const attendanceStatuses = [
  ['present', 'Có mặt'],
  ['absent', 'Vắng'],
  ['excused', 'Có phép'],
  ['makeup', 'Học bù'],
  ['trial', 'Học thử'],
]

const LEGACY_ATTENDANCE_STATUS_ALIASES = {
  excusedAbsent: 'excused',
  unexcusedAbsent: 'absent',
}
const VALID_ATTENDANCE_STATUS_IDS = [
  ...attendanceStatuses.map(([status]) => status),
  ...Object.keys(LEGACY_ATTENDANCE_STATUS_ALIASES),
]
const guestParticipationTypes = [
  ['trial', 'Học thử'],
  ['makeup', 'Học bù'],
]
const VALID_GUEST_PARTICIPATION_TYPE_IDS = guestParticipationTypes.map(([type]) => type)
const adminAttendanceStatuses = [
  ['present', 'Có mặt'],
  ['absent', 'Vắng'],
  ['excused', 'Có phép'],
  ['makeup', 'Học bù'],
  ['trial', 'Học thử'],
]

export const emptyScheduleFormValues = {
  scheduleType: 'oneOff',
  title: '',
  dayOfWeek: 'monday',
  classSessionId: '',
  startDate: '',
  endDate: '',
  date: '',
  occurrenceReason: '',
  startTime: '',
  endTime: '',
  room: '',
  teacherId: '',
  teacherName: '',
  studentIds: [],
  groupName: '',
  level: 'beginner',
  status: 'scheduled',
  note: '',
}

export function createEmptyScheduleFormState() {
  return {
    mode: 'create',
    sessionId: null,
    values: { ...emptyScheduleFormValues },
    errors: {},
  }
}

export function createScheduleFormStateForDay(dayOfWeek, date) {
  const validDay = scheduleDays.some((day) => day.id === dayOfWeek)
    ? dayOfWeek
    : getDayOfWeekFromDate(date) || 'monday'
  const validDate = normalizeDateString(date)

  return {
    ...createEmptyScheduleFormState(),
    values: {
      ...emptyScheduleFormValues,
      scheduleType: 'oneOff',
      dayOfWeek: validDay,
      date: validDate,
      occurrenceReason: '',
    },
  }
}

export function createEditScheduleFormState(session) {
  const scheduleType = normalizeScheduleType(session.scheduleType)

  return {
    mode: 'edit',
    sessionId: session.id,
    values: {
      scheduleType,
      title: session.title ?? '',
      dayOfWeek: session.dayOfWeek ?? 'monday',
      classSessionId: session.classSessionId ?? '',
      startDate: session.startDate ?? '',
      endDate: session.endDate ?? '',
      date: session.date ?? '',
      occurrenceReason: session.occurrenceReason ?? '',
      startTime: session.startTime ?? '',
      endTime: session.endTime ?? '',
      room: session.room ?? '',
      teacherId: session.teacherId ?? '',
      teacherName: session.teacherName ?? '',
      studentIds: Array.isArray(session.studentIds) ? [...session.studentIds] : [],
      groupName: session.groupName ?? '',
      level: session.level ?? 'beginner',
      status: session.status ?? 'scheduled',
      note: session.note ?? '',
      allowOpenRange:
        scheduleType === 'recurring' && !session.startDate && !session.endDate ? 'true' : '',
    },
    errors: {},
  }
}

export function renderScheduleModule(
  sessions = [],
  formState = null,
  reportState = null,
  sessionReports = [],
  reportAttendanceState = null,
  reportLearningState = null,
  learningGroupFormState = null,
  reportExtraState = null,
  isReportExtraExpanded = false,
  guestParticipantFormState = null,
  teachers = [],
  students = [],
  weekStartDate = getCurrentScheduleWeekStartDate(),
  adminAttendanceState = null,
  deadlineOptions = {},
) {
  const normalizedWeekStart = normalizeDateString(weekStartDate) || getCurrentScheduleWeekStartDate()
  const weekDays = getScheduleWeekDays(normalizedWeekStart)
  const classSessions = Array.isArray(deadlineOptions.classSessions) ? deadlineOptions.classSessions : []
  const centerCalendarItemState = deadlineOptions.centerCalendarItemState || null
  const centerCalendarTagState = deadlineOptions.centerCalendarTagState || null
  const centerCalendarTags = normalizeCenterCalendarTags(deadlineOptions.centerCalendarTags)
  const centerCalendarFilters = normalizeCenterCalendarFilters(deadlineOptions.centerCalendarFilters)
  const visibleSessions = getVisibleScheduleSessions(sessions, normalizedWeekStart, classSessions)
  const weekRangeStartAt = `${normalizedWeekStart}T00:00:00.000Z`
  const weekRangeEndAt = `${addDays(normalizedWeekStart, 7)}T00:00:00.000Z`
  const weekCenterCalendarItems = getCenterCalendarItemsForDisplayRange(
    deadlineOptions.centerCalendarItems,
    weekRangeStartAt,
    weekRangeEndAt,
  )
  const visibleCenterCalendarItems = filterCenterCalendarItems(weekCenterCalendarItems, centerCalendarFilters)
  const teacherLookup = createLookup(teachers)
  const studentLookup = createLookup(students)
  const conflictMap = getScheduleConflicts(visibleSessions, students)
  const stats = getScheduleStats(visibleSessions, conflictMap)
  const scheduleDeadlineAlerts = buildScheduleDeadlineAlerts({
    sessions: visibleSessions,
    attendanceRecords: deadlineOptions.attendanceRecords,
    sessionReports,
    teachers,
    now: deadlineOptions.now,
  })

  return `
    <section class="schedule-module ${formState || reportState || centerCalendarItemState || centerCalendarTagState ? 'form-open' : ''}" aria-label="Thời khóa biểu">
      <div class="schedule-compact-header">
        <div class="schedule-stats" aria-label="Tổng quan lịch tuần">
        ${renderStatCard('Buổi trong tuần', stats.totalSessions)}
        ${renderStatCard('Lịch cố định', stats.recurringSessions)}
        ${renderStatCard('Buổi đột xuất', stats.oneOffSessions)}
        ${renderStatCard('Cảnh báo trùng lịch', stats.conflictSessions)}
        ${renderScheduleAlertBellClean(scheduleDeadlineAlerts)}
        </div>

        <div class="schedule-toolbar" aria-label="Điều hướng tuần">
          <button class="schedule-add-button" type="button" data-schedule-action="open-create">+ Thêm buổi học</button>
          <button class="schedule-calendar-add-button" type="button" data-center-calendar-action="open-create">+ Thêm hoạt động</button>
          <button class="schedule-calendar-tag-manager-button" type="button" data-center-calendar-tag-action="open-manager">Quản lý nhãn</button>
          <div class="schedule-week-controls">
          <button type="button" data-schedule-week-action="previous">&lt; Tuần trước</button>
          <button type="button" data-schedule-week-action="today">Tuần này</button>
          <button type="button" data-schedule-week-action="next">Tuần sau &gt;</button>
          </div>
          <strong class="schedule-week-label">${escapeHtml(formatWeekRange(normalizedWeekStart))}</strong>
        </div>
      </div>
      ${renderCenterCalendarFilterBar(centerCalendarFilters, centerCalendarTags, weekCenterCalendarItems)}
      ${renderCenterCalendarLegend(centerCalendarTags, weekCenterCalendarItems)}
      ${
        weekCenterCalendarItems.length && !visibleCenterCalendarItems.length
          ? '<p class="schedule-calendar-filter-empty">Không có hoạt động phù hợp bộ lọc</p>'
          : ''
      }
      <div class="schedule-week-scroll">
        <div class="schedule-week-grid">
          ${weekDays
            .map((day) =>
              renderDayColumn(
                day,
                getSessionsByOccurrenceDate(visibleSessions, day.date),
                teacherLookup,
                studentLookup,
                conflictMap,
                getCenterCalendarItemsByDate(visibleCenterCalendarItems, day.date),
                centerCalendarTags,
              ),
            )
            .join('')}
        </div>
      </div>
      ${formState ? renderScheduleForm(formState, teachers, students, sessions, normalizedWeekStart, classSessions) : ''}
      ${centerCalendarItemState ? renderCenterCalendarItemState(centerCalendarItemState, centerCalendarTags) : ''}
      ${centerCalendarTagState ? renderCenterCalendarTagManager(centerCalendarTagState, centerCalendarTags, deadlineOptions.centerCalendarItems || []) : ''}
      ${
        reportState
          ? renderScheduleReportPanel(
              reportState,
              sessions,
              teachers,
              students,
              normalizedWeekStart,
              sessionReports,
              reportAttendanceState,
              reportLearningState,
              learningGroupFormState,
              reportExtraState,
              isReportExtraExpanded,
              guestParticipantFormState,
              adminAttendanceState,
            )
          : ''
      }
    </section>
  `
}

export function validateScheduleForm(values, classSessions = []) {
  const errors = {}
  const scheduleType = normalizeScheduleType(values.scheduleType)
  const selectedClassSession =
    scheduleType === 'recurring' ? findScheduleClassSession(classSessions, values.classSessionId) : null
  const recurringValues =
    scheduleType === 'recurring'
      ? applyClassSessionToScheduleValues(values, selectedClassSession)
      : values

  if (scheduleType === 'oneOff' && !String(recurringValues.title ?? '').trim()) {
    errors.title = 'Tên buổi/lớp là bắt buộc.'
  }

  if (!scheduleTypes.includes(scheduleType)) {
    errors.scheduleType = 'Loại lịch không hợp lệ.'
  }

  if (scheduleType === 'recurring') {
    if (!normalizeOptionalId(values.classSessionId)) {
      errors.classSessionId = 'Chọn ca học/lớp từ Cài đặt cơ sở.'
    } else if (!selectedClassSession) {
      errors.classSessionId = 'Ca học/lớp đã chọn không còn trong Cài đặt cơ sở.'
    }

    if (selectedClassSession && selectedClassSession.status === 'inactive') {
      errors.classSessionId = 'Ca học/lớp đã ngưng dùng.'
    }

    if (!scheduleDays.some((day) => day.id === recurringValues.dayOfWeek)) {
      errors.dayOfWeek = 'Ngày trong tuần không hợp lệ.'
    }

    if (!values.allowOpenRange) {
      if (!isValidDate(values.startDate)) {
        errors.startDate = 'Ngày bắt đầu là bắt buộc.'
      }

      if (!isValidDate(values.endDate)) {
        errors.endDate = 'Ngày kết thúc là bắt buộc.'
      }
    } else {
      if (values.startDate && !isValidDate(values.startDate)) {
        errors.startDate = 'Ngày bắt đầu không hợp lệ.'
      }

      if (values.endDate && !isValidDate(values.endDate)) {
        errors.endDate = 'Ngày kết thúc không hợp lệ.'
      }
    }

    if (isValidDate(values.startDate) && isValidDate(values.endDate) && values.endDate < values.startDate) {
      errors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu.'
    }
  }

  if (scheduleType === 'oneOff') {
    if (!isValidDate(values.date)) {
      errors.date = 'Ngày cụ thể là bắt buộc.'
    }

    if (
      values.occurrenceReason &&
      !scheduleOccurrenceReasons.some((reason) => reason.id === values.occurrenceReason)
    ) {
      errors.occurrenceReason = 'Lý do đột xuất không hợp lệ.'
    }
  }

  if (!isValidTime(recurringValues.startTime)) {
    errors.startTime = 'Giờ bắt đầu cần đúng định dạng HH:mm.'
  }

  if (!isValidTime(recurringValues.endTime)) {
    errors.endTime = 'Giờ kết thúc cần đúng định dạng HH:mm.'
  }

  if (
    isValidTime(recurringValues.startTime) &&
    isValidTime(recurringValues.endTime) &&
    recurringValues.endTime <= recurringValues.startTime
  ) {
    errors.endTime = 'Giờ kết thúc phải lớn hơn giờ bắt đầu.'
  }

  if (!String(values.room ?? '').trim()) {
    errors.room = 'Phòng là bắt buộc.'
  }

  if (!Array.isArray(values.studentIds)) {
    errors.studentIds = 'Danh sách học viên cần là một mảng.'
  }

  return errors
}

export function buildScheduleSessionFromForm(
  values,
  existingSession = null,
  teachers = [],
  classSessions = [],
) {
  const now = new Date().toISOString()
  const scheduleType = normalizeScheduleType(values.scheduleType)
  const selectedClassSession =
    scheduleType === 'recurring' ? findScheduleClassSession(classSessions, values.classSessionId) : null
  const normalizedValues =
    scheduleType === 'recurring'
      ? applyClassSessionToScheduleValues(values, selectedClassSession)
      : values
  const teacherId = normalizeOptionalId(values.teacherId)
  const teacher = teacherId ? teachers.find((item) => String(item.id) === teacherId) : null
  const teacherName = teacher
    ? getTeacherDisplayName(teacher)
    : String(values.teacherName ?? '').trim()
  const date = scheduleType === 'oneOff' ? String(normalizedValues.date ?? '').trim() : null
  const dayOfWeek = scheduleType === 'oneOff'
    ? getDayOfWeekFromDate(date) || normalizedValues.dayOfWeek || 'monday'
    : normalizedValues.dayOfWeek

  const title = repairScheduleDisplayText(String(normalizedValues.title ?? '').trim())
  const groupName = repairScheduleDisplayText(String(normalizedValues.groupName ?? '').trim())

  return {
    id: existingSession?.id ?? `schedule-${Date.now()}`,
    scheduleType,
    title,
    dayOfWeek,
    classSessionId: scheduleType === 'recurring' ? normalizeOptionalId(normalizedValues.classSessionId) : '',
    startDate: scheduleType === 'recurring' ? normalizeNullableDate(normalizedValues.startDate) : null,
    endDate: scheduleType === 'recurring' ? normalizeNullableDate(normalizedValues.endDate) : null,
    date,
    occurrenceReason:
      scheduleType === 'oneOff'
        ? normalizeOccurrenceReason(normalizedValues.occurrenceReason)
        : '',
    startTime: String(normalizedValues.startTime ?? '').trim(),
    endTime: String(normalizedValues.endTime ?? '').trim(),
    room: String(normalizedValues.room ?? '').trim(),
    teacherId,
    teacherName,
    studentIds: normalizeIdArray(normalizedValues.studentIds),
    groupName,
    level: scheduleLevels.includes(normalizedValues.level) ? normalizedValues.level : 'mixed',
    status: scheduleStatuses.includes(normalizedValues.status) ? normalizedValues.status : 'scheduled',
    note: String(normalizedValues.note ?? '').trim(),
    createdAt: existingSession?.createdAt ?? now,
    updatedAt: now,
  }
}

export function getSessionReportIdentity(sessionId, occurrenceDate) {
  return {
    sessionId: String(sessionId ?? '').trim(),
    occurrenceDate: normalizeDateString(occurrenceDate),
  }
}

export function findSessionReport(sessionReports = [], sessionId, occurrenceDate) {
  const identity = getSessionReportIdentity(sessionId, occurrenceDate)
  return sessionReports.find(
    (report) =>
      String(report.sessionId) === identity.sessionId &&
      String(report.occurrenceDate) === identity.occurrenceDate,
  ) ?? null
}

export function createSessionReportDraft(session, existingReport = null, options = {}) {
  const identity = getSessionReportIdentity(session?.id, session?.occurrenceDate)
  const sessionStudentIds = normalizeIdArray(session?.studentIds)
  const adminAttendance = normalizeTeacherLockAttendance(options.adminAttendanceRecords, sessionStudentIds)
  const teacherAttendance = normalizeTeacherCanonicalAttendance(options.teacherAttendanceRecords, sessionStudentIds)
  const existingAttendance = new Map(
    (adminAttendance.length
      ? adminAttendance
      : teacherAttendance.length
        ? teacherAttendance
        : normalizeReportAttendance(existingReport?.attendance))
      .map((item) => [item.studentId, item]),
  )

  return {
    sessionId: identity.sessionId,
    occurrenceDate: identity.occurrenceDate,
    attendance: sessionStudentIds.map((studentId) => ({
      studentId,
      attendanceStatus: existingAttendance.get(studentId)?.attendanceStatus ?? 'present',
      note: existingAttendance.get(studentId)?.note ?? '',
    })),
    guestParticipants: normalizeReportGuestParticipants(existingReport?.guestParticipants),
    attendanceLockedByAdmin: adminAttendance.length > 0,
    adminAttendanceCount: adminAttendance.length,
    saveState: options.saveState ?? '',
    error: options.error ?? '',
  }
}

export function createEmptyGuestParticipantFormState() {
  return {
    values: {
      displayName: '',
      participationType: 'trial',
      note: '',
    },
    errors: {},
  }
}

export function validateGuestParticipantForm(values) {
  const errors = {}

  if (!String(values?.displayName ?? '').trim()) {
    errors.displayName = 'Tên học viên tạm là bắt buộc.'
  }

  if (!VALID_GUEST_PARTICIPATION_TYPE_IDS.includes(values?.participationType)) {
    errors.participationType = 'Loại học viên tạm không hợp lệ.'
  }

  return errors
}

export function buildGuestParticipantFromForm(values) {
  const participationType = VALID_GUEST_PARTICIPATION_TYPE_IDS.includes(values?.participationType)
    ? values.participationType
    : 'trial'

  return {
    id: `guest-${Date.now()}`,
    displayName: String(values?.displayName ?? '').trim(),
    participationType,
    attendanceStatus: participationType,
    note: String(values?.note ?? '').trim(),
  }
}

export function createSessionReportLearningState(session, existingReport = null, options = {}) {
  const identity = getSessionReportIdentity(session?.id, session?.occurrenceDate)
  const allowedStudentIds = normalizeIdArray(session?.studentIds)

  return {
    sessionId: identity.sessionId,
    occurrenceDate: identity.occurrenceDate,
    groups: normalizeReportLearningGroups(existingReport?.learningGroups, allowedStudentIds),
    saveState: options.saveState ?? '',
    error: options.error ?? '',
  }
}

export function createSessionReportExtraState(session, existingReport = null, options = {}) {
  const identity = getSessionReportIdentity(session?.id, session?.occurrenceDate)

  return {
    sessionId: identity.sessionId,
    occurrenceDate: identity.occurrenceDate,
    values: {
      teachingAssistantNotes: existingReport?.teachingAssistantNotes ?? '',
      classSituation: existingReport?.classSituation ?? '',
      suggestions: existingReport?.suggestions ?? '',
    },
    saveState: options.saveState ?? '',
    copyState: options.copyState ?? '',
    error: options.error ?? '',
  }
}

export function updateSessionReportExtraState(extraState, fieldName, value) {
  if (!extraState) {
    return extraState
  }

  return {
    ...extraState,
    values: {
      ...extraState.values,
      [fieldName]: String(value ?? ''),
    },
    saveState: '',
    copyState: '',
    error: '',
  }
}

export function createEmptyLearningGroupFormState() {
  return {
    mode: 'create',
    groupId: null,
    values: {
      title: '',
      studentIds: [],
      contentText: '',
      note: '',
    },
    errors: {},
  }
}

export function createEditLearningGroupFormState(group) {
  return {
    mode: 'edit',
    groupId: group?.id ?? null,
    values: {
      title: group?.title ?? '',
      studentIds: normalizeIdArray(group?.studentIds),
      contentText: normalizeContentLines(group?.contentLines).join('\n'),
      note: group?.note ?? '',
    },
    errors: {},
  }
}

export function validateLearningGroupForm(values) {
  const errors = {}
  const studentIds = normalizeIdArray(values?.studentIds)
  const contentLines = splitContentLines(values?.contentText)

  if (!studentIds.length && !contentLines.length) {
    errors.form = 'Chọn ít nhất 1 học viên hoặc nhập ít nhất 1 dòng nội dung học.'
  }

  return errors
}

export function buildLearningGroupFromForm(values, existingGroup = null, allowedStudentIds = []) {
  const allowedStudentSet = new Set(normalizeIdArray(allowedStudentIds))
  const studentIds = normalizeIdArray(values?.studentIds)
    .filter((studentId) => allowedStudentSet.has(studentId))

  return {
    id: existingGroup?.id ?? `learning-group-${Date.now()}`,
    title: String(values?.title ?? '').trim(),
    studentIds,
    contentLines: splitContentLines(values?.contentText),
    note: String(values?.note ?? '').trim(),
  }
}

export function buildSessionReportFromLearningGroups(learningState, existingReport = null) {
  const identity = getSessionReportIdentity(learningState?.sessionId, learningState?.occurrenceDate)
  const now = new Date().toISOString()

  return {
    id: existingReport?.id ?? createSessionReportId(identity.sessionId, identity.occurrenceDate),
    sessionId: identity.sessionId,
    occurrenceDate: identity.occurrenceDate,
    attendance: normalizeReportAttendance(existingReport?.attendance),
    learningGroups: normalizeReportLearningGroups(learningState?.groups),
    guestParticipants: normalizeReportGuestParticipants(existingReport?.guestParticipants),
    teachingAssistantNotes: existingReport?.teachingAssistantNotes ?? '',
    classSituation: existingReport?.classSituation ?? '',
    suggestions: existingReport?.suggestions ?? '',
    createdAt: existingReport?.createdAt ?? now,
    updatedAt: now,
  }
}

export function buildSessionReportFromExtraInfo(extraState, existingReport = null) {
  const identity = getSessionReportIdentity(extraState?.sessionId, extraState?.occurrenceDate)
  const now = new Date().toISOString()

  return {
    id: existingReport?.id ?? createSessionReportId(identity.sessionId, identity.occurrenceDate),
    sessionId: identity.sessionId,
    occurrenceDate: identity.occurrenceDate,
    attendance: normalizeReportAttendance(existingReport?.attendance),
    learningGroups: normalizeReportLearningGroups(existingReport?.learningGroups),
    guestParticipants: normalizeReportGuestParticipants(existingReport?.guestParticipants),
    teachingAssistantNotes: String(extraState?.values?.teachingAssistantNotes ?? '').trim(),
    classSituation: String(extraState?.values?.classSituation ?? '').trim(),
    suggestions: String(extraState?.values?.suggestions ?? '').trim(),
    createdAt: existingReport?.createdAt ?? now,
    updatedAt: now,
  }
}

export function updateSessionReportDraftAttendance(draft, studentId, fieldName, value) {
  if (!draft) {
    return draft
  }

  const normalizedStudentId = String(studentId ?? '').trim()
  const attendance = normalizeReportAttendance(draft.attendance)
  const existingIndex = attendance.findIndex((item) => item.studentId === normalizedStudentId)
  const nextItem = {
    ...(existingIndex >= 0
      ? attendance[existingIndex]
      : { studentId: normalizedStudentId, attendanceStatus: 'present', note: '' }),
  }

  if (fieldName === 'attendanceStatus') {
    nextItem.attendanceStatus = VALID_ATTENDANCE_STATUS_IDS.includes(value) ? value : 'present'
  }

  if (fieldName === 'note') {
    nextItem.note = String(value ?? '')
  }

  if (!nextItem.studentId) {
    return draft
  }

  const nextAttendance =
    existingIndex >= 0
      ? attendance.map((item, index) => (index === existingIndex ? nextItem : item))
      : [...attendance, nextItem]

  return {
    ...draft,
    attendance: nextAttendance,
    saveState: '',
    error: '',
  }
}

export function validateSessionReportAttendance(attendance) {
  if (!Array.isArray(attendance)) {
    return 'Danh sách điểm danh không hợp lệ.'
  }

  const hasInvalidItem = attendance.some(
    (item) =>
      !item ||
      !String(item.studentId ?? '').trim() ||
      !VALID_ATTENDANCE_STATUS_IDS.includes(item.attendanceStatus) ||
      typeof item.note !== 'string',
  )

  return hasInvalidItem ? 'Dữ liệu điểm danh có dòng chưa hợp lệ.' : ''
}

export function buildSessionReportFromAttendance(draft, existingReport = null) {
  const identity = getSessionReportIdentity(draft?.sessionId, draft?.occurrenceDate)
  const now = new Date().toISOString()
  const draftAttendance = normalizeReportAttendance(draft?.attendance)
  const draftStudentIds = new Set(draftAttendance.map((item) => item.studentId))
  const hiddenExistingAttendance = normalizeReportAttendance(existingReport?.attendance)
    .filter((item) => !draftStudentIds.has(item.studentId))

  return {
    id: existingReport?.id ?? createSessionReportId(identity.sessionId, identity.occurrenceDate),
    sessionId: identity.sessionId,
    occurrenceDate: identity.occurrenceDate,
    attendance: [...draftAttendance, ...hiddenExistingAttendance],
    learningGroups: normalizeReportLearningGroups(existingReport?.learningGroups),
    guestParticipants: normalizeReportGuestParticipants(
      draft?.guestParticipants ?? existingReport?.guestParticipants,
    ),
    teachingAssistantNotes: existingReport?.teachingAssistantNotes ?? '',
    classSituation: existingReport?.classSituation ?? '',
    suggestions: existingReport?.suggestions ?? '',
    createdAt: existingReport?.createdAt ?? now,
    updatedAt: now,
  }
}

export function buildTrelloReportText({
  session = null,
  report = null,
  students = [],
  teacher = null,
} = {}) {
  const studentLookup = createLookup(students)
  const attendance = normalizeReportAttendance(report?.attendance)
  const guestParticipants = normalizeReportGuestParticipants(report?.guestParticipants)
  const sessionStudentIds = normalizeIdArray(session?.studentIds)
  const fallbackAttendance = sessionStudentIds.map((studentId) => ({
    studentId,
    attendanceStatus: 'present',
    note: '',
  }))
  const attendanceRows = [
    ...(attendance.length ? attendance : fallbackAttendance),
    ...guestParticipants.map((guest) => ({
      studentId: guest.id,
      displayName: guest.displayName,
      attendanceStatus: guest.attendanceStatus,
      note: guest.note,
      isGuest: true,
    })),
  ]
  const presentStatuses = new Set(['present', 'makeup', 'trial'])
  const absentStatuses = new Set(['absent', 'excused', 'excusedAbsent', 'unexcusedAbsent'])
  const presentRows = attendanceRows.filter((item) => presentStatuses.has(item.attendanceStatus))
  const absentRows = attendanceRows.filter((item) => absentStatuses.has(item.attendanceStatus))
  const presentNames = presentRows.map((item) => formatAttendanceStudentName(item, studentLookup))
  const absentNames = absentRows.map((item) => getStudentDisplayName(studentLookup.get(item.studentId)))
  const totalCount = attendanceRows.length
  const rosterText = presentNames.length ? presentNames.join(', ') : ''
  const absentText = absentNames.length ? ` Vắng: ${absentNames.join(', ')}` : ''
  const rosterSuffix = rosterText || absentText.trim()
    ? ` (${[rosterText, absentText.trim()].filter(Boolean).join('. ')})`
    : ''
  const reportDate = formatVietnameseReportDate(session?.occurrenceDate || report?.occurrenceDate)
  const learningContent = formatTrelloLearningContent(
    normalizeReportLearningGroups(report?.learningGroups),
    studentLookup,
  )
  const assistantNotes = normalizeMultilineReportText(report?.teachingAssistantNotes)
  const classSituation = normalizeMultilineReportText(report?.classSituation)
  const suggestions = normalizeMultilineReportText(report?.suggestions, false)
  const teacherLine = teacher ? `Giáo viên: ${getTeacherDisplayName(teacher)}` : ''
  const sessionTitle = getScheduleSessionTitleForDisplay(session, '')
  const sessionLine = sessionTitle ? `Buổi học: ${sessionTitle}` : ''
  const optionalHeader = [sessionLine, teacherLine].filter(Boolean).join('\n')

  return [
    reportDate,
    optionalHeader,
    `1.Sĩ số: ${presentRows.length}/${totalCount} học viên${rosterSuffix}`,
    '2.Nội dung buổi học:',
    learningContent,
    '3.Nội dung kiến tập/ trợ giảng:',
    assistantNotes,
    '4.Tình hình lớp học:',
    classSituation,
    suggestions.includes('\n')
      ? `5.Đề xuất:\n${suggestions}`
      : `5.Đề xuất: ${suggestions}`,
  ]
    .filter((section) => section !== '')
    .join('\n\n')
}

export function getVisibleScheduleSessions(
  sessions = [],
  weekStartDate = getCurrentScheduleWeekStartDate(),
  classSessions = [],
) {
  const normalizedWeekStart = normalizeDateString(weekStartDate) || getCurrentScheduleWeekStartDate()
  const weekDays = getScheduleWeekDays(normalizedWeekStart)
  const weekDateSet = new Set(weekDays.map((day) => day.date))
  const validClassSessionIds = getScheduleClassSessionIdSet(classSessions)
  const cleanedSessions = purgeZombieLopThayThinhScheduleSessions(sessions, classSessions).scheduleSessions
  const assignmentByClassSessionId = new Map(
    cleanedSessions
      .filter((session) => normalizeScheduleType(session?.scheduleType) === 'recurring')
      .filter((session) => normalizeOptionalId(session?.classSessionId) && !session?.isDeleted)
      .filter((session) => validClassSessionIds.has(normalizeOptionalId(session.classSessionId)))
      .map((session) => [normalizeOptionalId(session.classSessionId), session]),
  )
  const classSessionSlots = getVisibleScheduleClassSessions(classSessions)
    .flatMap((classSession) =>
      getScheduleDaysFromClassSession(classSession).map((dayOfWeek) => {
        const occurrenceDate = weekDays.find((day) => day.id === dayOfWeek)?.date

        if (!occurrenceDate) {
          return null
        }

        const assignment = assignmentByClassSessionId.get(normalizeOptionalId(classSession.id)) || null
        return buildClassSessionScheduleSlot(classSession, assignment, dayOfWeek, occurrenceDate)
      }),
    )
    .filter(Boolean)

  const scheduleRecords = cleanedSessions
    .flatMap((session) => {
      const scheduleType = normalizeScheduleType(session.scheduleType)

      if (scheduleType === 'oneOff') {
        const date = normalizeDateString(session.date)

        if (!date || !weekDateSet.has(date)) {
          return []
        }

        return [
          {
            ...session,
            scheduleType,
            dayOfWeek: getDayOfWeekFromDate(date) || session.dayOfWeek,
            occurrenceDate: date,
          },
        ]
      }

      const classSessionId = normalizeOptionalId(session.classSessionId)

      if (classSessionId && validClassSessionIds.has(classSessionId)) {
        return []
      }

      const day = scheduleDays.find((item) => item.id === session.dayOfWeek)

      if (!day) {
        return []
      }

      const occurrenceDate = weekDays.find((item) => item.id === day.id)?.date

      if (!occurrenceDate || !isRecurringSessionVisible(session, occurrenceDate)) {
        return []
      }

      return [
        {
          ...session,
          scheduleType: 'recurring',
          occurrenceDate,
          isOrphanScheduleRecord: isOrphanFixedScheduleRecord(session, classSessions),
          missingClassSessionId: classSessionId || '',
        },
      ]
    })
  return [...classSessionSlots, ...scheduleRecords]
    .sort(compareSessions)
}

export function isOrphanFixedScheduleRecord(session, classSessions = []) {
  if (normalizeScheduleType(session?.scheduleType) !== 'recurring') {
    return false
  }

  const classSessionId = normalizeOptionalId(session?.classSessionId)

  if (!classSessionId) {
    return true
  }

  return !getScheduleClassSessionIdSet(classSessions).has(classSessionId)
}

export function purgeZombieLopThayThinhScheduleSessions(sessions = [], classSessions = []) {
  const sourceSessions = Array.isArray(sessions) ? sessions : []
  const scheduleSessions = sourceSessions.filter(
    (session) => !isZombieLopThayThinhScheduleRecord(session, classSessions),
  )

  return {
    scheduleSessions,
    removedCount: sourceSessions.length - scheduleSessions.length,
  }
}

export function isZombieLopThayThinhScheduleRecord(session, classSessions = []) {
  if (!isOrphanFixedScheduleRecord(session, classSessions)) {
    return false
  }

  const titleText = normalizeSearchText([
    session?.title,
    session?.groupName,
    session?.name,
  ].filter(Boolean).join(' '))
  const teacherText = normalizeSearchText([
    session?.teacherName,
    session?.teacherDisplayName,
    session?.teacherFallbackName,
  ].filter(Boolean).join(' '))
  const roomText = normalizeRoomText(session?.room)
  const timeMatches = String(session?.startTime || '').trim() === '16:30' &&
    String(session?.endTime || '').trim() === '18:00'
  const titleMatches = titleText.includes('lop thay thinh') ||
    titleText.includes('thay thinh')
  const teacherMatches = teacherText.includes('thay thinh')
  const roomMatches = roomText === '01' || roomText === '1'

  return timeMatches && roomMatches && (titleMatches || teacherMatches)
}

export function getScheduleConflicts(visibleSessions = [], students = []) {
  const conflictMap = new Map()
  const studentLookup = createLookup(students)

  for (let firstIndex = 0; firstIndex < visibleSessions.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < visibleSessions.length; secondIndex += 1) {
      const firstSession = visibleSessions[firstIndex]
      const secondSession = visibleSessions[secondIndex]

      if (!hasComparableOverlap(firstSession, secondSession)) {
        continue
      }

      if (
        firstSession.teacherId &&
        secondSession.teacherId &&
        String(firstSession.teacherId) === String(secondSession.teacherId)
      ) {
        addScheduleConflict(
          conflictMap,
          firstSession,
          'teacher',
          `Trùng giáo viên với "${secondSession.title}" lúc ${formatSessionTime(secondSession)}.`,
        )
        addScheduleConflict(
          conflictMap,
          secondSession,
          'teacher',
          `Trùng giáo viên với "${firstSession.title}" lúc ${formatSessionTime(firstSession)}.`,
        )
      }

      if (
        normalizeRoomName(firstSession.room) &&
        normalizeRoomName(firstSession.room) === normalizeRoomName(secondSession.room)
      ) {
        addScheduleConflict(
          conflictMap,
          firstSession,
          'room',
          `Trùng phòng với "${secondSession.title}" lúc ${formatSessionTime(secondSession)}.`,
        )
        addScheduleConflict(
          conflictMap,
          secondSession,
          'room',
          `Trùng phòng với "${firstSession.title}" lúc ${formatSessionTime(firstSession)}.`,
        )
      }

      const sharedStudentIds = getSharedStudentIds(firstSession.studentIds, secondSession.studentIds)

      if (sharedStudentIds.length) {
        const studentNames = getConflictStudentNames(sharedStudentIds, studentLookup)
        addScheduleConflict(
          conflictMap,
          firstSession,
          'student',
          `Trùng học viên${studentNames ? ` (${studentNames})` : ''} với "${secondSession.title}".`,
        )
        addScheduleConflict(
          conflictMap,
          secondSession,
          'student',
          `Trùng học viên${studentNames ? ` (${studentNames})` : ''} với "${firstSession.title}".`,
        )
      }
    }
  }

  return conflictMap
}

export function isPastScheduleOccurrence(session, now = new Date()) {
  if (!session?.occurrenceDate || !isValidTime(session.endTime)) {
    return false
  }

  const occurrenceEnd = parseDateTime(session.occurrenceDate, session.endTime)

  if (!occurrenceEnd) {
    return false
  }

  return occurrenceEnd.getTime() < now.getTime()
}

export function getCurrentScheduleWeekStartDate(referenceDate = new Date()) {
  const date = parseLocalDate(toDateInputValue(referenceDate))
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset)
  return formatDateInputValue(date)
}

export function getPreviousScheduleWeekStartDate(weekStartDate) {
  return addDays(normalizeDateString(weekStartDate) || getCurrentScheduleWeekStartDate(), -7)
}

export function getNextScheduleWeekStartDate(weekStartDate) {
  return addDays(normalizeDateString(weekStartDate) || getCurrentScheduleWeekStartDate(), 7)
}

export function createCenterCalendarTagManagerState(overrides = {}) {
  return {
    mode: 'list',
    tagId: null,
    values: {
      label: '',
      colorKey: 'gray',
      defaultItemType: '',
      description: '',
    },
    errors: {},
    ...overrides,
  }
}

export function createEmptyCenterCalendarTagFormState() {
  return createCenterCalendarTagManagerState({ mode: 'create' })
}

export function createEditCenterCalendarTagFormState(tag) {
  return createCenterCalendarTagManagerState({
    mode: 'edit',
    tagId: tag?.id || null,
    values: {
      label: tag?.label || '',
      colorKey: getCenterCalendarPresetByColorKey(tag?.colorKey, tag?.defaultItemType || 'other').key,
      defaultItemType: tag?.defaultItemType || '',
      description: tag?.description || '',
    },
  })
}

export function validateCenterCalendarTagForm(values = {}, existingTags = [], currentTagId = '') {
  const errors = {}
  const label = normalizeCenterCalendarTagLabel(values.label)
  const labelKey = normalizeTagDuplicateKey(label)
  const colorKey = String(values.colorKey || '').trim()
  const defaultItemType = String(values.defaultItemType || '').trim()
  const normalizedTags = normalizeCenterCalendarTags(existingTags)

  if (!label) {
    errors.label = 'Tên nhãn là bắt buộc.'
  }

  if (String(values.label || '').trim().length > CENTER_CALENDAR_TAG_LABEL_MAX_LENGTH) {
    errors.label = `Tên nhãn tối đa ${CENTER_CALENDAR_TAG_LABEL_MAX_LENGTH} ký tự.`
  }

  if (!centerCalendarColorPaletteKeys.includes(colorKey)) {
    errors.colorKey = 'Màu nhãn không hợp lệ.'
  }

  if (defaultItemType && !CENTER_CALENDAR_ITEM_TYPES.includes(defaultItemType)) {
    errors.defaultItemType = 'Loại hoạt động mặc định không hợp lệ.'
  }

  if (labelKey) {
    const duplicate = normalizedTags.find(
      (tag) => tag.id !== currentTagId && normalizeTagDuplicateKey(tag.label) === labelKey,
    )

    if (duplicate?.isActive) {
      errors.label = 'Đã có nhãn đang dùng với tên này trong cơ sở.'
    } else if (duplicate) {
      errors.label = 'Đã có nhãn lưu trữ cùng tên. Hãy khôi phục nhãn đó thay vì tạo mới.'
    }
  }

  return errors
}

export function buildCenterCalendarTagFromForm(values = {}, existingTag = null, centerId = '') {
  const now = new Date().toISOString()

  return normalizeCenterCalendarTag(
    {
      ...(existingTag ?? {}),
      id: existingTag?.id || createCenterCalendarRuntimeTagId(values.label),
      centerId,
      label: normalizeCenterCalendarTagLabel(values.label),
      colorKey: centerCalendarColorPaletteKeys.includes(values.colorKey) ? values.colorKey : 'gray',
      customColor: '',
      defaultItemType: CENTER_CALENDAR_ITEM_TYPES.includes(values.defaultItemType) ? values.defaultItemType : '',
      description: String(values.description || '').trim().slice(0, 120),
      isActive: existingTag?.isActive === undefined ? true : existingTag.isActive,
      createdAt: existingTag?.createdAt || now,
      updatedAt: now,
    },
    { centerId },
  )
}

function normalizeCenterCalendarFilters(filters = {}) {
  const itemType = CENTER_CALENDAR_ITEM_TYPES.includes(filters.itemType) ? filters.itemType : centerCalendarAllFilterValue
  const tagId = String(filters.tagId || centerCalendarAllFilterValue).trim() || centerCalendarAllFilterValue

  return { itemType, tagId }
}

function filterCenterCalendarItems(items = [], filters = {}) {
  return items.filter((item) => {
    const typeMatches = filters.itemType === centerCalendarAllFilterValue || item.itemType === filters.itemType
    const tagMatches = filters.tagId === centerCalendarAllFilterValue ||
      (filters.tagId === centerCalendarNoTagFilterValue ? !item.tagId : item.tagId === filters.tagId)

    return typeMatches && tagMatches
  })
}

function renderCenterCalendarFilterBar(filters, tags = [], weekItems = []) {
  const activeTags = tags.filter((tag) => tag.isActive)
  const archivedWeekTagIds = new Set(
    weekItems
      .map((item) => item.tagId)
      .filter((tagId) => tagId && !activeTags.some((tag) => tag.id === tagId)),
  )
  const archivedWeekTags = tags.filter((tag) => archivedWeekTagIds.has(tag.id))
  const hasActiveFilter = filters.itemType !== centerCalendarAllFilterValue || filters.tagId !== centerCalendarAllFilterValue

  return `
    <div class="schedule-calendar-filters" aria-label="Lọc hoạt động">
      <label>
        <span>Loại hoạt động</span>
        <select data-center-calendar-filter="itemType">
          <option value="${centerCalendarAllFilterValue}" ${filters.itemType === centerCalendarAllFilterValue ? 'selected' : ''}>Tất cả loại</option>
          ${CENTER_CALENDAR_ITEM_TYPES.map((type) => `
            <option value="${escapeAttribute(type)}" ${filters.itemType === type ? 'selected' : ''}>${escapeHtml(CENTER_CALENDAR_ITEM_TYPE_LABELS[type])}</option>
          `).join('')}
        </select>
      </label>
      <label>
        <span>Nhãn</span>
        <select data-center-calendar-filter="tagId">
          <option value="${centerCalendarAllFilterValue}" ${filters.tagId === centerCalendarAllFilterValue ? 'selected' : ''}>Tất cả nhãn</option>
          <option value="${centerCalendarNoTagFilterValue}" ${filters.tagId === centerCalendarNoTagFilterValue ? 'selected' : ''}>Không gắn nhãn</option>
          ${activeTags.map((tag) => `
            <option value="${escapeAttribute(tag.id)}" ${filters.tagId === tag.id ? 'selected' : ''}>${escapeHtml(tag.label)}</option>
          `).join('')}
          ${archivedWeekTags.map((tag) => `
            <option value="${escapeAttribute(tag.id)}" ${filters.tagId === tag.id ? 'selected' : ''}>${escapeHtml(`${tag.label} (đã lưu trữ)`)}</option>
          `).join('')}
        </select>
      </label>
      ${hasActiveFilter ? '<button type="button" data-center-calendar-filter-action="clear">Xóa bộ lọc</button>' : ''}
    </div>
  `
}

function renderCenterCalendarLegend(tags = [], weekItems = []) {
  const tagCounts = getCenterCalendarTagUsageCounts(weekItems)
  const weekTags = tags.filter((tag) => tagCounts.has(tag.id))

  return `
    <div class="schedule-calendar-legend" aria-label="Chú giải thời khóa biểu">
      <div class="schedule-calendar-legend-group">
        <span>Loại hoạt động</span>
        ${CENTER_CALENDAR_ITEM_TYPES.map((type) => {
          const preset = getCenterCalendarPresetForType(type)
          return `<span class="schedule-calendar-legend-chip" style="--schedule-calendar-item-color: ${escapeAttribute(preset.color)};"><i></i>${escapeHtml(CENTER_CALENDAR_ITEM_TYPE_LABELS[type])}</span>`
        }).join('')}
      </div>
      <div class="schedule-calendar-legend-group">
        <span>Nhãn trong tuần</span>
        ${
          weekTags.length
            ? weekTags.map((tag) => renderCenterCalendarTagChip(tag, tagCounts.get(tag.id))).join('')
            : '<em>Chưa có nhãn</em>'
        }
      </div>
    </div>
  `
}

function renderCenterCalendarTagManager(state, tags = [], items = []) {
  const activeTags = tags.filter((tag) => tag.isActive)
  const archivedTags = tags.filter((tag) => !tag.isActive)
  const counts = getCenterCalendarTagUsageCounts(items)

  return `
    <div class="schedule-form-backdrop" aria-hidden="true"></div>
    <section class="schedule-form-panel schedule-calendar-tag-manager" data-center-calendar-tag-manager>
      <div class="schedule-form-header">
        <div>
          <h4>Quản lý nhãn hoạt động</h4>
          <span>Nhãn dùng để phân nhóm và lọc, không đổi màu thẻ hoạt động.</span>
        </div>
        <button type="button" data-center-calendar-tag-action="close" aria-label="Đóng">×</button>
      </div>
      <div class="schedule-calendar-tag-manager-body">
        ${state.errors?.form ? `<div class="schedule-form-error" role="alert"><p>${escapeHtml(state.errors.form)}</p></div>` : ''}
        ${
          state.mode === 'create' || state.mode === 'edit'
            ? renderCenterCalendarTagForm(state)
            : `
              <button class="schedule-calendar-tag-create-button" type="button" data-center-calendar-tag-action="create">+ Tạo nhãn</button>
              ${activeTags.length ? activeTags.map((tag) => renderCenterCalendarTagRow(tag, counts.get(tag.id) || 0, false)).join('') : '<div class="schedule-calendar-tag-empty">Chưa có nhãn hoạt động</div>'}
              <details class="schedule-calendar-tag-archived" ${archivedTags.length ? '' : 'open'}>
                <summary>Nhãn đã lưu trữ</summary>
                ${archivedTags.length ? archivedTags.map((tag) => renderCenterCalendarTagRow(tag, counts.get(tag.id) || 0, true)).join('') : '<div class="schedule-calendar-tag-empty">Chưa có nhãn đã lưu trữ</div>'}
              </details>
            `
        }
      </div>
    </section>
  `
}

function renderCenterCalendarTagForm(state) {
  const selectedColorKey = centerCalendarColorPaletteKeys.includes(state.values.colorKey) ? state.values.colorKey : 'gray'
  const isEdit = state.mode === 'edit'

  return `
    <form class="schedule-calendar-tag-form" data-center-calendar-tag-form>
      <label class="schedule-form-field span-full">
        <span>Tên nhãn *</span>
        <input type="text" maxlength="${CENTER_CALENDAR_TAG_LABEL_MAX_LENGTH}" placeholder="Ví dụ: Nội bộ, Ưu tiên, Phụ huynh" value="${escapeAttribute(state.values.label || '')}" data-center-calendar-tag-field="label" />
        ${state.errors.label ? `<small>${escapeHtml(state.errors.label)}</small>` : ''}
      </label>
      <fieldset class="schedule-form-field schedule-calendar-color-palette span-full" data-center-calendar-tag-palette>
        <legend>Màu nhãn</legend>
        <div class="schedule-calendar-color-options" role="group" aria-label="Chọn màu nhãn">
          ${centerCalendarColorPaletteKeys.map((colorKey) => {
            const preset = CENTER_CALENDAR_COLOR_PRESETS[colorKey] || CENTER_CALENDAR_COLOR_PRESETS.gray
            const isSelected = preset.key === selectedColorKey
            return `
              <button type="button" class="schedule-calendar-color-swatch ${isSelected ? 'is-selected' : ''}" data-center-calendar-tag-action="select-color" data-center-calendar-tag-color-key="${escapeAttribute(preset.key)}" aria-pressed="${isSelected ? 'true' : 'false'}" style="--schedule-calendar-item-color: ${escapeAttribute(preset.color)};">
                <span aria-hidden="true">${isSelected ? '✓' : ''}</span>
                <strong>${escapeHtml(preset.label)}</strong>
              </button>
            `
          }).join('')}
        </div>
        <input type="hidden" value="${escapeAttribute(selectedColorKey)}" data-center-calendar-tag-field="colorKey" />
        ${state.errors.colorKey ? `<small>${escapeHtml(state.errors.colorKey)}</small>` : ''}
      </fieldset>
      <label class="schedule-form-field">
        <span>Loại hoạt động mặc định</span>
        <select data-center-calendar-tag-field="defaultItemType">
          <option value="" ${state.values.defaultItemType ? '' : 'selected'}>Không giới hạn</option>
          ${CENTER_CALENDAR_ITEM_TYPES.map((type) => `
            <option value="${escapeAttribute(type)}" ${state.values.defaultItemType === type ? 'selected' : ''}>${escapeHtml(CENTER_CALENDAR_ITEM_TYPE_LABELS[type])}</option>
          `).join('')}
        </select>
        ${state.errors.defaultItemType ? `<small>${escapeHtml(state.errors.defaultItemType)}</small>` : ''}
      </label>
      <label class="schedule-form-field span-full">
        <span>Mô tả</span>
        <textarea data-center-calendar-tag-field="description">${escapeHtml(state.values.description || '')}</textarea>
      </label>
      ${renderFormErrors(state.errors)}
      <div class="schedule-form-actions">
        <button type="button" data-center-calendar-tag-action="list">Hủy</button>
        <button class="schedule-save-button" type="button" data-center-calendar-tag-action="save">${isEdit ? 'Lưu nhãn' : 'Tạo nhãn'}</button>
      </div>
    </form>
  `
}

function renderCenterCalendarTagRow(tag, count, isArchived) {
  const preset = getCenterCalendarPresetByColorKey(tag.colorKey, tag.defaultItemType || 'other')
  const defaultTypeLabel = tag.defaultItemType ? CENTER_CALENDAR_ITEM_TYPE_LABELS[tag.defaultItemType] : 'Không giới hạn'

  return `
    <article class="schedule-calendar-tag-row ${isArchived ? 'is-archived' : ''}">
      <span class="schedule-calendar-tag-swatch" style="--schedule-calendar-tag-color: ${escapeAttribute(preset.color)};"></span>
      <div>
        <strong>${escapeHtml(tag.label)}</strong>
        <small>${escapeHtml(defaultTypeLabel)} · ${count} hoạt động · ${isArchived ? 'Đã lưu trữ' : 'Đang dùng'}</small>
      </div>
      <div class="schedule-calendar-tag-row-actions">
        ${
          isArchived
            ? `<button type="button" data-center-calendar-tag-action="restore" data-center-calendar-tag-id="${escapeAttribute(tag.id)}">Khôi phục</button>`
            : `
              <button type="button" data-center-calendar-tag-action="edit" data-center-calendar-tag-id="${escapeAttribute(tag.id)}">Chỉnh sửa</button>
              <button type="button" data-center-calendar-tag-action="archive" data-center-calendar-tag-id="${escapeAttribute(tag.id)}">Lưu trữ</button>
            `
        }
      </div>
    </article>
  `
}

function renderCenterCalendarTagChip(tag, count = 0) {
  const preset = getCenterCalendarPresetByColorKey(tag.colorKey, tag.defaultItemType || 'other')
  return `<span class="schedule-calendar-tag-chip ${tag.isActive ? '' : 'is-archived'}" title="${escapeAttribute(tag.isActive ? tag.label : `${tag.label} - nhãn đã lưu trữ`)}" style="--schedule-calendar-tag-color: ${escapeAttribute(preset.color)};"><i></i>${escapeHtml(tag.label)}${count ? ` <b>${count}</b>` : ''}</span>`
}

function getCenterCalendarTagUsageCounts(items = []) {
  const counts = new Map()
  items.forEach((item) => {
    if (item?.tagId) {
      counts.set(item.tagId, (counts.get(item.tagId) || 0) + 1)
    }
  })
  return counts
}

function normalizeTagDuplicateKey(value) {
  return String(value || '').trim().toLocaleLowerCase('vi-VN')
}

function createCenterCalendarRuntimeTagId(label) {
  const asciiSlug = String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const suffix = Math.random().toString(36).slice(2, 8)

  return `center-calendar-tag-${asciiSlug || 'tag'}-${Date.now()}-${suffix}`
}

function renderDayColumn(day, sessions, teacherLookup, studentLookup, conflictMap, centerCalendarItems = [], centerCalendarTags = []) {
  const calendarCountLabel = centerCalendarItems.length
    ? ` · ${centerCalendarItems.length} hoạt động`
    : ''

  return `
    <section class="schedule-day-column" aria-label="${escapeAttribute(`${day.label} ${formatDisplayDate(day.date)}`)}">
      <header class="schedule-day-header">
        <strong>${escapeHtml(day.label)}</strong>
        <span>${escapeHtml(formatDisplayDate(day.date))} · ${sessions.length} buổi${calendarCountLabel}</span>
      </header>
      <div class="schedule-day-sessions">
        ${
          sessions.length || centerCalendarItems.length
            ? [
                ...sessions.map((session) => renderSessionCard(session, teacherLookup, studentLookup, conflictMap)),
                ...centerCalendarItems.map((item) => renderCenterCalendarItemCard(item, centerCalendarTags)),
              ].join('')
            : '<div class="schedule-empty-day">Chưa có lịch</div>'
        }
      </div>
      <button
        class="schedule-day-add-button"
        type="button"
        data-schedule-action="open-create-for-day"
        data-schedule-day-of-week="${escapeAttribute(day.id)}"
        data-schedule-date="${escapeAttribute(day.date)}"
      >
        + Thêm thẻ
      </button>
    </section>
  `
}

export function createEmptyCenterCalendarItemFormState(date = getCurrentScheduleWeekStartDate()) {
  return {
    mode: 'create',
    itemId: null,
    values: {
      itemType: 'meeting',
      title: '',
      date: normalizeDateString(date) || getCurrentScheduleWeekStartDate(),
      startTime: '09:00',
      endTime: '10:00',
      allDay: false,
      location: '',
      description: '',
      colorKey: getDefaultCenterCalendarColorKey('meeting'),
      colorOverridden: false,
      tagId: '',
      ...getCenterCalendarRecurrenceFormValues(null, normalizeDateString(date) || getCurrentScheduleWeekStartDate()),
    },
    errors: {},
  }
}

export function createCenterCalendarItemDetailState(item) {
  return {
    mode: 'detail',
    itemId: item?.id || null,
    item,
    errors: {},
  }
}

export function createCenterCalendarOccurrenceDetailState(occurrence, masterItem = null) {
  return {
    mode: 'occurrenceDetail',
    itemId: occurrence?.id || null,
    masterId: masterItem?.id || occurrence?.masterId || null,
    item: {
      ...(occurrence ?? {}),
      masterItem: masterItem || occurrence?.masterItem || null,
      isVirtualOccurrence: true,
    },
    errors: {},
  }
}

export function createCenterCalendarItemDeleteState(item) {
  return {
    mode: 'delete',
    itemId: item?.id || null,
    item,
    errors: {},
  }
}

export function createCenterCalendarItemConflictState({
  previousState,
  conflictResult,
  pendingItem,
} = {}) {
  return {
    mode: 'conflict',
    previousMode: previousState?.mode || 'create',
    itemId: previousState?.itemId || pendingItem?.id || null,
    values: {
      ...(previousState?.values ?? {}),
    },
    errors: {},
    conflictResult: conflictResult || { conflicts: [], hard: [], soft: [], informational: [] },
    pendingItem: pendingItem || null,
  }
}

export function createEditCenterCalendarItemFormState(item) {
  return {
    mode: 'edit',
    itemId: item?.id || null,
    values: {
      itemType: item?.itemType || 'meeting',
      title: item?.title || '',
      date: getDateFromIsoDateTime(item?.startAt) || getCurrentScheduleWeekStartDate(),
      startTime: formatTimeFromIsoDateTime(item?.startAt) || '09:00',
      endTime: formatTimeFromIsoDateTime(item?.endAt) || '10:00',
      allDay: Boolean(item?.allDay),
      location: item?.location || '',
      description: item?.description || '',
      colorKey: getCenterCalendarPresetByColorKey(item?.colorKey, item?.itemType).key,
      colorOverridden: getCenterCalendarPresetByColorKey(item?.colorKey, item?.itemType).key !== getDefaultCenterCalendarColorKey(item?.itemType),
      tagId: item?.tagId || '',
      ...getCenterCalendarRecurrenceFormValues(item?.recurrenceRule, getDateFromIsoDateTime(item?.startAt)),
    },
    errors: {},
  }
}

export function validateCenterCalendarItemForm(values = {}) {
  const errors = {}
  const itemType = String(values.itemType || '').trim()
  const title = String(values.title || '').trim()
  const allDay = Boolean(values.allDay)

  if (!CENTER_CALENDAR_ITEM_TYPES.includes(itemType) || isRejectedClassCalendarItemType(itemType)) {
    errors.itemType = 'Loại hoạt động không hợp lệ.'
  }

  if (!title) {
    errors.title = 'Tiêu đề là bắt buộc.'
  }

  if (!isValidDate(values.date)) {
    errors.date = 'Ngày là bắt buộc.'
  }

  if (!allDay) {
    if (!isValidTime(values.startTime)) {
      errors.startTime = 'Giờ bắt đầu là bắt buộc.'
    }

    if (!isValidTime(values.endTime)) {
      errors.endTime = 'Giờ kết thúc là bắt buộc.'
    }

    if (isValidTime(values.startTime) && isValidTime(values.endTime)) {
      const start = parseDateTime(values.date, values.startTime)
      const end = parseDateTime(values.date, values.endTime)

      if (!start || !end) {
        errors.endTime = 'Giờ kết thúc không hợp lệ.'
      }
    }
  }

  const recurrenceRule = createCenterCalendarRecurrenceRuleFromFormValues(values)
  const recurrenceErrors = validateCenterCalendarRecurrenceRule(recurrenceRule, { anchorDate: values.date })

  return {
    ...errors,
    ...recurrenceErrors,
  }
}

export function buildCenterCalendarItemFromForm(values = {}, existingItem = null, centerId = '') {
  const itemType = String(values.itemType || '').trim()
  const allDay = Boolean(values.allDay)
  const date = normalizeDateString(values.date) || getCurrentScheduleWeekStartDate()
  const start = allDay ? parseDateTime(date, '00:00') : parseDateTime(date, values.startTime)
  let end = allDay ? parseDateTime(addDays(date, 1), '00:00') : parseDateTime(date, values.endTime)

  if (!allDay && start && end && end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  }
  const now = new Date().toISOString()
  const preset = getCenterCalendarPresetByColorKey(values.colorKey, itemType)
  const tagId = String(values.tagId || '').trim()
  const tagLabel = String(values.tagLabel || '').trim()

  return normalizeCenterCalendarItem(
    {
      id: existingItem?.id || `center-calendar-${itemType}-${Date.now()}`,
      centerId,
      itemType,
      title: String(values.title || '').trim(),
      description: String(values.description || '').trim(),
      startAt: start?.toISOString() || '',
      endAt: end?.toISOString() || '',
      allDay,
      location: String(values.location || '').trim(),
      colorKey: preset.key,
      tagId,
      tagLabel: tagId ? tagLabel : '',
      recurrenceRule: createCenterCalendarRecurrenceRuleFromFormValues(values),
      sourceModule: 'centerCalendar',
      createdAt: existingItem?.createdAt || now,
      updatedAt: now,
    },
    { centerId },
  )
}

function getCenterCalendarItemsByDate(centerCalendarItems = [], date) {
  const dayStartAt = `${date}T00:00:00.000Z`
  const dayEndAt = `${addDays(date, 1)}T00:00:00.000Z`

  return getCenterCalendarItemsForRange(centerCalendarItems, dayStartAt, dayEndAt)
}

function getCenterCalendarItemsForDisplayRange(centerCalendarItems = [], rangeStartAt, rangeEndAt) {
  const sourceItems = Array.isArray(centerCalendarItems) ? centerCalendarItems : []
  const singleItems = getCenterCalendarItemsForRange(
    sourceItems.filter((item) => !isWeeklyRecurringCenterCalendarItem(item)),
    rangeStartAt,
    rangeEndAt,
  )
  const recurringOccurrences = expandWeeklyCenterCalendarOccurrences(
    sourceItems.filter((item) => isWeeklyRecurringCenterCalendarItem(item)),
    {
      rangeStart: rangeStartAt,
      rangeEnd: rangeEndAt,
    },
  )

  return [...singleItems, ...recurringOccurrences].sort(compareCenterCalendarDisplayItems)
}

function compareCenterCalendarDisplayItems(firstItem, secondItem) {
  return (
    String(firstItem.startAt || '').localeCompare(String(secondItem.startAt || '')) ||
    String(firstItem.title || '').localeCompare(String(secondItem.title || ''), 'vi', { sensitivity: 'base' }) ||
    String(firstItem.id || '').localeCompare(String(secondItem.id || ''))
  )
}

function renderCenterCalendarItemCard(item, centerCalendarTags = []) {
  const preset = getCenterCalendarPresetByColorKey(item.colorKey, item.itemType)
  const color = item.customColor || preset.color
  const typeLabel = CENTER_CALENDAR_ITEM_TYPE_LABELS[item.itemType] || CENTER_CALENDAR_ITEM_TYPE_LABELS.other
  const locationLabel = item.location || item.roomId || ''
  const cancelledLabel = item.isCancelled ? '<span class="schedule-calendar-item-status">Đã hủy</span>' : ''
  const recurrenceLabel = item.isVirtualOccurrence ? '<span class="schedule-calendar-item-recurring">Lặp hàng tuần</span>' : ''
  const tagMeta = getCenterCalendarItemTagMeta(item, centerCalendarTags)

  const tagLabel = tagMeta
    ? `<span class="schedule-calendar-item-tag ${tagMeta.tag.isActive ? '' : 'is-archived'}" title="${escapeAttribute(tagMeta.tag.isActive ? tagMeta.tag.label : `${tagMeta.tag.label} - nhãn đã lưu trữ`)}" style="--schedule-calendar-tag-color: ${escapeAttribute(tagMeta.color)};">${escapeHtml(tagMeta.tag.label)}</span>`
    : ''
  const description = item.description
    ? `<p class="schedule-calendar-item-description">${escapeHtml(item.description)}</p>`
    : ''

  return `
    <article
      class="schedule-calendar-item schedule-calendar-item--${escapeAttribute(item.itemType)} ${item.isCancelled ? 'is-cancelled' : ''} ${item.isVirtualOccurrence ? 'is-recurring-occurrence' : ''}"
      data-center-calendar-item-id="${escapeAttribute(item.id)}"
      ${item.isVirtualOccurrence ? `data-center-calendar-master-id="${escapeAttribute(item.masterId || '')}" data-center-calendar-occurrence-date="${escapeAttribute(item.occurrenceDate || '')}"` : ''}
      role="button"
      tabindex="0"
      style="--schedule-calendar-item-color: ${escapeAttribute(color)};"
      aria-label="${escapeAttribute(`${typeLabel}: ${item.title}`)}"
    >
      <div class="schedule-calendar-item-header">
        <span class="schedule-calendar-item-type">${escapeHtml(typeLabel)}</span>
        ${cancelledLabel}
        ${recurrenceLabel}
      </div>
      <h4>${escapeHtml(item.title)}</h4>
      <p class="schedule-calendar-item-time">${escapeHtml(formatCenterCalendarItemTime(item))}</p>
      ${locationLabel ? `<p class="schedule-calendar-item-location">${escapeHtml(locationLabel)}</p>` : ''}
      ${tagLabel}
      ${description}
    </article>
  `
}

function renderCenterCalendarTagSelectField(formState, centerCalendarTags = []) {
  const selectedTagId = String(formState.values.tagId || '').trim()
  const activeTags = centerCalendarTags.filter((tag) => tag.isActive)
  const selectedArchivedTag = selectedTagId
    ? centerCalendarTags.find((tag) => tag.id === selectedTagId && !tag.isActive)
    : null

  return `
    <label class="schedule-form-field span-full schedule-calendar-tag-select">
      <span>Nhãn</span>
      <select data-center-calendar-form-field="tagId">
        <option value="" ${selectedTagId ? '' : 'selected'}>Không gắn nhãn</option>
        ${activeTags.map((tag) => `
          <option value="${escapeAttribute(tag.id)}" ${selectedTagId === tag.id ? 'selected' : ''}>${escapeHtml(tag.label)}</option>
        `).join('')}
        ${
          selectedArchivedTag
            ? `<option value="${escapeAttribute(selectedArchivedTag.id)}" selected>${escapeHtml(`${selectedArchivedTag.label} (đã lưu trữ)`)}</option>`
            : ''
        }
      </select>
      <small>Nhãn chỉ hiển thị badge và filter, không đổi màu thẻ.</small>
      ${formState.errors.tagId ? `<small>${escapeHtml(formState.errors.tagId)}</small>` : ''}
    </label>
  `
}

function getCenterCalendarItemTagMeta(item, centerCalendarTags = []) {
  if (!item?.tagId && !item?.tagLabel) {
    return null
  }

  const tag = item.tagId ? getCenterCalendarTagById(centerCalendarTags, item.tagId) : null
  const fallbackTag = tag || {
    id: item.tagId || '',
    label: item.tagLabel || '',
    colorKey: 'gray',
    defaultItemType: '',
    isActive: true,
  }

  if (!fallbackTag.label) {
    return null
  }

  const preset = getCenterCalendarPresetByColorKey(fallbackTag.colorKey, fallbackTag.defaultItemType || 'other')

  return {
    tag: fallbackTag,
    color: preset.color,
  }
}

function formatCenterCalendarItemTime(item) {
  if (item.allDay) {
    return 'Cả ngày'
  }

  const startTime = formatTimeFromIsoDateTime(item.startAt)
  const endTime = formatTimeFromIsoDateTime(item.endAt)

  return [startTime, endTime].filter(Boolean).join('-') || 'Chưa có giờ'
}

function renderSessionCard(session, teacherLookup, studentLookup, conflictMap) {
  const teacher = session.teacherId ? teacherLookup.get(String(session.teacherId)) : null
  const teacherLabel = getSessionTeacherLabel(session, teacher)
  const studentSummary = getStudentSummary(session.studentIds, studentLookup)
  const conflicts = conflictMap.get(session.id)
  const isEmptySlot = Boolean(session.isEmptyClassSessionSlot)
  const classSessionLabel = String(session.classSessionLabel || '').trim()
  const rawTitle = isEmptySlot
    ? classSessionLabel || 'Chưa gán thông tin'
    : String(session.title || session.groupName || classSessionLabel || 'Chưa gán thông tin')
  const title = repairScheduleDisplayText(rawTitle)
  const meta = isEmptySlot
    ? `Chưa phân công · ${session.room || 'Chưa có phòng'}`
    : `${teacherLabel.name} · ${session.room || 'Chưa có phòng'}`

  return `
    <article
      class="schedule-session-card is-${escapeAttribute(session.level)} is-${escapeAttribute(session.scheduleType)} ${isEmptySlot ? 'is-empty-slot' : ''} ${conflicts ? 'has-conflict' : ''}"
      data-schedule-action="open-edit"
      data-schedule-session-id="${escapeAttribute(session.id)}"
      data-schedule-occurrence-date="${escapeAttribute(session.occurrenceDate ?? '')}"
      tabindex="0"
    >
      <time class="schedule-session-time">${escapeHtml(formatSessionTime(session))}</time>
      <h4>${escapeHtml(title)}</h4>
      <p class="schedule-session-meta">
        ${escapeHtml(meta)}
      </p>
      <p class="schedule-session-students">${escapeHtml(studentSummary.countLabel)}</p>
      ${isEmptySlot ? '<span class="schedule-empty-slot-action">+ Thêm thông tin</span>' : ''}
    </article>
  `
}

function renderScheduleAlertBell(alerts = []) {
  const alertItems = Array.isArray(alerts) ? alerts : []
  const teacherCount = alertItems.filter((alert) => alert.group === 'teacher').length
  const adminCount = alertItems.filter((alert) => alert.group === 'adminReview').length
  const qtvCount = alertItems.filter((alert) => alert.status === 'qtvAttentionNeeded').length

  return `
    <details class="schedule-alert-bell" aria-label="ChuĂ´ng cáº£nh bĂ¡o TKB">
      <summary aria-label="Mở danh sách cảnh báo TKB">
        <span class="schedule-alert-bell-icon" aria-hidden="true">!</span>
        <span>Cáº£nh bĂ¡o</span>
        ${alertItems.length ? `<strong>${alertItems.length}</strong>` : ''}
      </summary>
      <div class="schedule-alert-popover" role="status">
        <div class="schedule-alert-popover-header">
          <strong>Cáº£nh bĂ¡o ca dáº¡y</strong>
          <span>${alertItems.length ? `${alertItems.length} ca cần kiểm tra` : '0 ca'}</span>
        </div>
        ${
          alertItems.length
            ? `
              <div class="schedule-alert-popover-groups" aria-label="NhĂ³m cáº£nh bĂ¡o">
                <span>Giáo viên trễ báo cáo: ${teacherCount}</span>
                <span>Admin/Tư vấn cần kiểm tra: ${adminCount}</span>
                <span>Cáº§n QTV/anh Háº£i chĂº Ă½: ${qtvCount || adminCount}</span>
              </div>
              <div class="schedule-alert-popover-list">${alertItems
                .slice(0, 12)
                .map((alert) => renderScheduleDeadlineAlertItemClean(alert))
                .join('')}</div>
            `
            : '<p class="schedule-alert-empty">KhĂ´ng cĂ³ ca cáº§n cáº£nh bĂ¡o.</p>'
        }
      </div>
    </details>
  `
}

function renderScheduleAlertBellClean(alerts = []) {
  const alertItems = Array.isArray(alerts) ? alerts : []
  const teacherCount = alertItems.filter((alert) => alert.group === 'teacher').length
  const adminCount = alertItems.filter((alert) => alert.group === 'adminReview').length
  const qtvCount = alertItems.filter((alert) => alert.status === 'qtvAttentionNeeded').length

  return `
    <details class="schedule-alert-bell" aria-label="Chuông cảnh báo TKB">
      <summary aria-label="Mở danh sách cảnh báo TKB">
        <span class="schedule-alert-bell-icon" aria-hidden="true">!</span>
        <span>Cảnh báo</span>
        ${alertItems.length ? `<strong>${alertItems.length}</strong>` : ''}
      </summary>
      <div class="schedule-alert-popover" role="status">
        <div class="schedule-alert-popover-header">
          <strong>Cảnh báo ca dạy</strong>
          <span>${alertItems.length ? `${alertItems.length} ca cần kiểm tra` : '0 ca'}</span>
        </div>
        ${
          alertItems.length
            ? `
              <div class="schedule-alert-popover-groups" aria-label="Nhóm cảnh báo">
                <span>Giáo viên trễ báo cáo: ${teacherCount}</span>
                <span>Admin/Tư vấn cần kiểm tra: ${adminCount}</span>
                <span>Cần QTV/anh Hải chú ý: ${qtvCount || adminCount}</span>
              </div>
              <div class="schedule-alert-popover-list">${alertItems
                .slice(0, 12)
                .map((alert) => renderScheduleDeadlineAlertItemClean(alert))
                .join('')}</div>
            `
            : '<p class="schedule-alert-empty">Không có ca cần cảnh báo.</p>'
        }
      </div>
    </details>
  `
}

function renderScheduleDeadlineAlertItemClean(alert) {
  return `
    <div class="schedule-teacher-alert-item is-${escapeAttribute(alert.status)}">
      <div class="schedule-teacher-alert-main">
        <strong>${escapeHtml(repairScheduleDisplayText(alert.title))}</strong>
        <span>${escapeHtml(formatReportDate(alert.occurrenceDate))} · ${escapeHtml(alert.timeLabel)}</span>
      </div>
      <div class="schedule-teacher-alert-meta">
        <span>Giáo viên: ${escapeHtml(alert.teacherName)}</span>
        <span>${escapeHtml(alert.deadlineTitle || 'Hạn gửi')}: ${escapeHtml(alert.deadlineLabel)}</span>
      </div>
      <p>${escapeHtml([alert.message, alert.escalationMessage].filter(Boolean).join(' '))}</p>
    </div>
  `
}

function renderTeacherDeadlineAlerts(alerts = []) {
  const alertItems = Array.isArray(alerts) ? alerts : []
  const teacherCount = alertItems.filter((alert) => alert.group === 'teacher').length
  const adminCount = alertItems.filter((alert) => alert.group === 'adminReview').length

  return `
    <section class="schedule-teacher-alerts" aria-label="Cảnh báo ca dạy">
      <div class="schedule-teacher-alerts-header">
        <strong>Cảnh báo ca dạy</strong>
        <span>${alertItems.length ? `${alertItems.length} ca cần kiểm tra` : 'Không có ca cần cảnh báo.'}</span>
      </div>
      ${
        alertItems.length
          ? `
            <div class="schedule-teacher-alert-groups" aria-label="Nhóm cảnh báo">
              <span>Giáo viên trễ báo cáo: ${teacherCount}</span>
              <span>Admin/Tư vấn cần kiểm tra: ${adminCount}</span>
              <span>Cần QTV/anh Hải chú ý: ${adminCount}</span>
            </div>
            <div class="schedule-teacher-alert-list" aria-label="Danh sĂ¡ch cáº£nh bĂ¡o ca dáº¡y">${alertItems
              .slice(0, 8)
              .map((alert) => renderTeacherDeadlineAlertItem(alert))
              .join('')}</div>
          `
          : '<p>Không có ca cần cảnh báo. Không có ca Giáo viên trễ báo cáo.</p>'
      }
    </section>
  `
}

function renderTeacherDeadlineAlertItem(alert) {
  return `
    <div class="schedule-teacher-alert-item is-${escapeAttribute(alert.status)}">
      <div class="schedule-teacher-alert-main">
        <strong>${escapeHtml(repairScheduleDisplayText(alert.title))}</strong>
        <span>${escapeHtml(formatReportDate(alert.occurrenceDate))} · ${escapeHtml(alert.timeLabel)}</span>
      </div>
      <div class="schedule-teacher-alert-meta">
        <span>Giáo viên: ${escapeHtml(alert.teacherName)}</span>
        <span>${escapeHtml(alert.deadlineTitle || 'Hạn gửi')}: ${escapeHtml(alert.deadlineLabel)}</span>
      </div>
      <p>${escapeHtml([alert.message, alert.escalationMessage].filter(Boolean).join(' '))}</p>
    </div>
  `
}

function renderScheduleForm(formState, teachers, students, sessions, weekStartDate, classSessions = []) {
  const isEdit = formState.mode === 'edit'
  const isManualCreate = formState.mode === 'create'
  const scheduleType = normalizeScheduleType(formState.values.scheduleType)
  const selectedClassSession =
    scheduleType === 'recurring' ? findScheduleClassSession(classSessions, formState.values.classSessionId) : null
  const isOrphanFixedRecord = isOrphanFixedScheduleRecord(formState.values, classSessions)
  const isFixedSlotForm = scheduleType === 'recurring' &&
    normalizeOptionalId(formState.values.classSessionId) &&
    selectedClassSession &&
    !isOrphanFixedRecord
  const isCompactFixedScheduleForm = isFixedSlotForm || isOrphanFixedRecord
  const formTitle = isFixedSlotForm
    ? 'Gán thông tin ca học'
    : isOrphanFixedRecord
      ? 'Sửa lịch cố định cũ'
    : isEdit || formState.mode === 'assign'
      ? 'Sửa buổi học'
      : 'Thêm buổi học'
  const formSubtitle = isManualCreate ? 'Chỉ thêm buổi đột xuất hoặc học bù' : ''
  const deleteLabel = isFixedSlotForm
    ? 'Xóa phân công'
    : isOrphanFixedRecord
      ? 'Xóa lịch cũ'
      : 'Xóa buổi học'
  const displayValues =
    scheduleType === 'recurring'
      ? applyClassSessionToScheduleValues(formState.values, selectedClassSession)
      : formState.values
  const formConflicts = getScheduleFormConflicts(
    formState,
    sessions,
    students,
    weekStartDate,
    teachers,
    classSessions,
  )

  return `
    <div class="schedule-form-backdrop" aria-hidden="true"></div>
    <form class="schedule-form-panel" data-schedule-form>
      <div class="schedule-form-header">
        <div>
          <h4>${escapeHtml(formTitle)}</h4>
          ${formSubtitle ? `<span>${escapeHtml(formSubtitle)}</span>` : ''}
        </div>
        <button type="button" data-schedule-action="cancel-form" aria-label="Đóng form">×</button>
      </div>

      <div class="schedule-form-grid" data-schedule-form-scroll-region="form">
        ${
          isCompactFixedScheduleForm
            ? `
              ${
                isFixedSlotForm
                  ? renderFixedSlotContext(displayValues, selectedClassSession, formState)
                  : renderOrphanFixedSlotContext(displayValues)
              }
              ${renderHiddenScheduleField('scheduleType', 'recurring')}
              ${renderHiddenScheduleField('classSessionId', displayValues.classSessionId || '')}
              ${renderHiddenScheduleField('title', repairScheduleDisplayText(displayValues.title))}
              ${renderHiddenScheduleField('dayOfWeek', displayValues.dayOfWeek)}
              ${renderHiddenScheduleField('startTime', displayValues.startTime)}
              ${renderHiddenScheduleField('endTime', displayValues.endTime)}
              ${renderHiddenScheduleField('allowOpenRange', 'true')}
            `
            : `
              ${renderScheduleTypeToggle(formState)}
              ${renderField('title', 'Tên buổi/lớp *', formState, 'text', { className: 'span-full' })}
              ${
                scheduleType === 'oneOff'
                  ? `
                    ${renderField('date', 'Ngày cụ thể *', formState, 'date')}
                    ${renderSelectField(
                      'occurrenceReason',
                      'Lý do',
                      formState,
                      getScheduleOccurrenceReasonOptions(formState),
                    )}
                  `
                  : `
                    ${renderClassSessionSelect(formState, classSessions)}
                    ${renderClassSessionReadOnlyFields(displayValues, selectedClassSession, formState)}
                    ${renderField('startDate', 'Từ ngày *', formState, 'date')}
                    ${renderField('endDate', 'Đến ngày *', formState, 'date')}
                  `
              }
            `
        }
        ${
          scheduleType === 'oneOff'
            ? `
              ${renderField('startTime', 'Giờ bắt đầu *', formState, 'time')}
              ${renderField('endTime', 'Giờ kết thúc *', formState, 'time')}
            `
            : `
              ${renderHiddenScheduleField('dayOfWeek', displayValues.dayOfWeek)}
              ${renderHiddenScheduleField('startTime', displayValues.startTime)}
              ${renderHiddenScheduleField('endTime', displayValues.endTime)}
            `
        }
        ${renderField('room', 'Phòng *', formState, 'text')}
        ${renderTeacherSelect(formState, teachers)}
        ${isCompactFixedScheduleForm ? '' : renderField('teacherName', 'Tên giáo viên fallback', formState, 'text')}
        ${isCompactFixedScheduleForm ? '' : renderField('groupName', 'Nhóm/lớp', formState, 'text')}
        ${isCompactFixedScheduleForm ? '' : renderSelectField('level', 'Cấp độ', formState, scheduleLevels.map((level) => [level, getLevelLabel(level)]))}
        ${renderSelectField('status', 'Trạng thái', formState, scheduleStatuses.map((status) => [status, getStatusLabel(status)]))}
        ${renderStudentPicker(formState, students, teachers)}
        ${renderTextareaField('note', scheduleType === 'oneOff' ? 'Ghi chú / lý do chi tiết' : 'Ghi chú', formState)}
      </div>

      ${isOrphanFixedRecord ? renderScheduleOrphanWarning() : ''}
      ${renderFormWarnings(formConflicts)}
      ${renderFormErrors(formState.errors)}

      <div class="schedule-form-actions">
        ${
          isEdit
            ? `<button class="schedule-danger-button" type="button" data-schedule-action="delete-session">${escapeHtml(deleteLabel)}</button>`
            : '<span></span>'
        }
        <div>
          <button type="button" data-schedule-action="cancel-form">Hủy</button>
          <button class="schedule-save-button" type="button" data-schedule-action="save-form">Lưu buổi học</button>
        </div>
      </div>
    </form>
  `
}

function getScheduleOccurrenceReasonOptions(formState) {
  const options = scheduleCreateOccurrenceReasons.map((reason) => [reason.id, reason.label])
  const currentReason = String(formState?.values?.occurrenceReason || '')

  if (currentReason === 'event') {
    const legacyReason = scheduleOccurrenceReasons.find((reason) => reason.id === 'event')
    options.push(['event', legacyReason?.label || 'Sự kiện'])
  }

  return options
}

function renderCenterCalendarItemState(state, centerCalendarTags = []) {
  if (state.mode === 'occurrenceDetail') {
    return renderCenterCalendarOccurrenceDetail(state.item, centerCalendarTags)
  }

  if (state.mode === 'detail') {
    return renderCenterCalendarItemDetail(state.item, centerCalendarTags)
  }

  if (state.mode === 'delete') {
    return renderCenterCalendarItemDeleteConfirm(state.item)
  }

  if (state.mode === 'conflict') {
    return renderCenterCalendarConflictPanel(state)
  }

  return renderCenterCalendarItemForm(state, centerCalendarTags)
}

function renderCenterCalendarConflictPanel(state) {
  const conflictResult = state.conflictResult || {}
  const hardConflicts = Array.isArray(conflictResult.hard) ? conflictResult.hard : []
  const softConflicts = Array.isArray(conflictResult.soft) ? conflictResult.soft : []
  const informationalConflicts = Array.isArray(conflictResult.informational) ? conflictResult.informational : []
  const isHard = hardConflicts.length > 0
  const visibleConflicts = [
    ...hardConflicts,
    ...softConflicts,
    ...informationalConflicts,
  ].slice(0, 6)
  const totalCount = Number(conflictResult.total || visibleConflicts.length)
  const conflictedOccurrenceCount = Number(conflictResult.conflictedOccurrenceCount || 0)
  const isSeriesConflict = isWeeklyRecurringCenterCalendarItem(state.pendingItem)
  const conflictSummary = `${totalCount} xung đột được tìm thấy${conflictedOccurrenceCount ? ` trên ${conflictedOccurrenceCount} occurrence` : ''}. Record hiện có sẽ không bị sửa.`
  const overrideLabel = isSeriesConflict ? 'Vẫn lưu toàn bộ chuỗi' : 'Vẫn lưu'

  return `
    <div class="schedule-form-backdrop" aria-hidden="true"></div>
    <section class="schedule-form-panel schedule-calendar-conflict-panel" data-center-calendar-conflict-panel>
      <div class="schedule-form-header">
        <div>
          <h4>${isHard ? 'Không thể lưu do trùng lịch' : 'Hoạt động đang trùng lịch'}</h4>
          <span>${isHard ? 'Lớp học hoặc buổi học thật đang dùng phòng này.' : 'Bạn có thể quay lại chỉnh sửa hoặc vẫn lưu hoạt động này.'}</span>
        </div>
        <button type="button" data-center-calendar-action="conflict-return" aria-label="Quay lại chỉnh sửa">×</button>
      </div>
      <div class="schedule-calendar-conflict-summary">
        <p>${escapeHtml(`${totalCount} xung đột được tìm thấy. Record hiện có sẽ không bị sửa.`)}</p>
        ${state.errors?.form ? `<div class="schedule-form-error" role="alert"><p>${escapeHtml(state.errors.form)}</p></div>` : ''}
        <div class="schedule-calendar-conflict-list">
          ${visibleConflicts.map((conflict) => renderCenterCalendarConflictRow(conflict)).join('')}
        </div>
      </div>
      <div class="schedule-form-actions">
        <span></span>
        <div>
          <button type="button" data-center-calendar-action="conflict-return">Quay lại chỉnh sửa</button>
          ${isHard ? '' : '<button class="schedule-save-button" type="button" data-center-calendar-action="conflict-save">Vẫn lưu</button>'}
        </div>
      </div>
    </section>
  `
}

function renderCenterCalendarConflictRow(conflict) {
  const severityLabels = {
    hard: 'Trùng phòng',
    soft: 'Xung đột thời gian',
    informational: 'Thông tin',
  }
  const timeLabel = formatCenterCalendarConflictTime(conflict)
  const roomLabel = conflict.roomLabel || conflict.location || conflict.roomId || 'Chưa có phòng'
  const sourceLabel = conflict.sourceLabel || 'Lịch'

  return `
    <article class="schedule-calendar-conflict-row is-${escapeAttribute(conflict.severity || 'informational')}">
      <strong>${escapeHtml(severityLabels[conflict.severity] || 'Xung đột thời gian')}</strong>
      <span>${escapeHtml(sourceLabel)} · ${escapeHtml(conflict.title || 'Lịch')}</span>
      <small>${escapeHtml([timeLabel, roomLabel].filter(Boolean).join(' · '))}</small>
    </article>
  `
}

function formatCenterCalendarConflictTime(conflict) {
  const startDate = getDateFromIsoDateTime(conflict.startAt)
  const endDate = getDateFromIsoDateTime(conflict.endAt)
  const dateLabel = formatDisplayDate(startDate)
  const startTime = formatTimeFromIsoDateTime(conflict.startAt)
  const endTime = formatTimeFromIsoDateTime(conflict.endAt)
  const timeLabel = [startTime, endTime].filter(Boolean).join('-')
  const endDateSuffix = endDate && endDate !== startDate ? ` -> ${formatDisplayDate(endDate)}` : ''

  return [dateLabel ? `${dateLabel}${endDateSuffix}` : '', timeLabel].filter(Boolean).join(' · ')
}

function renderCenterCalendarItemForm(formState, centerCalendarTags = []) {
  const isEdit = formState.mode === 'edit'
  const itemType = CENTER_CALENDAR_ITEM_TYPES.includes(formState.values.itemType)
    ? formState.values.itemType
    : 'other'
  const preset = getCenterCalendarPresetByColorKey(formState.values.colorKey, itemType)
  const allDay = Boolean(formState.values.allDay)

  return `
    <div class="schedule-form-backdrop" aria-hidden="true"></div>
    <form class="schedule-form-panel schedule-calendar-form-panel" data-center-calendar-form>
      <div class="schedule-form-header">
        <div>
          <h4>${isEdit ? 'Chỉnh sửa hoạt động' : 'Thêm hoạt động'}</h4>
          <span>Nội dung riêng của trung tâm, không phải buổi học.</span>
        </div>
        <button type="button" data-center-calendar-action="close" aria-label="Đóng form">×</button>
      </div>

      <div class="schedule-form-grid">
        ${renderCenterCalendarSelectField(
          'itemType',
          'Loại hoạt động *',
          formState,
          CENTER_CALENDAR_ITEM_TYPES.map((type) => [type, CENTER_CALENDAR_ITEM_TYPE_LABELS[type]]),
        )}
        ${renderCenterCalendarField('title', 'Tiêu đề *', formState, 'text', { className: 'span-full' })}
        ${renderCenterCalendarField('date', 'Ngày *', formState, 'date')}
        <label class="schedule-form-field schedule-calendar-checkbox">
          <span>Cả ngày</span>
          <input
            type="checkbox"
            name="allDay"
            value="true"
            ${allDay ? 'checked' : ''}
            data-center-calendar-form-field="allDay"
          />
        </label>
        ${renderCenterCalendarField('startTime', 'Giờ bắt đầu *', formState, 'time')}
        ${renderCenterCalendarField('endTime', 'Giờ kết thúc *', formState, 'time')}
        ${renderCenterCalendarField('location', 'Địa điểm', formState, 'text', { className: 'span-full' })}
        ${renderCenterCalendarTextareaField('description', 'Mô tả', formState)}
        ${renderCenterCalendarTagSelectField(formState, centerCalendarTags)}
        ${renderCenterCalendarRecurrenceFields(formState)}
        ${renderCenterCalendarColorPalette(formState, preset)}
      </div>

      ${renderFormErrors(formState.errors)}

      <div class="schedule-form-actions">
        <span></span>
        <div>
          <button type="button" data-center-calendar-action="close">Hủy</button>
          <button class="schedule-save-button" type="button" data-center-calendar-action="save">Lưu hoạt động</button>
        </div>
      </div>
    </form>
  `
}

function renderCenterCalendarOccurrenceDetail(item, centerCalendarTags = []) {
  if (!item) {
    return ''
  }

  const preset = getCenterCalendarPresetByColorKey(item.colorKey, item.itemType)
  const typeLabel = CENTER_CALENDAR_ITEM_TYPE_LABELS[item.itemType] || CENTER_CALENDAR_ITEM_TYPE_LABELS.other
  const dateLabel = formatDisplayDate(getDateFromIsoDateTime(item.startAt))
  const timeLabel = formatCenterCalendarItemTime(item)
  const locationLabel = item.location || item.roomId || 'Chưa có'
  const descriptionLabel = item.description || 'Chưa có'
  const tagMeta = getCenterCalendarItemTagMeta(item, centerCalendarTags)
  const recurrenceSummary = formatCenterCalendarRecurrenceSummary(item.recurrenceRule || item.masterItem?.recurrenceRule)

  return `
    <div class="schedule-form-backdrop" aria-hidden="true"></div>
    <section class="schedule-form-panel schedule-calendar-detail-panel" data-center-calendar-detail data-center-calendar-occurrence-detail>
      <div class="schedule-form-header">
        <div>
          <h4>Chi tiết hoạt động lặp lại</h4>
          <span>${escapeHtml(`Hoạt động lặp lại · ${typeLabel}`)}</span>
        </div>
        <button type="button" data-center-calendar-action="close" aria-label="Đóng">×</button>
      </div>
      <dl class="schedule-calendar-detail-list">
        <div><dt>Phạm vi</dt><dd>Hoạt động lặp lại</dd></div>
        <div><dt>Loại</dt><dd>${escapeHtml(typeLabel)}</dd></div>
        <div><dt>Tiêu đề</dt><dd>${escapeHtml(item.title)}</dd></div>
        <div><dt>Ngày occurrence</dt><dd>${escapeHtml(dateLabel)}</dd></div>
        <div><dt>Giờ occurrence</dt><dd>${escapeHtml(timeLabel)}</dd></div>
        <div><dt>Địa điểm</dt><dd>${escapeHtml(locationLabel)}</dd></div>
        <div><dt>Nhãn</dt><dd>${tagMeta ? renderCenterCalendarTagChip(tagMeta.tag) : 'Không gắn nhãn'}</dd></div>
        <div><dt>Mô tả</dt><dd>${escapeHtml(descriptionLabel)}</dd></div>
        <div><dt>Màu</dt><dd><span class="schedule-calendar-detail-color" style="--schedule-calendar-item-color: ${escapeAttribute(preset.color)};"></span>${escapeHtml(preset.label)}</dd></div>
        <div><dt>Lặp lại</dt><dd>${escapeHtml(recurrenceSummary)}</dd></div>
        ${item.isCancelled ? '<div><dt>Trạng thái</dt><dd>Đã hủy</dd></div>' : ''}
      </dl>
      <div class="schedule-form-actions">
        <span>Chỉnh sửa và xóa toàn bộ chuỗi sẽ được bổ sung ở bước tiếp theo.</span>
        <div>
          <button type="button" data-center-calendar-action="close">Đóng</button>
        </div>
      </div>
    </section>
  `
}

function renderCenterCalendarItemDetail(item, centerCalendarTags = []) {
  if (!item) {
    return ''
  }

  const preset = getCenterCalendarPresetByColorKey(item.colorKey, item.itemType)
  const typeLabel = CENTER_CALENDAR_ITEM_TYPE_LABELS[item.itemType] || CENTER_CALENDAR_ITEM_TYPE_LABELS.other
  const dateLabel = formatDisplayDate(getDateFromIsoDateTime(item.startAt))
  const timeLabel = formatCenterCalendarItemTime(item)
  const locationLabel = item.location || item.roomId || 'Chưa có'
  const descriptionLabel = item.description || 'Chưa có'
  const tagMeta = getCenterCalendarItemTagMeta(item, centerCalendarTags)

  return `
    <div class="schedule-form-backdrop" aria-hidden="true"></div>
    <section class="schedule-form-panel schedule-calendar-detail-panel" data-center-calendar-detail>
      <div class="schedule-form-header">
        <div>
          <h4>Chi tiết hoạt động</h4>
          <span>${escapeHtml(typeLabel)}</span>
        </div>
        <button type="button" data-center-calendar-action="close" aria-label="Đóng">×</button>
      </div>
      <dl class="schedule-calendar-detail-list">
        <div><dt>Loại</dt><dd>${escapeHtml(typeLabel)}</dd></div>
        <div><dt>Tiêu đề</dt><dd>${escapeHtml(item.title)}</dd></div>
        <div><dt>Ngày</dt><dd>${escapeHtml(dateLabel)}</dd></div>
        <div><dt>Giờ</dt><dd>${escapeHtml(timeLabel)}</dd></div>
        <div><dt>Địa điểm</dt><dd>${escapeHtml(locationLabel)}</dd></div>
        <div><dt>Nhãn</dt><dd>${tagMeta ? renderCenterCalendarTagChip(tagMeta.tag) : 'Không gắn nhãn'}</dd></div>
        <div><dt>Mô tả</dt><dd>${escapeHtml(descriptionLabel)}</dd></div>
        <div><dt>Màu</dt><dd><span class="schedule-calendar-detail-color" style="--schedule-calendar-item-color: ${escapeAttribute(preset.color)};"></span>${escapeHtml(preset.label)}</dd></div>
        ${item.isCancelled ? '<div><dt>Trạng thái</dt><dd>Đã hủy</dd></div>' : ''}
      </dl>
      <div class="schedule-form-actions">
        <button class="schedule-danger-button" type="button" data-center-calendar-action="confirm-delete" data-center-calendar-item-id="${escapeAttribute(item.id)}">Xóa hoạt động</button>
        <div>
          <button type="button" data-center-calendar-action="close">Đóng</button>
          <button class="schedule-save-button" type="button" data-center-calendar-action="edit" data-center-calendar-item-id="${escapeAttribute(item.id)}">Chỉnh sửa</button>
        </div>
      </div>
    </section>
  `
}

function renderCenterCalendarItemDeleteConfirm(item) {
  if (!item) {
    return ''
  }

  return `
    <div class="schedule-form-backdrop" aria-hidden="true"></div>
    <section class="schedule-form-panel schedule-calendar-delete-panel" data-center-calendar-delete-confirm>
      <div class="schedule-form-header">
        <div>
          <h4>Xóa hoạt động</h4>
          <span>${escapeHtml(item.title)}</span>
        </div>
        <button type="button" data-center-calendar-action="detail" data-center-calendar-item-id="${escapeAttribute(item.id)}" aria-label="Đóng">×</button>
      </div>
      <div class="schedule-form-error" role="alert">
        <p>Bạn có chắc muốn xóa hoạt động này?</p>
      </div>
      <div class="schedule-form-actions">
        <span></span>
        <div>
          <button type="button" data-center-calendar-action="detail" data-center-calendar-item-id="${escapeAttribute(item.id)}">Hủy</button>
          <button class="schedule-danger-button" type="button" data-center-calendar-action="delete" data-center-calendar-item-id="${escapeAttribute(item.id)}">Xóa hoạt động</button>
        </div>
      </div>
    </section>
  `
}

function renderCenterCalendarRecurrenceFields(formState) {
  const values = formState.values || {}
  const frequency = values.recurrenceFrequency === 'weekly' ? 'weekly' : 'none'
  const isWeekly = frequency === 'weekly'
  const selectedDays = new Set(
    String(values.recurrenceDays || '')
      .split(/[,\s/]+/)
      .filter((day) => CENTER_CALENDAR_WEEKDAY_KEYS.includes(day)),
  )
  const weekdayOptions = getCenterCalendarWeekdayOptions()
  const endMode = values.recurrenceEndMode === 'count' ? 'count' : 'until'
  const recurrenceRule = createCenterCalendarRecurrenceRuleFromFormValues(values)
  const summary = isWeekly ? formatCenterCalendarRecurrenceSummary(recurrenceRule) : 'Không lặp'

  return `
    <fieldset class="schedule-form-field schedule-calendar-recurrence span-full is-${escapeAttribute(frequency)}" data-center-calendar-recurrence>
      <legend>Lặp lại</legend>
      <label class="schedule-calendar-recurrence-mode ${formState.errors.recurrenceFrequency ? 'has-error' : ''}">
        <span>Kiểu lặp</span>
        <select data-center-calendar-form-field="recurrenceFrequency">
          <option value="none" ${frequency === 'none' ? 'selected' : ''}>Không lặp</option>
          <option value="weekly" ${frequency === 'weekly' ? 'selected' : ''}>Hàng tuần</option>
        </select>
      </label>
      ${
        true
          ? `
            <div class="schedule-calendar-weekday-toggle ${formState.errors.recurrenceDays ? 'has-error' : ''}" role="group" aria-label="Chọn thứ trong tuần">
              ${weekdayOptions.map((day) => {
                const isSelected = selectedDays.has(day.key)
                return `
                  <button type="button" class="schedule-calendar-weekday-button ${isSelected ? 'is-selected' : ''}" data-center-calendar-recurrence-day="${escapeAttribute(day.key)}" aria-pressed="${isSelected ? 'true' : 'false'}">
                    ${escapeHtml(day.shortLabel)}
                  </button>
                `
              }).join('')}
              <input type="hidden" value="${escapeAttribute(Array.from(selectedDays).join(','))}" data-center-calendar-form-field="recurrenceDays" />
              ${formState.errors.recurrenceDays ? `<small>${escapeHtml(formState.errors.recurrenceDays)}</small>` : ''}
            </div>
            <label class="schedule-calendar-recurrence-mode ${formState.errors.recurrenceEndMode ? 'has-error' : ''}">
              <span>Kết thúc</span>
              <select data-center-calendar-form-field="recurrenceEndMode">
                <option value="until" ${endMode === 'until' ? 'selected' : ''}>Vào ngày</option>
                <option value="count" ${endMode === 'count' ? 'selected' : ''}>Sau số lần</option>
              </select>
              ${formState.errors.recurrenceEndMode ? `<small>${escapeHtml(formState.errors.recurrenceEndMode)}</small>` : ''}
            </label>
            <label class="schedule-calendar-recurrence-mode ${endMode === 'until' ? '' : 'is-hidden'} ${formState.errors.recurrenceUntilDate ? 'has-error' : ''}" data-center-calendar-recurrence-until>
              <span>Ngày kết thúc</span>
              <input type="date" value="${escapeAttribute(values.recurrenceUntilDate || '')}" data-center-calendar-form-field="recurrenceUntilDate" />
              ${formState.errors.recurrenceUntilDate ? `<small>${escapeHtml(formState.errors.recurrenceUntilDate)}</small>` : ''}
            </label>
            <label class="schedule-calendar-recurrence-mode ${endMode === 'count' ? '' : 'is-hidden'} ${formState.errors.recurrenceCount ? 'has-error' : ''}" data-center-calendar-recurrence-count>
              <span>Số lần</span>
              <input type="number" min="1" max="${CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES}" value="${escapeAttribute(values.recurrenceCount || '8')}" data-center-calendar-form-field="recurrenceCount" />
              ${formState.errors.recurrenceCount ? `<small>${escapeHtml(formState.errors.recurrenceCount)}</small>` : ''}
            </label>
          `
          : ''
      }
      <small class="schedule-calendar-recurrence-summary">${escapeHtml(summary)}</small>
      <small class="schedule-calendar-recurrence-note">Chỉ lưu một master, không tạo từng occurrence vật lý.</small>
      ${formState.errors.recurrenceRule ? `<small>${escapeHtml(formState.errors.recurrenceRule)}</small>` : ''}
    </fieldset>
  `
}

function renderCenterCalendarColorPalette(formState, selectedPreset) {
  return `
    <fieldset class="schedule-form-field schedule-calendar-color-palette span-full" data-center-calendar-color-palette>
      <legend>Màu</legend>
      <div class="schedule-calendar-color-options" role="group" aria-label="Chọn màu thẻ">
        ${centerCalendarColorPaletteKeys
          .map((colorKey) => {
            const preset = CENTER_CALENDAR_COLOR_PRESETS[colorKey] || CENTER_CALENDAR_COLOR_PRESETS.yellow
            const isSelected = preset.key === selectedPreset.key

            return `
              <button
                type="button"
                class="schedule-calendar-color-swatch ${isSelected ? 'is-selected' : ''}"
                data-center-calendar-action="select-color"
                data-center-calendar-color-key="${escapeAttribute(preset.key)}"
                aria-pressed="${isSelected ? 'true' : 'false'}"
                style="--schedule-calendar-item-color: ${escapeAttribute(preset.color)};"
              >
                <span aria-hidden="true">${isSelected ? '✓' : ''}</span>
                <strong>${escapeHtml(preset.label)}</strong>
              </button>
            `
          })
          .join('')}
      </div>
      <button class="schedule-calendar-reset-color" type="button" data-center-calendar-action="reset-color">Đặt lại theo loại</button>
      <input type="hidden" name="colorKey" value="${escapeAttribute(selectedPreset.key)}" data-center-calendar-form-field="colorKey" />
      <input type="hidden" name="colorOverridden" value="${formState.values.colorOverridden ? 'true' : ''}" data-center-calendar-form-field="colorOverridden" />
      ${formState.errors.colorKey ? `<small>${escapeHtml(formState.errors.colorKey)}</small>` : ''}
    </fieldset>
  `
}

function renderScheduleReportPanel(
  reportState,
  sessions,
  teachers,
  students,
  weekStartDate,
  sessionReports = [],
  reportAttendanceState = null,
  reportLearningState = null,
  learningGroupFormState = null,
  reportExtraState = null,
  isReportExtraExpanded = false,
  guestParticipantFormState = null,
  adminAttendanceState = null,
) {
  const visibleSessions = getVisibleScheduleSessions(sessions, weekStartDate)
  const session = visibleSessions.find(
    (item) =>
      item.id === reportState.sessionId &&
      item.occurrenceDate === reportState.occurrenceDate,
  )

  if (!session) {
    return ''
  }

  const teacherLookup = createLookup(teachers)
  const studentLookup = createLookup(students)
  const teacher = session.teacherId ? teacherLookup.get(String(session.teacherId)) : null
  const teacherLabel = getSessionTeacherLabel(session, teacher)
  const reportMode = reportState.mode || 'teacherReport'
  const existingReport = findSessionReport(sessionReports, session.id, session.occurrenceDate)

  if (reportMode === 'roleGateway') {
    return renderScheduleReportRoleGateway(session, teacherLabel)
  }

  if (reportMode === 'adminPlaceholder') {
    return renderScheduleAdminAttendanceForm(session, teacherLabel, studentLookup, adminAttendanceState, existingReport)
  }

  const activeDraft =
    reportAttendanceState?.sessionId === session.id &&
    reportAttendanceState?.occurrenceDate === session.occurrenceDate
      ? reportAttendanceState
      : createSessionReportDraft(session, existingReport)
  const activeLearningState =
    reportLearningState?.sessionId === session.id &&
    reportLearningState?.occurrenceDate === session.occurrenceDate
      ? reportLearningState
      : createSessionReportLearningState(session, existingReport)
  const activeExtraState =
    reportExtraState?.sessionId === session.id &&
    reportExtraState?.occurrenceDate === session.occurrenceDate
      ? reportExtraState
      : createSessionReportExtraState(session, existingReport)
  const reportPreview = {
    ...(existingReport ?? {}),
    sessionId: session.id,
    occurrenceDate: session.occurrenceDate,
    attendance: activeDraft.attendance,
    learningGroups: activeLearningState.groups,
    guestParticipants: activeDraft.guestParticipants,
    ...activeExtraState.values,
  }
  const trelloText = buildTrelloReportText({
    session,
    report: reportPreview,
    students,
    teacher,
  })

  return `
    <div class="schedule-form-backdrop" aria-hidden="true"></div>
    <section class="schedule-report-panel" aria-label="Báo cáo ca dạy">
      <div class="schedule-report-header">
        <div class="schedule-report-compact-title">
          <strong>Báo cáo ca dạy</strong>
          <span>${escapeHtml(getScheduleSessionTitleForDisplay(session, 'Buổi học'))}</span>
          <span>${escapeHtml(formatReportDate(session.occurrenceDate))} · ${escapeHtml(formatSessionTime(session))}</span>
          <span>Giáo viên: ${escapeHtml(teacherLabel.name)}</span>
          ${teacherLabel.warning ? `<span class="schedule-warning-badge">${escapeHtml(teacherLabel.warning)}</span>` : ''}
        </div>
        <div class="schedule-report-header-actions">
          <button type="button" data-schedule-action="edit-from-report" data-schedule-session-id="${escapeAttribute(session.id)}">Sửa buổi học</button>
          <button type="button" data-schedule-action="close-report">Đóng</button>
          <button type="button" data-schedule-action="close-report" aria-label="Đóng báo cáo">×</button>
        </div>
      </div>

      <div class="schedule-report-body">
        <div class="schedule-report-column is-left" data-report-scroll-region="left">
          ${renderSessionReportAttendance(session, studentLookup, activeDraft, guestParticipantFormState)}
        </div>

        <div class="schedule-report-column is-middle" data-report-scroll-region="middle">
          ${renderSessionReportLearningGroups(session, studentLookup, activeDraft, activeLearningState, learningGroupFormState)}
          ${renderSessionReportExtraFields(activeExtraState, isReportExtraExpanded)}
        </div>

        <div class="schedule-report-column is-right" data-report-scroll-region="right">
          ${renderSessionReportTrello(trelloText, activeExtraState)}
        </div>
      </div>

    </section>
  `
}

function renderScheduleReportRoleGateway(session, teacherLabel) {
  return `
    <div class="schedule-form-backdrop" aria-hidden="true"></div>
    <section class="schedule-report-panel schedule-role-gateway" aria-label="Chọn vai trò xử lý buổi học">
      <div class="schedule-report-header">
        <div class="schedule-report-compact-title">
          <strong>Bạn là?</strong>
          <span>${escapeHtml(getScheduleSessionTitleForDisplay(session, 'Buổi học'))}</span>
          <span>${escapeHtml(formatReportDate(session.occurrenceDate))} · ${escapeHtml(formatSessionTime(session))}</span>
          <span>Giáo viên: ${escapeHtml(teacherLabel.name)}</span>
        </div>
        <div class="schedule-report-header-actions">
          <button type="button" data-schedule-action="close-report">Đóng</button>
          <button type="button" data-schedule-action="close-report" aria-label="Đóng chọn vai trò">×</button>
        </div>
      </div>

      <div class="schedule-role-gateway-body">
        <p>Chọn chế độ xử lý cho buổi học này.</p>
        <div class="schedule-role-options">
          <button type="button" data-schedule-report-role="admin">Admin cơ sở</button>
          <button type="button" data-schedule-report-role="teacher">Giáo viên</button>
        </div>
      </div>
    </section>
  `
}

function renderScheduleAdminAttendanceForm(
  session,
  teacherLabel,
  studentLookup,
  adminAttendanceState = null,
  teacherReport = null,
) {
  const studentIds = normalizeIdArray(session.studentIds)
  const rowsByStudentId = new Map(
    (Array.isArray(adminAttendanceState?.rows) ? adminAttendanceState.rows : [])
      .map((row) => [String(row.studentId || ''), row]),
  )
  const studentRows = studentIds.map((studentId) => ({
    studentId,
    student: studentLookup.get(studentId),
    row: rowsByStudentId.get(studentId) || {
      studentId,
      attendanceStatus: '',
      note: '',
    },
  }))
  const summary = getAdminAttendanceSummary(studentRows)
  const teacherReportStatus = teacherReport
    ? {
        label: 'Giáo viên đã báo cáo',
        detail: getTeacherReportReceivedLabel(teacherReport),
        tone: 'available',
      }
    : {
        label: 'Chưa có báo cáo giáo viên',
        detail: 'Admin chỉ đang điểm danh nhanh; chưa ghi nhận báo cáo giáo viên.',
        tone: 'missing',
      }
  const statusMessage = adminAttendanceState?.error
    ? `<p class="session-report-save-state error">${escapeHtml(adminAttendanceState.error)}</p>`
    : adminAttendanceState?.saveState === 'saved'
      ? '<p class="session-report-save-state">Đã lưu điểm danh Admin cơ sở.</p>'
      : ''

  return `
    <div class="schedule-form-backdrop" aria-hidden="true"></div>
    <section class="schedule-report-panel schedule-admin-attendance-panel schedule-admin-attendance-compact" aria-label="Điểm danh Admin cơ sở">
      <div class="schedule-report-header">
        <div class="schedule-report-compact-title">
          <strong>Điểm danh Admin cơ sở</strong>
          <span>${escapeHtml(getScheduleSessionTitleForDisplay(session, 'Buổi học'))}</span>
          <span>${escapeHtml(formatReportDate(session.occurrenceDate))} · ${escapeHtml(formatSessionTime(session))}</span>
          <span>Giáo viên: ${escapeHtml(teacherLabel.name)}</span>
          <span>Học viên trong ca: ${studentRows.length}</span>
        </div>
        <div class="schedule-report-header-actions">
          <button type="button" data-schedule-report-role="gateway">Quay lại chọn vai trò</button>
          <button type="button" data-schedule-action="close-report">Đóng</button>
        </div>
      </div>

      <div class="schedule-admin-attendance-body">
        <section class="schedule-admin-attendance-compact-top">
          <div class="schedule-admin-teacher-report-status is-${escapeAttribute(teacherReportStatus.tone)}" role="status">
            <strong>${escapeHtml(teacherReportStatus.label)}</strong>
            <span>${escapeHtml(teacherReportStatus.detail)}</span>
          </div>
          <div class="schedule-admin-attendance-actions">
            <button type="button" class="is-secondary" data-admin-attendance-action="mark-all-present">Đánh dấu tất cả có mặt</button>
            <button type="button" class="is-danger-ghost" data-admin-attendance-action="clear">Xóa nhập liệu</button>
            <button type="button" class="is-primary" data-admin-attendance-action="save">Lưu điểm danh</button>
          </div>
        </section>
        ${statusMessage}
        <div class="schedule-admin-attendance-summary" aria-label="Tổng quan điểm danh Admin">
          <span>Học viên trong ca: ${studentRows.length}</span>
          <span>Có mặt: ${summary.present}</span>
          <span>Vắng: ${summary.absent}</span>
          <span>Có phép: ${summary.excused}</span>
          <span>Chưa chọn: ${summary.empty}</span>
        </div>
        ${
          studentRows.length
            ? `<div class="schedule-admin-attendance-rows">${studentRows
                .map(({ studentId, student, row }) => renderAdminAttendanceStudentRow(studentId, student, row))
                .join('')}</div>`
            : '<p class="schedule-report-empty">Ca học này chưa có học viên.</p>'
        }
      </div>
    </section>
  `
}

function renderAdminAttendanceStudentRow(studentId, student, row = {}) {
  const studentName = student?.fullName || student?.name || 'Học viên'
  const studentMeta = [student?.level, student?.parentName].filter(Boolean).join(' · ')
  const status = String(row.attendanceStatus || '')

  return `
    <div class="schedule-admin-attendance-row" data-admin-attendance-row="${escapeAttribute(studentId)}">
      <div class="session-report-student-name">
        <strong>${escapeHtml(studentName)}</strong>
        <span>${escapeHtml(studentMeta || 'Trong ca học')}</span>
      </div>
      <div class="schedule-admin-attendance-choice-group" role="group" aria-label="Trạng thái điểm danh của ${escapeAttribute(studentName)}">
        ${adminAttendanceStatuses
          .filter(([value]) => ['present', 'absent', 'excused'].includes(value))
          .map(([value, label]) => `
            <button
              type="button"
              class="${status === value ? 'is-selected' : ''}"
              value="${escapeAttribute(value)}"
              data-admin-attendance-status
              data-admin-attendance-student-id="${escapeAttribute(studentId)}"
              aria-pressed="${status === value ? 'true' : 'false'}"
            >${escapeHtml(label)}</button>
          `)
          .join('')}
      </div>
      <input class="schedule-admin-attendance-note" type="text" maxlength="160" data-admin-attendance-note data-admin-attendance-student-id="${escapeAttribute(studentId)}" value="${escapeAttribute(row.note || '')}" placeholder="Ghi chú (không bắt buộc)" aria-label="Ghi chú điểm danh của ${escapeAttribute(studentName)}">
    </div>
  `
}

function getTeacherReportReceivedLabel(report) {
  const updatedAt = report?.updatedAt || report?.createdAt || report?.submittedAt || ''

  if (!updatedAt) {
    return 'Đã nhận báo cáo giáo viên.'
  }

  const dateLabel = formatReportDate(String(updatedAt).slice(0, 10) || updatedAt)
  return `Đã nhận báo cáo giáo viên · ${dateLabel}`
}

function getAdminAttendanceSummary(studentRows = []) {
  return studentRows.reduce((summary, { row }) => {
    const status = String(row?.attendanceStatus || '')
    if (Object.prototype.hasOwnProperty.call(summary, status)) {
      summary[status] += 1
    } else {
      summary.empty += 1
    }
    return summary
  }, {
    present: 0,
    absent: 0,
    excused: 0,
    makeup: 0,
    trial: 0,
    empty: 0,
  })
}

function renderSessionReportAttendance(session, studentLookup, draft, guestFormState = null) {
  const attendance = normalizeReportAttendance(draft?.attendance)
  const guestParticipants = normalizeReportGuestParticipants(draft?.guestParticipants)
  const isLockedByAdmin = Boolean(draft?.attendanceLockedByAdmin)
  const presentRows = [
    ...attendance.filter((item) => ['present', 'makeup', 'trial'].includes(item.attendanceStatus)),
    ...guestParticipants,
  ]

  if (!attendance.length && !guestParticipants.length) {
    return `
      <section class="schedule-report-section session-report-attendance">
        <div class="session-report-section-heading">
          <h5>Điểm danh giáo viên</h5>
          <button type="button" data-session-guest-action="open-create" ${isLockedByAdmin ? 'disabled' : ''}>+ Học viên tạm</button>
        </div>
        ${renderTeacherAttendanceLockNotice(draft)}
        ${guestFormState ? renderGuestParticipantForm(guestFormState) : ''}
        <p class="schedule-report-empty">Chưa có học viên trong buổi học.</p>
      </section>
    `
  }

  const presentCount = presentRows.length
  const absentCount = attendance.filter((item) =>
    ['absent', 'excused'].includes(item.attendanceStatus),
  ).length
  const makeupCount =
    attendance.filter((item) => item.attendanceStatus === 'makeup').length +
    guestParticipants.filter((guest) => guest.participationType === 'makeup').length
  const trialCount =
    attendance.filter((item) => item.attendanceStatus === 'trial').length +
    guestParticipants.filter((guest) => guest.participationType === 'trial').length
  const totalCount = attendance.length + guestParticipants.length

  return `
    <section class="schedule-report-section session-report-attendance">
      <div class="session-report-section-heading">
        <h5>Điểm danh giáo viên</h5>
        <div>
          <button type="button" data-session-guest-action="open-create" ${isLockedByAdmin ? 'disabled' : ''}>+ Học viên tạm</button>
          <button type="button" data-schedule-action="save-attendance" ${isLockedByAdmin ? 'disabled' : ''}>Lưu điểm danh</button>
        </div>
      </div>

      ${renderTeacherAttendanceLockNotice(draft)}

      <div class="session-report-summary" aria-label="Tổng quan điểm danh">
        <span>Sĩ số: ${presentCount}/${totalCount}</span>
        <span>Vắng: ${absentCount}</span>
        <span>Học bù: ${makeupCount}</span>
        <span>Học thử: ${trialCount}</span>
      </div>
      ${guestFormState ? renderGuestParticipantForm(guestFormState) : ''}

      ${
        draft?.error
          ? `<p class="session-report-save-state error">${escapeHtml(draft.error)}</p>`
          : ''
      }
      ${
        draft?.saveState === 'saved'
          ? '<p class="session-report-save-state">Đã lưu điểm danh.</p>'
          : ''
      }

      <div class="session-report-student-rows">
        ${attendance
          .map((item) => renderAttendanceRow(item, studentLookup.get(item.studentId), { disabled: isLockedByAdmin }))
          .join('')}
        ${guestParticipants.map((guest) => renderGuestParticipantRow(guest)).join('')}
      </div>
    </section>
  `
}

function renderTeacherAttendanceLockNotice(draft = {}) {
  if (!draft.attendanceLockedByAdmin) {
    return ''
  }

  return `
    <div class="session-report-admin-lock-notice" role="status">
      <strong>Admin cơ sở đã điểm danh ca này.</strong>
      <span>Phần điểm danh đã được Admin cơ sở ghi nhận. Giáo viên có thể bổ sung nội dung ca dạy và báo cáo.</span>
    </div>
  `
}

function renderAttendanceRow(attendanceItem, student, options = {}) {
  const studentName = getShortStudentName(student?.fullName || student?.name || 'Học viên không tìm thấy')
  const studentMeta = [
    student?.level,
    student?.parentName,
    student?.phone,
  ].filter(Boolean).join(' · ')

  return `
    <div class="session-report-student-row">
      <div class="session-report-student-name">
        <strong>${escapeHtml(studentName)}</strong>
        ${studentMeta ? `<span>${escapeHtml(studentMeta)}</span>` : ''}
      </div>
      <select
        class="session-report-attendance-status"
        data-session-report-attendance-status
        data-session-report-student-id="${escapeAttribute(attendanceItem.studentId)}"
        aria-label="Trạng thái điểm danh của ${escapeAttribute(studentName)}"
        ${options.disabled ? 'disabled' : ''}
      >
        ${attendanceStatuses
          .map(
            ([status, label]) =>
              `<option value="${escapeAttribute(status)}" ${
                attendanceItem.attendanceStatus === status ? 'selected' : ''
              }>${escapeHtml(label)}</option>`,
          )
          .join('')}
      </select>
      <input
        class="session-report-attendance-note"
        type="text"
        data-session-report-attendance-note
        data-session-report-student-id="${escapeAttribute(attendanceItem.studentId)}"
        value="${escapeAttribute(attendanceItem.note)}"
        maxlength="140"
        aria-label="Ghi chú điểm danh của ${escapeAttribute(studentName)}"
        ${options.disabled ? 'disabled' : ''}
      />
    </div>
  `
}

function renderGuestParticipantRow(guest) {
  const guestLabel = guest.participationType === 'makeup' ? 'Học bù' : 'Học thử'

  return `
    <div class="session-report-student-row is-guest">
      <div class="session-report-student-name">
        <strong>${escapeHtml(getShortStudentName(guest.displayName))}</strong>
        <span>${escapeHtml(guestLabel)} · học viên tạm</span>
      </div>
      <div class="session-report-guest-type">${escapeHtml(guestLabel)}</div>
      <div class="session-report-guest-note">
        <span>${escapeHtml(guest.note || 'Chưa có ghi chú')}</span>
        <button type="button" data-session-guest-action="delete" data-guest-id="${escapeAttribute(guest.id)}">Xóa</button>
      </div>
    </div>
  `
}

function renderGuestParticipantForm(formState) {
  return `
    <form class="session-report-guest-form" data-session-guest-form>
      <label>
        <span>Tên học viên tạm</span>
        <input
          type="text"
          data-session-guest-field="displayName"
          value="${escapeAttribute(formState.values.displayName)}"
        />
      </label>
      <label>
        <span>Loại</span>
        <select data-session-guest-field="participationType">
          ${guestParticipationTypes
            .map(
              ([type, label]) =>
                `<option value="${escapeAttribute(type)}" ${
                  formState.values.participationType === type ? 'selected' : ''
                }>${escapeHtml(type === 'makeup' ? 'Học bù từ cơ sở khác' : label)}</option>`,
            )
            .join('')}
        </select>
      </label>
      <label>
        <span>Ghi chú</span>
        <input
          type="text"
          data-session-guest-field="note"
          value="${escapeAttribute(formState.values.note)}"
        />
      </label>
      ${renderGuestParticipantFormErrors(formState.errors)}
      <div class="session-report-guest-actions">
        <button type="button" data-session-guest-action="cancel-form">Hủy</button>
        <button type="submit">Lưu</button>
      </div>
    </form>
  `
}

function renderGuestParticipantFormErrors(errors = {}) {
  const messages = Object.values(errors).filter(Boolean)

  if (!messages.length) {
    return ''
  }

  return `
    <div class="session-report-learning-errors">
      ${messages.map((message) => `<p>${escapeHtml(message)}</p>`).join('')}
    </div>
  `
}

function renderSessionReportLearningGroups(
  session,
  studentLookup,
  attendanceDraft,
  learningState,
  formState,
) {
  const sessionStudentIds = normalizeIdArray(session.studentIds)
  const groups = normalizeReportLearningGroups(learningState?.groups, sessionStudentIds)
  const attendanceLookup = new Map(
    normalizeReportAttendance(attendanceDraft?.attendance).map((item) => [item.studentId, item]),
  )

  return `
    <section class="schedule-report-section session-report-learning">
      <div class="session-report-learning-header">
        <div>
          <h5>Nhóm nội dung học</h5>
          <p>${groups.length} nhóm đã lưu</p>
        </div>
        ${
          sessionStudentIds.length
            ? `<button type="button" data-session-learning-action="open-create" ${formState ? 'disabled' : ''}>${
                formState ? 'Đang nhập nhóm...' : '+ Thêm nhóm'
              }</button>`
            : ''
        }
      </div>

      ${
        learningState?.error
          ? `<p class="session-report-save-state error">${escapeHtml(learningState.error)}</p>`
          : ''
      }
      ${
        learningState?.saveState === 'saved'
          ? '<p class="session-report-save-state">Đã lưu nhóm nội dung học.</p>'
          : ''
      }

      ${formState ? renderLearningGroupForm(formState, sessionStudentIds, studentLookup, attendanceLookup) : ''}

      ${
        sessionStudentIds.length
          ? renderLearningGroupCards(groups, studentLookup)
          : '<p class="session-report-learning-empty">Chưa có học viên để tạo nhóm nội dung.</p>'
      }
    </section>
  `
}

function renderLearningGroupForm(formState, sessionStudentIds, studentLookup, attendanceLookup) {
  const submitLabel = formState.mode === 'edit' ? 'Lưu thay đổi nhóm' : 'Lưu nhóm'

  return `
    <form class="session-report-learning-form" data-session-learning-form>
      <div class="session-report-learning-form-title">
        <strong>${escapeHtml(formState.mode === 'edit' ? 'Sửa nhóm nội dung' : 'Nhóm nội dung mới')}</strong>
      </div>
      <div class="session-report-learning-form-grid">
        <label>
          <span>Tên nhóm</span>
          <input
            type="text"
            value="${escapeAttribute(formState.values.title)}"
            data-session-learning-field="title"
          />
        </label>

        <label>
          <span>Ghi chú nhóm</span>
          <input
            type="text"
            value="${escapeAttribute(formState.values.note)}"
            data-session-learning-field="note"
          />
        </label>

        <div class="session-report-learning-students">
          <span>Học viên trong nhóm</span>
          <div data-report-scroll-region="learning-students">
            ${sessionStudentIds
              .map((studentId) =>
                renderLearningStudentCheckbox(
                  studentId,
                  studentLookup.get(studentId),
                  formState.values.studentIds,
                  attendanceLookup.get(studentId),
                ),
              )
              .join('')}
          </div>
        </div>

        <label class="session-report-learning-content">
          <span>Nội dung học</span>
          <textarea
            data-session-learning-field="contentText"
            rows="4"
          >${escapeHtml(formState.values.contentText)}</textarea>
        </label>
      </div>

      ${renderLearningGroupFormErrors(formState.errors)}

      <div class="session-report-learning-actions">
        <button class="session-report-learning-cancel-button" type="button" data-session-learning-action="cancel-form">Hủy</button>
        <button class="session-report-learning-save-button" type="submit">${escapeHtml(submitLabel)}</button>
      </div>
    </form>
  `
}

function renderLearningStudentCheckbox(studentId, student, selectedStudentIds, attendance) {
  const selectedSet = new Set(normalizeIdArray(selectedStudentIds))
  const studentName = student?.fullName || student?.name || 'Học viên không tìm thấy'
  const attendanceLabel = getAttendanceStatusLabel(attendance?.attendanceStatus)

  return `
    <label>
      <input
        type="checkbox"
        value="${escapeAttribute(studentId)}"
        data-session-learning-student
        ${selectedSet.has(studentId) ? 'checked' : ''}
      />
      <span>${escapeHtml(studentName)}</span>
      ${attendanceLabel ? `<small>${escapeHtml(attendanceLabel)}</small>` : ''}
    </label>
  `
}

function renderLearningGroupFormErrors(errors = {}) {
  const messages = Object.values(errors).filter(Boolean)

  if (!messages.length) {
    return ''
  }

  return `
    <div class="session-report-learning-errors">
      ${messages.map((message) => `<p>${escapeHtml(message)}</p>`).join('')}
    </div>
  `
}

function renderLearningGroupCards(groups, studentLookup) {
  if (!groups.length) {
    return '<p class="session-report-learning-empty">Chưa có nhóm nội dung học.</p>'
  }

  return `
    <div class="session-report-learning-list">
      ${groups.map((group) => renderLearningGroupCard(group, studentLookup)).join('')}
    </div>
  `
}

function renderLearningGroupCard(group, studentLookup) {
  const studentNames = normalizeIdArray(group.studentIds)
    .map((studentId) => getStudentDisplayName(studentLookup.get(studentId)))
  const contentLines = normalizeContentLines(group.contentLines)

  return `
    <article class="session-report-learning-card">
      <div class="session-report-learning-card-header">
        <div>
          <strong>${escapeHtml(group.title || 'Nhóm nội dung')}</strong>
          <span>${studentNames.length ? escapeHtml(studentNames.join(', ')) : 'Chưa chọn học viên'}</span>
        </div>
        <div>
          <button type="button" data-session-learning-action="open-edit" data-learning-group-id="${escapeAttribute(group.id)}">Sửa</button>
          <button type="button" data-session-learning-action="delete" data-learning-group-id="${escapeAttribute(group.id)}">Xóa</button>
        </div>
      </div>
      ${
        contentLines.length
          ? `<ul>${contentLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
          : '<p class="session-report-learning-empty">Chưa có nội dung học.</p>'
      }
      ${group.note ? `<p class="session-report-learning-note">${escapeHtml(group.note)}</p>` : ''}
    </article>
  `
}

const defaultClassSituationText = 'Lớp học ngoan, tham gia sôi nổi'

function renderSessionReportExtraFields(extraState, isExpanded = false) {
  const classSituationValue = extraState?.values?.classSituation || defaultClassSituationText

  return `
    <section class="schedule-report-section session-report-extra-fields ${isExpanded ? 'is-expanded' : 'is-collapsed'}">
      <div class="session-report-extra-header">
        <div>
          <h5>Thông tin thêm cho báo cáo</h5>
          <p>${isExpanded ? 'Bổ sung ghi chú trợ giảng, tình hình lớp và đề xuất.' : 'Đang thu gọn để ưu tiên nhóm nội dung học.'}</p>
        </div>
        <div class="session-report-extra-actions">
          <button type="button" data-session-report-action="toggle-extra">${isExpanded ? 'Thu gọn' : '+ Thông tin thêm'}</button>
          ${isExpanded ? '<button type="button" data-session-report-action="save-extra">Lưu thông tin báo cáo</button>' : ''}
        </div>
      </div>

      ${
        isExpanded && extraState?.error
          ? `<p class="session-report-save-state error">${escapeHtml(extraState.error)}</p>`
          : ''
      }
      ${
        isExpanded && extraState?.saveState === 'saved'
          ? '<p class="session-report-save-state">Đã lưu thông tin báo cáo.</p>'
          : ''
      }

      ${
        isExpanded
          ? `
            <div class="session-report-extra-grid">
              ${renderExtraTextarea(
                'teachingAssistantNotes',
                'Nội dung kiến tập/trợ giảng',
                extraState?.values?.teachingAssistantNotes,
              )}
              ${renderExtraTextarea(
                'classSituation',
                'Tình hình lớp học',
                classSituationValue,
              )}
              ${renderExtraTextarea('suggestions', 'Đề xuất', extraState?.values?.suggestions)}
            </div>
          `
          : ''
      }
    </section>
  `
}

function renderExtraTextarea(fieldName, label, value) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <textarea
        data-session-report-extra-field="${escapeAttribute(fieldName)}"
        rows="3"
      >${escapeHtml(value ?? '')}</textarea>
    </label>
  `
}

function renderSessionReportTrello(trelloText, extraState) {
  return `
    <section class="schedule-report-section session-report-trello">
      <div class="session-report-trello-header">
        <div>
          <h5>Mẫu báo cáo Trello</h5>
        </div>
        <div class="session-report-trello-actions">
          <button type="button" data-session-report-action="refresh-trello">Tạo/Cập nhật mẫu</button>
          <button type="button" data-session-report-action="copy-trello">Copy báo cáo</button>
        </div>
      </div>

      <textarea
        class="session-report-trello-output"
        data-session-report-trello-output
        readonly
        rows="12"
      >${escapeHtml(trelloText)}</textarea>

      <div class="session-report-copy-actions">
        ${
          extraState?.copyState === 'copied'
            ? '<span class="session-report-copy-state">Đã copy.</span>'
            : ''
        }
        ${
          extraState?.copyState === 'failed'
            ? '<span class="session-report-copy-state error">Không copy tự động được, hãy bôi đen và copy thủ công.</span>'
            : ''
        }
      </div>
    </section>
  `
}

function renderReportItem(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || 'Chưa cập nhật')}</strong>
    </div>
  `
}

function renderScheduleTypeToggle(formState) {
  if (formState.mode === 'create') {
    return renderHiddenScheduleField('scheduleType', 'oneOff')
  }

  return renderSelectField(
    'scheduleType',
    'Loại lịch *',
    formState,
    [
      ['recurring', 'Lịch cố định'],
      ['oneOff', 'Buổi đột xuất / học bù'],
    ],
    'span-full schedule-type-toggle',
  )
}

function renderClassSessionSelect(formState, classSessions = []) {
  const visibleClassSessions = getVisibleScheduleClassSessions(classSessions, formState.values.classSessionId)
  const options = [
    ['', visibleClassSessions.length ? 'Chọn ca học/lớp' : 'Chưa có ca học/lớp trong Cài đặt cơ sở'],
    ...visibleClassSessions.map((classSession) => [
      classSession.id,
      getScheduleClassSessionLabel(classSession),
    ]),
  ]

  return renderSelectField(
    'classSessionId',
    'Ca học/Lớp từ Cài đặt cơ sở *',
    formState,
    options,
    'span-full schedule-class-session-select',
  )
}

function renderClassSessionReadOnlyFields(values, classSession, formState) {
  const dayLabel = getScheduleDayLabel(values.dayOfWeek)
  const timeLabel = [values.startTime, values.endTime].filter(Boolean).join('-')
  const sourceLabel = classSession ? getScheduleClassSessionLabel(classSession) : 'Chưa chọn ca học/lớp'

  return `
    <div class="schedule-class-session-readonly span-full ${formState.errors.classSessionId ? 'has-error' : ''}">
      <span>Nguồn lịch cố định</span>
      <strong>${escapeHtml(sourceLabel)}</strong>
      <div>
        <small>Ngày: ${escapeHtml(dayLabel || 'Chưa có')}</small>
        <small>Giờ: ${escapeHtml(timeLabel || 'Chưa có')}</small>
        <small>Lớp/Nhóm: ${escapeHtml(values.groupName || values.title || 'Chưa có')}</small>
      </div>
      ${formState.errors.classSessionId ? `<small>${escapeHtml(formState.errors.classSessionId)}</small>` : ''}
    </div>
  `
}

function renderFixedSlotContext(values, classSession, formState) {
  const dayLabel = getScheduleDayLabel(values.dayOfWeek)
  const timeLabel = [values.startTime, values.endTime].filter(Boolean).join('-')
  const slotLabel = classSession ? getScheduleClassSessionLabel(classSession) : values.classSessionLabel || ''

  return `
    <div class="schedule-fixed-slot-context span-full ${formState.errors.classSessionId ? 'has-error' : ''}">
      <strong>${escapeHtml(slotLabel || 'Chưa chọn ca học')}</strong>
      <span>${escapeHtml([dayLabel, timeLabel].filter(Boolean).join(' · ') || 'Chưa đủ thông tin ca')}</span>
      ${formState.errors.classSessionId ? `<small>${escapeHtml(formState.errors.classSessionId)}</small>` : ''}
    </div>
  `
}

function renderOrphanFixedSlotContext(values) {
  const dayLabel = getScheduleDayLabel(values.dayOfWeek)
  const timeLabel = [values.startTime, values.endTime].filter(Boolean).join('-')
  const title = repairScheduleDisplayText(values.title || values.groupName || 'Lịch cố định cũ')

  return `
    <div class="schedule-fixed-slot-context span-full has-error">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml([dayLabel, timeLabel].filter(Boolean).join(' · ') || 'Lịch cố định thiếu nguồn ca học')}</span>
      <small>Lịch cũ không còn trong Cài đặt cơ sở. Có thể cập nhật thông tin vận hành hoặc xóa lịch cũ.</small>
    </div>
  `
}

function renderScheduleOrphanWarning() {
  return `
    <div class="schedule-orphan-warning" role="status">
      Lịch cũ không còn trong Cài đặt cơ sở. Xóa sẽ xóa hẳn khỏi Thời khóa biểu.
    </div>
  `
}

function renderHiddenScheduleField(name, value) {
  return `<input type="hidden" name="${escapeAttribute(name)}" value="${escapeAttribute(value ?? '')}" data-schedule-form-field="${escapeAttribute(name)}" />`
}

function renderTeacherSelect(formState, teachers) {
  return renderSelectField(
    'teacherId',
    'Giáo viên thật',
    formState,
    [
      ['', 'Chưa phân công'],
      ...teachers.map((teacher) => [teacher.id, getTeacherOptionLabel(teacher)]),
    ],
  )
}

function renderStudentPicker(formState, students, teachers) {
  const selectedIds = new Set(normalizeIdArray(formState.values.studentIds))
  const selectedTeacherId = normalizeOptionalId(formState.values.teacherId)
  const sortedStudents = [...students].sort((firstStudent, secondStudent) => {
    const firstMatch = selectedTeacherId && firstStudent.assignedTeacherId === selectedTeacherId ? 0 : 1
    const secondMatch = selectedTeacherId && secondStudent.assignedTeacherId === selectedTeacherId ? 0 : 1
    return firstMatch - secondMatch || compareText(firstStudent.fullName, secondStudent.fullName)
  })
  const teacherLookup = createLookup(teachers)

  return `
    <details class="schedule-student-picker span-full ${formState.errors.studentIds ? 'has-error' : ''}" ${
      selectedIds.size ? 'open' : ''
    }>
      <summary data-schedule-action="toggle-student-picker" aria-expanded="${selectedIds.size ? 'true' : 'false'}">
        <span>
          <strong>Học viên tham gia</strong>
          <small>${selectedIds.size} học viên đã chọn</small>
        </span>
        <span>Chọn / chỉnh sửa</span>
      </summary>
      <p class="schedule-student-picker-note">
        Giai đoạn sau học viên sẽ được gán theo lớp/khung giờ; H7 vẫn giữ cách chọn thủ công hiện tại.
      </p>
      <div class="schedule-student-options" data-schedule-form-scroll-region="students">
        ${
          sortedStudents.length
            ? sortedStudents
                .map((student) =>
                  renderStudentOption(student, selectedIds, selectedTeacherId, teacherLookup),
                )
                .join('')
            : '<p>Chưa có học viên để chọn.</p>'
        }
      </div>
      ${formState.errors.studentIds ? `<small>${escapeHtml(formState.errors.studentIds)}</small>` : ''}
    </details>
  `
}

function renderStudentOption(student, selectedIds, selectedTeacherId, teacherLookup) {
  const assignedTeacher = student.assignedTeacherId
    ? teacherLookup.get(String(student.assignedTeacherId))
    : null
  const assignedTeacherName = assignedTeacher
    ? getTeacherDisplayName(assignedTeacher)
    : 'Chưa phân công giáo viên'
  const isSuggested = selectedTeacherId && student.assignedTeacherId === selectedTeacherId

  return `
    <label
      class="schedule-student-option ${isSuggested ? 'is-suggested' : ''} ${selectedIds.has(String(student.id)) ? 'is-selected' : ''}"
      data-schedule-student-option
    >
      <input
        type="checkbox"
        name="studentIds"
        value="${escapeAttribute(student.id)}"
        data-schedule-student-field
        ${selectedIds.has(String(student.id)) ? 'checked' : ''}
      />
      <span>
        <strong>${escapeHtml(student.fullName || 'Học viên')}</strong>
        <small>${escapeHtml(assignedTeacherName)}${isSuggested ? ' · Đúng GV phụ trách' : ''}</small>
      </span>
    </label>
  `
}

function renderField(name, label, formState, type, options = {}) {
  return `
    <label class="schedule-form-field ${options.className ?? ''} ${formState.errors[name] ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <input
        type="${type}"
        name="${escapeAttribute(name)}"
        value="${escapeAttribute(formState.values[name] ?? '')}"
        data-schedule-form-field="${escapeAttribute(name)}"
      />
      ${formState.errors[name] ? `<small>${escapeHtml(formState.errors[name])}</small>` : ''}
    </label>
  `
}

function renderCenterCalendarField(name, label, formState, type, options = {}) {
  return `
    <label class="schedule-form-field ${options.className ?? ''} ${formState.errors[name] ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <input
        type="${type}"
        name="${escapeAttribute(name)}"
        value="${escapeAttribute(formState.values[name] ?? '')}"
        data-center-calendar-form-field="${escapeAttribute(name)}"
      />
      ${formState.errors[name] ? `<small>${escapeHtml(formState.errors[name])}</small>` : ''}
    </label>
  `
}

function renderTextareaField(name, label, formState) {
  return `
    <label class="schedule-form-field span-full ${formState.errors[name] ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeAttribute(name)}" data-schedule-form-field="${escapeAttribute(name)}">${escapeHtml(formState.values[name] ?? '')}</textarea>
      ${formState.errors[name] ? `<small>${escapeHtml(formState.errors[name])}</small>` : ''}
    </label>
  `
}

function renderCenterCalendarTextareaField(name, label, formState) {
  return `
    <label class="schedule-form-field span-full ${formState.errors[name] ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeAttribute(name)}" data-center-calendar-form-field="${escapeAttribute(name)}">${escapeHtml(formState.values[name] ?? '')}</textarea>
      ${formState.errors[name] ? `<small>${escapeHtml(formState.errors[name])}</small>` : ''}
    </label>
  `
}

function renderSelectField(name, label, formState, options, className = '') {
  return `
    <label class="schedule-form-field ${className} ${formState.errors[name] ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <select name="${escapeAttribute(name)}" data-schedule-form-field="${escapeAttribute(name)}">
        ${options
          .map(([value, optionLabel]) => `
            <option value="${escapeAttribute(value)}" ${String(formState.values[name] ?? '') === String(value) ? 'selected' : ''}>
              ${escapeHtml(optionLabel)}
            </option>
          `)
          .join('')}
      </select>
      ${formState.errors[name] ? `<small>${escapeHtml(formState.errors[name])}</small>` : ''}
    </label>
  `
}

function renderCenterCalendarSelectField(name, label, formState, options, className = '') {
  return `
    <label class="schedule-form-field ${className} ${formState.errors[name] ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <select name="${escapeAttribute(name)}" data-center-calendar-form-field="${escapeAttribute(name)}">
        ${options
          .map(([value, optionLabel]) => `
            <option value="${escapeAttribute(value)}" ${String(formState.values[name] ?? '') === String(value) ? 'selected' : ''}>
              ${escapeHtml(optionLabel)}
            </option>
          `)
          .join('')}
      </select>
      ${formState.errors[name] ? `<small>${escapeHtml(formState.errors[name])}</small>` : ''}
    </label>
  `
}

function renderFormErrors(errors = {}) {
  const errorMessages = Object.values(errors).filter(Boolean)

  if (!errorMessages.length) {
    return ''
  }

  return `
    <div class="schedule-form-error" role="alert">
      ${errorMessages.map((message) => `<p>${escapeHtml(message)}</p>`).join('')}
    </div>
  `
}

function renderFormWarnings(conflicts) {
  if (!conflicts?.messages?.length) {
    return ''
  }

  return `
    <div class="schedule-form-warning" role="status">
      <strong>Cảnh báo trùng lịch</strong>
      <div class="schedule-conflict-list">
        ${conflicts.messages.slice(0, 4).map((message) => `<p>${escapeHtml(message)}</p>`).join('')}
      </div>
    </div>
  `
}

function renderStatCard(label, value) {
  return `
    <div class="schedule-stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `
}

function getScheduleStats(sessions, conflictMap = new Map()) {
  return {
    totalSessions: sessions.length,
    recurringSessions: sessions.filter((session) => normalizeScheduleType(session.scheduleType) === 'recurring').length,
    oneOffSessions: sessions.filter((session) => normalizeScheduleType(session.scheduleType) === 'oneOff').length,
    conflictSessions: conflictMap.size,
  }
}

function getScheduleWeekDays(weekStartDate) {
  return scheduleDays.map((day, index) => ({
    ...day,
    date: addDays(weekStartDate, index),
  }))
}

function getSessionsByOccurrenceDate(sessions, occurrenceDate) {
  return sessions.filter((session) => session.occurrenceDate === occurrenceDate)
}

function isRecurringSessionVisible(session, occurrenceDate) {
  const startDate = normalizeDateString(session.startDate)
  const endDate = normalizeDateString(session.endDate)

  if (startDate && occurrenceDate < startDate) {
    return false
  }

  if (endDate && occurrenceDate > endDate) {
    return false
  }

  return true
}

function getScheduleFormConflicts(formState, sessions, students, weekStartDate, teachers, classSessions = []) {
  const sessionId = formState.sessionId || '__schedule-draft__'
  const draftSession = buildScheduleSessionFromForm(
    formState.values,
    { id: sessionId, createdAt: new Date().toISOString() },
    teachers,
    classSessions,
  )
  const visibleExistingSessions = getVisibleScheduleSessions(
    sessions.filter((session) => session.id !== formState.sessionId),
    weekStartDate,
  )
  const visibleDraftSessions = getVisibleScheduleSessions([draftSession], weekStartDate)

  if (!visibleDraftSessions.length) {
    return null
  }

  const conflictMap = getScheduleConflicts(
    [...visibleExistingSessions, ...visibleDraftSessions],
    students,
  )

  return conflictMap.get(sessionId) ?? null
}

function hasComparableOverlap(firstSession, secondSession) {
  if (
    !firstSession?.id ||
    !secondSession?.id ||
    firstSession.id === secondSession.id ||
    firstSession.occurrenceDate !== secondSession.occurrenceDate
  ) {
    return false
  }

  const firstStart = parseTimeToMinutes(firstSession.startTime)
  const firstEnd = parseTimeToMinutes(firstSession.endTime)
  const secondStart = parseTimeToMinutes(secondSession.startTime)
  const secondEnd = parseTimeToMinutes(secondSession.endTime)

  if ([firstStart, firstEnd, secondStart, secondEnd].some((value) => value === null)) {
    return false
  }

  return firstStart < secondEnd && secondStart < firstEnd
}

function addScheduleConflict(conflictMap, session, conflictType, message) {
  const currentConflict = conflictMap.get(session.id) ?? {
    sessionId: session.id,
    conflictTypes: [],
    messages: [],
  }

  if (!currentConflict.conflictTypes.includes(conflictType)) {
    currentConflict.conflictTypes.push(conflictType)
  }

  if (!currentConflict.messages.includes(message)) {
    currentConflict.messages.push(message)
  }

  conflictMap.set(session.id, currentConflict)
}

function getSharedStudentIds(firstStudentIds, secondStudentIds) {
  const secondIds = new Set(normalizeIdArray(secondStudentIds))
  return normalizeIdArray(firstStudentIds).filter((studentId) => secondIds.has(studentId))
}

function getConflictStudentNames(studentIds, studentLookup) {
  return studentIds
    .map((studentId) => studentLookup.get(studentId)?.fullName || '')
    .filter(Boolean)
    .slice(0, 2)
    .join(', ')
}

function getConflictSummaryLabel(conflicts) {
  if (!conflicts?.conflictTypes?.length || conflicts.conflictTypes.length > 1) {
    return 'Trùng lịch'
  }

  const labels = {
    teacher: 'Trùng GV',
    room: 'Trùng phòng',
    student: 'Trùng HV',
  }

  return labels[conflicts.conflictTypes[0]] ?? 'Trùng lịch'
}

function normalizeRoomName(room) {
  return String(room ?? '').trim().toLowerCase()
}

function parseTimeToMinutes(value) {
  if (!isValidTime(value)) {
    return null
  }

  const [hours, minutes] = String(value).split(':').map(Number)
  return hours * 60 + minutes
}

function compareSessions(firstSession, secondSession) {
  return (
    String(firstSession.occurrenceDate ?? '').localeCompare(String(secondSession.occurrenceDate ?? '')) ||
    String(firstSession.startTime ?? '').localeCompare(String(secondSession.startTime ?? '')) ||
    compareText(firstSession.title, secondSession.title)
  )
}

function compareText(firstValue, secondValue) {
  return String(firstValue ?? '').localeCompare(String(secondValue ?? ''), 'vi', {
    sensitivity: 'base',
  })
}

function formatSessionTime(session) {
  const startTime = String(session.startTime || '').trim()
  const endTime = String(session.endTime || '').trim()
  return [startTime, endTime].filter(Boolean).join('-') || 'Chưa có giờ'
}

function formatTimeFromIsoDateTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function getDateFromIsoDateTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return formatDateInputValue(date)
}

function getDefaultCenterCalendarColorKey(itemType) {
  const normalizedType = CENTER_CALENDAR_ITEM_TYPES.includes(itemType) ? itemType : 'other'
  return CENTER_CALENDAR_ITEM_TYPE_DEFAULT_COLOR_KEYS[normalizedType] || 'yellow'
}

function formatWeekRange(weekStartDate) {
  return `${formatDisplayDate(weekStartDate)} - ${formatDisplayDate(addDays(weekStartDate, 6))}`
}

function formatDisplayDate(value) {
  const date = parseLocalDate(value)

  if (!date) {
    return ''
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatReportDate(value) {
  const day = scheduleDays.find((item) => item.id === getDayOfWeekFromDate(value))
  const displayDate = formatDisplayDate(value)

  return [day?.label, displayDate].filter(Boolean).join(', ')
}

function formatVietnameseReportDate(value) {
  const date = parseLocalDate(value)

  if (!date) {
    return 'Ngày học chưa xác định'
  }

  const weekdayLabels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
  return `${weekdayLabels[date.getDay()]}, ngày ${date.getDate()} tháng ${
    date.getMonth() + 1
  } năm ${date.getFullYear()}`
}

function getScheduleTypeBadgeLabel(session) {
  if (normalizeScheduleType(session.scheduleType) === 'recurring') {
    return 'Lịch cố định'
  }

  if (session.occurrenceReason === 'other') {
    return 'Buổi học khác'
  }

  const reason = scheduleOccurrenceReasons.find((item) => item.id === session.occurrenceReason)
  return reason?.shortLabel || 'Đột xuất'
}

function getDayOfWeekFromDate(value) {
  const date = parseLocalDate(value)

  if (!date) {
    return ''
  }

  const dayIndex = (date.getDay() + 6) % 7
  return scheduleDays[dayIndex]?.id ?? ''
}

function getTeacherOptionLabel(teacher) {
  const name = getTeacherDisplayName(teacher)
  const status = getTeacherStatusLabel(teacher.status)

  if (teacher.status === 'inactive') {
    return `${name} - ${status}`
  }

  return `${name} - ${status} - ${getTeacherTypeLabel(teacher.teacherType)}`
}

function getSessionTeacherLabel(session, teacher) {
  if (teacher) {
    return {
      name: getTeacherDisplayName(teacher),
      warning: teacher.status === 'inactive' ? 'Ngừng dạy' : '',
    }
  }

  if (session.teacherId && session.teacherName) {
    return {
      name: session.teacherName,
      warning: 'Không tìm thấy GV',
    }
  }

  if (session.teacherName) {
    return {
      name: session.teacherName,
      warning: '',
    }
  }

  return {
    name: 'Chưa phân công',
    warning: '',
  }
}

function getStudentSummary(studentIds = [], studentLookup) {
  const ids = normalizeIdArray(studentIds)

  if (!ids.length) {
    return {
      countLabel: '0 học viên',
      names: '',
    }
  }

  const students = ids.map((id) => studentLookup.get(id)).filter(Boolean)
  const names = students.map((student) => getShortName(student.fullName || 'Học viên'))
  const missingCount = ids.length - students.length
  const visibleNames = names.slice(0, 2).join(', ')
  const extraCount = Math.max(0, ids.length - 2)

  return {
    countLabel: `${ids.length} học viên`,
    names:
      visibleNames || missingCount
        ? `${visibleNames}${extraCount ? ` +${extraCount}` : ''}${missingCount && !visibleNames ? 'Không tìm thấy học viên' : ''}`
        : '',
  }
}

function getTeacherDisplayName(teacher) {
  return String(teacher?.displayName || teacher?.fullName || 'Giáo viên').trim()
}

function getTeacherStatusLabel(status) {
  const labels = {
    active: 'Đang dạy',
    paused: 'Tạm nghỉ',
    inactive: 'Ngừng dạy',
  }

  return labels[status] ?? 'Chưa cập nhật'
}

function getTeacherTypeLabel(teacherType) {
  const labels = {
    fulltime: 'Full-time',
    parttime: 'Part-time',
    collaborator: 'Cộng tác viên',
  }

  return labels[teacherType] ?? 'Full-time'
}

function getLevelLabel(level) {
  const levelLabels = {
    beginner: 'Cơ bản',
    intermediate: 'Trung cấp',
    advanced: 'Nâng cao',
    mixed: 'Tổng hợp',
  }

  return levelLabels[level] ?? 'Tổng hợp'
}

function getStatusLabel(status) {
  const statusLabels = {
    scheduled: 'Đã lên lịch',
    done: 'Đã học',
    cancelled: 'Đã hủy',
  }

  return statusLabels[status] ?? 'Đã lên lịch'
}

function getAttendanceStatusLabel(status) {
  return attendanceStatuses.find(([itemStatus]) => itemStatus === status)?.[1] ?? ''
}

function getStudentDisplayName(student) {
  return getShortStudentName(student?.fullName || student?.name || 'Học viên không xác định')
}

function formatAttendanceStudentName(attendanceItem, studentLookup) {
  const studentName = attendanceItem.isGuest
    ? getShortStudentName(attendanceItem.displayName)
    : getStudentDisplayName(studentLookup.get(attendanceItem.studentId))

  if (attendanceItem.attendanceStatus === 'makeup') {
    return `${studentName} (học bù)`
  }

  if (attendanceItem.attendanceStatus === 'trial') {
    return `${studentName} (học thử)`
  }

  return studentName
}

function getShortStudentName(fullName) {
  const nameParts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean)
  return nameParts.length > 2 ? nameParts.slice(-2).join(' ') : nameParts.join(' ')
}

function getShortName(fullName) {
  const nameParts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean)
  return nameParts.slice(-2).join(' ') || String(fullName || '').trim()
}

function createLookup(items = []) {
  return new Map(
    items
      .filter((item) => item && item.id)
      .map((item) => [String(item.id), item]),
  )
}

function normalizeScheduleType(value) {
  return scheduleTypes.includes(value) ? value : 'recurring'
}

function findScheduleClassSession(classSessions = [], classSessionId) {
  const targetId = normalizeOptionalId(classSessionId)

  if (!targetId) {
    return null
  }

  return (Array.isArray(classSessions) ? classSessions : []).find(
    (classSession) => String(classSession?.id ?? '') === targetId,
  ) ?? null
}

function getVisibleScheduleClassSessions(classSessions = [], selectedClassSessionId = '') {
  const selectedId = normalizeOptionalId(selectedClassSessionId)

  return (Array.isArray(classSessions) ? classSessions : [])
    .filter((classSession) => {
      const classSessionId = normalizeOptionalId(classSession?.id)
      return classSessionId && (classSession.status !== 'inactive' || classSessionId === selectedId)
    })
    .sort((firstClassSession, secondClassSession) =>
      compareText(getScheduleClassSessionLabel(firstClassSession), getScheduleClassSessionLabel(secondClassSession)),
    )
}

function getScheduleClassSessionIdSet(classSessions = []) {
  return new Set(
    getVisibleScheduleClassSessions(classSessions).map((classSession) => normalizeOptionalId(classSession.id)),
  )
}

function applyClassSessionToScheduleValues(values, classSession) {
  if (!classSession) {
    return values
  }

  const dayOfWeek = getScheduleDayFromClassSession(classSession) || values.dayOfWeek || 'monday'

  return {
    ...values,
    classSessionId: normalizeOptionalId(classSession.id),
    title: String(values.title ?? '').trim(),
    dayOfWeek,
    startTime: String(classSession.startTime ?? values.startTime ?? '').trim(),
    endTime: String(classSession.endTime ?? values.endTime ?? '').trim(),
    groupName: String(values.groupName ?? '').trim(),
    room: String(values.room ?? '').trim() || String(classSession.room || '').trim(),
    level: scheduleLevels.includes(classSession.level) ? classSession.level : values.level,
  }
}

function buildClassSessionScheduleSlot(classSession, assignment, dayOfWeek, occurrenceDate) {
  const classSessionId = normalizeOptionalId(classSession?.id)
  const hasAssignment = Boolean(assignment)
  const startTime = String(classSession?.startTime ?? assignment?.startTime ?? '').trim()
  const endTime = String(classSession?.endTime ?? assignment?.endTime ?? '').trim()
  const assignmentTitle = repairScheduleDisplayText(String(assignment?.title ?? '').trim())
  const assignmentGroupName = repairScheduleDisplayText(String(assignment?.groupName ?? '').trim())
  const classSessionLabel = getScheduleClassSessionLabel(classSession)

  return {
    ...(assignment || {}),
    id: hasAssignment ? assignment.id : `schedule-slot-${classSessionId}-${dayOfWeek}`,
    assignmentId: assignment?.id || '',
    classSessionId,
    classSessionLabel,
    isClassSessionSlot: true,
    isEmptyClassSessionSlot: !hasAssignment,
    scheduleType: 'recurring',
    title: hasAssignment ? assignmentTitle : '',
    dayOfWeek,
    startDate: assignment?.startDate || null,
    endDate: assignment?.endDate || null,
    date: null,
    occurrenceReason: '',
    startTime,
    endTime,
    room: String(classSession?.room ?? assignment?.room ?? '').trim(),
    teacherId: assignment?.teacherId || '',
    teacherName: assignment?.teacherName || '',
    studentIds: normalizeIdArray(assignment?.studentIds),
    groupName: hasAssignment ? assignmentGroupName : '',
    level: scheduleLevels.includes(assignment?.level)
      ? assignment.level
      : scheduleLevels.includes(classSession?.level)
        ? classSession.level
        : 'mixed',
    status: scheduleStatuses.includes(assignment?.status) ? assignment.status : 'scheduled',
    note: assignment?.note || '',
    occurrenceDate,
  }
}

function getScheduleDayFromClassSession(classSession) {
  return getScheduleDaysFromClassSession(classSession)[0] || ''
}

function getScheduleDaysFromClassSession(classSession) {
  const dayAliases = {
    mon: 'monday',
    monday: 'monday',
    t2: 'monday',
    tue: 'tuesday',
    tuesday: 'tuesday',
    t3: 'tuesday',
    wed: 'wednesday',
    wednesday: 'wednesday',
    t4: 'wednesday',
    thu: 'thursday',
    thursday: 'thursday',
    t5: 'thursday',
    fri: 'friday',
    friday: 'friday',
    t6: 'friday',
    sat: 'saturday',
    saturday: 'saturday',
    t7: 'saturday',
    sun: 'sunday',
    sunday: 'sunday',
    cn: 'sunday',
  }
  const explicitDays = Array.isArray(classSession?.daysOfWeek) ? classSession.daysOfWeek : []
  const labelDays = String(classSession?.daysLabel || classSession?.dayLabel || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)

  return [...explicitDays, ...labelDays]
    .map((day) => dayAliases[String(day).toLowerCase()] || '')
    .filter((day, index, days) => day && days.indexOf(day) === index)
}

function getScheduleClassSessionLabel(classSession) {
  return String(classSession?.displayLabel || classSession?.name || classSession?.daysLabel || 'Ca học').trim()
}

function getScheduleSessionTitleForDisplay(session, fallback = 'Buổi học mới') {
  return repairScheduleDisplayText(session?.title || session?.groupName || fallback) || fallback
}

function repairScheduleDisplayText(value) {
  const text = String(value ?? '').trim().normalize('NFC')

  if (!text) {
    return ''
  }

  if (isMojibakeNewLessonTitle(text)) {
    return 'Buổi học mới'
  }

  return text
}

function isMojibakeNewLessonTitle(text) {
  const lowerText = text.toLowerCase()
  const hasMojibakeMarker = [
    '\u00c3',
    '\u00c2',
    '\u0102',
    '\u00a1\u00c2',
    '\u00c2\u00bb',
    '\u00e2\u20ac',
    '\u00bb',
    '\u2022',
    '\u009d',
    '\u203a',
  ].some((marker) => text.includes(marker))

  return hasMojibakeMarker && lowerText.includes('bu') && lowerText.includes('h') && lowerText.includes('m')
}

function getScheduleDayLabel(dayOfWeek) {
  return scheduleDays.find((day) => day.id === dayOfWeek)?.label || ''
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeRoomText(value) {
  return normalizeSearchText(value).replace(/^phong\s+/, '').padStart(2, '0')
}

function normalizeOccurrenceReason(value) {
  return scheduleOccurrenceReasons.some((reason) => reason.id === value) ? value : 'other'
}

function normalizeOptionalId(value) {
  const id = String(value ?? '').trim()
  return id || null
}

function normalizeIdArray(values) {
  return Array.isArray(values)
    ? Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)))
    : []
}

function normalizeReportAttendance(attendance) {
  return (Array.isArray(attendance) ? attendance : [])
    .map((item) => ({
      studentId: String(item?.studentId ?? '').trim(),
      attendanceStatus: VALID_ATTENDANCE_STATUS_IDS.includes(item?.attendanceStatus)
        ? normalizeTeacherAttendanceStatus(item.attendanceStatus)
        : 'present',
      note: String(item?.note ?? ''),
    }))
    .filter((item) => item.studentId)
}

function normalizeTeacherLockAttendance(records = [], allowedStudentIds = []) {
  const allowedStudentSet = new Set(normalizeIdArray(allowedStudentIds))
  return (Array.isArray(records) ? records : [])
    .filter((record) =>
      record?.source === 'admin' &&
      allowedStudentSet.has(String(record.studentId || '')),
    )
    .map((record) => ({
      studentId: String(record.studentId || '').trim(),
      attendanceStatus: normalizeTeacherAttendanceStatus(record.attendanceStatus || record.status),
      note: String(record.note || ''),
    }))
    .filter((item) => item.studentId)
}

function normalizeTeacherCanonicalAttendance(records = [], allowedStudentIds = []) {
  const allowedStudentSet = new Set(normalizeIdArray(allowedStudentIds))
  return (Array.isArray(records) ? records : [])
    .filter((record) =>
      record?.source === 'teacher' &&
      allowedStudentSet.has(String(record.studentId || '')),
    )
    .map((record) => ({
      studentId: String(record.studentId || '').trim(),
      attendanceStatus: normalizeTeacherAttendanceStatus(record.attendanceStatus || record.status),
      note: String(record.note || ''),
    }))
    .filter((item) => item.studentId)
}

function normalizeTeacherAttendanceStatus(status) {
  const rawStatus = String(status || '').trim()
  return LEGACY_ATTENDANCE_STATUS_ALIASES[rawStatus] ||
    (attendanceStatuses.some(([itemStatus]) => itemStatus === rawStatus) ? rawStatus : 'present')
}

function normalizeReportLearningGroups(learningGroups, allowedStudentIds = null) {
  const allowedStudentSet = Array.isArray(allowedStudentIds)
    ? new Set(normalizeIdArray(allowedStudentIds))
    : null

  return (Array.isArray(learningGroups) ? learningGroups : [])
    .filter((group) => group && typeof group === 'object')
    .map((group, index) => ({
      id: String(group.id || `learning-group-${String(index + 1).padStart(3, '0')}`),
      title: String(group.title || ''),
      studentIds: normalizeIdArray(group.studentIds)
        .filter((studentId) => !allowedStudentSet || allowedStudentSet.has(studentId)),
      contentLines: normalizeContentLines(group.contentLines),
      note: String(group.note || ''),
    }))
}

function normalizeReportGuestParticipants(guestParticipants) {
  return (Array.isArray(guestParticipants) ? guestParticipants : [])
    .filter((guest) => guest && typeof guest === 'object')
    .map((guest, index) => {
      const participationType = VALID_GUEST_PARTICIPATION_TYPE_IDS.includes(guest.participationType)
        ? guest.participationType
        : 'trial'

      return {
        id: String(guest.id || `guest-${String(index + 1).padStart(3, '0')}`),
        displayName: String(guest.displayName || '').trim(),
        participationType,
        attendanceStatus: participationType,
        note: String(guest.note || '').trim(),
      }
    })
    .filter((guest) => guest.displayName)
}

function normalizeContentLines(contentLines) {
  return Array.isArray(contentLines)
    ? contentLines.map((line) => String(line ?? '').trim()).filter(Boolean)
    : []
}

function splitContentLines(contentText) {
  return String(contentText ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function formatTrelloLearningContent(learningGroups, studentLookup) {
  const groups = normalizeReportLearningGroups(learningGroups)

  if (!groups.length) {
    return 'Hiện tại chưa có'
  }

  return groups
    .map((group) => {
      const studentNames = normalizeIdArray(group.studentIds)
        .map((studentId) => getStudentDisplayName(studentLookup.get(studentId)))
      const heading = studentNames.length
        ? studentNames.join(', ')
        : group.title || 'Nhóm nội dung'
      const contentLines = normalizeContentLines(group.contentLines)
      const lines = contentLines.length
        ? contentLines.map((line) => `+ ${line}`)
        : ['+ Hiện tại chưa có']
      const noteLine = group.note ? [`+ Ghi chú: ${group.note}`] : []

      return [heading, ...lines, ...noteLine].join('\n\n')
    })
    .join('\n\n')
}

function normalizeMultilineReportText(value, uppercaseDefault = true) {
  const text = String(value ?? '').trim()

  if (text) {
    return text
  }

  return uppercaseDefault ? 'Hiện tại chưa có' : 'hiện tại chưa có'
}

function createSessionReportId(sessionId, occurrenceDate) {
  const safeSessionId = String(sessionId ?? '').replace(/[^a-zA-Z0-9_-]+/g, '-')
  return `report-${safeSessionId}-${occurrenceDate}`
}

function normalizeNullableDate(value) {
  return isValidDate(value) ? String(value) : null
}

function normalizeDateString(value) {
  return isValidDate(value) ? String(value) : ''
}

function isValidTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value ?? '').trim())
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) {
    return false
  }

  const date = parseLocalDate(value)
  return Boolean(date) && formatDateInputValue(date) === value
}

function toDateInputValue(value) {
  return value instanceof Date ? formatDateInputValue(value) : String(value ?? '').slice(0, 10)
}

function parseLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) {
    return null
  }

  const [year, month, day] = String(value).split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseDateTime(dateValue, timeValue) {
  const date = parseLocalDate(dateValue)

  if (!date || !isValidTime(timeValue)) {
    return null
  }

  const [hours, minutes] = String(timeValue).split(':').map(Number)
  date.setHours(hours, minutes, 0, 0)
  return date
}

function addDays(value, days) {
  const date = parseLocalDate(value)

  if (!date) {
    return ''
  }

  date.setDate(date.getDate() + days)
  return formatDateInputValue(date)
}

function formatDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function escapeAttribute(value) {
  return String(value).replace(/"/g, '&quot;')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
