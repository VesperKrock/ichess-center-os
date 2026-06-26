import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  getDefaultAppCenter,
  isCenterBindingReady,
  resolveAppCenterBinding,
} from '../src/app-center-binding.js'
import { isDashboardUnlockedByCenter } from '../src/app-login-gate.js'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const docPath = 'docs/center-binding-c4-3-mvp.md'
const bindingPath = 'src/app-center-binding.js'
const gatePath = 'src/app-login-gate.js'
const appAuthPath = 'src/app-auth.js'
const mainPath = 'src/main.js'
const stylesPath = 'src/styles.css'
const smokePath = 'tests/c4-3-center-binding-mvp-smoke.js'

for (const filePath of [docPath, bindingPath, smokePath]) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C4.3 artifact: ${filePath}`)
}

const doc = read(docPath)
const binding = read(bindingPath)
const gate = read(gatePath)
const appAuth = read(appAuthPath)
const main = read(mainPath)
const styles = read(stylesPath)
const smoke = read(smokePath)

for (const term of [
  'C4.3 thêm center binding MVP',
  'Signed-in user được gắn vào center/app mặc định hiện tại',
  'Chưa làm center selector',
  'Chưa làm role matrix chi tiết',
  'Chưa cloud bootstrap',
  'account/session -> center binding -> currentCenterId',
  'signed-in account -> default app center',
  'center_members/Admin tools/Super Admin sẽ quản lý binding thật',
  'MEMBERSHIP SQL APPLIED: NO',
  'CENTER BINDING MVP FALLBACK: YES',
  'PRODUCTION MULTI-CENTER BINDING: NOT YET',
  'dreamhome',
  'signed-out',
  'signed-in + bound',
  'signed-in + binding error',
  'auth unavailable',
  'cloud bootstrap',
  'shared staging dataset 29',
  'xóa seed 8',
  'SQL apply',
  'Teacher Portal',
  'Super Admin',
  'login box nền tối',
  'chữ sáng',
  'input dễ đọc',
  'không box sáng/chói',
  'C4.4 - Shared staging dataset: bỏ seed 8 khỏi default online path, dùng gói 29 để T/P test',
]) {
  assert(doc.includes(term), `C4.3 doc missing term: ${term}`)
}

const defaultCenter = getDefaultAppCenter()
assert.equal(defaultCenter.id, 'dreamhome')
assert.equal(defaultCenter.name, 'DreamHome')

const signedOutBinding = resolveAppCenterBinding({ authStatus: 'signed-out', user: null })
assert.equal(isCenterBindingReady(signedOutBinding), false)

const signedInBinding = resolveAppCenterBinding({
  authStatus: 'signed-in',
  user: { id: 'user-1', email: 'admin@example.test' },
})
assert.equal(signedInBinding.status, 'bound')
assert.equal(signedInBinding.currentCenterId, 'dreamhome')
assert.equal(signedInBinding.source, 'single-center-fallback')
assert.equal(isCenterBindingReady(signedInBinding), true)
assert.equal(
  isDashboardUnlockedByCenter({ authStatus: 'signed-in', user: { id: 'user-1' } }, signedInBinding),
  true,
)
assert.equal(
  isDashboardUnlockedByCenter({ authStatus: 'signed-out', user: null }, signedInBinding),
  false,
)

assert(binding.includes("import { CURRENT_CENTER_ID } from './supabase-auth.js'"))
assert(binding.includes('single-center-fallback'))
assert(!binding.includes('centerOptions'), 'C4.3 must not create fake center options.')
assert(!binding.includes('centerSelector'), 'C4.3 must not add center selector.')

assert(gate.includes('isDashboardUnlockedByCenter'))
assert(main.includes('resolveAppCenterBinding(cloudStatus)'))
assert(main.includes('isDashboardUnlockedByCenter(cloudStatus, currentCenterBinding)'))
assert(main.includes('renderAppAuthEntry(cloudStatus, currentCenterBinding)'))
assert(appAuth.includes('centerBinding'))
assert(appAuth.includes('Cơ sở:'))

assert(!appAuth.includes('Đăng ký'), 'Login box must not include signup action.')
assert(!appAuth.includes('Tạo tài khoản'), 'Login box must not include create-account action.')
assert(!appAuth.includes('Tạo cơ sở mới'), 'Login box must not include create-center action.')

const runtimeSources = [binding, gate, appAuth, main].join('\n')
assert(!/signUp\s*\(/.test(runtimeSources), 'C4.3 runtime must not call signUp.')
assert(!/auth\.signUp\s*\(/.test(runtimeSources), 'C4.3 runtime must not call supabase.auth.signUp.')
assert(!/password\s*[:=]\s*['"][^'"]+['"]/.test(runtimeSources), 'C4.3 must not hardcode password.')
assert(!main.includes('seedCloud29'), 'C4.3 must not seed 29.')
assert(!main.includes('deleteSeed8'), 'C4.3 must not delete seed 8.')

assert(styles.includes('background: rgba(15, 23, 42, 0.96)'), 'Login box must use dark background.')
assert(styles.includes('color: #f8fafc'), 'Login box must use bright text.')
assert(styles.includes('background: #020617'), 'Login inputs must use dark readable background.')
assert(styles.includes('border-color: #93c5fd'), 'Login inputs must have readable focus outline.')
assert(!styles.includes('background: rgba(255, 255, 255, 0.94)'), 'Login box must not stay bright.')

const mojibakePatterns = [
  [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x0192],
  [0x0102, 0x2020, 0x00c2, 0x00b0],
  [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x00a1, 0x00c2, 0x00bb, 0xfffd],
].map((codes) => String.fromCodePoint(...codes))

for (const [label, source] of [
  [docPath, doc],
  [bindingPath, binding],
  [smokePath, smoke],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${label} contains mojibake pattern`)
  }
}

console.log('C4.3 center binding MVP smoke passed')
