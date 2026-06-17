export const initialSettingsFilters = {
  query: '',
  status: 'all',
}

const classSessionStatusOptions = [
  { value: 'active', label: 'Đang dùng' },
  { value: 'inactive', label: 'Đã ngưng' },
]

export const classSessionDayOptions = [
  { value: 'mon', label: 'T2' },
  { value: 'tue', label: 'T3' },
  { value: 'wed', label: 'T4' },
  { value: 'thu', label: 'T5' },
  { value: 'fri', label: 'T6' },
  { value: 'sat', label: 'T7' },
  { value: 'sun', label: 'CN' },
]

export function createEmptySettingsClassSessionFormState() {
  return {
    mode: 'create',
    classSessionId: null,
    values: {
      name: '',
      daysLabel: '',
      daysOfWeek: [],
      startTime: '',
      endTime: '',
      note: '',
      status: 'active',
    },
    errors: {},
  }
}

export function createEditSettingsClassSessionFormState(classSession) {
  return {
    mode: 'edit',
    classSessionId: classSession.id,
    values: {
      name: classSession.name || classSession.displayLabel || '',
      daysLabel: classSession.daysLabel || '',
      daysOfWeek: normalizeClassSessionDaysOfWeek(classSession.daysOfWeek, classSession.daysLabel || classSession.dayLabel),
      startTime: classSession.startTime || '',
      endTime: classSession.endTime || '',
      note: classSession.note || '',
      status: classSession.status === 'inactive' ? 'inactive' : 'active',
    },
    errors: {},
  }
}

export function validateSettingsClassSessionForm(values) {
  const errors = {}

  if (!String(values.name ?? '').trim()) {
    errors.name = 'Tên ca học là bắt buộc.'
  }

  if (!normalizeClassSessionDaysOfWeek(values.daysOfWeek, values.daysLabel).length) {
    errors.daysOfWeek = 'Chọn ít nhất 1 ngày học.'
  }

  if (values.startTime && !isValidTime(values.startTime)) {
    errors.startTime = 'Giờ bắt đầu cần đúng dạng HH:mm.'
  }

  if (values.endTime && !isValidTime(values.endTime)) {
    errors.endTime = 'Giờ kết thúc cần đúng dạng HH:mm.'
  }

  return errors
}

export function buildSettingsClassSessionFromForm(
  values,
  existingClassSession = null,
  classSessions = [],
) {
  const now = new Date().toISOString()
  const name = String(values.name ?? '').trim()
  const daysOfWeek = normalizeClassSessionDaysOfWeek(values.daysOfWeek, values.daysLabel)
  const daysLabel = buildClassSessionDaysLabel(daysOfWeek) || String(values.daysLabel ?? '').trim()
  const startTime = String(values.startTime ?? '').trim()
  const endTime = String(values.endTime ?? '').trim()
  const displayLabel = buildClassSessionDisplayLabel({ name, daysLabel, startTime, endTime })

  return {
    id: existingClassSession?.id || createClassSessionId(displayLabel || name, classSessions),
    name,
    daysOfWeek,
    daysLabel,
    dayLabel: daysLabel,
    startTime,
    endTime,
    displayLabel,
    status: values.status === 'inactive' ? 'inactive' : 'active',
    note: String(values.note ?? '').trim(),
    createdAt: existingClassSession?.createdAt || now,
    updatedAt: now,
  }
}

export function renderSettingsModule(
  classSessions = [],
  students = [],
  filters = initialSettingsFilters,
  formState = null,
  cloudDbPanelState = null,
) {
  const activeFilters = { ...initialSettingsFilters, ...filters }
  const filteredClassSessions = getFilteredSettingsClassSessions(
    classSessions,
    students,
    activeFilters,
  )
  const stats = getClassSessionStats(classSessions)

  return `
    <section class="settings-module" aria-label="Cài đặt cơ sở">
      <div class="settings-header">
        <div>
          <h3>Cài đặt cơ sở</h3>
          <p>Quản lý các dữ liệu nền phục vụ vận hành cơ sở DreamHome.</p>
        </div>
        <div class="settings-summary">
          <span>${stats.total} ca học</span>
          <span>${stats.active} đang dùng</span>
          <span>${stats.inactive} đã ngưng</span>
        </div>
      </div>

      <div class="settings-tabs" aria-label="Nhóm cài đặt">
        <span>Thông tin cơ sở - đã lên kế hoạch</span>
        <strong>Ca học / Lớp</strong>
        <span>Gói học phí - đã lên kế hoạch</span>
        <span>Dữ liệu mẫu - đã lên kế hoạch</span>
      </div>

      <section class="settings-class-session-panel" aria-label="Quản lý Ca học / Lớp">
        <div class="settings-panel-header">
          <div>
            <h4>Ca học / Lớp</h4>
            <p>Danh mục ca học dùng chung với Module Học viên qua cùng localStorage.</p>
          </div>
          <button type="button" data-settings-class-session-action="open-create">
            + Thêm ca học
          </button>
        </div>

        <div class="settings-class-session-toolbar">
          <label>
            <span>Tìm kiếm</span>
            <input
              type="search"
              value="${escapeAttribute(activeFilters.query)}"
              placeholder="Tìm tên ca, ngày học, ghi chú..."
              data-settings-filter="query"
            />
          </label>
          <label>
            <span>Trạng thái</span>
            <select data-settings-filter="status">
              ${renderOption('all', 'Tất cả trạng thái', activeFilters.status)}
              ${classSessionStatusOptions
                .map((option) => renderOption(option.value, option.label, activeFilters.status))
                .join('')}
            </select>
          </label>
        </div>

        <div class="settings-class-session-table-wrap">
          <table class="settings-class-session-table">
            <thead>
              <tr>
                <th>Ca học / Lớp</th>
                <th>Ngày học</th>
                <th>Giờ học</th>
                <th>Số học viên</th>
                <th>Trạng thái</th>
                <th>Ghi chú</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${
                filteredClassSessions.length
                  ? filteredClassSessions
                      .map((classSession) => renderClassSessionRow(classSession, students))
                      .join('')
                  : renderEmptyClassSessionRow()
              }
            </tbody>
          </table>
        </div>
      </section>

      ${renderCloudDbPanel(cloudDbPanelState)}

      ${formState ? renderSettingsClassSessionForm(formState) : ''}
    </section>
  `
}

export function getFilteredSettingsClassSessions(
  classSessions = [],
  students = [],
  filters = initialSettingsFilters,
) {
  const activeFilters = { ...initialSettingsFilters, ...filters }
  const query = normalizeSearchText(activeFilters.query)

  return [...classSessions]
    .filter((classSession) => {
      const matchesStatus =
        activeFilters.status === 'all' || classSession.status === activeFilters.status
      const matchesQuery =
        !query ||
        [
          classSession.name,
          classSession.displayLabel,
          classSession.daysLabel,
          classSession.startTime,
          classSession.endTime,
          classSession.note,
        ].some((value) => normalizeSearchText(value).includes(query))

      return matchesStatus && matchesQuery
    })
    .sort((firstClassSession, secondClassSession) => {
      const firstStatusRank = firstClassSession.status === 'inactive' ? 1 : 0
      const secondStatusRank = secondClassSession.status === 'inactive' ? 1 : 0

      return (
        firstStatusRank - secondStatusRank ||
        compareText(firstClassSession.daysLabel, secondClassSession.daysLabel) ||
        compareText(firstClassSession.startTime, secondClassSession.startTime) ||
        compareText(getClassSessionDisplayLabel(firstClassSession), getClassSessionDisplayLabel(secondClassSession))
      )
    })
    .map((classSession) => ({
      ...classSession,
      studentCount: getClassSessionStudentCount(classSession.id, students),
    }))
}

export function getClassSessionStudentCount(classSessionId, students = []) {
  const targetId = String(classSessionId ?? '')
  return students.filter(
    (student) =>
      !student.isDeleted &&
      Array.isArray(student.classSessionIds) &&
      student.classSessionIds.map(String).includes(targetId),
  ).length
}

function renderClassSessionRow(classSession, students = []) {
  const studentCount =
    typeof classSession.studentCount === 'number'
      ? classSession.studentCount
      : getClassSessionStudentCount(classSession.id, students)
  const statusLabel = getClassSessionStatusLabel(classSession.status)
  const actionLabel = classSession.status === 'inactive' ? 'Kích hoạt lại' : 'Ngưng dùng'

  return `
    <tr>
      <td>
        <strong title="${escapeAttribute(getClassSessionDisplayLabel(classSession))}">
          ${escapeHtml(getClassSessionDisplayLabel(classSession))}
        </strong>
      </td>
      <td>${escapeHtml(classSession.daysLabel || '—')}</td>
      <td>${escapeHtml(formatClassSessionTimeRange(classSession))}</td>
      <td>${studentCount} học viên</td>
      <td>
        <span class="settings-status-badge ${classSession.status === 'inactive' ? 'inactive' : ''}">
          ${statusLabel}
        </span>
      </td>
      <td title="${escapeAttribute(classSession.note || '')}">${escapeHtml(classSession.note || '—')}</td>
      <td>
        <div class="settings-class-session-actions">
          <button type="button" data-settings-class-session-action="open-edit" data-class-session-id="${escapeAttribute(classSession.id)}">
            Sửa
          </button>
          <button type="button" data-settings-class-session-action="toggle-status" data-class-session-id="${escapeAttribute(classSession.id)}">
            ${actionLabel}
          </button>
        </div>
      </td>
    </tr>
  `
}

function renderEmptyClassSessionRow() {
  return `
    <tr>
      <td class="settings-empty" colspan="7">Không tìm thấy ca học phù hợp.</td>
    </tr>
  `
}

function renderCloudDbPanel(state = null) {
  const panelState = {
    configStatus: 'missing-config',
    authStatus: 'signed-out',
    membershipStatus: 'idle',
    role: '',
    isLoading: false,
    localCounts: { student: 0, teacher: 0, class_session: 0 },
    cloudCounts: null,
    message: '',
    messageTone: '',
    readinessStatus: 'idle',
    localAngelWingsStatus: {
      isReadyForCloudPush: false,
      looksLikeOldSeed: false,
      studentCount: 0,
      classSessionCount: 0,
      hasTeacher: false,
    },
    ...state,
  }
  const canUseCloud =
    panelState.configStatus === 'configured' &&
    panelState.authStatus === 'signed-in' &&
    panelState.membershipStatus === 'loaded' &&
    Boolean(panelState.role)
  const cloudReady = canUseCloud && panelState.readinessStatus === 'ready'
  const cloudCounts = cloudReady && panelState.cloudCounts
    ? panelState.cloudCounts
    : { student: '—', teacher: '—', class_session: '—' }
  const localAngelWingsReady = Boolean(panelState.localAngelWingsStatus?.isReadyForCloudPush)
  const disabled = panelState.isLoading || !cloudReady || !localAngelWingsReady
  const message = formatCloudDbPanelValue(panelState.message)

  return `
    <details class="settings-cloud-db-panel" aria-label="Cloud DB online core" ${message || canUseCloud ? 'open' : ''}>
      <summary>
        <span>Cloud DB online core</span>
        <strong>${cloudReady ? 'Ready' : 'Advanced'}</strong>
      </summary>
      <div class="settings-panel-header">
        <div>
          <h4>Cloud DB online core</h4>
          <p>C2 đọc/ghi cloud cho 3 nhóm dữ liệu lõi: Học viên, Giáo viên, Ca học/Lớp.</p>
        </div>
        <span class="settings-cloud-db-badge ${cloudReady ? 'is-ready' : ''}">
          ${cloudReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
        </span>
      </div>
      <div class="settings-cloud-db-status">
        <span>Supabase: <strong>${panelState.configStatus === 'configured' ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong></span>
        <span>Đăng nhập: <strong>${panelState.authStatus === 'signed-in' ? 'Đã đăng nhập' : 'Chưa đăng nhập'}</strong></span>
        <span>DreamHome: <strong>${panelState.role || 'Chưa có quyền'}</strong></span>
        <span>Cloud DB: <strong>${getCloudDbReadinessLabel(panelState.readinessStatus)}</strong></span>
        <span>Angel Wings local: <strong>${getAngelWingsLocalStatusLabel(panelState.localAngelWingsStatus)}</strong></span>
      </div>
      <div class="settings-cloud-db-counts">
        <div>
          <strong>Local</strong>
          <span>Học viên ${formatCloudDbPanelValue(panelState.localCounts.student)}</span>
          <span>Giáo viên ${formatCloudDbPanelValue(panelState.localCounts.teacher)}</span>
          <span>Ca học ${formatCloudDbPanelValue(panelState.localCounts.class_session)}</span>
        </div>
        <div>
          <strong>Cloud</strong>
          <span>Học viên ${formatCloudDbPanelValue(cloudCounts.student)}</span>
          <span>Giáo viên ${formatCloudDbPanelValue(cloudCounts.teacher)}</span>
          <span>Ca học ${formatCloudDbPanelValue(cloudCounts.class_session)}</span>
        </div>
      </div>
      ${
        message
          ? `<p class="settings-cloud-db-message ${panelState.messageTone === 'success' ? 'is-success' : 'is-error'}">${escapeHtml(message)}</p>`
          : ''
      }
      <div class="settings-cloud-db-actions">
        <button type="button" data-cloud-db-action="refresh" ${panelState.isLoading || !canUseCloud ? 'disabled' : ''}>
          ${panelState.isLoading ? 'Đang xử lý...' : 'Làm mới số liệu'}
        </button>
        <button type="button" data-cloud-db-action="restore-angel-wings-local" ${panelState.isLoading ? 'disabled' : ''}>
          Khôi phục dữ liệu Angel Wings 06/2026 vào local
        </button>
        <button type="button" data-cloud-db-action="push" ${disabled ? 'disabled' : ''}>
          Đẩy local lên cloud
        </button>
        <button type="button" data-cloud-db-action="pull" ${disabled ? 'disabled' : ''}>
          Tải cloud về local
        </button>
      </div>
      <p class="settings-cloud-db-warning">
        ${getCloudDbPushWarning(panelState.localAngelWingsStatus)}
      </p>
    </details>
  `
}

function formatCloudDbPanelValue(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString('vi-VN') : ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (value instanceof Error) {
    return value.message
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getCloudDbReadinessLabel(status) {
  const labels = {
    ready: 'Sẵn sàng',
    checking: 'Đang kiểm tra',
    error: 'Chưa sẵn sàng',
    blocked: 'Chưa có quyền',
    idle: 'Chưa kiểm tra',
  }

  return labels[status] || 'Chưa kiểm tra'
}

function getAngelWingsLocalStatusLabel(status = {}) {
  if (status.isReadyForCloudPush) {
    return `${formatCloudDbPanelValue(status.studentCount)} học viên / ${formatCloudDbPanelValue(status.classSessionCount)} ca`
  }

  if (status.looksLikeOldSeed) {
    return 'Đang là seed cũ 8 học viên'
  }

  return 'Chưa có marker Angel Wings'
}

function getCloudDbPushWarning(status = {}) {
  if (status.isReadyForCloudPush) {
    return 'C2.3 chỉ đẩy Học viên, Giáo viên, Ca học/Lớp lên cloud. Không đẩy học phí, điểm danh, Thu chi, Sổ quỹ, notification hoặc ảnh.'
  }

  if (status.looksLikeOldSeed) {
    return 'Đang phát hiện local seed cũ 8 học viên. Hãy khôi phục Angel Wings 06/2026 trước khi đẩy local lên cloud.'
  }

  return 'Chưa đủ marker Angel Wings 06/2026 trong local. Hãy khôi phục/kiểm tra local trước khi đẩy cloud.'
}

function renderSettingsClassSessionForm(formState) {
  const isEdit = formState.mode === 'edit'
  const title = isEdit ? 'Sửa ca học' : 'Thêm ca học'
  const values = formState.values ?? {}
  const errors = formState.errors ?? {}

  return `
    <div class="settings-form-backdrop" role="presentation">
      <section class="settings-class-session-form" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="settings-form-header">
          <h4>${title}</h4>
          <button type="button" data-settings-class-session-action="cancel-form" aria-label="Đóng form">×</button>
        </div>
        <div class="settings-form-grid">
          ${renderField('name', 'Tên ca học *', values.name, errors.name, {
            className: 'span-full',
            placeholder: 'T7 15:00-16:30',
          })}
          ${renderDaysOfWeekField(values.daysOfWeek, errors.daysOfWeek)}
          ${renderField('startTime', 'Giờ bắt đầu', values.startTime, errors.startTime, {
            type: 'time',
          })}
          ${renderField('endTime', 'Giờ kết thúc', values.endTime, errors.endTime, {
            type: 'time',
          })}
          ${renderStatusField(values.status)}
          ${renderField('note', 'Ghi chú', values.note, errors.note, {
            className: 'span-full',
          })}
        </div>
        <div class="settings-form-actions">
          <button type="button" data-settings-class-session-action="cancel-form">Hủy</button>
          <button type="button" data-settings-class-session-action="save-form">
            ${isEdit ? 'Lưu thay đổi' : 'Lưu ca học'}
          </button>
        </div>
      </section>
    </div>
  `
}

function renderField(name, label, value, error = '', options = {}) {
  return `
    <label class="${[options.className ?? '', error ? 'has-error' : ''].filter(Boolean).join(' ')}">
      <span>${label}</span>
      <input
        type="${options.type ?? 'text'}"
        value="${escapeAttribute(value ?? '')}"
        data-settings-class-session-field="${name}"
        ${options.placeholder ? `placeholder="${escapeAttribute(options.placeholder)}"` : ''}
      />
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderDaysOfWeekField(values = [], error = '') {
  const selectedDays = normalizeClassSessionDaysOfWeek(values)

  return `
    <fieldset class="settings-days-field ${error ? 'has-error' : ''}">
      <legend>Ngày học *</legend>
      <div>
        ${classSessionDayOptions
          .map(
            (option) => `
              <label>
                <input
                  type="checkbox"
                  value="${escapeAttribute(option.value)}"
                  data-settings-class-session-day
                  ${selectedDays.includes(option.value) ? 'checked' : ''}
                />
                <span>${escapeHtml(option.label)}</span>
              </label>
            `,
          )
          .join('')}
      </div>
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </fieldset>
  `
}

function renderStatusField(value) {
  return `
    <label>
      <span>Trạng thái</span>
      <select data-settings-class-session-field="status">
        ${classSessionStatusOptions
          .map((option) => renderOption(option.value, option.label, value))
          .join('')}
      </select>
    </label>
  `
}

function getClassSessionStats(classSessions = []) {
  return {
    total: classSessions.length,
    active: classSessions.filter((classSession) => classSession.status !== 'inactive').length,
    inactive: classSessions.filter((classSession) => classSession.status === 'inactive').length,
  }
}

function buildClassSessionDisplayLabel({ name, daysLabel, startTime, endTime }) {
  if (daysLabel && startTime && endTime) {
    return `${daysLabel} ${startTime}-${endTime}`
  }

  return name
}

export function normalizeClassSessionDaysOfWeek(daysOfWeek, fallbackLabel = '') {
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
  const selectedDays = (Array.isArray(daysOfWeek) ? daysOfWeek : [])
    .map((day) => String(day || '').trim().toLowerCase())
    .map((day) => aliasMap[day] || day)
    .filter((day) => classSessionDayOptions.some((option) => option.value === day))
  const uniqueDays = Array.from(new Set(selectedDays)).sort(
    (firstDay, secondDay) => getClassSessionDayOrder(firstDay) - getClassSessionDayOrder(secondDay),
  )

  return uniqueDays.length ? uniqueDays : parseClassSessionDaysLabel(fallbackLabel)
}

export function buildClassSessionDaysLabel(daysOfWeek = []) {
  const labelsByDay = new Map(classSessionDayOptions.map((option) => [option.value, option.label]))
  return normalizeClassSessionDaysOfWeek(daysOfWeek)
    .map((day) => labelsByDay.get(day))
    .filter(Boolean)
    .join('-')
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

  const daysByIndex = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return Array.from(indexes)
    .sort((firstIndex, secondIndex) => getClassSessionDayOrder(daysByIndex[firstIndex]) - getClassSessionDayOrder(daysByIndex[secondIndex]))
    .map((index) => daysByIndex[index])
}

function getClassSessionDayIndex(label) {
  const normalizedLabel = String(label || '').trim().toUpperCase()

  if (normalizedLabel === 'CN') {
    return 0
  }

  const match = normalizedLabel.match(/^T([2-7])$/)
  return match ? Number(match[1]) - 1 : null
}

function getClassSessionDayOrder(day) {
  return classSessionDayOptions.findIndex((option) => option.value === day)
}

function formatClassSessionTimeRange(classSession) {
  if (classSession.startTime && classSession.endTime) {
    return `${classSession.startTime}-${classSession.endTime}`
  }

  return '—'
}

function getClassSessionDisplayLabel(classSession) {
  return String(classSession.displayLabel || classSession.name || 'Ca học').trim()
}

function getClassSessionStatusLabel(status) {
  return status === 'inactive' ? 'Đã ngưng' : 'Đang dùng'
}

function createClassSessionId(value, classSessions = []) {
  const safeSlug =
    normalizeSearchText(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || Date.now()
  const baseId = `class-session-${safeSlug}`
  const existingIds = new Set(classSessions.map((classSession) => String(classSession.id)))
  let id = baseId
  let suffix = 2

  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  return id
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? ''))
}

function renderOption(value, label, selectedValue) {
  return `<option value="${escapeAttribute(value)}" ${
    String(value) === String(selectedValue) ? 'selected' : ''
  }>${escapeHtml(label)}</option>`
}

function compareText(firstValue, secondValue) {
  return String(firstValue ?? '').localeCompare(String(secondValue ?? ''), 'vi', {
    sensitivity: 'base',
  })
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .trim()
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
