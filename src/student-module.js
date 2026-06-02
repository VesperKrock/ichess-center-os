import { botMilestones, sampleStudents, studentLevels, studentStatuses } from './student-data.js'

const baseUrl = import.meta.env?.BASE_URL ?? '/'
const defaultAvatarUrl = `${baseUrl}images/avatar.jpg`

export const initialStudentFilters = {
  query: '',
  status: 'all',
  level: 'all',
  selectedStudentId: null,
}

export const emptyStudentFormValues = {
  fullName: '',
  birthDate: '',
  avatarUrl: '',
  schoolName: '',
  hometown: '',
  hobbies: '',
  nationality: 'Việt Nam',
  parentName: '',
  parentBirthYear: '',
  parentPhone: '',
  parentJob: '',
  parentArea: '',
  level: 'Nhập môn',
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
  schoolName: 'Học sinh trường nào',
  parentName: 'Họ và tên phụ huynh',
  parentPhone: 'Số điện thoại phụ huynh',
  level: 'Cấp độ',
}

export function createEmptyStudentFormState() {
  return {
    mode: 'create',
    studentId: null,
    values: { ...emptyStudentFormValues },
    errors: {},
  }
}

export function createEditStudentFormState(student) {
  return {
    mode: 'edit',
    studentId: student.id,
    values: {
      fullName: student.fullName ?? '',
      birthDate: student.birthDate ?? '',
      avatarUrl: student.avatarUrl ?? '',
      schoolName: student.schoolName ?? '',
      hometown: student.hometown ?? '',
      hobbies: student.hobbies ?? '',
      nationality: student.nationality ?? '',
      parentName: student.parentName ?? '',
      parentBirthYear: student.parentBirthYear ?? '',
      parentPhone: student.parentPhone ?? '',
      parentJob: student.parentJob ?? '',
      parentArea: student.parentArea ?? '',
      level: student.level ?? 'Nhập môn',
      testScore: student.testScore ?? '',
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
  const selectedStudent = students.find((student) => student.id === filters.selectedStudentId)
  const stats = getStudentStats(students)

  return `
    <section class="student-module ${formState ? 'form-open' : ''}" aria-labelledby="student-module-title">
      <div class="student-module-content">
        <div class="student-module-header">
          <div>
            <h3 id="student-module-title">Học viên</h3>
            <p>Quản lý danh sách học viên tại cơ sở DreamHome.</p>
          </div>
          <button class="student-add-button" type="button" data-student-action="open-create">
            + Thêm học viên
          </button>
        </div>

        <div class="student-stats" aria-label="Thống kê nhanh học viên">
          ${renderStatCard('Tổng học viên', stats.total)}
          ${renderStatCard('Đang theo học', stats.active)}
          ${renderStatCard('Bảo lưu', stats.paused)}
          ${renderStatCard('Ngưng học', stats.stopped)}
        </div>

        <div class="student-toolbar">
          <label>
            <span>Tìm kiếm</span>
            <input
              type="search"
              value="${escapeAttribute(filters.query)}"
              placeholder="Tên học viên, phụ huynh, số điện thoại, trường học"
              data-student-filter="query"
            />
          </label>
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
            <span>Cấp độ</span>
            <select data-student-filter="level">
              ${renderOption('all', 'Tất cả cấp độ', filters.level)}
              ${studentLevels.map((level) => renderOption(level, level, filters.level)).join('')}
            </select>
          </label>
        </div>

        <div class="student-content-grid">
          <div class="student-table-wrap">
            <table class="student-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Phụ huynh</th>
                  <th>SĐT</th>
                  <th>Trạng thái</th>
                  <th>Cấp độ</th>
                  <th>Mốc bot</th>
                  <th>Trường học</th>
                  <th>Ghi chú gần nhất</th>
                  <th>Thao tác</th>
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
          <aside class="student-quick-panel" aria-label="Đọc nhanh học viên">
            ${selectedStudent ? renderSelectedStudent(selectedStudent) : renderDetailPlaceholder()}
          </aside>
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

  const normalizedQuery = normalizeText(filters.query)
  const queryDigits = String(filters.query).replace(/\D/g, '')

  return students.filter((student) => {
    const matchesQuery =
      !normalizedQuery ||
      [
        student.fullName,
        student.parentName,
        student.schoolName,
      ].some((value) => normalizeText(value).includes(normalizedQuery)) ||
      (queryDigits && String(student.parentPhone).replace(/\D/g, '').includes(queryDigits))

    const matchesStatus = filters.status === 'all' || student.currentStatus === filters.status
    const matchesLevel = filters.level === 'all' || student.level === filters.level

    return matchesQuery && matchesStatus && matchesLevel
  })
}

export function validateStudentForm(values) {
  return Object.entries(requiredFields).reduce((errors, [field, label]) => {
    if (!String(values[field] ?? '').trim()) {
      errors[field] = `${label} là bắt buộc.`
    }

    return errors
  }, {})
}

export function buildStudentFromForm(values, existingStudent = null) {
  const now = new Date().toISOString()
  const normalizedValues = {
    ...values,
    parentBirthYear: values.parentBirthYear ? Number(values.parentBirthYear) : '',
    testScore: values.testScore ? Number(values.testScore) : '',
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

  return `
    <div class="student-form-backdrop" aria-hidden="true"></div>
    <section class="student-form-panel" aria-label="${title}">
      <div class="student-form-header">
        <div>
          <h4>${title}</h4>
          <p>${isEdit ? 'Cập nhật thông tin học viên đã chọn.' : 'Nhập thông tin học viên mới.'}</p>
        </div>
      </div>
      ${
        Object.keys(formState.errors).length
          ? `<div class="student-form-errors">${Object.values(formState.errors)
              .map((error) => `<p>${error}</p>`)
              .join('')}</div>`
          : ''
      }
      <div class="student-form-grid">
        ${renderFormSection('A. Thông tin học viên', [
          renderField('fullName', 'Họ và tên học viên *', formState, 'text'),
          renderField('birthDate', 'Ngày tháng năm sinh *', formState, 'date'),
          renderField('avatarUrl', 'Ảnh đại diện URL', formState, 'url'),
          `<button class="student-secondary-button" type="button" data-student-action="use-default-avatar">Dùng ảnh mặc định</button>`,
          renderField('schoolName', 'Học sinh trường nào *', formState, 'text'),
          renderField('hometown', 'Quê quán', formState, 'text'),
          renderField('hobbies', 'Sở thích', formState, 'text'),
          renderField('nationality', 'Quốc tịch', formState, 'text'),
        ])}
        ${renderFormSection('B. Thông tin phụ huynh', [
          renderField('parentName', 'Họ và tên phụ huynh *', formState, 'text'),
          renderField('parentBirthYear', 'Năm sinh phụ huynh', formState, 'number'),
          renderField('parentPhone', 'Số điện thoại phụ huynh *', formState, 'tel'),
          renderField('parentJob', 'Nghề nghiệp', formState, 'text'),
          renderField('parentArea', 'Khu vực sinh sống', formState, 'text'),
        ])}
        ${renderFormSection('C. Trạng thái học', [
          renderSelectField('level', 'Cấp độ *', formState, studentLevels),
          renderField('testScore', 'Điểm bài thi', formState, 'number'),
          renderSelectField('highestBotMilestone', 'Mốc bot đã vượt qua', formState, botMilestones),
          renderTextareaField('personality', 'Tính cách học viên', formState),
        ])}
        ${renderFormSection('D. Chăm sóc / ghi chú ban đầu', [
          renderSelectField('currentStatus', 'Trạng thái hiện tại', formState, studentStatuses),
          renderTextareaField('achievements', 'Thành tích học viên đạt được', formState),
          renderTextareaField('parentNotes', 'Thông tin đã trao đổi / lưu ý từ phụ huynh', formState),
        ])}
      </div>
      <div class="student-form-actions">
        <button class="student-save-button" type="button" data-student-action="save-form">
          ${isEdit ? 'Lưu thay đổi' : 'Lưu học viên'}
        </button>
        <button class="student-secondary-button" type="button" data-student-action="cancel-form">
          ${isEdit ? 'Hủy sửa' : 'Hủy thêm'}
        </button>
      </div>
    </section>
  `
}

function renderFormSection(title, fields) {
  return `
    <fieldset class="student-form-section">
      <legend>${title}</legend>
      ${fields.join('')}
    </fieldset>
  `
}

function renderField(name, label, formState, type) {
  return `
    <label class="${formState.errors[name] ? 'has-error' : ''}">
      <span>${label}</span>
      <input
        type="${type}"
        value="${escapeAttribute(formState.values[name] ?? '')}"
        data-student-form-field="${name}"
      />
    </label>
  `
}

function renderTextareaField(name, label, formState) {
  return `
    <label>
      <span>${label}</span>
      <textarea data-student-form-field="${name}">${formState.values[name] ?? ''}</textarea>
    </label>
  `
}

function renderSelectField(name, label, formState, options) {
  return `
    <label class="${formState.errors[name] ? 'has-error' : ''}">
      <span>${label}</span>
      <select data-student-form-field="${name}">
        ${options.map((option) => renderOption(option, option, formState.values[name])).join('')}
      </select>
    </label>
  `
}

function renderStatCard(label, value) {
  return `
    <div class="student-stat-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `
}

function renderOption(value, label, selectedValue) {
  return `<option value="${escapeAttribute(value)}" ${
    value === selectedValue ? 'selected' : ''
  }>${label}</option>`
}

function renderStudentRow(student) {
  return `
    <tr class="student-row" data-student-id="${student.id}" tabindex="0">
      <td>
        <div class="student-person">
          ${renderStudentAvatar(student)}
          <div>
            <strong>${student.fullName}</strong>
            <span>${formatBirthDate(student.birthDate)}</span>
          </div>
        </div>
      </td>
      <td>${student.parentName}</td>
      <td class="student-phone">${formatPhoneNumber(student.parentPhone)}</td>
      <td><span class="student-status">${student.currentStatus}</span></td>
      <td>${student.level}</td>
      <td>${student.highestBotMilestone}</td>
      <td>${student.schoolName}</td>
      <td><span class="student-note-cell">${student.latestCareNote}</span></td>
      <td>
        <button class="student-row-action" type="button" data-student-action="open-edit" data-student-edit-id="${student.id}">
          Sửa
        </button>
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

function renderSelectedStudent(student) {
  return `
    <div class="quick-panel-header">
      ${renderStudentAvatar(student)}
      <div>
        <h4>${student.fullName}</h4>
        <p>${student.currentStatus} · ${student.level}</p>
      </div>
    </div>
    <dl>
      <div><dt>Trường</dt><dd>${student.schoolName}</dd></div>
      <div><dt>Phụ huynh</dt><dd>${student.parentName}</dd></div>
      <div><dt>Điện thoại</dt><dd>${formatPhoneNumber(student.parentPhone)}</dd></div>
      <div><dt>Điểm bài thi</dt><dd>${student.testScore}</dd></div>
      <div><dt>Tính cách</dt><dd>${student.personality}</dd></div>
      <div><dt>Thành tích</dt><dd>${student.achievements}</dd></div>
      <div><dt>Lưu ý phụ huynh</dt><dd>${student.parentNotes}</dd></div>
    </dl>
    <p class="student-detail-note">Chi tiết học viên sẽ được bổ sung ở Module 1C.</p>
  `
}

function renderDetailPlaceholder() {
  return `
    <h4>Đọc nhanh</h4>
    <p>Chọn một học viên trong danh sách để xem thông tin tóm tắt.</p>
    <p class="student-detail-note">Chi tiết học viên sẽ được bổ sung ở Module 1C.</p>
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

function getStudentStats(students) {
  return {
    total: students.length,
    active: countByStatus(students, 'Đang theo học'),
    paused: countByStatus(students, 'Bảo lưu'),
    stopped: countByStatus(students, 'Ngưng học'),
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
