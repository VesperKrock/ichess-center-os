export const F5B_RECEIPT_CAPABILITY_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
})

const BACKEND_UNAVAILABLE_CODES = new Set([
  '42P01',
  '42703',
  '42883',
  'PGRST202',
  'PGRST205',
  'BACKEND_NOT_DEPLOYED',
  'SCHEMA_NOT_READY',
])

const RECEIPT_STATUSES = new Set(['ISSUED', 'VOIDED'])

export function createF5BReceiptCapabilityState(overrides = {}) {
  return {
    centerId: '',
    status: F5B_RECEIPT_CAPABILITY_STATUS.IDLE,
    isLoading: false,
    isSaving: false,
    canWrite: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    ...overrides,
  }
}

export function isF5BReceiptCapabilityReady(state = {}, centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return Boolean(
    normalizedCenterId
      && state.centerId === normalizedCenterId
      && state.status === F5B_RECEIPT_CAPABILITY_STATUS.READY,
  )
}

export function createF5BReceiptIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không thể tạo mã an toàn cho thao tác Phiếu Thu.')
  }
  return globalThis.crypto.randomUUID()
}

export async function pullF5BTuitionReceipts({ supabase, centerId } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY')
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER')
  try {
    const { data, error } = await supabase.rpc('f5b_list_tuition_receipts', {
      p_center_id: normalizedCenterId,
    })
    if (error) return rpcFailure(error, 'RECEIPT_READ_FAILED')
    return parseF5BTuitionReceiptSnapshot(data, normalizedCenterId)
  } catch (error) {
    return rpcFailure(error, 'RECEIPT_READ_FAILED')
  }
}

export function parseF5BTuitionReceiptSnapshot(data, normalizedCenterId) {
    if (!data?.ok || data.center_id !== normalizedCenterId || !Array.isArray(data.receipts)) {
      return failure(cleanText(data?.outcome_code) || 'INVALID_SERVER_RESULT', data)
    }
    const receipts = data.receipts.map((row) => projectReceipt(row, normalizedCenterId))
    if (receipts.some((receipt) => !receipt)) return failure('INVALID_SERVER_RESULT', data)
    return {
      ok: true,
      outcome_code: cleanText(data.outcome_code) || 'AUTHORITATIVE_SNAPSHOT',
      centerId: normalizedCenterId,
      canWrite: data.can_write === true,
      receipts,
    }
}

export async function mutateF5BTuitionReceipt({
  supabase,
  centerId,
  command,
  idempotencyKey = createF5BReceiptIdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', null, idempotencyKey)
  }
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER', null, idempotencyKey)
  if (!isPlainObject(command)) return failure('INVALID_COMMAND', null, idempotencyKey)
  try {
    const { data, error } = await supabase.rpc('f5b_mutate_tuition_receipt', {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return rpcFailure(error, 'RECEIPT_WRITE_FAILED', idempotencyKey)
    if (!data?.ok) {
      return failure(cleanText(data?.outcome_code) || 'RECEIPT_WRITE_FAILED', data, idempotencyKey)
    }
    const version = Number(data.receipt_version)
    if (data.outcome_code !== 'COMMITTED' || data.center_id !== normalizedCenterId
      || !isUuid(data.receipt_id) || !Number.isSafeInteger(version) || version < 1
      || !RECEIPT_STATUSES.has(cleanText(data.receipt_status))) {
      return failure('INVALID_SERVER_RESULT', data, idempotencyKey)
    }
    return { ...data, ok: true, receipt_version: version, idempotencyKey }
  } catch (error) {
    return rpcFailure(error, 'RECEIPT_WRITE_FAILED', idempotencyKey)
  }
}

export function buildF5BRecordPaymentCommand(cycle = {}, financeCommand = {}, receiptId = '') {
  const cycleVersion = Number(cycle.version)
  const command = isPlainObject(financeCommand) ? { ...financeCommand } : null
  if (!isUuid(cycle.id) || !Number.isSafeInteger(cycleVersion) || cycleVersion < 1) {
    throw new Error('Chu kỳ mục tiêu chưa có phiên bản authoritative hợp lệ.')
  }
  if (!command || command.operation !== 'CREATE_TRANSACTION'
    || command.cashflow_type !== 'INCOME'
    || cleanText(command.source_module) !== 'hoc-phi'
    || cleanText(command.source_type) !== 'tuition-payment'
    || cleanText(command.source_tuition_id) !== cleanText(cycle.tuitionLocalId)
    || cleanText(command.source_student_id) !== cleanText(cycle.studentId)
    || cleanText(command.source_period_id) !== cleanText(cycle.paymentPeriodId)) {
    throw new Error('Lệnh TIỀN VÀO không khớp chu kỳ học phí authoritative.')
  }
  return {
    operation: 'RECORD_PAYMENT',
    receipt_id: receiptId
      ? requireUuid(receiptId, 'Mã Phiếu Thu không hợp lệ.')
      : createF5BReceiptIdempotencyKey(),
    target_cycle_id: cycle.id,
    expected_cycle_version: cycleVersion,
    finance_command: command,
  }
}

export function buildF5BReviseReceiptCommand(receipt = {}, values = {}, reason = '') {
  const version = Number(receipt.version)
  if (!isUuid(receipt.id) || !Number.isSafeInteger(version) || version < 1) {
    throw new Error('Phiếu Thu chưa có phiên bản authoritative hợp lệ.')
  }
  const correctionReason = cleanText(reason)
  if (correctionReason.length < 3 || correctionReason.length > 500
    || hasControlCharacters(correctionReason)) {
    throw new Error('Lý do sửa Phiếu Thu cần từ 3 đến 500 ký tự.')
  }
  const corrections = {}
  for (const key of [
    'centerName',
    'centerAddress',
    'centerPhone',
    'payerName',
    'collectorName',
    'email',
    'receiptAddress',
    'cccd',
  ]) {
    if (Object.prototype.hasOwnProperty.call(values, key)) corrections[key] = cleanText(values[key])
  }
  if (!Object.keys(corrections).length) throw new Error('Chưa có thông tin Phiếu Thu nào cần sửa.')
  return {
    operation: 'REVISE_RECEIPT',
    receipt_id: receipt.id,
    expected_version: version,
    correction_reason: correctionReason,
    corrections,
  }
}

export function getF5BReceiptOutcomeMessage(outcomeCode = '') {
  const messages = {
    CLIENT_NOT_READY: 'Cần đăng nhập lại trước khi thao tác Phiếu Thu.',
    INVALID_CENTER: 'Chưa xác định được cơ sở đang hoạt động.',
    WRITE_ROLE_REQUIRED: 'Tài khoản hiện tại không có quyền ghi nhận thanh toán học phí.',
    TARGET_CYCLE_NOT_FOUND: 'Không tìm thấy chu kỳ học phí mục tiêu.',
    TARGET_CYCLE_NOT_ELIGIBLE: 'Chu kỳ này chưa đủ điều kiện ghi nhận thanh toán.',
    TARGET_PAYMENT_CONFLICT: 'Khoản thanh toán này đã được ghi nhận với nội dung khác.',
    AUTHORITATIVE_SOURCE_MISSING: 'Thiếu dữ liệu Student/Tuition authoritative để lập Phiếu Thu.',
    TUITION_PERIOD_STALE: 'Kỳ học phí đã thay đổi. Hãy làm mới trước khi thao tác.',
    TUITION_SOURCE_INVALID: 'Số liệu học phí authoritative không hợp lệ.',
    CENTER_SETTINGS_REQUIRED: 'Cần hoàn tất Cài đặt trung tâm trước khi lưu thanh toán.',
    PAYMENT_AMOUNT_INVALID: 'Số tiền thanh toán không hợp lệ.',
    FULL_PAYMENT_REQUIRED: 'Trung tâm chỉ ghi nhận thanh toán đủ cho một kỳ.',
    CYCLE_ALREADY_PAID: 'Kỳ này đã được xác nhận thanh toán trước khi dùng iChess.',
    EXISTING_PARTIAL_PAYMENT_REVIEW_REQUIRED: 'Kỳ này có khoản thu cũ chưa đủ. Cần đối chiếu Thu chi trước khi ghi nhận thêm.',
    RECEIPT_NOT_FOUND: 'Không tìm thấy Phiếu Thu.',
    RECEIPT_VOIDED: 'Phiếu Thu đã mất hiệu lực do khoản thu bị hủy.',
    CORRECTION_INVALID: 'Thông tin sửa Phiếu Thu không hợp lệ.',
    CLOSED_PERIOD: 'Ngày giao dịch thuộc kỳ Thu chi đã khóa.',
    VERSION_STALE: 'Dữ liệu đã thay đổi ở nơi khác. Hãy làm mới rồi thử lại.',
    IDEMPOTENCY_CONFLICT: 'Nội dung thao tác đã thay đổi. Hãy mở lại form.',
    CONCURRENT_CONFLICT: 'Một thao tác khác vừa cập nhật dữ liệu. Hãy làm mới.',
    RECEIPT_READ_FAILED: 'Chưa tải được Phiếu Thu canonical.',
    RECEIPT_WRITE_FAILED: 'Chưa thể lưu thanh toán và Phiếu Thu.',
    INVALID_SERVER_RESULT: 'Máy chủ trả về dữ liệu Phiếu Thu không hợp lệ.',
  }
  return messages[cleanText(outcomeCode).toUpperCase()]
    || 'Chưa thể hoàn tất thao tác Phiếu Thu lúc này.'
}

export function isF5BReceiptBackendUnavailable(result = {}) {
  const code = cleanText(result.outcome_code || result.code).toUpperCase()
  const details = [result.error, result.message, result.details, result.hint]
    .map(cleanText)
    .join(' ')
    .toUpperCase()
  return BACKEND_UNAVAILABLE_CODES.has(code)
    || [...BACKEND_UNAVAILABLE_CODES].some((candidate) => details.includes(candidate))
}

function projectReceipt(row = {}, expectedCenterId = '') {
  const version = Number(row.version)
  const revisionNumber = Number(row.revision_number)
  const targetTermNumber = Number(row.target_term_number)
  const amountReceived = Number(row.amount_received_minor)
  const tuitionAllocation = Number(row.tuition_allocation_minor)
  const status = cleanText(row.status)
  const classification = cleanText(row.registration_classification)
  if (!isUuid(row.id) || !isUuid(row.target_cycle_id) || !isUuid(row.finance_transaction_id)
    || !Number.isSafeInteger(version) || version < 1
    || !Number.isSafeInteger(revisionNumber) || revisionNumber < 1
    || !Number.isSafeInteger(targetTermNumber) || targetTermNumber < 1
    || !Number.isSafeInteger(amountReceived) || amountReceived < 1
    || !Number.isSafeInteger(tuitionAllocation) || tuitionAllocation < 0
    || !RECEIPT_STATUSES.has(status)
    || !['NEW_REGISTRATION', 'RENEWAL'].includes(classification)
    || !/^\d{4}-\d{2}-\d{2}$/.test(cleanText(row.business_date))
    || !/^[A-Z0-9]{2,6}-\d{6}-\d{3,}$/.test(cleanText(row.receipt_number))
    || !isPlainObject(row.snapshot)
    || !Array.isArray(row.payments)) return null
  const payments = row.payments.map(projectReceiptPayment)
  if (payments.some((payment) => !payment)) return null
  return {
    id: row.id,
    centerId: expectedCenterId,
    receiptNumber: cleanText(row.receipt_number),
    businessDate: cleanText(row.business_date),
    studentId: cleanText(row.student_id),
    tuitionLocalId: cleanText(row.tuition_local_id),
    targetCycleId: row.target_cycle_id,
    targetPeriodId: cleanText(row.target_period_id),
    targetTermNumber,
    financeTransactionId: row.finance_transaction_id,
    customerContactId: cleanText(row.customer_contact_id),
    registrationClassification: classification,
    amountReceived,
    tuitionAllocation,
    snapshot: row.snapshot,
    status,
    version,
    revisionNumber,
    revisionReason: cleanText(row.revision_reason),
    issuedAt: cleanText(row.issued_at),
    updatedAt: cleanText(row.updated_at),
    payments,
  }
}

function projectReceiptPayment(row = {}) {
  const amount = Number(row.amount_minor)
  const tuitionAllocation = Number(row.tuition_allocation_minor)
  const version = Number(row.version)
  const status = cleanText(row.status).toLowerCase()
  if (!isUuid(row.transaction_id)
    || !Number.isSafeInteger(amount) || amount < 1
    || !Number.isSafeInteger(tuitionAllocation) || tuitionAllocation < 0
    || !Number.isSafeInteger(version) || version < 1
    || !['posted', 'voided'].includes(status)) return null
  return {
    transactionId: row.transaction_id,
    transactionCode: cleanText(row.transaction_code),
    transactionDate: cleanText(row.transaction_date),
    method: cleanText(row.method),
    amount,
    tuitionAllocation,
    status,
    version,
    voidedAt: cleanText(row.voided_at),
  }
}

function rpcFailure(error = {}, fallbackCode = 'RECEIPT_WRITE_FAILED', idempotencyKey = '') {
  const code = cleanText(error.code || fallbackCode)
  const unavailable = BACKEND_UNAVAILABLE_CODES.has(code.toUpperCase())
    || isF5BReceiptBackendUnavailable(error)
  return {
    ok: false,
    outcome_code: unavailable ? 'BACKEND_NOT_DEPLOYED' : fallbackCode,
    error: unavailable
      ? getF5BReceiptOutcomeMessage('RECEIPT_READ_FAILED')
      : cleanText(error.message) || getF5BReceiptOutcomeMessage(fallbackCode),
    details: error,
    idempotencyKey,
    unavailable,
  }
}

function failure(outcomeCode, details = null, idempotencyKey = '') {
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: getF5BReceiptOutcomeMessage(outcomeCode),
    details,
    idempotencyKey,
  }
}

function requireUuid(value, message) {
  const normalized = cleanText(value)
  if (!isUuid(normalized)) throw new Error(message)
  return normalized
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(cleanText(value))
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function hasControlCharacters(value) {
  return /[\u0000-\u001f\u007f]/.test(value)
}
