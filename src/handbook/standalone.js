// Public document entry: shares the handbook renderer; never imports app/Auth clients.
import { createHandbookState, renderHandbook, bindHandbook } from './view.js'
import { parseHandbookHash } from './content.js'
import { getHandbookTheme } from './theme.js'
import './handbook.css'
import './standalone.css'

const state = createHandbookState()
const host = document.querySelector('#handbook-reader')
function renderRoute() {
  state.route = parseHandbookHash(location.hash) || { view: 'home' }
  if (state.route.view === 'search') {
    state.query = state.route.query
    state.searchQuery = state.route.query
  }
  state.menuOpen = false
  host.dataset.handbookTheme = getHandbookTheme(state)
  host.innerHTML = renderHandbook(state)
  bindHandbook(host, state)
}
renderRoute()
window.addEventListener('hashchange', renderRoute)
window.addEventListener('popstate', renderRoute)
