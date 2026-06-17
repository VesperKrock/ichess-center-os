import assert from 'node:assert/strict'
import fs from 'node:fs'

const files = [
  'src/settings-module.js',
  'src/main.js',
  'src/cloud-db-entities.js',
  'src/cloud-db-sync.js',
  'docs/supabase-c1-cloud-db-foundation.md',
  'tests/c1-cloud-db-foundation-smoke.js',
]

const mojibakePattern = /Ăƒ|Ă„|Ă¡Âº|Ă¡Â»|Ă‚|Ă†|Ă|ï¿½|hĂ¡|cĂ†|trĂ¡|ghi chĂ|Ã|Â|â€/u

for (const file of files) {
  const content = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  assert(!mojibakePattern.test(content), `${file} still contains mojibake`)
}

const settingsContent = fs.readFileSync(new URL('../src/settings-module.js', import.meta.url), 'utf8')

for (const expectedText of [
  'Cài đặt cơ sở',
  'Ca học / Lớp',
  'Trạng thái',
  'Ghi chú',
  'Thao tác',
  'Thêm ca học',
  'C2 đọc/ghi cloud cho 3 nhóm dữ liệu lõi',
  'Làm mới số liệu',
  'Đẩy local lên cloud',
  'Tải cloud về local',
]) {
  assert(settingsContent.includes(expectedText), `Missing clean UTF-8 text: ${expectedText}`)
}

console.log('C1.1 UTF-8 mojibake smoke passed')
