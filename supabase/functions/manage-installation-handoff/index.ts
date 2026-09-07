import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>
type AuthUser = { id: string; email?: string; email_confirmed_at?: string; app_metadata?: JsonRecord }

const headers = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const respond = (status: number, body: JsonRecord) => new Response(JSON.stringify(body), { status, headers })
const text = (body: JsonRecord, key: string) => typeof body[key] === 'string' ? String(body[key]).trim() : ''
const bearer = (req: Request) => req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || ''
const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
function randomHex(bytes = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (value) => value.toString(16).padStart(2, '0')).join('')
}
function invalidationPassword() {
  return `A!7${randomHex(30)}`
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
  const actor = actorData?.user as AuthUser | undefined
  if (actorError || !actor?.id || !actor.email) return respond(401, { ok: false, code: 'unauthorized' })

  const reauthenticate = async () => {
    const password = text(body, 'current_password')
    if (!password) return null
    const verifier = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const result = await verifier.auth.signInWithPassword({ email: actor.email || '', password })
    if (result.error || result.data.user?.id !== actor.id) return null
    await verifier.auth.signOut({ scope: 'local' })
    return sha256(`reauth:${actor.id}:${new Date().toISOString().slice(0, 16)}:${randomHex(16)}`)
  }
  const mode = text(body, 'mode')

  if (mode === 'inspect') {
    const { data, error } = await admin.rpc('chb1_inspect_installation_handoff', { p_actor_user_id: actor.id })
    if (error || !data) return respond(403, { ok: false, code: 'handoff_review_denied' })
    return respond(200, { ok: true, code: 'handoff_review_ready', ...data })
  }

  if (mode === 'prepare') {
    const requestId = text(body, 'idempotency_key')
    const targetEmail = text(body, 'target_email').toLowerCase()
    const restoreVerificationId = text(body, 'restore_verification_id')
    const controlVersion = Number(body.expected_control_version)
    if (requestId.length < 8 || !validEmail(targetEmail) || !restoreVerificationId || !Number.isInteger(controlVersion)) {
      return respond(400, { ok: false, code: 'invalid_request' })
    }
    const reauthReceipt = await reauthenticate()
    if (!reauthReceipt) return respond(403, { ok: false, code: 'recent_login_confirmation_required' })

    let target: AuthUser | undefined
    for (let page = 1; page <= 10 && !target; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
      if (error) return respond(500, { ok: false, code: 'identity_review_unavailable' })
      target = data.users.find((user) => user.email?.toLowerCase() === targetEmail) as AuthUser | undefined
      if (data.users.length < 100) break
    }
    if (!target?.id || !target.email_confirmed_at || target.id === actor.id) {
      return respond(409, { ok: false, code: 'confirmed_distinct_handoff_recipient_required' })
    }

    const challenge = randomHex(24)
    const handoffCode = randomHex(32)
    const tokenExpiresAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString()
    const intentHash = await sha256(JSON.stringify([
      'installation_handoff_reset', target.id, restoreVerificationId, controlVersion,
    ]))
    const { data, error } = await admin.rpc('chb1_prepare_handoff_reset', {
      p_request_id: requestId,
      p_intent_hash: intentHash,
      p_actor_user_id: actor.id,
      p_target_user_id: target.id,
      p_expected_control_version: controlVersion,
      p_restore_verification_id: restoreVerificationId,
      p_challenge_digest: await sha256(challenge),
      p_bootstrap_token_digest: await sha256(handoffCode),
      p_bootstrap_token_expires_at: tokenExpiresAt,
      p_reauthentication_receipt_hash: await reauthReceipt,
    })
    if (error || !data?.ok) return respond(409, { ok: false, code: error?.message || 'handoff_prepare_denied' })
    if (data.exact_retry) {
      return respond(409, { ok: false, code: 'existing_handoff_secret_must_be_reused', command_id: data.command_id })
    }
    return respond(200, {
      ok: true,
      code: 'handoff_prepared',
      command_id: data.command_id,
      center_count: data.center_count,
      cooling_until: data.cooling_until,
      expires_at: data.expires_at,
      confirmation_challenge: challenge,
      handoff_code: handoffCode,
      display_once: true,
    })
  }

  const commandId = text(body, 'command_id')
  if (!commandId) return respond(400, { ok: false, code: 'command_required' })

  if (mode === 'cancel') {
    const { data, error } = await admin.rpc('chb1_cancel_handoff_reset', {
      p_command_id: commandId, p_actor_user_id: actor.id,
    })
    if (error || !data?.ok) return respond(409, { ok: false, code: error?.message || 'handoff_cancel_denied' })
    return respond(200, { ok: true, code: 'handoff_cancelled', ...data })
  }

  if (mode === 'arm') {
    const reauthReceipt = await reauthenticate()
    if (!reauthReceipt) return respond(403, { ok: false, code: 'recent_login_confirmation_required' })
    const challenge = text(body, 'confirmation_challenge')
    const phrase = text(body, 'confirmation_phrase')
    const { data, error } = await admin.rpc('chb1_arm_handoff_reset', {
      p_command_id: commandId,
      p_actor_user_id: actor.id,
      p_challenge_digest: await sha256(challenge),
      p_confirmation_phrase: phrase,
      p_reauthentication_receipt_hash: await reauthReceipt,
    })
    if (error || !data?.ok) return respond(409, { ok: false, code: error?.message || 'handoff_arm_denied' })
    return respond(200, { ok: true, code: 'handoff_armed', ...data })
  }

  if (mode === 'execute' || mode === 'repair') {
    const reauthReceipt = await reauthenticate()
    if (!reauthReceipt) return respond(403, { ok: false, code: 'recent_login_confirmation_required' })
    const { data, error } = await admin.rpc('chb1_execute_handoff_reset', {
      p_command_id: commandId, p_actor_user_id: actor.id,
    })
    if (error || !data) return respond(409, { ok: false, code: error?.message || 'handoff_execute_denied' })

    const targets = Array.isArray(data.drain_targets) ? data.drain_targets as JsonRecord[] : []
    const serverTargets = targets
      .filter((target) => target.method === 'SERVER_CREDENTIAL_ROTATION' && target.state !== 'SUCCEEDED')
      .sort((left, right) => {
        const leftIsActor = left.user_id === actor.id ? 1 : 0
        const rightIsActor = right.user_id === actor.id ? 1 : 0
        return leftIsActor - rightIsActor
      })
    let repairRequired = false
    for (const target of serverTargets) {
      const userId = typeof target.user_id === 'string' ? target.user_id : ''
      if (!userId) { repairRequired = true; break }
      const attemptId = crypto.randomUUID()
      const claimed = await admin.rpc('chb1_claim_session_drain', {
        p_command_id: commandId,
        p_actor_user_id: actor.id,
        p_target_user_id: userId,
        p_attempt_id: attemptId,
      })
      if (claimed.error || !claimed.data?.ok) { repairRequired = true; break }
      if (claimed.data.already_succeeded) continue
      if (!claimed.data.claimed) { repairRequired = true; break }
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
      if (rotated.error || recorded.error || !recorded.data?.ok) {
        repairRequired = true
        break
      }
    }
    if (repairRequired) return respond(500, { ok: false, code: 'handoff_needs_review', command_id: commandId })
    return respond(200, {
      ok: true,
      code: 'handoff_history_sealed_waiting_recipient_session_close',
      command_id: commandId,
      session_drain_until: data.session_drain_until,
    })
  }

  return respond(400, { ok: false, code: 'invalid_mode' })
})
