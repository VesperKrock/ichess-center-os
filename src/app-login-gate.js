import { isCenterBindingReady } from './app-center-binding.js'

export function isDashboardUnlockedByAuth(status) {
  return status.authStatus === 'signed-in' && Boolean(status.user)
}

export function isDashboardUnlockedByCenter(status, bindingState) {
  return isDashboardUnlockedByAuth(status) && isCenterBindingReady(bindingState)
}
