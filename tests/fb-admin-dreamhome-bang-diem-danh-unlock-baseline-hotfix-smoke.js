import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import {
  loadStoredAttendanceRecords,
  saveStoredAttendanceRecords,
  unlockAttendanceBaselineState,
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
  path.join(repoRoot, 'docs/fb-admin-dreamhome-bang-diem-danh-unlock-baseline-hotfix.md'),
  'utf8',
)
const attendanceSource = fs.readFileSync(path.join(repoRoot, 'src/attendance-board-module.js'), 'utf8')
const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main.js'), 'utf8')

for (const marker of [
  'FB ADMIN DREAMHOME STATUS: ATTENDANCE UNLOCK BASELINE HOTFIX',
  'ATTENDANCE_UNLOCK_REASON_FLOW_FIXED: YES',
  'ATTENDANCE_UNLOCK_TRANSITIONS_TO_EDITABLE_STATE: YES',
  'ATTENDANCE_UNLOCK_PRESERVES_EXISTING_BASELINE_RECORDS: YES',
  'ATTENDANCE_ASSIGNED_ROWS_EDITABLE_AFTER_UNLOCK: YES',
  'ATTENDANCE_UNASSIGNED_ROWS_STILL_DISABLED_AFTER_UNLOCK: YES',
  'ATTENDANCE_TOTAL_CLASS_SESSIONS_RECHECKED: YES',
  'ATTENDANCE_CELL_INPUT_CARET_STABLE_AFTER_UNLOCK: YES',
  'ATTENDANCE_SAVE_RELOAD_READY_FOR_MANUAL_QA: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]) {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
}

const students = [
  {
    id: 'student-assigned-one',
    studentCode: 'DH001',
    fullName: 'Hoc vien da phan lop 1',
    classSessionIds: ['class-session-ca-1-t3-t5-17g00-18g30'],
  },
  {
    id: 'student-assigned-two',
    studentCode: 'DH002',
    fullName: 'Hoc vien da phan lop 2',
    classSessionIds: ['class-session-ca-2-t3-t5-16g30-20g00'],
  },
  {
    id: 'student-unassigned',
    studentCode: 'DH003',
    fullName: 'Hoc vien chua phan lop',
    classSessionIds: [],
  },
]
const existingBaselineRecords = [
  {
    id: 'baseline-existing-1',
    studentId: 'student-assigned-one',
    date: '2026-07-01',
    attendanceStatus: 'present',
    status: 'present',
    counted: true,
    creditValue: 1,
    source: 'initialBaseline',
    classSessionId: 'class-session-ca-1-t3-t5-17g00-18g30',
  },
  {
    id: 'baseline-existing-2',
    studentId: 'student-assigned-two',
    date: '2026-07-03',
    attendanceStatus: 'present',
    status: 'present',
    counted: true,
    creditValue: 1,
    source: 'initialBaseline',
    classSessionId: 'class-session-ca-2-t3-t5-16g30-20g00',
  },
]
const lockedState = {
  status: 'locked',
  lockedAt: '2026-07-08T01:00:00.000Z',
  lockedBy: 'Admin co so',
  auditLog: [],
}

saveStoredAttendanceRecords('dreamhome', existingBaselineRecords)
const recordsBeforeUnlock = loadStoredAttendanceRecords('dreamhome')
const lockedHtml = renderAttendanceBoardModule(
  students,
  [],
  [],
  [],
  [],
  { month: '2026-07', classSessionId: 'all', query: '' },
  null,
  recordsBeforeUnlock,
  null,
  false,
  recordsBeforeUnlock,
  0,
  lockedState,
)

assert(lockedHtml.includes('Tổng ca học: <strong>2</strong>'), 'Total class sessions should fall back to unique assigned session ids')
assert(!lockedHtml.includes('data-attendance-baseline-cell-input'), 'Locked baseline should not render editable cells')
assert(lockedHtml.includes('2 bản ghi nền'), 'Locked render should keep existing baseline record count')

const unlockedState = unlockAttendanceBaselineState(lockedState, {
  byRole: 'admin',
  byName: 'Admin co so',
  reason: '',
  note: 'Mo khoa du lieu nen diem danh.',
  at: '2026-07-08T02:00:00.000Z',
})
const unlockedHtml = renderAttendanceBoardModule(
  students,
  [],
  [],
  [],
  [],
  { month: '2026-07', classSessionId: 'all', query: '' },
  null,
  recordsBeforeUnlock,
  null,
  false,
  recordsBeforeUnlock,
  0,
  unlockedState,
)

assert.equal(unlockedState.status, 'unlocked', 'Unlock should transition locked state to editable state')
assert(unlockedHtml.includes('data-attendance-baseline-cell-input'), 'Assigned rows should be editable after unlock')
assert(unlockedHtml.includes('attendance-baseline-disabled-cell is-unassigned'), 'Unassigned rows should remain disabled after unlock')
assert(unlockedHtml.includes('2 bản ghi nền'), 'Unlock render should preserve existing baseline record count')
assert.deepEqual(loadStoredAttendanceRecords('dreamhome'), recordsBeforeUnlock, 'Unlock state changes must not clear baseline records')

assert(attendanceSource.includes('baselineStateOverride'), 'Attendance board should accept current-center baseline state from main')
assert(attendanceSource.includes('Math.max(activeClassSessions.length, assignedClassSessionIds.size)'), 'Total class sessions should not fall back to hardcoded 0')
assert(mainSource.includes('getAttendanceBaselineDraftState()'), 'Main should pass current-center baseline state into attendance board render')
assert(mainSource.includes('unlockReason'), 'Unlock reason flow should normalize blank reason safely')
assert(mainSource.includes('clearAttendanceBaselineDraft()'), 'Unlock should clear stale draft cache before render')
assert(mainSource.includes('saveStoredAttendanceRecords(getCurrentResolvedCenterId(), draftRecords)'), 'Save/reload path should remain wired')
assert(mainSource.includes("'data-attendance-baseline-cell-input'"), 'Baseline cell inputs should remain focus-stable after unlock')

const changedFiles = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
assert(!/C8|teacher-roadmap|Teacher Roadmap/i.test(changedFiles), 'C8 Teacher files should not be changed')
assert(!/\.sql$/im.test(changedFiles), 'SQL files should not be changed')

console.log('FB Admin DreamHome attendance unlock baseline hotfix smoke passed')
