import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import { makeA5Notice } from './tuition-notice-a5-fixtures.js'
import { generateTuitionNoticePdf, buildTuitionNoticeNotes } from '../src/tuition-notice-pdf.js'

const output = 'artifacts/l2-simple-tbhp/content-qa'
fs.mkdirSync(output, { recursive: true })
const dependencies = path.join(os.tmpdir(), 'ichess-tuition-pdf-render-270927/node_modules')
const { createCanvas } = await import(pathToFileURL(path.join(dependencies, '@napi-rs/canvas/index.js')))
const pdfjs = await import(pathToFileURL(path.join(dependencies, 'pdfjs-dist/legacy/build/pdf.mjs')))
const options = { baseUrl: '/', generatedDate: '2026-10-06',
  fetchImpl: async url => new Response(fs.readFileSync(`public/${String(url).replace(/^\//, '')}`)) }
const report = { cases: [], businessWrites: 0 }
const scenarios = [
  ['8-two-weekly', 8, 6, ['tue', 'thu']],
  ['16-two-weekly', 16, 14, ['tue', 'thu']],
  ['24-two-weekly', 24, 22, ['tue', 'thu']],
  ['16-one-weekly', 16, 14, ['thu']],
  ['16-no-cadence', 16, 14, []],
  ['16-unknown-progress', 16, null, ['tue', 'thu']],
  ['16-sunday', 16, 16, ['sun']],
]
for (const [name, packageSessions, usedSessions, weekdays] of scenarios) {
  const notice = makeA5Notice(packageSessions)
  notice.snapshot.center.phone = name.includes('one-weekly') ? '0365 998 894' : ''
  notice.snapshot.tuition.maxCompletionWeeks = 999 // Old hard deadline is ignored.
  notice.snapshot.notes = ['Thời gian tối đa hoàn thành khóa: 999 tuần.']
  const before = JSON.stringify(notice)
  const result = await generateTuitionNoticePdf(notice, { ...options, forecastFacts: { packageSessions, usedSessions, weekdays } })
  assert.equal(JSON.stringify(notice), before)
  const bytes = new Uint8Array(await result.blob.arrayBuffer())
  fs.writeFileSync(`${output}/${name}.pdf`, bytes)
  const pdf = await PDFDocument.load(bytes)
  assert.equal(pdf.getPageCount(), 1)
  assert.deepEqual(pdf.getPage(0).getSize(), { width: 419.5276, height: 595.2756 })
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise
  const page = await document.getPage(1), viewport = page.getViewport({ scale: 3 })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  fs.writeFileSync(`${output}/${name}.png`, canvas.toBuffer('image/png'))
  const items = (await page.getTextContent()).items.filter(item => item.str?.trim())
  const text = items.map(item => item.str).join(' ').replace(/\s+/g, ' ')
  const lines = buildTuitionNoticeNotes(result.projection).paragraphs
  for (const line of lines) assert(text.includes(line), `Missing advisory text: ${line}`)
  assert.equal(lines.length, !weekdays.length ? 1 : usedSessions == null ? 2 : 3)
  assert(!/tối đa|999 tuần|Ngày học|Giáo viên|Tiến độ|Buổi đã học/.test(text))
  if (name === '16-two-weekly') assert(text.includes('Thứ Năm, 15/10/2026.'))
  if (name === '16-one-weekly') assert(text.includes('khoảng 17 tuần.'))
  assert.equal(items.filter(item => item.str.includes(result.projection.centerPhone)).length, 2)
  assert(text.includes('442228866') && text.includes('CÔNG TY TNHH ICHESS VIET NAM'))
  for (const item of items) {
    assert(item.transform[4] >= 0 && item.transform[4] + item.width <= 419.6276)
    for (const other of items.filter(other => other !== item && Math.abs(other.transform[5] - item.transform[5]) < 0.2 && other.transform[4] > item.transform[4])) {
      assert(item.transform[4] + item.width <= other.transform[4] + 0.6, `Overlap: ${item.str} / ${other.str}`)
    }
  }
  const field = result.layout.fields.note
  assert(field.lines.length <= 5)
  assert(field.baseline + (field.lines.length - 1) * field.lineHeight < result.layout.page.height - 269.1456 - 3,
    'Notice stays above the existing payment section')
  assert.equal(field.fontSize, 9.96, 'Approved typography retained with natural wrapping')
  report.cases.push({ name, lines, forecast: result.projection.forecast, noteField: field, pageCount: 1, noClippingOrOverlap: true })
  console.log(`PASS ${name}: ${lines.length} advisory lines, one A5 page, natural wrapping`)
}
fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2))
