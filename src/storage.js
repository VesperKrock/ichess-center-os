const VIEW_MODE_KEY = 'ichess-center-os:view-mode'
const DESKTOP_ORDER_KEY = 'ichess-center-os:desktop-module-order'
const VALID_VIEW_MODES = ['grid', 'list']

export function getViewMode() {
  const savedMode = localStorage.getItem(VIEW_MODE_KEY)
  return VALID_VIEW_MODES.includes(savedMode) ? savedMode : 'grid'
}

export function saveViewMode(mode) {
  if (VALID_VIEW_MODES.includes(mode)) {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }
}

export function getDesktopModuleOrder(validModuleIds) {
  try {
    const savedOrder = JSON.parse(localStorage.getItem(DESKTOP_ORDER_KEY))

    if (!Array.isArray(savedOrder)) {
      return validModuleIds
    }

    const knownSavedIds = savedOrder.filter((id) => validModuleIds.includes(id))
    const newIds = validModuleIds.filter((id) => !knownSavedIds.includes(id))
    return [...knownSavedIds, ...newIds]
  } catch {
    return validModuleIds
  }
}

export function saveDesktopModuleOrder(moduleIds) {
  localStorage.setItem(DESKTOP_ORDER_KEY, JSON.stringify(moduleIds))
}
