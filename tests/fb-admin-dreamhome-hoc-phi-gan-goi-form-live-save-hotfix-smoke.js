import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const tuitionSource = read('src/tuition-module.js')
const mainSource = read('src/main.js')
const docs = read('docs/fb-admin-dreamhome-hoc-phi-gan-goi-form-live-save-hotfix.md')

const requiredMarkers = [
  'FB ADMIN DREAMHOME STATUS: TUITION PACKAGE FORM LIVE SAVE HOTFIX',
  'FEEDBACK_SOURCE: ADMIN_DREAMHOME_TUITION_PACKAGE_FORM_MANUAL_QA',
  'TUITION_PACKAGE_FORM_SUBMIT_WARNING_FIXED: YES',
  'TUITION_PACKAGE_PREVIEW_LIVE_INPUT_ADDED: YES',
  'TUITION_PACKAGE_SAVE_WORKS: YES',
  'TUITION_NEGATIVE_PAID_AMOUNT_PRESERVED_AS_DEBT_DEDUCTION: YES',
  'TUITION_USED_SESSIONS_STORAGE_MUTATION_FROM_ATTENDANCE: NO',
  'TUITION_ATTENDANCE_READONLY_LINK_PRESERVED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'C8_TEACHER_SCOPE: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]

requiredMarkers.forEach((marker) => {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
})

assert(
  /<button type="button" data-tuition-action="save-form">/.test(tuitionSource),
  'Tuition save button must be explicit type="button", not native submit.',
)
assert(
  !/<button type="submit" data-tuition-action="save-form">/.test(tuitionSource),
  'Tuition save button must not be a native submit button.',
)
assert(
  tuitionSource.includes('data-tuition-discount-preview'),
  'Tuition form must expose a scoped discount preview target.',
)
assert(
  tuitionSource.includes('export function renderTuitionDiscountPreviewFromValues(values)'),
  'Tuition module must export scoped preview renderer.',
)
assert(
  mainSource.includes('renderTuitionDiscountPreviewFromValues'),
  'Main wiring must import/use scoped preview renderer.',
)
assert(
  mainSource.includes('function refreshTuitionFormPreview()') &&
    mainSource.includes("document.querySelector('[data-tuition-discount-preview]')") &&
    mainSource.includes('previewElement.outerHTML = renderTuitionDiscountPreviewFromValues(tuitionFormState.values)'),
  'Main wiring must refresh only the tuition preview DOM.',
)
assert(
  mainSource.includes('const handleTuitionFormSave = (event) =>') &&
    mainSource.includes('event?.preventDefault?.()') &&
    mainSource.includes('event?.stopPropagation?.()'),
  'Tuition save handler must block native form submission.',
)
assert(
  mainSource.includes("document.querySelector('[data-tuition-form]')?.addEventListener('submit', handleTuitionFormSave)") &&
    mainSource.includes('document.querySelector(\'[data-tuition-action="save-form"]\')?.addEventListener(\'click\', handleTuitionFormSave)'),
  'Tuition form must support submit fallback and explicit click save handler.',
)
assert(
  mainSource.includes("if (['discountCustomValue', 'totalAmount', 'paidAmount'].includes(fieldName))") &&
    mainSource.includes('refreshTuitionFormPreview()'),
  'Money/discount inputs must update preview live without full render.',
)
assert(
  mainSource.includes("control.addEventListener('change', handleTuitionFormFieldInput)"),
  'Native select changes must be wired for live discount preset updates.',
)
assert(
  !mainSource.includes("['discountPreset', 'discountCustomValue', 'totalAmount', 'paidAmount'].includes(fieldName)"),
  'Old noisy full-render trigger for every money input should be removed.',
)
assert(
  tuitionSource.includes('<div class="is-paid"><dt>Đã thanh toán</dt><dd>-${formatMoney(amounts.paidAmount)}</dd></div>'),
  'Paid amount must remain negative because it represents a debt deduction.',
)
assert(
  !/tuition\.usedSessions\s*=/.test(`${mainSource}\n${tuitionSource}`),
  'Attendance must not write back into tuition.usedSessions.',
)
assert(
  !/usedSessions\s*:\s*[^,\n]*(attendance|Attendance)/.test(`${mainSource}\n${tuitionSource}`),
  'Attendance-derived values must not overwrite stored usedSessions.',
)
assert(
  mainSource.includes('buildUnifiedAttendanceRecords') && mainSource.includes('renderTuitionModule('),
  'Attendance read-only comparison must remain wired into Tuition module.',
)

console.log('PASS tuition package form live/save hotfix smoke')
