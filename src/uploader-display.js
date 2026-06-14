export function getUserDisplayName(user) {
  const metadata = user?.user_metadata ?? {}

  return firstNonEmptyValue([
    metadata.full_name,
    metadata.display_name,
    metadata.name,
  ])
}

export function getUploaderDisplayName(
  attachment = {},
  currentUser = null,
  memberProfileMap = {},
) {
  const uploadedByName = firstNonEmptyValue([
    attachment.uploaded_by_name,
    attachment.uploadedByName,
  ])

  if (uploadedByName) {
    return uploadedByName
  }

  const uploadedBy = String(
    attachment.uploadedBy ?? attachment.uploaded_by ?? '',
  ).trim()
  const memberProfile = memberProfileMap?.[uploadedBy]
  const profileDisplayName = firstNonEmptyValue([
    memberProfile?.displayName,
    memberProfile?.memberLabel,
    memberProfile?.emailSnapshot,
  ])

  if (profileDisplayName) {
    return profileDisplayName
  }

  if (uploadedBy && uploadedBy === String(currentUser?.id ?? '').trim()) {
    return (
      getUserDisplayName(currentUser) ||
      String(currentUser?.email ?? '').trim() ||
      getShortUserIdentifier(uploadedBy)
    )
  }

  const futureAttachmentDisplayName = firstNonEmptyValue([
    attachment.uploader_name,
    attachment.uploaderDisplayName,
  ])

  if (futureAttachmentDisplayName) {
    return futureAttachmentDisplayName
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
