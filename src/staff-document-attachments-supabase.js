import { getCurrentCenterMembership, getCurrentSupabaseUser } from './supabase-auth.js'
import { getSupabaseClient } from './supabase-client.js'
import { buildStaffDocumentAttachmentObjectPath } from './staff-documents-module.js'

export const STAFF_DOCUMENT_ATTACHMENTS_BUCKET = 'staff-administrative-documents'
export const STAFF_DOCUMENT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
export const STAFF_DOCUMENT_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 180
export const STAFF_DOCUMENT_ATTACHMENT_REPLACEMENT_SCHEMA_VERSION = 2
export const STAFF_DOCUMENT_ATTACHMENT_CLEANUP_SCHEMA_VERSION = 3
export const STAFF_DOCUMENT_ATTACHMENT_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp'

export const STAFF_DOCUMENT_ATTACHMENT_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const MIME_EXTENSION_MAP = Object.freeze({
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
})
const ALLOWED_ROLE_SET = new Set(['owner', 'center_admin'])
const ATTACHMENT_BASE_SELECT_COLUMNS = [
  'id',
  'center_id',
  'staff_member_id',
  'administrative_profile_id',
  'document_id',
  'original_file_name',
  'safe_file_name',
  'mime_type',
  'size_bytes',
  'state',
  'is_primary',
  'version',
  'created_at',
  'updated_at',
  'archived_at',
].join(', ')
const ATTACHMENT_HISTORY_V2_SELECT_COLUMNS = [
  ATTACHMENT_BASE_SELECT_COLUMNS,
  'replaces_attachment_id',
  'archive_reason',
].join(', ')
const ATTACHMENT_HISTORY_V3_SELECT_COLUMNS = [
  ATTACHMENT_HISTORY_V2_SELECT_COLUMNS,
  'removed_at',
  'removal_reason',
  'deleted_at',
  'deletion_request_id',
].join(', ')

export function validateStaffDocumentAttachmentFile(file) {
  if (!file || typeof file !== 'object') {
    return failure('file-missing', 'Vui lòng chọn một tệp để tải lên.')
  }

  const mimeType = normalizeText(file.type).toLowerCase()
  const sizeBytes = Number(file.size)
  const originalFileName = normalizeFileName(file.name)
  const extension = getFileExtension(originalFileName)

  if (!STAFF_DOCUMENT_ATTACHMENT_MIME_TYPES.includes(mimeType)) {
    return failure(
      'mime-not-allowed',
      'Chỉ chấp nhận PDF, JPEG, PNG hoặc WebP.',
    )
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return failure('file-empty', 'Tệp đã chọn đang rỗng hoặc không đọc được.')
  }
  if (sizeBytes > STAFF_DOCUMENT_ATTACHMENT_MAX_BYTES) {
    return failure('file-too-large', 'Tệp không được lớn hơn 10 MiB.')
  }
  if (!originalFileName || !MIME_EXTENSION_MAP[mimeType].includes(extension)) {
    return failure(
      'extension-mismatch',
      'Phần mở rộng của tệp không khớp với định dạng được phép.',
    )
  }
  if (typeof file.slice !== 'function') {
    return failure('file-unreadable', 'Không thể đọc tệp đã chọn.')
  }

  return success({ file, mimeType, sizeBytes, originalFileName })
}

export async function validateStaffDocumentAttachmentSignature(file, mimeType) {
  try {
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    const valid = mimeType === 'application/pdf'
      ? hasBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
      : mimeType === 'image/jpeg'
        ? hasBytes(bytes, [0xff, 0xd8, 0xff])
        : mimeType === 'image/png'
          ? hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
          : mimeType === 'image/webp'
            ? hasAscii(bytes, 0, 'RIFF') && hasAscii(bytes, 8, 'WEBP')
            : false

    return valid
      ? success({ mimeType })
      : failure(
          'signature-mismatch',
          'Nội dung tệp không khớp với định dạng đã khai báo.',
        )
  } catch {
    return failure('file-unreadable', 'Không thể đọc tệp đã chọn.')
  }
}

export function createStaffDocumentAttachmentService({
  getClient = getSupabaseClient,
  getUser = getCurrentSupabaseUser,
  getMembership = getCurrentCenterMembership,
} = {}) {
  async function authorize(centerId) {
    const normalizedCenterId = normalizeText(centerId)
    const client = getClient()
    if (!client) {
      return failure(
        'not-configured',
        'Kho tệp riêng tư chưa được cấu hình.',
      )
    }
    if (!normalizedCenterId) {
      return failure('center-missing', 'Chưa xác định được cơ sở hiện tại.')
    }

    try {
      const user = await getUser()
      if (!user?.id) return unauthorizedFailure()
      const membership = await getMembership(user.id, normalizedCenterId)
      const membershipCenterId = normalizeText(
        membership?.center_id ?? membership?.centerId,
      )
      const membershipUserId = normalizeText(
        membership?.user_id ?? membership?.userId,
      )
      const membershipStatus = normalizeText(membership?.status).toLowerCase()
      const role = normalizeRole(membership?.role)
      if (
        !membership ||
        membershipCenterId !== normalizedCenterId ||
        (membershipUserId && membershipUserId !== user.id) ||
        membershipStatus !== 'active' ||
        !ALLOWED_ROLE_SET.has(role)
      ) return unauthorizedFailure()
      return success({ client, user, membership, role, centerId: normalizedCenterId })
    } catch {
      return failure(
        'authorization-unavailable',
        'Không thể xác minh quyền truy cập kho tệp riêng tư.',
      )
    }
  }

  async function checkReadiness({ centerId } = {}) {
    const authorization = await authorize(centerId)
    if (!authorization.ok) return authorization
    try {
      const { data, error } = await authorization.data.client.rpc(
        'staff_document_attachment_backend_readiness',
        { p_center_id: authorization.data.centerId },
      )
      if (error) {
        return success({
          ready: false,
          reason: 'migration-not-applied',
          schemaVersion: 0,
          softRemovalReady: false,
          deletionRequestReady: false,
          permanentExecutionReady: false,
          governanceBlocker: 'migration-not-applied',
        })
      }
      const row = getSingleRow(data)
      const ready = row === true || row?.ready === true
      const schemaVersion = Number(row?.schema_version ?? row?.schemaVersion ?? 0)
      let governance = null
      if (ready && schemaVersion >= STAFF_DOCUMENT_ATTACHMENT_REPLACEMENT_SCHEMA_VERSION) {
        const governanceResult = await authorization.data.client.rpc(
          'staff_document_attachment_governance_readiness',
          { p_center_id: authorization.data.centerId },
        )
        if (!governanceResult.error) governance = getSingleRow(governanceResult.data)
      }
      return success({
        ready,
        reason: ready ? '' : 'backend-not-ready',
        schemaVersion,
        softRemovalReady: governance?.soft_removal_ready === true,
        deletionRequestReady: governance?.deletion_request_ready === true,
        permanentExecutionReady: governance?.permanent_execution_ready === true,
        governanceBlocker: normalizeText(
          governance?.blocker_code || 'server_executor_and_canonical_lifecycle_required',
        ),
      })
    } catch {
      return failure(
        'connection-failed',
        'Không thể kết nối kho tệp riêng tư.',
      )
    }
  }

  async function authorizeCleanup(
    centerId,
    { ownerOnly = false, capability = 'deletion-request' } = {},
  ) {
    const authorization = await authorize(centerId)
    if (!authorization.ok) return authorization
    if (ownerOnly && authorization.data.role !== 'owner') {
      return failure(
        'owner-required',
        'Chỉ Owner đang hoạt động của cơ sở mới được thực hiện thao tác này.',
      )
    }
    const readiness = await checkReadiness({ centerId: authorization.data.centerId })
    if (!readiness.ok) return readiness
    const capabilityReady = {
      'soft-removal': readiness.data.softRemovalReady,
      'deletion-request': readiness.data.deletionRequestReady,
      'permanent-execution': readiness.data.permanentExecutionReady,
    }[capability] === true
    if (!readiness.data.ready || !capabilityReady) {
      const permanentBlocked = capability === 'permanent-execution'
      return failure(
        permanentBlocked ? 'server-executor-required' : 'cleanup-not-ready',
        permanentBlocked
          ? 'Xóa vĩnh viễn cần server executor và nguồn vòng đời nhân sự canonical được duyệt.'
          : capability === 'deletion-request'
            ? 'Yêu cầu xóa vĩnh viễn đang khóa đến khi có vòng đời nhân sự canonical phía máy chủ.'
            : 'Chức năng gỡ tệp đang chờ migration F23.11E.2.',
      )
    }
    return success({ ...authorization.data, schemaVersion: readiness.data.schemaVersion })
  }

  async function listPrimary({
    centerId,
    staffMemberId,
    administrativeProfileId,
    documentId,
  } = {}) {
    const chain = normalizeIdentityChain({
      centerId,
      staffMemberId,
      administrativeProfileId,
      documentId,
    })
    if (!chain.ok) return chain
    const authorization = await authorize(chain.data.centerId)
    if (!authorization.ok) return authorization

    try {
      const { data, error } = await authorization.data.client
        .from('center_staff_document_attachments')
        .select(ATTACHMENT_BASE_SELECT_COLUMNS)
        .eq('center_id', chain.data.centerId)
        .eq('staff_member_id', chain.data.staffMemberId)
        .eq('administrative_profile_id', chain.data.administrativeProfileId)
        .eq('document_id', chain.data.documentId)
        .eq('is_primary', true)
        .is('archived_at', null)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) {
        return failure(
          'metadata-read-failed',
          'Không thể đọc trạng thái tệp từ kho riêng tư.',
        )
      }
      return success(data ? mapAttachment(data) : null)
    } catch {
      return failure(
        'connection-failed',
        'Không thể kết nối kho tệp riêng tư.',
      )
    }
  }

  async function listHistory({
    centerId,
    staffMemberId,
    administrativeProfileId,
    documentId,
    includeCleanupColumns = false,
  } = {}) {
    const chain = normalizeIdentityChain({
      centerId,
      staffMemberId,
      administrativeProfileId,
      documentId,
    })
    if (!chain.ok) return chain
    const authorization = await authorize(chain.data.centerId)
    if (!authorization.ok) return authorization

    try {
      const { data, error } = await authorization.data.client
        .from('center_staff_document_attachments')
        .select(
          includeCleanupColumns
            ? ATTACHMENT_HISTORY_V3_SELECT_COLUMNS
            : ATTACHMENT_HISTORY_V2_SELECT_COLUMNS,
        )
        .eq('center_id', chain.data.centerId)
        .eq('staff_member_id', chain.data.staffMemberId)
        .eq('administrative_profile_id', chain.data.administrativeProfileId)
        .eq('document_id', chain.data.documentId)
        .in(
          'state',
          includeCleanupColumns
            ? ['available', 'archived', 'deleted']
            : ['available', 'archived'],
        )
        .order('version', { ascending: false })
      if (error) {
        return failure(
          'history-read-failed',
          'Không thể đọc lịch sử phiên bản từ kho riêng tư.',
        )
      }
      return success(sortStaffDocumentAttachmentHistory(
        (Array.isArray(data) ? data : []).map(mapAttachment),
      ))
    } catch {
      return failure(
        'connection-failed',
        'Không thể kết nối kho tệp riêng tư.',
      )
    }
  }

  async function upload({
    centerId,
    staffMemberId,
    administrativeProfileId,
    documentId,
    file,
    onStage = () => {},
    beforeFinalize = async () => true,
  } = {}) {
    const chain = normalizeIdentityChain({
      centerId,
      staffMemberId,
      administrativeProfileId,
      documentId,
    })
    if (!chain.ok) return chain
    const fileValidation = validateStaffDocumentAttachmentFile(file)
    if (!fileValidation.ok) return fileValidation
    const signatureValidation = await validateStaffDocumentAttachmentSignature(
      file,
      fileValidation.data.mimeType,
    )
    if (!signatureValidation.ok) return signatureValidation

    const authorization = await authorize(chain.data.centerId)
    if (!authorization.ok) return authorization
    const readiness = await checkReadiness({ centerId: chain.data.centerId })
    if (!readiness.ok) return readiness
    if (!readiness.data.ready) {
      return failure(
        'backend-not-ready',
        'Kho tệp riêng tư chưa sẵn sàng.',
      )
    }

    const client = authorization.data.client
    let prepared = null
    try {
      onStage({ stage: 'preparing', attachmentId: '' })
      const prepareResult = await client.rpc(
        'prepare_staff_document_attachment_upload',
        {
          p_center_id: chain.data.centerId,
          p_staff_member_id: chain.data.staffMemberId,
          p_administrative_profile_id: chain.data.administrativeProfileId,
          p_document_id: chain.data.documentId,
          p_original_file_name: fileValidation.data.originalFileName,
          p_mime_type: fileValidation.data.mimeType,
          p_size_bytes: fileValidation.data.sizeBytes,
        },
      )
      if (prepareResult.error) {
        return failure(
          'prepare-failed',
          'Không thể chuẩn bị lượt tải tệp an toàn.',
        )
      }
      prepared = getSingleRow(prepareResult.data)
      const attachmentId = normalizeText(prepared?.attachment_id ?? prepared?.id)
      const objectPath = normalizeText(prepared?.object_path)
      const bucketId = normalizeText(prepared?.bucket_id)
      const safeFileName = normalizeText(prepared?.safe_file_name)
      const expectedPath = buildStaffDocumentAttachmentObjectPath({
        centerId: chain.data.centerId,
        staffMemberId: chain.data.staffMemberId,
        documentId: chain.data.documentId,
        attachmentId,
        safeFileName,
      })
      if (
        !attachmentId ||
        bucketId !== STAFF_DOCUMENT_ATTACHMENTS_BUCKET ||
        !safeFileName ||
        !expectedPath ||
        objectPath !== expectedPath
      ) {
        if (attachmentId) {
          await markFailed(client, chain.data.centerId, attachmentId, 'prepare-response-invalid')
        }
        return failure(
          'prepare-invalid',
          'Backend trả về định danh lượt tải không hợp lệ.',
          { attachmentId },
        )
      }

      onStage({ stage: 'uploading', attachmentId })
      const uploadResult = await client.storage
        .from(STAFF_DOCUMENT_ATTACHMENTS_BUCKET)
        .upload(objectPath, file, {
          contentType: fileValidation.data.mimeType,
          upsert: false,
        })
      if (uploadResult.error) {
        await markFailed(client, chain.data.centerId, attachmentId, 'storage-upload-failed')
        return failure(
          'upload-failed',
          'Tải tệp lên kho riêng tư thất bại.',
          { attachmentId },
        )
      }

      if (!(await beforeFinalize({ attachmentId }))) {
        await markFailed(client, chain.data.centerId, attachmentId, 'stale-local-context')
        return failure(
          'stale-context',
          'Tài liệu đã thay đổi trong khi tải tệp; metadata không được hoàn tất.',
          { attachmentId },
        )
      }

      onStage({ stage: 'finalizing', attachmentId })
      const finalizeResult = await client.rpc(
        'finalize_staff_document_attachment_upload',
        {
          p_center_id: chain.data.centerId,
          p_attachment_id: attachmentId,
        },
      )
      if (finalizeResult.error) {
        await markFailed(client, chain.data.centerId, attachmentId, 'finalize-failed')
        return failure(
          'finalize-failed',
          'Tệp đã gửi nhưng chưa thể hoàn tất metadata an toàn.',
          { attachmentId },
        )
      }
      const finalized = getSingleRow(finalizeResult.data)
      if (!finalized || normalizeText(finalized.state) !== 'available') {
        await markFailed(client, chain.data.centerId, attachmentId, 'finalize-invalid')
        return failure(
          'finalize-invalid',
          'Backend chưa xác nhận tệp ở trạng thái sẵn sàng.',
          { attachmentId },
        )
      }
      return success(mapAttachment(finalized))
    } catch {
      const attachmentId = normalizeText(prepared?.attachment_id ?? prepared?.id)
      if (attachmentId) {
        await markFailed(
          authorization.data.client,
          chain.data.centerId,
          attachmentId,
          'unexpected-upload-failure',
        )
      }
      return failure(
        'connection-failed',
        'Không thể kết nối kho tệp riêng tư.',
        { attachmentId },
      )
    }
  }

  async function replace({
    centerId,
    staffMemberId,
    administrativeProfileId,
    documentId,
    expectedCurrentAttachmentId,
    file,
    onStage = () => {},
    beforeFinalize = async () => true,
  } = {}) {
    const chain = normalizeIdentityChain({
      centerId,
      staffMemberId,
      administrativeProfileId,
      documentId,
    })
    if (!chain.ok) return chain
    const currentAttachmentId = normalizeText(expectedCurrentAttachmentId)
    if (!currentAttachmentId) {
      return failure('attachment-missing', 'Không xác định được phiên bản hiện hành.')
    }
    const fileValidation = validateStaffDocumentAttachmentFile(file)
    if (!fileValidation.ok) return fileValidation
    const signatureValidation = await validateStaffDocumentAttachmentSignature(
      file,
      fileValidation.data.mimeType,
    )
    if (!signatureValidation.ok) return signatureValidation

    const authorization = await authorize(chain.data.centerId)
    if (!authorization.ok) return authorization
    const readiness = await checkReadiness({ centerId: chain.data.centerId })
    if (!readiness.ok) return readiness
    if (
      !readiness.data.ready ||
      readiness.data.schemaVersion < STAFF_DOCUMENT_ATTACHMENT_REPLACEMENT_SCHEMA_VERSION
    ) {
      return failure(
        'replacement-not-ready',
        'Chức năng Thay tệp đang chờ migration F23.11E.1.',
      )
    }

    const client = authorization.data.client
    let prepared = null
    try {
      onStage({ stage: 'preparing', attachmentId: '', version: 0 })
      const prepareResult = await client.rpc(
        'prepare_staff_document_attachment_replacement',
        {
          p_center_id: chain.data.centerId,
          p_staff_member_id: chain.data.staffMemberId,
          p_administrative_profile_id: chain.data.administrativeProfileId,
          p_document_id: chain.data.documentId,
          p_expected_current_attachment_id: currentAttachmentId,
          p_original_file_name: fileValidation.data.originalFileName,
          p_mime_type: fileValidation.data.mimeType,
          p_size_bytes: fileValidation.data.sizeBytes,
        },
      )
      if (prepareResult.error) {
        return getReplacementRpcFailure(
          prepareResult.error,
          'replacement-prepare-failed',
          'Không thể chuẩn bị phiên bản thay thế an toàn.',
        )
      }

      prepared = getSingleRow(prepareResult.data)
      const attachmentId = normalizeText(prepared?.attachment_id ?? prepared?.id)
      const objectPath = normalizeText(prepared?.object_path)
      const bucketId = normalizeText(prepared?.bucket_id)
      const safeFileName = normalizeText(prepared?.safe_file_name)
      const replacesAttachmentId = normalizeText(prepared?.replaces_attachment_id)
      const version = Number(prepared?.version ?? 0)
      const expectedPath = buildStaffDocumentAttachmentObjectPath({
        centerId: chain.data.centerId,
        staffMemberId: chain.data.staffMemberId,
        documentId: chain.data.documentId,
        attachmentId,
        safeFileName,
      })
      if (
        !attachmentId ||
        attachmentId === currentAttachmentId ||
        replacesAttachmentId !== currentAttachmentId ||
        prepared?.is_primary !== false ||
        version < 2 ||
        bucketId !== STAFF_DOCUMENT_ATTACHMENTS_BUCKET ||
        !safeFileName ||
        !expectedPath ||
        objectPath !== expectedPath
      ) {
        if (attachmentId) {
          await markFailed(client, chain.data.centerId, attachmentId, 'replacement-prepare-invalid')
        }
        return failure(
          'replacement-prepare-invalid',
          'Backend trả về định danh phiên bản thay thế không hợp lệ.',
          { attachmentId },
        )
      }

      onStage({ stage: 'uploading', attachmentId, version })
      const uploadResult = await client.storage
        .from(STAFF_DOCUMENT_ATTACHMENTS_BUCKET)
        .upload(objectPath, file, {
          contentType: fileValidation.data.mimeType,
          upsert: false,
        })
      if (uploadResult.error) {
        await markFailed(client, chain.data.centerId, attachmentId, 'replacement-upload-failed')
        return failure(
          'replacement-upload-failed',
          'Tải phiên bản mới lên kho riêng tư thất bại; phiên bản hiện hành không đổi.',
          { attachmentId },
        )
      }

      if (!(await beforeFinalize({
        attachmentId,
        expectedCurrentAttachmentId: currentAttachmentId,
        version,
      }))) {
        await markFailed(client, chain.data.centerId, attachmentId, 'replacement-stale-local')
        return failure(
          'replacement-stale',
          'Tài liệu đã thay đổi trong khi tải; phiên bản hiện hành không bị thay thế.',
          { attachmentId },
        )
      }

      onStage({ stage: 'finalizing', attachmentId, version })
      const finalizeResult = await client.rpc(
        'finalize_staff_document_attachment_replacement',
        {
          p_center_id: chain.data.centerId,
          p_replacement_attachment_id: attachmentId,
          p_expected_current_attachment_id: currentAttachmentId,
        },
      )
      if (finalizeResult.error) {
        const mapped = getReplacementRpcFailure(
          finalizeResult.error,
          'replacement-finalize-failed',
          'Phiên bản mới đã gửi nhưng chưa thể chuyển thành hiện hành.',
          { attachmentId },
        )
        await markFailed(
          client,
          chain.data.centerId,
          attachmentId,
          mapped.code === 'replacement-stale'
            ? 'replacement-stale'
            : 'replacement-finalize-failed',
        )
        return mapped
      }

      const finalized = getSingleRow(finalizeResult.data)
      if (
        !finalized ||
        normalizeText(finalized.state) !== 'available' ||
        finalized.is_primary !== true ||
        normalizeText(finalized.replaces_attachment_id) !== currentAttachmentId
      ) {
        await markFailed(client, chain.data.centerId, attachmentId, 'replacement-finalize-invalid')
        return failure(
          'replacement-finalize-invalid',
          'Backend chưa xác nhận phiên bản mới là hiện hành.',
          { attachmentId },
        )
      }
      return success(mapAttachment(finalized))
    } catch {
      const attachmentId = normalizeText(prepared?.attachment_id ?? prepared?.id)
      if (attachmentId) {
        await markFailed(
          authorization.data.client,
          chain.data.centerId,
          attachmentId,
          'replacement-unexpected-failure',
        )
      }
      return failure(
        'connection-failed',
        'Không thể kết nối kho tệp riêng tư; phiên bản hiện hành không đổi.',
        { attachmentId },
      )
    }
  }

  async function getGovernanceSnapshot({
    centerId,
    staffMemberId,
    administrativeProfileId,
    documentId,
  } = {}) {
    const chain = normalizeIdentityChain({
      centerId,
      staffMemberId,
      administrativeProfileId,
      documentId,
    })
    if (!chain.ok) return chain
    const authorization = await authorizeCleanup(chain.data.centerId)
    if (!authorization.ok) return authorization
    try {
      const { data, error } = await authorization.data.client.rpc(
        'staff_document_attachment_governance_snapshot',
        {
          p_center_id: chain.data.centerId,
          p_document_id: chain.data.documentId,
        },
      )
      if (error) {
        return getCleanupRpcFailure(
          error,
          'governance-read-failed',
          'Không thể đọc trạng thái lưu trữ và xóa tệp.',
        )
      }
      return success(mapGovernanceSnapshot(getSingleRow(data)))
    } catch {
      return connectionFailure()
    }
  }

  async function removeFromDocument({
    centerId,
    attachmentId,
    expectedCurrentAttachmentId,
    reasonCode = 'user_requested',
  } = {}) {
    const normalizedCenterId = normalizeStableId(centerId)
    const normalizedAttachmentId = normalizeUuid(attachmentId)
    const normalizedExpectedId = normalizeUuid(expectedCurrentAttachmentId)
    if (!normalizedCenterId || !normalizedAttachmentId || !normalizedExpectedId) {
      return failure('identity-invalid', 'Phiên bản tệp hiện hành không hợp lệ.')
    }
    const authorization = await authorizeCleanup(normalizedCenterId, {
      capability: 'soft-removal',
    })
    if (!authorization.ok) return authorization
    const result = await callCleanupRpc(authorization.data.client, {
      name: 'remove_staff_document_attachment_from_document',
      args: {
        p_center_id: normalizedCenterId,
        p_attachment_id: normalizedAttachmentId,
        p_expected_current_attachment_id: normalizedExpectedId,
        p_reason_code: normalizeReasonCode(reasonCode, 'user_requested'),
      },
      fallbackCode: 'removal-failed',
      fallbackMessage: 'Không thể gỡ phiên bản hiện hành khỏi tài liệu.',
    })
    return result.ok ? success(mapAttachment(result.data)) : result
  }

  async function requestDeletion({
    centerId,
    attachmentId,
    reasonCode = 'user_requested',
  } = {}) {
    return runDeletionRequestMutation({
      centerId,
      attachmentId,
      ownerOnly: false,
      name: 'request_staff_document_attachment_deletion',
      args: { p_reason_code: normalizeReasonCode(reasonCode, 'user_requested') },
      fallbackCode: 'deletion-request-failed',
      fallbackMessage: 'Không thể tạo yêu cầu xóa vĩnh viễn.',
    })
  }

  async function approveDeletion({ centerId, requestId } = {}) {
    return runDeletionRequestMutation({
      centerId,
      requestId,
      ownerOnly: true,
      name: 'approve_staff_document_attachment_deletion',
      args: { p_reason_code: 'owner_approved' },
      fallbackCode: 'deletion-approval-failed',
      fallbackMessage: 'Không thể phê duyệt yêu cầu xóa.',
    })
  }

  async function rejectDeletion({ centerId, requestId } = {}) {
    return runDeletionRequestMutation({
      centerId,
      requestId,
      ownerOnly: true,
      name: 'reject_staff_document_attachment_deletion',
      args: { p_reason_code: 'owner_rejected' },
      fallbackCode: 'deletion-rejection-failed',
      fallbackMessage: 'Không thể từ chối yêu cầu xóa.',
    })
  }

  async function cancelDeletion({ centerId, requestId, owner = false } = {}) {
    return runDeletionRequestMutation({
      centerId,
      requestId,
      ownerOnly: false,
      name: 'cancel_staff_document_attachment_deletion',
      args: { p_reason_code: owner ? 'owner_canceled' : 'requester_canceled' },
      fallbackCode: 'deletion-cancel-failed',
      fallbackMessage: 'Không thể hủy yêu cầu xóa.',
    })
  }

  async function placeLegalHold({ centerId, attachmentId } = {}) {
    return runLegalHoldMutation({
      centerId,
      attachmentId,
      name: 'place_staff_document_attachment_legal_hold',
      reasonCode: 'legal_requirement',
      fallbackCode: 'legal-hold-place-failed',
      fallbackMessage: 'Không thể đặt legal hold cho phiên bản.',
    })
  }

  async function releaseLegalHold({ centerId, attachmentId } = {}) {
    return runLegalHoldMutation({
      centerId,
      attachmentId,
      name: 'release_staff_document_attachment_legal_hold',
      reasonCode: 'hold_released',
      fallbackCode: 'legal-hold-release-failed',
      fallbackMessage: 'Không thể giải phóng legal hold.',
    })
  }

  async function runDeletionRequestMutation({
    centerId,
    attachmentId = '',
    requestId = '',
    ownerOnly,
    name,
    args,
    fallbackCode,
    fallbackMessage,
  }) {
    const normalizedCenterId = normalizeStableId(centerId)
    const normalizedAttachmentId = attachmentId ? normalizeUuid(attachmentId) : ''
    const normalizedRequestId = requestId ? normalizeUuid(requestId) : ''
    if (
      !normalizedCenterId ||
      (attachmentId && !normalizedAttachmentId) ||
      (requestId && !normalizedRequestId)
    ) return failure('identity-invalid', 'Yêu cầu xóa không hợp lệ.')
    const authorization = await authorizeCleanup(normalizedCenterId, { ownerOnly })
    if (!authorization.ok) return authorization
    const result = await callCleanupRpc(authorization.data.client, {
      name,
      args: {
        p_center_id: normalizedCenterId,
        ...(normalizedAttachmentId ? { p_attachment_id: normalizedAttachmentId } : {}),
        ...(normalizedRequestId ? { p_request_id: normalizedRequestId } : {}),
        ...args,
      },
      fallbackCode,
      fallbackMessage,
    })
    return result.ok ? success(mapDeletionRequest(result.data)) : result
  }

  async function runLegalHoldMutation({
    centerId,
    attachmentId,
    name,
    reasonCode,
    fallbackCode,
    fallbackMessage,
  }) {
    const normalizedCenterId = normalizeStableId(centerId)
    const normalizedAttachmentId = normalizeUuid(attachmentId)
    if (!normalizedCenterId || !normalizedAttachmentId) {
      return failure('identity-invalid', 'Phiên bản legal hold không hợp lệ.')
    }
    const authorization = await authorizeCleanup(normalizedCenterId, { ownerOnly: true })
    if (!authorization.ok) return authorization
    const result = await callCleanupRpc(authorization.data.client, {
      name,
      args: {
        p_center_id: normalizedCenterId,
        p_attachment_id: normalizedAttachmentId,
        p_reason_code: reasonCode,
      },
      fallbackCode,
      fallbackMessage,
    })
    return result.ok ? success(mapLegalHold(result.data)) : result
  }

  async function executeDeletion({
    centerId,
    staffMemberId,
    administrativeProfileId,
    documentId,
    requestId,
    attachmentId,
  } = {}) {
    const chain = normalizeIdentityChain({
      centerId,
      staffMemberId,
      administrativeProfileId,
      documentId,
    })
    if (!chain.ok) return chain
    if (!normalizeUuid(requestId) || !normalizeUuid(attachmentId)) {
      return failure('identity-invalid', 'Lượt xóa tệp không hợp lệ.')
    }
    const authorization = await authorizeCleanup(chain.data.centerId, {
      ownerOnly: true,
      capability: 'permanent-execution',
    })
    if (!authorization.ok) return authorization
    return failure(
      'server-executor-required',
      'Xóa vĩnh viễn đang khóa: cần server executor và nguồn vòng đời nhân sự canonical được duyệt.',
    )
  }

  async function createAccessUrl({
    centerId,
    staffMemberId,
    administrativeProfileId,
    documentId,
    attachmentId,
    mode = 'preview',
  } = {}) {
    const chain = normalizeIdentityChain({
      centerId,
      staffMemberId,
      administrativeProfileId,
      documentId,
    })
    if (!chain.ok) return chain
    const normalizedAttachmentId = normalizeText(attachmentId)
    if (!normalizedAttachmentId) {
      return failure('attachment-missing', 'Không xác định được tệp cần truy cập.')
    }
    const authorization = await authorize(chain.data.centerId)
    if (!authorization.ok) return authorization

    try {
      const client = authorization.data.client
      const { data, error } = await client
        .from('center_staff_document_attachments')
        .select(
          'id, center_id, staff_member_id, administrative_profile_id, document_id, bucket_id, object_path, safe_file_name, mime_type, state, is_primary, archived_at',
        )
        .eq('id', normalizedAttachmentId)
        .eq('center_id', chain.data.centerId)
        .eq('staff_member_id', chain.data.staffMemberId)
        .eq('administrative_profile_id', chain.data.administrativeProfileId)
        .eq('document_id', chain.data.documentId)
        .maybeSingle()
      const isCurrent = data?.state === 'available' && data?.is_primary === true && !data?.archived_at
      const isArchived = data?.state === 'archived' && data?.is_primary === false && Boolean(data?.archived_at)
      if (
        error ||
        !data ||
        data.bucket_id !== STAFF_DOCUMENT_ATTACHMENTS_BUCKET ||
        (!isCurrent && !isArchived)
      ) {
        return failure('attachment-unavailable', 'Tệp không còn sẵn sàng để truy cập.')
      }

      const options = mode === 'download'
        ? { download: normalizeText(data.safe_file_name) || 'staff-document' }
        : undefined
      const signedResult = await client.storage
        .from(STAFF_DOCUMENT_ATTACHMENTS_BUCKET)
        .createSignedUrl(
          data.object_path,
          STAFF_DOCUMENT_ATTACHMENT_SIGNED_URL_TTL_SECONDS,
          options,
        )
      if (signedResult.error || !signedResult.data?.signedUrl) {
        return failure('signed-url-failed', 'Không thể tạo quyền truy cập tệp ngắn hạn.')
      }
      return success({
        signedUrl: signedResult.data.signedUrl,
        expiresIn: STAFF_DOCUMENT_ATTACHMENT_SIGNED_URL_TTL_SECONDS,
        mimeType: normalizeText(data.mime_type),
        safeFileName: normalizeText(data.safe_file_name),
      })
    } catch {
      return failure(
        'connection-failed',
        'Không thể kết nối kho tệp riêng tư.',
      )
    }
  }

  return Object.freeze({
    checkReadiness,
    listPrimary,
    listHistory,
    upload,
    replace,
    getGovernanceSnapshot,
    removeFromDocument,
    requestDeletion,
    approveDeletion,
    rejectDeletion,
    cancelDeletion,
    placeLegalHold,
    releaseLegalHold,
    executeDeletion,
    createAccessUrl,
  })
}

export const staffDocumentAttachmentService = createStaffDocumentAttachmentService()

async function markFailed(client, centerId, attachmentId, reasonCode) {
  try {
    await client.rpc('fail_staff_document_attachment_upload', {
      p_center_id: centerId,
      p_attachment_id: attachmentId,
      p_reason_code: reasonCode,
    })
  } catch {
    // The original failure remains authoritative; never expose raw backend errors.
  }
}

async function callCleanupRpc(client, {
  name,
  args,
  fallbackCode,
  fallbackMessage,
}) {
  try {
    const { data, error } = await client.rpc(name, args)
    if (error) return getCleanupRpcFailure(error, fallbackCode, fallbackMessage)
    const row = getSingleRow(data)
    return row
      ? success(row)
      : failure(fallbackCode, fallbackMessage)
  } catch {
    return connectionFailure()
  }
}

function normalizeIdentityChain(values = {}) {
  const data = {
    centerId: normalizeStableId(values.centerId),
    staffMemberId: normalizeStableId(values.staffMemberId),
    administrativeProfileId: normalizeStableId(values.administrativeProfileId),
    documentId: normalizeStableId(values.documentId),
  }
  const missing = Object.entries(data).find(([, value]) => !value)
  return missing
    ? failure('identity-invalid', 'Liên kết định danh tài liệu không hợp lệ.')
    : success(data)
}

function normalizeStableId(value) {
  const normalized = normalizeText(value)
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/.test(normalized)
    ? normalized
    : ''
}

function normalizeUuid(value) {
  const normalized = normalizeText(value).toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : ''
}

function normalizeDate(value) {
  const normalized = normalizeText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return ''
  const date = new Date(`${normalized}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized
    ? ''
    : normalized
}

function normalizeReasonCode(value, fallback) {
  const normalized = normalizeText(value).toLowerCase()
  return /^[a-z0-9][a-z0-9._-]{0,79}$/.test(normalized) ? normalized : fallback
}

function normalizeFileName(value) {
  const normalized = normalizeText(value).replace(/^.*[\\/]/, '')
  return normalized && normalized !== '.' && normalized !== '..'
    ? normalized.slice(0, 240)
    : ''
}

function normalizeRole(value) {
  const normalized = normalizeText(value).toLowerCase().replace(/[\s-]+/g, '_')
  return normalized === 'admin' ? 'center_admin' : normalized
}

function normalizeText(value) {
  if (value === null || value === undefined || typeof value === 'object') return ''
  return String(value).trim()
}

function getFileExtension(fileName) {
  const match = normalizeText(fileName).toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] || ''
}

function hasBytes(bytes, expected, offset = 0) {
  return expected.every((byte, index) => bytes[offset + index] === byte)
}

function hasAscii(bytes, offset, expected) {
  return [...expected].every(
    (character, index) => bytes[offset + index] === character.charCodeAt(0),
  )
}

function getSingleRow(data) {
  return Array.isArray(data) ? data[0] || null : data || null
}

function mapAttachment(row = {}) {
  return {
    id: normalizeText(row.id ?? row.attachment_id),
    centerId: normalizeText(row.center_id),
    staffMemberId: normalizeText(row.staff_member_id),
    administrativeProfileId: normalizeText(row.administrative_profile_id),
    documentId: normalizeText(row.document_id),
    originalFileName: normalizeText(row.original_file_name),
    safeFileName: normalizeText(row.safe_file_name),
    mimeType: normalizeText(row.mime_type),
    sizeBytes: Number(row.size_bytes ?? 0),
    state: normalizeText(row.state),
    isPrimary: row.is_primary === true,
    version: Number(row.version ?? 1),
    createdAt: normalizeText(row.created_at),
    updatedAt: normalizeText(row.updated_at),
    archivedAt: normalizeText(row.archived_at),
    replacesAttachmentId: normalizeText(row.replaces_attachment_id),
    archiveReason: normalizeText(row.archive_reason),
    removedAt: normalizeText(row.removed_at),
    removalReason: normalizeText(row.removal_reason),
    deletedAt: normalizeText(row.deleted_at),
    deletionRequestId: normalizeText(row.deletion_request_id),
  }
}

function mapDeletionRequest(row = {}) {
  return {
    id: normalizeText(row.id),
    attachmentId: normalizeText(row.attachment_id),
    status: normalizeText(row.status),
    reasonCode: normalizeText(row.reason_code),
    requestedByUserId: normalizeText(row.requested_by_user_id),
    requestedAt: normalizeText(row.requested_at),
    eligibleAfter: normalizeText(row.eligible_after),
    approvedByUserId: normalizeText(row.approved_by_user_id),
    approvedAt: normalizeText(row.approved_at),
    rejectedAt: normalizeText(row.rejected_at),
    canceledAt: normalizeText(row.canceled_at),
    executionStartedAt: normalizeText(row.execution_started_at),
    executionExpiresAt: normalizeText(row.execution_expires_at),
    completedAt: normalizeText(row.completed_at),
    failureReason: normalizeText(row.failure_reason),
    canExecute: row.can_execute === true || row.canExecute === true,
    revision: Number(row.revision ?? 0),
  }
}

function mapLegalHold(row = {}) {
  return {
    attachmentId: normalizeText(row.attachment_id),
    status: normalizeText(row.status),
    reasonCode: normalizeText(row.reason_code),
    placedAt: normalizeText(row.placed_at),
    releasedAt: normalizeText(row.released_at),
  }
}

function mapGovernanceSnapshot(value) {
  const row = value && typeof value === 'object' ? value : {}
  const retention = row.retention && typeof row.retention === 'object'
    ? row.retention
    : {}
  return {
    viewerRole: normalizeRole(row.viewer_role ?? row.viewerRole),
    viewerUserId: normalizeText(row.viewer_user_id ?? row.viewerUserId),
    retention: {
      configured: retention.configured === true,
      eligibleAfter: normalizeText(retention.eligible_after ?? retention.eligibleAfter),
      eligibleNow: retention.eligible_now === true || retention.eligibleNow === true,
    },
    requests: (Array.isArray(row.requests) ? row.requests : []).map(mapDeletionRequest),
    holds: (Array.isArray(row.holds) ? row.holds : []).map(mapLegalHold),
  }
}

export function sortStaffDocumentAttachmentHistory(attachments = []) {
  return (Array.isArray(attachments) ? attachments : [])
    .filter((attachment) => {
      const current = attachment?.state === 'available' && attachment?.isPrimary === true
      const archived = attachment?.state === 'archived' && attachment?.isPrimary === false
      const deleted = attachment?.state === 'deleted' && attachment?.isPrimary === false
      return current || archived || deleted
    })
    .sort((left, right) => Number(right.version || 0) - Number(left.version || 0))
}

function isFutureIsoDateTime(value) {
  const timestamp = Date.parse(normalizeText(value))
  return Number.isFinite(timestamp) && timestamp > Date.now()
}

function getCleanupRpcFailure(error, fallbackCode, fallbackMessage) {
  const marker = [error?.code, error?.message, error?.details, error?.hint]
    .map(normalizeText)
    .join(' ')
    .toLowerCase()
  const known = [
    ['removal_stale', 'removal-stale', 'Phiên bản hiện hành đã thay đổi. Hãy tải lại trạng thái tài liệu.'],
    ['self_approval_denied', 'self-approval-denied', 'Người tạo yêu cầu không được tự phê duyệt.'],
    ['legal_hold_active', 'legal-hold-active', 'Không thể xóa khi legal hold đang hoạt động.'],
    ['retention_not_configured', 'retention-not-configured', 'Chưa xác nhận mốc retention phía máy chủ.'],
    ['retention_not_eligible', 'retention-not-eligible', 'Phiên bản chưa đủ điều kiện lưu trữ để thực thi xóa.'],
    ['deletion_request_active', 'deletion-request-active', 'Phiên bản đang có một yêu cầu xóa còn hiệu lực.'],
    ['deletion_execution_in_progress', 'deletion-in-progress', 'Một Owner khác đang thực thi yêu cầu xóa.'],
    ['deletion_execution_expired', 'deletion-execution-expired', 'Capability xóa đã hết hạn; hãy thử lại.'],
    ['deletion_execution_stale', 'deletion-execution-stale', 'Lượt xóa không còn hiệu lực.'],
    ['deletion_request_stale', 'deletion-request-stale', 'Trạng thái yêu cầu xóa đã thay đổi.'],
    ['deletion_not_archived', 'deletion-not-archived', 'Chỉ phiên bản không còn hiện hành mới được yêu cầu xóa.'],
    ['object_still_present', 'object-still-present', 'Object vẫn còn trong kho riêng tư; tombstone chưa được ghi.'],
    ['owner_access_denied', 'owner-required', 'Chỉ Owner đang hoạt động của cơ sở mới được thực hiện thao tác này.'],
    ['access_denied', 'unauthorized', 'Bạn không có quyền thực hiện thao tác này.'],
  ]
  const matched = known.find(([needle]) => marker.includes(`staff_document_attachment_${needle}`))
  return matched
    ? failure(matched[1], matched[2])
    : failure(fallbackCode, fallbackMessage)
}

function connectionFailure(message = 'Không thể kết nối kho tệp riêng tư.') {
  return failure('connection-failed', message)
}

function getReplacementRpcFailure(error, fallbackCode, fallbackMessage, extra = {}) {
  const marker = [error?.code, error?.message, error?.details, error?.hint]
    .map(normalizeText)
    .join(' ')
    .toLowerCase()
  if (marker.includes('staff_document_attachment_replacement_stale')) {
    return failure(
      'replacement-stale',
      'Phiên bản hiện hành đã thay đổi; lượt thay tệp này không được áp dụng.',
      extra,
    )
  }
  if (marker.includes('staff_document_attachment_replacement_in_progress')) {
    return failure(
      'replacement-in-progress',
      'Một lượt thay tệp khác đang được xử lý cho tài liệu này.',
      extra,
    )
  }
  return failure(fallbackCode, fallbackMessage, extra)
}

function unauthorizedFailure() {
  return failure(
    'unauthorized',
    'Bạn không có quyền truy cập tệp này.',
  )
}

function success(data) {
  return { ok: true, data, error: '', code: '' }
}

function failure(code, error, extra = {}) {
  return {
    ok: false,
    data: null,
    error: String(error || 'Không thể xử lý tệp.'),
    code: String(code || 'unknown'),
    ...extra,
  }
}
