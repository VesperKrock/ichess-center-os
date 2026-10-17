import fs from 'node:fs'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {recurringLocalQaSetup} from './tuition-recurring-discount-policy-local-db-qa.js'
const container='supabase_db_ichess-center-os'
const inspect=spawnSync('docker',['inspect',container],{encoding:'utf8',windowsHide:true})
assert.equal(inspect.status,0,inspect.stderr)
assert(JSON.parse(inspect.stdout)[0].NetworkSettings.Ports['5432/tcp'].some(p=>p.HostPort==='54322'))
const psql=sql=>spawnSync('docker',['exec','-i',container,'psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres','-q','-A','-t'],
 {input:sql,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:12*1024*1024})
const strip=sql=>sql.replace(/\r\n/g,'\n').replace(/^(?:begin|commit|rollback);\s*$/gmi,'')
const migration=strip(fs.readFileSync('supabase/migrations/202610170002_verified_initial_source_overage.sql','utf8'))
const fixture=fs.readFileSync('tests/r3c-initial-source-overage-local-db-qa.sql','utf8')
assert.equal(fixture.split('-- MIGRATION_INSERT_POINT').length,2)
export const r3cLocalQaSetup=recurringLocalQaSetup+'\n'+fixture.replace('-- MIGRATION_INSERT_POINT',()=>migration)
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const restore="select (select installation_state from public.installation_handoff_control where singleton_id=1), (select count(*) from public.centers where id='recurring_local_qa'), exists(select 1 from pg_attribute where attrelid=to_regclass('public.center_tuition_initial_import_baselines') and attname='source_overage_sessions' and not attisdropped);"
 const before=psql(restore);assert.equal(before.status,0,before.stderr)
 for(const [drift,error] of [
  ["alter function public.v2_4_list_package_cycle_state(text) set statement_timeout='1s';",'INITIAL_OVERAGE_PREIMAGE_DRIFT'],
  ['alter table public.center_tuition_initial_import_baselines add column source_overage_sessions integer;','INITIAL_OVERAGE_SCHEMA_DRIFT'],
 ]){
  const rejected=psql(recurringLocalQaSetup+'\n'+drift+'\n'+migration+'\nrollback;')
  assert.notEqual(rejected.status,0);assert(rejected.stderr.includes(error),rejected.stderr.slice(-1500))
  assert.equal(psql(restore).stdout,before.stdout,'Rejected migration transaction left no schema/fixtures')
 }
 const result=psql(r3cLocalQaSetup+'\nrollback;')
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout.slice(-1200))
 assert(result.stdout.includes('R3C_LOCAL_GUARDIAN_FREE_AND_EXACT25_OVER24_PASS'))
 const evidence=result.stdout.split('\n').filter(s=>s.startsWith('{')).map(s=>{try{return JSON.parse(s)}catch{return null}}).find(v=>v?.r3c_snapshot)
 assert(evidence?.post_functions.length===4)
 const out='artifacts/R3C/Tan-Binh/20261017/evidence';fs.mkdirSync(out,{recursive:true})
 fs.writeFileSync(out+'/local-native-snapshot.json',JSON.stringify(evidence,null,2)+'\n')
 const after=psql(restore);assert.equal(after.status,0,after.stderr);assert.equal(after.stdout,before.stdout)
 console.log('R3C_LOCAL_GUARDIAN_FREE_AND_EXACT25_OVER24_PASS; CREATE+EDIT canonical V2.2; explicit overage, scoped guards,5percent successor; no synthetic money/attendance; rollback restored local DB;production writes=0')
}
