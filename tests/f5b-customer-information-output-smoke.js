import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  CUSTOMER_INFORMATION_PRINT_ROOT_CLASS,
  CUSTOMER_INFORMATION_PRINT_ROOT_SELECTOR,
  createCustomerInformationPrintSnapshot,
  renderCustomerInformationPrintDocument,
} from '../src/customer-information-print-module.js'
import { renderParentConsultationModule } from '../src/parent-consultation-module.js'

const contact = {
  id: 'crm-visible-row',
  canonicalContactId: 'd94aa6ce-5d66-4d89-bae9-25ba3a92c100',
  canonicalCaseId: 'f639eeec-288c-43d0-9f55-ee98f587a100',
  parentName: 'Nguyễn Thị Ánh Dương với tên rất dài',
  phone: '0901234567',
  secondaryPhone: '0912345678',
  email: 'anh.duong@example.test',
  contactIdentityAvailable: true,
  locationArea: 'Phường Bến Nghé, Quận 1',
  sourceLabel: 'Giới thiệu từ phụ huynh',
  customerStage: 'consulting',
  consultationStatus: 'trialScheduled',
  consultantName: 'Tư vấn viên Nguyễn Văn An',
  createdAt: '2026-09-01T08:00:00+07:00',
  consultedAt: '2026-09-02',
  registeredAt: '',
  leadStudentName: 'Trần Gia Bảo',
  studentBirthYear: '2017',
  leadStudentAge: '9',
  potentialLevel: 'Dolphin 2',
  interestedProgram: 'Chương trình cờ vua giáo dục',
  preferredSchedule: 'Thứ Bảy và Chủ nhật\n08:00–10:00',
  leadNeed: '<script>alert("unsafe")</script> Rèn tập trung & tư duy.',
  parentFeedbackAboutChild: 'Bé kiên nhẫn nhưng cần hướng dẫn chậm.',
  enrollmentDraft: {
    studentName: 'Trần Gia Bảo',
    studentBirthYear: '2017',
    interestedProgram: 'Chương trình cờ vua giáo dục',
    childChessLevel: 'basic',
    expectedTrialDate: '2026-09-25',
    expectedStartDate: '2026-10-01',
    preferredSchedule: 'Cuối tuần',
    advisorName: 'Tư vấn viên Nguyễn Văn An',
  },
  appointments: [
    {
      appointmentType: 'trialLesson',
      scheduledAt: '2026-09-25T09:30:00+07:00',
      status: 'scheduled',
      channel: 'direct',
      location: 'Phòng học số 1',
      note: 'Mang theo sổ & bút <không chèn HTML>',
    },
  ],
  parentStudentLinks: [
    {
      studentId: 'student-current-1',
      guardianRole: 'MOTHER',
      occupation: 'Kế toán',
    },
  ],
  relatedStudents: [
    {
      id: 'student-current-1',
      fullName: 'Trần Minh Khang',
      birthDate: '2015-03-12',
      schoolName: 'Trường Tiểu học Ánh Sao',
      level: 'Turtle 2',
      currentStatus: 'Đang theo học',
      parentPhone: '0999999999',
    },
  ],
}

const snapshot = createCustomerInformationPrintSnapshot({
  centerId: 'dreamhome',
  centerName: 'iChess DreamHome',
  contact,
  exportedAt: '2026-09-22T16:45:00+07:00',
})

assert(snapshot)
assert.equal(snapshot.kind, 'customer-information-print-snapshot')
assert.equal(snapshot.customer.phone, contact.phone)
assert.equal(snapshot.customer.email, contact.email)
assert.equal(snapshot.customer.createdAt, '01/09/2026')
assert.equal(snapshot.customer.consultedAt, '02/09/2026')
assert.equal(snapshot.prospectiveStudent.currentLevel, 'Dolphin 2')
assert.equal(snapshot.registration.currentLevel, 'Đã biết chơi cơ bản')
assert.equal(snapshot.relatedStudents[0].guardianRole, 'Mẹ')
assert.equal(snapshot.relatedStudents[0].birthDate, '12/03/2015')

const html = renderCustomerInformationPrintDocument(snapshot)

assert(html.includes('PHIẾU THÔNG TIN KHÁCH HÀNG'))
assert(html.includes('Nguyễn Thị Ánh Dương với tên rất dài'))
assert(html.includes('25/09/2026 09:30'))
assert(html.includes('25/09/2026'))
assert(html.includes('01/10/2026'))
assert(html.includes('Thứ Bảy và Chủ nhật\n08:00–10:00'))
assert(html.includes('&lt;script&gt;alert(&quot;unsafe&quot;)&lt;/script&gt; Rèn tập trung &amp; tư duy.'))
assert(html.includes('Mang theo sổ &amp; bút &lt;không chèn HTML&gt;'))
assert(!html.includes('<script>alert("unsafe")</script>'))
assert(!html.includes(contact.canonicalContactId))
assert(!html.includes(contact.canonicalCaseId))
assert(!html.includes('student-current-1'))
assert(!html.includes('0999999999'))

const protectedPhone = '0988777666'
const protectedEmail = 'protected@example.test'
const maskedSnapshot = createCustomerInformationPrintSnapshot({
  centerId: 'dreamhome',
  centerName: 'iChess DreamHome',
  contact: {
    ...contact,
    phone: protectedPhone,
    secondaryPhone: '0977666555',
    email: protectedEmail,
    contactIdentityAvailable: false,
  },
})
const maskedHtml = renderCustomerInformationPrintDocument(maskedSnapshot)

assert(maskedSnapshot)
assert.equal(maskedSnapshot.customer.phone, '—')
assert.equal(maskedSnapshot.customer.secondaryPhone, '—')
assert.equal(maskedSnapshot.customer.email, '—')
assert(maskedHtml.includes('đang được bảo vệ'))
assert(!maskedHtml.includes(protectedPhone))
assert(!maskedHtml.includes(protectedEmail))
assert(!JSON.stringify(maskedSnapshot).includes(protectedPhone))
assert(!JSON.stringify(maskedSnapshot).includes(protectedEmail))

assert.equal(createCustomerInformationPrintSnapshot({
  centerId: 'dreamhome',
  contact: { ...contact, isDerivedFromStudents: true },
}), null)
assert.equal(createCustomerInformationPrintSnapshot({ centerId: '', contact }), null)
assert.equal(createCustomerInformationPrintSnapshot({
  centerId: 'dreamhome',
  contact: { ...contact, canonicalContactId: '' },
}), null)

const customerModuleHtml = renderParentConsultationModule(
  [contact],
  undefined,
  contact.relatedStudents,
  null,
  null,
  null,
  contact.id,
  null,
  { isLoading: false, isSaving: false, messageTone: '', lastLoadedAt: '2026-09-22T00:00:00Z' },
  { status: 'ready', moduleRefreshStatus: 'ready', links: contact.parentStudentLinks },
)

assert(customerModuleHtml.includes('data-parent-contact-action="print-information"'))
assert(customerModuleHtml.includes('In/PDF thông tin'))

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const styleSource = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

assert.equal(CUSTOMER_INFORMATION_PRINT_ROOT_CLASS, 'customer-information-print-runtime-root')
assert.equal(CUSTOMER_INFORMATION_PRINT_ROOT_SELECTOR, '.customer-information-print-runtime-root')
assert(mainSource.includes('createCustomerInformationPrintSnapshot'))
assert(mainSource.includes('getCurrentCanonicalCenterContext()'))
assert(mainSource.includes('printCustomerInformation(button.dataset.contactId)'))
assert(mainSource.includes("window.addEventListener('afterprint', cleanup, { once: true })"))
assert(styleSource.includes('body:has(.customer-information-print-runtime-root) .app-shell'))
assert(styleSource.includes('@media print'))

console.log('F5B Customer information print/PDF source-only smoke passed')
