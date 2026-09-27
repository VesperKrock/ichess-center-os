import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${dir}/${entry.name}`):[`${dir}/${entry.name}`])
const files=[...walk('src').filter(p=>/\.(js|css|html|json|svg|md)$/.test(p)),...walk('tests').filter(p=>p.includes('dreamhome-final-canary')),'artifacts/dreamhome-final-canary/README.md']
const pattern=/\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E1\u00BB[\u0080-\u00BF]|\u00E1\u00BA[\u0080-\u00BF]|\u00C6[\u0080-\u00BF]|\u00E2[\u0080-\u00BF]/u
const failures=[]
const existingFindings=[]
const baseline=JSON.parse(fs.readFileSync('artifacts/dreamhome-final-canary/source-before.json','utf8'))
for(const file of files){
  if(!fs.existsSync(file))continue
  let content
  try{content=new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(file))}catch{failures.push(`${file}: invalid UTF-8`);continue}
  if(pattern.test(content)){
    const hash=createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    if(baseline[file]===hash){
      existingFindings.push({file,unchangedFromTaskStart:true,lines:content.split(/\r?\n/).map((line,i)=>pattern.test(line)?i+1:null).filter(Boolean)})
    }else failures.push(file)
  }
}
assert.deepEqual(failures,[],'UTF-8/mojibake scan')
fs.writeFileSync('artifacts/dreamhome-final-canary/encoding-check.json',JSON.stringify({passed:true,noIntroducedMojibake:true,filesChecked:files.filter(f=>fs.existsSync(f)).length,scope:'All text src files, this task’s QA scripts and report',existingFindings},null,2))
console.log(JSON.stringify({result:'PASS: no introduced mojibake',files:files.filter(f=>fs.existsSync(f)).length,existingFindings}))
