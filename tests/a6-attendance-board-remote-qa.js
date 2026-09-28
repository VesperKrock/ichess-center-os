import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { buildSessionReportCloudEntity } from '../src/cloud-session-reports.js'

// Explicitly isolated, temporary real-app fixtures. Ordinary attendance is
// created/corrected only by authenticated A5 UI, never inserted by this script.
export const qaCenter = 'a6_browser_qa_2809'
const folder = 'artifacts/a6-attendance-board'
fs.mkdirSync(folder, { recursive: true })
const phase = process.argv[2]
assert(['before', 'provision', 'cleanup', 'after', 'inspect'].includes(phase))
const password = fs.readFileSync('matkhausupabase.txt', 'utf8').trim()
const url = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim())
assert(!url.password)
const sqlText = value => `'${String(value).replaceAll("'", "''")}'`
function sql(query) {
  const result = spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD', 'supabase_db_ichess-center-os',
    'psql', '-X', '--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-d', url.href, '-q', '-A', '-t'], {
    env: { ...process.env, PGPASSWORD: password }, input: query, encoding: 'utf8', windowsHide: true, timeout: 30000,
  })
  assert.equal(result.status, 0, `Remote QA failed; credentials are never logged. ${result.stderr?.slice(0, 1400)}`)
  return result.stdout.trim()
}

if (['before', 'after'].includes(phase)) {
  const tables = JSON.parse(sql(`begin read only; select jsonb_agg(tablename order by tablename) from pg_tables where schemaname='public'; rollback;`))
  const entries = tables.map(table => `${sqlText(table)},(select jsonb_build_object('count',count(*),
    'hash',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),''))) from public."${table}" t)`)
  // jsonb_build_object has a 100-argument limit.
  const chunks = []
  for (let index = 0; index < entries.length; index += 40) chunks.push(`jsonb_build_object(${entries.slice(index, index + 40).join(',')})`)
  const snapshots = JSON.parse(sql(`begin read only; select ${chunks.join('||')}; rollback;`))
  if (phase === 'after') {
    const before = JSON.parse(fs.readFileSync(`${folder}/remote-before.json`, 'utf8'))
    const changed = Object.keys(snapshots).filter(table => JSON.stringify(snapshots[table]) !== JSON.stringify(before[table]))
    assert.deepEqual(changed, [], 'Every public table must return to exactly its original count and row hash')
  }
  fs.writeFileSync(`${folder}/remote-${phase}.json`, JSON.stringify(snapshots, null, 2))
  console.log(JSON.stringify({ phase, tables: tables.length, unchanged: phase === 'after',
    canonicalOccurrences: snapshots.center_schedule_occurrences.count,
    attendanceEvidence: snapshots.center_cloud_entities.count }))
} else if (phase === 'inspect') {
  const data = JSON.parse(sql(`begin read only; select jsonb_build_object(
    'canonical',(select count(*) from public.center_cloud_entities where entity_type='attendance_record' and deleted_at is null and payload->>'attendanceAuthority'='v2.3-occurrence-v1'),
    'statuses',(select jsonb_object_agg(status,n) from (select payload->>'attendanceStatus' status,count(*) n from public.center_cloud_entities where entity_type='attendance_record' and deleted_at is null and payload->>'attendanceAuthority'='v2.3-occurrence-v1' group by 1) t),
    'qaRows',(select coalesce(jsonb_agg(jsonb_build_object('localId',local_id,'status',payload->>'attendanceStatus','student',payload->>'studentId','schedule',payload->>'scheduleSessionId','date',payload->>'date','version',entity_version)),'[]'::jsonb) from public.center_cloud_entities where center_id=${sqlText(qaCenter)} and entity_type='attendance_record' and deleted_at is null),
    'qaCounts',jsonb_build_object('centers',(select count(*) from public.centers where id=${sqlText(qaCenter)}),'occurrences',(select count(*) from public.center_schedule_occurrences where center_id=${sqlText(qaCenter)}))) ; rollback;`))
  fs.writeFileSync(`${folder}/remote-inspect.json`, JSON.stringify(data, null, 2))
  console.log(JSON.stringify(data))
} else if (phase === 'provision') {
  const lines = fs.readFileSync('testgmailtk.txt', 'utf8').split(/\r?\n/)
  const email = lines.find(line => /^Gmail\s*:/i.test(line))?.split(':').slice(1).join(':').trim()
  assert(email?.includes('@'))
  const dates = JSON.parse(sql(`begin read only; select jsonb_build_object('today',((clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date)::text); rollback;`))
  const date = (delta) => new Date(Date.parse(`${dates.today}T00:00:00Z`) + delta * 86400000).toISOString().slice(0, 10)
  const manifest = { centerId: qaCenter, dates: { original: date(-35), held: date(-7), second: date(-7), makeup: date(-6), cancelled: date(-5), unmarked: date(-4), future: date(2) },
    fromDate: date(-7), toDate: date(35) }
  const students = Array.from({ length: 18 }, (_, index) => ({ id: `a6qa_student_${index}`, fullName: index === 0 ? 'Nguyễn Hoàng Minh Anh' : index === 1 ? 'Trần An Bình' : `Học viên kiểm tra ${String(index + 1).padStart(2, '0')}`, studentCode: `A6-${index + 1}`, currentStatus: 'Đang học', classSessionIds: ['a6qa_class_a'] }))
  const teacherIds = [1, 2, 3].map(index => `a6000000-0000-4000-8000-00000000010${index}`)
  const teacherNames = ['Thầy Lịch sử', 'Thầy Hiện tại', 'Cô Dạy thay']
  const sessions = Object.entries(manifest.dates).map(([kind, day]) => ({
    id: `a6qa_${kind}`, scheduleType: 'oneOff', date: day, title: kind === 'second' ? 'Lớp B' : 'Lớp A',
    classSessionId: kind === 'second' ? 'a6qa_class_b' : 'a6qa_class_a',
    startTime: kind === 'second' ? '19:00' : '17:30', endTime: kind === 'second' ? '20:00' : '18:30',
    status: kind === 'cancelled' ? 'cancelled' : 'scheduled', teacherId: teacherIds[0], teacherName: teacherNames[0],
    room: 'Phòng QA', studentIds: students.map(student => student.id),
  }))
  for (let index = 0; index < 22; index++) sessions.push({ ...sessions.at(-1), id: `a6qa_planned_${index}`, date: date(index + 3), status: 'scheduled', teacherId: teacherIds[1], teacherName: teacherNames[1] })
  const report = buildSessionReportCloudEntity({ centerId: qaCenter, report: {
    id: 'a6qa_report_only', sessionId: 'a6qa_unmarked', scheduleSessionId: 'a6qa_unmarked',
    classSessionId: 'a6qa_class_a', occurrenceDate: manifest.dates.unmarked,
    teacherName: 'Report-only teacher must not appear', attendance: [{ studentId: students[2].id, status: 'absent', attendanceStatus: 'absent' }],
  } })
  assert(report.ok)
  const entities = [...students.map(payload => ['student', payload.id, payload]),
    ...['a', 'b'].map(letter => ['class_session', `a6qa_class_${letter}`, { id: `a6qa_class_${letter}`, name: `Lớp ${letter.toUpperCase()}`, displayLabel: `Lớp ${letter.toUpperCase()}`, startTime: '17:30', endTime: '18:30', daysOfWeek: ['mon'], status: 'active', instructorName: '' }]),
    ...sessions.map(payload => ['schedule_session', payload.id, payload]),
    ['session_report', report.localId, report.data.payload],
  ]
  const inserts = entities.map(([type, id, payload]) => `(${sqlText(qaCenter)},${sqlText(type)},${sqlText(id)},${sqlText(JSON.stringify(payload))}::jsonb,'a6-isolated-qa','a6-isolated-qa',1,v_actor,v_actor)`).join(',')
  sql(`begin;
    do $$ declare v_actor uuid; v_member uuid; begin
      if exists(select 1 from public.centers where id=${sqlText(qaCenter)}) then raise exception 'a6_fixture_collision'; end if;
      select id into strict v_actor from auth.users where lower(email)=lower(${sqlText(email)});
      perform set_config('request.jwt.claim.sub',v_actor::text,true);
      insert into public.centers(id,name,environment,status) values(${sqlText(qaCenter)},'A6 Attendance QA','test','active');
      insert into public.center_members(center_id,user_id,role,status) values(${sqlText(qaCenter)},v_actor,'owner','active') returning id into v_member;
      insert into public.canonical_teacher_registry(id,full_name,display_name,created_by_membership_id,updated_by_membership_id) values ${teacherIds.map((id, index) => `(${sqlText(id)}::uuid,${sqlText(teacherNames[index])},${sqlText(teacherNames[index])},v_member,v_member)`).join(',')};
      insert into public.teacher_center_assignments(teacher_id,center_id,created_by_membership_id,updated_by_membership_id) values ${teacherIds.map(id => `(${sqlText(id)}::uuid,${sqlText(qaCenter)},v_member,v_member)`).join(',')};
      insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by) values ${inserts};
      ${Object.entries(manifest.dates).map(([kind, day]) => `perform public.a2_manage_occurrence(${sqlText(qaCenter)},${sqlText(`a6qa_${kind}`)},${sqlText(day)}::date,${sqlText(kind === 'future' ? 'RESOLVE' : kind === 'cancelled' ? 'CANCEL' : 'MARK_HELD')});`).join('\n')}
      perform public.a3_set_occurrence_actual_teacher(${sqlText(qaCenter)},'a6qa_second',${sqlText(manifest.dates.second)}::date,'SET',${sqlText(teacherIds[2])}::uuid,gen_random_uuid());
      -- Change today's class teacher after capturing historical occurrences.
      perform public.a3_change_class_teacher(${sqlText(qaCenter)},'a6qa_class_a',${sqlText(teacherIds[1])}::uuid,${sqlText(dates.today)}::date,gen_random_uuid());
    end $$; commit;`)
  fs.writeFileSync(`${folder}/qa-manifest.json`, JSON.stringify(manifest, null, 2))
  console.log(JSON.stringify({ provisioned: qaCenter, students: students.length, schedules: sessions.length, attendanceWrites: 0 }))
} else if (phase === 'cleanup') {
  // Remove only the exact isolated fixture center after canonical UI QA. No
  // historical/business rows are touched; final all-table hashes prove this.
  // Foreign keys preserve history for normal entities; remove dependent QA
  // evidence explicitly inside one transaction before the fixture membership.
  const tables = JSON.parse(sql(`begin read only; select jsonb_agg(c.table_name order by c.table_name)
    from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
    where c.table_schema='public' and c.column_name='center_id' and t.table_type='BASE TABLE'; rollback;`))
  const teachers = ['a6000000-0000-4000-8000-000000000101', 'a6000000-0000-4000-8000-000000000102', 'a6000000-0000-4000-8000-000000000103']
  // A5 canonical attendance changes are retained as local QA evidence, then the
  // temporary center is retired as a unit. There is no ordinary A5 delete API.
  const ordered = ['center_tuition_attendance_contributions', 'a3_teacher_events', 'center_occurrence_attendance_command_results', 'center_class_teacher_assignments', 'center_schedule_occurrences', 'center_cloud_entities', 'teacher_center_assignments']
  const deletes = [...new Set([...ordered, ...tables.filter(table => !['center_members'].includes(table))])]
    .map(table => `delete from public."${table}" where center_id=${sqlText(qaCenter)};`).join('\n')
  const lookupTrigger = sql(`begin read only; select tgname from pg_trigger where tgrelid='public.crm_contact_lookup_control'::regclass and tgfoid='public.f23_3e_p4a_internal_guard_lookup_control()'::regprocedure; rollback;`)
  assert(/^[a-z0-9_]+$/.test(lookupTrigger), 'Exact installed lookup guard must be identified')
  assert.equal(sql(`begin read only; select count(*) from public.crm_contact_lookup_evidence where center_id=${sqlText(qaCenter)}; rollback;`), '0', 'QA center must not contain contact evidence')
  sql(`begin;
    do $$ declare v_actor uuid; v_row public.center_cloud_entities; v_expected jsonb; v_result jsonb; begin
      if not exists(select 1 from public.centers where id=${sqlText(qaCenter)} and environment='test' and name='A6 Attendance QA') then raise exception 'a6_cleanup_scope_not_verified'; end if;
      select user_id into strict v_actor from public.center_members where center_id=${sqlText(qaCenter)} and role='owner' and status='active';
      perform set_config('request.jwt.claim.sub',v_actor::text,true);
      -- Release temporary makeup links through A5's canonical V2.3 command,
      -- using the current optimistic versions, before retiring the QA center.
      for v_row in select * from public.center_cloud_entities where center_id=${sqlText(qaCenter)} and entity_type='attendance_record' and deleted_at is null and payload->>'attendanceStatus'='makeup' and payload->>'attendanceAuthority'='v2.3-occurrence-v1' loop
        select coalesce(jsonb_agg(jsonb_build_object('local_id',local_id,'version',entity_version)),'[]'::jsonb) into v_expected from public.center_cloud_entities
          where center_id=${sqlText(qaCenter)} and entity_type='attendance_record' and deleted_at is null
            and payload->>'studentId'=v_row.payload->>'studentId' and payload->>'date'=v_row.payload->>'date'
            and payload->>'scheduleSessionId'=v_row.payload->>'scheduleSessionId' and payload->>'source'<>'initialBaseline';
        v_result:=public.v2_3_mutate_occurrence_attendance(${sqlText(qaCenter)},v_row.payload->>'scheduleSessionId',(v_row.payload->>'date')::date,
          jsonb_build_array(jsonb_build_object('student_id',v_row.payload->>'studentId','source',v_row.payload->>'source','attendance_status','present',
            'expected_records',v_expected,'payload',v_row.payload-'makeupForAttendanceLocalId')),null,gen_random_uuid());
        if v_result->>'ok'<>'true' then raise exception 'a6_canonical_cleanup_failed'; end if;
      end loop;
    end $$;
    -- The center bootstrap creates an empty lookup control whose guard denies
    -- even center-cascade deletion. Lock it, disable only that guard, remove
    -- this exact QA control and restore the guard in the same transaction.
    lock table public.crm_contact_lookup_control in access exclusive mode;
    alter table public.crm_contact_lookup_control disable trigger "${lookupTrigger}";
    ${deletes}
    delete from public.canonical_teacher_registry where id in (${teachers.map(id => `${sqlText(id)}::uuid`).join(',')});
    delete from public.center_members where center_id=${sqlText(qaCenter)};
    delete from public.centers where id=${sqlText(qaCenter)};
    alter table public.crm_contact_lookup_control enable trigger "${lookupTrigger}";
    commit;`)
  console.log(JSON.stringify({ cleaned: qaCenter }))
}
