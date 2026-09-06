import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: the status endpoint queried membership/Auth independently and its
 * legacy response became UI authority.
 * CURRENT ARG-2 CONTRACT: a service-only RPC returns exact-center governance
 * capability plus versioned canonical pointers; Auth enriches email only. During
 * frontend-first rollout, a missing RPC may return `unavailable` only after the
 * caller is independently re-authorized as Owner for every requested center.
 * WHY VALID: the UI retains useful status while database authority stays singular.
 * The fallback remains fail-closed and cannot disclose capability state for a
 * guessed or foreign center.
 */
const edge = readFileSync('supabase/functions/list-center-admin-accounts/index.ts', 'utf8')
const main = readFileSync('src/main.js', 'utf8')
const migration = readFileSync('supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql', 'utf8')
for (const marker of [
  "admin.rpc('arg2_list_center_account_lifecycle'",
  'p_center_ids: centerIds',
  'p_actor_user_id: actorData.user.id',
  ".from('center_members')",
  ".eq('role', 'owner')",
  "capability: 'unavailable'",
  'account_governance_read_denied',
  'admin.auth.admin.getUserById',
]) assert(edge.includes(marker), 'ARG-2 list marker missing: ' + marker)

assert(migration.includes('create function public.arg2_list_center_account_lifecycle'))
assert(migration.includes("when owner_membership.user_id = p_actor_user_id"))
assert(main.includes('normalizeInternalCenterAdminAccounts'))
assert(main.includes('normalizeAccountGovernanceCapability'))
assert(edge.includes(".select('center_id')"), 'fallback must read only the minimal center-membership field')
assert(!/\.from\(['"]center_members['"]\)[\s\S]{0,120}\.(?:insert|update|delete|upsert)\(/.test(edge),
  'status endpoint must never mutate center membership')
console.log('C7.8B account status wiring PASS under ARG-2 canonical list RPC')
