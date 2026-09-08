import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const originalPath = 'supabase/migrations/202609080001_v2_1_center_settings_foundation.sql'
const forwardPath = 'supabase/migrations/202609080002_v2_1_shared_wallpaper_governed_scope_forward_fix.sql'
const original = readFileSync(originalPath, 'utf8')
const forward = readFileSync(forwardPath, 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()

assert.equal(
  sha256(originalPath),
  '8DE2112230BB9F77B7075E8E491127ED24C48078CA120A0DEAF4C0C4071FCFEE',
  'Frozen V2-1 migration bytes changed',
)

for (const token of [
  'create or replace function public.v2_1_can_manage_shared_wallpaper(p_user_id uuid)',
  "pg_catalog.to_regclass('public.center_access_governance')",
  'from public.center_access_governance governed',
  'governed.status = \'active\'',
  'canonical_owner.id = governed.canonical_owner_membership_id',
  'canonical_owner.center_id = governed.center_id',
  'canonical_owner.user_id = p_user_id',
  "canonical_owner.role = 'owner'",
  "canonical_owner.status = 'active'",
  'p_user_id = auth.uid()',
  "set search_path = ''",
  'security definer',
  'grant execute on function public.v2_1_can_manage_shared_wallpaper(uuid)',
]) assert(forward.includes(token), `Missing governed Owner contract: ${token}`)

assert.match(forward, /and exists \([\s\S]+center_access_governance[\s\S]+governed\.status = 'active'/)
assert.match(forward, /and not exists \([\s\S]+and not exists \([\s\S]+canonical_owner_membership_id/)
assert.doesNotMatch(forward, /environment|dreamhome|_prod|phongtest|tanbinh/i,
  'Forward-fix hard-coded deployment topology')
assert.doesNotMatch(forward, /\b(insert\s+into|update|delete\s+from|truncate)\s+public\.center_access_governance\b/i,
  'Forward-fix mutates ARG governance truth')
assert.doesNotMatch(forward, /create\s+table|alter\s+table/i,
  'Forward-fix expanded beyond the one-function overlay')
const executeGrants = [...forward.matchAll(/grant\s+execute\s+on\s+function[\s\S]*?;/gi)]
assert.equal(executeGrants.length, 1, 'Unexpected function grant surface')
const executeGrantRoles = executeGrants[0][0].split(/\bto\b/i).at(-1)
assert.doesNotMatch(executeGrantRoles, /\b(?:anon|public)\b/i,
  'Anonymous/public execution was granted')
assert(!/p3d|p4b/i.test(forward), 'Forward-fix picked up frozen conversion scope')
assert(original.includes("where active_center.status = 'active'"),
  'The regression source in the frozen migration is no longer recognizable')

console.log(`V2_1A2_SHARED_WALLPAPER_GOVERNED_OWNER_SCOPE_SMOKE: PASS (${sha256(forwardPath)})`)
