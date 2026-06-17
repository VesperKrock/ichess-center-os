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

export const parentContactWizardSteps = [
  { id: 1, label: 'Thông tin phụ huynh' },
  { id: 2, label: 'Học viên mới / bé cần tư vấn' },
  { id: 3, label: 'Tư vấn / chăm sóc' },
  { id: 4, label: 'Lịch hẹn & đăng ký dự kiến' },
]

export const parentContactTypeLabels = {
  currentParent: 'Phụ huynh hiện tại',
  consultingLead: 'Khách tư vấn mới',
  reservedParent: 'Phụ huynh bảo lưu',
  stoppedParent: 'Phụ huynh đã ngưng',
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
  website: 'Website',
  eventTournament: 'Sự kiện / Giải đấu',
  unknown: 'Chưa rõ',
}

export const parentCareLogChannels = ['phone', 'zalo', 'facebook', 'direct', 'email', 'note', 'other']

export const parentCareLogChannelLabels = {
  phone: 'Điện thoại',
  zalo: 'Zalo',
  facebook: 'Facebook',
  direct: 'Trực tiếp',
  email: 'Email',
  note: 'Ghi chú nhanh',
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

export const childChessLevelLabels = {
  new: 'Chưa biết chơi',
  basic: 'Đã biết chơi cơ bản',
  advanced: 'Muốn nâng cao trình độ',
}

const emptyParentContactValues = {
  contactType: 'consultingLead',
  parentName: '',
  phone: '',
  secondaryPhone: '',
  email: '',
  locationArea: '',
  studentId: '',
  studentName: '',
  studentSearch: '',
  leadStudentName: '',
  studentBirthYear: '',
  leadStudentAge: '',
  leadNeed: '',
  parentFeedbackAboutChild: '',
  consultationStatus: 'newLead',
  source: 'unknown',
  interestedProgram: '',
  preferredSchedule: '',
  consultedAt: '',
  registeredAt: '',
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
  expectedTrialDate: '',
  childChessLevel: '',
  trialDraftId: '',
  trialAppointmentId: '',
  trialScheduledAt: '',
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
    studentAge: contact.leadStudentAge || calculateAgeFromBirthYear(contact.studentBirthYear) || '',
    studentBirthYear: contact.studentBirthYear || '',
    parentName: contact.parentName || '',
    phone: contact.phone || '',
    interestedProgram: contact.interestedProgram || '',
    preferredSchedule: contact.preferredSchedule || '',
    learningGoal: contact.leadNeed || '',
    expectedTrialDate: '',
    childChessLevel: '',
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
    activeStep: 1,
    scrollTop: 0,
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
      studentName: contact.studentName || '',
      studentSearch: contact.studentName || '',
      leadStudentName: contact.leadStudentName || '',
      studentBirthYear: contact.studentBirthYear || '',
      leadStudentAge: contact.leadStudentAge || '',
      leadNeed: contact.leadNeed || '',
      parentFeedbackAboutChild: contact.parentFeedbackAboutChild || '',
      consultationStatus: contact.consultationStatus || 'newLead',
      source: contact.source || 'unknown',
      interestedProgram: contact.interestedProgram || '',
      preferredSchedule: contact.preferredSchedule || '',
      consultedAt: contact.consultedAt || '',
      registeredAt: contact.registeredAt || '',
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
    activeStep: 1,
    scrollTop: 0,
    errors: {},
  }
}

export function validateParentContactForm(values) {
  const errors = {}

  if (!String(values.parentName ?? '').trim()) {
    errors.parentName = 'Vui lòng nhập tên phụ huynh.'
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

  const birthYear = String(values.studentBirthYear ?? '').trim()
  const currentYear = new Date().getFullYear()
  const birthYearNumber = Number.parseInt(birthYear, 10)

  if (
    birthYear &&
    (!/^\d{4}$/.test(birthYear) || !Number.isFinite(birthYearNumber) || birthYearNumber < 1900 || birthYearNumber > currentYear)
  ) {
    errors.studentBirthYear = `Năm sinh cần nằm trong khoảng 1900-${currentYear}.`
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

  if (!String(draft.expectedTrialDate ?? '').trim()) {
    errors.expectedTrialDate = 'Cần có ngày học thử dự kiến.'
  }

  const birthYear = String(draft.studentBirthYear ?? '').trim()
  const currentYear = new Date().getFullYear()
  const birthYearNumber = Number.parseInt(birthYear, 10)

  if (
    birthYear &&
    (!/^\d{4}$/.test(birthYear) || !Number.isFinite(birthYearNumber) || birthYearNumber < 1900 || birthYearNumber > currentYear)
  ) {
    errors.studentBirthYear = `Năm sinh cần nằm trong khoảng 1900-${currentYear}.`
  }

  if (Object.keys(errors).length) {
    errors.summary = 'Cần có tên học viên, phụ huynh, số điện thoại và ngày học thử dự kiến.'
  }

  return errors
}

export function saveEnrollmentDraftToParentContact(contact, draft) {
  const now = new Date().toISOString()
  const existingDraft = contact.enrollmentDraft ?? {}
  const normalizedDraft = normalizeEnrollmentDraftForSave({
    ...draft,
    trialDraftId: draft.trialDraftId || existingDraft.trialDraftId || `trial-draft-${contact.id || Date.now()}`,
  })
  const contactWithDraft = {
    ...contact,
    enrollmentDraft: {
      ...emptyEnrollmentDraft,
      ...normalizedDraft,
      isReady: Boolean(existingDraft.isReady),
      readyAt: existingDraft.readyAt || null,
      createdAt: existingDraft.createdAt || now,
      updatedAt: now,
    },
    updatedAt: now,
  }

  return upsertTrialLessonAppointment(contactWithDraft, now)
}

export function markEnrollmentReadyForParentContact(contact, draft) {
  const now = new Date().toISOString()
  const savedContact = saveEnrollmentDraftToParentContact(contact, draft)

  return {
    ...savedContact,
    consultationStatus: 'trialScheduled',
    nextAction: savedContact.nextAction || 'Gửi xác nhận lịch học thử',
    enrollmentDraft: {
      ...savedContact.enrollmentDraft,
      isReady: true,
      readyAt: now,
      updatedAt: now,
    },
    updatedAt: now,
  }
}

function upsertTrialLessonAppointment(contact, now) {
  const draft = contact.enrollmentDraft ?? emptyEnrollmentDraft
  const expectedTrialDate = String(draft.expectedTrialDate || draft.expectedStartDate || '').trim()

  if (!expectedTrialDate) {
    return contact
  }

  const trialDraftId = draft.trialDraftId || `trial-draft-${contact.id || Date.now()}`
  const existingAppointments = contact.appointments ?? []
  const existingAppointment =
    existingAppointments.find((appointment) => appointment.id === draft.trialAppointmentId) ||
    existingAppointments.find(
      (appointment) =>
        appointment.sourceType === 'trial-booking' &&
        appointment.sourceDraftId === trialDraftId,
    ) ||
    existingAppointments.find(
      (appointment) =>
        appointment.sourceType === 'trial-booking' &&
        appointment.appointmentType === 'trialLesson',
    )
  const appointmentId = existingAppointment?.id || `appointment-trial-${contact.id || Date.now()}`
  const scheduledAt = toDateOnlyIso(expectedTrialDate)
  const appointment = {
    ...(existingAppointment ?? {}),
    id: appointmentId,
    appointmentType: 'trialLesson',
    scheduledAt,
    channel: existingAppointment?.channel || 'direct',
    location: existingAppointment?.location || '',
    status: existingAppointment?.status || 'scheduled',
    note: buildTrialLessonAppointmentNote(draft),
    sourceType: 'trial-booking',
    sourceDraftId: trialDraftId,
    createdAt: existingAppointment?.createdAt || now,
    updatedAt: now,
  }
  const appointments = existingAppointment
    ? existingAppointments.map((item) => (item.id === existingAppointment.id ? appointment : item))
    : [appointment, ...existingAppointments]

  return {
    ...contact,
    consultationStatus: 'trialScheduled',
    nextAction: contact.nextAction || 'Gửi xác nhận lịch học thử',
    appointments: sortAppointments(appointments),
    enrollmentDraft: {
      ...draft,
      trialDraftId,
      trialAppointmentId: appointmentId,
      trialScheduledAt: scheduledAt,
    },
    updatedAt: now,
  }
}

function buildTrialLessonAppointmentNote(draft) {
  return [
    `Học viên: ${draft.studentName || 'Chưa nhập'}`,
    `Năm sinh: ${draft.studentBirthYear || 'Chưa nhập'}`,
    `Phụ huynh: ${draft.parentName || 'Chưa nhập'}`,
    `Số điện thoại liên hệ: ${draft.phone || 'Chưa nhập'}`,
    `Trình độ hiện tại: ${childChessLevelLabels[draft.childChessLevel] || 'Chưa nhập'}`,
    `Lịch rảnh khi đăng ký học: ${draft.preferredSchedule || 'Chưa nhập'}`,
    draft.note ? `Ghi chú: ${draft.note}` : '',
  ].filter(Boolean).join('\n')
}

export function buildEnrollmentSummary(contact) {
  const draft = contact.enrollmentDraft ?? emptyEnrollmentDraft
  const age = draft.studentAge || calculateAgeFromBirthYear(draft.studentBirthYear)
  const birthYearLine = draft.studentBirthYear
    ? `${draft.studentBirthYear}${age ? ` (${age} tuổi)` : ''}`
    : age
      ? `${age} tuổi`
      : ''

  return [
    'THÔNG TIN HỌC THỬ DỰ KIẾN',
    '',
    `Học viên: ${draft.studentName || 'Chưa nhập'}`,
    `Năm sinh (tuổi): ${birthYearLine || 'Chưa nhập'}`,
    `Phụ huynh: ${draft.parentName || 'Chưa nhập'}`,
    `Số điện thoại liên hệ: ${draft.phone || 'Chưa nhập'}`,
    `Trình độ hiện tại: ${childChessLevelLabels[draft.childChessLevel] || 'Chưa nhập'}`,
    `Lịch rảnh khi đăng ký học: ${draft.preferredSchedule || 'Chưa nhập'}`,
    `Ngày học thử dự kiến: ${draft.expectedTrialDate || draft.expectedStartDate || 'Chưa nhập'}`,
    `Người tư vấn / phụ trách: ${draft.advisorName || 'Chưa nhập'}`,
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
    secondaryPhone: String(values.secondaryPhone ?? existingContact?.secondaryPhone ?? '').trim(),
    email: String(values.email || '').trim(),
    studentName,
    studentId,
    leadStudentName: String(values.leadStudentName || '').trim(),
    studentBirthYear: String(values.studentBirthYear || '').trim(),
    leadStudentAge: calculateAgeFromBirthYear(values.studentBirthYear) || String(values.leadStudentAge || '').trim(),
    leadNeed: String(values.leadNeed || '').trim(),
    parentFeedbackAboutChild: String(values.parentFeedbackAboutChild || '').trim(),
    consultationStatus: values.consultationStatus,
    source: values.source,
    interestedProgram: String(values.interestedProgram || '').trim(),
    preferredSchedule: String(values.preferredSchedule || '').trim(),
    locationArea: String(values.locationArea || '').trim(),
    consultedAt: String(values.consultedAt || '').trim(),
    registeredAt: String(values.registeredAt || '').trim(),
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

export function addQuickNoteToParentContact(contact, content) {
  const noteContent = String(content || '').trim()

  if (!noteContent) {
    return contact
  }

  const now = new Date().toISOString()
  const careLog = {
    id: `care-log-${Date.now()}`,
    contactedAt: now,
    channel: 'note',
    content: noteContent,
    result: '',
    nextAction: '',
    createdAt: now,
  }

  return {
    ...contact,
    careLogs: sortCareLogsNewestFirst([careLog, ...(contact.careLogs ?? [])]),
    lastNote: noteContent,
    lastContactAt: now,
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
        contact.studentBirthYear,
        contact.leadNeed,
        contact.parentFeedbackAboutChild,
        contact.consultedAt,
        contact.registeredAt,
        contact.lastNote,
        contact.nextAction,
        parentContactSourceLabels[contact.source],
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
  quickNoteState = null,
  noteHistoryContactId = null,
) {
  const stats = getParentConsultationStats(contacts)
  const filteredContacts = getFilteredParentConsultations(contacts, filters)

  return `
    <section class="parent-consultation-module" aria-label="Danh sách phụ huynh và tư vấn">
      <div class="parent-consultation-topbar">
        <div class="parent-consultation-stats" aria-label="Tổng quan tư vấn">
          ${renderStatCard('Tổng liên hệ', stats.total)}
          ${renderStatCard('Khách tư vấn mới', stats.consultingLeads)}
          ${renderStatCard('Đang chăm sóc', stats.activeCare, 'is-active')}
          ${renderStatCard('Cần follow-up', stats.callbacks, 'is-warning')}
        </div>
        <button class="parent-consultation-add-button" type="button" data-parent-contact-action="open-create">
          + Thêm liên hệ
        </button>
      </div>

      <section class="parent-consultation-list-section" aria-label="Bảng liên hệ phụ huynh và khách tư vấn mới">
        <div class="parent-consultation-list-header">
          <div>
            <h3>Phụ huynh / Tư vấn</h3>
            <span>${filteredContacts.length}/${contacts.length} liên hệ</span>
          </div>
          <span class="parent-consultation-phase">8F · Audit/polish</span>
        </div>

        <div class="parent-consultation-toolbar">
          <label class="parent-consultation-search-field">
            <span>Tìm kiếm</span>
            <input
              type="search"
              value="${escapeAttribute(filters.query)}"
              placeholder="Tên phụ huynh, số điện thoại, học viên, mong muốn..."
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
      ${noteHistoryContactId ? renderNoteHistoryModal(contacts, noteHistoryContactId) : ''}
      ${quickNoteState ? renderQuickNoteModal(contacts, quickNoteState) : ''}
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
            <th>Học viên / Mong muốn</th>
            <th>Trạng thái</th>
            <th>Nguồn</th>
            <th>Ghi chú gần nhất</th>
            <th>Thêm ghi chú</th>
            <th>Thao tác</th>
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
  const latestLog = getLatestCareLog(contact.careLogs)
  const latestNote = contact.lastNote || latestLog?.content || 'Chưa có ghi chú'
  const upcomingAppointment = getUpcomingAppointment(contact.appointments)

  return `
    <tr class="parent-consultation-row">
      <td>
        <div class="parent-contact-cell">
          <span class="parent-contact-badge is-${escapeAttribute(contact.contactType)}">
            ${escapeHtml(parentContactTypeLabels[contact.contactType] ?? 'Liên hệ')}
          </span>
          <strong>${escapeHtml(contact.parentName || 'Chưa có tên')}</strong>
          <span>${escapeHtml(contact.phone || 'Chưa có số điện thoại')}</span>
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
        <button
          type="button"
          class="parent-note-cell parent-note-history-trigger"
          data-parent-note-history-contact-id="${escapeAttribute(contact.id)}"
        >
          <span>${escapeHtml(latestNote)}</span>
          ${lastContactTime ? `<small>${escapeHtml(lastContactTime)}</small>` : ''}
        </button>
      </td>
      <td>
        <div class="parent-quick-note-cell">
          <button
            type="button"
            data-parent-quick-note-contact-id="${escapeAttribute(contact.id)}"
          >
            Thêm ghi chú
          </button>
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

function renderQuickNoteModal(contacts, quickNoteState) {
  const contact = contacts.find((item) => item.id === quickNoteState.contactId)

  if (!contact) {
    return ''
  }

  return `
    <div class="parent-note-modal-backdrop" role="presentation">
      <section class="parent-note-modal is-compact" aria-label="Thêm ghi chú">
        <div class="parent-note-modal-header">
          <div>
            <h3>Thêm ghi chú</h3>
            <p>${escapeHtml(getContactNoteSubtitle(contact))}</p>
          </div>
          <button type="button" data-parent-quick-note-action="cancel" aria-label="Đóng">X</button>
        </div>
        <label class="${quickNoteState.error ? 'has-error' : ''}">
          <span>Nội dung ghi chú</span>
          <textarea data-parent-quick-note-field="content">${escapeHtml(quickNoteState.content || '')}</textarea>
          ${quickNoteState.error ? `<small>${escapeHtml(quickNoteState.error)}</small>` : ''}
        </label>
        <div class="parent-note-modal-actions">
          <button type="button" data-parent-quick-note-action="cancel">Hủy</button>
          <button type="button" data-parent-quick-note-action="save">Lưu ghi chú</button>
        </div>
      </section>
    </div>
  `
}

function renderNoteHistoryModal(contacts, contactId) {
  const contact = contacts.find((item) => item.id === contactId)

  if (!contact) {
    return ''
  }

  const logs = sortCareLogsNewestFirst(contact.careLogs ?? [])

  return `
    <div class="parent-note-modal-backdrop" role="presentation">
      <section class="parent-note-modal" aria-label="Lịch sử ghi chú">
        <div class="parent-note-modal-header">
          <div>
            <h3>Lịch sử ghi chú</h3>
            <p>${escapeHtml(getContactNoteSubtitle(contact))}</p>
          </div>
          <button type="button" data-parent-note-history-action="close" aria-label="Đóng">X</button>
        </div>
        <div class="parent-note-history-list">
          ${
            logs.length
              ? logs.map((log) => renderNoteHistoryItem(log)).join('')
              : '<div class="parent-note-history-empty">Chưa có lịch sử ghi chú.</div>'
          }
        </div>
        <div class="parent-note-modal-actions">
          <button type="button" data-parent-quick-note-contact-id="${escapeAttribute(contact.id)}">
            + Thêm ghi chú
          </button>
          <button type="button" data-parent-note-history-action="close">Đóng</button>
        </div>
      </section>
    </div>
  `
}

function renderNoteHistoryItem(log) {
  return `
    <article class="parent-note-history-item">
      <div class="parent-note-history-meta">
        <time datetime="${escapeAttribute(log.contactedAt || log.createdAt || '')}">
          ${escapeHtml(formatFullDateTime(log.contactedAt || log.createdAt))}
        </time>
        <span>${escapeHtml(parentCareLogChannelLabels[log.channel] ?? 'Khác')}</span>
      </div>
      <p>${escapeHtml(log.content || 'Chưa có nội dung.')}</p>
      ${log.result ? `<small><strong>Kết quả:</strong> ${escapeHtml(log.result)}</small>` : ''}
      ${log.nextAction ? `<small><strong>Việc tiếp theo:</strong> ${escapeHtml(log.nextAction)}</small>` : ''}
    </article>
  `
}

function getContactNoteSubtitle(contact) {
  return [contact.parentName, contact.studentName || contact.leadStudentName]
    .filter(Boolean)
    .join(' · ') || 'Liên hệ chưa có tên'
}

function renderParentContactForm(formState, students) {
  const { values, errors } = formState
  const title = formState.mode === 'edit' ? 'Sửa liên hệ tư vấn' : 'Thêm liên hệ tư vấn'
  const activeStep = getParentContactWizardStep(formState.activeStep)
  const saveLabel = formState.mode === 'edit' ? 'Lưu thay đổi' : 'Lưu liên hệ'

  return `
    <div class="parent-contact-form-backdrop" role="presentation">
      <form class="parent-contact-form" aria-label="${escapeAttribute(title)}">
        <div class="parent-contact-form-header">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <span>Bước ${activeStep}/${parentContactWizardSteps.length}</span>
          </div>
          <div class="parent-contact-form-header-actions">
            <button type="button" data-parent-contact-action="save-form">${escapeHtml(saveLabel)}</button>
            <button type="button" data-parent-contact-action="cancel-form" aria-label="Đóng form">X</button>
          </div>
        </div>
        ${renderParentContactWizardIndicator(activeStep)}
        ${renderFormErrorSummary(errors)}
        <div
          class="parent-contact-form-scroll"
          data-parent-contact-form-scroll
          data-parent-contact-step="${activeStep}"
        >
          ${renderParentContactWizardStep(activeStep, formState, students)}
        </div>
        <div class="parent-contact-form-footer">
          <div class="parent-contact-step-nav">
            ${
              activeStep > 1
                ? '<button type="button" data-parent-contact-step-move="-1">← Quay lại</button>'
                : ''
            }
            ${
              activeStep < parentContactWizardSteps.length
                ? '<button type="button" data-parent-contact-step-move="1">Tiếp theo →</button>'
                : ''
            }
          </div>
          <div class="parent-contact-form-footer-actions">
            <button type="button" data-parent-contact-action="cancel-form">Hủy</button>
            <button type="button" data-parent-contact-action="save-form">${escapeHtml(saveLabel)}</button>
          </div>
        </div>
      </form>
    </div>
  `
}

function renderParentContactWizardIndicator(activeStep) {
  return `
    <nav class="parent-contact-wizard" aria-label="Các bước thêm/sửa liên hệ">
      ${parentContactWizardSteps.map((step) => `
        <button
          type="button"
          class="${step.id === activeStep ? 'is-active' : ''}"
          data-parent-contact-step="${step.id}"
          aria-current="${step.id === activeStep ? 'step' : 'false'}"
        >
          <strong>${step.id}</strong>
          <span>${escapeHtml(step.label)}</span>
        </button>
      `).join('')}
    </nav>
  `
}

function renderParentContactWizardStep(activeStep, formState, students) {
  const { values, errors } = formState

  if (activeStep === 1) {
    return `
      <section class="parent-contact-form-section">
        <h4>Thông tin phụ huynh</h4>
        <div class="parent-contact-form-grid">
          ${renderFormSelect('Loại liên hệ', 'contactType', values.contactType, parentContactTypeLabels, errors.contactType)}
          ${renderFormInput('Tên phụ huynh', 'parentName', values.parentName, errors.parentName)}
          ${renderFormInput('Số điện thoại', 'phone', values.phone, errors.phone)}
          ${renderFormInput('Email', 'email', values.email, '', 'email')}
          ${renderFormInput('Khu vực', 'locationArea', values.locationArea)}
        </div>
      </section>
    `
  }

  if (activeStep === 2) {
    return `
      <section class="parent-contact-form-section">
        <h4>Học viên mới / bé cần tư vấn</h4>
        <div class="parent-contact-form-grid">
          ${renderFormInput('Họ và tên bé tư vấn', 'leadStudentName', values.leadStudentName)}
          ${renderStudentPicker(values, students)}
          ${renderBirthYearInput(values.studentBirthYear, errors.studentBirthYear)}
          ${renderFormTextarea('Mong muốn của phụ huynh', 'leadNeed', values.leadNeed)}
          ${renderFormTextarea('Phụ huynh nhận xét về bé (nếu có)', 'parentFeedbackAboutChild', values.parentFeedbackAboutChild)}
        </div>
      </section>
    `
  }

  if (activeStep === 3) {
    return `
      <section class="parent-contact-form-section">
        <h4>Tư vấn / chăm sóc</h4>
        <div class="parent-contact-form-grid">
          ${renderFormSelect('Trạng thái', 'consultationStatus', values.consultationStatus, parentConsultationStatusLabels, errors.consultationStatus)}
          ${renderFormSelect('Nguồn', 'source', values.source, parentContactSourceLabels, errors.source)}
          ${renderFormInput('Ngày tư vấn', 'consultedAt', values.consultedAt, '', 'date')}
          ${renderFormInput('Ngày đăng ký', 'registeredAt', values.registeredAt, '', 'date')}
          ${renderFormInput('Chương trình quan tâm', 'interestedProgram', values.interestedProgram)}
          ${renderFormInput('Lịch rảnh mong muốn', 'preferredSchedule', values.preferredSchedule)}
          ${renderFormTextarea('Ghi chú gần nhất', 'lastNote', values.lastNote)}
          ${renderFormTextarea('Việc tiếp theo', 'nextAction', values.nextAction)}
        </div>
      </section>
    `
  }

  return `
    ${renderAppointmentSection(formState)}
    ${renderEnrollmentSection(formState)}
  `
}

function getParentContactWizardStep(step) {
  const normalizedStep = Number.parseInt(step, 10)
  return Math.min(Math.max(Number.isFinite(normalizedStep) ? normalizedStep : 1, 1), parentContactWizardSteps.length)
}

function renderEnrollmentSection(formState) {
  const draft = formState.enrollmentDraft ?? createEnrollmentDraftFromContact()
  const errors = formState.enrollmentErrors ?? {}
  const message = formState.enrollmentMessage || ''
  const summary = buildEnrollmentSummary({ enrollmentDraft: draft })

  return `
    <section class="parent-contact-form-section parent-enrollment-section">
      <div class="parent-enrollment-heading">
        <h4>Đặt lịch hẹn học thử</h4>
        ${
          draft.isReady
            ? '<span class="parent-enrollment-ready-badge">Đã hẹn học thử</span>'
            : ''
        }
      </div>
      ${errors.summary ? `<div class="parent-enrollment-error">${escapeHtml(errors.summary)}</div>` : ''}
      ${message ? `<div class="parent-enrollment-message">${escapeHtml(message)}</div>` : ''}
      <div class="parent-enrollment-form">
        ${renderEnrollmentInput('Họ và tên học viên', 'studentName', draft.studentName, errors.studentName)}
        ${renderEnrollmentBirthYearInput(draft.studentBirthYear, errors.studentBirthYear)}
        ${renderEnrollmentInput('Tên phụ huynh', 'parentName', draft.parentName, errors.parentName)}
        ${renderEnrollmentInput('Số điện thoại liên hệ', 'phone', draft.phone, errors.phone)}
        ${renderEnrollmentSelect('Trình độ của bé hiện tại', 'childChessLevel', draft.childChessLevel, { '': 'Chưa chọn', ...childChessLevelLabels })}
        ${renderEnrollmentInput('Lịch rảnh khi đăng ký học', 'preferredSchedule', draft.preferredSchedule)}
        ${renderEnrollmentInput('Ngày học thử dự kiến', 'expectedTrialDate', draft.expectedTrialDate || draft.expectedStartDate, errors.expectedTrialDate, 'date')}
        ${renderEnrollmentInput('Người tư vấn / phụ trách', 'advisorName', draft.advisorName)}
        ${renderEnrollmentTextarea('Ghi chú', 'note', draft.note)}
      </div>
      <div class="parent-enrollment-actions">
        <button type="button" data-parent-enrollment-action="save">Lưu thông tin học thử</button>
        <button type="button" data-parent-enrollment-action="ready">Đánh dấu đã hẹn học thử</button>
        <button type="button" data-parent-enrollment-action="copy">Copy tóm tắt học thử</button>
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
        <div class="parent-appointment-list" aria-label="Danh sách lịch hẹn">
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
          aria-label="Cập nhật trạng thái lịch hẹn"
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
        <div class="parent-care-timeline" aria-label="Dòng thời gian chăm sóc">
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

function renderEnrollmentBirthYearInput(value, error = '') {
  const age = calculateAgeFromBirthYear(value)
  const hint = age ? `${age} tuổi` : 'Nhập năm sinh để tự tính tuổi.'

  return `
    <label class="${error ? 'has-error' : ''}">
      <span>Năm sinh (tuổi)</span>
      <input
        type="text"
        inputmode="numeric"
        maxlength="4"
        value="${escapeAttribute(value ?? '')}"
        data-parent-enrollment-field="studentBirthYear"
      />
      <small class="parent-birthyear-hint">${escapeHtml(error || hint)}</small>
    </label>
  `
}

function renderEnrollmentSelect(label, field, selectedValue, optionsByValue, error = '') {
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
      <select data-parent-enrollment-field="${escapeAttribute(field)}">
        ${options}
      </select>
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

function renderBirthYearInput(value, error = '') {
  const age = calculateAgeFromBirthYear(value)
  const hint = age ? `${age} tuổi` : 'Nhập năm sinh để tự tính tuổi.'

  return `
    <label class="${error ? 'has-error' : ''}">
      <span>Năm sinh (tuổi)</span>
      <input
        type="text"
        inputmode="numeric"
        maxlength="4"
        value="${escapeAttribute(value || '')}"
        data-parent-contact-field="studentBirthYear"
      />
      <small class="parent-birthyear-hint">${escapeHtml(error || hint)}</small>
    </label>
  `
}

function renderStudentPicker(values, students) {
  const activeStudents = students.filter((student) => !student.isDeleted)
  const search = String(values.studentSearch ?? '').trim()
  const selectedStudent =
    activeStudents.find((student) => student.id === values.studentId) ||
    (values.studentId || values.studentName
      ? {
          id: values.studentId || '',
          fullName: values.studentName || 'Học viên đã chọn',
        }
      : null)
  const normalizedSearch = normalizeText(search)
  const filteredStudents = (normalizedSearch
    ? activeStudents.filter((student) =>
        [student.fullName, student.parentName, student.phone]
          .some((value) => normalizeText(value).includes(normalizedSearch)),
      )
    : activeStudents
  ).slice(0, 8)

  return `
    <div class="parent-student-picker">
      <label>
        <span>Học viên liên quan (nếu có)</span>
        <input
          type="search"
          value="${escapeAttribute(values.studentSearch || '')}"
          placeholder="Tìm theo tên học viên, phụ huynh, số điện thoại"
          data-parent-contact-field="studentSearch"
        />
      </label>
      <small>Không chọn học viên nếu đây là bé mới. Danh sách này chỉ để liên kết hồ sơ có sẵn.</small>
      ${
        selectedStudent
          ? `
            <div class="parent-student-selected">
              <span>${escapeHtml(selectedStudent.fullName)}</span>
              <button type="button" data-parent-student-clear>Không chọn học viên</button>
            </div>
          `
          : ''
      }
      <div class="parent-student-picker-results" aria-label="Kết quả tìm học viên">
        ${
          filteredStudents.length
            ? filteredStudents.map((student) => `
              <button
                type="button"
                class="parent-student-picker-result ${student.id === values.studentId ? 'is-selected' : ''}"
                data-parent-student-select-id="${escapeAttribute(student.id)}"
              >
                <strong>${escapeHtml(student.fullName)}</strong>
                <span>${escapeHtml([student.parentName, student.phone].filter(Boolean).join(' · ') || 'Chưa có thông tin liên hệ')}</span>
              </button>
            `).join('')
            : '<div class="parent-student-picker-empty">Không tìm thấy học viên phù hợp.</div>'
        }
      </div>
    </div>
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
  const calculatedAge = calculateAgeFromBirthYear(contact.studentBirthYear)
  const ageValue = calculatedAge || contact.leadStudentAge
  const age = ageValue ? ` · ${ageValue} tuổi` : ''

  return {
    title: `${leadStudent}${age}`,
    subtitle: contact.leadNeed || contact.interestedProgram || 'Mong muốn tư vấn chưa nhập',
  }
}

function calculateAgeFromBirthYear(birthYear) {
  const year = Number.parseInt(String(birthYear || '').trim(), 10)
  const currentYear = new Date().getFullYear()

  if (!Number.isFinite(year) || year < 1900 || year > currentYear) {
    return ''
  }

  return String(currentYear - year)
}

function getLatestCareLog(careLogs = []) {
  return sortCareLogsNewestFirst(careLogs)[0] ?? null
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

function formatFullDateTime(value) {
  const date = value ? new Date(value) : null

  if (!date || Number.isNaN(date.getTime())) {
    return 'Chưa rõ thời gian'
  }

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function normalizeEnrollmentDraftForForm(draft = {}) {
  const studentBirthYear = String(draft.studentBirthYear || '')
  const expectedStartDate = String(draft.expectedStartDate || '')

  return {
    ...emptyEnrollmentDraft,
    isReady: Boolean(draft.isReady),
    studentName: String(draft.studentName || ''),
    studentAge: String(draft.studentAge || calculateAgeFromBirthYear(studentBirthYear) || ''),
    studentBirthYear,
    parentName: String(draft.parentName || ''),
    phone: String(draft.phone || ''),
    interestedProgram: String(draft.interestedProgram || ''),
    preferredSchedule: String(draft.preferredSchedule || ''),
    learningGoal: String(draft.learningGoal || ''),
    expectedStartDate,
    expectedTrialDate: String(draft.expectedTrialDate || expectedStartDate || ''),
    childChessLevel: childChessLevelLabels[draft.childChessLevel] ? draft.childChessLevel : '',
    trialDraftId: String(draft.trialDraftId || ''),
    trialAppointmentId: String(draft.trialAppointmentId || ''),
    trialScheduledAt: String(draft.trialScheduledAt || ''),
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

function toDateOnlyIso(value) {
  const dateText = String(value || '').trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return `${dateText}T00:00:00.000Z`
  }

  const date = dateText ? new Date(dateText) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : ''
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
