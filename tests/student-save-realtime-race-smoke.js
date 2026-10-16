import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync('src/main.js', 'utf8')
const start = source.indexOf('async function commitV22StudentProjection(')
const end = source.indexOf('\nasync function ', start + 1)
const functionSource = source.slice(start, end)
assert.match(source.slice(source.indexOf('function resetV22StudentEnrollmentRuntimeForAccessBoundary'), source.indexOf('function resetV22StudentEnrollmentRuntimeForAccessBoundary') + 240), /v22StudentEnrollmentWriteRunId \+= 1/)
async function scenario(changeDuringCommand) {
  const context = vm.createContext({
    centerId: 'center-a', students: [], v22StudentEnrollmentSets: [], notifications: [],
    v22StudentEnrollmentSyncRunId: 0, v22StudentEnrollmentWriteRunId: 0,
    v22StudentEnrollmentCapabilityState: { centerId: 'center-a', status: 'ready' },
    getCurrentCanonicalCenterContext: () => ({ centerId: context.centerId }),
    isV22StudentEnrollmentCapabilityReady: () => true,
    normalizeV22Enrollments: value => value || [], createCoreCommandIdempotencyKey: () => 'stable-key',
    getSupabaseClient: () => ({}), render: () => {}, saveStoredStudents: () => {},
    syncAppNotifications: value => value, getV22EnrollmentOutcomeMessage: code => code,
    upsertCommittedCoreProjection: (_, student) => [student],
    refreshV22StudentEnrollments: async () => { context.v22StudentEnrollmentSyncRunId++; return { ok: true } },
    mutateV22StudentWithEnrollments: async () => {
      changeDuringCommand(context)
      return { ok: true, student: { id: 'student-one' }, enrollmentSet: { studentId: 'student-one', version: 2 } }
    },
  })
  vm.runInContext(functionSource, context)
  const result = await context.commitV22StudentProjection({ id: 'student-one', enrollmentVersion: 1, recurringEnrollments: [] }, 'test', 'stable-key')
  return { result, context }
}
const sameCenterRead = await scenario(c => { c.v22StudentEnrollmentSyncRunId++ })
assert.equal(sameCenterRead.result.ok, true, 'A same-center refresh must not turn a committed save into CENTER_CONTEXT_CHANGED')
assert.equal(sameCenterRead.context.students.length, 1)
assert.equal(sameCenterRead.context.v22StudentEnrollmentSets[0].version, 2)
const switched = await scenario(c => { c.centerId = 'center-b'; c.v22StudentEnrollmentWriteRunId++ })
assert.equal(switched.result.ok, false); assert.equal(switched.result.committed, true)
assert.equal(switched.context.students.length, 0)
const returnedToSameCenter = await scenario(c => { c.v22StudentEnrollmentWriteRunId += 2 })
assert.equal(returnedToSameCenter.result.outcome_code, 'CENTER_CONTEXT_CHANGED')
assert.equal(returnedToSameCenter.context.students.length, 0)
const newerWrite = await scenario(c => { c.v22StudentEnrollmentWriteRunId++ })
assert.equal(newerWrite.result.ok, false)
console.log('Student save vs realtime refresh: PASS; same-center reads accepted, boundary changes and newer writes remain fenced')
