import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  buildV21UpsertTuitionPackageCommand,
  pullV21CenterSettings,
} from '../src/cloud-authoritative-center-settings.js'
import { pullV24PackageCycleState } from '../src/cloud-authoritative-tuition-cycles.js'
import {
  convertF4bCrmCaseToStudent,
} from '../src/cloud-authoritative-crm.js'
import {
  buildF4bStudentPayload,
  canConvertParentContactToStudent,
  createF4bConversionFormState,
  initialParentConsultationFilters,
  mergeParentContactsWithStudents,
  renderParentConsultationModule,
  validateF4bConversionForm,
} from '../src/parent-consultation-module.js'
import {
  createEditSettingsTuitionPackageFormState,
  validateSettingsTuitionPackageForm,
} from '../src/settings-module.js'
import {
  deriveTuitionRegistrationClassification,
  groupTuitionPackagesByProgram,
} from '../src/tuition-module.js'

const centerId = 'center-f4b-smoke'
const caseId = '11111111-1111-4111-8111-111111111111'
const candidateId = '22222222-2222-4222-8222-222222222222'
const requestId = '33333333-3333-4333-8333-333333333333'
const contact = {
  id: 'crm-contact-local',
  canonicalContactId: '44444444-4444-4444-8444-444444444444',
  canonicalCaseId: caseId,
  canonicalCandidateId: candidateId,
  cloudCaseVersion: 4,
  cloudCandidateVersion: 2,
  parentName: 'Nguyễn Phụ Huynh',
  leadStudentName: 'Nguyễn Minh Anh',
  studentBirthYear: '2016',
  consultationStatus: 'pendingEnrollment',
  customerStage: 'consulting',
  source: 'walkIn',
  sourceLabel: 'Trực tiếp',
  createdAt: '2026-09-22T08:00:00.000Z',
  careLogs: [],
  appointments: [],
}

assert.equal(canConvertParentContactToStudent(contact), true)
assert.equal(canConvertParentContactToStudent({ ...contact, consultationStatus: 'activeCare' }), false)

const formState = createF4bConversionFormState(contact)
formState.values = {
  ...formState.values,
  birthDate: '2016-05-10',
  schoolName: 'Trường Sao Mai',
  level: 'Nhập môn',
  guardianRole: 'MOTHER',
  guardianOccupation: 'Giáo viên',
}
assert.deepEqual(validateF4bConversionForm(contact, formState, []), {})
assert.match(
  validateF4bConversionForm(contact, {
    ...formState,
    values: { ...formState.values, birthDate: '2015-05-10' },
  }, []).birthDate,
  /2016/,
)
assert.match(
  validateF4bConversionForm(contact, { ...formState, mode: 'LINK_EXISTING' }, []).studentId,
  /Học viên/,
)
assert.deepEqual(
  validateF4bConversionForm(contact, {
    ...formState,
    mode: 'LINK_EXISTING',
    values: { ...formState.values, studentId: 'student-existing' },
  }, [{ id: 'student-existing', cloudVersion: 3 }]),
  {},
)
assert.equal(buildF4bStudentPayload(contact, formState.values).fullName, 'Nguyễn Minh Anh')

const calls = []
const supabase = {
  rpc: async (name, args) => {
    calls.push({ name, args })
    return {
      data: {
        ok: true,
        outcome_code: 'COMMITTED',
        center_id: centerId,
        case_id: caseId,
        candidate_id: candidateId,
        student_id: `student-crm-${candidateId}`,
        student_entity_version: 1,
        link_id: '55555555-5555-4555-8555-555555555555',
        business_replayed: calls.length > 1,
      },
      error: null,
    }
  },
}
const command = {
  supabase,
  centerId,
  caseId,
  candidateId,
  expectedCaseVersion: 4,
  expectedCandidateVersion: 2,
  mode: 'CREATE_NEW',
  expectedStudentVersion: 0,
  studentPayload: buildF4bStudentPayload(contact, formState.values),
  guardianRole: 'MOTHER',
  guardianOccupation: 'Giáo viên',
  idempotencyKey: requestId,
}
const first = await convertF4bCrmCaseToStudent(command)
const retry = await convertF4bCrmCaseToStudent(command)
assert.equal(first.ok, true)
assert.equal(retry.ok, true)
assert.equal(retry.student_id, first.student_id)
assert.equal(calls[0].name, 'f4b_convert_crm_case_to_student')
assert.equal(calls[0].args.p_idempotency_key, calls[1].args.p_idempotency_key)
assert.equal(calls[0].args.p_guardian_role, 'MOTHER')
assert.equal('p3d_executor' in calls[0].args, false)

const wrongCenter = await convertF4bCrmCaseToStudent({
  ...command,
  supabase: {
    rpc: async () => ({
      data: { ...first, center_id: 'other-center' },
      error: null,
    }),
  },
})
assert.equal(wrongCenter.ok, false)
assert.equal(wrongCenter.outcome_code, 'CENTER_CONTEXT_CHANGED')

const ordered = mergeParentContactsWithStudents([
  { ...contact, id: 'older', createdAt: '2026-09-20T00:00:00.000Z' },
  { ...contact, id: 'newer', createdAt: '2026-09-22T00:00:00.000Z' },
], [], [])
assert.deepEqual(ordered.map((item) => item.id), ['newer', 'older'])

const customerHtml = renderParentConsultationModule(
  [contact],
  initialParentConsultationFilters,
  [],
  null,
  null,
  null,
  contact.id,
  null,
  { isLoading: false },
  { status: 'ready', moduleRefreshStatus: 'ready', links: [] },
)
const childColumn = customerHtml.indexOf('<th>Họ và tên bé</th>')
assert(childColumn > customerHtml.indexOf('<th>Phụ huynh / Liên hệ</th>'))
assert(childColumn < customerHtml.indexOf('<th>Stage / Trạng thái</th>'))
assert.match(customerHtml, /data-f4b-conversion-action="open"/)
assert.doesNotMatch(customerHtml, /data-p4b-conversion-action=/)
const conversionHtml = renderParentConsultationModule(
  [contact],
  initialParentConsultationFilters,
  [{ id: 'student-existing', fullName: 'Học Viên Hiện Có', cloudVersion: 3 }],
  null,
  null,
  null,
  contact.id,
  null,
  { isLoading: false },
  {
    status: 'ready',
    moduleRefreshStatus: 'ready',
    links: [],
    f4bConversionState: { ...formState, idempotencyKey: requestId },
  },
)
for (const token of [
  'data-f4b-conversion-form',
  'data-conversion-mode="CREATE_NEW"',
  'data-conversion-mode="LINK_EXISTING"',
  'data-f4b-conversion-field="birthDate"',
  'data-f4b-conversion-field="guardianRole"',
  'data-f4b-conversion-field="guardianOccupation"',
  'Xác nhận chuyển đổi',
]) assert(conversionHtml.includes(token), `F4B conversion modal is missing ${token}`)
assert.doesNotMatch(conversionHtml, /data-p4b-conversion-action=/)

const packageCommand = buildV21UpsertTuitionPackageCommand({
  packageName: 'Gói 24 buổi',
  programName: 'Cờ vua nền tảng',
  totalSessions: 24,
  defaultAmount: 2400000,
  isActive: true,
})
assert.equal(packageCommand.program_name, 'Cờ vua nền tảng')
const settingsProjection = await pullV21CenterSettings({
  centerId,
  supabase: {
    rpc: async () => ({
      data: {
        ok: true,
        outcome_code: 'AUTHORITATIVE_SNAPSHOT',
        center_id: centerId,
        center: {
          center_id: centerId,
          center_code: 'F4B',
          display_name: 'F4B Center',
          environment: 'production',
          status: 'active',
          version: 1,
        },
        tuition_packages: [{
          id: requestId,
          center_id: centerId,
          package_name: 'Gói 24 buổi',
          program_name: 'Cờ vua nền tảng',
          total_sessions: 24,
          default_amount: 2400000,
          is_active: true,
          note: '',
          version: 1,
          updated_at: '2026-09-22T00:00:00Z',
        }],
        shared_wallpaper: null,
        shared_wallpaper_version: 0,
      },
      error: null,
    }),
  },
})
assert.equal(settingsProjection.tuitionPackages[0].programName, 'Cờ vua nền tảng')
const cycleProjection = await pullV24PackageCycleState({
  centerId,
  supabase: {
    rpc: async () => ({
      data: {
        ok: true,
        status: 'READY',
        contract: 'v2.4-package-cycle-v1',
        center_id: centerId,
        students: [],
        contributions: [],
        package_catalog: [{
          id: requestId,
          package_name: 'Gói 24 buổi',
          program_name: 'Cờ vua nền tảng',
          total_sessions: 24,
          default_amount: 2400000,
          is_active: true,
          version: 1,
        }],
      },
      error: null,
    }),
  },
})
assert.equal(cycleProjection.packageCatalog[0].programName, 'Cờ vua nền tảng')
const packageForm = createEditSettingsTuitionPackageFormState({
  id: requestId,
  packageName: 'Gói 24 buổi',
  programName: 'Cờ vua nền tảng',
  totalSessions: 24,
  defaultAmount: 2400000,
})
assert.equal(packageForm.values.programName, 'Cờ vua nền tảng')
assert.deepEqual(validateSettingsTuitionPackageForm(packageForm.values), {})
assert.deepEqual(
  groupTuitionPackagesByProgram([
    { id: 'a', programName: 'Nâng cao' },
    { id: 'b', programName: 'Nền tảng' },
    { id: 'c', programName: 'Nền tảng' },
    { id: 'd', programName: '' },
  ]).map((group) => [group.programName, group.packages.length]),
  [['Nâng cao', 1], ['Nền tảng', 2], ['Dùng chung', 1]],
)
assert.equal(deriveTuitionRegistrationClassification(null, null), 'Đăng ký mới')
assert.equal(deriveTuitionRegistrationClassification({ id: 'tuition-1' }, null), 'Tái đăng ký')
assert.equal(deriveTuitionRegistrationClassification(null, { cycles: [{ id: 'cycle-1' }] }), 'Tái đăng ký')

const studentSource = await readFile(new URL('../src/student-module.js', import.meta.url), 'utf8')
const studentDetailSource = await readFile(new URL('../src/student-detail.js', import.meta.url), 'utf8')
const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
const tuitionSource = await readFile(new URL('../src/tuition-module.js', import.meta.url), 'utf8')
const migrationSource = await readFile(new URL('../supabase/migrations/202609220001_f4b_customer_student_handoff_authority.sql', import.meta.url), 'utf8')
assert.doesNotMatch(studentSource, /<th>Elo<\/th>/)
assert.doesNotMatch(studentSource, /student\.elo/)
assert(studentSource.indexOf("renderSelectField('currentStatus'") < studentSource.indexOf("renderFormSection('D. Chăm sóc"))
assert(studentSource.indexOf("renderField('parentArea'") > studentSource.indexOf("renderField('motherPhone'"))
assert.match(studentSource, /renderField\('fatherName', 'Họ và tên ba'/)
assert.match(studentSource, /renderField\('motherName', 'Họ và tên mẹ'/)
assert.doesNotMatch(studentSource, /renderField\('parentBirthYear'/)
assert.doesNotMatch(studentSource, /renderField\('parentJob'/)
assert.match(studentSource, /parentJob: student\.parentJob/)
assert.match(studentDetailSource, /\['Trạng thái', student\.currentStatus\]/)
assert.match(studentDetailSource, /Khu vực sinh sống/)
assert.match(mainSource, /updateProtectedContactIdentity/)
assert.match(tuitionSource, /data-tuition-detail-action="edit"/)
assert.doesNotMatch(mainSource, /set_config\('ichess\.p3d_executor'/)
assert.doesNotMatch(migrationSource, /ichess\.p3d_executor/)
assert.match(migrationSource, /ichess\.f4b_conversion/)

console.log('F4B_PRODUCT_SMOKE_PASS')
