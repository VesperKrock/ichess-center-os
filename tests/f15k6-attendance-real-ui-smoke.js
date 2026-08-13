import assert from 'node:assert/strict'

import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import { buildAttendanceSharedTruthFixture } from './fixtures/attendance-shared-truth-fixture.js'

const dataset = buildAttendanceSharedTruthFixture()
const html = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
)

assert(!html.includes('Nạp dữ liệu mẫu'), 'main UI must not show local dataset load tool')
assert(!html.includes('Xóa dữ liệu mẫu'), 'main UI must not show local dataset clear tool')
assert(!html.includes('Demo cũ đang lưu'), 'main UI must not show legacy demo tool')
assert(!html.includes('Kiểm tra dây dữ liệu'), 'main UI must not show debug lineage panel')
assert(!html.includes('<th>Mã HV</th>'), 'main table must not show student code by default')
assert(!html.includes('Tổng số buổi đã học'), 'main table must not show debug summary columns')
assert(!html.includes('Số buổi còn lại'), 'main table must not show package summary column')
assert(html.includes('data-attendance-cell-detail'), 'attendance cells must open detail modal')
assert(html.includes('>7</span>') && html.includes('>8</span>'), 'combined credit cell should render compact credit chips')
assert(!html.includes('qa-attendance-import'), 'attendance cells must not expose internal source text')

const combinedStudent = dataset.students.find((student) => student.fullName === 'Hoc vien QA bu hoc')
assert(combinedStudent, 'expected combined-credit student fixture')

const detailHtml = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: 'Hoc vien QA bu hoc' },
  { studentId: combinedStudent.id, dateKey: '2026-06-06' },
)

assert(detailHtml.includes('Chi tiết điểm danh'))
assert(detailHtml.includes('Hoc vien QA bu hoc'))
assert(detailHtml.includes('06/06/2026'))
assert(detailHtml.includes('Học bù / ghi nhận nhiều buổi'))
assert(detailHtml.includes('Giao vien QA'))
assert(detailHtml.includes('Báo cáo buổi học'))
assert(detailHtml.includes('Can kiem tra hoc bu.'))

console.log('F15K.6 attendance real UI smoke passed')
