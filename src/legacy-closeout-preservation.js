const CORE_ATTENDANCE_SCOPES = Object.freeze([
  'students',
  'teachers',
  'classSessions',
  'schedule',
  'attendanceRecords',
  'attendanceBaselineState',
  'sessionReports',
  'tuition',
  'tuitionPackages',
])

const CRM_SCOPE = 'parentConsultations'

export function getC5CloseoutLegacyCoreAttendanceSnapshotKey(centerId) {
  return `ichessCenterOS.c5_closeout.legacyCoreAttendanceSnapshot.${normalizeCenterId(centerId)}.v1`
}

export function getC5CloseoutLegacyCrmManifestKey(centerId) {
  return `ichessCenterOS.c5_closeout.legacyCrmManifest.${normalizeCenterId(centerId)}.v1`
}

export function preserveC5CloseoutLegacyCoreAttendance({ storage, centerId } = {}) {
  const normalizedCenterId = normalizeCenterId(centerId)
  if (!isStorage(storage) || !normalizedCenterId) {
    return failure('LEGACY_PRESERVATION_UNAVAILABLE', 'Không thể bảo toàn legacy C5.1/C5.2 khi thiếu storage hoặc exact center.')
  }

  const snapshotKey = getC5CloseoutLegacyCoreAttendanceSnapshotKey(normalizedCenterId)
  const existingRaw = storage.getItem(snapshotKey)
  if (existingRaw !== null) return validateCoreAttendanceSnapshot(existingRaw, snapshotKey, normalizedCenterId)

  const sources = CORE_ATTENDANCE_SCOPES.map((scope) => {
    const key = getCenterKey(scope, normalizedCenterId)
    const raw = storage.getItem(key)
    return { key, raw, originClassification: classifyRawLegacy(raw) }
  })
  const snapshot = {
    schemaVersion: 1,
    centerId: normalizedCenterId,
    state: 'QUARANTINED_NOT_ACTIVE',
    authority: false,
    autoUpload: false,
    silentDelete: false,
    controlledImport: 'DEFERRED / MIGRATION REQUIRED',
    createdAt: new Date().toISOString(),
    sources,
  }
  snapshot.payloadDigest = stableDigest(JSON.stringify(sources))
  const serialized = JSON.stringify(snapshot)

  try {
    if (storage.getItem(snapshotKey) !== null) {
      return validateCoreAttendanceSnapshot(storage.getItem(snapshotKey), snapshotKey, normalizedCenterId)
    }
    storage.setItem(snapshotKey, serialized)
    if (storage.getItem(snapshotKey) !== serialized) {
      return failure('LEGACY_PRESERVATION_WRITE_FAILED', 'Snapshot legacy C5.1/C5.2 không xác minh được sau khi ghi.')
    }
  } catch (error) {
    return failure('LEGACY_PRESERVATION_WRITE_FAILED', String(error?.message || error))
  }

  return { ok: true, snapshotKey, created: true, sources }
}

export function inspectAndQuarantineC53LegacyCrm({ storage, centerId } = {}) {
  const normalizedCenterId = normalizeCenterId(centerId)
  if (!isStorage(storage) || !normalizedCenterId) {
    return failure('LEGACY_PRESERVATION_UNAVAILABLE', 'Không thể inventory legacy CRM khi thiếu storage hoặc exact center.')
  }

  const sourceKey = getCenterKey(CRM_SCOPE, normalizedCenterId)
  const raw = storage.getItem(sourceKey)
  const source = describeLegacySource(sourceKey, raw)
  const manifestKey = getC5CloseoutLegacyCrmManifestKey(normalizedCenterId)
  const existingRaw = storage.getItem(manifestKey)

  if (existingRaw !== null) {
    try {
      const existing = JSON.parse(existingRaw)
      if (
        existing?.schemaVersion !== 1
        || existing.centerId !== normalizedCenterId
        || existing.source?.key !== sourceKey
        || existing.source?.digest !== source.digest
        || existing.source?.byteLength !== source.byteLength
      ) {
        return failure('LEGACY_SOURCE_DRIFT', 'Legacy CRM đã thay đổi sau quarantine; dừng pull để tránh che khuất dữ liệu chưa xử lý.')
      }
      return { ok: true, manifestKey, created: false, migrationRequired: source.classification !== 'DEPRECATED_EMPTY', source }
    } catch {
      return failure('LEGACY_MANIFEST_INVALID', 'Manifest legacy CRM không hợp lệ; dừng pull authoritative.')
    }
  }

  const manifest = {
    schemaVersion: 1,
    centerId: normalizedCenterId,
    state: 'QUARANTINED_NOT_ACTIVE',
    authority: false,
    payloadCopied: false,
    sourceRetained: true,
    autoUpload: false,
    silentDelete: false,
    controlledImport: source.classification === 'DEPRECATED_EMPTY' ? 'NOT NEEDED' : 'DEFERRED / MIGRATION REQUIRED',
    createdAt: new Date().toISOString(),
    source,
  }
  const serialized = JSON.stringify(manifest)
  try {
    storage.setItem(manifestKey, serialized)
    if (storage.getItem(manifestKey) !== serialized || storage.getItem(sourceKey) !== raw) {
      return failure('LEGACY_PRESERVATION_WRITE_FAILED', 'Không thể xác minh CRM source và manifest sau quarantine.')
    }
  } catch (error) {
    return failure('LEGACY_PRESERVATION_WRITE_FAILED', String(error?.message || error))
  }

  return { ok: true, manifestKey, created: true, migrationRequired: source.classification !== 'DEPRECATED_EMPTY', source }
}

function validateCoreAttendanceSnapshot(raw, snapshotKey, centerId) {
  try {
    const snapshot = JSON.parse(raw)
    if (
      snapshot?.schemaVersion !== 1
      || snapshot.centerId !== centerId
      || snapshot.state !== 'QUARANTINED_NOT_ACTIVE'
      || !Array.isArray(snapshot.sources)
      || snapshot.sources.length !== CORE_ATTENDANCE_SCOPES.length
      || snapshot.payloadDigest !== stableDigest(JSON.stringify(snapshot.sources))
    ) {
      return failure('LEGACY_SNAPSHOT_INVALID', 'Snapshot legacy C5.1/C5.2 không hợp lệ; dừng projection replacement.')
    }
    return { ok: true, snapshotKey, created: false, sources: snapshot.sources }
  } catch {
    return failure('LEGACY_SNAPSHOT_INVALID', 'Snapshot legacy C5.1/C5.2 không parse được; dừng projection replacement.')
  }
}

function describeLegacySource(key, raw) {
  let shape = 'missing'
  let rowCount = 0
  if (raw !== null && String(raw).trim()) {
    try {
      const parsed = JSON.parse(raw)
      shape = Array.isArray(parsed) ? 'array' : parsed && typeof parsed === 'object' ? 'object' : typeof parsed
      rowCount = Array.isArray(parsed) ? parsed.length : parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0
    } catch {
      shape = 'malformed-json'
    }
  }
  return {
    key,
    classification: classifyRawLegacy(raw),
    byteLength: raw === null ? 0 : new TextEncoder().encode(String(raw)).length,
    shape,
    rowCount,
    digest: stableDigest(raw === null ? '<missing>' : String(raw)),
  }
}

function classifyRawLegacy(raw) {
  if (raw === null || !String(raw).trim()) return 'DEPRECATED_EMPTY'
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length === 0) return 'DEPRECATED_EMPTY'
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0) return 'DEPRECATED_EMPTY'
  } catch {
    return 'UNCERTAIN'
  }
  return 'UNCERTAIN'
}

function getCenterKey(scope, centerId) {
  return `ichessCenterOS.${scope}.${centerId}`
}

function normalizeCenterId(centerId) {
  const value = String(centerId || '').trim().toLowerCase()
  return value && value.length <= 160 && /^[a-z0-9_-]+$/.test(value) ? value : ''
}

function isStorage(storage) {
  return Boolean(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function')
}

function stableDigest(value) {
  let hash = 2166136261
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function failure(outcomeCode, error) {
  return { ok: false, outcome_code: outcomeCode, error }
}
