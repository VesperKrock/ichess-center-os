import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>

const FUNCTION_BUSINESS_NAME = 'provision_center_admin_account'
const AUDIT_ACTION = 'account.provision_center_admin'
const ADMIN_EMAIL_DOMAIN = 'ichess.vn'
const FORBIDDEN_CLIENT_FIELDS = new Set([
  'role',
  'email',
  'password',
  'temporary_password',
  'actor_user_id',
  'actor_email',
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
  return Object.keys(body).some((key) => FORBIDDEN_CLIENT_FIELDS.has(key))
}

function getRequiredString(body: JsonRecord, key: string) {
  const value = body[key]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function getOptionalString(body: JsonRecord, key: string) {
  const value = body[key]
  return typeof value === 'string' ? value.trim() : ''
}

function isValidSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

function makeAdminEmail(slug: string) {
  return `admin.${slug}@${ADMIN_EMAIL_DOMAIN}`.toLowerCase()
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

function isDuplicateEmailError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || error || '').toLowerCase()
  return message.includes('already') || message.includes('exists') || message.includes('duplicate')
}

async function safeDeleteAuthUser(adminClient: ReturnType<typeof createClient>, userId: string | null) {
  if (!userId) return { ok: true }
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) {
    safeLog('rollback.delete_auth_user', 'cleanup_failed', { target_user_id: userId })
    return { ok: false, error }
  }
  return { ok: true }
}

async function safeDeleteMembership(
  adminClient: ReturnType<typeof createClient>,
  centerId: string,
  userId: string | null,
) {
  if (!userId) return { ok: true }
  const { error } = await adminClient
    .from('center_members')
    .delete()
    .eq('center_id', centerId)
    .eq('user_id', userId)
    .eq('role', 'center_admin')

  if (error) {
    safeLog('rollback.delete_membership', 'cleanup_failed', { center_id: centerId, target_user_id: userId })
    return { ok: false, error }
  }
  return { ok: true }
}

async function writeFailureAudit(
  adminClient: ReturnType<typeof createClient>,
  input: {
    actorUserId: string
    actorEmail: string | null
    centerId: string
    targetUserId?: string | null
    targetEmail?: string | null
    idempotencyKey: string
    reason: string
    centerSlug?: string
  },
) {
  await adminClient.from('account_audit_logs').insert({
    actor_user_id: input.actorUserId,
    actor_email: input.actorEmail,
    action: AUDIT_ACTION,
    target_type: 'user',
    target_user_id: input.targetUserId || null,
    target_email: input.targetEmail || null,
    center_id: input.centerId,
    before_state: { center_admin_exists: false },
    after_state: { status: 'failed', cleanup_required: true },
    reason: input.reason,
    request_id: input.idempotencyKey,
    metadata: {
      function: FUNCTION_BUSINESS_NAME,
      center_slug: input.centerSlug || null,
      credential_handoff_required: false,
    },
  })
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
    global: {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
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
  const idempotencyKey = getRequiredString(body, 'idempotency_key')
  const displayName = getOptionalString(body, 'display_name')

  if (!centerId || !idempotencyKey) {
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

  const adminEmail = makeAdminEmail(slug)

  const { data: existingAdmin, error: existingAdminError } = await adminClient
    .from('center_members')
    .select('user_id')
    .eq('center_id', centerId)
    .eq('role', 'center_admin')
    .eq('status', 'active')
    .limit(1)

  if (existingAdminError) {
    safeLog('duplicate_admin_check', 'query_failed', { center_id: centerId })
    return safeError(500, 'duplicate_admin_check_failed')
  }

  if (Array.isArray(existingAdmin) && existingAdmin.length > 0) {
    return safeError(409, 'center_admin_already_exists', 'Center already has an active admin.')
  }

  const { data: priorAudit, error: idempotencyError } = await adminClient
    .from('account_audit_logs')
    .select('id')
    .eq('action', AUDIT_ACTION)
    .eq('center_id', centerId)
    .eq('request_id', idempotencyKey)
    .limit(1)

  if (idempotencyError) {
    safeLog('idempotency_check', 'query_failed', { center_id: centerId })
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
  let createdUserId: string | null = null
  let membershipInserted = false

  const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      display_name: displayName || `Admin ${center.name || slug}`,
      center_id: centerId,
      role: 'center_admin',
      created_by: FUNCTION_BUSINESS_NAME,
    },
  })

  if (createUserError || !createdUserData?.user?.id) {
    if (isDuplicateEmailError(createUserError)) {
      return safeError(409, 'admin_email_already_used', 'Expected admin email already exists.')
    }

    safeLog('auth_create_user', 'failed', { center_id: centerId })
    return safeError(500, 'auth_create_failed')
  }

  createdUserId = createdUserData.user.id

  const { error: membershipError } = await adminClient.from('center_members').insert({
    center_id: centerId,
    user_id: createdUserId,
    role: 'center_admin',
    status: 'active',
  })

  if (membershipError) {
    safeLog('membership_insert', 'failed', { center_id: centerId, target_user_id: createdUserId })
    await safeDeleteAuthUser(adminClient, createdUserId)
    try {
      await writeFailureAudit(adminClient, {
        actorUserId: actorUser.id,
        actorEmail,
        centerId,
        targetUserId: createdUserId,
        targetEmail: adminEmail,
        idempotencyKey,
        reason: 'membership_insert_failed',
        centerSlug: slug,
      })
    } catch {
      safeLog('failure_audit', 'failed_after_membership_insert_failed', { center_id: centerId })
    }
    return safeError(500, 'provisioning_failed', 'Could not create center admin access.')
  }

  membershipInserted = true

  const { data: auditData, error: auditError } = await adminClient
    .from('account_audit_logs')
    .insert({
      actor_user_id: actorUser.id,
      actor_email: actorEmail,
      action: AUDIT_ACTION,
      target_type: 'user',
      target_user_id: createdUserId,
      target_email: adminEmail,
      center_id: centerId,
      before_state: { center_admin_exists: false },
      after_state: { role: 'center_admin', membership_status: 'active' },
      reason: 'owner_provision_center_admin',
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
    safeLog('audit_insert', 'failed', { center_id: centerId, target_user_id: createdUserId })
    if (membershipInserted) {
      await safeDeleteMembership(adminClient, centerId, createdUserId)
    }
    await safeDeleteAuthUser(adminClient, createdUserId)
    return safeError(500, 'provisioning_failed_audit_required', 'Could not write required audit log.')
  }

  return jsonResponse(200, {
    ok: true,
    code: 'center_admin_created',
    center_id: centerId,
    email: adminEmail,
    temporary_password: temporaryPassword,
    password_display_once: true,
    credential_handoff_required: true,
    audit_id: auditData.id,
  })
})
