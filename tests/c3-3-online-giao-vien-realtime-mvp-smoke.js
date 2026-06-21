import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  NEEDS_SUPABASE_REALTIME_PATCH,
  TEACHER_REALTIME_ENTITY_TYPE,
  getTeacherRealtimeRecord,
  mergeRealtimeTeacherIntoList,
  normalizeRealtimeTeacherPayload,
  subscribeToTeacherCloudRealtime,
  upsertTeacherCloudEntity,
} from '../src/cloud-realtime-teachers.js'
import { buildOnlineAccessState, canWriteEntity } from '../src/online-access-control.js'

const repoRoot = process.cwd()
const helperPath = path.join(repoRoot, 'src', 'cloud-realtime-teachers.js')
const studentHelperPath = path.join(repoRoot, 'src', 'cloud-realtime-students.js')
const mainPath = path.join(repoRoot, 'src', 'main.js')
const docsPath = path.join(repoRoot, 'docs', 'online-teacher-realtime-c3-3.md')
const helperSource = fs.readFileSync(helperPath, 'utf8')
const studentHelperSource = fs.readFileSync(studentHelperPath, 'utf8')
const mainSource = fs.readFileSync(mainPath, 'utf8')
const docs = fs.readFileSync(docsPath, 'utf8')

assert.equal(TEACHER_REALTIME_ENTITY_TYPE, 'teacher')
assert(helperSource.includes('subscribeToTeacherCloudRealtime'))
assert(helperSource.includes('buildOnlineAccessState'))
assert(helperSource.includes('canWriteEntity'))
assert(mainSource.includes('writeTeacherThroughCloud'))
assert(mainSource.includes('startTeacherRealtimeSubscription'))
assert(mainSource.includes("writeTeacherThroughCloud(savedTeacher, 'teacher-save')"))
assert(mainSource.includes("writeTeacherThroughCloud(getTeacherById(teacher.id), 'teacher-status')"))

assert(!helperSource.includes('attendance_record'))
assert(!helperSource.includes('session_report'))
assert(!helperSource.includes('schedule_session'))
assert(!helperSource.includes('tuition_record'))
assert(!helperSource.includes('CLOUD_ENTITY_TYPES.STUDENT'))
assert(!helperSource.includes('CLOUD_ENTITY_TYPES.CLASS_SESSION'))
assert(studentHelperSource.includes('subscribeToStudentCloudRealtime'))
assert(!studentHelperSource.includes('subscribeToTeacherCloudRealtime'))

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
  assert.equal(canWriteEntity(access, 'teacher'), false, `${role} must not write teacher cloud`)
  const result = await upsertTeacherCloudEntity({
    supabase: createMockSupabase(),
    centerId: 'dreamhome',
    teacher: createTeacher({ id: `teacher-${role}` }),
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
assert.equal(canWriteEntity(missingMembership, 'teacher'), false)

const missingMembershipWrite = await upsertTeacherCloudEntity({
  supabase: createMockSupabase(),
  centerId: 'dreamhome',
  teacher: createTeacher({ id: 'teacher-no-membership' }),
  accessState: missingMembership,
})
assert.equal(missingMembershipWrite.skipped, true)
assert.equal(missingMembershipWrite.detail.needsMembershipPatch, true)

for (const role of ['center_admin', 'owner', 'qtv']) {
  const access = buildOnlineAccessState({
    ...baseInput,
    membership: { role },
  })
  const mockSupabase = createMockSupabase()
  const result = await upsertTeacherCloudEntity({
    supabase: mockSupabase,
    centerId: 'dreamhome',
    teacher: createTeacher({ id: `teacher-${role}` }),
    userId: 'user-001',
    accessState: access,
  })

  assert.equal(result.ok, true, `${role} should write teacher cloud when ready`)
  assert.equal(mockSupabase.upsertedRecords.length, 1)
  assert.equal(mockSupabase.upsertedRecords[0].entity_type, 'teacher')
  assert.equal(mockSupabase.upsertedRecords[0].center_id, 'dreamhome')
  assert.equal(mockSupabase.upsertedRecords[0].payload.teacherType, 'parttime')
}

const normalizedTeacher = normalizeRealtimeTeacherPayload(
  createTeacher({
    id: 'teacher-normalized',
    status: 'paused',
    teacherType: 'collaborator',
    strengths: ['Endgame', 'Endgame', ''],
  }),
)
assert.equal(normalizedTeacher.ok, true)
assert.equal(normalizedTeacher.teacher.status, 'paused')
assert.equal(normalizedTeacher.teacher.teacherType, 'collaborator')
assert.deepEqual(normalizedTeacher.teacher.strengths, ['Endgame'])

const realtimeAccess = buildOnlineAccessState({
  ...baseInput,
  membership: { role: 'viewer' },
})
const realtimeEvents = []
const realtimeStatuses = []
const mockRealtimeSupabase = createMockSupabase()
const subscription = subscribeToTeacherCloudRealtime({
  supabase: mockRealtimeSupabase,
  centerId: 'dreamhome',
  accessState: realtimeAccess,
  onTeacherRecord: (record) => realtimeEvents.push(record),
  onStatusChange: (status) => realtimeStatuses.push(status),
})

assert.equal(subscription.ok, true)
assert.equal(mockRealtimeSupabase.channelName, 'ichess-center-teachers:dreamhome')
assert.equal(mockRealtimeSupabase.postgresChangesConfig.filter, 'center_id=eq.dreamhome')
assert.equal(mockRealtimeSupabase.postgresChangesConfig.table, 'center_cloud_entities')
assert.equal(realtimeStatuses[0].status, 'SUBSCRIBED')

mockRealtimeSupabase.emit({
  eventType: 'UPDATE',
  new: {
    center_id: 'dreamhome',
    entity_type: 'student',
    payload: { id: 'student-001' },
  },
})
assert.equal(realtimeEvents.length, 0, 'Non-teacher realtime event must be ignored')

mockRealtimeSupabase.emit({
  eventType: 'UPDATE',
  new: {
    center_id: 'dreamhome',
    entity_type: 'teacher',
    payload: createTeacher({ id: 'teacher-rt-001', fullName: 'Giao vien realtime' }),
  },
})
assert.equal(realtimeEvents.length, 1)
assert.equal(getTeacherRealtimeRecord({ new: realtimeEvents[0] })?.entity_type, 'teacher')

const olderLocal = createTeacher({
  id: 'teacher-rt-001',
  fullName: 'Ban moi hon',
  updatedAt: '2026-06-21T10:00:00.000Z',
})
const olderRemoteRecord = {
  payload: createTeacher({
    id: 'teacher-rt-001',
    fullName: 'Ban cu',
    updatedAt: '2026-06-20T10:00:00.000Z',
  }),
}
const skippedOlder = mergeRealtimeTeacherIntoList([olderLocal], olderRemoteRecord)
assert.equal(skippedOlder.changed, false)
assert.equal(skippedOlder.teachers[0].fullName, 'Ban moi hon')

const mergeResult = mergeRealtimeTeacherIntoList(
  [createTeacher({ id: 'teacher-rt-001', fullName: 'Cu' })],
  {
    payload: createTeacher({
      id: 'teacher-rt-001',
      fullName: 'Moi',
      updatedAt: '2026-06-21T11:00:00.000Z',
    }),
  },
)
assert.equal(mergeResult.ok, true)
assert.equal(mergeResult.changed, true)
assert.equal(mergeResult.teachers.length, 1, 'Realtime echo must not duplicate same teacher id')
assert.equal(mergeResult.teachers[0].fullName, 'Moi')

const noRealtimeClient = subscribeToTeacherCloudRealtime({
  supabase: {},
  centerId: 'dreamhome',
  accessState: realtimeAccess,
})
assert.equal(noRealtimeClient.ok, false)
assert.equal(noRealtimeClient.needsRealtimePatch, true)
assert(noRealtimeClient.message.includes(NEEDS_SUPABASE_REALTIME_PATCH))

for (const term of [
  'teacher',
  'ichessCenterOS.teachers.dreamhome',
  'Access-control/write guard',
  'NEEDS MEMBERSHIP SQL PATCH',
  'NEEDS SUPABASE REALTIME PATCH',
  'NEEDS SUPABASE CONFIRMATION',
  'Manual QA',
  'Non-scope',
]) {
  assert(docs.includes(term), `Missing C3.3 docs term: ${term}`)
}

for (const filePath of [
  'src/cloud-attendance-records.js',
  'src/cloud-session-reports.js',
  'src/cloud-schedule-sessions.js',
  'src/cloud-tuition-records.js',
  'src/cloud-tuition-terms.js',
]) {
  const source = fs.readFileSync(path.join(repoRoot, filePath), 'utf8')
  assert(!source.includes('subscribeToTeacherCloudRealtime'))
  assert(!source.includes('upsertTeacherCloudEntity'))
}

console.log('C3.3 online Giao vien realtime MVP smoke passed')

function createTeacher(overrides = {}) {
  return {
    id: 'teacher-001',
    fullName: 'Giao vien C3.3',
    displayName: 'GV C3.3',
    phone: '0901001002',
    teacherType: 'parttime',
    status: 'active',
    specialties: ['Co vua tre em'],
    levels: ['Dolphin 1'],
    teachingGroups: ['beginner'],
    teachingModes: ['offline'],
    strengths: ['Opening'],
    internalTags: ['online-mvp'],
    assignedClassNames: [],
    assignedStudentIds: [],
    currentStudentCount: 0,
    availableDays: ['mon'],
    preferredTimeSlots: ['18:00-19:30'],
    availableClassSessionIds: [],
    maxSessionsPerWeek: 6,
    canTakeNewClass: true,
    createdAt: '2026-06-21T00:00:00.000Z',
    updatedAt: '2026-06-21T00:00:00.000Z',
    ...overrides,
  }
}

function createMockSupabase() {
  const mock = {
    upsertedRecords: [],
    upsertOptions: null,
    channelName: '',
    postgresChangesConfig: null,
    realtimeHandler: null,
    from(tableName) {
      assert.equal(tableName, 'center_cloud_entities')
      return {
        upsert: async (records, options) => {
          mock.upsertedRecords = records
          mock.upsertOptions = options
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
