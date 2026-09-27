import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const folder = 'artifacts/tuition-receipt-a5-runtime'
const files = ['src/tuition-receipt-pdf.js', 'src/tuition-receipt-a5-layout.js', 'src/main.js',
  'tests/tuition-definitive-receipt-pdf.js', 'public/forms/tuition-receipt/README.md',
  'docs/business-reference/tuition-receipt/golden-a5/README.md', `${folder}/README.md`,
  ...fs.readdirSync('tests').filter(file => file.startsWith('tuition-receipt-a5-') && file.endsWith('.js')).map(file => `tests/${file}`)]
const suspect = /\ufffd|\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2\u20ac|\u00c4\u2018|\u00c6\u00b0/
for (const file of files) assert(!suspect.test(fs.readFileSync(file, 'utf8')), `Mojibake in ${file}`)
const diff = spawnSync('git', ['diff', '--check'], { encoding: 'utf8', windowsHide: true })
assert.equal(diff.status, 0, diff.stdout)
const staged = spawnSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8', windowsHide: true })
assert.equal(staged.status, 0)
assert.equal(staged.stdout.trim(), '', 'No staging authorized')
fs.writeFileSync(`${folder}/delivery-check.json`, JSON.stringify({ passed: true, mojibake: 'PASS', scannedFiles: files,
  diffCheck: 'PASS', stagedFiles: [], noCommitPushDeploy: true }, null, 2))
console.log(`RECEIPT DELIVERY: PASS (${files.length} text files clean, git diff --check, no staged files)`)
