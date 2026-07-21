import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { buildTuitionRows, renderTuitionModule } from '../src/tuition-module.js'
import { renderStudentModule } from '../src/student-module.js'

const repoRoot = process.cwd()
const mainSource = fs.readFileSync(path.join(repoRoot, 'src/main.js'), 'utf8')
const tuitionSource = fs.readFileSync(path.join(repoRoot, 'src/tuition-module.js'), 'utf8')
const studentSource = fs.readFileSync(path.join(repoRoot, 'src/student-module.js'), 'utf8')
const stylesSource = fs.readFileSync(path.join(repoRoot, 'src/styles.css'), 'utf8')
const docsSource = fs.readFileSync(
  path.join(repoRoot, 'docs/fb-21072026-hoc-phi-ghi-chu-box-giong-hoc-vien.md'),
  'utf8',
)

const students = [
  {
    id: 'student-tuition-note-empty',
    fullName: 'Hoc vien chua note',
    parentName: 'Phu huynh A',
    parentPhone: '0900000001',
    currentStatus: 'Đang theo học',
    careNotes: [],
  },
  {
    id: 'student-tuition-note-has',
    fullName: 'Hoc vien co note',
    parentName: 'Phu huynh B',
    parentPhone: '0900000002',
    currentStatus: 'Đang theo học',
    careNotes: [
      {
        id: 'tuition-note-existing',
        createdAt: '2026-07-21T08:00:00.000Z',
        author: 'Admin DreamHome',
        content: 'Đã hẹn ngày thanh toán học phí.',
        tags: ['Học phí'],
        sourceModule: 'tuition',
      },
    ],
  },
]

const tuitionRecords = [
  {
    id: 'tuition-note-empty',
    studentId: 'student-tuition-note-empty',
    packageName: 'Goi 8 buoi',
    totalSessions: 8,
    usedSessions: 2,
    totalAmount: 1600000,
    paidAmount: 800000,
    dueDate: '2026-07-31',
    note: 'Legacy row note must not render inline',
  },
  {
    id: 'tuition-note-has',
    studentId: 'student-tuition-note-has',
    packageName: 'Goi 8 buoi',
    totalSessions: 8,
    usedSessions: 3,
    totalAmount: 1600000,
    paidAmount: 1600000,
    dueDate: '2026-07-31',
    note: '',
  },
]

const rowsBefore = buildTuitionRows(students, tuitionRecords)
assert.equal(rowsBefore[0].tuition.usedSessions, 2, 'Tuition usedSessions is preserved before render.')
assert.equal(rowsBefore[0].remainingSessions, 6, 'Remaining sessions still uses stored usedSessions.')
assert.equal(rowsBefore[1].careNotes.length, 1, 'Tuition rows read shared student care notes.')

const html = renderTuitionModule(students, tuitionRecords, { query: '', status: 'all', package: 'all' })
assert(html.includes('data-tuition-action="open-care-notes"'), 'Tuition note badge opens care note box.')
assert(html.includes('data-tuition-action="open-advisory-window"'), 'Tuition main view has monthly care entry button.')
assert(html.includes('Chăm sóc cuối tháng'), 'Tuition main view keeps a compact monthly care entry.')
assert(!html.includes('class="tuition-advisory-table"'), 'Monthly care table is not rendered inline in the main tuition view.')
assert(html.includes('Chưa có ghi chú'), 'Student without notes shows empty note badge.')
assert(html.includes('Có ghi chú (1)'), 'Student with notes shows note badge with count.')
assert(!html.includes('Legacy row note must not render inline'), 'Tuition table no longer renders long note inline.')
assert(html.includes('data-tuition-action="open-rollback-preview"'), 'Tuition audit history button remains available.')

const panelHtml = renderTuitionModule(
  students,
  tuitionRecords,
  { query: '', status: 'all', package: 'all' },
  null,
  null,
  null,
  [],
  [],
  '2026-07',
  null,
  [],
  {
    studentId: 'student-tuition-note-has',
    values: {
      tag: 'Học phí',
      content: 'Cần gọi lại phụ huynh',
    },
    saveState: 'saved',
  },
)
assert(panelHtml.includes('Chăm sóc / Ghi chú - Hoc vien co note'), 'Care note box title includes student name.')
assert(panelHtml.includes('tuition-full-window-panel tuition-care-note-panel'), 'Tuition care note opens as a full-window panel.')
assert(panelHtml.includes('data-tuition-scroll-region="care-note-window"'), 'Tuition care note body is a locked scroll region.')
assert(panelHtml.includes('Lịch sử ghi chú chăm sóc'), 'Care note box has history.')
assert(panelHtml.includes('Thêm ghi chú chăm sóc'), 'Care note box has add form.')
assert(panelHtml.includes('Tag / chủ đề'), 'Care note box has tag field.')
assert(panelHtml.includes('Nội dung ghi chú'), 'Care note box has content field.')
assert(panelHtml.includes('Phụ huynh cần được nhắc học phí'), 'Care note box has tuition consulting suggestion chips.')
assert(panelHtml.includes('data-tuition-care-note-suggestion='), 'Suggestion chips are wired buttons.')
assert(panelHtml.includes('data-tuition-care-note-action="save"'), 'Save care note action is wired.')
assert(panelHtml.includes('Đã lưu ghi chú chăm sóc.'), 'Save feedback is rendered.')
assert(panelHtml.includes('Học phí'), 'Tuition source/tag is visible in history/form.')

const advisoryWindowHtml = renderTuitionModule(
  students,
  tuitionRecords,
  { query: '', status: 'all', package: 'all' },
  null,
  null,
  null,
  [],
  [],
  '2026-07',
  null,
  [],
  null,
  { isOpen: true },
)
assert(advisoryWindowHtml.includes('tuition-full-window-panel tuition-advisory-window-panel'), 'Monthly care opens in a full-window panel.')
assert(advisoryWindowHtml.includes('data-tuition-advisory-window-action="close"'), 'Monthly care window has a close action.')
assert(advisoryWindowHtml.includes('class="tuition-advisory-table"'), 'Monthly care table remains available inside the window.')
assert(advisoryWindowHtml.includes('data-tuition-scroll-region="advisory-window"'), 'Monthly care window body is a locked scroll region.')

const studentHtml = renderStudentModule(
  students,
  { query: '', status: 'all', selectedStudentId: null },
  null,
  [],
  [],
)
assert(studentHtml.includes('data-student-note-action="open-care-notes"'), 'Student module reads the same care note model.')
assert(studentHtml.includes('Có ghi chú'), 'Tuition-created care notes make Student module show note badge.')

const saveFunctionBlock = mainSource.slice(
  mainSource.indexOf('function saveTuitionCareNote'),
  mainSource.indexOf('function renderPlannedList'),
)
assert(saveFunctionBlock.includes("sourceModule: 'tuition'"), 'Tuition notes are marked with sourceModule=tuition.')
assert(saveFunctionBlock.includes('saveStoredStudents(students)'), 'Tuition notes persist through shared student storage.')
assert(!saveFunctionBlock.includes('saveStoredTuition'), 'Saving tuition notes must not mutate tuition records.')
assert(!saveFunctionBlock.includes('queueCoreCloudSync'), 'Tuition note hotfix must not trigger cloud sync.')
assert(!saveFunctionBlock.includes('writeStudentThroughCloud'), 'Tuition note hotfix must not call Supabase/cloud write.')
assert(!saveFunctionBlock.includes('attendance'), 'Tuition note save must not touch attendance.')
const openCareNotesBlock = mainSource.slice(
  mainSource.indexOf('document.querySelectorAll(\'[data-tuition-action="open-care-notes"]\')'),
  mainSource.indexOf('document.querySelectorAll(\'[data-tuition-action="open-advisory-window"]\')'),
)
assert(openCareNotesBlock.includes('tuitionCareNoteState = createTuitionCareNoteState(studentId)'), 'Open note badge creates tuition care note state.')
assert(!openCareNotesBlock.includes('tuitionCareNoteState = null'), 'Open note badge must not immediately clear note state.')
assert(openCareNotesBlock.includes('withTuitionViewportLock'), 'Open note badge is protected by tuition viewport lock.')
const viewportLockBlock = mainSource.slice(
  mainSource.indexOf('function getScrollableTuitionElements'),
  mainSource.indexOf('function updateClock'),
)
assert(viewportLockBlock.includes('window.scrollX'), 'Tuition viewport lock captures window scrollX.')
assert(viewportLockBlock.includes('window.scrollY'), 'Tuition viewport lock captures window scrollY.')
assert(viewportLockBlock.includes('requestAnimationFrame'), 'Tuition viewport lock restores after render frames.')
assert(viewportLockBlock.includes('focusElementWithoutScrolling'), 'Tuition viewport lock restores focus without scrolling.')
assert(viewportLockBlock.includes('data-tuition-scroll-region'), 'Tuition viewport lock restores stable scroll regions.')
assert(mainSource.includes('document.querySelectorAll(\'[data-tuition-action="open-advisory-window"]\')'), 'Monthly care open handler is wired.')
assert(mainSource.includes('document.querySelectorAll(\'[data-tuition-advisory-window-action]\')'), 'Monthly care close handler is wired.')
assert(mainSource.includes('document.querySelectorAll(\'[data-tuition-care-note-suggestion]\')'), 'Tuition care note suggestion handler is wired.')
assert(!tuitionSource.includes('href="#"'), 'Tuition actions must not use dead anchors.')
assert(tuitionSource.includes('tuitionCareNoteSuggestions'), 'Tuition module owns tuition-specific consulting chips.')
assert(tuitionSource.includes('getStudentCareNotes(student)'), 'Tuition module reuses student care notes by studentId.')
assert(tuitionSource.includes('renderTuitionCareNotePanel'), 'Tuition module renders care note box.')
assert(stylesSource.includes('.tuition-care-note-button'), 'Tuition note badge styles exist.')
assert(stylesSource.includes('.tuition-care-note-panel'), 'Tuition note panel styles exist.')
assert(stylesSource.includes('.tuition-full-window-panel'), 'Tuition full-window panel styles exist.')
assert(stylesSource.includes('.tuition-advisory-entry'), 'Monthly care entry styles exist.')
assert(studentSource.includes('student-note-badge'), 'Student module note badge remains available.')
assert(docsSource.includes('Ghi chú Học phí lưu vào `students[].careNotes`'), 'Docs record shared note storage.')
assert(docsSource.includes('full-window'), 'Docs record F23.1 full-window behavior.')
assert(docsSource.includes('Không update tuition.usedSessions'), 'Docs record tuition calculation guard.')

const rowsAfter = buildTuitionRows(students, tuitionRecords)
assert.deepEqual(
  tuitionRecords.map((record) => ({
    id: record.id,
    usedSessions: record.usedSessions,
    totalSessions: record.totalSessions,
    paidAmount: record.paidAmount,
  })),
  [
    { id: 'tuition-note-empty', usedSessions: 2, totalSessions: 8, paidAmount: 800000 },
    { id: 'tuition-note-has', usedSessions: 3, totalSessions: 8, paidAmount: 1600000 },
  ],
  'Tuition records and calculations are unchanged.',
)
assert.equal(rowsAfter[0].remainingSessions, 6, 'Remaining sessions is unchanged after note rendering.')

for (const source of [mainSource, tuitionSource, stylesSource, docsSource, fs.readFileSync(new URL(import.meta.url), 'utf8')]) {
  for (const marker of getMojibakeMarkers()) {
    assert(!source.includes(marker), `Mojibake marker must not appear: ${marker}`)
  }
}

console.log('FB 21/07/2026 Học phí ghi chú box giống Học viên smoke: PASS')

function getMojibakeMarkers() {
  return [
    fromCodePoints(0x43, 0x102, 0xa1, 0xc2, 0xba),
    fromCodePoints(0x102, 0x192),
    fromCodePoints(0x102, 0x2020, 0xc2, 0xb0),
    fromCodePoints(0x48, 0x102, 0xa1, 0xc2, 0xba),
    fromCodePoints(0x102, 0xa1, 0xc2, 0xbb),
    fromCodePoints(
      0x42, 0x75, 0x102, 0xa1, 0xc2, 0xbb, 0xe2, 0x20ac, 0xa2, 0x69,
      0x20, 0x68, 0x102, 0xa1, 0xc2, 0xbb, 0xc2, 0x8d, 0x63, 0x20,
      0x6d, 0x102, 0xa1, 0xc2, 0xbb, 0xe2, 0x20ac, 0xba, 0x69,
    ),
  ]
}

function fromCodePoints(...codePoints) {
  return String.fromCodePoint(...codePoints)
}
