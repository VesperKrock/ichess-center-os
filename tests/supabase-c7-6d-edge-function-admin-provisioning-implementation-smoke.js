import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: C7.6D expected direct center_members mutation and an immediately
 * active fixed-email Admin.
 * CURRENT ARG-2 CONTRACT: an explicit reviewed email is bound to PREPARED, then Auth
 * creation produces a pending credential with no business authority.
 * WHY VALID: Owner-only provisioning and no-false-success remain, while the unsafe
 * direct-DML and fixed-email assumptions are removed.
 */
const edge = readFileSync('supabase/functions/provision-center-admin-account/index.ts', 'utf8')
const migration = readFileSync('supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql', 'utf8')
const config = readFileSync('supabase/config.toml', 'utf8')

for (const marker of [
  "admin.rpc('arg2_prepare_lifecycle_command'",
  'p_target_email_hash: emailHash',
  'p_expected_governance_version: governanceVersion',
  'p_expected_membership_version: predecessorMembershipVersion',
  'admin.auth.admin.createUser',
  "admin.rpc('arg2_register_created_identity'",
  "membership_status: 'pending_credential'",
  'password_display_once: true',
]) assert(edge.includes(marker), 'ARG-2 provision marker missing: ' + marker)

assert(edge.indexOf("admin.rpc('arg2_prepare_lifecycle_command'") < edge.indexOf('admin.auth.admin.createUser'))
assert(!/\.from\(['"]center_members['"]\)[\s\S]{0,160}\.(insert|update|upsert|delete)\s*\(/.test(edge))
assert(!edge.includes('deleteUser('))
assert(!/admin[.-]\$\{|admin\.[a-z0-9_-]+@ichess\.vn/i.test(edge))
assert(migration.includes("values (v_command.center_id, p_target_user_id, v_role, 'pending_credential')"))
assert(config.includes('[functions.provision-center-admin-account]'))
assert(config.includes('verify_jwt = true'))
console.log('C7.6D provisioning smoke PASS under ARG-2 saga contract')
