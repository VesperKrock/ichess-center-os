import { validateRecurringDiscountPolicy } from './excel-initial-baseline.js'
// One operator model: frozen cycles and issued receipts, never old metadata.
export const initialTuitionFilters = {
  query: '',
  status: 'all',
  package: 'all',
}
export const TUITION_PAYMENT_STALE_MESSAGE =
  'Thông tin học phí vừa được cập nhật. Vui lòng mở lại form thanh toán.'
function initialBaselineNotice(p) {
  const b = p.verifiedInitialBaseline
  if (!b) return ''
  const f = b.financialFacts, sourceMoney = value => value == null ? 'Chưa rõ' : money(value)
  const discount = f.discountKind === 'UNKNOWN' ? 'Chưa rõ ưu đãi' : f.discountKind === 'EXPLICIT_NONE' ? 'Nguồn ghi không ưu đãi'
    : `${f.percent}% · Giảm cố định ${money(f.fixedMinor)} · Voucher anh/chị/em ${money(f.siblingVoucherMinor)}`
  return `<span>${b.baselineUsed} buổi tại mốc ${html(b.baselineCutoffDate)} · ${b.contributedSessions} buổi thực tế sau mốc.${p.initialCycleAdopted ? ' Kỳ hiện tại đã được tiếp quản.' : ' Chưa mở kỳ hoặc ghi nhận tiền.'}</span><details class="tuition-source-financial-facts"><summary>Thông tin tài chính từ nguồn</summary><p>Giá niêm yết nguồn: ${html(sourceMoney(b.listedPriceMinor))}</p><p>Ưu đãi: ${html(discount)}</p><p>Phải thu theo nguồn: ${html(sourceMoney(f.sourceDueMinor))}</p><p>Đã thu theo nguồn: ${html(sourceMoney(f.collectedMinor))} · Còn lại theo nguồn: ${html(sourceMoney(f.remainingMinor))}</p><p>Thông tin lịch sử từ Excel; chưa tạo giao dịch hoặc Phiếu Thu trong iChess.</p></details>`
}
const text = (v) => String(v ?? '')
const html = (v) =>
  text(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  )
const finite = (v) => v != null && Number.isFinite(Number(v))
const money = (v) =>
  finite(v) ? `${Number(v).toLocaleString('vi-VN')} VNĐ` : '—'
const searchable = (v) =>
  text(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
export function getTuitionPaymentTargetCycle(state, id = '') {
  return id
    ? [
        state?.currentCycle,
        state?.preparedNextCycle,
        ...(state?.cycles || []),
      ].find((c) => c?.id === id) || null
    : state?.currentCycle || null
}
export function isTuitionPaymentSnapshotCurrent(form, c) {
  return !!(
    c &&
    c.id === form.targetCycleId &&
    c.paymentPeriodId &&
    c.paymentPeriodId === form.periodId &&
    Number.isSafeInteger(Number(c.version)) &&
    Number(c.version) > 0 &&
    Number(c.version) === Number(form.targetCycleVersion)
  )
}
export function normalizeTuitionCyclePresentation({
  packageCycleState = null,
  selectedCycleId = '',
  packageCycleReady = true,
  packageCycleStatus = 'ready',
  receiptReady = false,
  receiptStatus = 'idle',
  receipts = [],
} = {}) {
  const selected = getTuitionPaymentTargetCycle(
    packageCycleState,
    selectedCycleId,
  )
  const present = (c) => {
    const known =
      !!c?.id &&
      Number.isSafeInteger(Number(c.totalSessions)) &&
      Number(c.totalSessions) > 0 &&
      Number.isSafeInteger(Number(c.usedSessions)) &&
      Number(c.usedSessions) >= 0
    const pending =
      !c &&
      !packageCycleReady &&
      ['idle', 'loading'].includes(packageCycleStatus)
    const initial =
      !c &&
      packageCycleReady &&
      packageCycleState?.initialSetupRequired === true
    const noPackage =
      !c &&
      packageCycleReady &&
      !!packageCycleState &&
      !initial &&
      !selectedCycleId
    const failed = (!c && !pending && !initial && !noPackage) || (!!c && !known)
    const used = known ? Number(c.usedSessions) : null,
      N = known ? Number(c.totalSessions) : null
    const ended = !!c?.manuallyEndedAt,
      remaining = known
        ? Math.max(Number(c.remainingSessions ?? N - used), 0)
        : null
    const source = c?.initialImport
    const paymentKnown = !source || source.paymentComplete != null || c?.paymentStatus === 'PAID'
    const paid = c?.paymentStatus === 'PAID',
      outstanding =
        known && source ? source.outstandingAmount
          : known && finite(c.amountDue) ? (paid ? 0 : Number(c.amountDue)) : null
    const debt = !paid && c?.lifecycleStatus === 'PROVISIONAL_UNPAID' ? used : 0
    const linked =
      receiptReady && paid
        ? receipts.filter(
            (r) => r.status === 'ISSUED' && r.targetCycleId === c.id,
          )
        : []
    const canPay =
      known &&
      packageCycleReady &&
      !!c.paymentPeriodId &&
      !!c.tuitionLocalId &&
      outstanding > 0 && paymentKnown
      // The current full-payment F5B contract cannot consume historical partial
      // credit. Preserve the true debt; do not collect the entire term again.
      && (!source || source.financialFacts.collectedMinor === 0)
    const reminder =
      known && !ended && Boolean(c.renewalReminder ?? remaining <= 2)
    const action = failed
      ? 'refresh'
      : pending
        ? 'loading'
        : initial
          ? 'initial'
          : noPackage
            ? 'assign'
            : canPay
              ? 'payment'
              : reminder
                ? 'tbhp'
                : 'none'
    return {
      cycle: c,
      cycleId: c?.id || '',
      hasKnownPackage: known,
      needsInitialSetup: initial,
      noPackage,
      isPending: pending,
      readFailed: failed,
      unresolved: pending || failed,
      totalSessions: N,
      usedSessions: used,
      remainingSessions: remaining,
      termLabel: c
        ? `Kỳ ${c.cycleNumber}`
        : initial
          ? 'Chưa thiết lập học phí'
          : noPackage
            ? 'Chưa có gói'
            : 'Kỳ học phí',
      progressLabel: known
        ? ended
          ? 'Đã kết thúc'
          : `${used}/${N}`
        : pending
          ? 'Đang tải…'
          : '—',
      packageLabel: known
        ? c.packageName || `Gói ${N} buổi`
        : initial
          ? 'Thiết lập số buổi và học phí ban đầu'
          : noPackage
            ? 'Chưa có gói'
            : failed
              ? 'Không tải được học phí.'
              : 'Đang tải học phí…',
      ended,
      expiredSessions: ended ? Number(c.expiredSessions || 0) : 0,
      isPaid: paid,
      debtSessions: debt,
      paymentLabel: !known
        ? '—'
        : paid
          ? 'Đã thanh toán đủ'
          : !paymentKnown ? 'Thiếu xác nhận thanh toán'
          : debt > 0
            ? `Chưa thanh toán đủ · Học nợ ${debt} buổi`
            : 'Chưa thanh toán đủ',
      paymentTone: !known ? 'muted' : paid ? 'paid' : 'unpaid',
      outstandingAmount: outstanding,
      canCollectPayment: canPay,
      paymentCycleId: c?.id || '',
      paymentOutstanding: outstanding,
      action,
      actionLabel: {
        refresh: 'Làm mới',
        loading: 'Đang tải học phí…',
        initial: 'Thiết lập',
        assign: 'Gán gói',
        payment: 'Ghi nhận thanh toán',
        tbhp: 'In / Xuất TBHP',
        none: 'Không cần xử lý',
      }[action],
      canPrintTbhp: known && finite(c?.amountDue),
      receipts: linked,
      canPrintReceipt: linked.length > 0,
      receiptUnavailableLabel:
        !paid || receiptReady
          ? 'Chưa có Phiếu Thu'
          : ['idle', 'loading'].includes(receiptStatus)
            ? 'Đang tải Phiếu Thu…'
            : 'Chưa tải được Phiếu Thu. Vui lòng làm mới.',
      canChangePackage:
        known && packageCycleReady && !ended && !paid && used === 0
          && ['ACTIVE', 'PROVISIONAL_UNPAID', 'PREPARED', 'NEEDS_PACKAGE_SELECTION'].includes(c.lifecycleStatus),
      canPrepareNext:
        known &&
        packageCycleReady &&
        !ended &&
        c.id === packageCycleState?.currentCycle?.id &&
        !packageCycleState?.preparedNextCycle,
      canEndCycle:
        known &&
        packageCycleReady &&
        !ended &&
        remaining > 0 &&
        ['ACTIVE', 'PROVISIONAL_UNPAID'].includes(c.lifecycleStatus),
      reminderLabel: reminder
        ? `Còn ${remaining} buổi · Nên gửi Thông báo học phí`
        : '',
      amounts: {
        tuitionAmount: c?.price ?? null,
        discountAmount: c?.discountAmount ?? null,
        materialFee: c?.materialFee ?? null,
        payableAmount: c?.amountDue ?? null,
        paidAmount: c?.paidAmount ?? null,
        remainingDebt: outstanding,
      },
    }
  }
  const p = present(selected)
  const baseline = !selected && !selectedCycleId && packageCycleReady ? packageCycleState?.verifiedInitialBaseline : null
  if (baseline) {
    const sourceLabels = { PAID_BEFORE_ICHESS: 'Nguồn: đã thanh toán trước iChess', UNPAID: 'Nguồn: chưa thanh toán', PARTIAL: 'Nguồn: thanh toán một phần', UNKNOWN: 'Nguồn: chưa rõ thanh toán' }
    Object.assign(p, { verifiedInitialBaseline: baseline, financialPending: true, hasKnownPackage: true,
      needsInitialSetup: false, noPackage: false, isPending: false, readFailed: false, unresolved: false,
      totalSessions: baseline.totalSessions, usedSessions: baseline.usedSessions, remainingSessions: baseline.remainingSessions,
      termLabel: 'Gói từ dữ liệu ban đầu · Chưa mở kỳ', progressLabel: `${baseline.usedSessions}/${baseline.totalSessions}`,
      packageLabel: baseline.packageName, paymentLabel: sourceLabels[baseline.financialFacts.paymentState],
      paymentTone: 'muted', isPaid: false, outstandingAmount: null, paymentOutstanding: null, debtSessions: 0,
      canCollectPayment: false, canPrintTbhp: false, canPrintReceipt: false, canChangePackage: false,
      canPrepareNext: false, canEndCycle: false, action: 'none', actionLabel: 'Chưa mở kỳ', reminderLabel: '',
      amounts: { tuitionAmount: null, discountAmount: null, materialFee: null, paidAmount: null, remainingDebt: null },
    })
  }
  p.prepared =
    packageCycleState?.preparedNextCycle &&
    packageCycleState.preparedNextCycle.id !== selected?.id
      ? present(packageCycleState.preparedNextCycle)
      : null
  if (selected?.initialImport) {
    const source = selected.initialImport
    p.initialCycleAdopted = true
    p.termLabel = `Kỳ ${selected.cycleNumber} · Tiếp quản`
    p.verifiedInitialBaseline = { baselineUsed: selected.baselineUsed, baselineCutoffDate: selected.baselineCutoffDate,
      contributedSessions: selected.contributedSessions, listedPriceMinor: selected.price, financialFacts: source.financialFacts }
    p.sourceFinancialMissing = selected.amountDue == null
    if (source.financialFacts.paymentState === 'PARTIAL' && !p.isPaid) p.actionLabel = `Còn thiếu ${money(p.outstandingAmount)}`
  }
  // These reminders concern the NEXT term, even when the current one is paid.
  // Early full payment of that next term cancels its collection reminder.
  if (p.cycle) {
    p.reminderLabel = !p.ended && p.remainingSessions <= 4 && !p.prepared?.isPaid
      ? p.remainingSessions <= 2 ? 'Theo dõi thu học phí kỳ tiếp theo nếu chưa thanh toán đủ'
        : 'Chuẩn bị TBHP kỳ tiếp theo' : ''
    p.reminderKind = !p.reminderLabel ? '' : p.remainingSessions <= 2 ? 'PAYMENT_NEXT' : 'NOTICE_NEXT'
    if (p.action === 'tbhp') { p.action = 'none'; p.actionLabel = p.remainingSessions === 0 ? 'Đã hết buổi · Cần xử lý kỳ tiếp theo' : 'Không cần xử lý' }
  }
  const excluded = new Set([selected?.id, p.prepared?.cycleId])
  p.history = (packageCycleState?.cycles || [])
    .filter((c) => !excluded.has(c.id))
    .map(present)
  p.paymentTarget = p.canCollectPayment
    ? { cycleId: p.cycleId }
    : p.prepared?.canCollectPayment
      ? { cycleId: p.prepared.cycleId }
      : null
  return p
}
// Positional arguments retained only for the read-only Student overview adapter.
// No record/Finance/attendance argument contributes to cycle presentation.
export function buildTuitionRows(
  students = [],
  _records = [],
  _reports = [],
  _finance = [],
  a = {},
) {
  return students.map((student) => {
    const s = (a.packageCycleStudentStates || []).find(
      (s) => s.studentId === student.id,
    )
    const p = normalizeTuitionCyclePresentation({
      packageCycleState: s,
      packageCycleReady: a.packageCycleReady !== false,
      packageCycleStatus: a.packageCycleStatus || 'ready',
      receiptReady: a.receiptReady,
      receiptStatus: a.receiptStatus,
      receipts: a.receipts || [],
    })
    return {
      student,
      packageCycleState: s,
      presentation: p,
      remainingSessions: p.remainingSessions,
      debtAmount: p.outstandingAmount,
      financeAvailable: a.financeAvailable !== false,
      amounts: p.amounts,
      tuition: p.cycle
        ? {
            id: p.cycle.tuitionLocalId,
            studentId: student.id,
            totalSessions: p.totalSessions,
            usedSessions: p.usedSessions,
            packageName: p.packageLabel,
          }
        : null,
      packageKind: p.hasKnownPackage
        ? String(p.totalSessions)
        : p.noPackage
          ? 'no-package'
          : 'other',
      status: {
        key: p.noPackage
          ? 'no-package'
          : p.needsInitialSetup
            ? 'initial-setup'
            : p.outstandingAmount > 0
              ? 'debt'
              : p.remainingSessions <= 2
                ? 'remaining-2'
                : 'normal',
        label: p.actionLabel,
        level: p.outstandingAmount > 0 ? 'warning' : 'normal',
      },
    }
  })
}
export function validateInitialTuitionSetup(v, catalog, legacy = false) {
  const p = catalog.find(
    (p) => p.id === v.packageCatalogId && p.isActive !== false,
  )
  if (!p) return 'Vui lòng chọn gói học.'
  if (legacy) {
    if (
      !/^\d+$/.test(text(v.usedSessions)) ||
      Number(v.usedSessions) > Number(p.totalSessions)
    )
      return `Số buổi đã học phải từ 0 đến ${p.totalSessions}.`
    if (!['UNPAID', 'PAID_BEFORE_ICHESS'].includes(v.openingPaymentState))
      return 'Vui lòng chọn trạng thái học phí kỳ hiện tại.'
  }
  return ''
}
export function validateFullTuitionPayment(v, required) {
  if (
    !finite(required) ||
    Number(required) <= 0 ||
    Number(v.amount) !== Number(required)
  )
    return 'Chỉ ghi nhận thanh toán đủ cho một kỳ.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(v.paidAt)))
    return 'Vui lòng chọn ngày thanh toán.'
  if (!['cash', 'transfer', 'other'].includes(v.method))
    return 'Vui lòng chọn phương thức thanh toán.'
  if (!text(v.payerName).trim()) return 'Vui lòng nhập người nộp tiền.'
  if (!text(v.collectorName).trim()) return 'Vui lòng nhập người thu tiền.'
  return ''
}
const btn = (label, action, id = '', cycle = '', extra = '') =>
  `<button type="button" data-tu-action="${html(action)}" data-tu-student-id="${html(id)}" data-tu-cycle-id="${html(cycle)}" ${extra}>${html(label)}</button>`
const badge = (p) =>
  `<span class="tuition-simple-payment is-${p.paymentTone}">${html(p.paymentLabel)}</span>`
const pkgOptions = (catalog, value = '') =>
  `<option value="">Chọn gói học</option>${catalog
    .filter((p) => p.isActive !== false)
    .map(
      (p) =>
        `<option value="${html(p.id)}" ${p.id === value ? 'selected' : ''}>${html(p.packageName)} · ${p.totalSessions} buổi · ${money(p.defaultAmount)}</option>`,
    )
    .join('')}`
export function getTuitionRecurringTarget(context, studentId, cycleId = '') {
  if (context.readStatus !== 'ready') return null
  const state = context.cycleStates.find(s => s.studentId === studentId)
  const cycle = state?.currentCycle
  if (!cycle || (cycleId && cycle.id !== cycleId) || cycle.manuallyEndedAt
    || !['ACTIVE', 'PROVISIONAL_UNPAID'].includes(cycle.lifecycleStatus)) return null
  const successor = state.preparedNextCycle || state.cycles?.find(c => c.cycleNumber === cycle.cycleNumber + 1) || null
  const locked = !!successor && (!['PREPARED', 'PROVISIONAL_UNPAID', 'NEEDS_PACKAGE_SELECTION', 'SUPERSEDED'].includes(successor.lifecycleStatus)
    || successor.usedSessions > 0 || successor.paidAmount > 0 || successor.paymentStatus === 'PAID'
    || context.receipts?.some(r => r.targetCycleId === successor.id))
  return { cycle, successor, locked }
}
export function parseTuitionRecurringValues(values) {
  const number = value => /^\d+$/.test(String(value)) ? Number(value) : NaN
  return validateRecurringDiscountPolicy({ schemaVersion: 1, discountKind: values.discountKind,
    percent: values.discountKind === 'FIXED' ? 0 : number(values.percent),
    fixedMinor: values.discountKind === 'FIXED' ? number(values.fixedMinor) : 0,
    siblingVoucherMinor: values.discountKind === 'PERCENT_THEN_SIBLING_VOUCHER' ? 100000 : 0 })
}
function recurringControl(context, id, p, panel) {
  const target = getTuitionRecurringTarget(context, id, p.cycleId)
  const edit = panel.recurringEdit
  if ((!target || !p.cycle?.recurringDiscountPolicy) && !edit) return ''
  if (target?.locked && !edit?.pendingCommand) return '<section class="tuition-detail-section"><h5>Ưu đãi định kỳ</h5><p>Kỳ tiếp theo đã có thanh toán hoặc buổi học. Có thể sửa ưu đãi khi kỳ đó trở thành kỳ hiện tại.</p></section>'
  const disabled = panel.busy || !!edit?.pendingCommand ? 'disabled' : ''
  const controls = edit ? `<div class="tuition-form-grid"><label><span>Loại ưu đãi</span><select data-tu-recurring-field="discountKind" ${disabled}>${[['PERCENT', 'Giảm theo %'], ['FIXED', 'Giảm số tiền cố định'], ['PERCENT_THEN_SIBLING_VOUCHER', '% rồi voucher anh/chị/em 100.000đ']].map(([value, label]) => `<option value="${value}" ${edit.values.discountKind === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>${edit.values.discountKind === 'FIXED' ? `<label><span>Số tiền giảm (VNĐ)</span><input type="number" min="0" step="1" data-tu-recurring-field="fixedMinor" value="${html(edit.values.fixedMinor)}" ${disabled}></label>` : `<label><span>Tỷ lệ giảm (%)</span><input type="number" min="0" max="100" step="1" data-tu-recurring-field="percent" value="${html(edit.values.percent)}" ${disabled}></label>`}</div>${btn(edit.pendingCommand ? 'Thử lưu lại' : 'Lưu ưu đãi', 'recurring-save', id, p.cycleId, panel.busy ? 'disabled' : '')}${!edit.pendingCommand ? btn('Hủy sửa', 'recurring-cancel', id, p.cycleId) + btn('Dừng từ kỳ tiếp theo', 'recurring-stop', id, p.cycleId, panel.busy ? 'disabled' : '') : '<p>Lệnh đang chờ xác nhận. Thử lại để kiểm tra cùng thay đổi.</p>'}`
    : btn('Sửa / Dừng ưu đãi định kỳ', 'recurring-edit', id, p.cycleId, panel.busy ? 'disabled' : '')
  return `<section class="tuition-detail-section"><h5>Ưu đãi định kỳ</h5><p>Kỳ mới mặc định kế thừa ưu đãi. Thay đổi áp dụng từ kỳ tiếp theo${target?.successor ? ', gồm kỳ đã chuẩn bị chưa thanh toán/chưa học' : ''}; giữ nguyên học phí kỳ hiện tại.</p>${controls}</section>`
}
function documents(p, id) {
  return `<section class="tuition-detail-section tuition-simple-documents" aria-label="Tài liệu"><h5>Tài liệu</h5><div class="tuition-simple-document-actions"><article class="tuition-simple-document-card"><strong>Thông báo học phí</strong>${p.canPrintTbhp ? btn('In / Xuất TBHP', 'tbhp', id, p.cycleId) : `<span>${html(p.sourceFinancialMissing ? 'Thiếu dữ liệu giá/ưu đãi từ nguồn' : p.financialPending ? 'Chưa mở kỳ' : p.needsInitialSetup ? 'Chưa thiết lập học phí' : p.noPackage ? 'Chưa có gói' : 'Không tải được học phí.')}</span>`}</article><article class="tuition-simple-document-card"><strong>Phiếu Thu</strong>${p.canPrintReceipt ? p.receipts.map((r) => `<span>${html(r.receiptNumber)}</span>${btn('In / Xuất Phiếu Thu', 'receipt', id, p.cycleId, `data-tu-receipt-id="${html(r.id)}"`)}`).join('') : `<span>${html(p.receiptUnavailableLabel)}</span>`}</article></div></section>`
}
function cycleCard(p, label = 'Kỳ hiện tại') {
  const policy = p.cycle?.recurringDiscountPolicy
  const recurringLabel = policy ? policy.discountKind === 'FIXED'
    ? `Giảm ${money(policy.fixedMinor)}`
    : `Giảm ${policy.percent}%${policy.siblingVoucherMinor ? `, sau đó voucher ${money(policy.siblingVoucherMinor)}` : ''}` : ''
  return `<section class="tuition-detail-section" aria-label="${html(label)}"><h5>${html(label)}</h5><div class="tuition-simple-cycle-card"><div><strong>${html(p.termLabel)} · ${html(p.progressLabel)}</strong><span>${html(p.packageLabel)}</span>${p.ended ? `<span>Đã học: ${p.usedSessions}/${p.totalSessions} · Hết hiệu lực: ${p.expiredSessions} buổi</span>` : p.hasKnownPackage ? `<span>Còn ${p.remainingSessions} buổi</span>` : ''}${recurringLabel ? `<span>Ưu đãi định kỳ: ${html(recurringLabel)}</span>` : ''}</div></div></section>`
}
function detail(context, row, panel) {
  const p = normalizeTuitionCyclePresentation({
    packageCycleState: row.packageCycleState,
    selectedCycleId: panel.cycleId,
    packageCycleReady: context.readStatus === 'ready',
    packageCycleStatus: context.readStatus,
    receiptReady: context.receiptStatus === 'ready',
    receiptStatus: context.receiptStatus,
    receipts: context.receipts,
  })
  const id = row.student.id,
    t = p.paymentTarget
  const primary = t
    ? btn('Ghi nhận thanh toán', 'payment', id, t.cycleId)
    : p.action === 'none'
      ? `<strong>${html(p.actionLabel)}</strong>`
      : btn(p.actionLabel, p.action, id, p.cycleId)
  const packageControl = (action, label) =>
    `<details class="tuition-simple-package-change" data-tu-package-action><summary>${label}</summary><div class="tuition-cycle-panel tuition-cycle-package-selection"><select aria-label="${label}">${pkgOptions(context.catalog)}</select>${btn('Xác nhận', action, id, p.cycleId, panel.busy ? 'disabled' : '')}</div></details>`
  return `${cycleCard(p, panel.cycleId ? 'Kỳ đã chọn' : 'Kỳ hiện tại')}${recurringControl(context, id, p, panel)}${documents(p, id)}<section class="tuition-detail-section"><h5>Thanh toán</h5>${badge(p)}${!p.initialCycleAdopted && p.cycle?.openingPaymentState === 'PAID_BEFORE_ICHESS' ? '<span>Đã thanh toán trước khi dùng iChess · Không có Phiếu Thu trong iChess</span>' : ''}${!p.initialCycleAdopted && p.cycle?.openingContext === 'LEGACY_BEFORE_ICHESS' ? `<span>${p.cycle.baselineUsed} buổi trước khi dùng iChess · ${p.cycle.contributedSessions} buổi do iChess ghi nhận</span>` : ''}${initialBaselineNotice(p)}${p.debtSessions > 0 ? `<span>Đã học nợ ${p.debtSessions} buổi</span>` : ''}</section>${p.prepared ? `${cycleCard(p.prepared, 'Kỳ tiếp theo')}${badge(p.prepared)}${p.prepared.canPrintTbhp ? btn('In / Xuất TBHP kỳ tiếp theo', 'tbhp', id, p.prepared.cycleId) : ''}` : ''}<section class="tuition-detail-section tuition-simple-next-action"><h5>Việc cần làm</h5><div class="tuition-simple-primary-work">${primary}</div>${p.reminderLabel ? `<span>${html(p.reminderLabel)}</span>` : ''}${p.canChangePackage ? packageControl('change', 'Đổi gói trước buổi học đầu tiên') : ''}${p.canPrepareNext ? packageControl('prepare', 'Thanh toán sớm kỳ tiếp theo') : ''}${p.canEndCycle ? btn('Kết thúc kỳ', 'end', id, p.cycleId, `class="tuition-stop-secondary" ${panel.busy ? 'disabled' : ''}`) : ''}</section><section class="tuition-detail-section"><details class="tuition-simple-history"><summary>Xem lịch sử</summary>${p.history.length ? p.history.map((h) => `<article class="tuition-simple-history-cycle"><div><strong>${h.termLabel} · ${h.progressLabel}</strong><span>${html(h.packageLabel)}</span>${h.ended ? `<span>Đã học: ${h.usedSessions}/${h.totalSessions} · Hết hiệu lực: ${h.expiredSessions} buổi</span>` : ''}${badge(h)}</div><div>${btn('Chi tiết', 'detail', id, h.cycleId)}${h.canPrintTbhp ? btn('In / Xuất TBHP', 'tbhp', id, h.cycleId) : ''}${h.canCollectPayment ? btn('Ghi nhận thanh toán', 'payment', id, h.cycleId) : ''}</div></article>`).join('') : '<span>Chưa có kỳ trước</span>'}</details></section>`
}
function successNotice(state) {
  return state.success
    ? `<div class="tuition-domain-notice is-success" data-tu-success><strong>${html(state.success.text)}</strong>${state.success.receiptId ? `${btn('In / Xuất Phiếu Thu', 'receipt', '', '', `data-tu-receipt-id="${html(state.success.receiptId)}"`)}${btn('Để sau', 'dismiss-success')}` : btn('Đóng', 'dismiss-success')}</div>`
    : ''
}
function panel(context, state, rows) {
  const p = state.panel
  if (!p) return ''
  const row = rows.find((r) => r.student.id === p.studentId),
    form = ['assign', 'initial', 'payment'].includes(p.kind)
  const title = {
    queue: 'Thiết lập dữ liệu học viên ban đầu',
    detail: 'Chi tiết học phí',
    assign: 'Gán gói học',
    initial: 'Thiết lập học phí ban đầu',
    payment: 'Ghi nhận thanh toán học phí',
  }[p.kind]
  let body = ''
  if (p.kind === 'queue')
    body = `<p>Dùng khi đưa các học viên đã học tại trung tâm trước khi sử dụng iChess vào hệ thống.</p>${
      rows
        .filter(
          (r) =>
            !r.presentation.cycle &&
            !r.presentation.financialPending &&
            !r.presentation.isPending &&
            !r.presentation.readFailed,
        )
        .map(
          (r) =>
            `<article class="tuition-simple-cycle-card"><div><strong>${html(r.student.fullName)}</strong><span>Chưa thiết lập học phí</span></div>${btn('Thiết lập', 'initial', r.student.id)}</article>`,
        )
        .join('') || '<p>Tất cả học viên đã có kỳ học phí.</p>'
    }`
  else if (!row) body = '<p>Không tải được học phí.</p>'
  else if (p.kind === 'detail') body = detail(context, row, p)
  else if (p.kind === 'payment') {
    const v = p.values,
      disabled = p.busy || !!p.pendingCommand
    body = `${cycleCard(p.presentation, 'Kỳ thanh toán')}<div class="tuition-formula"><div><span>Cần thanh toán đủ</span><strong>${money(p.presentation.outstandingAmount)}</strong></div></div><div class="tuition-form-grid"><label><span>Số tiền thanh toán đủ</span><input data-tu-field="amount" value="${money(v.amount).replace(' VNĐ', '')}" readonly></label><label><span>Ngày thanh toán</span><input type="date" data-tu-field="paidAt" value="${html(v.paidAt)}" ${disabled ? 'disabled' : ''}></label><label><span>Phương thức</span><select data-tu-field="method" ${disabled ? 'disabled' : ''}>${[
      ['cash', 'Tiền mặt'],
      ['transfer', 'Chuyển khoản'],
      ['other', 'Khác'],
    ]
      .map(
        ([val, label]) =>
          `<option value="${val}" ${val === v.method ? 'selected' : ''}>${label}</option>`,
      )
      .join(
        '',
      )}</select></label><label><span>Người nộp tiền</span><input data-tu-field="payerName" value="${html(v.payerName)}" ${disabled ? 'disabled' : ''}></label><label><span>Người thu tiền</span><input data-tu-field="collectorName" value="${html(v.collectorName)}" ${disabled ? 'disabled' : ''}></label><label class="span-full"><span>Ghi chú</span><textarea data-tu-field="note" ${disabled ? 'disabled' : ''}>${html(v.note)}</textarea></label></div>`
  } else {
    const v = p.values
    body = `<div class="tuition-form-grid"><label class="span-full"><span>Gói học</span><select data-tu-field="packageCatalogId" ${p.busy ? 'disabled' : ''}>${pkgOptions(context.catalog, v.packageCatalogId)}</select></label>${p.kind === 'initial' ? `<label><span>Đã học trước khi dùng iChess</span><input type="number" min="0" step="1" data-tu-field="usedSessions" value="${html(v.usedSessions)}" ${p.busy ? 'disabled' : ''}></label><label><span>Học phí kỳ hiện tại</span><select data-tu-field="openingPaymentState" ${p.busy ? 'disabled' : ''}><option value="">Chọn trạng thái</option><option value="PAID_BEFORE_ICHESS" ${v.openingPaymentState === 'PAID_BEFORE_ICHESS' ? 'selected' : ''}>Đã thanh toán trước khi dùng iChess</option><option value="UNPAID" ${v.openingPaymentState === 'UNPAID' ? 'selected' : ''}>Chưa thanh toán</option></select></label><p class="span-full">Đây là Kỳ 1 trong iChess. Số buổi trước đây được giữ nguyên; thanh toán trước iChess không tạo Phiếu Thu hay khoản thu.</p>` : '<p class="span-full">Kỳ 1 bắt đầu từ 0 buổi. Học phí được ghi nhận khi trung tâm đã nhận đủ tiền.</p>'}</div>`
  }
  return `<div class="tuition-form-backdrop" data-tu-action="close"></div><${form ? 'form' : 'section'} class="tuition-form-panel ${p.kind === 'detail' ? 'tuition-detail-panel' : p.kind === 'payment' ? 'tuition-payment-panel' : ''}" ${form ? 'data-tu-form' : ''} data-tu-panel="${p.kind}"><div class="tuition-form-header"><div><h4>${title}</h4>${row ? `<p>${html(row.student.fullName)} · ${html(row.student.parentName || '')}</p>` : ''}</div>${btn('X', 'close', '', '', `aria-label="Đóng" ${p.busy ? 'disabled' : ''}`)}</div><div class="tuition-dialog-body">${p.error ? `<p class="tuition-form-error" role="alert">${html(p.error)}</p>` : ''}${p.kind === 'detail' ? successNotice(state) : ''}${body}</div><div class="tuition-form-actions">${btn(form ? 'Hủy' : 'Đóng', 'close', '', '', p.busy ? 'disabled' : '')}${form ? `<button type="submit" ${p.busy || (p.kind === 'initial' && !context.initialSetupEnabled) ? 'disabled' : ''}>${p.busy ? 'Đang lưu…' : p.kind === 'payment' ? 'Lưu thanh toán' : 'Lưu'}</button>` : ''}</div></${form ? 'form' : 'section'}>`
}
export function renderTuitionModule(context, state) {
  const rows = buildTuitionRows(context.students, [], [], [], {
    packageCycleStudentStates: context.cycleStates,
    packageCycleReady: context.readStatus === 'ready',
    packageCycleStatus: context.readStatus,
    receiptReady: context.receiptStatus === 'ready',
    receiptStatus: context.receiptStatus,
    receipts: context.receipts,
  })
  const f = state.filters,
    filtered = rows.filter(
      (r) =>
        searchable(
          `${r.student.fullName} ${r.student.parentName} ${r.student.parentPhone}`,
        ).includes(searchable(f.query)) &&
        (f.status === 'all' ||
          (f.status === 'debt' && r.presentation.outstandingAmount > 0) ||
          (f.status === 'no-package' && r.presentation.noPackage) ||
          (f.status === 'initial' && r.presentation.needsInitialSetup) ||
          (f.status === 'not-opened' && r.presentation.financialPending) ||
          (f.status === 'reminder' && !!r.presentation.reminderLabel)) &&
        (f.package === 'all' || r.packageKind === f.package),
    )
  const pending = ['idle', 'loading'].includes(context.readStatus),
    failed = !pending && context.readStatus !== 'ready'
  const renderRow = (r) => {
    const p = r.presentation,
      id = r.student.id,
      t = p.paymentTarget
    return `<tr class="tuition-clickable-row" data-tuition-row-student-id="${html(id)}"><td><div class="tuition-student-cell"><strong>${html(r.student.fullName)}</strong><span>PH: ${html(r.student.parentName || 'Chưa cập nhật')}</span><small>${html(r.student.parentPhone || '')}</small></div></td><td><button class="tuition-simple-progress" type="button" data-tu-action="detail" data-tu-student-id="${html(id)}"><strong>${html(p.termLabel)}${p.noPackage || p.needsInitialSetup ? '' : ` · ${html(p.progressLabel)}`}</strong><span>${html(p.packageLabel)}</span></button></td><td>${badge(p)}</td><td><div class="tuition-simple-actions">${t ? btn('Ghi nhận thanh toán', 'payment', id, t.cycleId) : p.action === 'none' ? `<span>${html(p.actionLabel)}</span>` : p.action === 'loading' ? '<span>Đang tải học phí…</span>' : btn(p.actionLabel, p.action, id, p.cycleId)}${p.canPrintTbhp && p.action !== 'tbhp' ? btn('TBHP', 'tbhp', id, p.cycleId, 'class="tuition-document-action"') : ''}${btn('Chi tiết', 'detail', id, p.cycleId, 'class="tuition-detail-link"')}</div>${p.reminderLabel ? `<small>${html(p.reminderLabel)}</small>` : ''}</td></tr>`
  }
  return `<section class="tuition-module ${state.panel ? 'form-open' : ''}" data-tu-read-status="${html(context.readStatus)}" data-tuition-scroll-region="module"><div class="tuition-module-content" data-tuition-scroll-region="content">${failed ? `<p class="tuition-domain-notice is-warning" role="alert">Không tải được học phí. ${btn('Làm mới', 'refresh')}</p>` : pending ? '<p class="tuition-domain-notice is-loading" role="status">Đang tải học phí…</p>' : ''}${state.message ? `<p class="tuition-domain-notice" role="alert">${html(state.message)}</p>` : ''}<div class="tuition-overview"><div class="tuition-filter-row"><label><input type="search" data-tu-filter="query" value="${html(f.query)}" placeholder="Tìm tên học viên, phụ huynh, SĐT…" aria-label="Tìm học viên"></label><label><select data-tu-filter="status" aria-label="Trạng thái">${[
    ['all', 'Tất cả trạng thái'],
    ['debt', 'Chưa thanh toán'],
    ['reminder', 'Sắp hết buổi'],
    ['no-package', 'Chưa có gói'],
    ['initial', 'Chưa thiết lập học phí'],
    ['not-opened', 'Chưa mở kỳ'],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`,
    )
    .join(
      '',
    )}</select></label><label><select data-tu-filter="package" aria-label="Gói học"><option value="all">Tất cả gói</option>${[...new Set(rows.filter((r) => r.presentation.hasKnownPackage).map((r) => r.packageKind))].map((N) => `<option value="${N}" ${f.package === N ? 'selected' : ''}>${N} buổi</option>`).join('')}</select></label>${context.initialSetupEnabled ? btn('Thiết lập dữ liệu học viên ban đầu', 'initial-queue') : ''}</div><div class="tuition-stats">${[
    ['Tổng học viên', rows.length],
    ['Đã có gói', rows.filter((r) => r.presentation.hasKnownPackage).length],
    ['Chưa có gói', rows.filter((r) => r.presentation.noPackage).length],
    ['Chưa mở kỳ', rows.filter((r) => r.presentation.financialPending).length],
    ['Kỳ đã kích hoạt', rows.filter((r) => r.presentation.cycle?.lifecycleStatus === 'ACTIVE').length],
    [
      'Chưa thiết lập',
      rows.filter((r) => r.presentation.needsInitialSetup).length,
    ],
    [
      'Chưa thanh toán',
      rows.filter((r) => r.presentation.outstandingAmount > 0).length,
    ],
  ]
    .map(
      ([l, n]) =>
        `<article class="tuition-stat"><span>${l}</span><strong>${n}</strong></article>`,
    )
    .join(
      '',
    )}</div></div><div class="tuition-table-wrap" data-tuition-scroll-region="table"><table class="tuition-table"><thead><tr><th>HỌC VIÊN</th><th>KỲ / TIẾN ĐỘ</th><th>THANH TOÁN</th><th>VIỆC CẦN LÀM</th></tr></thead><tbody>${filtered.map(renderRow).join('') || `<tr><td colspan="4">${context.readStatus === 'ready' && rows.length === 0 ? 'Chưa có học viên để quản lý học phí tại cơ sở này.' : 'Chưa có học viên phù hợp.'}</td></tr>`}</tbody></table></div></div>${!state.panel ? successNotice(state) : ''}${panel(context, state, rows)}</section>`
}
