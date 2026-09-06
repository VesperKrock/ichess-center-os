import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: only active/revoked rows existed and restore was a direct status flip.
 * CURRENT ARG-2 CONTRACT: revoke history persists; restore_pending plus a temporary
 * credential remains blocked until credential completion.
 * WHY VALID: persistent revocation remains visible while restore gains currentness and
 * no-old-credential guarantees.
 */
const migration = readFileSync('supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql', 'utf8')
const restore = readFileSync('supabase/functions/restore-center-admin-access/index.ts', 'utf8')
for (const marker of [
  "p_action = 'restore_admin' and v_target.status <> 'revoked'",
  "set status = 'restore_pending'",
  "credential_state = 'temporary'",
  "v_command.action in ('reset_admin', 'restore_admin')",
  "update public.center_members set status = 'active'",
]) assert(migration.includes(marker), 'ARG-2 persistent restore marker missing: ' + marker)

assert(restore.includes('p_expected_membership_version: membershipVersion'))
assert(restore.includes('admin.auth.admin.updateUserById'))
assert(restore.includes("membership_status: 'restore_pending'"))
assert(!restore.includes('deleteUser('))
console.log('C7.9B persistent revoke/restore state smoke PASS under ARG-2')
