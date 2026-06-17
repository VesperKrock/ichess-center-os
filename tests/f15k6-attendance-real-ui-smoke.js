import assert from 'node:assert/strict'

import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import {
  ANGEL_WINGS_TEACHER_ID,
  buildAngelWingsRealDataset,
  mergeAngelWingsTeacherRoster,
} from '../src/attendance-board-angel-wings-data.js'

const dataset = buildAngelWingsRealDataset()
const html = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: '' },
)

assert(!html.includes('Nạp dữ liệu Angel Wings'), 'main UI must not show Angel Wings load tool')
assert(!html.includes('Xóa dữ liệu Angel Wings'), 'main UI must not show Angel Wings clear tool')
assert(!html.includes('Demo cũ đang lưu'), 'main UI must not show legacy demo tool')
assert(!html.includes('Kiểm tra dây dữ liệu'), 'main UI must not show debug lineage panel')
assert(!html.includes('<th>Mã HV</th>'), 'main table must not show student code by default')
assert(!html.includes('Tổng số buổi đã học'), 'main table must not show debug summary columns')
assert(!html.includes('Số buổi còn lại'), 'main table must not show package summary column')
assert(html.includes('data-attendance-cell-detail'), 'attendance cells must open detail modal')
assert(html.includes('>7</span>') && html.includes('>8</span>'), 'combined credit cell should render compact credit chips')
assert(!html.includes('ANGEL WINGS'), 'attendance cells must not show uppercase source text')

const combinedStudent = dataset.students.find((student) => student.fullName === 'Đỗ Minh Tuyết')
assert(combinedStudent, 'expected combined-credit student fixture')

const detailHtml = renderAttendanceBoardModule(
  dataset.students,
  dataset.classSessions,
  dataset.tuitionRecords,
  dataset.sessionReports,
  [],
  { month: '2026-06', classSessionId: 'all', query: 'Đỗ Minh Tuyết' },
  { studentId: combinedStudent.id, dateKey: '2026-06-06' },
)

assert(detailHtml.includes('Chi tiết điểm danh'))
assert(detailHtml.includes('Đỗ Minh Tuyết'))
assert(detailHtml.includes('06/06/2026'))
assert(detailHtml.includes('Học bù / ghi nhận nhiều buổi'))
assert(detailHtml.includes('Phạm Đức Thắng'))
assert(detailHtml.includes('Angel Wings 06/2026'))
assert(detailHtml.includes('Cần kiểm tra học bù'))

const oneTeacherOnly = [dataset.teachers.find((teacher) => teacher.id === ANGEL_WINGS_TEACHER_ID)]
const mergedRoster = mergeAngelWingsTeacherRoster(oneTeacherOnly, dataset.students)
assert(mergedRoster.length > 1, 'teacher roster must be restored when storage only has the Angel Wings teacher')
assert(mergedRoster.some((teacher) => teacher.fullName === 'Phạm Đức Thắng'))
assert(
  mergedRoster.find((teacher) => teacher.id === ANGEL_WINGS_TEACHER_ID)?.assignedStudentIds.length === 29,
  'Angel Wings main teacher should keep linked students',
)

const existingRoster = [{ id: 'teacher-existing', fullName: 'Giáo viên đang có', status: 'active' }]
const preservedRoster = mergeAngelWingsTeacherRoster(existingRoster, dataset.students)
assert(preservedRoster.some((teacher) => teacher.id === 'teacher-existing'), 'existing teachers must be preserved')
assert(preservedRoster.some((teacher) => teacher.id === ANGEL_WINGS_TEACHER_ID), 'Angel Wings teacher link must exist')

console.log('F15K.6 attendance real UI smoke passed')
