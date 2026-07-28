import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  STAFF_DOCUMENT_ATTACHMENT_ACCEPT,
  STAFF_DOCUMENT_ATTACHMENT_MAX_BYTES,
  STAFF_DOCUMENT_ATTACHMENT_MIME_TYPES,
  STAFF_DOCUMENT_ATTACHMENT_SIGNED_URL_TTL_SECONDS,
  STAFF_DOCUMENT_ATTACHMENTS_BUCKET,
  createStaffDocumentAttachmentService,
  validateStaffDocumentAttachmentFile,
  validateStaffDocumentAttachmentSignature,
} from '../src/staff-document-attachments-supabase.js'
import {
  formatStaffDocumentAttachmentSize,
  getStaffDocumentAttachmentMimeLabel,
  renderStaffDocumentAttachmentPanel,
} from '../src/staff-documents-module.js'
import {
  STAFF_ADMINISTRATIVE_ACTIONS,
  STAFF_ADMINISTRATIVE_AUDIT_ACTIONS,
  buildStaffAdministrativeAuditEvent,
  getStaffAdministrativeAuditEventIssues,
  resolveStaffAdministrativeActionAccess,
} from '../src/staff-administrative-governance-module.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const adapterSource = read('src/staff-document-attachments-supabase.js')
const documentSource = read('src/staff-documents-module.js')
const governanceSource = read('src/staff-administrative-governance-module.js')
const profileSource = read('src/staff-administrative-profile-module.js')
const main = read('src/main.js')
const storageSource = read('src/storage.js')
const styles = read('src/styles.css')
const migration = read('supabase/migrations/202607280001_f23_11e_staff_document_private_attachments.sql')
const docs = read('docs/f23-11e-upload-anh-pdf-tai-lieu-nhan-su-supabase-storage-private.md')

assert.equal(STAFF_DOCUMENT_ATTACHMENTS_BUCKET, 'staff-administrative-documents')
assert.equal(STAFF_DOCUMENT_ATTACHMENT_MAX_BYTES, 10 * 1024 * 1024)
assert.equal(STAFF_DOCUMENT_ATTACHMENT_SIGNED_URL_TTL_SECONDS, 180)
assert.equal(STAFF_DOCUMENT_ATTACHMENT_ACCEPT, 'application/pdf,image/jpeg,image/png,image/webp')
assert.deepEqual(STAFF_DOCUMENT_ATTACHMENT_MIME_TYPES, [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const pdfFile = makeFile([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31], 'contract.pdf', 'application/pdf')
const jpegFile = makeFile([0xff, 0xd8, 0xff, 0xe0], 'photo.jpg', 'image/jpeg')
const pngFile = makeFile(
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'photo.png',
  'image/png',
)
const webpFile = makeFile(
  [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')],
  'photo.webp',
  'image/webp',
)
for (const file of [pdfFile, jpegFile, pngFile, webpFile]) {
  assert.equal(validateStaffDocumentAttachmentFile(file).ok, true)
  assert.equal((await validateStaffDocumentAttachmentSignature(file, file.type)).ok, true)
}
assert.equal(validateStaffDocumentAttachmentFile(null).code, 'file-missing')
assert.equal(validateStaffDocumentAttachmentFile(makeFakeFile('x.zip', 'application/zip', 20)).code, 'mime-not-allowed')
assert.equal(validateStaffDocumentAttachmentFile(makeFakeFile('x.pdf', 'application/pdf', 0)).code, 'file-empty')
assert.equal(validateStaffDocumentAttachmentFile(
  makeFakeFile('x.pdf', 'application/pdf', STAFF_DOCUMENT_ATTACHMENT_MAX_BYTES + 1),
).code, 'file-too-large')
assert.equal(validateStaffDocumentAttachmentFile(makeFakeFile('x.png', 'application/pdf', 20)).code, 'extension-mismatch')
assert.equal(validateStaffDocumentAttachmentFile(makeFakeFile('../x.pdf', 'application/pdf', 20)).data.originalFileName, 'x.pdf')
assert.equal((await validateStaffDocumentAttachmentSignature(
  makeFile([0, 1, 2, 3, 4], 'fake.pdf', 'application/pdf'),
  'application/pdf',
)).code, 'signature-mismatch')

const identity = {
  centerId: 'center-a',
  staffMemberId: 'staff-001',
  administrativeProfileId: 'profile-001',
  documentId: 'staff-document-001',
}
const attachmentId = '11111111-1111-4111-8111-111111111111'
const objectPath = `centers/center-a/staff/staff-001/documents/staff-document-001/${attachmentId}/attachment.pdf`
const pendingRow = {
  id: attachmentId,
  center_id: 'center-a',
  staff_member_id: 'staff-001',
  administrative_profile_id: 'profile-001',
  document_id: 'staff-document-001',
  bucket_id: STAFF_DOCUMENT_ATTACHMENTS_BUCKET,
  object_path: objectPath,
  original_file_name: 'contract.pdf',
  safe_file_name: 'attachment.pdf',
  mime_type: 'application/pdf',
  size_bytes: pdfFile.size,
  state: 'pending',
  is_primary: true,
  version: 1,
  created_at: '2026-07-28T01:00:00.000Z',
  updated_at: '2026-07-28T01:00:00.000Z',
  archived_at: null,
}
const availableRow = { ...pendingRow, state: 'available' }

const successfulBackend = createMockBackend({ selectRow: availableRow })
const ownerService = createService(successfulBackend.client)
const readiness = await ownerService.checkReadiness({ centerId: 'center-a' })
assert.equal(readiness.ok, true)
assert.equal(readiness.data.ready, true)
assert.equal(readiness.data.schemaVersion, 1)

const listResult = await ownerService.listPrimary(identity)
assert.equal(listResult.ok, true)
assert.equal(listResult.data.id, attachmentId)
assert.equal(listResult.data.centerId, 'center-a')
assert.equal(listResult.data.documentId, 'staff-document-001')
assert.equal(listResult.data.state, 'available')
assert.equal(Object.hasOwn(listResult.data, 'objectPath'), false)
assert.equal(Object.hasOwn(listResult.data, 'bucketId'), false)

const stages = []
const uploadResult = await ownerService.upload({
  ...identity,
  file: pdfFile,
  onStage: ({ stage }) => stages.push(stage),
  beforeFinalize: async () => true,
})
assert.equal(uploadResult.ok, true)
assert.equal(uploadResult.data.state, 'available')
assert.deepEqual(stages, ['preparing', 'uploading', 'finalizing'])
assert.equal(successfulBackend.storageCalls[0].bucket, STAFF_DOCUMENT_ATTACHMENTS_BUCKET)
assert.equal(successfulBackend.storageCalls[0].path, objectPath)
assert.equal(successfulBackend.storageCalls[0].options.upsert, false)
assert.equal(successfulBackend.storageCalls[0].options.contentType, 'application/pdf')
assert(successfulBackend.rpcCalls.some((call) => call.name === 'prepare_staff_document_attachment_upload'))
assert(successfulBackend.rpcCalls.some((call) => call.name === 'finalize_staff_document_attachment_upload'))
assert(!successfulBackend.rpcCalls.some((call) => call.name === 'fail_staff_document_attachment_upload'))

const previewResult = await ownerService.createAccessUrl({
  ...identity,
  attachmentId,
  mode: 'preview',
})
assert.equal(previewResult.ok, true)
assert.equal(previewResult.data.expiresIn, 180)
assert.equal(previewResult.data.mimeType, 'application/pdf')
assert.equal(successfulBackend.signedUrlCalls.at(-1).options, undefined)
const downloadResult = await ownerService.createAccessUrl({
  ...identity,
  attachmentId,
  mode: 'download',
})
assert.equal(downloadResult.ok, true)
assert.equal(successfulBackend.signedUrlCalls.at(-1).options.download, 'attachment.pdf')

const migrationMissingBackend = createMockBackend({ readinessError: true })
const migrationMissingResult = await createService(migrationMissingBackend.client)
  .checkReadiness({ centerId: 'center-a' })
assert.equal(migrationMissingResult.ok, true)
assert.equal(migrationMissingResult.data.ready, false)
assert.equal(migrationMissingResult.data.reason, 'migration-not-applied')

const unconfiguredResult = await createStaffDocumentAttachmentService({
  getClient: () => null,
}).checkReadiness({ centerId: 'center-a' })
assert.equal(unconfiguredResult.ok, false)
assert.equal(unconfiguredResult.code, 'not-configured')

for (const [membership, expectedCode] of [
  [{ center_id: 'center-a', user_id: 'user-1', role: 'teacher', status: 'active' }, 'unauthorized'],
  [{ center_id: 'center-a', user_id: 'user-1', role: 'consultant', status: 'active' }, 'unauthorized'],
  [{ center_id: 'center-a', user_id: 'user-1', role: 'owner', status: 'inactive' }, 'unauthorized'],
  [{ center_id: 'center-b', user_id: 'user-1', role: 'owner', status: 'active' }, 'unauthorized'],
  [{ center_id: 'center-a', user_id: 'other', role: 'owner', status: 'active' }, 'unauthorized'],
]) {
  const denied = await createService(successfulBackend.client, membership)
    .checkReadiness({ centerId: 'center-a' })
  assert.equal(denied.code, expectedCode)
}
const adminReady = await createService(successfulBackend.client, {
  center_id: 'center-a',
  user_id: 'user-1',
  role: 'center_admin',
  status: 'active',
}).checkReadiness({ centerId: 'center-a' })
assert.equal(adminReady.data.ready, true)

const uploadFailureBackend = createMockBackend({ uploadError: true })
const uploadFailure = await createService(uploadFailureBackend.client).upload({
  ...identity,
  file: pdfFile,
})
assert.equal(uploadFailure.ok, false)
assert.equal(uploadFailure.code, 'upload-failed')
assert(uploadFailureBackend.rpcCalls.some((call) => call.name === 'fail_staff_document_attachment_upload'))
assert(!uploadFailureBackend.rpcCalls.some((call) => call.name === 'finalize_staff_document_attachment_upload'))

const finalizeFailureBackend = createMockBackend({ finalizeError: true })
const finalizeFailure = await createService(finalizeFailureBackend.client).upload({
  ...identity,
  file: pdfFile,
})
assert.equal(finalizeFailure.code, 'finalize-failed')
assert(finalizeFailureBackend.rpcCalls.some((call) => call.name === 'fail_staff_document_attachment_upload'))

const staleBackend = createMockBackend()
const staleResult = await createService(staleBackend.client).upload({
  ...identity,
  file: pdfFile,
  beforeFinalize: async () => false,
})
assert.equal(staleResult.code, 'stale-context')
assert(staleBackend.rpcCalls.some((call) =>
  call.name === 'fail_staff_document_attachment_upload' &&
  call.args.p_reason_code === 'stale-local-context'))
assert(!staleBackend.rpcCalls.some((call) => call.name === 'finalize_staff_document_attachment_upload'))

const badSignatureBackend = createMockBackend()
const badSignatureResult = await createService(badSignatureBackend.client).upload({
  ...identity,
  file: makeFile([1, 2, 3, 4, 5], 'fake.pdf', 'application/pdf'),
})
assert.equal(badSignatureResult.code, 'signature-mismatch')
assert.equal(badSignatureBackend.rpcCalls.length, 0)

const documentRecord = { id: 'staff-document-001', archivedAt: '' }
const unavailableHtml = renderStaffDocumentAttachmentPanel({
  documentRecord,
  state: { status: 'unavailable' },
})
assert(unavailableHtml.includes('Kho tệp riêng tư chưa sẵn sàng.'))
assert(!unavailableHtml.includes('type="file"'))
const emptyHtml = renderStaffDocumentAttachmentPanel({
  documentRecord,
  state: { status: 'ready', record: null },
})
assert(emptyHtml.includes('Chưa có tệp đính kèm'))
assert(emptyHtml.includes('type="file"'))
assert(emptyHtml.includes(STAFF_DOCUMENT_ATTACHMENT_ACCEPT))
const escapedAttachmentHtml = renderStaffDocumentAttachmentPanel({
  documentRecord,
  state: {
    status: 'ready',
    record: {
      ...availableRow,
      state: 'available',
      originalFileName: '<script>raw</script>.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      version: 1,
      createdAt: '2026-07-28T01:00:00.000Z',
    },
  },
})
assert(escapedAttachmentHtml.includes('&lt;script&gt;raw&lt;/script&gt;.pdf'))
assert(!escapedAttachmentHtml.includes('<script>raw</script>'))
assert(escapedAttachmentHtml.includes('data-staff-document-action="attachment-view"'))
assert(escapedAttachmentHtml.includes('data-staff-document-action="attachment-download"'))
assert(!escapedAttachmentHtml.includes(attachmentId))
assert(!escapedAttachmentHtml.includes(objectPath))
const failedHtml = renderStaffDocumentAttachmentPanel({
  documentRecord,
  state: { status: 'failed', message: 'Lỗi an toàn.' },
})
assert(failedHtml.includes('Tải lên thất bại'))
assert(failedHtml.includes('Thử tải lại'))
const archivedHtml = renderStaffDocumentAttachmentPanel({
  documentRecord: { ...documentRecord, archivedAt: '2026-07-28T00:00:00.000Z' },
  state: { status: 'ready', record: null },
})
assert(!archivedHtml.includes('type="file"'))
assert.equal(getStaffDocumentAttachmentMimeLabel('image/webp'), 'WebP')
assert.equal(getStaffDocumentAttachmentMimeLabel('application/zip'), 'Tệp cần kiểm tra')
assert.equal(formatStaffDocumentAttachmentSize(1024), '1.0 KiB')
assert.equal(formatStaffDocumentAttachmentSize(1024 * 1024), '1.0 MiB')

const ownerAttachmentAccess = resolveAccess('owner', 'staff-document.attachment-upload')
const adminAttachmentAccess = resolveAccess('center_admin', 'staff-document.attachment-download')
assert.equal(ownerAttachmentAccess.ok, true)
assert.equal(adminAttachmentAccess.ok, true)
assert.equal(resolveAccess('teacher', 'staff-document.attachment-view').ok, false)
assert.equal(resolveAccess('consultant', 'staff-document.attachment-upload').ok, false)
assert(STAFF_ADMINISTRATIVE_ACTIONS.includes('staff-document.attachment-upload'))
assert(STAFF_ADMINISTRATIVE_AUDIT_ACTIONS.includes('staff-document.attachment-upload-start'))
assert(STAFF_ADMINISTRATIVE_AUDIT_ACTIONS.includes('staff-document.attachment-upload-success'))
assert(STAFF_ADMINISTRATIVE_AUDIT_ACTIONS.includes('staff-document.attachment-upload-failed'))
assert(STAFF_ADMINISTRATIVE_AUDIT_ACTIONS.includes('staff-document.attachment-view'))
assert(STAFF_ADMINISTRATIVE_AUDIT_ACTIONS.includes('staff-document.attachment-download'))
const attachmentAudit = buildStaffAdministrativeAuditEvent({
  id: 'audit-attachment-1',
  centerId: 'center-a',
  actorUserId: 'user-1',
  actorMembershipId: 'membership-1',
  actorRole: 'owner',
  action: 'staff-document.attachment-view',
  targetType: 'staff-document-attachment',
  targetId: attachmentId,
  staffMemberId: 'staff-001',
  administrativeProfileId: 'profile-001',
  documentId: 'staff-document-001',
  attachmentId,
  outcome: 'success',
  reasonCode: 'attachment-view',
  noteSummary: 'pdf',
  createdAt: '2026-07-28T02:00:00.000Z',
})
assert.deepEqual(getStaffAdministrativeAuditEventIssues(attachmentAudit, 'center-a'), [])
assert(getStaffAdministrativeAuditEventIssues({
  ...attachmentAudit,
  objectPath,
}, 'center-a').includes('event:contains-forbidden-field'))
assert(getStaffAdministrativeAuditEventIssues({
  ...attachmentAudit,
  attachmentId: '',
}, 'center-a').includes('attachmentId:missing'))

for (const marker of [
  'create table if not exists public.center_staff_document_attachments',
  "'staff-administrative-documents'",
  'public = false',
  'file_size_limit',
  '10485760',
  'enable row level security',
  'can_manage_staff_document_attachments',
  'prepare_staff_document_attachment_upload',
  'finalize_staff_document_attachment_upload',
  'fail_staff_document_attachment_upload',
  'staff_document_attachment_backend_readiness',
  'c.relrowsecurity = true',
  "has_table_privilege('authenticated', 'public.center_staff_document_attachments', 'select')",
  "not has_table_privilege('authenticated', 'public.center_staff_document_attachments', 'insert')",
  'auth.uid()',
  "lower(btrim(coalesce(cm.status::text, ''))) = 'active'",
  "('owner', 'center_admin')",
  'uploaded_by_user_id = auth.uid()',
  "state = 'pending'",
  "state = 'available'",
  'for select',
  'for insert',
  'revoke all on table public.center_staff_document_attachments from anon, authenticated',
  'grant select on table public.center_staff_document_attachments to authenticated',
  'pg_advisory_xact_lock',
  'upsert: false',
]) {
  const target = marker === 'upsert: false' ? adapterSource : migration
  assert(target.includes(marker), `Missing F23.11E security marker: ${marker}`)
}
assert(!migration.includes('using (true)'))
assert(!migration.includes('for delete'))
assert(!migration.includes('for update\nto authenticated\nusing (\n  bucket_id'))
assert(!migration.includes('public = true'))
assert(!adapterSource.includes('getPublicUrl'))
const uploadAdapterSource = adapterSource.slice(
  adapterSource.indexOf('async function upload'),
  adapterSource.indexOf('async function replace'),
)
assert(!uploadAdapterSource.includes('.remove('))
assert(!adapterSource.includes('localStorage'))
assert(!adapterSource.includes('sessionStorage'))
assert(!adapterSource.includes('FileReader'))
assert(!adapterSource.includes('readAsDataURL'))
assert(!adapterSource.includes('createObjectURL'))
assert(!adapterSource.includes('console.'))
const uploadHandlerSource = main.slice(
  main.indexOf('async function handleStaffDocumentAttachmentSelection'),
  main.indexOf('async function handleStaffDocumentAttachmentAccess'),
)
assert(!uploadHandlerSource.includes('saveStoredCenterStaffDocuments'))
assert(main.includes('beforeFinalize: () => isStaffDocumentAttachmentFinalizeContextCurrent(captured)'))
assert(main.includes('uploadingStaffDocumentWindowIds.has(windowId)'))
assert(main.includes('getLatestStaffAdministrativeProfileAccessContext'))
assert(main.includes('staffDocumentAttachmentViewerState = null'))
assert(main.includes('data-staff-document-attachment-viewer'))
assert(main.includes('data-taskbar-window-id'))
assert(styles.includes('inset: 10px 10px 58px'))
assert(styles.includes('.staff-document-attachment-viewer-content'))
assert(profileSource.includes('staff-administrative-content-scroll'))
assert.equal((profileSource.match(/staff-administrative-content-scroll/g) || []).length >= 1, true)
assert(storageSource.includes("createCenterScopedStorageKey('centerStaffDocuments')"))
assert(!storageSource.includes('centerStaffDocumentAttachments'))

for (const marker of [
  'Sáu migration từ `20260722000000` đến `202607280003` đã apply remote',
  'F23.11E DONE',
  'Source of truth và giới hạn multi-device',
  'center_staff_document_attachments',
  'staff-administrative-documents',
  'pending | available | failed | archived',
  'role canonical `owner` hoặc `center_admin`',
  'Không có Storage UPDATE/DELETE policy',
  '10 MiB',
  'signed URL on-demand TTL 180 giây',
  'không hard-delete metadata/object',
  'Lịch sử apply — đã hoàn tất',
  'Rollback an toàn',
  'Manual QA sau remote apply',
  'F23.11E.1 DONE',
  'F23.11E.2A DONE',
  'F23.11E.2B LATER',
  'F23.11E PRIVATE STAFF ATTACHMENT DONE',
]) assert(docs.includes(marker), `Missing F23.11E docs marker: ${marker}`)

const newTextFiles = [adapterSource, documentSource, governanceSource, migration, docs]
const mojibakeFragments = [
  String.fromCodePoint(0x00c3),
  String.fromCodePoint(0x00c2),
  String.fromCodePoint(0x00e2, 0x20ac),
  String.fromCodePoint(0x0102, 0x00a1, 0x00c2, 0x00bb),
  String.fromCodePoint(0x0102, 0x00a1, 0x00c2, 0x00ba),
]
for (const text of newTextFiles) {
  assert(!mojibakeFragments.some((fragment) => text.includes(fragment)), 'Mojibake marker found.')
}
const privilegedSecretMarker = ['SERVICE', 'ROLE', 'KEY'].join('_')
for (const text of [adapterSource, migration, docs]) {
  assert(!text.includes(privilegedSecretMarker), 'Privileged secret marker found.')
}

console.log('F23.11E private staff document attachment migration/runtime smoke: PASS')

function createService(client, membership = {
  center_id: 'center-a',
  user_id: 'user-1',
  role: 'owner',
  status: 'active',
}) {
  return createStaffDocumentAttachmentService({
    getClient: () => client,
    getUser: async () => ({ id: 'user-1' }),
    getMembership: async () => membership,
  })
}

function createMockBackend({
  readinessError = false,
  uploadError = false,
  finalizeError = false,
  selectRow = availableRow,
} = {}) {
  const rpcCalls = []
  const storageCalls = []
  const signedUrlCalls = []
  const client = {
    async rpc(name, args) {
      rpcCalls.push({ name, args })
      if (name === 'staff_document_attachment_backend_readiness') {
        return readinessError
          ? { data: null, error: { code: 'PGRST202' } }
          : { data: [{ ready: true, schema_version: 1 }], error: null }
      }
      if (name === 'prepare_staff_document_attachment_upload') {
        return { data: [pendingRow], error: null }
      }
      if (name === 'finalize_staff_document_attachment_upload') {
        return finalizeError
          ? { data: null, error: { code: 'P0001' } }
          : { data: [availableRow], error: null }
      }
      if (name === 'fail_staff_document_attachment_upload') {
        return { data: [{ ...pendingRow, state: 'failed' }], error: null }
      }
      return { data: null, error: { code: 'unknown-rpc' } }
    },
    from(table) {
      assert.equal(table, 'center_staff_document_attachments')
      return createQuery(selectRow)
    },
    storage: {
      from(bucket) {
        return {
          async upload(storagePath, file, options) {
            storageCalls.push({ bucket, path: storagePath, file, options })
            return uploadError
              ? { data: null, error: { code: 'storage-failed' } }
              : { data: { path: storagePath }, error: null }
          },
          async createSignedUrl(storagePath, expiresIn, options) {
            signedUrlCalls.push({ bucket, path: storagePath, expiresIn, options })
            return {
              data: { signedUrl: 'https://signed.example.invalid/short-lived-token' },
              error: null,
            }
          },
        }
      },
    },
  }
  return { client, rpcCalls, storageCalls, signedUrlCalls }
}

function createQuery(row) {
  const query = {}
  for (const method of ['select', 'eq', 'is', 'order', 'limit']) {
    query[method] = () => query
  }
  query.maybeSingle = async () => ({ data: row, error: null })
  return query
}

function makeFile(bytes, name, type) {
  const file = new Blob([Uint8Array.from(bytes)], { type })
  Object.defineProperty(file, 'name', { value: name })
  return file
}

function makeFakeFile(name, type, size) {
  return {
    name,
    type,
    size,
    slice() {
      return { arrayBuffer: async () => new ArrayBuffer(16) }
    },
  }
}

function resolveAccess(role, action) {
  return resolveStaffAdministrativeActionAccess({
    user: { id: 'user-1' },
    binding: {
      status: 'bound',
      currentCenterId: 'center-a',
      membership: {
        id: 'membership-1',
        center_id: 'center-a',
        user_id: 'user-1',
        role,
        status: 'active',
      },
    },
    storageCenterId: 'center-a',
    action,
  })
}
