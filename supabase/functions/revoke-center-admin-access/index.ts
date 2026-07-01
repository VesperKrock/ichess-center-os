import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>

const FUNCTION_BUSINESS_NAME = 'revoke_center_admin_access'
const AUDIT_ACTION = 'account.revoke_center_admin_access'
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

function getOptionalBoolean(body: JsonRecord, key: string) {
  const value = body[key]
  return typeof value === 'boolean' ? value : false
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isValidSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

async function findMembershipByEmail(
  adminClient: ReturnType<typeof createClient>,
  memberships: Array<{ user_id?: string | null }>,
  targetEmail: string,
) {
  const matching: Array<{ user_id: string; email: string }> = []

  for (const membership of memberships) {
    const userId = String(membership.user_id || '')
    if (!userId) continue

    const { data, error } = await adminClient.auth.admin.getUserById(userId)
    const user = data?.user
    if (error || !user?.id) continue

    if (normalizeEmail(user.email || '') === targetEmail) {
      matching.push({ user_id: user.id, email: normalizeEmail(user.email || '') })
    }
  }

  return matching
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
  const reason = getOptionalString(body, 'reason') || 'owner_revoke_center_admin_access'
  const disableAuthUser = getOptionalBoolean(body, 'disable_auth_user')

  if (!centerId || !targetEmail || !idempotencyKey) {
    return safeError(400, 'invalid_request')
  }

  if (disableAuthUser) {
    return safeError(501, 'auth_disable_not_implemented', 'Auth user disable is documented but deferred.')
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
    return safeError(409, 'duplicate_request_already_processed')
  }

  const { data: activeMemberships, error: activeMembershipError } = await adminClient
    .from('center_members')
    .select('user_id, center_id, role, status')
    .eq('center_id', centerId)
    .eq('role', 'center_admin')
    .eq('status', 'active')

  if (activeMembershipError) {
    safeLog('target_admin_lookup', 'query_failed', { center_id: centerId, target_email: targetEmail })
    return safeError(500, 'target_admin_lookup_failed')
  }

  const activeMatches = await findMembershipByEmail(adminClient, activeMemberships || [], targetEmail)

  if (activeMatches.length > 1) {
    return safeError(409, 'center_admin_state_invalid')
  }

  if (activeMatches.length === 0) {
    const { data: revokedMemberships, error: revokedMembershipError } = await adminClient
      .from('center_members')
      .select('user_id, center_id, role, status')
      .eq('center_id', centerId)
      .eq('role', 'center_admin')
      .eq('status', 'revoked')

    if (!revokedMembershipError) {
      const revokedMatches = await findMembershipByEmail(adminClient, revokedMemberships || [], targetEmail)
      if (revokedMatches.length > 0) {
        return safeError(409, 'center_admin_already_revoked')
      }
    }

    return safeError(404, 'target_center_admin_not_found')
  }

  const targetUser = activeMatches[0]

  const { data: revokedMembership, error: revokeError } = await adminClient
    .from('center_members')
    .update({ status: 'revoked' })
    .eq('center_id', centerId)
    .eq('user_id', targetUser.user_id)
    .eq('role', 'center_admin')
    .eq('status', 'active')
    .select('user_id, center_id, role, status')
    .maybeSingle()

  if (revokeError || !revokedMembership) {
    safeLog('membership_revoke', 'failed', { center_id: centerId, target_user_id: targetUser.user_id })
    return safeError(500, 'membership_revoke_failed')
  }

  const { data: auditData, error: auditError } = await adminClient
    .from('account_audit_logs')
    .insert({
      actor_user_id: actorUser.id,
      actor_email: actorEmail,
      action: AUDIT_ACTION,
      target_type: 'user',
      target_user_id: targetUser.user_id,
      target_email: targetEmail,
      center_id: centerId,
      before_state: { membership_status: 'active', role: 'center_admin' },
      after_state: { membership_status: 'revoked', auth_user_disabled: false },
      reason,
      request_id: idempotencyKey,
      metadata: {
        function: FUNCTION_BUSINESS_NAME,
        center_slug: slug,
        disable_auth_user_requested: false,
      },
    })
    .select('id')
    .maybeSingle()

  if (auditError || !auditData?.id) {
    safeLog('audit_insert', 'failed_after_membership_revoke', { center_id: centerId, target_user_id: targetUser.user_id })
    return safeError(
      500,
      'revoke_audit_failed_manual_review_required',
      'Membership was revoked but audit logging failed. Inspect membership and audit state before continuing.',
    )
  }

  return jsonResponse(200, {
    ok: true,
    code: 'center_admin_access_revoked',
    center_id: centerId,
    email: targetEmail,
    membership_status: 'revoked',
    auth_user_disabled: false,
    audit_id: auditData.id,
  })
})
