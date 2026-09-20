import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  applyAuthoritativeConsultantDefault,
  buildParentContactFromForm,
  createEditParentContactFormState,
  createEmptyParentContactFormState,
  getFilteredParentConsultations,
  getParentConsultationStats,
  getParentCrmQuickChoices,
  initialParentConsultationFilters,
  parentConsultationStatusLabels,
  parentContactTypeLabels,
  parentCustomerStageLabels,
  parentEvaluationQuickChoiceGroups,
  parentGoalQuickChoices,
  parentInterestedProgramChoices,
  parentNextActionQuickChoices,
  renderParentConsultationModule,
  toggleParentCrmQuickChoice,
} from '../src/parent-consultation-module.js'
import {
  buildC53AppendCareLogCommand,
  buildC53SafeCaseState,
  pullC53CrmSharedTruth,
} from '../src/cloud-authoritative-crm.js'

const birthYearMigration = fs.readFileSync(
  'supabase/migrations/202609200002_f2a_crm_birth_year_authority.sql',
  'utf8',
)
for (const token of [
  'create or replace function public.c5_3_is_safe_case_state(p_state jsonb)',
  "'potentialLevel', 'parentFeedbackAboutChild', 'studentBirthYear'",
  "pg_catalog.jsonb_typeof(p_state->'studentBirthYear') <> 'string'",
  "v_birth_year !~ '^[0-9]{4}$'",
  'v_birth_year::integer < 1900',
  "pg_catalog.date_part('year', current_date)::integer",
  'create or replace function public.c5_3_list_crm_shared_truth(p_center_id text)',
  "'studentBirthYear', coalesce(s.safe_state->>'studentBirthYear', '')",
  'security definer',
  "set search_path = ''",
  'alter function public.c5_3_is_safe_case_state(jsonb) owner to postgres',
  'alter function public.c5_3_list_crm_shared_truth(text) owner to postgres',
  'grant execute on function public.c5_3_list_crm_shared_truth(text)',
]) assert(birthYearMigration.includes(token), `Birth-year migration missing: ${token}`)
assert.equal((birthYearMigration.match(/create or replace function public\./g) || []).length, 2)
assert(!birthYearMigration.includes('create table'))
assert(!birthYearMigration.includes('alter table'))
assert(!birthYearMigration.includes('create policy'))
assert(!birthYearMigration.includes('grant execute on function public.c5_3_mutate_crm_shared_truth'))
assert(!birthYearMigration.includes('2026-01-01'))

const integrationState = { status: 'ready', moduleRefreshStatus: 'fresh', links: [] }
const sharedTruthState = {
  lastLoadedAt: '2026-09-20T00:00:00.000Z',
  messageTone: 'success',
  eligibleConsultants: [{ userId: 'consultant-1', label: 'Tư vấn Linh' }],
}

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

assert.deepEqual(parentCustomerStageLabels, {
  lead: 'Khách hàng mới',
  consulting: 'Đang tư vấn',
  converted: 'Đã chuyển đổi',
})
assert.equal(parentContactTypeLabels.currentParent, 'Phụ huynh')
assert.equal(parentConsultationStatusLabels.closed, 'Khách chưa phù hợp')

const contacts = [
  { id: 'lead', customerStage: 'lead', contactType: 'consultingLead', consultationStatus: 'newLead' },
  { id: 'consulting', customerStage: 'consulting', contactType: 'consultingLead', consultationStatus: 'activeCare' },
  { id: 'converted', customerStage: 'converted', contactType: 'currentParent', consultationStatus: 'converted' },
  { id: 'lost', customerStage: 'lead', contactType: 'consultingLead', consultationStatus: 'closed' },
]
assert.deepEqual(getParentConsultationStats(contacts), {
  total: 4,
  leads: 2,
  consulting: 1,
  converted: 1,
  consultingLeads: 3,
  activeCare: 2,
  callbacks: 0,
})
assert.deepEqual(
  getFilteredParentConsultations(contacts, { ...initialParentConsultationFilters, customerStage: 'converted' })
    .map((contact) => contact.id),
  ['converted'],
)
assert.deepEqual(
  getFilteredParentConsultations(contacts, { ...initialParentConsultationFilters, contactType: 'currentParent' })
    .map((contact) => contact.id),
  ['converted'],
)
assert.deepEqual(
  getFilteredParentConsultations(contacts, { ...initialParentConsultationFilters, consultationStatus: 'closed' })
    .map((contact) => contact.id),
  ['lost'],
)

const stepTwoState = {
  ...createEmptyParentContactFormState(),
  activeStep: 2,
  values: {
    ...createEmptyParentContactFormState().values,
    studentBirthYear: '2018',
    leadStudentAge: '7',
    interestedProgram: 'Chương trình cờ vua giáo dục',
    leadNeed: 'Gia đình cần lịch cuối tuần.',
    parentFeedbackAboutChild: 'Bé thích thử thách.',
  },
}
const stepTwoHtml = renderForm(stepTwoState)
const readableStepTwoHtml = stepTwoHtml.replaceAll('&amp;', '&')
assert(stepTwoHtml.includes('Khách hàng mới'))
assert(stepTwoHtml.includes('Nhu cầu học / Mong muốn từ phụ huynh ban đầu'))
assert(stepTwoHtml.includes('data-parent-contact-field="studentBirthYear"'))
assert(!stepTwoHtml.includes('data-parent-contact-field="leadStudentAge"'))
assert(!stepTwoHtml.includes('>Tuổi bé<'))
assert(stepTwoHtml.includes('tuổi (tự tính)'))
for (const program of parentInterestedProgramChoices) assert(readableStepTwoHtml.includes(program))
for (const group of parentEvaluationQuickChoiceGroups) {
  assert(readableStepTwoHtml.includes(group.label))
  for (const choice of group.choices) assert(readableStepTwoHtml.includes(choice))
}

const reloadedBirthYearHtml = renderForm({
  ...createEditParentContactFormState({
    id: 'reloaded-birth-year',
    contactType: 'consultingLead',
    customerStage: 'lead',
    consultationStatus: 'newLead',
    source: 'website',
    studentBirthYear: '2018',
    leadStudentAge: '',
    careLogs: [],
    appointments: [],
  }),
  activeStep: 2,
})
assert(reloadedBirthYearHtml.includes(`${new Date().getFullYear() - 2018} tuổi (tự tính)`))
for (const choice of parentGoalQuickChoices) assert(readableStepTwoHtml.includes(choice))

const customProgramHtml = renderForm({
  ...stepTwoState,
  values: { ...stepTwoState.values, interestedProgram: 'Chương trình riêng đang dùng' },
})
assert(customProgramHtml.includes('value="Chương trình riêng đang dùng"'))
assert(customProgramHtml.includes('data-parent-crm-choice-value="Khác"'))

let guidedText = 'Gia đình ưu tiên cuối tuần.'
guidedText = toggleParentCrmQuickChoice(
  guidedText,
  'Mục tiêu của phụ huynh',
  'Rèn tính kiên nhẫn & tập trung',
)
guidedText = toggleParentCrmQuickChoice(
  guidedText,
  'Mục tiêu của phụ huynh',
  'Rèn tính kiên nhẫn & tập trung',
)
assert.equal(guidedText, 'Gia đình ưu tiên cuối tuần.', 'A selected helper can be removed without changing free text.')
guidedText = toggleParentCrmQuickChoice(
  guidedText,
  'Mục tiêu của phụ huynh',
  'Rèn tư duy logic & tính toán',
)
guidedText = toggleParentCrmQuickChoice(
  guidedText,
  'Mục tiêu của phụ huynh',
  'Rèn tư duy logic & tính toán',
)
guidedText = toggleParentCrmQuickChoice(
  guidedText,
  'Mục tiêu của phụ huynh',
  'Rèn tư duy logic & tính toán',
)
assert.deepEqual(getParentCrmQuickChoices(guidedText, 'Mục tiêu của phụ huynh'), ['Rèn tư duy logic & tính toán'])
assert.equal((guidedText.match(/Rèn tư duy logic & tính toán/g) || []).length, 1)
assert(guidedText.startsWith('Gia đình ưu tiên cuối tuần.'))

const stepThreeState = {
  ...applyAuthoritativeConsultantDefault(createEmptyParentContactFormState(), sharedTruthState.eligibleConsultants),
  activeStep: 3,
  values: {
    ...applyAuthoritativeConsultantDefault(
      createEmptyParentContactFormState(),
      sharedTruthState.eligibleConsultants,
    ).values,
    nextAction: 'Hẹn phản hồi',
  },
}
const stepThreeHtml = renderForm(stepThreeState)
assert(stepThreeHtml.includes('Các công việc tiếp theo'))
for (const choice of parentNextActionQuickChoices) assert(stepThreeHtml.includes(choice))
assert(stepThreeHtml.includes('data-parent-contact-field="consultantId"'))
assert(stepThreeHtml.includes('<option value="consultant-1" selected>Tư vấn Linh</option>'))

const noDefault = applyAuthoritativeConsultantDefault(createEmptyParentContactFormState(), [
  { userId: 'consultant-1', label: 'Tư vấn Linh' },
  { userId: 'consultant-2', label: 'Tư vấn Minh' },
])
assert.equal(noDefault.values.consultantId, '', 'Multiple eligible consultants do not cause arbitrary defaulting.')
const existingAssignment = applyAuthoritativeConsultantDefault({
  ...createEmptyParentContactFormState(),
  values: {
    ...createEmptyParentContactFormState().values,
    consultantId: 'consultant-existing',
    consultantName: 'Tư vấn hiện tại',
  },
}, sharedTruthState.eligibleConsultants)
assert.equal(existingAssignment.values.consultantId, 'consultant-existing')

const contact = buildParentContactFromForm({
  ...stepTwoState.values,
  parentName: 'Phụ huynh QA',
  phone: '0900000000',
  contactType: 'currentParent',
  customerStage: 'consulting',
  consultationStatus: 'activeCare',
  source: 'parentReferral',
  leadNeed: guidedText,
  nextAction: 'Hẹn lịch test',
  consultantId: 'consultant-1',
  consultantName: 'Tư vấn Linh',
})
const safeState = buildC53SafeCaseState(contact)
assert.equal(safeState.studentBirthYear, '2018')
assert.equal(safeState.interestedProgram, 'Chương trình cờ vua giáo dục')
assert.equal(safeState.nextAction, 'Hẹn lịch test')
assert.equal(safeState.parentFeedbackAboutChild, 'Bé thích thử thách.')
assert(guidedText.includes('Mục tiêu của phụ huynh:'))
const nextActionCommand = buildC53AppendCareLogCommand({
  canonicalCaseId: '11111111-1111-4111-8111-111111111111',
  cloudCaseVersion: 2,
}, {
  contactedAt: '2026-09-20T08:00:00.000Z',
  channel: 'note',
  content: 'Cập nhật các công việc tiếp theo trong hồ sơ khách hàng.',
  nextAction: 'Hẹn học thử',
})
assert.equal(nextActionCommand.operation, 'APPEND_CARE_LOG')
assert.equal(nextActionCommand.care_log.payload.nextAction, 'Hẹn học thử')

const assignedRead = await pullC53CrmSharedTruth({
  centerId: 'center-a',
  supabase: {
    rpc: async () => ({
      data: {
        ok: true,
        outcome_code: 'CRM_SHARED_TRUTH_READ',
        center_id: 'center-a',
        records: [{
          id: 'contact-1',
          canonicalCaseId: 'case-1',
          consultantId: 'consultant-1',
          consultantName: 'consultant-1',
        }],
        eligible_consultants: sharedTruthState.eligibleConsultants,
      },
      error: null,
    }),
  },
})
assert.equal(assignedRead.records[0].consultantName, 'Tư vấn Linh')

const editStepFour = createEditParentContactFormState({
  ...contact,
  id: 'contact-1',
  advisorName: 'Tư vấn Linh',
  careLogs: [],
  appointments: [],
  enrollmentDraft: { advisorName: 'Tư vấn Linh' },
})
const stepFourHtml = renderForm({ ...editStepFour, activeStep: 4 })
assert(stepFourHtml.includes('Tư vấn phụ trách'))
assert(stepFourHtml.includes('Tư vấn Linh'))
assert(!stepFourHtml.includes('data-parent-enrollment-field="advisorName"'))

const mainSource = fs.readFileSync('src/main.js', 'utf8')
assert(mainSource.includes("{ reason: 'update-next-action' }"))
assert(mainSource.includes('buildC53AppendCareLogCommand(refreshedContact'))
assert(!mainSource.includes('F2B'))

console.log('F2A_CUSTOMER_CRM_FORM_REFINEMENT_SMOKE: PASS')
