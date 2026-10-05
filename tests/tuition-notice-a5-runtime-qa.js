import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import { makeA5Notice } from './tuition-notice-a5-fixtures.js'
import { generateTuitionNoticePdf, createTuitionNoticePdfProjection, TUITION_NOTICE_TEMPLATE_SHA256 } from '../src/tuition-notice-pdf.js'
import { bindTuitionNoticePaymentTruth } from '../src/tuition-notice-payment-truth.js'
import { getPrintableTuitionDocument } from '../src/cloud-authoritative-tuition-notices.js'

const deps = path.join(os.tmpdir(), 'ichess-tuition-pdf-render-270927/node_modules')
const { createCanvas, loadImage } = await import(pathToFileURL(process.env.TBHP_CANVAS_PATH || path.join(deps, '@napi-rs/canvas/index.js')))
const pdfjs = await import(pathToFileURL(process.env.TBHP_PDFJS_PATH || path.join(deps, 'pdfjs-dist/legacy/build/pdf.mjs')))
const { default: jsQR } = await import(pathToFileURL(process.env.TBHP_JSQR_PATH || path.join(os.tmpdir(), 'ichess-tbc-qr-qa/node_modules/jsqr/dist/jsQR.js')))
const output = 'artifacts/l2-tbhp-a5'
fs.mkdirSync(output, { recursive: true })
const fetchImpl = async url => {
  const bytes = fs.readFileSync(`public/${String(url).replace(/^\//, '')}`)
  return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
}
const options = { fetchImpl, baseUrl: '/' }
const report = { cases: [], negative: [], reference: {} }
async function render(bytes, name) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise
  assert.equal(pdf.numPages, 1)
  const page = await pdf.getPage(1), viewport = page.getViewport({ scale: 3 })
  assert(Math.abs(page.view[2] - 419.5276) < 0.02 && Math.abs(page.view[3] - 595.2756) < 0.02)
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  fs.writeFileSync(`${output}/${name}.png`, canvas.toBuffer('image/png'))
  const text = (await page.getTextContent()).items.filter(item => item.str?.trim())
  assert(text.every(item => item.transform[4] >= 0 && item.transform[4] + item.width <= 419.5276 + 0.1))
  return { canvas, text }
}
const canonical = await loadImage(fs.readFileSync('public/assets/payment/ichess-company-tuition-qr.png'))
const qrCanvas = createCanvas(canonical.width, canonical.height)
qrCanvas.getContext('2d').drawImage(canonical, 0, 0)
const canonicalPixels = qrCanvas.getContext('2d').getImageData(0, 0, canonical.width, canonical.height)
const canonicalQr = jsQR(canonicalPixels.data, canonical.width, canonical.height)
assert(canonicalQr?.data.includes('442228866'))
function verifyQr(canvas, expected) {
  const context = canvas.getContext('2d')
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const qr = jsQR(pixels.data, canvas.width, canvas.height)
  if (!expected) { assert.equal(qr, null, 'Paid notice has no payment QR'); return }
  assert.equal(qr?.data, canonicalQr.data, 'Embedded template QR equals canonical company payload')
  // Hide the detected QR only in a QA copy, then scan for an accidental duplicate.
  const copy = createCanvas(canvas.width, canvas.height), c = copy.getContext('2d')
  c.drawImage(canvas, 0, 0)
  const points = Object.values(qr.location).filter(p => typeof p?.x === 'number')
  const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y))
  c.fillStyle = '#fff'
  c.fillRect(minX - 8, minY - 8, Math.max(...points.map(p => p.x)) - minX + 16, Math.max(...points.map(p => p.y)) - minY + 16)
  const remaining = c.getImageData(0, 0, copy.width, copy.height)
  assert.equal(jsQR(remaining.data, copy.width, copy.height), null, 'Exactly one visible QR')
}
const template = fs.readFileSync('public/forms/tuition-notice/tuition-notice-template.pdf')
assert.equal(crypto.createHash('sha256').update(template).digest('hex'), TUITION_NOTICE_TEMPLATE_SHA256)
const reference = await render(template, 'approved-template')
verifyQr(reference.canvas, true)
report.reference.template = { sha256: TUITION_NOTICE_TEMPLATE_SHA256, pages: 1, size: [419.5276, 595.2756], qrMatchesCanonical: true }
const scenarios = [
  ['normal-blank-hotline', n => { n.snapshot.center.phone = '   '; n.snapshot.student.birthDate = '2018-08-12' }],
  ['discount-next-start', () => {}],
  ['no-discount', n => { n.snapshot.money.discountAmount = 0; n.snapshot.money.totalAmount = n.snapshot.money.tuitionAmount + n.snapshot.money.materialFee }],
  ['long-student', n => { n.snapshot.student.name = 'Nguyễn Trần Minh Anh Phương Thảo' }],
  ['long-center', n => { n.snapshot.center.name = 'iChess Vinhomes Grand Park Thành phố Thủ Đức' }],
  ['configured-hotline', n => { n.snapshot.center.phone = '+84 (28)  1234 5678' }],
  ['custom-note', n => { n.snapshot.notes = ['Phụ huynh vui lòng kiểm tra thông tin học phí của khóa học.'] }],
  ['paid', n => { n.snapshot.paymentTruth.status = 'PAID' }],
  ['paid-before-ichess', n => { n.snapshot.paymentTruth = { status: 'PAID', paidBeforeIChess: true } }],
  ['no-due-date', n => { n.snapshot.paymentWindow = {} }],
  ['known-N-32', n => { n.snapshot.tuition.totalSessions = 32 }],
]
for (const [name, setup] of scenarios) {
  const notice = makeA5Notice()
  setup(notice)
  const before = JSON.stringify(notice), result = await generateTuitionNoticePdf(notice, { ...options,
    generatedDate: '2026-10-06', forecastFacts: { packageSessions: notice.snapshot.tuition.totalSessions,
      usedSessions: notice.snapshot.tuition.totalSessions - 2, weekdays: ['tue', 'thu'] } })
  assert.equal(JSON.stringify(notice), before, 'Document rendering is read-only')
  assert(!('scheduleRows' in result.projection) && !('currentUsedSessions' in result.projection) && !('table' in result.layout))
  const bytes = Buffer.from(await result.blob.arrayBuffer())
  fs.writeFileSync(`${output}/${name}.pdf`, bytes)
  const { canvas, text } = await render(bytes, name)
  const strings = text.map(item => item.str), joined = strings.join(' ')
  assert(!/Ngày học|Giáo viên|Tiến độ|Buổi đã học/.test(joined))
  const expectedPhone = notice.snapshot.center.phone.trim() || '090 1197 260'
  assert.equal(result.projection.centerPhone, expectedPhone, 'Configured phone preserved exactly')
  assert.equal(result.layout.fields.hotline.value, expectedPhone)
  // PDF.js normalizes repeated spaces when extracting otherwise exact glyphs.
  assert.equal(strings.filter(str => str.includes(expectedPhone.replace(/\s+/g, ' '))).length, 2, 'Same hotline in both positions')
  if (expectedPhone !== '090 1197 260') assert(!joined.includes('090 1197 260'), 'Configured phone does not print fallback')
  assert(joined.includes(result.projection.studentName))
  verifyQr(canvas, result.projection.paymentStatus === 'UNPAID')
  if (result.projection.paymentStatus === 'PAID') {
    assert(!joined.includes('vui lòng đóng học phí') && !joined.includes('Chuyển khoản:') && !joined.includes('STK:'))
    if (result.projection.paidBeforeIChess) assert(joined.includes('trước khi dùng iChess'))
  }
  if (name === 'discount-next-start') assert(joined.includes('Thứ Năm, 15/10/2026.'))
  assert(joined.includes('thời gian dự kiến hoàn thành khóa học khoảng'))
  assert(!joined.includes('thời gian tối đa'))
  // Geometry assertion uses actual PDF text, independent of returned boxes.
  const dynamic = text.filter(item => item.fontName.includes('g_d') && item.transform[5] > 70)
  for (const item of dynamic) assert(item.transform[4] + item.width < 378, 'Content stays within the measured right margin')
  for (const item of text) {
    if (item.str === 'Tổng cộng:') continue
    const neighbors = text.filter(other => other !== item && Math.abs(other.transform[5] - item.transform[5]) < 0.2 && other.transform[4] > item.transform[4])
    for (const other of neighbors) assert(item.transform[4] + item.width <= other.transform[4] + 0.6, `No text overlap: ${item.str} / ${other.str}`)
  }
  if (name === 'normal-blank-hotline') {
    const context = canvas.getContext('2d'), pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < pixels.data.length; i += 4) {
      const gray = Math.round(pixels.data[i] * 0.299 + pixels.data[i + 1] * 0.587 + pixels.data[i + 2] * 0.114)
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray
    }
    context.putImageData(pixels, 0, 0)
    fs.writeFileSync(`${output}/grayscale.png`, canvas.toBuffer('image/png'))
    verifyQr(canvas, true)
  }
  report.cases.push({ name, pageCount: 1, size: [419.5276, 595.2756], hotline: expectedPhone, qrCount: result.layout.qr ? 1 : 0, layout: result.layout })
  console.log(`PASS A5 runtime ${name}`)
}
const poisoned = makeA5Notice()
poisoned.snapshot.scheduleRows = [{ teacherName: 'MUST NOT PRINT', date: 'invalid' }]
poisoned.snapshot.currentProgress = { usedSessions: -999 }
await generateTuitionNoticePdf(poisoned, options)
const invalid = makeA5Notice()
invalid.snapshot.money.totalAmount++
assert.throws(() => createTuitionNoticePdfProjection(invalid), /Tổng tiền/)
invalid.snapshot.money.totalAmount--
invalid.snapshot.transfer.accountNumber = '36556207'
assert.throws(() => createTuitionNoticePdfProjection(invalid), /Hồ sơ chuyển khoản/)
const long = makeA5Notice()
long.snapshot.student.name = 'Nguyễn '.repeat(100)
await assert.rejects(generateTuitionNoticePdf(long, options), /studentName/)
await assert.rejects(generateTuitionNoticePdf(makeA5Notice(), { ...options, fetchImpl: async url => {
  const response = await fetchImpl(url)
  if (String(url).endsWith('template.pdf')) { const bytes = new Uint8Array(await response.arrayBuffer()); bytes[10] ^= 1; return { ok: true, arrayBuffer: async () => bytes.buffer } }
  return response
} }), /không khớp/)
// Existing Tuition Student read is the birth-date authority, including year-only data.
const notice = makeA5Notice(), studentId = 'qa-student', centerId = 'qa-center'
Object.assign(notice, { centerId, studentId, targetCycleId: notice.id, totalSessions: 16 })
Object.assign(notice.snapshot.center, { id: centerId })
Object.assign(notice.snapshot.student, { id: studentId })
Object.assign(notice.snapshot.tuition, { targetCycleId: notice.id })
const cycle = { id: notice.id, centerId, studentId, cycleNumber: notice.targetTermNumber, totalSessions: 16, paymentStatus: 'UNPAID' }
const operator = { centerId, students: [{ id: studentId, fullName: 'Học viên chính thức', birthDate: '2018-08-12' }], cycleStates: [{ studentId, cycles: [cycle] }] }
assert.equal(createTuitionNoticePdfProjection(bindTuitionNoticePaymentTruth(notice, operator, centerId)).birthDate, '12/08/2018')
operator.students[0].birthDate = ''; operator.students[0].birthYear = '2018'
assert.equal(createTuitionNoticePdfProjection(bindTuitionNoticePaymentTruth(notice, operator, centerId)).birthDate, '2018')
const read = await getPrintableTuitionDocument({ centerId, cycleId: notice.id, supabase: { rpc: async () => ({ data: {
  ok: true, outcome_code: 'PRINTABLE_DOCUMENT', center_id: centerId, document: { id: notice.id, target_cycle_id: notice.id, target_term_number: 2, total_sessions: 16, version: 1, snapshot: notice.snapshot },
} }) } })
assert(read.ok, 'Printable read no longer depends on obsolete schedule rows')
report.negative = ['unfittable content rejected', 'hash drift rejected', 'money drift rejected', 'personal payment rejected', 'schedule/progress ignored', 'Student birth precision preserved', 'historical cycle binding preserved']
if (fs.existsSync(`${output}/dreamhome-real-app.pdf`)) {
  const runtime = await render(fs.readFileSync(`${output}/dreamhome-real-app.pdf`), 'dreamhome-real-app')
  const strings = runtime.text.map(item => item.str)
  assert.equal(strings.filter(str => str.includes('090 1197 260')).length, 2)
  assert(!strings.some(str => /Ngày học|Giáo viên|Tiến độ/.test(str)))
  const remote = JSON.parse(fs.readFileSync(`${output}/real-app-qa.json`))
  const response = remote.requests.find(r => r.body?.document?.snapshot?.center?.id === 'dreamhome').body.document
  const paymentRead = remote.requests.filter(r => r.body?.contract === 'tuition-operator-v1').at(-1).body
  const cycle = paymentRead.cycle_state.students.find(s => s.student_id === response.student_id).cycles.find(c => c.id === response.target_cycle_id)
  verifyQr(runtime.canvas, cycle.payment_status === 'UNPAID')
  report.realApplication = { pages: 1, size: [419.5276, 595.2756], blankPhoneFallbackBothLocations: true, qrCount: cycle.payment_status === 'UNPAID' ? 1 : 0 }
}
fs.writeFileSync(`${output}/runtime-qa.json`, JSON.stringify(report, null, 2))
console.log('PASS A5 authority, safety and overflow checks')
