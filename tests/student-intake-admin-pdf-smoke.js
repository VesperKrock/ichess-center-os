import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  buildStudentFromForm,
  createEditStudentFormState,
  createEmptyStudentFormState,
  initialStudentFilters,
  renderStudentModule,
  validateStudentForm,
} from '../src/student-module.js'
import { renderStudentDetail } from '../src/student-detail.js'
import {
  STUDENT_INTAKE_ADMIN_TEMPLATE_SHA256,
  StudentIntakePdfValidationError,
  createStudentIntakeAdminOverlayPlan,
  createStudentIntakeAdminPdfProjection,
} from '../src/student-intake-admin-pdf.js'

const fixture = {
  id: 'student-intake-fixture',
  fullName: 'Nguyễn Gia Bảo',
  birthDate: '2018-03-12',
  schoolName: 'Nguyễn Du',
  schoolGrade: 'Lớp 2',
  homeName: 'Bắp',
  gender: 'male',
  registrationDate: '2026-09-23',
  priorChessKnowledge: 'known',
  hobbies: 'Cờ vua, Lego',
  personality: 'Bé vui vẻ, tập trung và thích khám phá cách giải mới.',
  parentGoal: 'Rèn tư duy logic, tính kiên nhẫn và sự tự tin cho bé.',
  fatherName: 'Nguyễn Văn An',
  fatherPhone: '0901001001',
  motherName: 'Trần Thị Bích',
  motherPhone: '0902002002',
  parentArea: 'Quận 3, TP.HCM',
  parentName: 'Trần Thị Bích',
  parentPhone: '0902 002 002',
  parentBirthYear: 1987,
  parentJob: 'Kiến trúc sư',
  schoolLevel: 'Cấp 1',
  hometown: 'TP.HCM',
  nationality: 'Việt Nam',
  level: 'Dolphin 1',
  currentStatus: 'Đang theo học',
  highestBotMilestone: 'Chưa có',
  classSessionIds: [],
  recurringEnrollments: [],
  testScore: 8,
  achievements: 'Hoàn thành bài tập đầu vào.',
  parentNotes: 'Phụ huynh muốn theo dõi tiến độ sát hơn.',
}

const templateBytes = await readFile(
  new URL('../public/forms/student-intake/student-information-admin-template.pdf', import.meta.url),
)
assert.equal(createHash('sha256').update(templateBytes).digest('hex'), STUDENT_INTAKE_ADMIN_TEMPLATE_SHA256)

const emptyState = createEmptyStudentFormState()
const stepOneMarkup = renderStudentModule([], initialStudentFilters, emptyState, [], [])
assert.match(stepOneMarkup, /data-student-form-field="homeName"/)
assert.match(stepOneMarkup, /data-student-form-field="schoolGrade"/)
assert.match(stepOneMarkup, /data-student-form-field="registrationDate"/)
assert.match(stepOneMarkup, /data-student-form-field="priorChessKnowledge"/)
assert.match(stepOneMarkup, /data-student-form-field="parentGoal"/)
assert.match(stepOneMarkup, /data-student-form-field="currentStatus"/)
assert.match(stepOneMarkup, /data-student-form-field="testScore"/)

const stepTwoMarkup = renderStudentModule(
  [],
  initialStudentFilters,
  { ...emptyState, step: 2 },
  [],
  [],
)
assert.match(stepTwoMarkup, /data-student-form-field="fatherName"/)
assert.match(stepTwoMarkup, /data-student-form-field="fatherPhone"/)
assert.match(stepTwoMarkup, /data-student-form-field="motherName"/)
assert.match(stepTwoMarkup, /data-student-form-field="motherPhone"/)
assert.match(stepTwoMarkup, /data-student-form-field="parentArea"/)
assert.match(stepTwoMarkup, /data-student-form-field="achievements"/)
assert.match(stepTwoMarkup, /data-student-form-field="parentNotes"/)
assert.doesNotMatch(stepTwoMarkup, /data-student-form-field="parentBirthYear"/)
assert.doesNotMatch(stepTwoMarkup, /data-student-form-field="parentJob"/)
assert.doesNotMatch(stepTwoMarkup, /data-student-form-field="parentName"/)

const editState = createEditStudentFormState(fixture)
for (const key of [
  'homeName',
  'schoolGrade',
  'registrationDate',
  'priorChessKnowledge',
  'parentGoal',
  'fatherName',
  'motherName',
]) {
  assert.equal(editState.values[key], fixture[key])
}
assert.equal(editState.values.currentStatus, fixture.currentStatus)
assert.equal(editState.values.parentNotes, fixture.parentNotes)

const rebuilt = buildStudentFromForm(editState.values, fixture)
const reopened = createEditStudentFormState(rebuilt)
for (const key of [
  'homeName',
  'schoolGrade',
  'registrationDate',
  'priorChessKnowledge',
  'parentGoal',
  'fatherName',
  'motherName',
]) {
  assert.equal(reopened.values[key], fixture[key])
}
assert.equal(rebuilt.parentBirthYear, fixture.parentBirthYear)
assert.equal(rebuilt.parentJob, fixture.parentJob)
assert.equal(rebuilt.currentStatus, fixture.currentStatus)
assert.equal(rebuilt.parentNotes, fixture.parentNotes)
assert.equal(rebuilt.parentName, fixture.motherName)
assert.equal(rebuilt.parentPhone, '0902 002 002')

const validBase = {
  ...emptyState.values,
  fullName: fixture.fullName,
  birthDate: fixture.birthDate,
  schoolName: fixture.schoolName,
  level: fixture.level,
}
assert.deepEqual(validateStudentForm({ ...validBase, fatherName: 'Ba Bảo', fatherPhone: '0901001001' }), {})
assert.deepEqual(validateStudentForm({ ...validBase, motherName: 'Mẹ Bảo', motherPhone: '0902002002' }), {})
assert.deepEqual(
  validateStudentForm({
    ...validBase,
    fatherName: 'Ba Bảo',
    fatherPhone: '0901001001',
    motherName: 'Mẹ Bảo',
    motherPhone: '0902002002',
  }),
  {},
)
assert.ok(validateStudentForm(validBase).motherPhone)
assert.ok(validateStudentForm({ ...validBase, fatherPhone: '0901001001' }).fatherName)
assert.ok(validateStudentForm({ ...validBase, motherName: 'Mẹ Bảo' }).motherPhone)

const createdWithFatherOnly = buildStudentFromForm({
  ...validBase,
  homeName: fixture.homeName,
  schoolGrade: fixture.schoolGrade,
  registrationDate: fixture.registrationDate,
  priorChessKnowledge: fixture.priorChessKnowledge,
  parentGoal: fixture.parentGoal,
  fatherName: fixture.fatherName,
  fatherPhone: fixture.fatherPhone,
})
assert.equal(createdWithFatherOnly.parentName, fixture.fatherName)
assert.equal(createdWithFatherOnly.parentPhone, '0901 001 001')
assert.equal(createEditStudentFormState(createdWithFatherOnly).values.parentGoal, fixture.parentGoal)

const createdWithMotherOnly = buildStudentFromForm({
  ...validBase,
  motherName: fixture.motherName,
  motherPhone: fixture.motherPhone,
})
assert.equal(createdWithMotherOnly.parentName, fixture.motherName)
assert.equal(createdWithMotherOnly.parentPhone, '0902 002 002')

const legacy = {
  ...fixture,
  id: 'legacy-student',
  fatherName: undefined,
  motherName: undefined,
  parentName: 'Phụ huynh cũ',
  parentPhone: '',
  motherPhone: '0903 003 003',
}
const legacyState = createEditStudentFormState(legacy)
assert.equal(legacyState.values.motherName, '')
assert.equal(legacyState.values.motherPhone, '0903 003 003')
assert.deepEqual(validateStudentForm(legacyState.values), {})
const legacyRebuilt = buildStudentFromForm(legacyState.values, legacy)
assert.equal(legacyRebuilt.parentName, 'Phụ huynh cũ')
assert.equal(legacyRebuilt.parentPhone, '0903 003 003')

const projection = createStudentIntakeAdminPdfProjection(fixture)
assert.equal(projection.fullName, 'Nguyễn Gia Bảo')
assert.equal(projection.birthDate, '12/03/2018')
assert.equal(projection.registrationDate, '23/09/2026')
assert.equal(projection.gender, 'male')
assert.equal(projection.priorChessKnowledge, 'known')
const approximateTimesMeasure = (value) => Array.from(String(value)).length * 6.2
const plan = createStudentIntakeAdminOverlayPlan(projection, approximateTimesMeasure)
assert.ok(plan.some((command) => command.type === 'mark' && command.x < 410))
assert.ok(plan.some((command) => command.type === 'mark' && command.x > 300 && command.baseline > 300))
assert.ok(plan.some((command) => command.value.includes('Nguyễn Gia Bảo')))
assert.ok(plan.every((command) => !['Trống', 'N/A', 'Không có'].includes(command.value)))

const blankOptionalProjection = createStudentIntakeAdminPdfProjection({
  id: 'blank-optionals',
  fullName: 'Bé An',
  birthDate: '2018-03-12',
  schoolName: 'Nguyễn Du',
})
const blankPlan = createStudentIntakeAdminOverlayPlan(blankOptionalProjection, approximateTimesMeasure)
assert.ok(blankPlan.every((command) => !['mark'].includes(command.type)))
assert.equal(blankPlan.length, 3)

assert.throws(
  () => createStudentIntakeAdminOverlayPlan(
    { ...projection, fullName: 'Nguyễn '.repeat(40) },
    approximateTimesMeasure,
  ),
  (error) => error instanceof StudentIntakePdfValidationError && error.field === 'fullName',
)
assert.throws(
  () => createStudentIntakeAdminOverlayPlan(
    { ...projection, schoolName: 'Trường '.repeat(40) },
    approximateTimesMeasure,
  ),
  (error) => error instanceof StudentIntakePdfValidationError && error.field === 'schoolName',
)
assert.throws(
  () => createStudentIntakeAdminOverlayPlan(
    { ...projection, personality: 'Nội dung '.repeat(200) },
    approximateTimesMeasure,
  ),
  (error) => error instanceof StudentIntakePdfValidationError && error.field === 'personality',
)

const detailMarkup = renderStudentDetail(fixture, [], [], [])
assert.match(detailMarkup, /data-student-detail-action="export-intake-pdf"/)
assert.match(detailMarkup, />\s*In \/ Xuất PDF\s*</)

console.log('Student Intake Admin form/PDF smoke: PASS')
