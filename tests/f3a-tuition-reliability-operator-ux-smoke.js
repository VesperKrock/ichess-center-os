import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildTuitionRows,
  getPackageCycleWarningStatus,
  getTuitionWarningStatus,
  initialTuitionFilters,
  renderTuitionModule,
} from '../src/tuition-module.js'
import {
  advisoryCareStatusLabels,
  getAttendanceAdvisoryWarning,
} from '../src/attendance-advisory.js'

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const tuitionSource = readFileSync(new URL('../src/tuition-module.js', import.meta.url), 'utf8')
const tuitionTheme = readFileSync(new URL('../src/tuition-theme.css', import.meta.url), 'utf8')
const parentSource = readFileSync(new URL('../src/parent-consultation-module.js', import.meta.url), 'utf8')
const notificationSource = readFileSync(new URL('../src/notification-center.js', import.meta.url), 'utf8')

const students = [
  ['more-than-four', 'Năm buổi'],
  ['exactly-four', 'Bốn buổi'],
  ['less-than-four', 'Hai buổi'],
  ['zero', 'Hết buổi'],
  ['unknown', 'Thiếu dữ liệu'],
  ['cycle-four', 'Chu kỳ bốn buổi'],
].map(([id, fullName]) => ({
  id,
  fullName,
  parentName: `Phụ huynh ${fullName}`,
  parentPhone: '0900000000',
  currentStatus: 'Đang theo học',
  classSessionIds: ['slot-a'],
  careNotes: id === 'exactly-four'
    ? [{
        id: 'care-existing',
        createdAt: '2026-09-20T08:00:00.000Z',
        author: 'Owner QA',
        content: 'Nội dung chăm sóc đã lưu',
        tags: ['Học phí'],
        sourceModule: 'tuition',
      }]
    : [],
}))

const tuitionRecords = [
  { id: 't-more', studentId: 'more-than-four', packageName: 'Gói QA', totalSessions: 8, usedSessions: 3, totalAmount: 1000, paidAmount: 1000 },
  { id: 't-four', studentId: 'exactly-four', packageName: 'Gói QA', totalSessions: 8, usedSessions: 4, totalAmount: 1000, paidAmount: 0 },
  { id: 't-two', studentId: 'less-than-four', packageName: 'Gói QA', totalSessions: 8, usedSessions: 6, totalAmount: 1000, paidAmount: 1000 },
  { id: 't-zero', studentId: 'zero', packageName: 'Gói QA', totalSessions: 8, usedSessions: 8, totalAmount: 1000, paidAmount: 1000 },
  {
    id: 't-unknown',
    studentId: 'unknown',
    packageName: 'Gói cũ thiếu dữ liệu',
    totalSessions: 0,
    usedSessions: 0,
    hasTotalSessionsData: false,
    hasUsedSessionsData: false,
    totalAmount: 0,
    paidAmount: 0,
  },
  { id: 't-cycle', studentId: 'cycle-four', packageName: 'Gói cũ', totalSessions: 12, usedSessions: 1, totalAmount: 1000, paidAmount: 1000 },
]

assert.deepEqual(getTuitionWarningStatus(5), { key: 'normal', label: 'Bình thường', level: 'normal' })
assert.deepEqual(getTuitionWarningStatus(4), { key: 'remaining-4', label: 'Còn 4 buổi', level: 'info' })
assert.deepEqual(getTuitionWarningStatus(2), { key: 'remaining-2', label: 'Còn 2 buổi', level: 'info' })
assert.deepEqual(getTuitionWarningStatus(0), { key: 'due', label: 'Đến hạn', level: 'due' })
assert.deepEqual(getTuitionWarningStatus(null), { key: 'missing-data', label: 'Chưa đủ dữ liệu', level: 'muted' })
assert.equal(getPackageCycleWarningStatus({ lifecycleStatus: 'ACTIVE', remainingSessions: 4 }).key, 'remaining-4')
assert.equal(getAttendanceAdvisoryWarning({ hasPackage: true, hasLearningData: true, remainingSessions: 4 }).label, 'Còn 4 buổi')

const rows = buildTuitionRows(students, tuitionRecords, [], [], {
  packageCycleReady: true,
  packageCycleStudentStates: [{
    studentId: 'cycle-four',
    currentCycle: {
      packageName: 'Gói chu kỳ',
      cycleNumber: 2,
      totalSessions: 8,
      usedSessions: 4,
      remainingSessions: 4,
      lifecycleStatus: 'ACTIVE',
      renewalReminder: false,
      urgentRenewal: false,
      bchtReminder: false,
    },
  }],
})
assert.equal(rows.find((row) => row.student.id === 'more-than-four').remainingSessions, 5)
assert.equal(rows.find((row) => row.student.id === 'exactly-four').status.key, 'remaining-4')
assert.equal(rows.find((row) => row.student.id === 'less-than-four').status.key, 'remaining-2')
assert.equal(rows.find((row) => row.student.id === 'zero').status.key, 'due')
assert.equal(rows.find((row) => row.student.id === 'unknown').remainingSessions, null)
assert.equal(rows.find((row) => row.student.id === 'unknown').status.key, 'missing-data')
assert.equal(
  rows.find((row) => row.student.id === 'unknown').familyTuitionLink.warnings.some(
    (warning) => warning.key === 'tuition-low-session',
  ),
  false,
)
assert.equal(rows.find((row) => row.student.id === 'cycle-four').status.key, 'remaining-4')

const html = renderTuitionModule(
  students,
  tuitionRecords,
  initialTuitionFilters,
  null,
  null,
  null,
  [],
  [],
  '2026-09',
  null,
  [],
  {
    studentId: 'exactly-four',
    editingNoteId: 'care-existing',
    values: { tag: 'Học phí', content: 'Nội dung chăm sóc đã sửa' },
  },
  null,
  [],
  'f3a-center',
  null,
  {},
  { attendanceStatus: 'ready', calendarNotesStatus: 'ready', financeStatus: 'ready' },
)
for (const token of [
  'Nợ học phí',
  'Còn 4 buổi',
  'Chưa đủ dữ liệu',
  'Chưa rõ / Chưa rõ buổi',
  'data-tuition-care-note-field="tag"',
  'data-tuition-care-note-field="content"',
  'data-tuition-care-note-action="edit"',
  'data-tuition-care-note-id="care-existing"',
  'Chỉnh sửa ghi chú chăm sóc',
  'Nội dung chăm sóc đã sửa',
]) assert(html.includes(token), `F3A Tuition UI is missing ${token}`)
assert(!html.includes('Còn nợ'))
assert.equal(advisoryCareStatusLabels.needReview, 'Cần theo dõi & chăm sóc')
assert(parentSource.includes("renderStatCard('Cần theo dõi & chăm sóc'"))
assert(notificationSource.includes('title: `Cần theo dõi & chăm sóc:'))
assert(!parentSource.includes('Cần follow-up'))
assert(!notificationSource.includes('Cần follow-up'))

const saveBlock = mainSource.slice(
  mainSource.indexOf('async function saveTuitionCareNote'),
  mainSource.indexOf('function openInternalOwnerHandoffConfirm'),
)
const careAuthorityBlock = mainSource.slice(
  mainSource.indexOf('async function commitAuthoritativeStudentCareNotes'),
  mainSource.indexOf('async function commitStudentProjection'),
)
assert(saveBlock.includes('commitAuthoritativeStudentCareNotes('))
assert(!saveBlock.includes('commitStudentProjection('))
assert(saveBlock.includes('editingNoteId'))
assert(saveBlock.includes('isSaving: true'))
assert(!saveBlock.includes('attendance'))
assert(careAuthorityBlock.includes('students.find('), 'Care save must start from the raw authoritative Student projection.')
assert(careAuthorityBlock.includes('commitAuthoritativeStudentCoreProjection('))
assert(!careAuthorityBlock.includes('commitV22StudentProjection('), 'Care-only save must not rewrite enrollment authority.')
assert(!careAuthorityBlock.includes('tuitionRecords'))

for (const token of [
  'font-size: 12px;',
  'font-size: 13px;',
  '.tuition-care-note-edit',
  '.tuition-advisory-table th',
  '.tuition-advisory-table td',
]) assert(tuitionTheme.includes(token), `F3A Tuition density CSS is missing ${token}`)
assert(tuitionSource.includes("['remaining-4', 'remaining-2', 'remaining-1'].includes(row.status.key)"))
assert(!tuitionSource.includes("{ value: 'debt', label: 'Còn nợ' }"))

console.log('F3A_TUITION_RELIABILITY_OPERATOR_UX_SMOKE: PASS')
