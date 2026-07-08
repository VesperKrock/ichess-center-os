import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'
import {
  loadAttendanceBaselineState,
  loadStoredAttendanceRecords,
  parseInitialBaselineCellInput,
  saveAttendanceBaselineState,
  saveStoredAttendanceRecords,
  startAttendanceBaselineDraft,
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
const docsPath = path.join(repoRoot, 'docs/fb-admin-dreamhome-bang-diem-danh-nhap-nen-muot.md')
const docs = fs.readFileSync(docsPath, 'utf8')
const source = fs.readFileSync(path.join(repoRoot, 'src/attendance-board-module.js'), 'utf8')
const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main.js'), 'utf8')
const styles = fs.readFileSync(path.join(repoRoot, 'src/styles.css'), 'utf8')

for (const marker of [
  'FB ADMIN DREAMHOME STATUS: ATTENDANCE BASELINE SMOOTH INPUT',
  'ATTENDANCE_CLASS_SESSION_LABEL_RESOLVED: YES',
  'ATTENDANCE_TOTAL_CLASS_SESSIONS_FIXED: YES',
  'ATTENDANCE_UNASSIGNED_BADGE_WARNING_RED: YES',
  'ATTENDANCE_UNASSIGNED_ROWS_DISABLED: YES',
  'ATTENDANCE_ASSIGNED_ROWS_EDITABLE: YES',
  'ATTENDANCE_BASELINE_UNLOCK_EDIT_FLOW_FIXED: YES',
  'ATTENDANCE_CELL_INPUT_CARET_STABLE: YES',
  'ATTENDANCE_CELL_VALIDATION_PRESERVED: YES',
  'ATTENDANCE_SAVE_RELOAD_LOCAL_PERSISTENCE_FIXED: YES',
  'ATTENDANCE_EXCEL_LIKE_KEYBOARD_BASIC: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]) {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
}

const rawClassSessionId = 'class-session-ca-2-t3-t5-16g30-20g00'
const students = [
  {
    id: 'student-assigned',
    studentCode: 'DH001',
    fullName: 'Hoc vien da phan lop',
    parentName: 'Phu huynh A',
    parentPhone: '0900000001',
    classSessionIds: [rawClassSessionId],
  },
  {
    id: 'student-unassigned',
    studentCode: 'DH002',
    fullName: 'Hoc vien chua phan lop',
    parentName: 'Phu huynh B',
    parentPhone: '0900000002',
    classSessionIds: [],
  },
]
const classSessions = [
  {
    id: rawClassSessionId,
    name: rawClassSessionId,
    displayLabel: rawClassSessionId,
    status: 'active',
  },
  {
    id: 'class-session-t3-t5-17-00-18-30',
    name: 'T3-T5 17:00-18:30',
    displayLabel: 'T3-T5 17:00-18:30',
    status: 'active',
  },
]
const month = new Date().toISOString().slice(0, 7)
const draftState = startAttendanceBaselineDraft(loadAttendanceBaselineState('dreamhome'), {
  byRole: 'admin',
  byName: 'Admin co so',
  at: '2026-07-08T08:00:00.000Z',
})
saveAttendanceBaselineState('dreamhome', draftState)

const html = renderAttendanceBoardModule(
  students,
  classSessions,
  [],
  [],
  [],
  { month, classSessionId: 'all', query: '' },
  null,
  [],
)

assert(html.includes('Tổng ca học: <strong>2</strong>'), 'Total class sessions should use active Settings class sessions')
assert(html.includes('T3-T5 16:30-20:00'), 'Raw class session id should resolve to a product-facing label')
assert(!html.includes(`>${rawClassSessionId}<`), 'Raw class-session id must not render as the primary label')
assert(html.includes('attendance-stat-chip is-warning'), 'Unassigned badge should have warning styling')
assert(html.includes('attendance-unassigned'), 'Unassigned student should keep a clear badge')
assert(html.includes('attendance-baseline-disabled-cell is-unassigned'), 'Unassigned baseline cells should be disabled')
assert(html.includes('Chưa phân lớp, hãy chọn Ca học / Lớp trong hồ sơ học viên.'), 'Disabled cells should explain why')
assert(html.includes('data-attendance-baseline-cell-input'), 'Assigned students should get editable baseline inputs in draft mode')

const missingHtml = renderAttendanceBoardModule(
  [
    {
      id: 'student-missing-session',
      fullName: 'Hoc vien ca missing',
      classSessionIds: ['class-session-legacy-missing'],
    },
  ],
  [],
  [],
  [],
  [],
  { month, classSessionId: 'all', query: '' },
  null,
  [],
)
assert(missingHtml.includes('Ca học không tìm thấy'), 'Unparseable missing sessions should show a product-facing warning label')
assert(!missingHtml.includes('>class-session-legacy-missing<'), 'Missing raw id must not become the primary label')

for (const token of ['1', '3+4', '1+3', 'T', 'V', 'P', 'CP', 'B', '']) {
  assert.equal(parseInitialBaselineCellInput(token).valid, true, `${token || 'empty'} should remain valid`)
}
assert.equal(parseInitialBaselineCellInput('abc').valid, false, 'Invalid token should remain invalid')

const upsertResult = upsertInitialBaselineAttendanceRecord({
  records: loadStoredAttendanceRecords('dreamhome'),
  state: draftState,
  input: {
    ...parseInitialBaselineCellInput('3+4').input,
    studentId: 'student-assigned',
    date: `${month}-01`,
    classSessionId: rawClassSessionId,
  },
  byRole: 'admin',
  byName: 'Admin co so',
  at: '2026-07-08T08:05:00.000Z',
})
saveStoredAttendanceRecords('dreamhome', upsertResult.records)
assert(
  loadStoredAttendanceRecords('dreamhome').some((record) =>
    record.studentId === 'student-assigned' &&
    record.source === 'initialBaseline' &&
    record.date === `${month}-01` &&
    record.creditValue === 2
  ),
  'Saved baseline records should reload from local persistence',
)

assert(source.includes('function resolveClassSessionLabelFromRawId'), 'Attendance module should resolve raw class session ids')
assert(source.includes('isRawClassSessionLabel'), 'Attendance module should guard raw labels from real class sessions too')
assert(source.includes('row.isUnassigned || !row.classSessionIds?.length'), 'Unassigned rows should not be editable')
assert(mainSource.includes("'data-attendance-baseline-cell-input'"), 'Baseline cell inputs should be focus-stable across renders')
assert(!mainSource.includes("input.addEventListener('input', () => {\n      commitAttendanceBaselineCellInput"), 'Baseline cells should not commit/render on every keypress')
assert(mainSource.includes('ArrowDown') && mainSource.includes("event.key === 'Tab'"), 'Basic Excel-like keyboard handling should remain')
assert(styles.includes('.attendance-board-stats .attendance-stat-chip.is-warning'), 'Warning chip CSS should exist')
assert(styles.includes('.attendance-baseline-disabled-cell.is-unassigned'), 'Disabled unassigned cell CSS should exist')

const changedFiles = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
assert(!/C8|teacher-roadmap|Teacher Roadmap/i.test(changedFiles), 'C8 Teacher files should not be changed')
assert(!/\.sql$/im.test(changedFiles), 'SQL files should not be changed')

console.log('FB Admin DreamHome attendance baseline smooth input smoke passed')
