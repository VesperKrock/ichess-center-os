import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const staffModule = await import('../src/staff-module.js')
const teacherModule = await import('../src/teacher-module.js')

const main = read('src/main.js')
const staffSource = read('src/staff-module.js')
const teacherSource = read('src/teacher-module.js')
const styles = read('src/styles.css')

assert(main.includes("if (action === 'save') {\n        return\n      }"), 'Staff save click must allow native form submit.')
assert(main.includes('handleStaffFormSubmit(event.currentTarget)'), 'Staff form submit handler must be wired.')
assert(main.includes('matchingStaffCount !== 1'), 'Staff edit must replace exactly one stable staff record.')
assert(main.includes('Hồ sơ nhân viên thuộc cơ sở khác. Không thể lưu chéo cơ sở.'), 'Staff edit must guard true center switches clearly.')
assert(main.includes('focusFirstStaffFormError'), 'Validation errors must focus the form error area.')
assert(main.includes("fieldName === 'employmentStatus' && ['active', 'on-leave'].includes(value)"), 'Active/on-leave status changes must clear draft endDate.')

assert(staffSource.includes('function isEmploymentEndDateEnabled'))
assert(staffSource.includes('function getPersistedEmploymentEndDate'))
assert(staffSource.includes('function formatEmploymentPeriod'))
assert(teacherSource.includes('function isTeacherStaffEndDateEnabled'))
assert(styles.includes('.staff-field-hint'))
assert(styles.includes('.teacher-staff-link-hint'))

const teacher = {
  id: 'teacher-nguyen-truong-thinh',
  fullName: 'Nguyễn Trường Thịnh',
  displayName: 'Nguyễn Trường Thịnh',
  status: 'active',
}

const linkedStaff = {
  id: 'staff-linked-001',
  centerId: 'center-a',
  employeeCode: '001',
  fullName: 'Nguyễn Trường Thịnh',
  phone: '0901',
  email: 'thinh@example.com',
  departmentId: 'dept-academic',
  positionTitle: 'Giáo viên',
  employmentType: 'full-time',
  employmentStatus: 'active',
  startDate: '',
  endDate: '2026-07-01',
  teacherId: teacher.id,
  teacherLinkedAt: '2026-07-27T01:00:00.000Z',
  accountUserId: 'account-keep',
  membershipId: 'membership-keep',
  createdAt: '2026-07-27T00:00:00.000Z',
  updatedAt: '2026-07-27T01:00:00.000Z',
  unknownStaffField: 'preserve-me',
}

const editValues = {
  ...linkedStaff,
  employeeCode: ' GV001 ',
  endDate: '2026-08-01',
}
const editErrors = staffModule.validateStaffForm(editValues, {
  staffMembers: [
    linkedStaff,
    { id: 'staff-other', centerId: 'center-a', employeeCode: 'ABC001', fullName: 'Other', employmentType: 'unspecified', employmentStatus: 'active' },
  ],
  departments: [{ id: 'dept-academic', name: 'Học thuật', status: 'active' }],
  currentStaffId: linkedStaff.id,
})
assert.deepEqual(editErrors, {}, 'Editing a linked staff to a unique employeeCode must be allowed.')

const savedLinkedStaff = staffModule.buildStaffMemberFromForm(editValues, linkedStaff, 'center-a')
assert.equal(savedLinkedStaff.id, linkedStaff.id)
assert.equal(savedLinkedStaff.employeeCode, 'GV001')
assert.equal(savedLinkedStaff.teacherId, teacher.id)
assert.equal(savedLinkedStaff.teacherLinkedAt, linkedStaff.teacherLinkedAt)
assert.equal(savedLinkedStaff.accountUserId, linkedStaff.accountUserId)
assert.equal(savedLinkedStaff.membershipId, linkedStaff.membershipId)
assert.equal(savedLinkedStaff.unknownStaffField, 'preserve-me')
assert.equal(savedLinkedStaff.createdAt, linkedStaff.createdAt)
assert.equal(savedLinkedStaff.endDate, '', 'Active staff must not persist a new endDate.')

const nextStaffList = [linkedStaff].map((staffMember) =>
  staffMember.id === savedLinkedStaff.id ? savedLinkedStaff : staffMember,
)
assert.equal(nextStaffList.length, 1, 'Staff edit must not append a second record.')
assert.equal(nextStaffList[0].id, 'staff-linked-001')

const duplicateErrors = staffModule.validateStaffForm(
  { ...editValues, employeeCode: 'abc001' },
  {
    staffMembers: [
      linkedStaff,
      { id: 'staff-other', centerId: 'center-a', employeeCode: ' ABC001 ', fullName: 'Other', employmentType: 'unspecified', employmentStatus: 'active' },
    ],
    departments: [],
    currentStaffId: linkedStaff.id,
  },
)
assert.equal(duplicateErrors.employeeCode, 'Mã nhân viên đã được sử dụng trong cơ sở này.')

const terminatedErrors = staffModule.validateStaffForm(
  {
    employeeCode: 'TERM001',
    fullName: 'Terminated',
    employmentType: 'full-time',
    employmentStatus: 'terminated',
    startDate: '2026-07-10',
    endDate: '2026-07-01',
  },
  { staffMembers: [], departments: [] },
)
assert.equal(terminatedErrors.endDate, 'Ngày kết thúc không được trước ngày bắt đầu.')

const terminatedSaved = staffModule.buildStaffMemberFromForm(
  {
    employeeCode: 'TERM001',
    fullName: 'Terminated',
    employmentType: 'full-time',
    employmentStatus: 'terminated',
    startDate: '2026-07-10',
    endDate: '2026-07-20',
  },
  null,
  'center-a',
)
assert.equal(terminatedSaved.endDate, '2026-07-20')

const activeHtml = staffModule.renderStaffModule({
  staffMembers: [savedLinkedStaff],
  departments: [],
  teachers: [teacher],
  formState: staffModule.createEditStaffFormState(savedLinkedStaff),
})
assert(activeHtml.includes('data-staff-action="save"'))
assert(activeHtml.includes('type="submit"'))
assert(activeHtml.includes('data-staff-form-field="endDate" disabled'))
assert(activeHtml.includes('Đến nay'))
assert(activeHtml.includes('Thời gian làm việc'))
assert(activeHtml.includes('— → Đến nay'))
assert(activeHtml.includes('Hồ sơ Giáo viên: Đã liên kết'))
assert(activeHtml.includes('Tài khoản: Đã liên kết'))

const onLeaveHtml = staffModule.renderStaffModule({
  staffMembers: [{ ...savedLinkedStaff, employmentStatus: 'on-leave' }],
  departments: [],
  teachers: [teacher],
  formState: staffModule.createEditStaffFormState({ ...savedLinkedStaff, employmentStatus: 'on-leave' }),
})
assert(onLeaveHtml.includes('data-staff-form-field="endDate" disabled'))
assert(onLeaveHtml.includes('Đến nay'))

const terminatedHtml = staffModule.renderStaffModule({
  staffMembers: [{ ...savedLinkedStaff, employmentStatus: 'terminated', startDate: '2026-07-01', endDate: '' }],
  departments: [],
  teachers: [teacher],
  filters: { employmentStatus: 'all' },
  formState: staffModule.createEditStaffFormState({ ...savedLinkedStaff, employmentStatus: 'terminated', startDate: '2026-07-01', endDate: '' }),
})
assert(terminatedHtml.includes('data-staff-form-field="endDate"'))
assert(!terminatedHtml.includes('data-staff-form-field="endDate" disabled'))
assert(terminatedHtml.includes('01/07/2026 → Chưa cập nhật'))

const teacherHtml = teacherModule.renderTeacherModule(
  [teacher],
  undefined,
  null,
  teacher.id,
  [],
  [],
  [],
  [],
  { staffMembers: [savedLinkedStaff], departments: [], staffLinkState: null },
)
assert(teacherHtml.includes('GV001 · Nguyễn Trường Thịnh'))
assert(teacherHtml.includes('data-teacher-action="open-linked-staff"'))

for (const forbidden of [
  'teacher.staffMemberId',
  'staffMemberId:',
  'auth.signUp(',
  'create table',
  'alter table',
  'drop table',
  ['teacher', '-workspace-secret'].join(''),
  ['/', 'teacher', '/'].join(''),
  ['#', '/teacher'].join(''),
]) {
  assert(![main, staffSource, teacherSource].join('\n').toLowerCase().includes(forbidden.toLowerCase()), `Forbidden marker: ${forbidden}`)
}

for (const source of [main, staffSource, teacherSource]) {
  for (const mojibake of createMojibakeMarkers()) {
    assert(!source.includes(mojibake), `Mojibake marker found: ${mojibake}`)
  }
}

console.log('F23.10C1.1 linked staff edit and employment date hotfix smoke passed')

function createMojibakeMarkers() {
  return [
    [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
    [0x0102, 0x0192],
    [0x0102, 0x2020, 0x00c2, 0x00b0],
    [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
    [0x0102, 0x00a1, 0x00c2, 0x00bb],
    [0xfffd],
  ].map((codes) => String.fromCodePoint(...codes))
}
