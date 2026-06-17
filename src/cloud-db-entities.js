export const CLOUD_ENTITY_TYPES = Object.freeze({
  STUDENT: 'student',
  TEACHER: 'teacher',
  CLASS_SESSION: 'class_session',
})

export const CLOUD_ENTITY_TYPE_VALUES = Object.freeze(Object.values(CLOUD_ENTITY_TYPES))

export const CLOUD_DB_SOURCE_VERSION = 'c2-online-core-v1'

export function isAllowedCloudEntityType(entityType) {
  return CLOUD_ENTITY_TYPE_VALUES.includes(String(entityType || ''))
}

export function buildCloudEntityRecord({
  centerId,
  entityType,
  localId,
  payload,
  sourceModule = 'localStorage',
  sourceVersion = CLOUD_DB_SOURCE_VERSION,
  userId = null,
} = {}) {
  const normalizedCenterId = String(centerId || '').trim()
  const normalizedEntityType = String(entityType || '').trim()
  const normalizedLocalId = String(localId || '').trim()

  if (!normalizedCenterId) {
    return { ok: false, error: 'Thiếu center_id.' }
  }

  if (!isAllowedCloudEntityType(normalizedEntityType)) {
    return { ok: false, error: 'Entity type không thuộc phạm vi C2.' }
  }

  if (!normalizedLocalId) {
    return { ok: false, error: 'Thiếu local_id.' }
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Payload phải là object.' }
  }

  return {
    ok: true,
    data: {
      center_id: normalizedCenterId,
      entity_type: normalizedEntityType,
      local_id: normalizedLocalId,
      payload: sanitizeCloudPayload(payload),
      source_module: sourceModule,
      source_version: sourceVersion,
      updated_by: userId || null,
      created_by: userId || null,
      deleted_at: null,
    },
  }
}

export function buildCloudEntityRecords({ centerId, entityType, items = [], userId = null } = {}) {
  const records = []
  const errors = []

  ;(Array.isArray(items) ? items : []).forEach((item, index) => {
    const localId = item?.id || item?.localId || ''
    const result = buildCloudEntityRecord({
      centerId,
      entityType,
      localId,
      payload: item,
      userId,
    })

    if (result.ok) {
      records.push(result.data)
    } else {
      errors.push(`Dòng ${index + 1}: ${result.error}`)
    }
  })

  return { records, errors }
}

export function sanitizeCloudPayload(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    return sanitizeCloudScalar(value)
  }

  if (seen.has(value)) {
    return null
  }

  seen.add(value)

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeCloudPayload(item, seen))
      .filter((item) => item !== undefined)
  }

  return Object.entries(value).reduce((payload, [key, item]) => {
    if (shouldDropCloudPayloadField(key, item)) {
      return payload
    }

    const sanitizedValue = sanitizeCloudPayload(item, seen)

    if (sanitizedValue !== undefined) {
      payload[key] = sanitizedValue
    }

    return payload
  }, {})
}

function sanitizeCloudScalar(value) {
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'undefined') {
    return undefined
  }

  if (typeof value === 'string' && isUnsafeCloudString(value)) {
    return ''
  }

  return value
}

function shouldDropCloudPayloadField(key, value) {
  const normalizedKey = String(key || '').toLowerCase()

  if (
    normalizedKey.includes('base64') ||
    normalizedKey.includes('blob') ||
    normalizedKey.includes('objecturl') ||
    normalizedKey.includes('tempfile') ||
    normalizedKey.includes('localpath') ||
    normalizedKey.includes('filepath')
  ) {
    return true
  }

  return typeof value === 'string' && isUnsafeCloudString(value)
}

function isUnsafeCloudString(value) {
  return /^data:image\/|^data:application\/|^blob:/i.test(String(value || ''))
}
