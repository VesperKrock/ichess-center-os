import './styles.css'
import { resolveAppCenterBinding } from './app-center-binding.js'
import { renderAppAuthEntry } from './app-auth.js'
import { isDashboardUnlockedByCenter } from './app-login-gate.js'
import { modules } from './modules.js'
import { createInitialCloudStatus } from './cloud-status.js'
import {
  getCurrentSupabaseUser,
  onSupabaseAuthStateChange,
  PRODUCTION_CENTER_ID,
  resolveActiveCenterMembership,
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
  getMemberProfileMap,
  updateMyCenterMemberProfile,
} from './member-profiles.js'
import {
  createTransactionImageSignedUrl,
  deleteTransactionImageObject,
  uploadTransactionImageBlob,
} from './supabase-storage.js'
import { getUploaderDisplayName } from './uploader-display.js'
import {
  getDeletedNotificationIds,
  getCurrentStorageCenterId,
  getDesktopModuleOrder,
  getStoredCashflow,
  getStoredCashflowCategories,
  getStoredCashbookReconciliations,
  getStoredCashbookSettings,
  getStoredInventory,
  getStoredInventoryMovements,
  getStoredInventoryRequests,
  getStoredNotifications,
  getStoredParentConsultations,
  getStoredSchedule,
  getStoredSessionReports,
  getStoredAttendanceAdvisoryNotes,
  getStoredAttendanceBoardNotes,
  getStoredClassSessions,
  getStoredStudents,
  getStoredTeachers,
  getStoredTuition,
  getViewMode,
  createCloudDbPullBackup,
  saveDeletedNotificationIds,
  saveDesktopModuleOrder,
  setCurrentStorageCenterId,
  saveStoredCashflow,
  saveStoredCashflowCategories,
  saveStoredCashbookReconciliations,
  saveStoredCashbookSettings,
  saveStoredInventory,
  saveStoredInventoryMovements,
  saveStoredInventoryRequests,
  saveStoredNotifications,
  saveStoredParentConsultations,
  saveStoredSchedule,
  saveStoredSessionReports,
  saveStoredAttendanceAdvisoryNotes,
  saveStoredAttendanceBoardNotes,
  saveStoredClassSessions,
  saveStoredStudents,
  saveStoredTeachers,
  saveStoredTuition,
  saveViewMode,
} from './storage.js'
import { sampleClassSessions } from './class-session-data.js'
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
import { renderFinanceWorkspaceModule } from './finance-workspace-module.js'
import { sampleInventoryItems } from './inventory-data.js'
import { sampleInventoryRequests } from './inventory-request-data.js'
import { sampleParentConsultations } from './parent-consultation-data.js'
import {
  addCareLogToParentContact,
  addAppointmentToParentContact,
  addQuickNoteToParentContact,
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
  buildInventoryRequestFromForm,
  createEditInventoryFormState,
  createEmptyInventoryFormState,
  createEmptyInventoryRequestFormState,
  createInventoryMovementFormState,
  createInventoryRequestStatusFormState,
  initialInventoryFilters,
  initialInventoryMovementFilters,
  initialInventoryRequestFilters,
  renderInventoryModule,
  renderInventoryMovementsWindow,
  validateInventoryForm,
  validateInventoryMovementForm,
  validateInventoryRequestForm,
  validateInventoryRequestStatusForm,
  updateInventoryRequestStatus,
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
import {
  buildInventoryRequestNotificationCandidates,
  buildParentFollowupNotificationCandidates,
  buildTuitionNotificationCandidates,
  filterNotifications,
  getUnreadNotificationCount as countUnreadNotifications,
  getUnreadNotificationCountsByModule,
  markNotificationReadById,
  markNotificationsReadByIds,
  notificationSourceLabels,
  upsertNotificationCandidates,
} from './notification-center.js'
import {
  initialAttendanceBoardFilters,
  removeDemoAttendanceReports,
  renderAttendanceBoardModule,
} from './attendance-board-module.js'
import {
  clearInitialBaselineAttendanceRecordsInMonth,
  createInitialBaselineEditSnapshot,
  buildUnifiedAttendanceRecords,
  isDateInBaselineEditableRange,
  loadAttendanceBaselineState,
  loadStoredAttendanceRecords,
  lockAttendanceBaselineState,
  parseInitialBaselineCellInput,
  removeInitialBaselineAttendanceRecord,
  restoreInitialBaselineEditSnapshot,
  saveAttendanceBaselineState,
  saveAttendanceBaselineDraftState,
  saveStoredAttendanceRecords,
  startAttendanceBaselineDraft,
  unlockAttendanceBaselineState,
  upsertAdminAttendanceRecords,
  upsertInitialBaselineAttendanceRecord,
  upsertTeacherAttendanceRecords,
} from './attendance-records.js'
import {
  buildReportDownloadText,
  buildReportPrintHtml,
  createInitialReportState,
  getReportDownloadFilename,
  getWeekStartDate,
  renderReportModule,
} from './report-module.js'
import {
  initialStaffFilters,
  renderStaffModule,
} from './staff-module.js'
import {
  ANGEL_WINGS_DATASET_ID,
  ANGEL_WINGS_IMPORT_BATCH_ID,
  ANGEL_WINGS_SOURCE_TAG,
  ANGEL_WINGS_TEACHER_ID,
  createF15K5BackupSnapshot,
  mergeAngelWingsTeacherRoster,
  removeAngelWingsAttendanceData,
  removeLegacyDemoAttendanceReports,
  upsertAngelWingsAttendanceData,
  writeAngelWingsPackageCatalog,
} from './attendance-board-angel-wings-data.js'
import {
  checkCloudDbReadiness,
  createEmptyCloudEntityCounts,
  getCloudEntityCounts,
  pullCloudBootstrapCoreEntities,
  pullCoreEntitiesFromCloud,
  pushLocalCoreEntitiesToCloud,
} from './cloud-db-sync.js'
import {
  CLOUD_BOOTSTRAP_STATUS,
  canRunCloudBootstrap,
  createInitialCloudBootstrapState,
  getCloudBootstrapSnapshotCounts,
  getCloudBootstrapStatusLabel,
  hasCloudBootstrapSnapshotData,
} from './cloud-bootstrap.js'
import { CLOUD_ENTITY_TYPES } from './cloud-db-entities.js'
import {
  NEEDS_SUPABASE_REALTIME_PATCH,
  mergeRealtimeStudentIntoList,
  subscribeToStudentCloudRealtime,
  upsertStudentCloudEntity,
} from './cloud-realtime-students.js'
import {
  mergeRealtimeTeacherIntoList,
  subscribeToTeacherCloudRealtime,
  upsertTeacherCloudEntity,
} from './cloud-realtime-teachers.js'
import {
  mergeScheduleSessionRealtimePayload,
  subscribeToScheduleSessionCloudRealtime,
  upsertScheduleSessionCloudEntity,
} from './cloud-realtime-schedule-sessions.js'
import { backfillLocalScheduleSessionsToCloud } from './cloud-schedule-session-backfill.js'
import {
  C51_ATTENDANCE_REALTIME_ENTITY_TYPES,
  C51_TEACHER_CONSULTANT_WRITE_HOLD,
  canWriteC51AttendanceEntity,
  mergeC51CloudRecordsIntoLocal,
  pullC51AttendanceSessionReportCloudEntities,
  subscribeToC51AttendanceSessionReportRealtime,
  upsertC51AttendanceSessionReportCloudEntities,
} from './cloud-attendance-realtime.js'
import {
  C52_TEACHER_CONSULTANT_WRITE_HOLD,
  canWriteC52TuitionRecordPackageEntity,
  createTuitionRecordPackageLocalId,
  mergeC52TuitionCloudRecordsIntoLocal,
  pullC52TuitionRecordPackageCloudEntities,
  subscribeToC52TuitionRecordPackageRealtime,
  upsertC52TuitionRecordPackageCloudEntities,
} from './cloud-tuition-record-package-bridge.js'
import {
  getChangedFields,
  writeC53AuditLogEntry,
} from './cloud-audit-log.js'
import {
  buildRollbackPreviewFromAuditEntry,
  loadAuditEntriesForEntity,
} from './cloud-rollback-preview.js'
import { buildScheduleSessionBridgePreview } from './cloud-schedule-session-bridge.js'
import {
  buildOnlineAccessState,
  canWriteEntity,
  getOnlineAccessMessage,
} from './online-access-control.js'
import { sampleStudents, shouldReplaceLegacyEightSeed } from './student-data.js'
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
  buildSettingsClassSessionFromForm,
  createEditSettingsClassSessionFormState,
  createEmptySettingsClassSessionFormState,
  getClassSessionStudentCount,
  initialSettingsFilters,
  renderSettingsModule,
  validateSettingsClassSessionForm,
} from './settings-module.js'
import {
  buildTuitionRows,
  createEditTuitionFormState,
  createEmptyTuitionFormState,
  createPaymentFormState,
  createRenewTuitionFormState,
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

const preservedScrollTargets = [
  ['.window-body', 'window-body'],
  ['.student-table-wrap', 'student-table'],
  ['.student-form-scroll', 'student-form'],
  ['.student-detail-overview', 'student-detail'],
  ['.student-care-history-panel .care-note-list', 'student-care-history'],
  ['.student-care-form', 'student-care-form'],
  ['.student-learning-window', 'student-learning'],
  ['.parent-consultation-table-wrap', 'parent-table'],
  ['.parent-note-history-list', 'parent-note-history'],
  ['.parent-student-picker-results', 'parent-student-picker'],
  ['.teacher-table-wrap', 'teacher-table'],
  ['.teacher-form-grid', 'teacher-form'],
  ['.teacher-profile-grid', 'teacher-profile'],
  ['.teacher-profile-pane', 'teacher-profile-pane'],
  ['.teacher-update-table-wrap', 'teacher-update-table'],
  ['.schedule-week-scroll', 'schedule-week'],
  ['.tuition-table-wrap', 'tuition-table'],
  ['.tuition-advisory-table-wrap', 'tuition-advisory'],
  ['.tuition-form-panel', 'tuition-form'],
  ['.cashflow-table-wrap', 'cashflow-table'],
  ['.cashflow-form-panel', 'cashflow-form'],
  ['.cashflow-category-panel', 'cashflow-category-panel'],
  ['.cashflow-category-list', 'cashflow-category-list'],
  ['.cashbook-table-wrap', 'cashbook-table'],
  ['.report-module', 'report-module'],
  ['.inventory-table-wrap', 'inventory-table'],
  ['.inventory-history-panel .inventory-movement-history', 'inventory-movement-history'],
  ['.inventory-history-panel .inventory-history-list', 'inventory-history-list'],
  ['.inventory-form-panel', 'inventory-form'],
  ['.inventory-request-table-wrap', 'inventory-request-table'],
  ['.inventory-request-panel', 'inventory-request-panel'],
  ['.settings-class-session-table-wrap', 'settings-class-session-table'],
  ['.attendance-board-sheet-wrap', 'attendance-board-sheet'],
]
const preservedScrollSelector = preservedScrollTargets.map(([selector]) => selector).join(',')
const lastKnownPreservedScrollPositions = new Map()

let currentViewMode = getViewMode()
let isStartMenuOpen = false
let isWindowOverflowOpen = false
let isNotificationCenterOpen = false
let isCenterProfilePopoverOpen = false
let notificationPanelPosition = { right: 12, bottom: 56 }
let openWindows = []
let nextWindowNumber = 1
let topZIndex = 20
let desktopModuleOrder = getDesktopModuleOrder(modules.map((moduleItem) => moduleItem.id))
let shortcutDragState = null
let suppressNextModuleClick = false
let shortcutDocumentDragBound = false
let startMenuOutsidePointerBound = false
let windowOverflowOutsidePointerBound = false
let notificationOutsidePointerBound = false
let centerProfileOutsidePointerBound = false
let moduleNotificationOutsidePointerBound = false
let studentFilters = { ...initialStudentFilters }
let students = getStoredStudents(sampleStudents)
if (shouldReplaceLegacyEightSeed(students)) {
  students = sampleStudents
  saveStoredStudents(students)
}
let classSessions = getStoredClassSessions(sampleClassSessions)
let teacherFilters = { ...initialTeacherFilters }
let teachers = getStoredTeachers(sampleTeachers)
let teacherFormState = null
let selectedTeacherId = null
let parentConsultationFilters = { ...initialParentConsultationFilters }
let parentConsultations = getStoredParentConsultations(sampleParentConsultations)
let parentConsultationFormState = null
let skipNextParentContactScrollCapture = false
let parentQuickNoteState = null
let parentNoteHistoryContactId = null
let staffFilters = { ...initialStaffFilters }
let scheduleSessions = getStoredSchedule(sampleScheduleSessions)
let sessionReports = getStoredSessionReports()
let attendanceAdvisoryNotes = getStoredAttendanceAdvisoryNotes()
let attendanceBoardNotes = getStoredAttendanceBoardNotes()
let attendanceBaselineUndoSnapshot = null
let attendanceBaselineDraftRecords = null
let attendanceBaselineDraftBaseRecords = null
let attendanceBaselineDraftState = null
let pendingAttendanceBaselineCellFocus = null
let scheduleFormState = null
let scheduleReportState = null
let scheduleAdminAttendanceState = null
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
let notificationFilters = { sourceModule: 'all', readState: 'unread' }
let attendanceBoardFilters = { ...initialAttendanceBoardFilters }
let attendanceBoardDetailState = null
let attendanceBoardNoteFormState = null
const normalizedTeacherRoster = mergeAngelWingsTeacherRoster(teachers, students)
if (JSON.stringify(normalizedTeacherRoster) !== JSON.stringify(teachers)) {
  teachers = normalizedTeacherRoster
  saveStoredTeachers(teachers)
}
let studentFormState = null
let settingsFilters = { ...initialSettingsFilters }
let settingsClassSessionFormState = null
let tuitionFilters = { ...initialTuitionFilters }
let tuitionFormState = null
let tuitionPaymentFormState = null
let tuitionDetailState = null
let tuitionRollbackPreviewState = null
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
let inventoryRequests = getStoredInventoryRequests(sampleInventoryRequests)
notifications = syncAppNotifications(notifications)
let activeNotificationDataCenterId = getCurrentStorageCenterId()
let inventoryFilters = { ...initialInventoryFilters }
let inventoryMovementFilters = { ...initialInventoryMovementFilters }
let inventoryRequestFilters = { ...initialInventoryRequestFilters }
let inventoryFormState = null
let inventoryMovementFormState = null
let inventoryRequestFormState = null
let inventoryRequestStatusFormState = null
let selectedInventoryMovementId = null
let selectedInventoryRequestId = null
let isInventoryHistoryPanelOpen = false
let isInventoryRequestsPanelOpen = false
let reportState = createInitialReportState()
let careNoteDrafts = {}
let cloudStatus = createInitialCloudStatus(getSupabaseConfigStatus().status)
let cloudDbState = createInitialCloudDbState()
let cloudBootstrapState = createInitialCloudBootstrapState()
let cloudUserSyncId = 0
let cloudDbAutoPullUserId = ''
let cloudLastSyncedUserId = ''
let cloudBootstrapRetryBlockedUntil = 0
let cloudBootstrapLastFailureSignature = ''
let coreCloudSyncTimer = null
let coreCloudSyncRunId = 0
let studentRealtimeSubscription = null
let studentRealtimeCenterId = ''
let studentCloudWriteRunId = 0
let teacherRealtimeSubscription = null
let teacherRealtimeCenterId = ''
let teacherCloudWriteRunId = 0
let scheduleSessionRealtimeSubscription = null
let scheduleSessionRealtimeCenterId = ''
let scheduleSessionCloudWriteRunId = 0
let c51AttendanceRealtimeSubscription = null
let c51AttendanceRealtimeCenterId = ''
let c51AttendanceCloudWriteRunId = 0
let c51AttendanceAutoPullUserId = ''
let c52TuitionRealtimeSubscription = null
let c52TuitionRealtimeCenterId = ''
let c52TuitionCloudWriteRunId = 0
let c52TuitionAutoPullUserId = ''
let cloudUploadingTransactionId = null
let transactionImageManagerState = null
let cloudGalleryState = null
let activeLocalDataCenterId = getCurrentStorageCenterId()

function getCurrentResolvedCenterId() {
  const binding = resolveAppCenterBinding(cloudStatus)
  return binding.currentCenterId || getCurrentStorageCenterId()
}

function isProductionCenter(centerId = getCurrentResolvedCenterId()) {
  return centerId === PRODUCTION_CENTER_ID
}

function canRenderCenterScopedModuleBadges() {
  const storageCenterId = getCurrentStorageCenterId()

  if (cloudStatus.authStatus === 'signed-in') {
    const binding = resolveAppCenterBinding(cloudStatus)

    return Boolean(binding.currentCenterId) &&
      binding.status === 'bound' &&
      activeLocalDataCenterId === binding.currentCenterId &&
      activeNotificationDataCenterId === binding.currentCenterId &&
      storageCenterId === binding.currentCenterId
  }

  return activeLocalDataCenterId === storageCenterId && activeNotificationDataCenterId === storageCenterId
}

function getCenterScopedNotificationsForRender() {
  return canRenderCenterScopedModuleBadges() ? notifications : []
}

function resetTransientStateForCenterSwitch() {
  studentFilters = { ...initialStudentFilters }
  teacherFilters = { ...initialTeacherFilters }
  parentConsultationFilters = { ...initialParentConsultationFilters }
  staffFilters = { ...initialStaffFilters }
  settingsFilters = { ...initialSettingsFilters }
  tuitionFilters = { ...initialTuitionFilters }
  cashflowFilters = { ...initialCashflowFilters }
  inventoryFilters = { ...initialInventoryFilters }
  inventoryMovementFilters = { ...initialInventoryMovementFilters }
  inventoryRequestFilters = { ...initialInventoryRequestFilters }
  studentFormState = null
  teacherFormState = null
  selectedTeacherId = null
  parentConsultationFormState = null
  parentQuickNoteState = null
  parentNoteHistoryContactId = null
  scheduleFormState = null
  scheduleReportState = null
  scheduleAdminAttendanceState = null
  sessionReportAttendanceState = null
  sessionReportLearningState = null
  sessionReportLearningFormState = null
  sessionReportExtraState = null
  sessionReportGuestFormState = null
  tuitionFormState = null
  tuitionPaymentFormState = null
  tuitionDetailState = null
  tuitionRollbackPreviewState = null
  cashflowFormState = null
  cashbookSettingsFormState = null
  cashbookReconciliationFormState = null
  inventoryFormState = null
  inventoryMovementFormState = null
  inventoryRequestFormState = null
  inventoryRequestStatusFormState = null
  attendanceBoardDetailState = null
  attendanceBoardNoteFormState = null
}

function reloadLocalDataForResolvedCenter({ useSampleFallback = false } = {}) {
  const nextStudents = getStoredStudents(useSampleFallback ? sampleStudents : [])
  students = shouldReplaceLegacyEightSeed(nextStudents) && useSampleFallback
    ? sampleStudents
    : nextStudents
  if (students === sampleStudents) {
    saveStoredStudents(students)
  }
  classSessions = getStoredClassSessions(useSampleFallback ? sampleClassSessions : [])
  teachers = getStoredTeachers(useSampleFallback ? sampleTeachers : [])
  parentConsultations = getStoredParentConsultations(
    useSampleFallback ? sampleParentConsultations : [],
  )
  scheduleSessions = getStoredSchedule(useSampleFallback ? sampleScheduleSessions : [])
  sessionReports = getStoredSessionReports([])
  attendanceAdvisoryNotes = getStoredAttendanceAdvisoryNotes([])
  attendanceBoardNotes = getStoredAttendanceBoardNotes([])
  tuitionRecords = getStoredTuition(useSampleFallback ? createSampleTuitionRecords(students) : [])
  cashflowTransactions = getStoredCashflow(useSampleFallback ? sampleCashflowTransactions : [])
  cashflowCategories = getStoredCashflowCategories(useSampleFallback ? sampleCashflowCategories : [])
  cashbookSelectedDate = getDefaultCashbookDate(cashflowTransactions)
  cashbookSettings = getStoredCashbookSettings(createDefaultCashbookSettings(cashflowTransactions))
  cashbookReconciliations = getStoredCashbookReconciliations([])
  inventoryItems = getStoredInventory(useSampleFallback ? sampleInventoryItems : [])
  inventoryMovements = getStoredInventoryMovements([])
  inventoryRequests = getStoredInventoryRequests(useSampleFallback ? sampleInventoryRequests : [])
  notifications = syncAppNotifications(
    getStoredNotifications(useSampleFallback ? createSampleNotifications() : []),
  )
  deletedNotificationIds = getDeletedNotificationIds()
  activeLocalDataCenterId = getCurrentStorageCenterId()
  activeNotificationDataCenterId = getCurrentStorageCenterId()
  resetTransientStateForCenterSwitch()
}

function render() {
  const preservedScrollState = rememberPreservedScrollPositions()
  const scheduleReportScrollState = getScheduleReportScrollState()
  const scheduleFormScrollState = getScheduleFormScrollState()
  const parentContactFormScrollTop = getParentContactFormScrollTop()
  const currentCenterBinding = resolveAppCenterBinding(cloudStatus)
  const isLoginGateOpen = !isDashboardUnlockedByCenter(cloudStatus, currentCenterBinding)

  if (
    parentConsultationFormState &&
    parentContactFormScrollTop !== null &&
    !skipNextParentContactScrollCapture
  ) {
    parentConsultationFormState = {
      ...parentConsultationFormState,
      scrollTop: parentContactFormScrollTop,
    }
  }

  app.innerHTML = `
    <div class="app-shell ${isLoginGateOpen ? 'is-login-gated' : ''}">
      <main class="desktop-area ${isLoginGateOpen ? 'is-login-gated' : ''}">
        ${isLoginGateOpen ? renderAppAuthEntry(cloudStatus, currentCenterBinding) : ''}
        ${isLoginGateOpen ? '' : renderDashboard()}
        <div class="window-layer" aria-label="Các cửa sổ đang mở">
          ${isLoginGateOpen ? '' : renderOpenWindows()}
        </div>
      </main>
      ${isLoginGateOpen ? '' : renderTaskbar()}
      ${isLoginGateOpen ? '' : renderSystemOverlay()}
    </div>
  `

  bindEvents()
  restoreScheduleReportScrollState(scheduleReportScrollState)
  restoreScheduleFormScrollState(scheduleFormScrollState)
  restoreParentContactFormScrollTop()
  restorePreservedScrollPositions(preservedScrollState)
  focusPendingAttendanceBaselineCell()
  skipNextParentContactScrollCapture = false
  updateClock()
}

function getBaselineInputFocusTarget(input) {
  if (!input) {
    return null
  }

  const rowIndex = Number.parseInt(input.dataset.rowIndex || '', 10)
  const columnIndex = Number.parseInt(input.dataset.columnIndex || '', 10)

  if (!Number.isFinite(rowIndex) || !Number.isFinite(columnIndex)) {
    return null
  }

  return { rowIndex, columnIndex }
}

function focusPendingAttendanceBaselineCell() {
  if (!pendingAttendanceBaselineCellFocus) {
    return
  }

  const { rowIndex, columnIndex } = pendingAttendanceBaselineCellFocus
  pendingAttendanceBaselineCellFocus = null

  const selector =
    `[data-attendance-baseline-cell-input][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`
  const input = document.querySelector(selector)

  if (!input) {
    return
  }

  input.focus()
  input.select?.()
}

function getAttendanceBaselineNavigationTarget(input, direction) {
  const inputs = Array.from(document.querySelectorAll('[data-attendance-baseline-cell-input]'))
  const currentIndex = inputs.indexOf(input)

  if (currentIndex < 0) {
    return getBaselineInputFocusTarget(input)
  }

  if (direction === 'next' || direction === 'previous') {
    const nextIndex = direction === 'next'
      ? Math.min(currentIndex + 1, inputs.length - 1)
      : Math.max(currentIndex - 1, 0)

    return getBaselineInputFocusTarget(inputs[nextIndex])
  }

  const currentTarget = getBaselineInputFocusTarget(input)

  if (!currentTarget) {
    return null
  }

  const columnInputs = inputs
    .map((candidate) => ({
      input: candidate,
      target: getBaselineInputFocusTarget(candidate),
    }))
    .filter((candidate) =>
      candidate.target &&
      candidate.target.columnIndex === currentTarget.columnIndex,
    )
    .sort((first, second) => first.target.rowIndex - second.target.rowIndex)

  const columnIndex = columnInputs.findIndex((candidate) => candidate.input === input)

  if (columnIndex < 0) {
    return currentTarget
  }

  const nextColumnIndex = direction === 'down'
    ? Math.min(columnIndex + 1, columnInputs.length - 1)
    : Math.max(columnIndex - 1, 0)

  return getBaselineInputFocusTarget(columnInputs[nextColumnIndex].input)
}

function hasInitialBaselineAttendanceRecord(records, studentId, date) {
  return records.some(
    (record) =>
      record?.source === 'initialBaseline' &&
      String(record.studentId || '') === String(studentId || '') &&
      String(record.date || '') === String(date || ''),
  )
}

function createScheduleAdminAttendanceState(occurrence, records = loadStoredAttendanceRecords(getCurrentResolvedCenterId())) {
  const existingRecords = Array.isArray(records) ? records : []
  const rows = getScheduleAdminStudentIds(occurrence).map((studentId) => {
    const existingRecord = existingRecords.find((record) => isScheduleAdminAttendanceRecord(record, occurrence, studentId))

    return {
      studentId,
      attendanceStatus: existingRecord?.attendanceStatus || '',
      note: existingRecord?.note || '',
    }
  })

  return {
    sessionId: occurrence?.id || null,
    occurrenceDate: occurrence?.occurrenceDate || occurrence?.date || '',
    rows,
    error: '',
    saveState: '',
  }
}

function getScheduleAdminAttendanceRecords(occurrence, records = loadStoredAttendanceRecords(getCurrentResolvedCenterId())) {
  return (Array.isArray(records) ? records : [])
    .filter((record) =>
      record?.source === 'admin' &&
      String(record.date || '') === String(occurrence?.occurrenceDate || occurrence?.date || '') &&
      getScheduleAdminAttendanceSessionKey(record) === String(occurrence?.id || '').trim(),
    )
}

function getScheduleTeacherAttendanceRecords(occurrence, records = loadStoredAttendanceRecords(getCurrentResolvedCenterId())) {
  return (Array.isArray(records) ? records : [])
    .filter((record) =>
      record?.source === 'teacher' &&
      String(record.date || '') === String(occurrence?.occurrenceDate || occurrence?.date || '') &&
      getScheduleAdminAttendanceSessionKey(record) === String(occurrence?.id || '').trim(),
    )
}

function getScheduleAdminStudentIds(occurrence) {
  return (Array.isArray(occurrence?.studentIds) ? occurrence.studentIds : [])
    .map((studentId) => String(studentId || '').trim())
    .filter(Boolean)
}

function getScheduleAdminAttendanceSessionKey(record = {}) {
  return String(
    record.sessionId ||
      record.scheduleSessionId ||
      record.classSessionId ||
      '',
  ).trim()
}

function isScheduleAdminAttendanceRecord(record, occurrence, studentId) {
  const occurrenceDate = String(occurrence?.occurrenceDate || occurrence?.date || '').trim()
  return record?.source === 'admin' &&
    String(record.studentId || '') === String(studentId || '') &&
    String(record.date || '') === occurrenceDate &&
    getScheduleAdminAttendanceSessionKey(record) === String(occurrence?.id || '').trim()
}

function updateScheduleAdminAttendanceRow(studentId, patch = {}) {
  if (!scheduleAdminAttendanceState) {
    return
  }

  scheduleAdminAttendanceState = {
    ...scheduleAdminAttendanceState,
    rows: scheduleAdminAttendanceState.rows.map((row) =>
      row.studentId === studentId ? { ...row, ...patch } : row,
    ),
    error: '',
    saveState: '',
  }
}

function getScheduleAdminAttendanceOccurrence() {
  if (!scheduleReportState) {
    return null
  }

  return getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate).find(
    (item) =>
      item.id === scheduleReportState.sessionId &&
      item.occurrenceDate === scheduleReportState.occurrenceDate,
  ) || null
}

function buildScheduleAdminAttendanceInputs(occurrence, rows = []) {
  return rows
    .filter((row) => row.attendanceStatus)
    .map((row) => {
      const counted = ['present', 'makeup'].includes(row.attendanceStatus)
      return {
        studentId: row.studentId,
        date: occurrence.occurrenceDate,
        classSessionId: occurrence.classSessionId || null,
        scheduleSessionId: occurrence.id,
        sessionId: occurrence.id,
        teacherId: occurrence.teacherId || null,
        teacherName: getScheduleAdminTeacherName(occurrence),
        status: row.attendanceStatus,
        attendanceStatus: row.attendanceStatus,
        counted,
        creditNumber: null,
        creditLabel: '',
        creditValue: counted ? 1 : 0,
        source: 'admin',
        submittedByRole: 'admin',
        note: row.note || '',
        raw: {
          adminAttendance: {
            sessionTitle: occurrence.title || '',
            occurrenceDate: occurrence.occurrenceDate,
          },
        },
      }
    })
}

function buildScheduleTeacherAttendanceInputs(occurrence, rows = [], savedReport = null) {
  return rows.map((row, index) => {
    const attendanceStatus = normalizeScheduleTeacherAttendanceStatus(row.attendanceStatus)
    const counted = ['present', 'makeup'].includes(attendanceStatus)
    return {
      studentId: row.studentId,
      date: occurrence.occurrenceDate,
      classSessionId: occurrence.classSessionId || null,
      scheduleSessionId: occurrence.id,
      sessionId: occurrence.id,
      teacherId: occurrence.teacherId || null,
      teacherName: getScheduleAdminTeacherName(occurrence),
      sourceReportId: savedReport?.id || null,
      sourceAttendanceIndex: index,
      sourceCreditIndex: 0,
      status: attendanceStatus,
      attendanceStatus,
      counted,
      creditNumber: null,
      creditLabel: '',
      creditValue: counted ? 1 : 0,
      source: 'teacher',
      submittedByRole: 'teacher',
      note: row.note || '',
      raw: {
        report: savedReport ? { id: savedReport.id, sessionId: savedReport.sessionId } : null,
        attendanceItem: {
          studentId: row.studentId,
          attendanceStatus,
          note: row.note || '',
        },
      },
    }
  })
}

function normalizeScheduleTeacherAttendanceStatus(status) {
  const rawStatus = String(status || '').trim()
  if (rawStatus === 'excusedAbsent') {
    return 'excused'
  }
  if (rawStatus === 'unexcusedAbsent') {
    return 'absent'
  }
  return rawStatus || 'present'
}

function getScheduleAdminTeacherName(occurrence) {
  const teacher = teachers.find((item) => String(item.id || '') === String(occurrence?.teacherId || ''))
  return teacher?.fullName || teacher?.name || teacher?.nickname || occurrence?.teacherName || null
}

function getAttendanceBaselineDraftRecords() {
  return Array.isArray(attendanceBaselineDraftRecords)
    ? attendanceBaselineDraftRecords
    : loadStoredAttendanceRecords(getCurrentResolvedCenterId())
}

function getAttendanceBaselineDraftState() {
  return attendanceBaselineDraftState || loadAttendanceBaselineState(getCurrentResolvedCenterId())
}

function ensureAttendanceBaselineDraft() {
  if (!Array.isArray(attendanceBaselineDraftRecords)) {
    const storedRecords = loadStoredAttendanceRecords(getCurrentResolvedCenterId())
    attendanceBaselineDraftRecords = storedRecords
    attendanceBaselineDraftBaseRecords = storedRecords
    attendanceBaselineDraftState = loadAttendanceBaselineState(getCurrentResolvedCenterId())
  }

  return {
    records: attendanceBaselineDraftRecords,
    state: attendanceBaselineDraftState || loadAttendanceBaselineState(getCurrentResolvedCenterId()),
  }
}

function clearAttendanceBaselineDraft() {
  attendanceBaselineDraftRecords = null
  attendanceBaselineDraftBaseRecords = null
  attendanceBaselineDraftState = null
}

function getAttendanceBaselineDraftChangeCount() {
  if (!Array.isArray(attendanceBaselineDraftRecords)) {
    return 0
  }

  const baseRecords = Array.isArray(attendanceBaselineDraftBaseRecords)
    ? attendanceBaselineDraftBaseRecords
    : loadStoredAttendanceRecords(getCurrentResolvedCenterId())
  const baseMap = new Map(baseRecords.map((record) => [record.id, JSON.stringify(record)]))
  const draftMap = new Map(attendanceBaselineDraftRecords.map((record) => [record.id, JSON.stringify(record)]))
  let changeCount = 0

  draftMap.forEach((serializedRecord, recordId) => {
    if (baseMap.get(recordId) !== serializedRecord) {
      changeCount += 1
    }
  })

  baseMap.forEach((_, recordId) => {
    if (!draftMap.has(recordId)) {
      changeCount += 1
    }
  })

  return changeCount
}

function hasAttendanceBaselineDraftChanges() {
  return getAttendanceBaselineDraftChangeCount() > 0
}

function createAttendanceBaselineDraftUndoSnapshot() {
  return {
    type: 'draft',
    records: Array.isArray(attendanceBaselineDraftRecords)
      ? attendanceBaselineDraftRecords
      : null,
    baseRecords: Array.isArray(attendanceBaselineDraftBaseRecords)
      ? attendanceBaselineDraftBaseRecords
      : null,
    state: attendanceBaselineDraftState || null,
  }
}

function restoreAttendanceBaselineDraftUndoSnapshot(snapshot = {}) {
  attendanceBaselineDraftRecords = Array.isArray(snapshot.records) ? snapshot.records : null
  attendanceBaselineDraftBaseRecords = Array.isArray(snapshot.baseRecords) ? snapshot.baseRecords : null
  attendanceBaselineDraftState = snapshot.state || null
}

function commitAttendanceBaselineCellInput(input, { focusTarget = null } = {}) {
  const studentId = input?.dataset?.studentId || ''
  const date = input?.dataset?.dateKey || ''
  const fallbackFocusTarget = focusTarget || getBaselineInputFocusTarget(input)

  if (!studentId || !date) {
    return false
  }

  if (!isDateInBaselineEditableRange(date)) {
    pendingAttendanceBaselineCellFocus = fallbackFocusTarget
    window.alert('Ô này nằm ngoài khoảng ngày cho phép nhập dữ liệu nền.')
    render()
    return false
  }

  const parsedInput = parseInitialBaselineCellInput(input.value)

  if (!parsedInput.valid) {
    pendingAttendanceBaselineCellFocus = fallbackFocusTarget
    window.alert(parsedInput.error)
    render()
    return false
  }

  const draft = ensureAttendanceBaselineDraft()
  const currentRecords = draft.records
  const currentState = draft.state

  if (parsedInput.action === 'delete' && !hasInitialBaselineAttendanceRecord(currentRecords, studentId, date)) {
    pendingAttendanceBaselineCellFocus = fallbackFocusTarget
    render()
    return true
  }

  const snapshot = createAttendanceBaselineDraftUndoSnapshot()
  const result = parsedInput.action === 'delete'
    ? removeInitialBaselineAttendanceRecord({
        records: currentRecords,
        state: currentState,
        studentId,
        date,
        byRole: 'admin',
        byName: 'Admin cơ sở',
      })
    : upsertInitialBaselineAttendanceRecord({
        records: currentRecords,
        state: currentState,
        input: {
          ...parsedInput.input,
          studentId,
          date,
        },
        byRole: 'admin',
        byName: 'Admin cơ sở',
      })

  if (result.blocked) {
    attendanceBaselineUndoSnapshot = null
    pendingAttendanceBaselineCellFocus = fallbackFocusTarget
    window.alert(
      result.reason === 'baselineLocked'
        ? 'Dữ liệu nền đã khóa, cần mở khóa trước khi chỉnh sửa.'
        : 'Không thể lưu dữ liệu nền. Vui lòng kiểm tra giá trị vừa nhập.',
    )
    render()
    return false
  }

  attendanceBaselineUndoSnapshot = snapshot
  attendanceBaselineDraftRecords = result.records
  attendanceBaselineDraftState = result.state
  attendanceBoardDetailState = null
  pendingAttendanceBaselineCellFocus = fallbackFocusTarget
  render()
  return true
}

function rememberPreservedScrollPositions(root = app) {
  const scrollState = new Map()

  if (!root) {
    return scrollState
  }

  root.querySelectorAll(preservedScrollSelector).forEach((element) => {
    if (!isScrollableElement(element)) {
      return
    }

    const key = getPreservedScrollKey(element)

    if (!key) {
      return
    }

    scrollState.set(key, {
      left: element.scrollLeft,
      top: element.scrollTop,
    })
  })

  return scrollState
}

function restorePreservedScrollPositions(scrollState, root = app) {
  const mergedScrollState = mergePreservedScrollState(scrollState)

  if (!root || !mergedScrollState.size) {
    return
  }

  const restore = () => {
    root.querySelectorAll(preservedScrollSelector).forEach((element) => {
      const key = getPreservedScrollKey(element)
      const savedPosition = key ? mergedScrollState.get(key) : null

      if (!savedPosition) {
        return
      }

      element.scrollTop = Math.min(savedPosition.top, getMaxScrollTop(element))
      element.scrollLeft = Math.min(savedPosition.left, getMaxScrollLeft(element))
    })
  }

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      restore()
      requestAnimationFrame(restore)
    })
    return
  }

  restore()
}

function mergePreservedScrollState(scrollState) {
  const mergedScrollState = new Map(lastKnownPreservedScrollPositions)

  if (scrollState?.size) {
    scrollState.forEach((position, key) => {
      mergedScrollState.set(key, position)
    })
  }

  return mergedScrollState
}

function bindPreservedScrollRetentionEvents(root = app) {
  if (!root) {
    return
  }

  root.querySelectorAll(preservedScrollSelector).forEach((element) => {
    element.addEventListener(
      'scroll',
      () => {
        const key = getPreservedScrollKey(element)

        if (!key) {
          return
        }

        lastKnownPreservedScrollPositions.set(key, {
          left: element.scrollLeft,
          top: element.scrollTop,
        })
      },
      { passive: true },
    )
  })
}

function getPreservedScrollKey(element) {
  const windowElement = element.closest('[data-window-id]')
  const rootElement = windowElement || app
  const windowKey = windowElement?.dataset.windowId || 'app'
  const target = preservedScrollTargets.find(([selector]) => element.matches(selector))

  if (!target || !rootElement) {
    return ''
  }

  const [selector, targetName] = target
  const matchingElements = Array.from(rootElement.querySelectorAll(selector))
  const targetIndex = matchingElements.indexOf(element)

  return `${windowKey}:${targetName}:${Math.max(0, targetIndex)}`
}

function isScrollableElement(element) {
  return (
    element &&
    (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)
  )
}

function getMaxScrollTop(element) {
  return Math.max(0, element.scrollHeight - element.clientHeight)
}

function getMaxScrollLeft(element) {
  return Math.max(0, element.scrollWidth - element.clientWidth)
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

function getParentContactFormScrollTop() {
  const scrollElement = document.querySelector('[data-parent-contact-form-scroll]')
  return scrollElement ? scrollElement.scrollTop : null
}

function restoreParentContactFormScrollTop() {
  if (!parentConsultationFormState) {
    return
  }

  const scrollElement = document.querySelector('[data-parent-contact-form-scroll]')

  if (scrollElement) {
    scrollElement.scrollTop = parentConsultationFormState.scrollTop || 0
  }
}

function renderDashboard() {
  const unreadCountsByModule = canRenderCenterScopedModuleBadges()
    ? getUnreadNotificationCountsByModule(getCenterScopedNotificationsForRender())
    : {}
  const moduleButtons = getOrderedModules()
    .map(
      (moduleItem) => {
        const unreadCount = unreadCountsByModule[moduleItem.id] || 0

        return `
          <button
            class="module-button designer-theme-hook"
            type="button"
            data-module-id="${moduleItem.id}"
            data-shortcut-id="${moduleItem.id}"
            data-module-title="${escapeAttribute(moduleItem.name)}"
            data-designer-hook="module-card"
          >
            <span class="module-card-icon-slot designer-image-slot" aria-hidden="true"></span>
            <span class="module-card-label">${moduleItem.name}</span>
            <span class="module-card-visual-slot module-visual-placeholder" aria-hidden="true"></span>
            ${
              unreadCount
                ? `<span class="module-notification-badge" aria-label="${unreadCount} thông báo chưa đọc">${unreadCount}</span>`
                : ''
            }
          </button>
        `
      },
    )
    .join('')

  return `
    <section class="dashboard" aria-labelledby="dashboard-title">
      <h1 class="sr-only" id="dashboard-title">Desktop DreamHome</h1>
      <div class="desktop-surface">
        <div class="center-brand-slot designer-theme-hook" data-designer-hook="center-brand" aria-hidden="true">
          <span class="center-logo-slot designer-image-slot"></span>
          <span class="center-banner-slot designer-image-slot"></span>
        </div>
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
      class="desktop-window designer-theme-hook ${windowItem.maximized ? 'maximized' : ''}"
      style="${style}"
      data-window-id="${windowItem.id}"
      data-module-id="${escapeAttribute(windowItem.moduleId || '')}"
      data-module-title="${escapeAttribute(headerTitle)}"
      data-designer-hook="module-window"
      aria-labelledby="${windowItem.id}-title"
    >
      <div class="window-titlebar" data-drag-window-id="${windowItem.id}">
        <span class="module-window-hero-slot designer-image-slot" aria-hidden="true"></span>
        <h2 id="${windowItem.id}-title">${headerTitle}</h2>
        <div class="window-controls">
          ${renderModuleNotificationBell(windowItem)}
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

function renderModuleNotificationBell(windowItem) {
  const moduleId = windowItem.moduleId
  if (!moduleId) {
    return ''
  }

  const renderableNotifications = getCenterScopedNotificationsForRender()
  const moduleNotifications = moduleId
    ? renderableNotifications.filter((notification) => notification.sourceModule === moduleId)
    : []
  const unreadCount = moduleNotifications.filter((notification) => !notification.readAt).length
  const moduleNotificationItems = moduleNotifications
    .slice(0, 5)
    .map(
      (notification) => `
        <article class="module-notification-item ${notification.readAt ? 'read' : 'unread'}">
          <strong>${escapeHtml(notification.title)}</strong>
          <p>${escapeHtml(notification.message)}</p>
        </article>
      `,
    )
    .join('')

  return `
    <details class="module-notification-bell" aria-label="Chuông thông báo module">
      <summary aria-label="Mở thông báo của module">
        <span class="module-notification-bell-icon" aria-hidden="true">!</span>
        ${unreadCount ? `<strong>${unreadCount}</strong>` : ''}
      </summary>
      <div class="module-notification-popover" role="status">
        <strong>Thông báo module</strong>
        ${
          moduleNotificationItems ||
          '<p class="module-notification-empty">Không có thông báo cho module này.</p>'
        }
      </div>
    </details>
  `
}

function renderWindowBody(windowItem) {
  if (windowItem.type === 'student-detail') {
    return renderStudentDetailWithDeleteAction(getStudentById(windowItem.studentId), classSessions)
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
    return renderStudentModule(
      students,
      studentFilters,
      studentFormState,
      teachers,
      classSessions,
    )
  }

  if (moduleItem.id === 'khach-hang-tu-van') {
    return renderParentConsultationModule(
      parentConsultations,
      parentConsultationFilters,
      students,
      parentConsultationFormState,
      parentQuickNoteState,
      parentNoteHistoryContactId,
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
      classSessions,
    )
  }

  if (moduleItem.id === 'nhan-vien') {
    return renderStaffModule({
      teachers,
      scheduleSessions,
      sessionReports,
      filters: staffFilters,
    })
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
      scheduleAdminAttendanceState,
      {
        attendanceRecords: loadStoredAttendanceRecords(getCurrentResolvedCenterId()),
      },
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
      getCurrentMonthKey(),
      tuitionRollbackPreviewState,
    )
  }

  if (moduleItem.id === 'nhom-tai-chinh') {
    return renderFinanceWorkspaceModule()
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
      renderCashflowCloudAuthNotice(cloudStatus),
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
      cloudGalleryState,
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
      inventoryRequests,
      inventoryRequestFilters,
      isInventoryRequestsPanelOpen,
      inventoryRequestFormState,
      selectedInventoryRequestId,
      inventoryRequestStatusFormState,
      students,
    )
  }

  if (moduleItem.id === 'bao-cao') {
    return renderReportModule({
      filters: reportState.filters,
      draft: reportState.draft,
      selectedBarDetail: reportState.selectedBarDetail,
      students,
      cashflowTransactions,
      attendanceRecords: buildUnifiedAttendanceRecords({
        sessionReports,
        storedRecords: loadStoredAttendanceRecords(getCurrentResolvedCenterId()),
      }),
    })
  }

  if (moduleItem.id === 'cai-dat-co-so') {
    return renderSettingsModule(
      classSessions,
      students,
      settingsFilters,
      settingsClassSessionFormState,
      getSettingsCloudDbPanelState(),
    )
  }

  if (moduleItem.id === 'bang-diem-danh') {
    return renderAttendanceBoardModule(
      students,
      classSessions,
      tuitionRecords,
      sessionReports,
      attendanceAdvisoryNotes,
      attendanceBoardFilters,
      attendanceBoardDetailState,
      attendanceBoardNotes,
      attendanceBoardNoteFormState,
      Boolean(attendanceBaselineUndoSnapshot),
      attendanceBaselineDraftRecords,
      getAttendanceBaselineDraftChangeCount(),
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

function renderStudentDetailWithDeleteAction(student, classSessions = []) {
  const detailHtml = renderStudentDetail(student, teachers, classSessions, tuitionRecords)

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

function getTeacherById(teacherId) {
  return teachers.find((teacher) => teacher.id === teacherId)
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

function getTaskbarCenterProfileState() {
  const binding = resolveAppCenterBinding(cloudStatus)
  const centerName = binding.centerName || cloudStatus.centerName || 'DreamHome'
  const centerId = binding.currentCenterId || cloudStatus.centerId || getCurrentResolvedCenterId()
  const role = cloudStatus.role || binding.role || ''
  const dataLabel = cloudBootstrapState.status === CLOUD_BOOTSTRAP_STATUS.CLOUD ||
    cloudBootstrapState.status === CLOUD_BOOTSTRAP_STATUS.EMPTY
      ? 'Cloud'
      : 'Cache cục bộ'

  return {
    centerName,
    centerId,
    accountLabel: cloudStatus.user?.email || 'Đang đăng nhập',
    roleLabel: getCenterProfileRoleLabel(role),
    dataLabel,
    statusLabel: getCenterProfileStatusLabel(),
  }
}

function getCenterProfileRoleLabel(role) {
  const labels = {
    center_admin: 'Quản lý cơ sở',
    admin: 'Quản lý cơ sở',
    teacher: 'Giáo viên',
    consultant: 'Tư vấn',
  }

  return labels[role] || role || 'Chưa xác định'
}

function getCenterProfileStatusLabel() {
  if (cloudStatus.membershipStatus === 'loaded' && cloudStatus.authStatus === 'signed-in') {
    return 'Sẵn sàng'
  }

  if (cloudStatus.membershipStatus === 'loading') {
    return 'Đang kiểm tra'
  }

  return 'Cần kiểm tra'
}

function renderCenterProfilePopover(profile) {
  return `
    <div
      class="center-profile-popover"
      id="center-profile-popover"
      role="dialog"
      aria-label="Thông tin tài khoản và cơ sở"
    >
      <div class="center-profile-popover-header">
        <strong>${escapeHtml(profile.centerName)}</strong>
        <span>Phiên làm việc</span>
      </div>
      <dl>
        <div>
          <dt>Tài khoản</dt>
          <dd>${escapeHtml(profile.accountLabel)}</dd>
        </div>
        <div>
          <dt>Vai trò</dt>
          <dd>${escapeHtml(profile.roleLabel)}</dd>
        </div>
        <div>
          <dt>Dữ liệu</dt>
          <dd>${escapeHtml(profile.dataLabel)}</dd>
        </div>
        <div>
          <dt>Trạng thái</dt>
          <dd>${escapeHtml(profile.statusLabel)}</dd>
        </div>
        <div>
          <dt>Mã cơ sở</dt>
          <dd>${escapeHtml(profile.centerId || 'Chưa xác định')}</dd>
        </div>
      </dl>
    </div>
  `
}

function renderTaskbar() {
  const { visibleWindows, overflowWindows } = getTaskbarWindowGroups(openWindows)
  const activeWindowId = getActiveWindowId()
  const unreadCount = getUnreadNotificationCount()
  const centerProfile = getTaskbarCenterProfileState()
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
        <button
          class="taskbar-item center-profile-chip ${isCenterProfilePopoverOpen ? 'active' : ''}"
          type="button"
          data-action="toggle-center-profile"
          aria-expanded="${isCenterProfilePopoverOpen}"
          aria-controls="center-profile-popover"
        >
          Cơ sở: ${escapeHtml(centerProfile.centerName)}
        </button>
        ${isCenterProfilePopoverOpen ? renderCenterProfilePopover(centerProfile) : ''}
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

function getTaskbarWindowGroups(windowItems = []) {
  if (!windowItems.length) {
    return {
      visibleWindows: [],
      overflowWindows: [],
    }
  }

  const recentWindow = windowItems.reduce(
    (latestWindow, windowItem) =>
      !latestWindow || windowItem.zIndex > latestWindow.zIndex ? windowItem : latestWindow,
    null,
  )

  return {
    visibleWindows: recentWindow ? [recentWindow] : [],
    overflowWindows: windowItems.filter((windowItem) => windowItem.id !== recentWindow?.id),
  }
}

function renderSystemOverlay() {
  if (!isNotificationCenterOpen) {
    return '<div class="system-overlay-root" id="system-overlay-root"></div>'
  }

  return `
    <div class="system-overlay-root active" id="system-overlay-root">
      ${renderNotificationCenterHotfix(getUnreadNotificationCount())}
    </div>
  `
}

function renderNotificationCenterV15J(unreadCount) {
  const visibleNotifications = filterNotifications(getCenterScopedNotificationsForRender(), {
    readState: notificationFilters.readState,
  })
  const unreadVisibleCount = visibleNotifications.filter((notification) => !notification.readAt).length
  const moduleOptions = [
    ['all', 'Tất cả module'],
    ...Object.entries(notificationSourceLabels),
  ]
  const notificationItems = visibleNotifications
    .map(
      (notification) => `
        <article
          class="notification-item ${notification.readAt ? 'read' : 'unread'} level-${notification.severity}"
          data-notification-id="${notification.id}"
          tabindex="0"
          aria-label="${escapeHtml(notification.title)}"
        >
          <div class="notification-item-header">
            <strong>${escapeHtml(notification.title)}</strong>
            <span class="notification-state">${notification.readAt ? 'Đã đọc' : 'Chưa đọc'}</span>
          </div>
          <p>${escapeHtml(notification.message)}</p>
          <div class="notification-meta">
            <span>${escapeHtml(notification.sourceLabel || getNotificationSourceLabel(notification.sourceModule))}</span>
            <time datetime="${notification.createdAt}">${formatNotificationTime(notification.createdAt)}</time>
          </div>
          ${
            notification.readAt
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
            ${unreadVisibleCount ? '' : 'disabled'}
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      </div>
      <div class="notification-center-filters" aria-label="Lọc thông báo">
        <label>
          <span>Trạng thái</span>
          <select data-notification-filter="readState">
            <option value="unread" ${notificationFilters.readState === 'unread' ? 'selected' : ''}>Chưa đọc</option>
            <option value="all" ${notificationFilters.readState === 'all' ? 'selected' : ''}>Tất cả</option>
            <option value="read" ${notificationFilters.readState === 'read' ? 'selected' : ''}>Đã đọc</option>
          </select>
        </label>
      </div>
      <div class="notification-list">
        ${notificationItems || '<p class="notification-empty">Chưa có thông báo.</p>'}
      </div>
    </section>
  `
}

function renderNotificationCenterHotfix(unreadCount) {
  const visibleNotifications = filterNotifications(getCenterScopedNotificationsForRender(), {
    readState: notificationFilters.readState,
  })
  const unreadVisibleCount = visibleNotifications.filter((notification) => !notification.readAt).length
  const notificationModuleSummaries = buildNotificationModuleSummaries(visibleNotifications)
  const notificationSummaryItems = notificationModuleSummaries
    .map(
      (summary) => `
        <button
          type="button"
          class="notification-module-summary level-${summary.severity} ${summary.canOpen ? 'can-open' : 'is-readonly'}"
          ${summary.canOpen ? `data-notification-module-id="${escapeAttribute(summary.sourceModule)}"` : ''}
          tabindex="0"
          aria-label="${escapeAttribute(summary.title)}"
        >
          <div class="notification-module-summary-header">
            <strong>${escapeHtml(summary.title)}</strong>
            <span>${summary.count}</span>
          </div>
          <p>${escapeHtml(summary.message)}</p>
          <span class="notification-module-summary-meta">
            ${summary.canOpen ? 'Bấm để mở module' : 'Chi tiết nằm trong thông báo hệ thống'}
          </span>
        </button>
      `,
    )
    .join('')
  const emptyText = getNotificationEmptyText(notificationFilters.readState)

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
            ${unreadVisibleCount ? '' : 'disabled'}
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      </div>
      <div class="notification-center-filters is-status-only" aria-label="Lọc thông báo">
        <label>
          <span>Trạng thái</span>
          <select data-notification-filter="readState">
            <option value="unread" ${notificationFilters.readState === 'unread' ? 'selected' : ''}>Chưa đọc</option>
            <option value="all" ${notificationFilters.readState === 'all' ? 'selected' : ''}>Tất cả</option>
            <option value="read" ${notificationFilters.readState === 'read' ? 'selected' : ''}>Đã đọc</option>
          </select>
        </label>
      </div>
      <div class="notification-list">
        ${notificationSummaryItems || `<p class="notification-empty">${emptyText}</p>`}
      </div>
    </section>
  `
}

function buildNotificationModuleSummaries(notificationItems = []) {
  const moduleMap = new Map()

  notificationItems.forEach((notification) => {
    const sourceModule = notification.sourceModule || 'he-thong'
    const existingSummary = moduleMap.get(sourceModule) || {
      sourceModule,
      label: getNotificationModuleLabel(sourceModule, notification),
      count: 0,
      unreadCount: 0,
      warningCount: 0,
      latestTime: '',
      sampleMessages: [],
      severity: 'info',
      canOpen: modules.some((moduleItem) => moduleItem.id === sourceModule),
    }

    existingSummary.count += 1
    if (!notification.readAt) {
      existingSummary.unreadCount += 1
    }
    if (['warning', 'danger'].includes(notification.severity)) {
      existingSummary.warningCount += 1
    }
    if (getSeverityRank(notification.severity) > getSeverityRank(existingSummary.severity)) {
      existingSummary.severity = notification.severity
    }
    if (!existingSummary.latestTime || new Date(notification.createdAt).getTime() > new Date(existingSummary.latestTime).getTime()) {
      existingSummary.latestTime = notification.createdAt
    }
    if (notification.title && existingSummary.sampleMessages.length < 2) {
      existingSummary.sampleMessages.push(notification.title)
    }

    moduleMap.set(sourceModule, existingSummary)
  })

  return Array.from(moduleMap.values())
    .sort((firstSummary, secondSummary) => {
      const firstUnreadRank = firstSummary.unreadCount > 0 ? 1 : 0
      const secondUnreadRank = secondSummary.unreadCount > 0 ? 1 : 0
      if (firstUnreadRank !== secondUnreadRank) {
        return secondUnreadRank - firstUnreadRank
      }

      return new Date(secondSummary.latestTime || 0).getTime() - new Date(firstSummary.latestTime || 0).getTime()
    })
    .map((summary) => ({
      ...summary,
      title: buildNotificationModuleSummaryTitle(summary),
      message: buildNotificationModuleSummaryMessage(summary),
    }))
}

function buildNotificationModuleSummaryTitle(summary) {
  const readState = notificationFilters.readState || 'unread'
  const noun = summary.warningCount ? 'cảnh báo' : 'thông báo'
  const stateSuffix = readState === 'read'
    ? 'đã đọc'
    : readState === 'all'
      ? ''
      : 'mới'

  return `${summary.label} có ${summary.count} ${noun}${stateSuffix ? ` ${stateSuffix}` : ''}`
}

function buildNotificationModuleSummaryMessage(summary) {
  if (summary.sampleMessages.length) {
    return `Có ${summary.sampleMessages.join('; ')}. Chi tiết nằm trong chuông riêng của module.`
  }

  return `Có ${summary.count} mục chi tiết trong chuông riêng của module.`
}

function getNotificationModuleLabel(sourceModule, notification = {}) {
  const moduleItem = modules.find((item) => item.id === sourceModule)
  return moduleItem?.name ||
    notificationSourceLabels[sourceModule] ||
    notification.sourceLabel ||
    getNotificationSourceLabel(sourceModule)
}

function getNotificationEmptyText(readState = 'unread') {
  if (readState === 'unread') {
    return 'Không có thông báo chưa đọc.'
  }

  if (readState === 'read') {
    return 'Không có thông báo đã đọc.'
  }

  return 'Không có thông báo.'
}

function getSeverityRank(severity) {
  return {
    info: 1,
    success: 2,
    warning: 3,
    danger: 4,
  }[severity] || 1
}

function renderNotificationCenter(unreadCount) {
  const renderableNotifications = getCenterScopedNotificationsForRender()
  const readCount = renderableNotifications.length - unreadCount
  const notificationItems = renderableNotifications
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

function renderWindowOverflowMenu(openWindowItems, activeWindowId) {
  const windowItems = openWindowItems
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
          <span class="window-overflow-title">${title}</span>
          <span class="window-overflow-state">
            ${windowItem.minimized ? 'Đã thu nhỏ' : 'Đang mở'}
          </span>
        </button>
      `
    })
    .join('')

  return `
    <nav class="window-overflow-menu" id="window-overflow-menu" aria-label="Cửa sổ khác">
      <p>Cửa sổ</p>
      ${windowItems || '<span class="window-overflow-empty">Chưa có module đang mở.</span>'}
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
        <button type="button" data-cloud-action="logout">Đăng xuất</button>
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
  queueCoreCloudSync('student-delete')
  writeStudentThroughCloud(getStudentById(studentId), 'student-delete')
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

function getNextReportWeekStartDate(currentWeekStartDate, action) {
  if (action === 'current') {
    return getWeekStartDate(new Date())
  }

  const currentWeekDate = new Date(`${currentWeekStartDate}T00:00:00`)
  const safeCurrentWeekDate = Number.isNaN(currentWeekDate.getTime()) ? new Date() : currentWeekDate
  const nextWeekDate = new Date(safeCurrentWeekDate)

  if (action === 'previous') {
    nextWeekDate.setDate(nextWeekDate.getDate() - 7)
  } else if (action === 'next') {
    nextWeekDate.setDate(nextWeekDate.getDate() + 7)
  }

  return getWeekStartDate(nextWeekDate)
}

function shouldSkipDuplicateCloudUserSync(user, reason = '') {
  const nextUserId = user?.id || ''

  if (!nextUserId) {
    return cloudStatus.authStatus === 'signed-out' && !cloudStatus.user
  }

  const isSameUser = nextUserId === cloudStatus.user?.id && nextUserId === cloudLastSyncedUserId
  const hasSettledMembership = ['loading', 'loaded', 'missing', 'error'].includes(
    cloudStatus.membershipStatus,
  )

  return isSameUser && hasSettledMembership && reason !== 'manual-sign-in'
}

async function syncCloudUser(user, { force = false, reason = '' } = {}) {
  if (!force && shouldSkipDuplicateCloudUserSync(user, reason)) {
    return
  }

  const syncId = ++cloudUserSyncId

  if (!user) {
    stopStudentRealtimeSubscription()
    stopTeacherRealtimeSubscription()
    stopScheduleSessionRealtimeSubscription()
    stopC51AttendanceRealtimeSubscription()
    stopC52TuitionRealtimeSubscription()
    transactionImageManagerState = null
    cloudGalleryState = null
    cloudDbState = createInitialCloudDbState()
    cloudBootstrapState = createInitialCloudBootstrapState()
    cloudDbAutoPullUserId = ''
    c51AttendanceAutoPullUserId = ''
    c52TuitionAutoPullUserId = ''
    cloudLastSyncedUserId = ''
    cloudBootstrapRetryBlockedUntil = 0
    cloudBootstrapLastFailureSignature = ''
    isCenterProfilePopoverOpen = false
    cloudStatus = {
      ...cloudStatus,
      authStatus: 'signed-out',
      user: null,
      role: null,
      centerId: '',
      centerName: '',
      membership: null,
      memberships: [],
      membershipStatus: 'idle',
      message: '',
      attachments: [],
      attachmentsStatus: 'idle',
      attachmentsError: '',
      attachmentsMonthKey: '',
      uploadMessage: '',
      uploadMessageTone: '',
      memberProfileMap: {},
      currentMemberProfile: null,
      profileStatus: 'idle',
      profileMessage: '',
      profileMessageTone: '',
    }
    render()
    return
  }

  const previousUserId = cloudLastSyncedUserId
  const isNewUser = previousUserId !== user.id
  cloudLastSyncedUserId = user.id

  cloudStatus = {
    ...cloudStatus,
    authStatus: 'signed-in',
    user,
    role: null,
    centerId: '',
    centerName: '',
    membership: null,
    memberships: [],
    membershipStatus: 'loading',
    message: '',
    attachments: [],
    attachmentsStatus: 'idle',
    attachmentsError: '',
    attachmentsMonthKey: getCurrentMonthKey(),
    uploadMessage: '',
    uploadMessageTone: '',
    memberProfileMap: {},
    currentMemberProfile: null,
    profileStatus: 'idle',
    profileMessage: '',
    profileMessageTone: '',
  }
  if (isNewUser) {
    cloudDbState = createInitialCloudDbState()
    cloudBootstrapState = createInitialCloudBootstrapState()
    cloudDbAutoPullUserId = ''
    c51AttendanceAutoPullUserId = ''
    c52TuitionAutoPullUserId = ''
    cloudBootstrapRetryBlockedUntil = 0
    cloudBootstrapLastFailureSignature = ''
    isCenterProfilePopoverOpen = false
  }
  render()

  try {
    const resolvedMembership = await resolveActiveCenterMembership(user.id)

    if (syncId !== cloudUserSyncId) {
      return
    }

    if (resolvedMembership.ok) {
      setCurrentStorageCenterId(resolvedMembership.centerId)
      reloadLocalDataForResolvedCenter({
        useSampleFallback: !isProductionCenter(resolvedMembership.centerId),
      })
    }

    cloudStatus = {
      ...cloudStatus,
      role: resolvedMembership.role ?? null,
      centerId: resolvedMembership.centerId,
      centerName: resolvedMembership.centerName,
      membership: resolvedMembership.membership,
      memberships: resolvedMembership.memberships,
      membershipStatus: resolvedMembership.ok ? 'loaded' : 'missing',
      message: resolvedMembership.message,
      attachments: [],
      attachmentsStatus: resolvedMembership.ok ? 'loading' : 'idle',
      attachmentsError: '',
    }
  } catch (error) {
    if (syncId !== cloudUserSyncId) {
      return
    }

    cloudStatus = {
      ...cloudStatus,
      role: null,
      centerId: '',
      centerName: '',
      membership: null,
      memberships: [],
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
  await bootstrapCoreCloudDataForCurrentCenter(syncId)

  if (cloudStatus.membershipStatus === 'loaded') {
    await loadCenterMemberProfiles(syncId)
    await loadCurrentMonthCloudAttachments(syncId)
    await startStudentRealtimeSubscription(syncId)
    await startTeacherRealtimeSubscription(syncId)
    await startScheduleSessionRealtimeSubscription(syncId)
    await bootstrapC51AttendanceSessionReportCloudData(syncId)
    await startC51AttendanceRealtimeSubscription(syncId)
    await bootstrapC52TuitionRecordPackageCloudData(syncId)
    await startC52TuitionRealtimeSubscription(syncId)
  }
}

function createInitialCloudDbState() {
  return {
    isLoading: false,
    readinessStatus: 'idle',
    cloudCounts: null,
    message: '',
    messageTone: '',
    lastUpdatedAt: '',
  }
}

function getCurrentCloudBootstrapContext() {
  return {
    authStatus: cloudStatus.authStatus,
    user: cloudStatus.user,
    centerBinding: resolveAppCenterBinding(cloudStatus),
    configStatus: cloudStatus.configStatus,
  }
}

function renderCashflowCloudAuthNotice(status) {
  const isSignedIn = status.authStatus === 'signed-in' && status.user
  const hasMembership = status.membershipStatus === 'loaded' && status.role

  if (isSignedIn && hasMembership) {
    return `
      <aside class="cashflow-cloud-auth-note is-ready" role="note">
        <span>Đã đăng nhập ở cổng hệ thống. Tính năng ảnh cloud của Thu Chi sẵn sàng.</span>
        <button type="button" data-cloud-action="open-gallery">
          Mở kho ảnh cloud
        </button>
      </aside>
    `
  }

  const message =
    status.configStatus !== 'configured'
      ? 'Chưa cấu hình Supabase Cloud. Thu Chi vẫn dùng dữ liệu local như cũ.'
      : 'Vui lòng đăng nhập ở cổng hệ thống để dùng tính năng cloud.'

  return `
    <aside class="cashflow-cloud-auth-note" role="note">
      ${escapeHtml(message)}
    </aside>
  `
}

function getSettingsCloudDbPanelState() {
  return {
    ...cloudDbState,
    configStatus: cloudStatus.configStatus,
    authStatus: cloudStatus.authStatus,
    membershipStatus: cloudStatus.membershipStatus,
    role: cloudStatus.role,
    localCounts: getCloudDbLocalCounts(),
    localAngelWingsStatus: getLocalAngelWingsStatus(),
  }
}

function getCloudDbLocalCounts() {
  return {
    [CLOUD_ENTITY_TYPES.STUDENT]: students.filter((student) => !student.isDeleted).length,
    [CLOUD_ENTITY_TYPES.TEACHER]: teachers.length,
    [CLOUD_ENTITY_TYPES.CLASS_SESSION]: classSessions.length,
  }
}

function getLocalAngelWingsStatus() {
  const angelWingsStudents = students.filter(isAngelWingsEntity)
  const angelWingsClassSessions = classSessions.filter(isAngelWingsEntity)
  const hasAngelWingsTeacher = teachers.some(
    (teacher) => teacher.id === ANGEL_WINGS_TEACHER_ID || isAngelWingsEntity(teacher),
  )
  const looksLikeOldSeed = students.length === 8 && angelWingsStudents.length === 0
  const isReadyForCloudPush =
    angelWingsStudents.length >= 29 &&
    angelWingsClassSessions.length >= 4 &&
    hasAngelWingsTeacher

  return {
    isReadyForCloudPush,
    looksLikeOldSeed,
    studentCount: angelWingsStudents.length,
    classSessionCount: angelWingsClassSessions.length,
    hasTeacher: hasAngelWingsTeacher,
  }
}

function isAngelWingsEntity(entity) {
  return Boolean(
    entity &&
      (
        entity.sourceTag === ANGEL_WINGS_SOURCE_TAG ||
        entity.datasetId === ANGEL_WINGS_DATASET_ID ||
        entity.importBatchId === ANGEL_WINGS_IMPORT_BATCH_ID ||
        entity.isControlledFixture
      ),
  )
}

function canUseCoreCloudDb() {
  return buildCurrentOnlineAccessState({ cloudReady: true }).canRead
}

function isCoreCloudDbReady() {
  return (
    canWriteCoreCloudDb() &&
    cloudDbState.readinessStatus === 'ready' &&
    getLocalAngelWingsStatus().isReadyForCloudPush
  )
}

function buildCurrentOnlineAccessState({ cloudReady = false } = {}) {
  return buildOnlineAccessState({
    isSupabaseConfigured: cloudStatus.configStatus === 'configured',
    isSignedIn: cloudStatus.authStatus === 'signed-in',
    user: cloudStatus.user,
    centerId: getCurrentResolvedCenterId(),
    membership:
      cloudStatus.membershipStatus === 'loaded'
        ? cloudStatus.membership || { role: cloudStatus.role, center_id: getCurrentResolvedCenterId() }
        : null,
    role: cloudStatus.role,
    cloudReady,
    membershipUnavailable:
      cloudStatus.membershipStatus === 'missing' || cloudStatus.membershipStatus === 'error',
  })
}

function canWriteCoreCloudDb(entityType = CLOUD_ENTITY_TYPES.STUDENT) {
  return canWriteEntity(
    buildCurrentOnlineAccessState({ cloudReady: cloudDbState.readinessStatus === 'ready' }),
    entityType,
  )
}

async function writeStudentThroughCloud(student, reason = 'student-save') {
  const accessState = buildCurrentOnlineAccessState({
    cloudReady: cloudDbState.readinessStatus === 'ready',
  })

  if (!canWriteEntity(accessState, CLOUD_ENTITY_TYPES.STUDENT)) {
    if (cloudStatus.authStatus === 'signed-in') {
      cloudDbState = {
        ...cloudDbState,
        message: getOnlineAccessMessage(accessState),
        messageTone: 'error',
      }
    }
    return { ok: false, skipped: true, error: getOnlineAccessMessage(accessState) }
  }

  const runId = ++studentCloudWriteRunId
  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (!readiness.ok) {
    if (runId === studentCloudWriteRunId) {
      cloudDbState = {
        ...cloudDbState,
        readinessStatus: 'error',
        message: readiness.error,
        messageTone: 'error',
        lastUpdatedAt: new Date().toISOString(),
      }
      render()
    }
    return readiness
  }

  const writeAccessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(readiness.user),
    user: readiness.user,
    centerId: readiness.centerId,
    membership: readiness.membership,
    role: readiness.membership?.role,
    cloudReady: readiness.ready !== false,
  })
  const result = await upsertStudentCloudEntity({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    student,
    userId: readiness.user?.id,
    accessState: writeAccessState,
  })

  if (runId !== studentCloudWriteRunId) {
    return result
  }

  cloudDbState = {
    ...cloudDbState,
    readinessStatus: result.ok ? 'ready' : cloudDbState.readinessStatus,
    message: result.ok
      ? `Da luu cloud Hoc vien (${reason}).`
      : result.error || 'Chua the dong bo cloud Hoc vien.',
    messageTone: result.ok ? 'success' : 'error',
    lastUpdatedAt: result.ok ? new Date().toISOString() : cloudDbState.lastUpdatedAt,
  }
  render()
  return result
}

async function startStudentRealtimeSubscription(syncId = cloudUserSyncId) {
  if (!canUseCoreCloudDb() || studentRealtimeCenterId === getCurrentResolvedCenterId()) {
    return
  }

  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (syncId !== cloudUserSyncId) {
    return
  }

  if (!readiness.ok) {
    cloudDbState = {
      ...cloudDbState,
      message: readiness.error,
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  stopStudentRealtimeSubscription()

  const accessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(readiness.user),
    user: readiness.user,
    centerId: readiness.centerId,
    membership: readiness.membership,
    role: readiness.membership?.role,
    cloudReady: true,
  })
  const subscription = subscribeToStudentCloudRealtime({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    accessState,
    onStudentRecord: handleStudentRealtimeRecord,
    onStatusChange: handleStudentRealtimeStatus,
  })

  if (!subscription.ok) {
    cloudDbState = {
      ...cloudDbState,
      message: subscription.message,
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  studentRealtimeSubscription = subscription
  studentRealtimeCenterId = readiness.centerId
}

function stopStudentRealtimeSubscription() {
  studentRealtimeSubscription?.cleanup?.()
  studentRealtimeSubscription = null
  studentRealtimeCenterId = ''
}

function handleStudentRealtimeStatus(status) {
  if (!status || status.status !== 'CHANNEL_ERROR' && status.status !== 'TIMED_OUT') {
    return
  }

  cloudDbState = {
    ...cloudDbState,
    message: status.needsRealtimePatch
      ? NEEDS_SUPABASE_REALTIME_PATCH
      : status.message || 'Online Hoc vien chua san sang.',
    messageTone: 'error',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
}

function handleStudentRealtimeRecord(record) {
  const mergeResult = mergeRealtimeStudentIntoList(students, record)

  if (!mergeResult.ok || !mergeResult.changed) {
    return
  }

  students = mergeResult.students
  saveStoredStudents(students)
  render()
}

async function writeTeacherThroughCloud(teacher, reason = 'teacher-save') {
  const accessState = buildCurrentOnlineAccessState({
    cloudReady: cloudDbState.readinessStatus === 'ready',
  })

  if (!canWriteEntity(accessState, CLOUD_ENTITY_TYPES.TEACHER)) {
    if (cloudStatus.authStatus === 'signed-in') {
      cloudDbState = {
        ...cloudDbState,
        message: getOnlineAccessMessage(accessState),
        messageTone: 'error',
      }
    }
    return { ok: false, skipped: true, error: getOnlineAccessMessage(accessState) }
  }

  const runId = ++teacherCloudWriteRunId
  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (!readiness.ok) {
    if (runId === teacherCloudWriteRunId) {
      cloudDbState = {
        ...cloudDbState,
        readinessStatus: 'error',
        message: readiness.error,
        messageTone: 'error',
        lastUpdatedAt: new Date().toISOString(),
      }
      render()
    }
    return readiness
  }

  const writeAccessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(readiness.user),
    user: readiness.user,
    centerId: readiness.centerId,
    membership: readiness.membership,
    role: readiness.membership?.role,
    cloudReady: readiness.ready !== false,
  })
  const result = await upsertTeacherCloudEntity({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    teacher,
    userId: readiness.user?.id,
    accessState: writeAccessState,
  })

  if (runId !== teacherCloudWriteRunId) {
    return result
  }

  cloudDbState = {
    ...cloudDbState,
    readinessStatus: result.ok ? 'ready' : cloudDbState.readinessStatus,
    message: result.ok
      ? `Da luu cloud Giao vien (${reason}).`
      : result.error || 'Chua the dong bo cloud Giao vien.',
    messageTone: result.ok ? 'success' : 'error',
    lastUpdatedAt: result.ok ? new Date().toISOString() : cloudDbState.lastUpdatedAt,
  }
  render()
  return result
}

async function startTeacherRealtimeSubscription(syncId = cloudUserSyncId) {
  if (!canUseCoreCloudDb() || teacherRealtimeCenterId === getCurrentResolvedCenterId()) {
    return
  }

  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (syncId !== cloudUserSyncId) {
    return
  }

  if (!readiness.ok) {
    cloudDbState = {
      ...cloudDbState,
      message: readiness.error,
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  stopTeacherRealtimeSubscription()

  const accessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(readiness.user),
    user: readiness.user,
    centerId: readiness.centerId,
    membership: readiness.membership,
    role: readiness.membership?.role,
    cloudReady: true,
  })
  const subscription = subscribeToTeacherCloudRealtime({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    accessState,
    onTeacherRecord: handleTeacherRealtimeRecord,
    onStatusChange: handleTeacherRealtimeStatus,
  })

  if (!subscription.ok) {
    cloudDbState = {
      ...cloudDbState,
      message: subscription.message,
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  teacherRealtimeSubscription = subscription
  teacherRealtimeCenterId = readiness.centerId
}

function stopTeacherRealtimeSubscription() {
  teacherRealtimeSubscription?.cleanup?.()
  teacherRealtimeSubscription = null
  teacherRealtimeCenterId = ''
}

function handleTeacherRealtimeStatus(status) {
  if (!status || status.status !== 'CHANNEL_ERROR' && status.status !== 'TIMED_OUT') {
    return
  }

  cloudDbState = {
    ...cloudDbState,
    message: status.needsRealtimePatch
      ? NEEDS_SUPABASE_REALTIME_PATCH
      : status.message || 'Online Giao vien chua san sang.',
    messageTone: 'error',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
}

function handleTeacherRealtimeRecord(record) {
  const mergeResult = mergeRealtimeTeacherIntoList(teachers, record)

  if (!mergeResult.ok || !mergeResult.changed) {
    return
  }

  teachers = mergeResult.teachers
  saveStoredTeachers(teachers)
  render()
}

async function writeScheduleSessionThroughCloud(scheduleSession, reason = 'schedule-save') {
  const accessState = buildCurrentOnlineAccessState({
    cloudReady: cloudDbState.readinessStatus === 'ready',
  })
  const localPreview = buildScheduleSessionBridgePreview(
    scheduleSession ? [scheduleSession] : [],
    buildScheduleSessionRuntimeContext({
      accessState,
      cloudReady: cloudDbState.readinessStatus === 'ready',
    }),
  )

  if (!localPreview.readiness.readyForRuntimeWrite) {
    if (cloudStatus.authStatus === 'signed-in') {
      cloudDbState = {
        ...cloudDbState,
        message: 'Chua the dong bo lich len cloud.',
        messageTone: 'error',
      }
    }
    return {
      ok: false,
      skipped: true,
      error: localPreview.readiness.blockers[0] || 'Chua the dong bo lich len cloud.',
      readiness: localPreview.readiness,
    }
  }

  const runId = ++scheduleSessionCloudWriteRunId
  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (!readiness.ok) {
    if (runId === scheduleSessionCloudWriteRunId) {
      cloudDbState = {
        ...cloudDbState,
        readinessStatus: 'error',
        message: readiness.error,
        messageTone: 'error',
        lastUpdatedAt: new Date().toISOString(),
      }
      render()
    }
    return readiness
  }

  const writeAccessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(readiness.user),
    user: readiness.user,
    centerId: readiness.centerId,
    membership: readiness.membership,
    role: readiness.membership?.role,
    cloudReady: readiness.ready !== false,
  })
  const preview = buildScheduleSessionBridgePreview(
    scheduleSession ? [scheduleSession] : [],
    buildScheduleSessionRuntimeContext({
      accessState: writeAccessState,
      centerId: readiness.centerId,
      cloudReady: readiness.ready !== false,
      signedIn: Boolean(readiness.user),
      membershipReady: Boolean(readiness.membership),
    }),
  )
  const result = await upsertScheduleSessionCloudEntity({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    scheduleSession,
    userId: readiness.user?.id,
    accessState: writeAccessState,
    readiness: {
      ...preview.readiness,
      dryRunPreview: preview.dryRun,
      cloudReady: readiness.ready !== false,
      signedIn: Boolean(readiness.user),
      membershipReady: Boolean(readiness.membership),
      membershipSqlReady: true,
      scheduleSessionSqlReady: true,
      realtimeReady: true,
    },
  })

  if (runId !== scheduleSessionCloudWriteRunId) {
    return result
  }

  cloudDbState = {
    ...cloudDbState,
    readinessStatus: result.ok ? 'ready' : cloudDbState.readinessStatus,
    message: result.ok
      ? `Da luu cloud TKB (${reason}).`
      : 'Chua the dong bo lich len cloud.',
    messageTone: result.ok ? 'success' : 'error',
    lastUpdatedAt: result.ok ? new Date().toISOString() : cloudDbState.lastUpdatedAt,
  }
  render()
  return result
}

async function startScheduleSessionRealtimeSubscription(syncId = cloudUserSyncId) {
  if (!canUseCoreCloudDb() || scheduleSessionRealtimeCenterId === getCurrentResolvedCenterId()) {
    return
  }

  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (syncId !== cloudUserSyncId) {
    return
  }

  if (!readiness.ok) {
    return
  }

  stopScheduleSessionRealtimeSubscription()

  const accessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(readiness.user),
    user: readiness.user,
    centerId: readiness.centerId,
    membership: readiness.membership,
    role: readiness.membership?.role,
    cloudReady: true,
  })
  const subscription = subscribeToScheduleSessionCloudRealtime({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    accessState,
    readiness: buildScheduleSessionRuntimeContext({
      accessState,
      centerId: readiness.centerId,
      cloudReady: true,
      signedIn: Boolean(readiness.user),
      membershipReady: Boolean(readiness.membership),
    }),
    onScheduleSessionRecord: handleScheduleSessionRealtimeRecord,
    onStatusChange: handleScheduleSessionRealtimeStatus,
  })

  if (!subscription.ok) {
    return
  }

  scheduleSessionRealtimeSubscription = subscription
  scheduleSessionRealtimeCenterId = readiness.centerId
}

function stopScheduleSessionRealtimeSubscription() {
  scheduleSessionRealtimeSubscription?.cleanup?.()
  scheduleSessionRealtimeSubscription = null
  scheduleSessionRealtimeCenterId = ''
}

function handleScheduleSessionRealtimeStatus(status) {
  if (!status || status.status !== 'CHANNEL_ERROR' && status.status !== 'TIMED_OUT') {
    return
  }

  cloudDbState = {
    ...cloudDbState,
    message: 'Online TKB chua san sang.',
    messageTone: 'error',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
}

function handleScheduleSessionRealtimeRecord(record) {
  const mergeResult = mergeScheduleSessionRealtimePayload(scheduleSessions, record)

  if (!mergeResult.ok || !mergeResult.changed) {
    return
  }

  scheduleSessions = mergeResult.scheduleSessions
  saveStoredSchedule(scheduleSessions)
  render()
}

function buildScheduleSessionRuntimeContext({
  accessState,
  centerId = getCurrentResolvedCenterId(),
  cloudReady = false,
  signedIn = cloudStatus.authStatus === 'signed-in',
  membershipReady = cloudStatus.membershipStatus === 'loaded',
} = {}) {
  return {
    accessState,
    centerId,
    classSessions,
    cloudReady,
    signedIn,
    membershipReady,
    membershipSqlReady: true,
    scheduleSessionSqlReady: true,
    realtimeReady: true,
    explicitUserAction: true,
  }
}

async function bootstrapC51AttendanceSessionReportCloudData(syncId = cloudUserSyncId) {
  if (!canUseCoreCloudDb() || c51AttendanceAutoPullUserId === cloudStatus.user?.id) {
    return
  }

  c51AttendanceAutoPullUserId = cloudStatus.user?.id || ''
  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (syncId !== cloudUserSyncId || !readiness.ok) {
    return
  }

  const result = await pullC51AttendanceSessionReportCloudEntities({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
  })

  if (syncId !== cloudUserSyncId) {
    return
  }

  if (!result.ok || result.empty) {
    cloudDbState = {
      ...cloudDbState,
      readinessStatus: readiness.ready === false ? cloudDbState.readinessStatus : 'ready',
      message: result.ok
        ? 'C5.1 realtime ready; attendance/session report cloud empty, giữ cache local.'
        : result.error || 'C5.1 realtime degraded; giữ cache local.',
      messageTone: result.ok ? '' : 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  const mergeResult = mergeC51CloudRecordsIntoLocal({
    attendanceRecords: loadStoredAttendanceRecords(getCurrentResolvedCenterId()),
    baselineState: loadAttendanceBaselineState(getCurrentResolvedCenterId()),
    sessionReports,
    cloudRecords: result.records,
  })

  if (!mergeResult.changed) {
    cloudDbState = {
      ...cloudDbState,
      readinessStatus: 'ready',
      message: 'C5.1 realtime ready; attendance/session report local đã mới nhất.',
      messageTone: '',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  saveStoredAttendanceRecords(getCurrentResolvedCenterId(), mergeResult.attendanceRecords)
  saveAttendanceBaselineState(getCurrentResolvedCenterId(), mergeResult.baselineState)
  sessionReports = mergeResult.sessionReports
  saveStoredSessionReports(sessionReports)
  cloudDbState = {
    ...cloudDbState,
    readinessStatus: 'ready',
    message: `Đã tải C5.1 attendance/session report từ cloud (${result.records.length} entity).`,
    messageTone: 'success',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
}

async function writeC51AttendanceSessionReportThroughCloud({
  attendanceRecords = [],
  baselineState = null,
  sessionReports: reportsToWrite = [],
  reason = 'c5-1c-local-save',
} = {}) {
  const accessState = buildCurrentOnlineAccessState({
    cloudReady: cloudDbState.readinessStatus === 'ready',
  })
  const access = canWriteC51AttendanceEntity(accessState)

  if (!access.canWrite) {
    if (cloudStatus.authStatus === 'signed-in') {
      cloudDbState = {
        ...cloudDbState,
        message: access.teacherConsultantHold || C51_TEACHER_CONSULTANT_WRITE_HOLD,
        messageTone: 'error',
        lastUpdatedAt: new Date().toISOString(),
      }
    }
    return { ok: false, skipped: true, error: access.teacherConsultantHold || access.message }
  }

  const runId = ++c51AttendanceCloudWriteRunId
  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (!readiness.ok) {
    if (runId === c51AttendanceCloudWriteRunId) {
      cloudDbState = {
        ...cloudDbState,
        readinessStatus: 'error',
        message: readiness.error,
        messageTone: 'error',
        lastUpdatedAt: new Date().toISOString(),
      }
      render()
    }
    return readiness
  }

  const writeAccessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(readiness.user),
    user: readiness.user,
    centerId: readiness.centerId,
    membership: readiness.membership,
    role: readiness.membership?.role,
    cloudReady: readiness.ready !== false,
  })
  const result = await upsertC51AttendanceSessionReportCloudEntities({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    attendanceRecords,
    baselineState,
    sessionReports: reportsToWrite,
    userId: readiness.user?.id,
    accessState: writeAccessState,
  })

  if (runId !== c51AttendanceCloudWriteRunId) {
    return result
  }

  cloudDbState = {
    ...cloudDbState,
    readinessStatus: result.ok ? 'ready' : cloudDbState.readinessStatus,
    message: result.ok
      ? `Đã ghi cloud C5.1 (${reason}): ${result.count || 0} entity.`
      : result.error || 'C5.1 realtime degraded; local đã được giữ.',
    messageTone: result.ok ? 'success' : 'error',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
  return result
}

async function startC51AttendanceRealtimeSubscription(syncId = cloudUserSyncId) {
  if (!canUseCoreCloudDb() || c51AttendanceRealtimeCenterId === getCurrentResolvedCenterId()) {
    return
  }

  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (syncId !== cloudUserSyncId || !readiness.ok) {
    return
  }

  stopC51AttendanceRealtimeSubscription()

  const accessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(readiness.user),
    user: readiness.user,
    centerId: readiness.centerId,
    membership: readiness.membership,
    role: readiness.membership?.role,
    cloudReady: true,
  })
  const subscription = subscribeToC51AttendanceSessionReportRealtime({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    accessState,
    onCloudRecord: handleC51AttendanceRealtimeRecord,
    onStatusChange: handleC51AttendanceRealtimeStatus,
  })

  if (!subscription.ok) {
    cloudDbState = {
      ...cloudDbState,
      message: subscription.message,
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  c51AttendanceRealtimeSubscription = subscription
  c51AttendanceRealtimeCenterId = readiness.centerId
}

function stopC51AttendanceRealtimeSubscription() {
  c51AttendanceRealtimeSubscription?.cleanup?.()
  c51AttendanceRealtimeSubscription = null
  c51AttendanceRealtimeCenterId = ''
}

function handleC51AttendanceRealtimeStatus(status) {
  if (!status || status.status !== 'CHANNEL_ERROR' && status.status !== 'TIMED_OUT') {
    return
  }

  cloudDbState = {
    ...cloudDbState,
    message: status.message || 'C5.1 realtime degraded; giữ cache local.',
    messageTone: 'error',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
}

function handleC51AttendanceRealtimeRecord(record) {
  if (!record || !C51_ATTENDANCE_REALTIME_ENTITY_TYPES.includes(record.entity_type)) {
    return
  }

  const mergeResult = mergeC51CloudRecordsIntoLocal({
    attendanceRecords: loadStoredAttendanceRecords(getCurrentResolvedCenterId()),
    baselineState: loadAttendanceBaselineState(getCurrentResolvedCenterId()),
    sessionReports,
    cloudRecords: [record],
  })

  if (!mergeResult.ok || !mergeResult.changed) {
    return
  }

  saveStoredAttendanceRecords(getCurrentResolvedCenterId(), mergeResult.attendanceRecords)
  saveAttendanceBaselineState(getCurrentResolvedCenterId(), mergeResult.baselineState)
  sessionReports = mergeResult.sessionReports
  saveStoredSessionReports(sessionReports)
  render()
}

async function bootstrapC52TuitionRecordPackageCloudData(syncId = cloudUserSyncId) {
  if (!canUseCoreCloudDb() || c52TuitionAutoPullUserId === cloudStatus.user?.id) {
    return
  }

  c52TuitionAutoPullUserId = cloudStatus.user?.id || ''
  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (syncId !== cloudUserSyncId || !readiness.ok) {
    return
  }

  const result = await pullC52TuitionRecordPackageCloudEntities({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
  })

  if (syncId !== cloudUserSyncId) {
    return
  }

  if (!result.ok || result.empty) {
    cloudDbState = {
      ...cloudDbState,
      readinessStatus: readiness.ready === false ? cloudDbState.readinessStatus : 'ready',
      message: result.ok
        ? 'C5.2C tuition cloud ready; cloud empty, giu cache Hoc phi local.'
        : result.error || 'C5.2C tuition cloud degraded; giu cache Hoc phi local.',
      messageTone: result.ok ? '' : 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  const mergeResult = mergeC52TuitionCloudRecordsIntoLocal({
    tuitionRecords,
    cloudRecords: result.records,
  })

  if (!mergeResult.changed) {
    cloudDbState = {
      ...cloudDbState,
      readinessStatus: 'ready',
      message: 'C5.2C tuition cloud ready; Hoc phi local da moi nhat.',
      messageTone: '',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  tuitionRecords = mergeResult.tuitionRecords
  saveStoredTuition(tuitionRecords)
  notifications = syncTuitionNotifications(notifications)
  cloudDbState = {
    ...cloudDbState,
    readinessStatus: 'ready',
    message: `Da tai Hoc phi tu cloud (${result.records.length} tuition_record_package).`,
    messageTone: 'success',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
}

async function writeC52TuitionRecordPackageThroughCloud(
  tuitionRecord,
  reason = 'tuition-local-save',
  auditContext = {},
) {
  const accessState = buildCurrentOnlineAccessState({
    cloudReady: cloudDbState.readinessStatus === 'ready',
  })
  const access = canWriteC52TuitionRecordPackageEntity(accessState)

  if (!access.canWrite) {
    if (cloudStatus.authStatus === 'signed-in') {
      cloudDbState = {
        ...cloudDbState,
        message: access.teacherConsultantHold || C52_TEACHER_CONSULTANT_WRITE_HOLD,
        messageTone: 'error',
        lastUpdatedAt: new Date().toISOString(),
      }
    }
    return { ok: false, skipped: true, error: access.teacherConsultantHold || access.message }
  }

  const runId = ++c52TuitionCloudWriteRunId
  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (!readiness.ok) {
    if (runId === c52TuitionCloudWriteRunId) {
      cloudDbState = {
        ...cloudDbState,
        readinessStatus: 'error',
        message: readiness.error,
        messageTone: 'error',
        lastUpdatedAt: new Date().toISOString(),
      }
      render()
    }
    return readiness
  }

  const writeAccessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(readiness.user),
    user: readiness.user,
    centerId: readiness.centerId,
    membership: readiness.membership,
    role: readiness.membership?.role,
    cloudReady: readiness.ready !== false,
  })
  const result = await upsertC52TuitionRecordPackageCloudEntities({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    tuitionRecords: tuitionRecord ? [tuitionRecord] : [],
    userId: readiness.user?.id,
    accessState: writeAccessState,
  })

  if (result.ok && tuitionRecord) {
    void writeC53TuitionAuditLogEntry({
      supabase: readiness.supabase,
      centerId: readiness.centerId,
      userId: readiness.user?.id,
      accessState: writeAccessState,
      tuitionRecord,
      beforePayload: auditContext.beforePayload || null,
      reason,
    })
  }

  if (runId !== c52TuitionCloudWriteRunId) {
    return result
  }

  cloudDbState = {
    ...cloudDbState,
    readinessStatus: result.ok ? 'ready' : cloudDbState.readinessStatus,
    message: result.ok
      ? `Da ghi cloud Hoc phi (${reason}): ${result.count || 0} tuition_record_package.`
      : result.error || 'C5.2C tuition cloud degraded; local da duoc giu.',
    messageTone: result.ok ? 'success' : 'error',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
  return result
}

async function writeC53TuitionAuditLogEntry({
  supabase,
  centerId,
  userId,
  accessState,
  tuitionRecord,
  beforePayload = null,
  reason = 'tuition-local-save',
} = {}) {
  if (!tuitionRecord) {
    return { ok: false, skipped: true, error: 'Missing tuition record.' }
  }

  const entityLocalId = createTuitionRecordPackageLocalId(tuitionRecord)
  const afterPayload = tuitionRecord && typeof tuitionRecord === 'object' ? { ...tuitionRecord } : null
  const changedFields = getChangedFields(beforePayload, afterPayload)
  const action = getC53TuitionAuditAction(reason, beforePayload)

  const result = await writeC53AuditLogEntry({
    supabase,
    centerId,
    userId,
    accessState,
    entry: {
      entityType: 'tuition_record_package',
      entityLocalId,
      action,
      beforePayload,
      afterPayload,
      changedFields,
      reason,
    },
  })

  if (!result.ok && !result.skipped) {
    console.warn('C5.3C audit_log_entry write failed; tuition save remains local/cloud safe.', result.error || result)
  }

  return result
}

function getC53TuitionAuditAction(reason, beforePayload) {
  if (reason === 'tuition-payment-save') {
    return 'payment_update'
  }

  if (!beforePayload) {
    return 'create'
  }

  if (reason === 'tuition-package-save') {
    return 'update'
  }

  return 'unknown_update'
}

async function openTuitionRollbackPreview(tuitionRecord) {
  const entityLocalId = createTuitionRecordPackageLocalId(tuitionRecord)

  tuitionRollbackPreviewState = {
    status: 'loading',
    tuitionId: tuitionRecord.id,
    entityLocalId,
    entries: [],
    previews: [],
    message: 'Đang tải lịch sử thay đổi...',
  }
  tuitionFormState = null
  tuitionPaymentFormState = null
  tuitionDetailState = null
  render()

  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (!readiness.ok) {
    tuitionRollbackPreviewState = {
      status: 'error',
      tuitionId: tuitionRecord.id,
      entityLocalId,
      entries: [],
      previews: [],
      message: readiness.error || 'Không đọc được audit log để xem trước.',
    }
    render()
    return
  }

  const accessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(readiness.user),
    user: readiness.user,
    centerId: readiness.centerId,
    membership: readiness.membership,
    role: readiness.membership?.role,
    cloudReady: readiness.ready !== false,
  })
  const result = await loadAuditEntriesForEntity({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    entityType: 'tuition_record_package',
    entityLocalId,
    accessState,
  })

  if (!result.ok) {
    tuitionRollbackPreviewState = {
      status: 'error',
      tuitionId: tuitionRecord.id,
      entityLocalId,
      entries: [],
      previews: [],
      message: result.error || 'Không có quyền xem bản xem trước khôi phục.',
    }
    render()
    return
  }

  const previews = result.entries.map((entry) => buildRollbackPreviewFromAuditEntry(entry))
  tuitionRollbackPreviewState = {
    status: result.empty ? 'empty' : 'ready',
    tuitionId: tuitionRecord.id,
    entityLocalId,
    entries: result.entries,
    previews,
    message: result.empty
      ? 'Không có bản ghi audit để xem trước.'
      : `Đã tải ${previews.length} bản ghi lịch sử thay đổi.`,
  }
  render()
}

async function startC52TuitionRealtimeSubscription(syncId = cloudUserSyncId) {
  if (!canUseCoreCloudDb() || c52TuitionRealtimeCenterId === getCurrentResolvedCenterId()) {
    return
  }

  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (syncId !== cloudUserSyncId || !readiness.ok) {
    return
  }

  stopC52TuitionRealtimeSubscription()

  const accessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(readiness.user),
    user: readiness.user,
    centerId: readiness.centerId,
    membership: readiness.membership,
    role: readiness.membership?.role,
    cloudReady: true,
  })
  const subscription = subscribeToC52TuitionRecordPackageRealtime({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    accessState,
    onCloudRecord: handleC52TuitionRealtimeRecord,
    onStatusChange: handleC52TuitionRealtimeStatus,
  })

  if (!subscription.ok) {
    cloudDbState = {
      ...cloudDbState,
      message: subscription.message,
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  c52TuitionRealtimeSubscription = subscription
  c52TuitionRealtimeCenterId = readiness.centerId
}

function stopC52TuitionRealtimeSubscription() {
  c52TuitionRealtimeSubscription?.cleanup?.()
  c52TuitionRealtimeSubscription = null
  c52TuitionRealtimeCenterId = ''
}

function handleC52TuitionRealtimeStatus(status) {
  if (!status || status.status !== 'CHANNEL_ERROR' && status.status !== 'TIMED_OUT') {
    return
  }

  cloudDbState = {
    ...cloudDbState,
    message: status.message || 'C5.2C tuition realtime degraded; giu cache local.',
    messageTone: 'error',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
}

function handleC52TuitionRealtimeRecord(record) {
  const mergeResult = mergeC52TuitionCloudRecordsIntoLocal({
    tuitionRecords,
    cloudRecords: [record],
  })

  if (!mergeResult.ok || !mergeResult.changed) {
    return
  }

  tuitionRecords = mergeResult.tuitionRecords
  saveStoredTuition(tuitionRecords)
  notifications = syncTuitionNotifications(notifications)
  render()
}

function queueCoreCloudSync(reason = 'auto') {
  if (!isCoreCloudDbReady()) {
    return
  }

  if (coreCloudSyncTimer) {
    clearTimeout(coreCloudSyncTimer)
  }

  coreCloudSyncTimer = window.setTimeout(() => {
    coreCloudSyncTimer = null
    syncCoreEntitiesToCloud(reason)
  }, 500)
}

async function syncCoreEntitiesToCloud(reason = 'auto') {
  if (!isCoreCloudDbReady()) {
    return
  }

  const writeAccess = buildCurrentOnlineAccessState({ cloudReady: true })

  if (!canWriteEntity(writeAccess, CLOUD_ENTITY_TYPES.STUDENT)) {
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      message: getOnlineAccessMessage(writeAccess),
      messageTone: 'error',
    }
    render()
    return
  }

  const runId = ++coreCloudSyncRunId
  cloudDbState = {
    ...cloudDbState,
    isLoading: true,
    message: 'Dang ghi Cloud DB C2 cho Hoc vien/Giao vien/Ca hoc...',
    messageTone: '',
  }
  render()

  const result = await pushLocalCoreEntitiesToCloud({
    centerId: getCurrentResolvedCenterId(),
    students,
    teachers,
    classSessions,
  })

  if (runId !== coreCloudSyncRunId) {
    return
  }

  cloudDbState = {
    ...cloudDbState,
    isLoading: false,
    cloudCounts: result.ok ? result.counts || createEmptyCloudEntityCounts() : cloudDbState.cloudCounts,
    message: result.ok
      ? `Da ghi Cloud DB C2 (${reason}): Hoc vien ${result.counts.student}, Giao vien ${result.counts.teacher}, Ca hoc ${result.counts.class_session}.`
      : result.error,
    messageTone: result.ok ? 'success' : 'error',
    lastUpdatedAt: result.ok ? new Date().toISOString() : cloudDbState.lastUpdatedAt,
  }
  render()
}

function getCoreCloudSnapshotCounts(snapshot = {}) {
  return {
    [CLOUD_ENTITY_TYPES.STUDENT]: Array.isArray(snapshot.students) ? snapshot.students.length : 0,
    [CLOUD_ENTITY_TYPES.TEACHER]: Array.isArray(snapshot.teachers) ? snapshot.teachers.length : 0,
    [CLOUD_ENTITY_TYPES.CLASS_SESSION]: Array.isArray(snapshot.classSessions)
      ? snapshot.classSessions.length
      : 0,
  }
}

function isCoreCloudSnapshotEmpty(snapshot = {}) {
  return Object.values(getCoreCloudSnapshotCounts(snapshot)).every((count) => count === 0)
}

function applyCoreCloudSnapshotToLocal(snapshot) {
  const backupResult = createCloudDbPullBackup(window.localStorage)

  if (backupResult && typeof backupResult === 'object' && backupResult.ok === false) {
    return {
      ok: false,
      error: backupResult.error,
      reason: backupResult.reason,
      backupKey: null,
      counts: getCoreCloudSnapshotCounts({ students, teachers, classSessions }),
    }
  }

  const backupKey = typeof backupResult === 'string' ? backupResult : null
  students = Array.isArray(snapshot.students) ? snapshot.students : []
  teachers = Array.isArray(snapshot.teachers) ? snapshot.teachers : []
  classSessions = Array.isArray(snapshot.classSessions) ? snapshot.classSessions : []
  saveStoredStudents(students)
  saveStoredTeachers(teachers)
  saveStoredClassSessions(classSessions)
  students = getStoredStudents([])
  teachers = getStoredTeachers([])
  classSessions = getStoredClassSessions([])

  return {
    ok: true,
    backupKey,
    counts: getCoreCloudSnapshotCounts({ students, teachers, classSessions }),
  }
}

function applyCloudBootstrapSnapshotToLocal(snapshot) {
  const backupResult = createCloudDbPullBackup(window.localStorage)

  if (backupResult && typeof backupResult === 'object' && backupResult.ok === false) {
    return {
      ok: false,
      error: backupResult.error,
      reason: backupResult.reason,
      backupKey: null,
      counts: getCloudBootstrapSnapshotCounts({ students, teachers, scheduleSessions }),
    }
  }

  const backupKey = typeof backupResult === 'string' ? backupResult : null

  if (Array.isArray(snapshot.students) && snapshot.students.length > 0) {
    students = snapshot.students
    saveStoredStudents(students)
    students = getStoredStudents([])
  }

  if (Array.isArray(snapshot.teachers) && snapshot.teachers.length > 0) {
    teachers = snapshot.teachers
    saveStoredTeachers(teachers)
    teachers = getStoredTeachers([])
  }

  if (Array.isArray(snapshot.scheduleSessions) && snapshot.scheduleSessions.length > 0) {
    scheduleSessions = snapshot.scheduleSessions
    saveStoredSchedule(scheduleSessions)
    scheduleSessions = getStoredSchedule([])
  }

  return {
    ok: true,
    backupKey,
    counts: getCloudBootstrapSnapshotCounts({ students, teachers, scheduleSessions }),
  }
}

function restoreAngelWingsLocalDataset() {
  const backup = createF15K5BackupSnapshot(window.localStorage)
  const result = upsertAngelWingsAttendanceData()

  students = result.students
  teachers = mergeAngelWingsTeacherRoster(result.teachers, result.students)
  parentConsultations = result.parentConsultations
  classSessions = result.classSessions
  tuitionRecords = result.tuitionRecords
  scheduleSessions = result.schedule
  sessionReports = result.sessionReports
  attendanceAdvisoryNotes = result.attendanceAdvisoryNotes

  saveStoredStudents(students)
  saveStoredTeachers(teachers)
  saveStoredParentConsultations(parentConsultations)
  saveStoredClassSessions(classSessions)
  writeAngelWingsPackageCatalog(window.localStorage, result.tuitionPackages)
  saveStoredTuition(tuitionRecords)
  saveStoredSchedule(scheduleSessions)
  saveStoredSessionReports(sessionReports)
  saveStoredAttendanceAdvisoryNotes(attendanceAdvisoryNotes)

  studentFilters = {
    ...studentFilters,
    selectedStudentId: students[0]?.id || null,
  }
  teacherFilters = { ...initialTeacherFilters }
  settingsFilters = { ...initialSettingsFilters }
  settingsClassSessionFormState = null
  studentFormState = null
  teacherFormState = null
  selectedTeacherId = ANGEL_WINGS_TEACHER_ID

  cloudDbState = {
    ...cloudDbState,
    cloudCounts: cloudDbState.cloudCounts,
    message: `Đã khôi phục Angel Wings 06/2026 vào local: ${students.length} học viên, ${teachers.length} giáo viên, ${classSessions.length} ca học. Chưa đẩy cloud. Backup: ${backup?.backupKey || 'không tạo được'}.`,
    messageTone: 'success',
  }

  openModuleWindow('hoc-vien')
}

async function refreshCloudDbReadiness({ showLoading = false } = {}) {
  if (!canUseCoreCloudDb()) {
    cloudDbState = {
      ...cloudDbState,
      readinessStatus: 'blocked',
      cloudCounts: null,
      message: cloudStatus.membershipStatus === 'loaded'
        ? `Không đọc được Cloud DB do quyền/RLS của center ${getCurrentResolvedCenterId()}. Kiểm tra center_members và policy.`
        : `User hiện tại chưa có membership center_members với center_id = ${getCurrentResolvedCenterId()}.`,
      messageTone: 'error',
    }
    if (showLoading) {
      render()
    }
    return { ok: false, ready: false, error: cloudDbState.message }
  }

  if (showLoading) {
    cloudDbState = {
      ...cloudDbState,
      isLoading: true,
      readinessStatus: 'checking',
      cloudCounts: null,
      message: 'Đang kiểm tra Cloud DB C2.2 readiness...',
      messageTone: '',
    }
    render()
  }

  const result = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  cloudDbState = {
    ...cloudDbState,
    isLoading: false,
    readinessStatus: result.ok ? 'ready' : 'error',
    cloudCounts: result.ok ? cloudDbState.cloudCounts : null,
    message: result.ok ? '' : result.error,
    messageTone: result.ok ? '' : 'error',
    lastUpdatedAt: result.ok ? cloudDbState.lastUpdatedAt : new Date().toISOString(),
  }

  if (showLoading || !result.ok) {
    render()
  }

  return result
}

async function refreshCloudDbCounts() {
  cloudDbState = {
    ...cloudDbState,
    isLoading: true,
    readinessStatus: 'checking',
    cloudCounts: null,
    message: '',
    messageTone: '',
  }
  render()

  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (!readiness.ok) {
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      readinessStatus: 'error',
      cloudCounts: null,
      message: readiness.error,
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  const result = await getCloudEntityCounts({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
  })

  cloudDbState = {
    ...cloudDbState,
    isLoading: false,
    readinessStatus: result.ok ? 'ready' : 'error',
    cloudCounts: result.ok ? result.counts : null,
    message: result.ok ? 'Đã làm mới số liệu Cloud DB C2.' : result.error,
    messageTone: result.ok ? 'success' : 'error',
    lastUpdatedAt: result.ok ? new Date().toISOString() : cloudDbState.lastUpdatedAt,
  }
  render()
}

async function pushCloudDbSnapshot() {
  const readiness = await refreshCloudDbReadiness({ showLoading: true })

  if (!readiness.ok) {
    return
  }

  const writeAccess = buildCurrentOnlineAccessState({ cloudReady: true })

  if (!canWriteEntity(writeAccess, CLOUD_ENTITY_TYPES.STUDENT)) {
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      message: getOnlineAccessMessage(writeAccess),
      messageTone: 'error',
    }
    render()
    return
  }

  const angelWingsStatus = getLocalAngelWingsStatus()

  if (!angelWingsStatus.isReadyForCloudPush) {
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      message: angelWingsStatus.looksLikeOldSeed
        ? 'Local đang giống seed cũ 8 học viên. Hãy khôi phục Angel Wings 06/2026 trước khi đẩy cloud.'
        : 'Local chưa có đủ marker Angel Wings 06/2026. Hãy khôi phục/kiểm tra local trước khi đẩy cloud.',
      messageTone: 'error',
    }
    render()
    return
  }

  cloudDbState = {
    ...cloudDbState,
    isLoading: true,
    message: '',
    messageTone: '',
  }
  render()

  const result = await pushLocalCoreEntitiesToCloud({
    centerId: getCurrentResolvedCenterId(),
    students,
    teachers,
    classSessions,
  })

  if (!result.ok) {
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      message: result.error,
      messageTone: 'error',
    }
    render()
    return
  }

  cloudDbState = {
    ...cloudDbState,
    isLoading: false,
    cloudCounts: result.counts || createEmptyCloudEntityCounts(),
    message: `Đã đẩy local lên cloud: Học viên ${result.counts.student}, Giáo viên ${result.counts.teacher}, Ca học ${result.counts.class_session}.`,
    messageTone: 'success',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
}

async function pullCloudDbSnapshotToLocal() {
  const readiness = await refreshCloudDbReadiness({ showLoading: true })

  if (!readiness.ok) {
    return
  }

  cloudDbState = {
    ...cloudDbState,
    isLoading: true,
    message: '',
    messageTone: '',
  }
  render()

  const result = await pullCoreEntitiesFromCloud(getCurrentResolvedCenterId())

  if (!result.ok) {
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      message: result.error,
      messageTone: 'error',
    }
    render()
    return
  }

  const counts = getCoreCloudSnapshotCounts(result.data)

  if (isCoreCloudSnapshotEmpty(result.data)) {
    if (isProductionCenter(readiness.centerId)) {
      reloadLocalDataForResolvedCenter({ useSampleFallback: false })
      cloudDbState = {
        ...cloudDbState,
        isLoading: false,
        cloudCounts: counts,
        message: 'Cloud DB C2 production empty. Local cache for this center was reset to empty.',
        messageTone: 'success',
        lastUpdatedAt: new Date().toISOString(),
      }
      render()
      return
    }

    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      cloudCounts: counts,
      message: 'Cloud DB C2 is empty. Local data was kept unchanged.',
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  const appliedSnapshot = applyCoreCloudSnapshotToLocal(result.data)

  if (!appliedSnapshot.ok) {
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      cloudCounts: counts,
      message: appliedSnapshot.error,
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  cloudDbState = {
    ...cloudDbState,
    isLoading: false,
    cloudCounts: appliedSnapshot.counts,
    message: `Pulled Cloud DB C2 to local. Backup: ${appliedSnapshot.backupKey || 'not created'}.`,
    messageTone: 'success',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
}

async function bootstrapCoreCloudDataForCurrentCenter(syncId = cloudUserSyncId) {
  const context = getCurrentCloudBootstrapContext()
  const now = Date.now()

  if (!canRunCloudBootstrap(context) || cloudDbAutoPullUserId === cloudStatus.user?.id) {
    return
  }

  if (cloudBootstrapRetryBlockedUntil > now) {
    cloudBootstrapState = {
      ...cloudBootstrapState,
      status:
        cloudBootstrapState.status === CLOUD_BOOTSTRAP_STATUS.LOADING
          ? CLOUD_BOOTSTRAP_STATUS.ERROR
          : cloudBootstrapState.status,
      source: cloudBootstrapState.source || 'local-cache',
      message: cloudBootstrapState.message || 'Cloud pull đang tạm dừng sau lỗi 400; giữ cache/local.',
    }
    return
  }

  cloudDbAutoPullUserId = cloudStatus.user?.id || ''
  const hasUsableLocalCache = hasCloudBootstrapSnapshotData({ students, teachers, scheduleSessions })

  if (!hasUsableLocalCache) {
    cloudBootstrapState = {
      ...cloudBootstrapState,
      status: CLOUD_BOOTSTRAP_STATUS.LOADING,
      source: 'loading',
      message: 'Đang tải dữ liệu cloud...',
      lastUpdatedAt: new Date().toISOString(),
    }
    cloudDbState = {
      ...cloudDbState,
      isLoading: true,
      message: 'Đang tải dữ liệu cloud cho Học viên, Giáo viên và TKB...',
      messageTone: '',
    }
    render()
  } else {
    cloudBootstrapState = {
      ...cloudBootstrapState,
      status: CLOUD_BOOTSTRAP_STATUS.IDLE,
      source: 'local-cache',
      message: 'Dữ liệu: Cache cục bộ (đang kiểm cloud nền)',
      lastUpdatedAt: new Date().toISOString(),
    }
  }

  const centerId = context.centerBinding.currentCenterId
  const result = await pullCloudBootstrapCoreEntities(centerId)

  if (syncId !== cloudUserSyncId) {
    return
  }

  if (!result.ok) {
    const failureSignature = `${result.detail?.status || ''}:${result.detail?.code || ''}:${result.detail?.category || ''}:${result.error || ''}`
    const isSchemaOrBadRequest =
      result.detail?.status === 400 || result.detail?.category === 'schema-not-ready'

    if (isSchemaOrBadRequest) {
      cloudBootstrapRetryBlockedUntil = Date.now() + 5 * 60 * 1000
      cloudBootstrapLastFailureSignature = failureSignature
    }

    cloudBootstrapState = {
      ...cloudBootstrapState,
      status: CLOUD_BOOTSTRAP_STATUS.ERROR,
      source: 'local-cache',
      message: isSchemaOrBadRequest
        ? 'Dữ liệu: Cache cục bộ (cloud lỗi 400/schema, tạm dừng pull)'
        : 'Dữ liệu: Cache cục bộ (cloud lỗi, đang giữ local)',
      counts: null,
      lastUpdatedAt: new Date().toISOString(),
    }
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      readinessStatus: 'error',
      cloudCounts: null,
      message: result.error || cloudBootstrapState.message,
      messageTone: 'error',
      lastUpdatedAt: cloudBootstrapState.lastUpdatedAt,
    }
    render()
    return
  }

  const counts = result.counts || getCloudBootstrapSnapshotCounts(result.data)
  const hasCloudScheduleSessions = Array.isArray(result.data?.scheduleSessions) &&
    result.data.scheduleSessions.length > 0

  if (result.empty || !hasCloudBootstrapSnapshotData(result.data)) {
    if (isProductionCenter(centerId)) {
      reloadLocalDataForResolvedCenter({ useSampleFallback: false })
      cloudBootstrapState = {
        ...cloudBootstrapState,
        status: CLOUD_BOOTSTRAP_STATUS.EMPTY,
        source: 'cloud-empty',
        message: 'Dữ liệu: Cloud',
        counts,
        lastUpdatedAt: new Date().toISOString(),
      }
      cloudDbState = {
        ...cloudDbState,
        isLoading: false,
        readinessStatus: 'ready',
        cloudCounts: cloudDbState.cloudCounts,
        message: cloudBootstrapState.message,
        messageTone: '',
        lastUpdatedAt: cloudBootstrapState.lastUpdatedAt,
      }
      render()
      return
    }

    cloudBootstrapState = {
      ...cloudBootstrapState,
      status: CLOUD_BOOTSTRAP_STATUS.EMPTY,
      source: 'local-cache',
      message: 'Cloud chưa có dữ liệu cho center này. Đang dùng cache/staging local.',
      counts,
      lastUpdatedAt: new Date().toISOString(),
    }
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      readinessStatus: 'ready',
      cloudCounts: cloudDbState.cloudCounts,
      message: cloudBootstrapState.message,
      messageTone: '',
      lastUpdatedAt: cloudBootstrapState.lastUpdatedAt,
    }
    render()
    return
  }

  const appliedSnapshot = applyCloudBootstrapSnapshotToLocal(result.data)

  if (!appliedSnapshot.ok) {
    cloudBootstrapState = {
      ...cloudBootstrapState,
      status: CLOUD_BOOTSTRAP_STATUS.ERROR,
      source: 'local-cache',
      message: 'Không thể lưu cache cloud. Đang giữ dữ liệu cục bộ hiện tại.',
      counts,
      lastUpdatedAt: new Date().toISOString(),
    }
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      readinessStatus: 'ready',
      cloudCounts: cloudDbState.cloudCounts,
      message: appliedSnapshot.error,
      messageTone: 'error',
      lastUpdatedAt: cloudBootstrapState.lastUpdatedAt,
    }
    render()
    return
  }

  if (!hasCloudScheduleSessions) {
    cloudBootstrapState = {
      ...cloudBootstrapState,
      status: CLOUD_BOOTSTRAP_STATUS.FALLBACK,
      source: 'local-cache',
      message: 'Dữ liệu: Cache cục bộ (cloud schedule_session trống; TKB dùng local fallback)',
      counts,
      lastUpdatedAt: new Date().toISOString(),
    }
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      readinessStatus: 'ready',
      cloudCounts: cloudDbState.cloudCounts,
      message: cloudBootstrapState.message,
      messageTone: '',
      lastUpdatedAt: cloudBootstrapState.lastUpdatedAt,
    }
    render()
    return
  }

  cloudBootstrapState = {
    ...cloudBootstrapState,
    status: CLOUD_BOOTSTRAP_STATUS.CLOUD,
    source: 'cloud',
    message: 'Dữ liệu: Cloud',
    counts: appliedSnapshot.counts,
    lastUpdatedAt: new Date().toISOString(),
  }
  cloudDbState = {
    ...cloudDbState,
    isLoading: false,
    readinessStatus: 'ready',
    cloudCounts: cloudDbState.cloudCounts,
    message: `Đã tải dữ liệu cloud vào cache local. Backup: ${appliedSnapshot.backupKey || 'không tạo được'}.`,
    messageTone: 'success',
    lastUpdatedAt: cloudBootstrapState.lastUpdatedAt,
  }
  render()
}

async function autoPullCoreCloudSnapshot(syncId = cloudUserSyncId) {
  if (!canUseCoreCloudDb() || cloudDbAutoPullUserId === cloudStatus.user?.id) {
    return
  }

  cloudDbAutoPullUserId = cloudStatus.user?.id || ''
  const readiness = await refreshCloudDbReadiness({ showLoading: true })

  if (syncId !== cloudUserSyncId || !readiness.ok) {
    return
  }

  cloudDbState = {
    ...cloudDbState,
    isLoading: true,
    message: 'Checking Cloud DB C2 data...',
    messageTone: '',
  }
  render()

  const result = await pullCoreEntitiesFromCloud(getCurrentResolvedCenterId())

  if (syncId !== cloudUserSyncId) {
    return
  }

  if (!result.ok) {
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      message: result.error,
      messageTone: 'error',
    }
    render()
    return
  }

  const counts = getCoreCloudSnapshotCounts(result.data)

  if (isCoreCloudSnapshotEmpty(result.data)) {
    if (isProductionCenter(readiness.centerId)) {
      reloadLocalDataForResolvedCenter({ useSampleFallback: false })
      cloudDbState = {
        ...cloudDbState,
        isLoading: false,
        cloudCounts: counts,
        message: 'Cloud DB C2 production empty after sign-in. Local cache for this center was reset to empty.',
        messageTone: 'success',
        lastUpdatedAt: new Date().toISOString(),
      }
      render()
      return
    }

    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      cloudCounts: counts,
      message: 'Cloud DB C2 has no core data yet. Local data was kept unchanged.',
      messageTone: 'success',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  const appliedSnapshot = applyCoreCloudSnapshotToLocal(result.data)

  if (!appliedSnapshot.ok) {
    cloudDbState = {
      ...cloudDbState,
      isLoading: false,
      cloudCounts: counts,
      message: appliedSnapshot.error,
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return
  }

  cloudDbState = {
    ...cloudDbState,
    isLoading: false,
    cloudCounts: appliedSnapshot.counts,
    message: `Pulled Cloud DB C2 after sign-in. Backup: ${appliedSnapshot.backupKey || 'not created'}.`,
    messageTone: 'success',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
}

async function loadCenterMemberProfiles(syncId = cloudUserSyncId) {
  const result = await getMemberProfileMap()

  if (syncId !== cloudUserSyncId) {
    return
  }

  const memberProfileMap = result.ok ? result.data : {}

  cloudStatus = {
    ...cloudStatus,
    memberProfileMap,
    currentMemberProfile: cloudStatus.user?.id
      ? memberProfileMap[cloudStatus.user.id] ?? null
      : null,
    profileStatus: result.ok
      ? 'loaded'
      : result.schemaUnavailable
        ? 'unavailable'
        : 'error',
    profileMessage:
      result.ok || result.schemaUnavailable
        ? ''
        : 'Không thể tải hồ sơ thành viên. Đang dùng tên fallback.',
    profileMessageTone: result.ok ? 'success' : 'error',
  }

  if (transactionImageManagerState) {
    transactionImageManagerState = {
      ...transactionImageManagerState,
      currentUser: cloudStatus.user,
      memberProfileMap,
    }
  }

  if (cloudGalleryState) {
    cloudGalleryState = {
      ...cloudGalleryState,
      currentUser: cloudStatus.user,
      memberProfileMap,
    }
  }

  render()
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

function getTransactionIdsByCode() {
  const transactionCodes = getCashflowTransactionCodes()

  return Object.entries(transactionCodes).reduce(
    (transactionIdsByCode, [transactionId, transactionCode]) => {
      if (transactionCode) {
        transactionIdsByCode[transactionCode] = transactionId
      }

      return transactionIdsByCode
    },
    {},
  )
}

async function openCloudGallery() {
  if (
    cloudStatus.configStatus !== 'configured' ||
    cloudStatus.authStatus !== 'signed-in'
  ) {
    setCloudUploadMessage('Vui lòng đăng nhập Supabase Cloud trước.', 'error')
    return
  }

  if (cloudStatus.membershipStatus !== 'loaded' || !cloudStatus.role) {
    setCloudUploadMessage('Tài khoản chưa được cấp quyền cho DreamHome.', 'error')
    return
  }

  cloudGalleryState = {
    monthKey: getCurrentMonthKey(),
    query: '',
    attachments: [],
    status: 'loading',
    error: '',
    message: '',
    messageTone: '',
    currentUser: cloudStatus.user,
    memberProfileMap: cloudStatus.memberProfileMap,
    transactionIdsByCode: getTransactionIdsByCode(),
  }
  render()
  await loadCloudGalleryAttachments()
}

async function loadCloudGalleryAttachments() {
  if (!cloudGalleryState) {
    return
  }

  const monthKey = cloudGalleryState.monthKey
  const result = await listTransactionAttachmentsByMonth({ monthKey })

  if (cloudGalleryState?.monthKey !== monthKey) {
    return
  }

  const attachments = result.ok ? await addSignedUrlsToAttachments(result.data) : []

  if (cloudGalleryState?.monthKey !== monthKey) {
    return
  }

  cloudGalleryState = {
    ...cloudGalleryState,
    attachments,
    status: result.ok ? 'loaded' : 'error',
    error: result.ok
      ? ''
      : result.error || 'Không thể tải kho ảnh cloud.',
    currentUser: cloudStatus.user,
    memberProfileMap: cloudStatus.memberProfileMap,
    transactionIdsByCode: getTransactionIdsByCode(),
  }
  render()
}

function closeCloudGallery() {
  cloudGalleryState = null
  render()
}

async function openTransactionImageManagerFromGallery(transactionCode) {
  const transactionId = getTransactionIdsByCode()[transactionCode]

  if (!transactionId) {
    cloudGalleryState = {
      ...cloudGalleryState,
      message: 'Không tìm thấy giao dịch local tương ứng.',
      messageTone: 'error',
    }
    render()
    return
  }

  cloudGalleryState = null
  await openTransactionImageManager(transactionId)
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
    memberProfileMap: cloudStatus.memberProfileMap,
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
  if (cloudGalleryState) {
    await loadCloudGalleryAttachments()
  }
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
    uploadedByName: getUploaderDisplayName(
      { uploadedBy: cloudStatus.user?.id },
      cloudStatus.user,
      cloudStatus.memberProfileMap,
    ),
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
  if (cloudGalleryState) {
    await loadCloudGalleryAttachments()
  }
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

  onSupabaseAuthStateChange((event, user) => {
    if (
      ['INITIAL_SESSION', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event) &&
      shouldSkipDuplicateCloudUserSync(user, event)
    ) {
      return
    }

    window.setTimeout(() => {
      syncCloudUser(user, { reason: event })
    }, 0)
  })

  try {
    const user = await getCurrentSupabaseUser()
    await syncCloudUser(user, { reason: 'initial-get-user' })
  } catch (error) {
    cloudStatus = {
      ...cloudStatus,
      authStatus: 'signed-out',
      user: null,
      role: null,
      centerId: '',
      centerName: '',
      membership: null,
      memberships: [],
      membershipStatus: 'idle',
      message: getCloudErrorMessage(error, 'Không thể kiểm tra phiên đăng nhập Supabase.'),
      attachments: [],
      attachmentsStatus: 'idle',
      attachmentsError: '',
      attachmentsMonthKey: '',
      memberProfileMap: {},
      currentMemberProfile: null,
      profileStatus: 'idle',
      profileMessage: '',
      profileMessageTone: '',
    }
    render()
  }
}

function bindEvents() {
  bindStartMenuOutsidePointer()
  bindWindowOverflowOutsidePointer()
  bindNotificationOutsidePointer()
  bindCenterProfileOutsidePointer()
  bindModuleNotificationOutsidePointer()
  bindPreservedScrollRetentionEvents()

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
    isCenterProfilePopoverOpen = false
    render()
  })

  document.querySelector('[data-action="toggle-window-overflow"]')?.addEventListener('click', () => {
    isWindowOverflowOpen = !isWindowOverflowOpen
    isStartMenuOpen = false
    isNotificationCenterOpen = false
    isCenterProfilePopoverOpen = false
    render()
  })

  document.querySelector('[data-action="toggle-notifications"]')?.addEventListener('click', (event) => {
    notificationPanelPosition = getNotificationPanelPosition(event.currentTarget)
    isNotificationCenterOpen = !isNotificationCenterOpen
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    isCenterProfilePopoverOpen = false
    render()
  })

  document.querySelector('[data-action="toggle-center-profile"]')?.addEventListener('click', () => {
    isCenterProfilePopoverOpen = !isCenterProfilePopoverOpen
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    isNotificationCenterOpen = false
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
      openNotificationSourceModule(notificationElement.dataset.notificationId)
    })

    notificationElement.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      markNotificationRead(notificationElement.dataset.notificationId)
      openNotificationSourceModule(notificationElement.dataset.notificationId)
    })
  })

  document.querySelectorAll('[data-notification-filter]').forEach((control) => {
    control.addEventListener('change', () => {
      notificationFilters = {
        ...notificationFilters,
        [control.dataset.notificationFilter]: control.value,
      }
      render()
    })
  })

  document.querySelectorAll('[data-notification-module-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const moduleId = button.dataset.notificationModuleId
      if (!moduleId || !modules.some((moduleItem) => moduleItem.id === moduleId)) {
        return
      }

      isNotificationCenterOpen = false
      openModuleWindow(moduleId)
    })
  })

  document.querySelectorAll('[data-notification-action="mark-read"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      markNotificationRead(button.dataset.notificationId)
    })
  })

  document.querySelector('[data-notification-action="mark-all-read"]')?.addEventListener('click', () => {
    const visibleNotificationIds = filterNotifications(getCenterScopedNotificationsForRender(), {
      readState: notificationFilters.readState,
    })
      .filter((notification) => !notification.readAt)
      .map((notification) => notification.id)

    notifications = markNotificationsReadByIds(notifications, visibleNotificationIds)
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
      focusElementWithoutScrolling(nextControl)

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
      focusElementWithoutScrolling(nextControl)

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
        centerId: '',
        centerName: '',
        membership: null,
        memberships: [],
        membershipStatus: 'idle',
        message: getCloudErrorMessage(error, 'Không thể đăng nhập. Vui lòng kiểm tra email và mật khẩu.'),
        attachments: [],
        attachmentsStatus: 'idle',
        attachmentsError: '',
        attachmentsMonthKey: '',
        memberProfileMap: {},
        currentMemberProfile: null,
        profileStatus: 'idle',
        profileMessage: '',
        profileMessageTone: '',
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

  document
    .querySelector('[data-cloud-action="open-gallery"]')
    ?.addEventListener('click', async () => {
      await openCloudGallery()
    })

  document.querySelector('[data-cloud-profile-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    cloudStatus = {
      ...cloudStatus,
      profileStatus: 'saving',
      profileMessage: '',
      profileMessageTone: '',
    }
    render()

    const result = await updateMyCenterMemberProfile({
      displayName: formData.get('displayName'),
      memberLabel: formData.get('memberLabel'),
      emailSnapshot: cloudStatus.user?.email,
    })

    if (!result.ok) {
      cloudStatus = {
        ...cloudStatus,
        profileStatus: result.schemaUnavailable ? 'unavailable' : 'error',
        profileMessage:
          'Chưa thể lưu hồ sơ cloud. Vui lòng kiểm tra SQL S5/policy.',
        profileMessageTone: 'error',
      }
      render()
      return
    }

    await loadCenterMemberProfiles()
    cloudStatus = {
      ...cloudStatus,
      profileStatus: 'loaded',
      profileMessage: 'Đã lưu hồ sơ cloud.',
      profileMessageTone: 'success',
    }
    render()
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
      focusElementWithoutScrolling(nextControl)

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelectorAll('[data-report-filter]').forEach((control) => {
    control.addEventListener('input', () => {
      const value =
        control.dataset.reportFilter === 'weekStartDate'
          ? getWeekStartDate(control.value)
          : control.value

      reportState = {
        ...reportState,
        filters: {
          ...reportState.filters,
          [control.dataset.reportFilter]: value,
        },
        selectedBarDetail: null,
      }
      render()
    })
  })

  document.querySelector('.report-module')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-report-week-action]')

    if (!button) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const weekStartDate = getNextReportWeekStartDate(
      reportState.filters.weekStartDate,
      button.dataset.reportWeekAction,
    )

    reportState = {
      ...reportState,
      filters: {
        ...reportState.filters,
        weekStartDate,
      },
      selectedBarDetail: null,
    }
    render()
  })

  document.querySelectorAll('[data-staff-filter]').forEach((control) => {
    const eventName = control.tagName === 'SELECT' ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      staffFilters = {
        ...staffFilters,
        [control.dataset.staffFilter]: control.value,
      }
      render()
    })
  })

  document.querySelectorAll('[data-report-draft-field]').forEach((control) => {
    control.addEventListener('input', () => {
      reportState = {
        ...reportState,
        draft: {
          ...reportState.draft,
          [control.dataset.reportDraftField]: control.value,
        },
      }
    })
  })

  document.querySelectorAll('[data-report-pending-task]').forEach((control) => {
    control.addEventListener('change', () => {
      reportState = {
        ...reportState,
        draft: {
          ...reportState.draft,
          pendingTasks: {
            ...(reportState.draft.pendingTasks || {}),
            [control.dataset.reportPendingTask]: control.checked,
          },
        },
      }
    })
  })

  document.querySelectorAll('[data-finance-open-module]').forEach((button) => {
    button.addEventListener('click', () => {
      openModuleWindow(button.dataset.financeOpenModule)
    })
  })

  document.querySelector('[data-report-action="print"]')?.addEventListener('click', () => {
    const attendanceRecords = buildUnifiedAttendanceRecords({
      sessionReports,
      storedRecords: loadStoredAttendanceRecords(getCurrentResolvedCenterId()),
    })
    const printWindow = window.open('', 'ichess-report-print', 'width=960,height=720')

    if (!printWindow) {
      return
    }

    printWindow.document.open()
    printWindow.document.write(
      buildReportPrintHtml({
        filters: reportState.filters,
        draft: reportState.draft,
        students,
        cashflowTransactions,
        attendanceRecords,
      }),
    )
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  })

  document.querySelectorAll('[data-report-bar-detail]').forEach((button) => {
    button.addEventListener('click', () => {
      reportState = {
        ...reportState,
        selectedBarDetail: {
          type: button.dataset.reportBarType,
          label: button.dataset.reportBarLabel,
          weekLabel: button.dataset.reportBarWeek,
          value: Number(button.dataset.reportBarValue || 0),
          source: button.dataset.reportBarSource,
        },
      }
      render()
    })
  })

  document.querySelector('[data-report-action="download"]')?.addEventListener('click', () => {
    const attendanceRecords = buildUnifiedAttendanceRecords({
      sessionReports,
      storedRecords: loadStoredAttendanceRecords(getCurrentResolvedCenterId()),
    })
    const content = buildReportDownloadText({
      filters: reportState.filters,
      draft: reportState.draft,
      students,
      cashflowTransactions,
      attendanceRecords,
    })
    const blob = new Blob([`\uFEFF${content}`], {
      type: 'text/plain;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = getReportDownloadFilename(reportState.filters.reportDate)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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
      focusElementWithoutScrolling(nextControl)

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

  document.querySelectorAll('[data-inventory-request-action="open-panel"]').forEach((button) => {
    button.addEventListener('click', () => {
      isInventoryRequestsPanelOpen = true
      inventoryRequestFormState = null
      selectedInventoryRequestId = null
      inventoryRequestStatusFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-inventory-request-action="close-panel"]').forEach((button) => {
    button.addEventListener('click', () => {
      isInventoryRequestsPanelOpen = false
      inventoryRequestFormState = null
      selectedInventoryRequestId = null
      inventoryRequestStatusFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-inventory-request-filter]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      const filterName = control.dataset.inventoryRequestFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      inventoryRequestFilters = {
        ...inventoryRequestFilters,
        [filterName]: control.value,
      }
      render()

      const nextControl = document.querySelector(`[data-inventory-request-filter="${filterName}"]`)
      focusElementWithoutScrolling(nextControl)

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelectorAll('[data-inventory-request-action="open-create"]').forEach((button) => {
    button.addEventListener('click', () => {
      inventoryRequestFormState = createEmptyInventoryRequestFormState()
      selectedInventoryRequestId = null
      inventoryRequestStatusFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-inventory-request-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      inventoryRequestFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-inventory-request-field]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      if (!inventoryRequestFormState) {
        return
      }

      inventoryRequestFormState = {
        ...inventoryRequestFormState,
        values: {
          ...inventoryRequestFormState.values,
          [control.dataset.inventoryRequestField]: control.value,
        },
        errors: {
          ...inventoryRequestFormState.errors,
          [control.dataset.inventoryRequestField]: undefined,
        },
      }
    })
  })

  document.querySelectorAll('[data-inventory-request-list-field]').forEach((control) => {
    control.addEventListener('change', () => {
      if (!inventoryRequestFormState) {
        return
      }

      const fieldName = control.dataset.inventoryRequestListField
      const selectedValues = Array.from(
        document.querySelectorAll(`[data-inventory-request-list-field="${fieldName}"]:checked`),
      ).map((checkbox) => checkbox.value)

      inventoryRequestFormState = {
        ...inventoryRequestFormState,
        values: {
          ...inventoryRequestFormState.values,
          [fieldName]: selectedValues,
        },
        errors: {
          ...inventoryRequestFormState.errors,
          [fieldName]: undefined,
        },
      }

      if (control.value === 'other') {
        render()
      }
    })
  })

  document.querySelector('[data-inventory-request-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!inventoryRequestFormState) {
      return
    }

    const errors = validateInventoryRequestForm(inventoryRequestFormState.values)

    if (Object.keys(errors).length) {
      inventoryRequestFormState = {
        ...inventoryRequestFormState,
        errors,
      }
      render()
      return
    }

    const request = buildInventoryRequestFromForm(
      inventoryRequestFormState.values,
      null,
      inventoryRequests,
    )
    inventoryRequests = [request, ...inventoryRequests]
    saveStoredInventoryRequests(inventoryRequests)
    notifications = syncAppNotifications(notifications)
    inventoryRequestFormState = null
    selectedInventoryRequestId = request.id
    inventoryRequestStatusFormState = createInventoryRequestStatusFormState(request)
    render()
  })

  document.querySelectorAll('[data-inventory-request-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const request = inventoryRequests.find((item) => item.id === row.dataset.inventoryRequestId)

      selectedInventoryRequestId = row.dataset.inventoryRequestId
      inventoryRequestFormState = null
      inventoryRequestStatusFormState = createInventoryRequestStatusFormState(request)
      render()
    })

    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      const request = inventoryRequests.find((item) => item.id === row.dataset.inventoryRequestId)

      selectedInventoryRequestId = row.dataset.inventoryRequestId
      inventoryRequestFormState = null
      inventoryRequestStatusFormState = createInventoryRequestStatusFormState(request)
      render()
    })
  })

  document.querySelectorAll('[data-inventory-request-detail-action="close"]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedInventoryRequestId = null
      inventoryRequestStatusFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-inventory-request-status-field]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      if (!inventoryRequestStatusFormState) {
        return
      }

      inventoryRequestStatusFormState = {
        ...inventoryRequestStatusFormState,
        values: {
          ...inventoryRequestStatusFormState.values,
          [control.dataset.inventoryRequestStatusField]: control.value,
        },
        errors: {
          ...inventoryRequestStatusFormState.errors,
          [control.dataset.inventoryRequestStatusField]: undefined,
        },
      }
    })
  })

  document.querySelector('[data-inventory-request-status-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!inventoryRequestStatusFormState) {
      return
    }

    const errors = validateInventoryRequestStatusForm(inventoryRequestStatusFormState.values)

    if (Object.keys(errors).length) {
      inventoryRequestStatusFormState = {
        ...inventoryRequestStatusFormState,
        errors,
      }
      render()
      return
    }

    const request = inventoryRequests.find((item) => item.id === inventoryRequestStatusFormState.requestId)

    if (!request) {
      return
    }

    const updatedRequest = updateInventoryRequestStatus(request, inventoryRequestStatusFormState.values)
    inventoryRequests = inventoryRequests.map((item) =>
      item.id === updatedRequest.id ? updatedRequest : item,
    )
    saveStoredInventoryRequests(inventoryRequests)
    notifications = syncAppNotifications(notifications)
    selectedInventoryRequestId = updatedRequest.id
    inventoryRequestStatusFormState = createInventoryRequestStatusFormState(updatedRequest)
    render()
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

  document
    .querySelectorAll('[data-cloud-gallery-action="close"]')
    .forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        closeCloudGallery()
      })
    })

  document.querySelector('[data-cloud-gallery-month]')?.addEventListener('change', async (event) => {
    if (!cloudGalleryState || !/^\d{4}-\d{2}$/.test(event.target.value)) {
      return
    }

    cloudGalleryState = {
      ...cloudGalleryState,
      monthKey: event.target.value,
      attachments: [],
      status: 'loading',
      error: '',
      message: '',
      messageTone: '',
    }
    render()
    await loadCloudGalleryAttachments()
  })

  document.querySelector('[data-cloud-gallery-search]')?.addEventListener('input', (event) => {
    if (!cloudGalleryState) {
      return
    }

    const selectionStart = event.target.selectionStart
    const selectionEnd = event.target.selectionEnd
    cloudGalleryState = {
      ...cloudGalleryState,
      query: event.target.value,
      message: '',
      messageTone: '',
    }
    render()

    const nextInput = document.querySelector('[data-cloud-gallery-search]')
    focusElementWithoutScrolling(nextInput)
    if (
      selectionStart !== null &&
      selectionEnd !== null &&
      'setSelectionRange' in nextInput
    ) {
      nextInput.setSelectionRange(selectionStart, selectionEnd)
    }
  })

  document
    .querySelectorAll('[data-cloud-gallery-action="manage"]')
    .forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation()
        await openTransactionImageManagerFromGallery(button.dataset.transactionCode)
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
      tuitionRollbackPreviewState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-row-student-id]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (
        event.target.closest('[data-tuition-action="open-debt"]') ||
        event.target.closest('[data-tuition-action="open-detail"]') ||
        event.target.closest('[data-tuition-action="open-rollback-preview"]')
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
        event.target.closest('[data-tuition-action="open-detail"]') ||
        event.target.closest('[data-tuition-action="open-rollback-preview"]')
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
      tuitionRollbackPreviewState = null
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
      tuitionRollbackPreviewState = null
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
      tuitionRollbackPreviewState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-action="open-rollback-preview"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const tuitionRecord = tuitionRecords.find((record) => record.id === button.dataset.tuitionId)

      if (!tuitionRecord) {
        return
      }

      void openTuitionRollbackPreview(tuitionRecord)
    })
  })

  document.querySelectorAll('[data-tuition-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionFormState = null
      tuitionRollbackPreviewState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-payment-action="cancel-payment"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionPaymentFormState = null
      tuitionRollbackPreviewState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-detail-action="close-detail"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionDetailState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-rollback-preview-action="close"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionRollbackPreviewState = null
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
        focusElementWithoutScrolling(nextControl)

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
    const savedAt = new Date().toISOString()
    const nextRecord = tuitionFormState.mode === 'renew' && currentRecord
      ? {
          ...createRenewedTuitionRecord(currentRecord, normalizedValues),
          updatedAt: savedAt,
        }
      : {
          id: tuitionFormState.tuitionId || `tuition-${tuitionFormState.studentId}-${Date.now()}`,
          studentId: tuitionFormState.studentId,
          ...normalizedValues,
          payments: currentRecord?.payments ?? [],
          currentTermNumber: currentRecord?.currentTermNumber ?? 1,
          currentTermId:
            currentRecord?.currentTermId ??
            `term-${tuitionFormState.tuitionId || tuitionFormState.studentId}-${Date.now()}`,
          startedAt: currentRecord?.startedAt ?? savedAt,
          termHistory: currentRecord?.termHistory ?? [],
          createdAt: currentRecord?.createdAt ?? savedAt,
          updatedAt: savedAt,
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
    void writeC52TuitionRecordPackageThroughCloud(nextRecord, 'tuition-package-save', {
      beforePayload: currentRecord ? { ...currentRecord } : null,
    })
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
        focusElementWithoutScrolling(nextControl)
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
    const savedAt = new Date().toISOString()
    const paymentRecord = {
      id: `payment-${tuitionPaymentFormState.tuitionId}-${Date.now()}`,
      ...normalizedPayment,
      createdAt: savedAt,
    }
    const beforePaymentTuitionRecord =
      tuitionRecords.find((record) => record.id === tuitionPaymentFormState.tuitionId) || null
    let updatedTuitionRecord = null

    tuitionRecords = tuitionRecords.map((record) => {
      if (record.id !== tuitionPaymentFormState.tuitionId) {
        return record
      }

      updatedTuitionRecord = {
        ...record,
        paidAmount: record.paidAmount + normalizedPayment.amount,
        payments: [paymentRecord, ...(record.payments ?? [])],
        updatedAt: savedAt,
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
    void writeC52TuitionRecordPackageThroughCloud(updatedTuitionRecord, 'tuition-payment-save', {
      beforePayload: beforePaymentTuitionRecord ? { ...beforePaymentTuitionRecord } : null,
    })
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
      focusElementWithoutScrolling(nextControl)

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelectorAll('[data-settings-filter]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      const filterName = control.dataset.settingsFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      settingsFilters = {
        ...settingsFilters,
        [filterName]: control.value,
      }
      render()

      const nextControl = document.querySelector(`[data-settings-filter="${filterName}"]`)
      focusElementWithoutScrolling(nextControl)

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelector('[data-cloud-db-action="refresh"]')?.addEventListener('click', () => {
    refreshCloudDbCounts()
  })

  document.querySelector('[data-cloud-db-action="restore-angel-wings-local"]')?.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Khôi phục controlled dataset Angel Wings 06/2026 vào local? App sẽ backup các key liên quan trước khi replace. Thao tác này KHÔNG đẩy dữ liệu lên cloud.',
    )

    if (!confirmed) {
      return
    }

    restoreAngelWingsLocalDataset()
  })

  document.querySelector('[data-cloud-db-action="push"]')?.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Đẩy snapshot local của Học viên, Giáo viên và Ca học/Lớp lên Cloud DB C2? Thao tác này không thay đổi local và không sync học phí/điểm danh/thu chi.',
    )

    if (!confirmed) {
      return
    }

    pushCloudDbSnapshot()
  })

  document.querySelector('[data-cloud-db-action="pull"]')?.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Tải Cloud DB C2 về local sẽ replace 3 nhóm local: Học viên, Giáo viên và Ca học/Lớp. App sẽ backup 3 key này trước khi replace. Tiếp tục?',
    )

    if (!confirmed) {
      return
    }

    pullCloudDbSnapshotToLocal()
  })

  document.querySelectorAll('[data-attendance-board-filter]').forEach((control) => {
    const eventName = control.matches('select') || control.type === 'month' ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      const filterName = control.dataset.attendanceBoardFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      attendanceBoardFilters = {
        ...attendanceBoardFilters,
        [filterName]: control.value,
      }
      attendanceBoardDetailState = null
      render()

      const nextControl = document.querySelector(`[data-attendance-board-filter="${filterName}"]`)
      focusElementWithoutScrolling(nextControl)

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelectorAll('[data-attendance-cell-detail]').forEach((button) => {
    button.addEventListener('click', () => {
      attendanceBoardDetailState = {
        studentId: button.dataset.studentId || '',
        dateKey: button.dataset.dateKey || '',
      }
      render()
    })
  })

  document.querySelectorAll('[data-attendance-detail-close]').forEach((button) => {
    button.addEventListener('click', () => {
      attendanceBoardDetailState = null
      render()
    })
  })

  document.querySelectorAll('[data-attendance-note-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const studentId = button.dataset.studentId || ''
      const existingNote = attendanceBoardNotes.find(
        (note) => note.studentId === studentId && note.month === attendanceBoardFilters.month,
      )
      attendanceBoardNoteFormState = {
        studentId,
        month: attendanceBoardFilters.month,
        note: existingNote?.note || '',
      }
      render()
    })
  })

  document.querySelector('[data-attendance-note-field]')?.addEventListener('input', (event) => {
    if (!attendanceBoardNoteFormState) {
      return
    }

    attendanceBoardNoteFormState = {
      ...attendanceBoardNoteFormState,
      note: event.target.value,
    }
  })

  document.querySelectorAll('[data-attendance-note-cancel]').forEach((button) => {
    button.addEventListener('click', () => {
      attendanceBoardNoteFormState = null
      render()
    })
  })

  document.querySelector('[data-attendance-note-save]')?.addEventListener('click', () => {
    if (!attendanceBoardNoteFormState) {
      return
    }

    const now = new Date().toISOString()
    const noteIdentity = `${attendanceBoardNoteFormState.studentId}:${attendanceBoardNoteFormState.month}`
    const existingNote = attendanceBoardNotes.find(
      (note) => `${note.studentId}:${note.month}` === noteIdentity,
    )
    const nextNote = {
      id:
        existingNote?.id ||
        `attendance-board-note-${attendanceBoardNoteFormState.studentId}-${attendanceBoardNoteFormState.month}`,
      studentId: attendanceBoardNoteFormState.studentId,
      month: attendanceBoardNoteFormState.month,
      note: String(attendanceBoardNoteFormState.note || '').trim(),
      createdAt: existingNote?.createdAt || now,
      updatedAt: now,
    }

    attendanceBoardNotes = [
      nextNote,
      ...attendanceBoardNotes.filter((note) => `${note.studentId}:${note.month}` !== noteIdentity),
    ]
    saveStoredAttendanceBoardNotes(attendanceBoardNotes)
    attendanceBoardNoteFormState = null
    render()
  })

  document.querySelector('[data-attendance-baseline-action="start"]')?.addEventListener('click', () => {
    const nextState = startAttendanceBaselineDraft(loadAttendanceBaselineState(getCurrentResolvedCenterId()), {
      byRole: 'admin',
      byName: 'Admin cơ sở',
      note: 'Bắt đầu nhập dữ liệu nền điểm danh.',
    })
    saveAttendanceBaselineState(getCurrentResolvedCenterId(), nextState)
    void writeC51AttendanceSessionReportThroughCloud({
      baselineState: nextState,
      reason: 'baseline-start',
    })
    attendanceBaselineUndoSnapshot = null
    render()
  })

  document.querySelectorAll('[data-attendance-baseline-cell-input]').forEach((input) => {
    input.addEventListener('change', () => {
      commitAttendanceBaselineCellInput(input)
    })

    input.addEventListener('keydown', (event) => {
      const keyDirections = {
        ArrowLeft: 'previous',
        ArrowRight: 'next',
        ArrowUp: 'up',
        ArrowDown: 'down',
        Enter: event.shiftKey ? 'up' : 'down',
      }
      const direction = event.key === 'Tab'
        ? event.shiftKey ? 'previous' : 'next'
        : keyDirections[event.key]

      if (!direction) {
        return
      }

      event.preventDefault()
      const focusTarget = getAttendanceBaselineNavigationTarget(input, direction)
      commitAttendanceBaselineCellInput(input, { focusTarget })
    })
  })

  document.querySelector('[data-attendance-baseline-action="save"]')?.addEventListener('click', () => {
    if (!hasAttendanceBaselineDraftChanges()) {
      return
    }

    const currentState = getAttendanceBaselineDraftState()
    if (currentState.status === 'locked') {
      window.alert('Dữ liệu nền đã khóa, cần mở khóa trước khi lưu thay đổi.')
      render()
      return
    }

    const draftRecords = getAttendanceBaselineDraftRecords()
    const nextState = saveAttendanceBaselineDraftState(currentState, {
      byRole: 'admin',
      byName: 'Admin cơ sở',
      note: 'Lưu thay đổi dữ liệu nền điểm danh.',
    })

    saveStoredAttendanceRecords(getCurrentResolvedCenterId(), draftRecords)
    saveAttendanceBaselineState(getCurrentResolvedCenterId(), nextState)
    void writeC51AttendanceSessionReportThroughCloud({
      attendanceRecords: draftRecords.filter((record) => record.source === 'initialBaseline'),
      baselineState: nextState,
      reason: 'baseline-save',
    })
    clearAttendanceBaselineDraft()
    attendanceBaselineUndoSnapshot = null
    attendanceBoardDetailState = null
    render()
  })

  document.querySelector('[data-attendance-baseline-action="cancel"]')?.addEventListener('click', () => {
    if (!hasAttendanceBaselineDraftChanges()) {
      return
    }

    if (!window.confirm('Hủy các thay đổi dữ liệu nền chưa lưu?')) {
      return
    }

    clearAttendanceBaselineDraft()
    attendanceBaselineUndoSnapshot = null
    attendanceBoardDetailState = null
    render()
  })

  document.querySelector('[data-attendance-baseline-action="clear"]')?.addEventListener('click', () => {
    const currentState = loadAttendanceBaselineState(getCurrentResolvedCenterId())

    if (currentState.status === 'locked') {
      window.alert('Dữ liệu nền đã khóa, cần mở khóa trước khi xóa dữ liệu nền đang nhập.')
      render()
      return
    }

    if (hasAttendanceBaselineDraftChanges()) {
      const confirmedDraft = window.confirm(
        'Bạn đang có thay đổi chưa lưu. Xóa dữ liệu nền sẽ hủy các thay đổi chưa lưu trong phạm vi này.',
      )

      if (!confirmedDraft) {
        return
      }
    }

    const confirmed = window.confirm(
      'Bạn chắc chắn muốn xóa dữ liệu nền đang nhập trong tháng đang xem? Thao tác này chỉ xóa dữ liệu nền, không xóa dữ liệu điểm danh gốc/import.',
    )

    if (!confirmed) {
      return
    }

    const storedRecords = loadStoredAttendanceRecords(getCurrentResolvedCenterId())
    const storedState = loadAttendanceBaselineState(getCurrentResolvedCenterId())
    const clearResult = clearInitialBaselineAttendanceRecordsInMonth({
      records: storedRecords,
      state: storedState,
      month: attendanceBoardFilters.month,
      byRole: 'admin',
      byName: 'Admin cơ sở',
    })

    if (clearResult.blocked) {
      window.alert('Không thể xóa dữ liệu nền khi dữ liệu nền đang khóa.')
      render()
      return
    }

    attendanceBaselineUndoSnapshot = {
      type: 'clear',
      records: storedRecords,
      state: storedState,
      draftRecords: attendanceBaselineDraftRecords,
      draftBaseRecords: attendanceBaselineDraftBaseRecords,
      draftState: attendanceBaselineDraftState,
    }
    saveStoredAttendanceRecords(getCurrentResolvedCenterId(), clearResult.records)
    saveAttendanceBaselineState(getCurrentResolvedCenterId(), clearResult.state)
    void writeC51AttendanceSessionReportThroughCloud({
      attendanceRecords: clearResult.records.filter((record) => record.source === 'initialBaseline'),
      baselineState: clearResult.state,
      reason: 'baseline-clear',
    })
    clearAttendanceBaselineDraft()
    attendanceBoardDetailState = null
    render()
  })

  document.querySelector('[data-attendance-baseline-action="undo"]')?.addEventListener('click', () => {
    if (!attendanceBaselineUndoSnapshot) {
      window.alert('Chưa có thao tác nào để hoàn tác.')
      return
    }

    if (attendanceBaselineUndoSnapshot.type === 'draft') {
      restoreAttendanceBaselineDraftUndoSnapshot(attendanceBaselineUndoSnapshot)
    } else if (attendanceBaselineUndoSnapshot.type === 'clear') {
      const restored = restoreInitialBaselineEditSnapshot(attendanceBaselineUndoSnapshot)
      saveStoredAttendanceRecords(getCurrentResolvedCenterId(), restored.records)
      saveAttendanceBaselineState(getCurrentResolvedCenterId(), restored.state)
      void writeC51AttendanceSessionReportThroughCloud({
        attendanceRecords: restored.records.filter((record) => record.source === 'initialBaseline'),
        baselineState: restored.state,
        reason: 'baseline-undo-clear',
      })
      attendanceBaselineDraftRecords = Array.isArray(attendanceBaselineUndoSnapshot.draftRecords)
        ? attendanceBaselineUndoSnapshot.draftRecords
        : null
      attendanceBaselineDraftBaseRecords = Array.isArray(attendanceBaselineUndoSnapshot.draftBaseRecords)
        ? attendanceBaselineUndoSnapshot.draftBaseRecords
        : null
      attendanceBaselineDraftState = attendanceBaselineUndoSnapshot.draftState || null
    } else {
      const restored = restoreInitialBaselineEditSnapshot(attendanceBaselineUndoSnapshot)
      saveStoredAttendanceRecords(getCurrentResolvedCenterId(), restored.records)
      saveAttendanceBaselineState(getCurrentResolvedCenterId(), restored.state)
      void writeC51AttendanceSessionReportThroughCloud({
        attendanceRecords: restored.records.filter((record) => record.source === 'initialBaseline'),
        baselineState: restored.state,
        reason: 'baseline-undo',
      })
    }

    attendanceBaselineUndoSnapshot = null
    attendanceBoardDetailState = null
    render()
  })

  document.querySelector('[data-attendance-baseline-action="lock"]')?.addEventListener('click', () => {
    if (hasAttendanceBaselineDraftChanges()) {
      window.alert('Bạn còn thay đổi dữ liệu nền chưa lưu. Vui lòng lưu hoặc hủy thay đổi trước khi chốt dữ liệu nền.')
      return
    }

    const baselineRecords = loadStoredAttendanceRecords(getCurrentResolvedCenterId())
      .filter((record) => record.source === 'initialBaseline')
    const confirmMessage = baselineRecords.length
      ? 'Bạn chắc chắn muốn chốt dữ liệu nền điểm danh? Sau khi khóa, dữ liệu nền sẽ không được sửa tự do.'
      : 'Hiện chưa có bản ghi dữ liệu nền nào. Bạn vẫn muốn khóa dữ liệu nền?'

    if (!window.confirm(confirmMessage)) {
      return
    }

    const nextState = lockAttendanceBaselineState(loadAttendanceBaselineState(getCurrentResolvedCenterId()), {
      byRole: 'admin',
      byName: 'Admin cơ sở',
      note: baselineRecords.length
        ? 'Chốt dữ liệu nền điểm danh.'
        : 'Chốt dữ liệu nền khi chưa có bản ghi nền.',
    })
    saveAttendanceBaselineState(getCurrentResolvedCenterId(), nextState)
    void writeC51AttendanceSessionReportThroughCloud({
      baselineState: nextState,
      reason: 'baseline-lock',
    })
    attendanceBaselineUndoSnapshot = null
    render()
  })

  document.querySelector('[data-attendance-baseline-action="unlock"]')?.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Bạn chắc chắn muốn mở khóa dữ liệu điểm danh? Việc này có thể ảnh hưởng số buổi đã học, số buổi còn lại, học phí và bảng điểm danh.',
    )

    if (!confirmed) {
      return
    }

    const reason = window.prompt('Lý do mở khóa', '') || ''
    const nextState = unlockAttendanceBaselineState(loadAttendanceBaselineState(getCurrentResolvedCenterId()), {
      byRole: 'admin',
      byName: 'Admin cơ sở',
      reason: reason.trim() || 'Không ghi lý do',
      note: 'Mở khóa dữ liệu nền điểm danh.',
    })
    saveAttendanceBaselineState(getCurrentResolvedCenterId(), nextState)
    void writeC51AttendanceSessionReportThroughCloud({
      baselineState: nextState,
      reason: 'baseline-unlock',
    })
    attendanceBaselineUndoSnapshot = null
    render()
  })

  document.querySelector('[data-attendance-board-angel-wings-action="load"]')?.addEventListener('click', () => {
    const confirmed = window.confirm(
      'N\u1ea1p controlled dataset Angel Wings 06/2026 v\u00e0 replace c\u00e1c key li\u00ean quan: H\u1ecdc vi\u00ean, Gi\u00e1o vi\u00ean, Ph\u1ee5 huynh, Ca h\u1ecdc/Gi\u00e1 g\u00f3i, H\u1ecdc ph\u00ed, Th\u1eddi kh\u00f3a bi\u1ec3u v\u00e0 sessionReports? H\u1ec7 th\u1ed1ng s\u1ebd backup tr\u01b0\u1edbc khi ghi.',
    )

    if (!confirmed) {
      return
    }

    createF15K5BackupSnapshot(window.localStorage)
    const result = upsertAngelWingsAttendanceData()

    students = result.students
    teachers = mergeAngelWingsTeacherRoster(teachers, result.students)
    parentConsultations = result.parentConsultations
    classSessions = result.classSessions
    tuitionRecords = result.tuitionRecords
    scheduleSessions = result.schedule
    sessionReports = result.sessionReports
    attendanceAdvisoryNotes = result.attendanceAdvisoryNotes
    saveStoredStudents(students)
    saveStoredTeachers(teachers)
    saveStoredParentConsultations(parentConsultations)
    saveStoredClassSessions(classSessions)
    writeAngelWingsPackageCatalog(window.localStorage, result.tuitionPackages)
    saveStoredTuition(tuitionRecords)
    saveStoredSchedule(scheduleSessions)
    saveStoredSessionReports(sessionReports)
    saveStoredAttendanceAdvisoryNotes(attendanceAdvisoryNotes)
    render()
  })

  document.querySelector('[data-attendance-board-angel-wings-action="clear"]')?.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Xóa dữ liệu nhập Angel Wings khỏi sessionReports và fixture học phí Angel Wings? Học viên thật và dữ liệu khác sẽ được giữ nguyên.',
    )

    if (!confirmed) {
      return
    }

    createF15K5BackupSnapshot(window.localStorage)
    const result = removeAngelWingsAttendanceData()

    students = result.students
    teachers = mergeAngelWingsTeacherRoster(teachers, result.students)
    parentConsultations = result.parentConsultations
    classSessions = result.classSessions
    tuitionRecords = result.tuitionRecords
    scheduleSessions = result.schedule
    sessionReports = result.sessionReports
    attendanceAdvisoryNotes = result.attendanceAdvisoryNotes
    saveStoredStudents(students)
    saveStoredTeachers(teachers)
    saveStoredParentConsultations(parentConsultations)
    saveStoredClassSessions(classSessions)
    writeAngelWingsPackageCatalog(window.localStorage, result.tuitionPackages)
    saveStoredTuition(tuitionRecords)
    saveStoredSchedule(scheduleSessions)
    saveStoredSessionReports(sessionReports)
    saveStoredAttendanceAdvisoryNotes(attendanceAdvisoryNotes)
    render()
  })

  document.querySelector('[data-attendance-board-demo-action="clear"]')?.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Ch\u1ec9 x\u00f3a demo c\u0169 F15K.1/F15K.3, kh\u00f4ng x\u00f3a d\u1eef li\u1ec7u th\u1eadt ho\u1eb7c Angel Wings. Ti\u1ebfp t\u1ee5c?',
    )

    if (!confirmed) {
      return
    }

    sessionReports = removeLegacyDemoAttendanceReports(removeDemoAttendanceReports(sessionReports))
    saveStoredSessionReports(sessionReports)
    render()
  })

  document.querySelector('[data-settings-class-session-action="open-create"]')?.addEventListener(
    'click',
    () => {
      settingsClassSessionFormState = createEmptySettingsClassSessionFormState()
      render()
    },
  )

  document.querySelectorAll('[data-settings-class-session-action="open-edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const classSession = classSessions.find(
        (item) => item.id === button.dataset.classSessionId,
      )

      if (!classSession) {
        return
      }

      settingsClassSessionFormState = createEditSettingsClassSessionFormState(classSession)
      render()
    })
  })

  document.querySelectorAll('[data-settings-class-session-action="toggle-status"]').forEach((button) => {
    button.addEventListener('click', () => {
      const classSession = classSessions.find(
        (item) => item.id === button.dataset.classSessionId,
      )

      if (!classSession) {
        return
      }

      const studentCount = getClassSessionStudentCount(classSession.id, students)
      const nextStatus = classSession.status === 'inactive' ? 'active' : 'inactive'

      if (nextStatus === 'inactive' && studentCount > 0) {
        const confirmed = window.confirm(
          `Ca học này đang có ${studentCount} học viên. Ngưng dùng ca học? Học viên cũ vẫn giữ liên kết nhưng ca này sẽ không hiện trong lựa chọn mới.`,
        )

        if (!confirmed) {
          return
        }
      }

      classSessions = classSessions.map((item) =>
        item.id === classSession.id
          ? {
              ...item,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
            }
          : item,
      )
      saveStoredClassSessions(classSessions)
      queueCoreCloudSync('class-session-status')
      render()
    })
  })

  document.querySelectorAll('[data-settings-class-session-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      settingsClassSessionFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-settings-class-session-field]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      if (!settingsClassSessionFormState) {
        return
      }

      settingsClassSessionFormState = {
        ...settingsClassSessionFormState,
        values: {
          ...settingsClassSessionFormState.values,
          [control.dataset.settingsClassSessionField]: control.value,
        },
        errors: {
          ...settingsClassSessionFormState.errors,
          [control.dataset.settingsClassSessionField]: '',
        },
      }
    })
  })

  document.querySelectorAll('[data-settings-class-session-day]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      if (!settingsClassSessionFormState) {
        return
      }

      const selectedDays = Array.from(
        document.querySelectorAll('[data-settings-class-session-day]:checked'),
      ).map((item) => item.value)

      settingsClassSessionFormState = {
        ...settingsClassSessionFormState,
        values: {
          ...settingsClassSessionFormState.values,
          daysOfWeek: selectedDays,
        },
        errors: {
          ...settingsClassSessionFormState.errors,
          daysOfWeek: '',
        },
      }
    })
  })

  document.querySelector('[data-settings-class-session-action="save-form"]')?.addEventListener(
    'click',
    () => {
      if (!settingsClassSessionFormState) {
        return
      }

      const errors = validateSettingsClassSessionForm(settingsClassSessionFormState.values)

      if (Object.keys(errors).length) {
        settingsClassSessionFormState = {
          ...settingsClassSessionFormState,
          errors,
        }
        render()
        return
      }

      const existingClassSession = settingsClassSessionFormState.classSessionId
        ? classSessions.find(
            (item) => item.id === settingsClassSessionFormState.classSessionId,
          )
        : null
      const nextClassSession = buildSettingsClassSessionFromForm(
        settingsClassSessionFormState.values,
        existingClassSession,
        classSessions,
      )

      classSessions = existingClassSession
        ? classSessions.map((item) =>
            item.id === nextClassSession.id ? nextClassSession : item,
          )
        : [nextClassSession, ...classSessions]
      saveStoredClassSessions(classSessions)
      queueCoreCloudSync('class-session-save')
      settingsClassSessionFormState = null
      render()
    },
  )

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
      focusElementWithoutScrolling(nextControl)

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelectorAll('[data-parent-note-history-contact-id]').forEach((button) => {
    button.addEventListener('click', () => {
      parentNoteHistoryContactId = button.dataset.parentNoteHistoryContactId
      render()
    })
  })

  document.querySelectorAll('[data-parent-note-history-action="close"]').forEach((button) => {
    button.addEventListener('click', () => {
      parentNoteHistoryContactId = null
      render()
    })
  })

  document.querySelectorAll('[data-parent-quick-note-contact-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const contact = parentConsultations.find(
        (item) => item.id === button.dataset.parentQuickNoteContactId,
      )

      if (!contact) {
        return
      }

      parentQuickNoteState = {
        contactId: contact.id,
        content: '',
        error: '',
      }
      render()
    })
  })

  document.querySelector('[data-parent-quick-note-field="content"]')?.addEventListener('input', (event) => {
    if (!parentQuickNoteState) {
      return
    }

    parentQuickNoteState = {
      ...parentQuickNoteState,
      content: event.currentTarget.value,
      error: '',
    }
  })

  document.querySelectorAll('[data-parent-quick-note-action="cancel"]').forEach((button) => {
    button.addEventListener('click', () => {
      parentQuickNoteState = null
      render()
    })
  })

  document.querySelector('[data-parent-quick-note-action="save"]')?.addEventListener('click', () => {
    if (!parentQuickNoteState) {
      return
    }

    const noteContent = String(parentQuickNoteState.content || '').trim()

    if (!noteContent) {
      parentQuickNoteState = {
        ...parentQuickNoteState,
        error: 'Vui lòng nhập nội dung ghi chú.',
      }
      render()
      return
    }

    const existingContact = parentConsultations.find(
      (item) => item.id === parentQuickNoteState.contactId,
    )

    if (!existingContact) {
      parentQuickNoteState = null
      render()
      return
    }

    const updatedContact = addQuickNoteToParentContact(existingContact, noteContent)
    parentConsultations = parentConsultations.map((contact) =>
      contact.id === updatedContact.id ? updatedContact : contact,
    )
    saveStoredParentConsultations(parentConsultations)
    notifications = syncAppNotifications(notifications)
    parentQuickNoteState = null
    render()
  })

  document.querySelectorAll('[data-parent-contact-field]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      if (!parentConsultationFormState) {
        return
      }

      const fieldName = control.dataset.parentContactField
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null
      const fieldValue = fieldName === 'studentBirthYear'
        ? control.value.replace(/\D/g, '').slice(0, 4)
        : control.value

      if (fieldName === 'studentBirthYear' && control.value !== fieldValue) {
        control.value = fieldValue
      }

      parentConsultationFormState = {
        ...parentConsultationFormState,
        values: {
          ...parentConsultationFormState.values,
          [fieldName]: fieldValue,
          ...(fieldName === 'studentBirthYear'
            ? { leadStudentAge: calculateParentContactAgeFromBirthYear(fieldValue) }
            : {}),
        },
        errors: {
          ...parentConsultationFormState.errors,
          [fieldName]: '',
        },
      }

      if (fieldName === 'studentSearch' || fieldName === 'studentBirthYear') {
        render()

        const nextControl = document.querySelector(`[data-parent-contact-field="${fieldName}"]`)
        focusElementWithoutScrolling(nextControl)

        if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
          nextControl.setSelectionRange(cursorPosition, cursorPosition)
        }
      }
    })
  })

  document.querySelector('[data-parent-contact-form-scroll]')?.addEventListener('scroll', (event) => {
    if (!parentConsultationFormState) {
      return
    }

    parentConsultationFormState = {
      ...parentConsultationFormState,
      scrollTop: event.currentTarget.scrollTop,
    }
  })

  document.querySelectorAll('[data-parent-contact-step]').forEach((button) => {
    if (!button.matches('button')) {
      return
    }

    button.addEventListener('click', () => {
      if (!parentConsultationFormState) {
        return
      }

      const nextStep = clampParentContactWizardStep(button.dataset.parentContactStep)

      parentConsultationFormState = {
        ...parentConsultationFormState,
        activeStep: nextStep,
        scrollTop: 0,
      }
      skipNextParentContactScrollCapture = true
      render()
    })
  })

  document.querySelectorAll('[data-parent-contact-step-move]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!parentConsultationFormState) {
        return
      }

      const direction = Number.parseInt(button.dataset.parentContactStepMove, 10)
      const nextStep = clampParentContactWizardStep(
        (parentConsultationFormState.activeStep || 1) + direction,
      )

      parentConsultationFormState = {
        ...parentConsultationFormState,
        activeStep: nextStep,
        scrollTop: 0,
      }
      skipNextParentContactScrollCapture = true
      render()
    })
  })

  document.querySelectorAll('[data-parent-student-select-id]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!parentConsultationFormState) {
        return
      }

      const selectedStudent = students.find((student) => student.id === button.dataset.parentStudentSelectId)

      if (!selectedStudent) {
        return
      }

      parentConsultationFormState = {
        ...parentConsultationFormState,
        values: {
          ...parentConsultationFormState.values,
          studentId: selectedStudent.id,
          studentName: selectedStudent.fullName,
          studentSearch: selectedStudent.fullName,
        },
      }
      render()
    })
  })

  document.querySelector('[data-parent-student-clear]')?.addEventListener('click', () => {
    if (!parentConsultationFormState) {
      return
    }

    parentConsultationFormState = {
      ...parentConsultationFormState,
      values: {
        ...parentConsultationFormState.values,
        studentId: '',
        studentName: '',
        studentSearch: '',
      },
    }
    render()
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
    notifications = syncAppNotifications(notifications)
      parentConsultationFormState = {
        ...createEditParentContactFormState(updatedContact),
        activeStep: parentConsultationFormState.activeStep,
        scrollTop: parentConsultationFormState.scrollTop || 0,
      }
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
      const fieldValue = fieldName === 'studentBirthYear'
        ? control.value.replace(/\D/g, '').slice(0, 4)
        : control.value

      if (fieldName === 'studentBirthYear' && control.value !== fieldValue) {
        control.value = fieldValue
      }

      parentConsultationFormState = {
        ...parentConsultationFormState,
        enrollmentDraft: {
          ...parentConsultationFormState.enrollmentDraft,
          [fieldName]: fieldValue,
          ...(fieldName === 'studentBirthYear'
            ? { studentAge: calculateParentContactAgeFromBirthYear(fieldValue) }
            : {}),
        },
        enrollmentErrors: {
          ...(parentConsultationFormState.enrollmentErrors ?? {}),
          [fieldName]: '',
          summary: '',
        },
        enrollmentMessage: '',
      }

      if (fieldName === 'studentBirthYear') {
        const cursorPosition = 'selectionStart' in control ? control.selectionStart : null
        render()

        const nextControl = document.querySelector('[data-parent-enrollment-field="studentBirthYear"]')
        focusElementWithoutScrolling(nextControl)

        if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
          nextControl.setSelectionRange(cursorPosition, cursorPosition)
        }
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
    notifications = syncAppNotifications(notifications)

      if (parentConsultationFormState?.contactId === contact.id) {
        parentConsultationFormState = null
      }

      if (parentQuickNoteState?.contactId === contact.id) {
        parentQuickNoteState = null
      }

      if (parentNoteHistoryContactId === contact.id) {
        parentNoteHistoryContactId = null
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

  document.querySelectorAll('[data-parent-contact-action="save-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!parentConsultationFormState) {
        return
      }

      const errors = validateParentContactForm(parentConsultationFormState.values)

      if (Object.keys(errors).length) {
        parentConsultationFormState = {
          ...parentConsultationFormState,
          activeStep: getParentContactStepForErrors(errors),
          scrollTop: 0,
          errors,
        }
        skipNextParentContactScrollCapture = true
        render()
        return
      }

      const existingContact =
        parentConsultationFormState.mode === 'edit'
          ? parentConsultations.find((contact) => contact.id === parentConsultationFormState.contactId)
          : null
      const baseContact = buildParentContactFromForm(
        parentConsultationFormState.values,
        existingContact,
        students,
      )
      const nextContact = saveEnrollmentDraftToParentContact(
        baseContact,
        parentConsultationFormState.enrollmentDraft,
      )

      parentConsultations = existingContact
        ? parentConsultations.map((contact) =>
            contact.id === existingContact.id ? nextContact : contact,
          )
        : [nextContact, ...parentConsultations]

      saveStoredParentConsultations(parentConsultations)
    notifications = syncAppNotifications(notifications)
      parentConsultationFormState = null
      render()
    })
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
    notifications = syncAppNotifications(notifications)
    parentConsultationFormState = {
      ...createEditParentContactFormState(updatedContact),
      careLogDraft: createEmptyParentCareLogDraft(),
      activeStep: parentConsultationFormState.activeStep,
      scrollTop: parentConsultationFormState.scrollTop || 0,
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
    notifications = syncAppNotifications(notifications)
    parentConsultationFormState = {
      ...createEditParentContactFormState(updatedContact),
      appointmentDraft: createEmptyParentAppointmentDraft(),
      activeStep: parentConsultationFormState.activeStep,
      scrollTop: parentConsultationFormState.scrollTop || 0,
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
        enrollmentMessage: 'Đã copy tóm tắt học thử.',
      }
    } catch {
      parentConsultationFormState = {
        ...parentConsultationFormState,
        enrollmentMessage: 'Không copy tự động được. Hãy copy thủ công từ khung tóm tắt học thử.',
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
      focusElementWithoutScrolling(nextControl)

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
      queueCoreCloudSync('teacher-status')
      writeTeacherThroughCloud(getTeacherById(teacher.id), 'teacher-status')
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
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
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

      if (fieldName === 'teacherType') {
        render()
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

  document.querySelectorAll('[data-teacher-class-session-field]').forEach((control) => {
    control.addEventListener('change', () => {
      const selectedClassSessionIds = Array.from(document.querySelectorAll('[data-teacher-class-session-field]:checked'))
        .map((checkbox) => checkbox.value)

      teacherFormState = {
        ...teacherFormState,
        values: {
          ...teacherFormState.values,
          availableClassSessionIds: selectedClassSessionIds,
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

    let savedTeacher = null

    if (teacherFormState.mode === 'edit') {
      const existingTeacher = getTeacherById(teacherFormState.teacherId)

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
      savedTeacher = updatedTeacher
    } else {
      const createdTeacher = buildTeacherFromForm(teacherFormState.values)
      teachers = [createdTeacher, ...teachers]
      selectedTeacherId = createdTeacher.id
      savedTeacher = createdTeacher
    }

    saveStoredTeachers(teachers)
    queueCoreCloudSync('teacher-save')
    writeTeacherThroughCloud(savedTeacher, 'teacher-save')
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
      scheduleAdminAttendanceState = null
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
    scheduleAdminAttendanceState = null
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
      scheduleAdminAttendanceState = null
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
          mode: 'roleGateway',
        }
        sessionReportAttendanceState = null
        scheduleAdminAttendanceState = null
        sessionReportLearningState = null
        sessionReportExtraState = null
        sessionReportLearningFormState = null
        isSessionReportExtraExpanded = false
        sessionReportGuestFormState = null
      } else {
        scheduleReportState = null
        scheduleAdminAttendanceState = null
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

  document.querySelectorAll('[data-schedule-report-role]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!scheduleReportState) {
        return
      }

      const role = button.dataset.scheduleReportRole

      if (role === 'gateway') {
        scheduleReportState = {
          ...scheduleReportState,
          mode: 'roleGateway',
        }
        sessionReportAttendanceState = null
        scheduleAdminAttendanceState = null
        sessionReportLearningState = null
        sessionReportLearningFormState = null
        sessionReportExtraState = null
        isSessionReportExtraExpanded = false
        sessionReportGuestFormState = null
        render()
        return
      }

      if (role === 'admin') {
        const occurrence = getScheduleAdminAttendanceOccurrence()
        scheduleReportState = {
          ...scheduleReportState,
          mode: 'adminPlaceholder',
        }
        scheduleAdminAttendanceState = occurrence
          ? createScheduleAdminAttendanceState(occurrence, loadStoredAttendanceRecords(getCurrentResolvedCenterId()))
          : null
        sessionReportAttendanceState = null
        sessionReportLearningState = null
        sessionReportLearningFormState = null
        sessionReportExtraState = null
        isSessionReportExtraExpanded = false
        sessionReportGuestFormState = null
        render()
        return
      }

      if (role === 'teacher') {
        const occurrence = getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate).find(
          (item) =>
            item.id === scheduleReportState.sessionId &&
            item.occurrenceDate === scheduleReportState.occurrenceDate,
        )

        if (!occurrence) {
          return
        }

        const existingReport = findSessionReport(
          sessionReports,
          occurrence.id,
          occurrence.occurrenceDate,
        )
        const storedAttendanceRecords = loadStoredAttendanceRecords(getCurrentResolvedCenterId())
        scheduleReportState = {
          ...scheduleReportState,
          mode: 'teacherReport',
        }
        sessionReportAttendanceState = createSessionReportDraft(occurrence, existingReport, {
          adminAttendanceRecords: getScheduleAdminAttendanceRecords(occurrence, storedAttendanceRecords),
          teacherAttendanceRecords: getScheduleTeacherAttendanceRecords(occurrence, storedAttendanceRecords),
        })
        scheduleAdminAttendanceState = null
        sessionReportLearningState = createSessionReportLearningState(occurrence, existingReport)
        sessionReportExtraState = createSessionReportExtraState(occurrence, existingReport)
        sessionReportLearningFormState = null
        isSessionReportExtraExpanded = false
        sessionReportGuestFormState = null
        render()
      }
    })
  })

  document.querySelectorAll('[data-schedule-action="close-report"]').forEach((button) => {
    button.addEventListener('click', () => {
      scheduleReportState = null
      scheduleAdminAttendanceState = null
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
    scheduleAdminAttendanceState = null
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

  document.querySelectorAll('[data-admin-attendance-status]').forEach((control) => {
    control.addEventListener('change', () => {
      updateScheduleAdminAttendanceRow(control.dataset.adminAttendanceStudentId, {
        attendanceStatus: control.value,
      })
      render()
    })
  })

  document.querySelectorAll('[data-admin-attendance-note]').forEach((control) => {
    control.addEventListener('input', () => {
      updateScheduleAdminAttendanceRow(control.dataset.adminAttendanceStudentId, {
        note: control.value,
      })
    })
  })

  document.querySelectorAll('[data-admin-attendance-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!scheduleAdminAttendanceState) {
        return
      }

      const action = button.dataset.adminAttendanceAction

      if (action === 'mark-all-present') {
        scheduleAdminAttendanceState = {
          ...scheduleAdminAttendanceState,
          rows: scheduleAdminAttendanceState.rows.map((row) => ({
            ...row,
            attendanceStatus: 'present',
          })),
          error: '',
          saveState: '',
        }
        render()
        return
      }

      if (action === 'clear') {
        scheduleAdminAttendanceState = {
          ...scheduleAdminAttendanceState,
          rows: scheduleAdminAttendanceState.rows.map((row) => ({
            ...row,
            attendanceStatus: '',
            note: '',
          })),
          error: '',
          saveState: '',
        }
        render()
        return
      }

      if (action === 'save') {
        const occurrence = getScheduleAdminAttendanceOccurrence()

        if (!occurrence) {
          scheduleAdminAttendanceState = {
            ...scheduleAdminAttendanceState,
            error: 'Không tìm thấy ca học để lưu điểm danh.',
            saveState: '',
          }
          render()
          return
        }

        const inputs = buildScheduleAdminAttendanceInputs(
          occurrence,
          scheduleAdminAttendanceState.rows,
        )

        if (!inputs.length) {
          scheduleAdminAttendanceState = {
            ...scheduleAdminAttendanceState,
            error: 'Chưa có trạng thái điểm danh để lưu.',
            saveState: '',
          }
          render()
          return
        }

        const result = upsertAdminAttendanceRecords({
          records: loadStoredAttendanceRecords(getCurrentResolvedCenterId()),
          inputs,
          byName: 'Admin cơ sở',
        })

        saveStoredAttendanceRecords(getCurrentResolvedCenterId(), result.records)
        void writeC51AttendanceSessionReportThroughCloud({
          attendanceRecords: result.savedRecords,
          reason: 'admin-attendance-save',
        })
        scheduleAdminAttendanceState = {
          ...createScheduleAdminAttendanceState(occurrence, result.records),
          saveState: 'saved',
        }
        render()
      }
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

    const occurrence = getScheduleAdminAttendanceOccurrence()
    const storedAttendanceRecords = loadStoredAttendanceRecords(getCurrentResolvedCenterId())
    const adminAttendanceRecords = occurrence
      ? getScheduleAdminAttendanceRecords(occurrence, storedAttendanceRecords)
      : []

    if (adminAttendanceRecords.length) {
      sessionReportAttendanceState = {
        ...sessionReportAttendanceState,
        attendanceLockedByAdmin: true,
        adminAttendanceCount: adminAttendanceRecords.length,
        error: 'Admin cơ sở đã điểm danh ca này. Giáo viên có thể lưu nội dung báo cáo ca dạy.',
        saveState: '',
      }
      render()
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
    const teacherAttendanceInputs = occurrence
      ? buildScheduleTeacherAttendanceInputs(
          occurrence,
          savedReport.attendance,
          savedReport,
        )
      : []
    const teacherAttendanceResult = upsertTeacherAttendanceRecords({
      records: storedAttendanceRecords,
      inputs: teacherAttendanceInputs,
      byName: getScheduleAdminTeacherName(occurrence) || 'Giáo viên',
    })

    sessionReports = existingReport
      ? sessionReports.map((report) => (report.id === existingReport.id ? savedReport : report))
      : [savedReport, ...sessionReports]

    saveStoredSessionReports(sessionReports)
    saveStoredAttendanceRecords(getCurrentResolvedCenterId(), teacherAttendanceResult.records)
    void writeC51AttendanceSessionReportThroughCloud({
      attendanceRecords: teacherAttendanceResult.savedRecords,
      sessionReports: [savedReport],
      reason: 'teacher-session-report-attendance',
    })
    sessionReportAttendanceState = {
      ...sessionReportAttendanceState,
      attendance: savedReport.attendance,
      error: '',
      saveState: 'saved',
      attendanceLockedByAdmin: false,
      adminAttendanceCount: 0,
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
    void writeC51AttendanceSessionReportThroughCloud({
      sessionReports: [savedReport],
      reason: 'session-report-guest-add',
    })
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
      void writeC51AttendanceSessionReportThroughCloud({
        sessionReports: [savedReport],
        reason: 'session-report-guest-delete',
      })
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
      void writeC51AttendanceSessionReportThroughCloud({
        sessionReports: [savedReport],
        reason: 'session-report-learning-delete',
      })
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
    void writeC51AttendanceSessionReportThroughCloud({
      sessionReports: [savedReport],
      reason: 'session-report-learning-save',
    })
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
    void writeC51AttendanceSessionReportThroughCloud({
      sessionReports: [savedReport],
      reason: 'session-report-extra-save',
    })
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

    let savedScheduleSession = null

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
      savedScheduleSession = updatedSession
    } else {
      const createdSession = buildScheduleSessionFromForm(scheduleFormState.values, null, teachers)
      scheduleSessions = [createdSession, ...scheduleSessions]
      savedScheduleSession = createdSession
    }

    saveStoredSchedule(scheduleSessions)
    writeScheduleSessionThroughCloud(savedScheduleSession, 'schedule-save')
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

    const deletedScheduleSession = scheduleSessions.find(
      (session) => session.id === scheduleFormState.sessionId,
    )

    scheduleSessions = scheduleSessions.filter(
      (session) => session.id !== scheduleFormState.sessionId,
    )
    saveStoredSchedule(scheduleSessions)
    writeScheduleSessionThroughCloud(
      deletedScheduleSession
        ? {
            ...deletedScheduleSession,
            status: 'cancelled',
            isDeleted: true,
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : null,
      'schedule-delete',
    )
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

  document.querySelectorAll('[data-student-note-action="open-care-notes"]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
    })

    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openStudentSubWindow(button.dataset.studentId, 'student-care-notes')
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
        queueCoreCloudSync('student-avatar')
        writeStudentThroughCloud(getStudentById(studentId), 'student-avatar')
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

  document.querySelectorAll('[data-student-class-session-id]').forEach((control) => {
    control.addEventListener('change', () => {
      const selectedClassSessionIds = Array.from(
        document.querySelectorAll('[data-student-class-session-id]:checked'),
      ).map((checkbox) => checkbox.value)

      studentFormState = {
        ...studentFormState,
        values: {
          ...studentFormState.values,
          classSessionIds: Array.from(new Set(selectedClassSessionIds)),
        },
      }
      updateStudentFormSaveButton()
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

  document.querySelector('[data-student-action="open-settings-module"]')?.addEventListener('click', () => {
    openModuleWindow('cai-dat-co-so')
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
      queueCoreCloudSync('student-care-note')
      writeStudentThroughCloud(getStudentById(careNoteStudentId), 'student-care-note')
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
      queueCoreCloudSync('student-care-note')
      writeStudentThroughCloud(getStudentById(studentId), 'student-care-note')
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

    let savedStudent = null

    if (studentFormState.mode === 'edit') {
      const existingStudent = students.find((student) => student.id === studentFormState.studentId)
      const updatedStudent = buildStudentFromForm(studentFormState.values, existingStudent)
      savedStudent = updatedStudent
      students = students.map((student) =>
        student.id === updatedStudent.id ? updatedStudent : student,
      )
      studentFilters = {
        ...studentFilters,
        selectedStudentId: updatedStudent.id,
      }
    } else {
      const newStudent = buildStudentFromForm(studentFormState.values)
      savedStudent = newStudent
      students = [newStudent, ...students]
      studentFilters = {
        ...studentFilters,
        selectedStudentId: newStudent.id,
      }
    }

    saveStoredStudents(students)
    queueCoreCloudSync('student-save')
    writeStudentThroughCloud(savedStudent, 'student-save')
    studentFormState = null
    render()
  })

  document.querySelectorAll('.student-row[data-student-id]').forEach((row) => {
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
  if (!parentConsultationFormState) {
    return
  }

  if (parentConsultationFormState.mode !== 'edit') {
    parentConsultationFormState = {
      ...parentConsultationFormState,
      enrollmentMessage: 'Thông tin học thử sẽ được lưu khi lưu liên hệ.',
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

  const errors = markReady
    ? validateEnrollmentReadyDraft(parentConsultationFormState.enrollmentDraft)
    : {}

  if (Object.keys(errors).length) {
    parentConsultationFormState = {
      ...parentConsultationFormState,
      activeStep: 4,
      scrollTop: 0,
      enrollmentErrors: errors,
      enrollmentMessage: '',
    }
    skipNextParentContactScrollCapture = true
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
    notifications = syncAppNotifications(notifications)
  parentConsultationFormState = {
    ...createEditParentContactFormState(updatedContact),
    activeStep: parentConsultationFormState.activeStep || 4,
    scrollTop: parentConsultationFormState.scrollTop || 0,
    enrollmentMessage: markReady
      ? 'Đã đánh dấu đã hẹn học thử và cập nhật lịch hẹn.'
      : 'Đã lưu thông tin học thử và cập nhật lịch hẹn nếu có ngày học thử.',
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

function bindCenterProfileOutsidePointer() {
  if (centerProfileOutsidePointerBound) {
    return
  }

  document.addEventListener('pointerdown', (event) => {
    if (!isCenterProfilePopoverOpen) {
      return
    }

    const target = event.target

    if (
      target.closest?.('.center-profile-popover') ||
      target.closest?.('[data-action="toggle-center-profile"]')
    ) {
      return
    }

    isCenterProfilePopoverOpen = false
    render()
  })
  centerProfileOutsidePointerBound = true
}

function bindStartMenuOutsidePointer() {
  if (startMenuOutsidePointerBound) {
    return
  }

  document.addEventListener('pointerdown', (event) => {
    if (!isStartMenuOpen) {
      return
    }

    const target = event.target

    if (
      target.closest?.('.start-menu') ||
      target.closest?.('[data-action="toggle-start"]')
    ) {
      return
    }

    isStartMenuOpen = false
    render()
  })
  startMenuOutsidePointerBound = true
}

function bindWindowOverflowOutsidePointer() {
  if (windowOverflowOutsidePointerBound) {
    return
  }

  document.addEventListener('pointerdown', (event) => {
    if (!isWindowOverflowOpen) {
      return
    }

    const target = event.target

    if (
      target.closest?.('.window-overflow-menu') ||
      target.closest?.('[data-action="toggle-window-overflow"]')
    ) {
      return
    }

    isWindowOverflowOpen = false
    render()
  })
  windowOverflowOutsidePointerBound = true
}

function bindModuleNotificationOutsidePointer() {
  if (moduleNotificationOutsidePointerBound) {
    return
  }

  document.addEventListener('pointerdown', (event) => {
    const target = event.target
    const activeBell = target.closest?.('.module-notification-bell, .schedule-alert-bell') || null

    document
      .querySelectorAll('.module-notification-bell[open], .schedule-alert-bell[open]')
      .forEach((bell) => {
        if (bell === activeBell || bell.contains(target)) {
          return
        }

        bell.removeAttribute('open')
      })
  })

  moduleNotificationOutsidePointerBound = true
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
  return countUnreadNotifications(getCenterScopedNotificationsForRender())
}

function syncTuitionNotifications(currentNotifications) {
  return syncAppNotifications(currentNotifications)
}

function syncAppNotifications(currentNotifications) {
  const notificationCandidates = [
    ...buildTuitionNotificationCandidates(
      buildTuitionRows(students, tuitionRecords),
      getCurrentMonthKey(),
    ),
    ...buildInventoryRequestNotificationCandidates(inventoryRequests),
    ...buildParentFollowupNotificationCandidates(parentConsultations),
  ]
  const nextNotifications = upsertNotificationCandidates(currentNotifications, notificationCandidates)

  if (JSON.stringify(nextNotifications) !== JSON.stringify(currentNotifications)) {
    saveStoredNotifications(nextNotifications)
  }

  return nextNotifications
}

function markNotificationRead(notificationId) {
  const targetNotification = notifications.find((notification) => notification.id === notificationId)

  if (!targetNotification || targetNotification.readAt) {
    return
  }

  notifications = markNotificationReadById(notifications, notificationId)
  saveStoredNotifications(notifications)
  render()
}

function openNotificationSourceModule(notificationId) {
  const notification = notifications.find((item) => item.id === notificationId)

  if (!notification || !modules.some((moduleItem) => moduleItem.id === notification.sourceModule)) {
    return
  }

  isNotificationCenterOpen = false
  openModuleWindow(notification.sourceModule)
}

function getNotificationSourceLabel(sourceModule) {
  const sourceLabels = {
    ...notificationSourceLabels,
    system: notificationSourceLabels['he-thong'],
    schedule: notificationSourceLabels['thoi-khoa-bieu'],
    inventory: notificationSourceLabels['kho-hang'],
    report: notificationSourceLabels['he-thong'],
  }

  return sourceLabels[sourceModule] ?? sourceModule ?? notificationSourceLabels['he-thong']
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

function escapeAttribute(value) {
  return escapeHtml(value)
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

function calculateParentContactAgeFromBirthYear(birthYear) {
  const year = Number.parseInt(String(birthYear || '').trim(), 10)
  const currentYear = new Date().getFullYear()

  if (!Number.isFinite(year) || year < 1900 || year > currentYear) {
    return ''
  }

  return String(currentYear - year)
}

function clampParentContactWizardStep(step) {
  const parsedStep = Number.parseInt(step, 10)

  if (!Number.isFinite(parsedStep)) {
    return 1
  }

  return Math.min(Math.max(parsedStep, 1), 4)
}

function getParentContactStepForErrors(errors = {}) {
  const errorFields = Object.keys(errors)

  if (errorFields.some((field) => ['parentName', 'phone', 'contactType'].includes(field))) {
    return 1
  }

  if (errorFields.some((field) => ['studentBirthYear'].includes(field))) {
    return 2
  }

  if (errorFields.some((field) => ['consultationStatus', 'source'].includes(field))) {
    return 3
  }

  return 1
}

function focusElementWithoutScrolling(element) {
  if (!element || typeof element.focus !== 'function') {
    return
  }

  try {
    element.focus({ preventScroll: true })
  } catch {
    element.focus()
  }
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

function installManualCloudBackfillHelpers() {
  window.__ichessCenterOS = {
    ...(window.__ichessCenterOS || {}),
    backfillScheduleSessionsToCloud: (options = {}) =>
      backfillLocalScheduleSessionsToCloud({
        ...options,
        scheduleSessions,
        visibleScheduleSessions: getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate),
      }),
  }
}

installManualCloudBackfillHelpers()
render()
initializeSupabaseAuth()

if (window.__ichessClockTimer) {
  clearInterval(window.__ichessClockTimer)
}

window.__ichessClockTimer = setInterval(updateClock, 1000)
