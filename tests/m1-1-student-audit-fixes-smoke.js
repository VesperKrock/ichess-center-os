import assert from 'node:assert/strict'
import { getStudentAge } from '../src/student-birth-information.js'
import { renderStudentDetail } from '../src/student-detail.js'
import { getFilteredStudents, initialStudentFilters, renderStudentModule } from '../src/student-module.js'

let checks = 0
function check(name, run) {
  run()
  checks += 1
  console.log(`PASS ${name}`)
}

const first = {
  id: 'student-1',
  fullName: 'Minh An',
  parentName: 'Phụ huynh mẫu 1',
  parentPhone: '0000 010 001',
  schoolName: 'Trường Tiểu học Cờ Vua Mẫu',
  birthDate: '2013-12-19',
  currentStatus: 'Đang học',
}
const second = {
  ...first,
  id: 'student-2',
  fullName: 'Bảo Ngọc',
  parentName: 'Phụ huynh mẫu 2',
  parentPhone: '0000 010 011',
  schoolName: 'Trường Khác',
  birthDate: '',
  birthYear: '2018',
}
const students = [first, second]

check('full DOB respects before, on and after birthday', () => {
  assert.equal(getStudentAge(first.birthDate, new Date(2026, 9, 3)), 12)
  assert.equal(getStudentAge(first.birthDate, new Date(2026, 11, 18)), 12)
  assert.equal(getStudentAge(first.birthDate, new Date(2026, 11, 19)), 13)
  assert.equal(getStudentAge(first.birthDate, new Date(2026, 11, 20)), 13)
  assert.equal(getStudentAge(''), null)
})

check('list and detail agree for full DOB while year-only and unknown have no age', () => {
  const expectedAge = getStudentAge(first.birthDate)
  const list = renderStudentModule(students, initialStudentFilters, null)
  const detail = renderStudentDetail(first)
  assert(list.includes(`${expectedAge} tuổi`))
  assert(detail.includes(`${expectedAge} tuổi`))
  assert(list.includes('2018'))
  assert(!list.includes('2018 ·'))
  const yearIdentity = renderStudentDetail(second).match(/student-detail-identity-meta">([^<]*)/)
  assert(yearIdentity)
  assert(!yearIdentity[1].includes('tuổi'))
  const unknown = { ...second, id: 'unknown', birthYear: '' }
  assert(!renderStudentModule([unknown], initialStudentFilters, null).includes('tuổi'))
})

check('incidental digit in parent text does not match unrelated phone digits', () => {
  assert.deepEqual(
    getFilteredStudents(students, { ...initialStudentFilters, query: 'Phụ huynh mẫu 1' }).map((student) => student.id),
    ['student-1'],
  )
  assert.deepEqual(
    getFilteredStudents(students, { ...initialStudentFilters, query: '0000 010 011' }).map((student) => student.id),
    ['student-2'],
  )
  assert.deepEqual(
    getFilteredStudents(students, { ...initialStudentFilters, query: '0000010011' }).map((student) => student.id),
    ['student-2'],
  )
  assert.deepEqual(
    getFilteredStudents(students, { ...initialStudentFilters, query: 'Minh An' }).map((student) => student.id),
    ['student-1'],
  )
  assert.deepEqual(
    getFilteredStudents(students, { ...initialStudentFilters, query: 'Trường Tiểu học Cờ Vua Mẫu' }).map((student) => student.id),
    ['student-1'],
  )
})

check('empty center and filtered-zero results have distinct messages and keep add action', () => {
  const empty = renderStudentModule([], initialStudentFilters, null)
  assert(empty.includes('Chưa có học viên tại cơ sở này.'))
  assert(empty.includes('data-student-action="open-create"'))
  assert(!empty.includes('Không tìm thấy học viên phù hợp với bộ lọc hiện tại.'))
  assert(renderStudentModule([], { ...initialStudentFilters, sortBy: 'student' }, null)
    .includes('Chưa có học viên tại cơ sở này.'))
  const filteredEmpty = renderStudentModule([], { ...initialStudentFilters, query: 'không có' }, null)
  assert(filteredEmpty.includes('Không tìm thấy học viên phù hợp với bộ lọc hiện tại.'))
  assert(renderStudentModule([], { ...initialStudentFilters, status: 'Bảo lưu' }, null)
    .includes('Không tìm thấy học viên phù hợp với bộ lọc hiện tại.'))
  const filteredExisting = renderStudentModule(students, { ...initialStudentFilters, query: 'không có' }, null)
  assert(filteredExisting.includes('Không tìm thấy học viên phù hợp với bộ lọc hiện tại.'))
})

console.log(`M1.1 Student audit fixes: ${checks} checks passed`)
