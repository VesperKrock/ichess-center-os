import assert from 'node:assert/strict'
import { getVisibleScheduleSessions, renderScheduleModule } from '../src/schedule-module.js'
import {
  changeA3ClassTeacher,
  projectA3ScheduleSessions,
  resolveA3TeacherForDate,
} from '../src/cloud-authoritative-teacher-history.js'

const classSession = {
  id: 'a3-class', daysOfWeek: ['mon'], startTime: '09:00', endTime: '10:00',
  room: 'A3 room', instructorName: 'Teacher B', status: 'active',
}
const session = {
  id: 'a3-session', scheduleType: 'recurring', classSessionId: 'a3-class',
  studentIds: ['a3-student'], status: 'scheduled',
}
const assignments = [
  { class_session_local_id: 'a3-class', teacher_id: 'teacher-a', teacher_name: 'Teacher A', effective_from: '2026-09-01', effective_to: '2026-09-27' },
  { class_session_local_id: 'a3-class', teacher_id: 'teacher-b', teacher_name: 'Teacher B', effective_from: '2026-09-28', effective_to: null },
]
const occurrence = {
  schedule_session_local_id: 'a3-session', occurrence_date: '2026-09-21',
  class_session_local_id: 'a3-class', roster_student_ids: ['a3-student'],
  lifecycle_state: 'HELD', planned_start_time: '09:00:00', planned_end_time: '10:00:00', room: 'A3 room',
  planned_teacher_id: 'teacher-a', planned_teacher_name: 'Teacher A',
  actual_teacher_override: true, actual_teacher_id: 'teacher-c', actual_teacher_name: 'Teacher C',
}
const oldSlot = getVisibleScheduleSessions([session], '2026-09-21', [classSession])
assert.equal(oldSlot[0].teacherName, 'Teacher B')
assert.equal(projectA3ScheduleSessions(oldSlot, { assignments })[0].teacherName, 'Teacher A')
assert.equal(projectA3ScheduleSessions(oldSlot, { assignments, occurrences: [occurrence] })[0].teacherName, 'Teacher C')
assert.equal(projectA3ScheduleSessions(oldSlot, {})[0].teacherName, '')
const historicalCard = projectA3ScheduleSessions([], { occurrences: [occurrence] }, {
  scheduleSessions: [session], classSessions: [classSession],
})
assert.equal(historicalCard[0].id, 'a3-session')
assert.equal(historicalCard[0].teacherName, 'Teacher C')
const nextSlot = getVisibleScheduleSessions([session], '2026-09-28', [classSession])
assert.equal(projectA3ScheduleSessions(nextSlot, { assignments })[0].teacherName, 'Teacher B')
assert.equal(resolveA3TeacherForDate(assignments, 'a3-class', '2026-09-27')?.teacher_name, 'Teacher A')
assert.equal(resolveA3TeacherForDate(assignments, 'a3-class', '2026-09-28')?.teacher_name, 'Teacher B')

const html = renderScheduleModule(
  [session], null, null, [], null, null, null, null, false, null,
  [], [{ id: 'a3-student', fullName: 'A3 Student' }], '2026-09-21', null,
  {
    classSessions: [classSession], a3TeacherContext: { assignments, occurrences: [occurrence] },
    a3TeacherReady: true, a3TeacherChoices: [{ id: 'teacher-c', displayName: 'Teacher C' }],
    a3TeacherDialog: {
      kind: 'class', classId: 'a3-class', effectiveFrom: '2026-09-28', teacherId: 'teacher-c',
    },
  },
)
assert.match(html, /Teacher C/)
assert.doesNotMatch(html, /data-a3-teacher-action=/)
const detailHtml = renderScheduleModule(
  [session], null, null, [], null, null, null, null, false, null,
  [], [{ id: 'a3-student', fullName: 'A3 Student' }], '2026-09-21', null,
  {
    classSessions: [classSession], a3TeacherContext: { assignments, occurrences: [occurrence] },
    a3TeacherReady: true, a3TeacherChoices: [{ id: 'teacher-c', displayName: 'Teacher C' }],
    planDetail: { sessionId: 'a3-session', occurrenceDate: '2026-09-21' },
  },
)
assert.match(detailHtml, /data-a3-teacher-action="class"/)
assert.match(detailHtml, /data-a3-teacher-action="occurrence"/)
assert.match(html, /Áp dụng từ ngày/)
assert.match(html, /Lịch sử phụ trách lớp/)

const calls = []
const result = await changeA3ClassTeacher({
  supabase: { rpc: async (name, params) => {
    calls.push({ name, params })
    return { data: { ok: true }, error: null }
  } },
  centerId: 'center-a', classId: 'a3-class', teacherId: 'teacher-b',
  effectiveFrom: '2026-09-28', idempotencyKey: 'a3000000-0000-4000-8000-000000000001',
})
assert.equal(result.ok, true)
assert.equal(calls[0].name, 'a3_change_class_teacher')
assert.equal(calls[0].params.p_effective_from, '2026-09-28')
console.log('A3_TEACHER_HISTORY_SMOKE_PASS')
