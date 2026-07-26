import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mapCenterAccountMembership } from '../src/member-profiles.js'
import {
  archiveStaffMember,
  buildStaffMemberFromForm,
  findStaffMemberByAccountUserId,
  findStaffMemberByMembershipId,
  getAvailableStaffAccountMemberships,
  getStaffAccountRoleLabel,
  getStaffTeacherAccountWarning,
  linkStaffMemberToAccount,
  renderStaffModule,
  resolveStaffAccountLink,
  unlinkStaffMemberFromAccount,
} from '../src/staff-module.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const main = read('src/main.js')
const memberProfiles = read('src/member-profiles.js')
const staffModule = read('src/staff-module.js')
const storage = read('src/storage.js')
const styles = read('src/styles.css')
const docs = read('docs/f23-10d-link-nhan-vien-tai-khoan-membership-va-hien-thi-quyen.md')

const activeTeacherMembership = {
  id: 'membership-teacher-1',
  accountUserId: 'user-teacher-1',
  centerId: 'dreamhome_prod',
  role: 'teacher',
  status: 'active',
  email: 'teacher@example.com',
  displayName: 'Nguyễn Trường Thịnh',
  accountStatus: 'unknown',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-27T00:00:00.000Z',
}
const activeAdminMembership = {
  ...activeTeacherMembership,
  id: 'membership-admin-1',
  accountUserId: 'user-admin-1',
  role: 'center_admin',
  email: 'admin@example.com',
  displayName: 'Admin cơ sở',
}
const revokedMembership = {
  ...activeTeacherMembership,
  id: 'membership-revoked-1',
  accountUserId: 'user-revoked-1',
  role: 'consultant',
  status: 'revoked',
  email: 'revoked@example.com',
}
const baseStaff = {
  id: 'staff-gv001',
  centerId: 'dreamhome_prod',
  employeeCode: 'GV001',
  fullName: 'Nguyễn Trường Thịnh',
  email: 'teacher@example.com',
  positionTitle: 'Giáo viên',
  employmentStatus: 'active',
  employmentType: 'full-time',
  teacherId: 'teacher-thinh',
  accountUserId: '',
  membershipId: '',
  createdAt: '2026-07-01T00:00:00.000Z',
  unknownField: { preserve: true },
}

const mappedMembership = mapCenterAccountMembership(
  {
    id: 'membership-current',
    user_id: 'user-current',
    center_id: 'dreamhome_prod',
    role: 'owner',
    status: 'active',
    display_name: 'Chủ cơ sở',
    email_snapshot: 'owner@example.com',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-27T00:00:00.000Z',
  },
  { id: 'user-current', email: 'session@example.com', user_metadata: {} },
)
assert.equal(mappedMembership.id, 'membership-current')
assert.equal(mappedMembership.accountUserId, 'user-current')
assert.equal(mappedMembership.centerId, 'dreamhome_prod')
assert.equal(mappedMembership.email, 'owner@example.com')
assert.equal(mappedMembership.accountStatus, 'active')

assert.match(memberProfiles, /id, user_id, center_id, role, status/)
assert.match(memberProfiles, /\.from\('center_members'\)/)
assert.match(memberProfiles, /\.eq\('center_id', normalizedCenterId\)/)
assert.doesNotMatch(memberProfiles, /\.insert\(|\.delete\(/)

const sourceMembershipSnapshot = structuredClone(activeTeacherMembership)
const sourceStaffSnapshot = structuredClone(baseStaff)
const linkedStaff = linkStaffMemberToAccount(
  baseStaff,
  activeTeacherMembership,
  '2026-07-27T08:00:00.000Z',
)
assert.equal(linkedStaff.id, baseStaff.id)
assert.equal(linkedStaff.teacherId, baseStaff.teacherId)
assert.deepEqual(linkedStaff.unknownField, baseStaff.unknownField)
assert.equal(linkedStaff.accountUserId, activeTeacherMembership.accountUserId)
assert.equal(linkedStaff.membershipId, activeTeacherMembership.id)
assert.equal(linkedStaff.accountLinkedAt, '2026-07-27T08:00:00.000Z')
assert.equal(Object.hasOwn(linkedStaff, 'role'), false, 'Role must not be copied onto staff.')
assert.deepEqual(activeTeacherMembership, sourceMembershipSnapshot, 'Membership input must not mutate.')
assert.deepEqual(baseStaff, sourceStaffSnapshot, 'Staff input must not mutate.')

const resolvedLink = resolveStaffAccountLink({
  staffMember: linkedStaff,
  staffMembers: [linkedStaff],
  memberships: [activeTeacherMembership],
  currentCenterId: 'dreamhome_prod',
})
assert.equal(resolvedLink.status, 'linked')
assert.equal(resolvedLink.membership.id, activeTeacherMembership.id)

const editedLinkedStaff = buildStaffMemberFromForm(
  {
    ...linkedStaff,
    fullName: 'Nguyễn Trường Thịnh cập nhật',
    startDate: '',
    endDate: '',
  },
  linkedStaff,
  'dreamhome_prod',
)
assert.equal(editedLinkedStaff.accountUserId, linkedStaff.accountUserId)
assert.equal(editedLinkedStaff.membershipId, linkedStaff.membershipId)
assert.equal(editedLinkedStaff.accountLinkedAt, linkedStaff.accountLinkedAt)
assert.equal(editedLinkedStaff.teacherId, linkedStaff.teacherId)
assert.deepEqual(editedLinkedStaff.unknownField, linkedStaff.unknownField)
const archivedLinkedStaff = archiveStaffMember(linkedStaff)
assert.equal(archivedLinkedStaff.accountUserId, linkedStaff.accountUserId)
assert.equal(archivedLinkedStaff.membershipId, linkedStaff.membershipId)

assert.equal(
  resolveStaffAccountLink({
    staffMember: { ...linkedStaff, accountUserId: 'wrong-user' },
    staffMembers: [{ ...linkedStaff, accountUserId: 'wrong-user' }],
    memberships: [activeTeacherMembership],
    currentCenterId: 'dreamhome_prod',
  }).status,
  'malformed',
)
assert.equal(
  resolveStaffAccountLink({
    staffMember: linkedStaff,
    staffMembers: [linkedStaff],
    memberships: [],
    currentCenterId: 'dreamhome_prod',
  }).status,
  'malformed',
)
assert.equal(
  resolveStaffAccountLink({
    staffMember: linkedStaff,
    staffMembers: [linkedStaff],
    memberships: [{ ...activeTeacherMembership, centerId: 'other-center' }],
    currentCenterId: 'dreamhome_prod',
  }).status,
  'malformed',
)
assert.equal(
  resolveStaffAccountLink({
    staffMember: { ...linkedStaff, membershipId: '' },
    staffMembers: [linkedStaff],
    memberships: [activeTeacherMembership],
    currentCenterId: 'dreamhome_prod',
  }).status,
  'malformed',
)
assert.equal(
  resolveStaffAccountLink({
    staffMember: { ...linkedStaff, membershipId: revokedMembership.id, accountUserId: revokedMembership.accountUserId },
    staffMembers: [{ ...linkedStaff, membershipId: revokedMembership.id, accountUserId: revokedMembership.accountUserId }],
    memberships: [revokedMembership],
    currentCenterId: 'dreamhome_prod',
  }).status,
  'linked-inactive',
)

const duplicateLinkedStaff = {
  ...linkedStaff,
  id: 'staff-duplicate',
  employeeCode: 'DUP001',
}
assert.equal(
  findStaffMemberByMembershipId(
    [linkedStaff, duplicateLinkedStaff],
    activeTeacherMembership.id,
    'dreamhome_prod',
  ).status,
  'duplicate',
)
assert.equal(
  findStaffMemberByAccountUserId(
    [linkedStaff, duplicateLinkedStaff],
    activeTeacherMembership.accountUserId,
    'dreamhome_prod',
  ).status,
  'duplicate',
)

const availability = getAvailableStaffAccountMemberships({
  memberships: [
    activeTeacherMembership,
    activeAdminMembership,
    revokedMembership,
    { ...activeTeacherMembership, id: '', accountUserId: 'invalid-user' },
    { ...activeTeacherMembership, id: 'cross-center', accountUserId: 'cross-user', centerId: 'other-center' },
    { ...activeTeacherMembership, id: 'unknown-role', accountUserId: 'unknown-role-user', role: 'invented' },
  ],
  staffMembers: [{ ...linkedStaff, membershipId: activeAdminMembership.id, accountUserId: activeAdminMembership.accountUserId }],
  currentCenterId: 'dreamhome_prod',
})
assert.deepEqual(availability.active.map((item) => item.id), [activeTeacherMembership.id])
assert.deepEqual(availability.inactive.map((item) => item.id), [revokedMembership.id])
assert.equal(availability.linked.length, 1)
assert.equal(availability.invalid.length, 3)
const duplicateDirectoryAvailability = getAvailableStaffAccountMemberships({
  memberships: [activeTeacherMembership, { ...activeTeacherMembership }],
  staffMembers: [baseStaff],
  currentCenterId: 'dreamhome_prod',
})
assert.equal(duplicateDirectoryAvailability.hasMalformedDuplicate, true)

const sameEmailStaff = { ...baseStaff, email: activeTeacherMembership.email }
const sameEmailAvailability = getAvailableStaffAccountMemberships({
  memberships: [activeTeacherMembership],
  staffMembers: [sameEmailStaff],
  currentCenterId: 'dreamhome_prod',
})
assert.equal(sameEmailAvailability.active.length, 1, 'Matching email must not auto-link or remove option.')
assert.equal(sameEmailStaff.accountUserId, '')
assert.equal(sameEmailStaff.membershipId, '')

const unlinkedStaff = unlinkStaffMemberFromAccount(linkedStaff, '2026-07-27T09:00:00.000Z')
assert.equal(unlinkedStaff.accountUserId, '')
assert.equal(unlinkedStaff.membershipId, '')
assert.equal(unlinkedStaff.accountLinkedAt, '')
assert.equal(unlinkedStaff.teacherId, baseStaff.teacherId)
assert.deepEqual(unlinkedStaff.unknownField, baseStaff.unknownField)

assert.equal(getStaffAccountRoleLabel('owner'), 'Chủ hệ thống')
assert.equal(getStaffAccountRoleLabel('center_admin'), 'Quản lý cơ sở')
assert.equal(getStaffAccountRoleLabel('teacher'), 'Giáo viên')
assert.equal(getStaffAccountRoleLabel('consultant'), 'Tư vấn')
assert.equal(
  getStaffTeacherAccountWarning(baseStaff, { role: 'consultant' }),
  'Tài khoản hiện chưa có quyền Giáo viên.',
)
assert.equal(getStaffTeacherAccountWarning(baseStaff, { role: 'owner' }), '')
assert.equal(
  getStaffTeacherAccountWarning({ ...baseStaff, teacherId: '' }, { role: 'teacher' }),
  'Tài khoản có quyền Giáo viên nhưng chưa liên kết hồ sơ Giáo viên.',
)

const linkedHtml = renderStaffModule({
  staffMembers: [linkedStaff],
  teachers: [{ id: baseStaff.teacherId, fullName: baseStaff.fullName }],
  formState: {
    mode: 'edit',
    staffId: linkedStaff.id,
    centerId: linkedStaff.centerId,
    values: linkedStaff,
    errors: {},
    links: { hasTeacherLink: true, hasAccountLink: true },
  },
  accountMemberships: [activeTeacherMembership],
  accountDirectoryState: {
    status: 'loaded',
    centerId: 'dreamhome_prod',
    centerName: 'DreamHome',
  },
})
for (const text of [
  'Tài khoản và quyền',
  'Email đăng nhập',
  'Trạng thái tài khoản',
  'Trạng thái membership',
  'Quyền hệ thống',
  'Chức danh',
  'Mở quản lý tài khoản',
  'Gỡ liên kết tài khoản',
]) {
  assert(linkedHtml.includes(text), `Missing linked account UI text: ${text}`)
}
assert(!linkedHtml.includes(activeTeacherMembership.id), 'Raw membership ID must not render.')
assert(!linkedHtml.includes(activeTeacherMembership.accountUserId), 'Raw account user ID must not render.')

const pickerHtml = renderStaffModule({
  staffMembers: [baseStaff],
  formState: {
    mode: 'edit',
    staffId: baseStaff.id,
    centerId: baseStaff.centerId,
    values: baseStaff,
    errors: {},
    links: { hasTeacherLink: true, hasAccountLink: false },
  },
  accountMemberships: [activeTeacherMembership, revokedMembership],
  accountDirectoryState: {
    status: 'loaded',
    centerId: 'dreamhome_prod',
    centerName: 'DreamHome',
  },
  accountLinkState: {
    staffId: baseStaff.id,
    centerId: 'dreamhome_prod',
    query: '',
    selectedMembershipId: '',
    message: '',
    isSaving: false,
  },
})
assert(pickerHtml.includes('Tìm theo email hoặc tên hiển thị'))
assert(pickerHtml.includes('Membership đang hoạt động'))
assert(pickerHtml.includes('Membership không hoạt động'))
assert(pickerHtml.includes('Membership hiện không hoạt động'))
assert(!pickerHtml.includes('data-membership-id="membership-revoked-1" >Chọn'))

for (const marker of [
  'getStaffAccountCenterContext',
  'staffAccountDirectoryRunId += 1',
  'isStaffAccountLinkSaving',
  'Tài khoản đã được liên kết với một hồ sơ nhân viên khác.',
  'listCenterAccountMemberships({ centerId: expectedCenterId })',
  'membership.accountUserId !== expectedAccountUserId',
  'membership.role !== expectedRole',
  'membership.status !== expectedStatus',
  'Membership đã đổi account, quyền hoặc trạng thái.',
  'linkStaffMemberToAccount',
  'unlinkStaffMemberFromAccount',
  'pendingInternalAccountUserId = link.membership.accountUserId',
]) {
  assert(main.includes(marker), `Missing runtime safety marker: ${marker}`)
}
assert(storage.includes('accountLinkedAt: staffMember.accountLinkedAt'))
assert(styles.includes('.staff-account-card'))
assert(styles.includes('.staff-account-modal'))
assert(styles.includes('.internal-account-card.is-focused-account'))

for (const marker of [
  'F23_10D_STABLE_ACCOUNT_MEMBERSHIP_LINK: YES',
  'F23_10D_ROLE_READONLY_FROM_LATEST_MEMBERSHIP: YES',
  'F23_10D_NO_AUTH_MEMBERSHIP_MUTATION: YES',
]) {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
}

const touchedRuntime = `${main}\n${memberProfiles}\n${staffModule}\n${storage}`
for (const forbidden of [
  String.fromCodePoint(0x43, 0xc3, 0xa1, 0xc2, 0xba),
  String.fromCodePoint(0xc3, 0x192),
  String.fromCodePoint(0xc3, 0x2020, 0xc2, 0xb0),
  String.fromCodePoint(0x48, 0xc3, 0xa1, 0xc2, 0xba),
  String.fromCodePoint(0xc3, 0xa1, 0xc2, 0xbb),
]) {
  assert(!`${touchedRuntime}\n${docs}`.includes(forbidden), `Mojibake marker found: ${forbidden}`)
}

for (const forbidden of [
  'SUPABASE_' + 'SERVICE_ROLE_KEY',
  'local/' + 'teacher-workspace-secret',
  '#/' + 'teacher',
]) {
  assert(!`${staffModule}\n${memberProfiles}\n${docs}`.includes(forbidden), `Forbidden public marker found: ${forbidden}`)
}

console.log('F23.10D staff account membership link smoke passed')
