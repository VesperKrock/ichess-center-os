import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  NEEDS_SUPABASE_REALTIME_PATCH,
  STUDENT_REALTIME_ENTITY_TYPE,
  getStudentRealtimeRecord,
  mergeRealtimeStudentIntoList,
  normalizeRealtimeStudentPayload,
  subscribeToStudentCloudRealtime,
  upsertStudentCloudEntity,
} from '../src/cloud-realtime-students.js'
import { buildOnlineAccessState, canWriteEntity } from '../src/online-access-control.js'

const repoRoot = process.cwd()
const helperPath = path.join(repoRoot, 'src', 'cloud-realtime-students.js')
const mainPath = path.join(repoRoot, 'src', 'main.js')
const docsPath = path.join(repoRoot, 'docs', 'online-student-realtime-c3-2.md')
const helperSource = fs.readFileSync(helperPath, 'utf8')
const mainSource = fs.readFileSync(mainPath, 'utf8')
const docs = fs.readFileSync(docsPath, 'utf8')

assert.equal(STUDENT_REALTIME_ENTITY_TYPE, 'student')
assert(helperSource.includes('subscribeToStudentCloudRealtime'))
assert(helperSource.includes('buildOnlineAccessState'))
assert(helperSource.includes('canWriteEntity'))
assert(mainSource.includes('writeStudentThroughCloud'))
assert(mainSource.includes('startStudentRealtimeSubscription'))

assert(!helperSource.includes('attendance_record'))
assert(!helperSource.includes('session_report'))
assert(!helperSource.includes('schedule_session'))
assert(!helperSource.includes('tuition_record'))
assert(!helperSource.includes('CLOUD_ENTITY_TYPES.TEACHER'))
assert(!helperSource.includes('CLOUD_ENTITY_TYPES.CLASS_SESSION'))

const baseInput = {
  isSupabaseConfigured: true,
  isSignedIn: true,
  user: { id: 'user-001' },
  centerId: 'dreamhome',
  cloudReady: true,
}

for (const role of ['viewer', 'teacher', 'consultant', 'none', 'unknown']) {
  const access = buildOnlineAccessState({
    ...baseInput,
    membership: { role },
  })
  assert.equal(canWriteEntity(access, 'student'), false, `${role} must not write student cloud`)
  const result = await upsertStudentCloudEntity({
    supabase: createMockSupabase(),
    centerId: 'dreamhome',
    student: createStudent({ id: `student-${role}` }),
    accessState: access,
  })
  assert.equal(result.ok, false)
  assert.equal(result.skipped, true)
}

const missingMembership = buildOnlineAccessState({
  ...baseInput,
  membership: null,
})
assert.equal(missingMembership.needsMembershipPatch, true)
assert.equal(canWriteEntity(missingMembership, 'student'), false)

for (const role of ['center_admin', 'owner', 'qtv']) {
  const access = buildOnlineAccessState({
    ...baseInput,
    membership: { role },
  })
  const mockSupabase = createMockSupabase()
  const result = await upsertStudentCloudEntity({
    supabase: mockSupabase,
    centerId: 'dreamhome',
    student: createStudent({ id: `student-${role}` }),
    userId: 'user-001',
    accessState: access,
  })

  assert.equal(result.ok, true, `${role} should write student cloud when ready`)
  assert.equal(mockSupabase.upsertedRecords.length, 1)
  assert.equal(mockSupabase.upsertedRecords[0].entity_type, 'student')
  assert.equal(mockSupabase.upsertedRecords[0].center_id, 'dreamhome')
}

const customLevelStudent = createStudent({
  id: 'student-custom-level',
  level: 'Dolphin bo tro rieng',
})
assert.equal(normalizeRealtimeStudentPayload(customLevelStudent).student.level, customLevelStudent.level)

const realtimeAccess = buildOnlineAccessState({
  ...baseInput,
  membership: { role: 'viewer' },
})
const realtimeEvents = []
const realtimeStatuses = []
const mockRealtimeSupabase = createMockSupabase()
const subscription = subscribeToStudentCloudRealtime({
  supabase: mockRealtimeSupabase,
  centerId: 'dreamhome',
  accessState: realtimeAccess,
  onStudentRecord: (record) => realtimeEvents.push(record),
  onStatusChange: (status) => realtimeStatuses.push(status),
})

assert.equal(subscription.ok, true)
assert.equal(mockRealtimeSupabase.channelName, 'ichess-center-students:dreamhome')
assert.equal(mockRealtimeSupabase.postgresChangesConfig.filter, 'center_id=eq.dreamhome')
assert.equal(mockRealtimeSupabase.postgresChangesConfig.table, 'center_cloud_entities')
assert.equal(realtimeStatuses[0].status, 'SUBSCRIBED')

mockRealtimeSupabase.emit({
  eventType: 'UPDATE',
  new: {
    center_id: 'dreamhome',
    entity_type: 'teacher',
    payload: { id: 'teacher-001' },
  },
})
assert.equal(realtimeEvents.length, 0, 'Non-student realtime event must be ignored')

mockRealtimeSupabase.emit({
  eventType: 'UPDATE',
  new: {
    center_id: 'dreamhome',
    entity_type: 'student',
    payload: createStudent({ id: 'student-rt-001', fullName: 'Hoc vien realtime' }),
  },
})
assert.equal(realtimeEvents.length, 1)
assert.equal(getStudentRealtimeRecord({ new: realtimeEvents[0] })?.entity_type, 'student')

const olderLocal = createStudent({
  id: 'student-rt-001',
  fullName: 'Ban moi hon',
  updatedAt: '2026-06-21T10:00:00.000Z',
})
const olderRemoteRecord = {
  payload: createStudent({
    id: 'student-rt-001',
    fullName: 'Ban cu',
    updatedAt: '2026-06-20T10:00:00.000Z',
  }),
}
const skippedOlder = mergeRealtimeStudentIntoList([olderLocal], olderRemoteRecord)
assert.equal(skippedOlder.changed, false)
assert.equal(skippedOlder.students[0].fullName, 'Ban moi hon')

const mergeResult = mergeRealtimeStudentIntoList(
  [createStudent({ id: 'student-rt-001', fullName: 'Cu' })],
  {
    payload: createStudent({
      id: 'student-rt-001',
      fullName: 'Moi',
      updatedAt: '2026-06-21T11:00:00.000Z',
    }),
  },
)
assert.equal(mergeResult.ok, true)
assert.equal(mergeResult.changed, true)
assert.equal(mergeResult.students.length, 1, 'Realtime echo must not duplicate same student id')
assert.equal(mergeResult.students[0].fullName, 'Moi')

const noRealtimeClient = subscribeToStudentCloudRealtime({
  supabase: {},
  centerId: 'dreamhome',
  accessState: realtimeAccess,
})
assert.equal(noRealtimeClient.ok, false)
assert.equal(noRealtimeClient.needsRealtimePatch, true)
assert(noRealtimeClient.message.includes(NEEDS_SUPABASE_REALTIME_PATCH))

for (const term of [
  'student',
  'ichessCenterOS.students.dreamhome',
  'Access-control/write guard',
  'NEEDS MEMBERSHIP SQL PATCH',
  'NEEDS SUPABASE REALTIME PATCH',
  'Manual QA',
  'Non-scope',
]) {
  assert(docs.includes(term), `Missing C3.2 docs term: ${term}`)
}

for (const filePath of [
  'src/cloud-attendance-records.js',
  'src/cloud-session-reports.js',
  'src/cloud-schedule-sessions.js',
  'src/cloud-tuition-records.js',
  'src/cloud-tuition-terms.js',
]) {
  const source = fs.readFileSync(path.join(repoRoot, filePath), 'utf8')
  assert(!source.includes('subscribeToStudentCloudRealtime'))
  assert(!source.includes('upsertStudentCloudEntity'))
}

console.log('C3.2 online Hoc vien realtime MVP smoke passed')

function createStudent(overrides = {}) {
  return {
    id: 'student-001',
    fullName: 'Hoc vien C3.2',
    birthDate: '2016-06-21',
    parentName: 'Phu huynh C3.2',
    motherPhone: '0901001001',
    level: 'Dolphin 1',
    currentStatus: 'Dang theo hoc',
    classSessionIds: [],
    createdAt: '2026-06-21T00:00:00.000Z',
    updatedAt: '2026-06-21T00:00:00.000Z',
    ...overrides,
  }
}

function createMockSupabase() {
  const mock = {
    upsertedRecords: [],
    channelName: '',
    postgresChangesConfig: null,
    realtimeHandler: null,
    from(tableName) {
      assert.equal(tableName, 'center_cloud_entities')
      return {
        upsert: async (records) => {
          mock.upsertedRecords = records
          return { error: null }
        },
      }
    },
    channel(channelName) {
      mock.channelName = channelName
      return {
        on: (eventName, config, handler) => {
          assert.equal(eventName, 'postgres_changes')
          mock.postgresChangesConfig = config
          mock.realtimeHandler = handler
          return this.channel(channelName)
        },
        subscribe: (callback) => {
          callback('SUBSCRIBED')
          return this.channel(channelName)
        },
        unsubscribe: () => {},
      }
    },
    removeChannel: () => {},
    emit(event) {
      mock.realtimeHandler?.(event)
    },
  }

  return mock
}
