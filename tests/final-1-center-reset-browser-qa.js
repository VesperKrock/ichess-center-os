import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

// Authenticated reads and browser-local drafts only. REST/Storage writes are
// blocked before network; this suite never saves a real business record.
const env = fs.readFileSync('.env.local', 'utf8')
const remoteOrigin = new URL(env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1]).origin
const credentialChoice = JSON.parse(fs.readFileSync('artifacts/phongtrong-attendance-dataset/credential-selector.json', 'utf8'))
  .matches.find((item) => item.role === 'owner').credentialIndex
const lines = fs.readFileSync('testgmailtk.txt', 'utf8').split(/\r?\n/)
const emailIndex = lines.map((line, index) => /^Gmail\s*:/i.test(line) ? index : -1)
  .filter((index) => index >= 0)[credentialChoice]
const email = lines[emailIndex].split(':').slice(1).join(':').trim()
const password = lines[emailIndex + 1].split(':').slice(1).join(':').trim()
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-final-1-center-'))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js',
  ...(process.env.FINAL1_PRODUCTION_PREVIEW === '1' ? ['preview'] : []),
  '--host', '127.0.0.1', '--port', '5189', '--strictPort'],
  { windowsHide: true, stdio: 'ignore' })
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const proof = { viewport: '1536x728', cases: {}, dialogs: [], blockedWrites: [], exceptions: [] }
let ws, commandId = 0, phase = 'login', acceptDialog = true
const pending = new Map()
try {
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch('http://127.0.0.1:5189/ichess-center-os/')).ok) break } catch { /* wait */ }
    await delay(100)
  }
  const portFile = path.join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await delay(100)
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0])
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++commandId, { resolve, reject })
    ws.send(JSON.stringify({ id: commandId, method, params }))
  })
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    const job = pending.get(message.id)
    if (job) {
      pending.delete(message.id)
      message.error ? job.reject(new Error(JSON.stringify(message.error))) : job.resolve(message.result)
      return
    }
    if (message.method === 'Runtime.exceptionThrown') {
      proof.exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text)
    }
    if (message.method === 'Page.javascriptDialogOpening') {
      proof.dialogs.push({ phase, message: message.params.message, accepted: acceptDialog })
      void cdp('Page.handleJavaScriptDialog', { accept: acceptDialog })
    }
    if (message.method !== 'Fetch.requestPaused') return
    const { request, requestId } = message.params
    const rest = request.url.startsWith(remoteOrigin + '/rest/v1/')
    const storage = request.url.startsWith(remoteOrigin + '/storage/v1/')
    const endpoint = rest ? request.url.slice((remoteOrigin + '/rest/v1/').length).split('?')[0] : 'storage'
    const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      || rest && endpoint.startsWith('rpc/') && /(?:list|read|get|verify|lookup|preview|search)/.test(endpoint)
    if (read || !rest && !storage) void cdp('Fetch.continueRequest', { requestId })
    else {
      proof.blockedWrites.push({ phase, endpoint, method: request.method })
      void cdp('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' })
    }
  })
  const evaluate = async (expression) => {
    const value = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text)
    return value.result.value
  }
  const waitFor = async (expression, timeout = 30000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (await evaluate(expression)) return
      await delay(150)
    }
    throw new Error(`UI timeout in ${phase}: ${expression}; dialogs=${JSON.stringify(proof.dialogs.filter((item) => item.phase === phase))}; exceptions=${JSON.stringify(proof.exceptions)}`)
  }
  const click = async (selector) => {
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`)
    await evaluate(`(()=>{document.activeElement?.blur();document.querySelector(${JSON.stringify(selector)}).click()})()`)
  }
  const set = async (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});
    el.focus();el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  const switchTo = async (centerId) => {
    await evaluate('document.activeElement?.blur();window.location.hash="#/internal/centers"')
    await waitFor(`!!document.querySelector('[data-internal-open-center-id=${JSON.stringify(centerId)}]:not(:disabled)')`)
    await click(`[data-internal-open-center-id="${centerId}"]:not(:disabled)`)
  }
  await cdp('Runtime.enable')
  await cdp('Page.enable')
  await cdp('Network.enable')
  await cdp('Fetch.enable', { patterns: [
    { urlPattern: `${remoteOrigin}/rest/v1/*`, requestStage: 'Request' },
    { urlPattern: `${remoteOrigin}/storage/v1/*`, requestStage: 'Request' },
  ] })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1536, height: 728, deviceScaleFactor: 1, mobile: false })
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5189/ichess-center-os/' })
  await waitFor('!!document.querySelector("[data-cloud-login-form]")')
  await set('[data-cloud-login-form] [name="email"]', email)
  await set('[data-cloud-login-form] [name="password"]', password)
  await click('[data-cloud-login-form] button[type="submit"]')
  await waitFor('!!document.querySelector("[data-internal-open-center-id]") || !!document.querySelector("[data-module-launcher]")', 50000)
  if (!await evaluate('!!document.querySelector("[data-module-launcher]") && document.body.innerText.includes("Cơ sở: Phòng Trống")')) {
    await switchTo('phongtrong_prod')
    await waitFor('!!document.querySelector("[data-module-launcher]")')
  }
  phase = 'open-two-drafts'
  await waitFor('document.querySelectorAll("[data-module-launcher=desktop]").length===9')
  await click('[data-module-launcher][data-module-id="cai-dat-co-so"]')
  await waitFor('!!document.querySelector(".settings-module")')
  await click('[data-settings-tab="center-info"]')
  for (let attempt = 0; attempt < 4; attempt++) {
    await waitFor('document.querySelector("[data-settings-center-action=open-edit]")?.disabled===false')
    await click('[data-settings-center-action="open-edit"]')
    await delay(200)
    if (await evaluate('!!document.querySelector("[data-settings-center-field=displayName]")')) break
  }
  await waitFor('!!document.querySelector("[data-settings-center-field=displayName]")')
  const originalName = await evaluate('document.querySelector("[data-settings-center-field=displayName]").value')
  await set('[data-settings-center-field="displayName"]', `${originalName} FINAL1-DRAFT`)
  await click('[data-module-launcher][data-module-id="hoc-vien"]')
  await waitFor('!!document.querySelector("[data-student-action=open-create]")')
  await click('[data-student-action="open-create"]')
  await waitFor('!!document.querySelector("[data-student-form-field=fullName]")')
  await set('[data-student-form-field="fullName"]', 'FINAL1 browser-local draft')
  await click('[data-module-launcher][data-module-id="bao-cao"]')
  await waitFor('!!document.querySelector(".report-module")')
  await click('[data-action="toggle-notifications"]')
  proof.cases.openWindowsBeforeSwitch = await evaluate('document.querySelectorAll(".desktop-window").length')
  assert(proof.cases.openWindowsBeforeSwitch >= 3)

  phase = 'cancel-dirty-switch'
  acceptDialog = false
  await switchTo('phongtester_prod')
  assert.equal(proof.dialogs.filter((item) => item.phase === phase).length, 1)
  assert.match(proof.dialogs.at(-1).message, /chưa lưu|bị bỏ/i)
  await evaluate('window.location.hash=""')
  await waitFor('!!document.querySelector("[data-module-launcher]")')
  assert.equal(await evaluate('document.querySelector("[data-settings-center-field=displayName]")?.value'), `${originalName} FINAL1-DRAFT`)
  assert.equal(await evaluate('document.querySelector("[data-student-form-field=fullName]")?.value'), 'FINAL1 browser-local draft')
  proof.cases.cancelKeptWindows = await evaluate('document.querySelectorAll(".desktop-window").length')

  phase = 'confirm-dirty-switch'
  acceptDialog = true
  await switchTo('phongtester_prod')
  await waitFor('document.body.innerText.includes("Cơ sở: Phòng Tester") && document.querySelectorAll("[data-module-launcher=desktop]").length===9', 50000)
  proof.cases.testerWindowCount = await evaluate('document.querySelectorAll(".desktop-window").length')
  proof.cases.testerTaskbarWindows = await evaluate('document.querySelectorAll(".taskbar-item[data-window-id]").length')
  assert.equal(proof.cases.testerWindowCount, 0)
  assert.equal(proof.cases.testerTaskbarWindows, 0)
  assert.equal(await evaluate('!!document.querySelector(".report-module")'), false)
  assert.equal(await evaluate('!!document.querySelector("#notification-center")'), false)
  assert.equal(proof.dialogs.filter((item) => item.phase === phase).length, 1)
  await click('[data-action="toggle-notifications"]')
  await waitFor('!!document.querySelector(".notification-refresh-notice.is-fresh")', 50000)
  proof.cases.testerBell = await evaluate('document.querySelector("#notification-center")?.innerText || ""')
  assert(!proof.cases.testerBell.includes('Phòng Trống'))

  phase = 'rapid-return'
  await switchTo('phongtrong_prod')
  await waitFor('document.body.innerText.includes("Cơ sở: Phòng Trống") && document.querySelectorAll("[data-module-launcher=desktop]").length===9', 50000)
  assert.equal(await evaluate('document.querySelectorAll(".desktop-window").length'), 0)
  assert.equal(proof.dialogs.filter((item) => item.phase === phase).length, 0)
  proof.cases.finalCenter = 'Phòng Trống'

  phase = 'review-workflow'
  await click('[data-action="toggle-notifications"]')
  await waitFor('!!document.querySelector(".notification-refresh-notice.is-fresh")', 50000)
  await waitFor('!!document.querySelector("[data-notification-signal=REVIEW_UPDATE_DUE] [data-notification-action=open-source]")')
  await click('[data-notification-signal="REVIEW_UPDATE_DUE"] [data-notification-action="open-source"]')
  await waitFor('!!document.querySelector(".attendance-ledger-notification-context")', 50000)
  proof.cases.reviewBoardContext = await evaluate('document.querySelector(".attendance-ledger-notification-context")?.innerText')
  await click('[data-attendance-review-workflow-open]')
  await waitFor('!!document.querySelector(".attendance-review-workflow-card")', 50000)
  proof.cases.reviewWorkflow = await evaluate('document.querySelector(".attendance-review-workflow-card")?.innerText')
  assert.match(proof.cases.reviewWorkflow, /Cập nhật nhận xét|Kỳ/)
  assert.equal(await evaluate('!!document.querySelector("[data-attendance-reminder-action]")'), false)

  phase = 'review-dark'
  await click('[data-action="toggle-start"]')
  await click('[data-ui-theme="dark"]')
  await waitFor('document.documentElement.dataset.uiTheme==="dark"')
  await waitFor('!!document.querySelector(".attendance-review-workflow-card")', 50000)
  proof.cases.darkReview = await evaluate(`(()=>{const e=document.querySelector('.attendance-review-workflow-card');
    const r=e.getBoundingClientRect();return {background:getComputedStyle(e).backgroundColor,
      visible:r.top>=0&&r.left>=0&&r.bottom<=innerHeight&&r.right<=innerWidth}})()`)
  assert.equal(proof.cases.darkReview.visible, true)
  assert.notEqual(proof.cases.darkReview.background, 'rgb(255, 255, 255)')
  await click('[data-attendance-review-close]')
  if (await evaluate('document.querySelector("[data-action=toggle-start]")?.getAttribute("aria-expanded")==="true"')) {
    await click('[data-action="toggle-start"]')
  }

  phase = 'in-flight-settings'
  await evaluate(`(()=>{const originalFetch=window.fetch.bind(window);
    window.__finalHeldSettings=null;
    window.fetch=(resource,options)=>{const url=typeof resource==='string'?resource:resource?.url||'';
      if(url.includes('/rpc/v2_1_mutate_center_settings')){
        const body=options?.body||'';
        return new Promise(resolve=>{window.__finalHeldSettings={resolve,body}});
      }
      return originalFetch(resource,options);
    }})()`)
  await click('[data-module-launcher][data-module-id="cai-dat-co-so"]')
  await waitFor('!!document.querySelector(".settings-module")')
  await click('[data-settings-tab="center-info"]')
  for (let attempt = 0; attempt < 4; attempt++) {
    await waitFor('document.querySelector("[data-settings-center-action=open-edit]")?.disabled===false')
    await click('[data-settings-center-action="open-edit"]')
    await delay(200)
    if (await evaluate('!!document.querySelector("[data-settings-center-field=displayName]")')) break
  }
  await waitFor('!!document.querySelector("[data-settings-center-field=displayName]")')
  await set('[data-settings-center-field="displayName"]', `${originalName} HELD-MOCK`)
  await click('[data-settings-center-form] button[type="submit"]')
  await waitFor('window.__finalHeldSettings!==null', 30000)
  proof.cases.heldSettingsTargetsOldCenter = await evaluate('String(window.__finalHeldSettings.body).includes("phongtrong_prod")')
  assert.equal(proof.cases.heldSettingsTargetsOldCenter, true)
  await switchTo('phongtester_prod')
  assert.equal(proof.dialogs.filter((item) => item.phase === phase).length, 1)
  assert.match(proof.dialogs.at(-1).message, /Đang lưu dữ liệu/)
  await evaluate(`window.__finalHeldSettings.resolve(new Response(JSON.stringify({ok:false,outcome_code:'VERSION_STALE',center_id:'phongtrong_prod'}),
    {status:200,headers:{'content-type':'application/json'}}))`)
  await evaluate('window.location.hash=""')
  await waitFor('!!document.querySelector("[data-module-launcher]")')
  assert.equal(await evaluate('document.body.innerText.includes("Cơ sở: Phòng Trống")'), true)
  await waitFor('document.querySelector("[data-settings-center-field=displayName]")?.value?.includes("HELD-MOCK")')
  await click('[data-settings-center-action="cancel"]')

  phase = 'rapid-a-b-a'
  await switchTo('phongtester_prod')
  await waitFor('document.body.innerText.includes("Cơ sở: Phòng Tester") && document.querySelectorAll("[data-module-launcher=desktop]").length===9')
  await switchTo('phongtrong_prod')
  await waitFor('document.body.innerText.includes("Cơ sở: Phòng Trống") && document.querySelectorAll("[data-module-launcher=desktop]").length===9', 50000)
  assert.equal(await evaluate('document.querySelectorAll(".desktop-window").length'), 0)
  await click('[data-action="toggle-notifications"]')
  await waitFor('!!document.querySelector(".notification-refresh-notice.is-fresh")', 50000)
  proof.cases.rapidFinalCenter = 'Phòng Trống'
  proof.cases.themeAfterRapid = await evaluate('document.documentElement.dataset.uiTheme')
  assert.equal(proof.cases.themeAfterRapid, 'dark')
  assert.equal(proof.dialogs.filter((item) => item.phase === phase).length, 0)

  assert.deepEqual(proof.blockedWrites, [])
  assert.deepEqual(proof.exceptions, [])
  console.log('FINAL_1_CENTER_RESET_BROWSER_QA: PASS')
  console.log(JSON.stringify(proof))
} finally {
  ws?.close()
  chrome.kill()
  vite.kill()
}
