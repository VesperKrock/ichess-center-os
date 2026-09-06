import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: restore could flip a revoked row active under a static center gate.
 * CURRENT ARG-2 CONTRACT: restore is version/state guarded, rotates credentials, keeps
 * restore_pending blocked, and activates only after mandatory password change.
 * WHY VALID: the familiar confirmation UX remains while preventing old-credential reuse.
 */
const main = readFileSync('src/main.js', 'utf8')
const edge = readFileSync('supabase/functions/restore-center-admin-access/index.ts', 'utf8')
const migration = readFileSync('supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql', 'utf8')
for (const marker of [
  'renderInternalRestoreAccessConfirm',
  'handleInternalRestoreAdminAccess',
  'data-internal-restore-typed-confirmation',
  "functions.invoke('restore-center-admin-access'",
  'expected_governance_version',
  'expected_membership_version',
]) assert(main.includes(marker), 'ARG-2 restore UI marker missing: ' + marker)

assert(edge.includes("p_action: 'restore_admin'"))
assert(edge.includes('admin.auth.admin.updateUserById'))
assert(edge.includes("membership_status: 'restore_pending'"))
assert(migration.includes("p_action = 'restore_admin' and v_target.status <> 'revoked'"))
assert(!main.includes('ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS'))
console.log('C7.8E-1 revoke/restore UX smoke PASS under ARG-2 restore gate')
