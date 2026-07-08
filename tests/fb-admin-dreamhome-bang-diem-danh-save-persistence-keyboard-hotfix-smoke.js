import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import {
  loadStoredAttendanceRecords,
  lockAttendanceBaselineState,
  parseInitialBaselineCellInput,
  saveAttendanceBaselineDraftState,
  saveAttendanceBaselineState,
  saveStoredAttendanceRecords,
  unlockAttendanceBaselineState,
  upsertInitialBaselineAttendanceRecord,
} from '../src/attendance-records.js'

function createLocalStorageMock() {
  const values = new Map()

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

globalThis.localStorage = createLocalStorageMock()

const repoRoot = process.cwd()
const docs = fs.readFileSync(
  path.join(repoRoot, 'docs/fb-admin-dreamhome-bang-diem-danh-save-persistence-keyboard-hotfix.md'),
  'utf8',
)
const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main.js'), 'utf8')
const attendanceSource = fs.readFileSync(path.join(repoRoot, 'src/attendance-board-module.js'), 'utf8')

for (const marker of [
  'FB ADMIN DREAMHOME STATUS: ATTENDANCE SAVE PERSISTENCE KEYBOARD HOTFIX',
  'ATTENDANCE_SAVE_PRESERVES_BASELINE_RECORDS: YES',
  'ATTENDANCE_SAVE_DOES_NOT_RESET_TO_UNINITIALIZED: YES',
  'ATTENDANCE_RELOAD_LOCAL_PERSISTENCE_FIXED: YES',
  'ATTENDANCE_LOCK_PRESERVES_RECORDS: YES',
  'ATTENDANCE_UNLOCK_AFTER_LOCK_PRESERVES_RECORDS: YES',
  'ATTENDANCE_CELL_ONE_CLICK_SWITCH_FIXED: YES',
  'ATTENDANCE_CELL_TAB_NAVIGATION_FIXED: YES',
  'ATTENDANCE_CELL_ENTER_NAVIGATION_FIXED: YES',
  'ATTENDANCE_CELL_ARROW_NAVIGATION_SAFE: YES',
  'ATTENDANCE_UNASSIGNED_ROWS_STILL_DISABLED: YES',
  'ATTENDANCE_MONTH_CONTROL_RENDER_SAFE: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]) {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
}

const centerId = 'dreamhome'
const classSessionId = 'class-session-ca-1-t3-t5-17g00-18g30'
const students = [
  {
    id: 'student-save-hotfix',
    fullName: 'Hoc vien save hotfix',
    studentCode: 'SAVE001',
    classSessionIds: [classSessionId],
  },
  {
    id: 'student-save-unassigned',
    fullName: 'Hoc vien chua phan lop',
    studentCode: 'SAVE002',
    classSessionIds: [],
  },
]
const unlockedState = {
  status: 'unlocked',
  unlockedAt: '2026-07-08T03:00:00.000Z',
  unlockedBy: 'Admin co so',
  unlockReason: 'Manual QA save hotfix',
  auditLog: [],
}
const initialRecords = [
  {
    id: 'baseline-existing-save-hotfix',
    studentId: 'student-save-hotfix',
    date: '2026-07-01',
    attendanceStatus: 'present',
    status: 'present',
    counted: true,
    creditValue: 1,
    source: 'initialBaseline',
    classSessionId,
  },
]

saveStoredAttendanceRecords(centerId, initialRecords)
saveAttendanceBaselineState(centerId, unlockedState)

const upsert = upsertInitialBaselineAttendanceRecord({
  records: loadStoredAttendanceRecords(centerId),
  state: unlockedState,
  input: {
    ...parseInitialBaselineCellInput('3+4').input,
    studentId: 'student-save-hotfix',
    date: '2026-07-03',
    classSessionId,
  },
  byRole: 'admin',
  byName: 'Admin co so',
  at: '2026-07-08T03:05:00.000Z',
})
assert.equal(upsert.blocked, false, 'Draft upsert should be allowed while unlocked')

const savedState = saveAttendanceBaselineDraftState(upsert.state, {
  byRole: 'admin',
  byName: 'Admin co so',
  at: '2026-07-08T03:06:00.000Z',
})
saveStoredAttendanceRecords(centerId, upsert.records)
saveAttendanceBaselineState(centerId, savedState)

const persistedRecords = loadStoredAttendanceRecords(centerId)
assert.equal(savedState.status, 'unlocked', 'Save should not reset baseline to notStarted')
assert.equal(persistedRecords.filter((record) => record.source === 'initialBaseline').length, 2)
assert(
  persistedRecords.some((record) =>
    record.studentId === 'student-save-hotfix' &&
    record.date === '2026-07-03' &&
    record.creditValue === 2
  ),
  'Saved baseline record should reload from local persistence',
)

const savedHtml = renderAttendanceBoardModule(
  students,
  [],
  [],
  [],
  [],
  { month: '2026-07', classSessionId: 'all', query: '' },
  null,
  [],
  null,
  false,
  persistedRecords,
  0,
  savedState,
)
assert(savedHtml.includes('2 bản ghi nền'), 'Saved render should keep baseline record count')
assert(savedHtml.includes('data-attendance-baseline-cell-input'), 'Assigned rows should remain editable after save')
assert(savedHtml.includes('attendance-baseline-disabled-cell is-unassigned'), 'Unassigned rows should remain disabled')
assert(!savedHtml.includes('Chưa khởi tạo'), 'Save should not render as uninitialized')

const lockedState = lockAttendanceBaselineState(savedState, {
  byRole: 'admin',
  byName: 'Admin co so',
  at: '2026-07-08T03:10:00.000Z',
})
const lockedHtml = renderAttendanceBoardModule(
  students,
  [],
  [],
  [],
  [],
  { month: '2026-07', classSessionId: 'all', query: '' },
  null,
  [],
  null,
  false,
  persistedRecords,
  0,
  lockedState,
)
assert.equal(lockedState.status, 'locked')
assert(lockedHtml.includes('2 bản ghi nền'), 'Lock should preserve baseline records')
assert(!lockedHtml.includes('data-attendance-baseline-cell-input'), 'Locked state should be readonly')

const unlockedAgainState = unlockAttendanceBaselineState(lockedState, {
  byRole: 'admin',
  byName: 'Admin co so',
  reason: 'Mo khoa test lai',
  at: '2026-07-08T03:12:00.000Z',
})
const unlockedAgainHtml = renderAttendanceBoardModule(
  students,
  [],
  [],
  [],
  [],
  { month: '2026-07', classSessionId: 'all', query: '' },
  null,
  [],
  null,
  false,
  persistedRecords,
  0,
  unlockedAgainState,
)
assert.equal(unlockedAgainState.status, 'unlocked')
assert(unlockedAgainHtml.includes('2 bản ghi nền'), 'Unlock after lock should preserve records')
assert(unlockedAgainHtml.includes('data-attendance-baseline-cell-input'), 'Unlock after lock should restore editability')

assert(mainSource.includes('getAttendanceBaselineDraftRecords(),'), 'Render should pass current-center stored records even after draft is cleared')
assert(mainSource.includes("input.addEventListener('pointerdown'"), 'One-click cell switch should be wired')
assert(
  mainSource.includes('commitAttendanceBaselineCellInput(activeInput, {') &&
    mainSource.includes('focusTarget: getBaselineInputFocusTarget(input)') &&
    mainSource.includes('shouldRender: false'),
  'One-click switch should commit active cell and focus target without replacing DOM first',
)
assert(mainSource.includes("event.key === 'Tab'"), 'Tab navigation should remain wired')
assert(mainSource.includes('Enter: event.shiftKey ?'), 'Enter navigation should remain wired')
assert(mainSource.includes('ArrowLeft') && mainSource.includes('ArrowDown'), 'Arrow navigation should remain wired')
assert(
  mainSource.includes("control.type === 'month'") &&
    mainSource.includes("? ['input', 'change']") &&
    mainSource.includes('attendanceBoardFilters[filterName] === control.value'),
  'Month control should apply on input/change with a no-op guard',
)
assert(attendanceSource.includes('baselineStateOverride'), 'Attendance board should render supplied baseline state')

const changedFiles = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
assert(!/C8|teacher-roadmap|Teacher Roadmap/i.test(changedFiles), 'C8 Teacher files should not be changed')
assert(!/\.sql$/im.test(changedFiles), 'SQL files should not be changed')

console.log('FB Admin DreamHome attendance save persistence keyboard hotfix smoke passed')
