import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderScheduleModule } from '../src/schedule-module.js'

const students = [
  {
    id: 'student-f19d-1',
    fullName: 'Học viên F19D Một',
    level: 'Dolphin 1',
    parentName: 'Phụ huynh F19D',
  },
  {
    id: 'student-f19d-2',
    fullName: 'Học viên F19D Hai',
    level: 'Dolphin 2',
    parentName: 'Phụ huynh F19D',
  },
]
const teachers = [
  {
    id: 'teacher-f19d',
    fullName: 'Giáo viên F19D',
    nickname: 'GV F19D',
  },
]
const sessions = [
  {
    id: 'schedule-f19d',
    scheduleType: 'oneOff',
    title: 'Ca kiểm thử F19D',
    dayOfWeek: 'friday',
    startDate: null,
    endDate: null,
    date: '2026-06-05',
    occurrenceReason: 'extra',
    startTime: '18:00',
    endTime: '19:30',
    room: 'Phòng F19D',
    teacherId: 'teacher-f19d',
    teacherName: '',
    studentIds: students.map((student) => student.id),
    groupName: 'Nhóm F19D',
    level: 'beginner',
    status: 'scheduled',
    note: '',
  },
]
const reportState = {
  sessionId: 'schedule-f19d',
  occurrenceDate: '2026-06-05',
}

const boardHtml = renderScheduleModule(
  sessions,
  null,
  null,
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-01',
)
assert(boardHtml.includes('schedule-module'), 'Module 7 should render')
assert(boardHtml.includes('data-schedule-action="open-edit"'))

const gatewayHtml = renderScheduleModule(
  sessions,
  null,
  { ...reportState, mode: 'roleGateway' },
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-01',
)
assert(gatewayHtml.includes('Bạn là?'))
assert(gatewayHtml.includes('Admin cơ sở'))
assert(gatewayHtml.includes('Giáo viên'))
assert(gatewayHtml.includes('Chọn chế độ xử lý cho buổi học này.'))
assert(gatewayHtml.includes('data-schedule-report-role="admin"'))
assert(gatewayHtml.includes('data-schedule-report-role="teacher"'))
assert(!gatewayHtml.includes('data-schedule-action="save-attendance"'), 'Gateway must not expose save attendance')

const teacherHtml = renderScheduleModule(
  sessions,
  null,
  { ...reportState, mode: 'teacherReport' },
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-01',
)
assert(teacherHtml.includes('Báo cáo ca dạy'))
assert(teacherHtml.includes('Điểm danh'))
assert(teacherHtml.includes('session-report-learning'))
assert(teacherHtml.includes('session-report-extra-fields'))
assert(teacherHtml.includes('session-report-trello'))
assert(teacherHtml.includes('data-session-report-trello-output'))
assert(teacherHtml.includes('data-schedule-action="save-attendance"'))

const adminHtml = renderScheduleModule(
  sessions,
  null,
  { ...reportState, mode: 'adminPlaceholder' },
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-01',
)
assert(adminHtml.includes('Điểm danh Admin cơ sở'))
assert(adminHtml.includes('data-admin-attendance-action="mark-all-present"'))
assert(adminHtml.includes('data-admin-attendance-action="clear"'))
assert(adminHtml.includes('data-admin-attendance-action="save"'))
assert(adminHtml.includes('data-schedule-report-role="gateway"'))
assert(adminHtml.includes('Học viên F19D Một'))
assert(adminHtml.includes('Học viên F19D Hai'))
assert(!adminHtml.includes('session-report-trello'), 'Admin mode must not render teacher Trello report')
assert(!adminHtml.includes('data-schedule-action="save-attendance"'), 'Admin mode must not save sessionReports attendance')

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
assert(mainSource.includes("mode: 'roleGateway'"))
assert(mainSource.includes("mode: 'teacherReport'"))
assert(mainSource.includes("mode: 'adminPlaceholder'"))
assert(mainSource.includes('data-schedule-report-role'))
assert(scheduleSource.includes('renderScheduleReportRoleGateway'))
assert(scheduleSource.includes('renderScheduleAdminAttendanceForm'))
assert(!mainSource.includes('localStorage.setItem(\'scheduleRole'))
assert(!mainSource.includes('scheduleReportRoleStorage'))

console.log('F19D TKB cổng vai trò Admin cơ sở / Giáo viên smoke passed')
