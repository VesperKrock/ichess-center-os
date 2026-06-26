import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const docPath = 'docs/taskbar-overflow-c4-5-2-one-recent-module.md'
const smokePath = 'tests/c4-5-2-taskbar-overflow-one-recent-module-smoke.js'
const mainPath = 'src/main.js'
const stylesPath = 'src/styles.css'
const appAuthPath = 'src/app-auth.js'

for (const filePath of [docPath, smokePath]) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C4.5.2 artifact: ${filePath}`)
}

const doc = read(docPath)
const smoke = read(smokePath)
const main = read(mainPath)
const styles = read(stylesPath)
const appAuth = read(appAuthPath)

for (const term of [
  'C4.5.2 sửa UX taskbar overflow',
  'Taskbar chỉ hiện 1 module gần nhất',
  'Overflow list',
  'Recent/active module',
  'Restore/focus',
  'Click outside close',
  'Close on module open',
  'không làm SQL',
  'không seed cloud',
  'không thêm cloud bootstrap mới',
  'C4.6A - SQL / Realtime preflight',
]) {
  assert(doc.includes(term), `C4.5.2 doc missing term: ${term}`)
}

assert(main.includes('function getTaskbarWindowGroups(windowItems = [])'), 'Taskbar grouping helper must exist.')
assert(main.includes('const { visibleWindows, overflowWindows } = getTaskbarWindowGroups(openWindows)'), 'Taskbar must use grouping helper.')
assert(!main.includes('const visibleWindows = openWindows.slice(0, 4)'), 'Taskbar must not show multiple direct module buttons.')
assert(main.includes('visibleWindows: recentWindow ? [recentWindow] : []'), 'Taskbar must expose only one recent window.')
assert(main.includes('overflowWindows: windowItems.filter((windowItem) => windowItem.id !== recentWindow?.id)'), 'Overflow must contain remaining windows.')
assert(main.includes('windowItem.zIndex > latestWindow.zIndex'), 'Recent/active module must be selected by zIndex.')
assert(main.includes('overflowWindows.length'), 'Overflow button must show only when there are remaining windows.')
assert(main.includes('renderWindowOverflowMenu(overflowWindows, activeWindowId)'), 'Popover must render remaining overflow windows.')
assert(main.includes('data-action="toggle-window-overflow"'), 'Overflow button must remain.')

assert(main.includes('function focusWindow(windowId)'), 'Focus/restore helper must exist.')
assert(main.includes('minimized: false, zIndex: nextZIndex'), 'focusWindow must restore and bring to front.')
assert(main.includes('document.querySelectorAll(\'[data-taskbar-window-id]\')'), 'Overflow item click binding must remain.')
assert(main.includes('focusWindow(button.dataset.taskbarWindowId)'), 'Clicking overflow item must focus/restore.')
assert(main.includes('isWindowOverflowOpen = false'), 'Overflow must close on item/module actions.')
assert(main.includes('function bindWindowOverflowOutsidePointer()'), 'Overflow outside-click helper must exist.')
assert(main.includes("target.closest?.('.window-overflow-menu')"), 'Outside click must ignore popover.')
assert(main.includes("target.closest?.('[data-action=\"toggle-window-overflow\"]')"), 'Outside click must ignore overflow button.')
assert(main.includes('function bindStartMenuOutsidePointer()'), 'Start menu outside-click helper must remain.')
assert(main.includes('bindNotificationOutsidePointer()'), 'Notification outside-click binding must remain.')
assert(main.includes('bindModuleNotificationOutsidePointer()'), 'Module notification outside-click binding must remain.')

assert(styles.includes('.taskbar-overflow'), 'Overflow button styles must remain.')
assert(styles.includes('.window-overflow-menu'), 'Overflow popover styles must remain.')
assert(styles.includes('.window-overflow-state'), 'Overflow state style must remain.')

const runtimeSources = [main, styles, appAuth].join('\n')
assert(!runtimeSources.includes('localStorage.clear('), 'C4.5.2 must not hard reset localStorage.')
assert(!runtimeSources.includes('seedCloud29'), 'C4.5.2 must not seed cloud.')
assert(!runtimeSources.includes('CREATE POLICY'), 'C4.5.2 runtime must not include SQL.')
assert(!runtimeSources.includes('CREATE TABLE'), 'C4.5.2 runtime must not include SQL.')
assert(!runtimeSources.includes('C4.6A_APPLY'), 'C4.5.2 must not do C4.6/C4.7 early.')
assert(!appAuth.includes('Đăng ký'), 'No signup action in app auth.')
assert(!/signUp\s*\(/.test(runtimeSources), 'C4.5.2 runtime must not call signUp.')
assert(!/auth\.signUp\s*\(/.test(runtimeSources), 'C4.5.2 runtime must not call supabase.auth.signUp.')

const mojibakePatterns = [
  [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x0192],
  [0x0102, 0x2020, 0x00c2, 0x00b0],
  [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x00a1, 0x00c2, 0x00bb, 0xfffd],
  [0x00c3, 0x00a1],
  [0x00c3, 0x00b4],
].map((codes) => String.fromCodePoint(...codes))

for (const [label, source] of [
  [docPath, doc],
  [smokePath, smoke],
  [stylesPath, styles],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${label} contains mojibake pattern`)
  }
}

for (const expectedNewRuntimeText of [
  'Đã thu nhỏ',
  'Đang mở',
  'Chưa có module đang mở.',
]) {
  assert(main.includes(expectedNewRuntimeText), `main.js missing clean taskbar text: ${expectedNewRuntimeText}`)
}

console.log('C4.5.2 taskbar overflow one recent module smoke passed')
