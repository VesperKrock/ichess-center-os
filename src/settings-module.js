export const initialSettingsFilters = {
  query: '',
  status: 'all',
}

const classSessionStatusOptions = [
  { value: 'active', label: 'Äang dĂ¹ng' },
  { value: 'inactive', label: 'ÄĂ£ ngÆ°ng' },
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
    errors.name = 'TĂªn ca há»c lĂ  báº¯t buá»™c.'
  }

  if (!normalizeClassSessionDaysOfWeek(values.daysOfWeek, values.daysLabel).length) {
    errors.daysOfWeek = 'Chá»n Ă­t nháº¥t 1 ngĂ y há»c.'
  }

  if (values.startTime && !isValidTime(values.startTime)) {
    errors.startTime = 'Giá» báº¯t Ä‘áº§u cáº§n Ä‘Ăºng dáº¡ng HH:mm.'
  }

  if (values.endTime && !isValidTime(values.endTime)) {
    errors.endTime = 'Giá» káº¿t thĂºc cáº§n Ä‘Ăºng dáº¡ng HH:mm.'
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
) {
  const activeFilters = { ...initialSettingsFilters, ...filters }
  const filteredClassSessions = getFilteredSettingsClassSessions(
    classSessions,
    students,
    activeFilters,
  )
  const stats = getClassSessionStats(classSessions)

  return `
    <section class="settings-module" aria-label="CĂ i Ä‘áº·t cÆ¡ sá»Ÿ">
      <div class="settings-header">
        <div>
          <h3>CĂ i Ä‘áº·t cÆ¡ sá»Ÿ</h3>
          <p>Quáº£n lĂ½ cĂ¡c dá»¯ liá»‡u ná»n phá»¥c vá»¥ váº­n hĂ nh cÆ¡ sá»Ÿ DreamHome.</p>
        </div>
        <div class="settings-summary">
          <span>${stats.total} ca há»c</span>
          <span>${stats.active} Ä‘ang dĂ¹ng</span>
          <span>${stats.inactive} Ä‘Ă£ ngÆ°ng</span>
        </div>
      </div>

      <div class="settings-tabs" aria-label="NhĂ³m cĂ i Ä‘áº·t">
        <span>ThĂ´ng tin cÆ¡ sá»Ÿ - Ä‘Ă£ lĂªn káº¿ hoáº¡ch</span>
        <strong>Ca há»c / Lá»›p</strong>
        <span>GĂ³i há»c phĂ­ - Ä‘Ă£ lĂªn káº¿ hoáº¡ch</span>
        <span>Dá»¯ liá»‡u máº«u - Ä‘Ă£ lĂªn káº¿ hoáº¡ch</span>
      </div>

      <section class="settings-class-session-panel" aria-label="Quáº£n lĂ½ Ca há»c / Lá»›p">
        <div class="settings-panel-header">
          <div>
            <h4>Ca há»c / Lá»›p</h4>
            <p>Danh má»¥c ca há»c dĂ¹ng chung vá»›i Module Há»c viĂªn qua cĂ¹ng localStorage.</p>
          </div>
          <button type="button" data-settings-class-session-action="open-create">
            + ThĂªm ca há»c
          </button>
        </div>

        <div class="settings-class-session-toolbar">
          <label>
            <span>TĂ¬m kiáº¿m</span>
            <input
              type="search"
              value="${escapeAttribute(activeFilters.query)}"
              placeholder="TĂ¬m tĂªn ca, ngĂ y há»c, ghi chĂº..."
              data-settings-filter="query"
            />
          </label>
          <label>
            <span>Tráº¡ng thĂ¡i</span>
            <select data-settings-filter="status">
              ${renderOption('all', 'Táº¥t cáº£ tráº¡ng thĂ¡i', activeFilters.status)}
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
                <th>Ca há»c / Lá»›p</th>
                <th>NgĂ y há»c</th>
                <th>Giá» há»c</th>
                <th>Sá»‘ há»c viĂªn</th>
                <th>Tráº¡ng thĂ¡i</th>
                <th>Ghi chĂº</th>
                <th>Thao tĂ¡c</th>
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
  const actionLabel = classSession.status === 'inactive' ? 'KĂ­ch hoáº¡t láº¡i' : 'NgÆ°ng dĂ¹ng'

  return `
    <tr>
      <td>
        <strong title="${escapeAttribute(getClassSessionDisplayLabel(classSession))}">
          ${escapeHtml(getClassSessionDisplayLabel(classSession))}
        </strong>
      </td>
      <td>${escapeHtml(classSession.daysLabel || 'â€”')}</td>
      <td>${escapeHtml(formatClassSessionTimeRange(classSession))}</td>
      <td>${studentCount} há»c viĂªn</td>
      <td>
        <span class="settings-status-badge ${classSession.status === 'inactive' ? 'inactive' : ''}">
          ${statusLabel}
        </span>
      </td>
      <td title="${escapeAttribute(classSession.note || '')}">${escapeHtml(classSession.note || 'â€”')}</td>
      <td>
        <div class="settings-class-session-actions">
          <button type="button" data-settings-class-session-action="open-edit" data-class-session-id="${escapeAttribute(classSession.id)}">
            Sá»­a
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
      <td class="settings-empty" colspan="7">KhĂ´ng tĂ¬m tháº¥y ca há»c phĂ¹ há»£p.</td>
    </tr>
  `
}

function renderSettingsClassSessionForm(formState) {
  const isEdit = formState.mode === 'edit'
  const title = isEdit ? 'Sá»­a ca há»c' : 'ThĂªm ca há»c'
  const values = formState.values ?? {}
  const errors = formState.errors ?? {}

  return `
    <div class="settings-form-backdrop" role="presentation">
      <section class="settings-class-session-form" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="settings-form-header">
          <h4>${title}</h4>
          <button type="button" data-settings-class-session-action="cancel-form" aria-label="ÄĂ³ng form">Ă—</button>
        </div>
        <div class="settings-form-grid">
          ${renderField('name', 'TĂªn ca há»c *', values.name, errors.name, {
            className: 'span-full',
            placeholder: 'T7 15:00â€“16:30',
          })}
          ${renderDaysOfWeekField(values.daysOfWeek, errors.daysOfWeek)}
          ${renderField('startTime', 'Giá» báº¯t Ä‘áº§u', values.startTime, errors.startTime, {
            type: 'time',
          })}
          ${renderField('endTime', 'Giá» káº¿t thĂºc', values.endTime, errors.endTime, {
            type: 'time',
          })}
          ${renderStatusField(values.status)}
          ${renderField('note', 'Ghi chĂº', values.note, errors.note, {
            className: 'span-full',
          })}
        </div>
        <div class="settings-form-actions">
          <button type="button" data-settings-class-session-action="cancel-form">Há»§y</button>
          <button type="button" data-settings-class-session-action="save-form">
            ${isEdit ? 'LÆ°u thay Ä‘á»•i' : 'LÆ°u ca há»c'}
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
      <span>Tráº¡ng thĂ¡i</span>
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
    return `${daysLabel} ${startTime}â€“${endTime}`
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
    return `${classSession.startTime}â€“${classSession.endTime}`
  }

  return 'â€”'
}

function getClassSessionDisplayLabel(classSession) {
  return String(classSession.displayLabel || classSession.name || 'Ca há»c').trim()
}

function getClassSessionStatusLabel(status) {
  return status === 'inactive' ? 'ÄĂ£ ngÆ°ng' : 'Äang dĂ¹ng'
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
