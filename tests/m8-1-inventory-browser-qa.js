import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const env = fs.readFileSync('.env.local', 'utf8')
const remoteOrigin = new URL(env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1]).origin
const credentialChoice = JSON.parse(fs.readFileSync('artifacts/phongtrong-attendance-dataset/credential-selector.json', 'utf8'))
  .matches.find(item => item.role === 'owner').credentialIndex
const lines = fs.readFileSync('testgmailtk.txt', 'utf8').split(/\r?\n/)
const emailIndex = lines.map((line, index) => /^Gmail\s*:/i.test(line) ? index : -1).filter(index => index >= 0)[credentialChoice]
const email = lines[emailIndex].split(':').slice(1).join(':').trim()
const password = lines[emailIndex + 1].split(':').slice(1).join(':').trim()
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-m8-'))
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-m8-proof-'))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const result = { viewport: '1536x728', outputDir, cases: {}, blockedWrites: [], exceptions: [], requests: [], rpc: {} }
let ws, commandId = 0, phase = 'login'
const pending = new Map(), responseEndpoints = new Map()
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
      if (['rpc/c5_6_list_inventory_shared_truth', 'rpc/v2_7a_list_inventory_cycle_counts'].includes(endpoint)) responseEndpoints.set(params.requestId, { endpoint, phase })
    }
    if (message.method === 'Network.loadingFinished' && responseEndpoints.has(params.requestId)) {
      const info = responseEndpoints.get(params.requestId); responseEndpoints.delete(params.requestId)
      void cdp('Network.getResponseBody', { requestId: params.requestId }).then(body => {
        const payload = JSON.parse(body.body)
        result.rpc[`${info.endpoint}|${info.phase}`] = payload
      }).catch(() => {})
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
  const waitFor = async (expression, timeout = 20000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await delay(180) }
    throw new Error(`UI timeout in ${phase}: ${expression}; ${(await evaluate('document.body.innerText')).slice(-900)}`)
  }
  const click = async selector => {
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`)
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  }
  const clickPhysical = async selector => {
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`)
    const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
  }
  const openPanel = async (buttonSelector, panelSelector) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await waitFor(`!!document.querySelector(${JSON.stringify(buttonSelector)})`)
      await evaluate(`document.querySelector(${JSON.stringify(buttonSelector)}).click()`)
      try {
        await waitFor(`!!document.querySelector(${JSON.stringify(panelSelector)})`, 3500)
        await delay(250)
        if (await evaluate(`!!document.querySelector(${JSON.stringify(panelSelector)})`)) return
      } catch { /* A concurrent read can rerender the panel; retry its read-only open action. */ }
    }
    throw new Error(`Could not keep ${panelSelector} open in ${phase}`)
  }
  const set = async (selector, value, event = 'input') => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.focus();el.value=${JSON.stringify(value)};el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`)
  const screenshot = async name => {
    const image = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    fs.writeFileSync(path.join(outputDir, `${name}.png`), Buffer.from(image.data, 'base64'))
  }
  const summary = () => evaluate(`(()=>({
    heading:document.querySelector('.inventory-page-heading')?.innerText,
    stats:[...document.querySelectorAll('.inventory-stat-card')].map(el=>el.innerText),
    rows:[...document.querySelectorAll('.inventory-row')].map(el=>({name:el.children[0]?.innerText,qty:el.children[2]?.innerText,threshold:el.children[3]?.innerText,condition:el.children[4]?.innerText})),
    empty:document.querySelector('.inventory-empty')?.innerText,
    query:document.querySelector('.inventory-main-table [data-inventory-filter="query"]')?.value,
    notice:document.querySelector('.inventory-shared-truth-notice')?.innerText,
    archived:document.querySelector('.inventory-archived-stock-notice')?.innerText,
    center:document.querySelector('.inventory-page-heading')?.innerText
  }))()`)
  const centerSelector = id => `[data-internal-open-center-id="${id}"]:not(:disabled)`
  const switchCenter = async id => {
    phase = `switch-${id}`
    await evaluate(`window.location.hash='#/internal/centers'`)
    await waitFor(`!!document.querySelector(${JSON.stringify(centerSelector(id))})`)
    await evaluate(`document.querySelector(${JSON.stringify(centerSelector(id))}).click()`)
    await waitFor('!!document.querySelector(".inventory-main-table")')
    await waitFor(`document.querySelector('.inventory-page-heading')?.innerText.includes(${JSON.stringify(id === 'phongtrong_prod' ? 'Phòng Trống' : 'Tester')})`)
    const key = `rpc/c5_6_list_inventory_shared_truth|${phase}`
    for (let i = 0; i < 300 && !result.rpc[key]; i++) await delay(200)
    if (!result.rpc[key]) throw new Error(`Inventory read did not finish for ${id}`)
    if (id === 'phongtrong_prod') await waitFor('document.querySelectorAll(".inventory-row").length===8')
    else await waitFor('!!document.querySelector(".inventory-archived-stock-notice")')
    await waitFor('!document.querySelector(".inventory-read-state")')
    await delay(600)
  }

  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Network.enable')
  await cdp('Fetch.enable', { patterns: [{ urlPattern: `${remoteOrigin}/rest/v1/*`, requestStage: 'Request' }] })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1536, height: 728, deviceScaleFactor: 1, mobile: false })
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5173/ichess-center-os/' })
  await waitFor('!!document.querySelector("[data-cloud-login-form]")')
  await delay(1200)
  await set('[data-cloud-login-form] [name="email"]', email)
  await set('[data-cloud-login-form] [name="password"]', password)
  await clickPhysical('[data-cloud-login-form] button[type="submit"]')
  await waitFor('!!document.querySelector("[data-internal-open-center-id]") || !!document.querySelector("[data-module-launcher]")')
  if (!(await evaluate(`document.body.innerText.includes('Cơ sở: Phòng Trống')&&!!document.querySelector('[data-module-launcher]')`))) {
    await evaluate(`window.location.hash='#/internal/centers'`)
    await waitFor(`!!document.querySelector(${JSON.stringify(centerSelector('phongtrong_prod'))})`)
    await evaluate(`document.querySelector(${JSON.stringify(centerSelector('phongtrong_prod'))}).click()`)
    await waitFor('!!document.querySelector("[data-module-launcher]")')
  }
  phase = 'inventory-open'
  await delay(1200)
  await clickPhysical('[data-module-launcher][data-module-id="kho-hang"]')
  await waitFor('!!document.querySelector(".inventory-main-table")')
  await waitFor('document.querySelectorAll(".inventory-row").length>0')
  await delay(1000)
  result.cases.list = await summary()
  await screenshot('inventory-list-light')
  await click('.inventory-row')
  result.cases.itemDetail = await evaluate(`(()=>({text:document.querySelector('.inventory-item-form-panel')?.innerText,unit:document.querySelector('[data-inventory-form-field="unit"]')?.value,quantity:document.querySelector('.inventory-item-form-panel input[readonly][type="number"]')?.value}))()`)
  await screenshot('inventory-item-detail-light')
  await click('[data-inventory-action="cancel-form"]')
  await set('.inventory-main-table [data-inventory-filter="query"]', 'xyz-m8-no-match')
  result.cases.filteredZero = await summary()
  result.cases.filteredFocus = await evaluate(`(()=>({focused:document.activeElement?.matches('[data-inventory-filter="query"]'),caret:document.activeElement?.selectionStart}))()`)
  await screenshot('inventory-filter-pending-light')
  await evaluate('document.activeElement.blur()')
  await delay(250)
  result.cases.filteredZeroSettled = await summary()
  await screenshot('inventory-filter-settled-light')
  await set('.inventory-main-table [data-inventory-filter="query"]', '')
  result.cases.searchReset = await summary()
  result.cases.resetFocus = await evaluate(`document.activeElement?.matches('[data-inventory-filter="query"]')`)
  await click('[data-inventory-open-subwindow="movements"]')
  await waitFor('!!document.querySelector(".inventory-history-panel")')
  result.cases.movements = await evaluate(`(()=>({rows:[...document.querySelectorAll('.inventory-history-item')].map(el=>el.innerText),count:document.querySelector('.inventory-history-panel-footer')?.innerText,export:!!document.querySelector('[data-inventory-export-movements]')}))()`)
  await screenshot('inventory-movements-light')
  await evaluate(`window.__m8Csv='';const orig=URL.createObjectURL;URL.createObjectURL=(blob)=>{blob.text().then(t=>window.__m8Csv=t);return orig.call(URL,blob)}`)
  await click('[data-inventory-export-movements]')
  await waitFor('!!window.__m8Csv')
  result.cases.csv = await evaluate(`({header:window.__m8Csv.split('\\n')[0],rows:window.__m8Csv.split('\\n').length-1,hasCenter:window.__m8Csv.includes('Phòng Trống'),allRowsHaveCenter:window.__m8Csv.split('\\n').slice(1).every(row=>row.startsWith('"Phòng Trống"')),hasRole:window.__m8Csv.includes('Chủ hệ thống'),hasRawOwner:/,owner(?:,|"|\\n)/i.test(window.__m8Csv),hasDate:window.__m8Csv.includes('29/09/2026'),hasQuantity:window.__m8Csv.includes('4 → 5'),hasIn:window.__m8Csv.includes('Nhập kho'),hasOut:window.__m8Csv.includes('Xuất kho'),hasUnits:window.__m8Csv.includes('Bộ')&&window.__m8Csv.includes('Cái')&&window.__m8Csv.includes('Quyển')})`)
  if (await evaluate('!!document.querySelector(".inventory-history-item")')) {
    await click('.inventory-history-item')
    result.cases.movementDetail = await evaluate(`document.querySelector('.inventory-movement-detail-panel')?.innerText`)
    await screenshot('inventory-movement-detail-light')
    await click('[data-inventory-movement-detail-action="close"]')
  }
  await click('[data-inventory-history-action="close"]')
  await openPanel('[data-inventory-request-action="open-panel"]', '.inventory-request-panel')
  result.cases.proposals = await evaluate(`(()=>({rows:[...document.querySelectorAll('.inventory-request-row')].map(el=>el.innerText),intro:document.querySelector('.inventory-request-header')?.innerText}))()`)
  result.cases.proposalStylesLight = await evaluate(`([...document.querySelectorAll('.inventory-request-row')].map(row=>({code:getComputedStyle(row.querySelector('strong')).color,requester:getComputedStyle(row.children[1].querySelector('strong')).color,chip:getComputedStyle(row.querySelector('.inventory-request-chip-list span')).color,status:getComputedStyle(row.querySelector('.inventory-request-status')).color,statusBackground:getComputedStyle(row.querySelector('.inventory-request-status')).backgroundColor})))`)
  await screenshot('inventory-proposals-light')
  await click('[data-inventory-request-action="close-panel"]')
  await openPanel('[data-inventory-cycle-count-action="open-panel"]', '.inventory-cycle-count-panel')
  await waitFor('!!document.querySelector(".inventory-cycle-count-panel")')
  await delay(1000)
  result.cases.counts = await evaluate(`(()=>({history:[...document.querySelectorAll('.inventory-cycle-count-history-item')].map(el=>el.innerText),detail:document.querySelector('.inventory-cycle-count-detail')?.innerText,notice:document.querySelector('.inventory-cycle-count-notice')?.innerText}))()`)
  await screenshot('inventory-count-light')
  const reconciled = await evaluate(`[...document.querySelectorAll('.inventory-cycle-count-history-item')].find(el=>el.innerText.includes('KKK-20260929-0001'))?.dataset.inventoryCycleCountId`)
  if (reconciled) {
    await click(`[data-inventory-cycle-count-id="${reconciled}"]`)
    result.cases.reconciled = await evaluate(`document.querySelector('.inventory-cycle-count-detail')?.innerText`)
    await screenshot('inventory-reconciled-light')
  }
  await click('[data-inventory-cycle-count-action="close-panel"]')
  phase = 'center-switch'
  await evaluate(`window.location.hash='#/internal/centers'`)
  await waitFor('!!document.querySelector("[data-internal-open-center-id]")')
  const tester = await evaluate(`([...document.querySelectorAll('[data-internal-open-center-id]')].find(el=>/Tester/i.test(el.closest('tr, article, section')?.innerText||el.innerText))?.dataset.internalOpenCenterId)||''`)
  result.cases.testerId = tester
  if (tester) {
    await switchCenter(tester)
    phase = 'tester-archive'
    result.cases.tester = await summary()
    await screenshot('inventory-tester-light')
    await click('.inventory-archived-stock-notice [data-inventory-open-subwindow="movements"]')
    phase = 'tester-history'
    await waitFor('document.querySelectorAll(".inventory-history-item").length===3')
    result.cases.testerMovements = await evaluate(`[...document.querySelectorAll('.inventory-history-item')].map(el=>el.innerText)`)
    await screenshot('inventory-tester-archived-history-light')
    await evaluate(`window.__m8Csv=''`)
    await click('[data-inventory-export-movements]')
    await waitFor('!!window.__m8Csv')
    result.cases.testerCsv = await evaluate(`({header:window.__m8Csv.split('\\n')[0],rows:window.__m8Csv.split('\\n').length-1,allRowsHaveCenter:window.__m8Csv.split('\\n').slice(1).every(row=>row.startsWith('"Phòng Tester"')),hasWrongCenter:window.__m8Csv.includes('Phòng Trống')})`)
    await click('[data-inventory-history-action="close"]')
    await openPanel('[data-inventory-request-action="open-panel"]', '.inventory-request-panel')
    result.cases.testerProposals = await evaluate(`[...document.querySelectorAll('.inventory-request-row')].map(el=>el.innerText)`)
    await click('[data-inventory-request-action="close-panel"]')
    await openPanel('[data-inventory-cycle-count-action="open-panel"]', '.inventory-cycle-count-panel')
    await delay(500)
    result.cases.testerCounts = await evaluate(`[...document.querySelectorAll('.inventory-cycle-count-history-item')].map(el=>el.innerText)`)
    await click('[data-inventory-cycle-count-action="close-panel"]')
    await switchCenter('phongtrong_prod')
    result.cases.returned = await summary()
    await evaluate(`window.location.hash='#/internal/centers'`)
    await waitFor(`!!document.querySelector(${JSON.stringify(centerSelector(tester))})`)
    await evaluate(`document.querySelector(${JSON.stringify(centerSelector(tester))}).click()`)
    await evaluate(`window.location.hash='#/internal/centers'`)
    await waitFor(`!!document.querySelector(${JSON.stringify(centerSelector('phongtrong_prod'))})`)
    await evaluate(`document.querySelector(${JSON.stringify(centerSelector('phongtrong_prod'))}).click()`)
    await waitFor('!!document.querySelector(".inventory-main-table")')
    await waitFor('document.querySelectorAll(".inventory-row").length===8', 60000)
    result.cases.rapidReturn = await summary()
  }
  await click('[data-action="toggle-start"]'); await click('[data-ui-theme="dark"]')
  if (await evaluate(`document.querySelector('[data-action="toggle-start"]').getAttribute('aria-expanded')==='true'`)) await click('[data-action="toggle-start"]')
  await screenshot('inventory-list-dark')
  await openPanel('[data-inventory-request-action="open-panel"]', '.inventory-request-panel')
  result.cases.proposalStylesDark = await evaluate(`([...document.querySelectorAll('.inventory-request-row')].map(row=>({code:getComputedStyle(row.querySelector('strong')).color,requester:getComputedStyle(row.children[1].querySelector('strong')).color,chip:getComputedStyle(row.querySelector('.inventory-request-chip-list span')).color,status:getComputedStyle(row.querySelector('.inventory-request-status')).color,statusBackground:getComputedStyle(row.querySelector('.inventory-request-status')).backgroundColor})))`)
  await screenshot('inventory-proposals-dark')
  await click('[data-inventory-request-action="close-panel"]')
  await openPanel('[data-inventory-cycle-count-action="open-panel"]', '.inventory-cycle-count-panel')
  await screenshot('inventory-count-dark')
  await click('[data-inventory-cycle-count-action="close-panel"]')
  await click('.inventory-row')
  await screenshot('inventory-item-detail-dark')
  await click('[data-inventory-action="cancel-form"]')
  await click('[data-inventory-open-subwindow="movements"]')
  await screenshot('inventory-movements-dark')
  await click('[data-inventory-history-action="close"]')
  await set('.inventory-main-table [data-inventory-filter="query"]', 'xyz-m8-no-match')
  await evaluate('document.activeElement.blur()')
  await delay(250)
  await screenshot('inventory-empty-dark')
  await set('.inventory-main-table [data-inventory-filter="query"]', '')
  await evaluate('document.activeElement.blur()')
  await delay(250)
  result.cases.dark = await summary()
  result.cases.technicalTerms = await evaluate(`(document.querySelector('.inventory-module')?.innerText||'').match(/canonical|projection|cloud|payload|RPC|PostgREST|UUID|database/gi)||[]`)
  const names = Object.fromEntries(result.cases.list.rows.map(row => [row.name, row.qty]))
  assert.equal(result.cases.list.rows.length, 8)
  assert.equal(result.cases.list.stats.length, 4)
  assert.equal(result.cases.list.archived, undefined)
  assert.match(names['INV QA - Bộ cờ vua tiêu chuẩn'], /14 Bộ/)
  assert.match(names['INV QA - Đồng hồ cờ vua'], /5 Cái/)
  assert.match(names['INV QA - Sổ bài tập cờ vua'], /20 Quyển/)
  assert.match(names['INV QA - Bộ quân cờ dự phòng'], /0 Bộ.*Hết hàng/s)
  assert.match(names['INV QA - Bút chì học viên'], /2 Hộp.*Sắp hết/s)
  assert.equal(result.cases.filteredZero.rows.length, 0)
  assert.equal(result.cases.filteredZero.query, 'xyz-m8-no-match')
  assert.equal(result.cases.filteredFocus.focused, true)
  assert.equal(result.cases.searchReset.rows.length, 8)
  assert.equal(result.cases.resetFocus, true)
  assert.equal(result.cases.movements.rows.length, 20)
  assert(result.cases.movements.rows.every(row => !/\bowner\b/i.test(row)))
  assert.match(result.cases.movementDetail, /VAI TRÒ THỰC HIỆN\nChủ hệ thống/)
  assert.equal(result.cases.csv.rows, 20)
  assert.match(result.cases.csv.header, /"Cơ sở".*"Vai trò thực hiện"/)
  assert(result.cases.csv.hasCenter && result.cases.csv.allRowsHaveCenter && result.cases.csv.hasRole)
  assert(result.cases.csv.hasDate && result.cases.csv.hasQuantity && !result.cases.csv.hasRawOwner)
  assert(result.cases.csv.hasIn && result.cases.csv.hasOut && result.cases.csv.hasUnits)
  assert(result.cases.movements.rows.some(row => row.includes('12 → 17') && row.includes('Bộ')))
  assert(result.cases.movements.rows.some(row => row.includes('17 → 14') && row.includes('Bộ')))
  assert(result.cases.movements.rows.some(row => row.includes('28 → 20') && row.includes('Quyển')))
  assert.equal(result.cases.proposals.rows.length, 2)
  assert(result.cases.proposals.rows.some(row => row.includes('Chờ xử lý')))
  assert(result.cases.proposals.rows.some(row => row.includes('Đã hoàn tất')))
  assert(result.cases.proposalStylesLight.every(row => row.status === 'rgb(17, 24, 39)' && row.code === 'rgb(17, 24, 39)'))
  assert(result.cases.proposalStylesDark.every(row => row.status && row.code && row.chip))
  assert(result.cases.counts.history.some(row => row.includes('KKK-20260929-0002') && row.includes('Đang đếm') && row.includes('Quá hạn')))
  assert(result.cases.counts.history.some(row => row.includes('KKK-20260929-0001') && row.includes('Đã hoàn tất')))
  assert.match(result.cases.reconciled, /Đồng hồ cờ vua[\s\S]*?3\s+4\s+\+1/)
  assert.equal(result.cases.testerId, 'phongtester_prod')
  assert.equal(result.cases.tester.rows.length, 0)
  assert.match(result.cases.tester.empty, /Kho hàng chưa có mặt hàng đang sử dụng/)
  assert.match(result.cases.tester.archived, /QA INV2-1787959246723 Vật tư: 4 bộ/)
  assert.equal(result.cases.testerMovements.length, 3)
  assert.equal(result.cases.testerCsv.rows, 3)
  assert(result.cases.testerCsv.allRowsHaveCenter && !result.cases.testerCsv.hasWrongCenter)
  assert.equal(result.cases.testerProposals.length, 1)
  assert.equal(result.cases.testerCounts.length, 0)
  assert.equal(result.cases.returned.rows.length, 8)
  assert.equal(result.cases.returned.archived, undefined)
  assert.equal(result.cases.rapidReturn.rows.length, 8)
  assert.equal(result.blockedWrites.length, 0)
  assert.equal(result.exceptions.length, 0)
  assert.equal(result.cases.technicalTerms.length, 0)
  const testerItems = result.rpc['rpc/c5_6_list_inventory_shared_truth|switch-phongtester_prod']?.items || []
  assert.equal(testerItems.length, 1)
  assert.equal(testerItems[0].status, 'archived')
  assert.equal(testerItems[0].quantity, 4)
  const firstPhonTrong = result.rpc['rpc/c5_6_list_inventory_shared_truth|inventory-open']
  const returnedPhonTrong = result.rpc['rpc/c5_6_list_inventory_shared_truth|switch-phongtrong_prod']
  const stockProjection = snapshot => snapshot.items.map(item => [item.id, item.status, item.quantity, item.unit]).sort((a, b) => a[0].localeCompare(b[0]))
  const requestProjection = snapshot => snapshot.requests.map(request => [request.id, request.status]).sort((a, b) => a[0].localeCompare(b[0]))
  assert.deepEqual(stockProjection(returnedPhonTrong), stockProjection(firstPhonTrong))
  assert.deepEqual(requestProjection(returnedPhonTrong), requestProjection(firstPhonTrong))
  assert.equal(returnedPhonTrong.movements.length, firstPhonTrong.movements.length)
  assert.deepEqual(result.rpc['rpc/v2_7a_list_inventory_cycle_counts|switch-phongtrong_prod'].counts.map(count => [count.id, count.status]).sort(),
    result.rpc['rpc/v2_7a_list_inventory_cycle_counts|inventory-open'].counts.map(count => [count.id, count.status]).sort())
  result.status = 'PASS'
} catch (error) {
  result.status = 'ERROR'
  result.error = String(error?.stack || error)
} finally {
  fs.writeFileSync(path.join(outputDir, 'browser-proof.json'), JSON.stringify(result, null, 2))
  ws?.close()
  chrome.kill()
  if (result.status !== 'PASS') process.exitCode = 1
  console.log(JSON.stringify({ status: result.status, error: result.error, outputDir, blockedWrites: result.blockedWrites, exceptions: result.exceptions,
    evidence: { inventoryRows: result.cases.list?.rows?.length, movementRows: result.cases.movements?.rows?.length,
      proposalRows: result.cases.proposals?.rows?.length, testerArchived: result.cases.tester?.archived,
      testerMovementRows: result.cases.testerMovements?.length, testerCsv: result.cases.testerCsv,
      searchFocused: result.cases.filteredFocus?.focused, proposalStylesLight: result.cases.proposalStylesLight,
      proposalStylesDark: result.cases.proposalStylesDark } }, null, 2))
}
