import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  V22_STUDENT_ENROLLMENT_CAPABILITY_STATUS,
  createV22StudentEnrollmentCapabilityState,
  isV22StudentEnrollmentBackendUnavailable,
  isV22StudentEnrollmentCapabilityReady,
  mutateV22StudentWithEnrollments,
  pullV22StudentEnrollments,
} from '../src/cloud-authoritative-student-enrollments.js'
import {
  classifyLegacyStudentEnrollments,
  deriveV22ScheduleRosters,
  getV22ClassSessionWeekdays,
  normalizeV22Enrollments,
  normalizeV22Weekday,
  projectStudentsWithV22Enrollments,
  reconcileV22EnrollmentDayInput,
  reconcileV22StudentFormValues,
  validateV22EnrollmentSelection,
} from '../src/student-recurring-enrollment.js'
import {
  createEditStudentFormState,
  createEmptyStudentFormState,
  initialStudentFilters,
  renderStudentModule,
  validateStudentForm,
} from '../src/student-module.js'
import { getVisibleScheduleSessions } from '../src/schedule-module.js'

const read = (path) => readFileSync(path, 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
const migrationPath = 'supabase/migrations/202609090001_v2_2_student_individualized_recurring_enrollment.sql'
const migration = read(migrationPath)
const main = read('src/main.js')
const scheduleSource = read('src/schedule-module.js')
const coreSource = read('src/cloud-authoritative-core.js')

const classSessions = [
  { id: 'class-wed-fri', daysOfWeek: ['wed', 'fri'], displayLabel: 'T4 - T6 19:00 - 20:30', status: 'active' },
  { id: 'class-sat', daysOfWeek: ['sat'], displayLabel: 'T7 09:00 - 10:30', status: 'active' },
  { id: 'class-sun', daysLabel: 'CN', displayLabel: 'CN 14:00 - 15:30', status: 'active' },
]

assert.deepEqual(Object.values(V22_STUDENT_ENROLLMENT_CAPABILITY_STATUS), [
  'idle', 'loading', 'ready', 'unavailable', 'failed',
])
for (const status of Object.values(V22_STUDENT_ENROLLMENT_CAPABILITY_STATUS)) {
  const state = createV22StudentEnrollmentCapabilityState({ centerId: 'center-a', status })
  assert.equal(isV22StudentEnrollmentCapabilityReady(state, 'center-a'), status === 'ready')
}
assert.equal(isV22StudentEnrollmentCapabilityReady(
  createV22StudentEnrollmentCapabilityState({ centerId: 'center-a', status: 'ready' }),
  'center-b',
), false, 'Enrollment capability leaked across centers')

assert.deepEqual(getV22ClassSessionWeekdays(classSessions[0]), ['wed', 'fri'])
assert.deepEqual(getV22ClassSessionWeekdays(classSessions[2]), ['sun'])
assert.deepEqual(normalizeV22Enrollments([
  { classSessionId: 'class-wed-fri', weekdays: ['T6', 'fri', 'wed'] },
  { class_session_id: 'class-wed-fri', weekdays: ['t4'] },
]), [{ classSessionId: 'class-wed-fri', weekdays: ['wed', 'fri'], legacyReviewRequired: false }])

const singleDayLegacy = classifyLegacyStudentEnrollments(
  { classSessionIds: ['class-sat'] },
  classSessions,
)
assert.equal(singleDayLegacy.status, 'deterministic')
assert.deepEqual(singleDayLegacy.enrollments[0].weekdays, ['sat'])
assert.equal(singleDayLegacy.enrollments[0].legacyReviewRequired, false)

const multiDayLegacy = classifyLegacyStudentEnrollments(
  { classSessionIds: ['class-wed-fri'] },
  classSessions,
)
assert.equal(multiDayLegacy.status, 'review-required')
assert.deepEqual(multiDayLegacy.enrollments[0].weekdays, [])
assert.equal(multiDayLegacy.enrollments[0].legacyReviewRequired, true)

assert.equal(validateV22EnrollmentSelection([
  { classSessionId: 'class-wed-fri', weekdays: ['fri'] },
  { classSessionId: 'class-sat', weekdays: ['sat'] },
], classSessions).ok, true)
assert.equal(validateV22EnrollmentSelection([
  { classSessionId: 'class-wed-fri', weekdays: [] },
], classSessions).errors[0].code, 'WEEKDAY_REQUIRED')
assert.equal(validateV22EnrollmentSelection([
  { classSessionId: 'class-wed-fri', weekdays: ['sun'] },
], classSessions).errors[0].code, 'WEEKDAY_NOT_IN_CLASS')
assert.equal(validateV22EnrollmentSelection([
  { classSessionId: 'missing-class', weekdays: ['fri'] },
], classSessions).errors[0].code, 'CLASS_SESSION_NOT_FOUND')

const baseStudents = [
  { id: 'student-fri', fullName: 'Friday', currentStatus: 'Đang theo học' },
  { id: 'student-wed', fullName: 'Wednesday', currentStatus: 'Đang theo học' },
  { id: 'student-paused', fullName: 'Paused', currentStatus: 'Bảo lưu' },
  { id: 'student-deleted', fullName: 'Deleted', currentStatus: 'Đang theo học', isDeleted: true },
]
const enrollmentSets = [
  { studentId: 'student-fri', version: 2, enrollments: [{ classSessionId: 'class-wed-fri', weekdays: ['fri'] }] },
  { studentId: 'student-wed', version: 1, enrollments: [{ classSessionId: 'class-wed-fri', weekdays: ['wed'] }] },
  { studentId: 'student-paused', version: 1, enrollments: [{ classSessionId: 'class-wed-fri', weekdays: ['fri'] }] },
  { studentId: 'student-deleted', version: 1, enrollments: [{ classSessionId: 'class-wed-fri', weekdays: ['fri'] }] },
]
const sessions = [
  { id: 'fri-recurring', scheduleType: 'recurring', classSessionId: 'class-wed-fri', dayOfWeek: 'friday', studentIds: ['legacy-id'] },
  { id: 'wed-recurring', scheduleType: 'recurring', classSessionId: 'class-wed-fri', dayOfWeek: 'wed', studentIds: [] },
  { id: 'one-off', scheduleType: 'oneOff', classSessionId: '', dayOfWeek: 'fri', studentIds: ['guest-id'] },
  { id: 'unlinked-recurring', scheduleType: 'recurring', title: 'Same display label must not match', dayOfWeek: 'fri', studentIds: ['legacy-id'] },
]
const roster = deriveV22ScheduleRosters({ sessions, students: baseStudents, enrollmentSets, capabilityReady: true })
assert.deepEqual(roster.find((item) => item.id === 'fri-recurring').studentIds, ['student-fri'])
assert.deepEqual(roster.find((item) => item.id === 'wed-recurring').studentIds, ['student-wed'])
assert.deepEqual(roster.find((item) => item.id === 'one-off').studentIds, ['guest-id'])
assert.deepEqual(roster.find((item) => item.id === 'unlinked-recurring').studentIds, [])
assert.equal(roster.find((item) => item.id === 'unlinked-recurring').rosterReviewRequired, true)
assert.equal(deriveV22ScheduleRosters({ sessions, capabilityReady: false }), sessions,
  'Backend-absent production path must preserve the legacy projection unchanged')

const expandedOccurrences = getVisibleScheduleSessions([
  {
    id: 'shared-class-assignment', scheduleType: 'recurring', classSessionId: 'class-wed-fri',
    dayOfWeek: 'wed', startTime: '19:00', endTime: '20:30', status: 'scheduled',
    studentIds: ['legacy-id'],
  },
], '2026-09-07', [{
  ...classSessions[0], startTime: '19:00', endTime: '20:30', room: 'A', level: 'mixed',
}])
const occurrenceRosters = deriveV22ScheduleRosters({
  sessions: expandedOccurrences, students: baseStudents, enrollmentSets, capabilityReady: true,
})
assert.equal(occurrenceRosters.length, 2)
assert.deepEqual(occurrenceRosters.find((item) => normalizeV22Weekday(item.dayOfWeek) === 'wed').studentIds, ['student-wed'])
assert.deepEqual(occurrenceRosters.find((item) => normalizeV22Weekday(item.dayOfWeek) === 'fri').studentIds, ['student-fri'])

const projected = projectStudentsWithV22Enrollments(baseStudents, enrollmentSets, classSessions, true)
assert.equal(projected.find((item) => item.id === 'student-fri').enrollmentVersion, 2)
assert.deepEqual(projected.find((item) => item.id === 'student-fri').classSessionIds, ['class-wed-fri'])
assert.equal(projectStudentsWithV22Enrollments(baseStudents, [], classSessions, false), baseStudents)
const projectedLegacyReview = projectStudentsWithV22Enrollments([
  { id: 'legacy-multi', classSessionIds: ['class-wed-fri'], currentStatus: 'Đang theo học' },
], [], classSessions, true)[0]
assert.deepEqual(projectedLegacyReview.classSessionIds, ['class-wed-fri'])
assert.equal(projectedLegacyReview.recurringEnrollments[0].legacyReviewRequired, true)

const untouchedDraft = { fullName: 'Draft kept', classSessionIds: ['class-wed-fri'] }
const reconciledReview = reconcileV22StudentFormValues({
  values: untouchedDraft,
  rawStudent: { classSessionIds: [] },
  projectedStudent: { classSessionIds: [], recurringEnrollments: [], enrollmentVersion: 4 },
  classSessions,
})
assert.equal(reconciledReview.fullName, 'Draft kept')
assert.equal(reconciledReview.enrollmentVersion, 4)
assert.deepEqual(reconciledReview.recurringEnrollments, [{
  classSessionId: 'class-wed-fri', weekdays: [], legacyReviewRequired: true,
}])
assert.equal(reconciledReview.useAuthoritativeEnrollment, true)

assert.deepEqual(reconcileV22EnrollmentDayInput({
  currentEnrollments: [
    { classSessionId: 'class-wed-fri', weekdays: [], legacyReviewRequired: true },
    { classSessionId: 'missing-class', weekdays: [], legacyReviewRequired: true },
  ],
  checkedEnrollments: [{ classSessionId: 'class-wed-fri', weekdays: ['fri'] }],
  changedClassSessionId: 'class-wed-fri',
}), [
  { classSessionId: 'class-wed-fri', weekdays: ['fri'], legacyReviewRequired: false },
  { classSessionId: 'missing-class', weekdays: [], legacyReviewRequired: true },
], 'Choosing one legacy class must preserve every untouched review-required link')

const reconciledAuthoritative = reconcileV22StudentFormValues({
  values: { fullName: 'Other draft kept', classSessionIds: ['class-sat'] },
  rawStudent: { classSessionIds: ['class-sat'] },
  projectedStudent: {
    classSessionIds: ['class-sat'], enrollmentVersion: 2,
    recurringEnrollments: [{ classSessionId: 'class-sat', weekdays: ['sat'] }],
  },
  classSessions,
})
assert.equal(reconciledAuthoritative.fullName, 'Other draft kept')
assert.deepEqual(reconciledAuthoritative.recurringEnrollments[0].weekdays, ['sat'])

const editState = createEditStudentFormState({
  id: 'legacy-student', classSessionIds: ['class-wed-fri'], recurringEnrollments: multiDayLegacy.enrollments,
  useAuthoritativeEnrollment: true, fullName: 'A', birthDate: '2020-01-01', schoolName: 'B',
  parentName: 'C', fatherPhone: '0900000000', level: 'Dolphin 1',
})
assert.equal(editState.values.useAuthoritativeEnrollment, true)
assert(validateStudentForm(editState.values, classSessions).recurringEnrollments)
const authoritativeHtml = renderStudentModule([], initialStudentFilters, createEmptyStudentFormState({
  useAuthoritativeEnrollment: true,
}), [], classSessions, { enrollmentCapabilityStatus: 'ready' })
assert.match(authoritativeHtml, /data-student-enrollment-day/)
assert.match(authoritativeHtml, /Buổi học bù hoặc học thử/)
const missingLegacyHtml = renderStudentModule([], initialStudentFilters, createEditStudentFormState({
  id: 'legacy-missing', classSessionIds: ['missing-class'],
  recurringEnrollments: [{ classSessionId: 'missing-class', weekdays: [], legacyReviewRequired: true }],
  useAuthoritativeEnrollment: true, fullName: 'A', birthDate: '2020-01-01', schoolName: 'B',
  parentName: 'C', fatherPhone: '0900000000', level: 'Dolphin 1',
}), [], classSessions, { enrollmentCapabilityStatus: 'ready' })
assert.match(missingLegacyHtml, /Không thể tự suy ra ngày học/)
assert.match(missingLegacyHtml, /data-student-enrollment-remove-legacy="missing-class"/)
const legacyLoadingHtml = renderStudentModule([], initialStudentFilters, createEmptyStudentFormState(), [], classSessions, {
  enrollmentCapabilityStatus: 'loading',
})
assert.match(legacyLoadingHtml, /Đang kiểm tra đăng ký lịch học theo từng ngày/)
assert.doesNotMatch(legacyLoadingHtml, /data-student-enrollment-day/)

for (const code of ['PGRST202', 'PGRST205', '42P01', '42883']) {
  assert.equal(isV22StudentEnrollmentBackendUnavailable({ code }), true)
  const unavailable = await pullV22StudentEnrollments({
    centerId: 'center-a',
    supabase: { rpc: async () => ({ data: null, error: { code, message: 'missing function' } }) },
  })
  assert.equal(unavailable.outcome_code, 'BACKEND_NOT_DEPLOYED')
}
const readCalls = []
const readyRead = await pullV22StudentEnrollments({
  centerId: 'center-a',
  supabase: { rpc: async (name, params) => {
    readCalls.push({ name, params })
    return { data: { ok: true, center_id: 'center-a', enrollment_sets: [{
      student_id: 'student-fri', version: 2,
      enrollments: [{ class_session_id: 'class-wed-fri', weekdays: ['fri'] }],
    }] }, error: null }
  } },
})
assert.equal(readyRead.ok, true)
assert.equal(readCalls[0].name, 'v2_2_list_student_enrollments')
assert.equal(readCalls[0].params.p_center_id, 'center-a')
assert.equal((await pullV22StudentEnrollments({
  centerId: 'center-b',
  supabase: { rpc: async () => ({ data: { ok: true, center_id: 'center-a', enrollment_sets: [] }, error: null }) },
})).outcome_code, 'INVALID_SERVER_RESULT')

const writeCalls = []
const saved = await mutateV22StudentWithEnrollments({
  centerId: 'center-a',
  student: { id: 'student-fri', fullName: 'Friday', cloudVersion: 4 },
  expectedEnrollmentVersion: 2,
  enrollments: [{ classSessionId: 'class-wed-fri', weekdays: ['fri'] }],
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  supabase: { rpc: async (name, params) => {
    writeCalls.push({ name, params })
    return { data: {
      ok: true, center_id: 'center-a', student_local_id: 'student-fri', student_version: 5,
      student_updated_at: '2026-09-09T00:00:00Z', student_payload: { id: 'student-fri', fullName: 'Friday' },
      enrollment_set: { student_id: 'student-fri', version: 3, enrollments: [{ class_session_id: 'class-wed-fri', weekdays: ['fri'] }] },
    }, error: null }
  } },
})
assert.equal(saved.ok, true)
assert.equal(writeCalls[0].name, 'v2_2_mutate_student_with_enrollments')
assert.equal(writeCalls[0].params.p_expected_student_version, 4)
assert.equal(writeCalls[0].params.p_expected_enrollment_version, 2)
assert.deepEqual(writeCalls[0].params.p_enrollments, [{ class_session_id: 'class-wed-fri', weekdays: ['fri'] }])

for (const token of [
  'create table public.center_student_enrollment_sets',
  'create table public.center_student_recurring_enrollments',
  'create table public.center_student_enrollment_command_results',
  'create table public.center_student_enrollment_audit_events',
  'force row level security',
  'v2_2_list_student_enrollments',
  'v2_2_mutate_student_with_enrollments',
  'v2_2_duplicate_student_class',
  'v2_2_weekday_required',
  'v2_2_weekday_not_in_class',
  'v2_2_enrollment_version_conflict',
  'v2_2_idempotency_conflict',
  'v2_2_class_weekday_in_use',
  'v2_2_schedule_class_link_required',
  "p_center_id, 'student', v_student_id, p_expected_student_version",
]) assert(migration.includes(token), `Missing migration contract: ${token}`)
assert.match(migration, /revoke all on table public\.center_student_enrollment_sets from public, anon, authenticated, service_role/i)
assert.match(migration, /revoke all on sequence public\.center_student_enrollment_audit_events_id_seq from public, anon, authenticated, service_role/i)
assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete|truncate|all)[\s\S]{0,100}to authenticated/i)
assert.doesNotMatch(migration, /insert\s+into\s+public\.center_student_enrollment_sets[\s\S]+select[\s\S]+classSessionIds/i,
  'Migration silently backfilled legacy classSessionIds')
assert.doesNotMatch(migration, /attendance/i, 'V2-2 migration changed historical attendance authority')
assert.doesNotMatch(migration, /p3d|p4b/i)

for (const token of [
  'getVisibleScheduleSessionsWithCurrentEnrollmentRosters',
  'refreshV22StudentEnrollments',
  'reconcileOpenStudentFormWithV22Authority',
  'resetV22StudentEnrollmentRuntimeForAccessBoundary',
  'isV22StudentEnrollmentCapabilityReady',
  'commitV22StudentProjection',
]) assert(main.includes(token), `Missing runtime boundary: ${token}`)
const resetStart = main.indexOf('function resetV22StudentEnrollmentRuntimeForAccessBoundary')
const resetEnd = main.indexOf('function getPersonalWallpaperScope', resetStart)
assert(resetStart >= 0 && resetEnd > resetStart)
const resetBoundary = main.slice(resetStart, resetEnd)
for (const token of [
  'v22StudentEnrollmentSyncRunId += 1',
  'v22StudentEnrollmentSets = []',
  'createV22StudentEnrollmentCapabilityState({ centerId })',
  'studentFormState = null',
]) assert(resetBoundary.includes(token), `Center/account enrollment reset missing: ${token}`)
assert(main.includes("v22StudentEnrollmentCapabilityState.status === V22_STUDENT_ENROLLMENT_CAPABILITY_STATUS.UNAVAILABLE"))
assert(main.includes("outcome_code: v22StudentEnrollmentCapabilityState.status === V22_STUDENT_ENROLLMENT_CAPABILITY_STATUS.FAILED"))
assert(scheduleSource.includes('recurringRosterManaged'))
assert(scheduleSource.includes('renderManagedRecurringRosterNotice'))
assert(coreSource.includes('CLASS_WEEKDAY_IN_USE'))
assert(coreSource.includes('SCHEDULE_CLASS_LINK_REQUIRED'))
assert.doesNotMatch(main, /localStorage[^\n]*(?:recurringEnroll|enrollmentSet)/i)

console.log(`V2_2A_STUDENT_INDIVIDUALIZED_ENROLLMENT_TKB_ROSTER_SMOKE: PASS (${sha256(migrationPath)})`)
