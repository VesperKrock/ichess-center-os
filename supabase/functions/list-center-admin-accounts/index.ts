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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return response(405, { ok: false, code: 'method_not_allowed' })
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return response(500, { ok: false, code: 'server_misconfigured' })

  let body: JsonRecord
  try { body = await req.json() } catch { return response(400, { ok: false, code: 'invalid_request' }) }
  const centerIds = Array.isArray(body.center_ids)
    ? [...new Set(body.center_ids.map((value) => String(value || '').trim()).filter(Boolean))].sort()
    : []
  if (!centerIds.length || centerIds.length > 100) return response(400, { ok: false, code: 'invalid_center_list' })

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  })
  const { data: actorData, error: actorError } = await admin.auth.getUser(tokenOf(req))
  if (actorError || !actorData?.user?.id) return response(401, { ok: false, code: 'unauthorized' })

  const { data, error } = await admin.rpc('arg2_list_center_account_lifecycle', {
    p_center_ids: centerIds,
    p_actor_user_id: actorData.user.id,
  })
  if (error) {
    const unavailable = error.code === 'PGRST202' || error.code === '42883'
    if (!unavailable) {
      return response(403, { ok: false, code: 'account_governance_read_denied' })
    }

    // Frontend-first rollout: a missing ARG-2 RPC is UNAVAILABLE, not FAILED.
    // Re-authorize every requested center from membership authority before
    // returning even this minimal capability state; guessed centers fail closed.
    const { data: ownerRows, error: ownerError } = await admin
      .from('center_members')
      .select('center_id')
      .in('center_id', centerIds)
      .eq('user_id', actorData.user.id)
      .eq('role', 'owner')
      .eq('status', 'active')
    const ownedCenterIds = new Set((ownerRows || []).map((row) => String(row.center_id || '')))
    if (ownerError) {
      return response(503, { ok: false, code: 'account_governance_read_failed' })
    }
    if (centerIds.some((centerId) => !ownedCenterIds.has(centerId))) {
      return response(403, { ok: false, code: 'account_governance_read_denied' })
    }
    return response(200, {
      ok: true,
      code: 'center_admin_accounts_loaded',
      centers: centerIds.map((centerId) => ({
        center_id: centerId,
        capability: 'unavailable',
        governance_version: null,
        owner_membership_id: null,
        owner_membership_version: null,
        owner_handoff: null,
        admin: { exists: false, state: 'none' },
      })),
    })
  }

  const centers = await Promise.all((Array.isArray(data?.centers) ? data.centers : []).map(async (row: JsonRecord) => {
    const account = row.admin && typeof row.admin === 'object' ? row.admin as JsonRecord : { exists: false, state: 'none' }
    const userId = typeof account.user_id === 'string' ? account.user_id : ''
    if (!userId) return row
    const { data: userData } = await admin.auth.admin.getUserById(userId)
    return {
      ...row,
      admin: {
        ...account,
        email: userData?.user?.email || '',
      },
    }
  }))

  return response(200, { ok: true, code: 'center_admin_accounts_loaded', centers })
})
