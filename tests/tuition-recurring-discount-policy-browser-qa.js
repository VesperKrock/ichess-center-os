// Real browser/controller -> loopback-only RPC bridge -> authenticated SQL RPC.
// One pinned LOCAL Docker transaction, rolled back even on browser failures.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { recurringLocalQaSetup } from './tuition-recurring-discount-policy-local-db-qa.js'

const runtime = process.env.ICHESS_LOCAL_PLAYWRIGHT_DIR || path.join(os.tmpdir(), 'ichess-r3b-recurring-browser')
const { chromium } = createRequire(path.join(runtime, 'package.json'))('playwright')
const output = 'artifacts/R3A/tanbinh-partial-plan-1d9cd1cd/R3B/Batch-B/B2/FINAL/evidence'
fs.mkdirSync(output, { recursive: true })
const db = spawn('docker', ['exec', '-i', 'supabase_db_ichess-center-os', 'psql', '-X', '--no-psqlrc',
  '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres', '-q', '-A', '-t'], { windowsHide: true })
let buffer = '', stderr = '', waiter, index = 0
db.stdout.setEncoding('utf8'); db.stderr.setEncoding('utf8')
db.stdout.on('data', chunk => {
  buffer += chunk
  if (waiter && buffer.includes(waiter.marker + '\n')) {
    const result = buffer.slice(0, buffer.indexOf(waiter.marker + '\n'))
    buffer = buffer.slice(buffer.indexOf(waiter.marker + '\n') + waiter.marker.length + 1)
    const current = waiter; waiter = null; clearTimeout(current.timer); current.resolve(result.trim())
  }
})
db.stderr.on('data', chunk => { stderr += chunk })
db.on('exit', code => { if (waiter) { clearTimeout(waiter.timer); waiter.reject(Error('Local psql exit ' + code + ': ' + stderr)); waiter = null } })
const query = sql => new Promise((resolve, reject) => {
  assert(!waiter, 'Local SQL bridge is sequential')
  const marker = 'RECURRING_BROWSER_END_' + ++index
  const timer = setTimeout(() => reject(Error('Local psql timeout: ' + stderr)), 30000)
  waiter = { marker, resolve, reject, timer }
  db.stdin.write(sql + "\nselect '" + marker + "';\n")
})
const jsonQuery = async sql => JSON.parse((await query(sql)).split('\n').filter(x => x.startsWith('{')).at(-1))
const quote = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb"
const countsSql = "select jsonb_build_object('cycles',(select count(*) from public.center_tuition_package_cycles where center_id='recurring_local_qa'),'finance',(select count(*) from public.finance_transaction where center_id='recurring_local_qa'),'receipts',(select count(*) from public.center_tuition_receipts where center_id='recurring_local_qa'),'attendance',(select count(*) from public.center_cloud_entities where center_id='recurring_local_qa' and entity_type='attendance_record'));"
const report = { status: 'RUNNING', testedAt: new Date().toISOString(), productionCalls: 0, writes: [], errors: [], cases: [] }
const allowed = new Set(['tuition-module.js', 'tuition-operator-controller.js', 'cloud-authoritative-tuition-cycles.js',
  'excel-initial-baseline.js', 'tuition-theme.css', 'styles.css'])
const pageHtml = `<!doctype html><html lang="vi"><meta charset="utf-8"><link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/tuition-theme.css"><style>body{display:block!important;overflow:auto!important;background:#eef2f6;height:100vh}.desktop-window.is-tuition-window{position:relative;inset:0;width:100vw;height:100vh;min-width:0}</style><body><main id="root" class="desktop-window is-tuition-window"></main><script type="module">
import {renderTuitionModule} from '/src/tuition-module.js';
import {createTuitionOperatorState,createTuitionOperatorController} from '/src/tuition-operator-controller.js';
import {parseV24PackageCycleSnapshot,mutateV24PackageCycle} from '/src/cloud-authoritative-tuition-cycles.js';
let context={centerId:'recurring_local_qa',students:[],cycleStates:[],catalog:[],receipts:[],readStatus:'idle',receiptStatus:'ready'};
const state=createTuitionOperatorState(); let controller;
const rpc=async(name,args)=>({data:await (await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})).json()});
const refresh=async()=>{const {data}=await rpc('read',{});const p=parseV24PackageCycleSnapshot(data.canonical_snapshot,context.centerId); if(!p.ok)throw Error('parser failed');context={...context,students:data.students,cycleStates:p.students,catalog:p.packageCatalog,readStatus:'ready'};render();return {ok:true}};
function render(){document.querySelector('#root').innerHTML=renderTuitionModule(context,state);controller?.bind(document.querySelector('#root'))}
controller=createTuitionOperatorController({state,getContext:()=>context,render,refresh,writeCycle:(command,idempotencyKey)=>mutateV24PackageCycle({supabase:{rpc:(name,args)=>rpc(name,args)},centerId:context.centerId,command,idempotencyKey})});
window.openDetail=id=>controller.open('detail',id);window.localState=()=>({context,state});await refresh();window.fixtureReady=true;
</script></body></html>`
const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(pageHtml); return
    }
    const file = request.url?.replace('/src/', '')
    if (request.method === 'GET' && allowed.has(file)) {
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'application/javascript')
      response.end(fs.readFileSync('src/' + file)); return
    }
    if (request.method === 'POST' && request.url === '/rpc') {
      let body = ''; for await (const chunk of request) body += chunk
      const { name, args } = JSON.parse(body)
      let result
      if (name === 'read') result = await jsonQuery("select jsonb_build_object('canonical_snapshot',public.v2_4_list_package_cycle_state('recurring_local_qa'),'students',(select jsonb_agg(payload) from public.center_cloud_entities where center_id='recurring_local_qa' and entity_type='student'));" )
      else {
        assert.equal(name, 'v2_4_mutate_package_cycle'); assert.equal(args.p_center_id, 'recurring_local_qa')
        assert.equal(args.p_command.operation, 'SET_RECURRING_DISCOUNT_POLICY')
        assert(/^[a-f0-9-]{36}$/.test(args.p_idempotency_key))
        report.writes.push(args)
        result = await jsonQuery("select public.v2_4_mutate_package_cycle('recurring_local_qa'," + quote(args.p_command) + ", '" + args.p_idempotency_key + "'::uuid);")
      }
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(result)); return
    }
    response.writeHead(404); response.end()
  } catch (error) { report.errors.push(error.message); response.writeHead(500); response.end(JSON.stringify({ error: error.message })) }
})
let browser
try {
  await query(recurringLocalQaSetup)
  report.before = await jsonQuery(countsSql)
  // Prepare one unpaid successor in the LOCAL fixture to test both versions.
  await query("select public.v2_4_mutate_package_cycle('recurring_local_qa',(select jsonb_build_object('operation','PREPARE_NEXT_CYCLE','student_id',student_local_id,'current_cycle_id',id,'expected_version',version,'package_catalog_id',package_catalog_id) from public.center_tuition_package_cycles where center_id='recurring_local_qa' and student_local_id='b2-14'), '17101700-0000-4000-8000-000000009555');")
  report.before = await jsonQuery(countsSql)
  await query('set local role authenticated;')
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  browser = await chromium.launch({ headless: true })
  report.browser = browser.version()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, locale: 'vi-VN', serviceWorkers: 'block' })
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort())
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(origin); await page.waitForFunction(() => window.fixtureReady)
  for (const [id, field, value] of [['b2-14', 'percent', '15'], ['b2-5', 'fixedMinor', '120000']]) {
    await page.evaluate(id => window.openDetail(id), id)
    await page.locator('[data-tu-action="recurring-edit"]').click()
    await page.locator('[data-tu-recurring-field="' + field + '"]').fill(value)
    await page.locator('[data-tu-action="recurring-save"]').click()
    await page.waitForFunction(() => !!window.localState().state.success)
    const saved = await page.evaluate(() => window.localState())
    const current = saved.context.cycleStates.find(s => s.studentId === id)
    assert.equal(String(current.currentCycle.recurringDiscountPolicy[field === 'percent' ? 'percent' : 'fixedMinor']), value)
    if (id === 'b2-14') assert.equal(current.preparedNextCycle.recurringDiscountPolicy.percent, 15)
    await page.locator('.tuition-detail-panel').screenshot({ path: output + '/browser-' + id + '-edited.png' })
    await page.locator('[data-tu-action="recurring-edit"]').click()
    await page.locator('[data-tu-action="recurring-stop"]').click()
    await page.waitForFunction(() => !!window.localState().state.success)
    const stopped = await page.evaluate(id => window.localState().context.cycleStates.find(s => s.studentId === id), id)
    assert(!stopped.currentCycle.recurringDiscountPolicy)
    if (id === 'b2-14') assert(!stopped.preparedNextCycle.recurringDiscountPolicy)
    assert.equal(await page.locator('[data-tu-action="recurring-edit"]').count(), 0)
    report.cases.push({ id, field, value, editAndStop: 'PASS', successorReadback: id === 'b2-14' ? 'PASS' : 'NONE' })
  }
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.evaluate(() => window.openDetail('b2-15'))
  await page.locator('[data-tu-action="recurring-edit"]').click()
  await page.locator('[data-tu-recurring-field="discountKind"]').selectOption('FIXED')
  assert.equal(await page.locator('[data-tu-recurring-field="fixedMinor"]').count(), 1)
  await page.locator('[data-tu-recurring-field="fixedMinor"]').scrollIntoViewIfNeeded()
  report.editorGeometry = await page.locator('.tuition-detail-panel').evaluate(node => ({
    width: node.clientWidth, scrollWidth: node.scrollWidth, display: getComputedStyle(node).display,
  }))
  assert(report.editorGeometry.width > 300 && report.editorGeometry.scrollWidth <= report.editorGeometry.width + 1)
  await page.locator('.tuition-detail-panel').screenshot({ path: output + '/browser-editor-1024.png' })
  await page.locator('[data-tu-action="recurring-cancel"]').click()
  await page.locator('.tuition-detail-panel').screenshot({ path: output + '/browser-detail-1024.png' })
  await page.evaluate(() => window.openDetail('policy-lock'))
  assert.equal(await page.locator('[data-tu-action="recurring-edit"]').count(), 0)
  await page.evaluate(() => window.openDetail('legacy'))
  assert.equal(await page.locator('[data-tu-action="recurring-edit"]').count(), 0)
  await query('reset role;')
  report.after = await jsonQuery(countsSql)
  assert.deepEqual(report.before, report.after, 'UI edit/stop creates no cycles, finance, receipts, attendance')
  assert.equal(report.writes.length, 4)
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors))
  report.status = 'LOCAL_BROWSER_AUTHENTICATED_SQL_FLOW_PASS'
} catch (error) {
  report.status = 'FAIL'; report.error = error.stack; throw error
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
  if (db.exitCode === null) { await query('rollback;'); db.stdin.end() }
  report.rolledBack = db.exitCode === null || db.exitCode === 0
  fs.writeFileSync(output + '/browser-qa.json', JSON.stringify(report, null, 2) + '\n')
}
console.log(report.status + ': real UI edit/stop, fixed/percent, prepared successor, paid/one-off locks, 1440/1024; DB transaction rolled back; production calls=0')
