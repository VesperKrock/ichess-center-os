import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildStaffAttendanceData,
  clearStaffListFilters,
  getFilteredStaffMembers,
  initialStaffFilters,
  renderStaffModule,
  repairStaffAttendanceDisplayText,
} from '../src/staff-module.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const main = read('src/main.js')
const staffSource = read('src/staff-module.js')
const storageSource = read('src/storage.js')
const docs = read('docs/f23-11b-1-hotfix-default-filter-nhan-vien-va-mojibake-cham-cong.md')
const baselineDocs = read('docs/f23-11b-ho-so-hanh-chinh-co-ban-local-safe.md')

const terminatedStaff = {
  id: 'staff-gv001',
  centerId: 'center-a',
  employeeCode: 'GV001',
  fullName: 'Nguyễn Trường Thịnh',
  employmentStatus: 'terminated',
  departmentId: 'department-academic',
  teacherId: 'teacher-thinh',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-27T00:00:00.000Z',
}
const terminatedStaffSnapshot = structuredClone(terminatedStaff)

assert.equal(initialStaffFilters.employmentStatus, 'all')
assert.deepEqual(
  getFilteredStaffMembers([terminatedStaff], [], initialStaffFilters).map((item) => item.id),
  [terminatedStaff.id],
  'Fresh staff open must include terminated records.',
)
assert.deepEqual(terminatedStaff, terminatedStaffSnapshot)

const dirtyFilters = {
  query: 'GV001',
  departmentId: 'department-academic',
  employmentStatus: 'active',
  teacherLink: 'linked',
  accountLink: 'unlinked',
  weekStartDate: '2026-07-27',
  location: 'Phòng A',
  person: 'teacher:teacher-thinh',
}
const dirtyFiltersSnapshot = structuredClone(dirtyFilters)
const clearedFilters = clearStaffListFilters(dirtyFilters)
assert.deepEqual(dirtyFilters, dirtyFiltersSnapshot, 'Clearing filters must be immutable.')
assert.deepEqual(
  {
    query: clearedFilters.query,
    departmentId: clearedFilters.departmentId,
    employmentStatus: clearedFilters.employmentStatus,
    teacherLink: clearedFilters.teacherLink,
    accountLink: clearedFilters.accountLink,
  },
  {
    query: '',
    departmentId: 'all',
    employmentStatus: 'all',
    teacherLink: 'all',
    accountLink: 'all',
  },
)
assert.equal(clearedFilters.weekStartDate, dirtyFilters.weekStartDate)
assert.equal(clearedFilters.location, dirtyFilters.location)
assert.equal(clearedFilters.person, dirtyFilters.person)
assert.equal(getFilteredStaffMembers([terminatedStaff], [], clearedFilters)[0].id, terminatedStaff.id)

const freshHtml = renderStaffModule({ staffMembers: [terminatedStaff] })
assert(freshHtml.includes('GV001'))
assert(freshHtml.includes('Nguyễn Trường Thịnh'))
assert(!freshHtml.includes('Chưa có hồ sơ nhân viên.'))
assert(freshHtml.includes('<span>Tổng nhân viên</span>\n      <strong>1</strong>'))
assert(freshHtml.includes('<span>Đã nghỉ việc</span>\n      <strong>1</strong>'))
assert(freshHtml.includes('<details class="staff-attendance-details">'))
assert(freshHtml.includes('Chấm công theo lịch dạy hiện có'))

const noMatchHtml = renderStaffModule({
  staffMembers: [terminatedStaff],
  filters: { ...initialStaffFilters, query: 'không-trùng' },
})
assert(noMatchHtml.includes('Không có hồ sơ phù hợp với bộ lọc hiện tại.'))
assert(noMatchHtml.includes('data-staff-action="clear-filters"'))
assert(noMatchHtml.includes('Xóa bộ lọc'))
assert(!noMatchHtml.includes('Chưa có hồ sơ nhân viên.'))

const noDataHtml = renderStaffModule({ staffMembers: [] })
assert(noDataHtml.includes('Chưa có hồ sơ nhân viên.'))
assert(noDataHtml.includes('data-staff-action="open-create"'))
assert(!noDataHtml.includes('data-staff-action="clear-filters"'))

const deepOpenSource = getFunctionSource(
  main,
  'function openLinkedStaffFromTeacher',
  'function openLinkedTeacherFromStaff',
)
assert(deepOpenSource.includes('getUniqueCurrentCenterStaffMember(staffId)'))
assert(deepOpenSource.includes('staffFilters = clearStaffListFilters(staffFilters)'))
assert(deepOpenSource.includes("openModuleWindowFromChildInteraction('nhan-vien')"))
assert(!deepOpenSource.includes('employeeCode'))
assert(!deepOpenSource.includes('fullName'))
assert(!deepOpenSource.includes('phone'))
assert(!deepOpenSource.includes('email'))

const openModuleSource = getFunctionSource(
  main,
  'function openModuleWindow(moduleId)',
  'function openModuleWindowFromChildInteraction',
)
assert(openModuleSource.includes("if (moduleId === 'nhan-vien')"))
assert(openModuleSource.includes('staffFilters = clearStaffListFilters(staffFilters)'))
assert(openModuleSource.includes('const existingWindow = openWindows.find'))
assert(openModuleSource.includes('focusWindow(existingWindow.id)'))

const filterBindingSource = getFunctionSource(main, 'function bindStaffFilterControls', 'function bindStaffActionButtons')
assert(filterBindingSource.includes("refreshStaffModuleRegion('profile-list')"))
assert(filterBindingSource.includes("refreshStaffModuleRegion('attendance')"))
assert(!filterBindingSource.includes('render()'))
assert(!filterBindingSource.includes('.focus('))
assert(!filterBindingSource.includes('.click('))
assert(!filterBindingSource.includes('setTimeout'))

const partialRenderSource = getFunctionSource(
  main,
  'function refreshStaffModuleRegion',
  'function syncStaffListFilterControls',
)
assert(partialRenderSource.includes("region === 'profile-list'"))
assert(partialRenderSource.includes("region === 'attendance'"))
assert(partialRenderSource.includes('currentList.replaceWith(nextList)'))
assert(partialRenderSource.includes('currentSummary.replaceWith(nextSummary)'))
assert(partialRenderSource.includes('currentLayout.replaceWith(nextLayout)'))
assert(!partialRenderSource.includes('currentDetails.replaceWith'))
assert(!partialRenderSource.includes('render()'))

const cleanAttendance = {
  title: 'Buổi học mẫu',
  room: 'Phòng Đa năng',
  teacher: 'Nguyễn Trường Thịnh',
  note: 'Lớp học đúng giờ',
}
const brokenAttendance = Object.fromEntries(
  Object.entries(cleanAttendance).map(([key, value]) => [key, utf8AsSingleByteText(value)]),
)
const scheduleSession = {
  id: 'session-f23-11b-1',
  centerId: 'center-a',
  scheduleType: 'oneOff',
  date: '2026-07-27',
  teacherId: 'teacher-thinh',
  teacherName: brokenAttendance.teacher,
  title: brokenAttendance.title,
  room: brokenAttendance.room,
  note: 'attendance-business-value',
  startTime: '17:30',
  endTime: '19:00',
  status: 'scheduled',
}
const sessionReport = {
  id: 'report-f23-11b-1',
  sessionId: scheduleSession.id,
  occurrenceDate: scheduleSession.date,
  classSituation: brokenAttendance.note,
}
const attendanceInputSnapshot = structuredClone({ scheduleSession, sessionReport })
const attendanceData = buildStaffAttendanceData({
  scheduleSessions: [scheduleSession],
  sessionReports: [sessionReport],
  filters: { ...initialStaffFilters, weekStartDate: '2026-07-27' },
})
assert.equal(attendanceData.attendanceRows.length, 1)
assert.equal(attendanceData.attendanceRows[0].className, cleanAttendance.title)
assert.equal(attendanceData.attendanceRows[0].location, cleanAttendance.room)
assert.equal(attendanceData.attendanceRows[0].personName, cleanAttendance.teacher)
assert.equal(attendanceData.attendanceRows[0].note, cleanAttendance.note)
assert.equal(attendanceData.attendanceRows[0].sessionId, scheduleSession.id)
assert.equal(attendanceData.attendanceRows[0].date, scheduleSession.date)
assert.equal(attendanceData.attendanceRows[0].scheduleStatus, scheduleSession.status)
assert.deepEqual(
  { scheduleSession, sessionReport },
  attendanceInputSnapshot,
  'Display repair must not rewrite schedule/report business data.',
)

for (const cleanValue of Object.values(cleanAttendance)) {
  assert.equal(repairStaffAttendanceDisplayText(cleanValue), cleanValue)
}
assert.equal(repairStaffAttendanceDisplayText('MÃ'), 'MÃ', 'Ambiguous clean text must stay unchanged.')
assert.equal(repairStaffAttendanceDisplayText(brokenAttendance.title), cleanAttendance.title)
assert.equal(repairStaffAttendanceDisplayText(brokenAttendance.note), cleanAttendance.note)

assert(storageSource.includes("title: String(session.title || 'Buổi học mẫu')"))
assert(staffSource.includes('repairStaffAttendanceDisplayText(session.title || session.groupName'))
assert(staffSource.includes('repairStaffAttendanceDisplayText(session.room'))
assert(staffSource.includes('repairStaffAttendanceDisplayText(session.note'))
assert(staffSource.includes('repairStaffAttendanceDisplayText(\n          report?.classSituation'))
assert(!staffSource.includes('localStorage.setItem'))
assert(!deepOpenSource.includes('saveStoredCenterStaffMembers'))

for (const marker of [
  'F23.11B.1',
  'Tất cả trạng thái',
  'stable staffMemberId',
  'no-data',
  'no-match',
  'display boundary',
  'không migration',
  'Manual QA',
]) {
  assert(docs.includes(marker), `Missing hotfix docs marker: ${marker}`)
}
assert(baselineDocs.includes('F23.11B.1'))

const forbiddenPublicSecret = ['VITE_', 'SUPABASE_', 'SERVICE_ROLE'].join('|')
assert(!new RegExp(forbiddenPublicSecret).test(docs))
assert(!new RegExp(forbiddenPublicSecret).test(staffSource.slice(staffSource.indexOf('export function repairStaffAttendanceDisplayText'))))

console.log('F23.11B.1 staff filter and attendance UTF-8 hotfix smoke: PASS')

function utf8AsSingleByteText(value) {
  return Buffer.from(value, 'utf8').toString('latin1')
}

function getFunctionSource(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0, `Missing source marker: ${startMarker}`)
  assert(end > start, `Missing source marker: ${endMarker}`)
  return source.slice(start, end)
}
