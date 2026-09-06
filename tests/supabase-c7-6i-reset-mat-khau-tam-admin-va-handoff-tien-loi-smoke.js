import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: reset returned a reusable temporary credential after a standalone
 * Auth call and legacy audit insert.
 * CURRENT ARG-2 CONTRACT: reset first blocks membership in PREPARED, rotates the
 * credential server-side, records the external result, then requires target change.
 * WHY VALID: the original handoff UX is retained with stronger ordering, session
 * invalidation and repair semantics.
 */
const reset = readFileSync('supabase/functions/reset-center-admin-password/index.ts', 'utf8')
const complete = readFileSync('supabase/functions/complete-account-credential-change/index.ts', 'utf8')
const migration = readFileSync('supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql', 'utf8')

for (const marker of [
  "p_action: 'reset_admin'",
  "admin.rpc('arg2_prepare_lifecycle_command'",
  'admin.auth.admin.updateUserById',
  "admin.rpc('arg2_record_external_credential_result'",
  "membership_status: 'reset_required'",
  'sessions_invalidated: true',
]) assert(reset.includes(marker), 'ARG-2 reset marker missing: ' + marker)

assert(reset.indexOf("admin.rpc('arg2_prepare_lifecycle_command'") < reset.indexOf('admin.auth.admin.updateUserById'))
assert(migration.includes("set status = 'reset_required'"))
assert(migration.includes("credential_state = 'reset_required'"))
assert(complete.includes("admin.rpc('arg2_validate_credential_change'"))
assert(complete.includes("admin.rpc('arg2_complete_credential_change'"))
assert(complete.includes("operation === 'change_credential'"))
assert(complete.includes("operation !== 'resume_session_invalidation'"))
assert(!reset.includes('deleteUser('))
console.log('C7.6I reset/handoff smoke PASS under ARG-2 credential gate')
