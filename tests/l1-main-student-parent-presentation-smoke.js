import assert from 'node:assert/strict'
import { getStudentListParentDisplay, getFilteredStudents, initialStudentFilters, renderStudentModule } from '../src/student-module.js'

const base = { id: 'l1-main-fixture', fullName: 'Bé An', currentStatus: 'Đang theo học', classSessionIds: [] }
const cases = [
  [{ parentName: 'Thanh Hà', fatherName: 'Thanh Hà' }, 'Ba Thanh Hà'],
  [{ parentName: 'Hoàng Vân', motherName: 'Hoàng Vân' }, 'Mẹ Hoàng Vân'],
  [{ parentName: 'Nguyễn Thanh Hà', fatherName: 'Nguyễn Thanh Hà' }, 'Ba Nguyễn Thanh Hà'],
  [{ parentName: 'Dạ Thảo', gender: 'female' }, 'Dạ Thảo'],
  [{ parentName: 'Minh Thy', gender: 'male' }, 'Minh Thy'],
  [{ fatherName: 'Thanh Hà' }, ''],
  [{ parentName: '  ' }, ''],
  [{ parentName: 'Thanh Hà', fatherName: 'Người khác' }, 'Thanh Hà'],
  [{ parentName: 'Thanh Hà', fatherName: 'Thanh Hà', motherName: 'Thanh Hà' }, 'Thanh Hà'],
]
for (const [fields, expected] of cases) {
  const fixture = { ...base, ...fields }
  const original = structuredClone(fixture)
  assert.equal(getStudentListParentDisplay(fixture), expected)
  assert(renderStudentModule([fixture], initialStudentFilters, null, [], []).includes(`>${expected}</td>`))
  assert.deepEqual(fixture, original)
}
const father = { ...base, ...cases[2][0], parentPhone: '0901234567' }
for (const query of ['Thanh Hà', 'Nguyễn Thanh Hà', 'thanh ha', '090123']) {
  assert.deepEqual(getFilteredStudents([father], { ...initialStudentFilters, query }).map(s => s.id), [base.id])
}
for (const query of ['123', 'male', '090123abc']) {
  assert.deepEqual(getFilteredStudents([father], { ...initialStudentFilters, query }), [])
}
assert(renderStudentModule([{ ...base, parentName: '<img src=x>' }], initialStudentFilters, null, [], []).includes('>&lt;img src=x&gt;</td>'))
console.log('L1 main Student parent presentation: PASS')
