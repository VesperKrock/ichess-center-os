export const C56_INVENTORY_SHARED_TRUTH_SOURCE_VERSION =
  'c5.6-inventory-authoritative-shared-truth-v1'

export const C56_INVENTORY_CAPABILITY_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
})

const C56_BACKEND_UNAVAILABLE_CODES = new Set([
  '42P01',
  '42883',
  'PGRST202',
  'PGRST205',
  'BACKEND_NOT_DEPLOYED',
  'SCHEMA_NOT_READY',
])

const WRITE_ROLES = new Set(['owner', 'admin', 'center_admin', 'qtv'])
const MOVEMENT_TYPES = new Set(['in', 'out'])
const REQUEST_STATUSES = new Set([
  'new',
  'pending',
  'preparing',
  'fulfilled',
  'rejected',
  'cancelled',
])
const REQUEST_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent'])
const REQUEST_ITEM_TYPES = new Set([
  'book',
  'pencil',
  'eraser',
  'test',
  'standardChessSet',
  'chessClock',
  'scoreSheet',
  'other',
])
const REQUEST_USAGE_MODES = new Set([
  'homeTutoring',
  'onlinePrivate',
  'onlineGroup',
  'centerClass',
  'clubPartner',
  'other',
])

export function createC56InventoryCapabilityState(overrides = {}) {
  return {
    centerId: '',
    status: C56_INVENTORY_CAPABILITY_STATUS.IDLE,
    isLoading: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    ...overrides,
  }
}

export function isC56InventoryCapabilityReady(state = {}, centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return Boolean(
    normalizedCenterId
      && state.status === C56_INVENTORY_CAPABILITY_STATUS.READY
      && state.centerId === normalizedCenterId,
  )
}

export function isC56InventoryBackendUnavailable(result = {}) {
  const code = cleanText(result.outcome_code || result.code).toUpperCase()
  const detail = [result.error, result.message, result.details, result.hint]
    .map(cleanText)
    .join(' ')
    .toUpperCase()
  return C56_BACKEND_UNAVAILABLE_CODES.has(code)
    || [...C56_BACKEND_UNAVAILABLE_CODES].some((candidate) => detail.includes(candidate))
    || (
      detail.includes('C5_6_LIST_INVENTORY_SHARED_TRUTH')
      && (detail.includes('NOT FIND') || detail.includes('NOT FOUND'))
    )
}

export function createC56InventoryIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không thể tạo mã an toàn cho thao tác Kho hàng.')
  }
  return globalThis.crypto.randomUUID()
}

export function canWriteC56InventorySharedTruth(accessState = {}) {
  const role = cleanText(accessState?.role || accessState?.membership?.role).toLowerCase()
  const canWrite = Boolean(accessState?.canWrite !== false && WRITE_ROLES.has(role))
  return {
    ok: canWrite,
    canWrite,
    role,
    error: canWrite
      ? ''
      : 'Vai trò hiện tại chỉ được xem Kho hàng; dữ liệu chưa được lưu.',
  }
}

export async function pullC56InventorySharedTruth({ supabase, centerId } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY')
  }
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER')

  try {
    const { data, error } = await supabase.rpc('c5_6_list_inventory_shared_truth', {
      p_center_id: normalizedCenterId,
    })
    if (error) return c56InventoryRpcFailure(error, 'INVENTORY_SHARED_TRUTH_READ_FAILED')
    if (!data?.ok || !Array.isArray(data.items) || !Array.isArray(data.movements)
      || !Array.isArray(data.requests)) {
      return failure(String(data?.outcome_code || 'INVALID_SERVER_RESULT'), '', data)
    }
    if (cleanText(data.center_id) !== normalizedCenterId) return failure('CENTER_CONTEXT_CHANGED')

    const items = data.items.map((row) => projectC56InventoryItem(row, normalizedCenterId))
    const movements = data.movements.map((row) => projectC56InventoryMovement(row, normalizedCenterId))
    const requests = data.requests.map((row) => projectC56InventoryRequest(row, normalizedCenterId))
    if (items.some((row) => !row) || movements.some((row) => !row) || requests.some((row) => !row)) {
      return failure('INVALID_SERVER_RESULT', '', data)
    }
    const itemIds = new Set(items.map((item) => item.id))
    if (movements.some((movement) => !itemIds.has(movement.itemId))) {
      return failure('INVALID_SERVER_RESULT', '', data)
    }

    return {
      ok: true,
      outcome_code: data.outcome_code,
      centerId: normalizedCenterId,
      items,
      movements,
      requests,
    }
  } catch (error) {
    return c56InventoryRpcFailure(error, 'INVENTORY_SHARED_TRUTH_READ_FAILED')
  }
}

export async function mutateC56InventorySharedTruth({
  supabase,
  centerId,
  command,
  idempotencyKey = createC56InventoryIdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', '', null, idempotencyKey)
  }
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER', '', null, idempotencyKey)
  if (!isPlainObject(command)) return failure('INVALID_COMMAND', '', null, idempotencyKey)

  try {
    const { data, error } = await supabase.rpc('c5_6_mutate_inventory_shared_truth', {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return c56InventoryRpcFailure(error, 'SERVER_COMMAND_FAILED', idempotencyKey)
    if (!data?.ok) {
      return failure(String(data?.outcome_code || 'SERVER_COMMAND_FAILED'), '', data, idempotencyKey)
    }
    if (data.outcome_code !== 'COMMITTED' || !cleanText(data.entity_type)
      || !cleanText(data.entity_id) || !Number.isSafeInteger(Number(data.entity_version))) {
      return failure('INVALID_SERVER_RESULT', '', data, idempotencyKey)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return c56InventoryRpcFailure(error, 'SERVER_COMMAND_FAILED', idempotencyKey)
  }
}

export function buildC56SaveItemCommand(item = {}) {
  const version = authoritativeVersion(item)
  const command = {
    operation: version > 0 ? 'UPDATE_ITEM' : 'CREATE_ITEM',
    item_id: version > 0
      ? requireUuid(item.id, 'Không xác định được vật tư cần cập nhật.')
      : createC56InventoryIdempotencyKey(),
    expected_version: version,
    name: requireText(item.name, 'Tên vật tư không được trống.'),
    category: requireText(item.category, 'Nhóm vật tư không được trống.'),
    unit: requireText(item.unit, 'Đơn vị tính không được trống.'),
    low_stock_threshold: requireNonNegativeInteger(item.lowStockThreshold, 'Định mức tồn không hợp lệ.'),
    condition: requireText(item.condition, 'Tình trạng vật tư không được trống.'),
    location: cleanText(item.location),
    note: cleanText(item.note),
  }
  if (version === 0) {
    command.initial_quantity = requireNonNegativeInteger(item.quantity, 'Số lượng đầu kỳ không hợp lệ.')
  }
  return command
}

export function buildC56ArchiveItemCommand(item = {}) {
  return {
    operation: 'ARCHIVE_ITEM',
    item_id: requireUuid(item.id, 'Không xác định được vật tư cần lưu trữ.'),
    expected_version: requirePositiveVersion(item, 'Vật tư'),
  }
}

export function buildC56PostMovementCommand(movement = {}, item = {}) {
  const type = cleanText(movement.type).toLowerCase()
  if (!MOVEMENT_TYPES.has(type)) throw new Error('Loại nhập/xuất kho không hợp lệ.')
  return {
    operation: 'POST_MOVEMENT',
    movement_id: createC56InventoryIdempotencyKey(),
    item_id: requireUuid(item.id || movement.itemId, 'Vật tư cần nhập/xuất không hợp lệ.'),
    expected_version: requirePositiveVersion(item, 'Vật tư'),
    movement_type: type.toUpperCase(),
    quantity: requirePositiveInteger(movement.quantity, 'Số lượng nhập/xuất không hợp lệ.'),
    movement_date: requireDate(movement.movementDate),
    reason: requireText(movement.reason, 'Lý do nhập/xuất không được trống.'),
    note: cleanText(movement.note),
    cost_amount_minor: type === 'in'
      ? requireNonNegativeInteger(movement.costAmount || 0, 'Chi phí nhập kho không hợp lệ.')
      : 0,
    cost_method: type === 'in' ? cleanText(movement.costMethod) : '',
    supplier_name: type === 'in' ? cleanText(movement.supplierName) : '',
  }
}

export function buildC56CreateRequestCommand(request = {}) {
  const itemTypes = requireEnumArray(request.itemTypes, REQUEST_ITEM_TYPES, 'Loại vật tư đề xuất không hợp lệ.')
  const usageModes = requireEnumArray(request.usageModes, REQUEST_USAGE_MODES, 'Hình thức sử dụng không hợp lệ.')
  const priority = cleanText(request.priority).toLowerCase()
  if (!REQUEST_PRIORITIES.has(priority)) throw new Error('Mức ưu tiên đề xuất không hợp lệ.')
  return {
    operation: 'CREATE_REQUEST',
    request_id: createC56InventoryIdempotencyKey(),
    expected_version: 0,
    // These labels describe the business requester only. The server records
    // authenticated actor/membership/role separately and never trusts them as audit identity.
    requester_display_name: requireText(request.requestedByName, 'Tên người đề xuất không được trống.'),
    requester_role_label: cleanText(request.requestedByRole),
    linked_student_id: cleanText(request.linkedStudentId),
    student_display_name: requireText(request.studentName, 'Tên học viên/lớp không được trống.'),
    item_types: itemTypes,
    other_item_text: itemTypes.includes('other') ? cleanText(request.otherItemText) : '',
    item_details: requireText(request.itemDetails, 'Chi tiết đề xuất không được trống.'),
    usage_modes: usageModes,
    other_usage_text: usageModes.includes('other') ? cleanText(request.otherUsageText) : '',
    usage_location_detail: requireText(request.usageLocationDetail, 'Nơi sử dụng không được trống.'),
    needed_date: requireDate(request.neededDate),
    priority: priority.toUpperCase(),
    admin_note: cleanText(request.adminNote),
  }
}

export function buildC56UpdateRequestStatusCommand(request = {}, values = {}) {
  const status = cleanText(values.status).toLowerCase()
  if (!REQUEST_STATUSES.has(status)) throw new Error('Trạng thái đề xuất không hợp lệ.')
  return {
    operation: 'UPDATE_REQUEST_STATUS',
    request_id: requireUuid(request.id, 'Không xác định được đề xuất cần cập nhật.'),
    expected_version: requirePositiveVersion(request, 'Đề xuất'),
    status: status.toUpperCase(),
    admin_note: cleanText(values.adminNote),
  }
}

export function createC56InventoryRetryFingerprint(command = {}) {
  const semantic = JSON.parse(JSON.stringify(command))
  if (semantic.operation === 'CREATE_ITEM') delete semantic.item_id
  if (semantic.operation === 'POST_MOVEMENT') delete semantic.movement_id
  if (semantic.operation === 'CREATE_REQUEST') delete semantic.request_id
  return stableStringify(semantic)
}

export function projectC56InventoryItem(row = {}, expectedCenterId = '') {
  const version = Number(row.version)
  const quantity = Number(row.quantity)
  const threshold = Number(row.low_stock_threshold)
  const status = cleanText(row.status).toLowerCase()
  if (cleanText(row.center_id) !== expectedCenterId || !isUuid(row.id)
    || !Number.isSafeInteger(version) || version < 1
    || !Number.isSafeInteger(quantity) || quantity < 0
    || !Number.isSafeInteger(threshold) || threshold < 0
    || !['active', 'archived'].includes(status)
    || !cleanText(row.name) || !cleanText(row.category) || !cleanText(row.unit)
    || !cleanText(row.condition) || !cleanText(row.created_at) || !cleanText(row.updated_at)) return null
  return {
    id: row.id,
    name: cleanText(row.name),
    category: cleanText(row.category),
    unit: cleanText(row.unit),
    quantity,
    lowStockThreshold: threshold,
    condition: cleanText(row.condition),
    location: cleanText(row.location),
    note: cleanText(row.note),
    isArchived: status === 'archived',
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
    cloudVersion: version,
  }
}

export function projectC56InventoryMovement(row = {}, expectedCenterId = '') {
  const quantity = Number(row.quantity)
  const beforeQuantity = Number(row.before_quantity)
  const afterQuantity = Number(row.after_quantity)
  const costAmount = Number(row.cost_amount_minor)
  const type = cleanText(row.movement_type).toLowerCase()
  const consistent = type === 'in'
    ? afterQuantity === beforeQuantity + quantity
    : afterQuantity === beforeQuantity - quantity
  if (cleanText(row.center_id) !== expectedCenterId || !isUuid(row.id) || !isUuid(row.item_id)
    || !MOVEMENT_TYPES.has(type) || !Number.isSafeInteger(quantity) || quantity < 1
    || !Number.isSafeInteger(beforeQuantity) || beforeQuantity < 0
    || !Number.isSafeInteger(afterQuantity) || afterQuantity < 0 || !consistent
    || !Number.isSafeInteger(costAmount) || costAmount < 0
    || !/^\d{4}-\d{2}-\d{2}$/.test(cleanText(row.movement_date))
    || !cleanText(row.item_name) || !cleanText(row.reason)
    || !isUuid(row.actor_user_id) || !isUuid(row.actor_membership_id)
    || !cleanText(row.actor_role) || !cleanText(row.created_at)) return null
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: cleanText(row.item_name),
    type,
    quantity,
    movementDate: cleanText(row.movement_date),
    reason: cleanText(row.reason),
    handledBy: cleanText(row.actor_role),
    actorUserId: row.actor_user_id,
    actorMembershipId: row.actor_membership_id,
    actorRole: cleanText(row.actor_role),
    note: cleanText(row.note),
    costAmount,
    costMethod: cleanText(row.cost_method),
    supplierName: cleanText(row.supplier_name),
    beforeQuantity,
    afterQuantity,
    createdAt: cleanText(row.created_at),
  }
}

export function projectC56InventoryRequest(row = {}, expectedCenterId = '') {
  const version = Number(row.version)
  const priority = cleanText(row.priority).toLowerCase()
  const status = cleanText(row.status).toLowerCase()
  const itemTypes = normalizeEnumArray(row.item_types, REQUEST_ITEM_TYPES)
  const usageModes = normalizeEnumArray(row.usage_modes, REQUEST_USAGE_MODES)
  if (cleanText(row.center_id) !== expectedCenterId || !isUuid(row.id)
    || !Number.isSafeInteger(version) || version < 1
    || !/^DXK-\d{8}-\d{4,}$/.test(cleanText(row.request_code))
    || !REQUEST_PRIORITIES.has(priority) || !REQUEST_STATUSES.has(status)
    || !itemTypes || !usageModes || !itemTypes.length || !usageModes.length
    || !cleanText(row.requester_display_name) || !cleanText(row.student_display_name)
    || !cleanText(row.item_details) || !cleanText(row.usage_location_detail)
    || !/^\d{4}-\d{2}-\d{2}$/.test(cleanText(row.needed_date))
    || !isUuid(row.created_by_user_id) || !isUuid(row.created_by_membership_id)
    || !cleanText(row.created_by_role) || !cleanText(row.created_at) || !cleanText(row.updated_at)) return null
  const linkedStudentId = cleanText(row.linked_student_id)
  const handledAt = cleanText(row.handled_at)
  const handledUserId = cleanText(row.handled_by_user_id)
  const handledMembershipId = cleanText(row.handled_by_membership_id)
  if (linkedStudentId.length > 200
    || (handledAt && (!isUuid(handledUserId) || !isUuid(handledMembershipId)
      || !cleanText(row.handled_by_role)))) return null
  return {
    id: row.id,
    requestCode: cleanText(row.request_code),
    requestedByName: cleanText(row.requester_display_name),
    requestedByRole: cleanText(row.requester_role_label),
    // Phone is intentionally not durable Inventory authority. It belongs to
    // protected identity domains and is never copied from the legacy form.
    requestedByPhone: '',
    studentName: cleanText(row.student_display_name),
    linkedStudentId,
    itemTypes,
    otherItemText: cleanText(row.other_item_text),
    itemDetails: cleanText(row.item_details),
    usageModes,
    otherUsageText: cleanText(row.other_usage_text),
    usageLocationDetail: cleanText(row.usage_location_detail),
    neededDate: cleanText(row.needed_date),
    priority,
    status,
    adminNote: cleanText(row.admin_note),
    handledBy: cleanText(row.handled_by_role),
    handledAt,
    createdByUserId: row.created_by_user_id,
    createdByMembershipId: row.created_by_membership_id,
    createdByRole: cleanText(row.created_by_role),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
    cloudVersion: version,
  }
}

export function getC56InventoryOutcomeMessage(outcomeCode) {
  const messages = {
    NOT_AUTHENTICATED: 'Phiên đăng nhập không hợp lệ; dữ liệu Kho hàng chưa được lưu.',
    CLIENT_NOT_READY: 'Chưa kết nối được dữ liệu Kho hàng; thay đổi chưa được lưu.',
    INVALID_CENTER: 'Chưa xác định được cơ sở hợp lệ; thay đổi chưa được lưu.',
    CENTER_ACCESS_DENIED: 'Tài khoản không có quyền xem Kho hàng tại cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Vai trò hiện tại không được thay đổi Kho hàng.',
    INVALID_COMMAND: 'Yêu cầu cập nhật Kho hàng không hợp lệ.',
    INVALID_OPERATION: 'Thao tác Kho hàng này không được hỗ trợ.',
    INVALID_PAYLOAD: 'Dữ liệu Kho hàng không hợp lệ.',
    RESOURCE_NOT_FOUND_OR_DENIED: 'Không tìm thấy dữ liệu Kho hàng trong cơ sở hiện tại.',
    VERSION_STALE: 'Dữ liệu đã được tài khoản khác cập nhật; hãy Làm mới trước khi lưu.',
    ITEM_ARCHIVED: 'Vật tư đã lưu trữ; không thể nhập/xuất kho.',
    NEGATIVE_STOCK: 'Số lượng xuất vượt tồn hiện tại; thay đổi chưa được lưu.',
    INVALID_WORKFLOW_TRANSITION: 'Chuyển trạng thái đề xuất không hợp lệ.',
    STUDENT_REFERENCE_DENIED: 'Học viên liên kết không tồn tại trong đúng cơ sở.',
    IDEMPOTENCY_CONFLICT: 'Yêu cầu lưu này không còn khớp với nội dung hiện tại; hãy Làm mới rồi thử lại.',
    CONCURRENT_CONFLICT: 'Dữ liệu đang được cập nhật ở nơi khác; hãy Làm mới rồi thử lại.',
    INVALID_SERVER_RESULT: 'Dữ liệu Kho hàng nhận được không hợp lệ; danh sách hiện tại không được thay thế.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đã đổi; màn hình hiện tại không nhận dữ liệu của cơ sở trước.',
    BACKEND_NOT_DEPLOYED: 'Kho hàng hiện chưa khả dụng.',
    INVENTORY_SHARED_TRUTH_READ_FAILED: 'Chưa tải được dữ liệu Kho hàng. Dữ liệu đang hiển thị có thể chưa phải bản mới nhất.',
    SERVER_COMMAND_FAILED: 'Chưa thể lưu thay đổi Kho hàng. Nội dung đang nhập vẫn được giữ nguyên.',
    COMMITTED_PROJECTION_REFRESH_FAILED: 'Thay đổi đã được lưu nhưng chưa tải lại được danh sách mới nhất. Hãy bấm Làm mới.',
  }
  return messages[String(outcomeCode || '')] || 'Chưa thể cập nhật Kho hàng lúc này.'
}

function authoritativeVersion(value = {}) {
  const version = Number(value.cloudVersion ?? value.version ?? 0)
  if (!Number.isSafeInteger(version) || version < 0) throw new Error('Phiên bản dữ liệu Kho hàng không hợp lệ.')
  return version
}

function requirePositiveVersion(value, label) {
  const version = authoritativeVersion(value)
  if (version < 1) throw new Error(`${label} chưa có phiên bản dữ liệu hợp lệ.`)
  return version
}

function requireNonNegativeInteger(value, message) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(message)
  return number
}

function requirePositiveInteger(value, message) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(message)
  return number
}

function requireDate(value) {
  const date = cleanText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Ngày Kho hàng không hợp lệ.')
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Ngày Kho hàng không hợp lệ.')
  }
  return date
}

function requireEnumArray(values, allowed, message) {
  const result = normalizeEnumArray(values, allowed)
  if (!result || !result.length) throw new Error(message)
  return result
}

function normalizeEnumArray(values, allowed) {
  if (!Array.isArray(values)) return null
  const normalized = [...new Set(values.map(cleanText).filter(Boolean))]
  return normalized.length === values.length && normalized.every((value) => allowed.has(value))
    ? normalized
    : null
}

function requireText(value, message) {
  const text = cleanText(value)
  if (!text) throw new Error(message)
  return text
}

function requireUuid(value, message) {
  const id = cleanText(value)
  if (!isUuid(id)) throw new Error(message)
  return id
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value))
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

function failure(outcomeCode, detail = '', raw = null, idempotencyKey = '') {
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: detail || getC56InventoryOutcomeMessage(outcomeCode),
    raw,
    idempotencyKey,
  }
}

function c56InventoryRpcFailure(error, fallbackCode, idempotencyKey = '') {
  const unavailable = isC56InventoryBackendUnavailable({
    outcome_code: error?.code,
    error: error?.message,
    details: error?.details,
    hint: error?.hint,
  })
  const outcomeCode = unavailable ? 'BACKEND_NOT_DEPLOYED' : fallbackCode
  return failure(outcomeCode, getC56InventoryOutcomeMessage(outcomeCode), error, idempotencyKey)
}
