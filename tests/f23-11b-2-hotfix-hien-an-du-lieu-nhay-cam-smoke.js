import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getStaffAdministrativeRevealedFieldsForProfile,
  getStaffAdministrativeSensitiveValue,
  isStaffAdministrativeSensitiveField,
  maskStaffAdministrativeValue,
  normalizeStaffAdministrativeProfile,
  renderStaffAdministrativeProfileWindow,
  toggleStaffAdministrativeRevealedField,
} from '../src/staff-administrative-profile-module.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const main = read('src/main.js')
const profileSource = read('src/staff-administrative-profile-module.js')
const storageSource = read('src/storage.js')
const docs = read('docs/f23-11b-2-hotfix-hien-an-du-lieu-nhay-cam.md')
const baselineDocs = read('docs/f23-11b-ho-so-hanh-chinh-co-ban-local-safe.md')

const sensitiveValues = {
  'identityDocument.number': '0000<doc>&"7',
  'taxInformation.taxNumber': '0000987654',
  'insuranceInformation.socialInsuranceNumber': '0000112233',
  'insuranceInformation.healthInsuranceNumber': '0000778899',
  'bankInformation.accountNumber': '000055667788',
  'employmentAdministration.contractNumber': '0000CTR42',
}
const sensitivePaths = Object.keys(sensitiveValues)
const profile = normalizeStaffAdministrativeProfile(
  {
    id: 'profile-sensitive-b2',
    schemaVersion: 1,
    centerId: 'center-sensitive-b2',
    staffMemberId: 'staff-sensitive-b2',
    legalFullName: 'Nhân sự QA',
    dateOfBirth: '1991-04-05',
    permanentAddress: {},
    currentAddress: {},
    emergencyContact: {},
    identityDocument: { number: sensitiveValues['identityDocument.number'] },
    taxInformation: { taxNumber: sensitiveValues['taxInformation.taxNumber'] },
    insuranceInformation: {
      socialInsuranceNumber: sensitiveValues['insuranceInformation.socialInsuranceNumber'],
      healthInsuranceNumber: sensitiveValues['insuranceInformation.healthInsuranceNumber'],
    },
    bankInformation: { accountNumber: sensitiveValues['bankInformation.accountNumber'] },
    employmentAdministration: {
      contractNumber: sensitiveValues['employmentAdministration.contractNumber'],
    },
    completionStatus: 'incomplete',
    completionReview: {},
    revision: 7,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
    unknownProfileField: { preserve: true },
  },
  { currentCenterId: 'center-sensitive-b2' },
)
const staff = {
  id: profile.staffMemberId,
  centerId: profile.centerId,
  employeeCode: 'QA-B2',
  fullName: 'Nhân sự QA',
  employmentStatus: 'active',
  teacherId: 'teacher-preserved-b2',
  accountUserId: 'account-preserved-b2',
}
const profileSnapshot = structuredClone(profile)
const staffSnapshot = structuredClone(staff)
const baseState = {
  mode: 'view',
  centerId: profile.centerId,
  staffMemberId: profile.staffMemberId,
  profileId: profile.id,
  revealedFields: new Set(),
}

for (const fieldPath of sensitivePaths) {
  assert.equal(isStaffAdministrativeSensitiveField(fieldPath), true)
  assert.equal(getStaffAdministrativeSensitiveValue(profile, fieldPath), sensitiveValues[fieldPath])
}
assert.equal(isStaffAdministrativeSensitiveField('taxInformation.taxCode'), false)
assert.equal(isStaffAdministrativeSensitiveField('insuranceInformation.insuranceNumber'), false)

const maskedHtml = renderProfile(baseState)
for (const [fieldPath, value] of Object.entries(sensitiveValues)) {
  assert(!maskedHtml.includes(value), `Masked HTML leaked ${fieldPath}.`)
  assert(maskedHtml.includes(escapeHtml(maskStaffAdministrativeValue(value))))
  assert(maskedHtml.includes(`data-sensitive-field="${fieldPath}"`))
}
assert.equal(countMatches(maskedHtml, '>Hiện</button>'), sensitivePaths.length)
assert(!maskedHtml.includes('>Ẩn</button>'))
assert(!maskedHtml.includes('Hiện tất cả'))

let revealedFields = toggleStaffAdministrativeRevealedField(new Set(), 'identityDocument.number')
assert.deepEqual([...revealedFields], ['identityDocument.number'])
let revealedHtml = renderProfile({ ...baseState, revealedFields })
assertSensitiveControl(revealedHtml, 'identityDocument.number', escapeHtml(sensitiveValues['identityDocument.number']), true)
assert(!revealedHtml.includes(sensitiveValues['taxInformation.taxNumber']))
assert(!revealedHtml.includes(sensitiveValues['bankInformation.accountNumber']))

revealedFields = toggleStaffAdministrativeRevealedField(
  revealedFields,
  'bankInformation.accountNumber',
)
assert.equal(revealedFields.has('identityDocument.number'), true)
assert.equal(revealedFields.has('bankInformation.accountNumber'), true)
revealedHtml = renderProfile({ ...baseState, revealedFields })
assertSensitiveControl(revealedHtml, 'identityDocument.number', escapeHtml(sensitiveValues['identityDocument.number']), true)
assertSensitiveControl(revealedHtml, 'bankInformation.accountNumber', sensitiveValues['bankInformation.accountNumber'], true)
assert(!revealedHtml.includes(sensitiveValues['taxInformation.taxNumber']))

revealedFields = toggleStaffAdministrativeRevealedField(
  revealedFields,
  'identityDocument.number',
)
assert.equal(revealedFields.has('identityDocument.number'), false)
assert.equal(revealedFields.has('bankInformation.accountNumber'), true)
const hiddenAgainHtml = renderProfile({ ...baseState, revealedFields })
assertSensitiveControl(
  hiddenAgainHtml,
  'identityDocument.number',
  escapeHtml(maskStaffAdministrativeValue(sensitiveValues['identityDocument.number'])),
  false,
)
assertSensitiveControl(
  hiddenAgainHtml,
  'bankInformation.accountNumber',
  sensitiveValues['bankInformation.accountNumber'],
  true,
)

for (const fieldPath of [
  'taxInformation.taxNumber',
  'insuranceInformation.socialInsuranceNumber',
  'bankInformation.accountNumber',
]) {
  const oneField = toggleStaffAdministrativeRevealedField(new Set(), fieldPath)
  const oneFieldHtml = renderProfile({ ...baseState, revealedFields: oneField })
  assertSensitiveControl(oneFieldHtml, fieldPath, sensitiveValues[fieldPath], true)
  for (const otherPath of sensitivePaths.filter((candidate) => candidate !== fieldPath)) {
    assert(!oneFieldHtml.includes(sensitiveValues[otherPath]))
  }
}

assert.deepEqual(
  [...toggleStaffAdministrativeRevealedField(new Set(), 'unknown.path')],
  [],
)
assert.deepEqual(
  [...getStaffAdministrativeRevealedFieldsForProfile(
    { ...baseState, profileId: 'different-profile', revealedFields: new Set(sensitivePaths) },
    profile,
  )],
  [],
)
assert.deepEqual(
  [...getStaffAdministrativeRevealedFieldsForProfile(
    { ...baseState, centerId: 'different-center', revealedFields: new Set(sensitivePaths) },
    profile,
  )],
  [],
)

assert.equal(maskStaffAdministrativeValue(''), 'Chưa cập nhật')
assert.equal(maskStaffAdministrativeValue(null), 'Chưa cập nhật')
assert.equal(maskStaffAdministrativeValue({ malformed: true }), 'Chưa cập nhật')
assert.equal(maskStaffAdministrativeValue('undefined'), 'Chưa cập nhật')
assert.equal(maskStaffAdministrativeValue('[object Object]'), 'Chưa cập nhật')
assert.equal(maskStaffAdministrativeValue('1234'), '••••')
assert.equal(maskStaffAdministrativeValue('0012345'), '•••• 2345')
assert.equal(getStaffAdministrativeSensitiveValue(profile, 'taxInformation.taxNumber'), '0000987654')

const emptyBankProfile = {
  ...profile,
  bankInformation: { ...profile.bankInformation, accountNumber: '' },
}
const emptyBankHtml = renderStaffAdministrativeProfileWindow({
  windowId: 'window-sensitive-b2',
  accessAllowed: true,
  staffMember: staff,
  lookup: { status: 'incomplete', profile: emptyBankProfile },
  state: { ...baseState, profileId: emptyBankProfile.id, revealedFields: new Set() },
})
assert(emptyBankHtml.includes('Chưa cập nhật'))
assert(!emptyBankHtml.includes('data-sensitive-field="bankInformation.accountNumber"'))

assert.deepEqual(profile, profileSnapshot, 'Render/reveal helpers must not mutate profile.')
assert.deepEqual(staff, staffSnapshot, 'Render/reveal helpers must not mutate staff.')
assert.equal(profile.revision, profileSnapshot.revision)
assert.equal(profile.updatedAt, profileSnapshot.updatedAt)
assert.equal(profile.completionStatus, profileSnapshot.completionStatus)
assert.deepEqual(profile.unknownProfileField, { preserve: true })

const toggleSource = sourceSlice(
  main,
  'async function toggleStaffAdministrativeSensitiveField',
  'function maskStaffAdministrativeSensitiveView',
)
assert(toggleSource.includes('getLatestStaffAdministrativeProfileAccessContext(state.centerId)'))
assert(toggleSource.includes('toggleStaffAdministrativeRevealedField('))
assert(toggleSource.includes('getStaffAdministrativeSensitiveValue(lookup.profile, fieldPath)'))
assert(toggleSource.includes('displayControl.textContent = revealed ? value'))
assert(toggleSource.includes("button.textContent = revealed ? 'Ẩn' : 'Hiện'"))
assert(toggleSource.includes("fieldControl.type = revealed ? 'text' : 'password'"))
assert(!toggleSource.includes("button.closest('[data-window-id]')"))
for (const forbidden of [
  'render()',
  'innerHTML',
  'setTimeout',
  '.click(',
  '.focus(',
  'saveStoredCenterStaffAdministrativeProfiles',
  'localStorage',
  'sessionStorage',
  'console.',
  'revision',
  'updatedAt',
]) {
  assert(!toggleSource.includes(forbidden), `Toggle path contains forbidden operation: ${forbidden}`)
}

const delegateSource = sourceSlice(
  main,
  'function bindStaffAdministrativeProfileActionDelegates',
  'function bindEvents',
)
assert(delegateSource.includes(".desktop-window.is-staff-administrative-profile[data-window-id]"))
assert(delegateSource.includes("event.target.closest?.('[data-staff-administrative-action]')"))
assert(delegateSource.includes('event.preventDefault()'))
assert(delegateSource.includes('event.stopPropagation()'))
assert(delegateSource.includes('const windowId = windowElement.dataset.windowId'))
assert(delegateSource.includes('boundStaffAdministrativeActionWindows.has(windowElement)'))
assert(delegateSource.includes('void toggleStaffAdministrativeSensitiveField('))
assert(!delegateSource.includes("button.closest('[data-window-id]')"))

const closeSource = sourceSlice(main, 'function closeWindow', 'function softDeleteStudent')
assert(closeSource.includes('staffAdministrativeProfileWindowStates.delete(windowId)'))
const centerResetSource = sourceSlice(
  main,
  'function resetTransientStateForCenterSwitch',
  'function reloadLocalDataForResolvedCenter',
)
assert(centerResetSource.includes('staffAdministrativeProfileWindowStates = new Map()'))
const openProfileSource = sourceSlice(
  main,
  'function openStaffAdministrativeProfileWindow',
  'function startStaffAdministrativeProfileCreate',
)
assert(openProfileSource.includes('staffAdministrativeProfileWindowStates.forEach((state, windowId)'))
assert(openProfileSource.includes('state.staffMemberId !== staffMember.id'))
assert(openProfileSource.includes('revealedFields: new Set()'))
const renderAccessSource = sourceSlice(main, 'function renderWindowBody', 'function getWindowTitle')
assert(renderAccessSource.includes('if (!access.ok || windowItem.centerId !== access.centerId)'))
assert(renderAccessSource.includes('staffAdministrativeProfileWindowStates.delete(windowItem.id)'))
assert(renderAccessSource.includes('state.profileId !== (lookup.profile?.id || \'\')'))
assert(renderAccessSource.includes('revealedFields: new Set()'))

const viewFieldSource = sourceSlice(
  profileSource,
  'function renderSensitiveViewField',
  'function renderAddressView',
)
assert(viewFieldSource.includes('type="button"'))
assert(viewFieldSource.includes('data-sensitive-field="${escapeAttribute(fieldPath)}"'))
assert(viewFieldSource.includes('${escapeHtml(revealed && value ? value'))
assert(!viewFieldSource.includes('data-sensitive-value="${escapeAttribute(value)}"'))
assert(!viewFieldSource.includes('title="${escapeAttribute(value)}"'))
assert(!profileSource.includes('console.'))

const taskbarSource = sourceSlice(main, 'function getWindowTitle', 'function getWindowHeaderTitle')
assert(taskbarSource.includes('getStaffAdministrativeWindowTitle(staffMember)'))
for (const value of Object.values(sensitiveValues)) {
  assert(!taskbarSource.includes(value))
}

for (const forbidden of ['FileReader', 'readAsDataURL', 'createObjectURL', 'signedUrl']) {
  assert(!profileSource.includes(forbidden))
}
assert(!profileSource.includes('localStorage.setItem'))
assert(!storageSource.includes('revealedFields'))

const publicSecretMarker = ['SUPABASE', 'SERVICE_ROLE_KEY'].join('_')
assert(!profileSource.includes(publicSecretMarker))
assert(!docs.includes(publicSecretMarker))

for (const marker of [
  'F23.11B.2',
  'DOM scope',
  'delegated click handler',
  'centerId',
  'profileId',
  'canonical field path',
  'textContent',
  'không tăng `revision`',
  'Manual QA',
  'không tự kết luận',
]) {
  assert(docs.includes(marker), `Missing F23.11B.2 docs marker: ${marker}`)
}
assert(baselineDocs.includes('F23.11B.2'))

const mojibakeFragments = [
  `Cá${'º'}`,
  String.fromCodePoint(0x00c3),
  `Æ${'°'}`,
  `Há${'º'}`,
  `á${'»'}`,
]
for (const text of [docs, profileSource, toggleSource, delegateSource]) {
  assert(!mojibakeFragments.some((fragment) => text.includes(fragment)), 'Mojibake marker found.')
}

console.log('F23.11B.2 sensitive field reveal hotfix smoke: PASS')

function renderProfile(state) {
  return renderStaffAdministrativeProfileWindow({
    windowId: 'window-sensitive-b2',
    accessAllowed: true,
    staffMember: staff,
    lookup: { status: 'incomplete', profile },
    state,
  })
}

function assertSensitiveControl(html, fieldPath, expectedValue, revealed) {
  const pattern = new RegExp(
    `<strong data-staff-administrative-sensitive-value="${escapeRegExp(fieldPath)}">${escapeRegExp(expectedValue)}</strong>\\s*` +
      `<button type="button"[^>]*data-sensitive-field="${escapeRegExp(fieldPath)}"[^>]*aria-pressed="${revealed}">${revealed ? 'Ẩn' : 'Hiện'}</button>`,
  )
  assert(pattern.test(html), `Unexpected sensitive control for ${fieldPath}.`)
}

function sourceSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0, `Missing source marker: ${startMarker}`)
  assert(end > start, `Missing source marker: ${endMarker}`)
  return source.slice(start, end)
}

function countMatches(value, marker) {
  return value.split(marker).length - 1
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
