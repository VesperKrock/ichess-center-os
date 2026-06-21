export const ONLINE_ACCESS_ROLES = Object.freeze({
  OWNER: 'owner',
  QTV: 'qtv',
  CENTER_ADMIN: 'center_admin',
  TEACHER: 'teacher',
  CONSULTANT: 'consultant',
  VIEWER: 'viewer',
  NONE: 'none',
  UNKNOWN: 'unknown',
})

const ROLE_ALIASES = Object.freeze({
  admin: ONLINE_ACCESS_ROLES.CENTER_ADMIN,
  centeradmin: ONLINE_ACCESS_ROLES.CENTER_ADMIN,
  center_admin: ONLINE_ACCESS_ROLES.CENTER_ADMIN,
  qtv: ONLINE_ACCESS_ROLES.QTV,
  owner: ONLINE_ACCESS_ROLES.OWNER,
  teacher: ONLINE_ACCESS_ROLES.TEACHER,
  consultant: ONLINE_ACCESS_ROLES.CONSULTANT,
  viewer: ONLINE_ACCESS_ROLES.VIEWER,
  none: ONLINE_ACCESS_ROLES.NONE,
  unknown: ONLINE_ACCESS_ROLES.UNKNOWN,
})

const CLOUD_WRITE_ROLES = Object.freeze([
  ONLINE_ACCESS_ROLES.OWNER,
  ONLINE_ACCESS_ROLES.QTV,
  ONLINE_ACCESS_ROLES.CENTER_ADMIN,
])

const CLOUD_READ_ROLES = Object.freeze([
  ...CLOUD_WRITE_ROLES,
  ONLINE_ACCESS_ROLES.TEACHER,
  ONLINE_ACCESS_ROLES.CONSULTANT,
  ONLINE_ACCESS_ROLES.VIEWER,
])

export const ONLINE_ACCESS_REASONS = Object.freeze({
  NOT_CONFIGURED: 'supabase-not-configured',
  SIGNED_OUT: 'signed-out',
  MISSING_CENTER: 'missing-center',
  MISSING_MEMBERSHIP: 'missing-membership',
  MEMBERSHIP_PATCH_REQUIRED: 'membership-sql-patch-required',
  UNKNOWN_ROLE: 'unknown-role',
  VIEWER_READ_ONLY: 'viewer-read-only',
  LIMITED_ROLE_READ_ONLY: 'limited-role-read-only',
  CLOUD_NOT_READY: 'cloud-not-ready',
  WRITE_ALLOWED: 'write-allowed',
})

export const NEEDS_MEMBERSHIP_SQL_PATCH = 'NEEDS MEMBERSHIP SQL PATCH'

export function normalizeOnlineRole(role) {
  const normalizedRole = String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (!normalizedRole) {
    return ONLINE_ACCESS_ROLES.NONE
  }

  return ROLE_ALIASES[normalizedRole] || ONLINE_ACCESS_ROLES.UNKNOWN
}

export function buildOnlineAccessState(input = {}) {
  const isSupabaseConfigured = Boolean(input.isSupabaseConfigured ?? input.cloudReady ?? false)
  const isSignedIn = Boolean(input.isSignedIn || input.user)
  const centerId = String(input.centerId ?? '').trim()
  const membership = input.membership ?? null
  const role = normalizeOnlineRole(input.role ?? membership?.role)
  const hasMembership = Boolean(membership && role !== ONLINE_ACCESS_ROLES.NONE)
  const membershipUnavailable = Boolean(
    input.needsMembershipPatch ||
      input.membershipUnavailable ||
      input.membershipError ||
      (isSignedIn && centerId && !membership),
  )
  const needsMembershipPatch = Boolean(membershipUnavailable)
  const cloudReady = Boolean(input.cloudReady ?? isSupabaseConfigured)
  const canRead = Boolean(
    isSupabaseConfigured &&
      isSignedIn &&
      centerId &&
      hasMembership &&
      CLOUD_READ_ROLES.includes(role),
  )
  const canWrite = Boolean(
    canRead &&
      cloudReady &&
      CLOUD_WRITE_ROLES.includes(role) &&
      !needsMembershipPatch,
  )
  const reason = getAccessReason({
    isSupabaseConfigured,
    isSignedIn,
    centerId,
    hasMembership,
    role,
    cloudReady,
    needsMembershipPatch,
    canWrite,
  })

  return {
    ok: canRead,
    isSupabaseConfigured,
    isSignedIn,
    centerId,
    hasMembership,
    membership,
    role,
    canRead,
    canWrite,
    readOnly: !canWrite,
    reason,
    readOnlyReason: canWrite ? '' : reason,
    needsMembershipPatch,
  }
}

export function canReadModule(accessState, moduleId) {
  const state = buildOnlineAccessState(accessState)

  if (!moduleId) {
    return state.canRead
  }

  return state.canRead
}

export function canWriteModule(accessState, moduleId) {
  return isOnlineWriteAllowed(accessState, { moduleId })
}

export function canWriteEntity(accessState, entityType) {
  return isOnlineWriteAllowed(accessState, { entityType })
}

export function getReadOnlyReason(accessState) {
  const state = buildOnlineAccessState(accessState)
  return state.canWrite ? '' : state.reason
}

export function isOnlineWriteAllowed(accessState, scope = {}) {
  const state = buildOnlineAccessState(accessState)

  if (!state.canWrite) {
    return false
  }

  if (scope.entityType) {
    return ['student', 'teacher', 'class_session'].includes(String(scope.entityType))
  }

  return true
}

export function getOnlineAccessMessage(accessState) {
  const state = buildOnlineAccessState(accessState)

  if (state.needsMembershipPatch) {
    return NEEDS_MEMBERSHIP_SQL_PATCH
  }

  const messages = {
    [ONLINE_ACCESS_REASONS.NOT_CONFIGURED]: 'Chua cau hinh Supabase Cloud.',
    [ONLINE_ACCESS_REASONS.SIGNED_OUT]: 'Vui long dang nhap Supabase truoc khi ghi cloud.',
    [ONLINE_ACCESS_REASONS.MISSING_CENTER]: 'Thieu centerId nen khong the ghi cloud.',
    [ONLINE_ACCESS_REASONS.MISSING_MEMBERSHIP]: 'Tai khoan chua co membership center_members.',
    [ONLINE_ACCESS_REASONS.UNKNOWN_ROLE]: 'Khong xac dinh duoc role nen khong ghi cloud.',
    [ONLINE_ACCESS_REASONS.VIEWER_READ_ONLY]: 'Tai khoan viewer chi duoc xem, khong duoc ghi cloud.',
    [ONLINE_ACCESS_REASONS.LIMITED_ROLE_READ_ONLY]:
      'Role teacher/consultant chua co scope ghi cloud trong C3.1.',
    [ONLINE_ACCESS_REASONS.CLOUD_NOT_READY]: 'Cloud DB chua ready nen khong ghi cloud.',
  }

  return messages[state.reason] || 'Trang thai online dang read-only.'
}

function getAccessReason({
  isSupabaseConfigured,
  isSignedIn,
  centerId,
  hasMembership,
  role,
  cloudReady,
  needsMembershipPatch,
  canWrite,
}) {
  if (!isSupabaseConfigured) {
    return ONLINE_ACCESS_REASONS.NOT_CONFIGURED
  }

  if (!isSignedIn) {
    return ONLINE_ACCESS_REASONS.SIGNED_OUT
  }

  if (!centerId) {
    return ONLINE_ACCESS_REASONS.MISSING_CENTER
  }

  if (!hasMembership) {
    return needsMembershipPatch
      ? ONLINE_ACCESS_REASONS.MEMBERSHIP_PATCH_REQUIRED
      : ONLINE_ACCESS_REASONS.MISSING_MEMBERSHIP
  }

  if (role === ONLINE_ACCESS_ROLES.UNKNOWN || role === ONLINE_ACCESS_ROLES.NONE) {
    return ONLINE_ACCESS_REASONS.UNKNOWN_ROLE
  }

  if (role === ONLINE_ACCESS_ROLES.VIEWER) {
    return ONLINE_ACCESS_REASONS.VIEWER_READ_ONLY
  }

  if (role === ONLINE_ACCESS_ROLES.TEACHER || role === ONLINE_ACCESS_ROLES.CONSULTANT) {
    return ONLINE_ACCESS_REASONS.LIMITED_ROLE_READ_ONLY
  }

  if (!cloudReady) {
    return ONLINE_ACCESS_REASONS.CLOUD_NOT_READY
  }

  return canWrite ? ONLINE_ACCESS_REASONS.WRITE_ALLOWED : ONLINE_ACCESS_REASONS.UNKNOWN_ROLE
}
