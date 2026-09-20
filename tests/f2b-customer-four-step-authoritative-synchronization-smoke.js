import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildEnrollmentSummary,
  buildParentContactFromForm,
  createEditParentContactFormState,
  createEnrollmentDraftFromContact,
  initialParentConsultationFilters,
  renderParentConsultationModule,
  saveEnrollmentDraftToParentContact,
} from '../src/parent-consultation-module.js'
import { buildC53SafeCaseState } from '../src/cloud-authoritative-crm.js'

const sharedTruthState = {
  lastLoadedAt: '2026-09-21T00:00:00.000Z',
  messageTone: 'success',
  eligibleConsultants: [{ userId: 'consultant-1', label: 'Tư vấn Linh' }],
}
const integrationState = { status: 'ready', moduleRefreshStatus: 'fresh', links: [] }
const renderForm = (formState) => renderParentConsultationModule(
  [],
  initialParentConsultationFilters,
  [],
  formState,
  null,
  null,
  null,
  null,
  sharedTruthState,
  integrationState,
)

const canonicalContact = {
  id: 'contact-f2b',
  contactType: 'consultingLead',
  customerStage: 'consulting',
  parentName: 'Phụ huynh Canonical',
  phone: '',
  leadStudentName: 'Bé Canonical',
  studentBirthYear: '2017',
  leadStudentAge: '',
  leadNeed: 'Mong muốn Canonical',
  parentFeedbackAboutChild: 'Phản hồi Canonical',
  consultationStatus: 'activeCare',
  source: 'parentReferral',
  interestedProgram: 'Chương trình cờ vua giáo dục',
  preferredSchedule: 'Tối thứ 3 và thứ 5',
  consultedAt: '2026-09-20',
  registeredAt: '2026-09-21',
  nextAction: 'Hẹn học thử',
  consultantId: 'consultant-1',
  consultantName: 'Tư vấn Linh',
  potentialLevel: 'Giá trị lịch sử được giữ lại',
  careLogs: [],
  appointments: [],
  enrollmentDraft: {
    isReady: false,
    studentName: 'Bé Stale',
    studentBirthYear: '2012',
    parentName: 'Phụ huynh Stale',
    interestedProgram: 'Chương trình Stale',
    preferredSchedule: 'Lịch Stale',
    learningGoal: 'Mong muốn Stale',
    advisorName: 'Tư vấn Stale',
    expectedTrialDate: '2026-09-25',
    childChessLevel: 'basic',
    note: 'Ghi chú học thử hợp lệ',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T01:00:00.000Z',
    contactMethodProtected: true,
  },
}

const editState = createEditParentContactFormState(canonicalContact)
const synchronizedDraft = createEnrollmentDraftFromContact({
  ...editState.values,
  enrollmentDraft: editState.enrollmentDraft,
})
assert.equal(synchronizedDraft.studentName, 'Bé Canonical')
assert.equal(synchronizedDraft.studentBirthYear, '2017')
assert.equal(synchronizedDraft.parentName, 'Phụ huynh Canonical')
assert.equal(synchronizedDraft.interestedProgram, 'Chương trình cờ vua giáo dục')
assert.equal(synchronizedDraft.preferredSchedule, 'Tối thứ 3 và thứ 5')
assert.equal(synchronizedDraft.learningGoal, 'Mong muốn Canonical')
assert.equal(synchronizedDraft.advisorName, 'Tư vấn Linh')
assert.equal(synchronizedDraft.expectedTrialDate, '2026-09-25')
assert.equal(synchronizedDraft.note, 'Ghi chú học thử hợp lệ')

const stepThreeHtml = renderForm({ ...editState, activeStep: 3 })
assert(stepThreeHtml.includes('data-parent-contact-field="preferredSchedule"'))
assert(!stepThreeHtml.includes('data-parent-contact-field="registeredAt"'))
assert(!stepThreeHtml.includes('data-parent-contact-field="potentialLevel"'))
assert(!stepThreeHtml.includes('Mức tiềm năng'))

const stepFourHtml = renderForm({ ...editState, activeStep: 4 })
for (const value of [
  'Bé Canonical',
  'Phụ huynh Canonical',
  'Chương trình cờ vua giáo dục',
  'Mong muốn Canonical',
  'Tối thứ 3 và thứ 5',
  'Tư vấn Linh',
]) assert(stepFourHtml.includes(value), `Step 4 must show canonical value: ${value}`)
for (const staleValue of ['Bé Stale', 'Phụ huynh Stale', 'Chương trình Stale', 'Lịch Stale', 'Mong muốn Stale', 'Tư vấn Stale']) {
  assert(!stepFourHtml.includes(staleValue), `Step 4 must ignore stale legacy draft value: ${staleValue}`)
}
assert(stepFourHtml.includes('Thông tin đã lưu từ các bước trước'))
assert(stepFourHtml.includes('data-parent-contact-field="registeredAt"'))
assert(stepFourHtml.includes('value="2026-09-21"'))
for (const duplicateField of ['studentName', 'studentBirthYear', 'parentName', 'phone', 'interestedProgram', 'preferredSchedule', 'learningGoal', 'advisorName']) {
  assert(!stepFourHtml.includes(`data-parent-enrollment-field="${duplicateField}"`), `Step 4 must not persist duplicate ${duplicateField}.`)
}
for (const finalOnlyField of ['childChessLevel', 'expectedTrialDate', 'note']) {
  assert(stepFourHtml.includes(`data-parent-enrollment-field="${finalOnlyField}"`), `Step 4 must keep final-only ${finalOnlyField}.`)
}

const summary = buildEnrollmentSummary(canonicalContact)
assert(summary.includes('Bé Canonical'))
assert(summary.includes('2017'))
assert(summary.includes('Phụ huynh Canonical'))
assert(summary.includes('Tối thứ 3 và thứ 5'))
assert(summary.includes('Tư vấn Linh'))
assert(!summary.includes('Stale'))

const editedCanonicalContact = buildParentContactFromForm({
  ...editState.values,
  leadStudentName: 'Bé Đã sửa',
  interestedProgram: 'Chương trình cờ vua thể thao',
  preferredSchedule: 'Sáng cuối tuần',
  leadNeed: 'Mục tiêu đã sửa',
}, canonicalContact)
const savedContact = saveEnrollmentDraftToParentContact(editedCanonicalContact, {
  ...editState.enrollmentDraft,
  expectedTrialDate: '2026-09-27',
  note: 'Chỉ dữ liệu riêng của bước cuối',
})
const safeState = buildC53SafeCaseState(savedContact)
assert.equal(safeState.studentBirthYear, '2017')
assert.equal(safeState.interestedProgram, 'Chương trình cờ vua thể thao')
assert.equal(safeState.preferredSchedule, 'Sáng cuối tuần')
assert.equal(savedContact.leadNeed, 'Mục tiêu đã sửa')
assert.equal(savedContact.potentialLevel, 'Giá trị lịch sử được giữ lại')
assert.equal(safeState.registeredAt, '2026-09-21')
assert.equal(safeState.enrollmentDraft.expectedTrialDate, '2026-09-27')
assert.equal(safeState.enrollmentDraft.note, 'Chỉ dữ liệu riêng của bước cuối')
for (const duplicateField of ['interestedProgram', 'preferredSchedule', 'learningGoal', 'advisorName']) {
  assert(!Object.hasOwn(safeState.enrollmentDraft, duplicateField), `Safe state must not contain duplicate ${duplicateField}.`)
}

const reloaded = createEditParentContactFormState({
  ...savedContact,
  leadStudentName: 'Bé Đã sửa',
  interestedProgram: safeState.interestedProgram,
  preferredSchedule: safeState.preferredSchedule,
  registeredAt: safeState.registeredAt,
  enrollmentDraft: safeState.enrollmentDraft,
})
const reloadedStepFourHtml = renderForm({ ...reloaded, activeStep: 4 })
assert(reloadedStepFourHtml.includes('Bé Đã sửa'))
assert(reloadedStepFourHtml.includes('Chương trình cờ vua thể thao'))
assert(reloadedStepFourHtml.includes('Sáng cuối tuần'))
assert(reloadedStepFourHtml.includes('Mục tiêu đã sửa'))
assert(reloadedStepFourHtml.includes('value="2026-09-27"'))

const mainSource = fs.readFileSync('src/main.js', 'utf8')
const moduleSource = fs.readFileSync('src/parent-consultation-module.js', 'utf8')
const cloudSource = fs.readFileSync('src/cloud-authoritative-crm.js', 'utf8')
assert(!mainSource.includes('forceContactValues'))
assert(mainSource.includes('enrollmentDraft: createEnrollmentDraftFromContact({'))
assert(moduleSource.includes("renderFormInput('Ngày đăng ký', 'registeredAt'"))
assert(!moduleSource.includes("renderFormInput('Mức tiềm năng'"))
const safeEnrollmentSlice = cloudSource.slice(
  cloudSource.indexOf('enrollmentDraft: {', cloudSource.indexOf('export function buildC53SafeCaseState')),
  cloudSource.indexOf('\n    },', cloudSource.indexOf('enrollmentDraft: {', cloudSource.indexOf('export function buildC53SafeCaseState'))),
)
for (const duplicateField of ['interestedProgram', 'preferredSchedule', 'learningGoal', 'advisorName']) {
  assert(!safeEnrollmentSlice.includes(`${duplicateField}:`))
}

console.log('F2B_CUSTOMER_FOUR_STEP_AUTHORITATIVE_SYNCHRONIZATION_SMOKE: PASS')
