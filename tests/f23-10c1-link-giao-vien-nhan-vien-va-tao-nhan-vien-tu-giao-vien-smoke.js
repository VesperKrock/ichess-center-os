import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

globalThis.localStorage = createMemoryStorage()

const staffModule = await import('../src/staff-module.js')
const storageModule = await import('../src/storage.js')
const teacherModule = await import('../src/teacher-module.js')

const main = read('src/main.js')
const staffSource = read('src/staff-module.js')
const teacherSource = read('src/teacher-module.js')
const storageSource = read('src/storage.js')
const styles = read('src/styles.css')

assert(staffSource.includes('export function findStaffMemberByTeacherId'))
assert(teacherSource.includes('findStaffMemberByTeacherId'))
assert(!storageSource.includes('staffMemberId'))
assert(!teacherSource.includes('teacher.staffMemberId'))
// The former global `staffMemberId:` ban became stale when C5.5 introduced
// authoritative Staff/HR commands that legitimately identify a Staff row.
// The durable non-duplication invariant is narrower: Teacher never owns or
// persists a staffMemberId field; links stay explicit on the Staff authority.
assert(!main.includes('teacher.staffMemberId'))

for (const marker of [
  'data-teacher-action="open-staff-link"',
  'data-teacher-action="open-linked-staff"',
  'data-teacher-action="unlink-staff"',
  'data-staff-action="open-linked-teacher"',
  'data-staff-action="unlink-teacher"',
  'data-teacher-staff-link-action="link-existing"',
  'data-teacher-staff-create-form',
  'Tạo hồ sơ & liên kết',
]) {
  assert(teacherSource.includes(marker) || staffSource.includes(marker) || main.includes(marker), `Missing C1 marker: ${marker}`)
}

const teacher = {
  id: 'teacher-001',
  fullName: 'Teacher One',
  displayName: 'Coach One',
  phone: '0901',
  email: 'coach@example.com',
  teacherType: 'fulltime',
  status: 'active',
}

const renderedUnlinked = teacherModule.renderTeacherModule(
  [teacher],
  undefined,
  null,
  teacher.id,
  [],
  [],
  [],
  [],
  { staffMembers: [], departments: [], staffLinkState: null },
)
assert(renderedUnlinked.includes('Hồ sơ nhân viên: Chưa liên kết'))
assert(renderedUnlinked.includes('Liên kết hồ sơ nhân viên'))

const renderedModal = teacherModule.renderTeacherModule(
  [teacher],
  undefined,
  null,
  teacher.id,
  [],
  [],
  [],
  [],
  {
    staffMembers: [
      {
        id: 'staff-free',
        centerId: 'center-a',
        employeeCode: 'NV001',
        fullName: 'Staff Free',
        phone: '0902',
        email: 'staff@example.com',
        employmentStatus: 'active',
      },
      {
        id: 'staff-linked',
        centerId: 'center-a',
        fullName: 'Staff Linked',
        teacherId: 'teacher-other',
        employmentStatus: 'active',
      },
      {
        id: 'staff-archived',
        centerId: 'center-a',
        fullName: 'Staff Archived',
        employmentStatus: 'archived',
      },
    ],
    departments: [{ id: 'dept-1', name: 'Ops', status: 'active' }],
    staffLinkState: {
      teacherId: teacher.id,
      centerId: 'center-a',
      mode: 'create',
      values: {
        fullName: teacher.fullName,
        phone: teacher.phone,
        email: teacher.email,
        positionTitle: 'Giáo viên',
        employmentType: 'full-time',
        employmentStatus: 'active',
      },
      errors: {},
    },
  },
)
assert(renderedModal.includes('Tạo hồ sơ nhân viên từ giáo viên'))
assert(renderedModal.includes('Teacher One'))
assert(renderedModal.includes('0901'))
assert(renderedModal.includes('coach@example.com'))
assert(renderedModal.includes('Tạo hồ sơ & liên kết'))
assert(!renderedModal.toLowerCase().includes('password'))
assert(!renderedModal.includes('accountUserId'))
assert(!renderedModal.includes('membershipId'))

const renderedExisting = teacherModule.renderTeacherModule(
  [teacher],
  undefined,
  null,
  teacher.id,
  [],
  [],
  [],
  [],
  {
    staffMembers: [
      { id: 'staff-free', employeeCode: 'NV001', fullName: 'Staff Free', employmentStatus: 'active' },
      { id: 'staff-linked', fullName: 'Staff Linked', teacherId: 'teacher-other', employmentStatus: 'active' },
      { id: 'staff-archived', fullName: 'Staff Archived', employmentStatus: 'archived' },
    ],
    staffLinkState: { teacherId: teacher.id, mode: 'existing', query: '', values: {}, errors: {} },
  },
)
assert(renderedExisting.includes('Staff Free'))
assert(!renderedExisting.includes('Staff Linked'))
assert(!renderedExisting.includes('Staff Archived'))

const lookup = staffModule.findStaffMemberByTeacherId(
  [
    { id: 'staff-a', teacherId: teacher.id },
    { id: 'staff-b', teacherId: 'teacher-b' },
  ],
  teacher.id,
)
assert.equal(lookup.status, 'linked')
assert.equal(lookup.staffMember.id, 'staff-a')

const duplicateLookup = staffModule.findStaffMemberByTeacherId(
  [
    { id: 'staff-a', teacherId: teacher.id },
    { id: 'staff-b', teacherId: teacher.id },
  ],
  teacher.id,
)
assert.equal(duplicateLookup.status, 'duplicate')
assert.equal(duplicateLookup.staffMember, null)

storageModule.setCurrentStorageCenterId('center-a')
storageModule.saveStoredCenterStaffMembers([
  { id: 'staff-a', centerId: 'center-a', fullName: 'A', employeeCode: 'NV001', teacherId: teacher.id, unknown: 'keep' },
])
const stored = storageModule.getStoredCenterStaffMembers([])
assert.equal(stored[0].teacherId, teacher.id)
assert.equal(stored[0].unknown, 'keep')

storageModule.setCurrentStorageCenterId('center-b')
assert.deepEqual(storageModule.getStoredCenterStaffMembers([]), [])

for (const marker of [
  'unlinkTeacherFromStaff',
  'teacherId: \'\',',
  'teacherLinkedAt: \'\',',
  'openLinkedTeacherFromStaff',
  'openLinkedStaffFromTeacher',
  'canLinkTeacherToStaff',
]) {
  assert(main.includes(marker), `Missing main link safety marker: ${marker}`)
}

for (const marker of [
  '.teacher-staff-link-modal',
  '.teacher-staff-link-window',
  '.teacher-staff-create-form',
  '.staff-link-actions',
]) {
  assert(styles.includes(marker), `Missing C1 style marker: ${marker}`)
}

const publicSources = [main, staffSource, teacherSource, storageSource, styles].join('\n')
for (const forbidden of createForbiddenPublicSecretMarkers()) {
  assert(!publicSources.includes(forbidden), `Public source must not include secret marker: ${forbidden}`)
}

for (const forbidden of ['signUp(', 'auth.signUp(', 'create table', 'alter table', 'drop table']) {
  assert(!publicSources.toLowerCase().includes(forbidden.toLowerCase()), `Forbidden marker: ${forbidden}`)
}

for (const source of [staffSource, teacherSource]) {
  for (const mojibake of createMojibakeMarkers()) {
    assert(!source.includes(mojibake), `Mojibake marker found: ${mojibake}`)
  }
}

console.log('F23.10C1 teacher-staff direct link smoke passed')

function createMemoryStorage() {
  const map = new Map()
  return {
    get length() {
      return map.size
    },
    getItem(key) {
      const normalizedKey = String(key)
      return map.has(normalizedKey) ? map.get(normalizedKey) : null
    },
    setItem(key, value) {
      map.set(String(key), String(value))
    },
    removeItem(key) {
      map.delete(String(key))
    },
    clear() {
      map.clear()
    },
    key(index) {
      return Array.from(map.keys())[index] || null
    },
  }
}

function createForbiddenPublicSecretMarkers() {
  return [
    ['Nhà', ' của giáo viên'].join(''),
    ['Teacher', ' Workspace'].join(''),
    ['local', '/teacher-workspace-secret'].join(''),
    ['/', 'teacher', '/'].join(''),
    ['#', '/teacher'].join(''),
    ['Module', ' 14'].join(''),
  ]
}

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
