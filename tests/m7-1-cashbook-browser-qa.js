import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const outputDir = path.resolve('artifacts/cashbook-m7-1')
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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-cashbook-m7-1-'))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const result = { viewport: '1536x728', cases: {}, blockedWrites: [], exceptions: [], requests: [] }
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
    throw new Error(`UI timeout in ${phase}: ${expression}; ${(await evaluate('document.body.innerText')).slice(-900)}`)
  }
  const click = async selector => {
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`)
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`)
    await delay(80)
    const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
  }
  const set = async (selector, value, event = 'input') => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.focus();el.value=${JSON.stringify(value)};el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`)
  const screenshot = async name => {
    const image = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    fs.writeFileSync(path.join(outputDir, `${name}.png`), Buffer.from(image.data, 'base64'))
  }
  const cashbook = () => evaluate(`(()=>({date:document.querySelector('[data-cashbook-date]')?.value,
    focused:document.activeElement?.matches?.('[data-cashbook-date]')||false,
    stats:[...document.querySelectorAll('.cashbook-stats > *')].map(el=>el.innerText),
    count:document.querySelector('.cashbook-transactions-header')?.innerText,
    notice:document.querySelector('.finance-shared-truth-notice')?.innerText,
    center:document.querySelector('.cashbook-helper')?.innerText}))()`)
  const finance = () => evaluate(`(()=>({mode:document.querySelector('[data-cashflow-filter="periodMode"]')?.value,
    date:document.querySelector('[data-cashflow-filter="periodDate"]')?.value,
    focused:document.activeElement?.matches?.('[data-cashflow-filter="periodDate"]')||false,
    stats:[...document.querySelectorAll('.cashflow-stats > *')].map(el=>el.innerText),
    rows:document.querySelectorAll('.cashflow-row').length,
    notice:document.querySelector('.finance-shared-truth-notice')?.innerText}))()`)
  const centerSelector = id => `[data-internal-open-center-id="${id}"]:not(:disabled)`
  const switchCenter = async id => {
    phase = `switch-${id}`
    await evaluate(`window.location.hash='#/internal/centers'`)
    await waitFor(`!!document.querySelector(${JSON.stringify(centerSelector(id))})`)
    await evaluate(`document.querySelector(${JSON.stringify(centerSelector(id))}).click()`)
    await waitFor('!!document.querySelector(".cashbook-module")')
    await waitFor(`!!document.querySelector('.finance-shared-truth-notice.is-success') && !document.querySelector('[data-cashbook-action="refresh-authoritative"]:disabled')`)
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
  if (!(await evaluate(`document.body.innerText.includes('Cơ sở: Phòng Trống')&&!!document.querySelector('[data-module-launcher]')`))) {
    await evaluate(`window.location.hash='#/internal/centers'`)
    await waitFor(`!!document.querySelector(${JSON.stringify(centerSelector('phongtrong_prod'))})`)
    await evaluate(`document.querySelector(${JSON.stringify(centerSelector('phongtrong_prod'))}).click()`)
    await waitFor('!!document.querySelector("[data-module-launcher]")')
  }
  phase = 'cashbook-date'
  await click('[data-module-launcher][data-module-id="nhom-tai-chinh"]')
  await waitFor('!!document.querySelector(".cashbook-module") || !!document.querySelector(".cashflow-module")')
  if (await evaluate('!!document.querySelector(".cashflow-module")')) await click('[data-finance-workspace-view="cashbook"]')
  await waitFor('!!document.querySelector(".cashbook-module") && !!document.querySelector(".finance-shared-truth-notice.is-success")')
  await set('[data-cashbook-date]', '2026-09-26')
  const day26 = await cashbook()
  assert(day26.focused && day26.date === '2026-09-26' && day26.stats.some(item => /Tổng thu\s+0\s*VNĐ/i.test(item)), JSON.stringify(day26))
  await set('[data-cashbook-date]', '2026-09-27')
  const day27 = await cashbook()
  assert(day27.focused && day27.date === '2026-09-27' && day27.stats.some(item => item.includes('3.200.000')) && day27.count.includes('2 giao dịch'))
  await screenshot('cashbook-day-27-light')
  result.cases.cashbookDate = { day26, day27 }
  await click('[data-cashbook-action="today"]')
  const expectedToday = await evaluate(`new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date())`)
  assert.equal((await cashbook()).date, expectedToday)
  result.cases.today = expectedToday
  await set('[data-cashbook-date]', '2026-09-27')

  phase = 'transaction-date'
  await click('[data-finance-workspace-view="transactions"]')
  await set('[data-cashflow-filter="periodMode"]', 'day', 'change')
  await set('[data-cashflow-filter="periodDate"]', '2026-09-26')
  const finance26 = await finance()
  assert(finance26.focused && finance26.date === '2026-09-26' && finance26.rows === 0)
  await set('[data-cashflow-filter="periodDate"]', '2026-09-27')
  const finance27 = await finance()
  assert(finance27.focused && finance27.date === '2026-09-27' && finance27.rows === 2 && finance27.stats.some(item => item.includes('3.200.000')))
  await screenshot('transactions-day-27-light')
  await set('[data-cashflow-filter="periodMode"]', 'range', 'change')
  await set('[data-cashflow-filter="rangeStart"]', '2026-09-27')
  await set('[data-cashflow-filter="rangeEnd"]', '2026-09-27')
  assert((await finance()).rows === 2)
  result.cases.transactionDate = { finance26, finance27, rangeRows: 2 }

  phase = 'transaction-print'
  await evaluate(`window.__m7PrintHtml='';window.print=()=>{window.__m7PrintHtml=document.querySelector('.cashflow-transaction-print-runtime-root')?.innerText||''}`)
  const printSelector = '[data-cashflow-action="print-transaction"][aria-label*="TC-20260927-0002"]'
  await waitFor(`!!document.querySelector(${JSON.stringify(printSelector)})`)
  const transactionId = await evaluate(`document.querySelector(${JSON.stringify(printSelector)}).dataset.cashflowTransactionId`)
  await click(`.cashflow-row[data-cashflow-transaction-id="${transactionId}"]`)
  await waitFor('!!document.querySelector(".cashflow-transaction-detail")')
  await waitFor('document.querySelector(".cashflow-transaction-detail")?.innerText.includes("DEMO - Học nợ")')
  const detailText = await evaluate('document.querySelector(".cashflow-transaction-detail").innerText')
  assert(detailText.includes('DEMO - Học nợ'), JSON.stringify({ transactionId, detailText }))
  await click(`.cashflow-transaction-detail [data-cashflow-action="print-transaction"]`)
  await waitFor('!!window.__m7PrintHtml')
  const printText = await evaluate('window.__m7PrintHtml')
  assert(printText.includes('TC-20260927-0002') && printText.includes('DEMO - Học nợ'))
  result.cases.print = { transactionCode: 'TC-20260927-0002', detailStudent: 'DEMO - Học nợ', printedStudent: 'DEMO - Học nợ' }
  await screenshot('transaction-detail-light')
  await click('.cashflow-transaction-detail [data-cashflow-detail-action="close"]')
  await click('[data-finance-workspace-view="cashbook"]')
  await set('[data-cashbook-date]', '2026-09-27')

  phase = 'center-switch'
  await evaluate(`window.location.hash='#/internal/centers'`)
  await waitFor('!!document.querySelector("[data-internal-open-center-id]")')
  const tester = await evaluate(`([...document.querySelectorAll('[data-internal-open-center-id]')].find(el=>/Tester/i.test(el.closest('tr, article, section')?.innerText||el.innerText))?.dataset.internalOpenCenterId)||''`)
  assert(tester)
  await evaluate(`document.querySelector(${JSON.stringify(centerSelector(tester))}).click()`)
  await waitFor('!!document.querySelector(".cashbook-module") && !!document.querySelector(".finance-shared-truth-notice.is-success")')
  const testerBook = await cashbook()
  assert(testerBook.date === '2026-09-27' && !testerBook.stats.some(item => item.includes('3.200.000')) && !testerBook.count.includes('2 giao dịch'))
  await screenshot('cashbook-tester-light')
  await switchCenter('phongtrong_prod')
  const returnedBook = await cashbook()
  assert(returnedBook.date === '2026-09-27' && returnedBook.stats.some(item => item.includes('3.200.000')) && returnedBook.count.includes('2 giao dịch'))
  result.cases.centerSwitch = { testerId: tester, testerBook, returnedBook }

  phase = 'rapid-switch'
  await evaluate(`window.location.hash='#/internal/centers'`)
  await waitFor(`!!document.querySelector(${JSON.stringify(centerSelector(tester))})`)
  await evaluate(`document.querySelector(${JSON.stringify(centerSelector(tester))}).click()`)
  await evaluate(`window.location.hash='#/internal/centers'`)
  await waitFor(`!!document.querySelector(${JSON.stringify(centerSelector('phongtrong_prod'))})`)
  await evaluate(`document.querySelector(${JSON.stringify(centerSelector('phongtrong_prod'))}).click()`)
  await waitFor('!!document.querySelector(".cashbook-module") && !!document.querySelector(".finance-shared-truth-notice.is-success")')
  const rapidReturn = await cashbook()
  assert(rapidReturn.date === '2026-09-27' && rapidReturn.stats.some(item => item.includes('3.200.000')) && rapidReturn.count.includes('2 giao dịch'))
  result.cases.rapidSwitch = { finalCenter: 'phongtrong_prod', rapidReturn }

  await click('[data-action="toggle-start"]'); await click('[data-ui-theme="dark"]')
  if (await evaluate(`document.querySelector('[data-action="toggle-start"]').getAttribute('aria-expanded')==='true'`)) await click('[data-action="toggle-start"]')
  await screenshot('cashbook-day-27-dark')
  await click('[data-finance-workspace-view="transactions"]')
  await screenshot('transactions-dark')
  result.cases.themes = ['cashbook-day-27-light', 'transactions-day-27-light', 'cashbook-tester-light', 'cashbook-day-27-dark', 'transactions-dark']
  assert.equal(result.blockedWrites.length, 0, 'QA did not attempt business writes')
  assert.equal(result.exceptions.length, 0, 'No browser exceptions')
  result.status = 'PASS'
  console.log('M7_1_CASHBOOK_BROWSER_QA PASS')
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
