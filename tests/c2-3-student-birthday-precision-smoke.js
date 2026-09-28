import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildStudentFromForm, createEmptyStudentFormState, createEditStudentFormState,
  getFilteredStudents, initialStudentFilters, renderStudentModule, validateStudentForm,
} from '../src/student-module.js'
import { renderStudentDetail } from '../src/student-detail.js'
import {
  buildStudentBirthFields, formatStudentBirthInformation, getBirthdayLocalDateKey,
  getStudentBirthInformation, setStudentBirthYearOnly, validateStudentBirthFields,
} from '../src/student-birth-information.js'
import {
  buildStudentBirthdayNotificationCandidates, buildStudentBirthdayMonthNotificationCandidates,
  filterNotifications, markNotificationReadById, pruneExpiredStudentBirthdayNotifications,
  tagNotificationCandidates, upsertNotificationCandidates,
} from '../src/notification-center.js'
import { renderNotificationAssistantPanel } from '../src/notification-assistant-panel.js'
import { createStudentIntakeAdminPdfProjection } from '../src/student-intake-admin-pdf.js'
import { mutateV22StudentWithEnrollments } from '../src/cloud-authoritative-student-enrollments.js'
import { createCustomerInformationPrintSnapshot } from '../src/customer-information-print-module.js'

let checks = 0
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`) }
const centerId = 'phongtrong_prod'
const now = new Date('2026-09-29T05:00:00Z')
const base = { ...createEmptyStudentFormState().values, fullName: 'QA Minh An', schoolName: 'QA School',
  motherName: 'QA Parent', motherPhone: '0901001001', recurringEnrollments: [], useAuthoritativeEnrollment: true }
const full = buildStudentFromForm({ ...base, birthDate: '2018-09-29' })
const year = buildStudentFromForm({ ...base, birthYearOnly: true, birthYear: '2018' })
const unknown = buildStudentFromForm(base)
check('create full/year/unknown without a sentinel date or browser-only precision state', () => {
  assert.equal(full.birthDate, '2018-09-29'); assert.equal(full.birthYear, '')
  assert.equal(year.birthDate, ''); assert.equal(year.birthYear, '2018')
  assert(!('birthYearOnly' in year)); assert(!('birthYearOnly' in full))
  assert.equal(unknown.birthDate, ''); assert.equal(unknown.birthYear, '')
  for (const student of [full, year, unknown]) assert.deepEqual(validateStudentForm(createEditStudentFormState(student).values), {})
})
check('unchanged full DOB including real 01 January preserves exact date', () => {
  for (const date of ['2018-09-17', '2018-01-01', '2020-02-29']) {
    const original = { ...full, birthDate: date }
    assert.equal(buildStudentFromForm(createEditStudentFormState(original).values, original).birthDate, date)
    assert.equal(getStudentBirthInformation(original).kind, 'full')
  }
})
check('edit full and year; switching precision is explicit and clears the other canonical field', () => {
  assert.equal(buildStudentFromForm({ ...createEditStudentFormState(full).values, birthDate: '2018-09-17' }, full).birthDate, '2018-09-17')
  assert.equal(buildStudentFromForm({ ...createEditStudentFormState(year).values, birthYear: '2019' }, year).birthYear, '2019')
  const toYear = setStudentBirthYearOnly(createEditStudentFormState(full).values, true)
  assert.equal(toYear.birthYear, '2018'); assert.equal(buildStudentFromForm(toYear, full).birthDate, '')
  const toFull = { ...setStudentBirthYearOnly(createEditStudentFormState(year).values, false), birthDate: '2018-09-17' }
  assert.deepEqual(buildStudentBirthFields(toFull), { birthDate: '2018-09-17', birthYear: '' })
  assert.equal(buildStudentFromForm(toFull, year).birthYear, '')
})
check('invalid/impossible/future birth inputs rejected; unknown allowed', () => {
  for (const birthYear of ['', '18', '0201', '1899', '2027', '201x', '20180']) assert(validateStudentBirthFields({ birthYearOnly: true, birthYear }, now).birthYear)
  for (const birthDate of ['2018-02-30', '2018-13-01', '2026-09-30', '17/09/2018', '2018']) assert(validateStudentBirthFields({ birthDate }, now).birthDate)
  assert.deepEqual(validateStudentBirthFields({ birthDate: '' }, now), {})
})
check('list, detail and existing Student PDF show year only without invented age/date', () => {
  assert.equal(formatStudentBirthInformation(year), '2018')
  assert.equal(formatStudentBirthInformation(full), '29/09/2018')
  assert.equal(formatStudentBirthInformation(unknown), '—')
  const list = renderStudentModule([year], initialStudentFilters, null)
  const detail = renderStudentDetail(year)
  assert.match(list, /<span>2018<\/span>/); assert.match(detail, /student-detail-identity-meta">2018 ·/)
  assert(!detail.match(/student-detail-identity-meta">([^<]*)/)[1].includes('tuổi'))
  assert(!detail.includes('01/01/2018'))
  assert.equal(createStudentIntakeAdminPdfProjection(year).birthDate, '2018')
  assert.equal(createStudentIntakeAdminPdfProjection(full).birthDate, '29/09/2018')
  const linked = createCustomerInformationPrintSnapshot({ centerId, contact: {
    canonicalContactId: 'qa-contact', relatedStudents: [year], parentStudentLinks: [],
  } })
  assert.equal(linked.relatedStudents[0].birthDate, '2018')
  assert.equal(getFilteredStudents([year], { ...initialStudentFilters, query: 'Minh An' }).length, 1)
})
check('minimal full/year form keeps only the relevant field and honest optional DOB', () => {
  const fullForm = renderStudentModule([full], initialStudentFilters, createEditStudentFormState(full))
  const yearForm = renderStudentModule([year], initialStudentFilters, createEditStudentFormState(year))
  assert(fullForm.includes('data-student-form-field="birthDate"')); assert(!fullForm.includes('data-student-form-field="birthYear"'))
  assert(yearForm.includes('data-student-form-field="birthYear"')); assert(!yearForm.includes('data-student-form-field="birthDate"'))
  assert(yearForm.includes('Chỉ biết năm sinh')); assert(yearForm.includes('data-student-birth-year-only checked'))
  assert(!fullForm.includes('Ngày sinh *'))
})

const students = [
  { ...full, id: 'today-an', centerId, fullName: 'Minh An' },
  { ...full, id: 'today-ngoc', centerId, fullName: 'Bảo Ngọc' },
  { ...full, id: 'later', centerId, fullName: 'Gia Hân', birthDate: '2019-09-30' },
  { ...full, id: 'earlier', centerId, fullName: 'Đức Anh', birthDate: '2017-09-03' },
  { ...full, id: 'other', centerId, birthDate: '2018-10-29' },
  { ...year, id: 'year', centerId }, { ...unknown, id: 'unknown', centerId },
  { ...full, id: 'stopped', centerId, currentStatus: 'Ngưng học' },
  { ...full, id: 'deleted', centerId, isDeleted: true },
  { ...full, id: 'foreign', centerId: 'dreamhome_prod' },
  { ...full, id: 'invalid', centerId, birthDate: '2018-02-30' },
]
const todayCandidates = buildStudentBirthdayNotificationCandidates(students, { centerId, today: now })
const monthCandidates = buildStudentBirthdayMonthNotificationCandidates(students, { centerId, today: now })
const candidates = () => [...tagNotificationCandidates(todayCandidates, { centerId, providerId: 'birthdays', operational: true }),
  ...tagNotificationCandidates(monthCandidates, { centerId, providerId: 'birthday-month' })]
let items = upsertNotificationCandidates([], candidates(), { readyProviders: ['birthdays', 'birthday-month'] })
check('one operational item per birthday today; year-only/unknown/stopped/deleted/foreign never project', () => {
  assert.deepEqual(todayCandidates.map(n => n.entityId), ['today-an', 'today-ngoc'])
  assert(todayCandidates.every(n => n.meta.operational && n.meta.studentId && n.meta.actionLabel === 'Mở học viên'))
  assert.equal(buildStudentBirthdayNotificationCandidates([...students, students[0]], { centerId, today: now }).length, 2)
  assert.equal(buildStudentBirthdayNotificationCandidates(students, { today: now }).length, 0)
})
check('one current-month summary sorted day then name; informative All without attention inflation', () => {
  assert.equal(monthCandidates.length, 1)
  assert.equal(monthCandidates[0].title, 'Sinh nhật tháng 9')
  assert.equal(monthCandidates[0].message, 'Đức Anh (03/09) · Bảo Ngọc (29/09) · Minh An (29/09) · Gia Hân (30/09)')
  assert.equal(filterNotifications(items, { readState: 'attention' }).length, 2)
  assert.equal(filterNotifications(items, { readState: 'all' }).length, 3)
})
check('viewed birthday remains actionable and one old builder key coalesces across reload', () => {
  const birthday = items.find(n => n.entityId === 'today-an')
  items = markNotificationReadById(items, birthday.id, now.toISOString())
  items = upsertNotificationCandidates(items, candidates(), { readyProviders: ['birthdays', 'birthday-month'] })
  assert(items.find(n => n.id === birthday.id).readAt)
  assert.equal(filterNotifications(items, { readState: 'attention' }).length, 2)
  assert.equal(items.filter(n => n.meta.signal === 'birthday-today').length, 2)
  const panel = renderNotificationAssistantPanel({ notifications: items })
  assert(panel.includes('Đã xem')); assert(panel.includes('Mở học viên'))
  assert(!panel.includes('Sinh nhật tháng 9'))
  assert(renderNotificationAssistantPanel({ notifications: items, readState: 'all' }).includes('Sinh nhật tháng 9'))
})
check('local midnight boundaries independent of machine timezone and UTC date', () => {
  for (const [iso, date, count] of [
    ['2026-09-28T16:59:59Z', '2026-09-28', 0],
    ['2026-09-28T17:00:00Z', '2026-09-29', 2],
    ['2026-09-29T16:59:59Z', '2026-09-29', 2],
    ['2026-09-29T17:00:00Z', '2026-09-30', 1],
  ]) {
    assert.equal(getBirthdayLocalDateKey(new Date(iso)), date)
    const projected = buildStudentBirthdayNotificationCandidates(students, { centerId, today: new Date(iso) })
    assert.equal(projected.length, count)
    if (date === '2026-09-30') assert(!projected.some(n => n.entityId === 'today-an'))
  }
})
check('expiry prunes only time-bounded birthdays even during provider failure; monthly lasts within month', () => {
  const operational = { id: 'c2', dedupeKey: 'attention:phongtrong_prod:student:cycle:tuition-n2', meta: { centerId, studentId: 'student', cycleId: 'cycle', signal: 'tuition-n2', operational: true } }
  const retained = pruneExpiredStudentBirthdayNotifications([...items, operational], { centerId, today: '2026-09-30' })
  assert.equal(retained.length, 2); assert(retained.some(n => n.meta.signal === 'birthday-month')); assert(retained.includes(operational))
  assert.equal(pruneExpiredStudentBirthdayNotifications(retained, { centerId, today: '2026-10-01' }).length, 1)
  const failed = upsertNotificationCandidates(items, [], { readyProviders: [] })
  assert.equal(failed.length, items.length); assert(failed.find(n => n.entityId === 'today-an').readAt)
})
check('DOB/precision/lifecycle/current-month changes reconcile the summary from current truth', () => {
  const changed = students.map(s => s.id === 'today-an' ? { ...s, birthDate: '', birthYear: '2018' }
    : s.id === 'later' ? { ...s, currentStatus: 'Ngưng học' } : s)
  const refreshed = upsertNotificationCandidates(items, [
    ...buildStudentBirthdayNotificationCandidates(changed, { centerId, today: now }),
    ...buildStudentBirthdayMonthNotificationCandidates(changed, { centerId, today: now }),
  ], { readyProviders: ['birthdays', 'birthday-month'] })
  assert(!refreshed.some(n => n.entityId === 'today-an'))
  assert.equal(refreshed.find(n => n.meta.signal === 'birthday-month').message, 'Đức Anh (03/09) · Bảo Ngọc (29/09)')
  assert.equal(buildStudentBirthdayMonthNotificationCandidates(students, { centerId, today: '2026-10-01' })[0].message, 'QA Minh An (29/10)')
  assert.equal(buildStudentBirthdayMonthNotificationCandidates(students, { centerId: 'dreamhome_prod', today: now })[0].message, 'QA Minh An (29/09)')
})

for (const student of [full, year, unknown]) {
  let savedPayload
  const result = await mutateV22StudentWithEnrollments({ centerId, student, enrollments: [], expectedEnrollmentVersion: 0,
    idempotencyKey: '00000000-0000-4000-8000-0000000000c3', supabase: { async rpc(name, params) {
      assert.equal(name, 'v2_2_mutate_student_with_enrollments'); savedPayload = params.p_student_payload
      return { data: { ok: true, center_id: centerId, student_local_id: student.id, student_version: 1,
        student_payload: savedPayload, enrollment_set: { student_id: student.id, version: 1, enrollments: [] } }, error: null }
    } } })
  assert(result.ok); assert.equal(savedPayload.birthDate, student.birthDate); assert.equal(savedPayload.birthYear, student.birthYear)
  assert.equal(result.student.birthYear, student.birthYear); assert.equal(result.student.birthDate, student.birthDate)
}
checks++; console.log('PASS all three birth states survive canonical V2.2 write/read projection')
check('runtime lifecycle reconciles birthdays on Student commits/realtime and existing clock/visibility', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  for (const name of ['handleStudentRealtimeRecord', 'commitV22StudentProjection', 'commitAuthoritativeStudentCoreProjection', 'updateClock']) {
    const start = main.indexOf(`function ${name}(`), end = main.indexOf('\nfunction ', start + 1)
    assert(main.slice(start, end).includes('syncAppNotifications(notifications)'), name)
  }
  assert(main.includes("queueNotificationAttentionRefresh('local-day-rollover')"))
  assert(main.includes("document.addEventListener('visibilitychange'"))
})
console.log(`C2.3 Student/Birthday precision smoke: PASS (${checks} checks)`)
