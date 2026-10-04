import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { PDFDocument } from 'pdf-lib'

const outputDir = path.resolve('artifacts/reports-m6-1')
fs.mkdirSync(outputDir, { recursive: true })
const env = fs.readFileSync('.env.local', 'utf8')
const remoteOrigin = new URL(env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1]).origin
const credentialChoice = JSON.parse(fs.readFileSync('artifacts/phongtrong-attendance-dataset/credential-selector.json', 'utf8'))
  .matches.find(item => item.role === 'owner').credentialIndex
const lines = fs.readFileSync('testgmailtk.txt', 'utf8').split(/\r?\n/)
const emailIndex = lines.map((line, index) => /^Gmail\s*:/i.test(line) ? index : -1).filter(index => index >= 0)[credentialChoice]
const email = lines[emailIndex].split(':').slice(1).join(':').trim()
const password = lines[emailIndex + 1].split(':').slice(1).join(':').trim()
assert(email.includes('@') && password)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-reports-m6-1-'))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const result = { viewport: '1536x728', cases: {}, blockedWrites: [], exceptions: [], requests: [], dialogs: [] }
let ws, commandId = 0, phase = 'login'
const pending = new Map()
try {
  const portFile = path.join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await delay(100)
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0])
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++commandId, { resolve, reject })
    ws.send(JSON.stringify({ id: commandId, method, params }))
  })
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data), job = pending.get(message.id), params = message.params
    if (job) { pending.delete(message.id); message.error ? job.reject(new Error(JSON.stringify(message.error))) : job.resolve(message.result); return }
    if (message.method === 'Runtime.exceptionThrown') result.exceptions.push(params.exceptionDetails.exception?.description || params.exceptionDetails.text)
    if (message.method === 'Page.javascriptDialogOpening') { result.dialogs.push(params.message); void cdp('Page.handleJavaScriptDialog', { accept: true }) }
    if (message.method === 'Network.requestWillBeSent' && params.request.url.startsWith(remoteOrigin + '/rest/v1/')) {
      const endpoint = params.request.url.slice((remoteOrigin + '/rest/v1/').length).split('?')[0]
      result.requests.push({ endpoint, method: params.request.method, phase })
    }
    if (message.method === 'Fetch.requestPaused') {
      const request = params.request, endpoint = request.url.slice((remoteOrigin + '/rest/v1/').length).split('?')[0]
      const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
        || endpoint.startsWith('rpc/') && /(?:^|_)(?:get|list|read|verify)(?:_|$)/.test(endpoint)
      if (read) void cdp('Fetch.continueRequest', { requestId: params.requestId })
      else { result.blockedWrites.push({ endpoint, method: request.method, phase }); void cdp('Fetch.failRequest', { requestId: params.requestId, errorReason: 'BlockedByClient' }) }
    }
  })
  const evaluate = async expression => {
    const value = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text)
    return value.result.value
  }
  const waitFor = async (expression, timeout = 90000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await delay(180) }
    throw new Error(`UI timeout in ${phase}: ${expression}; ${(await evaluate('document.body.innerText')).slice(-800)}`)
  }
  const click = async selector => {
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`)
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`)
    await delay(100)
    const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
  }
  const set = async (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.focus();el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  const snapshot = () => evaluate(`(()=>({view:document.querySelector('.report-module')?.dataset.reportView,
    period:document.querySelector('.report-module [data-report-filter]')?.value,
    focused:document.activeElement?.matches?.('.report-module [data-report-filter]')||false,
    cards:[...document.querySelectorAll('.report-module .report-stat')].map(el=>el.innerText),
    attendance:document.querySelector('[data-report-attendance-summary]')?JSON.parse(document.querySelector('[data-report-attendance-summary]').dataset.reportAttendanceSummary):null,
    bars:[...document.querySelectorAll('[data-report-bar-value]')].map(el=>Number(el.dataset.reportBarValue)),
    checklist:document.querySelectorAll('[data-report-pending-task]').length,
    exportReady:!!document.querySelector('.report-module [data-report-action="download"]:not(:disabled)'),
    source:document.querySelector('.report-source-section')?.innerText,
    wording:document.querySelector('.report-module')?.getAttribute('aria-label')}))()`)
  const screenshot = async name => {
    const image = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    fs.writeFileSync(path.join(outputDir, `${name}.png`), Buffer.from(image.data, 'base64'))
  }
  const ready = () => waitFor(`!!document.querySelector('.report-module [data-report-action="download"]:not(:disabled)')
    && !document.querySelector('.is-report-window [data-module-authoritative-refresh="bao-cao"]:disabled')`)
  const centerSelector = id => `[data-internal-open-center-id="${id}"]:not(:disabled)`
  const switchCenter = async id => {
    phase = `switch-${id}`
    await evaluate(`window.location.hash='#/internal/centers'`)
    await waitFor(`!!document.querySelector(${JSON.stringify(centerSelector(id))})`)
    await evaluate(`document.querySelector(${JSON.stringify(centerSelector(id))}).click()`)
    await waitFor(`!!document.querySelector('.report-module')`)
  }

  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Network.enable')
  await cdp('Fetch.enable', { patterns: [{ urlPattern: `${remoteOrigin}/rest/v1/*`, requestStage: 'Request' }] })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1536, height: 728, deviceScaleFactor: 1, mobile: false })
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5173/ichess-center-os/' })
  await waitFor('!!document.querySelector("[data-cloud-login-form]")')
  await delay(1200)
  await set('[data-cloud-login-form] [name="email"]', email)
  await set('[data-cloud-login-form] [name="password"]', password)
  await click('[data-cloud-login-form] button[type="submit"]')
  await waitFor('!!document.querySelector("[data-internal-open-center-id]") || !!document.querySelector("[data-module-launcher]")')
  await delay(1500)
  if (!(await evaluate(`document.body.innerText.includes('Cơ sở: Phòng Trống')&&!!document.querySelector('[data-module-launcher]')`))) {
    await evaluate(`window.location.hash='#/internal/centers'`)
    await waitFor(`!!document.querySelector(${JSON.stringify(centerSelector('phongtrong_prod'))})`)
    await evaluate(`document.querySelector(${JSON.stringify(centerSelector('phongtrong_prod'))}).click()`)
    await waitFor(`!!document.querySelector('[data-module-launcher]')`)
  }
  await evaluate(`(()=>{window.__m6PdfTexts=[];window.__m6PdfRegions=[];window.__m6PdfUrls=[];
    const fill=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(value,x,y,...rest){if(this.canvas.width>2000){window.__m6PdfTexts.push(String(value));window.__m6PdfRegions.push({x,y,width:this.measureText(String(value)).width,height:Number.parseFloat(this.font.replace(/^\\d+\\s/,''))*1.35})}return fill.call(this,value,x,y,...rest)};
    const create=URL.createObjectURL;
    URL.createObjectURL=function(blob){const url=create.call(this,blob);if(blob.type==='application/pdf')window.__m6PdfUrls.push(url);return url};})()`)
  phase = 'open-reports'
  await click('[data-module-launcher][data-module-id="bao-cao"]')
  await ready()
  await set('[data-report-filter="reportDate"]', '2026-09-26')
  await ready()
  const day26 = await snapshot()
  assert(day26.focused && day26.period === '2026-09-26' && day26.cards.some(card => /Doanh thu trong ngày\s+0\s*VNĐ/.test(card)))
  await screenshot('day-26-light')
  await set('[data-report-filter="reportDate"]', '2026-09-27')
  await ready()
  const day27 = await snapshot()
  assert(day27.focused && day27.period === '2026-09-27' && day27.cards.some(card => card.includes('3.200.000')))
  assert(day27.source.includes('1.600.000'))
  await screenshot('day-27-light')
  const pdfBefore = await evaluate('window.__m6PdfUrls.length')
  await click('[data-report-action="download"]')
  await waitFor(`window.__m6PdfUrls.length===${pdfBefore + 1}`)
  const pdfTexts = await evaluate('window.__m6PdfTexts')
  const pdfUrl = await evaluate('window.__m6PdfUrls.at(-1)')
  const pdfBase64 = await evaluate(`(async()=>{const bytes=new Uint8Array(await(await fetch(${JSON.stringify(pdfUrl)})).arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str)})()`)
  const pdf = await PDFDocument.load(Buffer.from(pdfBase64, 'base64'))
  assert(pdf.getPages().every(page => Math.abs(page.getWidth()-841.8898)<.001 && Math.abs(page.getHeight()-595.2756)<.001))
  assert((await evaluate('window.__m6PdfRegions')).every(region => region.x >= 23.5
    && region.x + region.width <= 841.8898 - 23.5 && region.y >= 20 && region.y + region.height <= 595.2756 - 10))
  assert(pdfTexts.includes('27/09/2026') && pdfTexts.some(text => text.includes('3.200.000')))
  assert(pdfTexts.filter(text => text.includes('1.600.000')).length >= 2)
  result.cases.date = { day26, day27, pdfPeriod: '27/09/2026', pdfIncome: 3_200_000, pdfSourceAmounts: [1_600_000, 1_600_000], pdfPages: pdf.getPageCount(), textBounds: true }
  await set('[data-report-filter="reportDate"]', '2026-09-26')
  await ready()
  assert((await snapshot()).cards.some(card => /Doanh thu trong ngày\s+0\s*VNĐ/.test(card)))
  await evaluate(`document.querySelector('[data-report-filter="reportDate"]').value='2026-09-27'`)
  await evaluate('window.__m6PdfTexts=[];window.__m6PdfRegions=[]')
  const staleBefore = await evaluate('window.__m6PdfUrls.length')
  await click('[data-report-action="download"]')
  await delay(400)
  const staleAfter = await evaluate('window.__m6PdfUrls.length')
  assert(staleAfter === staleBefore || staleAfter === staleBefore + 1)
  if (staleAfter === staleBefore + 1) {
    const afterTexts = await evaluate('window.__m6PdfTexts')
    result.cases.staleProbe = { afterTexts, after: await snapshot() }
    assert(afterTexts[1] === '27/09/2026'
      && afterTexts.some(text => text.includes('3.200.000')), 'Only the newly selected 27/09 report may export')
  }
  result.cases.stalePdfBlocked = { previousPeriodExported: false, newPeriodExported: staleAfter === staleBefore + 1 }

  await click('[data-report-view-mode="week"]')
  await set('[data-report-filter="weekStartDate"]', '2026-09-21')
  await ready()
  const weekA = await snapshot()
  assert.equal(weekA.attendance.totalCount, 86)
  assert.deepEqual([weekA.attendance.presentCount, weekA.attendance.absentCount, weekA.attendance.makeupCount, weekA.attendance.unmarkedCount], [51, 5, 1, 29])
  assert(weekA.cards.some(card => card.includes('3.200.000')) && weekA.bars.length > 0)
  assert(weekA.bars.every(Number.isFinite) && !weekA.cards.some(card => card.includes('NaN')))
  assert.equal(weekA.checklist, 0)
  await screenshot('week-phongtrong-light')
  const testerId = await evaluate(`(()=>{window.location.hash='#/internal/centers';return true})()`)
  assert(testerId)
  await waitFor('!!document.querySelector("[data-internal-open-center-id]")')
  const tester = await evaluate(`([...document.querySelectorAll('[data-internal-open-center-id]')].find(el=>/Tester/i.test(el.closest('tr, article, section')?.innerText||el.innerText))?.dataset.internalOpenCenterId)||''`)
  assert(tester, 'Phòng Tester must be available to the QA owner')
  await evaluate(`document.querySelector(${JSON.stringify(centerSelector(tester))}).click()`)
  phase = 'tester'
  await waitFor(`!!document.querySelector('.report-module')`)
  await ready()
  const weekB = await snapshot()
  assert.equal(weekB.view, 'week')
  assert.equal(weekB.period, '2026-09-21')
  assert(!weekB.cards.some(card => card.includes('3.200.000')) && weekB.attendance.totalCount === 0)
  assert(weekB.bars.every(Number.isFinite) && !weekB.cards.some(card => card.includes('NaN')))
  await screenshot('week-tester-light')
  await switchCenter('phongtrong_prod')
  await ready()
  const weekReturn = await snapshot()
  assert.equal(weekReturn.attendance.totalCount, 86)
  assert.deepEqual([weekReturn.attendance.presentCount, weekReturn.attendance.absentCount, weekReturn.attendance.makeupCount, weekReturn.attendance.unmarkedCount], [51, 5, 1, 29])
  assert(weekReturn.cards.some(card => card.includes('3.200.000')) && weekReturn.bars.length > 0)
  assert(weekReturn.bars.every(Number.isFinite) && !weekReturn.cards.some(card => card.includes('NaN')))
  result.cases.centerSwitch = { testerId: tester, weekA, weekB, weekReturn }
  await evaluate('window.__m6PdfTexts=[];window.__m6PdfRegions=[]')
  const weekPdfBefore = await evaluate('window.__m6PdfUrls.length')
  await click('[data-report-action="download"]')
  await waitFor(`window.__m6PdfUrls.length===${weekPdfBefore + 1}`)
  const weekPdfTexts = await evaluate('window.__m6PdfTexts')
  assert(weekPdfTexts.includes('21/09/2026 - 27/09/2026'))
  assert(weekPdfTexts.some(text => text.includes('3.200.000')))
  assert(weekPdfTexts.includes('Thu / Chi theo tuần'))
  assert(weekPdfTexts.includes('Có mặt: 51') && weekPdfTexts.includes('Vắng: 5')
    && weekPdfTexts.includes('Học bù: 1') && weekPdfTexts.includes('Chưa điểm danh: 29'))
  const weekPdfUrl = await evaluate('window.__m6PdfUrls.at(-1)')
  const weekPdfBase64 = await evaluate(`(async()=>{const bytes=new Uint8Array(await(await fetch(${JSON.stringify(weekPdfUrl)})).arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str)})()`)
  const weekPdf = await PDFDocument.load(Buffer.from(weekPdfBase64, 'base64'))
  assert(weekPdf.getPages().every(page => Math.abs(page.getWidth()-841.8898)<.001 && Math.abs(page.getHeight()-595.2756)<.001))
  assert((await evaluate('window.__m6PdfRegions')).every(region => region.x >= 23.5
    && region.x + region.width <= 841.8898 - 23.5 && region.y >= 20 && region.y + region.height <= 595.2756 - 10))
  result.cases.weekPdf = { period: '21/09/2026 - 27/09/2026', income: 3_200_000,
    attendance: [51, 5, 1, 29], charts: ['Thu / Chi theo tuần', 'Điểm danh'], pages: weekPdf.getPageCount(), textBounds: true }
  await click('[data-report-bar-detail][data-report-bar-type="income"][data-report-bar-value="3200000"]')
  const barDetail = await evaluate('document.querySelector(".report-bar-detail")?.innerText')
  assert(barDetail.includes('Nguồn: Sổ quỹ trong tuần đang xem') && !/authoritative|canonical/i.test(barDetail))
  result.cases.barDetail = barDetail
  await switchCenter(tester)
  await switchCenter('phongtrong_prod')
  await ready()
  assert.equal((await snapshot()).attendance.totalCount, 86)
  result.cases.rapidSwitchFinalCenter = 'phongtrong_prod'
  await click('[data-action="toggle-start"]'); await click('[data-ui-theme="dark"]')
  if (await evaluate(`document.querySelector('[data-action="toggle-start"]').getAttribute('aria-expanded')==='true'`)) await click('[data-action="toggle-start"]')
  await screenshot('week-phongtrong-dark')
  await click('[data-report-view-mode="day"]')
  await set('[data-report-filter="reportDate"]', '2026-09-27')
  await ready()
  await screenshot('day-27-dark')
  assert.equal((await snapshot()).checklist, 7)
  result.cases.themes = ['day-26-light', 'day-27-light', 'week-phongtrong-light', 'week-tester-light', 'week-phongtrong-dark', 'day-27-dark']
  assert.equal(result.blockedWrites.length, 0, 'QA did not attempt business writes')
  assert.equal(result.exceptions.length, 0, 'No browser exceptions')
  result.status = 'PASS'
  console.log('M6_1_REPORTS_BROWSER_QA PASS')
} catch (error) {
  result.status = 'FAIL'
  result.error = String(error?.stack || error)
  console.error(result.error)
  process.exitCode = 1
} finally {
  fs.writeFileSync(path.join(outputDir, 'browser-proof.json'), JSON.stringify(result, null, 2))
  ws?.close()
  chrome.kill()
}
