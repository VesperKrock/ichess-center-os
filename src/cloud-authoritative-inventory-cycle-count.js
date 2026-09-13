export const V27A_INVENTORY_CYCLE_COUNT_SOURCE_VERSION =
  'v2.7a-inventory-blind-cycle-count-v1'

export const V27A_INVENTORY_CYCLE_COUNT_CAPABILITY_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
})

const BACKEND_UNAVAILABLE_CODES = new Set([
  '42P01',
  '42883',
  'PGRST202',
  'PGRST205',
  'BACKEND_NOT_DEPLOYED',
  'SCHEMA_NOT_READY',
])
const COUNT_STATUSES = new Set(['draft', 'submitted', 'reconciled', 'cancelled'])
const DUE_STATES = new Set(['upcoming', 'due', 'overdue', ''])
const BLIND_FORBIDDEN_KEYS = new Set([
  'expected_quantity',
  'expected_quantity_snapshot',
  'expected_item_version',
  'system_quantity',
  'variance',
  'observed_quantity',
])

export function createV27AInventoryCycleCountCapabilityState(overrides = {}) {
  return {
    centerId: '',
    status: V27A_INVENTORY_CYCLE_COUNT_CAPABILITY_STATUS.IDLE,
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    ...overrides,
  }
}

export function isV27AInventoryCycleCountCapabilityReady(state = {}, centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return Boolean(
    normalizedCenterId
      && state.status === V27A_INVENTORY_CYCLE_COUNT_CAPABILITY_STATUS.READY
      && state.centerId === normalizedCenterId,
  )
}

export function isV27AInventoryCycleCountBackendUnavailable(result = {}) {
  const code = cleanText(result.outcome_code || result.code).toUpperCase()
  const detail = [result.error, result.message, result.details, result.hint]
    .map(cleanText)
    .join(' ')
    .toUpperCase()
  return BACKEND_UNAVAILABLE_CODES.has(code)
    || [...BACKEND_UNAVAILABLE_CODES].some((candidate) => detail.includes(candidate))
    || (
      detail.includes('V2_7A_LIST_INVENTORY_CYCLE_COUNTS')
      && (detail.includes('NOT FIND') || detail.includes('NOT FOUND'))
    )
}

export async function pullV27AInventoryCycleCounts({ supabase, centerId } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY')
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER')

  try {
    const { data, error } = await supabase.rpc('v2_7a_list_inventory_cycle_counts', {
      p_center_id: normalizedCenterId,
    })
    if (error) return rpcFailure(error, 'CYCLE_COUNT_READ_FAILED')
    if (!data?.ok || !Array.isArray(data.counts)) {
      return failure(String(data?.outcome_code || 'INVALID_SERVER_RESULT'))
    }
    if (cleanText(data.center_id) !== normalizedCenterId) return failure('CENTER_CONTEXT_CHANGED')

    const counts = data.counts.map((row) => projectV27AInventoryCycleCount(row, normalizedCenterId))
    if (counts.some((count) => !count)) return failure('INVALID_SERVER_RESULT')
    return {
      ok: true,
      outcome_code: data.outcome_code,
      centerId: normalizedCenterId,
      counts,
    }
  } catch (error) {
    return rpcFailure(error, 'CYCLE_COUNT_READ_FAILED')
  }
}

export async function mutateV27AInventoryCycleCount({
  supabase,
  centerId,
  command,
  idempotencyKey = createV27AInventoryCycleCountIdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', idempotencyKey)
  }
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER', idempotencyKey)
  if (!isPlainObject(command)) return failure('INVALID_COMMAND', idempotencyKey)

  try {
    const { data, error } = await supabase.rpc('v2_7a_mutate_inventory_cycle_count', {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return rpcFailure(error, 'SERVER_COMMAND_FAILED', idempotencyKey)
    if (!data?.ok) {
      return failure(String(data?.outcome_code || 'SERVER_COMMAND_FAILED'), idempotencyKey)
    }
    if (data.outcome_code !== 'COMMITTED'
      || data.entity_type !== 'inventory_cycle_count'
      || !isUuid(data.entity_id)
      || !Number.isSafeInteger(Number(data.entity_version))) {
      return failure('INVALID_SERVER_RESULT', idempotencyKey)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return rpcFailure(error, 'SERVER_COMMAND_FAILED', idempotencyKey)
  }
}

export function buildV27AStartCycleCountCommand(dueDate) {
  return {
    operation: 'START_COUNT',
    count_id: createV27AInventoryCycleCountIdempotencyKey(),
    expected_version: 0,
    due_date: requireDate(dueDate),
  }
}

export function buildV27ASubmitCycleCountCommand(count = {}, observedByLineId = {}) {
  requireMutableCount(count, 'draft')
  const lines = count.lines.map((line) => ({
    line_id: requireUuid(line.id, 'Dòng kiểm kê không hợp lệ.'),
    observed_quantity: requireNonNegativeInteger(
      observedByLineId[line.id],
      `Vui lòng nhập số lượng đã đếm cho ${line.itemName || 'vật tư'}.`,
    ),
  }))
  return {
    operation: 'SUBMIT_COUNT',
    count_id: count.id,
    expected_version: count.cloudVersion,
    lines: lines.sort((a, b) => a.line_id.localeCompare(b.line_id)),
  }
}

export function buildV27AReconcileCycleCountCommand(count = {}, explanationByLineId = {}) {
  requireMutableCount(count, 'submitted')
  const explanations = count.lines
    .filter((line) => line.variance !== 0)
    .map((line) => ({
      line_id: requireUuid(line.id, 'Dòng chênh lệch kiểm kê không hợp lệ.'),
      explanation: requireText(
        explanationByLineId[line.id],
        `Vui lòng giải thích chênh lệch của ${line.itemName || 'vật tư'}.`,
      ),
    }))
    .sort((a, b) => a.line_id.localeCompare(b.line_id))
  return {
    operation: 'RECONCILE_COUNT',
    count_id: count.id,
    expected_version: count.cloudVersion,
    explanations,
  }
}

export function buildV27ACancelCycleCountCommand(count = {}) {
  if (!['draft', 'submitted'].includes(count.status)) {
    throw new Error('Phiên kiểm kê này không thể hủy.')
  }
  return {
    operation: 'CANCEL_COUNT',
    count_id: requireUuid(count.id, 'Phiên kiểm kê không hợp lệ.'),
    expected_version: requirePositiveInteger(count.cloudVersion, 'Phiên kiểm kê chưa có dữ liệu mới nhất.'),
  }
}

export function createV27AInventoryCycleCountRetryFingerprint(command = {}) {
  const semantic = JSON.parse(JSON.stringify(command))
  if (semantic.operation === 'START_COUNT') delete semantic.count_id
  return stableStringify(semantic)
}

export function createV27AInventoryCycleCountIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không thể tạo mã an toàn cho thao tác kiểm kê.')
  }
  return globalThis.crypto.randomUUID()
}

export function projectV27AInventoryCycleCount(row = {}, expectedCenterId = '') {
  const centerId = cleanText(row.center_id)
  const status = cleanText(row.status).toLowerCase()
  const dueState = cleanText(row.due_state).toLowerCase()
  const version = Number(row.version)
  const itemCount = Number(row.item_count)
  const submittedAt = cleanText(row.submitted_at)
  const reconciledAt = cleanText(row.reconciled_at)
  const cancelledAt = cleanText(row.cancelled_at)
  const isBlind = status === 'draft' || (status === 'cancelled' && !submittedAt)
  if (centerId !== expectedCenterId || !isUuid(row.id) || !COUNT_STATUSES.has(status)
    || !DUE_STATES.has(dueState) || !isDate(row.due_date)
    || !Number.isSafeInteger(version) || version < 1
    || !Number.isSafeInteger(itemCount) || itemCount < 1
    || !/^KKK-\d{8}-\d{4,}$/.test(cleanText(row.count_code))
    || !cleanText(row.created_at) || !cleanText(row.updated_at)
    || !Array.isArray(row.lines) || row.lines.length !== itemCount
    || ((status === 'draft' || status === 'submitted') && !dueState)
    || (!['draft', 'submitted'].includes(status) && dueState)
    || (status === 'draft' && (submittedAt || reconciledAt || cancelledAt))
    || (status === 'submitted' && (!submittedAt || reconciledAt || cancelledAt))
    || (status === 'reconciled' && (!submittedAt || !reconciledAt || cancelledAt))
    || (status === 'cancelled' && (!cancelledAt || reconciledAt))) return null

  const lines = row.lines.map((line) => projectCycleCountLine(line, centerId, isBlind, status))
  if (lines.some((line) => !line)) return null
  if (new Set(lines.map((line) => line.id)).size !== lines.length
    || new Set(lines.map((line) => line.itemId)).size !== lines.length) return null

  return {
    id: row.id,
    centerId,
    countCode: cleanText(row.count_code),
    dueDate: row.due_date,
    dueState,
    status,
    itemCount,
    cloudVersion: version,
    isBlind,
    lines,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt,
    reconciledAt,
    cancelledAt,
    sourceVersion: V27A_INVENTORY_CYCLE_COUNT_SOURCE_VERSION,
  }
}

export function getV27AInventoryCycleCountOutcomeMessage(outcomeCode) {
  const messages = {
    NOT_AUTHENTICATED: 'Cần đăng nhập để xem hoặc cập nhật kiểm kê.',
    INVALID_CENTER: 'Chưa xác định được cơ sở đang hoạt động.',
    CENTER_ACCESS_DENIED: 'Bạn không có quyền truy cập kiểm kê của cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Vai trò hiện tại chỉ được xem kiểm kê; thay đổi chưa được lưu.',
    BACKEND_NOT_DEPLOYED: 'Tính năng kiểm kê chưa sẵn sàng tại cơ sở này.',
    CLIENT_NOT_READY: 'Kiểm kê chưa tải xong dữ liệu mới nhất; thay đổi chưa được lưu.',
    CYCLE_COUNT_READ_FAILED: 'Không thể tải dữ liệu kiểm kê mới nhất.',
    SERVER_COMMAND_FAILED: 'Không thể lưu thay đổi kiểm kê.',
    INVALID_SERVER_RESULT: 'Dữ liệu kiểm kê trả về không hợp lệ và đã bị từ chối.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đang hoạt động đã thay đổi; dữ liệu kiểm kê cũ đã bị đóng.',
    INVALID_COMMAND: 'Yêu cầu kiểm kê không hợp lệ.',
    INVALID_OPERATION: 'Thao tác kiểm kê không hợp lệ.',
    INVALID_PAYLOAD: 'Thông tin kiểm kê không hợp lệ.',
    RESOURCE_NOT_FOUND_OR_DENIED: 'Không tìm thấy phiên kiểm kê tại cơ sở hiện tại.',
    ACTIVE_COUNT_EXISTS: 'Cơ sở đang có một phiên kiểm kê chưa hoàn tất.',
    EMPTY_COUNT_SCOPE: 'Không có vật tư đang hoạt động để bắt đầu kiểm kê.',
    COUNT_SCOPE_MISMATCH: 'Danh sách kiểm kê không còn đầy đủ; vui lòng tải lại.',
    EXPLANATION_REQUIRED: 'Mỗi chênh lệch phải có giải thích trước khi đối soát.',
    VERSION_STALE: 'Tồn kho hoặc phiên kiểm kê đã thay đổi; cần tải lại và bắt đầu kiểm kê mới.',
    INVALID_WORKFLOW_TRANSITION: 'Trạng thái kiểm kê không cho phép thao tác này.',
    IDEMPOTENCY_CONFLICT: 'Yêu cầu lặp lại không khớp nội dung ban đầu và đã bị từ chối.',
    CONCURRENT_CONFLICT: 'Có thay đổi kiểm kê đồng thời; vui lòng tải lại.',
    COMMITTED_PROJECTION_REFRESH_FAILED: 'Thay đổi đã lưu nhưng chưa thể tải lại kiểm kê mới nhất.',
  }
  return messages[cleanText(outcomeCode).toUpperCase()] || 'Không thể hoàn tất thao tác kiểm kê.'
}

function projectCycleCountLine(row, expectedCenterId, isBlind, countStatus) {
  if (!isPlainObject(row) || cleanText(row.center_id) !== expectedCenterId
    || !isUuid(row.id) || !isUuid(row.item_id)
    || !cleanText(row.item_name) || !cleanText(row.item_category) || !cleanText(row.item_unit)) {
    return null
  }
  if (isBlind) {
    const normalizedKeys = Object.keys(row).map((key) => key
      .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
      .toLowerCase())
    if (normalizedKeys.some((key) => BLIND_FORBIDDEN_KEYS.has(key)
      || /(^|_)(expected|system).*quantity|variance|observed.*quantity|item.*version/.test(key))) return null
    return {
      id: row.id,
      centerId: expectedCenterId,
      itemId: row.item_id,
      itemName: cleanText(row.item_name),
      itemCategory: cleanText(row.item_category),
      itemUnit: cleanText(row.item_unit),
      itemLocation: cleanText(row.item_location),
    }
  }

  const expectedQuantity = Number(row.expected_quantity)
  const observedQuantity = Number(row.observed_quantity)
  const variance = Number(row.variance)
  const explanation = cleanText(row.explanation)
  const movementId = cleanText(row.reconciliation_movement_id)
  if (!Number.isSafeInteger(expectedQuantity) || expectedQuantity < 0
    || !Number.isSafeInteger(observedQuantity) || observedQuantity < 0
    || !Number.isSafeInteger(variance) || variance !== observedQuantity - expectedQuantity
    || (countStatus === 'reconciled' && variance !== 0 && (!explanation || !isUuid(movementId)))
    || (countStatus === 'reconciled' && variance === 0 && movementId)
    || (countStatus === 'submitted' && movementId)) return null
  return {
    id: row.id,
    centerId: expectedCenterId,
    itemId: row.item_id,
    itemName: cleanText(row.item_name),
    itemCategory: cleanText(row.item_category),
    itemUnit: cleanText(row.item_unit),
    itemLocation: cleanText(row.item_location),
    expectedQuantity,
    observedQuantity,
    variance,
    explanation,
    reconciliationMovementId: movementId,
  }
}

function requireMutableCount(count, requiredStatus) {
  if (count.status !== requiredStatus) throw new Error('Trạng thái phiên kiểm kê không hợp lệ.')
  requireUuid(count.id, 'Phiên kiểm kê không hợp lệ.')
  requirePositiveInteger(count.cloudVersion, 'Phiên kiểm kê chưa có dữ liệu mới nhất.')
  if (!Array.isArray(count.lines) || !count.lines.length) {
    throw new Error('Phiên kiểm kê không có danh sách vật tư hợp lệ.')
  }
}

function requireNonNegativeInteger(value, message) {
  const number = Number(value)
  if (value === '' || value === null || value === undefined
    || !Number.isSafeInteger(number) || number < 0 || number > 2147483647) throw new Error(message)
  return number
}

function requirePositiveInteger(value, message) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(message)
  return number
}

function requireText(value, message) {
  const text = cleanText(value)
  if (!text) throw new Error(message)
  if (text.length > 2000) throw new Error('Giải thích chênh lệch không được vượt quá 2.000 ký tự.')
  return text
}

function requireDate(value) {
  const date = cleanText(value)
  if (!isDate(date)) throw new Error('Ngày đến hạn kiểm kê không hợp lệ.')
  return date
}

function isDate(value) {
  const date = cleanText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

function requireUuid(value, message) {
  const id = cleanText(value)
  if (!isUuid(id)) throw new Error(message)
  return id
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(cleanText(value))
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (!isPlainObject(value)) return JSON.stringify(value)
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

function failure(outcomeCode, idempotencyKey = '') {
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: getV27AInventoryCycleCountOutcomeMessage(outcomeCode),
    idempotencyKey,
  }
}

function rpcFailure(error, fallbackCode, idempotencyKey = '') {
  const unavailable = isV27AInventoryCycleCountBackendUnavailable({
    outcome_code: error?.code,
    error: error?.message,
    details: error?.details,
    hint: error?.hint,
  })
  return failure(unavailable ? 'BACKEND_NOT_DEPLOYED' : fallbackCode, idempotencyKey)
}
