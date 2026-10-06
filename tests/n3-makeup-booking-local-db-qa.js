import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
assert.equal(process.argv.length,2,'This runner accepts no remote target')
for(const name of ['DATABASE_URL','SUPABASE_DB_URL','SUPABASE_URL','PGHOST']) {
  if(process.env[name]) assert(['localhost','127.0.0.1','::1'].includes(name==='PGHOST'?process.env[name]:new URL(process.env[name]).hostname))
}
const run=(command,args,input)=>{
  const r=spawnSync(command,args,{input,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024})
  if(r.error||r.status!==0)throw Error(`${r.error||''}\n${r.stdout}\n${r.stderr}`)
  return r.stdout.trim()
}
const status=JSON.parse(run(process.env.ComSpec,['/d','/s','/c','npx --no-install supabase status -o json']))
assert.equal(new URL(status.DB_URL).hostname,'127.0.0.1')
const containers=run('docker',['ps','--filter','label=com.supabase.cli.project=ichess-center-os','--format','{{.ID}}|{{.Names}}|{{.Image}}'])
  .split(/\r?\n/).map(s=>s.split('|')).filter(([,name,img])=>name==='supabase_db_ichess-center-os'&&/supabase\/postgres/i.test(img))
assert.equal(containers.length,1)
const sql=s=>run('docker',['exec','-i',containers[0][0],'psql','-X','--no-psqlrc','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'],s)
const strip=path=>readFileSync(path,'utf8').replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'')
const oldRunner=readFileSync('tests/n2-attendance-write-authority-audit-local-db-qa.js','utf8')
const names=[...oldRunner.matchAll(/'(202609(?:26|27)\d+_[^']+\.sql)'/g)].map(m=>m[1])
assert.equal(names.length,10)
const setup=readFileSync('tests/n2-attendance-write-authority-audit-local-db-qa.sql','utf8').split('\nreset role;')[0]
const migrations=[...names,'202610050001_n2_attendance_write_authority_audit_foundation.sql','202610060001_n3_makeup_booking.sql'].map(p=>strip(`supabase/migrations/${p}`)).join('\n')
const before=sql("select md5(string_agg(pg_get_functiondef(oid),'' order by oid)) from pg_proc where pronamespace='public'::regnamespace")
console.log(sql(`begin;\n${migrations}\n${setup}\n${readFileSync('tests/n3-makeup-booking-local-db-qa.sql','utf8')}\nrollback;`))
assert.equal(sql("select to_regclass('public.center_makeup_bookings') is null"),'t')
assert.equal(sql("select md5(string_agg(pg_get_functiondef(oid),'' order by oid)) from pg_proc where pronamespace='public'::regnamespace"),before)
console.log('N3_MAKEUP_BOOKING_LOCAL_DB_QA: PASS (local transaction rolled back; schema preserved)')
