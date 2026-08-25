import './styles.css'
import './student-theme.css'
import './schedule-theme.css'
import './report-theme.css'
import './tuition-theme.css'
import { resolveAppCenterBinding } from './app-center-binding.js'
import { renderAppAuthEntry } from './app-auth.js'
import { isDashboardUnlockedByCenter } from './app-login-gate.js'
import {
  getProductionLauncherModules,
  isProductionModuleAvailable as isStaticProductionModuleAvailable,
  isProductionModuleVisible,
  modules,
} from './modules.js'
import {
  applyModuleUpstreamRefreshResult,
  createLoadingModuleUpstreamHealth,
  evaluateModuleRefreshResults,
  getModuleActionRequiredUpstreams,
  getModuleRefreshContract,
  getModuleUpstreamUiState,
  isBusinessModule,
  isUnavailableCalendarNotesOutcome,
} from './module-authority-registry.js'
import { createInitialCloudStatus } from './cloud-status.js'
import {
  getCurrentSupabaseUser,
  onSupabaseAuthStateChange,
  PRODUCTION_CENTER_ID,
  resolveActiveCenterMembership,
  signInWithEmailPassword,
  signOutSupabase,
} from './supabase-auth.js'
import { getSupabaseClient, getSupabaseConfigStatus } from './supabase-client.js'
import {
  buildAttachmentFileName,
  buildTransactionCode,
  buildTransactionImageStoragePath,
  createTransactionAttachmentMetadata,
  deleteTransactionAttachmentMetadata,
  getCurrentMonthKey,
  isTransactionAttachmentRoleAllowed,
  listTransactionAttachmentsByMonth,
  listTransactionAttachmentsByTransactionCode,
} from './transaction-attachments.js'
import {
  buildC54ArchiveCategoryCommand,
  buildC54CloseReconciliationCommand,
  buildC54SaveCategoryCommand,
  buildC54SaveSettingsCommand,
  buildC54SaveTransactionCommand,
  buildC54UpsertReconciliationCommand,
  buildC54VoidTuitionPaymentCommand,
  buildC54VoidTransactionCommand,
  canWriteC54FinanceSharedTruth,
  createC54FinanceIdempotencyKey,
  createC54FinanceRetryFingerprint,
  getC54FinanceOutcomeMessage,
  mutateC54FinanceSharedTruth,
  mutateC54TuitionPaymentVoid,
  pullC54FinanceSharedTruth,
} from './cloud-authoritative-finance.js'
import { inspectAndQuarantineC54LegacyFinance } from './legacy-finance-quarantine.js'
import {
  buildC56ArchiveItemCommand,
  buildC56CreateRequestCommand,
  buildC56PostMovementCommand,
  buildC56SaveItemCommand,
  buildC56UpdateRequestStatusCommand,
  canWriteC56InventorySharedTruth,
  createC56InventoryIdempotencyKey,
  createC56InventoryRetryFingerprint,
  getC56InventoryOutcomeMessage,
  mutateC56InventorySharedTruth,
  pullC56InventorySharedTruth,
} from './cloud-authoritative-inventory.js'
import { inspectAndQuarantineC56LegacyInventory } from './legacy-inventory-quarantine.js'
import {
  buildC57ArchiveCalendarItemCommand,
  buildC57SaveCalendarItemCommand,
  buildC57SaveCalendarTagCommand,
  buildC57SetCalendarTagActiveCommand,
  buildC57UpsertAdvisoryNoteCommand,
  buildC57UpsertBoardNoteCommand,
  canWriteC57SharedTruth,
  createC57IdempotencyKey,
  createC57RetryFingerprint,
  getC57OutcomeMessage,
  mutateC57CalendarNotesSharedTruth,
  pullC57CalendarNotesSharedTruth,
} from './cloud-authoritative-calendar-notes.js'
import { inspectAndQuarantineC57LegacyState } from './legacy-calendar-notes-quarantine.js'
import {
  buildC55StaffHrUpsertCommand,
  canWriteC55StaffHrSharedTruth,
  createC55StaffHrIdempotencyKey,
  createC55StaffHrRetryFingerprint,
  getC55StaffHrOutcomeMessage,
  mutateC55StaffHrSharedTruth,
  pullC55StaffHrSharedTruth,
  recordC55StaffHrAccessAudit,
} from './cloud-authoritative-staff-hr.js'
import { inspectAndQuarantineC55LegacyStaffHr } from './legacy-staff-hr-quarantine.js'
import {
  compressTransactionImage,
  validateTransactionImageFile,
} from './image-compression.js'
import {
  getMemberProfileMap,
  listCenterAccountMemberships,
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
  getStoredNotifications,
  getStoredSchedule,
  getStoredSessionReports,
  getStoredClassSessions,
  getStoredStudents,
  getStoredTeachers,
  getStoredTuition,
  getUiTheme,
  getViewMode,
  createCloudDbPullBackup,
  saveDeletedNotificationIds,
  saveDesktopModuleOrder,
  setCurrentStorageCenterId,
  saveStoredNotifications,
  saveStoredSchedule,
  saveStoredSessionReports,
  saveStoredClassSessions,
  saveStoredStudents,
  saveStoredTeachers,
  saveStoredTuition,
  saveUiTheme,
  saveViewMode,
} from './storage.js'
import {
  inspectAndQuarantineC53LegacyCrm,
  preserveC5CloseoutLegacyCoreAttendance,
} from './legacy-closeout-preservation.js'
import {
  buildCashbookReconciliationFromForm,
  buildCashbookSettingsFromForm,
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
  createCashflowAttachmentDraftFromExisting,
  createEditCashflowCategoryFormState,
  createEditCashflowFormState,
  createEmptyCashflowAttachmentDraft,
  createEmptyCashflowCategoryFormState,
  createEmptyCashflowFormStateWithCategories,
  createErrorCashflowAttachmentDraft,
  CASHFLOW_EVIDENCE_ACCEPT,
  formatFileSize,
  getDefaultCategoryNameForType,
  initialCashflowFilters,
  renderCashflowModule,
  validateCashflowCategoryForm,
  validateCashflowForm,
} from './cashflow-module.js'
import { renderFinanceWorkspaceModule } from './finance-workspace-module.js'
import {
  addCareLogToParentContact,
  addAppointmentToParentContact,
  addQuickNoteToParentContact,
  buildEnrollmentSummary,
  buildParentContactFromForm,
  createEnrollmentDraftFromContact,
  createEmptyParentAppointmentDraft,
  createEmptyParentCareLogDraft,
  createEditParentContactFormState,
  createEmptyParentContactFormState,
  initialParentConsultationFilters,
  mergeParentContactsWithStudents,
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
} from './inventory-module.js'
import {
  getCenterCalendarItemById,
  getCenterCalendarTagById,
} from './center-calendar-data.js'
import {
  detectCenterCalendarConflicts,
  detectCenterCalendarSeriesConflicts,
} from './center-calendar-conflicts.js'
import {
  expandWeeklyCenterCalendarOccurrences,
  getCenterCalendarSeriesRange,
  isWeeklyRecurringCenterCalendarItem,
} from './center-calendar-recurrence.js'
import {
  SCHEDULE_PRINT_FILTER_ALL,
  createSchedulePrintSnapshot,
  getSchedulePrintDocumentTitle,
  getSchedulePrintFilteredSnapshot,
  renderSchedulePrintDocument,
} from './schedule-print-module.js'
import {
  CASHFLOW_TRANSACTION_PRINT_ROOT_CLASS,
  CASHFLOW_TRANSACTION_PRINT_ROOT_SELECTOR,
  createCashflowTransactionPrintSnapshot,
  renderCashflowTransactionPrintDocument,
  waitForCashflowPrintImages,
} from './cashflow-transaction-print-module.js'
import {
  buildSessionReportFromAttendance,
  buildSessionReportFromLearningGroups,
  buildLearningGroupFromForm,
  buildGuestParticipantFromForm,
  buildScheduleSessionFromForm,
  buildCenterCalendarItemFromForm,
  buildCenterCalendarTagFromForm,
  buildSessionReportFromExtraInfo,
  createCenterCalendarItemDeleteState,
  createCenterCalendarItemDetailState,
  createCenterCalendarOccurrenceDetailState,
  createCenterCalendarSeriesDeleteState,
  createCenterCalendarItemConflictState,
  createCenterCalendarTagManagerState,
  createEditCenterCalendarItemFormState,
  createEditCenterCalendarSeriesFormState,
  createEditCenterCalendarTagFormState,
  createEditScheduleFormState,
  createEditLearningGroupFormState,
  createEmptyCenterCalendarItemFormState,
  createEmptyCenterCalendarTagFormState,
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
  isOrphanFixedScheduleRecord,
  isPastScheduleOccurrence,
  purgeZombieLopThayThinhScheduleSessions,
  renderScheduleModule,
  updateSessionReportDraftAttendance,
  updateSessionReportExtraState,
  validateLearningGroupForm,
  validateGuestParticipantForm,
  validateSessionReportAttendance,
  validateCenterCalendarItemForm,
  validateCenterCalendarTagForm,
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
  getReportTransactionScope,
  getReportTransactionsForScope,
  getReportDownloadFilename,
  getWeekStartDate,
  renderReportModule,
} from './report-module.js'
import {
  STAFF_EMPLOYMENT_STATUSES,
  archiveDepartment,
  archiveStaffMember,
  buildStaffEmploymentTransition,
  buildDepartmentFromForm,
  buildStaffMemberFromForm,
  clearStaffListFilters,
  createEditDepartmentFormState,
  createEditStaffFormState,
  createEmptyDepartmentFormState,
  createEmptyStaffFormState,
  findStaffMemberByAccountUserId,
  findStaffMemberByMembershipId,
  findStaffMemberByTeacherId,
  getAvailableStaffAccountMemberships,
  getAvailableStaffEmploymentTransitions,
  getStaffEmploymentStatus,
  isAccountMembershipActive,
  isStaffMemberArchived,
  initialStaffFilters,
  linkStaffMemberToAccount,
  renderStaffModule,
  restoreDepartment,
  restoreStaffMember,
  resolveStaffAccountLink,
  unlinkStaffMemberFromAccount,
  validateDepartmentForm,
  validateStaffForm,
} from './staff-module.js'
import {
  STAFF_ADMINISTRATIVE_PROFILE_ACCESS_DENIED_MESSAGE,
  buildStaffAdministrativeProfileFromDraft,
  createEditStaffAdministrativeProfileDraft,
  createStaffAdministrativeProfileDraft,
  createStaffAdministrativeProfileId,
  getStaffAdministrativeCompletionChecklist,
  getStaffAdministrativeSensitiveValue,
  getStaffAdministrativeWindowTitle,
  isStaffAdministrativeSensitiveField,
  markStaffAdministrativeProfileReviewed,
  maskStaffAdministrativeValue,
  renderStaffAdministrativeProfileWindow,
  resolveStaffAdministrativeProfileAccess,
  resolveStaffAdministrativeProfileForStaff,
  setStaffAdministrativeProfileDraftValue,
  toggleStaffAdministrativeRevealedField,
  validateStaffAdministrativeProfile,
} from './staff-administrative-profile-module.js'
import {
  STAFF_DOCUMENT_STALE_MESSAGE,
  archiveStaffDocument,
  buildStaffDocumentFromDraft,
  createEditStaffDocumentDraft,
  createStaffDocumentDraft,
  createStaffDocumentId,
  getFilteredStaffDocuments,
  getStaffDocumentRelationshipIssues,
  initialStaffDocumentFilters,
  renderStaffDocumentResults,
  renderStaffDocumentsSection,
  restoreStaffDocument,
  setStaffDocumentDraftValue,
  validateStaffDocument,
} from './staff-documents-module.js'
import {
  staffDocumentAttachmentService,
  validateStaffDocumentAttachmentFile,
} from './staff-document-attachments-supabase.js'
import {
  STAFF_DOCUMENT_CONTENT_SCROLL_SELECTOR,
  captureStaffDocumentViewerReturnContext,
  scheduleStaffDocumentViewerReturnRestore,
} from './staff-document-viewer-return.js'
import {
  STAFF_ADMINISTRATIVE_POLICY_STALE_MESSAGE,
  STAFF_ADMINISTRATIVE_REQUEST_STALE_MESSAGE,
  buildStaffAdministrativeDeletionRequest,
  buildStaffAdministrativeRetentionPolicy,
  cancelStaffAdministrativeDeletionRequest,
  createStaffAdministrativeDeletionRequestDraft,
  createStaffAdministrativeDeletionRequestId,
  createStaffAdministrativeRetentionPolicyDraft,
  createStaffAdministrativeRetentionPolicyId,
  getStaffAdministrativeDeletionRequestCollectionIssues,
  getStaffAdministrativeRetentionPolicyIssues,
  hasStaffAdministrativeAction,
  initialStaffAdministrativeAuditFilters,
  renderStaffAdministrativeAuditResults,
  renderStaffAdministrativeGovernanceSection,
  resolveStaffAdministrativeActionAccess,
  reviewStaffAdministrativeDeletionRequest,
  setStaffAdministrativeDeletionRequestDraftValue,
  setStaffAdministrativeRetentionPolicyDraftValue,
  validateStaffAdministrativeDeletionRequest,
  validateStaffAdministrativeRetentionPolicy,
} from './staff-administrative-governance-module.js'
import {
  checkCloudDbReadiness,
  createEmptyCloudEntityCounts,
  getCloudDbContext,
  getCloudEntityCounts,
  listCloudEntityPayloads,
  listScheduleSessionCloudPayloads,
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
  createCoreCommandIdempotencyKey,
  mutateAuthoritativeCoreEntity,
} from './cloud-authoritative-core.js'
import {
  prepareAuthoritativeCoreFormCommand,
  runAuthoritativeCoreSave,
} from './core-save-recovery.js'
import { createOperationalCommandIdempotencyKey } from './cloud-authoritative-attendance-tuition.js'
import {
  buildC53AppendCareLogCommand,
  buildC53ArchiveCaseCommand,
  buildC53AssignCaseCommand,
  buildC53CreateLeadCommand,
  buildC53SaveCaseCommand,
  buildC53UpsertAppointmentCommand,
  canWriteC53CrmSharedTruth,
  createC53CrmIdempotencyKey,
  mutateC53CrmSharedTruth,
  pullC53CrmSharedTruth,
} from './cloud-authoritative-crm.js'
import {
  createParentFirstCapabilityState,
  createParentStudentLink,
  endParentStudentLink,
  getParentFirstOutcomeMessage,
  isParentFirstBackendUnavailable,
  isParentFirstCapabilityReady,
  PARENT_FIRST_CAPABILITY_STATUS,
  pullParentStudentLinks,
  updateParentStudentLink,
  updateProtectedContactIdentity,
} from './cloud-authoritative-parent-student-links.js'
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
  ONLINE_ACCESS_ROLES,
  buildOnlineAccessState,
  canWriteEntity,
  getOnlineAccessMessage,
  normalizeOnlineRole,
} from './online-access-control.js'
import { cleanupLegacyDatasetLocalResidue } from './legacy-dataset-cleanup.js'
import {
  buildTeacherFromForm,
  createEditTeacherFormState,
  createEmptyTeacherFormState,
  initialTeacherFilters,
  renderTeacherModule,
  validateTeacherForm,
} from './teacher-module.js'
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
  getStudentFormSaveDisabledReason,
  initialStudentFilters,
  isStudentFormReady,
  renderStudentModule,
  validateStudentForm,
} from './student-module.js'
import {
  buildSettingsClassSessionFromForm,
  buildClassSessionAutoName,
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
  buildTuitionPaymentSummary,
  getLinkedTuitionPaymentTransactions,
  getCurrentTuitionPeriodId,
  getTuitionPeriodIdentity,
  getTuitionDebtAmount,
  hasUnreconciledLegacyTuitionPaidAmount,
  initialTuitionFilters,
  normalizePaymentFormValues,
  normalizeTuitionFormValues,
  renderTuitionDiscountPreviewFromValues,
  renderTuitionModule,
  validatePaymentForm,
  validateRenewTuitionForm,
  validateTuitionForm,
} from './tuition-module.js'

const app = document.querySelector('#app')
const INTERNAL_CENTERS_ROUTE_HASH = '#/internal/centers'
const INTERNAL_CENTERS_SELECT_FIELDS = 'id,name,slug,environment,status,created_at,updated_at'
const ACCOUNT_REVOKE_LIVE_ACTIONS_ENABLED = true
const ACCOUNT_RESTORE_LIVE_ACTIONS_ENABLED = true
const ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS = new Set(['phongtrong_prod'])

const preservedScrollTargets = [
  ['.desktop-area.is-internal-console-route', 'internal-console-route'],
  ['.window-body', 'window-body'],
  ['.student-table-wrap', 'student-table'],
  ['.student-form-scroll', 'student-form'],
  ['.student-detail-overview', 'student-detail'],
  ['.student-care-history-panel .care-note-list', 'student-care-history'],
  ['.student-care-form', 'student-care-form'],
  ['.student-learning-window', 'student-learning'],
  ['.parent-consultation-table-wrap', 'parent-table'],
  ['.parent-contact-detail-scroll', 'parent-contact-detail'],
  ['.parent-note-history-list', 'parent-note-history'],
  ['.parent-student-picker-results', 'parent-student-picker'],
  ['.teacher-table-wrap', 'teacher-table'],
  ['.teacher-form-grid', 'teacher-form'],
  ['.teacher-profile-grid', 'teacher-profile'],
  ['.teacher-profile-pane', 'teacher-profile-pane'],
  ['.teacher-update-table-wrap', 'teacher-update-table'],
  ['.staff-form', 'staff-form'],
  ['.staff-lifecycle-window', 'staff-lifecycle-window'],
  ['.staff-administrative-content-scroll', 'staff-administrative-content'],
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
let currentUiTheme = getUiTheme()
let isStartMenuOpen = false
let isWindowOverflowOpen = false
let isNotificationCenterOpen = false
let isCenterProfilePopoverOpen = false
let notificationPanelPosition = { right: 12, bottom: 56 }
let openWindows = []
let nextWindowNumber = 1
let topZIndex = 20
const moduleRefreshRunIds = new Map()
const authoritativeRefreshInFlight = new Map()
let notificationRefreshRunId = 0
const moduleRefreshStates = new Map()
let notificationRefreshState = createModuleRefreshState()
let desktopModuleOrder = getDesktopModuleOrder(
  getProductionLauncherModules().map((moduleItem) => moduleItem.id),
)
let shortcutDragState = null
let suppressNextModuleClick = false
let shortcutDocumentDragBound = false
let startMenuOutsidePointerBound = false
let windowOverflowOutsidePointerBound = false
let notificationOutsidePointerBound = false
let centerProfileOutsidePointerBound = false
let moduleNotificationOutsidePointerBound = false
let textEditingActionPointerUntil = 0
let textEditingFieldPointerUntil = 0
let nativeSelectInteractionUntil = 0
let nativeSelectChangeRenderUntil = 0
let pendingWindowFocusAfterRender = null
let legacyCloseoutPreservationState = preserveC5CloseoutLegacyCoreAttendance({
  storage: globalThis.localStorage,
  centerId: getCurrentStorageCenterId(),
})
cleanupLegacyDatasetLocalResidue(globalThis.localStorage, getCurrentStorageCenterId())
let studentFilters = { ...initialStudentFilters }
let students = getStoredStudents([])
let classSessions = getStoredClassSessions([])
let teacherFilters = { ...initialTeacherFilters }
let teachers = getStoredTeachers([])
let teacherFormState = null
let selectedTeacherId = null
let parentConsultationFilters = { ...initialParentConsultationFilters }
let parentConsultations = []
let parentConsultationFormState = null
let skipNextParentContactScrollCapture = false
let parentQuickNoteState = null
let parentNoteHistoryContactId = null
let parentContactDetailId = null
let parentStudentLinks = []
let parentLinkReviewState = null
let parentIdentityEditState = null
let parentFirstCapabilityState = createParentFirstCapabilityState()
let parentFirstCapabilityRunId = 0
let c53CrmSharedTruthState = {
  centerId: '',
  isLoading: false,
  isSaving: false,
  message: '',
  messageTone: '',
  lastLoadedAt: '',
  eligibleConsultants: [],
  legacyMigrationRequired: false,
  legacyManifestKey: '',
  legacySummary: null,
}
let c53CrmSyncRunId = 0
const c53CrmRetryCommands = new Map()
let c54FinanceSharedTruthState = {
  centerId: '',
  isLoading: false,
  isSaving: false,
  message: '',
  messageTone: '',
  lastLoadedAt: '',
  legacyMigrationRequired: false,
  legacySnapshotKey: '',
  legacySummary: null,
}
let c54FinanceSyncRunId = 0
const c54FinanceRetryCommands = new Map()
const c54TuitionPaymentVoidRetryCommands = new Map()
const c54AttachmentRetryIntents = new WeakMap()
let c55StaffHrSharedTruthState = {
  centerId: '',
  isLoading: false,
  isSaving: false,
  message: '',
  messageTone: '',
  lastLoadedAt: '',
  legacyMigrationRequired: false,
  legacyManifestKey: '',
  legacySummary: null,
}
let c55StaffHrSyncRunId = 0
const c55StaffHrRetryCommands = new Map()
const c55StaffHrAccessAuditRetryKeys = new Map()
let c56InventorySharedTruthState = {
  centerId: '',
  isLoading: false,
  isSaving: false,
  message: '',
  messageTone: '',
  lastLoadedAt: '',
  legacyMigrationRequired: false,
  legacyManifestKey: '',
  legacySummary: null,
}
let c56InventorySyncRunId = 0
const c56InventoryRetryCommands = new Map()
let c57CalendarNotesSharedTruthState = {
  centerId: '',
  isLoading: false,
  isSaving: false,
  message: '',
  messageTone: '',
  lastLoadedAt: '',
  legacyMigrationRequired: false,
  legacyManifestKey: '',
  legacySummary: null,
}
let c57CalendarNotesSyncRunId = 0
const c57CalendarNotesRetryCommands = new Map()
let staffFilters = { ...initialStaffFilters }
let staffMembers = []
let staffAdministrativeProfiles = []
let staffDocuments = []
let staffAdministrativeAuditEvents = []
let staffAdministrativeRetentionPolicy = null
let staffAdministrativeDeletionRequests = []
let staffDepartments = []
let staffFormState = null
let isStaffDepartmentPanelOpen = false
let staffDepartmentFormState = null
let staffNotice = ''
let isStaffSaving = false
let isStaffDepartmentSaving = false
let staffAccountDirectoryState = createStaffAccountDirectoryState()
let staffAccountLinkState = null
let isStaffAccountLinkSaving = false
let staffAccountDirectoryRunId = 0
let staffLifecycleState = null
let isStaffLifecycleSaving = false
let staffAdministrativeProfileWindowStates = new Map()
let staffDocumentWindowStates = new Map()
let staffAdministrativeGovernanceWindowStates = new Map()
let staffDocumentAttachmentRequestTokens = new Map()
let staffDocumentAttachmentViewerState = null
let pendingStaffDocumentViewerReturnContext = null
const boundStaffAdministrativeActionWindows = new WeakSet()
let isStaffAdministrativeProfileSaving = false
const savingStaffDocumentWindowIds = new Set()
const uploadingStaffDocumentWindowIds = new Set()
const savingStaffAdministrativeGovernanceWindowIds = new Set()
let teacherStaffLinkState = null
let isTeacherStaffLinkSaving = false
let scheduleSessions = getStoredSchedule([])
scheduleSessions = purgeZombieScheduleSessions({ persist: true, reason: 'initial-load' })
let sessionReports = getStoredSessionReports()
let centerCalendarItems = []
let centerCalendarTags = []
let attendanceAdvisoryNotes = []
let attendanceBoardNotes = []
let attendanceBaselineUndoSnapshot = null
let attendanceBaselineDraftRecords = null
let attendanceBaselineDraftBaseRecords = null
let attendanceBaselineDraftState = null
let pendingAttendanceBaselineCellFocus = null
let scheduleFormState = null
let scheduleCalendarItemState = null
let scheduleCalendarTagState = null
let scheduleCalendarFilters = { itemType: 'all', tagId: 'all' }
let scheduleReportState = null
let scheduleAdminAttendanceState = null
let sessionReportAttendanceState = null
let sessionReportLearningState = null
let sessionReportLearningFormState = null
let sessionReportExtraState = null
let isSessionReportExtraExpanded = false
let sessionReportGuestFormState = null
let scheduleWeekStartDate = getCurrentScheduleWeekStartDate()
let tuitionRecords = getStoredTuition([])
let notifications = getStoredNotifications([])
let deletedNotificationIds = getDeletedNotificationIds()
let notificationFilters = { sourceModule: 'all', readState: 'unread' }
let attendanceBoardFilters = { ...initialAttendanceBoardFilters }
let attendanceBoardDetailState = null
let attendanceBoardNoteFormState = null
let isAttendanceBaselineDetailsOpen = false
let studentFormState = null
let settingsFilters = { ...initialSettingsFilters }
let settingsActiveTab = 'class-sessions'
let settingsClassSessionFormState = null
let tuitionFilters = { ...initialTuitionFilters }
let tuitionFormState = null
let tuitionPeriodActionConfirmationState = null
let tuitionPaymentFormState = null
let tuitionDetailState = null
let tuitionRollbackPreviewState = null
let tuitionCareNoteState = null
let tuitionAdvisoryWindowState = null
// C5.4 never renders the legacy Finance keys as business authority. They are
// inventoried/quarantined before the first exact-center authoritative pull.
let cashflowTransactions = []
let cashflowCategories = []
let cashflowFilters = { ...initialCashflowFilters }
let cashflowFormState = null
let cashflowTransactionDetailState = null
let cashflowTransactionDetailHydrateToken = 0
let cashflowAttachmentHydrateToken = 0
let cashflowTransactionPrintState = {
  transactionId: '',
  requestToken: 0,
}
let isCashflowCategoryPanelOpen = false
let cashflowCategoryFormState = createEmptyCashflowCategoryFormState()
let cashbookSelectedDate = getDefaultCashbookDate(cashflowTransactions)
let cashbookSettings = createDefaultCashbookSettings(cashflowTransactions)
let cashbookSettingsFormState = null
let cashbookReconciliations = []
let cashbookReconciliationFormState = null
// C5.6 projection is memory-only and starts empty. Legacy/sample browser data
// is inventoried separately and can never bootstrap server authority.
let inventoryItems = []
let inventoryMovements = []
let inventoryRequests = []
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
let reportTransactionDrilldownState = null
let reportTransactionDrilldownToken = 0
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
let pendingTextEditingRender = false
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
let c52AttendanceRetryCommands = new Map()
let c52TuitionRealtimeSubscription = null
let c52TuitionRealtimeCenterId = ''
let c52TuitionCloudWriteRunId = 0
let c52TuitionAutoPullUserId = ''
let cloudUploadingTransactionId = null
let transactionImageManagerState = null
let cloudGalleryState = null
let activeLocalDataCenterId = getCurrentStorageCenterId()
let internalCentersListState = {
  status: 'idle',
  centers: [],
  error: '',
  loadedForUserId: '',
}
let internalCentersListRunId = 0
let internalCenterAdminAccountsState = createInternalCenterAdminAccountsState()
let internalCenterAdminAccountsRunId = 0
let internalAddCenterFormState = createInternalAddCenterFormState()
let internalCenterSwitchState = createInternalCenterSwitchState()
let pendingInternalAccountUserId = ''

function createStaffAccountDirectoryState(overrides = {}) {
  return {
    status: 'idle',
    centerId: '',
    centerName: '',
    memberships: [],
    error: '',
    ...overrides,
  }
}

function createStaffAccountLinkState(staffId, centerId) {
  return {
    staffId,
    centerId,
    query: '',
    selectedMembershipId: '',
    selectedAccountUserId: '',
    selectedRole: '',
    selectedStatus: '',
    message: '',
    isSaving: false,
  }
}

function createInternalCenterAdminAccountsState(overrides = {}) {
  return {
    status: 'idle',
    adminsByCenterId: {},
    localAccountSnapshotsByCenterId: {},
    error: '',
    loadedForUserId: '',
    loadedForCenterKey: '',
    copiedCenterId: '',
    copyMessage: '',
    resetStatus: 'idle',
    resetCenterId: '',
    resetError: '',
    resetConfirm: null,
    createStatus: 'idle',
    createCenterId: '',
    createError: '',
    createConfirm: null,
    revokeStatus: 'idle',
    revokeCenterId: '',
    revokeError: '',
    revokeConfirm: null,
    revokeTypedConfirmation: '',
    revokeRiskAcknowledged: false,
    restoreStatus: 'idle',
    restoreCenterId: '',
    restoreError: '',
    restoreConfirm: null,
    restoreTypedConfirmation: '',
    handoff: null,
    handoffCopyMessage: '',
    ...overrides,
  }
}

function createInternalAddCenterFormState(overrides = {}) {
  return {
    name: '',
    status: 'idle',
    error: '',
    success: '',
    ...overrides,
  }
}

function createInternalCenterSwitchState(overrides = {}) {
  return {
    status: 'idle',
    centerId: '',
    error: '',
    ...overrides,
  }
}

function getCurrentResolvedCenterId() {
  const binding = resolveAppCenterBinding(cloudStatus)
  return binding.currentCenterId || getCurrentStorageCenterId()
}

function getCurrentCanonicalCenterContext() {
  const binding = resolveAppCenterBinding(cloudStatus)
  const centerId = String(binding.currentCenterId || '').trim()
  const centerName = String(binding.centerName || '').trim()
  const ok = cloudStatus.authStatus === 'signed-in'
    && cloudStatus.membershipStatus === 'loaded'
    && binding.status === 'bound'
    && centerId.length <= 160
    && /^[A-Za-z0-9_-]+$/.test(centerId)

  return {
    ok,
    centerId: ok ? centerId : '',
    centerName: ok ? (centerName || centerId) : '',
    role: ok ? String(binding.role || cloudStatus.role || '') : '',
  }
}

function isProductionModuleAvailable(moduleId) {
  if (moduleId === 'khach-hang-tu-van') {
    return isParentFirstCapabilityReady(parentFirstCapabilityState, getCurrentCanonicalCenterContext().centerId)
  }
  return isStaticProductionModuleAvailable(moduleId)
}

function getUnavailableModuleLabel(moduleId) {
  if (
    moduleId === 'khach-hang-tu-van'
    && parentFirstCapabilityState.status === PARENT_FIRST_CAPABILITY_STATUS.LOADING
  ) {
    return 'Đang kiểm tra...'
  }
  return 'Chưa khả dụng'
}

function getStudentsWithCanonicalProjections() {
  // C5 closeout: the Student business list is exclusively the C5.1
  // authoritative projection. P4B session envelopes remain bridge-status
  // cache only while that phase is frozen; they cannot add Student rows.
  return students
}

function getCloudAttachmentAccessContext() {
  const binding = resolveAppCenterBinding(cloudStatus)
  const centerId = String(binding.currentCenterId || cloudStatus.centerId || '').trim()
  const role = String(binding.role || cloudStatus.role || '').trim()

  if (cloudStatus.configStatus !== 'configured') {
    return {
      ok: false,
      centerId,
      role,
      error: 'Chua cau hinh Supabase Cloud.',
      reason: 'missing-config',
    }
  }

  if (cloudStatus.authStatus !== 'signed-in' || !cloudStatus.user) {
    return {
      ok: false,
      centerId,
      role,
      error: 'Vui long dang nhap Supabase Cloud truoc.',
      reason: 'signed-out',
    }
  }

  if (cloudStatus.membershipStatus === 'loading') {
    return {
      ok: false,
      centerId,
      role,
      error: 'Dang kiem tra quyen co so. Vui long thu lai sau vai giay.',
      reason: 'membership-loading',
    }
  }

  if (cloudStatus.membershipStatus !== 'loaded' || !centerId) {
    return {
      ok: false,
      centerId,
      role,
      error: `Tai khoan chua duoc cap quyen cho co so ${centerId || 'hien tai'}.`,
      reason: 'no-center-membership',
    }
  }

  if (!isTransactionAttachmentRoleAllowed(role)) {
    return {
      ok: false,
      centerId,
      role,
      error: `Role ${role || 'khong xac dinh'} khong co quyen quan ly chung tu giao dich.`,
      reason: 'role-denied',
    }
  }

  return {
    ok: true,
    centerId,
    role,
    error: '',
    reason: '',
  }
}

function createCurrentSchedulePrintSnapshot() {
  const centerProfile = getTaskbarCenterProfileState()
  const centerId = getCurrentResolvedCenterId()

  return createSchedulePrintSnapshot({
    centerId,
    centerName: centerProfile.centerName || centerId,
    weekStartDate: scheduleWeekStartDate,
    sessions: scheduleSessions,
    classSessions,
    centerCalendarItems,
    centerCalendarTags,
    teachers,
    activityFilters: scheduleCalendarFilters,
    createdAt: new Date().toISOString(),
  })
}

function printCurrentScheduleWeek() {
  const filteredSnapshot = getSchedulePrintFilteredSnapshot(
    createCurrentSchedulePrintSnapshot(),
    SCHEDULE_PRINT_FILTER_ALL,
  )
  const previousTitle = document.title
  const printRoot = document.createElement('div')
  let didCleanup = false

  printRoot.className = 'schedule-print-runtime-root'
  printRoot.dataset.schedulePrintRuntimeRoot = 'true'
  printRoot.innerHTML = renderSchedulePrintDocument(filteredSnapshot)
  document.body.appendChild(printRoot)
  document.title = getSchedulePrintDocumentTitle(filteredSnapshot)

  const cleanup = () => {
    if (didCleanup) {
      return
    }

    didCleanup = true
    document.title = previousTitle
    printRoot.remove()
    window.removeEventListener('afterprint', cleanup)
  }

  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
  window.setTimeout(cleanup, 2000)
}

async function printCashflowTransaction(transactionId) {
  const printTransactionId = String(transactionId || '').trim()

  if (!printTransactionId || cashflowTransactionPrintState.transactionId) {
    return
  }

  const centerId = getCurrentResolvedCenterId()
  const requestToken = cashflowTransactionPrintState.requestToken + 1
  const previousTitle = document.title

  cleanupCashflowTransactionPrintRuntime()
  cashflowTransactionPrintState = {
    transactionId: printTransactionId,
    requestToken,
  }
  render()

  try {
    const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(centerId)
    const transaction = latestCashflowTransactions.find((item) => item.id === printTransactionId)

    if (!transaction) {
      cashflowTransactions = latestCashflowTransactions
      setCloudUploadMessage('Không tìm thấy giao dịch để in', 'error')
      finishCashflowTransactionPrint(requestToken)
      return
    }

    if (!isCashflowTransactionPrintRequestCurrent(requestToken, centerId, printTransactionId)) {
      finishCashflowTransactionPrint(requestToken)
      return
    }

    cashflowTransactions = latestCashflowTransactions
    const transactionCode = getCashflowTransactionCodesForTransactions(latestCashflowTransactions)[transaction.id]
    const cloudAttachments = await resolveCashflowTransactionPrintCloudAttachments({
      centerId,
      transactionCode,
    })

    if (!isCashflowTransactionPrintRequestCurrent(requestToken, centerId, printTransactionId)) {
      finishCashflowTransactionPrint(requestToken)
      return
    }

    const centerProfile = getTaskbarCenterProfileState()
    const snapshot = createCashflowTransactionPrintSnapshot({
      centerId,
      centerName: centerProfile.centerName || centerId,
      transaction: { ...transaction },
      transactionCode,
      exportedAt: new Date().toISOString(),
      cloudAttachments,
      legacyAttachment: transaction.attachment || null,
      students,
      tuitionRecords,
    })

    if (!snapshot) {
      setCloudUploadMessage('Không thể dựng bản in giao dịch.', 'error')
      finishCashflowTransactionPrint(requestToken)
      return
    }

    const printRoot = document.createElement('div')

    printRoot.className = CASHFLOW_TRANSACTION_PRINT_ROOT_CLASS
    printRoot.dataset.cashflowTransactionPrintRuntimeRoot = 'true'
    printRoot.innerHTML = renderCashflowTransactionPrintDocument(snapshot)
    document.body.appendChild(printRoot)
    document.title = `Sao kê giao dịch ${transactionCode || transaction.id}`

    await waitForCashflowPrintImages(printRoot)

    if (!isCashflowTransactionPrintRequestCurrent(requestToken, centerId, printTransactionId)) {
      cleanupCashflowTransactionPrintRuntime()
      document.title = previousTitle
      finishCashflowTransactionPrint(requestToken)
      return
    }

    let didCleanup = false
    const cleanup = () => {
      if (didCleanup) {
        return
      }

      didCleanup = true
      cleanupCashflowTransactionPrintRuntime()
      document.title = previousTitle
      window.removeEventListener('afterprint', cleanup)
      finishCashflowTransactionPrint(requestToken)
    }

    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
    window.setTimeout(cleanup, 8000)
  } catch (error) {
    cleanupCashflowTransactionPrintRuntime()
    document.title = previousTitle
    setCloudUploadMessage(
      getCloudErrorMessage(error, 'Không thể chuẩn bị bản in giao dịch.'),
      'error',
    )
    finishCashflowTransactionPrint(requestToken)
  }
}

async function resolveCashflowTransactionPrintCloudAttachments({ centerId, transactionCode }) {
  const normalizedCode = String(transactionCode || '').trim()

  if (!normalizedCode) {
    return []
  }

  const result = await listTransactionAttachmentsByTransactionCode({
    centerId,
    transactionCode: normalizedCode,
  })
  const metadata = result.ok
    ? result.data
    : cloudStatus.attachments.filter(
        (attachment) =>
          attachment.transactionCode === normalizedCode &&
          String(attachment.centerId || centerId) === centerId,
      )

  if (!result.ok && !metadata.length) {
    setCloudUploadMessage(
      `Không thể tải metadata chứng từ để in: ${result.error}`,
      'error',
    )
  }

  const normalizedAttachments = metadata
    .map((attachment) => createCashflowCloudAttachmentReference(attachment, normalizedCode))
    .filter(Boolean)
    .sort((first, second) =>
      String(first.createdAt || '').localeCompare(String(second.createdAt || '')),
    )

  return Promise.all(
    normalizedAttachments.map(async (attachment) => {
      const signedUrlResult = await createTransactionImageSignedUrl(
        attachment.storagePath,
        60 * 10,
        centerId,
      )

      return {
        ...attachment,
        signedUrl: signedUrlResult.ok ? signedUrlResult.data.signedUrl : '',
        signedUrlError: signedUrlResult.ok
          ? ''
          : signedUrlResult.error || 'Không thể tải hình ảnh chứng từ',
      }
    }),
  )
}

function isCashflowTransactionPrintRequestCurrent(requestToken, centerId, transactionId) {
  return (
    cashflowTransactionPrintState.requestToken === requestToken &&
    cashflowTransactionPrintState.transactionId === transactionId &&
    String(getCurrentResolvedCenterId() || '').trim() === String(centerId || '').trim()
  )
}

function finishCashflowTransactionPrint(requestToken) {
  if (cashflowTransactionPrintState.requestToken !== requestToken) {
    return
  }

  cashflowTransactionPrintState = {
    transactionId: '',
    requestToken,
  }
  render()
}

function cleanupCashflowTransactionPrintRuntime() {
  document
    .querySelectorAll(CASHFLOW_TRANSACTION_PRINT_ROOT_SELECTOR)
    .forEach((root) => root.remove())
}

function isProductionCenter(centerId = getCurrentResolvedCenterId()) {
  const normalizedCenterId = String(centerId || '').trim()
  const knownCenter = internalCentersListState.centers.find((center) => center.id === normalizedCenterId)

  return normalizedCenterId === PRODUCTION_CENTER_ID ||
    normalizedCenterId.endsWith('_prod') ||
    knownCenter?.environment === 'production'
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

  return false
}

function getCenterScopedNotificationsForRender() {
  return canRenderCenterScopedModuleBadges() ? notifications : []
}

function resetParentFirstRuntimeForAccessBoundary(centerId = '') {
  parentFirstCapabilityRunId += 1
  parentStudentLinks = []
  parentLinkReviewState = null
  parentIdentityEditState = null
  parentContactDetailId = null
  parentFirstCapabilityState = createParentFirstCapabilityState({ centerId })
}

function clearC55StaffHrTransientUi() {
  openWindows
    .filter((windowItem) => windowItem.type === 'staff-administrative-profile')
    .forEach((windowItem) => clearStaffDocumentAttachmentRuntime(windowItem.id))
  staffFilters = { ...initialStaffFilters }
  staffFormState = null
  isStaffDepartmentPanelOpen = false
  staffDepartmentFormState = null
  staffNotice = ''
  isStaffSaving = false
  isStaffDepartmentSaving = false
  staffAccountDirectoryRunId += 1
  staffAccountDirectoryState = createStaffAccountDirectoryState()
  staffAccountLinkState = null
  isStaffAccountLinkSaving = false
  staffLifecycleState = null
  isStaffLifecycleSaving = false
  openWindows = openWindows.filter(
    (windowItem) => windowItem.type !== 'staff-administrative-profile',
  )
  staffAdministrativeProfileWindowStates = new Map()
  staffDocumentWindowStates = new Map()
  staffAdministrativeGovernanceWindowStates = new Map()
  staffDocumentAttachmentRequestTokens = new Map()
  staffDocumentAttachmentViewerState = null
  pendingStaffDocumentViewerReturnContext = null
  isStaffAdministrativeProfileSaving = false
  savingStaffDocumentWindowIds.clear()
  uploadingStaffDocumentWindowIds.clear()
  savingStaffAdministrativeGovernanceWindowIds.clear()
  teacherStaffLinkState = null
  isTeacherStaffLinkSaving = false
}

function resetC55StaffHrRuntimeForAccessBoundary(centerId = '') {
  c55StaffHrSyncRunId += 1
  c55StaffHrRetryCommands.clear()
  c55StaffHrAccessAuditRetryKeys.clear()
  clearC55StaffHrProjection()
  clearC55StaffHrTransientUi()
  c55StaffHrSharedTruthState = {
    centerId,
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    legacyMigrationRequired: false,
    legacyManifestKey: '',
    legacySummary: null,
  }
}

function resetC56InventoryRuntimeForAccessBoundary(centerId = '') {
  c56InventorySyncRunId += 1
  c56InventoryRetryCommands.clear()
  inventoryItems = []
  inventoryMovements = []
  inventoryRequests = []
  inventoryFormState = null
  inventoryMovementFormState = null
  inventoryRequestFormState = null
  inventoryRequestStatusFormState = null
  selectedInventoryMovementId = null
  selectedInventoryRequestId = null
  isInventoryHistoryPanelOpen = false
  isInventoryRequestsPanelOpen = false
  c56InventorySharedTruthState = {
    centerId,
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    legacyMigrationRequired: false,
    legacyManifestKey: '',
    legacySummary: null,
  }
}

function clearC57CalendarNotesProjection() {
  centerCalendarItems = []
  centerCalendarTags = []
  attendanceAdvisoryNotes = []
  attendanceBoardNotes = []
}

function resetC57CalendarNotesRuntimeForAccessBoundary(centerId = '') {
  c57CalendarNotesSyncRunId += 1
  c57CalendarNotesRetryCommands.clear()
  clearC57CalendarNotesProjection()
  scheduleCalendarItemState = null
  scheduleCalendarTagState = null
  attendanceBoardNoteFormState = null
  c57CalendarNotesSharedTruthState = {
    centerId,
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    legacyMigrationRequired: false,
    legacyManifestKey: '',
    legacySummary: null,
  }
}

function resetTransientStateForCenterSwitch() {
  moduleRefreshRunIds.clear()
  authoritativeRefreshInFlight.clear()
  notificationRefreshRunId += 1
  moduleRefreshStates.clear()
  notificationRefreshState = createModuleRefreshState()
  studentFilters = { ...initialStudentFilters }
  teacherFilters = { ...initialTeacherFilters }
  parentConsultationFilters = { ...initialParentConsultationFilters }
  parentConsultations = []
  settingsFilters = { ...initialSettingsFilters }
  settingsActiveTab = 'class-sessions'
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
  parentContactDetailId = null
  parentStudentLinks = []
  parentLinkReviewState = null
  parentIdentityEditState = null
  parentFirstCapabilityRunId += 1
  parentFirstCapabilityState = createParentFirstCapabilityState({
    centerId: getCurrentCanonicalCenterContext().centerId,
  })
  c53CrmSyncRunId += 1
  c53CrmRetryCommands.clear()
  c53CrmSharedTruthState = {
    centerId: getCurrentResolvedCenterId(),
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    eligibleConsultants: [],
    legacyMigrationRequired: false,
    legacyManifestKey: '',
    legacySummary: null,
  }
  c54FinanceSyncRunId += 1
  c54FinanceRetryCommands.clear()
  c54TuitionPaymentVoidRetryCommands.clear()
  c54FinanceSharedTruthState = {
    centerId: getCurrentResolvedCenterId(),
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    legacyMigrationRequired: false,
    legacySnapshotKey: '',
    legacySummary: null,
  }
  resetC55StaffHrRuntimeForAccessBoundary(getCurrentResolvedCenterId())
  resetC56InventoryRuntimeForAccessBoundary(getCurrentResolvedCenterId())
  resetC57CalendarNotesRuntimeForAccessBoundary('')
  scheduleFormState = null
  scheduleCalendarItemState = null
  scheduleCalendarTagState = null
  scheduleCalendarFilters = { itemType: 'all', tagId: 'all' }
  scheduleReportState = null
  scheduleAdminAttendanceState = null
  sessionReportAttendanceState = null
  sessionReportLearningState = null
  sessionReportLearningFormState = null
  sessionReportExtraState = null
  sessionReportGuestFormState = null
  tuitionFormState = null
  tuitionPeriodActionConfirmationState = null
  revokeTuitionPaymentAttachmentDraftObjectUrl()
  tuitionPaymentFormState = null
  tuitionDetailState = null
  tuitionRollbackPreviewState = null
  tuitionCareNoteState = null
  tuitionAdvisoryWindowState = null
  revokeCashflowAttachmentDraftObjectUrl()
  cashflowFormState = null
  cashflowTransactionDetailState = null
  cashflowTransactionDetailHydrateToken += 1
  cashflowAttachmentHydrateToken += 1
  cleanupCashflowTransactionPrintRuntime()
  cashflowTransactionPrintState = {
    transactionId: '',
    requestToken: cashflowTransactionPrintState.requestToken + 1,
  }
  reportTransactionDrilldownState = null
  reportTransactionDrilldownToken += 1
  reportState = createInitialReportState()
  cashbookSettingsFormState = null
  cashbookReconciliationFormState = null
  inventoryFormState = null
  inventoryMovementFormState = null
  inventoryRequestFormState = null
  inventoryRequestStatusFormState = null
  attendanceBoardDetailState = null
  attendanceBoardNoteFormState = null
}

function purgeZombieScheduleSessions({ persist = false, reason = 'schedule-cleanup' } = {}) {
  const purgeResult = purgeZombieLopThayThinhScheduleSessions(scheduleSessions, classSessions)

  if (!purgeResult.removedCount) {
    return scheduleSessions
  }

  scheduleSessions = purgeResult.scheduleSessions

  if (persist) {
    saveStoredSchedule(scheduleSessions)
  }

  console.info(`[TKB] Purged ${purgeResult.removedCount} zombie schedule record(s): ${reason}`)
  return scheduleSessions
}

function reloadLocalDataForResolvedCenter() {
  ensureC5CloseoutLegacyCoreAttendancePreserved()
  cleanupLegacyDatasetLocalResidue(globalThis.localStorage, getCurrentStorageCenterId())
  students = getStoredStudents([])
  classSessions = getStoredClassSessions([])
  teachers = getStoredTeachers([])
  // CRM authorization is user/role-scoped. Never render or retain another
  // account's center-scoped disk projection before this session completes an
  // exact-center authoritative pull.
  parentConsultations = []
  // Staff/HR is a memory-only projection of exact-center server truth. Legacy
  // browser keys are inventoried separately and never resurrected here.
  staffMembers = []
  staffAdministrativeProfiles = []
  staffDocuments = []
  staffAdministrativeAuditEvents = []
  staffAdministrativeRetentionPolicy = null
  staffAdministrativeDeletionRequests = []
  staffDepartments = []
  scheduleSessions = getStoredSchedule([])
  scheduleSessions = purgeZombieScheduleSessions({ persist: true, reason: 'center-reload' })
  sessionReports = getStoredSessionReports([])
  centerCalendarItems = []
  centerCalendarTags = []
  attendanceAdvisoryNotes = []
  attendanceBoardNotes = []
  tuitionRecords = getStoredTuition([])
  cashflowTransactions = []
  cashflowCategories = []
  cashbookSelectedDate = getDefaultCashbookDate(cashflowTransactions)
  cashbookSettings = createDefaultCashbookSettings(cashflowTransactions)
  cashbookReconciliations = []
  inventoryItems = []
  inventoryMovements = []
  inventoryRequests = []
  notifications = syncAppNotifications(getStoredNotifications([]))
  deletedNotificationIds = getDeletedNotificationIds()
  activeLocalDataCenterId = getCurrentStorageCenterId()
  activeNotificationDataCenterId = getCurrentStorageCenterId()
  resetTransientStateForCenterSwitch()
}

function ensureC5CloseoutLegacyCoreAttendancePreserved() {
  legacyCloseoutPreservationState = preserveC5CloseoutLegacyCoreAttendance({
    storage: globalThis.localStorage,
    centerId: getCurrentStorageCenterId(),
  })
  return legacyCloseoutPreservationState
}

function refreshStaffDataFromStorage() {
  // Retained as a compatibility call-site during C5.5. The active projection
  // is memory-only and can change only through refreshC55StaffHrSharedTruth().
  return isC55StaffHrProjectionHealthy()
}

function getStaffCurrentCenterId() {
  return getCurrentStorageCenterId()
}

function getStaffAccountCenterContext() {
  const binding = resolveAppCenterBinding(cloudStatus)
  const storageCenterId = String(getCurrentStorageCenterId() || '').trim()
  const centerId = String(binding.currentCenterId || '').trim()

  if (cloudStatus.authStatus !== 'signed-in' || !cloudStatus.user) {
    return { ok: false, error: 'Cần đăng nhập để đọc account và membership hiện hữu.' }
  }

  if (binding.status !== 'bound' || !centerId) {
    return { ok: false, error: 'Chưa resolve được membership của cơ sở hiện tại.' }
  }

  if (!storageCenterId || storageCenterId !== centerId) {
    return { ok: false, error: 'Dữ liệu local và membership đang ở hai cơ sở khác nhau. Vui lòng mở lại module.' }
  }

  return {
    ok: true,
    centerId,
    centerName: binding.centerName || centerId,
  }
}

function getStaffAdministrativeProfileAccessContext(action = 'administrative-profile.view') {
  const binding = resolveAppCenterBinding(cloudStatus)
  const storageCenterId = getCurrentStorageCenterId()
  const profileAccess = resolveStaffAdministrativeProfileAccess({
    user: cloudStatus.user,
    binding,
    storageCenterId,
  })
  const actionAccess = resolveStaffAdministrativeActionAccess({
    user: cloudStatus.user,
    binding,
    storageCenterId,
    action,
  })
  return profileAccess.ok
    ? actionAccess
    : { ...actionAccess, ok: false, allowed: false, error: profileAccess.error }
}

async function getLatestStaffAdministrativeProfileAccessContext(
  expectedCenterId,
  action = 'administrative-profile.edit',
) {
  const user = cloudStatus.user

  if (cloudStatus.authStatus !== 'signed-in' || !user?.id) {
    return {
      ok: false,
      error: STAFF_ADMINISTRATIVE_PROFILE_ACCESS_DENIED_MESSAGE,
      reason: 'signed-out',
    }
  }

  try {
    const resolvedMembership = await resolveActiveCenterMembership(user.id)
    const membership = (resolvedMembership.memberships || []).find(
      (item) => String(item?.center_id || '').trim() === String(expectedCenterId || '').trim(),
    )

    const binding = {
      status: membership ? 'bound' : 'denied',
      currentCenterId: membership?.center_id || '',
      role: membership?.role || '',
      membership: membership || null,
    }
    const profileAccess = resolveStaffAdministrativeProfileAccess({
      user,
      binding,
      storageCenterId: getCurrentStorageCenterId(),
    })
    const actionAccess = resolveStaffAdministrativeActionAccess({
      user,
      binding,
      storageCenterId: getCurrentStorageCenterId(),
      action,
    })
    return profileAccess.ok
      ? actionAccess
      : { ...actionAccess, ok: false, allowed: false, error: profileAccess.error }
  } catch {
    return {
      ok: false,
      error: STAFF_ADMINISTRATIVE_PROFILE_ACCESS_DENIED_MESSAGE,
      reason: 'membership-read-failed',
    }
  }
}

function getUniqueCurrentCenterStaffMember(staffMemberId, centerId = getStaffCurrentCenterId()) {
  const matches = staffMembers.filter((item) => item.id === staffMemberId)
  const staffMember = matches.length === 1 ? matches[0] : null

  if (!staffMember || matches.length !== 1) {
    return null
  }
  if (staffMember.centerId && staffMember.centerId !== centerId) {
    return null
  }

  return staffMember
}

function getStaffAdministrativeProfileWindowState(windowId) {
  return staffAdministrativeProfileWindowStates.get(windowId) || null
}

function setStaffAdministrativeProfileWindowState(windowId, nextState) {
  staffAdministrativeProfileWindowStates.set(windowId, nextState)
  return nextState
}

function createStaffDocumentWindowState(centerId, staffMemberId, administrativeProfileId = '') {
  return {
    mode: 'list',
    centerId,
    staffMemberId,
    administrativeProfileId,
    selectedDocumentId: '',
    expectedRevision: null,
    expectedUpdatedAt: '',
    expectedArchivedAt: '',
    values: null,
    errors: {},
    message: '',
    isSaving: false,
    filters: { ...initialStaffDocumentFilters },
    attachment: createStaffDocumentAttachmentState(),
  }
}

function createStaffDocumentAttachmentState(overrides = {}) {
  return {
    status: 'idle',
    documentId: '',
    record: null,
    history: [],
    historyStatus: 'unavailable',
    schemaVersion: 0,
    replacementReady: false,
    softRemovalReady: false,
    deletionGovernanceReady: false,
    permanentExecutionReady: false,
    governanceBlocker: '',
    governance: null,
    governanceStatus: 'unavailable',
    message: '',
    isProcessing: false,
    processingAction: '',
    ...overrides,
  }
}

function getStaffDocumentWindowState(windowId) {
  return staffDocumentWindowStates.get(windowId) || null
}

function setStaffDocumentWindowState(windowId, nextState) {
  staffDocumentWindowStates.set(windowId, nextState)
  return nextState
}

function createStaffAdministrativeGovernanceWindowState(
  centerId,
  staffMemberId,
  administrativeProfileId = '',
) {
  return {
    mode: 'view',
    centerId,
    staffMemberId,
    administrativeProfileId,
    selectedRequestId: '',
    expectedRevision: null,
    expectedUpdatedAt: '',
    values: null,
    errors: {},
    message: '',
    isSaving: false,
    auditFilters: { ...initialStaffAdministrativeAuditFilters },
    auditLimit: 25,
  }
}

function getStaffAdministrativeGovernanceWindowState(windowId) {
  return staffAdministrativeGovernanceWindowStates.get(windowId) || null
}

function setStaffAdministrativeGovernanceWindowState(windowId, nextState) {
  staffAdministrativeGovernanceWindowStates.set(windowId, nextState)
  return nextState
}

function getStaffAdministrativeGovernanceStorageContext(centerId = getCurrentStorageCenterId()) {
  if (!isC55StaffHrProjectionHealthy(centerId)) {
    return { ok: false, reason: 'authoritative-projection-unhealthy' }
  }
  if (
    staffAdministrativeRetentionPolicy &&
    getStaffAdministrativeRetentionPolicyIssues(
      staffAdministrativeRetentionPolicy,
      centerId,
    ).length
  ) return { ok: false, reason: 'malformed-retention-policy' }
  if (
    getStaffAdministrativeDeletionRequestCollectionIssues(
      staffAdministrativeDeletionRequests,
      centerId,
    ).length
  ) return { ok: false, reason: 'malformed-deletion-request' }
  const hasBrokenRequestRelationship = staffAdministrativeDeletionRequests.some((request) => {
    const staffMatches = staffMembers.filter(
      (staffMember) => staffMember.id === request.staffMemberId && staffMember.centerId === centerId,
    )
    const profileMatches = staffAdministrativeProfiles.filter(
      (profile) =>
        profile.id === request.administrativeProfileId &&
        profile.staffMemberId === request.staffMemberId &&
        profile.centerId === centerId,
    )
    return request.centerId !== centerId || staffMatches.length !== 1 || profileMatches.length !== 1
  })
  if (hasBrokenRequestRelationship) {
    return { ok: false, reason: 'malformed-deletion-request-relationship' }
  }
  return { ok: true, reason: '' }
}

function recordStaffAdministrativeAuditEvent(access, payload = {}) {
  if (
    !access?.centerId ||
    access.centerId !== getCurrentStorageCenterId() ||
    !access.actorUserId ||
    !access.actorMembershipId
  ) return false
  // Durable mutation evidence is authored by the C5.5 RPC. Attachment
  // governance already writes its own protected server audit. Never recreate
  // either history in browser storage.
  return Boolean(payload.action)
}

async function commitC55StaffHrAccessAudit(access, payload = {}) {
  const centerId = String(access?.centerId || '').trim()
  const action = String(payload.action || '').trim()
  const staffMemberId = String(payload.staffMemberId || '').trim()
  const administrativeProfileId = String(payload.administrativeProfileId || '').trim()
  if (!centerId || !staffMemberId
    || !['administrative-profile.open', 'administrative-profile.reveal-sensitive']
      .includes(action)) {
    return { ok: false, error: 'Yêu cầu audit truy cập Staff/HR không hợp lệ.' }
  }

  const latestAccess = await getLatestStaffAdministrativeProfileAccessContext(centerId, action)
  if (!latestAccess.ok || centerId !== getCurrentResolvedCenterId()) {
    resetC55StaffHrRuntimeForAccessBoundary('')
    render()
    return { ok: false, error: latestAccess.error || 'Quyền Staff/HR đã thay đổi.' }
  }
  const readiness = await checkCloudDbReadiness(centerId)
  if (!readiness.ok || readiness.centerId !== centerId
    || centerId !== getCurrentResolvedCenterId()) {
    resetC55StaffHrRuntimeForAccessBoundary('')
    render()
    return { ok: false, error: readiness.error || 'Không xác minh được audit Staff/HR.' }
  }

  const intent = JSON.stringify({
    centerId,
    actorUserId: latestAccess.actorUserId,
    action,
    staffMemberId,
    administrativeProfileId,
    noteSummary: String(payload.noteSummary || '').trim(),
  })
  const retryKey = c55StaffHrAccessAuditRetryKeys.get(intent)
    || createC55StaffHrIdempotencyKey()
  c55StaffHrAccessAuditRetryKeys.set(intent, retryKey)
  const result = await recordC55StaffHrAccessAudit({
    supabase: readiness.supabase,
    centerId,
    action,
    staffMemberId,
    administrativeProfileId,
    noteSummary: payload.noteSummary,
    idempotencyKey: retryKey,
  })
  if (!result.ok || centerId !== getCurrentResolvedCenterId()
    || latestAccess.actorUserId !== cloudStatus.user?.id) {
    resetC55StaffHrRuntimeForAccessBoundary('')
    render()
    return {
      ...result,
      ok: false,
      error: result.error || 'Quyền Staff/HR đã thay đổi khi ghi audit.',
    }
  }

  c55StaffHrAccessAuditRetryKeys.delete(intent)
  staffAdministrativeAuditEvents = [
    result.auditEvent,
    ...staffAdministrativeAuditEvents.filter((event) => event.id !== result.auditEvent.id),
  ]
  return result
}

function getStaffDocumentStorageContext(centerId = getCurrentStorageCenterId()) {
  if (!isC55StaffHrProjectionHealthy(centerId)) {
    return { ok: false, reason: 'authoritative-projection-unhealthy' }
  }
  const relationshipIssues = getStaffDocumentRelationshipIssues(staffDocuments, {
    centerId,
    staffMembers,
    administrativeProfiles: staffAdministrativeProfiles,
  })
  return relationshipIssues.length
    ? { ok: false, reason: 'malformed-document-relationship' }
    : { ok: true, reason: '' }
}

function getStaffDocumentsForProfile(profile, staffMember, centerId) {
  if (!profile || !staffMember || profile.centerId !== centerId) return []
  return staffDocuments.filter(
    (documentRecord) =>
      documentRecord.centerId === centerId &&
      documentRecord.staffMemberId === staffMember.id &&
      documentRecord.administrativeProfileId === profile.id,
  )
}

async function openStaffAdministrativeProfileWindow(staffMemberId) {
  const access = getStaffAdministrativeProfileAccessContext('administrative-profile.view')

  if (!access.ok) {
    staffNotice = STAFF_ADMINISTRATIVE_PROFILE_ACCESS_DENIED_MESSAGE
    render()
    return
  }

  refreshStaffDataFromStorage()
  const staffMember = getUniqueCurrentCenterStaffMember(staffMemberId, access.centerId)

  if (!staffMember) {
    staffNotice = 'Không tìm thấy duy nhất một hồ sơ Nhân viên trong cơ sở hiện tại.'
    render()
    return
  }

  const profileLookup = resolveStaffAdministrativeProfileForStaff(
    staffAdministrativeProfiles,
    staffMember.id,
    access.centerId,
  )
  if (!isC55StaffHrProjectionHealthy(access.centerId)) {
    staffNotice = 'Nhật ký quyền riêng tư cần được kiểm tra. Không mở dữ liệu hành chính.'
    render()
    return
  }
  staffAdministrativeProfileWindowStates.forEach((state, windowId) => {
    if (
      state.centerId !== access.centerId ||
      state.staffMemberId !== staffMember.id
    ) {
      setStaffAdministrativeProfileWindowState(windowId, {
        ...state,
        revealedFields: new Set(),
      })
    }
  })

  const existingWindow = openWindows.find(
    (windowItem) =>
      windowItem.type === 'staff-administrative-profile' &&
      windowItem.centerId === access.centerId &&
      windowItem.staffMemberId === staffMember.id,
  )

  const accessAudit = await commitC55StaffHrAccessAudit(access, {
    action: 'administrative-profile.open',
    ['staffMemberId']: staffMember.id,
    administrativeProfileId: profileLookup.profile?.id || '',
    noteSummary: 'explicit-open',
  })
  if (!accessAudit.ok) {
    staffNotice = accessAudit.error || 'Không thể ghi audit server. Không mở dữ liệu hành chính.'
    render()
    return
  }

  staffFormState = null
  staffNotice = ''
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false

  if (existingWindow) {
    if (!getStaffDocumentWindowState(existingWindow.id)) {
      setStaffDocumentWindowState(
        existingWindow.id,
        createStaffDocumentWindowState(
          access.centerId,
          staffMember.id,
          profileLookup.profile?.id || '',
        ),
      )
    }
    if (!getStaffAdministrativeGovernanceWindowState(existingWindow.id)) {
      setStaffAdministrativeGovernanceWindowState(
        existingWindow.id,
        createStaffAdministrativeGovernanceWindowState(
          access.centerId,
          staffMember.id,
          profileLookup.profile?.id || '',
        ),
      )
    }
    focusWindow(existingWindow.id)
    render()
    return
  }

  const offset = (openWindows.length % 5) * 22
  const nextWindowId = `window-${nextWindowNumber}`
  openWindows.push({
    id: nextWindowId,
    type: 'staff-administrative-profile',
    centerId: access.centerId,
    ['staffMemberId']: staffMember.id,
    x: 42 + offset,
    y: 30 + offset,
    width: 1120,
    height: 700,
    zIndex: ++topZIndex,
    minimized: false,
    maximized: true,
    restoreBounds: {
      x: 42 + offset,
      y: 30 + offset,
      width: 1120,
      height: 700,
    },
  })
  nextWindowNumber += 1
  setStaffAdministrativeProfileWindowState(nextWindowId, {
    mode: 'view',
    centerId: access.centerId,
    ['staffMemberId']: staffMember.id,
    profileId: profileLookup.profile?.id || '',
    values: null,
    errors: {},
    message: '',
    isSaving: false,
    revealedFields: new Set(),
  })
  setStaffDocumentWindowState(
    nextWindowId,
    createStaffDocumentWindowState(
      access.centerId,
      staffMember.id,
      profileLookup.profile?.id || '',
    ),
  )
  setStaffAdministrativeGovernanceWindowState(
    nextWindowId,
    createStaffAdministrativeGovernanceWindowState(
      access.centerId,
      staffMember.id,
      profileLookup.profile?.id || '',
    ),
  )
  focusWindow(nextWindowId)
  render()
}

function startStaffAdministrativeProfileCreate(windowId) {
  const windowItem = openWindows.find((item) => item.id === windowId)
  const access = getStaffAdministrativeProfileAccessContext('administrative-profile.edit')

  if (!windowItem || !access.ok || windowItem.centerId !== access.centerId) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }

  refreshStaffDataFromStorage()
  if (
    !isC55StaffHrProjectionHealthy(access.centerId)
  ) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Dữ liệu hồ sơ hành chính cần được kiểm tra. Hệ thống đã khóa chỉnh sửa.',
    )
    return
  }
  const staffMember = getUniqueCurrentCenterStaffMember(windowItem.staffMemberId, access.centerId)
  const lookup = resolveStaffAdministrativeProfileForStaff(
    staffAdministrativeProfiles,
    windowItem.staffMemberId,
    access.centerId,
  )

  if (!staffMember || staffMember.archivedAt || lookup.status !== 'not-created') {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Không thể tạo hồ sơ từ trạng thái hiện tại. Vui lòng tải lại và kiểm tra dữ liệu.',
    )
    return
  }

  setStaffAdministrativeProfileWindowState(windowId, {
    mode: 'create',
    centerId: access.centerId,
    ['staffMemberId']: staffMember.id,
    profileId: '',
    expectedRevision: null,
    expectedUpdatedAt: '',
    values: createStaffAdministrativeProfileDraft(staffMember),
    errors: {},
    message: '',
    isSaving: false,
    revealedFields: new Set(),
  })
  render()
}

function startStaffAdministrativeProfileEdit(windowId) {
  const windowItem = openWindows.find((item) => item.id === windowId)
  const access = getStaffAdministrativeProfileAccessContext('administrative-profile.edit')

  if (!windowItem || !access.ok || windowItem.centerId !== access.centerId) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }

  refreshStaffDataFromStorage()
  if (
    !isC55StaffHrProjectionHealthy(access.centerId)
  ) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Dữ liệu hồ sơ hành chính cần được kiểm tra. Hệ thống đã khóa chỉnh sửa.',
    )
    return
  }
  const staffMember = getUniqueCurrentCenterStaffMember(windowItem.staffMemberId, access.centerId)
  const lookup = resolveStaffAdministrativeProfileForStaff(
    staffAdministrativeProfiles,
    windowItem.staffMemberId,
    access.centerId,
  )

  if (!staffMember || staffMember.archivedAt || !lookup.profile) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Không thể sửa hồ sơ từ trạng thái hiện tại. Vui lòng tải lại và kiểm tra dữ liệu.',
    )
    return
  }

  setStaffAdministrativeProfileWindowState(windowId, {
    mode: 'edit',
    centerId: access.centerId,
    ['staffMemberId']: staffMember.id,
    profileId: lookup.profile.id,
    expectedRevision: lookup.profile.revision,
    expectedUpdatedAt: lookup.profile.updatedAt,
    values: createEditStaffAdministrativeProfileDraft(lookup.profile),
    errors: {},
    message: '',
    isSaving: false,
    revealedFields: new Set(),
  })
  render()
}

function cancelStaffAdministrativeProfileEdit(windowId) {
  const state = getStaffAdministrativeProfileWindowState(windowId)
  if (!state || state.isSaving) return

  setStaffAdministrativeProfileWindowState(windowId, {
    mode: 'view',
    centerId: state.centerId,
    ['staffMemberId']: state.staffMemberId,
    profileId: state.profileId || '',
    values: null,
    errors: {},
    message: '',
    isSaving: false,
    revealedFields: new Set(),
  })
  render()
}

function setStaffAdministrativeProfileWindowMessage(windowId, message) {
  const state = getStaffAdministrativeProfileWindowState(windowId)
  if (!state) return
  setStaffAdministrativeProfileWindowState(windowId, {
    ...state,
    isSaving: false,
    message,
  })
  isStaffAdministrativeProfileSaving = false
  render()
}

function denyStaffAdministrativeProfileWindow(windowId) {
  const windowItem = openWindows.find((item) => item.id === windowId)
  clearStaffDocumentAttachmentRuntime(windowId)
  staffAdministrativeProfileWindowStates.delete(windowId)
  staffDocumentWindowStates.delete(windowId)
  staffAdministrativeGovernanceWindowStates.delete(windowId)
  savingStaffDocumentWindowIds.delete(windowId)
  savingStaffAdministrativeGovernanceWindowIds.delete(windowId)
  if (windowItem) {
    setStaffAdministrativeProfileWindowState(windowId, {
      mode: 'denied',
      centerId: windowItem.centerId,
      ['staffMemberId']: windowItem.staffMemberId,
      profileId: '',
      values: null,
      errors: {},
      message: '',
      isSaving: false,
      revealedFields: new Set(),
    })
  }
  isStaffAdministrativeProfileSaving = false
  staffNotice = STAFF_ADMINISTRATIVE_PROFILE_ACCESS_DENIED_MESSAGE
  render()
}

function updateStaffAdministrativeProfileDraftField(windowId, fieldPath, value) {
  const state = getStaffAdministrativeProfileWindowState(windowId)
  if (!state || !['create', 'edit'].includes(state.mode) || state.isSaving) return

  setStaffAdministrativeProfileWindowState(windowId, {
    ...state,
    values: setStaffAdministrativeProfileDraftValue(state.values, fieldPath, value),
  })
}

function collectStaffAdministrativeProfileDraftValues(formElement, state) {
  let values = state.values
  formElement.querySelectorAll('[data-staff-administrative-field]').forEach((control) => {
    values = setStaffAdministrativeProfileDraftValue(
      values,
      control.dataset.staffAdministrativeField,
      control.value,
    )
  })
  return values
}

async function handleStaffAdministrativeProfileSubmit(windowId, formElement) {
  const state = getStaffAdministrativeProfileWindowState(windowId)

  if (
    !state ||
    !['create', 'edit'].includes(state.mode) ||
    state.isSaving ||
    isStaffAdministrativeProfileSaving
  ) {
    return
  }

  const values = collectStaffAdministrativeProfileDraftValues(formElement, state)
  const errors = validateStaffAdministrativeProfile(values)
  if (Object.keys(errors).length) {
    setStaffAdministrativeProfileWindowState(windowId, {
      ...state,
      values,
      errors,
      message: 'Vui lòng kiểm tra các trường chưa hợp lệ.',
      isSaving: false,
    })
    render()
    focusFirstStaffAdministrativeProfileError(windowId)
    return
  }

  isStaffAdministrativeProfileSaving = true
  setStaffAdministrativeProfileWindowState(windowId, {
    ...state,
    values,
    errors: {},
    message: '',
    isSaving: true,
  })
  render()

  const access = await getLatestStaffAdministrativeProfileAccessContext(state.centerId)
  const latestWindow = openWindows.find((item) => item.id === windowId)
  const latestState = getStaffAdministrativeProfileWindowState(windowId)

  if (!access.ok) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  if (
    !latestWindow ||
    !latestState ||
    latestState.mode !== state.mode ||
    latestWindow.centerId !== state.centerId ||
    getCurrentStorageCenterId() !== state.centerId
  ) {
    clearStaffDocumentAttachmentRuntime(windowId)
    staffAdministrativeProfileWindowStates.delete(windowId)
    staffDocumentWindowStates.delete(windowId)
    staffAdministrativeGovernanceWindowStates.delete(windowId)
    savingStaffDocumentWindowIds.delete(windowId)
    savingStaffAdministrativeGovernanceWindowIds.delete(windowId)
    isStaffAdministrativeProfileSaving = false
    return
  }

  refreshStaffDataFromStorage()
  if (
    !isC55StaffHrProjectionHealthy(state.centerId)
  ) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Dữ liệu hồ sơ hành chính cần được kiểm tra. Không ghi đè storage hiện tại.',
    )
    return
  }
  const staffMember = getUniqueCurrentCenterStaffMember(state.staffMemberId, state.centerId)
  const lookup = resolveStaffAdministrativeProfileForStaff(
    staffAdministrativeProfiles,
    state.staffMemberId,
    state.centerId,
  )

  if (!staffMember || staffMember.archivedAt) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Hồ sơ Nhân viên không còn ở trạng thái cho phép chỉnh sửa.',
    )
    return
  }

  if (state.mode === 'create' && lookup.status !== 'not-created') {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Hồ sơ hành chính đã được tạo ở phiên khác. Không ghi thêm bản trùng.',
    )
    return
  }

  if (
    state.mode === 'edit' &&
    (
      !lookup.profile ||
      lookup.profile.id !== state.profileId ||
      lookup.profile.revision !== state.expectedRevision ||
      lookup.profile.updatedAt !== state.expectedUpdatedAt
    )
  ) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Hồ sơ đã thay đổi ở phiên khác. Vui lòng hủy và mở lại trước khi lưu.',
    )
    return
  }

  if (
    state.mode === 'edit' &&
    staffAdministrativeProfiles.filter((profile) => profile.id === state.profileId).length !== 1
  ) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Profile ID không còn duy nhất. Hệ thống đã dừng lưu để bảo vệ dữ liệu.',
    )
    return
  }

  const profileId = state.mode === 'create' ? createStaffAdministrativeProfileId() : state.profileId
  if (
    state.mode === 'create' &&
    staffAdministrativeProfiles.some((profile) => profile.id === profileId)
  ) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Không thể tạo stable profile ID duy nhất. Vui lòng thử lại.',
    )
    return
  }
  const savedProfile = buildStaffAdministrativeProfileFromDraft(values, lookup.profile, {
    centerId: state.centerId,
    ['staffMemberId']: state.staffMemberId,
    profileId,
  })
  const nextProfiles = state.mode === 'create'
    ? [savedProfile, ...staffAdministrativeProfiles]
    : staffAdministrativeProfiles.map((profile) =>
        profile.id === savedProfile.id ? savedProfile : profile,
      )
  const linkedCount = nextProfiles.filter(
    (profile) =>
      profile.centerId === state.centerId && profile.staffMemberId === state.staffMemberId,
  ).length

  if (linkedCount !== 1) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Dữ liệu vi phạm quan hệ một-một. Hệ thống đã dừng lưu để bảo vệ hồ sơ.',
    )
    return
  }

  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('administrative_profile', savedProfile),
    { reason: state.mode === 'create' ? 'profile-create' : 'profile-update' },
  )
  if (!committed.ok) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      committed.error || 'Không commit được hồ sơ hành chính lên server.',
    )
    return
  }
  setStaffAdministrativeProfileWindowState(windowId, {
    mode: 'view',
    centerId: state.centerId,
    ['staffMemberId']: state.staffMemberId,
    profileId: savedProfile.id,
    values: null,
    errors: {},
    message: 'Đã commit hồ sơ hành chính và tải lại authoritative projection.',
    isSaving: false,
    revealedFields: new Set(),
  })
  isStaffAdministrativeProfileSaving = false
  render()
}

async function markStaffAdministrativeProfileAsReviewed(windowId) {
  const state = getStaffAdministrativeProfileWindowState(windowId)
  if (!state || state.isSaving || isStaffAdministrativeProfileSaving) return

  refreshStaffDataFromStorage()
  const capturedLookup = resolveStaffAdministrativeProfileForStaff(
    staffAdministrativeProfiles,
    state.staffMemberId,
    state.centerId,
  )
  if (!isC55StaffHrProjectionHealthy(state.centerId) || !capturedLookup.profile) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Không thể đánh dấu kiểm tra từ dữ liệu hiện tại.',
    )
    return
  }
  const capturedProfileId = capturedLookup.profile.id
  const capturedRevision = capturedLookup.profile.revision
  const capturedUpdatedAt = capturedLookup.profile.updatedAt

  isStaffAdministrativeProfileSaving = true
  setStaffAdministrativeProfileWindowState(windowId, { ...state, isSaving: true, message: '' })
  render()

  const access = await getLatestStaffAdministrativeProfileAccessContext(state.centerId)
  if (!access.ok) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  const latestWindow = openWindows.find((item) => item.id === windowId)
  const latestState = getStaffAdministrativeProfileWindowState(windowId)
  if (
    !latestWindow ||
    !latestState ||
    latestWindow.centerId !== state.centerId ||
    latestState.staffMemberId !== state.staffMemberId ||
    getCurrentStorageCenterId() !== state.centerId
  ) {
    clearStaffDocumentAttachmentRuntime(windowId)
    staffAdministrativeProfileWindowStates.delete(windowId)
    staffDocumentWindowStates.delete(windowId)
    staffAdministrativeGovernanceWindowStates.delete(windowId)
    savingStaffDocumentWindowIds.delete(windowId)
    savingStaffAdministrativeGovernanceWindowIds.delete(windowId)
    isStaffAdministrativeProfileSaving = false
    return
  }

  refreshStaffDataFromStorage()
  if (
    !isC55StaffHrProjectionHealthy(state.centerId)
  ) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Dữ liệu hồ sơ hành chính cần được kiểm tra. Không ghi đè storage hiện tại.',
    )
    return
  }
  const staffMember = getUniqueCurrentCenterStaffMember(state.staffMemberId, state.centerId)
  const lookup = resolveStaffAdministrativeProfileForStaff(
    staffAdministrativeProfiles,
    state.staffMemberId,
    state.centerId,
  )

  if (!staffMember || staffMember.archivedAt || !lookup.profile) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Không thể đánh dấu kiểm tra từ trạng thái hiện tại.',
    )
    return
  }
  if (
    lookup.profile.id !== capturedProfileId ||
    lookup.profile.revision !== capturedRevision ||
    lookup.profile.updatedAt !== capturedUpdatedAt ||
    staffAdministrativeProfiles.filter((profile) => profile.id === capturedProfileId).length !== 1
  ) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Hồ sơ đã thay đổi ở phiên khác. Vui lòng tải lại trước khi đánh dấu kiểm tra.',
    )
    return
  }
  if (!getStaffAdministrativeCompletionChecklist(lookup.profile).complete) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      'Checklist chưa đủ để đánh dấu đã kiểm tra.',
    )
    return
  }

  const reviewedProfile = markStaffAdministrativeProfileReviewed(lookup.profile, {
    reviewedBy: cloudStatus.user?.id || '',
    reviewedByLabel: cloudStatus.user?.email || access.role,
  })
  if (!reviewedProfile) {
    setStaffAdministrativeProfileWindowMessage(windowId, 'Không thể cập nhật trạng thái kiểm tra.')
    return
  }

  const nextProfiles = staffAdministrativeProfiles.map((profile) =>
    profile.id === reviewedProfile.id ? reviewedProfile : profile,
  )
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('administrative_profile', reviewedProfile),
    { reason: 'profile-review' },
  )
  if (!committed.ok) {
    setStaffAdministrativeProfileWindowMessage(
      windowId,
      committed.error || 'Không commit được trạng thái kiểm tra hồ sơ.',
    )
    return
  }
  setStaffAdministrativeProfileWindowState(windowId, {
    mode: 'view',
    centerId: state.centerId,
    ['staffMemberId']: state.staffMemberId,
    profileId: reviewedProfile.id,
    values: null,
    errors: {},
    message: 'Đã commit trạng thái kiểm tra và tải lại authoritative projection.',
    isSaving: false,
    revealedFields: new Set(),
  })
  isStaffAdministrativeProfileSaving = false
  render()
}

async function toggleStaffAdministrativeSensitiveField(
  windowId,
  fieldPath,
  button,
  windowElement,
) {
  let state = getStaffAdministrativeProfileWindowState(windowId)
  const windowItem = openWindows.find(
    (item) => item.id === windowId && item.type === 'staff-administrative-profile',
  )
  const access = getStaffAdministrativeProfileAccessContext(
    'administrative-profile.reveal-sensitive',
  )

  if (
    !windowItem ||
    !windowElement ||
    !access.ok ||
    !state ||
    state.centerId !== access.centerId ||
    windowItem.centerId !== access.centerId ||
    !isStaffAdministrativeSensitiveField(fieldPath)
  ) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }

  const wasRevealed = state.revealedFields instanceof Set && state.revealedFields.has(fieldPath)
  let auditAccess = access

  if (!wasRevealed) {
    const latestAccess = await getLatestStaffAdministrativeProfileAccessContext(state.centerId)
    const latestWindow = openWindows.find(
      (item) => item.id === windowId && item.type === 'staff-administrative-profile',
    )
    const latestState = getStaffAdministrativeProfileWindowState(windowId)

    if (
      !latestAccess.ok ||
      !hasStaffAdministrativeAction(latestAccess, 'administrative-profile.reveal-sensitive') ||
      !latestWindow ||
      !latestState ||
      latestAccess.centerId !== latestState.centerId ||
      latestWindow.centerId !== latestAccess.centerId
    ) {
      denyStaffAdministrativeProfileWindow(windowId)
      return
    }

    state = latestState
    auditAccess = latestAccess
    windowElement = document.querySelector(
      `.desktop-window.is-staff-administrative-profile[data-window-id="${CSS.escape(windowId)}"]`,
    )
    button = windowElement?.querySelector(
      `[data-staff-administrative-action="toggle-sensitive"][data-sensitive-field="${CSS.escape(fieldPath)}"]`,
    )
    if (!windowElement || !button) return
    const auditSaved = await commitC55StaffHrAccessAudit(auditAccess, {
      action: 'administrative-profile.reveal-sensitive',
      ['staffMemberId']: state.staffMemberId,
      administrativeProfileId: state.profileId,
      noteSummary: fieldPath,
    })
    if (!auditSaved.ok) return
    refreshStaffAdministrativeAuditResultsRegion(windowId)
  }

  const revealedFields = toggleStaffAdministrativeRevealedField(
    state.revealedFields,
    fieldPath,
  )
  const revealed = revealedFields.has(fieldPath)
  const fieldControl = windowElement.querySelector(
    `[data-staff-administrative-field="${CSS.escape(fieldPath)}"]`,
  )
  const displayControl = windowElement.querySelector(
    `[data-staff-administrative-sensitive-value="${CSS.escape(fieldPath)}"]`,
  )

  if (displayControl) {
    refreshStaffDataFromStorage()
    const lookup = resolveStaffAdministrativeProfileForStaff(
      staffAdministrativeProfiles,
      state.staffMemberId,
      state.centerId,
    )
    const profileId = lookup.profile?.id || ''

    if (!lookup.profile || state.profileId !== profileId) {
      maskStaffAdministrativeSensitiveView(windowId, windowElement, lookup.profile)
      return
    }

    const value = getStaffAdministrativeSensitiveValue(lookup.profile, fieldPath)
    if (!value) {
      displayControl.textContent = maskStaffAdministrativeValue('')
      return
    }
    displayControl.textContent = revealed ? value : maskStaffAdministrativeValue(value)
  } else if (fieldControl) {
    fieldControl.type = revealed ? 'text' : 'password'
  } else {
    return
  }

  setStaffAdministrativeProfileWindowState(windowId, {
    ...state,
    revealedFields,
  })
  button.textContent = revealed ? 'Ẩn' : 'Hiện'
  button.setAttribute('aria-pressed', String(revealed))
}

function maskStaffAdministrativeSensitiveView(windowId, windowElement, profile) {
  const state = getStaffAdministrativeProfileWindowState(windowId)
  if (!state || !windowElement) return

  windowElement.querySelectorAll('[data-staff-administrative-sensitive-value]').forEach((control) => {
    const fieldPath = control.dataset.staffAdministrativeSensitiveValue
    const value = getStaffAdministrativeSensitiveValue(profile, fieldPath)
    control.textContent = maskStaffAdministrativeValue(value)
  })
  windowElement
    .querySelectorAll('[data-staff-administrative-action="toggle-sensitive"]')
    .forEach((control) => {
      control.textContent = 'Hiện'
      control.setAttribute('aria-pressed', 'false')
    })
  setStaffAdministrativeProfileWindowState(windowId, {
    ...state,
    profileId: profile?.id || '',
    revealedFields: new Set(),
  })
}

function navigateStaffAdministrativeProfileSection(button) {
  const windowElement = button.closest('.desktop-window.is-staff-administrative-profile')
  const scrollElement = windowElement?.querySelector('.staff-administrative-content-scroll')
  const section = windowElement?.querySelector(`#${CSS.escape(button.dataset.sectionId || '')}`)
  if (!scrollElement || !section) return

  scrollElement.scrollTo({
    top: Math.max(0, section.offsetTop - scrollElement.offsetTop - 12),
    behavior: 'smooth',
  })
}

function getStaffDocumentWindowContext(
  windowId,
  { refresh = false, action = 'staff-document.view' } = {},
) {
  const windowItem = openWindows.find(
    (item) => item.id === windowId && item.type === 'staff-administrative-profile',
  )
  const access = getStaffAdministrativeProfileAccessContext(action)
  if (!windowItem || !access.ok || windowItem.centerId !== access.centerId) return null
  if (refresh) refreshStaffDataFromStorage()

  const staffMember = getUniqueCurrentCenterStaffMember(windowItem.staffMemberId, access.centerId)
  const profileProjectionHealthy = isC55StaffHrProjectionHealthy(access.centerId)
  const lookup = profileProjectionHealthy
    ? resolveStaffAdministrativeProfileForStaff(
        staffAdministrativeProfiles,
        windowItem.staffMemberId,
        access.centerId,
      )
    : { status: 'malformed', profile: null }
  const storageContext = getStaffDocumentStorageContext(access.centerId)
  if (!staffMember || !lookup.profile) {
    return { windowItem, access, staffMember, lookup, storageContext, documents: [] }
  }
  return {
    windowItem,
    access,
    staffMember,
    lookup,
    storageContext,
    documents: storageContext.ok
      ? getStaffDocumentsForProfile(lookup.profile, staffMember, access.centerId)
      : [],
  }
}

function refreshStaffDocumentsSection(windowId) {
  const context = getStaffDocumentWindowContext(windowId)
  const windowElement = document.querySelector(
    `.desktop-window.is-staff-administrative-profile[data-window-id="${CSS.escape(windowId)}"]`,
  )
  const currentSection = windowElement?.querySelector('[data-staff-documents-section]')
  const state = getStaffDocumentWindowState(windowId)
  if (!context || !currentSection || !state || !context.lookup.profile) return

  const template = document.createElement('template')
  template.innerHTML = renderStaffDocumentsSection({
    windowId,
    documents: context.documents,
    state,
    accessAllowed: context.access.ok,
    storageHealthy: context.storageContext.ok,
    readOnly: Boolean(context.staffMember?.archivedAt),
  }).trim()
  currentSection.replaceWith(template.content.firstElementChild)
}

function issueStaffDocumentAttachmentRequestToken(windowId) {
  const token = (staffDocumentAttachmentRequestTokens.get(windowId) || 0) + 1
  staffDocumentAttachmentRequestTokens.set(windowId, token)
  return token
}

function isCurrentStaffDocumentAttachmentRequest(windowId, token, documentId) {
  const state = getStaffDocumentWindowState(windowId)
  return Boolean(
    state &&
    staffDocumentAttachmentRequestTokens.get(windowId) === token &&
    state.mode === 'detail' &&
    state.selectedDocumentId === documentId &&
    state.attachment?.documentId === documentId &&
    getCurrentStorageCenterId() === state.centerId,
  )
}

function updateStaffDocumentAttachmentState(windowId, attachment) {
  const state = getStaffDocumentWindowState(windowId)
  if (!state) return false
  setStaffDocumentWindowState(windowId, {
    ...state,
    attachment: createStaffDocumentAttachmentState(attachment),
  })
  refreshStaffDocumentsSection(windowId)
  return true
}

function clearStaffDocumentAttachmentRuntime(windowId) {
  issueStaffDocumentAttachmentRequestToken(windowId)
  uploadingStaffDocumentWindowIds.delete(windowId)
  if (staffDocumentAttachmentViewerState?.windowId === windowId) {
    clearStaffDocumentAttachmentViewerState()
  }
  if (pendingStaffDocumentViewerReturnContext?.windowId === windowId) {
    pendingStaffDocumentViewerReturnContext = null
  }
}

function captureStaffDocumentAttachmentViewerReturnContext(
  windowId,
  documentRecord,
  attachment,
  triggerElement,
) {
  const windowItem = openWindows.find(
    (item) => item.id === windowId && item.type === 'staff-administrative-profile',
  )
  const documentState = getStaffDocumentWindowState(windowId)
  const windowElement = triggerElement?.closest?.(
    '.desktop-window.is-staff-administrative-profile[data-window-id]',
  ) || document.querySelector(
    `.desktop-window.is-staff-administrative-profile[data-window-id="${escapeCssAttributeValue(windowId)}"]`,
  )
  const scrollContainer = windowElement?.querySelector(STAFF_DOCUMENT_CONTENT_SCROLL_SELECTOR)

  return captureStaffDocumentViewerReturnContext({
    windowId,
    centerId: windowItem?.centerId,
    ['staffMemberId']: windowItem?.staffMemberId,
    administrativeProfileId: documentState?.administrativeProfileId,
    documentId: documentRecord?.id,
    attachmentId: attachment?.id,
    sectionId: `${windowId}-documents`,
    mode: documentState?.mode,
    triggerAction: triggerElement?.dataset?.staffDocumentAction || 'attachment-view',
    attachmentVersion: Number(triggerElement?.dataset?.attachmentVersion || 0),
    maximized: windowItem?.maximized,
    scrollContainer,
  })
}

function getStaffDocumentAttachmentResultStatus(result) {
  if (result?.code === 'not-configured') return 'not-configured'
  if (['unauthorized', 'authorization-unavailable'].includes(result?.code)) return 'denied'
  if (result?.code === 'backend-not-ready') return 'unavailable'
  return 'error'
}

async function loadStaffDocumentAttachment(
  windowId,
  { preserveCurrent = false, message = '' } = {},
) {
  const context = getStaffDocumentWindowContext(windowId, {
    refresh: true,
    action: 'staff-document.attachment-view',
  })
  const state = getStaffDocumentWindowState(windowId)
  const documentRecord = context?.documents.find(
    (item) => item.id === state?.selectedDocumentId,
  )
  if (!context || !state || state.mode !== 'detail' || !documentRecord) return

  const documentId = documentRecord.id
  const token = issueStaffDocumentAttachmentRequestToken(windowId)
  updateStaffDocumentAttachmentState(windowId, {
    ...(preserveCurrent ? state.attachment : {}),
    status: 'checking',
    documentId,
    message,
    isProcessing: false,
  })

  const readiness = await staffDocumentAttachmentService.checkReadiness({
    centerId: context.access.centerId,
  })
  if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, documentId)) return
  if (!readiness.ok) {
    const status = getStaffDocumentAttachmentResultStatus(readiness)
    if (status === 'denied') {
      clearStaffDocumentAttachmentRuntime(windowId)
      denyStaffAdministrativeProfileWindow(windowId)
      return
    }
    updateStaffDocumentAttachmentState(windowId, {
      ...(preserveCurrent ? getStaffDocumentWindowState(windowId)?.attachment : {}),
      status,
      documentId,
      message: readiness.error,
    })
    return
  }
  if (!readiness.data.ready) {
    updateStaffDocumentAttachmentState(windowId, {
      ...(preserveCurrent ? getStaffDocumentWindowState(windowId)?.attachment : {}),
      status: 'unavailable',
      documentId,
      schemaVersion: readiness.data.schemaVersion,
      replacementReady: false,
      softRemovalReady: false,
      deletionGovernanceReady: false,
      permanentExecutionReady: false,
      governanceBlocker: readiness.data.governanceBlocker || '',
      governance: null,
      governanceStatus: 'unavailable',
      message: 'Kho tệp riêng tư chưa sẵn sàng.',
    })
    return
  }

  const result = await staffDocumentAttachmentService.listPrimary({
    centerId: context.access.centerId,
    ['staffMemberId']: context.staffMember.id,
    administrativeProfileId: context.lookup.profile.id,
    documentId,
  })
  if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, documentId)) return
  if (!result.ok) {
    const status = getStaffDocumentAttachmentResultStatus(result)
    if (status === 'denied') {
      clearStaffDocumentAttachmentRuntime(windowId)
      denyStaffAdministrativeProfileWindow(windowId)
      return
    }
    updateStaffDocumentAttachmentState(windowId, {
      ...(preserveCurrent ? getStaffDocumentWindowState(windowId)?.attachment : {}),
      status,
      documentId,
      message: result.error,
    })
    return
  }
  const schemaVersion = Number(readiness.data.schemaVersion || 0)
  const replacementReady = schemaVersion >= 2
  const softRemovalReady = readiness.data.softRemovalReady === true
  const deletionGovernanceReady = readiness.data.deletionRequestReady === true
  const permanentExecutionReady = readiness.data.permanentExecutionReady === true
  let history = result.data ? [result.data] : []
  let historyStatus = replacementReady ? 'ready' : 'unavailable'
  let governance = null
  let governanceStatus = deletionGovernanceReady ? 'ready' : 'unavailable'
  if (replacementReady) {
    const historyResult = await staffDocumentAttachmentService.listHistory({
      centerId: context.access.centerId,
      ['staffMemberId']: context.staffMember.id,
      administrativeProfileId: context.lookup.profile.id,
      documentId,
      includeCleanupColumns: softRemovalReady,
    })
    if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, documentId)) return
    if (historyResult.ok) {
      history = historyResult.data
    } else {
      historyStatus = 'error'
    }
  }
  if (deletionGovernanceReady) {
    const governanceResult = await staffDocumentAttachmentService.getGovernanceSnapshot({
      centerId: context.access.centerId,
      ['staffMemberId']: context.staffMember.id,
      administrativeProfileId: context.lookup.profile.id,
      documentId,
    })
    if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, documentId)) return
    if (governanceResult.ok) {
      governance = governanceResult.data
    } else {
      governanceStatus = 'error'
    }
  }
  updateStaffDocumentAttachmentState(windowId, {
    status: result.data?.state === 'failed' ? 'failed' : 'ready',
    documentId,
    record: result.data,
    history,
    historyStatus,
    schemaVersion,
    replacementReady,
    softRemovalReady,
    deletionGovernanceReady,
    permanentExecutionReady,
    governanceBlocker: readiness.data.governanceBlocker || '',
    governance,
    governanceStatus,
    message: message || (result.data?.state === 'failed'
      ? 'Lượt tải gần nhất chưa được backend xác nhận.'
      : ''),
    processingAction: '',
  })
}

function isAttachmentFileValidationCode(code) {
  return [
    'file-missing',
    'mime-not-allowed',
    'file-empty',
    'file-too-large',
    'extension-mismatch',
    'file-unreadable',
    'signature-mismatch',
  ].includes(code)
}

function getSafeStaffDocumentAttachmentAuditSummary(file) {
  const mimeCategory = file?.type === 'application/pdf' ? 'pdf' : 'image'
  const size = Number(file?.size || 0)
  const sizeBucket = size <= 1024 * 1024
    ? 'up-to-1mib'
    : size <= 5 * 1024 * 1024
      ? 'up-to-5mib'
      : 'up-to-10mib'
  return `${mimeCategory}-${sizeBucket}`
}

async function isStaffDocumentAttachmentFinalizeContextCurrent(captured) {
  const action = captured.expectedCurrentAttachmentId
    ? 'staff-document.attachment-replace'
    : 'staff-document.attachment-upload'
  if (
    !uploadingStaffDocumentWindowIds.has(captured.windowId) ||
    getCurrentStorageCenterId() !== captured.centerId
  ) return false
  const access = await getLatestStaffAdministrativeProfileAccessContext(
    captured.centerId,
    action,
  )
  if (
    !uploadingStaffDocumentWindowIds.has(captured.windowId) ||
    getCurrentStorageCenterId() !== captured.centerId ||
    !access.ok ||
    access.centerId !== captured.centerId
  ) return false
  refreshStaffDataFromStorage()
  const staffMember = getUniqueCurrentCenterStaffMember(captured.staffMemberId, captured.centerId)
  const lookup = resolveStaffAdministrativeProfileForStaff(
    staffAdministrativeProfiles,
    captured.staffMemberId,
    captured.centerId,
  )
  const documentRecord = staffDocuments.find(
    (item) =>
      item.id === captured.documentId &&
      item.centerId === captured.centerId &&
      item.staffMemberId === captured.staffMemberId &&
      item.administrativeProfileId === captured.administrativeProfileId,
  )
  const attachmentState = getStaffDocumentWindowState(captured.windowId)?.attachment
  return Boolean(
    staffMember &&
    !staffMember.archivedAt &&
    lookup.profile?.id === captured.administrativeProfileId &&
    documentRecord &&
    !documentRecord.archivedAt &&
    documentRecord.revision === captured.revision &&
    documentRecord.updatedAt === captured.updatedAt &&
    (
      !captured.expectedCurrentAttachmentId ||
      (
        attachmentState?.documentId === captured.documentId &&
        attachmentState?.record?.id === captured.expectedCurrentAttachmentId &&
        attachmentState.record.state === 'available' &&
        attachmentState.record.isPrimary === true
      )
    ),
  )
}

async function handleStaffDocumentAttachmentSelection(windowId, input) {
  if (uploadingStaffDocumentWindowIds.has(windowId)) return
  const file = input?.files?.[0]
  const context = getStaffDocumentWindowContext(windowId, {
    refresh: true,
    action: 'staff-document.attachment-upload',
  })
  const state = getStaffDocumentWindowState(windowId)
  const documentRecord = context?.documents.find(
    (item) => item.id === state?.selectedDocumentId,
  )
  if (
    !context ||
    !state ||
    state.mode !== 'detail' ||
    !documentRecord ||
    context.staffMember?.archivedAt ||
    documentRecord.archivedAt
  ) {
    if (windowId) denyStaffAdministrativeProfileWindow(windowId)
    return
  }

  const validation = validateStaffDocumentAttachmentFile(file)
  const auditSummary = getSafeStaffDocumentAttachmentAuditSummary(file)
  if (!validation.ok) {
    recordStaffAdministrativeAuditEvent(context.access, {
      action: 'staff-document.attachment-upload-failed',
      targetType: 'staff-document',
      targetId: documentRecord.id,
      ['staffMemberId']: context.staffMember.id,
      administrativeProfileId: context.lookup.profile.id,
      documentId: documentRecord.id,
      outcome: 'validation-failed',
      reasonCode: validation.code,
      noteSummary: auditSummary,
    })
    updateStaffDocumentAttachmentState(windowId, {
      status: 'failed',
      documentId: documentRecord.id,
      message: validation.error,
    })
    return
  }
  if (!window.confirm('Tải tệp đã chọn lên kho riêng tư?')) return

  const latestAccess = await getLatestStaffAdministrativeProfileAccessContext(
    context.access.centerId,
    'staff-document.attachment-upload',
  )
  if (!latestAccess.ok) {
    clearStaffDocumentAttachmentRuntime(windowId)
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  if (!recordStaffAdministrativeAuditEvent(latestAccess, {
    action: 'staff-document.attachment-upload-start',
    targetType: 'staff-document',
    targetId: documentRecord.id,
    ['staffMemberId']: context.staffMember.id,
    administrativeProfileId: context.lookup.profile.id,
    documentId: documentRecord.id,
    reasonCode: 'attachment-upload-start',
    noteSummary: auditSummary,
  })) {
    updateStaffDocumentAttachmentState(windowId, {
      status: 'failed',
      documentId: documentRecord.id,
      message: 'Không thể ghi nhật ký quyền riêng tư; lượt tải chưa được bắt đầu.',
    })
    return
  }

  const captured = {
    windowId,
    centerId: context.access.centerId,
    ['staffMemberId']: context.staffMember.id,
    administrativeProfileId: context.lookup.profile.id,
    documentId: documentRecord.id,
    revision: documentRecord.revision,
    updatedAt: documentRecord.updatedAt,
  }
  const token = issueStaffDocumentAttachmentRequestToken(windowId)
  uploadingStaffDocumentWindowIds.add(windowId)
  updateStaffDocumentAttachmentState(windowId, {
    ...state.attachment,
    status: 'preparing',
    documentId: documentRecord.id,
    isProcessing: true,
  })

  const result = await staffDocumentAttachmentService.upload({
    centerId: captured.centerId,
    ['staffMemberId']: captured.staffMemberId,
    administrativeProfileId: captured.administrativeProfileId,
    documentId: captured.documentId,
    file,
    onStage: ({ stage }) => {
      if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, captured.documentId)) return
      updateStaffDocumentAttachmentState(windowId, {
        ...getStaffDocumentWindowState(windowId)?.attachment,
        status: stage,
        documentId: captured.documentId,
        isProcessing: true,
      })
    },
    beforeFinalize: () => isStaffDocumentAttachmentFinalizeContextCurrent(captured),
  })
  uploadingStaffDocumentWindowIds.delete(windowId)
  if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, captured.documentId)) return

  const auditAccess = await getLatestStaffAdministrativeProfileAccessContext(
    captured.centerId,
    result.ok
      ? 'staff-document.attachment-view'
      : 'staff-document.attachment-upload',
  )
  if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, captured.documentId)) return
  if (!auditAccess.ok) {
    clearStaffDocumentAttachmentRuntime(windowId)
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  const attachmentId = result.data?.id || result.attachmentId || ''
  const auditSaved = recordStaffAdministrativeAuditEvent(auditAccess, {
    action: result.ok
      ? 'staff-document.attachment-upload-success'
      : 'staff-document.attachment-upload-failed',
    targetType: attachmentId ? 'staff-document-attachment' : 'staff-document',
    targetId: attachmentId || captured.documentId,
    ['staffMemberId']: captured.staffMemberId,
    administrativeProfileId: captured.administrativeProfileId,
    documentId: captured.documentId,
    attachmentId,
    outcome: result.ok
      ? 'success'
      : isAttachmentFileValidationCode(result.code)
        ? 'validation-failed'
        : result.code === 'stale-context'
          ? 'stale'
          : 'failed',
    reasonCode: result.ok ? 'attachment-upload-success' : result.code,
    noteSummary: auditSummary,
  })
  const latestAttachmentState = getStaffDocumentWindowState(windowId)?.attachment
  updateStaffDocumentAttachmentState(windowId, {
    ...latestAttachmentState,
    status: result.ok ? 'ready' : 'failed',
    documentId: captured.documentId,
    record: result.ok ? result.data : null,
    message: auditSaved
      ? (result.ok ? 'Tệp đã được backend xác nhận sẵn sàng.' : result.error)
      : 'Thao tác đã kết thúc nhưng nhật ký quyền riêng tư chưa ghi được. Vui lòng dừng và kiểm tra storage.',
    isProcessing: false,
  })
  if (result.ok && latestAttachmentState?.replacementReady) {
    void loadStaffDocumentAttachment(windowId, {
      preserveCurrent: true,
      message: 'Tệp đã được backend xác nhận sẵn sàng.',
    })
  }
}

async function handleStaffDocumentAttachmentReplacement(windowId, input) {
  if (uploadingStaffDocumentWindowIds.has(windowId)) return
  const file = input?.files?.[0]
  const context = getStaffDocumentWindowContext(windowId, {
    refresh: true,
    action: 'staff-document.attachment-replace',
  })
  const state = getStaffDocumentWindowState(windowId)
  const documentRecord = context?.documents.find(
    (item) => item.id === state?.selectedDocumentId,
  )
  const currentAttachment = state?.attachment?.record
  if (!context) {
    if (windowId) denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  if (
    !state ||
    state.mode !== 'detail' ||
    !documentRecord ||
    context.staffMember?.archivedAt ||
    documentRecord.archivedAt ||
    state.attachment?.replacementReady !== true ||
    currentAttachment?.state !== 'available' ||
    currentAttachment.isPrimary !== true ||
    currentAttachment.documentId !== documentRecord.id
  ) {
    if (windowId && state) {
      updateStaffDocumentAttachmentState(windowId, {
        ...state.attachment,
        status: 'replacement-failed',
        message: state.attachment?.replacementReady
          ? 'Không thể thay tệp từ trạng thái hiện tại; phiên bản hiện hành không đổi.'
          : 'Chức năng Thay tệp đang chờ migration F23.11E.1.',
        isProcessing: false,
      })
    }
    return
  }

  const validation = validateStaffDocumentAttachmentFile(file)
  const auditSummary = getSafeStaffDocumentAttachmentAuditSummary(file)
  if (!validation.ok) {
    recordStaffAdministrativeAuditEvent(context.access, {
      action: 'staff-document.attachment-replacement-failed',
      targetType: 'staff-document-attachment',
      targetId: currentAttachment.id,
      ['staffMemberId']: context.staffMember.id,
      administrativeProfileId: context.lookup.profile.id,
      documentId: documentRecord.id,
      attachmentId: currentAttachment.id,
      outcome: 'validation-failed',
      reasonCode: validation.code,
      noteSummary: `version-${currentAttachment.version}-${auditSummary}`,
    })
    updateStaffDocumentAttachmentState(windowId, {
      ...state.attachment,
      status: 'replacement-failed',
      message: validation.error,
      isProcessing: false,
    })
    return
  }

  const confirmed = window.confirm(
    'Tệp mới sẽ trở thành phiên bản hiện hành.\n' +
    'Phiên bản hiện tại vẫn được lưu trong lịch sử và có thể xem hoặc tải xuống.',
  )
  if (!confirmed) return

  const captured = {
    windowId,
    centerId: context.access.centerId,
    ['staffMemberId']: context.staffMember.id,
    administrativeProfileId: context.lookup.profile.id,
    documentId: documentRecord.id,
    revision: documentRecord.revision,
    updatedAt: documentRecord.updatedAt,
    expectedCurrentAttachmentId: currentAttachment.id,
  }
  uploadingStaffDocumentWindowIds.add(windowId)
  updateStaffDocumentAttachmentState(windowId, {
    ...state.attachment,
    status: 'preparing',
    message: '',
    isProcessing: true,
  })

  const latestAccess = await getLatestStaffAdministrativeProfileAccessContext(
    context.access.centerId,
    'staff-document.attachment-replace',
  )
  if (!latestAccess.ok) {
    uploadingStaffDocumentWindowIds.delete(windowId)
    clearStaffDocumentAttachmentRuntime(windowId)
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  if (!(await isStaffDocumentAttachmentFinalizeContextCurrent(captured))) {
    uploadingStaffDocumentWindowIds.delete(windowId)
    const latestState = getStaffDocumentWindowState(windowId)
    if (latestState?.selectedDocumentId === captured.documentId) {
      const staleMessage = 'Ngữ cảnh tài liệu đã thay đổi; phiên bản hiện hành không đổi.'
      updateStaffDocumentAttachmentState(windowId, {
        ...latestState.attachment,
        status: 'replacement-failed',
        message: staleMessage,
        isProcessing: false,
      })
      void loadStaffDocumentAttachment(windowId, {
        preserveCurrent: true,
        message: staleMessage,
      })
    }
    return
  }

  const token = issueStaffDocumentAttachmentRequestToken(windowId)
  let preparedAuditRecorded = false
  let replacementVersion = Number(currentAttachment.version || 1) + 1

  const result = await staffDocumentAttachmentService.replace({
    centerId: captured.centerId,
    ['staffMemberId']: captured.staffMemberId,
    administrativeProfileId: captured.administrativeProfileId,
    documentId: captured.documentId,
    expectedCurrentAttachmentId: captured.expectedCurrentAttachmentId,
    file,
    onStage: ({ stage, attachmentId, version }) => {
      if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, captured.documentId)) return
      if (Number(version) > 0) replacementVersion = Number(version)
      if (stage === 'uploading' && attachmentId && !preparedAuditRecorded) {
        preparedAuditRecorded = recordStaffAdministrativeAuditEvent(latestAccess, {
          action: 'staff-document.attachment-replacement-prepared',
          targetType: 'staff-document-attachment',
          targetId: attachmentId,
          ['staffMemberId']: captured.staffMemberId,
          administrativeProfileId: captured.administrativeProfileId,
          documentId: captured.documentId,
          attachmentId,
          reasonCode: 'attachment-replacement-prepared',
          noteSummary: `version-${replacementVersion}-${auditSummary}`,
        })
      }
      updateStaffDocumentAttachmentState(windowId, {
        ...getStaffDocumentWindowState(windowId)?.attachment,
        status: stage,
        isProcessing: true,
      })
    },
    beforeFinalize: () => isStaffDocumentAttachmentFinalizeContextCurrent(captured),
  })
  uploadingStaffDocumentWindowIds.delete(windowId)
  if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, captured.documentId)) return

  const auditAccess = await getLatestStaffAdministrativeProfileAccessContext(
    captured.centerId,
    'staff-document.attachment-replace',
  )
  if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, captured.documentId)) return
  if (!auditAccess.ok) {
    clearStaffDocumentAttachmentRuntime(windowId)
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }

  const replacementAttachmentId = result.data?.id || result.attachmentId || ''
  const auditSaved = recordStaffAdministrativeAuditEvent(auditAccess, {
    action: result.ok
      ? 'staff-document.attachment-replacement-completed'
      : 'staff-document.attachment-replacement-failed',
    targetType: 'staff-document-attachment',
    targetId: replacementAttachmentId || captured.expectedCurrentAttachmentId,
    ['staffMemberId']: captured.staffMemberId,
    administrativeProfileId: captured.administrativeProfileId,
    documentId: captured.documentId,
    attachmentId: replacementAttachmentId || captured.expectedCurrentAttachmentId,
    outcome: result.ok
      ? 'success'
      : result.code === 'replacement-stale'
        ? 'stale'
        : isAttachmentFileValidationCode(result.code)
          ? 'validation-failed'
          : 'failed',
    reasonCode: result.ok ? 'attachment-replacement-completed' : result.code,
    noteSummary: `version-${replacementVersion}-${auditSummary}`,
  })

  if (result.ok) {
    updateStaffDocumentAttachmentState(windowId, {
      ...getStaffDocumentWindowState(windowId)?.attachment,
      status: 'ready',
      record: result.data,
      message: auditSaved
        ? 'Tệp mới đã trở thành phiên bản hiện hành; bản cũ được giữ trong lịch sử.'
        : 'Thay tệp đã hoàn tất nhưng nhật ký quyền riêng tư chưa ghi được.',
      isProcessing: false,
    })
    void loadStaffDocumentAttachment(windowId, {
      preserveCurrent: true,
      message: 'Tệp mới đã trở thành phiên bản hiện hành; bản cũ được giữ trong lịch sử.',
    })
    return
  }

  const failureMessage = auditSaved
    ? result.error
    : 'Thay tệp không hoàn tất và nhật ký quyền riêng tư chưa ghi được; phiên bản hiện hành không đổi.'
  updateStaffDocumentAttachmentState(windowId, {
    ...getStaffDocumentWindowState(windowId)?.attachment,
    status: 'replacement-failed',
    record: currentAttachment,
    message: failureMessage,
    isProcessing: false,
  })
  void loadStaffDocumentAttachment(windowId, {
    preserveCurrent: true,
    message: failureMessage,
  })
}

const STAFF_DOCUMENT_ATTACHMENT_GOVERNANCE_PERMISSION = Object.freeze({
  remove: 'staff-document.attachment-remove',
  'deletion-request': 'staff-document.attachment-deletion-request',
  approve: 'staff-document.attachment-deletion-review',
  reject: 'staff-document.attachment-deletion-review',
  cancel: 'staff-document.attachment-deletion-cancel',
  execute: 'staff-document.attachment-deletion-execute',
  'hold-place': 'staff-document.attachment-legal-hold',
  'hold-release': 'staff-document.attachment-legal-hold',
})

const STAFF_DOCUMENT_ATTACHMENT_GOVERNANCE_AUDIT_ACTION = Object.freeze({
  remove: 'staff_document_attachment_removed',
  'deletion-request': 'staff_document_attachment_deletion_requested',
  approve: 'staff_document_attachment_deletion_approved',
  reject: 'staff_document_attachment_deletion_rejected',
  cancel: 'staff_document_attachment_deletion_canceled',
  execute: 'staff_document_attachment_deletion_completed',
  'hold-place': 'staff_document_attachment_legal_hold_placed',
  'hold-release': 'staff_document_attachment_legal_hold_released',
})

function confirmStaffDocumentAttachmentGovernanceAction(action) {
  const message = {
    remove:
      'Tệp sẽ không còn là phiên bản hiện hành của tài liệu.\n' +
      'Tệp vẫn được lưu riêng tư trong lịch sử và chưa bị xóa khỏi hệ thống.',
    'deletion-request':
      'Đây là yêu cầu xóa vĩnh viễn object khỏi kho lưu trữ riêng tư.\n' +
      'Yêu cầu cần Owner khác phê duyệt và chỉ được thực thi khi đủ điều kiện lưu trữ, không có legal hold.',
    approve: 'Phê duyệt yêu cầu xóa này? Object chưa bị xóa cho đến khi Owner chủ động thực thi.',
    reject: 'Từ chối yêu cầu xóa này? Object vẫn được giữ riêng tư.',
    cancel: 'Hủy yêu cầu xóa này? Phiên bản và object vẫn được giữ riêng tư.',
    execute:
      'Object sẽ bị xóa khỏi kho lưu trữ riêng tư.\n' +
      'Sau khi hoàn tất, phiên bản chỉ còn bản ghi lịch sử và không thể xem hoặc tải xuống.',
    'hold-place': 'Đặt legal hold cho phiên bản này? Mọi phê duyệt và thực thi xóa sẽ bị chặn.',
    'hold-release': 'Giải phóng legal hold? Yêu cầu xóa sẽ không tự động thực thi.',
  }[action]
  return Boolean(message && window.confirm(message))
}

async function handleStaffDocumentAttachmentGovernanceAction(windowId, action, button) {
  if (uploadingStaffDocumentWindowIds.has(windowId)) return
  const permission = STAFF_DOCUMENT_ATTACHMENT_GOVERNANCE_PERMISSION[action]
  if (!permission || !confirmStaffDocumentAttachmentGovernanceAction(action)) return

  const context = getStaffDocumentWindowContext(windowId, {
    refresh: true,
    action: permission,
  })
  const state = getStaffDocumentWindowState(windowId)
  const documentRecord = context?.documents.find(
    (item) => item.id === state?.selectedDocumentId,
  )
  const attachmentId = String(button?.dataset?.attachmentId || '').trim()
  const requestId = String(button?.dataset?.requestId || '').trim()
  const attachment = action === 'remove'
    ? state?.attachment?.record
    : state?.attachment?.history?.find((item) => item.id === attachmentId)
  const request = state?.attachment?.governance?.requests?.find((item) => item.id === requestId)
  const capabilityReady = action === 'remove'
    ? state?.attachment?.softRemovalReady === true
    : action === 'execute'
      ? state?.attachment?.permanentExecutionReady === true
      : state?.attachment?.deletionGovernanceReady === true

  if (
    !context ||
    !state ||
    state.mode !== 'detail' ||
    !documentRecord ||
    !capabilityReady ||
    context.staffMember?.archivedAt ||
    documentRecord.archivedAt ||
    (!attachment || attachment.documentId !== documentRecord.id) ||
    (['approve', 'reject', 'cancel', 'execute'].includes(action) && !request)
  ) {
    if (windowId && !context) denyStaffAdministrativeProfileWindow(windowId)
    return
  }

  const captured = {
    centerId: context.access.centerId,
    ['staffMemberId']: context.staffMember.id,
    administrativeProfileId: context.lookup.profile.id,
    documentId: documentRecord.id,
    attachmentId: attachment?.id || '',
    requestId: request?.id || '',
    version: Number(attachment?.version || 0),
  }
  const token = issueStaffDocumentAttachmentRequestToken(windowId)
  const processingAction = `${captured.attachmentId}:${captured.requestId}`
  uploadingStaffDocumentWindowIds.add(windowId)
  updateStaffDocumentAttachmentState(windowId, {
    ...state.attachment,
    status: action === 'execute' ? 'preparing-deletion' : 'governance-processing',
    isProcessing: true,
    processingAction,
    message: '',
  })

  const latestAccess = await getLatestStaffAdministrativeProfileAccessContext(
    context.access.centerId,
    permission,
  )
  if (!latestAccess.ok) {
    clearStaffDocumentAttachmentRuntime(windowId)
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }

  let executionStartAudited = false
  let result
  if (action === 'remove') {
    result = await staffDocumentAttachmentService.removeFromDocument({
      centerId: captured.centerId,
      attachmentId: captured.attachmentId,
      expectedCurrentAttachmentId: captured.attachmentId,
      reasonCode: 'user_requested',
    })
  } else if (action === 'deletion-request') {
    result = await staffDocumentAttachmentService.requestDeletion({
      centerId: captured.centerId,
      attachmentId: captured.attachmentId,
      reasonCode: 'user_requested',
    })
  } else if (action === 'approve') {
    result = await staffDocumentAttachmentService.approveDeletion({
      centerId: captured.centerId,
      requestId: captured.requestId,
    })
  } else if (action === 'reject') {
    result = await staffDocumentAttachmentService.rejectDeletion({
      centerId: captured.centerId,
      requestId: captured.requestId,
    })
  } else if (action === 'cancel') {
    result = await staffDocumentAttachmentService.cancelDeletion({
      centerId: captured.centerId,
      requestId: captured.requestId,
      owner: latestAccess.role === 'owner',
    })
  } else if (action === 'hold-place') {
    result = await staffDocumentAttachmentService.placeLegalHold({
      centerId: captured.centerId,
      attachmentId: captured.attachmentId,
    })
  } else if (action === 'hold-release') {
    result = await staffDocumentAttachmentService.releaseLegalHold({
      centerId: captured.centerId,
      attachmentId: captured.attachmentId,
    })
  } else if (action === 'execute') {
    result = await staffDocumentAttachmentService.executeDeletion({
      centerId: captured.centerId,
      ['staffMemberId']: captured.staffMemberId,
      administrativeProfileId: captured.administrativeProfileId,
      documentId: captured.documentId,
      requestId: captured.requestId,
      attachmentId: captured.attachmentId,
      onStage: ({ stage }) => {
        if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, captured.documentId)) return
        if (stage === 'deleting' && !executionStartAudited) {
          executionStartAudited = recordStaffAdministrativeAuditEvent(latestAccess, {
            action: 'staff_document_attachment_deletion_execution_started',
            targetType: 'staff-document-attachment',
            targetId: captured.attachmentId,
            ['staffMemberId']: captured.staffMemberId,
            administrativeProfileId: captured.administrativeProfileId,
            documentId: captured.documentId,
            attachmentId: captured.attachmentId,
            requestId: captured.requestId,
            reasonCode: 'execution_started',
            noteSummary: `version-${captured.version}-executing`,
          })
        }
        updateStaffDocumentAttachmentState(windowId, {
          ...getStaffDocumentWindowState(windowId)?.attachment,
          status: stage === 'deleting' ? 'deleting' : `${stage}-deletion`,
          isProcessing: true,
          processingAction,
        })
      },
    })
  }

  uploadingStaffDocumentWindowIds.delete(windowId)
  if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, captured.documentId)) return
  const auditAction = result?.ok
    ? STAFF_DOCUMENT_ATTACHMENT_GOVERNANCE_AUDIT_ACTION[action]
    : action === 'execute'
      ? 'staff_document_attachment_deletion_failed'
      : STAFF_DOCUMENT_ATTACHMENT_GOVERNANCE_AUDIT_ACTION[action]
  const resultingRequestId = result?.data?.id || captured.requestId
  if (auditAction) {
    recordStaffAdministrativeAuditEvent(latestAccess, {
      action: auditAction,
      targetType: 'staff-document-attachment',
      targetId: captured.attachmentId,
      ['staffMemberId']: captured.staffMemberId,
      administrativeProfileId: captured.administrativeProfileId,
      documentId: captured.documentId,
      attachmentId: captured.attachmentId,
      requestId: resultingRequestId,
      outcome: result?.ok ? 'success' : result?.code === 'removal-stale' ? 'stale' : 'failed',
      reasonCode: result?.ok
        ? action === 'remove'
          ? 'user_requested'
          : action === 'deletion-request'
            ? 'user_requested'
            : action === 'approve'
              ? 'owner_approved'
              : action === 'reject'
                ? 'owner_rejected'
                : action === 'cancel'
                  ? latestAccess.role === 'owner' ? 'owner_canceled' : 'requester_canceled'
                  : action === 'hold-place'
                    ? 'legal_requirement'
                    : action === 'hold-release'
                      ? 'hold_released'
                      : action === 'execute'
                        ? 'object_absence_verified'
                        : 'server_retention_confirmed'
        : result?.code || 'governance_failed',
      noteSummary: `version-${captured.version}-${result?.ok ? 'success' : 'failed'}`,
    })
  }

  const message = result?.ok
    ? {
        remove: 'Tệp đã được gỡ khỏi phiên bản hiện hành và vẫn được giữ riêng tư trong lịch sử.',
        'deletion-request': 'Đã tạo yêu cầu xóa; object chưa bị xóa.',
        approve: 'Đã phê duyệt; chưa tự động xóa object.',
        reject: 'Đã từ chối yêu cầu xóa.',
        cancel: 'Đã hủy yêu cầu xóa.',
        execute: 'Đã xóa object và ghi tombstone lịch sử.',
        'hold-place': 'Đã đặt legal hold; phê duyệt và thực thi xóa bị chặn.',
        'hold-release': 'Đã giải phóng legal hold; không có thao tác xóa tự động.',
      }[action]
    : result?.error || 'Không thể hoàn tất thao tác quản trị tệp.'
  updateStaffDocumentAttachmentState(windowId, {
    ...getStaffDocumentWindowState(windowId)?.attachment,
    status: result?.ok ? 'ready' : 'error',
    message,
    isProcessing: false,
    processingAction: '',
  })
  void loadStaffDocumentAttachment(windowId, { preserveCurrent: true, message })
}

async function handleStaffDocumentAttachmentAccess(
  windowId,
  mode,
  triggerElement = null,
  requestedVersion = null,
) {
  const action = mode === 'download'
    ? 'staff-document.attachment-download'
    : 'staff-document.attachment-view'
  const context = getStaffDocumentWindowContext(windowId, { refresh: true, action })
  const state = getStaffDocumentWindowState(windowId)
  const documentRecord = context?.documents.find(
    (item) => item.id === state?.selectedDocumentId,
  )
  const normalizedVersion = Number(requestedVersion)
  const isVersionAccess = Number.isInteger(normalizedVersion) && normalizedVersion > 0
  const attachment = isVersionAccess
    ? state?.attachment?.history?.find((item) => Number(item.version) === normalizedVersion)
    : state?.attachment?.record
  if (
    !context ||
    !state ||
    !documentRecord ||
    !attachment ||
    !(
      (attachment.state === 'available' && attachment.isPrimary === true) ||
      (attachment.state === 'archived' && attachment.isPrimary === false)
    ) ||
    attachment.documentId !== documentRecord.id
  ) return

  const viewerReturnContext = mode === 'download'
    ? null
    : captureStaffDocumentAttachmentViewerReturnContext(
        windowId,
        documentRecord,
        attachment,
        triggerElement,
      )
  if (mode !== 'download' && !viewerReturnContext) return

  const token = issueStaffDocumentAttachmentRequestToken(windowId)
  setStaffDocumentWindowState(windowId, {
    ...state,
    attachment: {
      ...state.attachment,
      message: mode === 'download' ? 'Đang chuẩn bị tải xuống…' : 'Đang chuẩn bị xem…',
    },
  })
  refreshStaffDocumentsSection(windowId)
  const result = await staffDocumentAttachmentService.createAccessUrl({
    centerId: context.access.centerId,
    ['staffMemberId']: context.staffMember.id,
    administrativeProfileId: context.lookup.profile.id,
    documentId: documentRecord.id,
    attachmentId: attachment.id,
    mode,
  })
  if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, documentRecord.id)) return
  if (!result.ok) {
    if (getStaffDocumentAttachmentResultStatus(result) === 'denied') {
      clearStaffDocumentAttachmentRuntime(windowId)
      denyStaffAdministrativeProfileWindow(windowId)
      return
    }
    updateStaffDocumentAttachmentState(windowId, {
      ...state.attachment,
      status: 'error',
      documentId: documentRecord.id,
      message: result.error,
    })
    return
  }

  const latestAccess = await getLatestStaffAdministrativeProfileAccessContext(
    context.access.centerId,
    action,
  )
  if (!isCurrentStaffDocumentAttachmentRequest(windowId, token, documentRecord.id)) return
  if (!latestAccess.ok) {
    clearStaffDocumentAttachmentRuntime(windowId)
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  const auditSaved = recordStaffAdministrativeAuditEvent(latestAccess, {
    action: isVersionAccess
      ? mode === 'download'
        ? 'staff-document.attachment-version-download'
        : 'staff-document.attachment-version-view'
      : mode === 'download'
        ? 'staff-document.attachment-download'
        : 'staff-document.attachment-view',
    targetType: 'staff-document-attachment',
    targetId: attachment.id,
    ['staffMemberId']: context.staffMember.id,
    administrativeProfileId: context.lookup.profile.id,
    documentId: documentRecord.id,
    attachmentId: attachment.id,
    reasonCode: isVersionAccess
      ? mode === 'download'
        ? 'attachment-version-download'
        : 'attachment-version-view'
      : mode === 'download'
        ? 'attachment-download'
        : 'attachment-view',
    noteSummary: `version-${attachment.version}-${attachment.mimeType === 'application/pdf' ? 'pdf' : 'image'}`,
  })
  if (!auditSaved) {
    updateStaffDocumentAttachmentState(windowId, {
      ...state.attachment,
      status: 'error',
      documentId: documentRecord.id,
      message: 'Không thể ghi nhật ký quyền riêng tư; quyền truy cập tệp không được sử dụng.',
    })
    return
  }

  if (mode === 'download') {
    const anchor = document.createElement('a')
    anchor.href = result.data.signedUrl
    anchor.download = result.data.safeFileName || 'staff-document'
    anchor.rel = 'noopener noreferrer'
    anchor.hidden = true
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    updateStaffDocumentAttachmentState(windowId, {
      ...state.attachment,
      message: '',
    })
    return
  }

  staffDocumentAttachmentViewerState = {
    windowId,
    centerId: context.access.centerId,
    documentId: documentRecord.id,
    attachmentId: attachment.id,
    mimeType: result.data.mimeType,
    signedUrl: result.data.signedUrl,
    expiresAt: Date.now() + result.data.expiresIn * 1000,
    returnContext: viewerReturnContext,
    expiryTimerId: null,
  }
  const viewerAttachmentId = attachment.id
  staffDocumentAttachmentViewerState.expiryTimerId = window.setTimeout(() => {
    if (
      staffDocumentAttachmentViewerState?.attachmentId === viewerAttachmentId &&
      Date.now() >= staffDocumentAttachmentViewerState.expiresAt
    ) closeStaffDocumentAttachmentViewer()
  }, result.data.expiresIn * 1000)
  render()
}

function refreshStaffDocumentResultsRegion(windowId) {
  const context = getStaffDocumentWindowContext(windowId)
  const state = getStaffDocumentWindowState(windowId)
  const windowElement = document.querySelector(
    `.desktop-window.is-staff-administrative-profile[data-window-id="${CSS.escape(windowId)}"]`,
  )
  const currentResults = windowElement?.querySelector('[data-staff-document-results]')
  if (!context || !state || !currentResults || state.mode !== 'list') return

  const nextResults = document.createElement('div')
  nextResults.dataset.staffDocumentResults = ''
  nextResults.innerHTML = renderStaffDocumentResults({
    documents: context.documents,
    filteredDocuments: getFilteredStaffDocuments(context.documents, state.filters),
    readOnly: Boolean(context.staffMember?.archivedAt),
  })
  currentResults.replaceWith(nextResults)
}

function updateStaffDocumentFilter(windowId, filterName, value) {
  if (!getStaffDocumentWindowContext(windowId)) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  const state = getStaffDocumentWindowState(windowId)
  if (!state || state.mode !== 'list' || !Object.hasOwn(initialStaffDocumentFilters, filterName)) {
    return
  }
  setStaffDocumentWindowState(windowId, {
    ...state,
    filters: { ...state.filters, [filterName]: value },
    message: '',
  })
  refreshStaffDocumentResultsRegion(windowId)
}

function clearStaffDocumentFilters(windowId) {
  if (!getStaffDocumentWindowContext(windowId)) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  const state = getStaffDocumentWindowState(windowId)
  if (!state || state.mode !== 'list') return
  const filters = { ...initialStaffDocumentFilters }
  setStaffDocumentWindowState(windowId, { ...state, filters, message: '' })
  const windowElement = document.querySelector(
    `.desktop-window.is-staff-administrative-profile[data-window-id="${CSS.escape(windowId)}"]`,
  )
  windowElement?.querySelectorAll('[data-staff-document-filter]').forEach((control) => {
    control.value = filters[control.dataset.staffDocumentFilter]
  })
  refreshStaffDocumentResultsRegion(windowId)
}

function startStaffDocumentCreate(windowId) {
  const context = getStaffDocumentWindowContext(windowId, {
    refresh: true,
    action: 'staff-document.create',
  })
  if (!context) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  const state = getStaffDocumentWindowState(windowId)
  if (!context?.storageContext.ok || !state || context.staffMember?.archivedAt) {
    setStaffDocumentSafeMessage(windowId, 'Không thể tạo tài liệu từ trạng thái hiện tại.')
    return
  }
  setStaffDocumentWindowState(windowId, {
    ...createStaffDocumentWindowState(
      context.access.centerId,
      context.staffMember.id,
      context.lookup.profile.id,
    ),
    mode: 'create',
    filters: state.filters,
    values: createStaffDocumentDraft(),
  })
  refreshStaffDocumentsSection(windowId)
}

function startStaffDocumentEdit(windowId, documentId) {
  const context = getStaffDocumentWindowContext(windowId, {
    refresh: true,
    action: 'staff-document.edit',
  })
  if (!context) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  const state = getStaffDocumentWindowState(windowId)
  const matches = context?.documents.filter((item) => item.id === documentId) || []
  const documentRecord = matches.length === 1 ? matches[0] : null
  if (
    !context?.storageContext.ok ||
    !state ||
    context.staffMember?.archivedAt ||
    !documentRecord ||
    documentRecord.archivedAt
  ) {
    setStaffDocumentSafeMessage(windowId, 'Không thể sửa tài liệu từ trạng thái hiện tại.')
    return
  }
  setStaffDocumentWindowState(windowId, {
    ...state,
    mode: 'edit',
    selectedDocumentId: documentRecord.id,
    expectedRevision: documentRecord.revision,
    expectedUpdatedAt: documentRecord.updatedAt,
    expectedArchivedAt: documentRecord.archivedAt || '',
    values: createEditStaffDocumentDraft(documentRecord),
    errors: {},
    message: '',
    isSaving: false,
  })
  refreshStaffDocumentsSection(windowId)
}

function openStaffDocumentDetail(windowId, documentId) {
  const context = getStaffDocumentWindowContext(windowId, { refresh: true })
  if (!context) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  const state = getStaffDocumentWindowState(windowId)
  const matches = context?.documents.filter((item) => item.id === documentId) || []
  if (!context?.storageContext.ok || !state || matches.length !== 1) {
    setStaffDocumentSafeMessage(windowId, 'Không thể mở chi tiết tài liệu từ dữ liệu hiện tại.')
    return
  }
  setStaffDocumentWindowState(windowId, {
    ...state,
    mode: 'detail',
    selectedDocumentId: documentId,
    values: null,
    errors: {},
    message: '',
    isSaving: false,
    attachment: createStaffDocumentAttachmentState({
      status: 'checking',
      documentId,
    }),
  })
  refreshStaffDocumentsSection(windowId)
  void loadStaffDocumentAttachment(windowId)
}

function closeStaffDocumentFormOrDetail(windowId) {
  if (!getStaffDocumentWindowContext(windowId)) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  const state = getStaffDocumentWindowState(windowId)
  if (!state || state.isSaving) return
  clearStaffDocumentAttachmentRuntime(windowId)
  setStaffDocumentWindowState(windowId, {
    ...state,
    mode: 'list',
    selectedDocumentId: '',
    expectedRevision: null,
    expectedUpdatedAt: '',
    expectedArchivedAt: '',
    values: null,
    errors: {},
    message: '',
    isSaving: false,
    attachment: createStaffDocumentAttachmentState(),
  })
  refreshStaffDocumentsSection(windowId)
}

function updateStaffDocumentDraftField(windowId, field, value) {
  if (!getStaffDocumentWindowContext(windowId)) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  const state = getStaffDocumentWindowState(windowId)
  if (!state || !['create', 'edit'].includes(state.mode) || state.isSaving) return
  setStaffDocumentWindowState(windowId, {
    ...state,
    values: setStaffDocumentDraftValue(state.values, field, value),
  })
}

function collectStaffDocumentDraftValues(formElement, state) {
  let values = state.values
  formElement.querySelectorAll('[data-staff-document-field]').forEach((control) => {
    values = setStaffDocumentDraftValue(
      values,
      control.dataset.staffDocumentField,
      control.value,
    )
  })
  return values
}

async function getLatestStaffDocumentMutationContext(
  windowId,
  capturedState,
  action = capturedState.mode === 'create' ? 'staff-document.create' : 'staff-document.edit',
) {
  const access = await getLatestStaffAdministrativeProfileAccessContext(capturedState.centerId)
  if (!access.ok || !hasStaffAdministrativeAction(access, action)) {
    denyStaffAdministrativeProfileWindow(windowId)
    return null
  }
  const windowItem = openWindows.find(
    (item) => item.id === windowId && item.type === 'staff-administrative-profile',
  )
  const state = getStaffDocumentWindowState(windowId)
  if (
    !windowItem ||
    !state ||
    windowItem.centerId !== capturedState.centerId ||
    state.centerId !== capturedState.centerId ||
    state.staffMemberId !== capturedState.staffMemberId ||
    getCurrentStorageCenterId() !== capturedState.centerId
  ) return null

  refreshStaffDataFromStorage()
  const context = getStaffDocumentWindowContext(windowId)
  if (
    !context?.storageContext.ok ||
    !isC55StaffHrProjectionHealthy(capturedState.centerId) ||
    !context.lookup.profile ||
    context.lookup.profile.id !== capturedState.administrativeProfileId ||
    context.staffMember?.archivedAt
  ) return null
  return { ...context, access, state }
}

async function handleStaffDocumentSubmit(windowId, formElement) {
  const capturedState = getStaffDocumentWindowState(windowId)
  if (
    !capturedState ||
    !['create', 'edit'].includes(capturedState.mode) ||
    capturedState.isSaving ||
    savingStaffDocumentWindowIds.has(windowId)
  ) return

  const values = collectStaffDocumentDraftValues(formElement, capturedState)
  const errors = validateStaffDocument(values)
  if (Object.keys(errors).length) {
    setStaffDocumentWindowState(windowId, {
      ...capturedState,
      values,
      errors,
      message: 'Vui lòng kiểm tra các trường chưa hợp lệ.',
    })
    refreshStaffDocumentsSection(windowId)
    return
  }

  savingStaffDocumentWindowIds.add(windowId)
  setStaffDocumentWindowState(windowId, {
    ...capturedState,
    values,
    errors: {},
    message: '',
    isSaving: true,
  })
  refreshStaffDocumentsSection(windowId)

  const latest = await getLatestStaffDocumentMutationContext(windowId, capturedState)
  if (!latest) {
    finishStaffDocumentMutationWithMessage(
      windowId,
      'Quyền truy cập hoặc liên kết hồ sơ đã thay đổi. Không ghi dữ liệu.',
    )
    return
  }

  const latestMatches = capturedState.mode === 'edit'
    ? latest.documents.filter((item) => item.id === capturedState.selectedDocumentId)
    : []
  const existingDocument = latestMatches.length === 1 ? latestMatches[0] : null
  if (
    capturedState.mode === 'edit' &&
    (
      !existingDocument ||
      existingDocument.revision !== capturedState.expectedRevision ||
      existingDocument.updatedAt !== capturedState.expectedUpdatedAt ||
      (existingDocument.archivedAt || '') !== capturedState.expectedArchivedAt
    )
  ) {
    finishStaffDocumentMutationWithMessage(windowId, STAFF_DOCUMENT_STALE_MESSAGE)
    return
  }

  const documentId = capturedState.mode === 'create'
    ? createStaffDocumentId()
    : capturedState.selectedDocumentId
  if (
    capturedState.mode === 'create' &&
    staffDocuments.some((documentRecord) => documentRecord.id === documentId)
  ) {
    finishStaffDocumentMutationWithMessage(
      windowId,
      'Không thể tạo stable document ID duy nhất. Vui lòng thử lại.',
    )
    return
  }

  const savedDocument = buildStaffDocumentFromDraft(values, existingDocument, {
    centerId: capturedState.centerId,
    ['staffMemberId']: capturedState.staffMemberId,
    administrativeProfileId: capturedState.administrativeProfileId,
    documentId,
  })
  const nextDocuments = capturedState.mode === 'create'
    ? [savedDocument, ...staffDocuments]
    : staffDocuments.map((documentRecord) =>
        documentRecord.id === savedDocument.id ? savedDocument : documentRecord,
      )
  if (
    getStaffDocumentRelationshipIssues(nextDocuments, {
      centerId: capturedState.centerId,
      staffMembers,
      administrativeProfiles: staffAdministrativeProfiles,
    }).length
  ) {
    finishStaffDocumentMutationWithMessage(
      windowId,
      'Hệ thống đã dừng lưu vì collection tài liệu cần được kiểm tra.',
    )
    return
  }

  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('staff_document', savedDocument),
    { reason: capturedState.mode === 'create' ? 'document-create' : 'document-update' },
  )
  if (!committed.ok) {
    finishStaffDocumentMutationWithMessage(
      windowId,
      committed.error || 'Không commit được metadata tài liệu lên server.',
    )
    return
  }
  setStaffDocumentWindowState(windowId, {
    ...capturedState,
    mode: 'detail',
    selectedDocumentId: savedDocument.id,
    expectedRevision: null,
    expectedUpdatedAt: '',
    expectedArchivedAt: '',
    values: null,
    errors: {},
    message: 'Đã commit metadata tài liệu và tải lại authoritative projection.',
    isSaving: false,
  })
  savingStaffDocumentWindowIds.delete(windowId)
  refreshStaffDocumentsSection(windowId)
}

async function changeStaffDocumentArchiveState(windowId, documentId, action) {
  const permissionAction = action === 'archive'
    ? 'staff-document.archive'
    : 'staff-document.restore'
  const context = getStaffDocumentWindowContext(windowId, {
    refresh: true,
    action: permissionAction,
  })
  if (!context) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  const state = getStaffDocumentWindowState(windowId)
  const matches = context?.documents.filter((item) => item.id === documentId) || []
  const capturedDocument = matches.length === 1 ? matches[0] : null
  if (
    !context?.storageContext.ok ||
    !state ||
    !capturedDocument ||
    context.staffMember?.archivedAt ||
    savingStaffDocumentWindowIds.has(windowId)
  ) {
    setStaffDocumentSafeMessage(windowId, 'Không thể thay đổi lưu trữ từ trạng thái hiện tại.')
    return
  }
  if (action === 'archive' && capturedDocument.archivedAt) return
  if (action === 'restore' && !capturedDocument.archivedAt) return

  const confirmation = action === 'archive'
    ? 'Lưu trữ tài liệu này? Bạn có thể khôi phục sau.'
    : 'Khôi phục tài liệu này vào danh mục đang quản lý?'
  if (!window.confirm(confirmation)) return

  savingStaffDocumentWindowIds.add(windowId)
  setStaffDocumentWindowState(windowId, { ...state, isSaving: true, message: '' })
  refreshStaffDocumentsSection(windowId)
  const latest = await getLatestStaffDocumentMutationContext(windowId, state, permissionAction)
  const latestMatches = latest?.documents.filter((item) => item.id === documentId) || []
  const latestDocument = latestMatches.length === 1 ? latestMatches[0] : null
  if (
    !latestDocument ||
    latestDocument.revision !== capturedDocument.revision ||
    latestDocument.updatedAt !== capturedDocument.updatedAt ||
    (latestDocument.archivedAt || '') !== (capturedDocument.archivedAt || '')
  ) {
    finishStaffDocumentMutationWithMessage(windowId, STAFF_DOCUMENT_STALE_MESSAGE)
    return
  }

  const changedDocument = action === 'archive'
    ? archiveStaffDocument(latestDocument)
    : restoreStaffDocument(latestDocument)
  if (!changedDocument) {
    finishStaffDocumentMutationWithMessage(windowId, 'Không thể thay đổi trạng thái lưu trữ.')
    return
  }
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('staff_document', changedDocument, {
      auditAction: action === 'restore' ? 'staff-document.restore' : 'staff-document.archive',
    }),
    { reason: action === 'archive' ? 'document-archive' : 'document-restore' },
  )
  if (!committed.ok) {
    finishStaffDocumentMutationWithMessage(
      windowId,
      committed.error || 'Không commit được trạng thái tài liệu.',
    )
    return
  }
  setStaffDocumentWindowState(windowId, {
    ...state,
    mode: 'list',
    selectedDocumentId: '',
    isSaving: false,
    message: action === 'archive'
      ? 'Đã commit lưu trữ tài liệu.'
      : 'Đã commit khôi phục tài liệu.',
  })
  savingStaffDocumentWindowIds.delete(windowId)
  refreshStaffDocumentsSection(windowId)
}

function setStaffDocumentSafeMessage(windowId, message) {
  const state = getStaffDocumentWindowState(windowId)
  if (!state) return
  setStaffDocumentWindowState(windowId, { ...state, isSaving: false, message })
  savingStaffDocumentWindowIds.delete(windowId)
  refreshStaffDocumentsSection(windowId)
}

function finishStaffDocumentMutationWithMessage(windowId, message) {
  setStaffDocumentSafeMessage(windowId, message)
}

function getStaffAdministrativeGovernanceWindowContext(
  windowId,
  { refresh = false, action = 'privacy-audit.view' } = {},
) {
  const windowItem = openWindows.find(
    (item) => item.id === windowId && item.type === 'staff-administrative-profile',
  )
  const access = getStaffAdministrativeProfileAccessContext(action)
  if (!windowItem || !access.ok || windowItem.centerId !== access.centerId) return null
  if (refresh) refreshStaffDataFromStorage()

  const staffMember = getUniqueCurrentCenterStaffMember(windowItem.staffMemberId, access.centerId)
  const profileProjectionHealthy = isC55StaffHrProjectionHealthy(access.centerId)
  const lookup = profileProjectionHealthy
    ? resolveStaffAdministrativeProfileForStaff(
        staffAdministrativeProfiles,
        windowItem.staffMemberId,
        access.centerId,
      )
    : { status: 'malformed', profile: null }
  const storageContext = getStaffAdministrativeGovernanceStorageContext(access.centerId)
  const state = getStaffAdministrativeGovernanceWindowState(windowId)
  if (
    !staffMember ||
    !lookup.profile ||
    !state ||
    state.centerId !== access.centerId ||
    state.staffMemberId !== staffMember.id ||
    state.administrativeProfileId !== lookup.profile.id
  ) return null
  return { windowItem, access, staffMember, lookup, storageContext, state }
}

function getScopedStaffAdministrativeAuditEvents(context) {
  return staffAdministrativeAuditEvents.filter(
    (event) =>
      event.staffMemberId === context.staffMember.id ||
      (event.targetType === 'retention-policy' && event.centerId === context.access.centerId),
  )
}

function refreshStaffAdministrativeGovernanceSection(windowId) {
  const context = getStaffAdministrativeGovernanceWindowContext(windowId, {
    action: 'privacy-audit.view',
  })
  const windowElement = document.querySelector(
    `.desktop-window.is-staff-administrative-profile[data-window-id="${CSS.escape(windowId)}"]`,
  )
  const currentSection = windowElement?.querySelector('[data-staff-governance-section]')
  if (!context || !currentSection) return

  const template = document.createElement('template')
  template.innerHTML = renderStaffAdministrativeGovernanceSection({
    windowId,
    access: context.access,
    staffMember: context.staffMember,
    profile: context.lookup.profile,
    auditEvents: staffAdministrativeAuditEvents,
    policy: staffAdministrativeRetentionPolicy,
    deletionRequests: staffAdministrativeDeletionRequests,
    state: context.state,
    storageHealthy: context.storageContext.ok,
  }).trim()
  currentSection.replaceWith(template.content.firstElementChild)
}

function refreshStaffAdministrativeAuditResultsRegion(windowId) {
  const context = getStaffAdministrativeGovernanceWindowContext(windowId, {
    action: 'privacy-audit.view',
  })
  const windowElement = document.querySelector(
    `.desktop-window.is-staff-administrative-profile[data-window-id="${CSS.escape(windowId)}"]`,
  )
  const currentResults = windowElement?.querySelector('[data-staff-governance-audit-results]')
  if (!context || !currentResults) return
  currentResults.innerHTML = renderStaffAdministrativeAuditResults(
    getScopedStaffAdministrativeAuditEvents(context),
    context.state.auditFilters,
    context.state.auditLimit,
  )
}

function setStaffAdministrativeGovernanceMessage(windowId, message) {
  const state = getStaffAdministrativeGovernanceWindowState(windowId)
  if (!state) return
  setStaffAdministrativeGovernanceWindowState(windowId, {
    ...state,
    mode: 'view',
    selectedRequestId: '',
    expectedRevision: null,
    expectedUpdatedAt: '',
    values: null,
    errors: {},
    message,
    isSaving: false,
  })
  savingStaffAdministrativeGovernanceWindowIds.delete(windowId)
  refreshStaffAdministrativeGovernanceSection(windowId)
}

function updateStaffAdministrativeAuditFilter(windowId, filterName, value) {
  const context = getStaffAdministrativeGovernanceWindowContext(windowId, {
    action: 'privacy-audit.view',
  })
  if (!context || !Object.hasOwn(initialStaffAdministrativeAuditFilters, filterName)) return
  setStaffAdministrativeGovernanceWindowState(windowId, {
    ...context.state,
    auditFilters: { ...context.state.auditFilters, [filterName]: value },
    auditLimit: 25,
  })
  refreshStaffAdministrativeAuditResultsRegion(windowId)
}

function loadMoreStaffAdministrativeAudit(windowId) {
  const context = getStaffAdministrativeGovernanceWindowContext(windowId, {
    action: 'privacy-audit.view',
  })
  if (!context) return
  setStaffAdministrativeGovernanceWindowState(windowId, {
    ...context.state,
    auditLimit: Math.min(100, (Number(context.state.auditLimit) || 25) + 25),
  })
  refreshStaffAdministrativeAuditResultsRegion(windowId)
}

function openStaffAdministrativeRetentionPolicyForm(windowId) {
  const context = getStaffAdministrativeGovernanceWindowContext(windowId, {
    refresh: true,
    action: 'retention-policy.manage',
  })
  if (!context || !context.storageContext.ok) {
    setStaffAdministrativeGovernanceMessage(
      windowId,
      'Không thể mở chính sách từ dữ liệu hoặc quyền hiện tại.',
    )
    return
  }
  setStaffAdministrativeGovernanceWindowState(windowId, {
    ...context.state,
    mode: 'policy-form',
    selectedRequestId: '',
    expectedRevision: staffAdministrativeRetentionPolicy?.revision ?? null,
    expectedUpdatedAt: staffAdministrativeRetentionPolicy?.updatedAt || '',
    values: createStaffAdministrativeRetentionPolicyDraft(
      staffAdministrativeRetentionPolicy,
    ),
    errors: {},
    message: '',
    isSaving: false,
  })
  refreshStaffAdministrativeGovernanceSection(windowId)
}

function openStaffAdministrativeDeletionRequestForm(windowId) {
  const context = getStaffAdministrativeGovernanceWindowContext(windowId, {
    refresh: true,
    action: 'deletion-request.create',
  })
  if (!context || !context.storageContext.ok) {
    setStaffAdministrativeGovernanceMessage(
      windowId,
      'Không thể tạo yêu cầu từ dữ liệu hoặc quyền hiện tại.',
    )
    return
  }
  setStaffAdministrativeGovernanceWindowState(windowId, {
    ...context.state,
    mode: 'request-form',
    selectedRequestId: '',
    expectedRevision: null,
    expectedUpdatedAt: '',
    values: createStaffAdministrativeDeletionRequestDraft(),
    errors: {},
    message: '',
    isSaving: false,
  })
  refreshStaffAdministrativeGovernanceSection(windowId)
}

function cancelStaffAdministrativeGovernanceForm(windowId) {
  const context = getStaffAdministrativeGovernanceWindowContext(windowId, {
    action: 'privacy-audit.view',
  })
  if (!context || context.state.isSaving) return
  setStaffAdministrativeGovernanceWindowState(windowId, {
    ...context.state,
    mode: 'view',
    selectedRequestId: '',
    expectedRevision: null,
    expectedUpdatedAt: '',
    values: null,
    errors: {},
    message: '',
  })
  refreshStaffAdministrativeGovernanceSection(windowId)
}

function updateStaffAdministrativeGovernanceDraftField(windowId, field, value) {
  const state = getStaffAdministrativeGovernanceWindowState(windowId)
  if (!state || state.isSaving) return
  if (state.mode === 'policy-form') {
    setStaffAdministrativeGovernanceWindowState(windowId, {
      ...state,
      values: setStaffAdministrativeRetentionPolicyDraftValue(state.values, field, value),
    })
    return
  }
  if (state.mode === 'request-form') {
    setStaffAdministrativeGovernanceWindowState(windowId, {
      ...state,
      values: setStaffAdministrativeDeletionRequestDraftValue(state.values, field, value),
    })
    return
  }
  if (state.mode === 'deny-form' && field === 'reviewNote') {
    setStaffAdministrativeGovernanceWindowState(windowId, {
      ...state,
      values: { ...state.values, reviewNote: String(value ?? '') },
    })
  }
}

function collectStaffAdministrativeGovernanceForbiddenValues(profile, documents) {
  const values = []
  const seen = new Set()
  const visit = (value) => {
    if (value === null || value === undefined) return
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim()
      if (text) values.push(text)
      return
    }
    if (typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    Object.entries(value).forEach(([key, child]) => {
      if (!['__normalizationIssues'].includes(key)) visit(child)
    })
  }
  visit(profile)
  visit(documents)
  return values
}

async function handleStaffAdministrativeRetentionPolicySubmit(windowId) {
  const capturedState = getStaffAdministrativeGovernanceWindowState(windowId)
  if (
    !capturedState ||
    capturedState.mode !== 'policy-form' ||
    capturedState.isSaving ||
    savingStaffAdministrativeGovernanceWindowIds.has(windowId)
  ) return
  const errors = validateStaffAdministrativeRetentionPolicy(capturedState.values)
  if (Object.keys(errors).length) {
    setStaffAdministrativeGovernanceWindowState(windowId, {
      ...capturedState,
      errors,
      message: 'Vui lòng kiểm tra chính sách lưu trữ.',
    })
    refreshStaffAdministrativeGovernanceSection(windowId)
    return
  }

  savingStaffAdministrativeGovernanceWindowIds.add(windowId)
  setStaffAdministrativeGovernanceWindowState(windowId, {
    ...capturedState,
    errors: {},
    message: '',
    isSaving: true,
  })
  refreshStaffAdministrativeGovernanceSection(windowId)
  const access = await getLatestStaffAdministrativeProfileAccessContext(
    capturedState.centerId,
    'retention-policy.manage',
  )
  const latestState = getStaffAdministrativeGovernanceWindowState(windowId)
  if (
    !access.ok ||
    !latestState ||
    latestState.mode !== 'policy-form' ||
    latestState.centerId !== capturedState.centerId ||
    getCurrentStorageCenterId() !== capturedState.centerId
  ) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  refreshStaffDataFromStorage()
  if (!getStaffAdministrativeGovernanceStorageContext(capturedState.centerId).ok) {
    setStaffAdministrativeGovernanceMessage(windowId, 'Dữ liệu quản trị cần kiểm tra. Không ghi đè storage hiện tại.')
    return
  }
  const latestPolicy = staffAdministrativeRetentionPolicy
  const stale = capturedState.expectedRevision === null
    ? Boolean(latestPolicy)
    : !latestPolicy ||
      latestPolicy.revision !== capturedState.expectedRevision ||
      latestPolicy.updatedAt !== capturedState.expectedUpdatedAt
  if (stale) {
    setStaffAdministrativeGovernanceMessage(windowId, STAFF_ADMINISTRATIVE_POLICY_STALE_MESSAGE)
    return
  }
  const policyId = latestPolicy?.id || createStaffAdministrativeRetentionPolicyId()
  const savedPolicy = buildStaffAdministrativeRetentionPolicy(
    capturedState.values,
    latestPolicy,
    { centerId: capturedState.centerId, policyId },
  )
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('retention_policy', {
      ...savedPolicy,
      staffMemberId: capturedState.staffMemberId,
      administrativeProfileId: capturedState.administrativeProfileId,
    }),
    { reason: latestPolicy ? 'retention-policy-update' : 'retention-policy-create' },
  )
  if (!committed.ok) {
    setStaffAdministrativeGovernanceMessage(
      windowId,
      committed.error || 'Không commit được chính sách lưu trữ.',
    )
    return
  }
  setStaffAdministrativeGovernanceMessage(
    windowId,
    'Đã commit chính sách lưu trữ và tải lại authoritative projection.',
  )
}

async function handleStaffAdministrativeDeletionRequestSubmit(windowId) {
  const capturedState = getStaffAdministrativeGovernanceWindowState(windowId)
  if (
    !capturedState ||
    capturedState.mode !== 'request-form' ||
    capturedState.isSaving ||
    savingStaffAdministrativeGovernanceWindowIds.has(windowId)
  ) return
  const initialContext = getStaffAdministrativeGovernanceWindowContext(windowId, {
    action: 'deletion-request.create',
  })
  if (!initialContext) return
  const profileDocuments = getStaffDocumentsForProfile(
    initialContext.lookup.profile,
    initialContext.staffMember,
    capturedState.centerId,
  )
  const forbiddenValues = collectStaffAdministrativeGovernanceForbiddenValues(
    initialContext.lookup.profile,
    profileDocuments,
  )
  const errors = validateStaffAdministrativeDeletionRequest(capturedState.values, {
    forbiddenValues,
  })
  if (Object.keys(errors).length) {
    setStaffAdministrativeGovernanceWindowState(windowId, {
      ...capturedState,
      errors,
      message: 'Vui lòng kiểm tra yêu cầu xóa dữ liệu.',
    })
    refreshStaffAdministrativeGovernanceSection(windowId)
    return
  }

  savingStaffAdministrativeGovernanceWindowIds.add(windowId)
  setStaffAdministrativeGovernanceWindowState(windowId, {
    ...capturedState,
    errors: {},
    message: '',
    isSaving: true,
  })
  refreshStaffAdministrativeGovernanceSection(windowId)
  const access = await getLatestStaffAdministrativeProfileAccessContext(
    capturedState.centerId,
    'deletion-request.create',
  )
  const latestState = getStaffAdministrativeGovernanceWindowState(windowId)
  if (
    !access.ok ||
    !latestState ||
    latestState.mode !== 'request-form' ||
    latestState.staffMemberId !== capturedState.staffMemberId ||
    getCurrentStorageCenterId() !== capturedState.centerId
  ) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  refreshStaffDataFromStorage()
  const latestContext = getStaffAdministrativeGovernanceWindowContext(windowId, {
    action: 'deletion-request.create',
  })
  if (!latestContext?.storageContext.ok) {
    setStaffAdministrativeGovernanceMessage(windowId, 'Dữ liệu quản trị cần kiểm tra. Không ghi đè storage hiện tại.')
    return
  }
  const activeRequestExists = staffAdministrativeDeletionRequests.some(
    (request) =>
      request.centerId === capturedState.centerId &&
      request.staffMemberId === capturedState.staffMemberId &&
      request.administrativeProfileId === capturedState.administrativeProfileId &&
      ['pending-review', 'execution-pending'].includes(request.status),
  )
  if (activeRequestExists) {
    setStaffAdministrativeGovernanceMessage(
      windowId,
      'Đã có yêu cầu đang chờ xử lý cho hồ sơ này.',
    )
    return
  }
  const requestId = createStaffAdministrativeDeletionRequestId()
  if (staffAdministrativeDeletionRequests.some((request) => request.id === requestId)) {
    setStaffAdministrativeGovernanceMessage(windowId, 'Không thể tạo stable request ID duy nhất.')
    return
  }
  const request = buildStaffAdministrativeDeletionRequest(capturedState.values, {
    id: requestId,
    centerId: capturedState.centerId,
    ['staffMemberId']: capturedState.staffMemberId,
    administrativeProfileId: capturedState.administrativeProfileId,
    actor: access,
  })
  const nextRequests = [request, ...staffAdministrativeDeletionRequests]
  if (
    getStaffAdministrativeDeletionRequestCollectionIssues(
      nextRequests,
      capturedState.centerId,
    ).length
  ) {
    setStaffAdministrativeGovernanceMessage(windowId, 'Không thể lưu yêu cầu từ collection hiện tại.')
    return
  }
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('deletion_request', request, { operation: 'CREATE' }),
    { reason: 'deletion-request-create' },
  )
  if (!committed.ok) {
    setStaffAdministrativeGovernanceMessage(
      windowId,
      committed.error || 'Không commit được yêu cầu xóa dữ liệu.',
    )
    return
  }
  setStaffAdministrativeGovernanceMessage(
    windowId,
    'Đã commit yêu cầu xóa dữ liệu để Owner khác xem xét.',
  )
}

async function cancelStaffAdministrativeDeletionRequestById(windowId, requestId) {
  const context = getStaffAdministrativeGovernanceWindowContext(windowId, {
    refresh: true,
    action: 'deletion-request.cancel',
  })
  const matches = staffAdministrativeDeletionRequests.filter((request) => request.id === requestId)
  const capturedRequest = matches.length === 1 ? matches[0] : null
  if (
    !context?.storageContext.ok ||
    !capturedRequest ||
    capturedRequest.staffMemberId !== context.staffMember.id ||
    savingStaffAdministrativeGovernanceWindowIds.has(windowId)
  ) return
  if (!window.confirm('Hủy yêu cầu xóa dữ liệu này? Dữ liệu hồ sơ và tài liệu vẫn được giữ nguyên.')) return

  savingStaffAdministrativeGovernanceWindowIds.add(windowId)
  setStaffAdministrativeGovernanceWindowState(windowId, {
    ...context.state,
    isSaving: true,
    message: '',
  })
  refreshStaffAdministrativeGovernanceSection(windowId)
  const access = await getLatestStaffAdministrativeProfileAccessContext(
    context.state.centerId,
    'deletion-request.cancel',
  )
  if (!access.ok || getCurrentStorageCenterId() !== context.state.centerId) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  refreshStaffDataFromStorage()
  if (!getStaffAdministrativeGovernanceStorageContext(context.state.centerId).ok) {
    setStaffAdministrativeGovernanceMessage(windowId, 'Dữ liệu quản trị cần kiểm tra. Không ghi đè storage hiện tại.')
    return
  }
  const latestMatches = staffAdministrativeDeletionRequests.filter(
    (request) => request.id === requestId,
  )
  const latestRequest = latestMatches.length === 1 ? latestMatches[0] : null
  if (
    !latestRequest ||
    latestRequest.revision !== capturedRequest.revision ||
    latestRequest.updatedAt !== capturedRequest.updatedAt
  ) {
    setStaffAdministrativeGovernanceMessage(windowId, STAFF_ADMINISTRATIVE_REQUEST_STALE_MESSAGE)
    return
  }
  const cancelledRequest = cancelStaffAdministrativeDeletionRequest(latestRequest, access)
  if (!cancelledRequest) {
    setStaffAdministrativeGovernanceMessage(windowId, 'Không thể hủy yêu cầu từ quyền hoặc trạng thái hiện tại.')
    return
  }
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('deletion_request', cancelledRequest, {
      operation: 'CANCEL',
    }),
    { reason: 'deletion-request-cancel' },
  )
  if (!committed.ok) {
    setStaffAdministrativeGovernanceMessage(
      windowId,
      committed.error || 'Không commit được trạng thái hủy yêu cầu.',
    )
    return
  }
  setStaffAdministrativeGovernanceMessage(
    windowId,
    'Đã commit hủy yêu cầu xóa dữ liệu.',
  )
}

function openStaffAdministrativeDenyRequestForm(windowId, requestId) {
  const context = getStaffAdministrativeGovernanceWindowContext(windowId, {
    refresh: true,
    action: 'deletion-request.deny',
  })
  const matches = staffAdministrativeDeletionRequests.filter((request) => request.id === requestId)
  const request = matches.length === 1 ? matches[0] : null
  if (
    !context?.storageContext.ok ||
    !request ||
    request.status !== 'pending-review' ||
    request.staffMemberId !== context.staffMember.id
  ) return
  setStaffAdministrativeGovernanceWindowState(windowId, {
    ...context.state,
    mode: 'deny-form',
    selectedRequestId: request.id,
    expectedRevision: request.revision,
    expectedUpdatedAt: request.updatedAt,
    values: { reviewNote: '' },
    errors: {},
    message: '',
    isSaving: false,
  })
  refreshStaffAdministrativeGovernanceSection(windowId)
}

async function reviewStaffAdministrativeDeletionRequestById(
  windowId,
  requestId,
  decision,
  reviewNote = '',
) {
  const action = decision === 'approve' ? 'deletion-request.approve' : 'deletion-request.deny'
  const context = getStaffAdministrativeGovernanceWindowContext(windowId, {
    refresh: true,
    action,
  })
  const matches = staffAdministrativeDeletionRequests.filter((request) => request.id === requestId)
  const capturedRequest = matches.length === 1 ? matches[0] : null
  if (
    !context?.storageContext.ok ||
    !capturedRequest ||
    capturedRequest.status !== 'pending-review' ||
    capturedRequest.staffMemberId !== context.staffMember.id ||
    savingStaffAdministrativeGovernanceWindowIds.has(windowId)
  ) return
  if (
    context.state.mode === 'deny-form' &&
    (
      capturedRequest.revision !== context.state.expectedRevision ||
      capturedRequest.updatedAt !== context.state.expectedUpdatedAt ||
      capturedRequest.id !== context.state.selectedRequestId
    )
  ) {
    setStaffAdministrativeGovernanceMessage(windowId, STAFF_ADMINISTRATIVE_REQUEST_STALE_MESSAGE)
    return
  }
  const profileDocuments = getStaffDocumentsForProfile(
    context.lookup.profile,
    context.staffMember,
    context.state.centerId,
  )
  const forbiddenValues = collectStaffAdministrativeGovernanceForbiddenValues(
    context.lookup.profile,
    profileDocuments,
  )
  const normalizedReviewNote = String(reviewNote ?? '').trim()
  if (
    normalizedReviewNote.length > 500 ||
    forbiddenValues
      .filter((value) => value.length >= 4)
      .some((value) => normalizedReviewNote.toLocaleLowerCase('vi').includes(value.toLocaleLowerCase('vi')))
  ) {
    setStaffAdministrativeGovernanceWindowState(windowId, {
      ...context.state,
      errors: { reviewNote: 'Ghi chú không hợp lệ hoặc chứa dữ liệu hồ sơ/tài liệu thô.' },
      message: 'Vui lòng kiểm tra ghi chú xem xét.',
    })
    refreshStaffAdministrativeGovernanceSection(windowId)
    return
  }
  if (
    decision === 'approve' &&
    !window.confirm('Phê duyệt yêu cầu? Trạng thái sẽ chuyển sang “Chờ thực thi backend”; không xóa dữ liệu ngay.')
  ) return

  savingStaffAdministrativeGovernanceWindowIds.add(windowId)
  setStaffAdministrativeGovernanceWindowState(windowId, {
    ...context.state,
    isSaving: true,
    message: '',
  })
  refreshStaffAdministrativeGovernanceSection(windowId)
  const access = await getLatestStaffAdministrativeProfileAccessContext(
    context.state.centerId,
    action,
  )
  if (!access.ok || getCurrentStorageCenterId() !== context.state.centerId) {
    denyStaffAdministrativeProfileWindow(windowId)
    return
  }
  refreshStaffDataFromStorage()
  if (!getStaffAdministrativeGovernanceStorageContext(context.state.centerId).ok) {
    setStaffAdministrativeGovernanceMessage(windowId, 'Dữ liệu quản trị cần kiểm tra. Không ghi đè storage hiện tại.')
    return
  }
  const latestMatches = staffAdministrativeDeletionRequests.filter(
    (request) => request.id === requestId,
  )
  const latestRequest = latestMatches.length === 1 ? latestMatches[0] : null
  if (
    !latestRequest ||
    latestRequest.revision !== capturedRequest.revision ||
    latestRequest.updatedAt !== capturedRequest.updatedAt
  ) {
    setStaffAdministrativeGovernanceMessage(windowId, STAFF_ADMINISTRATIVE_REQUEST_STALE_MESSAGE)
    return
  }
  if (
    decision === 'approve' &&
    (!staffAdministrativeRetentionPolicy || !staffAdministrativeRetentionPolicy.enabled)
  ) {
    setStaffAdministrativeGovernanceMessage(
      windowId,
      'Chưa thiết lập chính sách lưu trữ. Không thể phê duyệt yêu cầu.',
    )
    return
  }
  const result = reviewStaffAdministrativeDeletionRequest(latestRequest, access, decision, {
    reviewNote: normalizedReviewNote,
    deletionReviewGraceDays: staffAdministrativeRetentionPolicy?.deletionReviewGraceDays || 0,
  })
  if (!result.ok) {
    setStaffAdministrativeGovernanceMessage(windowId, result.error)
    return
  }
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('deletion_request', {
      ...result.request,
      reviewDecision: decision,
      reviewNote: normalizedReviewNote,
    }, { operation: 'REVIEW' }),
    { reason: decision === 'approve' ? 'deletion-request-approve' : 'deletion-request-deny' },
  )
  if (!committed.ok) {
    setStaffAdministrativeGovernanceMessage(
      windowId,
      committed.error || 'Không commit được quyết định yêu cầu xóa.',
    )
    return
  }
  setStaffAdministrativeGovernanceMessage(
    windowId,
    decision === 'approve'
      ? 'Đã commit phê duyệt; chờ executor backend, chưa xóa dữ liệu.'
      : 'Đã commit từ chối yêu cầu xóa dữ liệu.',
  )
}

async function handleStaffAdministrativeDenyRequestSubmit(windowId) {
  const state = getStaffAdministrativeGovernanceWindowState(windowId)
  if (!state || state.mode !== 'deny-form' || state.isSaving || !state.selectedRequestId) return
  await reviewStaffAdministrativeDeletionRequestById(
    windowId,
    state.selectedRequestId,
    'deny',
    state.values?.reviewNote || '',
  )
}

function focusFirstStaffAdministrativeProfileError(windowId) {
  const windowElement = document.querySelector(`[data-window-id="${CSS.escape(windowId)}"]`)
  const error = windowElement?.querySelector('.staff-administrative-field-error')
  const field = error?.closest('label')?.querySelector('[data-staff-administrative-field]')
  const scrollElement = windowElement?.querySelector('.staff-administrative-content-scroll')
  if (!field || !scrollElement) return

  const fieldRect = field.getBoundingClientRect()
  const scrollRect = scrollElement.getBoundingClientRect()
  scrollElement.scrollTop += fieldRect.top - scrollRect.top - 72
  field.focus({ preventScroll: true })
}

function ensureStaffAccountDirectoryLoading() {
  const context = getStaffAccountCenterContext()

  if (!context.ok) {
    if (staffAccountDirectoryState.status !== 'error' || staffAccountDirectoryState.error !== context.error) {
      staffAccountDirectoryState = createStaffAccountDirectoryState({
        status: 'error',
        error: context.error,
      })
    }
    return
  }

  if (
    staffAccountDirectoryState.centerId === context.centerId &&
    ['loading', 'loaded'].includes(staffAccountDirectoryState.status)
  ) {
    return
  }

  void refreshStaffAccountDirectory({ showLoading: false })
}

async function refreshStaffAccountDirectory({ showLoading = true } = {}) {
  const context = getStaffAccountCenterContext()

  if (!context.ok) {
    staffAccountDirectoryState = createStaffAccountDirectoryState({
      status: 'error',
      error: context.error,
    })
    if (showLoading) {
      render()
    }
    return { ok: false, data: [], error: context.error }
  }

  const runId = ++staffAccountDirectoryRunId
  staffAccountDirectoryState = createStaffAccountDirectoryState({
    status: 'loading',
    centerId: context.centerId,
    centerName: context.centerName,
    memberships: staffAccountDirectoryState.centerId === context.centerId
      ? staffAccountDirectoryState.memberships
      : [],
  })

  if (showLoading) {
    render()
  }

  const result = await listCenterAccountMemberships({ centerId: context.centerId })
  const latestContext = getStaffAccountCenterContext()

  if (
    runId !== staffAccountDirectoryRunId ||
    !latestContext.ok ||
    latestContext.centerId !== context.centerId
  ) {
    return { ok: false, data: [], error: 'Cơ sở đã thay đổi khi đang tải membership.' }
  }

  if (!result.ok) {
    staffAccountDirectoryState = createStaffAccountDirectoryState({
      status: 'error',
      centerId: context.centerId,
      centerName: context.centerName,
      error: result.error || 'Không đọc được account/membership của cơ sở hiện tại.',
    })
    render()
    return { ok: false, data: [], error: staffAccountDirectoryState.error }
  }

  staffAccountDirectoryState = createStaffAccountDirectoryState({
    status: 'loaded',
    centerId: context.centerId,
    centerName: context.centerName,
    memberships: result.data,
  })
  render()
  return { ok: true, data: result.data, error: '' }
}

function openCreateStaffForm() {
  const nextState = createEmptyStaffFormState()
  nextState.centerId = getStaffCurrentCenterId()
  staffFormState = nextState
  staffNotice = ''
  render()
}

function openEditStaffForm(staffId) {
  refreshStaffDataFromStorage()
  const staffMember = staffMembers.find((item) => item.id === staffId)

  if (!staffMember) {
    staffNotice = 'Không tìm thấy hồ sơ nhân viên mới nhất.'
    render()
    return
  }

  staffFormState = createEditStaffFormState(staffMember)
  staffNotice = ''
  render()
}

function closeStaffForm() {
  staffFormState = null
  isStaffSaving = false
  render()
}

async function openStaffAccountLinkModal(staffId) {
  if (isStaffAccountLinkSaving) {
    return
  }

  refreshStaffDataFromStorage()
  const matchingStaff = staffMembers.filter((item) => item.id === staffId)
  const staffMember = matchingStaff.length === 1 ? matchingStaff[0] : null
  const context = getStaffAccountCenterContext()

  if (!staffMember || matchingStaff.length !== 1) {
    staffNotice = 'Không tìm thấy duy nhất một hồ sơ nhân viên mới nhất.'
    render()
    return
  }

  if (!context.ok) {
    staffNotice = context.error
    render()
    return
  }

  if (staffMember.centerId && staffMember.centerId !== context.centerId) {
    staffNotice = 'Hồ sơ nhân viên thuộc cơ sở khác. Không thể liên kết tài khoản.'
    render()
    return
  }

  if (isStaffMemberArchived(staffMember)) {
    staffNotice = 'Hồ sơ đã lưu trữ không nhận liên kết tài khoản mới.'
    render()
    return
  }

  if (staffMember.accountUserId || staffMember.membershipId) {
    staffNotice = 'Hồ sơ nhân viên đã có reference tài khoản. Vui lòng kiểm tra liên kết hiện tại.'
    render()
    return
  }

  staffAccountLinkState = createStaffAccountLinkState(staffMember.id, context.centerId)
  staffNotice = ''
  render()
  await refreshStaffAccountDirectory()
}

function closeStaffAccountLinkModal() {
  if (isStaffAccountLinkSaving) {
    return
  }

  staffAccountLinkState = null
  render()
}

function updateStaffAccountLinkSearch(value) {
  if (!staffAccountLinkState) {
    return
  }

  staffAccountLinkState = {
    ...staffAccountLinkState,
    query: value,
  }

  const normalizedQuery = normalizeStaffAccountSearchText(value)
  document.querySelectorAll('[data-staff-account-option]').forEach((option) => {
    option.hidden = Boolean(
      normalizedQuery &&
      !String(option.dataset.accountSearchText || '').includes(normalizedQuery),
    )
  })
}

async function prepareStaffAccountLinkConfirmation(membershipId) {
  if (!staffAccountLinkState || isStaffAccountLinkSaving) {
    return
  }

  const expectedStaffId = staffAccountLinkState.staffId
  const expectedCenterId = staffAccountLinkState.centerId
  staffAccountLinkState = {
    ...staffAccountLinkState,
    message: '',
    isSaving: true,
  }
  isStaffAccountLinkSaving = true
  render()

  const directoryResult = await refreshStaffAccountDirectory()
  isStaffAccountLinkSaving = false

  if (
    !staffAccountLinkState ||
    staffAccountLinkState.staffId !== expectedStaffId ||
    staffAccountLinkState.centerId !== expectedCenterId
  ) {
    return
  }

  if (!directoryResult.ok) {
    staffAccountLinkState = {
      ...staffAccountLinkState,
      isSaving: false,
      message: directoryResult.error,
    }
    render()
    return
  }

  refreshStaffDataFromStorage()
  const availability = getAvailableStaffAccountMemberships({
    memberships: directoryResult.data,
    staffMembers,
    currentStaffId: expectedStaffId,
    currentCenterId: expectedCenterId,
  })
  const membership = availability.active.find((item) => item.id === membershipId)

  if (!membership || availability.hasMalformedDuplicate) {
    staffAccountLinkState = {
      ...staffAccountLinkState,
      isSaving: false,
      message: availability.hasMalformedDuplicate
        ? 'Liên kết tài khoản cần kiểm tra: dữ liệu hiện có đang trùng one-to-one.'
        : 'Membership không còn khả dụng để liên kết. Danh sách đã được cập nhật.',
    }
    render()
    return
  }

  staffAccountLinkState = {
    ...staffAccountLinkState,
    selectedMembershipId: membership.id,
    selectedAccountUserId: membership.accountUserId,
    selectedRole: membership.role,
    selectedStatus: membership.status,
    isSaving: false,
    message: '',
  }
  render()
}

function cancelStaffAccountLinkConfirmation() {
  if (!staffAccountLinkState || isStaffAccountLinkSaving) {
    return
  }

  staffAccountLinkState = {
    ...staffAccountLinkState,
    selectedMembershipId: '',
    selectedAccountUserId: '',
    selectedRole: '',
    selectedStatus: '',
    message: '',
  }
  render()
}

async function handleConfirmStaffAccountLink() {
  if (
    !staffAccountLinkState ||
    !staffAccountLinkState.selectedMembershipId ||
    isStaffAccountLinkSaving
  ) {
    return
  }

  const expectedStaffId = staffAccountLinkState.staffId
  const expectedCenterId = staffAccountLinkState.centerId
  const expectedMembershipId = staffAccountLinkState.selectedMembershipId
  const expectedAccountUserId = staffAccountLinkState.selectedAccountUserId
  const expectedRole = staffAccountLinkState.selectedRole
  const expectedStatus = staffAccountLinkState.selectedStatus
  const context = getStaffAccountCenterContext()

  if (!context.ok || context.centerId !== expectedCenterId) {
    staffAccountLinkState = {
      ...staffAccountLinkState,
      message: context.error || 'Cơ sở đã thay đổi. Vui lòng mở lại modal liên kết.',
    }
    render()
    return
  }

  isStaffAccountLinkSaving = true
  staffAccountLinkState = {
    ...staffAccountLinkState,
    isSaving: true,
    message: '',
  }
  render()

  const directoryResult = await listCenterAccountMemberships({ centerId: expectedCenterId })
  const latestContext = getStaffAccountCenterContext()

  if (
    !latestContext.ok ||
    latestContext.centerId !== expectedCenterId ||
    !staffAccountLinkState ||
    staffAccountLinkState.staffId !== expectedStaffId
  ) {
    finishStaffAccountLinkError('Cơ sở đã thay đổi. Không có dữ liệu nào được lưu.')
    return
  }

  if (!directoryResult.ok) {
    finishStaffAccountLinkError(directoryResult.error || 'Không đọc được membership mới nhất.')
    return
  }

  staffAccountDirectoryState = createStaffAccountDirectoryState({
    status: 'loaded',
    centerId: expectedCenterId,
    centerName: latestContext.centerName,
    memberships: directoryResult.data,
  })

  refreshStaffDataFromStorage()
  const staffMatches = staffMembers.filter((item) => item.id === expectedStaffId)
  const staffMember = staffMatches.length === 1 ? staffMatches[0] : null

  if (!staffMember || staffMatches.length !== 1) {
    finishStaffAccountLinkError('Hồ sơ nhân viên đã thay đổi hoặc không còn duy nhất. Vui lòng mở lại.')
    return
  }

  if (staffMember.centerId && staffMember.centerId !== expectedCenterId) {
    finishStaffAccountLinkError('Hồ sơ nhân viên thuộc cơ sở khác. Không thể lưu chéo cơ sở.')
    return
  }

  if (isStaffMemberArchived(staffMember)) {
    finishStaffAccountLinkError('Hồ sơ đã được lưu trữ nên không thể nhận liên kết tài khoản mới.')
    return
  }

  if (staffMember.accountUserId || staffMember.membershipId) {
    const existingLink = resolveStaffAccountLink({
      staffMember,
      staffMembers,
      memberships: directoryResult.data,
      currentCenterId: expectedCenterId,
    })
    if (existingLink.membership?.id === expectedMembershipId && existingLink.status !== 'malformed') {
      staffAccountDirectoryState = createStaffAccountDirectoryState({
        status: 'loaded',
        centerId: expectedCenterId,
        centerName: latestContext.centerName,
        memberships: directoryResult.data,
      })
      staffAccountLinkState = null
      isStaffAccountLinkSaving = false
      staffNotice = 'Tài khoản đã được liên kết với hồ sơ nhân viên này.'
      syncStaffFormAccountLinkState(staffMember)
      render()
      return
    }

    finishStaffAccountLinkError('Hồ sơ nhân viên đã được liên kết với một tài khoản khác.')
    return
  }

  const membershipMatches = directoryResult.data.filter(
    (membership) => membership.id === expectedMembershipId,
  )
  const membership = membershipMatches.length === 1 ? membershipMatches[0] : null

  if (!membership || membershipMatches.length !== 1) {
    finishStaffAccountLinkError('Membership đã thay đổi hoặc không còn duy nhất.')
    return
  }

  if (
    membership.accountUserId !== expectedAccountUserId ||
    membership.role !== expectedRole ||
    membership.status !== expectedStatus
  ) {
    isStaffAccountLinkSaving = false
    staffAccountLinkState = {
      ...staffAccountLinkState,
      selectedAccountUserId: membership.accountUserId,
      selectedRole: membership.role,
      selectedStatus: membership.status,
      isSaving: false,
      message: 'Membership đã đổi account, quyền hoặc trạng thái. Dữ liệu mới nhất đã được hiển thị; vui lòng xác nhận lại.',
    }
    render()
    return
  }

  if (
    !membership.accountUserId ||
    membership.centerId !== expectedCenterId ||
    !isAccountMembershipActive(membership)
  ) {
    finishStaffAccountLinkError(
      isAccountMembershipActive(membership)
        ? 'Membership không hợp lệ hoặc thuộc cơ sở khác.'
        : 'Membership hiện không hoạt động.',
    )
    return
  }

  const availability = getAvailableStaffAccountMemberships({
    memberships: directoryResult.data,
    staffMembers,
    currentStaffId: expectedStaffId,
    currentCenterId: expectedCenterId,
  })
  const latestAvailableMembership = availability.active.find(
    (item) => item.id === expectedMembershipId,
  )

  if (availability.hasMalformedDuplicate) {
    finishStaffAccountLinkError('Liên kết tài khoản cần kiểm tra: dữ liệu one-to-one hiện có đang bị trùng.')
    return
  }

  if (!latestAvailableMembership) {
    const membershipLookup = findStaffMemberByMembershipId(
      staffMembers,
      membership.id,
      expectedCenterId,
    )
    const accountLookup = findStaffMemberByAccountUserId(
      staffMembers,
      membership.accountUserId,
      expectedCenterId,
    )
    const linkedElsewhere = [...membershipLookup.matches, ...accountLookup.matches].some(
      (item) => item.id !== expectedStaffId,
    )
    finishStaffAccountLinkError(
      linkedElsewhere
        ? 'Tài khoản đã được liên kết với một hồ sơ nhân viên khác.'
        : 'Membership không còn khả dụng để liên kết.',
    )
    return
  }

  const linkedAt = new Date().toISOString()
  const savedStaffMember = linkStaffMemberToAccount(
    staffMember,
    latestAvailableMembership,
    linkedAt,
  )
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('staff_member', savedStaffMember),
    { reason: 'staff-account-link' },
  )
  if (!committed.ok) {
    finishStaffAccountLinkError(committed.error || 'Không commit được liên kết tài khoản.')
    return
  }
  staffAccountDirectoryState = createStaffAccountDirectoryState({
    status: 'loaded',
    centerId: expectedCenterId,
    centerName: latestContext.centerName,
    memberships: directoryResult.data,
  })
  staffAccountLinkState = null
  isStaffAccountLinkSaving = false
  staffNotice = 'Đã commit liên kết reference tài khoản; Auth/membership không bị thay đổi.'
  syncStaffFormAccountLinkState(
    staffMembers.find((item) => item.id === savedStaffMember.id) || savedStaffMember,
  )
  render()
}

function finishStaffAccountLinkError(message) {
  isStaffAccountLinkSaving = false
  if (staffAccountLinkState) {
    staffAccountLinkState = {
      ...staffAccountLinkState,
      isSaving: false,
      message,
    }
  } else {
    staffNotice = message
  }
  render()
}

function syncStaffFormAccountLinkState(staffMember) {
  if (!staffFormState || staffFormState.staffId !== staffMember?.id) {
    return
  }

  staffFormState = {
    ...staffFormState,
    links: {
      ...staffFormState.links,
      hasAccountLink: Boolean(staffMember.accountUserId && staffMember.membershipId),
    },
  }
}

async function handleUnlinkStaffAccount(staffId) {
  if (isStaffAccountLinkSaving) {
    return
  }

  const context = getStaffAccountCenterContext()
  refreshStaffDataFromStorage()
  const initialMatches = staffMembers.filter((item) => item.id === staffId)
  const initialStaffMember = initialMatches.length === 1 ? initialMatches[0] : null

  if (!context.ok || !initialStaffMember || initialMatches.length !== 1) {
    staffNotice = context.error || 'Không tìm thấy duy nhất một hồ sơ nhân viên mới nhất.'
    render()
    return
  }

  const expectedAccountUserId = String(initialStaffMember.accountUserId || '').trim()
  const expectedMembershipId = String(initialStaffMember.membershipId || '').trim()
  if (!expectedAccountUserId || !expectedMembershipId) {
    staffNotice = 'Liên kết tài khoản cần kiểm tra trước khi gỡ.'
    render()
    return
  }

  const confirmed = window.confirm(
    'Gỡ liên kết tài khoản khỏi hồ sơ nhân viên này? Hồ sơ Nhân viên, tài khoản và membership vẫn còn; role không thay đổi; đăng nhập không bị khóa. Chỉ accountUserId, membershipId và thời điểm liên kết trên hồ sơ Nhân viên bị xóa.',
  )

  if (!confirmed) {
    return
  }

  isStaffAccountLinkSaving = true
  syncStaffFormAccountSavingState(true)
  render()

  const directoryResult = await listCenterAccountMemberships({ centerId: context.centerId })
  const latestContext = getStaffAccountCenterContext()
  refreshStaffDataFromStorage()
  const latestMatches = staffMembers.filter((item) => item.id === staffId)
  const latestStaffMember = latestMatches.length === 1 ? latestMatches[0] : null

  if (!latestContext.ok || latestContext.centerId !== context.centerId) {
    finishStaffAccountUnlink('Cơ sở đã thay đổi. Không có dữ liệu nào được lưu.')
    return
  }

  if (!directoryResult.ok) {
    finishStaffAccountUnlink(directoryResult.error || 'Không đọc được membership mới nhất.')
    return
  }

  staffAccountDirectoryState = createStaffAccountDirectoryState({
    status: 'loaded',
    centerId: context.centerId,
    centerName: latestContext.centerName,
    memberships: directoryResult.data,
  })

  if (!latestStaffMember || latestMatches.length !== 1) {
    finishStaffAccountUnlink('Hồ sơ nhân viên đã thay đổi hoặc không còn duy nhất.')
    return
  }

  if (latestStaffMember.centerId && latestStaffMember.centerId !== context.centerId) {
    finishStaffAccountUnlink('Hồ sơ nhân viên thuộc cơ sở khác. Không thể lưu chéo cơ sở.')
    return
  }

  if (
    latestStaffMember.accountUserId !== expectedAccountUserId ||
    latestStaffMember.membershipId !== expectedMembershipId
  ) {
    finishStaffAccountUnlink('Liên kết tài khoản đã thay đổi. Vui lòng kiểm tra lại trước khi gỡ.')
    return
  }

  const latestLink = resolveStaffAccountLink({
    staffMember: latestStaffMember,
    staffMembers,
    memberships: directoryResult.data,
    currentCenterId: context.centerId,
  })
  if (!['linked', 'linked-inactive'].includes(latestLink.status)) {
    finishStaffAccountUnlink('Liên kết tài khoản cần kiểm tra; hệ thống không tự gỡ dữ liệu malformed.')
    return
  }

  const updatedAt = new Date().toISOString()
  const savedStaffMember = unlinkStaffMemberFromAccount(latestStaffMember, updatedAt)
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('staff_member', savedStaffMember),
    { reason: 'staff-account-unlink' },
  )
  if (!committed.ok) {
    finishStaffAccountUnlink(committed.error || 'Không commit được thao tác gỡ liên kết.')
    return
  }
  staffAccountDirectoryState = createStaffAccountDirectoryState({
    status: 'loaded',
    centerId: context.centerId,
    centerName: latestContext.centerName,
    memberships: directoryResult.data,
  })
  isStaffAccountLinkSaving = false
  staffNotice = 'Đã gỡ liên kết tài khoản. Account, membership và role không thay đổi.'
  syncStaffFormAccountLinkState(
    staffMembers.find((item) => item.id === savedStaffMember.id) || savedStaffMember,
  )
  syncStaffFormAccountSavingState(false)
  render()
}

function finishStaffAccountUnlink(message) {
  isStaffAccountLinkSaving = false
  staffNotice = message
  syncStaffFormAccountSavingState(false)
  render()
}

function syncStaffFormAccountSavingState(isSaving) {
  if (!staffFormState) {
    return
  }

  staffFormState = {
    ...staffFormState,
    isSaving,
  }
}

async function openStaffAccountManagement(staffId) {
  if (isStaffAccountLinkSaving) {
    return
  }

  const context = getStaffAccountCenterContext()
  if (!context.ok) {
    staffNotice = context.error
    render()
    return
  }

  const directoryResult = await listCenterAccountMemberships({ centerId: context.centerId })
  const latestContext = getStaffAccountCenterContext()
  refreshStaffDataFromStorage()
  const staffMatches = staffMembers.filter((item) => item.id === staffId)
  const staffMember = staffMatches.length === 1 ? staffMatches[0] : null

  if (!directoryResult.ok || !latestContext.ok || latestContext.centerId !== context.centerId) {
    staffNotice = directoryResult.error || 'Cơ sở đã thay đổi khi mở quản lý tài khoản.'
    render()
    return
  }

  if (!staffMember || staffMatches.length !== 1) {
    staffNotice = 'Không tìm thấy duy nhất một hồ sơ nhân viên mới nhất.'
    render()
    return
  }

  const link = resolveStaffAccountLink({
    staffMember,
    staffMembers,
    memberships: directoryResult.data,
    currentCenterId: context.centerId,
  })

  if (!['linked', 'linked-inactive'].includes(link.status)) {
    staffNotice = 'Liên kết tài khoản cần kiểm tra trước khi mở quản lý tài khoản.'
    render()
    return
  }

  const currentRole = normalizeOnlineRole(cloudStatus.role || cloudStatus.membership?.role)
  if (currentRole !== ONLINE_ACCESS_ROLES.OWNER) {
    staffNotice = 'Quản lý tài khoản hiện chỉ mở cho Chủ hệ thống.'
    render()
    return
  }

  if (link.membership.role !== 'center_admin') {
    staffNotice = 'Màn hình quản lý tài khoản hiện có chỉ hỗ trợ account Quản lý cơ sở; chưa có deep-open an toàn cho role này.'
    render()
    return
  }

  if (!['active', 'revoked'].includes(link.membership.status)) {
    staffNotice = 'Màn hình quản lý tài khoản hiện có chưa hỗ trợ deep-open trạng thái membership này.'
    render()
    return
  }

  pendingInternalAccountUserId = link.membership.accountUserId
  staffAccountLinkState = null
  staffFormState = null
  window.location.hash = INTERNAL_CENTERS_ROUTE_HASH
  render()
}

function normalizeStaffAccountSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function updateStaffFormField(fieldName, value) {
  if (!staffFormState) {
    return
  }

  const nextValues = {
    ...staffFormState.values,
    [fieldName]: value,
  }

  if (fieldName === 'employmentStatus' && ['active', 'on-leave'].includes(value)) {
    nextValues.endDate = ''
  }

  staffFormState = {
    ...staffFormState,
    values: nextValues,
  }
}

function collectStaffFormValues(formElement) {
  const values = { ...(staffFormState?.values || {}) }

  formElement.querySelectorAll('[data-staff-form-field]').forEach((control) => {
    values[control.dataset.staffFormField] = control.value
  })

  return values
}

async function handleStaffFormSubmit(formElement) {
  if (!staffFormState || isStaffSaving) {
    return
  }

  const currentCenterId = getStaffCurrentCenterId()

  if (staffFormState.centerId && staffFormState.centerId !== currentCenterId) {
    staffFormState = {
      ...staffFormState,
      message: 'Cơ sở đã thay đổi. Vui lòng mở lại form trước khi lưu.',
    }
    render()
    return
  }

  isStaffSaving = true
  staffFormState = { ...staffFormState, isSaving: true, message: '' }

  refreshStaffDataFromStorage()
  const values = collectStaffFormValues(formElement)
  const existingStaffMember = staffFormState.mode === 'edit'
    ? staffMembers.find((item) => item.id === staffFormState.staffId)
    : null
  const matchingStaffCount = staffFormState.mode === 'edit'
    ? staffMembers.filter((item) => item.id === staffFormState.staffId).length
    : 0

  if (staffFormState.mode === 'edit' && !existingStaffMember) {
    isStaffSaving = false
    staffFormState = {
      ...staffFormState,
      values,
      isSaving: false,
      message: 'Hồ sơ nhân viên đã thay đổi hoặc không còn tồn tại. Vui lòng mở lại.',
    }
    render()
    return
  }

  if (staffFormState.mode === 'edit' && matchingStaffCount !== 1) {
    isStaffSaving = false
    staffFormState = {
      ...staffFormState,
      values,
      isSaving: false,
      message: 'Có nhiều hồ sơ nhân viên trùng ID. Cần kiểm tra dữ liệu trước khi lưu.',
    }
    render()
    return
  }

  if (existingStaffMember?.centerId && existingStaffMember.centerId !== currentCenterId) {
    isStaffSaving = false
    staffFormState = {
      ...staffFormState,
      values,
      isSaving: false,
      message: 'Hồ sơ nhân viên thuộc cơ sở khác. Không thể lưu chéo cơ sở.',
    }
    render()
    return
  }

  if (existingStaffMember) {
    values.employmentStatus = getStaffEmploymentStatus(existingStaffMember)
  }

  const errors = validateStaffForm(values, {
    staffMembers,
    departments: staffDepartments,
    currentStaffId: existingStaffMember?.id || null,
    allowedArchivedDepartmentId: existingStaffMember?.departmentId || '',
  })

  if (Object.keys(errors).length) {
    isStaffSaving = false
    staffFormState = {
      ...staffFormState,
      values,
      errors,
      isSaving: false,
      message: 'Vui lòng kiểm tra các trường chưa hợp lệ.',
    }
    render()
    focusFirstStaffFormError()
    return
  }

  const savedStaffMember = buildStaffMemberFromForm(values, existingStaffMember, currentCenterId)
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('staff_member', savedStaffMember),
    { reason: existingStaffMember ? 'staff-update' : 'staff-create' },
  )
  if (!committed.ok) {
    isStaffSaving = false
    staffFormState = {
      ...staffFormState,
      values,
      isSaving: false,
      message: committed.error || 'Không commit được hồ sơ nhân viên lên server.',
    }
    render()
    return
  }
  staffFormState = null
  staffNotice = existingStaffMember
    ? 'Đã commit cập nhật hồ sơ nhân viên.'
    : 'Đã commit hồ sơ nhân viên mới.'
  isStaffSaving = false
  render()
}

function focusFirstStaffFormError() {
  const firstError = document.querySelector('.staff-form .staff-field-error')
  const field = firstError?.closest('label')?.querySelector('[data-staff-form-field]')

  if (field && typeof field.focus === 'function') {
    field.focus()
  }
}

function getStaffLifecycleHistorySignature(staffMember) {
  return JSON.stringify(
    Array.isArray(staffMember?.employmentLifecycleEvents)
      ? staffMember.employmentLifecycleEvents
      : [],
  )
}

function openStaffLifecycleModal(staffId, mode = 'status') {
  if (isStaffLifecycleSaving) {
    return
  }

  refreshStaffDataFromStorage()
  const matches = staffMembers.filter((item) => item.id === staffId)
  const staffMember = matches.length === 1 ? matches[0] : null
  const currentCenterId = getStaffCurrentCenterId()

  if (!staffMember || matches.length !== 1) {
    staffNotice = 'Không tìm thấy duy nhất một hồ sơ nhân viên mới nhất.'
    render()
    return
  }
  if (staffMember.centerId && staffMember.centerId !== currentCenterId) {
    staffNotice = 'Hồ sơ nhân viên thuộc cơ sở khác. Không thể cập nhật trạng thái.'
    render()
    return
  }
  if (isStaffMemberArchived(staffMember)) {
    staffNotice = 'Hồ sơ đang được lưu trữ. Vui lòng khôi phục trước khi cập nhật trạng thái làm việc.'
    render()
    return
  }

  const currentStatus = getStaffEmploymentStatus(staffMember)
  if (mode === 'termination' && currentStatus === 'terminated') {
    staffNotice = 'Nhân viên đã ở trạng thái Đã nghỉ việc.'
    render()
    return
  }
  const availableTransitions = getAvailableStaffEmploymentTransitions(staffMember)
  const toStatus = mode === 'termination' ? 'terminated' : availableTransitions[0] || currentStatus

  staffLifecycleState = {
    mode,
    staffId: staffMember.id,
    centerId: currentCenterId,
    expectedStatus: currentStatus,
    expectedArchivedAt: String(staffMember.archivedAt || ''),
    expectedHistorySignature: getStaffLifecycleHistorySignature(staffMember),
    values: {
      toStatus,
      effectiveDate: '',
      note: '',
      followUp: 'none',
      confirmed: false,
    },
    errors: {},
    message: '',
    isSaving: false,
  }
  staffNotice = ''
  render()
  focusElementWithoutScrolling(
    document.querySelector(
      mode === 'termination'
        ? '[data-staff-lifecycle-field="effectiveDate"]'
        : '[data-staff-lifecycle-field="toStatus"]',
    ),
  )
}

function closeStaffLifecycleModal() {
  if (isStaffLifecycleSaving) {
    return
  }

  staffLifecycleState = null
  render()
}

function updateStaffLifecycleField(fieldName, value) {
  if (!staffLifecycleState) {
    return
  }

  staffLifecycleState = {
    ...staffLifecycleState,
    values: {
      ...staffLifecycleState.values,
      [fieldName]: value,
    },
    errors: {
      ...staffLifecycleState.errors,
      [fieldName]: undefined,
      ...(fieldName === 'toStatus' ? { status: undefined } : {}),
    },
    message: '',
  }
}

function syncStaffLifecycleDraftDom(fieldName) {
  if (!staffLifecycleState) {
    return
  }

  const nextStatus = staffLifecycleState.mode === 'termination'
    ? 'terminated'
    : String(staffLifecycleState.values?.toStatus || '')
  const effectiveDate = formatStaffLifecyclePreviewDate(staffLifecycleState.values?.effectiveDate)
  const previewValues = {
    'new-status': STAFF_EMPLOYMENT_STATUSES.find((status) => status.value === nextStatus)?.label || 'Không xác định',
    'effective-date': effectiveDate,
    'end-date': nextStatus === 'terminated' ? effectiveDate : 'Đến nay',
  }

  Object.entries(previewValues).forEach(([previewName, previewValue]) => {
    const element = document.querySelector(`[data-staff-lifecycle-preview="${previewName}"]`)
    if (element) {
      element.textContent = previewValue
    }
  })

  const errorFieldName = fieldName === 'toStatus' ? 'status' : fieldName
  document.querySelector(`[data-staff-lifecycle-error-for="${errorFieldName}"]`)?.remove()
  document.querySelector('[data-staff-lifecycle-message]')?.remove()
}

function formatStaffLifecyclePreviewDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Chưa chọn'
}

function collectStaffLifecycleValues(formElement) {
  const values = { ...(staffLifecycleState?.values || {}) }

  formElement.querySelectorAll('[data-staff-lifecycle-field]').forEach((control) => {
    const fieldName = control.dataset.staffLifecycleField
    if (control.type === 'radio') {
      if (control.checked) {
        values[fieldName] = control.value
      }
      return
    }
    values[fieldName] = control.type === 'checkbox' ? control.checked : control.value
  })

  return values
}

async function handleStaffLifecycleSubmit(formElement) {
  if (!staffLifecycleState || isStaffLifecycleSaving) {
    return
  }

  const values = collectStaffLifecycleValues(formElement)
  if (staffLifecycleState.mode === 'termination') {
    values.toStatus = 'terminated'
  }
  if (staffLifecycleState.mode === 'termination' && !values.confirmed) {
    staffLifecycleState = {
      ...staffLifecycleState,
      values,
      errors: { ...staffLifecycleState.errors, confirmed: 'Vui lòng xác nhận phạm vi xử lý nghỉ việc.' },
      message: 'Chưa thể lưu khi chưa có xác nhận rõ ràng.',
    }
    render()
    focusFirstStaffLifecycleError()
    return
  }

  const expectedState = staffLifecycleState
  const currentCenterId = getStaffCurrentCenterId()
  if (expectedState.centerId !== currentCenterId) {
    staffLifecycleState = {
      ...staffLifecycleState,
      values,
      message: 'Cơ sở đã thay đổi. Không có dữ liệu nào được lưu.',
    }
    render()
    focusFirstStaffLifecycleError()
    return
  }

  isStaffLifecycleSaving = true
  staffLifecycleState = { ...staffLifecycleState, values, isSaving: true, message: '' }
  render()

  refreshStaffDataFromStorage()
  const matches = staffMembers.filter((item) => item.id === expectedState.staffId)
  const latestStaffMember = matches.length === 1 ? matches[0] : null

  if (!latestStaffMember || matches.length !== 1) {
    finishStaffLifecycleError('Hồ sơ nhân viên đã thay đổi hoặc không còn duy nhất. Vui lòng mở lại.')
    return
  }
  if (latestStaffMember.centerId && latestStaffMember.centerId !== expectedState.centerId) {
    finishStaffLifecycleError('Hồ sơ nhân viên thuộc cơ sở khác. Không thể lưu chéo cơ sở.')
    return
  }
  if (isStaffMemberArchived(latestStaffMember)) {
    finishStaffLifecycleError('Hồ sơ đã được lưu trữ trong lúc modal đang mở. Không có dữ liệu nào được lưu.')
    return
  }
  if (
    getStaffEmploymentStatus(latestStaffMember) !== expectedState.expectedStatus ||
    String(latestStaffMember.archivedAt || '') !== expectedState.expectedArchivedAt ||
    getStaffLifecycleHistorySignature(latestStaffMember) !== expectedState.expectedHistorySignature
  ) {
    finishStaffLifecycleError('Trạng thái hoặc lịch sử đã thay đổi. Vui lòng đóng và mở lại để dùng dữ liệu mới nhất.')
    return
  }

  const transition = buildStaffEmploymentTransition(latestStaffMember, values, {
    createdBy: cloudStatus.user?.id || '',
    createdByLabel: cloudStatus.user?.email || '',
  })
  if (!transition.ok) {
    isStaffLifecycleSaving = false
    staffLifecycleState = {
      ...staffLifecycleState,
      values,
      errors: transition.errors,
      isSaving: false,
      message: 'Vui lòng kiểm tra thông tin chuyển trạng thái.',
    }
    render()
    focusFirstStaffLifecycleError()
    return
  }

  const savedStaffMember = transition.staffMember
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('staff_member', savedStaffMember),
    { reason: 'staff-lifecycle-transition' },
  )
  if (!committed.ok) {
    finishStaffLifecycleError(
      committed.error || 'Không commit được trạng thái làm việc lên server.',
    )
    return
  }
  const persistedStaffMember = staffMembers.find((item) => item.id === savedStaffMember.id) || savedStaffMember

  if (staffFormState?.staffId === persistedStaffMember.id) {
    staffFormState = {
      ...staffFormState,
      values: {
        ...staffFormState.values,
        employmentStatus: getStaffEmploymentStatus(persistedStaffMember),
        endDate: persistedStaffMember.endDate || '',
      },
      errors: {
        ...staffFormState.errors,
        employmentStatus: undefined,
        endDate: undefined,
      },
    }
  }

  const followUp = expectedState.mode === 'termination' ? values.followUp : 'none'
  staffLifecycleState = null
  isStaffLifecycleSaving = false
  staffNotice = expectedState.mode === 'termination'
    ? 'Đã đánh dấu Nhân viên nghỉ việc. Hồ sơ Giáo viên, liên kết và tài khoản không thay đổi.'
    : 'Đã cập nhật trạng thái làm việc và ghi thêm lịch sử.'

  if (followUp === 'teacher' && persistedStaffMember.teacherId) {
    openLinkedTeacherFromStaff(persistedStaffMember.teacherId)
    return
  }
  if (followUp === 'account' && persistedStaffMember.accountUserId && persistedStaffMember.membershipId) {
    render()
    void openStaffAccountManagement(persistedStaffMember.id)
    return
  }

  render()
}

function finishStaffLifecycleError(message) {
  isStaffLifecycleSaving = false
  if (staffLifecycleState) {
    staffLifecycleState = {
      ...staffLifecycleState,
      isSaving: false,
      message,
    }
  } else {
    staffNotice = message
  }
  render()
}

function focusFirstStaffLifecycleError() {
  const firstError = document.querySelector('.staff-lifecycle-window .staff-field-error')
  const errorFieldName = firstError?.dataset.staffLifecycleErrorFor
  const fieldName = errorFieldName === 'status' ? 'toStatus' : errorFieldName
  const field = fieldName
    ? document.querySelector(`[data-staff-lifecycle-field="${fieldName}"]`)
    : null
  focusElementWithoutScrolling(field)
}

async function handleArchiveStaff(staffId) {
  if (isStaffSaving) {
    return
  }

  refreshStaffDataFromStorage()
  const matches = staffMembers.filter((item) => item.id === staffId)
  const staffMember = matches.length === 1 ? matches[0] : null

  if (!staffMember || matches.length !== 1) {
    staffNotice = 'Không tìm thấy duy nhất một hồ sơ nhân viên mới nhất.'
    render()
    return
  }
  if (staffMember.centerId && staffMember.centerId !== getStaffCurrentCenterId()) {
    staffNotice = 'Hồ sơ nhân viên thuộc cơ sở khác. Không thể lưu trữ chéo cơ sở.'
    render()
    return
  }
  if (isStaffMemberArchived(staffMember)) {
    staffNotice = 'Hồ sơ nhân viên đã được lưu trữ.'
    render()
    return
  }

  const activeWarning = getStaffEmploymentStatus(staffMember) === 'active'
    ? ' Nhân viên vẫn đang ở trạng thái Đang làm việc; lưu trữ không đồng nghĩa nghỉ việc.'
    : ''
  const confirmed = window.confirm(
    `Lưu trữ hồ sơ nhân viên này?${activeWarning} Trạng thái làm việc, lịch sử, liên kết Giáo viên và tài khoản được giữ nguyên; không có dữ liệu nào bị khóa hoặc xóa.`,
  )

  if (!confirmed) {
    return
  }

  isStaffSaving = true
  const archivedStaffMember = archiveStaffMember(staffMember)
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('staff_member', archivedStaffMember),
    { reason: 'staff-archive' },
  )
  if (!committed.ok) {
    isStaffSaving = false
    staffNotice = committed.error || 'Không commit được trạng thái lưu trữ nhân viên.'
    render()
    return
  }
  if (staffLifecycleState?.staffId === staffId) {
    staffLifecycleState = null
  }
  staffNotice = 'Đã lưu trữ hồ sơ nhân viên.'
  isStaffSaving = false
  render()
}

async function handleRestoreStaff(staffId) {
  if (isStaffSaving) {
    return
  }

  refreshStaffDataFromStorage()
  const matches = staffMembers.filter((item) => item.id === staffId)
  const staffMember = matches.length === 1 ? matches[0] : null

  if (!staffMember || matches.length !== 1) {
    staffNotice = 'Không tìm thấy duy nhất một hồ sơ nhân viên mới nhất.'
    render()
    return
  }
  if (staffMember.centerId && staffMember.centerId !== getStaffCurrentCenterId()) {
    staffNotice = 'Hồ sơ nhân viên thuộc cơ sở khác. Không thể khôi phục chéo cơ sở.'
    render()
    return
  }
  if (!isStaffMemberArchived(staffMember)) {
    staffNotice = 'Hồ sơ nhân viên hiện không ở trạng thái lưu trữ.'
    render()
    return
  }

  const errors = validateStaffForm(staffMember, {
    staffMembers,
    departments: staffDepartments,
    currentStaffId: staffMember.id,
    allowedArchivedDepartmentId: staffMember.departmentId || '',
  })

  if (errors.employeeCode) {
    staffNotice = errors.employeeCode
    render()
    return
  }

  isStaffSaving = true
  const restoredStaffMember = restoreStaffMember(staffMember)
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('staff_member', restoredStaffMember),
    { reason: 'staff-restore' },
  )
  if (!committed.ok) {
    isStaffSaving = false
    staffNotice = committed.error || 'Không commit được trạng thái khôi phục nhân viên.'
    render()
    return
  }
  staffNotice = 'Đã khôi phục hồ sơ nhân viên.'
  isStaffSaving = false
  render()
}

function openStaffDepartmentPanel() {
  isStaffDepartmentPanelOpen = true
  staffDepartmentFormState = null
  staffNotice = ''
  render()
}

function closeStaffDepartmentPanel() {
  isStaffDepartmentPanelOpen = false
  staffDepartmentFormState = null
  isStaffDepartmentSaving = false
  render()
}

function openCreateDepartmentForm() {
  const nextState = createEmptyDepartmentFormState()
  nextState.centerId = getStaffCurrentCenterId()
  staffDepartmentFormState = nextState
  render()
}

function openEditDepartmentForm(departmentId) {
  refreshStaffDataFromStorage()
  const department = staffDepartments.find((item) => item.id === departmentId)

  if (!department) {
    staffNotice = 'Không tìm thấy phòng ban mới nhất.'
    render()
    return
  }

  staffDepartmentFormState = createEditDepartmentFormState(department)
  render()
}

function updateStaffDepartmentField(fieldName, value) {
  if (!staffDepartmentFormState) {
    return
  }

  staffDepartmentFormState = {
    ...staffDepartmentFormState,
    values: {
      ...staffDepartmentFormState.values,
      [fieldName]: value,
    },
  }
}

function collectDepartmentFormValues(formElement) {
  const values = { ...(staffDepartmentFormState?.values || {}) }

  formElement.querySelectorAll('[data-staff-department-field]').forEach((control) => {
    values[control.dataset.staffDepartmentField] = control.value
  })

  return values
}

async function handleDepartmentFormSubmit(formElement) {
  if (!staffDepartmentFormState || isStaffDepartmentSaving) {
    return
  }

  const currentCenterId = getStaffCurrentCenterId()

  if (staffDepartmentFormState.centerId && staffDepartmentFormState.centerId !== currentCenterId) {
    staffDepartmentFormState = {
      ...staffDepartmentFormState,
      message: 'Cơ sở đã thay đổi. Vui lòng mở lại form phòng ban trước khi lưu.',
    }
    render()
    return
  }

  isStaffDepartmentSaving = true
  staffDepartmentFormState = { ...staffDepartmentFormState, isSaving: true, message: '' }
  refreshStaffDataFromStorage()

  const values = collectDepartmentFormValues(formElement)
  const existingDepartment = staffDepartmentFormState.mode === 'edit'
    ? staffDepartments.find((item) => item.id === staffDepartmentFormState.departmentId)
    : null

  if (staffDepartmentFormState.mode === 'edit' && !existingDepartment) {
    isStaffDepartmentSaving = false
    staffDepartmentFormState = {
      ...staffDepartmentFormState,
      values,
      isSaving: false,
      message: 'Phòng ban đã thay đổi hoặc không còn tồn tại. Vui lòng mở lại.',
    }
    render()
    return
  }

  const errors = validateDepartmentForm(values, {
    departments: staffDepartments,
    currentDepartmentId: existingDepartment?.id || null,
  })

  if (Object.keys(errors).length) {
    isStaffDepartmentSaving = false
    staffDepartmentFormState = {
      ...staffDepartmentFormState,
      values,
      errors,
      isSaving: false,
      message: 'Vui lòng kiểm tra thông tin phòng ban.',
    }
    render()
    return
  }

  const savedDepartment = buildDepartmentFromForm(values, existingDepartment, currentCenterId)
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('department', savedDepartment),
    { reason: existingDepartment ? 'department-update' : 'department-create' },
  )
  if (!committed.ok) {
    isStaffDepartmentSaving = false
    staffDepartmentFormState = {
      ...staffDepartmentFormState,
      values,
      isSaving: false,
      message: committed.error || 'Không commit được phòng ban lên server.',
    }
    render()
    return
  }
  staffDepartmentFormState = null
  staffNotice = existingDepartment ? 'Đã cập nhật phòng ban.' : 'Đã thêm phòng ban.'
  isStaffDepartmentSaving = false
  render()
}

async function handleArchiveDepartment(departmentId) {
  if (isStaffDepartmentSaving) {
    return
  }

  refreshStaffDataFromStorage()
  const department = staffDepartments.find((item) => item.id === departmentId)

  if (!department) {
    staffNotice = 'Không tìm thấy phòng ban mới nhất.'
    render()
    return
  }

  const referencedCount = staffMembers.filter((staffMember) => staffMember.departmentId === departmentId).length
  const confirmed = window.confirm(
    `Lưu trữ phòng ban này? ${referencedCount.toLocaleString('vi-VN')} hồ sơ nhân viên đang tham chiếu vẫn giữ departmentId và không bị xóa.`,
  )

  if (!confirmed) {
    return
  }

  isStaffDepartmentSaving = true
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('department', archiveDepartment(department)),
    { reason: 'department-archive' },
  )
  if (!committed.ok) {
    isStaffDepartmentSaving = false
    staffNotice = committed.error || 'Không commit được trạng thái lưu trữ phòng ban.'
    render()
    return
  }
  staffNotice = 'Đã lưu trữ phòng ban.'
  isStaffDepartmentSaving = false
  render()
}

async function handleRestoreDepartment(departmentId) {
  if (isStaffDepartmentSaving) {
    return
  }

  refreshStaffDataFromStorage()
  const department = staffDepartments.find((item) => item.id === departmentId)

  if (!department) {
    staffNotice = 'Không tìm thấy phòng ban mới nhất.'
    render()
    return
  }

  const restoredDepartment = restoreDepartment(department)
  const errors = validateDepartmentForm(restoredDepartment, {
    departments: staffDepartments,
    currentDepartmentId: department.id,
  })

  if (Object.keys(errors).length) {
    staffNotice = errors.name || errors.code || 'Không thể khôi phục phòng ban do dữ liệu trùng mới nhất.'
    render()
    return
  }

  isStaffDepartmentSaving = true
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('department', restoredDepartment),
    { reason: 'department-restore' },
  )
  if (!committed.ok) {
    isStaffDepartmentSaving = false
    staffNotice = committed.error || 'Không commit được trạng thái khôi phục phòng ban.'
    render()
    return
  }
  staffNotice = 'Đã khôi phục phòng ban.'
  isStaffDepartmentSaving = false
  render()
}

function createTeacherStaffLinkFormValues(teacher) {
  return {
    employeeCode: '',
    fullName: String(teacher?.fullName || teacher?.displayName || '').trim(),
    phone: String(teacher?.phone || '').trim(),
    email: String(teacher?.email || teacher?.loginEmail || '').trim(),
    departmentId: '',
    positionTitle: 'Giáo viên',
    employmentType: mapTeacherTypeToStaffEmploymentType(teacher?.teacherType),
    employmentStatus: teacher?.status === 'active' ? 'active' : 'terminated',
    startDate: '',
    endDate: '',
    note: '',
  }
}

function mapTeacherTypeToStaffEmploymentType(teacherType) {
  const map = {
    fulltime: 'full-time',
    parttime: 'part-time',
    collaborator: 'collaborator',
  }

  return map[teacherType] || 'unspecified'
}

function openTeacherStaffLinkModal(teacherId) {
  refreshStaffDataFromStorage()
  const teacher = teachers.find((item) => item.id === teacherId)

  if (!teacher) {
    return
  }

  teacherStaffLinkState = {
    teacherId,
    centerId: getStaffCurrentCenterId(),
    mode: 'existing',
    query: '',
    values: createTeacherStaffLinkFormValues(teacher),
    errors: {},
    message: teacher.status === 'active'
      ? ''
      : 'Giáo viên không còn active nên không thể tạo liên kết nhân sự mới.',
    isSaving: false,
  }
  render()
}

function closeTeacherStaffLinkModal() {
  teacherStaffLinkState = null
  isTeacherStaffLinkSaving = false
  render()
}

function setTeacherStaffLinkMode(mode) {
  if (!teacherStaffLinkState || !['existing', 'create'].includes(mode)) {
    return
  }

  teacherStaffLinkState = {
    ...teacherStaffLinkState,
    mode,
    errors: {},
    message: '',
  }
  render()
}

function updateTeacherStaffLinkQuery(value) {
  if (!teacherStaffLinkState) {
    return
  }

  teacherStaffLinkState = {
    ...teacherStaffLinkState,
    query: value,
  }
}

function updateTeacherStaffCreateField(fieldName, value) {
  if (!teacherStaffLinkState) {
    return
  }

  const nextValues = {
    ...teacherStaffLinkState.values,
    [fieldName]: value,
  }

  if (fieldName === 'employmentStatus' && ['active', 'on-leave'].includes(value)) {
    nextValues.endDate = ''
  }

  teacherStaffLinkState = {
    ...teacherStaffLinkState,
    values: nextValues,
  }
}

function collectTeacherStaffCreateValues(formElement) {
  const values = { ...(teacherStaffLinkState?.values || {}) }

  formElement.querySelectorAll('[data-teacher-staff-create-field]').forEach((control) => {
    values[control.dataset.teacherStaffCreateField] = control.value
  })

  return values
}

function getLatestTeacherForStaffLink(teacherId) {
  teachers = getStoredTeachers([])
  return teachers.find((teacher) => teacher.id === teacherId)
}

function canLinkTeacherToStaff(teacher, staffList, existingStaffId = '') {
  if (!teacher) {
    return 'Không tìm thấy giáo viên mới nhất.'
  }

  if (teacher.status !== 'active') {
    return 'Giáo viên không còn active nên không thể tạo liên kết nhân sự mới.'
  }

  const linkLookup = findStaffMemberByTeacherId(staffList, teacher.id)

  if (linkLookup.status === 'duplicate') {
    return 'Cần review: có nhiều hồ sơ nhân viên đang trỏ tới giáo viên này.'
  }

  if (linkLookup.staffMember && linkLookup.staffMember.id !== existingStaffId) {
    return 'Giáo viên đã được liên kết với một hồ sơ nhân viên khác.'
  }

  return ''
}

async function handleLinkExistingStaffToTeacher(staffId) {
  if (!teacherStaffLinkState || isTeacherStaffLinkSaving) {
    return
  }

  const currentCenterId = getStaffCurrentCenterId()
  if (teacherStaffLinkState.centerId !== currentCenterId) {
    teacherStaffLinkState = {
      ...teacherStaffLinkState,
      message: 'Cơ sở đã thay đổi. Vui lòng mở lại modal liên kết.',
    }
    render()
    return
  }

  isTeacherStaffLinkSaving = true
  teacherStaffLinkState = { ...teacherStaffLinkState, isSaving: true, message: '' }
  refreshStaffDataFromStorage()

  const teacher = getLatestTeacherForStaffLink(teacherStaffLinkState.teacherId)
  const targetStaff = staffMembers.find((staffMember) => staffMember.id === staffId)
  const teacherError = canLinkTeacherToStaff(teacher, staffMembers, staffId)

  if (teacherError) {
    isTeacherStaffLinkSaving = false
    teacherStaffLinkState = { ...teacherStaffLinkState, isSaving: false, message: teacherError }
    render()
    return
  }

  if (!targetStaff) {
    isTeacherStaffLinkSaving = false
    teacherStaffLinkState = { ...teacherStaffLinkState, isSaving: false, message: 'Không tìm thấy hồ sơ nhân viên mới nhất.' }
    render()
    return
  }

  if (targetStaff.centerId && targetStaff.centerId !== currentCenterId) {
    isTeacherStaffLinkSaving = false
    teacherStaffLinkState = { ...teacherStaffLinkState, isSaving: false, message: 'Không thể liên kết hồ sơ khác cơ sở.' }
    render()
    return
  }

  if (isStaffMemberArchived(targetStaff)) {
    isTeacherStaffLinkSaving = false
    teacherStaffLinkState = { ...teacherStaffLinkState, isSaving: false, message: 'Không thể liên kết hồ sơ nhân viên đã lưu trữ.' }
    render()
    return
  }

  if (targetStaff.teacherId && targetStaff.teacherId !== teacher.id) {
    isTeacherStaffLinkSaving = false
    teacherStaffLinkState = {
      ...teacherStaffLinkState,
      isSaving: false,
      message: 'Hồ sơ nhân viên đã được liên kết với một giáo viên khác.',
    }
    render()
    return
  }

  const now = new Date().toISOString()
  const savedStaffMember = {
    ...targetStaff,
    teacherId: teacher.id,
    teacherLinkedAt: targetStaff.teacherLinkedAt || now,
    updatedAt: now,
  }
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('staff_member', savedStaffMember),
    { reason: 'teacher-reference-link' },
  )
  if (!committed.ok) {
    isTeacherStaffLinkSaving = false
    teacherStaffLinkState = {
      ...teacherStaffLinkState,
      isSaving: false,
      message: committed.error || 'Không commit được reference Giáo viên.',
    }
    render()
    return
  }
  teacherStaffLinkState = null
  staffNotice = 'Đã liên kết hồ sơ Giáo viên với Nhân viên.'
  isTeacherStaffLinkSaving = false
  render()
}

async function handleCreateStaffFromTeacher(formElement) {
  if (!teacherStaffLinkState || isTeacherStaffLinkSaving) {
    return
  }

  const currentCenterId = getStaffCurrentCenterId()
  const values = collectTeacherStaffCreateValues(formElement)

  if (teacherStaffLinkState.centerId !== currentCenterId) {
    teacherStaffLinkState = {
      ...teacherStaffLinkState,
      values,
      message: 'Cơ sở đã thay đổi. Vui lòng mở lại modal liên kết.',
    }
    render()
    return
  }

  isTeacherStaffLinkSaving = true
  teacherStaffLinkState = { ...teacherStaffLinkState, values, isSaving: true, message: '' }
  refreshStaffDataFromStorage()

  const teacher = getLatestTeacherForStaffLink(teacherStaffLinkState.teacherId)
  const teacherError = canLinkTeacherToStaff(teacher, staffMembers)

  if (teacherError) {
    isTeacherStaffLinkSaving = false
    teacherStaffLinkState = { ...teacherStaffLinkState, values, isSaving: false, message: teacherError }
    render()
    return
  }

  const errors = validateStaffForm(values, {
    staffMembers,
    departments: staffDepartments,
  })

  if (Object.keys(errors).length) {
    isTeacherStaffLinkSaving = false
    teacherStaffLinkState = {
      ...teacherStaffLinkState,
      values,
      errors,
      isSaving: false,
      message: 'Vui lòng kiểm tra thông tin nhân viên.',
    }
    render()
    return
  }

  const now = new Date().toISOString()
  const staffMember = {
    ...buildStaffMemberFromForm(values, null, currentCenterId),
    teacherId: teacher.id,
    teacherLinkedAt: now,
    updatedAt: now,
  }

  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('staff_member', staffMember),
    { reason: 'staff-create-with-teacher-reference' },
  )
  if (!committed.ok) {
    isTeacherStaffLinkSaving = false
    teacherStaffLinkState = {
      ...teacherStaffLinkState,
      values,
      isSaving: false,
      message: committed.error || 'Không commit được hồ sơ Staff/Teacher reference.',
    }
    render()
    return
  }
  teacherStaffLinkState = null
  staffNotice = 'Đã tạo hồ sơ nhân viên và liên kết giáo viên.'
  isTeacherStaffLinkSaving = false
  render()
}

async function unlinkTeacherFromStaff(staffId, teacherId) {
  if (isTeacherStaffLinkSaving) {
    return
  }

  refreshStaffDataFromStorage()
  const staffMember = staffMembers.find((item) => item.id === staffId)

  if (!staffMember) {
    staffNotice = 'Không tìm thấy hồ sơ nhân viên mới nhất.'
    render()
    return
  }

  if (staffMember.teacherId !== teacherId) {
    staffNotice = 'Liên kết đã thay đổi. Vui lòng tải lại hồ sơ trước khi gỡ.'
    render()
    return
  }

  const confirmed = window.confirm(
    'Gỡ liên kết hồ sơ? Hồ sơ Nhân viên vẫn còn, hồ sơ Giáo viên vẫn còn, TKB/điểm danh không bị xóa, tài khoản không bị thay đổi. Chỉ mối liên kết nhân sự bị gỡ.',
  )

  if (!confirmed) {
    return
  }

  const now = new Date().toISOString()
  const savedStaffMember = {
    ...staffMember,
    teacherId: '',
    teacherLinkedAt: '',
    updatedAt: now,
  }
  const committed = await writeC55StaffHrCommand(
    buildC55StaffHrUpsertCommand('staff_member', savedStaffMember),
    { reason: 'teacher-reference-unlink' },
  )
  if (!committed.ok) {
    staffNotice = committed.error || 'Không commit được thao tác gỡ reference Giáo viên.'
    render()
    return
  }
  staffNotice = 'Đã gỡ liên kết hồ sơ Giáo viên và Nhân viên.'
  render()
}

function openLinkedStaffFromTeacher(staffId) {
  refreshStaffDataFromStorage()
  const matchingStaff = staffMembers.filter((item) => item.id === staffId)
  const staffMember = getUniqueCurrentCenterStaffMember(staffId)

  if (!staffMember) {
    staffNotice = matchingStaff.length > 1
      ? 'Có nhiều hồ sơ Nhân viên trùng stable ID. Cần kiểm tra dữ liệu trước khi mở.'
      : 'Không tìm thấy hồ sơ nhân viên mới nhất.'
    staffFilters = clearStaffListFilters(staffFilters)
    openModuleWindowFromChildInteraction('nhan-vien')
    return
  }

  staffFormState = createEditStaffFormState(staffMember)
  staffFilters = clearStaffListFilters(staffFilters)
  openModuleWindowFromChildInteraction('nhan-vien')
}

function openLinkedTeacherFromStaff(teacherId) {
  const matches = teachers.filter((item) => item.id === teacherId)
  const teacher = matches.length === 1 ? matches[0] : null

  if (!teacher || matches.length !== 1) {
    staffNotice = matches.length > 1
      ? 'Có nhiều hồ sơ Giáo viên trùng stable ID. Cần kiểm tra dữ liệu trước khi mở.'
      : 'Không tìm thấy hồ sơ Giáo viên tương ứng.'
    render()
    return
  }

  selectedTeacherId = teacher.id
  teacherFormState = null
  openModuleWindowFromChildInteraction('giao-vien')
}

function applyUiTheme() {
  document.documentElement.dataset.uiTheme = currentUiTheme
}

function render() {
  if (shouldDeferRenderForTextEditing()) {
    deferRenderUntilTextEditingEnds()
    return
  }

  pendingTextEditingRender = false

  const activeElementSnapshot = getActiveElementRenderSnapshot()
  const preservedScrollState = rememberPreservedScrollPositions()
  const scheduleReportScrollState = getScheduleReportScrollState()
  const scheduleFormScrollState = getScheduleFormScrollState()
  const parentContactFormScrollTop = getParentContactFormScrollTop()
  const currentCenterBinding = resolveAppCenterBinding(cloudStatus)
  const isLoginGateOpen = !isDashboardUnlockedByCenter(cloudStatus, currentCenterBinding)
  const isInternalCentersRoute = isInternalCenterConsoleRoute()

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
    <div class="app-shell ${isLoginGateOpen ? 'is-login-gated' : ''} ${isInternalCentersRoute ? 'is-internal-console-route' : ''}">
      <main class="desktop-area ${isLoginGateOpen ? 'is-login-gated' : ''} ${isInternalCentersRoute ? 'is-internal-console-route' : ''}">
        ${isLoginGateOpen ? renderAppAuthEntry(cloudStatus, currentCenterBinding) : ''}
        ${isLoginGateOpen ? '' : isInternalCentersRoute ? renderInternalCenterConsoleRoute(currentCenterBinding) : renderDashboard()}
        <div class="window-layer" aria-label="Các cửa sổ đang mở">
          ${isLoginGateOpen || isInternalCentersRoute ? '' : renderOpenWindows()}
        </div>
      </main>
      ${isLoginGateOpen || isInternalCentersRoute ? '' : renderTaskbar()}
      ${isLoginGateOpen || isInternalCentersRoute ? '' : renderSystemOverlay()}
    </div>
  `

  bindEvents()
  restoreScheduleReportScrollState(scheduleReportScrollState)
  restoreScheduleFormScrollState(scheduleFormScrollState)
  restoreParentContactFormScrollTop()
  restorePreservedScrollPositions(preservedScrollState)
  restoreActiveElementRenderSnapshot(activeElementSnapshot)
  restorePendingWindowFocusAfterRender()
  focusStaffDocumentAttachmentViewerAfterRender()
  focusPendingInternalAccountCard()
  focusPendingAttendanceBaselineCell()
  restorePendingStaffDocumentViewerReturnContextAfterRender()
  skipNextParentContactScrollCapture = false
  updateClock()
}

function focusPendingInternalAccountCard() {
  if (!pendingInternalAccountUserId || !isInternalCenterConsoleRoute()) {
    return
  }

  const target = document.querySelector('[data-internal-account-focused]')
  if (target) {
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    pendingInternalAccountUserId = ''
    return
  }

  if (internalCenterAdminAccountsState.status === 'loaded') {
    pendingInternalAccountUserId = ''
  }
}

function refreshTuitionFormPreview() {
  if (!tuitionFormState) {
    return
  }

  const previewElement = document.querySelector('[data-tuition-discount-preview]')

  if (!previewElement) {
    return
  }

  previewElement.outerHTML = renderTuitionDiscountPreviewFromValues(tuitionFormState.values)
}

function isTextEditingElement(element) {
  if (!element) {
    return false
  }

  const tagName = element.tagName?.toLowerCase()

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  )
}

function isNativeSelectElement(element) {
  return element?.tagName?.toLowerCase() === 'select'
}

function shouldDeferRenderForTextEditing() {
  if (shouldDelayTextEditingRenderFlushForAction()) {
    return false
  }

  const activeElement = document.activeElement

  if (isNativeSelectElement(activeElement)) {
    return !shouldAllowNativeSelectChangeRender()
  }

  if (shouldAllowImmediateRenderForActiveElement(activeElement)) {
    return false
  }

  return isTextEditingElement(activeElement)
}

function shouldAllowImmediateRenderForActiveElement(element) {
  if (!element) {
    return false
  }

  return Boolean(element.closest?.('[data-student-filter], [data-attendance-board-filter]'))
}

function shouldAllowNativeSelectChangeRender() {
  return Date.now() < nativeSelectChangeRenderUntil
}

function markNativeSelectInteraction() {
  nativeSelectInteractionUntil = Date.now() + 1200
}

function markNativeSelectChangeRender() {
  nativeSelectChangeRenderUntil = Date.now() + 240
  nativeSelectInteractionUntil = 0
}

function isNativeSelectInteractionInProgress() {
  return Date.now() < nativeSelectInteractionUntil
}

function isInteractiveActionElement(element) {
  return Boolean(
    element?.closest?.(
      [
        'button',
        'summary',
        'a[href]',
        '[role="button"]',
        '[type="button"]',
        '[type="submit"]',
        '[data-action]',
        '[data-window-action]',
        '[data-module-launcher]',
        '[data-student-action]',
        '[data-teacher-action]',
        '[data-settings-class-session-action]',
        '[data-attendance-baseline-action]',
        '[data-notification-action]',
        '[data-notification-module-id]',
        '[data-taskbar-window-id]',
      ].join(','),
    ),
  )
}

function shouldDelayTextEditingRenderFlushForAction() {
  return Date.now() < textEditingActionPointerUntil
}

function shouldDelayTextEditingRenderFlushForFieldTransition() {
  return Date.now() < textEditingFieldPointerUntil
}

function getActiveElementRenderSnapshot() {
  if (shouldDelayTextEditingRenderFlushForAction()) {
    return null
  }

  const element = document.activeElement

  if (!isTextEditingElement(element) || isNativeSelectElement(element)) {
    return null
  }

  const selector = getStableElementSelector(element)

  if (!selector) {
    return null
  }

  return {
    selector,
    value: 'value' in element ? element.value : element.textContent,
    selectionStart: 'selectionStart' in element ? element.selectionStart : null,
    selectionEnd: 'selectionEnd' in element ? element.selectionEnd : null,
  }
}

function restoreActiveElementRenderSnapshot(snapshot) {
  if (!snapshot || shouldDelayTextEditingRenderFlushForAction()) {
    return
  }

  const element = document.querySelector(snapshot.selector)

  if (!element) {
    return
  }

  if ('value' in element && snapshot.value !== null && String(element.value) !== String(snapshot.value)) {
    return
  }

  focusElementWithoutScrolling(element)

  if (
    snapshot.selectionStart !== null &&
    snapshot.selectionEnd !== null &&
    typeof element.setSelectionRange === 'function'
  ) {
    element.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd)
  }
}

function restorePendingWindowFocusAfterRender() {
  if (!pendingWindowFocusAfterRender) {
    return
  }

  const windowId = pendingWindowFocusAfterRender
  const windowItem = openWindows.find((item) => item.id === windowId)
  const windowElement = document.querySelector(`[data-window-id="${escapeCssAttributeValue(windowId)}"]`)

  if (windowItem && windowElement) {
    windowElement.style.zIndex = String(windowItem.zIndex)
    windowElement.classList.add('is-child-open-target')
  }

  pendingWindowFocusAfterRender = null
}

function getStableElementSelector(element) {
  if (!element) {
    return ''
  }

  if (element.id) {
    return `#${escapeCssIdentifier(element.id)}`
  }

  const stableAttributeNames = [
    'data-student-filter',
    'data-student-form-field',
    'data-teacher-form-field',
    'data-settings-class-session-field',
    'data-schedule-form-field',
    'data-parent-consultation-filter',
    'data-parent-contact-field',
    'data-parent-care-log-field',
    'data-parent-appointment-field',
    'data-parent-enrollment-field',
    'data-parent-form-field',
    'data-tuition-filter',
    'data-tuition-scroll-region',
    'data-cashflow-filter',
    'data-inventory-filter',
    'data-attendance-board-filter',
    'data-attendance-baseline-cell-input',
    'data-report-filter',
    'data-staff-filter',
    'data-staff-form-field',
    'data-staff-lifecycle-field',
    'data-staff-department-field',
    'data-teacher-staff-create-field',
    'data-teacher-staff-link-query',
    'name',
  ]
  const attributeName = stableAttributeNames.find((name) => element.hasAttribute?.(name))

  if (!attributeName) {
    return ''
  }

  const value = element.getAttribute(attributeName)
  const tagName = element.tagName?.toLowerCase() || ''

  return `${tagName}[${attributeName}="${escapeCssAttributeValue(value)}"]`
}

function escapeCssIdentifier(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(String(value))
  }

  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

function escapeCssAttributeValue(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function deferRenderUntilTextEditingEnds() {
  pendingTextEditingRender = true
}

function flushDeferredTextEditingRender() {
  if (shouldDelayTextEditingRenderFlushForAction() || shouldDelayTextEditingRenderFlushForFieldTransition()) {
    window.setTimeout(flushDeferredTextEditingRender, 80)
    return
  }

  if (!pendingTextEditingRender || shouldDeferRenderForTextEditing()) {
    return
  }

  pendingTextEditingRender = false
  render()
}

function scheduleDeferredTextEditingRenderFlush(event = null) {
  if (event?.type === 'focusout' && isTextEditingElement(event.relatedTarget)) {
    return
  }

  window.setTimeout(flushDeferredTextEditingRender, 0)
}

function installTextEditingRenderProtection() {
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (isTextEditingElement(event.target)) {
        textEditingFieldPointerUntil = Date.now() + 220
      }

      if (isNativeSelectElement(event.target)) {
        markNativeSelectInteraction()
      }
    },
    true,
  )

  document.addEventListener(
    'focusin',
    (event) => {
      if (isNativeSelectElement(event.target)) {
        markNativeSelectInteraction()
      }
    },
    true,
  )

  document.addEventListener(
    'change',
    (event) => {
      if (isNativeSelectElement(event.target)) {
        markNativeSelectChangeRender()
      }
    },
    true,
  )

  document.addEventListener(
    'focusout',
    (event) => {
      if (isNativeSelectElement(event.target)) {
        nativeSelectInteractionUntil = 0
      }
    },
    true,
  )

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (shouldDeferRenderForTextEditing() && isInteractiveActionElement(event.target)) {
        textEditingActionPointerUntil = Date.now() + 180
      }
    },
    true,
  )
  document.addEventListener('focusout', scheduleDeferredTextEditingRenderFlush, true)
  document.addEventListener('change', scheduleDeferredTextEditingRenderFlush, true)
}

function isInternalCenterConsoleRoute() {
  return window.location.hash === INTERNAL_CENTERS_ROUTE_HASH
}

function getInternalCenterConsoleAccess(centerBinding) {
  const isSignedIn = cloudStatus.authStatus === 'signed-in' && Boolean(cloudStatus.user)
  const role = normalizeOnlineRole(cloudStatus.role ?? cloudStatus.membership?.role)
  const membershipStatus = String(cloudStatus.membership?.status || '').toLowerCase()
  const hasActiveMembership = centerBinding?.status === 'bound' && membershipStatus === 'active'

  return {
    isSignedIn,
    role,
    hasActiveMembership,
    isOwner: isSignedIn && hasActiveMembership && role === ONLINE_ACCESS_ROLES.OWNER,
  }
}

function renderInternalCenterConsoleRoute(centerBinding) {
  const access = getInternalCenterConsoleAccess(centerBinding)

  if (!access.isOwner) {
    return renderInternalCenterConsoleDenied(access)
  }

  ensureInternalCentersListLoading()

  return renderInternalCenterConsoleSkeleton(centerBinding)
}

function renderInternalCenterConsoleDenied(access) {
  const reason = !access.isSignedIn
    ? 'Vui lòng đăng nhập bằng tài khoản owner để vào khu vực nội bộ.'
    : 'Bạn không có quyền truy cập khu vực nội bộ.'

  return `
    <section class="internal-console-screen is-denied" aria-labelledby="internal-console-denied-title">
      <div class="internal-console-panel">
        <p class="internal-console-eyebrow">Internal Center Console</p>
        <h1 id="internal-console-denied-title">Không thể truy cập</h1>
        <p>${escapeHtml(reason)}</p>
        <dl class="internal-console-meta">
          <div>
            <dt>Trạng thái</dt>
            <dd>${escapeHtml(access.isSignedIn ? 'Đã đăng nhập' : 'Chưa đăng nhập')}</dd>
          </div>
          <div>
            <dt>Vai trò</dt>
            <dd>${escapeHtml(access.role || 'none')}</dd>
          </div>
        </dl>
        <button type="button" class="internal-console-return" data-internal-console-action="return-dashboard">
          Quay lại OS cơ sở
        </button>
      </div>
    </section>
  `
}

function renderInternalCenterConsoleSkeleton(centerBinding) {
  return `
    <section class="internal-console-screen" aria-labelledby="internal-console-title">
      <div class="internal-console-panel">
        <p class="internal-console-eyebrow">Internal Center Console</p>
        <h1 id="internal-console-title">Quản trị nội bộ</h1>
        ${renderInternalAddCenterForm()}
        ${renderInternalCentersList()}
        ${renderInternalCenterAccountManagement()}
        <dl class="internal-console-meta">
          <div>
            <dt>Tài khoản</dt>
            <dd>${escapeHtml(cloudStatus.user?.email || '')}</dd>
          </div>
          <div>
            <dt>Vai trò</dt>
            <dd>${escapeHtml(cloudStatus.role || '')}</dd>
          </div>
          <div>
            <dt>Cơ sở hiện tại</dt>
            <dd>${escapeHtml(centerBinding.centerName || centerBinding.currentCenterId || 'Chưa xác định')}</dd>
          </div>
          <div>
            <dt>Mã cơ sở hiện tại</dt>
            <dd>${escapeHtml(centerBinding.currentCenterId || '')}</dd>
          </div>
        </dl>
        <button type="button" class="internal-console-return" data-internal-console-action="return-dashboard">
          Quay lại OS cơ sở
        </button>
      </div>
    </section>
  `
}

function renderInternalAddCenterForm() {
  const preview = getInternalAddCenterPreview(internalAddCenterFormState.name)
  const isSubmitting = internalAddCenterFormState.status === 'submitting'
  const submitDisabled = isSubmitting || !preview.isSubmittable

  return `
    <form class="internal-add-center-form" data-internal-add-center-form>
      <div class="internal-add-center-header">
        <div>
          <h2>Thêm cơ sở</h2>
        </div>
      </div>
      <label class="internal-add-center-field">
        <span>Tên cơ sở</span>
        <input
          type="text"
          name="centerName"
          autocomplete="off"
          required
          minlength="2"
          value="${escapeHtml(internalAddCenterFormState.name)}"
          data-internal-add-center-name
        />
      </label>
      <dl class="internal-add-center-preview" aria-label="Preview cơ sở sẽ tạo">
        <div>
          <dt>Slug</dt>
          <dd data-internal-add-center-preview="slug">${escapeHtml(preview.slug || '-')}</dd>
        </div>
        <div>
          <dt>Mã cơ sở sẽ tạo</dt>
          <dd data-internal-add-center-preview="centerId">${escapeHtml(preview.centerId || '-')}</dd>
        </div>
        <div>
          <dt>Môi trường</dt>
          <dd>production</dd>
        </div>
        <div>
          <dt>Trạng thái</dt>
          <dd>active</dd>
        </div>
      </dl>
      ${internalAddCenterFormState.error ? `
        <p class="internal-add-center-message is-error" role="alert">
          ${escapeHtml(internalAddCenterFormState.error)}
        </p>
      ` : ''}
      ${internalAddCenterFormState.success ? `
        <p class="internal-add-center-message is-success" role="status">
          ${escapeHtml(internalAddCenterFormState.success)}
        </p>
      ` : ''}
      <div class="internal-add-center-actions">
        <button type="submit" ${submitDisabled ? 'disabled' : ''} data-internal-add-center-submit>
          ${isSubmitting ? 'Đang tạo cơ sở...' : 'Tạo cơ sở'}
        </button>
      </div>
    </form>
  `
}

function getInternalAddCenterPreview(centerName) {
  const normalizedName = String(centerName || '').trim()
  const slug = createCompactCenterSlug(normalizedName)

  return {
    name: normalizedName,
    slug,
    centerId: slug ? `${slug}_prod` : '',
    isSubmittable: normalizedName.length >= 2 && Boolean(slug),
  }
}

function createCompactCenterSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function validateInternalAddCenterName(centerName) {
  const normalizedName = String(centerName || '').trim()

  if (!normalizedName) {
    return 'Vui lòng nhập tên cơ sở.'
  }

  if (normalizedName.length < 2) {
    return 'Tên cơ sở quá ngắn.'
  }

  if (!createCompactCenterSlug(normalizedName)) {
    return 'Tên cơ sở chưa tạo được mã hợp lệ.'
  }

  return ''
}

function ensureInternalCentersListLoading() {
  const userId = cloudStatus.user?.id || ''

  if (
    internalCentersListState.status === 'loading' ||
    (internalCentersListState.status === 'loaded' && internalCentersListState.loadedForUserId === userId) ||
    (internalCentersListState.status === 'error' && internalCentersListState.loadedForUserId === userId)
  ) {
    return
  }

  internalCentersListState = {
    status: 'loading',
    centers: [],
    error: '',
    loadedForUserId: userId,
  }

  void loadInternalCentersList(userId)
}

async function loadInternalCentersList(userId) {
  const runId = ++internalCentersListRunId

  try {
    const supabase = getSupabaseClient()

    if (!supabase) {
      throw new Error('Supabase chưa được cấu hình.')
    }

    const { data, error } = await supabase
      .from('centers')
      .select(INTERNAL_CENTERS_SELECT_FIELDS)
      .eq('environment', 'production')
      .eq('status', 'active')
      .order('name', { ascending: true })

    if (runId !== internalCentersListRunId) {
      return
    }

    if (error) {
      throw error
    }

    internalCentersListState = {
      status: 'loaded',
      centers: normalizeInternalCenters(data),
      error: '',
      loadedForUserId: userId,
    }

    ensureInternalCenterAdminAccountsLoading(userId, internalCentersListState.centers)
  } catch (error) {
    if (runId !== internalCentersListRunId) {
      return
    }

    internalCentersListState = {
      status: 'error',
      centers: [],
      error: getCloudErrorMessage(error, 'Không tải được danh sách cơ sở.'),
      loadedForUserId: userId,
    }
  }

  if (isInternalCenterConsoleRoute()) {
    render()
  }
}

async function handleInternalAddCenterSubmit() {
  const centerBinding = resolveAppCenterBinding(cloudStatus)
  const access = getInternalCenterConsoleAccess(centerBinding)
  const centerName = String(internalAddCenterFormState.name || '').trim()
  const validationError = validateInternalAddCenterName(centerName)

  if (!access.isOwner) {
    internalAddCenterFormState = createInternalAddCenterFormState({
      name: centerName,
      status: 'error',
      error: 'Khu vực này chỉ dành cho owner.',
    })
    render()
    return
  }

  if (validationError) {
    internalAddCenterFormState = {
      ...internalAddCenterFormState,
      name: centerName,
      status: 'error',
      error: validationError,
      success: '',
    }
    render()
    return
  }

  internalAddCenterFormState = {
    ...internalAddCenterFormState,
    name: centerName,
    status: 'submitting',
    error: '',
    success: '',
  }
  render()

  try {
    const supabase = getSupabaseClient()

    if (!supabase) {
      throw new Error('Supabase chưa được cấu hình.')
    }

    const { error } = await supabase.rpc('provision_center_for_owner', {
      p_center_name: centerName,
    })

    if (error) {
      throw error
    }

    internalAddCenterFormState = createInternalAddCenterFormState({
      status: 'success',
      success: `Đã tạo cơ sở ${centerName}.`,
    })

    internalCentersListState = {
      status: 'loading',
      centers: [],
      error: '',
      loadedForUserId: cloudStatus.user?.id || '',
    }

    render()
    await loadInternalCentersList(cloudStatus.user?.id || '')
  } catch (error) {
    internalAddCenterFormState = {
      ...internalAddCenterFormState,
      name: centerName,
      status: 'error',
      error: `Không tạo được cơ sở. ${getInternalAddCenterErrorMessage(error)}`,
      success: '',
    }

    if (isInternalCenterConsoleRoute()) {
      render()
    }
  }
}

function getInternalAddCenterErrorMessage(error) {
  const rawMessage = getCloudErrorMessage(error, 'Vui lòng thử lại hoặc kiểm tra quyền owner.')
  const normalizedMessage = String(rawMessage || '').toLowerCase()

  if (
    normalizedMessage.includes('duplicate') ||
    normalizedMessage.includes('already exists') ||
    normalizedMessage.includes('unique') ||
    normalizedMessage.includes('trùng') ||
    normalizedMessage.includes('ton tai') ||
    normalizedMessage.includes('tồn tại')
  ) {
    return 'Mã cơ sở đã tồn tại hoặc tên cơ sở đã được dùng trong production.'
  }

  return rawMessage
}

function getInternalCenterAccountKey(centers = internalCentersListState.centers) {
  return (Array.isArray(centers) ? centers : [])
    .map((center) => center.id)
    .filter(Boolean)
    .sort()
    .join('|')
}

function ensureInternalCenterAdminAccountsLoading(userId, centers = internalCentersListState.centers) {
  const centerKey = getInternalCenterAccountKey(centers)

  if (!centerKey) {
    internalCenterAdminAccountsState = createInternalCenterAdminAccountsState({
      status: 'loaded',
      loadedForUserId: userId,
      loadedForCenterKey: centerKey,
    })
    return
  }

  if (
    internalCenterAdminAccountsState.status === 'loading' ||
    (
      internalCenterAdminAccountsState.status === 'loaded' &&
      internalCenterAdminAccountsState.loadedForUserId === userId &&
      internalCenterAdminAccountsState.loadedForCenterKey === centerKey
    ) ||
    (
      internalCenterAdminAccountsState.status === 'error' &&
      internalCenterAdminAccountsState.loadedForUserId === userId &&
      internalCenterAdminAccountsState.loadedForCenterKey === centerKey
    )
  ) {
    return
  }

  internalCenterAdminAccountsState = createInternalCenterAdminAccountsState({
    status: 'loading',
    loadedForUserId: userId,
    loadedForCenterKey: centerKey,
  })

  void loadInternalCenterAdminAccounts(userId, centers)
}

async function loadInternalCenterAdminAccounts(userId, centers = internalCentersListState.centers) {
  const runId = ++internalCenterAdminAccountsRunId
  const centerIds = (Array.isArray(centers) ? centers : [])
    .map((center) => center.id)
    .filter(Boolean)
  const centerKey = getInternalCenterAccountKey(centers)

  try {
    const supabase = getSupabaseClient()

    if (!supabase) {
      throw new Error('Supabase chưa được cấu hình.')
    }

    if (!supabase.functions?.invoke) {
      throw new Error('Supabase Functions chưa sẵn sàng.')
    }

    if (!centerIds.length) {
      internalCenterAdminAccountsState = createInternalCenterAdminAccountsState({
        status: 'loaded',
        loadedForUserId: userId,
        loadedForCenterKey: centerKey,
      })
      return
    }

    const { data, error } = await supabase.functions.invoke('list-center-admin-accounts', {
      body: { center_ids: centerIds },
    })

    if (runId !== internalCenterAdminAccountsRunId) {
      return
    }

    if (error) {
      throw error
    }

    if (!data?.ok || data.code !== 'center_admin_accounts_loaded') {
      throw new Error(data?.code || 'Không tải được dữ liệu tài khoản admin.')
    }

    const endpointAdminsByCenterId = normalizeInternalCenterAdminAccounts(data.centers)
    const accountState = mergeInternalAccountSnapshots(
      endpointAdminsByCenterId,
      internalCenterAdminAccountsState.localAccountSnapshotsByCenterId,
    )

    internalCenterAdminAccountsState = createInternalCenterAdminAccountsState({
      ...internalCenterAdminAccountsState,
      status: 'loaded',
      adminsByCenterId: accountState.adminsByCenterId,
      localAccountSnapshotsByCenterId: accountState.localAccountSnapshotsByCenterId,
      loadedForUserId: userId,
      loadedForCenterKey: centerKey,
      copiedCenterId: internalCenterAdminAccountsState.copiedCenterId,
    })
  } catch (error) {
    if (runId !== internalCenterAdminAccountsRunId) {
      return
    }

    internalCenterAdminAccountsState = createInternalCenterAdminAccountsState({
      ...internalCenterAdminAccountsState,
      status: 'error',
      error: getCloudErrorMessage(error, 'Chưa tải được dữ liệu tài khoản admin.'),
      loadedForUserId: userId,
      loadedForCenterKey: centerKey,
    })
  }

  if (isInternalCenterConsoleRoute()) {
    render()
  }
}

function normalizeInternalCenterAdminAccounts(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce((adminsByCenterId, row) => {
    const centerId = String(row?.center_id || row?.centerId || '').trim()
    const admin = row?.admin && typeof row.admin === 'object' ? row.admin : {}

    if (!centerId || adminsByCenterId[centerId]) {
      return adminsByCenterId
    }

    adminsByCenterId[centerId] = normalizeCenterAdminAccount(centerId, admin)

    return adminsByCenterId
  }, {})
}

function normalizeCenterAdminAccount(centerId, admin = {}) {
  const membershipStatus = String(admin?.membership_status || admin?.membershipStatus || admin?.status || '')
    .trim()
    .toLowerCase()
  const state = String(admin?.state || membershipStatus || '')
    .trim()
    .toLowerCase()
  const isRevoked = Boolean(admin?.is_revoked || admin?.isRevoked || membershipStatus === 'revoked' || state === 'revoked')
  const isActive = Boolean(admin?.is_active || admin?.isActive || membershipStatus === 'active' || state === 'active')
  const email = String(admin?.email || '').trim()
  const exists = Boolean(admin?.exists || email || isActive || isRevoked)

  return {
      centerId,
      exists,
      userId: String(admin?.user_id || ''),
      role: 'center_admin',
      status: membershipStatus,
      email,
      state: isRevoked ? 'revoked' : isActive ? 'active' : state,
      isActive,
      isRevoked,
      canRestore: Boolean(admin?.can_restore || admin?.canRestore || isRevoked),
      source: String(admin?.source || ''),
    }
}

function hasDurableInternalAccountLifecycle(account) {
  return ['active', 'revoked', 'multiple_active_admins', 'email_unavailable'].includes(account?.state) ||
    ['active', 'revoked'].includes(account?.status)
}

function mergeInternalAccountSnapshots(endpointAdminsByCenterId = {}, localSnapshotsByCenterId = {}) {
  const adminsByCenterId = { ...endpointAdminsByCenterId }
  const nextLocalSnapshotsByCenterId = { ...localSnapshotsByCenterId }

  Object.entries(localSnapshotsByCenterId).forEach(([centerId, localAccount]) => {
    const endpointAccount = endpointAdminsByCenterId[centerId]

    if (hasDurableInternalAccountLifecycle(endpointAccount)) {
      delete nextLocalSnapshotsByCenterId[centerId]
      return
    }

    if (localAccount?.state === 'revoked' || localAccount?.status === 'revoked') {
      adminsByCenterId[centerId] = localAccount
    }
  })

  return {
    adminsByCenterId,
    localAccountSnapshotsByCenterId: nextLocalSnapshotsByCenterId,
  }
}

function getExpectedInternalAdminEmail(center) {
  const slug = String(center?.slug || '').trim().toLowerCase()

  return slug ? `admin.${slug}@ichess.vn` : ''
}

function getInternalAccountCreateTarget(centerId) {
  const center = getInternalCenterById(centerId)
  const adminAccount = internalCenterAdminAccountsState.adminsByCenterId[String(centerId || '').trim()] || null
  const adminLoaded = internalCenterAdminAccountsState.status === 'loaded'
  const canCreate = Boolean(
    center &&
      center.environment === 'production' &&
      center.status === 'active' &&
      adminLoaded &&
      adminAccount?.exists === false,
  )

  if (!canCreate) {
    return null
  }

  return {
    centerId: center.id,
    centerName: center.name || center.id,
    expectedEmail: getExpectedInternalAdminEmail(center),
    displayName: `Admin ${center.name || center.slug || center.id}`,
  }
}

function openInternalCreateAdminConfirm(centerId) {
  const target = getInternalAccountCreateTarget(centerId)

  if (!target?.expectedEmail) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      createStatus: 'error',
      createCenterId: '',
      createError: 'Cơ sở này chưa sẵn sàng để tạo admin.',
      createConfirm: null,
    }
    render()
    return
  }

  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    createStatus: 'confirming',
    createCenterId: target.centerId,
    createError: '',
    createConfirm: target,
    handoffCopyMessage: '',
  }
  render()
}

function closeInternalCreateAdminConfirm() {
  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    createStatus: 'idle',
    createCenterId: '',
    createError: '',
    createConfirm: null,
  }
  render()
}

async function handleInternalCreateAdminAccount() {
  const target = internalCenterAdminAccountsState.createConfirm
  if (!target?.centerId) {
    return
  }

  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    createStatus: 'submitting',
    createCenterId: target.centerId,
    createError: '',
  }
  render()

  try {
    const supabase = getSupabaseClient()

    if (!supabase?.functions?.invoke) {
      throw new Error('Supabase Functions chưa sẵn sàng.')
    }

    const { data, error } = await supabase.functions.invoke('provision-center-admin-account', {
      body: {
        center_id: target.centerId,
        idempotency_key: createInternalCreateAdminIdempotencyKey(target.centerId),
        display_name: target.displayName,
      },
    })

    if (error) {
      throw error
    }

    if (!data?.ok || data.code !== 'center_admin_created' || !data.temporary_password || !data.email) {
      throw new Error(data?.code || 'Không tạo được admin cơ sở.')
    }

    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      createStatus: 'success',
      createCenterId: '',
      createError: '',
      createConfirm: null,
      adminsByCenterId: {
        ...internalCenterAdminAccountsState.adminsByCenterId,
        [target.centerId]: {
          centerId: target.centerId,
          exists: true,
          userId: '',
          role: 'center_admin',
          status: 'active',
          email: data.email,
          state: 'active',
        },
      },
      handoff: {
        kind: 'create',
        centerId: target.centerId,
        centerName: target.centerName,
        email: data.email,
        temporaryPassword: data.temporary_password,
        auditId: data.audit_id || '',
      },
      handoffCopyMessage: '',
    }
    render()
    void loadInternalCenterAdminAccounts(cloudStatus.user?.id || '', internalCentersListState.centers)
  } catch (error) {
    const errorMessage = getInternalCreateAdminErrorMessage(error)
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      createStatus: 'error',
      createCenterId: target.centerId,
      createError: errorMessage,
    }
    render()

    if (String(errorMessage).includes('Đang tải lại trạng thái tài khoản')) {
      void loadInternalCenterAdminAccounts(cloudStatus.user?.id || '', internalCentersListState.centers)
    }
  }
}

function createInternalCreateAdminIdempotencyKey(centerId) {
  return `c7-8d-create-admin-${centerId}-${Date.now()}`
}

function getInternalCreateAdminErrorMessage(error) {
  const rawMessage = getCloudErrorMessage(error, 'Không tạo được admin cơ sở.')
  const normalizedMessage = String(rawMessage || '').toLowerCase()

  if (normalizedMessage.includes('center_admin_already_exists')) {
    return 'Cơ sở này đã có admin. Đang tải lại trạng thái tài khoản.'
  }

  if (normalizedMessage.includes('admin_email_already_used')) {
    return 'Email admin dự kiến đã được dùng. Vui lòng kiểm tra trạng thái tài khoản.'
  }

  if (normalizedMessage.includes('forbidden_owner_required')) {
    return 'Chỉ owner active của cơ sở mới được tạo admin.'
  }

  if (normalizedMessage.includes('center_not_production_active')) {
    return 'Chỉ cơ sở production active mới được tạo admin.'
  }

  if (normalizedMessage.includes('duplicate_request_already_processed')) {
    return 'Yêu cầu này đã được xử lý trước đó. Vì an toàn, mật khẩu tạm không thể hiển thị lại. Hãy tạo yêu cầu mới nếu cần.'
  }

  return rawMessage
}

function getInternalAccountResetTarget(centerId) {
  const center = getInternalCenterById(centerId)
  const adminAccount = internalCenterAdminAccountsState.adminsByCenterId[String(centerId || '').trim()] || null
  const email = String(adminAccount?.email || '').trim()

  if (!center || !adminAccount?.exists || !email) {
    return null
  }

  return {
    centerId: center.id,
    centerName: center.name || center.id,
    email,
  }
}

function openInternalResetPasswordConfirm(centerId) {
  const target = getInternalAccountResetTarget(centerId)

  if (!target) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      resetStatus: 'error',
      resetCenterId: '',
      resetError: 'Chưa có email admin để tạo mật khẩu tạm mới.',
      resetConfirm: null,
    }
    render()
    return
  }

  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    resetStatus: 'confirming',
    resetCenterId: target.centerId,
    resetError: '',
    resetConfirm: target,
    handoffCopyMessage: '',
  }
  render()
}

function closeInternalResetPasswordConfirm() {
  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    resetStatus: 'idle',
    resetCenterId: '',
    resetError: '',
    resetConfirm: null,
  }
  render()
}

async function handleInternalResetAdminPassword() {
  const target = internalCenterAdminAccountsState.resetConfirm
  if (!target?.centerId || !target?.email) {
    return
  }

  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    resetStatus: 'submitting',
    resetCenterId: target.centerId,
    resetError: '',
  }
  render()

  try {
    const supabase = getSupabaseClient()

    if (!supabase?.functions?.invoke) {
      throw new Error('Supabase Functions chưa sẵn sàng.')
    }

    const { data, error } = await supabase.functions.invoke('reset-center-admin-password', {
      body: {
        center_id: target.centerId,
        target_email: target.email,
        idempotency_key: createInternalResetPasswordIdempotencyKey(target.centerId),
        reason: 'owner_ui_temporary_password_reset',
      },
    })

    if (error) {
      throw error
    }

    if (!data?.ok || data.code !== 'center_admin_password_reset' || !data.temporary_password) {
      throw new Error(data?.code || 'Không tạo được mật khẩu tạm mới.')
    }

    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      resetStatus: 'success',
      resetCenterId: '',
      resetError: '',
      resetConfirm: null,
      handoff: {
        kind: 'reset',
        centerId: target.centerId,
        centerName: target.centerName,
        email: data.email || target.email,
        temporaryPassword: data.temporary_password,
        auditId: data.audit_id || '',
      },
      handoffCopyMessage: '',
    }
    render()
  } catch (error) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      resetStatus: 'error',
      resetCenterId: target.centerId,
      resetError: getInternalResetPasswordErrorMessage(error),
    }
    render()
  }
}

function createInternalResetPasswordIdempotencyKey(centerId) {
  return `c7-8c-reset-${centerId}-${Date.now()}`
}

function getInternalResetPasswordErrorMessage(error) {
  const rawMessage = getCloudErrorMessage(error, 'Không tạo được mật khẩu tạm mới.')
  const normalizedMessage = String(rawMessage || '').toLowerCase()

  if (normalizedMessage.includes('duplicate_request_already_processed')) {
    return 'Yêu cầu này đã được xử lý trước đó. Vì an toàn, mật khẩu tạm không thể hiển thị lại. Hãy tạo yêu cầu reset mới nếu cần.'
  }

  if (normalizedMessage.includes('forbidden_owner_required')) {
    return 'Chỉ owner active của cơ sở mới được tạo mật khẩu tạm mới.'
  }

  if (normalizedMessage.includes('target_center_admin_not_found')) {
    return 'Không tìm thấy admin cơ sở cần reset.'
  }

  if (normalizedMessage.includes('password_reset_audit_failed_manual_reset_required')) {
    return 'Reset chưa hoàn tất an toàn vì audit lỗi. Không bàn giao mật khẩu; hãy kiểm tra backend trước khi thử lại.'
  }

  return rawMessage
}

function isInternalAccountLiveAllowedCenter(centerId) {
  return ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS.has(String(centerId || '').trim())
}

function canLiveRevokeInternalAccount(target) {
  return Boolean(
    ACCOUNT_REVOKE_LIVE_ACTIONS_ENABLED &&
      target?.centerId &&
      target?.email &&
      isInternalAccountLiveAllowedCenter(target.centerId),
  )
}

function canLiveRestoreInternalAccount(target) {
  return Boolean(
    ACCOUNT_RESTORE_LIVE_ACTIONS_ENABLED &&
      target?.centerId &&
      target?.email &&
      isInternalAccountLiveAllowedCenter(target.centerId),
  )
}

function getInternalAccountRecord(centerId) {
  const normalizedCenterId = String(centerId || '').trim()
  return internalCenterAdminAccountsState.adminsByCenterId[normalizedCenterId] ||
    internalCenterAdminAccountsState.localAccountSnapshotsByCenterId[normalizedCenterId] ||
    null
}

function getInternalAccountRevokeTarget(centerId) {
  const center = getInternalCenterById(centerId)
  const adminAccount = getInternalAccountRecord(centerId)
  const email = String(adminAccount?.email || '').trim()

  if (!center || !adminAccount?.exists || !email) {
    return null
  }

  return {
    centerId: center.id,
    centerName: center.name || center.id,
    email,
  }
}

function getInternalAccountRestoreTarget(centerId) {
  const center = getInternalCenterById(centerId)
  const adminAccount = getInternalAccountRecord(centerId)
  const email = String(adminAccount?.email || '').trim()

  if (
    !center ||
    !email ||
    !(
      adminAccount?.state === 'revoked' ||
      adminAccount?.status === 'revoked' ||
      adminAccount?.isRevoked ||
      adminAccount?.canRestore
    )
  ) {
    return null
  }

  return {
    centerId: center.id,
    centerName: center.name || center.id,
    email,
    auditId: adminAccount.auditId || '',
  }
}

function openInternalRevokeAccessConfirm(centerId) {
  const target = getInternalAccountRevokeTarget(centerId)

  if (!target) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      revokeStatus: 'error',
      revokeCenterId: '',
      revokeError: 'Không có admin cơ sở để thu hồi quyền.',
      revokeConfirm: null,
      revokeTypedConfirmation: '',
      revokeRiskAcknowledged: false,
    }
    render()
    return
  }

  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    revokeStatus: 'confirming',
    revokeCenterId: target.centerId,
    revokeError: '',
    revokeConfirm: target,
    revokeTypedConfirmation: '',
    revokeRiskAcknowledged: false,
    handoffCopyMessage: '',
  }
  render()
}

function openInternalRestoreAccessConfirm(centerId) {
  const target = getInternalAccountRestoreTarget(centerId)

  if (!target) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      restoreStatus: 'error',
      restoreCenterId: '',
      restoreError: 'Chỉ có thể khôi phục khi quyền admin đang bị thu hồi.',
      restoreConfirm: null,
      restoreTypedConfirmation: '',
    }
    render()
    return
  }

  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    restoreStatus: 'confirming',
    restoreCenterId: target.centerId,
    restoreError: '',
    restoreConfirm: target,
    restoreTypedConfirmation: '',
  }
  render()
}

function closeInternalRevokeAccessConfirm() {
  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    revokeStatus: 'idle',
    revokeCenterId: '',
    revokeError: '',
    revokeConfirm: null,
    revokeTypedConfirmation: '',
    revokeRiskAcknowledged: false,
  }
  render()
}

function closeInternalRestoreAccessConfirm() {
  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    restoreStatus: 'idle',
    restoreCenterId: '',
    restoreError: '',
    restoreConfirm: null,
    restoreTypedConfirmation: '',
  }
  render()
}

function acknowledgeInternalRevokeRisk() {
  if (!internalCenterAdminAccountsState.revokeConfirm) {
    return
  }

  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    revokeRiskAcknowledged: true,
    revokeError: '',
  }
  render()
}

function updateInternalRevokeTypedConfirmation(value) {
  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    revokeTypedConfirmation: String(value || ''),
  }

  syncInternalAccountAccessFinalButtons()
}

function updateInternalRestoreTypedConfirmation(value) {
  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    restoreTypedConfirmation: String(value || ''),
  }

  syncInternalAccountAccessFinalButtons()
}

function syncInternalAccountAccessFinalButtons() {
  const revokeButton = document.querySelector('[data-internal-revoke-confirm]')
  if (revokeButton) {
    revokeButton.disabled = !(
      canLiveRevokeInternalAccount(internalCenterAdminAccountsState.revokeConfirm) &&
      internalCenterAdminAccountsState.revokeRiskAcknowledged &&
      internalCenterAdminAccountsState.revokeTypedConfirmation === 'REVOKE' &&
      internalCenterAdminAccountsState.revokeStatus !== 'submitting'
    )
  }

  const restoreButton = document.querySelector('[data-internal-restore-confirm]')
  if (restoreButton) {
    restoreButton.disabled = !(
      canLiveRestoreInternalAccount(internalCenterAdminAccountsState.restoreConfirm) &&
      internalCenterAdminAccountsState.restoreTypedConfirmation === 'RESTORE' &&
      internalCenterAdminAccountsState.restoreStatus !== 'submitting'
    )
  }
}

async function handleInternalRevokeAdminAccess() {
  const target = internalCenterAdminAccountsState.revokeConfirm
  if (!target?.centerId || !target?.email) {
    return
  }

  if (!canLiveRevokeInternalAccount(target)) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      revokeStatus: 'blocked',
      revokeError: 'Thao tác thu hồi quyền cho cơ sở này chưa được bật. Vui lòng dùng cơ sở kiểm thử trước hoặc xác nhận riêng trước khi thao tác.',
    }
    render()
    return
  }

  if (
    internalCenterAdminAccountsState.revokeTypedConfirmation !== 'REVOKE' ||
    !internalCenterAdminAccountsState.revokeRiskAcknowledged
  ) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      revokeStatus: 'error',
      revokeError: 'Cần nhập REVOKE và xác nhận đã hiểu rủi ro trước khi thu hồi quyền.',
    }
    render()
    return
  }

  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    revokeStatus: 'submitting',
    revokeCenterId: target.centerId,
    revokeError: '',
  }
  render()

  try {
    const supabase = getSupabaseClient()

    if (!supabase?.functions?.invoke) {
      throw new Error('Supabase Functions chưa sẵn sàng.')
    }

    const { data, error } = await supabase.functions.invoke('revoke-center-admin-access', {
      body: {
        center_id: target.centerId,
        target_email: target.email,
        idempotency_key: createInternalRevokeAccessIdempotencyKey(target.centerId),
        reason: 'owner_ui_controlled_revoke_center_admin_access',
        disable_auth_user: false,
      },
    })

    if (error) {
      throw error
    }

    if (!data?.ok || data.code !== 'center_admin_access_revoked') {
      throw new Error(data?.code || 'Không thu hồi được quyền admin cơ sở.')
    }

    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      revokeStatus: 'success',
      revokeCenterId: '',
      revokeError: '',
      revokeConfirm: null,
      revokeTypedConfirmation: '',
      revokeRiskAcknowledged: false,
      copyMessage: 'Đã thu hồi quyền admin cơ sở.',
      localAccountSnapshotsByCenterId: {
        ...internalCenterAdminAccountsState.localAccountSnapshotsByCenterId,
        [target.centerId]: {
          centerId: target.centerId,
          exists: false,
          userId: '',
          role: 'center_admin',
          status: 'revoked',
          email: data.email || target.email,
          state: 'revoked',
          auditId: data.audit_id || '',
        },
      },
      adminsByCenterId: {
        ...internalCenterAdminAccountsState.adminsByCenterId,
        [target.centerId]: {
          centerId: target.centerId,
          exists: false,
          userId: '',
          role: 'center_admin',
          status: 'revoked',
          email: data.email || target.email,
          state: 'revoked',
          auditId: data.audit_id || '',
        },
      },
    }
    render()
    void loadInternalCenterAdminAccounts(cloudStatus.user?.id || '', internalCentersListState.centers)
  } catch (error) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      revokeStatus: 'error',
      revokeCenterId: target.centerId,
      revokeError: getCloudErrorMessage(error, 'Không thu hồi được quyền admin cơ sở.'),
    }
    render()
  }
}

function createInternalRevokeAccessIdempotencyKey(centerId) {
  return `c7-8g-ui-revoke-${centerId}-${Date.now()}`
}

async function handleInternalRestoreAdminAccess() {
  const target = internalCenterAdminAccountsState.restoreConfirm
  if (!target?.centerId || !target?.email) {
    return
  }

  if (!canLiveRestoreInternalAccount(target)) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      restoreStatus: 'blocked',
      restoreError: 'Thao tác khôi phục quyền cho cơ sở này chưa được bật.',
    }
    render()
    return
  }

  if (internalCenterAdminAccountsState.restoreTypedConfirmation !== 'RESTORE') {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      restoreStatus: 'error',
      restoreError: 'Cần nhập RESTORE để xác nhận khôi phục quyền.',
    }
    render()
    return
  }

  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    restoreStatus: 'submitting',
    restoreCenterId: target.centerId,
    restoreError: '',
  }
  render()

  try {
    const supabase = getSupabaseClient()

    if (!supabase?.functions?.invoke) {
      throw new Error('Supabase Functions chưa sẵn sàng.')
    }

    const { data, error } = await supabase.functions.invoke('restore-center-admin-access', {
      body: {
        center_id: target.centerId,
        target_email: target.email,
        idempotency_key: createInternalRestoreAccessIdempotencyKey(target.centerId),
        reason: 'owner_ui_controlled_restore_center_admin_access',
      },
    })

    if (error) {
      throw error
    }

    if (!data?.ok || !['center_admin_access_restored', 'center_admin_access_already_active'].includes(data.code)) {
      throw new Error(data?.code || 'Không khôi phục được quyền admin cơ sở.')
    }

    const nextLocalSnapshots = { ...internalCenterAdminAccountsState.localAccountSnapshotsByCenterId }
    delete nextLocalSnapshots[target.centerId]

    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      restoreStatus: 'success',
      restoreCenterId: '',
      restoreError: '',
      restoreConfirm: null,
      restoreTypedConfirmation: '',
      copyMessage: 'Đã khôi phục quyền admin cơ sở.',
      localAccountSnapshotsByCenterId: nextLocalSnapshots,
      adminsByCenterId: {
        ...internalCenterAdminAccountsState.adminsByCenterId,
        [target.centerId]: {
          centerId: target.centerId,
          exists: true,
          userId: '',
          role: 'center_admin',
          status: 'active',
          email: data.email || target.email,
          state: 'active',
          auditId: data.audit_id || '',
        },
      },
    }
    render()
    void loadInternalCenterAdminAccounts(cloudStatus.user?.id || '', internalCentersListState.centers)
  } catch (error) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      restoreStatus: 'error',
      restoreCenterId: target.centerId,
      restoreError: getCloudErrorMessage(error, 'Không khôi phục được quyền admin cơ sở.'),
    }
    render()
  }
}

function createInternalRestoreAccessIdempotencyKey(centerId) {
  return `c7-8g-ui-restore-${centerId}-${Date.now()}`
}

function closeInternalPasswordHandoff() {
  const shouldRefreshAccountStatus = internalCenterAdminAccountsState.handoff?.kind === 'create'

  internalCenterAdminAccountsState = {
    ...internalCenterAdminAccountsState,
    handoff: null,
    handoffCopyMessage: '',
    resetStatus: 'idle',
    resetCenterId: '',
    resetError: '',
    createStatus: 'idle',
    createCenterId: '',
    createError: '',
  }
  render()

  if (shouldRefreshAccountStatus) {
    void loadInternalCenterAdminAccounts(cloudStatus.user?.id || '', internalCentersListState.centers)
  }
}

function getInternalAccountLoginLink() {
  const basePath = `${window.location.origin}${window.location.pathname}`
  return basePath.endsWith('/') ? basePath : `${basePath}/`
}

function buildInternalPasswordHandoffText(handoff) {
  return [
    `Tài khoản quản lý cơ sở ${handoff.centerName}`,
    `Email: ${handoff.email}`,
    `Mật khẩu tạm: ${handoff.temporaryPassword}`,
    `Link đăng nhập: ${getInternalAccountLoginLink()}`,
  ].join('\n')
}

async function copyInternalAccountText(value, successMessage) {
  const text = String(value || '')

  if (!text || !navigator.clipboard?.writeText) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      handoffCopyMessage: 'Không copy được, hãy chọn và copy thủ công.',
    }
    render()
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      handoffCopyMessage: successMessage || 'Đã copy.',
    }
    render()
  } catch (error) {
    internalCenterAdminAccountsState = {
      ...internalCenterAdminAccountsState,
      handoffCopyMessage: 'Không copy được, hãy chọn và copy thủ công.',
    }
    render()
    console.warn('Không copy được handoff tài khoản cơ sở.', error)
  }
}

function getInternalCenterById(centerId) {
  const normalizedCenterId = String(centerId || '').trim()
  return internalCentersListState.centers.find((center) => center.id === normalizedCenterId) || null
}

function getActiveMembershipForInternalCenter(centerId) {
  const normalizedCenterId = String(centerId || '').trim()
  const memberships = Array.isArray(cloudStatus.memberships) ? cloudStatus.memberships : []

  return memberships.find((membership) =>
    String(membership?.center_id || '').trim() === normalizedCenterId &&
    String(membership?.status || '').toLowerCase() === 'active'
  ) || null
}

function canOpenInternalCenter(center) {
  const centerBinding = resolveAppCenterBinding(cloudStatus)
  const access = getInternalCenterConsoleAccess(centerBinding)

  return Boolean(
    access.isOwner &&
      center &&
      center.id &&
      center.environment === 'production' &&
      center.status === 'active' &&
      getActiveMembershipForInternalCenter(center.id),
  )
}

function resetCloudRuntimeStateForOwnerCenterSwitch() {
  stopStudentRealtimeSubscription()
  stopTeacherRealtimeSubscription()
  stopScheduleSessionRealtimeSubscription()
  stopC51AttendanceRealtimeSubscription()
  stopC52TuitionRealtimeSubscription()
  cloudDbState = createInitialCloudDbState()
  cloudBootstrapState = createInitialCloudBootstrapState()
  cloudDbAutoPullUserId = ''
  c51AttendanceAutoPullUserId = ''
  c52TuitionAutoPullUserId = ''
  c52AttendanceRetryCommands.clear()
  c51AttendanceCloudWriteRunId += 1
  c52TuitionCloudWriteRunId += 1
  cloudBootstrapRetryBlockedUntil = 0
  cloudBootstrapLastFailureSignature = ''
  transactionImageManagerState = null
  cloudGalleryState = null
  reportTransactionDrilldownState = null
  reportTransactionDrilldownToken += 1
  cashflowTransactionDetailState = null
  cashflowTransactionDetailHydrateToken += 1
  isCenterProfilePopoverOpen = false
}

async function handleInternalOpenCenter(centerId) {
  const normalizedCenterId = String(centerId || '').trim()
  const center = getInternalCenterById(normalizedCenterId)
  const membership = getActiveMembershipForInternalCenter(normalizedCenterId)

  if (!center || !canOpenInternalCenter(center) || !membership) {
    internalCenterSwitchState = createInternalCenterSwitchState({
      status: 'error',
      centerId: normalizedCenterId,
      error: 'Chỉ owner có active membership của cơ sở production active mới được mở OS cơ sở.',
    })
    render()
    return
  }

  const switchSyncId = ++cloudUserSyncId

  internalCenterSwitchState = createInternalCenterSwitchState({
    status: 'switching',
    centerId: normalizedCenterId,
  })
  resetCloudRuntimeStateForOwnerCenterSwitch()
  setCurrentStorageCenterId(normalizedCenterId)
  reloadLocalDataForResolvedCenter()
  cloudStatus = {
    ...cloudStatus,
    centerId: normalizedCenterId,
    centerName: center.name || normalizedCenterId,
    membership,
    role: normalizeOnlineRole(membership.role ?? cloudStatus.role),
    membershipStatus: 'loaded',
    message: '',
    attachments: [],
    attachmentsStatus: 'loading',
    attachmentsError: '',
    attachmentsMonthKey: getCurrentMonthKey(),
    profileStatus: 'idle',
    profileMessage: '',
    profileMessageTone: '',
  }
  internalCenterSwitchState = createInternalCenterSwitchState()
  window.location.hash = ''
  render()

  await bootstrapCoreCloudDataForCurrentCenter(switchSyncId)

  if (cloudUserSyncId !== switchSyncId || cloudStatus.membershipStatus !== 'loaded') {
    return
  }

  await refreshParentStudentLinksSharedTruth({ reason: 'capability-probe' })
  await loadCenterMemberProfiles(switchSyncId)
  await loadCurrentMonthCloudAttachments(switchSyncId)
  await startStudentRealtimeSubscription(switchSyncId)
  await startTeacherRealtimeSubscription(switchSyncId)
  await startScheduleSessionRealtimeSubscription(switchSyncId)
}

function normalizeInternalCenters(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: String(row?.id || ''),
    name: String(row?.name || ''),
    slug: String(row?.slug || ''),
    environment: String(row?.environment || ''),
    status: String(row?.status || ''),
    createdAt: String(row?.created_at || ''),
    updatedAt: String(row?.updated_at || ''),
  }))
}

function renderInternalCenterAccountManagement() {
  if (internalCentersListState.status === 'loading' || internalCentersListState.status === 'idle') {
    return `
      <section class="internal-account-management" aria-labelledby="internal-account-management-title">
        <div class="internal-account-management-header">
          <h2 id="internal-account-management-title">Quản lý tài khoản cơ sở</h2>
          <span>Owner ops</span>
        </div>
        <p class="internal-console-state" role="status">Đang chờ danh sách cơ sở production active...</p>
      </section>
    `
  }

  if (internalCentersListState.status === 'error') {
    return ''
  }

  ensureInternalCenterAdminAccountsLoading(cloudStatus.user?.id || '', internalCentersListState.centers)

  return `
    <section class="internal-account-management" aria-labelledby="internal-account-management-title">
      <div class="internal-account-management-header">
        <div>
          <h2 id="internal-account-management-title">Quản lý tài khoản cơ sở</h2>
          <p>Anh Hải có thể tạo hoặc đổi mật khẩu tạm cho admin cơ sở ở bước tiếp theo. Mật khẩu tạm chỉ hiển thị một lần để copy bàn giao.</p>
        </div>
        <span>Owner ops</span>
      </div>
      ${renderInternalCenterAccountStatusNote()}
      ${internalCentersListState.centers.length
        ? `<div class="internal-account-card-list">
            ${internalCentersListState.centers.map(renderInternalCenterAccountCard).join('')}
          </div>`
        : '<p class="internal-console-state">Chưa có cơ sở production active để quản lý tài khoản.</p>'}
      ${renderInternalCreateAdminConfirm()}
      ${renderInternalResetPasswordConfirm()}
      ${renderInternalRevokeAccessConfirm()}
      ${renderInternalRestoreAccessConfirm()}
      ${renderInternalPasswordHandoffCard()}
    </section>
  `
}

function renderInternalCenterAccountStatusNote() {
  if (internalCenterAdminAccountsState.status === 'loading' || internalCenterAdminAccountsState.status === 'idle') {
    return '<p class="internal-console-state" role="status">Đang tải dữ liệu tài khoản admin qua quyền đọc hiện có...</p>'
  }

  if (internalCenterAdminAccountsState.status === 'error') {
    return `
      <p class="internal-console-state is-warning" role="status">
        Không tải được dữ liệu tài khoản admin. Vui lòng kiểm tra kết nối hoặc thử lại sau.
      </p>
    `
  }

  return '<p class="internal-console-state is-muted">Tạo admin chỉ bật cho cơ sở đang hoạt động chưa có admin. Tạo mật khẩu tạm và thu hồi quyền chỉ bật khi cơ sở đã có admin.</p>'
}

function renderInternalCenterAccountCard(center) {
  const adminAccount = getInternalAccountRecord(center.id)
  const isFocusedAccount = Boolean(
    pendingInternalAccountUserId &&
    adminAccount?.userId === pendingInternalAccountUserId,
  )
  const hasAdmin = adminAccount?.exists === true
  const isRevokedAdmin = Boolean(adminAccount?.isRevoked || adminAccount?.state === 'revoked' || adminAccount?.status === 'revoked')
  const adminEmail = adminAccount?.email || ''
  const adminLabel = getInternalCenterAdminLabel(adminAccount)
  const accountStatus = getInternalCenterAccountStatus(adminAccount)
  const copied = internalCenterAdminAccountsState.copiedCenterId === center.id
  const resetEnabled = Boolean(hasAdmin && adminEmail && !isRevokedAdmin)
  const isResetting = internalCenterAdminAccountsState.resetStatus === 'submitting' &&
    internalCenterAdminAccountsState.resetCenterId === center.id
  const createEnabled = Boolean(
    center.environment === 'production' &&
      center.status === 'active' &&
      internalCenterAdminAccountsState.status === 'loaded' &&
      adminAccount?.exists === false &&
      !isRevokedAdmin,
  )
  const isCreating = internalCenterAdminAccountsState.createStatus === 'submitting' &&
    internalCenterAdminAccountsState.createCenterId === center.id
  const createButtonLabel = isCreating
    ? 'Đang tạo admin...'
    : hasAdmin
      ? 'Đã có admin'
      : createEnabled ? 'Tạo admin' : 'Chưa sẵn sàng'
  const revokeEnabled = Boolean(hasAdmin && adminEmail && !isRevokedAdmin)
  const restoreEnabled = Boolean(isRevokedAdmin && adminEmail && canLiveRestoreInternalAccount({
    centerId: center.id,
    email: adminEmail,
  }))
  const revokeButtonLabel = restoreEnabled
    ? 'Đã thu hồi quyền'
    : revokeEnabled ? 'Thu hồi quyền' : 'Không có admin'

  return `
    <article class="internal-account-card ${isFocusedAccount ? 'is-focused-account' : ''}" ${isFocusedAccount ? 'data-internal-account-focused tabindex="-1"' : ''}>
      <div class="internal-account-card-title">
        <h3>${escapeHtml(center.name || center.id)}</h3>
        <span class="${hasAdmin ? 'is-ready' : 'is-pending'}">${escapeHtml(accountStatus)}</span>
      </div>
      <dl class="internal-account-meta">
        <div>
          <dt>Mã cơ sở</dt>
          <dd><code>${escapeHtml(center.id)}</code></dd>
        </div>
        <div>
          <dt>Slug</dt>
          <dd>${escapeHtml(center.slug || '-')}</dd>
        </div>
        <div>
          <dt>Môi trường</dt>
          <dd>${escapeHtml(center.environment || '-')}</dd>
        </div>
        <div>
          <dt>Trạng thái</dt>
          <dd>${escapeHtml(center.status || '-')}</dd>
        </div>
        <div>
          <dt>Admin cơ sở</dt>
          <dd class="internal-account-email">${escapeHtml(adminLabel)}</dd>
        </div>
        <div>
          <dt>Trạng thái tài khoản</dt>
          <dd>${escapeHtml(accountStatus)}</dd>
        </div>
      </dl>
      <div class="internal-account-actions" aria-label="Hành động tài khoản cơ sở">
        <button
          type="button"
          class="internal-account-create"
          data-internal-create-admin-center-id="${escapeAttribute(center.id)}"
          ${createEnabled && !isCreating ? '' : 'disabled'}
        >
          ${escapeHtml(createButtonLabel)}
        </button>
        <button
          type="button"
          class="internal-account-reset"
          data-internal-reset-admin-center-id="${escapeAttribute(center.id)}"
          ${resetEnabled && !isResetting ? '' : 'disabled'}
        >
          ${isResetting ? 'Đang tạo mật khẩu tạm...' : 'Tạo mật khẩu tạm mới'}
        </button>
        <button
          type="button"
          class="internal-account-revoke"
          data-internal-revoke-admin-center-id="${escapeAttribute(center.id)}"
          ${revokeEnabled ? '' : 'disabled'}
        >
          ${escapeHtml(revokeButtonLabel)}
        </button>
        <button
          type="button"
          class="internal-account-restore"
          data-internal-restore-admin-center-id="${escapeAttribute(center.id)}"
          ${restoreEnabled ? '' : 'disabled'}
        >
          ${restoreEnabled ? 'Khôi phục quyền' : 'Khôi phục quyền'}
        </button>
        <button
          type="button"
          class="internal-account-copy"
          data-internal-copy-admin-email="${escapeAttribute(adminEmail)}"
          data-internal-copy-admin-center-id="${escapeAttribute(center.id)}"
          ${adminEmail ? '' : 'disabled'}
        >
          ${copied ? 'Đã copy email' : 'Copy email'}
        </button>
      </div>
      ${internalCenterAdminAccountsState.copyMessage ? `
        <p class="internal-account-copy-message" role="status">${escapeHtml(internalCenterAdminAccountsState.copyMessage)}</p>
      ` : ''}
      ${isRevokedAdmin ? `
        <p class="internal-account-copy-message" role="status">
          ${restoreEnabled
            ? 'Admin này hiện không còn quyền truy cập cơ sở. Có thể khôi phục quyền nếu cần.'
            : 'Admin này hiện không còn quyền truy cập cơ sở. Thao tác khôi phục cho cơ sở này chưa được bật.'}
        </p>
      ` : ''}
    </article>
  `
}

function renderInternalRevokeAccessConfirm() {
  const confirm = internalCenterAdminAccountsState.revokeConfirm
  const isSubmitting = internalCenterAdminAccountsState.revokeStatus === 'submitting'
  const typedValue = internalCenterAdminAccountsState.revokeTypedConfirmation
  const liveAllowed = canLiveRevokeInternalAccount(confirm)
  const finalRevokeEnabled = Boolean(
    liveAllowed &&
      internalCenterAdminAccountsState.revokeRiskAcknowledged &&
      typedValue === 'REVOKE' &&
      !isSubmitting,
  )

  if (!confirm && !internalCenterAdminAccountsState.revokeError) {
    return ''
  }

  if (!confirm && internalCenterAdminAccountsState.revokeError) {
    return `
      <div class="internal-account-revoke-panel is-error" role="alert">
        <strong>Không mở được thu hồi quyền</strong>
        <p>${escapeHtml(internalCenterAdminAccountsState.revokeError)}</p>
      </div>
    `
  }

  return `
    <div class="internal-account-revoke-modal" role="presentation">
      <div class="internal-account-revoke-window" role="dialog" aria-modal="true" aria-labelledby="internal-revoke-title">
        <div class="internal-account-revoke-heading">
          <div>
            <h3 id="internal-revoke-title">Thu hồi quyền admin cơ sở</h3>
            <p>Thao tác này dùng để rút quyền truy cập của admin khỏi một cơ sở. Dữ liệu cơ sở không bị xóa.</p>
          </div>
          <span>${liveAllowed ? 'Đã bật cho cơ sở này' : 'Chưa bật thao tác thật'}</span>
          <button
            type="button"
            class="internal-account-revoke-close"
            data-internal-revoke-cancel
            aria-label="Đóng cửa sổ thu hồi quyền"
            ${isSubmitting ? 'disabled' : ''}
          >
            ×
          </button>
        </div>
        <dl class="internal-account-revoke-details">
          <div>
            <dt>Cơ sở</dt>
            <dd>${escapeHtml(confirm.centerName)}</dd>
          </div>
          <div>
            <dt>Mã cơ sở</dt>
            <dd><code>${escapeHtml(confirm.centerId)}</code></dd>
          </div>
          <div>
            <dt>Admin</dt>
            <dd class="internal-account-email">${escapeHtml(confirm.email)}</dd>
          </div>
        </dl>
        <ul class="internal-account-revoke-warning">
          <li>Admin này sẽ không còn quyền truy cập cơ sở sau khi thu hồi.</li>
          <li>Thao tác này không xóa học viên, lịch học hoặc dữ liệu cơ sở.</li>
          <li>Tài khoản đăng nhập vẫn tồn tại, chỉ quyền tại cơ sở này bị thu hồi.</li>
          <li>Chỉ owner mới được thực hiện thao tác này.</li>
        </ul>
        <label class="internal-account-revoke-typed">
          <span>Nhập REVOKE để xác nhận</span>
          <input
            type="text"
            value="${escapeAttribute(typedValue)}"
            autocomplete="off"
            spellcheck="false"
            data-internal-revoke-typed-confirmation
          >
        </label>
        <p class="internal-account-revoke-gate" role="status">
          ${liveAllowed
            ? 'Thao tác bảo mật đã được bật cho cơ sở này.'
            : 'Thao tác thu hồi quyền cho cơ sở này chưa được bật. Vui lòng dùng cơ sở kiểm thử trước hoặc xác nhận riêng trước khi thao tác.'}
        </p>
        ${internalCenterAdminAccountsState.revokeRiskAcknowledged ? `
          <p class="internal-account-copy-message" role="status">
            ${liveAllowed ? 'Đã ghi nhận xác nhận rủi ro.' : 'Đã ghi nhận xác nhận rủi ro. Thao tác thật chưa được bật cho cơ sở này.'}
          </p>
        ` : ''}
        ${internalCenterAdminAccountsState.revokeError ? `
          <p class="internal-account-reset-error" role="alert">${escapeHtml(internalCenterAdminAccountsState.revokeError)}</p>
        ` : ''}
        <div class="internal-account-revoke-actions">
          <button type="button" class="is-secondary" data-internal-revoke-cancel ${isSubmitting ? 'disabled' : ''}>Hủy</button>
          <button type="button" class="is-primary" data-internal-revoke-acknowledge-risk ${isSubmitting ? 'disabled' : ''}>Tôi hiểu rủi ro</button>
          <button
            type="button"
            class="is-danger"
            data-internal-revoke-confirm
            ${finalRevokeEnabled ? '' : 'disabled'}
          >
            Thu hồi quyền
          </button>
        </div>
        <p class="internal-account-revoke-helper">
          ${liveAllowed
            ? 'Sau khi thu hồi thành công, hệ thống giữ thông tin admin để có thể khôi phục ngay.'
            : 'Để tránh thao tác nhầm trên cơ sở đang vận hành, chức năng này hiện chỉ bật cho cơ sở đã được chọn để kiểm thử.'}
        </p>
        <div class="internal-account-restore-placeholder" aria-label="Thiết kế khôi phục quyền tương lai">
          <strong>Sau khi thu hồi quyền</strong>
          <p>Admin sẽ không còn quyền truy cập cơ sở này. Owner có thể khôi phục quyền hoặc tạo admin mới khi chức năng tương ứng được bật.</p>
          <div>
            <button type="button" disabled>Khôi phục quyền</button>
            <button type="button" disabled>Tạo admin mới</button>
          </div>
        </div>
      </div>
    </div>
  `
}

function renderInternalRestoreAccessConfirm() {
  const confirm = internalCenterAdminAccountsState.restoreConfirm
  const isSubmitting = internalCenterAdminAccountsState.restoreStatus === 'submitting'
  const typedValue = internalCenterAdminAccountsState.restoreTypedConfirmation
  const liveAllowed = canLiveRestoreInternalAccount(confirm)
  const finalRestoreEnabled = Boolean(liveAllowed && typedValue === 'RESTORE' && !isSubmitting)

  if (!confirm && !internalCenterAdminAccountsState.restoreError) {
    return ''
  }

  if (!confirm && internalCenterAdminAccountsState.restoreError) {
    return `
      <div class="internal-account-revoke-panel is-error" role="alert">
        <strong>Không mở được khôi phục quyền</strong>
        <p>${escapeHtml(internalCenterAdminAccountsState.restoreError)}</p>
      </div>
    `
  }

  return `
    <div class="internal-account-revoke-modal" role="presentation">
      <div class="internal-account-revoke-window" role="dialog" aria-modal="true" aria-labelledby="internal-restore-title">
        <div class="internal-account-revoke-heading">
          <div>
            <h3 id="internal-restore-title">Khôi phục quyền admin cơ sở</h3>
            <p>Khôi phục quyền sẽ cho admin truy cập lại cơ sở này.</p>
          </div>
          <span>${liveAllowed ? 'Đã bật cho cơ sở này' : 'Chưa bật thao tác thật'}</span>
          <button
            type="button"
            class="internal-account-revoke-close"
            data-internal-restore-cancel
            aria-label="Đóng cửa sổ khôi phục quyền"
            ${isSubmitting ? 'disabled' : ''}
          >
            ×
          </button>
        </div>
        <dl class="internal-account-revoke-details">
          <div>
            <dt>Cơ sở</dt>
            <dd>${escapeHtml(confirm.centerName)}</dd>
          </div>
          <div>
            <dt>Admin</dt>
            <dd class="internal-account-email">${escapeHtml(confirm.email)}</dd>
          </div>
          <div>
            <dt>Trạng thái hiện tại</dt>
            <dd>Đã thu hồi quyền</dd>
          </div>
        </dl>
        <p class="internal-account-revoke-gate" role="status">
          ${liveAllowed
            ? 'Thao tác bảo mật đã được bật cho cơ sở này.'
            : 'Thao tác khôi phục quyền cho cơ sở này chưa được bật.'}
        </p>
        <label class="internal-account-revoke-typed">
          <span>Nhập RESTORE để xác nhận</span>
          <input
            type="text"
            value="${escapeAttribute(typedValue)}"
            autocomplete="off"
            spellcheck="false"
            data-internal-restore-typed-confirmation
          >
        </label>
        ${internalCenterAdminAccountsState.restoreError ? `
          <p class="internal-account-reset-error" role="alert">${escapeHtml(internalCenterAdminAccountsState.restoreError)}</p>
        ` : ''}
        <div class="internal-account-revoke-actions">
          <button type="button" class="is-secondary" data-internal-restore-cancel ${isSubmitting ? 'disabled' : ''}>Hủy</button>
          <button
            type="button"
            class="is-success"
            data-internal-restore-confirm
            ${finalRestoreEnabled ? '' : 'disabled'}
          >
            ${isSubmitting ? 'Đang khôi phục...' : 'Khôi phục quyền'}
          </button>
        </div>
      </div>
    </div>
  `
}

function renderInternalCreateAdminConfirm() {
  const confirm = internalCenterAdminAccountsState.createConfirm
  const isSubmitting = internalCenterAdminAccountsState.createStatus === 'submitting'

  if (!confirm && !internalCenterAdminAccountsState.createError) {
    return ''
  }

  if (!confirm && internalCenterAdminAccountsState.createError) {
    return `
      <div class="internal-account-reset-panel is-error" role="alert">
        <strong>Không tạo được admin cơ sở</strong>
        <p>${escapeHtml(internalCenterAdminAccountsState.createError)}</p>
      </div>
    `
  }

  return `
    <div class="internal-account-reset-panel" role="dialog" aria-modal="false" aria-labelledby="internal-create-admin-title">
      <div>
        <h3 id="internal-create-admin-title">Tạo admin cơ sở?</h3>
        <p>Bạn đang tạo tài khoản admin cho:</p>
        <p class="internal-account-confirm-email">${escapeHtml(confirm.centerName)}</p>
        <p>Mã cơ sở: <strong>${escapeHtml(confirm.centerId)}</strong></p>
        <p>Hệ thống sẽ tạo tài khoản: <strong>${escapeHtml(confirm.expectedEmail)}</strong></p>
        <p>Mật khẩu tạm chỉ hiển thị một lần để copy bàn giao.</p>
      </div>
      ${internalCenterAdminAccountsState.createError ? `
        <p class="internal-account-reset-error" role="alert">${escapeHtml(internalCenterAdminAccountsState.createError)}</p>
      ` : ''}
      <div class="internal-account-reset-actions">
        <button type="button" data-internal-create-admin-cancel ${isSubmitting ? 'disabled' : ''}>Hủy</button>
        <button type="button" data-internal-create-admin-confirm ${isSubmitting ? 'disabled' : ''}>
          ${isSubmitting ? 'Đang tạo admin...' : 'Tạo admin'}
        </button>
      </div>
    </div>
  `
}

function renderInternalResetPasswordConfirm() {
  const confirm = internalCenterAdminAccountsState.resetConfirm
  const isSubmitting = internalCenterAdminAccountsState.resetStatus === 'submitting'

  if (!confirm && !internalCenterAdminAccountsState.resetError) {
    return ''
  }

  if (!confirm && internalCenterAdminAccountsState.resetError) {
    return `
      <div class="internal-account-reset-panel is-error" role="alert">
        <strong>Không tạo được mật khẩu tạm mới</strong>
        <p>${escapeHtml(internalCenterAdminAccountsState.resetError)}</p>
      </div>
    `
  }

  return `
    <div class="internal-account-reset-panel" role="dialog" aria-modal="false" aria-labelledby="internal-reset-title">
      <div>
        <h3 id="internal-reset-title">Tạo mật khẩu tạm mới?</h3>
        <p>Bạn đang tạo mật khẩu tạm mới cho admin cơ sở:</p>
        <p class="internal-account-confirm-email">${escapeHtml(confirm.email)}</p>
        <p>Mật khẩu cũ sẽ không dùng được sau khi reset. Mật khẩu mới chỉ hiển thị một lần để copy bàn giao.</p>
      </div>
      ${internalCenterAdminAccountsState.resetError ? `
        <p class="internal-account-reset-error" role="alert">${escapeHtml(internalCenterAdminAccountsState.resetError)}</p>
      ` : ''}
      <div class="internal-account-reset-actions">
        <button type="button" data-internal-reset-cancel ${isSubmitting ? 'disabled' : ''}>Hủy</button>
        <button type="button" data-internal-reset-confirm ${isSubmitting ? 'disabled' : ''}>
          ${isSubmitting ? 'Đang tạo mật khẩu tạm...' : 'Tạo mật khẩu tạm mới'}
        </button>
      </div>
    </div>
  `
}

function renderInternalPasswordHandoffCard() {
  const handoff = internalCenterAdminAccountsState.handoff

  if (!handoff) {
    return ''
  }

  const title = handoff.kind === 'create'
    ? 'Đã tạo tài khoản admin cơ sở'
    : 'Đã tạo mật khẩu tạm mới'

  return `
    <div class="internal-password-handoff" role="dialog" aria-modal="false" aria-labelledby="internal-handoff-title">
      <div class="internal-password-handoff-header">
        <div>
          <h3 id="internal-handoff-title">${escapeHtml(title)}</h3>
          <p>Mật khẩu này chỉ hiển thị trong lần này. Hãy copy và gửi riêng cho admin cơ sở.</p>
        </div>
      </div>
      <dl class="internal-password-handoff-details">
        <div>
          <dt>Cơ sở</dt>
          <dd>${escapeHtml(handoff.centerName)}</dd>
        </div>
        <div>
          <dt>Tài khoản</dt>
          <dd class="internal-account-email">${escapeHtml(handoff.email)}</dd>
        </div>
        <div>
          <dt>Mật khẩu tạm</dt>
          <dd class="internal-password-handoff-secret">${escapeHtml(handoff.temporaryPassword)}</dd>
        </div>
      </dl>
      <div class="internal-password-handoff-actions">
        <button type="button" data-internal-handoff-copy="email">Copy email</button>
        <button type="button" data-internal-handoff-copy="password">Copy mật khẩu</button>
        <button type="button" data-internal-handoff-copy="all">Copy toàn bộ</button>
        <button type="button" data-internal-handoff-close>Tôi đã lưu</button>
      </div>
      ${internalCenterAdminAccountsState.handoffCopyMessage ? `
        <p class="internal-account-copy-message" role="status">${escapeHtml(internalCenterAdminAccountsState.handoffCopyMessage)}</p>
      ` : ''}
    </div>
  `
}

function getInternalCenterAdminLabel(adminAccount) {
  if (internalCenterAdminAccountsState.status === 'loading' || internalCenterAdminAccountsState.status === 'idle') {
    return 'Đang tải...'
  }

  if (internalCenterAdminAccountsState.status === 'error') {
    return 'Chưa tải'
  }

  if (adminAccount?.isRevoked || adminAccount?.state === 'revoked' || adminAccount?.status === 'revoked') {
    return adminAccount.email ? `${adminAccount.email} (đã thu hồi)` : 'Đã thu hồi quyền'
  }

  if (!adminAccount?.exists) {
    return 'Chưa có admin'
  }

  if (adminAccount.state === 'multiple_active_admins') {
    return 'Nhiều admin active, cần kiểm tra'
  }

  return adminAccount.email || 'Đã có admin, chưa có email'
}

function getInternalCenterAccountStatus(adminAccount) {
  if (internalCenterAdminAccountsState.status === 'loading' || internalCenterAdminAccountsState.status === 'idle') {
    return 'Đang tải dữ liệu tài khoản'
  }

  if (internalCenterAdminAccountsState.status === 'error') {
    return 'Không tải được dữ liệu tài khoản'
  }

  if (adminAccount?.isRevoked || adminAccount?.state === 'revoked' || adminAccount?.status === 'revoked') {
    return 'Đã thu hồi quyền'
  }

  if (adminAccount?.state === 'multiple_active_admins') {
    return 'Cần kiểm tra nhiều admin'
  }

  if (adminAccount?.exists) {
    return 'Đã có admin'
  }

  return 'Cần tạo tài khoản'
}

function getInternalCenterAccountUnknownLabel() {
  if (internalCenterAdminAccountsState.status === 'loaded') {
    return 'Chưa có admin'
  }

  return 'Chưa tải'
}

function renderInternalCentersList() {
  if (internalCentersListState.status === 'loading' || internalCentersListState.status === 'idle') {
    return '<p class="internal-console-state" role="status">Đang tải danh sách cơ sở...</p>'
  }

  if (internalCentersListState.status === 'error') {
    return `
      <div class="internal-console-state is-error" role="alert">
        <strong>Không tải được danh sách cơ sở.</strong>
        <span>${escapeHtml(internalCentersListState.error || 'Vui lòng kiểm tra quyền đọc centers.')}</span>
      </div>
    `
  }

  if (!internalCentersListState.centers.length) {
    return '<p class="internal-console-state">Chưa có cơ sở production active.</p>'
  }

  return `
    <div class="internal-centers-list" aria-label="Danh sách cơ sở readonly">
      <div class="internal-centers-filter-note">
        <span>Môi trường: production</span>
        <span>Trạng thái: active</span>
      </div>
      ${internalCenterSwitchState.error ? `
        <p class="internal-console-state is-error" role="alert">
          ${escapeHtml(internalCenterSwitchState.error)}
        </p>
      ` : ''}
      <div class="internal-centers-table-wrap">
        <table class="internal-centers-table">
          <thead>
            <tr>
              <th>Tên cơ sở</th>
              <th>Mã cơ sở</th>
              <th>Slug</th>
              <th>Môi trường</th>
              <th>Trạng thái</th>
              <th>Cập nhật</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${internalCentersListState.centers.map(renderInternalCenterRow).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderInternalCenterRow(center) {
  const currentCenterId = getCurrentResolvedCenterId()
  const canOpenCenter = canOpenInternalCenter(center)
  const isCurrentCenter = center.id === currentCenterId
  const isSwitching = internalCenterSwitchState.status === 'switching' &&
    internalCenterSwitchState.centerId === center.id
  const buttonLabel = isSwitching
    ? 'Đang mở...'
    : isCurrentCenter ? 'Đang mở' : 'Mở OS cơ sở'

  return `
    <tr>
      <td>${escapeHtml(center.name || center.id)}</td>
      <td><code>${escapeHtml(center.id)}</code></td>
      <td>${escapeHtml(center.slug || '-')}</td>
      <td>${escapeHtml(center.environment || '-')}</td>
      <td>${escapeHtml(center.status || '-')}</td>
      <td>${escapeHtml(formatInternalCenterTimestamp(center.updatedAt))}</td>
      <td>${escapeHtml(formatInternalCenterTimestamp(center.createdAt))}</td>
      <td>
        <button
          type="button"
          class="internal-centers-open"
          data-internal-open-center-id="${escapeHtml(center.id)}"
          ${canOpenCenter && !isCurrentCenter && !isSwitching ? '' : 'disabled'}
        >
          ${escapeHtml(buttonLabel)}
        </button>
      </td>
    </tr>
  `
}

function formatInternalCenterTimestamp(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
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

function focusAttendanceBaselineCellTarget(target) {
  if (!target) {
    return false
  }

  const selector =
    `[data-attendance-baseline-cell-input][data-row-index="${target.rowIndex}"][data-column-index="${target.columnIndex}"]`
  const input = document.querySelector(selector)

  if (!input) {
    return false
  }

  input.focus()
  input.select?.()
  return true
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

  return getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate, classSessions).find(
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

function getScheduleDaysFromSettingsClassSession(classSession) {
  const dayAliases = {
    mon: 'monday',
    monday: 'monday',
    t2: 'monday',
    tue: 'tuesday',
    tuesday: 'tuesday',
    t3: 'tuesday',
    wed: 'wednesday',
    wednesday: 'wednesday',
    t4: 'wednesday',
    thu: 'thursday',
    thursday: 'thursday',
    t5: 'thursday',
    fri: 'friday',
    friday: 'friday',
    t6: 'friday',
    sat: 'saturday',
    saturday: 'saturday',
    t7: 'saturday',
    sun: 'sunday',
    sunday: 'sunday',
    cn: 'sunday',
  }
  const explicitDays = Array.isArray(classSession?.daysOfWeek) ? classSession.daysOfWeek : []
  const labelDays = String(classSession?.daysLabel || classSession?.dayLabel || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)

  return [...explicitDays, ...labelDays]
    .map((day) => dayAliases[String(day).toLowerCase()] || '')
    .filter((day, index, days) => day && days.indexOf(day) === index)
}

function getScheduleSettingsClassSessionLabel(classSession) {
  return String(classSession?.displayLabel || classSession?.name || classSession?.daysLabel || 'Ca học').trim()
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

function commitAttendanceBaselineCellInput(input, { focusTarget = null, shouldRender = true } = {}) {
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
    if (shouldRender) {
      render()
    }
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

  if (shouldRender) {
    render()
  }

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
  const preservedIdentity = String(element.dataset.preserveScrollKey || '').trim()

  if (preservedIdentity) {
    return `${windowKey}:${targetName}:${preservedIdentity}`
  }

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
        const canOpen = isProductionModuleAvailable(moduleItem.id)

        return `
          <button
            class="module-button designer-theme-hook ${canOpen ? '' : 'is-unavailable'}"
            type="button"
            data-module-id="${moduleItem.id}"
            data-module-title="${escapeAttribute(moduleItem.name)}"
            data-designer-hook="module-card"
            ${
              canOpen
                ? `data-module-launcher="desktop" data-shortcut-id="${moduleItem.id}"`
                : 'data-module-unavailable="true" aria-disabled="true" tabindex="-1" disabled'
            }
          >
            <span class="module-card-icon-slot designer-image-slot" aria-hidden="true"></span>
            <span class="module-card-label">${moduleItem.name}</span>
            <span class="module-card-visual-slot module-visual-placeholder" aria-hidden="true"></span>
            ${canOpen ? '' : `<span class="module-availability-label">${getUnavailableModuleLabel(moduleItem.id)}</span>`}
            ${
              canOpen && unreadCount
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
      <h1 class="sr-only" id="dashboard-title">Desktop iChess Center OS</h1>
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
  return desktopModuleOrder
    .map((moduleId) => modulesById.get(moduleId))
    .filter((moduleItem) => isProductionModuleVisible(moduleItem?.id))
}

function getStudentWindowSurface(windowItem) {
  if (windowItem.moduleId === 'hoc-vien' && !windowItem.type) {
    return studentFormState ? 'form' : 'list'
  }

  const surfacesByType = {
    'student-detail': 'profile',
    'student-care-notes': 'care-notes',
  }

  return surfacesByType[windowItem.type] || ''
}

function renderModuleWindow(windowItem) {
  const title = getWindowTitle(windowItem)
  const headerTitle = getWindowHeaderTitle(windowItem)
  const studentSurface = getStudentWindowSurface(windowItem)
  const isScheduleWindow = windowItem.moduleId === 'thoi-khoa-bieu' && !windowItem.type
  const isReportWindow = windowItem.moduleId === 'bao-cao' && !windowItem.type
  const isTuitionWindow = windowItem.moduleId === 'hoc-phi' && !windowItem.type

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
      class="desktop-window designer-theme-hook ${windowItem.maximized ? 'maximized' : ''} ${windowItem.type === 'staff-administrative-profile' ? 'is-staff-administrative-profile' : ''} ${studentSurface ? `is-student-window is-student-${studentSurface}-window` : ''} ${isScheduleWindow ? 'is-schedule-window' : ''} ${isReportWindow ? 'is-report-window' : ''} ${isTuitionWindow ? 'is-tuition-window' : ''}"
      style="${style}"
      data-window-id="${windowItem.id}"
      data-module-id="${escapeAttribute(windowItem.moduleId || '')}"
      ${studentSurface ? `data-student-surface="${studentSurface}"` : ''}
      data-module-title="${escapeAttribute(headerTitle)}"
      data-designer-hook="module-window"
      aria-labelledby="${windowItem.id}-title"
    >
      <div class="window-titlebar" data-drag-window-id="${windowItem.id}">
        <span class="module-window-hero-slot designer-image-slot" aria-hidden="true"></span>
        <h2 id="${windowItem.id}-title">${escapeHtml(headerTitle)}</h2>
        <div class="window-controls">
          ${renderModuleRefreshControl(windowItem)}
          ${renderModuleNotificationBell(windowItem)}
          <button type="button" data-window-action="minimize" data-window-id="${windowItem.id}" aria-label="Thu nhỏ ${escapeAttribute(headerTitle)}">-</button>
          <button type="button" data-window-action="maximize" data-window-id="${windowItem.id}" aria-label="Phóng to hoặc khôi phục ${escapeAttribute(headerTitle)}">□</button>
          <button type="button" data-window-action="close" data-window-id="${windowItem.id}" aria-label="Đóng ${escapeAttribute(headerTitle)}">X</button>
        </div>
      </div>
      <div class="window-body">
        ${renderModuleRefreshNotice(windowItem)}
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

function createModuleRefreshState(overrides = {}) {
  return {
    status: 'idle',
    centerId: '',
    contextKey: '',
    upstreams: [],
    requiredUpstreams: [],
    optionalUpstreams: [],
    actionRequiredUpstreams: {},
    upstreamHealth: {},
    message: 'Chưa tải dữ liệu mới nhất cho lần mở này.',
    lastFreshAt: '',
    ...overrides,
  }
}

function isPrimaryBusinessModuleWindow(windowItem) {
  return Boolean(
    windowItem
    && !windowItem.type
    && modules.some((item) => item.id === windowItem.moduleId)
    && isBusinessModule(windowItem.moduleId),
  )
}

function getModuleRefreshState(moduleId) {
  const state = moduleRefreshStates.get(moduleId)
  const centerId = getCurrentCanonicalCenterContext().centerId
  const contextKey = getModuleRefreshContextKey()
  return state?.centerId === centerId && state?.contextKey === contextKey
    ? state
    : createModuleRefreshState({ centerId, contextKey })
}

function getModuleRefreshContextKey() {
  const centerId = getCurrentCanonicalCenterContext().centerId
  const actorUserId = String(cloudStatus.user?.id || '').trim()
  return centerId && actorUserId ? `${actorUserId}:${centerId}` : ''
}

function isModuleUpstreamCurrent(moduleId, upstream) {
  const state = getModuleRefreshState(moduleId)
  return Boolean(
    state.centerId
    && state.centerId === getCurrentCanonicalCenterContext().centerId
    && state.contextKey === getModuleRefreshContextKey()
    && state.upstreamHealth?.[upstream]?.ok,
  )
}

function getModuleUpstreamStatus(moduleId, upstream) {
  return getModuleUpstreamUiState(getModuleRefreshState(moduleId), upstream)
}

function combineModuleUpstreamStatuses(...statuses) {
  if (statuses.some((status) => status === 'failed')) return 'failed'
  if (statuses.every((status) => status === 'ready')) return 'ready'
  return 'loading'
}

function areModuleActionUpstreamsCurrent(moduleId, action) {
  const requiredUpstreams = getModuleActionRequiredUpstreams(moduleId, action)
  return requiredUpstreams.every((upstream) => isModuleUpstreamCurrent(moduleId, upstream))
}

function getUnavailableOptionalState(moduleId, upstream, label) {
  const state = getModuleRefreshState(moduleId)
  const upstreamStatus = getModuleUpstreamUiState(state, upstream)
  const isLoading = ['idle', 'loading'].includes(upstreamStatus)
  const isCurrent = isModuleUpstreamCurrent(moduleId, upstream)
  const outcomeCode = state.upstreamHealth?.[upstream]?.outcomeCode || ''
  const isUnavailable = upstream === 'calendar-notes'
    && isUnavailableCalendarNotesOutcome(outcomeCode)
  if (isCurrent) return null
  return {
    centerId: state.centerId,
    isLoading,
    isSaving: false,
    availabilityStatus: isLoading ? 'loading' : isUnavailable ? 'unavailable' : 'failed',
    outcomeCode,
    message: isLoading
      ? `Đang tải ${label}...`
      : isUnavailable
        ? `${label} hiện chưa khả dụng.`
        : `${label} hiện chưa tải được.`,
    messageTone: isLoading ? '' : isUnavailable ? 'warning' : 'error',
    lastLoadedAt: '',
    legacyMigrationRequired: false,
  }
}

function renderModuleRefreshControl(windowItem) {
  if (!isPrimaryBusinessModuleWindow(windowItem)) return ''
  const state = getModuleRefreshState(windowItem.moduleId)
  return `
    <button
      class="module-authoritative-refresh"
      type="button"
      data-module-authoritative-refresh="${escapeAttribute(windowItem.moduleId)}"
      ${state.status === 'loading' ? 'disabled' : ''}
      aria-label="Làm mới dữ liệu của ${escapeAttribute(getWindowHeaderTitle(windowItem))}"
    >${state.status === 'loading' ? 'Đang tải…' : 'Làm mới'}</button>
  `
}

function renderModuleRefreshNotice(windowItem) {
  if (!isPrimaryBusinessModuleWindow(windowItem)) return ''
  const state = getModuleRefreshState(windowItem.moduleId)
  const tone = ['fresh', 'limited'].includes(state.status)
    ? 'is-fresh'
    : state.status === 'loading'
      ? 'is-loading'
      : 'is-unfresh'
  const label = state.status === 'fresh'
    ? `Dữ liệu đã được cập nhật${state.lastFreshAt ? ` lúc ${formatRefreshTime(state.lastFreshAt)}` : ''}.`
    : state.status === 'limited'
      ? state.message
    : state.status === 'loading'
      ? 'Đang tải dữ liệu mới nhất của chức năng này.'
      : state.message
  return `<p class="module-authoritative-refresh-notice ${tone}" role="status">${escapeHtml(label)}</p>`
}

function formatRefreshTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function renderCurrentStaffModule() {
  ensureStaffAccountDirectoryLoading()
  const administrativeAccess = getStaffAdministrativeProfileAccessContext()

  return renderStaffModule({
    staffMembers,
    departments: staffDepartments,
    teachers,
    scheduleSessions,
    sessionReports,
    filters: staffFilters,
    formState: staffFormState,
    isDepartmentPanelOpen: isStaffDepartmentPanelOpen,
    departmentFormState: staffDepartmentFormState,
    accountMemberships: staffAccountDirectoryState.memberships,
    accountDirectoryState: staffAccountDirectoryState,
    accountLinkState: staffAccountLinkState,
    lifecycleState: staffLifecycleState,
    administrativeProfiles: administrativeAccess.ok ? staffAdministrativeProfiles : [],
    administrativeAccessAllowed: administrativeAccess.ok,
    administrativeStorageHealthy: isC55StaffHrProjectionHealthy(),
    currentCenterId: getCurrentStorageCenterId(),
    notice: staffNotice,
    syncState: c55StaffHrSharedTruthState,
  })
}

function renderWindowBody(windowItem) {
  if (windowItem.type === 'staff-administrative-profile') {
    const access = getStaffAdministrativeProfileAccessContext()

    if (!access.ok || windowItem.centerId !== access.centerId) {
      clearStaffDocumentAttachmentRuntime(windowItem.id)
      staffAdministrativeProfileWindowStates.delete(windowItem.id)
      staffDocumentWindowStates.delete(windowItem.id)
      staffAdministrativeGovernanceWindowStates.delete(windowItem.id)
      savingStaffDocumentWindowIds.delete(windowItem.id)
      savingStaffAdministrativeGovernanceWindowIds.delete(windowItem.id)
      return renderStaffAdministrativeProfileWindow({ accessAllowed: false })
    }

    const staffMember = getUniqueCurrentCenterStaffMember(
      windowItem.staffMemberId,
      windowItem.centerId,
    )
    const department = staffDepartments.find(
      (item) => item.id === staffMember?.departmentId,
    )
    const profileProjectionHealthy = isC55StaffHrProjectionHealthy(windowItem.centerId)
    const lookup = profileProjectionHealthy
      ? resolveStaffAdministrativeProfileForStaff(
          staffAdministrativeProfiles,
          windowItem.staffMemberId,
          windowItem.centerId,
        )
      : {
          status: 'malformed',
          profile: null,
          candidates: [],
          issues: ['authoritative-projection-unhealthy'],
        }
    let state = getStaffAdministrativeProfileWindowState(windowItem.id) || {
      mode: 'view',
      centerId: windowItem.centerId,
      ['staffMemberId']: windowItem.staffMemberId,
      profileId: lookup.profile?.id || '',
      values: null,
      errors: {},
      message: '',
      isSaving: false,
      revealedFields: new Set(),
    }
    if (
      !staffMember ||
      ['malformed', 'duplicate'].includes(lookup.status) ||
      (staffMember.archivedAt && ['create', 'edit'].includes(state.mode))
    ) {
      state = {
        mode: 'view',
        centerId: windowItem.centerId,
        ['staffMemberId']: windowItem.staffMemberId,
        profileId: lookup.profile?.id || '',
        values: null,
        errors: {},
        message: '',
        isSaving: false,
        revealedFields: new Set(),
      }
      setStaffAdministrativeProfileWindowState(windowItem.id, state)
    }
    if (
      state.mode === 'view' &&
      (
        state.centerId !== windowItem.centerId ||
        state.staffMemberId !== windowItem.staffMemberId ||
        state.profileId !== (lookup.profile?.id || '')
      )
    ) {
      state = {
        ...state,
        centerId: windowItem.centerId,
        ['staffMemberId']: windowItem.staffMemberId,
        profileId: lookup.profile?.id || '',
        revealedFields: new Set(),
      }
      setStaffAdministrativeProfileWindowState(windowItem.id, state)
    }

    const documentStorageContext = getStaffDocumentStorageContext(windowItem.centerId)
    const profileDocuments = documentStorageContext.ok
      ? getStaffDocumentsForProfile(lookup.profile, staffMember, windowItem.centerId)
      : []
    let documentState = getStaffDocumentWindowState(windowItem.id)
    if (
      !documentState ||
      documentState.centerId !== windowItem.centerId ||
      documentState.staffMemberId !== windowItem.staffMemberId ||
      documentState.administrativeProfileId !== (lookup.profile?.id || '') ||
      (staffMember?.archivedAt && ['create', 'edit'].includes(documentState.mode))
    ) {
      documentState = createStaffDocumentWindowState(
        windowItem.centerId,
        windowItem.staffMemberId,
        lookup.profile?.id || '',
      )
      setStaffDocumentWindowState(windowItem.id, documentState)
      savingStaffDocumentWindowIds.delete(windowItem.id)
    }

    const governanceStorageContext = getStaffAdministrativeGovernanceStorageContext(
      windowItem.centerId,
    )
    let governanceState = getStaffAdministrativeGovernanceWindowState(windowItem.id)
    if (
      !governanceState ||
      governanceState.centerId !== windowItem.centerId ||
      governanceState.staffMemberId !== windowItem.staffMemberId ||
      governanceState.administrativeProfileId !== (lookup.profile?.id || '')
    ) {
      governanceState = createStaffAdministrativeGovernanceWindowState(
        windowItem.centerId,
        windowItem.staffMemberId,
        lookup.profile?.id || '',
      )
      setStaffAdministrativeGovernanceWindowState(windowItem.id, governanceState)
      savingStaffAdministrativeGovernanceWindowIds.delete(windowItem.id)
    }

    return renderStaffAdministrativeProfileWindow({
      windowId: windowItem.id,
      staffMember,
      departmentName: department?.name || '',
      lookup,
      state,
      accessAllowed: true,
      documents: profileDocuments,
      documentState,
      documentStorageHealthy: documentStorageContext.ok,
      governanceAccess: access,
      auditEvents: staffAdministrativeAuditEvents,
      retentionPolicy: staffAdministrativeRetentionPolicy,
      deletionRequests: staffAdministrativeDeletionRequests,
      governanceState,
      governanceStorageHealthy: governanceStorageContext.ok,
    })
  }

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

  if (isBusinessModule(moduleItem.id) && !getCurrentCanonicalCenterContext().ok) {
    return `
      <section class="module-center-context-blocked" role="status">
        <h3>Chưa xác định cơ sở đang hoạt động</h3>
        <p>Dữ liệu cũ đang được ẩn để tránh hiển thị nhầm thông tin của cơ sở khác.</p>
      </section>
    `
  }

  if (moduleItem.id === 'hoc-vien') {
    return renderStudentModule(
      getStudentsWithCanonicalProjections(),
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
      getStudentsWithCanonicalProjections(),
      parentConsultationFormState,
      parentQuickNoteState,
      parentNoteHistoryContactId,
      parentContactDetailId,
      null,
      c53CrmSharedTruthState,
      {
        ...parentFirstCapabilityState,
        moduleRefreshStatus: getModuleRefreshState('khach-hang-tu-van').status,
        links: parentStudentLinks,
        linkReviewState: parentLinkReviewState,
        identityEditState: parentIdentityEditState,
      },
    )
  }

  if (moduleItem.id === 'giao-vien') {
    const attendanceAvailable = isModuleUpstreamCurrent('giao-vien', 'attendance')
    const staffAvailable = isModuleUpstreamCurrent('giao-vien', 'staff')
    return renderTeacherModule(
      teachers,
      teacherFilters,
      teacherFormState,
      selectedTeacherId,
      students,
      scheduleSessions,
      classSessions,
      attendanceAvailable ? sessionReports : [],
      {
        staffMembers: staffAvailable ? staffMembers : [],
        departments: staffAvailable ? staffDepartments : [],
        staffLinkState: teacherStaffLinkState,
        attendanceAvailable,
        staffAvailable,
      },
    )
  }

  if (moduleItem.id === 'nhan-vien') {
    return renderCurrentStaffModule()
  }

  if (moduleItem.id === 'thoi-khoa-bieu') {
    const attendanceAvailable = isModuleUpstreamCurrent('thoi-khoa-bieu', 'attendance')
    const calendarNotesAvailable = isModuleUpstreamCurrent('thoi-khoa-bieu', 'calendar-notes')
    return renderScheduleModule(
      scheduleSessions,
      scheduleFormState,
      scheduleReportState,
      attendanceAvailable ? sessionReports : [],
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
        calendarNotesAvailable,
        centerCalendarFilters: scheduleCalendarFilters,
        centerCalendarItemState: scheduleCalendarItemState,
        centerCalendarItems: calendarNotesAvailable ? centerCalendarItems : [],
        centerCalendarTags: calendarNotesAvailable ? centerCalendarTags : [],
        centerCalendarTagState: scheduleCalendarTagState,
        calendarNotesSharedTruthState: getUnavailableOptionalState(
          'thoi-khoa-bieu',
          'calendar-notes',
          'Lịch hoạt động bổ sung',
        ) || c57CalendarNotesSharedTruthState,
        classSessions,
      },
    )
  }

  if (moduleItem.id === 'hoc-phi') {
    const coreStatus = getModuleUpstreamStatus('hoc-phi', 'core')
    const tuitionStatus = getModuleUpstreamStatus('hoc-phi', 'tuition')
    const attendanceStatus = combineModuleUpstreamStatuses(
      coreStatus,
      tuitionStatus,
      getModuleUpstreamStatus('hoc-phi', 'attendance'),
    )
    const calendarNotesStatus = combineModuleUpstreamStatuses(
      coreStatus,
      getModuleUpstreamStatus('hoc-phi', 'calendar-notes'),
    )
    const financeStatus = combineModuleUpstreamStatuses(
      coreStatus,
      tuitionStatus,
      getModuleUpstreamStatus('hoc-phi', 'finance'),
    )
    const attendanceAvailable = attendanceStatus === 'ready'
    const calendarNotesAvailable = calendarNotesStatus === 'ready'
    const financeAvailable = financeStatus === 'ready'
    const canVoidPayments = financeAvailable
      && !c54FinanceSharedTruthState.isSaving
      && canWriteC54FinanceSharedTruth(buildCurrentOnlineAccessState({ cloudReady: true })).canWrite
    return renderTuitionModule(
      students,
      tuitionRecords,
      tuitionFilters,
      tuitionFormState,
      tuitionPaymentFormState,
      tuitionDetailState,
      attendanceAvailable ? sessionReports : [],
      calendarNotesAvailable ? attendanceAdvisoryNotes : [],
      getCurrentMonthKey(),
      tuitionRollbackPreviewState,
      buildUnifiedAttendanceRecords({
        sessionReports: attendanceAvailable ? sessionReports : [],
        storedRecords: attendanceAvailable
          ? loadStoredAttendanceRecords(getCurrentResolvedCenterId())
          : [],
      }),
      tuitionCareNoteState,
      tuitionAdvisoryWindowState,
      financeAvailable ? cashflowTransactions : [],
      getCurrentResolvedCenterId(),
      tuitionPeriodActionConfirmationState,
      getUnavailableOptionalState(
        'hoc-phi',
        'calendar-notes',
        'Ghi chú chăm sóc theo tháng và ghi chú điểm danh',
      ) || c57CalendarNotesSharedTruthState,
      {
        coreStatus,
        tuitionStatus,
        attendanceStatus,
        attendanceAvailable,
        calendarNotesStatus,
        calendarNotesAvailable,
        financeStatus,
        financeAvailable,
        canVoidPayments,
      },
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
        printingTransactionId: cashflowTransactionPrintState.transactionId,
      },
      transactionImageManagerState,
      cloudGalleryState,
      cashflowTransactionDetailState,
      c54FinanceSharedTruthState,
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
      c54FinanceSharedTruthState,
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
      c56InventorySharedTruthState,
    )
  }

  if (moduleItem.id === 'bao-cao') {
    const centerInfo = getCurrentCanonicalCenterContext()
    return renderReportModule({
      viewMode: reportState.viewMode,
      filters: reportState.filters,
      draft: reportState.draft,
      selectedBarDetail: reportState.selectedBarDetail,
      students,
      cashflowTransactions,
      attendanceRecords: buildUnifiedAttendanceRecords({
        sessionReports,
        storedRecords: loadStoredAttendanceRecords(getCurrentResolvedCenterId()),
      }),
      sourceTransactionsState: reportTransactionDrilldownState,
      centerInfo,
    })
  }

  if (moduleItem.id === 'cai-dat-co-so') {
    const centerInfo = getCurrentCanonicalCenterContext()
    return renderSettingsModule(
      classSessions,
      students,
      settingsFilters,
      settingsClassSessionFormState,
      getSettingsCloudDbPanelState(),
      {
        activeTab: settingsActiveTab,
        tuitionRecords,
        centerInfo: {
          ok: centerInfo.ok,
          name: centerInfo.centerName,
          code: centerInfo.centerId,
          environment: cloudStatus.configStatus === 'configured' ? 'Vận hành chính' : 'Vận hành nội bộ',
          status: centerInfo.ok ? 'Đang hoạt động' : 'Chưa xác định cơ sở đang hoạt động',
        },
      },
    )
  }

  if (moduleItem.id === 'bang-diem-danh') {
    const attendanceAvailable = isModuleUpstreamCurrent('bang-diem-danh', 'attendance')
    const tuitionAvailable = isModuleUpstreamCurrent('bang-diem-danh', 'tuition')
    const calendarNotesAvailable = isModuleUpstreamCurrent('bang-diem-danh', 'calendar-notes')
    return renderAttendanceBoardModule(
      students,
      classSessions,
      tuitionAvailable ? tuitionRecords : [],
      attendanceAvailable ? sessionReports : [],
      calendarNotesAvailable ? attendanceAdvisoryNotes : [],
      attendanceBoardFilters,
      attendanceBoardDetailState,
      calendarNotesAvailable ? attendanceBoardNotes : [],
      attendanceBoardNoteFormState,
      Boolean(attendanceBaselineUndoSnapshot),
      getAttendanceBaselineDraftRecords(),
      getAttendanceBaselineDraftChangeCount(),
      getAttendanceBaselineDraftState(),
      isAttendanceBaselineDetailsOpen,
      getUnavailableOptionalState(
        'bang-diem-danh',
        'calendar-notes',
        'Ghi chú chăm sóc theo tháng và ghi chú điểm danh',
      ) || c57CalendarNotesSharedTruthState,
      {
        attendanceAvailable,
        tuitionAvailable,
        calendarNotesAvailable,
      },
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

  if (!student || student.isDeleted || student.readOnlyProjection) {
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

  return detailHtml.replace('<span class="student-detail-delete-slot"></span>', deleteAction)
}

function getWindowTitle(windowItem) {
  if (windowItem.type === 'staff-administrative-profile') {
    const staffMember = getUniqueCurrentCenterStaffMember(
      windowItem.staffMemberId,
      windowItem.centerId,
    )
    return getStaffAdministrativeWindowTitle(staffMember)
  }

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
  return getStudentsWithCanonicalProjections().find((student) => student.id === studentId)
}

function getTeacherById(teacherId) {
  return teachers.find((teacher) => teacher.id === teacherId)
}

function getLatestCareNoteContent(careNotes) {
  return [...(careNotes ?? [])].sort(
    (firstNote, secondNote) => new Date(secondNote.createdAt) - new Date(firstNote.createdAt),
  )[0]?.content ?? ''
}

function createTuitionCareNoteState(studentId, patch = {}) {
  return {
    studentId,
    values: {
      tag: '',
      content: '',
      ...(patch.values || {}),
    },
    error: '',
    saveState: '',
    ...patch,
  }
}

async function saveTuitionCareNote() {
  if (!tuitionCareNoteState?.studentId) {
    return
  }

  if (!isModuleUpstreamCurrent('hoc-phi', 'core')) {
    tuitionCareNoteState = createTuitionCareNoteState(tuitionCareNoteState.studentId, {
      values: tuitionCareNoteState.values,
      error: 'Dữ liệu học viên chưa được tải mới. Thông tin bạn nhập vẫn được giữ nguyên.',
    })
    render()
    return
  }

  const studentId = tuitionCareNoteState.studentId
  const tag = String(tuitionCareNoteState.values?.tag || '').trim()
  const content = String(tuitionCareNoteState.values?.content || '').trim()

  if (!tag && !content) {
    tuitionCareNoteState = createTuitionCareNoteState(studentId, {
      values: tuitionCareNoteState.values,
      error: 'Nhập tag/chủ đề hoặc nội dung ghi chú trước khi lưu.',
    })
    render()
    return
  }

  const now = new Date().toISOString()
  const noteContent = content || tag
  const student = getStudentById(studentId)
  const currentCareNotes = Array.isArray(student?.careNotes) ? student.careNotes : []
  const nextCareNotes = [
    {
      id: `tuition-note-${studentId}-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      author: cloudStatus.user?.email || 'Người dùng hiện tại',
      content: noteContent,
      tags: tag ? [tag] : ['Học phí'],
      sourceModule: 'tuition',
    },
    ...currentCareNotes,
  ]
  const result = await commitStudentProjection({
    ...student,
    careNotes: nextCareNotes,
    latestCareNote: getLatestCareNoteContent(nextCareNotes),
    updatedAt: now,
  }, 'student-tuition-care-note')

  if (!result.ok) {
    tuitionCareNoteState = createTuitionCareNoteState(studentId, {
      values: tuitionCareNoteState.values,
      error: result.error || 'Ghi chú chưa được lưu.',
    })
    render()
    return
  }

  tuitionCareNoteState = createTuitionCareNoteState(studentId, {
    saveState: 'saved',
  })
  render()
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
  const context = getCurrentCanonicalCenterContext()
  const centerName = context.ok ? context.centerName : 'Chưa xác định'
  const centerId = context.ok ? context.centerId : ''
  const role = context.ok ? context.role : ''
  const dataLabel = !context.ok
    ? 'Chưa xác minh'
    : cloudBootstrapState.status === CLOUD_BOOTSTRAP_STATUS.CLOUD ||
      cloudBootstrapState.status === CLOUD_BOOTSTRAP_STATUS.EMPTY
        ? 'Cloud'
        : 'Cache chỉ xem'

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
          ${escapeHtml(title)}
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
  if (!isNotificationCenterOpen && !staffDocumentAttachmentViewerState) {
    return '<div class="system-overlay-root" id="system-overlay-root"></div>'
  }

  return `
    <div class="system-overlay-root active" id="system-overlay-root">
      ${isNotificationCenterOpen ? renderNotificationCenterHotfix(getUnreadNotificationCount()) : ''}
      ${renderStaffDocumentAttachmentViewer()}
    </div>
  `
}

function renderStaffDocumentAttachmentViewer() {
  const viewer = staffDocumentAttachmentViewerState
  if (!viewer?.signedUrl) return ''
  const isPdf = viewer.mimeType === 'application/pdf'
  return `
    <section
      class="staff-document-attachment-viewer"
      data-staff-document-attachment-viewer
      role="dialog"
      aria-modal="true"
      aria-label="Xem tệp tài liệu nhân sự"
      tabindex="-1"
    >
      <div class="staff-document-attachment-viewer-shell">
        <header>
          <div><strong>Xem tệp tài liệu</strong><span>${isPdf ? 'PDF' : 'Hình ảnh'}</span></div>
          <button type="button" data-staff-document-viewer-action="close" aria-label="Đóng trình xem">Đóng</button>
        </header>
        <div class="staff-document-attachment-viewer-content">
          ${isPdf
            ? `<iframe src="${escapeAttribute(viewer.signedUrl)}" title="Tệp PDF tài liệu nhân sự" referrerpolicy="no-referrer"></iframe>`
            : `<img src="${escapeAttribute(viewer.signedUrl)}" alt="Tệp hình ảnh tài liệu nhân sự" referrerpolicy="no-referrer" />`}
        </div>
      </div>
    </section>
  `
}

function closeStaffDocumentAttachmentViewer() {
  if (!staffDocumentAttachmentViewerState) return
  const returnContext = clearStaffDocumentAttachmentViewerState()
  pendingStaffDocumentViewerReturnContext = returnContext || null
  render()
}

function clearStaffDocumentAttachmentViewerState() {
  const viewer = staffDocumentAttachmentViewerState
  if (!viewer) return null
  if (viewer.expiryTimerId !== null) {
    window.clearTimeout(viewer.expiryTimerId)
  }
  const returnContext = viewer.returnContext || null
  viewer.signedUrl = ''
  viewer.returnContext = null
  viewer.expiryTimerId = null
  staffDocumentAttachmentViewerState = null
  return returnContext
}

function bindStaffDocumentAttachmentViewer() {
  const viewer = document.querySelector('[data-staff-document-attachment-viewer]')
  if (!viewer) return
  viewer.addEventListener('click', (event) => {
    if (
      event.target === viewer ||
      event.target.closest?.('[data-staff-document-viewer-action="close"]')
    ) closeStaffDocumentAttachmentViewer()
  })
  viewer.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    closeStaffDocumentAttachmentViewer()
  })
}

function focusStaffDocumentAttachmentViewerAfterRender() {
  document
    .querySelector('[data-staff-document-attachment-viewer]')
    ?.focus({ preventScroll: true })
}

function restorePendingStaffDocumentViewerReturnContextAfterRender() {
  const context = pendingStaffDocumentViewerReturnContext
  if (!context) return
  pendingStaffDocumentViewerReturnContext = null

  scheduleStaffDocumentViewerReturnRestore({
    context,
    resolveWindowElement: (windowId) => document.querySelector(
      `.desktop-window.is-staff-administrative-profile[data-window-id="${escapeCssAttributeValue(windowId)}"]`,
    ),
    resolveWindowItem: (windowId) => openWindows.find((item) => item.id === windowId),
    resolveDocumentState: getStaffDocumentWindowState,
    resolveScrollContainer: (windowElement) => windowElement.querySelector(
      STAFF_DOCUMENT_CONTENT_SCROLL_SELECTOR,
    ),
    resolveSection: (windowElement, sectionId) => windowElement.querySelector(
      `#${escapeCssIdentifier(sectionId)}`,
    ),
    resolveTrigger: (windowElement, returnContext) => {
      const versionSelector = returnContext.triggerAction === 'attachment-version-view'
        ? `[data-attachment-version="${escapeCssAttributeValue(returnContext.attachmentVersion)}"]`
        : ''
      return windowElement.querySelector(
        `[data-staff-document-action="${escapeCssAttributeValue(returnContext.triggerAction)}"]` +
        `[data-document-id="${escapeCssAttributeValue(returnContext.documentId)}"]` +
        versionSelector,
      )
    },
    scheduleFrame: (callback) => requestAnimationFrame(callback),
  })
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
            data-notification-action="refresh-authoritative"
            ${notificationRefreshState.status === 'loading' ? 'disabled' : ''}
          >
            ${notificationRefreshState.status === 'loading' ? 'Đang tải…' : 'Làm mới'}
          </button>
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
      (summary) => {
        const canOpen = summary.canOpen && isProductionModuleAvailable(summary.sourceModule)
        return `
        <button
          type="button"
          class="notification-module-summary level-${summary.severity} ${canOpen ? 'can-open' : 'is-readonly'}"
          ${canOpen ? `data-notification-module-id="${escapeAttribute(summary.sourceModule)}"` : ''}
          tabindex="${canOpen ? '0' : '-1'}"
          ${canOpen ? '' : 'aria-disabled="true" disabled'}
          aria-label="${escapeAttribute(summary.title)}"
        >
          <div class="notification-module-summary-header">
            <strong>${escapeHtml(summary.title)}</strong>
            <span>${summary.count}</span>
          </div>
          <p>${escapeHtml(summary.message)}</p>
          <span class="notification-module-summary-meta">
            ${canOpen ? 'Bấm để mở module' : 'Chi tiết nằm trong thông báo hệ thống'}
          </span>
        </button>
      `
      },
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
            data-notification-action="refresh-authoritative"
            ${notificationRefreshState.status === 'loading' ? 'disabled' : ''}
          >
            ${notificationRefreshState.status === 'loading' ? 'Đang tải…' : 'Làm mới'}
          </button>
          <button
            type="button"
            data-notification-action="mark-all-read"
            ${unreadVisibleCount ? '' : 'disabled'}
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      </div>
      ${renderNotificationRefreshNotice()}
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
          <span class="window-overflow-title">${escapeHtml(title)}</span>
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
  const moduleItems = getProductionLauncherModules()
    .map(
      (moduleItem) => {
        const canOpen = isProductionModuleAvailable(moduleItem.id)
        return `
          <button
            class="start-menu-module ${canOpen ? '' : 'is-unavailable'}"
            type="button"
            data-module-id="${moduleItem.id}"
            ${
              canOpen
                ? 'data-module-launcher="start-menu"'
                : 'data-module-unavailable="true" aria-disabled="true" tabindex="-1" disabled'
            }
          >
            <span>${moduleItem.name}</span>
            ${canOpen ? '' : `<span class="start-menu-availability-label">${getUnavailableModuleLabel(moduleItem.id)}</span>`}
          </button>
        `
      },
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
      <div class="start-menu-section start-menu-theme-control" aria-label="Chọn giao diện">
        <p>Giao diện</p>
        <div class="start-menu-theme-options">
          <button
            class="${currentUiTheme === 'light' ? 'active' : ''}"
            type="button"
            data-ui-theme="light"
            aria-pressed="${currentUiTheme === 'light'}"
          >☀ Sáng</button>
          <button
            class="${currentUiTheme === 'dark' ? 'active' : ''}"
            type="button"
            data-ui-theme="dark"
            aria-pressed="${currentUiTheme === 'dark'}"
          >🌙 Tối</button>
        </div>
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

function renderNotificationRefreshNotice() {
  const state = notificationRefreshState
  const tone = state.status === 'fresh' ? 'is-fresh' : state.status === 'loading' ? 'is-loading' : 'is-unfresh'
  const message = state.status === 'fresh'
    ? `Thông báo đã được cập nhật từ dữ liệu mới nhất${state.lastFreshAt ? ` lúc ${formatRefreshTime(state.lastFreshAt)}` : ''}.`
    : state.status === 'loading'
      ? 'Đang cập nhật thông báo; kết quả cũ có thể chưa phải bản mới nhất.'
      : state.message
  return `<p class="notification-refresh-notice ${tone}" role="status">${escapeHtml(message)}</p>`
}

const moduleLauncherSelector = [
  '.module-button[data-module-launcher][data-module-id]',
  '.start-menu-module[data-module-launcher][data-module-id]',
].join(',')

function getModuleLauncherFromEventTarget(target) {
  if (isTextEditingElement(target)) {
    return null
  }

  const launcher = target?.closest?.(moduleLauncherSelector)

  if (!launcher || launcher.closest('.desktop-window')) {
    return null
  }

  return launcher
}

function openModuleWindow(moduleId) {
  if (!isProductionModuleAvailable(moduleId)) {
    return false
  }

  const existingWindow = openWindows.find((windowItem) => windowItem.moduleId === moduleId)

  if (existingWindow) {
    focusWindow(existingWindow.id)
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    isNotificationCenterOpen = false
    resetModuleRefreshStateForOpen(moduleId)
    render()
    void refreshModuleAuthoritativeUpstreams(moduleId, { reason: 'module-reopen' })
    return true
  }

  if (moduleId === 'nhan-vien') {
    staffFilters = clearStaffListFilters(staffFilters)
  }

  const offset = (openWindows.length % 7) * 28

  const nextWindowId = `window-${nextWindowNumber}`
  openWindows.push({
    id: nextWindowId,
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
  focusWindow(nextWindowId)
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false
  resetModuleRefreshStateForOpen(moduleId)
  render()
  void refreshModuleAuthoritativeUpstreams(moduleId, { reason: 'module-open' })
  return true
}

function resetModuleRefreshStateForOpen(moduleId) {
  if (!isBusinessModule(moduleId)) return
  const context = getCurrentCanonicalCenterContext()
  const contextKey = getModuleRefreshContextKey()
  const contract = getModuleRefreshContract(moduleId)
  moduleRefreshStates.set(moduleId, createModuleRefreshState({
    centerId: context.centerId,
    contextKey,
    upstreams: contract.all,
    requiredUpstreams: contract.required,
    optionalUpstreams: contract.optional,
    actionRequiredUpstreams: contract.actionRequired,
    message: context.ok
      ? 'Đang chờ tải dữ liệu mới nhất của cơ sở hiện tại.'
      : 'Chưa xác định được cơ sở đang hoạt động; dữ liệu cũ được ẩn để tránh nhầm lẫn.',
  }))
}

async function refreshModuleAuthoritativeUpstreams(moduleId, { reason = 'manual-refresh' } = {}) {
  const contract = getModuleRefreshContract(moduleId)
  const upstreams = contract.all
  if (!isBusinessModule(moduleId) || !upstreams.length) {
    return { ok: true, skipped: true, upstreams: [] }
  }

  const centerContext = getCurrentCanonicalCenterContext()
  const contextKey = getModuleRefreshContextKey()
  const refreshId = (moduleRefreshRunIds.get(moduleId) || 0) + 1
  moduleRefreshRunIds.set(moduleId, refreshId)
  if (!centerContext.ok) {
    const result = {
      ok: false,
      outcome_code: 'INVALID_CENTER_CONTEXT',
      error: 'Chưa xác định được cơ sở đang hoạt động; chưa thể làm mới dữ liệu.',
    }
    moduleRefreshStates.set(moduleId, createModuleRefreshState({
      status: 'failed',
      contextKey,
      upstreams,
      requiredUpstreams: contract.required,
      optionalUpstreams: contract.optional,
      actionRequiredUpstreams: contract.actionRequired,
      message: result.error,
    }))
    render()
    return result
  }

  moduleRefreshStates.set(moduleId, createModuleRefreshState({
    status: 'loading',
    centerId: centerContext.centerId,
    contextKey,
    upstreams,
    requiredUpstreams: contract.required,
    optionalUpstreams: contract.optional,
    actionRequiredUpstreams: contract.actionRequired,
    upstreamHealth: createLoadingModuleUpstreamHealth(upstreams),
    message: 'Đang tải dữ liệu mới nhất...',
  }))
  render()

  const results = await Promise.all(upstreams.map(async (upstream) => {
    let settledResult
    try {
      const result = await refreshAuthoritativeUpstream(upstream, `${moduleId}:${reason}`)
      settledResult = { upstream, ...(result || { ok: false, outcome_code: 'NO_REFRESH_RESULT' }) }
    } catch (error) {
      settledResult = {
        upstream,
        ok: false,
        outcome_code: 'REFRESH_THROWN',
        error: String(error?.message || error),
      }
    }
    recordModuleUpstreamRefreshResult(moduleId, refreshId, centerContext.centerId, contextKey, settledResult)
    return settledResult
  }))

  const latestContext = getCurrentCanonicalCenterContext()
  const currentState = moduleRefreshStates.get(moduleId)
  if (
    refreshId !== moduleRefreshRunIds.get(moduleId)
    || !latestContext.ok
    || latestContext.centerId !== centerContext.centerId
    || currentState?.centerId !== centerContext.centerId
    || currentState?.contextKey !== contextKey
    || getModuleRefreshContextKey() !== contextKey
  ) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', results }
  }

  const evaluation = evaluateModuleRefreshResults(moduleId, results)
  if (!evaluation.ok) {
    moduleRefreshStates.set(moduleId, createModuleRefreshState({
      status: 'failed',
      centerId: centerContext.centerId,
      contextKey,
      upstreams,
      requiredUpstreams: contract.required,
      optionalUpstreams: contract.optional,
      actionRequiredUpstreams: contract.actionRequired,
      upstreamHealth: evaluation.health,
      message: 'Không thể làm mới dữ liệu lúc này. Thông tin đang hiển thị có thể chưa phải bản mới nhất. Vui lòng thử lại.',
    }))
    render()
    return {
      ok: false,
      outcome_code: 'MODULE_REQUIRED_REFRESH_FAILED',
      results,
      failures: evaluation.requiredFailures,
      evaluation,
    }
  }

  notifications = syncAppNotifications(notifications)
  const lastFreshAt = new Date().toISOString()
  const limitedMessages = evaluation.nonBlockingFailures.map((upstream) => {
    const label = ({
      attendance: 'Dữ liệu điểm danh bổ sung',
      staff: 'Thông tin nhân sự',
      tuition: 'Đối chiếu học phí',
      finance: 'Số đã thu và thanh toán',
      'calendar-notes': moduleId === 'thoi-khoa-bieu'
        ? 'Lịch hoạt động bổ sung'
        : 'Ghi chú chăm sóc theo tháng và ghi chú điểm danh',
    })[upstream] || 'Một phần dữ liệu bổ sung'
    const outcomeCode = evaluation.health?.[upstream]?.outcomeCode || ''
    return upstream === 'calendar-notes' && isUnavailableCalendarNotesOutcome(outcomeCode)
      ? `${label} hiện chưa khả dụng`
      : `${label} hiện chưa tải được`
  })
  moduleRefreshStates.set(moduleId, createModuleRefreshState({
    status: evaluation.status,
    centerId: centerContext.centerId,
    contextKey,
    upstreams,
    requiredUpstreams: contract.required,
    optionalUpstreams: contract.optional,
    actionRequiredUpstreams: contract.actionRequired,
    upstreamHealth: evaluation.health,
    message: evaluation.status === 'limited'
      ? `Dữ liệu chính đã cập nhật. ${limitedMessages.join('; ')}.`
      : 'Đã tải dữ liệu mới nhất.',
    lastFreshAt,
  }))
  render()
  return {
    ok: true,
    limited: evaluation.status === 'limited',
    centerId: centerContext.centerId,
    upstreams,
    results,
    evaluation,
    lastFreshAt,
  }
}

function recordModuleUpstreamRefreshResult(moduleId, refreshId, centerId, contextKey, result) {
  const latestContext = getCurrentCanonicalCenterContext()
  const currentState = moduleRefreshStates.get(moduleId)
  if (
    refreshId !== moduleRefreshRunIds.get(moduleId)
    || !latestContext.ok
    || latestContext.centerId !== centerId
    || currentState?.status !== 'loading'
    || currentState?.centerId !== centerId
    || currentState?.contextKey !== contextKey
    || getModuleRefreshContextKey() !== contextKey
  ) {
    return false
  }

  moduleRefreshStates.set(moduleId, applyModuleUpstreamRefreshResult(currentState, result))
  render()
  return true
}

async function refreshAuthoritativeUpstream(upstream, reason) {
  const centerContext = getCurrentCanonicalCenterContext()
  if (!centerContext.ok) {
    return { ok: false, outcome_code: 'INVALID_CENTER_CONTEXT' }
  }
  const refreshKey = `${centerContext.centerId}:${upstream}`
  const existingRefresh = authoritativeRefreshInFlight.get(refreshKey)
  if (existingRefresh) return existingRefresh

  const refreshPromise = runAuthoritativeUpstreamRefresh(upstream, reason)
    .finally(() => {
      if (authoritativeRefreshInFlight.get(refreshKey) === refreshPromise) {
        authoritativeRefreshInFlight.delete(refreshKey)
      }
    })
  authoritativeRefreshInFlight.set(refreshKey, refreshPromise)
  return refreshPromise
}

async function runAuthoritativeUpstreamRefresh(upstream, reason) {
  switch (upstream) {
    case 'core-student': {
      const centerContext = getCurrentCanonicalCenterContext()
      if (!centerContext.ok) return { ok: false, outcome_code: 'INVALID_CENTER_CONTEXT' }
      return refreshStudentModuleCoreProjection(centerContext.centerId)
    }
    case 'core':
      return bootstrapCoreCloudDataForCurrentCenter(cloudUserSyncId, { force: true })
    case 'attendance': {
      const result = await bootstrapC51AttendanceSessionReportCloudData(cloudUserSyncId, { force: true })
      if (result.ok) await startC51AttendanceRealtimeSubscription(cloudUserSyncId)
      return result
    }
    case 'tuition': {
      const result = await bootstrapC52TuitionRecordPackageCloudData(cloudUserSyncId, { force: true })
      if (result.ok) await startC52TuitionRealtimeSubscription(cloudUserSyncId)
      return result
    }
    case 'crm':
      return refreshC53CrmSharedTruth({ reason, silent: true })
    case 'parent-links':
      return refreshParentStudentLinksSharedTruth({ reason })
    case 'finance':
      // Coordinator parity with the accepted C5.4 entry points:
      // refreshC54FinanceSharedTruth({ reason: 'module-open' })
      // refreshC54FinanceSharedTruth({ reason: 'module-reopen' })
      return refreshC54FinanceSharedTruth({ reason, silent: true })
    case 'staff':
      return refreshC55StaffHrSharedTruth({ reason, silent: true })
    case 'inventory':
      return refreshC56InventorySharedTruth({ reason, silent: true })
    case 'calendar-notes':
      return refreshC57CalendarNotesSharedTruth({ reason, silent: true })
    default:
      return { ok: false, outcome_code: 'UNKNOWN_UPSTREAM', error: `Unknown upstream: ${upstream}` }
  }
}

async function refreshNotificationAuthoritativeUpstreams(reason = 'notification-open') {
  const upstreams = ['core', 'crm', 'tuition', 'inventory']
  const centerContext = getCurrentCanonicalCenterContext()
  const refreshId = ++notificationRefreshRunId
  notificationRefreshState = createModuleRefreshState({
    status: centerContext.ok ? 'loading' : 'failed',
    centerId: centerContext.centerId,
    upstreams,
    message: centerContext.ok
      ? 'Đang tải nguồn tạo thông báo...'
      : 'Chưa xác định được cơ sở đang hoạt động; chưa thể làm mới thông báo.',
  })
  render()
  if (!centerContext.ok) return { ok: false, outcome_code: 'INVALID_CENTER_CONTEXT' }

  const results = await Promise.all(upstreams.map(async (upstream) => {
    try {
      return { upstream, ...(await refreshAuthoritativeUpstream(upstream, reason)) }
    } catch (error) {
      return { upstream, ok: false, error: String(error?.message || error) }
    }
  }))
  const latestContext = getCurrentCanonicalCenterContext()
  if (refreshId !== notificationRefreshRunId || latestContext.centerId !== centerContext.centerId) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', results }
  }

  const failures = results.filter((result) => !result.ok)
  notifications = syncAppNotifications(notifications)
  notificationRefreshState = createModuleRefreshState({
    status: failures.length ? 'failed' : 'fresh',
    centerId: centerContext.centerId,
    upstreams,
    message: failures.length
      ? 'Một hoặc nhiều nguồn dữ liệu chưa tải được; thông báo cũ có thể chưa đầy đủ.'
      : 'Thông báo đã được cập nhật từ dữ liệu mới nhất.',
    lastFreshAt: failures.length ? '' : new Date().toISOString(),
  })
  render()
  return { ok: failures.length === 0, results, failures }
}

function openModuleWindowFromChildInteraction(moduleId) {
  const beforeWindow = openWindows.find((windowItem) => windowItem.moduleId === moduleId)
  if (!openModuleWindow(moduleId)) {
    return
  }
  const targetWindow = beforeWindow || openWindows.find((windowItem) => windowItem.moduleId === moduleId)

  if (!targetWindow) {
    return
  }

  focusWindowAfterRender(targetWindow.id)
}

function openStudentDetailWindowFromChildInteraction(studentId) {
  const beforeWindow = openWindows.find(
    (windowItem) => windowItem.type === 'student-detail' && windowItem.studentId === studentId,
  )
  openStudentDetailWindow(studentId)
  const targetWindow = beforeWindow || openWindows.find(
    (windowItem) => windowItem.type === 'student-detail' && windowItem.studentId === studentId,
  )

  if (!targetWindow) {
    return
  }

  focusWindowAfterRender(targetWindow.id)
}

function focusWindowAfterRender(windowId) {
  pendingWindowFocusAfterRender = windowId
  focusWindow(windowId)
  window.setTimeout(() => {
    focusWindow(windowId)
    render()
  }, 0)
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
  void refreshC56InventorySharedTruth({ reason: 'movement-history-open' })
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
  const nextWindowId = `window-${nextWindowNumber}`

  openWindows.push({
    id: nextWindowId,
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
  focusWindow(nextWindowId)
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
  const currentCenterId = getCurrentResolvedCenterId()
  const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(currentCenterId)
  const transaction = latestCashflowTransactions.find((item) => item.id === transactionId)

  if (!transaction) {
    setCloudUploadMessage('Không tìm thấy giao dịch', 'error')
    cashflowTransactions = latestCashflowTransactions
    render()
    return
  }

  if (isSyncedTuitionPaymentTransaction(transaction)) {
    openCashflowSyncedTransactionDetail(transactionId)
    return
  }

  cashflowTransactions = latestCashflowTransactions
  cashflowTransactionDetailState = null
  cashflowAttachmentHydrateToken += 1
  const hydrateToken = cashflowAttachmentHydrateToken
  cashflowFormState = createEditCashflowFormState(transaction, currentCenterId, {
    hydrateAttachment: true,
  })
  render()
  hydrateCashflowEditAttachment({
    transactionId,
    centerId: currentCenterId,
    hydrateToken,
  })
}

function openCashflowTransactionFromRow(transactionId) {
  const currentCenterId = getCurrentResolvedCenterId()
  const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(currentCenterId)
  const transaction = latestCashflowTransactions.find((item) => item.id === transactionId)

  if (!transaction) {
    cashflowTransactions = latestCashflowTransactions
    setCloudUploadMessage('Không tìm thấy giao dịch', 'error')
    render()
    return
  }

  if (isSyncedTuitionPaymentTransaction(transaction)) {
    openCashflowSyncedTransactionDetail(transactionId, latestCashflowTransactions)
    return
  }

  openCashflowEditForm(transactionId)
}

async function openCashflowSyncedTransactionDetail(transactionId, latestTransactions = null) {
  const currentCenterId = getCurrentResolvedCenterId()
  const latestCashflowTransactions =
    latestTransactions || readLatestCashflowTransactionsForCurrentCenter(currentCenterId)
  const transaction = latestCashflowTransactions.find((item) => item.id === transactionId)

  if (!transaction) {
    cashflowTransactions = latestCashflowTransactions
    setCloudUploadMessage('Không tìm thấy giao dịch', 'error')
    render()
    return
  }

  if (!isCashflowTransactionInCurrentCenter(transaction, currentCenterId)) {
    cashflowTransactions = latestCashflowTransactions
    setCloudUploadMessage('Giao dịch không thuộc cơ sở hiện tại', 'error')
    render()
    return
  }

  if (!isSyncedTuitionPaymentTransaction(transaction)) {
    openCashflowEditForm(transactionId)
    return
  }

  const transactionCode = getCashflowTransactionCodesForTransactions(latestCashflowTransactions)[transaction.id] || ''
  const hydrateToken = cashflowTransactionDetailHydrateToken + 1

  cashflowTransactionDetailHydrateToken = hydrateToken
  cashflowTransactions = latestCashflowTransactions
  revokeCashflowAttachmentDraftObjectUrl()
  cashflowFormState = null
  cashflowTransactionDetailState = {
    transaction: { ...transaction },
    transactionCode,
    centerId: currentCenterId,
    status: transactionCode ? 'loading' : 'loaded',
    error: transactionCode ? '' : 'Không tìm thấy mã giao dịch để tải chứng từ.',
    attachments: [],
    students,
    tuitionRecords,
  }
  render()

  if (!transactionCode) {
    return
  }

  try {
    const result = { ok: true, data: transaction.attachments || [] }

    if (!isCashflowTransactionDetailRequestCurrent(hydrateToken, currentCenterId, transactionId)) {
      return
    }

    const attachments = result.ok ? await addSignedUrlsToAttachments(result.data, currentCenterId) : []

    if (!isCashflowTransactionDetailRequestCurrent(hydrateToken, currentCenterId, transactionId)) {
      return
    }

    cashflowTransactionDetailState = {
      ...cashflowTransactionDetailState,
      status: result.ok ? 'loaded' : 'error',
      error: result.ok ? '' : result.error || 'Không thể tải chứng từ giao dịch.',
      attachments,
    }
    render()
  } catch (error) {
    if (!isCashflowTransactionDetailRequestCurrent(hydrateToken, currentCenterId, transactionId)) {
      return
    }

    cashflowTransactionDetailState = {
      ...cashflowTransactionDetailState,
      status: 'error',
      error: getCloudErrorMessage(error, 'Không thể tải chứng từ giao dịch.'),
      attachments: [],
    }
    render()
  }
}

function isCashflowTransactionDetailRequestCurrent(hydrateToken, centerId, transactionId) {
  return (
    cashflowTransactionDetailHydrateToken === hydrateToken &&
    cashflowTransactionDetailState?.transaction?.id === transactionId &&
    String(cashflowTransactionDetailState?.centerId || '').trim() === String(centerId || '').trim() &&
    String(getCurrentResolvedCenterId() || '').trim() === String(centerId || '').trim()
  )
}

function isCashflowTransactionInCurrentCenter(transaction, currentCenterId) {
  const transactionCenterId = String(
    transaction?.centerId || transaction?.sourceCenterId || transaction?.storageCenterId || '',
  ).trim()

  return !transactionCenterId || transactionCenterId === String(currentCenterId || '').trim()
}

function isSyncedTuitionPaymentTransaction(transaction) {
  return (
    String(transaction?.sourceModule || '') === 'hoc-phi' &&
    String(transaction?.sourceType || '') === 'tuition-payment'
  )
}

function readLatestCashflowTransactionsForCurrentCenter(centerId = getCurrentResolvedCenterId()) {
  const normalizedCenterId = String(centerId || '').trim()
  return normalizedCenterId
    && normalizedCenterId === getCurrentResolvedCenterId()
    && normalizedCenterId === c54FinanceSharedTruthState.centerId
    ? cashflowTransactions
    : []
}

function openTuitionPaymentForm(student, tuitionRecord) {
  if (!student || !tuitionRecord) {
    return
  }

  if (!areModuleActionUpstreamsCurrent('hoc-phi', 'payment')) {
    window.alert('Chưa tải được số đã thu và dữ liệu thanh toán. Vui lòng bấm Làm mới rồi thử lại.')
    return
  }

  const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter()
  const debtAmount = getTuitionDebtAmount(tuitionRecord, latestCashflowTransactions)
  const mode =
    debtAmount > 0 &&
    !hasUnreconciledLegacyTuitionPaidAmount(tuitionRecord, latestCashflowTransactions)
      ? 'collect'
      : 'history'
  const nextState = createPaymentFormState(student, tuitionRecord, mode)

  tuitionPaymentFormState = {
    ...nextState,
    centerId: getCurrentResolvedCenterId(),
    periodId: getCurrentTuitionPeriodId(tuitionRecord),
    values: {
      ...nextState.values,
      amount: mode === 'collect' ? formatMoneyInputForRuntime(debtAmount) : '',
      payerName: student.parentName || nextState.values.payerName,
      collectorName: getCurrentPaymentCollectorName(),
    },
  }
  tuitionFormState = null
  tuitionDetailState = null
  tuitionRollbackPreviewState = null
  tuitionCareNoteState = null
  tuitionAdvisoryWindowState = null
  render()
}

function openTuitionPaymentSourceTransaction(transactionId) {
  const currentCenterId = getCurrentResolvedCenterId()
  const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(currentCenterId)
  const transaction = latestCashflowTransactions.find((item) => item.id === transactionId)

  if (!transaction || !isSyncedTuitionPaymentTransaction(transaction)) {
    setCloudUploadMessage('Không tìm thấy giao dịch Thu chi nguồn trong cơ sở hiện tại.', 'error')
    cashflowTransactions = latestCashflowTransactions
    render()
    return
  }

  cashflowTransactions = latestCashflowTransactions
  cashflowFilters = {
    ...initialCashflowFilters,
    query: transaction.id,
  }
  cashflowFormState = null
  openModuleWindowFromChildInteraction('thu-chi')
  setCloudUploadMessage(
    'Đã mở giao dịch Thu chi nguồn. Giao dịch đồng bộ từ Học phí đang ở chế độ bảo vệ.',
    'success',
  )
}

function getCurrentPaymentCollectorName() {
  return (
    cloudStatus.currentMemberProfile?.displayName ||
    cloudStatus.currentMemberProfile?.fullName ||
    cloudStatus.user?.user_metadata?.full_name ||
    cloudStatus.user?.email ||
    'Admin'
  )
}

function formatMoneyInputForRuntime(amount) {
  return Number(amount || 0).toLocaleString('vi-VN')
}

async function hydrateCashflowEditAttachment({ transactionId, centerId, hydrateToken }) {
  const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(centerId)
  const transaction = latestCashflowTransactions.find((item) => item.id === transactionId)

  if (!transaction) {
    applyCashflowAttachmentHydrateResult({
      transactionId,
      centerId,
      hydrateToken,
      draft: createErrorCashflowAttachmentDraft(
        'Giao dịch này không còn tồn tại.',
        null,
      ),
      attachment: null,
    })
    return
  }

  const transactionCode = getCashflowTransactionCodesForTransactions(latestCashflowTransactions)[transaction.id]
  const legacyAttachment = transaction.attachment || null
  const result = transactionCode
    ? { ok: true, data: transaction.attachments || [] }
    : { ok: true, data: [] }

  if (!result.ok) {
    applyCashflowAttachmentHydrateResult({
      transactionId,
      centerId,
      hydrateToken,
      draft: createErrorCashflowAttachmentDraft(result.error, legacyAttachment),
      attachment: legacyAttachment,
    })
    return
  }

  const cloudAttachment = getPrimaryCashflowCloudAttachment(result.data, transactionCode)

  if (cloudAttachment) {
    const signedUrlResult = await createTransactionImageSignedUrl(
      cloudAttachment.storagePath,
      60 * 10,
      centerId,
    )
    const hydratedCloudAttachment = {
      ...cloudAttachment,
      signedUrl: signedUrlResult.ok ? signedUrlResult.data.signedUrl : '',
      signedUrlError: signedUrlResult.ok ? '' : signedUrlResult.error,
    }

    applyCashflowAttachmentHydrateResult({
      transactionId,
      centerId,
      hydrateToken,
      draft: {
        ...createCashflowAttachmentDraftFromExisting(hydratedCloudAttachment, 'cloud'),
        error: signedUrlResult.ok
          ? ''
          : signedUrlResult.error || 'Không thể tải ảnh xem trước.',
      },
      attachment: hydratedCloudAttachment,
    })
    return
  }

  applyCashflowAttachmentHydrateResult({
    transactionId,
    centerId,
    hydrateToken,
    draft: legacyAttachment
      ? createCashflowAttachmentDraftFromExisting(legacyAttachment, 'legacy')
      : createEmptyCashflowAttachmentDraft(),
    attachment: legacyAttachment,
  })
}

function applyCashflowAttachmentHydrateResult({
  transactionId,
  centerId,
  hydrateToken,
  draft,
  attachment,
}) {
  if (
    hydrateToken !== cashflowAttachmentHydrateToken ||
    !cashflowFormState ||
    cashflowFormState.mode !== 'edit' ||
    cashflowFormState.transactionId !== transactionId ||
    String(cashflowFormState.centerId || '').trim() !== String(centerId || '').trim() ||
    String(getCurrentResolvedCenterId() || '').trim() !== String(centerId || '').trim()
  ) {
    return
  }

  const currentDraft = cashflowFormState.attachmentDraft || createEmptyCashflowAttachmentDraft()
  if (currentDraft.mode !== 'loading') {
    return
  }

  cashflowFormState = {
    ...cashflowFormState,
    attachmentDraft: draft,
    values: {
      ...cashflowFormState.values,
      attachment,
    },
    errors: {
      ...cashflowFormState.errors,
      attachment: undefined,
    },
  }

  syncCashflowEvidencePreview()
}

function getPrimaryCashflowCloudAttachment(attachments = [], transactionCode = '') {
  return attachments
    .map((attachment) => createCashflowCloudAttachmentReference(attachment, transactionCode))
    .filter(Boolean)
    .sort((first, second) =>
      String(second.createdAt || '').localeCompare(String(first.createdAt || '')),
    )[0] || null
}

function createCashflowCloudAttachmentReference(attachment, transactionCode = '') {
  const storagePath = String(attachment?.storagePath || '').trim()
  const mimeType = String(attachment?.mimeType || attachment?.type || '').trim().toLowerCase()

  if (!storagePath || !mimeType.startsWith('image/')) {
    return null
  }

  return {
    id: String(attachment.id || `attachment-${Date.now()}`),
    metadataId: String(attachment.metadataId || attachment.id || ''),
    name: String(attachment.fileName || attachment.name || attachment.originalName || 'anh-giao-dich'),
    originalName: String(attachment.originalName || ''),
    fileName: String(attachment.fileName || attachment.name || 'anh-giao-dich'),
    type: mimeType,
    mimeType,
    size: Number(attachment.sizeBytes || attachment.size || 0),
    sizeBytes: Number(attachment.sizeBytes || attachment.size || 0),
    storageBucket: String(attachment.storageBucket || 'transaction-images'),
    storagePath,
    transactionCode: String(attachment.transactionCode || transactionCode || ''),
    uploadedAt: attachment.createdAt || attachment.uploadedAt || '',
    uploadedBy: String(attachment.uploadedBy || ''),
    uploadedByName: String(attachment.uploadedByName || ''),
    createdAt: attachment.createdAt || attachment.uploadedAt || '',
    centerId: String(attachment.centerId || ''),
  }
}

function collectCashflowFormValues(form, fallbackValues = {}) {
  const values = { ...fallbackValues }

  form?.querySelectorAll('[data-cashflow-form-field]').forEach((control) => {
    values[control.dataset.cashflowFormField] = control.value
  })

  return values
}

function createCashflowFormErrorState(formState, message, values = formState?.values || {}) {
  return {
    ...formState,
    isSaving: false,
    values,
    errors: {
      ...(formState?.errors || {}),
      form: message,
    },
  }
}

function revokeCashflowAttachmentDraftObjectUrl(formState = cashflowFormState) {
  const objectUrl = formState?.attachmentDraft?.objectUrl

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
  }
}

function clearCashflowAttachmentDraft() {
  revokeCashflowAttachmentDraftObjectUrl()
  cashflowFormState = null
  cashflowAttachmentHydrateToken += 1
  const input = document.querySelector('[data-cashflow-evidence-input]')
  if (input) {
    input.value = ''
  }
}

function revokeTuitionPaymentAttachmentDraftObjectUrl(formState = tuitionPaymentFormState) {
  const objectUrl = formState?.attachmentDraft?.objectUrl

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
  }
}

function clearTuitionPaymentFormState() {
  revokeTuitionPaymentAttachmentDraftObjectUrl()
  tuitionPaymentFormState = null
}

function updateTuitionPaymentAttachmentDraft(nextDraft) {
  if (!tuitionPaymentFormState) {
    return
  }

  tuitionPaymentFormState = {
    ...tuitionPaymentFormState,
    attachmentDraft: nextDraft,
    errors: {
      ...tuitionPaymentFormState.errors,
      attachment: undefined,
    },
  }

  syncTuitionPaymentEvidencePreview()
}

function stageTuitionPaymentEvidenceFile(file) {
  if (!tuitionPaymentFormState) {
    return
  }

  const validation = validateTransactionImageFile(file)

  if (!validation.ok) {
    updateTuitionPaymentAttachmentDraft({
      ...(tuitionPaymentFormState.attachmentDraft || {}),
      error: validation.error,
    })
    return
  }

  revokeTuitionPaymentAttachmentDraftObjectUrl()
  updateTuitionPaymentAttachmentDraft({
    mode: 'staged-new',
    file,
    fileName: validation.data.name,
    mimeType: validation.data.mimeType,
    sizeBytes: validation.data.sizeBytes,
    objectUrl: URL.createObjectURL(file),
    error: '',
    isUploading: false,
  })
}

function removeTuitionPaymentEvidenceDraft() {
  if (!tuitionPaymentFormState) {
    return
  }

  revokeTuitionPaymentAttachmentDraftObjectUrl()
  updateTuitionPaymentAttachmentDraft({
    mode: 'none',
    fileName: '',
    mimeType: '',
    sizeBytes: 0,
    objectUrl: '',
    error: '',
    isUploading: false,
  })
}

function syncTuitionPaymentEvidencePreview() {
  const field = document.querySelector('[data-tuition-payment-evidence-field]')

  if (!field || !tuitionPaymentFormState) {
    return
  }

  const draft = tuitionPaymentFormState.attachmentDraft || {}
  const hasStaged = draft.mode === 'staged-new' && draft.objectUrl
  const error = tuitionPaymentFormState.errors.attachment || draft.error || ''

  field.classList.toggle('has-error', Boolean(error))
  field.innerHTML = `
    <span>Chứng từ</span>
    <input
      type="file"
      accept="${escapeAttributeForRuntime(CASHFLOW_EVIDENCE_ACCEPT)}"
      data-tuition-payment-evidence-input
      tabindex="-1"
      ${tuitionPaymentFormState.isSaving ? 'disabled' : ''}
    />
    ${
      hasStaged
        ? `
          <div class="cashflow-evidence-preview" data-tuition-payment-evidence-preview>
            <img src="${escapeAttributeForRuntime(draft.objectUrl)}" alt="${escapeAttributeForRuntime(draft.fileName || 'Ảnh chứng từ')}" />
            <div>
              <strong title="${escapeAttributeForRuntime(draft.fileName)}">${escapeHtmlForRuntime(draft.fileName || 'Ảnh chứng từ')}</strong>
              <small>${escapeHtmlForRuntime(draft.mimeType || 'image/*')} · ${formatFileSize(draft.sizeBytes)}</small>
              <small>Ảnh mới, sẽ tải lên khi lưu</small>
            </div>
            <div class="cashflow-evidence-actions">
              <button type="button" data-tuition-payment-evidence-action="preview">Xem trước</button>
              <button type="button" data-tuition-payment-evidence-action="replace">Thay ảnh</button>
              <button type="button" data-tuition-payment-evidence-action="remove">Gỡ</button>
            </div>
          </div>
        `
        : `
          <div class="cashflow-evidence-empty" data-tuition-payment-evidence-preview>
            <button type="button" data-tuition-payment-evidence-action="insert" ${tuitionPaymentFormState.isSaving ? 'disabled' : ''}>Chèn ảnh</button>
            <small>Không có chứng từ</small>
          </div>
        `
    }
    ${error ? `<small>${escapeHtmlForRuntime(error)}</small>` : ''}
  `

  bindTuitionPaymentEvidenceControls(field)
}

function bindTuitionPaymentEvidenceControls(root = document) {
  const input = root.querySelector('[data-tuition-payment-evidence-input]')

  root.querySelectorAll('[data-tuition-payment-evidence-action="insert"], [data-tuition-payment-evidence-action="replace"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      input?.click()
    })
  })

  root.querySelector('[data-tuition-payment-evidence-action="remove"]')?.addEventListener('click', (event) => {
    event.stopPropagation()
    removeTuitionPaymentEvidenceDraft()
  })

  root.querySelector('[data-tuition-payment-evidence-action="preview"]')?.addEventListener('click', (event) => {
    event.stopPropagation()
    const objectUrl = tuitionPaymentFormState?.attachmentDraft?.objectUrl

    if (objectUrl && isSafeImagePreviewUrl(objectUrl)) {
      window.open(objectUrl, '_blank', 'noopener,noreferrer')
    }
  })

  input?.addEventListener('click', (event) => {
    event.stopPropagation()
  })

  input?.addEventListener('change', (event) => {
    event.stopPropagation()
    const file = event.target.files?.[0]

    if (file) {
      stageTuitionPaymentEvidenceFile(file)
    }
  })
}

function updateCashflowAttachmentDraft(nextDraft) {
  if (!cashflowFormState) {
    return
  }

  cashflowFormState = {
    ...cashflowFormState,
    attachmentDraft: nextDraft,
    errors: {
      ...cashflowFormState.errors,
      attachment: undefined,
    },
  }

  syncCashflowEvidencePreview()
}

function stageCashflowEvidenceFile(file) {
  if (!cashflowFormState) {
    return
  }

  const previousDraft = cashflowFormState.attachmentDraft || createEmptyCashflowAttachmentDraft()
  const validation = validateTransactionImageFile(file)

  if (!validation.ok) {
    updateCashflowAttachmentDraft({
      ...previousDraft,
      error: validation.error,
    })
    return
  }

  revokeCashflowAttachmentDraftObjectUrl(cashflowFormState)
  updateCashflowAttachmentDraft({
    mode: 'staged-new',
    file,
    fileName: validation.data.name,
    mimeType: validation.data.mimeType,
    sizeBytes: validation.data.sizeBytes,
    objectUrl: URL.createObjectURL(file),
    existingAttachment: previousDraft.existingAttachment || null,
    source: previousDraft.source || '',
    error: '',
    isUploading: false,
  })
}

function removeCashflowEvidenceDraft() {
  if (!cashflowFormState) {
    return
  }

  const previousDraft = cashflowFormState.attachmentDraft || createEmptyCashflowAttachmentDraft()
  revokeCashflowAttachmentDraftObjectUrl(cashflowFormState)

  updateCashflowAttachmentDraft({
    ...createEmptyCashflowAttachmentDraft(),
    mode:
      previousDraft.mode === 'staged-new' && previousDraft.existingAttachment
        ? `keep-existing-${previousDraft.source || 'legacy'}`
        : previousDraft.existingAttachment
          ? 'remove-existing'
          : 'none',
    existingAttachment: previousDraft.existingAttachment || null,
    source: previousDraft.existingAttachment ? previousDraft.source || 'legacy' : '',
  })

  const input = document.querySelector('[data-cashflow-evidence-input]')
  if (input) {
    input.value = ''
  }
}

function syncCashflowEvidencePreview() {
  const field = document.querySelector('[data-cashflow-evidence-field]')

  if (!field || !cashflowFormState) {
    return
  }

  const draft = cashflowFormState.attachmentDraft || createEmptyCashflowAttachmentDraft()
  const existing = draft.existingAttachment
  const hasStaged = draft.mode === 'staged-new' && draft.objectUrl
  const hasExisting = isKeepExistingCashflowAttachmentDraft(draft) && existing
  const isRemoved = draft.mode === 'remove-existing'
  const isLoading = draft.mode === 'loading'
  const isError = draft.mode === 'error'
  const summary = hasStaged
    ? {
        name: draft.fileName || 'anh-giao-dich',
        type: draft.mimeType || 'image/*',
        size: draft.sizeBytes,
        imageUrl: draft.objectUrl,
        status: 'Ảnh mới, sẽ tải lên khi lưu',
      }
    : hasExisting
      ? {
          name: getCashflowAttachmentDisplayName(existing),
          type: existing.mimeType || existing.type || 'image/*',
          size: existing.sizeBytes || existing.size || 0,
          imageUrl: existing.dataUrl || existing.signedUrl || '',
          status: draft.source === 'cloud' ? 'Có chứng từ' : 'Chứng từ legacy hiện có',
        }
      : null
  const error = cashflowFormState.errors.attachment || draft.error || ''
  const input = field.querySelector('[data-cashflow-evidence-input]')

  field.classList.toggle('has-error', Boolean(error))
  field.innerHTML = `
    <span>Chứng từ</span>
    <input
      type="file"
      accept="${escapeAttributeForRuntime(CASHFLOW_EVIDENCE_ACCEPT)}"
      data-cashflow-evidence-input
      tabindex="-1"
      ${cashflowFormState.isSaving ? 'disabled' : ''}
    />
    ${
      summary
        ? `
          <div class="cashflow-evidence-preview" data-cashflow-evidence-preview>
            ${
              summary.imageUrl
                ? `<img src="${escapeAttributeForRuntime(summary.imageUrl)}" alt="${escapeAttributeForRuntime(summary.name)}" />`
                : '<div class="cashflow-evidence-thumb" aria-hidden="true">IMG</div>'
            }
            <div>
              <strong title="${escapeAttributeForRuntime(summary.name)}">${escapeHtmlForRuntime(summary.name)}</strong>
              <small>${escapeHtmlForRuntime(summary.type)} · ${formatFileSize(summary.size)}</small>
              <small>${escapeHtmlForRuntime(summary.status)}</small>
            </div>
            <div class="cashflow-evidence-actions">
              <button type="button" data-cashflow-evidence-action="preview">Xem trước</button>
              <button type="button" data-cashflow-evidence-action="replace">Thay ảnh</button>
              <button type="button" data-cashflow-evidence-action="remove">Gỡ</button>
            </div>
          </div>
        `
        : isLoading
          ? `
          <div class="cashflow-evidence-empty is-loading" data-cashflow-evidence-preview>
            <button type="button" data-cashflow-evidence-action="insert" disabled>Chèn ảnh</button>
            <small>Đang tải chứng từ...</small>
          </div>
        `
          : isError
            ? `
          <div class="cashflow-evidence-empty is-error" data-cashflow-evidence-preview>
            <button type="button" data-cashflow-evidence-action="insert" disabled>Chèn ảnh</button>
            <small>Không thể tải thông tin chứng từ</small>
          </div>
        `
            : `
          <div class="cashflow-evidence-empty" data-cashflow-evidence-preview>
            <button type="button" data-cashflow-evidence-action="insert">Chèn ảnh</button>
            <small>${isRemoved ? 'Chứng từ sẽ được gỡ khi lưu.' : 'Không có chứng từ'}</small>
          </div>
        `
    }
    ${error ? `<small>${escapeHtmlForRuntime(error)}</small>` : ''}
  `

  const nextInput = field.querySelector('[data-cashflow-evidence-input]')
  if (input?.files?.length && nextInput) {
    nextInput.value = ''
  }
  bindCashflowEvidenceControls(field)
}

function bindCashflowEvidenceControls(root = document) {
  const input = root.querySelector('[data-cashflow-evidence-input]')

  root.querySelectorAll('[data-cashflow-evidence-action="insert"], [data-cashflow-evidence-action="replace"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      if (input) {
        input.value = ''
        input.click()
      }
    })
  })

  root.querySelector('[data-cashflow-evidence-action="remove"]')?.addEventListener('click', (event) => {
    event.stopPropagation()
    removeCashflowEvidenceDraft()
  })

  root.querySelector('[data-cashflow-evidence-action="preview"]')?.addEventListener('click', async (event) => {
    event.stopPropagation()
    await previewCashflowEvidenceDraft()
  })

  input?.addEventListener('click', (event) => {
    event.stopPropagation()
  })

  input?.addEventListener('change', (event) => {
    event.stopPropagation()
    const file = event.target.files?.[0]

    if (file) {
      stageCashflowEvidenceFile(file)
    }
  })
}

async function previewCashflowEvidenceDraft() {
  const draft = cashflowFormState?.attachmentDraft
  const attachment = draft?.existingAttachment
  let previewUrl = draft?.mode === 'staged-new' ? draft.objectUrl : ''

  if (!previewUrl && attachment?.dataUrl) {
    previewUrl = attachment.dataUrl
  }

  if (!previewUrl && attachment?.storagePath) {
    const centerId = String(cashflowFormState?.centerId || getCurrentResolvedCenterId()).trim()
    const signedUrlResult = await createTransactionImageSignedUrl(
      attachment.storagePath,
      60 * 10,
      centerId,
    )

    if (!signedUrlResult.ok) {
      updateCashflowAttachmentDraft({
        ...draft,
        error: signedUrlResult.error || 'Không thể xem trước chứng từ.',
      })
      return
    }

    previewUrl = signedUrlResult.data.signedUrl
  }

  if (!isSafeImagePreviewUrl(previewUrl)) {
    updateCashflowAttachmentDraft({
      ...draft,
      error: 'Không thể xem trước chứng từ.',
    })
    return
  }

  window.open(previewUrl, '_blank', 'noopener,noreferrer')
}

function isSafeImagePreviewUrl(value) {
  const url = String(value || '').trim()
  return (
    url.startsWith('blob:') ||
    url.startsWith('data:image/') ||
    url.startsWith('https://') ||
    url.startsWith('http://localhost') ||
    url.startsWith('http://127.0.0.1')
  )
}

function getCashflowAttachmentDisplayName(attachment) {
  return String(
    attachment?.fileName ||
      attachment?.name ||
      attachment?.originalName ||
      'Ảnh giao dịch',
  )
}

function isKeepExistingCashflowAttachmentDraft(draft) {
  return ['keep-existing', 'keep-existing-cloud', 'keep-existing-legacy'].includes(draft?.mode)
}

function escapeHtmlForRuntime(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttributeForRuntime(value) {
  return escapeHtmlForRuntime(value)
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

function syncInventoryMovementToCashflow(movement, item) {
  // Inventory is outside C5.4. Never manufacture a local-only financial row;
  // an explicit cross-module server command is deferred to the Inventory wave.
  return { ok: false, deferred: true, movementId: movement?.id || '', itemId: item?.id || '' }
}

function getCashflowMethodFromTuitionPayment(method) {
  const methodLabels = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    other: 'Khác',
  }

  return methodLabels[method] ?? 'Khác'
}

function buildTuitionPaymentTransactionNote(note, student, tuitionRecord) {
  const baseNote = String(note || '').trim()
  const periodLabel = `Kỳ ${tuitionRecord.currentTermNumber || 1}`
  const defaultNote = `Đồng bộ từ Học phí: ${student.fullName} · ${periodLabel}`

  return baseNote ? `${defaultNote} · ${baseNote}` : defaultNote
}

function focusWindow(windowId) {
  bringWindowToFront(windowId)
}

function bringWindowToFront(windowId) {
  const targetWindow = openWindows.find((windowItem) => windowItem.id === windowId)

  if (!targetWindow) {
    return
  }

  const nextZIndex = ++topZIndex

  openWindows = [
    ...openWindows.filter((windowItem) => windowItem.id !== windowId),
    {
      ...targetWindow,
      minimized: false, zIndex: nextZIndex,
    },
  ]
}

async function handleTeacherFormSave(event = null) {
  event?.preventDefault?.()

  if (!teacherFormState) {
    return
  }

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
  const commandIdempotencyKey = teacherFormState.commandIdempotencyKey || createCoreCommandIdempotencyKey()
  const commandLocalId = teacherFormState.commandLocalId || `teacher-${Date.now()}`
  teacherFormState = { ...teacherFormState, commandIdempotencyKey, commandLocalId }

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
    savedTeacher = updatedTeacher
  } else {
    const createdTeacher = buildTeacherFromForm(teacherFormState.values)
    savedTeacher = { ...createdTeacher, id: commandLocalId }
  }

  const result = await commitTeacherProjection(savedTeacher, 'teacher-save', commandIdempotencyKey)

  if (!result.ok) {
    teacherFormState = {
      ...teacherFormState,
      errors: { ...teacherFormState.errors, form: result.error || 'Giáo viên chưa được lưu.' },
    }
    render()
    return
  }

  selectedTeacherId = result.entity.id
  teacherFormState = null
  render()
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
  const closingWindow = openWindows.find((windowItem) => windowItem.id === windowId)
  if (closingWindow?.type === 'staff-administrative-profile') {
    const closingState = getStaffAdministrativeProfileWindowState(windowId)
    clearStaffDocumentAttachmentRuntime(windowId)
    staffAdministrativeProfileWindowStates.delete(windowId)
    staffDocumentWindowStates.delete(windowId)
    staffAdministrativeGovernanceWindowStates.delete(windowId)
    savingStaffDocumentWindowIds.delete(windowId)
    savingStaffAdministrativeGovernanceWindowIds.delete(windowId)
    if (closingState?.isSaving) {
      isStaffAdministrativeProfileSaving = false
    }
  }

  const remainingWindows = openWindows.filter((windowItem) => windowItem.id !== windowId)
  const nextActiveWindow = remainingWindows
    .filter((windowItem) => !windowItem.minimized)
    .reduce(
      (activeWindow, windowItem) =>
        !activeWindow || windowItem.zIndex > activeWindow.zIndex ? windowItem : activeWindow,
      null,
    )

  openWindows = remainingWindows.map((windowItem) =>
    nextActiveWindow && windowItem.id === nextActiveWindow.id
      ? { ...windowItem, zIndex: ++topZIndex }
      : windowItem,
  )
  render()
}

async function softDeleteStudent(studentId) {
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

  const deletedStudent = {
    ...student,
    isDeleted: true,
    deletedAt,
    updatedAt: deletedAt,
  }
  const result = await commitStudentProjection(deletedStudent, 'student-delete')

  if (!result.ok) {
    window.alert(result.userMessage || result.error || 'Hồ sơ học viên chưa được xóa.')
    render()
    return
  }

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
    active: 'Đang vận hành',
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
  const hasSettledMembership = ['loading', 'loaded', 'missing', 'denied', 'error'].includes(
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
    resetParentFirstRuntimeForAccessBoundary('')
    resetC55StaffHrRuntimeForAccessBoundary('')
    resetC56InventoryRuntimeForAccessBoundary('')
    resetC57CalendarNotesRuntimeForAccessBoundary('')
    stopStudentRealtimeSubscription()
    stopTeacherRealtimeSubscription()
    stopScheduleSessionRealtimeSubscription()
    stopC51AttendanceRealtimeSubscription()
    stopC52TuitionRealtimeSubscription()
    transactionImageManagerState = null
    cloudGalleryState = null
    cashflowTransactionDetailState = null
    cashflowTransactionDetailHydrateToken += 1
    cloudDbState = createInitialCloudDbState()
    cloudBootstrapState = createInitialCloudBootstrapState()
    cloudDbAutoPullUserId = ''
    c51AttendanceAutoPullUserId = ''
    c52TuitionAutoPullUserId = ''
    c52AttendanceRetryCommands.clear()
    c51AttendanceCloudWriteRunId += 1
    c52TuitionCloudWriteRunId += 1
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
      deniedMemberships: [],
      accessDeniedReason: '',
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
  // Withhold every prior Staff/HR projection and sensitive draft before this
  // account's exact-center membership is resolved. Browser reuse must never
  // inherit the previous account's in-memory HR state.
  resetParentFirstRuntimeForAccessBoundary('')
  resetC55StaffHrRuntimeForAccessBoundary('')
  resetC56InventoryRuntimeForAccessBoundary('')
  resetC57CalendarNotesRuntimeForAccessBoundary('')

  cloudStatus = {
    ...cloudStatus,
    authStatus: 'signed-in',
    user,
    role: null,
    centerId: '',
    centerName: '',
    membership: null,
    memberships: [],
    deniedMemberships: [],
    accessDeniedReason: '',
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
    c52AttendanceRetryCommands.clear()
    c51AttendanceCloudWriteRunId += 1
    c52TuitionCloudWriteRunId += 1
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
      reloadLocalDataForResolvedCenter()
    } else {
      stopStudentRealtimeSubscription()
      stopTeacherRealtimeSubscription()
      stopScheduleSessionRealtimeSubscription()
      stopC51AttendanceRealtimeSubscription()
      stopC52TuitionRealtimeSubscription()
      transactionImageManagerState = null
      cloudGalleryState = null
      cashflowTransactionDetailState = null
      cashflowTransactionDetailHydrateToken += 1
      cloudDbState = createInitialCloudDbState()
      cloudBootstrapState = createInitialCloudBootstrapState()
      cloudDbAutoPullUserId = ''
      c51AttendanceAutoPullUserId = ''
      c52TuitionAutoPullUserId = ''
      c52AttendanceRetryCommands.clear()
      c51AttendanceCloudWriteRunId += 1
      c52TuitionCloudWriteRunId += 1
      cloudBootstrapRetryBlockedUntil = 0
      cloudBootstrapLastFailureSignature = ''

      cloudStatus = {
        ...cloudStatus,
        role: null,
        centerId: resolvedMembership.centerId,
        centerName: resolvedMembership.centerName,
        membership: null,
        memberships: resolvedMembership.memberships || [],
        deniedMemberships:
          resolvedMembership.deniedMemberships || resolvedMembership.memberships || [],
        accessDeniedReason: resolvedMembership.accessDeniedReason || 'unknown',
        membershipStatus: 'denied',
        message: resolvedMembership.message,
        attachments: [],
        attachmentsStatus: 'idle',
        attachmentsError: '',
      }
      render()
      return
    }

    cloudStatus = {
      ...cloudStatus,
      role: resolvedMembership.role ?? null,
      centerId: resolvedMembership.centerId,
      centerName: resolvedMembership.centerName,
      membership: resolvedMembership.membership,
      memberships: resolvedMembership.memberships,
      deniedMemberships: resolvedMembership.deniedMemberships || [],
      accessDeniedReason: '',
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
      deniedMemberships: [],
      accessDeniedReason: '',
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
    await refreshParentStudentLinksSharedTruth({ reason: 'capability-probe' })
    await loadCenterMemberProfiles(syncId)
    await loadCurrentMonthCloudAttachments(syncId)
    await startStudentRealtimeSubscription(syncId)
    await startTeacherRealtimeSubscription(syncId)
    await startScheduleSessionRealtimeSubscription(syncId)
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
  const hasMembership =
    status.membershipStatus === 'loaded' && isTransactionAttachmentRoleAllowed(status.role)

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
  }
}

function getCloudDbLocalCounts() {
  return {
    [CLOUD_ENTITY_TYPES.STUDENT]: students.filter((student) => !student.isDeleted).length,
    [CLOUD_ENTITY_TYPES.TEACHER]: teachers.length,
    [CLOUD_ENTITY_TYPES.CLASS_SESSION]: classSessions.length,
  }
}

function canUseCoreCloudDb() {
  return buildCurrentOnlineAccessState({ cloudReady: true }).canRead
}

function isCoreCloudDbReady() {
  return canWriteCoreCloudDb() && cloudDbState.readinessStatus === 'ready'
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

function upsertCommittedCoreProjection(items, entity) {
  const source = Array.isArray(items) ? items : []
  const entityId = String(entity?.id || '').trim()

  if (!entityId) {
    return source
  }

  const existingIndex = source.findIndex((item) => String(item?.id || '') === entityId)

  if (existingIndex < 0) {
    return [entity, ...source]
  }

  return source.map((item, index) => index === existingIndex ? { ...item, ...entity } : item)
}

async function getAuthoritativeCoreCommandContext(entityType, requestedCenterId) {
  const centerContext = getCurrentCanonicalCenterContext()
  const centerId = String(requestedCenterId || centerContext.centerId || '').trim()
  if (!centerContext.ok || !centerId || centerContext.centerId !== centerId) {
    return {
      ok: false,
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: 'Cơ sở hiện tại đã thay đổi. Dữ liệu chưa được lưu.',
    }
  }

  // Do not decide command authorization from the UI's cached membership.
  // The exact-center membership below is read again immediately before RPC.
  const context = await getCloudDbContext(centerId)
  if (!context.ok || context.centerId !== centerId) return context

  const accessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(context.user),
    user: context.user,
    centerId: context.centerId,
    membership: context.membership,
    role: context.membership?.role,
    cloudReady: true,
  })
  if (!canWriteEntity(accessState, entityType)) {
    return {
      ok: false,
      outcome_code: 'WRITE_ROLE_REQUIRED',
      error: 'Vai trò hiện tại chỉ được xem, không được sửa dữ liệu dùng chung.',
    }
  }

  return { ...context, ready: true, accessState }
}

async function refreshAuthoritativeCoreProjectionAfterCommit(entityType, centerId, committedEntity) {
  const context = await getCloudDbContext(centerId)
  if (!context.ok || context.centerId !== centerId) return context

  const result = entityType === CLOUD_ENTITY_TYPES.SCHEDULE_SESSION
    ? await listScheduleSessionCloudPayloads({ supabase: context.supabase, centerId })
    : await listCloudEntityPayloads({ supabase: context.supabase, centerId, entityType })
  if (!result.ok) return result

  const projection = Array.isArray(result.data) ? result.data : []
  const committedId = String(committedEntity?.id || '').trim()
  if (committedId && !projection.some((item) => String(item?.id || '') === committedId)) {
    return {
      ok: false,
      outcome_code: 'COMMITTED_ENTITY_NOT_VISIBLE',
      error: 'Server đã commit nhưng snapshot làm mới chưa chứa bản ghi vừa lưu.',
    }
  }

  const latestCenterContext = getCurrentCanonicalCenterContext()
  if (!latestCenterContext.ok || latestCenterContext.centerId !== centerId) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Cơ sở đã thay đổi sau khi server commit.' }
  }

  if (entityType === CLOUD_ENTITY_TYPES.STUDENT) {
    students = projection
    saveStoredStudents(students)
  } else if (entityType === CLOUD_ENTITY_TYPES.CLASS_SESSION) {
    classSessions = projection
    saveStoredClassSessions(classSessions)
  } else if (entityType === CLOUD_ENTITY_TYPES.SCHEDULE_SESSION) {
    scheduleSessions = projection.filter((item) => !item?.isDeleted)
    saveStoredSchedule(scheduleSessions)
  }

  return { ok: true, centerId, entityType, data: projection }
}

async function refreshStudentModuleCoreProjection(centerId) {
  const context = await getCloudDbContext(centerId)
  if (!context.ok || context.centerId !== centerId) return context

  // The Student view consumes Teacher/Class references, but not Schedule.
  // Validate all three exact-center snapshots before replacing any projection.
  const [studentResult, teacherResult, classResult] = await Promise.all([
    listCloudEntityPayloads({
      supabase: context.supabase,
      centerId,
      entityType: CLOUD_ENTITY_TYPES.STUDENT,
    }),
    listCloudEntityPayloads({
      supabase: context.supabase,
      centerId,
      entityType: CLOUD_ENTITY_TYPES.TEACHER,
    }),
    listCloudEntityPayloads({
      supabase: context.supabase,
      centerId,
      entityType: CLOUD_ENTITY_TYPES.CLASS_SESSION,
    }),
  ])
  const failedResult = [studentResult, teacherResult, classResult].find((result) => !result.ok)
  if (failedResult) return failedResult

  const latestCenterContext = getCurrentCanonicalCenterContext()
  if (!latestCenterContext.ok || latestCenterContext.centerId !== centerId) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Cơ sở đã thay đổi trong lúc làm mới dữ liệu.' }
  }

  students = studentResult.data
  teachers = teacherResult.data
  classSessions = classResult.data
  saveStoredStudents(students)
  saveStoredTeachers(teachers)
  saveStoredClassSessions(classSessions)
  return {
    ok: true,
    centerId,
    data: {
      students,
      teachers,
      classSessions,
    },
  }
}

function applyAuthoritativeCoreSaveUiResult(result) {
  const technicalMessage = result.committed
    ? result.technicalRefreshError
    : result.technicalError
  if (technicalMessage) {
    console.warn('[C5.1 core save recovery]', result.outcome_code, technicalMessage)
  }
  cloudDbState = {
    ...cloudDbState,
    readinessStatus: result.refreshOk ? 'ready' : 'error',
    message: result.userMessage || result.error || '',
    messageTone: result.refreshOk ? 'success' : result.committed ? 'warning' : 'error',
    lastUpdatedAt: new Date().toISOString(),
  }
  if (result.committed && !result.refreshOk) {
    window.alert(result.userMessage)
  }
  render()
}

async function commitStudentProjection(student, reason, idempotencyKey) {
  const commandCenterId = getCurrentCanonicalCenterContext().centerId
  const result = await runAuthoritativeCoreSave({
    entityLabel: 'Học viên',
    executeCommand: () => writeStudentThroughCloud(student, reason, idempotencyKey, commandCenterId),
    isContextCurrent: () => getCurrentCanonicalCenterContext().centerId === commandCenterId,
    installCommittedEntity: (entity) => {
      students = upsertCommittedCoreProjection(students, entity)
      saveStoredStudents(students)
    },
    refreshProjection: (commandResult) => refreshAuthoritativeCoreProjectionAfterCommit(
      CLOUD_ENTITY_TYPES.STUDENT,
      commandCenterId,
      commandResult.entity,
    ),
  })
  applyAuthoritativeCoreSaveUiResult(result)
  return result
}

async function commitTeacherProjection(teacher, reason, idempotencyKey) {
  const result = await writeTeacherThroughCloud(teacher, reason, idempotencyKey)

  if (!result.ok) return result

  teachers = upsertCommittedCoreProjection(teachers, result.entity)
  saveStoredTeachers(teachers)
  return result
}

async function writeClassSessionThroughCloud(
  classSession,
  reason = 'class-session-save',
  idempotencyKey,
  commandCenterId = getCurrentCanonicalCenterContext().centerId,
) {
  const readiness = await getAuthoritativeCoreCommandContext(
    CLOUD_ENTITY_TYPES.CLASS_SESSION,
    commandCenterId,
  )
  if (!readiness.ok) return readiness

  const result = await mutateAuthoritativeCoreEntity({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    entityType: CLOUD_ENTITY_TYPES.CLASS_SESSION,
    entity: classSession,
    idempotencyKey,
  })
  return { ...result, commandCenterId: readiness.centerId, reason }
}

async function commitClassSessionProjection(classSession, reason, idempotencyKey) {
  const commandCenterId = getCurrentCanonicalCenterContext().centerId
  const result = await runAuthoritativeCoreSave({
    entityLabel: 'Ca học / Lớp',
    executeCommand: () => writeClassSessionThroughCloud(
      classSession,
      reason,
      idempotencyKey,
      commandCenterId,
    ),
    isContextCurrent: () => getCurrentCanonicalCenterContext().centerId === commandCenterId,
    installCommittedEntity: (entity) => {
      classSessions = upsertCommittedCoreProjection(classSessions, entity)
      saveStoredClassSessions(classSessions)
    },
    refreshProjection: (commandResult) => refreshAuthoritativeCoreProjectionAfterCommit(
      CLOUD_ENTITY_TYPES.CLASS_SESSION,
      commandCenterId,
      commandResult.entity,
    ),
  })
  applyAuthoritativeCoreSaveUiResult(result)
  return result
}

async function commitScheduleSessionProjection(scheduleSession, reason, idempotencyKey) {
  const commandCenterId = getCurrentCanonicalCenterContext().centerId
  const result = await runAuthoritativeCoreSave({
    entityLabel: 'Ca dạy / Buổi học',
    executeCommand: () => writeScheduleSessionThroughCloud(
      scheduleSession,
      reason,
      idempotencyKey,
      commandCenterId,
    ),
    isContextCurrent: () => getCurrentCanonicalCenterContext().centerId === commandCenterId,
    installCommittedEntity: (entity) => {
      if (entity?.isDeleted) {
        scheduleSessions = scheduleSessions.filter((item) => item.id !== entity.id)
      } else {
        scheduleSessions = upsertCommittedCoreProjection(scheduleSessions, entity)
      }
      saveStoredSchedule(scheduleSessions)
    },
    refreshProjection: (commandResult) => refreshAuthoritativeCoreProjectionAfterCommit(
      CLOUD_ENTITY_TYPES.SCHEDULE_SESSION,
      commandCenterId,
      commandResult.entity,
    ),
  })
  applyAuthoritativeCoreSaveUiResult(result)
  return result
}

async function writeStudentThroughCloud(
  student,
  reason = 'student-save',
  idempotencyKey,
  commandCenterId = getCurrentCanonicalCenterContext().centerId,
) {
  const runId = ++studentCloudWriteRunId
  const readiness = await getAuthoritativeCoreCommandContext(
    CLOUD_ENTITY_TYPES.STUDENT,
    commandCenterId,
  )
  if (!readiness.ok) return readiness

  const result = await upsertStudentCloudEntity({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    student,
    userId: readiness.user?.id,
    accessState: readiness.accessState,
    idempotencyKey,
  })
  return {
    ...result,
    commandCenterId: readiness.centerId,
    reason,
    superseded: runId !== studentCloudWriteRunId,
  }
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

async function writeTeacherThroughCloud(teacher, reason = 'teacher-save', idempotencyKey) {
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
    idempotencyKey,
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

async function writeScheduleSessionThroughCloud(
  scheduleSession,
  reason = 'schedule-save',
  idempotencyKey,
  commandCenterId = getCurrentCanonicalCenterContext().centerId,
) {
  const runId = ++scheduleSessionCloudWriteRunId
  const readiness = await getAuthoritativeCoreCommandContext(
    CLOUD_ENTITY_TYPES.SCHEDULE_SESSION,
    commandCenterId,
  )
  if (!readiness.ok) return readiness

  const preview = buildScheduleSessionBridgePreview(
    scheduleSession ? [scheduleSession] : [],
    buildScheduleSessionRuntimeContext({
      accessState: readiness.accessState,
      centerId: readiness.centerId,
      cloudReady: true,
      signedIn: Boolean(readiness.user),
      membershipReady: Boolean(readiness.membership),
    }),
  )
  const result = await upsertScheduleSessionCloudEntity({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
    scheduleSession,
    userId: readiness.user?.id,
    accessState: readiness.accessState,
    readiness: {
      ...preview.readiness,
      dryRunPreview: preview.dryRun,
      cloudReady: true,
      signedIn: Boolean(readiness.user),
      membershipReady: Boolean(readiness.membership),
      membershipSqlReady: true,
      scheduleSessionSqlReady: true,
      realtimeReady: true,
    },
    idempotencyKey,
  })
  return {
    ...result,
    commandCenterId: readiness.centerId,
    reason,
    superseded: runId !== scheduleSessionCloudWriteRunId,
  }
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
  scheduleSessions = purgeZombieScheduleSessions({ persist: false, reason: 'schedule-realtime' })
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

async function refreshParentStudentLinksSharedTruth({ reason = 'manual-refresh' } = {}) {
  const centerContext = getCurrentCanonicalCenterContext()
  const centerId = centerContext.centerId
  const runId = ++parentFirstCapabilityRunId

  parentStudentLinks = []
  parentFirstCapabilityState = createParentFirstCapabilityState({
    centerId,
    status: centerId ? PARENT_FIRST_CAPABILITY_STATUS.LOADING : PARENT_FIRST_CAPABILITY_STATUS.FAILED,
    isLoading: Boolean(centerId),
    message: centerId ? 'Đang kiểm tra dữ liệu Phụ huynh / Tư vấn...' : 'Chưa xác định được cơ sở đang hoạt động.',
  })
  render()

  if (!centerContext.ok || !canUseCoreCloudDb()) {
    const result = { ok: false, outcome_code: 'CLIENT_NOT_READY', error: getParentFirstOutcomeMessage('CLIENT_NOT_READY') }
    parentFirstCapabilityState = createParentFirstCapabilityState({
      centerId,
      status: PARENT_FIRST_CAPABILITY_STATUS.FAILED,
      message: result.error,
      messageTone: 'error',
    })
    render()
    return result
  }

  const readiness = await checkCloudDbReadiness(centerId)
  if (runId !== parentFirstCapabilityRunId || centerId !== getCurrentCanonicalCenterContext().centerId) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getParentFirstOutcomeMessage('CENTER_CONTEXT_CHANGED') }
  }
  if (!readiness.ok || readiness.centerId !== centerId) {
    const result = readiness.ok
      ? { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getParentFirstOutcomeMessage('CENTER_CONTEXT_CHANGED') }
      : { ...readiness, error: getParentFirstOutcomeMessage('CLIENT_NOT_READY') }
    parentFirstCapabilityState = createParentFirstCapabilityState({
      centerId,
      status: PARENT_FIRST_CAPABILITY_STATUS.FAILED,
      message: result.error,
      messageTone: 'error',
    })
    render()
    return result
  }

  const result = await pullParentStudentLinks({ supabase: readiness.supabase, centerId })
  if (runId !== parentFirstCapabilityRunId || centerId !== getCurrentCanonicalCenterContext().centerId) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getParentFirstOutcomeMessage('CENTER_CONTEXT_CHANGED') }
  }
  if (!result.ok) {
    const unavailable = isParentFirstBackendUnavailable(result)
    parentFirstCapabilityState = createParentFirstCapabilityState({
      centerId,
      status: unavailable ? PARENT_FIRST_CAPABILITY_STATUS.UNAVAILABLE : PARENT_FIRST_CAPABILITY_STATUS.FAILED,
      message: unavailable ? getParentFirstOutcomeMessage('BACKEND_NOT_DEPLOYED') : getParentFirstOutcomeMessage(result.outcome_code),
      messageTone: unavailable ? 'warning' : 'error',
    })
    render()
    return result
  }

  parentStudentLinks = result.links
  parentFirstCapabilityState = createParentFirstCapabilityState({
    centerId,
    status: PARENT_FIRST_CAPABILITY_STATUS.READY,
    message: reason === 'capability-probe' ? '' : 'Đã tải liên kết phụ huynh và học viên mới nhất.',
    messageTone: 'success',
    lastLoadedAt: result.readAt || new Date().toISOString(),
  })
  render()
  return result
}

async function runParentFirstMutation(execute, { keepDraft = true } = {}) {
  const centerContext = getCurrentCanonicalCenterContext()
  if (!centerContext.ok || !isParentFirstCapabilityReady(parentFirstCapabilityState, centerContext.centerId)) {
    return { ok: false, outcome_code: 'CLIENT_NOT_READY', error: getParentFirstOutcomeMessage('CLIENT_NOT_READY') }
  }
  const readiness = await checkCloudDbReadiness(centerContext.centerId)
  if (!readiness.ok || readiness.centerId !== centerContext.centerId) {
    return { ok: false, outcome_code: 'CLIENT_NOT_READY', error: getParentFirstOutcomeMessage('CLIENT_NOT_READY') }
  }
  let result
  try {
    result = await execute(readiness.supabase, centerContext.centerId)
  } catch {
    return {
      ok: false,
      outcome_code: 'INVALID_COMMAND',
      error: getParentFirstOutcomeMessage('INVALID_COMMAND'),
    }
  }
  if (!result.ok) return result

  const projection = await refreshParentStudentLinksSharedTruth({ reason: 'after-server-commit' })
  if (!projection.ok) {
    const failure = {
      ...result,
      ok: false,
      committed: true,
      outcome_code: 'COMMITTED_PROJECTION_REFRESH_FAILED',
      error: 'Thay đổi đã được lưu nhưng chưa tải lại được. Hãy bấm Làm mới trước khi thao tác tiếp.',
      keepDraft,
    }
    parentFirstCapabilityState = createParentFirstCapabilityState({
      centerId: centerContext.centerId,
      status: PARENT_FIRST_CAPABILITY_STATUS.FAILED,
      message: failure.error,
      messageTone: 'warning',
    })
    render()
    return failure
  }
  return { ...result, ok: true, projection }
}

function getMergedParentConsultations() {
  return mergeParentContactsWithStudents(
    parentConsultations,
    getStudentsWithCanonicalProjections(),
    parentStudentLinks,
  )
}

function createParentLinkDraft(overrides = {}) {
  return {
    mode: 'create',
    fixedContactId: '',
    selectedContactId: '',
    contactChoice: 'existing',
    studentId: '',
    newContactName: '',
    newContactPhone: '',
    newContactEmail: '',
    relationshipType: 'PARENT',
    isPrimaryContact: true,
    financialContactRole: 'PRIMARY',
    academicContactRole: 'PRIMARY',
    linkId: createC53CrmIdempotencyKey(),
    linkVersion: 0,
    linkIdempotencyKey: createC53CrmIdempotencyKey(),
    contactCreateCommand: null,
    isSaving: false,
    error: '',
    message: '',
    ...overrides,
  }
}

function openParentLinkReviewForDerivedContact(contactId, studentId) {
  if (!isProductionModuleAvailable('khach-hang-tu-van')) return false
  const contact = getMergedParentConsultations().find((item) => item.id === contactId && item.isDerivedFromStudents)
  const student = getStudentsWithCanonicalProjections().find((item) => item.id === studentId && !item.isDeleted)
  if (!contact || !student) return false
  parentLinkReviewState = createParentLinkDraft({
    contactChoice: 'new',
    studentId: student.id,
    newContactName: contact.parentName || '',
    newContactPhone: contact.phone || '',
    newContactEmail: contact.email || '',
  })
  render()
  return true
}

function openParentLinkReviewForContact(contactId) {
  if (!isProductionModuleAvailable('khach-hang-tu-van')) return false
  const contact = getMergedParentConsultations().find(
    (item) => item.id === contactId && !item.isDerivedFromStudents && item.canonicalContactId,
  )
  if (!contact) return false
  parentLinkReviewState = createParentLinkDraft({
    fixedContactId: contact.id,
    selectedContactId: contact.canonicalContactId,
  })
  render()
  return true
}

function openParentLinkReviewForExistingLink(linkId, mode = 'update') {
  if (!isProductionModuleAvailable('khach-hang-tu-van')) return false
  const link = parentStudentLinks.find((item) => item.linkId === linkId && item.linkStatus === 'ACTIVE')
  const contact = getMergedParentConsultations().find((item) => item.canonicalContactId === link?.contactId)
  if (!link || !contact) return false
  parentLinkReviewState = createParentLinkDraft({
    mode,
    fixedContactId: contact.id,
    selectedContactId: link.contactId,
    studentId: link.studentId,
    relationshipType: link.relationshipType,
    isPrimaryContact: link.isPrimaryContact,
    financialContactRole: link.financialContactRole,
    academicContactRole: link.academicContactRole,
    linkId: link.linkId,
    linkVersion: link.linkVersion,
  })
  render()
  return true
}

function openParentIdentityEditor(contactId) {
  if (!isProductionModuleAvailable('khach-hang-tu-van')) return false
  const contact = getMergedParentConsultations().find(
    (item) => item.id === contactId && item.contactIdentityAvailable && item.canonicalContactId,
  )
  if (!contact || !Number.isSafeInteger(Number(contact.contactVersion)) || Number(contact.contactVersion) < 1) return false
  parentIdentityEditState = {
    contactRecordId: contact.id,
    contactId: contact.canonicalContactId,
    expectedVersion: Number(contact.contactVersion),
    displayName: contact.parentName || '',
    primaryPhone: contact.phone || '',
    secondaryPhone: contact.secondaryPhone || '',
    email: contact.email || '',
    idempotencyKey: createC53CrmIdempotencyKey(),
    isSaving: false,
    error: '',
    message: '',
  }
  render()
  return true
}

function validateParentLinkDraft(state) {
  if (!state?.studentId) return 'Vui lòng chọn học viên.'
  if (!getStudentsWithCanonicalProjections().some((student) => student.id === state.studentId && !student.isDeleted)) {
    return 'Học viên không còn trong danh sách hiện tại. Hãy làm mới và chọn lại.'
  }
  if (state.mode === 'update' || state.mode === 'end') return ''
  if (state.fixedContactId || state.contactChoice === 'existing') {
    return state.selectedContactId ? '' : 'Vui lòng chọn hồ sơ phụ huynh.'
  }
  if (!String(state.newContactName || '').trim()) return 'Vui lòng nhập tên phụ huynh.'
  if (!String(state.newContactPhone || '').trim() && !String(state.newContactEmail || '').trim()) {
    return 'Vui lòng nhập ít nhất một số điện thoại hoặc email.'
  }
  return ''
}

function buildParentContactCreateCommandFromLinkDraft(state) {
  const now = new Date().toISOString()
  return buildC53CreateLeadCommand({
    id: `parent-first-${state.linkId}`,
    contactType: 'currentParent',
    customerStage: 'converted',
    parentName: String(state.newContactName || '').trim(),
    phone: String(state.newContactPhone || '').trim(),
    secondaryPhone: '',
    email: String(state.newContactEmail || '').trim(),
    consultationStatus: 'activeCare',
    source: 'oldStudent',
    leadStudentName: '',
    leadNeed: '',
    careLogs: [],
    appointments: [],
    enrollmentDraft: {},
    createdAt: now,
    updatedAt: now,
  })
}

async function saveParentLinkReview() {
  const state = parentLinkReviewState
  if (!state || state.isSaving || !isProductionModuleAvailable('khach-hang-tu-van')) return
  const validationError = validateParentLinkDraft(state)
  if (validationError) {
    parentLinkReviewState = { ...state, error: validationError, message: '' }
    render()
    return
  }

  parentLinkReviewState = { ...state, isSaving: true, error: '', message: '' }
  render()
  let activeState = parentLinkReviewState
  let contactId = activeState.selectedContactId

  if (activeState.mode === 'create' && !activeState.fixedContactId && activeState.contactChoice === 'new') {
    const command = activeState.contactCreateCommand || buildParentContactCreateCommandFromLinkDraft(activeState)
    parentLinkReviewState = { ...activeState, contactCreateCommand: command }
    const contactResult = await writeC53CrmCommand(command, { reason: 'parent-first-create-contact' })
    if (!contactResult.ok) {
      parentLinkReviewState = {
        ...parentLinkReviewState,
        isSaving: false,
        error: getParentFriendlyCrmOutcomeMessage(contactResult),
        message: contactResult.committed ? 'Hồ sơ đã được tạo nhưng danh sách chưa tải lại. Bấm Lưu lần nữa để tiếp tục sau khi kết nối ổn định.' : '',
      }
      render()
      return
    }
    const createdContact = parentConsultations.find((contact) => contact.canonicalCaseId === contactResult.case_id)
    if (!createdContact?.canonicalContactId) {
      parentLinkReviewState = {
        ...parentLinkReviewState,
        isSaving: false,
        error: 'Hồ sơ đã được tạo nhưng chưa xác định được bản ghi vừa tạo. Hãy làm mới trước khi liên kết.',
        message: 'Hồ sơ phụ huynh đã được lưu; học viên chưa được liên kết.',
      }
      render()
      return
    }
    contactId = createdContact.canonicalContactId
    activeState = {
      ...parentLinkReviewState,
      contactChoice: 'existing',
      selectedContactId: contactId,
    }
    parentLinkReviewState = activeState
  }

  const result = await runParentFirstMutation((supabase, centerId) => {
    if (activeState.mode === 'end') {
      return endParentStudentLink({
        supabase,
        centerId,
        linkId: activeState.linkId,
        expectedVersion: activeState.linkVersion,
        idempotencyKey: activeState.linkIdempotencyKey,
      })
    }
    if (activeState.mode === 'update') {
      return updateParentStudentLink({
        supabase,
        centerId,
        linkId: activeState.linkId,
        expectedVersion: activeState.linkVersion,
        relationshipType: activeState.relationshipType,
        isPrimaryContact: activeState.isPrimaryContact,
        financialContactRole: activeState.financialContactRole,
        academicContactRole: activeState.academicContactRole,
        idempotencyKey: activeState.linkIdempotencyKey,
      })
    }
    return createParentStudentLink({
      supabase,
      centerId,
      linkId: activeState.linkId,
      contactId,
      studentId: activeState.studentId,
      relationshipType: activeState.relationshipType,
      isPrimaryContact: activeState.isPrimaryContact,
      financialContactRole: activeState.financialContactRole,
      academicContactRole: activeState.academicContactRole,
      idempotencyKey: activeState.linkIdempotencyKey,
    })
  })
  if (!result.ok) {
    parentLinkReviewState = {
      ...activeState,
      isSaving: false,
      error: result.error || getParentFirstOutcomeMessage(result.outcome_code),
      message: result.committed ? 'Thay đổi đã được lưu nhưng danh sách chưa tải lại. Hãy bấm Làm mới.' : '',
    }
    render()
    return
  }
  parentLinkReviewState = null
  parentContactDetailId = null
  render()
}

async function saveParentIdentityEdit() {
  const state = parentIdentityEditState
  if (!state || state.isSaving || !isProductionModuleAvailable('khach-hang-tu-van')) return
  const displayName = String(state.displayName || '').trim()
  const phones = [state.primaryPhone, state.secondaryPhone].map((item) => String(item || '').trim()).filter(Boolean)
  const emails = [state.email].map((item) => String(item || '').trim()).filter(Boolean)
  if (!displayName || (!phones.length && !emails.length)) {
    parentIdentityEditState = { ...state, error: 'Vui lòng nhập tên và ít nhất một số điện thoại hoặc email.', message: '' }
    render()
    return
  }
  parentIdentityEditState = { ...state, isSaving: true, error: '', message: '' }
  render()
  const result = await runParentFirstMutation((supabase, centerId) => updateProtectedContactIdentity({
    supabase,
    centerId,
    contactId: state.contactId,
    expectedVersion: state.expectedVersion,
    displayName,
    phones,
    emails,
    idempotencyKey: state.idempotencyKey,
  }))
  if (!result.ok) {
    parentIdentityEditState = {
      ...state,
      isSaving: false,
      error: result.error || getParentFirstOutcomeMessage(result.outcome_code),
      message: result.committed ? 'Thông tin đã được lưu nhưng chưa tải lại được. Hãy bấm Làm mới.' : '',
    }
    render()
    return
  }
  parentIdentityEditState = null
  parentContactDetailId = state.contactRecordId
  render()
}

function getParentFriendlyCrmOutcomeMessage(result = {}) {
  const code = String(result.outcome_code || '').toUpperCase()
  if (['CASE_VERSION_STALE', 'STATE_VERSION_STALE', 'CANDIDATE_VERSION_STALE', 'CONTACT_VERSION_STALE', 'CONCURRENT_CONFLICT'].includes(code)) {
    return 'Hồ sơ đã được người khác cập nhật. Hãy làm mới trước khi lưu lại.'
  }
  if (['INGRESS_CONFLICT', 'SOURCE_IDENTITY_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(code)) {
    return 'Thông tin liên hệ trùng hoặc lần thử lại không còn khớp. Hãy kiểm tra và làm mới trước khi tiếp tục.'
  }
  if (['CENTER_ACCESS_DENIED', 'WRITE_ROLE_REQUIRED', 'NOT_AUTHENTICATED'].includes(code)) {
    return 'Tài khoản hiện tại không được phép thay đổi hồ sơ này.'
  }
  if (result.committed) {
    return 'Thay đổi đã được lưu nhưng chưa tải lại được danh sách. Hãy bấm Làm mới.'
  }
  return 'Chưa thể lưu hồ sơ. Nội dung đang nhập vẫn được giữ nguyên.'
}

async function refreshC53CrmSharedTruth({ reason = 'manual-refresh', silent = false } = {}) {
  const centerContext = getCurrentCanonicalCenterContext()
  const centerId = centerContext.centerId
  const runId = ++c53CrmSyncRunId

  // Refresh is an authorization/currentness boundary. Nothing from the old
  // account or center remains renderable during legacy inspection/network I/O.
  parentConsultations = []
  parentConsultationFormState = null
  parentQuickNoteState = null
  parentNoteHistoryContactId = null
  parentContactDetailId = null
  notifications = syncAppNotifications(notifications)
  c53CrmSharedTruthState = {
    ...c53CrmSharedTruthState,
    centerId,
    isLoading: Boolean(centerId),
    isSaving: false,
    message: centerId && !silent ? 'Đang kiểm tra dữ liệu cũ và tải hồ sơ phụ huynh...' : '',
    messageTone: '',
    lastLoadedAt: '',
    eligibleConsultants: [],
    legacyMigrationRequired: false,
    legacyManifestKey: '',
    legacySummary: null,
  }
  render()

  if (!centerContext.ok || !canUseCoreCloudDb()) {
    const error = 'Cần đăng nhập và chọn đúng cơ sở để tải hồ sơ phụ huynh.'
    c53CrmSharedTruthState = {
      ...c53CrmSharedTruthState,
      isLoading: false,
      message: error,
      messageTone: 'error',
      lastLoadedAt: '',
    }
    render()
    return { ok: false, outcome_code: 'CLIENT_NOT_READY', error }
  }

  const legacy = inspectAndQuarantineC53LegacyCrm({
    storage: globalThis.localStorage,
    centerId,
  })
  if (runId !== c53CrmSyncRunId || centerId !== getCurrentCanonicalCenterContext().centerId) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Cơ sở đã thay đổi; dữ liệu cũ đã được ẩn.' }
  }
  if (!legacy.ok) {
    c53CrmSharedTruthState = {
      ...c53CrmSharedTruthState,
      isLoading: false,
      message: 'Dữ liệu cũ chưa được bảo toàn an toàn nên danh sách chưa được tải. Vui lòng liên hệ người hỗ trợ.',
      messageTone: 'error',
      lastLoadedAt: '',
      legacyMigrationRequired: true,
    }
    render()
    return { ...legacy, outcome_code: legacy.outcome_code || 'LEGACY_PRESERVATION_FAILED' }
  }

  c53CrmSharedTruthState = {
    ...c53CrmSharedTruthState,
    isLoading: true,
    message: silent ? '' : 'Đang tải hồ sơ phụ huynh...',
    messageTone: '',
    legacyMigrationRequired: legacy.migrationRequired,
    legacyManifestKey: legacy.manifestKey,
    legacySummary: legacy.source,
  }
  if (!silent) render()

  const readiness = await checkCloudDbReadiness(centerId)
  if (runId !== c53CrmSyncRunId || centerId !== getCurrentCanonicalCenterContext().centerId) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Cơ sở đã thay đổi; dữ liệu cũ đã được ẩn.' }
  }
  if (!readiness.ok || readiness.centerId !== centerId) {
    const result = readiness.ok
      ? { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Cơ sở đã thay đổi; dữ liệu cũ đã được ẩn.' }
      : readiness
    c53CrmSharedTruthState = {
      ...c53CrmSharedTruthState,
      isLoading: false,
      message: 'Dữ liệu phụ huynh hiện chưa tải được. Vui lòng thử lại.',
      messageTone: 'error',
      lastLoadedAt: '',
    }
    render()
    return result
  }

  const result = await pullC53CrmSharedTruth({ supabase: readiness.supabase, centerId })
  if (runId !== c53CrmSyncRunId || centerId !== getCurrentCanonicalCenterContext().centerId) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Cơ sở đã thay đổi; dữ liệu cũ đã được ẩn.' }
  }
  if (!result.ok) {
    c53CrmSharedTruthState = {
      ...c53CrmSharedTruthState,
      isLoading: false,
      message: 'Dữ liệu phụ huynh hiện chưa tải được. Vui lòng thử lại.',
      messageTone: 'error',
      lastLoadedAt: '',
    }
    render()
    return result
  }

  // Empty server is authoritative. The legacy key stays recoverable and
  // quarantined; it is never uploaded, unioned, or removed here.
  parentConsultations = result.records
  notifications = syncAppNotifications(notifications)
  c53CrmSharedTruthState = {
    ...c53CrmSharedTruthState,
    centerId,
    isLoading: false,
    message: reason === 'after-server-commit'
      ? 'Thay đổi đã được lưu và danh sách hiện tại đã được làm mới.'
      : `Đã tải ${result.records.length} hồ sơ phụ huynh / tư vấn.`,
    messageTone: 'success',
    lastLoadedAt: new Date().toISOString(),
    eligibleConsultants: result.eligibleConsultants,
  }
  render()
  return result
}

async function writeC53CrmCommand(command, { reason = 'crm-save' } = {}) {
  const centerId = getCurrentResolvedCenterId()
  const access = canWriteC53CrmSharedTruth(buildCurrentOnlineAccessState({
    cloudReady: cloudDbState.readinessStatus === 'ready',
  }))
  if (!access.canWrite) {
    const result = { ok: false, outcome_code: 'WRITE_ROLE_REQUIRED', error: 'Tài khoản hiện tại không được phép thay đổi hồ sơ phụ huynh.' }
    c53CrmSharedTruthState = {
      ...c53CrmSharedTruthState,
      centerId,
      isSaving: false,
      message: result.error,
      messageTone: 'error',
    }
    render()
    return result
  }

  const fingerprint = createC53CrmRetryFingerprint(command)
  const retryScope = `${centerId}|${fingerprint}`
  const pending = c53CrmRetryCommands.get(retryScope) || {
    centerId,
    command,
    idempotencyKey: createC53CrmIdempotencyKey(),
  }
  c53CrmRetryCommands.set(retryScope, pending)
  const runId = ++c53CrmSyncRunId
  c53CrmSharedTruthState = {
    ...c53CrmSharedTruthState,
    centerId,
    isSaving: true,
    message: 'Đang lưu hồ sơ phụ huynh...',
    messageTone: '',
  }
  render()

  const readiness = await checkCloudDbReadiness(centerId)
  if (
    runId !== c53CrmSyncRunId
    || centerId !== getCurrentResolvedCenterId()
    || !readiness.ok
    || readiness.centerId !== centerId
  ) {
    const result = readiness.ok
      ? { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Cơ sở đã thay đổi; dữ liệu cũ đã được ẩn.' }
      : readiness
    if (runId === c53CrmSyncRunId) {
      c53CrmSharedTruthState = {
        ...c53CrmSharedTruthState,
        isSaving: false,
        message: getParentFriendlyCrmOutcomeMessage(result),
        messageTone: 'error',
      }
      render()
    }
    return result
  }

  const result = await mutateC53CrmSharedTruth({
    supabase: readiness.supabase,
    centerId,
    command: pending.command,
    idempotencyKey: pending.idempotencyKey,
  })
  if (runId !== c53CrmSyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return {
      ...result,
      ok: false,
      committed: Boolean(result.ok),
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: result.ok
        ? 'Thay đổi đã được lưu ở cơ sở trước; dữ liệu đó không được hiển thị sau khi chuyển cơ sở.'
        : 'Cơ sở đã thay đổi; dữ liệu cũ đã được ẩn.',
    }
  }

  if (!result.ok && !isC53RetryableCrmFailure(result)) {
    c53CrmRetryCommands.delete(retryScope)
  }
  if (!result.ok) {
    c53CrmSharedTruthState = {
      ...c53CrmSharedTruthState,
      isSaving: false,
      message: getParentFriendlyCrmOutcomeMessage(result),
      messageTone: 'error',
    }
    render()
    return result
  }

  // Server commit is complete here. Local projection changes only after a
  // second authoritative read succeeds.
  c53CrmSharedTruthState = { ...c53CrmSharedTruthState, isSaving: false }
  const projection = await refreshC53CrmSharedTruth({ reason: 'after-server-commit', silent: true })
  if (!projection.ok) {
    const failure = {
      ...result,
      ok: false,
      committed: true,
      outcome_code: 'COMMITTED_PROJECTION_REFRESH_FAILED',
      error: 'Thay đổi đã được lưu nhưng chưa tải lại được danh sách. Hãy bấm Làm mới trước khi thao tác tiếp.',
    }
    c53CrmSharedTruthState = {
      ...c53CrmSharedTruthState,
      centerId,
      isSaving: false,
      message: failure.error,
      messageTone: 'error',
      lastLoadedAt: '',
    }
    render()
    return failure
  }
  c53CrmRetryCommands.delete(retryScope)
  return { ...result, ok: true, projection, reason }
}

function createC53CrmRetryFingerprint(command = {}) {
  return JSON.stringify(normalizeC53CrmRetrySemantic(command))
}

function normalizeC53CrmRetrySemantic(value) {
  if (Array.isArray(value)) return value.map(normalizeC53CrmRetrySemantic)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value).sort().reduce((result, key) => {
    if (['case_id', 'candidate_id', 'care_log_id', 'appointment_id', 'new_assignment_id'].includes(key)) {
      return result
    }
    result[key] = normalizeC53CrmRetrySemantic(value[key])
    return result
  }, {})
}

function isC53RetryableCrmFailure(result = {}) {
  return !result?.outcome_code || [
    'CLIENT_NOT_READY', 'SERVER_COMMAND_FAILED', 'CRM_COMMAND_FAILED',
    'INVALID_SERVER_RESULT', 'CONCURRENT_CONFLICT',
  ].includes(result.outcome_code)
}

async function refreshC54FinanceSharedTruth({ reason = 'manual-refresh', silent = false } = {}) {
  const centerId = getCurrentResolvedCenterId()
  const runId = ++c54FinanceSyncRunId
  const legacy = await inspectAndQuarantineC54LegacyFinance({
    storage: globalThis.localStorage,
    centerId,
  })

  if (runId !== c54FinanceSyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC54FinanceOutcomeMessage('CENTER_CONTEXT_CHANGED') }
  }
  if (!legacy.ok) {
    cashflowTransactions = []
    cashflowCategories = []
    cashbookSettings = createDefaultCashbookSettings([])
    cashbookReconciliations = []
    c54FinanceSharedTruthState = {
      ...c54FinanceSharedTruthState,
      centerId,
      isLoading: false,
      isSaving: false,
      message: legacy.error,
      messageTone: 'error',
      legacyMigrationRequired: true,
    }
    render()
    return { ok: false, outcome_code: 'LEGACY_PRESERVATION_FAILED', error: legacy.error }
  }

  c54FinanceSharedTruthState = {
    ...c54FinanceSharedTruthState,
    centerId,
    isLoading: true,
    message: silent ? c54FinanceSharedTruthState.message : 'Đang tải dữ liệu Thu chi...',
    messageTone: '',
    legacyMigrationRequired: legacy.migrationRequired,
    legacySnapshotKey: legacy.snapshotKey || '',
    legacySummary: legacy.snapshot?.summary || null,
  }
  if (!silent) render()

  if (!canUseCoreCloudDb()) {
    cashflowTransactions = []
    cashflowCategories = []
    cashbookSettings = createDefaultCashbookSettings([])
    cashbookReconciliations = []
    const error = 'Vui lòng đăng nhập và chọn đúng cơ sở để tải dữ liệu Thu chi.'
    c54FinanceSharedTruthState = {
      ...c54FinanceSharedTruthState,
      isLoading: false,
      message: error,
      messageTone: 'error',
    }
    render()
    return { ok: false, outcome_code: 'CLIENT_NOT_READY', error }
  }

  const readiness = await getCloudDbContext(centerId)
  if (runId !== c54FinanceSyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC54FinanceOutcomeMessage('CENTER_CONTEXT_CHANGED') }
  }
  if (!readiness.ok || readiness.centerId !== centerId) {
    c54FinanceSharedTruthState = {
      ...c54FinanceSharedTruthState,
      isLoading: false,
      message: readiness.error || getC54FinanceOutcomeMessage('FINANCE_SHARED_TRUTH_READ_FAILED'),
      messageTone: 'error',
    }
    render()
    return readiness
  }

  const result = await pullC54FinanceSharedTruth({ supabase: readiness.supabase, centerId })
  if (runId !== c54FinanceSyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC54FinanceOutcomeMessage('CENTER_CONTEXT_CHANGED') }
  }
  if (!result.ok) {
    if (['CENTER_ACCESS_DENIED', 'NOT_AUTHENTICATED'].includes(result.outcome_code)) {
      cashflowTransactions = []
      cashflowCategories = []
      cashbookSettings = createDefaultCashbookSettings([])
      cashbookReconciliations = []
    }
    c54FinanceSharedTruthState = {
      ...c54FinanceSharedTruthState,
      isLoading: false,
      message: result.error || getC54FinanceOutcomeMessage(result.outcome_code),
      messageTone: 'error',
    }
    render()
    return result
  }

  // Empty arrays are authoritative. Legacy keys remain quarantined and are
  // never merged/uploaded into this projection implicitly.
  cashflowTransactions = result.transactions
  cashflowCategories = result.categories
  cashbookSettings = result.settings || createDefaultCashbookSettings(result.transactions)
  cashbookReconciliations = result.reconciliations
  if (!cashbookSelectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(cashbookSelectedDate)) {
    cashbookSelectedDate = getDefaultCashbookDate(cashflowTransactions)
  }
  c54FinanceSharedTruthState = {
    ...c54FinanceSharedTruthState,
    centerId,
    isLoading: false,
    isSaving: false,
    message: reason === 'after-server-commit'
      ? 'Dữ liệu Thu chi đã được cập nhật và tải lại.'
      : `Đã tải ${cashflowTransactions.length} giao dịch Thu chi.`,
    messageTone: 'success',
    lastLoadedAt: new Date().toISOString(),
  }
  render()
  return result
}

async function writeC54FinanceCommand(command, {
  reason = 'finance-save',
  attachmentIntent = '',
} = {}) {
  const centerId = getCurrentResolvedCenterId()
  const access = canWriteC54FinanceSharedTruth(buildCurrentOnlineAccessState({
    cloudReady: true,
  }))
  if (!access.canWrite) {
    const result = { ok: false, outcome_code: 'WRITE_ROLE_REQUIRED', error: access.error }
    c54FinanceSharedTruthState = {
      ...c54FinanceSharedTruthState,
      centerId,
      isSaving: false,
      message: result.error,
      messageTone: 'error',
    }
    render()
    return result
  }

  const fingerprint = createC54FinanceRetryFingerprint(command, { attachmentIntent })
  const retryScope = `${centerId}|${fingerprint}`
  const existingPending = c54FinanceRetryCommands.get(retryScope)
  const pending = existingPending || {
    centerId,
    command,
    idempotencyKey: createC54FinanceIdempotencyKey(),
  }
  const commandContext = {
    reusedPendingIntent: Boolean(existingPending),
    effectiveAttachmentId: String(pending.command?.attachment_id || ''),
  }
  c54FinanceRetryCommands.set(retryScope, pending)
  const runId = ++c54FinanceSyncRunId
  c54FinanceSharedTruthState = {
    ...c54FinanceSharedTruthState,
    centerId,
    isSaving: true,
    message: 'Đang lưu dữ liệu Thu chi...',
    messageTone: '',
  }
  render()

  const readiness = await getCloudDbContext(centerId)
  if (runId !== c54FinanceSyncRunId || centerId !== getCurrentResolvedCenterId()
    || !readiness.ok || readiness.centerId !== centerId) {
    const result = readiness.ok
      ? { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC54FinanceOutcomeMessage('CENTER_CONTEXT_CHANGED') }
      : readiness
    if (runId === c54FinanceSyncRunId) {
      c54FinanceSharedTruthState = {
        ...c54FinanceSharedTruthState,
        isSaving: false,
        message: result.error || getC54FinanceOutcomeMessage('SERVER_COMMAND_FAILED'),
        messageTone: 'error',
      }
      render()
    }
    return { ...result, ...commandContext }
  }

  const result = await mutateC54FinanceSharedTruth({
    supabase: readiness.supabase,
    centerId,
    command: pending.command,
    idempotencyKey: pending.idempotencyKey,
  })
  if (runId !== c54FinanceSyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return {
      ...result,
      ok: false,
      committed: Boolean(result.ok),
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: result.ok
        ? 'Dữ liệu đã được lưu ở cơ sở trước. Màn hình hiện tại không hiển thị dữ liệu của cơ sở đó.'
        : getC54FinanceOutcomeMessage('CENTER_CONTEXT_CHANGED'),
      ...commandContext,
    }
  }
  if (!result.ok && !isC54RetryableFinanceFailure(result)) c54FinanceRetryCommands.delete(retryScope)
  if (!result.ok) {
    c54FinanceSharedTruthState = {
      ...c54FinanceSharedTruthState,
      isSaving: false,
      message: result.error || getC54FinanceOutcomeMessage(result.outcome_code),
      messageTone: 'error',
    }
    render()
    return { ...result, ...commandContext }
  }

  // The in-memory view changes only after both server commit and an exact-center
  // authoritative read have succeeded.
  c54FinanceSharedTruthState = { ...c54FinanceSharedTruthState, isSaving: false }
  const projection = await refreshC54FinanceSharedTruth({ reason: 'after-server-commit', silent: true })
  if (!projection.ok) {
    return {
      ...result,
      ok: false,
      committed: true,
      outcome_code: 'COMMITTED_PROJECTION_REFRESH_FAILED',
      error: 'Dữ liệu đã được lưu nhưng danh sách mới chưa tải lại được. Vui lòng bấm Làm mới.',
      ...commandContext,
    }
  }
  c54FinanceRetryCommands.delete(retryScope)
  return { ...result, ok: true, projection, reason, ...commandContext }
}

async function writeC54TuitionPaymentVoid(transaction, reason) {
  const centerId = getCurrentResolvedCenterId()
  const access = canWriteC54FinanceSharedTruth(buildCurrentOnlineAccessState({ cloudReady: true }))
  if (!access.canWrite) {
    return { ok: false, outcome_code: 'WRITE_ROLE_REQUIRED', error: access.error }
  }

  let requestedCommand
  try {
    requestedCommand = buildC54VoidTuitionPaymentCommand(transaction, reason)
  } catch (error) {
    return { ok: false, outcome_code: 'INVALID_PAYLOAD', error: String(error?.message || error) }
  }

  const retryScope = `${centerId}|${requestedCommand.transaction_id}`
  const existingPending = c54TuitionPaymentVoidRetryCommands.get(retryScope)
  const pending = existingPending || {
    centerId,
    command: requestedCommand,
    idempotencyKey: createC54FinanceIdempotencyKey(),
  }
  c54TuitionPaymentVoidRetryCommands.set(retryScope, pending)

  const runId = ++c54FinanceSyncRunId
  c54FinanceSharedTruthState = {
    ...c54FinanceSharedTruthState,
    centerId,
    isSaving: true,
    message: 'Đang hủy khoản thu...',
    messageTone: '',
  }
  render()

  const readiness = await getCloudDbContext(centerId)
  if (runId !== c54FinanceSyncRunId || centerId !== getCurrentResolvedCenterId()
    || !readiness.ok || readiness.centerId !== centerId) {
    const result = readiness.ok
      ? { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC54FinanceOutcomeMessage('CENTER_CONTEXT_CHANGED') }
      : readiness
    if (runId === c54FinanceSyncRunId) {
      c54FinanceSharedTruthState = {
        ...c54FinanceSharedTruthState,
        isSaving: false,
        message: result.error || 'Không thể hủy khoản thu lúc này.',
        messageTone: 'error',
      }
      render()
    }
    return { ...result, reusedPendingIntent: Boolean(existingPending) }
  }

  const result = await mutateC54TuitionPaymentVoid({
    supabase: readiness.supabase,
    centerId,
    command: pending.command,
    idempotencyKey: pending.idempotencyKey,
  })
  if (runId !== c54FinanceSyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return {
      ...result,
      ok: false,
      committed: Boolean(result.ok),
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: result.ok
        ? 'Khoản thu đã được hủy ở cơ sở trước. Màn hình hiện tại không hiển thị dữ liệu của cơ sở đó.'
        : getC54FinanceOutcomeMessage('CENTER_CONTEXT_CHANGED'),
      reusedPendingIntent: Boolean(existingPending),
    }
  }
  if (!result.ok && !isC54RetryableFinanceFailure(result)) {
    c54TuitionPaymentVoidRetryCommands.delete(retryScope)
  }
  if (!result.ok) {
    c54FinanceSharedTruthState = {
      ...c54FinanceSharedTruthState,
      isSaving: false,
      message: result.error || getC54FinanceOutcomeMessage(result.outcome_code),
      messageTone: 'error',
    }
    render()
    return { ...result, reusedPendingIntent: Boolean(existingPending) }
  }

  c54FinanceSharedTruthState = { ...c54FinanceSharedTruthState, isSaving: false }
  const projection = await refreshC54FinanceSharedTruth({ reason: 'after-server-commit', silent: true })
  if (!projection.ok) {
    const failure = {
      ...result,
      ok: false,
      committed: true,
      outcome_code: 'COMMITTED_PROJECTION_REFRESH_FAILED',
      error: getC54FinanceOutcomeMessage('COMMITTED_PROJECTION_REFRESH_FAILED'),
      reusedPendingIntent: Boolean(existingPending),
    }
    c54FinanceSharedTruthState = {
      ...c54FinanceSharedTruthState,
      isSaving: false,
      message: failure.error,
      messageTone: 'error',
    }
    render()
    return failure
  }
  c54TuitionPaymentVoidRetryCommands.delete(retryScope)
  return { ...result, ok: true, projection, reusedPendingIntent: Boolean(existingPending) }
}

function isC54RetryableFinanceFailure(result = {}) {
  return !result?.outcome_code || [
    'CLIENT_NOT_READY', 'SERVER_COMMAND_FAILED', 'INVALID_SERVER_RESULT',
    'CONCURRENT_CONFLICT', 'COMMITTED_PROJECTION_REFRESH_FAILED',
  ].includes(result.outcome_code)
}

async function refreshC56InventorySharedTruth({ reason = 'manual-refresh', silent = false } = {}) {
  const centerId = getCurrentResolvedCenterId()
  const runId = ++c56InventorySyncRunId
  const legacy = await inspectAndQuarantineC56LegacyInventory({
    storage: globalThis.localStorage,
    centerId,
  })
  if (runId !== c56InventorySyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC56InventoryOutcomeMessage('CENTER_CONTEXT_CHANGED') }
  }
  if (!legacy.ok) {
    inventoryItems = []
    inventoryMovements = []
    inventoryRequests = []
    c56InventorySharedTruthState = {
      ...c56InventorySharedTruthState,
      centerId,
      isLoading: false,
      isSaving: false,
      message: legacy.error,
      messageTone: 'error',
      legacyMigrationRequired: true,
    }
    render()
    return { ok: false, outcome_code: 'LEGACY_PRESERVATION_FAILED', error: legacy.error }
  }

  c56InventorySharedTruthState = {
    ...c56InventorySharedTruthState,
    centerId,
    isLoading: true,
    message: silent ? c56InventorySharedTruthState.message : 'Đang tải authoritative Inventory...',
    messageTone: '',
    legacyMigrationRequired: legacy.migrationRequired,
    legacyManifestKey: legacy.manifestKey || '',
    legacySummary: legacy.classifications || null,
  }
  if (!silent) render()

  if (!canUseCoreCloudDb()) {
    inventoryItems = []
    inventoryMovements = []
    inventoryRequests = []
    const error = 'Cần đăng nhập và có active membership để đọc authoritative Inventory.'
    c56InventorySharedTruthState = {
      ...c56InventorySharedTruthState,
      isLoading: false,
      message: error,
      messageTone: 'error',
    }
    render()
    return { ok: false, outcome_code: 'CLIENT_NOT_READY', error }
  }

  const readiness = await checkCloudDbReadiness(centerId)
  if (runId !== c56InventorySyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC56InventoryOutcomeMessage('CENTER_CONTEXT_CHANGED') }
  }
  if (!readiness.ok || readiness.centerId !== centerId) {
    c56InventorySharedTruthState = {
      ...c56InventorySharedTruthState,
      isLoading: false,
      message: readiness.error || getC56InventoryOutcomeMessage('INVENTORY_SHARED_TRUTH_READ_FAILED'),
      messageTone: 'error',
    }
    render()
    return readiness
  }

  const result = await pullC56InventorySharedTruth({ supabase: readiness.supabase, centerId })
  if (runId !== c56InventorySyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC56InventoryOutcomeMessage('CENTER_CONTEXT_CHANGED') }
  }
  if (!result.ok) {
    if (['CENTER_ACCESS_DENIED', 'NOT_AUTHENTICATED'].includes(result.outcome_code)) {
      inventoryItems = []
      inventoryMovements = []
      inventoryRequests = []
    }
    c56InventorySharedTruthState = {
      ...c56InventorySharedTruthState,
      isLoading: false,
      message: result.error || getC56InventoryOutcomeMessage(result.outcome_code),
      messageTone: 'error',
    }
    render()
    return result
  }

  // Validate the complete snapshot first in the adapter. Only active catalog
  // rows render; archived identities remain on server for movement history.
  inventoryItems = result.items.filter((item) => !item.isArchived)
  inventoryMovements = result.movements
  inventoryRequests = result.requests
  notifications = syncAppNotifications(notifications)
  c56InventorySharedTruthState = {
    ...c56InventorySharedTruthState,
    centerId,
    isLoading: false,
    isSaving: false,
    message: reason === 'after-server-commit'
      ? 'Inventory đã commit server và projection đã được làm mới.'
      : `Đã tải authoritative Inventory (${inventoryItems.length} vật tư, ${inventoryRequests.length} đề xuất).`,
    messageTone: 'success',
    lastLoadedAt: new Date().toISOString(),
  }
  render()
  return result
}

async function writeC56InventoryCommand(command, { reason = 'inventory-save' } = {}) {
  const centerId = getCurrentResolvedCenterId()
  const access = canWriteC56InventorySharedTruth(buildCurrentOnlineAccessState({
    cloudReady: cloudDbState.readinessStatus === 'ready',
  }))
  if (!access.canWrite) {
    const result = { ok: false, outcome_code: 'WRITE_ROLE_REQUIRED', error: access.error }
    c56InventorySharedTruthState = {
      ...c56InventorySharedTruthState,
      centerId,
      isSaving: false,
      message: result.error,
      messageTone: 'error',
    }
    render()
    return result
  }

  const fingerprint = createC56InventoryRetryFingerprint(command)
  const retryScope = `${centerId}|${fingerprint}`
  const pending = c56InventoryRetryCommands.get(retryScope) || {
    centerId,
    command,
    idempotencyKey: createC56InventoryIdempotencyKey(),
  }
  c56InventoryRetryCommands.set(retryScope, pending)
  const runId = ++c56InventorySyncRunId
  c56InventorySharedTruthState = {
    ...c56InventorySharedTruthState,
    centerId,
    isSaving: true,
    message: 'Đang commit authoritative Inventory...',
    messageTone: '',
  }
  render()

  const readiness = await checkCloudDbReadiness(centerId)
  if (runId !== c56InventorySyncRunId || centerId !== getCurrentResolvedCenterId()
    || !readiness.ok || readiness.centerId !== centerId) {
    const result = readiness.ok
      ? { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC56InventoryOutcomeMessage('CENTER_CONTEXT_CHANGED') }
      : readiness
    if (runId === c56InventorySyncRunId) {
      c56InventorySharedTruthState = {
        ...c56InventorySharedTruthState,
        isSaving: false,
        message: result.error || getC56InventoryOutcomeMessage('SERVER_COMMAND_FAILED'),
        messageTone: 'error',
      }
      render()
    }
    return result
  }

  const result = await mutateC56InventorySharedTruth({
    supabase: readiness.supabase,
    centerId,
    command: pending.command,
    idempotencyKey: pending.idempotencyKey,
  })
  if (runId !== c56InventorySyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return {
      ...result,
      ok: false,
      committed: Boolean(result.ok),
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: result.ok
        ? 'Inventory đã commit tại cơ sở trước; view cơ sở hiện tại không nhận projection đó.'
        : getC56InventoryOutcomeMessage('CENTER_CONTEXT_CHANGED'),
    }
  }
  if (!result.ok && !isC56RetryableInventoryFailure(result)) {
    c56InventoryRetryCommands.delete(retryScope)
  }
  if (!result.ok) {
    c56InventorySharedTruthState = {
      ...c56InventorySharedTruthState,
      isSaving: false,
      message: result.error || getC56InventoryOutcomeMessage(result.outcome_code),
      messageTone: 'error',
    }
    render()
    return result
  }

  c56InventorySharedTruthState = { ...c56InventorySharedTruthState, isSaving: false }
  const projection = await refreshC56InventorySharedTruth({ reason: 'after-server-commit', silent: true })
  if (!projection.ok) {
    return {
      ...result,
      ok: false,
      committed: true,
      outcome_code: 'COMMITTED_PROJECTION_REFRESH_FAILED',
      error: getC56InventoryOutcomeMessage('COMMITTED_PROJECTION_REFRESH_FAILED'),
    }
  }
  c56InventoryRetryCommands.delete(retryScope)
  return { ...result, ok: true, projection, reason }
}

function isC56RetryableInventoryFailure(result = {}) {
  return !result?.outcome_code || [
    'CLIENT_NOT_READY', 'SERVER_COMMAND_FAILED', 'INVALID_SERVER_RESULT',
    'CONCURRENT_CONFLICT', 'COMMITTED_PROJECTION_REFRESH_FAILED',
  ].includes(result.outcome_code)
}

function getCurrentC57AuthoritativeCenterId() {
  const binding = resolveAppCenterBinding(cloudStatus)
  const centerId = String(binding?.currentCenterId || '').trim()
  return cloudStatus.authStatus === 'signed-in'
    && cloudStatus.membershipStatus === 'loaded'
    && binding?.status === 'bound'
    && centerId.length <= 160
    && /^[A-Za-z0-9_-]+$/.test(centerId)
    ? centerId
    : ''
}

async function refreshC57CalendarNotesSharedTruth({ reason = 'manual-refresh', silent = false } = {}) {
  const centerId = getCurrentC57AuthoritativeCenterId()
  const runId = ++c57CalendarNotesSyncRunId
  if (!centerId) {
    clearC57CalendarNotesProjection()
    const result = { ok: false, outcome_code: 'INVALID_CENTER', error: getC57OutcomeMessage('INVALID_CENTER') }
    c57CalendarNotesSharedTruthState = {
      ...c57CalendarNotesSharedTruthState,
      centerId: '', isLoading: false, isSaving: false,
      message: result.error, messageTone: 'error', lastLoadedAt: '',
    }
    render()
    return result
  }

  // Withhold the prior projection immediately. Legacy inspection hashes may be
  // asynchronous, so no old-center/stale truth remains renderable during it.
  clearC57CalendarNotesProjection()
  c57CalendarNotesSharedTruthState = {
    ...c57CalendarNotesSharedTruthState,
    centerId,
    isLoading: true,
    isSaving: false,
    message: silent ? '' : 'Đang tải lịch hoạt động và ghi chú dùng chung...',
    messageTone: '',
    lastLoadedAt: '',
    legacyMigrationRequired: false,
    legacyManifestKey: '',
    legacySummary: null,
  }
  if (!silent) render()

  const legacy = await inspectAndQuarantineC57LegacyState({
    storage: globalThis.localStorage,
    centerId,
  })
  if (runId !== c57CalendarNotesSyncRunId || centerId !== getCurrentC57AuthoritativeCenterId()) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC57OutcomeMessage('CENTER_CONTEXT_CHANGED') }
  }
  if (!legacy.ok) {
    clearC57CalendarNotesProjection()
    c57CalendarNotesSharedTruthState = {
      ...c57CalendarNotesSharedTruthState,
      centerId, isLoading: false, isSaving: false,
      message: legacy.error, messageTone: 'error', lastLoadedAt: '',
      legacyMigrationRequired: true,
    }
    render()
    return { ok: false, outcome_code: 'LEGACY_PRESERVATION_FAILED', error: legacy.error }
  }

  c57CalendarNotesSharedTruthState = {
    ...c57CalendarNotesSharedTruthState,
    legacyMigrationRequired: legacy.migrationRequired,
    legacyManifestKey: legacy.manifestKey || '',
    legacySummary: legacy.classifications || null,
  }

  if (!canUseCoreCloudDb()) {
    const result = { ok: false, outcome_code: 'CLIENT_NOT_READY', error: getC57OutcomeMessage('CLIENT_NOT_READY') }
    c57CalendarNotesSharedTruthState = {
      ...c57CalendarNotesSharedTruthState,
      isLoading: false, message: result.error, messageTone: 'error', lastLoadedAt: '',
    }
    render()
    return result
  }

  const readiness = await checkCloudDbReadiness(centerId)
  if (runId !== c57CalendarNotesSyncRunId || centerId !== getCurrentC57AuthoritativeCenterId()) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC57OutcomeMessage('CENTER_CONTEXT_CHANGED') }
  }
  if (!readiness.ok || readiness.centerId !== centerId) {
    const result = readiness.ok
      ? { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC57OutcomeMessage('CENTER_CONTEXT_CHANGED') }
      : readiness
    c57CalendarNotesSharedTruthState = {
      ...c57CalendarNotesSharedTruthState,
      isLoading: false,
      message: result.error || getC57OutcomeMessage('SHARED_TRUTH_READ_FAILED'),
      messageTone: 'error', lastLoadedAt: '',
    }
    render()
    return result
  }

  const result = await pullC57CalendarNotesSharedTruth({ supabase: readiness.supabase, centerId })
  if (runId !== c57CalendarNotesSyncRunId || centerId !== getCurrentC57AuthoritativeCenterId()) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC57OutcomeMessage('CENTER_CONTEXT_CHANGED') }
  }
  if (!result.ok) {
    c57CalendarNotesSharedTruthState = {
      ...c57CalendarNotesSharedTruthState,
      isLoading: false,
      message: result.error || getC57OutcomeMessage(result.outcome_code),
      messageTone: 'error', lastLoadedAt: '',
    }
    render()
    return result
  }

  centerCalendarItems = result.calendarItems.filter((item) => !item.isArchived)
  centerCalendarTags = result.calendarTags
  attendanceAdvisoryNotes = result.advisoryNotes
  attendanceBoardNotes = result.boardNotes
  c57CalendarNotesSharedTruthState = {
    ...c57CalendarNotesSharedTruthState,
    centerId,
    isLoading: false,
    isSaving: false,
    message: reason === 'after-server-commit'
      ? 'Đã lưu và tải lại lịch hoạt động cùng ghi chú dùng chung.'
      : `Đã tải ${centerCalendarItems.length} hoạt động và ${attendanceAdvisoryNotes.length + attendanceBoardNotes.length} ghi chú dùng chung.`,
    messageTone: 'success',
    lastLoadedAt: new Date().toISOString(),
  }
  render()
  return result
}

async function writeC57CalendarNotesCommand(command, { reason = 'c5.7-save' } = {}) {
  const centerId = getCurrentC57AuthoritativeCenterId()
  if (!centerId) {
    clearC57CalendarNotesProjection()
    const result = { ok: false, outcome_code: 'INVALID_CENTER', error: getC57OutcomeMessage('INVALID_CENTER') }
    c57CalendarNotesSharedTruthState = {
      ...c57CalendarNotesSharedTruthState,
      centerId: '', isSaving: false, message: result.error, messageTone: 'error', lastLoadedAt: '',
    }
    render()
    return result
  }
  const access = canWriteC57SharedTruth(buildCurrentOnlineAccessState({
    cloudReady: cloudDbState.readinessStatus === 'ready',
  }))
  if (!access.canWrite) {
    const result = { ok: false, outcome_code: 'WRITE_ROLE_REQUIRED', error: access.error }
    c57CalendarNotesSharedTruthState = {
      ...c57CalendarNotesSharedTruthState,
      centerId, isSaving: false, message: result.error, messageTone: 'error',
    }
    render()
    return result
  }

  const fingerprint = createC57RetryFingerprint(command)
  const retryScope = `${centerId}|${fingerprint}`
  const pending = c57CalendarNotesRetryCommands.get(retryScope) || {
    centerId,
    command,
    idempotencyKey: createC57IdempotencyKey(),
  }
  c57CalendarNotesRetryCommands.set(retryScope, pending)
  const runId = ++c57CalendarNotesSyncRunId
  c57CalendarNotesSharedTruthState = {
    ...c57CalendarNotesSharedTruthState,
    centerId, isSaving: true, message: 'Đang commit authoritative Calendar/Notes...', messageTone: '',
  }
  render()

  const readiness = await checkCloudDbReadiness(centerId)
  if (runId !== c57CalendarNotesSyncRunId || centerId !== getCurrentC57AuthoritativeCenterId()
    || !readiness.ok || readiness.centerId !== centerId) {
    const result = readiness.ok
      ? { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC57OutcomeMessage('CENTER_CONTEXT_CHANGED') }
      : readiness
    if (runId === c57CalendarNotesSyncRunId) {
      if (isC57AccessBoundaryFailure(result)) clearC57CalendarNotesProjection()
      c57CalendarNotesSharedTruthState = {
        ...c57CalendarNotesSharedTruthState,
        isSaving: false,
        message: result.error || getC57OutcomeMessage('SERVER_COMMAND_FAILED'),
        messageTone: 'error',
        lastLoadedAt: isC57AccessBoundaryFailure(result)
          ? ''
          : c57CalendarNotesSharedTruthState.lastLoadedAt,
      }
      render()
    }
    return result
  }

  const result = await mutateC57CalendarNotesSharedTruth({
    supabase: readiness.supabase,
    centerId,
    command: pending.command,
    idempotencyKey: pending.idempotencyKey,
  })
  if (runId !== c57CalendarNotesSyncRunId || centerId !== getCurrentC57AuthoritativeCenterId()) {
    return {
      ...result,
      ok: false,
      committed: Boolean(result.ok),
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: result.ok
        ? 'Đã commit ở cơ sở trước; view hiện tại không nhận projection đó.'
        : getC57OutcomeMessage('CENTER_CONTEXT_CHANGED'),
    }
  }
  if (!result.ok && !isC57RetryableFailure(result)) c57CalendarNotesRetryCommands.delete(retryScope)
  if (!result.ok) {
    if (isC57AccessBoundaryFailure(result)) clearC57CalendarNotesProjection()
    c57CalendarNotesSharedTruthState = {
      ...c57CalendarNotesSharedTruthState,
      isSaving: false,
      message: result.error || getC57OutcomeMessage(result.outcome_code),
      messageTone: 'error',
      lastLoadedAt: isC57AccessBoundaryFailure(result)
        ? ''
        : c57CalendarNotesSharedTruthState.lastLoadedAt,
    }
    render()
    return result
  }

  c57CalendarNotesSharedTruthState = { ...c57CalendarNotesSharedTruthState, isSaving: false }
  const projection = await refreshC57CalendarNotesSharedTruth({ reason: 'after-server-commit', silent: true })
  if (!projection.ok) {
    return {
      ...result,
      ok: false,
      committed: true,
      outcome_code: 'COMMITTED_PROJECTION_REFRESH_FAILED',
      error: getC57OutcomeMessage('COMMITTED_PROJECTION_REFRESH_FAILED'),
    }
  }
  c57CalendarNotesRetryCommands.delete(retryScope)
  return { ...result, ok: true, projection, reason }
}

function isC57RetryableFailure(result = {}) {
  return !result?.outcome_code || [
    'CLIENT_NOT_READY', 'SERVER_COMMAND_FAILED', 'INVALID_SERVER_RESULT',
    'CONCURRENT_CONFLICT', 'COMMITTED_PROJECTION_REFRESH_FAILED',
  ].includes(result.outcome_code)
}

function isC57AccessBoundaryFailure(result = {}) {
  return ['NOT_AUTHENTICATED', 'INVALID_CENTER', 'CENTER_ACCESS_DENIED', 'CENTER_CONTEXT_CHANGED']
    .includes(result?.outcome_code)
}

function isC55StaffHrProjectionHealthy(centerId = getCurrentResolvedCenterId()) {
  return Boolean(
    centerId &&
    c55StaffHrSharedTruthState.centerId === centerId &&
    c55StaffHrSharedTruthState.lastLoadedAt &&
    c55StaffHrSharedTruthState.messageTone !== 'error'
  )
}

function clearC55StaffHrProjection() {
  staffMembers = []
  staffDepartments = []
  staffAdministrativeProfiles = []
  staffDocuments = []
  staffAdministrativeRetentionPolicy = null
  staffAdministrativeDeletionRequests = []
  staffAdministrativeAuditEvents = []
}

async function refreshC55StaffHrSharedTruth({ reason = 'manual-refresh', silent = false } = {}) {
  const centerId = getCurrentResolvedCenterId()
  const runId = ++c55StaffHrSyncRunId
  // A refresh is an authorization/currentness boundary, not permission to
  // keep rendering the previous account/role's HR cache while the server is
  // being consulted. The authoritative snapshot is replaced atomically only
  // after every row validates.
  clearC55StaffHrProjection()
  if (reason !== 'after-server-commit') clearC55StaffHrTransientUi()
  c55StaffHrSharedTruthState = {
    ...c55StaffHrSharedTruthState,
    centerId,
    isLoading: true,
    isSaving: reason === 'after-server-commit',
    message: silent ? '' : 'Đang xác minh quyền và tải authoritative Staff/HR...',
    messageTone: '',
    lastLoadedAt: '',
  }
  render()
  const legacy = await inspectAndQuarantineC55LegacyStaffHr({
    storage: globalThis.localStorage,
    centerId,
  })

  if (runId !== c55StaffHrSyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return {
      ok: false,
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: getC55StaffHrOutcomeMessage('CENTER_CONTEXT_CHANGED'),
    }
  }
  if (!legacy.ok) {
    clearC55StaffHrProjection()
    c55StaffHrSharedTruthState = {
      ...c55StaffHrSharedTruthState,
      centerId,
      isLoading: false,
      isSaving: false,
      message: legacy.error,
      messageTone: 'error',
      lastLoadedAt: '',
      legacyMigrationRequired: true,
    }
    render()
    return { ok: false, outcome_code: 'LEGACY_PRESERVATION_FAILED', error: legacy.error }
  }

  c55StaffHrSharedTruthState = {
    ...c55StaffHrSharedTruthState,
    centerId,
    isLoading: true,
    message: silent
      ? c55StaffHrSharedTruthState.message
      : 'Đang tải authoritative Staff/HR...',
    messageTone: '',
    legacyMigrationRequired: legacy.migrationRequired,
    legacyManifestKey: legacy.manifestKey || '',
    legacySummary: legacy.manifest?.sources || null,
  }
  if (!silent) render()

  if (!canUseCoreCloudDb()) {
    clearC55StaffHrProjection()
    const error = 'Cần đăng nhập và có quyền HR tại đúng cơ sở để đọc authoritative Staff/HR.'
    c55StaffHrSharedTruthState = {
      ...c55StaffHrSharedTruthState,
      isLoading: false,
      isSaving: false,
      message: error,
      messageTone: 'error',
      lastLoadedAt: '',
    }
    render()
    return { ok: false, outcome_code: 'CLIENT_NOT_READY', error }
  }

  const readiness = await checkCloudDbReadiness(centerId)
  if (runId !== c55StaffHrSyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return {
      ok: false,
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: getC55StaffHrOutcomeMessage('CENTER_CONTEXT_CHANGED'),
    }
  }
  if (!readiness.ok || readiness.centerId !== centerId) {
    c55StaffHrSharedTruthState = {
      ...c55StaffHrSharedTruthState,
      isLoading: false,
      isSaving: false,
      message: readiness.error || getC55StaffHrOutcomeMessage('STAFF_HR_SHARED_TRUTH_READ_FAILED'),
      messageTone: 'error',
      lastLoadedAt: '',
    }
    render()
    return readiness
  }

  const result = await pullC55StaffHrSharedTruth({ supabase: readiness.supabase, centerId })
  if (runId !== c55StaffHrSyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return {
      ok: false,
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: getC55StaffHrOutcomeMessage('CENTER_CONTEXT_CHANGED'),
    }
  }
  if (!result.ok) {
    if (['CENTER_ACCESS_DENIED', 'NOT_AUTHENTICATED'].includes(result.outcome_code)) {
      clearC55StaffHrProjection()
    }
    c55StaffHrSharedTruthState = {
      ...c55StaffHrSharedTruthState,
      isLoading: false,
      isSaving: false,
      message: result.error || getC55StaffHrOutcomeMessage(result.outcome_code),
      messageTone: 'error',
      lastLoadedAt: '',
    }
    render()
    return result
  }

  // Atomic, exact-center, memory-only projection replacement. Empty server
  // arrays are authoritative; legacy keys never participate in this view.
  staffDepartments = result.departments
  staffMembers = result.staffMembers
  staffAdministrativeProfiles = result.administrativeProfiles
  staffDocuments = result.documents
  staffAdministrativeRetentionPolicy = result.retentionPolicy
  staffAdministrativeDeletionRequests = result.deletionRequests
  staffAdministrativeAuditEvents = result.auditEvents
  c55StaffHrSharedTruthState = {
    ...c55StaffHrSharedTruthState,
    centerId,
    isLoading: false,
    isSaving: false,
    message: reason === 'after-server-commit'
      ? 'Staff/HR đã commit server và projection đã được làm mới.'
      : `Đã tải authoritative Staff/HR (${staffMembers.length} nhân viên).${legacy.migrationRequired ? ' Legacy local được giữ nguyên; cần controlled migration.' : ''}`,
    messageTone: 'success',
    lastLoadedAt: new Date().toISOString(),
  }
  staffNotice = c55StaffHrSharedTruthState.message
  render()
  return result
}

async function writeC55StaffHrCommand(command, { reason = 'staff-hr-save' } = {}) {
  const centerId = getCurrentResolvedCenterId()
  const access = canWriteC55StaffHrSharedTruth(buildCurrentOnlineAccessState({
    cloudReady: cloudDbState.readinessStatus === 'ready',
  }))
  if (!access.canWrite) {
    const result = { ok: false, outcome_code: 'WRITE_ROLE_REQUIRED', error: access.error }
    c55StaffHrSharedTruthState = {
      ...c55StaffHrSharedTruthState,
      centerId,
      isSaving: false,
      message: result.error,
      messageTone: 'error',
    }
    staffNotice = result.error
    render()
    return result
  }

  const fingerprint = createC55StaffHrRetryFingerprint(command)
  const retryScope = `${centerId}|${fingerprint}`
  const existingPending = c55StaffHrRetryCommands.get(retryScope)
  const pending = existingPending || {
    centerId,
    command,
    idempotencyKey: createC55StaffHrIdempotencyKey(),
  }
  c55StaffHrRetryCommands.set(retryScope, pending)
  const runId = ++c55StaffHrSyncRunId
  c55StaffHrSharedTruthState = {
    ...c55StaffHrSharedTruthState,
    centerId,
    isSaving: true,
    message: 'Đang commit authoritative Staff/HR...',
    messageTone: '',
  }
  render()

  const readiness = await checkCloudDbReadiness(centerId)
  if (runId !== c55StaffHrSyncRunId || centerId !== getCurrentResolvedCenterId()
    || !readiness.ok || readiness.centerId !== centerId) {
    const result = readiness.ok
      ? {
          ok: false,
          outcome_code: 'CENTER_CONTEXT_CHANGED',
          error: getC55StaffHrOutcomeMessage('CENTER_CONTEXT_CHANGED'),
        }
      : readiness
    if (runId === c55StaffHrSyncRunId) {
      c55StaffHrSharedTruthState = {
        ...c55StaffHrSharedTruthState,
        isSaving: false,
        message: result.error || getC55StaffHrOutcomeMessage('SERVER_COMMAND_FAILED'),
        messageTone: 'error',
      }
      staffNotice = c55StaffHrSharedTruthState.message
      render()
    }
    return result
  }

  const result = await mutateC55StaffHrSharedTruth({
    supabase: readiness.supabase,
    centerId,
    command: pending.command,
    idempotencyKey: pending.idempotencyKey,
  })
  if (runId !== c55StaffHrSyncRunId || centerId !== getCurrentResolvedCenterId()) {
    return {
      ...result,
      ok: false,
      committed: Boolean(result.ok),
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: result.ok
        ? 'Staff/HR đã commit tại cơ sở trước; view cơ sở hiện tại không nhận projection đó.'
        : getC55StaffHrOutcomeMessage('CENTER_CONTEXT_CHANGED'),
    }
  }
  if (!result.ok && !isC55RetryableStaffHrFailure(result)) {
    c55StaffHrRetryCommands.delete(retryScope)
  }
  if (!result.ok) {
    c55StaffHrSharedTruthState = {
      ...c55StaffHrSharedTruthState,
      isSaving: false,
      message: result.error || getC55StaffHrOutcomeMessage(result.outcome_code),
      messageTone: 'error',
    }
    staffNotice = c55StaffHrSharedTruthState.message
    render()
    return result
  }

  c55StaffHrSharedTruthState = { ...c55StaffHrSharedTruthState, isSaving: false }
  const projection = await refreshC55StaffHrSharedTruth({
    reason: 'after-server-commit',
    silent: true,
  })
  if (!projection.ok) {
    return {
      ...result,
      ok: false,
      committed: true,
      outcome_code: 'COMMITTED_PROJECTION_REFRESH_FAILED',
      error: 'Staff/HR đã commit server nhưng chưa tải lại được projection; không ghi local giả thành công.',
    }
  }
  c55StaffHrRetryCommands.delete(retryScope)
  return { ...result, ok: true, projection, reason }
}

function isC55RetryableStaffHrFailure(result = {}) {
  return !result?.outcome_code || [
    'CLIENT_NOT_READY', 'SERVER_COMMAND_FAILED', 'INVALID_SERVER_RESULT',
    'CONCURRENT_CONFLICT', 'COMMITTED_PROJECTION_REFRESH_FAILED',
  ].includes(result.outcome_code)
}

async function bootstrapC51AttendanceSessionReportCloudData(
  syncId = cloudUserSyncId,
  { force = false } = {},
) {
  if (!canUseCoreCloudDb() || (!force && c51AttendanceAutoPullUserId === cloudStatus.user?.id)) {
    return { ok: false, skipped: true, outcome_code: 'CLIENT_NOT_READY' }
  }

  const preservation = ensureC5CloseoutLegacyCoreAttendancePreserved()
  if (!preservation.ok) return preservation

  c51AttendanceAutoPullUserId = cloudStatus.user?.id || ''
  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (syncId !== cloudUserSyncId || !readiness.ok) {
    return readiness.ok
      ? { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Center context đã thay đổi.' }
      : readiness
  }

  const result = await pullC51AttendanceSessionReportCloudEntities({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
  })

  if (syncId !== cloudUserSyncId) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Center context đã thay đổi.' }
  }

  if (!result.ok) {
    cloudDbState = {
      ...cloudDbState,
      readinessStatus: readiness.ready === false ? cloudDbState.readinessStatus : 'ready',
      message: result.error || 'Chưa tải được dữ liệu điểm danh. Dữ liệu đang hiển thị chưa được xác nhận là mới nhất.',
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return result
  }

  const mergeResult = mergeC51CloudRecordsIntoLocal({
    attendanceRecords: loadStoredAttendanceRecords(getCurrentResolvedCenterId()),
    baselineState: loadAttendanceBaselineState(getCurrentResolvedCenterId()),
    sessionReports,
    cloudRecords: result.records,
    authoritativeSnapshot: true,
  })

  saveStoredAttendanceRecords(getCurrentResolvedCenterId(), mergeResult.attendanceRecords)
  saveAttendanceBaselineState(getCurrentResolvedCenterId(), mergeResult.baselineState)
  sessionReports = mergeResult.sessionReports
  saveStoredSessionReports(sessionReports)
  cloudDbState = {
    ...cloudDbState,
    readinessStatus: 'ready',
    message: `Đã tải dữ liệu điểm danh (${result.records.length} mục).`,
    messageTone: result.records.length ? 'success' : '',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
  return { ...result, ok: true, projection: mergeResult }
}

async function writeC52AttendanceSessionReportThroughCloud({
  attendanceRecords = [],
  baselineState = null,
  sessionReports: reportsToWrite = [],
  previousAttendanceRecords = [],
  replaceBaselineRecords = false,
  idempotencyKey,
  reason = 'c5-2-authoritative-save',
} = {}) {
  const isAttendanceBoardAction = String(reason).startsWith('baseline-')
    || String(reason).startsWith('attendance-board-')
  const moduleId = isAttendanceBoardAction ? 'bang-diem-danh' : 'thoi-khoa-bieu'
  const unavailableUpstreams = ['core', 'attendance']
    .filter((upstream) => !isModuleUpstreamCurrent(moduleId, upstream))
  if (unavailableUpstreams.length) {
    return {
      ok: false,
      skipped: true,
      outcome_code: 'REQUIRED_REFRESH_UNAVAILABLE',
      error: 'Dữ liệu cần thiết chưa được tải mới. Thông tin bạn nhập vẫn được giữ nguyên; vui lòng bấm Làm mới rồi thử lại.',
    }
  }

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
  const proposedCommand = {
    fingerprint: createC52OperationalRetryFingerprint({
      reason,
      attendanceRecords,
      baselineState,
      sessionReports: reportsToWrite,
      previousAttendanceRecords,
      replaceBaselineRecords,
    }),
    centerId: getCurrentResolvedCenterId(),
    attendanceRecords: cloneC52OperationalCommandValue(attendanceRecords),
    baselineState: cloneC52OperationalCommandValue(baselineState),
    sessionReports: cloneC52OperationalCommandValue(reportsToWrite),
    previousAttendanceRecords: cloneC52OperationalCommandValue(previousAttendanceRecords),
    replaceBaselineRecords: Boolean(replaceBaselineRecords),
    idempotencyKey: idempotencyKey || createOperationalCommandIdempotencyKey(),
  }

  const preservation = ensureC5CloseoutLegacyCoreAttendancePreserved()
  if (!preservation.ok) {
    cloudDbState = {
      ...cloudDbState,
      message: preservation.error,
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return preservation
  }
  const retryScope = `${proposedCommand.centerId}|${proposedCommand.fingerprint}`
  const command = c52AttendanceRetryCommands.get(retryScope) || proposedCommand
  c52AttendanceRetryCommands.set(retryScope, command)
  const readiness = await checkCloudDbReadiness(command.centerId)

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

  if (
    runId !== c51AttendanceCloudWriteRunId
    || readiness.centerId !== command.centerId
    || getCurrentResolvedCenterId() !== command.centerId
  ) {
    return {
      ok: false,
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: 'Cơ sở đã thay đổi; yêu cầu chưa được gửi. Thông tin bạn nhập vẫn được giữ nguyên.',
    }
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
    attendanceRecords: command.attendanceRecords,
    baselineState: command.baselineState,
    sessionReports: command.sessionReports,
    previousAttendanceRecords: command.previousAttendanceRecords,
    replaceBaselineRecords: command.replaceBaselineRecords,
    userId: readiness.user?.id,
    accessState: writeAccessState,
    idempotencyKey: command.idempotencyKey,
  })

  if (
    c52AttendanceRetryCommands.get(retryScope)?.idempotencyKey === command.idempotencyKey
    && (result.ok || !isC52RetryableOperationalFailure(result))
  ) {
    c52AttendanceRetryCommands.delete(retryScope)
  }

  if (
    runId !== c51AttendanceCloudWriteRunId
    || getCurrentResolvedCenterId() !== command.centerId
  ) {
    return {
      ...result,
      ok: false,
      committed: Boolean(result.ok),
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: result.ok
        ? 'Dữ liệu đã được lưu tại cơ sở trước đó nhưng màn hình hiện tại chưa được cập nhật.'
        : result.error || 'Cơ sở đã thay đổi; màn hình hiện tại chưa được cập nhật.',
    }
  }

  let projection = null
  if (result.ok && Array.isArray(result.records) && result.records.length) {
    const mergeResult = mergeC51CloudRecordsIntoLocal({
      attendanceRecords: loadStoredAttendanceRecords(getCurrentResolvedCenterId()),
      baselineState: loadAttendanceBaselineState(getCurrentResolvedCenterId()),
      sessionReports,
      cloudRecords: result.records,
    })
    saveStoredAttendanceRecords(getCurrentResolvedCenterId(), mergeResult.attendanceRecords)
    saveAttendanceBaselineState(getCurrentResolvedCenterId(), mergeResult.baselineState)
    sessionReports = mergeResult.sessionReports
    saveStoredSessionReports(sessionReports)
    projection = mergeResult
  }

  result.projection = projection

  cloudDbState = {
    ...cloudDbState,
    readinessStatus: result.ok ? 'ready' : cloudDbState.readinessStatus,
    message: result.ok
      ? `Đã lưu dữ liệu điểm danh (${result.count || 0} mục).`
      : result.error || 'Chưa lưu được dữ liệu điểm danh. Thông tin bạn nhập vẫn được giữ nguyên.',
    messageTone: result.ok ? 'success' : 'error',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
  return result
}

function createC52OperationalRetryFingerprint(value = {}) {
  return JSON.stringify(normalizeC52OperationalRetrySemantic(value))
}

function normalizeC52OperationalRetrySemantic(value, depth = 0) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeC52OperationalRetrySemantic(item, depth + 1))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      if (
        ['updatedAt', 'createdAt', 'cloudUpdatedAt', 'cloudDeletedAt'].includes(key)
        || key === 'auditLog'
        || (depth > 2 && key === 'id')
      ) {
        return result
      }

      result[key] = normalizeC52OperationalRetrySemantic(value[key], depth + 1)
      return result
    }, {})
}

function cloneC52OperationalCommandValue(value) {
  if (value === null || value === undefined) return value
  return JSON.parse(JSON.stringify(value))
}

function isC52RetryableOperationalFailure(result = {}) {
  return !result?.outcome_code || [
    'CLIENT_NOT_READY',
    'SERVER_COMMAND_FAILED',
    'INVALID_SERVER_RESULT',
    'CONCURRENT_CONFLICT',
  ].includes(result.outcome_code)
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
    message: status.message || 'Kết nối cập nhật điểm danh bị gián đoạn. Vui lòng bấm Làm mới.',
    messageTone: 'error',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
}

function handleC51AttendanceRealtimeRecord(record) {
  if (
    !record
    || !C51_ATTENDANCE_REALTIME_ENTITY_TYPES.includes(record.entity_type)
    || String(record.center_id || '') !== String(getCurrentResolvedCenterId())
  ) {
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

async function bootstrapC52TuitionRecordPackageCloudData(
  syncId = cloudUserSyncId,
  { force = false } = {},
) {
  if (!canUseCoreCloudDb() || (!force && c52TuitionAutoPullUserId === cloudStatus.user?.id)) {
    return { ok: false, skipped: true, outcome_code: 'CLIENT_NOT_READY' }
  }

  const preservation = ensureC5CloseoutLegacyCoreAttendancePreserved()
  if (!preservation.ok) return preservation

  c52TuitionAutoPullUserId = cloudStatus.user?.id || ''
  const readiness = await checkCloudDbReadiness(getCurrentResolvedCenterId())

  if (syncId !== cloudUserSyncId || !readiness.ok) {
    return readiness.ok
      ? { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Center context đã thay đổi.' }
      : readiness
  }

  const result = await pullC52TuitionRecordPackageCloudEntities({
    supabase: readiness.supabase,
    centerId: readiness.centerId,
  })

  if (syncId !== cloudUserSyncId) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Center context đã thay đổi.' }
  }

  if (!result.ok) {
    cloudDbState = {
      ...cloudDbState,
      readinessStatus: readiness.ready === false ? cloudDbState.readinessStatus : 'ready',
      message: result.error || 'Chưa tải được dữ liệu học phí. Dữ liệu đang hiển thị chưa được xác nhận là mới nhất.',
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return result
  }

  const mergeResult = mergeC52TuitionCloudRecordsIntoLocal({
    tuitionRecords,
    cloudRecords: result.records,
    authoritativeSnapshot: true,
  })

  tuitionRecords = mergeResult.tuitionRecords
  saveStoredTuition(tuitionRecords)
  notifications = syncTuitionNotifications(notifications)
  cloudDbState = {
    ...cloudDbState,
    readinessStatus: 'ready',
    message: `Đã tải dữ liệu học phí (${result.records.length} mục).`,
    messageTone: result.records.length ? 'success' : '',
    lastUpdatedAt: new Date().toISOString(),
  }
  render()
  return { ...result, ok: true, projection: mergeResult }
}

async function writeC52TuitionRecordPackageThroughCloud(
  tuitionRecord,
  reason = 'tuition-local-save',
  auditContext = {},
  idempotencyKey,
) {
  const unavailableUpstreams = ['core', 'tuition']
    .filter((upstream) => !isModuleUpstreamCurrent('hoc-phi', upstream))
  if (unavailableUpstreams.length) {
    return {
      ok: false,
      skipped: true,
      outcome_code: 'REQUIRED_REFRESH_UNAVAILABLE',
      error: 'Dữ liệu học phí chưa được tải mới. Thông tin bạn nhập vẫn được giữ nguyên; vui lòng bấm Làm mới rồi thử lại.',
    }
  }

  const writeCenterId = getCurrentResolvedCenterId()
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
  const readiness = await checkCloudDbReadiness(writeCenterId)

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

  const preservation = ensureC5CloseoutLegacyCoreAttendancePreserved()
  if (!preservation.ok) {
    cloudDbState = {
      ...cloudDbState,
      message: preservation.error,
      messageTone: 'error',
      lastUpdatedAt: new Date().toISOString(),
    }
    render()
    return preservation
  }

  if (
    runId !== c52TuitionCloudWriteRunId
    || readiness.centerId !== writeCenterId
    || getCurrentResolvedCenterId() !== writeCenterId
  ) {
    return {
      ok: false,
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: 'Cơ sở đã thay đổi; yêu cầu lưu học phí chưa được gửi. Thông tin bạn nhập vẫn được giữ nguyên.',
    }
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
    idempotencyKey,
  })

  if (
    runId !== c52TuitionCloudWriteRunId
    || getCurrentResolvedCenterId() !== writeCenterId
  ) {
    return {
      ...result,
      ok: false,
      committed: Boolean(result.ok),
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: result.ok
        ? 'Học phí đã được lưu tại cơ sở trước đó nhưng màn hình hiện tại chưa được cập nhật.'
        : result.error || 'Cơ sở đã thay đổi; màn hình học phí hiện tại chưa được cập nhật.',
    }
  }

  let projectionRecord = null
  if (result.ok && tuitionRecord) {
    const mergeResult = mergeC52TuitionCloudRecordsIntoLocal({
      tuitionRecords,
      cloudRecords: result.records,
    })
    tuitionRecords = mergeResult.tuitionRecords
    saveStoredTuition(tuitionRecords)
    notifications = syncTuitionNotifications(notifications)
    projectionRecord = tuitionRecords.find((record) => record.id === tuitionRecord.id) || null
    result.projectionRecord = projectionRecord

    void writeC53TuitionAuditLogEntry({
      supabase: readiness.supabase,
      centerId: readiness.centerId,
      userId: readiness.user?.id,
      accessState: writeAccessState,
      tuitionRecord: projectionRecord || tuitionRecord,
      beforePayload: auditContext.beforePayload || null,
      reason,
    })
  }

  cloudDbState = {
    ...cloudDbState,
    readinessStatus: result.ok ? 'ready' : cloudDbState.readinessStatus,
    message: result.ok
      ? `Đã lưu học phí (${result.count || 0} mục).`
      : result.error || 'Chưa lưu được học phí. Thông tin bạn nhập vẫn được giữ nguyên.',
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
  clearTuitionPaymentFormState()
  tuitionDetailState = null
  tuitionCareNoteState = null
  tuitionAdvisoryWindowState = null
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
  if (String(record?.center_id || '') !== String(getCurrentResolvedCenterId())) {
    return
  }

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
  const preservation = ensureC5CloseoutLegacyCoreAttendancePreserved()
  if (!preservation.ok) {
    return {
      ok: false,
      error: preservation.error,
      reason: preservation.outcome_code,
      backupKey: null,
      counts: getCoreCloudSnapshotCounts({ students, teachers, classSessions }),
    }
  }
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
  const preservation = ensureC5CloseoutLegacyCoreAttendancePreserved()
  if (!preservation.ok) {
    return {
      ok: false,
      error: preservation.error,
      reason: preservation.outcome_code,
      backupKey: null,
      counts: getCloudBootstrapSnapshotCounts({ students, teachers, classSessions, scheduleSessions }),
    }
  }
  const backupResult = createCloudDbPullBackup(window.localStorage)

  if (backupResult && typeof backupResult === 'object' && backupResult.ok === false) {
    return {
      ok: false,
      error: backupResult.error,
      reason: backupResult.reason,
      backupKey: null,
      counts: getCloudBootstrapSnapshotCounts({ students, teachers, classSessions, scheduleSessions }),
    }
  }

  const backupKey = typeof backupResult === 'string' ? backupResult : null

  students = Array.isArray(snapshot.students) ? snapshot.students : []
  teachers = Array.isArray(snapshot.teachers) ? snapshot.teachers : []
  classSessions = Array.isArray(snapshot.classSessions) ? snapshot.classSessions : []
  scheduleSessions = Array.isArray(snapshot.scheduleSessions) ? snapshot.scheduleSessions : []
  scheduleSessions = purgeZombieScheduleSessions({ persist: false, reason: 'cloud-bootstrap' })

  saveStoredStudents(students)
  saveStoredTeachers(teachers)
  saveStoredClassSessions(classSessions)
  saveStoredSchedule(scheduleSessions)

  students = getStoredStudents([])
  teachers = getStoredTeachers([])
  classSessions = getStoredClassSessions([])
  scheduleSessions = getStoredSchedule([])

  return {
    ok: true,
    backupKey,
    counts: getCloudBootstrapSnapshotCounts({ students, teachers, classSessions, scheduleSessions }),
  }
}

async function refreshCloudDbReadiness({ showLoading = false } = {}) {
  if (!canUseCoreCloudDb()) {
    cloudDbState = {
      ...cloudDbState,
      readinessStatus: 'blocked',
      cloudCounts: null,
      message: cloudStatus.membershipStatus === 'loaded'
        ? `Không xác minh được quyền đọc dữ liệu của cơ sở ${getCurrentResolvedCenterId()}.`
        : `Tài khoản hiện tại chưa có quyền hoạt động tại cơ sở ${getCurrentResolvedCenterId()}.`,
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
      message: 'Đang kiểm tra kết nối dữ liệu trung tâm...',
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
    message: result.ok ? 'Đã làm mới số liệu dữ liệu trung tâm.' : result.error,
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
      reloadLocalDataForResolvedCenter()
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

async function bootstrapCoreCloudDataForCurrentCenter(
  syncId = cloudUserSyncId,
  { force = false } = {},
) {
  const context = getCurrentCloudBootstrapContext()
  const now = Date.now()

  if (!canRunCloudBootstrap(context) || (!force && cloudDbAutoPullUserId === cloudStatus.user?.id)) {
    return { ok: false, skipped: true, outcome_code: 'CLIENT_NOT_READY' }
  }

  const preservation = ensureC5CloseoutLegacyCoreAttendancePreserved()
  if (!preservation.ok) return preservation

  if (!force && cloudBootstrapRetryBlockedUntil > now) {
    cloudBootstrapState = {
      ...cloudBootstrapState,
      status:
        cloudBootstrapState.status === CLOUD_BOOTSTRAP_STATUS.LOADING
          ? CLOUD_BOOTSTRAP_STATUS.ERROR
          : cloudBootstrapState.status,
      source: cloudBootstrapState.source || 'local-cache',
      message: cloudBootstrapState.message || 'Cloud pull đang tạm dừng; cache chỉ để xem, không xác nhận business truth.',
    }
    return { ok: false, outcome_code: 'REFRESH_RETRY_BLOCKED', error: cloudBootstrapState.message }
  }

  cloudDbAutoPullUserId = cloudStatus.user?.id || ''
  const hasUsableLocalCache = hasCloudBootstrapSnapshotData({ students, teachers, scheduleSessions })

  if (!hasUsableLocalCache || force) {
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
      source: 'cache-projection',
      message: 'Dữ liệu: Cache chờ xác minh cloud (chỉ xem)',
      lastUpdatedAt: new Date().toISOString(),
    }
  }

  const centerId = context.centerBinding.currentCenterId
  const result = await pullCloudBootstrapCoreEntities(centerId)

  if (syncId !== cloudUserSyncId) {
    return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: 'Center context đã thay đổi.' }
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
      source: 'cache-projection-read-only',
      message: isSchemaOrBadRequest
        ? 'Dữ liệu: Cloud lỗi 400/schema; cache chỉ để xem'
        : 'Dữ liệu: Không xác minh được cloud; cache chỉ để xem',
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
    return result
  }

  const counts = result.counts || getCloudBootstrapSnapshotCounts(result.data)

  const appliedSnapshot = applyCloudBootstrapSnapshotToLocal(result.data)

  if (!appliedSnapshot.ok) {
    cloudBootstrapState = {
      ...cloudBootstrapState,
      status: CLOUD_BOOTSTRAP_STATUS.ERROR,
      source: 'cache-projection-read-only',
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
    return appliedSnapshot
  }

  cloudBootstrapState = {
    ...cloudBootstrapState,
    status: result.empty ? CLOUD_BOOTSTRAP_STATUS.EMPTY : CLOUD_BOOTSTRAP_STATUS.CLOUD,
    source: result.empty ? 'cloud-empty' : 'cloud',
    message: result.empty ? 'Dữ liệu: Cloud trống (nguồn chính)' : 'Dữ liệu: Cloud',
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
  return { ...result, ok: true, projection: appliedSnapshot }
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
      reloadLocalDataForResolvedCenter()
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
  const access = getCloudAttachmentAccessContext()
  const result = access.ok
    ? await listTransactionAttachmentsByMonth({ centerId: access.centerId, monthKey })
    : { ok: false, data: [], error: access.error }

  if (syncId !== cloudUserSyncId) {
    return
  }

  const attachments = result.ok
    ? await addSignedUrlsToAttachments(result.data, access.centerId)
    : []

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

async function addSignedUrlsToAttachments(attachments, centerId = getCloudAttachmentAccessContext().centerId) {
  return Promise.all(
    attachments.map(async (attachment) => {
      const signedUrlResult = await createTransactionImageSignedUrl(
        attachment.storagePath,
        60 * 60,
        centerId || attachment.centerId,
      )

      return {
        ...attachment,
        signedUrl: signedUrlResult.ok ? signedUrlResult.data.signedUrl : '',
        signedUrlError: signedUrlResult.ok ? '' : signedUrlResult.error,
      }
    }),
  )
}

function getCashflowTransactionCodes() {
  return getCashflowTransactionCodesForTransactions(cashflowTransactions)
}

function getCashflowTransactionCodesForTransactions(transactions = []) {
  const transactionsByDate = transactions.reduce((groups, transaction) => {
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

async function openReportTransactionDrilldown({ mode, type, category = '' } = {}) {
  const centerId = getCurrentResolvedCenterId()
  const requestToken = reportTransactionDrilldownToken + 1
  const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(centerId)
  const scope = getReportTransactionScope(reportState.filters, { mode, type, category })
  const scopedTransactions = sortReportSourceTransactions(
    getReportTransactionsForScope(latestCashflowTransactions, reportState.filters, scope),
  )
  const transactionCodes = getCashflowTransactionCodesForTransactions(latestCashflowTransactions)

  reportTransactionDrilldownToken = requestToken
  cashflowTransactions = latestCashflowTransactions
  reportTransactionDrilldownState = {
    centerId,
    requestToken,
    scope,
    title: scope.title,
    subtitle: scope.subtitle,
    transactions: scopedTransactions,
    transactionCodes,
    attachmentCounts: buildReportDrilldownAttachmentCounts(scopedTransactions, transactionCodes),
    status: 'loading',
    error: '',
    message: '',
    messageTone: '',
  }
  render()

  await hydrateReportTransactionDrilldownAttachments({
    centerId,
    requestToken,
    transactions: scopedTransactions,
    transactionCodes,
  })
}

async function hydrateReportTransactionDrilldownAttachments({
  centerId,
  requestToken,
  transactions,
  transactionCodes,
}) {
  if (!reportTransactionDrilldownState || reportTransactionDrilldownToken !== requestToken) {
    return
  }

  const monthKeys = getReportDrilldownMonthKeys(transactions)
  if (!monthKeys.length) {
    reportTransactionDrilldownState = {
      ...reportTransactionDrilldownState,
      status: 'loaded',
      error: '',
    }
    render()
    return
  }

  const access = getCloudAttachmentAccessContext()

  if (!access.ok || access.centerId !== centerId) {
    reportTransactionDrilldownState = {
      ...reportTransactionDrilldownState,
      status: 'loaded',
      error: access.error || 'Cơ sở hiện tại đã thay đổi. Vui lòng mở lại danh sách giao dịch nguồn.',
    }
    render()
    return
  }

  const results = await Promise.all(
    monthKeys.map((monthKey) => listTransactionAttachmentsByMonth({ centerId, monthKey })),
  )

  if (!reportTransactionDrilldownState || reportTransactionDrilldownToken !== requestToken) {
    return
  }

  const failedResult = results.find((result) => !result.ok)
  const monthAttachments = results.flatMap((result) => (result.ok ? result.data : []))

  reportTransactionDrilldownState = {
    ...reportTransactionDrilldownState,
    status: 'loaded',
    error: failedResult
      ? failedResult.error || 'Không thể kiểm tra trạng thái chứng từ giao dịch nguồn.'
      : '',
    attachmentCounts: buildReportDrilldownAttachmentCounts(
      transactions,
      transactionCodes,
      monthAttachments,
    ),
  }
  render()
}

function buildReportDrilldownAttachmentCounts(transactions, transactionCodes, monthAttachments = []) {
  const sourceCodes = new Set(
    transactions
      .map((transaction) => String(transactionCodes[transaction.id] || transaction.transactionCode || '').trim())
      .filter(Boolean),
  )
  const counts = {}
  const seenAttachments = new Set()

  ;[...cloudStatus.attachments, ...monthAttachments].forEach((attachment) => {
    const transactionCode = String(attachment.transactionCode || '').trim()
    if (!sourceCodes.has(transactionCode)) {
      return
    }

    const attachmentKey = String(
      attachment.metadataId || attachment.id || attachment.storagePath || attachment.filePath || '',
    ).trim()
    const uniqueKey = attachmentKey ? `${transactionCode}:${attachmentKey}` : ''
    if (uniqueKey && seenAttachments.has(uniqueKey)) {
      return
    }

    if (uniqueKey) {
      seenAttachments.add(uniqueKey)
    }
    counts[transactionCode] = (counts[transactionCode] || 0) + 1
  })

  return counts
}

function getReportDrilldownMonthKeys(transactions) {
  return [
    ...new Set(
      transactions
        .map((transaction) => String(transaction.transactionDate || transaction.date || '').slice(0, 7))
        .filter((monthKey) => /^\d{4}-\d{2}$/.test(monthKey)),
    ),
  ]
}

function sortReportSourceTransactions(transactions) {
  return [...transactions].sort((first, second) => {
    const dateCompare = String(second.transactionDate || second.date || '').localeCompare(
      String(first.transactionDate || first.date || ''),
    )

    return dateCompare || String(second.id || '').localeCompare(String(first.id || ''))
  })
}

function closeReportTransactionDrilldown() {
  reportTransactionDrilldownState = null
  reportTransactionDrilldownToken += 1
  render()
}

function setReportTransactionDrilldownMessage(message, tone = 'error') {
  if (!reportTransactionDrilldownState) {
    setCloudUploadMessage(message, tone)
    return
  }

  reportTransactionDrilldownState = {
    ...reportTransactionDrilldownState,
    message,
    messageTone: tone,
  }
  render()
}

function getCurrentReportSourceTransaction(transactionId) {
  const centerId = getCurrentResolvedCenterId()
  const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(centerId)
  const transaction = latestCashflowTransactions.find((item) => item.id === transactionId)

  cashflowTransactions = latestCashflowTransactions

  if (!transaction) {
    setReportTransactionDrilldownMessage('Không tìm thấy giao dịch nguồn trong cơ sở hiện tại.', 'error')
    render()
    return null
  }

  if (!isCashflowTransactionInCurrentCenter(transaction, centerId)) {
    setReportTransactionDrilldownMessage('Giao dịch nguồn không thuộc cơ sở hiện tại.', 'error')
    render()
    return null
  }

  return transaction
}

function openReportSourceTransaction(transactionId) {
  const transaction = getCurrentReportSourceTransaction(transactionId)

  if (!transaction) {
    return
  }

  openModuleWindowFromChildInteraction('thu-chi')
  openCashflowTransactionFromRow(transaction.id)
}

async function openReportSourceEvidence(transactionId) {
  const transaction = getCurrentReportSourceTransaction(transactionId)

  if (!transaction) {
    return
  }

  openModuleWindowFromChildInteraction('thu-chi')
  await openTransactionImageManager(transaction.id)
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
  const access = getCloudAttachmentAccessContext()

  if (!access.ok) {
    setCloudUploadMessage(access.error, 'error')
    return
  }

  if (
    cloudStatus.configStatus !== 'configured' ||
    cloudStatus.authStatus !== 'signed-in'
  ) {
    setCloudUploadMessage('Vui lòng đăng nhập Supabase Cloud trước.', 'error')
    return
  }

  if (cloudStatus.membershipStatus !== 'loaded' || !cloudStatus.role) {
    setCloudUploadMessage('Tai khoan chua duoc cap quyen chung tu cho co so hien tai.', 'error')
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
    centerId: access.centerId,
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
  const centerId = String(cloudGalleryState.centerId || '').trim()
  const access = getCloudAttachmentAccessContext()

  if (!access.ok || access.centerId !== centerId) {
    cloudGalleryState = {
      ...cloudGalleryState,
      status: 'error',
      error: access.error || 'Co so hien tai da thay doi. Vui long mo lai kho anh.',
    }
    render()
    return
  }

  const result = await listTransactionAttachmentsByMonth({ centerId, monthKey })

  if (cloudGalleryState?.monthKey !== monthKey) {
    return
  }

  const attachments = result.ok ? await addSignedUrlsToAttachments(result.data, centerId) : []

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
  const access = getCloudAttachmentAccessContext()

  if (!access.ok) {
    setCloudUploadMessage(access.error, 'error')
    return
  }

  transactionImageManagerState = {
    transaction,
    transactionCode,
    centerId: access.centerId,
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
  const centerId = transactionImageManagerState.centerId
  const access = getCloudAttachmentAccessContext()

  if (!access.ok || access.centerId !== centerId) {
    transactionImageManagerState = {
      ...transactionImageManagerState,
      status: 'error',
      error: access.error || 'Co so hien tai da thay doi. Vui long mo lai giao dich.',
      deletingAttachmentId: null,
    }
    render()
    return
  }

  const result = await listTransactionAttachmentsByTransactionCode({
    centerId,
    transactionCode,
  })

  if (transactionImageManagerState?.transactionCode !== transactionCode) {
    return
  }

  const attachments = result.ok ? await addSignedUrlsToAttachments(result.data, centerId) : []

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
  const centerId = transactionImageManagerState?.centerId

  if (!attachment || !transactionCode) {
    return
  }

  const access = getCloudAttachmentAccessContext()

  if (!access.ok || access.centerId !== centerId) {
    transactionImageManagerState = {
      ...transactionImageManagerState,
      deletingAttachmentId: null,
      message: access.error || 'Co so hien tai da thay doi. Vui long mo lai giao dich.',
      messageTone: 'error',
    }
    render()
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

  const boundTransaction = cashflowTransactions.find((transaction) =>
    Array.isArray(transaction.attachments)
      && transaction.attachments.some((item) => item.id === attachment.id),
  )
  if (boundTransaction) {
    const category = cashflowCategories.find((item) => item.id === boundTransaction.categoryId)
    if (!category) {
      transactionImageManagerState = {
        ...transactionImageManagerState,
        deletingAttachmentId: null,
        message: 'Không resolve được danh mục authoritative; chưa gỡ chứng từ.',
        messageTone: 'error',
      }
      render()
      return
    }
    const result = await writeC54FinanceCommand(
      buildC54SaveTransactionCommand(boundTransaction, {
        category,
        attachmentAction: 'UNBIND',
      }),
      { reason: 'finance-attachment-unbind' },
    )
    if (!result.ok) return
    transactionImageManagerState = null
    setCloudUploadMessage(
      'Đã gỡ binding; file private được giữ lại, không silent-delete chứng từ tài chính.',
      'success',
    )
    return
  }

  const storageResult = await deleteTransactionImageObject(attachment.storagePath, centerId)
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

  const metadataResult = await deleteTransactionAttachmentMetadata(attachment.id, centerId)

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

  const category = cashflowCategories.find((item) => item.id === transaction.categoryId)
  if (!category) {
    setCloudUploadMessage('Danh mục authoritative không còn khả dụng.', 'error')
    return
  }
  const centerId = getCurrentResolvedCenterId()
  const transactionCode = transaction.transactionCode || getCashflowTransactionCodes()[transaction.id]
  const uploadResult = await uploadStagedCashflowEvidence({
    transaction,
    transactionCode,
    file,
    centerId,
  })
  if (!uploadResult.ok) {
    setCloudUploadMessage(uploadResult.error, 'error')
    return
  }
  const bindResult = await writeC54FinanceCommand(
    buildC54SaveTransactionCommand(transaction, {
      category,
      attachmentAction: 'BIND',
      attachmentId: uploadResult.attachment.metadataId || uploadResult.attachment.id,
    }),
    { reason: 'finance-attachment-bind' },
  )
  if (!bindResult.ok) {
    if (!bindResult.committed) {
      await cleanupCloudCashflowAttachment(uploadResult.attachment, centerId)
    }
    setCloudUploadMessage(bindResult.error, 'error')
    return
  }
  setCloudUploadMessage('Đã upload và bind ảnh vào giao dịch authoritative.', 'success')
  await loadCurrentMonthCloudAttachments()
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

function getC54AttachmentRetryIntent(file) {
  if (!file || (typeof file !== 'object' && typeof file !== 'function')) return ''
  let intent = c54AttachmentRetryIntents.get(file)
  if (!intent) {
    intent = createC54FinanceIdempotencyKey()
    c54AttachmentRetryIntents.set(file, intent)
  }
  return intent
}

async function uploadStagedCashflowEvidence({
  transaction,
  transactionCode,
  file,
  centerId,
} = {}) {
  const validation = validateTransactionImageFile(file)

  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
      attachment: null,
    }
  }

  const compressionResult = await compressTransactionImage(file)

  if (!compressionResult.ok) {
    return {
      ok: false,
      error: compressionResult.error,
      attachment: null,
    }
  }

  const existingResult = await listTransactionAttachmentsByTransactionCode({
    centerId,
    transactionCode,
  })

  if (!existingResult.ok) {
    return {
      ok: false,
      error: existingResult.error,
      attachment: null,
    }
  }

  let attachmentIndex = existingResult.data.length + 1
  let fileName = ''
  let storagePath = ''
  let uploadResult = null

  for (let attempt = 0; attempt < 20; attempt += 1) {
    fileName = buildAttachmentFileName(transactionCode, attachmentIndex, 'jpg')
    storagePath = buildTransactionImageStoragePath({
      centerId,
      dateInput: transaction.transactionDate,
      fileName,
    })
    uploadResult = await uploadTransactionImageBlob({
      centerId,
      storagePath,
      blob: compressionResult.data.blob,
    })

    if (uploadResult.ok || !isDuplicateStorageError(uploadResult.error)) {
      break
    }

    attachmentIndex += 1
  }

  if (!uploadResult?.ok) {
    return {
      ok: false,
      error: uploadResult?.error || 'Không thể tải ảnh lên.',
      attachment: null,
    }
  }

  const metadataResult = await createTransactionAttachmentMetadata({
    centerId,
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

  if (!metadataResult.ok) {
    await deleteTransactionImageObject(storagePath, centerId)
    return {
      ok: false,
      error: `Ảnh đã upload nhưng lưu metadata thất bại: ${metadataResult.error}`,
      attachment: null,
    }
  }

  return {
    ok: true,
    error: '',
    attachment: {
      id: metadataResult.data.id || `attachment-${Date.now()}`,
      metadataId: metadataResult.data.id || '',
      name: metadataResult.data.fileName || fileName,
      originalName: metadataResult.data.originalName || file.name,
      fileName: metadataResult.data.fileName || fileName,
      type: metadataResult.data.mimeType || compressionResult.data.mimeType,
      mimeType: metadataResult.data.mimeType || compressionResult.data.mimeType,
      size: metadataResult.data.sizeBytes || compressionResult.data.sizeBytes,
      sizeBytes: metadataResult.data.sizeBytes || compressionResult.data.sizeBytes,
      storageBucket: metadataResult.data.storageBucket || 'transaction-images',
      storagePath: metadataResult.data.storagePath || storagePath,
      transactionCode,
      uploadedAt: metadataResult.data.createdAt || new Date().toISOString(),
      uploadedBy: metadataResult.data.uploadedBy || cloudStatus.user?.id || '',
      uploadedByName: metadataResult.data.uploadedByName || '',
      createdAt: metadataResult.data.createdAt || new Date().toISOString(),
    },
  }
}

async function cleanupCloudCashflowAttachment(attachment, centerId) {
  if (!attachment?.storagePath) {
    return {
      ok: true,
      error: '',
    }
  }

  const storageResult = await deleteTransactionImageObject(attachment.storagePath, centerId)
  const storageWasMissing =
    !storageResult.ok && isMissingStorageObjectError(storageResult.error)

  if (!storageResult.ok && !storageWasMissing) {
    return {
      ok: false,
      error: storageResult.error,
    }
  }

  const metadataId = attachment.metadataId || attachment.id
  if (!metadataId) {
    return {
      ok: true,
      error: '',
    }
  }

  const metadataResult = await deleteTransactionAttachmentMetadata(metadataId, centerId)

  return metadataResult.ok
    ? { ok: true, error: '' }
    : { ok: false, error: metadataResult.error }
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
    resetParentFirstRuntimeForAccessBoundary('')
    resetC55StaffHrRuntimeForAccessBoundary('')
    resetC56InventoryRuntimeForAccessBoundary('')
    resetC57CalendarNotesRuntimeForAccessBoundary('')
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

const staffListFilterNames = ['query', 'departmentId', 'employmentStatus', 'teacherLink', 'accountLink']
const staffAttendanceFilterNames = ['weekStartDate', 'location', 'person']

function getOpenStaffModuleElement() {
  return document.querySelector('.desktop-window[data-module-id="nhan-vien"] .staff-module')
}

function buildDetachedStaffModuleElement() {
  const template = document.createElement('template')
  template.innerHTML = renderCurrentStaffModule().trim()
  return template.content.firstElementChild
}

function refreshStaffModuleRegion(region) {
  const currentModule = getOpenStaffModuleElement()

  if (!currentModule) {
    return false
  }

  const nextModule = buildDetachedStaffModuleElement()

  if (!nextModule) {
    return false
  }

  if (region === 'profile-list') {
    const currentList = currentModule.querySelector('[aria-labelledby="staff-profile-list-title"]')
    const nextList = nextModule.querySelector('[aria-labelledby="staff-profile-list-title"]')

    if (!currentList || !nextList) {
      return false
    }

    currentList.replaceWith(nextList)
    bindStaffActionButtons(nextList)
    return true
  }

  if (region === 'attendance') {
    const currentDetails = currentModule.querySelector('.staff-attendance-details')
    const nextDetails = nextModule.querySelector('.staff-attendance-details')

    if (!currentDetails || !nextDetails) {
      return false
    }

    staffAttendanceFilterNames.forEach((filterName) => {
      const currentControl = currentDetails.querySelector(`[data-staff-filter="${filterName}"]`)
      const nextControl = nextDetails.querySelector(`[data-staff-filter="${filterName}"]`)

      if (!currentControl || !nextControl) {
        return
      }

      if (currentControl.tagName === 'SELECT') {
        currentControl.innerHTML = nextControl.innerHTML
      }
      currentControl.value = nextControl.value
    })

    const currentSummary = currentDetails.querySelector('.staff-summary')
    const nextSummary = nextDetails.querySelector('.staff-summary')
    const currentLayout = currentDetails.querySelector('.staff-layout')
    const nextLayout = nextDetails.querySelector('.staff-layout')

    if (!currentSummary || !nextSummary || !currentLayout || !nextLayout) {
      return false
    }

    currentSummary.replaceWith(nextSummary)
    currentLayout.replaceWith(nextLayout)
    return true
  }

  return false
}

function syncStaffListFilterControls() {
  const currentModule = getOpenStaffModuleElement()

  if (!currentModule) {
    return
  }

  staffListFilterNames.forEach((filterName) => {
    const control = currentModule.querySelector(`[data-staff-filter="${filterName}"]`)
    if (control) {
      control.value = staffFilters[filterName]
    }
  })
}

function clearStaffListFiltersFromUi() {
  staffFilters = clearStaffListFilters(staffFilters)
  syncStaffListFilterControls()
  refreshStaffModuleRegion('profile-list')
}

function bindStaffFilterControls(root = document) {
  root.querySelectorAll('[data-staff-filter]').forEach((control) => {
    const eventName = control.tagName === 'SELECT' ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      const filterName = control.dataset.staffFilter
      staffFilters = {
        ...staffFilters,
        [filterName]: control.value,
      }

      if (staffListFilterNames.includes(filterName)) {
        refreshStaffModuleRegion('profile-list')
        return
      }

      if (staffAttendanceFilterNames.includes(filterName)) {
        refreshStaffModuleRegion('attendance')
      }
    })
  })
}

function bindStaffActionButtons(root = document) {
  root.querySelectorAll('[data-staff-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const action = button.dataset.staffAction

      if (action === 'save') {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (action === 'clear-filters') {
        clearStaffListFiltersFromUi()
        return
      }

      if (action === 'refresh') {
        void refreshC55StaffHrSharedTruth({ reason: 'manual-refresh' })
        return
      }

      if (action === 'open-create') {
        openCreateStaffForm()
        return
      }

      if (action === 'open-edit') {
        openEditStaffForm(button.dataset.staffId)
        return
      }

      if (action === 'open-administrative-profile') {
        void openStaffAdministrativeProfileWindow(button.dataset.staffId)
        return
      }

      if (action === 'close-form') {
        closeStaffForm()
        return
      }

      if (action === 'archive') {
        handleArchiveStaff(button.dataset.staffId)
        return
      }

      if (action === 'restore') {
        handleRestoreStaff(button.dataset.staffId)
        return
      }

      if (action === 'open-linked-teacher') {
        openLinkedTeacherFromStaff(button.dataset.teacherId)
        return
      }

      if (action === 'unlink-teacher') {
        unlinkTeacherFromStaff(button.dataset.staffId, button.dataset.teacherId)
        return
      }

      if (action === 'open-departments') {
        openStaffDepartmentPanel()
      }
    })
  })
}

function bindStaffAdministrativeProfileActionDelegates(root = document) {
  root
    .querySelectorAll('.desktop-window.is-staff-administrative-profile[data-window-id]')
    .forEach((windowElement) => {
      if (boundStaffAdministrativeActionWindows.has(windowElement)) return
      boundStaffAdministrativeActionWindows.add(windowElement)

      windowElement.addEventListener('click', (event) => {
        const governanceButton = event.target.closest?.(
          '[data-staff-document-attachment-governance-action]',
        )
        if (governanceButton && windowElement.contains(governanceButton)) {
          event.preventDefault()
          event.stopPropagation()
          const governanceWindowId = windowElement.dataset.windowId
          if (governanceWindowId) {
            void handleStaffDocumentAttachmentGovernanceAction(
              governanceWindowId,
              governanceButton.dataset.staffDocumentAttachmentGovernanceAction,
              governanceButton,
            )
          }
          return
        }
        const button = event.target.closest?.('[data-staff-document-action]')
        if (!button || !windowElement.contains(button)) return
        event.preventDefault()
        event.stopPropagation()

        const windowId = windowElement.dataset.windowId
        const action = button.dataset.staffDocumentAction
        const documentId = button.dataset.documentId || ''
        if (!windowId) return
        if (action === 'start-create') return startStaffDocumentCreate(windowId)
        if (action === 'start-edit') return startStaffDocumentEdit(windowId, documentId)
        if (action === 'open-detail') return openStaffDocumentDetail(windowId, documentId)
        if (action === 'cancel-form' || action === 'back-to-list') {
          return closeStaffDocumentFormOrDetail(windowId)
        }
        if (action === 'clear-filters') return clearStaffDocumentFilters(windowId)
        if (action === 'attachment-retry-load') {
          void loadStaffDocumentAttachment(windowId)
          return
        }
        if ([
          'attachment-view',
          'attachment-download',
          'attachment-version-view',
          'attachment-version-download',
        ].includes(action)) {
          void handleStaffDocumentAttachmentAccess(
            windowId,
            action.endsWith('download') ? 'download' : 'preview',
            button,
            action.startsWith('attachment-version-')
              ? button.dataset.attachmentVersion
              : null,
          )
          return
        }
        if (action === 'archive' || action === 'restore') {
          void changeStaffDocumentArchiveState(windowId, documentId, action)
        }
      })

      windowElement.addEventListener('input', (event) => {
        const control = event.target
        const windowId = windowElement.dataset.windowId
        if (!windowId || !(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
          return
        }
        if (control.dataset.staffDocumentFilter) {
          updateStaffDocumentFilter(windowId, control.dataset.staffDocumentFilter, control.value)
        }
        if (control.dataset.staffDocumentField) {
          updateStaffDocumentDraftField(windowId, control.dataset.staffDocumentField, control.value)
        }
        if (control.dataset.staffDocumentAttachmentInput !== undefined) {
          void handleStaffDocumentAttachmentSelection(windowId, control)
        }
        if (control.dataset.staffDocumentAttachmentReplacementInput !== undefined) {
          void handleStaffDocumentAttachmentReplacement(windowId, control)
        }
      })

      windowElement.addEventListener('change', (event) => {
        const control = event.target
        const windowId = windowElement.dataset.windowId
        if (!windowId || !(control instanceof HTMLSelectElement || control instanceof HTMLInputElement)) {
          return
        }
        if (control.dataset.staffDocumentFilter) {
          updateStaffDocumentFilter(windowId, control.dataset.staffDocumentFilter, control.value)
        }
        if (control.dataset.staffDocumentField) {
          updateStaffDocumentDraftField(windowId, control.dataset.staffDocumentField, control.value)
        }
      })

      windowElement.addEventListener('submit', (event) => {
        const form = event.target.closest?.('[data-staff-document-form]')
        if (!form || !windowElement.contains(form)) return
        event.preventDefault()
        event.stopPropagation()
        const windowId = windowElement.dataset.windowId
        if (windowId) void handleStaffDocumentSubmit(windowId, form)
      })

      windowElement.addEventListener('click', (event) => {
        const button = event.target.closest?.('[data-staff-governance-action]')
        if (!button || !windowElement.contains(button)) return
        event.preventDefault()
        event.stopPropagation()
        const windowId = windowElement.dataset.windowId
        const action = button.dataset.staffGovernanceAction
        const requestId = button.dataset.requestId || ''
        if (!windowId) return
        if (action === 'load-more-audit') return loadMoreStaffAdministrativeAudit(windowId)
        if (action === 'open-policy-form') {
          return openStaffAdministrativeRetentionPolicyForm(windowId)
        }
        if (action === 'open-request-form') {
          return openStaffAdministrativeDeletionRequestForm(windowId)
        }
        if (action === 'cancel-form') return cancelStaffAdministrativeGovernanceForm(windowId)
        if (action === 'cancel-request') {
          void cancelStaffAdministrativeDeletionRequestById(windowId, requestId)
          return
        }
        if (action === 'approve-request') {
          void reviewStaffAdministrativeDeletionRequestById(
            windowId,
            requestId,
            'approve',
          )
          return
        }
        if (action === 'open-deny-form') {
          openStaffAdministrativeDenyRequestForm(windowId, requestId)
        }
      })

      windowElement.addEventListener('input', (event) => {
        const control = event.target
        const windowId = windowElement.dataset.windowId
        if (
          !windowId ||
          !(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) ||
          !control.dataset.staffGovernanceField
        ) return
        updateStaffAdministrativeGovernanceDraftField(
          windowId,
          control.dataset.staffGovernanceField,
          control.type === 'checkbox' ? control.checked : control.value,
        )
      })

      windowElement.addEventListener('change', (event) => {
        const control = event.target
        const windowId = windowElement.dataset.windowId
        if (
          !windowId ||
          !(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)
        ) return
        if (control.dataset.staffGovernanceAuditFilter) {
          updateStaffAdministrativeAuditFilter(
            windowId,
            control.dataset.staffGovernanceAuditFilter,
            control.value,
          )
        }
        if (control.dataset.staffGovernanceField) {
          updateStaffAdministrativeGovernanceDraftField(
            windowId,
            control.dataset.staffGovernanceField,
            control.type === 'checkbox' ? control.checked : control.value,
          )
        }
      })

      windowElement.addEventListener('submit', (event) => {
        const form = event.target.closest?.('[data-staff-governance-form]')
        if (!form || !windowElement.contains(form)) return
        event.preventDefault()
        event.stopPropagation()
        const windowId = windowElement.dataset.windowId
        if (!windowId) return
        if (form.dataset.staffGovernanceForm === 'policy') {
          void handleStaffAdministrativeRetentionPolicySubmit(windowId)
        }
        if (form.dataset.staffGovernanceForm === 'request') {
          void handleStaffAdministrativeDeletionRequestSubmit(windowId)
        }
        if (form.dataset.staffGovernanceForm === 'deny') {
          void handleStaffAdministrativeDenyRequestSubmit(windowId)
        }
      })

      windowElement.addEventListener('click', (event) => {
        const button = event.target.closest?.('[data-staff-administrative-action]')

        if (!button || !windowElement.contains(button)) return
        event.preventDefault()
        event.stopPropagation()

        const action = button.dataset.staffAdministrativeAction
        const windowId = windowElement.dataset.windowId

        if (!windowId) return
        if (action === 'start-create') {
          startStaffAdministrativeProfileCreate(windowId)
          return
        }
        if (action === 'start-edit') {
          startStaffAdministrativeProfileEdit(windowId)
          return
        }
        if (action === 'cancel-edit') {
          cancelStaffAdministrativeProfileEdit(windowId)
          return
        }
        if (action === 'mark-reviewed') {
          void markStaffAdministrativeProfileAsReviewed(windowId)
          return
        }
        if (action === 'toggle-sensitive') {
          void toggleStaffAdministrativeSensitiveField(
            windowId,
            button.dataset.sensitiveField,
            button,
            windowElement,
          )
          return
        }
        if (action === 'navigate') {
          navigateStaffAdministrativeProfileSection(button)
        }
      })
    })
}

function bindEvents() {
  bindStaffDocumentAttachmentViewer()
  bindStartMenuOutsidePointer()
  bindWindowOverflowOutsidePointer()
  bindNotificationOutsidePointer()
  bindCenterProfileOutsidePointer()
  bindModuleNotificationOutsidePointer()
  bindPreservedScrollRetentionEvents()

  document
    .querySelector('[data-internal-console-action="return-dashboard"]')
    ?.addEventListener('click', () => {
      if (window.location.hash === INTERNAL_CENTERS_ROUTE_HASH) {
        window.location.hash = ''
        return
      }

      render()
    })

  const internalAddCenterNameInput = document.querySelector('[data-internal-add-center-name]')
  internalAddCenterNameInput?.addEventListener('input', () => {
    internalAddCenterFormState = {
      ...internalAddCenterFormState,
      name: internalAddCenterNameInput.value,
      error: '',
      success: '',
    }

    const preview = getInternalAddCenterPreview(internalAddCenterFormState.name)
    const slugPreview = document.querySelector('[data-internal-add-center-preview="slug"]')
    const centerIdPreview = document.querySelector('[data-internal-add-center-preview="centerId"]')
    const submitButton = document.querySelector('[data-internal-add-center-submit]')

    if (slugPreview) {
      slugPreview.textContent = preview.slug || '-'
    }

    if (centerIdPreview) {
      centerIdPreview.textContent = preview.centerId || '-'
    }

    if (submitButton) {
      submitButton.disabled = !preview.isSubmittable
    }
  })

  document.querySelector('[data-internal-add-center-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    void handleInternalAddCenterSubmit()
  })

  document.querySelectorAll('[data-internal-open-center-id]').forEach((button) => {
    button.addEventListener('click', () => {
      void handleInternalOpenCenter(button.dataset.internalOpenCenterId)
    })
  })

  document.querySelectorAll('[data-internal-copy-admin-email]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault()
      event.stopPropagation()
      const email = String(button.dataset.internalCopyAdminEmail || '').trim()
      const centerId = String(button.dataset.internalCopyAdminCenterId || '').trim()

      if (!email) {
        internalCenterAdminAccountsState = {
          ...internalCenterAdminAccountsState,
          copiedCenterId: '',
          copyMessage: 'Chưa có email admin để copy',
        }
        render()
        return
      }

      if (!navigator.clipboard?.writeText) {
        internalCenterAdminAccountsState = {
          ...internalCenterAdminAccountsState,
          copiedCenterId: '',
          copyMessage: 'Không copy tự động được. Hãy copy email admin thủ công.',
        }
        render()
        return
      }

      try {
        await navigator.clipboard.writeText(email)
        internalCenterAdminAccountsState = {
          ...internalCenterAdminAccountsState,
          copiedCenterId: centerId,
          copyMessage: 'Đã copy email admin.',
        }
        render()
      } catch (error) {
        internalCenterAdminAccountsState = {
          ...internalCenterAdminAccountsState,
          copiedCenterId: '',
          copyMessage: 'Không copy tự động được. Hãy copy email admin thủ công.',
        }
        render()
        console.warn('Không copy được email admin cơ sở.', error)
      }
    })
  })

  document.querySelectorAll('[data-internal-reset-admin-center-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openInternalResetPasswordConfirm(button.dataset.internalResetAdminCenterId)
    })
  })

  document.querySelectorAll('[data-internal-create-admin-center-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openInternalCreateAdminConfirm(button.dataset.internalCreateAdminCenterId)
    })
  })

  document.querySelectorAll('[data-internal-revoke-admin-center-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openInternalRevokeAccessConfirm(button.dataset.internalRevokeAdminCenterId)
    })
  })

  document.querySelectorAll('[data-internal-restore-admin-center-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openInternalRestoreAccessConfirm(button.dataset.internalRestoreAdminCenterId)
    })
  })

  document.querySelector('[data-internal-create-admin-cancel]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    closeInternalCreateAdminConfirm()
  })

  document.querySelector('[data-internal-create-admin-confirm]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    void handleInternalCreateAdminAccount()
  })

  document.querySelectorAll('[data-internal-revoke-cancel]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      closeInternalRevokeAccessConfirm()
    })
  })

  document.querySelector('[data-internal-revoke-acknowledge-risk]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    acknowledgeInternalRevokeRisk()
  })

  document.querySelector('[data-internal-revoke-confirm]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    void handleInternalRevokeAdminAccess()
  })

  document.querySelector('[data-internal-revoke-typed-confirmation]')?.addEventListener('input', (event) => {
    updateInternalRevokeTypedConfirmation(event.target.value)
  })

  document.querySelectorAll('[data-internal-restore-cancel]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      closeInternalRestoreAccessConfirm()
    })
  })

  document.querySelector('[data-internal-restore-confirm]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    void handleInternalRestoreAdminAccess()
  })

  document.querySelector('[data-internal-restore-typed-confirmation]')?.addEventListener('input', (event) => {
    updateInternalRestoreTypedConfirmation(event.target.value)
  })

  document.querySelector('[data-internal-reset-cancel]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    closeInternalResetPasswordConfirm()
  })

  document.querySelector('[data-internal-reset-confirm]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    void handleInternalResetAdminPassword()
  })

  document.querySelectorAll('[data-internal-handoff-copy]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const handoff = internalCenterAdminAccountsState.handoff
      const copyTarget = button.dataset.internalHandoffCopy

      if (!handoff) {
        return
      }

      if (copyTarget === 'email') {
        void copyInternalAccountText(handoff.email, 'Đã copy email.')
        return
      }

      if (copyTarget === 'password') {
        void copyInternalAccountText(handoff.temporaryPassword, 'Đã copy mật khẩu.')
        return
      }

      if (copyTarget === 'all') {
        void copyInternalAccountText(buildInternalPasswordHandoffText(handoff), 'Đã copy toàn bộ thông tin bàn giao.')
      }
    })
  })

  document.querySelector('[data-internal-handoff-close]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    closeInternalPasswordHandoff()
  })

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

  document.querySelectorAll(moduleLauncherSelector).forEach((button) => {
    button.addEventListener('click', (event) => {
      const launcher = getModuleLauncherFromEventTarget(event.target)
      if (launcher !== button) {
        return
      }

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
    if (isNotificationCenterOpen) {
      const context = getCurrentCanonicalCenterContext()
      notificationRefreshState = createModuleRefreshState({
        centerId: context.centerId,
        message: context.ok
          ? 'Đang chờ tải thông báo mới nhất của cơ sở hiện tại.'
          : 'Chưa xác định được cơ sở đang hoạt động; thông báo cũ được ẩn để tránh nhầm lẫn.',
      })
    }
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    isCenterProfilePopoverOpen = false
    render()
    if (isNotificationCenterOpen) {
      void refreshNotificationAuthoritativeUpstreams('notification-open')
    }
  })

  document.querySelectorAll('[data-ui-theme]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextTheme = button.dataset.uiTheme
      if (!['light', 'dark'].includes(nextTheme) || nextTheme === currentUiTheme) {
        return
      }

      currentUiTheme = nextTheme
      saveUiTheme(currentUiTheme)
      applyUiTheme()
      render()
    })
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
      if (!moduleId || !isProductionModuleAvailable(moduleId)) {
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

  document.querySelector('[data-notification-action="refresh-authoritative"]')?.addEventListener('click', () => {
    void refreshNotificationAuthoritativeUpstreams('notification-manual-refresh')
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
    control.addEventListener('input', (event) => {
      const filterName = control.dataset.tuitionFilter
      const selectionStart = 'selectionStart' in control ? control.selectionStart : null
      const selectionEnd = 'selectionEnd' in control ? control.selectionEnd : null

      withTuitionViewportLock(() => {
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
      }, event)
    })
  })

  document.querySelectorAll('[data-module-authoritative-refresh]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      void refreshModuleAuthoritativeUpstreams(button.dataset.moduleAuthoritativeRefresh, {
        reason: 'manual-refresh',
      })
    })
  })

  document.querySelectorAll('[data-tuition-advisory-action="save"]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      await withTuitionViewportLock(async () => {
        const studentId = button.dataset.studentId
        const monthKey = button.dataset.monthKey
        const careStatus =
          document.querySelector(`[data-tuition-advisory-care-status="${studentId}"]`)?.value ||
          'auto'
        const note =
          document.querySelector(`[data-tuition-advisory-note="${studentId}"]`)?.value || ''
        const identity = `${studentId}:${monthKey}`
        const existingNote = attendanceAdvisoryNotes.find(
          (item) => `${item.studentId}:${item.monthKey}` === identity,
        )
        const nextNote = {
          ...existingNote,
          studentId,
          monthKey,
          careStatus,
          note: note.trim(),
        }
        await writeC57CalendarNotesCommand(buildC57UpsertAdvisoryNoteCommand(nextNote), {
          reason: 'attendance-advisory-note-save',
        })
      }, event)
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
      reportTransactionDrilldownState = null
      reportTransactionDrilldownToken += 1
      render()
    })
  })

  document.querySelector('.report-module')?.addEventListener('click', (event) => {
    const sourceModal = event.target.closest('[data-report-source-modal]')
    let sourceActionButton = event.target.closest('[data-report-source-action]')

    if (sourceActionButton?.classList.contains('report-source-modal-backdrop') && sourceModal) {
      sourceActionButton = null
    }

    if (sourceActionButton) {
      event.preventDefault()
      event.stopPropagation()

      const action = sourceActionButton.dataset.reportSourceAction
      if (action === 'close') {
        closeReportTransactionDrilldown()
        return
      }

      if (action === 'filter') {
        openReportTransactionDrilldown({
          mode: reportTransactionDrilldownState?.scope?.mode,
          type: sourceActionButton.dataset.reportSourceType,
          category: reportTransactionDrilldownState?.scope?.category,
        })
        return
      }

      const transactionId = sourceActionButton.dataset.reportSourceTransactionId
      if (action === 'open-transaction') {
        openReportSourceTransaction(transactionId)
        return
      }

      if (action === 'view-evidence') {
        openReportSourceEvidence(transactionId)
        return
      }

      if (action === 'print-transaction') {
        const transaction = getCurrentReportSourceTransaction(transactionId)
        if (transaction) {
          printCashflowTransaction(transaction.id)
        }
        return
      }
    }

    if (event.target.closest('.report-source-modal-backdrop') && !sourceModal) {
      event.preventDefault()
      event.stopPropagation()
      closeReportTransactionDrilldown()
      return
    }

    const drilldownButton = event.target.closest('[data-report-drilldown-action="open"]')

    if (drilldownButton) {
      event.preventDefault()
      event.stopPropagation()
      openReportTransactionDrilldown({
        mode: drilldownButton.dataset.reportDrilldownMode,
        type: drilldownButton.dataset.reportDrilldownType,
        category: drilldownButton.dataset.reportDrilldownCategory,
      })
      return
    }

    const viewButton = event.target.closest('[data-report-view-mode]')

    if (viewButton) {
      event.preventDefault()
      event.stopPropagation()
      reportState = {
        ...reportState,
        viewMode: viewButton.dataset.reportViewMode === 'week' ? 'week' : 'day',
        selectedBarDetail: null,
      }
      reportTransactionDrilldownState = null
      reportTransactionDrilldownToken += 1
      render()
      return
    }

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
    reportTransactionDrilldownState = null
    reportTransactionDrilldownToken += 1
    render()
  })

  bindStaffFilterControls()

  document.querySelectorAll('[data-staff-form-field]').forEach((control) => {
    const eventName = control.tagName === 'SELECT' ? 'change' : 'input'
    control.addEventListener(eventName, () => {
      updateStaffFormField(control.dataset.staffFormField, control.value)
      if (control.dataset.staffFormField === 'employmentStatus') {
        render()
      }
    })
  })

  document.querySelector('[data-staff-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    handleStaffFormSubmit(event.currentTarget)
  })

  document.querySelectorAll('[data-staff-administrative-field]').forEach((control) => {
    const eventName = control.matches('select, input[type="date"]') ? 'change' : 'input'
    control.addEventListener(eventName, () => {
      const windowId = control.closest('[data-window-id]')?.dataset.windowId
      if (windowId) {
        updateStaffAdministrativeProfileDraftField(
          windowId,
          control.dataset.staffAdministrativeField,
          control.value,
        )
      }
    })
  })

  document.querySelectorAll('[data-staff-administrative-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const windowId = form.closest('[data-window-id]')?.dataset.windowId
      if (windowId) void handleStaffAdministrativeProfileSubmit(windowId, form)
    })
  })

  bindStaffAdministrativeProfileActionDelegates()

  document.querySelectorAll('[data-staff-lifecycle-field]').forEach((control) => {
    const eventName = control.matches('select, input[type="date"], input[type="radio"], input[type="checkbox"]')
      ? 'change'
      : 'input'

    if (control.matches('input[type="radio"], input[type="checkbox"]')) {
      control.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
        }
      })
    }

    control.addEventListener(eventName, () => {
      const value = control.type === 'checkbox' ? control.checked : control.value
      updateStaffLifecycleField(control.dataset.staffLifecycleField, value)
      syncStaffLifecycleDraftDom(control.dataset.staffLifecycleField)
    })
  })

  document.querySelector('[data-staff-lifecycle-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    handleStaffLifecycleSubmit(event.currentTarget)
  })

  document.querySelectorAll('[data-staff-lifecycle-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const action = button.dataset.staffLifecycleAction

      if (action === 'open-status') {
        openStaffLifecycleModal(button.dataset.staffId, 'status')
        return
      }
      if (action === 'open-termination') {
        openStaffLifecycleModal(button.dataset.staffId, 'termination')
        return
      }
      if (action === 'close') {
        closeStaffLifecycleModal()
      }
    })
  })

  bindStaffActionButtons()

  document.querySelector('[data-staff-account-query]')?.addEventListener('input', (event) => {
    updateStaffAccountLinkSearch(event.currentTarget.value)
  })

  document.querySelectorAll('[data-staff-account-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const action = button.dataset.staffAccountAction

      if (action === 'open-link') {
        void openStaffAccountLinkModal(button.dataset.staffId)
        return
      }

      if (action === 'close-link') {
        closeStaffAccountLinkModal()
        return
      }

      if (action === 'reload-directory') {
        void refreshStaffAccountDirectory()
        return
      }

      if (action === 'select-membership') {
        void prepareStaffAccountLinkConfirmation(button.dataset.membershipId)
        return
      }

      if (action === 'cancel-confirm') {
        cancelStaffAccountLinkConfirmation()
        return
      }

      if (action === 'confirm-link') {
        void handleConfirmStaffAccountLink()
        return
      }

      if (action === 'unlink') {
        void handleUnlinkStaffAccount(button.dataset.staffId)
        return
      }

      if (action === 'open-management') {
        void openStaffAccountManagement(button.dataset.staffId)
      }
    })
  })

  document.querySelectorAll('[data-staff-department-field]').forEach((control) => {
    const eventName = control.tagName === 'SELECT' ? 'change' : 'input'
    control.addEventListener(eventName, () => {
      updateStaffDepartmentField(control.dataset.staffDepartmentField, control.value)
    })
  })

  document.querySelector('[data-staff-department-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    handleDepartmentFormSubmit(event.currentTarget)
  })

  document.querySelectorAll('[data-staff-department-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const action = button.dataset.staffDepartmentAction

      if (action === 'close') {
        closeStaffDepartmentPanel()
        return
      }

      if (action === 'open-create') {
        openCreateDepartmentForm()
        return
      }

      if (action === 'open-edit') {
        openEditDepartmentForm(button.dataset.departmentId)
        return
      }

      if (action === 'cancel-form') {
        staffDepartmentFormState = null
        render()
        return
      }

      if (action === 'archive') {
        handleArchiveDepartment(button.dataset.departmentId)
        return
      }

      if (action === 'restore') {
        handleRestoreDepartment(button.dataset.departmentId)
      }
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
        centerInfo: getCurrentCanonicalCenterContext(),
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
      centerInfo: getCurrentCanonicalCenterContext(),
    })
    const blob = new Blob([`\uFEFF${content}`], {
      type: 'text/plain;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = getReportDownloadFilename(
      reportState.filters.reportDate,
      getCurrentCanonicalCenterContext(),
    )
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

  document.querySelectorAll('[data-inventory-action="refresh-authoritative"]').forEach((button) => {
    button.addEventListener('click', () => {
      void refreshC56InventorySharedTruth({ reason: 'manual-refresh' })
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

  document.querySelector('[data-inventory-request-form]')?.addEventListener('submit', async (event) => {
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
    const result = await writeC56InventoryCommand(buildC56CreateRequestCommand(request), {
      reason: 'create-request',
    })
    if (!result.ok) return
    inventoryRequestFormState = null
    selectedInventoryRequestId = String(result.entity_id || '')
    const committedRequest = inventoryRequests.find((item) => item.id === selectedInventoryRequestId)
    inventoryRequestStatusFormState = committedRequest
      ? createInventoryRequestStatusFormState(committedRequest)
      : null
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

  document.querySelector('[data-inventory-request-status-form]')?.addEventListener('submit', async (event) => {
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

    const result = await writeC56InventoryCommand(
      buildC56UpdateRequestStatusCommand(request, inventoryRequestStatusFormState.values),
      { reason: 'update-request-status' },
    )
    if (!result.ok) return
    selectedInventoryRequestId = request.id
    const committedRequest = inventoryRequests.find((item) => item.id === request.id)
    inventoryRequestStatusFormState = committedRequest
      ? createInventoryRequestStatusFormState(committedRequest)
      : null
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

  document.querySelector('[data-inventory-form]')?.addEventListener('submit', async (event) => {
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
    const result = await writeC56InventoryCommand(buildC56SaveItemCommand(nextItem), {
      reason: inventoryFormState.mode === 'edit' ? 'update-item' : 'create-item',
    })
    if (!result.ok) return
    inventoryFormState = null
    render()
  })

  document.querySelector('[data-inventory-action="delete-item"]')?.addEventListener('click', async () => {
    if (!inventoryFormState?.itemId) {
      return
    }

    if (!window.confirm('Bạn muốn xóa vật tư này khỏi danh sách kho?')) {
      return
    }

    const item = inventoryItems.find((candidate) => candidate.id === inventoryFormState.itemId)
    if (!item) return
    const result = await writeC56InventoryCommand(buildC56ArchiveItemCommand(item), {
      reason: 'archive-item',
    })
    if (!result.ok) return
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

  document.querySelector('[data-inventory-movement-form]')?.addEventListener('submit', async (event) => {
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
    const result = await writeC56InventoryCommand(buildC56PostMovementCommand(movement, item), {
      reason: 'post-stock-movement',
    })
    if (!result.ok) return
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

  document.querySelectorAll(
    '[data-cashbook-action="refresh-authoritative"], [data-cashflow-action="refresh-authoritative"]',
  ).forEach((button) => {
    button.addEventListener('click', () => {
      void refreshC54FinanceSharedTruth({ reason: 'manual-refresh' })
    })
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

  document.querySelector('[data-cashbook-settings-form]')?.addEventListener('submit', async (event) => {
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

    const nextSettings = buildCashbookSettingsFromForm(
      cashbookSettingsFormState.values,
      cashbookSettings,
    )
    let result
    try {
      result = await writeC54FinanceCommand(buildC54SaveSettingsCommand(nextSettings), {
        reason: 'cashbook-settings-save',
      })
    } catch (error) {
      result = { ok: false, error: String(error?.message || error) }
    }
    if (!result.ok) {
      cashbookSettingsFormState = {
        ...cashbookSettingsFormState,
        errors: { ...cashbookSettingsFormState.errors, form: result.error },
      }
      render()
      return
    }
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

  document.querySelector('[data-cashbook-action="close-day"]')?.addEventListener('click', async () => {
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

    const result = await writeC54FinanceCommand(
      buildC54CloseReconciliationCommand(currentReconciliation),
      { reason: 'cashbook-reconciliation-close' },
    )
    if (!result.ok) return
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
    async (event) => {
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

      let result
      try {
        result = await writeC54FinanceCommand(
          buildC54UpsertReconciliationCommand(nextReconciliation),
          { reason: 'cashbook-reconciliation-save' },
        )
      } catch (error) {
        result = { ok: false, error: String(error?.message || error) }
      }
      if (!result.ok) {
        cashbookReconciliationFormState = {
          ...cashbookReconciliationFormState,
          errors: { ...cashbookReconciliationFormState.errors, form: result.error },
        }
        render()
        return
      }
      cashbookReconciliationFormState = null
      render()
    },
  )

  document.querySelector('[data-cashflow-action="open-create"]')?.addEventListener('click', () => {
    cashflowTransactionDetailState = null
    cashflowTransactionDetailHydrateToken += 1
    cashflowFormState = createEmptyCashflowFormStateWithCategories(
      cashflowCategories,
      getCurrentResolvedCenterId(),
    )
    render()
  })

  document.querySelector('[data-cashflow-action="open-categories"]')?.addEventListener('click', () => {
    cashflowTransactionDetailState = null
    cashflowTransactionDetailHydrateToken += 1
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
            '[data-cashflow-cloud-action], [data-cashflow-cloud-image-input], [data-cashflow-action="print-transaction"]',
          )
        ) {
          return
        }

        openCashflowTransactionFromRow(row.dataset.cashflowTransactionId)
      })

      row.addEventListener('keydown', (event) => {
        if (
          event.target.closest(
            '[data-cashflow-cloud-action], [data-cashflow-cloud-image-input], [data-cashflow-action="print-transaction"]',
          )
        ) {
          return
        }

        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }

        event.preventDefault()
        openCashflowTransactionFromRow(row.dataset.cashflowTransactionId)
      })
    })

  document.querySelectorAll('[data-cashflow-action="print-transaction"]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault()
      event.stopPropagation()
      await printCashflowTransaction(button.dataset.cashflowTransactionId)
    })
  })

  document.querySelectorAll('[data-cashflow-detail-action="close"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      cashflowTransactionDetailState = null
      cashflowTransactionDetailHydrateToken += 1
      render()
    })
  })

  document.querySelector('[data-cashflow-detail-action="view-attachments"]')?.addEventListener('click', async (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (!cashflowTransactionDetailState?.transaction?.id) {
      setCloudUploadMessage('Không tìm thấy giao dịch', 'error')
      render()
      return
    }

    await openTransactionImageManager(cashflowTransactionDetailState.transaction.id)
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
    const updateCashflowDraftField = () => {
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
    }

    control.addEventListener('input', updateCashflowDraftField)
    control.addEventListener('change', updateCashflowDraftField)
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
    button.addEventListener('click', async () => {
      const category = cashflowCategories.find(
        (item) => item.id === button.dataset.cashflowCategoryId,
      )

      if (!category || category.isArchived) {
        return
      }

      const result = await writeC54FinanceCommand(
        buildC54ArchiveCategoryCommand(category),
        { reason: 'finance-category-archive' },
      )
      if (!result.ok) return

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

  document.querySelector('[data-cashflow-category-form]')?.addEventListener('submit', async (event) => {
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
    const nextCategory = buildCashflowCategoryFromForm(
      cashflowCategoryFormState.values,
      existingCategory,
    )
    let result
    try {
      result = await writeC54FinanceCommand(buildC54SaveCategoryCommand(nextCategory), {
        reason: 'finance-category-save',
      })
    } catch (error) {
      result = { ok: false, error: String(error?.message || error) }
    }
    if (!result.ok) {
      cashflowCategoryFormState = {
        ...cashflowCategoryFormState,
        errors: { ...cashflowCategoryFormState.errors, form: result.error },
      }
      render()
      return
    }
    cashflowCategoryFormState = createEmptyCashflowCategoryFormState()
    render()
  })

  document.querySelectorAll('[data-cashflow-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      clearCashflowAttachmentDraft()
      render()
    })
  })

  bindCashflowEvidenceControls(document)

  document.querySelector('[data-cashflow-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (!cashflowFormState || cashflowFormState.isSaving) {
      return
    }

    const formValues = collectCashflowFormValues(event.currentTarget, cashflowFormState.values)
    const errors = validateCashflowForm(formValues)
    const attachmentDraft = cashflowFormState.attachmentDraft || createEmptyCashflowAttachmentDraft()
    const stagedFile = attachmentDraft.mode === 'staged-new' ? attachmentDraft.file : null

    if (attachmentDraft.mode === 'loading') {
      cashflowFormState = createCashflowFormErrorState(
        cashflowFormState,
        'Đang tải chứng từ. Vui lòng đợi tải xong trước khi lưu.',
        formValues,
      )
      render()
      return
    }

    if (attachmentDraft.mode === 'error') {
      cashflowFormState = createCashflowFormErrorState(
        cashflowFormState,
        'Không thể tải thông tin chứng từ. Vui lòng mở lại giao dịch rồi thử lưu.',
        formValues,
      )
      render()
      return
    }

    if (stagedFile) {
      const fileValidation = validateTransactionImageFile(stagedFile)
      if (!fileValidation.ok) {
        errors.attachment = fileValidation.error
      }
    }

    if (Object.keys(errors).length) {
      cashflowFormState = {
        ...cashflowFormState,
        values: formValues,
        errors,
      }
      render()
      return
    }

    const currentCenterId = getCurrentResolvedCenterId()
    const formCenterId = String(cashflowFormState.centerId || currentCenterId).trim()

    if (formCenterId !== currentCenterId) {
      cashflowFormState = createCashflowFormErrorState(
        cashflowFormState,
        'Cơ sở đã thay đổi. Vui lòng mở lại giao dịch ở đúng cơ sở trước khi lưu.',
        formValues,
      )
      render()
      return
    }

    if (
      stagedFile &&
      (
        cloudStatus.configStatus !== 'configured' ||
        cloudStatus.authStatus !== 'signed-in' ||
        cloudStatus.membershipStatus !== 'loaded' ||
        !isTransactionAttachmentRoleAllowed(cloudStatus.role)
      )
    ) {
      cashflowFormState = createCashflowFormErrorState(
        cashflowFormState,
        'Không thể tải ảnh lên. Vui lòng kiểm tra đăng nhập/quyền cloud trước khi lưu chứng từ.',
        formValues,
      )
      render()
      return
    }

    cashflowFormState = {
      ...cashflowFormState,
      isSaving: true,
      values: formValues,
      attachmentDraft: {
        ...attachmentDraft,
        error: '',
        isUploading: Boolean(stagedFile),
      },
      errors: {},
    }

    const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(currentCenterId)
    const existingTransaction = cashflowFormState.mode === 'edit'
      ? latestCashflowTransactions.find(
          (transaction) => transaction.id === cashflowFormState.transactionId,
        )
      : null

    if (cashflowFormState.mode === 'edit' && !existingTransaction) {
      cashflowTransactions = latestCashflowTransactions
      cashflowFormState = createCashflowFormErrorState(
        cashflowFormState,
        'Giao dịch này không còn tồn tại. Danh sách đã được tải lại, vui lòng kiểm tra trước khi lưu.',
        formValues,
      )
      render()
      return
    }

    if (cashflowFormState.mode === 'edit' && isSyncedTuitionPaymentTransaction(existingTransaction)) {
      cashflowTransactions = latestCashflowTransactions
      cashflowFormState = createCashflowFormErrorState(
        cashflowFormState,
        'Giao dịch này được đồng bộ từ Học phí và không thể sửa như giao dịch thủ công.',
        formValues,
      )
      render()
      return
    }

    if (
      cashflowFormState.mode === 'edit' &&
      String(existingTransaction.updatedAt || '') !== String(cashflowFormState.openedUpdatedAt || '')
    ) {
      cashflowTransactions = latestCashflowTransactions
      cashflowFormState = createCashflowFormErrorState(
        cashflowFormState,
        'Giao dịch đã thay đổi từ lúc mở form. Vui lòng mở lại bản mới nhất trước khi lưu chứng từ.',
        formValues,
      )
      render()
      return
    }

    const nextTransaction = buildCashflowTransactionFromForm(
      {
        ...formValues,
        attachment:
          attachmentDraft.mode === 'remove-existing'
            ? null
            : isKeepExistingCashflowAttachmentDraft(attachmentDraft)
              ? attachmentDraft.existingAttachment
              : formValues.attachment,
      },
      existingTransaction,
    )
    const projectedTransactions =
      cashflowFormState.mode === 'edit'
        ? latestCashflowTransactions
        : [nextTransaction, ...latestCashflowTransactions]
    const transactionCode = getCashflowTransactionCodesForTransactions(projectedTransactions)[nextTransaction.id]
    let uploadedAttachment = null

    if (stagedFile) {
      const uploadResult = await uploadStagedCashflowEvidence({
        transaction: nextTransaction,
        transactionCode,
        file: stagedFile,
        centerId: currentCenterId,
      })

      if (!uploadResult.ok) {
        cashflowFormState = createCashflowFormErrorState(
          {
            ...cashflowFormState,
            attachmentDraft: {
              ...attachmentDraft,
              isUploading: false,
              error: uploadResult.error,
            },
          },
          uploadResult.error || 'Không thể tải ảnh lên.',
          formValues,
        )
        render()
        return
      }

      uploadedAttachment = uploadResult.attachment
      nextTransaction.attachment = uploadedAttachment
    }

    if (attachmentDraft.mode === 'remove-existing') {
      delete nextTransaction.attachment
    }

    const selectedCategory = cashflowCategories.find(
      (category) => category.name === nextTransaction.category && !category.isArchived,
    )
    if (!selectedCategory) {
      if (uploadedAttachment) await cleanupCloudCashflowAttachment(uploadedAttachment, currentCenterId)
      cashflowFormState = createCashflowFormErrorState(
        cashflowFormState,
        'Danh mục authoritative không còn khả dụng. Hãy Làm mới và chọn lại.',
        formValues,
      )
      render()
      return
    }

    const attachmentAction = uploadedAttachment
      ? 'BIND'
      : attachmentDraft.mode === 'remove-existing'
        ? 'UNBIND'
        : 'KEEP'
    let authoritativeResult
    try {
      authoritativeResult = await writeC54FinanceCommand(
        buildC54SaveTransactionCommand(nextTransaction, {
          category: selectedCategory,
          attachmentAction,
          attachmentId: uploadedAttachment?.metadataId || uploadedAttachment?.id || '',
        }),
        {
          reason: 'finance-transaction-save',
          attachmentIntent: getC54AttachmentRetryIntent(stagedFile),
        },
      )
    } catch (error) {
      authoritativeResult = { ok: false, error: String(error?.message || error) }
    }
    const uploadedAttachmentId = String(
      uploadedAttachment?.metadataId || uploadedAttachment?.id || '',
    )
    const supersededRetryUpload = Boolean(
      uploadedAttachmentId
      && authoritativeResult.effectiveAttachmentId
      && uploadedAttachmentId !== authoritativeResult.effectiveAttachmentId,
    )
    if (supersededRetryUpload) {
      await cleanupCloudCashflowAttachment(uploadedAttachment, currentCenterId)
    }
    if (!authoritativeResult.ok) {
      if (uploadedAttachment && !authoritativeResult.committed && !supersededRetryUpload) {
        await cleanupCloudCashflowAttachment(uploadedAttachment, currentCenterId)
      }
      cashflowFormState = createCashflowFormErrorState(
        cashflowFormState,
        authoritativeResult.error || 'Giao dịch chưa được commit server.',
        formValues,
      )
      render()
      return
    }

    if (uploadedAttachment) {
      setCloudUploadMessage('Đã commit giao dịch và bind chứng từ authoritative.', 'success')
      await loadCurrentMonthCloudAttachments()
    } else if (attachmentDraft.mode === 'remove-existing') {
      setCloudUploadMessage(
        'Đã gỡ binding khỏi giao dịch; file private được giữ lại phục vụ audit/migration.',
        'success',
      )
    }
    clearCashflowAttachmentDraft()
    render()
    return
  })

  document.querySelector('[data-cashflow-action="delete-transaction"]')?.addEventListener(
    'click',
    async () => {
      if (!cashflowFormState?.transactionId) {
        return
      }

      const confirmed = window.confirm('Bạn có chắc muốn xóa giao dịch này không?')

      if (!confirmed) {
        return
      }

      const transaction = cashflowTransactions.find(
        (item) => item.id === cashflowFormState.transactionId,
      )

      if (isSyncedTuitionPaymentTransaction(transaction)) {
        cashflowFormState = createCashflowFormErrorState(
          cashflowFormState,
          'Giao dịch này được đồng bộ từ Học phí và không thể xóa cứng trong F23.8C.',
          cashflowFormState.values,
        )
        render()
        return
      }

      const result = await writeC54FinanceCommand(
        buildC54VoidTransactionCommand(transaction),
        { reason: 'finance-transaction-void' },
      )
      if (!result.ok) {
        cashflowFormState = createCashflowFormErrorState(
          cashflowFormState,
          result.error || 'Không thể void giao dịch.',
          cashflowFormState.values,
        )
        render()
        return
      }
      clearCashflowAttachmentDraft()
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
      tuitionPeriodActionConfirmationState = null
      clearTuitionPaymentFormState()
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
        event.target.closest('[data-tuition-action="open-rollback-preview"]') ||
        event.target.closest('[data-tuition-action="open-care-notes"]')
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
        event.target.closest('[data-tuition-action="open-rollback-preview"]') ||
        event.target.closest('[data-tuition-action="open-care-notes"]')
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

      tuitionPeriodActionConfirmationState = null
      openTuitionPaymentForm(student, tuitionRecord)
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

      openTuitionPaymentForm(student, tuitionRecord)
    })
  })

  document.querySelectorAll('[data-tuition-action="open-detail"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      tuitionDetailState = {
        studentId: button.dataset.tuitionStudentId,
      }
      tuitionFormState = null
      tuitionPeriodActionConfirmationState = null
      clearTuitionPaymentFormState()
      tuitionRollbackPreviewState = null
      tuitionCareNoteState = null
      tuitionAdvisoryWindowState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-payment-open-transaction]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openTuitionPaymentSourceTransaction(button.dataset.tuitionPaymentOpenTransaction)
    })
  })

  document.querySelectorAll('[data-tuition-payment-void]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault()
      event.stopPropagation()

      if (!areModuleActionUpstreamsCurrent('hoc-phi', 'payment')) {
        window.alert('Dữ liệu Học phí hoặc Thu chi chưa tải xong. Vui lòng bấm Làm mới rồi thử lại.')
        return
      }
      const transactionId = String(button.dataset.tuitionPaymentVoid || '').trim()
      const transaction = cashflowTransactions.find((item) => item.id === transactionId)
      if (!transaction) {
        window.alert('Không tìm thấy khoản thu trong dữ liệu vừa tải. Vui lòng bấm Làm mới.')
        return
      }
      if (!window.confirm(
        'Khoản thu sẽ được đánh dấu đã hủy và vẫn được giữ trong lịch sử. Bạn có muốn tiếp tục?',
      )) return

      const retryScope = `${getCurrentResolvedCenterId()}|${transactionId}`
      const previousReason = c54TuitionPaymentVoidRetryCommands.get(retryScope)?.command?.reason || ''
      const reason = window.prompt('Nhập lý do hủy khoản thu (ít nhất 3 ký tự):', previousReason)
      if (reason === null) return

      const result = await writeC54TuitionPaymentVoid(transaction, reason)
      if (!result.ok) {
        window.alert(result.error || 'Không thể hủy khoản thu lúc này.')
        return
      }
      window.alert('Khoản thu đã được hủy. Lịch sử giao dịch vẫn được giữ lại.')
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

  document.querySelectorAll('[data-tuition-action="open-care-notes"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      withTuitionViewportLock(() => {
        const studentId = button.dataset.tuitionStudentId

        if (!students.some((student) => String(student.id) === String(studentId))) {
          return
        }

        tuitionCareNoteState = createTuitionCareNoteState(studentId)
        tuitionFormState = null
        clearTuitionPaymentFormState()
        tuitionDetailState = null
        tuitionRollbackPreviewState = null
        tuitionAdvisoryWindowState = null
        render()
      }, event)
    })
  })

  document.querySelectorAll('[data-tuition-action="open-advisory-window"]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      await withTuitionViewportLock(async () => {
        const refresh = await refreshModuleAuthoritativeUpstreams('hoc-phi', {
          reason: 'attendance-advisory-surface-open',
        })
        if (!refresh.ok) return
        tuitionAdvisoryWindowState = { isOpen: true }
        tuitionFormState = null
        clearTuitionPaymentFormState()
        tuitionDetailState = null
        tuitionRollbackPreviewState = null
        tuitionCareNoteState = null
        render()
      }, event)
    })
  })

  document.querySelectorAll('[data-tuition-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionFormState = null
      tuitionPeriodActionConfirmationState = null
      tuitionRollbackPreviewState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-payment-action="cancel-payment"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionPeriodActionConfirmationState = null
      clearTuitionPaymentFormState()
      tuitionRollbackPreviewState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-detail-action="close-detail"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionDetailState = null
      tuitionPeriodActionConfirmationState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-rollback-preview-action="close"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionRollbackPreviewState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-care-note-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!tuitionCareNoteState) {
        return
      }

      tuitionCareNoteState = {
        ...tuitionCareNoteState,
        values: {
          ...tuitionCareNoteState.values,
          [control.dataset.tuitionCareNoteField]: control.value,
        },
        error: '',
        saveState: '',
      }
    })
  })

  document.querySelectorAll('[data-tuition-care-note-suggestion]').forEach((button) => {
    button.addEventListener('click', (event) => {
      withTuitionViewportLock(() => {
      if (!tuitionCareNoteState) {
        return
      }

      const suggestion = button.dataset.tuitionCareNoteSuggestion || ''
      const currentContent = String(tuitionCareNoteState.values.content || '').trim()

      tuitionCareNoteState = {
        ...tuitionCareNoteState,
        values: {
          ...tuitionCareNoteState.values,
          tag: tuitionCareNoteState.values.tag || 'Học phí',
          content: currentContent ? `${currentContent}\n${suggestion}` : suggestion,
        },
        error: '',
        saveState: '',
      }
      render()
      }, event)
    })
  })

  document.querySelectorAll('[data-tuition-care-note-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      withTuitionViewportLock(() => {
      const action = button.dataset.tuitionCareNoteAction

      if (action === 'close') {
        tuitionCareNoteState = null
        render()
        return
      }

      if (action === 'clear') {
        tuitionCareNoteState = tuitionCareNoteState
          ? createTuitionCareNoteState(tuitionCareNoteState.studentId)
          : null
        render()
        return
      }

      if (action === 'save') {
        saveTuitionCareNote()
      }
      }, event)
    })
  })

  document.querySelectorAll('[data-tuition-advisory-window-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      withTuitionViewportLock(() => {
        tuitionAdvisoryWindowState = null
        render()
      }, event)
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
        commandIdempotencyKey: null,
        pendingAuthoritativeRecord: null,
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
    tuitionPeriodActionConfirmationState = null
    clearTuitionPaymentFormState()
    tuitionDetailState = null
    render()
  })

  document.querySelectorAll('[data-tuition-action="open-undo-empty-period"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()

      if (!areModuleActionUpstreamsCurrent('hoc-phi', 'collected-balance')) {
        window.alert('Chưa tải được số đã thu hiện tại. Vui lòng bấm Làm mới rồi thử lại.')
        return
      }

      if (!isModuleUpstreamCurrent('hoc-phi', 'attendance')) {
        window.alert('Chưa tải được dữ liệu điểm danh để kiểm tra kỳ học. Vui lòng bấm Làm mới rồi thử lại.')
        return
      }

      const tuitionRecord = getLatestTuitionRecordForCurrentCenter(button.dataset.tuitionId)
      const student = tuitionRecord
        ? students.find((item) => item.id === tuitionRecord.studentId)
        : null
      const centerId = getCurrentResolvedCenterId()
      const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(centerId)
      const eligibility = getTuitionEmptyPeriodUndoEligibility({
        tuitionRecord,
        expectedPeriodId: tuitionRecord ? getCurrentTuitionPeriodId(tuitionRecord) : '',
        cashflowLedger: latestCashflowTransactions,
        attendanceRecords: getCurrentUnifiedAttendanceRecordsForTuitionGuard(centerId),
        centerId,
        fromCurrentCenterCollection: true,
      })

      cashflowTransactions = latestCashflowTransactions
      tuitionPeriodActionConfirmationState = tuitionRecord && student
        ? createTuitionPeriodConfirmationState('undo-empty-period', tuitionRecord, student, {
            reasons: eligibility.reasons,
          })
        : {
            action: 'undo-empty-period',
            tuitionId: button.dataset.tuitionId || '',
            studentName: '',
            periodLabel: 'Kỳ hiện tại',
            centerId,
            periodId: '',
            reasons: eligibility.reasons,
            isSaving: false,
          }
      render()
    })
  })

  const handleTuitionFormSave = async (event, options = {}) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()

    if (!tuitionFormState || tuitionFormState.isSaving) {
      return
    }

    if (
      tuitionFormState.mode === 'renew' &&
      !areModuleActionUpstreamsCurrent('hoc-phi', 'collected-balance')
    ) {
      tuitionFormState = {
        ...tuitionFormState,
        errors: {
          ...tuitionFormState.errors,
          form: 'Chưa tải được số đã thu hiện tại. Thông tin bạn nhập vẫn được giữ nguyên.',
        },
      }
      render()
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

    if (options.confirmedRenew) {
      tuitionRecords = getStoredTuition([])
      cashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(getCurrentResolvedCenterId())
    }

    const currentRecord = tuitionRecords.find((record) => record.id === tuitionFormState.tuitionId)
    const student = currentRecord
      ? students.find((item) => item.id === currentRecord.studentId)
      : students.find((item) => item.id === tuitionFormState.studentId)

    if (
      options.confirmedRenew &&
      tuitionPeriodActionConfirmationState?.periodId &&
      currentRecord &&
      getCurrentTuitionPeriodId(currentRecord) !== tuitionPeriodActionConfirmationState.periodId
    ) {
      tuitionPeriodActionConfirmationState = {
        ...tuitionPeriodActionConfirmationState,
        isSaving: false,
        reasons: ['Dữ liệu kỳ học đã thay đổi, vui lòng mở lại hồ sơ.'],
      }
      render()
      return
    }

    if (tuitionFormState.mode === 'renew' && !options.confirmedRenew) {
      if (!currentRecord || !student) {
        return
      }

      tuitionPeriodActionConfirmationState = createTuitionPeriodConfirmationState(
        'renew-create',
        currentRecord,
        student,
      )
      render()
      return
    }

    const commandIdempotencyKey = tuitionFormState.commandIdempotencyKey
      || createOperationalCommandIdempotencyKey()
    const normalizedValues = normalizeTuitionFormValues(tuitionFormState.values)
    const savedAt = new Date().toISOString()
    const nextRecord = tuitionFormState.pendingAuthoritativeRecord
      || (tuitionFormState.mode === 'renew' && currentRecord
      ? {
          ...createRenewedTuitionRecord(
            currentRecord,
            normalizedValues,
            readLatestCashflowTransactionsForCurrentCenter(getCurrentResolvedCenterId()),
            getCurrentResolvedCenterId(),
          ),
          updatedAt: savedAt,
        }
      : {
          id: tuitionFormState.tuitionId || `tuition-${tuitionFormState.studentId}-${commandIdempotencyKey}`,
          studentId: tuitionFormState.studentId,
          ...normalizedValues,
          paidAmount: currentRecord?.paidAmount ?? 0,
          payments: currentRecord?.payments ?? [],
          currentTermNumber: currentRecord?.currentTermNumber ?? 1,
          currentTermId:
            currentRecord?.currentTermId ??
            `term-${tuitionFormState.tuitionId || tuitionFormState.studentId}-${commandIdempotencyKey}`,
          startedAt: currentRecord?.startedAt ?? savedAt,
          termHistory: currentRecord?.termHistory ?? [],
          createdAt: currentRecord?.createdAt ?? savedAt,
          updatedAt: savedAt,
        })

    tuitionFormState = {
      ...tuitionFormState,
      isSaving: true,
      commandIdempotencyKey,
      pendingAuthoritativeRecord: nextRecord,
      errors: {},
    }
    render()
    const result = await writeC52TuitionRecordPackageThroughCloud(nextRecord, 'tuition-package-save', {
      beforePayload: currentRecord ? { ...currentRecord } : null,
    }, commandIdempotencyKey)
    if (!result.ok) {
      tuitionFormState = {
        ...tuitionFormState,
        isSaving: false,
        errors: {
          ...tuitionFormState?.errors,
          form: result.error || 'Chưa lưu được học phí. Thông tin bạn nhập vẫn được giữ nguyên.',
        },
      }
      if (tuitionPeriodActionConfirmationState) {
        tuitionPeriodActionConfirmationState = {
          ...tuitionPeriodActionConfirmationState,
          isSaving: false,
          reasons: [result.error || 'Chưa lưu được học phí. Thông tin bạn nhập vẫn được giữ nguyên.'],
        }
      }
      render()
      return
    }
    tuitionFormState = null
    tuitionPeriodActionConfirmationState = null
    render()
  }

  document.querySelectorAll('[data-tuition-form-field]').forEach((control) => {
    const handleTuitionFormFieldInput = () => {
      if (!tuitionFormState) {
        return
      }

      const fieldName = control.dataset.tuitionFormField

      tuitionFormState = {
        ...tuitionFormState,
        commandIdempotencyKey: null,
        pendingAuthoritativeRecord: null,
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

      if (fieldName === 'discountPreset') {
        markNativeSelectChangeRender()
        render()
        return
      }

      if (['discountCustomValue', 'totalAmount', 'paidAmount'].includes(fieldName)) {
        refreshTuitionFormPreview()
      }
    }

    if (control.matches('select')) {
      control.addEventListener('change', handleTuitionFormFieldInput)
    } else {
      control.addEventListener('input', handleTuitionFormFieldInput)
    }
  })

  document.querySelector('[data-tuition-form]')?.addEventListener('submit', handleTuitionFormSave)
  document.querySelector('[data-tuition-action="save-form"]')?.addEventListener('click', handleTuitionFormSave)

  document.querySelectorAll('[data-tuition-period-confirm-action]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault()
      event.stopPropagation()

      if (!tuitionPeriodActionConfirmationState) {
        return
      }

      const action = button.dataset.tuitionPeriodConfirmAction
      if (action === 'cancel') {
        tuitionPeriodActionConfirmationState = null
        render()
        return
      }

      if (action !== 'confirm' || tuitionPeriodActionConfirmationState.isSaving) {
        return
      }

      if (tuitionPeriodActionConfirmationState.reasons?.length) {
        render()
        return
      }

      tuitionPeriodActionConfirmationState = {
        ...tuitionPeriodActionConfirmationState,
        isSaving: true,
      }
      render()

      if (tuitionPeriodActionConfirmationState?.action === 'renew-create') {
        await handleTuitionFormSave(null, { confirmedRenew: true })
        return
      }

      if (tuitionPeriodActionConfirmationState?.action === 'undo-empty-period') {
        await undoEmptyTuitionPeriodFromConfirmation()
      }
    })
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

  bindTuitionPaymentEvidenceControls(document)

  document.querySelector('[data-tuition-payment-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (!tuitionPaymentFormState || tuitionPaymentFormState.isSaving) {
      return
    }

    if (!areModuleActionUpstreamsCurrent('hoc-phi', 'payment')) {
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        errors: {
          ...tuitionPaymentFormState.errors,
          form: 'Chưa tải được số đã thu và dữ liệu thanh toán. Thông tin bạn nhập vẫn được giữ nguyên; vui lòng bấm Làm mới rồi thử lại.',
        },
      }
      render()
      return
    }

    const errors = validatePaymentForm(tuitionPaymentFormState.values)
    const attachmentDraft = tuitionPaymentFormState.attachmentDraft || {}
    const stagedFile = attachmentDraft.mode === 'staged-new' ? attachmentDraft.file : null

    if (stagedFile) {
      const fileValidation = validateTransactionImageFile(stagedFile)
      if (!fileValidation.ok) {
        errors.attachment = fileValidation.error
      }
    }

    if (Object.keys(errors).length) {
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        errors,
      }
      render()
      return
    }

    const normalizedPayment = normalizePaymentFormValues(tuitionPaymentFormState.values)
    const currentCenterId = getCurrentResolvedCenterId()

    if (String(tuitionPaymentFormState.centerId || currentCenterId) !== currentCenterId) {
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        errors: {
          ...tuitionPaymentFormState.errors,
          form: 'Cơ sở đã thay đổi. Vui lòng mở lại form thanh toán.',
        },
      }
      render()
      return
    }

    const latestTuitionRecords = getStoredTuition([])
    const latestTuitionRecord = latestTuitionRecords.find(
      (record) => record.id === tuitionPaymentFormState.tuitionId,
    )
    const student = students.find((item) => item.id === tuitionPaymentFormState.studentId)

    if (!latestTuitionRecord || !student) {
      tuitionRecords = latestTuitionRecords
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        errors: {
          ...tuitionPaymentFormState.errors,
          form: 'Không tìm thấy hồ sơ học phí hiện tại.',
        },
      }
      render()
      return
    }

    const periodId = getCurrentTuitionPeriodId(latestTuitionRecord)

    if (periodId !== tuitionPaymentFormState.periodId) {
      tuitionRecords = latestTuitionRecords
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        errors: {
          ...tuitionPaymentFormState.errors,
          form: 'Kỳ học phí đã thay đổi. Vui lòng mở lại form thanh toán.',
        },
      }
      render()
      return
    }

    const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(currentCenterId)
    const outstandingAmount = getTuitionDebtAmount(latestTuitionRecord, latestCashflowTransactions)

    if (hasUnreconciledLegacyTuitionPaidAmount(latestTuitionRecord, latestCashflowTransactions)) {
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        errors: {
          ...tuitionPaymentFormState.errors,
          form: 'Kỳ này có số tiền đã thanh toán cũ chưa được đối soát với Thu chi.',
        },
      }
      render()
      return
    }

    if (normalizedPayment.amount > outstandingAmount) {
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        errors: {
          ...tuitionPaymentFormState.errors,
          amount: 'Số tiền thanh toán không được vượt quá số còn nợ.',
        },
      }
      render()
      return
    }

    if (outstandingAmount <= 0) {
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        errors: {
          ...tuitionPaymentFormState.errors,
          amount: 'Kỳ này đã thanh toán đủ.',
        },
      }
      render()
      return
    }

    const sourcePaymentId = tuitionPaymentFormState.sourcePaymentId
    const existingPaymentTransaction = latestCashflowTransactions.find(
      (transaction) =>
        transaction.sourceModule === 'hoc-phi' &&
        transaction.sourceType === 'tuition-payment' &&
        transaction.sourcePaymentId === sourcePaymentId,
    )

    if (
      stagedFile &&
      (
        cloudStatus.configStatus !== 'configured' ||
        cloudStatus.authStatus !== 'signed-in' ||
        cloudStatus.membershipStatus !== 'loaded' ||
        !isTransactionAttachmentRoleAllowed(cloudStatus.role)
      )
    ) {
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        errors: {
          ...tuitionPaymentFormState.errors,
          attachment: 'Chưa thể tải ảnh chứng từ. Vui lòng kiểm tra đăng nhập và quyền thao tác.',
        },
      }
      render()
      return
    }

    const savedAt = new Date().toISOString()
    const nextTransaction = {
      id: `cashflow-from-tuition-${sourcePaymentId}`,
      type: 'income',
      category: 'Học phí',
      amount: normalizedPayment.amount,
      transactionDate: normalizedPayment.paidAt,
      method: getCashflowMethodFromTuitionPayment(normalizedPayment.method),
      personName: normalizedPayment.payerName,
      recordedBy: normalizedPayment.collectorName,
      note: buildTuitionPaymentTransactionNote(normalizedPayment.note, student, latestTuitionRecord),
      sourceModule: 'hoc-phi',
      sourceType: 'tuition-payment',
      sourcePaymentId,
      sourceTuitionId: createTuitionRecordPackageLocalId(latestTuitionRecord),
      sourceStudentId: student.id,
      sourceParentId: student.parentId || '',
      sourceTermId: periodId,
      sourcePeriodId: periodId,
      createdAt: savedAt,
      updatedAt: savedAt,
    }
    if (existingPaymentTransaction) {
      const replayMatches = [
        ['type', nextTransaction.type],
        ['category', nextTransaction.category],
        ['amount', nextTransaction.amount],
        ['transactionDate', nextTransaction.transactionDate],
        ['method', nextTransaction.method],
        ['personName', nextTransaction.personName],
        ['recordedBy', nextTransaction.recordedBy],
        ['note', nextTransaction.note],
        ['sourceTuitionId', nextTransaction.sourceTuitionId],
        ['sourceStudentId', nextTransaction.sourceStudentId],
        ['sourceParentId', nextTransaction.sourceParentId],
        ['sourcePeriodId', nextTransaction.sourcePeriodId],
      ].every(([key, value]) => String(existingPaymentTransaction[key] ?? '') === String(value ?? ''))
      if (!replayMatches) {
        tuitionPaymentFormState = {
          ...tuitionPaymentFormState,
          errors: {
            ...tuitionPaymentFormState.errors,
            form: 'Payment/source này đã commit với nội dung khác; hãy mở lại form thanh toán.',
          },
        }
        render()
        return
      }
      cashflowTransactions = latestCashflowTransactions
      tuitionRecords = latestTuitionRecords
      clearTuitionPaymentFormState()
      render()
      return
    }
    const projectedTransactions = [nextTransaction, ...latestCashflowTransactions]
    const transactionCode = getCashflowTransactionCodesForTransactions(projectedTransactions)[nextTransaction.id]
    let uploadedAttachment = null

    tuitionPaymentFormState = {
      ...tuitionPaymentFormState,
      isSaving: true,
      attachmentDraft: {
        ...attachmentDraft,
        error: '',
        isUploading: Boolean(stagedFile),
      },
      errors: {},
    }
    render()

    if (stagedFile) {
      const uploadResult = await uploadStagedCashflowEvidence({
        transaction: nextTransaction,
        transactionCode,
        file: stagedFile,
        centerId: currentCenterId,
      })

      if (!uploadResult.ok) {
        tuitionPaymentFormState = {
          ...tuitionPaymentFormState,
          isSaving: false,
          attachmentDraft: {
            ...attachmentDraft,
            isUploading: false,
            error: uploadResult.error,
          },
          errors: {
            ...tuitionPaymentFormState.errors,
            attachment: uploadResult.error,
          },
        }
        render()
        return
      }

      uploadedAttachment = uploadResult.attachment
      nextTransaction.attachment = uploadedAttachment
    }

    const tuitionCategory = cashflowCategories.find(
      (category) => category.name === nextTransaction.category
        && !category.isArchived
        && ['income', 'both'].includes(category.type),
    )
    if (!tuitionCategory) {
      if (uploadedAttachment) await cleanupCloudCashflowAttachment(uploadedAttachment, currentCenterId)
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        isSaving: false,
        errors: {
          ...tuitionPaymentFormState.errors,
          form: 'Chưa tải được danh mục thu học phí. Vui lòng bấm Làm mới rồi thử lại.',
        },
      }
      render()
      return
    }

    let financeResult
    try {
      financeResult = await writeC54FinanceCommand(
        buildC54SaveTransactionCommand(nextTransaction, {
          category: tuitionCategory,
          attachmentAction: uploadedAttachment ? 'BIND' : 'KEEP',
          attachmentId: uploadedAttachment?.metadataId || uploadedAttachment?.id || '',
        }),
        {
          reason: 'tuition-payment-finance-commit',
          attachmentIntent: getC54AttachmentRetryIntent(stagedFile),
        },
      )
    } catch (error) {
      financeResult = { ok: false, error: String(error?.message || error) }
    }
    const uploadedAttachmentId = String(
      uploadedAttachment?.metadataId || uploadedAttachment?.id || '',
    )
    const supersededRetryUpload = Boolean(
      uploadedAttachmentId
      && financeResult.effectiveAttachmentId
      && uploadedAttachmentId !== financeResult.effectiveAttachmentId,
    )
    if (supersededRetryUpload) {
      await cleanupCloudCashflowAttachment(uploadedAttachment, currentCenterId)
    }
    if (!financeResult.ok) {
      if (uploadedAttachment && !financeResult.committed && !supersededRetryUpload) {
        await cleanupCloudCashflowAttachment(uploadedAttachment, currentCenterId)
      }
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        isSaving: false,
        errors: {
          ...tuitionPaymentFormState.errors,
          form: financeResult.error || 'Chưa ghi nhận được khoản thanh toán. Thông tin bạn nhập vẫn được giữ nguyên.',
        },
      }
      render()
      return
    }

    tuitionRecords = latestTuitionRecords
    if (uploadedAttachment) await loadCurrentMonthCloudAttachments()
    notifications = syncTuitionNotifications(notifications)
    clearTuitionPaymentFormState()
    render()
    return
  })

  document.querySelectorAll('[data-student-filter]').forEach((control) => {
    const updateStudentFilter = () => {
      const filterName = control.dataset.studentFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      studentFilters = {
        ...studentFilters,
        [filterName]: control.value,
      }
      if (control.matches('select')) {
        markNativeSelectChangeRender()
      }
      render()

      const nextControl = document.querySelector(`[data-student-filter="${filterName}"]`)
      focusElementWithoutScrolling(nextControl)

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    }

    control.addEventListener(control.matches('select') ? 'change' : 'input', updateStudentFilter)
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
      if (control.matches('select')) {
        markNativeSelectChangeRender()
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
    const eventNames = control.type === 'month'
      ? ['input', 'change']
      : [control.matches('select') ? 'change' : 'input']

    const applyAttendanceBoardFilter = () => {
      const filterName = control.dataset.attendanceBoardFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      if (attendanceBoardFilters[filterName] === control.value && !attendanceBoardDetailState) {
        return
      }

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
    }

    eventNames.forEach((eventName) => {
      control.addEventListener(eventName, applyAttendanceBoardFilter)
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
    button.addEventListener('click', async () => {
      const studentId = button.dataset.studentId || ''
      const month = attendanceBoardFilters.month
      const refresh = await refreshC57CalendarNotesSharedTruth({
        reason: 'attendance-board-note-surface-open',
        silent: true,
      })
      if (!refresh.ok) return
      const existingNote = attendanceBoardNotes.find(
        (note) => note.studentId === studentId && note.month === month,
      )
      attendanceBoardNoteFormState = {
        studentId,
        month,
        note: existingNote?.note || '',
        noteId: existingNote?.id || '',
        baseVersion: Number(existingNote?.cloudVersion) || 0,
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

  document.querySelector('[data-attendance-note-save]')?.addEventListener('click', async () => {
    if (!attendanceBoardNoteFormState) {
      return
    }

    const noteIdentity = `${attendanceBoardNoteFormState.studentId}:${attendanceBoardNoteFormState.month}`
    const existingNote = attendanceBoardNotes.find(
      (note) => `${note.studentId}:${note.month}` === noteIdentity,
    )
    const nextNote = {
      ...existingNote,
      id: attendanceBoardNoteFormState.noteId || '',
      cloudVersion: Number(attendanceBoardNoteFormState.baseVersion) || 0,
      studentId: attendanceBoardNoteFormState.studentId,
      month: attendanceBoardNoteFormState.month,
      note: String(attendanceBoardNoteFormState.note || '').trim(),
    }
    const result = await writeC57CalendarNotesCommand(buildC57UpsertBoardNoteCommand(nextNote), {
      reason: 'attendance-board-note-save',
    })
    if (result.ok) {
      attendanceBoardNoteFormState = null
      render()
    }
  })

  document.querySelector('[data-attendance-baseline-details]')?.addEventListener('toggle', (event) => {
    isAttendanceBaselineDetailsOpen = Boolean(event.currentTarget.open)
  })

  document.querySelector('[data-attendance-baseline-action="start"]')?.addEventListener('click', async () => {
    const nextState = startAttendanceBaselineDraft(loadAttendanceBaselineState(getCurrentResolvedCenterId()), {
      byRole: 'admin',
      byName: 'Admin cơ sở',
      note: 'Bắt đầu nhập dữ liệu nền điểm danh.',
    })
    const result = await writeC52AttendanceSessionReportThroughCloud({
      baselineState: nextState,
      reason: 'baseline-start',
    })
    if (!result.ok) return
    attendanceBaselineUndoSnapshot = null
    render()
  })

  document.querySelectorAll('[data-attendance-baseline-cell-input]').forEach((input) => {
    input.addEventListener('pointerdown', (event) => {
      const activeInput = document.activeElement

      if (
        activeInput &&
        activeInput !== input &&
        activeInput.matches?.('[data-attendance-baseline-cell-input]')
      ) {
        const committed = commitAttendanceBaselineCellInput(activeInput, {
          focusTarget: getBaselineInputFocusTarget(input),
          shouldRender: false,
        })

        if (committed) {
          activeInput.dataset.attendanceBaselineCommittedValue = activeInput.value
        }
      }
    })

    input.addEventListener('change', () => {
      if (input.dataset.attendanceBaselineCommittedValue === input.value) {
        delete input.dataset.attendanceBaselineCommittedValue
        return
      }

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
      const committed = commitAttendanceBaselineCellInput(input, {
        focusTarget,
        shouldRender: false,
      })

      if (committed) {
        input.dataset.attendanceBaselineCommittedValue = input.value
        focusAttendanceBaselineCellTarget(focusTarget)
      }
    })
  })

  document.querySelector('[data-attendance-baseline-action="save"]')?.addEventListener('click', async () => {
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
    const previousAttendanceRecords = loadStoredAttendanceRecords(getCurrentResolvedCenterId())
    const result = await writeC52AttendanceSessionReportThroughCloud({
      attendanceRecords: draftRecords.filter((record) => record.source === 'initialBaseline'),
      baselineState: nextState,
      previousAttendanceRecords,
      replaceBaselineRecords: true,
      reason: 'baseline-save',
    })
    if (!result.ok) return
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

  document.querySelector('[data-attendance-baseline-action="clear"]')?.addEventListener('click', async () => {
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

    const nextUndoSnapshot = {
      type: 'clear',
      records: storedRecords,
      state: storedState,
      draftRecords: attendanceBaselineDraftRecords,
      draftBaseRecords: attendanceBaselineDraftBaseRecords,
      draftState: attendanceBaselineDraftState,
    }
    const result = await writeC52AttendanceSessionReportThroughCloud({
      attendanceRecords: clearResult.records.filter((record) => record.source === 'initialBaseline'),
      baselineState: clearResult.state,
      previousAttendanceRecords: storedRecords,
      replaceBaselineRecords: true,
      reason: 'baseline-clear',
    })
    if (!result.ok) return
    attendanceBaselineUndoSnapshot = nextUndoSnapshot
    clearAttendanceBaselineDraft()
    attendanceBoardDetailState = null
    render()
  })

  document.querySelector('[data-attendance-baseline-action="undo"]')?.addEventListener('click', async () => {
    if (!attendanceBaselineUndoSnapshot) {
      window.alert('Chưa có thao tác nào để hoàn tác.')
      return
    }

    if (attendanceBaselineUndoSnapshot.type === 'draft') {
      restoreAttendanceBaselineDraftUndoSnapshot(attendanceBaselineUndoSnapshot)
    } else if (attendanceBaselineUndoSnapshot.type === 'clear') {
      const restored = restoreInitialBaselineEditSnapshot(attendanceBaselineUndoSnapshot)
      const currentRecords = loadStoredAttendanceRecords(getCurrentResolvedCenterId())
      const result = await writeC52AttendanceSessionReportThroughCloud({
        attendanceRecords: restored.records.filter((record) => record.source === 'initialBaseline'),
        baselineState: restored.state,
        previousAttendanceRecords: currentRecords,
        replaceBaselineRecords: true,
        reason: 'baseline-undo-clear',
      })
      if (!result.ok) return
      attendanceBaselineDraftRecords = Array.isArray(attendanceBaselineUndoSnapshot.draftRecords)
        ? attendanceBaselineUndoSnapshot.draftRecords
        : null
      attendanceBaselineDraftBaseRecords = Array.isArray(attendanceBaselineUndoSnapshot.draftBaseRecords)
        ? attendanceBaselineUndoSnapshot.draftBaseRecords
        : null
      attendanceBaselineDraftState = attendanceBaselineUndoSnapshot.draftState || null
    } else {
      const restored = restoreInitialBaselineEditSnapshot(attendanceBaselineUndoSnapshot)
      const currentRecords = loadStoredAttendanceRecords(getCurrentResolvedCenterId())
      const result = await writeC52AttendanceSessionReportThroughCloud({
        attendanceRecords: restored.records.filter((record) => record.source === 'initialBaseline'),
        baselineState: restored.state,
        previousAttendanceRecords: currentRecords,
        replaceBaselineRecords: true,
        reason: 'baseline-undo',
      })
      if (!result.ok) return
    }

    attendanceBaselineUndoSnapshot = null
    attendanceBoardDetailState = null
    render()
  })

  document.querySelector('[data-attendance-baseline-action="lock"]')?.addEventListener('click', async () => {
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
    const result = await writeC52AttendanceSessionReportThroughCloud({
      baselineState: nextState,
      reason: 'baseline-lock',
    })
    if (!result.ok) return
    attendanceBaselineUndoSnapshot = null
    render()
  })

  document.querySelector('[data-attendance-baseline-action="unlock"]')?.addEventListener('click', async () => {
    const confirmed = window.confirm(
      'Bạn chắc chắn muốn mở khóa dữ liệu điểm danh? Việc này có thể ảnh hưởng số buổi đã học, số buổi còn lại, học phí và bảng điểm danh.',
    )

    if (!confirmed) {
      return
    }

    const reason = window.prompt('Lý do mở khóa', '') || ''
    const unlockReason = reason.trim() || 'Mở khóa để chỉnh sửa dữ liệu nền.'
    const nextState = unlockAttendanceBaselineState(loadAttendanceBaselineState(getCurrentResolvedCenterId()), {
      byRole: 'admin',
      byName: 'Admin cơ sở',
      reason: unlockReason,
      note: 'Mở khóa dữ liệu nền điểm danh.',
    })
    const result = await writeC52AttendanceSessionReportThroughCloud({
      baselineState: nextState,
      reason: 'baseline-unlock',
    })
    if (!result.ok) return
    attendanceBaselineUndoSnapshot = null
    clearAttendanceBaselineDraft()
    render()
  })

  document.querySelectorAll('[data-settings-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      settingsActiveTab = button.dataset.settingsTab || 'class-sessions'
      settingsClassSessionFormState = null
      render()
    })
  })

  document.querySelector('[data-settings-class-session-action="open-create"]')?.addEventListener(
    'click',
    () => {
      settingsActiveTab = 'class-sessions'
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
      settingsActiveTab = 'class-sessions'
      render()
    })
  })

  document.querySelectorAll('[data-settings-class-session-action="toggle-status"]').forEach((button) => {
    button.addEventListener('click', async () => {
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

      const nextClassSession = {
        ...classSession,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      }
      await commitClassSessionProjection(nextClassSession, 'class-session-status')
      render()
    })
  })

  document.querySelectorAll('[data-settings-class-session-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      settingsClassSessionFormState = null
      render()
    })
  })

  const updateSettingsClassSessionAutoNamePreview = (values = settingsClassSessionFormState?.values ?? {}) => {
    const preview = document.querySelector('[data-settings-class-session-auto-name] strong')

    if (preview) {
      preview.textContent = buildClassSessionAutoName(values) || 'Chưa đủ thông tin'
    }
  }

  document.querySelectorAll('[data-settings-class-day-toggle]').forEach((pill) => {
    pill.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const option = event.currentTarget.closest('.settings-day-option')
      const checkbox = option?.querySelector('[data-settings-class-session-day]')

      if (!checkbox) {
        return
      }

      checkbox.checked = !checkbox.checked
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    })
  })

  document.querySelectorAll('[data-settings-class-session-field]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      if (!settingsClassSessionFormState) {
        return
      }

      const nextValues = {
        ...settingsClassSessionFormState.values,
        [control.dataset.settingsClassSessionField]: control.value,
      }

      settingsClassSessionFormState = {
        ...settingsClassSessionFormState,
        values: nextValues,
        errors: {
          ...settingsClassSessionFormState.errors,
          [control.dataset.settingsClassSessionField]: '',
        },
      }
      updateSettingsClassSessionAutoNamePreview(nextValues)
    })
  })

  document.querySelectorAll('[data-settings-class-session-day]').forEach((checkbox) => {
    checkbox.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
    })

    checkbox.addEventListener('change', (event) => {
      event.stopPropagation()
      if (!settingsClassSessionFormState) {
        return
      }

      const selectedDays = Array.from(
        document.querySelectorAll('[data-settings-class-session-day]:checked'),
      ).map((item) => item.value)

      if (selectedDays.length > 2) {
        event.currentTarget.checked = false
        settingsClassSessionFormState = {
          ...settingsClassSessionFormState,
          errors: {
            ...settingsClassSessionFormState.errors,
            daysOfWeek: 'Mỗi ca học chỉ chọn tối đa 2 ngày học.',
          },
        }
        render()
        return
      }

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
      updateSettingsClassSessionAutoNamePreview(settingsClassSessionFormState.values)
    })
  })

  document.querySelector('[data-settings-class-session-action="save-form"]')?.addEventListener(
    'click',
    async () => {
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
      const command = prepareAuthoritativeCoreFormCommand({
        formState: settingsClassSessionFormState,
        formValues: settingsClassSessionFormState.values,
        localIdPrefix: 'class',
        createIdempotencyKey: createCoreCommandIdempotencyKey,
      })
      const { commandIdempotencyKey, commandLocalId, commandCreatedAt } = command
      settingsClassSessionFormState = command.formState
      const builtClassSession = buildSettingsClassSessionFromForm(
        settingsClassSessionFormState.values,
        existingClassSession,
        classSessions,
      )
      const nextClassSession = existingClassSession
        ? builtClassSession
        : { ...builtClassSession, id: commandLocalId, createdAt: commandCreatedAt }

      const result = await commitClassSessionProjection(
        nextClassSession,
        'class-session-save',
        commandIdempotencyKey,
      )

      if (!result.ok) {
        settingsClassSessionFormState = {
          ...settingsClassSessionFormState,
          errors: {
            ...settingsClassSessionFormState.errors,
            form: result.error || 'Ca học chưa được lưu.',
          },
        }
        render()
        return
      }

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
      if (control.matches('select')) {
        markNativeSelectChangeRender()
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

  document.querySelector('[data-parent-crm-action="refresh"]')?.addEventListener('click', () => {
    void refreshModuleAuthoritativeUpstreams('khach-hang-tu-van', { reason: 'manual-refresh' })
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

  document.querySelectorAll('[data-parent-contact-row-id]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('button,a,input,select,textarea,[role="button"]')) {
        return
      }

      parentContactDetailId = row.dataset.parentContactRowId || null
      render()
    })

    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      if (event.target.closest('button,a,input,select,textarea,[role="button"]')) {
        return
      }

      event.preventDefault()
      parentContactDetailId = row.dataset.parentContactRowId || null
      render()
    })
  })

  document.querySelectorAll('[data-parent-contact-action="detail"]').forEach((button) => {
    button.addEventListener('click', () => {
      parentContactDetailId = button.dataset.contactId || null
      render()
    })
  })

  document.querySelectorAll('[data-parent-contact-action="close-detail"]').forEach((button) => {
    button.addEventListener('click', () => {
      parentContactDetailId = null
      render()
    })
  })

  document.querySelectorAll('[data-parent-link-action="open-derived"]').forEach((button) => {
    button.addEventListener('click', () => {
      openParentLinkReviewForDerivedContact(button.dataset.contactId, button.dataset.studentId)
    })
  })

  document.querySelectorAll('[data-parent-link-action="open-contact"]').forEach((button) => {
    button.addEventListener('click', () => {
      openParentLinkReviewForContact(button.dataset.contactId)
    })
  })

  document.querySelectorAll('[data-parent-link-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      openParentLinkReviewForExistingLink(button.dataset.linkId, 'update')
    })
  })

  document.querySelectorAll('[data-parent-link-action="end"]').forEach((button) => {
    button.addEventListener('click', () => {
      openParentLinkReviewForExistingLink(button.dataset.linkId, 'end')
    })
  })

  document.querySelectorAll('[data-parent-link-action="cancel"]').forEach((button) => {
    button.addEventListener('click', () => {
      if (parentLinkReviewState?.isSaving) return
      parentLinkReviewState = null
      render()
    })
  })

  document.querySelectorAll('[data-parent-link-field]').forEach((control) => {
    const eventName = control.type === 'text' || control.type === 'tel' || control.type === 'email' ? 'input' : 'change'
    control.addEventListener(eventName, () => {
      if (!parentLinkReviewState || parentLinkReviewState.isSaving) return
      const field = control.dataset.parentLinkField
      const value = control.type === 'checkbox' ? control.checked : control.value
      parentLinkReviewState = {
        ...parentLinkReviewState,
        [field]: value,
        error: '',
        message: '',
        ...(field === 'contactChoice' ? { selectedContactId: '', contactCreateCommand: null } : {}),
        ...(['newContactName', 'newContactPhone', 'newContactEmail'].includes(field) ? { contactCreateCommand: null } : {}),
      }
      if (field === 'contactChoice') render()
    })
  })

  document.querySelector('[data-parent-link-action="save"]')?.addEventListener('click', () => {
    void saveParentLinkReview()
  })

  document.querySelectorAll('[data-parent-identity-action="open"]').forEach((button) => {
    button.addEventListener('click', () => {
      openParentIdentityEditor(button.dataset.contactId)
    })
  })

  document.querySelectorAll('[data-parent-identity-action="cancel"]').forEach((button) => {
    button.addEventListener('click', () => {
      if (parentIdentityEditState?.isSaving) return
      parentIdentityEditState = null
      render()
    })
  })

  document.querySelectorAll('[data-parent-identity-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!parentIdentityEditState || parentIdentityEditState.isSaving) return
      parentIdentityEditState = {
        ...parentIdentityEditState,
        [control.dataset.parentIdentityField]: control.value,
        error: '',
        message: '',
      }
    })
  })

  document.querySelector('[data-parent-identity-action="save"]')?.addEventListener('click', () => {
    void saveParentIdentityEdit()
  })

  document.querySelectorAll('[data-parent-linked-student-id]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
      event.stopImmediatePropagation()
    })

    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      const studentId = button.dataset.parentLinkedStudentId

      if (!studentId) {
        return
      }

      parentContactDetailId = null
      openStudentDetailWindowFromChildInteraction(studentId)
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

  document.querySelectorAll('[data-parent-quick-note-suggestion]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()

      if (!parentQuickNoteState) {
        return
      }

      const suggestion = button.dataset.parentQuickNoteSuggestion || ''
      const currentContent = String(parentQuickNoteState.content || '').trim()

      parentQuickNoteState = {
        ...parentQuickNoteState,
        content: currentContent ? `${currentContent}\n${suggestion}` : suggestion,
        error: '',
      }
      render()

      const textarea = document.querySelector('[data-parent-quick-note-field="content"]')
      focusElementWithoutScrolling(textarea)
    })
  })

  document.querySelectorAll('[data-parent-quick-note-action="cancel"]').forEach((button) => {
    button.addEventListener('click', () => {
      parentQuickNoteState = null
      render()
    })
  })

  document.querySelector('[data-parent-quick-note-action="save"]')?.addEventListener('click', async () => {
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
    const careLog = updatedContact.careLogs?.find(
      (candidate) => !(existingContact.careLogs || []).some((item) => item.id === candidate.id),
    ) || updatedContact.careLogs?.[0]
    let command
    try {
      command = buildC53AppendCareLogCommand(existingContact, careLog)
    } catch {
      parentQuickNoteState = { ...parentQuickNoteState, error: 'Chưa thể chuẩn bị ghi chú. Vui lòng kiểm tra nội dung.' }
      render()
      return
    }
    const result = await writeC53CrmCommand(command, { reason: 'quick-care-note' })
    if (!result.ok) {
      parentQuickNoteState = {
        ...parentQuickNoteState,
        error: getParentFriendlyCrmOutcomeMessage(result),
      }
      render()
      return
    }
    parentQuickNoteState = null
    render()
  })

  document.querySelector('.parent-contact-form')?.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
  })

  document.querySelector('.parent-contact-form')?.addEventListener('mousedown', (event) => {
    event.stopPropagation()
  })

  document.querySelector('.parent-contact-form')?.addEventListener('click', (event) => {
    event.stopPropagation()
  })

  document.querySelectorAll('[data-parent-contact-field]').forEach((control) => {
    const eventName = control.matches('select') ? 'change' : 'input'

    control.addEventListener(eventName, () => {
      if (!parentConsultationFormState) {
        return
      }

      const fieldName = control.dataset.parentContactField
      const fieldValue = fieldName === 'studentBirthYear'
        ? control.value.replace(/\D/g, '').slice(0, 4)
        : control.value

      if (fieldName === 'studentBirthYear' && control.value !== fieldValue) {
        control.value = fieldValue
      }

      const calculatedLeadStudentAge = fieldName === 'studentBirthYear'
        ? calculateParentContactAgeFromBirthYear(fieldValue)
        : ''

      parentConsultationFormState = {
        ...parentConsultationFormState,
        values: {
          ...parentConsultationFormState.values,
          [fieldName]: fieldValue,
          ...(fieldName === 'studentBirthYear'
            ? { leadStudentAge: calculatedLeadStudentAge }
            : {}),
        },
        errors: {
          ...parentConsultationFormState.errors,
          [fieldName]: '',
        },
      }

      if (fieldName === 'studentSearch') {
        renderParentStudentPickerResults(fieldValue)
      }

      if (fieldName === 'studentBirthYear') {
        const ageControl = document.querySelector('[data-parent-contact-field="leadStudentAge"]')

        if (ageControl) {
          ageControl.value = calculatedLeadStudentAge
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
      const collectedFormState = collectParentContactWizardValuesFromDOM(parentConsultationFormState)

      parentConsultationFormState = syncParentContactWizardStep4Draft({
        ...collectedFormState,
        activeStep: nextStep,
        scrollTop: 0,
      }, { forceContactValues: nextStep === 4 })
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
      const collectedFormState = collectParentContactWizardValuesFromDOM(parentConsultationFormState)

      parentConsultationFormState = syncParentContactWizardStep4Draft({
        ...collectedFormState,
        activeStep: nextStep,
        scrollTop: 0,
      }, { forceContactValues: nextStep === 4 })
      skipNextParentContactScrollCapture = true
      render()
    })
  })

  document.querySelector('[data-parent-student-picker]')?.addEventListener('click', (event) => {
    if (!parentConsultationFormState) {
      return
    }

    const selectButton = event.target.closest('[data-parent-student-select-id]')
    const clearButton = event.target.closest('[data-parent-student-clear]')

    if (!selectButton && !clearButton) {
      return
    }

    event.preventDefault()

    if (selectButton) {
      const selectedStudent = students.find((student) => student.id === selectButton.dataset.parentStudentSelectId)

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
      setParentStudentPickerSearchValue(selectedStudent.fullName)
      renderParentStudentPickerSelection(selectedStudent)
      renderParentStudentPickerResults(selectedStudent.fullName)
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
    setParentStudentPickerSearchValue('')
    renderParentStudentPickerSelection(null)
    renderParentStudentPickerResults('')
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
    control.addEventListener('change', async () => {
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
      const updatedAppointment = updatedContact.appointments?.find(
        (appointment) => appointment.id === control.dataset.parentAppointmentStatusId,
      )
      let command
      try {
        command = buildC53UpsertAppointmentCommand(existingContact, updatedAppointment)
      } catch {
        c53CrmSharedTruthState = {
          ...c53CrmSharedTruthState,
          message: 'Chưa thể chuẩn bị lịch hẹn. Vui lòng kiểm tra thông tin.',
          messageTone: 'error',
        }
        render()
        return
      }
      const result = await writeC53CrmCommand(command, { reason: 'appointment-status' })
      if (!result.ok) return
      const refreshedContact = parentConsultations.find((contact) => contact.id === existingContact.id)
      if (!refreshedContact) return
      parentConsultationFormState = {
        ...createEditParentContactFormState(refreshedContact),
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

      const calculatedEnrollmentStudentAge = fieldName === 'studentBirthYear'
        ? calculateParentContactAgeFromBirthYear(fieldValue)
        : ''

      parentConsultationFormState = {
        ...parentConsultationFormState,
        enrollmentDraft: {
          ...parentConsultationFormState.enrollmentDraft,
          [fieldName]: fieldValue,
          ...(fieldName === 'studentBirthYear'
            ? { studentAge: calculatedEnrollmentStudentAge }
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
        const ageControl = document.querySelector('[data-parent-enrollment-field="studentAge"]')

        if (ageControl) {
          ageControl.value = calculatedEnrollmentStudentAge
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
    button.addEventListener('click', async () => {
      const contact = parentConsultations.find((item) => item.id === button.dataset.contactId)

      if (!contact || !window.confirm('Bạn có chắc muốn xóa liên hệ này?')) {
        return
      }

      let command
      try {
        command = buildC53ArchiveCaseCommand(contact)
      } catch {
        c53CrmSharedTruthState = {
          ...c53CrmSharedTruthState,
          message: 'Chưa thể chuẩn bị thao tác lưu trữ hồ sơ. Vui lòng làm mới và thử lại.',
          messageTone: 'error',
        }
        render()
        return
      }
      const result = await writeC53CrmCommand(command, { reason: 'archive-case' })
      if (!result.ok) return

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
    button.addEventListener('click', async () => {
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
      let command
      try {
        command = existingContact
          ? buildC53SaveCaseCommand(nextContact, {
              appointment: findChangedTrialAppointment(existingContact, nextContact),
            })
          : buildC53CreateLeadCommand(nextContact)
      } catch {
        parentConsultationFormState = {
          ...parentConsultationFormState,
          errors: { ...parentConsultationFormState.errors, summary: 'Chưa thể chuẩn bị hồ sơ để lưu. Vui lòng kiểm tra các trường đã nhập.' },
        }
        render()
        return
      }
      const result = await writeC53CrmCommand(command, {
        reason: existingContact ? 'save-case' : 'create-lead',
      })
      if (!result.ok) {
        parentConsultationFormState = {
          ...parentConsultationFormState,
          errors: {
            ...parentConsultationFormState.errors,
            summary: getParentFriendlyCrmOutcomeMessage(result),
          },
        }
        render()
        return
      }
      const requestedConsultantId = String(nextContact.consultantId || '').trim()
      const previousConsultantId = String(existingContact?.consultantId || '').trim()
      if (requestedConsultantId && requestedConsultantId !== previousConsultantId) {
        const refreshedContact = parentConsultations.find((contact) => contact.id === nextContact.id)
        if (!refreshedContact) {
          parentConsultationFormState = {
            ...parentConsultationFormState,
            errors: { ...parentConsultationFormState.errors, summary: 'Hồ sơ đã được lưu nhưng chưa tải lại được người phụ trách. Hãy làm mới trước khi tiếp tục.' },
          }
          render()
          return
        }
        let assignmentCommand
        try {
          assignmentCommand = buildC53AssignCaseCommand(refreshedContact, requestedConsultantId)
        } catch {
          parentConsultationFormState = {
            ...parentConsultationFormState,
            errors: { ...parentConsultationFormState.errors, summary: 'Chưa thể cập nhật người phụ trách. Vui lòng làm mới và thử lại.' },
          }
          render()
          return
        }
        const assignmentResult = await writeC53CrmCommand(assignmentCommand, { reason: 'assign-case' })
        if (!assignmentResult.ok) {
          parentConsultationFormState = {
            ...parentConsultationFormState,
            errors: {
              ...parentConsultationFormState.errors,
              summary: getParentFriendlyCrmOutcomeMessage(assignmentResult),
            },
          }
          render()
          return
        }
      }
      parentConsultationFormState = null
      render()
    })
  })

  document.querySelector('[data-parent-care-log-action="add"]')?.addEventListener('click', async () => {
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
    const careLog = updatedContact.careLogs?.find(
      (candidate) => !(existingContact.careLogs || []).some((item) => item.id === candidate.id),
    ) || updatedContact.careLogs?.[0]
    let command
    try {
      command = buildC53AppendCareLogCommand(existingContact, careLog)
    } catch {
      parentConsultationFormState = {
        ...parentConsultationFormState,
        careLogDraft: { ...draft, errors: { content: 'Chưa thể chuẩn bị ghi chú. Vui lòng kiểm tra nội dung.' } },
      }
      render()
      return
    }
    const result = await writeC53CrmCommand(command, { reason: 'append-care-log' })
    if (!result.ok) {
      parentConsultationFormState = {
        ...parentConsultationFormState,
        careLogDraft: {
          ...draft,
          errors: { content: getParentFriendlyCrmOutcomeMessage(result) },
        },
      }
      render()
      return
    }
    const refreshedContact = parentConsultations.find((contact) => contact.id === existingContact.id)
    if (!refreshedContact) return
    parentConsultationFormState = {
      ...createEditParentContactFormState(refreshedContact),
      careLogDraft: createEmptyParentCareLogDraft(),
      activeStep: parentConsultationFormState.activeStep,
      scrollTop: parentConsultationFormState.scrollTop || 0,
    }
    render()
  })

  document.querySelector('[data-parent-appointment-action="add"]')?.addEventListener('click', async () => {
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
    const appointment = updatedContact.appointments?.find(
      (candidate) => !(existingContact.appointments || []).some((item) => item.id === candidate.id),
    ) || updatedContact.appointments?.[0]
    let command
    try {
      command = buildC53UpsertAppointmentCommand(existingContact, appointment)
    } catch {
      parentConsultationFormState = {
        ...parentConsultationFormState,
        appointmentDraft: { ...draft, errors: { scheduledAt: 'Chưa thể chuẩn bị lịch hẹn. Vui lòng kiểm tra ngày giờ.' } },
      }
      render()
      return
    }
    const result = await writeC53CrmCommand(command, { reason: 'create-appointment' })
    if (!result.ok) {
      parentConsultationFormState = {
        ...parentConsultationFormState,
        appointmentDraft: {
          ...draft,
          errors: { scheduledAt: getParentFriendlyCrmOutcomeMessage(result) },
        },
      }
      render()
      return
    }
    const refreshedContact = parentConsultations.find((contact) => contact.id === existingContact.id)
    if (!refreshedContact) return
    parentConsultationFormState = {
      ...createEditParentContactFormState(refreshedContact),
      appointmentDraft: createEmptyParentAppointmentDraft(),
      activeStep: parentConsultationFormState.activeStep,
      scrollTop: parentConsultationFormState.scrollTop || 0,
    }
    render()
  })

  document.querySelector('[data-parent-enrollment-action="save"]')?.addEventListener('click', () => {
    void saveParentEnrollmentDraft(false)
  })

  document.querySelector('[data-parent-enrollment-action="ready"]')?.addEventListener('click', () => {
    void saveParentEnrollmentDraft(true)
  })

  document.querySelector('[data-parent-enrollment-action="copy"]')?.addEventListener('click', async () => {
    if (!parentConsultationFormState || parentConsultationFormState.mode !== 'edit') {
      return
    }

    parentConsultationFormState = syncParentContactWizardStep4Draft(
      collectParentContactWizardValuesFromDOM(parentConsultationFormState),
      { forceContactValues: true },
    )

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

  document.querySelectorAll('[data-teacher-action="open-teacher-portal"]').forEach((summary) => {
    summary.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const shell = summary.closest('.teacher-portal-shell')

      if (!shell) {
        return
      }

      shell.open = true
      summary.setAttribute('aria-expanded', 'true')
      shell.querySelector('.teacher-portal-preview')?.scrollIntoView({ block: 'nearest' })
    })
  })

  document.querySelectorAll('[data-teacher-action="open-staff-link"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openTeacherStaffLinkModal(button.dataset.teacherId)
    })
  })

  document.querySelectorAll('[data-teacher-action="open-linked-staff"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openLinkedStaffFromTeacher(button.dataset.staffId)
    })
  })

  document.querySelectorAll('[data-teacher-action="unlink-staff"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      unlinkTeacherFromStaff(button.dataset.staffId, button.dataset.teacherId)
    })
  })

  document.querySelectorAll('[data-teacher-staff-link-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const action = button.dataset.teacherStaffLinkAction

      if (action === 'close') {
        closeTeacherStaffLinkModal()
        return
      }

      if (action === 'set-mode') {
        setTeacherStaffLinkMode(button.dataset.linkMode)
        return
      }

      if (action === 'link-existing') {
        handleLinkExistingStaffToTeacher(button.dataset.staffId)
      }
    })
  })

  document.querySelector('[data-teacher-staff-link-query]')?.addEventListener('input', (event) => {
    updateTeacherStaffLinkQuery(event.target.value)
    render()
  })

  document.querySelectorAll('[data-teacher-staff-create-field]').forEach((control) => {
    const eventName = control.tagName === 'SELECT' ? 'change' : 'input'
    control.addEventListener(eventName, () => {
      updateTeacherStaffCreateField(control.dataset.teacherStaffCreateField, control.value)
      if (control.dataset.teacherStaffCreateField === 'employmentStatus') {
        render()
      }
    })
  })

  document.querySelector('[data-teacher-staff-create-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    handleCreateStaffFromTeacher(event.currentTarget)
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
    button.addEventListener('click', async (event) => {
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

      await commitTeacherProjection({
        ...teacher,
        status: 'inactive',
        updatedAt: new Date().toISOString(),
      }, 'teacher-status')
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

  document.querySelector('[data-teacher-form]')?.addEventListener('submit', handleTeacherFormSave)
  document.querySelector('[data-teacher-action="save-form"]')?.addEventListener('click', handleTeacherFormSave)

  const closeScheduleActivityPanels = () => {
    scheduleCalendarItemState = null
    scheduleCalendarTagState = null
  }

  const canUseScheduleCalendarNotes = () =>
    isModuleUpstreamCurrent('thoi-khoa-bieu', 'calendar-notes')

  const resetScheduleReportPanels = () => {
    scheduleReportState = null
    scheduleAdminAttendanceState = null
    sessionReportAttendanceState = null
    sessionReportLearningState = null
    sessionReportLearningFormState = null
    sessionReportExtraState = null
    isSessionReportExtraExpanded = false
    sessionReportGuestFormState = null
  }

  const getCurrentCenterCalendarItems = () => centerCalendarItems

  const getCurrentCenterCalendarItem = (itemId) =>
    getCenterCalendarItemById(getCurrentCenterCalendarItems(), itemId)

  const getCurrentCenterCalendarTags = () => centerCalendarTags

  const getCurrentCenterCalendarTag = (tagId) =>
    getCenterCalendarTagById(getCurrentCenterCalendarTags(), tagId)

  const openCenterCalendarItemDetail = (itemId) => {
    if (!canUseScheduleCalendarNotes()) return

    const item = getCurrentCenterCalendarItem(itemId)

    if (!item) {
      scheduleCalendarItemState = null
      render()
      return
    }

    scheduleFormState = null
    resetScheduleReportPanels()
    scheduleCalendarItemState = createCenterCalendarItemDetailState(item)
    render()
  }

  const openCenterCalendarOccurrenceDetail = (masterId, occurrenceDate) => {
    if (!canUseScheduleCalendarNotes()) return

    const masterItem = getCurrentCenterCalendarItem(masterId)

    if (!masterItem || !isWeeklyRecurringCenterCalendarItem(masterItem)) {
      scheduleCalendarItemState = null
      render()
      return
    }

    const occurrenceRangeStart = `${occurrenceDate}T00:00:00.000Z`
    const occurrenceRangeEnd = `${occurrenceDate}T23:59:59.999Z`
    const occurrence = expandWeeklyCenterCalendarOccurrences([masterItem], {
      rangeStart: occurrenceRangeStart,
      rangeEnd: occurrenceRangeEnd,
    }).find((item) => item.occurrenceDate === occurrenceDate)

    if (!occurrence) {
      scheduleCalendarItemState = null
      render()
      return
    }

    scheduleFormState = null
    resetScheduleReportPanels()
    scheduleCalendarItemState = createCenterCalendarOccurrenceDetailState(occurrence, masterItem)
    render()
  }

  const resolveCurrentCenterCalendarSeriesMaster = (masterId) => {
    const centerId = getCurrentC57AuthoritativeCenterId()
    const latestItems = centerCalendarItems
    const masterItem = getCenterCalendarItemById(latestItems, masterId)

    if (!masterItem || masterItem.centerId !== centerId || !isWeeklyRecurringCenterCalendarItem(masterItem)) {
      return { centerId, latestItems, masterItem: null }
    }

    return { centerId, latestItems, masterItem }
  }

  const openCenterCalendarSeriesEdit = (masterId, occurrenceDate = '') => {
    if (!canUseScheduleCalendarNotes()) return

    const { masterItem } = resolveCurrentCenterCalendarSeriesMaster(masterId)

    if (!masterItem) {
      scheduleCalendarItemState = {
        mode: 'occurrenceDetail',
        masterId,
        item: null,
        errors: { form: 'Chuỗi hoạt động không còn tồn tại trong cơ sở hiện tại.' },
      }
      render()
      return
    }

    scheduleFormState = null
    resetScheduleReportPanels()
    scheduleCalendarItemState = createEditCenterCalendarSeriesFormState(masterItem, occurrenceDate)
    render()
  }

  const openCenterCalendarSeriesDelete = (masterId, occurrenceDate = '') => {
    if (!canUseScheduleCalendarNotes()) return

    const { masterItem } = resolveCurrentCenterCalendarSeriesMaster(masterId)

    if (!masterItem) {
      scheduleCalendarItemState = {
        ...createCenterCalendarSeriesDeleteState(null, occurrenceDate),
        masterId,
        errors: { form: 'Chuỗi hoạt động không còn tồn tại trong cơ sở hiện tại.' },
      }
      render()
      return
    }

    scheduleFormState = null
    resetScheduleReportPanels()
    scheduleCalendarItemState = createCenterCalendarSeriesDeleteState(masterItem, occurrenceDate)
    render()
  }

  const getCenterCalendarFormValuesFromDom = () => {
    const formElement = document.querySelector('[data-center-calendar-form]')
    const values = {
      ...(scheduleCalendarItemState?.values ?? {}),
    }

    formElement?.querySelectorAll('[data-center-calendar-form-field]').forEach((control) => {
      const fieldName = control.dataset.centerCalendarFormField

      if (!fieldName) {
        return
      }

      values[fieldName] = control.type === 'checkbox' ? control.checked : control.value
    })

    return values
  }

  const getCenterCalendarTagFormValuesFromDom = () => {
    const formElement = document.querySelector('[data-center-calendar-tag-form]')
    const values = {
      ...(scheduleCalendarTagState?.values ?? {}),
    }

    formElement?.querySelectorAll('[data-center-calendar-tag-field]').forEach((control) => {
      const fieldName = control.dataset.centerCalendarTagField

      if (fieldName) {
        values[fieldName] = control.value
      }
    })

    return values
  }

  const getDefaultCenterCalendarColorKeyForType = (itemType) => {
    const defaults = {
      meeting: 'orange',
      event: 'green',
      tournament: 'emerald',
      other: 'yellow',
    }

    return defaults[itemType] || defaults.other
  }

  const isCenterCalendarColorOverridden = (values = {}) =>
    values.colorOverridden === true || values.colorOverridden === 'true'

  const updateCenterCalendarPaletteDom = (colorKey, colorOverridden) => {
    const formElement = document.querySelector('[data-center-calendar-form]')

    if (!formElement) {
      return
    }

    formElement.querySelectorAll('[data-center-calendar-color-key]').forEach((button) => {
      const isSelected = button.dataset.centerCalendarColorKey === colorKey
      button.classList.toggle('is-selected', isSelected)
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false')
      const checkElement = button.querySelector('span')

      if (checkElement) {
        checkElement.textContent = isSelected ? '✓' : ''
      }
    })

    const colorInput = formElement.querySelector('[data-center-calendar-form-field="colorKey"]')
    const overrideInput = formElement.querySelector('[data-center-calendar-form-field="colorOverridden"]')

    if (colorInput) {
      colorInput.value = colorKey
    }

    if (overrideInput) {
      overrideInput.value = colorOverridden ? 'true' : ''
    }
  }

  const updateCenterCalendarTagPaletteDom = (colorKey) => {
    const formElement = document.querySelector('[data-center-calendar-tag-form]')

    if (!formElement) {
      return
    }

    formElement.querySelectorAll('[data-center-calendar-tag-color-key]').forEach((button) => {
      const isSelected = button.dataset.centerCalendarTagColorKey === colorKey
      button.classList.toggle('is-selected', isSelected)
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false')
      const checkElement = button.querySelector('span')

      if (checkElement) {
        checkElement.textContent = isSelected ? '✓' : ''
      }
    })

    const colorInput = formElement.querySelector('[data-center-calendar-tag-field="colorKey"]')

    if (colorInput) {
      colorInput.value = colorKey
    }
  }

  const getDefaultCenterCalendarRecurrenceDay = (date) => {
    const dayIndex = new Date(`${date}T00:00:00`).getDay()
    return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayIndex] || 'mon'
  }

  const updateCenterCalendarRecurrenceDaysDom = (selectedDays) => {
    const formElement = document.querySelector('[data-center-calendar-form]')

    if (!formElement) {
      return
    }

    const selectedDaySet = new Set(selectedDays)
    formElement.querySelectorAll('[data-center-calendar-recurrence-day]').forEach((button) => {
      const isSelected = selectedDaySet.has(button.dataset.centerCalendarRecurrenceDay)
      button.classList.toggle('is-selected', isSelected)
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false')
    })

    const daysInput = formElement.querySelector('[data-center-calendar-form-field="recurrenceDays"]')
    if (daysInput) {
      daysInput.value = selectedDays.join(',')
    }
  }

  const updateCenterCalendarRecurrenceModeDom = (frequency, endMode) => {
    const formElement = document.querySelector('[data-center-calendar-form]')
    const recurrenceElement = formElement?.querySelector('[data-center-calendar-recurrence]')

    if (!recurrenceElement) {
      return
    }

    recurrenceElement.classList.toggle('is-weekly', frequency === 'weekly')
    recurrenceElement.classList.toggle('is-none', frequency !== 'weekly')

    const untilElement = recurrenceElement.querySelector('[data-center-calendar-recurrence-until]')
    const countElement = recurrenceElement.querySelector('[data-center-calendar-recurrence-count]')

    if (untilElement) {
      untilElement.classList.toggle('is-hidden', endMode === 'count')
    }

    if (countElement) {
      countElement.classList.toggle('is-hidden', endMode !== 'count')
    }
  }

  const persistCenterCalendarItem = async (centerId, nextItem, existingItem = null) => {
    if (!canUseScheduleCalendarNotes()) {
      return { ok: false, outcome_code: 'SHARED_TRUTH_NOT_CURRENT', error: 'Đang chờ dữ liệu hoạt động hiện tại.' }
    }

    if (!centerId || centerId !== getCurrentC57AuthoritativeCenterId()) {
      return { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED', error: getC57OutcomeMessage('CENTER_CONTEXT_CHANGED') }
    }
    return writeC57CalendarNotesCommand(buildC57SaveCalendarItemCommand({
      ...nextItem,
      id: existingItem?.id || nextItem.id,
      cloudVersion: Number(nextItem.cloudVersion) || 0,
    }), { reason: existingItem ? 'calendar-item-update' : 'calendar-item-create' })
  }

  const saveCenterCalendarItemFromForm = async (event) => {
    event?.preventDefault?.()

    if (!scheduleCalendarItemState || !['create', 'edit'].includes(scheduleCalendarItemState.mode)) {
      return
    }

    const formValues = getCenterCalendarFormValuesFromDom()
    const errors = validateCenterCalendarItemForm(formValues)

    if (Object.keys(errors).length) {
      scheduleCalendarItemState = {
        ...scheduleCalendarItemState,
        values: formValues,
        errors,
      }
      render()
      return
    }

    const centerId = getCurrentC57AuthoritativeCenterId()
    const baseVersion = Number(scheduleCalendarItemState.baseVersion) || 0
    const baseCenterId = String(scheduleCalendarItemState.baseCenterId || '')
    const latestItems = centerCalendarItems
    const latestTags = centerCalendarTags
    const existingItem = scheduleCalendarItemState.mode === 'edit'
      ? getCenterCalendarItemById(latestItems, scheduleCalendarItemState.itemId)
      : null
    const selectedTag = formValues.tagId ? getCenterCalendarTagById(latestTags, formValues.tagId) : null
    const existingTag = existingItem?.tagId ? getCenterCalendarTagById(latestTags, existingItem.tagId) : null
    const canUseSelectedTag = !formValues.tagId || selectedTag?.isActive || selectedTag?.id === existingTag?.id
    const itemErrors = canUseSelectedTag ? {} : { tagId: 'Nhãn đã lưu trữ không thể gắn mới.' }
    if (scheduleCalendarItemState.mode === 'edit' && (!baseCenterId || baseCenterId !== centerId || baseVersion < 1)) {
      itemErrors.form = 'Context/version lúc mở form không còn hợp lệ; hãy đóng và mở lại.'
    }

    if (Object.keys(itemErrors).length) {
      scheduleCalendarItemState = {
        ...scheduleCalendarItemState,
        values: formValues,
        errors: itemErrors,
      }
      render()
      return
    }

    formValues.tagLabel = selectedTag?.label || ''
    const nextItem = buildCenterCalendarItemFromForm(formValues, existingItem, centerId)

    if (!nextItem) {
      scheduleCalendarItemState = {
        ...scheduleCalendarItemState,
        values: formValues,
        errors: { form: 'Dữ liệu hoạt động không hợp lệ.' },
      }
      render()
      return
    }
    nextItem.cloudVersion = baseVersion

    const seriesRange = isWeeklyRecurringCenterCalendarItem(nextItem)
      ? getCenterCalendarSeriesRange(nextItem)
      : null
    const candidateOccurrences = seriesRange
      ? expandWeeklyCenterCalendarOccurrences([nextItem], {
          rangeStart: seriesRange.startAt,
          rangeEnd: seriesRange.endAt,
        })
      : []
    const conflictResult = candidateOccurrences.length
      ? detectCenterCalendarSeriesConflicts({
          candidate: nextItem,
          occurrences: candidateOccurrences,
          centerId,
          classSessions,
          scheduleSessions,
          centerCalendarItems: latestItems,
          currentItemId: existingItem?.id || nextItem.id,
        })
      : detectCenterCalendarConflicts({
          candidate: nextItem,
          centerId,
          classSessions,
          scheduleSessions,
          centerCalendarItems: latestItems,
          currentItemId: existingItem?.id || '',
        })

    if (conflictResult.hasHard || conflictResult.hasSoft) {
      scheduleCalendarItemState = createCenterCalendarItemConflictState({
        previousState: {
          ...scheduleCalendarItemState,
          baseVersion,
          baseCenterId,
          values: formValues,
          errors: {},
        },
        conflictResult,
        pendingItem: nextItem,
      })
      render()
      return
    }

    const result = await persistCenterCalendarItem(centerId, nextItem, existingItem)
    if (result.ok) {
      scheduleCalendarItemState = null
      render()
    } else {
      scheduleCalendarItemState = {
        ...scheduleCalendarItemState,
        values: formValues,
        errors: { form: result.error || getC57OutcomeMessage(result.outcome_code) },
      }
      render()
    }
  }

  const saveCenterCalendarTagFromForm = async (event) => {
    event?.preventDefault?.()

    if (!canUseScheduleCalendarNotes()) return

    if (!scheduleCalendarTagState || !['create', 'edit'].includes(scheduleCalendarTagState.mode)) {
      return
    }

    const centerId = getCurrentC57AuthoritativeCenterId()
    const baseVersion = Number(scheduleCalendarTagState.baseVersion) || 0
    const baseCenterId = String(scheduleCalendarTagState.baseCenterId || '')
    const formValues = getCenterCalendarTagFormValuesFromDom()
    const latestTags = centerCalendarTags
    const existingTag = scheduleCalendarTagState.mode === 'edit'
      ? getCenterCalendarTagById(latestTags, scheduleCalendarTagState.tagId)
      : null
    const errors = validateCenterCalendarTagForm(formValues, latestTags, existingTag?.id || '')
    if (scheduleCalendarTagState.mode === 'edit' && (!baseCenterId || baseCenterId !== centerId || baseVersion < 1)) {
      errors.form = 'Context/version lúc mở form không còn hợp lệ; hãy đóng và mở lại.'
    }

    if (Object.keys(errors).length) {
      scheduleCalendarTagState = {
        ...scheduleCalendarTagState,
        values: formValues,
        errors,
      }
      render()
      return
    }

    const nextTag = buildCenterCalendarTagFromForm(formValues, existingTag, centerId)

    if (!nextTag) {
      scheduleCalendarTagState = {
        ...scheduleCalendarTagState,
        values: formValues,
        errors: { form: 'Dữ liệu nhãn không hợp lệ.' },
      }
      render()
      return
    }

    const result = await writeC57CalendarNotesCommand(buildC57SaveCalendarTagCommand({
      ...nextTag,
      id: existingTag?.id || nextTag.id,
      cloudVersion: baseVersion,
    }), { reason: existingTag ? 'calendar-tag-update' : 'calendar-tag-create' })
    if (result.ok) {
      scheduleCalendarTagState = createCenterCalendarTagManagerState()
    } else {
      scheduleCalendarTagState = {
        ...scheduleCalendarTagState,
        values: formValues,
        errors: { form: result.error || getC57OutcomeMessage(result.outcome_code) },
      }
    }
    render()
  }

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

      closeScheduleActivityPanels()
      resetScheduleReportPanels()
      render()
    })
  })

  document.querySelector('[data-schedule-action="open-create"]')?.addEventListener('click', () => {
    scheduleFormState = createEmptyScheduleFormState()
    closeScheduleActivityPanels()
    resetScheduleReportPanels()
    render()
  })

  document.querySelector('[data-center-calendar-action="open-create"]')?.addEventListener('click', () => {
    if (!canUseScheduleCalendarNotes()) return

    scheduleFormState = null
    scheduleCalendarTagState = null
    resetScheduleReportPanels()
    scheduleCalendarItemState = createEmptyCenterCalendarItemFormState(scheduleWeekStartDate)
    render()
  })

  document.querySelectorAll('[data-center-calendar-filter]').forEach((control) => {
    control.addEventListener('change', () => {
      const filterName = control.dataset.centerCalendarFilter

      if (!filterName) {
        return
      }

      scheduleCalendarFilters = {
        ...scheduleCalendarFilters,
        [filterName]: control.value,
      }
      render()
    })
  })

  document.querySelector('[data-center-calendar-filter-action="clear"]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    scheduleCalendarFilters = { itemType: 'all', tagId: 'all' }
    render()
  })

  document.querySelector('[data-schedule-print-action="print"]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    printCurrentScheduleWeek()
  })

  document.querySelector('[data-center-calendar-tag-action="open-manager"]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!canUseScheduleCalendarNotes()) return

    scheduleFormState = null
    scheduleCalendarItemState = null
    resetScheduleReportPanels()
    scheduleCalendarTagState = createCenterCalendarTagManagerState()
    render()
  })

  document.querySelectorAll('[data-schedule-action="open-create-for-day"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      scheduleFormState = createScheduleFormStateForDay(
        button.dataset.scheduleDayOfWeek,
        button.dataset.scheduleDate,
      )
      closeScheduleActivityPanels()
      resetScheduleReportPanels()
      render()
    })
  })

  document.querySelectorAll('[data-schedule-action="open-edit"]').forEach((card) => {
    const openScheduleSession = () => {
      closeScheduleActivityPanels()
      const occurrenceDate = card.dataset.scheduleOccurrenceDate
      const occurrence = getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate, classSessions).find(
        (item) => item.id === card.dataset.scheduleSessionId && item.occurrenceDate === occurrenceDate,
      )
      const session = occurrence?.assignmentId
        ? scheduleSessions.find((item) => item.id === occurrence.assignmentId)
        : scheduleSessions.find((item) => item.id === card.dataset.scheduleSessionId)

      if (!session && !occurrence?.isEmptyClassSessionSlot) {
        return
      }

      if (occurrence?.isEmptyClassSessionSlot) {
        scheduleReportState = null
        scheduleAdminAttendanceState = null
        sessionReportAttendanceState = null
        sessionReportLearningState = null
        sessionReportLearningFormState = null
        sessionReportExtraState = null
        isSessionReportExtraExpanded = false
        sessionReportGuestFormState = null
        scheduleFormState = {
          ...createEmptyScheduleFormState(),
          mode: 'assign',
          values: {
            ...createEmptyScheduleFormState().values,
            scheduleType: 'recurring',
            classSessionId: occurrence.classSessionId,
            title: '',
            dayOfWeek: occurrence.dayOfWeek,
            startTime: occurrence.startTime,
            endTime: occurrence.endTime,
            room: occurrence.room || '',
            level: occurrence.level || 'mixed',
            status: occurrence.status || 'scheduled',
            allowOpenRange: 'true',
          },
        }
      } else if (occurrence && isPastScheduleOccurrence(occurrence)) {
        scheduleFormState = null
        scheduleReportState = {
          sessionId: session?.id || occurrence.id,
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

  document.querySelectorAll('.schedule-calendar-item[data-center-calendar-item-id]').forEach((card) => {
    const openCalendarItem = () => {
      if (card.dataset.centerCalendarMasterId && card.dataset.centerCalendarOccurrenceDate) {
        openCenterCalendarOccurrenceDetail(
          card.dataset.centerCalendarMasterId,
          card.dataset.centerCalendarOccurrenceDate,
        )
        return
      }

      openCenterCalendarItemDetail(card.dataset.centerCalendarItemId)
    }

    card.addEventListener('click', (event) => {
      event.stopPropagation()
      openCalendarItem()
    })
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        openCalendarItem()
      }
    })
  })

  document.querySelectorAll('[data-center-calendar-form-field]').forEach((control) => {
    const updateCalendarFormValue = () => {
      if (!scheduleCalendarItemState || !['create', 'edit'].includes(scheduleCalendarItemState.mode)) {
        return
      }

      const fieldName = control.dataset.centerCalendarFormField

      if (!fieldName) {
        return
      }

      scheduleCalendarItemState = {
        ...scheduleCalendarItemState,
        values: {
          ...scheduleCalendarItemState.values,
          [fieldName]: control.type === 'checkbox' ? control.checked : control.value,
        },
        errors: {
          ...scheduleCalendarItemState.errors,
          [fieldName]: undefined,
        },
      }

      if (fieldName === 'recurrenceFrequency') {
        const nextValues = { ...scheduleCalendarItemState.values }
        if (control.value === 'weekly' && !String(nextValues.recurrenceDays || '').trim()) {
          nextValues.recurrenceDays = getDefaultCenterCalendarRecurrenceDay(nextValues.date)
        }
        scheduleCalendarItemState = {
          ...scheduleCalendarItemState,
          values: nextValues,
        }
        updateCenterCalendarRecurrenceModeDom(control.value, nextValues.recurrenceEndMode || 'until')
        updateCenterCalendarRecurrenceDaysDom(String(nextValues.recurrenceDays || '').split(/[,\s/]+/).filter(Boolean))
        return
      }

      if (fieldName === 'recurrenceEndMode') {
        updateCenterCalendarRecurrenceModeDom(
          scheduleCalendarItemState.values.recurrenceFrequency,
          control.value,
        )
        return
      }

      if (fieldName === 'itemType' && !isCenterCalendarColorOverridden(scheduleCalendarItemState.values)) {
        const colorKey = getDefaultCenterCalendarColorKeyForType(control.value)
        scheduleCalendarItemState = {
          ...scheduleCalendarItemState,
          values: {
            ...scheduleCalendarItemState.values,
            colorKey,
          },
        }
        updateCenterCalendarPaletteDom(colorKey, false)
      }
    }

    control.addEventListener('input', updateCalendarFormValue)
    control.addEventListener('change', updateCalendarFormValue)
  })

  document.querySelectorAll('[data-center-calendar-tag-field]').forEach((control) => {
    const updateCalendarTagFormValue = () => {
      if (!scheduleCalendarTagState || !['create', 'edit'].includes(scheduleCalendarTagState.mode)) {
        return
      }

      const fieldName = control.dataset.centerCalendarTagField

      if (!fieldName) {
        return
      }

      scheduleCalendarTagState = {
        ...scheduleCalendarTagState,
        values: {
          ...scheduleCalendarTagState.values,
          [fieldName]: control.value,
        },
        errors: {
          ...scheduleCalendarTagState.errors,
          [fieldName]: undefined,
        },
      }
    }

    control.addEventListener('input', updateCalendarTagFormValue)
    control.addEventListener('change', updateCalendarTagFormValue)
  })

  document.querySelectorAll('[data-center-calendar-recurrence-day]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()

      if (!scheduleCalendarItemState || !['create', 'edit'].includes(scheduleCalendarItemState.mode)) {
        return
      }

      const day = button.dataset.centerCalendarRecurrenceDay
      if (!day) {
        return
      }

      const selectedDays = String(scheduleCalendarItemState.values.recurrenceDays || '')
        .split(/[,\s/]+/)
        .filter(Boolean)
      const nextDays = selectedDays.includes(day)
        ? selectedDays.filter((item) => item !== day)
        : [...selectedDays, day]
      const orderedDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].filter((item) => nextDays.includes(item))

      scheduleCalendarItemState = {
        ...scheduleCalendarItemState,
        values: {
          ...scheduleCalendarItemState.values,
          recurrenceDays: orderedDays.join(','),
        },
        errors: {
          ...scheduleCalendarItemState.errors,
          recurrenceDays: undefined,
        },
      }
      updateCenterCalendarRecurrenceDaysDom(orderedDays)
    })
  })

  document.querySelectorAll('[data-center-calendar-tag-action]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const action = button.dataset.centerCalendarTagAction

      if (action === 'open-manager') {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (!canUseScheduleCalendarNotes()) return

      if (action === 'close') {
        scheduleCalendarTagState = null
        render()
        return
      }

      if (action === 'list') {
        scheduleCalendarTagState = createCenterCalendarTagManagerState()
        render()
        return
      }

      if (action === 'create') {
        scheduleCalendarTagState = createEmptyCenterCalendarTagFormState()
        render()
        return
      }

      if (action === 'edit') {
        const tag = getCurrentCenterCalendarTag(button.dataset.centerCalendarTagId)

        if (!tag) {
          scheduleCalendarTagState = createCenterCalendarTagManagerState()
          render()
          return
        }

        scheduleCalendarTagState = createEditCenterCalendarTagFormState(tag)
        render()
        return
      }

      if (action === 'select-color') {
        if (!scheduleCalendarTagState || !['create', 'edit'].includes(scheduleCalendarTagState.mode)) {
          return
        }

        const colorKey = button.dataset.centerCalendarTagColorKey || 'gray'
        scheduleCalendarTagState = {
          ...scheduleCalendarTagState,
          values: {
            ...scheduleCalendarTagState.values,
            colorKey,
          },
          errors: {
            ...scheduleCalendarTagState.errors,
            colorKey: undefined,
          },
        }
        updateCenterCalendarTagPaletteDom(colorKey)
        return
      }

      if (action === 'save') {
        await saveCenterCalendarTagFromForm(event)
        return
      }

      if (action === 'archive' || action === 'restore') {
        const tagId = button.dataset.centerCalendarTagId
        const latestTags = centerCalendarTags
        const targetTag = getCenterCalendarTagById(latestTags, tagId)

        if (action === 'restore' && targetTag) {
          const duplicateActiveTag = latestTags.find(
            (tag) =>
              tag.id !== targetTag.id &&
              tag.isActive &&
              String(tag.label || '').trim().toLocaleLowerCase('vi-VN') ===
                String(targetTag.label || '').trim().toLocaleLowerCase('vi-VN'),
          )

          if (duplicateActiveTag) {
            scheduleCalendarTagState = {
              ...createCenterCalendarTagManagerState(),
              errors: { form: 'Không thể khôi phục vì đã có nhãn đang dùng cùng tên.' },
            }
            render()
            return
          }
        }

        if (!targetTag) return
        const result = await writeC57CalendarNotesCommand(
          buildC57SetCalendarTagActiveCommand(targetTag, action === 'restore'),
          { reason: `calendar-tag-${action}` },
        )
        scheduleCalendarTagState = result.ok
          ? createCenterCalendarTagManagerState()
          : {
              ...createCenterCalendarTagManagerState(),
              errors: { form: result.error || getC57OutcomeMessage(result.outcome_code) },
            }
        render()
      }
    })
  })

  document.querySelectorAll('[data-center-calendar-action]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const action = button.dataset.centerCalendarAction

      if (action === 'open-create') {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (!canUseScheduleCalendarNotes()) return

      if (action === 'close') {
        scheduleCalendarItemState = null
        render()
        return
      }

      if (action === 'conflict-return') {
        if (scheduleCalendarItemState?.mode !== 'conflict') {
          return
        }

        scheduleCalendarItemState = {
          mode: scheduleCalendarItemState.previousMode || 'create',
          itemId: scheduleCalendarItemState.itemId || null,
          baseVersion: Number(scheduleCalendarItemState.baseVersion) || 0,
          baseCenterId: String(scheduleCalendarItemState.baseCenterId || ''),
          isSeriesEdit: Boolean(scheduleCalendarItemState.isSeriesEdit),
          openedFromOccurrenceDate: scheduleCalendarItemState.openedFromOccurrenceDate || '',
          values: {
            ...(scheduleCalendarItemState.values ?? {}),
          },
          errors: {},
        }
        render()
        return
      }

      if (action === 'conflict-save') {
        if (scheduleCalendarItemState?.mode !== 'conflict' || !scheduleCalendarItemState.pendingItem) {
          return
        }

        const centerId = getCurrentC57AuthoritativeCenterId()
        const pendingItem = scheduleCalendarItemState.pendingItem

        if (pendingItem.centerId && pendingItem.centerId !== centerId) {
          scheduleCalendarItemState = {
            ...scheduleCalendarItemState,
            errors: { form: 'Không thể lưu vì cơ sở đã thay đổi. Vui lòng mở lại form.' },
          }
          render()
          return
        }

        const latestItems = centerCalendarItems
        const existingItem = scheduleCalendarItemState.previousMode === 'edit'
          ? getCenterCalendarItemById(latestItems, scheduleCalendarItemState.itemId)
          : null

        if (scheduleCalendarItemState.previousMode === 'edit' && !existingItem) {
          scheduleCalendarItemState = {
            ...scheduleCalendarItemState,
            errors: { form: 'Hoạt động này không còn tồn tại trong cơ sở hiện tại.' },
          }
          render()
          return
        }

        const result = await persistCenterCalendarItem(centerId, pendingItem, existingItem)
        if (result.ok) {
          scheduleCalendarItemState = null
        } else {
          scheduleCalendarItemState = {
            ...scheduleCalendarItemState,
            errors: { form: result.error || getC57OutcomeMessage(result.outcome_code) },
          }
        }
        render()
        return
      }

      if (action === 'save') {
        await saveCenterCalendarItemFromForm(event)
        return
      }

      if (action === 'delete') {
        const itemId = button.dataset.centerCalendarItemId
        const item = scheduleCalendarItemState?.mode === 'delete'
          && scheduleCalendarItemState.item?.id === itemId
          ? scheduleCalendarItemState.item
          : null
        if (!item) return
        const result = await writeC57CalendarNotesCommand(buildC57ArchiveCalendarItemCommand(item), {
          reason: 'calendar-item-archive',
        })
        scheduleCalendarItemState = result.ok
          ? null
          : { ...scheduleCalendarItemState, errors: { form: result.error || getC57OutcomeMessage(result.outcome_code) } }
        render()
        return
      }

      if (action === 'select-color') {
        if (!scheduleCalendarItemState || !['create', 'edit'].includes(scheduleCalendarItemState.mode)) {
          return
        }

        const colorKey = button.dataset.centerCalendarColorKey || getDefaultCenterCalendarColorKeyForType(
          scheduleCalendarItemState.values.itemType,
        )
        scheduleCalendarItemState = {
          ...scheduleCalendarItemState,
          values: {
            ...scheduleCalendarItemState.values,
            colorKey,
            colorOverridden: true,
          },
          errors: {
            ...scheduleCalendarItemState.errors,
            colorKey: undefined,
          },
        }
        updateCenterCalendarPaletteDom(colorKey, true)
        return
      }

      if (action === 'reset-color') {
        if (!scheduleCalendarItemState || !['create', 'edit'].includes(scheduleCalendarItemState.mode)) {
          return
        }

        const colorKey = getDefaultCenterCalendarColorKeyForType(scheduleCalendarItemState.values.itemType)
        scheduleCalendarItemState = {
          ...scheduleCalendarItemState,
          values: {
            ...scheduleCalendarItemState.values,
            colorKey,
            colorOverridden: false,
          },
          errors: {
            ...scheduleCalendarItemState.errors,
            colorKey: undefined,
          },
        }
        updateCenterCalendarPaletteDom(colorKey, false)
        return
      }

      if (action === 'detail') {
        openCenterCalendarItemDetail(button.dataset.centerCalendarItemId)
        return
      }

      if (action === 'detail-series') {
        openCenterCalendarOccurrenceDetail(
          button.dataset.centerCalendarMasterId,
          button.dataset.centerCalendarOccurrenceDate,
        )
        return
      }

      if (action === 'edit-series') {
        openCenterCalendarSeriesEdit(
          button.dataset.centerCalendarMasterId,
          button.dataset.centerCalendarOccurrenceDate,
        )
        return
      }

      if (action === 'edit') {
        const item = getCurrentCenterCalendarItem(button.dataset.centerCalendarItemId)

        if (!item) {
          scheduleCalendarItemState = null
          render()
          return
        }

        scheduleFormState = null
        resetScheduleReportPanels()
        scheduleCalendarItemState = createEditCenterCalendarItemFormState(item)
        render()
        return
      }

      if (action === 'confirm-series-delete') {
        openCenterCalendarSeriesDelete(
          button.dataset.centerCalendarMasterId,
          button.dataset.centerCalendarOccurrenceDate,
        )
        return
      }

      if (action === 'confirm-delete') {
        const item = getCurrentCenterCalendarItem(button.dataset.centerCalendarItemId)

        if (!item) {
          scheduleCalendarItemState = null
          render()
          return
        }

        scheduleCalendarItemState = createCenterCalendarItemDeleteState(item)
        render()
        return
      }

      if (action === 'delete-series') {
        const requestedMasterId = button.dataset.centerCalendarMasterId
        const masterItem = scheduleCalendarItemState?.mode === 'seriesDelete'
          && scheduleCalendarItemState.item?.id === requestedMasterId
          ? scheduleCalendarItemState.item
          : null

        if (!masterItem) {
          scheduleCalendarItemState = {
            ...scheduleCalendarItemState,
            errors: { form: 'Chuỗi hoạt động không còn tồn tại trong cơ sở hiện tại.' },
          }
          render()
          return
        }

        const result = await writeC57CalendarNotesCommand(buildC57ArchiveCalendarItemCommand(masterItem), {
          reason: 'calendar-series-archive',
        })
        scheduleCalendarItemState = result.ok
          ? null
          : { ...scheduleCalendarItemState, errors: { form: result.error || getC57OutcomeMessage(result.outcome_code) } }
        render()
        return
      }

      if (action === 'delete') {
        return
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
        const occurrence = getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate, classSessions).find(
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
    const updateAdminAttendanceStatus = () => {
      updateScheduleAdminAttendanceRow(control.dataset.adminAttendanceStudentId, {
        attendanceStatus: control.value,
      })
      render()
    }

    control.addEventListener(control.tagName === 'BUTTON' ? 'click' : 'change', updateAdminAttendanceStatus)
  })

  document.querySelectorAll('[data-admin-attendance-note]').forEach((control) => {
    control.addEventListener('input', () => {
      updateScheduleAdminAttendanceRow(control.dataset.adminAttendanceStudentId, {
        note: control.value,
      })
    })
  })

  document.querySelectorAll('[data-admin-attendance-action]').forEach((button) => {
    button.addEventListener('click', async () => {
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

        const candidate = upsertAdminAttendanceRecords({
          records: loadStoredAttendanceRecords(getCurrentResolvedCenterId()),
          inputs,
          byName: 'Admin cơ sở',
        })

        const result = await writeC52AttendanceSessionReportThroughCloud({
          attendanceRecords: candidate.savedRecords,
          reason: 'admin-attendance-save',
        })
        if (!result.ok) {
          scheduleAdminAttendanceState = {
            ...scheduleAdminAttendanceState,
            error: result.error || 'Chưa lưu được điểm danh. Thông tin bạn nhập vẫn được giữ nguyên.',
            saveState: '',
          }
          render()
          return
        }
        const committedRecords = result.projection?.attendanceRecords
          || loadStoredAttendanceRecords(getCurrentResolvedCenterId())
        scheduleAdminAttendanceState = {
          ...createScheduleAdminAttendanceState(occurrence, committedRecords),
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

  document.querySelector('[data-schedule-action="save-attendance"]')?.addEventListener('click', async () => {
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

    const result = await writeC52AttendanceSessionReportThroughCloud({
      attendanceRecords: teacherAttendanceResult.savedRecords,
      sessionReports: [savedReport],
      reason: 'teacher-session-report-attendance',
    })
    if (!result.ok) {
      sessionReportAttendanceState = {
        ...sessionReportAttendanceState,
        error: result.error || 'Chưa lưu được báo cáo buổi học. Thông tin bạn nhập vẫn được giữ nguyên.',
        saveState: '',
      }
      render()
      return
    }
    const committedReport = findSessionReport(
      sessionReports,
      savedReport.sessionId,
      savedReport.occurrenceDate,
    ) || savedReport
    sessionReportAttendanceState = {
      ...sessionReportAttendanceState,
      attendance: committedReport.attendance,
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

  document.querySelector('[data-session-guest-form]')?.addEventListener('submit', async (event) => {
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

    const result = await writeC52AttendanceSessionReportThroughCloud({
      sessionReports: [savedReport],
      reason: 'session-report-guest-add',
    })
    if (!result.ok) {
      sessionReportAttendanceState = {
        ...sessionReportAttendanceState,
        error: result.error || 'Chưa lưu được thông tin khách học. Thông tin bạn nhập vẫn được giữ nguyên.',
        saveState: '',
      }
      render()
      return
    }
    sessionReportAttendanceState = {
      ...nextAttendanceState,
      guestParticipants: savedReport.guestParticipants,
    }
    sessionReportGuestFormState = null
    render()
  })

  document.querySelectorAll('[data-session-guest-action="delete"]').forEach((button) => {
    button.addEventListener('click', async () => {
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

      const result = await writeC52AttendanceSessionReportThroughCloud({
        sessionReports: [savedReport],
        reason: 'session-report-guest-delete',
      })
      if (!result.ok) {
        sessionReportAttendanceState = {
          ...sessionReportAttendanceState,
          error: result.error || 'Chưa lưu được thay đổi khách học. Thông tin bạn nhập vẫn được giữ nguyên.',
          saveState: '',
        }
        render()
        return
      }
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
    button.addEventListener('click', async () => {
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

      const result = await writeC52AttendanceSessionReportThroughCloud({
        sessionReports: [savedReport],
        reason: 'session-report-learning-delete',
      })
      if (!result.ok) {
        sessionReportLearningState = {
          ...sessionReportLearningState,
          error: result.error || 'Chưa lưu được nội dung buổi học. Thông tin bạn nhập vẫn được giữ nguyên.',
          saveState: '',
        }
        render()
        return
      }
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

  document.querySelector('[data-session-learning-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (!scheduleReportState || !sessionReportLearningState || !sessionReportLearningFormState) {
      return
    }

    const occurrence = getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate, classSessions).find(
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

    const result = await writeC52AttendanceSessionReportThroughCloud({
      sessionReports: [savedReport],
      reason: 'session-report-learning-save',
    })
    if (!result.ok) {
      sessionReportLearningState = {
        ...sessionReportLearningState,
        error: result.error || 'Chưa lưu được nội dung buổi học. Thông tin bạn nhập vẫn được giữ nguyên.',
        saveState: '',
      }
      render()
      return
    }
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

  document.querySelector('[data-session-report-action="save-extra"]')?.addEventListener('click', async () => {
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

    const result = await writeC52AttendanceSessionReportThroughCloud({
      sessionReports: [savedReport],
      reason: 'session-report-extra-save',
    })
    if (!result.ok) {
      sessionReportExtraState = {
        ...nextExtraState,
        error: result.error || 'Chưa lưu được thông tin báo cáo. Thông tin bạn nhập vẫn được giữ nguyên.',
        saveState: '',
      }
      render()
      return
    }
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

      if (fieldName === 'classSessionId') {
        const selectedClassSession = classSessions.find(
          (classSession) => String(classSession.id) === String(control.value),
        )

        if (selectedClassSession) {
          const classSessionDays = getScheduleDaysFromSettingsClassSession(selectedClassSession)
          nextValues.dayOfWeek = classSessionDays[0] || nextValues.dayOfWeek || 'monday'
          nextValues.startTime = selectedClassSession.startTime || ''
          nextValues.endTime = selectedClassSession.endTime || ''

          if (selectedClassSession.room && !String(nextValues.room || '').trim()) {
            nextValues.room = selectedClassSession.room
          }
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

      if (shouldRender || ['teacherId', 'scheduleType', 'classSessionId', 'date'].includes(fieldName)) {
        render()
      }
    }

    control.addEventListener('input', () => updateScheduleFormValue(false))
    control.addEventListener('change', () => updateScheduleFormValue(true))
  })

  document.querySelector('[data-schedule-action="toggle-student-picker"]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()

    const picker = event.currentTarget.closest('.schedule-student-picker')

    if (!picker) {
      return
    }

    picker.open = !picker.open
    event.currentTarget.setAttribute('aria-expanded', picker.open ? 'true' : 'false')
  })

  document.querySelectorAll('[data-schedule-student-option]').forEach((option) => {
    option.addEventListener('click', (event) => {
      if (event.target.closest('[data-schedule-student-field]')) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const checkbox = option.querySelector('[data-schedule-student-field]')

      if (!checkbox) {
        return
      }

      checkbox.checked = !checkbox.checked
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    })
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

  const getScheduleFormValuesFromDom = () => {
    const formElement = document.querySelector('[data-schedule-form]')
    const nextValues = {
      ...(scheduleFormState?.values ?? {}),
    }

    formElement?.querySelectorAll('[data-schedule-form-field]').forEach((control) => {
      const fieldName = control.dataset.scheduleFormField

      if (!fieldName) {
        return
      }

      nextValues[fieldName] = control.value
    })

    nextValues.studentIds = Array.from(
      formElement?.querySelectorAll('[data-schedule-student-field]:checked') ?? [],
    ).map((input) => input.value)

    if (nextValues.teacherId) {
      const selectedTeacher = teachers.find((teacher) => String(teacher.id) === String(nextValues.teacherId))

      if (selectedTeacher) {
        nextValues.teacherName = selectedTeacher.displayName || selectedTeacher.fullName || ''
      }
    }

    return nextValues
  }

  const handleScheduleFormSave = async (event) => {
    event?.preventDefault()

    if (!scheduleFormState) {
      return
    }

    const saveButton = event?.currentTarget?.matches?.('[data-schedule-action="save-form"]')
      ? event.currentTarget
      : document.querySelector('[data-schedule-action="save-form"]')

    if (saveButton?.disabled) {
      return
    }

    if (saveButton) {
      saveButton.disabled = true
      saveButton.setAttribute('aria-busy', 'true')
      saveButton.textContent = 'Đang lưu...'
    }

    const formValues = getScheduleFormValuesFromDom()
    const isManualScheduleCreate = scheduleFormState.mode === 'create'

    if (isManualScheduleCreate && formValues.scheduleType === 'recurring') {
      scheduleFormState = {
        ...scheduleFormState,
        values: formValues,
        errors: {
          form: 'Lich co dinh duoc tao o Cai dat co so. Vui long tao ca hoc/lop tai Cai dat co so truoc.',
        },
      }
      render()
      return
    }

    const errors = validateScheduleForm(formValues, classSessions)

    if (Object.keys(errors).length) {
      scheduleFormState = {
        ...scheduleFormState,
        values: formValues,
        errors,
      }
      render()
      return
    }

    let savedScheduleSession = null
    const command = prepareAuthoritativeCoreFormCommand({
      formState: scheduleFormState,
      formValues,
      localIdPrefix: 'schedule',
      createIdempotencyKey: createCoreCommandIdempotencyKey,
    })
    const { commandIdempotencyKey, commandLocalId, commandCreatedAt } = command
    scheduleFormState = command.formState

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
        formValues,
        existingSession,
        teachers,
        classSessions,
      )
      savedScheduleSession = updatedSession
    } else {
      const createdSession = buildScheduleSessionFromForm(formValues, null, teachers, classSessions)
      savedScheduleSession = { ...createdSession, id: commandLocalId, createdAt: commandCreatedAt }
    }

    const result = await commitScheduleSessionProjection(
      savedScheduleSession,
      'schedule-save',
      commandIdempotencyKey,
    )

    if (!result.ok) {
      scheduleFormState = {
        ...scheduleFormState,
        values: formValues,
        errors: { form: result.error || 'Buổi học chưa được lưu.' },
      }
      render()
      return
    }

    scheduleFormState = null
    scheduleReportState = null
    sessionReportAttendanceState = null
    sessionReportLearningState = null
    sessionReportLearningFormState = null
    sessionReportExtraState = null
    isSessionReportExtraExpanded = false
    sessionReportGuestFormState = null
    render()
  }

  document.querySelector('[data-schedule-form]')?.addEventListener('submit', handleScheduleFormSave)
  document.querySelector('[data-schedule-action="save-form"]')?.addEventListener('click', handleScheduleFormSave)

  document.querySelector('[data-schedule-action="delete-session"]')?.addEventListener('click', async () => {
    if (!scheduleFormState?.sessionId) {
      return
    }

    const deletedScheduleSession = scheduleSessions.find(
      (session) => session.id === scheduleFormState.sessionId,
    )
    const isOrphanFixedSchedule = isOrphanFixedScheduleRecord(
      deletedScheduleSession || scheduleFormState.values,
      classSessions,
    )
    const deletingClassSessionAssignment = Boolean(scheduleFormState.values?.classSessionId) && !isOrphanFixedSchedule
    const confirmed = window.confirm(
      deletingClassSessionAssignment
        ? 'Xóa phân công của slot này? Slot vẫn còn vì được khai báo ở Cài đặt cơ sở. Muốn xóa hẳn khung giờ, hãy xóa/ngưng ca học/lớp trong Cài đặt cơ sở.'
        : 'Xóa buổi học này khỏi lịch tuần?',
    )

    if (!confirmed) {
      return
    }

    const result = await commitScheduleSessionProjection(
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

    if (!result.ok) {
      scheduleFormState = {
        ...scheduleFormState,
        errors: { ...scheduleFormState.errors, form: result.error || 'Buổi học chưa được xóa.' },
      }
      render()
      return
    }

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

    button.addEventListener('click', async (event) => {
      event.stopPropagation()
      event.stopImmediatePropagation()
      const { studentDetailAction, studentId } = button.dataset

      if (studentDetailAction === 'open-care-notes') {
        setTimeout(() => openStudentSubWindow(studentId, 'student-care-notes'), 0)
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

        await commitStudentProjection({
          ...student,
          avatarUrl: '',
          updatedAt: new Date().toISOString(),
        }, 'student-avatar')
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
      }
      updateStudentFormSaveButton()
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

  document.querySelector('[data-student-action="open-settings-module"]')?.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
    event.stopImmediatePropagation()
  })

  document.querySelector('[data-student-action="open-settings-module"]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    textEditingActionPointerUntil = Date.now() + 180
    openModuleWindowFromChildInteraction('cai-dat-co-so')
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
    button.addEventListener('click', async () => {
      const { careNoteStudentId, careNoteId } = button.dataset

      if (!window.confirm('Xóa ghi chú chăm sóc này?')) {
        return
      }

      const student = getStudentById(careNoteStudentId)
      const nextCareNotes = (student?.careNotes ?? []).filter((note) => note.id !== careNoteId)
      const result = await commitStudentProjection({
        ...student,
        careNotes: nextCareNotes,
        latestCareNote: getLatestCareNoteContent(nextCareNotes),
        updatedAt: new Date().toISOString(),
      }, 'student-care-note')

      if (!result.ok) return

      careNoteDrafts = {
        ...careNoteDrafts,
        [careNoteStudentId]: { ...emptyCareNoteDraft },
      }
      render()
    })
  })

  document.querySelectorAll('[data-care-note-action="save"]').forEach((button) => {
    button.addEventListener('click', async () => {
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

      const student = getStudentById(studentId)
      const currentCareNotes = student?.careNotes ?? []
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
                author: cloudStatus.user?.email || 'Người dùng hiện tại',
                content,
                tags: currentDraft.tag.trim() ? [currentDraft.tag.trim()] : [],
              },
              ...currentCareNotes,
            ]

      const result = await commitStudentProjection({
        ...student,
        careNotes: nextCareNotes,
        latestCareNote: getLatestCareNoteContent(nextCareNotes),
        updatedAt: new Date().toISOString(),
      }, 'student-care-note')

      if (!result.ok) return

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

  document.querySelector('[data-student-action="save-form"]')?.addEventListener('click', async () => {
    if (studentFormState?.isSaving) {
      return
    }

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
    const command = prepareAuthoritativeCoreFormCommand({
      formState: studentFormState,
      formValues: studentFormState.values,
      localIdPrefix: 'stu',
      createIdempotencyKey: createCoreCommandIdempotencyKey,
    })
    const { commandIdempotencyKey, commandLocalId, commandCreatedAt } = command
    studentFormState = command.formState

    if (studentFormState.mode === 'edit') {
      const existingStudent = students.find((student) => student.id === studentFormState.studentId)
      const updatedStudent = buildStudentFromForm(studentFormState.values, existingStudent)
      savedStudent = updatedStudent
    } else {
      const newStudent = buildStudentFromForm(studentFormState.values)
      savedStudent = { ...newStudent, id: commandLocalId, createdAt: commandCreatedAt }
    }

    studentFormState = {
      ...studentFormState,
      isSaving: true,
    }
    render()

    const result = await commitStudentProjection(
      savedStudent,
      'student-save',
      commandIdempotencyKey,
    )

    if (!result.ok) {
      studentFormState = {
        ...studentFormState,
        isSaving: false,
        errors: {
          ...studentFormState.errors,
          form: result.userMessage || result.error || 'Học viên chưa được lưu.',
        },
      }
      render()
      return
    }

    studentFilters = {
      ...studentFilters,
      selectedStudentId: result.entity.id,
    }
    studentFormState = null
    render()
  })

  document.querySelectorAll('.student-row[data-student-id]').forEach((row) => {
    row.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
    })

    row.addEventListener('click', (event) => {
      event.stopPropagation()
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
  tuitionPeriodActionConfirmationState = null
  clearTuitionPaymentFormState()
  tuitionDetailState = null
  tuitionRollbackPreviewState = null
  tuitionCareNoteState = null
  tuitionAdvisoryWindowState = null
  render()
}

async function saveParentEnrollmentDraft(markReady = false) {
  if (!parentConsultationFormState) {
    return
  }

  parentConsultationFormState = syncParentContactWizardStep4Draft(
    collectParentContactWizardValuesFromDOM(parentConsultationFormState),
    { forceContactValues: true },
  )

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

  let command
  try {
    command = buildC53SaveCaseCommand(updatedContact, {
      appointment: findChangedTrialAppointment(existingContact, updatedContact),
    })
  } catch {
    parentConsultationFormState = {
      ...parentConsultationFormState,
      enrollmentMessage: 'Chưa thể chuẩn bị thông tin học viên dự kiến. Vui lòng kiểm tra nội dung.',
    }
    render()
    return
  }
  const result = await writeC53CrmCommand(command, {
    reason: markReady ? 'mark-trial-ready' : 'save-enrollment-draft',
  })
  if (!result.ok) {
    parentConsultationFormState = {
      ...parentConsultationFormState,
      enrollmentMessage: getParentFriendlyCrmOutcomeMessage(result),
    }
    render()
    return
  }
  const refreshedContact = parentConsultations.find((contact) => contact.id === existingContact.id)
  if (!refreshedContact) return
  parentConsultationFormState = {
    ...createEditParentContactFormState(refreshedContact),
    activeStep: parentConsultationFormState.activeStep || 4,
    scrollTop: parentConsultationFormState.scrollTop || 0,
    enrollmentMessage: markReady
      ? 'Đã đánh dấu đã hẹn học thử và cập nhật lịch hẹn.'
      : 'Đã lưu thông tin học thử và cập nhật lịch hẹn nếu có ngày học thử.',
  }
  render()
}

function findChangedTrialAppointment(existingContact = {}, nextContact = {}) {
  const nextAppointments = Array.isArray(nextContact.appointments) ? nextContact.appointments : []
  const existingAppointments = Array.isArray(existingContact.appointments) ? existingContact.appointments : []
  return nextAppointments.find((appointment) => {
    if (appointment.sourceType !== 'trial-booking') return false
    const existing = existingAppointments.find((item) =>
      item.id === appointment.id
      || (
        item.sourceType === 'trial-booking'
        && item.sourceDraftId
        && item.sourceDraftId === appointment.sourceDraftId
      )
    )
    return !existing || JSON.stringify({
      appointmentType: existing.appointmentType,
      scheduledAt: existing.scheduledAt,
      channel: existing.channel,
      location: existing.location,
      status: existing.status,
      note: existing.note,
      sourceType: existing.sourceType,
      sourceDraftId: existing.sourceDraftId,
    }) !== JSON.stringify({
      appointmentType: appointment.appointmentType,
      scheduledAt: appointment.scheduledAt,
      channel: appointment.channel,
      location: appointment.location,
      status: appointment.status,
      note: appointment.note,
      sourceType: appointment.sourceType,
      sourceDraftId: appointment.sourceDraftId,
    })
  }) || null
}

function collectParentContactWizardValuesFromDOM(formState) {
  if (!formState) {
    return formState
  }

  const values = { ...(formState.values ?? {}) }
  const enrollmentDraft = { ...(formState.enrollmentDraft ?? {}) }
  let hasContactValueChanges = false
  let hasEnrollmentDraftChanges = false

  document.querySelectorAll('[data-parent-contact-field]').forEach((control) => {
    const fieldName = control.dataset.parentContactField

    if (!fieldName || !('value' in control)) {
      return
    }

    const fieldValue = fieldName === 'studentBirthYear'
      ? control.value.replace(/\D/g, '').slice(0, 4)
      : control.value

    values[fieldName] = fieldValue
    hasContactValueChanges = true

    if (fieldName === 'studentBirthYear') {
      values.leadStudentAge = calculateParentContactAgeFromBirthYear(fieldValue)
    }
  })

  document.querySelectorAll('[data-parent-enrollment-field]').forEach((control) => {
    const fieldName = control.dataset.parentEnrollmentField

    if (!fieldName || !('value' in control)) {
      return
    }

    const fieldValue = fieldName === 'studentBirthYear'
      ? control.value.replace(/\D/g, '').slice(0, 4)
      : control.value

    enrollmentDraft[fieldName] = fieldValue
    hasEnrollmentDraftChanges = true

    if (fieldName === 'studentBirthYear') {
      enrollmentDraft.studentAge = calculateParentContactAgeFromBirthYear(fieldValue)
    }
  })

  if (!hasContactValueChanges && !hasEnrollmentDraftChanges) {
    return formState
  }

  return {
    ...formState,
    values,
    enrollmentDraft,
  }
}

function syncParentContactWizardStep4Draft(formState, options = {}) {
  if (!formState || Number(formState.activeStep) !== 4) {
    return formState
  }

  const forceContactValues = options.forceContactValues !== false
  const draft = formState.enrollmentDraft ?? {}
  const values = formState.values ?? {}
  const syncedDraft = createEnrollmentDraftFromContact({
    ...values,
    enrollmentDraft: draft,
  })
  const contactStudentName = values.leadStudentName || values.studentName || ''
  const contactLearningGoal = values.leadNeed || ''

  return {
    ...formState,
    enrollmentDraft: {
      ...syncedDraft,
      studentName: forceContactValues
        ? contactStudentName
        : draft.studentName || contactStudentName || syncedDraft.studentName,
      studentAge: forceContactValues
        ? values.leadStudentAge || ''
        : draft.studentAge || values.leadStudentAge || syncedDraft.studentAge,
      studentBirthYear: forceContactValues
        ? values.studentBirthYear || ''
        : draft.studentBirthYear || values.studentBirthYear || syncedDraft.studentBirthYear,
      parentName: forceContactValues
        ? values.parentName || ''
        : draft.parentName || values.parentName || syncedDraft.parentName,
      phone: forceContactValues
        ? values.phone || ''
        : draft.phone || values.phone || syncedDraft.phone,
      interestedProgram: forceContactValues
        ? values.interestedProgram || ''
        : draft.interestedProgram || values.interestedProgram || syncedDraft.interestedProgram,
      preferredSchedule: forceContactValues
        ? values.preferredSchedule || ''
        : draft.preferredSchedule || values.preferredSchedule || syncedDraft.preferredSchedule,
      learningGoal: forceContactValues
        ? contactLearningGoal
        : draft.learningGoal || contactLearningGoal || syncedDraft.learningGoal,
      advisorName: forceContactValues
        ? values.consultantName || ''
        : draft.advisorName || values.consultantName || syncedDraft.advisorName,
    },
  }
}

function createRenewedTuitionRecord(currentRecord, normalizedValues, cashflowLedger = [], centerId = '') {
  const renewedAt = new Date().toISOString()
  const currentTermNumber = currentRecord.currentTermNumber || 1
  const nextTermNumber = currentTermNumber + 1
  const currentDebtAmount = getTuitionDebtAmount(currentRecord, cashflowLedger, centerId)
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
  return {
    ...currentRecord,
    ...normalizedValues,
    paidAmount: 0,
    currentTermNumber: nextTermNumber,
    currentTermId: nextTermId,
    startedAt: renewedAt,
    payments: [],
    termHistory: [...(currentRecord.termHistory ?? []), currentTermSnapshot],
  }
}

function createTuitionPeriodConfirmationState(action, tuitionRecord, student, overrides = {}) {
  const periodId = getCurrentTuitionPeriodId(tuitionRecord)
  return {
    action,
    tuitionId: tuitionRecord.id,
    studentId: tuitionRecord.studentId,
    studentName: student?.fullName || '',
    periodId,
    periodLabel: `Kỳ ${tuitionRecord.currentTermNumber || 1}`,
    centerId: getCurrentResolvedCenterId(),
    isSaving: false,
    reasons: [],
    ...overrides,
  }
}

function getLatestTuitionRecordForCurrentCenter(tuitionId) {
  const latestTuitionRecords = getStoredTuition([])
  const tuitionRecord = latestTuitionRecords.find((record) => record.id === tuitionId)

  tuitionRecords = latestTuitionRecords
  return tuitionRecord || null
}

function getTuitionRecordCenterOwnership(tuitionRecord, centerId = getCurrentResolvedCenterId(), options = {}) {
  const normalizedCurrentCenterId = normalizeRuntimeCenterId(centerId)
  const normalizedStorageCenterId = normalizeRuntimeCenterId(getCurrentStorageCenterId())
  const fromCurrentCenterCollection = Boolean(options.fromCurrentCenterCollection)
  const recordCenterIds = [
    tuitionRecord?.centerId,
    tuitionRecord?.sourceCenterId,
    tuitionRecord?.storageCenterId,
  ]
    .map((value) => normalizeRuntimeCenterId(value))
    .filter(Boolean)
  const hasMatchingCenterId = recordCenterIds.some(
    (recordCenterId) =>
      recordCenterId === normalizedCurrentCenterId ||
      recordCenterId === normalizedStorageCenterId,
  )

  if (!tuitionRecord) {
    return {
      ok: false,
      reason: 'Không tìm thấy hồ sơ học phí mới nhất trong cơ sở hiện tại.',
      provenance: 'missing-record',
    }
  }

  if (!recordCenterIds.length) {
    return fromCurrentCenterCollection
      ? { ok: true, reason: '', provenance: 'current-center-collection-missing-center-id' }
      : {
          ok: false,
          reason: 'Hồ sơ học phí thiếu thông tin cơ sở và chưa có provenance center-scoped.',
          provenance: 'missing-center-without-provenance',
        }
  }

  if (hasMatchingCenterId) {
    return { ok: true, reason: '', provenance: 'matching-center-id' }
  }

  if (fromCurrentCenterCollection) {
    return {
      ok: true,
      reason: '',
      provenance: 'current-center-collection-legacy-center-id',
    }
  }

  return {
    ok: false,
    reason: 'Hồ sơ học phí không thuộc cơ sở hiện tại.',
    provenance: 'mismatched-center-id',
  }
}

function normalizeRuntimeCenterId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getCurrentUnifiedAttendanceRecordsForTuitionGuard(centerId = getCurrentResolvedCenterId()) {
  return buildUnifiedAttendanceRecords({
    sessionReports,
    storedRecords: loadStoredAttendanceRecords(centerId),
  })
}

function getTuitionEmptyPeriodUndoEligibility({
  tuitionRecord,
  expectedPeriodId = '',
  cashflowLedger = cashflowTransactions,
  attendanceRecords = [],
  centerId = getCurrentResolvedCenterId(),
  fromCurrentCenterCollection = false,
} = {}) {
  const reasons = []
  const periodId = tuitionRecord ? getCurrentTuitionPeriodId(tuitionRecord) : ''
  const history = Array.isArray(tuitionRecord?.termHistory) ? tuitionRecord.termHistory : []
  const previousTerm = history.length ? history[history.length - 1] : null
  const previousPeriodId = previousTerm ? getTuitionPeriodIdentity(previousTerm, tuitionRecord) : ''

  const centerOwnership = getTuitionRecordCenterOwnership(tuitionRecord, centerId, {
    fromCurrentCenterCollection,
  })
  if (!centerOwnership.ok) {
    reasons.push(centerOwnership.reason)
  }

  if (!periodId) {
    reasons.push('Kỳ hiện tại thiếu mã kỳ ổn định.')
  }

  if (expectedPeriodId && periodId && String(expectedPeriodId) !== String(periodId)) {
    reasons.push('Dữ liệu kỳ học đã thay đổi, vui lòng mở lại hồ sơ.')
  }

  if (!previousTerm || !previousPeriodId) {
    reasons.push('Không tìm thấy kỳ trước hợp lệ để phục hồi.')
  }

  if (previousPeriodId && previousPeriodId === periodId) {
    reasons.push('Kỳ hiện tại và kỳ trước bị trùng mã kỳ, cần review dữ liệu.')
  }

  if (previousTerm && !Number.isFinite(Number(previousTerm.termNumber))) {
    reasons.push('Kỳ trước thiếu số kỳ hợp lệ để phục hồi.')
  }

  if (tuitionRecord && Number(tuitionRecord.usedSessions || 0) !== 0) {
    reasons.push('Kỳ hiện tại đã có buổi học được sử dụng.')
  }

  const linkedPayments = tuitionRecord
    ? getLinkedTuitionPaymentTransactions(cashflowLedger, tuitionRecord.id, periodId, centerId)
    : []
  if (linkedPayments.length) {
    reasons.push('Kỳ hiện tại đã có giao dịch thanh toán.')
  }

  const paymentSummary = tuitionRecord
    ? buildTuitionPaymentSummary({
        tuitionRecord,
        cashflowTransactions: cashflowLedger,
        centerId,
      })
    : { paidAmount: 0, legacyPaidAmount: 0, paymentCount: 0 }
  if (paymentSummary.paidAmount > 0) {
    reasons.push('Kỳ hiện tại đã có số tiền thanh toán từ ledger.')
  }

  if (Number(tuitionRecord?.paidAmount || 0) > 0 || (Array.isArray(tuitionRecord?.payments) && tuitionRecord.payments.length)) {
    reasons.push('Kỳ hiện tại có số tiền cũ chưa được đối soát.')
  }

  const dependentTransactions = getTuitionPeriodDependencyTransactions(
    cashflowLedger,
    tuitionRecord?.id,
    periodId,
    centerId,
  )
  if (dependentTransactions.length) {
    reasons.push('Kỳ hiện tại có refund/void/reversal/correction dependency.')
  }

  const attendanceMatches = getTuitionCurrentPeriodAttendanceMatches({
    tuitionRecord,
    periodId,
    attendanceRecords,
  })
  if (attendanceMatches.length) {
    reasons.push('Kỳ hiện tại đã có dữ liệu điểm danh.')
  }

  if (previousTerm && tuitionRecord?.startedAt && previousTerm.startedAt) {
    const currentStarted = new Date(tuitionRecord.startedAt).getTime()
    const previousStarted = new Date(previousTerm.startedAt).getTime()
    if (Number.isFinite(currentStarted) && Number.isFinite(previousStarted) && currentStarted < previousStarted) {
      reasons.push('Kỳ hiện tại không được tạo sau kỳ trước, cần review dữ liệu.')
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    periodId,
    previousTerm,
    previousPeriodId,
  }
}

function getTuitionPeriodDependencyTransactions(cashflowLedger, tuitionId, periodId, centerId) {
  return (Array.isArray(cashflowLedger) ? cashflowLedger : []).filter((transaction) => {
    if (centerId && transaction.centerId && String(transaction.centerId) !== String(centerId)) {
      return false
    }

    if (String(transaction.sourceTuitionId || '') !== String(tuitionId || '')) {
      return false
    }

    const transactionPeriodId = String(transaction.sourcePeriodId || transaction.sourceTermId || '')
    if (transactionPeriodId !== String(periodId || '')) {
      return false
    }

    const dependencyText = [
      transaction.status,
      transaction.sourceType,
      transaction.type,
      transaction.note,
    ].join(' ').toLowerCase()

    return /(refund|refunded|void|voided|reversal|reversed|correction|corrected)/.test(dependencyText)
  })
}

function getTuitionCurrentPeriodAttendanceMatches({ tuitionRecord, periodId, attendanceRecords }) {
  if (!tuitionRecord || !periodId) {
    return []
  }

  const currentStartedDate = String(tuitionRecord.startedAt || '').slice(0, 10)

  return (Array.isArray(attendanceRecords) ? attendanceRecords : []).filter((record) => {
    if (String(record?.studentId || '') !== String(tuitionRecord.studentId || '')) {
      return false
    }

    const creditValue = Number(record?.creditValue ?? 0)
    const counted =
      record?.counted ||
      (record?.countsTowardTuition !== false && Number.isFinite(creditValue) && creditValue > 0)
    if (!counted) {
      return false
    }

    const recordPeriodId = String(record?.tuitionTermId || record?.termId || record?.packageId || '').trim()
    if (recordPeriodId) {
      return recordPeriodId === String(periodId)
    }

    const recordDate = String(record?.date || record?.occurrenceDate || '').slice(0, 10)
    return Boolean(currentStartedDate && recordDate && recordDate >= currentStartedDate)
  })
}

function restorePreviousTuitionPeriod(currentRecord, previousTerm, restoredAt = new Date().toISOString()) {
  const previousPeriodId = getTuitionPeriodIdentity(previousTerm, currentRecord)
  const remainingHistory = (currentRecord.termHistory || []).filter(
    (term) => getTuitionPeriodIdentity(term, currentRecord) !== previousPeriodId,
  )

  return {
    ...currentRecord,
    packageName: previousTerm.packageName,
    totalSessions: previousTerm.totalSessions,
    usedSessions: previousTerm.usedSessions,
    hasTotalSessionsData: previousTerm.hasTotalSessionsData ?? currentRecord.hasTotalSessionsData,
    hasUsedSessionsData: previousTerm.hasUsedSessionsData ?? currentRecord.hasUsedSessionsData,
    totalAmount: previousTerm.totalAmount,
    discountType: previousTerm.discountType,
    discountValue: previousTerm.discountValue,
    discountAmount: previousTerm.discountAmount,
    paidAmount: previousTerm.paidAmount ?? 0,
    dueDate: previousTerm.dueDate || '',
    note: previousTerm.note || '',
    payments: previousTerm.payments ?? [],
    currentTermNumber: previousTerm.termNumber || currentRecord.currentTermNumber,
    currentTermId: previousPeriodId,
    startedAt: previousTerm.startedAt || currentRecord.startedAt || '',
    termHistory: remainingHistory,
    updatedAt: restoredAt,
  }
}

async function undoEmptyTuitionPeriodFromConfirmation() {
  const confirmation = tuitionPeriodActionConfirmationState
  if (!confirmation || confirmation.action !== 'undo-empty-period') {
    return
  }

  if (!areModuleActionUpstreamsCurrent('hoc-phi', 'collected-balance')) {
    tuitionPeriodActionConfirmationState = {
      ...confirmation,
      isSaving: false,
      reasons: ['Chưa tải được số đã thu hiện tại. Vui lòng bấm Làm mới rồi thử lại.'],
    }
    render()
    return
  }

  if (!isModuleUpstreamCurrent('hoc-phi', 'attendance')) {
    tuitionPeriodActionConfirmationState = {
      ...confirmation,
      isSaving: false,
      reasons: ['Chưa tải được dữ liệu điểm danh để kiểm tra kỳ học. Vui lòng bấm Làm mới rồi thử lại.'],
    }
    render()
    return
  }

  const centerId = getCurrentResolvedCenterId()
  if (confirmation.centerId && confirmation.centerId !== centerId) {
    tuitionPeriodActionConfirmationState = {
      ...confirmation,
      isSaving: false,
      reasons: ['Cơ sở hiện tại đã thay đổi, vui lòng mở lại hồ sơ.'],
    }
    render()
    return
  }

  const latestTuitionRecords = getStoredTuition([])
  const currentRecord = latestTuitionRecords.find((record) => record.id === confirmation.tuitionId)
  const latestCashflowTransactions = readLatestCashflowTransactionsForCurrentCenter(centerId)
  const eligibility = getTuitionEmptyPeriodUndoEligibility({
    tuitionRecord: currentRecord,
    expectedPeriodId: confirmation.periodId,
    cashflowLedger: latestCashflowTransactions,
    attendanceRecords: getCurrentUnifiedAttendanceRecordsForTuitionGuard(centerId),
    centerId,
    fromCurrentCenterCollection: true,
  })

  tuitionRecords = latestTuitionRecords
  cashflowTransactions = latestCashflowTransactions

  if (!eligibility.ok) {
    tuitionPeriodActionConfirmationState = {
      ...confirmation,
      isSaving: false,
      reasons: eligibility.reasons,
    }
    render()
    return
  }

  const commandIdempotencyKey = confirmation.commandIdempotencyKey
    || createOperationalCommandIdempotencyKey()
  const restoredRecord = confirmation.pendingAuthoritativeRecord
    || restorePreviousTuitionPeriod(
      currentRecord,
      eligibility.previousTerm,
      new Date().toISOString(),
    )
  tuitionPeriodActionConfirmationState = {
    ...confirmation,
    isSaving: true,
    commandIdempotencyKey,
    pendingAuthoritativeRecord: restoredRecord,
    reasons: [],
  }
  render()

  const result = await writeC52TuitionRecordPackageThroughCloud(restoredRecord, 'tuition-package-save', {
    beforePayload: currentRecord ? { ...currentRecord } : null,
  }, commandIdempotencyKey)
  if (!result.ok) {
    tuitionPeriodActionConfirmationState = {
      ...confirmation,
      isSaving: false,
      reasons: [result.error || 'Không thể hoàn tác kỳ học phí trên server.'],
    }
    render()
    return
  }
  tuitionFormState = null
  clearTuitionPaymentFormState()
  tuitionPeriodActionConfirmationState = null
  tuitionDetailState = restoredRecord.studentId
    ? { studentId: restoredRecord.studentId }
    : tuitionDetailState
  render()
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

  if (!notification || !isProductionModuleAvailable(notification.sourceModule)) {
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

function normalizeParentStudentPickerSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getParentStudentPickerMatches(searchValue) {
  const normalizedSearch = normalizeParentStudentPickerSearch(searchValue)
  const activeStudents = students.filter((student) => !student.isDeleted)

  return (normalizedSearch
    ? activeStudents.filter((student) =>
        [student.fullName, student.parentName, student.phone].some((value) =>
          normalizeParentStudentPickerSearch(value).includes(normalizedSearch),
        ),
      )
    : activeStudents
  ).slice(0, 8)
}

function renderParentStudentPickerResultButton(student, selectedStudentId) {
  const contactInfo = [student.parentName, student.phone].filter(Boolean).join(' · ')
  const isSelected = student.id === selectedStudentId

  return `
    <button
      type="button"
      class="parent-student-picker-result ${isSelected ? 'is-selected' : ''}"
      data-parent-student-select-id="${escapeAttribute(student.id)}"
      data-parent-student-name="${escapeAttribute(student.fullName || '')}"
    >
      <strong>${escapeHtml(student.fullName)}</strong>
      <span>${escapeHtml(contactInfo || 'Chưa có thông tin liên hệ')}</span>
    </button>
  `
}

function renderParentStudentPickerResults(searchValue) {
  const resultsElement = document.querySelector('[data-parent-student-picker-results]')

  if (!resultsElement || !parentConsultationFormState) {
    return
  }

  const matches = getParentStudentPickerMatches(searchValue)
  const selectedStudentId = parentConsultationFormState.values?.studentId || ''

  resultsElement.innerHTML = matches.length
    ? matches.map((student) => renderParentStudentPickerResultButton(student, selectedStudentId)).join('')
    : '<div class="parent-student-picker-empty">Không tìm thấy học viên phù hợp.</div>'
}

function setParentStudentPickerSearchValue(value) {
  const input = document.querySelector('[data-parent-student-search-input]')

  if (input) {
    input.value = value || ''
  }
}

function renderParentStudentPickerSelection(student) {
  const picker = document.querySelector('[data-parent-student-picker]')

  if (!picker) {
    return
  }

  picker.querySelector('[data-parent-student-selected]')?.remove()

  if (!student) {
    return
  }

  const selectedElement = document.createElement('div')
  selectedElement.className = 'parent-student-selected'
  selectedElement.dataset.parentStudentSelected = ''
  selectedElement.innerHTML = `
    <span>${escapeHtml(student.fullName || '')}</span>
    <button type="button" data-parent-student-clear>Không chọn học viên</button>
  `

  const helperText = picker.querySelector(':scope > small')
  helperText?.insertAdjacentElement('afterend', selectedElement)
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
  const reasonWrap = document.querySelector('.student-save-button-wrap')

  if (!saveButton || !studentFormState) {
    return
  }

  const disabledReason = getStudentFormSaveDisabledReason(studentFormState.values)
  saveButton.disabled = Boolean(disabledReason || studentFormState.isSaving)
  saveButton.removeAttribute('aria-describedby')

  if (reasonWrap) {
    reasonWrap.title = disabledReason
  }
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

function getScrollableTuitionElements(anchorElement = null) {
  const elements = new Set()
  const selectors = [
    '.window-content',
    '.tuition-module',
    '.tuition-module-content',
    '.tuition-table-wrap',
    '.tuition-full-window-panel',
    '.tuition-full-window-body',
    '.tuition-care-note-window',
    '.tuition-advisory-window-body',
    '.tuition-advisory-table-wrap',
    '[data-tuition-scroll-region]',
  ]

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => elements.add(element))
  })

  let currentElement = anchorElement
  while (currentElement && currentElement !== document.body) {
    if (currentElement instanceof HTMLElement) {
      const style = window.getComputedStyle(currentElement)
      const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY) && currentElement.scrollHeight > currentElement.clientHeight
      const canScrollX = /(auto|scroll|overlay)/.test(style.overflowX) && currentElement.scrollWidth > currentElement.clientWidth

      if (canScrollY || canScrollX) {
        elements.add(currentElement)
      }
    }

    currentElement = currentElement.parentElement
  }

  return [...elements]
}

function captureTuitionViewportState(anchorElement = null) {
  return {
    windowX: window.scrollX,
    windowY: window.scrollY,
    activeSelector: getStableElementSelector(document.activeElement),
    scrollPositions: getScrollableTuitionElements(anchorElement).map((element) => ({
      selector: getStableElementSelector(element),
      element,
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
    })),
  }
}

function restoreTuitionViewportState(viewportState) {
  if (!viewportState) {
    return
  }

  viewportState.scrollPositions.forEach((item) => {
    const element = item.selector ? document.querySelector(item.selector) : item.element

    if (!element) {
      return
    }

    element.scrollTop = item.scrollTop
    element.scrollLeft = item.scrollLeft
  })

  window.scrollTo(viewportState.windowX, viewportState.windowY)

  if (viewportState.activeSelector) {
    focusElementWithoutScrolling(document.querySelector(viewportState.activeSelector))
  }
}

function restoreTuitionViewportStateAfterRender(viewportState) {
  restoreTuitionViewportState(viewportState)

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      restoreTuitionViewportState(viewportState)
      window.requestAnimationFrame(() => {
        restoreTuitionViewportState(viewportState)
        window.requestAnimationFrame(() => restoreTuitionViewportState(viewportState))
      })
    })
    return
  }

  setTimeout(() => restoreTuitionViewportState(viewportState), 0)
}

function withTuitionViewportLock(action, event) {
  event?.preventDefault?.()
  event?.stopPropagation?.()

  const target = event?.currentTarget || event?.target || null
  const viewportState = captureTuitionViewportState(target instanceof HTMLElement ? target : null)

  const result = action()
  if (result && typeof result.finally === 'function') {
    return result.finally(() => restoreTuitionViewportStateAfterRender(viewportState))
  }
  restoreTuitionViewportStateAfterRender(viewportState)
  return result
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
        visibleScheduleSessions: getVisibleScheduleSessions(scheduleSessions, scheduleWeekStartDate, classSessions),
      }),
  }
}

installManualCloudBackfillHelpers()
installTextEditingRenderProtection()
applyUiTheme()
render()
initializeSupabaseAuth()

window.addEventListener('hashchange', () => {
  render()
})

if (window.__ichessClockTimer) {
  clearInterval(window.__ichessClockTimer)
}

window.__ichessClockTimer = setInterval(updateClock, 1000)
