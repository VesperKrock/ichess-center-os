import { getSupabaseClient } from './supabase-client.js'

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
    .select('center_id, role, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('center_id', { ascending: true })

  if (error) {
    throw error
  }

  return Array.isArray(data) ? data : []
}

export async function resolveActiveCenterMembership(userId) {
  const memberships = await listActiveCenterMemberships(userId)

  if (memberships.length === 0) {
    return {
      ok: false,
      status: 'missing',
      centerId: '',
      centerName: '',
      role: null,
      membership: null,
      memberships,
      message: 'Tai khoan chua duoc gan co so active trong center_members.',
    }
  }

  const membership = memberships[0]
  const centerId = membership.center_id || ''

  return {
    ok: true,
    status: memberships.length > 1 ? 'multiple' : 'loaded',
    centerId,
    centerName: getCenterDisplayName(centerId),
    role: membership.role ?? null,
    membership,
    memberships,
    message: memberships.length > 1
      ? 'Tai khoan co nhieu co so active; app dang dung co so dau tien theo thu tu center_id.'
      : '',
  }
}
