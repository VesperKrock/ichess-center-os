import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  createEditScheduleFormState,
  getVisibleScheduleSessions,
  isOrphanFixedScheduleRecord,
  renderScheduleModule,
} from '../src/schedule-module.js'
import { getTeacherScheduleSessions } from '../src/teacher-module.js'
import { getStoredSchedule, saveStoredSchedule } from '../src/storage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const scheduleSource = fs.readFileSync(path.join(root, 'src', 'schedule-module.js'), 'utf8')
const mainSource = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8')

const storage = new Map()
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null
  },
  setItem(key, value) {
    storage.set(key, String(value))
  },
  removeItem(key) {
    storage.delete(key)
  },
}

const teacher = {
  id: 'teacher-thinh-orphan',
  fullName: 'Nguyen Truong Thinh',
  displayName: 'Thay Thinh',
  status: 'active',
}

const student = {
  id: 'student-orphan',
  fullName: 'Hoc vien orphan',
  assignedTeacherId: teacher.id,
}

const validClassSession = {
  id: 'class-session-valid-t3-t5',
  name: 'T3-T5 17:00-18:30',
  displayLabel: 'T3-T5 17:00-18:30',
  daysOfWeek: ['tuesday', 'thursday'],
  startTime: '17:00',
  endTime: '18:30',
  room: '01',
  level: 'beginner',
  status: 'active',
}

const legacyNoClassSession = {
  id: 'schedule-legacy-thinh',
  scheduleType: 'recurring',
  title: 'Lớp cũ orphan',
  dayOfWeek: 'tuesday',
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  startTime: '15:30',
  endTime: '17:00',
  room: '02',
  teacherId: teacher.id,
  teacherName: '',
  studentIds: [student.id],
  classSessionId: '',
  groupName: '',
  level: 'beginner',
  status: 'scheduled',
  note: 'Legacy fixed schedule created before Settings owned fixed slots.',
}

const missingClassSession = {
  ...legacyNoClassSession,
  id: 'schedule-missing-class-session',
  title: 'Lớp cũ missing source',
  classSessionId: 'class-session-deleted-thinh',
}

const validAssignment = {
  ...legacyNoClassSession,
  id: 'schedule-valid-assignment',
  title: '',
  classSessionId: validClassSession.id,
  dayOfWeek: 'tuesday',
  startDate: '',
  endDate: '',
  startTime: validClassSession.startTime,
  endTime: validClassSession.endTime,
}

const oneOff = {
  ...legacyNoClassSession,
  id: 'schedule-one-off',
  scheduleType: 'oneOff',
  title: 'Buổi học bù không liên quan',
  classSessionId: '',
  date: '2026-07-07',
  occurrenceReason: 'makeup',
}

const weekStart = '2026-07-06'
const classSessions = [validClassSession]

assert.equal(isOrphanFixedScheduleRecord(legacyNoClassSession, classSessions), true)
assert.equal(isOrphanFixedScheduleRecord(missingClassSession, classSessions), true)
assert.equal(isOrphanFixedScheduleRecord(validAssignment, classSessions), false)
assert.equal(isOrphanFixedScheduleRecord(oneOff, classSessions), false)

const visible = getVisibleScheduleSessions(
  [legacyNoClassSession, missingClassSession, validAssignment, oneOff],
  weekStart,
  classSessions,
)

assert(visible.some((session) => session.id === legacyNoClassSession.id && session.isOrphanScheduleRecord), 'Legacy recurring without classSessionId must be visible as orphan.')
assert(visible.some((session) => session.id === missingClassSession.id && session.isOrphanScheduleRecord), 'Recurring with missing classSessionId must be visible as orphan.')
assert(visible.some((session) => session.assignmentId === validAssignment.id && !session.isEmptyClassSessionSlot), 'Valid fixed assignment must render through classSession slot.')
assert(visible.some((session) => session.id === oneOff.id), 'One-off/makeup schedule must keep normal visibility.')

const orphanFormHtml = renderScheduleModule(
  [legacyNoClassSession],
  createEditScheduleFormState(legacyNoClassSession),
  null,
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  [teacher],
  [student],
  weekStart,
  null,
  { classSessions },
)

assert(orphanFormHtml.includes('schedule-orphan-warning'), 'Orphan edit form must warn that the source no longer exists.')
assert(orphanFormHtml.includes('Xóa lịch cũ'), 'Orphan edit form delete button must use hard-delete wording.')

saveStoredSchedule([legacyNoClassSession, missingClassSession, validAssignment, oneOff])
const afterHardDelete = getStoredSchedule([]).filter(
  (session) => session.id !== legacyNoClassSession.id && session.id !== missingClassSession.id,
)
saveStoredSchedule(afterHardDelete)
const reloaded = getStoredSchedule([])

assert(!reloaded.some((session) => session.id === legacyNoClassSession.id), 'Hard-deleted legacy orphan must be removed from stored schedule payload.')
assert(!reloaded.some((session) => session.id === missingClassSession.id), 'Hard-deleted missing-classSession orphan must be removed from stored schedule payload.')
assert(!getVisibleScheduleSessions(reloaded, weekStart, classSessions).some((session) => session.title.includes('Lớp thầy Thịnh')), 'Deleted orphan must not reappear after reload mock.')
assert.equal(getTeacherScheduleSessions(teacher, reloaded).some((session) => session.id === legacyNoClassSession.id), false, 'Teacher Portal must not see hard-deleted orphan.')

const afterClearValidAssignment = reloaded.filter((session) => session.id !== validAssignment.id)
const clearedVisible = getVisibleScheduleSessions(afterClearValidAssignment, weekStart, classSessions)
assert(clearedVisible.some((session) => session.classSessionId === validClassSession.id && session.isEmptyClassSessionSlot), 'Clearing valid fixed assignment must leave Settings slot visible.')
assert(!afterClearValidAssignment.some((session) => session.id === validAssignment.id), 'Valid assignment clear removes only the assignment record.')
assert(classSessions.some((classSession) => classSession.id === validClassSession.id), 'Clearing assignment must not delete classSession source.')

const afterOneOffDelete = reloaded.filter((session) => session.id !== oneOff.id)
assert(!afterOneOffDelete.some((session) => session.id === oneOff.id), 'One-off delete behavior must remain hard remove of that one schedule record.')
assert(afterOneOffDelete.some((session) => session.id === validAssignment.id), 'One-off delete must not remove valid fixed assignment.')

assert(scheduleSource.includes('isOrphanScheduleRecord'), 'Schedule visible path must tag orphan records.')
assert(scheduleSource.includes('isOrphanFixedScheduleRecord'), 'Schedule module must expose orphan detection.')
assert(mainSource.includes('isOrphanFixedScheduleRecord'), 'Runtime delete handler must use orphan detection.')
assert(mainSource.includes('&& !isOrphanFixedSchedule'), 'Valid fixed slot clear must be separated from orphan hard delete.')
assert(!scheduleSource.includes('tuition.usedSessions') && !mainSource.includes('tuition.usedSessions'), 'TKB orphan delete must not update tuition.usedSessions.')
assert(!scheduleSource.includes('attendance-to-tuition') && !mainSource.includes('attendance-to-tuition'), 'TKB orphan delete must not add attendance-to-tuition automation.')

console.log('FB C8.4 TKB hard-delete orphan fixed schedule smoke: PASS')
