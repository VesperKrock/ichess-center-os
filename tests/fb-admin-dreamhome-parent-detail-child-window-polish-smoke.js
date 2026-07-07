import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(rootDir, filePath), 'utf8')
const exists = (filePath) => fs.existsSync(path.join(rootDir, filePath))

const docsPath = 'docs/fb-admin-dreamhome-parent-detail-child-window-polish.md'
const mainPath = 'src/main.js'
const parentPath = 'src/parent-consultation-module.js'
const settingsPath = 'src/settings-module.js'
const stylesPath = 'src/styles.css'

const docs = read(docsPath)
const main = read(mainPath)
const parent = read(parentPath)
const settings = read(settingsPath)
const styles = read(stylesPath)

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

assert(exists(docsPath), 'Docs feedback file must exist.')

;[
  'FB ADMIN DREAMHOME STATUS: PARENT DETAIL CHILD WINDOW POLISH',
  'FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA',
  'C8_TEACHER_ROADMAP_SCOPE: NO',
  'PARENT_DETAIL_MULTI_STUDENT_LAYOUT_FIXED: YES',
  'PARENT_DETAIL_TASKBAR_SAFE_HEIGHT_FIXED: YES',
  'PARENT_RELATED_STUDENT_OPEN_PROFILE_ENABLED: YES',
  'CHILD_WINDOW_BRING_TO_FRONT_APP_WIDE_FIXED: YES',
  'CALLER_MODAL_DOES_NOT_STEAL_FOCUS_BACK: YES',
  'SETTINGS_CLASS_DAY_CHECKBOX_SINGLE_CLICK_FIXED: YES',
  'SELECT_DROPDOWN_FIX_PRESERVED: YES',
  'TEXT_INPUT_CARET_STABILITY_PRESERVED: YES',
  'ATTENDANCE_BASELINE_LOGIC_DEFERRED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
})

assert(
  styles.includes('.parent-contact-detail-panel') &&
    styles.includes('calc(100dvh - 104px)') &&
    styles.includes('.parent-contact-detail-scroll') &&
    styles.includes('overflow-y: auto'),
  'Parent detail modal must have responsive taskbar-safe height and internal scroll.',
)

assert(
  parent.includes('parent-contact-detail-scroll') &&
    parent.includes('parent-linked-students-list') &&
    parent.includes('parent-detail-note-history'),
  'Parent detail must separate related students and notes sections.',
)

assert(
  parent.includes('data-parent-linked-student-id') &&
    main.includes('openStudentDetailWindowFromChildInteraction') &&
    main.includes('openStudentDetailWindowFromChildInteraction(studentId)') &&
    main.includes('focusWindowAfterRender'),
  'Parent related student click must open profile with child-window bring-to-front helper.',
)

assert(
  main.includes('event.stopImmediatePropagation()') &&
    main.includes('pendingWindowFocusAfterRender') &&
    main.includes('restorePendingWindowFocusAfterRender'),
  'Caller modal/detail must not immediately steal focus back.',
)

assert(
  settings.includes('settings-day-option') &&
    settings.includes('data-settings-class-session-day') &&
    settings.includes('for="${escapeAttribute(inputId)}"') &&
    styles.includes('.settings-day-option input:checked + label') &&
    main.includes("[data-settings-class-session-day]") &&
    main.includes("checkbox.addEventListener('change'"),
  'Settings class day checkbox must use label/id and change-based single-click toggle.',
)

assert(
  main.includes('isNativeSelectElement') &&
    main.includes('markNativeSelectChangeRender') &&
    main.includes('restoreActiveElementRenderSnapshot(activeElementSnapshot)'),
  'Select dropdown and text caret fixes must be preserved.',
)

;[mainPath, parentPath, settingsPath, stylesPath].forEach((filePath) => {
  const source = read(filePath)
  assert(!/service_role|SUPABASE_SERVICE_ROLE|secret\s*=/i.test(source), `Potential secret exposure in ${filePath}`)
  assert(!/supabase\/functions/i.test(source), `Supabase function change marker found in ${filePath}`)
})

assert(!exists('docs/fb-admin-dreamhome-parent-detail-child-window-polish.sql'), 'No SQL file should be added.')

console.log('PASS fb-admin-dreamhome-parent-detail-child-window-polish smoke')
