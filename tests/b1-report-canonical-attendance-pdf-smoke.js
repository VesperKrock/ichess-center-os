import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildCanonicalAttendanceLedger } from '../src/attendance-ledger.js'
import { buildReportData, getReportAttendanceSegments, renderReportModule, reportPendingTaskItems } from '../src/report-module.js'
import { createReportPdfProjection, REPORT_PDF_PAGE } from '../src/report-pdf.js'
import { ledgerFixture } from './a6-attendance-ledger-fixtures.js'

const filters = { weekStartDate: '2026-09-21', reportDate: '2026-09-24' }
const fixture = ledgerFixture()
fixture.now = new Date('2026-09-23T05:00:00Z')
fixture.occurrences.push({ ...fixture.occurrences.at(-1), occurrence_date: '2026-09-26' })
fixture.attendanceRecords.push({ ...fixture.attendanceRecords.at(-2), date: '2026-09-26' })
const before = structuredClone(fixture)
const ledger = buildCanonicalAttendanceLedger(fixture)
const transactions = [
  { id: 'income', type: 'income', transactionDate: '2026-09-24', amount: 1500000, category: 'Học phí' },
  { id: 'expense', type: 'expense', transactionDate: '2026-09-24', amount: 250000, category: 'Chi vận hành' },
  { id: 'previous', type: 'income', transactionDate: '2026-09-17', amount: 300000 },
  { id: 'future', type: 'income', transactionDate: '2026-10-01', amount: 900000 },
]
const data = buildReportData({ filters, students: fixture.students, cashflowTransactions: transactions, attendanceLedger: ledger })
assert.deepEqual(data.attendanceSummary, {
  source: 'A6_CANONICAL_ATTENDANCE_LEDGER', available: true, totalCount: 9,
  presentCount: 1, absentCount: 2, makeupCount: 1, unmarkedCount: 5,
  futureCount: 3, cancelledCount: 3, hasAttendanceData: true,
})
assert.equal(data.dailyIncome, 1500000)
assert.equal(data.dailyExpense, 250000)
assert.equal(data.dailyBalance, 1250000)
assert.equal(data.dailySourceTotal, 1750000)
assert.equal(data.weeklyIncome, 1500000)
assert.equal(data.weeklyExpense, 250000)
assert.equal(data.weeklyBalance, 1250000)
assert.equal(data.weeklyBars.weeks.at(-2).income, 300000)
assert.equal(data.weeklyBars.weeks.at(-1).income, data.weeklyIncome)
assert.deepEqual(fixture, before, 'Reporting never changes canonical input')

// Current active enrollment and report/local copies cannot infer absence.
const poisoned = buildReportData({ filters, attendanceLedger: ledger,
  students: Array.from({ length: 500 }, (_, i) => ({ id: `irrelevant-${i}` })),
  attendanceRecords: [{ studentId: 'student-left', date: '2026-09-21', status: 'absent' }],
  sessionReports: [{ date: '2026-09-21', students: [{ id: 'student-left', status: 'present' }] }],
})
assert.deepEqual(poisoned.attendanceSummary, data.attendanceSummary)
assert(ledger.rows.some(row => row.student.id === 'student-left'), 'Historical roster remains countable')
assert.equal(ledger.columns.filter(column => column.date === '2026-09-21').length, 2, 'Same-day identities survive')
const corrected = ledgerFixture()
corrected.attendanceRecords.push({ ...corrected.attendanceRecords.find(record => record.studentId === 'student-b' && record.date === '2026-09-21'),
  id: 'correction', source: 'correction', attendanceStatus: 'present', cloudVersion: 2,
})
const correctedData = buildReportData({ filters, attendanceLedger: buildCanonicalAttendanceLedger(corrected) })
assert.equal(correctedData.attendanceSummary.presentCount, 2)
assert.equal(correctedData.attendanceSummary.absentCount, 1)
assert.equal(correctedData.attendanceSummary.makeupCount, 1, 'Makeup remains separate from its historical absence')
assert.equal(buildReportData({ filters }).attendanceSummary.available, false)
const empty = buildReportData({ filters, attendanceLedger: { columns: [], rows: [] } })
assert.equal(empty.attendanceSummary.available, true)
assert.equal(empty.attendanceSummary.totalCount, 0)
assert.equal(empty.attendanceSummary.absentCount, 0)

const draft = { dailyTasks: 'Bàn giao lớp', dailyIssues: 'Theo dõi học viên', operationNote: 'Giữ nguyên ghi chú',
  otherPendingTasks: 'Gọi phụ huynh', ownerName: 'Cô Thanh', pendingTasks: { diemDanh: true, trucNhatVeSinh: true } }
const snapshot = { data, draft, viewMode: 'week', centerId: 'fixture', centerInfo: { centerName: 'Cơ sở kiểm thử' } }
const projection = createReportPdfProjection(snapshot)
assert.deepEqual(projection.data, data, 'PDF receives displayed numbers and chart inputs without recalculation')
assert.deepEqual(projection.draft, draft)
snapshot.data.attendanceSummary.presentCount = 99
snapshot.draft.pendingTasks.diemDanh = false
assert.equal(projection.data.attendanceSummary.presentCount, 1, 'PDF snapshot is isolated from later UI changes')
assert.equal(projection.draft.pendingTasks.diemDanh, true)
assert.throws(() => createReportPdfProjection({ data: buildReportData({ filters }), viewMode: 'week' }), /canonical/)
assert.equal(createReportPdfProjection({ data: buildReportData({ filters }), viewMode: 'day' }).viewMode, 'day')
assert.deepEqual(REPORT_PDF_PAGE, { width: 841.8898, height: 595.2756, label: 'A4 landscape' })
assert.deepEqual(getReportAttendanceSegments(projection.data.attendanceSummary).map(s => s.label), ['Có mặt', 'Vắng', 'Học bù', 'Chưa điểm danh'])

const html = renderReportModule({ filters, viewMode: 'week', attendanceLedger: ledger })
assert(!html.includes('Học / Vắng / Nghỉ'))
assert(html.includes('conic-gradient(') && html.includes('Thu / Chi theo tuần'))
assert(html.includes('Chưa điểm danh: 5') && html.includes('Học bù: 1'))
const day = renderReportModule({ filters, draft: projection.draft })
assert.equal((day.match(/data-report-pending-task=/g) || []).length, 7)
assert.deepEqual(reportPendingTaskItems.map(item => item.key), ['diemDanh', 'tbhp', 'nhacThuHp', 'chamSocPhuHuynhDinhKy', 'duaDonBe', 'trucNhatVeSinh', 'dangBaiDuaTin'])
assert(day.includes('Giữ nguyên ghi chú') && day.includes('Cô Thanh'))
assert(!day.includes('Thu / Chi theo tuần'), 'Day report does not add charts')
const pdfSource = fs.readFileSync(new URL('../src/report-pdf.js', import.meta.url), 'utf8')
assert(!/window\.print\(|about:blank|supabase|\.rpc\(|localStorage|sessionStorage/.test(pdfSource), 'PDF generator has no browser print chrome or data access/write path')
console.log('B1_REPORT_CANONICAL_ATTENDANCE_PDF_SMOKE PASS')
