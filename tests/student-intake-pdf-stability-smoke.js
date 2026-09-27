import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'
import {
  STUDENT_INTAKE_ADMIN_TEMPLATE_SHA256,
  STUDENT_INTAKE_ADMIN_FIELD_BOXES,
  createStudentIntakeAdminOverlayPlan,
  createStudentIntakeAdminPdfProjection,
  generateStudentIntakeAdminPdf,
} from '../src/student-intake-admin-pdf.js'

// Offline fixtures only. No session, Supabase client or business-data writes.
const root = process.env.STUDENT_PDF_QA_MODULE_ROOT
if (!root) throw new Error('Set STUDENT_PDF_QA_MODULE_ROOT to the local renderer node_modules with @napi-rs/canvas and pdfjs-dist.')
const { createCanvas } = await import(pathToFileURL(path.join(root, '@napi-rs/canvas/index.js')).href)
const pdfjs = await import(pathToFileURL(path.join(root, 'pdfjs-dist/legacy/build/pdf.mjs')).href)
const documentRef = {
  fonts: { ready: Promise.resolve(), load: async () => [], check: () => true },
  createElement(tag) {
    assert.equal(tag, 'canvas')
    const canvas = createCanvas(1, 1)
    canvas.toBlob = (callback) => callback(new Blob([canvas.toBuffer('image/png')]))
    return canvas
  },
}
const template = fs.readFileSync('public/forms/student-intake/student-information-admin-template.pdf')
assert.equal(createHash('sha256').update(template).digest('hex'), STUDENT_INTAKE_ADMIN_TEMPLATE_SHA256)
const fetchImpl = async () => ({ ok: true, arrayBuffer: async () => template.buffer.slice(template.byteOffset, template.byteOffset + template.byteLength) })
const render = async (bytes) => {
  const loading = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
  const pdf = await loading.promise
  assert.equal(pdf.numPages, 1)
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  await loading.destroy()
  return canvas
}
const measuring = createCanvas(1, 1).getContext('2d')
const measure = (value, size) => {
  measuring.font = `normal ${size}px "Times New Roman", Times, serif`
  return measuring.measureText(value)
}
const base = {
  id: 'pdf-fixture', fullName: 'Nguyễn Gia Bảo', birthDate: '2018-03-12', schoolName: 'Nguyễn Du',
  schoolGrade: 'Lớp 3', homeName: 'Bắp', registrationDate: '2026-09-26', hobbies: 'Cờ vua, Lego',
  personality: 'Bé vui vẻ, tập trung và thích khám phá cách giải mới.',
  parentGoal: 'Rèn tư duy logic, tính kiên nhẫn và sự tự tin cho bé.',
  fatherName: 'Nguyễn Văn An', fatherPhone: '0901001001', motherName: 'Trần Thị Bích',
  motherPhone: '0902002002', parentArea: 'Quận 3, TP.HCM',
}
const cases = {
  normal: base,
  'long-vietnamese-name': { ...base, fullName: 'Nguyễn Trần Hoàng Minh Anh Phương' },
  'long-school': { ...base, schoolName: 'Trường Tiểu học Nguyễn Thị Minh Khai' },
  'long-parent-comment': { ...base, personality: 'Bé thích khám phá, tìm nhiều cách giải một bài tập và chia sẻ với bạn. Bé cần thêm thời gian để làm quen với nhóm mới. Phụ huynh mong giáo viên hỗ trợ bé tập trung và giữ sự tự tin khi gặp bài khó.' },
  'long-parent-goal': { ...base, parentGoal: 'Phụ huynh mong bé rèn luyện tư duy logic, tính kiên nhẫn, khả năng tự lập và tinh thần hợp tác. Bé học cách suy nghĩ trước khi quyết định, tôn trọng bạn cùng lớp, bình tĩnh khi thua và tự tin khi trình bày cách giải.' },
  'missing-optional': { id: 'empty-fixture', fullName: 'Bé An', birthDate: '2018-03-12', schoolName: 'Nguyễn Du' },
  male: { ...base, gender: 'male', priorChessKnowledge: 'known' },
  female: { ...base, gender: 'female', priorChessKnowledge: 'not_known' },
}
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-student-pdf-stability-'))
const original = await render(template)
fs.writeFileSync(path.join(artifacts, 'approved-template.png'), original.toBuffer('image/png'))
const originalPixels = original.getContext('2d').getImageData(0, 0, original.width, original.height).data
for (const [name, fixture] of Object.entries(cases)) {
  const projection = createStudentIntakeAdminPdfProjection(fixture)
  const plan = createStudentIntakeAdminOverlayPlan(projection, measure)
  const allowed = plan.map((command) => command.type === 'text'
    ? STUDENT_INTAKE_ADMIN_FIELD_BOXES[command.field] : command)
  const mask = new Uint8Array(original.width * original.height)
  for (const box of allowed) {
    for (let y = Math.floor(box.y * 2) - 2; y <= Math.ceil((box.y + box.height) * 2) + 2; y++) {
      for (let x = Math.floor(box.x * 2) - 2; x <= Math.ceil((box.x + box.width) * 2) + 2; x++) mask[y * original.width + x] = 1
    }
  }
  for (const command of plan.filter((entry) => entry.type === 'text')) {
    const box = command.box
    const metrics = measure(command.value, command.fontSize)
    assert(command.fontSize >= box.minFontSize && command.fontSize <= box.maxFontSize)
    assert(metrics.width <= box.width)
    assert(command.baseline - metrics.actualBoundingBoxAscent >= box.y)
    assert(command.baseline + metrics.actualBoundingBoxDescent <= box.y + box.height)
  }
  const result = await generateStudentIntakeAdminPdf(fixture, { documentRef, fetchImpl, baseUrl: '/' })
  const bytes = new Uint8Array(await result.blob.arrayBuffer())
  const pdf = await PDFDocument.load(bytes)
  assert.equal(pdf.getPageCount(), 1)
  assert.deepEqual(pdf.getPage(0).getMediaBox(), { x: 0, y: 0, width: 595.56, height: 842.04 })
  assert.deepEqual(pdf.getPage(0).getCropBox(), pdf.getPage(0).getMediaBox())
  const canvas = await render(bytes)
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  let outsideChanges = 0
  let insideChanges = 0
  for (let i = 0; i < mask.length; i++) {
    const offset = i * 4
    const differs = [0, 1, 2].some((channel) => Math.abs(pixels[offset + channel] - originalPixels[offset + channel]) > 12)
    if (differs) mask[i] ? insideChanges++ : outsideChanges++
  }
  assert(insideChanges > 0, `${name}: overlay must actually render`)
  assert.equal(outsideChanges, 0, `${name}: pixels outside approved field regions changed`)
  fs.writeFileSync(path.join(artifacts, `${name}.pdf`), bytes)
  fs.writeFileSync(path.join(artifacts, `${name}.png`), canvas.toBuffer('image/png'))
  console.log(`PASS ${name}: 1 page; geometry preserved; no pixels outside fields; fonts ${[...new Set(plan.filter(c => c.type === 'text').map(c => c.fontSize))].join('/')}`)
}
for (const field of ['fullName', 'schoolName', 'fatherName', 'personality', 'parentGoal']) {
  await assert.rejects(generateStudentIntakeAdminPdf({ ...base, [field]: 'Nội dung rất dài '.repeat(200) }, {
    documentRef, fetchImpl, baseUrl: '/',
  }), (error) => error.field === field && error.name === 'StudentIntakePdfValidationError')
}
await assert.rejects(generateStudentIntakeAdminPdf(base, { documentRef, fetchImpl: async () => ({ ok: true,
  arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }) }), /không khớp bản đã duyệt/)
console.log(`STUDENT_PDF_ARTIFACTS=${artifacts}`)
console.log('STUDENT_INTAKE_PDF_STABILITY: PASS (8 rendered fixtures; 5 explicit overflows; template rejection)')
