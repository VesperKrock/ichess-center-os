import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderSettingsModule } from '../src/settings-module.js'

const classSessions = [{
  id: 'class-a',
  displayLabel: 'T6 00:00 - 00:30',
  daysLabel: 'T6',
  startTime: '00:00',
  endTime: '00:30',
  status: 'inactive',
  note: '',
}]

const options = {
  centerSettingsState: {
    status: 'ready',
    centerProfile: {
      code: 'dreamhome_prod',
      displayName: 'DreamHome',
      status: 'active',
      environment: 'production',
    },
    canManageSharedWallpaper: false,
  },
  wallpaperState: { source: 'default', hasPersonal: false },
  tuitionPackages: [],
}

const renderTab = (activeTab) => renderSettingsModule(
  classSessions,
  [],
  { query: '', status: 'all' },
  null,
  { configStatus: 'configured', authStatus: 'signed-in', membershipStatus: 'loaded', role: 'staff', readinessStatus: 'ready' },
  { ...options, activeTab },
)

const infoHtml = renderTab('center-info')
for (const expected of [
  'settings-title-group',
  '<span>CÀI ĐẶT CƠ SỞ</span>',
  'settings-center-info-stack',
  'settings-center-profile-card',
  'settings-appearance-panel',
  'settings-appearance-grid',
  'settings-wallpaper-actions',
  'settings-data-status-panel',
  'data-settings-center-action="open-edit"',
]) {
  assert(infoHtml.includes(expected), `Final Settings information state is missing ${expected}`)
}
assert(!infoHtml.includes('settings-capability-notice'), 'Transient Settings provider state must not render as a working-area banner')

const classHtml = renderTab('class-sessions')
for (const expected of [
  'settings-class-session-toolbar',
  'data-settings-filter="query"',
  'data-settings-filter="status"',
  'data-settings-class-session-action="open-create"',
  'data-settings-class-session-action="open-edit"',
]) {
  assert(classHtml.includes(expected), `Final Settings class state is missing ${expected}`)
}

const packagesHtml = renderTab('tuition-packages')
assert(packagesHtml.includes('settings-tuition-package-panel'))
assert(packagesHtml.includes('data-settings-package-action="open-create"'))
assert(packagesHtml.includes('Chưa có gói học phí nào trong danh mục.'))
assert(!packagesHtml.includes('settings-capability-notice'))

const taxonomyHtml = renderTab('sample-data')
assert(taxonomyHtml.includes('settings-sample-data-panel'))
assert(taxonomyHtml.includes('settings-sample-grid'))
for (const label of ['Cấp độ học', 'Mốc bot', 'Trạng thái học viên', 'Nhóm chăm sóc']) {
  assert(taxonomyHtml.includes(label), `Final Settings taxonomy state is missing ${label}`)
}

const themeSource = readFileSync(new URL('../src/settings-v2-8p2-theme.css', import.meta.url), 'utf8')
for (const expected of [
  '--settings-workspace: #f3f4f6;',
  '--settings-workspace: #0f1115;',
  'padding: 20px 24px;',
  'height: 69px;',
  'height: 48px;',
  'height: 32px;',
  'height: 60px;',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  'height: 162px;',
  'gap: 16px;',
  'height: 151px;',
  'height: 187px;',
  'height: 111px;',
]) {
  assert(themeSource.includes(expected), `Final Settings Figma geometry/theme contract is missing ${expected}`)
}

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(mainSource.includes("import './settings-v2-8p2-theme.css'"))
assert(mainSource.includes("const isSettingsWindow = windowItem.moduleId === 'cai-dat-co-so'"))
assert(mainSource.includes("${isSettingsWindow ? 'is-settings-window' : ''}"))
assert(mainSource.includes('usesCompactModuleTitlebarCurrentness(windowItem)'))
assert(mainSource.includes('isPrimaryBusinessModuleWindow(windowItem)'))

console.log('V2-8P2 SETTINGS FINAL FIGMA PAINT SMOKE: PASS')
