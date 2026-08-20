import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getC5CloseoutLegacyCoreAttendanceSnapshotKey,
  getC5CloseoutLegacyCrmManifestKey,
  inspectAndQuarantineC53LegacyCrm,
  preserveC5CloseoutLegacyCoreAttendance,
} from '../src/legacy-closeout-preservation.js'
import { cleanupLegacyDatasetLocalResidue } from '../src/legacy-dataset-cleanup.js'
import {
  clearStoredParentConsultations,
  getStoredNotifications,
  getStoredParentConsultations,
  saveStoredParentConsultations,
  setCurrentStorageCenterId,
} from '../src/storage.js'

class MemoryStorage {
  constructor(entries = {}) { this.items = new Map(Object.entries(entries).map(([key, value]) => [key, String(value)])) }
  get length() { return this.items.size }
  key(index) { return [...this.items.keys()][index] ?? null }
  getItem(key) { return this.items.has(String(key)) ? this.items.get(String(key)) : null }
  setItem(key, value) { this.items.set(String(key), String(value)) }
  removeItem(key) { this.items.delete(String(key)) }
  clear() { this.items.clear() }
  snapshot() { return Object.fromEntries(this.items) }
}

const centerA = 'center-a'
const centerB = 'center-b'
const key = (scope, center = centerA) => `ichessCenterOS.${scope}.${center}`
const legacyStudentRaw = JSON.stringify([{ id: 'student-real', fullName: 'Real local row' }])
const legacyAttendanceRaw = '{malformed-attendance-json'
const storage = new MemoryStorage({
  [key('students')]: legacyStudentRaw,
  [key('attendanceRecords')]: legacyAttendanceRaw,
  [key('students', centerB)]: JSON.stringify([{ id: 'student-b' }]),
})
const before = storage.snapshot()
const preserveA = preserveC5CloseoutLegacyCoreAttendance({ storage, centerId: centerA })
assert.equal(preserveA.ok, true)
assert.equal(preserveA.created, true)
const snapshotA = JSON.parse(storage.getItem(getC5CloseoutLegacyCoreAttendanceSnapshotKey(centerA)))
assert.equal(snapshotA.centerId, centerA)
assert.equal(snapshotA.state, 'QUARANTINED_NOT_ACTIVE')
assert.equal(snapshotA.authority, false)
assert.equal(snapshotA.autoUpload, false)
assert.equal(snapshotA.silentDelete, false)
assert.equal(snapshotA.sources.length, 9)
assert.equal(snapshotA.sources.find((item) => item.key === key('students')).raw, legacyStudentRaw)
assert.equal(snapshotA.sources.find((item) => item.key === key('attendanceRecords')).raw, legacyAttendanceRaw)
assert.equal(storage.getItem(key('students')), before[key('students')])
assert.equal(storage.getItem(key('attendanceRecords')), before[key('attendanceRecords')])
assert.equal(snapshotA.sources.some((item) => item.key.endsWith(`.${centerB}`)), false)
assert.equal(preserveC5CloseoutLegacyCoreAttendance({ storage, centerId: centerA }).created, false)
assert.equal(preserveC5CloseoutLegacyCoreAttendance({ storage, centerId: '' }).ok, false)
assert.equal(preserveC5CloseoutLegacyCoreAttendance({ storage, centerId: 'bad center' }).ok, false)

const preserveB = preserveC5CloseoutLegacyCoreAttendance({ storage, centerId: centerB })
assert.equal(preserveB.ok, true)
const snapshotB = JSON.parse(storage.getItem(getC5CloseoutLegacyCoreAttendanceSnapshotKey(centerB)))
assert.equal(snapshotB.centerId, centerB)
assert.equal(snapshotB.sources.find((item) => item.key === key('students', centerB)).raw, JSON.stringify([{ id: 'student-b' }]))

const crmRaw = JSON.stringify([{
  id: 'crm-real-1', parentName: 'Real Parent', phone: '0900000000',
  sourceModule: 'angel-wings-import',
}])
const crmStorage = new MemoryStorage({ [key('parentConsultations')]: crmRaw })
const crmBefore = crmStorage.snapshot()
const crmManifestResult = inspectAndQuarantineC53LegacyCrm({ storage: crmStorage, centerId: centerA })
assert.equal(crmManifestResult.ok, true)
assert.equal(crmManifestResult.migrationRequired, true)
assert.equal(crmStorage.getItem(key('parentConsultations')), crmRaw)
const crmManifestRaw = crmStorage.getItem(getC5CloseoutLegacyCrmManifestKey(centerA))
const crmManifest = JSON.parse(crmManifestRaw)
assert.equal(crmManifest.centerId, centerA)
assert.equal(crmManifest.state, 'QUARANTINED_NOT_ACTIVE')
assert.equal(crmManifest.payloadCopied, false)
assert.equal(crmManifest.sourceRetained, true)
assert.equal(crmManifest.autoUpload, false)
assert.equal(crmManifest.silentDelete, false)
assert(!crmManifestRaw.includes('0900000000'), 'CRM manifest must not duplicate sensitive payload')
assert.equal(inspectAndQuarantineC53LegacyCrm({ storage: crmStorage, centerId: centerA }).created, false)
crmStorage.setItem(key('parentConsultations'), JSON.stringify([{ id: 'changed-after-quarantine' }]))
assert.equal(inspectAndQuarantineC53LegacyCrm({ storage: crmStorage, centerId: centerA }).outcome_code, 'LEGACY_SOURCE_DRIFT')
assert.equal(crmBefore[key('parentConsultations')], crmRaw)

const malformedCrm = new MemoryStorage({ [key('parentConsultations')]: '{malformed' })
const malformedResult = inspectAndQuarantineC53LegacyCrm({ storage: malformedCrm, centerId: centerA })
assert.equal(malformedResult.ok, true)
assert.equal(malformedResult.source.classification, 'UNCERTAIN')
assert.equal(malformedCrm.getItem(key('parentConsultations')), '{malformed')
const emptyCrm = new MemoryStorage({ [key('parentConsultations')]: '[]' })
assert.equal(inspectAndQuarantineC53LegacyCrm({ storage: emptyCrm, centerId: centerA }).migrationRequired, false)

const cleanupStorage = new MemoryStorage({
  [key('students')]: JSON.stringify([{ id: 'fixture', sourceModule: 'angel-wings-import' }]),
  [key('parentConsultations')]: crmRaw,
  [key('attendanceAdvisoryNotes')]: JSON.stringify([{ id: 'manual-note-real', content: 'Keep me' }]),
  [key('attendanceBoardNotes')]: JSON.stringify([{ id: 'board-note-real', content: 'Keep me too' }]),
})
const cleanup = cleanupLegacyDatasetLocalResidue(cleanupStorage, centerA)
assert.equal(cleanup.ok, true)
assert.deepEqual(JSON.parse(cleanupStorage.getItem(key('students'))), [])
assert.equal(cleanupStorage.getItem(key('parentConsultations')), crmRaw)
assert.equal(cleanupStorage.getItem(key('attendanceAdvisoryNotes')), JSON.stringify([{ id: 'manual-note-real', content: 'Keep me' }]))
assert.equal(cleanupStorage.getItem(key('attendanceBoardNotes')), JSON.stringify([{ id: 'board-note-real', content: 'Keep me too' }]))
assert(!cleanup.changedKeys.includes(key('parentConsultations')))

const unresolvedCleanupStorage = new MemoryStorage({
  [key('students', 'dreamhome')]: JSON.stringify([{ id: 'fixture', sourceModule: 'angel-wings-import' }]),
  [key('students', 'bad_center')]: JSON.stringify([{ id: 'fixture', sourceModule: 'angel-wings-import' }]),
})
const blankCleanup = cleanupLegacyDatasetLocalResidue(unresolvedCleanupStorage, '')
assert.equal(blankCleanup.ok, false)
assert.equal(blankCleanup.outcome_code, 'INVALID_CENTER_CONTEXT')
assert.equal(blankCleanup.changedKeys.length, 0)
assert.equal(JSON.parse(unresolvedCleanupStorage.getItem(key('students', 'dreamhome'))).length, 1)
const malformedCenterCleanup = cleanupLegacyDatasetLocalResidue(unresolvedCleanupStorage, 'bad center')
assert.equal(malformedCenterCleanup.ok, false)
assert.equal(malformedCenterCleanup.changedKeys.length, 0)
assert.equal(JSON.parse(unresolvedCleanupStorage.getItem(key('students', 'bad_center'))).length, 1)

globalThis.localStorage = new MemoryStorage()
setCurrentStorageCenterId(centerA)
globalThis.localStorage.setItem(key('parentConsultations'), crmRaw)
assert.equal(clearStoredParentConsultations(), false)
assert.equal(saveStoredParentConsultations([{ id: 'must-not-write' }]), false)
assert.equal(globalThis.localStorage.getItem(key('parentConsultations')), crmRaw)
assert.equal(getStoredParentConsultations([])[0].id, 'crm-real-1')

globalThis.localStorage.setItem(key('notifications'), JSON.stringify([
  { id: 'notif-001', type: 'system', title: 'Notification Center đã sẵn sàng' },
  { id: 'notif-001', type: 'system', title: 'Real notification with reused id' },
  { id: 'business-1', type: 'tuition-advisory', title: 'Real business candidate' },
]))
const notifications = getStoredNotifications([])
assert.equal(notifications.length, 2)
assert(notifications.some((item) => item.title === 'Real notification with reused id'))
assert(notifications.some((item) => item.id === 'business-1'))

const root = process.cwd()
const main = readFileSync(join(root, 'src/main.js'), 'utf8')
const cleanupSource = readFileSync(join(root, 'src/legacy-dataset-cleanup.js'), 'utf8')
assert(!main.includes('clearStoredParentConsultations'))
assert(!cleanupSource.includes("'parentConsultations'"))
assert(main.indexOf('preserveC5CloseoutLegacyCoreAttendance') < main.indexOf('cleanupLegacyDatasetLocalResidue'))
assert(!main.includes('getStoredNotifications(createSampleNotifications())'))

console.log('C5_CLOSEOUT_LEGACY_LOCAL_PRESERVATION_AUDIT: PASS')
