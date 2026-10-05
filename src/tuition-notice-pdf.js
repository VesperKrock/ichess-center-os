import { TBHP_A5_PAGE, TUITION_NOTICE_A5_LAYOUT } from './tuition-notice-a5-layout.js'
import { formatStudentBirthInformation } from './student-birth-information.js'
import { forecastTuitionNotice, getTuitionNoticeGenerationDate, buildTuitionNoticeForecastLines } from './tuition-notice-forecast.js'

export const TUITION_NOTICE_TEMPLATE_PATH = 'forms/tuition-notice/tuition-notice-template.pdf'
export const TUITION_NOTICE_TEMPLATE_SHA256 = '23131e615eefe01028ae18f45375a6526bb9c27156131cc54a5147621fd47814'
export const TUITION_TRANSFER_QR_PATH = 'assets/payment/ichess-company-tuition-qr.png'
export const TUITION_NOTICE_HOTLINE_FALLBACK = '090 1197 260'
export const COMPANY_TUITION_PAYMENT_PROFILE = Object.freeze({
  accountNumber: '442228866', beneficiary: 'CÔNG TY TNHH ICHESS VIET NAM',
  bank: 'Ngân hàng TMCP Á Châu (ACB)',
})
// Licensed Times-compatible Vietnamese fonts shared with the Receipt renderer.
const FONT_ASSETS = Object.freeze({
  regular: { file: 'Tinos-Regular.ttf', sha256: '60a0e8ef0c04dd5dd69ffe91025fa2ae5836cbd35600a82ba031977557e2cb61' },
  bold: { file: 'Tinos-Bold.ttf', sha256: '393269dbab8899f938db19783eca5eac92eb431f7ae0ab45b8349ca895f1a06b' },
})
export class TuitionNoticePdfValidationError extends Error {
  constructor(message, field = '') { super(message); this.name = 'TuitionNoticePdfValidationError'; this.field = field }
}
export function createTuitionNoticePdfProjection(notice = {}, options = {}) {
  const snapshot = isPlainObject(notice.snapshot) ? notice.snapshot : null
  if (!isUuid(notice.id) || !snapshot || snapshot.noticeId !== notice.id || snapshot.documentType !== 'TUITION_NOTICE') {
    throw new TuitionNoticePdfValidationError('Chỉ có thể xuất PDF từ Thông báo học phí có dữ liệu chính thức hợp lệ.')
  }
  if (!['NEW_REGISTRATION', 'RENEWAL'].includes(snapshot.registration?.code)) {
    throw new TuitionNoticePdfValidationError('TBHP không xác định được loại kỳ học.', 'registration')
  }
  const center = snapshot.center || {}, student = snapshot.student || {}
  const tuition = snapshot.tuition || {}, money = snapshot.money || {}, transfer = snapshot.transfer || {}
  const paymentTruth = snapshot.paymentTruth || {}
  if (!['PAID', 'UNPAID'].includes(paymentTruth.status) || typeof paymentTruth.paidBeforeIChess !== 'boolean'
    || (paymentTruth.paidBeforeIChess && paymentTruth.status !== 'PAID')) {
    throw new TuitionNoticePdfValidationError('Chưa xác định được trạng thái thanh toán của kỳ học phí.', 'paymentTruth')
  }
  if (transfer.accountNumber !== COMPANY_TUITION_PAYMENT_PROFILE.accountNumber
    || transfer.beneficiary !== COMPANY_TUITION_PAYMENT_PROFILE.beneficiary || transfer.bank !== COMPANY_TUITION_PAYMENT_PROFILE.bank) {
    throw new TuitionNoticePdfValidationError('Hồ sơ chuyển khoản không khớp hồ sơ công ty đã duyệt.', 'transfer')
  }
  const totalSessions = positiveInteger(tuition.totalSessions, 'Số buổi gói')
  const projection = {
    noticeId: notice.id, issuedAt: requiredText(snapshot.issuedAt || notice.issuedAt, 'Ngày phát hành'),
    centerName: requiredText(center.name, 'Tên trung tâm'), centerPhone: String(center.phone ?? '').trim() || TUITION_NOTICE_HOTLINE_FALLBACK,
    studentName: requiredText(student.name, 'Học viên'), birthDate: formatStudentBirthInformation(student, '—'),
    totalSessions,
    termNumber: positiveInteger(tuition.termNumber ?? notice.targetTermNumber, 'Kỳ học phí'),
    paymentTo: optionalDate(snapshot.paymentWindow?.to, 'Hạn thanh toán'),
    paymentStatus: paymentTruth.status, paidBeforeIChess: paymentTruth.paidBeforeIChess,
    tuitionAmount: moneyValue(money.tuitionAmount, 'Học phí'), discountAmount: moneyValue(money.discountAmount, 'Ưu đãi'),
    materialFee: moneyValue(money.materialFee, 'Phí giáo trình'), totalAmount: moneyValue(money.totalAmount, 'Tổng cộng'),
    forecast: forecastTuitionNotice({ ...options.forecastFacts,
      generatedDate: options.generatedDate ?? getTuitionNoticeGenerationDate() }),
    transferContent: requiredText(transfer.content, 'Nội dung chuyển khoản'), transferProfile: COMPANY_TUITION_PAYMENT_PROFILE,
  }
  if (projection.totalAmount !== projection.tuitionAmount - projection.discountAmount + projection.materialFee) {
    throw new TuitionNoticePdfValidationError('Tổng tiền không khớp dữ liệu học phí.', 'money')
  }
  return Object.freeze(projection)
}
export function buildTuitionNoticePaymentCopy(p) {
  const paid = p.paymentStatus === 'PAID'
  return {
    request: paid ? (p.paidBeforeIChess ? 'Học phí kỳ này đã được thanh toán trước khi dùng iChess.' : 'Học phí kỳ này đã được thanh toán.')
      : `Quý phụ huynh vui lòng đóng học phí khóa mới${p.paymentTo ? `: trước ngày ${formatDate(p.paymentTo)}` : '.'}`,
    window: !paid && p.paymentTo ? `Hạn thanh toán: ${formatDate(p.paymentTo)}.` : [],
    showPaymentInstructions: !paid, title: paid ? 'Tình trạng thanh toán:' : 'Hình thức thanh toán:',
    footer: paid ? 'TRUNG TÂM CỜ VUA TRUYỀN CẢM HỨNG xác nhận học phí kỳ này đã được thanh toán.'
      : 'TRUNG TÂM CỜ VUA TRUYỀN CẢM HỨNG rất mong quý phụ huynh đóng học phí nêu trên đúng thời hạn.',
  }
}
export function buildTuitionNoticeNotes(p) {
  const makeup = 'Học viên được học bù trong khóa học nếu vắng học có thông báo (P).'
  return { paragraphs: [makeup, ...buildTuitionNoticeForecastLines(p.forecast)] }
}
export async function generateTuitionNoticePdf(notice, options = {}) {
  const projection = createTuitionNoticePdfProjection(notice, options)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') throw new Error('Trình duyệt hiện tại không hỗ trợ xuất PDF Thông báo học phí.')
  const templateBytes = await loadAsset(TUITION_NOTICE_TEMPLATE_PATH, fetchImpl, options.baseUrl)
  if (await sha256(templateBytes) !== TUITION_NOTICE_TEMPLATE_SHA256) throw new Error('Mẫu TBHP A5 không khớp bản đã duyệt.')
  const { PDFDocument, PDFName, decodePDFRawStream, rgb } = await import('pdf-lib')
  const template = await PDFDocument.load(templateBytes, { updateMetadata: false })
  if (template.getPageCount() !== 1) throw new Error('Mẫu TBHP A5 phải có đúng một trang.')
  const size = template.getPage(0).getSize()
  if (Math.abs(size.width - TBHP_A5_PAGE.width) > 0.02 || Math.abs(size.height - TBHP_A5_PAGE.height) > 0.02) {
    throw new Error('Mẫu TBHP không đúng khổ A5 đã duyệt.')
  }
  // Fresh catalog avoids carrying the source PDF's nonzero Root generation.
  const pdf = await PDFDocument.create()
  const [page] = await pdf.copyPages(template, [0])
  pdf.addPage(page)
  // Suppress only measured placeholder text in this hash-pinned template.
  // Preserve all artwork without opaque rectangles over its watermark.
  const content = new TextDecoder('latin1').decode(decodePDFRawStream(page.node.Contents()).decode())
  const paid = projection.paymentStatus === 'PAID'
  const slotBaselines = [387.0256, 373.8256, 360.6256, 282.3856, 112.1756]
  let removed = 0
  let clean = content.replace(/BT\b[\s\S]*?\bET/g, (block, offset) => {
    const tm = block.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/)
    if (!tm) return block
    const x = Number(tm[1]), y = Number(tm[2])
    const slot = slotBaselines.some(b => Math.abs(b - y) < 0.001) && !(x === 65.664 && y === 360.6256)
      || (paid && y >= 174.7 && y <= 269.15)
      || (paid && x === 0 && /73\.104 122\.2556 cm/.test(content.slice(Math.max(0, offset - 80), offset)))
    if (!slot) return block
    removed++
    return ''
  })
  if (removed !== (paid ? 17 : 8)) throw new Error('Các vùng dữ liệu TBHP A5 không khớp mẫu đã duyệt.')
  // All advisory bullets now wrap together in the existing notice area.
  clean = clean.replace(/n\s+60\.084 285\.3856 m[\s\S]*?f\*/, '')
  if (paid) {
    clean = clean.replace(/1 1 1 rg\s+n 285\.96 150\.1056 91\.44 91\.44 re f\*\s+q\s+72\.04 0 0 72\.04 295\.66 159\.8056 cm\s+\/FormXob\.e670f2ab4150a7972594039f3c5847f5 Do\s+Q/, '')
      .replace(/n 75\.864 (?:230\.3456|217\.0256|190\.6256|176\.7056) 2\.7 2\.7 re f\*/g, '')
      .replace(/n\s+60\.964 (?:258\.4656|244\.5456) m[\s\S]*?f\*/g, '')
  }
  page.node.set(PDFName.of('Contents'), pdf.context.register(pdf.context.flateStream(clean)))
  pdf.registerFontkit((await import('@pdf-lib/fontkit')).default)
  const fonts = Object.fromEntries(await Promise.all(Object.entries(FONT_ASSETS).map(async ([key, asset]) => {
    const bytes = await loadAsset(`forms/tuition-receipt/fonts/${asset.file}`, fetchImpl, options.baseUrl)
    if (await sha256(bytes) !== asset.sha256) throw new Error('Phông TBHP không khớp bản đã duyệt.')
    return [key, await pdf.embedFont(bytes, { subset: true })]
  })))
  const fields = {}
  const draw = (name, value, box = TUITION_NOTICE_A5_LAYOUT.fields[name]) => {
    const font = fonts[box.font]
    let fontSize = box.fontSize, lines
    for (;;) {
      lines = wrapText(value, font, fontSize, box.width)
      if (lines && lines.length <= box.maxLines) break
      if (fontSize === box.minFontSize) break
      fontSize = Math.max(box.minFontSize, fontSize - 0.25)
    }
    if (!lines || lines.length > box.maxLines || fontSize < box.minFontSize - 0.001) {
      throw new TuitionNoticePdfValidationError(`Nội dung ${name} không vừa vùng in đã duyệt.`, name)
    }
    lines.forEach((line, i) => {
      const width = font.widthOfTextAtSize(line, fontSize)
      page.drawText(line, { x: box.x + (box.align === 'center' ? (box.width - width) / 2 : 0),
        y: TBHP_A5_PAGE.height - box.baseline - i * box.lineHeight,
        size: fontSize, font, color: rgb(...(box.color || [0, 0, 0])) })
    })
    fields[name] = { ...box, fontSize, lines, value }
  }
  const p = projection, copy = buildTuitionNoticePaymentCopy(p)
  draw('studentName', p.studentName)
  draw('birthDate', p.birthDate)
  draw('sessionCount', String(p.totalSessions))
  draw('centerName', p.centerName)
  draw('dueDate', copy.request)
  draw('tuitionAmount', `HP khóa “${p.totalSessions} buổi”: ${formatMoney(p.tuitionAmount)} VNĐ${p.materialFee ? `; Phí giáo trình: ${formatMoney(p.materialFee)} VNĐ` : ''}`)
  draw('totalAmount', `${formatMoney(p.totalAmount)} VNĐ`)
  draw('discount', p.discountAmount ? `(Giảm ${formatMoney(p.discountAmount)} VNĐ)` : '')
  const notes = buildTuitionNoticeNotes(p)
  draw('note', notes.paragraphs.map(note => `• ${note}`))
  if (copy.showPaymentInstructions) draw('paymentContent', p.transferContent)
  else {
    draw('paymentStatus', copy.request)
    draw('paymentTitle', copy.title)
    draw('footer', copy.footer)
  }
  draw('contact', `Mọi thắc mắc vui lòng liên hệ: ${p.centerPhone}`)
  draw('hotline', p.centerPhone)
  pdf.setTitle(`Thông báo học phí — ${p.studentName}`)
  return {
    blob: new Blob([await pdf.save({ useObjectStreams: false })], { type: 'application/pdf' }),
    fileName: createFileName(p.studentName, p.issuedAt), pageCount: 1, projection,
    layout: { profile: 'TBHP_A5', page: TBHP_A5_PAGE, fields, qr: copy.showPaymentInstructions ? TUITION_NOTICE_A5_LAYOUT.qr : null },
  }
}
function wrapText(value, font, size, width) {
  // Paragraph boundaries are semantic note entries, never sample line breaks.
  if (Array.isArray(value)) {
    const paragraphs = value.map(text => wrapText(text, font, size, width))
    return paragraphs.some(lines => !lines) ? null : paragraphs.flat()
  }
  const singleLine = String(value ?? '').trim()
  if (!/[\u0000-\u001f\u007f]/.test(singleLine) && font.widthOfTextAtSize(singleLine, size) <= width) {
    return singleLine ? [singleLine] : []
  }
  const lines = [], words = normalizeText(value).split(' ').filter(Boolean)
  let line = ''
  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > width) return null
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}
async function loadAsset(path, fetchImpl, baseUrl = import.meta.env?.BASE_URL ?? '/') {
  const base = String(baseUrl || '/').replace(/\/?$/, '/')
  const response = await fetchImpl(`${base}${path}`, { cache: 'no-cache' })
  if (!response.ok) throw new Error('Không tải được tài nguyên TBHP đã duyệt.')
  return new Uint8Array(await response.arrayBuffer())
}
async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
function createFileName(studentName, issuedAt) {
  const slug = normalizeText(studentName).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `thong-bao-hoc-phi-${slug || 'hoc-vien'}-${String(issuedAt).slice(0, 10)}.pdf`
}
function formatMoney(value) { return new Intl.NumberFormat('vi-VN').format(value) }
function formatDate(value) { if (!value) return ''; const [year, month, day] = value.split('-'); return `${day}/${month}/${year}` }
function optionalDate(value, label) {
  const text = normalizeText(value)
  if (!text) return ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00Z`) : null
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new TuitionNoticePdfValidationError(`${label} không hợp lệ.`, label)
  return text
}
function positiveInteger(value, label) { const n = Number(value); if (value == null || !Number.isSafeInteger(n) || n < 1) throw new TuitionNoticePdfValidationError(`${label} không hợp lệ.`, label); return n }
function moneyValue(value, label) { const n = Number(value); if (value == null || !Number.isSafeInteger(n) || n < 0) throw new TuitionNoticePdfValidationError(`${label} không hợp lệ.`, label); return n }
function requiredText(value, label) { const text = normalizeText(value); if (!text) throw new TuitionNoticePdfValidationError(`Thiếu ${label} trong dữ liệu TBHP.`, label); return text }
function normalizeText(value) { return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() }
function isPlainObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim()) }
