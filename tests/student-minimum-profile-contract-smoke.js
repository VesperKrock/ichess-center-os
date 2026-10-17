import assert from 'node:assert/strict'
import { buildStudentFromForm, createEmptyStudentFormState, createEditStudentFormState,
  validateStudentForm, getLevelLabel, renderStudentModule, initialStudentFilters } from '../src/student-module.js'
import { renderStudentDetail } from '../src/student-detail.js'
import { normalizeStudentLevel } from '../src/storage.js'
import { projectAuthoritativeCoreRecord } from '../src/cloud-authoritative-core.js'
import { projectStudentsWithV22Enrollments } from '../src/student-recurring-enrollment.js'

const values = { ...createEmptyStudentFormState().values, fullName: 'Profile Contract Fixture',
  birthYearOnly: true, birthYear: '2018', schoolName: '', level: '',
  motherName: 'Fixture Guardian', motherPhone: '0000000000',
  useAuthoritativeEnrollment: true, recurringEnrollments: [] }
assert.deepEqual(validateStudentForm(values), {})
assert.equal(createEmptyStudentFormState().values.level, '')
for (const missing of [undefined, null, '', '  ']) {
  assert.equal(getLevelLabel(missing), '')
  assert.equal(normalizeStudentLevel(missing), '')
}
const student = { ...buildStudentFromForm(values), id: 'profile-contract' }
assert.equal(student.schoolName, '')
assert.equal(student.level, '')
assert.equal(student.birthDate, '')
assert.equal(student.birthYear, '2018')
assert.equal(student.motherName, values.motherName)
assert.equal(student.parentName, values.motherName)
assert.equal(student.motherPhone.replace(/\D/g, ''), values.motherPhone)
assert.deepEqual(validateStudentForm(createEditStudentFormState(student).values), {})
const projected = projectStudentsWithV22Enrollments([
  projectAuthoritativeCoreRecord({ payload: student, entity_version: 1 }),
], [{ studentId: student.id, version: 1, enrollments: [] }], [], true)[0]
assert.equal(projected.level, '')
assert.equal(projected.schoolName, '')
assert.equal(projected.motherName, values.motherName)
assert.equal(projected.motherPhone.replace(/\D/g, ''), values.motherPhone)
const list = renderStudentModule([projected], initialStudentFilters, null)
const detail = renderStudentDetail(projected)
assert(!list.split('<tbody>')[1].split('</tbody>')[0].includes('Dolphin 1'))
assert(!detail.includes('Dolphin 1'))
assert(list.includes(values.motherName))
assert(detail.includes(values.motherName))
assert(detail.includes('student-detail-level-badge">—</span>'))
const form = renderStudentModule([student], initialStudentFilters, createEditStudentFormState(student), [], [], { enrollmentCapabilityStatus: 'ready' })
assert(!form.includes('Tên trường *'))
assert(!form.includes('Cấp độ học *'))
assert(/value=""\s+data-student-form-field="level"/.test(form))
assert(validateStudentForm({ ...values, fullName: '' }).fullName)
assert(validateStudentForm({ ...values, birthYear: '' }).birthYear)
assert(validateStudentForm({ ...values, birthYearOnly: false, birthYear: '', birthDate: '' }).birthDate)
assert(validateStudentForm({ ...values, birthYearOnly: false, birthYear: '2018', birthDate: '' }).birthDate)
assert.deepEqual(validateStudentForm({ ...values, motherName: '', motherPhone: '' }), {})
assert(validateStudentForm({ ...values, motherPhone: '123' }).motherPhone)
assert(validateStudentForm({ ...values, motherName: '' }).motherName)
assert(validateStudentForm({ ...values, motherName: '', motherPhone: '', parentName: 'Legacy Guardian', parentPhone: '123' }).parentPhone)
assert.deepEqual(validateStudentForm({ ...values, motherName: '', motherPhone: '', fatherName: 'Fixture Father', fatherPhone: '0000000000' }), {})
assert.equal(getLevelLabel('Nhập môn'), 'Dolphin 1')
assert.equal(getLevelLabel('Custom course'), 'Custom course')
console.log('Student minimum profile contract: PASS (optional school/level/contact, truthful projection, required name/birth, partial contacts rejected, existing levels)')
