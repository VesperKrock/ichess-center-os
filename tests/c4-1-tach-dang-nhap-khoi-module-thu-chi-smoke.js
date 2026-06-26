import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const docPath = 'docs/login-portal-c4-1-tach-khoi-thu-chi.md'
const appAuthPath = 'src/app-auth.js'
const mainPath = 'src/main.js'
const cashflowPath = 'src/cashflow-module.js'
const stylesPath = 'src/styles.css'
const smokePath = 'tests/c4-1-tach-dang-nhap-khoi-module-thu-chi-smoke.js'

for (const filePath of [docPath, appAuthPath, smokePath]) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C4.1 artifact: ${filePath}`)
}

const doc = read(docPath)
const appAuth = read(appAuthPath)
const main = read(mainPath)
const cashflow = read(cashflowPath)
const styles = read(stylesPath)
const smoke = read(smokePath)

for (const term of [
  'C4.1 tách đăng nhập Supabase/Cloud khỏi Module Thu Chi',
  'Auth chuyển lên tầng app/system',
  'không có đăng ký',
  'Tài khoản vẫn được tạo thủ công trong Supabase/Admin tools',
  'C4.1 chưa gate dashboard',
  'C4.2 mới làm Login Portal gate',
  'Đăng nhập Supabase/Cloud nằm trong Module Thu Chi',
  'Đăng nhập nằm ở tầng app/system',
  'Module Thu Chi chỉ dùng auth state nếu cần cloud',
  'Dashboard vẫn mở như cũ trong C4.1',
  'Không gọi `signUp`',
  'Không hardcode tài khoản/mật khẩu',
  'Không đổi nghiệp vụ Thu Chi',
  'Vui lòng đăng nhập ở cổng hệ thống để dùng tính năng cloud',
  'C4.2 - Login gate: chưa đăng nhập chỉ thấy Login Portal',
]) {
  assert(doc.includes(term), `C4.1 doc missing term: ${term}`)
}

assert(main.includes("import { renderAppAuthEntry } from './app-auth.js'"))
assert(main.includes('renderAppAuthEntry(cloudStatus'), 'main must render app-level auth entry.')
assert(main.includes('renderCashflowCloudAuthNotice(cloudStatus)'), 'Thu Chi must receive a light auth notice.')
assert(!main.includes('renderCloudStatus(cloudStatus)'), 'Thu Chi must not render full cloud login status panel.')

assert(appAuth.includes('Đăng nhập hệ thống'), 'App auth entry must be system-level.')
assert(appAuth.includes('Email / Tài khoản'))
assert(appAuth.includes('Mật khẩu'))
assert(appAuth.includes('Đăng nhập'))
assert(appAuth.includes('Đăng xuất'))
assert(appAuth.includes('Đã đăng nhập'))
assert(appAuth.includes('Chưa đăng nhập'))
assert(appAuth.includes('data-cloud-login-form'), 'Existing sign-in handler should bind to app-level form.')
assert(appAuth.includes('data-cloud-action="logout"'), 'Existing sign-out handler should bind to app-level action.')

assert(main.includes('signInWithEmailPassword(email, password)'), 'C4.1 must keep signIn.')
assert(main.includes('signOutSupabase()'), 'C4.1 must keep signOut.')

const changedRuntimeSources = [appAuth, main].join('\n')
assert(!/signUp\s*\(/.test(changedRuntimeSources), 'C4.1 runtime must not call signUp.')
assert(!/auth\.signUp\s*\(/.test(changedRuntimeSources), 'C4.1 runtime must not call supabase.auth.signUp.')
assert(!appAuth.includes('Đăng ký'), 'App auth entry must not include signup action.')
assert(!appAuth.includes('Tạo tài khoản'), 'App auth entry must not include create-account action.')
assert(!appAuth.includes('Tạo cơ sở mới'), 'App auth entry must not include create-center action.')
assert(!/password\s*[:=]\s*['"][^'"]+['"]/.test(appAuth), 'App auth must not hardcode password.')

assert(cashflow.includes('cloudStatusHtml = \'\''), 'Cashflow module should keep optional cloud status slot only.')
assert(main.includes('cashflow-cloud-auth-note'), 'Thu Chi should show a light cloud auth note.')
assert(main.includes('data-cloud-action="open-gallery"'), 'Thu Chi should keep cloud gallery access after auth.')
assert(styles.includes('.app-auth-entry'), 'C4.1 must style app-level auth entry.')

assert(!main.includes('renderLoginPortalGate'), 'C4.1 must not add dashboard login gate.')
assert(!main.includes('hideDashboardUntilLogin'), 'C4.1 must not hide dashboard before C4.2.')
assert(main.includes('renderDashboard()'), 'Dashboard render path must still exist after C4.1/C4.2.')
assert(!main.includes('seedCloud29'), 'C4.1 must not seed 29.')
assert(!main.includes('deleteSeed8'), 'C4.1 must not delete seed 8.')

const mojibakePatterns = [
  [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x0192],
  [0x0102, 0x2020, 0x00c2, 0x00b0],
  [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x00a1, 0x00c2, 0x00bb, 0xfffd],
].map((codes) => String.fromCodePoint(...codes))

for (const [label, source] of [
  [docPath, doc],
  [appAuthPath, appAuth],
  [smokePath, smoke],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${label} contains mojibake pattern`)
  }
}

console.log('C4.1 tach dang nhap khoi Module Thu Chi smoke passed')
