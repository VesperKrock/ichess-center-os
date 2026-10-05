import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

// Authenticated reads only. REST and Storage writes are blocked before network.
const env = fs.readFileSync('.env.local', 'utf8')
const remoteOrigin = new URL(env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1]).origin
const credentialChoice = JSON.parse(fs.readFileSync('artifacts/phongtrong-attendance-dataset/credential-selector.json', 'utf8'))
  .matches.find(item => item.role === 'owner').credentialIndex
const lines = fs.readFileSync('testgmailtk.txt', 'utf8').split(/\r?\n/)
const emailIndex = lines.map((line, index) => /^Gmail\s*:/i.test(line) ? index : -1).filter(index => index >= 0)[credentialChoice]
const email = lines[emailIndex].split(':').slice(1).join(':').trim()
const password = lines[emailIndex + 1].split(':').slice(1).join(':').trim()
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-m10-1-browser-'))
const proofDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-m10-1-proof-'))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5178', '--strictPort'],
  { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const result = { viewport: '1536x728', proofDir, cases: {}, blockedWrites: [], exceptions: [], dialogs: [] }
let ws, commandId = 0, phase = 'login'
const pending = new Map()
try {
  for (let i = 0; i < 150; i++) {
    try { const response = await fetch('http://127.0.0.1:5178/ichess-center-os/'); if (response.ok) break } catch { /* wait */ }
    await delay(100)
  }
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
    if (message.method === 'Page.javascriptDialogOpening') {
      result.dialogs.push({ message: params.message, phase })
      void cdp('Page.handleJavaScriptDialog', { accept: true })
    }
    if (message.method !== 'Fetch.requestPaused') return
    const request = params.request
    const rest = request.url.startsWith(remoteOrigin + '/rest/v1/')
    const storage = request.url.startsWith(remoteOrigin + '/storage/v1/')
    const endpoint = rest ? request.url.slice((remoteOrigin + '/rest/v1/').length).split('?')[0] : 'storage'
    const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      || rest && endpoint.startsWith('rpc/') && /(?:list|read|get|verify|lookup|preview|search)/.test(endpoint)
    if (read) void cdp('Fetch.continueRequest', { requestId: params.requestId })
    else if (rest || storage) {
      result.blockedWrites.push({ endpoint, method: request.method, phase })
      void cdp('Fetch.failRequest', { requestId: params.requestId, errorReason: 'BlockedByClient' })
    } else void cdp('Fetch.continueRequest', { requestId: params.requestId })
  })
  const evaluate = async expression => {
    const value = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text)
    return value.result.value
  }
  const waitFor = async (expression, timeout = 30000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await delay(150) }
    throw new Error(`UI timeout in ${phase}: ${expression}`)
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
  const set = async (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.focus();el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  const screenshot = async name => {
    const image = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    fs.writeFileSync(path.join(proofDir, `${name}.png`), Buffer.from(image.data, 'base64'))
  }
  const panelText = () => evaluate('document.querySelector("#notification-center")?.innerText || ""')
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Network.enable')
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const originalFetch = window.fetch.bind(window)
    window.__holdM10Read = false
    window.__releaseM10Read = null
    window.__failM10PackageRead = false
    window.__removeM10ReviewNextRead = false
    window.fetch = (resource, options) => {
      const url = typeof resource === 'string' ? resource : resource?.url || resource?.href || ''
      if (url.includes('/rpc/tuition_operator_read') && window.__holdM10Read) {
        window.__holdM10Read = false
        return new Promise((resolve, reject) => {
          window.__releaseM10Read = () => originalFetch(resource, options).then(resolve, reject)
        })
      }
      if (url.includes('/rpc/v2_4_list_package_cycle_state') && window.__failM10PackageRead) {
        return Promise.reject(new TypeError('Mock read failure'))
      }
      if (url.includes('/rpc/v2_8a_list_attendance_operations') && window.__removeM10ReviewNextRead) {
        window.__removeM10ReviewNextRead = false
        return originalFetch(resource, options).then(async response => {
          const payload = await response.clone().json()
          payload.reminders = []
          return new Response(JSON.stringify(payload), { status: response.status, headers: response.headers })
        })
      }
      return originalFetch(resource, options)
    }
  })()` })
  await cdp('Fetch.enable', { patterns: [
    { urlPattern: `${remoteOrigin}/rest/v1/*`, requestStage: 'Request' },
    { urlPattern: `${remoteOrigin}/storage/v1/*`, requestStage: 'Request' },
  ] })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1536, height: 728, deviceScaleFactor: 1, mobile: false })
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5178/ichess-center-os/' })
  await waitFor('!!document.querySelector("[data-cloud-login-form]")')
  await delay(800)
  await set('[data-cloud-login-form] [name="email"]', email)
  await set('[data-cloud-login-form] [name="password"]', password)
  await clickPhysical('[data-cloud-login-form] button[type="submit"]')
  await waitFor('!!document.querySelector("[data-internal-open-center-id]") || !!document.querySelector("[data-module-launcher]")')
  if (!(await evaluate('document.body.innerText.includes("Cơ sở: Phòng Trống") && !!document.querySelector("[data-module-launcher]")'))) {
    await evaluate('window.location.hash="#/internal/centers"')
    await waitFor('!!document.querySelector("[data-internal-open-center-id=\\"phongtrong_prod\\"]:not(:disabled)")')
    await click('[data-internal-open-center-id="phongtrong_prod"]:not(:disabled)')
    await waitFor('!!document.querySelector("[data-module-launcher]")')
  }
  phase = 'start-light'
  await waitFor('document.querySelectorAll("[data-module-launcher][data-module-id]").length===9', 50000)
  result.cases.startTiles = await evaluate('[...document.querySelectorAll("[data-module-launcher][data-module-id]")].map(x=>x.dataset.moduleId)')
  assert.equal(result.cases.startTiles.length, 9)
  await screenshot('start-light')

  phase = 'loading'
  await evaluate('window.__holdM10Read=true')
  await click('[data-action="toggle-notifications"]')
  await waitFor('!!document.querySelector("#notification-center") && !!window.__releaseM10Read')
  result.cases.loading = await panelText()
  assert.match(result.cases.loading, /Đang cập nhật việc cần xử lý/)
  assert.doesNotMatch(result.cases.loading, /0 cần xử lý|Không có việc cần xử lý\./)
  await screenshot('bell-loading-light')
  await evaluate('window.__releaseM10Read()')
  await waitFor('document.querySelector(".notification-refresh-notice.is-fresh") !== null', 50000)
  result.cases.freshCount = await evaluate('document.querySelectorAll("#notification-center [data-notification-item]").length')
  assert(result.cases.freshCount > 0)
  await screenshot('bell-fresh-light')

  phase = 'stale'
  await evaluate('window.__failM10PackageRead=true')
  await click('[data-notification-action="refresh-authoritative"]')
  await waitFor('document.querySelector(".notification-refresh-notice.is-unfresh") !== null && document.querySelector("[data-notification-action=\\"refresh-authoritative\\"]")?.disabled===false', 50000)
  result.cases.failed = await panelText()
  assert.doesNotMatch(result.cases.failed, /Không có việc cần xử lý\./)
  result.cases.failedConfirmedActive = await evaluate('document.querySelectorAll("#notification-center [data-notification-item]").length')
  assert(result.cases.failedConfirmedActive < result.cases.freshCount)
  await evaluate('document.querySelector("[data-notification-filter=readState]").value="all";document.querySelector("[data-notification-filter=readState]").dispatchEvent(new Event("change",{bubbles:true}))')
  result.cases.stale = await evaluate(`(()=>{const items=[...document.querySelectorAll('#notification-center [data-notification-item]')].filter(x=>x.innerText.includes('Chờ cập nhật'));return {count:items.length,actions:items.filter(x=>x.querySelector('[data-notification-action="open-source"]')).length,summary:document.querySelector('.notification-center-header p')?.innerText}})()`)
  assert(result.cases.stale.count > 0)
  assert.equal(result.cases.stale.actions, 0)
  assert.doesNotMatch(result.cases.stale.summary, /^\d+ cần xử lý/)
  await screenshot('bell-stale-light')
  await evaluate('window.__failM10PackageRead=false;document.querySelector("[data-notification-filter=readState]").value="attention";document.querySelector("[data-notification-filter=readState]").dispatchEvent(new Event("change",{bubbles:true}))')
  await click('[data-notification-action="refresh-authoritative"]')
  await waitFor('document.querySelector(".notification-refresh-notice.is-fresh") !== null', 50000)

  phase = 'bcht-route'
  await waitFor('!!document.querySelector("[data-notification-signal=\\"bcht-due\\"] [data-notification-action=\\"open-source\\"]")')
  result.cases.bchtTitle = await evaluate('document.querySelector("[data-notification-signal=\\"bcht-due\\"] strong")?.innerText')
  const bchtTarget = await evaluate(`(()=>{const id=document.querySelector('[data-notification-signal="bcht-due"]').dataset.notificationItem;
    for(const key of Object.keys(localStorage).filter(x=>x.includes('notifications'))){try{const item=JSON.parse(localStorage.getItem(key)).find(x=>x.id===id);if(item)return item.meta}catch{}}
    return null})()`)
  assert(bchtTarget?.studentId && bchtTarget?.cycleId)
  await click('[data-notification-signal="bcht-due"] [data-notification-action="open-source"]')
  await waitFor('!!document.querySelector(".tuition-detail-panel")', 50000)
  result.cases.bchtDetail = await evaluate('document.querySelector(".tuition-detail-panel")?.innerText.slice(0,320)')
  assert.match(result.cases.bchtDetail, /Kỳ/)
  assert.equal(await evaluate(`!!document.querySelector('.tuition-detail-panel [data-tu-student-id=${JSON.stringify(bchtTarget.studentId)}][data-tu-cycle-id=${JSON.stringify(bchtTarget.cycleId)}]')`), true)
  await screenshot('bcht-detail-light')

  phase = 'review-route'
  await click('[data-action="toggle-notifications"]')
  await waitFor('document.querySelector(".notification-refresh-notice.is-fresh") !== null', 50000)
  await waitFor('!!document.querySelector("[data-notification-signal=\\"REVIEW_UPDATE_DUE\\"] [data-notification-action=\\"open-source\\"]")')
  result.cases.reviewTitle = await evaluate('document.querySelector("[data-notification-signal=\\"REVIEW_UPDATE_DUE\\"] strong")?.innerText')
  const reviewTarget = await evaluate(`(()=>{const id=document.querySelector('[data-notification-signal="REVIEW_UPDATE_DUE"]').dataset.notificationItem;
    for(const key of Object.keys(localStorage).filter(x=>x.includes('notifications'))){try{const item=JSON.parse(localStorage.getItem(key)).find(x=>x.id===id);if(item)return item.meta}catch{}}
    return null})()`)
  assert(reviewTarget?.studentId && reviewTarget?.cycleId)
  await click('[data-notification-signal="REVIEW_UPDATE_DUE"] [data-notification-action="open-source"]')
  await waitFor('!!document.querySelector(".attendance-ledger-notification-context")', 50000)
  result.cases.reviewDetail = await evaluate('document.querySelector(".attendance-ledger-notification-context")?.innerText')
  assert.match(result.cases.reviewDetail, /Cần cập nhật nhận xét|Kỳ/)
  assert.match(result.cases.reviewDetail, new RegExp(`Kỳ\\s+${reviewTarget.cycleNumber}`))
  await screenshot('review-detail-light')

  phase = 'dark'
  await click('[data-action="toggle-start"]')
  await click('[data-ui-theme="dark"]')
  if (await evaluate('document.querySelector("[data-action=\\"toggle-start\\"]")?.getAttribute("aria-expanded")==="true"')) {
    await click('[data-action="toggle-start"]')
  }
  await waitFor('!!document.querySelector(".attendance-ledger-notification-context")', 50000)
  await screenshot('review-detail-dark')
  await click('[data-action="toggle-notifications"]')
  await waitFor('document.querySelector(".notification-refresh-notice.is-fresh") !== null', 50000)
  await screenshot('bell-dark-fresh')
  result.cases.darkTheme = await evaluate('document.documentElement.dataset.uiTheme')
  assert.equal(result.cases.darkTheme, 'dark')

  phase = 'resolved-target-mock'
  await evaluate('window.__removeM10ReviewNextRead=true')
  await click('[data-notification-signal="REVIEW_UPDATE_DUE"] [data-notification-action="open-source"]')
  for (let i = 0; i < 200 && !result.dialogs.some(item => item.phase === phase); i++) await delay(100)
  assert.match(result.dialogs.find(item => item.phase === phase)?.message || '', /không còn cần xử lý hoặc đã thay đổi/)
  result.cases.resolvedTargetBlocked = true

  phase = 'center-switch'
  await evaluate('window.location.hash="#/internal/centers"')
  await waitFor('!!document.querySelector("[data-internal-open-center-id=\\"phongtester_prod\\"]:not(:disabled)")')
  await click('[data-internal-open-center-id="phongtester_prod"]:not(:disabled)')
  await waitFor('document.body.innerText.includes("Cơ sở: Phòng Tester")')
  result.cases.tester = await evaluate(`(()=>({oldBcht:!!document.querySelector('[data-notification-signal="bcht-due"]'),oldReview:!!document.querySelector('.attendance-ledger-notification-context'),text:document.querySelector('#notification-center')?.innerText.slice(0,160)}))()`)
  assert.equal(result.cases.tester.oldBcht, false)
  assert.equal(result.cases.tester.oldReview, false)
  await screenshot('tester-dark')

  phase = 'late-center-response'
  await evaluate('window.location.hash="#/internal/centers"')
  await waitFor('!!document.querySelector("[data-internal-open-center-id=\\"phongtrong_prod\\"]:not(:disabled)")')
  await click('[data-internal-open-center-id="phongtrong_prod"]:not(:disabled)')
  await waitFor('document.body.innerText.includes("Cơ sở: Phòng Trống")')
  if (!(await evaluate('!!document.querySelector("#notification-center")'))) await click('[data-action="toggle-notifications"]')
  await waitFor('document.querySelector(".notification-refresh-notice.is-fresh") !== null', 50000)
  await evaluate('window.__holdM10Read=true')
  await click('[data-notification-action="refresh-authoritative"]')
  await waitFor('!!window.__releaseM10Read')
  await evaluate('window.location.hash="#/internal/centers"')
  await waitFor('!!document.querySelector("[data-internal-open-center-id=\\"phongtester_prod\\"]:not(:disabled)")')
  await click('[data-internal-open-center-id="phongtester_prod"]:not(:disabled)')
  await waitFor('document.body.innerText.includes("Cơ sở: Phòng Tester")')
  await evaluate('window.__releaseM10Read()')
  await delay(800)
  result.cases.lateResponseIgnored = await evaluate('document.body.innerText.includes("Cơ sở: Phòng Tester") && !document.querySelector("[data-notification-signal=\\"bcht-due\\"]")')
  assert.equal(result.cases.lateResponseIgnored, true)

  phase = 'rapid-center-switch'
  await evaluate('window.location.hash="#/internal/centers"')
  await waitFor('!!document.querySelector("[data-internal-open-center-id=\\"phongtrong_prod\\"]:not(:disabled)")')
  await click('[data-internal-open-center-id="phongtrong_prod"]:not(:disabled)')
  await waitFor('document.body.innerText.includes("Cơ sở: Phòng Trống")')
  await evaluate('window.location.hash="#/internal/centers"')
  await waitFor('!!document.querySelector("[data-internal-open-center-id=\\"phongtester_prod\\"]:not(:disabled)")')
  await click('[data-internal-open-center-id="phongtester_prod"]:not(:disabled)')
  await waitFor('document.body.innerText.includes("Cơ sở: Phòng Tester")')
  await delay(800)
  result.cases.rapidSwitchSafe = await evaluate('!document.querySelector("[data-notification-signal=\\"bcht-due\\"]") && !document.querySelector(".attendance-ledger-notification-context")')
  assert.equal(result.cases.rapidSwitchSafe, true)
  assert.equal(result.blockedWrites.length, 0)
  assert.equal(result.exceptions.length, 0)
  result.status = 'PASS'
} catch (error) {
  result.status = 'FAIL'
  result.error = String(error?.stack || error)
} finally {
  fs.writeFileSync(path.join(proofDir, 'browser-proof.json'), JSON.stringify(result, null, 2))
  ws?.close(); chrome.kill(); vite.kill()
  await delay(300)
  const resolvedTemp = path.resolve(os.tmpdir()), resolvedProfile = path.resolve(profile)
  if (resolvedProfile.startsWith(`${resolvedTemp}${path.sep}`)) {
    try { fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) } catch { /* Chrome releases asynchronously. */ }
  }
  console.log(JSON.stringify({ status: result.status, error: result.error, proofDir, cases: result.cases,
    blockedWrites: result.blockedWrites, exceptions: result.exceptions, dialogs: result.dialogs }, null, 2))
  if (result.status !== 'PASS') process.exitCode = 1
}
