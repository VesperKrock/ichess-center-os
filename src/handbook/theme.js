// A handbook preference never writes to the application's theme or business state.
export const HANDBOOK_THEME_KEY = 'ichess.handbook.theme.v1'
const validTheme = value => value === 'light' || value === 'dark'

export function readHandbookThemePreference() {
  try {
    const value = globalThis.localStorage?.getItem(HANDBOOK_THEME_KEY)
    return validTheme(value) ? value : null
  } catch { return null }
}

export function resolveHandbookTheme({ preference, appTheme, prefersDark = false } = {}) {
  return validTheme(preference) ? preference : validTheme(appTheme) ? appTheme : prefersDark ? 'dark' : 'light'
}

// Called while creating the window markup, before its first paint.
export function getHandbookTheme(state) {
  return resolveHandbookTheme({
    preference: state.themePreference,
    appTheme: globalThis.document?.documentElement.dataset.uiTheme,
    prefersDark: globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches,
  })
}

export function bindHandbookTheme(root, state) {
  const host = root.closest('.is-handbook-window')
  const content = root.querySelector('.handbook')
  const buttons = root.querySelectorAll('[data-handbook-set-theme]')
  const apply = () => {
    const theme = getHandbookTheme(state)
    if (host) host.dataset.handbookTheme = theme
    content.dataset.handbookTheme = theme
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.handbookSetTheme === theme)))
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    state.themePreference = button.dataset.handbookSetTheme
    try { globalThis.localStorage?.setItem(HANDBOOK_THEME_KEY, state.themePreference) } catch { /* Keep the choice in memory if storage is blocked. */ }
    // No render: preserve DOM, selection, drafts, article and scroll exactly.
    apply()
  }))
  const observer = new MutationObserver(apply)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ui-theme'] })
  const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
  media?.addEventListener('change', apply)
  const syncPreference = event => {
    if (event.key !== HANDBOOK_THEME_KEY && event.key !== null) return
    state.themePreference = readHandbookThemePreference()
    apply()
  }
  window.addEventListener('storage', syncPreference)
  apply()
  return () => {
    observer.disconnect()
    media?.removeEventListener('change', apply)
    window.removeEventListener('storage', syncPreference)
  }
}
