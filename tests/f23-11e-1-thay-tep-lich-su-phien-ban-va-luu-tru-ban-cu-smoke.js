import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  STAFF_DOCUMENT_ATTACHMENT_REPLACEMENT_SCHEMA_VERSION,
  createStaffDocumentAttachmentService,
  sortStaffDocumentAttachmentHistory,
} from '../src/staff-document-attachments-supabase.js'
import {
  renderStaffDocumentAttachmentPanel,
  renderStaffDocumentVersionHistory,
} from '../src/staff-documents-module.js'
import {
  STAFF_ADMINISTRATIVE_ACTIONS,
  STAFF_ADMINISTRATIVE_AUDIT_ACTIONS,
} from '../src/staff-administrative-governance-module.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const hash = (relativePath) => crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(root, relativePath)))
  .digest('hex')
  .toUpperCase()

const appliedMigrationHashes = new Map([
  ['supabase/migrations/20260722000000_remote_schema.sql', '55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31'],
  ['supabase/migrations/20260722000100_transaction_images_bucket_prerequisite.sql', 'B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62'],
  ['supabase/migrations/202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql', '0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD'],
  ['supabase/migrations/202607280001_f23_11e_staff_document_private_attachments.sql', 'E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C'],
  ['supabase/migrations/202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql', 'CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8'],
])
for (const [file, expectedHash] of appliedMigrationHashes) {
  assert.equal(hash(file), expectedHash, `Applied migration changed: ${file}`)
}

const migrationPath = 'supabase/migrations/202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql'
const migration = read(migrationPath)
const adapterSource = read('src/staff-document-attachments-supabase.js')
const documentSource = read('src/staff-documents-module.js')
const governanceSource = read('src/staff-administrative-governance-module.js')
const mainSource = read('src/main.js')
const styles = read('src/styles.css')
const docs = read('docs/f23-11e-1-thay-tep-lich-su-phien-ban-va-luu-tru-ban-cu.md')
const migrationNames = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .filter((name) => name.includes('f23_11e_1_staff_document_attachment_replace_version_history'))
assert.deepEqual(migrationNames, [path.basename(migrationPath)])
assert(Number(path.basename(migrationPath).split('_')[0]) > 202607280001)

for (const marker of [
  'add column if not exists replaces_attachment_id uuid null',
  'add column if not exists archive_reason text null',
  'center_staff_document_attachments_replaces_fk',
  'on delete restrict',
  'center_staff_document_attachments_successful_replacement_unique',
  "where state in ('available', 'archived')",
  'new.replaces_attachment_id',
  'old.replaces_attachment_id',
  'staff_document_attachment_identity_immutable',
  'staff_document_attachment_transition_invalid',
  "old.state = 'available' and new.state = 'archived'",
  "old.state = 'pending' and new.state = 'available'",
  "old.state = 'pending' and new.state = 'failed'",
  'public.prepare_staff_document_attachment_replacement',
  'public.finalize_staff_document_attachment_replacement',
  'p_expected_current_attachment_id uuid',
  'pg_advisory_xact_lock',
  'for update',
  'v_current.version + 1',
  "'pending',\n    false",
  'v_current.id',
  'staff_document_attachment_replacement_stale',
  "state = 'archived'",
  'is_primary = false',
  "archive_reason = 'replaced'",
  "new.archive_reason is distinct from 'replaced'",
  "state = 'available'",
  'is_primary = true',
  'storage.objects',
  "a.state = 'archived'",
  "a.state = 'pending'",
  'a.uploaded_by_user_id = auth.uid()',
  "a.object_path = storage.objects.name",
  'schema_version integer',
  '    2;',
  "set search_path = ''",
]) assert(migration.includes(marker), `Missing migration marker: ${marker}`)

const prepareSql = sourceSlice(
  migration,
  'create or replace function public.prepare_staff_document_attachment_replacement',
  'create or replace function public.finalize_staff_document_attachment_replacement',
)
assert(!prepareSql.includes("set state = 'archived'"))
assert(!prepareSql.includes('staff_document_attachment_replacement_in_progress'))
assert(prepareSql.indexOf('select * into v_current') < prepareSql.indexOf('insert into public.center_staff_document_attachments'))
assert(prepareSql.includes("|| '/' || v_attachment_id::text"))
assert(!prepareSql.includes('upsert'))

const finalizeSql = sourceSlice(
  migration,
  'create or replace function public.finalize_staff_document_attachment_replacement',
  'revoke all on function public.prepare_staff_document_attachment_replacement',
)
const archivePosition = finalizeSql.indexOf("set\n    state = 'archived'")
const promotePosition = finalizeSql.indexOf("set\n    state = 'available'")
assert(archivePosition >= 0 && promotePosition > archivePosition)
assert(finalizeSql.includes('v_replacement.replaces_attachment_id is distinct from p_expected_current_attachment_id'))
assert(finalizeSql.includes('v_replacement.version <> v_current.version + 1'))
assert(finalizeSql.includes("o.bucket_id = v_replacement.bucket_id"))
assert(finalizeSql.includes("o.name = v_replacement.object_path"))
assert(finalizeSql.includes("v_object.metadata ->> 'size'"))
assert(finalizeSql.includes("v_object.metadata ->> 'mimetype'"))
assert(!finalizeSql.includes('exception when'))
assert(!finalizeSql.includes('commit'))

const storagePolicies = sourceSlice(
  migration,
  'drop policy if exists "f23_11e read staff document objects by center role"',
  'create or replace function public.staff_document_attachment_backend_readiness',
)
const storageInsertPolicy = sourceSlice(
  storagePolicies,
  'create policy "f23_11e insert staff document objects by pending metadata"',
  '-- F23.11E.1 intentionally creates no Storage UPDATE or DELETE policy.',
)
assert(!storageInsertPolicy.includes('a.is_primary = true'))
assert(storageInsertPolicy.includes("a.state = 'pending'"))
assert(storageInsertPolicy.includes('a.uploaded_by_user_id = auth.uid()'))
assert(!/create policy[\s\S]*?on storage\.objects[\s\S]*?for update/i.test(storagePolicies))
assert(!/create policy[\s\S]*?on storage\.objects[\s\S]*?for delete/i.test(storagePolicies))
assert(!migration.includes('getPublicUrl'))
assert(!migration.includes('public = true'))
assert(!migration.includes('grant all'))
assert(!migration.includes('grant insert on table public.center_staff_document_attachments'))
assert(!migration.includes('grant update on table public.center_staff_document_attachments'))
assert(!migration.includes('grant delete on table public.center_staff_document_attachments'))
assert(!migration.includes('create or replace function public.prepare_staff_document_attachment_upload'))
assert(!migration.includes('create or replace function public.finalize_staff_document_attachment_upload'))
assert(migration.includes('from public, anon'))
assert(migration.includes('to authenticated'))
assert(migration.includes("has_function_privilege(\n        'authenticated'"))
assert(migration.includes("not has_function_privilege(\n        'anon'"))

assert.equal(STAFF_DOCUMENT_ATTACHMENT_REPLACEMENT_SCHEMA_VERSION, 2)
const listPrimarySource = sourceSlice(
  adapterSource,
  'async function listPrimary',
  'async function listHistory',
)
assert(listPrimarySource.includes('.select(ATTACHMENT_BASE_SELECT_COLUMNS)'))
assert(!listPrimarySource.includes('ATTACHMENT_HISTORY_SELECT_COLUMNS'))

const centerId = 'center-a'
const staffMemberId = 'staff-gv001'
const administrativeProfileId = 'profile-gv001'
const documentId = 'CV-QA-001'
const currentAttachmentId = '11111111-1111-4111-8111-111111111111'
const replacementAttachmentId = '22222222-2222-4222-8222-222222222222'
const currentObjectPath = `centers/${centerId}/staff/${staffMemberId}/documents/${documentId}/${currentAttachmentId}/attachment.jpg`
const replacementObjectPath = `centers/${centerId}/staff/${staffMemberId}/documents/${documentId}/${replacementAttachmentId}/attachment.jpg`
const currentRow = createAttachmentRow({
  id: currentAttachmentId,
  objectPath: currentObjectPath,
  version: 1,
  state: 'available',
  isPrimary: true,
  originalFileName: 'current.jpg',
})
const pendingReplacementRow = createAttachmentRow({
  id: replacementAttachmentId,
  objectPath: replacementObjectPath,
  version: 2,
  state: 'pending',
  isPrimary: false,
  replacesAttachmentId: currentAttachmentId,
  originalFileName: 'replacement.jpg',
})
const finalizedReplacementRow = {
  ...pendingReplacementRow,
  state: 'available',
  is_primary: true,
}
const archivedCurrentRow = {
  ...currentRow,
  state: 'archived',
  is_primary: false,
  archived_at: '2026-07-28T03:00:00.000Z',
  archive_reason: 'replaced',
}

const backend = createMockBackend({
  historyRows: [archivedCurrentRow, finalizedReplacementRow],
  accessRows: [archivedCurrentRow, finalizedReplacementRow],
})
const service = createStaffDocumentAttachmentService({
  getClient: () => backend.client,
  getUser: async () => ({ id: 'user-owner-a' }),
  getMembership: async () => ({
    center_id: centerId,
    user_id: 'user-owner-a',
    role: 'owner',
    status: 'active',
  }),
})
const file = makeFile([0xff, 0xd8, 0xff, 0xe0], 'replacement.jpg', 'image/jpeg')
const stages = []
const beforeFinalizeCalls = []
const replacementResult = await service.replace({
  centerId,
  staffMemberId,
  administrativeProfileId,
  documentId,
  expectedCurrentAttachmentId: currentAttachmentId,
  file,
  onStage: (stage) => stages.push(stage),
  beforeFinalize: async (context) => {
    beforeFinalizeCalls.push(context)
    return true
  },
})
assert.equal(replacementResult.ok, true)
assert.equal(replacementResult.data.id, replacementAttachmentId)
assert.equal(replacementResult.data.version, 2)
assert.equal(replacementResult.data.replacesAttachmentId, currentAttachmentId)
assert.notEqual(currentObjectPath, replacementObjectPath)
assert.deepEqual(stages.map((stage) => stage.stage), ['preparing', 'uploading', 'finalizing'])
assert.equal(beforeFinalizeCalls.length, 1)
assert.equal(backend.storageCalls.length, 1)
assert.equal(backend.storageCalls[0].path, replacementObjectPath)
assert.equal(backend.storageCalls[0].options.upsert, false)
assert.deepEqual(backend.rpcCalls.map((call) => call.name).slice(0, 4), [
  'staff_document_attachment_backend_readiness',
  'staff_document_attachment_governance_readiness',
  'prepare_staff_document_attachment_replacement',
  'finalize_staff_document_attachment_replacement',
])
assert.equal(
  backend.rpcCalls.find((call) => call.name === 'prepare_staff_document_attachment_replacement')
    .args.p_expected_current_attachment_id,
  currentAttachmentId,
)
assert.equal(
  backend.rpcCalls.find((call) => call.name === 'finalize_staff_document_attachment_replacement')
    .args.p_expected_current_attachment_id,
  currentAttachmentId,
)

const historyResult = await service.listHistory({
  centerId,
  staffMemberId,
  administrativeProfileId,
  documentId,
})
assert.equal(historyResult.ok, true)
assert.deepEqual(historyResult.data.map((item) => item.version), [2, 1])
assert.deepEqual(sortStaffDocumentAttachmentHistory([
  historyResult.data[1],
  { ...historyResult.data[0], state: 'failed' },
  historyResult.data[0],
]).map((item) => item.version), [2, 1])

const archivedAccess = await service.createAccessUrl({
  centerId,
  staffMemberId,
  administrativeProfileId,
  documentId,
  attachmentId: currentAttachmentId,
  mode: 'download',
})
assert.equal(archivedAccess.ok, true)
assert.equal(backend.signedUrlCalls.at(-1).path, currentObjectPath)
assert.deepEqual(backend.signedUrlCalls.at(-1).options, { download: 'attachment.jpg' })

const staleBackend = createMockBackend({
  finalizeError: { message: 'staff_document_attachment_replacement_stale' },
})
const staleService = createService(staleBackend)
const currentSnapshot = structuredClone(currentRow)
const staleResult = await staleService.replace({
  centerId,
  staffMemberId,
  administrativeProfileId,
  documentId,
  expectedCurrentAttachmentId: currentAttachmentId,
  file,
})
assert.equal(staleResult.ok, false)
assert.equal(staleResult.code, 'replacement-stale')
assert.deepEqual(currentRow, currentSnapshot)
assert(staleBackend.rpcCalls.some((call) => (
  call.name === 'fail_staff_document_attachment_upload' &&
  call.args.p_reason_code === 'replacement-stale'
)))

const uploadFailureBackend = createMockBackend({ uploadError: true })
const uploadFailureResult = await createService(uploadFailureBackend).replace({
  centerId,
  staffMemberId,
  administrativeProfileId,
  documentId,
  expectedCurrentAttachmentId: currentAttachmentId,
  file,
})
assert.equal(uploadFailureResult.ok, false)
assert.equal(uploadFailureResult.code, 'replacement-upload-failed')
assert(!uploadFailureBackend.rpcCalls.some((call) => (
  call.name === 'finalize_staff_document_attachment_replacement'
)))

const schemaOneBackend = createMockBackend({ schemaVersion: 1 })
const schemaOneResult = await createService(schemaOneBackend).replace({
  centerId,
  staffMemberId,
  administrativeProfileId,
  documentId,
  expectedCurrentAttachmentId: currentAttachmentId,
  file,
})
assert.equal(schemaOneResult.code, 'replacement-not-ready')
assert(!schemaOneBackend.rpcCalls.some((call) => (
  call.name === 'prepare_staff_document_attachment_replacement'
)))

const mappedCurrent = historyResult.data[0]
const mappedArchived = historyResult.data[1]
const readyPanel = renderStaffDocumentAttachmentPanel({
  documentRecord: { id: documentId, archivedAt: '' },
  state: {
    status: 'ready',
    record: mappedCurrent,
    history: [mappedArchived, mappedCurrent],
    historyStatus: 'ready',
    replacementReady: true,
    isProcessing: false,
  },
})
assert(readyPanel.includes('data-staff-document-attachment-replacement-input'))
assert(readyPanel.includes('>Thay tệp<'))
assert(readyPanel.includes('Lịch sử phiên bản'))
assert(readyPanel.includes('Hiện hành'))
assert(readyPanel.includes('Đã thay thế'))
assert(readyPanel.indexOf('Phiên bản 2') < readyPanel.indexOf('Phiên bản 1'))
assert(readyPanel.includes('data-staff-document-action="attachment-version-view"'))
assert(readyPanel.includes('data-staff-document-action="attachment-version-download"'))
assert(!readyPanel.includes(currentAttachmentId))
assert(!readyPanel.includes(replacementAttachmentId))
assert(!readyPanel.includes(currentObjectPath))
assert(!readyPanel.includes(replacementObjectPath))
assert(!readyPanel.includes('Gỡ tệp'))
assert(!readyPanel.includes('Xóa tệp'))

const schemaOnePanel = renderStaffDocumentAttachmentPanel({
  documentRecord: { id: documentId, archivedAt: '' },
  state: {
    status: 'ready',
    record: mappedCurrent,
    history: [mappedCurrent],
    replacementReady: false,
  },
})
assert(!schemaOnePanel.includes('data-staff-document-attachment-replacement-input'))
assert(schemaOnePanel.includes('Thay tệp và lịch sử phiên bản hiện chưa khả dụng'))
assert(schemaOnePanel.includes('data-staff-document-action="attachment-view"'))
assert(schemaOnePanel.includes('data-staff-document-action="attachment-download"'))

const processingPanel = renderStaffDocumentAttachmentPanel({
  documentRecord: { id: documentId, archivedAt: '' },
  state: {
    status: 'uploading',
    record: mappedCurrent,
    history: [mappedCurrent],
    historyStatus: 'ready',
    replacementReady: true,
    isProcessing: true,
  },
})
assert(processingPanel.includes('Đang tải lên...'))
assert(processingPanel.includes('data-staff-document-replacement-disabled'))
assert(processingPanel.includes('data-staff-document-action="attachment-view"'))
assert(processingPanel.includes('data-staff-document-action="attachment-download"'))

const directHistory = renderStaffDocumentVersionHistory({
  documentRecord: { id: documentId },
  history: [mappedArchived, mappedCurrent, { ...mappedArchived, state: 'failed', version: 3 }],
})
assert(directHistory.indexOf('Phiên bản 2') < directHistory.indexOf('Phiên bản 1'))
assert(!directHistory.includes('Phiên bản 3'))

for (const action of [
  'staff-document.attachment-replace',
]) assert(STAFF_ADMINISTRATIVE_ACTIONS.includes(action))
for (const action of [
  'staff-document.attachment-replacement-prepared',
  'staff-document.attachment-replacement-completed',
  'staff-document.attachment-replacement-failed',
  'staff-document.attachment-version-view',
  'staff-document.attachment-version-download',
]) assert(STAFF_ADMINISTRATIVE_AUDIT_ACTIONS.includes(action))

for (const marker of [
  'Tệp mới sẽ trở thành phiên bản hiện hành.',
  'Phiên bản hiện tại vẫn được lưu trong lịch sử và có thể xem hoặc tải xuống.',
  'uploadingStaffDocumentWindowIds.has(windowId)',
  'expectedCurrentAttachmentId',
  'isStaffDocumentAttachmentFinalizeContextCurrent(captured)',
  'replacementReady',
  'listHistory',
  'attachment-version-view',
  'attachment-version-download',
  'viewer.signedUrl =',
]) assert(mainSource.includes(marker), `Missing runtime marker: ${marker}`)
const replacementHandler = sourceSlice(
  mainSource,
  'async function handleStaffDocumentAttachmentReplacement',
  'async function handleStaffDocumentAttachmentAccess',
)
assert(
  replacementHandler.indexOf('uploadingStaffDocumentWindowIds.add(windowId)') <
    replacementHandler.indexOf('await getLatestStaffAdministrativeProfileAccessContext'),
  'Double-submit guard must be acquired before the first async authorization boundary.',
)
assert(replacementHandler.includes('void loadStaffDocumentAttachment(windowId, {'))
assert(replacementHandler.includes('preserveCurrent: true'))
assert(mainSource.includes('...state.attachment'))
assert(adapterSource.includes('upsert: false'))
assert(!adapterSource.includes('upsert: true'))
assert(!adapterSource.includes('getPublicUrl'))
const replacementAdapterSource = sourceSlice(
  adapterSource,
  'async function replace',
  'async function getGovernanceSnapshot',
)
assert(!replacementAdapterSource.includes('.remove('))
assert(!adapterSource.includes('localStorage'))
assert(!adapterSource.includes('sessionStorage'))
assert(!adapterSource.includes('console.'))
assert(styles.includes('.staff-document-version-history'))
assert(governanceSource.includes('attachment-replacement-completed'))

for (const marker of [
  'F23.11E.1 DONE',
  '202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql',
  'prepare → upload → finalize',
  'không overwrite',
  'Không có Storage UPDATE/DELETE',
  'schema_version = 2',
  'Manual QA sau migration apply',
  'cả sáu migration',
  'F23.11E.2A DONE',
  'F23.11E.2B LATER',
]) assert(docs.includes(marker), `Missing docs marker: ${marker}`)

const publicSecretMarker = ['SERVICE', 'ROLE', 'KEY'].join('_')
for (const source of [migration, adapterSource, documentSource, governanceSource, mainSource, docs]) {
  assert(!source.includes(publicSecretMarker), 'Public service-role marker found.')
}
for (const source of [migration, adapterSource, documentSource, governanceSource, docs]) {
  for (const marker of createMojibakeMarkers()) {
    assert(!source.includes(marker), `Mojibake marker found: ${marker}`)
  }
}

console.log('F23.11E.1 replace/version history smoke: PASS')

function createService(backend) {
  return createStaffDocumentAttachmentService({
    getClient: () => backend.client,
    getUser: async () => ({ id: 'user-owner-a' }),
    getMembership: async () => ({
      center_id: centerId,
      user_id: 'user-owner-a',
      role: 'owner',
      status: 'active',
    }),
  })
}

function createMockBackend({
  schemaVersion = 2,
  uploadError = false,
  finalizeError = null,
  historyRows = [archivedCurrentRow, finalizedReplacementRow],
  accessRows = [archivedCurrentRow, finalizedReplacementRow],
} = {}) {
  const rpcCalls = []
  const storageCalls = []
  const signedUrlCalls = []
  const client = {
    async rpc(name, args) {
      rpcCalls.push({ name, args })
      if (name === 'staff_document_attachment_backend_readiness') {
        return { data: [{ ready: true, schema_version: schemaVersion }], error: null }
      }
      if (name === 'staff_document_attachment_governance_readiness') {
        return {
          data: [{
            soft_removal_ready: false,
            deletion_request_ready: false,
            permanent_execution_ready: false,
            blocker_code: 'server_executor_and_canonical_lifecycle_required',
          }],
          error: null,
        }
      }
      if (name === 'prepare_staff_document_attachment_replacement') {
        return { data: [pendingReplacementRow], error: null }
      }
      if (name === 'finalize_staff_document_attachment_replacement') {
        return finalizeError
          ? { data: null, error: finalizeError }
          : { data: [finalizedReplacementRow], error: null }
      }
      if (name === 'fail_staff_document_attachment_upload') {
        return { data: [{ ...pendingReplacementRow, state: 'failed' }], error: null }
      }
      return { data: null, error: { code: 'unknown-rpc' } }
    },
    from(table) {
      assert.equal(table, 'center_staff_document_attachments')
      return createQuery({ historyRows, accessRows })
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, 'staff-administrative-documents')
        return {
          async upload(storagePath, uploadFile, options) {
            storageCalls.push({ bucket, path: storagePath, file: uploadFile, options })
            return uploadError
              ? { data: null, error: { code: 'storage-upload-failed' } }
              : { data: { path: storagePath }, error: null }
          },
          async createSignedUrl(storagePath, expiresIn, options) {
            signedUrlCalls.push({ bucket, path: storagePath, expiresIn, options })
            return {
              data: { signedUrl: 'https://signed.example.invalid/short-lived-history-token' },
              error: null,
            }
          },
        }
      },
    },
  }
  return { client, rpcCalls, storageCalls, signedUrlCalls }
}

function createQuery({ historyRows, accessRows }) {
  const filters = new Map()
  const query = {
    select() { return query },
    eq(field, value) { filters.set(field, value); return query },
    is(field, value) { filters.set(field, value); return query },
    in() { return query },
    order() { return query },
    limit() { return query },
    async maybeSingle() {
      const id = filters.get('id')
      return { data: accessRows.find((row) => row.id === id) || null, error: null }
    },
    then(resolve, reject) {
      return Promise.resolve({ data: historyRows, error: null }).then(resolve, reject)
    },
  }
  return query
}

function createAttachmentRow({
  id,
  objectPath,
  version,
  state,
  isPrimary,
  replacesAttachmentId = null,
  originalFileName,
}) {
  return {
    id,
    center_id: centerId,
    staff_member_id: staffMemberId,
    administrative_profile_id: administrativeProfileId,
    document_id: documentId,
    bucket_id: 'staff-administrative-documents',
    object_path: objectPath,
    original_file_name: originalFileName,
    safe_file_name: 'attachment.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 4,
    state,
    is_primary: isPrimary,
    version,
    created_at: `2026-07-28T0${version}:00:00.000Z`,
    updated_at: `2026-07-28T0${version}:00:00.000Z`,
    archived_at: null,
    replaces_attachment_id: replacesAttachmentId,
    archive_reason: null,
  }
}

function makeFile(bytes, name, type) {
  const file = new Blob([Uint8Array.from(bytes)], { type })
  Object.defineProperty(file, 'name', { value: name })
  return file
}

function sourceSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0, `Missing source marker: ${startMarker}`)
  assert(end > start, `Missing source marker: ${endMarker}`)
  return source.slice(start, end)
}

function createMojibakeMarkers() {
  return [
    [0x43, 0x00e1, 0x00ba],
    [0x00c3],
    [0x00c6, 0x00b0],
    [0x48, 0x00e1, 0x00ba],
    [0x00e1, 0x00bb],
    [0xfffd],
  ].map((codes) => String.fromCodePoint(...codes))
}
