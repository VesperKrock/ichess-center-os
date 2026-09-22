export const FINANCE_WORKSPACE_VIEWS = Object.freeze({
  TRANSACTIONS: 'transactions',
  CASHBOOK: 'cashbook',
})

export function normalizeFinanceWorkspaceView(view) {
  return view === FINANCE_WORKSPACE_VIEWS.CASHBOOK
    ? FINANCE_WORKSPACE_VIEWS.CASHBOOK
    : FINANCE_WORKSPACE_VIEWS.TRANSACTIONS
}

export function renderFinanceWorkspaceModule(
  activeView,
  renderTransactions,
  renderCashbook,
) {
  const normalizedView = normalizeFinanceWorkspaceView(activeView)
  const renderer = normalizedView === FINANCE_WORKSPACE_VIEWS.CASHBOOK
    ? renderCashbook
    : renderTransactions

  return typeof renderer === 'function' ? renderer() : ''
}
