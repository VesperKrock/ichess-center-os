export const C56_INVENTORY_SHARED_TRUTH_SOURCE_VERSION =
  'c5.6-inventory-authoritative-shared-truth-v1'

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

export function createC56InventoryIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không hỗ trợ crypto.randomUUID cho lệnh Inventory C5.6.')
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
      : 'Vai trò hiện tại chỉ được đọc Inventory; dữ liệu chưa được lưu.',
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
    if (error) return failure('INVENTORY_SHARED_TRUTH_READ_FAILED', String(error.message || error), error)
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
    return failure('INVENTORY_SHARED_TRUTH_READ_FAILED', String(error?.message || error), error)
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
    if (error) return failure('SERVER_COMMAND_FAILED', String(error.message || error), error, idempotencyKey)
    if (!data?.ok) {
      return failure(String(data?.outcome_code || 'SERVER_COMMAND_FAILED'), '', data, idempotencyKey)
    }
    if (data.outcome_code !== 'COMMITTED' || !cleanText(data.entity_type)
      || !cleanText(data.entity_id) || !Number.isSafeInteger(Number(data.entity_version))) {
      return failure('INVALID_SERVER_RESULT', '', data, idempotencyKey)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return failure('SERVER_COMMAND_FAILED', String(error?.message || error), error, idempotencyKey)
  }
}

export function buildC56SaveItemCommand(item = {}) {
  const version = authoritativeVersion(item)
  const command = {
    operation: version > 0 ? 'UPDATE_ITEM' : 'CREATE_ITEM',
    item_id: version > 0
      ? requireUuid(item.id, 'Thiếu item_id authoritative.')
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
    item_id: requireUuid(item.id, 'Thiếu item_id authoritative.'),
    expected_version: requirePositiveVersion(item, 'Item'),
  }
}

export function buildC56PostMovementCommand(movement = {}, item = {}) {
  const type = cleanText(movement.type).toLowerCase()
  if (!MOVEMENT_TYPES.has(type)) throw new Error('Loại nhập/xuất kho không hợp lệ.')
  return {
    operation: 'POST_MOVEMENT',
    movement_id: createC56InventoryIdempotencyKey(),
    item_id: requireUuid(item.id || movement.itemId, 'Vật tư authoritative không hợp lệ.'),
    expected_version: requirePositiveVersion(item, 'Item'),
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
    request_id: requireUuid(request.id, 'Thiếu request_id authoritative.'),
    expected_version: requirePositiveVersion(request, 'Request'),
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
    NOT_AUTHENTICATED: 'Phiên đăng nhập không hợp lệ; Inventory chưa được lưu.',
    CLIENT_NOT_READY: 'Không kết nối được cloud; Inventory chưa được lưu.',
    INVALID_CENTER: 'Cơ sở không hợp lệ; Inventory chưa được lưu.',
    CENTER_ACCESS_DENIED: 'Tài khoản không có quyền đọc Inventory tại cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Vai trò hiện tại không được thay đổi Inventory.',
    INVALID_COMMAND: 'Lệnh Inventory không hợp lệ.',
    INVALID_OPERATION: 'Thao tác không thuộc authoritative Inventory C5.6.',
    INVALID_PAYLOAD: 'Dữ liệu Inventory không hợp lệ.',
    RESOURCE_NOT_FOUND_OR_DENIED: 'Không tìm thấy dữ liệu Inventory trong đúng cơ sở.',
    VERSION_STALE: 'Inventory đã được tài khoản khác cập nhật; hãy Làm mới trước khi lưu.',
    ITEM_ARCHIVED: 'Vật tư đã lưu trữ; không thể nhập/xuất kho.',
    NEGATIVE_STOCK: 'Xuất kho vượt tồn hiện tại; server không commit thay đổi.',
    INVALID_WORKFLOW_TRANSITION: 'Chuyển trạng thái đề xuất không hợp lệ.',
    STUDENT_REFERENCE_DENIED: 'Học viên liên kết không tồn tại trong đúng cơ sở.',
    IDEMPOTENCY_CONFLICT: 'Khóa retry đã được dùng cho một lệnh Inventory khác.',
    CONCURRENT_CONFLICT: 'Có lệnh Inventory đồng thời; hãy Làm mới rồi thử lại.',
    INVALID_SERVER_RESULT: 'Server trả Inventory không hợp lệ; projection chưa thay đổi.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đã đổi; view hiện tại không nhận dữ liệu cơ sở trước.',
    INVENTORY_SHARED_TRUTH_READ_FAILED: 'Không đọc được authoritative Inventory; projection chưa thay đổi.',
    SERVER_COMMAND_FAILED: 'Không commit được Inventory lên server; projection chưa thay đổi.',
    COMMITTED_PROJECTION_REFRESH_FAILED: 'Inventory đã commit server nhưng chưa tải lại được projection.',
  }
  return messages[String(outcomeCode || '')] || 'Không thể cập nhật authoritative Inventory.'
}

function authoritativeVersion(value = {}) {
  const version = Number(value.cloudVersion ?? value.version ?? 0)
  if (!Number.isSafeInteger(version) || version < 0) throw new Error('Version Inventory không hợp lệ.')
  return version
}

function requirePositiveVersion(value, label) {
  const version = authoritativeVersion(value)
  if (version < 1) throw new Error(`${label} chưa có version authoritative.`)
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Ngày Inventory không hợp lệ.')
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Ngày Inventory không hợp lệ.')
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
