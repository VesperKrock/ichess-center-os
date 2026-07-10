import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  getVisibleScheduleSessions,
  isZombieLopThayThinhScheduleRecord,
  purgeZombieLopThayThinhScheduleSessions,
} from '../src/schedule-module.js'
import { getTeacherScheduleSessions } from '../src/teacher-module.js'
import { getStoredSchedule, saveStoredSchedule } from '../src/storage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const mainSource = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8')
const scheduleSource = fs.readFileSync(path.join(root, 'src', 'schedule-module.js'), 'utf8')

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
  id: 'teacher-thinh-zombie',
  fullName: 'Nguyen Truong Thinh',
  displayName: 'Thầy Thịnh',
  status: 'active',
}

const studentIds = ['student-a', 'student-b', 'student-c', 'student-d']

const validClassSession = {
  id: 'class-session-t3-t5-1700-1830',
  name: 'T3-T5 17:00-18:30',
  displayLabel: 'T3-T5 17:00-18:30',
  daysOfWeek: ['tuesday', 'thursday'],
  startTime: '17:00',
  endTime: '18:30',
  room: '01',
  level: 'beginner',
  status: 'active',
}

const zombie = {
  id: 'schedule-zombie-lop-thay-thinh',
  scheduleType: 'recurring',
  title: 'Lớp thầy Thịnh',
  groupName: '',
  dayOfWeek: 'tuesday',
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  startTime: '16:30',
  endTime: '18:00',
  room: '01',
  teacherId: teacher.id,
  teacherName: 'Thầy Thịnh',
  studentIds,
  classSessionId: '',
  level: 'beginner',
  status: 'scheduled',
  note: 'Legacy zombie schedule from old fixed schedule flow.',
}

const zombieMissingClassSession = {
  ...zombie,
  id: 'schedule-zombie-missing-class-session',
  title: 'lop thay thinh',
  classSessionId: 'class-session-deleted-lop-thay-thinh',
}

const validAssignment = {
  ...zombie,
  id: 'schedule-valid-assignment-thinh',
  title: '',
  teacherName: '',
  classSessionId: validClassSession.id,
  startTime: validClassSession.startTime,
  endTime: validClassSession.endTime,
}

const oneOffSameText = {
  ...zombie,
  id: 'schedule-one-off-lop-thay-thinh',
  scheduleType: 'oneOff',
  date: '2026-07-07',
  occurrenceReason: 'makeup',
}

const nonTargetOrphan = {
  ...zombie,
  id: 'schedule-other-orphan',
  title: 'Lớp cũ khác',
  teacherName: 'Thầy khác',
}

const classSessions = [validClassSession]
const allRecords = [zombie, zombieMissingClassSession, validAssignment, oneOffSameText, nonTargetOrphan]

assert.equal(isZombieLopThayThinhScheduleRecord(zombie, classSessions), true)
assert.equal(isZombieLopThayThinhScheduleRecord(zombieMissingClassSession, classSessions), true)
assert.equal(isZombieLopThayThinhScheduleRecord(validAssignment, classSessions), false, 'Valid classSession assignment must not be purged.')
assert.equal(isZombieLopThayThinhScheduleRecord(oneOffSameText, classSessions), false, 'One-off/makeup with same text must not be purged.')
assert.equal(isZombieLopThayThinhScheduleRecord(nonTargetOrphan, classSessions), false, 'Unrelated orphan must not be purged by targeted cleanup.')

const purgeResult = purgeZombieLopThayThinhScheduleSessions(allRecords, classSessions)
assert.equal(purgeResult.removedCount, 2)
assert(!purgeResult.scheduleSessions.some((session) => session.id === zombie.id))
assert(!purgeResult.scheduleSessions.some((session) => session.id === zombieMissingClassSession.id))
assert(purgeResult.scheduleSessions.some((session) => session.id === validAssignment.id))
assert(purgeResult.scheduleSessions.some((session) => session.id === oneOffSameText.id))
assert(purgeResult.scheduleSessions.some((session) => session.id === nonTargetOrphan.id))

saveStoredSchedule(allRecords)
const loaded = getStoredSchedule([])
const persistedPurge = purgeZombieLopThayThinhScheduleSessions(loaded, classSessions)
saveStoredSchedule(persistedPurge.scheduleSessions)
const reloaded = getStoredSchedule([])

assert(!reloaded.some((session) => session.id === zombie.id), 'Persisted schedule payload must remove zombie.')
assert(!reloaded.some((session) => session.id === zombieMissingClassSession.id), 'Persisted schedule payload must remove missing-classSession zombie.')
assert(!getVisibleScheduleSessions(reloaded, '2026-07-06', classSessions).some((session) => session.id === zombie.id), 'Visible TKB must not render zombie after reload.')
assert(getVisibleScheduleSessions(reloaded, '2026-07-06', classSessions).some((session) => session.classSessionId === validClassSession.id), 'Valid Settings fixed slot must still render.')
assert.equal(getTeacherScheduleSessions(teacher, reloaded).some((session) => session.id === zombie.id), false, 'Teacher Portal must not see purged zombie.')

const clearedValidAssignment = reloaded.filter((session) => session.id !== validAssignment.id)
assert(getVisibleScheduleSessions(clearedValidAssignment, '2026-07-06', classSessions).some((session) => session.isEmptyClassSessionSlot), 'Clearing valid assignment must keep empty Settings slot.')

assert(scheduleSource.includes('purgeZombieLopThayThinhScheduleSessions'), 'Schedule module must expose targeted purge helper.')
assert(scheduleSource.includes('isZombieLopThayThinhScheduleRecord'), 'Schedule module must expose targeted zombie detector.')
assert(mainSource.includes("reason: 'initial-load'"), 'Runtime must purge on initial local load.')
assert(mainSource.includes("reason: 'center-reload'"), 'Runtime must purge on center reload.')
assert(mainSource.includes("reason: 'cloud-bootstrap'"), 'Runtime must purge cloud/bootstrap schedule source.')
assert(mainSource.includes("reason: 'schedule-realtime'"), 'Runtime must purge realtime schedule source.')
assert(!mainSource.includes('localStorage.clear('), 'Purge must not reset all localStorage.')
assert(!scheduleSource.includes('tuition.usedSessions') && !mainSource.includes('tuition.usedSessions'), 'Purge must not update tuition.usedSessions.')
assert(!scheduleSource.includes('attendance-to-tuition') && !mainSource.includes('attendance-to-tuition'), 'Purge must not add attendance-to-tuition automation.')

console.log('FB C8.4 TKB purge zombie Lop thay Thinh smoke: PASS')
