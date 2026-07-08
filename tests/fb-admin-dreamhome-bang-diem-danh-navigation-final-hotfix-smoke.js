import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = process.cwd()
const docs = fs.readFileSync(
  path.join(repoRoot, 'docs/fb-admin-dreamhome-bang-diem-danh-navigation-final-hotfix.md'),
  'utf8',
)
const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main.js'), 'utf8')
const attendanceSource = fs.readFileSync(path.join(repoRoot, 'src/attendance-board-module.js'), 'utf8')

for (const marker of [
  'FB ADMIN DREAMHOME STATUS: ATTENDANCE NAVIGATION FINAL HOTFIX',
  'ATTENDANCE_CORE_SAVE_RELOAD_ALREADY_PASS: YES',
  'ATTENDANCE_KEYDOWN_HANDLER_BOUND_TO_CELL_INPUTS: YES',
  'ATTENDANCE_CELL_TAB_NAVIGATION_FIXED: YES',
  'ATTENDANCE_CELL_SHIFT_TAB_NAVIGATION_FIXED: YES',
  'ATTENDANCE_CELL_ENTER_NAVIGATION_FIXED: YES',
  'ATTENDANCE_CELL_ARROW_NAVIGATION_FIXED: YES',
  'ATTENDANCE_CELL_DISABLED_SKIP_NAVIGATION: YES',
  'ATTENDANCE_CELL_NO_FULL_RENDER_ON_KEYPRESS: YES',
  'ATTENDANCE_CELL_DOES_NOT_FOCUS_BACK_TO_OLD_CELL: YES',
  'ATTENDANCE_MONTH_CONTROL_INPUT_OR_CHANGE_FIXED: YES',
  'ATTENDANCE_SAVE_RELOAD_REGRESSION_CHECKED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]) {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
}

assert(mainSource.includes("document.querySelectorAll('[data-attendance-baseline-cell-input]').forEach((input)"), 'Keydown should bind to baseline cell inputs')
assert(mainSource.includes("input.addEventListener('keydown'"), 'Baseline cell keydown handler should exist')
assert(mainSource.includes("event.key === 'Tab'"), 'Tab should be handled')
assert(mainSource.includes("event.shiftKey ? 'previous' : 'next'"), 'Shift+Tab should be handled')
assert(mainSource.includes('Enter: event.shiftKey ?'), 'Enter should be handled')
for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) {
  assert(mainSource.includes(key), `${key} should be handled`)
}

const keydownBlock = mainSource.slice(
  mainSource.indexOf("input.addEventListener('keydown'"),
  mainSource.indexOf("document.querySelector('[data-attendance-baseline-action=\"save\"]')"),
)
assert(keydownBlock.includes('event.preventDefault()'), 'Navigation keys should prevent native focus handling')
assert(keydownBlock.includes('shouldRender: false'), 'Keyboard navigation should commit without full render')
assert(keydownBlock.includes('focusAttendanceBaselineCellTarget(focusTarget)'), 'Keyboard navigation should focus target directly')
assert(keydownBlock.includes('attendanceBaselineCommittedValue'), 'Keyboard navigation should avoid change-event focus snapback')
assert(mainSource.includes('function focusAttendanceBaselineCellTarget(target)'), 'Direct target focus helper should exist')
assert(mainSource.includes("document.querySelectorAll('[data-attendance-baseline-cell-input]')"), 'Navigation should use editable inputs only')
assert(attendanceSource.includes('attendance-baseline-disabled-cell is-unassigned'), 'Unassigned cells should remain disabled')
assert(
  mainSource.includes("element.closest?.('[data-student-filter], [data-attendance-board-filter]')"),
  'Attendance board filters should be allowed to render immediately when active',
)
assert(
  mainSource.includes("control.type === 'month'") &&
    mainSource.includes("? ['input', 'change']") &&
    mainSource.includes('attendanceBoardFilters[filterName] === control.value'),
  'Month control should listen to input/change with unchanged-value guard',
)
assert(mainSource.includes('saveStoredAttendanceRecords(getCurrentResolvedCenterId(), draftRecords)'), 'Save persistence wiring should remain')

const changedFiles = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
assert(!/C8|teacher-roadmap|Teacher Roadmap/i.test(changedFiles), 'C8 Teacher files should not be changed')
assert(!/\.sql$/im.test(changedFiles), 'SQL files should not be changed')

console.log('FB Admin DreamHome attendance navigation final hotfix smoke passed')
