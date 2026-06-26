import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const preflightPath = 'docs/supabase-c4-6a-sql-realtime-preflight.md'
const checklistPath = 'docs/supabase-c4-6a-final-apply-checklist.md'
const smokePath = 'tests/c4-6a-sql-realtime-preflight-smoke.js'

for (const filePath of [preflightPath, checklistPath, smokePath]) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C4.6A artifact: ${filePath}`)
}

const preflight = read(preflightPath)
const checklist = read(checklistPath)
const smoke = read(smokePath)
const combinedDocs = [preflight, checklist].join('\n')

for (const term of [
  'C4.6A la preflight',
  'SQL APPLIED: NO',
  'WAITING USER CONFIRMATION BEFORE APPLYING SQL',
  'LIVE QA T/P: NOT RUN',
  'Backup recommended: YES',
  'Destructive data operation: NO',
  'Backend Readiness Matrix',
  'SQL Purpose',
  'SQL Environment',
  'Apply Order For C4.6B',
  'Verification Checklist And Queries',
  'Rollback / Recovery Notes',
  'C4.6B Handoff',
  'C4.7 Handoff',
  'NEEDS SUPABASE PROJECT CONFIRMATION',
]) {
  assert(combinedDocs.includes(term), `C4.6A docs missing term: ${term}`)
}

for (const term of [
  'center_members',
  'center_cloud_entities',
  'student',
  'teacher',
  'schedule_session',
  'RLS',
  'Realtime publication',
  'supabase_realtime',
  'replica identity',
  'cross-center isolation',
]) {
  assert(combinedDocs.includes(term), `C4.6A docs missing backend term: ${term}`)
}

for (const step of [
  'Step 0 - Backup / project confirmation',
  'Step 1 - Preflight read-only verification',
  'Step 2 - Membership table / center binding readiness',
  'Step 3 - RLS/policies',
  'Step 4 - Entity allowlist for `student`, `teacher`, `schedule_session`',
  'Step 5 - Realtime publication / replica identity',
  'Step 6 - Post-apply verification',
  'Step 7 - App smoke/manual test',
]) {
  assert(combinedDocs.includes(step), `C4.6A docs missing apply step: ${step}`)
}

for (const queryTerm of [
  'information_schema.tables',
  'information_schema.columns',
  'pg_policies',
  'pg_constraint',
  'pg_publication_tables',
  'pg_class',
  'relreplident',
]) {
  assert(preflight.includes(queryTerm), `C4.6A preflight missing verify query term: ${queryTerm}`)
}

assert(!preflight.includes('SQL APPLIED: YES'), 'C4.6A must not claim SQL applied.')
assert(!checklist.includes('SQL APPLIED: YES'), 'C4.6A checklist must not claim SQL applied.')
assert(!combinedDocs.includes('LIVE QA T/P: PASS'), 'C4.6A must not claim live QA pass.')
assert(!combinedDocs.includes('Seed cloud 29: YES'), 'C4.6A must not seed cloud 29.')
assert(!combinedDocs.includes('Đăng ký action: YES'), 'C4.6A must not add signup action.')
assert(!/signUp\s*\(/.test(combinedDocs), 'C4.6A docs must not call signUp.')

const runtimeSources = [
  read('src/app-auth.js'),
  read('src/main.js'),
  read('src/cloud-bootstrap.js'),
].join('\n')

assert(!runtimeSources.includes('Đăng ký'), 'Runtime must not include signup action.')
assert(!/signUp\s*\(/.test(runtimeSources), 'Runtime must not call signUp.')
assert(!/auth\.signUp\s*\(/.test(runtimeSources), 'Runtime must not call supabase.auth.signUp.')

const sqlReviewPath = 'docs/supabase-c4-6a-final-sql-review.sql'
if (fs.existsSync(path.join(repoRoot, sqlReviewPath))) {
  const sqlReview = read(sqlReviewPath)
  assert(sqlReview.includes('C4.6A REVIEW ONLY'), 'Optional SQL review file must be review-only.')
  assert(sqlReview.includes('DO NOT RUN UNTIL USER CONFIRMS C4.6B'), 'Optional SQL review file must forbid running now.')
  assert(sqlReview.includes('SQL APPLIED: NO'), 'Optional SQL review file must mark SQL not applied.')
}

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
  [preflightPath, preflight],
  [checklistPath, checklist],
  [smokePath, smoke],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${label} contains mojibake pattern`)
  }
}

console.log('C4.6A SQL realtime preflight smoke passed')
