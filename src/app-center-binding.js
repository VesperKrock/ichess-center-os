import { CURRENT_CENTER_ID } from './supabase-auth.js'

export function getDefaultAppCenter() {
  return {
    id: CURRENT_CENTER_ID,
    name: 'DreamHome',
    source: 'single-center-default',
  }
}

export function resolveAppCenterBinding(authState) {
  const defaultCenter = getDefaultAppCenter()
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

  if (!defaultCenter.id) {
    return {
      status: 'error',
      currentCenterId: '',
      centerName: '',
      source: 'missing-default-center',
      message: 'Không thể xác định cơ sở cho tài khoản này. Vui lòng liên hệ quản trị viên.',
    }
  }

  return {
    status: 'bound',
    currentCenterId: defaultCenter.id,
    centerName: defaultCenter.name,
    source: 'single-center-fallback',
    message: '',
  }
}

export function isCenterBindingReady(bindingState) {
  return bindingState?.status === 'bound' && Boolean(bindingState.currentCenterId)
}
