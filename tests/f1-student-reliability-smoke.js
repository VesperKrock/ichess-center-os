import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mutateV22StudentWithEnrollments } from '../src/cloud-authoritative-student-enrollments.js'
import {
  buildStudentFromForm,
  createEditStudentFormState,
  initialStudentFilters,
  mergeStudentFormControlValues,
  renderStudentModule,
} from '../src/student-module.js'

const original = {
  id: 'student-f1',
  fullName: 'F1 Student',
  birthDate: '2014-01-02',
  schoolName: 'F1 School',
  level: 'Dolphin 1',
  parentName: 'Guardian Before',
  motherPhone: '0901001001',
  parentArea: 'Area Before',
  currentStatus: 'Đang theo học',
  recurringEnrollments: [],
  enrollmentVersion: 3,
  useAuthoritativeEnrollment: true,
  cloudVersion: 7,
}
const state = createEditStudentFormState(original)
const editMarkup = renderStudentModule(
  [original],
  initialStudentFilters,
  { ...state, step: 2 },
  [],
  [],
  { enrollmentCapabilityStatus: 'ready' },
)
assert(editMarkup.includes('data-student-id="student-f1"'))
assert(editMarkup.includes('data-student-form-field="parentName"'))
assert(editMarkup.includes('value="Guardian Before"'))
assert(editMarkup.includes('data-student-form-field="motherPhone"'))
assert(editMarkup.includes('data-student-form-field="parentArea"'))
const controls = [
  { dataset: { studentFormField: 'parentName' }, value: 'Guardian After' },
  { dataset: { studentFormField: 'motherPhone' }, value: '0909 222 333' },
  { dataset: { studentFormField: 'parentArea' }, value: 'Area After' },
  { dataset: { studentFormField: 'unknownField' }, value: 'must be ignored' },
]

// Reproduces the reported boundary: visible controls can contain the final
// edit while the event-backed form state still contains the previous values.
assert.equal(state.values.parentName, 'Guardian Before')
const submittedValues = mergeStudentFormControlValues(state.values, controls)
assert.equal(submittedValues.parentName, 'Guardian After')
assert.equal(submittedValues.motherPhone, '0909 222 333')
assert.equal(submittedValues.parentArea, 'Area After')
assert.equal(submittedValues.unknownField, undefined)

const submittedStudent = buildStudentFromForm(submittedValues, original)
assert.equal(submittedStudent.parentName, 'Guardian After')
assert.equal(submittedStudent.motherPhone, '0909 222 333')
assert.equal(submittedStudent.parentPhone, '0909 222 333')
assert.equal(submittedStudent.parentArea, 'Area After')
assert.equal(submittedStudent.id, original.id)
assert.equal(submittedStudent.fullName, original.fullName)
assert.deepEqual(submittedStudent.recurringEnrollments, original.recurringEnrollments)

let authoritativePayload = null
const sameCenterClient = {
  async rpc(name, params) {
    assert.equal(name, 'v2_2_mutate_student_with_enrollments')
    assert.equal(params.p_center_id, 'center-f1')
    authoritativePayload = structuredClone(params.p_student_payload)
    return {
      error: null,
      data: {
        ok: true,
        outcome_code: 'COMMITTED',
        center_id: 'center-f1',
        student_local_id: submittedStudent.id,
        student_version: 8,
        student_updated_at: '2026-09-19T00:00:00.000Z',
        student_payload: authoritativePayload,
        enrollment_set: {
          student_id: submittedStudent.id,
          version: 4,
          enrollments: [],
        },
      },
    }
  },
}
const committed = await mutateV22StudentWithEnrollments({
  supabase: sameCenterClient,
  centerId: 'center-f1',
  student: submittedStudent,
  enrollments: [],
  expectedEnrollmentVersion: 3,
  idempotencyKey: '00000000-0000-4000-8000-0000000000f1',
})
assert.equal(committed.ok, true)
assert.equal(authoritativePayload.parentName, 'Guardian After')
assert.equal(authoritativePayload.motherPhone, '0909 222 333')
assert.equal(authoritativePayload.parentArea, 'Area After')
assert.equal(committed.student.parentName, 'Guardian After')
assert.equal(committed.student.motherPhone, '0909 222 333')
assert.equal(committed.student.parentArea, 'Area After')
assert.equal(committed.student.cloudVersion, 8)

const wrongCenter = await mutateV22StudentWithEnrollments({
  supabase: {
    async rpc() {
      return { data: null, error: { message: 'v2_2_center_access_denied' } }
    },
  },
  centerId: 'other-center',
  student: submittedStudent,
  enrollments: [],
  expectedEnrollmentVersion: 3,
  idempotencyKey: '00000000-0000-4000-8000-0000000000f2',
})
assert.equal(wrongCenter.ok, false)
assert.equal(wrongCenter.outcome_code, 'CENTER_ACCESS_DENIED')

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const themeSource = readFileSync(new URL('../src/student-theme.css', import.meta.url), 'utf8')
assert(mainSource.includes("document.querySelectorAll('[data-student-form-field]')"))
assert(mainSource.includes('mergeStudentFormControlValues('))
for (const marker of [
  'color-scheme: light;',
  "data-ui-theme='dark'",
  '.student-form-panel select option',
  '.student-form-panel select option:checked',
  ":not([type='checkbox']):not([type='radio']):focus",
  '.student-form-panel input:read-only',
]) assert(themeSource.includes(marker), `Missing Student readability marker: ${marker}`)

console.log('F1_STUDENT_RELIABILITY_SMOKE: PASS')
