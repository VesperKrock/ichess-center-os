import { getSupabaseClient } from './supabase-client.js'
import {
  BLOCKED_MEMBERSHIP_STATES,
  getCredentialGate,
  isCredentialChangeRequired,
} from './account-lifecycle.js'

export const CURRENT_CENTER_ID = 'dreamhome'
export const PRODUCTION_CENTER_ID = 'dreamhome_prod'

const CENTER_DISPLAY_NAMES = Object.freeze({
  dreamhome: 'DreamHome staging',
  dreamhome_prod: 'DreamHome',
})

function requireSupabaseClient() {
  const client = getSupabaseClient()

  if (!client) {
    throw new Error('Chưa cấu hình Supabase.')
  }

  return client
}

export async function signInWithEmailPassword(email, password) {
  const client = requireSupabaseClient()
  const { data, error } = await client.auth.signInWithPassword({
    email: String(email ?? '').trim(),
    password: String(password ?? ''),
  })

  if (error) {
    throw error
  }

  return data.user
}

export async function signOutSupabase() {
  const client = requireSupabaseClient()
  const { error } = await client.auth.signOut()

  if (error) {
    throw error
  }
}

export async function getCurrentSupabaseUser() {
  const client = getSupabaseClient()

  if (!client) {
    return null
  }

  const { data, error } = await client.auth.getUser()

  if (error) {
    throw error
  }

  return data.user
}

export function onSupabaseAuthStateChange(callback) {
  const client = getSupabaseClient()

  if (!client) {
    return () => {}
  }

  const { data } = client.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user ?? null)
  })

  return () => data.subscription.unsubscribe()
}

export async function getCurrentCenterMembership(userId, centerId = CURRENT_CENTER_ID) {
  if (!userId) {
    return null
  }

  const client = requireSupabaseClient()
  const { data, error } = await client
    .from('center_members')
    .select('center_id, role, status')
    .eq('center_id', centerId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export function getCenterDisplayName(centerId) {
  return CENTER_DISPLAY_NAMES[String(centerId ?? '').trim()] || String(centerId ?? '').trim()
}

export async function listActiveCenterMemberships(userId) {
  if (!userId) {
    return []
  }

  const client = requireSupabaseClient()
  const { data, error } = await client
    .from('center_members')
    .select('id, center_id, role, status, membership_version')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('center_id', { ascending: true })

  if (error) {
    throw error
  }

  return Array.isArray(data) ? data : []
}

export async function listCenterMemberships(userId) {
  if (!userId) {
    return []
  }

  const client = requireSupabaseClient()
  const { data, error } = await client
    .from('center_members')
    .select('id, center_id, role, status, membership_version')
    .eq('user_id', userId)
    .order('center_id', { ascending: true })

  if (error) {
    throw error
  }

  return Array.isArray(data) ? data : []
}

function getAccessDeniedReason(memberships = []) {
  if (!memberships.length) {
    return 'no_membership'
  }

  const statuses = memberships.map((membership) =>
    String(membership?.status || '').trim().toLowerCase(),
  )

  if (statuses.includes('revoked')) {
    return 'revoked'
  }

  if (statuses.includes('paused')) {
    return 'paused'
  }

  if (statuses.some((status) => BLOCKED_MEMBERSHIP_STATES.has(status))) {
    return 'credential_change_required'
  }

  return 'unknown'
}

export async function resolveActiveCenterMembership(userId) {
  const memberships = await listCenterMemberships(userId)
  const activeMemberships = memberships.filter((membership) =>
    String(membership?.status || '').trim().toLowerCase() === 'active',
  )

  if (activeMemberships.length === 0) {
    const credentialGates = await getCurrentCredentialGates().catch(() => [])
    const credentialGate = getCredentialGate(credentialGates)
    const accessDeniedReason = getAccessDeniedReason(memberships)
    const deniedMembership = memberships[0] || null
    const centerId = deniedMembership?.center_id || credentialGate?.center_id || ''

    return {
      ok: false,
      status: 'denied',
      centerId,
      centerName: centerId ? getCenterDisplayName(centerId) : '',
      role: null,
      membership: null,
      memberships,
      deniedMemberships: memberships,
      accessDeniedReason,
      credentialChangeRequired: isCredentialChangeRequired(credentialGates),
      credentialGate,
      message: getAccessDeniedMessage(accessDeniedReason),
    }
  }

  const membership = activeMemberships[0]
  const centerId = membership.center_id || ''

  return {
    ok: true,
    status: activeMemberships.length > 1 ? 'multiple' : 'loaded',
    centerId,
    centerName: getCenterDisplayName(centerId),
    role: membership.role ?? null,
    membership,
    memberships: activeMemberships,
    deniedMemberships: memberships.filter((item) =>
      String(item?.status || '').trim().toLowerCase() !== 'active',
    ),
    accessDeniedReason: '',
    message: activeMemberships.length > 1
      ? 'Tai khoan co nhieu co so active; app dang dung co so dau tien theo thu tu center_id.'
      : '',
  }
}

export async function getCurrentCredentialGates() {
  const client = requireSupabaseClient()
  const { data, error } = await client.rpc('arg2_get_my_credential_gate')
  if (error) {
    const code = String(error.code || '')
    if (code === 'PGRST202' || code === 'PGRST205' || code === '42883') {
      return []
    }
    throw error
  }
  return Array.isArray(data?.gates) ? data.gates : []
}

export async function completeRequiredCredentialChange({ commandId, newPassword }) {
  const client = requireSupabaseClient()
  const { data, error } = await client.functions.invoke('complete-account-credential-change', {
    body: {
      command_id: String(commandId || '').trim(),
      new_password: String(newPassword || ''),
    },
  })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.code || 'credential_change_failed')
  return data
}

function getAccessDeniedMessage(reason) {
  if (reason === 'revoked') {
    return 'Quyen truy cap cua tai khoan nay da duoc thu hoi.'
  }

  if (reason === 'paused') {
    return 'Quyen truy cap cua tai khoan nay dang tam dung.'
  }

  if (reason === 'no_membership') {
    return 'Tai khoan nay chua duoc cap quyen truy cap co so.'
  }

  if (reason === 'credential_change_required') {
    return 'Bạn cần đổi mật khẩu tạm trước khi sử dụng dữ liệu của cơ sở.'
  }

  return 'Tai khoan nay chua co quyen truy cap dang hoat dong.'
}
