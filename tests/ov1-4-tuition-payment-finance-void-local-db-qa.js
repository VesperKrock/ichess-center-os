import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const migrationPath = 'supabase/migrations/202608210002_ov1_4_tuition_payment_finance_void.sql'
const hardeningPath = 'supabase/migrations/202608210003_ov1_4_tuition_payment_identity_compatibility_hardening.sql'
const migrationBytes = readFileSync(migrationPath)
const hardeningBytes = readFileSync(hardeningPath)
const migrationHash = createHash('sha256').update(migrationBytes).digest('hex').toUpperCase()
const hardeningHash = createHash('sha256').update(hardeningBytes).digest('hex').toUpperCase()

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked Supabase project references are forbidden')

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
    maxBuffer: 32 * 1024 * 1024, ...options,
  })
  if (result.error) throw result.error
  return result
}
const requireSuccess = (result, label) => {
  if (result.status !== 0) throw new Error(`${label}: ${result.stdout}\n${result.stderr}`)
  return result.stdout
}
const cliCommand = process.platform === 'win32' ? process.env.ComSpec : 'npx'
const cliArgs = (tail) => process.platform === 'win32'
  ? ['/d', '/s', '/c', `npx --no-install supabase ${tail}`]
  : ['--no-install', 'supabase', ...tail.split(' ')]
const localStatus = JSON.parse(requireSuccess(run(cliCommand, cliArgs('status -o json')), 'local status'))
for (const value of [localStatus.DB_URL, localStatus.API_URL]) {
  assert(['127.0.0.1', 'localhost', '::1'].includes(new URL(value).hostname), 'Local QA must stay loopback-only')
}
const containerRows = requireSuccess(run('docker', [
  'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]), 'Docker discovery').trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
  .filter(([, name]) => name === expectedContainer)
assert.equal(containerRows.length, 1, 'Expected exactly one local DB container')
assert(/supabase\/postgres/i.test(containerRows[0][2]))
const containerId = containerRows[0][0]
const psqlArgs = [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql) => requireSuccess(run('docker', psqlArgs, { input: sql }), 'local psql')
const scalar = (sql) => psql(sql).trim()
const q = (value) => `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

if (scalar("select to_regprocedure('public.c5_4_void_tuition_payment(text,uuid,text,text,bigint,text,uuid)') is not null;") !== 't') {
  psql(migrationBytes.toString('utf8'))
}
psql(hardeningBytes.toString('utf8'))
assert.equal(
  scalar("select to_regprocedure('public.c5_4_void_tuition_payment(text,uuid,text,text,bigint,text,uuid)') is not null;"),
  't',
)
assert.equal(
  scalar("select has_function_privilege('authenticated','public.c5_4_void_tuition_payment(text,uuid,text,text,bigint,text,uuid)','EXECUTE');"),
  't',
)
assert.equal(
  scalar("select has_function_privilege('anon','public.c5_4_void_tuition_payment(text,uuid,text,text,bigint,text,uuid)','EXECUTE');"),
  'f',
)

const suffix = randomUUID()
const ids = {
  owner: randomUUID(),
  admin: randomUUID(),
  other: randomUUID(),
  center: `ov1-4-${suffix}`,
  otherCenter: `ov1-4-other-${suffix}`,
  tuition: `ov1-4-tuition-${suffix}`,
  student: `ov1-4-student-${suffix}`,
  period: `ov1-4-period-${suffix}`,
  transactionAdminVoid: randomUUID(),
  transactionOwnerVoid: randomUUID(),
  transactionPeriodStale: randomUUID(),
  transactionGenericCreate: randomUUID(),
  adminVoidKey: randomUUID(),
  ownerVoidKey: randomUUID(),
  genericCreateKey: randomUUID(),
}
const payload = JSON.stringify({
  id: ids.tuition,
  studentId: ids.student,
  currentTermId: ids.period,
  totalSessions: 10,
  usedSessions: 0,
  totalAmount: 900000,
  paidAmount: 0,
  discountType: 'none',
  discountValue: 0,
  payments: [],
  termHistory: [],
})
const tuitionLocalId = `tuition_record_package::${ids.tuition}`
const paymentId = (label) => `ov1-4-payment-${label}-${suffix}`

const qaSql = `
begin;

insert into auth.users(id,aud,role,created_at,updated_at) values
  (${u(ids.owner)}, 'authenticated', 'authenticated', now(), now()),
  (${u(ids.admin)}, 'authenticated', 'authenticated', now(), now()),
  (${u(ids.other)}, 'authenticated', 'authenticated', now(), now());
insert into public.centers(id,name,status) values
  (${q(ids.center)}, 'OV1.4 local QA', 'active'),
  (${q(ids.otherCenter)}, 'OV1.4 other local QA', 'active');
insert into public.center_members(center_id,user_id,role,status) values
  (${q(ids.center)}, ${u(ids.owner)}, 'owner', 'active'),
  (${q(ids.center)}, ${u(ids.admin)}, 'center_admin', 'active'),
  (${q(ids.otherCenter)}, ${u(ids.other)}, 'owner', 'active');
insert into public.center_cloud_entities (
  center_id, entity_type, local_id, payload, source_module, source_version,
  entity_version, created_by, updated_by
) values (
  ${q(ids.center)}, 'tuition_record_package', ${q(tuitionLocalId)}, ${q(payload)}::jsonb,
  'tuition', 'c5.2-authoritative-attendance-tuition-v1', 1,
  ${u(ids.owner)}, ${u(ids.owner)}
);
insert into public.finance_transaction (
  id, center_id, transaction_code, cashflow_type, category_id,
  category_name_snapshot, amount_minor, transaction_date, method,
  source_module, source_type, source_payment_id, source_tuition_id,
  source_student_id, source_period_id, created_by, updated_by
) values
  (${u(ids.transactionAdminVoid)}, ${q(ids.center)}, 'TC-20260821-9001', 'INCOME',
   (select id from public.finance_category where center_id=${q(ids.center)} and name='Học phí'),
   'Học phí', 100000, '2026-08-21', 'Tiền mặt', 'hoc-phi', 'tuition-payment',
   ${q(paymentId('admin'))}, ${q(tuitionLocalId)}, ${q(ids.student)}, ${q(ids.period)}, ${u(ids.owner)}, ${u(ids.owner)}),
  (${u(ids.transactionOwnerVoid)}, ${q(ids.center)}, 'TC-20260821-9002', 'INCOME',
   (select id from public.finance_category where center_id=${q(ids.center)} and name='Học phí'),
   'Học phí', 100000, '2026-08-21', 'Tiền mặt', 'hoc-phi', 'tuition-payment',
   ${q(paymentId('owner'))}, ${q(tuitionLocalId)}, ${q(ids.student)}, ${q(ids.period)}, ${u(ids.admin)}, ${u(ids.admin)}),
  (${u(ids.transactionPeriodStale)}, ${q(ids.center)}, 'TC-20260821-9003', 'INCOME',
   (select id from public.finance_category where center_id=${q(ids.center)} and name='Học phí'),
   'Học phí', 100000, '2026-08-21', 'Tiền mặt', 'hoc-phi', 'tuition-payment',
   ${q(paymentId('stale'))}, ${q(tuitionLocalId)}, ${q(ids.student)}, ${q(ids.period)}, ${u(ids.owner)}, ${u(ids.owner)});

select pg_catalog.set_config('request.jwt.claim.sub', ${q(ids.admin)}, true);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

do $qa$
declare
  v_result jsonb;
begin
  v_result := public.c5_4_mutate_finance_shared_truth(
    ${q(ids.center)},
    pg_catalog.jsonb_build_object(
      'operation', 'VOID_TRANSACTION',
      'transaction_id', ${q(ids.transactionAdminVoid)},
      'expected_version', 1
    ),
    gen_random_uuid()
  );
  if v_result->>'outcome_code' <> 'PROTECTED_TRANSACTION' then
    raise exception 'generic protection failed: %', v_result;
  end if;

  v_result := public.c5_4_void_tuition_payment(
    ${q(ids.center)}, ${u(ids.transactionAdminVoid)}, ${q(paymentId('admin'))},
    ${q(tuitionLocalId)}, 1, 'Admin sửa khoản thu nhập nhầm', ${u(ids.adminVoidKey)}
  );
  if v_result->>'outcome_code' <> 'COMMITTED' or (v_result->>'replayed')::boolean then
    raise exception 'admin void failed: %', v_result;
  end if;
  v_result := public.c5_4_void_tuition_payment(
    ${q(ids.center)}, ${u(ids.transactionAdminVoid)}, ${q(paymentId('admin'))},
    ${q(tuitionLocalId)}, 1, 'Admin sửa khoản thu nhập nhầm', ${u(ids.adminVoidKey)}
  );
  if v_result->>'outcome_code' <> 'COMMITTED' or not (v_result->>'replayed')::boolean then
    raise exception 'idempotent replay failed: %', v_result;
  end if;
  v_result := public.c5_4_void_tuition_payment(
    ${q(ids.center)}, ${u(ids.transactionAdminVoid)}, ${q(paymentId('admin'))},
    ${q(tuitionLocalId)}, 1, 'Lý do khác cùng khóa', ${u(ids.adminVoidKey)}
  );
  if v_result->>'outcome_code' <> 'IDEMPOTENCY_CONFLICT' then
    raise exception 'idempotency conflict failed: %', v_result;
  end if;
  v_result := public.c5_4_void_tuition_payment(
    ${q(ids.center)}, ${u(ids.transactionAdminVoid)}, ${q(paymentId('admin'))},
    ${q(tuitionLocalId)}, 1, 'Bản cũ phải bị chặn', gen_random_uuid()
  );
  if v_result->>'outcome_code' <> 'VERSION_STALE' then
    raise exception 'stale version failed: %', v_result;
  end if;
end
$qa$;

select pg_catalog.set_config('request.jwt.claim.sub', ${q(ids.owner)}, true);
do $qa$
declare
  v_result jsonb;
begin
  v_result := public.c5_4_mutate_finance_shared_truth(
    ${q(ids.center)},
    pg_catalog.jsonb_build_object(
      'operation', 'CREATE_TRANSACTION',
      'transaction_id', ${q(ids.transactionGenericCreate)},
      'expected_version', 0,
      'local_source_id', ${q(paymentId('generic'))},
      'cashflow_type', 'INCOME',
      'category_id', (select id::text from public.finance_category where center_id=${q(ids.center)} and name='Học phí'),
      'amount_minor', 100000,
      'transaction_date', '2026-08-21',
      'method', 'Tiền mặt',
      'source_module', 'hoc-phi',
      'source_type', 'tuition-payment',
      'source_payment_id', ${q(paymentId('generic'))},
      'source_tuition_id', ${q(tuitionLocalId)},
      'source_student_id', ${q(ids.student)},
      'source_period_id', ${q(ids.period)},
      'attachment_action', 'KEEP'
    ),
    ${u(ids.genericCreateKey)}
  );
  if v_result->>'outcome_code' <> 'COMMITTED' then
    raise exception 'canonical C5.2 identity payment create failed: %', v_result;
  end if;

  v_result := public.c5_4_void_tuition_payment(
    ${q(ids.center)}, ${u(ids.transactionOwnerVoid)}, ${q(paymentId('owner'))},
    ${q(tuitionLocalId)}, 1, 'Owner sửa khoản thu nhập nhầm', ${u(ids.ownerVoidKey)}
  );
  if v_result->>'outcome_code' <> 'COMMITTED' then
    raise exception 'owner parity failed: %', v_result;
  end if;

  update public.center_cloud_entities
  set payload = pg_catalog.jsonb_set(payload, '{currentTermId}', pg_catalog.to_jsonb(${q(`${ids.period}-new`)}::text)),
      entity_version = entity_version + 1
  where center_id = ${q(ids.center)} and entity_type = 'tuition_record_package'
    and local_id = ${q(tuitionLocalId)};
  v_result := public.c5_4_void_tuition_payment(
    ${q(ids.center)}, ${u(ids.transactionPeriodStale)}, ${q(paymentId('stale'))},
    ${q(tuitionLocalId)}, 1, 'Kỳ đã đổi phải bị chặn', gen_random_uuid()
  );
  if v_result->>'outcome_code' <> 'TUITION_PERIOD_STALE' then
    raise exception 'tuition currentness failed: %', v_result;
  end if;
end
$qa$;

select pg_catalog.set_config('request.jwt.claim.sub', ${q(ids.other)}, true);
do $qa$
declare
  v_result jsonb;
begin
  v_result := public.c5_4_void_tuition_payment(
    ${q(ids.center)}, ${u(ids.transactionPeriodStale)}, ${q(paymentId('stale'))},
    ${q(tuitionLocalId)}, 1, 'Khác cơ sở phải bị chặn', gen_random_uuid()
  );
  if v_result->>'outcome_code' <> 'WRITE_ROLE_REQUIRED' then
    raise exception 'cross-center write failed: %', v_result;
  end if;
  v_result := public.c5_4_list_finance_shared_truth(${q(ids.otherCenter)});
  if v_result->>'outcome_code' <> 'READ_OK'
     or pg_catalog.jsonb_array_length(v_result->'transactions') <> 0 then
    raise exception 'cross-center read isolation failed: %', v_result;
  end if;
end
$qa$;

do $qa$
begin
  if (select status || ':' || version from public.finance_transaction
      where center_id=${q(ids.center)} and id=${u(ids.transactionAdminVoid)}) <> 'VOIDED:2' then
    raise exception 'admin void row mismatch';
  end if;
  if (select status || ':' || version from public.finance_transaction
      where center_id=${q(ids.center)} and id=${u(ids.transactionOwnerVoid)}) <> 'VOIDED:2' then
    raise exception 'owner void row mismatch';
  end if;
  if (select status from public.finance_transaction
      where center_id=${q(ids.center)} and id=${u(ids.transactionPeriodStale)}) <> 'POSTED' then
    raise exception 'failed void changed source row';
  end if;
  if (select status from public.finance_transaction
      where center_id=${q(ids.center)} and id=${u(ids.transactionGenericCreate)}) <> 'POSTED' then
    raise exception 'canonical identity payment create row mismatch';
  end if;
  if (select count(*) from public.finance_audit_event
      where center_id=${q(ids.center)} and action='VOID_TUITION_PAYMENT') <> 2 then
    raise exception 'audit count mismatch';
  end if;
  if (select count(*) from public.finance_command_result
      where center_id=${q(ids.center)} and idempotency_key in (${u(ids.adminVoidKey)}, ${u(ids.ownerVoidKey)})) <> 2 then
    raise exception 'command result count mismatch';
  end if;
end
$qa$;

rollback;
`

psql(qaSql)
assert.equal(scalar(`select count(*) from public.centers where id in (${q(ids.center)}, ${q(ids.otherCenter)});`), '0')
assert.equal(scalar(`select count(*) from auth.users where id in (${u(ids.owner)}, ${u(ids.admin)}, ${u(ids.other)});`), '0')

console.log(`OV1_4_LOCAL_DB_MIGRATION_READY: PASS (${migrationHash}; ${hardeningHash})`)
console.log('OV1_4_LOCAL_GENERIC_PROTECTION_ADMIN_VOID_RETRY_STALE_AUDIT: PASS')
console.log('OV1_4_LOCAL_OWNER_ADMIN_OPERATIONAL_PARITY: PASS')
console.log('OV1_4_LOCAL_CURRENTNESS_CROSS_CENTER_FAIL_CLOSED: PASS')
console.log('OV1_4_LOCAL_DB_ACTIVE_FIXTURE_RESIDUE_0: PASS')
console.log('OV1_4_TUITION_PAYMENT_FINANCE_VOID_LOCAL_DB_QA: PASS')
