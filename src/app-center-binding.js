import { CURRENT_CENTER_ID } from './supabase-auth.js'

export function getDefaultAppCenter() {
  return {
    id: CURRENT_CENTER_ID,
    name: 'DreamHome staging',
    source: 'single-center-default',
  }
}

export function resolveAppCenterBinding(authState) {
  const isSignedIn = authState?.authStatus === 'signed-in' && authState.user

  if (!isSignedIn) {
    return {
      status: 'signed-out',
      currentCenterId: '',
      centerName: '',
      source: 'none',
      message: '',
    }
  }

  if (authState?.membershipStatus === 'loading') {
    return {
      status: 'loading',
      currentCenterId: '',
      centerName: '',
      source: 'center-members-loading',
      message: 'Dang kiem tra co so cua tai khoan...',
    }
  }

  if (authState?.membershipStatus === 'loaded' && authState?.centerId) {
    return {
      status: 'bound',
      currentCenterId: authState.centerId,
      centerName: authState.centerName || authState.centerId,
      source: 'account-membership',
      role: authState.role ?? null,
      membership: authState.membership ?? null,
      memberships: authState.memberships ?? [],
      message: authState.message || '',
    }
  }

  if (authState?.membershipStatus === 'missing') {
    return {
      status: 'error',
      currentCenterId: '',
      centerName: '',
      source: 'missing-center-membership',
      message: authState.message ||
        'Tai khoan nay chua duoc gan co so active. Vui long lien he quan tri vien.',
    }
  }

  if (authState?.membershipStatus === 'denied') {
    return {
      status: 'denied',
      currentCenterId: authState.centerId || '',
      centerName: authState.centerName || authState.centerId || '',
      source: 'access-denied-membership',
      role: authState.role ?? null,
      membership: authState.membership ?? null,
      memberships: authState.memberships ?? [],
      deniedMemberships: authState.deniedMemberships ?? [],
      deniedReason: authState.accessDeniedReason || 'unknown',
      message: authState.message || 'Tai khoan nay chua co quyen truy cap dang hoat dong.',
    }
  }

  if (authState?.membershipStatus === 'error') {
    return {
      status: 'error',
      currentCenterId: '',
      centerName: '',
      source: 'center-members-error',
      message: authState.message || 'Khong the doc quyen center_members qua RLS.',
    }
  }

  return {
    status: 'signed-out',
    currentCenterId: '',
    centerName: getDefaultAppCenter().name,
    source: 'signed-out-default-only',
    message: '',
  }
}

export function isCenterBindingReady(bindingState) {
  return bindingState?.status === 'bound' && Boolean(bindingState.currentCenterId)
}
