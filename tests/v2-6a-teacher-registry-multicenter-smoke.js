import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  V26_TEACHER_REGISTRY_CAPABILITY_STATUS,
  buildV26AssignTeacherCommand,
  buildV26RemoveTeacherCommand,
  buildV26TeacherCommand,
  buildV26TeacherDirectoryProjection,
  buildV26TeacherReferenceProjection,
  buildV26TransferTeacherCommand,
  createV26TeacherRegistryCapabilityState,
  isV26TeacherRegistryBackendUnavailable,
  isV26TeacherRegistryCapabilityReady,
  pullV26TeacherRegistry,
} from '../src/cloud-authoritative-teacher-registry.js'
import { initialTeacherFilters, renderTeacherModule } from '../src/teacher-module.js'

const read = (path) => readFileSync(path, 'utf8')
const migrationPath = 'supabase/migrations/202609120001_v2_6_teacher_registry_multicenter_authority.sql'
const migration = read(migrationPath)
const main = read('src/main.js')
const teacherModule = read('src/teacher-module.js')
const authorityRegistry = read('src/module-authority-registry.js')
const notificationCenter = read('src/notification-center.js')

assert.deepEqual(Object.values(V26_TEACHER_REGISTRY_CAPABILITY_STATUS), [
  'idle', 'loading', 'ready', 'unavailable', 'failed',
])
for (const status of Object.values(V26_TEACHER_REGISTRY_CAPABILITY_STATUS)) {
  const state = createV26TeacherRegistryCapabilityState({ centerId: 'center-a', status })
  assert.equal(isV26TeacherRegistryCapabilityReady(state, 'center-a'), status === 'ready')
}
assert.equal(isV26TeacherRegistryCapabilityReady(
  createV26TeacherRegistryCapabilityState({ centerId: 'center-a', status: 'ready' }),
  'center-b',
), false, 'Teacher Registry capability leaked across centers')
for (const code of ['42P01', '42883', 'PGRST202', 'PGRST205']) {
  assert.equal(isV26TeacherRegistryBackendUnavailable({ code }), true)
}
assert.equal(isV26TeacherRegistryBackendUnavailable({ code: '42501' }), false)

const teacherId = '26000000-0000-4000-8000-000000000001'
const assignmentA = {
  id: '26000000-0000-4000-8000-000000000002',
  centerId: 'center-a', centerName: 'Cơ sở A', status: 'assigned', version: 2,
}
const assignmentBRemoved = {
  id: '26000000-0000-4000-8000-000000000003',
  centerId: 'center-b', centerName: 'Cơ sở B', status: 'removed', version: 3,
}
const teacher = {
  id: teacherId, fullName: 'Giáo viên chuẩn', displayName: 'GV Chuẩn',
  phone: '0900000000', email: 'teacher@example.test', status: 'active',
  teacherType: 'parttime', specialties: ['Cờ vua'], levels: ['basic'],
  mainRole: 'Giáo viên', note: '', registryVersion: 4,
  assignments: [assignmentA, assignmentBRemoved], assignment: assignmentA,
}
const createCommand = buildV26TeacherCommand({
  fullName: '  Giáo viên mới  ', displayName: ' GV Mới ', phone: '0901',
  email: 'NEW@EXAMPLE.TEST', status: 'active', teacherType: 'fulltime',
  specialties: 'Cờ vua, Cờ vua, Khai cuộc', levels: ['basic'], mainRole: 'Giáo viên',
})
assert.equal(createCommand.operation, 'CREATE_TEACHER')
assert.equal(createCommand.expected_version, 0)
assert.equal(createCommand.email, 'new@example.test')
assert.deepEqual(createCommand.specialties, ['Cờ vua', 'Khai cuộc'])
const updateCommand = buildV26TeacherCommand({ ...teacher, specialties: teacher.specialties }, teacher)
assert.equal(updateCommand.operation, 'UPDATE_TEACHER')
assert.equal(updateCommand.expected_version, 4)
assert.deepEqual(buildV26AssignTeacherCommand(teacher, { centerId: 'center-b' }, assignmentBRemoved), {
  operation: 'ASSIGN', teacher_id: teacherId, to_center_id: 'center-b', expected_version: 3,
})
assert.equal(buildV26RemoveTeacherCommand(teacher, assignmentA).expected_version, 2)
const transfer = buildV26TransferTeacherCommand(
  teacher, assignmentA, { centerId: 'center-b' }, assignmentBRemoved,
)
assert.equal(transfer.operation, 'TRANSFER')
assert.equal(transfer.target_expected_version, 3)
assert.throws(() => buildV26TransferTeacherCommand(teacher, assignmentA, { centerId: 'center-a' }))

const legacyTeacher = { id: 'legacy-teacher', fullName: 'Hồ sơ cũ', displayName: 'Cũ' }
const ownerState = createV26TeacherRegistryCapabilityState({
  centerId: 'center-a', status: 'ready', canManageRegistry: true,
  registryTeachers: [teacher], assignedTeachers: [teacher],
})
const adminState = createV26TeacherRegistryCapabilityState({
  centerId: 'center-a', status: 'ready', role: 'center_admin', canManageRegistry: false,
  assignedTeachers: [teacher], registryTeachers: [], managedCenters: [],
})
const ownerDirectory = buildV26TeacherDirectoryProjection({
  legacyTeachers: [legacyTeacher], capabilityState: ownerState,
})
assert.equal(ownerDirectory.length, 2)
assert.equal(ownerDirectory.find((item) => item.id === 'legacy-teacher').legacyReviewRequired, true)
const adminDirectory = buildV26TeacherDirectoryProjection({
  legacyTeachers: [legacyTeacher], capabilityState: adminState,
})
assert.deepEqual(adminDirectory.map((item) => item.id), [teacherId],
  'Admin directory must contain assigned canonical Teachers only')
const exactCenterReferences = buildV26TeacherReferenceProjection({
  legacyTeachers: [legacyTeacher], capabilityState: adminState,
})
assert.deepEqual(exactCenterReferences.map((item) => item.id), [teacherId, 'legacy-teacher'],
  'Exact-center legacy references must remain available without becoming canonical identity')
const ownerHtml = renderTeacherModule(
  ownerDirectory, initialTeacherFilters, null, teacherId, [], [], [], [],
  { registryContext: { ...ownerState, managedCenters: [
    { centerId: 'center-a', centerName: 'Cơ sở A' },
    { centerId: 'center-b', centerName: 'Cơ sở B' },
  ] } },
)
assert(ownerHtml.includes('data-teacher-action="open-create"'))
assert(ownerHtml.includes('data-v26-teacher-assignment-action="assign"'))
const adminHtml = renderTeacherModule(
  adminDirectory, initialTeacherFilters, null, teacherId, [], [], [], [],
  { registryContext: adminState },
)
assert(!adminHtml.includes('data-teacher-action="open-create"'))
assert(!adminHtml.includes('data-v26-teacher-assignment-action='))
assert(!adminHtml.includes('Owner-only note'))

const assignedRow = {
  id: teacherId, full_name: 'Giáo viên chuẩn', display_name: 'GV Chuẩn',
  phone: '0900', email: 'teacher@example.test', birth_year: null,
  status: 'active', teacher_type: 'fulltime', specialties: [], levels: [],
  main_role: '', note: '', version: 1, updated_at: '2026-09-12T00:00:00Z',
  assignment_id: assignmentA.id, assignment_status: 'assigned', assignment_version: 1,
  assignment_updated_at: '2026-09-12T00:00:00Z',
}
const adminSnapshot = await pullV26TeacherRegistry({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a',
    role: 'admin', can_manage_registry: false, assigned_teachers: [assignedRow],
    registry_teachers: [], managed_centers: [], assignment_events: [],
  }, error: null }) },
})
assert.equal(adminSnapshot.ok, true)
assert.equal(adminSnapshot.role, 'center_admin')
assert.equal(adminSnapshot.canManageRegistry, false)
assert.equal(adminSnapshot.assignedTeachers[0].id, teacherId)
const foreignSnapshot = await pullV26TeacherRegistry({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: { ...adminSnapshot, center_id: 'center-b' }, error: null }) },
})
assert.equal(foreignSnapshot.ok, false)

for (const table of [
  'canonical_teacher_registry', 'teacher_center_assignments',
  'teacher_registry_events', 'teacher_registry_command_results',
]) {
  assert(migration.includes(`alter table public.${table} force row level security`))
  assert(migration.includes(`revoke all on table public.${table} from public, anon, authenticated, service_role`))
}
assert(migration.includes("set search_path = ''"))
assert(migration.includes('v2_6_owner_required'))
assert(migration.includes("'teacher_assignment:' || p_center_id"))
assert(migration.includes("'teacher_registry:' || p_center_id"))
assert(/from public\.canonical_teacher_registry\s+where id = v_teacher_id\s+for update;/s.test(migration),
  'Assignment mutations must serialize on the canonical Teacher row')
assert(migration.includes('rename to c5_1_internal_mutate_core_entity_pre_v26'))
assert(migration.includes("'V2_6_TEACHER_REGISTRY_REQUIRED'"))
assert(!migration.includes('insert into public.center_cloud_entities'))
assert(!migration.includes('delete from public.center_cloud_entities'))
assert.equal(createHash('sha256').update(readFileSync(migrationPath)).digest('hex').length, 64)

assert(authorityRegistry.includes("['V2.6 Canonical Teacher Registry']"))
assert(authorityRegistry.includes("['teacher-registry']"))
assert(main.includes("case 'teacher-registry':"))
assert(main.includes("await refreshV26TeacherRegistry({ reason: 'capability-probe', silent: true })"))
assert(main.includes('resetV26TeacherRegistryRuntimeForAccessBoundary'))
assert(main.includes('getCurrentTeacherReferenceProjection()'))
assert(!main.includes('async function writeTeacherThroughCloud'))
assert(!main.includes('async function commitTeacherProjection'))
assert(teacherModule.includes('data-v26-teacher-assignment-action="assign"'))
assert(teacherModule.includes('data-v26-teacher-assignment-action="remove"'))
assert(teacherModule.includes('data-v26-teacher-assignment-action="transfer"'))
assert(teacherModule.includes('canManageRegistry'))
assert(!notificationCenter.includes('teacher_registry_events'),
  'V2-6A must not implement the future Notification Center provider')

console.log('V2-6A Teacher Registry multi-center smoke: PASS')
