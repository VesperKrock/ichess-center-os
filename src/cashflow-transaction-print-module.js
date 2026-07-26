export const CASHFLOW_TRANSACTION_PRINT_ROOT_CLASS = 'cashflow-transaction-print-runtime-root'
export const CASHFLOW_TRANSACTION_PRINT_ROOT_SELECTOR = `.${CASHFLOW_TRANSACTION_PRINT_ROOT_CLASS}`

const EMPTY_VALUE = '—'
const IMAGE_LOAD_TIMEOUT_MS = 8000

export function createCashflowTransactionPrintSnapshot({
  centerId = '',
  centerName = '',
  transaction,
  transactionCode = '',
  exportedAt = new Date().toISOString(),
  cloudAttachments = [],
  legacyAttachment = null,
  students = [],
  tuitionRecords = [],
} = {}) {
  if (!transaction || typeof transaction !== 'object') {
    return null
  }

  const sourceContext = getTransactionSourceContext(transaction, students, tuitionRecords)

  return {
    kind: 'cashflow-transaction-print-snapshot',
    centerId: String(centerId || '').trim(),
    centerName: String(centerName || centerId || EMPTY_VALUE).trim(),
    exportedAt,
    transaction: {
      id: String(transaction.id || ''),
      code: String(transactionCode || transaction.transactionCode || transaction.id || EMPTY_VALUE),
      type: normalizeTransactionType(transaction.type),
      typeLabel: getTransactionTypeLabel(transaction.type),
      category: displayText(transaction.category),
      amount: Number(transaction.amount),
      amountLabel: formatPrintMoney(transaction.amount),
      transactionDate: displayDate(transaction.transactionDate),
      method: displayText(transaction.method),
      personName: displayText(transaction.personName),
      recordedBy: displayText(transaction.recordedBy),
      sourceLabel: getTransactionSourceLabel(transaction),
      note: displayText(transaction.note),
      createdAt: displayDateTime(transaction.createdAt),
      updatedAt: displayDateTime(transaction.updatedAt),
      sourceContext,
    },
    evidence: normalizeCashflowTransactionPrintEvidence({
      cloudAttachments,
      legacyAttachment,
    }),
  }
}

export function normalizeCashflowTransactionPrintEvidence({
  cloudAttachments = [],
  legacyAttachment = null,
} = {}) {
  const cloudEvidence = (Array.isArray(cloudAttachments) ? cloudAttachments : [])
    .map((attachment) => normalizeCloudEvidence(attachment))
    .filter(Boolean)

  if (cloudEvidence.length) {
    return cloudEvidence
  }

  const legacyEvidence = normalizeLegacyEvidence(legacyAttachment)
  return legacyEvidence ? [legacyEvidence] : []
}

export function renderCashflowTransactionPrintDocument(snapshot) {
  if (!snapshot) {
    return ''
  }

  const transaction = snapshot.transaction
  const sourceRows = transaction.sourceContext.length
    ? transaction.sourceContext.map(renderPrintDetailRow).join('')
    : ''

  return `
    <style data-cashflow-transaction-print-page>
      @page { size: A4 portrait; margin: 12mm; }
    </style>
    <section class="cashflow-transaction-print-document" data-cashflow-transaction-print-document aria-label="Sao kê giao dịch">
      <header class="cashflow-transaction-print-header">
        <div>
          <p class="cashflow-transaction-print-kicker">SAO KÊ GIAO DỊCH</p>
          <h1>${escapeHtml(transaction.code)}</h1>
          <p>${escapeHtml(snapshot.centerName)}</p>
        </div>
        <dl class="cashflow-transaction-print-meta">
          <div>
            <dt>Cơ sở</dt>
            <dd>${escapeHtml(snapshot.centerName)}</dd>
          </div>
          <div>
            <dt>Ngày xuất tài liệu</dt>
            <dd>${escapeHtml(displayDateTime(snapshot.exportedAt))}</dd>
          </div>
        </dl>
      </header>

      <section class="cashflow-transaction-print-amount is-${escapeAttribute(transaction.type)}">
        <span>${escapeHtml(transaction.typeLabel)}</span>
        <strong>${escapeHtml(transaction.amountLabel)}</strong>
      </section>

      <section class="cashflow-transaction-print-section cashflow-transaction-print-details">
        <h2>Thông tin giao dịch</h2>
        <dl>
          ${[
            ['Mã giao dịch', transaction.code],
            ['Loại', transaction.typeLabel],
            ['Danh mục', transaction.category],
            ['Số tiền', transaction.amountLabel],
            ['Ngày giao dịch', transaction.transactionDate],
            ['Phương thức', transaction.method],
            ['Người liên quan / Người nộp', transaction.personName],
            ['Người ghi nhận', transaction.recordedBy],
            ['Nguồn giao dịch', transaction.sourceLabel],
            ['Ghi chú', transaction.note],
            ['Thời điểm tạo', transaction.createdAt],
            ['Thời điểm cập nhật', transaction.updatedAt],
          ].map(renderPrintDetailRow).join('')}
          ${sourceRows}
        </dl>
      </section>

      <section class="cashflow-transaction-print-section cashflow-transaction-print-evidence">
        <h2>Các hình ảnh chứng từ</h2>
        ${renderPrintEvidence(snapshot.evidence)}
      </section>
    </section>
  `
}

export function waitForCashflowPrintImages(root, timeoutMs = IMAGE_LOAD_TIMEOUT_MS) {
  const images = Array.from(root?.querySelectorAll('img[data-cashflow-print-evidence-image]') || [])

  if (!images.length) {
    return Promise.resolve([])
  }

  return Promise.all(images.map((image) => waitForImageSettled(image, timeoutMs)))
}

function renderPrintDetailRow([label, value]) {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(displayText(value))}</dd>
    </div>
  `
}

function renderPrintEvidence(evidenceItems = []) {
  if (!evidenceItems.length) {
    return '<p class="cashflow-transaction-print-empty">Không có chứng từ</p>'
  }

  return `
    <div class="cashflow-transaction-print-evidence-grid">
      ${evidenceItems.map((item, index) => renderPrintEvidenceItem(item, index)).join('')}
    </div>
  `
}

function renderPrintEvidenceItem(item, index) {
  const label = `Ảnh ${index + 1}`
  const name = item.name || 'Ảnh chứng từ'
  const imageHtml = item.url
    ? `<img src="${escapeAttribute(item.url)}" alt="${escapeAttribute(`${label}: ${name}`)}" data-cashflow-print-evidence-image />`
    : '<div class="cashflow-transaction-print-image-placeholder">Không thể tải hình ảnh chứng từ</div>'

  return `
    <article class="cashflow-transaction-print-evidence-item">
      <header>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(name)}</span>
      </header>
      ${imageHtml}
      ${item.error ? `<p>Không thể tải hình ảnh chứng từ${item.name ? `: ${escapeHtml(item.name)}` : ''}</p>` : ''}
    </article>
  `
}

function waitForImageSettled(image, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false
    let timeoutId = null

    const finish = (status) => {
      if (settled) {
        return
      }

      settled = true
      window.clearTimeout(timeoutId)
      image.removeEventListener('load', onLoad)
      image.removeEventListener('error', onError)

      if (status !== 'loaded') {
        replaceFailedImage(image)
      }

      resolve(status)
    }

    const onLoad = () => finish('loaded')
    const onError = () => finish('error')

    if (image.complete) {
      finish(image.naturalWidth > 0 ? 'loaded' : 'error')
      return
    }

    image.addEventListener('load', onLoad, { once: true })
    image.addEventListener('error', onError, { once: true })
    timeoutId = window.setTimeout(() => finish('timeout'), timeoutMs)
  })
}

function replaceFailedImage(image) {
  const placeholder = document.createElement('div')
  placeholder.className = 'cashflow-transaction-print-image-placeholder'
  placeholder.textContent = 'Không thể tải hình ảnh chứng từ'
  image.replaceWith(placeholder)
}

function normalizeCloudEvidence(attachment) {
  const mimeType = String(attachment?.mimeType || attachment?.type || '').trim().toLowerCase()

  if (!mimeType.startsWith('image/')) {
    return null
  }

  return {
    source: 'cloud',
    name: String(attachment.fileName || attachment.originalName || attachment.name || 'Ảnh chứng từ'),
    mimeType,
    sizeBytes: Number(attachment.sizeBytes || attachment.size || 0),
    url: isSafePrintableImageUrl(attachment.signedUrl) ? attachment.signedUrl : '',
    error: !isSafePrintableImageUrl(attachment.signedUrl),
  }
}

function normalizeLegacyEvidence(attachment) {
  const mimeType = String(attachment?.mimeType || attachment?.type || '').trim().toLowerCase()
  const dataUrl = String(attachment?.dataUrl || '').trim()

  if (!mimeType.startsWith('image/') || !dataUrl.startsWith('data:image/')) {
    return null
  }

  return {
    source: 'legacy',
    name: String(attachment.name || attachment.fileName || attachment.originalName || 'Ảnh chứng từ'),
    mimeType,
    sizeBytes: Number(attachment.sizeBytes || attachment.size || 0),
    url: dataUrl,
    error: false,
  }
}

function getTransactionSourceLabel(transaction) {
  if (String(transaction?.sourceModule || '') === 'hoc-phi') {
    return 'Đồng bộ từ Học phí'
  }

  return 'Nhập thủ công'
}

function getTransactionSourceContext(transaction, students = [], tuitionRecords = []) {
  if (String(transaction?.sourceModule || '') !== 'hoc-phi') {
    return []
  }

  const student = students.find((item) => item.id === transaction.sourceStudentId)
  const tuitionRecord = tuitionRecords.find((record) => record.id === transaction.sourceTuitionId)
  const periodId = String(transaction.sourcePeriodId || transaction.sourceTermId || '')
  const periodLabel = getTuitionPeriodLabel(tuitionRecord, periodId)
  const payer = transaction.personName || student?.parentName || student?.name || ''

  return [
    ['Học viên', student?.name || EMPTY_VALUE],
    ['Phụ huynh / Người nộp', payer || EMPTY_VALUE],
    ['Kỳ học phí', periodLabel || EMPTY_VALUE],
    ['Ngữ cảnh nguồn', 'Thanh toán học phí được đồng bộ sang Thu chi'],
  ]
}

function getTuitionPeriodLabel(tuitionRecord, periodId) {
  if (!tuitionRecord || !periodId) {
    return ''
  }

  if (String(tuitionRecord.currentTermId || '') === periodId) {
    return `Kỳ hiện tại ${tuitionRecord.currentTermNumber ? `#${tuitionRecord.currentTermNumber}` : ''}`.trim()
  }

  const historicalTerm = (tuitionRecord.termHistory || []).find((term) => term.id === periodId)
  if (historicalTerm) {
    return `Kỳ #${historicalTerm.termNumber || historicalTerm.id}`
  }

  return periodId.startsWith('term-') ? 'Kỳ học phí hiện có' : ''
}

function normalizeTransactionType(type) {
  return String(type || '') === 'expense' ? 'expense' : 'income'
}

function getTransactionTypeLabel(type) {
  return normalizeTransactionType(type) === 'expense' ? 'Chi' : 'Thu'
}

function formatPrintMoney(amount) {
  const number = Number(amount)

  if (!Number.isFinite(number)) {
    return 'Số tiền không hợp lệ'
  }

  return `${number.toLocaleString('vi-VN')} VNĐ`
}

function displayDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return EMPTY_VALUE
  }

  return date.toLocaleDateString('vi-VN')
}

function displayDateTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return EMPTY_VALUE
  }

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function displayText(value) {
  const text = String(value ?? '').trim()
  return text && text !== 'undefined' && text !== 'null' && text !== '[object Object]'
    ? text
    : EMPTY_VALUE
}

function isSafePrintableImageUrl(value) {
  const url = String(value || '').trim()
  return (
    url.startsWith('data:image/') ||
    url.startsWith('blob:') ||
    url.startsWith('https://') ||
    url.startsWith('http://localhost') ||
    url.startsWith('http://127.0.0.1')
  )
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttribute(value) {
  return escapeHtml(value)
}
