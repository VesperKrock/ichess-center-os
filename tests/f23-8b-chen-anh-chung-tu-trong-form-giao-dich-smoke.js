import assert from 'node:assert/strict'
import fs from 'node:fs'

const storageData = new Map()

globalThis.localStorage = {
  getItem(key) {
    return storageData.has(String(key)) ? storageData.get(String(key)) : null
  },
  setItem(key, value) {
    storageData.set(String(key), String(value))
  },
  removeItem(key) {
    storageData.delete(String(key))
  },
}

const cashflowModule = await import('../src/cashflow-module.js')
const storageModule = await import('../src/storage.js')
const imageCompressionSource = fs.readFileSync('src/image-compression.js', 'utf8')
const cashflowSource = fs.readFileSync('src/cashflow-module.js', 'utf8')
const mainSource = fs.readFileSync('src/main.js', 'utf8')
const storageSource = fs.readFileSync('src/storage.js', 'utf8')
const stylesSource = fs.readFileSync('src/styles.css', 'utf8')
const docSource = fs.readFileSync('docs/f23-8b-chen-anh-chung-tu-trong-form-giao-dich.md', 'utf8')

const {
  CASHFLOW_EVIDENCE_ACCEPT,
  buildCashflowTransactionFromForm,
  createEditCashflowFormState,
  createEmptyCashflowAttachmentDraft,
  createEmptyCashflowFormStateWithCategories,
  renderCashflowModule,
  validateCashflowForm,
} = cashflowModule
const {
  readStoredCashflow,
  saveStoredCashflow,
  setCurrentStorageCenterId,
} = storageModule

assert.equal(
  CASHFLOW_EVIDENCE_ACCEPT,
  '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
  'Evidence input must use the existing image allowlist only.',
)
assert(imageCompressionSource.includes("new Set(['image/jpeg', 'image/png', 'image/webp'])"))
assert(imageCompressionSource.includes('TRANSACTION_IMAGE_MAX_SOURCE_SIZE = 10 * 1024 * 1024'))

const createState = createEmptyCashflowFormStateWithCategories([], 'center-a')
const createHtml = renderCashflowModule([], {}, createState, [])
assert(createHtml.includes('Chứng từ'), 'Create form must render Chứng từ field.')
assert(createHtml.includes('Chèn ảnh'), 'Create form must render Chèn ảnh button.')
assert(createHtml.includes('data-cashflow-evidence-input'), 'Create form must include evidence file input.')
assert(createHtml.includes('type="file"'), 'Evidence input must be a file input.')
assert(createHtml.includes('type="button" data-cashflow-evidence-action="insert"'), 'Chèn ảnh must be type button.')
assert(createHtml.indexOf("data-cashflow-form-field=\"recordedBy\"") < createHtml.indexOf('data-cashflow-evidence-field'), 'Chứng từ must sit beside/after Người ghi nhận in the same form grid.')
assert(!createHtml.includes('data-module-launcher'), 'Evidence controls must not be module launchers.')

const legacyAttachment = {
  id: 'legacy-1',
  name: 'bill <script>alert(1)</script>.jpg',
  type: 'image/jpeg',
  size: 512,
  dataUrl: 'data:image/jpeg;base64,AAAA',
  createdAt: '2026-07-20T00:00:00.000Z',
  unknownLegacyField: 'preserve',
}
const cloudAttachment = {
  id: 'meta-1',
  metadataId: 'meta-1',
  name: 'TC-20260723-0001-01.jpg',
  originalName: 'bill <script>alert(1)</script>.jpg',
  fileName: 'TC-20260723-0001-01.jpg',
  type: 'image/jpeg',
  mimeType: 'image/jpeg',
  size: 2048,
  sizeBytes: 2048,
  storageBucket: 'transaction-images',
  storagePath: 'center-a/transaction-images/2026/07/TC-20260723-0001-01.jpg',
  transactionCode: 'TC-20260723-0001',
  uploadedAt: '2026-07-23T00:00:00.000Z',
  unknownCloudField: 'preserve',
}

const editState = createEditCashflowFormState({
  id: 'txn-1',
  type: 'income',
  category: 'Khác',
  amount: 100000,
  transactionDate: '2026-07-23',
  method: 'Tiền mặt',
  personName: 'A',
  recordedBy: 'Admin',
  note: 'Manual',
  sourceModule: 'manual',
  attachment: cloudAttachment,
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
}, 'center-a')
assert.equal(editState.attachmentDraft.mode, 'keep-existing-legacy')
assert.equal(editState.attachmentDraft.existingAttachment.storagePath, cloudAttachment.storagePath)
assert.equal(editState.attachmentDraft.existingAttachment.unknownCloudField, 'preserve')

const editHtml = renderCashflowModule([], {}, editState, [])
assert(editHtml.includes('Chứng từ legacy hiện có'), 'Edit form must display old attachment.')
assert(editHtml.includes('Xem trước'))
assert(editHtml.includes('Thay ảnh'))
assert(editHtml.includes('Gỡ'))
assert(editHtml.includes('bill &lt;script&gt;alert(1)&lt;/script&gt;.jpg') || editHtml.includes('TC-20260723-0001-01.jpg'))
assert(!editHtml.includes('<script>alert(1)</script>'), 'Filename must be escaped.')

const emptyDraft = createEmptyCashflowAttachmentDraft()
assert.deepEqual(
  Object.keys(emptyDraft).sort(),
  ['error', 'existingAttachment', 'fileName', 'isUploading', 'mimeType', 'mode', 'objectUrl', 'sizeBytes', 'source'].sort(),
  'Draft state must expose the expected staging fields.',
)

setCurrentStorageCenterId('center-a')
const transactionWithCloudAttachment = buildCashflowTransactionFromForm({
  type: 'income',
  category: 'Khác',
  amount: '100.000',
  transactionDate: '2026-07-23',
  method: 'Tiền mặt',
  personName: 'A',
  recordedBy: 'Admin',
  note: 'Manual',
  attachment: cloudAttachment,
})
saveStoredCashflow([{ ...transactionWithCloudAttachment, unknownTransactionField: 'keep' }])
const storedCloud = readStoredCashflow([])[0]
assert.equal(storedCloud.attachment.storagePath, cloudAttachment.storagePath)
assert.equal(storedCloud.attachment.metadataId, 'meta-1')
assert.equal(storedCloud.attachment.unknownCloudField, 'preserve')
assert.equal(storedCloud.unknownTransactionField, 'keep')

saveStoredCashflow([{ ...transactionWithCloudAttachment, attachment: legacyAttachment }])
const storedLegacy = readStoredCashflow([])[0]
assert.equal(storedLegacy.attachment.dataUrl, legacyAttachment.dataUrl)
assert.equal(storedLegacy.attachment.unknownLegacyField, 'preserve')

const validAttachmentFormValues = {
  ...createState.values,
  category: 'Khác',
  amount: '100.000',
  recordedBy: 'Admin',
}
assert.deepEqual(validateCashflowForm({ ...validAttachmentFormValues, attachment: cloudAttachment }), {}, 'Cloud attachment reference must validate.')
assert(validateCashflowForm({ ...validAttachmentFormValues, attachment: { type: 'application/pdf', size: 100, storagePath: 'x' } }).attachment, 'PDF attachment must not validate.')

assert(mainSource.includes('stageCashflowEvidenceFile(file)'), 'File change must stage file in form state.')
assert(mainSource.includes('syncCashflowEvidencePreview()'), 'File change must update preview locally.')
assert(!/stageCashflowEvidenceFile[\s\S]{0,500}render\(\)/.test(mainSource), 'Selecting a file must not full-render the app.')
assert(mainSource.includes('URL.createObjectURL(file)'), 'Staged image must create an object URL.')
assert(mainSource.includes('URL.revokeObjectURL(objectUrl)'), 'Object URL cleanup must exist.')
assert(mainSource.includes('clearCashflowAttachmentDraft()'), 'Cancel/close must clear staging.')
assert(mainSource.includes('resetTransientStateForCenterSwitch'), 'Center switch reset must remain.')
assert(mainSource.includes('revokeCashflowAttachmentDraftObjectUrl()'), 'Center switch must revoke staged object URL.')

assert(mainSource.includes('uploadStagedCashflowEvidence'), 'Save must upload staged evidence.')
assert(mainSource.includes('validateTransactionImageFile(stagedFile)'), 'Save must validate staged file.')
assert(mainSource.includes("attachmentDraft.mode === 'loading'"), 'Save must not continue while cloud evidence hydration is loading.')
assert(mainSource.includes("attachmentDraft.mode === 'error'"), 'Save must not map cloud hydration errors to no attachment.')
assert(mainSource.includes('compressTransactionImage(file)'), 'Save must reuse compression helper.')
assert(mainSource.includes('uploadTransactionImageBlob({'), 'Save must reuse Storage helper.')
assert(mainSource.includes('createTransactionAttachmentMetadata({'), 'Save must reuse metadata helper.')
assert(mainSource.includes('buildTransactionImageStoragePath({'), 'Save must reuse storage path helper.')
assert(mainSource.includes('centerId,'), 'Upload lifecycle must pass centerId.')
assert(mainSource.includes('getCashflowTransactionCodesForTransactions(projectedTransactions)'), 'Create save must reserve transaction code before upload.')
assert(mainSource.includes('cashflowFormState.isSaving'), 'Save must guard double-submit.')
assert(mainSource.includes('formCenterId !== currentCenterId'), 'Save must guard center scope.')
assert(mainSource.includes('existingTransaction.updatedAt'), 'Edit save must guard stale record.')
assert(mainSource.includes('!existingTransaction'), 'Edit save must guard missing record before upload.')
assert(mainSource.includes('cleanupCloudCashflowAttachment(uploadedAttachment'), 'Failed save must cleanup newly uploaded image.')
assert(mainSource.includes('attachmentDraft.existingAttachment?.storagePath'), 'Old image cleanup must happen only after save success.')
assert(mainSource.includes("attachmentDraft.mode === 'remove-existing'"), 'Remove-existing mode must be implemented.')
assert(mainSource.includes("previousDraft.mode === 'staged-new'"), 'Gỡ staged image in edit must return to keep-existing.')

assert(!mainSource.includes('src/tuition-module.js'), 'F23.8B must not add tuition sync wiring.')
assert(!mainSource.includes('application/pdf'), 'F23.8B must not enable PDF.')
assert(!mainSource.includes('application/vnd.ms-excel'), 'F23.8B must not enable Excel.')
assert(!mainSource.includes('data-module-launcher][data-cashflow-evidence'), 'Evidence must not use launcher marker.')
assert(!mainSource.includes('openModuleWindow(button.dataset.cashflow'), 'Evidence button must not open module windows.')
assert(!/data-cashflow-evidence[\s\S]{0,240}data-module-id/.test(cashflowSource), 'Evidence markup must not add generic data-module-id.')
assert(mainSource.includes('isSafeImagePreviewUrl'), 'Preview must guard unsafe URLs.')
assert(mainSource.includes("url.startsWith('data:image/')"), 'Preview must allow image data URLs only.')
assert(!mainSource.includes("url.startsWith('javascript:')"), 'Preview must not allow javascript URLs.')

assert(stylesSource.includes('.cashflow-evidence-field'))
assert(stylesSource.includes('.cashflow-evidence-actions button:hover'))
assert(stylesSource.includes('.cashflow-evidence-actions button:focus-visible'))
assert(stylesSource.includes('.cashflow-evidence-actions button:active'))
assert(stylesSource.includes('@media (max-width: 720px)'))

for (const marker of [
  'Attachment Model Thực Tế',
  'Cloud Helper Tái Sử Dụng',
  'Draft State',
  'Create/Save Lifecycle',
  'Edit Keep/Replace/Remove',
  'Focus guard',
  'Roadmap F23.8C',
]) {
  assert(docSource.includes(marker), `Doc missing marker: ${marker}`)
}

for (const [label, source] of [
  ['cashflow-module', cashflowSource],
  ['main', mainSource],
  ['storage', storageSource],
  ['styles', stylesSource],
  ['docs', docSource],
]) {
  const mojibakeMarkers = [
    ['C', 'Ă', '¡Âº'].join(''),
    ['Ă', 'ƒ'].join(''),
    ['Ă', '†Â°'].join(''),
    ['H', 'Ă', '¡Âº'].join(''),
    ['Ă', '¡Â»'].join(''),
    ['Bu', 'Ă', '¡Â»â€¢i h', 'Ă', '¡Â»Âc m', 'Ă', '¡Â»â€ºi'].join(''),
    '\ufffd',
  ]
  for (const marker of mojibakeMarkers) {
    assert(!source.includes(marker), `${label} contains mojibake marker ${marker}`)
  }
}

console.log('F23.8B chen anh chung tu trong form giao dich smoke passed')
