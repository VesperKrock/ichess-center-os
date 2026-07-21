import {
  consultationStatuses,
  parentContactSources,
  parentContactTypes,
} from './parent-consultation-data.js'

export const initialParentConsultationFilters = {
  query: '',
  customerStage: 'all',
  contactType: 'all',
  consultationStatus: 'all',
  source: 'all',
}

export const parentCustomerStages = ['lead', 'consulting', 'converted']

export const parentCustomerStageLabels = {
  lead: 'Khách mới',
  consulting: 'Đang tư vấn',
  converted: 'Đã chuyển đổi',
}

export const parentConvertPreviewModeLabels = {
  create: 'Tạo hồ sơ mới',
  merge: 'Ghép với hồ sơ có sẵn',
}

const consultingStageStatuses = new Set([
  'waitingResponse',
  'trialScheduled',
  'pendingEnrollment',
  'activeCare',
])

const activeCareStatuses = new Set([
  'activeCare',
  'newLead',
  'waitingResponse',
  'trialScheduled',
])

const parentCareSuggestionChips = [
  'Cần gọi lại',
  'Đã tư vấn học thử',
  'Phụ huynh quan tâm học phí',
  'Cần gửi lịch học',
  'Cần gửi bảng phí',
  'Đã hẹn đến trung tâm',
  'Chưa nghe máy',
  'Cần tư vấn gói học',
  'Đã chuyển thành học viên',
]

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
  customerStage: 'lead',
  consultantName: '',
  nextFollowUpAt: '',
  potentialLevel: '',
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
      customerStage: deriveParentCustomerStage(contact),
      consultantName: contact.consultantName || contact.advisorName || contact.enrollmentDraft?.advisorName || '',
      nextFollowUpAt: contact.nextFollowUpAt || '',
      potentialLevel: contact.potentialLevel || '',
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

  if (!String(values.parentName ?? '').trim() && !String(values.phone ?? '').trim()) {
    errors.parentName = 'Cần nhập tên phụ huynh/khách hoặc số điện thoại.'
    errors.phone = 'Cần nhập tên phụ huynh/khách hoặc số điện thoại.'
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

  if (values.customerStage && !parentCustomerStages.includes(values.customerStage)) {
    errors.customerStage = 'Stage khách hàng không hợp lệ.'
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
    customerStage: savedContact.customerStage === 'converted' ? 'converted' : 'consulting',
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
    customerStage: contact.customerStage === 'converted' ? 'converted' : 'consulting',
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
  const firstNote = String(values.lastNote || '').trim()
  const careLogs = existingContact?.careLogs
    ? sortCareLogsNewestFirst(existingContact.careLogs)
    : firstNote
      ? [
          {
            id: `care-log-${Date.now()}`,
            contactedAt: now,
            channel: 'note',
            content: firstNote,
            result: '',
            nextAction: String(values.nextAction || '').trim(),
            createdAt: now,
          },
        ]
      : []

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
    customerStage: parentCustomerStages.includes(values.customerStage)
      ? values.customerStage
      : deriveParentCustomerStage(existingContact || values),
    consultantId: String(values.consultantId ?? existingContact?.consultantId ?? '').trim(),
    consultantName: String(values.consultantName ?? existingContact?.consultantName ?? '').trim(),
    advisorName: String(values.advisorName ?? existingContact?.advisorName ?? '').trim(),
    linkedStudentIds: normalizeLinkedStudentIds(values.linkedStudentIds ?? existingContact?.linkedStudentIds, studentId),
    nextFollowUpAt: String(values.nextFollowUpAt ?? existingContact?.nextFollowUpAt ?? '').trim(),
    potentialLevel: String(values.potentialLevel ?? existingContact?.potentialLevel ?? '').trim(),
    careLogs,
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
    customerStage: deriveParentCustomerStage({
      ...contact,
      customerStage: contact.customerStage === 'lead' ? 'consulting' : contact.customerStage,
      careLogs: [careLog, ...(contact.careLogs ?? [])],
    }),
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
    customerStage: deriveParentCustomerStage({
      ...contact,
      customerStage: contact.customerStage === 'lead' ? 'consulting' : contact.customerStage,
      careLogs: [careLog, ...(contact.careLogs ?? [])],
    }),
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
    customerStage: contact.customerStage === 'converted' ? 'converted' : 'consulting',
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
        contact.studentNames,
        contact.studentBirthYear,
        contact.leadNeed,
        contact.parentFeedbackAboutChild,
        contact.consultedAt,
        contact.registeredAt,
        contact.lastNote,
        contact.nextAction,
        contact.consultantName,
        contact.advisorName,
        contact.nextFollowUpAt,
        parentCustomerStageLabels[deriveParentCustomerStage(contact)],
        parentContactSourceLabels[contact.source],
        ...(contact.careLogs ?? []).flatMap((log) => [log.content, log.result, log.nextAction]),
        ...(contact.appointments ?? []).flatMap((appointment) => [
          appointment.location,
          appointment.note,
          parentAppointmentTypeLabels[appointment.appointmentType],
          parentAppointmentStatusLabels[appointment.status],
        ]),
        ...(contact.relatedStudents ?? []).flatMap((student) => [
          student.fullName,
          student.parentName,
          student.parentPhone,
          student.fatherPhone,
          student.motherPhone,
        ]),
        ...Object.values(contact.enrollmentDraft ?? {}),
      ].some((value) => normalizeText(value).includes(normalizedQuery))

    const matchesType =
      filters.contactType === 'all' || contact.contactType === filters.contactType
    const matchesStage =
      !filters.customerStage ||
      filters.customerStage === 'all' ||
      deriveParentCustomerStage(contact) === filters.customerStage
    const matchesStatus =
      filters.consultationStatus === 'all' ||
      contact.consultationStatus === filters.consultationStatus
    const matchesSource = filters.source === 'all' || contact.source === filters.source

    return matchesQuery && matchesStage && matchesType && matchesStatus && matchesSource
  })
}

export function getParentConsultationStats(contacts) {
  const stageCounts = contacts.reduce(
    (stats, contact) => {
      stats[deriveParentCustomerStage(contact)] += 1
      return stats
    },
    { lead: 0, consulting: 0, converted: 0 },
  )

  return {
    total: contacts.length,
    leads: stageCounts.lead,
    consulting: stageCounts.consulting,
    converted: stageCounts.converted,
    consultingLeads: contacts.filter((contact) => contact.contactType === 'consultingLead').length,
    activeCare: contacts.filter((contact) => activeCareStatuses.has(contact.consultationStatus))
      .length,
    callbacks: contacts.filter(
      (contact) => (contact.nextAction || contact.nextFollowUpAt) && contact.consultationStatus !== 'closed',
    ).length,
  }
}

export function deriveParentCustomerStage(contact = {}) {
  const explicitStage = String(contact.customerStage || '').trim()

  if (parentCustomerStages.includes(explicitStage)) {
    return explicitStage
  }

  const linkedStudentIds = Array.isArray(contact.linkedStudentIds)
    ? contact.linkedStudentIds.filter(Boolean)
    : []

  if (
    contact.consultationStatus === 'converted' ||
    contact.contactType === 'currentParent' ||
    contact.studentId ||
    linkedStudentIds.length
  ) {
    return 'converted'
  }

  if (
    contact.contactType === 'consultingLead' &&
    consultingStageStatuses.has(contact.consultationStatus)
  ) {
    return 'consulting'
  }

  if (
    (Array.isArray(contact.careLogs) && contact.careLogs.length) ||
    (Array.isArray(contact.appointments) && contact.appointments.length) ||
    String(contact.nextAction || '').trim() ||
    String(contact.nextFollowUpAt || '').trim() ||
    Boolean(contact.enrollmentDraft?.isReady || contact.enrollmentDraft?.createdAt || contact.enrollmentDraft?.updatedAt)
  ) {
    return 'consulting'
  }

  return 'lead'
}

export function mergeParentContactsWithStudents(contacts = [], students = []) {
  const contactsByGroupKey = new Map()

  ;(contacts ?? []).forEach((contact) => {
    const groupKey = getParentContactGroupKey(contact)
      contactsByGroupKey.set(groupKey, {
        ...contact,
        groupKey,
        customerStage: deriveParentCustomerStage(contact),
        consultantName: getConsultantDisplayName(contact),
        linkedStudentIds: normalizeLinkedStudentIds(contact.linkedStudentIds, contact.studentId),
        relatedStudents: contact.studentId
          ? students.filter((student) => student.id === contact.studentId)
          : [],
      sourceLabel: parentContactSourceLabels[contact.source] ?? 'Chưa rõ',
    })
  })

  buildDerivedParentContactsFromStudents(students).forEach((derivedContact) => {
    const existingContact = contactsByGroupKey.get(derivedContact.groupKey)

    if (existingContact) {
      contactsByGroupKey.set(derivedContact.groupKey, {
        ...existingContact,
        relatedStudents: mergeRelatedStudents(
          existingContact.relatedStudents,
          derivedContact.relatedStudents,
        ),
        studentNames: derivedContact.studentNames,
        studentCount: derivedContact.studentCount,
        sourceLabel: existingContact.sourceLabel || 'Từ hồ sơ học viên',
      })
      return
    }

    contactsByGroupKey.set(derivedContact.groupKey, derivedContact)
  })

  return Array.from(contactsByGroupKey.values()).sort(
    (firstContact, secondContact) =>
      compareContactText(firstContact.parentName, secondContact.parentName) ||
      compareContactText(firstContact.phone, secondContact.phone),
  )
}

export function buildDerivedParentContactsFromStudents(students = []) {
  const contactsByGroupKey = new Map()

  ;(students ?? [])
    .filter((student) => student && !student.isDeleted)
    .forEach((student) => {
      const parentName = getStudentParentName(student)
      const phone = getStudentParentPhone(student)

      if (!parentName && !phone) {
        return
      }

      const groupKey = phone
        ? `phone:${normalizePhone(phone)}`
        : `fallback:${normalizeText(parentName)}:${normalizeText(student.fullName || student.name || student.id)}`
      const existing = contactsByGroupKey.get(groupKey)
      const relatedStudents = mergeRelatedStudents(existing?.relatedStudents, [student])
      const studentNames = relatedStudents.map((item) => item.fullName || item.name || '').filter(Boolean)

      contactsByGroupKey.set(groupKey, {
        id: `student-parent-${groupKey.replace(/[^a-z0-9]+/g, '-')}`,
        groupKey,
        contactType: 'currentParent',
        customerStage: 'converted',
        parentName: parentName || 'Phụ huynh chưa có tên',
        phone,
        secondaryPhone: getStudentSecondaryParentPhone(student, phone),
        email: '',
        studentName: studentNames[0] || '',
        studentNames: studentNames.join(', '),
        studentId: relatedStudents[0]?.id || '',
        leadStudentName: '',
        studentBirthYear: '',
        leadStudentAge: '',
        leadNeed: '',
        parentFeedbackAboutChild: '',
        consultationStatus: 'activeCare',
        source: 'oldStudent',
        sourceLabel: 'Từ hồ sơ học viên',
        interestedProgram: '',
        preferredSchedule: '',
        locationArea: '',
        consultedAt: '',
        registeredAt: '',
        lastContactAt: getLatestStudentCareNoteAt(relatedStudents),
        lastNote: getLatestStudentCareNoteContent(relatedStudents),
        nextAction: '',
        careLogs: [],
        appointments: [],
        enrollmentDraft: {},
        consultantName: '',
        consultantId: '',
        linkedStudentIds: relatedStudents.map((student) => student.id).filter(Boolean),
        nextFollowUpAt: '',
        potentialLevel: '',
        relatedStudents,
        studentCount: relatedStudents.length,
        isDerivedFromStudents: true,
        createdAt: student.createdAt || new Date().toISOString(),
        updatedAt: student.updatedAt || new Date().toISOString(),
      })
    })

  return Array.from(contactsByGroupKey.values())
}

export function renderParentConsultationModule(
  contacts,
  filters = initialParentConsultationFilters,
  students = [],
  formState = null,
  quickNoteState = null,
  noteHistoryContactId = null,
  detailContactId = null,
  convertPreviewState = null,
) {
  const mergedContacts = mergeParentContactsWithStudents(contacts, students)
  const stats = getParentConsultationStats(mergedContacts)
  const filteredContacts = getFilteredParentConsultations(mergedContacts, filters)
  const detailContact = detailContactId
    ? mergedContacts.find((contact) => contact.id === detailContactId)
    : null

  return `
    <section class="parent-consultation-module" aria-label="Danh sách phụ huynh và tư vấn">
      <div class="parent-consultation-topbar">
        <div class="parent-consultation-stats" aria-label="Tổng quan tư vấn">
          ${renderStatCard('Tổng khách', stats.total)}
          ${renderStatCard('Khách mới', stats.leads)}
          ${renderStatCard('Đang tư vấn', stats.consulting, 'is-active')}
          ${renderStatCard('Cần follow-up', stats.callbacks, 'is-warning')}
          ${renderStatCard('Đã chuyển đổi', stats.converted, 'is-success')}
        </div>
        <button class="parent-consultation-add-button" type="button" data-parent-contact-action="open-create">
          + Thêm khách mới
        </button>
      </div>

      <section class="parent-consultation-list-section" aria-label="Bảng liên hệ phụ huynh và khách tư vấn mới">
        <div class="parent-consultation-list-header">
          <div>
            <h3>Phụ huynh / Tư vấn</h3>
            <span>${filteredContacts.length}/${mergedContacts.length} liên hệ</span>
          </div>
          <span class="parent-consultation-phase">F23.3B · CRM local-safe</span>
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
            'Stage khách hàng',
            'customerStage',
            filters.customerStage || 'all',
            { all: 'Tất cả', ...parentCustomerStageLabels },
          )}
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
      ${detailContact ? renderParentContactDetailPanel(detailContact) : ''}
      ${formState ? renderParentContactForm(formState, students) : ''}
      ${noteHistoryContactId ? renderNoteHistoryModal(mergedContacts, noteHistoryContactId) : ''}
      ${quickNoteState ? renderQuickNoteModal(mergedContacts, quickNoteState) : ''}
      ${convertPreviewState ? renderParentConvertPreviewModal(mergedContacts, students, convertPreviewState) : ''}
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
            <th>Stage / Trạng thái</th>
            <th>Tư vấn / Nguồn</th>
            <th>Nhu cầu / Bé</th>
            <th>Next action</th>
            <th>Ghi chú</th>
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
  const customerStage = deriveParentCustomerStage(contact)
  const linkedStudentCount = getLinkedStudentCount(contact)

  return `
    <tr class="parent-consultation-row" data-parent-contact-row-id="${escapeAttribute(contact.id)}" tabindex="0">
      <td>
        <div class="parent-contact-cell">
          <span class="parent-contact-badge is-${escapeAttribute(contact.contactType)}">
            ${escapeHtml(parentContactTypeLabels[contact.contactType] ?? 'Liên hệ')}
          </span>
          <strong>${escapeHtml(contact.parentName || 'Chưa có tên')}</strong>
          <span>${escapeHtml(contact.phone || 'Chưa có số điện thoại')}</span>
          <small>${escapeHtml(linkedStudentCount ? `${linkedStudentCount} học viên liên kết` : contact.secondaryPhone || contact.email || '')}</small>
        </div>
      </td>
      <td>
        <div class="parent-stage-cell">
          <span class="parent-stage-badge is-${escapeAttribute(customerStage)}">
            ${escapeHtml(parentCustomerStageLabels[customerStage])}
          </span>
        <span class="parent-status-badge is-${escapeAttribute(contact.consultationStatus)}">
          ${escapeHtml(parentConsultationStatusLabels[contact.consultationStatus] ?? 'Đang tư vấn')}
        </span>
        </div>
      </td>
      <td>
        <div class="parent-advisor-cell">
          <strong>${escapeHtml(getConsultantDisplayName(contact))}</strong>
          <span class="parent-source-badge">${escapeHtml(contact.sourceLabel || parentContactSourceLabels[contact.source] || 'Chưa rõ')}</span>
        </div>
      </td>
      <td>
        <div class="parent-student-cell">
          <strong>${escapeHtml(studentSummary.title)}</strong>
          <span>${escapeHtml(studentSummary.subtitle)}</span>
          ${contact.interestedProgram ? `<small>${escapeHtml(contact.interestedProgram)}</small>` : ''}
        </div>
      </td>
      <td>
        <div class="parent-next-action-cell">
          <strong>${escapeHtml(contact.nextAction || 'Chưa có việc tiếp theo')}</strong>
          <span>${escapeHtml(contact.nextFollowUpAt ? formatDateTime(contact.nextFollowUpAt, true) : contact.preferredSchedule || '')}</span>
        </div>
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
    </tr>
  `
}

function renderParentContactDetailPanel(contact) {
  const relatedStudents = contact.relatedStudents ?? []
  const noteLogs = getContactNoteHistoryLogs(contact)
  const customerStage = deriveParentCustomerStage(contact)

  return `
    <div class="parent-note-modal-backdrop" role="presentation">
      <section class="parent-note-modal parent-contact-detail-panel" aria-label="Chi tiết liên hệ phụ huynh">
        <div class="parent-note-modal-header">
          <div>
            <h3>${escapeHtml(contact.parentName || 'Phụ huynh')}</h3>
            <p>${escapeHtml(contact.phone || 'Chưa có số điện thoại')} · ${escapeHtml(contact.sourceLabel || 'Từ hồ sơ học viên')}</p>
          </div>
          <div class="parent-note-modal-header-actions">
            ${contact.isDerivedFromStudents ? '' : `
              <button type="button" data-parent-contact-action="edit" data-contact-id="${escapeAttribute(contact.id)}">Sửa nhẹ</button>
            `}
          <button type="button" data-parent-contact-action="close-detail" aria-label="Đóng">X</button>
          </div>
        </div>
        <div class="parent-contact-detail-scroll">
          <div class="parent-contact-detail-body">
            <article>
              <span>Stage</span>
              <strong>${escapeHtml(parentCustomerStageLabels[customerStage])}</strong>
            </article>
            <article>
              <span>Trạng thái</span>
              <strong>${escapeHtml(parentConsultationStatusLabels[contact.consultationStatus] || 'Đang chăm sóc')}</strong>
            </article>
            <article>
              <span>Tư vấn phụ trách</span>
              <strong>${escapeHtml(getConsultantDisplayName(contact))}</strong>
            </article>
            <article>
              <span>Nhu cầu</span>
              <strong>${escapeHtml(contact.leadNeed || contact.interestedProgram || 'Chưa nhập')}</strong>
            </article>
            <article>
              <span>Next action</span>
              <strong>${escapeHtml(contact.nextAction || 'Chưa có việc tiếp theo')}</strong>
            </article>
            <article>
              <span>Ghi chú gần nhất</span>
              <strong>${escapeHtml(contact.lastNote || 'Chưa có ghi chú')}</strong>
            </article>
          </div>
          ${renderParentConvertEntry(contact, customerStage, relatedStudents)}
          <div class="parent-linked-students" aria-label="Học viên liên quan">
            <h4>Học viên liên quan</h4>
            <div class="parent-linked-students-list">
              ${
                relatedStudents.length
                  ? relatedStudents.map((student) => `
                    <button
                      type="button"
                      data-parent-linked-student-id="${escapeAttribute(student.id)}"
                    >
                      <strong>${escapeHtml(student.fullName || student.name || 'Học viên')}</strong>
                      <span>${escapeHtml([student.parentName, student.parentPhone || student.motherPhone || student.fatherPhone].filter(Boolean).join(' · ') || 'Từ hồ sơ học viên')}</span>
                    </button>
                  `).join('')
                  : '<p>Chưa có học viên liên quan.</p>'
              }
            </div>
          </div>
          <div class="parent-note-history-list parent-detail-note-history" aria-label="Lịch sử ghi chú">
            <div class="parent-detail-section-heading">
              <h4>Ghi chú chăm sóc</h4>
              ${contact.isDerivedFromStudents ? '' : `
                <button type="button" data-parent-quick-note-contact-id="${escapeAttribute(contact.id)}">
                  + Thêm ghi chú
                </button>
              `}
            </div>
            ${
              noteLogs.length
                ? noteLogs.map((log) => renderNoteHistoryItem(log)).join('')
                : '<div class="parent-note-history-empty">Chưa có lịch sử ghi chú.</div>'
            }
          </div>
        </div>
      </section>
    </div>
  `
}

function renderParentConvertEntry(contact, customerStage, relatedStudents = []) {
  if (customerStage === 'converted') {
    return `
      <div class="parent-convert-preview" aria-label="Chuyển đổi khách hàng">
        <div>
          <h4>Chuyển đổi khách hàng</h4>
          <p>Khách hàng đã được chuyển đổi. Kiểm tra các học viên liên kết trước khi thao tác thêm ở phase sau.</p>
          ${
            relatedStudents.length
              ? `<small>${escapeHtml(relatedStudents.map((student) => student.fullName || student.name).filter(Boolean).join(', '))}</small>`
              : '<small>Chưa thấy học viên liên kết trong dữ liệu hiện tại.</small>'
          }
        </div>
        <span class="parent-convert-status">Đã chuyển đổi</span>
      </div>
    `
  }

  const warningText = customerStage === 'lead'
    ? 'Khách mới có thể chưa đủ dữ liệu. Bản xem trước chỉ giúp kiểm tra trước khi thao tác thật ở phase sau.'
    : 'Bản xem trước chỉ đọc dữ liệu hiện tại, không tạo học viên, phụ huynh hoặc học phí.'

  return `
    <div class="parent-convert-preview" aria-label="Chuyển đổi khách hàng">
      <div>
        <h4>Chuyển đổi khách hàng</h4>
        <p>${escapeHtml(warningText)}</p>
      </div>
      <button
        type="button"
        data-parent-convert-preview-action="open"
        data-contact-id="${escapeAttribute(contact.id)}"
      >
        Chuẩn bị chuyển đổi
      </button>
    </div>
  `
}

function renderParentConvertPreviewModal(contacts, students, previewState) {
  const contact = contacts.find((item) => item.id === previewState.contactId)

  if (!contact) {
    return ''
  }

  const preview = buildParentConvertPreview(contact, contacts, students, previewState)
  const selectedCandidate = preview.selectedCandidate
  const isMergeMode = preview.mode === 'merge'

  return `
    <div class="parent-note-modal-backdrop" role="presentation">
      <section class="parent-note-modal parent-convert-preview-modal" aria-label="Chuẩn bị chuyển đổi">
        <div class="parent-note-modal-header">
          <div>
            <h3>Chuẩn bị chuyển đổi - ${escapeHtml(preview.source.parentName)}</h3>
            <p>Đây chỉ là bản xem trước local-safe, không ghi dữ liệu nghiệp vụ thật.</p>
          </div>
          <button type="button" data-parent-convert-preview-action="close" aria-label="Đóng">X</button>
        </div>
        <div class="parent-convert-preview-scroll">
          <section class="parent-convert-preview-section">
            <div class="parent-convert-section-heading">
              <h4>Nguồn dữ liệu CRM</h4>
              <span class="parent-convert-warning is-${escapeAttribute(preview.warningLevel)}">${escapeHtml(preview.warningLabel)}</span>
            </div>
            ${renderParentConvertFieldGrid(preview.sourceRows)}
          </section>

          <section class="parent-convert-preview-section">
            <div class="parent-convert-section-heading">
              <h4>Kiểm tra hồ sơ có thể trùng</h4>
              <span>Gợi ý kiểm tra, không phải kết luận trùng hồ sơ</span>
            </div>
            <p class="parent-convert-note">Không auto merge theo số điện thoại hoặc tên. Candidate chỉ phục vụ xem trước.</p>
            <div class="parent-convert-candidate-list">
              ${
                preview.candidates.length
                  ? preview.candidates.map((candidate) => renderParentConvertCandidate(candidate, selectedCandidate?.key)).join('')
                  : '<div class="parent-convert-empty">Chưa thấy hồ sơ gần giống.</div>'
              }
            </div>
          </section>

          <section class="parent-convert-preview-section">
            <h4>Phương án preview</h4>
            <div class="parent-convert-mode-tabs" role="group" aria-label="Phương án preview">
              ${Object.entries(parentConvertPreviewModeLabels).map(([mode, label]) => `
                <button
                  type="button"
                  class="${preview.mode === mode ? 'is-active' : ''}"
                  data-parent-convert-preview-action="mode"
                  data-preview-mode="${escapeAttribute(mode)}"
                >
                  ${escapeHtml(label)}
                </button>
              `).join('')}
            </div>
            ${
              isMergeMode && !selectedCandidate
                ? '<div class="parent-convert-empty">Chọn một candidate để xem phương án ghép hồ sơ có sẵn. Không có thao tác merge thật trong phase này.</div>'
                : renderParentConvertPlan(preview)
            }
          </section>

          <section class="parent-convert-preview-section parent-convert-readonly-warning">
            <h4>Những gì chưa được tạo</h4>
            <ul>
              <li>Đây chỉ là bản xem trước.</li>
              <li>Chưa tạo hồ sơ phụ huynh.</li>
              <li>Chưa tạo học viên.</li>
              <li>Chưa tạo học phí.</li>
              <li>Chưa gán lớp/lịch học.</li>
              <li>Chưa tạo điểm danh.</li>
              <li>Chưa đổi trạng thái khách hàng.</li>
            </ul>
          </section>
        </div>
        <div class="parent-note-modal-actions">
          <button type="button" data-parent-convert-preview-action="close">Đóng bản xem trước</button>
          <button type="button" disabled>Xác nhận chuyển đổi - chưa mở</button>
        </div>
      </section>
    </div>
  `
}

function renderParentConvertFieldGrid(rows) {
  return `
    <div class="parent-convert-field-grid">
      ${rows.map((row) => `
        <article>
          <span>${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(displayPreviewValue(row.value))}</strong>
        </article>
      `).join('')}
    </div>
  `
}

function renderParentConvertCandidate(candidate, selectedKey = '') {
  return `
    <button
      type="button"
      class="parent-convert-candidate is-${escapeAttribute(candidate.level)} ${candidate.key === selectedKey ? 'is-selected' : ''}"
      data-parent-convert-preview-action="candidate"
      data-candidate-key="${escapeAttribute(candidate.key)}"
    >
      <strong>${escapeHtml(candidate.parentName)}</strong>
      <span>${escapeHtml(candidate.phone)}</span>
      <span>${escapeHtml(candidate.studentName)}</span>
      <small>${escapeHtml(candidate.sourceLabel)} · ${escapeHtml(candidate.reasonLabels.join(', '))}</small>
    </button>
  `
}

function renderParentConvertPlan(preview) {
  if (preview.mode === 'merge' && preview.selectedCandidate) {
    return `
      <div class="parent-convert-plan">
        <div class="parent-convert-plan-summary">
          <h5>Ghép với hồ sơ có sẵn</h5>
          <p>Contact sẽ chỉ được xem trước liên kết với candidate đã chọn. Không ghi đè dữ liệu đang có.</p>
          <strong>${escapeHtml(preview.selectedCandidate.studentName)} · ${escapeHtml(preview.selectedCandidate.parentName)}</strong>
        </div>
        ${renderParentConvertFieldGrid(preview.mergeRows)}
      </div>
    `
  }

  return `
    <div class="parent-convert-plan">
      <div class="parent-convert-plan-summary">
        <h5>Tạo hồ sơ mới</h5>
        <p>Preview dự kiến tạo phụ huynh, học viên và liên kết CRM trong phase sau. Phase này chưa ghi dữ liệu.</p>
      </div>
      <div class="parent-convert-plan-columns">
        <section>
          <h5>Phụ huynh dự kiến</h5>
          ${renderParentConvertFieldGrid(preview.parentRows)}
        </section>
        <section>
          <h5>Học viên dự kiến</h5>
          ${renderParentConvertFieldGrid(preview.studentRows)}
        </section>
        <section>
          <h5>Quan hệ dự kiến</h5>
          <ul>
            ${preview.relationshipRows.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </section>
      </div>
    </div>
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
        <div class="parent-care-suggestion-chips" aria-label="Gợi ý ghi chú chăm sóc">
          ${parentCareSuggestionChips.map((suggestion) => `
            <button type="button" data-parent-quick-note-suggestion="${escapeAttribute(suggestion)}">
              ${escapeHtml(suggestion)}
            </button>
          `).join('')}
        </div>
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

  const logs = getContactNoteHistoryLogs(contact)

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
          ${contact.isDerivedFromStudents ? '' : `
            <button type="button" data-parent-quick-note-contact-id="${escapeAttribute(contact.id)}">
              + Thêm ghi chú
            </button>
          `}
          <button type="button" data-parent-note-history-action="close">Đóng</button>
        </div>
      </section>
    </div>
  `
}

function getContactNoteHistoryLogs(contact) {
  const storedLogs = sortCareLogsNewestFirst(contact.careLogs ?? [])

  if (storedLogs.length || !contact.isDerivedFromStudents) {
    return storedLogs
  }

  const studentLogs = (contact.relatedStudents ?? []).flatMap((student) => {
    const careLogs = (student.careNotes ?? [])
      .filter((note) => String(note?.content || '').trim())
      .map((note, index) => ({
        id: note.id || `student-note-${student.id}-${index}`,
        contactedAt: note.createdAt || note.updatedAt || student.updatedAt || student.createdAt || '',
        createdAt: note.createdAt || note.updatedAt || student.updatedAt || student.createdAt || '',
        channel: 'note',
        content: String(note.content || '').trim(),
        result: `Từ hồ sơ học viên: ${student.fullName || student.name || 'Học viên'}`,
        nextAction: '',
      }))

    const parentNote = String(student.parentNotes || '').trim()

    if (parentNote) {
      careLogs.push({
        id: `student-parent-note-${student.id}`,
        contactedAt: student.updatedAt || student.createdAt || contact.updatedAt || contact.createdAt || '',
        createdAt: student.updatedAt || student.createdAt || contact.updatedAt || contact.createdAt || '',
        channel: 'note',
        content: parentNote,
        result: `Từ hồ sơ học viên: ${student.fullName || student.name || 'Học viên'}`,
        nextAction: '',
      })
    }

    return careLogs
  })

  return sortCareLogsNewestFirst(studentLogs)
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
  const title = formState.mode === 'edit' ? 'Sửa khách hàng' : 'Thêm khách mới'
  const activeStep = getParentContactWizardStep(formState.activeStep)
  const saveLabel = formState.mode === 'edit' ? 'Lưu thay đổi' : 'Lưu liên hệ'

  return `
    <div class="parent-contact-form-backdrop" role="presentation">
      <form class="parent-contact-form parent-contact-wizard-modal" aria-label="${escapeAttribute(title)}">
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
          ${renderFormSelect('Stage khách hàng', 'customerStage', values.customerStage, parentCustomerStageLabels, errors.customerStage)}
          ${renderFormSelect('Loại liên hệ', 'contactType', values.contactType, parentContactTypeLabels, errors.contactType)}
          ${renderFormInput('Tên phụ huynh/khách', 'parentName', values.parentName, errors.parentName)}
          ${renderFormInput('Số điện thoại', 'phone', values.phone, errors.phone)}
          ${renderFormInput('Số phụ', 'secondaryPhone', values.secondaryPhone)}
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
        <div class="parent-child-consultation-layout">
          <div class="parent-child-new-card">
            <div class="parent-contact-form-grid">
              ${renderFormInput('Họ và tên bé tư vấn', 'leadStudentName', values.leadStudentName)}
              ${renderBirthYearInput(values.studentBirthYear, errors.studentBirthYear)}
              ${renderFormInput('Tuổi bé', 'leadStudentAge', values.leadStudentAge)}
              ${renderFormInput('Chương trình quan tâm', 'interestedProgram', values.interestedProgram)}
              ${renderFormTextarea('Nhu cầu học / ghi chú ban đầu', 'leadNeed', values.leadNeed)}
              ${renderFormTextarea('Phụ huynh nhận xét về bé (nếu có)', 'parentFeedbackAboutChild', values.parentFeedbackAboutChild)}
            </div>
          </div>
          ${renderStudentPicker(values, students)}
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
          ${renderFormInput('Tư vấn phụ trách', 'consultantName', values.consultantName)}
          ${renderFormInput('Ngày tư vấn', 'consultedAt', values.consultedAt, '', 'date')}
          ${renderFormInput('Ngày đăng ký', 'registeredAt', values.registeredAt, '', 'date')}
          ${renderFormInput('Lịch rảnh mong muốn', 'preferredSchedule', values.preferredSchedule)}
          ${renderFormInput('Hẹn gọi lại', 'nextFollowUpAt', values.nextFollowUpAt, '', 'datetime-local')}
          ${renderFormInput('Mức tiềm năng', 'potentialLevel', values.potentialLevel)}
          ${renderFormTextarea('Ghi chú gần nhất', 'lastNote', values.lastNote)}
          ${renderFormTextarea('Việc tiếp theo', 'nextAction', values.nextAction)}
        </div>
      </section>
    `
  }

  return `
    ${renderCareLogSection(formState)}
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
    <div class="parent-student-picker" data-parent-student-picker>
      <label class="parent-student-picker-search">
        <span>Học viên liên quan (nếu có)</span>
        <input
          type="search"
          class="parent-student-picker-search-input"
          value="${escapeAttribute(values.studentSearch || '')}"
          placeholder="Tìm theo tên học viên, phụ huynh, số điện thoại"
          data-parent-contact-field="studentSearch"
          data-parent-student-search-input
        />
      </label>
      <small>Không chọn học viên nếu đây là bé mới. Danh sách này chỉ để liên kết hồ sơ có sẵn.</small>
      ${
        selectedStudent
          ? `
            <div class="parent-student-selected" data-parent-student-selected>
              <span>${escapeHtml(selectedStudent.fullName)}</span>
              <button type="button" data-parent-student-clear>Không chọn học viên</button>
            </div>
          `
          : ''
      }
      <div class="parent-student-picker-results" data-parent-student-picker-results aria-label="Kết quả tìm học viên">
        ${
          filteredStudents.length
            ? filteredStudents.map((student) => `
              <button
                type="button"
                class="parent-student-picker-result ${student.id === values.studentId ? 'is-selected' : ''}"
                data-parent-student-select-id="${escapeAttribute(student.id)}"
                data-parent-student-name="${escapeAttribute(student.fullName || '')}"
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
  if (Array.isArray(contact.relatedStudents) && contact.relatedStudents.length > 1) {
    return {
      title: `${contact.relatedStudents.length} học viên`,
      subtitle: contact.studentNames || contact.relatedStudents.map((student) => student.fullName).filter(Boolean).join(', '),
    }
  }

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

function getConsultantDisplayName(contact = {}) {
  return String(
    contact.consultantName ||
      contact.advisorName ||
      contact.enrollmentDraft?.advisorName ||
      'Chưa gán tư vấn',
  ).trim()
}

function getLinkedStudentCount(contact = {}) {
  const linkedIds = normalizeLinkedStudentIds(contact.linkedStudentIds, contact.studentId)
  return Math.max(
    linkedIds.length,
    Array.isArray(contact.relatedStudents) ? contact.relatedStudents.length : 0,
    Number.parseInt(contact.studentCount || 0, 10) || 0,
  )
}

function normalizeLinkedStudentIds(value, fallbackStudentId = '') {
  const ids = Array.isArray(value)
    ? value
    : String(value || '')
      .split(',')
      .map((item) => item.trim())

  if (fallbackStudentId) {
    ids.push(fallbackStudentId)
  }

  return Array.from(new Set(ids.map((item) => String(item || '').trim()).filter(Boolean)))
}

function getParentContactGroupKey(contact = {}) {
  const phone = normalizePhone(contact.phone || contact.parentPhone || contact.secondaryPhone)

  if (phone) {
    return `phone:${phone}`
  }

  return `fallback:${normalizeText(contact.parentName || contact.name)}:${normalizeText(contact.studentName || contact.leadStudentName || contact.studentId || contact.id)}`
}

function getStudentParentName(student = {}) {
  return String(
    student.parentName ||
      student.guardianName ||
      student.caregiverName ||
      student.motherName ||
      student.fatherName ||
      '',
  ).trim()
}

function getStudentParentPhone(student = {}) {
  return String(
    student.motherPhone ||
      student.fatherPhone ||
      student.parentPhone ||
      student.guardianPhone ||
      student.caregiverPhone ||
      student.phone ||
      '',
  ).trim()
}

function getStudentSecondaryParentPhone(student = {}, primaryPhone = '') {
  const primaryDigits = normalizePhone(primaryPhone)
  return [student.fatherPhone, student.motherPhone, student.parentPhone, student.guardianPhone, student.phone]
    .map((phone) => String(phone || '').trim())
    .find((phone) => phone && normalizePhone(phone) !== primaryDigits) || ''
}

function mergeRelatedStudents(currentStudents = [], nextStudents = []) {
  const studentsById = new Map()

  ;[...(currentStudents ?? []), ...(nextStudents ?? [])].forEach((student) => {
    if (student?.id) {
      studentsById.set(student.id, student)
    }
  })

  return Array.from(studentsById.values())
}

function getLatestStudentCareNoteAt(students = []) {
  const latestNote = getLatestStudentCareNote(students)
  return latestNote?.createdAt || latestNote?.updatedAt || ''
}

function getLatestStudentCareNoteContent(students = []) {
  const latestNote = getLatestStudentCareNote(students)
  return latestNote?.content || students.map((student) => student.parentNotes).find(Boolean) || ''
}

function getLatestStudentCareNote(students = []) {
  return students
    .flatMap((student) => student.careNotes ?? [])
    .filter(Boolean)
    .sort(
      (firstNote, secondNote) =>
        new Date(secondNote.createdAt || secondNote.updatedAt || 0) -
        new Date(firstNote.createdAt || firstNote.updatedAt || 0),
    )[0] ?? null
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function compareContactText(firstValue, secondValue) {
  return String(firstValue ?? '').localeCompare(String(secondValue ?? ''), 'vi', {
    sensitivity: 'base',
  })
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

export function buildParentConvertPreview(contact, contacts = [], students = [], options = {}) {
  const mode = parentConvertPreviewModeLabels[options.mode] ? options.mode : 'create'
  const source = getParentConvertSource(contact)
  const candidates = getParentConvertCandidates(contact, contacts, students)
  const selectedCandidate =
    candidates.find((candidate) => candidate.key === options.selectedCandidateKey) || null
  const warningLevel = candidates.some((candidate) => candidate.level === 'high')
    ? 'high'
    : candidates.some((candidate) => candidate.level === 'medium')
      ? 'medium'
      : 'low'

  return {
    mode,
    source,
    sourceRows: getParentConvertSourceRows(contact, source),
    candidates,
    selectedCandidate,
    warningLevel,
    warningLabel: getParentConvertWarningLabel(warningLevel),
    parentRows: getParentConvertParentRows(source),
    studentRows: getParentConvertStudentRows(source),
    relationshipRows: getParentConvertRelationshipRows(),
    mergeRows: getParentConvertMergeRows(source, selectedCandidate),
  }
}

function getParentConvertSource(contact = {}) {
  const customerStage = deriveParentCustomerStage(contact)
  return {
    id: contact.id || '',
    parentName: contact.parentName || contact.name || 'Chưa có dữ liệu',
    phone: contact.phone || '',
    secondaryPhone: contact.secondaryPhone || '',
    email: contact.email || '',
    locationArea: contact.locationArea || '',
    sourceLabel: contact.sourceLabel || parentContactSourceLabels[contact.source] || 'Chưa rõ',
    consultantName: getConsultantDisplayName(contact),
    leadNeed: contact.leadNeed || contact.lastNote || '',
    leadStudentName: contact.leadStudentName || contact.studentName || '',
    leadStudentAge: contact.leadStudentAge || '',
    studentBirthYear: contact.studentBirthYear || '',
    interestedProgram: contact.interestedProgram || '',
    preferredSchedule: contact.preferredSchedule || '',
    customerStage,
    customerStageLabel: parentCustomerStageLabels[customerStage] || 'Khách mới',
    consultationStatusLabel: parentConsultationStatusLabels[contact.consultationStatus] || 'Chưa rõ',
    careLogCount: Array.isArray(contact.careLogs) ? contact.careLogs.length : 0,
    appointmentCount: Array.isArray(contact.appointments) ? contact.appointments.length : 0,
  }
}

function getParentConvertSourceRows(contact, source) {
  return [
    { label: 'Tên phụ huynh/khách', value: source.parentName },
    { label: 'Số điện thoại', value: source.phone },
    { label: 'Số phụ', value: source.secondaryPhone },
    { label: 'Email', value: source.email },
    { label: 'Khu vực', value: source.locationArea },
    { label: 'Nguồn khách', value: source.sourceLabel },
    { label: 'Tư vấn phụ trách', value: source.consultantName },
    { label: 'Nhu cầu học', value: source.leadNeed },
    { label: 'Tên bé', value: source.leadStudentName },
    { label: 'Tuổi/năm sinh', value: [source.leadStudentAge, source.studentBirthYear].filter(Boolean).join(' / ') },
    { label: 'Chương trình quan tâm', value: source.interestedProgram },
    { label: 'Lịch mong muốn', value: source.preferredSchedule },
    { label: 'Stage hiện tại', value: source.customerStageLabel },
    { label: 'Trạng thái tư vấn', value: source.consultationStatusLabel },
    { label: 'Số ghi chú chăm sóc', value: source.careLogCount },
    { label: 'Số lịch hẹn', value: source.appointmentCount },
    { label: 'Học viên liên kết hiện có', value: getLinkedStudentCount(contact) || '' },
  ]
}

function getParentConvertParentRows(source) {
  return [
    { label: 'Tên', value: source.parentName },
    { label: 'Số điện thoại', value: source.phone },
    { label: 'Email', value: source.email },
    { label: 'Khu vực', value: source.locationArea },
    { label: 'Nguồn khách', value: source.sourceLabel },
    { label: 'Tư vấn ban đầu', value: source.consultantName },
  ]
}

function getParentConvertStudentRows(source) {
  return [
    { label: 'Họ tên', value: source.leadStudentName },
    { label: 'Năm sinh / tuổi', value: [source.studentBirthYear, source.leadStudentAge].filter(Boolean).join(' / ') },
    { label: 'Phụ huynh chính', value: source.parentName },
    { label: 'Nhu cầu học', value: source.leadNeed },
    { label: 'Chương trình quan tâm', value: source.interestedProgram },
    { label: 'Lịch mong muốn', value: source.preferredSchedule },
    { label: 'Nguồn tạo', value: 'CRM' },
  ]
}

function getParentConvertRelationshipRows() {
  return [
    'contact → parent',
    'parent → student',
    'contact → linkedStudentIds',
    'student → initialConsultantId',
  ]
}

function getParentConvertMergeRows(source, candidate) {
  if (!candidate) {
    return []
  }

  return [
    { label: 'Contact sẽ xem trước liên kết', value: source.parentName },
    { label: 'Student được chọn', value: candidate.studentName },
    { label: 'Phụ huynh/hồ sơ có sẵn', value: candidate.parentName },
    { label: 'Field CRM giữ ở CRM', value: 'careLogs, appointments, leadNeed, nextAction' },
    { label: 'Field dự kiến bổ sung nếu thiếu', value: 'phone, email, consultantName, interestedProgram' },
    { label: 'Cảnh báo', value: 'Không tự ghi đè dữ liệu đang có' },
  ]
}

export function getParentConvertCandidates(contact = {}, contacts = [], students = []) {
  const contactPhones = getPreviewPhones([contact.phone, contact.secondaryPhone])
  const contactParentName = normalizeText(contact.parentName || contact.name)
  const contactStudentName = normalizeText(contact.leadStudentName || contact.studentName)
  const contactBirthYear = String(contact.studentBirthYear || '').trim()
  const candidates = []

  ;(students ?? []).forEach((student) => {
    const studentPhones = getPreviewPhones([
      student.parentPhone,
      student.motherPhone,
      student.fatherPhone,
      student.phone,
    ])
    const reasons = []
    let level = ''

    if (hasPhoneOverlap(contactPhones, studentPhones)) {
      reasons.push('Trùng số điện thoại')
      level = 'high'
    }

    const parentNameMatches =
      contactParentName &&
      normalizeText(student.parentName).includes(contactParentName.slice(0, 6))
    const studentNameMatches =
      contactStudentName &&
      normalizeText(student.fullName || student.name).includes(contactStudentName.slice(0, 6))
    const birthYearMatches =
      contactBirthYear &&
      getStudentBirthYear(student) &&
      contactBirthYear === getStudentBirthYear(student)

    if (studentNameMatches && birthYearMatches) {
      reasons.push('Trùng tên bé và năm sinh')
      level = level || 'medium'
    } else if (studentNameMatches) {
      reasons.push('Trùng tên bé')
      level = level || 'low'
    }

    if (parentNameMatches && studentNameMatches) {
      reasons.push('Tên phụ huynh gần giống')
      level = level === 'high' ? level : 'medium'
    } else if (parentNameMatches && !level) {
      reasons.push('Tên phụ huynh gần giống')
      level = 'low'
    }

    if (!reasons.length && (contact.studentId === student.id || (contact.linkedStudentIds ?? []).includes(student.id))) {
      reasons.push('Học viên đã liên kết')
      level = 'high'
    }

    if (reasons.length) {
      candidates.push({
        key: `student:${student.id}`,
        id: student.id,
        level,
        source: 'student',
        sourceLabel: 'Hồ sơ học viên',
        parentName: student.parentName || 'Chưa có dữ liệu',
        phone: student.parentPhone || student.motherPhone || student.fatherPhone || 'Chưa có dữ liệu',
        studentName: student.fullName || student.name || 'Chưa có dữ liệu',
        birthYear: getStudentBirthYear(student),
        reasonLabels: Array.from(new Set(reasons)),
      })
    }
  })

  ;(contacts ?? []).forEach((candidateContact) => {
    if (!candidateContact || candidateContact.id === contact.id) {
      return
    }

    const candidatePhones = getPreviewPhones([candidateContact.phone, candidateContact.secondaryPhone])
    const reasons = []
    let level = ''

    if (hasPhoneOverlap(contactPhones, candidatePhones)) {
      reasons.push('Trùng số điện thoại')
      level = 'high'
    }

    const parentNameMatches =
      contactParentName &&
      normalizeText(candidateContact.parentName).includes(contactParentName.slice(0, 6))
    const studentNameMatches =
      contactStudentName &&
      normalizeText(candidateContact.leadStudentName || candidateContact.studentName).includes(contactStudentName.slice(0, 6))
    const birthYearMatches =
      contactBirthYear &&
      candidateContact.studentBirthYear &&
      contactBirthYear === String(candidateContact.studentBirthYear)

    if (studentNameMatches && birthYearMatches) {
      reasons.push('Trùng tên bé và năm sinh')
      level = level || 'medium'
    } else if (studentNameMatches) {
      reasons.push('Trùng tên bé')
      level = level || 'low'
    }

    if (parentNameMatches && studentNameMatches) {
      reasons.push('Tên phụ huynh gần giống')
      level = level === 'high' ? level : 'medium'
    } else if (parentNameMatches && !level) {
      reasons.push('Tên phụ huynh gần giống')
      level = 'low'
    }

    if (reasons.length) {
      candidates.push({
        key: `contact:${candidateContact.id}`,
        id: candidateContact.id,
        level,
        source: 'contact',
        sourceLabel: 'Liên hệ CRM',
        parentName: candidateContact.parentName || 'Chưa có dữ liệu',
        phone: candidateContact.phone || candidateContact.secondaryPhone || 'Chưa có dữ liệu',
        studentName: candidateContact.leadStudentName || candidateContact.studentName || 'Chưa có dữ liệu',
        birthYear: candidateContact.studentBirthYear || '',
        reasonLabels: Array.from(new Set(reasons)),
      })
    }
  })

  const levelRank = { high: 0, medium: 1, low: 2 }
  return candidates.sort((a, b) => levelRank[a.level] - levelRank[b.level])
}

function getParentConvertWarningLabel(level) {
  if (level === 'high') {
    return 'Có khả năng trùng cao'
  }

  if (level === 'medium') {
    return 'Cần kiểm tra thủ công'
  }

  return 'Chưa thấy hồ sơ gần giống'
}

function getPreviewPhones(values = []) {
  return values.map((value) => normalizePreviewPhone(value)).filter(Boolean)
}

function normalizePreviewPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')

  if (!digits) {
    return ''
  }

  if (digits.startsWith('84') && digits.length >= 10) {
    return `0${digits.slice(2)}`
  }

  return digits
}

function hasPhoneOverlap(leftPhones, rightPhones) {
  return leftPhones.some((phone) => rightPhones.includes(phone))
}

function getStudentBirthYear(student = {}) {
  if (student.birthYear) {
    return String(student.birthYear)
  }

  const birthDate = String(student.birthDate || '').trim()
  return /^\d{4}/.test(birthDate) ? birthDate.slice(0, 4) : ''
}

function displayPreviewValue(value) {
  if (value === 0) {
    return '0'
  }

  return String(value || '').trim() || 'Chưa có dữ liệu'
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
