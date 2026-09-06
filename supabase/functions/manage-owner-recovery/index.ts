import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>
const headers = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const out = (status: number, body: JsonRecord) => new Response(JSON.stringify(body), { status, headers })
const val = (body: JsonRecord, key: string) => typeof body[key] === 'string' ? String(body[key]).trim() : ''
const tokenOf = (req: Request) => req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || ''
const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
function secret(length = 32) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+'
  const chars = Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) => alphabet[byte % alphabet.length])
  chars.splice(0, 4, 'A', 'a', '7', '!')
  return chars.join('')
}
async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return out(405, { ok: false, code: 'method_not_allowed' })
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return out(500, { ok: false, code: 'server_misconfigured' })
  let body: JsonRecord
  try { body = await req.json() } catch { return out(400, { ok: false, code: 'invalid_request' }) }
  const token = tokenOf(req)
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  })
  const { data: actorData, error: actorError } = await admin.auth.getUser(token)
  if (actorError || !actorData?.user?.id) return out(401, { ok: false, code: 'unauthorized' })
  const actorId = actorData.user.id
  const mode = val(body, 'mode')

  if (mode === 'request') {
    const centerId = val(body, 'center_id')
    const requestId = val(body, 'idempotency_key')
    const email = val(body, 'target_email').toLowerCase()
    const evidenceDigest = val(body, 'evidence_digest').toLowerCase()
    const expiresAt = val(body, 'expires_at')
    const governanceVersion = Number(body.expected_governance_version)
    if (!centerId || requestId.length < 8 || !validEmail(email) || !/^[0-9a-f]{64}$/.test(evidenceDigest) ||
        !Number.isInteger(governanceVersion) || !expiresAt) {
      return out(400, { ok: false, code: 'invalid_request' })
    }
    const emailHash = await sha256(email)
    const intentHash = await sha256(JSON.stringify([
      'owner_recovery', centerId, emailHash, evidenceDigest, governanceVersion, expiresAt,
    ]))
    const { data, error } = await admin.rpc('arg2_prepare_owner_recovery', {
      p_center_id: centerId,
      p_request_id: requestId,
      p_intent_hash: intentHash,
      p_requester_user_id: actorId,
      p_expected_governance_version: governanceVersion,
      p_target_email_hash: emailHash,
      p_target_email_masked: `${email.split('@')[0].slice(0, 2)}***@${email.split('@')[1]}`,
      p_evidence_digest: evidenceDigest,
      p_expires_at: expiresAt,
    })
    if (error || !data?.ok) return out(403, { ok: false, code: error?.message || 'recovery_request_denied' })
    return out(200, { ok: true, code: 'owner_recovery_requested', command_id: data.command_id, replayed: data.replayed })
  }

  const commandId = val(body, 'command_id')
  if (!commandId) return out(400, { ok: false, code: 'invalid_request' })
  if (mode === 'approve') {
    const authorityVersion = Number(body.expected_authority_version)
    if (!Number.isInteger(authorityVersion)) return out(400, { ok: false, code: 'invalid_request' })
    const { data, error } = await admin.rpc('arg2_approve_owner_recovery', {
      p_command_id: commandId,
      p_custodian_user_id: actorId,
      p_expected_authority_version: authorityVersion,
    })
    if (error || !data?.ok) return out(403, { ok: false, code: error?.message || 'recovery_approval_denied' })
    return out(200, { ok: true, code: 'owner_recovery_approved', ...data })
  }

  if (mode === 'create_candidate') {
    const email = val(body, 'target_email').toLowerCase()
    const displayName = val(body, 'display_name')
    if (!validEmail(email)) return out(400, { ok: false, code: 'invalid_request' })
    const { data: context, error: contextError } = await admin.rpc('arg2_get_command_execution_context', {
      p_command_id: commandId, p_actor_user_id: actorId,
    })
    if (contextError || !context?.ok || context.action !== 'owner_recovery' ||
        Number(context.recovery_approval_count) < 2 ||
        !['prepared', 'awaiting_credential'].includes(String(context.stage)) ||
        (context.target_user_id && body.repair !== true) ||
        (context.state === 'repair_required' && body.repair !== true)) {
      return out(403, { ok: false, code: 'recovery_candidate_not_allowed' })
    }
    const emailHash = await sha256(email)
    if (emailHash !== context.target_email_hash) {
      return out(409, { ok: false, code: 'recovery_candidate_email_intent_mismatch' })
    }
    const password = secret()
    let candidateUser: { id: string; user_metadata?: Record<string, unknown> } | null = null
    if (typeof context.target_user_id === 'string') {
      const existing = await admin.auth.admin.getUserById(context.target_user_id)
      candidateUser = existing.data?.user || null
    }
    for (let page = 1; page <= 10 && !candidateUser; page += 1) {
      const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 100 })
      if (usersError) return out(500, { ok: false, code: 'repair_required' })
      candidateUser = usersPage.users.find((user) =>
        user.user_metadata?.governance_command_id === commandId) || null
      if (usersPage.users.length < 100) break
    }
    if (candidateUser && context.state !== 'repair_required') {
      const repairReceipt = await sha256(`recovery-candidate-reissue-prepared:${candidateUser.id}:${commandId}`)
      const { error: repairError } = await admin.rpc('arg2_mark_command_repair_required', {
        p_command_id: commandId, p_actor_user_id: actorId,
        p_repair_code: 'candidate_credential_reissue_required', p_receipt_hash: repairReceipt,
      })
      if (repairError) return out(500, { ok: false, code: 'repair_required' })
    }
    let createError: { message?: string } | null = null
    if (candidateUser) {
      const rotated = await admin.auth.admin.updateUserById(candidateUser.id, {
        password,
        user_metadata: {
          ...candidateUser.user_metadata,
          credential_state: 'temporary',
          governance_command_id: commandId,
        },
      })
      createError = rotated.error
    } else {
      const created = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: {
          display_name: displayName,
          lifecycle: 'owner_recovery_candidate',
          credential_state: 'temporary',
          governance_command_id: commandId,
        },
      })
      candidateUser = created.data?.user || null
      createError = created.error
    }
    const receipt = await sha256(`recovery-candidate-create:${candidateUser?.id || 'none'}:${commandId}:${createError ? 'failed' : 'succeeded'}`)
    if (createError || !candidateUser?.id) {
      await admin.rpc('arg2_mark_command_repair_required', {
        p_command_id: commandId, p_actor_user_id: actorId,
        p_repair_code: 'recovery_candidate_create_failed', p_receipt_hash: receipt,
      })
      return out(500, { ok: false, code: 'repair_required' })
    }
    const { data: registered, error: registerError } = await admin.rpc('arg2_register_created_identity', {
      p_command_id: commandId,
      p_target_user_id: candidateUser.id,
      p_target_email_hash: emailHash,
      p_external_receipt_hash: receipt,
    })
    if (registerError || !registered?.ok) {
      await admin.rpc('arg2_mark_command_repair_required', {
        p_command_id: commandId, p_actor_user_id: actorId,
        p_repair_code: 'recovery_candidate_register_failed', p_receipt_hash: receipt,
      })
      return out(500, { ok: false, code: 'repair_required' })
    }
    return out(200, {
      ok: true, code: 'owner_recovery_candidate_created', command_id: commandId,
      email, temporary_password: password, password_display_once: true,
    })
  }

  if (mode === 'execute') {
    const { data: context, error: contextError } = await admin.rpc('arg2_get_command_execution_context', {
      p_command_id: commandId, p_actor_user_id: actorId,
    })
    if (contextError || !context?.ok || context.action !== 'owner_recovery') {
      return out(403, { ok: false, code: 'command_read_denied' })
    }
    if (context.state === 'finalized' && context.stage === 'complete') {
      return out(200, { ok: true, code: 'owner_recovery_complete', command_id: commandId, replayed: true })
    }
    let swapped = context
    if (!(context.state === 'repair_required' && context.stage === 'authority_swapped')) {
      const swapResult = await admin.rpc('arg2_execute_owner_swap', {
        p_command_id: commandId, p_executor_user_id: actorId,
      })
      if (swapResult.error || !swapResult.data?.ok) {
        return out(409, { ok: false, code: swapResult.error?.message || 'owner_recovery_swap_failed' })
      }
      swapped = swapResult.data
    }
    const predecessorUserId = typeof swapped.predecessor_user_id === 'string'
      ? swapped.predecessor_user_id
      : ''
    if (!predecessorUserId) return out(500, { ok: false, code: 'repair_required' })
    const { data: predecessor, error: predecessorError } = await admin.auth.admin.getUserById(predecessorUserId)
    const invalidationAlreadyCommitted = predecessor?.user?.user_metadata?.governance_command_id === commandId &&
      predecessor?.user?.user_metadata?.credential_state === 'revoked'
    const invalidationResult = predecessorError || !predecessor?.user
      ? { error: predecessorError || { message: 'predecessor_auth_state_unknown' } }
      : invalidationAlreadyCommitted
        ? { error: null }
        : await admin.auth.admin.updateUserById(predecessorUserId, {
            password: secret(40),
            user_metadata: {
              ...predecessor.user.user_metadata,
              credential_state: 'revoked',
              governance_command_id: commandId,
            },
          })
    const invalidateError = invalidationResult.error
    const receipt = await sha256(`recovery-former-owner-session:${predecessorUserId}:${commandId}:${invalidateError ? 'failed' : 'succeeded'}`)
    const { data: finalized, error: finalError } = await admin.rpc('arg2_finalize_session_invalidation', {
      p_command_id: commandId,
      p_actor_user_id: actorId,
      p_session_invalidation_receipt_hash: receipt,
      p_succeeded: !invalidateError,
      p_repair_code: invalidateError ? 'former_owner_session_invalidation_failed' : null,
    })
    if (invalidateError || finalError || !finalized?.ok) return out(500, { ok: false, code: 'repair_required' })
    return out(200, { ok: true, code: 'owner_recovery_complete', command_id: commandId })
  }

  if (mode === 'cancel') {
    const { data: context, error: contextError } = await admin.rpc('arg2_get_command_execution_context', {
      p_command_id: commandId, p_actor_user_id: actorId,
    })
    if (contextError || !context?.ok || context.action !== 'owner_recovery' || context.stage === 'authority_swapped') {
      return out(403, { ok: false, code: 'recovery_cancel_denied' })
    }
    if (context.state === 'cancelled') {
      return out(200, { ok: true, code: 'owner_recovery_cancelled', command_id: commandId, replayed: true })
    }
    let candidateUserId = typeof context.target_user_id === 'string' ? context.target_user_id : ''
    for (let page = 1; page <= 10 && !candidateUserId; page += 1) {
      const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 100 })
      if (usersError) return out(500, { ok: false, code: 'repair_required' })
      candidateUserId = usersPage.users.find((user) =>
        user.user_metadata?.governance_command_id === commandId)?.id || ''
      if (usersPage.users.length < 100) break
    }
    let receipt = ''
    if (candidateUserId) {
      const { error } = await admin.auth.admin.updateUserById(candidateUserId, {
        password: secret(40),
        user_metadata: { credential_state: 'revoked', governance_command_id: commandId },
      })
      receipt = await sha256(`cancel-recovery-candidate:${candidateUserId}:${commandId}:${error ? 'failed' : 'succeeded'}`)
      if (error) return out(500, { ok: false, code: 'repair_required' })
    }
    const { data: cancelled, error: cancelError } = await admin.rpc('arg2_cancel_pending_command', {
      p_command_id: commandId,
      p_actor_user_id: actorId,
      p_session_invalidation_receipt_hash: receipt || null,
    })
    if (cancelError || !cancelled?.ok) {
      return out(409, { ok: false, code: cancelError?.message || 'recovery_cancel_failed' })
    }
    return out(200, { ok: true, code: 'owner_recovery_cancelled', command_id: commandId })
  }

  return out(400, { ok: false, code: 'invalid_mode' })
})
