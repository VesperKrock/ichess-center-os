import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { buildAngelWingsRealDataset } from '../src/attendance-board-angel-wings-data.js'
import {
  isLegacyEightStudentSeed,
  legacyEightStudentSeed,
  sampleStudents,
  shouldReplaceLegacyEightSeed,
} from '../src/student-data.js'

const repoRoot = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8')

const docPath = 'docs/shared-staging-dataset-c4-4.md'
const smokePath = 'tests/c4-4-shared-staging-dataset-29-shell-polish-smoke.js'
const studentDataPath = 'src/student-data.js'
const mainPath = 'src/main.js'
const appAuthPath = 'src/app-auth.js'

for (const filePath of [docPath, smokePath]) {
  assert(fs.existsSync(path.join(repoRoot, filePath)), `Missing C4.4 artifact: ${filePath}`)
}

const doc = read(docPath)
const smoke = read(smokePath)
const studentData = read(studentDataPath)
const main = read(mainPath)
const appAuth = read(appAuthPath)

for (const term of [
  'C4.4 thay default staging data path từ seed 8 sang gói 29',
  'C4.4 không cloud bootstrap',
  'không seed cloud',
  'không SQL',
  'localStorage vẫn là cache/fallback cho tới C4.5',
  'legacyEightStudentSeed',
  'ichessCenterOS.students.dreamhome',
  'src/attendance-board-angel-wings-data.js',
  'buildAngelWingsRealDataset().students',
  'Count: 29 học viên',
  'Không overwrite user data',
  'Không hard reset localStorage',
  'Không gọi `localStorage.clear()`',
  'Signed-in không còn render box nổi "Cổng hệ thống"',
  'Start menu có "Đăng xuất"',
  'Start menu click outside closes',
  'Start menu closes when opening module',
  'C4.5 - Cloud bootstrap: mở app là lấy student/teacher/schedule từ cloud',
]) {
  assert(doc.includes(term), `C4.4 doc missing term: ${term}`)
}

const angelWingsDataset = buildAngelWingsRealDataset()
assert.equal(angelWingsDataset.students.length, 29)
assert.equal(sampleStudents.length, 29)
assert(sampleStudents.every((student) => student.sourceTag === 'angel-wings-2026-06'))
assert.equal(legacyEightStudentSeed.length, 8)
assert.equal(isLegacyEightStudentSeed(legacyEightStudentSeed), true)
assert.equal(shouldReplaceLegacyEightSeed(legacyEightStudentSeed), true)

const editedLegacySeed = legacyEightStudentSeed.map((student, index) =>
  index === 0 ? { ...student, fullName: `${student.fullName} edited` } : student,
)
assert.equal(shouldReplaceLegacyEightSeed(editedLegacySeed), false)
assert.equal(shouldReplaceLegacyEightSeed(sampleStudents), false)

assert(studentData.includes("import { buildAngelWingsRealDataset } from './attendance-board-angel-wings-data.js'"))
assert(studentData.includes('export const legacyEightStudentSeed'))
assert(studentData.includes('export const sampleStudents = buildAngelWingsRealDataset().students'))
assert(studentData.includes('shouldReplaceLegacyEightSeed'))

assert(main.includes('shouldReplaceLegacyEightSeed(students)'))
assert(main.includes('saveStoredStudents(students)'))
assert(main.includes("isLoginGateOpen ? renderAppAuthEntry(cloudStatus, currentCenterBinding) : ''"))
assert(main.includes('data-cloud-action="logout"'), 'Start menu must include logout action.')
assert(main.includes('bindStartMenuOutsidePointer()'), 'Start menu outside-click binding must be installed.')
assert(main.includes('function bindStartMenuOutsidePointer()'), 'Start menu outside-click helper must exist.')
assert(main.includes("target.closest?.('.start-menu')"), 'Outside click must ignore clicks inside Start menu.')
assert(main.includes('openModuleWindow(button.dataset.moduleId)'), 'Module open flow must remain.')
assert(main.includes('isStartMenuOpen = false'), 'Module/open flows must close Start menu.')

assert(!main.includes('localStorage.clear('), 'C4.4 must not hard reset localStorage.')
assert(!main.includes('seedCloud29'), 'C4.4 must not seed cloud 29.')
assert(!appAuth.includes('Đăng ký'), 'No signup action in app auth.')
assert(!/signUp\s*\(/.test([main, appAuth].join('\n')), 'C4.4 runtime must not call signUp.')
assert(!/auth\.signUp\s*\(/.test([main, appAuth].join('\n')), 'C4.4 runtime must not call supabase.auth.signUp.')

const mojibakePatterns = [
  [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x0192],
  [0x0102, 0x2020, 0x00c2, 0x00b0],
  [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
  [0x0102, 0x00a1, 0x00c2, 0x00bb, 0xfffd],
].map((codes) => String.fromCodePoint(...codes))

for (const [label, source] of [
  [docPath, doc],
  [smokePath, smoke],
]) {
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${label} contains mojibake pattern`)
  }
}

console.log('C4.4 shared staging dataset 29 shell polish smoke passed')
