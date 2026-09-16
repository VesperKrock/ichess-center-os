import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createEmptyParentContactFormState,
  initialParentConsultationFilters,
  parentContactWizardSteps,
  renderParentConsultationModule,
} from '../src/parent-consultation-module.js'

const student = {
  id: 'student-1',
  fullName: 'Student One',
  parentName: 'Parent One',
  parentPhone: '0900000001',
  careNotes: [],
}

const contact = {
  id: 'contact-1',
  canonicalContactId: 'contact-1',
  contactType: 'currentParent',
  customerStage: 'converted',
  parentName: 'Parent One',
  phone: '0900000001',
  consultationStatus: 'caring',
  source: 'studentRecord',
  studentId: student.id,
  linkedStudentIds: [student.id],
  careLogs: [],
  appointments: [],
}

const sharedTruthState = {
  lastLoadedAt: '2026-09-16T00:00:00.000Z',
  message: 'Transient sync status belongs in the titlebar.',
  messageTone: 'error',
}

const integrationState = {
  status: 'ready',
  moduleRefreshStatus: 'fresh',
  links: [],
  eligibleConsultants: [],
}

const render = (overrides = {}) => renderParentConsultationModule(
  [contact],
  initialParentConsultationFilters,
  [student],
  overrides.formState ?? null,
  null,
  null,
  overrides.detailContactId ?? null,
  null,
  sharedTruthState,
  { ...integrationState, ...(overrides.integrationState || {}) },
)

const listHtml = render()
for (const expected of [
  'parent-consultation-page-heading',
  'parent-consultation-stats',
  'parent-consultation-toolbar',
  'parent-consultation-filter-count',
  'parent-consultation-table-wrap',
  'data-parent-contact-action="open-create"',
  'data-parent-contact-row-id="contact-1"',
]) {
  assert(listHtml.includes(expected), `Final Parent/Consultant list paint is missing ${expected}`)
}
assert(!listHtml.includes(sharedTruthState.message), 'Transient sync/degraded status must not render in business content.')

const detailHtml = render({ detailContactId: contact.id })
for (const expected of [
  'parent-contact-detail-panel',
  'parent-contact-detail-section is-status',
  'parent-contact-detail-section is-students',
  'parent-contact-detail-section is-care',
  'data-parent-contact-action="close-detail"',
]) {
  assert(detailHtml.includes(expected), `Final contact detail paint is missing ${expected}`)
}

const crmHtml = render({
  detailContactId: contact.id,
  integrationState: {
    linkReviewState: {
      mode: 'create',
      fixedContactId: contact.id,
      studentId: student.id,
      contactChoice: 'new',
      relationshipType: 'PARENT',
      financialContactRole: 'PRIMARY',
      academicContactRole: 'PRIMARY',
      isPrimaryContact: true,
    },
  },
})
for (const expected of [
  'parent-link-review-modal',
  'parent-link-contact-panel',
  'parent-link-role-panel',
  'data-parent-link-action="cancel"',
  'data-parent-link-action="save"',
]) {
  assert(crmHtml.includes(expected), `Final CRM-link paint is missing ${expected}`)
}

assert.equal(parentContactWizardSteps.length, 4)
for (const activeStep of [1, 2, 3, 4]) {
  const formState = {
    ...createEmptyParentContactFormState(),
    activeStep,
  }
  const wizardHtml = render({ formState })
  assert(wizardHtml.includes(`data-parent-contact-step="${activeStep}"`))
  assert(wizardHtml.includes(`data-parent-contact-form-scroll`))
  assert(wizardHtml.includes(`BÆ°á»›c ${activeStep}/4`) || wizardHtml.includes(`Bước ${activeStep}/4`))
}

const stepFourHtml = render({
  formState: {
    ...createEmptyParentContactFormState(),
    activeStep: 4,
  },
})
for (const expected of [
  'parent-contact-step-four-layout',
  'parent-enrollment-section',
  'parent-contact-step-four-sidebar',
  'parent-step-four-panel is-trial-summary',
  'data-parent-enrollment-action="save"',
  'data-parent-enrollment-action="ready"',
  'data-parent-enrollment-action="copy"',
]) {
  assert(stepFourHtml.includes(expected), `Final wizard Step 4 paint is missing ${expected}`)
}

const themeSource = readFileSync(new URL('../src/parent-consultation-v2-8p2-theme.css', import.meta.url), 'utf8')
for (const expected of [
  '--parent-workspace: #f7f7f8;',
  '--parent-workspace: #0f1115;',
  '--parent-panel: #14171c;',
  'padding: 32px;',
  'height: 88px;',
  'height: 78px;',
  'width: 1180px;',
  'height: 520px;',
  'width: 1120px;',
  'height: 548px;',
  'width: calc(100% - 40px);',
  'height: calc(100% - 40px);',
  'grid-template-columns: 918px 506px;',
]) {
  assert(themeSource.includes(expected), `Figma geometry/theme contract is missing ${expected}`)
}

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(mainSource.includes("import './parent-consultation-v2-8p2-theme.css'"))
assert(mainSource.includes('usesCompactModuleTitlebarCurrentness(windowItem)'))
assert(mainSource.includes('isPrimaryBusinessModuleWindow(windowItem)'))
assert(mainSource.includes("'iChess Center OS · Admin Console'"))

console.log('V2-8P2 PARENT CONSULTANT FINAL FIGMA PAINT SMOKE: PASS')
