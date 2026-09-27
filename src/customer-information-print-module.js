import { formatOperatorDate, formatOperatorDateTime } from './operator-date-format.js'

export const CUSTOMER_INFORMATION_PRINT_ROOT_CLASS = 'customer-information-print-runtime-root'
export const CUSTOMER_INFORMATION_PRINT_ROOT_SELECTOR = `.${CUSTOMER_INFORMATION_PRINT_ROOT_CLASS}`

const EMPTY_VALUE = '—'

const CUSTOMER_STAGE_LABELS = Object.freeze({
  lead: 'Khách hàng mới',
  consulting: 'Đang tư vấn',
  converted: 'Đã chuyển đổi',
})

const CONSULTATION_STATUS_LABELS = Object.freeze({
  activeCare: 'Đang chăm sóc',
  newLead: 'Khách hàng mới',
  waitingResponse: 'Chờ phản hồi',
  trialScheduled: 'Đã hẹn học thử',
  pendingEnrollment: 'Sẵn sàng đăng ký',
  converted: 'Đã chuyển đổi',
  paused: 'Tạm dừng',
  closed: 'Đã đóng',
})

const APPOINTMENT_TYPE_LABELS = Object.freeze({
  consultation: 'Tư vấn',
  trialLesson: 'Học thử',
  callback: 'Gọi lại',
  followUp: 'Chăm sóc lại',
  other: 'Khác',
})

const APPOINTMENT_STATUS_LABELS = Object.freeze({
  scheduled: 'Đã hẹn',
  completed: 'Đã hoàn tất',
  missed: 'Lỡ hẹn',
  cancelled: 'Đã hủy',
  rescheduled: 'Dời lịch',
})

const APPOINTMENT_CHANNEL_LABELS = Object.freeze({
  phone: 'Điện thoại',
  zalo: 'Zalo',
  facebook: 'Facebook',
  direct: 'Trực tiếp',
  email: 'Email',
  note: 'Ghi chú',
  other: 'Khác',
})

const GUARDIAN_ROLE_LABELS = Object.freeze({
  FATHER: 'Bố',
  MOTHER: 'Mẹ',
  OTHER: 'Người giám hộ khác',
  UNSPECIFIED: 'Chưa xác định',
})

const CHILD_CHESS_LEVEL_LABELS = Object.freeze({
  new: 'Chưa biết chơi',
  basic: 'Đã biết chơi cơ bản',
  advanced: 'Muốn nâng cao trình độ',
})

export function createCustomerInformationPrintSnapshot({
  centerId = '',
  centerName = '',
  contact,
  exportedAt = new Date().toISOString(),
} = {}) {
  const normalizedCenterId = cleanText(centerId)
  const canonicalContactId = cleanText(contact?.canonicalContactId)

  if (
    !normalizedCenterId
    || !contact
    || typeof contact !== 'object'
    || contact.isDerivedFromStudents
    || !canonicalContactId
  ) {
    return null
  }

  const canShowProtectedContact = contact.contactIdentityAvailable === true
  const parentStudentLinks = Array.isArray(contact.parentStudentLinks)
    ? contact.parentStudentLinks
    : []

  return {
    kind: 'customer-information-print-snapshot',
    centerId: normalizedCenterId,
    centerName: displayText(centerName || normalizedCenterId),
    exportedAt: displayDateTime(exportedAt),
    customer: {
      parentName: displayText(contact.parentName),
      phone: canShowProtectedContact ? displayText(contact.phone) : EMPTY_VALUE,
      secondaryPhone: canShowProtectedContact ? displayText(contact.secondaryPhone) : EMPTY_VALUE,
      email: canShowProtectedContact ? displayText(contact.email) : EMPTY_VALUE,
      contactVisibility: canShowProtectedContact
        ? 'Thông tin liên hệ được phép hiển thị trong phiên hiện tại.'
        : 'Thông tin liên hệ đang được bảo vệ và không hiển thị trong phiên hiện tại.',
      locationArea: displayText(contact.locationArea),
      source: displayText(contact.sourceLabel),
      customerStage: displayText(CUSTOMER_STAGE_LABELS[contact.customerStage]),
      consultationStatus: displayText(CONSULTATION_STATUS_LABELS[contact.consultationStatus]),
      consultantName: displayText(contact.consultantName || contact.advisorName),
      createdAt: displayDate(contact.createdAt),
      consultedAt: displayDate(contact.consultedAt),
      registeredAt: displayDate(contact.registeredAt),
    },
    prospectiveStudent: {
      name: displayText(contact.leadStudentName),
      birthYear: displayText(contact.studentBirthYear),
      age: displayText(contact.leadStudentAge),
      currentLevel: displayText(
        contact.potentialLevel
        || CHILD_CHESS_LEVEL_LABELS[contact.enrollmentDraft?.childChessLevel],
      ),
      interestedProgram: displayText(contact.interestedProgram),
      learningNeed: displayText(contact.leadNeed),
      parentFeedback: displayText(contact.parentFeedbackAboutChild),
      preferredSchedule: displayText(contact.preferredSchedule),
    },
    registration: normalizeRegistration(contact.enrollmentDraft),
    appointments: normalizeAppointments(contact.appointments),
    relatedStudents: normalizeRelatedStudents(contact.relatedStudents, parentStudentLinks),
  }
}

export function renderCustomerInformationPrintDocument(snapshot) {
  if (!snapshot || snapshot.kind !== 'customer-information-print-snapshot') {
    return ''
  }

  const { customer, prospectiveStudent, registration } = snapshot

  return `
    <style data-customer-information-print-page>
      @page { size: A4 portrait; margin: 12mm; }
    </style>
    <section class="customer-information-print-document" data-customer-information-print-document aria-label="Phiếu thông tin khách hàng">
      <header class="customer-information-print-header">
        <div>
          <p class="customer-information-print-kicker">PHIẾU THÔNG TIN KHÁCH HÀNG</p>
          <h1>${escapeHtml(customer.parentName)}</h1>
          <p>${escapeHtml(snapshot.centerName)}</p>
        </div>
        <dl class="customer-information-print-meta">
          ${renderDetailRow('Cơ sở', snapshot.centerName)}
          ${renderDetailRow('Ngày xuất tài liệu', snapshot.exportedAt)}
        </dl>
      </header>

      <p class="customer-information-print-notice">
        Tài liệu được tạo từ dữ liệu hiện tại trong hồ sơ CRM và học viên đã liên kết; không tạo thêm bản ghi nghiệp vụ.
      </p>

      <section class="customer-information-print-section">
        <h2>Thông tin khách hàng</h2>
        <dl class="customer-information-print-grid">
          ${renderDetailRow('Họ tên phụ huynh / khách hàng', customer.parentName)}
          ${renderDetailRow('Số điện thoại', customer.phone)}
          ${renderDetailRow('Số điện thoại khác', customer.secondaryPhone)}
          ${renderDetailRow('Email', customer.email)}
          ${renderDetailRow('Khu vực sinh sống', customer.locationArea)}
          ${renderDetailRow('Nguồn khách hàng', customer.source)}
          ${renderDetailRow('Giai đoạn', customer.customerStage)}
          ${renderDetailRow('Trạng thái tư vấn', customer.consultationStatus)}
          ${renderDetailRow('Tư vấn phụ trách', customer.consultantName)}
          ${renderDetailRow('Ngày tạo hồ sơ', customer.createdAt)}
          ${renderDetailRow('Ngày tư vấn', customer.consultedAt)}
          ${renderDetailRow('Ngày đăng ký', customer.registeredAt)}
        </dl>
        <p class="customer-information-print-privacy">${escapeHtml(customer.contactVisibility)}</p>
      </section>

      <section class="customer-information-print-section">
        <h2>Học viên cần tư vấn và nhu cầu</h2>
        <dl class="customer-information-print-grid">
          ${renderDetailRow('Họ tên học viên', prospectiveStudent.name)}
          ${renderDetailRow('Năm sinh', prospectiveStudent.birthYear)}
          ${renderDetailRow('Tuổi', prospectiveStudent.age)}
          ${renderDetailRow('Trình độ hiện tại', prospectiveStudent.currentLevel)}
          ${renderDetailRow('Chương trình quan tâm', prospectiveStudent.interestedProgram)}
          ${renderDetailRow('Lịch học mong muốn', prospectiveStudent.preferredSchedule)}
          ${renderDetailRow('Nhu cầu / mục tiêu học', prospectiveStudent.learningNeed, true)}
          ${renderDetailRow('Phản hồi của phụ huynh về học viên', prospectiveStudent.parentFeedback, true)}
        </dl>
      </section>

      ${renderRelatedStudents(snapshot.relatedStudents)}
      ${renderAppointments(snapshot.appointments)}

      <section class="customer-information-print-section">
        <h2>Thông tin đăng ký dự kiến</h2>
        <dl class="customer-information-print-grid">
          ${renderDetailRow('Học viên', registration.studentName)}
          ${renderDetailRow('Năm sinh', registration.studentBirthYear)}
          ${renderDetailRow('Chương trình', registration.interestedProgram)}
          ${renderDetailRow('Trình độ hiện tại', registration.currentLevel)}
          ${renderDetailRow('Ngày học thử dự kiến', registration.expectedTrialDate)}
          ${renderDetailRow('Ngày bắt đầu dự kiến', registration.expectedStartDate)}
          ${renderDetailRow('Lịch học mong muốn', registration.preferredSchedule)}
          ${renderDetailRow('Người tư vấn / phụ trách', registration.advisorName)}
        </dl>
      </section>
    </section>
  `
}

function normalizeRegistration(registration = {}) {
  const source = registration && typeof registration === 'object' ? registration : {}

  return {
    studentName: displayText(source.studentName),
    studentBirthYear: displayText(source.studentBirthYear),
    interestedProgram: displayText(source.interestedProgram),
    currentLevel: displayText(CHILD_CHESS_LEVEL_LABELS[source.childChessLevel] || source.childChessLevel),
    expectedTrialDate: displayDate(source.expectedTrialDate || source.trialScheduledAt),
    expectedStartDate: displayDate(source.expectedStartDate),
    preferredSchedule: displayText(source.preferredSchedule),
    advisorName: displayText(source.advisorName),
  }
}

function normalizeAppointments(appointments = []) {
  return (Array.isArray(appointments) ? appointments : [])
    .filter((appointment) => appointment && typeof appointment === 'object')
    .map((appointment) => ({
      type: displayText(APPOINTMENT_TYPE_LABELS[appointment.appointmentType]),
      scheduledAt: displayDateTime(appointment.scheduledAt),
      status: displayText(APPOINTMENT_STATUS_LABELS[appointment.status]),
      channel: displayText(APPOINTMENT_CHANNEL_LABELS[appointment.channel]),
      location: displayText(appointment.location),
      note: displayText(appointment.note),
    }))
}

function normalizeRelatedStudents(students = [], links = []) {
  return (Array.isArray(students) ? students : [])
    .filter((student) => student && typeof student === 'object' && !student.isDeleted)
    .map((student) => {
      const link = links.find((item) => item?.studentId === student.id) || {}

      return {
        name: displayText(student.fullName || student.name),
        birthDate: displayDate(student.birthDate),
        schoolName: displayText(student.schoolName || student.school),
        level: displayText(student.level),
        status: displayText(student.currentStatus || student.status),
        guardianRole: displayText(GUARDIAN_ROLE_LABELS[cleanText(link.guardianRole).toUpperCase()]),
        guardianOccupation: displayText(link.occupation),
      }
    })
}

function renderRelatedStudents(students = []) {
  const body = students.length
    ? students.map((student) => `
        <article class="customer-information-print-card">
          <h3>${escapeHtml(student.name)}</h3>
          <dl class="customer-information-print-grid">
            ${renderDetailRow('Ngày sinh', student.birthDate)}
            ${renderDetailRow('Trường', student.schoolName)}
            ${renderDetailRow('Trình độ', student.level)}
            ${renderDetailRow('Trạng thái', student.status)}
            ${renderDetailRow('Quan hệ với khách hàng', student.guardianRole)}
            ${renderDetailRow('Nghề nghiệp người giám hộ', student.guardianOccupation)}
          </dl>
        </article>
      `).join('')
    : '<p class="customer-information-print-empty">Chưa có học viên được liên kết.</p>'

  return `
    <section class="customer-information-print-section">
      <h2>Học viên đã liên kết</h2>
      <div class="customer-information-print-card-list">${body}</div>
    </section>
  `
}

function renderAppointments(appointments = []) {
  const body = appointments.length
    ? appointments.map((appointment) => `
        <article class="customer-information-print-card">
          <h3>${escapeHtml(appointment.type)} · ${escapeHtml(appointment.scheduledAt)}</h3>
          <dl class="customer-information-print-grid">
            ${renderDetailRow('Trạng thái', appointment.status)}
            ${renderDetailRow('Kênh', appointment.channel)}
            ${renderDetailRow('Địa điểm', appointment.location)}
            ${renderDetailRow('Nội dung', appointment.note, true)}
          </dl>
        </article>
      `).join('')
    : '<p class="customer-information-print-empty">Chưa có lịch hẹn.</p>'

  return `
    <section class="customer-information-print-section">
      <h2>Lịch hẹn</h2>
      <div class="customer-information-print-card-list">${body}</div>
    </section>
  `
}

function renderDetailRow(label, value, wide = false) {
  return `
    <div${wide ? ' class="is-wide"' : ''}>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(displayText(value))}</dd>
    </div>
  `
}

function displayDate(value) {
  const source = cleanText(value)
  if (!source) return EMPTY_VALUE

  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    return formatOperatorDate(source, EMPTY_VALUE)
  }

  const formatted = formatOperatorDateTime(source, EMPTY_VALUE)
  return formatted === EMPTY_VALUE ? EMPTY_VALUE : formatted.split(' ')[0]
}

function displayDateTime(value) {
  const source = cleanText(value)
  if (!source) return EMPTY_VALUE
  return formatOperatorDateTime(source, EMPTY_VALUE)
}

function displayText(value) {
  return cleanText(value) || EMPTY_VALUE
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
