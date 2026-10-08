import assert from 'node:assert/strict'
import { renderScheduleModule, getNextScheduleWeekStartDate, getPreviousScheduleWeekStartDate } from '../src/schedule-module.js'
import {
  createSchedulePrintSnapshot, getSchedulePrintFilteredSnapshot, renderSchedulePrintDocument,
  getSchedulePrintDocumentTitle, SCHEDULE_PRINT_FILTER_CURRENT, SCHEDULE_PRINT_FILTER_ALL,
} from '../src/schedule-print-module.js'

const week = '2026-10-05'
const sessions = [
  { id: 'recurring', classSessionId: 'turtle', scheduleType: 'recurring', dayOfWeek: 'tuesday',
    title: 'Ca Turtle', startDate: '2026-09-01', startTime: '17:30', endTime: '18:30', status: 'scheduled' },
  { id: 'one-off', scheduleType: 'oneOff', date: '2026-10-07', title: 'Buổi học thử',
    startTime: '18:00', endTime: '18:45', teacherName: 'GV Lan', status: 'scheduled' },
]
const classSessions = [{ id: 'turtle', name: 'Ca Turtle', daysOfWeek: ['tuesday'], startTime: '17:30', endTime: '18:30', status: 'active' }]
const centerCalendarItems = [
  { id: 'meeting', itemType: 'meeting', title: 'Họp giáo viên', tagId: 'staff', startAt: '2026-10-07T16:00:00+07:00', endAt: '2026-10-07T17:00:00+07:00' },
  { id: 'event', itemType: 'event', title: 'Giao lưu cờ', startAt: '2026-10-08T15:00:00+07:00', endAt: '2026-10-08T16:00:00+07:00' },
  { id: 'next-week', itemType: 'event', title: 'Sự kiện tuần sau', startAt: '2026-10-12T15:00:00+07:00', endAt: '2026-10-12T16:00:00+07:00' },
]
const centerCalendarTags = [{ id: 'staff', label: 'Nội bộ', color: '#2563eb' }]
const crmContacts = [{ id: 'contact', canonicalCaseId: 'canonical-case', leadStudentName: 'Học viên thử',
  appointments: [{ id: 'appointment', canonicalAppointmentId: 'canonical-appointment', appointmentType: 'trialLesson',
    scheduledAt: '2026-10-09T11:00:00Z', status: 'scheduled' }] }]
const original = JSON.stringify({ sessions, classSessions, centerCalendarItems, centerCalendarTags, crmContacts })
const options = { centerId: 'qa', centerName: 'Cơ sở QA', weekStartDate: week, sessions, classSessions,
  centerCalendarItems, centerCalendarTags, crmContacts, createdAt: '2026-10-08T04:00:00Z' }
const render = (viewMode, overrides = {}) => renderScheduleModule(sessions, null, null, [], null, null, null, null,
  false, null, [], [], overrides.weekStartDate || week, null, { ...options, viewMode, ...overrides })
const count = (html, token) => html.split(token).length - 1
const activities = render()
const classes = render('classes')
assert(activities.includes('data-schedule-view-mode="activities"'))
for (const html of [activities, classes]) {
  assert(html.includes('>1. Hoạt động</button>'))
  assert(html.includes('>2. Ca học</button>'))
  assert.equal(count(html, 'data-schedule-day-date='), 7)
  assert(html.includes('05/10/2026 - 11/10/2026'))
  assert(!html.includes('<h3>Lịch làm việc tuần</h3>'))
  assert(!html.includes('Ca học và hoạt động của trung tâm'))
  assert.equal(count(html, 'schedule-toolbar'), 1)
}
assert(activities.includes('Họp giáo viên') && activities.includes('Giao lưu cờ'))
assert(activities.includes('data-schedule-crm-appointment="appointment"'))
assert(!activities.includes('data-schedule-action="open-edit"'))
assert(!activities.includes('Buổi học thử') && !activities.includes('Ca Turtle'))
assert(activities.includes('data-center-calendar-action="open-create"'))
assert(!activities.includes('data-schedule-action="open-create"'))
assert(!activities.includes('data-schedule-action="open-create-for-day"'))
assert(activities.includes('Lọc hoạt động'))
assert(classes.includes('Ca Turtle') && classes.includes('Buổi học thử'))
assert(!classes.includes('Họp giáo viên') && !classes.includes('Giao lưu cờ'))
assert(!classes.includes('data-schedule-crm-appointment='))
assert(classes.includes('data-schedule-action="open-create"'))
assert.equal(count(classes, 'data-schedule-action="open-create-for-day"'), 7)
assert(!classes.includes('data-center-calendar-action="open-create"'))
assert(!classes.includes('Lọc hoạt động') && !classes.includes('data-center-calendar-filter'))

const filtered = render('activities', { centerCalendarFilters: { itemType: 'meeting', tagId: 'staff' } })
assert(filtered.includes('Họp giáo viên') && !filtered.includes('Giao lưu cờ'))
assert(!filtered.includes('data-schedule-crm-appointment='))
assert(render('classes', { centerCalendarFilters: { itemType: 'meeting', tagId: 'staff' } }).includes('Buổi học thử'))
const noMatches = render('activities', { centerCalendarFilters: { itemType: 'tournament', tagId: 'all' } })
assert(noMatches.includes('Không có hoạt động phù hợp bộ lọc'))
assert(!noMatches.includes('data-schedule-action="open-edit"'))
const loading = render('activities', { calendarNotesAvailable: false,
  calendarNotesSharedTruthState: { availabilityStatus: 'loading', isLoading: true } })
assert(loading.includes('Đang tải hoạt động'))
assert(!loading.includes('>0 hoạt động<'))
assert(loading.includes('data-schedule-print-action="print" disabled'))
assert(!loading.includes('data-schedule-action="open-edit"'))
const readOnly = { canEditSchedule: false, canEditCalendar: false }
assert(!render('activities', readOnly).includes('data-center-calendar-action="open-create"'))
assert(!render('classes', readOnly).includes('data-schedule-action="open-create"'))
const next = getNextScheduleWeekStartDate(week)
assert.equal(getPreviousScheduleWeekStartDate(next), week)
assert(render('activities', { weekStartDate: next }).includes('Sự kiện tuần sau'))
assert(!render('classes', { weekStartDate: next }).includes('Buổi học thử'))
assert(render('classes', { weekStartDate: next }).includes('12/10/2026 - 18/10/2026'))

for (const viewMode of ['activities', 'classes']) {
  const snapshot = createSchedulePrintSnapshot({ ...options, viewMode, activityFilters: { itemType: 'meeting', tagId: 'staff' } })
  assert(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.entries))
  assert.equal(snapshot.centerId, 'qa')
  assert.equal(snapshot.weekStartDate, week)
  for (const filterMode of [SCHEDULE_PRINT_FILTER_CURRENT, SCHEDULE_PRINT_FILTER_ALL]) {
    const print = getSchedulePrintFilteredSnapshot(snapshot, filterMode)
    const document = renderSchedulePrintDocument(print)
    assert(print.entries.every(entry => (entry.sourceKind === 'activity') === (viewMode === 'activities')))
    assert.equal(print.days.flatMap(day => day.entries).length, print.entries.length)
    assert(document.includes('Cơ sở QA') && document.includes('05/10/2026 - 11/10/2026'))
    if (viewMode === 'activities') {
      assert(document.includes('LỊCH HOẠT ĐỘNG TUẦN'))
      assert(!document.includes('Ca Turtle') && !document.includes('Buổi học thử'))
      assert.equal(print.entries.length, filterMode === SCHEDULE_PRINT_FILTER_CURRENT ? 1 : 3)
      if (filterMode === SCHEDULE_PRINT_FILTER_CURRENT) assert(document.includes('Hội họp · Nội bộ'))
    } else {
      assert(document.includes('THỜI KHÓA BIỂU CA HỌC'))
      assert(!document.includes('Giao lưu cờ') && !document.includes('Họp giáo viên'))
      assert(!document.includes('Nội bộ') && !document.includes('Loại nội dung'))
      assert.equal(print.entries.length, 2)
    }
  }
  assert(getSchedulePrintDocumentTitle(snapshot).startsWith(viewMode === 'activities' ? 'Lich-hoat-dong-' : 'TKB-ca-hoc-'))
}
const legacy = createSchedulePrintSnapshot(options)
assert(legacy.entries.some(entry => entry.sourceKind === 'activity') && legacy.entries.some(entry => entry.sourceKind !== 'activity'))
assert.equal(JSON.stringify({ sessions, classSessions, centerCalendarItems, centerCalendarTags, crmContacts }), original,
  'View and print projections must leave authoritative inputs unchanged.')
console.log('F2_WEEKLY_CALENDAR_SPLIT_SMOKE: PASS')
