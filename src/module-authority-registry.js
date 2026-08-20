export const MODULE_AUTHORITY_REGISTRY = Object.freeze([
  entry('hoc-vien', ['C5.1 Core Student'], ['C5.1 Teacher/Class references'], ['core-student']),
  entry('khach-hang-tu-van', ['C5.3 CRM'], ['C5.1 Student reference'], ['core', 'crm']),
  entry('giao-vien', ['C5.1 Core Teacher'], ['C5.1 Schedule', 'C5.2 Session Report', 'C5.5 Staff link'], ['core', 'attendance', 'staff']),
  entry('nhan-vien', ['C5.5 Staff/HR'], ['C5.1 Teacher/Schedule', 'C5.2 Attendance/Session Report'], ['staff', 'core', 'attendance']),
  entry('thoi-khoa-bieu', ['C5.1 Schedule/Class', 'C5.7 custom Calendar'], ['C5.2 Attendance/Session Report', 'derived conflict/recurrence'], ['core', 'attendance', 'calendar-notes']),
  entry('hoc-phi', ['C5.2 Tuition'], ['C5.1 Student', 'C5.2 Attendance', 'C5.4 Finance ledger', 'C5.7 manual advisory'], ['core', 'attendance', 'tuition', 'finance', 'calendar-notes']),
  entry('nhom-tai-chinh', [], ['C5.4 Finance/Cashbook wrapper'], ['finance']),
  entry('thu-chi', ['C5.4 Finance'], [], ['finance']),
  entry('so-quy', ['C5.4 Cashbook'], ['C5.4 Finance ledger'], ['finance']),
  entry('kho-hang', ['C5.6 Inventory'], ['C5.1 Student reference'], ['inventory', 'core']),
  entry('bao-cao', [], ['C5.1 Student', 'C5.2 Attendance', 'C5.4 Finance'], ['core', 'attendance', 'finance']),
  entry('cai-dat-co-so', [], ['canonical active center', 'C5.1 Class/Student', 'C5.2 Tuition packages'], ['core', 'tuition']),
  entry('bang-diem-danh', [], ['C5.1 Student/Class/Schedule', 'C5.2 Attendance/Baseline/Session Report/Tuition', 'C5.7 manual notes'], ['core', 'attendance', 'tuition', 'calendar-notes']),
  Object.freeze({
    moduleId: 'dang-cap-nhat',
    business: false,
    authoritativeSources: Object.freeze([]),
    derivedSources: Object.freeze([]),
    remainingLocalState: 'TRANSIENT_VIEW_STATE_ONLY',
    refreshUpstreams: Object.freeze([]),
    manualRefresh: false,
    sameCenter: 'N/A',
    crossCenter: 'N/A',
  }),
])

export function getModuleAuthorityEntry(moduleId) {
  return MODULE_AUTHORITY_REGISTRY.find((item) => item.moduleId === moduleId) || null
}

export function getModuleRefreshUpstreams(moduleId) {
  return [...(getModuleAuthorityEntry(moduleId)?.refreshUpstreams || [])]
}

export function isBusinessModule(moduleId) {
  return Boolean(getModuleAuthorityEntry(moduleId)?.business)
}

function entry(moduleId, authoritativeSources, derivedSources, refreshUpstreams) {
  return Object.freeze({
    moduleId,
    business: true,
    authoritativeSources: Object.freeze(authoritativeSources),
    derivedSources: Object.freeze(derivedSources),
    remainingLocalState: 'CACHE_PROJECTION_OR_TRANSIENT_UI_ONLY',
    refreshUpstreams: Object.freeze(refreshUpstreams),
    manualRefresh: true,
    sameCenter: 'AUTHORITATIVE_REFRESH',
    crossCenter: 'EXACT_CENTER_ISOLATED',
  })
}
