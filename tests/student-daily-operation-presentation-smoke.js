import assert from 'node:assert/strict'
import fs from 'node:fs'
import { formatStudentRecurringSchedule, getStudentRecurringScheduleItems } from '../src/student-recurring-enrollment.js'
import { getStudentNextAction } from '../src/student-overview.js'
import { renderStudentModule, initialStudentFilters } from '../src/student-module.js'
import { renderStudentDetail } from '../src/student-detail.js'
import { buildTuitionRows, renderTuitionModule, initialTuitionFilters } from '../src/tuition-module.js'
import { projectVerifiedInitialBaseline } from '../src/excel-initial-baseline.js'

const ca = [
  { id: 'a', name: 'T3 - T5 17:30 - 19:00', daysOfWeek: ['tue', 'thu'], startTime: '17:30', endTime: '19:00', teacherDisplayName: 'Cô A' },
  { id: 'b', daysOfWeek: ['tue', 'thu'], startTime: '19:00', endTime: '20:30' },
  { id: 'c', daysOfWeek: ['sat', 'sun'], startTime: '08:30', endTime: '10:00' },
]
const student = { id: 'one', fullName: 'Fixture Student', birthYear: '2018', birthDatePrecision: 'YEAR_ONLY', currentStatus: 'Đang theo học', motherName: 'Fixture Parent', motherPhone: '+84900000001', level: '', schoolName: '', useAuthoritativeEnrollment: true, classSessionIds: [] }
const fixtures = [
  [[['a', ['thu']]], 'T5 17:30 - 19:00'],
  [[['a', ['tue', 'thu']]], 'T3 - T5 17:30 - 19:00'],
  [[['a', ['tue']], ['c', ['sun']]], 'T3 17:30 - 19:00; CN 08:30 - 10:00'],
  [[['b', ['tue']], ['a', ['tue']]], 'T3 17:30 - 19:00; T3 19:00 - 20:30'],
  [[['a', ['tue', 'thu']], ['c', ['sun']]], 'T3 - T5 17:30 - 19:00; CN 08:30 - 10:00'],
]
const source = { discountKind: 'EXPLICIT_NONE', percent: 0, fixedMinor: 0, siblingVoucherMinor: 0, paymentState: 'UNKNOWN', sourceDueMinor: 1600000, collectedMinor: null, remainingMinor: null }
function baseline(paymentState = 'UNKNOWN', contributed = 0) {
  const [collectedMinor, remainingMinor] = { PAID_BEFORE_ICHESS: [1600000, 0], PARTIAL: [500000, 1100000], UNPAID: [0, 1600000], UNKNOWN: [null, null] }[paymentState]
  return projectVerifiedInitialBaseline({ id: '20000000-0000-4000-8000-000000000001', state: 'PENDING_FINANCIAL_REVIEW', version: 1, total_sessions: 16, baseline_used_sessions: 5, contributed_sessions: contributed, used_sessions: 5 + contributed, remaining_sessions: Math.max(11 - contributed, 0), financial_facts: { ...source, paymentState, collectedMinor, remainingMinor }, listed_price_minor: 1600000, package_name: 'Gói 16 buổi', baseline_cutoff_date: '2026-10-15' })
}
const state = { studentId: student.id, readiness: 'LEGACY_REVIEW_REQUIRED', currentCycle: null, cycles: [], verifiedInitialBaseline: baseline() }
for (const [enrollments, expected] of fixtures) {
  const s = { ...student, recurringEnrollments: enrollments.map(([classSessionId, weekdays]) => ({ classSessionId, weekdays })) }
  const before = JSON.stringify({ s, ca, state })
  assert.equal(formatStudentRecurringSchedule(s, ca), expected)
  const rows = buildTuitionRows([s], [], [], [], { packageCycleStudentStates: [state], packageCycleReady: true })
  assert.equal(getStudentNextAction(s, ca, rows[0]).key, 'none')
  const list = renderStudentModule([s], initialStudentFilters, null, [], ca, { tuitionRows: rows })
  assert(list.includes(`title="${expected}"`))
  assert(!list.includes('open-excel-import')); assert(list.includes('data-student-action="open-create"'))
  assert(!list.includes('Gán ca học')); assert(!list.includes('Gán gói học'))
  const detail = renderStudentDetail(s, [], ca, [], { tuitionRows: rows })
  assert(detail.includes(expected)); assert(detail.includes('Gói 16 buổi'))
  assert(detail.includes('5 / 16 buổi')); assert(detail.includes('11 buổi'))
  assert(detail.includes('Chưa mở kỳ')); assert(detail.includes('Cô A'))
  assert(!detail.includes('Chờ đối chiếu tài chính')); assert(!detail.includes('Gán gói học'))
  assert.equal(JSON.stringify({ s, ca, state }), before)
}
const enrolled = { ...student, recurringEnrollments: [{ classSessionId: 'a', weekdays: ['tue'] }] }
assert.equal(getStudentNextAction(enrolled, ca, { packageCycleState: { readiness: 'NO_TUITION_PACKAGE' }, tuitionAvailable: true }).key, 'assign-package')
assert.equal(getStudentNextAction(enrolled, ca, { tuitionAvailable: true }).key, 'tuition-unavailable')
assert.equal(getStudentNextAction({ ...enrolled, recurringEnrollments: [] }, ca).key, 'assign-class')
assert.equal(getStudentNextAction(enrolled, ca.map(c => ({ ...c, status: 'inactive' }))).key, 'assign-class')
assert.equal(getStudentNextAction({ ...enrolled, recurringEnrollments: [{ classSessionId: 'a', weekdays: ['mon'] }] }, ca).key, 'choose-days')
assert.equal(getStudentRecurringScheduleItems({ ...enrolled, recurringEnrollments: [{ classSessionId: 'a', weekdays: ['tue', 'mon'] }] }, ca)[0].status, 'review')
assert(!formatStudentRecurringSchedule(enrolled, ca).includes('T5'))
assert.equal(formatStudentRecurringSchedule({ classSessionIds: ['a'] }, ca), 'Cần chọn ngày 17:30 - 19:00')
assert.equal(formatStudentRecurringSchedule({ classSessionIds: ['single'] }, [{ id: 'single', daysOfWeek: ['sat'], startTime: '10:00', endTime: '11:30' }]), 'T7 10:00 - 11:30')
for (const [paymentState, label] of Object.entries({ PAID_BEFORE_ICHESS: 'đã thanh toán trước iChess', PARTIAL: 'thanh toán một phần', UNPAID: 'chưa thanh toán', UNKNOWN: 'chưa rõ thanh toán' })) {
  const s = { ...state, verifiedInitialBaseline: baseline(paymentState, 2) }
  const [row] = buildTuitionRows([enrolled], [], [], [], { packageCycleStudentStates: [s] })
  assert.equal(row.presentation.usedSessions, 7); assert.equal(row.remainingSessions, 9)
  assert.equal(row.presentation.hasKnownPackage, true); assert.equal(row.presentation.noPackage, false)
  assert.equal(row.presentation.action, 'none'); assert.equal(row.presentation.actionLabel, 'Chưa mở kỳ')
  assert(row.presentation.paymentLabel.includes(label)); assert.equal(row.debtAmount, null)
  assert.equal(row.presentation.canCollectPayment, false); assert.equal(row.presentation.canPrintReceipt, false)
  const html = renderTuitionModule({ students: [enrolled], cycleStates: [s], readStatus: 'ready', receipts: [], receiptStatus: 'ready' }, { filters: initialTuitionFilters })
  assert(html.includes('Chưa mở kỳ')); assert(!html.includes('Chờ đối chiếu tài chính'))
}
assert.equal(getStudentNextAction(enrolled, ca, { tuition: {}, financeAvailable: true, packageCycleState: { currentCycle: { paymentStatus: 'UNPAID', lifecycleStatus: 'PROVISIONAL_UNPAID' } } }).key, 'record-payment')
assert.match(fs.readFileSync('index.html', 'utf8'), /<title>iChess Center OS<\/title>/)
console.log('Student daily operation presentation: PASS (5 schedules, baseline/real missing package, legacy, payment facts, no import UI)')
