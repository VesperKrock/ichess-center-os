import { botMilestones, sampleStudents, studentStatuses } from './student-data.js'

const baseUrl = import.meta.env?.BASE_URL ?? '/'
const defaultAvatarUrl = `${baseUrl}images/avatar.jpg`
export const studentLevelOptions = [
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
const schoolLevelOptions = ['Mẫu giáo', 'Cấp 1', 'Cấp 2', 'Cấp 3', 'Cao đẳng/Đại học', 'Khác']
const genderOptions = [
  { value: '', label: 'Chưa cập nhật' },
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
]
const parentNoteSuggestions = [
  'Phụ huynh muốn đổi lịch học',
  'Cần nhắc học phí',
  'Phụ huynh cần tư vấn lộ trình',
  'Bé cần học bù',
  'Cần gọi lại phụ huynh',
  'Phụ huynh phản hồi tích cực',
  'Cần gửi bài luyện thêm',
  'Phụ huynh muốn theo dõi tiến độ sát hơn',
]

export const studentFormTabOrder = {
  fullName: 1,
  birthDate: 2,
  schoolName: 3,
  hometown: 4,
  gender: 5,
  schoolLevel: 6,
  nationality: 7,
  level: 8,
  highestBotMilestone: 9,
  assignedTeacherId: 10,
  classSessionIds: 11,
  personality: 12,
  hobbies: 13,
  testScore: 14,
  parentName: 101,
  parentBirthYear: 102,
  fatherPhone: 103,
  motherPhone: 104,
  parentJob: 105,
  parentArea: 106,
  currentStatus: 107,
  achievements: 108,
  parentNotes: 109,
}

export const initialStudentFilters = {
  query: '',
  status: 'all',
  level: 'all',
  classSessionId: 'all',
  sortBy: '',
  sortDirection: 'asc',
  selectedStudentId: null,
}

export const emptyStudentFormValues = {
  fullName: '',
  birthDate: '',
  avatarUrl: '',
  assignedTeacherId: '',
  schoolName: '',
  schoolLevel: 'Khác',
  gender: '',
  hometown: '',
  hobbies: '',
  nationality: 'Việt Nam',
  parentName: '',
  parentBirthYear: '',
  fatherPhone: '',
  motherPhone: '',
  parentJob: '',
  parentArea: '',
  level: 'Dolphin 1',
  classSessionIds: [],
  testScore: '',
  highestBotMilestone: 'Chưa có',
  personality: '',
  currentStatus: 'Đang theo học',
  achievements: '',
  parentNotes: '',
}

const requiredFields = {
  fullName: 'Họ và tên học viên',
  birthDate: 'Ngày tháng năm sinh',
  schoolName: 'Tên trường',
  parentName: 'Họ và tên phụ huynh',
  level: 'Cấp độ học',
}

const parentCareRequiredFields = ['parentName', 'fatherPhone', 'motherPhone']
const studentParentCareRequiredHint = 'Cần nhập thông tin phụ huynh/chăm sóc'

export function createEmptyStudentFormState() {
  return {
    mode: 'create',
    step: 1,
    studentId: null,
    values: { ...emptyStudentFormValues },
    errors: {},
  }
}

export function createEditStudentFormState(student) {
  return {
    mode: 'edit',
    step: 1,
    studentId: student.id,
    values: {
      fullName: student.fullName ?? '',
      birthDate: student.birthDate ?? '',
      avatarUrl: student.avatarUrl ?? '',
      assignedTeacherId: student.assignedTeacherId ?? '',
      schoolName: student.schoolName ?? '',
      schoolLevel: student.schoolLevel ?? getSchoolLevelFromName(student.schoolName),
      gender: student.gender ?? '',
      hometown: student.hometown ?? '',
      hobbies: student.hobbies ?? '',
      nationality: student.nationality ?? '',
      parentName: student.parentName ?? '',
      parentBirthYear: student.parentBirthYear ? String(student.parentBirthYear) : '',
      fatherPhone: formatPhoneNumber(student.fatherPhone ?? ''),
      motherPhone: formatPhoneNumber(
        student.motherPhone ?? (!student.fatherPhone ? student.parentPhone : '') ?? '',
      ),
      parentJob: student.parentJob ?? '',
      parentArea: student.parentArea ?? '',
      level: getLevelLabel(student.level),
      classSessionIds: normalizeClassSessionIds(student.classSessionIds),
      testScore: getTestScoreForForm(student.testScore),
      highestBotMilestone: student.highestBotMilestone ?? 'Chưa có',
      personality: student.personality ?? '',
      currentStatus: student.currentStatus ?? 'Đang theo học',
      achievements: student.achievements ?? '',
      parentNotes: student.parentNotes ?? '',
    },
    errors: {},
  }
}

export function renderStudentModule(
  students,
  filters,
  formState,
  teachers = [],
  classSessions = [],
) {
  const visibleStudents = getVisibleStudents(students)
  const filteredStudents = getFilteredStudents(students, filters, teachers, classSessions)
  const stats = getStudentStats(visibleStudents)
  const activeClassSessions = getActiveClassSessions(classSessions)

  return `
    <section class="student-module ${formState ? 'form-open' : ''}" aria-label="Danh sách học viên">
      <div class="student-module-content">
        <div class="student-overview" aria-label="Tìm kiếm, lọc và thống kê học viên">
          <div class="student-top-row">
            <label class="student-search-field">
              <span>Tìm kiếm</span>
              <input
                type="search"
                value="${escapeAttribute(filters.query)}"
                placeholder="Tên học viên, phụ huynh, số điện thoại, trường học"
                data-student-filter="query"
              />
            </label>
            <button class="student-add-button" type="button" data-student-action="open-create">
              + Thêm học viên
            </button>
          </div>

          <div class="student-bottom-row">
            <div class="student-filter-row">
              <label>
                <span>Trạng thái</span>
                <select data-student-filter="status">
                  ${renderOption('all', 'Tất cả trạng thái', filters.status)}
                  ${studentStatuses
                    .map((status) => renderOption(status, status, filters.status))
                    .join('')}
                </select>
              </label>
              <label>
                <span>Cấp độ học</span>
                <select data-student-filter="level">
                  ${renderOption('all', 'Tất cả cấp độ học', filters.level)}
                  ${studentLevelOptions
                    .map((level) => renderOption(level, level, filters.level))
                    .join('')}
                </select>
              </label>
              <label>
                <span>Ca học / Lớp</span>
                <select data-student-filter="classSessionId">
                  ${renderOption('all', 'Tất cả ca học', filters.classSessionId)}
                  ${renderOption('unassigned', 'Chưa phân lớp', filters.classSessionId)}
                  ${activeClassSessions
                    .map((classSession) =>
                      renderOption(
                        classSession.id,
                        getClassSessionDisplayLabel(classSession),
                        filters.classSessionId,
                      ),
                    )
                    .join('')}
                </select>
              </label>
            </div>
            <div class="student-stats">
              ${renderStatCard('Tổng', stats.total)}
              ${renderStatCard('Đang học', stats.active)}
              ${renderStatCard('Bảo lưu', stats.paused)}
              ${renderStatCard('Ngưng', stats.stopped)}
              ${renderStatCard('Có ghi chú', stats.withNotes, 'note')}
            </div>
          </div>
        </div>

        <div class="student-content-grid">
          <div class="student-table-wrap">
            <table class="student-table">
              <thead>
                <tr>
                  <th>${renderSortableHeader('Học viên', 'student', filters)}</th>
                  <th>Phụ huynh</th>
                  <th>SĐT</th>
                  <th>Trạng thái</th>
                  <th>${renderSortableHeader('Cấp độ', 'level', filters)}</th>
                  <th>Elo</th>
                  <th>Trường học</th>
                  <th>Giáo viên phụ trách</th>
                  <th>Ca học</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                ${
                  filteredStudents.length
                    ? filteredStudents
                        .map((student) => renderStudentRow(student, teachers, classSessions))
                        .join('')
                    : renderEmptyState()
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ${formState ? renderStudentForm(formState, teachers, classSessions) : ''}
    </section>
  `
}

export function getFilteredStudents(
  students = sampleStudents,
  filters,
  teachers = [],
  classSessions = [],
) {
  if (!Array.isArray(students)) {
    filters = students
    students = sampleStudents
  }

  const activeFilters = { ...initialStudentFilters, ...filters }
  const normalizedQuery = normalizeText(activeFilters.query)
  const queryDigits = String(activeFilters.query).replace(/\D/g, '')

  const teacherLookup = createTeacherLookup(teachers)
  const classSessionLookup = createClassSessionLookup(classSessions)
  const filteredStudents = getVisibleStudents(students).filter((student) => {
    const assignedTeacher = teacherLookup.get(String(student.assignedTeacherId ?? ''))
    const classSessionLabels = getStudentClassSessionLabels(student, classSessionLookup)
    const matchesQuery =
      !normalizedQuery ||
      [
        student.fullName,
        student.parentName,
        student.schoolName,
        getTeacherDisplayName(assignedTeacher),
        ...classSessionLabels,
      ].some((value) => normalizeText(value).includes(normalizedQuery)) ||
      (queryDigits &&
        [student.fatherPhone, student.motherPhone, student.parentPhone].some((phone) =>
          String(phone ?? '').replace(/\D/g, '').includes(queryDigits),
        ))

    const matchesStatus =
      activeFilters.status === 'all' || student.currentStatus === activeFilters.status
    const matchesLevel =
      activeFilters.level === 'all' || getLevelLabel(student.level) === activeFilters.level
    const classSessionIds = normalizeClassSessionIds(student.classSessionIds)
    const matchesClassSession =
      activeFilters.classSessionId === 'all' ||
      (activeFilters.classSessionId === 'unassigned' && classSessionIds.length === 0) ||
      classSessionIds.includes(activeFilters.classSessionId)

    return matchesQuery && matchesStatus && matchesLevel && matchesClassSession
  })

  return sortStudents(filteredStudents, activeFilters)
}

export function getVisibleStudents(students = sampleStudents) {
  return students.filter((student) => !student.isDeleted)
}

export function validateStudentForm(values) {
  const errors = Object.entries(requiredFields).reduce((currentErrors, [field, label]) => {
    if (!String(values[field] ?? '').trim()) {
      currentErrors[field] = `${label} là bắt buộc.`
    }

    return currentErrors
  }, {})

  const fatherPhoneDigits = String(values.fatherPhone ?? '').replace(/\D/g, '')
  const motherPhoneDigits = String(values.motherPhone ?? '').replace(/\D/g, '')

  if (!fatherPhoneDigits && !motherPhoneDigits) {
    errors.motherPhone = 'Cần nhập ít nhất một SĐT ba hoặc SĐT mẹ.'
  }

  if (values.fatherPhone && fatherPhoneDigits.length !== 10) {
    errors.fatherPhone = 'SĐT ba cần đủ 10 chữ số.'
  }

  if (values.motherPhone && motherPhoneDigits.length !== 10) {
    errors.motherPhone = 'SĐT mẹ cần đủ 10 chữ số.'
  }

  const parentBirthYear = String(values.parentBirthYear ?? '').trim()
  const currentYear = new Date().getFullYear()

  if (parentBirthYear) {
    const year = Number(parentBirthYear)

    if (!/^\d{4}$/.test(parentBirthYear) || year < 1950 || year > currentYear) {
      errors.parentBirthYear = `Năm sinh phụ huynh cần từ 1950 đến ${currentYear}.`
    }
  }

  const testScore = String(values.testScore ?? '').trim()

  if (testScore) {
    const normalizedTestScore = testScore.replace(',', '.')
    const numericScore = Number(normalizedTestScore)

    if (
      !/^(?:\d+|\d+\.5)$/.test(normalizedTestScore) ||
      numericScore < 0 ||
      numericScore > 10
    ) {
      errors.testScore = 'Điểm bài kiểm tra gần nhất cần từ 0 đến 10 và theo bước 0.5.'
    }
  }

  return errors
}

export function isStudentFormReady(values) {
  return Object.keys(validateStudentForm(values)).length === 0
}

export function isStudentParentCareInfoIncomplete(values) {
  const hasParentName = String(values.parentName ?? '').trim()
  const hasFatherPhone = String(values.fatherPhone ?? '').replace(/\D/g, '')
  const hasMotherPhone = String(values.motherPhone ?? '').replace(/\D/g, '')

  return !hasParentName || (!hasFatherPhone && !hasMotherPhone)
}

export function getStudentFormSaveDisabledReason(values) {
  const errors = validateStudentForm(values)
  const errorFields = Object.keys(errors)

  if (!errorFields.length) {
    return ''
  }

  if (errorFields.some((field) => parentCareRequiredFields.includes(field))) {
    return studentParentCareRequiredHint
  }

  return 'Cần nhập đủ thông tin bắt buộc'
}

export function formatStudentPhoneNumber(value) {
  return formatPhoneNumber(value)
}

export function buildStudentFromForm(values, existingStudent = null) {
  const now = new Date().toISOString()
  const normalizedValues = {
    ...values,
    avatarUrl: values.avatarUrl || existingStudent?.avatarUrl || '',
    assignedTeacherId: normalizeAssignedTeacherId(values.assignedTeacherId),
    classSessionIds: normalizeClassSessionIds(values.classSessionIds),
    level: getLevelLabel(values.level),
    parentBirthYear: values.parentBirthYear ? Number(values.parentBirthYear) : '',
    fatherPhone: formatPhoneNumber(values.fatherPhone),
    motherPhone: formatPhoneNumber(values.motherPhone),
    parentPhone: formatPhoneNumber(
      values.motherPhone || values.fatherPhone || existingStudent?.parentPhone || '',
    ),
    testScore: values.testScore ? Number(String(values.testScore).replace(',', '.')) : '',
    latestCareNote: values.parentNotes || 'Chưa có ghi chú chăm sóc.',
  }

  return {
    id: existingStudent?.id ?? `stu-${Date.now()}`,
    ...existingStudent,
    ...normalizedValues,
    isDeleted: existingStudent?.isDeleted ?? false,
    createdAt: existingStudent?.createdAt ?? now,
    updatedAt: now,
  }
}

function renderStudentForm(
  formState,
  teachers = [],
  classSessions = [],
) {
  const isEdit = formState.mode === 'edit'
  const title = isEdit ? 'Sửa học viên' : 'Thêm học viên'
  const currentStep = formState.step ?? 1
  const isReadyToSave = isStudentFormReady(formState.values)
  const disabledReason = getStudentFormSaveDisabledReason(formState.values)
  const parentCareIncomplete = isStudentParentCareInfoIncomplete(formState.values)

  return `
    <div class="student-form-backdrop" aria-hidden="true"></div>
    <section class="student-form-panel" aria-label="${title}">
      <div class="student-form-header">
        <div>
          <h4>${title}</h4>
          <div class="student-form-steps" aria-label="Các bước nhập học viên">
            <button class="${currentStep === 1 ? 'active' : ''}" type="button" data-student-form-step="1">
              1. Thông tin học viên
            </button>
            <button
              class="${[
                currentStep === 2 ? 'active' : '',
                parentCareIncomplete ? 'needs-attention' : '',
              ].filter(Boolean).join(' ')}"
              type="button"
              data-student-form-step="2"
              ${parentCareIncomplete ? `title="${studentParentCareRequiredHint}"` : ''}
            >
              2. Phụ huynh / chăm sóc
              ${parentCareIncomplete ? '<span aria-label="Cần nhập thông tin phụ huynh/chăm sóc">!</span>' : ''}
            </button>
          </div>
        </div>
        <div class="student-form-header-actions">
          <span class="student-save-button-wrap" ${disabledReason ? `title="${disabledReason}"` : ''}>
            <button
              class="student-save-button"
              type="button"
              data-student-action="save-form"
              ${isReadyToSave ? '' : 'disabled'}
            >
              ${isEdit ? 'Lưu thay đổi' : 'Lưu học viên'}
            </button>
          </span>
          <button class="student-danger-button" type="button" data-student-action="cancel-form">
            ${isEdit ? 'Hủy sửa' : 'Hủy thêm'}
          </button>
        </div>
      </div>
      <div class="student-form-scroll">
        <div class="student-form-grid">
          ${
            currentStep === 1
              ? `
                ${renderFormSection('A. Thông tin học viên', [
                  renderField('fullName', 'Họ và tên học viên *', formState, 'text', {
                    className: 'span-full',
                  }),
                  renderField('birthDate', 'Ngày sinh *', formState, 'date'),
                  renderSelectField('gender', 'Giới tính', formState, genderOptions),
                  renderField('schoolName', 'Tên trường *', formState, 'text', {
                    placeholder: 'Ví dụ: Sao Mai, Cao Thắng, Lê Quý Đôn',
                  }),
                  renderSelectField('schoolLevel', 'Bậc học', formState, schoolLevelOptions),
                  renderField('hometown', 'Tỉnh/thành phố', formState, 'text', {
                    placeholder: 'Ví dụ: TP.HCM, Bình Dương, Đồng Nai',
                  }),
                  renderField('nationality', 'Quốc tịch', formState, 'text'),
                ])}
                ${renderFormSection('C. Trạng thái học', [
                  renderStudentLevelField(formState),
                  renderSelectField('highestBotMilestone', 'Mốc bot đã vượt qua', formState, botMilestones),
                  renderSelectField(
                    'assignedTeacherId',
                    'Giáo viên phụ trách',
                    formState,
                    getTeacherSelectOptions(teachers),
                  ),
                  renderClassSessionCheckboxes(formState, classSessions),
                  renderTextareaField('personality', 'Tính cách học viên', formState, {
                    className: 'span-full',
                  }),
                  renderField('hobbies', 'Sở thích', formState, 'text'),
                  renderField('testScore', 'Điểm bài kiểm tra gần nhất', formState, 'number', {
                    placeholder: '0-10, không bắt buộc',
                    min: '0',
                    max: '10',
                    step: '0.5',
                  }),
                ])}
              `
              : `
                ${renderFormSection('B. Thông tin phụ huynh', [
                  renderField('parentName', 'Họ và tên phụ huynh *', formState, 'text'),
                  renderField('parentBirthYear', 'Năm sinh phụ huynh', formState, 'text', {
                    inputmode: 'numeric',
                    maxlength: '4',
                    placeholder: `Từ 1950 đến ${new Date().getFullYear()}`,
                  }),
                  renderField('fatherPhone', 'SĐT ba', formState, 'tel', {
                    placeholder: '0901 001 001',
                  }),
                  renderField('motherPhone', 'SĐT mẹ', formState, 'tel', {
                    placeholder: '0901 001 001',
                  }),
                  renderField('parentJob', 'Nghề nghiệp', formState, 'text'),
                  renderField('parentArea', 'Khu vực sinh sống', formState, 'text'),
                ])}
                ${renderFormSection('D. Chăm sóc / ghi chú ban đầu', [
                  renderSelectField('currentStatus', 'Trạng thái hiện tại', formState, studentStatuses),
                  renderTextareaField('achievements', 'Thành tích học viên đạt được', formState, {
                    className: 'span-full',
                  }),
                  renderTextareaField('parentNotes', 'Thông tin đã trao đổi / lưu ý từ phụ huynh', formState, {
                    className: 'span-full',
                    after: renderParentNoteSuggestions(),
                  }),
                ])}
              `
          }
        </div>
      </div>
    </section>
  `
}

function renderFormSection(title, fields) {
  const cleanTitle = title.replace(/^[A-D]\.\s*/, '')

  return `
    <fieldset class="student-form-section">
      <legend>${cleanTitle}</legend>
      ${fields.join('')}
    </fieldset>
  `
}

function renderField(name, label, formState, type, options = {}) {
  return `
    <label class="${[formState.errors[name] ? 'has-error' : '', options.className ?? '']
      .filter(Boolean)
      .join(' ')}">
      <span>${label}</span>
      <input
        type="${type}"
        value="${escapeAttribute(formState.values[name] ?? '')}"
        data-student-form-field="${name}"
        ${renderStudentFormTabIndex(name)}
        ${options.placeholder ? `placeholder="${escapeAttribute(options.placeholder)}"` : ''}
        ${options.inputmode ? `inputmode="${options.inputmode}"` : ''}
        ${options.maxlength ? `maxlength="${options.maxlength}"` : ''}
        ${options.min ? `min="${options.min}"` : ''}
        ${options.max ? `max="${options.max}"` : ''}
        ${options.step ? `step="${options.step}"` : ''}
      />
      ${formState.errors[name] ? `<small>${formState.errors[name]}</small>` : ''}
    </label>
  `
}

function renderTextareaField(name, label, formState, options = {}) {
  return `
    <label class="${options.className ?? ''}">
      <span>${label}</span>
      <textarea data-student-form-field="${name}" ${renderStudentFormTabIndex(name)}>${formState.values[name] ?? ''}</textarea>
      ${options.after ?? ''}
    </label>
  `
}

function renderSelectField(name, label, formState, options) {
  return `
    <label class="${formState.errors[name] ? 'has-error' : ''}">
      <span>${label}</span>
      <select data-student-form-field="${name}" ${renderStudentFormTabIndex(name)}>
        ${options.map((option) => {
          const value = typeof option === 'object' ? option.value : option
          const optionLabel = typeof option === 'object' ? option.label : option
          return renderOption(value, optionLabel, formState.values[name])
        }).join('')}
      </select>
      ${formState.errors[name] ? `<small>${formState.errors[name]}</small>` : ''}
    </label>
  `
}

function renderStudentLevelField(formState) {
  return `
    <label class="${formState.errors.level ? 'has-error' : ''}">
      <span>Cấp độ học *</span>
      <input
        type="text"
        list="student-level-options"
        value="${escapeAttribute(formState.values.level ?? '')}"
        data-student-form-field="level"
        ${renderStudentFormTabIndex('level')}
        placeholder="Chọn hoặc nhập cấp độ riêng"
      />
      <datalist id="student-level-options">
        ${studentLevelOptions
          .map((level) => `<option value="${escapeAttribute(level)}"></option>`)
          .join('')}
      </datalist>
      ${formState.errors.level ? `<small>${formState.errors.level}</small>` : ''}
    </label>
  `
}

function renderClassSessionCheckboxes(formState, classSessions = []) {
  const selectedIds = new Set(normalizeClassSessionIds(formState.values.classSessionIds))
  const selectableClassSessions = getSelectableClassSessions(classSessions, selectedIds)

  return `
    <div class="student-class-session-field span-full">
      <div class="student-class-session-heading">
        <div>
          <span>Ca học / Lớp</span>
          <p>Có thể chọn nhiều ca học trong tuần. Nếu chưa chọn, học viên sẽ được tính là Chưa phân lớp.</p>
          <p>Danh mục ca học được quản lý tại Cài đặt cơ sở.</p>
        </div>
        <button class="student-secondary-button" type="button" data-student-action="open-settings-module">
          Mở Cài đặt cơ sở
        </button>
      </div>
      <div class="student-class-session-list">
        ${
          selectableClassSessions.length
            ? selectableClassSessions
                .map(
                  (classSession) => `
                    <label class="student-class-session-option ${classSession.status === 'inactive' ? 'is-inactive' : ''}">
                      <input
                        type="checkbox"
                        value="${escapeAttribute(classSession.id)}"
                        data-student-class-session-id="${escapeAttribute(classSession.id)}"
                        ${renderStudentFormTabIndex('classSessionIds')}
                        ${selectedIds.has(classSession.id) ? 'checked' : ''}
                      />
                      <span>
                        ${escapeHtml(getClassSessionDisplayLabel(classSession))}
                        ${classSession.status === 'inactive' ? '<em>Đã ngưng</em>' : ''}
                      </span>
                    </label>
                  `,
                )
                .join('')
            : '<p class="student-class-session-empty">Chưa có ca học active.</p>'
        }
      </div>
    </div>
  `
}

function renderParentNoteSuggestions() {
  return `
    <div class="student-parent-note-suggestions" aria-label="Gợi ý nhanh lưu ý phụ huynh">
      ${parentNoteSuggestions
        .map(
          (suggestion) => `
            <button type="button" data-student-parent-note-suggestion="${escapeAttribute(suggestion)}">
              ${suggestion}
            </button>
          `,
        )
        .join('')}
    </div>
  `
}

function renderStudentFormTabIndex(fieldKey) {
  const tabIndex = studentFormTabOrder[fieldKey]

  if (!Number.isInteger(tabIndex) || tabIndex <= 0) {
    return ''
  }

  return `tabindex="${tabIndex}"`
}

function renderStatCard(label, value, tone = '') {
  return `
    <div class="student-stat-card ${tone ? `is-${tone}` : ''}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `
}

function renderOption(value, label, selectedValue) {
  return `<option value="${escapeAttribute(value)}" ${
    String(value) === String(selectedValue) ? 'selected' : ''
  }>${escapeHtml(label)}</option>`
}

function renderSortableHeader(label, sortBy, filters) {
  const isActive = filters.sortBy === sortBy
  const direction = isActive ? filters.sortDirection : ''
  const symbol = isActive ? (direction === 'desc' ? '↓' : '↑') : '⇅'
  const directionLabel = isActive
    ? direction === 'desc'
      ? 'giảm dần'
      : 'tăng dần'
    : 'chưa sắp xếp'

  return `
    <span class="student-sort-header">
      <span>${label}</span>
      <button
        class="student-sort-button ${isActive ? 'active' : ''}"
        type="button"
        data-student-sort="${sortBy}"
        aria-label="Sắp xếp ${label} ${directionLabel}"
      >
        ${symbol}
      </button>
    </span>
  `
}

function sortStudents(students, filters) {
  const sortBy = filters.sortBy

  if (!sortBy) {
    return students
  }

  const direction = filters.sortDirection === 'desc' ? -1 : 1

  return [...students].sort((firstStudent, secondStudent) => {
    if (sortBy === 'level') {
      return (
        compareStudentLevels(firstStudent, secondStudent) * direction ||
        compareStudentsByName(firstStudent, secondStudent)
      )
    }

    if (sortBy === 'student') {
      return compareStudentsByName(firstStudent, secondStudent) * direction
    }

    return 0
  })
}

function compareStudentsByName(firstStudent, secondStudent) {
  return (
    compareText(getFinalName(firstStudent.fullName), getFinalName(secondStudent.fullName)) ||
    compareText(firstStudent.fullName, secondStudent.fullName) ||
    compareStudentLevels(firstStudent, secondStudent)
  )
}

function compareStudentLevels(firstStudent, secondStudent) {
  const firstLevel = studentLevelOptions.indexOf(getLevelLabel(firstStudent.level))
  const secondLevel = studentLevelOptions.indexOf(getLevelLabel(secondStudent.level))

  return (
    (firstLevel < 0 ? Number.MAX_SAFE_INTEGER : firstLevel) -
    (secondLevel < 0 ? Number.MAX_SAFE_INTEGER : secondLevel)
  )
}

function getFinalName(fullName) {
  const nameParts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean)

  return nameParts.at(-1) ?? ''
}

function compareText(firstValue, secondValue) {
  return String(firstValue ?? '').localeCompare(String(secondValue ?? ''), 'vi', {
    sensitivity: 'base',
  })
}

function renderStudentRow(student, teachers = [], classSessions = []) {
  const hasCareNote = hasRealCareNote(student)
  const contactPhone = student.motherPhone || student.fatherPhone || student.parentPhone
  const classSessionLookup = createClassSessionLookup(classSessions)

  return `
    <tr class="student-row" data-student-id="${student.id}" tabindex="0">
      <td>
        <div class="student-person">
          ${renderStudentAvatar(student)}
          <div>
            <strong title="${escapeAttribute(student.fullName)}">${getShortName(student.fullName)}</strong>
            <span>${formatBirthDate(student.birthDate)}</span>
          </div>
        </div>
      </td>
      <td title="${escapeAttribute(student.parentName)}">${getShortName(student.parentName)}</td>
      <td class="student-phone">${formatPhoneNumber(contactPhone)}</td>
      <td><span class="student-status">${student.currentStatus}</span></td>
      <td>${escapeHtml(getLevelLabel(student.level))}</td>
      <td>${student.elo ?? '—'}</td>
      <td title="${escapeAttribute(student.schoolName)}">${getShortSchoolName(student.schoolName)}</td>
      <td>${renderStudentTeacherCell(student, teachers)}</td>
      <td>${renderStudentClassSessionCell(student, classSessionLookup)}</td>
      <td>
        ${hasCareNote
          ? `<button class="student-note-badge has-note" type="button" title="${escapeAttribute(getLatestCareNoteText(student))}" data-student-note-action="open-care-notes" data-student-id="${escapeAttribute(student.id)}">Có ghi chú</button>`
          : '<span class="student-note-badge is-empty">Không</span>'}
      </td>
    </tr>
  `
}

function renderStudentTeacherCell(student, teachers = []) {
  const assignedTeacherId = normalizeAssignedTeacherId(student.assignedTeacherId)

  if (!assignedTeacherId) {
    return '<span class="student-teacher-empty">Chưa phân công</span>'
  }

  const teacher = createTeacherLookup(teachers).get(assignedTeacherId)

  if (!teacher) {
    return `
      <div class="student-teacher-cell student-teacher-missing" title="Không tìm thấy giáo viên">
        <span class="student-teacher-name">Không tìm thấy</span>
        <span class="student-teacher-warning">Kiểm tra lại</span>
      </div>
    `
  }

  const teacherName = getTeacherDisplayName(teacher)

  return `
    <div class="student-teacher-cell" title="${escapeAttribute(getTeacherOptionLabel(teacher))}">
      <span class="student-teacher-name">${escapeHtml(teacherName)}</span>
      ${
        teacher.status === 'inactive'
          ? '<span class="student-teacher-warning">Ngừng dạy</span>'
          : ''
      }
    </div>
  `
}

function renderStudentClassSessionCell(student, classSessionLookup = new Map()) {
  const classSessionIds = normalizeClassSessionIds(student.classSessionIds)

  if (!classSessionIds.length) {
    return '<span class="student-class-session-unassigned">Chưa phân lớp</span>'
  }

  const classSessionItems = getStudentClassSessionItems(student, classSessionLookup)
  const visibleItems = classSessionItems.slice(0, 2)
  const hiddenCount = Math.max(0, classSessionItems.length - visibleItems.length)
  const title = classSessionItems
    .map((item) => `${item.label}${item.status === 'inactive' ? ' (Đã ngưng)' : ''}`)
    .join(', ')

  return `
    <div class="student-class-session-cell" title="${escapeAttribute(title)}">
      ${visibleItems
        .map(
          (item) => `
            <span class="student-class-session-badge ${item.status === 'inactive' ? 'inactive' : ''}">
              ${escapeHtml(item.label)}
              ${item.status === 'inactive' ? '<em>Đã ngưng</em>' : ''}
            </span>
          `,
        )
        .join('')}
      ${hiddenCount ? `<span class="student-class-session-more">+${hiddenCount} ca</span>` : ''}
    </div>
  `
}

function getTeacherSelectOptions(teachers = []) {
  return [
    { value: '', label: 'Chưa phân công' },
    ...teachers
      .filter((teacher) => teacher && teacher.id)
      .map((teacher) => ({
        value: teacher.id,
        label: getTeacherOptionLabel(teacher),
      })),
  ]
}

function getTeacherOptionLabel(teacher) {
  const teacherName = getTeacherDisplayName(teacher) || 'Giáo viên'
  const statusLabel = getTeacherStatusLabel(teacher.status)

  if (teacher.status === 'inactive') {
    return `${teacherName} - ${statusLabel}`
  }

  return `${teacherName} - ${statusLabel} - ${getTeacherTypeLabel(teacher.teacherType)}`
}

function getTeacherDisplayName(teacher) {
  return String(teacher?.displayName || teacher?.fullName || '').trim()
}

function getTeacherStatusLabel(status) {
  const statusLabels = {
    active: 'Đang dạy',
    paused: 'Tạm nghỉ',
    inactive: 'Ngừng dạy',
  }

  return statusLabels[status] ?? 'Chưa cập nhật'
}

function getTeacherTypeLabel(teacherType) {
  const typeLabels = {
    fulltime: 'Full-time',
    parttime: 'Part-time',
    collaborator: 'Cộng tác viên',
  }

  return typeLabels[teacherType] ?? 'Chưa cập nhật'
}

function createTeacherLookup(teachers = []) {
  return new Map(
    teachers
      .filter((teacher) => teacher && teacher.id)
      .map((teacher) => [String(teacher.id), teacher]),
  )
}

function createClassSessionLookup(classSessions = []) {
  return new Map(
    classSessions
      .filter((classSession) => classSession && classSession.id)
      .map((classSession) => [String(classSession.id), classSession]),
  )
}

function getActiveClassSessions(classSessions = []) {
  return classSessions
    .filter((classSession) => classSession && classSession.status !== 'inactive')
    .sort((firstClassSession, secondClassSession) =>
      getClassSessionDisplayLabel(firstClassSession).localeCompare(
        getClassSessionDisplayLabel(secondClassSession),
        'vi',
        { sensitivity: 'base' },
      ),
    )
}

function getSelectableClassSessions(classSessions = [], selectedIds = new Set()) {
  return classSessions
    .filter(
      (classSession) =>
        classSession &&
        classSession.id &&
        (classSession.status !== 'inactive' || selectedIds.has(classSession.id)),
    )
    .sort((firstClassSession, secondClassSession) =>
      getClassSessionDisplayLabel(firstClassSession).localeCompare(
        getClassSessionDisplayLabel(secondClassSession),
        'vi',
        { sensitivity: 'base' },
      ),
    )
}

function getStudentClassSessionLabels(student, classSessionLookup = new Map()) {
  return getStudentClassSessionItems(student, classSessionLookup).map((item) => item.label)
}

function getStudentClassSessionItems(student, classSessionLookup = new Map()) {
  return normalizeClassSessionIds(student.classSessionIds).map((classSessionId) => {
    const classSession = classSessionLookup.get(classSessionId)
    return classSession
      ? {
          label: getClassSessionDisplayLabel(classSession),
          status: classSession.status === 'inactive' ? 'inactive' : 'active',
        }
      : {
          label: 'Ca học không tìm thấy',
          status: 'missing',
        }
  })
}

function getClassSessionDisplayLabel(classSession) {
  return String(classSession?.displayLabel || classSession?.name || 'Ca học').trim()
}

function normalizeAssignedTeacherId(value) {
  const teacherId = String(value ?? '').trim()
  return teacherId || null
}

function normalizeClassSessionIds(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean)))
    : []
}

function renderStudentAvatar(student) {
  const initial = student.fullName.trim().charAt(0).toUpperCase()
  const avatarUrl = student.avatarUrl || defaultAvatarUrl

  return `
    <span class="student-avatar" aria-label="Ảnh đại diện ${student.fullName}">
      <img src="${avatarUrl}" alt="" onerror="this.style.display='none'" />
      <span>${initial}</span>
    </span>
  `
}

function renderEmptyState() {
  return `
    <tr>
      <td class="student-empty" colspan="10">
        Không tìm thấy học viên phù hợp với bộ lọc hiện tại.
      </td>
    </tr>
  `
}

function getLatestCareNoteText(student) {
  const latestCareNote = [...(student.careNotes ?? [])].sort(
    (firstNote, secondNote) => new Date(secondNote.createdAt) - new Date(firstNote.createdAt),
  )[0]

  return latestCareNote?.content || student.latestCareNote || 'Chưa có ghi chú'
}

function hasRealCareNote(student) {
  const latestCareNote = getLatestCareNoteText(student).trim()
  const normalizedLatestCareNote = normalizeText(latestCareNote)

  return Boolean(
    (student.careNotes ?? []).length ||
      (latestCareNote && !normalizedLatestCareNote.includes('chua co ghi chu')),
  )
}

function getShortName(value) {
  const parts = String(value ?? '').trim().split(/\s+/).filter(Boolean)

  if (parts.length <= 2) {
    return parts.join(' ')
  }

  return parts.slice(-2).join(' ')
}

export function getLevelLabel(level) {
  const legacyLevelMap = {
    'nhap mon': 'Dolphin 1',
    'co ban': 'Dolphin 2',
    'trung cap': 'Dolphin 3',
    'nang cao': 'Dolphin 4',
  }
  const levelText = String(level ?? '').trim()
  const canonicalLevel = studentLevelOptions.find(
    (option) => normalizeText(option) === normalizeText(levelText),
  )

  if (canonicalLevel) {
    return canonicalLevel
  }

  const legacyNamedLevel = legacyLevelMap[normalizeText(levelText)]

  if (legacyNamedLevel) {
    return legacyNamedLevel
  }

  const legacyLevelMatch = levelText.match(/^(?:level\s*)?(\d{1,2})$/i)
  const legacyLevelNumber = legacyLevelMatch ? Number(legacyLevelMatch[1]) : null

  return legacyLevelNumber && legacyLevelNumber >= 1 && legacyLevelNumber <= 15
    ? studentLevelOptions[legacyLevelNumber - 1]
    : levelText || 'Dolphin 1'
}

function getShortSchoolName(value) {
  const schoolName = String(value ?? '').trim()

  if (!schoolName) {
    return '—'
  }

  const normalizedSchoolName = normalizeText(schoolName)
  let shortName = schoolName
  let levelLabel = ''

  if (normalizedSchoolName.includes('thpt')) {
    shortName = schoolName.replace(/trường\s*/i, '').replace(/thpt\s*/i, '').trim()
    levelLabel = 'Cấp 3'
  } else if (normalizedSchoolName.includes('thcs')) {
    shortName = schoolName.replace(/trường\s*/i, '').replace(/thcs\s*/i, '').trim()
    levelLabel = 'Cấp 2'
  } else if (normalizedSchoolName.includes('tieu hoc')) {
    shortName = schoolName.replace(/trường\s*/i, '').replace(/tiểu học\s*/i, '').trim()
    levelLabel = 'Cấp 1'
  }

  return levelLabel ? `${shortName} (${levelLabel})` : schoolName
}

function getSchoolLevelFromName(value) {
  const normalizedSchoolName = normalizeText(value)

  if (normalizedSchoolName.includes('mau giao')) {
    return 'Mẫu giáo'
  }

  if (normalizedSchoolName.includes('tieu hoc')) {
    return 'Cấp 1'
  }

  if (normalizedSchoolName.includes('thcs')) {
    return 'Cấp 2'
  }

  if (normalizedSchoolName.includes('thpt')) {
    return 'Cấp 3'
  }

  return 'Khác'
}

function getTestScoreForForm(value) {
  if (value === '' || value === null || value === undefined) {
    return ''
  }

  const score = Number(String(value).replace(',', '.'))

  if (!Number.isFinite(score)) {
    return ''
  }

  if (score <= 10) {
    return String(score)
  }

  if (score <= 100) {
    return String(Math.round((score / 10) * 2) / 2)
  }

  return ''
}

function getStudentStats(students) {
  return {
    total: students.length,
    active: countByStatus(students, 'Đang theo học'),
    paused: countByStatus(students, 'Bảo lưu'),
    stopped: countByStatus(students, 'Ngưng học'),
    withNotes: students.filter(hasRealCareNote).length,
  }
}

function countByStatus(students, status) {
  return students.filter((student) => student.currentStatus === status).length
}

function formatBirthDate(value) {
  const birthDate = new Date(value)
  const age = new Date().getFullYear() - birthDate.getFullYear()
  const day = String(birthDate.getDate()).padStart(2, '0')
  const month = String(birthDate.getMonth() + 1).padStart(2, '0')
  const year = birthDate.getFullYear()
  return `${day}/${month}/${year} · ${age} tuổi`
}

function formatPhoneNumber(value) {
  const digits = String(value).replace(/\D/g, '')

  if (digits.length !== 10) {
    return value
  }

  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
}

function normalizeText(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
