import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: this structural smoke encoded a single production center and direct
 * audit-action names.
 * CURRENT ARG-2 CONTRACT: rollout centers are explicitly activated in server governance;
 * revoke/restore are generic exact-center sagas and ARG-2 performs no live mutation.
 * WHY VALID: center isolation and lifecycle ordering are still asserted without turning a
 * historical production fixture into permanent authority.
 */
const revoke = readFileSync('supabase/functions/revoke-center-admin-access/index.ts', 'utf8')
const restore = readFileSync('supabase/functions/restore-center-admin-access/index.ts', 'utf8')
const migration = readFileSync('supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql', 'utf8')
for (const [source, action] of [[revoke, 'revoke_admin'], [restore, 'restore_admin']]) {
  assert(source.includes("admin.rpc('arg2_prepare_lifecycle_command'"))
  assert(source.includes("p_action: '" + action + "'"))
  assert(source.includes('p_expected_governance_version: governanceVersion'))
  assert(source.includes('p_expected_membership_version: membershipVersion'))
  assert(source.includes('admin.auth.admin.updateUserById'))
  assert(source.includes("admin.rpc('arg2_record_external_credential_result'"))
}
assert(migration.includes('create function public.arg2_activate_center_governance'))
assert(migration.includes('arg2_governance_not_ready'))
assert(!migration.includes('phongtrong_prod'))
console.log('C7.8F controlled revoke/restore contract smoke PASS without production mutation')
