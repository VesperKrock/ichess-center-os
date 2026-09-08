import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  buildV21ClearSharedWallpaperCommand,
  buildV21SetSharedWallpaperCommand,
  buildV21SetTuitionPackageStatusCommand,
  buildV21UpdateCenterProfileCommand,
  buildV21UpsertTuitionPackageCommand,
  canWriteV21CenterSettings,
  createV21CenterSettingsCapabilityState,
  isV21CenterSettingsBackendUnavailable,
  isV21CenterSettingsCapabilityReady,
  mutateV21CenterSettings,
  pullV21CenterSettings,
  V21_CENTER_SETTINGS_CAPABILITY_STATUS,
} from '../src/cloud-authoritative-center-settings.js'
import {
  buildSettingsClassSessionFromForm,
  createEmptySettingsTuitionPackageFormState,
  renderSettingsModule,
  validateSettingsCenterProfileForm,
  validateSettingsTuitionPackageForm,
} from '../src/settings-module.js'
import {
  buildPersonalWallpaperKey,
  resolveWallpaperPriority,
} from '../src/wallpaper-preferences.js'
import {
  getModuleRefreshContract,
} from '../src/module-authority-registry.js'
import {
  assertNoBrowserBusinessAuthority,
  BROWSER_STORAGE_REGISTRY,
} from '../src/browser-storage-registry.js'

const read = (path) => readFileSync(path, 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
const main = read('src/main.js')
const settingsSource = read('src/settings-module.js')
const stylesSource = read('src/styles.css')
const migrationPath = 'supabase/migrations/202609080001_v2_1_center_settings_foundation.sql'
const migration = read(migrationPath)

const states = Object.values(V21_CENTER_SETTINGS_CAPABILITY_STATUS)
assert.deepEqual(states, ['idle', 'loading', 'ready', 'unavailable', 'failed'])
for (const status of states) {
  const state = createV21CenterSettingsCapabilityState({ centerId: 'center-a', status })
  assert.equal(isV21CenterSettingsCapabilityReady(state, 'center-a'), status === 'ready')
}
assert.equal(isV21CenterSettingsCapabilityReady(
  createV21CenterSettingsCapabilityState({ centerId: 'center-a', status: 'ready' }),
  'center-b',
), false, 'Center settings capability leaked across centers')
assert.equal(canWriteV21CenterSettings({ role: 'owner', canWrite: true }).ok, true)
assert.equal(canWriteV21CenterSettings({ role: 'admin', canWrite: true }).ok, true)
assert.equal(canWriteV21CenterSettings({ role: 'teacher', canWrite: true }).ok, false)

for (const code of ['PGRST202', 'PGRST205', '42P01', '42883']) {
  assert.equal(isV21CenterSettingsBackendUnavailable({ code }), true)
  const result = await pullV21CenterSettings({
    centerId: 'center-a',
    supabase: { rpc: async () => ({ data: null, error: { code, message: 'missing function' } }) },
  })
  assert.equal(result.ok, false)
  assert.equal(result.outcome_code, 'BACKEND_NOT_DEPLOYED')
  assert.equal(result.error, 'Cài đặt dùng chung hiện chưa khả dụng.')
}

const failedRead = await pullV21CenterSettings({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: null, error: { code: '57014', message: 'raw timeout' } }) },
})
assert.equal(failedRead.outcome_code, 'CENTER_SETTINGS_READ_FAILED')
assert.doesNotMatch(failedRead.error, /57014|timeout|database/i)

const snapshotPayload = {
  ok: true,
  outcome_code: 'AUTHORITATIVE_SNAPSHOT',
  center_id: 'center-a',
  center: {
    center_id: 'center-a',
    center_code: 'center-a',
    display_name: 'iChess Tân Bình',
    address: 'Địa chỉ QA',
    phone: '0900000000',
    note: 'Vận hành',
    environment: 'production',
    status: 'active',
    version: 2,
  },
  tuition_packages: [{
    id: '11111111-1111-4111-8111-111111111111',
    center_id: 'center-a',
    package_name: 'Gói 12 buổi',
    total_sessions: 12,
    default_amount: 2400000,
    is_active: true,
    note: 'Mặc định',
    version: 1,
    updated_at: '2026-09-08T00:00:00Z',
  }],
  shared_wallpaper: {
    storage_bucket: 'ichess-os-wallpapers',
    storage_path: 'shared/22222222-2222-4222-8222-222222222222.webp',
    mime_type: 'image/webp',
    version: 3,
    updated_at: '2026-09-08T00:00:00Z',
  },
  shared_wallpaper_version: 3,
  can_manage_shared_wallpaper: true,
}
const readyRead = await pullV21CenterSettings({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: snapshotPayload, error: null }) },
})
assert.equal(readyRead.ok, true)
assert.equal(readyRead.centerProfile.centerCode, 'center-a')
assert.equal(readyRead.tuitionPackages[0].packageName, 'Gói 12 buổi')
assert.equal(readyRead.sharedWallpaper.version, 3)
assert.equal(readyRead.sharedWallpaperVersion, 3)
assert.equal(readyRead.canManageSharedWallpaper, true)

const clearedWallpaperRead = await pullV21CenterSettings({
  centerId: 'center-a',
  supabase: { rpc: async () => ({
    data: { ...snapshotPayload, shared_wallpaper: null, shared_wallpaper_version: 4 },
    error: null,
  }) },
})
assert.equal(clearedWallpaperRead.ok, true)
assert.equal(clearedWallpaperRead.sharedWallpaper, null)
assert.equal(clearedWallpaperRead.sharedWallpaperVersion, 4)

const wrongCenter = await pullV21CenterSettings({
  centerId: 'center-b',
  supabase: { rpc: async () => ({ data: snapshotPayload, error: null }) },
})
assert.equal(wrongCenter.ok, false)
assert.equal(wrongCenter.outcome_code, 'CENTER_CONTEXT_CHANGED')

const writeCalls = []
const writeResult = await mutateV21CenterSettings({
  centerId: 'center-a',
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
  command: { operation: 'UPDATE_CENTER_PROFILE', expected_version: 2 },
  supabase: { rpc: async (name, params) => {
    writeCalls.push({ name, params })
    return { data: { ok: true, outcome_code: 'COMMITTED', center_id: 'center-a' }, error: null }
  } },
})
assert.equal(writeResult.ok, true)
assert.equal(writeCalls[0].name, 'v2_1_mutate_center_settings')
assert.equal(writeCalls[0].params.p_center_id, 'center-a')
const missingWallpaperWrite = await mutateV21CenterSettings({
  centerId: 'center-a',
  idempotencyKey: '44444444-4444-4444-8444-444444444444',
  command: { operation: 'SET_SHARED_WALLPAPER' },
  supabase: { rpc: async () => ({ data: null, error: { message: 'v2_1_wallpaper_object_missing' } }) },
})
assert.equal(missingWallpaperWrite.outcome_code, 'WALLPAPER_OBJECT_MISSING')
assert.doesNotMatch(missingWallpaperWrite.error, /v2_1|rpc|storage\.objects/i)

assert.deepEqual(buildV21UpdateCenterProfileCommand({
  displayName: 'Tên mới', address: 'A', phone: 'B', note: 'C',
}, { version: 2 }), {
  operation: 'UPDATE_CENTER_PROFILE', expected_version: 2,
  display_name: 'Tên mới', address: 'A', phone: 'B', note: 'C',
})
const packageCommand = buildV21UpsertTuitionPackageCommand({
  packageName: 'Gói 24 buổi', totalSessions: '24', defaultAmount: '4800000', isActive: true, note: '',
})
assert.equal(packageCommand.operation, 'CREATE_TUITION_PACKAGE')
assert.equal(packageCommand.total_sessions, 24)
assert.equal(packageCommand.default_amount, 4800000)
assert.equal(packageCommand.expected_version, 0)
assert.deepEqual(buildV21SetTuitionPackageStatusCommand(readyRead.tuitionPackages[0], false), {
  operation: 'SET_TUITION_PACKAGE_STATUS',
  package_id: '11111111-1111-4111-8111-111111111111',
  expected_version: 1,
  is_active: false,
})
assert.deepEqual(buildV21SetSharedWallpaperCommand({
  path: 'shared/22222222-2222-4222-8222-222222222222.webp',
}, 3), {
  operation: 'SET_SHARED_WALLPAPER', expected_version: 3,
  storage_bucket: 'ichess-os-wallpapers',
  storage_path: 'shared/22222222-2222-4222-8222-222222222222.webp',
  mime_type: 'image/webp',
})
assert.deepEqual(buildV21ClearSharedWallpaperCommand(3), {
  operation: 'CLEAR_SHARED_WALLPAPER', expected_version: 3,
})

assert.deepEqual(validateSettingsCenterProfileForm({ displayName: 'Cơ sở', address: '', phone: '', note: '' }), {})
assert(validateSettingsCenterProfileForm({ displayName: '' }).displayName)
assert.deepEqual(validateSettingsTuitionPackageForm({
  packageName: 'Gói 12', totalSessions: '12', defaultAmount: '1200000', note: '',
}), {})
assert(validateSettingsTuitionPackageForm({
  packageName: '', totalSessions: '0', defaultAmount: '-1', note: '',
}).totalSessions)
assert.equal(createEmptySettingsTuitionPackageFormState().mode, 'create')

const classSession = buildSettingsClassSessionFromForm({
  daysOfWeek: ['mon', 'wed'], startTime: '18:00', endTime: '19:30', note: '', status: 'active',
})
assert.equal(classSession.displayLabel, 'T2 - T4 18:00 - 19:30')
assert.deepEqual(classSession.daysOfWeek, ['mon', 'wed'])

const readyHtml = renderSettingsModule([], [], undefined, null, null, {
  activeTab: 'tuition-packages',
  tuitionRecords: [{ packageName: 'KHÔNG ĐƯỢC SUY DIỄN', totalSessions: 99 }],
  tuitionPackages: readyRead.tuitionPackages,
  centerSettingsState: {
    status: 'ready', centerProfile: readyRead.centerProfile,
    sharedWallpaper: readyRead.sharedWallpaper, canManageSharedWallpaper: true,
  },
  wallpaperState: { source: 'personal', hasPersonal: true },
})
assert.match(readyHtml, /Gói 12 buổi/)
assert.doesNotMatch(readyHtml, /KHÔNG ĐƯỢC SUY DIỄN/)
assert.match(readyHtml, /data-settings-package-action="open-create"/)
assert.match(readyHtml, /Việc gán gói và tự động hóa chu kỳ thuộc bước V2-4/)

const unavailableHtml = renderSettingsModule([], [], undefined, null, null, {
  activeTab: 'center-info',
  centerInfo: { ok: true, code: 'center-a', name: 'Center A' },
  centerSettingsState: { status: 'unavailable' },
  wallpaperState: { source: 'default', hasPersonal: false },
})
assert.match(unavailableHtml, /Cài đặt dùng chung hiện chưa khả dụng/)
assert.match(unavailableHtml, /data-settings-center-action="open-edit" disabled/)
assert.doesNotMatch(unavailableHtml, /data-settings-wallpaper-file="shared"/)
assert.match(unavailableHtml, /data-settings-wallpaper-file="personal"/)
const loadingHtml = renderSettingsModule([], [], undefined, null, null, {
  activeTab: 'tuition-packages',
  centerSettingsState: { status: 'loading' },
})
assert.match(loadingHtml, /Đang tải cài đặt dùng chung/)
assert.match(loadingHtml, /data-settings-package-action="open-create" disabled/)

assert.equal(buildPersonalWallpaperKey({ installationNamespace: 'project-a', userId: 'user-a' }), 'project-a:user-a')
assert.notEqual(
  buildPersonalWallpaperKey({ installationNamespace: 'project-a', userId: 'user-a' }),
  buildPersonalWallpaperKey({ installationNamespace: 'project-a', userId: 'user-b' }),
)
assert.deepEqual(resolveWallpaperPriority({ personalUrl: 'blob:personal', sharedUrl: 'blob:shared' }), {
  source: 'personal', url: 'blob:personal',
})
assert.deepEqual(resolveWallpaperPriority({ sharedUrl: 'blob:shared' }), {
  source: 'shared', url: 'blob:shared',
})
assert.deepEqual(resolveWallpaperPriority({}), { source: 'default', url: '' })

assert.deepEqual(getModuleRefreshContract('cai-dat-co-so'), {
  required: ['core'], optional: ['center-settings'], actionRequired: {},
  all: ['core', 'center-settings'],
})
assert.equal(assertNoBrowserBusinessAuthority().ok, true)
const wallpaperRegistry = BROWSER_STORAGE_REGISTRY.find((item) => item.storage === 'IndexedDB')
assert.equal(wallpaperRegistry.classification, 'PERSONAL_UI_STATE')
assert.match(wallpaperRegistry.keyPattern, /<auth-user>/)

for (const token of [
  'create table public.center_operational_profiles',
  'create table public.center_tuition_package_catalog',
  'create table public.installation_shared_presentation',
  'create table public.center_settings_command_results',
  'create table public.center_settings_audit_events',
  'force row level security',
  'v2_1_list_center_settings',
  'v2_1_mutate_center_settings',
  'v2_1_can_manage_shared_wallpaper',
  'if v_membership.id is null then',
  'pg_catalog.pg_advisory_xact_lock',
  'from storage.objects object_row',
  "storage_bucket = 'ichess-os-wallpapers'",
  'revoke all on table public.center_tuition_package_catalog from public, anon, authenticated, service_role',
]) assert(migration.includes(token), `Missing migration contract: ${token}`)
assert(!/grant\s+(insert|update|delete|truncate|all)[\s\S]{0,100}to authenticated/i.test(migration),
  'Authenticated browser received direct settings table DML')
assert(!/update\s+public\.centers/i.test(migration), 'Center code/name identity table must not be mutated')
assert(!/p3d|p4b/i.test(migration), 'V2-1 migration picked up frozen conversion dependencies')

for (const token of [
  "case 'center-settings':",
  "reason: 'capability-probe'",
  'resetV21CenterSettingsRuntimeForAccessBoundary',
  'resetWallpaperRuntimeForAccessBoundary',
  'refreshPersonalWallpaperForCurrentUser',
  'isV21CenterSettingsCapabilityReady',
]) assert(main.includes(token), `Missing runtime boundary: ${token}`)
assert(!settingsSource.includes('buildSettingsTuitionPackages'), 'Tuition catalog is still derived from student records')
assert(!settingsSource.includes('Khi nhập học phí cho học viên, danh mục này sẽ tự hiển thị'))
assert(!main.includes('savePersonalWallpaperBlob(getPersonalWallpaperScope(userId), blob, globalThis.localStorage)'))
assert(stylesSource.includes("html[data-wallpaper-source='personal'] .desktop-area"))
assert(stylesSource.includes('background-image: var(--ichess-desktop-wallpaper);'), 'System default desktop background was not preserved')

console.log(`V2_1A_CENTER_SETTINGS_FOUNDATION_SMOKE: PASS (${sha256(migrationPath)})`)
