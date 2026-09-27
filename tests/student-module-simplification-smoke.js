import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getStudentNextAction } from '../src/student-overview.js'
import { initialStudentFilters, renderStudentModule } from '../src/student-module.js'
import { renderStudentDetail } from '../src/student-detail.js'
import { buildTuitionRows, calculateTuitionAmounts } from '../src/tuition-module.js'

export const student = {
  id: 'qa-student', fullName: 'Nguyễn Quỳnh Anh', birthDate: '2018-03-12', gender: 'female',
  parentName: 'Nguyễn Thị Thu Hương', motherPhone: '0900000000', level: 'Dolphin 2',
  currentStatus: 'Đang theo học', schoolName: 'Nguyễn Du', schoolGrade: 'Lớp 3',
  highestBotMilestone: 'Bot 500', testScore: 8,
  classSessionIds: ['qa-class'], useAuthoritativeEnrollment: true,
  recurringEnrollments: [{ classSessionId: 'qa-class', weekdays: ['tue', 'sat'] }],
}
export const classes = [{ id: 'qa-class', name: 'Dolphin 2', displayLabel: 'Dolphin 2 · 18:00–19:00',
  daysOfWeek: ['tue', 'sat'], status: 'active', startTime: '18:00', endTime: '19:00', instructorName: 'Cô Mai' }]
const tuition = {
  id: 'qa-tuition', studentId: student.id, packageName: 'Gói 16 buổi', currentTermId: 'qa-term',
  totalSessions: 16, usedSessions: 14, totalAmount: 2000000, discountType: 'none',
}
const transaction = {
  id: 'qa-transaction', sourceTuitionId: tuition.id, sourceStudentId: student.id,
  sourceModule: 'hoc-phi', sourceType: 'tuition-payment', sourcePeriodId: tuition.currentTermId,
  amount: 2080000, tuitionAllocation: 2000000, type: 'income', category: 'Học phí', status: 'posted',
}
export const cycle = { id: 'qa-cycle', cycleNumber: 2, packageName: tuition.packageName, totalSessions: 16,
  usedSessions: 14, remainingSessions: 2, paymentStatus: 'PAID', lifecycleStatus: 'ACTIVE',
  renewalReminder: true, bchtReminder: false, bchtStatus: 'COMPLETED' }
export function makeRow(overrides = {}) {
  const state = { studentId: student.id, readiness: 'READY', currentCycle: { ...cycle, ...overrides }, cycles: [] }
  return buildTuitionRows([student], [tuition], [], [transaction], {
    financeAvailable: true, packageCycleReady: true, packageCycleStudentStates: [state],
  })[0]
}
export const row = makeRow()
let actionCases = 0
const check = (expected, shownStudent = student, shownRow = row, shownClasses = classes) => {
  assert.equal(getStudentNextAction(shownStudent, shownClasses, shownRow).key, expected)
  actionCases++
}
check('assign-class', { ...student, classSessionIds: [] })
check('assign-class', { ...student, classSessionIds: ['deleted'] })
check('assign-class', student, row, [{ ...classes[0], status: 'inactive' }])
check('review-class', { ...student, classSessionIds: ['qa-class', 'deleted'] })
check('choose-days', { ...student, recurringEnrollments: [{ classSessionId: 'qa-class', weekdays: [] }] })
check('not-studying', { ...student, currentStatus: 'Ngưng học', classSessionIds: [] })
check('not-studying', { ...student, currentStatus: 'Bảo lưu' })
check('tuition-unavailable', student, null)
check('assign-package', student, { student, tuition: null })
check('review-package', student, { ...row, packageCycleState: { readiness: 'LEGACY_REVIEW_REQUIRED' } })
check('assign-package', student, makeRow({ lifecycleStatus: 'NEEDS_PACKAGE_SELECTION' }))
check('record-payment', student, { ...makeRow({ paymentStatus: 'PARTIAL', bchtReminder: true }), debtAmount: 500000 })
check('record-payment', student, makeRow({ lifecycleStatus: 'PROVISIONAL_UNPAID', paymentStatus: 'UNPAID' }))
check('tuition-notice')
check('renewal-payment', student, makeRow({ remainingSessions: 1 }))
check('complete-report', student, makeRow({ renewalReminder: false, bchtReminder: true, bchtStatus: 'IN_PROGRESS' }))
check('complete-report', student, { ...row, packageCycleState: { ...row.packageCycleState, currentCycle: {
  ...cycle, renewalReminder: false }, cycles: [{ ...cycle, id: 'older-cycle', cycleNumber: 1, bchtReminder: true, bchtStatus: 'IN_PROGRESS' }] } })
const preparedPaid = { ...row, packageCycleState: { ...row.packageCycleState, preparedNextCycle: { paymentStatus: 'PAID' } } }
check('next-paid', student, preparedPaid)
check('none', student, makeRow({ renewalReminder: false }))
check('tuition-unavailable', student, { ...makeRow({ renewalReminder: false }), financeAvailable: false })
check('tuition-notice', student, { ...row, tuition: null, tuitionAvailable: false, financeAvailable: false })
check('tuition-unavailable', student, { student, tuition: null, tuitionAvailable: false })
check('assign-package', student, { student, tuition: null, tuitionAvailable: false, packageCycleState: { readiness: 'NO_TUITION_PACKAGE' } })
check('settlement-review', { ...student, currentStatus: 'Ngưng học' }, { ...row, debtAmount: 250000 })

// The snapshot uses the existing Tuition allocation, not gross received money
// (which includes material fees), and ignores voided transactions in that owner.
assert.equal(row.amounts.paidAmount, calculateTuitionAmounts(tuition, [transaction]).paidAmount)
assert.equal(row.amounts.paidAmount, 2000000)
const voidedRow = buildTuitionRows([student], [tuition], [], [{ ...transaction, status: 'voided' }])[0]
assert.equal(voidedRow.amounts.paidAmount, 0)

const options = { tuitionRows: [row], customerIds: { [student.id]: 'qa-customer' } }
const list = renderStudentModule([student], initialStudentFilters, null, [], classes, options)
assert.match(list, /<th>Cần xử lý<\/th>/)
assert.equal((list.match(/data-student-overview-action=/g) || []).length, 1)
assert.doesNotMatch(list, /Ca học không tìm thấy|>Không<|WAITING_PAYMENT|PROVISIONAL_UNPAID/)
const detail = renderStudentDetail(student, [], classes, [tuition], options)
assert(detail.indexOf('Việc tiếp theo') > detail.indexOf('student-detail-hero'))
assert(detail.indexOf('Việc tiếp theo') < detail.indexOf('student-operational-grid'))
assert.equal((detail.match(/Điểm bài kiểm tra gần nhất/g) || []).length, 1)
assert.equal((detail.match(/Mốc bot/g) || []).length, 1)
assert.equal((detail.match(/data-student-next-action=/g) || []).length, 1)
assert.doesNotMatch(detail, /student-learning-result-tile|CCCD|data-tuition-action=|data-v24-action=/)
assert(detail.includes('Xem khách hàng'))
assert(detail.includes('Lớp ở trường'))
assert(!detail.includes('data-student-profile-weekday="mon"'))
assert(detail.includes('data-student-profile-weekday="tue"'))
assert(detail.includes('data-student-profile-weekday="sat"'))
const missingFinance = renderStudentDetail(student, [], classes, [tuition], { tuitionRows: [{ ...row, financeAvailable: false }] })
assert(missingFinance.includes('Chưa tải được số đã thu'))
assert(!missingFinance.includes('>0\u00a0₫</dd>'))
const cycleOnly = renderStudentDetail(student, [], classes, [], { tuitionRows: [{ ...row, tuition: null, tuitionAvailable: false, financeAvailable: false }] })
assert(cycleOnly.includes('14 / 16 buổi'))
assert(cycleOnly.includes('Gói 16 buổi'))
assert(!cycleOnly.includes('Chưa có gói học.'))
const inactiveProfile = renderStudentDetail({ ...student, classSessionIds: ['qa-class', 'old-class'] }, [],
  [...classes, { id: 'old-class', status: 'inactive', name: 'Lớp Dolphin cũ' }], [], options)
assert(inactiveProfile.includes('Ca học đã ngưng'))
assert(inactiveProfile.indexOf('Lớp Dolphin cũ') > inactiveProfile.indexOf('<details'))
const owner = readFileSync(new URL('../src/student-detail.js', import.meta.url), 'utf8')
assert(!owner.includes('calculateTuitionAmounts'))
assert(!owner.includes('buildStudentTuitionLink'))
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
for (const marker of ["studentOverviewAction === 'edit'", "studentOverviewAction === 'tuition'",
  "studentOverviewAction === 'schedule'", "studentOverviewAction === 'customer'",
  'getStudentOverviewOptions()', "openModuleWindowFromChildInteraction('hoc-phi')"]) assert(main.includes(marker))
const start = main.indexOf('function getStudentOverviewOptions()')
const end = main.indexOf('\nfunction ', start + 1)
const overviewFactory = new Function('context', `with (context) { ${main.slice(start, end)}; return getStudentOverviewOptions(); }`)
const context = {
  getCurrentCanonicalCenterContext: () => ({ centerId: 'qa-center' }),
  isModuleUpstreamCurrent: () => true,
  c54FinanceSharedTruthState: { centerId: 'qa-center', lastLoadedAt: '2026-09-26', isLoading: false, messageTone: 'success' },
  v24PackageCycleCapabilityState: {}, isV24PackageCycleCapabilityReady: () => true,
  getStudentsWithCanonicalProjections: () => [student], tuitionRecords: [tuition], cashflowTransactions: [transaction],
  v24PackageCycleStudentStates: [row.packageCycleState], buildTuitionRows,
  parentFirstCapabilityState: {}, isParentFirstCapabilityReady: () => false, parentStudentLinks: [],
}
assert.equal(overviewFactory(context).tuitionRows[0].amounts.paidAmount, 2000000)
for (const changed of [{ messageTone: 'error' }, { isLoading: true }, { lastLoadedAt: '' }, { centerId: 'other-center' }]) {
  const guarded = overviewFactory({ ...context, c54FinanceSharedTruthState: { ...context.c54FinanceSharedTruthState, ...changed } })
  assert.equal(guarded.tuitionRows[0].financeAvailable, false)
  assert.equal(guarded.tuitionRows[0].amounts.paidAmount, null)
}
console.log(`STUDENT_MODULE_SIMPLIFICATION_SMOKE: PASS (${actionCases} next-action cases; canonical allocation/void; module boundaries)`)
