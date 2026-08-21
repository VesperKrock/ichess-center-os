import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  BROWSER_STORAGE_REGISTRY,
  assertNoBrowserBusinessAuthority,
} from '../src/browser-storage-registry.js'
import {
  UI_THEME_KEY,
  getUiTheme,
  saveUiTheme,
  setCurrentStorageCenterId,
} from '../src/storage.js'
import {
  createEmptyStudentFormState,
  initialStudentFilters,
  renderStudentModule,
} from '../src/student-module.js'
import {
  renderStudentCareNotes,
  renderStudentDetail,
} from '../src/student-detail.js'

const root = process.cwd()
const mainSource = readFileSync(join(root, 'src/main.js'), 'utf8')
const themeCss = readFileSync(join(root, 'src/student-theme.css'), 'utf8')
const studentModuleSource = readFileSync(join(root, 'src/student-module.js'), 'utf8')
const studentDetailSource = readFileSync(join(root, 'src/student-detail.js'), 'utf8')

function assertCssValue(selector, property, value) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = new RegExp(
    `${escapedSelector}\\s*\\{[^}]*${escapedProperty}\\s*:\\s*${escapedValue}\\s*;`,
    's',
  )
  assert.match(themeCss, rule, `${selector} must declare ${property}: ${value}`)
}

function sourceSlice(source, startToken, endToken) {
  const start = source.indexOf(startToken)
  const end = source.indexOf(endToken, start + startToken.length)
  assert(start >= 0 && end > start, `Missing source slice ${startToken}`)
  return source.slice(start, end)
}

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
  }
}

const themeStorage = createMemoryStorage()
assert.equal(getUiTheme(themeStorage), 'light', 'Light must be the default theme')
assert.equal(saveUiTheme('dark', themeStorage), true)
assert.equal(getUiTheme(themeStorage), 'dark', 'Dark choice must survive a storage reload')
setCurrentStorageCenterId('qa-center-a')
assert.equal(getUiTheme(themeStorage), 'dark', 'Center switches must not change the theme')
setCurrentStorageCenterId('qa-center-b')
assert.equal(getUiTheme(themeStorage), 'dark', 'Account/center context is not part of the theme key')
assert.equal(saveUiTheme('business-blue', themeStorage), false, 'Unknown themes must fail closed')
assert.equal(getUiTheme(createMemoryStorage({ [UI_THEME_KEY]: 'invalid' })), 'light')

const themeRegistryEntry = BROWSER_STORAGE_REGISTRY.find(
  (entry) => entry.keyPattern === UI_THEME_KEY,
)
assert.equal(themeRegistryEntry?.classification, 'PERSONAL_UI_STATE')
assert.equal(assertNoBrowserBusinessAuthority().ok, true)

const student = {
  id: 'qa-u1-student',
  fullName: 'QA U1 Học viên',
  birthDate: '2015-08-21',
  gender: 'female',
  schoolName: 'Trường QA',
  schoolLevel: 'Cấp 1',
  hometown: 'TP.HCM',
  nationality: 'Việt Nam',
  parentName: 'QA Phụ huynh',
  fatherPhone: '0901001001',
  motherPhone: '',
  parentPhone: '0901001001',
  level: 'Dolphin 1',
  currentStatus: 'Đang theo học',
  highestBotMilestone: 'Bot 1',
  assignedTeacherId: 'qa-teacher',
  classSessionIds: ['qa-class'],
  avatarUrl: '',
  careNotes: [{
    id: 'qa-note',
    author: 'QA Operator',
    createdAt: '2026-08-21T01:00:00.000Z',
    content: 'Ghi chú QA',
    tags: ['QA'],
  }],
  latestCareNote: 'Ghi chú QA',
  achievements: '',
  parentNotes: '',
}
const teachers = [{ id: 'qa-teacher', displayName: 'QA Giáo viên', status: 'active' }]
const classes = [{ id: 'qa-class', name: 'QA Lớp', displayLabel: 'QA Lớp', status: 'active' }]

const listHtml = renderStudentModule(
  [student],
  { ...initialStudentFilters },
  null,
  teachers,
  classes,
)
for (const token of [
  'data-student-action="open-create"',
  'data-student-filter="query"',
  'data-student-filter="status"',
  'data-student-filter="level"',
  'data-student-filter="classSessionId"',
  'data-student-sort="student"',
  'data-student-id="qa-u1-student"',
  'data-student-note-action="open-care-notes"',
]) assert(listHtml.includes(token), `Missing Student list control: ${token}`)
assert(listHtml.includes('tabindex="0"'), 'Student rows must remain keyboard operable')

const stepOneState = createEmptyStudentFormState()
const stepOneHtml = renderStudentModule([], initialStudentFilters, stepOneState, teachers, classes)
for (const token of [
  'data-student-form-step="1"',
  'data-student-form-step="2"',
  'data-student-form-field="fullName"',
  'data-student-form-field="birthDate"',
  'data-student-form-field="assignedTeacherId"',
  'data-student-class-session-id="qa-class"',
  'data-student-action="open-settings-module"',
  'data-student-action="cancel-form"',
  'data-student-action="save-form"',
]) assert(stepOneHtml.includes(token), `Missing Student form control: ${token}`)

const stepTwoHtml = renderStudentModule(
  [],
  initialStudentFilters,
  { ...stepOneState, step: 2 },
  teachers,
  classes,
)
for (const token of [
  'data-student-form-field="parentName"',
  'data-student-form-field="fatherPhone"',
  'data-student-form-field="motherPhone"',
  'data-student-form-field="currentStatus"',
  'data-student-form-field="parentNotes"',
  'data-student-parent-note-suggestion=',
]) assert(stepTwoHtml.includes(token), `Missing Parent/Care control: ${token}`)

const savingHtml = renderStudentModule(
  [],
  initialStudentFilters,
  { ...stepOneState, isSaving: true, errors: { form: 'QA chưa lưu được.' } },
  teachers,
  classes,
)
assert(savingHtml.includes('aria-busy="true"'))
assert(savingHtml.includes('Đang lưu…'))
assert(savingHtml.includes('role="alert"'))

const profileHtml = renderStudentDetail(student, teachers, classes, [])
for (const token of [
  'data-student-action="edit-from-detail"',
  'data-student-detail-action="clear-avatar"',
  'data-student-detail-action="open-care-notes"',
  'student-detail-delete-slot',
]) assert(profileHtml.includes(token), `Missing Profile capability: ${token}`)
assert(profileHtml.includes('student-detail-quick-facts'))
assert(!profileHtml.includes('data-student-detail-action="open-learning"'))
assert(!studentDetailSource.includes('data-student-detail-action="open-learning"'))

const careHtml = renderStudentCareNotes(student, {
  content: 'Ghi chú QA đang sửa',
  tag: 'QA',
  error: '',
  editingNoteId: 'qa-note',
})
for (const token of [
  'data-care-note-field="tag"',
  'data-care-note-field="content"',
  'data-care-note-suggestion=',
  'data-care-note-action="edit"',
  'data-care-note-action="delete"',
  'data-care-note-action="save"',
  'data-care-note-action="clear"',
]) assert(careHtml.includes(token), `Missing Care/Notes capability: ${token}`)
assert(careHtml.includes('student-care-form-card'))

const taskbarSource = sourceSlice(mainSource, 'function renderTaskbar()', 'function renderWindowOverflowMenu')
assert(!taskbarSource.includes('data-ui-theme'), 'Theme control must not alter taskbar markup')
assert(!/^\s*\.taskbar(?:\s|[.#:{>+~])/m.test(themeCss), 'Theme CSS must not target the taskbar')
assert(mainSource.includes('data-ui-theme="light"'))
assert(mainSource.includes('data-ui-theme="dark"'))
assert(mainSource.includes('saveUiTheme(currentUiTheme)'))
assert(mainSource.includes('document.documentElement.dataset.uiTheme = currentUiTheme'))
assert(!mainSource.includes('document.documentElement.style.colorScheme'))
assert(themeCss.includes(":root[data-ui-theme='dark'] .desktop-window.is-student-window"))

for (const selector of [
  '.is-student-list-window',
  '.is-student-form-window',
  '.is-student-profile-window',
  '.is-student-care-notes-window',
  ":root[data-ui-theme='dark']",
]) assert(themeCss.includes(selector), `Missing painted surface: ${selector}`)

assert.doesNotMatch(themeCss, /\bzoom\s*:/, 'Student paint must not use CSS zoom')
assert.doesNotMatch(themeCss, /\bscale\s*\(/, 'Student paint must not scale the UI to fit')

for (const [selector, property, value] of [
  ['.is-student-list-window .student-page-header h3', 'font-size', '24px'],
  ['.is-student-list-window .student-page-header p', 'font-size', '14px'],
  ['.is-student-list-window .student-add-button', 'font-size', '14px'],
  ['.is-student-list-window .student-table th', 'font-size', '13px'],
  ['.is-student-form-window .student-form-header h4', 'font-size', '22px'],
  ['.is-student-form-window .student-form-steps button', 'font-size', '14px'],
  ['.is-student-form-window .student-form-section legend', 'font-size', '16px'],
  ['.is-student-profile-window .student-detail-page-title', 'font-size', '25px'],
  ['.is-student-profile-window .student-detail-hero-main h3', 'font-size', '22px'],
  ['.is-student-profile-window .student-overview-tile h4', 'font-size', '18px'],
  ['.is-student-care-notes-window .student-care-page-header h3', 'font-size', '25px'],
  ['.is-student-care-notes-window .student-care-layout h4', 'font-size', '18px'],
]) assertCssValue(selector, property, value)

assertCssValue('.is-student-list-window .student-table-wrap', 'overflow', 'auto')
assertCssValue('.is-student-list-window .student-table th', 'position', 'sticky')
assertCssValue('.is-student-form-window .student-form-scroll', 'overflow', 'auto')
assertCssValue('.is-student-profile-window .student-detail-overview', 'overflow', 'auto')
assertCssValue('.is-student-care-notes-window .student-care-window', 'overflow', 'auto')
assert(themeCss.includes('minmax(172px, max-content)'))
assertCssValue('.is-student-form-window .student-form-panel', 'gap', '10px')
assertCssValue('.is-student-form-window .student-form-panel', 'padding', '18px 32px')
assert(themeCss.includes("'avatar identity actions'"))
assert(themeCss.includes("'facts facts facts'"))
assertCssValue('.is-student-profile-window .student-detail-hero', 'flex', '0 0 auto')
assertCssValue('.is-student-profile-window .student-overview-grid', 'flex', '0 0 auto')
assertCssValue('.is-student-profile-window .student-overview-tile', 'overflow', 'visible')
assertCssValue('.is-student-profile-window .student-detail-open-button', 'min-height', '27px')
assert(themeCss.includes('.student-link-warning-list > strong'))
assert(themeCss.includes('@media (max-width: 1120px)'))
assert(themeCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'))
assert(themeCss.includes('grid-template-columns: 1fr;'))

for (const binding of [
  "querySelectorAll('[data-student-filter]')",
  "querySelectorAll('[data-student-sort]')",
  "querySelectorAll('[data-student-form-field]')",
  "querySelectorAll('[data-student-form-step]')",
  "querySelectorAll('[data-care-note-action=\"save\"]')",
  "querySelectorAll('[data-care-note-action=\"delete\"]')",
  "querySelectorAll('.student-row[data-student-id]')",
]) assert(mainSource.includes(binding), `Missing runtime binding: ${binding}`)

const studentSaveBinding = sourceSlice(
  mainSource,
  'document.querySelector(\'[data-student-action="save-form"]\')',
  "document.querySelectorAll('.student-row[data-student-id]')",
)
assert(studentSaveBinding.includes('prepareAuthoritativeCoreFormCommand'))
assert(studentSaveBinding.includes('commandIdempotencyKey'))
assert(studentSaveBinding.includes('commitStudentProjection'))
assert(studentSaveBinding.includes('isSaving: false'))
assert(studentSaveBinding.includes('result.userMessage || result.error'))
assert(studentModuleSource.includes("formState.errors.form"))

console.log('U0_U1_THEME_STUDENT_PAINT_SMOKE: PASS')
