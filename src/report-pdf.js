import { formatReportMoney, getReportAttendanceSegments, initialReportDraft, reportPendingTaskItems } from './report-module.js'

export const REPORT_PDF_PAGE = Object.freeze({ width: 841.8898, height: 595.2756, label: 'A4 landscape' })
const M = 24, BOTTOM = 554, SCALE = 3
const colors = { canvas: '#f5f6f8', surface: '#ffffff', border: '#e2e6ed', ink: '#111827', secondary: '#4b5563', muted: '#6b7280', income: '#047857', expense: '#dc2626' }
const clean = value => String(value ?? '').replace(/\r\n?/g, '\n')

export function createReportPdfProjection(snapshot = {}) {
  const data = snapshot.data
  if (!data?.filters || !Array.isArray(data.weeklyBars?.weeks)
    || !Array.isArray(data.dailyTransactions) || !Array.isArray(data.weeklyTransactions)) {
    throw new Error('Chưa tải được báo cáo. Vui lòng làm mới trước khi xuất PDF.')
  }
  const viewMode = snapshot.viewMode === 'week' ? 'week' : 'day'
  if (viewMode === 'week' && (!data.attendanceSummary?.available
    || data.attendanceSummary.source !== 'A6_CANONICAL_ATTENDANCE_LEDGER')) {
    throw new Error('Chưa tải được sổ điểm danh canonical của tuần đang chọn.')
  }
  if (![data.dailyIncome, data.dailyExpense, data.dailyBalance, data.dailySourceTotal,
    data.weeklyIncome, data.weeklyExpense, data.weeklyBalance].every(Number.isFinite)) {
    throw new Error('Số liệu báo cáo chưa hợp lệ. Vui lòng làm mới.')
  }
  return structuredClone({ source: 'REPORT_UI_SNAPSHOT_WITH_A6_ATTENDANCE', viewMode, data,
    draft: { ...initialReportDraft, ...snapshot.draft },
    centerName: clean(snapshot.centerInfo?.centerName || snapshot.centerInfo?.name || snapshot.centerInfo?.displayName || 'Cơ sở'),
    centerId: clean(snapshot.centerId || snapshot.centerInfo?.centerId || 'co-so') })
}

export async function generateReportPdf(snapshot, options = {}) {
  // Capture the exact rendered report before any asynchronous PDF work.
  const projection = createReportPdfProjection(snapshot)
  const documentRef = options.documentRef || globalThis.document
  if (!documentRef?.createElement) throw new Error('Trình duyệt hiện tại không hỗ trợ tạo PDF báo cáo.')
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Báo cáo ${projection.viewMode === 'week' ? 'Tuần' : 'Ngày'} · ${projection.centerName}`)
  pdf.setCreator('iChess Reports')
  const { width: W, height: H } = REPORT_PDF_PAGE
  const surfaces = [], textRegions = [], chartProof = []
  let canvas, ctx, pageIndex, y
  const font = (size = 10, weight = 400) => { ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif` }
  const text = (value, x, top, size = 10, color = colors.ink, weight = 400) => {
    const content = clean(value)
    font(size, weight)
    ctx.fillStyle = color
    ctx.textBaseline = 'top'
    ctx.fillText(content, x, top)
    textRegions.push({ page: pageIndex + 1, value: content, x, y: top, width: ctx.measureText(content).width, height: size * 1.35 })
  }
  const wrap = (value, width, size = 10, weight = 400) => {
    font(size, weight)
    return clean(value).split('\n').flatMap(paragraph => {
      if (!paragraph.trim()) return ['']
      const lines = []
      let line = ''
      for (const word of paragraph.trim().split(/\s+/)) {
        const next = line ? `${line} ${word}` : word
        if (ctx.measureText(next).width <= width) { line = next; continue }
        if (line) { lines.push(line); line = '' }
        for (const character of word) {
          if (line && ctx.measureText(line + character).width > width) { lines.push(line); line = '' }
          line += character
        }
      }
      if (line) lines.push(line)
      return lines
    })
  }
  const rect = (x, top, width, height, fill = colors.surface, radius = 6, stroke = colors.border) => {
    ctx.beginPath()
    ctx.roundRect(x, top, width, height, radius)
    ctx.fillStyle = fill
    ctx.fill()
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.65; ctx.stroke() }
  }
  const line = (x1, y1, x2, y2, color = colors.border) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = 0.6; ctx.stroke()
  }
  const newPage = () => {
    canvas = documentRef.createElement('canvas')
    canvas.width = Math.ceil(W * SCALE); canvas.height = Math.ceil(H * SCALE)
    ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Không tạo được trang PDF báo cáo.')
    ctx.scale(SCALE, SCALE)
    ctx.fillStyle = colors.canvas; ctx.fillRect(0, 0, W, H)
    surfaces.push(canvas); pageIndex = surfaces.length - 1
    text(`Báo cáo · ${projection.viewMode === 'week' ? 'Tuần' : 'Ngày'}`, M, 22, 21, colors.ink, 600)
    const period = projection.viewMode === 'week' ? projection.data.weekLabel : projection.data.reportDateLabel
    text(period, M, 53, 10, colors.secondary)
    const centerLines = wrap(projection.centerName, 300, 10, 500).slice(0, 3)
    centerLines.forEach((value, index) => text(value, W - M - 300, 25 + index * 14, 10, colors.secondary, 500))
    y = Math.max(78, 25 + centerLines.length * 14 + 10)
  }
  const stats = () => {
    const { data, viewMode } = projection
    const items = viewMode === 'week' ? [
      ['Tổng doanh thu', formatReportMoney(data.weeklyIncome), colors.income],
      ['Tổng chi phí', formatReportMoney(data.weeklyExpense), colors.expense],
      ['Còn lại', formatReportMoney(data.weeklyBalance), colors.ink],
      ['Tổng học viên', data.studentCount.toLocaleString('vi-VN'), colors.ink],
    ] : [
      ['Doanh thu trong ngày', formatReportMoney(data.dailyIncome), colors.income],
      ['Chi phí trong ngày', formatReportMoney(data.dailyExpense), colors.expense],
      ['Còn lại', formatReportMoney(data.dailyBalance), colors.ink],
      ['Nguồn giao dịch ngày', `${data.dailyTransactions.length.toLocaleString('vi-VN')} giao dịch`, colors.ink, formatReportMoney(data.dailySourceTotal)],
    ]
    const gap = 10, width = (W - M * 2 - gap * 3) / 4
    const prepared = items.map(item => ({ item, values: wrap(item[1], width - 24, 16, 600) }))
    const height = Math.max(...prepared.map(({ item, values }) => 31 + values.length * 21 + (item[3] ? 15 : 0)), 69)
    prepared.forEach(({ item, values }, index) => {
      const x = M + index * (width + gap)
      rect(x, y, width, height)
      text(item[0], x + 12, y + 10, 9, colors.secondary, 500)
      values.forEach((value, row) => text(value, x + 12, y + 28 + row * 21, 16, item[2], 600))
      if (item[3]) text(item[3], x + 12, y + 30 + values.length * 21, 9, colors.secondary)
    })
    y += height + 12
  }
  const cashflowChart = (x, top, width, height) => {
    const chart = projection.data.weeklyBars
    rect(x, top, width, height)
    text('Thu / Chi theo tuần', x + 14, top + 13, 12, colors.ink, 600)
    text('Đơn vị: VNĐ', x + 14, top + 34, 8.5, colors.muted)
    const left = x + 69, right = x + width - 15, chartTop = top + 62, plotHeight = 139, bottom = chartTop + plotHeight
    chart.ticks.forEach((tick, index) => {
      const ty = chartTop + index / (chart.ticks.length - 1) * plotHeight
      line(left, ty, right, ty)
      const label = tick >= 1000000 ? `${Number((tick / 1000000).toFixed(1))}tr` : `${Math.round(tick / 1000)}k`
      text(label, x + 14, ty - 5, 8, colors.muted)
    })
    const group = (right - left) / chart.weeks.length
    chart.weeks.forEach((week, index) => {
      for (const [type, offset, color] of [['income', -17, colors.income], ['expense', 2, colors.expense]]) {
        const value = week[type], barHeight = Math.max(2, Math.min(100, value / chart.axisMax * 100)) / 100 * plotHeight
        rect(left + group * (index + 0.5) + offset, bottom - barHeight, 15, barHeight, color, 2, null)
      }
      const label = week.label.slice(0, 5)
      text(label, left + group * (index + 0.5) - 14, bottom + 9, 8, colors.secondary)
    })
    rect(x + 15, top + height - 24, 8, 8, colors.income, 4, null)
    text('Doanh thu', x + 28, top + height - 25, 9, colors.secondary)
    rect(x + 127, top + height - 24, 8, 8, colors.expense, 4, null)
    text('Chi phí', x + 140, top + height - 25, 9, colors.secondary)
    chartProof.push({ page: pageIndex + 1, type: 'cashflow', x, y: top, width, height, data: structuredClone(chart) })
  }
  const attendanceChart = (x, top, width, height) => {
    const summary = projection.data.attendanceSummary
    const segments = getReportAttendanceSegments(summary)
    rect(x, top, width, height)
    text('Có mặt / Vắng / Học bù', x + 14, top + 13, 12, colors.ink, 600)
    text('Lượt học viên theo từng buổi trong tuần', x + 14, top + 34, 8.5, colors.muted)
    const cx = x + 91, cy = top + 134, radius = 64
    let angle = -Math.PI / 2
    if (!summary.totalCount) {
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fillStyle = colors.border; ctx.fill()
    }
    for (const segment of segments) if (segment.count) {
      const end = angle + segment.count / summary.totalCount * Math.PI * 2
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, angle, end); ctx.closePath(); ctx.fillStyle = segment.color; ctx.fill()
      angle = end
    }
    ctx.beginPath(); ctx.arc(cx, cy, radius - 23, 0, Math.PI * 2); ctx.fillStyle = colors.surface; ctx.fill()
    const legendX = x + 171
    segments.forEach((segment, index) => {
      const ty = top + 75 + index * 24
      rect(legendX, ty + 3, 8, 8, segment.color, 4, null)
      text(`${segment.label}: ${segment.count.toLocaleString('vi-VN')}`, legendX + 14, ty, 9.5, colors.secondary)
    })
    text(`Tổng lượt: ${summary.totalCount.toLocaleString('vi-VN')}`, legendX, top + 75 + segments.length * 24, 9.5, colors.ink, 600)
    if (summary.futureCount || summary.cancelledCount) text(`Chưa đến giờ: ${summary.futureCount} · Đã hủy: ${summary.cancelledCount}`, x + 14, top + height - 24, 8.5, colors.muted)
    else if (!summary.totalCount) text('Chưa có lượt điểm danh trong tuần đang chọn.', x + 14, top + height - 24, 8.5, colors.muted)
    chartProof.push({ page: pageIndex + 1, type: 'attendance', x, y: top, width, height, data: structuredClone(summary) })
  }
  const dailyWorkspace = () => {
    const gap = 12, leftWidth = (W - M * 2 - gap) * 0.6, rightWidth = W - M * 2 - gap - leftWidth
    const left = [], right = []
    const field = (target, title, value, width, fallback) => {
      target.push({ label: title, kind: 'heading', height: 21 })
      for (const label of wrap(value || fallback, width - 28, 10)) target.push({ label, kind: 'text', height: 15 })
      target.push({ kind: 'gap', height: 9 })
    }
    const draft = projection.draft
    field(left, 'Công việc ngày', draft.dailyTasks, leftWidth, 'Chưa nhập công việc ngày.')
    field(left, 'Tình huống / vấn đề xảy ra trong ngày', draft.dailyIssues, leftWidth, 'Chưa ghi nhận tình huống / vấn đề.')
    field(left, 'Ghi chú vận hành', draft.operationNote, leftWidth, 'Chưa có ghi chú vận hành.')
    for (const item of reportPendingTaskItems) right.push({ label: item.label, checked: Boolean(draft.pendingTasks?.[item.key]), kind: 'check', height: 23 })
    field(right, 'Công việc khác', draft.otherPendingTasks, rightWidth, 'Chưa nhập công việc khác.')
    field(right, 'Người phụ trách', draft.ownerName, rightWidth, 'Chưa nhập người phụ trách.')
    const take = (records, maxHeight) => {
      const taken = []
      let used = 0
      while (records.length && used + records[0].height <= maxHeight) {
        if (records[0].kind === 'heading' && used + records[0].height + (records[1]?.height || 0) > maxHeight) break
        const record = records.shift(); taken.push(record); used += record.height
      }
      return { taken, used }
    }
    const drawColumn = (title, x, width, height, records) => {
      rect(x, y, width, height)
      text(title, x + 14, y + 13, 12, colors.ink, 600)
      let top = y + 39
      for (const record of records) {
        if (record.kind === 'check') {
          rect(x + 14, top + 1, 10, 10, record.checked ? colors.ink : colors.surface, 2)
          if (record.checked) {
            ctx.beginPath(); ctx.moveTo(x + 16, top + 6); ctx.lineTo(x + 19, top + 9); ctx.lineTo(x + 23, top + 3); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke()
          }
          text(record.label, x + 31, top, 10, colors.secondary)
        } else if (record.kind !== 'gap') text(record.label, x + 14, top, record.kind === 'heading' ? 9.5 : 10, record.kind === 'heading' ? colors.secondary : colors.ink, record.kind === 'heading' ? 600 : 400)
        top += record.height
      }
    }
    let continuation = false
    while (left.length || right.length) {
      if (continuation) { newPage(); stats() }
      const maxHeight = BOTTOM - y - 51
      const a = take(left, maxHeight), b = take(right, maxHeight)
      const height = Math.max(a.used, b.used, continuation ? 36 : 215) + 51
      drawColumn(`Ghi nhận vận hành trong ngày${continuation ? ' (tiếp)' : ''}`, M, leftWidth, height, a.taken)
      drawColumn(`Checklist công việc ngày${continuation ? ' (tiếp)' : ''}`, M + leftWidth + gap, rightWidth, height, b.taken)
      y += height + 12
      continuation = true
    }
  }
  const sourceTransactions = () => {
    const transactions = projection.viewMode === 'week' ? projection.data.weeklyTransactions : projection.data.dailyTransactions
    const rows = transactions.slice(0, 5).map(item => ({
      ...item, labels: wrap(`${item.category || 'Khác'} · ${item.personName || item.recordedBy || 'Chưa rõ'}`, W - M * 2 - 180, 9.5),
      amountLabels: wrap(`${item.type === 'expense' ? '−' : '+'}${formatReportMoney(item.amount)}`, 138, 10, 600),
    }))
    if (y + 78 > BOTTOM) newPage()
    const heading = () => {
      text('Nguồn giao dịch', M + 14, y + 11, 12, colors.ink, 600)
      text(transactions.length ? `${transactions.length.toLocaleString('vi-VN')} giao dịch thu/chi trong ${projection.viewMode === 'week' ? 'tuần' : 'ngày'} đang chọn.` : `Chưa có giao dịch thu/chi trong ${projection.viewMode === 'week' ? 'tuần' : 'ngày'} đang chọn.`, M + 14, y + 33, 9, colors.secondary)
    }
    while (rows.length || !transactions.length) {
      const top = y, available = BOTTOM - y
      const batch = []
      let height = 59
      while (rows.length) {
        const row = rows[0]
        const fullHeight = Math.max(29, Math.max(row.labels.length, row.amountLabels.length) * 14 + 9)
        if (height + fullHeight <= available) {
          rows.shift(); batch.push({ ...row, height: fullHeight }); height += fullHeight
        } else if (!batch.length && y <= 78) {
          // A single unusually long source label can span pages safely.
          const count = Math.floor((available - height - 9) / 14)
          if (count < 1) throw new Error('Không đủ không gian để in giao dịch nguồn.')
          const labels = row.labels.splice(0, count), amountLabels = row.amountLabels.splice(0, count)
          const rowHeight = Math.max(29, Math.max(labels.length, amountLabels.length) * 14 + 9)
          batch.push({ ...row, labels, amountLabels, height: rowHeight }); height += rowHeight
          if (!row.labels.length && !row.amountLabels.length) rows.shift()
          break
        } else break
      }
      if (rows.length && !batch.length) { newPage(); continue }
      rect(M, top, W - M * 2, height)
      heading()
      let rowTop = top + 56
      for (const row of batch) {
        line(M + 14, rowTop - 3, W - M - 14, rowTop - 3)
        row.labels.forEach((label, index) => text(label, M + 14, rowTop + index * 14, 9.5))
        row.amountLabels.forEach((label, index) => text(label, W - M - 152, rowTop + index * 14, 10, row.type === 'expense' ? colors.expense : colors.income, 600))
        rowTop += row.height
      }
      y += height + 12
      if (!rows.length) break
      newPage()
    }
  }
  newPage(); stats()
  if (projection.viewMode === 'week') {
    const width = (W - M * 2 - 12) / 2, height = 251
    cashflowChart(M, y, width, height)
    attendanceChart(M + width + 12, y, width, height)
    y += height + 12
  } else dailyWorkspace()
  sourceTransactions()
  for (const [index, surface] of surfaces.entries()) {
    canvas = surface; ctx = canvas.getContext('2d'); pageIndex = index
    const footer = `Trang ${index + 1}/${surfaces.length}`
    text(footer, W - M - 68, H - 23, 8, colors.muted)
    const bytes = options.canvasToPng ? await options.canvasToPng(surface) : new Uint8Array(await new Promise((resolve, reject) => {
      surface.toBlob(blob => blob ? blob.arrayBuffer().then(resolve, reject) : reject(new Error('Không tạo được hình trang PDF.')), 'image/png')
    }))
    const image = await pdf.embedPng(bytes)
    pdf.addPage([W, H]).drawImage(image, { x: 0, y: 0, width: W, height: H })
  }
  const bytes = await pdf.save()
  const date = projection.viewMode === 'week' ? projection.data.filters.weekStartDate : projection.data.filters.reportDate
  const center = projection.centerId.replace(/[^a-zA-Z0-9_-]+/g, '-')
  return { blob: new Blob([bytes], { type: 'application/pdf' }), source: projection.source,
    fileName: `bao-cao-${projection.viewMode === 'week' ? 'tuan' : 'ngay'}-${center}-${date}.pdf`,
    pageCount: surfaces.length, pageSize: REPORT_PDF_PAGE, projection,
    ...(options.includeLayoutProof ? { textRegions, charts: chartProof } : {}) }
}
