import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const docPath = 'docs/supabase-c4-6b-manual-sql-apply-pack.md'
const sqlPath = 'docs/supabase-c4-6b-final-apply.sql'
const smokePath = 'tests/c4-6b-manual-sql-apply-pack-smoke.js'

for (const filePath of [docPath, sqlPath, smokePath]) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C4.6B artifact: ${filePath}`)
}

const doc = read(docPath)
const sql = read(sqlPath)
const smoke = read(smokePath)
const combined = [doc, sql].join('\n')

for (const term of [
  'SQL READY FOR MANUAL APPLY: YES',
  'SQL APPLIED BY USER: NO',
  'WAITING USER TO RUN SQL IN SUPABASE SQL EDITOR',
  'LIVE QA T/P: NOT RUN',
  'Project: ichess-center-os',
  'Ref: zahcfnpaprbnuqpegdmo',
  'center_cloud_entities',
  '39 rows',
  'student',
  'teacher',
  'class_session',
  'schedule_session',
  'center_members',
  '3 rows',
  'owner',
  'admin',
  'STEP 1: READ-ONLY PREFLIGHT',
  'STEP 2: MEMBERSHIP READINESS',
  'STEP 3: ENTITY ALLOWLIST',
  'STEP 4: RLS POLICIES',
  'STEP 5: REALTIME PUBLICATION',
  'STEP 6: POST-APPLY VERIFY',
  'Rollback / Recovery Notes',
]) {
  assert(combined.includes(term), `C4.6B apply pack missing term: ${term}`)
}

assert(sql.includes('-- C4.6B MANUAL APPLY ONLY'), 'SQL file must have manual apply header.')
assert(sql.includes('-- SQL APPLIED BY USER: NO at file creation time.'), 'SQL file must not claim applied.')
assert(sql.includes('-- Data-destructive operations: NO.'), 'SQL file must mark no destructive data ops.')
assert(sql.includes('Supabase Dashboard SQL Editor'), 'SQL file must point to SQL Editor.')
assert(sql.includes('do $$'), 'SQL should guard object already exists cases.')
assert(sql.includes('alter publication supabase_realtime add table public.center_cloud_entities'), 'SQL must include realtime publication step.')
assert(sql.includes('alter table public.center_cloud_entities replica identity full'), 'SQL must include replica identity step.')
assert(sql.includes("check (entity_type in ('student', 'teacher', 'class_session', 'schedule_session'))"), 'SQL must preserve class_session and add schedule_session.')
assert(sql.includes("lower(role) in ('owner', 'qtv', 'center_admin', 'admin')"), 'SQL must support current admin role alias.')
assert(sql.includes('drop policy if exists "c4_6b'), 'SQL may only drop named C4.6B policies.')
assert(sql.includes('drop constraint if exists center_cloud_entities_entity_type_check'), 'SQL must explicitly replace allowlist constraint.')
assert(doc.includes('Drop constraint: YES'), 'Doc must disclose constraint replacement.')
assert(doc.includes('metadata-only'), 'Doc must explain constraint replacement is metadata-only.')

const destructivePatterns = [
  /\bTRUNCATE\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bDELETE\s+FROM\s+(public\.)?center_cloud_entities\b/i,
  /\bDELETE\s+FROM\s+(public\.)?center_members\b/i,
  /\bINSERT\s+INTO\s+(public\.)?center_members\b/i,
  /\bUPDATE\s+(public\.)?center_members\b/i,
]

for (const pattern of destructivePatterns) {
  assert(!pattern.test(sql), `C4.6B SQL contains forbidden pattern: ${pattern}`)
}

assert(!combined.includes('SQL APPLIED BY USER: YES'), 'C4.6B must not claim SQL applied.')
assert(!combined.includes('LIVE QA T/P: PASS'), 'C4.6B must not claim C4.7 pass.')
assert(!combined.includes('Seed cloud 29: YES'), 'C4.6B must not seed cloud.')
assert(!/signUp\s*\(/.test(combined), 'C4.6B docs/sql must not call signUp.')

const runtimeSources = [
  read('src/app-auth.js'),
  read('src/main.js'),
].join('\n')

assert(!runtimeSources.includes('Đăng ký'), 'Runtime must not include signup action.')
assert(!/signUp\s*\(/.test(runtimeSources), 'Runtime must not call signUp.')
assert(!/auth\.signUp\s*\(/.test(runtimeSources), 'Runtime must not call supabase.auth.signUp.')

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
  [sqlPath, sql],
  [smokePath, smoke],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${label} contains mojibake pattern`)
  }
}

console.log('C4.6B manual SQL apply pack smoke passed')
