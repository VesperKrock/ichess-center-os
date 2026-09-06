import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>
const headers = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const response = (status: number, body: JsonRecord) => new Response(JSON.stringify(body), { status, headers })
const tokenOf = (req: Request) => req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || ''
const randomSecret = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+'
  const chars = Array.from(crypto.getRandomValues(new Uint8Array(40)), (byte) => alphabet[byte % alphabet.length])
  chars.splice(0, 4, 'A', 'a', '7', '!')
  return chars.join('')
}
async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return response(405, { ok: false, code: 'method_not_allowed' })
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return response(500, { ok: false, code: 'server_misconfigured' })

  let body: JsonRecord
  try { body = await req.json() } catch { return response(400, { ok: false, code: 'invalid_request' }) }
  const commandId = typeof body.command_id === 'string' ? body.command_id.trim() : ''
  const newPassword = typeof body.new_password === 'string' ? body.new_password : ''
  if (!commandId || newPassword.length < 12 || newPassword.length > 128 ||
      !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return response(400, { ok: false, code: 'password_requirements_not_met' })
  }

  const token = tokenOf(req)
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user?.id) return response(401, { ok: false, code: 'unauthorized' })
  const targetUserId = userData.user.id

  const { data: validation, error: validationError } = await admin.rpc('arg2_validate_credential_change', {
    p_command_id: commandId,
    p_target_user_id: targetUserId,
  })
  if (validationError || !validation?.ok) return response(403, { ok: false, code: 'credential_change_not_allowed' })

  const operation = String(validation.operation || 'change_credential')
  if (operation === 'already_complete') {
    return response(200, {
      ok: true,
      code: 'credential_change_complete',
      center_id: validation.center_id,
      command_id: commandId,
      requires_fresh_login: true,
      replayed: true,
    })
  }
  let authAlreadyCommitted = false
  let currentTargetMetadata: Record<string, unknown> = {}
  if (operation === 'change_credential') {
    const { data: currentTarget, error: currentTargetError } = await admin.auth.admin.getUserById(targetUserId)
    if (currentTargetError || !currentTarget?.user) {
      const unknownReceipt = await sha256(`auth-target-state-unknown:${targetUserId}:${commandId}`)
      await admin.rpc('arg2_mark_command_repair_required', {
        p_command_id: commandId,
        p_actor_user_id: targetUserId,
        p_repair_code: 'target_auth_state_unknown',
        p_receipt_hash: unknownReceipt,
      })
      return response(500, { ok: false, code: 'repair_required' })
    }
    currentTargetMetadata = currentTarget.user.user_metadata || {}
    authAlreadyCommitted = currentTargetMetadata.governance_command_id === commandId &&
      currentTargetMetadata.credential_state === 'ready'
  }
  let authError: { message?: string } | null = null
  if (operation === 'change_credential' && !authAlreadyCommitted) {
    const authResult = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
      user_metadata: {
        ...currentTargetMetadata,
        credential_state: 'ready',
        governance_command_id: commandId,
      },
    })
    authError = authResult.error
  }
  const receipt = await sha256(`auth-target-password-replaced:${targetUserId}:${commandId}:${authError ? 'failed' : 'succeeded'}`)
  if (authError) {
    await admin.rpc('arg2_mark_command_repair_required', {
      p_command_id: commandId,
      p_actor_user_id: targetUserId,
      p_repair_code: 'target_password_change_failed',
      p_receipt_hash: receipt,
    })
    return response(500, { ok: false, code: 'repair_required' })
  }

  let completed: JsonRecord = {
    ok: true,
    stage: 'authority_swapped',
    predecessor_user_id: validation.predecessor_user_id,
  }
  if (operation !== 'resume_session_invalidation') {
    const completeResult = await admin.rpc('arg2_complete_credential_change', {
      p_command_id: commandId,
      p_target_user_id: targetUserId,
      p_external_receipt_hash: receipt,
    })
    completed = completeResult.data || {}
    if (completeResult.error || !completed?.ok) {
      await admin.rpc('arg2_mark_command_repair_required', {
        p_command_id: commandId,
        p_actor_user_id: targetUserId,
        p_repair_code: 'credential_changed_database_finalize_failed',
        p_receipt_hash: receipt,
      })
      return response(500, { ok: false, code: 'repair_required' })
    }
  }

  const predecessorUserId = typeof completed.predecessor_user_id === 'string'
    ? completed.predecessor_user_id
    : ''
  if (completed.stage === 'authority_swapped' && predecessorUserId) {
    const { data: predecessor, error: predecessorError } = await admin.auth.admin.getUserById(predecessorUserId)
    const invalidationAlreadyCommitted = predecessor?.user?.user_metadata?.governance_command_id === commandId &&
      predecessor?.user?.user_metadata?.credential_state === 'revoked'
    const invalidationResult = predecessorError || !predecessor?.user
      ? { error: predecessorError || { message: 'predecessor_auth_state_unknown' } }
      : invalidationAlreadyCommitted
        ? { error: null }
        : await admin.auth.admin.updateUserById(predecessorUserId, {
            password: randomSecret(),
            user_metadata: {
              ...predecessor.user.user_metadata,
              credential_state: 'revoked',
              governance_command_id: commandId,
            },
          })
    const invalidateError = invalidationResult.error
    const invalidationReceipt = await sha256(`auth-predecessor-session-revoked:${predecessorUserId}:${commandId}:${invalidateError ? 'failed' : 'succeeded'}`)
    const { data: finalized, error: finalizeError } = await admin.rpc('arg2_finalize_session_invalidation', {
      p_command_id: commandId,
      p_actor_user_id: targetUserId,
      p_session_invalidation_receipt_hash: invalidationReceipt,
      p_succeeded: !invalidateError,
      p_repair_code: invalidateError ? 'predecessor_session_invalidation_failed' : null,
    })
    if (invalidateError || finalizeError || !finalized?.ok) {
      return response(500, { ok: false, code: 'repair_required' })
    }
  }

  return response(200, {
    ok: true,
    code: completed.stage === 'target_ready' ? 'credential_ready_awaiting_owner_action' : 'credential_change_complete',
    center_id: validation.center_id,
    command_id: commandId,
    requires_fresh_login: true,
  })
})
