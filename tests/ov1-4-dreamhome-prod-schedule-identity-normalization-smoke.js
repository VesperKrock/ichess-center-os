import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const migrationPath = 'supabase/migrations/202608210004_c5_1_dreamhome_prod_schedule_identity_normalization.sql'
const migration = readFileSync(migrationPath, 'utf8')
const migrationHash = createHash('sha256').update(readFileSync(migrationPath)).digest('hex').toUpperCase()
const frozenFingerprints = [
  'd8f954450feae470534cfcf2b3c91487afe483951ffab2546e0e4dd007ff93dc',
  '471c1ec4f8a54fa6e9976e418bb9e9a315d52568abc9b08111c85e55ebe5be19',
  'fb6ee730cbc667655e52d184d16b64af183261257f5fe202c0fae4a40c17e6ab',
  'bb122e4a28e4b0942b4eb8a791e45610d2b0c372facc2db5dba6c5d8d106669c',
]
const frozenTimestamps = [
  '2026-07-10 06:04:06.505867+00',
  '2026-07-10 08:40:11.603819+00',
  '2026-07-10 08:42:20.563606+00',
  '2026-07-17 02:19:36.578874+00',
]

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert.match(migration, /^begin;[\s\S]*commit;\s*$/)
assert.equal((migration.match(/'dreamhome_prod'/g) || []).length > 5, true)
assert(!migration.includes("center_id = 'dreamhome'\n"))
assert.match(migration, /entity_type = 'schedule_session'/)
assert.match(migration, /active Schedule count is %, expected 4/)
assert.match(migration, /allowlist count is not 4/)
assert.match(migration, /entity_version = 1/)
assert.match(migration, /e\.local_id = 'schedule-session::' \|\| pg_catalog\.btrim\(e\.payload->>'id'\)/)
assert.match(migration, /extensions\.digest/)
assert.match(migration, /normalized local_id collision detected/)
assert.match(migration, /related C5\.1 command history exists/)
assert.match(migration, /an unapproved row or field changed/)
assert.match(migration, /lock table public\.center_cloud_entities in share row exclusive mode/)
assert.match(migration, /lock table public\.center_core_command_result in share mode/)
assert.match(migration, /pg_catalog\.jsonb_typeof\(e\.payload\) = 'object'/)
assert.match(migration, /scheduleType'[\s\S]*in \('recurring', 'oneOff'\)/)
assert.match(migration, /dayOfWeek'[\s\S]*'monday'[\s\S]*'sunday'/)
assert.match(migration, /payload->>'endTime'[\s\S]*> pg_catalog\.btrim\(e\.payload->>'startTime'\)/)

for (const fingerprint of frozenFingerprints) {
  assert.equal((migration.match(new RegExp(fingerprint, 'g')) || []).length, 1)
}
for (const timestamp of frozenTimestamps) {
  assert.equal((migration.match(new RegExp(timestamp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1)
}

const updateMatch = migration.match(/update public\.center_cloud_entities e\s+set ([\s\S]*?)\s+from ov1_4_dreamhome_prod_schedule_targets t/)
assert(updateMatch, 'Expected one guarded center_cloud_entities UPDATE')
const assignments = updateMatch[1].split(',').map((item) => item.trim().split(/\s*=\s*/)[0])
assert.deepEqual(assignments, ['local_id', 'entity_version', 'updated_at'])
assert.equal((migration.match(/update public\.center_cloud_entities/g) || []).length, 1)
assert(!/delete\s+from\s+public\.center_cloud_entities/i.test(migration))
assert(!/insert\s+into\s+public\.center_cloud_entities/i.test(migration))
assert(!/merge\s+into\s+public\.center_cloud_entities/i.test(migration))
assert(!/update\s+public\.center_core_command_result/i.test(migration))
assert(!/202608130002|p4b/i.test(migration))

console.log(`OV1_4_DREAMHOME_PROD_SCHEDULE_MIGRATION_HASH: ${migrationHash}`)
console.log('OV1_4_EXACT_CENTER_FINGERPRINT_TIMESTAMP_VERSION_GUARDS: PASS')
console.log('OV1_4_SEMANTIC_COLLISION_COMMAND_HISTORY_GUARDS: PASS')
console.log('OV1_4_ONLY_LOCAL_ID_VERSION_UPDATED_AT_MUTABLE: PASS')
console.log('OV1_4_NO_DELETE_REINSERT_MERGE_UNRELATED_SCOPE: PASS')
console.log('OV1_4_DREAMHOME_PROD_SCHEDULE_IDENTITY_NORMALIZATION_SMOKE: PASS')
