export const STAFF_DOCUMENT_SCHEMA_VERSION = 1
export const STAFF_DOCUMENT_EXPIRY_WARNING_DAYS = 30
export const STAFF_DOCUMENT_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024
export const STAFF_DOCUMENT_LOCAL_METADATA_MAX_CHARS = 128 * 1024
export const STAFF_DOCUMENT_ATTACHMENT_ALLOWED_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])
export const STAFF_DOCUMENT_ATTACHMENT_STATES = Object.freeze([
  'none',
  'pending',
  'available',
  'missing',
  'archived',
])
export const STAFF_DOCUMENT_STALE_MESSAGE =
  'Tài liệu đã thay đổi. Vui lòng mở lại để tiếp tục.'

export const STAFF_DOCUMENT_CATEGORIES = Object.freeze([
  ['identity-document', 'Giấy tờ tùy thân'],
  ['employment-contract', 'Hợp đồng lao động'],
  ['contract-appendix', 'Phụ lục hợp đồng'],
  ['cv', 'Sơ yếu lý lịch / CV'],
  ['degree', 'Văn bằng'],
  ['certificate', 'Chứng chỉ'],
  ['insurance', 'Bảo hiểm'],
  ['decision', 'Quyết định'],
  ['handover', 'Biên bản bàn giao'],
  ['other', 'Khác'],
])

const CATEGORY_KEYS = new Set(STAFF_DOCUMENT_CATEGORIES.map(([key]) => key))
const VALIDITY_STATUS_KEYS = new Set([
  'not-applicable',
  'valid',
  'expiring-soon',
  'expired',
  'needs-review',
  'archived',
])
const UNSUPPORTED_LOCAL_VALUE_KEYS = new Set([
  'dataurl',
  'base64',
  'binary',
  'rawfile',
  'blob',
  ['object', 'url'].join(''),
  ['signed', 'url'].join(''),
  ['public', 'url'].join(''),
])

const EMPTY_DOCUMENT_VALUES = Object.freeze({
  category: 'other',
  title: '',
  documentNumber: '',
  issuedDate: '',
  effectiveDate: '',
  expiryDate: '',
  note: '',
})

export const initialStaffDocumentFilters = Object.freeze({
  query: '',
  category: 'all',
  validityStatus: 'all',
  archiveState: 'active',
})

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function normalizeText(value) {
  if (value === null || value === undefined || typeof value === 'object') return ''
  return String(value).trim()
}

function normalizeKnownText(record, field, issues) {
  const value = record[field]
  if (value !== undefined && value !== null && typeof value === 'object') {
    issues.push(`${field}:malformed-value`)
    return ''
  }
  return normalizeText(value)
}

function attachNormalizationIssues(record, issues) {
  Object.defineProperty(record, '__normalizationIssues', {
    configurable: true,
    enumerable: false,
    value: [...issues],
    writable: false,
  })
  return record
}

export function normalizeStaffDocument(documentRecord, { currentCenterId = '' } = {}) {
  if (!isPlainObject(documentRecord)) return null

  const issues = []
  const explicitCenterId = normalizeKnownText(documentRecord, 'centerId', issues)
  const scopedCenterId = normalizeText(currentCenterId)
  const rawCategory = normalizeKnownText(documentRecord, 'category', issues)
  const category = rawCategory === 'identity' ? 'identity-document' : rawCategory
  const attachmentIds = Array.isArray(documentRecord.attachmentIds)
    ? [...new Set(documentRecord.attachmentIds.map(normalizeText).filter(Boolean))]
    : documentRecord.attachmentIds === undefined
      ? []
      : documentRecord.attachmentIds

  if (!explicitCenterId && !scopedCenterId) issues.push('centerId:missing')
  if (explicitCenterId && scopedCenterId && explicitCenterId !== scopedCenterId) {
    issues.push('centerId:mismatch')
  }
  if (rawCategory && rawCategory !== 'identity' && !CATEGORY_KEYS.has(rawCategory)) {
    issues.push('category:invalid')
  }
  if (!Array.isArray(attachmentIds)) issues.push('attachmentIds:malformed-value')
  if (
    Array.isArray(documentRecord.attachmentIds) &&
    documentRecord.attachmentIds.some((value) => !normalizeText(value))
  ) {
    issues.push('attachmentIds:invalid-item')
  }

  return attachNormalizationIssues({
    ...documentRecord,
    id: normalizeKnownText(documentRecord, 'id', issues),
    schemaVersion: Number(documentRecord.schemaVersion),
    centerId: explicitCenterId || scopedCenterId,
    staffMemberId: normalizeKnownText(documentRecord, 'staffMemberId', issues),
    administrativeProfileId: normalizeKnownText(
      documentRecord,
      'administrativeProfileId',
      issues,
    ),
    category,
    title: normalizeKnownText(documentRecord, 'title', issues),
    documentNumber: normalizeKnownText(documentRecord, 'documentNumber', issues),
    issuedDate: normalizeKnownText(documentRecord, 'issuedDate', issues),
    effectiveDate: normalizeKnownText(documentRecord, 'effectiveDate', issues),
    expiryDate: normalizeKnownText(documentRecord, 'expiryDate', issues),
    note: normalizeKnownText(documentRecord, 'note', issues),
    attachmentIds,
    createdAt: normalizeKnownText(documentRecord, 'createdAt', issues),
    updatedAt: normalizeKnownText(documentRecord, 'updatedAt', issues),
    archivedAt: normalizeKnownText(documentRecord, 'archivedAt', issues),
    revision: Number(documentRecord.revision),
  }, issues)
}

export function normalizeStaffDocuments(documents, options = {}) {
  return (Array.isArray(documents) ? documents : [])
    .map((documentRecord) => normalizeStaffDocument(documentRecord, options))
    .filter(Boolean)
}

export function getStaffDocumentIntegrityIssues(documentRecord, { currentCenterId = '' } = {}) {
  if (!isPlainObject(documentRecord)) return ['document:not-plain-object']

  const issues = [...(documentRecord.__normalizationIssues || [])]
  const centerId = normalizeText(documentRecord.centerId)
  const scopedCenterId = normalizeText(currentCenterId)

  if (!normalizeText(documentRecord.id)) issues.push('id:missing')
  if (!normalizeText(documentRecord.staffMemberId)) issues.push('staffMemberId:missing')
  if (!normalizeText(documentRecord.administrativeProfileId)) {
    issues.push('administrativeProfileId:missing')
  }
  if (!centerId) issues.push('centerId:missing')
  if (centerId && scopedCenterId && centerId !== scopedCenterId) issues.push('centerId:mismatch')
  if (Number(documentRecord.schemaVersion) !== STAFF_DOCUMENT_SCHEMA_VERSION) {
    issues.push('schemaVersion:unsupported')
  }
  if (!CATEGORY_KEYS.has(documentRecord.category)) issues.push('category:invalid')
  if (!normalizeText(documentRecord.title)) issues.push('title:missing')
  if (!Number.isInteger(Number(documentRecord.revision)) || Number(documentRecord.revision) < 1) {
    issues.push('revision:invalid')
  }
  if (!isIsoDateTime(documentRecord.createdAt)) issues.push('createdAt:invalid')
  if (!isIsoDateTime(documentRecord.updatedAt)) issues.push('updatedAt:invalid')
  if (documentRecord.archivedAt && !isIsoDateTime(documentRecord.archivedAt)) {
    issues.push('archivedAt:invalid')
  }
  ;['issuedDate', 'effectiveDate', 'expiryDate'].forEach((field) => {
    if (documentRecord[field] && !isRealDate(documentRecord[field])) {
      issues.push(`${field}:invalid`)
    }
  })
  if (!Array.isArray(documentRecord.attachmentIds)) issues.push('attachmentIds:malformed-value')
  if (hasUnsupportedLocalValue(documentRecord)) issues.push('storageValue:unsupported')
  if (getSerializedLength(documentRecord) > STAFF_DOCUMENT_LOCAL_METADATA_MAX_CHARS) {
    issues.push('storageValue:too-large')
  }

  return [...new Set(issues)]
}

function hasUnsupportedLocalValue(value, key = '', seen = new Set()) {
  if (value === null || value === undefined) return false
  const normalizedKey = String(key).toLowerCase()
  if (UNSUPPORTED_LOCAL_VALUE_KEYS.has(normalizedKey) && value !== '') return true
  if (typeof value === 'string') {
    if (normalizedKey.endsWith(['u', 'rl'].join('')) && value) return true
    if (
      ['objectpath', 'storagepath'].includes(normalizedKey) &&
      /^(?:https?:|data:|blob:|\/|\\)/i.test(value.trim())
    ) return true
  }
  if (typeof value !== 'object') return false
  if (seen.has(value)) return true
  seen.add(value)
  if (Array.isArray(value)) {
    return value.some((item) => hasUnsupportedLocalValue(item, '', seen))
  }
  if (!isPlainObject(value)) return true
  return Object.entries(value).some(([childKey, childValue]) =>
    hasUnsupportedLocalValue(childValue, childKey, seen),
  )
}

function getSerializedLength(value) {
  try {
    return JSON.stringify(value).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

export function getStaffDocumentCollectionIssues(documents, currentCenterId) {
  const issues = []
  const ids = new Map()

  ;(Array.isArray(documents) ? documents : []).forEach((documentRecord, index) => {
    getStaffDocumentIntegrityIssues(documentRecord, { currentCenterId }).forEach((issue) => {
      issues.push(`${index}:${issue}`)
    })
    const id = normalizeText(documentRecord?.id)
    if (id) ids.set(id, (ids.get(id) || 0) + 1)
  })

  ids.forEach((count, id) => {
    if (count > 1) issues.push(`documentId:${id}:duplicate`)
  })
  return issues
}

export function getStaffDocumentRelationshipIssues(
  documents,
  { centerId = '', staffMembers = [], administrativeProfiles = [] } = {},
) {
  const issues = []
  const scopedCenterId = normalizeText(centerId)
  const staffIds = new Set(
    staffMembers
      .filter((staffMember) => !staffMember?.centerId || staffMember.centerId === scopedCenterId)
      .map((staffMember) => normalizeText(staffMember?.id))
      .filter(Boolean),
  )
  const profiles = new Map()
  administrativeProfiles.forEach((profile) => {
    if (normalizeText(profile?.centerId) === scopedCenterId && normalizeText(profile?.id)) {
      profiles.set(normalizeText(profile.id), profile)
    }
  })

  ;(Array.isArray(documents) ? documents : []).forEach((documentRecord, index) => {
    const staffMemberId = normalizeText(documentRecord?.staffMemberId)
    const profileId = normalizeText(documentRecord?.administrativeProfileId)
    const profile = profiles.get(profileId)
    if (!staffIds.has(staffMemberId)) issues.push(`${index}:staffMemberId:orphan`)
    if (!profile) issues.push(`${index}:administrativeProfileId:orphan`)
    if (profile && normalizeText(profile.staffMemberId) !== staffMemberId) {
      issues.push(`${index}:profile-staff-link:mismatch`)
    }
  })
  return issues
}

export function createStaffDocumentId(now = Date.now()) {
  return `staff-document-${now}-${Math.random().toString(36).slice(2, 9)}`
}

export function buildStaffDocumentAttachmentObjectPath({
  centerId,
  staffMemberId,
  documentId,
  attachmentId,
  safeFileName,
} = {}) {
  const segments = [centerId, staffMemberId, documentId, attachmentId]
    .map(normalizeStoragePathSegment)
  const storedName = normalizeStorageFileName(safeFileName)
  if (segments.some((segment) => !segment) || !storedName) return ''
  return [
    'centers',
    segments[0],
    'staff',
    segments[1],
    'documents',
    segments[2],
    segments[3],
    storedName,
  ].join('/')
}

function normalizeStoragePathSegment(value) {
  const normalized = normalizeText(value)
  if (!normalized || normalized === '.' || normalized === '..' || /[\\/]/.test(normalized)) {
    return ''
  }
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

function normalizeStorageFileName(value) {
  const normalized = normalizeText(value).replace(/^.*[\\/]/, '')
  if (!normalized || normalized === '.' || normalized === '..') return ''
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

export function createStaffDocumentDraft() {
  return { ...EMPTY_DOCUMENT_VALUES }
}

export function createEditStaffDocumentDraft(documentRecord) {
  return {
    category: normalizeText(documentRecord?.category) || 'other',
    title: normalizeText(documentRecord?.title),
    documentNumber: normalizeText(documentRecord?.documentNumber),
    issuedDate: normalizeText(documentRecord?.issuedDate),
    effectiveDate: normalizeText(documentRecord?.effectiveDate),
    expiryDate: normalizeText(documentRecord?.expiryDate),
    note: normalizeText(documentRecord?.note),
  }
}

export function setStaffDocumentDraftValue(values, field, value) {
  if (!Object.hasOwn(EMPTY_DOCUMENT_VALUES, field)) return values
  return { ...values, [field]: String(value ?? '') }
}

export function validateStaffDocument(values) {
  const errors = {}
  const category = normalizeText(values?.category)
  const title = normalizeText(values?.title)

  if (!CATEGORY_KEYS.has(category)) errors.category = 'Vui lòng chọn nhóm tài liệu hợp lệ.'
  if (!title) errors.title = 'Tên tài liệu là bắt buộc.'
  if (title.length > 240) errors.title = 'Tên tài liệu không được quá 240 ký tự.'
  if (normalizeText(values?.documentNumber).length > 120) {
    errors.documentNumber = 'Số / ký hiệu không được quá 120 ký tự.'
  }
  if (normalizeText(values?.note).length > 2000) {
    errors.note = 'Ghi chú không được quá 2.000 ký tự.'
  }

  ;[
    ['issuedDate', 'Ngày ban hành'],
    ['effectiveDate', 'Ngày hiệu lực'],
    ['expiryDate', 'Ngày hết hạn'],
  ].forEach(([field, label]) => {
    const value = normalizeText(values?.[field])
    if (value && !isRealDate(value)) errors[field] = `${label} phải là ngày hợp lệ.`
  })

  checkDateOrder(values, errors, 'issuedDate', 'effectiveDate',
    'Ngày ban hành không được sau ngày hiệu lực.')
  checkDateOrder(values, errors, 'issuedDate', 'expiryDate',
    'Ngày ban hành không được sau ngày hết hạn.')
  checkDateOrder(values, errors, 'effectiveDate', 'expiryDate',
    'Ngày hiệu lực không được sau ngày hết hạn.')
  return errors
}

function checkDateOrder(values, errors, startField, endField, message) {
  const start = normalizeText(values?.[startField])
  const end = normalizeText(values?.[endField])
  if (isRealDate(start) && isRealDate(end) && start > end) errors[endField] = message
}

export function buildStaffDocumentFromDraft(
  values,
  existingDocument,
  {
    centerId,
    staffMemberId,
    administrativeProfileId,
    documentId = '',
    now = new Date().toISOString(),
  } = {},
) {
  const previous = existingDocument || null
  const draft = createEditStaffDocumentDraft(values)
  return {
    ...(previous || {}),
    ...draft,
    id: normalizeText(previous?.id || documentId),
    schemaVersion: STAFF_DOCUMENT_SCHEMA_VERSION,
    centerId: normalizeText(centerId),
    staffMemberId: normalizeText(staffMemberId),
    administrativeProfileId: normalizeText(administrativeProfileId),
    attachmentIds: Array.isArray(previous?.attachmentIds) ? [...previous.attachmentIds] : [],
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    archivedAt: normalizeText(previous?.archivedAt),
    revision: previous ? Number(previous.revision) + 1 : 1,
  }
}

export function archiveStaffDocument(documentRecord, now = new Date().toISOString()) {
  if (!isPlainObject(documentRecord) || documentRecord.archivedAt) return null
  return {
    ...documentRecord,
    archivedAt: now,
    updatedAt: now,
    revision: Number(documentRecord.revision) + 1,
  }
}

export function restoreStaffDocument(documentRecord, now = new Date().toISOString()) {
  if (!isPlainObject(documentRecord) || !documentRecord.archivedAt) return null
  return {
    ...documentRecord,
    archivedAt: '',
    updatedAt: now,
    revision: Number(documentRecord.revision) + 1,
  }
}

export function getStaffDocumentValidityStatus(documentRecord, { today = getTodayDate() } = {}) {
  if (documentRecord?.archivedAt) return 'archived'
  if (getStaffDocumentIntegrityIssues(documentRecord, {
    currentCenterId: documentRecord?.centerId,
  }).length) return 'needs-review'

  const expiryDate = normalizeText(documentRecord?.expiryDate)
  if (!expiryDate) return 'not-applicable'
  if (expiryDate < today) return 'expired'
  if (expiryDate <= addDaysToIsoDate(today, STAFF_DOCUMENT_EXPIRY_WARNING_DAYS)) {
    return 'expiring-soon'
  }
  return 'valid'
}

export function getStaffDocumentValidityLabel(status) {
  return {
    'not-applicable': 'Không áp dụng',
    valid: 'Còn hiệu lực',
    'expiring-soon': 'Sắp hết hạn',
    expired: 'Hết hạn',
    archived: 'Đã lưu trữ',
    'needs-review': 'Tài liệu cần kiểm tra',
  }[status] || 'Tài liệu cần kiểm tra'
}

export function getStaffDocumentCategoryLabel(category) {
  return new Map(STAFF_DOCUMENT_CATEGORIES).get(category) || 'Nhóm cần kiểm tra'
}

export function getFilteredStaffDocuments(documents, filters = initialStaffDocumentFilters, options = {}) {
  const normalizedFilters = normalizeStaffDocumentFilters(filters)
  const query = normalizedFilters.query.toLocaleLowerCase('vi')
  return (Array.isArray(documents) ? documents : []).filter((documentRecord) => {
    const archived = Boolean(documentRecord?.archivedAt)
    if (normalizedFilters.archiveState === 'active' && archived) return false
    if (normalizedFilters.archiveState === 'archived' && !archived) return false
    if (normalizedFilters.category !== 'all' && documentRecord?.category !== normalizedFilters.category) {
      return false
    }
    const validityStatus = getStaffDocumentValidityStatus(documentRecord, options)
    if (
      normalizedFilters.validityStatus !== 'all' &&
      validityStatus !== normalizedFilters.validityStatus
    ) return false
    if (!query) return true
    const haystack = [documentRecord?.title, documentRecord?.documentNumber]
      .map(normalizeText)
      .join(' ')
      .toLocaleLowerCase('vi')
    return haystack.includes(query)
  })
}

export function getStaffDocumentSummary(documents, options = {}) {
  const summary = {
    totalActive: 0,
    valid: 0,
    expiringSoon: 0,
    expired: 0,
    notApplicable: 0,
    needsReview: 0,
    archived: 0,
  }
  ;(Array.isArray(documents) ? documents : []).forEach((documentRecord) => {
    const status = getStaffDocumentValidityStatus(documentRecord, options)
    if (status === 'archived') {
      summary.archived += 1
      return
    }
    summary.totalActive += 1
    if (status === 'valid') summary.valid += 1
    if (status === 'expiring-soon') summary.expiringSoon += 1
    if (status === 'expired') summary.expired += 1
    if (status === 'not-applicable') summary.notApplicable += 1
    if (status === 'needs-review') summary.needsReview += 1
  })
  return summary
}

export function normalizeStaffDocumentFilters(filters = {}) {
  const category = filters.category === 'all' || CATEGORY_KEYS.has(filters.category)
    ? filters.category
    : 'all'
  const validityStatus = filters.validityStatus === 'all' || VALIDITY_STATUS_KEYS.has(filters.validityStatus)
    ? filters.validityStatus
    : 'all'
  const archiveState = ['active', 'archived', 'all'].includes(filters.archiveState)
    ? filters.archiveState
    : 'active'
  return {
    query: normalizeText(filters.query),
    category,
    validityStatus,
    archiveState,
  }
}

export function renderStaffDocumentsSection({
  windowId,
  documents = [],
  state = {},
  accessAllowed = false,
  storageHealthy = true,
  readOnly = false,
  today = getTodayDate(),
} = {}) {
  if (!accessAllowed) {
    return '<section class="staff-administrative-section staff-documents-section" data-staff-documents-section><p role="alert">Bạn không có quyền truy cập danh mục tài liệu.</p></section>'
  }

  const filters = normalizeStaffDocumentFilters(state.filters || initialStaffDocumentFilters)
  const summary = getStaffDocumentSummary(documents, { today })
  const filteredDocuments = getFilteredStaffDocuments(documents, filters, { today })
  const selected = documents.find((item) => item.id === state.selectedDocumentId) || null
  const unsafe = !storageHealthy
  const mode = unsafe ? 'list' : state.mode || 'list'

  return `
    <section class="staff-administrative-section staff-documents-section" id="${escapeAttribute(`${windowId}-documents`)}" data-staff-documents-section>
      <div class="staff-documents-heading">
        <div>
          <h4>Tài liệu</h4>
          <p>Danh mục metadata riêng theo Nhân viên. Trạng thái hiệu lực được tính từ ngày, không nhập thủ công.</p>
        </div>
        ${readOnly || unsafe || mode !== 'list' ? '' : `<button type="button" data-staff-document-action="start-create">Thêm tài liệu</button>`}
      </div>
      ${readOnly ? '<p class="staff-documents-notice">Hồ sơ Nhân viên đã lưu trữ; danh mục tài liệu đang ở chế độ chỉ đọc.</p>' : ''}
      ${unsafe ? '<p class="staff-documents-notice is-warning" role="alert">Dữ liệu tài liệu cần kiểm tra. Hệ thống đã khóa chỉnh sửa để tránh ghi đè.</p>' : ''}
      ${state.message ? `<p class="staff-documents-notice" role="status">${escapeHtml(state.message)}</p>` : ''}
      ${renderStaffDocumentSummary(summary)}
      ${mode === 'create' || mode === 'edit'
        ? renderStaffDocumentForm({ state, readOnly })
        : mode === 'detail' && selected
          ? renderStaffDocumentDetail({ documentRecord: selected, readOnly, today })
          : renderStaffDocumentCatalog({ documents, filteredDocuments, filters, readOnly, today })}
    </section>
  `
}

function renderStaffDocumentSummary(summary) {
  const cells = [
    ['Đang quản lý', summary.totalActive],
    ['Còn hiệu lực', summary.valid],
    ['Sắp hết hạn', summary.expiringSoon],
    ['Hết hạn', summary.expired],
    ['Không áp dụng', summary.notApplicable],
    ['Đã lưu trữ', summary.archived],
  ]
  return `<div class="staff-documents-summary" data-staff-document-summary>${cells.map(([label, value]) => `
    <div><span>${escapeHtml(label)}</span><strong>${value}</strong></div>
  `).join('')}</div>`
}

function renderStaffDocumentCatalog({ documents, filteredDocuments, filters, readOnly, today }) {
  return `
    <div class="staff-documents-catalog" data-staff-document-catalog>
      <div class="staff-documents-filters">
        <label><span>Tìm tài liệu</span><input type="search" value="${escapeAttribute(filters.query)}" data-staff-document-filter="query" placeholder="Tên hoặc số / ký hiệu" /></label>
        <label><span>Nhóm</span><select data-staff-document-filter="category">
          <option value="all">Tất cả nhóm</option>
          ${STAFF_DOCUMENT_CATEGORIES.map(([key, label]) => `<option value="${key}" ${filters.category === key ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
        </select></label>
        <label><span>Hiệu lực</span><select data-staff-document-filter="validityStatus">
          ${[
            ['all', 'Tất cả hiệu lực'],
            ['valid', 'Còn hiệu lực'],
            ['expiring-soon', 'Sắp hết hạn'],
            ['expired', 'Hết hạn'],
            ['not-applicable', 'Không áp dụng'],
            ['needs-review', 'Cần kiểm tra'],
          ].map(([key, label]) => `<option value="${key}" ${filters.validityStatus === key ? 'selected' : ''}>${label}</option>`).join('')}
        </select></label>
        <label><span>Lưu trữ</span><select data-staff-document-filter="archiveState">
          ${[
            ['active', 'Đang quản lý'],
            ['archived', 'Đã lưu trữ'],
            ['all', 'Tất cả'],
          ].map(([key, label]) => `<option value="${key}" ${filters.archiveState === key ? 'selected' : ''}>${label}</option>`).join('')}
        </select></label>
        <button type="button" data-staff-document-action="clear-filters">Xóa bộ lọc</button>
      </div>
      <div data-staff-document-results>
        ${renderStaffDocumentResults({ documents, filteredDocuments, readOnly, today })}
      </div>
    </div>
  `
}

export function renderStaffDocumentResults({ documents, filteredDocuments, readOnly, today }) {
  if (!documents.length) {
    return '<div class="staff-documents-empty"><strong>Chưa có tài liệu.</strong><p>Thêm metadata tài liệu để theo dõi ngày hiệu lực và lưu trữ.</p></div>'
  }
  if (!filteredDocuments.length) {
    return '<div class="staff-documents-empty"><strong>Không có tài liệu phù hợp với bộ lọc hiện tại.</strong><button type="button" data-staff-document-action="clear-filters">Xóa bộ lọc</button></div>'
  }

  return `<div class="staff-documents-list">${filteredDocuments.map((documentRecord) => {
    const status = getStaffDocumentValidityStatus(documentRecord, { today })
    return `
      <article class="staff-document-card is-${escapeAttribute(status)}">
        <div class="staff-document-card-main">
          <span>${escapeHtml(getStaffDocumentCategoryLabel(documentRecord.category))}</span>
          <strong>${escapeHtml(documentRecord.title || 'Tài liệu cần kiểm tra')}</strong>
          <p>${escapeHtml(documentRecord.documentNumber ? `Số / ký hiệu: ${documentRecord.documentNumber}` : 'Chưa có số / ký hiệu')}</p>
        </div>
        <div class="staff-document-card-dates">
          <span>Hiệu lực: ${escapeHtml(formatDate(documentRecord.effectiveDate))}</span>
          <span>Hết hạn: ${escapeHtml(formatDate(documentRecord.expiryDate))}</span>
        </div>
        <span class="staff-document-validity is-${escapeAttribute(status)}">${escapeHtml(getStaffDocumentValidityLabel(status))}</span>
        <div class="staff-document-card-actions">
          <button type="button" data-staff-document-action="open-detail" data-document-id="${escapeAttribute(documentRecord.id)}">Chi tiết</button>
          ${readOnly || documentRecord.archivedAt ? '' : `<button type="button" data-staff-document-action="start-edit" data-document-id="${escapeAttribute(documentRecord.id)}">Sửa</button>`}
          ${readOnly ? '' : documentRecord.archivedAt
            ? `<button type="button" data-staff-document-action="restore" data-document-id="${escapeAttribute(documentRecord.id)}">Khôi phục</button>`
            : `<button type="button" data-staff-document-action="archive" data-document-id="${escapeAttribute(documentRecord.id)}">Lưu trữ</button>`}
        </div>
      </article>`
  }).join('')}</div>`
}

function renderStaffDocumentDetail({ documentRecord, readOnly, today }) {
  const status = getStaffDocumentValidityStatus(documentRecord, { today })
  return `
    <div class="staff-document-detail" data-staff-document-detail>
      <div class="staff-document-detail-actions">
        <button type="button" data-staff-document-action="back-to-list">Quay lại danh mục</button>
        ${readOnly || documentRecord.archivedAt || status === 'needs-review' ? '' : `<button type="button" data-staff-document-action="start-edit" data-document-id="${escapeAttribute(documentRecord.id)}">Sửa</button>`}
      </div>
      <div class="staff-administrative-view-grid">
        ${renderDetailField('Tên tài liệu', documentRecord.title, true)}
        ${renderDetailField('Nhóm', getStaffDocumentCategoryLabel(documentRecord.category))}
        ${renderDetailField('Trạng thái hiệu lực', getStaffDocumentValidityLabel(status))}
        ${renderDetailField('Số / ký hiệu', documentRecord.documentNumber)}
        ${renderDetailField('Ngày ban hành', formatDate(documentRecord.issuedDate))}
        ${renderDetailField('Ngày hiệu lực', formatDate(documentRecord.effectiveDate))}
        ${renderDetailField('Ngày hết hạn', formatDate(documentRecord.expiryDate))}
        ${renderDetailField('Ghi chú', documentRecord.note, true)}
      </div>
      <div class="staff-document-attachment-state">
        <strong>Chưa có tệp đính kèm</strong>
        <p>Backend lưu trữ riêng tư chưa được bật cho Hồ sơ hành chính. Phase này chỉ quản lý metadata tài liệu và không có thao tác tải tệp.</p>
      </div>
    </div>
  `
}

function renderStaffDocumentForm({ state, readOnly }) {
  if (readOnly) return '<p class="staff-documents-notice">Không thể sửa tài liệu khi hồ sơ Nhân viên đã lưu trữ.</p>'
  const values = { ...EMPTY_DOCUMENT_VALUES, ...(state.values || {}) }
  const errors = state.errors || {}
  const field = (name, label, type = 'text', wide = false) => `
    <label class="staff-administrative-form-field ${wide ? 'is-wide' : ''}">
      <span>${escapeHtml(label)}</span>
      ${type === 'textarea'
        ? `<textarea rows="4" data-staff-document-field="${name}" aria-invalid="${Boolean(errors[name])}">${escapeHtml(values[name])}</textarea>`
        : `<input type="${type}" value="${escapeAttribute(values[name])}" data-staff-document-field="${name}" autocomplete="off" aria-invalid="${Boolean(errors[name])}" />`}
      ${errors[name] ? `<small class="staff-administrative-field-error">${escapeHtml(errors[name])}</small>` : ''}
    </label>`
  return `
    <form class="staff-document-form" data-staff-document-form autocomplete="off" novalidate>
      <div class="staff-administrative-form-grid">
        <label class="staff-administrative-form-field">
          <span>Nhóm tài liệu</span>
          <select data-staff-document-field="category" aria-invalid="${Boolean(errors.category)}">
            ${STAFF_DOCUMENT_CATEGORIES.map(([key, label]) => `<option value="${key}" ${values.category === key ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
          ${errors.category ? `<small class="staff-administrative-field-error">${escapeHtml(errors.category)}</small>` : ''}
        </label>
        ${field('title', 'Tên tài liệu')}
        ${field('documentNumber', 'Số / ký hiệu')}
        ${field('issuedDate', 'Ngày ban hành', 'date')}
        ${field('effectiveDate', 'Ngày hiệu lực', 'date')}
        ${field('expiryDate', 'Ngày hết hạn', 'date')}
        ${field('note', 'Ghi chú', 'textarea', true)}
      </div>
      <div class="staff-document-attachment-state">
        <strong>Chưa có tệp đính kèm</strong>
        <p>Backend lưu trữ riêng tư chưa được bật. Không có thao tác tải tệp trong phase này.</p>
      </div>
      ${errors.form ? `<p class="staff-documents-notice is-warning" role="alert">${escapeHtml(errors.form)}</p>` : ''}
      <div class="staff-administrative-form-actions">
        <button type="button" data-staff-document-action="cancel-form">Hủy</button>
        <button type="submit" ${state.isSaving ? 'disabled' : ''}>${state.isSaving ? 'Đang lưu…' : state.mode === 'create' ? 'Tạo tài liệu' : 'Lưu tài liệu'}</button>
      </div>
    </form>
  `
}

function renderDetailField(label, value, wide = false) {
  return `<div class="staff-administrative-view-field ${wide ? 'is-wide' : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(normalizeText(value) || '—')}</strong></div>`
}

function formatDate(value) {
  const normalized = normalizeText(value)
  if (!normalized) return 'Không áp dụng'
  if (!isRealDate(normalized)) return 'Cần kiểm tra'
  const [year, month, day] = normalized.split('-')
  return `${day}/${month}/${year}`
}

function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysToIsoDate(value, numberOfDays) {
  if (!isRealDate(value)) return value
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + numberOfDays))
  return date.toISOString().slice(0, 10)
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isIsoDateTime(value) {
  const date = new Date(value)
  return Boolean(value && !Number.isNaN(date.getTime()) && date.toISOString() === value)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;')
}
