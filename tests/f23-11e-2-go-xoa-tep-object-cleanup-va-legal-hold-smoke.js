import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createStaffDocumentAttachmentService,
  sortStaffDocumentAttachmentHistory,
} from '../src/staff-document-attachments-supabase.js'
import { renderStaffDocumentAttachmentPanel } from '../src/staff-documents-module.js'

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

const migrationPath = 'supabase/migrations/202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql'
const migration = read(migrationPath)
const adapterSource = read('src/staff-document-attachments-supabase.js')
const documentSource = read('src/staff-documents-module.js')
const mainSource = read('src/main.js')
const report = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')
const migrationNames = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .filter((name) => /^202607280003.*f23_11e_2/.test(name))
assert.deepEqual(migrationNames, [path.basename(migrationPath)])
assert(Number(path.basename(migrationPath).split('_')[0]) > 202607280002)

// Canonical lifecycle is absent, so retention and permanent execution stay fail closed.
assert(!migration.includes('center_staff_document_attachment_retention_subjects'))
assert(!migration.includes('configure_staff_document_attachment_retention_subject'))
const retentionHelper = sourceSlice(
  migration,
  'create or replace function public.staff_document_attachment_retention_eligible_at',
  'create or replace function public.remove_staff_document_attachment_from_document',
)
for (const marker of [
  'public.can_manage_staff_document_attachments(p_center_id)',
  'a.id = p_attachment_id',
  'a.center_id = p_center_id',
  'return null',
  'from public, anon, authenticated',
]) assert(retentionHelper.includes(marker), `Retention helper missing: ${marker}`)
assert(!retentionHelper.includes('employment_ended_on'))
assert(!migration.includes('grant execute on function public.staff_document_attachment_retention_eligible_at'))
assert(migration.includes('eligible_after timestamptz null'))
assert(migration.includes('NULL remains permanently ineligible for execution'))

// Browser DELETE cannot bind a nonce; migration intentionally leaves DELETE/UPDATE closed.
assert(migration.includes('drop policy if exists "f23_11e_2 delete exact staff document object by execution"'))
assert(!migration.includes('create policy "f23_11e_2 delete exact staff document object by execution"'))
assert(!/on storage\.objects\s+for delete/i.test(migration))
assert(!/on storage\.objects\s+for update/i.test(migration))
assert(!/delete\s+from\s+storage\.objects/i.test(migration))
assert(!migration.includes('public = true'))
assert(!migration.includes('create or replace function public.prepare_staff_document_attachment_deletion_execution'))
assert(!migration.includes('create or replace function public.fail_staff_document_attachment_deletion_execution'))
assert(!migration.includes('create or replace function public.finalize_staff_document_attachment_deletion_execution'))
assert(!migration.includes('grant execute on function public.prepare_staff_document_attachment_deletion_execution'))
assert(migration.includes('No prepare/fail/finalize deletion RPC is created'))

// Soft removal remains atomic and does not touch Storage.
const removeSql = sourceSlice(
  migration,
  'create or replace function public.remove_staff_document_attachment_from_document',
  'create or replace function public.request_staff_document_attachment_deletion',
)
for (const marker of [
  'pg_advisory_xact_lock',
  'p_expected_current_attachment_id',
  "state = 'archived'",
  'is_primary = false',
  "archive_reason = 'removed'",
  'staff_document_attachment_removal_stale',
]) assert(removeSql.includes(marker), `Soft removal missing: ${marker}`)
assert(!removeSql.includes('storage.objects'))
assert(!removeSql.includes('delete from'))

// Legal hold serializes on the document, invalidates an in-flight request and clears old capability data.
const holdSql = sourceSlice(
  migration,
  'create or replace function public.place_staff_document_attachment_legal_hold',
  'create or replace function public.release_staff_document_attachment_legal_hold',
)
for (const marker of [
  "hashtextextended(p_center_id || ':' || v_attachment.document_id, 0)",
  'from public.center_staff_document_attachments a',
  'for update',
  "r.status in ('requested', 'approved', 'executing')",
  "v_request.status = 'executing'",
  "status = 'failed'",
  'execution_started_by_user_id = null',
  'execution_started_at = null',
  'execution_expires_at = null',
  'execution_nonce = null',
  "failure_reason = 'legal_hold_placed'",
  "v_request_from_status, 'failed', 'legal_hold_placed'",
  'staff_document_attachment_object_missing_finalize_required',
]) assert(holdSql.includes(marker), `Legal hold invalidation missing: ${marker}`)
assert(migration.includes("status = 'failed'\n        and failure_reason is not null\n        and execution_started_by_user_id is null"))
const releaseSql = sourceSlice(
  migration,
  'create or replace function public.release_staff_document_attachment_legal_hold',
  'create or replace function public.staff_document_attachment_governance_snapshot',
)
assert(releaseSql.includes("status = 'released'"))
assert(releaseSql.includes('never changes a failed request'))
assert(!releaseSql.includes('execution_nonce ='))
assert(!releaseSql.includes("status = 'executing'"))

// Readiness is truthful: keep base schema v2 and expose independent capabilities.
assert(!migration.includes('create or replace function public.staff_document_attachment_backend_readiness'))
const readinessSql = sourceSlice(
  migration,
  'create or replace function public.staff_document_attachment_governance_readiness',
  "notify pgrst, 'reload schema'",
)
for (const marker of [
  'soft_removal_ready boolean',
  'deletion_request_ready boolean',
  'permanent_execution_ready boolean',
  "'public.request_staff_document_attachment_deletion(text,uuid,text)'",
  "'public.staff_document_attachment_governance_snapshot(text,text)'",
  "'server_executor_and_canonical_lifecycle_required'::text",
]) assert(readinessSql.includes(marker), `Governance readiness missing: ${marker}`)

// Runtime regression: request/review may proceed, while browser permanent DELETE stays blocked.
const centerId = 'center-a'
const attachmentId = '11111111-1111-4111-8111-111111111111'
const requestId = '22222222-2222-4222-8222-222222222222'
const archivedRow = attachmentRow({
  id: attachmentId,
  state: 'archived',
  isPrimary: false,
  version: 2,
  archiveReason: 'removed',
})
const backend = createBackend()
const service = createService(backend)
const readiness = await service.checkReadiness({ centerId })
assert.equal(readiness.ok, true)
assert.equal(readiness.data.schemaVersion, 2)
assert.equal(readiness.data.softRemovalReady, true)
assert.equal(readiness.data.deletionRequestReady, true)
assert.equal(readiness.data.permanentExecutionReady, false)

const removed = await service.removeFromDocument({
  centerId,
  attachmentId,
  expectedCurrentAttachmentId: attachmentId,
})
assert.equal(removed.ok, true)
assert.equal(removed.data.state, 'archived')
assert(backend.rpcCalls.some((call) => call.name === 'remove_staff_document_attachment_from_document'))

const deletionRequest = await service.requestDeletion({ centerId, attachmentId })
assert.equal(deletionRequest.ok, true)
assert.equal(deletionRequest.data.status, 'requested')
assert(backend.rpcCalls.some((call) => call.name === 'request_staff_document_attachment_deletion'))

const execution = await service.executeDeletion({
  centerId,
  staffMemberId: 'staff-001',
  administrativeProfileId: 'profile-001',
  documentId: 'document-001',
  requestId,
  attachmentId,
})
assert.equal(execution.code, 'server-executor-required')
assert(!backend.rpcCalls.some((call) => call.name.includes('deletion_execution')))
assert.equal(backend.storageAccesses, 0)

const adminService = createService(backend, { userId: 'admin-a', role: 'center_admin' })
assert.equal((await adminService.requestDeletion({ centerId, attachmentId })).ok, true)
assert.equal((await adminService.executeDeletion({
  centerId,
  staffMemberId: 'staff-001',
  administrativeProfileId: 'profile-001',
  documentId: 'document-001',
  requestId,
  attachmentId,
})).code, 'owner-required')
assert.equal((await createService(backend, { role: 'teacher' }).requestDeletion({
  centerId,
  attachmentId,
})).code, 'unauthorized')
assert.equal((await createService(backend, { memberCenterId: 'center-b' }).requestDeletion({
  centerId,
  attachmentId,
})).code, 'unauthorized')

assert(!adapterSource.includes('.remove([objectPath])'))
assert(!adapterSource.includes('configureRetentionSubject'))
assert(!adapterSource.includes('prepare_staff_document_attachment_deletion_execution'))
assert(!adapterSource.includes('finalize_staff_document_attachment_deletion_execution'))
assert(adapterSource.includes('server-executor-required'))
assert(adapterSource.includes('softRemovalReady'))
assert(adapterSource.includes('deletionRequestReady'))
assert(adapterSource.includes('permanentExecutionReady'))
assert(!mainSource.includes('canConfigureRetention'))
assert(!mainSource.includes('employmentEndedOn: context.staffMember'))
assert(!mainSource.includes('retention-configure'))

// UI keeps soft removal/history but hides all permanent-delete controls.
const current = attachmentRow({
  id: '44444444-4444-4444-8444-444444444444',
  state: 'available',
  isPrimary: true,
  version: 3,
})
const currentPanel = renderStaffDocumentAttachmentPanel({
  documentRecord: { id: 'document-001', archivedAt: '' },
  state: {
    status: 'ready',
    record: current,
    history: [current, archivedRow],
    historyStatus: 'ready',
    replacementReady: true,
    softRemovalReady: true,
    deletionGovernanceReady: true,
    permanentExecutionReady: false,
    governanceBlocker: 'server executor và lifecycle canonical chưa sẵn sàng',
    governance: {
      viewerRole: 'owner',
      viewerUserId: 'owner-a',
      retention: { configured: false },
      requests: [],
      holds: [],
    },
  },
})
assert(currentPanel.includes('Gỡ khỏi tài liệu'))
assert(currentPanel.includes('thực thi xóa vẫn khóa'))
assert(currentPanel.includes('Đã gỡ'))
assert(currentPanel.includes('attachment-version-view'))
assert(currentPanel.includes('attachment-version-download'))
assert(currentPanel.includes('Yêu cầu xóa vĩnh viễn'))
assert(currentPanel.includes('Đặt legal hold'))
for (const forbidden of [
  '>Phê duyệt</button>',
  '>Thực thi xóa</button>',
  'Xác nhận mốc lưu trữ',
]) assert(!currentPanel.includes(forbidden), `Unsafe UI exposed: ${forbidden}`)

assert.deepEqual(
  sortStaffDocumentAttachmentHistory([current, archivedRow]).map((row) => row.version),
  [3, 2],
)
assert(documentSource.includes('deletionGovernanceReady'))
assert(documentSource.includes('permanentExecutionReady'))
assert(report.includes('NEEDS REVIEW - F23.11E.2 PERMANENT DELETE REQUIRES APPROVED SERVER-SIDE EXECUTION'))
assert(report.includes('NEEDS REVIEW - CANONICAL SERVER-SIDE EMPLOYMENT LIFECYCLE REQUIRED'))
assert(!adapterSource.includes('getPublicUrl'))
assert(!adapterSource.includes('service' + '_role'))
assert(!mainSource.includes('viewer.objectPath'))
assert(!mainSource.includes('viewer.executionNonce'))

console.log('F23.11E.2.1 retention/legal-hold/delete-execution audit smoke: PASS')

function createService(backend, {
  userId = 'owner-a',
  role = 'owner',
  status = 'active',
  memberCenterId = centerId,
} = {}) {
  return createStaffDocumentAttachmentService({
    getClient: () => backend.client,
    getUser: async () => ({ id: userId }),
    getMembership: async () => ({
      center_id: memberCenterId,
      user_id: userId,
      role,
      status,
    }),
  })
}

function createBackend() {
  const rpcCalls = []
  let storageAccesses = 0
  return {
    rpcCalls,
    get storageAccesses() {
      return storageAccesses
    },
    client: {
      async rpc(name, args) {
        rpcCalls.push({ name, args })
        if (name === 'staff_document_attachment_backend_readiness') {
          return { data: [{ ready: true, schema_version: 2 }], error: null }
        }
        if (name === 'staff_document_attachment_governance_readiness') {
          return {
            data: [{
              soft_removal_ready: true,
              deletion_request_ready: true,
              permanent_execution_ready: false,
              blocker_code: 'server_executor_and_canonical_lifecycle_required',
            }],
            error: null,
          }
        }
        if (name === 'remove_staff_document_attachment_from_document') {
          return { data: [toDatabaseRow(archivedRow)], error: null }
        }
        if (name === 'request_staff_document_attachment_deletion') {
          return {
            data: [{
              id: requestId,
              attachment_id: attachmentId,
              status: 'requested',
              reason_code: 'user_requested',
              requested_by_user_id: 'owner-a',
              requested_at: '2026-07-29T00:00:00.000Z',
              eligible_after: null,
              revision: 1,
            }],
            error: null,
          }
        }
        return { data: null, error: { code: 'unexpected-rpc' } }
      },
      get storage() {
        storageAccesses += 1
        throw new Error('Storage must not be touched by removal/permanent execution audit path')
      },
    },
  }
}

function attachmentRow({ id, state, isPrimary, version, archiveReason = '' }) {
  return {
    id,
    centerId,
    staffMemberId: 'staff-001',
    administrativeProfileId: 'profile-001',
    documentId: 'document-001',
    originalFileName: 'private-contract.pdf',
    safeFileName: 'attachment.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 4096,
    state,
    isPrimary,
    version,
    createdAt: '2026-07-28T05:00:00.000Z',
    archivedAt: state === 'archived' ? '2026-07-28T06:00:00.000Z' : '',
    archiveReason,
    removedAt: archiveReason === 'removed' ? '2026-07-28T06:00:00.000Z' : '',
    removalReason: archiveReason === 'removed' ? 'user_requested' : '',
  }
}

function toDatabaseRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      value,
    ]),
  )
}

function sourceSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0, `Missing source marker: ${startMarker}`)
  assert(end > start, `Missing source marker: ${endMarker}`)
  return source.slice(start, end)
}
