import { botMilestones, sampleStudents, studentStatuses } from './student-data.js'

const baseUrl = import.meta.env?.BASE_URL ?? '/'
const defaultAvatarUrl = `${baseUrl}images/avatar.jpg`
const levelFilterOptions = Array.from({ length: 15 }, (_, index) => `Level ${index + 1}`)
const levelSelectOptions = Array.from({ length: 15 }, (_, index) => ({
  value: String(index + 1),
  label: `Level ${index + 1}`,
}))
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

export const initialStudentFilters = {
  query: '',
  status: 'all',
  level: 'all',
  sortBy: '',
  sortDirection: 'asc',
  selectedStudentId: null,
}

export const emptyStudentFormValues = {
  fullName: '',
  birthDate: '',
  avatarUrl: '',
  schoolName: '',
  schoolLevel: 'Khác',
  gender: '',
  hometown: '',
  hobbies: '',
  nationality: 'Việt Nam',
  parentName: '',
  parentBirthYear: '',
  parentPhone: '',
  parentJob: '',
  parentArea: '',
  level: '1',
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
  parentPhone: 'Số điện thoại phụ huynh',
  level: 'Level',
}

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
      schoolName: student.schoolName ?? '',
      schoolLevel: student.schoolLevel ?? getSchoolLevelFromName(student.schoolName),
      gender: student.gender ?? '',
      hometown: student.hometown ?? '',
      hobbies: student.hobbies ?? '',
      nationality: student.nationality ?? '',
      parentName: student.parentName ?? '',
      parentBirthYear: student.parentBirthYear ? String(student.parentBirthYear) : '',
      parentPhone: formatPhoneNumber(student.parentPhone ?? ''),
      parentJob: student.parentJob ?? '',
      parentArea: student.parentArea ?? '',
      level: String(getLevelNumber(student.level) ?? 1),
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

export function renderStudentModule(students, filters, formState) {
  const filteredStudents = getFilteredStudents(students, filters)
  const stats = getStudentStats(students)

  return `
    <section class="student-module ${formState ? 'form-open' : ''}" aria-labelledby="student-module-title">
      <div class="student-module-content">
        <h3 class="sr-only" id="student-module-title">Học viên</h3>
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
                <span>Level</span>
                <select data-student-filter="level">
                  ${renderOption('all', 'Tất cả level', filters.level)}
                  ${levelFilterOptions
                    .map((level) => renderOption(level, level, filters.level))
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
                  <th>${renderSortableHeader('Level', 'level', filters)}</th>
                  <th>Elo</th>
                  <th>Trường học</th>
                  <th>Giáo viên phụ trách</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                ${
                  filteredStudents.length
                    ? filteredStudents.map(renderStudentRow).join('')
                    : renderEmptyState()
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ${formState ? renderStudentForm(formState) : ''}
    </section>
  `
}

export function getFilteredStudents(students = sampleStudents, filters) {
  if (!Array.isArray(students)) {
    filters = students
    students = sampleStudents
  }

  const activeFilters = { ...initialStudentFilters, ...filters }
  const normalizedQuery = normalizeText(activeFilters.query)
  const queryDigits = String(activeFilters.query).replace(/\D/g, '')

  const filteredStudents = students.filter((student) => {
    const matchesQuery =
      !normalizedQuery ||
      [
        student.fullName,
        student.parentName,
        student.schoolName,
      ].some((value) => normalizeText(value).includes(normalizedQuery)) ||
      (queryDigits && String(student.parentPhone).replace(/\D/g, '').includes(queryDigits))

    const matchesStatus =
      activeFilters.status === 'all' || student.currentStatus === activeFilters.status
    const matchesLevel =
      activeFilters.level === 'all' || getLevelLabel(student.level) === activeFilters.level

    return matchesQuery && matchesStatus && matchesLevel
  })

  return sortStudents(filteredStudents, activeFilters)
}

export function validateStudentForm(values) {
  const errors = Object.entries(requiredFields).reduce((currentErrors, [field, label]) => {
    if (!String(values[field] ?? '').trim()) {
      currentErrors[field] = `${label} là bắt buộc.`
    }

    return currentErrors
  }, {})

  const parentPhoneDigits = String(values.parentPhone ?? '').replace(/\D/g, '')

  if (values.parentPhone && parentPhoneDigits.length !== 10) {
    errors.parentPhone = 'Số điện thoại phụ huynh cần đủ 10 chữ số.'
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
      errors.testScore = 'Điểm bài thi cần từ 0 đến 10 và theo bước 0.5.'
    }
  }

  return errors
}

export function isStudentFormReady(values) {
  return Object.keys(validateStudentForm(values)).length === 0
}

export function formatStudentPhoneNumber(value) {
  return formatPhoneNumber(value)
}

export function buildStudentFromForm(values, existingStudent = null) {
  const now = new Date().toISOString()
  const normalizedValues = {
    ...values,
    avatarUrl: values.avatarUrl || existingStudent?.avatarUrl || '',
    level: getLevelNumber(values.level) ?? values.level,
    parentBirthYear: values.parentBirthYear ? Number(values.parentBirthYear) : '',
    parentPhone: formatPhoneNumber(values.parentPhone),
    testScore: values.testScore ? Number(String(values.testScore).replace(',', '.')) : '',
    latestCareNote: values.parentNotes || 'Chưa có ghi chú chăm sóc.',
  }

  return {
    id: existingStudent?.id ?? `stu-${Date.now()}`,
    ...existingStudent,
    ...normalizedValues,
    createdAt: existingStudent?.createdAt ?? now,
    updatedAt: now,
  }
}

function renderStudentForm(formState) {
  const isEdit = formState.mode === 'edit'
  const title = isEdit ? 'Sửa học viên' : 'Thêm học viên'
  const currentStep = formState.step ?? 1
  const isReadyToSave = isStudentFormReady(formState.values)

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
            <button class="${currentStep === 2 ? 'active' : ''}" type="button" data-student-form-step="2">
              2. Phụ huynh / chăm sóc
            </button>
          </div>
        </div>
        <div class="student-form-header-actions">
          <button
            class="student-save-button"
            type="button"
            data-student-action="save-form"
            ${isReadyToSave ? '' : 'disabled'}
          >
            ${isEdit ? 'Lưu thay đổi' : 'Lưu học viên'}
          </button>
          <button class="student-danger-button" type="button" data-student-action="cancel-form">
            ${isEdit ? 'Hủy sửa' : 'Hủy thêm'}
          </button>
        </div>
      </div>
      ${
        isReadyToSave
          ? ''
          : '<p class="student-form-hint">Cần nhập đủ các mục có dấu * để lưu.</p>'
      }
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
                  renderSelectField('level', 'Level *', formState, levelSelectOptions),
                  renderSelectField('highestBotMilestone', 'Mốc bot đã vượt qua', formState, botMilestones),
                  renderTextareaField('personality', 'Tính cách học viên', formState, {
                    className: 'span-full',
                  }),
                  renderField('hobbies', 'Sở thích', formState, 'text'),
                  renderField('testScore', 'Điểm bài thi', formState, 'number', {
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
                  renderField('parentPhone', 'Số điện thoại phụ huynh *', formState, 'tel', {
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
      <div class="student-form-actions">
        ${
          currentStep === 1
            ? '<span></span><button class="student-secondary-button student-step-button" type="button" data-student-form-step="2">Thông tin phụ huynh →</button>'
            : '<button class="student-secondary-button student-step-button" type="button" data-student-form-step="1">← Thông tin học viên</button><span></span>'
        }
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
      <textarea data-student-form-field="${name}">${formState.values[name] ?? ''}</textarea>
      ${options.after ?? ''}
    </label>
  `
}

function renderSelectField(name, label, formState, options) {
  return `
    <label class="${formState.errors[name] ? 'has-error' : ''}">
      <span>${label}</span>
      <select data-student-form-field="${name}">
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
  }>${label}</option>`
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
  const firstLevel = getLevelNumber(firstStudent.level) ?? Number.MAX_SAFE_INTEGER
  const secondLevel = getLevelNumber(secondStudent.level) ?? Number.MAX_SAFE_INTEGER

  return firstLevel - secondLevel
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

function renderStudentRow(student) {
  const hasCareNote = hasRealCareNote(student)

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
      <td class="student-phone">${formatPhoneNumber(student.parentPhone)}</td>
      <td><span class="student-status">${student.currentStatus}</span></td>
      <td>${getLevelLabel(student.level)}</td>
      <td>${student.elo ?? '—'}</td>
      <td title="${escapeAttribute(student.schoolName)}">${getShortSchoolName(student.schoolName)}</td>
      <td title="${escapeAttribute(student.mainTeacherName ?? '')}">${student.mainTeacherName || '—'}</td>
      <td>
        ${hasCareNote
          ? `<button class="student-note-badge has-note" type="button" title="${escapeAttribute(getLatestCareNoteText(student))}">Có ghi chú</button>`
          : '<span class="student-note-badge is-empty">Không</span>'}
      </td>
    </tr>
  `
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
      <td class="student-empty" colspan="9">
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

function getLevelLabel(level) {
  const levelNumber = getLevelNumber(level)

  if (levelNumber) {
    return `Level ${levelNumber}`
  }

  return level ?? '—'
}

function getLevelNumber(level) {
  const legacyLevelMap = {
    'nhap mon': 1,
    'co ban': 2,
    'trung cap': 3,
    'nang cao': 4,
  }
  const levelText = String(level ?? '').trim()
  const legacyLevelNumber = legacyLevelMap[normalizeText(levelText)]

  if (legacyLevelNumber) {
    return legacyLevelNumber
  }

  const levelMatch = levelText.match(/\d+/)
  const levelNumber = levelMatch ? Number(levelMatch[0]) : null

  return levelNumber && levelNumber >= 1 && levelNumber <= 15 ? levelNumber : null
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
