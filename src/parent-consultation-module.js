import {
  consultationStatuses,
  parentContactSources,
  parentContactTypes,
} from './parent-consultation-data.js'

export const initialParentConsultationFilters = {
  query: '',
  contactType: 'all',
  consultationStatus: 'all',
  source: 'all',
}

const activeCareStatuses = new Set([
  'activeCare',
  'newLead',
  'waitingResponse',
  'trialScheduled',
])

export const parentContactTypeLabels = {
  currentParent: 'Phụ huynh hiện tại',
  consultingLead: 'Khách tư vấn',
  formerParent: 'Phụ huynh cũ',
}

export const parentConsultationStatusLabels = {
  activeCare: 'Đang chăm sóc',
  newLead: 'Khách mới',
  waitingResponse: 'Chờ phản hồi',
  trialScheduled: 'Đã hẹn học thử',
  pendingEnrollment: 'Sẵn sàng đăng ký',
  converted: 'Đã đăng ký',
  paused: 'Tạm dừng',
  closed: 'Đóng',
}

export const parentContactSourceLabels = {
  parentReferral: 'Phụ huynh giới thiệu',
  facebook: 'Facebook',
  zalo: 'Zalo',
  walkIn: 'Đến trực tiếp',
  school: 'Trường học',
  oldStudent: 'Học viên cũ',
  unknown: 'Chưa rõ',
}

export const parentCareLogChannels = ['phone', 'zalo', 'facebook', 'direct', 'email', 'other']

export const parentCareLogChannelLabels = {
  phone: 'Điện thoại',
  zalo: 'Zalo',
  facebook: 'Facebook',
  direct: 'Trực tiếp',
  email: 'Email',
  other: 'Khác',
}

export const parentAppointmentTypes = [
  'consultation',
  'trialLesson',
  'callback',
  'followUp',
  'other',
]

export const parentAppointmentTypeLabels = {
  consultation: 'Tư vấn',
  trialLesson: 'Học thử',
  callback: 'Gọi lại',
  followUp: 'Chăm sóc lại',
  other: 'Khác',
}

export const parentAppointmentStatuses = [
  'scheduled',
  'completed',
  'missed',
  'cancelled',
  'rescheduled',
]

export const parentAppointmentStatusLabels = {
  scheduled: 'Đã hẹn',
  completed: 'Đã hoàn tất',
  missed: 'Lỡ hẹn',
  cancelled: 'Đã hủy',
  rescheduled: 'Dời lịch',
}

const emptyParentContactValues = {
  contactType: 'consultingLead',
  parentName: '',
  phone: '',
  secondaryPhone: '',
  email: '',
  locationArea: '',
  studentId: '',
  leadStudentName: '',
  leadStudentAge: '',
  leadNeed: '',
  consultationStatus: 'newLead',
  source: 'unknown',
  interestedProgram: '',
  preferredSchedule: '',
  lastNote: '',
  nextAction: '',
}

const emptyEnrollmentDraft = {
  isReady: false,
  studentName: '',
  studentAge: '',
  studentBirthYear: '',
  parentName: '',
  phone: '',
  interestedProgram: '',
  preferredSchedule: '',
  learningGoal: '',
  expectedStartDate: '',
  note: '',
  advisorName: '',
  readyAt: null,
  createdAt: null,
  updatedAt: null,
}

export function createEmptyParentCareLogDraft() {
  return {
    contactedAt: toDateTimeLocalValue(new Date().toISOString()),
    channel: 'zalo',
    content: '',
    result: '',
    nextAction: '',
    errors: {},
  }
}

export function createEmptyParentAppointmentDraft() {
  return {
    appointmentType: 'consultation',
    scheduledAt: toDateTimeLocalValue(new Date().toISOString()),
    channel: 'phone',
    location: '',
    note: '',
    errors: {},
  }
}

export function createEnrollmentDraftFromContact(contact = {}) {
  const existingDraft = contact.enrollmentDraft

  if (existingDraft && typeof existingDraft === 'object' && (existingDraft.createdAt || existingDraft.updatedAt)) {
    return normalizeEnrollmentDraftForForm(existingDraft)
  }

  return {
    ...emptyEnrollmentDraft,
    studentName: contact.leadStudentName || contact.studentName || '',
    studentAge: contact.leadStudentAge || '',
    parentName: contact.parentName || '',
    phone: contact.phone || '',
    interestedProgram: contact.interestedProgram || '',
    preferredSchedule: contact.preferredSchedule || '',
    learningGoal: contact.leadNeed || '',
  }
}

export function createEmptyParentContactFormState() {
  return {
    mode: 'create',
    contactId: null,
    values: { ...emptyParentContactValues },
    careLogs: [],
    careLogDraft: createEmptyParentCareLogDraft(),
    appointments: [],
    appointmentDraft: createEmptyParentAppointmentDraft(),
    enrollmentDraft: createEnrollmentDraftFromContact(),
    enrollmentErrors: {},
    enrollmentMessage: '',
    errors: {},
  }
}

export function createEditParentContactFormState(contact) {
  return {
    mode: 'edit',
    contactId: contact.id,
    values: {
      contactType: contact.contactType || 'consultingLead',
      parentName: contact.parentName || '',
      phone: contact.phone || '',
      secondaryPhone: contact.secondaryPhone || '',
      email: contact.email || '',
      locationArea: contact.locationArea || '',
      studentId: contact.studentId || '',
      leadStudentName: contact.leadStudentName || '',
      leadStudentAge: contact.leadStudentAge || '',
      leadNeed: contact.leadNeed || '',
      consultationStatus: contact.consultationStatus || 'newLead',
      source: contact.source || 'unknown',
      interestedProgram: contact.interestedProgram || '',
      preferredSchedule: contact.preferredSchedule || '',
      lastNote: contact.lastNote || '',
      nextAction: contact.nextAction || '',
    },
    careLogs: sortCareLogsNewestFirst(contact.careLogs ?? []),
    careLogDraft: createEmptyParentCareLogDraft(),
    appointments: sortAppointments(contact.appointments ?? []),
    appointmentDraft: createEmptyParentAppointmentDraft(),
    enrollmentDraft: createEnrollmentDraftFromContact(contact),
    enrollmentErrors: {},
    enrollmentMessage: '',
    errors: {},
  }
}

export function validateParentContactForm(values) {
  const errors = {}

  if (!String(values.parentName ?? '').trim()) {
    errors.parentName = 'Vui lòng nhập tên phụ huynh/contact.'
  }

  if (!String(values.phone ?? '').trim()) {
    errors.phone = 'Vui lòng nhập số điện thoại.'
  }

  if (!parentContactTypes.includes(values.contactType)) {
    errors.contactType = 'Loại liên hệ không hợp lệ.'
  }

  if (!consultationStatuses.includes(values.consultationStatus)) {
    errors.consultationStatus = 'Trạng thái không hợp lệ.'
  }

  if (!parentContactSources.includes(values.source)) {
    errors.source = 'Nguồn liên hệ không hợp lệ.'
  }

  return errors
}

export function validateParentCareLogDraft(draft) {
  const errors = {}

  if (!String(draft.content ?? '').trim()) {
    errors.content = 'Vui lòng nhập nội dung trao đổi.'
  }

  if (!parentCareLogChannels.includes(draft.channel)) {
    errors.channel = 'Kênh liên hệ không hợp lệ.'
  }

  if (!parseCareLogDateTime(draft.contactedAt)) {
    errors.contactedAt = 'Thời gian liên hệ không hợp lệ.'
  }

  return errors
}

export function validateParentAppointmentDraft(draft) {
  const errors = {}

  if (!parentAppointmentTypes.includes(draft.appointmentType)) {
    errors.appointmentType = 'Loại hẹn không hợp lệ.'
  }

  if (!parentCareLogChannels.includes(draft.channel)) {
    errors.channel = 'Kênh liên hệ không hợp lệ.'
  }

  if (!parseCareLogDateTime(draft.scheduledAt)) {
    errors.scheduledAt = 'Thời gian hẹn không hợp lệ.'
  }

  return errors
}

export function validateEnrollmentReadyDraft(draft) {
  const errors = {}

  if (!String(draft.studentName ?? '').trim()) {
    errors.studentName = 'Cần có tên học viên dự kiến.'
  }

  if (!String(draft.parentName ?? '').trim()) {
    errors.parentName = 'Cần có tên phụ huynh.'
  }

  if (!String(draft.phone ?? '').trim()) {
    errors.phone = 'Cần có số điện thoại.'
  }

  if (Object.keys(errors).length) {
    errors.summary = 'Cần có tên học viên, phụ huynh và SĐT trước khi đánh dấu sẵn sàng đăng ký.'
  }

  return errors
}

export function saveEnrollmentDraftToParentContact(contact, draft) {
  const now = new Date().toISOString()
  const existingDraft = contact.enrollmentDraft ?? {}

  return {
    ...contact,
    enrollmentDraft: {
      ...emptyEnrollmentDraft,
      ...normalizeEnrollmentDraftForSave(draft),
      isReady: Boolean(existingDraft.isReady),
      readyAt: existingDraft.readyAt || null,
      createdAt: existingDraft.createdAt || now,
      updatedAt: now,
    },
    updatedAt: now,
  }
}

export function markEnrollmentReadyForParentContact(contact, draft) {
  const now = new Date().toISOString()
  const savedContact = saveEnrollmentDraftToParentContact(contact, draft)

  return {
    ...savedContact,
    consultationStatus: 'pendingEnrollment',
    enrollmentDraft: {
      ...savedContact.enrollmentDraft,
      isReady: true,
      readyAt: now,
      updatedAt: now,
    },
    updatedAt: now,
  }
}

export function buildEnrollmentSummary(contact) {
  const draft = contact.enrollmentDraft ?? emptyEnrollmentDraft
  const ageLine = [draft.studentAge ? `${draft.studentAge} tuổi` : '', draft.studentBirthYear]
    .filter(Boolean)
    .join(' / ')

  return [
    'THÔNG TIN ĐĂNG KÝ DỰ KIẾN',
    '',
    `Học viên: ${draft.studentName || 'Chưa nhập'}`,
    `Tuổi/Năm sinh: ${ageLine || 'Chưa nhập'}`,
    `Phụ huynh: ${draft.parentName || 'Chưa nhập'}`,
    `SĐT: ${draft.phone || 'Chưa nhập'}`,
    `Chương trình quan tâm: ${draft.interestedProgram || 'Chưa nhập'}`,
    `Lịch học mong muốn: ${draft.preferredSchedule || 'Chưa nhập'}`,
    `Mục tiêu học: ${draft.learningGoal || 'Chưa nhập'}`,
    `Ngày dự kiến bắt đầu: ${draft.expectedStartDate || 'Chưa nhập'}`,
    `Người phụ trách tư vấn: ${draft.advisorName || 'Chưa nhập'}`,
    '',
    'Ghi chú:',
    draft.note || 'Chưa có ghi chú.',
  ].join('\n')
}

export function buildParentContactFromForm(values, existingContact = null, students = []) {
  const now = new Date().toISOString()
  const selectedStudent = students.find((student) => student.id === values.studentId)
  const preservesExistingStudent =
    existingContact?.studentId && existingContact.studentId === values.studentId
  const studentId = selectedStudent
    ? selectedStudent.id
    : preservesExistingStudent
      ? existingContact.studentId
      : ''
  const studentName = selectedStudent
    ? selectedStudent.fullName
    : preservesExistingStudent
      ? existingContact.studentName
      : ''

  return {
    id: existingContact?.id || `contact-${Date.now()}`,
    contactType: values.contactType,
    parentName: String(values.parentName || '').trim(),
    phone: String(values.phone || '').trim(),
    secondaryPhone: String(values.secondaryPhone || '').trim(),
    email: String(values.email || '').trim(),
    studentName,
    studentId,
    leadStudentName: String(values.leadStudentName || '').trim(),
    leadStudentAge: String(values.leadStudentAge || '').trim(),
    leadNeed: String(values.leadNeed || '').trim(),
    consultationStatus: values.consultationStatus,
    source: values.source,
    interestedProgram: String(values.interestedProgram || '').trim(),
    preferredSchedule: String(values.preferredSchedule || '').trim(),
    locationArea: String(values.locationArea || '').trim(),
    lastContactAt: String(values.lastNote || '').trim() ? now : existingContact?.lastContactAt || '',
    lastNote: String(values.lastNote || '').trim(),
    nextAction: String(values.nextAction || '').trim(),
    careLogs: sortCareLogsNewestFirst(existingContact?.careLogs ?? []),
    appointments: sortAppointments(existingContact?.appointments ?? []),
    enrollmentDraft: existingContact?.enrollmentDraft
      ? normalizeEnrollmentDraftForSave(existingContact.enrollmentDraft)
      : createEnrollmentDraftFromContact({ ...values, parentName: values.parentName, leadStudentName: values.leadStudentName }),
    createdAt: existingContact?.createdAt || now,
    updatedAt: now,
  }
}

export function addCareLogToParentContact(contact, draft) {
  const now = new Date().toISOString()
  const contactedAt = parseCareLogDateTime(draft.contactedAt) || now
  const careLog = {
    id: `care-log-${Date.now()}`,
    contactedAt,
    channel: parentCareLogChannels.includes(draft.channel) ? draft.channel : 'other',
    content: String(draft.content || '').trim(),
    result: String(draft.result || '').trim(),
    nextAction: String(draft.nextAction || '').trim(),
    createdAt: now,
  }

  return {
    ...contact,
    careLogs: sortCareLogsNewestFirst([careLog, ...(contact.careLogs ?? [])]),
    lastContactAt: careLog.contactedAt,
    lastNote: careLog.content,
    nextAction: careLog.nextAction,
    updatedAt: now,
  }
}

export function addAppointmentToParentContact(contact, draft) {
  const now = new Date().toISOString()
  const scheduledAt = parseCareLogDateTime(draft.scheduledAt) || now
  const appointment = {
    id: `appointment-${Date.now()}`,
    appointmentType: parentAppointmentTypes.includes(draft.appointmentType)
      ? draft.appointmentType
      : 'consultation',
    scheduledAt,
    channel: parentCareLogChannels.includes(draft.channel) ? draft.channel : 'other',
    location: String(draft.location || '').trim(),
    status: 'scheduled',
    note: String(draft.note || '').trim(),
    createdAt: now,
    updatedAt: now,
  }
  const nextContact = {
    ...contact,
    appointments: sortAppointments([appointment, ...(contact.appointments ?? [])]),
    updatedAt: now,
  }

  if (appointment.appointmentType === 'trialLesson') {
    nextContact.consultationStatus = 'trialScheduled'
    nextContact.nextAction = `Hẹn học thử ${formatDateTime(appointment.scheduledAt, true)}`
  }

  return nextContact
}

export function updateParentAppointmentStatus(contact, appointmentId, status) {
  if (!parentAppointmentStatuses.includes(status)) {
    return contact
  }

  const now = new Date().toISOString()
  return {
    ...contact,
    appointments: sortAppointments(
      (contact.appointments ?? []).map((appointment) =>
        appointment.id === appointmentId
          ? {
              ...appointment,
              status,
              updatedAt: now,
            }
          : appointment,
      ),
    ),
    updatedAt: now,
  }
}

export function getFilteredParentConsultations(contacts, filters = initialParentConsultationFilters) {
  const normalizedQuery = normalizeText(filters.query)

  return contacts.filter((contact) => {
    const matchesQuery =
      !normalizedQuery ||
      [
        contact.parentName,
        contact.phone,
        contact.secondaryPhone,
        contact.email,
        contact.studentName,
        contact.leadStudentName,
        contact.leadNeed,
        contact.lastNote,
        contact.nextAction,
        ...(contact.careLogs ?? []).flatMap((log) => [log.content, log.result, log.nextAction]),
        ...(contact.appointments ?? []).flatMap((appointment) => [
          appointment.location,
          appointment.note,
          parentAppointmentTypeLabels[appointment.appointmentType],
          parentAppointmentStatusLabels[appointment.status],
        ]),
        ...Object.values(contact.enrollmentDraft ?? {}),
      ].some((value) => normalizeText(value).includes(normalizedQuery))

    const matchesType =
      filters.contactType === 'all' || contact.contactType === filters.contactType
    const matchesStatus =
      filters.consultationStatus === 'all' ||
      contact.consultationStatus === filters.consultationStatus
    const matchesSource = filters.source === 'all' || contact.source === filters.source

    return matchesQuery && matchesType && matchesStatus && matchesSource
  })
}

export function getParentConsultationStats(contacts) {
  return {
    total: contacts.length,
    consultingLeads: contacts.filter((contact) => contact.contactType === 'consultingLead').length,
    activeCare: contacts.filter((contact) => activeCareStatuses.has(contact.consultationStatus))
      .length,
    callbacks: contacts.filter(
      (contact) => contact.nextAction && contact.consultationStatus !== 'closed',
    ).length,
  }
}

export function renderParentConsultationModule(
  contacts,
  filters = initialParentConsultationFilters,
  students = [],
  formState = null,
) {
  const stats = getParentConsultationStats(contacts)
  const filteredContacts = getFilteredParentConsultations(contacts, filters)

  return `
    <section class="parent-consultation-module" aria-label="Danh sách phụ huynh và tư vấn">
      <div class="parent-consultation-topbar">
        <div class="parent-consultation-stats" aria-label="Tổng quan tư vấn">
          ${renderStatCard('Tổng liên hệ', stats.total)}
          ${renderStatCard('Khách tư vấn', stats.consultingLeads)}
          ${renderStatCard('Đang chăm sóc', stats.activeCare, 'is-active')}
          ${renderStatCard('Cần follow-up', stats.callbacks, 'is-warning')}
        </div>
        <button class="parent-consultation-add-button" type="button" data-parent-contact-action="open-create">
          + Thêm liên hệ
        </button>
      </div>

      <section class="parent-consultation-list-section" aria-label="Bảng liên hệ phụ huynh và khách tư vấn">
        <div class="parent-consultation-list-header">
          <div>
            <h3>Phụ huynh / Tư vấn</h3>
            <span>${filteredContacts.length}/${contacts.length} lien he</span>
          </div>
          <span class="parent-consultation-phase">8F · Audit/polish</span>
        </div>

        <div class="parent-consultation-toolbar">
          <label class="parent-consultation-search-field">
            <span>Tìm kiếm</span>
            <input
              type="search"
              value="${escapeAttribute(filters.query)}"
              placeholder="Tên phụ huynh, SĐT, học viên, nhu cầu..."
              data-parent-consultation-filter="query"
            />
          </label>
          ${renderFilterSelect(
            'Loại liên hệ',
            'contactType',
            filters.contactType,
            { all: 'Tất cả loại', ...parentContactTypeLabels },
          )}
          ${renderFilterSelect(
            'Trạng thái',
            'consultationStatus',
            filters.consultationStatus,
            { all: 'Tất cả trạng thái', ...parentConsultationStatusLabels },
          )}
          ${renderFilterSelect(
            'Nguồn',
            'source',
            filters.source,
            { all: 'Tất cả nguồn', ...parentContactSourceLabels },
          )}
        </div>

        ${
          filteredContacts.length
            ? renderContactsTable(filteredContacts)
            : `
              <div class="parent-consultation-empty">
                Không tìm thấy liên hệ phù hợp với bộ lọc hiện tại.
              </div>
            `
        }
      </section>
      ${formState ? renderParentContactForm(formState, students) : ''}
    </section>
  `
}

function renderStatCard(label, value, variant = '') {
  return `
    <article class="parent-consultation-stat-card ${variant}">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </article>
  `
}

function renderFilterSelect(label, field, selectedValue, optionsByValue) {
  const options = Object.entries(optionsByValue)
    .map(
      ([value, optionLabel]) => `
        <option value="${escapeAttribute(value)}" ${selectedValue === value ? 'selected' : ''}>
          ${escapeHtml(optionLabel)}
        </option>
      `,
    )
    .join('')

  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <select data-parent-consultation-filter="${escapeAttribute(field)}">
        ${options}
      </select>
    </label>
  `
}

function renderContactsTable(contacts) {
  const rows = contacts.map((contact) => renderContactRow(contact)).join('')

  return `
    <div class="parent-consultation-table-wrap">
      <table class="parent-consultation-table">
        <thead>
          <tr>
            <th>Phụ huynh / Liên hệ</th>
            <th>Học viên / Nhu cầu</th>
            <th>Trạng thái</th>
            <th>Nguồn</th>
            <th>Ghi chú gần nhất</th>
            <th>Việc tiếp theo</th>
            <th>Thao tac</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
}

function renderContactRow(contact) {
  const studentSummary = getStudentSummary(contact)
  const lastContactTime = formatDateTime(contact.lastContactAt)
  const latestNote = contact.lastNote || 'Chưa có ghi chú chăm sóc.'
  const nextAction = contact.nextAction || 'Chưa có việc tiếp theo.'
  const upcomingAppointment = getUpcomingAppointment(contact.appointments)

  return `
    <tr class="parent-consultation-row">
      <td>
        <div class="parent-contact-cell">
          <span class="parent-contact-badge is-${escapeAttribute(contact.contactType)}">
            ${escapeHtml(parentContactTypeLabels[contact.contactType] ?? 'Lien he')}
          </span>
          <strong>${escapeHtml(contact.parentName || 'Chưa có tên')}</strong>
          <span>${escapeHtml(contact.phone || 'Chưa có SĐT')}</span>
          ${contact.secondaryPhone ? `<small>Phụ: ${escapeHtml(contact.secondaryPhone)}</small>` : ''}
        </div>
      </td>
      <td>
        <div class="parent-student-cell">
          <strong>${escapeHtml(studentSummary.title)}</strong>
          <span>${escapeHtml(studentSummary.subtitle)}</span>
        </div>
      </td>
      <td>
        <span class="parent-status-badge is-${escapeAttribute(contact.consultationStatus)}">
          ${escapeHtml(parentConsultationStatusLabels[contact.consultationStatus] ?? 'Đang tư vấn')}
        </span>
      </td>
      <td>
        <span class="parent-source-badge">${escapeHtml(parentContactSourceLabels[contact.source] ?? 'Chưa rõ')}</span>
      </td>
      <td>
        <div class="parent-note-cell">
          <span>${escapeHtml(latestNote)}</span>
          ${lastContactTime ? `<small>${escapeHtml(lastContactTime)}</small>` : ''}
        </div>
      </td>
      <td>
        <div class="parent-action-cell">
          <span>${escapeHtml(nextAction)}</span>
          ${
            upcomingAppointment
              ? `<small>Hẹn ${escapeHtml(parentAppointmentTypeLabels[upcomingAppointment.appointmentType] ?? 'Khác')}: ${escapeHtml(formatDateTime(upcomingAppointment.scheduledAt, true))}</small>`
              : ''
          }
        </div>
      </td>
      <td>
        <div class="parent-contact-actions">
          <button type="button" data-parent-contact-action="edit" data-contact-id="${escapeAttribute(contact.id)}">
            Sửa
          </button>
          <button type="button" data-parent-contact-action="delete" data-contact-id="${escapeAttribute(contact.id)}">
            Xóa
          </button>
        </div>
      </td>
    </tr>
  `
}

function renderParentContactForm(formState, students) {
  const { values, errors } = formState
  const title = formState.mode === 'edit' ? 'Sửa liên hệ tư vấn' : 'Thêm liên hệ tư vấn'

  return `
    <div class="parent-contact-form-backdrop" role="presentation">
      <form class="parent-contact-form" aria-label="${escapeAttribute(title)}">
        <div class="parent-contact-form-header">
          <h3>${escapeHtml(title)}</h3>
          <button type="button" data-parent-contact-action="cancel-form" aria-label="Đóng form">X</button>
        </div>
        ${renderFormErrorSummary(errors)}
        <div class="parent-contact-form-scroll">
          <section class="parent-contact-form-section">
            <h4>Loại liên hệ</h4>
            <div class="parent-contact-form-grid is-compact">
              ${renderFormSelect('Loại liên hệ', 'contactType', values.contactType, parentContactTypeLabels, errors.contactType)}
            </div>
          </section>

          <section class="parent-contact-form-section">
            <h4>Thông tin liên hệ</h4>
            <div class="parent-contact-form-grid">
              ${renderFormInput('Tên phụ huynh/contact', 'parentName', values.parentName, errors.parentName)}
              ${renderFormInput('SĐT', 'phone', values.phone, errors.phone)}
              ${renderFormInput('SĐT phụ', 'secondaryPhone', values.secondaryPhone)}
              ${renderFormInput('Email', 'email', values.email, '', 'email')}
              ${renderFormInput('Khu vực', 'locationArea', values.locationArea)}
            </div>
          </section>

          <section class="parent-contact-form-section">
            <h4>Học viên / bé cần tư vấn</h4>
            <div class="parent-contact-form-grid">
              ${renderStudentSelect(values.studentId, students)}
              ${renderFormInput('Tên bé tư vấn', 'leadStudentName', values.leadStudentName)}
              ${renderFormInput('Tuổi', 'leadStudentAge', values.leadStudentAge)}
              ${renderFormTextarea('Nhu cầu', 'leadNeed', values.leadNeed)}
            </div>
          </section>

          <section class="parent-contact-form-section">
            <h4>Tư vấn/chăm sóc</h4>
            <div class="parent-contact-form-grid">
              ${renderFormSelect('Trạng thái', 'consultationStatus', values.consultationStatus, parentConsultationStatusLabels, errors.consultationStatus)}
              ${renderFormSelect('Nguồn', 'source', values.source, parentContactSourceLabels, errors.source)}
              ${renderFormInput('Chương trình quan tâm', 'interestedProgram', values.interestedProgram)}
              ${renderFormInput('Lịch rảnh mong muốn', 'preferredSchedule', values.preferredSchedule)}
              ${renderFormTextarea('Ghi chú gần nhất', 'lastNote', values.lastNote)}
              ${renderFormTextarea('Việc tiếp theo', 'nextAction', values.nextAction)}
            </div>
          </section>

          ${renderAppointmentSection(formState)}
          ${renderEnrollmentSection(formState)}
          ${renderCareLogSection(formState)}
        </div>
        <div class="parent-contact-form-footer">
          <button type="button" data-parent-contact-action="cancel-form">Hủy</button>
          <button type="button" data-parent-contact-action="save-form">Lưu liên hệ</button>
        </div>
      </form>
    </div>
  `
}

function renderEnrollmentSection(formState) {
  const draft = formState.enrollmentDraft ?? createEnrollmentDraftFromContact()
  const errors = formState.enrollmentErrors ?? {}
  const message = formState.enrollmentMessage || ''
  const summary = buildEnrollmentSummary({ enrollmentDraft: draft })

  return `
    <section class="parent-contact-form-section parent-enrollment-section">
      <div class="parent-enrollment-heading">
        <h4>Chuẩn bị đăng ký</h4>
        ${
          draft.isReady
            ? '<span class="parent-enrollment-ready-badge">Sẵn sàng đăng ký</span>'
            : ''
        }
      </div>
      ${errors.summary ? `<div class="parent-enrollment-error">${escapeHtml(errors.summary)}</div>` : ''}
      ${message ? `<div class="parent-enrollment-message">${escapeHtml(message)}</div>` : ''}
      <div class="parent-enrollment-form">
        ${renderEnrollmentInput('Tên học viên dự kiến', 'studentName', draft.studentName, errors.studentName)}
        ${renderEnrollmentInput('Tuổi', 'studentAge', draft.studentAge)}
        ${renderEnrollmentInput('Năm sinh', 'studentBirthYear', draft.studentBirthYear)}
        ${renderEnrollmentInput('Tên phụ huynh', 'parentName', draft.parentName, errors.parentName)}
        ${renderEnrollmentInput('SĐT', 'phone', draft.phone, errors.phone)}
        ${renderEnrollmentInput('Chương trình quan tâm', 'interestedProgram', draft.interestedProgram)}
        ${renderEnrollmentInput('Lịch học mong muốn', 'preferredSchedule', draft.preferredSchedule)}
        ${renderEnrollmentTextarea('Mục tiêu học', 'learningGoal', draft.learningGoal)}
        ${renderEnrollmentInput('Ngày dự kiến bắt đầu', 'expectedStartDate', draft.expectedStartDate, '', 'date')}
        ${renderEnrollmentInput('Người phụ trách tư vấn', 'advisorName', draft.advisorName)}
        ${renderEnrollmentTextarea('Ghi chú đăng ký', 'note', draft.note)}
      </div>
      <div class="parent-enrollment-actions">
        <button type="button" data-parent-enrollment-action="save">Lưu bản nháp đăng ký</button>
        <button type="button" data-parent-enrollment-action="ready">Đánh dấu sẵn sàng đăng ký</button>
        <button type="button" data-parent-enrollment-action="copy">Copy tóm tắt đăng ký</button>
      </div>
      <pre class="parent-enrollment-summary">${escapeHtml(summary)}</pre>
    </section>
  `
}

function renderAppointmentSection(formState) {
  const appointments = sortAppointments(formState.appointments ?? [])
  const draft = formState.appointmentDraft ?? createEmptyParentAppointmentDraft()

  return `
    <section class="parent-contact-form-section parent-appointment-section">
      <h4>Lịch hẹn</h4>
      <div class="parent-appointment-layout">
        <div class="parent-appointment-list" aria-label="Danh sach lich hen">
          ${
            appointments.length
              ? appointments.map((appointment) => renderAppointmentCard(appointment)).join('')
              : '<div class="parent-appointment-empty">Chưa có lịch hẹn.</div>'
          }
        </div>
        ${
          formState.mode === 'edit'
            ? renderAppointmentForm(draft)
            : '<div class="parent-appointment-empty">Lưu liên hệ trước khi thêm lịch hẹn.</div>'
        }
      </div>
    </section>
  `
}

function renderAppointmentCard(appointment) {
  return `
    <article class="parent-appointment-card">
      <div class="parent-appointment-card-meta">
        <time datetime="${escapeAttribute(appointment.scheduledAt)}">${escapeHtml(formatDateTime(appointment.scheduledAt, true))}</time>
        <span class="parent-appointment-type">${escapeHtml(parentAppointmentTypeLabels[appointment.appointmentType] ?? 'Khác')}</span>
        <span class="parent-care-channel-badge">${escapeHtml(parentCareLogChannelLabels[appointment.channel] ?? 'Khác')}</span>
      </div>
      <p>${escapeHtml(appointment.location || 'Chưa có địa điểm/kênh chi tiết.')}</p>
      <label class="parent-appointment-status">
        <span>Trạng thái</span>
        <select
          data-parent-appointment-status-id="${escapeAttribute(appointment.id)}"
          aria-label="Cap nhat trang thai lich hen"
        >
          ${Object.entries(parentAppointmentStatusLabels)
            .map(
              ([value, label]) => `
                <option value="${escapeAttribute(value)}" ${appointment.status === value ? 'selected' : ''}>
                  ${escapeHtml(label)}
                </option>
              `,
            )
            .join('')}
        </select>
      </label>
      <p><strong>Ghi chú:</strong> ${escapeHtml(appointment.note || 'Chưa có ghi chú.')}</p>
    </article>
  `
}

function renderAppointmentForm(draft) {
  return `
    <div class="parent-appointment-form" aria-label="Thêm lịch hẹn">
      ${renderAppointmentSelect('Loại hẹn', 'appointmentType', draft.appointmentType, parentAppointmentTypeLabels, draft.errors?.appointmentType)}
      ${renderAppointmentDateInput('Thời gian hẹn', 'scheduledAt', draft.scheduledAt, draft.errors?.scheduledAt)}
      ${renderAppointmentSelect('Kênh', 'channel', draft.channel, parentCareLogChannelLabels, draft.errors?.channel)}
      ${renderAppointmentInput('Địa điểm', 'location', draft.location)}
      ${renderAppointmentTextarea('Ghi chú', 'note', draft.note)}
      <button type="button" data-parent-appointment-action="add">Thêm lịch hẹn</button>
    </div>
  `
}

function renderCareLogSection(formState) {
  const logs = sortCareLogsNewestFirst(formState.careLogs ?? [])
  const draft = formState.careLogDraft ?? createEmptyParentCareLogDraft()

  return `
    <section class="parent-contact-form-section parent-care-section">
      <h4>Lịch sử chăm sóc</h4>
      <div class="parent-care-layout">
        <div class="parent-care-timeline" aria-label="Timeline cham soc">
          ${
            logs.length
              ? logs.map((log) => renderCareLog(log)).join('')
              : '<div class="parent-care-empty">Chưa có lịch sử chăm sóc.</div>'
          }
        </div>
        ${
          formState.mode === 'edit'
            ? renderCareLogForm(draft)
            : '<div class="parent-care-empty">Lưu liên hệ trước khi thêm lịch sử chăm sóc.</div>'
        }
      </div>
    </section>
  `
}

function renderCareLog(log) {
  return `
    <article class="parent-care-log">
      <div class="parent-care-log-meta">
        <time datetime="${escapeAttribute(log.contactedAt)}">${escapeHtml(formatDateTime(log.contactedAt, true))}</time>
        <span class="parent-care-channel-badge">${escapeHtml(parentCareLogChannelLabels[log.channel] ?? 'Khác')}</span>
      </div>
      <p><strong>Trao đổi:</strong> ${escapeHtml(log.content || 'Chưa có nội dung.')}</p>
      <p><strong>Kết quả:</strong> ${escapeHtml(log.result || 'Chưa nhập kết quả.')}</p>
      <p><strong>Tiếp theo:</strong> ${escapeHtml(log.nextAction || 'Chưa có việc tiếp theo.')}</p>
    </article>
  `
}

function renderCareLogForm(draft) {
  return `
    <div class="parent-care-form" aria-label="Thêm lịch sử chăm sóc">
      ${renderCareDateInput('Thời gian liên hệ', 'contactedAt', draft.contactedAt, draft.errors?.contactedAt)}
      ${renderCareSelect('Kênh liên hệ', 'channel', draft.channel, parentCareLogChannelLabels, draft.errors?.channel)}
      ${renderCareTextarea('Nội dung trao đổi', 'content', draft.content, draft.errors?.content)}
      ${renderCareTextarea('Kết quả', 'result', draft.result)}
      ${renderCareTextarea('Việc tiếp theo', 'nextAction', draft.nextAction)}
      <button type="button" data-parent-care-log-action="add">Thêm ghi chú chăm sóc</button>
    </div>
  `
}

function renderFormErrorSummary(errors = {}) {
  const messages = Object.values(errors).filter(Boolean)

  if (!messages.length) {
    return ''
  }

  return `
    <div class="parent-contact-form-error">
      ${messages.map((message) => `<span>${escapeHtml(message)}</span>`).join('')}
    </div>
  `
}

function renderFormInput(label, field, value, error = '', type = 'text') {
  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <input
        type="${escapeAttribute(type)}"
        value="${escapeAttribute(value)}"
        data-parent-contact-field="${escapeAttribute(field)}"
      />
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderFormTextarea(label, field, value, error = '') {
  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <textarea data-parent-contact-field="${escapeAttribute(field)}">${escapeHtml(value)}</textarea>
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderFormSelect(label, field, selectedValue, optionsByValue, error = '') {
  const options = Object.entries(optionsByValue)
    .map(
      ([value, optionLabel]) => `
        <option value="${escapeAttribute(value)}" ${selectedValue === value ? 'selected' : ''}>
          ${escapeHtml(optionLabel)}
        </option>
      `,
    )
    .join('')

  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <select data-parent-contact-field="${escapeAttribute(field)}">
        ${options}
      </select>
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderCareDateInput(label, field, value, error = '') {
  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <input
        type="datetime-local"
        value="${escapeAttribute(value)}"
        data-parent-care-log-field="${escapeAttribute(field)}"
      />
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderCareSelect(label, field, selectedValue, optionsByValue, error = '') {
  const options = Object.entries(optionsByValue)
    .map(
      ([value, optionLabel]) => `
        <option value="${escapeAttribute(value)}" ${selectedValue === value ? 'selected' : ''}>
          ${escapeHtml(optionLabel)}
        </option>
      `,
    )
    .join('')

  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <select data-parent-care-log-field="${escapeAttribute(field)}">
        ${options}
      </select>
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderCareTextarea(label, field, value, error = '') {
  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <textarea data-parent-care-log-field="${escapeAttribute(field)}">${escapeHtml(value)}</textarea>
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderAppointmentInput(label, field, value, error = '') {
  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <input
        type="text"
        value="${escapeAttribute(value)}"
        data-parent-appointment-field="${escapeAttribute(field)}"
      />
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderAppointmentDateInput(label, field, value, error = '') {
  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <input
        type="datetime-local"
        value="${escapeAttribute(value)}"
        data-parent-appointment-field="${escapeAttribute(field)}"
      />
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderAppointmentSelect(label, field, selectedValue, optionsByValue, error = '') {
  const options = Object.entries(optionsByValue)
    .map(
      ([value, optionLabel]) => `
        <option value="${escapeAttribute(value)}" ${selectedValue === value ? 'selected' : ''}>
          ${escapeHtml(optionLabel)}
        </option>
      `,
    )
    .join('')

  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <select data-parent-appointment-field="${escapeAttribute(field)}">
        ${options}
      </select>
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderAppointmentTextarea(label, field, value, error = '') {
  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <textarea data-parent-appointment-field="${escapeAttribute(field)}">${escapeHtml(value)}</textarea>
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderEnrollmentInput(label, field, value, error = '', type = 'text') {
  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <input
        type="${escapeAttribute(type)}"
        value="${escapeAttribute(value ?? '')}"
        data-parent-enrollment-field="${escapeAttribute(field)}"
      />
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderEnrollmentTextarea(label, field, value, error = '') {
  return `
    <label class="${error ? 'has-error' : ''}">
      <span>${escapeHtml(label)}</span>
      <textarea data-parent-enrollment-field="${escapeAttribute(field)}">${escapeHtml(value ?? '')}</textarea>
      ${error ? `<small>${escapeHtml(error)}</small>` : ''}
    </label>
  `
}

function renderStudentSelect(selectedStudentId, students) {
  const options = [
    '<option value="">Không chọn học viên</option>',
    ...students
      .filter((student) => !student.isDeleted)
      .map(
        (student) => `
          <option value="${escapeAttribute(student.id)}" ${selectedStudentId === student.id ? 'selected' : ''}>
            ${escapeHtml(student.fullName)}
          </option>
        `,
      ),
  ].join('')

  return `
    <label>
      <span>Học viên liên quan</span>
      <select data-parent-contact-field="studentId">
        ${options}
      </select>
    </label>
  `
}

function getStudentSummary(contact) {
  if (contact.studentName) {
    return {
      title: contact.studentName,
      subtitle: contact.leadNeed || contact.interestedProgram || 'Học viên liên quan',
    }
  }

  const leadStudent = contact.leadStudentName || 'Chưa rõ học viên'
  const age = contact.leadStudentAge ? ` · ${contact.leadStudentAge} tuổi` : ''

  return {
    title: `${leadStudent}${age}`,
    subtitle: contact.leadNeed || contact.interestedProgram || 'Nhu cầu tư vấn chưa nhập',
  }
}

function sortCareLogsNewestFirst(careLogs) {
  return [...(careLogs ?? [])].sort(
    (firstLog, secondLog) =>
      new Date(secondLog.contactedAt || secondLog.createdAt || 0) -
      new Date(firstLog.contactedAt || firstLog.createdAt || 0),
  )
}

function sortAppointments(appointments) {
  const now = Date.now()

  return [...(appointments ?? [])].sort((firstAppointment, secondAppointment) => {
    const firstTime = new Date(firstAppointment.scheduledAt || firstAppointment.createdAt || 0).getTime()
    const secondTime = new Date(secondAppointment.scheduledAt || secondAppointment.createdAt || 0).getTime()
    const firstUpcoming = firstAppointment.status === 'scheduled' && firstTime >= now
    const secondUpcoming = secondAppointment.status === 'scheduled' && secondTime >= now

    if (firstUpcoming && secondUpcoming) {
      return firstTime - secondTime
    }

    if (firstUpcoming !== secondUpcoming) {
      return firstUpcoming ? -1 : 1
    }

    return secondTime - firstTime
  })
}

function normalizeEnrollmentDraftForForm(draft = {}) {
  return {
    ...emptyEnrollmentDraft,
    isReady: Boolean(draft.isReady),
    studentName: String(draft.studentName || ''),
    studentAge: String(draft.studentAge || ''),
    studentBirthYear: String(draft.studentBirthYear || ''),
    parentName: String(draft.parentName || ''),
    phone: String(draft.phone || ''),
    interestedProgram: String(draft.interestedProgram || ''),
    preferredSchedule: String(draft.preferredSchedule || ''),
    learningGoal: String(draft.learningGoal || ''),
    expectedStartDate: String(draft.expectedStartDate || ''),
    note: String(draft.note || ''),
    advisorName: String(draft.advisorName || ''),
    readyAt: draft.readyAt || null,
    createdAt: draft.createdAt || null,
    updatedAt: draft.updatedAt || null,
  }
}

function normalizeEnrollmentDraftForSave(draft = {}) {
  return normalizeEnrollmentDraftForForm(draft)
}

function getUpcomingAppointment(appointments) {
  const now = Date.now()
  return sortAppointments(appointments).find(
    (appointment) =>
      appointment.status === 'scheduled' &&
      new Date(appointment.scheduledAt || 0).getTime() >= now,
  )
}

function parseCareLogDateTime(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : ''
}

function toDateTimeLocalValue(value) {
  const date = value ? new Date(value) : null

  if (!date || Number.isNaN(date.getTime())) {
    return ''
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16)
}

function formatDateTime(value, includeTime = false) {
  const date = value ? new Date(value) : null

  if (!date || Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttribute(value) {
  return escapeHtml(value)
}
