import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createEmptySettingsTuitionPackageFormState,
  createSettingsCenterProfileFormState,
  isCurrentSettingsDraftSubmission,
  renderSettingsModule,
  retainSettingsDraftsOnRefresh,
  validateSettingsTuitionPackageForm,
} from '../src/settings-module.js'
import { buildV21UpsertTuitionPackageCommand } from '../src/cloud-authoritative-center-settings.js'

const main = readFileSync('src/main.js', 'utf8')
const values = { ...createEmptySettingsTuitionPackageFormState().values, packageName: 'Gói QA', totalSessions: '12' }
assert.match(validateSettingsTuitionPackageForm(values).defaultAmount, /Nhập học phí mặc định/)
let dispatched = 0
if (!Object.keys(validateSettingsTuitionPackageForm(values)).length) dispatched += 1
assert.equal(dispatched, 0, 'Blank required amount must stop the command before dispatch')
for (const amount of ['0', '500', '1600000']) {
  const input = { ...values, defaultAmount: amount }
  assert.deepEqual(validateSettingsTuitionPackageForm(input), {})
  assert.equal(buildV21UpsertTuitionPackageCommand(input).default_amount, Number(amount))
}
for (const amount of ['abc', '-1', '0.5']) {
  assert.match(validateSettingsTuitionPackageForm({ ...values, defaultAmount: amount }).defaultAmount, /số nguyên không âm/)
}

const centerInfo = { ok: true, code: 'center-a', name: 'Cơ sở A' }
const renderCenter = (status, centerProfile, message = '') => renderSettingsModule([], [], undefined, null, null, {
  activeTab: 'center-info', centerInfo,
  centerSettingsState: { status, centerProfile, message },
  wallpaperState: { source: 'default', hasPersonal: false },
})
const loading = renderCenter('loading')
assert.match(loading, /Đang tải Cài đặt cơ sở/)
assert.doesNotMatch(loading, /Đang tắt|Chưa thiết lập|Tên hiển thị<\/span>/)
assert.match(loading, /data-settings-center-action="open-edit" disabled/)
const failed = renderCenter('failed', null, 'PGRST202 raw SQL provider detail')
assert.match(failed, /Chưa tải được Cài đặt cơ sở/)
assert.doesNotMatch(failed, /PGRST202|raw SQL|Đang tắt|Chưa thiết lập/)
const readyBlank = renderCenter('ready', {
  centerId: 'center-a', centerCode: 'center-a', displayName: 'Cơ sở A',
  version: 1, address: '', phone: '', renewalMaterialFee: null,
  receiptPrefix: 'CA', initialStudentSetupEnabled: false,
})
assert.match(readyBlank, /Chưa cập nhật/)
assert.match(readyBlank, /Đang tắt/)
assert.match(readyBlank, /Chưa thiết lập/)
const readyZero = renderCenter('ready', {
  centerId: 'center-a', centerCode: 'center-a', displayName: 'Cơ sở A',
  version: 1, renewalMaterialFee: 0, receiptPrefix: 'CA',
})
assert.match(readyZero, /0(?:\s|&nbsp;)*₫/)
assert.match(renderCenter('ready', {
  centerId: 'center-a', centerCode: 'center-a', displayName: 'Cơ sở A',
  version: 1, renewalMaterialFee: 500, receiptPrefix: 'CA',
}), /500(?:\s|&nbsp;)*₫/)
assert.match(readyZero, /data-settings-center-action="open-edit"/)
assert.doesNotMatch(readyZero, /desktop|\bOwner\b|lớp phủ tương phản/i)

const profileForm = createSettingsCenterProfileFormState({ displayName: 'Cơ sở A', renewalMaterialFee: 500, receiptPrefix: 'CA' })
const packageForm = createEmptySettingsTuitionPackageFormState()
const sameCenter = retainSettingsDraftsOnRefresh('center-a', 'center-a', profileForm, packageForm)
assert.equal(sameCenter.profileDraft, profileForm)
assert.equal(sameCenter.packageDraft, packageForm)
assert.deepEqual(retainSettingsDraftsOnRefresh('center-a', 'center-b', profileForm, packageForm), {
  profileDraft: null, packageDraft: null,
})
assert.equal(createSettingsCenterProfileFormState({ displayName: 'Cơ sở A mới', receiptPrefix: 'CA' }).values.displayName, 'Cơ sở A mới',
  'Cancel and reopen must use the latest authoritative center snapshot')

const submittedA = { ...profileForm, requestId: 'request-a' }
const newerB = { ...profileForm, values: { ...profileForm.values, displayName: 'B local draft' } }
for (const outcome of ['success', 'failure']) {
  assert.equal(isCurrentSettingsDraftSubmission('center-a', 'center-b', submittedA, newerB), false,
    `Late A ${outcome} must not alter B`)
  assert.equal(isCurrentSettingsDraftSubmission('center-a', 'center-b', submittedA, null), false,
    `Late A ${outcome} must not reopen a blank B form`)
}
assert.equal(isCurrentSettingsDraftSubmission('center-a', 'center-a', submittedA, newerB), false,
  'A newer same-center draft must survive the old completion')
assert.equal(isCurrentSettingsDraftSubmission('center-a', 'center-a', submittedA, submittedA), true,
  'Normal same-center completion must remain applicable')
assert.match(main, /const retainedDrafts = retainSettingsDraftsOnRefresh\(/)
assert.match(main, /v21CenterSettingsCapabilityState\.isSaving\) \{\s*return \{ ok: true, skipped: true, outcome_code: 'SETTINGS_SAVE_IN_PROGRESS' \}/,
  'A same-center refresh must not invalidate an in-flight Settings write')
assert.match(main, /state\.status === 'loading' \|\| isSettingsSaving \? 'disabled'/,
  'The Settings refresh control must be disabled while saving')
assert.equal((main.match(/if \(!isCurrentSettingsDraftSubmission\(/g) || []).length, 4,
  'Both profile and package success/error completion paths must guard the current draft')

const profileFormHtml = renderSettingsModule([], [], undefined, null, null, {
  activeTab: 'center-info', centerSettingsState: { status: 'ready', centerProfile: {
    centerId: 'center-a', centerCode: 'center-a', displayName: 'Cơ sở A', version: 1, renewalMaterialFee: 500, receiptPrefix: 'CA',
  } }, centerProfileFormState: profileForm,
})
const packageFormHtml = renderSettingsModule([], [], undefined, null, null, {
  activeTab: 'tuition-packages', centerSettingsState: { status: 'ready' }, tuitionPackageFormState: packageForm,
})
assert.match(profileFormHtml, /data-settings-center-field="renewalMaterialFee"[^>]*step="1"/)
assert.match(packageFormHtml, /data-settings-package-field="defaultAmount"[^>]*step="1"/)
assert.doesNotMatch(profileFormHtml + packageFormHtml, /step="1000"/)
const statusHandler = main.slice(main.indexOf("if (action === 'toggle-status')"), main.indexOf("document.querySelectorAll('[data-settings-package-field]')"))
assert.match(statusHandler, /tuitionPackage\.isActive && !window\.confirm\(/)
assert.match(statusHandler, /button\.disabled = true/)
assert.ok(statusHandler.indexOf('window.confirm(') < statusHandler.indexOf('writeV21CenterSettingsCommand('))
assert.match(statusHandler, /centerId !== getCurrentCanonicalCenterContext\(\)\.centerId/)
assert.match(statusHandler, /buildV21SetTuitionPackageStatusCommand\(tuitionPackage, !tuitionPackage\.isActive\)/)

console.log('M9_1_CENTER_SETTINGS_AUDIT_FIXES_SMOKE: PASS')
