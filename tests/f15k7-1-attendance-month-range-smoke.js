import assert from 'node:assert/strict'

import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'

const dataset = buildAngelWingsRealDataset()
const juneHtml = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
  null,
  [],
)

assert(!juneHtml.includes('data-attendance-date-key="2026-05-29"'))
assert(!juneHtml.includes('data-attendance-date-key="2026-05-30"'))
assert(!juneHtml.includes('data-attendance-date-key="2026-05-31"'))
assert(!juneHtml.includes('data-attendance-date-key="2026-07-01"'))

for (const dateKey of [
  '2026-06-17',
  '2026-06-19',
  '2026-06-20',
  '2026-06-21',
  '2026-06-24',
  '2026-06-26',
  '2026-06-27',
  '2026-06-28',
]) {
  assert(juneHtml.includes(`data-attendance-date-key="${dateKey}"`), `expected ${dateKey} in June view`)
}

assert(!juneHtml.includes('data-attendance-date-key="2026-06-18"'), 'Thursday should stay hidden without class/attendance')
assert(juneHtml.includes('data-attendance-cell-detail'), 'detail handler marker should remain')
assert(juneHtml.includes('data-attendance-note-open'), 'attendance board notes action should remain')

const missingClassSessionHtml = renderAttendanceBoardModule(
  dataset.students,
  [],
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: 'Phan Trần Minh Huy' },
  null,
  [],
)

assert(missingClassSessionHtml.includes('T7-CN 10:30-12:00'))
assert(!missingClassSessionHtml.includes('attendance-unassigned'))

const explicitClassIdHtml = renderAttendanceBoardModule(
  [
    {
      id: 'student-explicit-aw-class',
      fullName: 'Học viên có classSessionIds',
      classSessionIds: ['class-session-aw-t4-t6-1900-2030'],
    },
  ],
  [],
  [],
  [],
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
  null,
  [],
)

assert(explicitClassIdHtml.includes('T4-T6 19:00-20:30'))
assert(!explicitClassIdHtml.includes('attendance-unassigned'))

console.log('F15K.7.1 attendance month range smoke passed')
