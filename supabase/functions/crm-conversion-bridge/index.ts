import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>

const FUNCTION_NAME = 'crm-conversion-bridge'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OPERATIONS = new Set(['prepare', 'review', 'approve_execute', 'status'])
const FORBIDDEN_FIELDS = new Set([
  'actor_user_id', 'actor_id', 'role', 'reviewed', 'approved', 'step_up', 'aal',
  'verified_at', 'authority', 'authority_id', 'action_list', 'action_graph_digest',
  'intent_digest', 'environment_fingerprint', 'lookup_digest', 'ciphertext',
  'service_role_key', 'verification_reference_digest', 'account_evidence_digest',
])

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
}

function respond(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function fail(status: number, code: string) {
  return respond(status, { ok: false, code })
}

function safeLog(step: string, code: string) {
  console.error(JSON.stringify({ function: FUNCTION_NAME, step, code }))
}

function bearer(req: Request) {
  return req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || ''
}

async function bodyOf(req: Request): Promise<JsonRecord | null> {
  try {
    const value = await req.json()
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
  } catch {
    return null
  }
}

function stringOf(body: JsonRecord, key: string, max = 240) {
  const value = typeof body[key] === 'string' ? String(body[key]).trim() : ''
  return value && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : ''
}

function optionalString(body: JsonRecord, key: string, max = 1000) {
  const value = typeof body[key] === 'string' ? String(body[key]).trim() : ''
  return value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) ? value : ''
}

function integerOf(body: JsonRecord, key: string) {
  const value = body[key]
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null
}

function nullableUuid(body: JsonRecord, key: string) {
  const value = body[key]
  if (value === null || value === undefined || value === '') return null
  return typeof value === 'string' && UUID.test(value) ? value : undefined
}

function stringArray(body: JsonRecord, key: string) {
  const value = body[key]
  if (!Array.isArray(value) || value.length > 5 || value.some((item) => typeof item !== 'string')) return null
  return value.map((item) => String(item))
}

function hasForbidden(body: JsonRecord) {
  return Object.keys(body).some((key) => FORBIDDEN_FIELDS.has(key))
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

async function sha256(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
}

function decodeJwtPayload(token: string): JsonRecord | null {
  try {
    const raw = token.split('.')[1]
    if (!raw) return null
    const normalized = raw.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded))
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as JsonRecord : null
  } catch {
    return null
  }
}

function safeDbCode(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || '')
  const finite = [
    'P4B_ACCESS_DENIED', 'P4B_ACTOR_SEPARATION_REQUIRED', 'P4B_IDEMPOTENCY_CONFLICT',
    'P4B_STATE_STALE', 'P4B_SOURCE_STALE', 'P4B_STEP_UP_REQUIRED',
    'P4B_ENVIRONMENT_MISMATCH', 'P4B_EXACT_CENTER_AMBIGUOUS',
    'P4B_RESOURCE_NOT_AVAILABLE', 'P4B_MATCH_SEARCH_UNAVAILABLE',
  ].find((code) => message.includes(code))
  return finite || 'P4B_OPERATION_FAILED'
}

function statusFor(code: string) {
  if (code === 'P4B_ACCESS_DENIED' || code === 'P4B_ACTOR_SEPARATION_REQUIRED') return 403
  if (code === 'P4B_RESOURCE_NOT_AVAILABLE') return 404
  if (code === 'P4B_STEP_UP_REQUIRED') return 401
  if (code.includes('CONFLICT') || code.includes('STALE') || code.includes('MISMATCH') || code.includes('AMBIGUOUS')) return 409
  return 422
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED')

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) return fail(500, 'SERVER_MISCONFIGURED')
  const token = bearer(req)
  if (!token) return fail(401, 'AUTH_REQUIRED')
  const body = await bodyOf(req)
  if (!body || hasForbidden(body)) return fail(400, 'INVALID_REQUEST')
  const operation = stringOf(body, 'operation', 40)
  const centerId = stringOf(body, 'center_id', 120)
  if (!OPERATIONS.has(operation) || !centerId) return fail(400, 'INVALID_REQUEST')

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  const user = userData?.user
  if (userError || !user?.id) return fail(401, 'AUTH_REQUIRED')
  const { data: membership, error: membershipError } = await admin.from('center_members')
    .select('id,center_id,user_id,role,status,membership_version')
    .eq('center_id', centerId).eq('user_id', user.id).eq('status', 'active').maybeSingle()
  if (membershipError) {
    safeLog('membership', 'QUERY_FAILED')
    return fail(500, 'SERVER_AUTHORIZATION_UNAVAILABLE')
  }
  if (!membership) return fail(403, 'CENTER_ACCESS_DENIED')

  const allowed = operation === 'approve_execute'
    ? new Set(['owner', 'center_admin'])
    : operation === 'status'
      ? new Set(['consultant', 'owner', 'center_admin'])
      : new Set(['consultant'])
  if (!allowed.has(String(membership.role))) return fail(403, 'ROLE_NOT_ALLOWED')

  const normalizedUrl = new URL(supabaseUrl).origin.toLowerCase()
  const authorityEnvironment = await sha256(`ichess.crm.p4b.authority-environment.v1|${normalizedUrl}`)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  let rpc = ''
  let args: JsonRecord = {}

  if (operation === 'prepare') {
    const idempotency = stringOf(body, 'idempotency_key', 200)
    const sourceRecordId = stringOf(body, 'source_record_id', 200)
    const guardianName = stringOf(body, 'guardian_display_name')
    const studentName = stringOf(body, 'student_display_name')
    const birth = stringOf(body, 'student_birth_date', 10)
    const phones = stringArray(body, 'phones')
    const emails = stringArray(body, 'emails')
    if (idempotency.length < 16 || !sourceRecordId || !guardianName || !studentName
      || !/^\d{4}-\d{2}-\d{2}$/.test(birth) || !phones || !emails) return fail(400, 'INVALID_REQUEST')
    rpc = 'f23_3e_p4b_prepare_conversion'
    args = {
      p_center_id: centerId, p_actor_user_id: user.id, p_source_record_id: sourceRecordId,
      p_guardian_display_name: guardianName, p_phones: phones, p_emails: emails,
      p_student_display_name: studentName, p_student_birth_date: birth,
      p_learning_need_summary: optionalString(body, 'learning_need_summary'),
      p_preferred_schedule_summary: optionalString(body, 'preferred_schedule_summary'),
      p_authority_environment_fingerprint: `\\x${authorityEnvironment}`,
      p_idempotency_key_digest: `\\x${await sha256(`ichess.crm.p4b.client-key.v1|prepare|${centerId}|${sourceRecordId}|${idempotency}`)}`,
      p_idempotency_expires_at: expiresAt,
    }
  } else if (operation === 'review') {
    const idempotency = stringOf(body, 'idempotency_key', 200)
    const bridgeId = stringOf(body, 'bridge_session_id', 40)
    const version = integerOf(body, 'expected_bridge_version')
    const studentDecision = stringOf(body, 'student_decision', 40)
    const guardianDecision = stringOf(body, 'guardian_decision', 40)
    const relationshipDecision = stringOf(body, 'relationship_decision', 60)
    const studentTarget = nullableUuid(body, 'student_opaque_target_id')
    const guardianTarget = nullableUuid(body, 'guardian_opaque_target_id')
    if (idempotency.length < 16 || !UUID.test(bridgeId) || !version
      || studentTarget === undefined || guardianTarget === undefined) return fail(400, 'INVALID_REQUEST')
    rpc = 'f23_3e_p4b_review_conversion'
    args = {
      p_bridge_session_id: bridgeId, p_actor_user_id: user.id, p_expected_bridge_version: version,
      p_student_decision: studentDecision, p_student_opaque_target_id: studentTarget,
      p_student_expected_target_version: integerOf(body, 'student_expected_target_version'),
      p_guardian_decision: guardianDecision, p_guardian_opaque_target_id: guardianTarget,
      p_guardian_expected_target_version: integerOf(body, 'guardian_expected_target_version'),
      p_relationship_decision: relationshipDecision,
      p_idempotency_key_digest: `\\x${await sha256(`ichess.crm.p4b.client-key.v1|review|${centerId}|${bridgeId}|${idempotency}`)}`,
      p_idempotency_expires_at: expiresAt,
    }
  } else if (operation === 'approve_execute') {
    const idempotency = stringOf(body, 'idempotency_key', 200)
    const bridgeId = stringOf(body, 'bridge_session_id', 40)
    const version = integerOf(body, 'expected_bridge_version')
    if (idempotency.length < 16 || !UUID.test(bridgeId) || !version) return fail(400, 'INVALID_REQUEST')
    const claims = decodeJwtPayload(token)
    const sessionId = typeof claims?.session_id === 'string' && UUID.test(claims.session_id) ? claims.session_id : ''
    const amr = Array.isArray(claims?.amr) ? claims.amr as JsonRecord[] : []
    const totpTimestamps = amr.filter((entry) => entry?.method === 'totp' && Number.isFinite(entry?.timestamp))
      .map((entry) => Number(entry.timestamp))
    const verifiedAtSeconds = Math.max(0, ...totpTimestamps)
    const nowSeconds = Math.floor(Date.now() / 1000)
    const { data: factorData, error: factorError } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
    const factors = (factorData?.factors || []).filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified')
    if (factorError || claims?.sub !== user.id || claims?.aal !== 'aal2' || !sessionId
      || !verifiedAtSeconds || verifiedAtSeconds < nowSeconds - 120 || verifiedAtSeconds > nowSeconds + 30
      || factors.length === 0) return fail(401, 'STEP_UP_REQUIRED')
    const factorIds = factors.map((factor) => factor.id).sort()
    const accountEvidence = await sha256(`ichess.crm.p4b.account-evidence.v1|${user.id}|${sessionId}|${factorIds.join(',')}`)
    const verificationReference = await sha256(`ichess.crm.p4b.totp-verification.v1|${user.id}|${sessionId}|${verifiedAtSeconds}|${factorIds.join(',')}`)
    rpc = 'f23_3e_p4b_approve_execute_conversion'
    args = {
      p_bridge_session_id: bridgeId, p_actor_user_id: user.id, p_expected_bridge_version: version,
      p_logical_security_session_id: sessionId, p_assurance_level: 'AAL2_TOTP',
      p_verification_provider_namespace: 'supabase.auth.totp.v1',
      p_verification_reference_digest: `\\x${verificationReference}`,
      p_server_verified_at: new Date(verifiedAtSeconds * 1000).toISOString(),
      p_account_evidence_digest: `\\x${accountEvidence}`,
      p_authority_environment_fingerprint: `\\x${authorityEnvironment}`,
      p_idempotency_key_digest: `\\x${await sha256(`ichess.crm.p4b.client-key.v1|execute|${centerId}|${bridgeId}|${idempotency}`)}`,
      p_idempotency_expires_at: expiresAt,
    }
  } else {
    const bridgeId = stringOf(body, 'bridge_session_id', 40)
    if (!UUID.test(bridgeId)) return fail(400, 'INVALID_REQUEST')
    rpc = 'f23_3e_p4b_read_conversion_status'
    args = { p_bridge_session_id: bridgeId, p_actor_user_id: user.id }
  }

  const { data, error } = await admin.rpc(rpc, args)
  if (error) {
    const code = safeDbCode(error)
    safeLog(operation, code)
    return fail(statusFor(code), code)
  }
  if (!data || data.ok !== true) return fail(422, 'P4B_OPERATION_FAILED')
  return respond(200, data as JsonRecord)
})
