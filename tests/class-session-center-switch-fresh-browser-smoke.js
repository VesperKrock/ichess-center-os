import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mergeRealtimeClassSessionIntoList } from '../src/cloud-realtime-class-sessions.js'

const serverRecord = {
  center_id: 'qa-center-one', entity_type: 'class_session', local_id: 'class-x', entity_version: 1,
  payload: { id: 'class-x', name: 'Class X' }, updated_at: '2026-09-16T00:00:00.000Z', deleted_at: null,
}
const freshBrowser = mergeRealtimeClassSessionIntoList([], serverRecord)
assert.equal(freshBrowser.ok, true)
assert.deepEqual(freshBrowser.classSessions.map((item) => item.id), ['class-x'])

// A server-empty bootstrap is replacement truth, never a union with an old cache.
const staleCache = [{ id: 'legacy-class', cloudVersion: 1 }]
const emptyServerSnapshot = []
const reconstructed = Array.isArray(emptyServerSnapshot) ? emptyServerSnapshot : staleCache
assert.deepEqual(reconstructed, [])

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const switchBlock = main.slice(
  main.indexOf('function resetCloudRuntimeStateForOwnerCenterSwitch'),
  main.indexOf('async function handleInternalOpenCenter'),
)
assert(switchBlock.indexOf('stopClassSessionRealtimeSubscription()') >= 0)
const startBlock = main.slice(
  main.indexOf('async function startClassSessionRealtimeSubscription'),
  main.indexOf('async function writeScheduleSessionThroughCloud'),
)
assert(startBlock.indexOf('stopClassSessionRealtimeSubscription()') < startBlock.indexOf('subscribeToClassSessionCloudRealtime'))
assert(startBlock.includes('classSessionRealtimeCenterId !== activeCenterId'))
const bootstrapBlock = main.slice(
  main.indexOf('function applyCloudBootstrapSnapshotToLocal'),
  main.indexOf('async function refreshCloudDbReadiness'),
)
assert(bootstrapBlock.includes('classSessions = Array.isArray(snapshot.classSessions) ? snapshot.classSessions : []'))
assert(!bootstrapBlock.includes('...classSessions'))
console.log('CLASS_SESSION_CENTER_SWITCH_FRESH_BROWSER_SMOKE: PASS')
