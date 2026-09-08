export const V21_CENTER_SETTINGS_CAPABILITY_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
})

export const V21_SHARED_WALLPAPER_BUCKET = 'ichess-os-wallpapers'

const BACKEND_UNAVAILABLE_CODES = new Set([
  '42P01',
  '42883',
  'PGRST202',
  'PGRST205',
  'BACKEND_NOT_DEPLOYED',
  'SCHEMA_NOT_READY',
])

const WRITE_ROLES = new Set(['owner', 'admin', 'center_admin', 'qtv'])

export function createV21CenterSettingsCapabilityState(overrides = {}) {
  return {
    centerId: '',
    status: V21_CENTER_SETTINGS_CAPABILITY_STATUS.IDLE,
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    ...overrides,
  }
}

export function isV21CenterSettingsCapabilityReady(state = {}, centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return Boolean(
    normalizedCenterId
      && state.status === V21_CENTER_SETTINGS_CAPABILITY_STATUS.READY
      && state.centerId === normalizedCenterId,
  )
}

export function isV21CenterSettingsBackendUnavailable(result = {}) {
  const code = cleanText(result.outcome_code || result.code).toUpperCase()
  const detail = [result.error, result.message, result.details, result.hint]
    .map(cleanText)
    .join(' ')
    .toUpperCase()
  return BACKEND_UNAVAILABLE_CODES.has(code)
    || [...BACKEND_UNAVAILABLE_CODES].some((candidate) => detail.includes(candidate))
    || (
      detail.includes('V2_1_LIST_CENTER_SETTINGS')
      && (detail.includes('NOT FIND') || detail.includes('NOT FOUND'))
    )
}

export function canWriteV21CenterSettings(accessState = {}) {
  const role = cleanText(accessState?.role || accessState?.membership?.role).toLowerCase()
  const canWrite = Boolean(accessState?.canWrite !== false && WRITE_ROLES.has(role))
  return {
    ok: canWrite,
    canWrite,
    role,
    error: canWrite ? '' : 'Tài khoản hiện tại không có quyền thay đổi cài đặt cơ sở.',
  }
}

export function createV21SettingsIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không thể tạo mã an toàn cho thao tác cài đặt.')
  }
  return globalThis.crypto.randomUUID()
}

export function createV21SettingsRetryFingerprint(command = {}) {
  const semantic = JSON.parse(JSON.stringify(command))
  return stableStringify(semantic)
}

export async function pullV21CenterSettings({ supabase, centerId } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY')
  }
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER')

  try {
    const { data, error } = await supabase.rpc('v2_1_list_center_settings', {
      p_center_id: normalizedCenterId,
    })
    if (error) return rpcFailure(error, 'CENTER_SETTINGS_READ_FAILED')
    if (!data?.ok) {
      return failure(String(data?.outcome_code || 'INVALID_SERVER_RESULT'))
    }
    if (cleanText(data.center_id) !== normalizedCenterId) {
      return failure('CENTER_CONTEXT_CHANGED')
    }

    const centerProfile = projectCenterProfile(data.center, normalizedCenterId)
    const tuitionPackages = Array.isArray(data.tuition_packages)
      ? data.tuition_packages.map((row) => projectTuitionPackage(row, normalizedCenterId))
      : null
    const sharedWallpaper = data.shared_wallpaper == null
      ? null
      : projectSharedWallpaper(data.shared_wallpaper)
    const sharedWallpaperVersion = Number(data.shared_wallpaper_version)
    if (!centerProfile || !tuitionPackages || tuitionPackages.some((row) => !row)
      || (data.shared_wallpaper != null && !sharedWallpaper)
      || !Number.isSafeInteger(sharedWallpaperVersion) || sharedWallpaperVersion < 0
      || (sharedWallpaper && sharedWallpaper.version !== sharedWallpaperVersion)) {
      return failure('INVALID_SERVER_RESULT')
    }

    return {
      ok: true,
      outcome_code: cleanText(data.outcome_code) || 'AUTHORITATIVE_SNAPSHOT',
      centerId: normalizedCenterId,
      centerProfile,
      tuitionPackages,
      sharedWallpaper,
      sharedWallpaperVersion,
      canManageSharedWallpaper: data.can_manage_shared_wallpaper === true,
    }
  } catch (error) {
    return rpcFailure(error, 'CENTER_SETTINGS_READ_FAILED')
  }
}

export async function mutateV21CenterSettings({
  supabase,
  centerId,
  command,
  idempotencyKey = createV21SettingsIdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', idempotencyKey)
  }
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER', idempotencyKey)
  if (!isPlainObject(command)) return failure('INVALID_COMMAND', idempotencyKey)

  try {
    const { data, error } = await supabase.rpc('v2_1_mutate_center_settings', {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return rpcFailure(error, 'CENTER_SETTINGS_WRITE_FAILED', idempotencyKey)
    if (!data?.ok || cleanText(data.center_id) !== normalizedCenterId
      || cleanText(data.outcome_code) !== 'COMMITTED') {
      return failure(cleanText(data?.outcome_code) || 'INVALID_SERVER_RESULT', idempotencyKey, data)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return rpcFailure(error, 'CENTER_SETTINGS_WRITE_FAILED', idempotencyKey)
  }
}

export function buildV21UpdateCenterProfileCommand(values = {}, current = {}) {
  return {
    operation: 'UPDATE_CENTER_PROFILE',
    expected_version: authoritativeVersion(current),
    display_name: requireText(values.displayName, 'Tên hiển thị cơ sở không được trống.'),
    address: cleanText(values.address),
    phone: cleanText(values.phone),
    note: cleanText(values.note),
  }
}

export function buildV21UpsertTuitionPackageCommand(values = {}, current = null) {
  const version = authoritativeVersion(current)
  return {
    operation: version > 0 ? 'UPDATE_TUITION_PACKAGE' : 'CREATE_TUITION_PACKAGE',
    package_id: version > 0
      ? requireUuid(current.id, 'Không xác định được gói học phí cần sửa.')
      : createV21SettingsIdempotencyKey(),
    expected_version: version,
    package_name: requireText(values.packageName, 'Tên gói học phí không được trống.'),
    total_sessions: requirePositiveInteger(values.totalSessions, 'Số buổi phải lớn hơn 0.'),
    default_amount: requireNonNegativeInteger(values.defaultAmount, 'Học phí mặc định không hợp lệ.'),
    is_active: values.isActive !== false && values.isActive !== 'false',
    note: cleanText(values.note),
  }
}

export function buildV21SetTuitionPackageStatusCommand(tuitionPackage = {}, isActive) {
  return {
    operation: 'SET_TUITION_PACKAGE_STATUS',
    package_id: requireUuid(tuitionPackage.id, 'Không xác định được gói học phí.'),
    expected_version: requirePositiveVersion(tuitionPackage),
    is_active: Boolean(isActive),
  }
}

export function buildV21SetSharedWallpaperCommand(sharedWallpaper = {}, expectedVersion = 0) {
  const path = cleanText(sharedWallpaper.path)
  if (!/^shared\/[0-9a-f-]{36}\.webp$/i.test(path)) {
    throw new Error('Đường dẫn hình nền dùng chung không hợp lệ.')
  }
  return {
    operation: 'SET_SHARED_WALLPAPER',
    expected_version: Number(expectedVersion) || 0,
    storage_bucket: V21_SHARED_WALLPAPER_BUCKET,
    storage_path: path,
    mime_type: 'image/webp',
  }
}

export function buildV21ClearSharedWallpaperCommand(expectedVersion = 0) {
  return {
    operation: 'CLEAR_SHARED_WALLPAPER',
    expected_version: Number(expectedVersion) || 0,
  }
}

export async function uploadV21SharedWallpaper({ supabase, blob, path } = {}) {
  if (!supabase?.storage || typeof supabase.storage.from !== 'function') {
    return failure('CLIENT_NOT_READY')
  }
  if (!(blob instanceof Blob) || blob.type !== 'image/webp') {
    return failure('INVALID_WALLPAPER_FILE')
  }
  const normalizedPath = cleanText(path)
  if (!/^shared\/[0-9a-f-]{36}\.webp$/i.test(normalizedPath)) {
    return failure('INVALID_WALLPAPER_PATH')
  }
  try {
    const { error } = await supabase.storage
      .from(V21_SHARED_WALLPAPER_BUCKET)
      .upload(normalizedPath, blob, { cacheControl: '3600', contentType: 'image/webp', upsert: false })
    return error ? rpcFailure(error, 'WALLPAPER_UPLOAD_FAILED') : { ok: true, path: normalizedPath }
  } catch (error) {
    return rpcFailure(error, 'WALLPAPER_UPLOAD_FAILED')
  }
}

export async function downloadV21SharedWallpaper({ supabase, wallpaper } = {}) {
  if (!supabase?.storage || typeof supabase.storage.from !== 'function') {
    return failure('CLIENT_NOT_READY')
  }
  const bucket = cleanText(wallpaper?.bucket)
  const path = cleanText(wallpaper?.path)
  if (bucket !== V21_SHARED_WALLPAPER_BUCKET || !/^shared\/[0-9a-f-]{36}\.webp$/i.test(path)) {
    return failure('INVALID_WALLPAPER_PATH')
  }
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path)
    return error || !(data instanceof Blob)
      ? rpcFailure(error || {}, 'WALLPAPER_DOWNLOAD_FAILED')
      : { ok: true, blob: data }
  } catch (error) {
    return rpcFailure(error, 'WALLPAPER_DOWNLOAD_FAILED')
  }
}

export function getV21CenterSettingsOutcomeMessage(outcomeCode = '') {
  const messages = {
    BACKEND_NOT_DEPLOYED: 'Cài đặt dùng chung hiện chưa khả dụng.',
    INVALID_CENTER: 'Chưa xác định được cơ sở đang hoạt động.',
    CLIENT_NOT_READY: 'Cần đăng nhập lại trước khi tải cài đặt cơ sở.',
    CENTER_ACCESS_DENIED: 'Tài khoản hiện tại không có quyền xem cài đặt của cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Tài khoản hiện tại không có quyền thay đổi cài đặt cơ sở.',
    OWNER_REQUIRED: 'Chỉ Owner quản lý hình nền dùng chung của hệ thống.',
    STALE_VERSION: 'Cài đặt đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.',
    IDEMPOTENCY_CONFLICT: 'Nội dung thao tác đã thay đổi. Hãy kiểm tra và lưu lại.',
    PACKAGE_NAME_CONFLICT: 'Tên gói học phí đã được dùng trong cơ sở này.',
    WALLPAPER_OBJECT_MISSING: 'Ảnh nền dùng chung chưa được tải lên đầy đủ. Vui lòng chọn lại ảnh.',
    CENTER_SETTINGS_READ_FAILED: 'Chưa tải được cài đặt dùng chung. Ca học và lớp vẫn có thể sử dụng.',
    CENTER_SETTINGS_WRITE_FAILED: 'Chưa thể lưu thay đổi. Nội dung đang nhập vẫn được giữ nguyên.',
    WALLPAPER_UPLOAD_FAILED: 'Chưa thể tải hình nền dùng chung lên hệ thống.',
    WALLPAPER_DOWNLOAD_FAILED: 'Chưa tải được hình nền dùng chung. Hệ thống đang dùng nền mặc định.',
    INVALID_SERVER_RESULT: 'Máy chủ trả về dữ liệu cài đặt chưa hợp lệ.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đang hoạt động đã thay đổi; kết quả cũ không được sử dụng.',
  }
  return messages[cleanText(outcomeCode).toUpperCase()]
    || 'Chưa thể hoàn tất thao tác cài đặt lúc này.'
}

function projectCenterProfile(row = {}, expectedCenterId = '') {
  const version = Number(row.version)
  if (cleanText(row.center_id) !== expectedCenterId
    || !Number.isSafeInteger(version) || version < 0
    || !cleanText(row.center_code) || !cleanText(row.display_name)) return null
  return {
    centerId: expectedCenterId,
    centerCode: cleanText(row.center_code),
    displayName: cleanText(row.display_name),
    address: cleanText(row.address),
    phone: cleanText(row.phone),
    note: cleanText(row.note),
    environment: cleanText(row.environment),
    status: cleanText(row.status),
    version,
  }
}

function projectTuitionPackage(row = {}, expectedCenterId = '') {
  const version = Number(row.version)
  const totalSessions = Number(row.total_sessions)
  const defaultAmount = Number(row.default_amount)
  if (cleanText(row.center_id) !== expectedCenterId || !isUuid(row.id)
    || !Number.isSafeInteger(version) || version < 1
    || !Number.isSafeInteger(totalSessions) || totalSessions < 1
    || !Number.isSafeInteger(defaultAmount) || defaultAmount < 0
    || !cleanText(row.package_name)) return null
  return {
    id: row.id,
    centerId: expectedCenterId,
    packageName: cleanText(row.package_name),
    totalSessions,
    defaultAmount,
    isActive: row.is_active === true,
    note: cleanText(row.note),
    version,
    updatedAt: cleanText(row.updated_at),
  }
}

function projectSharedWallpaper(row = {}) {
  const version = Number(row.version)
  const bucket = cleanText(row.storage_bucket)
  const path = cleanText(row.storage_path)
  if (!Number.isSafeInteger(version) || version < 1
    || bucket !== V21_SHARED_WALLPAPER_BUCKET
    || !/^shared\/[0-9a-f-]{36}\.webp$/i.test(path)
    || cleanText(row.mime_type) !== 'image/webp') return null
  return {
    bucket,
    path,
    mimeType: 'image/webp',
    version,
    updatedAt: cleanText(row.updated_at),
  }
}

function rpcFailure(error = {}, fallbackCode = 'SERVER_COMMAND_FAILED', idempotencyKey = '') {
  const unavailable = isV21CenterSettingsBackendUnavailable(error)
  const detail = [error?.code, error?.message, error?.details, error?.hint]
    .map(cleanText)
    .join(' ')
    .toLowerCase()
  const known = [
    ['v2_1_center_access_denied', 'CENTER_ACCESS_DENIED'],
    ['v2_1_owner_required', 'OWNER_REQUIRED'],
    ['v2_1_stale_version', 'STALE_VERSION'],
    ['v2_1_idempotency_conflict', 'IDEMPOTENCY_CONFLICT'],
    ['v2_1_package_name_conflict', 'PACKAGE_NAME_CONFLICT'],
    ['v2_1_wallpaper_object_missing', 'WALLPAPER_OBJECT_MISSING'],
  ].find(([token]) => detail.includes(token))
  const outcomeCode = unavailable ? 'BACKEND_NOT_DEPLOYED' : known?.[1] || fallbackCode
  return failure(outcomeCode, idempotencyKey, error)
}

function failure(outcomeCode, idempotencyKey = '', detail = null) {
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: getV21CenterSettingsOutcomeMessage(outcomeCode),
    idempotencyKey,
    detail,
  }
}

function authoritativeVersion(value = {}) {
  const version = Number(value?.version)
  return Number.isSafeInteger(version) && version > 0 ? version : 0
}

function requirePositiveVersion(value = {}) {
  const version = authoritativeVersion(value)
  if (!version) throw new Error('Phiên bản dữ liệu không hợp lệ. Hãy tải lại trước khi lưu.')
  return version
}

function requireText(value, error) {
  const normalized = cleanText(value)
  if (!normalized) throw new Error(error)
  return normalized
}

function requirePositiveInteger(value, error) {
  const normalized = Number(value)
  if (!Number.isSafeInteger(normalized) || normalized < 1) throw new Error(error)
  return normalized
}

function requireNonNegativeInteger(value, error) {
  const normalized = Number(value)
  if (!Number.isSafeInteger(normalized) || normalized < 0) throw new Error(error)
  return normalized
}

function requireUuid(value, error) {
  const normalized = cleanText(value)
  if (!isUuid(normalized)) throw new Error(error)
  return normalized
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value))
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}
