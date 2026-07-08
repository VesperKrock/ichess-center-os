import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const docs = fs.readFileSync(
  path.join(repoRoot, 'docs/fb-admin-dreamhome-bang-diem-danh-excel-navigation-polish.md'),
  'utf8',
)
const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main.js'), 'utf8')
const attendanceSource = fs.readFileSync(path.join(repoRoot, 'src/attendance-board-module.js'), 'utf8')
const styles = fs.readFileSync(path.join(repoRoot, 'src/styles.css'), 'utf8')

for (const marker of [
  'FB ADMIN DREAMHOME STATUS: ATTENDANCE EXCEL NAVIGATION POLISH',
  'ATTENDANCE_CORE_SAVE_RELOAD_ALREADY_PASS: YES',
  'ATTENDANCE_CELL_ONE_CLICK_SWITCH_FIXED: YES',
  'ATTENDANCE_CELL_TAB_NAVIGATION_FIXED: YES',
  'ATTENDANCE_CELL_SHIFT_TAB_NAVIGATION_FIXED: YES',
  'ATTENDANCE_CELL_ENTER_NAVIGATION_FIXED: YES',
  'ATTENDANCE_CELL_ARROW_NAVIGATION_SAFE: YES',
  'ATTENDANCE_CELL_DISABLED_SKIP_NAVIGATION: YES',
  'ATTENDANCE_CELL_NO_FULL_RENDER_ON_KEYPRESS: YES',
  'ATTENDANCE_MONTH_CONTROL_LIVE_CHANGE_POLISHED: YES',
  'ATTENDANCE_SAVE_RELOAD_REGRESSION_CHECKED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]) {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
}

assert(
  mainSource.includes('function commitAttendanceBaselineCellInput(input, { focusTarget = null, shouldRender = true } = {})'),
  'Cell commit should support no-render pointer switching',
)
assert(
  mainSource.includes("input.addEventListener('pointerdown'") &&
    mainSource.includes('shouldRender: false') &&
    mainSource.includes('attendanceBaselineCommittedValue'),
  'One-click cell switch should commit active cell without replacing DOM before native focus',
)
const pointerdownBlock = mainSource.slice(
  mainSource.indexOf("input.addEventListener('pointerdown'"),
  mainSource.indexOf("input.addEventListener('change'", mainSource.indexOf("input.addEventListener('pointerdown'")),
)
assert(!pointerdownBlock.includes('event.preventDefault()'), 'Pointer cell switch should not prevent native focus')
assert(
  mainSource.includes("event.key === 'Tab'") &&
    mainSource.includes("event.shiftKey ? 'previous' : 'next'"),
  'Tab and Shift+Tab navigation should be wired',
)
assert(mainSource.includes('Enter: event.shiftKey ?'), 'Enter navigation should be wired')
assert(
  mainSource.includes('ArrowLeft') &&
    mainSource.includes('ArrowRight') &&
    mainSource.includes('ArrowUp') &&
    mainSource.includes('ArrowDown'),
  'Arrow navigation should be wired',
)
assert(
  mainSource.includes("document.querySelectorAll('[data-attendance-baseline-cell-input]')"),
  'Navigation should use editable inputs only, naturally skipping disabled/unassigned cells',
)
assert(
  attendanceSource.includes('attendance-baseline-disabled-cell is-unassigned') &&
    attendanceSource.includes('row.isUnassigned || !row.classSessionIds?.length'),
  'Unassigned rows should remain disabled and unfocusable',
)
assert(
  !mainSource.includes("input.addEventListener('input', () => {\n      commitAttendanceBaselineCellInput"),
  'Baseline cell should not commit/render on every keypress',
)
assert(
  mainSource.includes("control.type === 'month'") &&
    mainSource.includes("? ['input', 'change']") &&
    mainSource.includes('attendanceBoardFilters[filterName] === control.value'),
  'Month control should apply on input/change with no-op guard',
)
assert(
  mainSource.includes('saveStoredAttendanceRecords(getCurrentResolvedCenterId(), draftRecords)') &&
    mainSource.includes('getAttendanceBaselineDraftRecords(),'),
  'Save/reload current-center wiring should remain intact',
)
assert(styles.includes('.attendance-baseline-cell-input:focus'), 'Focused cell style should remain visible')

const changedFiles = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
assert(!/C8|teacher-roadmap|Teacher Roadmap/i.test(changedFiles), 'C8 Teacher files should not be changed')
assert(!/\.sql$/im.test(changedFiles), 'SQL files should not be changed')

console.log('FB Admin DreamHome attendance Excel navigation polish smoke passed')
