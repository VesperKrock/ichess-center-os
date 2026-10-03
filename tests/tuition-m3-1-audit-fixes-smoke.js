import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import { makeA4Notice } from './tuition-notice-a4-fixtures.js'
import { bindTuitionNoticePaymentTruth } from '../src/tuition-notice-payment-truth.js'
import { buildTuitionNoticePaymentCopy, createTuitionNoticePdfProjection, generateTuitionNoticePdf } from '../src/tuition-notice-pdf.js'
import { openConvertedStudentTuition } from '../src/tuition-customer-handoff.js'
import { createTuitionOperatorState } from '../src/tuition-operator-controller.js'
import { renderTuitionModule } from '../src/tuition-module.js'

const centerId = 'qa_center'
const studentId = 'qa_student'
function noticeFor(status, paidBeforeIChess = false) {
  const notice = makeA4Notice(16)
  notice.centerId = centerId
  notice.studentId = studentId
  notice.targetCycleId = notice.id
  notice.totalSessions = 16
  notice.snapshot.center.id = centerId
  notice.snapshot.student.id = studentId
  notice.snapshot.tuition.targetCycleId = notice.id
  const cycle = {
    id: notice.id, centerId, studentId, cycleNumber: notice.targetTermNumber,
    totalSessions: notice.totalSessions, paymentStatus: status,
    openingPaymentState: paidBeforeIChess ? 'PAID_BEFORE_ICHESS' : 'UNPAID',
  }
  const operator = { centerId, students: [{ id: studentId }],
    cycleStates: [{ studentId, currentCycle: cycle, preparedNextCycle: null, cycles: [] }] }
  return { notice, operator }
}
const unpaid = noticeFor('UNPAID')
const paid = noticeFor('PAID')
const legacy = noticeFor('PAID', true)
for (const [name, entry, expected] of [
  ['unpaid', unpaid, 'UNPAID'], ['paid', paid, 'PAID'], ['legacy', legacy, 'PAID'],
]) {
  const bound = bindTuitionNoticePaymentTruth(entry.notice, entry.operator, centerId)
  const projection = createTuitionNoticePdfProjection(bound)
  const copy = buildTuitionNoticePaymentCopy(projection)
  assert.equal(projection.paymentStatus, expected, name)
  assert.equal(projection.totalSessions, 16, name)
  assert.equal(projection.totalAmount, 2330000, name)
  assert.equal(copy.showPaymentInstructions, expected === 'UNPAID', name)
  assert.equal(JSON.stringify(copy).includes('vui lòng thanh toán'), expected === 'UNPAID', name)
  if (name === 'legacy') assert(JSON.stringify(copy).includes('trước khi dùng iChess'))
}
const noTruth = { ...paid.notice, snapshot: { ...paid.notice.snapshot, paymentTruth: null } }
assert.throws(() => createTuitionNoticePdfProjection(noTruth), /trạng thái thanh toán/)
assert.throws(() => bindTuitionNoticePaymentTruth(paid.notice, { ...paid.operator, centerId: 'other' }, centerId))
assert.throws(() => bindTuitionNoticePaymentTruth(paid.notice, { ...paid.operator,
  cycleStates: [{ studentId, currentCycle: { ...paid.operator.cycleStates[0].currentCycle, id: crypto.randomUUID() }, cycles: [] }],
}, centerId))

const noDue = bindTuitionNoticePaymentTruth(unpaid.notice, unpaid.operator, centerId)
noDue.snapshot.paymentWindow = { ...noDue.snapshot.paymentWindow }
noDue.snapshot.paymentWindow.to = null
const noDueCopy = buildTuitionNoticePaymentCopy(createTuitionNoticePdfProjection(noDue))
assert(!JSON.stringify(noDueCopy).includes('đến ngày'))
assert.deepEqual(noDueCopy.window, [])
const onlyDue = bindTuitionNoticePaymentTruth(unpaid.notice, unpaid.operator, centerId)
onlyDue.snapshot.paymentWindow = { ...onlyDue.snapshot.paymentWindow }
onlyDue.snapshot.paymentWindow.from = null
assert.equal(buildTuitionNoticePaymentCopy(createTuitionNoticePdfProjection(onlyDue)).window,
  'Hạn thanh toán: 30/09/2026.')

const canvasPath = process.env.TBHP_CANVAS_PATH
if (!canvasPath) throw new Error('Set TBHP_CANVAS_PATH to local @napi-rs/canvas/index.js for PDF QA.')
const { createCanvas, loadImage, GlobalFonts } = await import(pathToFileURL(canvasPath).href)
const documentRef = {
  fonts: { ready: Promise.resolve(), load: async () => [], check: () => true },
  createElement(tag) {
    assert.equal(tag, 'canvas')
    const canvas = createCanvas(1, 1)
    canvas.toBlob = callback => callback(new Blob([canvas.toBuffer('image/png')], { type: 'image/png' }))
    return canvas
  },
}
const fetchImpl = async url => {
  const bytes = fs.readFileSync(`public/${String(url).replace(/^\//, '')}`)
  return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
}
const pdfOptions = { documentRef, fetchImpl, baseUrl: '/',
  registerFont: (bytes, name) => GlobalFonts.register(Buffer.from(bytes), name),
  decodeImage: bytes => loadImage(Buffer.from(bytes)) }
for (const [name, entry] of [['unpaid', unpaid], ['paid', paid], ['legacy', legacy]]) {
  const result = await generateTuitionNoticePdf(bindTuitionNoticePaymentTruth(entry.notice, entry.operator, centerId), pdfOptions)
  assert.equal(result.pageCount, 1, name)
  assert.equal(result.rowCount, 16, name)
  assert.equal(result.layout.qr === null, name !== 'unpaid', name)
  assert.equal((await PDFDocument.load(await result.blob.arrayBuffer())).getPageCount(), 1, name)
}
const noDuePdf = await generateTuitionNoticePdf(noDue, pdfOptions)
assert.equal(noDuePdf.pageCount, 1)

const emptyContext = { students: [], cycleStates: [], catalog: [], receipts: [],
  readStatus: 'ready', receiptStatus: 'ready', initialSetupEnabled: false }
const emptyMarkup = renderTuitionModule(emptyContext, createTuitionOperatorState())
assert(emptyMarkup.includes('Chưa có học viên để quản lý học phí tại cơ sở này.'))
const filteredState = createTuitionOperatorState()
filteredState.filters.query = 'khong-co'
const filteredMarkup = renderTuitionModule({ ...emptyContext, students: [{
  id: studentId, fullName: 'Học viên QA', parentName: 'Phụ huynh QA', parentPhone: '0900000000',
}] }, filteredState)
assert(filteredMarkup.includes('Chưa có học viên phù hợp.'))
assert(!filteredMarkup.includes('Chưa có học viên để quản lý học phí tại cơ sở này.'))

const opened = []
const messages = []
let snapshot = { status: 'idle', centerId, students: [], cycleStates: [] }
let finishRead
const read = new Promise(resolve => { finishRead = resolve })
const handoff = openConvertedStudentTuition({ studentId, centerId,
  getSnapshot: () => snapshot, refresh: () => read, isCurrent: () => true,
  openPanel: (kind, id) => opened.push([kind, id]), showMessage: text => messages.push(text) })
assert.deepEqual(opened, [])
snapshot = { status: 'ready', centerId, students: [{ id: studentId }], cycleStates: [{ studentId, currentCycle: null }] }
finishRead({ ok: true })
assert.equal(await handoff, true)
assert.deepEqual(opened, [['assign', studentId]])

let refreshCount = 0
const ready = await openConvertedStudentTuition({ studentId, centerId,
  getSnapshot: () => ({ ...snapshot, cycleStates: [{ studentId, currentCycle: { id: 'cycle' } }] }),
  refresh: () => { refreshCount++; return Promise.resolve({ ok: true }) }, isCurrent: () => true,
  openPanel: (kind, id) => opened.push([kind, id]), showMessage: text => messages.push(text) })
assert.equal(ready, true)
assert.equal(refreshCount, 0)
assert.deepEqual(opened.at(-1), ['detail', studentId])

snapshot = { status: 'ready', centerId, students: [{ id: studentId }],
  cycleStates: [{ studentId, currentCycle: null, initialSetupRequired: true }] }
assert.equal(await openConvertedStudentTuition({ studentId, centerId, forceRefresh: true,
  getSnapshot: () => snapshot,
  refresh: () => { refreshCount++; return Promise.resolve({ ok: true }) }, isCurrent: () => true,
  openPanel: (kind, id) => opened.push([kind, id]), showMessage: text => messages.push(text) }), true)
assert.equal(refreshCount, 1)
assert.deepEqual(opened.at(-1), ['initial', studentId])

let current = true
snapshot = { status: 'loading', centerId, students: [], cycleStates: [] }
let finishStale
const staleRead = new Promise(resolve => { finishStale = resolve })
const staleHandoff = openConvertedStudentTuition({ studentId, centerId,
  getSnapshot: () => snapshot, refresh: () => staleRead, isCurrent: () => current,
  openPanel: (kind, id) => opened.push([kind, id]), showMessage: text => messages.push(text) })
current = false
snapshot = { status: 'ready', centerId, students: [{ id: studentId }], cycleStates: [] }
finishStale({ ok: true })
assert.equal(await staleHandoff, false)
assert.equal(opened.length, 3)
assert.equal(await openConvertedStudentTuition({ studentId, centerId, getSnapshot: () => snapshot,
  refresh: () => Promise.resolve({ ok: true }), isCurrent: () => false,
  openPanel: (kind, id) => opened.push([kind, id]), showMessage: text => messages.push(text) }), false)

snapshot = { status: 'ready', centerId, students: [], cycleStates: [] }
assert.equal(await openConvertedStudentTuition({ studentId, centerId, getSnapshot: () => snapshot,
  refresh: () => Promise.resolve({ ok: true }), isCurrent: () => true,
  openPanel: (kind, id) => opened.push([kind, id]), showMessage: text => messages.push(text) }), false)
assert(messages.at(-1).includes('Không tìm thấy học viên'))
assert.equal(opened.length, 3)
snapshot = { status: 'ready', centerId: 'other_center', students: [{ id: studentId }], cycleStates: [] }
assert.equal(await openConvertedStudentTuition({ studentId, centerId, getSnapshot: () => snapshot,
  refresh: () => Promise.resolve({ ok: true }), isCurrent: () => true,
  openPanel: (kind, id) => opened.push([kind, id]), showMessage: text => messages.push(text) }), false)
assert(messages.at(-1).includes('Không tải được học phí'))
assert.equal(opened.length, 3)
console.log('TUITION M3.1: PASS (payment truth, due date, PDF, cold/ready/stale handoff, empty states)')
