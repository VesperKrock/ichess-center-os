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

const emptyTeacherFormValues = {
  fullName: '',
  displayName: '',
  phone: '',
  email: '',
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
    },
    errors: {},
  }
}

export function validateTeacherForm(values) {
  const errors = {}
  const email = String(values.email ?? '').trim()

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

  if (!teacherStatuses.includes(values.status)) {
    errors.status = 'Trạng thái giáo viên không hợp lệ.'
  }

  if (!teacherTypes.includes(values.teacherType)) {
    errors.teacherType = 'Hình thức giáo viên không hợp lệ.'
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
    scheduleNote: String(values.scheduleNote ?? '').trim(),
    mainRole: String(values.mainRole ?? '').trim(),
    note: String(values.note ?? '').trim(),
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
        ? renderTeacherProfile(selectedTeacher, teacherStudentLinkMap.get(normalizeId(selectedTeacher.id)), classSessions)
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

function renderTeacherProfile(teacher, studentLinks = createTeacherStudentLinkSummary([]), classSessions = []) {
  return `
    <div class="teacher-profile-backdrop" role="presentation">
      <section class="teacher-profile-panel" aria-label="Hồ sơ giáo viên">
        <div class="teacher-profile-header">
          <div class="teacher-profile-title">
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
          ${renderTeacherTeachingUpdatePane(teacher, studentLinks)}
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
      ])}
      <section class="teacher-profile-section">
        <h5>Giảng dạy</h5>
        ${renderProfileTagGroup('Lớp dạy phù hợp', (teacher.levels ?? []).map(getTeacherLevelLabel), 'Chưa cập nhật')}
        ${renderProfileTagGroup('Hình thức dạy phù hợp', (teacher.teachingModes ?? []).map(getTeacherModeLabel), 'Chưa cập nhật')}
      </section>
      ${renderTeacherAvailabilityProfile(teacher, classSessions)}
    </section>
  `
}

function renderTeacherTeachingUpdatePane(teacher, studentLinks = createTeacherStudentLinkSummary([])) {
  return `
    <section class="teacher-profile-pane teacher-teaching-update-pane" aria-label="Cập nhật tình hình giảng dạy">
      <div class="teacher-profile-pane-heading">
        <h5>Cập nhật tình hình giảng dạy</h5>
        <span>${Number(studentLinks.total || 0).toLocaleString('vi-VN')} học viên liên quan</span>
      </div>
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
          ${renderTeacherInputField('Email', 'email', formState, 'email')}
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

function getTeacherTypeLabel(teacherType) {
  const labels = {
    fulltime: 'Full-time',
    parttime: 'Part-time',
    collaborator: 'Cộng tác viên',
  }

  return labels[teacherType] ?? 'Full-time'
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
