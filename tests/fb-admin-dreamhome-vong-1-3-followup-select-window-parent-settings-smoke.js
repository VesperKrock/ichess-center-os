import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(rootDir, filePath), 'utf8')
const exists = (filePath) => fs.existsSync(path.join(rootDir, filePath))

const docsPath = 'docs/fb-admin-dreamhome-vong-1-3-followup-select-window-parent-settings.md'
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
  'FB ADMIN DREAMHOME STATUS: VONG 1 3 FOLLOWUP SELECT WINDOW PARENT SETTINGS',
  'FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA',
  'C8_TEACHER_ROADMAP_SCOPE: NO',
  'NATIVE_SELECT_DROPDOWN_RENDER_CLOSE_FIXED: YES',
  'SELECT_CHANGE_LIVE_APPLY_PRESERVED: YES',
  'TEXT_INPUT_CARET_STABILITY_PRESERVED: YES',
  'SETTINGS_OPEN_FROM_STUDENT_EDIT_VISIBLE_TOP: YES',
  'WINDOW_MODAL_STACK_CHILD_OPEN_FIXED: YES',
  'PARENT_ROW_CLICK_DETAIL_ENABLED: YES',
  'PARENT_ACTION_COLUMN_REMOVED: YES',
  'PARENT_ADD_NOTE_COLUMN_REMOVED: YES',
  'PARENT_LATEST_NOTE_HISTORY_CONSISTENT: YES',
  'TUITION_PACKAGE_SETTINGS_SHARED_CATALOG_CLARIFIED: YES',
  'SAMPLE_DATA_RENAMED_TO_INPUT_CATALOG: YES',
  'CENTER_APPEARANCE_BACKGROUND_FOUNDATION_ADDED: YES',
  'BACKGROUND_UPLOAD_STORAGE_DEFERRED: YES',
  'ATTENDANCE_BASELINE_LOGIC_DEFERRED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
].forEach((marker) => {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
})

assert(
  main.includes('isNativeSelectElement') &&
    main.includes('markNativeSelectInteraction') &&
    main.includes('markNativeSelectChangeRender') &&
    main.includes('nativeSelectChangeRenderUntil') &&
    main.includes("control.matches('select')") &&
    main.includes('restoreActiveElementRenderSnapshot(activeElementSnapshot)'),
  'Runtime must have native select interaction guard and preserve caret hotfix.',
)

assert(
  main.includes("control.addEventListener(control.matches('select') ? 'change' : 'input'") &&
    main.includes('[data-parent-consultation-filter]') &&
    main.includes('[data-settings-filter]'),
  'Select change must still apply live filters.',
)

assert(
  main.includes('openModuleWindowFromChildInteraction') &&
    main.includes('pendingWindowFocusAfterRender') &&
    main.includes("openModuleWindowFromChildInteraction('cai-dat-co-so')") &&
    main.includes('event.stopImmediatePropagation()'),
  'Settings opened from student edit must use child window visible-top handling.',
)

assert(
  parent.includes('data-parent-contact-row-id') &&
    main.includes('[data-parent-contact-row-id]') &&
    parent.includes('parent-contact-detail-panel'),
  'Parent row click detail behavior must exist.',
)

const contactTableHeader = parent.slice(
  parent.indexOf('function renderContactsTable'),
  parent.indexOf('function renderContactRow'),
)
assert(!contactTableHeader.includes('<th>Thao tác</th>'), 'Parent action column must be removed.')
assert(!contactTableHeader.includes('<th>Thêm ghi chú</th>'), 'Parent add-note column must be removed.')

assert(
  parent.includes('getContactNoteHistoryLogs') &&
    parent.includes('student.parentNotes') &&
    parent.includes('student.careNotes') &&
    parent.includes('parent-detail-note-history'),
  'Derived latest note must have matching note history.',
)

assert(settings.includes('Danh mục nhập liệu'), 'Settings must use Danh mục nhập liệu.')
assert(!settings.includes('Dữ liệu mẫu'), 'Settings runtime must no longer use Dữ liệu mẫu.')
assert(
  settings.includes('Giao diện cơ sở') &&
    settings.includes('hình nền') &&
    settings.includes('chưa tải ảnh lên') &&
    styles.includes('settings-appearance-panel'),
  'Settings must include safe center appearance/background foundation.',
)
assert(
  settings.includes('dùng chung với Module Học phí') &&
    settings.includes('nguồn tham chiếu chung'),
  'Tuition package Settings copy must clarify shared catalog behavior.',
)

assert(!/data-.*upload|Supabase Storage|uploadBackground|backgroundUpload/i.test(settings), 'Background upload/storage must stay deferred.')

;[mainPath, parentPath, settingsPath, stylesPath].forEach((filePath) => {
  const source = read(filePath)
  assert(!/service_role|SUPABASE_SERVICE_ROLE|secret\s*=/i.test(source), `Potential secret exposure in ${filePath}`)
})

console.log('PASS fb-admin-dreamhome-vong-1-3-followup-select-window-parent-settings smoke')
