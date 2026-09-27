import { TBHP_A4_PAGE, selectTuitionNoticeA4Layout } from './tuition-notice-a4-layout.js'

export const TUITION_NOTICE_TEMPLATE_PATH = 'forms/tuition-notice/tuition-notice-a4-background.pdf'
export const TUITION_NOTICE_TEMPLATE_SHA256 = '2ef559a0d30597ca5d59ff1bc223586d1a3a200380c1ff5b598acf056ebd88a7'
export const TUITION_TRANSFER_QR_PATH = 'assets/payment/ichess-company-tuition-qr.png'
export const COMPANY_TUITION_PAYMENT_PROFILE = Object.freeze({
  accountNumber: '442228866', beneficiary: 'CÔNG TY TNHH ICHESS VIET NAM',
  bank: 'Ngân hàng TMCP Á Châu (ACB)',
})
const OVERLAY_SCALE = 3
const FONT_ASSETS = Object.freeze([
  { name: 'TBHP Lora', file: 'Lora-Regular.ttf', sha256: '80aac4498fe8b3c16c54ae820a72506c929ccaee96b92c226f915a901c857a96' },
  { name: 'TBHP Lora Bold', file: 'Lora-Bold.ttf', sha256: '2aba152528d3526cbb342d8564f19aa92ca9d2e71d2c7e98fec98c5c89558558' },
  { name: 'TBHP Lora Italic', file: 'Lora-Italic.ttf', sha256: '27aac8eaa1b9ca94554cdc2c7ae2799d4dcea72055b95bfdc7fdc450cf9a77a4' },
])
const FONT_FAMILIES = Object.freeze({
  regular: '"TBHP Lora"', bold: '"TBHP Lora Bold"', italic: '"TBHP Lora Italic"',
  contact: 'Arial, sans-serif',
})

export class TuitionNoticePdfValidationError extends Error {
  constructor(message, field = '') { super(message); this.name = 'TuitionNoticePdfValidationError'; this.field = field }
}

export function createTuitionNoticePdfProjection(notice = {}) {
  const snapshot = isPlainObject(notice.snapshot) ? notice.snapshot : null
  if (!isUuid(notice.id) || !snapshot || snapshot.noticeId !== notice.id
    || snapshot.documentType !== 'TUITION_NOTICE') {
    throw new TuitionNoticePdfValidationError('Chỉ có thể xuất PDF từ Thông báo học phí có dữ liệu chính thức hợp lệ.')
  }
  if (!['NEW_REGISTRATION', 'RENEWAL'].includes(snapshot.registration?.code)) {
    throw new TuitionNoticePdfValidationError('TBHP không xác định được loại kỳ học.', 'registration')
  }
  const center = isPlainObject(snapshot.center) ? snapshot.center : {}
  const student = isPlainObject(snapshot.student) ? snapshot.student : {}
  const tuition = isPlainObject(snapshot.tuition) ? snapshot.tuition : {}
  const progress = isPlainObject(snapshot.currentProgress) ? snapshot.currentProgress : {}
  const paymentWindow = isPlainObject(snapshot.paymentWindow) ? snapshot.paymentWindow : {}
  const money = isPlainObject(snapshot.money) ? snapshot.money : {}
  const transfer = isPlainObject(snapshot.transfer) ? snapshot.transfer : {}
  const totalSessions = positiveInteger(tuition.totalSessions, 'Số buổi gói')
  if (!selectTuitionNoticeA4Layout(totalSessions)) {
    throw new TuitionNoticePdfValidationError('TBHP A4 hiện hỗ trợ gói từ 1 đến 24 buổi.', 'totalSessions')
  }
  const scheduleRows = Array.isArray(snapshot.scheduleRows)
    ? snapshot.scheduleRows.map((row, index) => projectScheduleRow(row, index + 1)) : []
  if (scheduleRows.length !== totalSessions) {
    throw new TuitionNoticePdfValidationError(`Dữ liệu phải có đúng ${totalSessions} dòng lịch học.`, 'scheduleRows')
  }
  if (transfer.accountNumber !== COMPANY_TUITION_PAYMENT_PROFILE.accountNumber
    || transfer.beneficiary !== COMPANY_TUITION_PAYMENT_PROFILE.beneficiary
    || transfer.bank !== COMPANY_TUITION_PAYMENT_PROFILE.bank) {
    throw new TuitionNoticePdfValidationError('Hồ sơ chuyển khoản không khớp hồ sơ công ty đã duyệt.', 'transfer')
  }
  const projection = {
    noticeId: notice.id, issuedAt: requiredText(snapshot.issuedAt || notice.issuedAt, 'Ngày phát hành'),
    centerName: requiredText(center.name, 'Tên trung tâm'), centerAddress: normalizeText(center.address),
    centerPhone: normalizeText(center.phone), centerWebsite: normalizeText(center.website) || 'www.ichess.edu.vn',
    studentName: requiredText(student.name, 'Học viên'), packageName: requiredText(tuition.packageName, 'Gói học phí'),
    termNumber: positiveInteger(tuition.termNumber ?? notice.targetTermNumber, 'Kỳ học phí'),
    programName: normalizeText(tuition.programName), learningForm: normalizeText(tuition.learningForm), totalSessions,
    maxCompletionWeeks: tuition.maxCompletionWeeks == null ? null : positiveInteger(tuition.maxCompletionWeeks, 'Thời gian tối đa hoàn thành khóa'),
    currentUsedSessions: nonNegativeInteger(progress.usedSessions, 'Tiến độ hiện tại'),
    currentTotalSessions: positiveInteger(progress.totalSessions, 'Tổng buổi hiện tại'),
    paymentFrom: optionalDate(paymentWindow.from, 'Ngày bắt đầu thanh toán'),
    paymentTo: optionalDate(paymentWindow.to, 'Hạn thanh toán'),
    tuitionAmount: moneyValue(money.tuitionAmount, 'Học phí'), discountAmount: moneyValue(money.discountAmount, 'Ưu đãi'),
    materialFee: moneyValue(money.materialFee, 'Phí giáo trình'), totalAmount: moneyValue(money.totalAmount, 'Tổng cộng'),
    discountExplanation: normalizeText(money.discountExplanation),
    notes: Array.isArray(snapshot.notes) ? snapshot.notes.map(normalizeText).filter(Boolean) : [],
    transferContent: requiredText(transfer.content, 'Nội dung chuyển khoản'),
    transferProfile: COMPANY_TUITION_PAYMENT_PROFILE, scheduleRows,
  }
  if (projection.currentUsedSessions > projection.currentTotalSessions) {
    throw new TuitionNoticePdfValidationError('Tiến độ hiện tại không hợp lệ.', 'currentProgress')
  }
  if (projection.totalAmount !== projection.tuitionAmount - projection.discountAmount + projection.materialFee) {
    throw new TuitionNoticePdfValidationError('Tổng tiền không khớp dữ liệu học phí.', 'money')
  }
  return Object.freeze(projection)
}

export async function generateTuitionNoticePdf(notice, options = {}) {
  const projection = createTuitionNoticePdfProjection(notice)
  const layout = selectTuitionNoticeA4Layout(projection.totalSessions)
  const documentRef = options.documentRef ?? globalThis.document
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (!documentRef?.createElement || typeof fetchImpl !== 'function') {
    throw new Error('Trình duyệt hiện tại không hỗ trợ xuất PDF Thông báo học phí.')
  }
  const [templateBytes, qrBytes] = await Promise.all([
    loadAsset(TUITION_NOTICE_TEMPLATE_PATH, fetchImpl, options.baseUrl, 'Không tải được mẫu TBHP A4 đã duyệt.'),
    loadAsset(TUITION_TRANSFER_QR_PATH, fetchImpl, options.baseUrl, 'Không tải được ảnh QR công ty đã duyệt.'),
    ensureFonts(documentRef, fetchImpl, options),
  ])
  if (await sha256(templateBytes) !== TUITION_NOTICE_TEMPLATE_SHA256) throw new Error('Mẫu TBHP A4 không khớp bản đã duyệt.')
  const decodeImage = options.decodeImage || (bytes => globalThis.createImageBitmap(new Blob([bytes], { type: 'image/png' })))
  const qr = await decodeImage(qrBytes)
  if (qr.width < 300 || qr.height < 300 || Math.abs(qr.width / qr.height - 1) > 0.02) {
    throw new Error('Ảnh QR công ty chưa đủ sắc nét để in.')
  }
  const { PDFDocument } = await import('pdf-lib')
  const template = await PDFDocument.load(templateBytes, { updateMetadata: false })
  if (template.getPageCount() !== 1) throw new Error('Mẫu TBHP A4 phải có đúng một trang.')
  const size = template.getPage(0).getSize()
  if (Math.abs(size.width - TBHP_A4_PAGE.width) > 0.02 || Math.abs(size.height - TBHP_A4_PAGE.height) > 0.02) {
    throw new Error('Mẫu TBHP không đúng khổ A4 đã duyệt.')
  }
  const pdf = await PDFDocument.create()
  const [page] = await pdf.copyPages(template, [0])
  pdf.addPage(page)
  const { canvas, context } = createCanvas(documentRef)
  const renderedFields = drawDocument(context, projection, layout)
  const qrImage = await pdf.embedPng(qrBytes)
  const overlay = await pdf.embedPng(new Uint8Array(await canvasToPngArrayBuffer(canvas)))
  page.drawImage(overlay, { x: 0, y: 0, ...TBHP_A4_PAGE })
  // The golden QR includes a fixed white quiet zone around the unchanged asset.
  const inset = layout.qr.quietZone
  page.drawImage(qrImage, { x: layout.qr.x + inset, y: TBHP_A4_PAGE.height - layout.qr.y - layout.qr.height + inset,
    width: layout.qr.width - inset * 2, height: layout.qr.height - inset * 2 })
  qr.close?.()
  return {
    blob: new Blob([await pdf.save({ useObjectStreams: false })], { type: 'application/pdf' }),
    fileName: createFileName(projection.studentName, projection.issuedAt), pageCount: 1,
    rowCount: projection.totalSessions, projection,
    layout: { profile: layout.name, page: layout.page, table: layout.table, qr: layout.qr, fields: renderedFields },
  }
}

function drawDocument(context, p, layout) {
  const f = layout.fields
  const rendered = {}
  const draw = (name, value) => { rendered[name] = drawField(context, value, f[name], name) }
  draw('greeting', 'Mến chào phụ huynh;')
  draw('introduction', ['TRUNG TÂM CỜ VUA TRUYỀN CẢM HỨNG xin', 'phép thông báo học phí (HP) cờ vua:'])
  const labels = ['Học viên:', 'Khóa Học:', 'Hình thức:', 'Số buổi học:']
  labels.forEach((label, i) => {
    const baseline = layout.labels.baselines[i]
    drawText(context, '•', layout.labels.bulletX, baseline)
    drawText(context, label, layout.labels.textX, baseline)
  })
  draw('student', p.studentName)
  draw('package', `${p.packageName} · Kỳ ${p.termNumber}`)
  draw('center', `Cơ sở ${p.centerName}`)
  draw('progress', `${p.currentUsedSessions}/${p.currentTotalSessions} buổi`)
  draw('reminder', ['Nhằm đảm bảo lộ trình học tập xuyên suốt, thông báo',
    'học phí sẽ được gửi trước 07 ngày (tương đương 02', 'buổi) trước khi kết thúc khóa học hiện tại.'])
  draw('paymentRequest', ['Quý phụ huynh vui lòng thanh toán học phí', 'khóa mới:'])
  draw('paymentWindow', [`từ ngày ${formatDate(p.paymentFrom)} đến ngày`, p.paymentTo ? `${formatDate(p.paymentTo)}.` : ''])
  const money = [
    ['tuition', `Học phí khóa ${p.totalSessions} buổi:`, p.tuitionAmount],
    ['discount', 'Ưu đãi học phí:', p.discountAmount],
    ['material', 'Phí giáo trình:', p.materialFee], ['total', 'Tổng cộng:', p.totalAmount],
  ]
  money.forEach(([name, label, amount]) => {
    const box = f[name]
    setFont(context, box.fontSize, box.font)
    const offset = context.measureText(label + ' ').width
    drawText(context, label, box.x, box.baseline, box)
    drawText(context, `${formatMoney(amount)} VNĐ`, box.x + offset, box.baseline,
      { ...box, font: 'bold', color: '#ff0000', width: box.width - offset })
    rendered[name] = { ...box, lines: 1, fontSize: box.fontSize }
  })
  draw('notesTitle', 'Lưu ý:')
  drawText(context, '• Học viên ', f.makeup.x, f.makeup.baseline)
  setFont(context, 11, 'regular')
  const prefix = context.measureText('• Học viên ').width
  drawText(context, 'được học bù trong khóa học', f.makeup.x + prefix, f.makeup.baseline, { color: '#0000ff' })
  drawText(context, 'nếu vắng học có thông báo (P).', f.makeup.x, f.makeup.baseline + f.makeup.lineHeight, { color: '#0000ff' })
  draw('completion', ['• Đối với học viên học 2 buổi/tuần thời', p.maxCompletionWeeks
    ? `gian tối đa hoàn thành khóa học là ${p.maxCompletionWeeks} tuần.` : 'gian hoàn thành khóa học theo gói đã đăng ký.'])
  draw('paymentTitle', 'Hình thức thanh toán:')
  draw('cash', '• Trực tiếp tại trung tâm: Tiền mặt (TM).')
  draw('transferTitle', '• Chuyển khoản:')
  draw('account', `STK: ${p.transferProfile.accountNumber}`)
  draw('beneficiary', `Tên tài khoản: ${p.transferProfile.beneficiary}`)
  draw('bank', `Ngân hàng: ${p.transferProfile.bank}`)
  draw('transferContent', `Nội dung: ${p.transferContent}`)
  ;['account', 'beneficiary', 'bank', 'transferContent'].forEach(name => {
    const b = layout.bankBullet
    context.fillStyle = '#000000'
    context.fillRect(b.x, f[name].baseline + b.baselineOffset, b.size, b.size)
  })
  draw('footerRequest', ['TRUNG TÂM CỜ VUA TRUYỀN CẢM HỨNG rất mong quý phụ huynh đóng học phí nêu trên',
    `đúng thời hạn. Mọi thắc mắc vui lòng liên hệ: ${p.centerPhone}`])
  draw('thanks', 'Xin trân trọng cảm ơn sự tin tưởng và đồng hành của Quý phụ huynh và học viên!')
  draw('hotline', `Hotline: ${p.centerPhone}`)
  drawText(context, 'Website: ', f.website.x, f.website.baseline, f.website)
  setFont(context, f.website.fontSize, f.website.font)
  const websiteOffset = context.measureText('Website: ').width
  drawText(context, p.centerWebsite, f.website.x + websiteOffset, f.website.baseline,
    { ...f.website, width: f.website.width - websiteOffset, color: '#0000ff', underline: true })
  drawTable(context, p.scheduleRows, layout.table)
  return Object.freeze(rendered)
}

function drawTable(context, rows, table) {
  const { x, y, width, headerHeight, rowStep, columns, fontSize } = table
  const height = headerHeight + rows.length * rowStep
  context.save()
  context.strokeStyle = '#000000'
  context.lineWidth = table.borderWidth
  for (const cx of columns) { context.beginPath(); context.moveTo(cx, y); context.lineTo(cx, y + height); context.stroke() }
  for (const cy of [y, ...Array.from({ length: rows.length + 1 }, (_, i) => y + headerHeight + i * rowStep)]) {
    context.beginPath(); context.moveTo(x, cy); context.lineTo(x + width, cy); context.stroke()
  }
  const centers = columns.slice(0, -1).map((left, i) => (left + columns[i + 1]) / 2)
  ;['Buổi', 'Ngày học', 'Giáo viên'].forEach((label, i) => drawText(context, label, centers[i], table.headerBaseline,
    { fontSize, align: 'center' }))
  const teacherLabels = buildTuitionNoticeTeacherLabels(rows.map(row => row.source === 'ACTUAL' ? row : {}))
  rows.forEach((row, i) => {
    const baseline = table.firstRowBaseline + i * rowStep
    const actual = row.source === 'ACTUAL'
    const values = [String(row.sessionNumber), actual ? formatDate(row.date) : '', actual ? teacherLabels[i] : '']
    values.forEach((value, col) => drawText(context, value, centers[col], baseline,
      { fontSize, align: 'center', width: columns[col + 1] - columns[col] - table.padding * 2 }))
  })
  context.restore()
}

// Presentation-only labels from frozen occurrence facts, never live Teacher metadata.
export function buildTuitionNoticeTeacherLabels(rows) {
  const facts = rows.map(row => {
    const full = normalizeText(row.teacherName)
    const explicit = normalizeText(row.teacherDisplayName)
    const match = full.match(/^(Thầy|Cô)\s+(.+)$/u)
    const labelPrefix = explicit.match(/^(Thầy|Cô)\s+/u)?.[1]
    const prefix = match ? match[1] + ' ' : labelPrefix ? labelPrefix + ' ' : ''
    const words = (match ? match[2] : full).split(' ').filter(Boolean)
    const take = prefix.startsWith('Thầy') ? 1 : 2
    return { full, explicit, prefix, words, take, label: explicit || (prefix ? prefix + words.slice(-take).join(' ') : full) }
  })
  for (let iteration = 0; iteration < 12; iteration++) {
    const groups = new Map()
    facts.forEach(fact => { if (!fact.full) return; const group = groups.get(fact.label) || []; group.push(fact); groups.set(fact.label, group) })
    let changed = false
    for (const group of groups.values()) {
      if (new Set(group.map(fact => fact.full)).size < 2) continue
      group.forEach(fact => {
        if (fact.take >= fact.words.length) return
        fact.take++
        fact.label = fact.prefix + fact.words.slice(-fact.take).join(' ')
        changed = true
      })
    }
    if (!changed) break
  }
  for (const fact of facts) {
    if (facts.some(other => other.full !== fact.full && other.full && fact.full && other.label === fact.label)) {
      throw new TuitionNoticePdfValidationError('Tên giáo viên trên TBHP chưa đủ rõ để phân biệt.', 'scheduleRows')
    }
  }
  return facts.map(fact => fact.label)
}

function drawField(context, value, box, name) {
  let size = box.fontSize
  let lines = fitLines(context, value, box, size)
  if (!lines && box.fallbackSize) { size = box.fallbackSize; lines = fitLines(context, value, box, size) }
  const label = { student: 'tên học viên', center: 'tên cơ sở', package: 'gói học phí', transferContent: 'nội dung chuyển khoản' }[name] || 'TBHP'
  if (!lines) throw new TuitionNoticePdfValidationError(`Nội dung ${label} không vừa vùng in đã duyệt.`, name)
  lines.forEach((line, i) => drawText(context, line, box.align === 'center' ? box.x + box.width / 2 : box.x,
    box.baseline + i * box.lineHeight, { ...box, fontSize: size }))
  return { ...box, lines: lines.length, fontSize: size }
}

function fitLines(context, value, box, size) {
  setFont(context, size, box.font)
  if (Array.isArray(value)) {
    return value.length <= box.maxLines && value.every(line => context.measureText(line).width <= box.width) ? value : null
  }
  const words = normalizeText(value).split(' ').filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    if (context.measureText(word).width > box.width) return null
    const candidate = line ? line + ' ' + word : word
    if (context.measureText(candidate).width <= box.width) line = candidate
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines.length <= box.maxLines ? lines : null
}

function setFont(context, size, font = 'regular') {
  context.font = `${font === 'contact' ? 'bold ' : ''}${size}px ${FONT_FAMILIES[font]}`
}
function drawText(context, value, x, baseline, options = {}) {
  if (!value) return
  const fontSize = options.fontSize || 11
  setFont(context, fontSize, options.font || 'regular')
  const measured = context.measureText(value).width
  if (options.width && measured > options.width + 0.01) throw new TuitionNoticePdfValidationError('Nội dung không vừa vùng in TBHP đã duyệt.', 'layout')
  context.save()
  context.fillStyle = options.color || '#000000'
  context.textAlign = options.align || 'left'
  context.textBaseline = 'alphabetic'
  context.fillText(value, x, baseline)
  if (options.underline) {
    context.strokeStyle = context.fillStyle; context.lineWidth = 0.6
    const left = options.align === 'center' ? x - measured / 2 : x
    context.beginPath(); context.moveTo(left, baseline + 2); context.lineTo(left + measured, baseline + 2); context.stroke()
  }
  context.restore()
}

async function ensureFonts(documentRef, fetchImpl, options) {
  if (!documentRef.fonts?.ready || typeof documentRef.fonts.load !== 'function') throw new Error('Trình duyệt không thể tải phông TBHP đã duyệt.')
  const bytes = await Promise.all(FONT_ASSETS.map(async asset => {
    const data = await loadAsset(`forms/tuition-notice/fonts/${asset.file}`, fetchImpl, options.baseUrl, 'Không tải được phông TBHP đã duyệt.')
    if (await sha256(data) !== asset.sha256) throw new Error('Phông TBHP không khớp bản đã duyệt.')
    return data
  }))
  await documentRef.fonts.ready
  for (let i = 0; i < FONT_ASSETS.length; i++) {
    const name = FONT_ASSETS[i].name
    if (options.registerFont) await options.registerFont(bytes[i], name)
    else {
      const font = await new FontFace(name, bytes[i]).load()
      documentRef.fonts.add(font)
    }
    await documentRef.fonts.load(`11px "${name}"`, 'Tiếng Việt: Nguyễn Đình Chiểu')
    if (documentRef.fonts.check && !documentRef.fonts.check(`11px "${name}"`)) throw new Error('Chưa tải được phông TBHP đã duyệt.')
  }
}
async function loadAsset(path, fetchImpl, baseUrl, message) {
  const response = await fetchImpl(resolveAssetUrl(path, baseUrl), { cache: 'no-cache' })
  if (!response.ok) throw new Error(message)
  return new Uint8Array(await response.arrayBuffer())
}
function createCanvas(documentRef) {
  const canvas = documentRef.createElement('canvas')
  canvas.width = Math.round(TBHP_A4_PAGE.width * OVERLAY_SCALE)
  canvas.height = Math.round(TBHP_A4_PAGE.height * OVERLAY_SCALE)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Không khởi tạo được lớp dữ liệu TBHP.')
  context.scale(OVERLAY_SCALE, OVERLAY_SCALE)
  return { canvas, context }
}
function projectScheduleRow(row = {}, expectedNumber) {
  const sessionNumber = positiveInteger(row.sessionNumber, 'Số thứ tự buổi')
  if (sessionNumber !== expectedNumber) throw new TuitionNoticePdfValidationError('Thứ tự lịch học không liên tục.', 'scheduleRows')
  return Object.freeze({ sessionNumber, date: optionalDate(row.date, 'Ngày học'),
    teacherName: normalizeText(row.teacherName), teacherDisplayName: normalizeText(row.teacherDisplayName || row.teacherDisplayLabel),
    source: normalizeText(row.source) || 'UNRESOLVED' })
}
function resolveAssetUrl(path, baseUrl = import.meta.env?.BASE_URL ?? '/') {
  const base = String(baseUrl || '/').endsWith('/') ? String(baseUrl || '/') : `${baseUrl}/`
  return `${base}${path}`
}
function canvasToPngArrayBuffer(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(async blob => {
    if (!blob) return reject(new Error('Không tạo được lớp dữ liệu TBHP.'))
    resolve(await blob.arrayBuffer())
  }, 'image/png'))
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
function positiveInteger(value, label) { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1) throw new TuitionNoticePdfValidationError(`${label} không hợp lệ.`, label); return n }
function nonNegativeInteger(value, label) { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw new TuitionNoticePdfValidationError(`${label} không hợp lệ.`, label); return n }
function moneyValue(value, label) { return nonNegativeInteger(value, label) }
function requiredText(value, label) { const text = normalizeText(value); if (!text) throw new TuitionNoticePdfValidationError(`Thiếu ${label} trong dữ liệu TBHP.`, label); return text }
function normalizeText(value) { return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim() }
function isPlainObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim()) }
