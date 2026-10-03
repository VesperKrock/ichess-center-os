import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import {
  createTuitionReceiptPdfProjection,
  generateTuitionReceiptPdf,
} from '../src/tuition-receipt-pdf.js'
import { buildF5BReviseReceiptCommand } from '../src/cloud-authoritative-tuition-receipts.js'
import {
  COMPANY_TUITION_PAYMENT_PROFILE,
  TUITION_TRANSFER_QR_PATH,
  createTuitionNoticePdfProjection,
  generateTuitionNoticePdf,
} from '../src/tuition-notice-pdf.js'

const canvasPath = process.env.TBHP_CANVAS_PATH
if (!canvasPath) throw new Error('Set TBHP_CANVAS_PATH to local @napi-rs/canvas/index.js for PDF QA.')
const { createCanvas, loadImage, GlobalFonts } = await import(pathToFileURL(canvasPath).href)
const registerFont = (bytes, name) => GlobalFonts.register(Buffer.from(bytes), name)
const documentRef = {
  fonts: { ready: Promise.resolve(), load: async () => [], check: () => true },
  createElement(tag) {
    assert.equal(tag, 'canvas')
    const canvas = createCanvas(1, 1)
    canvas.toBlob = (callback) => callback(new Blob([canvas.toBuffer('image/png')], { type: 'image/png' }))
    return canvas
  },
}
const fetchImpl = async (url) => {
  const path = `public/${String(url).replace(/^\//, '')}`
  const bytes = fs.readFileSync(path)
  return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
}

assert.equal(TUITION_TRANSFER_QR_PATH, 'assets/payment/ichess-company-tuition-qr.png')
assert.equal(COMPANY_TUITION_PAYMENT_PROFILE.accountNumber, '442228866')
assert.equal(COMPANY_TUITION_PAYMENT_PROFILE.beneficiary, 'CÔNG TY TNHH ICHESS VIET NAM')

const makeNotice = (sessionCount) => ({
  id: '642c441e-e675-42e8-b8a0-e59b2a76a498',
  issuedAt: '2026-09-25T08:00:00+07:00',
  snapshot: {
    noticeId: '642c441e-e675-42e8-b8a0-e59b2a76a498',
    documentType: 'TUITION_NOTICE',
    issuedAt: '2026-09-25T08:00:00+07:00',
    registration: { code: 'RENEWAL' },
    center: { name: 'DreamHome', phone: '0365 998 894', website: 'www.ichess.edu.vn' },
    student: { name: 'Nguyễn Minh Anh' },
    tuition: { packageName: `Gói ${sessionCount} buổi`, termNumber: 2, programName: 'Cờ vua nâng cao', learningForm: 'Tái đăng ký', totalSessions: sessionCount, maxCompletionWeeks: 9 },
    currentProgress: { usedSessions: 14, totalSessions: 16 },
    paymentWindow: { from: '2026-09-25', to: '2026-09-27' },
    paymentTruth: { status: 'UNPAID', paidBeforeIChess: false },
    money: { tuitionAmount: 2400000, discountAmount: 100000, materialFee: 80000, totalAmount: 2380000 },
    notes: ['Thời gian tối đa hoàn thành khóa: 9 tuần.'],
    transfer: { ...COMPANY_TUITION_PAYMENT_PROFILE, content: 'Nguyen Minh Anh HP K2' },
    scheduleRows: Array.from({ length: sessionCount }, (_, index) => ({
      sessionNumber: index + 1,
      date: `2026-10-${String(index % 28 + 1).padStart(2, '0')}`,
      teacherName: index % 2 ? 'Cô Nguyễn Thị Ngọc Ánh' : 'Thầy Trần Minh Quang',
      source: index < 2 ? 'ACTUAL' : 'PLANNED',
    })),
  },
})

// The old 12-row pagination/32-session expectations are superseded by A4 1–24.
for (const count of [8, 12, 16, 20, 24]) {
  const notice = makeNotice(count)
  const projection = createTuitionNoticePdfProjection(notice)
  assert.equal(projection.scheduleRows.length, count)
  assert.equal(projection.totalAmount, 2380000)
  assert.equal(projection.scheduleRows[0].teacherName, 'Thầy Trần Minh Quang')
  assert.equal(projection.scheduleRows[1].teacherName, 'Cô Nguyễn Thị Ngọc Ánh')
  const result = await generateTuitionNoticePdf(notice, {
    documentRef, fetchImpl, baseUrl: '/', registerFont,
    decodeImage: (bytes) => loadImage(Buffer.from(bytes)),
  })
  const validatedPdf = await PDFDocument.load(await result.blob.arrayBuffer())
  assert.equal(validatedPdf.getPageCount(), result.pageCount)
  assert.equal(result.rowCount, count)
  assert.equal(result.pageCount, 1)
  assert(Math.abs(validatedPdf.getPage(0).getWidth() - 595.2756) < 0.02)
  if (count === 24 && process.env.TBHP_RENDER_TO) {
    fs.writeFileSync(process.env.TBHP_RENDER_TO, Buffer.from(await result.blob.arrayBuffer()))
  }
  if (count === 16 && process.env.TBHP_RENDER_16_TO) {
    fs.writeFileSync(process.env.TBHP_RENDER_16_TO, Buffer.from(await result.blob.arrayBuffer()))
  }
  console.log(`PASS TBHP ${count} sessions: ${result.pageCount} page(s), alternating teachers`)
}
assert.throws(() => createTuitionNoticePdfProjection(makeNotice(32)), /1 đến 24/)
const longNotice = makeNotice(16)
longNotice.snapshot.student.name = 'Nguyễn Trần Minh Anh Phương Thảo'
longNotice.snapshot.scheduleRows[0].teacherName = 'Cô Nguyễn Thị Hoàng Thùy Dương'
const longNoticePdf = await generateTuitionNoticePdf(longNotice, {
  documentRef, fetchImpl, baseUrl: '/', registerFont, decodeImage: (bytes) => loadImage(Buffer.from(bytes)),
})
assert.equal(longNoticePdf.rowCount, 16)
console.log('PASS TBHP long student and per-occurrence teacher names')

const otherCenterNotice = makeNotice(8)
otherCenterNotice.snapshot.center = {
  name: 'DreamHome', phone: '0901 234 567', website: 'dreamhome.example',
}
const otherCenterPdf = await generateTuitionNoticePdf(otherCenterNotice, {
  documentRef, fetchImpl, baseUrl: '/', registerFont, decodeImage: (bytes) => loadImage(Buffer.from(bytes)),
})
assert.equal(otherCenterPdf.pageCount, 1)
if (process.env.TBHP_RENDER_OTHER_CENTER_TO) {
  fs.writeFileSync(process.env.TBHP_RENDER_OTHER_CENTER_TO,
    Buffer.from(await otherCenterPdf.blob.arrayBuffer()))
}
console.log('PASS TBHP canonical center/hotline/website with approved company identity')
await assert.rejects(generateTuitionNoticePdf(makeNotice(8), {
  documentRef, baseUrl: '/', registerFont,
  fetchImpl: async (url) => String(url).includes(TUITION_TRANSFER_QR_PATH)
    ? { ok: false }
    : fetchImpl(url),
  decodeImage: (bytes) => loadImage(Buffer.from(bytes)),
}), /QR công ty/)
console.log('PASS missing QR asset fails explicitly without a broken image')

const receiptId = 'ceb904e9-4c87-4695-ad21-bcbfdc33254a'
const transactionId = '95779113-3b25-4aa4-9fe6-59145c3c05d4'
const receipt = {
  id: receiptId,
  receiptNumber: 'DH-250926-001',
  financeTransactionId: transactionId,
  amountReceived: 1500000,
  status: 'ISSUED',
  issuedAt: '2026-09-25T08:00:00+07:00',
  payments: [{ transactionId, status: 'posted', method: 'Chuyển khoản' }],
  snapshot: {
    receiptId, receiptNumber: 'DH-250926-001', financeTransactionId: transactionId,
    issuedAt: '2026-09-25T08:00:00+07:00',
    center: { name: 'DreamHome', address: 'TP.HCM', phone: '0901 234 567' },
    student: { name: 'Nguyễn Minh Anh' },
    customer: { payerName: 'Nguyễn Thị Hạnh', email: '', cccd: '', receiptAddress: '' },
    payment: { collectorName: 'Hoàng Thị Vân' },
    registration: { code: 'NEW_REGISTRATION', label: 'Đăng ký mới' },
    tuition: { termNumber: 1, packageName: 'Gói 16 buổi' },
    scheduleLines: ['Thứ Ba 18:00'],
    money: { tuitionBaseAmount: 1600000, discount: { amount: 100000 },
      materialFee: 0, totalAmountDue: 1500000, amountReceived: 1500000,
      remainingAfterPayment: 0 },
  },
}
assert.equal(createTuitionReceiptPdfProjection(receipt).classification, 'Đăng ký mới')
assert.equal(createTuitionReceiptPdfProjection(receipt).collectorName, 'Hoàng Thị Vân')
assert.equal(buildF5BReviseReceiptCommand({ ...receipt, version: 1 },
  { collectorName: 'Trần Thị Mai' }, 'Sửa người thu in sai').corrections.collectorName, 'Trần Thị Mai')
assert.throws(() => createTuitionReceiptPdfProjection({ ...receipt, status: 'WAITING_PAYMENT' }))
assert.throws(() => createTuitionReceiptPdfProjection({ ...receipt, financeTransactionId: 'wrong' }))
const receiptPdf = await generateTuitionReceiptPdf(receipt, { documentRef, fetchImpl, baseUrl: '/' })
if (process.env.RECEIPT_RENDER_TO) {
  fs.writeFileSync(process.env.RECEIPT_RENDER_TO, Buffer.from(await receiptPdf.blob.arrayBuffer()))
}
assert.equal(receiptPdf.pageCount, 1)
assert.equal((await PDFDocument.load(await receiptPdf.blob.arrayBuffer())).getPageCount(), 1)
const voided = { ...receipt, status: 'VOIDED', payments: [{ transactionId, status: 'voided', method: 'Chuyển khoản' }] }
assert.equal(createTuitionReceiptPdfProjection(voided).status, 'VOIDED')
assert.throws(() => createTuitionReceiptPdfProjection({ ...receipt, payments: voided.payments }))
console.log('PASS post-payment Receipt PDF: linked Finance, one page, void projection, no waiting state')
