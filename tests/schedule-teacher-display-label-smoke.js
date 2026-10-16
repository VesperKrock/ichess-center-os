import assert from 'node:assert/strict'
import { getVisibleScheduleSessions } from '../src/schedule-module.js'
import { projectA3ScheduleSessions } from '../src/cloud-authoritative-teacher-history.js'
const ca = { id: 'ca-one', name: 'T3 - T5 17:30 - 19:00', daysOfWeek: ['tue', 'thu'], startTime: '17:30', endTime: '19:00', status: 'active', teacherDisplayName: 'Cô QA' }
const slots = getVisibleScheduleSessions([], '2026-10-12', [ca])
assert.equal(slots.length, 2)
assert(slots.every(s => s.teacherName === 'Cô QA'))
const context = { assignments: [], occurrences: [] }, sources = { classSessions: [ca] }
assert(projectA3ScheduleSessions(slots, context, sources).every(s => s.teacherName === 'Cô QA'))
assert(projectA3ScheduleSessions(slots, context, { classSessions: [{ ...ca, teacherDisplayName: '' }] }).every(s => s.teacherName === ''))
const dated = { class_session_local_id: ca.id, effective_from: '2026-10-01', effective_to: null, teacher_id: 'existing-staff', teacher_name: 'Existing dated Teacher' }
assert(projectA3ScheduleSessions(slots, { assignments: [dated] }, sources).every(s => s.teacherName === dated.teacher_name))
const first = slots[0], fact = { schedule_session_local_id: first.id, class_session_local_id: ca.id, occurrence_date: first.occurrenceDate, planned_teacher_name: 'Historical Teacher', planned_teacher_id: 'existing-staff', lifecycle_state: 'HELD', roster_student_ids: [], planned_start_time: '17:30', planned_end_time: '19:00' }
const historical = projectA3ScheduleSessions(slots, { occurrences: [fact], assignments: [] }, { classSessions: [{ ...ca, teacherDisplayName: 'Changed current label' }] })
assert.equal(historical.find(s => s.a3OccurrenceMaterialized).teacherName, 'Historical Teacher')
assert.equal(ca.teacherDisplayName, 'Cô QA')
console.log('Weekly Ca teacher labels: PASS; editable display text shown without accounts, dated assignments and frozen occurrence history preserved')
