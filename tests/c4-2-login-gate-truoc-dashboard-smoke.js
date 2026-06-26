import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { isDashboardUnlockedByAuth, isDashboardUnlockedByCenter } from '../src/app-login-gate.js'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const docPath = 'docs/login-gate-c4-2-truoc-dashboard.md'
const gatePath = 'src/app-login-gate.js'
const appAuthPath = 'src/app-auth.js'
const mainPath = 'src/main.js'
const stylesPath = 'src/styles.css'
const smokePath = 'tests/c4-2-login-gate-truoc-dashboard-smoke.js'

for (const filePath of [docPath, gatePath, smokePath]) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C4.2 artifact: ${filePath}`)
}

const doc = read(docPath)
const gate = read(gatePath)
const appAuth = read(appAuthPath)
const main = read(mainPath)
const styles = read(stylesPath)
const smoke = read(smokePath)

for (const term of [
  'C4.2 gắn login gate trước dashboard',
  'Khi chưa đăng nhập, app chỉ thấy Login Portal/app auth screen',
  'Khi đã đăng nhập hợp lệ, app mở dashboard 13 module như trước',
  'không có Đăng ký',
  'không center binding runtime',
  'không cloud bootstrap',
  'C4.1 đã tách auth khỏi Thu Chi nhưng dashboard vẫn mở khi chưa đăng nhập',
  'C4.2 ẩn dashboard cho tới khi auth session hợp lệ',
  'auth loading',
  'signed out',
  'signed in',
  'auth unavailable',
  'center binding',
  'cloud bootstrap',
  'SQL apply',
  'seed 29',
  'xóa seed 8',
  'Teacher Portal',
  'Super Admin',
  'C4.3 - Center binding: tài khoản admin một center vào thẳng dashboard',
]) {
  assert(doc.includes(term), `C4.2 doc missing term: ${term}`)
}

assert.equal(isDashboardUnlockedByAuth({ authStatus: 'signed-out', user: null }), false)
assert.equal(isDashboardUnlockedByAuth({ authStatus: 'loading', user: null }), false)
assert.equal(isDashboardUnlockedByAuth({ authStatus: 'signed-in', user: null }), false)
assert.equal(isDashboardUnlockedByAuth({ authStatus: 'signed-in', user: { id: 'user-1' } }), true)
assert.equal(
  isDashboardUnlockedByCenter(
    { authStatus: 'signed-in', user: { id: 'user-1' } },
    { status: 'bound', currentCenterId: 'dreamhome' },
  ),
  true,
)

assert(main.includes("import { isDashboardUnlockedByCenter } from './app-login-gate.js'"))
assert(main.includes('const isLoginGateOpen = !isDashboardUnlockedByCenter(cloudStatus, currentCenterBinding)'))
assert(main.includes("app-shell ${isLoginGateOpen ? 'is-login-gated' : ''}"))
assert(main.includes("desktop-area ${isLoginGateOpen ? 'is-login-gated' : ''}"))
assert(main.includes("isLoginGateOpen ? '' : renderDashboard()"), 'Signed-out branch must hide dashboard.')
assert(main.includes("isLoginGateOpen ? '' : renderOpenWindows()"), 'Signed-out branch must hide module windows.')
assert(main.includes("${isLoginGateOpen ? '' : renderTaskbar()}"), 'Signed-out branch must hide taskbar.')
assert(main.includes("${isLoginGateOpen ? '' : renderSystemOverlay()}"), 'Signed-out branch must hide system overlay.')
assert(styles.includes('.desktop-area.is-login-gated'), 'C4.2 must style the login-gated screen.')

assert(!gate.includes('membershipStatus'), 'C4.2 gate must not depend on center membership.')
assert(!gate.includes('center_members'), 'C4.2 gate must not query center binding.')
assert(!gate.includes('role'), 'C4.2 gate must not require role.')

const runtimeSources = [gate, appAuth, main].join('\n')
assert(!/signUp\s*\(/.test(runtimeSources), 'C4.2 runtime must not call signUp.')
assert(!/auth\.signUp\s*\(/.test(runtimeSources), 'C4.2 runtime must not call supabase.auth.signUp.')
assert(!appAuth.includes('Đăng ký'), 'Login Portal must not include signup action.')
assert(!appAuth.includes('Tạo tài khoản'), 'Login Portal must not include create-account action.')
assert(!appAuth.includes('Tạo cơ sở mới'), 'Login Portal must not include create-center action.')
assert(!/password\s*[:=]\s*['"][^'"]+['"]/.test(runtimeSources), 'C4.2 must not hardcode password.')
assert(!main.includes('seedCloud29'), 'C4.2 must not seed 29.')
assert(!main.includes('deleteSeed8'), 'C4.2 must not delete seed 8.')

const mojibakePatterns = [
  [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x0192],
  [0x0102, 0x2020, 0x00c2, 0x00b0],
  [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x00a1, 0x00c2, 0x00bb, 0xfffd],
].map((codes) => String.fromCodePoint(...codes))

for (const [label, source] of [
  [docPath, doc],
  [gatePath, gate],
  [smokePath, smoke],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${label} contains mojibake pattern`)
  }
}

console.log('C4.2 login gate truoc dashboard smoke passed')
