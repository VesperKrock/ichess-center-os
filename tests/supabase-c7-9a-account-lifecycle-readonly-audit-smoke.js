import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: read-only audit reconstructed authority from center_members rows.
 * CURRENT ARG-2 CONTRACT: canonical pointers, command state and append-only events are
 * server-owned; browser gets a scoped lifecycle projection only.
 * WHY VALID: auditability and read-only UI are preserved with fewer inference races.
 */
const list = readFileSync('supabase/functions/list-center-admin-accounts/index.ts', 'utf8')
const migration = readFileSync('supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql', 'utf8')
for (const marker of [
  'create table public.account_governance_commands',
  'create table public.account_governance_events',
  'arg2_internal_append_event',
  'arg2_account_governance_events_immutable_row',
  'arg2_account_governance_events_immutable_truncate',
  'revoke maintain, references, trigger, truncate, update, delete',
]) assert(migration.includes(marker), 'ARG-2 audit marker missing: ' + marker)

assert(list.includes("admin.rpc('arg2_list_center_account_lifecycle'"))
assert(!/\.from\(['"]account_governance_(commands|events)['"]\)/.test(list))
assert(!/\.(insert|update|delete|upsert)\s*\(/.test(list))
console.log('C7.9A lifecycle readonly/audit smoke PASS under canonical governance')
