import {
  buildTuitionFinalEndCycleCommand,
  buildV24PrepareNextCycleCommand,
  buildV24SelectProvisionalPackageCommand,
} from './cloud-authoritative-tuition-cycles.js'
import {
  normalizeTuitionCyclePresentation,
  validateInitialTuitionSetup,
  validateFullTuitionPayment,
  isTuitionPaymentSnapshotCurrent,
} from './tuition-module.js'

// UI drafts contain no business truth. Every command targets the exact cycle
// selected from a fresh authoritative snapshot; server versions arbitrate writes.
export function createTuitionOperatorState() {
  return {
    panel: null,
    success: null,
    message: '',
    filters: { query: '', status: 'all', package: 'all' },
  }
}

export function createTuitionOperatorController({
  state,
  getContext,
  render,
  refresh,
  writeCycle,
  preparePayment,
  writePayment,
  printTbhp,
  printReceipt,
}) {
  const uuid = () => crypto.randomUUID()
  const rowFor = (id, cycleId = '') => {
    const context = getContext()
    const student = context.students.find((s) => s.id === id)
    const cycleState = context.cycleStates.find((s) => s.studentId === id)
    return student
      ? {
          student,
          presentation: normalizeTuitionCyclePresentation({
            packageCycleState: cycleState,
            selectedCycleId: cycleId,
            packageCycleReady: context.readStatus === 'ready',
            packageCycleStatus: context.readStatus,
            receiptReady: context.receiptStatus === 'ready',
            receiptStatus: context.receiptStatus,
            receipts: context.receipts,
          }),
        }
      : null
  }
  const showError = (text) => {
    if (state.panel) state.panel.error = text
    else state.message = text
    render()
  }
  const stale =
    'Thông tin học phí vừa được cập nhật. Vui lòng mở lại form thanh toán.'
  const open = async (kind, studentId, cycleId = '') => {
    state.message = ''
    state.success = null
    if (kind === 'payment') {
      const centerId = getContext().centerId
      const result = await refresh()
      if (!result.ok || centerId !== getContext().centerId)
        return showError('Không tải được học phí. Vui lòng làm mới.')
      const row = rowFor(studentId, cycleId)
      if (!row?.presentation.canCollectPayment)
        return showError(
          'Kỳ học phí này chưa có khoản cần thanh toán. Vui lòng làm mới.',
        )
      const p = row.presentation,
        c = p.cycle
      state.panel = {
        kind,
        studentId,
        cycleId: c.id,
        centerId,
        targetCycleId: c.id,
        periodId: c.paymentPeriodId,
        targetCycleVersion: c.version,
        presentation: p,
        sourcePaymentId: `tuition-payment:${uuid()}`,
        idempotencyKey: uuid(),
        values: {
          amount: p.outstandingAmount,
          paidAt: new Date().toLocaleDateString('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
          }),
          method: 'cash',
          payerName: row.student.parentName || '',
          collectorName: getContext().collectorName || 'Admin',
          note: '',
        },
        error: '',
        busy: false,
      }
    } else {
      const row = rowFor(studentId, cycleId)
      if (!row) return
      if (['assign', 'initial'].includes(kind) && row.presentation.cycle)
        kind = 'detail'
      if (kind === 'initial' && !getContext().initialSetupEnabled) {
        state.panel = {
          kind,
          studentId,
          values: {
            packageCatalogId: '',
            usedSessions: '0',
            openingPaymentState: '',
          },
          error:
            'Bật “Thiết lập dữ liệu học viên ban đầu” trong Cài đặt cơ sở để lưu.',
          busy: false,
          idempotencyKey: uuid(),
        }
      } else
        state.panel = {
          kind,
          studentId,
          cycleId,
          values: {
            packageCatalogId: '',
            usedSessions: '0',
            openingPaymentState: '',
          },
          error: '',
          busy: false,
          idempotencyKey: uuid(),
        }
    }
    render()
  }
  const submit = async () => {
    const panel = state.panel
    if (!panel || panel.busy) return
    const context = getContext()
    if (panel.centerId && panel.centerId !== context.centerId)
      return showError('Cơ sở đã thay đổi. Vui lòng mở lại form.')
    if (context.readStatus !== 'ready')
      return showError('Không tải được học phí. Vui lòng làm mới.')
    let command
    if (panel.kind === 'assign' || panel.kind === 'initial') {
      const error = validateInitialTuitionSetup(
        panel.values,
        context.catalog,
        panel.kind === 'initial',
      )
      if (error) return showError(error)
      if (panel.kind === 'initial' && !context.initialSetupEnabled)
        return showError(
          'Bật thiết lập dữ liệu học viên ban đầu trong Cài đặt cơ sở để lưu.',
        )
      command = {
        operation: 'SETUP_INITIAL_CYCLE',
        student_id: panel.studentId,
        package_catalog_id: panel.values.packageCatalogId,
        opening_pre_ichess_sessions:
          panel.kind === 'initial' ? Number(panel.values.usedSessions) : 0,
        opening_context:
          panel.kind === 'initial' ? 'LEGACY_BEFORE_ICHESS' : 'NEW_ICHESS',
        opening_payment_state:
          panel.kind === 'initial'
            ? panel.values.openingPaymentState
            : 'UNPAID',
      }
    } else if (panel.kind === 'payment') {
      const error = validateFullTuitionPayment(
        panel.values,
        panel.presentation.outstandingAmount,
      )
      if (error) return showError(error)
      if (!panel.pendingCommand) {
        panel.busy = true
        panel.error = ''
        render()
        const result = await refresh()
        if (state.panel !== panel) return
        panel.busy = false
        if (!result.ok)
          return showError('Không tải được học phí. Vui lòng làm mới.')
        const row = rowFor(panel.studentId, panel.cycleId)
        if (!isTuitionPaymentSnapshotCurrent(panel, row?.presentation.cycle))
          return showError(stale)
        try {
          panel.pendingCommand = preparePayment(
            row.student,
            row.presentation.cycle,
            panel,
          )
        } catch {
          return showError(
            'Chưa thể ghi nhận thanh toán. Vui lòng làm mới rồi thử lại.',
          )
        }
      }
    } else return
    panel.busy = true
    panel.error = ''
    render()
    let result
    try {
      result =
        panel.kind === 'payment'
          ? await writePayment(panel.pendingCommand, panel.idempotencyKey)
          : await writeCycle(command, panel.idempotencyKey)
    } catch {
      result = { ok: false }
    }
    if (state.panel !== panel) return
    panel.busy = false
    if (!result.ok) {
      const isStale = [
        'STALE_VERSION',
        'VERSION_STALE',
        'TUITION_PERIOD_STALE',
        'TARGET_CYCLE_NOT_FOUND',
      ].includes(result.outcome_code)
      panel.error = isStale
        ? stale
        : result.outcome_code === 'CYCLE_ALREADY_STARTED'
          ? 'Học phí đã được thiết lập. Vui lòng làm mới.'
          : 'Chưa lưu được học phí. Thông tin đã nhập được giữ nguyên; vui lòng thử lại.'
      render()
      return
    }
    state.panel = {
      kind: 'detail',
      studentId: panel.studentId,
      cycleId: '',
      error: '',
      busy: false,
    }
    state.success =
      panel.kind === 'payment'
        ? {
            receiptId: result.receipt_id,
            receiptNumber: result.receipt_number || '',
            text: '✓ Đã ghi nhận thanh toán',
          }
        : {
            text:
              panel.kind === 'initial'
                ? 'Đã thiết lập học phí ban đầu.'
                : 'Đã gán gói học.',
          }
    await refresh()
    render()
  }
  const cycleAction = async (kind, studentId, cycleId, packageId = '') => {
    const row = rowFor(studentId, cycleId),
      c = row?.presentation.cycle
    if (!c) return
    let command
    if (kind === 'end') {
      if (!row.presentation.canEndCycle) return
      if (
        !window.confirm(
          `Kết thúc Kỳ ${c.cycleNumber}: giữ ${c.usedSessions} buổi đã học và ghi nhận ${c.remainingSessions} buổi hết hiệu lực?`,
        )
      )
        return
      command = buildTuitionFinalEndCycleCommand(c)
    } else if (kind === 'prepare')
      command = buildV24PrepareNextCycleCommand(c, packageId)
    else if (kind === 'change')
      command = buildV24SelectProvisionalPackageCommand(c, packageId)
    else return
    if (state.panel?.busy) return
    const pending = state.panel?.cycleCommand
    if (pending) command = pending.command
    const key = pending?.key || uuid()
    if (state.panel) {
      state.panel.cycleCommand = { key, command }
      state.panel.busy = true
    }
    render()
    let result
    try {
      result = await writeCycle(command, key)
    } catch {
      result = { ok: false }
    }
    if (state.panel) state.panel.busy = false
    if (!result.ok)
      return showError('Chưa lưu được thay đổi. Vui lòng làm mới rồi thử lại.')
    if (state.panel) state.panel.cycleCommand = null
    await refresh()
    state.success =
      kind === 'end'
        ? {
            text: `Đã kết thúc Kỳ ${c.cycleNumber}: ${c.usedSessions} đã học · ${c.remainingSessions} hết hiệu lực.`,
          }
        : null
    state.panel = {
      kind: 'detail',
      studentId,
      cycleId: kind === 'end' ? cycleId : '',
      error: '',
      busy: false,
    }
    render()
  }
  const bind = (root) => {
    root?.querySelectorAll('[data-tu-action]').forEach((button) =>
      button.addEventListener('click', async (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (
          button.classList.contains('tuition-form-backdrop') &&
          event.target !== button
        )
          return
        try {
          const action = button.dataset.tuAction,
            id = button.dataset.tuStudentId,
            cycle = button.dataset.tuCycleId || ''
          if (action === 'close') {
            if (!state.panel?.busy) state.panel = null
            render()
            return
          }
          if (action === 'dismiss-success') {
            state.success = null
            render()
            return
          }
          if (action === 'refresh') {
            await refresh()
            render()
            return
          }
          if (action === 'initial-queue') {
            state.panel = { kind: 'queue' }
            render()
            return
          }
          if (action === 'tbhp') {
            await printTbhp(cycle, button)
            return
          }
          if (action === 'receipt') {
            await printReceipt(button.dataset.tuReceiptId, button)
            return
          }
          if (['change', 'prepare', 'end'].includes(action)) {
            const packageId =
              button
                .closest('[data-tu-package-action]')
                ?.querySelector('select')?.value || ''
            if (action !== 'end' && !packageId)
              return showError('Vui lòng chọn gói học.')
            await cycleAction(action, id, cycle, packageId)
            return
          }
          await open(action, id, cycle)
        } catch {
          showError('Chưa thể thực hiện. Vui lòng làm mới rồi thử lại.')
        }
      }),
    )
    root?.querySelectorAll('[data-tu-field]').forEach((control) =>
      control.addEventListener('input', () => {
        if (!state.panel || state.panel.pendingCommand) return
        state.panel.values[control.dataset.tuField] = control.value
      }),
    )
    root?.querySelectorAll('[data-tu-filter]').forEach((control) =>
      control.addEventListener(
        control.tagName === 'SELECT' ? 'change' : 'input',
        () => {
          const field = control.dataset.tuFilter,
            start = control.selectionStart,
            end = control.selectionEnd
          state.filters[field] = control.value
          render()
          const next = document.querySelector(`[data-tu-filter="${field}"]`)
          next?.focus({ preventScroll: true })
          if (control.tagName !== 'SELECT') next?.setSelectionRange(start, end)
        },
      ),
    )
    root
      ?.querySelector('[data-tu-form]')
      ?.addEventListener('submit', (event) => {
        event.preventDefault()
        void submit().catch(() => {
          if (state.panel) state.panel.busy = false
          showError('Chưa thể lưu. Vui lòng thử lại.')
        })
      })
  }
  return { bind, open, submit }
}
