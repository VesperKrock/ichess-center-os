import { TUITION_RECEIPT_A5_PAGE, TUITION_RECEIPT_A5_LAYOUT } from './tuition-receipt-a5-layout.js'

export const TUITION_RECEIPT_TEMPLATE_PATH = 'forms/tuition-receipt/tuition-receipt-a5-background.pdf'
export const TUITION_RECEIPT_TEMPLATE_SHA256 = '8df5e60a4a9f3fa8a17f801f75501087f35c694e6f322e2ba339c55097eb004c'
export const TUITION_RECEIPT_FONTS = Object.freeze({
  regular: Object.freeze({ file: 'Tinos-Regular.ttf', family: 'Tuition Receipt Tinos Regular', sha256: '60a0e8ef0c04dd5dd69ffe91025fa2ae5836cbd35600a82ba031977557e2cb61' }),
  bold: Object.freeze({ file: 'Tinos-Bold.ttf', family: 'Tuition Receipt Tinos Bold', sha256: '393269dbab8899f938db19783eca5eac92eb431f7ae0ab45b8349ca895f1a06b' }),
  italic: Object.freeze({ file: 'Tinos-Italic.ttf', family: 'Tuition Receipt Tinos Italic', sha256: '5942266ed398b155d7dc23e36833e7ec6be988f2439bdbeb8ef1bede808eaa91' }),
})
const fontLoads = new WeakMap()

export class TuitionReceiptPdfValidationError extends Error {
  constructor(message, field = '') {
    super(message)
    this.name = 'TuitionReceiptPdfValidationError'
    this.field = field
  }
}

export function createTuitionReceiptPdfProjection(receipt = {}) {
  const snapshot = isPlainObject(receipt.snapshot) ? receipt.snapshot : null
  if (!isUuid(receipt.id) || !snapshot || snapshot.receiptId !== receipt.id) {
    throw new TuitionReceiptPdfValidationError(
      'Chỉ có thể xuất PDF từ Phiếu Thu đã phát hành có dữ liệu hợp lệ.',
    )
  }

  const center = isPlainObject(snapshot.center) ? snapshot.center : {}
  const student = isPlainObject(snapshot.student) ? snapshot.student : {}
  const customer = isPlainObject(snapshot.customer) ? snapshot.customer : {}
  const registration = isPlainObject(snapshot.registration) ? snapshot.registration : {}
  const tuition = isPlainObject(snapshot.tuition) ? snapshot.tuition : {}
  const money = isPlainObject(snapshot.money) ? snapshot.money : {}
  const discount = isPlainObject(money.discount) ? money.discount : {}
  if (!['ISSUED', 'VOIDED'].includes(String(receipt.status || ''))) {
    throw new TuitionReceiptPdfValidationError(
      'Phiếu Thu chỉ được xuất sau khi giao dịch TIỀN VÀO đã thành công.',
      'status',
    )
  }
  const paymentDate = parsePaymentDate(snapshot, receipt)
  const tuitionBaseAmount = requireMoney(money.tuitionBaseAmount, 'Học phí gốc')
  const discountAmount = requireMoney(discount.amount, 'Ưu đãi')
  const materialFee = requireMoney(money.materialFee, 'Phí giáo trình')
  const totalAmountDue = requireMoney(money.totalAmountDue, 'Tổng cần đóng')
  const amountReceived = requirePositiveMoney(
    money.amountReceived ?? receipt.amountReceived,
    'Thực thu',
  )
  const remainingAfterPayment = requireMoney(
    money.remainingAfterPayment ?? Math.max(totalAmountDue - amountReceived, 0),
    'Còn lại',
  )
  const termNumber = Number(tuition.termNumber)
  if (totalAmountDue !== tuitionBaseAmount - discountAmount + materialFee
    || amountReceived !== totalAmountDue || remainingAfterPayment !== 0) {
    throw new TuitionReceiptPdfValidationError('Số tiền trên Phiếu Thu không khớp thanh toán đủ học phí.', 'money')
  }
  if (!Number.isSafeInteger(termNumber) || termNumber < 1) {
    throw new TuitionReceiptPdfValidationError('Kỳ học phí trên Phiếu Thu không hợp lệ.', 'termNumber')
  }

  const classification = normalizeSingleLine(registration.label)
  if (!['Đăng ký mới', 'Tái đăng ký'].includes(classification)) {
    throw new TuitionReceiptPdfValidationError(
      'Phân loại đăng ký trên Phiếu Thu không hợp lệ.',
      'classification',
    )
  }

  const activePayment = (Array.isArray(receipt.payments) ? receipt.payments : [])
    .find((payment) => String(payment?.status || '').toLowerCase() === 'posted')
  if ((receipt.status === 'ISSUED' && !activePayment)
    || (receipt.status === 'VOIDED' && activePayment)) {
    throw new TuitionReceiptPdfValidationError('Hiệu lực Phiếu Thu không khớp giao dịch Thu chi.', 'payment')
  }
  const linkedPayment = activePayment || (Array.isArray(receipt.payments) ? receipt.payments[0] : null)
  if (!linkedPayment) {
    throw new TuitionReceiptPdfValidationError(
      'Phiếu Thu thiếu giao dịch Thu chi đã liên kết.',
      'payment',
    )
  }
  if (snapshot.financeTransactionId !== linkedPayment.transactionId
    || receipt.financeTransactionId !== linkedPayment.transactionId
    || snapshot.receiptNumber !== receipt.receiptNumber) {
    throw new TuitionReceiptPdfValidationError('Thông tin Phiếu Thu không khớp giao dịch và số phiếu đã phát hành.', 'payment')
  }
  const scheduleLines = (Array.isArray(snapshot.scheduleLines) ? snapshot.scheduleLines : [])
    .map(normalizeSingleLine)
    .filter(Boolean)

  const projection = {
    centerName: normalizeSingleLine(center.name),
    centerAddressLine: normalizeSingleLine(center.address) ? `Địa chỉ: ${normalizeSingleLine(center.address)}` : '',
    centerPhoneLine: normalizeSingleLine(center.phone) ? `Hotline: ${normalizeSingleLine(center.phone)}` : '',
    paymentDate: `Ngày thu: ${pad2(paymentDate.day)}/${pad2(paymentDate.month)}/${paymentDate.year}`,
    payerName: normalizeSingleLine(customer.payerName),
    collectorName: normalizeSingleLine(snapshot.payment?.collectorName),
    studentName: normalizeSingleLine(student.name),
    receiptAddress: normalizeMultiline(customer.receiptAddress),
    email: normalizeSingleLine(customer.email),
    cccd: normalizeIdentity(customer.cccd),
    classification,
    termDisplay: `Kỳ ${termNumber}`,
    packageName: normalizeSingleLine(tuition.packageName),
    packageDisplay: packageDisplay(tuition),
    scheduleLines: scheduleLines.join(' · '),
    tuitionBaseAmount: formatMoney(tuitionBaseAmount),
    discountDisplay: formatMoney(discountAmount),
    materialFee: formatMoney(materialFee),
    totalAmountDue: formatMoney(totalAmountDue),
    amountReceived: formatMoney(amountReceived),
    remainingAfterPayment: formatMoney(remainingAfterPayment),
    amountInWords: `${numberToVietnameseWords(amountReceived)} đồng.`,
    paymentMethod: normalizeSingleLine(snapshot.payment?.method ?? linkedPayment.method),
    status: receipt.status,
    receiptId: receipt.id,
    receiptNumber: normalizeSingleLine(snapshot.receiptNumber || receipt.receiptNumber),
  }

  for (const [key, label] of [
    ['centerName', 'Tên trung tâm'],
    ['studentName', 'Họ và tên học viên'],
    ['payerName', 'Họ và tên phụ huynh'],
    ['collectorName', 'Người thu tiền / lập Phiếu Thu'],
    ['packageName', 'Gói học phí'],
    ['receiptNumber', 'Số Phiếu Thu'],
  ]) {
    if (!projection[key]) {
      throw new TuitionReceiptPdfValidationError(
        `Phiếu Thu thiếu “${label}”; vui lòng làm mới và thử lại.`,
        key,
      )
    }
  }

  return Object.freeze(projection)
}


export function createTuitionReceiptOverlayPlan(projection, measureText) {
  if (typeof measureText !== 'function') throw new TypeError('Cần hàm đo văn bản Phiếu Thu.')
  const values = {
    ...projection,
    brand: 'Trung Tâm Cờ Vua Truyền Cảm Hứng - iChess',
    centerName: `Cơ sở: ${projection.centerName}`,
    title: 'PHIẾU THU',
    receiptNumber: `Số phiếu: ${projection.receiptNumber}`,
    payerSignature: projection.payerName,
    payerSignatureHeading: 'Người nộp tiền',
    collectorSignatureHeading: 'Người thu tiền',
    payerSignatureHelper: '(Ký và ghi họ tên)',
    collectorSignatureHelper: '(Ký và ghi họ tên)',
    voidMark: projection.status === 'VOIDED' ? 'ĐÃ HỦY' : '',
  }
  const plan = TUITION_RECEIPT_A5_LAYOUT.labels
    .filter(label => !label.optional || values[label.optional])
    .map(label => ({ type: 'text', ...label }))
  for (const [key, field] of Object.entries(TUITION_RECEIPT_A5_LAYOUT.fields)) {
    const value = normalizeSingleLine(values[key])
    if (!value) continue
    const lines = wrapField(value, key, field, measureText)
    const baselines = lines.length === 1 ? [field.baseline] : field.multilineBaselines
    const x = field.x + (field.align === 'center' ? field.width / 2 : field.align === 'right' ? field.width : 0)
    lines.forEach((line, index) => plan.push({
      type: 'text', key, value: line, x, baseline: baselines[index],
      font: field.font, fontSize: field.fontSize, align: field.align, color: field.color,
    }))
  }
  return Object.freeze(plan.map(command => Object.freeze(command)))
}

// Wrap only within the approved fixed regions; never reduce a field's font size.
function wrapField(value, key, field, measureText) {
  const fits = text => measureText(text, field.fontSize, field.font) <= field.width
  if (fits(value)) return [value]
  if (field.maxLines === 1) throwTextOverflow(key)
  const lines = []
  let current = ''
  for (const word of value.split(' ')) {
    if (!fits(word)) throwTextOverflow(key)
    const candidate = current ? `${current} ${word}` : word
    if (fits(candidate)) current = candidate
    else { lines.push(current); current = word }
  }
  if (current) lines.push(current)
  if (lines.length > field.maxLines) throwTextOverflow(key)
  return lines
}

function throwTextOverflow(field) {
  throw new TuitionReceiptPdfValidationError(
    'Nội dung Phiếu Thu quá dài so với vùng in A5 đã duyệt. Vui lòng kiểm tra thông tin trước khi xuất.', field,
  )
}

export async function generateTuitionReceiptPdf(receipt, options = {}) {
  const projection = createTuitionReceiptPdfProjection(receipt)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new Error('Trình duyệt hiện tại không hỗ trợ xuất PDF Phiếu Thu.')
  }
  const [templateBytes, fontBytes, { PDFDocument, rgb }, { default: fontkit }] = await Promise.all([
    loadAsset(TUITION_RECEIPT_TEMPLATE_PATH, fetchImpl, options.baseUrl),
    loadFonts(fetchImpl, options.baseUrl),
    import('pdf-lib'), import('@pdf-lib/fontkit'),
  ])
  const templateHash = await getSha256(templateBytes)
  if (templateHash !== TUITION_RECEIPT_TEMPLATE_SHA256) throw new Error('Mẫu Phiếu Thu không khớp bản A5 đã duyệt.')
  const source = await PDFDocument.load(templateBytes, { updateMetadata: false })
  if (source.getPageCount() !== 1) throw new Error('Mẫu Phiếu Thu phải có đúng một trang.')
  const { width, height } = source.getPage(0).getSize()
  if (Math.abs(width - TUITION_RECEIPT_A5_PAGE.width) > 0.001
    || Math.abs(height - TUITION_RECEIPT_A5_PAGE.height) > 0.001) {
    throw new Error('Kích thước Phiếu Thu không khớp bản A5 ngang đã duyệt.')
  }
  const pdfDocument = await PDFDocument.create()
  const [page] = await pdfDocument.copyPages(source, [0])
  pdfDocument.addPage(page)
  pdfDocument.registerFontkit(fontkit)
  const fonts = Object.fromEntries(await Promise.all(Object.entries(fontBytes).map(async ([style, bytes]) =>
    [style, await pdfDocument.embedFont(bytes, { subset: true, features: { kern: false, liga: false } })],
  )))
  const measureText = (text, size, style) => fonts[style].widthOfTextAtSize(text, size)
  const plan = createTuitionReceiptOverlayPlan(projection, measureText)
  for (const command of plan) {
    const textWidth = measureText(command.value, command.fontSize, command.font)
    const x = command.x - (command.align === 'center' ? textWidth / 2 : command.align === 'right' ? textWidth : 0)
    page.drawText(command.value, {
      x, y: height - command.baseline, size: command.fontSize, font: fonts[command.font],
      color: command.color === '#b91c1c' ? rgb(185 / 255, 28 / 255, 28 / 255) : rgb(0, 0, 0),
    })
  }
  const outputBytes = await pdfDocument.save()
  return {
    blob: new Blob([outputBytes], { type: 'application/pdf' }),
    fileName: createOutputFileName(projection.receiptNumber, projection.studentName),
    pageCount: 1, pageSize: Object.freeze({ width, height }), templateHash, projection,
    commandCount: plan.length,
  }
}

async function loadFonts(fetchImpl, baseUrl) {
  const cached = fontLoads.get(fetchImpl)
  if (cached && cached.baseUrl === baseUrl) return cached.loading
  const loading = Promise.all(Object.entries(TUITION_RECEIPT_FONTS).map(async ([style, asset]) => {
    const bytes = await loadAsset(`forms/tuition-receipt/fonts/${asset.file}`, fetchImpl, baseUrl)
    if (await getSha256(bytes) !== asset.sha256) throw new Error('Phông Phiếu Thu không khớp bản đã duyệt.')
    return [style, bytes]
  })).then(Object.fromEntries)
  fontLoads.set(fetchImpl, { baseUrl, loading })
  try { return await loading } catch (error) { fontLoads.delete(fetchImpl); throw error }
}

async function loadAsset(path, fetchImpl, baseUrl = import.meta.env?.BASE_URL ?? '/') {
  const base = String(baseUrl || '/').replace(/\/?$/, '/')
  const response = await fetchImpl(`${base}${path}`, { cache: 'no-cache' })
  if (!response.ok) throw new Error('Không tải được mẫu hoặc phông Phiếu Thu A5 đã duyệt. Vui lòng thử lại.')
  return new Uint8Array(await response.arrayBuffer())
}

async function getSha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('Trình duyệt không hỗ trợ kiểm tra mẫu Phiếu Thu.')
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function parsePaymentDate(snapshot, receipt) {
  const owned = snapshot.payment?.transactionDate ?? snapshot.businessDate ?? receipt.businessDate
  if (owned != null) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(owned))
    if (match) {
      const [year, month, day] = match.slice(1).map(Number)
      const date = new Date(Date.UTC(year, month - 1, day))
      if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return { year, month, day }
    }
    throw new TuitionReceiptPdfValidationError('Ngày thanh toán trên Phiếu Thu không hợp lệ.', 'paymentDate')
  }
  // Older issued snapshots own only their issuance timestamp.
  const date = new Date(snapshot.issuedAt || receipt.issuedAt)
  if (Number.isNaN(date.getTime())) throw new TuitionReceiptPdfValidationError('Ngày phát hành Phiếu Thu không hợp lệ.', 'issuedAt')
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date)
  return Object.fromEntries(parts.filter(part => ['year', 'month', 'day'].includes(part.type)).map(part => [part.type, Number(part.value)]))
}

function packageDisplay(tuition) {
  const name = normalizeSingleLine(tuition.packageName)
  const program = normalizeSingleLine(tuition.programName)
  return program && !name.toLocaleLowerCase('vi').includes(program.toLocaleLowerCase('vi'))
    ? `${program} · ${name}` : name
}

function requireMoney(value, label) {
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new TuitionReceiptPdfValidationError(`${label} trên Phiếu Thu không hợp lệ.`, label)
  }
  return amount
}

function requirePositiveMoney(value, label) {
  const amount = requireMoney(value, label)
  if (amount < 1) {
    throw new TuitionReceiptPdfValidationError(`${label} trên Phiếu Thu không hợp lệ.`, label)
  }
  return amount
}

function numberToVietnameseWords(value) {
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount < 0) return ''
  if (amount === 0) return 'Không'
  const units = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']
  const groups = []
  let remaining = amount
  while (remaining > 0) {
    groups.push(remaining % 1000)
    remaining = Math.floor(remaining / 1000)
  }
  const readGroup = (group, full) => {
    const hundred = Math.floor(group / 100)
    const tens = Math.floor((group % 100) / 10)
    const one = group % 10
    const parts = []
    if (hundred || full) parts.push(`${units[hundred]} trăm`)
    if (tens > 1) parts.push(`${units[tens]} mươi`)
    else if (tens === 1) parts.push('mười')
    else if (one && (hundred || full)) parts.push('lẻ')
    if (one) {
      if (one === 1 && tens > 1) parts.push('mốt')
      else if (one === 5 && tens > 0) parts.push('lăm')
      else parts.push(units[one])
    }
    return parts.join(' ')
  }
  const words = []
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index]
    if (!group) continue
    words.push(readGroup(group, index < groups.length - 1 && group < 100))
    if (scales[index]) words.push(scales[index])
  }
  const result = words.join(' ').replace(/\s+/g, ' ').trim()
  return result.charAt(0).toUpperCase() + result.slice(1)
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} VNĐ`
}

function normalizeIdentity(value) {
  const text = normalizeSingleLine(value)
  if (/[^0-9A-Za-z]/.test(text)) {
    throw new TuitionReceiptPdfValidationError('CCCD trên Phiếu Thu chứa ký tự không hợp lệ.', 'cccd')
  }
  return text
}

function normalizeSingleLine(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
}

function normalizeMultiline(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

function createOutputFileName(receiptNumber, studentName) {
  const slug = `${receiptNumber}-${studentName}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `phieu-thu-hoc-phi-${slug || 'hoc-vien'}.pdf`
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value || '').trim())
}
