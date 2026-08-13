import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

import {
  cleanupLegacyDatasetLocalResidue,
  hasExactLegacyDatasetIdentity,
} from '../src/legacy-dataset-cleanup.js'

class MemoryStorage {
  constructor(entries = []) {
    this.items = new Map(entries)
  }
  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null
  }
  setItem(key, value) {
    this.items.set(String(key), String(value))
  }
  removeItem(key) {
    this.items.delete(String(key))
  }
}

const centerA = 'center-a'
const centerB = 'center-b'
const realSameName = {
  id: 'real-user-record',
  fullName: 'Phạm Đức Thắng',
  isControlledFixture: true,
}
const legacyRows = [
  { id: 'legacy-source', sourceModule: 'angel-wings-import' },
  { id: 'legacy-tag', sourceTag: 'angel-wings-2026-06' },
  { id: 'legacy-dataset', datasetId: 'angel-wings-2026-06' },
  { id: 'legacy-batch-a', importBatchId: 'angel-wings-2026-06-f15k5' },
  { id: 'legacy-batch-b', importBatchId: 'angel-wings-2026-06-attendance' },
]
const storage = new MemoryStorage([
  [`ichessCenterOS.students.${centerA}`, JSON.stringify([...legacyRows, realSameName])],
  [`ichessCenterOS.teachers.${centerA}`, JSON.stringify([realSameName])],
  [`ichessCenterOS.students.${centerB}`, JSON.stringify(legacyRows)],
])

assert(legacyRows.every(hasExactLegacyDatasetIdentity))
assert.equal(hasExactLegacyDatasetIdentity(realSameName), false, 'Name/fixture flag alone must never authorize deletion')

const first = cleanupLegacyDatasetLocalResidue(storage, centerA)
assert.equal(first.ok, true)
assert.equal(first.removedCount, legacyRows.length)
assert.deepEqual(JSON.parse(storage.getItem(`ichessCenterOS.students.${centerA}`)), [realSameName])
assert.deepEqual(JSON.parse(storage.getItem(`ichessCenterOS.teachers.${centerA}`)), [realSameName])
assert.equal(JSON.parse(storage.getItem(`ichessCenterOS.students.${centerB}`)).length, legacyRows.length)

const replay = cleanupLegacyDatasetLocalResidue(storage, centerA)
assert.equal(replay.removedCount, 0, 'Cleanup replay must be idempotent')
assert.deepEqual(replay.changedKeys, [])

const secondCenter = cleanupLegacyDatasetLocalResidue(storage, centerB)
assert.equal(secondCenter.removedCount, legacyRows.length)
assert.deepEqual(JSON.parse(storage.getItem(`ichessCenterOS.students.${centerB}`)), [])

assert.equal(existsSync('src/attendance-board-angel-wings-data.js'), false)
const main = readFileSync('src/main.js', 'utf8')
const board = readFileSync('src/attendance-board-module.js', 'utf8')
const backfill = readFileSync('src/cloud-schedule-session-backfill.js', 'utf8')
for (const forbidden of [
  'restoreAngelWingsLocalDataset',
  'upsertAngelWingsAttendanceData',
  'removeAngelWingsAttendanceData',
  'mergeAngelWingsTeacherRoster',
  'data-attendance-board-angel-wings-action',
  'restore-angel-wings-local',
  'getLocalAngelWingsStatus',
]) {
  assert(!main.includes(forbidden), `Product runtime still contains ${forbidden}`)
}
assert(!/angel[ -]?wings/i.test(board), 'Attendance product module must not retain retired dataset behavior')
assert(!/angel[ -]?wings/i.test(backfill), 'Schedule backfill must not depend on retired dataset')

const switchBlockStart = main.indexOf('async function handleInternalOpenCenter')
const switchBlockEnd = main.indexOf('function normalizeInternalCenters', switchBlockStart)
assert(switchBlockStart >= 0 && switchBlockEnd > switchBlockStart)
const switchBlock = main.slice(switchBlockStart, switchBlockEnd)
for (const token of [
  'setCurrentStorageCenterId(normalizedCenterId)',
  'reloadLocalDataForResolvedCenter({ useSampleFallback: false })',
  'resetCloudRuntimeStateForOwnerCenterSwitch()',
  'await bootstrapCoreCloudDataForCurrentCenter(switchSyncId)',
  'await startStudentRealtimeSubscription(switchSyncId)',
  'await startTeacherRealtimeSubscription(switchSyncId)',
  'await startScheduleSessionRealtimeSubscription(switchSyncId)',
]) {
  assert(switchBlock.includes(token), `Owner center switch missing: ${token}`)
}
assert(
  switchBlock.indexOf('resetCloudRuntimeStateForOwnerCenterSwitch()') <
    switchBlock.indexOf('setCurrentStorageCenterId(normalizedCenterId)'),
  'Old-center subscriptions/state must stop before the storage namespace changes',
)
assert(
  switchBlock.indexOf('resetCloudRuntimeStateForOwnerCenterSwitch()') <
    switchBlock.indexOf('await bootstrapCoreCloudDataForCurrentCenter(switchSyncId)'),
  'Old-center subscriptions/state must stop before new-center bootstrap',
)

for (const path of [
  'src/cloud-realtime-students.js',
  'src/cloud-realtime-teachers.js',
  'src/cloud-realtime-schedule-sessions.js',
]) {
  const source = readFileSync(path, 'utf8')
  assert(source.includes('filter: `center_id=eq.${normalizedCenterId}`'), `${path} realtime filter drift`)
}

console.log('C5.1 retired dataset removal + center isolation smoke: PASS')
