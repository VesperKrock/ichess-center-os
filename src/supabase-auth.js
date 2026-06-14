import { getSupabaseClient } from './supabase-client.js'

export const CURRENT_CENTER_ID = 'dreamhome'

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
    .select('role')
    .eq('center_id', centerId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}
