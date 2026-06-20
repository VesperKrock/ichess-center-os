import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildStudentFromForm,
  createEditStudentFormState,
  createEmptyStudentFormState,
  getLevelLabel,
  renderStudentModule,
  studentLevelOptions,
} from '../src/student-module.js'
import { renderStudentDetail } from '../src/student-detail.js'
import { normalizeStudentLevel } from '../src/storage.js'

const customLevel = 'Dolphin bổ trợ 1'
const legacyCustomLevel = 'Lớp nền tảng riêng'

for (const standardLevel of ['Dolphin 1', 'Turtle 2', 'Bee 3', 'Jaguar', 'Lion']) {
  assert(studentLevelOptions.includes(standardLevel), `Missing standard level: ${standardLevel}`)
}

assert.equal(getLevelLabel('Dolphin 1'), 'Dolphin 1')
assert.equal(getLevelLabel('Nhập môn'), 'Dolphin 1')
assert.equal(getLevelLabel(customLevel), customLevel)
assert.equal(normalizeStudentLevel(customLevel), customLevel)
assert.equal(normalizeStudentLevel(legacyCustomLevel), legacyCustomLevel)

const builtStudent = buildStudentFromForm({
  fullName: 'Học viên kiểm tra F19A',
  birthDate: '2016-06-19',
  avatarUrl: '',
  assignedTeacherId: '',
  schoolName: 'Trường kiểm tra',
  schoolLevel: 'Cấp 1',
  gender: '',
  hometown: '',
  hobbies: '',
  nationality: 'Việt Nam',
  parentName: 'Phụ huynh kiểm tra',
  parentBirthYear: '',
  fatherPhone: '0901001001',
  motherPhone: '',
  parentJob: '',
  parentArea: '',
  level: customLevel,
  classSessionIds: [],
  testScore: '',
  highestBotMilestone: 'Chưa có',
  personality: '',
  currentStatus: 'Đang theo học',
  achievements: '',
  parentNotes: '',
})

assert.equal(builtStudent.level, customLevel, 'Custom level should be saved on the student')

const editState = createEditStudentFormState({
  id: 'student-f19a-custom',
  ...builtStudent,
  level: customLevel,
})

assert.equal(editState.values.level, customLevel, 'Edit form should preserve the custom level')

const createHtml = renderStudentModule(
  [{ ...builtStudent, id: 'student-a', level: customLevel }],
  { level: 'all' },
  createEmptyStudentFormState(),
)
assert(createHtml.includes('list="student-level-options"'), 'Student level should render as a datalist input')
assert(!createHtml.includes(`<option value="${customLevel}">`), 'Custom level should not become a standard option')

const editHtml = renderStudentModule([], { level: 'all' }, editState)
assert(editHtml.includes(`value="${customLevel}"`), 'Edit form should show the current custom level')
assert(editHtml.includes('value="Dolphin 1"') && editHtml.includes('value="Lion"'), 'Standard options should remain available')
assert(!editHtml.includes(`<option value="${customLevel}">`), 'Edit form should not add the custom level to standard options')

const moduleSource = fs.readFileSync(new URL('../src/student-module.js', import.meta.url), 'utf8')
assert(moduleSource.includes('Chọn hoặc nhập cấp độ riêng'), 'New UI copy should use Vietnamese with accents')

const unsafeLevel = '<img src=x onerror=alert(1)>'
const unsafeStudent = { ...builtStudent, id: 'student-unsafe-level', level: unsafeLevel }
const unsafeListHtml = renderStudentModule([unsafeStudent], { level: 'all' }, null)
const unsafeDetailHtml = renderStudentDetail(unsafeStudent)
assert(!unsafeListHtml.includes(unsafeLevel), 'List should escape custom level HTML')
assert(!unsafeDetailHtml.includes(unsafeLevel), 'Detail should escape custom level HTML')
assert(unsafeListHtml.includes('&lt;img src=x onerror=alert(1)&gt;'))
assert(unsafeDetailHtml.includes('&lt;img src=x onerror=alert(1)&gt;'))

console.log('F19A student custom level smoke passed')
