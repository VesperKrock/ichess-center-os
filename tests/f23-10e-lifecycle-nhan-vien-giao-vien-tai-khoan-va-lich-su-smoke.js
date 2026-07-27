import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  archiveStaffMember,
  buildStaffMemberFromForm,
  buildStaffEmploymentTransition,
  createEditStaffFormState,
  getAvailableStaffEmploymentTransitions,
  getStaffEmploymentStatus,
  getStaffLifecycleWarnings,
  isStaffMemberArchived,
  renderStaffModule,
  restoreStaffMember,
  validateStaffEmploymentTransition,
} from '../src/staff-module.js'
import { normalizeCenterStaffMembers } from '../src/storage.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const main = read('src/main.js')
const staffSource = read('src/staff-module.js')
const storage = read('src/storage.js')
const teacherSource = read('src/teacher-module.js')
const styles = read('src/styles.css')
const docs = read('docs/f23-10e-lifecycle-nhan-vien-giao-vien-tai-khoan-va-lich-su.md')

const teacher = {
  id: 'teacher-thinh',
  fullName: 'Nguyễn Trường Thịnh',
  displayName: 'Nguyễn Trường Thịnh',
  status: 'active',
  unknownTeacherField: 'unchanged',
}
const membership = {
  id: 'membership-thinh',
  accountUserId: 'account-thinh',
  centerId: 'center-a',
  role: 'teacher',
  status: 'active',
  accountStatus: 'active',
  email: 'thinh@example.com',
  displayName: 'Nguyễn Trường Thịnh',
}
const previousEvent = {
  id: 'staff-lifecycle-previous',
  fromStatus: 'on-leave',
  toStatus: 'active',
  effectiveDate: '2026-07-01',
  note: 'Đi làm lại',
  createdAt: '2026-07-01T01:00:00.000Z',
  createdBy: 'account-admin',
  createdByLabel: 'admin@example.com',
  unknownEventField: { preserve: true },
}
const baseStaff = {
  id: 'staff-gv001',
  centerId: 'center-a',
  employeeCode: 'GV001',
  fullName: 'Nguyễn Trường Thịnh',
  employmentType: 'full-time',
  employmentStatus: 'active',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  teacherId: teacher.id,
  teacherLinkedAt: '2026-07-01T00:00:00.000Z',
  accountUserId: membership.accountUserId,
  membershipId: membership.id,
  accountLinkedAt: '2026-07-01T00:00:00.000Z',
  employmentLifecycleEvents: [previousEvent],
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-07-01T01:00:00.000Z',
  unknownStaffField: { preserve: true },
}

assert.deepEqual(getAvailableStaffEmploymentTransitions(baseStaff), ['on-leave', 'terminated'])
assert.deepEqual(
  getAvailableStaffEmploymentTransitions({ ...baseStaff, employmentStatus: 'on-leave' }),
  ['active', 'terminated'],
)
assert.deepEqual(
  getAvailableStaffEmploymentTransitions({ ...baseStaff, employmentStatus: 'terminated' }),
  ['active'],
)
assert.equal(
  validateStaffEmploymentTransition(baseStaff, {
    toStatus: 'active',
    effectiveDate: '2026-07-27',
  }).status,
  'Trạng thái mới phải khác trạng thái hiện tại.',
)
assert.equal(
  validateStaffEmploymentTransition(baseStaff, {
    toStatus: 'terminated',
    effectiveDate: '2026-05-31',
  }).effectiveDate,
  'Ngày kết thúc không được trước ngày bắt đầu.',
)
assert.equal(
  validateStaffEmploymentTransition(baseStaff, {
    toStatus: 'terminated',
    effectiveDate: '',
  }).effectiveDate,
  'Vui lòng chọn ngày hiệu lực hợp lệ.',
)
assert.equal(
  validateStaffEmploymentTransition(baseStaff, {
    toStatus: 'invented',
    effectiveDate: '2026-07-27',
  }).status,
  'Trạng thái làm việc mới không hợp lệ.',
)
assert.equal(
  validateStaffEmploymentTransition(baseStaff, {
    toStatus: 'terminated',
    effectiveDate: '2026-02-31',
  }).effectiveDate,
  'Vui lòng chọn ngày hiệu lực hợp lệ.',
)

const originalStaffSnapshot = structuredClone(baseStaff)
const originalTeacherSnapshot = structuredClone(teacher)
const originalMembershipSnapshot = structuredClone(membership)
const onLeaveResult = buildStaffEmploymentTransition(
  baseStaff,
  { toStatus: 'on-leave', effectiveDate: '2026-07-27', note: 'Tạm nghỉ có kế hoạch' },
  {
    eventId: 'staff-lifecycle-on-leave',
    createdAt: '2026-07-27T01:00:00.000Z',
    createdBy: 'account-owner',
    createdByLabel: 'owner@example.com',
  },
)
assert.equal(onLeaveResult.ok, true)
assert.equal(onLeaveResult.staffMember.id, baseStaff.id)
assert.equal(onLeaveResult.staffMember.employmentStatus, 'on-leave')
assert.equal(onLeaveResult.staffMember.endDate, '')
assert.equal(onLeaveResult.staffMember.employmentLifecycleEvents.length, 2)
assert.equal(onLeaveResult.event.id, 'staff-lifecycle-on-leave')
assert.equal(onLeaveResult.event.fromStatus, 'active')
assert.equal(onLeaveResult.event.toStatus, 'on-leave')
assert.equal(onLeaveResult.staffMember.teacherId, baseStaff.teacherId)
assert.equal(onLeaveResult.staffMember.accountUserId, baseStaff.accountUserId)
assert.equal(onLeaveResult.staffMember.membershipId, baseStaff.membershipId)
assert.deepEqual(onLeaveResult.staffMember.unknownStaffField, baseStaff.unknownStaffField)
assert.deepEqual(onLeaveResult.staffMember.employmentLifecycleEvents[0], previousEvent)
assert.deepEqual(baseStaff, originalStaffSnapshot, 'Transition must not mutate source staff.')
assert.deepEqual(teacher, originalTeacherSnapshot, 'Staff transition must not mutate Teacher.')
assert.deepEqual(membership, originalMembershipSnapshot, 'Staff transition must not mutate membership.')

const ordinaryEdit = buildStaffMemberFromForm(
  { ...baseStaff, fullName: 'Nguyễn Trường Thịnh cập nhật' },
  baseStaff,
  'center-a',
)
assert.equal(ordinaryEdit.employmentLifecycleEvents.length, 1)
assert.deepEqual(ordinaryEdit.employmentLifecycleEvents[0], previousEvent)

const directTerminatedResult = buildStaffEmploymentTransition(
  baseStaff,
  { toStatus: 'terminated', effectiveDate: '2026-07-27', note: '' },
  { eventId: 'staff-lifecycle-direct-terminated', createdAt: '2026-07-27T02:00:00.000Z' },
)
assert.equal(directTerminatedResult.ok, true)
assert.equal(directTerminatedResult.staffMember.endDate, '2026-07-27')

const optionalStartDateResult = buildStaffEmploymentTransition(
  { ...baseStaff, startDate: '' },
  { toStatus: 'terminated', effectiveDate: '2026-05-01', note: '' },
  { eventId: 'staff-lifecycle-optional-start', createdAt: '2026-07-27T02:00:00.000Z' },
)
assert.equal(optionalStartDateResult.ok, true)

const returnedFromLeaveResult = buildStaffEmploymentTransition(
  onLeaveResult.staffMember,
  { toStatus: 'active', effectiveDate: '2026-07-29', note: 'Quay lại làm việc' },
  { eventId: 'staff-lifecycle-return-from-leave', createdAt: '2026-07-29T01:00:00.000Z' },
)
assert.equal(returnedFromLeaveResult.ok, true)
assert.equal(returnedFromLeaveResult.staffMember.employmentStatus, 'active')
assert.equal(returnedFromLeaveResult.staffMember.endDate, '')

const terminatedResult = buildStaffEmploymentTransition(
  onLeaveResult.staffMember,
  { toStatus: 'terminated', effectiveDate: '2026-07-28', note: 'Kết thúc công việc' },
  { eventId: 'staff-lifecycle-terminated', createdAt: '2026-07-28T01:00:00.000Z' },
)
assert.equal(terminatedResult.ok, true)
assert.equal(terminatedResult.staffMember.employmentStatus, 'terminated')
assert.equal(terminatedResult.staffMember.endDate, '2026-07-28')
assert.equal(terminatedResult.staffMember.employmentLifecycleEvents.length, 3)

const reactivatedResult = buildStaffEmploymentTransition(
  terminatedResult.staffMember,
  { toStatus: 'active', effectiveDate: '2026-08-01', note: 'Đi làm lại' },
  { eventId: 'staff-lifecycle-reactivated', createdAt: '2026-08-01T01:00:00.000Z' },
)
assert.equal(reactivatedResult.ok, true)
assert.equal(reactivatedResult.staffMember.employmentStatus, 'active')
assert.equal(reactivatedResult.staffMember.endDate, '')
assert.equal(reactivatedResult.staffMember.employmentLifecycleEvents.length, 4)
assert.equal(reactivatedResult.staffMember.employmentLifecycleEvents[2].id, 'staff-lifecycle-terminated')
assert.equal(
  buildStaffEmploymentTransition(
    baseStaff,
    { toStatus: 'on-leave', effectiveDate: '2026-07-27' },
    { eventId: previousEvent.id },
  ).ok,
  false,
  'Duplicate event IDs must be rejected.',
)
assert.equal(
  buildStaffEmploymentTransition(
    { ...baseStaff, employmentStatus: 'terminated' },
    { toStatus: 'on-leave', effectiveDate: '2026-07-27' },
    { eventId: 'invalid-transition' },
  ).ok,
  false,
)

const archivedTerminated = archiveStaffMember(terminatedResult.staffMember)
assert.equal(archivedTerminated.employmentStatus, 'terminated')
assert.equal(archivedTerminated.endDate, '2026-07-28')
assert.equal(isStaffMemberArchived(archivedTerminated), true)
assert.equal(archivedTerminated.teacherId, baseStaff.teacherId)
assert.equal(archivedTerminated.membershipId, baseStaff.membershipId)
assert.equal(archivedTerminated.employmentLifecycleEvents.length, 3)
assert.equal(
  validateStaffEmploymentTransition(archivedTerminated, {
    toStatus: 'active',
    effectiveDate: '2026-08-01',
  }).status,
  'Hồ sơ đang được lưu trữ. Vui lòng khôi phục trước khi cập nhật trạng thái làm việc.',
)
const restoredTerminated = restoreStaffMember(archivedTerminated)
assert.equal(restoredTerminated.employmentStatus, 'terminated')
assert.equal(restoredTerminated.archivedAt, '')
assert.equal(restoredTerminated.endDate, archivedTerminated.endDate)
assert.deepEqual(restoredTerminated.employmentLifecycleEvents, archivedTerminated.employmentLifecycleEvents)

const [normalizedLegacy] = normalizeCenterStaffMembers([{
  ...baseStaff,
  employmentStatus: 'archived',
  employmentStatusBeforeArchive: 'on-leave',
  archivedAt: '2026-07-20T00:00:00.000Z',
  employmentLifecycleEvents: [
    previousEvent,
    { malformed: true, unknownEventField: 'keep-me' },
  ],
}])
assert.equal(normalizedLegacy.employmentStatus, 'on-leave')
assert.equal(getStaffEmploymentStatus(normalizedLegacy), 'on-leave')
assert.equal(isStaffMemberArchived(normalizedLegacy), true)
assert.equal(normalizedLegacy.employmentLifecycleEvents.length, 2)
assert.equal(normalizedLegacy.employmentLifecycleEvents[1].unknownEventField, 'keep-me')
assert.equal(normalizedLegacy.employmentLifecycleEvents[1].id, '')
const [normalizedNoHistory] = normalizeCenterStaffMembers([{
  ...baseStaff,
  id: 'staff-no-history',
  employmentLifecycleEvents: undefined,
}])
assert.deepEqual(normalizedNoHistory.employmentLifecycleEvents, [])

assert.deepEqual(
  getStaffLifecycleWarnings(
    { ...baseStaff, employmentStatus: 'terminated' },
    teacher,
    membership,
  ),
  [
    'Nhân viên đã nghỉ việc nhưng hồ sơ Giáo viên vẫn đang dạy.',
    'Nhân viên đã nghỉ việc nhưng tài khoản vẫn đang hoạt động.',
  ],
)
assert.deepEqual(
  getStaffLifecycleWarnings(
    baseStaff,
    { ...teacher, status: 'inactive' },
    { ...membership, status: 'revoked' },
  ),
  [
    'Nhân viên vẫn đang làm việc nhưng hồ sơ Giáo viên đã ngừng dạy.',
    'Nhân viên đang làm việc nhưng tài khoản hiện không hoạt động.',
  ],
)

const terminatedStaff = terminatedResult.staffMember
const lifecycleHtml = renderStaffModule({
  staffMembers: [terminatedStaff],
  teachers: [teacher],
  filters: { employmentStatus: 'all' },
  formState: createEditStaffFormState(terminatedStaff),
  accountMemberships: [membership],
  accountDirectoryState: {
    status: 'loaded',
    centerId: 'center-a',
    centerName: 'Cơ sở A',
    memberships: [membership],
  },
  lifecycleState: {
    mode: 'termination',
    staffId: terminatedStaff.id,
    centerId: 'center-a',
    values: {
      toStatus: 'terminated',
      effectiveDate: '2026-07-28',
      note: '',
      followUp: 'none',
      confirmed: false,
    },
    errors: {},
    message: '',
    isSaving: false,
  },
})
assert(lifecycleHtml.includes('Trạng thái và vòng đời'))
assert(lifecycleHtml.includes('Lịch sử trạng thái làm việc'))
assert(lifecycleHtml.includes('Nhân viên đã nghỉ việc nhưng hồ sơ Giáo viên vẫn đang dạy.'))
assert(lifecycleHtml.includes('Nhân viên đã nghỉ việc nhưng tài khoản vẫn đang hoạt động.'))
assert(lifecycleHtml.includes('data-staff-lifecycle-action="open-status"'))
assert(lifecycleHtml.includes('data-staff-action="open-linked-teacher"'))
assert(lifecycleHtml.includes('data-staff-account-action="open-management"'))
assert(lifecycleHtml.includes('Tôi xác nhận chỉ đánh dấu Nhân viên đã nghỉ việc'))
assert(lifecycleHtml.includes('Mở hồ sơ Giáo viên sau khi lưu'))
assert(lifecycleHtml.includes('Mở quản lý tài khoản sau khi lưu'))
assert(!lifecycleHtml.includes(previousEvent.createdBy), 'Raw actor stable ID must not be rendered.')
assert(!lifecycleHtml.includes('undefined'))
assert(!lifecycleHtml.includes('null'))

const unlinkedHtml = renderStaffModule({
  staffMembers: [{
    ...baseStaff,
    id: 'staff-unlinked',
    teacherId: '',
    accountUserId: '',
    membershipId: '',
    employmentLifecycleEvents: [],
  }],
  formState: createEditStaffFormState({
    ...baseStaff,
    id: 'staff-unlinked',
    teacherId: '',
    accountUserId: '',
    membershipId: '',
    employmentLifecycleEvents: [],
  }),
  accountDirectoryState: { status: 'loaded', centerId: 'center-a', memberships: [] },
})
assert(unlinkedHtml.includes('Chưa liên kết'))
assert(unlinkedHtml.includes('Chưa có lịch sử thay đổi trạng thái.'))

const archivedHtml = renderStaffModule({
  staffMembers: [archivedTerminated],
  teachers: [teacher],
  filters: { employmentStatus: 'archived' },
  formState: createEditStaffFormState(archivedTerminated),
})
assert(archivedHtml.includes('Đã lưu trữ'))
assert(archivedHtml.includes('data-staff-lifecycle-action="open-status"'))
assert.match(archivedHtml, /data-staff-lifecycle-action="open-status"[^>]*disabled/)

assert(main.includes('expectedHistorySignature'))
assert(main.includes('getStaffLifecycleHistorySignature(latestStaffMember)'))
assert(main.includes('isStaffLifecycleSaving'))
assert(main.includes('matches.length !== 1'))
assert(main.includes("'data-staff-lifecycle-field'"))
assert(main.includes("values.employmentStatus = getStaffEmploymentStatus(existingStaffMember)"))
assert(main.includes("followUp === 'teacher'"))
assert(main.includes("followUp === 'account'"))
assert(staffSource.includes('employmentLifecycleEvents: [...lifecycleEvents, event]'))
assert(storage.includes('normalizeStaffLifecycleEvents'))
assert(styles.includes('.staff-lifecycle-card'))
assert(styles.includes('.staff-lifecycle-modal'))

const lifecycleHandler = main.slice(
  main.indexOf('function handleStaffLifecycleSubmit'),
  main.indexOf('function finishStaffLifecycleError'),
)
for (const forbiddenMutation of [
  'saveStoredTeachers(',
  "status: 'inactive'",
  'unlinkStaffMemberFromAccount(',
  'teacherId: \'\'',
  'accountUserId: \'\'',
  'membershipId: \'\'',
]) {
  assert(!lifecycleHandler.includes(forbiddenMutation), `Lifecycle flow must not cascade: ${forbiddenMutation}`)
}

for (const forbidden of [
  'auth.signUp(',
  'auth.admin',
  '.from(\'center_members\').update',
  'create table',
  'alter table',
  'drop table',
  ['teacher', '-workspace-secret'].join(''),
  ['/', 'teacher', '/'].join(''),
  ['#', '/teacher'].join(''),
]) {
  assert(
    ![main, staffSource, storage, teacherSource, styles, docs].join('\n').toLowerCase().includes(forbidden.toLowerCase()),
    `Forbidden marker: ${forbidden}`,
  )
}

for (const source of [main, staffSource, storage, teacherSource, styles, docs]) {
  for (const mojibake of createMojibakeMarkers()) {
    assert(!source.includes(mojibake), `Mojibake marker found: ${mojibake}`)
  }
}

console.log('F23.10E staff lifecycle integration smoke passed')

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
