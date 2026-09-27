import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  createCashbookReconciliationFormState,
  getCashbookPhysicalCashStats,
  renderCashbookModule,
} from '../src/cashbook-module.js'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const execFileAsync = promisify(execFile)
assert(fs.existsSync(chromePath), 'Chrome is required for the real rendered-geometry smoke.')

const settings = {
  openingBalance: 500000,
  openingDate: '2026-09-24',
  updatedAt: '2026-09-24T07:00:00+07:00',
  updatedBy: 'Admin',
  isConfigured: true,
}
const transactions = [
  tx('cash-in', 'income', 200000, 'Tiền mặt'),
  tx('transfer-in', 'income', 300000, 'Chuyển khoản'),
  tx('cash-out', 'expense', 50000, 'Tiền mặt'),
]
const expectedCash = getCashbookPhysicalCashStats(transactions, '2026-09-24', settings).closingBalance
const blankForm = createCashbookReconciliationFormState(null, '2026-09-24', expectedCash)
const errorForm = {
  ...blankForm,
  errors: { actualCash: 'Tiền thực tế trong quỹ là bắt buộc.' },
}
const css = fs.readFileSync('src/styles.css', 'utf8')

const renderPage = (formState) => {
  const moduleHtml = renderCashbookModule(
    transactions,
    '2026-09-24',
    settings,
    null,
    [],
    formState,
    {},
    'Cơ sở QA',
  )
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:100%;height:100%;background:#071019}.desktop-window{position:relative;width:calc(100vw - 32px);height:calc(100vh - 32px);margin:16px;overflow:hidden}.window-body{height:100%;min-height:0;position:relative}${css}
</style></head><body><main class="desktop-window is-finance-window"><div class="window-body">${moduleHtml}</div></main>
<script>
addEventListener('load',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
  const panel=document.querySelector('.cashbook-reconciliation-panel');
  const preview=panel.querySelector('.cashbook-reconciliation-preview');
  const actions=panel.querySelector('.cashbook-reconciliation-actions');
  const actual=panel.querySelector('[data-cashbook-reconciliation-field="actualCash"]');
  const label=actual.closest('label');
  const validation=label.querySelector('small');
  const rect=(node)=>{const value=node.getBoundingClientRect();return {left:value.left,top:value.top,right:value.right,bottom:value.bottom,width:value.width,height:value.height}};
  const p=rect(panel), a=rect(actions), i=rect(actual), v=validation?rect(validation):null;
  const result={
    viewport:[innerWidth,innerHeight], panel:p, actions:a, input:i, validation:v,
    panelInsideViewport:p.left>=0&&p.top>=0&&p.right<=innerWidth&&p.bottom<=innerHeight,
    actionsInsidePanel:a.left>=p.left-1&&a.right<=p.right+1&&a.bottom<=p.bottom+1,
    validationBelowInput:!v||v.top>=i.bottom-1,
    neutralPreview:preview.textContent.includes('Chưa kiểm quỹ thực tế'),
    falseNegative:[...panel.querySelectorAll('*')].some((node)=>/Lệch\s*-[\d.]+\s*VNĐ/.test(node.textContent||'')),
    visibleButtons:[...actions.querySelectorAll('button')].every((button)=>{const b=rect(button);return b.width>0&&b.height>0&&b.bottom<=p.bottom+1}),
  };
  const output=document.createElement('script');output.id='geometry-result';output.type='application/json';output.textContent=JSON.stringify(result);document.body.append(output);
})))
</script></body></html>`
}

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end(renderPage(request.url?.includes('error=1') ? errorForm : blankForm))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-cashbook-geometry-artifacts-'))

try {
  for (const [width, height] of [[1536, 728], [1700, 850]]) {
    for (const withError of [false, true]) {
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-cashbook-geometry-'))
      const suffix = withError ? 'error' : 'blank'
      const screenshotPath = path.join(artifactDir, `cashbook-${width}x${height}-${suffix}.png`)
      let match = null
      for (let attempt = 1; attempt <= 2 && !match; attempt += 1) {
        const { stdout: dumped } = await execFileAsync(chromePath, [
          '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
          '--run-all-compositor-stages-before-draw',
          `--user-data-dir=${profile}`, `--window-size=${width},${height}`,
          `--screenshot=${screenshotPath}`, '--virtual-time-budget=2500', '--dump-dom',
          `http://127.0.0.1:${port}/${withError ? '?error=1' : ''}`,
        ], { encoding: 'utf8', timeout: 30000, maxBuffer: 20 * 1024 * 1024 })
        match = dumped.match(/<script id="geometry-result" type="application\/json">([\s\S]*?)<\/script>/)
      }
      assert(match, `Missing geometry result at ${width}×${height} (${suffix})`)
      const geometry = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'))
      assert.equal(geometry.panelInsideViewport, true, `Panel escapes viewport at ${width}×${height}`)
      assert.equal(geometry.actionsInsidePanel, true, `Actions escape panel at ${width}×${height}`)
      assert.equal(geometry.validationBelowInput, true, `Validation overlaps input at ${width}×${height}`)
      assert.equal(geometry.neutralPreview, true, `Blank cash is not neutral at ${width}×${height}`)
      assert.equal(geometry.falseNegative, false, `Blank cash creates a negative difference at ${width}×${height}`)
      assert.equal(geometry.visibleButtons, true, `Actions are cut off at ${width}×${height}`)
      console.log(`Cashbook geometry ${width}x${height} (${suffix}): PASS ${JSON.stringify(geometry)}`)
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve))
}

console.log(`CASHBOOK_GEOMETRY_ARTIFACTS=${artifactDir}`)
console.log('Cashbook reconciliation real geometry smoke: PASS')

function tx(id, type, amount, method) {
  return {
    id,
    type,
    amount,
    method,
    status: 'posted',
    transactionDate: '2026-09-24',
    createdAt: '2026-09-24T09:00:00+07:00',
    category: type === 'income' ? 'Học phí' : 'Vận hành',
    note: `Giao dịch QA ${id}`,
  }
}
