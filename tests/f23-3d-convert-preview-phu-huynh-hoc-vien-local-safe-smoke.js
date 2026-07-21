import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildParentConvertPreview,
  getParentConvertCandidates,
  initialParentConsultationFilters,
  renderParentConsultationModule,
} from '../src/parent-consultation-module.js'

const leadContact = {
  id: 'lead-f23-3d',
  contactType: 'consultingLead',
  customerStage: 'consulting',
  parentName: 'Nguyen Thu Ha',
  phone: '0901001001',
  secondaryPhone: '0901999888',
  email: 'ha@example.test',
  locationArea: 'Quan 7',
  source: 'facebook',
  consultantName: 'Tu van A',
  leadStudentName: 'Nguyen Minh An',
  studentBirthYear: '2016',
  leadStudentAge: '10',
  interestedProgram: 'Co vua nhap mon',
  preferredSchedule: 'Toi thu 3',
  leadNeed: 'Can hoc thu truoc khi dang ky',
  consultationStatus: 'waitingResponse',
  careLogs: [{ id: 'care-1', content: 'Da goi tu van' }],
  appointments: [{ id: 'appt-1', scheduledAt: '2026-07-25T10:00:00.000Z' }],
}

const nameOnlyContact = {
  id: 'name-only-contact',
  contactType: 'consultingLead',
  customerStage: 'lead',
  parentName: 'Nguyen Thu Ha',
  phone: '0999000000',
  leadStudentName: 'Ten Khac',
  consultationStatus: 'newLead',
  source: 'zalo',
  careLogs: [],
  appointments: [],
}

const matchingStudent = {
  id: 'student-match-phone',
  fullName: 'Nguyen Minh An',
  birthDate: '2016-03-12',
  parentName: 'Nguyen Thu Ha',
  parentPhone: '0901001001',
  motherPhone: '',
  fatherPhone: '',
}

const nameOnlyStudent = {
  id: 'student-name-only',
  fullName: 'Hoc Vien Khac',
  birthDate: '2015-01-01',
  parentName: 'Nguyen Thu Ha',
  parentPhone: '0888000000',
}

const candidates = getParentConvertCandidates(
  leadContact,
  [leadContact, nameOnlyContact],
  [matchingStudent, nameOnlyStudent],
)

assert(candidates.some((candidate) => candidate.key === 'student:student-match-phone'), 'Phone match student candidate should be present.')
assert.equal(candidates.find((candidate) => candidate.key === 'student:student-match-phone')?.level, 'high')
assert(
  candidates.find((candidate) => candidate.key === 'student:student-match-phone')?.reasonLabels.includes('Trùng số điện thoại'),
  'Exact normalized phone match should explain the high warning.',
)
assert.equal(
  candidates.find((candidate) => candidate.key === 'student:student-name-only')?.level,
  'low',
  'Name-only match must stay low and never auto merge.',
)

const createPreview = buildParentConvertPreview(
  leadContact,
  [leadContact, nameOnlyContact],
  [matchingStudent, nameOnlyStudent],
  { mode: 'create' },
)

assert.equal(createPreview.warningLevel, 'high')
assert.equal(createPreview.warningLabel, 'Có khả năng trùng cao')
assert.equal(createPreview.mode, 'create')
assert(createPreview.parentRows.some((row) => row.label === 'Tên' && row.value === leadContact.parentName))
assert(createPreview.studentRows.some((row) => row.label === 'Họ tên' && row.value === leadContact.leadStudentName))
assert(createPreview.relationshipRows.includes('contact → linkedStudentIds'))

const mergePreview = buildParentConvertPreview(
  leadContact,
  [leadContact, nameOnlyContact],
  [matchingStudent, nameOnlyStudent],
  { mode: 'merge', selectedCandidateKey: 'student:student-match-phone' },
)

assert.equal(mergePreview.mode, 'merge')
assert.equal(mergePreview.selectedCandidate?.key, 'student:student-match-phone')
assert(mergePreview.mergeRows.some((row) => String(row.value).includes('Không tự ghi đè')), 'Merge plan is preview-only.')

const detailHtml = renderParentConsultationModule(
  [leadContact],
  initialParentConsultationFilters,
  [matchingStudent],
  null,
  null,
  null,
  'lead-f23-3d',
)

assert(detailHtml.includes('Chuẩn bị chuyển đổi'), 'Detail CRM has the convert preview action.')
assert(detailHtml.includes('data-parent-convert-preview-action="open"'), 'Convert preview action has a stable handler hook.')
assert(!detailHtml.includes('href="#"'), 'Convert preview must not use href="#".')

const previewHtml = renderParentConsultationModule(
  [leadContact],
  initialParentConsultationFilters,
  [matchingStudent],
  null,
  null,
  null,
  'lead-f23-3d',
  {
    contactId: 'lead-f23-3d',
    mode: 'create',
    selectedCandidateKey: 'student:student-match-phone',
  },
)

assert(previewHtml.includes('Chuẩn bị chuyển đổi - Nguyen Thu Ha'), 'Preview opens for the current contact.')
assert(previewHtml.includes('Nguồn dữ liệu CRM'), 'Preview reads CRM source data.')
assert(previewHtml.includes('Phụ huynh dự kiến'), 'Preview shows expected parent data.')
assert(previewHtml.includes('Học viên dự kiến'), 'Preview shows expected student data.')
assert(previewHtml.includes('Quan hệ dự kiến'), 'Preview shows expected relationship wiring.')
assert(previewHtml.includes('Tạo hồ sơ mới'), 'Preview has create-new mode.')
assert(previewHtml.includes('Ghép với hồ sơ có sẵn'), 'Preview has merge-existing mode.')
assert(previewHtml.includes('Gợi ý kiểm tra, không phải kết luận trùng hồ sơ'), 'Preview explains dedupe is only a suggestion.')
assert(previewHtml.includes('Đây chỉ là bản xem trước'), 'Preview warns it is read-only.')
assert(previewHtml.includes('Chưa tạo học viên'), 'Preview warns no student is created.')
assert(previewHtml.includes('Chưa tạo học phí'), 'Preview warns no tuition is created.')
assert(previewHtml.includes('Xác nhận chuyển đổi - chưa mở'), 'Real conversion confirmation remains disabled.')

const parentModuleSource = fs.readFileSync('src/parent-consultation-module.js', 'utf8')
const mainSource = fs.readFileSync('src/main.js', 'utf8')
const stylesSource = fs.readFileSync('src/styles.css', 'utf8')

assert(parentModuleSource.includes('buildParentConvertPreview'), 'Convert preview builder should exist.')
assert(parentModuleSource.includes('getParentConvertCandidates'), 'Read-only candidate/dedupe helper should exist.')
assert(mainSource.includes('parentConvertPreviewState'), 'Preview mode/candidate selection is temporary UI state.')
assert(!parentModuleSource.includes('saveStoredStudents'), 'Parent module must not write students.')
const previewHandlerBlock = mainSource.match(/document\.querySelectorAll\('\[data-parent-convert-preview-action="open"\]'\)[\s\S]*?document\.querySelectorAll\('\[data-parent-linked-student-id\]'\)/)?.[0] || ''
assert(previewHandlerBlock, 'Convert preview handlers should be inspectable.')
assert(!previewHandlerBlock.includes('saveStoredStudents'), 'Convert preview handlers must not write students.')
assert(!previewHandlerBlock.includes('saveStoredParentConsultations'), 'Convert preview handlers must not persist conversion writes.')
assert(!previewHandlerBlock.includes('saveStoredTuition'), 'Convert preview handlers must not create tuition records.')
assert(!previewHandlerBlock.includes('customerStage'), 'Convert preview handlers must not convert the active contact.')
assert(!previewHandlerBlock.includes('consultationStatus'), 'Convert preview handlers must not change consultation status.')
const previewBuilderBlock = parentModuleSource.match(/export function buildParentConvertPreview[\s\S]*?function formatDateTime/)?.[0] || ''
assert(previewBuilderBlock, 'Convert preview builder block should be inspectable.')
assert(!previewBuilderBlock.includes('tuitionRecords'), 'Convert preview builder must not create tuition records.')
assert(!previewBuilderBlock.includes('usedSessions'), 'Convert preview builder must not update tuition.usedSessions.')
assert(!previewBuilderBlock.includes("customerStage: 'converted'"), 'Convert preview builder must not convert the active contact.')
assert(!previewBuilderBlock.includes("consultationStatus: 'converted'"), 'Convert preview builder must not change consultation status.')
assert(!mainSource.toLowerCase().includes('teacher-workspace-module'), 'F23.3D must not touch Teacher Workspace.')
assert(!parentModuleSource.toLowerCase().includes('supabase'), 'F23.3D must not add Supabase behavior.')
assert(!parentModuleSource.toLowerCase().includes('auth'), 'F23.3D must not add Auth behavior.')
assert(stylesSource.includes('.parent-convert-preview-modal'), 'Convert preview modal styles should exist.')

for (const buttonMatch of parentModuleSource.matchAll(/<button\b[^>]*>/g)) {
  assert(
    buttonMatch[0].includes('type="button"') || buttonMatch[0].includes('disabled'),
    `Action button must have type="button": ${buttonMatch[0]}`,
  )
}

const mojibakeMarkers = [
  '\u0043\u0102\u00A1\u00C2\u00BA',
  '\u0102\u0192',
  '\u0102\u2020\u00C2\u00B0',
  '\u0048\u0102\u00A1\u00C2\u00BA',
  '\u0102\u00A1\u00C2\u00BB',
  '\u0042\u0075\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00A2\u0069\u0020\u0068\u0102\u00A1\u00C2\u00BB\u00C2\u008D\u0063\u0020\u006D\u0102\u00A1\u00C2\u00BB\u00E2\u20AC\u00BA\u0069',
]

for (const source of [parentModuleSource, mainSource, stylesSource]) {
  for (const marker of mojibakeMarkers) {
    assert(!source.includes(marker), `Mojibake marker must not appear: ${marker}`)
  }
}

console.log('F23.3D convert preview Phụ huynh/Học viên local-safe smoke passed')
