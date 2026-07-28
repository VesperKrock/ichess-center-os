export const STAFF_DOCUMENT_CONTENT_SCROLL_SELECTOR = '.staff-administrative-content-scroll'

export function captureStaffDocumentViewerReturnContext({
  windowId,
  centerId,
  staffMemberId,
  administrativeProfileId,
  documentId,
  attachmentId,
  sectionId,
  mode,
  triggerAction = 'attachment-view',
  attachmentVersion = 0,
  maximized = false,
  scrollContainer,
} = {}) {
  if (
    !windowId ||
    !centerId ||
    !staffMemberId ||
    !administrativeProfileId ||
    !documentId ||
    !attachmentId ||
    !sectionId ||
    mode !== 'detail' ||
    !['attachment-view', 'attachment-version-view'].includes(triggerAction) ||
    (triggerAction === 'attachment-version-view' && Number(attachmentVersion) < 1) ||
    !scrollContainer
  ) return null

  return {
    windowId,
    centerId,
    staffMemberId,
    administrativeProfileId,
    documentId,
    attachmentId,
    sectionId,
    mode,
    triggerAction,
    attachmentVersion: triggerAction === 'attachment-version-view'
      ? Number(attachmentVersion)
      : 0,
    maximized: Boolean(maximized),
    scrollTop: normalizeScrollPosition(scrollContainer.scrollTop),
    scrollLeft: normalizeScrollPosition(scrollContainer.scrollLeft),
  }
}

export function isStaffDocumentViewerReturnContextCurrent(
  context,
  { windowItem, documentState } = {},
) {
  const attachmentMatches = documentState?.attachment?.record?.id === context?.attachmentId ||
    documentState?.attachment?.history?.some((item) => item?.id === context?.attachmentId)
  return Boolean(
    context &&
    windowItem?.id === context.windowId &&
    windowItem.type === 'staff-administrative-profile' &&
    windowItem.centerId === context.centerId &&
    windowItem.staffMemberId === context.staffMemberId &&
    documentState?.centerId === context.centerId &&
    documentState.staffMemberId === context.staffMemberId &&
    documentState.administrativeProfileId === context.administrativeProfileId &&
    documentState.mode === context.mode &&
    documentState.selectedDocumentId === context.documentId &&
    documentState.attachment?.documentId === context.documentId &&
    attachmentMatches
  )
}

export function scheduleStaffDocumentViewerReturnRestore({
  context,
  resolveWindowElement,
  resolveWindowItem,
  resolveDocumentState,
  resolveScrollContainer,
  resolveSection,
  resolveTrigger,
  scheduleFrame,
} = {}) {
  if (
    !context ||
    typeof resolveWindowElement !== 'function' ||
    typeof resolveWindowItem !== 'function' ||
    typeof resolveDocumentState !== 'function' ||
    typeof resolveScrollContainer !== 'function' ||
    typeof resolveSection !== 'function' ||
    typeof resolveTrigger !== 'function' ||
    typeof scheduleFrame !== 'function'
  ) return false

  scheduleFrame(() => {
    scheduleFrame(() => {
      const windowElement = resolveWindowElement(context.windowId)
      const windowItem = resolveWindowItem(context.windowId)
      const documentState = resolveDocumentState(context.windowId)
      if (
        !windowElement ||
        !isStaffDocumentViewerReturnContextCurrent(context, { windowItem, documentState }) ||
        !resolveSection(windowElement, context.sectionId)
      ) return

      const scrollContainer = resolveScrollContainer(windowElement)
      if (!scrollContainer) return

      scrollContainer.scrollTop = context.scrollTop
      scrollContainer.scrollLeft = context.scrollLeft
      resolveTrigger(windowElement, context)?.focus?.({ preventScroll: true })
    })
  })
  return true
}

function normalizeScrollPosition(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}
