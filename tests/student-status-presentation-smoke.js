import assert from 'node:assert/strict'
import { studentStatuses } from '../src/student-data.js'
import { getStudentStatusPresentation } from '../src/student-status-presentation.js'
import { createEditStudentFormState, getFilteredStudents, initialStudentFilters, renderStudentModule } from '../src/student-module.js'
import { renderStudentDetail } from '../src/student-detail.js'
import { getStudentNextAction } from '../src/student-overview.js'
import { createCustomerInformationPrintSnapshot } from '../src/customer-information-print-module.js'

let checks = 0
const test = (label, run) => { run(); checks++; console.log(`PASS ${label}`) }
const base = Object.freeze({ id: 'legacy-status', fullName: 'DEMO - Legacy status', parentName: 'QA Parent',
  parentPhone: '0000010001', motherPhone: '', fatherPhone: '', schoolName: 'QA School', level: 'Dolphin 1',
  birthDate: '', birthYear: '2018', classSessionIds: [], careNotes: [] })
const badge = markup => markup.match(/class="student-status[^"\n]*">([^<]*)<\/span>/)?.[1]
const detailBadge = markup => markup.match(/class="student-detail-status-badge[^"\n]*"[^>]*>([^<]*)<\/span>/)?.[1]
const statusOption = (student) => {
  const form = renderStudentModule([student], initialStudentFilters, createEditStudentFormState(student))
  return form.match(/<select[^>]*data-student-form-field="currentStatus"[^>]*>([\s\S]*?)<\/select>/)?.[1]
    ?.match(/<option value="([^"]*)" selected/)[1]
}

test('all three valid lifecycle labels retain their exact value and precedence', () => {
  for (const status of studentStatuses) assert.equal(getStudentStatusPresentation({ currentStatus: status, status: 'active' }), status)
  assert.equal(getStudentStatusPresentation({ currentStatus: 'Ngưng học', status: 'Đang theo học' }), 'Ngưng học')
})
test('observed legacy active rows use the established Student edit fallback', () => {
  for (const currentStatus of [undefined, null, '']) assert.equal(getStudentStatusPresentation({ currentStatus, status: 'active' }), 'Đang theo học')
  assert.equal(getStudentStatusPresentation({}), 'Đang theo học')
})
test('unmapped enums and technical placeholders never become a status label', () => {
  for (const currentStatus of ['undefined', 'null', 'UNKNOWN_ENUM', 'LEGACY_V1', '<script>bad</script>', 0]) {
    assert(studentStatuses.includes(getStudentStatusPresentation({ currentStatus })))
  }
})
test('recognized legacy lifecycle labels remain human-readable', () => {
  for (const status of studentStatuses) assert.equal(getStudentStatusPresentation({ status }), status)
})
test('Student list renders safe status badges for legacy, null and unmapped values', () => {
  for (const currentStatus of [undefined, null, '', 'undefined', 'null', 'UNKNOWN_ENUM', ...studentStatuses]) {
    const student = { ...base, currentStatus, status: 'active' }
    assert.equal(badge(renderStudentModule([student], initialStudentFilters)), getStudentStatusPresentation(student))
  }
})
test('Student detail and overview lifecycle titles contain only existing human labels', () => {
  for (const currentStatus of [undefined, null, '', 'undefined', 'null', 'UNKNOWN_ENUM', ...studentStatuses]) {
    const student = { ...base, currentStatus, status: 'active' }
    assert.equal(detailBadge(renderStudentDetail(student)), getStudentStatusPresentation(student))
    if (currentStatus !== 'Đang theo học') assert.equal(getStudentNextAction(student).title, getStudentStatusPresentation(student))
  }
})
test('edit status selects the same safe existing label without changing the original Student', () => {
  for (const currentStatus of [undefined, null, '', 'UNKNOWN_ENUM', ...studentStatuses]) {
    const student = Object.freeze({ ...base, currentStatus, status: 'active' })
    const original = JSON.stringify(student)
    assert.equal(statusOption(student), getStudentStatusPresentation(student))
    assert.equal(JSON.stringify(student), original)
  }
})
test('list status filters and counters agree with displayed canonical/legacy labels', () => {
  const students = [{ ...base, id: 'legacy', status: 'active' }, { ...base, id: 'paused', currentStatus: 'Bảo lưu' },
    { ...base, id: 'stopped', currentStatus: 'Ngưng học' }]
  for (const [status, id] of [['Đang theo học','legacy'],['Bảo lưu','paused'],['Ngưng học','stopped']]) {
    assert.deepEqual(getFilteredStudents(students, { ...initialStudentFilters, status }).map(s=>s.id), [id])
  }
  const markup=renderStudentModule(students,initialStudentFilters)
  for(const label of ['Đang học','Bảo lưu','Ngưng']) assert(new RegExp(`<span>${label}</span>\\s*<strong>1</strong>`).test(markup))
})
test('presentation does not change existing next-action keys or financial priorities', () => {
  assert.equal(getStudentNextAction({ ...base, status: 'active' }).key, 'not-studying')
  assert.equal(getStudentNextAction({ ...base, currentStatus: 'Đang theo học' }).key, 'assign-class')
  assert.equal(getStudentNextAction({ ...base, currentStatus: 'Bảo lưu' }, [], {financeAvailable:true,debtAmount:10}).key,'settlement-review')
})
test('linked Student print projection uses human status labels without changing contact or Student data', () => {
  for (const currentStatus of [undefined, null, 'UNKNOWN_ENUM', ...studentStatuses]) {
    const student=Object.freeze({...base,currentStatus,status:'active'})
    const contact=Object.freeze({canonicalContactId:'qa-contact',relatedStudents:[student],parentStudentLinks:[]})
    const original=JSON.stringify(contact)
    const snapshot=createCustomerInformationPrintSnapshot({centerId:'qa-center',contact})
    assert.equal(snapshot.relatedStudents[0].status,getStudentStatusPresentation(student))
    assert.equal(snapshot.relatedStudents[0].birthDate,'2018')
    assert.equal(JSON.stringify(contact),original)
  }
})
test('full, year-only and unknown birth values remain unchanged across status presentation', () => {
  for (const birth of [{birthDate:'2018-09-29',birthYear:''},{birthDate:'',birthYear:'2018'},{birthDate:'',birthYear:''}]) {
    const student=Object.freeze({...base,...birth,status:'active'})
    const original=JSON.stringify(student)
    const form=createEditStudentFormState(student)
    assert.equal(form.values.birthDate,birth.birthDate);assert.equal(form.values.birthYear,birth.birthYear)
    renderStudentModule([student],initialStudentFilters);renderStudentDetail(student)
    assert.equal(JSON.stringify(student),original)
  }
})
console.log(`STUDENT_STATUS_PRESENTATION_SMOKE: PASS (${checks} checks)`)
