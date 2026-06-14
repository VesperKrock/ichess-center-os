import { createClient } from '@supabase/supabase-js'

let supabaseClient = null

function resolveSupabaseConfig(env = import.meta.env) {
  const url = String(env?.VITE_SUPABASE_URL ?? '').trim()
  const publishableKey = String(env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
  const anonKey = String(env?.VITE_SUPABASE_ANON_KEY ?? '').trim()
  const key = publishableKey || anonKey

  return {
    status: url && key ? 'configured' : 'missing-config',
    url,
    key,
    keySource: publishableKey
      ? 'VITE_SUPABASE_PUBLISHABLE_KEY'
      : anonKey
        ? 'VITE_SUPABASE_ANON_KEY'
        : null,
  }
}

export function getSupabaseConfigStatus(env = import.meta.env) {
  const config = resolveSupabaseConfig(env)

  return {
    status: config.status,
    keySource: config.keySource,
  }
}

export function isSupabaseConfigured(env = import.meta.env) {
  return getSupabaseConfigStatus(env).status === 'configured'
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null
  }

  if (!supabaseClient) {
    const config = resolveSupabaseConfig()
    supabaseClient = createClient(config.url, config.key)
  }

  return supabaseClient
}
