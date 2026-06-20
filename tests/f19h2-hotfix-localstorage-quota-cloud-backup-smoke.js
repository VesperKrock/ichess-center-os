import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  createCloudDbPullBackup,
  getCloudPullBackupKeys,
  pruneCloudPullBackups,
} from '../src/storage.js'

const BACKUP_PREFIX = 'ichessCenterOS.backup.beforeCloudPull.'
const STUDENTS_KEY = 'ichessCenterOS.students.dreamhome'
const TEACHERS_KEY = 'ichessCenterOS.teachers.dreamhome'
const CLASS_SESSIONS_KEY = 'ichessCenterOS.classSessions.dreamhome'
const TUITION_KEY = 'ichessCenterOS.tuition.dreamhome'

function createMemoryStorage(entries = [], { throwOnSetCount = 0 } = {}) {
  const map = new Map(entries)
  let setCount = 0

  return {
    get length() {
      return map.size
    },
    key(index) {
      return Array.from(map.keys())[index] || null
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      setCount += 1
      if (setCount <= throwOnSetCount) {
        const error = new Error('quota full')
        error.name = 'QuotaExceededError'
        error.code = 22
        throw error
      }
      map.set(key, String(value))
    },
    removeItem(key) {
      map.delete(key)
    },
    has(key) {
      return map.has(key)
    },
    dump() {
      return new Map(map)
    },
  }
}

const storage = createMemoryStorage([
  [`${BACKUP_PREFIX}2026-06-18T08-00-00`, 'oldest'],
  [`${BACKUP_PREFIX}2026-06-19T08-00-00`, 'older'],
  [`${BACKUP_PREFIX}2026-06-20T08-00-00`, 'newer'],
  [STUDENTS_KEY, '[{"id":"student-001"}]'],
  [TEACHERS_KEY, '[{"id":"teacher-001"}]'],
  [CLASS_SESSIONS_KEY, '[{"id":"class-001"}]'],
  [TUITION_KEY, '[{"id":"tuition-001"}]'],
])

const prunedKeys = pruneCloudPullBackups(storage, 2)
assert.deepEqual(prunedKeys, [`${BACKUP_PREFIX}2026-06-18T08-00-00`])
assert(storage.has(STUDENTS_KEY), 'Student data must not be pruned.')
assert(storage.has(TEACHERS_KEY), 'Teacher data must not be pruned.')
assert(storage.has(CLASS_SESSIONS_KEY), 'Class session data must not be pruned.')
assert(storage.has(TUITION_KEY), 'Tuition data must not be pruned.')
assert.deepEqual(getCloudPullBackupKeys(storage), [
  `${BACKUP_PREFIX}2026-06-19T08-00-00`,
  `${BACKUP_PREFIX}2026-06-20T08-00-00`,
])

const retryStorage = createMemoryStorage([
  [`${BACKUP_PREFIX}2026-06-18T08-00-00`, 'oldest'],
  [`${BACKUP_PREFIX}2026-06-19T08-00-00`, 'older'],
  [`${BACKUP_PREFIX}2026-06-20T08-00-00`, 'newer'],
  [STUDENTS_KEY, '[{"id":"student-001"}]'],
  [TEACHERS_KEY, '[{"id":"teacher-001"}]'],
  [CLASS_SESSIONS_KEY, '[{"id":"class-001"}]'],
], { throwOnSetCount: 1 })
const retryBackupKey = createCloudDbPullBackup(retryStorage)
assert.equal(typeof retryBackupKey, 'string')
assert(retryBackupKey.startsWith(BACKUP_PREFIX))
assert(retryStorage.has(STUDENTS_KEY), 'Retry must keep main student data.')
assert(retryStorage.has(TEACHERS_KEY), 'Retry must keep main teacher data.')
assert(retryStorage.has(CLASS_SESSIONS_KEY), 'Retry must keep main class session data.')
assert(getCloudPullBackupKeys(retryStorage).length <= 2, 'Retry should prune old backup keys before saving a new backup.')

const failStorage = createMemoryStorage([
  [`${BACKUP_PREFIX}2026-06-19T08-00-00`, 'older'],
  [`${BACKUP_PREFIX}2026-06-20T08-00-00`, 'newer'],
  [STUDENTS_KEY, '[{"id":"student-001"}]'],
], { throwOnSetCount: 2 })
const failedBackup = createCloudDbPullBackup(failStorage)
assert.equal(failedBackup.ok, false)
assert.equal(failedBackup.reason, 'backupQuotaExceeded')
assert.match(failedBackup.error, /Không thể tạo bản sao lưu/)
assert(failStorage.has(STUDENTS_KEY), 'Failed backup must not delete main data keys.')

const storageSource = fs.readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8')
assert(storageSource.includes("const CLOUD_PULL_BACKUP_PREFIX = 'ichessCenterOS.backup.beforeCloudPull.'"))
assert(storageSource.includes('pruneCloudPullBackups(storage, CLOUD_PULL_BACKUP_KEEP_COUNT)'))
assert(storageSource.includes('isStorageQuotaExceededError'))
assert(storageSource.includes('backupQuotaExceeded'))
assert(!storageSource.includes('localStorage.clear'))

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const applyStart = mainSource.indexOf('function applyCoreCloudSnapshotToLocal')
const applyEnd = mainSource.indexOf('function restoreAngelWingsLocalDataset', applyStart)
const applySource = mainSource.slice(applyStart, applyEnd)
assert(applySource.includes('backupResult'))
assert(applySource.includes('backupResult.ok === false'))
assert(applySource.indexOf('backupResult.ok === false') < applySource.indexOf('saveStoredStudents(students)'))
assert(applySource.includes('return {'))
assert(applySource.includes('ok: false'))

const cloudSyncSource = fs.readFileSync(new URL('../src/cloud-db-sync.js', import.meta.url), 'utf8')
const pullStart = cloudSyncSource.indexOf('export async function pullCoreEntitiesFromCloud')
const pullEnd = cloudSyncSource.indexOf('export function createEmptyCloudEntityCounts', pullStart)
const pullSource = cloudSyncSource.slice(pullStart, pullEnd)
assert(pullSource.includes('try {'))
assert(pullSource.includes('catch (error)'))
assert(pullSource.includes('Local data được giữ nguyên'))

console.log('F19H.2 hotfix localStorage quota cloud backup smoke passed')
