import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
const folder = 'artifacts/tuition-receipt-a5-runtime'
const baseline = JSON.parse(fs.readFileSync(`${folder}/source-boundary-before.json`))
const hash = data => createHash('sha256').update(data).digest('hex')
const currentMain = fs.readFileSync('src/main.js', 'utf8')
const previousAlert = "    window.alert('Không thể mở Phiếu Thu. Vui lòng làm mới và thử lại.')"
const updatedAlert = "    window.alert(error?.name === 'TuitionReceiptPdfValidationError'\n      ? error.message\n      : 'Không thể mở Phiếu Thu. Vui lòng làm mới và thử lại.')"
// The audit itself never edits application source.
const newline = currentMain.includes('\r\n') ? '\r\n' : '\n'
const originalMain = currentMain.replace(updatedAlert.replace(/\n/g, newline), previousAlert)
assert.notEqual(originalMain, currentMain, 'The only main.js edit is the Receipt validation alert')
const evidence = { changedOutsideReceiptPresentation: [], verified: [] }
for (const [file, expected] of Object.entries(baseline)) {
  const bytes = file === 'src/main.js' ? originalMain : fs.readFileSync(file)
  assert.equal(hash(bytes), expected, `${file} changed outside Receipt presentation`)
  evidence.verified.push(file)
}
evidence.mainJsChange = 'Receipt PDF validation error alert only; all other bytes preserved'
evidence.passed = true
fs.writeFileSync(`${folder}/source-boundary-after.json`, JSON.stringify(evidence, null, 2))
console.log(`RECEIPT SOURCE BOUNDARY: PASS (${evidence.verified.length} protected files, Receipt alert only in main.js)`)
