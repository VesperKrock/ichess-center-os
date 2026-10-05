// Reference-artifact export only. Production TBHP/Receipt code is unchanged.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { PDFDocument, PDFRawStream, PDFName, decodePDFRawStream, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { makeA5Notice } from './tuition-notice-a5-fixtures.js'
import { generateTuitionNoticePdf, TUITION_NOTICE_TEMPLATE_SHA256 } from '../src/tuition-notice-pdf.js'
import { TUITION_NOTICE_A5_LAYOUT } from '../src/tuition-notice-a5-layout.js'

const folder = 'artifacts/l2-1-tbhp'
fs.mkdirSync(folder, { recursive: true })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const authority = 'public/forms/tuition-notice/tuition-notice-template.pdf'
const target = 'docs/business-reference/tuition-notice/tuition-notice-sample.pdf'
const backup = `${folder}/tuition-notice-sample-before-corrupt.pdf`
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup)
const notice = makeA5Notice(16)
notice.issuedAt = notice.snapshot.issuedAt = '2026-10-05T08:00:00+07:00'
Object.assign(notice.snapshot.student, { name: 'Nguyễn Hoàng Minh Anh', birthDate: '2018-08-12' })
Object.assign(notice.snapshot.center, { name: 'iChess Vinhomes Grand Park', phone: '090 1197 260' })
notice.snapshot.paymentWindow = { from: '', to: '2026-10-10' }
notice.snapshot.money = { tuitionAmount: 2500000, discountAmount: 125000, materialFee: 0, totalAmount: 2375000 }
notice.snapshot.transfer.content = 'HPCV Nguyen Hoang Minh Anh VHGP'
const options = { baseUrl: '/', fetchImpl: async url => new Response(fs.readFileSync(`public/${String(url).replace(/^\//, '')}`)) }
assert.equal(hash(fs.readFileSync(authority)), TUITION_NOTICE_TEMPLATE_SHA256)
const runtime = await generateTuitionNoticePdf(notice, { ...options, generatedDate: '2026-10-05',
  forecastFacts: { packageSessions: 16, usedSessions: 15, weekdays: ['sat', 'sun'] } })
const runtimeBytes = new Uint8Array(await runtime.blob.arrayBuffer())
fs.writeFileSync(`${folder}/sample-runtime.pdf`, runtimeBytes)
const pdf = await PDFDocument.load(runtimeBytes)
const page = pdf.getPage(0), box = TUITION_NOTICE_A5_LAYOUT.fields.discount
let replaced = 0
// The approved reference states 5%; production intentionally presents the exact
// discount amount. Replace that one sample annotation in the SAME runtime box,
// without changing production formatting, artwork, payment or field geometry.
const contents = page.node.Contents().asArray().map(ref => {
  const stream = pdf.context.lookup(ref)
  const text = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1')
  const clean = text.replace(/BT\b[\s\S]*?\bET/g, block => {
    const tm = block.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/)
    if (!tm || Math.abs(Number(tm[1]) - box.x) > 0.001
      || Math.abs(Number(tm[2]) - (page.getHeight() - box.baseline)) > 0.001) return block
    replaced++
    return ''
  })
  return clean === text ? ref : pdf.context.register(pdf.context.flateStream(clean))
})
assert.equal(replaced, 1, 'Exactly one runtime discount annotation replaced in sample')
page.node.set(PDFName.of('Contents'), pdf.context.obj(contents))
pdf.registerFontkit(fontkit)
const font = await pdf.embedFont(fs.readFileSync('public/forms/tuition-receipt/fonts/Tinos-Bold.ttf'), { subset: true })
assert.equal(notice.snapshot.money.discountAmount, notice.snapshot.money.tuitionAmount * 0.05)
assert(font.widthOfTextAtSize('(Giảm 5%)', box.fontSize) <= box.width)
page.drawText('(Giảm 5%)', { x: box.x, y: page.getHeight() - box.baseline, font, size: box.fontSize, color: rgb(...box.color) })
const bytes = new Uint8Array(await pdf.save({ useObjectStreams: false }))
fs.writeFileSync(`${folder}/sample-reexport.pdf`, bytes)

async function integrity(input) {
  const doc = await PDFDocument.load(input)
  const bad = []
  let streams = 0
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue
    streams++
    try { decodePDFRawStream(obj).decode() } catch (error) { bad.push({ object: ref.toString(), error: String(error) }) }
  }
  return { sha256: hash(input), pageCount: doc.getPageCount(), geometry: doc.getPage(0).getSize(), streams, invalidStreams: bad }
}
const production = await integrity(fs.readFileSync(authority)), sample = await integrity(bytes)
assert.equal(production.invalidStreams.length, 0)
assert.equal(sample.invalidStreams.length, 0)
assert.equal(sample.pageCount, 1)
assert.deepEqual(sample.geometry, { width: 419.5276, height: 595.2756 })
const dependencies = path.join(os.tmpdir(), 'ichess-tuition-pdf-render-270927/node_modules')
const { createCanvas } = await import(pathToFileURL(path.join(dependencies, '@napi-rs/canvas/index.js')))
const pdfjs = await import(pathToFileURL(path.join(dependencies, 'pdfjs-dist/legacy/build/pdf.mjs')))
// PDF.js transfers ownership of its input buffer. Keep export bytes intact.
const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise
assert.equal(doc.numPages, 1)
const samplePage = await doc.getPage(1), viewport = samplePage.getViewport({ scale: 3 })
const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
await samplePage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
fs.writeFileSync(`${folder}/sample-reexport.png`, canvas.toBuffer('image/png'))
const items = (await samplePage.getTextContent()).items.filter(item => item.str?.trim())
const text = items.map(item => item.str).join(' ')
for (const value of ['Nguyễn Hoàng Minh Anh', '12/08/2018', '16 buổi', 'iChess Vinhomes Grand Park',
  '10/10/2026', '2.500.000 VNĐ', '(Giảm 5%)', '2.375.000 VNĐ', 'Chủ Nhật, 11/10/2026',
  '442228866', 'CÔNG TY TNHH ICHESS VIET NAM', 'Ngân hàng: ACB']) assert(text.includes(value), `Sample fact missing: ${value}`)
assert.equal(items.filter(item => item.str.includes('090 1197 260')).length, 2)
assert(!text.includes('125.000 VNĐ'), 'Sample does not show duplicate amount/percentage discount')
assert(!/Ngày học|Giáo viên|Tiến độ/.test(text))
for (const item of items) {
  assert(item.transform[4] >= 0 && item.transform[4] + item.width <= 419.5276 + 0.1)
  for (const other of items.filter(other => other !== item && Math.abs(other.transform[5] - item.transform[5]) < 0.2 && other.transform[4] > item.transform[4])) {
    assert(item.transform[4] + item.width <= other.transform[4] + 0.6, `Sample overlap: ${item.str} / ${other.str}`)
  }
}
const jsQR = (await import(pathToFileURL(path.join(os.tmpdir(), 'ichess-tbc-qr-qa/node_modules/jsqr/dist/jsQR.js')))).default
const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
assert(jsQR(pixels.data, canvas.width, canvas.height)?.data.includes('442228866'))
let installedSampleIntegrity = null
if (process.argv.includes('--write-approved-sample')) {
  assert(bytes.length > 0)
  fs.writeFileSync(target, bytes)
  const installedBytes = fs.readFileSync(target)
  assert(installedBytes.equals(Buffer.from(bytes)), 'Installed reference equals validated export bytes')
  installedSampleIntegrity = await integrity(installedBytes)
  assert.equal(installedSampleIntegrity.sha256, sample.sha256)
  assert.equal(installedSampleIntegrity.invalidStreams.length, 0)
}
const report = { production, corruptBefore: await integrity(fs.readFileSync(backup)), sample,
  representativeValues: notice.snapshot, discountDisplay: '(Giảm 5%)', runtimeSource: 'generateTuitionNoticePdf',
  productionRendererChanged: false, receiptFilesChanged: false,
  installed: process.argv.includes('--write-approved-sample'), installedSampleIntegrity, cleanParse: true, cleanRender: true,
  noClippingOrOverlap: true, hotlineBothPositions: true, companyQrScans: true }
fs.writeFileSync(`${folder}/sample-reexport-qa.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ passed: true, installed: report.installed, production, sample, corruptBeforeStreams: report.corruptBefore.invalidStreams.length }))
