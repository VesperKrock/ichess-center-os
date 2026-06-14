import { CURRENT_CENTER_ID, getCurrentCenterMembership, getCurrentSupabaseUser } from './supabase-auth.js'
import { getSupabaseClient } from './supabase-client.js'

export const TRANSACTION_IMAGES_BUCKET = 'transaction-images'

export function normalizeTransactionDate(dateInput, fallbackDate = new Date()) {
  const parsedDate = parseDateInput(dateInput) ?? parseDateInput(fallbackDate)

  if (!parsedDate) {
    return {
      ok: false,
      error: 'Ngày giao dịch không hợp lệ.',
    }
  }

  const year = String(parsedDate.getFullYear())
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')

  return {
    ok: true,
    data: {
      dateIso: `${year}-${month}-${day}`,
      yyyymmdd: `${year}${month}${day}`,
      year,
      month,
      monthKey: `${year}-${month}`,
    },
  }
}

export function getCurrentMonthKey(dateInput = new Date()) {
  const normalizedDate = normalizeTransactionDate(dateInput)
  return normalizedDate.ok ? normalizedDate.data.monthKey : ''
}

export function buildTransactionCode(dateInput, sequenceNumber) {
  const normalizedDate = normalizeTransactionDate(dateInput)
  const sequence = normalizePositiveInteger(sequenceNumber)

  if (!normalizedDate.ok || !sequence) {
    return ''
  }

  return `TC-${normalizedDate.data.yyyymmdd}-${String(sequence).padStart(4, '0')}`
}

export function buildAttachmentFileName(
  transactionCode,
  attachmentIndex,
  extension = 'jpg',
) {
  const normalizedCode = String(transactionCode ?? '').trim()
  const index = normalizePositiveInteger(attachmentIndex)
  const normalizedExtension = String(extension ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\.+/, '')
    .replace(/[^a-z0-9]/g, '')

  if (!normalizedCode || !index || !normalizedExtension) {
    return ''
  }

  return `${normalizedCode}-${String(index).padStart(2, '0')}.${normalizedExtension}`
}

export function buildTransactionImageStoragePath({
  centerId = CURRENT_CENTER_ID,
  dateInput,
  fileName,
} = {}) {
  const normalizedDate = normalizeTransactionDate(dateInput)
  const normalizedCenterId = normalizePathSegment(centerId)
  const normalizedFileName = normalizeFileName(fileName)

  if (!normalizedDate.ok || !normalizedCenterId || !normalizedFileName) {
    return ''
  }

  return [
    normalizedCenterId,
    TRANSACTION_IMAGES_BUCKET,
    normalizedDate.data.year,
    normalizedDate.data.month,
    normalizedFileName,
  ].join('/')
}

export function buildTransactionAttachmentMetadata(payload = {}) {
  const normalizedDate = normalizeTransactionDate(payload.transactionDate, null)
  const centerId = String(payload.centerId ?? CURRENT_CENTER_ID).trim()

  if (!normalizedDate.ok) {
    return {
      ok: false,
      error: normalizedDate.error,
    }
  }

  const metadata = {
    center_id: centerId,
    transaction_code: String(payload.transactionCode ?? '').trim(),
    transaction_date: normalizedDate.data.dateIso,
    month_key: normalizedDate.data.monthKey,
    amount: normalizeNonNegativeNumber(payload.amount),
    cashflow_type: String(payload.cashflowType ?? '').trim(),
    note: String(payload.note ?? '').trim(),
    original_name: normalizeFileName(payload.originalName),
    file_name: normalizeFileName(payload.fileName),
    mime_type: String(payload.mimeType ?? '').trim().toLowerCase(),
    size_bytes: normalizeNonNegativeInteger(payload.sizeBytes),
    storage_bucket: TRANSACTION_IMAGES_BUCKET,
    storage_path: String(payload.storagePath ?? '').trim().replace(/^\/+/, ''),
    uploaded_by: String(payload.uploadedBy ?? '').trim(),
  }

  const invalidField = getInvalidMetadataField(metadata, normalizedDate.data)

  if (invalidField) {
    return {
      ok: false,
      error: `Metadata attachment không hợp lệ: ${invalidField}.`,
    }
  }

  return {
    ok: true,
    data: metadata,
  }
}

export async function listTransactionAttachmentsByMonth({
  centerId = CURRENT_CENTER_ID,
  monthKey = getCurrentMonthKey(),
} = {}) {
  return runAuthorizedAttachmentOperation(centerId, async (client) => {
    if (!/^\d{4}-\d{2}$/.test(String(monthKey ?? ''))) {
      return failure('monthKey không hợp lệ.')
    }

    const { data, error } = await client
      .from('transaction_attachments')
      .select(
        'id, center_id, transaction_code, transaction_date, month_key, amount, cashflow_type, note, original_name, file_name, mime_type, size_bytes, storage_bucket, storage_path, uploaded_by, created_at',
      )
      .eq('center_id', centerId)
      .eq('month_key', monthKey)
      .order('created_at', { ascending: false })

    if (error) {
      return failure(error.message)
    }

    return success((data ?? []).map(mapTransactionAttachmentFromDatabase))
  })
}

export async function listTransactionAttachmentsByTransactionCode({
  centerId = CURRENT_CENTER_ID,
  transactionCode,
} = {}) {
  const normalizedCode = String(transactionCode ?? '').trim()

  if (!normalizedCode) {
    return failure('Thiếu mã giao dịch.')
  }

  return runAuthorizedAttachmentOperation(centerId, async (client) => {
    const { data, error } = await client
      .from('transaction_attachments')
      .select(
        'id, center_id, transaction_code, transaction_date, month_key, amount, cashflow_type, note, original_name, file_name, mime_type, size_bytes, storage_bucket, storage_path, uploaded_by, created_at',
      )
      .eq('center_id', centerId)
      .eq('transaction_code', normalizedCode)
      .order('created_at', { ascending: true })

    if (error) {
      return failure(error.message)
    }

    return success((data ?? []).map(mapTransactionAttachmentFromDatabase))
  })
}

export async function createTransactionAttachmentMetadata(payload = {}) {
  const centerId = String(payload.centerId ?? CURRENT_CENTER_ID).trim()

  return runAuthorizedAttachmentOperation(centerId, async (client, user) => {
    const metadataResult = buildTransactionAttachmentMetadata({
      ...payload,
      centerId,
      uploadedBy: user.id,
    })

    if (!metadataResult.ok) {
      return metadataResult
    }

    const { data, error } = await client
      .from('transaction_attachments')
      .insert(metadataResult.data)
      .select()
      .single()

    if (error) {
      return failure(error.message)
    }

    return success(mapTransactionAttachmentFromDatabase(data))
  })
}

export async function deleteTransactionAttachmentMetadata(
  id,
  centerId = CURRENT_CENTER_ID,
) {
  const attachmentId = String(id ?? '').trim()

  if (!attachmentId) {
    return failure('Thiếu id metadata attachment.')
  }

  return runAuthorizedAttachmentOperation(centerId, async (client) => {
    const { error } = await client
      .from('transaction_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('center_id', centerId)

    if (error) {
      return failure(error.message)
    }

    return success({ id: attachmentId })
  })
}

async function runAuthorizedAttachmentOperation(centerId, operation) {
  const client = getSupabaseClient()

  if (!client) {
    return failure('Chưa cấu hình Supabase.')
  }

  try {
    const user = await getCurrentSupabaseUser()

    if (!user) {
      return failure('Chưa đăng nhập Supabase.')
    }

    const membership = await getCurrentCenterMembership(user.id, centerId)

    if (!membership?.role) {
      return failure(`Tài khoản chưa được cấp quyền cho cơ sở ${centerId}.`)
    }

    return await operation(client, user, membership)
  } catch (error) {
    return failure(error?.message || 'Không thể truy cập metadata attachment.')
  }
}

function mapTransactionAttachmentFromDatabase(row = {}) {
  return {
    id: row.id ?? null,
    centerId: row.center_id ?? '',
    transactionCode: row.transaction_code ?? '',
    transactionDate: row.transaction_date ?? '',
    monthKey: row.month_key ?? '',
    amount: Number(row.amount ?? 0),
    cashflowType: row.cashflow_type ?? '',
    note: row.note ?? '',
    originalName: row.original_name ?? '',
    fileName: row.file_name ?? '',
    mimeType: row.mime_type ?? '',
    sizeBytes: Number(row.size_bytes ?? 0),
    storageBucket: row.storage_bucket ?? '',
    storagePath: row.storage_path ?? '',
    uploadedBy: row.uploaded_by ?? '',
    createdAt: row.created_at ?? '',
  }
}

function parseDateInput(dateInput) {
  if (dateInput instanceof Date && !Number.isNaN(dateInput.getTime())) {
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate())
  }

  const text = String(dateInput ?? '').trim()
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (match) {
    return createValidatedDate(Number(match[1]), Number(match[2]), Number(match[3]))
  }

  match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

  if (match) {
    return createValidatedDate(Number(match[3]), Number(match[2]), Number(match[1]))
  }

  return null
}

function createValidatedDate(year, month, day) {
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function normalizePositiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : 0
}

function normalizeNonNegativeInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : 0
}

function normalizeNonNegativeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function normalizePathSegment(value) {
  return String(value ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[\\/]/g, '-')
}

function normalizeFileName(value) {
  return String(value ?? '')
    .trim()
    .replace(/^.*[\\/]/, '')
}

function getInvalidMetadataField(metadata, normalizedDate) {
  const requiredFields = [
    'center_id',
    'transaction_code',
    'transaction_date',
    'month_key',
    'original_name',
    'file_name',
    'mime_type',
    'storage_path',
    'uploaded_by',
  ]

  const missingField = requiredFields.find((field) => !metadata[field])

  if (missingField) {
    return missingField
  }

  if (!['income', 'expense'].includes(metadata.cashflow_type)) {
    return 'cashflow_type'
  }

  if (!metadata.mime_type.startsWith('image/')) {
    return 'mime_type'
  }

  if (
    metadata.storage_path.includes('base64') ||
    /^[a-zA-Z]:[\\/]/.test(metadata.storage_path) ||
    metadata.storage_path.startsWith('\\\\')
  ) {
    return 'storage_path'
  }

  const expectedStoragePrefix = [
    metadata.center_id,
    TRANSACTION_IMAGES_BUCKET,
    normalizedDate.year,
    normalizedDate.month,
    '',
  ].join('/')

  if (!metadata.storage_path.startsWith(expectedStoragePrefix)) {
    return 'storage_path'
  }

  return ''
}

function success(data) {
  return {
    ok: true,
    data,
    error: '',
  }
}

function failure(error) {
  return {
    ok: false,
    data: null,
    error: String(error ?? 'Lỗi không xác định.'),
  }
}
