export const C57_LEGACY_SCOPES = Object.freeze([
  'centerCalendarItems',
  'centerCalendarTags',
  'attendanceAdvisoryNotes',
  'attendanceBoardNotes',
])

export const C57_LEGACY_MANIFEST_SCHEMA =
  'c5.7-legacy-calendar-notes-quarantine-manifest-v1'

const FIXTURE_MARKERS = new Set([
  'angel-wings-import',
  'angel-wings-2026-06',
  'angel-wings-2026-06-f15k5',
  'angel-wings-2026-06-attendance',
  'attendance-board-demo-foundation',
  'bang-diem-danh-demo',
])

export function getC57LegacySourceKey(scope, centerId) {
  if (!C57_LEGACY_SCOPES.includes(scope)) throw new Error('Legacy C5.7 scope không hợp lệ.')
  return `ichessCenterOS.${scope}.${normalizeCenterId(centerId)}`
}

export function getC57LegacyManifestKey(centerId) {
  return `ichessCenterOS.c5_7.legacyCalendarNotesManifest.${normalizeCenterId(centerId)}.v1`
}

export async function inspectAndQuarantineC57LegacyState({ storage, centerId, now } = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    return fail('Không truy cập được storage để bảo toàn legacy Calendar/Notes.')
  }
  let normalizedCenterId
  try { normalizedCenterId = normalizeCenterId(centerId) } catch (error) { return fail(String(error.message || error)) }
  const manifestKey = getC57LegacyManifestKey(normalizedCenterId)

  try {
    const inspected = await inspectSources(storage, normalizedCenterId)
    const classifications = classifyC57LegacySources(inspected)
    const existingRaw = storage.getItem(manifestKey)
    if (existingRaw) {
      const existing = JSON.parse(existingRaw)
      const validation = await validateManifest(existing, normalizedCenterId, inspected)
      return validation.ok ? resultFromManifest(manifestKey, existing) : fail(validation.error)
    }

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

    const core = {
      schema: C57_LEGACY_MANIFEST_SCHEMA,
      centerId: normalizedCenterId,
      capturedAt: typeof now === 'function' ? now() : new Date().toISOString(),
      sourcePreservation: 'ORIGINAL_EXACT_CENTER_KEYS_RETAINED',
      containsRawCalendarOrNotesPayload: false,
      containsPlaintextStudentOrNoteContent: false,
      sources: stripParsedValues(inspected),
      classifications,
      authorityStatus: 'QUARANTINED_NOT_ACTIVE',
      migrationStatus: 'MIGRATION_REQUIRED',
    }
    const manifest = { ...core, checksum: `SHA-256:${await sha256Hex(JSON.stringify(core))}` }

    const concurrentRaw = storage.getItem(manifestKey)
    if (concurrentRaw) {
      const concurrent = JSON.parse(concurrentRaw)
      const validation = await validateManifest(concurrent, normalizedCenterId, inspected)
      return validation.ok ? resultFromManifest(manifestKey, concurrent) : fail(validation.error)
    }
    storage.setItem(manifestKey, JSON.stringify(manifest))
    const persistedRaw = storage.getItem(manifestKey)
    if (!persistedRaw) return fail('Không xác nhận được manifest legacy C5.7 sau khi ghi.')
    const persisted = JSON.parse(persistedRaw)
    const validation = await validateManifest(persisted, normalizedCenterId, inspected)
    return validation.ok ? resultFromManifest(manifestKey, persisted) : fail(validation.error)
  } catch (error) {
    return fail(`Không thể bảo toàn legacy Calendar/Notes: ${String(error?.message || error)}`)
  }
}

export function classifyC57LegacySources(sources = {}) {
  return {
    centerCalendarItems: classifyCollection(sources.centerCalendarItems, () => false),
    centerCalendarTags: classifyCollection(sources.centerCalendarTags, () => false),
    attendanceAdvisoryNotes: classifyCollection(sources.attendanceAdvisoryNotes, isExactFixtureCollection),
    attendanceBoardNotes: classifyCollection(sources.attendanceBoardNotes, isExactFixtureCollection),
  }
}

function classifyCollection(source, fixturePredicate) {
  if (!source?.present) return { classification: 'RECONSTRUCTABLE_CACHE', reason: 'KEY_ABSENT' }
  if (!source.parseOk || source.valueType !== 'array') {
    return { classification: 'UNCERTAIN', reason: 'INVALID_JSON_OR_NON_ARRAY' }
  }
  if (source.recordCount === 0) return { classification: 'RECONSTRUCTABLE_CACHE', reason: 'EMPTY_COLLECTION' }
  if (fixturePredicate(source.parsedValue)) {
    return { classification: 'FIXTURE_SAMPLE', reason: 'ALL_ROWS_HAVE_EXACT_KNOWN_FIXTURE_IDENTITY' }
  }
  return { classification: 'REAL_LOCAL_ONLY', reason: 'NONEMPTY_LOCAL_BUSINESS_STATE' }
}

function isExactFixtureCollection(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false
    return [row.sourceModule, row.sourceTag, row.datasetId, row.importBatchId]
      .some((value) => FIXTURE_MARKERS.has(String(value || '')))
  })
}

async function inspectSources(storage, centerId) {
  const entries = await Promise.all(C57_LEGACY_SCOPES.map(async (scope) => {
    const key = getC57LegacySourceKey(scope, centerId)
    const raw = storage.getItem(key)
    const parsed = parseJson(raw)
    const isArray = parsed.ok && Array.isArray(parsed.value)
    return [scope, {
      key,
      present: raw !== null,
      byteLength: raw === null ? 0 : new TextEncoder().encode(raw).byteLength,
      rawChecksum: raw === null ? '' : `SHA-256:${await sha256Hex(raw)}`,
      parseOk: parsed.ok,
      valueType: raw === null ? 'null' : isArray ? 'array' : 'invalid',
      recordCount: isArray ? parsed.value.length : raw === null ? 0 : null,
      schemaVersions: isArray ? numericSchemaVersions(parsed.value) : [],
      parsedValue: isArray ? parsed.value : null,
    }]
  }))
  return Object.fromEntries(entries)
}

function stripParsedValues(sources) {
  return Object.fromEntries(Object.entries(sources).map(([scope, source]) => {
    const { parsedValue, ...metadata } = source
    return [scope, metadata]
  }))
}

async function validateManifest(manifest, centerId, currentInspected) {
  if (!isPlainObject(manifest) || manifest.schema !== C57_LEGACY_MANIFEST_SCHEMA
    || manifest.centerId !== centerId || manifest.containsRawCalendarOrNotesPayload !== false
    || manifest.containsPlaintextStudentOrNoteContent !== false
    || manifest.sourcePreservation !== 'ORIGINAL_EXACT_CENTER_KEYS_RETAINED'
    || !isPlainObject(manifest.sources) || !isPlainObject(manifest.classifications)
    || !String(manifest.checksum || '').startsWith('SHA-256:')) {
    return { ok: false, error: 'Manifest legacy Calendar/Notes hiện hữu không hợp lệ.' }
  }
  const { checksum, ...core } = manifest
  if (checksum !== `SHA-256:${await sha256Hex(JSON.stringify(core))}`) {
    return { ok: false, error: 'Checksum manifest legacy Calendar/Notes không hợp lệ.' }
  }
  const current = stripParsedValues(currentInspected)
  const changed = C57_LEGACY_SCOPES.some((scope) => {
    const before = manifest.sources[scope]
    const after = current[scope]
    return !before || !after || before.key !== after.key || before.present !== after.present
      || before.byteLength !== after.byteLength || before.rawChecksum !== after.rawChecksum
  })
  return changed
    ? { ok: false, error: 'Legacy Calendar/Notes đã đổi sau kiểm kê; khóa authoritative replacement để review.' }
    : { ok: true, error: '' }
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

function numericSchemaVersions(records) {
  return [...new Set(records.map((row) => Number(row?.schemaVersion))
    .filter((value) => Number.isSafeInteger(value) && value > 0))].sort((a, b) => a - b)
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 không sẵn sàng.')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
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
  if (!centerId || centerId.length > 160 || !/^[a-z0-9_-]+$/.test(centerId)) {
    throw new Error('Thiếu hoặc sai center_id cho legacy C5.7; không dùng dreamhome mặc định.')
  }
  return centerId
}

function fail(error) {
  return { ok: false, migrationRequired: true, error }
}
