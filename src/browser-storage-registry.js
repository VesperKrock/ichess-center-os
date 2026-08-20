export const BROWSER_STORAGE_CLASSIFICATIONS = Object.freeze([
  'ACTIVE_AUTHORITY',
  'CACHE_PROJECTION',
  'PERSONAL_UI_STATE',
  'UNSAVED_DRAFT',
  'FIXTURE_SAMPLE',
  'REAL_LOCAL_ONLY',
  'UNCERTAIN',
  'QUARANTINED_NOT_ACTIVE',
  'DEPRECATED_EMPTY',
])

export const BROWSER_STORAGE_REGISTRY = Object.freeze([
  local('ichess-center-os:view-mode', 'PERSONAL_UI_STATE', 'Desktop display preference'),
  local('ichess-center-os:desktop-module-order', 'PERSONAL_UI_STATE', 'Desktop ordering preference'),
  center('students', 'CACHE_PROJECTION', 'C5.1 Student projection; pre-C5 bytes preserved before replacement'),
  center('classSessions', 'CACHE_PROJECTION', 'C5.1 Class projection; pre-C5 bytes preserved before replacement'),
  center('notifications', 'CACHE_PROJECTION', 'Derived notification candidates plus browser-personal read state'),
  center('notifications.version', 'CACHE_PROJECTION', 'Notification projection schema marker'),
  center('notifications.deletedIds', 'PERSONAL_UI_STATE', 'Browser/user dismissal state only'),
  center('tuition', 'CACHE_PROJECTION', 'C5.2 Tuition projection; pre-C5 bytes preserved before replacement'),
  center('teachers', 'CACHE_PROJECTION', 'C5.1 Teacher projection; pre-C5 bytes preserved before replacement'),
  center('centerStaffMembers', 'QUARANTINED_NOT_ACTIVE', 'C5.5 legacy Staff source'),
  center('centerStaffAdministrativeProfiles', 'QUARANTINED_NOT_ACTIVE', 'C5.5 legacy HR source'),
  center('centerStaffDocuments', 'QUARANTINED_NOT_ACTIVE', 'C5.5 legacy HR document metadata'),
  center('centerStaffAdministrativeAuditEvents', 'QUARANTINED_NOT_ACTIVE', 'C5.5 legacy HR audit source'),
  center('centerStaffAdministrativeRetentionPolicies', 'QUARANTINED_NOT_ACTIVE', 'C5.5 legacy HR retention source'),
  center('centerStaffAdministrativeDeletionRequests', 'QUARANTINED_NOT_ACTIVE', 'C5.5 legacy HR deletion source'),
  center('centerDepartments', 'QUARANTINED_NOT_ACTIVE', 'C5.5 legacy Department source'),
  center('schedule', 'CACHE_PROJECTION', 'C5.1 Schedule projection; pre-C5 bytes preserved before replacement'),
  center('sessionReports', 'CACHE_PROJECTION', 'C5.2 Session Report projection; pre-C5 bytes preserved before replacement'),
  center('attendanceAdvisoryNotes', 'QUARANTINED_NOT_ACTIVE', 'C5.7 legacy advisory-note source'),
  center('attendanceBoardNotes', 'QUARANTINED_NOT_ACTIVE', 'C5.7 legacy board-note source'),
  center('parentConsultations', 'QUARANTINED_NOT_ACTIVE', 'C5.3 legacy CRM source retained in place'),
  center('cashflow', 'QUARANTINED_NOT_ACTIVE', 'C5.4 legacy Finance source'),
  center('cashflowCategories', 'QUARANTINED_NOT_ACTIVE', 'C5.4 legacy Finance category source'),
  center('cashbookSettings', 'QUARANTINED_NOT_ACTIVE', 'C5.4 legacy Cashbook source'),
  center('cashbookReconciliations', 'QUARANTINED_NOT_ACTIVE', 'C5.4 legacy Cashbook reconciliation source'),
  center('inventory', 'QUARANTINED_NOT_ACTIVE', 'C5.6 legacy Inventory source'),
  center('inventoryMovements', 'QUARANTINED_NOT_ACTIVE', 'C5.6 legacy Inventory movement source'),
  center('inventoryRequests', 'QUARANTINED_NOT_ACTIVE', 'C5.6 legacy Inventory request source'),
  center('attendanceRecords', 'CACHE_PROJECTION', 'C5.2 Attendance projection; pre-C5 bytes preserved before replacement'),
  center('attendanceBaselineState', 'CACHE_PROJECTION', 'C5.2 Baseline projection; pre-C5 bytes preserved before replacement'),
  center('tuitionPackages', 'CACHE_PROJECTION', 'C5.2 Tuition package bridge projection'),
  center('centerCalendarItems', 'QUARANTINED_NOT_ACTIVE', 'C5.7 legacy Calendar item source'),
  center('centerCalendarTags', 'QUARANTINED_NOT_ACTIVE', 'C5.7 legacy Calendar tag source'),
  pattern('ichessCenterOS.c5_4.legacyFinanceSnapshot.<center>.v1', 'localStorage', 'QUARANTINED_NOT_ACTIVE', 'Recoverable C5.4 legacy snapshot'),
  pattern('ichessCenterOS.c5_5.legacyStaffHrManifest.<center>.v1', 'localStorage', 'QUARANTINED_NOT_ACTIVE', 'Metadata-only C5.5 quarantine manifest'),
  pattern('ichessCenterOS.c5_6.legacyInventoryManifest.<center>.v1', 'localStorage', 'QUARANTINED_NOT_ACTIVE', 'Metadata-only C5.6 quarantine manifest'),
  pattern('ichessCenterOS.c5_7.legacyCalendarNotesManifest.<center>.v1', 'localStorage', 'QUARANTINED_NOT_ACTIVE', 'Metadata-only C5.7 quarantine manifest'),
  pattern('ichessCenterOS.c5_closeout.legacyCoreAttendanceSnapshot.<center>.v1', 'localStorage', 'QUARANTINED_NOT_ACTIVE', 'Immutable pre-replacement C5.1/C5.2 bytes'),
  pattern('ichessCenterOS.c5_closeout.legacyCrmManifest.<center>.v1', 'localStorage', 'QUARANTINED_NOT_ACTIVE', 'Metadata-only C5.3 CRM quarantine manifest'),
  pattern('ichessCenterOS.backup.beforeCloudPull.<timestamp>', 'localStorage', 'QUARANTINED_NOT_ACTIVE', 'Bounded C5.1 pull backup'),
  pattern('ichessCenterOS.backup.beforeAttendanceRecordPull.<timestamp>', 'localStorage', 'QUARANTINED_NOT_ACTIVE', 'C5.2 Attendance pull backup'),
  pattern('ichess.crmConversionProjection.v1:<center>:<sourceRecord>', 'sessionStorage', 'CACHE_PROJECTION', 'P4B frozen server-status projection and idempotency envelope'),
])

export function countBrowserStorageClassifications(registry = BROWSER_STORAGE_REGISTRY) {
  return registry.reduce((counts, item) => {
    counts[item.classification] = (counts[item.classification] || 0) + 1
    return counts
  }, {})
}

export function assertNoBrowserBusinessAuthority(registry = BROWSER_STORAGE_REGISTRY) {
  const active = registry.filter((item) => item.classification === 'ACTIVE_AUTHORITY')
  return { ok: active.length === 0, active }
}

function local(keyPattern, classification, purpose) {
  return pattern(keyPattern, 'localStorage', classification, purpose)
}

function center(scope, classification, purpose) {
  return pattern(`ichessCenterOS.${scope}.<center>`, 'localStorage', classification, purpose)
}

function pattern(keyPattern, storage, classification, purpose) {
  if (!BROWSER_STORAGE_CLASSIFICATIONS.includes(classification)) {
    throw new Error(`Invalid browser-storage classification: ${classification}`)
  }
  return Object.freeze({ keyPattern, storage, classification, purpose })
}
