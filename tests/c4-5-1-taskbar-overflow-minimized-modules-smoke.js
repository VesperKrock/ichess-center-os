import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const docPath = 'docs/taskbar-overflow-c4-5-1.md'
const smokePath = 'tests/c4-5-1-taskbar-overflow-minimized-modules-smoke.js'
const mainPath = 'src/main.js'
const stylesPath = 'src/styles.css'
const appAuthPath = 'src/app-auth.js'

for (const filePath of [docPath, smokePath]) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C4.5.1 artifact: ${filePath}`)
}

const doc = read(docPath)
const smoke = read(smokePath)
const main = read(mainPath)
const styles = read(stylesPath)
const appAuth = read(appAuthPath)

for (const term of [
  'C4.5.1 là polish nhỏ cho app shell/taskbar',
  'không làm SQL',
  'không seed cloud',
  'không thêm cloud bootstrap mới',
  'Overflow button',
  'Popover list',
  'Minimized modules',
  'Restore/focus',
  'Click outside closes',
  'Opening module closes popover',
  'C4.6A - SQL / Realtime preflight',
]) {
  assert(doc.includes(term), `C4.5.1 doc missing term: ${term}`)
}

assert(main.includes('data-action="toggle-window-overflow"'), 'Taskbar overflow button must exist.')
assert(main.includes('aria-controls="window-overflow-menu"'), 'Overflow button must control popover.')
assert(main.includes('openWindows.length'), 'Overflow button should be driven by open window count.')
assert(main.includes('getTaskbarWindowGroups(openWindows)'), 'Taskbar must group visible and overflow windows.')
assert(main.includes('renderWindowOverflowMenu(overflowWindows, activeWindowId)'), 'Popover must list overflow windows.')
assert(main.includes('function renderWindowOverflowMenu(openWindowItems, activeWindowId)'))
assert(main.includes('window-overflow-title'), 'Overflow item must include title span.')
assert(main.includes('window-overflow-state'), 'Overflow item must include state span.')
assert(main.includes("'Đã thu nhỏ'"), 'Overflow must label minimized windows.')
assert(main.includes("'Đang mở'"), 'Overflow must label open windows.')

assert(main.includes('function focusWindow(windowId)'), 'Focus/restore helper must exist.')
assert(main.includes('minimized: false, zIndex: nextZIndex'), 'focusWindow must restore minimized windows and bring to front.')
assert(main.includes('function minimizeWindow(windowId)'), 'Minimize helper must remain.')
assert(main.includes('minimized: true'), 'Minimize state must remain.')
assert(main.includes('document.querySelectorAll(\'[data-taskbar-window-id]\')'), 'Taskbar/overflow item click binding must exist.')
assert(main.includes('focusWindow(button.dataset.taskbarWindowId)'), 'Clicking overflow item must focus/restore window.')
assert(main.includes('isWindowOverflowOpen = false'), 'Overflow must close after module/window actions.')

assert(main.includes('function bindWindowOverflowOutsidePointer()'), 'Window overflow outside-click helper must exist.')
assert(main.includes('windowOverflowOutsidePointerBound'), 'Outside-click helper must be bound once.')
assert(main.includes("target.closest?.('.window-overflow-menu')"), 'Outside click must ignore popover.')
assert(main.includes("target.closest?.('[data-action=\"toggle-window-overflow\"]')"), 'Outside click must ignore overflow button.')
assert(main.includes('bindWindowOverflowOutsidePointer()'), 'Overflow outside-click binding must be installed.')

assert(main.includes('function bindStartMenuOutsidePointer()'), 'Start menu outside-click helper must remain.')
assert(main.includes("target.closest?.('.start-menu')"), 'Start menu outside-click guard must remain.')
assert(main.includes('bindNotificationOutsidePointer()'), 'Notification outside-click binding must remain.')
assert(main.includes('bindModuleNotificationOutsidePointer()'), 'Module notification outside-click binding must remain.')
assert(main.includes('openModuleWindow(button.dataset.moduleId)'), 'Opening a module must still use openModuleWindow.')

assert(styles.includes('.window-overflow-menu'), 'Overflow popover styles must exist.')
assert(styles.includes('.taskbar-overflow'), 'Overflow button styles must exist.')
assert(styles.includes('.window-overflow-title'), 'Overflow title style must exist.')
assert(styles.includes('.window-overflow-state'), 'Overflow state style must exist.')
assert(styles.includes('.window-overflow-menu button.minimized'), 'Minimized item style must remain.')
assert(styles.includes('background: rgba(15, 20, 27, 0.98)'), 'Popover should stay dark.')

const runtimeSources = [main, styles, appAuth].join('\n')
assert(!runtimeSources.includes('localStorage.clear('), 'C4.5.1 must not hard reset localStorage.')
assert(!runtimeSources.includes('seedCloud29'), 'C4.5.1 must not seed cloud.')
assert(!runtimeSources.includes('CREATE POLICY'), 'C4.5.1 runtime must not include SQL.')
assert(!runtimeSources.includes('CREATE TABLE'), 'C4.5.1 runtime must not include SQL.')
assert(!runtimeSources.includes('C4.6A_APPLY'), 'C4.5.1 must not do C4.6/C4.7 early.')
assert(!appAuth.includes('Đăng ký'), 'No signup action in app auth.')
assert(!/signUp\s*\(/.test(runtimeSources), 'C4.5.1 runtime must not call signUp.')
assert(!/auth\.signUp\s*\(/.test(runtimeSources), 'C4.5.1 runtime must not call supabase.auth.signUp.')

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
  assert(main.includes(expectedNewRuntimeText), `main.js missing clean C4.5.1 text: ${expectedNewRuntimeText}`)
}

console.log('C4.5.1 taskbar overflow minimized modules smoke passed')
