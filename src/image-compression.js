export const TRANSACTION_IMAGE_MAX_SOURCE_SIZE = 10 * 1024 * 1024
export const TRANSACTION_IMAGE_MAX_DIMENSION = 1920
export const TRANSACTION_IMAGE_QUALITY = 0.82
export const TRANSACTION_IMAGE_OUTPUT_TYPE = 'image/jpeg'

const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateTransactionImageFile(file) {
  if (!file || !supportedImageTypes.has(String(file.type ?? '').toLowerCase())) {
    return {
      ok: false,
      error: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.',
    }
  }

  if (Number(file.size || 0) > TRANSACTION_IMAGE_MAX_SOURCE_SIZE) {
    return {
      ok: false,
      error: 'Ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.',
    }
  }

  return {
    ok: true,
    data: {
      name: String(file.name ?? ''),
      mimeType: String(file.type).toLowerCase(),
      sizeBytes: Number(file.size || 0),
    },
  }
}

export function calculateCompressedDimensions(
  width,
  height,
  maxDimension = TRANSACTION_IMAGE_MAX_DIMENSION,
) {
  const sourceWidth = Number(width)
  const sourceHeight = Number(height)
  const limit = Number(maxDimension)

  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    !Number.isFinite(limit) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    limit <= 0
  ) {
    return {
      width: 0,
      height: 0,
    }
  }

  const scale = Math.min(1, limit / Math.max(sourceWidth, sourceHeight))

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

export async function compressTransactionImage(file, options = {}) {
  const validation = validateTransactionImageFile(file)

  if (!validation.ok) {
    return validation
  }

  const maxDimension = options.maxDimension ?? TRANSACTION_IMAGE_MAX_DIMENSION
  const quality = options.quality ?? TRANSACTION_IMAGE_QUALITY

  try {
    const image = await loadImage(file)
    const dimensions = calculateCompressedDimensions(
      image.naturalWidth,
      image.naturalHeight,
      maxDimension,
    )
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context || !dimensions.width || !dimensions.height) {
      return {
        ok: false,
        error: 'Không thể tạo vùng nén ảnh.',
      }
    }

    canvas.width = dimensions.width
    canvas.height = dimensions.height
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await canvasToBlob(canvas, TRANSACTION_IMAGE_OUTPUT_TYPE, quality)

    if (!blob) {
      return {
        ok: false,
        error: 'Không thể nén ảnh đã chọn.',
      }
    }

    return {
      ok: true,
      data: {
        blob,
        mimeType: TRANSACTION_IMAGE_OUTPUT_TYPE,
        sizeBytes: blob.size,
        width: dimensions.width,
        height: dimensions.height,
        compressed: true,
        compressionQuality: quality,
        maxDimension,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Không thể đọc hoặc nén ảnh đã chọn.',
    }
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.addEventListener('load', () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    })

    image.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('File ảnh không đọc được.'))
    })

    image.src = objectUrl
  })
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality)
  })
}
