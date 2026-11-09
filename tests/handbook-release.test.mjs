import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {parseArticle, renderMarkdown, searchArticles} from '../src/handbook/content.js'
import {getProductionLauncherModules} from '../src/modules.js'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const folder='content/handbook/articles'
const articles=fs.readdirSync(folder).filter(f=>f.endsWith('.md')).map(f=>parseArticle(fs.readFileSync(path.join(folder,f),'utf8'),f)).sort((a,b)=>a.order-b.order)
const guidance=read('content/handbook/guidance.json'),chapters=read('content/handbook/chapters.json'),search=read('src/handbook/search-config.json')

test('V1 publishes 41 articles and 9 existing modules, without internal evidence',()=>{
  assert.equal(articles.length,41);assert.equal(new Set(articles.map(a=>a.id)).size,41)
  assert.deepEqual(Object.keys(chapters.chapters).sort(),getProductionLauncherModules().map(m=>m.id).sort())
  assert.equal(Object.keys(chapters.chapters).length,9)
  for(const a of articles){
    assert.equal(a.status,'EDITORIAL_PENDING',a.id)
    for(const key of ['verification','reviewEvidence','editorialRevision','approval'])assert(!Object.hasOwn(a,key),a.id+' '+key)
    assert.doesNotMatch(a.raw,/artifacts\/|supabase\/|HOLD_VERIFICATION|\bRPC\b|\bfixture\b|\bbackend\b/i,a.id)
    for(const section of ['Mục đích','Trước khi bắt đầu','Các bước thực hiện','Kết quả mong đợi','Lỗi thường gặp','Bài liên quan'])assert(a.body.includes('## '+section),a.id)
    assert(guidance[a.id]);assert(a.modules.every(m=>chapters.chapters[m]));assert(a.related.every(id=>articles.some(x=>x.id===id)))
  }
})
test('Article links, illustrations, safe Markdown and common search paths remain usable',()=>{
  const images=new Set()
  for(const a of articles){
    for(const m of a.body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
      assert(fs.existsSync(path.resolve(folder,m[1])),a.id+' '+m[1])
      if(m[1].endsWith('.png'))images.add(m[1])
    }
    const {html,headings}=renderMarkdown(a.body,'/ichess-center-os/');assert(headings.length>=6);assert.doesNotMatch(html,/<script|onerror=|javascript:/i)
  }
  assert.equal(images.size,42)
  for(const [query,id] of [['Làm sao thêm học viên?','HV-001'],['lam sao them hoc vien','HV-001'],['Gán gói học phí ở đâu?','HP-001'],['HP-002','HP-002']])assert.equal(searchArticles(articles,query,search)[0]?.id,id,query)
  assert.equal(searchArticles(articles,'cờ vua trên sao Hỏa zzq',search).length,0)
})
test('Publication removes generic editorial labels while preserving high-risk limitations',()=>{
  const view=fs.readFileSync('src/handbook/view.js','utf8')
  assert(view.includes('Sổ tay iChess V1'))
  assert.doesNotMatch(view,/Bản nháp|Chờ biên tập|Bằng chứng xác minh kỹ thuật|article\.raw|article\.verification/)
  assert(view.includes('Giới hạn của hướng dẫn'))
  for(const id of ['DD-003','KH-004','KO-004','TC-005','HP-004','HP-006']){
    assert.equal(guidance[id].mode,'REFERENCE_ONLY',id);assert(guidance[id].held.length>0,id)
    assert.match(articles.find(a=>a.id===id).body,/chưa có hướng dẫn vận hành được duyệt/i,id)
    assert.match(articles.find(a=>a.id===id).body,/không (?:thực hiện|xác nhận|chọn|đặt|hủy|lưu)/i,id)
  }
})
test('Public reader imports only document UI; existing Taskbar uses the same renderer',()=>{
  const entry=fs.readFileSync('src/handbook/standalone.js','utf8'),main=fs.readFileSync('src/main.js','utf8'),html=fs.readFileSync('handbook/index.html','utf8')
  assert.doesNotMatch(entry,/supabase|fetch\(|XMLHttpRequest|initializeSupabaseAuth/)
  assert(entry.includes('renderHandbook'));assert(main.includes("windowItem.type === 'handbook'"));assert(main.includes('data-action="open-handbook"'))
  assert(html.includes("connect-src 'none'"))
  assert.doesNotMatch(fs.readFileSync('src/handbook/catalog.js','utf8'),/docs\/handbook/)
})
