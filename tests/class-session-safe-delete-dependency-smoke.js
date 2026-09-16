import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getClassSessionDependencyState,
  inspectAuthoritativeClassSessionDependencies,
} from '../src/class-session-lifecycle.js'

const unused = getClassSessionDependencyState({ classSessionId: 'class-x' })
assert.equal(unused.canDelete, true)

const studentDependency = getClassSessionDependencyState({
  classSessionId: 'class-y',
  enrollmentSets: [{ studentId: 'student-1', enrollments: [{ classSessionId: 'class-y' }] }],
})
assert.equal(studentDependency.canDelete, false)
assert.equal(studentDependency.counts.studentAssignments, 1)
assert.match(studentDependency.message, /Ngưng dùng/)

const historicalScheduleDependency = getClassSessionDependencyState({
  classSessionId: 'class-y',
  scheduleSessions: [{ id: 'schedule-1', classSessionId: 'class-y', isDeleted: true }],
  attendanceRecords: [{ id: 'attendance-1', scheduleSessionId: 'schedule-1', isDeleted: true }],
  sessionReports: [{ id: 'report-1', sessionId: 'schedule-1' }],
})
assert.equal(historicalScheduleDependency.canDelete, false)
assert.equal(historicalScheduleDependency.counts.scheduleSessions, 1)
assert.equal(historicalScheduleDependency.counts.attendanceRecords, 1)
assert.equal(historicalScheduleDependency.counts.sessionReports, 1)

const rows = [
  {
    center_id: 'qa-center-one', entity_type: 'schedule_session', local_id: 'schedule-1',
    payload: { id: 'schedule-1', classSessionId: 'class-y' }, entity_version: 2,
    deleted_at: '2026-09-15T00:00:00.000Z',
  },
  {
    center_id: 'qa-center-one', entity_type: 'attendance_record', local_id: 'attendance-1',
    payload: { id: 'attendance-1', scheduleSessionId: 'schedule-1' }, entity_version: 1,
    deleted_at: null,
  },
]
const query = {
  select() { return this },
  eq(field, value) { assert.equal(field, 'center_id'); assert.equal(value, 'qa-center-one'); return this },
  in(field, values) {
    assert.equal(field, 'entity_type')
    assert(values.includes('session_report'))
    return Promise.resolve({ data: rows, error: null })
  },
}
const inspected = await inspectAuthoritativeClassSessionDependencies({
  supabase: { from: (table) => { assert.equal(table, 'center_cloud_entities'); return query } },
  centerId: 'qa-center-one',
  classSessionId: 'class-y',
})
assert.equal(inspected.ok, true)
assert.equal(inspected.dependencyState.canDelete, false)

const migration = readFileSync(
  new URL('../supabase/migrations/202609160001_class_session_safe_delete_guard.sql', import.meta.url),
  'utf8',
)
for (const token of [
  'class_session_delete_referenced',
  'center_student_recurring_enrollments',
  "entity_type = 'schedule_session'",
  "entity_type in ('attendance_record', 'session_report')",
  "student.payload->'classSessionIds'",
  "student.payload->'recurringEnrollments'",
]) assert(migration.includes(token), `Missing safe-delete server guard: ${token}`)
console.log('CLASS_SESSION_SAFE_DELETE_DEPENDENCY_SMOKE: PASS')
