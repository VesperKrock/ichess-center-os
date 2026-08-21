export const C54_FINANCE_SHARED_TRUTH_SOURCE_VERSION =
  'c5.4-finance-cashbook-authoritative-shared-truth-v1'

const WRITE_ROLES = new Set(['owner', 'admin', 'center_admin', 'qtv'])
const CASHFLOW_TYPES = new Set(['income', 'expense'])
const CATEGORY_TYPES = new Set(['income', 'expense', 'both'])
const ATTACHMENT_ACTIONS = new Set(['KEEP', 'BIND', 'UNBIND'])

export function createC54FinanceIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không hỗ trợ crypto.randomUUID cho lệnh Finance C5.4.')
  }
  return globalThis.crypto.randomUUID()
}

export function canWriteC54FinanceSharedTruth(accessState = {}) {
  const role = cleanText(accessState?.role || accessState?.membership?.role).toLowerCase()
  const canWrite = Boolean(accessState?.canWrite !== false && WRITE_ROLES.has(role))
  return {
    ok: canWrite,
    canWrite,
    role,
    error: canWrite
      ? ''
      : 'Vai trò hiện tại chỉ được xem Thu chi; dữ liệu chưa được lưu.',
  }
}

export async function pullC54FinanceSharedTruth({ supabase, centerId } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', getC54FinanceOutcomeMessage('CLIENT_NOT_READY'))
  }
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) {
    return failure('INVALID_CENTER', getC54FinanceOutcomeMessage('INVALID_CENTER'))
  }

  try {
    const { data, error } = await supabase.rpc('c5_4_list_finance_shared_truth', {
      p_center_id: normalizedCenterId,
    })
    if (error) {
      return failure('FINANCE_SHARED_TRUTH_READ_FAILED', String(error.message || error), error)
    }
    if (!data?.ok || !Array.isArray(data.transactions) || !Array.isArray(data.categories)
      || !Array.isArray(data.reconciliations)) {
      const outcomeCode = String(data?.outcome_code || 'INVALID_SERVER_RESULT')
      return failure(outcomeCode, getC54FinanceOutcomeMessage(outcomeCode), data)
    }
    if (String(data.center_id || '') !== normalizedCenterId) {
      return failure('CENTER_CONTEXT_CHANGED', getC54FinanceOutcomeMessage('CENTER_CONTEXT_CHANGED'))
    }

    const categories = data.categories.map(projectC54FinanceCategory).filter(Boolean)
    const transactions = data.transactions.map(projectC54FinanceTransaction).filter(Boolean)
    const settings = projectC54CashbookSettings(data.settings, transactions)
    const reconciliations = data.reconciliations
      .map(projectC54CashbookReconciliation)
      .filter(Boolean)
    if (categories.length !== data.categories.length
      || transactions.length !== data.transactions.length
      || reconciliations.length !== data.reconciliations.length
      || (data.settings !== null && !settings)) {
      return failure('INVALID_SERVER_RESULT', getC54FinanceOutcomeMessage('INVALID_SERVER_RESULT'), data)
    }

    return {
      ok: true,
      outcome_code: data.outcome_code,
      centerId: normalizedCenterId,
      categories,
      transactions,
      settings,
      reconciliations,
    }
  } catch (error) {
    return failure('FINANCE_SHARED_TRUTH_READ_FAILED', String(error?.message || error), error)
  }
}

export async function mutateC54FinanceSharedTruth({
  supabase,
  centerId,
  command,
  idempotencyKey = createC54FinanceIdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', getC54FinanceOutcomeMessage('CLIENT_NOT_READY'), null, idempotencyKey)
  }
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) {
    return failure('INVALID_CENTER', getC54FinanceOutcomeMessage('INVALID_CENTER'), null, idempotencyKey)
  }
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    return failure('INVALID_COMMAND', getC54FinanceOutcomeMessage('INVALID_COMMAND'), null, idempotencyKey)
  }

  try {
    const { data, error } = await supabase.rpc('c5_4_mutate_finance_shared_truth', {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) {
      return failure('SERVER_COMMAND_FAILED', String(error.message || error), error, idempotencyKey)
    }
    if (!data?.ok) {
      const outcomeCode = String(data?.outcome_code || 'SERVER_COMMAND_FAILED')
      return failure(outcomeCode, getC54FinanceOutcomeMessage(outcomeCode), data, idempotencyKey)
    }
    if (data.outcome_code !== 'COMMITTED' || !data.entity_type || !data.entity_id) {
      return failure('INVALID_SERVER_RESULT', getC54FinanceOutcomeMessage('INVALID_SERVER_RESULT'), data, idempotencyKey)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return failure('SERVER_COMMAND_FAILED', String(error?.message || error), error, idempotencyKey)
  }
}

export async function mutateC54TuitionPaymentVoid({
  supabase,
  centerId,
  command,
  idempotencyKey = createC54FinanceIdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', getC54FinanceOutcomeMessage('CLIENT_NOT_READY'), null, idempotencyKey)
  }
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) {
    return failure('INVALID_CENTER', getC54FinanceOutcomeMessage('INVALID_CENTER'), null, idempotencyKey)
  }

  let normalizedCommand
  try {
    normalizedCommand = buildC54VoidTuitionPaymentCommand(command)
  } catch (error) {
    return failure('INVALID_PAYLOAD', String(error?.message || error), null, idempotencyKey)
  }

  try {
    const { data, error } = await supabase.rpc('c5_4_void_tuition_payment', {
      p_center_id: normalizedCenterId,
      p_transaction_id: normalizedCommand.transaction_id,
      p_source_payment_id: normalizedCommand.source_payment_id,
      p_source_tuition_id: normalizedCommand.source_tuition_id,
      p_expected_version: normalizedCommand.expected_version,
      p_reason: normalizedCommand.reason,
      p_idempotency_key: idempotencyKey,
    })
    if (error) {
      return failure('SERVER_COMMAND_FAILED', String(error.message || error), error, idempotencyKey)
    }
    if (!data?.ok) {
      const outcomeCode = String(data?.outcome_code || 'SERVER_COMMAND_FAILED')
      return failure(outcomeCode, getC54FinanceOutcomeMessage(outcomeCode), data, idempotencyKey)
    }
    const version = Number(data.entity_version)
    if (data.outcome_code !== 'COMMITTED'
      || data.entity_type !== 'TRANSACTION'
      || data.entity_id !== normalizedCommand.transaction_id
      || data.center_id !== normalizedCenterId
      || data.source_payment_id !== normalizedCommand.source_payment_id
      || data.source_tuition_id !== normalizedCommand.source_tuition_id
      || !Number.isSafeInteger(version) || version < 2) {
      return failure('INVALID_SERVER_RESULT', getC54FinanceOutcomeMessage('INVALID_SERVER_RESULT'), data, idempotencyKey)
    }
    return { ...data, ok: true, entity_version: version, idempotencyKey }
  } catch (error) {
    return failure('SERVER_COMMAND_FAILED', String(error?.message || error), error, idempotencyKey)
  }
}

export function buildC54SaveCategoryCommand(category = {}) {
  const version = financeVersion(category)
  const type = cleanText(category.type).toLowerCase()
  if (!CATEGORY_TYPES.has(type)) throw new Error('Loại danh mục Thu chi không hợp lệ.')
  return {
    operation: version > 0 ? 'UPDATE_CATEGORY' : 'CREATE_CATEGORY',
    category_id: version > 0
      ? requireUuid(category.id, 'Thiếu category_id authoritative.')
      : createC54FinanceIdempotencyKey(),
    expected_version: version,
    name: requireText(category.name, 'Tên danh mục không được trống.'),
    category_type: type.toUpperCase(),
  }
}

export function buildC54ArchiveCategoryCommand(category = {}) {
  return {
    operation: 'ARCHIVE_CATEGORY',
    category_id: requireUuid(category.id, 'Thiếu category_id authoritative.'),
    expected_version: requirePositiveVersion(category, 'Category'),
  }
}

export function buildC54SaveTransactionCommand(transaction = {}, {
  category,
  attachmentAction = 'KEEP',
  attachmentId = '',
} = {}) {
  const version = financeVersion(transaction)
  const type = cleanText(transaction.type).toLowerCase()
  const normalizedAttachmentAction = cleanText(attachmentAction).toUpperCase() || 'KEEP'
  if (!CASHFLOW_TYPES.has(type)) throw new Error('Loại giao dịch Thu chi không hợp lệ.')
  if (!ATTACHMENT_ACTIONS.has(normalizedAttachmentAction)) {
    throw new Error('Thao tác chứng từ không hợp lệ.')
  }

  const command = {
    operation: version > 0 ? 'UPDATE_TRANSACTION' : 'CREATE_TRANSACTION',
    transaction_id: version > 0
      ? requireUuid(transaction.id, 'Thiếu transaction_id authoritative.')
      : createC54FinanceIdempotencyKey(),
    expected_version: version,
    local_source_id: cleanText(transaction.localSourceId || transaction.id),
    cashflow_type: type.toUpperCase(),
    category_id: requireUuid(category?.id || transaction.categoryId, 'Danh mục authoritative không hợp lệ.'),
    amount_minor: requireMoneyMinor(transaction.amount),
    transaction_date: requireDate(transaction.transactionDate),
    method: requireText(transaction.method, 'Phương thức giao dịch không được trống.'),
    person_name: cleanText(transaction.personName),
    recorded_by_name: cleanText(transaction.recordedBy),
    note: cleanText(transaction.note),
    source_module: cleanText(transaction.sourceModule) || 'manual',
    source_type: cleanText(transaction.sourceType),
    source_payment_id: cleanText(transaction.sourcePaymentId),
    source_tuition_id: cleanText(transaction.sourceTuitionId),
    source_student_id: cleanText(transaction.sourceStudentId),
    source_parent_id: cleanText(transaction.sourceParentId),
    source_period_id: cleanText(transaction.sourcePeriodId || transaction.sourceTermId),
    attachment_action: normalizedAttachmentAction,
  }
  if (normalizedAttachmentAction === 'BIND') {
    command.attachment_id = requireUuid(attachmentId, 'Thiếu attachment_id cần bind.')
  }
  return command
}

export function buildC54VoidTransactionCommand(transaction = {}) {
  return {
    operation: 'VOID_TRANSACTION',
    transaction_id: requireUuid(transaction.id, 'Thiếu transaction_id authoritative.'),
    expected_version: requirePositiveVersion(transaction, 'Transaction'),
  }
}

export function buildC54VoidTuitionPaymentCommand(transaction = {}, reason = transaction.reason) {
  if (cleanText(transaction.sourceModule || transaction.source_module) !== 'hoc-phi'
    || cleanText(transaction.sourceType || transaction.source_type) !== 'tuition-payment') {
    throw new Error('Chỉ có thể hủy khoản thu được tạo từ Học phí.')
  }
  if (cleanText(transaction.status).toLowerCase() !== 'posted') {
    throw new Error('Khoản thu này không còn ở trạng thái có thể hủy.')
  }
  const normalizedReason = cleanText(reason)
  if (normalizedReason.length < 3 || normalizedReason.length > 500 || /[\u0000-\u001f\u007f]/.test(normalizedReason)) {
    throw new Error('Lý do hủy cần từ 3 đến 500 ký tự và nằm trên một dòng.')
  }
  const expectedVersion = Number(transaction.expected_version || transaction.cloudVersion)
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error('Phiên bản khoản thu không hợp lệ. Vui lòng bấm Làm mới.')
  }
  const sourcePaymentId = requireText(
    transaction.sourcePaymentId || transaction.source_payment_id,
    'Khoản thu thiếu mã thanh toán Học phí.',
  )
  const sourceTuitionId = requireText(
    transaction.sourceTuitionId || transaction.source_tuition_id,
    'Khoản thu thiếu mã gói Học phí.',
  )
  if (sourcePaymentId.length > 240 || sourceTuitionId.length > 240
    || /[\u0000-\u001f\u007f]/.test(`${sourcePaymentId}${sourceTuitionId}`)) {
    throw new Error('Liên kết khoản thu Học phí không hợp lệ.')
  }
  return {
    operation: 'VOID_TUITION_PAYMENT',
    transaction_id: requireUuid(
      transaction.id || transaction.transaction_id,
      'Không xác định được khoản thu cần hủy.',
    ),
    source_module: 'hoc-phi',
    source_type: 'tuition-payment',
    source_payment_id: sourcePaymentId,
    source_tuition_id: sourceTuitionId,
    expected_version: expectedVersion,
    status: 'posted',
    reason: normalizedReason,
  }
}

export function buildC54SaveSettingsCommand(settings = {}) {
  return {
    operation: 'UPSERT_SETTINGS',
    expected_version: financeVersion(settings),
    opening_balance_minor: requireMoneyMinor(settings.openingBalance),
    opening_date: requireDate(settings.openingDate),
    updated_by_name: cleanText(settings.updatedBy),
  }
}

export function buildC54UpsertReconciliationCommand(reconciliation = {}) {
  return {
    operation: 'UPSERT_RECONCILIATION',
    reconciliation_id: financeVersion(reconciliation) > 0
      ? requireUuid(reconciliation.id, 'Thiếu reconciliation_id authoritative.')
      : createC54FinanceIdempotencyKey(),
    expected_version: financeVersion(reconciliation),
    reconciliation_date: requireDate(reconciliation.date),
    actual_cash_minor: requireMoneyMinor(reconciliation.actualCash),
    checked_by_name: requireText(reconciliation.checkedBy, 'Người đối soát không được trống.'),
    note: cleanText(reconciliation.note),
  }
}

export function buildC54CloseReconciliationCommand(reconciliation = {}) {
  return {
    operation: 'CLOSE_RECONCILIATION',
    reconciliation_id: requireUuid(reconciliation.id, 'Thiếu reconciliation_id authoritative.'),
    expected_version: requirePositiveVersion(reconciliation, 'Reconciliation'),
  }
}

export function createC54FinanceRetryFingerprint(command = {}, { attachmentIntent = '' } = {}) {
  const semantic = JSON.parse(JSON.stringify(command))
  if (semantic.operation === 'CREATE_TRANSACTION') {
    delete semantic.transaction_id
    delete semantic.local_source_id
    delete semantic.attachment_id
    if (semantic.attachment_action === 'BIND') {
      semantic.attachment_intent = cleanText(attachmentIntent)
    }
  }
  if (semantic.operation === 'CREATE_CATEGORY') delete semantic.category_id
  if (semantic.operation === 'UPSERT_RECONCILIATION' && semantic.expected_version === 0) {
    delete semantic.reconciliation_id
  }
  return JSON.stringify(Object.keys(semantic).sort().reduce((result, key) => {
    result[key] = semantic[key]
    return result
  }, {}))
}

export function projectC54FinanceCategory(row = {}) {
  const version = Number(row.version)
  const type = cleanText(row.category_type).toLowerCase()
  if (!isUuid(row.id) || !Number.isSafeInteger(version) || version < 1
    || !CATEGORY_TYPES.has(type) || !cleanText(row.name)) return null
  return {
    id: row.id,
    name: cleanText(row.name),
    type,
    isArchived: Boolean(row.is_archived),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
    cloudVersion: version,
  }
}

export function projectC54FinanceTransaction(row = {}) {
  const version = Number(row.version)
  const amount = Number(row.amount_minor)
  const type = cleanText(row.cashflow_type).toLowerCase()
  const status = cleanText(row.status).toLowerCase()
  if (!isUuid(row.id) || !Number.isSafeInteger(version) || version < 1
    || !Number.isSafeInteger(amount) || amount < 1
    || !CASHFLOW_TYPES.has(type) || !['posted', 'voided'].includes(status)
    || !isUuid(row.category_id) || !/^\d{4}-\d{2}-\d{2}$/.test(cleanText(row.transaction_date))
    || !Array.isArray(row.attachments)) return null
  const attachments = row.attachments.map(projectC54Attachment).filter(Boolean)
  if (attachments.length !== row.attachments.length) return null
  return {
    id: row.id,
    localSourceId: cleanText(row.local_source_id),
    transactionCode: cleanText(row.transaction_code),
    type,
    categoryId: cleanText(row.category_id),
    category: cleanText(row.category_name),
    amount,
    transactionDate: cleanText(row.transaction_date),
    method: cleanText(row.method),
    personName: cleanText(row.person_name),
    recordedBy: cleanText(row.recorded_by_name),
    note: cleanText(row.note),
    sourceModule: cleanText(row.source_module),
    sourceType: cleanText(row.source_type),
    sourcePaymentId: cleanText(row.source_payment_id),
    sourceTuitionId: cleanText(row.source_tuition_id),
    sourceStudentId: cleanText(row.source_student_id),
    sourceParentId: cleanText(row.source_parent_id),
    sourcePeriodId: cleanText(row.source_period_id),
    sourceTermId: cleanText(row.source_period_id),
    status,
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
    voidedAt: cleanText(row.voided_at),
    cloudVersion: version,
    attachments,
    ...(attachments[0] ? { attachment: attachments[0] } : {}),
  }
}

export function projectC54CashbookSettings(row, transactions = []) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    const transactionDates = transactions.map((item) => cleanText(item.transactionDate)).filter(Boolean)
    return {
      openingBalance: 0,
      openingDate: transactionDates.sort()[0] || new Date().toISOString().slice(0, 10),
      updatedAt: '',
      updatedBy: 'Admin',
      isConfigured: false,
      cloudVersion: 0,
    }
  }
  const version = Number(row.version)
  const openingBalance = Number(row.opening_balance_minor)
  if (!Number.isSafeInteger(version) || version < 1
    || !Number.isSafeInteger(openingBalance) || openingBalance < 0
    || !/^\d{4}-\d{2}-\d{2}$/.test(cleanText(row.opening_date))) {
    return null
  }
  return {
    openingBalance,
    openingDate: cleanText(row.opening_date),
    updatedAt: cleanText(row.updated_at),
    updatedBy: cleanText(row.updated_by_name) || 'Admin',
    isConfigured: Boolean(row.is_configured),
    cloudVersion: version,
  }
}

export function projectC54CashbookReconciliation(row = {}) {
  const version = Number(row.version)
  const systemClosingBalance = Number(row.system_closing_balance_minor)
  const actualCash = Number(row.actual_cash_minor)
  const difference = Number(row.difference_minor)
  const durableStatus = cleanText(row.status).toUpperCase()
  if (!isUuid(row.id) || ![version, systemClosingBalance, actualCash, difference]
    .every(Number.isSafeInteger) || version < 1 || actualCash < 0
    || !['OPEN', 'CLOSED'].includes(durableStatus)
    || !/^\d{4}-\d{2}-\d{2}$/.test(cleanText(row.reconciliation_date))) return null
  return {
    id: row.id,
    date: cleanText(row.reconciliation_date),
    systemClosingBalance,
    actualCash,
    difference,
    status: difference === 0 ? 'matched' : 'mismatched',
    checkedBy: cleanText(row.checked_by_name) || 'Admin',
    note: cleanText(row.note),
    checkedAt: cleanText(row.checked_at),
    updatedAt: cleanText(row.updated_at),
    isClosed: durableStatus === 'CLOSED',
    closedAt: row.closed_at || null,
    closedBy: row.closed_by_name || null,
    cloudVersion: version,
  }
}

export function getC54FinanceOutcomeMessage(outcomeCode) {
  const messages = {
    NOT_AUTHENTICATED: 'Phiên đăng nhập không hợp lệ; dữ liệu chưa được lưu.',
    CLIENT_NOT_READY: 'Không kết nối được máy chủ; dữ liệu chưa được lưu.',
    INVALID_CENTER: 'Cơ sở không hợp lệ; dữ liệu chưa được lưu.',
    CENTER_ACCESS_DENIED: 'Tài khoản không có quyền truy cập cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Vai trò hiện tại không được cập nhật Thu chi.',
    INVALID_COMMAND: 'Yêu cầu cập nhật Thu chi không hợp lệ.',
    INVALID_OPERATION: 'Thao tác Thu chi không hợp lệ.',
    INVALID_PAYLOAD: 'Dữ liệu Thu chi không hợp lệ.',
    INVALID_MONEY: 'Số tiền phải là số nguyên VND an toàn.',
    RESOURCE_NOT_FOUND_OR_DENIED: 'Không tìm thấy dữ liệu Thu chi trong cơ sở hiện tại.',
    VERSION_STALE: 'Dữ liệu đã được tài khoản khác cập nhật; hãy Làm mới trước khi lưu.',
    CATEGORY_ARCHIVED: 'Danh mục đã lưu trữ; không thể dùng cho giao dịch mới.',
    CATEGORY_NAME_CONFLICT: 'Tên danh mục đã tồn tại trong cơ sở này.',
    CATEGORY_IN_USE: 'Danh mục đang được giao dịch sử dụng.',
    SOURCE_TRANSACTION_CONFLICT: 'Payment/source này đã gắn với một giao dịch khác.',
    PROTECTED_TRANSACTION: 'Khoản thu Học phí chỉ có thể hủy từ màn hình Học phí và không thể sửa tùy ý trong Thu chi.',
    TUITION_SOURCE_NOT_FOUND: 'Không tìm thấy gói học phí phù hợp trong cơ sở hiện tại.',
    TUITION_SOURCE_INVALID: 'Gói học phí có số tiền không hợp lệ.',
    TUITION_PERIOD_STALE: 'Kỳ học phí đã thay đổi; hãy mở lại form thanh toán.',
    TUITION_LEGACY_PAYMENT_UNRECONCILED: 'Paid amount legacy chưa được đối soát với Finance.',
    TUITION_PAYMENT_EXCEEDS_OUTSTANDING: 'Khoản thanh toán vượt quá số tiền còn nợ.',
    CLOSED_PERIOD: 'Ngày giao dịch/thiết lập đã thuộc kỳ đối soát đóng.',
    RECONCILIATION_CLOSED: 'Đối soát đã đóng và không thể cập nhật.',
    RESOURCE_STATE_CONFLICT: 'Dữ liệu Finance đang ở trạng thái không cho phép thao tác này.',
    ATTACHMENT_NOT_FOUND_OR_DENIED: 'Chứng từ không tồn tại hoặc không thuộc đúng người/cơ sở.',
    ATTACHMENT_ALREADY_BOUND: 'Chứng từ đã được bind với giao dịch khác.',
    IDEMPOTENCY_CONFLICT: 'Khóa retry đã được dùng cho một lệnh Finance khác.',
    CONCURRENT_CONFLICT: 'Có lệnh Finance đồng thời; hãy Làm mới rồi thử lại.',
    INVALID_SERVER_RESULT: 'Máy chủ trả kết quả không hợp lệ; danh sách chưa thay đổi.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đã đổi; màn hình hiện tại không nhận dữ liệu từ cơ sở trước.',
    FINANCE_SHARED_TRUTH_READ_FAILED: 'Không tải được dữ liệu Thu chi; danh sách cũ không được coi là mới.',
    SERVER_COMMAND_FAILED: 'Không lưu được dữ liệu Thu chi lên máy chủ; danh sách chưa thay đổi.',
    COMMITTED_PROJECTION_REFRESH_FAILED: 'Khoản thu đã được hủy nhưng danh sách mới chưa tải lại được. Vui lòng bấm Làm mới.',
  }
  return messages[String(outcomeCode || '')] || 'Không thể cập nhật dữ liệu Thu chi.'
}

function projectC54Attachment(row = {}) {
  if (!isUuid(row.id)) return null
  return {
    id: row.id,
    metadataId: row.id,
    transactionCode: cleanText(row.transaction_code),
    transactionDate: cleanText(row.transaction_date),
    amount: Number(row.amount || 0),
    cashflowType: cleanText(row.cashflow_type),
    note: cleanText(row.note),
    originalName: cleanText(row.original_name),
    fileName: cleanText(row.file_name),
    name: cleanText(row.file_name || row.original_name),
    mimeType: cleanText(row.mime_type),
    type: cleanText(row.mime_type),
    sizeBytes: Number(row.size_bytes || 0),
    size: Number(row.size_bytes || 0),
    storageBucket: cleanText(row.storage_bucket),
    storagePath: cleanText(row.storage_path),
    uploadedBy: cleanText(row.uploaded_by),
    uploadedByName: cleanText(row.uploaded_by_name),
    createdAt: cleanText(row.created_at),
  }
}

function financeVersion(entity = {}) {
  const version = Number(entity?.cloudVersion)
  return Number.isSafeInteger(version) && version > 0 ? version : 0
}

function requirePositiveVersion(entity, label) {
  const version = financeVersion(entity)
  if (!version) throw new Error(`${label} version không hợp lệ.`)
  return version
}

function requireMoneyMinor(value) {
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error('Số tiền phải là số nguyên VND không âm và an toàn.')
  }
  return amount
}

function requireDate(value) {
  const date = cleanText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Ngày Finance không hợp lệ.')
  return date
}

function requireText(value, message) {
  const text = cleanText(value)
  if (!text) throw new Error(message)
  return text
}

function requireUuid(value, message) {
  const uuid = cleanText(value)
  if (!isUuid(uuid)) throw new Error(message)
  return uuid
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(cleanText(value))
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function failure(outcomeCode, error, detail = null, idempotencyKey = null) {
  return { ok: false, outcome_code: outcomeCode, error, detail, idempotencyKey }
}
