import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  TUITION_CLOUD_STATUS_NEEDS_PATCH,
  TUITION_PACKAGE_CLOUD_ENTITY_TYPE,
  TUITION_RECORD_CLOUD_ENTITY_TYPE,
  buildTuitionPackageCloudEntity,
  buildTuitionRecordCloudEntity,
  createTuitionCloudDryRun,
  createTuitionPackageCloudLocalId,
  createTuitionRecordCloudLocalId,
  evaluateTuitionCloudReadiness,
  isAllowedTuitionCloudEntityType,
  validateTuitionPackageCloudPayload,
  validateTuitionRecordCloudPayload,
} from '../src/cloud-tuition-records.js'

function createLocalStorageMock(initialValues = {}) {
  const values = new Map(Object.entries(initialValues))
  let writeCount = 0

  return {
    values,
    get writeCount() {
      return writeCount
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      writeCount += 1
      values.set(key, value)
    },
  }
}

const tuitionRecords = [
  {
    id: 'tuition-001',
    studentId: 'student-001',
    packageName: 'Goi 8 buoi',
    totalSessions: 8,
    usedSessions: 5,
    totalAmount: 1200000,
    discountType: 'amount',
    discountAmount: 100000,
    paidAmount: 900000,
    currentTermNumber: 2,
    currentTermId: 'term-tuition-001-2',
    payments: [
      {
        id: 'payment-001',
        amount: 900000,
        paidAt: '2026-06-20T09:00:00.000Z',
        method: 'cash',
      },
    ],
    termHistory: [
      {
        id: 'term-history-001',
        termNumber: 1,
        packageName: 'Goi 8 buoi',
        totalSessions: 8,
        usedSessions: 8,
        totalAmount: 1200000,
        paidAmount: 1200000,
      },
    ],
    updatedAt: '2026-06-20T10:00:00.000Z',
  },
  {
    studentId: 'student-002',
    packageName: 'Goi 16 buoi',
    totalSessions: 16,
    usedSessions: 7,
    totalAmount: 1800000,
    paidAmount: 1800000,
    currentTermNumber: 1,
  },
  {
    id: 'tuition-invalid-missing-student',
    packageName: 'Goi loi',
    totalSessions: 8,
    usedSessions: 0,
  },
]
const tuitionPackages = [
  {
    id: 'package-8-sessions',
    name: 'Goi 8 buoi',
    sessionCount: 8,
    price: 1000000,
    displayLabel: 'Goi 8 buoi - 1.000.000 VND',
    isActive: true,
  },
  {
    name: 'Goi 16 buoi',
    sessionCount: 16,
    price: 1800000,
  },
  {
    id: 'package-invalid-missing-name',
    sessionCount: 4,
    price: 600000,
  },
]
const storage = createLocalStorageMock({
  'ichessCenterOS.tuition.dreamhome': JSON.stringify(tuitionRecords),
  'ichessCenterOS.tuitionPackages.dreamhome': JSON.stringify(tuitionPackages),
})

assert.equal(TUITION_RECORD_CLOUD_ENTITY_TYPE, 'tuition_record')
assert.equal(TUITION_PACKAGE_CLOUD_ENTITY_TYPE, 'tuition_package')
assert.equal(isAllowedTuitionCloudEntityType('tuition_record'), true)
assert.equal(isAllowedTuitionCloudEntityType('tuition_package'), true)
assert.equal(isAllowedTuitionCloudEntityType('tuition_term'), false)

const dryRun = createTuitionCloudDryRun({
  centerId: 'dreamhome',
  storage,
})
const recordSummary = dryRun.entities.tuition_record
const packageSummary = dryRun.entities.tuition_package

assert.equal(dryRun.total, 6)
assert.equal(dryRun.valid, 4)
assert.equal(dryRun.invalid, 2)
assert.equal(dryRun.skipped, 2)
assert.equal(dryRun.realPushStatus, TUITION_CLOUD_STATUS_NEEDS_PATCH)
assert.equal(recordSummary.localSourceKey, 'ichessCenterOS.tuition.dreamhome')
assert.equal(packageSummary.localSourceKey, 'ichessCenterOS.tuitionPackages.dreamhome')
assert.equal(recordSummary.total, 3)
assert.equal(recordSummary.valid, 2)
assert.equal(recordSummary.invalid, 1)
assert.equal(recordSummary.counts.tuitionRecords, 2)
assert.equal(recordSummary.counts.missingStudentId, 1)
assert.equal(packageSummary.total, 3)
assert.equal(packageSummary.valid, 2)
assert.equal(packageSummary.invalid, 1)
assert.equal(packageSummary.counts.tuitionPackages, 2)
assert.equal(packageSummary.counts.missingPackageIdentity, 0)
assert.equal(storage.writeCount, 0, 'F19H.2e dry-run must not write localStorage.')

const recordEntity = buildTuitionRecordCloudEntity({
  centerId: 'dreamhome',
  record: tuitionRecords[0],
})
assert.equal(recordEntity.ok, true)
assert.equal(recordEntity.data.entity_type, 'tuition_record')
assert.equal(recordEntity.data.payload.usedSessions, 5)
assert.equal(recordEntity.data.payload.payments.length, 1)
assert.equal(recordEntity.data.payload.termHistory.length, 1)
assert.equal(recordEntity.data.payload.attendanceLinked, false)
assert.equal(recordEntity.data.payload.attendanceLinkagePhase, 'not-enabled-f19h2e')
assert.equal(recordEntity.data.payload.tuitionTermPaymentSplitEnabled, false)

const packageEntity = buildTuitionPackageCloudEntity({
  centerId: 'dreamhome',
  tuitionPackage: tuitionPackages[0],
})
assert.equal(packageEntity.ok, true)
assert.equal(packageEntity.data.entity_type, 'tuition_package')
assert.equal(packageEntity.data.payload.totalSessions, 8)
assert.equal(packageEntity.data.payload.price, 1000000)

const deterministicRecordValidation = validateTuitionRecordCloudPayload(tuitionRecords[1])
assert.equal(deterministicRecordValidation.ok, true)
assert.equal(deterministicRecordValidation.record.usedSessions, 7)
assert.equal(
  createTuitionRecordCloudLocalId(tuitionRecords[1]),
  'tuition-record::tuition-student-002-goi-16-buoi-1',
)

const deterministicPackageValidation = validateTuitionPackageCloudPayload(tuitionPackages[1])
assert.equal(deterministicPackageValidation.ok, true)
assert.equal(
  createTuitionPackageCloudLocalId(tuitionPackages[1]),
  'tuition-package::package-goi-16-buoi',
)

const invalidRecordValidation = validateTuitionRecordCloudPayload(tuitionRecords[2])
assert.equal(invalidRecordValidation.ok, false)
assert.equal(invalidRecordValidation.error, 'Thieu studentId.')

const invalidPackageValidation = validateTuitionPackageCloudPayload(tuitionPackages[2])
assert.equal(invalidPackageValidation.ok, false)
assert.equal(invalidPackageValidation.error, 'Thieu package name.')

const readiness = evaluateTuitionCloudReadiness({
  cloudReady: true,
  signedIn: true,
  membershipReady: true,
  centerId: 'dreamhome',
  dryRunPreview: {
    ...dryRun,
    invalid: 0,
  },
  explicitUserAction: true,
  remoteAllowlistReady: false,
})
assert.equal(readiness.ok, false)
assert.equal(readiness.status, TUITION_CLOUD_STATUS_NEEDS_PATCH)

const docs = fs.readFileSync(
  new URL('../docs/supabase-tuition-record-package-sync-f19h2e.md', import.meta.url),
  'utf8',
)
assert(docs.includes('tuition_record'))
assert(docs.includes('tuition_package'))
assert(docs.includes('ichessCenterOS.tuition.dreamhome'))
assert(docs.includes('ichessCenterOS.tuitionPackages.dreamhome'))
assert(docs.includes('usedSessions'))
assert(docs.includes('Attendance - current term linkage de F19H.2f'))
assert(docs.includes('NEEDS SQL/ALLOWLIST PATCH'))

const sqlPatch = fs.readFileSync(
  new URL('../docs/supabase-f19h2e-tuition-record-package-allowlist.sql', import.meta.url),
  'utf8',
)
assert(sqlPatch.includes("'student'"))
assert(sqlPatch.includes("'teacher'"))
assert(sqlPatch.includes("'class_session'"))
assert(sqlPatch.includes("'attendance_record'"))
assert(sqlPatch.includes("'attendance_baseline_state'"))
assert(sqlPatch.includes("'session_report'"))
assert(sqlPatch.includes("'schedule_session'"))
assert(sqlPatch.includes("'tuition_record'"))
assert(sqlPatch.includes("'tuition_package'"))
assert(!/create\s+table/i.test(sqlPatch))
assert(!/to\s+anon/i.test(sqlPatch))
assert(!/service_role/i.test(sqlPatch))

const runtimeSources = [
  '../src/main.js',
  '../src/cloud-db-sync.js',
  '../src/cloud-db-entities.js',
].map((filePath) => fs.readFileSync(new URL(filePath, import.meta.url), 'utf8')).join('\n')
assert(!runtimeSources.includes('attendance_baseline_state'))
assert(!runtimeSources.includes('session_report'))
assert(!runtimeSources.includes('schedule_session'))
assert(!runtimeSources.includes('tuition_record'))
assert(!runtimeSources.includes('tuition_package'))
assert(!runtimeSources.includes('tuition_term'))
assert(!runtimeSources.includes('tuition_payment'))
assert(!runtimeSources.includes('deadline_state'))
assert(!runtimeSources.includes('realtime'))

console.log('F19H.2e cloud sync tuition record/package dry-run smoke passed')
