import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>
const headers = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const respond = (status: number, body: JsonRecord) => new Response(JSON.stringify(body), { status, headers })
const text = (body: JsonRecord, key: string) => typeof body[key] === 'string' ? String(body[key]).trim() : ''
const bearer = (req: Request) => req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || ''
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
function randomHex(bytes = 16) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (value) => value.toString(16).padStart(2, '0')).join('')
}
function invalidationPassword() {
  return `A!7${randomHex(30)}`
}
function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return respond(405, { ok: false, code: 'method_not_allowed' })
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !serviceKey || !anonKey) return respond(500, { ok: false, code: 'server_misconfigured' })
  let body: JsonRecord
  try { body = await req.json() } catch { return respond(400, { ok: false, code: 'invalid_request' }) }
  const token = bearer(req)
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  })
  const { data: actorData, error: actorError } = await admin.auth.getUser(token)
  const actor = actorData?.user
  if (actorError || !actor?.id || !actor.email || !actor.email_confirmed_at) {
    return respond(401, { ok: false, code: 'confirmed_login_required' })
  }
  const mode = text(body, 'mode')

  const reconcileServerDrainTargets = async (context: JsonRecord) => {
    const commandId = typeof context.command_id === 'string' ? context.command_id : ''
    const targets = Array.isArray(context.server_drain_targets)
      ? context.server_drain_targets as JsonRecord[]
      : null
    if (!commandId || !targets) return false
    for (const target of targets) {
      if (target.state === 'SUCCEEDED') continue
      const userId = typeof target.user_id === 'string' ? target.user_id : ''
      if (!userId) return false
      const attemptId = crypto.randomUUID()
      const claimed = await admin.rpc('chb1_claim_session_drain', {
        p_command_id: commandId,
        p_actor_user_id: actor.id,
        p_target_user_id: userId,
        p_attempt_id: attemptId,
      })
      if (claimed.error || !claimed.data?.ok) return false
      if (claimed.data.already_succeeded) continue
      if (!claimed.data.claimed) return false
      const existing = await admin.auth.admin.getUserById(userId)
      const alreadyDrained = existing.data.user?.app_metadata?.handoff_command_id === commandId &&
        existing.data.user?.app_metadata?.installation_access === 'sealed'
      const rotated = existing.error || !existing.data.user
        ? { error: existing.error || new Error('identity_state_unknown') }
        : alreadyDrained
          ? { error: null }
          : await admin.auth.admin.updateUserById(userId, {
              password: invalidationPassword(),
              app_metadata: {
                ...existing.data.user.app_metadata,
                installation_access: 'sealed',
                handoff_command_id: commandId,
              },
            })
      const receipt = await sha256(`handoff-session:${commandId}:${userId}:${rotated.error ? 'failed' : 'succeeded'}`)
      const recorded = await admin.rpc('chb1_record_session_drain', {
        p_command_id: commandId,
        p_actor_user_id: actor.id,
        p_target_user_id: userId,
        p_attempt_id: attemptId,
        p_receipt_hash: receipt,
        p_succeeded: !rotated.error,
        p_repair_code: rotated.error ? 'server_session_invalidation_failed' : null,
      })
      if (rotated.error || recorded.error || !recorded.data?.ok) return false
    }
    return true
  }

  if (mode === 'inspect') {
    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data, error } = await userClient.rpc('chb1_get_handoff_capability')
    if (error || !data) return respond(503, { ok: false, code: 'initialization_status_unavailable' })
    return respond(200, { ok: true, code: 'initialization_status_ready', ...data })
  }

  if (mode === 'drain_previous_session') {
    const { data: context, error: contextError } = await admin.rpc('chb1_get_bootstrap_context', {
      p_actor_user_id: actor.id,
    })
    if (contextError || !['SESSION_DRAINING', 'RESET_REPAIR_REQUIRED'].includes(String(context?.state)) ||
        !context.command_id ||
        !['PENDING', 'FAILED', 'SUCCEEDED'].includes(String(context.target_drain_state))) {
      return respond(409, { ok: false, code: 'session_close_not_required' })
    }
    if (!await reconcileServerDrainTargets(context)) {
      return respond(500, { ok: false, code: 'session_close_needs_review' })
    }
    if (context.target_drain_state === 'SUCCEEDED') {
      const promoted = await admin.rpc('chb1_promote_uninitialized_if_drained', {
        p_command_id: context.command_id,
      })
      if (promoted.error) {
        const waiting = String(promoted.error.message || '').includes('chb1_private_url_quarantine_incomplete')
        return waiting
          ? respond(200, {
              ok: true,
              code: 'previous_session_closed_waiting_safety_window',
              sign_in_again: false,
              session_drain_until: context.session_drain_until,
            })
          : respond(500, { ok: false, code: 'session_close_needs_review' })
      }
      return respond(200, {
        ok: true,
        code: 'initialization_ready',
        sign_in_again: false,
        session_drain_until: context.session_drain_until,
      })
    }
    const attemptId = crypto.randomUUID()
    const claimed = await admin.rpc('chb1_claim_session_drain', {
      p_command_id: context.command_id,
      p_actor_user_id: actor.id,
      p_target_user_id: actor.id,
      p_attempt_id: attemptId,
    })
    if (claimed.error || !claimed.data?.ok) {
      return respond(500, { ok: false, code: 'session_close_needs_review' })
    }
    if (claimed.data.already_succeeded) {
      return respond(200, {
        ok: true,
        code: 'previous_session_closed_waiting_safety_window',
        sign_in_again: false,
        session_drain_until: context.session_drain_until,
      })
    }
    if (!claimed.data.claimed) {
      return respond(500, { ok: false, code: 'session_close_needs_review' })
    }
    const signOut = await admin.auth.admin.signOut(token, 'global')
    const receipt = await sha256(`handoff-target-signout:${context.command_id}:${actor.id}:${signOut.error ? 'failed' : 'succeeded'}`)
    const recorded = await admin.rpc('chb1_record_session_drain', {
      p_command_id: context.command_id,
      p_actor_user_id: actor.id,
      p_target_user_id: actor.id,
      p_attempt_id: attemptId,
      p_receipt_hash: receipt,
      p_succeeded: !signOut.error,
      p_repair_code: signOut.error ? 'target_session_invalidation_failed' : null,
    })
    if (signOut.error || recorded.error || !recorded.data?.ok) {
      return respond(500, { ok: false, code: 'session_close_needs_review' })
    }
    const promoted = await admin.rpc('chb1_promote_uninitialized_if_drained', {
      p_command_id: context.command_id,
    })
    if (promoted.error &&
        !String(promoted.error.message || '').includes('chb1_private_url_quarantine_incomplete')) {
      return respond(500, { ok: false, code: 'session_close_needs_review' })
    }
    return respond(200, {
      ok: true,
      code: promoted.error ? 'previous_session_closed_waiting_safety_window' : 'initialization_ready',
      sign_in_again: true,
      session_drain_until: context.session_drain_until,
    })
  }

  if (mode === 'claim') {
    const password = text(body, 'current_password')
    const handoffCode = text(body, 'handoff_code')
    const centerName = text(body, 'center_name')
    const requestId = text(body, 'idempotency_key')
    if (!password || handoffCode.length < 32 || centerName.length < 2 || requestId.length < 8) {
      return respond(400, { ok: false, code: 'initialization_information_incomplete' })
    }
    const verifier = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const verified = await verifier.auth.signInWithPassword({ email: actor.email, password })
    if (verified.error || verified.data.user?.id !== actor.id) {
      return respond(403, { ok: false, code: 'recent_login_confirmation_required' })
    }
    await verifier.auth.signOut({ scope: 'local' })
    const slug = slugify(centerName)
    const intentHash = await sha256(JSON.stringify(['first_owner_bootstrap', actor.id, centerName.trim(), slug]))
    const reauthReceipt = await sha256(`bootstrap-reauth:${actor.id}:${requestId}:${randomHex()}`)
    const { data, error } = await admin.rpc('chb1_claim_first_owner', {
      p_request_id: requestId,
      p_intent_hash: intentHash,
      p_actor_user_id: actor.id,
      p_token_digest: await sha256(handoffCode),
      p_center_name: centerName,
      p_center_slug: slug,
      p_reauthentication_receipt_hash: reauthReceipt,
    })
    if (error || !data?.ok) return respond(409, { ok: false, code: error?.message || 'initialization_denied' })
    return respond(200, {
      ok: true,
      code: 'initialization_complete',
      center_id: data.center_id,
      exact_retry: data.exact_retry,
    })
  }

  return respond(400, { ok: false, code: 'invalid_mode' })
})
