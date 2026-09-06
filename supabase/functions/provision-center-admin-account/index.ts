import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const json = (status: number, body: JsonRecord) => new Response(JSON.stringify(body), { status, headers: corsHeaders })
const fail = (status: number, code: string) => json(status, { ok: false, code })
const bearer = (req: Request) => req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || ''
const text = (body: JsonRecord, key: string) => typeof body[key] === 'string' ? String(body[key]).trim() : ''
const normalizeEmail = (value: string) => value.trim().toLowerCase()
const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const maskEmail = (value: string) => {
  const [name, domain] = value.split('@')
  return `${name.slice(0, 2)}***@${domain}`
}

function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+'
  const bytes = crypto.getRandomValues(new Uint8Array(28))
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length])
  chars.splice(0, 4, 'A', 'a', '7', '!')
  return chars.join('')
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return fail(500, 'server_misconfigured')

  let body: JsonRecord
  try { body = await req.json() } catch { return fail(400, 'invalid_request') }
  if (['password', 'temporary_password', 'role', 'actor_user_id'].some((key) => key in body)) {
    return fail(400, 'forbidden_client_fields')
  }

  const centerId = text(body, 'center_id')
  const requestId = text(body, 'idempotency_key')
  const email = normalizeEmail(text(body, 'target_email'))
  const displayName = text(body, 'display_name')
  const requestedMode = text(body, 'mode')
  const repairSessionInvalidation = requestedMode === 'repair_session_invalidation'
  const repairCommandId = text(body, 'command_id')
  const mode = requestedMode === 'replace' ? 'replace_admin' : 'provision_admin'
  const governanceVersion = Number(body.expected_governance_version)
  const predecessorMembershipId = text(body, 'predecessor_membership_id') || null
  const predecessorMembershipVersion = body.expected_membership_version == null
    ? null
    : Number(body.expected_membership_version)
  if (repairSessionInvalidation ? !repairCommandId :
      (!centerId || requestId.length < 8 || !validEmail(email) || !Number.isInteger(governanceVersion))) {
    return fail(400, 'invalid_request')
  }
  if (!repairSessionInvalidation && mode === 'replace_admin' &&
      (!predecessorMembershipId || !Number.isInteger(predecessorMembershipVersion))) {
    return fail(400, 'replacement_predecessor_required')
  }

  const token = bearer(req)
  if (!token) return fail(401, 'unauthorized')
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  })
  const { data: actorData, error: actorError } = await admin.auth.getUser(token)
  const actor = actorData?.user
  if (actorError || !actor?.id) return fail(401, 'unauthorized')

  if (repairSessionInvalidation) {
    const { data: context, error: contextError } = await admin.rpc('arg2_get_command_execution_context', {
      p_command_id: repairCommandId,
      p_actor_user_id: actor.id,
    })
    const predecessorUserId = typeof context?.predecessor_user_id === 'string'
      ? context.predecessor_user_id
      : ''
    if (!contextError && context?.ok && context.action === 'replace_admin' &&
        context.state === 'finalized' && context.stage === 'complete') {
      return json(200, {
        ok: true,
        code: 'center_admin_replacement_complete',
        command_id: repairCommandId,
        replayed: true,
      })
    }
    if (contextError || !context?.ok || context.action !== 'replace_admin' ||
        context.state !== 'repair_required' || context.stage !== 'authority_swapped' || !predecessorUserId) {
      return fail(409, 'repair_not_available')
    }
    const { data: predecessor, error: predecessorError } = await admin.auth.admin.getUserById(predecessorUserId)
    const invalidationAlreadyCommitted = predecessor?.user?.user_metadata?.governance_command_id === repairCommandId &&
      predecessor?.user?.user_metadata?.credential_state === 'revoked'
    const invalidationResult = predecessorError || !predecessor?.user
      ? { error: predecessorError || { message: 'predecessor_auth_state_unknown' } }
      : invalidationAlreadyCommitted
        ? { error: null }
        : await admin.auth.admin.updateUserById(predecessorUserId, {
            password: temporaryPassword(),
            user_metadata: {
              ...predecessor.user.user_metadata,
              credential_state: 'revoked',
              governance_command_id: repairCommandId,
            },
          })
    const invalidateError = invalidationResult.error
    const receipt = await sha256(`replace-admin-session:${predecessorUserId}:${repairCommandId}:${invalidateError ? 'failed' : 'succeeded'}`)
    const { data: finalized, error: finalizeError } = await admin.rpc('arg2_finalize_session_invalidation', {
      p_command_id: repairCommandId,
      p_actor_user_id: actor.id,
      p_session_invalidation_receipt_hash: receipt,
      p_succeeded: !invalidateError,
      p_repair_code: invalidateError ? 'predecessor_session_invalidation_failed' : null,
    })
    if (invalidateError || finalizeError || !finalized?.ok) return fail(500, 'repair_required')
    return json(200, {
      ok: true,
      code: 'center_admin_replacement_complete',
      command_id: repairCommandId,
    })
  }

  const emailHash = await sha256(email)
  const intentHash = await sha256(JSON.stringify([
    mode, centerId, emailHash, displayName, governanceVersion,
    predecessorMembershipId, predecessorMembershipVersion,
  ]))
  const { data: prepared, error: prepareError } = await admin.rpc('arg2_prepare_lifecycle_command', {
    p_center_id: centerId,
    p_request_id: requestId,
    p_action: mode,
    p_intent_hash: intentHash,
    p_actor_user_id: actor.id,
    p_expected_governance_version: governanceVersion,
    p_target_membership_id: predecessorMembershipId,
    p_expected_membership_version: predecessorMembershipVersion,
    p_target_email_hash: emailHash,
    p_target_email_masked: maskEmail(email),
    p_expires_at: null,
    p_safe_context: { display_name_present: Boolean(displayName) },
  })
  if (prepareError) return fail(409, prepareError.message || 'prepare_failed')
  if (prepared?.replayed) {
    if (!['prepared', 'repair_required'].includes(String(prepared.state)) || body.repair !== true) {
      return fail(409, prepared.state === 'repair_required' ? 'repair_required' : 'duplicate_request_secret_not_replayable')
    }
    if (prepared.stage === 'authority_swapped' && mode === 'replace_admin') {
      const { data: context, error: contextError } = await admin.rpc('arg2_get_command_execution_context', {
        p_command_id: prepared.command_id, p_actor_user_id: actor.id,
      })
      const predecessorUserId = typeof context?.predecessor_user_id === 'string'
        ? context.predecessor_user_id
        : ''
      if (contextError || !context?.ok || !predecessorUserId) return fail(403, 'repair_required')
      const { data: predecessor, error: predecessorError } = await admin.auth.admin.getUserById(predecessorUserId)
      const invalidationAlreadyCommitted = predecessor?.user?.user_metadata?.governance_command_id === prepared.command_id &&
        predecessor?.user?.user_metadata?.credential_state === 'revoked'
      const invalidationResult = predecessorError || !predecessor?.user
        ? { error: predecessorError || { message: 'predecessor_auth_state_unknown' } }
        : invalidationAlreadyCommitted
          ? { error: null }
          : await admin.auth.admin.updateUserById(predecessorUserId, {
              password: temporaryPassword(),
              user_metadata: {
                ...predecessor.user.user_metadata,
                credential_state: 'revoked',
                governance_command_id: prepared.command_id,
              },
            })
      const invalidateError = invalidationResult.error
      const invalidationReceipt = await sha256(`replace-admin-session:${predecessorUserId}:${prepared.command_id}:${invalidateError ? 'failed' : 'succeeded'}`)
      const { data: finalized, error: finalizeError } = await admin.rpc('arg2_finalize_session_invalidation', {
        p_command_id: prepared.command_id,
        p_actor_user_id: actor.id,
        p_session_invalidation_receipt_hash: invalidationReceipt,
        p_succeeded: !invalidateError,
        p_repair_code: invalidateError ? 'predecessor_session_invalidation_failed' : null,
      })
      if (invalidateError || finalizeError || !finalized?.ok) return fail(500, 'repair_required')
      return json(200, {
        ok: true,
        code: 'center_admin_replacement_complete',
        command_id: prepared.command_id,
        center_id: centerId,
      })
    }
  }

  const password = temporaryPassword()
  let createdUser: { id: string; user_metadata?: Record<string, unknown> } | null = null
  if (prepared?.replayed) {
    if (prepared.target_user_id) {
      const existing = await admin.auth.admin.getUserById(prepared.target_user_id)
      createdUser = existing.data?.user || null
    }
    for (let page = 1; page <= 10 && !createdUser; page += 1) {
      const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 100 })
      if (usersError) return fail(500, 'repair_required')
      createdUser = usersPage.users.find((user) => user.user_metadata?.governance_command_id === prepared.command_id) || null
      if (usersPage.users.length < 100) break
    }
    if (createdUser && prepared.state !== 'repair_required') {
      const repairReceipt = await sha256(`candidate-credential-reissue-prepared:${createdUser.id}:${prepared.command_id}`)
      const { error: repairError } = await admin.rpc('arg2_mark_command_repair_required', {
        p_command_id: prepared.command_id,
        p_actor_user_id: actor.id,
        p_repair_code: 'candidate_credential_reissue_required',
        p_receipt_hash: repairReceipt,
      })
      if (repairError) return fail(500, 'repair_required')
    }
  }
  let createError: { status?: number } | null = null
  if (createdUser) {
    const rotated = await admin.auth.admin.updateUserById(createdUser.id, {
      password,
      user_metadata: { ...createdUser.user_metadata, credential_state: 'temporary', governance_command_id: prepared.command_id },
    })
    createError = rotated.error
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        lifecycle: 'managed_center_account',
        credential_state: 'temporary',
        governance_command_id: prepared.command_id,
      },
    })
    createdUser = created.data?.user || null
    createError = created.error
  }
  if (createError || !createdUser?.id) {
    const receipt = await sha256(`auth-create-failed:${createError?.status || 'unknown'}:${requestId}`)
    await admin.rpc('arg2_mark_command_repair_required', {
      p_command_id: prepared.command_id,
      p_actor_user_id: actor.id,
      p_repair_code: 'auth_identity_create_failed',
      p_receipt_hash: receipt,
    })
    return fail(createError?.status === 422 ? 409 : 500, 'auth_identity_create_failed_review_required')
  }

  const receipt = await sha256(`auth-user-created:${createdUser.id}:${requestId}:${prepared?.replayed ? 'repair' : 'initial'}`)
  const { data: registered, error: registerError } = await admin.rpc('arg2_register_created_identity', {
    p_command_id: prepared.command_id,
    p_target_user_id: createdUser.id,
    p_target_email_hash: emailHash,
    p_external_receipt_hash: receipt,
  })
  if (registerError || !registered?.ok) {
    await admin.rpc('arg2_mark_command_repair_required', {
      p_command_id: prepared.command_id,
      p_actor_user_id: actor.id,
      p_repair_code: 'identity_created_membership_finalize_failed',
      p_receipt_hash: receipt,
    })
    return fail(500, 'repair_required')
  }

  return json(200, {
    ok: true,
    code: mode === 'replace_admin' ? 'center_admin_replacement_prepared' : 'center_admin_credential_handoff_required',
    command_id: prepared.command_id,
    center_id: centerId,
    email,
    temporary_password: password,
    password_display_once: true,
    credential_handoff_required: true,
    membership_status: 'pending_credential',
  })
})
