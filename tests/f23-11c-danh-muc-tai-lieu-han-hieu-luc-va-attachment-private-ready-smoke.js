import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  STAFF_DOCUMENT_EXPIRY_WARNING_DAYS,
  STAFF_DOCUMENT_ATTACHMENT_ALLOWED_MIME_TYPES,
  STAFF_DOCUMENT_ATTACHMENT_MAX_SIZE_BYTES,
  STAFF_DOCUMENT_ATTACHMENT_STATES,
  STAFF_DOCUMENT_LOCAL_METADATA_MAX_CHARS,
  STAFF_DOCUMENT_STALE_MESSAGE,
  archiveStaffDocument,
  buildStaffDocumentFromDraft,
  buildStaffDocumentAttachmentObjectPath,
  createEditStaffDocumentDraft,
  createStaffDocumentDraft,
  createStaffDocumentId,
  getFilteredStaffDocuments,
  getStaffDocumentCategoryLabel,
  getStaffDocumentCollectionIssues,
  getStaffDocumentRelationshipIssues,
  getStaffDocumentSummary,
  getStaffDocumentValidityLabel,
  getStaffDocumentValidityStatus,
  initialStaffDocumentFilters,
  normalizeStaffDocument,
  renderStaffDocumentsSection,
  restoreStaffDocument,
  setStaffDocumentDraftValue,
  validateStaffDocument,
} from '../src/staff-documents-module.js'
import {
  renderStaffAdministrativeProfileWindow,
  resolveStaffAdministrativeProfileAccess,
} from '../src/staff-administrative-profile-module.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const documentSource = read('src/staff-documents-module.js')
const profileSource = read('src/staff-administrative-profile-module.js')
const storageSource = read('src/storage.js')
const main = read('src/main.js')
const styles = read('src/styles.css')
const docs = read('docs/f23-11c-danh-muc-tai-lieu-han-hieu-luc-va-attachment-private-ready.md')

assert.equal(STAFF_DOCUMENT_EXPIRY_WARNING_DAYS, 30)
assert.equal(STAFF_DOCUMENT_ATTACHMENT_MAX_SIZE_BYTES, 10 * 1024 * 1024)
assert.equal(STAFF_DOCUMENT_LOCAL_METADATA_MAX_CHARS, 128 * 1024)
assert.deepEqual(STAFF_DOCUMENT_ATTACHMENT_ALLOWED_MIME_TYPES, [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])
assert.deepEqual(STAFF_DOCUMENT_ATTACHMENT_STATES, [
  'none',
  'pending',
  'available',
  'missing',
  'archived',
])
assert.equal(STAFF_DOCUMENT_STALE_MESSAGE, 'Tài liệu đã thay đổi. Vui lòng mở lại để tiếp tục.')
assert(createStaffDocumentId(1722067200000).startsWith('staff-document-1722067200000-'))
assert.equal(buildStaffDocumentAttachmentObjectPath({
  centerId: 'center-a',
  staffMemberId: 'staff-gv001',
  documentId: 'document-001',
  attachmentId: 'attachment-001',
  safeFileName: 'chung-chi.pdf',
}), 'centers/center-a/staff/staff-gv001/documents/document-001/attachment-001/chung-chi.pdf')
assert.equal(buildStaffDocumentAttachmentObjectPath({
  centerId: '../center-a',
  staffMemberId: 'staff-gv001',
  documentId: 'document-001',
  attachmentId: 'attachment-001',
  safeFileName: 'chung-chi.pdf',
}), '')

const staff = {
  id: 'staff-gv001',
  centerId: 'center-a',
  employeeCode: 'GV001',
  fullName: 'Nguyễn Trường Thịnh',
  employmentStatus: 'active',
  archivedAt: '',
}
const profile = {
  id: 'admin-profile-001',
  schemaVersion: 1,
  centerId: 'center-a',
  staffMemberId: staff.id,
  legalFullName: staff.fullName,
  permanentAddress: {},
  currentAddress: {},
  emergencyContact: {},
  identityDocument: {},
  taxInformation: {},
  insuranceInformation: {},
  bankInformation: {},
  employmentAdministration: {},
  completionStatus: 'incomplete',
  completionReview: {},
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
  archivedAt: '',
  revision: 1,
}
const staffSnapshot = structuredClone(staff)
const profileSnapshot = structuredClone(profile)

const accessForRole = (role, status = 'active', centerId = 'center-a') =>
  resolveStaffAdministrativeProfileAccess({
    user: { id: 'actor-1' },
    binding: {
      status: 'bound',
      currentCenterId: 'center-a',
      membership: {
        center_id: centerId,
        user_id: 'actor-1',
        role,
        status,
      },
    },
    storageCenterId: 'center-a',
  })
assert.equal(accessForRole('owner').ok, true)
assert.equal(accessForRole('center_admin').ok, true)
assert.equal(accessForRole('teacher').ok, false)
assert.equal(accessForRole('consultant').ok, false)
assert.equal(accessForRole('owner', 'inactive').ok, false)
assert.equal(accessForRole('owner', 'active', 'center-b').ok, false)

let draft = createStaffDocumentDraft()
assert.deepEqual(draft, {
  category: 'other',
  title: '',
  documentNumber: '',
  issuedDate: '',
  effectiveDate: '',
  expiryDate: '',
  note: '',
})
draft = setStaffDocumentDraftValue(draft, 'category', 'certificate')
draft = setStaffDocumentDraftValue(draft, 'title', 'Chứng chỉ nghiệp vụ')
draft = setStaffDocumentDraftValue(draft, 'documentNumber', '00001234')
draft = setStaffDocumentDraftValue(draft, 'issuedDate', '2026-07-01')
draft = setStaffDocumentDraftValue(draft, 'effectiveDate', '2026-07-02')
draft = setStaffDocumentDraftValue(draft, 'expiryDate', '2027-07-01')
draft = setStaffDocumentDraftValue(draft, 'note', 'Metadata QA')
assert.deepEqual(validateStaffDocument(draft), {})
assert.equal(setStaffDocumentDraftValue(draft, 'unknown', 'x'), draft)
assert(validateStaffDocument({ ...draft, title: '' }).title)
assert(validateStaffDocument({ ...draft, category: 'invalid' }).category)
assert(validateStaffDocument({ ...draft, issuedDate: '2026-02-31' }).issuedDate)
assert(validateStaffDocument({ ...draft, effectiveDate: '2026-06-30' }).effectiveDate)
assert(validateStaffDocument({ ...draft, expiryDate: '2026-06-30' }).expiryDate)

const created = buildStaffDocumentFromDraft(draft, null, {
  centerId: 'center-a',
  staffMemberId: staff.id,
  administrativeProfileId: profile.id,
  documentId: 'document-001',
  now: '2026-07-27T01:00:00.000Z',
})
assert.equal(created.id, 'document-001')
assert.equal(created.schemaVersion, 1)
assert.equal(created.centerId, 'center-a')
assert.equal(created.staffMemberId, staff.id)
assert.equal(created.administrativeProfileId, profile.id)
assert.equal(created.documentNumber, '00001234')
assert.deepEqual(created.attachmentIds, [])
assert.equal(created.revision, 1)
assert.equal(created.createdAt, created.updatedAt)
assert.equal(Object.hasOwn(created, 'status'), false)
assert.equal(Object.hasOwn(created, 'attachment'), false)

const normalized = normalizeStaffDocument(
  {
    ...created,
    category: 'identity',
    unknownDocumentField: { preserve: true },
    attachmentIds: ['attachment-existing', 'attachment-existing'],
  },
  { currentCenterId: 'center-a' },
)
assert.equal(normalized.category, 'identity-document')
assert.deepEqual(normalized.unknownDocumentField, { preserve: true })
assert.deepEqual(normalized.attachmentIds, ['attachment-existing'])
assert.equal(getStaffDocumentCollectionIssues([normalized], 'center-a').length, 0)
assert(getStaffDocumentCollectionIssues([normalized, { ...normalized }], 'center-a').some(
  (issue) => issue.includes('duplicate'),
))
assert(getStaffDocumentCollectionIssues([{ ...normalized, centerId: 'center-b' }], 'center-a').some(
  (issue) => issue.includes('centerId:mismatch'),
))
const malformed = normalizeStaffDocument({ ...created, title: { bad: true } }, {
  currentCenterId: 'center-a',
})
assert(getStaffDocumentCollectionIssues([malformed], 'center-a').some(
  (issue) => issue.includes('malformed-value'),
))
assert(getStaffDocumentCollectionIssues([{ ...created, dataUrl: 'data:image/png;base64,abc' }], 'center-a').some(
  (issue) => issue.includes('storageValue:unsupported'),
))
assert(getStaffDocumentCollectionIssues([{ ...created, objectUrl: 'blob:temporary' }], 'center-a').some(
  (issue) => issue.includes('storageValue:unsupported'),
))
assert(getStaffDocumentCollectionIssues([{
  ...created,
  attachment: { objectPath: 'https://public.example.invalid/document.pdf' },
}], 'center-a').some((issue) => issue.includes('storageValue:unsupported')))
assert(getStaffDocumentCollectionIssues([{
  ...created,
  unknownLargeValue: 'x'.repeat(STAFF_DOCUMENT_LOCAL_METADATA_MAX_CHARS + 1),
}], 'center-a').some((issue) => issue.includes('storageValue:too-large')))

assert.deepEqual(getStaffDocumentRelationshipIssues([created], {
  centerId: 'center-a',
  staffMembers: [staff],
  administrativeProfiles: [profile],
}), [])
assert(getStaffDocumentRelationshipIssues([{ ...created, staffMemberId: 'missing' }], {
  centerId: 'center-a',
  staffMembers: [staff],
  administrativeProfiles: [profile],
}).some((issue) => issue.includes('orphan')))
assert(getStaffDocumentRelationshipIssues([{ ...created, administrativeProfileId: 'missing' }], {
  centerId: 'center-a',
  staffMembers: [staff],
  administrativeProfiles: [profile],
}).some((issue) => issue.includes('orphan')))
assert(getStaffDocumentRelationshipIssues([{ ...created, staffMemberId: 'staff-other' }], {
  centerId: 'center-a',
  staffMembers: [staff, { ...staff, id: 'staff-other' }],
  administrativeProfiles: [profile],
}).some((issue) => issue.includes('profile-staff-link:mismatch')))

const edited = buildStaffDocumentFromDraft(
  { ...createEditStaffDocumentDraft(normalized), note: 'Đã sửa' },
  normalized,
  {
    centerId: 'center-a',
    staffMemberId: staff.id,
    administrativeProfileId: profile.id,
    now: '2026-07-27T02:00:00.000Z',
  },
)
assert.equal(edited.id, normalized.id)
assert.equal(edited.createdAt, normalized.createdAt)
assert.equal(edited.revision, 2)
assert.equal(edited.unknownDocumentField.preserve, true)
assert.deepEqual(edited.attachmentIds, ['attachment-existing'])

const baseStatusDocument = { ...created, expiryDate: '', archivedAt: '' }
assert.equal(getStaffDocumentValidityStatus(baseStatusDocument, { today: '2026-07-27' }), 'not-applicable')
assert.equal(getStaffDocumentValidityStatus({ ...baseStatusDocument, expiryDate: '2026-07-26' }, { today: '2026-07-27' }), 'expired')
assert.equal(getStaffDocumentValidityStatus({ ...baseStatusDocument, expiryDate: '2026-07-27' }, { today: '2026-07-27' }), 'expiring-soon')
assert.equal(getStaffDocumentValidityStatus({ ...baseStatusDocument, expiryDate: '2026-08-26' }, { today: '2026-07-27' }), 'expiring-soon')
assert.equal(getStaffDocumentValidityStatus({ ...baseStatusDocument, expiryDate: '2026-08-27' }, { today: '2026-07-27' }), 'valid')
assert.equal(getStaffDocumentValidityLabel('not-applicable'), 'Không áp dụng')
assert.equal(getStaffDocumentValidityLabel('valid'), 'Còn hiệu lực')
assert.equal(getStaffDocumentValidityLabel('expiring-soon'), 'Sắp hết hạn')
assert.equal(getStaffDocumentValidityLabel('expired'), 'Hết hạn')
assert.equal(getStaffDocumentCategoryLabel('certificate'), 'Chứng chỉ')

const statusDocuments = [
  { ...baseStatusDocument, id: 'no-expiry', title: 'Không hạn' },
  { ...baseStatusDocument, id: 'expired', title: 'Hết hạn', expiryDate: '2026-07-26' },
  { ...baseStatusDocument, id: 'soon', title: 'Sắp hết', expiryDate: '2026-08-01' },
  { ...baseStatusDocument, id: 'valid', title: 'Còn hạn', documentNumber: 'ZX-01', expiryDate: '2027-01-01' },
  { ...baseStatusDocument, id: 'archived', title: 'Lưu trữ', archivedAt: '2026-07-27T00:00:00.000Z' },
]
const summary = getStaffDocumentSummary(statusDocuments, { today: '2026-07-27' })
assert.equal(summary.totalActive, 4)
assert.equal(summary.archived, 1)
assert.equal(summary.notApplicable, 1)
assert.equal(summary.expired, 1)
assert.equal(summary.expiringSoon, 1)
assert.equal(summary.valid, 1)
assert.deepEqual(getFilteredStaffDocuments(statusDocuments, initialStaffDocumentFilters, {
  today: '2026-07-27',
}).map((item) => item.id), ['no-expiry', 'expired', 'soon', 'valid'])
assert.deepEqual(getFilteredStaffDocuments(statusDocuments, {
  ...initialStaffDocumentFilters,
  query: 'zx-01',
}, { today: '2026-07-27' }).map((item) => item.id), ['valid'])
assert.deepEqual(getFilteredStaffDocuments(statusDocuments, {
  ...initialStaffDocumentFilters,
  validityStatus: 'expired',
}, { today: '2026-07-27' }).map((item) => item.id), ['expired'])
assert.deepEqual(getFilteredStaffDocuments(statusDocuments, {
  ...initialStaffDocumentFilters,
  archiveState: 'archived',
}, { today: '2026-07-27' }).map((item) => item.id), ['archived'])

const archived = archiveStaffDocument(created, '2026-07-27T03:00:00.000Z')
assert.equal(archived.id, created.id)
assert.equal(archived.revision, 2)
assert.equal(getStaffDocumentValidityStatus(archived), 'archived')
assert.equal(archiveStaffDocument(archived), null)
const restored = restoreStaffDocument(archived, '2026-07-27T04:00:00.000Z')
assert.equal(restored.id, created.id)
assert.equal(restored.archivedAt, '')
assert.equal(restored.revision, 3)
assert.equal(restoreStaffDocument(restored), null)
assert.deepEqual(staff, staffSnapshot, 'Document operations must not mutate Staff lifecycle/link fields.')
assert.deepEqual(profile, profileSnapshot, 'Document operations must not mutate profile completion.')

const escapedDocument = { ...created, title: '<img src=x onerror=alert(1)>', documentNumber: '00<&"' }
const catalogHtml = renderStaffDocumentsSection({
  windowId: 'window-docs',
  documents: [escapedDocument],
  state: { mode: 'list', filters: initialStaffDocumentFilters },
  accessAllowed: true,
  storageHealthy: true,
  today: '2026-07-27',
})
assert(catalogHtml.includes('&lt;img src=x onerror=alert(1)&gt;'))
assert(catalogHtml.includes('00&lt;&amp;&quot;'))
assert(catalogHtml.includes('data-staff-document-action="start-create"'))
assert(catalogHtml.includes('data-staff-document-filter="validityStatus"'))
assert(catalogHtml.includes('data-staff-document-action="clear-filters"'))
assert(!catalogHtml.includes('staff-gv001'))
assert(!catalogHtml.includes('admin-profile-001'))

const detailHtml = renderStaffDocumentsSection({
  windowId: 'window-docs',
  documents: [created],
  state: {
    mode: 'detail',
    selectedDocumentId: created.id,
    attachment: { status: 'unavailable', documentId: created.id },
  },
  accessAllowed: true,
  storageHealthy: true,
  today: '2026-07-27',
})
assert(detailHtml.includes('Kho tệp riêng tư chưa sẵn sàng.'))
assert(detailHtml.includes('apply thủ công trước khi bật upload'))
assert(!detailHtml.includes('type="file"'))

const formHtml = renderStaffDocumentsSection({
  windowId: 'window-docs',
  documents: [],
  state: { mode: 'create', values: draft, filters: initialStaffDocumentFilters },
  accessAllowed: true,
  storageHealthy: true,
})
assert(formHtml.includes('data-staff-document-form'))
assert(formHtml.includes('Chưa có tệp đính kèm'))
assert(!formHtml.includes('type="file"'))
assert(!formHtml.includes('data-staff-document-field="status"'))
const deniedHtml = renderStaffDocumentsSection({
  documents: [{ ...created, title: 'SECRET-DOCUMENT-TITLE' }],
  accessAllowed: false,
})
assert(!deniedHtml.includes('SECRET-DOCUMENT-TITLE'))

const profileHtml = renderStaffAdministrativeProfileWindow({
  windowId: 'window-docs',
  staffMember: staff,
  lookup: { status: 'incomplete', profile },
  state: { mode: 'view', centerId: 'center-a', profileId: profile.id, revealedFields: new Set() },
  documents: [created],
  documentState: { mode: 'list', filters: initialStaffDocumentFilters },
  documentStorageHealthy: true,
  accessAllowed: true,
})
assert(profileHtml.includes('data-section-id="window-docs-documents"'))
assert(profileHtml.includes('data-staff-documents-section'))
assert.equal((profileHtml.match(/staff-administrative-content-scroll/g) || []).length, 1)
const deniedProfileHtml = renderStaffAdministrativeProfileWindow({
  staffMember: staff,
  lookup: { status: 'incomplete', profile },
  documents: [{ ...created, title: 'SECRET-DOCUMENT-TITLE' }],
  accessAllowed: false,
})
assert(!deniedProfileHtml.includes('SECRET-DOCUMENT-TITLE'))

globalThis.localStorage = createMemoryStorage()
const storage = await import('../src/storage.js')
storage.setCurrentStorageCenterId('center-a')
const keyA = 'ichessCenterOS.centerStaffDocuments.center-a'
assert.equal(globalThis.localStorage.getItem(keyA), null)
assert.deepEqual(storage.getStoredCenterStaffDocuments([]), [])
assert.equal(globalThis.localStorage.getItem(keyA), null)
assert.equal(storage.saveStoredCenterStaffDocuments([created]), true)
assert.equal(storage.getStoredCenterStaffDocuments([])[0].documentNumber, '00001234')
const savedSnapshot = globalThis.localStorage.getItem(keyA)
assert.equal(storage.saveStoredCenterStaffDocuments([created, { ...created }]), false)
assert.equal(globalThis.localStorage.getItem(keyA), savedSnapshot)
storage.setCurrentStorageCenterId('center-b')
assert.deepEqual(storage.getStoredCenterStaffDocuments([]), [])
assert.equal(globalThis.localStorage.getItem('ichessCenterOS.centerStaffDocuments.center-b'), null)
globalThis.localStorage.setItem('ichessCenterOS.centerStaffDocuments.center-b', '{malformed')
assert.deepEqual(storage.getStoredCenterStaffDocuments([]), [])
assert.equal(storage.getStoredCenterStaffDocumentsReadStatus().ok, false)
assert.equal(globalThis.localStorage.getItem('ichessCenterOS.centerStaffDocuments.center-b'), '{malformed')

assert(storageSource.includes("createCenterScopedStorageKey('centerStaffDocuments')"))
assert(storageSource.includes('getStoredCenterStaffDocuments'))
assert(storageSource.includes('saveStoredCenterStaffDocuments'))
assert(profileSource.includes("['documents', 'Tài liệu']"))
assert(profileSource.includes('renderStaffDocumentsSection({'))
assert(main.includes('getLatestStaffDocumentMutationContext'))
assert(main.includes('getLatestStaffAdministrativeProfileAccessContext(capturedState.centerId)'))
assert(main.includes('savingStaffDocumentWindowIds.has(windowId)'))
assert(main.includes('expectedArchivedAt'))
assert(main.includes('refreshStaffDocumentResultsRegion'))
assert(main.includes('currentResults.replaceWith(nextResults)'))
assert(main.includes('staffDocumentWindowStates.delete(windowId)'))
assert(main.includes("windowItem.type === 'staff-administrative-profile'"))
assert(main.includes('focusWindow(existingWindow.id)'))
assert(main.includes('data-taskbar-window-id'))
assert(styles.includes('.staff-administrative-content-scroll'))
assert(styles.includes('overflow: auto'))
assert(styles.includes('.staff-documents-section'))
assert(!styles.slice(styles.indexOf('.staff-documents-section'), styles.indexOf('@media', styles.indexOf('.staff-documents-section'))).includes('overflow: auto'))

for (const forbidden of [
  'FileReader',
  'readAsDataURL',
  'createObjectURL',
  'revokeObjectURL',
  'data:application',
  'data:image',
  'signedUrl',
  'publicUrl',
  'localStorage.setItem',
  'console.',
]) {
  assert(!documentSource.includes(forbidden), `Forbidden staff-document runtime marker: ${forbidden}`)
}
assert(documentSource.includes('data-staff-document-attachment-input'))
assert(!documentSource.includes('data-staff-document-field="status"'))
assert(!sourceSlice(main, 'function getStaffDocumentWindowContext', 'function focusFirstStaffAdministrativeProfileError').includes('console.'))
assert(!sourceSlice(main, 'async function handleStaffDocumentSubmit', 'async function changeStaffDocumentArchiveState').includes('saveStoredCenterStaffAdministrativeProfiles'))
assert(!sourceSlice(main, 'async function handleStaffDocumentSubmit', 'async function changeStaffDocumentArchiveState').includes('saveStoredCenterStaffMembers'))

for (const marker of [
  'centerStaffDocuments',
  'Storage contract',
  'Derived expiry status',
  'Revision, stale guard và double-submit',
  'Archive, restore và retention',
  'UI window, scroll, focus và taskbar',
  'Access matrix và privacy-by-design',
  'Attachment private-ready',
  'centerStaffDocumentAttachments',
  'centers/<centerId>/staff/<staffMemberId>/documents/<documentId>/<attachmentId>/<safeFileName>',
  'PDF, JPEG, PNG, WebP',
  'Migration và backward compatibility',
  'Manual QA chưa được tự động kết luận PASS',
]) {
  assert(docs.includes(marker), `Missing F23.11C docs marker: ${marker}`)
}

const publicSecretMarker = ['SERVICE', 'ROLE', 'KEY'].join('_')
for (const text of [documentSource, profileSource, docs]) {
  assert(!text.includes(publicSecretMarker), 'Public secret marker found.')
}

const mojibakeFragments = [
  `Cá${'º'}`,
  String.fromCodePoint(0x00c3),
  `Æ${'°'}`,
  `Há${'º'}`,
  `á${'»'}`,
]
for (const text of [documentSource, docs]) {
  assert(!mojibakeFragments.some((fragment) => text.includes(fragment)), 'Mojibake marker found.')
}

console.log('F23.11C staff document catalog and private-ready metadata smoke: PASS')

function sourceSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0, `Missing source marker: ${startMarker}`)
  assert(end > start, `Missing source marker: ${endMarker}`)
  return source.slice(start, end)
}

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
