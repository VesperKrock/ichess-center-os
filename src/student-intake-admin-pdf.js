import { formatOperatorDate, parseCanonicalDateParts } from './operator-date-format.js'
import { formatStudentBirthInformation } from './student-birth-information.js'

export const STUDENT_INTAKE_ADMIN_TEMPLATE_PATH =
  'forms/student-intake/student-information-admin-template.pdf'
export const STUDENT_INTAKE_ADMIN_TEMPLATE_SHA256 =
  '42df7f6fc5587b21153b7175a8b4795a24f91301cb2a874788b521e9d91c6855'

export const STUDENT_INTAKE_ADMIN_MAPPING_VERSION = 'student-intake-template-v1-field-boxes-v1'
export const STUDENT_INTAKE_ADMIN_TEMPLATE_GEOMETRY = Object.freeze({
  pageCount: 1,
  width: 595.56, height: 842.04,
  mediaBox: Object.freeze({ x: 0, y: 0, width: 595.56, height: 842.04 }),
  cropBox: Object.freeze({ x: 0, y: 0, width: 595.56, height: 842.04 }),
})
const overlayScale = 4
const dataFontSize = 14
const dataFontFamily = '"Times New Roman", Times, serif'
const dataFontCss = `${dataFontSize}px ${dataFontFamily}`

const fixedFields = [
  { key: 'fullName', label: 'Họ và tên học viên', x: 129, baseline: 166.34, maxWidth: 174 },
  { key: 'birthDate', label: 'Ngày sinh', x: 437, baseline: 166.34, maxWidth: 101 },
  { key: 'schoolName', label: 'Tên trường', x: 129, baseline: 194.78, maxWidth: 174 },
  { key: 'schoolGrade', label: 'Đang học lớp', x: 398, baseline: 194.78, maxWidth: 140 },
  { key: 'homeName', label: 'Tên ở nhà', x: 124, baseline: 223.22, maxWidth: 176 },
  { key: 'registrationDate', label: 'Ngày đăng ký', x: 142, baseline: 251.66, maxWidth: 396 },
  { key: 'hobbies', label: 'Sở thích', x: 106, baseline: 280.13, maxWidth: 432 },
  { key: 'fatherName', label: 'Họ và tên ba', x: 132, baseline: 597.43, maxWidth: 190 },
  { key: 'fatherPhone', label: 'SĐT ba', x: 361, baseline: 597.43, maxWidth: 177 },
  { key: 'motherName', label: 'Họ và tên mẹ', x: 136, baseline: 625.9, maxWidth: 186 },
  { key: 'motherPhone', label: 'SĐT mẹ', x: 361, baseline: 625.9, maxWidth: 177 },
  { key: 'parentArea', label: 'Nơi ở hiện tại', x: 140, baseline: 654.34, maxWidth: 397 },
].map((field) => Object.freeze({
  ...field, y: field.baseline - 14, width: field.maxWidth, height: 18,
  font: dataFontFamily, maxFontSize: dataFontSize, minFontSize: 10,
  alignment: 'left', maxLines: 1, overflowPolicy: 'fit-or-error',
}))

const multilineFields = [
  {
    key: 'personality',
    label: 'Nhận xét của phụ huynh về tính cách của bé',
    x: 55,
    baselines: [355.49, 373.97, 392.57, 411.17],
    maxWidth: 484,
  },
  {
    key: 'parentGoal',
    label: 'Mong muốn của phụ huynh',
    x: 55,
    baselines: [467.95, 486.55, 505.15, 523.75],
    maxWidth: 484,
  },
].map((field) => Object.freeze({
  ...field, baselines: Object.freeze(field.baselines), y: field.baselines[0] - 14,
  width: field.maxWidth, height: field.baselines.at(-1) - field.baselines[0] + 18,
  font: dataFontFamily, maxFontSize: dataFontSize, minFontSize: 11,
  alignment: 'top-left', maxLines: field.baselines.length, overflowPolicy: 'fit-wrap-or-error',
}))

// All positions use PDF points, with y measured downward from the page top.
// The approved template, not the user's values, determines these regions.
export const STUDENT_INTAKE_ADMIN_FIELD_BOXES = Object.freeze(Object.fromEntries(
  [...fixedFields, ...multilineFields].map((field) => [field.key, field]),
))

const checkboxMarks = Object.freeze({
  gender: Object.freeze({
    male: Object.freeze({ x: 404.4, y: 217.7, width: 6.8, height: 7.2 }),
    female: Object.freeze({ x: 504.3, y: 217.7, width: 6.8, height: 7.2 }),
  }),
  priorChessKnowledge: Object.freeze({
    known: Object.freeze({ x: 307.2, y: 303.1, width: 6.8, height: 7.2 }),
    not_known: Object.freeze({ x: 451.1, y: 303.1, width: 6.8, height: 7.2 }),
  }),
})

export class StudentIntakePdfValidationError extends Error {
  constructor(message, field = '') {
    super(message)
    this.name = 'StudentIntakePdfValidationError'
    this.field = field
  }
}

export function createStudentIntakeAdminPdfProjection(student) {
  if (!student?.id) {
    throw new StudentIntakePdfValidationError(
      'Chỉ có thể xuất PDF từ hồ sơ học viên đã lưu.',
    )
  }

  const projection = {
    fullName: normalizeSingleLine(student.fullName),
    birthDate: formatStudentBirthInformation(student, ''),
    schoolName: normalizeSingleLine(student.schoolName),
    schoolGrade: normalizeSingleLine(student.schoolGrade),
    homeName: normalizeSingleLine(student.homeName),
    registrationDate: formatStudentDate(student.registrationDate),
    hobbies: normalizeSingleLine(student.hobbies),
    personality: normalizeMultiline(student.personality),
    parentGoal: normalizeMultiline(student.parentGoal),
    fatherName: normalizeSingleLine(student.fatherName),
    fatherPhone: formatPhoneNumber(student.fatherPhone),
    motherName: normalizeSingleLine(student.motherName),
    motherPhone: formatPhoneNumber(student.motherPhone),
    parentArea: normalizeSingleLine(student.parentArea),
    gender: normalizeGender(student.gender),
    priorChessKnowledge: normalizePriorChessKnowledge(student.priorChessKnowledge),
  }

  return Object.freeze(projection)
}

export function createStudentIntakeAdminOverlayPlan(projection, measureText) {
  if (typeof measureText !== 'function') {
    throw new TypeError('Cần hàm đo độ rộng văn bản để dàn trang PDF.')
  }

  const commands = []

  Object.values(STUDENT_INTAKE_ADMIN_FIELD_BOXES).forEach((field) => {
    const value = field.maxLines === 1 ? normalizeSingleLine(projection[field.key])
      : normalizeMultiline(projection[field.key])
    if (!value) return
    const { lines, fontSize } = fitFieldText(value, field, measureText)
    lines.forEach((line, index) => {
      commands.push({
        type: 'text', field: field.key, value: line, x: field.x,
        baseline: field.baselines?.[index] ?? field.baseline, fontSize,
        box: field,
      })
    })
  })

  const genderMark = checkboxMarks.gender[projection.gender]
  if (genderMark) commands.push({ type: 'mark', field: 'gender', ...genderMark })

  const knowledgeMark = checkboxMarks.priorChessKnowledge[projection.priorChessKnowledge]
  if (knowledgeMark) commands.push({ type: 'mark', field: 'priorChessKnowledge', ...knowledgeMark })

  return Object.freeze(commands.map((command) => Object.freeze(command)))
}

export async function generateStudentIntakeAdminPdf(student, options = {}) {
  const projection = createStudentIntakeAdminPdfProjection(student)
  const documentRef = options.documentRef ?? globalThis.document
  const fetchImpl = options.fetchImpl ?? globalThis.fetch

  if (!documentRef?.createElement || typeof fetchImpl !== 'function') {
    throw new Error('Trình duyệt hiện tại không hỗ trợ xuất PDF hồ sơ học viên.')
  }

  await ensureTimesNewRomanReady(documentRef)

  const templateUrl = resolveTemplateUrl(options.baseUrl)
  const response = await fetchImpl(templateUrl, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error('Không tải được mẫu Phiếu thông tin học viên đã duyệt.')
  }

  const templateBytes = new Uint8Array(await response.arrayBuffer())
  const templateHash = await getSha256(templateBytes)
  if (templateHash !== STUDENT_INTAKE_ADMIN_TEMPLATE_SHA256) {
    throw new Error('Mẫu PDF học viên không khớp bản đã duyệt. Không xuất tệp.')
  }

  const { PDFDocument, rgb } = await import('pdf-lib')
  const pdfDocument = await PDFDocument.load(templateBytes, { updateMetadata: false })
  if (pdfDocument.getPageCount() !== 1) {
    throw new Error('Mẫu PDF học viên phải có đúng một trang.')
  }

  const page = pdfDocument.getPage(0)
  const { width, height } = page.getSize()
  assertStudentIntakeTemplateGeometry(page)

  const canvas = documentRef.createElement('canvas')
  canvas.width = Math.round(width * overlayScale)
  canvas.height = Math.round(height * overlayScale)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Không khởi tạo được lớp dữ liệu PDF trong trình duyệt.')
  }

  configureDataFont(context)
  const plan = createStudentIntakeAdminOverlayPlan(
    projection,
    (value, fontSize) => {
      context.font = `normal ${fontSize}px ${dataFontFamily}`
      return context.measureText(value)
    },
  )
  drawOverlayPlan(context, plan)

  const overlayBytes = new Uint8Array(await canvasToPngArrayBuffer(canvas))
  const overlayImage = await pdfDocument.embedPng(overlayBytes)
  page.drawImage(overlayImage, { x: 0, y: 0, width, height })
  plan.filter((command) => command.type === 'mark').forEach((mark) => {
    const line = { thickness: 0.9, color: rgb(0.07, 0.07, 0.07) }
    page.drawLine({ ...line, start: { x: mark.x, y: height - mark.y },
      end: { x: mark.x + mark.width, y: height - mark.y - mark.height } })
    page.drawLine({ ...line, start: { x: mark.x, y: height - mark.y - mark.height },
      end: { x: mark.x + mark.width, y: height - mark.y } })
  })

  const outputBytes = await pdfDocument.save()
  return {
    blob: new Blob([outputBytes], { type: 'application/pdf' }),
    fileName: createOutputFileName(projection.fullName),
    pageCount: 1,
    pageSize: Object.freeze({ width, height }),
    templateHash,
    mappingVersion: STUDENT_INTAKE_ADMIN_MAPPING_VERSION,
    projection,
    commandCount: plan.length,
  }
}

function resolveTemplateUrl(baseUrl = import.meta.env?.BASE_URL ?? '/') {
  const normalizedBase = String(baseUrl || '/').endsWith('/')
    ? String(baseUrl || '/')
    : `${String(baseUrl || '/')}/`
  return `${normalizedBase}${STUDENT_INTAKE_ADMIN_TEMPLATE_PATH}`
}

async function ensureTimesNewRomanReady(documentRef) {
  if (!documentRef.fonts?.ready || typeof documentRef.fonts.load !== 'function') {
    throw new Error('Trình duyệt không thể xác nhận phông Times New Roman cho PDF.')
  }

  await documentRef.fonts.ready
  const sample = 'Tiếng Việt: Nguyễn Gia Bảo'
  await documentRef.fonts.load(dataFontCss, sample)
  if (typeof documentRef.fonts.check === 'function' && !documentRef.fonts.check(dataFontCss, sample)) {
    throw new Error('Thiết bị chưa có phông Times New Roman cần cho mẫu PDF.')
  }
}

function configureDataFont(context) {
  context.scale(overlayScale, overlayScale)
  context.fillStyle = '#111111'
  context.font = `normal ${dataFontSize}px ${dataFontFamily}`
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
}

function drawOverlayPlan(context, plan) {
  plan.forEach((command) => {
    if (command.type === 'mark') return // Vector lines are drawn into the PDF itself.
    context.font = `normal ${command.fontSize}px ${dataFontFamily}`
    context.fillText(command.value, command.x, command.baseline)
  })
}

function wrapText(value, field, measureText) {
  const lines = []
  const paragraphs = value.split('\n')

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (!words.length) {
      if (paragraphIndex < paragraphs.length - 1) lines.push('')
      return
    }

    let currentLine = ''
    words.forEach((word) => {
      if (measureText(word) > field.maxWidth) {
        throw new StudentIntakePdfValidationError(
          `Nội dung trường “${field.label}” có một từ quá dài so với mẫu PDF.`,
          field.key,
        )
      }

      const candidate = currentLine ? `${currentLine} ${word}` : word
      if (measureText(candidate) <= field.maxWidth) {
        currentLine = candidate
      } else {
        lines.push(currentLine)
        currentLine = word
      }
    })
    if (currentLine) lines.push(currentLine)
  })

  return lines
}

function fitFieldText(value, field, measureText) {
  for (let fontSize = field.maxFontSize; fontSize >= field.minFontSize; fontSize -= 0.5) {
    const measure = (text) => {
      const metrics = measureText(text, fontSize)
      return typeof metrics === 'number' ? { width: metrics } : metrics
    }
    let lines
    try {
      lines = field.maxLines === 1 ? [value] : wrapText(value, field, (text) => measure(text).width)
    } catch (error) {
      if (!(error instanceof StudentIntakePdfValidationError)) throw error
      continue
    }
    if (lines.length > field.maxLines) continue
    const fits = lines.every((text, index) => {
      const metrics = measure(text)
      const baseline = field.baselines?.[index] ?? field.baseline
      const ascent = metrics.actualBoundingBoxAscent ?? fontSize
      const descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.25
      return Number.isFinite(metrics.width) && metrics.width <= field.width
        && baseline - ascent >= field.y && baseline + descent <= field.y + field.height
    })
    if (fits) return { lines, fontSize }
  }
  throw new StudentIntakePdfValidationError(
    `Không thể điền đầy đủ trường “${field.label}” trong vùng của mẫu PDF ở cỡ chữ đọc được. Hãy kiểm tra nội dung trước khi xuất. Không có dữ liệu nào bị cắt hoặc đổi.`,
    field.key,
  )
}

export function assertStudentIntakeTemplateGeometry(page) {
  const tolerance = 0.02
  const expected = STUDENT_INTAKE_ADMIN_TEMPLATE_GEOMETRY
  const size = page.getSize()
  const same = (actual, wanted) => Object.entries(wanted)
    .every(([key, value]) => Number.isFinite(actual[key]) && Math.abs(actual[key] - value) <= tolerance)
  if (!same(size, { width: expected.width, height: expected.height })
    || !same(page.getMediaBox(), expected.mediaBox) || !same(page.getCropBox(), expected.cropBox)) {
    throw new Error('Kích thước mẫu PDF học viên không khớp bản đã duyệt.')
  }
}

async function getSha256(bytes) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Trình duyệt không hỗ trợ kiểm tra an toàn mẫu PDF.')
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function canvasToPngArrayBuffer(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Không tạo được lớp dữ liệu trong suốt cho PDF.'))
        return
      }

      resolve(await blob.arrayBuffer())
    }, 'image/png')
  })
}

function normalizeSingleLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeMultiline(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .trim()
}

function formatStudentDate(value) {
  const source = normalizeSingleLine(value)
  if (!source) return ''
  return parseCanonicalDateParts(source) ? formatOperatorDate(source) : ''
}

function formatPhoneNumber(value) {
  const source = normalizeSingleLine(value)
  const digits = source.replace(/\D/g, '')
  if (!source || digits.length !== 10) return source
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
}

function normalizeGender(value) {
  const normalized = normalizeSingleLine(value).toLowerCase()
  if (['male', 'nam'].includes(normalized)) return 'male'
  if (['female', 'nữ', 'nu'].includes(normalized)) return 'female'
  return ''
}

function normalizePriorChessKnowledge(value) {
  const normalized = normalizeSingleLine(value).toLowerCase()
  if (['known', 'yes', 'true', 'đã biết'].includes(normalized)) return 'known'
  if (['not_known', 'no', 'false', 'chưa biết'].includes(normalized)) return 'not_known'
  return ''
}

function createOutputFileName(fullName) {
  const slug = String(fullName || 'hoc-vien')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `phieu-thong-tin-hoc-vien-${slug || 'hoc-vien'}.pdf`
}
