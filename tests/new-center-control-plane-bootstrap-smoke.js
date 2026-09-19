import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const migrationPath = 'supabase/migrations/202609190001_new_center_control_plane_bootstrap.sql'
const migration = readFileSync(migrationPath, 'utf8')
const originalArg2 = readFileSync(
  'supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql',
  'utf8',
)

assert.equal(migration.trimStart().startsWith('-- New-center control-plane bootstrap forward fix.'), true)
assert.equal(migration.trimEnd().endsWith('commit;'), true)

for (const marker of [
  'alter function public.arg2_internal_enforce_governed_membership()\n  security definer',
  'alter function public.arg2_internal_enforce_governed_membership()\n  owner to postgres',
  "alter function public.arg2_internal_enforce_governed_membership()\n  set search_path to ''",
  'create or replace function public.provision_center_for_owner',
  "set search_path = ''",
  "governance.status = 'active'",
  "owner_membership.role = 'owner'",
  "owner_membership.status = 'active'",
  'new_center_crm_control_prerequisite_invalid',
  'new_center_lookup_control_prerequisite_invalid',
  'new_center_exactly_one_active_owner_required',
  'new_center_admin_must_not_be_bootstrapped',
  'new_center_unexpected_membership',
  "'ready'",
  "'ACTIVE'",
  "'ENABLED'",
]) {
  assert(migration.includes(marker), `Missing control-plane marker: ${marker}`)
}

assert(
  !/create\s+or\s+replace\s+function\s+public\.arg2_internal_enforce_governed_membership/i.test(migration),
  'The incident migration must not replace or drift the reviewed ARG-2 trigger body.',
)
assert(
  !/grant\s+(?:select|all)[\s\S]{0,100}center_access_governance/i.test(migration),
  'The forward fix must not add direct table access to center_access_governance.',
)
assert(
  !/(?:insert|update|delete)\s+[^;]*center_(?:access_governance|crm_control)/i.test(
    readFileSync('src/main.js', 'utf8'),
  ),
  'The browser must not directly mutate protected governance or CRM control tables.',
)

const originalBodyMatch = originalArg2.match(
  /create function public\.arg2_internal_enforce_governed_membership\(\)([\s\S]*?)\$arg2_internal_enforce_governed_membership\$;/i,
)
assert(originalBodyMatch, 'Original ARG-2 trigger body was not found.')
const bodyDigest = createHash('sha256').update(originalBodyMatch[1]).digest('hex')
assert.equal(bodyDigest, '1b12e75367f9d11554764f16356dcdca7523239d2724c6582384375ba52dfb8e')

console.log('NEW_CENTER_CONTROL_PLANE_BOOTSTRAP_SMOKE: PASS')
