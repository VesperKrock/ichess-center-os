import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  STAFF_ADMINISTRATIVE_PROFILE_ACCESS_DENIED_MESSAGE,
  STAFF_ADMINISTRATIVE_PROFILE_CHECKLIST_VERSION,
  buildStaffAdministrativeProfileFromDraft,
  createEditStaffAdministrativeProfileDraft,
  createStaffAdministrativeProfileDraft,
  createStaffAdministrativeProfileId,
  getStaffAdministrativeProfileCollectionIssues,
  getStaffAdministrativeProfileListStatus,
  markStaffAdministrativeProfileReviewed,
  maskStaffAdministrativeValue,
  normalizeStaffAdministrativeProfile,
  renderStaffAdministrativeProfileWindow,
  resolveStaffAdministrativeProfileAccess,
  resolveStaffAdministrativeProfileForStaff,
  setStaffAdministrativeProfileDraftValue,
  validateStaffAdministrativeProfile,
} from '../src/staff-administrative-profile-module.js'
import {
  archiveStaffMember,
  buildStaffEmploymentTransition,
  renderStaffModule,
} from '../src/staff-module.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const main = read('src/main.js')
const profileSource = read('src/staff-administrative-profile-module.js')
const staffSource = read('src/staff-module.js')
const storageSource = read('src/storage.js')
const styles = read('src/styles.css')
const docs = read('docs/f23-11b-ho-so-hanh-chinh-co-ban-local-safe.md')

globalThis.localStorage = createMemoryStorage()
const storage = await import('../src/storage.js')

const staff = {
  id: 'staff-gv001',
  centerId: 'center-a',
  employeeCode: 'GV001',
  fullName: 'Nguyễn Trường Thịnh',
  departmentId: 'department-academic',
  positionTitle: 'Giáo viên',
  employmentStatus: 'active',
  teacherId: 'teacher-thinh',
  accountUserId: 'user-thinh',
  membershipId: 'membership-thinh',
  employmentLifecycleEvents: [{ id: 'event-existing', toStatus: 'active' }],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
}

let draft = createStaffAdministrativeProfileDraft(staff)
assert(createStaffAdministrativeProfileId(1722067200000).startsWith('admin-profile-1722067200000-'))
assert.equal(draft.legalFullName, staff.fullName, 'Create draft prefills only legal name from staff.')
assert.equal(draft.identityDocument.number, '')
assert.equal(draft.employmentAdministration.contractNumber, '')
draft = setStaffAdministrativeProfileDraftValue(draft, 'dateOfBirth', '1990-05-10')
draft = setStaffAdministrativeProfileDraftValue(
  draft,
  'currentAddress.addressLine',
  'Dữ liệu QA F23.11B',
)
draft = setStaffAdministrativeProfileDraftValue(
  draft,
  'currentAddress.provinceOrCity',
  'Hà Nội',
)
draft = setStaffAdministrativeProfileDraftValue(draft, 'emergencyContact.name', 'Nguyễn Văn A')
draft = setStaffAdministrativeProfileDraftValue(draft, 'emergencyContact.phone', '0900000000')
draft = setStaffAdministrativeProfileDraftValue(
  draft,
  'emergencyContact.relationship',
  'Người thân',
)
draft = setStaffAdministrativeProfileDraftValue(
  draft,
  'identityDocument.number',
  '001234567890',
)
draft = setStaffAdministrativeProfileDraftValue(draft, 'taxInformation.taxNumber', '0123456789')
draft = setStaffAdministrativeProfileDraftValue(
  draft,
  'insuranceInformation.socialInsuranceNumber',
  '0001234567',
)
draft = setStaffAdministrativeProfileDraftValue(
  draft,
  'bankInformation.accountNumber',
  '001122334455',
)

assert.deepEqual(validateStaffAdministrativeProfile(draft, { today: '2026-07-27' }), {})
assert.equal(
  validateStaffAdministrativeProfile(
    { ...draft, dateOfBirth: '2026-02-31' },
    { today: '2026-07-27' },
  ).dateOfBirth,
  'Ngày sinh phải là ngày hợp lệ.',
)
assert.equal(
  validateStaffAdministrativeProfile(
    {
      ...draft,
      employmentAdministration: {
        ...draft.employmentAdministration,
        signedDate: '2026-07-20',
        effectiveDate: '2026-07-19',
      },
    },
    { today: '2026-07-27' },
  )['employmentAdministration.effectiveDate'],
  'Ngày ký không được sau ngày hiệu lực.',
)

const created = buildStaffAdministrativeProfileFromDraft(draft, null, {
  centerId: 'center-a',
  staffMemberId: staff.id,
  profileId: 'staff-admin-profile-001',
  now: '2026-07-27T01:00:00.000Z',
})
assert.equal(created.id, 'staff-admin-profile-001')
assert.equal(created.centerId, 'center-a')
assert.equal(created.staffMemberId, staff.id)
assert.equal(created.schemaVersion, 1)
assert.equal(created.revision, 1)
assert.equal(created.completionStatus, 'incomplete', 'Create is always incomplete.')
assert.equal(created.identityDocument.number, '001234567890', 'Leading zero must survive.')
assert.equal(created.taxInformation.taxNumber, '0123456789', 'Tax number stays text.')

const lookup = resolveStaffAdministrativeProfileForStaff([created], staff.id, 'center-a')
assert.equal(lookup.status, 'incomplete')
assert.equal(lookup.profile.id, created.id)
assert.equal(
  resolveStaffAdministrativeProfileForStaff([created, { ...created, id: 'duplicate' }], staff.id, 'center-a').status,
  'duplicate',
)
assert.equal(
  resolveStaffAdministrativeProfileForStaff([{ ...created, centerId: 'center-b' }], staff.id, 'center-a').status,
  'malformed',
)

const reviewed = markStaffAdministrativeProfileReviewed(created, {
  reviewedBy: 'owner-user',
  reviewedByLabel: 'Owner QA',
  now: '2026-07-27T02:00:00.000Z',
})
assert(reviewed)
assert.equal(reviewed.completionStatus, 'complete')
assert.equal(reviewed.completionReview.checklistVersion, STAFF_ADMINISTRATIVE_PROFILE_CHECKLIST_VERSION)
assert.equal(reviewed.revision, 2)

const editDraft = createEditStaffAdministrativeProfileDraft(reviewed)
editDraft.currentAddress.addressLine = 'Địa chỉ đã sửa'
const edited = buildStaffAdministrativeProfileFromDraft(
  editDraft,
  {
    ...reviewed,
    unknownProfileField: { preserve: true },
    bankInformation: { ...reviewed.bankInformation, unknownBankField: 'preserve' },
  },
  {
    centerId: 'center-a',
    staffMemberId: staff.id,
    now: '2026-07-27T03:00:00.000Z',
  },
)
assert.equal(edited.id, created.id)
assert.equal(edited.createdAt, created.createdAt)
assert.equal(edited.revision, 3)
assert.equal(edited.completionStatus, 'needs-review')
assert.equal(edited.completionReview.reviewedAt, '')
assert.deepEqual(edited.unknownProfileField, { preserve: true })
assert.equal(edited.bankInformation.unknownBankField, 'preserve')

const normalized = normalizeStaffAdministrativeProfile(
  {
    ...edited,
    unknownProfileField: 'still-here',
    permanentAddress: { ...edited.permanentAddress, unknownAddressField: 'still-here' },
  },
  { currentCenterId: 'center-a' },
)
assert.equal(normalized.unknownProfileField, 'still-here')
assert.equal(normalized.permanentAddress.unknownAddressField, 'still-here')
const malformedNested = normalizeStaffAdministrativeProfile(
  { ...created, permanentAddress: 'invalid nested value' },
  { currentCenterId: 'center-a' },
)
assert(
  getStaffAdministrativeProfileCollectionIssues([malformedNested], 'center-a').some((issue) =>
    issue.includes('malformed-nested-value'),
  ),
)
assert(
  getStaffAdministrativeProfileCollectionIssues([created, { ...created }], 'center-a').some(
    (issue) => issue.includes('duplicate'),
  ),
)

const activeBinding = (role, patch = {}) => ({
  status: 'bound',
  currentCenterId: 'center-a',
  membership: {
    center_id: 'center-a',
    role,
    status: 'active',
    ...patch,
  },
})
const accessInput = (role, patch = {}) => ({
  user: { id: 'actor-1' },
  binding: activeBinding(role, patch),
  storageCenterId: 'center-a',
})
assert.equal(resolveStaffAdministrativeProfileAccess(accessInput('owner')).ok, true)
assert.equal(resolveStaffAdministrativeProfileAccess(accessInput('center_admin')).ok, true)
assert.equal(resolveStaffAdministrativeProfileAccess(accessInput('admin')).ok, true)
assert.equal(resolveStaffAdministrativeProfileAccess(accessInput('teacher')).ok, false)
assert.equal(resolveStaffAdministrativeProfileAccess(accessInput('consultant')).ok, false)
assert.equal(
  resolveStaffAdministrativeProfileAccess(accessInput('owner', { status: 'inactive' })).ok,
  false,
)
assert.equal(
  resolveStaffAdministrativeProfileAccess(accessInput('owner', { center_id: 'center-b' })).ok,
  false,
)
assert.equal(
  resolveStaffAdministrativeProfileAccess({
    user: { id: 'actor-1' },
    binding: { status: 'bound', currentCenterId: 'center-a', membership: null },
    storageCenterId: 'center-a',
  }).error,
  STAFF_ADMINISTRATIVE_PROFILE_ACCESS_DENIED_MESSAGE,
)

const deniedHtml = renderStaffAdministrativeProfileWindow({
  accessAllowed: false,
  staffMember: staff,
  lookup: { status: 'complete', profile: reviewed },
})
assert(deniedHtml.includes(STAFF_ADMINISTRATIVE_PROFILE_ACCESS_DENIED_MESSAGE))
assert(!deniedHtml.includes(reviewed.identityDocument.number))
assert(!deniedHtml.includes(reviewed.bankInformation.accountNumber))

const viewHtml = renderStaffAdministrativeProfileWindow({
  windowId: 'window-1',
  accessAllowed: true,
  staffMember: { ...staff, fullName: '<img src=x onerror=alert(1)>' },
  departmentName: '<script>bad()</script>',
  lookup: { status: 'complete', profile: reviewed },
  state: { mode: 'view', revealedFields: new Set() },
})
assert(viewHtml.includes('&lt;img src=x onerror=alert(1)&gt;'))
assert(viewHtml.includes('&lt;script&gt;bad()&lt;/script&gt;'))
assert(!viewHtml.includes(reviewed.identityDocument.number))
assert(!viewHtml.includes(reviewed.taxInformation.taxNumber))
assert(!viewHtml.includes(reviewed.insuranceInformation.socialInsuranceNumber))
assert(!viewHtml.includes(reviewed.bankInformation.accountNumber))
assert(viewHtml.includes(maskStaffAdministrativeValue(reviewed.identityDocument.number)))
assert(viewHtml.includes('data-staff-administrative-action="toggle-sensitive"'))
assert(!viewHtml.includes('Hiện tất cả'))

const revealedHtml = renderStaffAdministrativeProfileWindow({
  windowId: 'window-1',
  accessAllowed: true,
  staffMember: staff,
  lookup: { status: 'complete', profile: reviewed },
  state: {
    mode: 'view',
    centerId: reviewed.centerId,
    profileId: reviewed.id,
    revealedFields: new Set(['identityDocument.number']),
  },
})
assert(revealedHtml.includes(reviewed.identityDocument.number))
assert(!revealedHtml.includes(reviewed.bankInformation.accountNumber))

const emptyHtml = renderStaffAdministrativeProfileWindow({
  windowId: 'window-2',
  accessAllowed: true,
  staffMember: staff,
  lookup: { status: 'not-created', profile: null },
  state: { mode: 'view', revealedFields: new Set() },
})
assert(emptyHtml.includes('Chưa có Hồ sơ hành chính.'))
assert(emptyHtml.includes('Tạo hồ sơ hành chính'))

const listStatus = getStaffAdministrativeProfileListStatus([reviewed], staff, 'center-a')
assert.equal(listStatus.label, 'Đã hoàn thiện')
const staffHtml = renderStaffModule({
  staffMembers: [staff],
  administrativeProfiles: [reviewed],
  administrativeAccessAllowed: true,
  administrativeStorageHealthy: true,
  currentCenterId: 'center-a',
})
assert(staffHtml.includes('Hồ sơ hành chính: Đã hoàn thiện'))
assert(staffHtml.includes('data-staff-action="open-administrative-profile"'))
assert(!staffHtml.includes(reviewed.identityDocument.number))
assert(!staffHtml.includes(reviewed.bankInformation.accountNumber))

storage.setCurrentStorageCenterId('center-a')
const profileStorageKey = 'ichessCenterOS.centerStaffAdministrativeProfiles.center-a'
assert.equal(globalThis.localStorage.getItem(profileStorageKey), null)
assert.deepEqual(storage.getStoredCenterStaffAdministrativeProfiles([]), [])
assert.equal(
  globalThis.localStorage.getItem(profileStorageKey),
  null,
  'Reading an empty state must not create the storage key.',
)
assert.equal(storage.saveStoredCenterStaffAdministrativeProfiles([created]), true)
assert.equal(storage.getStoredCenterStaffAdministrativeProfiles([]).length, 1)
assert.equal(
  storage.getStoredCenterStaffAdministrativeProfiles([])[0].identityDocument.number,
  '001234567890',
)
const beforeRejectedDuplicate = globalThis.localStorage.getItem(profileStorageKey)
assert.equal(storage.saveStoredCenterStaffAdministrativeProfiles('invalid collection'), false)
assert.equal(globalThis.localStorage.getItem(profileStorageKey), beforeRejectedDuplicate)
assert.equal(
  storage.saveStoredCenterStaffAdministrativeProfiles([created, { ...created }]),
  false,
  'Collection one-to-one guard must reject duplicate write.',
)
assert.equal(globalThis.localStorage.getItem(profileStorageKey), beforeRejectedDuplicate)

storage.setCurrentStorageCenterId('center-b')
assert.deepEqual(storage.getStoredCenterStaffAdministrativeProfiles([]), [])
assert.equal(
  globalThis.localStorage.getItem('ichessCenterOS.centerStaffAdministrativeProfiles.center-b'),
  null,
)
globalThis.localStorage.setItem(
  'ichessCenterOS.centerStaffAdministrativeProfiles.center-b',
  '{malformed',
)
assert.deepEqual(storage.getStoredCenterStaffAdministrativeProfiles([]), [])
assert.equal(storage.getStoredCenterStaffAdministrativeProfilesReadStatus().ok, false)
assert.equal(
  globalThis.localStorage.getItem('ichessCenterOS.centerStaffAdministrativeProfiles.center-b'),
  '{malformed',
  'Malformed sensitive storage must not be deleted or rewritten on read.',
)

const profileSnapshot = structuredClone(reviewed)
const staffSnapshot = structuredClone(staff)
const archivedStaff = archiveStaffMember(staff, '2026-07-27T04:00:00.000Z')
assert(archivedStaff.archivedAt)
assert.deepEqual(reviewed, profileSnapshot, 'Staff archive must not mutate administrative profile.')
const lifecycleResult = buildStaffEmploymentTransition(
  staff,
  { toStatus: 'on-leave', effectiveDate: '2026-07-27', note: '' },
  { eventId: 'event-new', createdAt: '2026-07-27T04:00:00.000Z' },
)
assert.equal(lifecycleResult.ok, true)
assert.deepEqual(reviewed, profileSnapshot, 'Staff lifecycle must not mutate profile.')
assert.deepEqual(staff, staffSnapshot, 'Profile operations and lifecycle helpers are immutable.')

assert(storageSource.includes("createCenterScopedStorageKey(\n  'centerStaffAdministrativeProfiles'"))
assert(storageSource.includes('getStoredCenterStaffAdministrativeProfiles'))
assert(storageSource.includes('saveStoredCenterStaffAdministrativeProfiles'))
assert(main.includes("type: 'staff-administrative-profile'"))
assert(main.includes("windowItem.type === 'staff-administrative-profile'"))
assert(main.includes('openStaffAdministrativeProfileWindow'))
assert(main.includes('focusWindow(existingWindow.id)'))
assert(main.includes('staffAdministrativeProfileWindowStates.delete(windowId)'))
assert(main.includes('expectedRevision'))
assert(main.includes('expectedUpdatedAt'))
assert(main.includes('isStaffAdministrativeProfileSaving'))
assert(main.includes('getLatestStaffAdministrativeProfileAccessContext'))
assert(main.includes('data-taskbar-window-id'))
assert(main.includes('data-window-action="minimize"'))
assert(main.includes('data-window-action="maximize"'))
assert(main.includes('data-window-action="close"'))
assert(styles.includes('.desktop-window.is-staff-administrative-profile > .window-body'))
assert(styles.includes('overflow: hidden'))
assert(styles.includes('.staff-administrative-content-scroll'))
assert(styles.includes('overflow: auto'))
assert(main.includes("['.staff-administrative-content-scroll', 'staff-administrative-content']"))
assert(main.includes('field.focus({ preventScroll: true })'))
assert(main.includes('scrollElement.scrollTo({'))
assert(!profileSource.includes('console.'))
assert(!profileSource.includes('createObjectURL'))
assert(!profileSource.includes('readAsDataURL'))
assert(!profileSource.includes('FileReader'))
assert(!profileSource.includes('signedUrl'))
assert(!staffSource.includes('data-staff-administrative-field'))

const openWindowSource = main.slice(
  main.indexOf('function openStaffAdministrativeProfileWindow'),
  main.indexOf('function startStaffAdministrativeProfileCreate'),
)
assert(!openWindowSource.includes('setTimeout'))
const administrativeRuntimeSource = main.slice(
  main.indexOf('function getStaffAdministrativeProfileAccessContext'),
  main.indexOf('function ensureStaffAccountDirectoryLoading'),
)
assert(!administrativeRuntimeSource.includes('console.'))
assert(!administrativeRuntimeSource.includes('queueCoreCloudSync'))
assert(!administrativeRuntimeSource.includes('writeTeacherThroughCloud'))

for (const marker of [
  'Storage contract',
  'One-to-one',
  'Completion checklist',
  'Access matrix',
  'Child window',
  'Mask/reveal',
  'No-binary',
  'F23.11C',
  'Manual QA chưa được tự động kết luận PASS',
]) {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
}

const storageAdministrativeSource = storageSource.slice(
  storageSource.indexOf('export function getStoredCenterStaffAdministrativeProfiles'),
  storageSource.indexOf('export function getStoredCenterDepartments'),
)
const staffAdministrativeCardSource = staffSource.slice(
  staffSource.indexOf('function renderStaffAdministrativeProfileCard'),
  staffSource.indexOf('function renderStaffLifecycleCard'),
)
const mojibakeFragments = [
  `Cá${'º'}`,
  '\u00c3',
  `Æ${'°'}`,
  `Há${'º'}`,
  `á${'»'}`,
  `Buá${'»'}•i há${'»'}c má${'»'}›i`,
]
for (const text of [
  profileSource,
  docs,
  administrativeRuntimeSource,
  storageAdministrativeSource,
  staffAdministrativeCardSource,
]) {
  assert(!mojibakeFragments.some((fragment) => text.includes(fragment)), 'Mojibake marker found.')
}

console.log('F23.11B staff administrative profile local-safe smoke: PASS')

function createMemoryStorage() {
  const values = new Map()
  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      const normalizedKey = String(key)
      return values.has(normalizedKey) ? values.get(normalizedKey) : null
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key) {
      values.delete(String(key))
    },
    setItem(key, value) {
      values.set(String(key), String(value))
    },
  }
}
