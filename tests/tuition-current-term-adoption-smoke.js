import assert from 'node:assert/strict'
import { normalizeTuitionCyclePresentation } from '../src/tuition-module.js'
import { buildTuitionN2Candidates, buildPaymentAttentionCandidates } from '../src/notification-operational-assistant.js'
import { buildV24AdoptInitialBaselineCommand } from '../src/excel-initial-baseline.js'
const centerId = 'fixture', studentId = 'student', now = new Date('2026-10-16T12:00:00+07:00')
const financialFacts = { discountKind: 'PERCENT_THEN_SIBLING_VOUCHER', percent: 10, fixedMinor: 0, siblingVoucherMinor: 100000,
  paymentState: 'PARTIAL', sourceDueMinor: 1340000, collectedMinor: 500000, remainingMinor: 840000 }
const cycle = (patch = {}) => ({ id: '10000000-0000-4000-8000-000000000001', studentId, centerId, cycleNumber: 1,
  totalSessions: 16, usedSessions: 5, remainingSessions: 11, lifecycleStatus: 'ACTIVE', tuitionLocalId: 'tuition', paymentPeriodId: 'term-1',
  price: 1600000, discountAmount: 260000, amountDue: 1340000, paidAmount: 500000, paymentStatus: 'UNPAID',
  baselineUsed: 5, contributedSessions: 0, baselineCutoffDate: '2026-10-15',
  initialImport: { financialFacts, paymentComplete: false, outstandingAmount: 840000 }, ...patch })
const present = (currentCycle, preparedNextCycle = null) => normalizeTuitionCyclePresentation({ packageCycleState: {
  studentId, centerId, readiness: 'READY', currentCycle, preparedNextCycle, cycles: [currentCycle, preparedNextCycle].filter(Boolean) }, receiptReady: true })
for (const [used, total, remaining] of [[1, 16, 15], [7, 24, 17], [14, 16, 2], [16, 16, 0]]) {
  const p = present(cycle({ usedSessions: used, totalSessions: total, remainingSessions: remaining }))
  assert.equal(p.usedSessions, used); assert.equal(p.remainingSessions, remaining)
  assert(p.hasKnownPackage && !p.noPackage && !p.needsInitialSetup); assert.match(p.termLabel, /Tiếp quản/)
  assert.equal(p.paymentLabel, 'Chưa thanh toán đủ'); assert.equal(p.outstandingAmount, 840000)
  assert.equal(p.canCollectPayment, false, 'Do not collect the full term again while F5B lacks historical-credit support')
  assert(p.canPrintTbhp, 'The valid package/amount/current term enables TBHP regardless of payment or reminder threshold')
  assert(!p.canPrintReceipt, 'Historical source credit is not an issued OS receipt')
}
const currentPaid = cycle({ paymentStatus: 'PAID', paidAmount: 1340000, initialImport: { financialFacts: { ...financialFacts, paymentState: 'PAID_BEFORE_ICHESS', collectedMinor: 1340000, remainingMinor: 0 }, paymentComplete: true, outstandingAmount: 0 } })
assert.equal(present(currentPaid).canCollectPayment, false)
const next = cycle({ id: '10000000-0000-4000-8000-000000000002', cycleNumber: 2, initialImport: null, usedSessions: 0, remainingSessions: 16, paymentPeriodId: 'term-2', lifecycleStatus: 'PREPARED', paidAmount: 0 })
for (const remaining of [5, 4, 3, 2, 1, 0]) {
  const current = { ...currentPaid, usedSessions: 16 - remaining, remainingSessions: remaining }
  const p = present(current, next)
  assert.equal(p.reminderKind, remaining > 4 ? '' : remaining > 2 ? 'NOTICE_NEXT' : 'PAYMENT_NEXT')
  if (remaining === 4) assert.equal(p.reminderLabel, 'Chuẩn bị TBHP kỳ tiếp theo')
  if (remaining === 2) assert.match(p.reminderLabel, /thu học phí kỳ tiếp theo/)
  assert.equal(present(current, { ...next, paymentStatus: 'PAID' }).reminderLabel, '', 'Never remind collection for a next term already fully paid')
}
assert(present(currentPaid, next).prepared.canCollectPayment, 'Early payment is available even with eleven sessions left')
const unknown = cycle({ amountDue: null, discountAmount: null, initialImport: { financialFacts: { discountKind: 'UNKNOWN', percent: null, fixedMinor: null, siblingVoucherMinor: null, paymentState: 'UNKNOWN', sourceDueMinor: null, collectedMinor: null, remainingMinor: null }, paymentComplete: true, outstandingAmount: 0 }, paymentStatus: 'PAID' })
assert(present(unknown).isPaid); assert(!present(unknown).canPrintTbhp); assert(present(unknown).hasKnownPackage)
assert.equal(present({ ...unknown, paymentStatus: '', initialImport: { ...unknown.initialImport, paymentComplete: null, outstandingAmount: null } }).paymentLabel, 'Thiếu xác nhận thanh toán')
const state = { studentId, centerId, readiness: 'READY', currentCycle: { ...currentPaid, remainingSessions: 4, usedSessions: 12 }, preparedNextCycle: next, cycles: [] }
const source = { centerId, status: 'ready', students: [{ id: studentId, fullName: 'Fixture Student' }], cycleStates: [state] }, operations = { centerId, status: 'ready', tbhpCheckpoints: [] }
assert.match(buildTuitionN2Candidates(source, operations, { centerId, now })[0].message, /Chuẩn bị TBHP kỳ tiếp theo/)
assert.equal(buildTuitionN2Candidates({ ...source, cycleStates: [{ ...state, preparedNextCycle: { ...next, paymentStatus: 'PAID' } }] }, operations, { centerId, now }).length, 0)
assert.equal(buildPaymentAttentionCandidates({ ...operations, reminders: [{ centerId, studentId, cycleId: currentPaid.id, signal: 'PAYMENT_CHECK_DUE' }] }, source, { centerId, now }).length, 0)
assert.equal(buildV24AdoptInitialBaselineCommand({ studentId, baselineId: '20000000-0000-4000-8000-000000000001', baselineVersion: 1, packageVersion: 1, confirmedPaymentComplete: false, reviewNote: 'Owner reviewed source' }).confirmed_payment_complete, false)
assert.throws(() => buildV24AdoptInitialBaselineCommand({ studentId, baselineId: '20000000-0000-4000-8000-000000000001', baselineVersion: 1, packageVersion: 1, confirmedPaymentComplete: 'false', reviewNote: 'Owner reviewed source' }))
console.log('Current-term adoption presentation: PASS; owner examples, full/not-full, 4/2 NEXT reminders, early payment, no false Receipt or missing package')
