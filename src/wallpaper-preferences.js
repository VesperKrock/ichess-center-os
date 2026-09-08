const DB_NAME = 'ichess-center-os-presentation-v2'
const STORE_NAME = 'personal-wallpapers'
const DB_VERSION = 1
const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024

export function buildPersonalWallpaperKey({ installationNamespace, userId } = {}) {
  const namespace = cleanKeyPart(installationNamespace)
  const identity = cleanKeyPart(userId)
  if (!namespace || !identity) return ''
  return `${namespace}:${identity}`
}

export function resolveWallpaperPriority({ personalUrl = '', sharedUrl = '' } = {}) {
  if (cleanText(personalUrl)) return { source: 'personal', url: cleanText(personalUrl) }
  if (cleanText(sharedUrl)) return { source: 'shared', url: cleanText(sharedUrl) }
  return { source: 'default', url: '' }
}

export async function loadPersonalWallpaperBlob(scope = {}, indexedDb = globalThis.indexedDB) {
  const key = buildPersonalWallpaperKey(scope)
  if (!key || !indexedDb) return null
  const db = await openDatabase(indexedDb)
  try {
    return await transactionRequest(db, 'readonly', (store) => store.get(key))
  } finally {
    db.close()
  }
}

export async function savePersonalWallpaperBlob(scope = {}, blob, indexedDb = globalThis.indexedDB) {
  const key = buildPersonalWallpaperKey(scope)
  if (!key) throw new Error('Không xác định được tài khoản đang lưu hình nền cá nhân.')
  if (!(blob instanceof Blob) || blob.type !== 'image/webp' || blob.size > MAX_OUTPUT_BYTES) {
    throw new Error('Hình nền cá nhân chưa đúng định dạng an toàn.')
  }
  if (!indexedDb) throw new Error('Trình duyệt không hỗ trợ lưu hình nền riêng trên thiết bị này.')
  const db = await openDatabase(indexedDb)
  try {
    await transactionRequest(db, 'readwrite', (store) => store.put(blob, key))
  } finally {
    db.close()
  }
  return true
}

export async function removePersonalWallpaperBlob(scope = {}, indexedDb = globalThis.indexedDB) {
  const key = buildPersonalWallpaperKey(scope)
  if (!key || !indexedDb) return false
  const db = await openDatabase(indexedDb)
  try {
    await transactionRequest(db, 'readwrite', (store) => store.delete(key))
  } finally {
    db.close()
  }
  return true
}

export async function prepareWallpaperImage(file, options = {}) {
  if (!(file instanceof Blob) || !String(file.type || '').startsWith('image/')) {
    throw new Error('Vui lòng chọn một tệp hình ảnh.')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Ảnh nguồn quá lớn. Vui lòng chọn ảnh dưới 12 MB.')
  }
  const maxWidth = Number(options.maxWidth) || 1920
  const maxHeight = Number(options.maxHeight) || 1080
  const quality = Number(options.quality) || 0.84
  if (typeof globalThis.createImageBitmap !== 'function' || typeof document === 'undefined') {
    throw new Error('Trình duyệt chưa hỗ trợ chuẩn hóa hình nền an toàn.')
  }
  const bitmap = await globalThis.createImageBitmap(file)
  try {
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Không thể xử lý hình nền trên thiết bị này.')
    context.fillStyle = '#0b1017'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    if (!(blob instanceof Blob) || blob.type !== 'image/webp' || blob.size > MAX_OUTPUT_BYTES) {
      throw new Error('Không thể chuẩn hóa ảnh dưới giới hạn 4 MB.')
    }
    return blob
  } finally {
    bitmap.close?.()
  }
}

function openDatabase(indexedDb) {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Không thể mở vùng lưu hình nền cá nhân.'))
  })
}

function transactionRequest(db, mode, createRequest) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const request = createRequest(transaction.objectStore(STORE_NAME))
    let result = null
    request.onsuccess = () => { result = request.result ?? null }
    request.onerror = () => reject(new Error('Không thể cập nhật hình nền cá nhân.'))
    transaction.onabort = () => reject(new Error('Không thể cập nhật hình nền cá nhân.'))
    transaction.oncomplete = () => resolve(result)
  })
}

function cleanKeyPart(value) {
  return cleanText(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 180)
}

function cleanText(value) {
  return String(value ?? '').trim()
}
