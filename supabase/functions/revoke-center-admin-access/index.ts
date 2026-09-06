import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>
const headers = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const response = (status: number, body: JsonRecord) => new Response(JSON.stringify(body), { status, headers })
const val = (body: JsonRecord, key: string) => typeof body[key] === 'string' ? String(body[key]).trim() : ''
const tokenOf = (req: Request) => req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || ''
const replacementSecret = () => {
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
  const centerId = val(body, 'center_id')
  const requestId = val(body, 'idempotency_key')
  const membershipId = val(body, 'target_membership_id')
  const governanceVersion = Number(body.expected_governance_version)
  const membershipVersion = Number(body.expected_membership_version)
  if (!centerId || requestId.length < 8 || !membershipId ||
      !Number.isInteger(governanceVersion) || !Number.isInteger(membershipVersion)) {
    return response(400, { ok: false, code: 'invalid_request' })
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  })
  const { data: actorData, error: actorError } = await admin.auth.getUser(tokenOf(req))
  if (actorError || !actorData?.user?.id) return response(401, { ok: false, code: 'unauthorized' })
  const actorId = actorData.user.id
  const intentHash = await sha256(JSON.stringify([
    'revoke_admin', centerId, membershipId, governanceVersion, membershipVersion,
  ]))
  const { data: prepared, error: prepareError } = await admin.rpc('arg2_prepare_lifecycle_command', {
    p_center_id: centerId,
    p_request_id: requestId,
    p_action: 'revoke_admin',
    p_intent_hash: intentHash,
    p_actor_user_id: actorId,
    p_expected_governance_version: governanceVersion,
    p_target_membership_id: membershipId,
    p_expected_membership_version: membershipVersion,
    p_target_email_hash: null,
    p_target_email_masked: null,
    p_expires_at: null,
    p_safe_context: {},
  })
  if (prepareError) return response(409, { ok: false, code: prepareError.message || 'prepare_failed' })
  if (prepared?.replayed && prepared.state === 'finalized' && prepared.stage === 'complete') {
    return response(200, {
      ok: true,
      code: 'center_admin_access_revoked',
      command_id: prepared.command_id,
      center_id: centerId,
      membership_status: 'revoked',
      sessions_invalidated: true,
      replayed: true,
    })
  }
  if (prepared?.replayed && (
    !['prepared', 'repair_required'].includes(String(prepared.state)) ||
    prepared.stage !== 'prepared' ||
    body.repair !== true
  )) {
    return response(409, { ok: false, code: 'repair_required' })
  }
  const targetUserId = String(prepared?.target_user_id || '')
  if (!targetUserId) return response(500, { ok: false, code: 'prepared_target_missing' })

  if (prepared?.replayed && prepared.state === 'prepared') {
    const repairReceipt = await sha256(`session-invalidation-reissue-prepared:${targetUserId}:${prepared.command_id}`)
    const { error: repairError } = await admin.rpc('arg2_mark_command_repair_required', {
      p_command_id: prepared.command_id,
      p_actor_user_id: actorId,
      p_repair_code: 'session_invalidation_reissue_required',
      p_receipt_hash: repairReceipt,
    })
    if (repairError) return response(500, { ok: false, code: 'repair_required' })
  }

  const { data: currentTarget, error: currentTargetError } = await admin.auth.admin.getUserById(targetUserId)
  if (currentTargetError || !currentTarget?.user) {
    const unknownReceipt = await sha256(`auth-revoke-state-unknown:${targetUserId}:${prepared.command_id}`)
    await admin.rpc('arg2_mark_command_repair_required', {
      p_command_id: prepared.command_id,
      p_actor_user_id: actorId,
      p_repair_code: 'session_invalidation_state_unknown',
      p_receipt_hash: unknownReceipt,
    })
    return response(500, { ok: false, code: 'repair_required' })
  }
  const authAlreadyCommitted = currentTarget.user.user_metadata?.governance_command_id === prepared.command_id &&
    currentTarget.user.user_metadata?.credential_state === 'revoked'
  const authResult = authAlreadyCommitted
    ? { error: null }
    : await admin.auth.admin.updateUserById(targetUserId, {
        password: replacementSecret(),
        user_metadata: {
          ...currentTarget.user.user_metadata,
          credential_state: 'revoked',
          governance_command_id: prepared.command_id,
        },
      })
  const authError = authResult.error
  const receipt = await sha256(`auth-session-revocation:${targetUserId}:${requestId}:${authError ? 'failed' : 'succeeded'}`)
  const { data: recorded, error: recordError } = await admin.rpc('arg2_record_external_credential_result', {
    p_command_id: prepared.command_id,
    p_target_user_id: targetUserId,
    p_external_receipt_hash: receipt,
    p_succeeded: !authError,
    p_repair_code: authError ? 'session_invalidation_failed' : null,
  })
  if (authError || recordError || !recorded?.ok) return response(500, { ok: false, code: 'repair_required' })

  return response(200, {
    ok: true,
    code: 'center_admin_access_revoked',
    command_id: prepared.command_id,
    center_id: centerId,
    membership_status: 'revoked',
    sessions_invalidated: true,
  })
})
