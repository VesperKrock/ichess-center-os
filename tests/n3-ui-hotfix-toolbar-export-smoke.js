import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ledgerFixture } from './a6-attendance-ledger-fixtures.js'
import { renderCanonicalAttendanceLedgerModule } from '../src/attendance-ledger-module.js'
import { createAttendanceBoardDraft, stageAttendanceCell, attendanceDraftCount } from '../src/attendance-board-editor.js'
import { discardUnsavedAttendanceChanges } from '../src/attendance-board-toolbar.js'
import { createAttendanceXlsxProjection, generateAttendanceXlsx } from '../src/attendance-xlsx.js'

const input = ledgerFixture(), original = structuredClone(input), draft = createAttendanceBoardDraft('a6-fixture')
let model
const options = { students: input.students, classSessions: input.classSessions, filters: input.filters, draft,
  onModel: value => { model = value }, availability: { canWrite: true, attendanceAvailable: true, tuitionAvailable: true,
    centerName: 'Phòng kiểm thử', packageCycleReady: true, packageCycleStudentStates: input.packageCycleStudentStates,
    ledgerContext: { status: 'ready', occurrences: input.occurrences }, attendanceRecords: input.attendanceRecords, now: input.now } }
const clean = renderCanonicalAttendanceLedgerModule(options)
const toolbar = clean.match(/<div class="attendance-board-toolbar"[\s\S]*?<\/div>/)[0]
const controls = ['data-attendance-month-step="-1"', 'data-attendance-board-filter="month"', 'data-attendance-month-step="1"',
  'data-attendance-board-filter="classSessionId"', 'data-attendance-board-filter="teacherId"', 'data-attendance-board-filter="query"',
  'data-attendance-save', 'data-attendance-discard']
assert(controls.every((item, i) => toolbar.indexOf(item) >= 0 && (!i || toolbar.indexOf(item) > toolbar.indexOf(controls[i - 1]))))
assert(!toolbar.includes('data-attendance-export-'))
assert(!toolbar.includes('<span>Ca học</span>') && !toolbar.includes('<span>Giáo viên</span>') && !toolbar.includes('<span>Tìm học viên</span>'))
assert(!clean.includes('BẢNG ĐIỂM DANH')); assert(!clean.includes('Phòng kiểm thử · Tháng'))
assert(clean.includes('Tháng Chín 2026')); assert(!clean.includes('data-attendance-main-teacher'))
assert.match(clean, /data-attendance-save disabled/); assert.match(clean, /data-attendance-discard disabled/)
assert.match(clean, /data-attendance-export-menu[\s\S]*?In \/ Xuất PDF[\s\S]*?Xuất Excel \(\.xlsx\)/)
assert(clean.indexOf('data-attendance-export-menu') > clean.indexOf('attendance-ledger-meta'))
const cell = model.rows.find(row => row.student.id === 'student-a').cells.find(cell => cell.occurrence.scheduleSessionId === 'held')
assert(stageAttendanceCell(draft, { centerId: draft.centerId, studentId: 'student-a', cell, records: input.attendanceRecords,
  status: 'absent', reason: 'Lý do chưa lưu', canWrite: true, now: input.now }))
const dirty = renderCanonicalAttendanceLedgerModule(options)
assert.equal(attendanceDraftCount(draft), 1)
assert.match(dirty, /data-attendance-save\s+>/); assert.match(dirty, /data-attendance-discard\s+>/)
const canonicalBefore = structuredClone(model)
const projection = createAttendanceXlsxProjection(model, { centerName: 'Phòng kiểm thử', classLabel: 'Tất cả ca học', teacherLabel: 'Thầy Lịch sử' })
const exportedStudent = projection.rows.find(row => row[1] === 'Nguyễn Hoàng Minh Anh')
assert.equal(exportedStudent[5], '✓', 'Export keeps committed status while the UI has a local absent edit')
const marks = projection.rows.flatMap(row => row.slice(5, -2))
for (const mark of ['✓', 'V', 'B', '?', '×', '']) assert(marks.includes(mark), `Faithful ${mark || 'blank'} export`)
assert.equal(exportedStudent.at(-2), '4/8'); assert.equal(exportedStudent.at(-1), 4)
assert.deepEqual(projection.headers.slice(0, 5), ['STT', 'Họ và tên', 'Năm sinh', 'Gói/Buổi', 'Level'])
assert.equal(projection.headers.length, model.columns.length + 7)
for (const column of model.columns) assert(projection.headers.some(header => header.includes(column.date.slice(8) + '/' + column.date.slice(5, 7))))
assert.deepEqual(model, canonicalBefore); assert.deepEqual(input, original)
assert(discardUnsavedAttendanceChanges(draft)); assert.equal(attendanceDraftCount(draft), 0)
assert.equal(draft.centerId, 'a6-fixture'); assert.equal(draft.error, ''); assert.equal(draft.message, ''); assert.equal(draft.attempt, null)
assert.equal(discardUnsavedAttendanceChanges(draft), false)
assert.deepEqual(input, original, 'Discard cannot change Attendance, Tuition, makeup or authoritative reads')
for (const guard of ['saving', 'uncertain', 'bookingAttempt']) {
  const protectedDraft = { ...createAttendanceBoardDraft('a6-fixture'), changes: { a: { value: 'local' } }, [guard]: true }
  const before = structuredClone(protectedDraft)
  assert.equal(discardUnsavedAttendanceChanges(protectedDraft), false); assert.deepEqual(protectedDraft, before)
}
const readonly = renderCanonicalAttendanceLedgerModule({ ...options, availability: { ...options.availability, canWrite: false } })
assert(!readonly.includes('data-attendance-save')); assert(!readonly.includes('data-attendance-discard')); assert(readonly.includes('data-attendance-export-xlsx'))
const unavailable = renderCanonicalAttendanceLedgerModule({ ...options, availability: { ...options.availability, attendanceAvailable: false } })
assert.match(unavailable, /data-attendance-export-xlsx disabled/)
renderCanonicalAttendanceLedgerModule({ ...options, filters: { ...input.filters, query: 'Minh Anh', teacherId: 'teacher-history' } })
assert.equal(model.rows.length, 1)
const filtered = createAttendanceXlsxProjection(model)
assert.equal(filtered.rows.length, 1); assert.equal(filtered.context[3][1], 'Minh Anh')
assert.equal(filtered.headers.length, model.columns.length + 7)

// Independently inspect the actual ZIP records and OOXML parts, not a CSV
// renamed to .xlsx. The native Excel/browser check covers reader compatibility.
const poison = structuredClone(model)
poison.rows[0].student.fullName = '=HYPERLINK("https://invalid") & <Tên>'
const exported = generateAttendanceXlsx(poison, { centerName: 'Phòng kiểm thử' })
assert.match(exported.filename, /^bang-diem-danh-2026-09-Phong-kiem-thu\.xlsx$/)
assert.equal(exported.blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
const bytes = Buffer.from(exported.bytes), parts = new Map()
let offset = 0
while (bytes.readUInt32LE(offset) === 0x04034b50) {
  assert.equal(bytes.readUInt16LE(offset + 8), 0)
  const length = bytes.readUInt32LE(offset + 18), nameLength = bytes.readUInt16LE(offset + 26), extra = bytes.readUInt16LE(offset + 28)
  const start = offset + 30 + nameLength + extra, name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString()
  parts.set(name, bytes.subarray(start, start + length).toString('utf8')); offset = start + length
}
assert.equal(bytes.readUInt32LE(offset), 0x02014b50); assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50)
assert.equal(parts.size, 6); assert.equal(bytes.readUInt16LE(bytes.length - 12), parts.size)
assert(parts.get('[Content_Types].xml').includes('spreadsheetml.sheet.main+xml'))
assert(parts.get('xl/workbook.xml').includes('name="Điểm danh tháng"'))
const sheet = parts.get('xl/worksheets/sheet1.xml')
assert(sheet.includes('xSplit="5" ySplit="5"')); assert(sheet.includes('state="frozen"'))
assert(sheet.includes('=HYPERLINK(&quot;https://invalid&quot;) &amp; &lt;Tên&gt;'))
assert(!sheet.includes('<f>')); assert(!sheet.includes('<mergeCells'))
assert(sheet.includes('<v>4</v>')); assert(sheet.includes('4/8'))
for (const internal of ['student-a', 'attendance_record::', 'cycle-a', 'teacher-history', 'cloudVersion', 'optimistic', 'booking_id']) assert(!sheet.includes(internal))
const source = readFileSync('src/attendance-xlsx.js', 'utf8') + readFileSync('src/attendance-board-toolbar.js', 'utf8')
assert(!/\.rpc\(|mutateAttendance|supabase|makeup_bookings/.test(source), 'Export/discard have no remote writer')
console.log('N3 UI hotfix: toolbar order, dedup, dirty/discard guards, canonical filtered XLSX and valid OOXML package PASS')
