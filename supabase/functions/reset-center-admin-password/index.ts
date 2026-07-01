import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>

const FUNCTION_BUSINESS_NAME = 'reset_center_admin_password'
const AUDIT_ACTION = 'account.reset_center_admin_password'
const FORBIDDEN_CLIENT_FIELDS = new Set([
  'password',
  'temporary_password',
  'new_password',
  'role',
  'actor_user_id',
  'actor_email',
  'service_role',
  'jwt',
  'authorization',
])

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function jsonResponse(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

function safeError(status: number, code: string, message?: string, extra: JsonRecord = {}) {
  return jsonResponse(status, {
    ok: false,
    code,
    ...(message ? { message } : {}),
    ...extra,
  })
}

function safeLog(step: string, code: string, details: JsonRecord = {}) {
  console.error(
    JSON.stringify({
      function: FUNCTION_BUSINESS_NAME,
      step,
      code,
      ...details,
    }),
  )
}

function getSafeSupabaseErrorDebug(step: string, context: JsonRecord, error: unknown) {
  const typedError = error as { code?: string; message?: string; details?: string; hint?: string } | null
  return {
    step,
    ...context,
    error_code: typedError?.code || 'unknown',
    error_message: typedError?.message || 'unknown',
    error_details: typedError?.details || null,
    error_hint: typedError?.hint || null,
  }
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get('Authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

async function readRequestBody(req: Request) {
  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as JsonRecord) : null
  } catch {
    return null
  }
}

function hasForbiddenClientField(body: JsonRecord) {
  return Object.keys(body).some((key) => FORBIDDEN_CLIENT_FIELDS.has(key.toLowerCase()))
}

function getRequiredString(body: JsonRecord, key: string) {
  const value = body[key]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function getOptionalString(body: JsonRecord, key: string) {
  const value = body[key]
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isValidSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

function generateTemporaryPassword(length = 24) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  const password = Array.from(bytes, (byte) => alphabet[byte % alphabet.length])
  password[0] = 'A'
  password[1] = 'a'
  password[2] = '7'
  password[3] = '!'
  return password.join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return safeError(405, 'method_not_allowed')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return safeError(500, 'server_misconfigured')
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  })

  const token = getBearerToken(req)
  if (!token) {
    return safeError(401, 'unauthorized')
  }

  const body = await readRequestBody(req)
  if (!body) {
    return safeError(400, 'invalid_request')
  }

  if (hasForbiddenClientField(body)) {
    return safeError(400, 'forbidden_client_fields')
  }

  const centerId = getRequiredString(body, 'center_id')
  const targetEmail = normalizeEmail(getRequiredString(body, 'target_email'))
  const idempotencyKey = getRequiredString(body, 'idempotency_key')
  const reason = getOptionalString(body, 'reason') || 'owner_reset_center_admin_password'

  if (!centerId || !targetEmail || !idempotencyKey) {
    return safeError(400, 'invalid_request')
  }

  const { data: actorData, error: actorError } = await adminClient.auth.getUser(token)
  const actorUser = actorData?.user
  if (actorError || !actorUser?.id) {
    return safeError(401, 'unauthorized')
  }

  const actorEmail = actorUser.email || null

  const { data: ownerMembership, error: ownerGuardError } = await adminClient
    .from('center_members')
    .select('user_id, center_id, role, status')
    .eq('center_id', centerId)
    .eq('user_id', actorUser.id)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle()

  if (ownerGuardError) {
    const debug = getSafeSupabaseErrorDebug('owner_guard', {
      center_id: centerId,
      actor_user_id: actorUser.id,
      actor_email: actorEmail,
    }, ownerGuardError)

    safeLog('owner_guard', 'owner_guard_query_failed', debug)
    return safeError(500, 'owner_guard_query_failed', 'Owner guard query failed.', { debug })
  }

  if (!ownerMembership) {
    return safeError(403, 'forbidden_owner_required', 'Owner role is required for this action.')
  }

  const { data: center, error: centerError } = await adminClient
    .from('centers')
    .select('id, name, slug, environment, status')
    .eq('id', centerId)
    .maybeSingle()

  if (centerError) {
    safeLog('center_validation', 'query_failed', { center_id: centerId })
    return safeError(500, 'center_validation_failed')
  }

  if (!center) {
    return safeError(404, 'center_not_found')
  }

  if (center.environment !== 'production' || center.status !== 'active') {
    return safeError(409, 'center_not_production_active')
  }

  const slug = String(center.slug || '').trim().toLowerCase()
  if (!isValidSlug(slug)) {
    return safeError(422, 'invalid_center_slug')
  }

  const { data: adminMemberships, error: adminMembershipError } = await adminClient
    .from('center_members')
    .select('user_id, center_id, role, status')
    .eq('center_id', centerId)
    .eq('role', 'center_admin')
    .eq('status', 'active')

  if (adminMembershipError) {
    safeLog('target_admin_lookup', 'query_failed', { center_id: centerId, target_email: targetEmail })
    return safeError(500, 'target_admin_lookup_failed')
  }

  if (!Array.isArray(adminMemberships) || adminMemberships.length !== 1) {
    return safeError(409, 'center_admin_state_invalid')
  }

  const targetUserId = String(adminMemberships[0]?.user_id || '')
  if (!targetUserId) {
    return safeError(404, 'target_center_admin_not_found')
  }

  const { data: targetUserData, error: targetUserError } = await adminClient.auth.admin.getUserById(targetUserId)
  const targetUser = targetUserData?.user
  if (targetUserError || !targetUser?.id || normalizeEmail(targetUser.email || '') !== targetEmail) {
    return safeError(404, 'target_center_admin_not_found')
  }

  const { data: priorAudit, error: idempotencyError } = await adminClient
    .from('account_audit_logs')
    .select('id')
    .eq('action', AUDIT_ACTION)
    .eq('center_id', centerId)
    .eq('target_email', targetEmail)
    .eq('request_id', idempotencyKey)
    .limit(1)

  if (idempotencyError) {
    safeLog('idempotency_check', 'query_failed', { center_id: centerId, target_email: targetEmail })
    return safeError(500, 'idempotency_check_failed')
  }

  if (Array.isArray(priorAudit) && priorAudit.length > 0) {
    return safeError(
      409,
      'duplicate_request_already_processed',
      'This request was already processed. The temporary password cannot be shown again.',
    )
  }

  const temporaryPassword = generateTemporaryPassword()

  const { error: resetError } = await adminClient.auth.admin.updateUserById(targetUser.id, {
    password: temporaryPassword,
    email_confirm: true,
  })

  if (resetError) {
    safeLog('auth_update_user_password', 'failed', { center_id: centerId, target_user_id: targetUser.id })
    return safeError(500, 'password_reset_failed')
  }

  const { data: auditData, error: auditError } = await adminClient
    .from('account_audit_logs')
    .insert({
      actor_user_id: actorUser.id,
      actor_email: actorEmail,
      action: AUDIT_ACTION,
      target_type: 'user',
      target_user_id: targetUser.id,
      target_email: targetEmail,
      center_id: centerId,
      before_state: { password_exposed_or_reset_requested: true },
      after_state: { password_reset: true, credential_handoff_required: true },
      reason,
      request_id: idempotencyKey,
      metadata: {
        function: FUNCTION_BUSINESS_NAME,
        center_slug: slug,
        credential_handoff_required: true,
      },
    })
    .select('id')
    .maybeSingle()

  if (auditError || !auditData?.id) {
    safeLog('audit_insert', 'failed_after_password_reset', { center_id: centerId, target_user_id: targetUser.id })
    return safeError(
      500,
      'password_reset_audit_failed_manual_reset_required',
      'Password was reset but audit logging failed. Do not hand off credentials; run reset again after audit is fixed.',
    )
  }

  return jsonResponse(200, {
    ok: true,
    code: 'center_admin_password_reset',
    center_id: centerId,
    email: targetEmail,
    temporary_password: temporaryPassword,
    password_display_once: true,
    credential_handoff_required: true,
    audit_id: auditData.id,
  })
})
