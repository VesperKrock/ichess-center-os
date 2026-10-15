import { readOriginalExcel, excelSha256 } from './excel-workbook-reader.js'
import { normalizeOriginalExcel } from './excel-import-normalize.js'
import { createExcelImportManifest } from './excel-import-plan.js'
import { readExcelImportTarget, executeExcelImport } from './excel-import-service.js'
import { loadExcelIntake, saveExcelIntake } from './excel-import-store.js'
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
export function createExcelImportUi({ getContext, render, refresh }) {
  let state = null
  const readTarget = () => readExcelImportTarget(getContext())
  const scoped = target => `${target.actorId}|${target.centerId}`
  const save = async (active = state) => {
    if (!active?.manifest || !active.buffer) throw Error('Thiếu manifest hoặc bản gốc.')
    const key = scoped(active.manifest.target), entry = { filename: active.filename, buffer: active.buffer, manifest: active.manifest, ledger: active.ledger || {}, result: active.result || null }
    await saveExcelIntake(`${key}|${active.manifest.sourceSha256}`, entry)
    await saveExcelIntake(`${key}|manifest|${active.manifest.sha256}`, entry)
    await saveExcelIntake(`${key}|latest`, { sourceSha256: active.manifest.sourceSha256 })
  }
  const safe = async action => {
    if (!state || state.busy) return
    const active = state; active.busy = true; active.error = ''; render()
    try { await action(active) } catch (e) { active.error = e.message || 'Không hoàn tất được. Dữ liệu đã ghi được giữ nguyên.' }
    finally { active.busy = false; render() }
  }
  async function audit(active) {
    const buffer = active.file ? await active.file.arrayBuffer() : active.buffer
    if (!buffer) throw Error('Chọn workbook gốc trước.')
    const workbook = await readOriginalExcel(buffer), facts = normalizeOriginalExcel(workbook), target = await readTarget()
    if (target.centerId !== active.centerId || getContext().centerId !== active.centerId) throw Error('Cơ sở đã thay đổi; dừng Audit.')
    const key = scoped(target), latest = await loadExcelIntake(key + '|latest'), previous = latest ? await loadExcelIntake(`${key}|${latest.sourceSha256}`) : null
    if (previous?.manifest) await saveExcelIntake(`${key}|manifest|${previous.manifest.sha256}`, previous)
    const same = previous?.manifest.sourceSha256 === facts.sourceSha256 ? previous : null
    active.buffer = buffer; active.filename = active.file?.name || active.filename
    active.manifest = await createExcelImportManifest(facts, target, { coverageConfirmed: active.coverageConfirmed, applyCenterSettings: active.applyCenterSettings, previous: previous?.manifest, createdAt: same?.manifest.createdAt })
    active.ledger = {}
    for (const command of active.manifest.commands) {
      const old = same?.ledger?.[command.id]
      if (!old) continue
      if (old.intentSha256 === command.intentSha256) active.ledger[command.id] = old
      else if (['PENDING', 'UNKNOWN'].includes(old.status) && command.status !== 'REUSE') throw Error('Đợt trước có kết quả chưa rõ và intent đã đổi; cần đối chiếu dòng đó trước khi tiếp tục.')
    }
    active.approved = false; active.result = null; await save(active)
  }
  async function run(active) {
    if (!active.approved || !active.manifest) throw Error('Duyệt manifest ở bước Audit trước khi nhập.')
    if (await excelSha256(active.buffer) !== active.manifest.sourceSha256) throw Error('Bản gốc đã đổi; cần Audit lại.')
    await save(active)
    const result = await executeExcelImport({ manifest: active.manifest, approvedSha256: active.manifest.sha256, readTarget,
      rpc: (name, args) => getContext().supabase.rpc(name, args), getCurrentCenterId: () => getContext().centerId,
      ledger: active.ledger, checkpoint: async ledger => { active.ledger = ledger; await save(active) },
      onProgress: id => { active.progress = id; render() } })
    active.result = result; await save(active); await refresh()
  }
  async function restore(active) {
    const target = await readTarget(), key = scoped(target), latest = await loadExcelIntake(key + '|latest')
    const entry = latest ? await loadExcelIntake(`${key}|${latest.sourceSha256}`) : null
    if (!entry) throw Error('Chưa có đợt import được lưu cho Admin/cơ sở này.')
    if (await excelSha256(entry.buffer) !== entry.manifest.sourceSha256) throw Error('Bản gốc lưu không khớp SHA.')
    Object.assign(active, entry, { approved: false, coverageConfirmed: entry.manifest.coverageConfirmed })
  }
  function view() {
    if (!state || state.centerId !== getContext().centerId) return ''
    const s = state, m = s.manifest, summary = m?.summary, reasons = [...new Set((m?.holds || []).map(h => `${h.domain}: ${h.reason}`))]
    return `<div class="excel-intake-backdrop"><section class="excel-intake" role="dialog" aria-modal="true" aria-label="Import Excel hai bước"><header><h3>Nhập Excel</h3><button data-excel-action="close" ${s.busy ? 'disabled' : ''}>Đóng</button></header><p>Cơ sở nhận: <strong>${esc(s.centerName || s.centerId)}</strong> · ${esc(s.centerId)}</p><section><h4>A — Audit Excel</h4><p>Chọn workbook gốc hai tab. Audit chỉ đọc; bản gốc và SHA được giữ trong trình duyệt của Admin.</p><input type="file" accept=".xlsx" data-excel-file ${s.busy ? 'disabled' : ''}><span>${esc(s.filename || '')}</span><label><input type="checkbox" data-excel-coverage ${s.coverageConfirmed ? 'checked' : ''} ${s.busy ? 'disabled' : ''}>Tôi xác nhận A đã bao gồm các buổi đến hết ngày chốt trong nguồn (${esc(m?.sourceCutoff || 'sẽ đọc từ Excel')}); từ ngày kế tiếp mới cộng thêm.</label><label><input type="checkbox" data-excel-center-settings ${s.applyCenterSettings ? 'checked' : ''} ${s.busy ? 'disabled' : ''}>Áp dụng thông tin cơ sở từ Excel (giữ cấu hình bật/tắt nghiệp vụ hiện tại).</label><div class="excel-intake-actions"><button data-excel-action="audit" ${s.busy || !s.file && !s.buffer ? 'disabled' : ''}>Audit Excel</button><button data-excel-action="restore" ${s.busy ? 'disabled' : ''}>Khôi phục đợt đã lưu</button></div>${m ? `<p data-excel-summary>${summary.expectedStudents} Student · ${summary.ca} Ca · ${summary.packages} gói · ${summary.enrollmentPairs} cặp lịch / ${summary.weekdaySelections} ngày mỗi tuần. Phụ huynh: ${summary.parentIdentities} danh tính / ${summary.parentOccurrences} lần xuất hiện.</p><p>${summary.writes} thao tác ghi được đề xuất · ${summary.reuses} reuse · ${summary.held} HOLD. ${m.previousSourceSha256 && m.previousSourceSha256 !== m.sourceSha256 ? 'Nguồn đã sửa: delta được đối chiếu với đợt trước.' : ''}</p><details><summary>SHA và nội dung dự kiến</summary><code>${esc(m.sourceSha256)}</code><ul>${m.commands.map(c => `<li>${esc(c.domain)} ${esc(c.ref)}: ${c.status === 'REUSE' ? 'Giữ bản đã có' : 'Ghi và đọc lại'}</li>`).join('')}</ul></details>${reasons.length ? `<div role="status"><strong>QUESTION / HOLD theo nghiệp vụ</strong><ul>${reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul><p>Các phần đủ điều kiện vẫn có thể nhập. Sửa nguồn hoặc xác nhận dữ kiện rồi Audit lại để xử lý phần còn giữ.</p></div>` : '<p>Không có blocker dữ kiện.</p>'}` : ''}</section><section><h4>B — Import &amp; nghiệm thu</h4><label><input type="checkbox" data-excel-approve ${s.approved ? 'checked' : ''} ${!m || s.busy ? 'disabled' : ''}>Tôi duyệt đúng cơ sở, manifest và phạm vi trên; chỉ nhập phần đủ điều kiện.</label><button data-excel-action="run" ${!m || !s.approved || s.busy ? 'disabled' : ''}>Import &amp; nghiệm thu</button><p>Giữ Student đã thành công khi một dòng lỗi. Không tạo Contact/PH1, lịch sử điểm danh, thanh toán hay Phiếu Thu; gói/A-B được lưu chờ đối chiếu tài chính.</p>${s.busy ? `<p role="status">Đang xử lý ${esc(s.progress || '')}…</p>` : ''}${s.result ? `<p data-excel-result>Đã ghi ${s.result.summary.committed}; reuse ${s.result.summary.reused}; đối chiếu thành công ${s.result.summary.reconciled}; giữ ${s.result.summary.heldCommands + s.result.summary.heldFacts}. Đã read-back dữ liệu; nghiệm thu website thực tế còn cần kiểm tra các màn hình Student / Phụ huynh / Ca / Học phí.</p>` : ''}</section>${s.error ? `<p role="alert">${esc(s.error)}</p>` : ''}</section></div>`
  }
  function bind(root = document) {
    root.querySelector('[data-student-action="open-excel-import"]')?.addEventListener('click', () => { const c = getContext(); state = { open: true, centerId: c.centerId, centerName: c.centerName, file: null, filename: '', buffer: null, coverageConfirmed: false, applyCenterSettings: false, approved: false, ledger: {}, busy: false }; render() })
    root.querySelector('[data-excel-file]')?.addEventListener('change', e => { state.file = e.target.files[0]; state.filename = state.file?.name || ''; state.manifest = null; state.approved = false; render() })
    root.querySelector('[data-excel-coverage]')?.addEventListener('change', e => { state.coverageConfirmed = e.target.checked; state.manifest = null; state.approved = false; render() })
    root.querySelector('[data-excel-center-settings]')?.addEventListener('change', e => { state.applyCenterSettings = e.target.checked; state.manifest = null; state.approved = false; render() })
    root.querySelector('[data-excel-approve]')?.addEventListener('change', e => { state.approved = e.target.checked; render() })
    root.querySelectorAll('[data-excel-action]').forEach(button => button.addEventListener('click', () => { const action = button.dataset.excelAction; if (action === 'close') { if (!state.busy) { state = null; render() } } else safe(active => action === 'audit' ? audit(active) : action === 'restore' ? restore(active) : run(active)) }))
  }
  return { view, bind }
}
