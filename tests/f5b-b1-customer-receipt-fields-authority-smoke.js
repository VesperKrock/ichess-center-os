import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildC53CreateLeadCommand,
  buildC53SafeCaseState,
  buildC53SaveCaseCommand,
  projectC53CrmRecord,
} from '../src/cloud-authoritative-crm.js'
import {
  buildF4bStudentPayload,
  buildParentContactFromForm,
  createEditParentContactFormState,
  createEmptyParentContactFormState,
  initialParentConsultationFilters,
  renderParentConsultationModule,
  validateParentContactForm,
} from '../src/parent-consultation-module.js'

const migrationPath = 'supabase/migrations/202609230001_f5b_b1_customer_receipt_fields_authority.sql'
const migration = fs.readFileSync(migrationPath, 'utf8')
for (const token of [
  'alter table public.crm_contact',
  'add column receipt_address text',
  'add column cccd text',
  'constraint crm_contact_receipt_address_check',
  'constraint crm_contact_cccd_check',
  'pg_catalog.length(receipt_address) between 1 and 500',
  'pg_catalog.length(cccd) between 1 and 64',
  'c5_3_list_crm_shared_truth_pre_f5b_b1',
  'c5_3_mutate_crm_shared_truth_pre_f5b_b1',
  "'receiptAddress', coalesce(v_receipt_address, '')",
  "'cccd', coalesce(v_cccd, '')",
  "'crm.contact.receipt_fields_updated'",
  "'F5B_B1_ABORT:CONTACT_VERSION_STALE'",
  'v_receipt_address := coalesce(v_receipt_address, v_contact.receipt_address)',
  'v_cccd := coalesce(v_cccd, v_contact.cccd)',
  'grant execute on function public.c5_3_list_crm_shared_truth(text)',
  'grant execute on function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid)',
]) assert(migration.includes(token), `F5B-B1 migration missing: ${token}`)

assert(!/alter table public\.(?:student|center_cloud_entities|tuition|finance)/i.test(migration))
assert(!migration.includes('protected_contact_methods_ciphertext ='))
assert(!migration.includes("jsonb_set(s.safe_state"))
assert(!migration.includes('create policy'))
assert(!migration.includes('receipt_email'))

const emptyState = createEmptyParentContactFormState()
assert.equal(emptyState.values.receiptAddress, '')
assert.equal(emptyState.values.cccd, '')

const baseValues = {
  ...emptyState.values,
  parentName: 'Phụ huynh F5B-B1',
  phone: '0901234567',
}
assert.deepEqual(validateParentContactForm(baseValues), {})

const receiptAddress = '012 Đường Nguyễn Huệ, Phường Sài Gòn, TP.HCM'
const cccd = '001234567890'
const customer = buildParentContactFromForm({
  ...baseValues,
  email: 'parent@example.test',
  locationArea: 'Quận 1',
  receiptAddress,
  cccd,
})
assert.equal(customer.receiptAddress, receiptAddress)
assert.equal(customer.cccd, cccd)
assert.equal(customer.locationArea, 'Quận 1')
assert.equal(customer.email, 'parent@example.test')

const reopened = createEditParentContactFormState(customer)
assert.equal(reopened.values.receiptAddress, receiptAddress)
assert.equal(reopened.values.cccd, cccd)
assert.equal(reopened.values.locationArea, 'Quận 1')
assert.equal(reopened.values.email, 'parent@example.test')

const legacyReopened = createEditParentContactFormState({
  ...customer,
  id: 'legacy-customer',
  receiptAddress: undefined,
  cccd: undefined,
})
assert.equal(legacyReopened.values.receiptAddress, '')
assert.equal(legacyReopened.values.cccd, '')

assert(validateParentContactForm({ ...baseValues, receiptAddress: 'A'.repeat(501) }).receiptAddress)
assert(validateParentContactForm({ ...baseValues, cccd: '0'.repeat(65) }).cccd)
assert(validateParentContactForm({ ...baseValues, cccd: '0012\u0000' }).cccd)

const createCommand = buildC53CreateLeadCommand(customer)
assert.deepEqual(createCommand.contact_receipt, {
  receipt_address: receiptAddress,
  cccd,
})
assert.deepEqual(createCommand.contact.emails, ['parent@example.test'])
assert.equal(createCommand.safe_state.locationArea, 'Quận 1')
assert.equal(Object.hasOwn(createCommand.safe_state, 'receiptAddress'), false)
assert.equal(Object.hasOwn(createCommand.safe_state, 'receipt_address'), false)
assert.equal(Object.hasOwn(createCommand.safe_state, 'cccd'), false)

const canonical = projectC53CrmRecord({
  ...customer,
  id: customer.id,
  canonicalCaseId: '11111111-1111-4111-8111-111111111111',
  canonicalContactId: '22222222-2222-4222-8222-222222222222',
  cloudCaseVersion: 3,
  cloudStateVersion: 2,
  cloudCandidateVersion: 0,
  cloudContactVersion: 4,
  receiptAddress,
  cccd,
})
assert.equal(canonical.receiptAddress, receiptAddress)
assert.equal(canonical.cccd, cccd)
const saveCommand = buildC53SaveCaseCommand(canonical)
assert.equal(saveCommand.expected_contact_version, 4)
assert.deepEqual(saveCommand.contact_receipt, createCommand.contact_receipt)

const safeState = buildC53SafeCaseState(customer)
assert.equal(Object.hasOwn(safeState, 'receiptAddress'), false)
assert.equal(Object.hasOwn(safeState, 'cccd'), false)

const studentPayload = buildF4bStudentPayload(customer, {
  birthDate: '2017-05-10',
  schoolName: 'Trường Sao Mai',
  schoolLevel: 'Tiểu học',
  level: 'Nhập môn',
})
for (const forbidden of ['receiptAddress', 'receipt_address', 'cccd']) {
  assert.equal(Object.hasOwn(studentPayload, forbidden), false, `Student payload leaked ${forbidden}`)
}

const sharedTruthState = {
  lastLoadedAt: '2026-09-23T00:00:00.000Z',
  messageTone: 'success',
  eligibleConsultants: [],
}
const integrationState = { status: 'ready', moduleRefreshStatus: 'fresh', links: [] }
const renderCustomer = (formState = null, selectedId = null) => renderParentConsultationModule(
  [canonical],
  initialParentConsultationFilters,
  [],
  formState,
  null,
  null,
  selectedId,
  null,
  sharedTruthState,
  integrationState,
)

const stepOneHtml = renderCustomer({ ...reopened, activeStep: 1 })
assert(stepOneHtml.includes('Thông tin xuất phiếu / thuế'))
assert(stepOneHtml.includes('data-parent-contact-field="receiptAddress"'))
assert(stepOneHtml.includes('data-parent-contact-field="cccd"'))
assert(stepOneHtml.includes(receiptAddress))
assert(stepOneHtml.includes(cccd))

const broadListHtml = renderCustomer()
assert(!broadListHtml.includes(receiptAddress))
assert(!broadListHtml.includes(cccd))
const detailHtml = renderCustomer(null, canonical.id)
assert(detailHtml.includes(receiptAddress))
assert(detailHtml.includes(cccd))

for (const studentFile of [
  'src/student-module.js',
  'src/student-detail.js',
  'src/student-intake-admin-pdf.js',
]) {
  const source = fs.readFileSync(studentFile, 'utf8')
  assert(!source.includes('receiptAddress'), `${studentFile} must not contain receiptAddress`)
  assert(!source.includes('receipt_address'), `${studentFile} must not contain receipt_address`)
  assert(!/\bcccd\b/i.test(source), `${studentFile} must not contain CCCD`)
}

console.log('F5B_B1_CUSTOMER_RECEIPT_FIELDS_AUTHORITY_SMOKE: PASS')
