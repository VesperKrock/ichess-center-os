import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildTuitionPackageFilterOptions,
  buildTuitionRows,
  createEditTuitionFormState,
  createEmptyTuitionFormState,
  initialTuitionFilters,
  normalizeTuitionFormValues,
  renderTuitionModule,
  validateTuitionForm,
} from '../src/tuition-module.js'
import { renderSettingsModule } from '../src/settings-module.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const mainSource = read('src/main.js')
const tuitionSource = read('src/tuition-module.js')
const tuitionTheme = read('src/tuition-theme.css')
const studentTheme = read('src/student-theme.css')
const settingsTheme = read('src/settings-v2-8p2-theme.css')

const student = {
  id: 'student-f3b',
  fullName: 'Học viên F3B',
  parentName: 'Phụ huynh F3B',
  parentPhone: '0900000000',
  currentStatus: 'Đang theo học',
  classSessionIds: ['slot-f3b'],
}
const activePackage = {
  id: '11111111-1111-4111-8111-111111111111',
  centerId: 'center-f3b',
  packageName: 'Gói linh hoạt 12 buổi',
  totalSessions: 12,
  defaultAmount: 3600000,
  isActive: true,
  version: 1,
}
const retiredPackage = {
  id: '22222222-2222-4222-8222-222222222222',
  centerId: 'center-f3b',
  packageName: 'Gói lịch sử 16 buổi',
  totalSessions: 16,
  defaultAmount: 4000000,
  isActive: false,
  version: 2,
}

const emptyState = createEmptyTuitionFormState(student)
assert.equal(emptyState.values.packageName, '')
assert.equal(emptyState.values.totalSessions, '')
assert.equal(emptyState.values.packageCatalogId, '')

const customValues = {
  ...emptyState.values,
  packageName: activePackage.packageName,
  packageCatalogId: activePackage.id,
  totalSessions: '12',
  usedSessions: '5',
  totalAmount: '3.600.000',
}
assert.deepEqual(validateTuitionForm(customValues), {})
const normalized = normalizeTuitionFormValues(customValues)
assert.equal(normalized.packageCatalogId, activePackage.id)
assert.equal(normalized.totalSessions, 12)
assert.equal(normalized.usedSessions, 5)
assert.equal(normalized.totalAmount, 3600000)
assert(validateTuitionForm({ ...customValues, totalSessions: '0' }).totalSessions)
assert(validateTuitionForm({ ...customValues, totalSessions: '-2' }).totalSessions)
assert(validateTuitionForm({ ...customValues, totalSessions: 'abc' }).totalSessions)
assert(validateTuitionForm({ ...customValues, totalSessions: '1001' }).totalSessions)

const legacyRecords = [8, 16, 32, 12].map((totalSessions, index) => ({
  id: `tuition-${totalSessions}`,
  studentId: `student-${totalSessions}`,
  packageName: `Gói ${totalSessions} buổi`,
  totalSessions,
  usedSessions: index === 3 ? 8 : 1,
  totalAmount: totalSessions * 100000,
  paidAmount: totalSessions * 100000,
}))
const legacyStudents = legacyRecords.map((record) => ({
  id: record.studentId,
  fullName: `Học viên ${record.totalSessions}`,
  parentName: 'Phụ huynh QA',
  parentPhone: '0900000000',
  currentStatus: 'Đang theo học',
  classSessionIds: ['slot-f3b'],
}))
const rows = buildTuitionRows(legacyStudents, legacyRecords)
for (const totalSessions of [8, 16, 32, 12]) {
  assert.equal(rows.find((row) => row.tuition.totalSessions === totalSessions).packageKind, String(totalSessions))
}
assert.equal(rows.find((row) => row.tuition.totalSessions === 12).remainingSessions, 4)
assert.deepEqual(
  buildTuitionPackageFilterOptions(rows, [activePackage, retiredPackage]).map((option) => option.value),
  ['all', '8', '12', '16', '32', 'other', 'no-package'],
)

const record = {
  ...legacyRecords[3],
  studentId: student.id,
  packageCatalogId: activePackage.id,
  discountType: 'none',
  discountValue: 0,
  discountAmount: 0,
  dueDate: '',
  note: '',
  payments: [],
  termHistory: [],
}
const formState = createEditTuitionFormState(student, record)
assert.equal(formState.values.packageCatalogId, activePackage.id)

const html = renderTuitionModule(
  [student],
  [record],
  initialTuitionFilters,
  formState,
  null,
  null,
  [],
  [],
  '2026-09',
  null,
  [],
  null,
  null,
  [],
  'center-f3b',
  null,
  {},
  {
    attendanceStatus: 'ready',
    calendarNotesStatus: 'ready',
    financeStatus: 'ready',
    tuitionPackageCatalog: [activePackage, retiredPackage],
  },
)
for (const token of [
  activePackage.packageName,
  `data-tuition-package-option-id="${activePackage.id}"`,
  '12 buổi',
  'Nhập tùy chỉnh',
  'data-tuition-package-custom',
  'Ưu đãi (nếu có)',
  'min="1" max="1000" step="1"',
]) assert(html.includes(token), `Missing configurable Tuition UI token: ${token}`)
assert(!html.includes(retiredPackage.packageName), 'Retired package became selectable for a new assignment.')
assert(!html.includes('data-tuition-package-suggestion='))
assert(!html.includes('Kiểu ưu đãi / Mức ưu đãi'))

const settingsHtml = renderSettingsModule([], [], undefined, null, null, {
  activeTab: 'tuition-packages',
  tuitionPackages: [activePackage, retiredPackage],
  centerSettingsState: { status: 'ready' },
})
assert(settingsHtml.includes(activePackage.packageName))
assert(settingsHtml.includes(retiredPackage.packageName))
assert(settingsHtml.includes('Có thể nhập số buổi từ 1 đến 1000'))
assert(settingsHtml.includes('Đã ngưng'))

for (const token of [
  'tuitionPackageCatalog:',
  'packageCatalogId: tuitionPackage.id',
  "['packageName', 'totalSessions', 'totalAmount'].includes(fieldName)",
]) assert(mainSource.includes(token), `Missing catalog assignment wiring: ${token}`)
assert(tuitionSource.includes("packageCatalogId: String(values.packageCatalogId || '').trim()"))
assert(!tuitionSource.includes('const packageOptions = ['))
assert(!tuitionSource.includes('${[8, 16, 32]'))
assert(tuitionTheme.includes('.tuition-package-catalog-note'))

for (const token of [
  '.is-student-list-window .student-note-badge.has-note',
  '.is-student-profile-window .student-link-warning.is-info',
]) assert(studentTheme.includes(token), `Missing bounded Student contrast selector: ${token}`)
assert(settingsTheme.includes('.desktop-window.is-settings-window .settings-wallpaper-message'))
assert(settingsTheme.includes('background: var(--settings-green-bg);'))

const tuitionSaveBlock = mainSource.slice(
  mainSource.indexOf('const handleTuitionFormSave'),
  mainSource.indexOf("document.querySelectorAll('[data-tuition-payment-field]"),
)
assert(!tuitionSaveBlock.includes('attendanceRecords ='))
assert(!tuitionSaveBlock.includes('usedSessionsAutoUpdateFromAttendance'))

console.log('F3B_CONFIGURABLE_TUITION_PACKAGES_SMOKE: PASS')
