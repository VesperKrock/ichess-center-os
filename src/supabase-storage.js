import { CURRENT_CENTER_ID, getCurrentCenterMembership, getCurrentSupabaseUser } from './supabase-auth.js'
import { getSupabaseClient } from './supabase-client.js'
import {
  isTransactionAttachmentRoleAllowed,
  TRANSACTION_IMAGES_BUCKET,
} from './transaction-attachments.js'

export async function uploadTransactionImageBlob({
  centerId = CURRENT_CENTER_ID,
  storagePath,
  blob,
} = {}) {
  return runAuthorizedStorageOperation(centerId, async (client) => {
    if (!(blob instanceof Blob) || blob.type !== 'image/jpeg') {
      return failure('Ảnh upload phải là JPEG đã nén.')
    }

    if (!isCenterStoragePath(storagePath, centerId)) {
      return failure('Storage path không hợp lệ.')
    }

    const { data, error } = await client.storage
      .from(TRANSACTION_IMAGES_BUCKET)
      .upload(storagePath, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (error) {
      return failure(error.message)
    }

    return success(data)
  })
}

export async function createTransactionImageSignedUrl(
  storagePath,
  expiresIn = 60 * 60,
  centerId = CURRENT_CENTER_ID,
) {
  return runAuthorizedStorageOperation(centerId, async (client) => {
    if (!isCenterStoragePath(storagePath, centerId)) {
      return failure('Storage path không hợp lệ.')
    }

    const { data, error } = await client.storage
      .from(TRANSACTION_IMAGES_BUCKET)
      .createSignedUrl(storagePath, expiresIn)

    if (error) {
      return failure(error.message)
    }

    return success({
      signedUrl: data.signedUrl,
      expiresIn,
    })
  })
}

export async function deleteTransactionImageObject(
  storagePath,
  centerId = CURRENT_CENTER_ID,
) {
  return runAuthorizedStorageOperation(centerId, async (client) => {
    if (!isCenterStoragePath(storagePath, centerId)) {
      return failure('Storage path không hợp lệ.')
    }

    const { data, error } = await client.storage
      .from(TRANSACTION_IMAGES_BUCKET)
      .remove([storagePath])

    if (error) {
      return failure(error.message)
    }

    return success({
      storagePath,
      removed: data ?? [],
    })
  })
}

async function runAuthorizedStorageOperation(centerId, operation) {
  const client = getSupabaseClient()
  const normalizedCenterId = String(centerId ?? '').trim()

  if (!client) {
    return failure('Chưa cấu hình Supabase.')
  }

  if (!normalizedCenterId) {
    return failure('Thieu ma co so hien tai.')
  }

  try {
    const user = await getCurrentSupabaseUser()

    if (!user) {
      return failure('Chưa đăng nhập Supabase.')
    }

    const membership = await getCurrentCenterMembership(user.id, normalizedCenterId)

    if (!membership?.role) {
      return failure(`Tai khoan chua duoc cap quyen cho co so ${normalizedCenterId}.`)
    }

    if (!isTransactionAttachmentRoleAllowed(membership.role)) {
      return failure(`Role ${membership.role} khong co quyen quan ly chung tu giao dich.`)
    }

    return await operation(client, user, membership)
  } catch (error) {
    return failure(error?.message || 'Không thể truy cập Supabase Storage.')
  }
}

function isCenterStoragePath(storagePath, centerId) {
  const path = String(storagePath ?? '').trim()
  const segments = path.split('/')

  return (
    path.startsWith(`${centerId}/${TRANSACTION_IMAGES_BUCKET}/`) &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.includes('//') &&
    segments.every((segment) => segment && segment !== '.' && segment !== '..')
  )
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
