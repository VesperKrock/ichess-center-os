import { sanitizeCloudPayload } from './cloud-db-entities.js'

export const AUTHORITATIVE_CORE_CONTRACT_VERSION = 1
export const AUTHORITATIVE_CORE_SOURCE_VERSION = 'c5.1-authoritative-core-v1'
export const AUTHORITATIVE_CORE_ENTITY_TYPES = Object.freeze([
  'student',
  'teacher',
  'class_session',
  'schedule_session',
])

const AUTHORITATIVE_CORE_ENTITY_TYPE_SET = new Set(AUTHORITATIVE_CORE_ENTITY_TYPES)

export function isAuthoritativeCoreEntityType(entityType) {
  return AUTHORITATIVE_CORE_ENTITY_TYPE_SET.has(String(entityType || '').trim())
}

export function getAuthoritativeCoreVersion(entity) {
  const value = Number(entity?.cloudVersion)
  return Number.isSafeInteger(value) && value > 0 ? value : 0
}

export function createCoreCommandIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  throw new Error('Trình duyệt không hỗ trợ crypto.randomUUID cho lệnh lưu dùng chung.')
}

export function projectAuthoritativeCoreRecord(record = {}) {
  const payload = record?.payload

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  const entityVersion = Number(record.entity_version)

  if (!Number.isSafeInteger(entityVersion) || entityVersion < 1) {
    return null
  }

  return {
    ...payload,
    cloudVersion: entityVersion,
    cloudUpdatedAt: String(record.updated_at || ''),
    cloudDeletedAt: String(record.deleted_at || ''),
  }
}

export function projectAuthoritativeCoreResult(result = {}) {
  if (!result?.ok || result.outcome_code !== 'COMMITTED') {
    return null
  }

  return projectAuthoritativeCoreRecord({
    payload: result.payload,
    entity_version: result.entity_version,
    updated_at: result.updated_at,
    deleted_at: result.deleted_at,
  })
}

export async function mutateAuthoritativeCoreEntity({
  supabase,
  centerId,
  entityType,
  entity,
  localId = entity?.id || entity?.localId,
  expectedVersion = getAuthoritativeCoreVersion(entity),
  idempotencyKey = createCoreCommandIdempotencyKey(),
  operation = 'UPSERT',
} = {}) {
  const normalizedCenterId = String(centerId || '').trim()
  const normalizedEntityType = String(entityType || '').trim()
  const normalizedLocalId = String(localId || '').trim()
  const normalizedOperation = String(operation || '').trim().toUpperCase()

  if (!supabase || typeof supabase.rpc !== 'function') {
    return { ok: false, outcome_code: 'CLIENT_NOT_READY', error: 'Thiếu Supabase client.' }
  }

  if (!normalizedCenterId) {
    return { ok: false, outcome_code: 'INVALID_CENTER', error: 'Thiếu center_id.' }
  }

  if (!isAuthoritativeCoreEntityType(normalizedEntityType)) {
    return { ok: false, outcome_code: 'INVALID_ENTITY_TYPE', error: 'Sai loại dữ liệu dùng chung.' }
  }

  if (!normalizedLocalId) {
    return { ok: false, outcome_code: 'INVALID_LOCAL_ID', error: 'Thiếu mã dữ liệu.' }
  }

  const payload = normalizedOperation === 'DELETE' ? {} : sanitizeCloudPayload(entity)
  const { data, error } = await supabase.rpc('c5_1_mutate_core_entity', {
    p_center_id: normalizedCenterId,
    p_entity_type: normalizedEntityType,
    p_local_id: normalizedLocalId,
    p_expected_version: Number(expectedVersion),
    p_payload: payload,
    p_idempotency_key: idempotencyKey,
    p_operation: normalizedOperation,
  })

  if (error) {
    return {
      ok: false,
      outcome_code: 'SERVER_COMMAND_FAILED',
      error: String(error.message || error),
      detail: error,
    }
  }

  if (!data?.ok) {
    return {
      ...data,
      ok: false,
      error: getAuthoritativeCoreOutcomeMessage(data?.outcome_code),
    }
  }

  const committedEntity = normalizedOperation === 'DELETE'
    ? null
    : projectAuthoritativeCoreResult(data)

  if (normalizedOperation !== 'DELETE' && !committedEntity) {
    return {
      ok: false,
      outcome_code: 'INVALID_SERVER_RESULT',
      error: getAuthoritativeCoreOutcomeMessage('INVALID_SERVER_RESULT'),
    }
  }

  return {
    ...data,
    ok: true,
    entity: committedEntity,
    idempotencyKey,
  }
}

export function getAuthoritativeCoreOutcomeMessage(outcomeCode) {
  const messages = {
    NOT_AUTHENTICATED: 'Phiên đăng nhập không hợp lệ. Dữ liệu chưa được lưu.',
    INVALID_CENTER: 'Cơ sở không hợp lệ. Dữ liệu chưa được lưu.',
    CENTER_ACCESS_DENIED: 'Tài khoản không còn quyền tại cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Vai trò hiện tại chỉ được xem, không được sửa dữ liệu dùng chung.',
    INVALID_ENTITY_TYPE: 'Loại dữ liệu không thuộc C5.1.',
    INVALID_LOCAL_ID: 'Mã dữ liệu không hợp lệ.',
    INVALID_IDEMPOTENCY_KEY: 'Không tạo được khóa chống gửi trùng.',
    INVALID_COMMAND: 'Lệnh lưu không hợp lệ.',
    INVALID_PAYLOAD: 'Dữ liệu gửi lên không hợp lệ hoặc quá lớn.',
    PAYLOAD_ID_MISMATCH: 'Mã trong dữ liệu không khớp lệnh lưu.',
    ENTITY_NOT_FOUND: 'Dữ liệu không còn tồn tại trên server.',
    VERSION_CONFLICT: 'Dữ liệu đã được tài khoản khác cập nhật. Hãy tải lại trước khi lưu.',
    IDEMPOTENCY_CONFLICT: 'Khóa gửi lại đã được dùng cho một thay đổi khác.',
    CONCURRENT_CONFLICT: 'Có thay đổi đồng thời. Hãy tải lại và thử lại.',
    INVALID_SERVER_RESULT: 'Server trả về kết quả không hợp lệ; cache chưa được thay đổi.',
    SERVER_COMMAND_FAILED: 'Không thể lưu lên server; cache chưa được thay đổi.',
  }

  return messages[String(outcomeCode || '')] || 'Không thể lưu dữ liệu dùng chung.'
}
