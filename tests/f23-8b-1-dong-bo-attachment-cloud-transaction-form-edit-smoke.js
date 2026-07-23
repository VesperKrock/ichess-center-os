import assert from 'node:assert/strict'
import fs from 'node:fs'

const cashflowModule = await import('../src/cashflow-module.js')
const attachmentModule = await import('../src/transaction-attachments.js')

const mainSource = fs.readFileSync('src/main.js', 'utf8')
const cashflowSource = fs.readFileSync('src/cashflow-module.js', 'utf8')
const attachmentsSource = fs.readFileSync('src/transaction-attachments.js', 'utf8')
const docSource = fs.readFileSync('docs/f23-8b-1-dong-bo-attachment-cloud-transaction-form-edit.md', 'utf8')

const {
  createEditCashflowFormState,
  createCashflowAttachmentDraftFromExisting,
  createEmptyCashflowAttachmentDraft,
  createErrorCashflowAttachmentDraft,
  renderCashflowModule,
} = cashflowModule

assert.equal(typeof attachmentModule.updateTransactionAttachmentMetadata, 'function')
assert(attachmentsSource.includes('runAuthorizedAttachmentOperation(centerId'), 'Metadata update must keep SUP-CF.1 center/role guard.')
assert(attachmentsSource.includes(".eq('id', attachmentId)"))
assert(attachmentsSource.includes(".eq('center_id', centerId)"))

const transaction = {
  id: 'txn-1',
  type: 'income',
  category: 'Khác',
  amount: 100000,
  transactionDate: '2026-07-23',
  method: 'Tiền mặt',
  personName: 'A',
  recordedBy: 'Admin',
  note: 'Manual',
  updatedAt: '2026-07-23T01:00:00.000Z',
}

const loadingState = createEditCashflowFormState(transaction, 'center-a', {
  hydrateAttachment: true,
})
assert.equal(loadingState.attachmentDraft.mode, 'loading')

const loadingHtml = renderCashflowModule([], {}, loadingState, [])
assert(loadingHtml.includes('Đang tải chứng từ...'))
const loadingBlock = loadingHtml.slice(
  loadingHtml.indexOf('data-cashflow-evidence-field'),
  loadingHtml.indexOf('data-cashflow-evidence-field') + 900,
)
assert(!loadingBlock.includes('Không có chứng từ'), 'Loading evidence area must not flash none.')

const cloudAttachment = {
  id: 'meta-1',
  metadataId: 'meta-1',
  fileName: 'TC-20260723-0001-01.jpg',
  originalName: 'receipt.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2048,
  storagePath: 'center-a/transaction-images/2026/07/TC-20260723-0001-01.jpg',
  transactionCode: 'TC-20260723-0001',
  createdAt: '2026-07-23T02:00:00.000Z',
  uploadedByName: 'Owner',
  signedUrl: 'https://example.test/signed',
}
const cloudState = {
  ...loadingState,
  attachmentDraft: createCashflowAttachmentDraftFromExisting(cloudAttachment, 'cloud'),
  values: {
    ...loadingState.values,
    attachment: cloudAttachment,
  },
}
const cloudHtml = renderCashflowModule([], {}, cloudState, [])
assert(cloudHtml.includes('Có chứng từ'))
assert(cloudHtml.includes('TC-20260723-0001-01.jpg'))
assert(cloudHtml.includes('Xem trước'))
assert(cloudHtml.includes('Thay ảnh'))
assert(cloudHtml.includes('Gỡ'))

const legacyAttachment = {
  id: 'legacy-1',
  name: 'legacy.jpg',
  type: 'image/jpeg',
  size: 512,
  dataUrl: 'data:image/jpeg;base64,AAAA',
}
const errorDraft = createErrorCashflowAttachmentDraft('network failed', legacyAttachment)
assert.equal(errorDraft.mode, 'keep-existing-legacy')
assert.equal(errorDraft.error, 'network failed')

const emptyDraft = createEmptyCashflowAttachmentDraft()
assert.equal(emptyDraft.mode, 'none')
assert.equal(emptyDraft.source, '')

assert(mainSource.includes('hydrateCashflowEditAttachment'), 'Edit open must hydrate cloud attachment metadata.')
assert(mainSource.includes('cashflowAttachmentHydrateToken'), 'Hydrate response must have a stale token guard.')
assert(mainSource.includes('getCurrentResolvedCenterId()'), 'Hydrate response must check current center.')
assert(mainSource.includes('listTransactionAttachmentsByTransactionCode({'), 'Form edit must query cloud metadata used by row/gallery.')
assert(mainSource.includes('createTransactionImageSignedUrl('), 'Cloud preview must use signed URL helper, not persist signed URL as source of truth.')
assert(mainSource.includes("createCashflowAttachmentDraftFromExisting(hydratedCloudAttachment, 'cloud')"))
assert(mainSource.includes("createCashflowAttachmentDraftFromExisting(legacyAttachment, 'legacy')"))
assert(mainSource.includes("attachmentDraft.source === 'cloud'"))
assert(mainSource.includes('updateTransactionAttachmentMetadata('), 'Save field-only edit must sync existing metadata, not create duplicate metadata.')
assert(!/isKeepExistingCashflowAttachmentDraft\(attachmentDraft\)[\s\S]{0,500}createTransactionAttachmentMetadata/.test(mainSource), 'Keeping an existing cloud attachment must not create duplicate metadata.')
assert(mainSource.includes("attachmentDraft.mode === 'staged-new' ? attachmentDraft.file : null"), 'Only staged-new should upload.')
assert(mainSource.includes("attachmentDraft.mode === 'remove-existing'"), 'Remove must stay staged until save.')
assert(mainSource.includes('cleanupCloudCashflowAttachment('), 'Replace/remove cleanup must run after local save lifecycle.')
assert(!mainSource.includes('supabase db push'), 'Runtime must not apply remote SQL.')

for (const marker of [
  'Root Cause',
  'Canonical Hydrate Rule',
  'Loading/Error/None',
  'Cloud Before Legacy',
  'No Reupload On Field Save',
  'Replace/Remove Lifecycle',
  'SUP-CF.1 Boundary',
  'F23.8C',
  'F23.8E1',
]) {
  assert(docSource.includes(marker), `Doc missing marker: ${marker}`)
}

for (const [label, source] of [
  ['cashflow-module', cashflowSource],
  ['main', mainSource],
  ['attachments', attachmentsSource],
  ['doc', docSource],
]) {
  const mojibakeMarkers = [
    ['C', 'á', 'º'].join(''),
    String.fromCharCode(0x00c3),
    ['Æ', '°'].join(''),
    ['H', 'á', 'º'].join(''),
    ['á', '»'].join(''),
    '\ufffd',
  ]
  for (const marker of mojibakeMarkers) {
    assert(!source.includes(marker), `${label} contains mojibake marker ${marker}`)
  }
}

console.log('F23.8B.1 dong bo attachment cloud transaction form edit smoke passed')
