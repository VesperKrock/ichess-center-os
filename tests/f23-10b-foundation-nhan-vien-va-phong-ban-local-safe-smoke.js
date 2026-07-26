import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const storage = createMemoryStorage()
globalThis.localStorage = storage

const staffModule = await import('../src/staff-module.js')
const storageModule = await import('../src/storage.js')

const main = read('src/main.js')
const modules = read('src/modules.js')
const storageSource = read('src/storage.js')
const staffSource = read('src/staff-module.js')
const styles = read('src/styles.css')
const doc = read('docs/f23-10a-design-nhan-vien-giao-vien-phong-ban-tai-khoan-quyen.md')

assert(modules.includes("id: 'nhan-vien'"), 'Public staff module must use existing nhan-vien id.')
assert(main.includes("moduleItem.id === 'nhan-vien'"), 'main.js must render public staff module.')
assert(main.includes('renderStaffModule({'), 'Staff module render must be wired.')
assert(main.includes('data-staff-action'), 'Staff actions must use scoped markers.')
assert(main.includes('data-staff-department-action'), 'Department actions must use scoped markers.')
assert(main.includes('data-staff-form-field'), 'Staff form fields need stable focus selectors.')
assert(main.includes('data-staff-department-field'), 'Department form fields need stable focus selectors.')

assert(storageSource.includes("createCenterScopedStorageKey('centerStaffMembers')"))
assert(storageSource.includes("createCenterScopedStorageKey('centerDepartments')"))
assert(storageSource.includes('getStoredCenterStaffMembers'))
assert(storageSource.includes('saveStoredCenterStaffMembers'))
assert(storageSource.includes('getStoredCenterDepartments'))
assert(storageSource.includes('saveStoredCenterDepartments'))
assert(storageSource.includes('export function normalizeCenterStaffMembers'))
assert(storageSource.includes('export function normalizeCenterDepartments'))

storageModule.setCurrentStorageCenterId('center-a')
storageModule.saveStoredCenterDepartments([
  {
    id: 'dept-a',
    centerId: 'center-a',
    name: 'Học thuật',
    code: 'ACA',
    extraDepartmentField: 'preserve-me',
  },
])
storageModule.saveStoredCenterStaffMembers([
  {
    id: 'staff-a',
    centerId: 'center-a',
    employeeCode: 'NV-001',
    fullName: 'Nguyễn An',
    departmentId: 'dept-a',
    teacherId: 'teacher-001',
    accountUserId: 'user-001',
    membershipId: 'member-001',
    extraStaffField: 'preserve-me',
  },
])

const centerAStaff = storageModule.getStoredCenterStaffMembers([])
const centerADepartments = storageModule.getStoredCenterDepartments([])
assert.equal(centerAStaff.length, 1)
assert.equal(centerADepartments.length, 1)
assert.equal(centerAStaff[0].id, 'staff-a')
assert.equal(centerAStaff[0].createdAt, centerAStaff[0].updatedAt)
assert.equal(centerAStaff[0].extraStaffField, 'preserve-me')
assert.equal(centerAStaff[0].teacherId, 'teacher-001')
assert.equal(centerAStaff[0].accountUserId, 'user-001')
assert.equal(centerAStaff[0].membershipId, 'member-001')
assert.equal(centerADepartments[0].extraDepartmentField, 'preserve-me')

storageModule.setCurrentStorageCenterId('center-b')
assert.deepEqual(storageModule.getStoredCenterStaffMembers([]), [])
assert.deepEqual(storageModule.getStoredCenterDepartments([]), [])
storageModule.saveStoredCenterStaffMembers([
  {
    id: 'staff-b',
    centerId: 'center-b',
    employeeCode: 'NV-001',
    fullName: 'Bình',
  },
])
assert.equal(storageModule.getStoredCenterStaffMembers([]).length, 1)

const duplicateStaffErrors = staffModule.validateStaffForm(
  {
    employeeCode: ' nv-001 ',
    fullName: 'Người trùng',
    employmentType: 'unspecified',
    employmentStatus: 'active',
  },
  { staffMembers: storageModule.getStoredCenterStaffMembers([]), departments: [] },
)
assert.equal(duplicateStaffErrors.employeeCode, 'Mã nhân viên đã được sử dụng trong cơ sở này.')

const staffDraft = staffModule.buildStaffMemberFromForm(
  {
    employeeCode: 'NV-002',
    fullName: 'Lê Bình',
    phone: '0901',
    email: 'binh@example.com',
    employmentType: 'full-time',
    employmentStatus: 'active',
    startDate: '2026-07-26',
  },
  null,
  'center-b',
)
assert(staffDraft.id.startsWith('staff-'))
const editedStaff = staffModule.buildStaffMemberFromForm(
  { ...staffDraft, fullName: 'Lê Bình Updated' },
  { ...staffDraft, createdAt: '2026-07-01T00:00:00.000Z', extraStaffField: 'still-here' },
  'center-b',
)
assert.equal(editedStaff.id, staffDraft.id)
assert.equal(editedStaff.createdAt, '2026-07-01T00:00:00.000Z')
assert.equal(editedStaff.extraStaffField, 'still-here')
assert.notEqual(editedStaff.updatedAt, editedStaff.createdAt)

const archivedStaff = staffModule.archiveStaffMember(editedStaff)
assert.equal(archivedStaff.id, editedStaff.id)
assert.equal(archivedStaff.employmentStatus, 'archived')
assert(archivedStaff.archivedAt)
const restoredStaff = staffModule.restoreStaffMember(archivedStaff)
assert.equal(restoredStaff.id, editedStaff.id)
assert.equal(restoredStaff.employmentStatus, 'active')
assert.equal(restoredStaff.archivedAt, '')

const departmentErrors = staffModule.validateDepartmentForm(
  { name: 'hoc thuat', code: 'aca' },
  { departments: centerADepartments },
)
assert.equal(departmentErrors.name, 'Tên phòng ban đã được sử dụng trong cơ sở này.')
assert.equal(departmentErrors.code, 'Mã phòng ban đã được sử dụng trong cơ sở này.')

const departmentDraft = staffModule.buildDepartmentFromForm(
  { name: 'Vận hành', code: 'OPS', description: 'Ops', sortOrder: '2' },
  null,
  'center-b',
)
assert(departmentDraft.id.startsWith('department-'))
const archivedDepartment = staffModule.archiveDepartment(departmentDraft)
assert.equal(archivedDepartment.status, 'archived')
const restoredDepartment = staffModule.restoreDepartment(archivedDepartment)
assert.equal(restoredDepartment.id, departmentDraft.id)
assert.equal(restoredDepartment.status, 'active')

const html = staffModule.renderStaffModule({
  staffMembers: [
    {
      id: 'staff-html',
      employeeCode: '<script>alert(1)</script>',
      fullName: '<script>alert(1)</script>',
      positionTitle: 'Admin',
      employmentType: 'unspecified',
      employmentStatus: 'active',
      startDate: '2026-07-26',
    },
  ],
  departments: [],
  teachers: [],
})
assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
assert(!html.includes('<script>alert(1)</script>'))
assert(!html.includes('data-staff-action="link"'))
assert(!html.includes('data-staff-action="unlink"'))
assert(!html.includes('password'))
assert(!html.includes('center_members'))

for (const marker of [
  '.staff-toolbar',
  '.staff-modal',
  '.staff-profile-table',
  '.staff-department-panel',
  '.staff-attendance-details',
]) {
  assert(styles.includes(marker), `Missing style marker: ${marker}`)
}

for (const marker of [
  'FOUR_CONCEPTS_SEPARATED: YES',
  'CENTER_STAFF_MEMBERS_DESIGNED: YES',
  'CENTER_DEPARTMENTS_DESIGNED: YES',
]) {
  assert(doc.includes(marker), `F23.10A doc missing marker: ${marker}`)
}

const publicDiffSources = [main, modules, storageSource, staffSource, styles].join('\n')
for (const forbidden of createForbiddenPublicSecretMarkers()) {
  assert(!publicDiffSources.includes(forbidden), `Public source must not include secret marker: ${forbidden}`)
}

for (const forbidden of [
  'TEACHER_WORKSPACE_MODULE_ID',
  'module-14',
  'Module 14',
  'signUp(',
  'auth.signUp(',
  'create table',
  'alter table',
  'drop table',
]) {
  assert(!publicDiffSources.toLowerCase().includes(forbidden.toLowerCase()), `Forbidden runtime marker: ${forbidden}`)
}

for (const source of [staffSource]) {
  for (const mojibake of createMojibakeMarkers()) {
    assert(!source.includes(mojibake), `Mojibake marker found: ${mojibake}`)
  }
}

console.log('F23.10B staff and department foundation smoke passed')

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
