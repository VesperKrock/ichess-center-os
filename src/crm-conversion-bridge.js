import { getSupabaseClient } from './supabase-client.js'

const functionName = 'crm-conversion-bridge'
const storagePrefix = 'ichess.crmConversionProjection.v1'
const finiteMessages = {
  AUTH_REQUIRED: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
  CENTER_ACCESS_DENIED: 'Tài khoản không có quyền tại cơ sở đang chọn.',
  ROLE_NOT_ALLOWED: 'Vai trò hiện tại không được thực hiện bước này.',
  STEP_UP_REQUIRED: 'Cần xác thực TOTP mới trong vòng 2 phút.',
  P4B_ACTOR_SEPARATION_REQUIRED: 'Người duyệt cuối phải khác tư vấn viên phụ trách.',
  P4B_IDEMPOTENCY_CONFLICT: 'Nội dung đã thay đổi so với lần gửi trước. Hãy tải lại trạng thái.',
  P4B_STATE_STALE: 'Dữ liệu chuyển đổi không còn mới. Hãy tải lại trạng thái.',
  P4B_SOURCE_STALE: 'Nguồn tư vấn đã thay đổi. Cần rà soát lại trước khi chuyển đổi.',
  P4B_RESOURCE_NOT_AVAILABLE: 'Không tìm thấy phiên chuyển đổi hợp lệ tại cơ sở này.',
  P4B_OPERATION_FAILED: 'Không thể hoàn tất thao tác an toàn. Vui lòng thử lại hoặc tải trạng thái.',
  INVALID_REQUEST: 'Dữ liệu gửi lên chưa hợp lệ.',
}

const opaqueToken = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
const storageKey = (centerId, sourceRecordId) => `${storagePrefix}:${centerId}:${sourceRecordId}`

function assertClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('SUPABASE_NOT_CONFIGURED')
  return client
}

async function errorCode(error) {
  const context = error?.context
  if (context instanceof Response) {
    try { return String((await context.clone().json())?.code || 'P4B_OPERATION_FAILED') } catch { /* safe fallback */ }
  }
  const body = context && typeof context === 'object' ? context : null
  return String(body?.code || error?.code || 'P4B_OPERATION_FAILED')
}

async function invoke(body) {
  const { data, error } = await assertClient().functions.invoke(functionName, { body })
  if (error || !data?.ok) {
    const code = String(data?.code || await errorCode(error))
    const bridgeError = new Error(finiteMessages[code] || finiteMessages.P4B_OPERATION_FAILED)
    bridgeError.code = code
    throw bridgeError
  }
  return data
}

function readEnvelope(centerId, sourceRecordId) {
  if (!globalThis.sessionStorage || !centerId || !sourceRecordId) return null
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(centerId, sourceRecordId)) || 'null')
    return value?.schemaVersion === 1 && value.centerId === centerId && value.sourceRecordId === sourceRecordId
      ? value
      : null
  } catch {
    return null
  }
}

function writeEnvelope(centerId, sourceRecordId, result, tokens = {}) {
  const previous = readEnvelope(centerId, sourceRecordId)
  const value = {
    schemaVersion: 1,
    centerId,
    sourceRecordId,
    bridgeSessionId: result.bridge_session_id || previous?.bridgeSessionId || '',
    bridgeVersion: result.bridge_version || previous?.bridgeVersion || 0,
    status: result.status || previous?.status || '',
    prepareKey: tokens.prepareKey || previous?.prepareKey || opaqueToken(),
    reviewKey: tokens.reviewKey || previous?.reviewKey || opaqueToken(),
    executeKey: tokens.executeKey || previous?.executeKey || opaqueToken(),
    safeProjection: result.projection || result.result?.projection || previous?.safeProjection || null,
    updatedAt: new Date().toISOString(),
  }
  globalThis.sessionStorage?.setItem(storageKey(centerId, sourceRecordId), JSON.stringify(value))
  return value
}

export function getStoredConversionEnvelope(centerId, sourceRecordId) {
  return readEnvelope(centerId, sourceRecordId)
}

export async function prepareCanonicalConversion({ centerId, contact, birthDate }) {
  const previous = readEnvelope(centerId, contact.id)
  const prepareKey = previous?.prepareKey || opaqueToken()
  const result = await invoke({
    operation: 'prepare',
    center_id: centerId,
    idempotency_key: prepareKey,
    source_record_id: String(contact.id || ''),
    guardian_display_name: String(contact.parentName || contact.name || ''),
    phones: [contact.phone, contact.secondaryPhone].map(String).filter(Boolean),
    emails: [contact.email].map(String).filter(Boolean),
    student_display_name: String(contact.leadStudentName || contact.studentName || ''),
    student_birth_date: birthDate,
    learning_need_summary: String(contact.leadNeed || contact.lastNote || ''),
    preferred_schedule_summary: String(contact.preferredSchedule || ''),
  })
  return { result, envelope: writeEnvelope(centerId, contact.id, result, { prepareKey }) }
}

export async function reviewCanonicalConversion({ centerId, sourceRecordId, envelope, decisions }) {
  const reviewKey = envelope.reviewKey || opaqueToken()
  const result = await invoke({
    operation: 'review',
    center_id: centerId,
    idempotency_key: reviewKey,
    bridge_session_id: envelope.bridgeSessionId,
    expected_bridge_version: envelope.bridgeVersion,
    student_decision: decisions.student.decision,
    student_opaque_target_id: decisions.student.targetId || null,
    student_expected_target_version: decisions.student.targetVersion || null,
    guardian_decision: decisions.guardian.decision,
    guardian_opaque_target_id: decisions.guardian.targetId || null,
    guardian_expected_target_version: decisions.guardian.targetVersion || null,
    relationship_decision: decisions.relationshipDecision,
  })
  return { result, envelope: writeEnvelope(centerId, sourceRecordId, result, { reviewKey }) }
}

export async function listVerifiedTotpFactors() {
  const { data, error } = await assertClient().auth.mfa.listFactors()
  if (error) throw error
  return (data?.totp || []).filter((factor) => factor.status === 'verified')
}

export async function verifyFreshTotp({ factorId, code }) {
  if (!factorId || !/^\d{6}$/.test(String(code || ''))) {
    const error = new Error('Nhập mã TOTP gồm 6 chữ số.')
    error.code = 'STEP_UP_REQUIRED'
    throw error
  }
  const { data, error } = await assertClient().auth.mfa.challengeAndVerify({ factorId, code: String(code) })
  if (error || !data?.access_token) {
    const stepError = new Error(finiteMessages.STEP_UP_REQUIRED)
    stepError.code = 'STEP_UP_REQUIRED'
    throw stepError
  }
  return data
}

export async function approveAndExecuteCanonicalConversion({ centerId, sourceRecordId, envelope }) {
  const executeKey = envelope.executeKey || opaqueToken()
  const result = await invoke({
    operation: 'approve_execute',
    center_id: centerId,
    idempotency_key: executeKey,
    bridge_session_id: envelope.bridgeSessionId,
    expected_bridge_version: envelope.bridgeVersion,
  })
  return { result, envelope: writeEnvelope(centerId, sourceRecordId, result, { executeKey }) }
}

export async function refreshCanonicalConversion({ centerId, sourceRecordId, envelope }) {
  const result = await invoke({
    operation: 'status',
    center_id: centerId,
    bridge_session_id: envelope.bridgeSessionId,
  })
  return { result, envelope: writeEnvelope(centerId, sourceRecordId, result) }
}

export function toLegacyStudentProjection(safeProjection) {
  const student = safeProjection?.student
  if (!student?.canonical_id) return null
  return {
    id: `canonical:${student.canonical_id}`,
    canonicalId: student.canonical_id,
    fullName: student.display_name || 'Học viên canonical',
    name: student.display_name || 'Học viên canonical',
    currentStatus: student.status === 'ACTIVE' ? 'Đang theo học' : student.status,
    status: student.status,
    source: 'canonical-projection',
    readOnlyProjection: true,
    projectionVersion: student.version,
    guardianProjection: safeProjection.guardian || null,
    relationshipProjection: safeProjection.relationship || null,
  }
}

export function listLegacyStudentProjections(centerId) {
  if (!globalThis.sessionStorage || !centerId) return []
  const prefix = `${storagePrefix}:${centerId}:`
  const projections = []
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index) || ''
    if (!key.startsWith(prefix)) continue
    try {
      const envelope = JSON.parse(sessionStorage.getItem(key) || 'null')
      const projection = toLegacyStudentProjection(envelope?.safeProjection)
      if (projection) projections.push(projection)
    } catch {
      // A damaged local cache is ignored; server status remains authoritative.
    }
  }
  return Array.from(new Map(projections.map((item) => [item.canonicalId, item])).values())
}

export const crmConversionBridgeErrorMessage = (error) =>
  finiteMessages[error?.code] || error?.message || finiteMessages.P4B_OPERATION_FAILED
