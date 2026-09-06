import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: revoke directly updated center_members from the Edge Function.
 * CURRENT ARG-2 CONTRACT: PREPARED atomically changes membership to revoke_pending,
 * server-side password rotation invalidates refresh sessions, then the RPC finalizes.
 * WHY VALID: immediate business denial and durable audit are preserved without an
 * alternate privileged DML path.
 */
const edge = readFileSync('supabase/functions/revoke-center-admin-access/index.ts', 'utf8')
const migration = readFileSync('supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql', 'utf8')
for (const marker of [
  "p_action: 'revoke_admin'",
  "admin.rpc('arg2_prepare_lifecycle_command'",
  'admin.auth.admin.updateUserById',
  "admin.rpc('arg2_record_external_credential_result'",
  "membership_status: 'revoked'",
  'sessions_invalidated: true',
]) assert(edge.includes(marker), 'ARG-2 revoke marker missing: ' + marker)

assert(edge.indexOf("admin.rpc('arg2_prepare_lifecycle_command'") < edge.indexOf('admin.auth.admin.updateUserById'))
assert(migration.includes("set status = 'revoke_pending'"))
assert(migration.includes("set credential_state = 'locked'"))
assert(migration.includes("set status = 'revoked'"))
assert(!/\.from\(['"]center_members['"]\)/.test(edge))
assert(!edge.includes('deleteUser('))
console.log('C7.7B revoke smoke PASS under ARG-2 durable saga')
