import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationPath = join(
  root,
  'supabase/migrations/202608210001_c5_1_dreamhome_schedule_identity_normalization.sql',
)
const migrationBytes = readFileSync(migrationPath)
const migration = migrationBytes.toString('utf8')
const sha256 = createHash('sha256').update(migrationBytes).digest('hex').toUpperCase()

assert.equal(sha256, '870AD8FE26AA7119175F597640FAE07443BE7DC0B0FD130E8D489A1F9DA9965D')
assert(migration.trimStart().startsWith('do $migration$'))
assert(migration.trimEnd().endsWith('$migration$;'))

const expectedFingerprints = [
  '32cf091afeef8a9e9952b82a3f9ddad4509a974cb417e9b364df30ddff9711e6',
  '4f2447475eaa04731d17887b1c94424740cf2ae8eb6e0107e1e10b32052a9c79',
  '70802b0cdbfef47dfe7cceacd3e4d643dabc7b9ac57d6571c699f045cb370205',
  '7c8c6b5bbfb6a25306c09d84f69c5468a3d4014e36bda04b764927fa3135ce11',
  '84fa8c17571342f1898b6eb291325d55ef449de073c0162170ae46b64eb876b1',
  '985733b6f94a41e0981c5ace0a435c31f8c1b06de6bee92544266e3b32cefab1',
  'adeba41a3ae045da0ea3329fc7727ad32a3671182606bee217a673ea6dc2fd67',
  'c5fd808eb9f1b5e9694355efeb6d257dafc8df52bb12261732b1840fa0240dbb',
  'eb9dc74eee78249dc9acb0e899c98b7ec91e2505ae5be56914d529f485930cbf',
]
for (const fingerprint of expectedFingerprints) {
  assert.equal(migration.split(fingerprint).length - 1, 1, `Fingerprint must appear once: ${fingerprint}`)
}
assert.equal((migration.match(/'2026-06-17 00:00:00\+00', true, 'oneOff'/g) || []).length, 8)
assert.equal((migration.match(/'2026-07-09 02:34:22\.040515\+00', false, 'recurring'/g) || []).length, 1)

for (const guard of [
  'lock table public.center_cloud_entities in share row exclusive mode',
  'for update of e',
  'active Schedule count is %, expected 9',
  'exact guarded target count is %, expected 9',
  'payload identities are not nine unique values',
  'normalized local_id collision detected',
  'related core command history exists',
  'full Schedule row digest drifted',
  'payload or provenance digest drifted',
  'non-Schedule core rows changed',
  'a non-approved Schedule field changed',
]) assert(migration.includes(guard), `Missing fail-closed guard: ${guard}`)

for (const exactDigest of [
  '2ea8ded7cf155fb17b8ee58a2b98c83f42ef8273fb8cf332847b9d69951b9447',
  '61fb4a7037443398d1948ee9c86d7802e377b14d849d00d1843becb83aaebf51',
  '74a8f82403ebe9830d6f72e9554e3c072f76c7a31f15e124edbfeeae7dc64a31',
]) assert(migration.includes(exactDigest), `Missing reviewed digest: ${exactDigest}`)

const updateStart = migration.indexOf('update public.center_cloud_entities e')
const updateEnd = migration.indexOf('get diagnostics v_updated_count', updateStart)
assert(updateStart >= 0 && updateEnd > updateStart)
const updateBlock = migration.slice(updateStart, updateEnd)
for (const assignment of [
  'set local_id = t.new_local_id',
  'entity_version = e.entity_version + 1',
  'updated_at = pg_catalog.transaction_timestamp()',
]) assert(updateBlock.includes(assignment), `Missing approved assignment: ${assignment}`)
for (const forbiddenAssignment of ['payload =', 'deleted_at =', 'source_module =', 'source_version =', 'updated_by =']) {
  assert(!updateBlock.includes(forbiddenAssignment), `Forbidden assignment: ${forbiddenAssignment}`)
}

for (const forbiddenMutation of [
  'delete from public.center_cloud_entities',
  'insert into public.center_cloud_entities',
  'merge into public.center_cloud_entities',
]) assert(!migration.toLowerCase().includes(forbiddenMutation))

console.log('DREAMHOME_SCHEDULE_IDENTITY_NORMALIZATION_MIGRATION_SMOKE: PASS')
