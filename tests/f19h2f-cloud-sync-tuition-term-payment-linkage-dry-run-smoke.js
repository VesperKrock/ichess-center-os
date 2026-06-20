import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  TUITION_PAYMENT_CLOUD_ENTITY_TYPE,
  TUITION_TERM_CLOUD_ENTITY_TYPE,
  TUITION_TERM_PAYMENT_CLOUD_STATUS_NEEDS_PATCH,
  buildTuitionPaymentCloudEntity,
  buildTuitionTermCloudEntity,
  createTuitionPaymentCloudLocalId,
  createTuitionTermCloudLocalId,
  createTuitionTermPaymentCloudDryRun,
  deriveTuitionPaymentCandidates,
  deriveTuitionTermCandidates,
  evaluateTuitionTermPaymentCloudReadiness,
  isAllowedTuitionTermPaymentCloudEntityType,
  validateTuitionPaymentCloudPayload,
  validateTuitionTermCloudPayload,
} from '../src/cloud-tuition-terms.js'

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
    discountAmount: 100000,
    paidAmount: 900000,
    currentTermNumber: 2,
    currentTermId: 'term-tuition-001-2',
    startedAt: '2026-06-01T00:00:00.000Z',
    payments: [
      {
        id: 'payment-001',
        amount: 900000,
        paidAt: '2026-06-20T09:00:00.000Z',
        method: 'cash',
      },
      {
        amount: 100000,
        note: 'Thieu ngay thanh toan nhung van co amount.',
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
        status: 'archived',
        payments: [
          {
            id: 'payment-history-001',
            amount: 1200000,
            paidAt: '2026-05-01T08:00:00.000Z',
          },
        ],
      },
    ],
    updatedAt: '2026-06-20T10:00:00.000Z',
  },
  {
    id: 'tuition-002',
    studentId: 'student-002',
    packageName: 'Goi 16 buoi',
    totalSessions: 16,
    usedSessions: 7,
    totalAmount: 1800000,
    paidAmount: 0,
    currentTermNumber: 1,
    payments: [
      {
        id: 'payment-invalid-zero',
        amount: 0,
        paidAt: '2026-06-21T09:00:00.000Z',
      },
    ],
  },
  {
    id: 'tuition-invalid-student',
    packageName: 'Goi loi',
    totalSessions: 8,
    usedSessions: 0,
    currentTermId: 'term-invalid-student-1',
  },
]
const storage = createLocalStorageMock({
  'ichessCenterOS.tuition.dreamhome': JSON.stringify(tuitionRecords),
})

assert.equal(TUITION_TERM_CLOUD_ENTITY_TYPE, 'tuition_term')
assert.equal(TUITION_PAYMENT_CLOUD_ENTITY_TYPE, 'tuition_payment')
assert.equal(isAllowedTuitionTermPaymentCloudEntityType('tuition_term'), true)
assert.equal(isAllowedTuitionTermPaymentCloudEntityType('tuition_payment'), true)
assert.equal(isAllowedTuitionTermPaymentCloudEntityType('tuition_record'), false)

const termCandidates = deriveTuitionTermCandidates(tuitionRecords)
const paymentCandidates = deriveTuitionPaymentCandidates(tuitionRecords)
assert.equal(termCandidates.length, 4)
assert.equal(paymentCandidates.length, 4)

const dryRun = createTuitionTermPaymentCloudDryRun({
  centerId: 'dreamhome',
  storage,
})
const termSummary = dryRun.entities.tuition_term
const paymentSummary = dryRun.entities.tuition_payment

assert.equal(dryRun.localSourceKey, 'ichessCenterOS.tuition.dreamhome')
assert.equal(dryRun.tuitionRecordsInspected, 3)
assert.equal(dryRun.termsDerived, 4)
assert.equal(dryRun.paymentsDerived, 4)
assert.equal(dryRun.total, 8)
assert.equal(dryRun.valid, 6)
assert.equal(dryRun.invalid, 2)
assert.equal(dryRun.skipped, 2)
assert.equal(dryRun.realPushStatus, TUITION_TERM_PAYMENT_CLOUD_STATUS_NEEDS_PATCH)
assert.equal(dryRun.runtimeAttendanceLinkageEnabled, false)
assert.equal(dryRun.usedSessionsAutoUpdateEnabled, false)
assert.equal(termSummary.valid, 3)
assert.equal(termSummary.invalid, 1)
assert.equal(termSummary.counts.missingCurrentTermId, 1)
assert.equal(termSummary.counts.missingTermHistory, 2)
assert.equal(paymentSummary.valid, 3)
assert.equal(paymentSummary.invalid, 1)
assert.equal(paymentSummary.counts.missingPaymentId, 1)
assert.equal(paymentSummary.counts.missingPaymentDate, 1)
assert.equal(paymentSummary.counts.missingPaymentAmount, 1)
assert.equal(paymentSummary.totalEstimatedPaymentAmount, 2200000)
assert.equal(storage.writeCount, 0, 'F19H.2f dry-run must not write localStorage.')

const termEntity = buildTuitionTermCloudEntity({
  centerId: 'dreamhome',
  term: termCandidates[0],
})
assert.equal(termEntity.ok, true)
assert.equal(termEntity.data.entity_type, 'tuition_term')
assert.equal(termEntity.data.payload.usedSessions, 5)
assert.equal(termEntity.data.payload.attendanceLinked, false)
assert.equal(termEntity.data.payload.attendanceLinkagePhase, 'design-only-f19h2f')
assert.equal(termEntity.data.payload.usedSessionsIsPreserved, true)

const paymentEntity = buildTuitionPaymentCloudEntity({
  centerId: 'dreamhome',
  payment: paymentCandidates[0],
})
assert.equal(paymentEntity.ok, true)
assert.equal(paymentEntity.data.entity_type, 'tuition_payment')
assert.equal(paymentEntity.data.payload.amount, 900000)
assert.equal(paymentEntity.data.payload.affectsAttendance, false)
assert.equal(paymentEntity.data.payload.updatesUsedSessions, false)

const deterministicTermValidation = validateTuitionTermCloudPayload(termCandidates[2])
assert.equal(deterministicTermValidation.ok, true)
assert.equal(
  createTuitionTermCloudLocalId(termCandidates[2]),
  'tuition-term::term-tuition-002-1',
)

const deterministicPaymentValidation = validateTuitionPaymentCloudPayload(paymentCandidates[1])
assert.equal(deterministicPaymentValidation.ok, true)
assert.equal(
  createTuitionPaymentCloudLocalId(paymentCandidates[1]),
  'tuition-payment::payment-tuition-001-2-100000-no-date',
)

const invalidTermValidation = validateTuitionTermCloudPayload(termCandidates[3])
assert.equal(invalidTermValidation.ok, false)
assert.equal(invalidTermValidation.error, 'Thieu studentId.')

const invalidPaymentValidation = validateTuitionPaymentCloudPayload(paymentCandidates[3])
assert.equal(invalidPaymentValidation.ok, false)
assert.equal(invalidPaymentValidation.error, 'Thieu amount hop le.')

const readiness = evaluateTuitionTermPaymentCloudReadiness({
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
assert.equal(readiness.status, TUITION_TERM_PAYMENT_CLOUD_STATUS_NEEDS_PATCH)

const docs = fs.readFileSync(
  new URL('../docs/supabase-tuition-term-payment-linkage-sync-f19h2f.md', import.meta.url),
  'utf8',
)
assert(docs.includes('tuition_term'))
assert(docs.includes('tuition_payment'))
assert(docs.includes('ichessCenterOS.tuition.dreamhome'))
assert(docs.includes('Attendance - Current Term Linkage'))
assert(docs.includes('Current term source phai den tu Hoc phi/TBHP'))
assert(docs.includes('max attendance credit toan lich su + 1'))
assert(docs.includes('Khong tu dong'))
assert(docs.includes('NEEDS SQL/ALLOWLIST PATCH'))

const sqlPatch = fs.readFileSync(
  new URL('../docs/supabase-f19h2f-tuition-term-payment-allowlist.sql', import.meta.url),
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
assert(sqlPatch.includes("'tuition_term'"))
assert(sqlPatch.includes("'tuition_payment'"))
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

console.log('F19H.2f cloud sync tuition term/payment linkage dry-run smoke passed')
