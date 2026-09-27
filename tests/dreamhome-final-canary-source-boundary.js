import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
const phase = process.argv[2] || 'after'
assert(['before','after'].includes(phase))
const folder='artifacts/dreamhome-final-canary'
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${dir}/${entry.name}`):[`${dir}/${entry.name}`])
const files=walk('src').filter(file=>file!=='src/settings-v2-8p2-theme.css')
const hashes=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))
if(phase==='before'){
  assert(!fs.existsSync(`${folder}/source-before.json`),'Keep the source baseline')
  fs.writeFileSync(`${folder}/source-before.json`,JSON.stringify(hashes,null,2))
}else{
  assert.deepEqual(hashes,JSON.parse(fs.readFileSync(`${folder}/source-before.json`)), 'Only package Settings CSS may change')
  fs.writeFileSync(`${folder}/source-after.json`,JSON.stringify({passed:true,protectedFiles:files.length,onlySourceChange:'src/settings-v2-8p2-theme.css'},null,2))
}
console.log(`CANARY SOURCE ${phase}: ${files.length} files protected`)
