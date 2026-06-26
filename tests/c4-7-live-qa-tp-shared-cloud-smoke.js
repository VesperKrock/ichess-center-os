import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const docPath = 'docs/live-qa-tp-c4-7-shared-cloud.md'
const smokePath = 'tests/c4-7-live-qa-tp-shared-cloud-smoke.js'

for (const filePath of [docPath, smokePath]) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C4.7 artifact: ${filePath}`)
}

const doc = read(docPath)
const smoke = read(smokePath)

for (const term of [
  'LIVE QA T/P: READY TO RUN',
  'LIVE QA T/P: NOT RUN YET',
  'SQL APPLIED BY USER: YES, VERIFY EXPECTED PASS',
  'ichess-center-os',
  'zahcfnpaprbnuqpegdmo',
  'center_cloud_entities total | 39',
  '`student` | 29',
  '`teacher` | 6',
  '`class_session` | 4',
  '`schedule_session` | 0',
  '`center_members` | 3',
  'owner / owner / admin',
  'Signed-out gate',
  'T/P cung cloud data',
  'Student write-through',
  'Teacher write-through',
  'Schedule_session',
  'Reload persistence',
  'Logout',
  'QA C4.7',
  'Khong quay ve seed 8',
  'C4.8 Handoff',
]) {
  assert(doc.includes(term), `C4.7 doc missing term: ${term}`)
}

for (const forbidden of [
  /\bTRUNCATE\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bDELETE\s+FROM\s+(public\.)?center_cloud_entities\b/i,
  /\bDELETE\s+FROM\s+(public\.)?center_members\b/i,
  /\bINSERT\s+INTO\s+(public\.)?center_cloud_entities\b/i,
  /\bINSERT\s+INTO\s+(public\.)?center_members\b/i,
  /seedCloud29/i,
  /SQL\s+APPLIED\s+BY\s+CODEX:\s+YES/i,
  /LIVE QA T\/P:\s+PASS/i,
]) {
  assert(!forbidden.test(doc), `C4.7 doc contains forbidden pattern: ${forbidden}`)
}

assert(!/signUp\s*\(/.test(doc), 'C4.7 doc must not call signUp.')
assert(!doc.includes('Dang ky action: YES'), 'C4.7 doc must not add signup action.')

const runtimeSources = [
  read('src/app-auth.js'),
  read('src/main.js'),
  read('src/cloud-bootstrap.js'),
  read('src/cloud-db-sync.js'),
].join('\n')

assert(!runtimeSources.includes('Đăng ký'), 'Runtime must not include signup action.')
assert(!/signUp\s*\(/.test(runtimeSources), 'Runtime must not call signUp.')
assert(!/auth\.signUp\s*\(/.test(runtimeSources), 'Runtime must not call supabase.auth.signUp.')
assert(runtimeSources.includes('Cloud chưa có dữ liệu cho center này. Đang dùng cache/staging local.'))
assert(runtimeSources.includes('Không thể tải dữ liệu cloud. Đang dùng cache cục bộ.'))

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
]) {
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${label} contains mojibake pattern`)
  }
}

console.log('C4.7 live QA T/P shared cloud smoke passed')
