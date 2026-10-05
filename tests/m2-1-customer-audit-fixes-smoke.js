import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  createEditParentContactFormState,
  createEmptyParentContactFormState,
  deriveParentCustomerStage,
  getParentConsultationStats,
  hasAuthoritativeStudentRelationship,
  initialParentConsultationFilters,
  mergeParentContactsWithStudents,
  renderParentConsultationModule,
  validateParentContactForm,
} from '../src/parent-consultation-module.js'
import { createCustomerInformationPrintSnapshot } from '../src/customer-information-print-module.js'

const ready = { status: 'ready', moduleRefreshStatus: 'fresh', links: [] }
const shared = { lastLoadedAt: '2026-10-03T00:00:00.000Z' }
const render = (contacts, filters = initialParentConsultationFilters, students = [], options = {}) =>
  renderParentConsultationModule(
    contacts, filters, students, options.form || null, null, null, options.detailId || null,
    null, shared, { ...ready, links: options.links || [], identityEditState: options.identityEditState },
  )

const standalone = {
  id: 'customer-1', canonicalCaseId: 'case-1', canonicalContactId: 'contact-1',
  cloudContactVersion: 3, parentName: 'Khách QA', customerStage: 'consulting',
  consultationStatus: 'activeCare', contactType: 'consultingLead', source: 'website',
}
const [standaloneProjection] = mergeParentContactsWithStudents([standalone], [], [])
assert.equal(standaloneProjection.contactIdentityAvailable, false)
assert.equal(standaloneProjection.contactIdentityEditable, true)
assert.equal(standaloneProjection.contactVersion, 3)
assert.equal(standaloneProjection.contactMethodsKnown, false)
assert.match(createCustomerInformationPrintSnapshot({ centerId: 'qa-center', contact: standaloneProjection })
  .customer.contactVisibility, /đang được bảo vệ/)
const standaloneDetail = render([standalone], initialParentConsultationFilters, [], { detailId: standalone.id })
assert.match(standaloneDetail, /data-parent-identity-action="open" data-contact-id="customer-1"/)
const standaloneEditor = render([standalone], initialParentConsultationFilters, [], {
  identityEditState: { displayName: 'Khách QA', contactMethodsKnown: false },
})
assert.match(standaloneEditor, /Nhập lại tất cả số điện thoại và email cần giữ/)

const student = { id: 'student-1', fullName: 'Học viên QA', parentName: 'Phụ huynh QA' }
const link = {
  contactId: 'contact-1', studentId: student.id, linkStatus: 'ACTIVE',
  contactIdentityAvailable: true, contactVersion: 4,
  contactDisplayName: 'Phụ huynh QA', contactPhones: ['0900000000'], contactEmails: [],
}
const [linked] = mergeParentContactsWithStudents([standalone], [student], [link])
assert.equal(linked.contactMethodsKnown, true)
assert.equal(linked.contactIdentityEditable, true)
assert.equal(linked.phone, '0900000000')
assert.equal(linked.contactVersion, 4)
assert.equal(hasAuthoritativeStudentRelationship(linked), true)
assert.equal(deriveParentCustomerStage(linked), 'converted')
assert.equal(linked.customerStage, 'converted')
assert.match(render([standalone], initialParentConsultationFilters, [student], {
  links: [link], detailId: standalone.id,
}), /Đã chuyển đổi thành Học viên[\s\S]*Mở hồ sơ Học viên/)

const falseConversion = {
  ...standalone, customerStage: 'converted', consultationStatus: 'converted', contactType: 'currentParent',
}
assert.equal(deriveParentCustomerStage(falseConversion), 'lead')
assert.equal(getParentConsultationStats([falseConversion]).converted, 0)
assert.equal(validateParentContactForm({
  ...createEmptyParentContactFormState().values,
  customerStage: 'converted', consultationStatus: 'converted', parentName: 'Khách QA', phone: '0900000000',
}).customerStage, 'Chỉ chuyển đổi qua thao tác liên kết Học viên.')
assert(!render([falseConversion], initialParentConsultationFilters, [], { detailId: standalone.id })
  .includes('Đã chuyển đổi thành Học viên'))
const unlinkedForm = render([], initialParentConsultationFilters, [], {
  form: createEmptyParentContactFormState(),
})
const stageOptions = unlinkedForm.match(/<select data-parent-contact-field="customerStage"[^>]*>([\s\S]*?)<\/select>/)?.[1]
const unlinkedStepThree = render([], initialParentConsultationFilters, [], {
  form: { ...createEmptyParentContactFormState(), activeStep: 3 },
})
const statusOptions = unlinkedStepThree.match(/<select data-parent-contact-field="consultationStatus"[^>]*>([\s\S]*?)<\/select>/)?.[1]
assert(stageOptions && !stageOptions.includes('value="converted"'))
assert(statusOptions && !statusOptions.includes('value="converted"'))
assert.equal(createEditParentContactFormState(linked).hasLinkedStudent, true)

assert.match(render([]), /Chưa có khách hàng tại cơ sở này/)
assert.match(render([standalone], { ...initialParentConsultationFilters, query: 'không có' }),
  /Không tìm thấy liên hệ phù hợp với bộ lọc hiện tại/)

const main = fs.readFileSync('src/main.js', 'utf8')
const centerSwitch = main.slice(main.indexOf('async function handleInternalOpenCenter('),
  main.indexOf('function normalizeInternalCenters('))
assert.match(centerSwitch, /closeCenterBoundWorkspacesForSwitch\(\)[^]*?setCurrentStorageCenterId\(normalizedCenterId\)/)
assert.doesNotMatch(centerSwitch, /refreshModuleAuthoritativeUpstreams\('khach-hang-tu-van', \{ reason: 'center-switch' \}\)/)
assert.match(main, /runId !== c53CrmSyncRunId \|\| centerId !== getCurrentCanonicalCenterContext\(\)\.centerId/)
assert.match(main, /const crmRefresh = await refreshC53CrmSharedTruth\(\{ reason: 'after-server-commit', silent: true \}\)/)

const css = fs.readFileSync('src/parent-consultation-v2-8p2-theme.css', 'utf8')
assert.match(css, /:root:not\(\[data-ui-theme='dark'\]\) \.desktop-window\.is-parent-consultation-window \.parent-convert-preview h4 \{\s*color: #78350f/)
assert.match(css, /\.parent-convert-preview button:not\(:disabled\) \{\s*border-color: #1d4ed8;\s*color: #ffffff;\s*background: #1d4ed8/)

console.log('CUSTOMER_M2_1_AUDIT_FIXES_SMOKE: PASS')
