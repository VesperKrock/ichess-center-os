import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  STAFF_DOCUMENT_CONTENT_SCROLL_SELECTOR,
  captureStaffDocumentViewerReturnContext,
  isStaffDocumentViewerReturnContextCurrent,
  scheduleStaffDocumentViewerReturnRestore,
} from '../src/staff-document-viewer-return.js'
import { renderStaffDocumentAttachmentPanel } from '../src/staff-documents-module.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const helperSource = read('src/staff-document-viewer-return.js')
const mainSource = read('src/main.js')
const documentSource = read('src/staff-documents-module.js')
const testSource = read('tests/f23-11e-khoi-phuc-scroll-sau-khi-dong-viewer-tai-lieu-smoke.js')

const scrollContainer = { scrollTop: 468, scrollLeft: 17 }
const context = captureStaffDocumentViewerReturnContext({
  windowId: 'staff-administrative-profile-23',
  centerId: 'center-a',
  staffMemberId: 'staff-gv001',
  administrativeProfileId: 'administrative-profile-gv001',
  documentId: 'CV-QA-001',
  attachmentId: 'attachment-image-001',
  sectionId: 'staff-administrative-profile-23-documents',
  mode: 'detail',
  triggerAction: 'attachment-view',
  attachmentVersion: 0,
  maximized: false,
  scrollContainer,
})

assert.deepEqual(context, {
  windowId: 'staff-administrative-profile-23',
  centerId: 'center-a',
  staffMemberId: 'staff-gv001',
  administrativeProfileId: 'administrative-profile-gv001',
  documentId: 'CV-QA-001',
  attachmentId: 'attachment-image-001',
  sectionId: 'staff-administrative-profile-23-documents',
  mode: 'detail',
  triggerAction: 'attachment-view',
  attachmentVersion: 0,
  maximized: false,
  scrollTop: 468,
  scrollLeft: 17,
})
assert.equal(STAFF_DOCUMENT_CONTENT_SCROLL_SELECTOR, '.staff-administrative-content-scroll')
assert.equal(captureStaffDocumentViewerReturnContext({
  ...context,
  mode: 'list',
  scrollContainer,
}), null)
assert.equal(captureStaffDocumentViewerReturnContext({
  ...context,
  scrollContainer: null,
}), null)
assert.equal(captureStaffDocumentViewerReturnContext({
  ...context,
  maximized: true,
  scrollContainer,
}).maximized, true)

const windowItem = {
  id: context.windowId,
  type: 'staff-administrative-profile',
  centerId: context.centerId,
  staffMemberId: context.staffMemberId,
  maximized: false,
}
const documentState = {
  centerId: context.centerId,
  staffMemberId: context.staffMemberId,
  administrativeProfileId: context.administrativeProfileId,
  mode: 'detail',
  selectedDocumentId: context.documentId,
  attachment: {
    documentId: context.documentId,
    record: { id: context.attachmentId },
  },
}
const stateSnapshot = structuredClone(documentState)
assert.equal(
  isStaffDocumentViewerReturnContextCurrent(context, { windowItem, documentState }),
  true,
)

const archivedContext = captureStaffDocumentViewerReturnContext({
  ...context,
  attachmentId: 'attachment-archived-001',
  triggerAction: 'attachment-version-view',
  attachmentVersion: 1,
  scrollContainer,
})
const historyDocumentState = {
  ...documentState,
  attachment: {
    ...documentState.attachment,
    history: [{ id: 'attachment-archived-001', version: 1, state: 'archived' }],
  },
}
assert.equal(
  isStaffDocumentViewerReturnContextCurrent(archivedContext, {
    windowItem,
    documentState: historyDocumentState,
  }),
  true,
  'Archived-version viewer return must keep the same document/window context.',
)

const restoredScroller = { scrollTop: 0, scrollLeft: 0 }
const focusCalls = []
const trigger = {
  focus(options) {
    focusCalls.push(options)
  },
}
const frameQueue = []
const windowElement = { id: context.windowId }
const restoreScheduled = scheduleStaffDocumentViewerReturnRestore({
  context,
  resolveWindowElement: (windowId) => windowId === context.windowId ? windowElement : null,
  resolveWindowItem: (windowId) => windowId === context.windowId ? windowItem : null,
  resolveDocumentState: (windowId) => windowId === context.windowId ? documentState : null,
  resolveScrollContainer: (element) => element === windowElement ? restoredScroller : null,
  resolveSection: (element, sectionId) => (
    element === windowElement && sectionId === context.sectionId ? { id: sectionId } : null
  ),
  resolveTrigger: (element, savedContext) => (
    element === windowElement && savedContext === context ? trigger : null
  ),
  scheduleFrame: (callback) => frameQueue.push(callback),
})

assert.equal(restoreScheduled, true)
assert.deepEqual(restoredScroller, { scrollTop: 0, scrollLeft: 0 })
assert.equal(focusCalls.length, 0)
assert.equal(frameQueue.length, 1)
frameQueue.shift()()
assert.deepEqual(restoredScroller, { scrollTop: 0, scrollLeft: 0 })
assert.equal(focusCalls.length, 0)
assert.equal(frameQueue.length, 1)
frameQueue.shift()()
assert.deepEqual(restoredScroller, { scrollTop: 468, scrollLeft: 17 })
assert.deepEqual(focusCalls, [{ preventScroll: true }])
assert.deepEqual(documentState, stateSnapshot, 'Scroll restore must not reset the selected document/tab.')

for (const staleState of [
  { ...documentState, centerId: 'center-b' },
  { ...documentState, staffMemberId: 'staff-other' },
  { ...documentState, administrativeProfileId: 'administrative-profile-other' },
  { ...documentState, mode: 'list' },
  { ...documentState, selectedDocumentId: 'CV-OTHER' },
  { ...documentState, attachment: { ...documentState.attachment, documentId: 'CV-OTHER' } },
  { ...documentState, attachment: { ...documentState.attachment, record: { id: 'attachment-other' } } },
]) {
  assert.equal(
    isStaffDocumentViewerReturnContextCurrent(context, { windowItem, documentState: staleState }),
    false,
    'Return context must not leak to another center/profile/document/attachment state.',
  )
}
assert.equal(isStaffDocumentViewerReturnContextCurrent(context, {
  windowItem: { ...windowItem, id: 'staff-administrative-profile-other' },
  documentState,
}), false)

const staleFrames = []
const staleScroller = { scrollTop: 9, scrollLeft: 3 }
let staleFocusCount = 0
scheduleStaffDocumentViewerReturnRestore({
  context,
  resolveWindowElement: () => windowElement,
  resolveWindowItem: () => windowItem,
  resolveDocumentState: () => ({ ...documentState, selectedDocumentId: 'CV-OTHER' }),
  resolveScrollContainer: () => staleScroller,
  resolveSection: () => ({ id: context.sectionId }),
  resolveTrigger: () => ({ focus: () => { staleFocusCount += 1 } }),
  scheduleFrame: (callback) => staleFrames.push(callback),
})
staleFrames.shift()()
staleFrames.shift()()
assert.deepEqual(staleScroller, { scrollTop: 9, scrollLeft: 3 })
assert.equal(staleFocusCount, 0)

const attachmentHtml = renderStaffDocumentAttachmentPanel({
  documentRecord: { id: context.documentId, archivedAt: '' },
  state: {
    status: 'ready',
    record: {
      id: context.attachmentId,
      documentId: context.documentId,
      state: 'available',
      originalFileName: 'attachment.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      version: 1,
      createdAt: '2026-07-28T00:00:00.000Z',
    },
  },
})
assert(attachmentHtml.includes('data-staff-document-action="attachment-view"'))
assert(attachmentHtml.includes(`data-document-id="${context.documentId}"`))
assert(!attachmentHtml.includes(context.attachmentId))

const accessStart = mainSource.indexOf('async function handleStaffDocumentAttachmentAccess')
const accessEnd = mainSource.indexOf('function refreshStaffDocumentResultsRegion', accessStart)
const accessSource = mainSource.slice(accessStart, accessEnd)
assert(accessSource.indexOf('captureStaffDocumentAttachmentViewerReturnContext(') < accessSource.indexOf('refreshStaffDocumentsSection(windowId)'))
assert(accessSource.includes('returnContext: viewerReturnContext'))

const closeStart = mainSource.indexOf('function closeStaffDocumentAttachmentViewer')
const closeEnd = mainSource.indexOf('function renderNotificationCenterV15J', closeStart)
const closeSource = mainSource.slice(closeStart, closeEnd)
assert(closeSource.includes('clearStaffDocumentAttachmentViewerState()'))
assert(closeSource.includes('pendingStaffDocumentViewerReturnContext = returnContext'))
assert(closeSource.includes("viewer.signedUrl = ''"))
assert(closeSource.includes('window.clearTimeout(viewer.expiryTimerId)'))
assert(closeSource.includes('scheduleStaffDocumentViewerReturnRestore({'))
assert(closeSource.includes('STAFF_DOCUMENT_CONTENT_SCROLL_SELECTOR'))
assert(closeSource.includes('returnContext.triggerAction'))
assert(closeSource.includes('returnContext.attachmentVersion'))

const viewerBindingStart = mainSource.indexOf('function bindStaffDocumentAttachmentViewer')
const viewerBindingEnd = mainSource.indexOf('function focusStaffDocumentAttachmentViewerAfterRender', viewerBindingStart)
const viewerBindingSource = mainSource.slice(viewerBindingStart, viewerBindingEnd)
assert.equal((viewerBindingSource.match(/closeStaffDocumentAttachmentViewer\(\)/g) || []).length, 2)
assert(accessSource.includes('closeStaffDocumentAttachmentViewer()'), 'Signed URL expiry must use the shared close contract.')

for (const forbidden of [
  'window.scrollTo',
  'document.body.scroll',
  'scrollIntoView',
  'autofocus',
]) {
  assert(!helperSource.includes(forbidden), `Viewer return helper must not use ${forbidden}.`)
  assert(!closeSource.includes(forbidden), `Viewer close/restore must not use ${forbidden}.`)
}
assert(!closeSource.includes('setStaffDocumentWindowState('))
assert(!closeSource.includes('closeWindow('))
assert(!closeSource.includes('staffDocumentWindowStates.delete('))
assert(documentSource.includes('data-document-id='))
const viewerControlTags = [...documentSource.matchAll(
  /<button[^>]+data-staff-document-action="attachment(?:-version)?-view"[^>]*>/g,
)].map((match) => match[0])
assert(viewerControlTags.length >= 2)
assert(viewerControlTags.every((tag) => !tag.includes('data-attachment-id=')))

for (const source of [helperSource, documentSource, testSource]) {
  for (const marker of createMojibakeMarkers()) {
    assert(!source.includes(marker), `Mojibake marker found: ${marker}`)
  }
}

console.log('F23.11E viewer scroll restore smoke passed')

function createMojibakeMarkers() {
  return [
    [0x43, 0x0102, 0x00a1, 0x00c2, 0x00ba],
    [0x0102, 0x0192],
    [0x0102, 0x2020, 0x00c2, 0x00b0],
    [0x48, 0x0102, 0x00a1, 0x00c2, 0x00ba],
    [0x0102, 0x00a1, 0x00c2, 0x00bb],
    [0xfffd],
  ].map((codes) => String.fromCodePoint(...codes))
}
