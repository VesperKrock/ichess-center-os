import assert from 'node:assert/strict'

import {
  ANGEL_WINGS_IMPORT_BATCH_ID,
  ANGEL_WINGS_SOURCE_TAG,
  ANGEL_WINGS_TEACHER_ID,
  createF15K5BackupSnapshot,
  getF15K5StorageKeys,
  mergeAngelWingsTeacherRoster,
  upsertAngelWingsAttendanceData,
} from '../src/attendance-board-angel-wings-data.js'
import { renderSettingsModule } from '../src/settings-module.js'

const dataset = upsertAngelWingsAttendanceData()
const restoredTeachers = mergeAngelWingsTeacherRoster(dataset.teachers, dataset.students)

assert.equal(dataset.students.length, 29)
assert.equal(dataset.classSessions.length, 4)
assert(dataset.students.every((student) => student.sourceTag === ANGEL_WINGS_SOURCE_TAG))
assert(dataset.classSessions.every((classSession) => classSession.importBatchId === ANGEL_WINGS_IMPORT_BATCH_ID))
assert(restoredTeachers.some((teacher) => teacher.id === ANGEL_WINGS_TEACHER_ID))
assert(restoredTeachers.some((teacher) => teacher.isFallbackTeacherRoster))

const storage = new Map([
  ['ichessCenterOS.students.dreamhome', '[{"id":"old-student"}]'],
  ['ichessCenterOS.teachers.dreamhome', '[{"id":"old-teacher"}]'],
  ['ichessCenterOS.classSessions.dreamhome', '[{"id":"old-class"}]'],
  ['ichessCenterOS.tuition.dreamhome', '[{"id":"old-tuition"}]'],
  ['ichessCenterOS.schedule.dreamhome', '[{"id":"old-schedule"}]'],
  ['ichessCenterOS.sessionReports.dreamhome', '[{"id":"old-report"}]'],
])
const localStorageMock = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null
  },
  setItem(key, value) {
    storage.set(key, value)
  },
}
const backup = createF15K5BackupSnapshot(localStorageMock)
const backupPayload = JSON.parse(storage.get(backup.backupKey))

assert.deepEqual(backup.keys, getF15K5StorageKeys())
assert.equal(backupPayload.values['ichessCenterOS.students.dreamhome'], '[{"id":"old-student"}]')
assert.equal(backupPayload.values['ichessCenterOS.tuition.dreamhome'], '[{"id":"old-tuition"}]')
assert(!storage.has('ichessCenterOS.cashflow.dreamhome'))

const oldSeedPanelHtml = renderSettingsModule([], [], {}, null, {
  configStatus: 'configured',
  authStatus: 'signed-in',
  membershipStatus: 'loaded',
  role: 'owner',
  readinessStatus: 'ready',
  localCounts: { student: 8, teacher: 7, class_session: 6 },
  localAngelWingsStatus: {
    isReadyForCloudPush: false,
    looksLikeOldSeed: true,
    studentCount: 0,
    classSessionCount: 0,
    hasTeacher: false,
  },
})
assert(oldSeedPanelHtml.includes('data-cloud-db-action="restore-angel-wings-local"'))
assert(oldSeedPanelHtml.includes('Khôi phục dữ liệu Angel Wings 06/2026 vào local'))
assert(oldSeedPanelHtml.includes('data-cloud-db-action="push" disabled'))
assert(oldSeedPanelHtml.includes('seed cũ 8 học viên'))

const readyPanelHtml = renderSettingsModule([], [], {}, null, {
  configStatus: 'configured',
  authStatus: 'signed-in',
  membershipStatus: 'loaded',
  role: 'owner',
  readinessStatus: 'ready',
  localCounts: { student: 29, teacher: restoredTeachers.length, class_session: 4 },
  localAngelWingsStatus: {
    isReadyForCloudPush: true,
    looksLikeOldSeed: false,
    studentCount: 29,
    classSessionCount: 4,
    hasTeacher: true,
  },
})
assert(!readyPanelHtml.includes('data-cloud-db-action="push" disabled'))
assert(readyPanelHtml.includes('29 học viên / 4 ca'))
assert(!readyPanelHtml.includes('[object Object]'))

console.log('C2.3 Angel Wings restore smoke passed')
