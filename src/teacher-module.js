import { teacherStatuses, teacherTypes } from './teacher-data.js'

export const initialTeacherFilters = {
  query: '',
  status: 'all',
  teacherType: 'all',
}

const teacherLevelOptions = ['preschool', 'beginner', 'intermediate', 'advanced']
const teacherModeOptions = ['group', 'oneOnOne', 'competition', 'online']
const teacherDayOptions = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const teacherTimeSlotOptions = ['morning', 'afternoon', 'evening', 'weekendMorning', 'weekendAfternoon']
const teacherAccountStatuses = ['not_invited', 'invited', 'active', 'paused', 'revoked']

const emptyTeacherFormValues = {
  fullName: '',
  displayName: '',
  phone: '',
  email: '',
  loginEmail: '',
  birthYear: '',
  hometown: '',
  currentArea: '',
  status: 'active',
  teacherType: 'fulltime',
  specialties: '',
  levels: [],
  teachingGroups: '',
  teachingModes: [],
  strengths: '',
  internalTags: '',
  availableDays: [],
  preferredTimeSlots: [],
  availableClassSessionIds: [],
  maxSessionsPerWeek: '',
  canTakeNewClass: true,
  scheduleNote: '',
  mainRole: 'Giáo viên cờ vua',
  note: '',
  accountStatus: 'not_invited',
  accountNotes: '',
}

export function createEmptyTeacherFormState() {
  return {
    mode: 'create',
    teacherId: null,
    values: {
      ...emptyTeacherFormValues,
      levels: [],
      teachingModes: [],
      availableDays: [],
      preferredTimeSlots: [],
      availableClassSessionIds: [],
    },
    errors: {},
  }
}

export function createEditTeacherFormState(teacher) {
  return {
    mode: 'edit',
    teacherId: teacher.id,
    values: {
      fullName: teacher.fullName ?? '',
      displayName: teacher.displayName ?? '',
      phone: teacher.phone ?? '',
      email: teacher.email ?? '',
      loginEmail: teacher.loginEmail ?? teacher.email ?? '',
      birthYear: teacher.birthYear ?? '',
      hometown: teacher.hometown ?? '',
      currentArea: teacher.currentArea ?? '',
      status: teacher.status ?? 'active',
      teacherType: teacher.teacherType ?? 'fulltime',
      specialties: (teacher.specialties ?? []).join(', '),
      levels: [...(teacher.levels ?? teacher.teachingLevels ?? [])],
      teachingGroups: (teacher.teachingGroups ?? []).join(', '),
      teachingModes: [...(teacher.teachingModes ?? [])],
      strengths: (teacher.strengths ?? []).join(', '),
      internalTags: (teacher.internalTags ?? []).join(', '),
      availableDays: [...(teacher.availableDays ?? [])],
      preferredTimeSlots: [...(teacher.preferredTimeSlots ?? [])],
      availableClassSessionIds: [...(teacher.availableClassSessionIds ?? [])],
      maxSessionsPerWeek: teacher.maxSessionsPerWeek ?? '',
      canTakeNewClass: teacher.canTakeNewClass ?? true,
      scheduleNote: teacher.scheduleNote ?? '',
      mainRole: teacher.mainRole ?? '',
      note: teacher.note ?? '',
      accountStatus: teacher.accountStatus ?? 'not_invited',
      accountNotes: teacher.accountNotes ?? '',
    },
    errors: {},
  }
}

export function validateTeacherForm(values) {
  const errors = {}
  const email = String(values.email ?? '').trim()
  const loginEmail = String(values.loginEmail ?? '').trim()
  const emailForLogin = loginEmail || email

  if (!String(values.fullName ?? '').trim()) {
    errors.fullName = 'Vui lòng nhập họ tên giáo viên.'
  }

  if (!String(values.displayName ?? '').trim()) {
    errors.displayName = 'Vui lòng nhập tên hiển thị.'
  }

  if (!String(values.phone ?? '').trim()) {
    errors.phone = 'Vui lòng nhập số điện thoại.'
  }

  if (email && !email.includes('@')) {
    errors.email = 'Email cần có ký tự @.'
  }

  if (loginEmail && !loginEmail.includes('@')) {
    errors.loginEmail = 'Email đăng nhập tương lai cần có ký tự @.'
  }

  if (emailForLogin && /^admin\./i.test(emailForLogin)) {
    errors.loginEmail = 'Giáo viên dùng email/Gmail thật, không dùng pattern admin.*.'
  }

  if (!teacherStatuses.includes(values.status)) {
    errors.status = 'Trạng thái giáo viên không hợp lệ.'
  }

  if (!teacherTypes.includes(values.teacherType)) {
    errors.teacherType = 'Hình thức giáo viên không hợp lệ.'
  }

  if (values.accountStatus && !teacherAccountStatuses.includes(values.accountStatus)) {
    errors.accountStatus = 'Trạng thái tài khoản giáo viên không hợp lệ.'
  }

  if (
    values.maxSessionsPerWeek !== '' &&
    values.maxSessionsPerWeek !== null &&
    values.maxSessionsPerWeek !== undefined &&
    (!Number.isFinite(Number(values.maxSessionsPerWeek)) || Number(values.maxSessionsPerWeek) < 0)
  ) {
    errors.maxSessionsPerWeek = 'Số buổi tối đa/tuần cần lớn hơn hoặc bằng 0.'
  }

  return errors
}

export function buildTeacherFromForm(values, existingTeacher = null) {
  const now = new Date().toISOString()

  return {
    ...existingTeacher,
    id: existingTeacher?.id ?? `teacher-${Date.now()}`,
    fullName: String(values.fullName ?? '').trim(),
    displayName: String(values.displayName ?? '').trim(),
    phone: String(values.phone ?? '').trim(),
    email: String(values.email ?? '').trim(),
    loginEmail: String(values.loginEmail || values.email || '').trim(),
    birthYear: String(values.birthYear ?? '').trim(),
    hometown: String(values.hometown ?? '').trim(),
    currentArea: String(values.currentArea ?? '').trim(),
    status: values.status,
    teacherType: values.teacherType,
    specialties: parseCommaSeparatedList(values.specialties),
    levels: normalizeLevels(values.levels),
    teachingGroups: parseCommaSeparatedList(values.teachingGroups),
    teachingModes: normalizeTeachingModes(values.teachingModes),
    strengths: parseCommaSeparatedList(values.strengths),
    internalTags: parseCommaSeparatedList(values.internalTags),
    availableDays: normalizeAvailableDays(values.availableDays),
    preferredTimeSlots: normalizePreferredTimeSlots(values.preferredTimeSlots),
    availableClassSessionIds: normalizeClassSessionIds(values.availableClassSessionIds),
    maxSessionsPerWeek: normalizeMaxSessionsPerWeek(values.maxSessionsPerWeek),
    canTakeNewClass: Boolean(values.canTakeNewClass),
    acceptNewStudents: Boolean(values.canTakeNewClass),
    scheduleNote: String(values.scheduleNote ?? '').trim(),
    mainRole: String(values.mainRole ?? '').trim(),
    note: String(values.note ?? '').trim(),
    accountStatus: teacherAccountStatuses.includes(values.accountStatus)
      ? values.accountStatus
      : existingTeacher?.accountStatus || 'not_invited',
    accountLinkedAt: existingTeacher?.accountLinkedAt || null,
    accountUserId: existingTeacher?.accountUserId || '',
    accountNotes: String(values.accountNotes ?? '').trim(),
    assignedClassNames: Array.isArray(existingTeacher?.assignedClassNames)
      ? [...existingTeacher.assignedClassNames]
      : [],
    assignedStudentIds: Array.isArray(existingTeacher?.assignedStudentIds)
      ? [...existingTeacher.assignedStudentIds]
      : [],
    currentStudentCount: Number.isFinite(Number(existingTeacher?.currentStudentCount))
      ? Math.max(0, Number(existingTeacher.currentStudentCount))
      : 0,
    createdAt: existingTeacher?.createdAt ?? now,
    updatedAt: now,
  }
}

export function buildTeacherStudentLinks({ teacher, students = [], schedules = [] }) {
  const teacherId = normalizeId(teacher?.id)
  const studentLookup = createStudentLookup(students)
  const linkLookup = new Map()

  if (!teacherId) {
    return createTeacherStudentLinkSummary([])
  }

  ;(students ?? []).forEach((student) => {
    if (isDeletedStudent(student)) {
      return
    }

    const studentId = normalizeId(student?.id)

    if (!studentId || normalizeId(student?.assignedTeacherId) !== teacherId) {
      return
    }

    const link = ensureTeacherStudentLink(linkLookup, studentId, student)
    link.isPrimary = true
  })

  ;(schedules ?? []).forEach((schedule) => {
    if (normalizeId(schedule?.teacherId) !== teacherId || !Array.isArray(schedule?.studentIds)) {
      return
    }

    Array.from(new Set(schedule.studentIds.map(normalizeId))).forEach((studentId) => {
      const student = studentLookup.get(studentId)

      if (!studentId || !student || isDeletedStudent(student)) {
        return
      }

      const link = ensureTeacherStudentLink(linkLookup, studentId, student)
      const scheduleTitle = getScheduleTitle(schedule)

      link.isScheduled = true
      link.scheduleCount += 1

      if (scheduleTitle && !link.scheduleTitles.includes(scheduleTitle)) {
        link.scheduleTitles.push(scheduleTitle)
      }
    })
  })

  const assignedStudentIds = Array.isArray(teacher?.assignedStudentIds)
    ? Array.from(new Set(teacher.assignedStudentIds.map(normalizeId))).filter(Boolean)
    : []

  assignedStudentIds.forEach((studentId) => {
    const student = studentLookup.get(studentId)

    if (!student || isDeletedStudent(student)) {
      return
    }

    const link = ensureTeacherStudentLink(linkLookup, studentId, student)
    link.isPrimary = true
  })

  const fallbackTotal = Number.isFinite(Number(teacher?.currentStudentCount))
    ? Math.max(0, Number(teacher.currentStudentCount))
    : assignedStudentIds.length

  return createTeacherStudentLinkSummary([...linkLookup.values()], fallbackTotal)
}

export function buildTeacherStudentLinkMap(teachers = [], students = [], schedules = []) {
  return new Map(
    (teachers ?? []).map((teacher) => [
      normalizeId(teacher?.id),
      buildTeacherStudentLinks({ teacher, students, schedules }),
    ]),
  )
}

export function renderTeacherModule(
  teachers,
  filters = initialTeacherFilters,
  formState = null,
  selectedTeacherId = null,
  students = [],
  schedules = [],
  classSessions = [],
  sessionReports = [],
) {
  const activeFilters = { ...initialTeacherFilters, ...filters }
  const filteredTeachers = getFilteredTeachers(teachers, activeFilters)
  const stats = getTeacherStats(teachers)
  const selectedTeacher = teachers.find((teacher) => teacher.id === selectedTeacherId)
  const teacherStudentLinkMap = buildTeacherStudentLinkMap(teachers, students, schedules)

  return `
    <section class="teacher-module ${formState || selectedTeacher ? 'panel-open' : ''}" aria-label="Giáo viên">
      <div class="teacher-main-topbar">
        <div class="teacher-stats" aria-label="Tổng quan giáo viên">
          ${renderTeacherStat('Tổng giáo viên', stats.totalTeachers, 'neutral')}
          ${renderTeacherStat('Đang dạy', stats.activeTeachers, 'active')}
          ${renderTeacherStat('Tạm nghỉ', stats.pausedTeachers, 'warning')}
          ${renderTeacherStat('Cộng tác viên', stats.collaboratorTeachers, 'collaborator')}
        </div>
        <button class="teacher-add-button" type="button" data-teacher-action="open-create">
          + Thêm giáo viên
        </button>
      </div>

      <section class="teacher-list-section" aria-label="Danh sách giáo viên">
        <div class="teacher-list-filters" aria-label="Tìm kiếm và lọc giáo viên">
          <label class="teacher-search-field">
            <span>Tìm kiếm</span>
            <input
              type="search"
              value="${escapeAttribute(activeFilters.query)}"
              placeholder="Tên, biệt danh, điện thoại, email, chuyên môn"
              data-teacher-filter="query"
            />
          </label>
          <label>
            <span>Trạng thái</span>
            <select data-teacher-filter="status">
              ${renderOption('all', 'Tất cả trạng thái', activeFilters.status)}
              ${teacherStatuses
                .map((status) => renderOption(status, getTeacherStatusLabel(status), activeFilters.status))
                .join('')}
            </select>
          </label>
          <label>
            <span>Hình thức</span>
            <select data-teacher-filter="teacherType">
              ${renderOption('all', 'Tất cả hình thức', activeFilters.teacherType)}
              ${teacherTypes
                .map((teacherType) =>
                  renderOption(teacherType, getTeacherTypeLabel(teacherType), activeFilters.teacherType),
                )
                .join('')}
            </select>
          </label>
        </div>
        ${
          filteredTeachers.length
            ? `
              <div class="teacher-table-wrap">
                <table class="teacher-table">
                  <thead>
                    <tr>
                      <th>Giáo viên</th>
                      <th>Liên hệ</th>
                      <th>Trạng thái</th>
                      <th>Hình thức</th>
                      <th>Lớp dạy phù hợp</th>
                      <th>Các lớp phụ trách</th>
                      <th>Tổng học viên</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredTeachers
                      .map((teacher) => renderTeacherRow(teacher, teacherStudentLinkMap.get(normalizeId(teacher.id))))
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
            : '<div class="teacher-empty">Không tìm thấy giáo viên phù hợp.</div>'
        }
      </section>
      ${selectedTeacher
        ? renderTeacherProfile(
            selectedTeacher,
            teacherStudentLinkMap.get(normalizeId(selectedTeacher.id)),
            classSessions,
            schedules,
            students,
            sessionReports,
          )
        : ''}
      ${formState ? renderTeacherForm(formState, classSessions) : ''}
    </section>
  `
}

export function getFilteredTeachers(teachers, filters = initialTeacherFilters) {
  const activeFilters = { ...initialTeacherFilters, ...filters }
  const normalizedQuery = normalizeText(activeFilters.query)
  const statusOrder = { active: 0, paused: 1, inactive: 2 }

  return [...(teachers ?? [])]
    .filter((teacher) => {
      const matchesStatus =
        activeFilters.status === 'all' || teacher.status === activeFilters.status
      const matchesType =
        activeFilters.teacherType === 'all' || teacher.teacherType === activeFilters.teacherType
      const matchesQuery =
        !normalizedQuery ||
        [
          teacher.fullName,
          teacher.displayName,
          teacher.phone,
          teacher.email,
          teacher.mainRole,
          teacher.note,
          ...(teacher.specialties ?? []),
          ...(teacher.levels ?? []),
          ...(teacher.levels ?? []).map(getTeacherLevelLabel),
          ...(teacher.teachingGroups ?? []),
          ...(teacher.assignedClassNames ?? []),
          ...(teacher.strengths ?? []),
          ...(teacher.internalTags ?? []),
          ...(teacher.availableDays ?? []),
          ...(teacher.availableDays ?? []).map(getTeacherDayLabel),
          ...(teacher.preferredTimeSlots ?? []),
          ...(teacher.preferredTimeSlots ?? []).map(getTeacherTimeSlotLabel),
          teacher.scheduleNote,
        ].some((value) => normalizeText(value).includes(normalizedQuery))

      return matchesStatus && matchesType && matchesQuery
    })
    .sort((firstTeacher, secondTeacher) => {
      const statusCompare =
        (statusOrder[firstTeacher.status] ?? 99) - (statusOrder[secondTeacher.status] ?? 99)

      if (statusCompare !== 0) {
        return statusCompare
      }

      return String(firstTeacher.fullName ?? '').localeCompare(
        String(secondTeacher.fullName ?? ''),
        'vi',
      )
    })
}

export function getTeacherStats(teachers) {
  return (teachers ?? []).reduce(
    (stats, teacher) => {
      stats.totalTeachers += 1

      if (teacher.status === 'active') {
        stats.activeTeachers += 1
      }

      if (teacher.status === 'paused') {
        stats.pausedTeachers += 1
      }

      if (teacher.teacherType === 'collaborator') {
        stats.collaboratorTeachers += 1
      }

      return stats
    },
    {
      totalTeachers: 0,
      activeTeachers: 0,
      pausedTeachers: 0,
      collaboratorTeachers: 0,
    },
  )
}

function renderTeacherRow(teacher, studentLinks = createTeacherStudentLinkSummary([])) {
  const totalStudents = getTeacherVisibleStudentCount(teacher, studentLinks)

  return `
    <tr class="teacher-row" data-teacher-action="open-profile" data-teacher-id="${escapeAttribute(teacher.id)}">
      <td title="${escapeAttribute(teacher.fullName)}">
        <button class="teacher-name-button" type="button" data-teacher-action="open-profile" data-teacher-id="${escapeAttribute(teacher.id)}">
          <span class="teacher-avatar-initials" aria-hidden="true">${escapeHtml(getTeacherInitials(teacher.fullName))}</span>
          <span class="teacher-name-copy">
            <strong>${escapeHtml(teacher.fullName || 'Giáo viên')}</strong>
            <span>${escapeHtml(teacher.displayName || teacher.id || '')}</span>
          </span>
        </button>
      </td>
      <td>
        <span title="${escapeAttribute(teacher.phone)}">${escapeHtml(teacher.phone || '-')}</span>
        <span title="${escapeAttribute(teacher.email)}">${escapeHtml(teacher.email || '-')}</span>
        <span class="teacher-account-readiness">${escapeHtml(getTeacherAccountStatusLabel(teacher.accountStatus))}</span>
      </td>
      <td>
        <span class="teacher-status-badge is-${escapeAttribute(teacher.status)}">
          ${escapeHtml(getTeacherStatusLabel(teacher.status))}
        </span>
      </td>
      <td>
        <span class="teacher-type-badge is-${escapeAttribute(teacher.teacherType)}">
          ${escapeHtml(getTeacherTypeLabel(teacher.teacherType))}
        </span>
      </td>
      <td>${renderTeacherChips((teacher.levels ?? []).map(getTeacherLevelLabel))}</td>
      <td>${renderTeacherClassSummary(teacher, studentLinks)}</td>
      <td>
        <span class="teacher-student-count" title="${escapeAttribute(getTeacherStudentCountTitle(studentLinks))}">
          <strong>${Number(totalStudents || 0).toLocaleString('vi-VN')}</strong>
          <span>học viên</span>
        </span>
      </td>
    </tr>
  `
}

function renderTeacherProfile(
  teacher,
  studentLinks = createTeacherStudentLinkSummary([]),
  classSessions = [],
  schedules = [],
  students = [],
  sessionReports = [],
) {
  return `
    <div class="teacher-profile-backdrop" role="presentation">
      <section class="teacher-profile-panel" aria-label="Hồ sơ giáo viên">
        <div class="teacher-profile-header">
          <div class="teacher-profile-title teacher-profile-title-compact">
            <h4>${escapeHtml(teacher.fullName || 'Giáo viên')}</h4>
            <span>${escapeHtml(teacher.displayName || '-')}</span>
            <div class="teacher-profile-badges">
              <span class="teacher-status-badge is-${escapeAttribute(teacher.status)}">${escapeHtml(getTeacherStatusLabel(teacher.status))}</span>
              <span class="teacher-type-badge is-${escapeAttribute(teacher.teacherType)}">${escapeHtml(getTeacherTypeLabel(teacher.teacherType))}</span>
            </div>
          </div>
          <div class="teacher-profile-actions">
            <button type="button" data-teacher-action="edit-from-profile" data-teacher-id="${escapeAttribute(teacher.id)}">Sửa</button>
            ${
              teacher.status === 'inactive'
                ? '<span class="teacher-profile-stopped">Đã ngừng dạy</span>'
                : `<button class="teacher-profile-danger-button" type="button" data-teacher-action="stop-teaching" data-teacher-id="${escapeAttribute(teacher.id)}">Ngừng dạy</button>`
            }
            <button type="button" data-teacher-action="close-profile">Đóng</button>
          </div>
        </div>
        <div class="teacher-profile-grid teacher-profile-two-pane">
          ${renderTeacherInfoPane(teacher, classSessions)}
          ${renderTeacherTeachingUpdatePane(teacher, studentLinks, schedules, students, sessionReports)}
        </div>
      </section>
    </div>
  `
}

function renderTeacherInfoPane(teacher, classSessions = []) {
  return `
    <section class="teacher-profile-pane teacher-profile-info-pane" aria-label="Thông tin giáo viên">
      <div class="teacher-profile-pane-heading">
        <h5>Thông tin giáo viên</h5>
        <span>${escapeHtml(getTeacherTypeLabel(teacher.teacherType))}</span>
      </div>
      ${renderProfileSection('Tổng quan', [
        ['Họ tên đầy đủ', teacher.fullName],
        ['Tên hiển thị', teacher.displayName],
        ['Trạng thái', getTeacherStatusLabel(teacher.status)],
        ['Hình thức', getTeacherTypeLabel(teacher.teacherType)],
      ])}
      ${renderProfileSection('Liên hệ', [
        ['Số điện thoại', teacher.phone],
        ['Email', teacher.email],
        ['Email đăng nhập tương lai', teacher.loginEmail || teacher.email],
      ])}
      ${renderProfileSection('Thông tin cá nhân', [
        ['Năm sinh', teacher.birthYear],
        ['Quê quán', teacher.hometown],
        ['Khu vực hiện tại', teacher.currentArea],
      ])}
      ${renderTeacherAccountReadinessProfile(teacher)}
      <section class="teacher-profile-section">
        <h5>Giảng dạy</h5>
        ${renderProfileTagGroup('Lớp dạy phù hợp', (teacher.levels ?? []).map(getTeacherLevelLabel), 'Chưa cập nhật')}
        ${renderProfileTagGroup('Hình thức dạy phù hợp', (teacher.teachingModes ?? []).map(getTeacherModeLabel), 'Chưa cập nhật')}
      </section>
      ${renderTeacherAvailabilityProfile(teacher, classSessions)}
    </section>
  `
}

function renderTeacherTeachingUpdatePane(
  teacher,
  studentLinks = createTeacherStudentLinkSummary([]),
  schedules = [],
  students = [],
  sessionReports = [],
) {
  return `
    <section class="teacher-profile-pane teacher-teaching-update-pane" aria-label="Cập nhật tình hình giảng dạy">
      <div class="teacher-profile-pane-heading">
        <h5>Cập nhật tình hình giảng dạy</h5>
        <span>${Number(studentLinks.total || 0).toLocaleString('vi-VN')} học viên liên quan</span>
      </div>
      ${renderTeacherPortalShell(teacher, schedules, students, sessionReports)}
      ${renderTeacherStudentUpdateSummary(teacher, studentLinks)}
      ${
        studentLinks.students.length
          ? `
            <div class="teacher-update-table-wrap">
              <table class="teacher-update-table">
                <thead>
                  <tr>
                    <th>Tên học viên</th>
                    <th>Trình độ hiện tại</th>
                    <th>Điểm bài kiểm tra gần nhất</th>
                    <th>Nhận xét từ giáo viên</th>
                    <th>Kế hoạch giảng dạy tiếp theo</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  ${studentLinks.students.map(renderTeacherStudentUpdateRow).join('')}
                </tbody>
              </table>
            </div>
          `
          : '<div class="teacher-student-empty">Chưa có học viên liên quan.</div>'
      }
    </section>
  `
}

function renderTeacherStudentUpdateSummary(teacher, studentLinks = createTeacherStudentLinkSummary([])) {
  const inactiveWarning =
    teacher.status === 'inactive' && studentLinks.total
      ? '<p class="teacher-student-warning">Giáo viên đã ngừng dạy nhưng vẫn còn học viên/lịch liên kết.</p>'
      : ''

  return `
    <div class="teacher-student-summary" aria-label="Tổng hợp học viên của giáo viên">
      ${renderTeacherStudentSummaryItem('Tổng', studentLinks.total)}
      ${renderTeacherStudentSummaryItem('Phụ trách chính', studentLinks.primaryCount)}
      ${renderTeacherStudentSummaryItem('Có trong lịch', studentLinks.scheduledCount)}
      ${renderTeacherStudentSummaryItem('Cả hai', studentLinks.bothCount)}
    </div>
    ${inactiveWarning}
  `
}

function renderTeacherPortalShell(teacher, schedules = [], students = [], sessionReports = []) {
  const teacherSessions = getTeacherScheduleSessions(teacher, schedules)
  const scheduleAudit = buildTeacherPortalScheduleAudit(teacher, schedules)
  const summary = buildTeacherPortalSummary(teacher, teacherSessions, sessionReports)

  return `
    <details class="teacher-portal-shell" id="teacher-portal-shell-${escapeAttribute(teacher.id)}">
      <summary data-teacher-action="open-teacher-portal" data-teacher-id="${escapeAttribute(teacher.id)}" aria-expanded="false">
        <span>Mở Teacher Portal</span>
        <small>Lịch dạy của tôi</small>
      </summary>
      <section class="teacher-portal-preview" aria-label="Bản xem trước Teacher Portal">
        <header class="teacher-portal-header">
          <div>
            <strong>${escapeHtml(getTeacherDisplayName(teacher))}</strong>
            <span>${escapeHtml(teacher.displayName || teacher.loginEmail || teacher.email || '')}</span>
          </div>
          <div class="teacher-portal-header-meta">
            <span>${escapeHtml(teacher.loginEmail || teacher.email || 'Chưa có email đăng nhập')}</span>
            <span>${escapeHtml(getTeacherStatusLabel(teacher.status))}</span>
            <span>${escapeHtml(getTeacherAccountStatusLabel(teacher.accountStatus))}</span>
          </div>
        </header>
        <p class="teacher-portal-preview-note">
          Đây là bản xem trước Teacher Portal. Tài khoản đăng nhập giáo viên sẽ được bật ở phase sau.
        </p>
        <div class="teacher-portal-summary" aria-label="Tổng quan lịch dạy của tôi">
          ${renderTeacherPortalSummaryCard('Ca sắp tới', summary.upcoming)}
          ${renderTeacherPortalSummaryCard('Ca hôm nay', summary.today)}
          ${renderTeacherPortalSummaryCard('Ca đã dạy', summary.past)}
          ${renderTeacherPortalSummaryCard('Chưa báo cáo', summary.missingReport)}
        </div>
        <section class="teacher-my-schedule" aria-label="Lịch dạy của tôi">
          <div class="teacher-my-schedule-heading">
            <h5>Lịch dạy của tôi</h5>
            <span>${Number(teacherSessions.length || 0).toLocaleString('vi-VN')} ca</span>
          </div>
          ${renderTeacherScheduleAuditNotice(scheduleAudit)}
          ${
            teacherSessions.length
              ? `<div class="teacher-my-schedule-list">${teacherSessions
                  .map((session) => renderTeacherScheduleSessionCard(session, teacher, students))
                  .join('')}</div>`
              : '<div class="teacher-my-schedule-empty">Chưa có ca dạy nào được gắn với giáo viên này.</div>'
          }
        </section>
      </section>
    </details>
  `
}

function renderTeacherPortalSummaryCard(label, value) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${Number(value || 0).toLocaleString('vi-VN')}</strong>
    </article>
  `
}

function renderTeacherScheduleSessionCard(session, teacher, students = []) {
  const display = getTeacherScheduleSessionDisplay(session)
  const studentList = getScheduleSessionStudents(session, students)
  const warnings = getTeacherScheduleSessionWarnings(session, studentList)
  const roomLabel = getScheduleSessionLocationLabel(session)

  return `
    <article class="teacher-my-schedule-card">
      <div class="teacher-my-schedule-main">
        <time>${escapeHtml(display.dateLabel)}</time>
        <strong>${escapeHtml(getScheduleTitle(session) || 'Ca dạy')}</strong>
        <span>${escapeHtml(display.timeLabel)} · ${escapeHtml(roomLabel)}</span>
      </div>
      <div class="teacher-my-schedule-meta">
        <span>${Number(studentList.length || 0).toLocaleString('vi-VN')} học viên</span>
        <span>${escapeHtml(display.statusLabel)}</span>
      </div>
      ${warnings.length ? renderTeacherScheduleWarnings(warnings) : ''}
      <details class="teacher-session-detail">
        <summary>Xem ca dạy</summary>
        <div>
          ${renderProfileRows([
            ['Tên ca', getScheduleTitle(session) || 'Ca dạy'],
            ['Thời gian', `${display.dateLabel} · ${display.timeLabel}`],
            ['Địa điểm/phòng', roomLabel],
            ['Giáo viên', getTeacherDisplayName(teacher)],
          ])}
          ${renderProfileTagGroup(
            'Học viên',
            studentList.map((student) => getStudentDisplayName(student, student.id)),
            'Chưa có danh sách học viên',
          )}
          <p>Điểm danh và báo cáo ca dạy sẽ được chuyển vào Teacher Portal ở phase sau.</p>
          <div class="teacher-session-detail-extra">
            ${renderProfileRows([
              ['Trạng thái', display.statusLabel],
              ['Ghi chú', getTeacherScheduleSessionNote(session)],
            ])}
          </div>
          ${warnings.length ? renderTeacherScheduleWarnings(warnings) : ''}
          <p>Chi tiết ca chỉ đọc trong C8.3. Check-in, check-out, ảnh, điểm danh và báo cáo ca dạy sẽ được bật ở phase sau.</p>
        </div>
      </details>
    </article>
  `
}

export function getTeacherScheduleSessions(teacher, scheduleSessions = []) {
  return (Array.isArray(scheduleSessions) ? scheduleSessions : [])
    .filter((session) => isScheduleSessionAssignedToTeacher(session, teacher))
    .sort(compareTeacherScheduleSessions)
}

export function isScheduleSessionAssignedToTeacher(session, teacher) {
  const sessionTeacherId = normalizeId(session?.teacherId)
  const teacherId = normalizeId(teacher?.id)

  if (sessionTeacherId && teacherId) {
    return sessionTeacherId === teacherId
  }

  return false
}

export function buildTeacherPortalScheduleAudit(teacher, scheduleSessions = []) {
  const sessions = Array.isArray(scheduleSessions) ? scheduleSessions : []
  const teacherId = normalizeId(teacher?.id)

  return sessions.reduce(
    (audit, session) => {
      const sessionTeacherId = normalizeId(session?.teacherId)

      if (teacherId && sessionTeacherId === teacherId) {
        audit.assignedByTeacherId += 1
      } else if (!sessionTeacherId && isLegacyTeacherNameCandidate(session, teacher)) {
        audit.legacyNameOnlyCandidates += 1
      } else if (!sessionTeacherId) {
        audit.missingTeacherId += 1
      }

      return audit
    },
    {
      teacherId,
      assignedByTeacherId: 0,
      legacyNameOnlyCandidates: 0,
      missingTeacherId: 0,
    },
  )
}

function isLegacyTeacherNameCandidate(session, teacher) {
  const sessionTeacherName = normalizeText(session?.teacherName)
  const teacherNames = [
    teacher?.name,
    teacher?.fullName,
    teacher?.displayName,
  ].map(normalizeText).filter(Boolean)

  return Boolean(sessionTeacherName && teacherNames.includes(sessionTeacherName))
}

function renderTeacherScheduleAuditNotice(audit) {
  if (!audit?.legacyNameOnlyCandidates && !audit?.missingTeacherId) {
    return ''
  }

  const messages = []

  if (audit.legacyNameOnlyCandidates) {
    messages.push(
      `${Number(audit.legacyNameOnlyCandidates).toLocaleString('vi-VN')} ca legacy chỉ có tên giáo viên nên chưa tự đưa vào lịch của tôi.`,
    )
  }

  if (audit.missingTeacherId) {
    messages.push(
      `${Number(audit.missingTeacherId).toLocaleString('vi-VN')} ca thiếu teacherId cần kiểm tra dữ liệu lịch.`,
    )
  }

  return `
    <div class="teacher-my-schedule-notice" role="status">
      ${messages.map((message) => `<span>${escapeHtml(message)}</span>`).join('')}
    </div>
  `
}

function getTeacherScheduleSessionWarnings(session, studentList = []) {
  const warnings = []

  if (!normalizeId(session?.teacherId)) {
    warnings.push('Ca thiếu teacherId.')
  }

  if (!Array.isArray(session?.studentIds) || !session.studentIds.length) {
    warnings.push('Ca chưa có danh sách học viên.')
  } else if (studentList.length < session.studentIds.length) {
    warnings.push('Một số học viên trong ca chưa tìm thấy trong hồ sơ học viên.')
  }

  if (!String(session?.startTime || '').trim() || !String(session?.endTime || '').trim()) {
    warnings.push('Ca thiếu giờ bắt đầu hoặc kết thúc.')
  }

  return warnings
}

function renderTeacherScheduleWarnings(warnings = []) {
  return `
    <div class="teacher-session-warnings" role="status">
      ${warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join('')}
    </div>
  `
}

function getTeacherScheduleSessionNote(session) {
  return String(
    session?.note ||
      session?.notes ||
      session?.reason ||
      session?.description ||
      'Chưa có ghi chú',
  ).trim()
}

export function buildTeacherPortalSummary(teacher, sessions = [], sessionReports = []) {
  const todayKey = getDateKey(new Date())

  return sessions.reduce(
    (summary, session) => {
      const status = getTeacherScheduleSessionStatus(session, todayKey)

      if (status === 'today') {
        summary.today += 1
      }

      if (status === 'past') {
        summary.past += 1

        if (!hasSessionReportForScheduleSession(session, sessionReports)) {
          summary.missingReport += 1
        }
      }

      if (status === 'upcoming') {
        summary.upcoming += 1
      }

      return summary
    },
    { teacherId: normalizeId(teacher?.id), upcoming: 0, today: 0, past: 0, missingReport: 0 },
  )
}

function getTeacherScheduleSessionDisplay(session) {
  const dateKey = getScheduleSessionDateKey(session)
  const todayKey = getDateKey(new Date())
  const status = getTeacherScheduleSessionStatus(session, todayKey)

  return {
    dateLabel: dateKey ? formatDisplayDateLabel(dateKey) : getScheduleRecurringDayLabel(session),
    timeLabel: formatScheduleSessionTime(session),
    statusLabel: getTeacherScheduleStatusLabel(status),
  }
}

function getTeacherScheduleSessionStatus(session, todayKey = getDateKey(new Date())) {
  const dateKey = getScheduleSessionDateKey(session)

  if (!dateKey) {
    return 'unknown'
  }

  if (dateKey === todayKey) {
    return 'today'
  }

  return dateKey > todayKey ? 'upcoming' : 'past'
}

function hasSessionReportForScheduleSession(session, sessionReports = []) {
  const sessionId = normalizeId(session?.id)
  const occurrenceDate = String(session?.occurrenceDate || session?.date || '').trim()

  return (Array.isArray(sessionReports) ? sessionReports : []).some((report) => {
    const reportSessionId = normalizeId(report?.scheduleSessionId || report?.sessionId || report?.classSessionId)
    const reportDate = String(report?.occurrenceDate || report?.date || '').trim()

    return reportSessionId === sessionId && (!occurrenceDate || !reportDate || reportDate === occurrenceDate)
  })
}

function getScheduleSessionDateKey(session) {
  if (session?.occurrenceDate) {
    return String(session.occurrenceDate).slice(0, 10)
  }

  if (session?.scheduleType === 'oneOff' && session?.date) {
    return String(session.date).slice(0, 10)
  }

  if (session?.dayOfWeek) {
    return getCurrentWeekDateForDay(session.dayOfWeek)
  }

  return ''
}

function getCurrentWeekDateForDay(dayOfWeek) {
  const dayIndex = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  }[dayOfWeek]

  if (dayIndex === undefined) {
    return ''
  }

  const today = new Date()
  const date = new Date(today)
  date.setDate(today.getDate() + dayIndex - today.getDay())
  return getDateKey(date)
}

function compareTeacherScheduleSessions(firstSession, secondSession) {
  const firstDate = getScheduleSessionDateKey(firstSession)
  const secondDate = getScheduleSessionDateKey(secondSession)

  if (firstDate !== secondDate) {
    return firstDate.localeCompare(secondDate)
  }

  return String(firstSession?.startTime || '').localeCompare(String(secondSession?.startTime || ''))
}

function getScheduleSessionStudents(session, students = []) {
  const studentIds = new Set((Array.isArray(session?.studentIds) ? session.studentIds : []).map(normalizeId))

  return (Array.isArray(students) ? students : []).filter((student) => studentIds.has(normalizeId(student?.id)))
}

function getScheduleSessionLocationLabel(session) {
  return String(session?.centerName || session?.location || session?.room || 'Cơ sở hiện tại').trim()
}

function formatScheduleSessionTime(session) {
  const start = String(session?.startTime || '').trim()
  const end = String(session?.endTime || '').trim()

  if (start && end) {
    return `${start}-${end}`
  }

  return start || end || 'Chưa cập nhật giờ'
}

function formatDisplayDateLabel(dateKey) {
  if (!dateKey) {
    return 'Chưa rõ ngày'
  }

  const date = new Date(`${dateKey}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return dateKey
  }

  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function getScheduleRecurringDayLabel(session) {
  return session?.dayOfWeek ? getTeacherDayLabel(session.dayOfWeek) : 'Chưa rõ ngày'
}

function getTeacherScheduleStatusLabel(status) {
  const labels = {
    upcoming: 'Sắp dạy',
    today: 'Hôm nay',
    past: 'Đã dạy',
    unknown: 'Chưa rõ',
  }

  return labels[status] ?? labels.unknown
}

function getDateKey(date) {
  return new Date(date).toISOString().slice(0, 10)
}

function renderTeacherStudentUpdateRow(link) {
  const student = link.student ?? {}
  const studentName = getStudentDisplayName(student, link.studentId)

  return `
    <tr>
      <td>
        <strong title="${escapeAttribute(studentName)}">${escapeHtml(studentName)}</strong>
        <span>${escapeHtml(link.sourceLabel || 'Học viên liên quan')}</span>
      </td>
      <td>${escapeHtml(getStudentLevelLabel(student) || 'Chưa cập nhật')}</td>
      <td>${escapeHtml(getStudentTestScoreLabel(student))}</td>
      <td>${escapeHtml(getTeacherStudentReviewLabel(student))}</td>
      <td>${escapeHtml(getTeacherStudentPlanLabel(student))}</td>
      <td title="${escapeAttribute(getTeacherStudentNoteLabel(student))}">${escapeHtml(getTeacherStudentNoteLabel(student))}</td>
    </tr>
  `
}

function renderProfileSection(title, rows) {
  return `
    <section class="teacher-profile-section">
      <h5>${escapeHtml(title)}</h5>
      ${renderProfileRows(rows)}
    </section>
  `
}

function renderProfileRows(rows) {
  return `
    <dl>
      ${rows
        .map(
          ([label, value]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value || '-')}</dd>
            </div>
          `,
        )
        .join('')}
    </dl>
  `
}

function renderTeacherAccountReadinessProfile(teacher) {
  return `
    <section class="teacher-profile-section teacher-account-readiness-card">
      <h5>Tài khoản giáo viên</h5>
      ${renderProfileRows([
        ['Email đăng nhập tương lai', teacher.loginEmail || teacher.email],
        ['Trạng thái tài khoản', getTeacherAccountStatusLabel(teacher.accountStatus)],
        ['Ghi chú tài khoản', teacher.accountNotes],
      ])}
      <p>Tài khoản đăng nhập giáo viên sẽ được bật ở phase sau. Hiện chưa tạo tài khoản đăng nhập, chưa gửi lời mời và chưa mở Teacher Portal login.</p>
    </section>
  `
}

function renderProfileTagGroup(label, values = [], emptyLabel = '-') {
  const visibleValues = values.filter(Boolean)

  return `
    <div class="teacher-profile-tag-group">
      <span>${escapeHtml(label)}</span>
      ${
        visibleValues.length
          ? `<div class="teacher-profile-tags">${visibleValues.map((value) => `<b>${escapeHtml(value)}</b>`).join('')}</div>`
          : `<p>${escapeHtml(emptyLabel)}</p>`
      }
    </div>
  `
}

function renderTeacherAvailabilityProfile(teacher, classSessions = []) {
  if (teacher.teacherType === 'fulltime') {
    return `
      <section class="teacher-profile-section">
        <h5>Khả dụng giảng dạy</h5>
        <p class="teacher-availability-note">Full-time: lịch dạy được cơ sở sắp xếp trực tiếp.</p>
        ${teacher.scheduleNote ? renderProfileRows([['Ghi chú lịch dạy', teacher.scheduleNote]]) : ''}
      </section>
    `
  }

  return `
    <section class="teacher-profile-section">
      <h5>Khả dụng giảng dạy</h5>
      ${renderProfileTagGroup('Ngày có thể dạy', (teacher.availableDays ?? []).map(getTeacherDayLabel), 'Chưa cập nhật')}
      ${renderProfileTagGroup('Khung giờ ưu tiên', (teacher.preferredTimeSlots ?? []).map(getTeacherTimeSlotLabel), 'Chưa cập nhật')}
      ${renderProfileTagGroup('Ca học / Lớp có thể dạy', getTeacherClassSessionLabels(teacher.availableClassSessionIds, classSessions), 'Chưa chọn ca học')}
      ${renderProfileRows([
        ['Nhận lớp mới', teacher.canTakeNewClass ? 'Có thể nhận lớp mới' : 'Chưa nhận lớp mới'],
        ['Tối đa/tuần', getMaxSessionsLabel(teacher.maxSessionsPerWeek)],
        ['Ghi chú lịch dạy', teacher.scheduleNote || 'Chưa cập nhật'],
      ])}
    </section>
  `
}

function renderTeacherStudentSection(teacher, studentLinks = createTeacherStudentLinkSummary([])) {
  const inactiveWarning =
    teacher.status === 'inactive' && studentLinks.total
      ? '<p class="teacher-student-warning">Giáo viên đã ngừng dạy nhưng vẫn còn học viên/lịch liên kết.</p>'
      : ''

  return `
    <section class="teacher-profile-section teacher-student-section">
      <div class="teacher-student-section-heading">
        <h5>Học viên phụ trách / đang dạy</h5>
        <span>${Number(studentLinks.total || 0).toLocaleString('vi-VN')} học viên</span>
      </div>
      <div class="teacher-student-summary" aria-label="Tổng hợp học viên của giáo viên">
        ${renderTeacherStudentSummaryItem('Tổng', studentLinks.total)}
        ${renderTeacherStudentSummaryItem('Phụ trách chính', studentLinks.primaryCount)}
        ${renderTeacherStudentSummaryItem('Có trong lịch', studentLinks.scheduledCount)}
        ${renderTeacherStudentSummaryItem('Cả hai', studentLinks.bothCount)}
      </div>
      ${inactiveWarning}
      ${
        studentLinks.students.length
          ? `
            <div class="teacher-student-list">
              ${studentLinks.students.map(renderTeacherStudentRow).join('')}
            </div>
          `
          : '<div class="teacher-student-empty">Chưa có học viên phụ trách hoặc đang dạy.</div>'
      }
    </section>
  `
}

function renderTeacherStudentSummaryItem(label, value) {
  return `
    <span>
      <strong>${Number(value || 0).toLocaleString('vi-VN')}</strong>
      ${escapeHtml(label)}
    </span>
  `
}

function renderTeacherStudentRow(link) {
  const student = link.student ?? {}
  const metaItems = [
    getStudentLevelLabel(student),
    getStudentBotMilestoneLabel(student),
    getStudentStatusLabel(student),
  ].filter(Boolean)
  const scheduleNote =
    link.isScheduled && link.scheduleCount
      ? `Có trong ${Number(link.scheduleCount).toLocaleString('vi-VN')} buổi lịch`
      : ''
  const scheduleTitles = (link.scheduleTitles ?? []).slice(0, 2)
  const detailLine = [scheduleNote, ...scheduleTitles].filter(Boolean).join(' · ')

  return `
    <article class="teacher-student-row">
      <div class="teacher-student-main">
        <strong>${escapeHtml(getStudentDisplayName(student, link.studentId))}</strong>
        <span>${escapeHtml(metaItems.join(' · ') || 'Chưa cập nhật thông tin học tập')}</span>
        ${detailLine ? `<small>${escapeHtml(detailLine)}</small>` : ''}
      </div>
      <span class="teacher-student-source-badge is-${escapeAttribute(getTeacherStudentSourceTone(link))}">
        ${escapeHtml(link.sourceLabel)}
      </span>
    </article>
  `
}

function renderTeacherForm(formState, classSessions = []) {
  const isEditMode = formState.mode === 'edit'

  return `
    <div class="teacher-form-backdrop" role="presentation">
      <form class="teacher-form-panel" data-teacher-form>
        <div class="teacher-form-header">
          <h4>${isEditMode ? 'Sửa giáo viên' : 'Thêm giáo viên'}</h4>
          <button type="button" data-teacher-action="cancel-form" aria-label="Đóng form">×</button>
        </div>
        <div class="teacher-form-grid">
          ${renderTeacherInputField('Họ tên đầy đủ', 'fullName', formState)}
          ${renderTeacherInputField('Tên hiển thị', 'displayName', formState)}
          ${renderTeacherInputField('Số điện thoại', 'phone', formState)}
          ${renderTeacherInputField('Email/Gmail thật', 'email', formState, 'email', 'ducthang.ichess@gmail.com')}
          ${renderTeacherInputField('Email đăng nhập tương lai', 'loginEmail', formState, 'email', 'Mặc định lấy theo email thật')}
          ${renderTeacherInputField('Năm sinh', 'birthYear', formState, 'text', '1998')}
          ${renderTeacherInputField('Quê quán', 'hometown', formState, 'text', 'Hà Nội')}
          ${renderTeacherInputField('Khu vực hiện tại', 'currentArea', formState, 'text', 'Quận 7, TP.HCM')}
          ${renderTeacherSelectField(
            'Trạng thái',
            'status',
            formState,
            teacherStatuses.map((status) => [status, getTeacherStatusLabel(status)]),
          )}
          ${renderTeacherSelectField(
            'Hình thức',
            'teacherType',
            formState,
            teacherTypes.map((teacherType) => [teacherType, getTeacherTypeLabel(teacherType)]),
          )}
          <fieldset class="teacher-level-field">
            <legend>Lớp dạy phù hợp</legend>
            <div class="teacher-level-options">
              ${teacherLevelOptions
                .map(
                  (level) => `
                    <label>
                      <input
                        type="checkbox"
                        value="${escapeAttribute(level)}"
                        data-teacher-level-field
                        ${formState.values.levels.includes(level) ? 'checked' : ''}
                      />
                      <span>${escapeHtml(getTeacherLevelLabel(level))}</span>
                    </label>
                  `,
                )
                .join('')}
            </div>
          </fieldset>
          <label class="teacher-form-field teacher-form-field-wide">
            <span>Ghi chú</span>
            <textarea data-teacher-form-field="note">${escapeHtml(formState.values.note ?? '')}</textarea>
          </label>
          ${renderTeacherAccountReadinessForm(formState)}
          <fieldset class="teacher-level-field">
            <legend>Hình thức dạy</legend>
            <div class="teacher-level-options">
              ${teacherModeOptions
                .map(
                  (mode) => `
                    <label>
                      <input
                        type="checkbox"
                        value="${escapeAttribute(mode)}"
                        data-teacher-mode-field
                        ${formState.values.teachingModes.includes(mode) ? 'checked' : ''}
                      />
                      <span>${escapeHtml(getTeacherModeLabel(mode))}</span>
                    </label>
                  `,
                )
                .join('')}
            </div>
          </fieldset>
          ${renderTeacherInputField(
            'Tag nội bộ',
            'internalTags',
            formState,
            'text',
            'ưu tiên lớp mới, có thể kèm 1-1',
          )}
          ${renderTeacherAvailabilityFields(formState, classSessions)}
        </div>
        ${renderTeacherFormErrors(formState.errors)}
        <div class="teacher-form-actions">
          <button type="button" data-teacher-action="cancel-form">Hủy</button>
          <button class="teacher-save-button" type="button" data-teacher-action="save-form">Lưu giáo viên</button>
        </div>
      </form>
    </div>
  `
}

function renderTeacherAccountReadinessForm(formState) {
  return `
    <section class="teacher-account-readiness-card teacher-form-field-wide">
      <div>
        <strong>Tài khoản giáo viên</strong>
        <span>${escapeHtml(getTeacherAccountStatusLabel(formState.values.accountStatus))}</span>
      </div>
      <p>Tài khoản giáo viên sẽ được bật ở phase sau. Hiện chỉ lưu email đăng nhập tương lai, chưa tạo tài khoản đăng nhập, chưa gửi lời mời và chưa mở Teacher Portal login.</p>
      <label class="teacher-form-field teacher-form-field-wide">
        <span>Ghi chú tài khoản</span>
        <textarea data-teacher-form-field="accountNotes">${escapeHtml(formState.values.accountNotes ?? '')}</textarea>
      </label>
    </section>
  `
}

function renderTeacherAvailabilityFields(formState, classSessions = []) {
  if (formState.values.teacherType === 'fulltime') {
    return `
      <div class="teacher-form-subheading teacher-form-field-wide">Khả dụng giảng dạy</div>
      <div class="teacher-availability-note teacher-form-field-wide">
        Full-time: lịch dạy được cơ sở sắp xếp trực tiếp.
      </div>
      <label class="teacher-form-field teacher-form-field-wide">
        <span>Ghi chú lịch dạy</span>
        <textarea data-teacher-form-field="scheduleNote">${escapeHtml(formState.values.scheduleNote ?? '')}</textarea>
      </label>
    `
  }

  return `
    <div class="teacher-form-subheading teacher-form-field-wide">Khả dụng giảng dạy</div>
    <fieldset class="teacher-level-field teacher-form-field-wide">
      <legend>Ngày có thể dạy</legend>
      <div class="teacher-level-options">
        ${teacherDayOptions
          .map(
            (day) => `
              <label>
                <input
                  type="checkbox"
                  value="${escapeAttribute(day)}"
                  data-teacher-available-day-field
                  ${formState.values.availableDays.includes(day) ? 'checked' : ''}
                />
                <span>${escapeHtml(getTeacherDayLabel(day))}</span>
              </label>
            `,
          )
          .join('')}
      </div>
    </fieldset>
    <fieldset class="teacher-level-field teacher-form-field-wide">
      <legend>Khung giờ ưu tiên</legend>
      <div class="teacher-level-options">
        ${teacherTimeSlotOptions
          .map(
            (slot) => `
              <label>
                <input
                  type="checkbox"
                  value="${escapeAttribute(slot)}"
                  data-teacher-time-slot-field
                  ${formState.values.preferredTimeSlots.includes(slot) ? 'checked' : ''}
                />
                <span>${escapeHtml(getTeacherTimeSlotLabel(slot))}</span>
              </label>
            `,
          )
          .join('')}
      </div>
    </fieldset>
    ${renderTeacherClassSessionField(formState, classSessions)}
    <label class="teacher-level-field teacher-new-class-field">
      <span>Có thể nhận lớp mới</span>
      <input
        type="checkbox"
        data-teacher-new-class-field
        ${formState.values.canTakeNewClass ? 'checked' : ''}
      />
    </label>
    ${renderTeacherInputField('Số buổi tối đa/tuần', 'maxSessionsPerWeek', formState, 'number', '6')}
    <label class="teacher-form-field teacher-form-field-wide">
      <span>Ghi chú lịch dạy</span>
      <textarea data-teacher-form-field="scheduleNote">${escapeHtml(formState.values.scheduleNote ?? '')}</textarea>
    </label>
  `
}

function renderTeacherClassSessionField(formState, classSessions = []) {
  const selectedIds = normalizeClassSessionIds(formState.values.availableClassSessionIds)
  const visibleSessions = getVisibleClassSessionsForTeacher(classSessions, selectedIds)

  return `
    <fieldset class="teacher-level-field teacher-form-field-wide teacher-class-session-field">
      <legend>Ca học / Lớp có thể dạy</legend>
      <p>Danh mục ca học được quản lý tại Cài đặt cơ sở.</p>
      ${
        visibleSessions.length
          ? `
            <div class="teacher-level-options">
              ${visibleSessions
                .map((session) => {
                  const sessionId = normalizeId(session.id)
                  const isInactive = session.status === 'inactive' || session.isActive === false

                  return `
                    <label class="${isInactive ? 'is-inactive' : ''}">
                      <input
                        type="checkbox"
                        value="${escapeAttribute(sessionId)}"
                        data-teacher-class-session-field
                        ${selectedIds.includes(sessionId) ? 'checked' : ''}
                      />
                      <span>${escapeHtml(getClassSessionLabel(session))}${isInactive ? ' (ngưng dùng)' : ''}</span>
                    </label>
                  `
                })
                .join('')}
            </div>
          `
          : '<div class="teacher-empty-inline">Chưa có ca học trong Cài đặt cơ sở.</div>'
      }
    </fieldset>
  `
}

function renderTeacherInputField(label, fieldName, formState, type = 'text', placeholder = '') {
  return `
    <label class="teacher-form-field">
      <span>${escapeHtml(label)}</span>
      <input
        type="${escapeAttribute(type)}"
        value="${escapeAttribute(formState.values[fieldName] ?? '')}"
        placeholder="${escapeAttribute(placeholder)}"
        data-teacher-form-field="${escapeAttribute(fieldName)}"
      />
    </label>
  `
}

function renderTeacherSelectField(label, fieldName, formState, options) {
  return `
    <label class="teacher-form-field">
      <span>${escapeHtml(label)}</span>
      <select data-teacher-form-field="${escapeAttribute(fieldName)}">
        ${options.map(([value, optionLabel]) => renderOption(value, optionLabel, formState.values[fieldName])).join('')}
      </select>
    </label>
  `
}

function renderTeacherFormErrors(errors = {}) {
  const messages = Object.values(errors).filter(Boolean)

  if (!messages.length) {
    return ''
  }

  return `
    <div class="teacher-form-error" role="alert">
      ${messages.map((message) => `<span>${escapeHtml(message)}</span>`).join('')}
    </div>
  `
}

function renderTeacherChips(values = []) {
  const visibleValues = values.filter(Boolean)

  if (!visibleValues.length) {
    return '-'
  }

  return `
    <div class="teacher-chip-list">
      ${visibleValues
        .map((value) => `<span class="teacher-chip is-${getTeacherChipTone(value)}">${escapeHtml(value)}</span>`)
        .join('')}
    </div>
  `
}

function renderTeacherStat(label, value, tone) {
  return `
    <div class="teacher-stat-card is-${tone}">
      <span>${label}</span>
      <strong>${Number(value || 0).toLocaleString('vi-VN')}</strong>
    </div>
  `
}

function renderOption(value, label, selectedValue) {
  return `<option value="${escapeAttribute(value)}" ${
    String(value) === String(selectedValue) ? 'selected' : ''
  }>${escapeHtml(label)}</option>`
}

function createStudentLookup(students = []) {
  return new Map(
    (students ?? [])
      .map((student) => [normalizeId(student?.id), student])
      .filter(([studentId]) => Boolean(studentId)),
  )
}

function ensureTeacherStudentLink(linkLookup, studentId, student) {
  if (!linkLookup.has(studentId)) {
    linkLookup.set(studentId, {
      student,
      studentId,
      isPrimary: false,
      isScheduled: false,
      sourceLabel: '',
      scheduleCount: 0,
      scheduleTitles: [],
    })
  }

  return linkLookup.get(studentId)
}

function createTeacherStudentLinkSummary(links = [], fallbackTotal = 0) {
  const normalizedLinks = (links ?? [])
    .map((link) => ({
      ...link,
      sourceLabel: getTeacherStudentSourceLabel(link),
    }))
    .sort((firstLink, secondLink) =>
      getStudentDisplayName(firstLink.student, firstLink.studentId).localeCompare(
        getStudentDisplayName(secondLink.student, secondLink.studentId),
        'vi',
      ),
    )

  const normalizedFallbackTotal = Number.isFinite(Number(fallbackTotal))
    ? Math.max(0, Number(fallbackTotal))
    : 0
  const total = Math.max(normalizedLinks.length, normalizedFallbackTotal)

  return {
    total,
    primaryCount: normalizedLinks.filter((link) => link.isPrimary).length,
    scheduledCount: normalizedLinks.filter((link) => link.isScheduled).length,
    bothCount: normalizedLinks.filter((link) => link.isPrimary && link.isScheduled).length,
    students: normalizedLinks,
  }
}

function renderTeacherClassSummary(teacher, studentLinks = createTeacherStudentLinkSummary([])) {
  const classNames = getTeacherAssignedClassNames(teacher, studentLinks)
  const visibleClassNames = classNames.slice(0, 2)
  const hiddenCount = Math.max(0, classNames.length - visibleClassNames.length)

  if (!classNames.length) {
    return '<span class="teacher-class-empty">Chưa cập nhật</span>'
  }

  return `
    <div class="teacher-class-summary" title="${escapeAttribute(classNames.join(', '))}">
      ${visibleClassNames.map((className) => `<span>${escapeHtml(className)}</span>`).join('')}
      ${hiddenCount ? `<small>+${hiddenCount} lớp khác</small>` : ''}
    </div>
  `
}

function getTeacherAssignedClassNames(teacher, studentLinks = createTeacherStudentLinkSummary([])) {
  const seededClassNames = Array.isArray(teacher?.assignedClassNames)
    ? teacher.assignedClassNames.map((className) => String(className ?? '').trim()).filter(Boolean)
    : []
  const teachingGroups = Array.isArray(teacher?.teachingGroups)
    ? teacher.teachingGroups.map((className) => String(className ?? '').trim()).filter(Boolean)
    : []

  return Array.from(new Set([...seededClassNames, ...teachingGroups]))
}

function getTeacherVisibleStudentCount(teacher, studentLinks = createTeacherStudentLinkSummary([])) {
  const assignedStudentCount = Array.isArray(teacher?.assignedStudentIds)
    ? teacher.assignedStudentIds.map(normalizeId).filter(Boolean).length
    : 0
  const fallbackCount = Number.isFinite(Number(teacher?.currentStudentCount))
    ? Math.max(0, Number(teacher.currentStudentCount))
    : 0

  return Math.max(Number(studentLinks.total || 0), assignedStudentCount, fallbackCount)
}

function getTeacherStudentCountTitle(studentLinks = createTeacherStudentLinkSummary([])) {
  return [
    `${Number(studentLinks.total || 0).toLocaleString('vi-VN')} học viên`,
    `${Number(studentLinks.primaryCount || 0).toLocaleString('vi-VN')} phụ trách chính`,
    `${Number(studentLinks.scheduledCount || 0).toLocaleString('vi-VN')} có trong lịch dạy`,
    `${Number(studentLinks.bothCount || 0).toLocaleString('vi-VN')} cả hai nguồn`,
  ].join(' · ')
}

function getTeacherStudentSourceLabel(link) {
  if (link?.isPrimary && link?.isScheduled) {
    return 'Phụ trách chính + Có trong lịch dạy'
  }

  if (link?.isPrimary) {
    return 'Phụ trách chính'
  }

  if (link?.isScheduled) {
    return 'Có trong lịch dạy'
  }

  return 'Chưa rõ nguồn'
}

function getTeacherStudentSourceTone(link) {
  if (link?.isPrimary && link?.isScheduled) {
    return 'both'
  }

  if (link?.isPrimary) {
    return 'primary'
  }

  return 'scheduled'
}

function getScheduleTitle(schedule) {
  return String(schedule?.title || schedule?.groupName || schedule?.room || '').trim()
}

function getStudentDisplayName(student, fallbackId = '') {
  return String(student?.fullName || student?.name || fallbackId || 'Học viên').trim()
}

function getStudentLevelLabel(student) {
  const level = student?.level ?? student?.currentLevel

  if (level === null || level === undefined || level === '') {
    return ''
  }

  const levelText = String(level).trim()
  const levelMatch = levelText.match(/\d+/)

  return levelMatch ? `Level ${Number(levelMatch[0])}` : levelText
}

function getStudentTestScoreLabel(student) {
  const score =
    student?.latestTestScore ??
    student?.testScore ??
    student?.examScore ??
    ''

  if (score === null || score === undefined || score === '') {
    return 'Chưa cập nhật'
  }

  const numberScore = Number(score)

  if (Number.isFinite(numberScore)) {
    return `${numberScore.toLocaleString('vi-VN')}/10`
  }

  return String(score).trim() || 'Chưa cập nhật'
}

function getTeacherStudentReviewLabel(student) {
  return getFirstNonEmptyValue([
    student?.teacherReview,
    student?.teacherComment,
    student?.learningComment,
    student?.latestTeacherFeedback,
  ])
}

function getTeacherStudentPlanLabel(student) {
  return getFirstNonEmptyValue([
    student?.teachingPlan,
    student?.nextTeachingPlan,
    student?.learningPlan,
    student?.nextLearningPlan,
  ])
}

function getTeacherStudentNoteLabel(student) {
  return getFirstNonEmptyValue([
    student?.note,
    student?.latestCareNote,
    student?.parentNotes,
  ])
}

function getFirstNonEmptyValue(values = []) {
  const value = values
    .map((item) => String(item ?? '').trim())
    .find(Boolean)

  return value || 'Chưa cập nhật'
}

function getStudentBotMilestoneLabel(student) {
  return String(
    student?.highestBotMilestone ||
      student?.botMilestone ||
      student?.botLevel ||
      student?.milestone ||
      '',
  ).trim()
}

function getStudentStatusLabel(student) {
  return String(student?.currentStatus || student?.status || '').trim()
}

function isDeletedStudent(student) {
  return Boolean(student?.isDeleted || student?.deletedAt)
}

function normalizeId(value) {
  return String(value ?? '').trim()
}

function getTeacherStatusLabel(status) {
  const labels = {
    active: 'Đang dạy',
    paused: 'Tạm nghỉ',
    inactive: 'Ngừng dạy',
  }

  return labels[status] ?? 'Đang dạy'
}

function getTeacherDisplayName(teacher) {
  return String(teacher?.displayName || teacher?.fullName || teacher?.name || 'Giáo viên').trim()
}

function getTeacherTypeLabel(teacherType) {
  const labels = {
    fulltime: 'Full-time',
    parttime: 'Part-time',
    collaborator: 'Cộng tác viên',
  }

  return labels[teacherType] ?? 'Full-time'
}

function getTeacherAccountStatusLabel(accountStatus) {
  const labels = {
    not_invited: 'Chưa tạo tài khoản đăng nhập',
    invited: 'Đã mời, chờ kích hoạt',
    active: 'Tài khoản giáo viên đang hoạt động',
    paused: 'Tài khoản giáo viên tạm dừng',
    revoked: 'Tài khoản giáo viên đã thu hồi',
  }

  return labels[accountStatus] ?? labels.not_invited
}

function getTeacherInitials(fullName) {
  const words = String(fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!words.length) {
    return 'GV'
  }

  const selectedWords = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]]
  const initials = selectedWords
    .map((word) => normalizeText(word).charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)

  return initials || 'GV'
}

function getTeacherChipTone(value) {
  const normalizedValue = normalizeText(value)

  if (normalizedValue.includes('khai cuoc') || normalizedValue.includes('opening')) {
    return 'opening'
  }

  if (
    normalizedValue.includes('trung cuoc') ||
    normalizedValue.includes('chien thuat') ||
    normalizedValue.includes('tu duy')
  ) {
    return 'strategy'
  }

  if (normalizedValue.includes('endgame') || normalizedValue.includes('tan cuoc')) {
    return 'endgame'
  }

  if (
    normalizedValue.includes('thieu nhi') ||
    normalizedValue.includes('nhap mon') ||
    normalizedValue.includes('co ban') ||
    normalizedValue.includes('lop nho')
  ) {
    return 'beginner'
  }

  if (normalizedValue.includes('luyen giai') || normalizedValue.includes('giai')) {
    return 'competition'
  }

  return 'default'
}

function getTeacherLevelLabel(level) {
  const labels = {
    preschool: 'Mầm non',
    beginner: 'Cơ bản',
    intermediate: 'Trung cấp',
    advanced: 'Nâng cao',
  }

  return labels[level] ?? level
}

function getTeacherModeLabel(mode) {
  const labels = {
    group: 'Lớp nhóm',
    oneOnOne: 'Kèm 1-1',
    competition: 'Luyện giải',
    online: 'Online',
  }

  return labels[mode] ?? mode
}

function getTeacherDayLabel(day) {
  const labels = {
    monday: 'Thứ 2',
    tuesday: 'Thứ 3',
    wednesday: 'Thứ 4',
    thursday: 'Thứ 5',
    friday: 'Thứ 6',
    saturday: 'Thứ 7',
    sunday: 'Chủ nhật',
  }

  return labels[day] ?? day
}

function getTeacherTimeSlotLabel(slot) {
  const labels = {
    morning: 'Sáng',
    afternoon: 'Chiều',
    evening: 'Tối',
    weekendMorning: 'Sáng cuối tuần',
    weekendAfternoon: 'Chiều cuối tuần',
  }

  return labels[slot] ?? slot
}

function getMaxSessionsLabel(value) {
  if (value === null || value === undefined || value === '') {
    return 'Chưa cập nhật'
  }

  return `${Number(value).toLocaleString('vi-VN')} buổi`
}

function parseCommaSeparatedList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeLevels(levels) {
  return (Array.isArray(levels) ? levels : [])
    .filter((level) => teacherLevelOptions.includes(level))
}

function normalizeTeachingModes(modes) {
  return (Array.isArray(modes) ? modes : [])
    .filter((mode) => teacherModeOptions.includes(mode))
}

function normalizeAvailableDays(days) {
  return (Array.isArray(days) ? days : [])
    .filter((day) => teacherDayOptions.includes(day))
}

function normalizePreferredTimeSlots(slots) {
  return (Array.isArray(slots) ? slots : [])
    .filter((slot) => teacherTimeSlotOptions.includes(slot))
}

function normalizeClassSessionIds(classSessionIds) {
  return Array.from(
    new Set(
      (Array.isArray(classSessionIds) ? classSessionIds : [])
        .map(normalizeId)
        .filter(Boolean),
    ),
  )
}

function normalizeMaxSessionsPerWeek(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : null
}

function getVisibleClassSessionsForTeacher(classSessions = [], selectedIds = []) {
  const selectedSet = new Set(selectedIds)

  return (classSessions ?? [])
    .filter((classSession) => {
      const classSessionId = normalizeId(classSession?.id)

      return (
        classSession &&
        classSessionId &&
        (classSession.status !== 'inactive' || selectedSet.has(classSessionId))
      )
    })
    .sort((firstSession, secondSession) => {
      const firstStatusRank = firstSession.status === 'inactive' ? 1 : 0
      const secondStatusRank = secondSession.status === 'inactive' ? 1 : 0

      if (firstStatusRank !== secondStatusRank) {
        return firstStatusRank - secondStatusRank
      }

      return getClassSessionLabel(firstSession).localeCompare(getClassSessionLabel(secondSession), 'vi')
    })
}

function getTeacherClassSessionLabels(classSessionIds = [], classSessions = []) {
  const classSessionLookup = new Map(
    (classSessions ?? [])
      .filter((classSession) => classSession && classSession.id)
      .map((classSession) => [normalizeId(classSession.id), classSession]),
  )

  return normalizeClassSessionIds(classSessionIds).map((classSessionId) => {
    const classSession = classSessionLookup.get(classSessionId)

    if (!classSession) {
      return `Ca học đã lưu (${classSessionId})`
    }

    const label = getClassSessionLabel(classSession)
    return classSession.status === 'inactive' ? `${label} (ngưng dùng)` : label
  })
}

function getClassSessionLabel(classSession) {
  return String(classSession?.displayLabel || classSession?.name || 'Ca học').trim()
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatTeacherDateTime(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
