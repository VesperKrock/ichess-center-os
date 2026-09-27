import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { renderStudentModule, initialStudentFilters } from '../src/student-module.js'
import { renderStudentDetail } from '../src/student-detail.js'
import { student, classes, row } from './student-module-simplification-smoke.js'

// Real renderers/CSS, local in-memory fixtures, no Supabase/session or writes.
const css = ['src/styles.css', 'src/ui-theme.css', 'src/student-theme.css']
  .filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n')
const mainSource = fs.readFileSync('src/main.js', 'utf8')
const bindingStart = mainSource.indexOf("  document.querySelectorAll('[data-student-overview-action]').forEach")
const bindingEnd = mainSource.indexOf("  document.querySelectorAll('[data-student-detail-action]').forEach", bindingStart)
assert(bindingStart > 0 && bindingEnd > bindingStart)
const shortcutScript = `
const routes=[];const initialTuitionFilters={};let tuitionFilters={};let parentContactDetailId=null;
const getStudentById=id=>({id,fullName:'Nguyễn Quỳnh Anh'});
const openStudentEditForm=id=>routes.push({kind:'edit',id});
const openModuleWindowFromChildInteraction=module=>routes.push({kind:'module',module,query:tuitionFilters.query,customerId:parentContactDetailId});
${mainSource.slice(bindingStart, bindingEnd)}
for(const button of document.querySelectorAll('[data-student-overview-action]'))button.click();
const routeResult=document.createElement('script');routeResult.id='shortcut-result';routeResult.type='application/json';routeResult.textContent=JSON.stringify(routes);document.body.append(routeResult);
`
const fixtureHtml = (kind) => {
  const shown = kind === 'long' ? { ...student, fullName: 'Nguyễn Trần Hoàng Minh Anh Phương',
    parentName: 'Nguyễn Thị Hoàng Thu Hương', schoolName: 'Trường Tiểu học Nguyễn Thị Minh Khai',
    personality: 'Bé thích khám phá và cần thời gian làm quen với bạn mới. '.repeat(10) } : student
  const rows = [{ ...row, student: shown }]
  const options = { tuitionRows: rows, customerIds: { [student.id]: 'qa-customer' } }
  if (kind === 'list') {
    const roster = [shown, { ...student, id: 'no-class', fullName: 'Trần Minh An', classSessionIds: [] },
      { ...student, id: 'stopped', fullName: 'Lê Bảo Anh', currentStatus: 'Ngưng học', classSessionIds: [] }]
    return renderStudentModule(roster, initialStudentFilters, null, [], classes, options)
  }
  if (kind === 'missing') return renderStudentDetail({ ...shown, classSessionIds: ['old'] }, [], classes, [], options)
  if (kind === 'unavailable') return renderStudentDetail(shown, [], classes, [], {})
  return renderStudentDetail(shown, [], classes, [], options)
}
const geometryScript = `
addEventListener('load', () => requestAnimationFrame(() => requestAnimationFrame(() => {
  if (document.body.dataset.screen === 'more') document.querySelector('details').open = true;
  const rect = node => {const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const root = document.querySelector('.student-detail-overview, .student-module');
  const hero = document.querySelector('.student-detail-hero');
  const next = document.querySelector('.student-next-action');
  const tiles = [...document.querySelectorAll('.student-operational-grid > section')];
  const regions = [...document.querySelectorAll('.student-detail-hero, .student-next-action, .student-overview-tile, .student-profile-schedule-grid, .student-profile-more')];
  const overflow = regions.filter(n=>n.clientWidth && n.scrollWidth>n.clientWidth+1).map(n=>n.className);
  const result = {viewport:[innerWidth,innerHeight],overflow,
    horizontalPageOverflow:document.documentElement.scrollWidth>innerWidth+1,
    nextAfterIdentity:!next || rect(next).top>=rect(hero).bottom,
    topSnapshotsAfterNext:!next || tiles.every(n=>rect(n).top>=rect(next).bottom),
    onePrimary:!next || next.querySelectorAll('[data-student-overview-action]').length<=1,
    primaryVisible:!next || rect(next).bottom<=innerHeight,
    containerInside:rect(root).left>=0 && rect(root).right<=innerWidth+1 && rect(root).bottom<=innerHeight+1,
    scrollableProfile:!next || root.scrollHeight>root.clientHeight,
    extraInfoCollapsed:!next || document.querySelector('details').open===(document.body.dataset.screen==='more'),
    primaryButtonsReadable:[...document.querySelectorAll('.student-next-action button,.student-next-action-button')].every(n=>rect(n).height>=30),
    colors:{foreground:getComputedStyle(root).color,background:getComputedStyle(root).backgroundColor}};
  if(document.body.dataset.screen==='more')root.scrollTop=root.scrollHeight;
  const output=document.createElement('script');output.id='geometry-result';output.type='application/json';output.textContent=JSON.stringify(result);document.body.append(output);
})))`
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  const kind = url.searchParams.get('screen') || 'profile'
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "connect-src 'none'" })
  response.end(`<!doctype html><html data-ui-theme="${theme}"><head><meta charset="utf-8"><style>${css}
html,body{margin:0;width:100%;height:100%}.desktop-window{position:absolute;inset:16px;width:calc(100vw - 32px);height:calc(100vh - 32px);min-width:0;min-height:0;display:flex;flex-direction:column}.window-body{position:relative;display:flex;flex:1;min-height:0;overflow:hidden}.qa-caption{margin-left:auto;font-size:11px}
</style></head><body data-screen="${kind}"><main class="desktop-window is-student-window ${kind === 'list' ? 'is-student-list-window' : 'is-student-profile-window'}"><div class="window-titlebar"><h2>Học viên — DreamHome</h2><span class="qa-caption">Ảnh QA giao diện · dữ liệu cục bộ</span></div><div class="window-body">${fixtureHtml(kind)}</div></main><script>${shortcutScript}</script><script>${geometryScript}</script></body></html>`)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-student-ui-'))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-student-qa-chrome-'))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let ws
try {
  const portFile = path.join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await delay(100)
  assert(fs.existsSync(portFile), 'Chrome DevTools did not start')
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0])
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data), job = pending.get(msg.id)
    if (!job) return
    pending.delete(msg.id)
    msg.error ? job.reject(new Error(JSON.stringify(msg.error))) : job.resolve(msg.result)
  })
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }))
  })
  await cdp('Page.enable')
  for (const [width, height] of [[1536, 728], [1280, 720]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    for (const theme of ['light', 'dark']) {
      for (const kind of ['list', 'profile', 'missing', 'unavailable', 'long', 'more']) {
        await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?screen=${kind}&theme=${theme}` })
        let encoded
        for (let attempt = 0; attempt < 100; attempt++) {
          await delay(50)
          const result = await cdp('Runtime.evaluate', { expression: 'document.querySelector("#geometry-result")?.textContent', returnByValue: true })
          if (result.result.value) { encoded = result.result.value; break }
        }
        assert(encoded, `Missing geometry results ${kind}/${theme}`)
        const geometry = JSON.parse(encoded)
        const routeEval = await cdp('Runtime.evaluate', { expression: 'document.querySelector("#shortcut-result")?.textContent', returnByValue: true })
        const routes = JSON.parse(routeEval.result.value)
        assert(routes.some((route) => route.module === 'hoc-phi' && route.query === student.fullName))
        if (kind === 'list') assert(routes.some((route) => route.kind === 'edit' && route.id === 'no-class'))
        if (kind === 'missing') assert(routes.some((route) => route.kind === 'edit' && route.id === student.id))
        if (kind !== 'list') assert(routes.some((route) => route.module === 'thoi-khoa-bieu'))
        if (!['list', 'unavailable'].includes(kind)) assert(routes.some((route) => route.module === 'khach-hang-tu-van' && route.customerId === 'qa-customer'))
        const screenshot = path.join(artifacts, `${kind}-${theme}-${width}x${height}.png`)
        const captured = await cdp('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
        fs.writeFileSync(screenshot, Buffer.from(captured.data, 'base64'))
        console.log(JSON.stringify({ kind, theme, ...geometry, screenshot }))
        assert.deepEqual(geometry.viewport, [width, height])
        assert.deepEqual(geometry.overflow, [], `${kind}/${theme}: horizontal region overflow`)
        assert.equal(geometry.horizontalPageOverflow, false)
        for (const key of ['nextAfterIdentity', 'topSnapshotsAfterNext', 'onePrimary', 'primaryVisible', 'containerInside', 'extraInfoCollapsed', 'primaryButtonsReadable']) assert(geometry[key], `${kind}/${theme}: ${key}`)
      }
    }
  }
} finally {
  ws?.close(); chrome.kill(); await new Promise((resolve) => server.close(resolve))
}
console.log(`STUDENT_UI_ARTIFACTS=${artifacts}`)
console.log('STUDENT_SIMPLIFICATION_VISUAL: PASS (24 Light/Dark viewport cases)')
