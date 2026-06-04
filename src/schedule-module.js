import {
  scheduleDays,
  scheduleLevels,
  scheduleOccurrenceReasons,
  scheduleStatuses,
  scheduleTypes,
} from './schedule-data.js'

const DAY_INDEX_BY_ID = new Map(scheduleDays.map((day, index) => [day.id, index]))

export const emptyScheduleFormValues = {
  scheduleType: 'recurring',
  title: '',
  dayOfWeek: 'monday',
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

export function createEditScheduleFormState(session) {
  const scheduleType = normalizeScheduleType(session.scheduleType)

  return {
    mode: 'edit',
    sessionId: session.id,
    values: {
      scheduleType,
      title: session.title ?? '',
      dayOfWeek: session.dayOfWeek ?? 'monday',
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
  teachers = [],
  students = [],
  weekStartDate = getCurrentScheduleWeekStartDate(),
) {
  const normalizedWeekStart = normalizeDateString(weekStartDate) || getCurrentScheduleWeekStartDate()
  const weekDays = getScheduleWeekDays(normalizedWeekStart)
  const visibleSessions = getVisibleScheduleSessions(sessions, normalizedWeekStart)
  const teacherLookup = createLookup(teachers)
  const studentLookup = createLookup(students)
  const conflictMap = getScheduleConflicts(visibleSessions, students)
  const stats = getScheduleStats(visibleSessions, conflictMap)

  return `
    <section class="schedule-module ${formState ? 'form-open' : ''}" aria-label="Thời khóa biểu">
      <div class="schedule-compact-header">
        <div class="schedule-stats" aria-label="Tổng quan lịch tuần">
        ${renderStatCard('Buổi trong tuần', stats.totalSessions)}
        ${renderStatCard('Lịch cố định', stats.recurringSessions)}
        ${renderStatCard('Buổi đột xuất', stats.oneOffSessions)}
        ${renderStatCard('Cảnh báo trùng lịch', stats.conflictSessions)}
        </div>

        <div class="schedule-toolbar" aria-label="Điều hướng tuần">
          <button class="schedule-add-button" type="button" data-schedule-action="open-create">+ Thêm buổi học</button>
          <div class="schedule-week-controls">
          <button type="button" data-schedule-week-action="previous">&lt; Tuần trước</button>
          <button type="button" data-schedule-week-action="today">Tuần này</button>
          <button type="button" data-schedule-week-action="next">Tuần sau &gt;</button>
          </div>
          <strong class="schedule-week-label">${escapeHtml(formatWeekRange(normalizedWeekStart))}</strong>
        </div>
      </div>

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
              ),
            )
            .join('')}
        </div>
      </div>
      ${formState ? renderScheduleForm(formState, teachers, students, sessions, normalizedWeekStart) : ''}
    </section>
  `
}

export function validateScheduleForm(values) {
  const errors = {}
  const scheduleType = normalizeScheduleType(values.scheduleType)

  if (!String(values.title ?? '').trim()) {
    errors.title = 'Tên buổi/lớp là bắt buộc.'
  }

  if (!scheduleTypes.includes(scheduleType)) {
    errors.scheduleType = 'Loại lịch không hợp lệ.'
  }

  if (scheduleType === 'recurring') {
    if (!scheduleDays.some((day) => day.id === values.dayOfWeek)) {
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

  if (!isValidTime(values.startTime)) {
    errors.startTime = 'Giờ bắt đầu cần đúng định dạng HH:mm.'
  }

  if (!isValidTime(values.endTime)) {
    errors.endTime = 'Giờ kết thúc cần đúng định dạng HH:mm.'
  }

  if (isValidTime(values.startTime) && isValidTime(values.endTime) && values.endTime <= values.startTime) {
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

export function buildScheduleSessionFromForm(values, existingSession = null, teachers = []) {
  const now = new Date().toISOString()
  const scheduleType = normalizeScheduleType(values.scheduleType)
  const teacherId = normalizeOptionalId(values.teacherId)
  const teacher = teacherId ? teachers.find((item) => String(item.id) === teacherId) : null
  const teacherName = teacher
    ? getTeacherDisplayName(teacher)
    : String(values.teacherName ?? '').trim()
  const date = scheduleType === 'oneOff' ? String(values.date ?? '').trim() : null
  const dayOfWeek = scheduleType === 'oneOff'
    ? getDayOfWeekFromDate(date) || values.dayOfWeek || 'monday'
    : values.dayOfWeek

  return {
    id: existingSession?.id ?? `schedule-${Date.now()}`,
    scheduleType,
    title: String(values.title ?? '').trim(),
    dayOfWeek,
    startDate: scheduleType === 'recurring' ? normalizeNullableDate(values.startDate) : null,
    endDate: scheduleType === 'recurring' ? normalizeNullableDate(values.endDate) : null,
    date,
    occurrenceReason:
      scheduleType === 'oneOff'
        ? normalizeOccurrenceReason(values.occurrenceReason)
        : '',
    startTime: String(values.startTime ?? '').trim(),
    endTime: String(values.endTime ?? '').trim(),
    room: String(values.room ?? '').trim(),
    teacherId,
    teacherName,
    studentIds: normalizeIdArray(values.studentIds),
    groupName: String(values.groupName ?? '').trim(),
    level: scheduleLevels.includes(values.level) ? values.level : 'mixed',
    status: scheduleStatuses.includes(values.status) ? values.status : 'scheduled',
    note: String(values.note ?? '').trim(),
    createdAt: existingSession?.createdAt ?? now,
    updatedAt: now,
  }
}

export function getVisibleScheduleSessions(sessions = [], weekStartDate = getCurrentScheduleWeekStartDate()) {
  const normalizedWeekStart = normalizeDateString(weekStartDate) || getCurrentScheduleWeekStartDate()
  const weekDays = getScheduleWeekDays(normalizedWeekStart)
  const weekDateSet = new Set(weekDays.map((day) => day.date))

  return sessions
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
        },
      ]
    })
    .sort(compareSessions)
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

function renderDayColumn(day, sessions, teacherLookup, studentLookup, conflictMap) {
  return `
    <section class="schedule-day-column" aria-label="${escapeAttribute(`${day.label} ${formatDisplayDate(day.date)}`)}">
      <header class="schedule-day-header">
        <strong>${escapeHtml(day.label)}</strong>
        <span>${escapeHtml(formatDisplayDate(day.date))} · ${sessions.length} buổi</span>
      </header>
      <div class="schedule-day-sessions">
        ${
          sessions.length
            ? sessions.map((session) => renderSessionCard(session, teacherLookup, studentLookup, conflictMap)).join('')
            : '<div class="schedule-empty-day">Chưa có lịch</div>'
        }
      </div>
    </section>
  `
}

function renderSessionCard(session, teacherLookup, studentLookup, conflictMap) {
  const teacher = session.teacherId ? teacherLookup.get(String(session.teacherId)) : null
  const teacherLabel = getSessionTeacherLabel(session, teacher)
  const studentSummary = getStudentSummary(session.studentIds, studentLookup)
  const typeLabel = getScheduleTypeBadgeLabel(session)
  const conflicts = conflictMap.get(session.id)

  return `
    <article
      class="schedule-session-card is-${escapeAttribute(session.level)} is-${escapeAttribute(session.scheduleType)} ${conflicts ? 'has-conflict' : ''}"
      data-schedule-action="open-edit"
      data-schedule-session-id="${escapeAttribute(session.id)}"
      tabindex="0"
    >
      <div class="schedule-session-topline">
        <time class="schedule-session-time">${escapeHtml(formatSessionTime(session))}</time>
        <span class="schedule-type-badge is-${escapeAttribute(session.scheduleType)}">${escapeHtml(typeLabel)}</span>
      </div>
      <h4>${escapeHtml(session.title)}</h4>
      <p class="schedule-session-meta">
        ${escapeHtml(teacherLabel.name)} · ${escapeHtml(session.room || 'Chưa có phòng')}
      </p>
      <div class="schedule-session-tags">
        <span class="schedule-level-badge is-${escapeAttribute(session.level)}">${escapeHtml(getLevelLabel(session.level))}</span>
        <span>${escapeHtml(session.groupName || 'Nhóm mẫu')}</span>
        <span>${escapeHtml(getStatusLabel(session.status))}</span>
        <span class="schedule-student-count">${escapeHtml(studentSummary.countLabel)}</span>
        ${conflicts ? `<span class="schedule-conflict-badge">${escapeHtml(getConflictSummaryLabel(conflicts))}</span>` : ''}
        ${teacherLabel.warning ? `<span class="schedule-warning-badge">${escapeHtml(teacherLabel.warning)}</span>` : ''}
      </div>
      ${conflicts ? `<p class="schedule-conflict-note">${escapeHtml(conflicts.messages.slice(0, 2).join(' · '))}</p>` : ''}
      ${studentSummary.names ? `<p class="schedule-session-note">${escapeHtml(studentSummary.names)}</p>` : ''}
      ${session.note ? `<p class="schedule-session-note">${escapeHtml(session.note)}</p>` : ''}
    </article>
  `
}

function renderScheduleForm(formState, teachers, students, sessions, weekStartDate) {
  const isEdit = formState.mode === 'edit'
  const scheduleType = normalizeScheduleType(formState.values.scheduleType)
  const formConflicts = getScheduleFormConflicts(
    formState,
    sessions,
    students,
    weekStartDate,
    teachers,
  )

  return `
    <div class="schedule-form-backdrop" aria-hidden="true"></div>
    <form class="schedule-form-panel" data-schedule-form>
      <div class="schedule-form-header">
        <div>
          <h4>${isEdit ? 'Sửa buổi học' : 'Thêm buổi học'}</h4>
          <span>${isEdit ? 'Cập nhật rule lịch hoặc buổi đột xuất' : 'Tạo lịch cố định hoặc buổi đột xuất'}</span>
        </div>
        <button type="button" data-schedule-action="cancel-form" aria-label="Đóng form">×</button>
      </div>

      <div class="schedule-form-grid">
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
                scheduleOccurrenceReasons.map((reason) => [reason.id, reason.label]),
              )}
            `
            : `
              ${renderSelectField('dayOfWeek', 'Ngày trong tuần *', formState, scheduleDays.map((day) => [day.id, day.label]))}
              ${renderField('startDate', 'Từ ngày *', formState, 'date')}
              ${renderField('endDate', 'Đến ngày *', formState, 'date')}
            `
        }
        ${renderField('startTime', 'Giờ bắt đầu *', formState, 'time')}
        ${renderField('endTime', 'Giờ kết thúc *', formState, 'time')}
        ${renderField('room', 'Phòng *', formState, 'text')}
        ${renderTeacherSelect(formState, teachers)}
        ${renderField('teacherName', 'Tên giáo viên fallback', formState, 'text')}
        ${renderField('groupName', 'Nhóm/lớp', formState, 'text')}
        ${renderSelectField('level', 'Cấp độ', formState, scheduleLevels.map((level) => [level, getLevelLabel(level)]))}
        ${renderSelectField('status', 'Trạng thái', formState, scheduleStatuses.map((status) => [status, getStatusLabel(status)]))}
        ${renderStudentPicker(formState, students, teachers)}
        ${renderTextareaField('note', scheduleType === 'oneOff' ? 'Ghi chú / lý do chi tiết' : 'Ghi chú', formState)}
      </div>

      ${renderFormWarnings(formConflicts)}
      ${renderFormErrors(formState.errors)}

      <div class="schedule-form-actions">
        ${
          isEdit
            ? '<button class="schedule-danger-button" type="button" data-schedule-action="delete-session">Xóa buổi học</button>'
            : '<span></span>'
        }
        <div>
          <button type="button" data-schedule-action="cancel-form">Hủy</button>
          <button class="schedule-save-button" type="submit">Lưu buổi học</button>
        </div>
      </div>
    </form>
  `
}

function renderScheduleTypeToggle(formState) {
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
    <fieldset class="schedule-student-picker span-full ${formState.errors.studentIds ? 'has-error' : ''}">
      <legend>Học viên tham gia</legend>
      <div class="schedule-student-options">
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
    </fieldset>
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
    <label class="schedule-student-option ${isSuggested ? 'is-suggested' : ''}">
      <input
        type="checkbox"
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
        value="${escapeAttribute(formState.values[name] ?? '')}"
        data-schedule-form-field="${escapeAttribute(name)}"
      />
      ${formState.errors[name] ? `<small>${escapeHtml(formState.errors[name])}</small>` : ''}
    </label>
  `
}

function renderTextareaField(name, label, formState) {
  return `
    <label class="schedule-form-field span-full ${formState.errors[name] ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <textarea data-schedule-form-field="${escapeAttribute(name)}">${escapeHtml(formState.values[name] ?? '')}</textarea>
      ${formState.errors[name] ? `<small>${escapeHtml(formState.errors[name])}</small>` : ''}
    </label>
  `
}

function renderSelectField(name, label, formState, options, className = '') {
  return `
    <label class="schedule-form-field ${className} ${formState.errors[name] ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <select data-schedule-form-field="${escapeAttribute(name)}">
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

function getScheduleFormConflicts(formState, sessions, students, weekStartDate, teachers) {
  const sessionId = formState.sessionId || '__schedule-draft__'
  const draftSession = buildScheduleSessionFromForm(
    formState.values,
    { id: sessionId, createdAt: new Date().toISOString() },
    teachers,
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

function getScheduleTypeBadgeLabel(session) {
  if (normalizeScheduleType(session.scheduleType) === 'recurring') {
    return 'Lịch cố định'
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
