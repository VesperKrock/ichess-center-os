import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>

type CenterRow = {
  id: string
  name: string | null
  slug: string | null
  environment: string | null
  status: string | null
}

type CenterMemberRow = {
  center_id: string
  user_id: string
  role: string | null
  status: string | null
  created_at?: string | null
  updated_at?: string | null
}

const FUNCTION_BUSINESS_NAME = 'list_center_admin_accounts'
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

function getBearerToken(req: Request) {
  const authorization = req.headers.get('Authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

async function readRequestBody(req: Request) {
  try {
    const rawBody = await req.text()
    if (!rawBody.trim()) {
      return {}
    }

    const body = JSON.parse(rawBody)
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as JsonRecord) : null
  } catch {
    return null
  }
}

function hasForbiddenClientField(body: JsonRecord) {
  return Object.keys(body).some((key) => FORBIDDEN_CLIENT_FIELDS.has(key.toLowerCase()))
}

function normalizeRequestedCenterIds(value: unknown) {
  if (value === undefined) {
    return { ok: true, centerIds: [] as string[] }
  }

  if (!Array.isArray(value)) {
    return { ok: false, centerIds: [] as string[] }
  }

  const centerIds = Array.from(
    new Set(
      value
        .map((centerId) => (typeof centerId === 'string' ? centerId.trim() : ''))
        .filter(Boolean),
    ),
  )

  return { ok: true, centerIds }
}

function toSet(values: string[]) {
  return new Set(values.filter(Boolean))
}

function getMembershipTimestamp(membership: CenterMemberRow) {
  const rawTimestamp = membership.updated_at || membership.created_at || ''
  const timestamp = rawTimestamp ? Date.parse(rawTimestamp) : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

function compareMembershipsForLifecycle(a: CenterMemberRow, b: CenterMemberRow) {
  const timestampDiff = getMembershipTimestamp(b) - getMembershipTimestamp(a)
  if (timestampDiff !== 0) {
    return timestampDiff
  }

  return String(a.user_id || '').localeCompare(String(b.user_id || ''))
}

function getLifecycleAdminMembership(memberships: CenterMemberRow[]) {
  const activeAdmins = memberships.filter((membership) => membership.status === 'active')
  if (activeAdmins.length > 0) {
    return {
      state: activeAdmins.length > 1 ? 'multiple_active_admins' : 'active',
      memberships: activeAdmins,
      membership: activeAdmins.length === 1 ? activeAdmins[0] : null,
    }
  }

  const revokedAdmins = memberships
    .filter((membership) => membership.status === 'revoked')
    .sort(compareMembershipsForLifecycle)

  if (revokedAdmins.length > 0) {
    return {
      state: 'revoked',
      memberships: revokedAdmins,
      membership: revokedAdmins[0],
    }
  }

  return {
    state: 'none',
    memberships: [] as CenterMemberRow[],
    membership: null,
  }
}

async function getAdminEmailByUserId(adminClient: ReturnType<typeof createClient>, userId: string) {
  if (!userId) {
    return null
  }

  const { data, error } = await adminClient.auth.admin.getUserById(userId)
  if (error || !data?.user?.id) {
    safeLog('admin_email_lookup', 'auth_user_lookup_failed', { target_user_id: userId })
    return null
  }

  return data.user.email || null
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

  const requestedCenterIds = normalizeRequestedCenterIds(body.center_ids)
  if (!requestedCenterIds.ok) {
    return safeError(400, 'invalid_request')
  }

  const { data: actorData, error: actorError } = await adminClient.auth.getUser(token)
  const actorUser = actorData?.user
  if (actorError || !actorUser?.id) {
    return safeError(401, 'unauthorized')
  }

  const { data: ownerMemberships, error: ownerMembershipError } = await adminClient
    .from('center_members')
    .select('center_id, user_id, role, status')
    .eq('user_id', actorUser.id)
    .eq('role', 'owner')
    .eq('status', 'active')

  if (ownerMembershipError) {
    safeLog('owner_scope', 'owner_membership_query_failed', { actor_user_id: actorUser.id })
    return safeError(500, 'account_status_query_failed')
  }

  const ownedCenterIds = (Array.isArray(ownerMemberships) ? ownerMemberships : [])
    .map((membership) => String((membership as CenterMemberRow)?.center_id || '').trim())
    .filter(Boolean)

  if (!ownedCenterIds.length) {
    return safeError(403, 'forbidden_owner_required')
  }

  const requestedSet = toSet(requestedCenterIds.centerIds)
  const scopedCenterIds = requestedSet.size
    ? ownedCenterIds.filter((centerId) => requestedSet.has(centerId))
    : ownedCenterIds

  if (!scopedCenterIds.length) {
    return jsonResponse(200, {
      ok: true,
      code: 'center_admin_accounts_loaded',
      centers: [],
    })
  }

  const { data: centerRows, error: centerError } = await adminClient
    .from('centers')
    .select('id, name, slug, environment, status')
    .in('id', scopedCenterIds)
    .eq('environment', 'production')
    .eq('status', 'active')
    .order('name', { ascending: true })

  if (centerError) {
    safeLog('center_scope', 'center_query_failed', { actor_user_id: actorUser.id })
    return safeError(500, 'account_status_query_failed')
  }

  const productionCenters = (Array.isArray(centerRows) ? centerRows : []) as CenterRow[]
  if (!productionCenters.length) {
    return jsonResponse(200, {
      ok: true,
      code: 'center_admin_accounts_loaded',
      centers: [],
    })
  }

  const productionCenterIds = productionCenters.map((center) => center.id).filter(Boolean)
  const { data: adminMembershipRows, error: adminMembershipError } = await adminClient
    .from('center_members')
    .select('center_id, user_id, role, status, created_at, updated_at')
    .in('center_id', productionCenterIds)
    .eq('role', 'center_admin')
    .in('status', ['active', 'revoked'])
    .order('center_id', { ascending: true })

  if (adminMembershipError) {
    safeLog('admin_account_lookup', 'admin_membership_query_failed', { actor_user_id: actorUser.id })
    return safeError(500, 'account_status_query_failed')
  }

  const adminMemberships = (Array.isArray(adminMembershipRows) ? adminMembershipRows : []) as CenterMemberRow[]
  const adminMembershipsByCenter = adminMemberships.reduce<Record<string, CenterMemberRow[]>>((map, membership) => {
    const centerId = String(membership?.center_id || '').trim()
    if (!centerId) {
      return map
    }

    map[centerId] = map[centerId] || []
    map[centerId].push(membership)
    return map
  }, {})

  const centers = []
  for (const center of productionCenters) {
    const lifecycle = getLifecycleAdminMembership(adminMembershipsByCenter[center.id] || [])

    if (lifecycle.state === 'none') {
      centers.push({
        center_id: center.id,
        center_name: center.name,
        slug: center.slug,
        environment: center.environment,
        center_status: center.status,
        admin: {
          exists: false,
          email: null,
          user_id: null,
          membership_status: null,
          state: 'none',
          is_active: false,
          is_revoked: false,
          can_restore: false,
          source: 'center_members',
        },
      })
      continue
    }

    if (lifecycle.state === 'multiple_active_admins') {
      centers.push({
        center_id: center.id,
        center_name: center.name,
        slug: center.slug,
        environment: center.environment,
        center_status: center.status,
        admin: {
          exists: true,
          email: null,
          user_id: null,
          membership_status: 'active',
          state: 'multiple_active_admins',
          is_active: true,
          is_revoked: false,
          can_restore: false,
          source: 'center_members',
        },
      })
      continue
    }

    const adminMembership = lifecycle.membership as CenterMemberRow
    const adminUserId = String(adminMembership?.user_id || '').trim()
    const adminEmail = await getAdminEmailByUserId(adminClient, adminUserId)
    const membershipStatus = adminMembership.status || lifecycle.state
    const isRevoked = membershipStatus === 'revoked'

    centers.push({
      center_id: center.id,
      center_name: center.name,
      slug: center.slug,
      environment: center.environment,
      center_status: center.status,
      admin: {
        exists: true,
        email: adminEmail,
        user_id: adminUserId || null,
        membership_status: membershipStatus,
        state: isRevoked ? 'revoked' : adminEmail ? 'active' : 'email_unavailable',
        is_active: membershipStatus === 'active',
        is_revoked: isRevoked,
        can_restore: isRevoked,
        source: 'center_members',
      },
    })
  }

  return jsonResponse(200, {
    ok: true,
    code: 'center_admin_accounts_loaded',
    centers,
  })
})
