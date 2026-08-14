import { sampleInventoryItems } from './inventory-data.js'
import { sampleInventoryRequests } from './inventory-request-data.js'

export const C56_LEGACY_INVENTORY_SCOPES = Object.freeze([
  'inventory',
  'inventoryMovements',
  'inventoryRequests',
])
export const C56_LEGACY_INVENTORY_MANIFEST_SCHEMA =
  'c5.6-legacy-inventory-quarantine-manifest-v1'

export function getC56LegacyInventorySourceKey(scope, centerId) {
  if (!C56_LEGACY_INVENTORY_SCOPES.includes(scope)) {
    throw new Error('Legacy Inventory scope không hợp lệ.')
  }
  return `ichessCenterOS.${scope}.${normalizeCenterId(centerId)}`
}

export function getC56LegacyInventoryManifestKey(centerId) {
  return `ichessCenterOS.c5_6.legacyInventoryManifest.${normalizeCenterId(centerId)}.v1`
}

export async function inspectAndQuarantineC56LegacyInventory({ storage, centerId, now } = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    return fail('Không truy cập được storage để kiểm kê an toàn legacy Inventory.')
  }
  const normalizedCenterId = normalizeCenterId(centerId)
  const manifestKey = getC56LegacyInventoryManifestKey(normalizedCenterId)

  try {
    const inspected = await inspectSources(storage, normalizedCenterId)
    const classifications = classifyC56LegacyInventorySources(inspected)
    const existingRaw = storage.getItem(manifestKey)
    if (existingRaw) {
      const existing = JSON.parse(existingRaw)
      const validation = await validateManifest(existing, normalizedCenterId, inspected)
      if (!validation.ok) return fail(validation.error)
      return resultFromManifest(manifestKey, existing)
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

    const manifestCore = {
      schema: C56_LEGACY_INVENTORY_MANIFEST_SCHEMA,
      centerId: normalizedCenterId,
      capturedAt: typeof now === 'function' ? now() : new Date().toISOString(),
      sourcePreservation: 'ORIGINAL_EXACT_CENTER_KEYS_RETAINED',
      containsRawInventoryPayload: false,
      containsPlaintextRequesterContact: false,
      sources: stripParsedValues(inspected),
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
      const validation = await validateManifest(concurrent, normalizedCenterId, inspected)
      return validation.ok ? resultFromManifest(manifestKey, concurrent) : fail(validation.error)
    }

    storage.setItem(manifestKey, JSON.stringify(manifest))
    const persistedRaw = storage.getItem(manifestKey)
    if (!persistedRaw) return fail('Không xác nhận được manifest legacy Inventory sau khi ghi.')
    const persisted = JSON.parse(persistedRaw)
    const validation = await validateManifest(persisted, normalizedCenterId, inspected)
    return validation.ok ? resultFromManifest(manifestKey, persisted) : fail(validation.error)
  } catch (error) {
    return fail(`Không thể bảo toàn legacy Inventory: ${String(error?.message || error)}`)
  }
}

export function classifyC56LegacyInventorySources(sources = {}) {
  return {
    inventory: classifyCollection(sources.inventory, isExactSampleItems),
    inventoryMovements: classifyCollection(
      sources.inventoryMovements,
      (items) => items.length === 0,
      'RECONSTRUCTABLE_CACHE',
    ),
    inventoryRequests: classifyCollection(sources.inventoryRequests, isExactSampleRequests),
  }
}

function classifyCollection(source, isExactFixture, fixtureClassification = 'FIXTURE_SAMPLE') {
  if (!source?.present) return { classification: 'RECONSTRUCTABLE_CACHE', reason: 'KEY_ABSENT' }
  if (!source.parseOk || source.valueType !== 'array') {
    return { classification: 'UNCERTAIN', reason: 'INVALID_JSON_OR_NON_ARRAY' }
  }
  if (source.recordCount === 0) {
    return { classification: 'RECONSTRUCTABLE_CACHE', reason: 'EMPTY_COLLECTION' }
  }
  if (isExactFixture(source.parsedValue)) {
    return { classification: fixtureClassification, reason: 'EXACT_KNOWN_SAMPLE_SIGNATURE' }
  }
  return { classification: 'REAL_LOCAL_ONLY', reason: 'NONEMPTY_VALID_LOCAL_BUSINESS_STATE' }
}

async function inspectSources(storage, centerId) {
  const entries = await Promise.all(C56_LEGACY_INVENTORY_SCOPES.map(async (scope) => {
    const key = getC56LegacyInventorySourceKey(scope, centerId)
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
      // Ephemeral only: stripped before the privacy-safe manifest is created.
      parsedValue: isArray ? parsed.value : null,
    }]
  }))
  return Object.fromEntries(entries)
}

function isExactSampleItems(items) {
  if (!Array.isArray(items) || items.length !== sampleInventoryItems.length) return false
  return JSON.stringify(items.map(itemSignature)) === JSON.stringify(sampleInventoryItems.map(itemSignature))
}

function itemSignature(item = {}) {
  return {
    id: String(item.id || ''),
    name: String(item.name || ''),
    category: String(item.category || ''),
    unit: String(item.unit || ''),
    quantity: Number(item.quantity),
    lowStockThreshold: Number(item.lowStockThreshold),
    condition: String(item.condition || ''),
    location: String(item.location || ''),
    note: String(item.note || ''),
    updatedAt: String(item.updatedAt || ''),
  }
}

function isExactSampleRequests(requests) {
  if (!Array.isArray(requests) || requests.length !== sampleInventoryRequests.length) return false
  return JSON.stringify(requests.map(requestSignature))
    === JSON.stringify(sampleInventoryRequests.map(requestSignature))
}

function requestSignature(request = {}) {
  return {
    id: String(request.id || ''),
    requestCode: String(request.requestCode || ''),
    requestedByName: String(request.requestedByName || ''),
    requestedByRole: String(request.requestedByRole || ''),
    requestedByPhone: String(request.requestedByPhone || ''),
    studentName: String(request.studentName || ''),
    linkedStudentId: String(request.linkedStudentId || ''),
    itemTypes: Array.isArray(request.itemTypes) ? request.itemTypes.map(String) : [],
    otherItemText: String(request.otherItemText || ''),
    itemDetails: String(request.itemDetails || ''),
    usageModes: Array.isArray(request.usageModes) ? request.usageModes.map(String) : [],
    otherUsageText: String(request.otherUsageText || ''),
    usageLocationDetail: String(request.usageLocationDetail || ''),
    neededDate: String(request.neededDate || ''),
    priority: String(request.priority || ''),
    status: String(request.status || ''),
    adminNote: String(request.adminNote || ''),
    handledBy: String(request.handledBy || ''),
    handledAt: String(request.handledAt || ''),
    createdAt: String(request.createdAt || ''),
    updatedAt: String(request.updatedAt || ''),
  }
}

function stripParsedValues(sources) {
  return Object.fromEntries(Object.entries(sources).map(([scope, source]) => {
    const { parsedValue, ...metadata } = source
    return [scope, metadata]
  }))
}

async function validateManifest(manifest, centerId, currentInspected) {
  if (!isPlainObject(manifest)
    || manifest.schema !== C56_LEGACY_INVENTORY_MANIFEST_SCHEMA
    || manifest.centerId !== centerId
    || manifest.containsRawInventoryPayload !== false
    || manifest.containsPlaintextRequesterContact !== false
    || manifest.sourcePreservation !== 'ORIGINAL_EXACT_CENTER_KEYS_RETAINED'
    || !isPlainObject(manifest.sources) || !isPlainObject(manifest.classifications)
    || !String(manifest.checksum || '').startsWith('SHA-256:')) {
    return { ok: false, error: 'Manifest legacy Inventory hiện hữu không hợp lệ.' }
  }
  const { checksum, ...core } = manifest
  if (checksum !== `SHA-256:${await sha256Hex(JSON.stringify(core))}`) {
    return { ok: false, error: 'Checksum manifest legacy Inventory không hợp lệ.' }
  }
  const current = stripParsedValues(currentInspected)
  const changed = C56_LEGACY_INVENTORY_SCOPES.some((scope) => {
    const before = manifest.sources[scope]
    const after = current[scope]
    return !before || !after || before.key !== after.key || before.present !== after.present
      || before.byteLength !== after.byteLength || before.rawChecksum !== after.rawChecksum
  })
  if (changed) {
    return {
      ok: false,
      error: 'Legacy Inventory đã đổi sau kiểm kê; giữ nguyên key nguồn và khóa authoritative replacement để review.',
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
    .replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  if (!centerId) throw new Error('Thiếu center_id cho legacy Inventory inventory.')
  return centerId
}

function fail(error) {
  return { ok: false, migrationRequired: true, error }
}
