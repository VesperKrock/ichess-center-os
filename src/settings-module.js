export const initialSettingsFilters = {
  query: '',
  status: 'all',
}

export const settingsTabOptions = [
  { id: 'center-info', label: 'Thông tin cơ sở' },
  { id: 'class-sessions', label: 'Ca học / Lớp' },
  { id: 'tuition-packages', label: 'Gói học phí' },
  { id: 'sample-data', label: 'Danh mục nhập liệu' },
]

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
  options = {},
) {
  const activeFilters = { ...initialSettingsFilters, ...filters }
  const activeTab = settingsTabOptions.some((tab) => tab.id === options.activeTab)
    ? options.activeTab
    : 'class-sessions'
  const tuitionPackages = buildSettingsTuitionPackages(options.tuitionRecords ?? [])
  const centerInfo = buildCenterInfo(options.centerInfo)
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
          <p>Quản lý các thiết lập vận hành của cơ sở.</p>
        </div>
        <div class="settings-summary">
          <span>${stats.total} ca học</span>
          <span>${stats.active} đang dùng</span>
          <span>${stats.inactive} đã ngưng</span>
        </div>
      </div>

      <div class="settings-tabs" aria-label="Nhóm cài đặt">
        ${settingsTabOptions
          .map((tab) => `
            <button
              type="button"
              class="${tab.id === activeTab ? 'is-active' : ''}"
              data-settings-tab="${escapeAttribute(tab.id)}"
            >
              ${escapeHtml(tab.label)}
            </button>
          `)
          .join('')}
      </div>

      ${activeTab === 'center-info' ? renderCenterInfoPanel(centerInfo, cloudDbPanelState) : ''}
      ${activeTab === 'tuition-packages' ? renderTuitionPackagePanel(tuitionPackages) : ''}
      ${activeTab === 'sample-data' ? renderSampleDataPanel() : ''}
      ${activeTab === 'class-sessions' ? `
      <section class="settings-class-session-panel" aria-label="Quản lý Ca học / Lớp">
        <div class="settings-panel-header">
          <div>
            <h4>Ca học / Lớp</h4>
            <p>Danh mục ca học dùng khi phân lớp học viên và lập thời khóa biểu.</p>
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
                  : renderEmptyClassSessionRow(classSessions.length)
              }
            </tbody>
          </table>
        </div>
      </section>
      ` : ''}

      ${formState ? renderSettingsClassSessionForm(formState) : ''}
    </section>
  `
}

function renderCenterInfoPanel(centerInfo, cloudDbPanelState) {
  return `
    <section class="settings-class-session-panel settings-info-panel" aria-label="Thông tin cơ sở">
      <div class="settings-panel-header">
        <div>
          <h4>Thông tin cơ sở</h4>
          <p>Thông tin vận hành dùng chung trong các module admin.</p>
        </div>
      </div>
      <div class="settings-info-grid">
        ${renderInfoItem('Tên cơ sở', centerInfo.name)}
        ${renderInfoItem('Mã cơ sở', centerInfo.code)}
        ${renderInfoItem('Môi trường', centerInfo.environment)}
        ${renderInfoItem('Trạng thái', centerInfo.status)}
        ${renderInfoItem('Địa chỉ', centerInfo.address)}
        ${renderInfoItem('Số điện thoại', centerInfo.phone)}
      </div>
      <p class="settings-product-note">Thông tin pháp lý/địa chỉ chi tiết sẽ được owner cập nhật sau nếu cần.</p>
      ${renderCenterAppearancePanel()}
      ${renderCloudDbPanel(cloudDbPanelState)}
    </section>
  `
}

function renderCenterAppearancePanel() {
  return `
    <section class="settings-appearance-panel" aria-label="Giao diện cơ sở">
      <div>
        <h4>Giao diện cơ sở</h4>
        <p>Foundation an toàn cho hình nền cơ sở, chưa tải ảnh lên trong phase này.</p>
      </div>
      <div class="settings-appearance-grid">
        <article>
          <span>Nền hiện tại</span>
          <strong>Nền mặc định</strong>
        </article>
        <article>
          <span>Lớp phủ đọc chữ</span>
          <strong>Vừa</strong>
        </article>
        <article>
          <span>Lưu trữ ảnh</span>
          <strong>Bật sau</strong>
        </article>
      </div>
      <p class="settings-product-note">Tùy chỉnh hình nền sẽ được bật sau khi cấu hình lưu trữ ảnh; các module vẫn dùng panel tối và lớp phủ để không chìm vào nền.</p>
    </section>
  `
}

function renderTuitionPackagePanel(tuitionPackages) {
  return `
    <section class="settings-class-session-panel settings-tuition-package-panel" aria-label="Gói học phí">
      <div class="settings-panel-header">
        <div>
          <h4>Gói học phí</h4>
          <p>Danh mục gói dùng chung với Module Học phí khi nhập học phí và gia hạn cho học viên.</p>
        </div>
      </div>
      <p class="settings-product-note">Gói tạo/cập nhật trong Module Học phí sẽ xuất hiện tại đây; danh mục này là nguồn tham chiếu chung cho vận hành học phí.</p>
      <div class="settings-class-session-table-wrap">
        <table class="settings-class-session-table">
          <thead>
            <tr>
              <th>Tên gói</th>
              <th>Số buổi</th>
              <th>Học phí</th>
              <th>Đang dùng</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${
              tuitionPackages.length
                ? tuitionPackages.map((tuitionPackage) => `
                  <tr>
                    <td><strong>${escapeHtml(tuitionPackage.packageName)}</strong></td>
                    <td>${escapeHtml(tuitionPackage.totalSessions || 'Linh hoạt')}</td>
                    <td>${escapeHtml(formatMoney(tuitionPackage.totalAmount))}</td>
                    <td>${tuitionPackage.usageCount} hồ sơ</td>
                    <td>${escapeHtml(tuitionPackage.note || 'Từ dữ liệu học phí hiện có')}</td>
                  </tr>
                `).join('')
                : '<tr><td class="settings-empty" colspan="5">Chưa có gói học phí. Khi nhập học phí cho học viên, danh mục này sẽ tự hiển thị.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderSampleDataPanel() {
  const groups = [
    ['Cấp độ học', ['Mới học', 'Cơ bản', 'Nâng cao']],
    ['Mốc bot', ['Starter', 'Practice', 'Challenge']],
    ['Trạng thái học viên', ['Đang học', 'Bảo lưu', 'Đã nghỉ']],
    ['Nhóm chăm sóc', ['Cần gọi lại', 'Theo dõi học phí', 'Cần lịch bù']],
  ]

  return `
    <section class="settings-class-session-panel settings-sample-data-panel" aria-label="Danh mục nhập liệu">
      <div class="settings-panel-header">
        <div>
          <h4>Danh mục nhập liệu</h4>
          <p>Các danh mục này giúp nhập liệu thống nhất trong cơ sở.</p>
        </div>
      </div>
      <div class="settings-sample-grid">
        ${groups.map(([title, items]) => `
          <article>
            <h5>${escapeHtml(title)}</h5>
            <div>
              ${items.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `
}

function renderInfoItem(label, value) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || 'Chưa cập nhật')}</strong>
    </article>
  `
}

function buildCenterInfo(centerInfo = {}) {
  return {
    name: centerInfo.name || 'DreamHome',
    code: centerInfo.code || 'dreamhome',
    environment: centerInfo.environment || 'Vận hành chính',
    status: centerInfo.status || 'Đang hoạt động',
    address: centerInfo.address || '',
    phone: centerInfo.phone || '',
  }
}

function buildSettingsTuitionPackages(tuitionRecords = []) {
  const packagesByKey = new Map()

  tuitionRecords.forEach((record) => {
    const packageName = String(record.packageName || '').trim()

    if (!packageName) {
      return
    }

    const key = normalizeSearchText(`${packageName}|${record.totalSessions || ''}|${record.totalAmount || ''}`)
    const existing = packagesByKey.get(key)
    packagesByKey.set(key, {
      packageName,
      totalSessions: String(record.totalSessions || ''),
      totalAmount: Number(record.totalAmount || 0),
      note: String(record.note || ''),
      usageCount: (existing?.usageCount || 0) + 1,
    })
  })

  return Array.from(packagesByKey.values()).sort((firstPackage, secondPackage) =>
    compareText(firstPackage.packageName, secondPackage.packageName),
  )
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

function renderEmptyClassSessionRow(totalClassSessions = 0) {
  const message = totalClassSessions
    ? 'Không tìm thấy ca học phù hợp.'
    : 'Chưa có ca học nào. Hãy thêm ca học/lớp để dùng khi nhập học viên và lập thời khóa biểu.'

  return `
    <tr>
      <td class="settings-empty" colspan="7">${message}</td>
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
  const syncLabel = panelState.isLoading
    ? 'Đang cập nhật'
    : cloudReady
      ? 'Đang hoạt động'
      : canUseCloud
        ? 'Đang kiểm tra'
        : 'Cần kiểm tra'
  const dataLabel = cloudReady ? 'Sẵn sàng' : 'Cần kiểm tra'
  const statusTone = cloudReady ? 'is-ready' : 'is-warning'
  const message = panelState.messageTone === 'error'
    ? 'Có lỗi đồng bộ. Vui lòng báo owner kiểm tra.'
    : ''

  return `
    <section class="settings-data-status-panel" aria-label="Trạng thái dữ liệu">
      <div class="settings-panel-header">
        <div>
          <h4>Trạng thái dữ liệu</h4>
          <p>Tình trạng dữ liệu dùng cho vận hành hằng ngày.</p>
        </div>
        <span class="settings-data-status-badge ${statusTone}">
          ${dataLabel}
        </span>
      </div>
      <div class="settings-data-status-grid">
        <span>Dữ liệu cloud: <strong>${dataLabel}</strong></span>
        <span>Đồng bộ: <strong>${syncLabel}</strong></span>
        <span>Cơ sở: <strong>DreamHome</strong></span>
      </div>
      ${
        message
          ? `<p class="settings-data-status-message is-error">${message}</p>`
          : ''
      }
    </section>
  `
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
            (option) => {
              const inputId = `settings-class-session-day-${option.value}`

              return `
              <div class="settings-day-option">
                <input
                  id="${escapeAttribute(inputId)}"
                  type="checkbox"
                  value="${escapeAttribute(option.value)}"
                  data-settings-class-session-day
                  ${selectedDays.includes(option.value) ? 'checked' : ''}
                />
                <label for="${escapeAttribute(inputId)}">${escapeHtml(option.label)}</label>
              </div>
            `
            },
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

function formatMoney(value) {
  const amount = Number(value || 0)

  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Chưa cập nhật'
  }

  return amount.toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  })
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
