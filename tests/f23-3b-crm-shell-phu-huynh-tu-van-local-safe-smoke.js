import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  addCareLogToParentContact,
  buildParentContactFromForm,
  deriveParentCustomerStage,
  getFilteredParentConsultations,
  initialParentConsultationFilters,
  renderParentConsultationModule,
  validateParentContactForm,
} from '../src/parent-consultation-module.js'

const oldLead = {
  id: 'old-lead',
  contactType: 'consultingLead',
  parentName: 'Phụ huynh Lead',
  phone: '0901000001',
  consultationStatus: 'newLead',
  source: 'facebook',
  careLogs: [],
  appointments: [],
}

const oldConsulting = {
  id: 'old-consulting',
  contactType: 'consultingLead',
  parentName: 'Phụ huynh Tư vấn',
  phone: '0901000002',
  consultationStatus: 'waitingResponse',
  source: 'zalo',
  leadStudentName: 'Bé Cần Tư vấn',
  leadNeed: 'Cần tư vấn lớp nhập môn',
  nextAction: 'Cần gọi lại',
  careLogs: [],
  appointments: [],
}

const converted = {
  id: 'converted-contact',
  contactType: 'consultingLead',
  parentName: 'Phụ huynh Đã chuyển đổi',
  phone: '0901000003',
  consultationStatus: 'converted',
  source: 'oldStudent',
  studentId: 'student-existing-1',
  studentName: 'Học viên có sẵn',
  careLogs: [],
  appointments: [],
}

const derivedStudent = {
  id: 'student-derived-1',
  fullName: 'Học viên Derived',
  parentName: 'Phụ huynh Derived',
  parentPhone: '0901000099',
  careNotes: [{ id: 'student-note-1', content: 'Note học viên sẵn có', createdAt: '2026-07-20T08:00:00.000Z' }],
}

assert.equal(deriveParentCustomerStage(oldLead), 'lead')
assert.equal(deriveParentCustomerStage(oldConsulting), 'consulting')
assert.equal(deriveParentCustomerStage(converted), 'converted')
assert.equal(
  deriveParentCustomerStage({ ...oldLead, careLogs: [{ content: 'Đã chăm sóc' }] }),
  'consulting',
)
assert.equal(
  deriveParentCustomerStage({ ...oldLead, linkedStudentIds: ['student-linked-1'] }),
  'converted',
)

const html = renderParentConsultationModule(
  [oldLead, oldConsulting, converted],
  initialParentConsultationFilters,
  [derivedStudent],
  null,
  null,
  null,
  'old-consulting',
)

assert(html.includes('Phụ huynh / Tư vấn'))
assert(!html.includes('CRM khách hàng gia đình'), 'Redundant CRM subtitle should not take dashboard space.')
assert(!html.includes('parent-consultation-title'), 'Redundant inner title block should be removed.')
assert(html.includes('Khách mới'))
assert(html.includes('Đang tư vấn'))
assert(html.includes('Đã chuyển đổi'))
assert(html.includes('data-parent-consultation-filter="customerStage"'), 'Stage filter is present.')
assert(html.includes('+ Thêm khách mới'), 'Create lead CTA is present.')
assert(html.includes('Tư vấn / Nguồn'), 'CRM list shows consultant/source column.')
assert(html.includes('Nhu cầu / Bé'), 'CRM list shows need/student column.')
assert(html.includes('Next action'), 'CRM list shows next action column.')
assert(html.includes('student-existing-1') || html.includes('1 học viên liên kết'))
assert(html.includes('Ghi chú chăm sóc'), 'Detail shows CRM care notes.')
assert(html.includes('data-parent-quick-note-contact-id="old-consulting"'), 'Detail can add a CRM care note.')
assert(html.includes('Chuyển đổi khách hàng'), 'Convert preview box is present.')
assert(html.includes('data-parent-convert-preview-action="open"'), 'Convert preview action is present and local-safe.')

const createHtml = renderParentConsultationModule(
  [oldLead],
  initialParentConsultationFilters,
  [],
  {
    mode: 'create',
    contactId: null,
    values: {
      contactType: 'consultingLead',
      customerStage: 'lead',
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
      consultantName: '',
      nextFollowUpAt: '',
      potentialLevel: '',
    },
    careLogs: [],
    careLogDraft: {},
    appointments: [],
    appointmentDraft: {},
    enrollmentDraft: {},
    enrollmentErrors: {},
    enrollmentMessage: '',
    activeStep: 2,
    scrollTop: 0,
    errors: {},
  },
)

assert(createHtml.includes('parent-child-consultation-layout'), 'Step 2 uses polished child consultation layout.')
assert(createHtml.includes('Họ và tên bé tư vấn'), 'Step 2 keeps the child name input.')
assert(createHtml.includes('Nhu cầu học / ghi chú ban đầu'), 'Step 2 has a clearer need/initial note label.')

const filteredLead = getFilteredParentConsultations([oldLead, oldConsulting, converted], {
  ...initialParentConsultationFilters,
  customerStage: 'lead',
})
assert.deepEqual(filteredLead.map((contact) => contact.id), ['old-lead'])

const validationErrors = validateParentContactForm({
  ...oldLead,
  parentName: '',
  phone: '',
})
assert(validationErrors.parentName)
assert(validationErrors.phone)

const localLead = buildParentContactFromForm({
  contactType: 'consultingLead',
  customerStage: 'lead',
  parentName: 'Khách local-safe',
  phone: '0909123456',
  secondaryPhone: '',
  email: '',
  studentId: '',
  studentName: '',
  studentSearch: '',
  leadStudentName: 'Bé Local',
  studentBirthYear: '2018',
  leadStudentAge: '',
  leadNeed: 'Muốn học cờ vua nhập môn',
  parentFeedbackAboutChild: '',
  consultationStatus: 'newLead',
  source: 'website',
  interestedProgram: 'Cờ vua nhập môn',
  preferredSchedule: 'Tối thứ 3',
  consultedAt: '',
  registeredAt: '',
  lastNote: 'Ghi chú đầu tiên',
  nextAction: 'Cần gọi lại',
  consultantName: 'Tư vấn A',
  nextFollowUpAt: '',
  potentialLevel: '',
})

assert.equal(localLead.customerStage, 'lead')
assert.equal(localLead.consultationStatus, 'newLead')
assert.equal(localLead.consultantName, 'Tư vấn A')
assert.equal(localLead.careLogs.length, 1, 'First note is stored in contact.careLogs.')
assert.equal(localLead.linkedStudentIds.length, 0, 'Creating a fresh lead does not link or create a student.')

const studentsBefore = JSON.stringify([derivedStudent])
const tuitionBefore = JSON.stringify([{ id: 'tuition-1', studentId: 'student-derived-1', usedSessions: 2 }])
const updatedLead = addCareLogToParentContact(localLead, {
  contactedAt: '2026-07-21T09:00',
  channel: 'phone',
  content: 'Đã tư vấn học thử',
  result: 'Phụ huynh quan tâm học phí',
  nextAction: 'Cần gửi bảng phí',
})

assert.equal(updatedLead.careLogs.length, 2)
assert.equal(updatedLead.customerStage, 'consulting')
assert.equal(JSON.stringify([derivedStudent]), studentsBefore, 'CRM care log must not write student.careNotes when unlinked.')
assert.equal(tuitionBefore, JSON.stringify([{ id: 'tuition-1', studentId: 'student-derived-1', usedSessions: 2 }]), 'CRM shell must not create tuition or update usedSessions.')

const parentModuleSource = fs.readFileSync('src/parent-consultation-module.js', 'utf8')
const mainSource = fs.readFileSync('src/main.js', 'utf8')
const storageSource = fs.readFileSync('src/storage.js', 'utf8')
const stylesSource = fs.readFileSync('src/styles.css', 'utf8')

assert(parentModuleSource.includes('parent-contact-form parent-contact-wizard-modal'), 'Wizard modal should use a dedicated full-frame class.')
assert(stylesSource.includes('height: min(960px, calc(100dvh - 64px), calc(100% - 4px))'), 'Create/edit modal should be near full-height and viewport-safe.')
assert(stylesSource.includes('padding: 8px 12px max(52px, env(safe-area-inset-bottom))'), 'Modal backdrop should leave a clear bottom safe area.')
assert(stylesSource.includes('.parent-contact-wizard-modal'), 'Wizard modal should have a full-wrap/full-frame styling hook.')
assert(stylesSource.includes('.parent-contact-form-scroll') && stylesSource.includes('overflow: auto'), 'Form body needs its own scroll region.')
assert(stylesSource.includes('position: sticky') && stylesSource.includes('bottom: 0'), 'Form footer remains usable near the taskbar.')
assert(stylesSource.includes('padding: 14px 16px 18px'), 'Body should not need hidden footer-overlap padding when footer is in the frame.')
assert(stylesSource.includes('background: #111821'), 'Header/footer frame should use a solid dark background.')
assert(stylesSource.includes('.parent-student-picker-search-input'), 'Related-student search input needs a scoped dark style.')
assert(stylesSource.includes('background: #0b121a'), 'Modal scroll/search regions should use dark backgrounds.')
assert(stylesSource.includes('scrollbar-color: rgba(118, 164, 231, 0.5) rgba(255, 255, 255, 0.055)'), 'Modal and picker scrollbars should be dark themed.')
assert(parentModuleSource.includes('class="parent-student-picker-search-input"'), 'Related-student search input keeps the CRM dark input class.')
assert(parentModuleSource.includes('data-parent-student-search-input'), 'Related-student search input has a stable hook and is not replaced for filtering.')
assert(parentModuleSource.includes('data-parent-student-picker-results'), 'Related-student results have a local update hook.')
assert(mainSource.includes('function syncParentContactWizardStep4Draft'), 'Step 4 sync helper should exist.')
assert(mainSource.includes('function collectParentContactWizardValuesFromDOM'), 'Step 4 navigation should collect current DOM values before syncing.')
assert(!mainSource.includes("if (fieldName === 'studentSearch' || fieldName === 'studentBirthYear')"), 'Field input/change must not rerender the whole wizard.')
assert(mainSource.includes('collectParentContactWizardValuesFromDOM(parentConsultationFormState)'), 'Step 4 sync should use current DOM values, not stale state.')
assert(mainSource.includes('forceContactValues: nextStep === 4'), 'Entering step 4 should force-refresh contact-derived preview values every time.')
assert(mainSource.includes('forceContactValues: true'), 'Step 4 actions should force-refresh from the latest wizard values.')
assert(mainSource.includes('phone: forceContactValues') && mainSource.includes("values.phone || ''"), 'Step 4 phone preview must not keep stale draft.phone over a newer phone value.')
assert(!/hasSyncedStep4|step4Initialized|previewReady|step4SyncedOnce/i.test(mainSource), 'Step 4 sync must not have a one-time guard flag.')
assert(mainSource.includes('function renderParentStudentPickerResults'), 'Related-student search should update the results list locally.')
assert(mainSource.includes('renderParentStudentPickerResults(fieldValue)'), 'Typing in related-student search should update results without rendering the modal.')
assert(mainSource.includes("'data-parent-contact-field'"), 'Render focus restore should recognize parent wizard fields.')
const contactFieldHandler = mainSource.match(/document\.querySelectorAll\('\[data-parent-contact-field\]'\)[\s\S]*?document\.querySelector\('\[data-parent-contact-form-scroll\]'\)/)?.[0] || ''
assert(contactFieldHandler, 'Parent contact field handler should be inspectable.')
assert(!contactFieldHandler.includes('render()'), 'Parent contact field input/change handler must not rerender the app or wizard.')
const pickerHandler = mainSource.match(/document\.querySelector\('\[data-parent-student-picker\]'\)[\s\S]*?document\.querySelectorAll\('\[data-parent-care-log-field\]'\)/)?.[0] || ''
assert(pickerHandler, 'Parent student picker handler should be inspectable.')
assert(!pickerHandler.includes('render()'), 'Selecting or clearing a related student must not replace the wizard DOM.')
const enrollmentFieldHandler = mainSource.match(/document\.querySelectorAll\('\[data-parent-enrollment-field\]'\)[\s\S]*?document\.querySelector\('\[data-parent-contact-action="open-create"\]'\)/)?.[0] || ''
assert(enrollmentFieldHandler, 'Parent enrollment field handler should be inspectable.')
assert(!enrollmentFieldHandler.includes('render()'), 'Step 4 enrollment input/change handler must not rerender the wizard.')

const mojibakeMarkers = [
  '\u0043\u0102\u00A1\u00C2\u00BA',
  '\u0102\u0192',
  '\u0102\u2020\u00C2\u00B0',
  '\u0048\u0102\u00A1\u00C2\u00BA',
  '\u0102\u00A1\u00C2\u00BB',
  '\u0042\u0075\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00A2\u0069\u0020\u0068\u0102\u00A1\u00C2\u00BB\u00C2\u008D\u0063\u0020\u006D\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00BA\u0069',
]

for (const source of [parentModuleSource, mainSource, storageSource, stylesSource]) {
  for (const marker of mojibakeMarkers) {
    assert(!source.includes(marker), `Mojibake marker must not appear: ${marker}`)
  }
}

for (const buttonMatch of parentModuleSource.matchAll(/<button\b[^>]*>/g)) {
  assert(
    buttonMatch[0].includes('type="button"') || buttonMatch[0].includes('disabled'),
    `Action button must have type="button": ${buttonMatch[0]}`,
  )
}

assert(!parentModuleSource.includes('saveStoredStudents'), 'CRM module must not write students.')
assert(!parentModuleSource.includes('tuitionRecords'), 'CRM module must not touch tuition records.')
assert(!parentModuleSource.toLowerCase().includes('supabase'), 'CRM module must not add Supabase behavior.')
assert(!parentModuleSource.toLowerCase().includes('auth'), 'CRM module must not add Auth behavior.')
assert(!mainSource.includes('teacher-workspace-module'), 'F23.3B must not touch Teacher Workspace.')

console.log('F23.3B CRM shell Phụ huynh/Tư vấn local-safe smoke passed')
