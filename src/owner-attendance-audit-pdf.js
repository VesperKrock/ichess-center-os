import {auditBusinessDate,formatOwnerAuditTime,auditStatusLabel,getOwnerAuditRange,ownerAuditPeriodLabel} from './owner-attendance-audit.js'

const clean=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim()
// A searchable statement from complete, authorized batches; no canvas/image
// capture or second data source. Identity keys never enter document content.
export async function generateOwnerAuditPdf({groups,period,centerName,filters={}},{fetchImpl=globalThis.fetch,includeLayoutProof=false}={}){
  const range=getOwnerAuditRange(period)
  if(!Array.isArray(groups)||groups.some(g=>Date.parse(g.timestamp)<range.start||Date.parse(g.timestamp)>=range.end))throw Error('Audit PDF period mismatch')
  const base=import.meta.env?.BASE_URL||'/ichess-center-os/'
  const loadFont=async name=>{
    const response=await fetchImpl(`${base}forms/tuition-receipt/fonts/Tinos-${name}.ttf`)
    if(!response.ok)throw Error('Audit PDF font unavailable')
    return response.arrayBuffer()
  }
  const [{PDFDocument,rgb},{default:fontkit},regularBytes,boldBytes]=await Promise.all([
    import('pdf-lib'),import('@pdf-lib/fontkit'),loadFont('Regular'),loadFont('Bold'),
  ])
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit)
  const regular=await pdf.embedFont(regularBytes,{subset:true}),bold=await pdf.embedFont(boldBytes,{subset:true})
  pdf.setTitle(`Nhật ký thay đổi · ${ownerAuditPeriodLabel(period)} · ${clean(centerName)}`)
  pdf.setCreator('iChess')
  const W=595.28,H=841.89,M=36,bottom=H-44,ink=rgb(.10,.10,.10),quiet=rgb(.40,.40,.40)
  const trace=[],pages=[];let page,y,contentStart,activeGroup=null,lastMonth='',lastDay=''
  const draw=(value,x,top,size=11,font=regular,color=ink)=>{
    const width=font.widthOfTextAtSize(value,size)
    if(x+width>W-M+.1||top+size>bottom+.1)throw Error('Audit PDF text exceeds page')
    page.drawText(value,{x,y:H-top-size,size,font,color})
    if(includeLayoutProof)trace.push({page:pages.length,value,x,top,size,width})
  }
  const wrap=(value,width,size,font)=>{
    const lines=[];let line=''
    for(const word of clean(value).split(/\s+/)){
      const next=line?`${line} ${word}`:word
      if(font.widthOfTextAtSize(next,size)<=width){line=next;continue}
      if(line)lines.push(line);line=''
      for(const c of word){if(line&&font.widthOfTextAtSize(line+c,size)>width){lines.push(line);line=''}line+=c}
    }
    if(line)lines.push(line)
    return lines
  }
  const newPage=()=>{
    page=pdf.addPage([W,H]);pages.push(page);y=36
    for(const line of wrap(`iChess · ${clean(centerName)||'Cơ sở'}`,W-2*M,11,bold)){draw(line,M,y,11,bold);y+=15}
    draw('NHẬT KÝ THAY ĐỔI',M,y+7,19,bold);y+=34
    draw(`${ownerAuditPeriodLabel(period)} · Giờ Việt Nam (UTC+07:00)`,M,y,11);y+=22
    page.drawLine({start:{x:M,y:H-y},end:{x:W-M,y:H-y},thickness:.5,color:quiet});y+=14;contentStart=y
    if(activeGroup){
      for(const line of wrap(`${formatOwnerAuditTime(activeGroup.timestamp)} · ${activeGroup.actor} · tiếp`,W-2*M,11,bold)){draw(line,M,y,11,bold);y+=16}
      draw(`Đã sửa ${activeGroup.cells.length} ô điểm danh`,M,y,11,regular,quiet);y+=25
    }
  }
  const ensure=height=>{if(y+height>bottom)newPage()}
  const paragraph=(value,{indent=0,size=11,font=regular,color=ink,after=3}={})=>{
    for(const line of wrap(value,W-2*M-indent,size,font)){ensure(size+5);draw(line,M+indent,y,size,font,color);y+=size+5}
    y+=after
  }
  const height=(value,{indent=0,size=11,font=regular,after=3}={})=>wrap(value,W-2*M-indent,size,font).length*(size+5)+after
  const cellTitle=cell=>`${cell.student} · ${cell.date.split('-').reverse().join('/')}${cell.ca?` · ${cell.ca}`:''}`
  newPage()
  paragraph(`${groups.length} lượt lưu · ${groups.reduce((n,g)=>n+g.cells.length,0)} ô điểm danh đã thay đổi`,{color:quiet})
  if(filters.actorId&&filters.actorId!=='all'&&groups.length)paragraph(`Người thay đổi: ${groups[0].actor}`,{color:quiet})
  if(filters.query)paragraph(`Học viên: ${filters.query}`,{color:quiet})
  y+=8
  if(!groups.length)paragraph('Chưa có thay đổi nào được ghi nhận.')
  for(const group of groups){
    const day=auditBusinessDate(group.timestamp),month=day.slice(0,7)
    activeGroup=null
    const groupHeight=(period.scope==='year'&&month!==lastMonth?25:0)+(period.scope!=='day'&&day!==lastDay?23:0)
      +height(`${formatOwnerAuditTime(group.timestamp)} · ${group.actor}`,{font:bold})+height(`Đã sửa ${group.cells.length} ô điểm danh`,{after:6})+9
      +group.cells.reduce((sum,cell)=>sum+height(cellTitle(cell),{indent:14,font:bold})
        +height(`${auditStatusLabel(cell.before)} → ${auditStatusLabel(cell.after)}`,{indent:14})
        +(cell.reasonBefore!==cell.reasonAfter?height(`Lý do: ${cell.reasonBefore||'—'} → ${cell.reasonAfter||'—'}`,{indent:14}):0)+5,0)
    ensure(Math.min(groupHeight,bottom-contentStart))
    if(period.scope==='year'&&month!==lastMonth){paragraph(`THÁNG ${month.slice(5)}/${month.slice(0,4)}`,{size:14,font:bold,after:6});lastMonth=month}
    if(period.scope!=='day'&&day!==lastDay){paragraph(day.split('-').reverse().join('/'),{size:12,font:bold,after:6});lastDay=day}
    paragraph(`${formatOwnerAuditTime(group.timestamp)} · ${group.actor}`,{font:bold})
    paragraph(`Đã sửa ${group.cells.length} ô điểm danh`,{color:quiet,after:6})
    activeGroup=group
    for(const cell of group.cells){
      ensure(54)
      paragraph(cellTitle(cell),{indent:14,font:bold})
      paragraph(`${auditStatusLabel(cell.before)} → ${auditStatusLabel(cell.after)}`,{indent:14})
      if(cell.reasonBefore!==cell.reasonAfter)paragraph(`Lý do: ${cell.reasonBefore||'—'} → ${cell.reasonAfter||'—'}`,{indent:14})
      y+=5
    }
    activeGroup=null;y+=9
  }
  pages.forEach((p,index)=>p.drawText(`Trang ${index+1} / ${pages.length}`,{x:W-M-regular.widthOfTextAtSize(`Trang ${index+1} / ${pages.length}`,9),y:22,size:9,font:regular,color:quiet}))
  const bytes=await pdf.save(),suffix=period.scope==='day'?period.date:period.scope==='month'?period.date.slice(0,7):period.date.slice(0,4)
  return {bytes,blob:new Blob([bytes],{type:'application/pdf'}),fileName:`audit-${suffix}.pdf`,pageCount:pages.length,batchCount:groups.length,layoutProof:trace}
}
