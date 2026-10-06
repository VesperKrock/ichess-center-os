import { attendanceDraftCount } from './attendance-board-editor.js'

export function discardUnsavedAttendanceChanges(draft) {
  // Preserve an in-flight/unconfirmed command and makeup retry identity.
  if (!draft || draft.saving || draft.uncertain || draft.bookingAttempt || !attendanceDraftCount(draft)) return false
  draft.changes = {}; draft.attempt = null; draft.message = ''; draft.error = ''
  return true
}

export function bindAttendanceBoardToolbar(root, { draft, model, exportReady, exportContext, renderCanonicalMatrix }) {
  if (!root) return
  root.querySelector('[data-attendance-discard]')?.addEventListener('click', () => {
    if (!root.isConnected || !discardUnsavedAttendanceChanges(draft)) return
    // Keep the existing N3 cell listeners and canonical read snapshot. Only
    // restore dirty cell presentation; a normal app render will do the same.
    const template = root.ownerDocument.createElement('template')
    template.innerHTML = renderCanonicalMatrix()
    const rows = new Map([...template.content.querySelectorAll('[data-attendance-ledger-student]')]
      .map(row => [row.dataset.attendanceLedgerStudent, row]))
    for (const cell of root.querySelectorAll('.attendance-ledger-cell.is-dirty')) {
      const row = cell.closest('[data-attendance-ledger-student]')
      const canonical = rows.get(row.dataset.attendanceLedgerStudent)?.children[cell.cellIndex]
      if (!canonical) continue
      cell.className = canonical.className
      cell.dataset.attendanceLedgerState = canonical.dataset.attendanceLedgerState
      const button = cell.querySelector('button'), original = canonical.querySelector('button')
      button.innerHTML = original.innerHTML
      for (const name of ['title', 'aria-label', 'data-attendance-editable']) button.setAttribute(name, original.getAttribute(name))
      button.disabled = original.disabled
    }
    for (const button of root.querySelectorAll('[data-attendance-save], [data-attendance-discard]')) button.disabled = true
    const message = root.querySelector('.attendance-ledger-save-message')
    if (message) { message.textContent = ''; message.classList.remove('is-error') }
    // Reuse the existing editor close/render handler if a cell is still open.
    root.querySelector('[data-attendance-editor-close]')?.click()
  })
  root.querySelector('[data-attendance-export-xlsx]')?.addEventListener('click', async event => {
    const button = event.currentTarget
    if (!exportReady || button.disabled || !root.isConnected) return
    button.disabled = true; button.setAttribute('aria-busy', 'true')
    try {
      const { generateAttendanceXlsx } = await import('./attendance-xlsx.js')
      if (!root.isConnected) return // Center/month/filter changed during import.
      const result = generateAttendanceXlsx(model, exportContext)
      const url = URL.createObjectURL(result.blob), link = root.ownerDocument.createElement('a')
      link.href = url; link.download = result.filename; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      root.querySelector('[data-attendance-export-menu]').open = false
    } catch (error) {
      if (root.isConnected) window.alert(error?.message || 'Không tạo được Excel. Vui lòng thử lại.')
    } finally {
      if (button.isConnected) { button.disabled = false; button.removeAttribute('aria-busy') }
    }
  })
  const menu = root.querySelector('[data-attendance-export-menu]')
  menu?.addEventListener('toggle', () => { if (!exportReady) menu.open = false })
  root.addEventListener('click', event => { if (menu?.open && !menu.contains(event.target)) menu.open = false })
  menu?.addEventListener('focusout', event => { if (event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false })
  menu?.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); menu.open = false; menu.querySelector('summary').focus() }
  })
  root.querySelector('.attendance-ledger-month-control')?.addEventListener('click', event => {
    const input = root.querySelector('[data-attendance-board-filter="month"]')
    if (typeof input?.showPicker !== 'function') return
    try { input.showPicker(); event.preventDefault() } catch { /* Keep the native keyboard/input fallback. */ }
  })
}
