export const MODULE_AUTHORITY_REGISTRY = Object.freeze([
  entry('hoc-vien', ['C5.1 Core Student'], ['C5.1 Teacher/Class references'], ['core-student']),
  entry('khach-hang-tu-van', ['C5.3 CRM', 'Parent/Student operational links'], ['C5.1 Student reference'], ['core', 'crm', 'parent-links']),
  entry(
    'giao-vien',
    ['C5.1 Core Teacher'],
    ['C5.1 Schedule', 'C5.2 Session Report', 'C5.5 Staff link'],
    ['core'],
    ['attendance', 'staff'],
  ),
  entry('nhan-vien', ['C5.5 Staff/HR'], ['C5.1 Teacher/Schedule', 'C5.2 Attendance/Session Report'], ['staff', 'core', 'attendance']),
  entry(
    'thoi-khoa-bieu',
    ['C5.1 Schedule/Class', 'C5.7 custom Calendar'],
    ['C5.2 Attendance/Session Report', 'derived conflict/recurrence'],
    ['core'],
    ['attendance', 'calendar-notes'],
  ),
  entry(
    'hoc-phi',
    ['C5.2 Tuition'],
    ['C5.1 Student', 'C5.2 Attendance', 'C5.4 Finance ledger', 'C5.7 manual advisory'],
    ['core', 'tuition'],
    ['attendance', 'calendar-notes'],
    {
      payment: ['finance'],
      'collected-balance': ['finance'],
    },
  ),
  entry('nhom-tai-chinh', [], ['C5.4 Finance/Cashbook wrapper'], ['finance']),
  entry('thu-chi', ['C5.4 Finance'], [], ['finance']),
  entry('so-quy', ['C5.4 Cashbook'], ['C5.4 Finance ledger'], ['finance']),
  entry(
    'kho-hang',
    ['C5.6 Inventory'],
    ['C5.1 Student reference'],
    ['inventory'],
    ['core'],
    { 'student-link': ['core'] },
  ),
  entry('bao-cao', [], ['C5.1 Student', 'C5.2 Attendance', 'C5.4 Finance'], ['core', 'attendance', 'finance']),
  entry('cai-dat-co-so', [], ['canonical active center', 'C5.1 Class/Student', 'C5.2 Tuition packages'], ['core', 'tuition']),
  entry(
    'bang-diem-danh',
    [],
    ['C5.1 Student/Class/Schedule', 'C5.2 Attendance/Baseline/Session Report/Tuition', 'C5.7 manual notes'],
    ['core', 'attendance'],
    ['tuition', 'calendar-notes'],
  ),
  Object.freeze({
    moduleId: 'dang-cap-nhat',
    business: false,
    authoritativeSources: Object.freeze([]),
    derivedSources: Object.freeze([]),
    remainingLocalState: 'TRANSIENT_VIEW_STATE_ONLY',
    requiredRefreshUpstreams: Object.freeze([]),
    optionalRefreshUpstreams: Object.freeze([]),
    actionRequiredUpstreams: Object.freeze({}),
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

export function getModuleRefreshContract(moduleId) {
  const entryValue = getModuleAuthorityEntry(moduleId)
  if (!entryValue) {
    return {
      required: [],
      optional: [],
      actionRequired: {},
      all: [],
    }
  }

  return {
    required: [...entryValue.requiredRefreshUpstreams],
    optional: [...entryValue.optionalRefreshUpstreams],
    actionRequired: Object.fromEntries(
      Object.entries(entryValue.actionRequiredUpstreams)
        .map(([action, upstreams]) => [action, [...upstreams]]),
    ),
    all: [...entryValue.refreshUpstreams],
  }
}

export function getModuleActionRequiredUpstreams(moduleId, action) {
  return [...(getModuleAuthorityEntry(moduleId)?.actionRequiredUpstreams?.[action] || [])]
}

export const MODULE_UPSTREAM_UI_STATE = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  FAILED: 'failed',
})

const UNAVAILABLE_CALENDAR_NOTES_OUTCOMES = new Set([
  'BACKEND_NOT_DEPLOYED',
  'SCHEMA_NOT_READY',
  'PGRST202',
  'PGRST205',
  '42P01',
  '42883',
])

export function createLoadingModuleUpstreamHealth(upstreams = []) {
  return Object.fromEntries((Array.isArray(upstreams) ? upstreams : []).map((upstream) => [upstream, {
    ok: false,
    outcomeCode: 'PENDING',
    status: MODULE_UPSTREAM_UI_STATE.LOADING,
  }]))
}

export function applyModuleUpstreamRefreshResult(refreshState = {}, result = {}) {
  const upstream = String(result?.upstream || '')
  if (!upstream || !Array.isArray(refreshState.upstreams) || !refreshState.upstreams.includes(upstream)) {
    return refreshState
  }

  const ok = Boolean(result?.ok)
  return {
    ...refreshState,
    upstreamHealth: {
      ...(refreshState.upstreamHealth || {}),
      [upstream]: {
        ok,
        outcomeCode: String(result?.outcome_code || (ok ? 'OK' : 'UNKNOWN_FAILURE')),
        status: ok ? MODULE_UPSTREAM_UI_STATE.READY : MODULE_UPSTREAM_UI_STATE.FAILED,
      },
    },
  }
}

export function getModuleUpstreamUiState(refreshState = {}, upstream = '') {
  const health = refreshState?.upstreamHealth?.[upstream]
  if (health?.ok || health?.status === MODULE_UPSTREAM_UI_STATE.READY) {
    return MODULE_UPSTREAM_UI_STATE.READY
  }
  if (health?.status === MODULE_UPSTREAM_UI_STATE.FAILED) {
    return MODULE_UPSTREAM_UI_STATE.FAILED
  }
  if (
    health?.status === MODULE_UPSTREAM_UI_STATE.LOADING
    || refreshState?.status === MODULE_UPSTREAM_UI_STATE.LOADING
  ) {
    return MODULE_UPSTREAM_UI_STATE.LOADING
  }
  if (!refreshState?.status || refreshState.status === MODULE_UPSTREAM_UI_STATE.IDLE) {
    return MODULE_UPSTREAM_UI_STATE.IDLE
  }
  return MODULE_UPSTREAM_UI_STATE.FAILED
}

export function isUnavailableCalendarNotesOutcome(outcomeCode = '') {
  return UNAVAILABLE_CALENDAR_NOTES_OUTCOMES.has(String(outcomeCode || '').trim().toUpperCase())
}

export function evaluateModuleRefreshResults(moduleId, results = []) {
  const contract = getModuleRefreshContract(moduleId)
  const requiredSet = new Set(contract.required)
  const health = Object.fromEntries(contract.all.map((upstream) => [upstream, {
    ok: false,
    outcomeCode: 'NOT_LOADED',
  }]))

  for (const result of Array.isArray(results) ? results : []) {
    const upstream = String(result?.upstream || '')
    if (!contract.all.includes(upstream)) continue
    health[upstream] = {
      ok: Boolean(result?.ok),
      outcomeCode: String(result?.outcome_code || (result?.ok ? 'OK' : 'UNKNOWN_FAILURE')),
    }
  }

  const requiredFailures = contract.required.filter((upstream) => !health[upstream]?.ok)
  const nonBlockingFailures = contract.all.filter(
    (upstream) => !requiredSet.has(upstream) && !health[upstream]?.ok,
  )

  return {
    ok: requiredFailures.length === 0,
    status: requiredFailures.length ? 'failed' : nonBlockingFailures.length ? 'limited' : 'fresh',
    health,
    requiredFailures,
    nonBlockingFailures,
  }
}

export function isBusinessModule(moduleId) {
  return Boolean(getModuleAuthorityEntry(moduleId)?.business)
}

function entry(
  moduleId,
  authoritativeSources,
  derivedSources,
  requiredRefreshUpstreams,
  optionalRefreshUpstreams = [],
  actionRequiredUpstreams = {},
) {
  const frozenActionRequiredUpstreams = Object.freeze(Object.fromEntries(
    Object.entries(actionRequiredUpstreams)
      .map(([action, upstreams]) => [action, Object.freeze([...upstreams])]),
  ))
  const refreshUpstreams = [
    ...requiredRefreshUpstreams,
    ...optionalRefreshUpstreams,
    ...Object.values(actionRequiredUpstreams).flat(),
  ].filter((upstream, index, source) => source.indexOf(upstream) === index)

  return Object.freeze({
    moduleId,
    business: true,
    authoritativeSources: Object.freeze(authoritativeSources),
    derivedSources: Object.freeze(derivedSources),
    remainingLocalState: 'CACHE_PROJECTION_OR_TRANSIENT_UI_ONLY',
    requiredRefreshUpstreams: Object.freeze([...requiredRefreshUpstreams]),
    optionalRefreshUpstreams: Object.freeze([...optionalRefreshUpstreams]),
    actionRequiredUpstreams: frozenActionRequiredUpstreams,
    refreshUpstreams: Object.freeze(refreshUpstreams),
    manualRefresh: true,
    sameCenter: 'AUTHORITATIVE_REFRESH',
    crossCenter: 'EXACT_CENTER_ISOLATED',
  })
}
