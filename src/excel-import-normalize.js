import { canonicalParentPhone, normalizeParentFullName } from './parent-identity.js'
import { validateSettingsClassSessionForm, validateSettingsTuitionPackageForm } from './settings-module.js'
import { createEmptyStudentFormState, validateStudentForm } from './student-module.js'
import { validateInitialFinancialFacts } from './excel-initial-baseline.js'
export const excelText = v => String(v ?? '').normalize('NFC').trim().replace(/[\t ]+/g, ' ')
const fold = v => normalizeParentFullName(v)
const weekdays = { T2: 'mon', T3: 'tue', T4: 'wed', T5: 'thu', T6: 'fri', T7: 'sat', CN: 'sun' }
const order = Object.values(weekdays)
export function parseExcelDays(raw) {
  const tokens = excelText(raw).toUpperCase().split(/\s*[-–—,/]\s*/)
  if (!tokens.length || tokens.some(t => !weekdays[t]) || new Set(tokens).size !== tokens.length) throw Error('Ngày học không rõ hoặc bị lặp.')
  return tokens.map(t => weekdays[t]).sort((a, b) => order.indexOf(a) - order.indexOf(b))
}
export function parseExcelTime(raw) {
  const normalized = excelText(raw).replace(/(\d{1,2})[hg](\d{2})?/gi, (_, h, min) => `${h}:${min || '00'}`)
  const m = normalized.match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/)
  if (!m || Number(m[1]) > 23 || Number(m[3]) > 23 || Number(m[2]) > 59 || Number(m[4]) > 59) throw Error('Giờ học cần dạng HH:mm-HH:mm.')
  const startTime = m[1].padStart(2, '0') + ':' + m[2], endTime = m[3].padStart(2, '0') + ':' + m[4]
  if (endTime <= startTime) throw Error('Giờ kết thúc phải sau giờ bắt đầu.')
  return { startTime, endTime }
}
export function parseExcelSchedule(raw, ca) {
  if (!excelText(raw)) throw Error('Chưa có lịch học đăng ký.')
  const selections = []
  for (const term of excelText(raw).split(/\s*;\s*/)) {
    const m = term.match(/^((?:T[2-7]|CN)(?:\s*[-–—,/]\s*(?:T[2-7]|CN))*)\s+(.+)$/i)
    if (!m) throw Error('Lịch học cần ghi ngày và khoảng giờ cho từng Ca.')
    const time = parseExcelTime(m[2])
    for (const day of parseExcelDays(m[1])) {
      const candidates = ca.filter(c => c.daysOfWeek.includes(day) && c.startTime === time.startTime && c.endTime === time.endTime)
      if (candidates.length !== 1) throw Error('Lịch chưa khớp duy nhất một Ca trong workbook.')
      if (selections.some(s => s.day === day && (s.caRef === candidates[0].ref || s.startTime < time.endTime && time.startTime < s.endTime))) throw Error('Lịch có ngày bị lặp hoặc giờ chồng nhau.')
      selections.push({ caRef: candidates[0].ref, day, ...time })
    }
  }
  return [...new Set(selections.map(s => s.caRef))].map(ref => ({ classSessionId: ref, weekdays: selections.filter(s => s.caRef === ref).map(s => s.day) }))
}
function date(raw) {
  const t = excelText(raw); if (!t) return ''
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const value = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : t
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) throw Error('Ngày không hợp lệ.')
  return value
}
const money = v => { const t = excelText(v).replace(/[. ,]/g, ''); if (!/^\d+$/.test(t)) throw Error('Số tiền phải là số nguyên VND rõ ràng.'); return Number(t) }
function financial(values, comments, pkg) {
  const discount = excelText(values[25]), program = excelText(values[26]), label = fold(values[28])
  const paymentState = { 'đã thanh toán đủ trước ichess': 'PAID_BEFORE_ICHESS', 'chưa thanh toán khoản nào': 'UNPAID', 'đã thanh toán một phần': 'PARTIAL', 'chưa biết': 'UNKNOWN', '': 'UNKNOWN' }[label]
  if (!paymentState) throw Error('Cần xác nhận trạng thái thanh toán nguồn.')
  let percent = null, fixedMinor = null, siblingVoucherMinor = null, discountKind = 'UNKNOWN'
  const voucher = /voucher.*anh\/chị\/em.*100[.,]?000/i.test(program) ? 100000 : 0
  if (fold(discount) === 'không ưu đãi') { percent = 0; fixedMinor = 0; siblingVoucherMinor = 0; discountKind = 'EXPLICIT_NONE'; if (voucher) throw Error('Không ưu đãi mâu thuẫn voucher.') }
  else if (/^Giảm\s+(\d+)%$/i.test(discount)) { percent = Number(discount.match(/\d+/)[0]); fixedMinor = 0; siblingVoucherMinor = voucher; discountKind = voucher ? 'PERCENT_THEN_SIBLING_VOUCHER' : 'PERCENT' }
  else if (/^Giảm\s+[\d.,]+\s*(VND|đ)$/i.test(discount)) { percent = 0; fixedMinor = money(discount.match(/[\d.,]+/)[0]); siblingVoucherMinor = voucher; discountKind = 'FIXED'; if (voucher) throw Error('Fixed và voucher cần đối chiếu riêng.') }
  else if (discount) throw Error('Ưu đãi chưa được nhận diện; giữ nguồn, không ép về 0.')
  const due = percent === null ? null : pkg.defaultAmount * (100 - percent) / 100 - fixedMinor - siblingVoucherMinor
  let collected = null, remaining = null
  const note = comments?.[27] || '', amounts = note.match(/Đã thu(?: giả lập)?:\s*([\d.,]+)\s*VND;\s*còn phải thu:\s*([\d.,]+)\s*VND/i)
  if (paymentState === 'PAID_BEFORE_ICHESS' && due !== null) { collected = due; remaining = 0 }
  if (paymentState === 'UNPAID') { collected = 0; remaining = due }
  if (paymentState === 'PARTIAL' && amounts) { collected = money(amounts[1]); remaining = money(amounts[2]) }
  if (amounts && paymentState !== 'UNKNOWN' && (money(amounts[1]) !== collected || money(amounts[2]) !== remaining)) throw Error('Số tiền annotation mâu thuẫn trạng thái nguồn.')
  try { return validateInitialFinancialFacts({ discountKind, percent, fixedMinor, siblingVoucherMinor, paymentState, sourceDueMinor: due, collectedMinor: collected, remainingMinor: remaining }, pkg.defaultAmount) }
  catch { throw Error(paymentState === 'PARTIAL' ? 'Cần số tiền đã thu và còn lại khớp tổng cho thanh toán một phần; Tuition giữ HOLD.' : 'Ưu đãi hoặc số tiền thanh toán chưa khớp; giữ nguyên nguồn để đối chiếu.') }
}
export function normalizeOriginalExcel(workbook) {
  if (workbook.sheets?.length !== 2) throw Error('Cần workbook gốc gồm hai tab.')
  const settings = workbook.sheets[0], sheet = workbook.sheets[1], questions = [], skipped = []
  const find = (rows, second) => rows.find(r => fold(r.cells[0]) === 'stt' && fold(r.cells[1]) === fold(second))
  const centerHeader = find(settings.rows, 'Mã cơ sở'), caHeader = find(settings.rows, 'Tên Ca / Lớp'), packageHeader = find(settings.rows, 'Tên gói'), studentHeader = find(sheet.rows, 'Họ và tên học viên')
  if (!centerHeader || !caHeader || !packageHeader || !studentHeader) throw Error('Không nhận diện đủ các bảng của workbook gốc.')
  const question = (domain, ref, reason) => questions.push({ domain, ref, reason })
  const rows = (s, start, end, domain) => s.rows.filter(r => {
    if (r.number <= start || r.number >= end || r.cells.every(v => !excelText(v))) return false
    const stt = excelText(r.cells[0]); if (stt === '0') { skipped.push({ sheet: s.name, row: r.number, reason: 'EXAMPLE' }); return false }
    if (!/^[1-9]\d*$/.test(stt)) {
      if (stt && domain !== 'STUDENT' && new Set(r.cells.map(excelText).filter(Boolean)).size === 1) skipped.push({ sheet: s.name, row: r.number, reason: 'SECTION_LABEL_OR_TEMPLATE_NOTE' })
      else question(domain, `row-${r.number}`, 'Dòng có dữ liệu nhưng STT thiếu hoặc không hợp lệ.')
      return false
    }
    if (['CA', 'PACKAGE'].includes(domain) && fold(r.cells[8]) !== 'có') { if (fold(r.cells[8]) !== 'không') question(domain, `row-${r.number}`, 'Cần xác nhận Dùng cho import?'); return false }
    return true
  })
  const centerRows = rows(settings, centerHeader.number, caHeader.number, 'CENTER')
  if (centerRows.length !== 1) throw Error('Cần đúng một dòng cơ sở nguồn.')
  const cv = centerRows[0].cells, center = { businessCode: excelText(cv[1]), displayName: excelText(cv[2]), address: excelText(cv[3]), phone: excelText(cv[4]), renewalMaterialFee: excelText(cv[5]) ? money(cv[5]) : null, receiptPrefix: excelText(cv[6]), defaultReceiptCollectorName: excelText(cv[7]), note: excelText(cv[8]) }
  const ca = []
  for (const r of rows(settings, caHeader.number, packageHeader.number, 'CA')) try {
    const v = r.cells, item = { ref: `CA-${v[0]}`, sourceRow: r.number, alias: excelText(v[1]), daysOfWeek: parseExcelDays(v[2]), ...parseExcelTime(v[3]), teacherDisplayName: excelText(v[5]), status: fold(v[6]) === 'đang dùng' ? 'active' : fold(v[6]) === 'ngưng dùng' ? 'inactive' : '', note: excelText(v[7]) }
    const errors = validateSettingsClassSessionForm(item); if (!item.status || Object.keys(errors).length) throw Error(Object.values(errors).join(' ') || 'Trạng thái Ca chưa rõ.'); ca.push(item)
  } catch (e) { question('CA', `CA-${r.cells[0]}`, e.message) }
  const cutoffHeader = settings.rows.find(r => r.cells.some(v => fold(v) === 'ngày chốt số buổi đã học'))
  const cutoffColumn = cutoffHeader?.cells.findIndex(v => fold(v) === 'ngày chốt số buổi đã học')
  let cutoff = ''; try { cutoff = date(settings.rows.find(r => r.number === cutoffHeader?.number + 1)?.cells[cutoffColumn]) } catch { question('TUITION', 'cutoff', 'Cần xác nhận ngày chốt baseline.') }
  const packages = []
  for (const r of rows(settings, packageHeader.number, cutoffHeader?.number || Infinity, 'PACKAGE')) try {
    const v = r.cells, p = { ref: `PKG-${v[0]}`, sourceRow: r.number, packageName: excelText(v[1]), totalSessions: Number(v[2]), defaultAmount: money(v[3]), programName: excelText(v[4]), maxCompletionWeeks: excelText(v[5]) ? Number(v[5]) : null, isActive: fold(v[6]) === 'đang dùng', note: excelText(v[7]) }
    const errors = validateSettingsTuitionPackageForm({ ...p, maxCompletionWeeks: p.maxCompletionWeeks ?? '' }); if (Object.keys(errors).length) throw Error(Object.values(errors).join(' ')); packages.push(p)
  } catch (e) { question('PACKAGE', `PKG-${r.cells[0]}`, e.message) }
  const students = []
  for (const r of rows(sheet, studentHeader.number, Infinity, 'STUDENT')) {
    const v = r.cells, ref = `STT-${v[0]}`, item = { ref, stt: Number(v[0]), sourceRow: r.number, sourceSheet: sheet.name, values: null, tuition: null }
    try {
      const birth = excelText(v[5]), yearOnly = /^\d{4}$/.test(birth)
      const values = { ...createEmptyStudentFormState().values, fullName: excelText(v[1]), homeName: excelText(v[2]), schoolName: excelText(v[3]), schoolGrade: excelText(v[4]), birthYearOnly: yearOnly, birthYear: yearOnly ? birth : '', birthDate: yearOnly ? '' : date(birth), gender: ({ nam: 'male', nữ: 'female', 'chưa cập nhật': '', '': '' })[fold(v[6])], registrationDate: date(v[7]), priorChessKnowledge: ({ 'đã biết': 'known', 'chưa biết': 'not_known', 'chưa cập nhật': '', '': '' })[fold(v[8])], hobbies: excelText(v[9]), personality: excelText(v[10]), parentGoal: excelText(v[11]), hometown: excelText(v[12]), nationality: excelText(v[13]), currentStatus: excelText(v[14]), level: excelText(v[15]), highestBotMilestone: excelText(v[16]), fatherName: excelText(v[18]), fatherPhone: excelText(v[19]), motherName: excelText(v[20]), motherPhone: excelText(v[21]), parentArea: excelText(v[22]), recurringEnrollments: parseExcelSchedule(v[17], ca), useAuthoritativeEnrollment: true }
      for (const role of ['father', 'mother']) { const phone = values[role + 'Phone']; if (phone) { const canonical = canonicalParentPhone(phone); if (!/^\+84[35789]\d{8}$/.test(canonical)) throw Error('Số liên hệ không hợp lệ; không đoán chữ số bị mất.'); values[role + 'Phone'] = '0' + canonical.slice(3) } }
      const errors = validateStudentForm(values, ca.map(c => ({ ...c, id: c.ref }))); if (Object.keys(errors).length) throw Error(Object.values(errors).join(' '))
      item.values = values
    } catch (e) { question('STUDENT', ref, e.message) }
    const packageName = excelText(v[23])
    if (packageName) try {
      const matches = packages.filter(p => fold(p.packageName) === fold(packageName)), ab = excelText(v[24]).match(/^(\d+)\s*\/\s*(\d+)$/)
      if (matches.length !== 1 || !ab || Number(ab[2]) !== matches[0].totalSessions || Number(ab[1]) > Number(ab[2])) throw Error('Gói và A/B chưa khớp; không đoán số buổi.')
      item.tuition = { packageRef: matches[0].ref, used: Number(ab[1]), total: Number(ab[2]), cutoff, financialFacts: financial(v, r.comments, matches[0]), paymentDate: date(v[27]), rawFinancial: v.slice(23, 29), sourceComments: r.comments }
    } catch (e) { question('TUITION', ref, e.message); item.tuition = { held: true, rawFinancial: v.slice(23, 29), sourceComments: r.comments } }
    else if (excelText(v[24])) question('TUITION', ref, 'Có A/B nhưng thiếu gói; giữ pending, không tự gán gói.')
    students.push(item)
  }
  const duplicated = students.filter((s, i) => students.findIndex(t => t.ref === s.ref) !== i)
  duplicated.forEach(s => question('STUDENT', s.ref, 'Trùng STT trong nguồn.'))
  return { sourceSha256: workbook.sourceSha256, center, ca, packages, students, cutoff, questions, skipped }
}
