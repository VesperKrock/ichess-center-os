import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { PDFDocument, PDFName, decodePDFRawStream } from 'pdf-lib'
import { generateTuitionNoticePdf, createTuitionNoticePdfProjection, buildTuitionNoticeTeacherLabels } from '../src/tuition-notice-pdf.js'
import { makeA4Notice } from './tuition-notice-a4-fixtures.js'

const dependencies = path.join(os.tmpdir(), 'ichess-tuition-pdf-render-270927', 'node_modules')
const canvasModule = await import(pathToFileURL(process.env.TBHP_CANVAS_PATH || path.join(dependencies, '@napi-rs/canvas/index.js')))
const { createCanvas, loadImage, GlobalFonts } = canvasModule
const pdfjs = await import(pathToFileURL(process.env.TBHP_PDFJS_PATH || path.join(dependencies, 'pdfjs-dist/legacy/build/pdf.mjs')))
const { default: jsQR } = await import(pathToFileURL(process.env.TBHP_JSQR_PATH || path.join(os.tmpdir(), 'ichess-tbc-qr-qa/node_modules/jsqr/dist/jsQR.js')))
const artifacts = 'artifacts/tuition-notice-a4-runtime'
fs.mkdirSync(artifacts, { recursive: true })
const golden = [
  ['08', 8, false, 'tbhp-a4-08-proof.pdf', '5735a15d5014fdf71ca260667265f5959428dfaf597e3befe4a54b61be6f33a0'],
  ['16', 16, false, 'tbhp-a4-16-golden.pdf', '724194163f19a83a400eba65381d6ceeaf80e21a8b5a56561dde30c1982f0a08'],
  ['24', 24, false, 'tbhp-a4-24-golden.pdf', '3584b400d39921312b4345ee2e62d7e168df95c60e93019338283ca34f04bf13'],
  ['16-legacy-6', 16, true, 'tbhp-a4-16-legacy-6-proof.pdf', '92c3a81f31cb7d9d0902cfd23dac6292ba0c49f7b46e94530c7e8db56a77ad3b'],
]
const report = { golden: [], cases: [], comparisons: [], negativeCases: [] }
const trace = []
const documentRef = {
  fonts: { ready: Promise.resolve(), load: async () => [], check: () => true },
  createElement(tag) {
    assert.equal(tag, 'canvas')
    const canvas = createCanvas(1, 1)
    const context = canvas.getContext('2d')
    const text = context.fillText.bind(context)
    context.fillText = (value, x, y) => { trace.push({ value, x, y, font: context.font }); text(value, x, y) }
    canvas.toBlob = callback => callback(new Blob([canvas.toBuffer('image/png')], { type: 'image/png' }))
    return canvas
  },
}
const options = {
  documentRef, baseUrl: '/',
  fetchImpl: async url => { const bytes = fs.readFileSync(`public/${String(url).replace(/^\//, '')}`); return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } },
  decodeImage: bytes => loadImage(Buffer.from(bytes)),
  registerFont: (bytes, name) => assert(GlobalFonts.register(Buffer.from(bytes), name)),
}
async function render(bytes) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise
  assert.equal(pdf.numPages, 1)
  const page = await pdf.getPage(1)
  assert(Math.abs(page.view[2] - 595.2756) < 0.02 && Math.abs(page.view[3] - 841.8898) < 0.02)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return canvas
}
function gridLines(canvas, count) {
  // Measure actual rendered pixels, independently of the runtime's metadata.
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  const lines = []
  for (let y = 262; y < Math.ceil((155.5 + count * 13.3) * 2) + 5; y++) {
    let dark = 0
    for (let x = 616; x <= 1062; x++) {
      const i = (y * canvas.width + x) * 4
      if (pixels.data[i] < 150 && pixels.data[i + 1] < 150 && pixels.data[i + 2] < 150) dark++
    }
    if (dark > 425 && (!lines.length || y / 2 - lines.at(-1) > 1.5)) lines.push(y / 2)
  }
  assert.equal(lines.length, count + 2, `Exactly ${count} visible data rows`)
  return lines
}
function difference(a, b, region) {
  const aa = a.getContext('2d').getImageData(0, 0, a.width, a.height).data
  const bb = b.getContext('2d').getImageData(0, 0, b.width, b.height).data
  let sum = 0, changed = 0, n = 0
  const [x, y, width, height] = region.map(v => Math.round(v * 2))
  for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) {
    const i = (yy * a.width + xx) * 4
    const d = (Math.abs(aa[i] - bb[i]) + Math.abs(aa[i + 1] - bb[i + 1]) + Math.abs(aa[i + 2] - bb[i + 2])) / 3
    sum += d; if (d > 35) changed++; n++
  }
  return { meanAbsoluteDifference: +(sum / n).toFixed(3), changedPixelPercent: +(changed * 100 / n).toFixed(3) }
}
for (const [key, n, legacy, name, hash] of golden) {
  const input = fs.readFileSync(`docs/business-reference/tuition-notice/golden-a4/${name}`)
  assert.equal(crypto.createHash('sha256').update(input).digest('hex'), hash, 'STOP: approved golden changed')
  const reference = await render(input)
  const goldenPdf = await PDFDocument.load(input)
  const fonts = goldenPdf.getPage(0).node.Resources().lookup(PDFName.of('Font'))
  for (const [key, file] of [['LoraR', 'Lora-Regular.ttf'], ['LoraB', 'Lora-Bold.ttf'], ['LoraI', 'Lora-Italic.ttf']]) {
    const font = fonts.lookup(PDFName.of(key)).lookup(PDFName.of('DescendantFonts')).lookup(0)
    const bytes = decodePDFRawStream(font.lookup(PDFName.of('FontDescriptor')).lookup(PDFName.of('FontFile2'))).decode()
    assert.deepEqual(Buffer.from(bytes), fs.readFileSync(`public/forms/tuition-notice/fonts/${file}`), 'Runtime font bytes equal approved golden font bytes')
  }
  report.golden.push({ file: name, sha256: hash, pages: 1, size: [595.2756, 841.8898] })
  trace.length = 0
  const result = await generateTuitionNoticePdf(makeA4Notice(n, legacy), options)
  const bytes = Buffer.from(await result.blob.arrayBuffer())
  const runtime = await render(bytes)
  fs.writeFileSync(`${artifacts}/runtime-tbhp-${key}.pdf`, bytes)
  fs.writeFileSync(`${artifacts}/runtime-tbhp-${key}.png`, runtime.toBuffer('image/png'))
  const expected = gridLines(reference, n), actual = gridLines(runtime, n)
  actual.forEach((position, i) => assert(Math.abs(position - expected[i]) <= 0.5))
  const pixels = runtime.getContext('2d').getImageData(0, 0, runtime.width, runtime.height)
  const qr = jsQR(pixels.data, runtime.width, runtime.height)
  assert(qr?.data.includes('442228866'), 'Actual runtime PDF QR scans to approved company account')
  assert(trace.every(t => !t.value.includes('BẢN GIẢ LẬP') && !t.value.includes('_______') && !t.value.includes('NaN')))
  assert.equal(result.layout.fields.student.fontSize, 11)
  assert.equal(result.layout.fields.student.lines, n === 24 ? 2 : 1)
  assert.equal(trace.filter(t => t.x > 308 && /^\d+$/.test(t.value)).length, n)
  if (legacy) {
    for (let i = 0; i < 6; i++) assert.equal(trace.filter(t => t.x > 335 && Math.abs(t.y - (165.9 + i * 13.3)) < 0.01).length, 0)
    assert(trace.some(t => t.value === '28/09/2026') && trace.some(t => t.value === '01/10/2026'))
  }
  const comparison = { key, tableLines: actual, regions: {} }
  for (const [region, box] of Object.entries({ header: [40, 20, 505, 95], left: [48, 140, 250, 425], table: [306, 132, 228, 345], payment: [48, 570, 370, 130], qr: [425, 574, 108, 108], footer: [48, 707, 495, 117] })) {
    comparison.regions[region] = difference(reference, runtime, box)
    assert(comparison.regions[region].meanAbsoluteDifference < 18, `Golden region fidelity: ${key}/${region}`)
  }
  report.comparisons.push(comparison)
  report.cases.push({ key, rowCount: result.rowCount, pageCount: result.pageCount, layout: result.layout })
  console.log(`PASS golden/runtime ${key}: A4 one page, ${n} rows, QR scans`)
}
for (const n of [1, 9, 14, 17, 18]) {
  trace.length = 0
  const result = await generateTuitionNoticePdf(makeA4Notice(n), options)
  const bytes = new Uint8Array(await result.blob.arrayBuffer())
  const pdf = await PDFDocument.load(bytes)
  assert.equal(pdf.getPageCount(), 1)
  gridLines(await render(bytes), n)
  assert.equal(result.layout.profile, n <= 16 ? 'TBHP_A4_16' : 'TBHP_A4_24')
  assert.equal(trace.filter(t => t.x > 308 && /^\d+$/.test(t.value)).length, n)
  report.cases.push({ key: `custom-${n}`, rowCount: n, pageCount: 1, profile: result.layout.profile })
}
for (const n of [25, 32, 40]) assert.throws(() => createTuitionNoticePdfProjection(makeA4Notice(n)), /1 đến 24/)
const long = makeA4Notice()
long.snapshot.student.name = 'Hoàng Minh Anh Bảo Châu An Phương Thảo Nguyễn Trần Hoàng'
const fallback = await generateTuitionNoticePdf(long, options)
assert.equal(fallback.layout.fields.student.fontSize, 10.5)
assert.equal(fallback.layout.fields.student.lines, 2)
report.cases.push({ key: 'name-fallback', fontSize: 10.5, lines: 2 })
long.snapshot.student.name = 'Nguyễn '.repeat(20)
await assert.rejects(generateTuitionNoticePdf(long, options), /tên học viên/)
assert.deepEqual(buildTuitionNoticeTeacherLabels([
  { teacherName: 'Thầy Nguyễn Hoàng Thịnh' }, { teacherName: 'Thầy Lê Trường Thịnh' },
]), ['Thầy Hoàng Thịnh', 'Thầy Trường Thịnh'])
assert.deepEqual(buildTuitionNoticeTeacherLabels([{ teacherName: 'Cô Nguyễn Thị Ngọc Ánh', teacherDisplayName: 'Cô Ánh' }]), ['Cô Ánh'])
assert.deepEqual(buildTuitionNoticeTeacherLabels([
  { teacherName: 'Nguyễn Hoàng Thịnh', teacherDisplayName: 'Thầy Thịnh' },
  { teacherName: 'Lê Trường Thịnh', teacherDisplayName: 'Thầy Thịnh' },
]), ['Thầy Hoàng Thịnh', 'Thầy Trường Thịnh'])
const planned = makeA4Notice(8)
planned.snapshot.scheduleRows.forEach(row => { row.source = 'PLANNED' })
trace.length = 0
await generateTuitionNoticePdf(planned, options)
assert.equal(trace.filter(t => t.x > 335 && t.y >= 165.9 && t.y < 270).length, 0, 'Future/planned cells blank even when old input includes guessed facts')
await assert.rejects(generateTuitionNoticePdf(makeA4Notice(8), { ...options,
  fetchImpl: url => String(url).includes('ichess-company-tuition-qr') ? { ok: false } : options.fetchImpl(url) }), /QR công ty/)
report.negativeCases = ['>24 rejected', 'long name uses only one 10.5 pt fallback', 'unfittable name fails without truncation', 'teacher collision expanded', 'authoritative display label preferred', 'planned cells blank', 'missing QR rejected']
fs.writeFileSync(`${artifacts}/runtime-qa.json`, JSON.stringify(report, null, 2))
console.log('PASS A4 range, fixed geometry, long-name validation, teacher ambiguity, future blanks, missing QR')
