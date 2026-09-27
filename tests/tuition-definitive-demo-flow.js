import { spawnSync } from 'node:child_process'
export async function run(ui) {
  const {
    assert,
    fs,
    path,
    artifacts,
    report,
    evaluate,
    click,
    waitFor,
    screenshot,
    ready,
    close,
    textPanel,
    setField,
    search,
    openDetail,
    hardRefresh,
    capturePdf,
    delay,
  } = ui
  const base = JSON.parse(
    fs.readFileSync(path.join(artifacts, 'demo-base.json')),
  )
  const id = (key) => base.records.find((r) => r.key === key).id
  const verifyStale=async()=>{
  await openDetail(id('practice-pay'))
  await click('[data-tu-panel] [data-tu-action=payment]')
  await waitFor('!!document.querySelector("[data-tu-panel=payment]")')
  const moneyRequestsBefore = report.requests.filter((r) =>
    r.url.endsWith('/rpc/f5b_mutate_tuition_receipt'),
  ).length
  const change = spawnSync(
    process.execPath,
    ['tests/tuition-definitive-demo-stale-change.js'],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 },
  )
  assert.equal(change.status, 0, change.stderr)
  await click('[data-tu-form] [type=submit]')
  await waitFor(
    `document.querySelector('[data-tu-panel=payment] [role=alert]')?.innerText.includes('vừa được cập nhật')`,
    45000,
  )
  assert.equal(
    report.requests.filter((r) =>
      r.url.endsWith('/rpc/f5b_mutate_tuition_receipt'),
    ).length,
    moneyRequestsBefore,
  )
  await screenshot('demo-real-stale-blocked-zero-money')
  await close()
  }
  if(process.argv[3]==='stale'){await verifyStale();report.realStaleZeroMoney=true;return}
  const setup = async (key, used = null) => {
    const already = await evaluate(
      `document.querySelector('[data-tuition-row-student-id="${id(key)}"]')?.innerText`,
    )
    if (already?.includes('Kỳ 1')) return
    if (used !== null) {
      await click('[data-tu-action=initial-queue]')
      await click(
        `[data-tu-panel=queue] [data-tu-student-id="${id(key)}"][data-tu-action=initial]`,
      )
    } else {
      await search(base.records.find((r) => r.key === key).name)
      await click(
        `[data-tuition-row-student-id="${id(key)}"] [data-tu-action=assign]`,
      )
    }
    await waitFor('!!document.querySelector("[data-tu-form]")')
    await setField('packageCatalogId', base.packageId)
    if (used !== null) {
      await setField('usedSessions', used)
      await setField('openingPaymentState', 'PAID_BEFORE_ICHESS')
    }
    if (key === 'a' || key === 'c') await screenshot(`${key}-setup-before-save`)
    await click('[data-tu-form] [type=submit]')
    await waitFor('!!document.querySelector("[data-tu-panel=detail]")')
    await ready()
    assert((await textPanel()).includes(`Kỳ 1 · ${used ?? 0}/16`))
    assert(!(await textPanel()).includes('Chưa có gói'))
    if (key === 'a' || key === 'c') await screenshot(`${key}-setup-result`)
    await close()
    await search('')
  }
  if (!fs.existsSync(path.join(artifacts, 'demo-attendance.json'))) {
    for (const [key, used] of [
      ['a', 6],
      ['b', 6],
      ['c', null],
      ['d', 14],
      ['e', 16],
      ['f', null],
      ['practice-pay', null],
      ['practice-end', null],
      ['practice-debt', 16],
    ])
      await setup(key, used)
    const result = spawnSync(
      process.execPath,
      ['tests/tuition-definitive-demo-seed.js', 'attendance'],
      { encoding: 'utf8', windowsHide: true, timeout: 60000 },
    )
    assert.equal(result.status, 0, result.stderr)
    await hardRefresh()
  }
  const payment = async (key, progress) => {
    await openDetail(id(key))
    assert((await textPanel()).includes(progress))
    if (
      await evaluate(
        '!!document.querySelector("[data-tu-panel] [data-tu-action=payment]")',
      )
    ) {
      report.observations.push({
        beforePayment: key,
        panel: await textPanel(),
      })
      await screenshot(`${key}-unpaid-documents`)
      assert((await textPanel()).includes('Chưa có Phiếu Thu'))
      await click('[data-tu-panel] [data-tu-action=payment]')
      await waitFor('!!document.querySelector("[data-tu-panel=payment]")')
      assert(
        !(await evaluate(
          '!!document.querySelector("[data-tu-panel] [role=alert]")',
        )),
      )
      await screenshot(`${key}-full-payment-before-save`)
      await click('[data-tu-form] [type=submit]')
      await waitFor(
        '!!document.querySelector("[data-tu-panel=detail] [data-tu-success] [data-tu-action=receipt]")',
        45000,
      )
      await ready()
      assert((await textPanel()).includes('✓ Đã ghi nhận thanh toán'))
      assert((await textPanel()).includes(progress))
      await screenshot(`${key}-payment-success-receipt`)
      await capturePdf(
        '[data-tu-success] [data-tu-action=receipt]',
        `${key}-receipt-immediate`,
      )
      await click('[data-tu-success] [data-tu-action=dismiss-success]')
    }
    await screenshot(`${key}-paid-detail`)
    await capturePdf(
      '[data-tu-panel] .tuition-simple-documents [data-tu-action=receipt]',
      `${key}-receipt-reprint`,
    )
    await close()
  }
  await payment('c', 'Kỳ 1 · 0/16')
  await payment('e', 'Kỳ 2 · 2/16')
  for (const [key, progress] of [
    ['a', 'Kỳ 1 · 6/16'],
    ['b', 'Kỳ 1 · 8/16'],
    ['d', 'Kỳ 1 · 14/16'],
  ]) {
    await openDetail(id(key))
    assert((await textPanel()).includes(progress))
    await screenshot(`${key}-detail-documents`)
    await capturePdf(
      '[data-tu-panel] [data-tu-action=tbhp]',
      `${key}-tbhp-real-app`,
    )
    await close()
  }
  await openDetail(id('f'))
  if ((await textPanel()).includes('Kỳ 1 · 13/16')) {
    await screenshot('f-before-end-13-of-16')
    await click('[data-tu-panel] [data-tu-action=end]')
    await waitFor(
      `document.querySelector('[data-tu-panel=detail]')?.innerText.includes('Hết hiệu lực: 3 buổi')`,
      45000,
    )
  } else {
    await click('[data-tu-panel] .tuition-simple-history summary')
    await click(
      '[data-tu-panel] .tuition-simple-history-cycle [data-tu-action=detail]',
    )
  }
  assert((await textPanel()).includes('Đã học: 13/16 · Hết hiệu lực: 3 buổi'))
  await screenshot('f-ended-13-attended-3-expired')
  await capturePdf(
    '[data-tu-panel] .tuition-simple-documents [data-tu-action=tbhp]',
    'f-ended-tbhp',
  )
  await close()
  for (const theme of ['light', 'dark']) {
    await click('[data-action="toggle-start"]')
    await click(`button[data-ui-theme="${theme}"]`)
    if (await evaluate('!!document.querySelector("#start-menu")'))
      await click('[data-action="toggle-start"]')
    await search('')
    await screenshot(`demo-${theme}-list`)
    await openDetail(id('a'))
    await screenshot(`demo-${theme}-legacy-detail`)
    await close()
    await openDetail(id('practice-pay'))
    await click('[data-tu-panel] [data-tu-action=payment]')
    await waitFor('!!document.querySelector("[data-tu-panel=payment]")')
    assert(
      !(await evaluate(
        '!!document.querySelector("[data-tu-panel] [role=alert]")',
      )),
    )
    await screenshot(`demo-${theme}-payment-form`)
    await close()
    await openDetail(id('practice-legacy'))
    await click('[data-tu-panel] [data-tu-action=initial]')
    await screenshot(`demo-${theme}-legacy-setup`)
    await close()
    await openDetail(id('practice-new'))
    await click('[data-tu-panel] [data-tu-action=assign]')
    assert(
      !(await evaluate(
        '!!document.querySelector("[data-tu-field=usedSessions]")',
      )),
    )
    await screenshot(`demo-${theme}-new-assign`)
    await close()
    await hardRefresh()
    const rows = await evaluate(
      `[...document.querySelectorAll('.tuition-clickable-row')].map(n=>({id:n.dataset.tuitionRowStudentId,text:n.innerText,tbhp:!!n.querySelector('[data-tu-action=tbhp]')}))`,
    )
    assert.equal(rows.length, base.records.length)
    assert(!rows.some((r) => /Đang tải|NaN|Cần xác nhận kỳ/.test(r.text)))
    for (const [key, progress] of [
      ['a', '6/16'],
      ['b', '8/16'],
      ['c', '0/16'],
      ['d', '14/16'],
      ['e', '2/16'],
      ['practice-end', '13/16'],
      ['practice-debt', '2/16'],
    ]) {
      const r = rows.find((r) => r.id === id(key))
      assert(
        r.text.includes(progress) && r.tbhp && !r.text.includes('Chưa có gói'),
      )
    }
    report.observations.push({
      theme,
      viewport: '1536x728',
      rows,
      hardRefresh: 'PASS',
    })
  }
  await verifyStale()
  report.demoOperatorFlow = {
    legacySetup: true,
    newAssignment: true,
    paymentC: true,
    paymentE: true,
    immediateReceiptOpened: true,
    reprint: true,
    debtProgressPreserved: '2/16',
    endCycle: '13 attended + 3 expired',
    tbhpOpened: ['A', 'B', 'D', 'F'],
    genuineStaleBlockedBeforeMoneyWrite: true,
  }
}
