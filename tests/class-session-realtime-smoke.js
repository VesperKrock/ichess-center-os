import assert from 'node:assert/strict'
import {
  getClassSessionRealtimeRecord,
  mergeRealtimeClassSessionIntoList,
  subscribeToClassSessionCloudRealtime,
} from '../src/cloud-realtime-class-sessions.js'

const centerId = 'qa-center-one'
const accessState = {
  isSupabaseConfigured: true,
  isSignedIn: true,
  user: { id: 'owner-a' },
  centerId,
  membership: { center_id: centerId, role: 'owner', status: 'active' },
  role: 'owner',
  cloudReady: true,
}
let callback = null
let removedChannel = null
const channel = {
  on(_kind, filter, handler) {
    assert.equal(filter.table, 'center_cloud_entities')
    assert.equal(filter.filter, `center_id=eq.${centerId}`)
    callback = handler
    return this
  },
  subscribe(handler) {
    handler('SUBSCRIBED')
    return this
  },
}
const supabase = {
  channel(name) {
    assert.equal(name, `ichess-center-class-sessions:${centerId}`)
    return channel
  },
  removeChannel(value) {
    removedChannel = value
  },
}
const events = []
const subscription = subscribeToClassSessionCloudRealtime({
  supabase,
  centerId,
  accessState,
  onClassSessionRecord: (record) => events.push(record),
})
assert.equal(subscription.ok, true)

const record = (version, payload, deletedAt = null, recordCenterId = centerId) => ({
  center_id: recordCenterId,
  entity_type: 'class_session',
  local_id: payload.id,
  entity_version: version,
  payload,
  updated_at: `2026-09-16T00:00:0${version}.000Z`,
  deleted_at: deletedAt,
})
const created = record(1, { id: 'class-x', name: 'Class X', status: 'active' })
callback({ eventType: 'INSERT', new: created })
callback({ eventType: 'INSERT', new: { ...created, center_id: 'qa-center-two' } })
callback({ eventType: 'INSERT', new: { ...created, entity_type: 'student' } })
assert.equal(events.length, 1, 'Only exact-center class_session events may pass')

let projection = mergeRealtimeClassSessionIntoList([], events[0])
assert.equal(projection.changed, true)
assert.equal(projection.classSessions[0].name, 'Class X')
assert.equal(projection.classSessions[0].cloudVersion, 1)

const edited = record(2, { id: 'class-x', name: 'Class X edited', status: 'active' })
projection = mergeRealtimeClassSessionIntoList(projection.classSessions, edited)
assert.equal(projection.changed, true)
assert.equal(projection.classSessions[0].name, 'Class X edited')

const stale = mergeRealtimeClassSessionIntoList(projection.classSessions, created)
assert.equal(stale.changed, false)
assert.equal(stale.stale, true)
assert.equal(stale.classSessions[0].name, 'Class X edited')

const deleted = getClassSessionRealtimeRecord({
  eventType: 'UPDATE',
  new: record(3, { id: 'class-x', name: 'Class X edited' }, '2026-09-16T00:00:03.000Z'),
}, centerId)
projection = mergeRealtimeClassSessionIntoList(projection.classSessions, deleted)
assert.equal(projection.changed, true)
assert.deepEqual(projection.classSessions, [])

const staleDelete = mergeRealtimeClassSessionIntoList(
  [{ id: 'class-x', name: 'newer', cloudVersion: 4 }],
  deleted,
)
assert.equal(staleDelete.changed, false)
assert.equal(staleDelete.classSessions[0].name, 'newer')

subscription.cleanup()
assert.equal(removedChannel, channel, 'Center switch/logout cleanup must remove the old channel')
console.log('CLASS_SESSION_REALTIME_SMOKE: PASS')
