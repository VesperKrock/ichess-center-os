import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const docPath = path.join(repoRoot, 'docs', 'login-portal-shared-cloud-source-c4-0.md')
const smokePath = path.join(repoRoot, 'tests', 'c4-0-login-portal-shared-cloud-source-smoke.js')

assert(fs.existsSync(docPath), 'C4.0 design doc must exist.')
assert(fs.existsSync(smokePath), 'C4.0 smoke test must exist.')

const doc = fs.readFileSync(docPath, 'utf8')
const smoke = fs.readFileSync(smokePath, 'utf8')

const requiredDocTerms = [
  'C4.0 chỉ chốt thiết kế',
  'Trước đăng nhập, người dùng chỉ thấy Login Portal',
  'Sau đăng nhập hợp lệ và có center binding, app mở dashboard 13 module',
  'App không có đăng ký trong app',
  'Tài khoản do admin/dev tạo thủ công trong Supabase/Admin tools',
  'MVP chỉ cần cổng mở/đóng',
  'cloud là source of truth',
  'localStorage chỉ là cache/fallback',
  'Email / Tài khoản',
  'Mật khẩu',
  'Đăng nhập',
  'Portal không hiển thị các hành động tự tạo tài khoản',
  'Không hardcode email/password trong code',
  'Không fake membership',
  'One-center admin MVP',
  'vào dashboard 13 module',
  'account -> center_members/binding -> centerId',
  'Online mode dùng cloud làm nguồn dữ liệu chính',
  'không được im lặng quay về seed cũ',
  'Seed/local cũ 8 học viên không còn là default online path',
  'Gói 29 học viên là shared staging dataset',
  'Không xóa seed 8 trong C4.0',
  'Không seed cloud 29 trong C4.0',
  'một Supabase project',
  'Nhiều center được phân tách bằng `centerId`',
  'Teacher Portal future wire',
  'Teacher account có display name',
  'C4.1 - Tách đăng nhập khỏi Module Thu Chi',
  'C4.2 - Login gate: chưa đăng nhập chỉ thấy Login Portal',
  'C4.3 - Center binding: tài khoản admin một center vào thẳng dashboard',
  'C4.4 - Shared staging dataset: bỏ seed 8 khỏi default online path, dùng gói 29 để T/P test',
  'C4.5 - Cloud bootstrap: mở app là lấy student/teacher/schedule từ cloud',
  'C4.6 - Apply SQL membership/realtime theo runbook, có xác nhận',
  'C4.7 - Live QA: T/P hai tab/hai máy cùng sửa dữ liệu',
  'C4.8 - No-push checkpoint review',
  'Không runtime login portal',
  'Không SQL',
  'Không data change',
  'Không Teacher Portal',
  'Không Super Admin',
  'Không push',
]

for (const term of requiredDocTerms) {
  assert(doc.includes(term), `C4.0 design doc missing term: ${term}`)
}

const forbiddenClaims = [
  /runtime login portal (đã|da|has been|was) (triển khai|trien khai|implemented)/i,
  /SQL (đã|da|has been|was) (apply|applied|chạy|chay)/i,
  /T\/P online live (đã|da|has) pass/i,
  /seed cloud 29 (đã|da|has been|was)/i,
  /xóa seed 8 (đã|da|has been|was)/i,
]

for (const pattern of forbiddenClaims) {
  assert(!pattern.test(doc), `C4.0 design doc contains forbidden claim: ${pattern}`)
}

const portalBlock = doc.slice(
  doc.indexOf('Màn hình Login Portal tương lai có nội dung tối thiểu:'),
  doc.indexOf('Portal không hiển thị các hành động tự tạo tài khoản'),
)

assert(portalBlock.includes('Đăng nhập'), 'Login Portal model must include sign-in action.')
assert(!portalBlock.includes('Đăng ký'), 'Login Portal model must not include signup action.')
assert(!portalBlock.includes('Tạo tài khoản'), 'Login Portal model must not include create-account action.')
assert(!portalBlock.includes('Tạo cơ sở mới'), 'Login Portal model must not include create-center action.')

const mojibakePatterns = [
  [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x0192],
  [0x0102, 0x2020, 0x00c2, 0x00b0],
  [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x00a1, 0x00c2, 0x00bb, 0xfffd],
].map((codes) => String.fromCodePoint(...codes))

for (const [label, source] of [
  ['docs/login-portal-shared-cloud-source-c4-0.md', doc],
  ['tests/c4-0-login-portal-shared-cloud-source-smoke.js', smoke],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${label} contains mojibake pattern`)
  }
}

console.log('C4.0 login portal shared cloud source smoke passed')
