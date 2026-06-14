import './styles.css'
import { modules } from './modules.js'
import { createInitialCloudStatus, renderCloudStatus } from './cloud-status.js'
import {
  getCurrentCenterMembership,
  getCurrentSupabaseUser,
  onSupabaseAuthStateChange,
  signInWithEmailPassword,
  signOutSupabase,
} from './supabase-auth.js'
import { getSupabaseConfigStatus } from './supabase-client.js'
import {
  buildAttachmentFileName,
  buildTransactionCode,
  buildTransactionImageStoragePath,
  createTransactionAttachmentMetadata,
  deleteTransactionAttachmentMetadata,
  getCurrentMonthKey,
  listTransactionAttachmentsByMonth,
  listTransactionAttachmentsByTransactionCode,
} from './transaction-attachments.js'
import {
  compressTransactionImage,
  validateTransactionImageFile,
} from './image-compression.js'
import {
  createTransactionImageSignedUrl,
  deleteTransactionImageObject,
  uploadTransactionImageBlob,
} from './supabase-storage.js'
import {
  getDeletedNotificationIds,
  getDesktopModuleOrder,
  getStoredCashflow,
  getStoredCashflowCategories,
  getStoredCashbookReconciliations,
  getStoredCashbookSettings,
  getStoredInventory,
  getStoredInventoryMovements,
  getStoredNotifications,
  getStoredParentConsultations,
  getStoredSchedule,
  getStoredSessionReports,
  getStoredAttendanceAdvisoryNotes,
  getStoredStudents,
  getStoredTeachers,
  getStoredTuition,
  getViewMode,
  saveDeletedNotificationIds,
  saveDesktopModuleOrder,
  saveStoredCashflow,
  saveStoredCashflowCategories,
  saveStoredCashbookReconciliations,
  saveStoredCashbookSettings,
  saveStoredInventory,
  saveStoredInventoryMovements,
  saveStoredNotifications,
  saveStoredParentConsultations,
  saveStoredSchedule,
  saveStoredSessionReports,
  saveStoredAttendanceAdvisoryNotes,
  saveStoredStudents,
  saveStoredTeachers,
  saveStoredTuition,
  saveViewMode,
} from './storage.js'
import { sampleCashflowCategories, sampleCashflowTransactions } from './cashflow-data.js'
import {
  buildCashbookReconciliationFromForm,
  buildCashbookSettingsFromForm,
  closeCashbookReconciliation,
  createCashbookReconciliationFormState,
  createCashbookSettingsFormState,
  createDefaultCashbookSettings,
  getCashbookBalanceStats,
  getDefaultCashbookDate,
  renderCashbookModule,
  validateCashbookReconciliationForm,
  validateCashbookSettingsForm,
} from './cashbook-module.js'
import {
  buildCashflowTransactionFromForm,
  buildCashflowCsvExport,
  buildCashflowCategoryFromForm,
  createEditCashflowCategoryFormState,
  createEditCashflowFormState,
  createEmptyCashflowCategoryFormState,
  createEmptyCashflowFormStateWithCategories,
  getDefaultCategoryNameForType,
  initialCashflowFilters,
  renderCashflowModule,
  validateCashflowCategoryForm,
  validateCashflowForm,
} from './cashflow-module.js'
import { sampleInventoryItems } from './inventory-data.js'
import { sampleParentConsultations } from './parent-consultation-data.js'
import {
  addCareLogToParentContact,
  addAppointmentToParentContact,
  buildEnrollmentSummary,
  buildParentContactFromForm,
  createEmptyParentAppointmentDraft,
  createEmptyParentCareLogDraft,
  createEditParentContactFormState,
  createEmptyParentContactFormState,
  initialParentConsultationFilters,
  renderParentConsultationModule,
  markEnrollmentReadyForParentContact,
  saveEnrollmentDraftToParentContact,
  updateParentAppointmentStatus,
  validateEnrollmentReadyDraft,
  validateParentAppointmentDraft,
  validateParentCareLogDraft,
  validateParentContactForm,
} from './parent-consultation-module.js'
import {
  applyInventoryMovementToItem,
  buildInventoryItemFromForm,
  buildInventoryMovementFromForm,
  createEditInventoryFormState,
  createEmptyInventoryFormState,
  createInventoryMovementFormState,
  initialInventoryFilters,
  initialInventoryMovementFilters,
  renderInventoryModule,
  renderInventoryMovementsWindow,
  validateInventoryForm,
  validateInventoryMovementForm,
} from './inventory-module.js'
import { createSampleNotifications } from './notifications.js'
import { sampleScheduleSessions } from './schedule-data.js'
import {
  buildSessionReportFromAttendance,
  buildSessionReportFromLearningGroups,
  buildLearningGroupFromForm,
  buildGuestParticipantFromForm,
  buildScheduleSessionFromForm,
  buildSessionReportFromExtraInfo,
  createEditScheduleFormState,
  createEditLearningGroupFormState,
  createEmptyScheduleFormState,
  createScheduleFormStateForDay,
  createEmptyLearningGroupFormState,
  createEmptyGuestParticipantFormState,
  createSessionReportExtraState,
  createSessionReportLearningState,
  createSessionReportDraft,
  findSessionReport,
  getCurrentScheduleWeekStartDate,
  getNextScheduleWeekStartDate,
  getPreviousScheduleWeekStartDate,
  getVisibleScheduleSessions,
  isPastScheduleOccurrence,
  renderScheduleModule,
  updateSessionReportDraftAttendance,
  updateSessionReportExtraState,
  validateLearningGroupForm,
  validateGuestParticipantForm,
  validateSessionReportAttendance,
  validateScheduleForm,
} from './schedule-module.js'
import { sampleStudents } from './student-data.js'
import { sampleTeachers } from './teacher-data.js'
import {
  buildTeacherFromForm,
  createEditTeacherFormState,
  createEmptyTeacherFormState,
  initialTeacherFilters,
  renderTeacherModule,
  validateTeacherForm,
} from './teacher-module.js'
import { createSampleTuitionRecords } from './tuition-data.js'
import {
  emptyCareNoteDraft,
  getStudentCareNotesWindowTitle,
  getStudentDetailWindowTitle,
  getStudentLearningWindowTitle,
  renderStudentCareNotes,
  renderStudentDetail,
  renderStudentLearningResult,
} from './student-detail.js'
import {
  buildStudentFromForm,
  createEditStudentFormState,
  createEmptyStudentFormState,
  formatStudentPhoneNumber,
  initialStudentFilters,
  isStudentFormReady,
  renderStudentModule,
  validateStudentForm,
} from './student-module.js'
import {
  buildTuitionRows,
  createEditTuitionFormState,
  createEmptyTuitionFormState,
  createPaymentFormState,
  createRenewTuitionFormState,
  createTuitionWarningNotification,
  getTuitionDebtAmount,
  initialTuitionFilters,
  normalizePaymentFormValues,
  normalizeTuitionFormValues,
  renderTuitionModule,
  validatePaymentForm,
  validateRenewTuitionForm,
  validateTuitionForm,
} from './tuition-module.js'

const app = document.querySelector('#app')

let currentViewMode = getViewMode()
let isStartMenuOpen = false
let isWindowOverflowOpen = false
let isNotificationCenterOpen = false
let notificationPanelPosition = { right: 12, bottom: 56 }
let openWindows = []
let nextWindowNumber = 1
let topZIndex = 20
let desktopModuleOrder = getDesktopModuleOrder(modules.map((moduleItem) => moduleItem.id))
let shortcutDragState = null
let suppressNextModuleClick = false
let shortcutDocumentDragBound = false
let notificationOutsidePointerBound = false
let studentFilters = { ...initialStudentFilters }
let students = getStoredStudents(sampleStudents)
let teacherFilters = { ...initialTeacherFilters }
let teachers = getStoredTeachers(sampleTeachers)
let teacherFormState = null
let selectedTeacherId = null
let parentConsultationFilters = { ...initialParentConsultationFilters }
let parentConsultations = getStoredParentConsultations(sampleParentConsultations)
let parentConsultationFormState = null
let scheduleSessions = getStoredSchedule(sampleScheduleSessions)
let sessionReports = getStoredSessionReports()
let attendanceAdvisoryNotes = getStoredAttendanceAdvisoryNotes()
let scheduleFormState = null
let scheduleReportState = null
let sessionReportAttendanceState = null
let sessionReportLearningState = null
let sessionReportLearningFormState = null
let sessionReportExtraState = null
let isSessionReportExtraExpanded = false
let sessionReportGuestFormState = null
let scheduleWeekStartDate = getCurrentScheduleWeekStartDate()
let tuitionRecords = getStoredTuition(createSampleTuitionRecords(students))
let notifications = getStoredNotifications(createSampleNotifications())
let deletedNotificationIds = getDeletedNotificationIds()
notifications = syncTuitionNotifications(notifications)
let studentFormState = null
let tuitionFilters = { ...initialTuitionFilters }
let tuitionFormState = null
let tuitionPaymentFormState = null
let tuitionDetailState = null
let cashflowTransactions = getStoredCashflow(sampleCashflowTransactions)
let cashflowCategories = getStoredCashflowCategories(sampleCashflowCategories)
let cashflowFilters = { ...initialCashflowFilters }
let cashflowFormState = null
let isCashflowCategoryPanelOpen = false
let cashflowCategoryFormState = createEmptyCashflowCategoryFormState()
let cashbookSelectedDate = getDefaultCashbookDate(cashflowTransactions)
let cashbookSettings = getStoredCashbookSettings(createDefaultCashbookSettings(cashflowTransactions))
let cashbookSettingsFormState = null
let cashbookReconciliations = getStoredCashbookReconciliations()
let cashbookReconciliationFormState = null
let inventoryItems = getStoredInventory(sampleInventoryItems)
let inventoryMovements = getStoredInventoryMovements()
let inventoryFilters = { ...initialInventoryFilters }
let inventoryMovementFilters = { ...initialInventoryMovementFilters }
let inventoryFormState = null
let inventoryMovementFormState = null
let selectedInventoryMovementId = null
let isInventoryHistoryPanelOpen = false
let careNoteDrafts = {}
let cloudStatus = createInitialCloudStatus(getSupabaseConfigStatus().status)
let cloudUserSyncId = 0
let cloudUploadingTransactionId = null
let transactionImageManagerState = null

function render() {
  const scheduleReportScrollState = getScheduleReportScrollState()
  const scheduleFormScrollState = getScheduleFormScrollState()

  app.innerHTML = `
    <div class="app-shell">
      <main class="desktop-area">
        ${renderDashboard()}
        <div class="window-layer" aria-label="Các cửa sổ đang mở">
          ${renderOpenWindows()}
        </div>
      </main>
      ${renderTaskbar()}
      ${renderSystemOverlay()}
    </div>
  `

  bindEvents()
  restoreScheduleReportScrollState(scheduleReportScrollState)
  restoreScheduleFormScrollState(scheduleFormScrollState)
  updateClock()
}

function getScheduleReportScrollState() {
  return Array.from(document.querySelectorAll('[data-report-scroll-region]')).reduce(
    (scrollState, element) => ({
      ...scrollState,
      [element.dataset.reportScrollRegion]: element.scrollTop,
    }),
    {},
  )
}

function restoreScheduleReportScrollState(scrollState) {
  Object.entries(scrollState).forEach(([region, scrollTop]) => {
    const element = document.querySelector(`[data-report-scroll-region="${region}"]`)

    if (element) {
      element.scrollTop = scrollTop
    }
  })
}

function getScheduleFormScrollState() {
  return Array.from(document.querySelectorAll('[data-schedule-form-scroll-region]')).reduce(
    (scrollState, element) => ({
      ...scrollState,
      [element.dataset.scheduleFormScrollRegion]: element.scrollTop,
    }),
    {},
  )
}

function restoreScheduleFormScrollState(scrollState) {
  Object.entries(scrollState).forEach(([region, scrollTop]) => {
    const element = document.querySelector(`[data-schedule-form-scroll-region="${region}"]`)

    if (element) {
      element.scrollTop = scrollTop
    }
  })
}

function renderDashboard() {
  const moduleButtons = getOrderedModules()
    .map(
      (moduleItem) => `
        <button
          class="module-button"
          type="button"
          data-module-id="${moduleItem.id}"
          data-shortcut-id="${moduleItem.id}"
        >
          <span>${moduleItem.name}</span>
        </button>
      `,
    )
    .join('')

  return `
    <section class="dashboard" aria-labelledby="dashboard-title">
      <h1 class="sr-only" id="dashboard-title">Desktop DreamHome</h1>
      <div class="desktop-surface">
        <div class="module-list ${currentViewMode}" aria-label="Danh sách chức năng">
          ${moduleButtons}
        </div>
      </div>
    </section>
  `
}

function renderOpenWindows() {
  return [...openWindows]
    .sort((firstWindow, secondWindow) => firstWindow.zIndex - secondWindow.zIndex)
    .map((windowItem) => renderModuleWindow(windowItem))
    .join('')
}

function getOrderedModules() {
  const modulesById = new Map(modules.map((moduleItem) => [moduleItem.id, moduleItem]))
  return desktopModuleOrder.map((moduleId) => modulesById.get(moduleId)).filter(Boolean)
}

function renderModuleWindow(windowItem) {
  const title = getWindowTitle(windowItem)
  const headerTitle = getWindowHeaderTitle(windowItem)

  if (!title || !headerTitle || windowItem.minimized) {
    return ''
  }

  const style = `
    left: ${windowItem.x}px;
    top: ${windowItem.y}px;
    width: ${windowItem.width}px;
    height: ${windowItem.height}px;
    z-index: ${windowItem.zIndex};
  `

  return `
    <section
      class="desktop-window ${windowItem.maximized ? 'maximized' : ''}"
      style="${style}"
      data-window-id="${windowItem.id}"
      aria-labelledby="${windowItem.id}-title"
    >
      <div class="window-titlebar" data-drag-window-id="${windowItem.id}">
        <h2 id="${windowItem.id}-title">${headerTitle}</h2>
        <div class="window-controls">
          <button type="button" data-window-action="minimize" data-window-id="${windowItem.id}" aria-label="Thu nhỏ ${headerTitle}">-</button>
          <button type="button" data-window-action="maximize" data-window-id="${windowItem.id}" aria-label="Phóng to hoặc khôi phục ${headerTitle}">□</button>
          <button type="button" data-window-action="close" data-window-id="${windowItem.id}" aria-label="Đóng ${headerTitle}">X</button>
        </div>
      </div>
      <div class="window-body">
        ${renderWindowBody(windowItem)}
      </div>
    </section>
  `
}

function renderWindowBody(windowItem) {
  if (windowItem.type === 'student-detail') {
    return renderStudentDetailWithDeleteAction(getStudentById(windowItem.studentId))
  }

  if (windowItem.type === 'student-care-notes') {
    return renderStudentCareNotes(
      getStudentById(windowItem.studentId),
      careNoteDrafts[windowItem.studentId] ?? emptyCareNoteDraft,
    )
  }

  if (windowItem.type === 'student-learning') {
    return renderStudentLearningResult(getStudentById(windowItem.studentId))
  }

  if (windowItem.type === 'inventory-movements') {
    return renderInventoryMovementsWindow(
      inventoryItems,
      inventoryMovements,
      inventoryMovementFilters,
      selectedInventoryMovementId,
    )
  }

  const moduleItem = modules.find((item) => item.id === windowItem.moduleId)

  if (!moduleItem) {
    return ''
  }

  if (moduleItem.id === 'hoc-vien') {
    return renderStudentModule(students, studentFilters, studentFormState, teachers)
  }

  if (moduleItem.id === 'khach-hang-tu-van') {
    return renderParentConsultationModule(
      parentConsultations,
      parentConsultationFilters,
      students,
      parentConsultationFormState,
    )
  }

  if (moduleItem.id === 'giao-vien') {
    return renderTeacherModule(
      teachers,
      teacherFilters,
      teacherFormState,
      selectedTeacherId,
      students,
      scheduleSessions,
    )
  }

  if (moduleItem.id === 'thoi-khoa-bieu') {
    return renderScheduleModule(
      scheduleSessions,
      scheduleFormState,
      scheduleReportState,
      sessionReports,
      sessionReportAttendanceState,
      sessionReportLearningState,
      sessionReportLearningFormState,
      sessionReportExtraState,
      isSessionReportExtraExpanded,
      sessionReportGuestFormState,
      teachers,
      students,
      scheduleWeekStartDate,
    )
  }

  if (moduleItem.id === 'hoc-phi') {
    return renderTuitionModule(
      students,
      tuitionRecords,
      tuitionFilters,
      tuitionFormState,
      tuitionPaymentFormState,
      tuitionDetailState,
      sessionReports,
      attendanceAdvisoryNotes,
    )
  }

  if (moduleItem.id === 'thu-chi') {
    const transactionCodes = getCashflowTransactionCodes()

    return renderCashflowModule(
      cashflowTransactions,
      cashflowFilters,
      cashflowFormState,
      cashflowCategories,
      isCashflowCategoryPanelOpen,
      cashflowCategoryFormState,
      renderCloudStatus(cloudStatus),
      {
        canUpload:
          cloudStatus.configStatus === 'configured' &&
          cloudStatus.authStatus === 'signed-in' &&
          cloudStatus.membershipStatus === 'loaded' &&
          Boolean(cloudStatus.role),
        transactionCodes,
        attachmentCounts: getCloudAttachmentCounts(),
        uploadingTransactionId: cloudUploadingTransactionId,
      },
      transactionImageManagerState,
    )
  }

  if (moduleItem.id === 'so-quy') {
    return renderCashbookModule(
      cashflowTransactions,
      cashbookSelectedDate,
      cashbookSettings,
      cashbookSettingsFormState,
      cashbookReconciliations,
      cashbookReconciliationFormState,
    )
  }

  if (moduleItem.id === 'kho-hang') {
    return renderInventoryModule(
      inventoryItems,
      inventoryFilters,
      inventoryFormState,
      inventoryMovementFormState,
      inventoryMovements,
      inventoryMovementFilters,
      selectedInventoryMovementId,
      isInventoryHistoryPanelOpen,
    )
  }

  return `
    <div class="room-heading">
      <p class="room-description">${moduleItem.shortDescription}</p>
      <span class="status-badge">${getStatusLabel(moduleItem.status)}</span>
    </div>
    <p class="phase-note">
      Module này đang ở giai đoạn khung. Nội dung nghiệp vụ sẽ được bổ sung ở phase sau.
    </p>
    <div class="room-grid">
      ${renderPlannedList('Chức năng dự kiến', moduleItem.plannedFeatures)}
      ${renderPlannedList('Dữ liệu dự kiến', moduleItem.plannedData)}
    </div>
  `
}

function renderStudentDetailWithDeleteAction(student) {
  const detailHtml = renderStudentDetail(student, teachers)

  if (!student || student.isDeleted) {
    return detailHtml
  }

  const deleteAction = `
    <button
      class="student-detail-delete-button"
      type="button"
      data-student-detail-action="soft-delete"
      data-student-id="${student.id}"
    >
      Xóa hồ sơ
    </button>
  `

  return detailHtml.replace('</button>\n      </div>\n\n      <div class="student-overview-grid">', `</button>${deleteAction}
      </div>

      <div class="student-overview-grid">`)
}

function getWindowTitle(windowItem) {
  if (windowItem.type === 'student-detail') {
    return getStudentDetailWindowTitle(getStudentById(windowItem.studentId))
  }

  if (windowItem.type === 'student-care-notes') {
    return getStudentCareNotesWindowTitle(getStudentById(windowItem.studentId))
  }

  if (windowItem.type === 'student-learning') {
    return getStudentLearningWindowTitle(getStudentById(windowItem.studentId))
  }

  if (windowItem.type === 'inventory-movements') {
    return 'Lịch sử nhập/xuất kho'
  }

  const moduleItem = modules.find((item) => item.id === windowItem.moduleId)
  return moduleItem?.name
}

function getWindowHeaderTitle(windowItem) {
  if (windowItem.moduleId === 'hoc-vien' && !windowItem.type) {
    return 'DANH SÁCH HỌC VIÊN'
  }

  return getWindowTitle(windowItem)
}

function getStudentById(studentId) {
  return students.find((student) => student.id === studentId)
}

function getLatestCareNoteContent(careNotes) {
  return [...(careNotes ?? [])].sort(
    (firstNote, secondNote) => new Date(secondNote.createdAt) - new Date(firstNote.createdAt),
  )[0]?.content ?? ''
}

function renderPlannedList(title, items) {
  const listItems = items.map((item) => `<li>${item}</li>`).join('')

  return `
    <section class="planned-panel" aria-label="${title}">
      <h3>${title}</h3>
      <ul>${listItems}</ul>
    </section>
  `
}

function renderTaskbar() {
  const visibleWindows = openWindows.slice(0, 4)
  const overflowWindows = openWindows.slice(4)
  const activeWindowId = getActiveWindowId()
  const unreadCount = getUnreadNotificationCount()
  const windowButtons = visibleWindows
    .map((windowItem) => {
      const title = getWindowTitle(windowItem)

      if (!title) {
        return ''
      }

      return `
        <button
          class="taskbar-window ${windowItem.minimized ? 'minimized' : ''} ${windowItem.id === activeWindowId ? 'active' : ''}"
          type="button"
          data-taskbar-window-id="${windowItem.id}"
        >
          ${title}
        </button>
      `
    })
    .join('')

  return `
    <footer class="taskbar">
      <div class="taskbar-left">
        <button
          class="start-button ${isStartMenuOpen ? 'active' : ''}"
          type="button"
          data-action="toggle-start"
          aria-expanded="${isStartMenuOpen}"
          aria-controls="start-menu"
        >
          Start
        </button>
        <span class="taskbar-item app-name">iChess Center OS</span>
        <span class="taskbar-item">Cơ sở: DreamHome</span>
        <span class="taskbar-item">Vai trò: Quản lý cơ sở</span>
      </div>
      <div class="taskbar-windows" aria-label="Cửa sổ đang mở">
        ${windowButtons}
        ${
          overflowWindows.length
            ? `
              <button
                class="taskbar-overflow ${isWindowOverflowOpen ? 'active' : ''}"
                type="button"
                data-action="toggle-window-overflow"
                aria-expanded="${isWindowOverflowOpen}"
                aria-controls="window-overflow-menu"
              >
                ^
              </button>
            `
            : ''
        }
      </div>
      <div class="taskbar-right">
        <div class="view-toggle taskbar-view-toggle" aria-label="Chọn chế độ hiển thị">
          <button
            class="${currentViewMode === 'grid' ? 'active' : ''}"
            type="button"
            data-view-mode="grid"
          >
            Dạng ô vuông
          </button>
          <button
            class="${currentViewMode === 'list' ? 'active' : ''}"
            type="button"
            data-view-mode="list"
          >
            Dạng danh sách
          </button>
        </div>
        <time class="taskbar-clock" id="taskbar-clock" aria-label="Ngày giờ hiện tại"></time>
        <button
          class="notification-bell ${isNotificationCenterOpen ? 'active' : ''}"
          type="button"
          data-action="toggle-notifications"
          aria-expanded="${isNotificationCenterOpen}"
          aria-controls="notification-center"
          aria-label="Thông báo, ${unreadCount} chưa đọc"
        >
          <span class="notification-bell-icon" aria-hidden="true">🔔</span>
          ${
            unreadCount
              ? `<span class="notification-badge">${unreadCount}</span>`
              : '<span class="notification-badge empty">0</span>'
          }
        </button>
      </div>
      ${isStartMenuOpen ? renderStartMenu() : ''}
      ${isWindowOverflowOpen ? renderWindowOverflowMenu(overflowWindows, activeWindowId) : ''}
    </footer>
  `
}

function renderSystemOverlay() {
  if (!isNotificationCenterOpen) {
    return '<div class="system-overlay-root" id="system-overlay-root"></div>'
  }

  return `
    <div class="system-overlay-root active" id="system-overlay-root">
      ${renderNotificationCenter(getUnreadNotificationCount())}
    </div>
  `
}

function renderNotificationCenter(unreadCount) {
  const readCount = notifications.length - unreadCount
  const notificationItems = notifications
    .map(
      (notification) => `
        <article
          class="notification-item ${notification.read ? 'read' : 'unread'} level-${notification.level}"
          data-notification-id="${notification.id}"
          tabindex="0"
          aria-label="${escapeHtml(notification.title)}"
        >
          <div class="notification-item-header">
            <strong>${escapeHtml(notification.title)}</strong>
            <span class="notification-state">${notification.read ? 'Đã đọc' : 'Chưa đọc'}</span>
          </div>
          <p>${escapeHtml(notification.message)}</p>
          <div class="notification-meta">
            <span>${escapeHtml(getNotificationSourceLabel(notification.sourceModule))}</span>
            <time datetime="${notification.createdAt}">${formatNotificationTime(notification.createdAt)}</time>
          </div>
          ${
            notification.read
              ? ''
              : `
                <button
                  class="notification-read-button"
                  type="button"
                  data-notification-action="mark-read"
                  data-notification-id="${notification.id}"
                >
                  Đánh dấu đã đọc
                </button>
              `
          }
        </article>
      `,
    )
    .join('')

  return `
    <section
      class="notification-center"
      id="notification-center"
      style="--notification-panel-right: ${notificationPanelPosition.right}px; --notification-panel-bottom: ${notificationPanelPosition.bottom}px;"
      aria-label="Thông báo"
    >
      <div class="notification-center-header">
        <div>
          <h2>Thông báo</h2>
          <p>${unreadCount} chưa đọc</p>
        </div>
        <div class="notification-center-actions">
          <button
            type="button"
            data-notification-action="mark-all-read"
            ${unreadCount ? '' : 'disabled'}
          >
            Đánh dấu tất cả đã đọc
          </button>
          <button
            type="button"
            data-notification-action="clear-read"
            ${readCount ? '' : 'disabled'}
          >
            Xóa đã đọc
          </button>
        </div>
      </div>
      <div class="notification-list">
        ${notificationItems || '<p class="notification-empty">Chưa có thông báo.</p>'}
      </div>
    </section>
  `
}

function renderWindowOverflowMenu(overflowWindows, activeWindowId) {
  const windowItems = overflowWindows
    .map((windowItem) => {
      const title = getWindowTitle(windowItem)

      if (!title) {
        return ''
      }

      return `
        <button
          class="${windowItem.minimized ? 'minimized' : ''} ${windowItem.id === activeWindowId ? 'active' : ''}"
          type="button"
          data-taskbar-window-id="${windowItem.id}"
        >
          ${title}
        </button>
      `
    })
    .join('')

  return `
    <nav class="window-overflow-menu" id="window-overflow-menu" aria-label="Cửa sổ khác">
      <p>Cửa sổ</p>
      ${windowItems}
    </nav>
  `
}

function getActiveWindowId() {
  return openWindows
    .filter((windowItem) => !windowItem.minimized)
    .reduce(
      (activeWindow, windowItem) =>
        !activeWindow || windowItem.zIndex > activeWindow.zIndex ? windowItem : activeWindow,
      null,
    )?.id
}

function renderStartMenu() {
  const moduleItems = modules
    .map(
      (moduleItem) => `
        <button class="start-menu-module" type="button" data-module-id="${moduleItem.id}">
          ${moduleItem.name}
        </button>
      `,
    )
    .join('')

  return `
    <nav class="start-menu" id="start-menu" aria-label="Start menu">
      <div class="start-menu-section">
        <button type="button" data-action="show-desktop">Về desktop</button>
        <button type="button" data-view-mode="grid">Dạng ô vuông</button>
        <button type="button" data-view-mode="list">Dạng danh sách</button>
      </div>
      <div class="start-menu-section">
        <p>Danh sách module</p>
        <div class="start-menu-modules">
          ${moduleItems}
        </div>
      </div>
    </nav>
  `
}

function openModuleWindow(moduleId) {
  const existingWindow = openWindows.find((windowItem) => windowItem.moduleId === moduleId)

  if (existingWindow) {
    focusWindow(existingWindow.id)
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    isNotificationCenterOpen = false
    render()
    return
  }

  const offset = (openWindows.length % 7) * 28

  openWindows.push({
    id: `window-${nextWindowNumber}`,
    moduleId,
    x: 72 + offset,
    y: 42 + offset,
    width: 760,
    height: 520,
    zIndex: ++topZIndex,
    minimized: false,
    maximized: true,
    restoreBounds: {
      x: 72 + offset,
      y: 42 + offset,
      width: 760,
      height: 520,
    },
  })
  nextWindowNumber += 1
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false
  render()
}

function openInventorySubwindow(view) {
  if (view !== 'movements') {
    return
  }

  openWindows = openWindows.filter((windowItem) => windowItem.type !== 'inventory-movements')
  isInventoryHistoryPanelOpen = true
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false
  render()
}

function openStudentDetailWindow(studentId) {
  const existingWindow = openWindows.find(
    (windowItem) => windowItem.type === 'student-detail' && windowItem.studentId === studentId,
  )

  if (existingWindow) {
    focusWindow(existingWindow.id)
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    isNotificationCenterOpen = false
    render()
    return
  }

  const offset = (openWindows.length % 7) * 28

  openWindows.push({
    id: `window-${nextWindowNumber}`,
    type: 'student-detail',
    studentId,
    x: 120 + offset,
    y: 70 + offset,
    width: 820,
    height: 560,
    zIndex: ++topZIndex,
    minimized: false,
    maximized: true,
    restoreBounds: {
      x: 120 + offset,
      y: 70 + offset,
      width: 820,
      height: 560,
    },
  })
  nextWindowNumber += 1
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false
  render()
}

function openStudentSubWindow(studentId, type) {
  const existingWindow = openWindows.find(
    (windowItem) => windowItem.type === type && windowItem.studentId === studentId,
  )

  if (existingWindow) {
    focusWindow(existingWindow.id)
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    isNotificationCenterOpen = false
    render()
    return
  }

  const offset = (openWindows.length % 7) * 28
  const nextWindowId = `window-${nextWindowNumber}`

  openWindows.push({
    id: nextWindowId,
    type,
    studentId,
    x: 132 + offset,
    y: 78 + offset,
    width: type === 'student-care-notes' ? 920 : 820,
    height: 560,
    zIndex: ++topZIndex,
    minimized: false,
    maximized: true,
    restoreBounds: {
      x: 132 + offset,
      y: 78 + offset,
      width: type === 'student-care-notes' ? 920 : 820,
      height: 560,
    },
  })
  nextWindowNumber += 1
  focusWindow(nextWindowId)
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false
  render()
}

function openStudentEditForm(studentId) {
  const student = getStudentById(studentId)

  if (!student) {
    return
  }

  if (!openWindows.some((windowItem) => windowItem.moduleId === 'hoc-vien')) {
    const offset = (openWindows.length % 7) * 28
    openWindows.push({
      id: `window-${nextWindowNumber}`,
      moduleId: 'hoc-vien',
      x: 72 + offset,
      y: 42 + offset,
      width: 760,
      height: 520,
      zIndex: ++topZIndex,
      minimized: false,
      maximized: true,
      restoreBounds: {
        x: 72 + offset,
        y: 42 + offset,
        width: 760,
        height: 520,
      },
    })
    nextWindowNumber += 1
  }

  const studentWindow = openWindows.find((windowItem) => windowItem.moduleId === 'hoc-vien')
  studentFormState = createEditStudentFormState(student)
  studentFilters = {
    ...studentFilters,
    selectedStudentId: student.id,
  }

  if (studentWindow) {
    focusWindow(studentWindow.id)
  }

  render()
}

function openCashflowEditForm(transactionId) {
  const transaction = cashflowTransactions.find((item) => item.id === transactionId)

  if (!transaction) {
    return
  }

  cashflowFormState = createEditCashflowFormState(transaction)
  render()
}

function openInventoryEditForm(itemId) {
  const item = inventoryItems.find((inventoryItem) => inventoryItem.id === itemId)

  if (!item) {
    return
  }

  inventoryFormState = createEditInventoryFormState(item)
  inventoryMovementFormState = null
  selectedInventoryMovementId = null
  render()
}

function openInventoryMovementForm(itemId) {
  const item = inventoryItems.find((inventoryItem) => inventoryItem.id === itemId)

  if (!item) {
    return
  }

  inventoryFormState = null
  inventoryMovementFormState = createInventoryMovementFormState(item)
  selectedInventoryMovementId = null
  render()
}

function syncTuitionPaymentToCashflow(payment, tuitionRecord, student) {
  if (!payment?.id || !tuitionRecord || !student) {
    return
  }

  const hasSyncedTransaction = cashflowTransactions.some(
    (transaction) =>
      transaction.sourceModule === 'hoc-phi' && transaction.sourcePaymentId === payment.id,
  )

  if (hasSyncedTransaction) {
    return
  }

  ensureTuitionCashflowCategory()

  const transaction = {
    id: `cashflow-from-tuition-${payment.id}`,
    type: 'income',
    category: 'Học phí',
    amount: Number(payment.amount || 0),
    transactionDate: payment.paidAt,
    method: getCashflowMethodFromTuitionPayment(payment.method),
    personName: getTuitionPaymentPersonName(student),
    recordedBy: payment.collectorName || 'Admin DreamHome',
    note: payment.note
      ? `Thu học phí: ${payment.note}`
      : `Thu học phí ${student.fullName}`,
    sourceModule: 'hoc-phi',
    sourceType: 'tuition-payment',
    sourcePaymentId: payment.id,
    sourceTuitionId: tuitionRecord.id,
    sourceStudentId: student.id,
    sourceTermId: tuitionRecord.currentTermId || '',
    createdAt: payment.createdAt || new Date().toISOString(),
  }

  cashflowTransactions = [transaction, ...cashflowTransactions]
  saveStoredCashflow(cashflowTransactions)
}

function syncInventoryMovementToCashflow(movement, item) {
  if (movement?.type !== 'in' || Number(movement.costAmount || 0) <= 0) {
    return
  }

  const hasSyncedTransaction = cashflowTransactions.some(
    (transaction) =>
      transaction.sourceModule === 'kho-hang' &&
      transaction.sourceMovementId === movement.id,
  )

  if (hasSyncedTransaction) {
    return
  }

  ensureInventoryCashflowCategory()

  const unit = item?.unit ? ` ${item.unit}` : ''
  const reasonText = movement.reason ? ` - ${movement.reason}` : ''
  const noteText = movement.note ? ` - ${movement.note}` : ''
  const transaction = {
    id: `cashflow-from-inventory-${movement.id}`,
    type: 'expense',
    category: 'Mua vật tư / Kho hàng',
    amount: Number(movement.costAmount || 0),
    transactionDate: movement.movementDate,
    method: movement.costMethod || 'Tiền mặt',
    personName: movement.supplierName || movement.itemName || 'Kho hàng',
    recordedBy: movement.handledBy || 'Admin',
    note: `Nhập kho ${movement.quantity}${unit} ${movement.itemName}${reasonText}${noteText}`,
    sourceModule: 'kho-hang',
    sourceType: 'inventory-movement',
    sourceMovementId: movement.id,
    sourceItemId: movement.itemId,
    createdAt: movement.createdAt || new Date().toISOString(),
  }

  cashflowTransactions = [transaction, ...cashflowTransactions]
  saveStoredCashflow(cashflowTransactions)
}

function ensureTuitionCashflowCategory() {
  const tuitionCategory = cashflowCategories.find((category) => category.name === 'Học phí')

  if (tuitionCategory && !tuitionCategory.isArchived && tuitionCategory.type === 'income') {
    return
  }

  if (tuitionCategory) {
    cashflowCategories = cashflowCategories.map((category) =>
      category.id === tuitionCategory.id
        ? {
            ...category,
            type: category.type === 'expense' ? 'both' : category.type,
            isArchived: false,
            updatedAt: new Date().toISOString(),
          }
        : category,
    )
  } else {
    const now = new Date().toISOString()
    cashflowCategories = [
      {
        id: `cash-cat-hoc-phi-${Date.now()}`,
        name: 'Học phí',
        type: 'income',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      ...cashflowCategories,
    ]
  }

  saveStoredCashflowCategories(cashflowCategories)
}

function ensureInventoryCashflowCategory() {
  const categoryName = 'Mua vật tư / Kho hàng'
  const inventoryCategory = cashflowCategories.find((category) => category.name === categoryName)

  if (
    inventoryCategory &&
    !inventoryCategory.isArchived &&
    (inventoryCategory.type === 'expense' || inventoryCategory.type === 'both')
  ) {
    return
  }

  if (inventoryCategory) {
    cashflowCategories = cashflowCategories.map((category) =>
      category.id === inventoryCategory.id
        ? {
            ...category,
            type: category.type === 'income' ? 'both' : 'expense',
            isArchived: false,
            updatedAt: new Date().toISOString(),
          }
        : category,
    )
  } else {
    const now = new Date().toISOString()
    cashflowCategories = [
      {
        id: `cash-cat-inventory-${Date.now()}`,
        name: categoryName,
        type: 'expense',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      ...cashflowCategories,
    ]
  }

  saveStoredCashflowCategories(cashflowCategories)
}

function getCashflowMethodFromTuitionPayment(method) {
  const methodLabels = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    other: 'Khác',
  }

  return methodLabels[method] ?? 'Khác'
}

function getTuitionPaymentPersonName(student) {
  const parentName = String(student.parentName || '').trim()

  return parentName ? `${student.fullName} / ${parentName}` : student.fullName
}

function focusWindow(windowId) {
  const nextZIndex = ++topZIndex

  openWindows = openWindows.map((windowItem) =>
    windowItem.id === windowId
      ? { ...windowItem, minimized: false, zIndex: nextZIndex }
      : windowItem,
  )
}

function minimizeWindow(windowId) {
  openWindows = openWindows.map((windowItem) =>
    windowItem.id === windowId ? { ...windowItem, minimized: true } : windowItem,
  )
  render()
}

function toggleMaximizeWindow(windowId) {
  openWindows = openWindows.map((windowItem) => {
    if (windowItem.id !== windowId) {
      return windowItem
    }

    if (windowItem.maximized) {
      return {
        ...windowItem,
        ...windowItem.restoreBounds,
        maximized: false,
        restoreBounds: null,
        zIndex: ++topZIndex,
      }
    }

    return {
      ...windowItem,
      maximized: true,
      minimized: false,
      restoreBounds: {
        x: windowItem.x,
        y: windowItem.y,
        width: windowItem.width,
        height: windowItem.height,
      },
      zIndex: ++topZIndex,
    }
  })
  render()
}

function closeWindow(windowId) {
  openWindows = openWindows.filter((windowItem) => windowItem.id !== windowId)
  render()
}

function softDeleteStudent(studentId) {
  const student = getStudentById(studentId)

  if (!student || student.isDeleted) {
    return
  }

  const confirmed = window.confirm(
    'Bạn có chắc muốn xóa hồ sơ học viên này khỏi danh sách chính không?\nDữ liệu sẽ được tạm ẩn, chưa xóa vĩnh viễn.',
  )

  if (!confirmed) {
    return
  }

  const deletedAt = new Date().toISOString()

  students = students.map((item) =>
    item.id === studentId
      ? {
          ...item,
          isDeleted: true,
          deletedAt,
          updatedAt: deletedAt,
        }
      : item,
  )

  studentFilters = {
    ...studentFilters,
    selectedStudentId:
      studentFilters.selectedStudentId === studentId ? null : studentFilters.selectedStudentId,
  }

  if (studentFormState?.studentId === studentId) {
    studentFormState = null
  }

  // Phase 1X only hides the student profile. Tuition, payments, termHistory and notifications stay untouched.
  openWindows = openWindows.filter(
    (windowItem) =>
      !(
        windowItem.studentId === studentId &&
        ['student-detail', 'student-care-notes', 'student-learning'].includes(windowItem.type)
      ),
  )
  saveStoredStudents(students)
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false
  render()
}

function showDesktop() {
  openWindows = openWindows.map((windowItem) => ({ ...windowItem, minimized: true }))
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false
  render()
}

function getStatusLabel(status) {
  const statusLabels = {
    placeholder: 'Khung trống',
    planned: 'Đã lên kế hoạch',
    'in-progress': 'Đang triển khai',
  }

  return statusLabels[status] ?? status
}

function getActiveCashbookDate() {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(cashbookSelectedDate ?? ''))
    ? cashbookSelectedDate
    : getDefaultCashbookDate(cashflowTransactions)
}

function getActiveCashbookSystemClosingBalance() {
  return getCashbookBalanceStats(
    cashflowTransactions,
    getActiveCashbookDate(),
    cashbookSettings,
  ).closingBalance
}

async function syncCloudUser(user) {
  const syncId = ++cloudUserSyncId

  if (!user) {
    cloudStatus = {
      ...cloudStatus,
      authStatus: 'signed-out',
      user: null,
      role: null,
      membershipStatus: 'idle',
      message: '',
      attachments: [],
      attachmentsStatus: 'idle',
      attachmentsError: '',
      attachmentsMonthKey: '',
      uploadMessage: '',
      uploadMessageTone: '',
    }
    render()
    return
  }

  cloudStatus = {
    ...cloudStatus,
    authStatus: 'signed-in',
    user,
    role: null,
    membershipStatus: 'loading',
    message: '',
    attachments: [],
    attachmentsStatus: 'idle',
    attachmentsError: '',
    attachmentsMonthKey: getCurrentMonthKey(),
    uploadMessage: '',
    uploadMessageTone: '',
  }
  render()

  try {
    const membership = await getCurrentCenterMembership(user.id)

    if (syncId !== cloudUserSyncId) {
      return
    }

    cloudStatus = {
      ...cloudStatus,
      role: membership?.role ?? null,
      membershipStatus: membership ? 'loaded' : 'missing',
      message: membership
        ? ''
        : 'Tài khoản chưa được cấp quyền cho cơ sở DreamHome.',
      attachments: [],
      attachmentsStatus: membership ? 'loading' : 'idle',
      attachmentsError: '',
    }
  } catch (error) {
    if (syncId !== cloudUserSyncId) {
      return
    }

    cloudStatus = {
      ...cloudStatus,
      role: null,
      membershipStatus: 'error',
      message: getCloudErrorMessage(
        error,
        'Không thể đọc quyền center_members qua RLS.',
      ),
      attachments: [],
      attachmentsStatus: 'idle',
      attachmentsError: '',
    }
  }

  render()

  if (cloudStatus.membershipStatus === 'loaded') {
    await loadCurrentMonthCloudAttachments(syncId)
  }
}

async function loadCurrentMonthCloudAttachments(syncId = cloudUserSyncId) {
  const monthKey = getCurrentMonthKey()
  const result = await listTransactionAttachmentsByMonth({ monthKey })

  if (syncId !== cloudUserSyncId) {
    return
  }

  const attachments = result.ok ? await addSignedUrlsToAttachments(result.data) : []

  if (syncId !== cloudUserSyncId) {
    return
  }

  cloudStatus = {
    ...cloudStatus,
    attachments,
    attachmentsStatus: result.ok ? 'loaded' : 'error',
    attachmentsError: result.ok ? '' : result.error,
    attachmentsMonthKey: monthKey,
  }
  render()
}

async function addSignedUrlsToAttachments(attachments) {
  return Promise.all(
    attachments.map(async (attachment) => {
      const signedUrlResult = await createTransactionImageSignedUrl(attachment.storagePath)

      return {
        ...attachment,
        signedUrl: signedUrlResult.ok ? signedUrlResult.data.signedUrl : '',
        signedUrlError: signedUrlResult.ok ? '' : signedUrlResult.error,
      }
    }),
  )
}

function getCashflowTransactionCodes() {
  const transactionsByDate = cashflowTransactions.reduce((groups, transaction) => {
    const transactionDate = String(transaction.transactionDate ?? '')
    groups[transactionDate] = [...(groups[transactionDate] ?? []), transaction]
    return groups
  }, {})

  return Object.values(transactionsByDate).reduce((codes, transactions) => {
    const sortedTransactions = [...transactions].sort((first, second) =>
      String(first.id ?? '').localeCompare(String(second.id ?? '')),
    )

    sortedTransactions.forEach((transaction, index) => {
      codes[transaction.id] =
        String(transaction.transactionCode ?? '').trim() ||
        buildTransactionCode(transaction.transactionDate, index + 1)
    })

    return codes
  }, {})
}

function getCloudAttachmentCounts() {
  return cloudStatus.attachments.reduce((counts, attachment) => {
    counts[attachment.transactionCode] = (counts[attachment.transactionCode] ?? 0) + 1
    return counts
  }, {})
}

async function openTransactionImageManager(transactionId) {
  const transaction = cashflowTransactions.find((item) => item.id === transactionId)

  if (!transaction) {
    setCloudUploadMessage('Không tìm thấy giao dịch Thu chi.', 'error')
    return
  }

  const transactionCode = getCashflowTransactionCodes()[transaction.id]
  transactionImageManagerState = {
    transaction,
    transactionCode,
    attachments: [],
    status: 'loading',
    error: '',
    message: '',
    messageTone: '',
    isUploading: false,
    deletingAttachmentId: null,
    currentUser: cloudStatus.user,
  }
  render()
  await refreshTransactionImageManager()
}

async function refreshTransactionImageManager() {
  if (!transactionImageManagerState) {
    return
  }

  const transactionCode = transactionImageManagerState.transactionCode
  const result = await listTransactionAttachmentsByTransactionCode({
    transactionCode,
  })

  if (transactionImageManagerState?.transactionCode !== transactionCode) {
    return
  }

  const attachments = result.ok ? await addSignedUrlsToAttachments(result.data) : []

  if (transactionImageManagerState?.transactionCode !== transactionCode) {
    return
  }

  transactionImageManagerState = {
    ...transactionImageManagerState,
    attachments,
    status: result.ok ? 'loaded' : 'error',
    error: result.ok ? '' : result.error,
    deletingAttachmentId: null,
  }
  render()
}

function closeTransactionImageManager() {
  transactionImageManagerState = null
  render()
}

async function deleteManagedTransactionAttachment(attachmentId) {
  const attachment = transactionImageManagerState?.attachments.find(
    (item) => item.id === attachmentId,
  )
  const transactionCode = transactionImageManagerState?.transactionCode

  if (!attachment || !transactionCode) {
    return
  }

  const confirmed = window.confirm(
    'Xóa ảnh giao dịch này? Giao dịch Thu chi sẽ không bị xóa.',
  )

  if (!confirmed) {
    return
  }

  transactionImageManagerState = {
    ...transactionImageManagerState,
    deletingAttachmentId: attachment.id,
    message: '',
    messageTone: '',
  }
  render()

  const storageResult = await deleteTransactionImageObject(attachment.storagePath)
  const storageWasMissing =
    !storageResult.ok && isMissingStorageObjectError(storageResult.error)

  if (!storageResult.ok && !storageWasMissing) {
    if (transactionImageManagerState?.transactionCode === transactionCode) {
      transactionImageManagerState = {
        ...transactionImageManagerState,
        deletingAttachmentId: null,
        message: `Không thể xóa file Storage: ${storageResult.error}`,
        messageTone: 'error',
      }
      render()
    } else {
      setCloudUploadMessage(`Không thể xóa file Storage: ${storageResult.error}`, 'error')
    }
    return
  }

  const metadataResult = await deleteTransactionAttachmentMetadata(attachment.id)

  if (!metadataResult.ok) {
    const message = `File Storage đã được xử lý nhưng xóa metadata thất bại: ${metadataResult.error}`

    if (transactionImageManagerState?.transactionCode === transactionCode) {
      transactionImageManagerState = {
        ...transactionImageManagerState,
        deletingAttachmentId: null,
        message,
        messageTone: 'error',
      }
      render()
    } else {
      setCloudUploadMessage(message, 'error')
    }
    return
  }

  await loadCurrentMonthCloudAttachments()
  if (transactionImageManagerState?.transactionCode === transactionCode) {
    await refreshTransactionImageManager()
  }

  if (transactionImageManagerState) {
    transactionImageManagerState = {
      ...transactionImageManagerState,
      message: 'Đã xóa ảnh. Giao dịch Thu chi không thay đổi.',
      messageTone: 'success',
    }
    render()
  }
}

function isMissingStorageObjectError(error) {
  return /not found|does not exist|no such|404/i.test(String(error ?? ''))
}

async function uploadCloudAttachmentForTransaction(transactionId, file) {
  const transaction = cashflowTransactions.find((item) => item.id === transactionId)

  if (!transaction) {
    setCloudUploadMessage('Không tìm thấy giao dịch Thu chi.', 'error')
    return
  }

  if (
    cloudStatus.configStatus !== 'configured' ||
    cloudStatus.authStatus !== 'signed-in'
  ) {
    setCloudUploadMessage(
      'Vui lòng đăng nhập Supabase Cloud trước khi chèn ảnh giao dịch.',
      'error',
    )
    return
  }

  if (cloudStatus.membershipStatus !== 'loaded' || !cloudStatus.role) {
    setCloudUploadMessage('Tài khoản chưa được cấp quyền cho DreamHome.', 'error')
    return
  }

  const validation = validateTransactionImageFile(file)

  if (!validation.ok) {
    setCloudUploadMessage(validation.error, 'error')
    return
  }

  cloudUploadingTransactionId = transactionId
  if (transactionImageManagerState?.transaction.id === transactionId) {
    transactionImageManagerState = {
      ...transactionImageManagerState,
      isUploading: true,
      message: 'Đang nén và upload ảnh giao dịch...',
      messageTone: '',
    }
  }
  setCloudUploadMessage('Đang nén và upload ảnh giao dịch...', '')

  const compressionResult = await compressTransactionImage(file)

  if (!compressionResult.ok) {
    cloudUploadingTransactionId = null
    updateTransactionImageManagerUploadState(compressionResult.error, 'error')
    setCloudUploadMessage(compressionResult.error, 'error')
    return
  }

  const transactionCode = getCashflowTransactionCodes()[transaction.id]
  const existingResult = await listTransactionAttachmentsByTransactionCode({
    transactionCode,
  })

  if (!existingResult.ok) {
    cloudUploadingTransactionId = null
    updateTransactionImageManagerUploadState(existingResult.error, 'error')
    setCloudUploadMessage(existingResult.error, 'error')
    return
  }

  let attachmentIndex = existingResult.data.length + 1
  let fileName = ''
  let storagePath = ''
  let uploadResult = null

  for (let attempt = 0; attempt < 20; attempt += 1) {
    fileName = buildAttachmentFileName(transactionCode, attachmentIndex, 'jpg')
    storagePath = buildTransactionImageStoragePath({
      dateInput: transaction.transactionDate,
      fileName,
    })
    uploadResult = await uploadTransactionImageBlob({
      storagePath,
      blob: compressionResult.data.blob,
    })

    if (uploadResult.ok || !isDuplicateStorageError(uploadResult.error)) {
      break
    }

    attachmentIndex += 1
  }

  if (!uploadResult?.ok) {
    cloudUploadingTransactionId = null
    updateTransactionImageManagerUploadState(
      uploadResult?.error || 'Không thể upload ảnh.',
      'error',
    )
    setCloudUploadMessage(uploadResult?.error || 'Không thể upload ảnh.', 'error')
    return
  }

  const metadataResult = await createTransactionAttachmentMetadata({
    transactionCode,
    transactionDate: transaction.transactionDate,
    amount: transaction.amount,
    cashflowType: transaction.type,
    note: transaction.note,
    originalName: file.name,
    fileName,
    mimeType: compressionResult.data.mimeType,
    sizeBytes: compressionResult.data.sizeBytes,
    storagePath,
  })

  cloudUploadingTransactionId = null

  if (!metadataResult.ok) {
    updateTransactionImageManagerUploadState(
      `Ảnh đã upload nhưng lưu metadata thất bại: ${metadataResult.error}`,
      'error',
    )
    setCloudUploadMessage(
      `Ảnh đã upload nhưng lưu metadata thất bại: ${metadataResult.error}`,
      'error',
    )
    return
  }

  setCloudUploadMessage('Đã upload ảnh giao dịch lên Supabase Cloud.', 'success')
  await loadCurrentMonthCloudAttachments()
  await refreshTransactionImageManager()

  if (transactionImageManagerState?.transaction.id === transactionId) {
    transactionImageManagerState = {
      ...transactionImageManagerState,
      isUploading: false,
      message: 'Đã thêm ảnh giao dịch.',
      messageTone: 'success',
    }
    render()
  }
}

function updateTransactionImageManagerUploadState(message, tone) {
  if (!transactionImageManagerState) {
    return
  }

  transactionImageManagerState = {
    ...transactionImageManagerState,
    isUploading: false,
    message,
    messageTone: tone,
  }
}

function isDuplicateStorageError(error) {
  return /already exists|duplicate|resource exists|409/i.test(String(error ?? ''))
}

function setCloudUploadMessage(message, tone) {
  cloudStatus = {
    ...cloudStatus,
    uploadMessage: message,
    uploadMessageTone: tone,
  }
  render()
}

function getCloudErrorMessage(error, fallbackMessage) {
  const message = String(error?.message ?? '').trim()
  return message || fallbackMessage
}

async function initializeSupabaseAuth() {
  if (cloudStatus.configStatus !== 'configured') {
    return
  }

  onSupabaseAuthStateChange((_event, user) => {
    window.setTimeout(() => {
      syncCloudUser(user)
    }, 0)
  })

  try {
    const user = await getCurrentSupabaseUser()
    await syncCloudUser(user)
  } catch (error) {
    cloudStatus = {
      ...cloudStatus,
      authStatus: 'signed-out',
      user: null,
      role: null,
      membershipStatus: 'idle',
      message: getCloudErrorMessage(error, 'Không thể kiểm tra phiên đăng nhập Supabase.'),
      attachments: [],
      attachmentsStatus: 'idle',
      attachmentsError: '',
      attachmentsMonthKey: '',
    }
    render()
  }
}

function bindEvents() {
  bindNotificationOutsidePointer()

  document.querySelectorAll('[data-view-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      currentViewMode = button.dataset.viewMode
      saveViewMode(currentViewMode)
      isStartMenuOpen = false
      isWindowOverflowOpen = false
      isNotificationCenterOpen = false
      render()
    })
  })

  document.querySelectorAll('[data-module-id]').forEach((button) => {
    button.addEventListener('click', () => {
      if (suppressNextModuleClick) {
        suppressNextModuleClick = false
        return
      }

      openModuleWindow(button.dataset.moduleId)
    })
  })

  document.querySelector('[data-action="toggle-start"]')?.addEventListener('click', () => {
    isStartMenuOpen = !isStartMenuOpen
    isWindowOverflowOpen = false
    isNotificationCenterOpen = false
    render()
  })

  document.querySelector('[data-action="toggle-window-overflow"]')?.addEventListener('click', () => {
    isWindowOverflowOpen = !isWindowOverflowOpen
    isStartMenuOpen = false
    isNotificationCenterOpen = false
    render()
  })

  document.querySelector('[data-action="toggle-notifications"]')?.addEventListener('click', (event) => {
    notificationPanelPosition = getNotificationPanelPosition(event.currentTarget)
    isNotificationCenterOpen = !isNotificationCenterOpen
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    render()
  })

  document.querySelector('[data-action="show-desktop"]')?.addEventListener('click', () => {
    showDesktop()
  })

  document.querySelectorAll('[data-window-id]').forEach((windowElement) => {
    windowElement.addEventListener('pointerdown', (event) => {
      if (event.target.closest('[data-student-detail-action]')) {
        return
      }

      focusWindow(windowElement.dataset.windowId)
      const focusedWindow = openWindows.find((item) => item.id === windowElement.dataset.windowId)

      if (focusedWindow) {
        windowElement.style.zIndex = focusedWindow.zIndex
      }
    })
  })

  document.querySelectorAll('[data-window-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const { windowAction, windowId } = button.dataset

      if (windowAction === 'minimize') {
        minimizeWindow(windowId)
      }

      if (windowAction === 'maximize') {
        toggleMaximizeWindow(windowId)
      }

      if (windowAction === 'close') {
        closeWindow(windowId)
      }
    })
  })

  document.querySelectorAll('[data-taskbar-window-id]').forEach((button) => {
    button.addEventListener('click', () => {
      focusWindow(button.dataset.taskbarWindowId)
      isStartMenuOpen = false
      isWindowOverflowOpen = false
      isNotificationCenterOpen = false
      render()
    })
  })

  document.querySelectorAll('[data-notification-id]').forEach((notificationElement) => {
    notificationElement.addEventListener('click', (event) => {
      if (event.target.closest('[data-notification-action]')) {
        return
      }

      markNotificationRead(notificationElement.dataset.notificationId)
    })

    notificationElement.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      markNotificationRead(notificationElement.dataset.notificationId)
    })
  })

  document.querySelectorAll('[data-notification-action="mark-read"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      markNotificationRead(button.dataset.notificationId)
    })
  })

  document.querySelector('[data-notification-action="mark-all-read"]')?.addEventListener('click', () => {
    notifications = notifications.map((notification) => ({ ...notification, read: true }))
    saveStoredNotifications(notifications)
    render()
  })

  document.querySelector('[data-notification-action="clear-read"]')?.addEventListener('click', () => {
    const readNotificationIds = notifications
      .filter((notification) => notification.read)
      .map((notification) => notification.id)
    deletedNotificationIds = Array.from(new Set([...deletedNotificationIds, ...readNotificationIds]))
    saveDeletedNotificationIds(deletedNotificationIds)
    notifications = notifications.filter((notification) => !notification.read)
    saveStoredNotifications(notifications)
    render()
  })

  document.querySelectorAll('[data-tuition-filter]').forEach((control) => {
    control.addEventListener('input', () => {
      const filterName = control.dataset.tuitionFilter
      const selectionStart = 'selectionStart' in control ? control.selectionStart : null
      const selectionEnd = 'selectionEnd' in control ? control.selectionEnd : null

      tuitionFilters = {
        ...tuitionFilters,
        [filterName]: control.value,
      }
      render()

      const nextControl = document.querySelector(`[data-tuition-filter="${filterName}"]`)
      nextControl?.focus()

      if (selectionStart !== null && selectionEnd !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(selectionStart, selectionEnd)
      }
    })
  })

  document.querySelectorAll('[data-tuition-advisory-action="save"]').forEach((button) => {
    button.addEventListener('click', () => {
      const studentId = button.dataset.studentId
      const monthKey = button.dataset.monthKey
      const careStatus =
        document.querySelector(`[data-tuition-advisory-care-status="${studentId}"]`)?.value ||
        'auto'
      const note =
        document.querySelector(`[data-tuition-advisory-note="${studentId}"]`)?.value || ''
      const identity = `${studentId}:${monthKey}`
      const nextNote = {
        id: `advisory-note-${studentId}-${monthKey}`,
        studentId,
        monthKey,
        careStatus,
        note: note.trim(),
        updatedAt: new Date().toISOString(),
      }
      const hasExistingNote = attendanceAdvisoryNotes.some(
        (item) => `${item.studentId}:${item.monthKey}` === identity,
      )

      attendanceAdvisoryNotes = hasExistingNote
        ? attendanceAdvisoryNotes.map((item) =>
            `${item.studentId}:${item.monthKey}` === identity ? nextNote : item,
          )
        : [...attendanceAdvisoryNotes, nextNote]
      saveStoredAttendanceAdvisoryNotes(attendanceAdvisoryNotes)
      render()
    })
  })

  document.querySelectorAll('[data-cashflow-filter]').forEach((control) => {
    const updateCashflowFilter = () => {
      const filterName = control.dataset.cashflowFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      cashflowFilters = {
        ...cashflowFilters,
        [filterName]: control.value,
      }
      render()

      const nextControl = document.querySelector(`[data-cashflow-filter="${filterName}"]`)
      nextControl?.focus()

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    }

    control.addEventListener(control.tagName === 'SELECT' ? 'change' : 'input', updateCashflowFilter)
  })

  document.querySelector('[data-cloud-login-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    cloudStatus = {
      ...cloudStatus,
      authStatus: 'signing-in',
      message: '',
    }
    render()

    try {
      const user = await signInWithEmailPassword(email, password)
      await syncCloudUser(user)
    } catch (error) {
      cloudStatus = {
        ...cloudStatus,
        authStatus: 'signed-out',
        user: null,
        role: null,
        membershipStatus: 'idle',
        message: getCloudErrorMessage(error, 'Không thể đăng nhập. Vui lòng kiểm tra email và mật khẩu.'),
        attachments: [],
        attachmentsStatus: 'idle',
        attachmentsError: '',
        attachmentsMonthKey: '',
      }
      render()
    }
  })

  document.querySelector('[data-cloud-action="logout"]')?.addEventListener('click', async () => {
    cloudStatus = {
      ...cloudStatus,
      authStatus: 'loading',
      message: '',
    }
    render()

    try {
      await signOutSupabase()
      await syncCloudUser(null)
    } catch (error) {
      cloudStatus = {
        ...cloudStatus,
        authStatus: 'signed-in',
        message: getCloudErrorMessage(error, 'Không thể đăng xuất. Vui lòng thử lại.'),
      }
      render()
    }
  })

  document.querySelectorAll('[data-inventory-filter]').forEach((control) => {
    control.addEventListener('input', () => {
      const filterName = control.dataset.inventoryFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      inventoryFilters = {
        ...inventoryFilters,
        [filterName]: control.value,
      }
      render()

      const nextControl = document.querySelector(`[data-inventory-filter="${filterName}"]`)
      nextControl?.focus()

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelectorAll('[data-inventory-stock-alert]').forEach((button) => {
    button.addEventListener('click', () => {
      inventoryFilters = {
        ...inventoryFilters,
        stockAlert: button.dataset.inventoryStockAlert,
      }
      render()
    })
  })

  document.querySelectorAll('[data-inventory-movement-filter]').forEach((control) => {
    control.addEventListener('input', () => {
      const filterName = control.dataset.inventoryMovementFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      inventoryMovementFilters = {
        ...inventoryMovementFilters,
        [filterName]: control.value,
      }
      render()

      const nextControl = document.querySelector(
        `[data-inventory-movement-filter="${filterName}"]`,
      )
      nextControl?.focus()

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelectorAll('[data-inventory-open-subwindow]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.inventoryOpenSubwindow === 'movements') {
        openInventorySubwindow('movements')
      }
    })
  })

  document.querySelectorAll('[data-inventory-history-action="close"]').forEach((button) => {
    button.addEventListener('click', () => {
      isInventoryHistoryPanelOpen = false
      selectedInventoryMovementId = null
      render()
    })
  })

  document.querySelectorAll('[data-inventory-action="open-create"]').forEach((button) => {
    button.addEventListener('click', () => {
      inventoryFormState = createEmptyInventoryFormState()
      inventoryMovementFormState = null
      selectedInventoryMovementId = null
      render()
    })
  })

  document.querySelectorAll('[data-inventory-item-id]').forEach((row) => {
    row.addEventListener('click', () => {
      openInventoryEditForm(row.dataset.inventoryItemId)
    })

    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      openInventoryEditForm(row.dataset.inventoryItemId)
    })
  })

  document.querySelectorAll('[data-inventory-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      inventoryFormState = null
      render()
    })
  })

  document.querySelector('[data-inventory-action="open-movement"]')?.addEventListener('click', () => {
    if (!inventoryFormState?.itemId) {
      return
    }

    openInventoryMovementForm(inventoryFormState.itemId)
  })

  document.querySelectorAll('[data-inventory-movement-id]').forEach((row) => {
    row.addEventListener('click', () => {
      selectedInventoryMovementId = row.dataset.inventoryMovementId
      isInventoryHistoryPanelOpen = true
      inventoryFormState = null
      inventoryMovementFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-inventory-movement-detail-action="close"]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedInventoryMovementId = null
      render()
    })
  })

  document.querySelectorAll('[data-inventory-form-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!inventoryFormState) {
        return
      }

      inventoryFormState = {
        ...inventoryFormState,
        values: {
          ...inventoryFormState.values,
          [control.dataset.inventoryFormField]: control.value,
        },
        errors: {
          ...inventoryFormState.errors,
          [control.dataset.inventoryFormField]: undefined,
        },
      }
    })
  })

  document.querySelector('[data-inventory-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!inventoryFormState) {
      return
    }

    const errors = validateInventoryForm(inventoryFormState.values)

    if (Object.keys(errors).length) {
      inventoryFormState = {
        ...inventoryFormState,
        errors,
      }
      render()
      return
    }

    const existingItem = inventoryItems.find((item) => item.id === inventoryFormState.itemId)
    const nextItem = buildInventoryItemFromForm(inventoryFormState.values, existingItem)

    inventoryItems =
      inventoryFormState.mode === 'edit'
        ? inventoryItems.map((item) => (item.id === nextItem.id ? nextItem : item))
        : [nextItem, ...inventoryItems]
    saveStoredInventory(inventoryItems)
    inventoryFormState = null
    render()
  })

  document.querySelector('[data-inventory-action="delete-item"]')?.addEventListener('click', () => {
    if (!inventoryFormState?.itemId) {
      return
    }

    if (!window.confirm('Bạn muốn xóa vật tư này khỏi danh sách kho?')) {
      return
    }

    inventoryItems = inventoryItems.filter((item) => item.id !== inventoryFormState.itemId)
    saveStoredInventory(inventoryItems)
    inventoryFormState = null
    render()
  })

  document.querySelectorAll('[data-inventory-movement-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!inventoryMovementFormState) {
        return
      }

      inventoryMovementFormState = {
        ...inventoryMovementFormState,
        values: {
          ...inventoryMovementFormState.values,
          [control.dataset.inventoryMovementField]: control.value,
        },
        errors: {
          ...inventoryMovementFormState.errors,
          [control.dataset.inventoryMovementField]: undefined,
        },
      }

      if (control.dataset.inventoryMovementField === 'type') {
        render()
      }
    })
  })

  document.querySelectorAll('[data-inventory-movement-action="cancel"]').forEach((button) => {
    button.addEventListener('click', () => {
      inventoryMovementFormState = null
      render()
    })
  })

  document.querySelector('[data-inventory-movement-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!inventoryMovementFormState) {
      return
    }

    const errors = validateInventoryMovementForm(inventoryMovementFormState.values, inventoryItems)

    if (Object.keys(errors).length) {
      inventoryMovementFormState = {
        ...inventoryMovementFormState,
        errors,
      }
      render()
      return
    }

    const item = inventoryItems.find(
      (inventoryItem) => inventoryItem.id === inventoryMovementFormState.values.itemId,
    )

    if (!item) {
      inventoryMovementFormState = {
        ...inventoryMovementFormState,
        errors: {
          ...inventoryMovementFormState.errors,
          itemId: 'Vật tư không hợp lệ hoặc đã bị xóa.',
        },
      }
      render()
      return
    }

    const movement = buildInventoryMovementFromForm(inventoryMovementFormState.values, item)
    inventoryItems = inventoryItems.map((inventoryItem) =>
      inventoryItem.id === item.id ? applyInventoryMovementToItem(inventoryItem, movement) : inventoryItem,
    )
    inventoryMovements = [movement, ...inventoryMovements]
    saveStoredInventory(inventoryItems)
    saveStoredInventoryMovements(inventoryMovements)
    syncInventoryMovementToCashflow(movement, item)
    inventoryMovementFormState = null
    render()
  })

  document.querySelector('[data-cashbook-date]')?.addEventListener('input', (event) => {
    cashbookSelectedDate = event.currentTarget.value
    render()
  })

  document.querySelector('[data-cashbook-action="today"]')?.addEventListener('click', () => {
    cashbookSelectedDate = new Date().toISOString().slice(0, 10)
    render()
  })

  document.querySelector('[data-cashbook-action="open-settings"]')?.addEventListener('click', () => {
    cashbookSettingsFormState = createCashbookSettingsFormState(cashbookSettings)
    render()
  })

  document.querySelectorAll('[data-cashbook-action="cancel-settings"]').forEach((button) => {
    button.addEventListener('click', () => {
      cashbookSettingsFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-cashbook-settings-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!cashbookSettingsFormState) {
        return
      }

      cashbookSettingsFormState = {
        ...cashbookSettingsFormState,
        values: {
          ...cashbookSettingsFormState.values,
          [control.dataset.cashbookSettingsField]: control.value,
        },
        errors: {
          ...cashbookSettingsFormState.errors,
          [control.dataset.cashbookSettingsField]: undefined,
        },
      }
    })
  })

  document.querySelector('[data-cashbook-settings-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!cashbookSettingsFormState) {
      return
    }

    const errors = validateCashbookSettingsForm(cashbookSettingsFormState.values)

    if (Object.keys(errors).length) {
      cashbookSettingsFormState = {
        ...cashbookSettingsFormState,
        errors,
      }
      render()
      return
    }

    cashbookSettings = buildCashbookSettingsFromForm(
      cashbookSettingsFormState.values,
      cashbookSettings,
    )
    saveStoredCashbookSettings(cashbookSettings)
    cashbookSettingsFormState = null
    render()
  })

  document.querySelector('[data-cashbook-action="open-reconciliation"]')?.addEventListener(
    'click',
    () => {
      const activeDate = getActiveCashbookDate()
      const currentReconciliation = cashbookReconciliations.find(
        (reconciliation) => reconciliation.date === activeDate,
      )

      cashbookReconciliationFormState = createCashbookReconciliationFormState(
        currentReconciliation,
        activeDate,
        getActiveCashbookSystemClosingBalance(),
      )
      render()
    },
  )

  document.querySelector('[data-cashbook-action="close-day"]')?.addEventListener('click', () => {
    const activeDate = getActiveCashbookDate()
    const currentReconciliation = cashbookReconciliations.find(
      (reconciliation) => reconciliation.date === activeDate,
    )

    if (!currentReconciliation || currentReconciliation.isClosed) {
      return
    }

    const confirmed = window.confirm(
      'Bạn muốn đánh dấu ngày này là đã chốt sổ? Phase này chỉ khóa nhẹ/cảnh báo, chưa khóa cứng giao dịch.',
    )

    if (!confirmed) {
      return
    }

    const closedReconciliation = closeCashbookReconciliation(
      currentReconciliation,
      currentReconciliation.checkedBy || 'Admin',
    )
    cashbookReconciliations = [
      closedReconciliation,
      ...cashbookReconciliations.filter(
        (reconciliation) => reconciliation.date !== closedReconciliation.date,
      ),
    ]
    saveStoredCashbookReconciliations(cashbookReconciliations)
    render()
  })

  document.querySelectorAll('[data-cashbook-history-date]').forEach((button) => {
    button.addEventListener('click', () => {
      cashbookSelectedDate = button.dataset.cashbookHistoryDate
      cashbookSettingsFormState = null
      cashbookReconciliationFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-cashbook-action="cancel-reconciliation"]').forEach((button) => {
    button.addEventListener('click', () => {
      cashbookReconciliationFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-cashbook-reconciliation-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!cashbookReconciliationFormState) {
        return
      }

      cashbookReconciliationFormState = {
        ...cashbookReconciliationFormState,
        values: {
          ...cashbookReconciliationFormState.values,
          [control.dataset.cashbookReconciliationField]: control.value,
        },
        errors: {
          ...cashbookReconciliationFormState.errors,
          [control.dataset.cashbookReconciliationField]: undefined,
        },
      }
    })
  })

  document.querySelector('[data-cashbook-reconciliation-form]')?.addEventListener(
    'submit',
    (event) => {
      event.preventDefault()

      if (!cashbookReconciliationFormState) {
        return
      }

      const errors = validateCashbookReconciliationForm(cashbookReconciliationFormState.values)

      if (Object.keys(errors).length) {
        cashbookReconciliationFormState = {
          ...cashbookReconciliationFormState,
          errors,
        }
        render()
        return
      }

      const existingReconciliation = cashbookReconciliations.find(
        (reconciliation) =>
          reconciliation.date === cashbookReconciliationFormState.values.date,
      )
      const nextReconciliation = buildCashbookReconciliationFromForm(
        {
          ...cashbookReconciliationFormState.values,
          systemClosingBalance: getActiveCashbookSystemClosingBalance(),
        },
        existingReconciliation,
      )

      cashbookReconciliations = [
        nextReconciliation,
        ...cashbookReconciliations.filter(
          (reconciliation) => reconciliation.date !== nextReconciliation.date,
        ),
      ]
      saveStoredCashbookReconciliations(cashbookReconciliations)
      cashbookReconciliationFormState = null
      render()
    },
  )

  document.querySelector('[data-cashflow-action="open-create"]')?.addEventListener('click', () => {
    cashflowFormState = createEmptyCashflowFormStateWithCategories(cashflowCategories)
    render()
  })

  document.querySelector('[data-cashflow-action="open-categories"]')?.addEventListener('click', () => {
    isCashflowCategoryPanelOpen = true
    cashflowCategoryFormState = createEmptyCashflowCategoryFormState()
    render()
  })

  document.querySelector('[data-cashflow-action="download-csv"]')?.addEventListener('click', () => {
    const exportResult = buildCashflowCsvExport(cashflowTransactions, cashflowFilters)

    if (!exportResult.count) {
      return
    }

    const blob = new Blob([`\uFEFF${exportResult.csvContent}`], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = exportResult.filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  })

  document
    .querySelectorAll('.cashflow-row[data-cashflow-transaction-id]')
    .forEach((row) => {
      row.addEventListener('click', (event) => {
        if (
          event.target.closest(
            '[data-cashflow-cloud-action], [data-cashflow-cloud-image-input]',
          )
        ) {
          return
        }

        openCashflowEditForm(row.dataset.cashflowTransactionId)
      })

      row.addEventListener('keydown', (event) => {
        if (
          event.target.closest(
            '[data-cashflow-cloud-action], [data-cashflow-cloud-image-input]',
          )
        ) {
          return
        }

        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }

        event.preventDefault()
        openCashflowEditForm(row.dataset.cashflowTransactionId)
      })
    })

  document.querySelectorAll('[data-cashflow-cloud-action="select-image"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()

      if (Number(button.dataset.cloudAttachmentCount || 0) > 0) {
        openTransactionImageManager(button.dataset.cashflowTransactionId)
        return
      }

      document
        .querySelector(
          `[data-cashflow-cloud-image-input="${button.dataset.cashflowTransactionId}"]`,
        )
        ?.click()
    })
  })

  document
    .querySelectorAll('[data-transaction-image-manager-action="close"]')
    .forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        closeTransactionImageManager()
      })
    })

  document
    .querySelector('[data-transaction-image-manager-action="add"]')
    ?.addEventListener('click', (event) => {
      event.stopPropagation()
      document.querySelector('[data-transaction-image-manager-input]')?.click()
    })

  document
    .querySelector('[data-transaction-image-manager-input]')
    ?.addEventListener('change', async (event) => {
      event.stopPropagation()
      const file = event.target.files?.[0]
      const transactionId = transactionImageManagerState?.transaction.id

      if (!file || !transactionId) {
        return
      }

      await uploadCloudAttachmentForTransaction(transactionId, file)
    })

  document
    .querySelectorAll('[data-transaction-image-manager-action="delete"]')
    .forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation()
        await deleteManagedTransactionAttachment(button.dataset.attachmentId)
      })
    })

  document.querySelectorAll('[data-cashflow-cloud-image-input]').forEach((input) => {
    input.addEventListener('click', (event) => {
      event.stopPropagation()
    })

    input.addEventListener('change', async (event) => {
      event.stopPropagation()
      const file = event.target.files?.[0]

      if (!file) {
        return
      }

      await uploadCloudAttachmentForTransaction(
        input.dataset.cashflowCloudImageInput,
        file,
      )
    })
  })

  document.querySelectorAll('[data-cashflow-form-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!cashflowFormState) {
        return
      }

      cashflowFormState = {
        ...cashflowFormState,
        values: {
          ...cashflowFormState.values,
          [control.dataset.cashflowFormField]: control.value,
        },
        errors: {
          ...cashflowFormState.errors,
          [control.dataset.cashflowFormField]: undefined,
        },
      }

      if (control.dataset.cashflowFormField === 'type' && cashflowFormState.mode === 'create') {
        cashflowFormState = {
          ...cashflowFormState,
          values: {
            ...cashflowFormState.values,
            category: getDefaultCategoryNameForType(cashflowCategories, control.value),
          },
        }
      }
    })
  })

  document.querySelectorAll('[data-cashflow-category-field]').forEach((control) => {
    control.addEventListener('input', () => {
      cashflowCategoryFormState = {
        ...cashflowCategoryFormState,
        values: {
          ...cashflowCategoryFormState.values,
          [control.dataset.cashflowCategoryField]: control.value,
        },
        errors: {
          ...cashflowCategoryFormState.errors,
          [control.dataset.cashflowCategoryField]: undefined,
        },
      }
    })
  })

  document.querySelector('[data-cashflow-category-action="close"]')?.addEventListener('click', () => {
    isCashflowCategoryPanelOpen = false
    cashflowCategoryFormState = createEmptyCashflowCategoryFormState()
    render()
  })

  document.querySelector('[data-cashflow-category-action="reset-form"]')?.addEventListener(
    'click',
    () => {
      cashflowCategoryFormState = createEmptyCashflowCategoryFormState()
      render()
    },
  )

  document.querySelectorAll('[data-cashflow-category-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const category = cashflowCategories.find(
        (item) => item.id === button.dataset.cashflowCategoryId,
      )

      if (!category) {
        return
      }

      cashflowCategoryFormState = createEditCashflowCategoryFormState(category)
      render()
    })
  })

  document.querySelectorAll('[data-cashflow-category-action="archive"]').forEach((button) => {
    button.addEventListener('click', () => {
      const category = cashflowCategories.find(
        (item) => item.id === button.dataset.cashflowCategoryId,
      )

      if (!category || category.isArchived) {
        return
      }

      cashflowCategories = cashflowCategories.map((item) =>
        item.id === category.id
          ? {
              ...item,
              isArchived: true,
              updatedAt: new Date().toISOString(),
            }
          : item,
      )
      saveStoredCashflowCategories(cashflowCategories)

      if (cashflowFormState?.values.category === category.name && cashflowFormState.mode === 'create') {
        cashflowFormState = {
          ...cashflowFormState,
          values: {
            ...cashflowFormState.values,
            category: getDefaultCategoryNameForType(
              cashflowCategories,
              cashflowFormState.values.type,
            ),
          },
        }
      }

      render()
    })
  })

  document.querySelector('[data-cashflow-category-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    const errors = validateCashflowCategoryForm(
      cashflowCategoryFormState.values,
      cashflowCategories,
      cashflowCategoryFormState.categoryId,
    )

    if (Object.keys(errors).length) {
      cashflowCategoryFormState = {
        ...cashflowCategoryFormState,
        errors,
      }
      render()
      return
    }

    const existingCategory = cashflowCategories.find(
      (category) => category.id === cashflowCategoryFormState.categoryId,
    )
    const oldCategoryName = existingCategory?.name
    const nextCategory = buildCashflowCategoryFromForm(
      cashflowCategoryFormState.values,
      existingCategory,
    )

    cashflowCategories =
      cashflowCategoryFormState.mode === 'edit'
        ? cashflowCategories.map((category) =>
            category.id === nextCategory.id ? nextCategory : category,
          )
        : [nextCategory, ...cashflowCategories]

    if (oldCategoryName && oldCategoryName !== nextCategory.name) {
      cashflowTransactions = cashflowTransactions.map((transaction) =>
        transaction.category === oldCategoryName
          ? {
              ...transaction,
              category: nextCategory.name,
              updatedAt: new Date().toISOString(),
            }
          : transaction,
      )
      saveStoredCashflow(cashflowTransactions)

      if (cashflowFilters.category === oldCategoryName) {
        cashflowFilters = {
          ...cashflowFilters,
          category: nextCategory.name,
        }
      }
    }

    saveStoredCashflowCategories(cashflowCategories)
    cashflowCategoryFormState = createEmptyCashflowCategoryFormState()
    render()
  })

  document.querySelectorAll('[data-cashflow-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      cashflowFormState = null
      render()
    })
  })

  document.querySelector('[data-cashflow-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!cashflowFormState) {
      return
    }

    const errors = validateCashflowForm(cashflowFormState.values)

    if (Object.keys(errors).length) {
      cashflowFormState = {
        ...cashflowFormState,
        errors,
      }
      render()
      return
    }

    const existingTransaction = cashflowTransactions.find(
      (transaction) => transaction.id === cashflowFormState.transactionId,
    )
    const nextTransaction = buildCashflowTransactionFromForm(
      cashflowFormState.values,
      existingTransaction,
    )
    const previousCashflowTransactions = cashflowTransactions

    cashflowTransactions =
      cashflowFormState.mode === 'edit'
        ? cashflowTransactions.map((transaction) =>
            transaction.id === nextTransaction.id ? nextTransaction : transaction,
          )
        : [nextTransaction, ...cashflowTransactions]

    try {
      saveStoredCashflow(cashflowTransactions)
    } catch {
      cashflowTransactions = previousCashflowTransactions
      cashflowFormState = {
        ...cashflowFormState,
        errors: {
          ...cashflowFormState.errors,
          attachment: 'Không lưu được giao dịch. Ảnh có thể làm đầy bộ nhớ local.',
        },
      }
      render()
      return
    }

    cashflowFormState = null
    render()
  })

  document.querySelector('[data-cashflow-action="delete-transaction"]')?.addEventListener(
    'click',
    () => {
      if (!cashflowFormState?.transactionId) {
        return
      }

      const confirmed = window.confirm('Bạn có chắc muốn xóa giao dịch này không?')

      if (!confirmed) {
        return
      }

      // Prototype 3B allows hard delete. A later audit phase can switch this to soft delete.
      cashflowTransactions = cashflowTransactions.filter(
        (transaction) => transaction.id !== cashflowFormState.transactionId,
      )
      saveStoredCashflow(cashflowTransactions)
      cashflowFormState = null
      render()
    },
  )

  document.querySelectorAll('[data-tuition-action="open-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      const student = students.find((item) => item.id === button.dataset.tuitionStudentId)

      if (!student) {
        return
      }

      const tuitionRecord = tuitionRecords.find((record) => record.studentId === student.id)
      tuitionFormState = tuitionRecord
        ? createEditTuitionFormState(student, tuitionRecord)
        : createEmptyTuitionFormState(student)
      tuitionPaymentFormState = null
      tuitionDetailState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-row-student-id]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (
        event.target.closest('[data-tuition-action="open-debt"]') ||
        event.target.closest('[data-tuition-action="open-detail"]')
      ) {
        return
      }

      openTuitionPackageForm(row.dataset.tuitionRowStudentId)
    })

    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      if (
        event.target.closest('[data-tuition-action="open-debt"]') ||
        event.target.closest('[data-tuition-action="open-detail"]')
      ) {
        return
      }

      event.preventDefault()
      openTuitionPackageForm(row.dataset.tuitionRowStudentId)
    })
  })

  document.querySelectorAll('[data-tuition-action="open-payment"]').forEach((button) => {
    button.addEventListener('click', () => {
      const student = students.find((item) => item.id === button.dataset.tuitionStudentId)
      const tuitionRecord = tuitionRecords.find((record) => record.studentId === button.dataset.tuitionStudentId)

      if (!student || !tuitionRecord) {
        return
      }

      tuitionPaymentFormState = createPaymentFormState(student, tuitionRecord)
      tuitionFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-action="open-debt"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const student = students.find((item) => item.id === button.dataset.tuitionStudentId)
      const tuitionRecord = tuitionRecords.find((record) => record.studentId === button.dataset.tuitionStudentId)

      if (!student || !tuitionRecord) {
        return
      }

      const debtAmount = getTuitionDebtAmount(tuitionRecord)
      tuitionPaymentFormState = createPaymentFormState(
        student,
        tuitionRecord,
        debtAmount > 0 ? 'collect' : 'history',
      )
      tuitionFormState = null
      tuitionDetailState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-action="open-detail"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      tuitionDetailState = {
        studentId: button.dataset.tuitionStudentId,
      }
      tuitionFormState = null
      tuitionPaymentFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-payment-action="cancel-payment"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionPaymentFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-detail-action="close-detail"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionDetailState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-package-suggestion]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!tuitionFormState) {
        return
      }

      const totalSessions = button.dataset.tuitionPackageSuggestion
      tuitionFormState = {
        ...tuitionFormState,
        values: {
          ...tuitionFormState.values,
          packageName: `Gói ${totalSessions} buổi`,
          totalSessions,
        },
        errors: {
          ...tuitionFormState.errors,
          packageName: undefined,
          totalSessions: undefined,
        },
      }
      render()
    })
  })

  document.querySelector('[data-tuition-action="open-renew"]')?.addEventListener('click', (event) => {
    const tuitionRecord = tuitionRecords.find((record) => record.id === event.currentTarget.dataset.tuitionId)
    const student = tuitionRecord
      ? students.find((item) => item.id === tuitionRecord.studentId)
      : null

    if (!student || !tuitionRecord) {
      return
    }

    tuitionFormState = createRenewTuitionFormState(student, tuitionRecord)
    tuitionPaymentFormState = null
    tuitionDetailState = null
    render()
  })

  document.querySelectorAll('[data-tuition-form-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!tuitionFormState) {
        return
      }

      const fieldName = control.dataset.tuitionFormField
      const selectionStart = 'selectionStart' in control ? control.selectionStart : null
      const selectionEnd = 'selectionEnd' in control ? control.selectionEnd : null

      tuitionFormState = {
        ...tuitionFormState,
        values: {
          ...tuitionFormState.values,
          [fieldName]: control.value,
        },
        errors: {
          ...tuitionFormState.errors,
          [fieldName]: undefined,
          discountAmount: undefined,
        },
      }

      if (['discountPreset', 'discountCustomValue', 'totalAmount', 'paidAmount'].includes(fieldName)) {
        render()
        const nextControl = document.querySelector(`[data-tuition-form-field="${fieldName}"]`)
        nextControl?.focus()

        if (selectionStart !== null && selectionEnd !== null && 'setSelectionRange' in nextControl) {
          nextControl.setSelectionRange(selectionStart, selectionEnd)
        }
      }
    })
  })

  document.querySelector('[data-tuition-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!tuitionFormState) {
      return
    }

    const errors = tuitionFormState.mode === 'renew'
      ? validateRenewTuitionForm(tuitionFormState.values)
      : validateTuitionForm(tuitionFormState.values)

    if (Object.keys(errors).length) {
      tuitionFormState = {
        ...tuitionFormState,
        errors,
      }
      render()
      return
    }

    const normalizedValues = normalizeTuitionFormValues(tuitionFormState.values)
    const currentRecord = tuitionRecords.find((record) => record.id === tuitionFormState.tuitionId)
    const nextRecord = tuitionFormState.mode === 'renew' && currentRecord
      ? createRenewedTuitionRecord(currentRecord, normalizedValues)
      : {
          id: tuitionFormState.tuitionId || `tuition-${tuitionFormState.studentId}-${Date.now()}`,
          studentId: tuitionFormState.studentId,
          ...normalizedValues,
          payments: currentRecord?.payments ?? [],
          currentTermNumber: currentRecord?.currentTermNumber ?? 1,
          currentTermId:
            currentRecord?.currentTermId ??
            `term-${tuitionFormState.tuitionId || tuitionFormState.studentId}-${Date.now()}`,
          startedAt: currentRecord?.startedAt ?? new Date().toISOString(),
          termHistory: currentRecord?.termHistory ?? [],
        }

    tuitionRecords = tuitionFormState.mode === 'edit' || tuitionFormState.mode === 'renew'
      ? tuitionRecords.map((record) => (record.id === nextRecord.id ? nextRecord : record))
      : [nextRecord, ...tuitionRecords]
    saveStoredTuition(tuitionRecords)
    if (tuitionFormState.mode === 'renew') {
      const student = students.find((item) => item.id === nextRecord.studentId)
      const newPayments = nextRecord.payments ?? []

      newPayments.forEach((payment) => {
        syncTuitionPaymentToCashflow(payment, nextRecord, student)
      })
    }
    notifications = syncTuitionNotifications(notifications)
    tuitionFormState = null
    render()
  })

  document.querySelectorAll('[data-tuition-payment-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!tuitionPaymentFormState) {
        return
      }

      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        values: {
          ...tuitionPaymentFormState.values,
          [control.dataset.tuitionPaymentField]: control.value,
        },
        errors: {
          ...tuitionPaymentFormState.errors,
          [control.dataset.tuitionPaymentField]: undefined,
        },
      }

      if (control.dataset.tuitionPaymentField === 'amount') {
        render()
        const nextControl = document.querySelector('[data-tuition-payment-field="amount"]')
        nextControl?.focus()
      }
    })
  })

  document.querySelector('[data-tuition-payment-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!tuitionPaymentFormState) {
      return
    }

    const errors = validatePaymentForm(tuitionPaymentFormState.values)

    if (Object.keys(errors).length) {
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        errors,
      }
      render()
      return
    }

    const normalizedPayment = normalizePaymentFormValues(tuitionPaymentFormState.values)
    const paymentRecord = {
      id: `payment-${tuitionPaymentFormState.tuitionId}-${Date.now()}`,
      ...normalizedPayment,
      createdAt: new Date().toISOString(),
    }
    let updatedTuitionRecord = null

    tuitionRecords = tuitionRecords.map((record) => {
      if (record.id !== tuitionPaymentFormState.tuitionId) {
        return record
      }

      updatedTuitionRecord = {
        ...record,
        paidAmount: record.paidAmount + normalizedPayment.amount,
        payments: [paymentRecord, ...(record.payments ?? [])],
      }

      return updatedTuitionRecord
    })
    saveStoredTuition(tuitionRecords)
    syncTuitionPaymentToCashflow(
      paymentRecord,
      updatedTuitionRecord,
      students.find((student) => student.id === tuitionPaymentFormState.studentId),
    )
    notifications = syncTuitionNotifications(notifications)
    tuitionPaymentFormState = null
    render()
  })

  document.querySelectorAll('[data-student-filter]').forEach((control) => {
    control.addEventListener('input', () => {
      const filterName = control.dataset.studentFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      studentFilters = {
        ...studentFilters,
        [filterName]: control.value,
      }
      render()

      const nextControl = document.querySelector(`[data-student-filter="${filterName}"]`)
      nextControl?.focus()

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelectorAll('[data-parent-consultation-filter]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      const filterName = control.dataset.parentConsultationFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      parentConsultationFilters = {
        ...parentConsultationFilters,
        [filterName]: control.value,
      }
      render()

      const nextControl = document.querySelector(
        `[data-parent-consultation-filter="${filterName}"]`,
      )
      nextControl?.focus()

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelectorAll('[data-parent-contact-field]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      if (!parentConsultationFormState) {
        return
      }

      parentConsultationFormState = {
        ...parentConsultationFormState,
        values: {
          ...parentConsultationFormState.values,
          [control.dataset.parentContactField]: control.value,
        },
        errors: {
          ...parentConsultationFormState.errors,
          [control.dataset.parentContactField]: '',
        },
      }
    })
  })

  document.querySelectorAll('[data-parent-care-log-field]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      if (!parentConsultationFormState) {
        return
      }

      const fieldName = control.dataset.parentCareLogField
      parentConsultationFormState = {
        ...parentConsultationFormState,
        careLogDraft: {
          ...(parentConsultationFormState.careLogDraft ?? createEmptyParentCareLogDraft()),
          [fieldName]: control.value,
          errors: {
            ...(parentConsultationFormState.careLogDraft?.errors ?? {}),
            [fieldName]: '',
          },
        },
      }
    })
  })

  document.querySelectorAll('[data-parent-appointment-field]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      if (!parentConsultationFormState) {
        return
      }

      const fieldName = control.dataset.parentAppointmentField
      parentConsultationFormState = {
        ...parentConsultationFormState,
        appointmentDraft: {
          ...(parentConsultationFormState.appointmentDraft ?? createEmptyParentAppointmentDraft()),
          [fieldName]: control.value,
          errors: {
            ...(parentConsultationFormState.appointmentDraft?.errors ?? {}),
            [fieldName]: '',
          },
        },
      }
    })
  })

  document.querySelectorAll('[data-parent-appointment-status-id]').forEach((control) => {
    control.addEventListener('change', () => {
      if (!parentConsultationFormState || parentConsultationFormState.mode !== 'edit') {
        return
      }

      const existingContact = parentConsultations.find(
        (contact) => contact.id === parentConsultationFormState.contactId,
      )

      if (!existingContact) {
        return
      }

      const contactWithCurrentFormValues = buildParentContactFromForm(
        parentConsultationFormState.values,
        existingContact,
        students,
      )
      const updatedContact = updateParentAppointmentStatus(
        contactWithCurrentFormValues,
        control.dataset.parentAppointmentStatusId,
        control.value,
      )

      parentConsultations = parentConsultations.map((contact) =>
        contact.id === updatedContact.id ? updatedContact : contact,
      )
      saveStoredParentConsultations(parentConsultations)
      parentConsultationFormState = createEditParentContactFormState(updatedContact)
      render()
    })
  })

  document.querySelectorAll('[data-parent-enrollment-field]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      if (!parentConsultationFormState) {
        return
      }

      const fieldName = control.dataset.parentEnrollmentField
      parentConsultationFormState = {
        ...parentConsultationFormState,
        enrollmentDraft: {
          ...parentConsultationFormState.enrollmentDraft,
          [fieldName]: control.value,
        },
        enrollmentErrors: {
          ...(parentConsultationFormState.enrollmentErrors ?? {}),
          [fieldName]: '',
          summary: '',
        },
        enrollmentMessage: '',
      }
    })
  })

  document.querySelector('[data-parent-contact-action="open-create"]')?.addEventListener('click', () => {
    parentConsultationFormState = createEmptyParentContactFormState()
    render()
  })

  document.querySelectorAll('[data-parent-contact-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const contact = parentConsultations.find((item) => item.id === button.dataset.contactId)

      if (!contact) {
        return
      }

      parentConsultationFormState = createEditParentContactFormState(contact)
      render()
    })
  })

  document.querySelectorAll('[data-parent-contact-action="delete"]').forEach((button) => {
    button.addEventListener('click', () => {
      const contact = parentConsultations.find((item) => item.id === button.dataset.contactId)

      if (!contact || !window.confirm('Bạn có chắc muốn xóa liên hệ này?')) {
        return
      }

      parentConsultations = parentConsultations.filter((item) => item.id !== contact.id)
      saveStoredParentConsultations(parentConsultations)

      if (parentConsultationFormState?.contactId === contact.id) {
        parentConsultationFormState = null
      }

      render()
    })
  })

  document.querySelectorAll('[data-parent-contact-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      parentConsultationFormState = null
      render()
    })
  })

  document.querySelector('[data-parent-contact-action="save-form"]')?.addEventListener('click', () => {
    if (!parentConsultationFormState) {
      return
    }

    const errors = validateParentContactForm(parentConsultationFormState.values)

    if (Object.keys(errors).length) {
      parentConsultationFormState = {
        ...parentConsultationFormState,
        errors,
      }
      render()
      return
    }

    const existingContact =
      parentConsultationFormState.mode === 'edit'
        ? parentConsultations.find((contact) => contact.id === parentConsultationFormState.contactId)
        : null
    const nextContact = buildParentContactFromForm(
      parentConsultationFormState.values,
      existingContact,
      students,
    )

    parentConsultations = existingContact
      ? parentConsultations.map((contact) =>
          contact.id === existingContact.id ? nextContact : contact,
        )
      : [nextContact, ...parentConsultations]

    saveStoredParentConsultations(parentConsultations)
    parentConsultationFormState = null
    render()
  })

  document.querySelector('[data-parent-care-log-action="add"]')?.addEventListener('click', () => {
    if (!parentConsultationFormState || parentConsultationFormState.mode !== 'edit') {
      return
    }

    const draft = parentConsultationFormState.careLogDraft ?? createEmptyParentCareLogDraft()
    const errors = validateParentCareLogDraft(draft)

    if (Object.keys(errors).length) {
      parentConsultationFormState = {
        ...parentConsultationFormState,
        careLogDraft: {
          ...draft,
          errors,
        },
      }
      render()
      return
    }

    const existingContact = parentConsultations.find(
      (contact) => contact.id === parentConsultationFormState.contactId,
    )

    if (!existingContact) {
      return
    }

    const contactWithCurrentFormValues = buildParentContactFromForm(
      parentConsultationFormState.values,
      existingContact,
      students,
    )
    const updatedContact = addCareLogToParentContact(contactWithCurrentFormValues, draft)

    parentConsultations = parentConsultations.map((contact) =>
      contact.id === updatedContact.id ? updatedContact : contact,
    )
    saveStoredParentConsultations(parentConsultations)
    parentConsultationFormState = {
      ...createEditParentContactFormState(updatedContact),
      careLogDraft: createEmptyParentCareLogDraft(),
    }
    render()
  })

  document.querySelector('[data-parent-appointment-action="add"]')?.addEventListener('click', () => {
    if (!parentConsultationFormState || parentConsultationFormState.mode !== 'edit') {
      return
    }

    const draft = parentConsultationFormState.appointmentDraft ?? createEmptyParentAppointmentDraft()
    const errors = validateParentAppointmentDraft(draft)

    if (Object.keys(errors).length) {
      parentConsultationFormState = {
        ...parentConsultationFormState,
        appointmentDraft: {
          ...draft,
          errors,
        },
      }
      render()
      return
    }

    const existingContact = parentConsultations.find(
      (contact) => contact.id === parentConsultationFormState.contactId,
    )

    if (!existingContact) {
      return
    }

    const contactWithCurrentFormValues = buildParentContactFromForm(
      parentConsultationFormState.values,
      existingContact,
      students,
    )
    const updatedContact = addAppointmentToParentContact(contactWithCurrentFormValues, draft)

    parentConsultations = parentConsultations.map((contact) =>
      contact.id === updatedContact.id ? updatedContact : contact,
    )
    saveStoredParentConsultations(parentConsultations)
    parentConsultationFormState = {
      ...createEditParentContactFormState(updatedContact),
      appointmentDraft: createEmptyParentAppointmentDraft(),
    }
    render()
  })

  document.querySelector('[data-parent-enrollment-action="save"]')?.addEventListener('click', () => {
    saveParentEnrollmentDraft(false)
  })

  document.querySelector('[data-parent-enrollment-action="ready"]')?.addEventListener('click', () => {
    saveParentEnrollmentDraft(true)
  })

  document.querySelector('[data-parent-enrollment-action="copy"]')?.addEventListener('click', async () => {
    if (!parentConsultationFormState || parentConsultationFormState.mode !== 'edit') {
      return
    }

    const contact = parentConsultations.find(
      (item) => item.id === parentConsultationFormState.contactId,
    )
    const summary = buildEnrollmentSummary({
      ...(contact ?? {}),
      enrollmentDraft: parentConsultationFormState.enrollmentDraft,
    })

    try {
      await navigator.clipboard.writeText(summary)
      parentConsultationFormState = {
        ...parentConsultationFormState,
        enrollmentMessage: 'Đã copy tóm tắt đăng ký.',
      }
    } catch {
      parentConsultationFormState = {
        ...parentConsultationFormState,
        enrollmentMessage: 'Không copy tự động được. Hãy copy thủ công từ khung tóm tắt.',
      }
    }
    render()
  })

  document.querySelectorAll('[data-teacher-filter]').forEach((control) => {
    control.addEventListener('input', () => {
      const filterName = control.dataset.teacherFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      teacherFilters = {
        ...teacherFilters,
        [filterName]: control.value,
      }
      render()

      const nextControl = document.querySelector(`[data-teacher-filter="${filterName}"]`)
      nextControl?.focus()

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelector('[data-teacher-action="open-create"]')?.addEventListener('click', () => {
    teacherFormState = createEmptyTeacherFormState()
    selectedTeacherId = null
    render()
  })

  document.querySelectorAll('[data-teacher-action="open-profile"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      selectedTeacherId = button.dataset.teacherId
      teacherFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-teacher-action="close-profile"]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedTeacherId = null
      render()
    })
  })

  document.querySelectorAll('[data-teacher-action="open-edit"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const teacher = teachers.find((item) => item.id === button.dataset.teacherId)

      if (!teacher) {
        return
      }

      teacherFormState = createEditTeacherFormState(teacher)
      render()
    })
  })

  document.querySelectorAll('[data-teacher-action="edit-from-profile"]').forEach((button) => {
    button.addEventListener('click', () => {
      const teacher = teachers.find((item) => item.id === button.dataset.teacherId)

      if (!teacher) {
        return
      }

      teacherFormState = createEditTeacherFormState(teacher)
      render()
    })
  })

  document.querySelectorAll('[data-teacher-action="stop-teaching"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const teacher = teachers.find((item) => item.id === button.dataset.teacherId)

      if (!teacher || teacher.status === 'inactive') {
        return
      }

      const confirmed = window.confirm(
        `Ngừng dạy giáo viên ${teacher.displayName || teacher.fullName}? Dữ liệu vẫn được giữ lại và chỉ chuyển trạng thái sang Ngừng dạy.`,
      )

      if (!confirmed) {
        return
      }

      teachers = teachers.map((item) =>
        item.id === teacher.id
          ? {
              ...item,
              status: 'inactive',
              updatedAt: new Date().toISOString(),
            }
          : item,
      )
      saveStoredTeachers(teachers)
      render()
    })
  })

  document.querySelectorAll('[data-teacher-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      teacherFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-teacher-form-field]').forEach((control) => {
    control.addEventListener('input', () => {
      const fieldName = control.dataset.teacherFormField

      teacherFormState = {
        ...teacherFormState,
        values: {
          ...teacherFormState.values,
          [fieldName]: control.value,
        },
        errors: {
          ...teacherFormState.errors,
          [fieldName]: undefined,
        },
      }
    })
  })

  document.querySelectorAll('[data-teacher-level-field]').forEach((control) => {
    control.addEventListener('change', () => {
      const selectedLevels = Array.from(document.querySelectorAll('[data-teacher-level-field]:checked'))
        .map((checkbox) => checkbox.value)

      teacherFormState = {
        ...teacherFormState,
        values: {
          ...teacherFormState.values,
          levels: selectedLevels,
        },
      }
    })
  })

  document.querySelectorAll('[data-teacher-mode-field]').forEach((control) => {
    control.addEventListener('change', () => {
      const selectedModes = Array.from(document.querySelectorAll('[data-teacher-mode-field]:checked'))
        .map((checkbox) => checkbox.value)

      teacherFormState = {
        ...teacherFormState,
        values: {
          ...teacherFormState.values,
          teachingModes: selectedModes,
        },
      }
    })
  })

  document.querySelectorAll('[data-teacher-available-day-field]').forEach((control) => {
    control.addEventListener('change', () => {
      const selectedDays = Array.from(document.querySelectorAll('[data-teacher-available-day-field]:checked'))
        .map((checkbox) => checkbox.value)

      teacherFormState = {
        ...teacherFormState,
        values: {
          ...teacherFormState.values,
          availableDays: selectedDays,
        },
      }
    })
  })

  document.querySelectorAll('[data-teacher-time-slot-field]').forEach((control) => {
    control.addEventListener('change', () => {
      const selectedSlots = Array.from(document.querySelectorAll('[data-teacher-time-slot-field]:checked'))
        .map((checkbox) => checkbox.value)

      teacherFormState = {
        ...teacherFormState,
        values: {
          ...teacherFormState.values,
          preferredTimeSlots: selectedSlots,
        },
      }
    })
  })

  document.querySelector('[data-teacher-new-class-field]')?.addEventListener('change', (event) => {
    teacherFormState = {
      ...teacherFormState,
      values: {
        ...teacherFormState.values,
        canTakeNewClass: event.currentTarget.checked,
      },
    }
  })

  document.querySelector('[data-teacher-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    const errors = validateTeacherForm(teacherFormState.values)

    if (Object.keys(errors).length) {
      teacherFormState = {
        ...teacherFormState,
        errors,
      }
      render()
      return
    }

    if (teacherFormState.mode === 'edit') {
      const existingTeacher = teachers.find((teacher) => teacher.id === teacherFormState.teacherId)

      if (!existingTeacher) {
        teacherFormState = {
          ...teacherFormState,
          errors: {
            form: 'Không tìm thấy giáo viên cần sửa.',
          },
        }
        render()
        return
      }

      const updatedTeacher = buildTeacherFromForm(teacherFormState.values, existingTeacher)
      teachers = teachers.map((teacher) =>
        teacher.id === updatedTeacher.id ? updatedTeacher : teacher,
      )
      selectedTeacherId = updatedTeacher.id
    } else {
      const createdTeacher = buildTeacherFromForm(teacherFormState.values)
      teachers = [createdTeacher, ...teachers]
      selectedTeacherId = createdTeacher.id
    }

    saveStoredTeachers(teachers)
    teacherFormState = null
    render()
  })

  document.querySelectorAll('[data-schedule-week-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.scheduleWeekAction

      if (action === 'previous') {
        scheduleWeekStartDate = getPreviousScheduleWeekStartDate(scheduleWeekStartDate)
      }

      if (action === 'today') {
        scheduleWeekStartDate = getCurrentScheduleWeekStartDate()
      }

      if (action === 'next') {
        scheduleWeekStartDate = getNextScheduleWeekStartDate(scheduleWeekStartDate)
      }

      scheduleReportState = null
      sessionReportAttendanceState = null
      sessionReportLearningState = null
      sessionReportLearningFormState = null
      sessionReportExtraState = null
      isSessionReportExtraExpanded = false
      sessionReportGuestFormState = null
      render()
    })
  })

  document.querySelector('[data-schedule-action="open-create"]')?.addEventListener('click', () => {
    scheduleFormState = createEmptyScheduleFormState()
    scheduleReportState = null
    sessionReportAttendanceState = null
    sessionReportLearningState = null
    sessionReportLearningFormState = null
    sessionReportExtraState = null
    isSessionReportExtraExpanded = false
    sessionReportGuestFormState = null
    render()
  })

  document.querySelectorAll('[data-schedule-action="open-create-for-day"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      scheduleFormState = createScheduleFormStateForDay(
        button.dataset.scheduleDayOfWeek,
        button.dataset.scheduleDate,
      )
      scheduleReportState = null
      sessionReportAttendanceState = null
      sessionReportLearningState = null
      sessionReportLearningFormState = null
      sessionReportExtraState = null
      isSessionReportExtraExpanded = false
      sessionReportGuestFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-schedule-action="open-edit"]').forEach((card) => {
    const openScheduleSession = () => {
      const session = scheduleSessions.find(
        (item) => item.id === card.dataset.scheduleSessionId,
      )

      if (!session) {
        return
      }

      const occurrenceDate = card.dataset.scheduleOccurrenceDate
      const occurrence = getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate).find(
        (item) => item.id === session.id && item.occurrenceDate === occurrenceDate,
      )

      if (occurrence && isPastScheduleOccurrence(occurrence)) {
        scheduleFormState = null
        scheduleReportState = {
          sessionId: session.id,
          occurrenceDate: occurrence.occurrenceDate,
        }
        sessionReportAttendanceState = createSessionReportDraft(
          occurrence,
          findSessionReport(sessionReports, session.id, occurrence.occurrenceDate),
        )
        sessionReportLearningState = createSessionReportLearningState(
          occurrence,
          findSessionReport(sessionReports, session.id, occurrence.occurrenceDate),
        )
        sessionReportExtraState = createSessionReportExtraState(
          occurrence,
          findSessionReport(sessionReports, session.id, occurrence.occurrenceDate),
        )
        sessionReportLearningFormState = null
        isSessionReportExtraExpanded = false
        sessionReportGuestFormState = null
      } else {
        scheduleReportState = null
        sessionReportAttendanceState = null
        sessionReportLearningState = null
        sessionReportLearningFormState = null
        sessionReportExtraState = null
        isSessionReportExtraExpanded = false
        sessionReportGuestFormState = null
        scheduleFormState = createEditScheduleFormState(session)
      }

      render()
    }

    card.addEventListener('click', openScheduleSession)
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openScheduleSession()
      }
    })
  })

  document.querySelectorAll('[data-schedule-action="close-report"]').forEach((button) => {
    button.addEventListener('click', () => {
      scheduleReportState = null
      sessionReportAttendanceState = null
      sessionReportLearningState = null
      sessionReportLearningFormState = null
      sessionReportExtraState = null
      isSessionReportExtraExpanded = false
      sessionReportGuestFormState = null
      render()
    })
  })

  document.querySelector('[data-schedule-action="edit-from-report"]')?.addEventListener('click', (event) => {
    const session = scheduleSessions.find(
      (item) => item.id === event.currentTarget.dataset.scheduleSessionId,
    )

    if (!session) {
      return
    }

    scheduleReportState = null
    sessionReportAttendanceState = null
    sessionReportLearningState = null
    sessionReportLearningFormState = null
    sessionReportExtraState = null
    isSessionReportExtraExpanded = false
    sessionReportGuestFormState = null
    scheduleFormState = createEditScheduleFormState(session)
    render()
  })

  document
    .querySelectorAll(
      '.schedule-report-panel button, .schedule-report-panel input, .schedule-report-panel select, .schedule-report-panel textarea, .schedule-report-panel label',
    )
    .forEach((control) => {
      control.addEventListener('pointerdown', (event) => {
        event.stopPropagation()
      })
      control.addEventListener('click', (event) => {
        event.stopPropagation()
      })
    })

  document.querySelectorAll('[data-session-report-attendance-status]').forEach((control) => {
    control.addEventListener('change', () => {
      sessionReportAttendanceState = updateSessionReportDraftAttendance(
        sessionReportAttendanceState,
        control.dataset.sessionReportStudentId,
        'attendanceStatus',
        control.value,
      )
      render()
    })
  })

  document.querySelectorAll('[data-session-report-attendance-note]').forEach((control) => {
    control.addEventListener('input', () => {
      sessionReportAttendanceState = updateSessionReportDraftAttendance(
        sessionReportAttendanceState,
        control.dataset.sessionReportStudentId,
        'note',
        control.value,
      )
    })
  })

  document.querySelector('[data-schedule-action="save-attendance"]')?.addEventListener('click', () => {
    if (!scheduleReportState || !sessionReportAttendanceState) {
      return
    }

    const error = validateSessionReportAttendance(sessionReportAttendanceState.attendance)

    if (error) {
      sessionReportAttendanceState = {
        ...sessionReportAttendanceState,
        error,
        saveState: '',
      }
      render()
      return
    }

    const existingReport = findSessionReport(
      sessionReports,
      scheduleReportState.sessionId,
      scheduleReportState.occurrenceDate,
    )
    const savedReport = buildSessionReportFromAttendance(
      sessionReportAttendanceState,
      existingReport,
    )

    sessionReports = existingReport
      ? sessionReports.map((report) => (report.id === existingReport.id ? savedReport : report))
      : [savedReport, ...sessionReports]

    saveStoredSessionReports(sessionReports)
    sessionReportAttendanceState = {
      ...sessionReportAttendanceState,
      attendance: savedReport.attendance,
      error: '',
      saveState: 'saved',
    }
    render()
  })

  document.querySelector('[data-session-guest-action="open-create"]')?.addEventListener('click', () => {
    sessionReportGuestFormState = createEmptyGuestParticipantFormState()
    render()
  })

  document.querySelector('[data-session-guest-action="cancel-form"]')?.addEventListener('click', () => {
    sessionReportGuestFormState = null
    render()
  })

  document.querySelectorAll('[data-session-guest-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!sessionReportGuestFormState) {
        return
      }

      sessionReportGuestFormState = {
        ...sessionReportGuestFormState,
        values: {
          ...sessionReportGuestFormState.values,
          [control.dataset.sessionGuestField]: control.value,
        },
        errors: {},
      }
    })

    control.addEventListener('change', () => {
      if (!sessionReportGuestFormState) {
        return
      }

      sessionReportGuestFormState = {
        ...sessionReportGuestFormState,
        values: {
          ...sessionReportGuestFormState.values,
          [control.dataset.sessionGuestField]: control.value,
        },
        errors: {},
      }
    })
  })

  document.querySelector('[data-session-guest-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!scheduleReportState || !sessionReportAttendanceState || !sessionReportGuestFormState) {
      return
    }

    const formValues = {
      displayName:
        document.querySelector('[data-session-guest-field="displayName"]')?.value ??
        sessionReportGuestFormState.values.displayName,
      participationType:
        document.querySelector('[data-session-guest-field="participationType"]')?.value ??
        sessionReportGuestFormState.values.participationType,
      note:
        document.querySelector('[data-session-guest-field="note"]')?.value ??
        sessionReportGuestFormState.values.note,
    }
    const errors = validateGuestParticipantForm(formValues)

    if (Object.keys(errors).length) {
      sessionReportGuestFormState = {
        ...sessionReportGuestFormState,
        values: formValues,
        errors,
      }
      render()
      return
    }

    const nextAttendanceState = {
      ...sessionReportAttendanceState,
      guestParticipants: [
        buildGuestParticipantFromForm(formValues),
        ...(sessionReportAttendanceState.guestParticipants ?? []),
      ],
      saveState: 'saved',
      error: '',
    }
    const existingReport = findSessionReport(
      sessionReports,
      scheduleReportState.sessionId,
      scheduleReportState.occurrenceDate,
    )
    const savedReport = buildSessionReportFromAttendance(nextAttendanceState, existingReport)

    sessionReports = existingReport
      ? sessionReports.map((report) => (report.id === existingReport.id ? savedReport : report))
      : [savedReport, ...sessionReports]

    saveStoredSessionReports(sessionReports)
    sessionReportAttendanceState = {
      ...nextAttendanceState,
      guestParticipants: savedReport.guestParticipants,
    }
    sessionReportGuestFormState = null
    render()
  })

  document.querySelectorAll('[data-session-guest-action="delete"]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!scheduleReportState || !sessionReportAttendanceState) {
        return
      }

      const nextAttendanceState = {
        ...sessionReportAttendanceState,
        guestParticipants: (sessionReportAttendanceState.guestParticipants ?? []).filter(
          (guest) => guest.id !== button.dataset.guestId,
        ),
        saveState: 'saved',
        error: '',
      }
      const existingReport = findSessionReport(
        sessionReports,
        scheduleReportState.sessionId,
        scheduleReportState.occurrenceDate,
      )
      const savedReport = buildSessionReportFromAttendance(nextAttendanceState, existingReport)

      sessionReports = existingReport
        ? sessionReports.map((report) => (report.id === existingReport.id ? savedReport : report))
        : [savedReport, ...sessionReports]

      saveStoredSessionReports(sessionReports)
      sessionReportAttendanceState = {
        ...nextAttendanceState,
        guestParticipants: savedReport.guestParticipants,
      }
      sessionReportGuestFormState = null
      render()
    })
  })

  document.querySelector('[data-session-learning-action="open-create"]')?.addEventListener('click', () => {
    if (sessionReportLearningFormState) {
      return
    }

    sessionReportLearningFormState = createEmptyLearningGroupFormState()
    sessionReportLearningState = {
      ...sessionReportLearningState,
      error: '',
      saveState: '',
    }
    render()
  })

  document.querySelectorAll('[data-session-learning-action="open-edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const group = sessionReportLearningState?.groups.find(
        (item) => item.id === button.dataset.learningGroupId,
      )

      if (!group) {
        return
      }

      sessionReportLearningFormState = createEditLearningGroupFormState(group)
      sessionReportLearningState = {
        ...sessionReportLearningState,
        error: '',
        saveState: '',
      }
      render()
    })
  })

  document.querySelectorAll('[data-session-learning-action="delete"]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!scheduleReportState || !sessionReportLearningState) {
        return
      }

      const confirmed = window.confirm('Xóa nhóm nội dung học này?')

      if (!confirmed) {
        return
      }

      const nextLearningState = {
        ...sessionReportLearningState,
        groups: sessionReportLearningState.groups.filter(
          (group) => group.id !== button.dataset.learningGroupId,
        ),
        error: '',
        saveState: 'saved',
      }
      const existingReport = findSessionReport(
        sessionReports,
        scheduleReportState.sessionId,
        scheduleReportState.occurrenceDate,
      )
      const savedReport = buildSessionReportFromLearningGroups(nextLearningState, existingReport)

      sessionReports = existingReport
        ? sessionReports.map((report) => (report.id === existingReport.id ? savedReport : report))
        : [savedReport, ...sessionReports]

      saveStoredSessionReports(sessionReports)
      sessionReportLearningState = {
        ...nextLearningState,
        groups: savedReport.learningGroups,
      }
      sessionReportLearningFormState = null
      render()
    })
  })

  document.querySelector('[data-session-learning-action="cancel-form"]')?.addEventListener('click', () => {
    sessionReportLearningFormState = null
    render()
  })

  document.querySelectorAll('[data-session-learning-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!sessionReportLearningFormState) {
        return
      }

      sessionReportLearningFormState = {
        ...sessionReportLearningFormState,
        values: {
          ...sessionReportLearningFormState.values,
          [control.dataset.sessionLearningField]: control.value,
        },
        errors: {},
      }
    })
  })

  document.querySelectorAll('[data-session-learning-student]').forEach((control) => {
    control.addEventListener('change', () => {
      if (!sessionReportLearningFormState) {
        return
      }

      const selectedStudentIds = Array.from(
        document.querySelectorAll('[data-session-learning-student]:checked'),
      ).map((checkbox) => checkbox.value)

      sessionReportLearningFormState = {
        ...sessionReportLearningFormState,
        values: {
          ...sessionReportLearningFormState.values,
          studentIds: selectedStudentIds,
        },
        errors: {},
      }
      render()
    })
  })

  document.querySelector('[data-session-learning-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!scheduleReportState || !sessionReportLearningState || !sessionReportLearningFormState) {
      return
    }

    const occurrence = getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate).find(
      (item) =>
        item.id === scheduleReportState.sessionId &&
        item.occurrenceDate === scheduleReportState.occurrenceDate,
    )

    if (!occurrence) {
      return
    }

    const formValues = {
      ...sessionReportLearningFormState.values,
      title:
        document.querySelector('[data-session-learning-field="title"]')?.value ??
        sessionReportLearningFormState.values.title,
      note:
        document.querySelector('[data-session-learning-field="note"]')?.value ??
        sessionReportLearningFormState.values.note,
      contentText:
        document.querySelector('[data-session-learning-field="contentText"]')?.value ??
        sessionReportLearningFormState.values.contentText,
      studentIds: Array.from(
        document.querySelectorAll('[data-session-learning-student]:checked'),
      ).map((checkbox) => checkbox.value),
    }
    const errors = validateLearningGroupForm(formValues)

    if (Object.keys(errors).length) {
      sessionReportLearningFormState = {
        ...sessionReportLearningFormState,
        values: formValues,
        errors,
      }
      render()
      return
    }

    const existingGroup = sessionReportLearningState.groups.find(
      (group) => group.id === sessionReportLearningFormState.groupId,
    )
    const savedGroup = buildLearningGroupFromForm(
      formValues,
      existingGroup,
      occurrence.studentIds,
    )
    const nextGroups =
      sessionReportLearningFormState.mode === 'edit'
        ? sessionReportLearningState.groups.map((group) =>
            group.id === savedGroup.id ? savedGroup : group,
          )
        : [savedGroup, ...sessionReportLearningState.groups]
    const nextLearningState = {
      ...sessionReportLearningState,
      groups: nextGroups,
      error: '',
      saveState: 'saved',
    }
    const existingReport = findSessionReport(
      sessionReports,
      scheduleReportState.sessionId,
      scheduleReportState.occurrenceDate,
    )
    const savedReport = buildSessionReportFromLearningGroups(nextLearningState, existingReport)

    sessionReports = existingReport
      ? sessionReports.map((report) => (report.id === existingReport.id ? savedReport : report))
      : [savedReport, ...sessionReports]

    saveStoredSessionReports(sessionReports)
    sessionReportLearningState = {
      ...nextLearningState,
      groups: savedReport.learningGroups,
    }
    sessionReportLearningFormState = null
    render()
  })

  document.querySelectorAll('[data-session-report-extra-field]').forEach((control) => {
    control.addEventListener('input', () => {
      sessionReportExtraState = updateSessionReportExtraState(
        sessionReportExtraState,
        control.dataset.sessionReportExtraField,
        control.value,
      )
    })
  })

  document.querySelector('[data-session-report-action="toggle-extra"]')?.addEventListener('click', () => {
    isSessionReportExtraExpanded = !isSessionReportExtraExpanded
    render()
  })

  document.querySelector('[data-session-report-action="save-extra"]')?.addEventListener('click', () => {
    if (!scheduleReportState || !sessionReportExtraState) {
      return
    }

    const formValues = {
      teachingAssistantNotes:
        document.querySelector('[data-session-report-extra-field="teachingAssistantNotes"]')?.value ??
        sessionReportExtraState.values.teachingAssistantNotes,
      classSituation:
        document.querySelector('[data-session-report-extra-field="classSituation"]')?.value ??
        sessionReportExtraState.values.classSituation,
      suggestions:
        document.querySelector('[data-session-report-extra-field="suggestions"]')?.value ??
        sessionReportExtraState.values.suggestions,
    }
    const nextExtraState = {
      ...sessionReportExtraState,
      values: formValues,
      saveState: 'saved',
      copyState: '',
      error: '',
    }
    const existingReport = findSessionReport(
      sessionReports,
      scheduleReportState.sessionId,
      scheduleReportState.occurrenceDate,
    )
    const savedReport = buildSessionReportFromExtraInfo(nextExtraState, existingReport)

    sessionReports = existingReport
      ? sessionReports.map((report) => (report.id === existingReport.id ? savedReport : report))
      : [savedReport, ...sessionReports]

    saveStoredSessionReports(sessionReports)
    sessionReportExtraState = nextExtraState
    render()
  })

  document.querySelector('[data-session-report-action="refresh-trello"]')?.addEventListener('click', () => {
    const formValues = {
      teachingAssistantNotes:
        document.querySelector('[data-session-report-extra-field="teachingAssistantNotes"]')?.value ??
        sessionReportExtraState?.values.teachingAssistantNotes ??
        '',
      classSituation:
        document.querySelector('[data-session-report-extra-field="classSituation"]')?.value ??
        sessionReportExtraState?.values.classSituation ??
        '',
      suggestions:
        document.querySelector('[data-session-report-extra-field="suggestions"]')?.value ??
        sessionReportExtraState?.values.suggestions ??
        '',
    }

    sessionReportExtraState = {
      ...(sessionReportExtraState ?? {}),
      sessionId: scheduleReportState?.sessionId,
      occurrenceDate: scheduleReportState?.occurrenceDate,
      values: formValues,
      saveState: '',
      copyState: '',
      error: '',
    }
    render()
  })

  document.querySelector('[data-session-report-action="copy-trello"]')?.addEventListener('click', async () => {
    const reportText = document.querySelector('[data-session-report-trello-output]')?.value ?? ''

    if (!sessionReportExtraState) {
      return
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }

      await navigator.clipboard.writeText(reportText)
      sessionReportExtraState = {
        ...sessionReportExtraState,
        copyState: 'copied',
        error: '',
      }
    } catch {
      sessionReportExtraState = {
        ...sessionReportExtraState,
        copyState: 'failed',
      }
    }

    render()
  })

  document.querySelectorAll('[data-schedule-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      scheduleFormState = null
      sessionReportAttendanceState = null
      sessionReportLearningState = null
      sessionReportLearningFormState = null
      sessionReportExtraState = null
      sessionReportGuestFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-schedule-form-field]').forEach((control) => {
    const updateScheduleFormValue = (shouldRender = false) => {
      if (!scheduleFormState) {
        return
      }

      const fieldName = control.dataset.scheduleFormField
      const nextValues = {
        ...scheduleFormState.values,
        [fieldName]: control.value,
      }

      if (fieldName === 'teacherId' && control.value) {
        const selectedTeacher = teachers.find((teacher) => teacher.id === control.value)

        if (selectedTeacher) {
          nextValues.teacherName = selectedTeacher.displayName || selectedTeacher.fullName || ''
        }
      }

      if (fieldName === 'scheduleType') {
        nextValues.allowOpenRange = ''
        if (control.value === 'oneOff' && !nextValues.occurrenceReason) {
          nextValues.occurrenceReason = 'makeup'
        }
      }

      scheduleFormState = {
        ...scheduleFormState,
        values: nextValues,
        errors: {
          ...scheduleFormState.errors,
          [fieldName]: undefined,
        },
      }

      if (shouldRender || ['teacherId', 'scheduleType', 'date'].includes(fieldName)) {
        render()
      }
    }

    control.addEventListener('input', () => updateScheduleFormValue(false))
    control.addEventListener('change', () => updateScheduleFormValue(true))
  })

  document.querySelectorAll('[data-schedule-student-field]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      if (!scheduleFormState) {
        return
      }

      const selectedStudentIds = Array.from(
        document.querySelectorAll('[data-schedule-student-field]:checked'),
      ).map((input) => input.value)

      scheduleFormState = {
        ...scheduleFormState,
        values: {
          ...scheduleFormState.values,
          studentIds: selectedStudentIds,
        },
        errors: {
          ...scheduleFormState.errors,
          studentIds: undefined,
        },
      }
      render()
    })
  })

  document.querySelector('[data-schedule-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!scheduleFormState) {
      return
    }

    const errors = validateScheduleForm(scheduleFormState.values)

    if (Object.keys(errors).length) {
      scheduleFormState = {
        ...scheduleFormState,
        errors,
      }
      render()
      return
    }

    if (scheduleFormState.mode === 'edit') {
      const existingSession = scheduleSessions.find(
        (session) => session.id === scheduleFormState.sessionId,
      )

      if (!existingSession) {
        scheduleFormState = {
          ...scheduleFormState,
          errors: {
            form: 'Không tìm thấy buổi học cần sửa.',
          },
        }
        render()
        return
      }

      const updatedSession = buildScheduleSessionFromForm(
        scheduleFormState.values,
        existingSession,
        teachers,
      )
      scheduleSessions = scheduleSessions.map((session) =>
        session.id === updatedSession.id ? updatedSession : session,
      )
    } else {
      const createdSession = buildScheduleSessionFromForm(scheduleFormState.values, null, teachers)
      scheduleSessions = [createdSession, ...scheduleSessions]
    }

    saveStoredSchedule(scheduleSessions)
    scheduleFormState = null
    scheduleReportState = null
    sessionReportAttendanceState = null
    sessionReportLearningState = null
    sessionReportLearningFormState = null
    sessionReportExtraState = null
    isSessionReportExtraExpanded = false
    sessionReportGuestFormState = null
    render()
  })

  document.querySelector('[data-schedule-action="delete-session"]')?.addEventListener('click', () => {
    if (!scheduleFormState?.sessionId) {
      return
    }

    const confirmed = window.confirm('Xóa buổi học này khỏi lịch tuần?')

    if (!confirmed) {
      return
    }

    scheduleSessions = scheduleSessions.filter(
      (session) => session.id !== scheduleFormState.sessionId,
    )
    saveStoredSchedule(scheduleSessions)
    scheduleFormState = null
    scheduleReportState = null
    sessionReportAttendanceState = null
    sessionReportLearningState = null
    sessionReportLearningFormState = null
    sessionReportExtraState = null
    isSessionReportExtraExpanded = false
    sessionReportGuestFormState = null
    render()
  })

  document.querySelectorAll('[data-student-sort]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const sortBy = button.dataset.studentSort

      studentFilters = {
        ...studentFilters,
        sortBy,
        sortDirection:
          studentFilters.sortBy === sortBy && studentFilters.sortDirection === 'asc' ? 'desc' : 'asc',
      }
      render()
    })
  })

  document.querySelector('[data-student-action="open-create"]')?.addEventListener('click', () => {
    studentFormState = createEmptyStudentFormState()
    render()
  })

  document.querySelectorAll('[data-student-action="open-edit"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const student = students.find((item) => item.id === button.dataset.studentEditId)

      if (!student) {
        return
      }

      studentFormState = createEditStudentFormState(student)
      render()
    })
  })

  document.querySelectorAll('[data-student-action="edit-from-detail"]').forEach((button) => {
    button.addEventListener('click', () => {
      openStudentEditForm(button.dataset.studentEditId)
    })
  })

  document.querySelectorAll('[data-student-detail-action]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
      event.stopImmediatePropagation()
    })

    button.addEventListener('mousedown', (event) => {
      event.stopPropagation()
      event.stopImmediatePropagation()
    })

    button.addEventListener('click', (event) => {
      event.stopPropagation()
      event.stopImmediatePropagation()
      const { studentDetailAction, studentId } = button.dataset

      if (studentDetailAction === 'open-care-notes') {
        setTimeout(() => openStudentSubWindow(studentId, 'student-care-notes'), 0)
        return
      }

      if (studentDetailAction === 'open-learning') {
        setTimeout(() => openStudentSubWindow(studentId, 'student-learning'), 0)
        return
      }

      if (studentDetailAction === 'soft-delete') {
        softDeleteStudent(studentId)
        return
      }

      if (studentDetailAction === 'clear-avatar') {
        const student = getStudentById(studentId)

        if (!student?.avatarUrl) {
          return
        }

        students = students.map((item) =>
          item.id === studentId
            ? {
                ...item,
                avatarUrl: '',
                updatedAt: new Date().toISOString(),
              }
            : item,
        )
        saveStoredStudents(students)
        render()
      }
    })
  })

  document.querySelectorAll('[data-student-form-field]').forEach((control) => {
    control.addEventListener('input', () => {
      let nextValue = control.value

      if (control.dataset.studentFormField === 'parentBirthYear') {
        nextValue = nextValue.replace(/\D/g, '').slice(0, 4)
        control.value = nextValue
      }

      studentFormState = {
        ...studentFormState,
        values: {
          ...studentFormState.values,
          [control.dataset.studentFormField]: nextValue,
        },
        errors: {
          ...studentFormState.errors,
          [control.dataset.studentFormField]: undefined,
        },
      }
      updateStudentFormSaveButton()
    })

    control.addEventListener('blur', () => {
      const fieldName = control.dataset.studentFormField

      if (fieldName === 'fatherPhone' || fieldName === 'motherPhone') {
        control.value = formatStudentPhoneNumber(control.value)
      }

      studentFormState = {
        ...studentFormState,
        values: {
          ...studentFormState.values,
          [fieldName]: control.value,
        },
        errors: validateStudentForm({
          ...studentFormState.values,
          [fieldName]: control.value,
        }),
      }
      render()
    })
  })

  document.querySelectorAll('[data-student-form-step]').forEach((button) => {
    button.addEventListener('click', () => {
      studentFormState = {
        ...studentFormState,
        step: Number(button.dataset.studentFormStep),
      }
      render()
    })
  })

  document.querySelectorAll('[data-student-parent-note-suggestion]').forEach((button) => {
    button.addEventListener('click', () => {
      const suggestion = button.dataset.studentParentNoteSuggestion
      const currentNotes = studentFormState.values.parentNotes.trim()
      const nextNotes = currentNotes ? `${currentNotes}\n${suggestion}` : suggestion

      studentFormState = {
        ...studentFormState,
        values: {
          ...studentFormState.values,
          parentNotes: nextNotes,
        },
        errors: {
          ...studentFormState.errors,
          parentNotes: undefined,
        },
      }
      render()
    })
  })

  document.querySelectorAll('[data-care-note-field]').forEach((control) => {
    control.addEventListener('input', () => {
      const studentId = control.dataset.careNoteStudentId
      careNoteDrafts = {
        ...careNoteDrafts,
        [studentId]: {
          ...(careNoteDrafts[studentId] ?? emptyCareNoteDraft),
          [control.dataset.careNoteField]: control.value,
          error: '',
        },
      }
    })
  })

  document.querySelectorAll('[data-care-note-suggestion]').forEach((button) => {
    button.addEventListener('click', () => {
      const studentId = button.dataset.careNoteStudentId
      const currentDraft = careNoteDrafts[studentId] ?? emptyCareNoteDraft
      const suggestion = button.dataset.careNoteSuggestion
      const nextContent = currentDraft.content
        ? `${currentDraft.content}\n${suggestion}`
        : suggestion

      careNoteDrafts = {
        ...careNoteDrafts,
        [studentId]: {
          ...currentDraft,
          content: nextContent,
          error: '',
        },
      }
      render()
    })
  })

  document.querySelectorAll('[data-care-note-action="clear"]').forEach((button) => {
    button.addEventListener('click', () => {
      const { careNoteStudentId } = button.dataset
      careNoteDrafts = {
        ...careNoteDrafts,
        [careNoteStudentId]: { ...emptyCareNoteDraft },
      }
      render()
    })
  })

  document.querySelectorAll('[data-care-note-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const { careNoteStudentId, careNoteId } = button.dataset
      const student = getStudentById(careNoteStudentId)
      const note = student?.careNotes?.find((item) => item.id === careNoteId)

      if (!note) {
        return
      }

      careNoteDrafts = {
        ...careNoteDrafts,
        [careNoteStudentId]: {
          content: note.content ?? '',
          tag: note.tags?.[0] ?? '',
          error: '',
          editingNoteId: note.id,
        },
      }
      render()
    })
  })

  document.querySelectorAll('[data-care-note-action="delete"]').forEach((button) => {
    button.addEventListener('click', () => {
      const { careNoteStudentId, careNoteId } = button.dataset

      if (!window.confirm('Xóa ghi chú chăm sóc này?')) {
        return
      }

      students = students.map((student) => {
        if (student.id !== careNoteStudentId) {
          return student
        }

        const nextCareNotes = (student.careNotes ?? []).filter((note) => note.id !== careNoteId)
        const latestCareNote = getLatestCareNoteContent(nextCareNotes)

        return {
          ...student,
          careNotes: nextCareNotes,
          latestCareNote,
          updatedAt: new Date().toISOString(),
        }
      })
      saveStoredStudents(students)
      careNoteDrafts = {
        ...careNoteDrafts,
        [careNoteStudentId]: { ...emptyCareNoteDraft },
      }
      render()
    })
  })

  document.querySelectorAll('[data-care-note-action="save"]').forEach((button) => {
    button.addEventListener('click', () => {
      const studentId = button.dataset.careNoteStudentId
      const currentDraft = careNoteDrafts[studentId] ?? emptyCareNoteDraft
      const content = currentDraft.content.trim()

      if (!content) {
        careNoteDrafts = {
          ...careNoteDrafts,
          [studentId]: {
            ...currentDraft,
            error: 'Nội dung ghi chú không được để trống.',
          },
        }
        render()
        return
      }

      students = students.map((student) => {
        if (student.id !== studentId) {
          return student
        }

        const currentCareNotes = student.careNotes ?? []
        const nextCareNotes = currentDraft.editingNoteId
          ? currentCareNotes.map((note) =>
              note.id === currentDraft.editingNoteId
                ? {
                    ...note,
                    content,
                    tags: currentDraft.tag.trim() ? [currentDraft.tag.trim()] : [],
                    updatedAt: new Date().toISOString(),
                  }
                : note,
            )
          : [
              {
                id: `note_${Date.now()}`,
                createdAt: new Date().toISOString(),
                author: 'Admin DreamHome',
                content,
                tags: currentDraft.tag.trim() ? [currentDraft.tag.trim()] : [],
              },
              ...currentCareNotes,
            ]

        return {
          ...student,
          careNotes: nextCareNotes,
          latestCareNote: getLatestCareNoteContent(nextCareNotes),
          updatedAt: new Date().toISOString(),
        }
      })
      saveStoredStudents(students)
      careNoteDrafts = {
        ...careNoteDrafts,
        [studentId]: { ...emptyCareNoteDraft },
      }
      render()
    })
  })

  document.querySelector('[data-student-action="use-default-avatar"]')?.addEventListener('click', () => {
    studentFormState = {
      ...studentFormState,
      values: {
        ...studentFormState.values,
        avatarUrl: '',
      },
    }
    render()
  })

  document.querySelector('[data-student-action="cancel-form"]')?.addEventListener('click', () => {
    studentFormState = null
    render()
  })

  document.querySelector('[data-student-action="save-form"]')?.addEventListener('click', () => {
    if (!isStudentFormReady(studentFormState.values)) {
      studentFormState = {
        ...studentFormState,
        errors: validateStudentForm(studentFormState.values),
      }
      render()
      return
    }

    const errors = validateStudentForm(studentFormState.values)

    if (Object.keys(errors).length) {
      studentFormState = {
        ...studentFormState,
        errors,
      }
      render()
      return
    }

    if (studentFormState.mode === 'edit') {
      const existingStudent = students.find((student) => student.id === studentFormState.studentId)
      const updatedStudent = buildStudentFromForm(studentFormState.values, existingStudent)
      students = students.map((student) =>
        student.id === updatedStudent.id ? updatedStudent : student,
      )
      studentFilters = {
        ...studentFilters,
        selectedStudentId: updatedStudent.id,
      }
    } else {
      const newStudent = buildStudentFromForm(studentFormState.values)
      students = [newStudent, ...students]
      studentFilters = {
        ...studentFilters,
        selectedStudentId: newStudent.id,
      }
    }

    saveStoredStudents(students)
    studentFormState = null
    render()
  })

  document.querySelectorAll('[data-student-id]').forEach((row) => {
    row.addEventListener('click', () => {
      studentFilters = {
        ...studentFilters,
        selectedStudentId: row.dataset.studentId,
      }
      openStudentDetailWindow(row.dataset.studentId)
    })

    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      studentFilters = {
        ...studentFilters,
        selectedStudentId: row.dataset.studentId,
      }
      openStudentDetailWindow(row.dataset.studentId)
    })
  })

  bindWindowDragging()
  bindShortcutDragging()
}

function openTuitionPackageForm(studentId) {
  const student = students.find((item) => item.id === studentId)

  if (!student) {
    return
  }

  const tuitionRecord = tuitionRecords.find((record) => record.studentId === student.id)
  tuitionFormState = tuitionRecord
    ? createEditTuitionFormState(student, tuitionRecord)
    : createEmptyTuitionFormState(student)
  tuitionPaymentFormState = null
  tuitionDetailState = null
  render()
}

function saveParentEnrollmentDraft(markReady = false) {
  if (!parentConsultationFormState || parentConsultationFormState.mode !== 'edit') {
    return
  }

  const existingContact = parentConsultations.find(
    (contact) => contact.id === parentConsultationFormState.contactId,
  )

  if (!existingContact) {
    return
  }

  const errors = markReady
    ? validateEnrollmentReadyDraft(parentConsultationFormState.enrollmentDraft)
    : {}

  if (Object.keys(errors).length) {
    parentConsultationFormState = {
      ...parentConsultationFormState,
      enrollmentErrors: errors,
      enrollmentMessage: '',
    }
    render()
    return
  }

  const contactWithCurrentFormValues = buildParentContactFromForm(
    parentConsultationFormState.values,
    existingContact,
    students,
  )
  const updatedContact = markReady
    ? markEnrollmentReadyForParentContact(
        contactWithCurrentFormValues,
        parentConsultationFormState.enrollmentDraft,
      )
    : saveEnrollmentDraftToParentContact(
        contactWithCurrentFormValues,
        parentConsultationFormState.enrollmentDraft,
      )

  parentConsultations = parentConsultations.map((contact) =>
    contact.id === updatedContact.id ? updatedContact : contact,
  )
  saveStoredParentConsultations(parentConsultations)
  parentConsultationFormState = {
    ...createEditParentContactFormState(updatedContact),
    enrollmentMessage: markReady
      ? 'Đã đánh dấu sẵn sàng đăng ký.'
      : 'Đã lưu bản nháp đăng ký.',
  }
  render()
}

function createRenewedTuitionRecord(currentRecord, normalizedValues) {
  const renewedAt = new Date().toISOString()
  const currentTermNumber = currentRecord.currentTermNumber || 1
  const nextTermNumber = currentTermNumber + 1
  const currentDebtAmount = getTuitionDebtAmount(currentRecord)
  const archivedStatus =
    currentRecord.usedSessions >= currentRecord.totalSessions && currentDebtAmount === 0
      ? 'completed'
      : 'archived'
  const currentTermSnapshot = {
    id: currentRecord.currentTermId || `term-${currentRecord.id}-${currentTermNumber}`,
    termNumber: currentTermNumber,
    packageName: currentRecord.packageName,
    totalSessions: currentRecord.totalSessions,
    usedSessions: currentRecord.usedSessions,
    totalAmount: currentRecord.totalAmount,
    discountType:
      currentRecord.discountType === 'fixed'
        ? 'amount'
        : currentRecord.discountType || (currentRecord.discountAmount > 0 ? 'amount' : 'none'),
    discountValue: currentRecord.discountValue ?? currentRecord.discountAmount ?? 0,
    discountAmount: currentRecord.discountAmount || 0,
    paidAmount: currentRecord.paidAmount,
    dueDate: currentRecord.dueDate,
    note: currentRecord.note,
    status: archivedStatus,
    startedAt: currentRecord.startedAt || '',
    endedAt: renewedAt,
    payments: currentRecord.payments ?? [],
  }
  const nextTermId = `term-${currentRecord.id}-${nextTermNumber}-${Date.now()}`
  const initialPayment = normalizedValues.paidAmount > 0
    ? {
        id: `payment-${nextTermId}-initial`,
        amount: normalizedValues.paidAmount,
        paidAt: renewedAt.slice(0, 10),
        method: 'cash',
        collectorName: 'Admin DreamHome',
        note: 'Đóng ban đầu khi tạo kỳ mới.',
        createdAt: renewedAt,
      }
    : null

  return {
    ...currentRecord,
    ...normalizedValues,
    currentTermNumber: nextTermNumber,
    currentTermId: nextTermId,
    startedAt: renewedAt,
    payments: initialPayment ? [initialPayment] : [],
    termHistory: [...(currentRecord.termHistory ?? []), currentTermSnapshot],
  }
}

function bindNotificationOutsidePointer() {
  if (notificationOutsidePointerBound) {
    return
  }

  document.addEventListener('pointerdown', (event) => {
    if (!isNotificationCenterOpen) {
      return
    }

    const target = event.target

    if (
      target.closest?.('.notification-center') ||
      target.closest?.('[data-action="toggle-notifications"]')
    ) {
      return
    }

    isNotificationCenterOpen = false
    render()
  })
  notificationOutsidePointerBound = true
}

function getNotificationPanelPosition(bellButton) {
  const bellRect = bellButton.getBoundingClientRect()
  const panelWidth = Math.min(420, Math.max(320, window.innerWidth - 24))
  const right = Math.max(12, window.innerWidth - bellRect.right)
  const maxRight = Math.max(12, window.innerWidth - panelWidth - 12)
  const bottom = Math.max(56, window.innerHeight - bellRect.top + 8)

  return {
    right: Math.min(right, maxRight),
    bottom,
  }
}

function getUnreadNotificationCount() {
  return notifications.filter((notification) => !notification.read).length
}

function syncTuitionNotifications(currentNotifications) {
  const deletedIds = new Set(deletedNotificationIds)
  const candidateTuitionNotifications = buildTuitionRows(students, tuitionRecords)
    .map((row) => createTuitionWarningNotification(row))
    .filter(Boolean)
  const currentTuitionWarningIds = new Set(candidateTuitionNotifications.map((notification) => notification.id))
  const retainedNotifications = currentNotifications.filter(
    (notification) =>
      !String(notification.id).startsWith('tuition-warning-') ||
      currentTuitionWarningIds.has(notification.id),
  )
  const existingNotificationIds = new Set(retainedNotifications.map((notification) => notification.id))
  const tuitionNotifications = candidateTuitionNotifications
    .filter(
      (notification) =>
        notification &&
        !existingNotificationIds.has(notification.id) &&
        !deletedIds.has(notification.id),
    )

  if (!tuitionNotifications.length && retainedNotifications.length === currentNotifications.length) {
    return currentNotifications
  }

  const nextNotifications = [...tuitionNotifications, ...retainedNotifications]
  saveStoredNotifications(nextNotifications)
  return nextNotifications
}

function markNotificationRead(notificationId) {
  const targetNotification = notifications.find((notification) => notification.id === notificationId)

  if (!targetNotification || targetNotification.read) {
    return
  }

  notifications = notifications.map((notification) =>
    notification.id === notificationId ? { ...notification, read: true } : notification,
  )
  saveStoredNotifications(notifications)
  render()
}

function getNotificationSourceLabel(sourceModule) {
  const sourceLabels = {
    system: 'Hệ thống',
    'hoc-phi': 'Học phí',
    'hoc-vien': 'Học viên demo',
    schedule: 'Lịch học demo',
    inventory: 'Kho demo',
    report: 'Báo cáo demo',
  }

  return sourceLabels[sourceModule] ?? sourceModule
}

function formatNotificationTime(createdAt) {
  const createdDate = new Date(createdAt)
  const elapsedMs = Date.now() - createdDate.getTime()
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000))

  if (elapsedMinutes < 1) {
    return 'Vừa xong'
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} phút trước`
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60)

  if (elapsedHours < 24) {
    return `${elapsedHours} giờ trước`
  }

  return createdDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function bindShortcutDragging() {
  document.querySelectorAll('[data-shortcut-id]').forEach((shortcut) => {
    shortcut.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return
      }

      shortcutDragState = {
        id: shortcut.dataset.shortcutId,
        startX: event.clientX,
        startY: event.clientY,
        isDragging: false,
        dropTargetId: null,
      }
    })
  })

  if (!shortcutDocumentDragBound) {
    document.addEventListener('pointermove', handleShortcutPointerMove)
    document.addEventListener('pointerup', handleShortcutPointerUp)
    shortcutDocumentDragBound = true
  }
}

function handleShortcutPointerMove(event) {
  if (!shortcutDragState) {
    return
  }

  const distanceX = Math.abs(event.clientX - shortcutDragState.startX)
  const distanceY = Math.abs(event.clientY - shortcutDragState.startY)

  if (!shortcutDragState.isDragging && distanceX + distanceY < 8) {
    return
  }

  shortcutDragState.isDragging = true
  suppressNextModuleClick = true

  const draggedShortcut = document.querySelector(
    `[data-shortcut-id="${shortcutDragState.id}"]`,
  )
  draggedShortcut?.classList.add('dragging')

  document.querySelector('.module-list')?.classList.add('drag-active')
  document.querySelectorAll('[data-shortcut-id]').forEach((shortcut) => {
    shortcut.classList.remove('drop-target')
  })

  const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY)
  const targetShortcut = elementUnderPointer?.closest('[data-shortcut-id]')
  const targetId = targetShortcut?.dataset.shortcutId

  shortcutDragState.dropTargetId =
    targetId && targetId !== shortcutDragState.id ? targetId : null

  if (shortcutDragState.dropTargetId) {
    targetShortcut.classList.add('drop-target')
  }
}

function handleShortcutPointerUp() {
  if (!shortcutDragState) {
    return
  }

  const { id, isDragging, dropTargetId } = shortcutDragState

  document.querySelector('.module-list')?.classList.remove('drag-active')
  document.querySelectorAll('[data-shortcut-id]').forEach((shortcut) => {
    shortcut.classList.remove('dragging', 'drop-target')
  })

  shortcutDragState = null

  if (!isDragging) {
    return
  }

  suppressModuleClickOnce()

  if (dropTargetId) {
    moveShortcutBefore(id, dropTargetId)
  }
}

function suppressModuleClickOnce() {
  suppressNextModuleClick = true

  setTimeout(() => {
    suppressNextModuleClick = false
  }, 0)
}

function moveShortcutBefore(draggedId, targetId) {
  const orderWithoutDragged = desktopModuleOrder.filter((moduleId) => moduleId !== draggedId)
  const targetIndex = orderWithoutDragged.indexOf(targetId)

  if (targetIndex === -1) {
    return
  }

  orderWithoutDragged.splice(targetIndex, 0, draggedId)
  desktopModuleOrder = orderWithoutDragged
  saveDesktopModuleOrder(desktopModuleOrder)
  render()
}

function updateStudentFormSaveButton() {
  const saveButton = document.querySelector('[data-student-action="save-form"]')

  if (!saveButton || !studentFormState) {
    return
  }

  saveButton.disabled = !isStudentFormReady(studentFormState.values)
}

function bindWindowDragging() {
  document.querySelectorAll('[data-drag-window-id]').forEach((titlebar) => {
    titlebar.addEventListener('pointerdown', (event) => {
      const windowId = titlebar.dataset.dragWindowId
      const windowItem = openWindows.find((item) => item.id === windowId)

      if (!windowItem || windowItem.maximized || event.target.closest('button')) {
        return
      }

      event.preventDefault()
      focusWindow(windowId)
      const focusedWindow = openWindows.find((item) => item.id === windowId)
      const draggedWindow = document.querySelector(`[data-window-id="${windowId}"]`)

      if (focusedWindow && draggedWindow) {
        draggedWindow.style.zIndex = focusedWindow.zIndex
      }

      const startX = event.clientX
      const startY = event.clientY
      const startWindowX = windowItem.x
      const startWindowY = windowItem.y

      function handlePointerMove(moveEvent) {
        const desktopBounds = document.querySelector('.desktop-area').getBoundingClientRect()
        const nextX = startWindowX + moveEvent.clientX - startX
        const nextY = startWindowY + moveEvent.clientY - startY
        const maxX = Math.max(8, desktopBounds.width - windowItem.width - 8)
        const maxY = Math.max(8, desktopBounds.height - windowItem.height - 8)
        const clampedX = Math.min(Math.max(8, nextX), maxX)
        const clampedY = Math.min(Math.max(8, nextY), maxY)
        const windowElement = document.querySelector(`[data-window-id="${windowId}"]`)

        if (windowElement) {
          windowElement.style.left = `${clampedX}px`
          windowElement.style.top = `${clampedY}px`
        }

        openWindows = openWindows.map((item) =>
          item.id === windowId ? { ...item, x: clampedX, y: clampedY } : item,
        )
      }

      function handlePointerUp() {
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
      }

      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
    })
  })
}

function updateClock() {
  const clock = document.querySelector('#taskbar-clock')

  if (!clock) {
    return
  }

  const now = new Date()
  const date = now.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const time = now.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  clock.dateTime = now.toISOString()
  clock.textContent = `${date} ${time}`
}

render()
initializeSupabaseAuth()

if (window.__ichessClockTimer) {
  clearInterval(window.__ichessClockTimer)
}

window.__ichessClockTimer = setInterval(updateClock, 1000)
