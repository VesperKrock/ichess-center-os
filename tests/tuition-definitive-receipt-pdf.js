import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'
import { parseTuitionOperatorSnapshot } from '../src/cloud-tuition-operator.js'
import { TUITION_RECEIPT_TEMPLATE_PATH, TUITION_RECEIPT_TEMPLATE_SHA256, createTuitionReceiptPdfProjection } from '../src/tuition-receipt-pdf.js'
import { TUITION_RECEIPT_A5_PAGE } from '../src/tuition-receipt-a5-layout.js'

// Current proof comes from actual normal authenticated remote UI exports,
// including opening each existing Receipt twice. No old template artifacts.
const folder = 'artifacts/tuition-receipt-a5-runtime'
const report = JSON.parse(fs.readFileSync(folder + '/real-app-qa.json'))
assert(report.passed && report.businessMutationRequests === 0)
assert.deepEqual(report.consoleErrors, [])
assert.deepEqual(report.runtimeExceptions, [])
assert.deepEqual(report.failedTuitionReads, [])
const reads = report.requests.filter(r => r.method === 'POST' && r.url.endsWith('/rpc/tuition_operator_read') && r.body?.center_id === 'phongtrong_prod')
assert(reads.length >= 2)
for (const field of ['cycle_state', 'receipt_state']) assert.deepEqual(reads.at(-1).body[field], reads[0].body[field])
const data = parseTuitionOperatorSnapshot(reads.at(-1).body, 'phongtrong_prod')
assert(data.ok)
assert.equal(data.receipts.length, 2)
const template = fs.readFileSync('public/' + TUITION_RECEIPT_TEMPLATE_PATH)
assert.equal(createHash('sha256').update(template).digest('hex'), TUITION_RECEIPT_TEMPLATE_SHA256)
const pdfjsPath = process.env.RECEIPT_PDFJS_PATH || path.join(os.tmpdir(), 'ichess-tuition-pdf-render-270927/node_modules/pdfjs-dist/legacy/build/pdf.mjs')
const pdfjs = await import(pathToFileURL(pdfjsPath))
for (const key of ['c', 'e']) {
  const r = data.receipts.find(r => r.studentId === 'tuition-demo-20260927-' + key)
  const p = createTuitionReceiptPdfProjection(r)
  assert.equal(p.receiptNumber, key === 'c' ? 'PT-270926-001' : 'PT-270926-002')
  assert.equal(p.classification, key === 'c' ? 'Đăng ký mới' : 'Tái đăng ký')
  assert.equal(p.paymentMethod, 'Tiền mặt') // Real historical fact, not golden sample transfer.
  assert.equal(p.collectorName, 'Admin DEMO')
  assert.equal(p.amountReceived, '1.600.000 VNĐ')
  assert.equal(p.centerAddressLine, '')
  assert.equal(p.centerPhoneLine, '')
  assert.throws(() => createTuitionReceiptPdfProjection({ ...r, status: 'WAITING_PAYMENT' }))
  assert.throws(() => createTuitionReceiptPdfProjection({ ...r, payments: [] }))
  assert.throws(() => createTuitionReceiptPdfProjection({ ...r, financeTransactionId: crypto.randomUUID() }))
  for (const action of ['open', 'reprint']) {
    const bytes = fs.readFileSync(folder + '/real-app-' + key + '-receipt-' + action + '.pdf')
    const pdf = await PDFDocument.load(bytes)
    assert.equal(pdf.getPageCount(), 1)
    assert.deepEqual(pdf.getPage(0).getSize(), TUITION_RECEIPT_A5_PAGE)
    const document = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise
    const page = await document.getPage(1)
    const text = (await page.getTextContent()).items.map(item => item.str).join('\n')
    for (const value of [p.receiptNumber, p.centerName, p.payerName, p.studentName, p.collectorName,
      p.classification, p.termDisplay, p.packageDisplay, p.paymentDate, p.amountReceived, p.amountInWords, p.paymentMethod]) assert(text.includes(value), 'Missing snapshot fact: ' + value)
    assert(!/Hotline:|BẢN GIẢ LẬP|KHÔNG SỬ DỤNG|Còn lại:|Kỳ tiếp|Hiệu lực từ/.test(text))
    assert(!text.includes(r.id))
  }
  assert(fs.readFileSync(folder + '/real-app-' + key + '-receipt-open.png').equals(fs.readFileSync(folder + '/real-app-' + key + '-receipt-reprint.png')))
}
for (const key of ['a', 'b', 'd']) assert(!data.receipts.some(r => r.studentId === 'tuition-demo-20260927-' + key), 'Paid-before-iChess must have no fake Receipt')
assert.deepEqual(JSON.parse(fs.readFileSync(folder + '/remote-after.json')), JSON.parse(fs.readFileSync(folder + '/remote-before.json')))
console.log('F5B RECEIPT PDF: PASS (real remote A5 open/reprint, searchable frozen facts, unchanged Finance/Payment/Receipt data)')
