import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { PDFDocument, PDFName, decodePDFRawStream } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { TUITION_RECEIPT_TEMPLATE_PATH, TUITION_RECEIPT_TEMPLATE_SHA256, TUITION_RECEIPT_FONTS,
  createTuitionReceiptPdfProjection, createTuitionReceiptOverlayPlan, generateTuitionReceiptPdf } from '../src/tuition-receipt-pdf.js'
import { TUITION_RECEIPT_A5_PAGE } from '../src/tuition-receipt-a5-layout.js'

const dependencies = path.join(os.tmpdir(), 'ichess-tuition-pdf-render-270927/node_modules')
const { createCanvas } = await import(pathToFileURL(process.env.RECEIPT_CANVAS_PATH || path.join(dependencies, '@napi-rs/canvas/index.js')))
const pdfjs = await import(pathToFileURL(process.env.RECEIPT_PDFJS_PATH || path.join(dependencies, 'pdfjs-dist/legacy/build/pdf.mjs')))
const folder = 'artifacts/tuition-receipt-a5-runtime'
fs.mkdirSync(folder, { recursive: true })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const options = {
  baseUrl: '/',
  fetchImpl: async url => new Response(fs.readFileSync(`public/${String(url).replace(/^\//, '')}`)),
}

const receiptId = 'ceb904e9-4c87-4695-ad21-bcbfdc33254a'
const transactionId = '95779113-3b25-4aa4-9fe6-59145c3c05d4'
function fixture(renewal) {
  const number = renewal ? 'DH-270926-002' : 'DH-270926-001'
  const total = renewal ? 2330000 : 2580000
  const method = renewal ? 'Chuyển khoản' : 'Tiền mặt'
  return {
    id: receiptId, receiptNumber: number, financeTransactionId: transactionId, status: 'ISSUED', amountReceived: total,
    payments: [{ transactionId, status: 'posted', method }],
    snapshot: {
      receiptId, receiptNumber: number, financeTransactionId: transactionId, issuedAt: '2026-09-27T03:00:00Z', businessDate: '2026-09-27',
      center: { name: 'DreamHome', address: renewal ? '' : '12 Đường Mô Phỏng, TP. Hồ Chí Minh', phone: renewal ? '' : '0000 000 000' },
      customer: { payerName: renewal ? 'Trần Ngọc Mai' : 'Lê Hoàng An', receiptAddress: renewal ? '' : '12 Đường Mô Phỏng, TP. Hồ Chí Minh', email: renewal ? '' : 'an.mau@example.com', cccd: renewal ? '' : '000000000000' },
      student: { name: renewal ? 'Trần Gia Hân' : 'Lê Minh Khôi' },
      registration: { label: renewal ? 'Tái đăng ký' : 'Đăng ký mới' },
      tuition: { termNumber: renewal ? 2 : 1, packageName: 'Cờ vua cơ bản · 16 buổi', programName: 'Cờ vua cơ bản' },
      scheduleLines: [renewal ? 'Dolphin 2' : 'Dolphin 1'],
      payment: { transactionDate: '2026-09-27', method, collectorName: 'Nguyễn Hà Vy' },
      money: { tuitionBaseAmount: 2500000, discount: { amount: renewal ? 250000 : 0 }, materialFee: 80000,
        totalAmountDue: total, amountReceived: total, remainingAfterPayment: 0 },
    },
  }
}
const measureDocument = await PDFDocument.create()
measureDocument.registerFontkit(fontkit)
const measureFonts = Object.fromEntries(await Promise.all(Object.entries(TUITION_RECEIPT_FONTS).map(async ([style, asset]) =>
  [style, await measureDocument.embedFont(fs.readFileSync(`public/forms/tuition-receipt/fonts/${asset.file}`), { features: { kern: false, liga: false } })],
)))
const measure = (text, size, font = 'regular') => measureFonts[font].widthOfTextAtSize(text, size)
async function render(bytes) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise
  assert.equal(doc.numPages, 1)
  const page = await doc.getPage(1), viewport = page.getViewport({ scale: 2 })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return canvas
}
const goldenHashes = [
  '1a28d69afb99102a7905bdf7af61795811aca28740ad3352357cfbfe412b42e5',
  'cb9086b3f3b9d235c8d320e3fed1b2b19b47ee2b10208e6f884a49ce7a582f9a',
]
const report = { page: TUITION_RECEIPT_A5_PAGE, golden: [], cases: [] }
for (const [index, type] of ['new-registration', 'renewal'].entries()) {
  const receipt = fixture(index === 1)
  const immutableBefore = JSON.stringify(receipt)
  const output = await generateTuitionReceiptPdf(receipt, options)
  const bytes = Buffer.from(await output.blob.arrayBuffer())
  fs.writeFileSync(`${folder}/runtime-receipt-${type}.pdf`, bytes)
  assert.equal(JSON.stringify(receipt), immutableBefore)
  const pdf = await PDFDocument.load(bytes)
  assert.deepEqual(pdf.getPage(0).getSize(), TUITION_RECEIPT_A5_PAGE)
  const canvas = await render(bytes)
  fs.writeFileSync(`${folder}/runtime-receipt-${type}.png`, canvas.toBuffer('image/png'))
  const p = output.projection, plan = createTuitionReceiptOverlayPlan(p, measure)
  assert.equal(p.receiptNumber, receipt.receiptNumber)
  assert.equal(p.collectorName, 'Nguyễn Hà Vy')
  assert.equal(p.paymentDate, 'Ngày thu: 27/09/2026')
  assert.equal(p.amountInWords, index === 0 ? 'Hai triệu năm trăm tám mươi nghìn đồng.' : 'Hai triệu ba trăm ba mươi nghìn đồng.')
  assert(!plan.some(command => /BẢN GIẢ LẬP|KHÔNG SỬ DỤNG|Còn lại|remaining|Hiệu lực từ|Kỳ tiếp/.test(command.value)))
  assert(plan.every(command => command.type === 'text'))
  assert.equal(plan.find(command => command.key === 'title').fontSize, 16)
  assert.equal(plan.find(command => command.key === 'payerName').fontSize, 10.5)
  if (index === 1) for (const key of ['receiptAddress', 'email', 'cccd', 'centerAddressLine', 'centerPhoneLine']) assert(!plan.some(command => command.key === key))
  const goldenPath = `docs/business-reference/tuition-receipt/golden-a5/receipt-a5-${type}-golden.pdf`
  const goldenBytes = fs.readFileSync(goldenPath), golden = await PDFDocument.load(goldenBytes)
  assert.equal(hash(goldenBytes), goldenHashes[index])
  assert.equal(golden.getPageCount(), 1)
  assert.deepEqual(golden.getPage(0).getSize(), TUITION_RECEIPT_A5_PAGE)
  const fonts = golden.getPage(0).node.Resources().lookup(PDFName.of('Font'))
  for (const [style, resource] of [['regular', 'ReceiptR'], ['bold', 'ReceiptB'], ['italic', 'ReceiptI']]) {
    const root = fonts.lookup(PDFName.of(resource))
    const descendants = root.lookup(PDFName.of('DescendantFonts'))
    const font = descendants ? descendants.lookup(0) : root
    const desc = font.lookup(PDFName.of('FontDescriptor'))
    const original = decodePDFRawStream(desc.lookup(PDFName.of('FontFile2'))).decode()
    assert.equal(hash(original), TUITION_RECEIPT_FONTS[style].sha256)
  }
  const goldenCanvas = await render(goldenBytes)
  fs.writeFileSync(`${folder}/golden-${type}-comparison.png`, goldenCanvas.toBuffer('image/png'))
  // Canonical number and removed prototype are intentionally different.
  // All remaining pixels must keep the approved geometry and typography.
  const a = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  const b = goldenCanvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  let difference = 0, channels = 0
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if ((y >= 220 && y <= 254 && x >= 620) || (y >= 776 && y <= 800 && x >= 430 && x <= 760)) continue
    const offset = (y * canvas.width + x) * 4
    for (let channel = 0; channel < 3; channel++) { difference += Math.abs(a[offset + channel] - b[offset + channel]); channels++ }
  }
  const meanChannelDifference = difference / channels
  assert(meanChannelDifference < 1.5, `A5 golden visual difference: ${meanChannelDifference}`)
  report.golden.push({ path: goldenPath, sha256: hash(goldenBytes), pageCount: 1, size: golden.getPage(0).getSize() })
  report.cases.push({ type, receiptNumber: p.receiptNumber, projection: p, plan, meanChannelDifference })
}
const base = fixture(false)
const project = receipt => createTuitionReceiptPdfProjection(receipt)
const planned = receipt => createTuitionReceiptOverlayPlan(project(receipt), measure)
const optional = structuredClone(base)
optional.snapshot.customer = { payerName: base.snapshot.customer.payerName }
optional.snapshot.center = { name: 'DreamHome', address: '  ', phone: '  ' }
optional.snapshot.scheduleLines = []
assert(!planned(optional).some(command => ['centerAddressLine', 'centerPhoneLine', 'scheduleLines'].includes(command.key) || command.value === 'Lớp:'))
const long = structuredClone(base)
long.snapshot.customer.payerName = 'Nguyễn Thị Hoàng Phương Thảo Minh Anh Ngọc Bích'
long.snapshot.student.name = 'Trần Nguyễn Đức Hoàng Minh Khôi Anh Phương Thảo'
long.snapshot.payment.collectorName = 'Nguyễn Thị Hà Vy Phương Thảo Minh Anh'
long.snapshot.tuition.packageName = 'Gói nâng cao 24 buổi dành cho học viên năm 2026'
long.snapshot.tuition.programName = ''
long.snapshot.scheduleLines = ['Lớp Dolphin nâng cao - Thứ Ba 18:00 - Khóa 2026']
const longPlan = planned(long)
for (const key of ['payerName', 'studentName', 'packageDisplay', 'scheduleLines']) {
  const lines = longPlan.filter(command => command.key === key)
  assert(lines.length === 2 && lines.every(line => line.fontSize === 10.5))
}
const longOutput = await generateTuitionReceiptPdf(long, options)
const longBytes = Buffer.from(await longOutput.blob.arrayBuffer())
fs.writeFileSync(`${folder}/runtime-receipt-long-fields.pdf`, longBytes)
fs.writeFileSync(`${folder}/runtime-receipt-long-fields.png`, (await render(longBytes)).toBuffer('image/png'))
const overflow = structuredClone(long)
overflow.snapshot.student.name = 'Nguyễn '.repeat(100)
assert.throws(() => planned(overflow), error => error.name === 'TuitionReceiptPdfValidationError' && error.field === 'studentName')
const changedLive = structuredClone(base)
changedLive.customer = { payerName: 'CURRENT NAME', email: 'current@example.com' }
changedLive.center = { name: 'CURRENT CENTER' }
changedLive.payments[0].method = 'CURRENT METHOD'
changedLive.issuedAt = '2099-01-01T00:00:00Z'
assert.deepEqual(project(changedLive), project(base), 'Reprint must keep snapshot-owned date/method/customer/center')
const partial = structuredClone(base)
partial.snapshot.money.amountReceived -= 1
partial.snapshot.money.remainingAfterPayment = 1
assert.throws(() => project(partial))
for (const invalid of [{}, { ...base, status: 'WAITING_PAYMENT' }, { ...base, payments: [] }, { ...base, financeTransactionId: 'wrong' }]) assert.throws(() => project(invalid))
const historical = structuredClone(base)
historical.receiptNumber = historical.snapshot.receiptNumber = 'DH-HISTORICAL-0007'
assert.equal(project(historical).receiptNumber, 'DH-HISTORICAL-0007', 'Never regenerate a historical server-owned number')
const invalidDate = structuredClone(base)
invalidDate.snapshot.payment.transactionDate = '2026-02-30'
assert.throws(() => project(invalidDate))
const template = fs.readFileSync(`public/${TUITION_RECEIPT_TEMPLATE_PATH}`)
assert.equal(hash(template), TUITION_RECEIPT_TEMPLATE_SHA256)
const background = await pdfjs.getDocument({ data: new Uint8Array(template) }).promise
assert.equal((await (await background.getPage(1)).getTextContent()).items.length, 0, 'Background must contain no sample business text')
// The real application passes no options/baseUrl. Exercise the first and
// cached font loads with that exact call shape, not only explicit '/' fixtures.
const originalFetch = globalThis.fetch
try {
  globalThis.fetch = async url => new Response(fs.readFileSync(`public/${String(url).replace(/^\//, '')}`))
  for (let print = 0; print < 2; print++) {
    const realShape = await generateTuitionReceiptPdf(base)
    assert.deepEqual(realShape.projection, project(base))
    assert.deepEqual(realShape.pageSize, TUITION_RECEIPT_A5_PAGE)
  }
} finally { globalThis.fetch = originalFetch }
report.passed = true
report.longFields = longPlan
fs.writeFileSync(`${folder}/runtime-qa.json`, JSON.stringify(report, null, 2))
console.log('RECEIPT A5: PASS (golden geometry/fonts, canonical number, frozen snapshots, optional/long fields, full-payment guard)')
