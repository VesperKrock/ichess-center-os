export function getUserDisplayName(user) {
  const metadata = user?.user_metadata ?? {}

  return firstNonEmptyValue([
    metadata.full_name,
    metadata.display_name,
    metadata.name,
  ])
}

export function getUploaderDisplayName(attachment = {}, currentUser = null) {
  const attachmentDisplayName = firstNonEmptyValue([
    attachment.uploaded_by_name,
    attachment.uploader_name,
    attachment.uploaderDisplayName,
    attachment.uploadedByName,
  ])

  if (attachmentDisplayName) {
    return attachmentDisplayName
  }

  const uploadedBy = String(
    attachment.uploadedBy ?? attachment.uploaded_by ?? '',
  ).trim()

  if (uploadedBy && uploadedBy === String(currentUser?.id ?? '').trim()) {
    return (
      getUserDisplayName(currentUser) ||
      String(currentUser?.email ?? '').trim() ||
      getShortUserIdentifier(uploadedBy)
    )
  }

  return getShortUserIdentifier(uploadedBy)
}

export function getShortUserIdentifier(userId) {
  const normalizedId = String(userId ?? '').trim()

  if (!normalizedId) {
    return 'Không rõ người tải'
  }

  if (normalizedId.length <= 16) {
    return `Người dùng ${normalizedId}`
  }

  return `Người dùng ${normalizedId.slice(0, 8)}…${normalizedId.slice(-6)}`
}

function firstNonEmptyValue(values) {
  return values.map((value) => String(value ?? '').trim()).find(Boolean) ?? ''
}
