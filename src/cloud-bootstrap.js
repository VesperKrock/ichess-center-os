export const CLOUD_BOOTSTRAP_ENTITY_TYPES = Object.freeze([
  'student',
  'teacher',
  'schedule_session',
])

export const CLOUD_BOOTSTRAP_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  CLOUD: 'cloud',
  EMPTY: 'empty',
  FALLBACK: 'fallback',
  ERROR: 'error',
  BLOCKED: 'blocked',
})

export function createInitialCloudBootstrapState() {
  return {
    status: CLOUD_BOOTSTRAP_STATUS.IDLE,
    source: 'local-cache',
    message: 'Dữ liệu: Cache cục bộ',
    counts: createEmptyCloudBootstrapCounts(),
    lastUpdatedAt: '',
  }
}

export function createEmptyCloudBootstrapCounts() {
  return CLOUD_BOOTSTRAP_ENTITY_TYPES.reduce((counts, entityType) => {
    counts[entityType] = 0
    return counts
  }, {})
}

export function canRunCloudBootstrap({ authStatus, user, centerBinding, configStatus } = {}) {
  return Boolean(
    authStatus === 'signed-in' &&
      user &&
      centerBinding?.status === 'bound' &&
      centerBinding.currentCenterId &&
      configStatus === 'configured',
  )
}

export function getCloudBootstrapSnapshotCounts(snapshot = {}) {
  return {
    student: Array.isArray(snapshot.students) ? snapshot.students.length : 0,
    teacher: Array.isArray(snapshot.teachers) ? snapshot.teachers.length : 0,
    schedule_session: Array.isArray(snapshot.scheduleSessions)
      ? snapshot.scheduleSessions.length
      : 0,
  }
}

export function hasCloudBootstrapSnapshotData(snapshot = {}) {
  return Object.values(getCloudBootstrapSnapshotCounts(snapshot)).some((count) => count > 0)
}

export function getCloudBootstrapStatusLabel(state = {}) {
  if (state.status === CLOUD_BOOTSTRAP_STATUS.LOADING) {
    return 'Dữ liệu: Đang tải cloud'
  }

  if (state.status === CLOUD_BOOTSTRAP_STATUS.CLOUD) {
    return 'Dữ liệu: Cloud'
  }

  if (state.status === CLOUD_BOOTSTRAP_STATUS.EMPTY) {
    return state.message || 'Dữ liệu: Cloud trống'
  }

  if (state.status === CLOUD_BOOTSTRAP_STATUS.ERROR) {
    return state.message || 'Dữ liệu: Cache cục bộ (lỗi cloud)'
  }

  return state.message || 'Dữ liệu: Cache cục bộ'
}
