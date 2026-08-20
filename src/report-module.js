export const initialReportFilters = {
  reportDate: getTodayDate(),
  weekStartDate: getWeekStartDate(getTodayDate()),
}

export const reportPendingTaskItems = [
  { key: 'diemDanh', label: 'Điểm danh' },
  { key: 'tbhp', label: 'TBHP' },
  { key: 'nhacThuHp', label: 'Nhắc thu HP' },
  { key: 'chamSocPhuHuynhDinhKy', label: 'Chăm sóc phụ huynh định kỳ' },
  { key: 'duaDonBe', label: 'Đưa đón bé' },
  { key: 'trucNhatVeSinh', label: 'Trực nhật vệ sinh' },
  { key: 'dangBaiDuaTin', label: 'Đăng bài đưa tin' },
]

export const initialReportDraft = {
  dailyTasks: '',
  dailyIssues: '',
  operationNote: '',
  ownerName: '',
  pendingTasks: {},
  otherPendingTasks: '',
}

const DATA_SOURCE_NOTE =
  'Dữ liệu hiển thị là derived view từ Học viên, Điểm danh và Tài chính authoritative của đúng active center.'

export function createInitialReportState(now = new Date()) {
  const today = toDateKey(now)

  return {
    filters: {
      reportDate: today,
      weekStartDate: getWeekStartDate(today),
    },
    draft: { ...initialReportDraft },
    selectedBarDetail: null,
  }
}

export function renderReportModule({
  filters = initialReportFilters,
  draft = initialReportDraft,
  students = [],
  cashflowTransactions = [],
  attendanceRecords = [],
  selectedBarDetail = null,
  sourceTransactionsState = null,
  centerInfo = null,
} = {}) {
  const activeFilters = normalizeReportFilters(filters)
  const activeDraft = { ...initialReportDraft, ...draft }
  const reportData = buildReportData({
    filters: activeFilters,
    students,
    cashflowTransactions,
    attendanceRecords,
  })
  const activeCenter = normalizeReportCenterInfo(centerInfo)

  return `
    <section class="report-module" aria-label="Báo cáo vận hành cơ sở ${escapeAttribute(activeCenter.displayName)}">
      <div class="report-filters" aria-label="Bộ lọc ngày và tuần">
        <label>
          <span>Ngày báo cáo</span>
          <input type="date" value="${escapeAttribute(activeFilters.reportDate)}" data-report-filter="reportDate" />
        </label>
        <div class="report-week-control">
          <span>Tuần đang xem: ${escapeHtml(reportData.weekLabel)}</span>
          <input type="date" value="${escapeAttribute(activeFilters.weekStartDate)}" data-report-filter="weekStartDate" />
        </div>
        <div class="report-week-actions" aria-label="Điều hướng tuần báo cáo">
          <button type="button" data-report-week-action="previous">Tuần trước</button>
          <button type="button" data-report-week-action="current">Tuần này</button>
          <button type="button" data-report-week-action="next">Tuần sau</button>
        </div>
        <div class="report-actions">
          <button type="button" data-report-action="print">In báo cáo</button>
          <button type="button" data-report-action="download">Tải báo cáo</button>
        </div>
      </div>

      <div class="report-grid" data-report-scroll-region="report-grid">
        ${renderDailyReport(reportData, activeDraft)}
        ${renderWeeklyReport(reportData, selectedBarDetail)}
      </div>
      ${renderReportSourceTransactionsModal(sourceTransactionsState)}
    </section>
  `
}

export function buildReportData({
  filters = initialReportFilters,
  students = [],
  cashflowTransactions = [],
  attendanceRecords = [],
} = {}) {
  const activeFilters = normalizeReportFilters(filters)
  const weekDays = buildWeekDays(activeFilters.weekStartDate)
  const dailyTransactions = getReportTransactionsForScope(cashflowTransactions, activeFilters, {
    mode: 'day',
    type: 'all',
  })
  const weekTransactions = getReportTransactionsForScope(cashflowTransactions, activeFilters, {
    mode: 'week',
    type: 'all',
  })
  const activeStudents = normalizeActiveStudents(students)
  const attendanceSummary = buildAttendanceSummary({
    students: activeStudents,
    attendanceRecords,
    weekStartDate: weekDays[0],
    weekEndDate: weekDays[weekDays.length - 1],
  })
  const dailyIncome = sumTransactions(dailyTransactions, 'income')
  const dailyExpense = sumTransactions(dailyTransactions, 'expense')
  const weeklyIncome = sumTransactions(weekTransactions, 'income')
  const weeklyExpense = sumTransactions(weekTransactions, 'expense')
  const weeklyBars = buildWeeklyBars(cashflowTransactions, activeFilters.weekStartDate)

  return {
    filters: activeFilters,
    dataSourceNote: DATA_SOURCE_NOTE,
    reportDateLabel: formatDate(activeFilters.reportDate),
    weekLabel: `${formatDate(weekDays[0])} - ${formatDate(weekDays[weekDays.length - 1])}`,
    dailyTransactions,
    dailyIncome,
    dailyExpense,
    weeklyIncome,
    weeklyExpense,
    weeklyBalance: weeklyIncome - weeklyExpense,
    studentCount: activeStudents.length,
    attendanceSummary,
    weeklyBars,
  }
}

export function getReportTransactionScope(filters = initialReportFilters, scope = {}) {
  const activeFilters = normalizeReportFilters(filters)
  const mode = scope.mode === 'week' ? 'week' : 'day'
  const type = ['income', 'expense'].includes(scope.type) ? scope.type : 'all'
  const category = String(scope.category || '').trim()
  const weekDays = buildWeekDays(activeFilters.weekStartDate)
  const startDate = mode === 'week' ? weekDays[0] : activeFilters.reportDate
  const endDate = mode === 'week' ? weekDays[weekDays.length - 1] : activeFilters.reportDate
  const typeLabel = type === 'income' ? 'Thu' : type === 'expense' ? 'Chi' : 'Tất cả thu/chi'
  const rangeLabel = mode === 'week' ? `Tuần ${formatDate(startDate)} - ${formatDate(endDate)}` : `Ngày ${formatDate(startDate)}`

  return {
    mode,
    type,
    category,
    startDate,
    endDate,
    dateLabel: mode === 'week' ? `${formatDate(startDate)} - ${formatDate(endDate)}` : formatDate(startDate),
    title: mode === 'week' ? 'Giao dịch nguồn báo cáo tuần' : 'Giao dịch nguồn báo cáo ngày',
    subtitle: category ? `${typeLabel} · ${category} · ${rangeLabel}` : `${typeLabel} · ${rangeLabel}`,
  }
}

export function getReportTransactionsForScope(transactions = [], filters = initialReportFilters, scope = {}) {
  const activeScope = getReportTransactionScope(filters, scope)

  return filterTransactionsByRange(transactions, activeScope.startDate, activeScope.endDate)
    .filter((transaction) => activeScope.type === 'all' || transaction.type === activeScope.type)
    .filter((transaction) => {
      if (!activeScope.category) {
        return true
      }

      return String(transaction.category || '').trim() === activeScope.category
    })
}

export function buildReportDownloadText({
  filters = initialReportFilters,
  draft = initialReportDraft,
  students = [],
  cashflowTransactions = [],
  attendanceRecords = [],
  centerInfo = null,
} = {}) {
  const activeDraft = { ...initialReportDraft, ...draft }
  const data = buildReportData({
    filters,
    students,
    cashflowTransactions,
    attendanceRecords,
  })
  const activeCenter = normalizeReportCenterInfo(centerInfo)

  return [
    `Báo cáo vận hành cơ sở ${activeCenter.displayName}`,
    `Mã cơ sở: ${activeCenter.codeLabel}`,
    `Ngày báo cáo: ${data.reportDateLabel}`,
    `Tuần đang xem: ${data.weekLabel}`,
    'Nguồn dữ liệu: derived từ authoritative upstream của đúng active center.',
    '',
    'Báo cáo ngày',
    `Công việc ngày: ${activeDraft.dailyTasks || 'Chưa nhập công việc ngày.'}`,
    'VIỆC CHƯA THỰC HIỆN',
    ...reportPendingTaskItems.map((item) => {
      const status = activeDraft.pendingTasks?.[item.key] ? 'Đã xong' : 'Chưa xong'
      return `- [${status}] ${item.label}`
    }),
    `Công việc khác: ${activeDraft.otherPendingTasks || 'Chưa nhập công việc khác.'}`,
    `Tình huống/vấn đề: ${activeDraft.dailyIssues || 'Chưa ghi nhận tình huống/vấn đề.'}`,
    `Doanh thu trong ngày: ${formatMoney(data.dailyIncome)}`,
    `Chi phí trong ngày: ${formatMoney(data.dailyExpense)}`,
    `Ghi chú vận hành: ${activeDraft.operationNote || 'Chưa có ghi chú vận hành.'}`,
    `Người phụ trách: ${activeDraft.ownerName || 'Chưa nhập người phụ trách.'}`,
    '',
    'Báo cáo tuần',
    `Tuần đang xem: ${data.weekLabel}`,
    `Tổng doanh thu: ${formatMoney(data.weeklyIncome)}`,
    `Tổng chi phí: ${formatMoney(data.weeklyExpense)}`,
    `Còn lại: ${formatMoney(data.weeklyBalance)}`,
    `Tổng học viên: ${data.studentCount}`,
    `Học viên đi học trong tuần: ${data.attendanceSummary.presentCount}`,
    `Học viên vắng/nghỉ trong tuần: ${data.attendanceSummary.absentCount}`,
    '',
    'Bảng thu/chi theo tuần',
    ...data.weeklyBars.weeks.flatMap((week) => [
      `${week.weekLabel}:`,
      `  Doanh thu: ${formatMoney(week.income)}`,
      `  Chi phí: ${formatMoney(week.expense)}`,
    ]),
    '',
    'Nguồn dữ liệu',
    data.dataSourceNote,
    data.attendanceSummary.hasAttendanceData
      ? 'Điểm danh tuần được tổng hợp từ attendance authoritative projection.'
      : 'Chưa có đủ dữ liệu điểm danh trong tuần này để tính chính xác học/vắng/nghỉ.',
  ].join('\n')
}

export function buildReportPrintHtml({
  filters = initialReportFilters,
  draft = initialReportDraft,
  students = [],
  cashflowTransactions = [],
  attendanceRecords = [],
  centerInfo = null,
} = {}) {
  const activeDraft = { ...initialReportDraft, ...draft }
  const data = buildReportData({
    filters,
    students,
    cashflowTransactions,
    attendanceRecords,
  })
  const activeCenter = normalizeReportCenterInfo(centerInfo)

  return `<!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <title>Báo cáo cơ sở ${escapeHtml(activeCenter.displayName)}</title>
        <style>
          body { margin: 24px; color: #111827; font-family: Arial, sans-serif; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          h2 { margin: 22px 0 8px; font-size: 16px; }
          p { margin: 4px 0; line-height: 1.45; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #d1d5db; padding: 7px 8px; text-align: left; }
          th { background: #f3f4f6; }
          .muted { color: #6b7280; }
        </style>
      </head>
      <body>
        <h1>Báo cáo cơ sở ${escapeHtml(activeCenter.displayName)}</h1>
        <p>Mã cơ sở: ${escapeHtml(activeCenter.codeLabel)}</p>
        <p>Ngày báo cáo: ${escapeHtml(data.reportDateLabel)}</p>
        <p>Tuần đang xem: ${escapeHtml(data.weekLabel)}</p>
        <h2>Báo cáo ngày</h2>
        <p>Công việc ngày: ${escapeHtml(activeDraft.dailyTasks || 'Chưa nhập công việc ngày.')}</p>
        <h2>VIỆC CHƯA THỰC HIỆN</h2>
        <ul>
          ${reportPendingTaskItems
            .map((item) => {
              const status = activeDraft.pendingTasks?.[item.key] ? 'Đã xong' : 'Chưa xong'
              return `<li>${escapeHtml(status)} - ${escapeHtml(item.label)}</li>`
            })
            .join('')}
        </ul>
        <p>Công việc khác: ${escapeHtml(activeDraft.otherPendingTasks || 'Chưa nhập công việc khác.')}</p>
        <p>Tình huống/vấn đề: ${escapeHtml(activeDraft.dailyIssues || 'Chưa ghi nhận tình huống/vấn đề.')}</p>
        <p>Doanh thu trong ngày: ${escapeHtml(formatMoney(data.dailyIncome))}</p>
        <p>Chi phí trong ngày: ${escapeHtml(formatMoney(data.dailyExpense))}</p>
        <h2>Báo cáo tuần</h2>
        <p>Tổng doanh thu: ${escapeHtml(formatMoney(data.weeklyIncome))}</p>
        <p>Tổng chi phí: ${escapeHtml(formatMoney(data.weeklyExpense))}</p>
        <p>Còn lại: ${escapeHtml(formatMoney(data.weeklyBalance))}</p>
        <table>
          <thead><tr><th>Tuần</th><th>Doanh thu</th><th>Chi phí</th></tr></thead>
          <tbody>
            ${data.weeklyBars.weeks
              .map(
                (week) => `<tr><td>${escapeHtml(week.weekLabel)}</td><td>${escapeHtml(formatMoney(week.income))}</td><td>${escapeHtml(formatMoney(week.expense))}</td></tr>`,
              )
              .join('')}
          </tbody>
        </table>
        <h2>Học/vắng/nghỉ</h2>
        <p>Đi học: ${data.attendanceSummary.presentCount.toLocaleString('vi-VN')}</p>
        <p>Vắng/nghỉ: ${data.attendanceSummary.absentCount.toLocaleString('vi-VN')}</p>
        <p>Tổng: ${data.attendanceSummary.totalCount.toLocaleString('vi-VN')}</p>
        <p class="muted">${escapeHtml(data.attendanceSummary.hasAttendanceData ? 'Nguồn: attendance authoritative projection của active center.' : 'Chưa có đủ dữ liệu điểm danh trong tuần này.')}</p>
      </body>
    </html>`
}

export function getReportDownloadFilename(reportDate = getTodayDate(), centerInfo = null) {
  const activeCenter = normalizeReportCenterInfo(centerInfo)
  return `bao-cao-co-so-${slugifyFilenamePart(activeCenter.codeLabel)}-${String(reportDate || getTodayDate())}.txt`
}

function renderDailyReport(data, draft) {
  return `
    <section class="report-panel report-daily-panel" aria-labelledby="daily-report-title">
      <div class="report-panel-heading">
        <h4 id="daily-report-title">Báo cáo ngày</h4>
        <span>${escapeHtml(data.reportDateLabel)}</span>
      </div>
      <div class="report-stat-row">
        ${renderReportStat('Doanh thu trong ngày', formatMoney(data.dailyIncome), 'income')}
        ${renderReportStat('Chi phí trong ngày', formatMoney(data.dailyExpense), 'expense')}
        ${renderReportStat('Còn lại', formatMoney(data.dailyIncome - data.dailyExpense), 'balance')}
      </div>
      ${renderReportSourceActions('day')}
      ${
        data.dailyTransactions.length
          ? renderDailyTransactionList(data.dailyTransactions)
          : '<p class="report-empty">Chưa có giao dịch thu/chi trong ngày đang chọn.</p>'
      }
      <div class="report-daily-form" aria-label="Nội dung báo cáo công việc ngày">
        ${renderReportTextarea('Công việc ngày', 'dailyTasks', draft.dailyTasks, 'Các việc đã xử lý trong ngày')}
        ${renderReportTextarea('Tình huống/vấn đề xảy ra trong ngày', 'dailyIssues', draft.dailyIssues, 'Tình huống phát sinh, việc cần theo dõi')}
        ${renderReportTextarea('Ghi chú vận hành', 'operationNote', draft.operationNote, 'Ghi chú bàn giao hoặc lưu ý nội bộ')}
        ${renderPendingTaskBox(draft)}
        <label>
          <span>Người phụ trách</span>
          <input
            type="text"
            value="${escapeAttribute(draft.ownerName)}"
            placeholder="Người phụ trách"
            data-report-draft-field="ownerName"
          />
        </label>
      </div>
    </section>
  `
}

function renderWeeklyReport(data, selectedBarDetail = null) {
  const attendance = data.attendanceSummary
  const presentPercent = attendance.totalCount ? (attendance.presentCount / attendance.totalCount) * 100 : 0

  return `
    <section class="report-panel report-weekly-panel" aria-labelledby="weekly-report-title">
      <div class="report-panel-heading">
        <h4 id="weekly-report-title">Báo cáo tuần</h4>
        <span>${escapeHtml(data.weekLabel)}</span>
      </div>
      <div class="report-stat-row">
        ${renderReportStat('Tổng doanh thu', formatMoney(data.weeklyIncome), 'income')}
        ${renderReportStat('Tổng chi phí', formatMoney(data.weeklyExpense), 'expense')}
        ${renderReportStat('Còn lại', formatMoney(data.weeklyBalance), 'balance')}
        ${renderReportStat('Tổng học viên', data.studentCount.toLocaleString('vi-VN'), 'neutral')}
      </div>
      ${renderReportSourceActions('week')}
      <div class="report-chart-grid">
        <section class="report-chart-card" aria-label="Biểu đồ cột thu chi theo tuần">
          <div class="report-chart-heading">
            <h5>Biểu đồ cột thu/chi theo tuần</h5>
            <span>Đơn vị: VNĐ · Min 0 · Max ${formatMoney(data.weeklyBars.axisMax)}</span>
          </div>
          ${renderCashflowBarChart(data.weeklyBars)}
          ${renderReportBarDetail(selectedBarDetail)}
        </section>
        <section class="report-chart-card" aria-label="Biểu đồ tròn học vắng nghỉ tổng thể cơ sở">
          <div class="report-chart-heading">
            <h5>Biểu đồ học/vắng/nghỉ tổng thể cơ sở</h5>
            <span>100% = tổng học viên cơ sở</span>
          </div>
          <div class="report-attendance-chart">
            <div
              class="report-pie"
              style="--present-percent: ${presentPercent.toFixed(2)}%;"
              role="img"
              aria-label="Học ${attendance.presentCount}, vắng nghỉ ${attendance.absentCount}"
            ></div>
            <div class="report-pie-legend">
              <span><i class="is-present"></i> Đi học: ${attendance.presentCount.toLocaleString('vi-VN')}</span>
              <span><i class="is-absent"></i> Vắng/nghỉ: ${attendance.absentCount.toLocaleString('vi-VN')}</span>
              <span><i class="is-total"></i> Tổng: ${attendance.totalCount.toLocaleString('vi-VN')}</span>
            </div>
          </div>
          ${
            attendance.hasAttendanceData
              ? ''
              : '<p class="report-empty">Chưa có đủ dữ liệu điểm danh trong tuần này để tính chính xác học/vắng/nghỉ.</p>'
          }
        </section>
      </div>
    </section>
  `
}

function renderPendingTaskBox(draft) {
  const pendingTasks = draft.pendingTasks && typeof draft.pendingTasks === 'object' ? draft.pendingTasks : {}

  return `
    <section class="report-pending-tasks" aria-labelledby="report-pending-tasks-title">
      <div class="report-pending-tasks-heading">
        <h5 id="report-pending-tasks-title">VIỆC CHƯA THỰC HIỆN</h5>
        <span>Checklist công việc ngày</span>
      </div>
      <div class="report-pending-task-list">
        ${reportPendingTaskItems
          .map(
            (item) => `
              <label class="report-pending-task-item">
                <input
                  type="checkbox"
                  ${pendingTasks[item.key] ? 'checked' : ''}
                  data-report-pending-task="${escapeAttribute(item.key)}"
                />
                <span>${escapeHtml(item.label)}</span>
              </label>
            `,
          )
          .join('')}
      </div>
      ${renderReportTextarea('Công việc khác', 'otherPendingTasks', draft.otherPendingTasks, 'Công việc khác...')}
    </section>
  `
}

function renderReportSourceActions(mode) {
  return `
    <div class="report-source-actions" aria-label="Xem giao dịch nguồn">
      <button
        type="button"
        data-report-drilldown-action="open"
        data-report-drilldown-mode="${escapeAttribute(mode)}"
        data-report-drilldown-type="all"
      >Xem giao dịch nguồn</button>
      <button
        type="button"
        data-report-drilldown-action="open"
        data-report-drilldown-mode="${escapeAttribute(mode)}"
        data-report-drilldown-type="income"
      >Xem nguồn Thu</button>
      <button
        type="button"
        data-report-drilldown-action="open"
        data-report-drilldown-mode="${escapeAttribute(mode)}"
        data-report-drilldown-type="expense"
      >Xem nguồn Chi</button>
    </div>
  `
}

function renderReportTextarea(label, field, value, placeholder) {
  return `
    <label>
      <span>${label}</span>
      <textarea
        placeholder="${escapeAttribute(placeholder)}"
        data-report-draft-field="${escapeAttribute(field)}"
      >${escapeHtml(value)}</textarea>
    </label>
  `
}

function renderReportStat(label, value, tone) {
  return `
    <article class="report-stat is-${tone}">
      <span>${label}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `
}

function renderDailyTransactionList(transactions) {
  return `
    <div class="report-transaction-list" aria-label="Giao dịch trong ngày">
      ${transactions
        .slice(0, 5)
        .map(
          (transaction) => `
            <div class="report-transaction-item is-${escapeAttribute(transaction.type)}">
              <span>${escapeHtml(transaction.category || 'Khác')}</span>
              <strong>${formatSignedMoney(transaction)}</strong>
              <small>${escapeHtml(transaction.personName || transaction.recordedBy || 'Chưa rõ')}</small>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderReportSourceTransactionsModal(state) {
  if (!state) {
    return ''
  }

  const transactions = Array.isArray(state.transactions) ? state.transactions : []
  const total = transactions.reduce((sum, transaction) => {
    const amount = Number(transaction.amount)
    return Number.isFinite(amount) ? sum + Math.max(0, amount) : sum
  }, 0)

  return `
    <div class="report-source-modal-backdrop" data-report-source-action="close" role="presentation">
      <section
        class="report-source-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-source-modal-title"
        data-report-source-modal
      >
        <div class="report-source-modal-heading">
          <div>
            <h4 id="report-source-modal-title">${escapeHtml(state.title || 'Giao dịch nguồn')}</h4>
            <p>${escapeHtml(state.subtitle || '')}</p>
          </div>
          <button type="button" data-report-source-action="close" aria-label="Đóng">Đóng</button>
        </div>
        ${state.message ? `<p class="report-source-message is-${escapeAttribute(state.messageTone || 'info')}">${escapeHtml(state.message)}</p>` : ''}
        ${state.error ? `<p class="report-source-message is-error">${escapeHtml(state.error)}</p>` : ''}
        <div class="report-source-summary">
          <span>${transactions.length.toLocaleString('vi-VN')} giao dịch</span>
          <strong>${escapeHtml(formatMoney(total))}</strong>
        </div>
        ${state.status === 'loading' ? '<p class="report-empty">Đang kiểm tra trạng thái chứng từ...</p>' : ''}
        ${
          transactions.length
            ? renderReportSourceTransactionTable(transactions, state)
            : '<p class="report-empty">Không có giao dịch nguồn trong phạm vi này.</p>'
        }
      </section>
    </div>
  `
}

function renderReportSourceTransactionTable(transactions, state) {
  const transactionCodes = state.transactionCodes || {}
  const attachmentCounts = state.attachmentCounts || {}

  return `
    <div class="report-source-table-wrap">
      <table class="report-source-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Ngày</th>
            <th>Thu/Chi</th>
            <th>Danh mục</th>
            <th>Số tiền</th>
            <th>Người liên quan</th>
            <th>Nguồn</th>
            <th>Chứng từ</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${transactions
            .map((transaction) => renderReportSourceTransactionRow(transaction, transactionCodes, attachmentCounts))
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderReportSourceTransactionRow(transaction, transactionCodes, attachmentCounts) {
  const transactionId = String(transaction.id || '').trim()
  const transactionCode = String(transactionCodes[transactionId] || transaction.transactionCode || transactionId || '').trim()
  const count = attachmentCounts[transactionCode] || 0
  const hasLegacyAttachment = Boolean(transaction.attachment)
  const hasEvidence = count > 0 || hasLegacyAttachment
  const sourceLabel = getReportTransactionSourceLabel(transaction)

  return `
    <tr class="report-source-row is-${escapeAttribute(transaction.type || 'unknown')}">
      <td><strong>${escapeHtml(transactionCode || 'Chưa có mã')}</strong></td>
      <td>${escapeHtml(formatDate(String(transaction.transactionDate || transaction.date || '').slice(0, 10)))}</td>
      <td>${escapeHtml(transaction.type === 'expense' ? 'Chi' : 'Thu')}</td>
      <td><span class="report-source-ellipsis">${escapeHtml(transaction.category || 'Khác')}</span></td>
      <td><strong>${escapeHtml(formatMoney(transaction.amount))}</strong></td>
      <td><span class="report-source-ellipsis">${escapeHtml(transaction.personName || transaction.recordedBy || 'Chưa rõ')}</span></td>
      <td><span class="report-source-ellipsis">${escapeHtml(sourceLabel)}</span></td>
      <td>${escapeHtml(hasEvidence ? `${count || 1} chứng từ` : 'Chưa có')}</td>
      <td>
        <div class="report-source-row-actions">
          <button type="button" data-report-source-action="open-transaction" data-report-source-transaction-id="${escapeAttribute(transactionId)}">Mở giao dịch</button>
          <button
            type="button"
            data-report-source-action="view-evidence"
            data-report-source-transaction-id="${escapeAttribute(transactionId)}"
            ${hasEvidence ? '' : 'disabled'}
          >Xem chứng từ</button>
          <button type="button" data-report-source-action="print-transaction" data-report-source-transaction-id="${escapeAttribute(transactionId)}">In / PDF</button>
        </div>
      </td>
    </tr>
  `
}

function getReportTransactionSourceLabel(transaction) {
  if (transaction.sourceModule === 'hoc-phi' || transaction.sourceType === 'tuition-payment') {
    const note = String(transaction.note || '')
    const syncedText = note.split('\n').find((line) => line.includes('Đồng bộ từ Học phí'))
    return syncedText ? syncedText.replace(/^[-\s]*/, '').trim() : 'Đồng bộ từ Học phí'
  }

  return 'Manual'
}

function renderCashflowBarChart(chartData) {
  const hasAnyValue = chartData.weeks.some((week) => week.income > 0 || week.expense > 0)

  return `
    <div class="report-bar-chart ${hasAnyValue ? '' : 'is-empty'}">
      <div class="report-y-axis" aria-label="Mốc trục Y">
        ${chartData.ticks
          .map((tick) => `<span>${escapeHtml(formatAxisMoney(tick))}</span>`)
          .join('')}
      </div>
      <div class="report-bar-plot">
        ${chartData.weeks
          .map(
            (week) => `
              <div class="report-bar-group">
                <div class="report-bars">
                  ${renderReportBarButton(week, 'income', chartData.axisMax)}
                  ${renderReportBarButton(week, 'expense', chartData.axisMax)}
                </div>
                <span class="report-bar-label">${escapeHtml(week.label)}</span>
              </div>
            `,
          )
          .join('')}
      </div>
    </div>
    <div class="report-chart-legend">
      <span><i class="is-income"></i> Doanh thu</span>
      <span><i class="is-expense"></i> Chi phí</span>
    </div>
    ${hasAnyValue ? '' : '<p class="report-empty">Chưa có dữ liệu thu/chi trong các tuần đang hiển thị.</p>'}
  `
}

function renderReportBarButton(week, type, axisMax) {
  const value = type === 'income' ? week.income : week.expense
  const label = type === 'income' ? 'Doanh thu' : 'Chi phí'
  const title = `${label} tuần ${week.weekLabel}: ${formatMoney(value)}.`

  return `
    <button
      type="button"
      class="report-bar is-${type}"
      style="height: ${getBarPercent(value, axisMax)}%;"
      title="${escapeAttribute(title)}"
      data-report-bar-detail
      data-report-bar-type="${type}"
      data-report-bar-label="${escapeAttribute(label)}"
      data-report-bar-week="${escapeAttribute(week.weekLabel)}"
      data-report-bar-value="${value}"
      data-report-bar-source="Tài chính authoritative projection trong tuần đang xem"
      aria-label="${escapeAttribute(title)}"
    ></button>
  `
}

function renderReportBarDetail(detail) {
  if (!detail) {
    return '<p class="report-bar-detail-empty">Bấm vào cột thu/chi để xem chi tiết.</p>'
  }

  return `
    <section class="report-bar-detail" aria-label="Chi tiết cột thu chi">
      <strong>Chi tiết cột</strong>
      <p>${escapeHtml(detail.label)} · Tuần ${escapeHtml(detail.weekLabel)} · ${escapeHtml(formatMoney(detail.value))}</p>
      <small>Nguồn: ${escapeHtml(detail.source || 'Tài chính authoritative projection.')}</small>
    </section>
  `
}

function buildWeeklyBars(transactions, activeWeekStartDate) {
  const activeWeekStart = parseDateKey(activeWeekStartDate) ?? new Date()
  const weeks = [-3, -2, -1, 0].map((offset) => {
    const weekStart = addDays(activeWeekStart, offset * 7)
    const weekEnd = addDays(weekStart, 6)
    const weekTransactions = filterTransactionsByRange(
      transactions,
      toDateKey(weekStart),
      toDateKey(weekEnd),
    )

    return {
      label: `${formatDate(toDateKey(weekStart))}`,
      weekLabel: `${formatDate(toDateKey(weekStart))} - ${formatDate(toDateKey(weekEnd))}`,
      startDate: toDateKey(weekStart),
      endDate: toDateKey(weekEnd),
      income: sumTransactions(weekTransactions, 'income'),
      expense: sumTransactions(weekTransactions, 'expense'),
    }
  })
  const highestRevenue = Math.max(...weeks.map((week) => week.income), 0)
  const highestExpense = Math.max(...weeks.map((week) => week.expense), 0)
  const maxValue = Math.max(highestRevenue, highestExpense, 0)
  const axisMax = getReadableAxisMax(maxValue)
  const ticks = buildAxisTicks(axisMax)

  return { weeks, maxValue, axisMax, ticks }
}

export function getReadableAxisMax(value) {
  const safeValue = Math.max(Number(value) || 0, 1000000)

  if (safeValue <= 10000000) {
    return Math.ceil(safeValue / 1000000) * 1000000
  }

  if (safeValue <= 50000000) {
    return Math.ceil(safeValue / 5000000) * 5000000
  }

  return Math.ceil(safeValue / 10000000) * 10000000
}

function buildAxisTicks(axisMax) {
  const step = axisMax / 4
  return [axisMax, step * 3, step * 2, step, 0]
}

function buildAttendanceSummary({ students, attendanceRecords, weekStartDate, weekEndDate }) {
  const totalCount = students.length
  const activeStudentIds = new Set(students.map((student) => String(student.id ?? '')).filter(Boolean))
  const presentStudentIds = new Set()
  const weekRecords = (attendanceRecords ?? []).filter((record) => {
    const date = String(record.date || record.occurrenceDate || '').slice(0, 10)
    return date >= weekStartDate && date <= weekEndDate
  })

  weekRecords.forEach((record) => {
    const studentId = String(record.studentId ?? '')
    if (!activeStudentIds.has(studentId)) {
      return
    }

    const status = normalizeText(record.attendanceStatus || record.status)
    if (
      record.counted ||
      status.includes('present') ||
      status.includes('hoc') ||
      status.includes('di hoc') ||
      status.includes('co mat')
    ) {
      presentStudentIds.add(studentId)
    }
  })

  const presentCount = presentStudentIds.size
  const absentCount = Math.max(0, totalCount - presentCount)

  return {
    totalCount,
    presentCount,
    absentCount,
    hasAttendanceData: weekRecords.length > 0,
  }
}

function normalizeActiveStudents(students) {
  return (Array.isArray(students) ? students : []).filter((student) => {
    if (!student || student.isDeleted) {
      return false
    }

    const status = normalizeText(student.status || student.learningStatus)
    return !status || status.includes('dang') || status.includes('active')
  })
}

function filterTransactionsByDate(transactions, date) {
  return (Array.isArray(transactions) ? transactions : []).filter(
    (transaction) => String(transaction.transactionDate || transaction.date || '').slice(0, 10) === date,
  )
}

function filterTransactionsByRange(transactions, startDate, endDate) {
  return (Array.isArray(transactions) ? transactions : []).filter((transaction) => {
    const transactionDate = String(transaction.transactionDate || transaction.date || '').slice(0, 10)
    return transactionDate >= startDate && transactionDate <= endDate
  })
}

function sumTransactions(transactions, type) {
  return (transactions ?? []).reduce((sum, transaction) => {
    if (transaction.type !== type) {
      return sum
    }

    const amount = Number(transaction.amount)
    return Number.isFinite(amount) ? sum + Math.max(0, amount) : sum
  }, 0)
}

function buildWeekDays(weekStartDate) {
  const startDate = parseReportDate(weekStartDate) ?? new Date()
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(startDate, index)))
}

function normalizeReportFilters(filters = {}) {
  const reportDate = isDateKey(filters.reportDate) ? filters.reportDate : getTodayDate()
  const weekStartDate = isDateKey(filters.weekStartDate)
    ? filters.weekStartDate
    : getWeekStartDate(reportDate)

  return { reportDate, weekStartDate }
}

function getBarPercent(value, maxValue) {
  if (!maxValue) {
    return 0
  }

  return Math.max(2, Math.min(100, (Number(value || 0) / maxValue) * 100))
}

function formatAxisMoney(amount) {
  const value = Number(amount || 0)

  if (value >= 1000000) {
    return `${Number(value / 1000000).toLocaleString('vi-VN')} triệu`
  }

  return formatMoney(value)
}

function formatSignedMoney(transaction) {
  const sign = transaction.type === 'expense' ? '-' : '+'
  return `${sign}${formatMoney(transaction.amount)}`
}

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString('vi-VN')} VNĐ`
}

function formatDate(value) {
  const [year, month, day] = String(value ?? '').split('-')
  return year && month && day ? `${day}/${month}/${year}` : '—'
}

function getTodayDate() {
  return toDateKey(new Date())
}

export function getWeekStartDate(value) {
  const date = parseReportDate(value) ?? new Date()
  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day

  return toDateKey(addDays(date, mondayOffset))
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function parseDateKey(value) {
  if (!isDateKey(value)) {
    return null
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseReportDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  return parseDateKey(value)
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeReportCenterInfo(centerInfo = null) {
  const code = String(centerInfo?.centerId || centerInfo?.code || '').trim()
  const name = String(centerInfo?.centerName || centerInfo?.name || '').trim()
  const isResolved = centerInfo?.ok === true && /^[A-Za-z0-9_-]{1,160}$/.test(code)
  return {
    displayName: isResolved ? (name || code) : 'chưa xác định',
    codeLabel: isResolved ? code : 'chưa-xác-định',
  }
}

function slugifyFilenamePart(value) {
  const slug = normalizeText(value)
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'chua-xac-dinh'
}

function escapeAttribute(value) {
  return String(value ?? '').replace(/"/g, '&quot;')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
