export const C55_LEGACY_STAFF_HR_SCOPES = Object.freeze([
  'centerStaffMembers',
  'centerDepartments',
  'centerStaffAdministrativeProfiles',
  'centerStaffDocuments',
  'centerStaffAdministrativeAuditEvents',
  'centerStaffAdministrativeRetentionPolicies',
  'centerStaffAdministrativeDeletionRequests',
])

export const C55_LEGACY_STAFF_HR_MANIFEST_SCHEMA =
  'c5.5-legacy-staff-hr-quarantine-manifest-v1'

export function getC55LegacyStaffHrSourceKey(scope, centerId) {
  if (!C55_LEGACY_STAFF_HR_SCOPES.includes(scope)) {
    throw new Error('Legacy Staff/HR scope không hợp lệ.')
  }
  return `ichessCenterOS.${scope}.${normalizeCenterId(centerId)}`
}

export function getC55LegacyStaffHrManifestKey(centerId) {
  return `ichessCenterOS.c5_5.legacyStaffHrManifest.${normalizeCenterId(centerId)}.v1`
}

export async function inspectAndQuarantineC55LegacyStaffHr({ storage, centerId, now } = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    return fail('Không truy cập được storage để kiểm kê an toàn legacy Staff/HR.')
  }

  const normalizedCenterId = normalizeCenterId(centerId)
  const manifestKey = getC55LegacyStaffHrManifestKey(normalizedCenterId)

  try {
    const currentSources = await inspectSources(storage, normalizedCenterId)
    const existingRaw = storage.getItem(manifestKey)
    if (existingRaw) {
      const existing = JSON.parse(existingRaw)
      const validation = await validateManifest(existing, normalizedCenterId, currentSources)
      if (!validation.ok) return fail(validation.error)
      return resultFromManifest(manifestKey, existing)
    }

    const classifications = classifyC55LegacyStaffHrSources(currentSources)
    const migrationRequired = Object.values(classifications).some((entry) =>
      ['REAL_LOCAL_ONLY', 'UNCERTAIN'].includes(entry.classification),
    )
    if (!migrationRequired) {
      return {
        ok: true,
        migrationRequired: false,
        manifestKey: '',
        manifest: null,
        classifications,
        preserved: true,
      }
    }

    const capturedAt = typeof now === 'function' ? now() : new Date().toISOString()
    const manifestCore = {
      schema: C55_LEGACY_STAFF_HR_MANIFEST_SCHEMA,
      centerId: normalizedCenterId,
      capturedAt,
      sourcePreservation: 'ORIGINAL_EXACT_CENTER_KEYS_RETAINED',
      containsRawHrPayload: false,
      sources: currentSources,
      classifications,
      authorityStatus: 'QUARANTINED_NOT_ACTIVE',
      migrationStatus: 'MIGRATION_REQUIRED',
    }
    const manifest = {
      ...manifestCore,
      checksum: `SHA-256:${await sha256Hex(JSON.stringify(manifestCore))}`,
    }

    const concurrentRaw = storage.getItem(manifestKey)
    if (concurrentRaw) {
      const concurrent = JSON.parse(concurrentRaw)
      const validation = await validateManifest(concurrent, normalizedCenterId, currentSources)
      return validation.ok
        ? resultFromManifest(manifestKey, concurrent)
        : fail(validation.error)
    }

    storage.setItem(manifestKey, JSON.stringify(manifest))
    const persistedRaw = storage.getItem(manifestKey)
    if (!persistedRaw) return fail('Không xác nhận được manifest legacy Staff/HR sau khi ghi.')
    const persisted = JSON.parse(persistedRaw)
    const validation = await validateManifest(persisted, normalizedCenterId, currentSources)
    if (!validation.ok) return fail(validation.error)
    return resultFromManifest(manifestKey, persisted)
  } catch (error) {
    return fail(`Không thể bảo toàn legacy Staff/HR: ${String(error?.message || error)}`)
  }
}

export function classifyC55LegacyStaffHrSources(sources = {}) {
  const classifications = {}
  C55_LEGACY_STAFF_HR_SCOPES.forEach((scope) => {
    const source = sources[scope]
    if (!source?.present) {
      classifications[scope] = {
        classification: 'RECONSTRUCTABLE_CACHE',
        reason: 'KEY_ABSENT',
      }
      return
    }
    if (!source.parseOk || source.valueType === 'invalid') {
      classifications[scope] = { classification: 'UNCERTAIN', reason: 'INVALID_JSON_OR_SHAPE' }
      return
    }
    if (source.recordCount === 0) {
      classifications[scope] = {
        classification: 'RECONSTRUCTABLE_CACHE',
        reason: 'EMPTY_COLLECTION_OR_NULL_SINGLETON',
      }
      return
    }
    if (scope === 'centerStaffAdministrativeAuditEvents') {
      classifications[scope] = {
        classification: 'UNCERTAIN',
        reason: 'NONEMPTY_CLIENT_AUTHORED_HISTORY_REQUIRES_REVIEW',
      }
      return
    }
    classifications[scope] = {
      classification: 'REAL_LOCAL_ONLY',
      reason: 'NONEMPTY_DURABLE_STAFF_HR_STATE',
    }
  })
  return classifications
}

async function inspectSources(storage, centerId) {
  const entries = await Promise.all(C55_LEGACY_STAFF_HR_SCOPES.map(async (scope) => {
    const key = getC55LegacyStaffHrSourceKey(scope, centerId)
    const raw = storage.getItem(key)
    const parsed = parseJson(raw)
    const shape = describeShape(scope, parsed)
    return [scope, {
      key,
      present: raw !== null,
      byteLength: raw === null ? 0 : new TextEncoder().encode(raw).byteLength,
      rawChecksum: raw === null ? '' : `SHA-256:${await sha256Hex(raw)}`,
      parseOk: parsed.ok,
      valueType: shape.valueType,
      recordCount: shape.recordCount,
      schemaVersions: shape.schemaVersions,
    }]
  }))
  return Object.fromEntries(entries)
}

function describeShape(scope, parsed) {
  if (!parsed.ok) return { valueType: 'invalid', recordCount: null, schemaVersions: [] }
  if (parsed.value === null) return { valueType: 'null', recordCount: 0, schemaVersions: [] }
  const singleton = scope === 'centerStaffAdministrativeRetentionPolicies'
  if (singleton) {
    if (!isPlainObject(parsed.value)) {
      return { valueType: 'invalid', recordCount: null, schemaVersions: [] }
    }
    return {
      valueType: 'object',
      recordCount: 1,
      schemaVersions: numericSchemaVersions([parsed.value]),
    }
  }
  if (!Array.isArray(parsed.value)) {
    return { valueType: 'invalid', recordCount: null, schemaVersions: [] }
  }
  return {
    valueType: 'array',
    recordCount: parsed.value.length,
    schemaVersions: numericSchemaVersions(parsed.value),
  }
}

function numericSchemaVersions(records) {
  return [...new Set(records
    .map((item) => Number(item?.schemaVersion))
    .filter((value) => Number.isSafeInteger(value) && value > 0))]
    .sort((left, right) => left - right)
}

async function validateManifest(manifest, centerId, currentSources) {
  if (!isPlainObject(manifest)
    || manifest.schema !== C55_LEGACY_STAFF_HR_MANIFEST_SCHEMA
    || manifest.centerId !== centerId
    || manifest.containsRawHrPayload !== false
    || manifest.sourcePreservation !== 'ORIGINAL_EXACT_CENTER_KEYS_RETAINED'
    || !isPlainObject(manifest.sources)
    || !isPlainObject(manifest.classifications)
    || !String(manifest.checksum || '').startsWith('SHA-256:')) {
    return { ok: false, error: 'Manifest legacy Staff/HR hiện hữu không hợp lệ.' }
  }
  const { checksum, ...core } = manifest
  const expected = `SHA-256:${await sha256Hex(JSON.stringify(core))}`
  if (checksum !== expected) {
    return { ok: false, error: 'Checksum manifest legacy Staff/HR không hợp lệ.' }
  }
  const sourceChanged = C55_LEGACY_STAFF_HR_SCOPES.some((scope) => {
    const captured = manifest.sources[scope]
    const current = currentSources[scope]
    return !captured || !current
      || captured.key !== current.key
      || captured.present !== current.present
      || captured.byteLength !== current.byteLength
      || captured.rawChecksum !== current.rawChecksum
  })
  if (sourceChanged) {
    return {
      ok: false,
      error: 'Legacy Staff/HR đã thay đổi sau kiểm kê; giữ nguyên key nguồn và khóa authoritative replacement để review.',
    }
  }
  return { ok: true, error: '' }
}

function resultFromManifest(manifestKey, manifest) {
  return {
    ok: true,
    migrationRequired: true,
    manifestKey,
    manifest,
    classifications: manifest.classifications,
    preserved: true,
  }
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 không sẵn sàng.')
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('').toUpperCase()
}

function parseJson(raw) {
  if (raw === null) return { ok: true, value: null }
  try { return { ok: true, value: JSON.parse(raw) } } catch { return { ok: false, value: null } }
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function normalizeCenterId(value) {
  const centerId = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  if (!centerId) throw new Error('Thiếu center_id cho legacy Staff/HR inventory.')
  return centerId
}

function fail(error) {
  return { ok: false, migrationRequired: true, error }
}
