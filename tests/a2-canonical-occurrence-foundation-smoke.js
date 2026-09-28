import assert from 'node:assert/strict'
import { getVisibleScheduleSessions, renderScheduleModule } from '../src/schedule-module.js'

const classSession = {
  id: 'a2-smoke-class',
  daysOfWeek: ['mon'],
  startTime: '10:00',
  endTime: '11:00',
  room: 'A2 room',
  instructorName: 'A2 teacher',
  status: 'active',
}
const assignment = {
  id: 'a2-smoke-session',
  scheduleType: 'recurring',
  classSessionId: classSession.id,
  dayOfWeek: 'mon',
  startDate: '2026-09-28',
  studentIds: ['a2-smoke-student'],
  status: 'scheduled',
}
const visible = getVisibleScheduleSessions([assignment], '2026-09-28', [classSession])
assert.equal(visible.length, 1)
assert.equal(visible[0].id, assignment.id)
assert.equal(visible[0].occurrenceDate, '2026-09-28')
assert.equal(visible[0].teacherName, 'A2 teacher')
assert.equal(visible[0].room, 'A2 room')

const html = renderScheduleModule(
  [assignment], null, null, [], null, null, null, null, false, null,
  [], [{ id: 'a2-smoke-student', fullName: 'A2 student' }],
  '2026-09-28', null, {
    classSessions: [classSession],
    a3TeacherContext: { assignments: [{
      class_session_local_id: classSession.id,
      teacher_name: 'A2 teacher',
      effective_from: '2026-09-28', effective_to: null,
    }], occurrences: [] },
  },
)
assert.match(html, /data-schedule-session-id="a2-smoke-session"/)
assert.match(html, /data-schedule-occurrence-date="2026-09-28"/)
assert.match(html, /A2 teacher/)
assert.match(html, /A2 room/)
console.log('A2_SCHEDULE_FUTURE_RENDER_SMOKE_PASS')
