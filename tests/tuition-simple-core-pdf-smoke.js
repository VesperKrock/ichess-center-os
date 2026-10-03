import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import {
  COMPANY_TUITION_PAYMENT_PROFILE,
  createTuitionNoticePdfProjection,
  generateTuitionNoticePdf,
} from '../src/tuition-notice-pdf.js'

const canvasPath = process.env.TBHP_CANVAS_PATH
if (!canvasPath) throw new Error('Set TBHP_CANVAS_PATH to local @napi-rs/canvas/index.js for PDF QA.')
const { createCanvas, loadImage, GlobalFonts } = await import(pathToFileURL(canvasPath).href)
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
  const assetPath = `public/${String(url).replace(/^\//, '')}`
  const bytes = fs.readFileSync(assetPath)
  return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
}

const actualRows = [
  ['2026-09-01', 'Thầy Trần Minh Quang'],
  ['2026-09-03', 'Cô Nguyễn Thị Ngọc Ánh'],
  ['2026-09-08', 'Thầy Trần Minh Quang'],
  ['2026-09-10', 'Cô Nguyễn Thị Ngọc Ánh'],
  ['2026-09-15', 'Thầy Trần Minh Quang'],
  ['2026-09-17', 'Cô Nguyễn Thị Ngọc Ánh'],
]
const scheduleRows = Array.from({ length: 16 }, (_, index) => ({
  sessionNumber: index + 1,
  date: actualRows[index]?.[0] || '',
  teacherName: actualRows[index]?.[1] || '',
  source: index < actualRows.length ? 'ACTUAL' : 'UNRESOLVED',
}))
const notice = {
  id: 'b840935f-0d0e-4f07-92dc-61eeb136e608',
  issuedAt: '2026-09-26T08:00:00+07:00',
  snapshot: {
    noticeId: 'b840935f-0d0e-4f07-92dc-61eeb136e608',
    documentType: 'TUITION_NOTICE',
    issuedAt: '2026-09-26T08:00:00+07:00',
    registration: { code: 'NEW_REGISTRATION' },
    center: { name: 'DreamHome', phone: '0901 234 567', website: 'www.ichess.edu.vn' },
    student: { name: 'Nguyễn Minh An' },
    tuition: { packageName: 'Gói 16 buổi', termNumber: 1, programName: 'Cờ vua', learningForm: 'Đăng ký mới', totalSessions: 16, maxCompletionWeeks: 9 },
    currentProgress: { usedSessions: 6, totalSessions: 16 },
    paymentWindow: { from: '', to: '' },
    paymentTruth: { status: 'UNPAID', paidBeforeIChess: false },
    money: { tuitionAmount: 1600000, discountAmount: 0, materialFee: 0, totalAmount: 1600000 },
    notes: [],
    transfer: { ...COMPANY_TUITION_PAYMENT_PROFILE, content: 'Nguyen Minh An HP K1' },
    scheduleRows,
  },
}

const projection = createTuitionNoticePdfProjection(notice)
assert.equal(projection.scheduleRows.length, 16)
assert.equal(projection.scheduleRows.filter((row) => row.source === 'ACTUAL').length, 6)
assert.equal(projection.scheduleRows.slice(6).every((row) => !row.date && !row.teacherName), true)

const result = await generateTuitionNoticePdf(notice, {
  documentRef,
  fetchImpl,
  baseUrl: '/',
  decodeImage: (bytes) => loadImage(Buffer.from(bytes)),
  registerFont: (bytes, name) => GlobalFonts.register(Buffer.from(bytes), name),
})
const bytes = Buffer.from(await result.blob.arrayBuffer())
assert.equal((await PDFDocument.load(bytes)).getPageCount(), result.pageCount)
assert.equal(result.rowCount, 16)
if (process.env.TBHP_SIMPLE_CORE_RENDER_TO) fs.writeFileSync(process.env.TBHP_SIMPLE_CORE_RENDER_TO, bytes)
console.log('Tuition Simple Core PDF: 6 actual + 10 blank rows, valid export PASS')
