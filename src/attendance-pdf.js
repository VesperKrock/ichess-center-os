// Paper presentation only. The caller supplies the exact displayed A6 matrix;
// this module never reads, resolves, recounts or writes attendance/business data.
export const ATTENDANCE_PDF_SOURCE = 'A6_CANONICAL_ATTENDANCE_LEDGER'
export const ATTENDANCE_PDF_PAGE = Object.freeze({ width: 841.8898, height: 595.2756, margin: 24 })
const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
const shortDate = value => `${value.slice(8, 10)}/${value.slice(5, 7)}`
const fullDate = value => `${shortDate(value)}/${value.slice(0, 4)}`
const marks = Object.freeze({ present: '✓', absent: 'V', makeup: 'B', historicalTrial: 'T', unmarked: '?', today: '', future: '·', cancelled: '', notExpected: '—' })
const fontAssets = ['Tinos-Regular.ttf', 'Tinos-Bold.ttf', 'Tinos-Italic.ttf']
const fontsInFlight = new WeakMap()
const weekday = date => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(`${date}T12:00:00Z`).getUTCDay()]
const time = occurrence => occurrence.startTime ? `${occurrence.startTime}${occurrence.endTime ? `–${occurrence.endTime}` : ''}` : 'Chưa có giờ lịch sử'

export class AttendancePdfValidationError extends Error {
  constructor(message) { super(message); this.name = 'AttendancePdfValidationError' }
}

export function createAttendancePdfProjection(model, { centerName = '', capturedAt = new Date() } = {}) {
  if (!model?.columns?.length || !model?.rows?.length || model.filters?.error) {
    throw new AttendancePdfValidationError('Chọn bộ lọc có học viên và buổi học đã tải để xuất PDF.')
  }
  const columns = model.columns.map(column => ({ ...column, studentIds: [...column.studentIds] }))
  if (new Set(columns.map(column => column.key)).size !== columns.length) {
    throw new AttendancePdfValidationError('Buổi học trên bảng chưa hợp lệ. Vui lòng làm mới.')
  }
  const teachers = new Map(), slots = new Map()
  for (const column of columns) {
    // A name is part of the protected occurrence snapshot. A later rename of
    // the same teacher ID must not relabel the earlier columns on paper.
    const teacherKey = JSON.stringify([column.teacherId || '', column.teacherName || ''])
    if (!teachers.has(teacherKey)) teachers.set(teacherKey, { code: `GV${teachers.size + 1}`, name: clean(column.teacherName) || 'Chưa có giáo viên lịch sử' })
    column.teacherCode = teachers.get(teacherKey).code
    const slotKey = JSON.stringify([column.classSessionId || 'historical', column.startTime, column.endTime, column.room])
    if (!slots.has(slotKey)) slots.set(slotKey, { code: `C${slots.size + 1}`, days: new Set(), time: time(column), room: clean(column.room),
      ...(column.classSessionId ? {} : { unassigned: true }) })
    const slot = slots.get(slotKey)
    slot.days.add(weekday(column.date)); column.slotCode = slot.code
  }
  const rows = model.rows.map(row => {
    if (row.cells.length !== columns.length || row.cells.some((cell, index) => cell.occurrence.key !== columns[index].key || !Object.hasOwn(marks, cell.state))) {
      throw new AttendancePdfValidationError('Ô điểm danh không khớp buổi học trên bảng. Vui lòng làm mới.')
    }
    return { studentId: row.student.id, name: clean(row.student.fullName) || 'Học viên lịch sử', level: clean(row.student.level),
      cells: row.cells.map(cell => ({ key: cell.occurrence.key, state: cell.state, mark: model.monthlyProjection && cell.state === 'future' ? '' : marks[cell.state],
        originalDate: cell.originalDate || '', originalOccurrence: cell.originalOccurrence ? { ...cell.originalOccurrence } : null })) }
  })
  const slotList = [...slots.values()].map(slot => ({ ...slot,
    label: `${slot.unassigned ? 'Chưa xác định ca · ' : ''}${[...slot.days].sort((a, b) => ['T2','T3','T4','T5','T6','T7','CN'].indexOf(a) - ['T2','T3','T4','T5','T6','T7','CN'].indexOf(b)).join('–')} · ${slot.time}${slot.room ? ` · ${slot.room}` : ''}`,
  }))
  for (const [index, column] of columns.entries()) {
    column.cancelled = column.lifecycleState === 'CANCELLED'
    column.future = !column.cancelled && rows.some(row => row.cells[index].state === 'future')
  }
  return { source: ATTENDANCE_PDF_SOURCE, centerName: clean(centerName) || 'Cơ sở hiện tại',
    capturedAt: new Date(capturedAt).toISOString(), filters: { ...model.filters }, columns, rows,
    teachers: [...teachers.values()], slots: slotList, showLevel: rows.some(row => row.level),
    showTeacherCodes: teachers.size > 1 || columns.some(column => column.isSubstitute), showSlotCodes: slots.size > 1 }
}

export function createAttendancePdfSections(projection) {
  if (projection.filters.classSessionId !== 'all') return [projection]
  // Slice the already-filtered matrix by its canonical slot context. Neither
  // Student level nor the current class roster supplies paper membership.
  // Missing historical slot context stays explicitly unassigned; occurrence
  // IDs remain separate columns and do not invent dozens of teaching slots.
  return projection.slots.map(slot => {
    const indices = projection.columns.flatMap((column, index) => column.slotCode === slot.code ? [index] : [])
    const columns = indices.map(index => projection.columns[index])
    const studentIds = new Set(columns.flatMap(column => column.studentIds))
    const rows = projection.rows.filter(row => studentIds.has(row.studentId))
      .map(row => ({ ...row, cells: indices.map(index => row.cells[index]) }))
    const teachers = projection.teachers.filter(teacher => columns.some(column => column.teacherCode === teacher.code))
    return { ...projection, columns, rows, teachers, slots: [slot], showSlotCodes: false,
      showLevel: rows.some(row => row.level),
      showTeacherCodes: teachers.length > 1 || columns.some(column => column.isSubstitute) }
  }).filter(section => section.rows.length)
}

function wrap(value, width, measure, size = 9, style = 'regular') {
  const lines = [], words = clean(value).split(' ')
  let line = ''
  for (const word of words) {
    if (measure(`${line}${line ? ' ' : ''}${word}`, size, style) <= width) { line += `${line ? ' ' : ''}${word}`; continue }
    if (line) { lines.push(line); line = '' }
    for (const character of word) {
      if (line && measure(line + character, size, style) > width) { lines.push(line); line = '' }
      line += character
    }
  }
  if (line) lines.push(line)
  return lines
}

function pageNotes(projection, rows, start, end) {
  const columns = projection.columns.slice(start, end), notes = []
  if (projection.showSlotCodes) for (const slot of projection.slots.filter(slot => columns.some(column => column.slotCode === slot.code))) notes.push(`Ca ${slot.code}: ${slot.label}.`)
  if (projection.showTeacherCodes) notes.push(`Giáo viên: ${projection.teachers.filter(teacher => columns.some(column => column.teacherCode === teacher.code))
    .map(teacher => `${teacher.code} = ${teacher.name}`).join('; ')}.`)
  for (const column of columns.filter(column => column.isSubstitute)) notes.push(`Dạy thay (*): ${fullDate(column.date)} ${time(column)} · ${column.teacherName || 'Chưa có tên giáo viên'}${projection.showSlotCodes ? ` · Ca ${column.slotCode}` : ''}.`)
  for (const row of rows) for (let index = start; index < end; index++) {
    const cell = row.cells[index], column = projection.columns[index], original = cell.originalOccurrence
    if (cell.state === 'makeup') notes.push(`Học bù: ${row.name} · ${fullDate(column.date)} ${column.startTime || 'chưa có giờ'} bù cho buổi vắng ${cell.originalDate ? fullDate(cell.originalDate) : 'chưa tải được ngày gốc'}${original?.startTime ? ` ${original.startTime}` : ''}${original?.teacherName ? ` (${original.teacherName})` : ''}.`)
  }
  if (columns.some(column => column.partialHistoricalRoster)) notes.push('Một số buổi cũ chỉ có danh sách học viên đã được ghi nhận trong lịch sử.')
  if (projection.filters.query) notes.push(`Lọc học viên: ${clean(projection.filters.query)}.`)
  return notes
}

export function planAttendancePdfPages(projection, measure) {
  const usable = ATTENDANCE_PDF_PAGE.width - 48, nameWidth = 190, levelWidth = projection.showLevel ? 56 : 0
  const identityWidth = 24 + nameWidth + levelWidth, maxColumns = Math.floor((usable - identityWidth) / 32)
  // Footer text begins 26pt above the page bottom. Keep another 10pt clear;
  // all measured row/legend/note geometry may use the space above that line.
  const contentBottom = ATTENDANCE_PDF_PAGE.height - ATTENDANCE_PDF_PAGE.margin - 12
  const pages = []
  const slotHeading = projection.showSlotCodes ? 'Ca học: Nhiều ca · xem mã ca theo cột' : `Ca học: ${projection.slots[0].label}`
  const teacherHeading = projection.showTeacherCodes ? 'Giáo viên theo buổi: xem mã GV; * là dạy thay' : `Giáo viên: ${projection.teachers[0].name}`
  const headingLines = wrap(slotHeading, usable - 140, measure, 10.5, 'bold')
  const teacherLines = wrap(teacherHeading, usable, measure, 9.5)
  const tableTop = 67 + headingLines.length * 12 + teacherLines.length * 11
  const rowSize = projection.rows.length <= 14 ? 26 : 22
  const windowCount = Math.ceil(projection.columns.length / maxColumns)
  let columnStart = 0
  for (let window = 0; window < windowCount; window++) {
    // Balance genuinely wide sheets so their last window is not one column.
    const columnEnd = columnStart + Math.ceil((projection.columns.length - columnStart) / (windowCount - window))
    const columns = projection.columns.slice(columnStart, columnEnd)
    const columnWidth = Math.min(96, (usable - identityWidth) / columns.length), width = identityWidth + columnWidth * columns.length
    const columnHeaders = columns.map(column => [
      { value: shortDate(column.date), size: 9.5, style: 'bold' }, { value: column.startTime || '—', size: 8.5, style: 'regular', quiet: true },
      ...(projection.showSlotCodes ? [{ value: column.slotCode, size: 8, style: 'regular' }] : []),
      ...(projection.showTeacherCodes ? [{ value: `${column.teacherCode}${column.isSubstitute ? '*' : ''}`, size: 8, style: 'italic' }] : []),
      ...(column.cancelled ? [{ value: 'Đã hủy', size: 8, style: 'bold', quiet: true }]
        : column.future ? [{ value: 'Chưa diễn ra', size: 7.5, style: 'italic', quiet: true }] : []),
    ].flatMap(item => wrap(item.value, columnWidth - 4, measure, item.size, item.style).map(value => ({ ...item, value }))))
    const headerHeight = Math.max(32, ...columnHeaders.map(lines => 8 + lines.reduce((height, line) => height + line.size + 3, 0)))
    const legend = ['Có mặt · V Vắng · B Học bù · ? Chưa điểm danh · · Chưa diễn ra',
      ...(projection.rows.some(row => row.cells.slice(columnStart,columnEnd).some(cell => cell.state === 'historicalTrial'))
        ? ['T Học thử (lịch sử).'] : []),
      ...(columns.some(column => column.cancelled) ? ['Cột gạch chéo: Đã hủy.'] : []),
      ...(projection.rows.some(row => row.cells.slice(columnStart,columnEnd).some(cell => cell.state === 'notExpected')) ? ['— Không thuộc danh sách buổi học.'] : []),
    ].flatMap(line => wrap(line, width - 12, measure, 9))
    const metrics = projection.rows.map(row => {
      const names = wrap(row.name, nameWidth - 12, measure, 10.5)
      const levels = projection.showLevel ? wrap(row.level || '—', levelWidth - 8, measure, 9.5) : []
      return { names, levels, height: Math.max(rowSize, names.length * 12 + 6, levels.length * 11 + 6) }
    })
    const range = (start, end) => {
      const selected = metrics.slice(start, end)
      const bottom = tableTop + headerHeight + selected.reduce((height, row) => height + row.height, 0)
      const noteTop = bottom + 12 + legend.length * 11
      const notes = pageNotes(projection, projection.rows.slice(start, end), columnStart, columnEnd)
        .flatMap(note => wrap(note, width, measure, 9))
      const legendBottom = bottom + 7 + legend.length * 11
      const requiredBottom = notes.length ? noteTop + 4 + notes.length * 11 : legendBottom
      return { bottom, noteTop, notes, legendBottom, fits: requiredBottom <= contentBottom,
        nameLines: selected.map(row => row.names), levelLines: selected.map(row => row.levels), rowHeights: selected.map(row => row.height) }
    }
    const ranges = []
    let rowStart = 0
    while (rowStart < projection.rows.length) {
      let rowEnd = rowStart + 1
      if (range(rowStart, rowEnd).legendBottom > contentBottom) throw new AttendancePdfValidationError('Tên hoặc thông tin ca học quá dài để in trọn vẹn trên A4.')
      while (rowEnd < projection.rows.length && range(rowStart, rowEnd + 1).fits) rowEnd++
      ranges.push({ start: rowStart, end: rowEnd }); rowStart = rowEnd
    }
    // If more than one page is necessary, rebalance whole rows within their
    // measured geometry instead of leaving a mostly-empty last roster page.
    for (let index = ranges.length - 1; index > 0; index--) {
      const previous = ranges[index - 1], current = ranges[index]
      if (previous.end - previous.start <= current.end - current.start + 1) continue
      for (let boundary = previous.start + Math.floor((current.end - previous.start) / 2); boundary < previous.end; boundary++) {
        if (range(previous.start, boundary).fits && range(boundary, current.end).fits) {
          previous.end = boundary; current.start = boundary; break
        }
      }
    }
    for (const { start: rowStart, end: rowEnd } of ranges) {
      const { bottom, noteTop, notes, nameLines, levelLines, rowHeights } = range(rowStart, rowEnd)
      const noteCount = Math.max(0, Math.floor((contentBottom - noteTop - 4) / 11)), visibleNotes = notes.slice(0, noteCount)
      pages.push({ kind: 'matrix', columnStart, columnEnd, rowStart, rowEnd, width, columnWidth, nameWidth, levelWidth, identityWidth,
        tableTop, headerHeight, columnHeaders, headingLines, teacherLines, nameLines, levelLines, rowHeights, bottom, legend, noteTop, notes: visibleNotes })
      const remaining = notes.slice(noteCount)
      const notesPerPage = Math.max(1, Math.floor((contentBottom - tableTop - 34 - 3) / 11) + 1)
      for (let start = 0; start < remaining.length; start += notesPerPage) pages.push({ kind: 'notes', columnStart, columnEnd, rowStart, rowEnd,
        headingLines, teacherLines, tableTop, notes: remaining.slice(start, start + notesPerPage) })
    }
    columnStart = columnEnd
  }
  return pages
}

export async function generateAttendancePdf(model, metadata = {}, options = {}) {
  // Capture immediately, before loading assets. Later refreshes cannot alter this export.
  const projection = createAttendancePdfProjection(model, metadata)
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const base = String(options.baseUrl ?? import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/')
  const load = async path => {
    const response = await fetchImpl(`${base}${path}`)
    if (!response.ok) throw new Error('Không tải được phông hoặc logo điểm danh. Vui lòng thử lại.')
    return new Uint8Array(await response.arrayBuffer())
  }
  let fontLoad = fontsInFlight.get(fetchImpl)
  if (fontLoad?.base !== base) {
    fontLoad = { base, promise: Promise.all(fontAssets.map(name => load(`forms/tuition-receipt/fonts/${name}`))) }
    fontsInFlight.set(fetchImpl, fontLoad)
    fontLoad.promise.catch(() => { if (fontsInFlight.get(fetchImpl) === fontLoad) fontsInFlight.delete(fetchImpl) })
  }
  const [fontBytes, logoBytes, { PDFDocument, rgb }, { default: fontkit }] = await Promise.all([
    fontLoad.promise, load('forms/attendance/ichess-logo.png'), import('pdf-lib'), import('@pdf-lib/fontkit'),
  ])
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const fonts = Object.fromEntries(await Promise.all(['regular','bold','italic'].map(async (style,index) => [style,await document.embedFont(fontBytes[index],{subset:true})])))
  const measure = (value,size,style='regular') => fonts[style].widthOfTextAtSize(value,size)
  const sections = createAttendancePdfSections(projection)
  const pages = sections.flatMap((section, sectionIndex) => planAttendancePdfPages(section, measure).map(plan => ({ ...plan, sectionIndex })))
  const logo = await document.embedPng(logoBytes)
  const {width:W,height:H}=ATTENDANCE_PDF_PAGE, ink=rgb(0.08,0.08,0.08), quiet=rgb(0.40,0.40,0.40), rule=rgb(0.65,0.65,0.65)
  const trace=[]
  for (const [pageIndex, plan] of pages.entries()) {
    const projection = sections[plan.sectionIndex]
    const page=document.addPage([W,H])
    const line=(x1,top1,x2,top2,color=rule,thickness=0.4)=>page.drawLine({start:{x:x1,y:H-top1},end:{x:x2,y:H-top2},color,thickness})
    const rect=(x,top,width,height,color)=>page.drawRectangle({x,y:H-top-height,width,height,color})
    const text=(value,x,baseline,size=9,style='regular',color=ink,align='left')=>{
      const width=measure(value,size,style), left=x-(align==='right'?width:align==='center'?width/2:0)
      if(left<23||left+width>W-23||baseline-size<10||baseline>H-16)throw new AttendancePdfValidationError('Nội dung vượt vùng in A4. Vui lòng kiểm tra thông tin.')
      page.drawText(value,{x:left,y:H-baseline,size,font:fonts[style],color})
      if(options.includeLayoutProof)trace.push({page:pageIndex+1,value,x:left,baseline,size,width})
    }
    const check=(x,cy,color=ink)=>{line(x-3,cy,x-0.5,cy+2.5,color,1.0);line(x-0.5,cy+2.5,x+4,cy-3,color,1.0)}
    page.drawImage(logo,{x:24,y:H-48,width:68,height:68*logo.height/logo.width})
    text('BẢNG ĐIỂM DANH',104,30,17,'bold')
    const centerLines=wrap(`iChess · Cơ sở ${projection.centerName}`,260,measure,10.5,'bold')
    centerLines.slice(0,2).forEach((value,index)=>text(value,W-24,24+index*12,10.5,'bold',ink,'right'))
    if(centerLines.length>2)throw new AttendancePdfValidationError('Tên cơ sở quá dài để in trọn vẹn trên A4.')
    text(`Thời gian: ${fullDate(projection.filters.fromDate)} – ${fullDate(projection.filters.toDate)}`,W-24,51,9.5,'regular',ink,'right')
    plan.headingLines.forEach((value,index)=>text(value,24,62+index*12,10.5,'bold'))
    text(`${projection.rows.length} học viên · ${projection.columns.length} buổi`,W-24,62,9.5,'regular',ink,'right')
    plan.teacherLines.forEach((value,index)=>text(value,24,62+plan.headingLines.length*12+index*11,9.5,'regular',quiet))
    if(plan.kind==='notes'){
      text('Ghi chú buổi học (tiếp)',24,plan.tableTop+15,11,'bold')
      plan.notes.forEach((value,index)=>text(value,24,plan.tableTop+34+index*11,9))
    }else{
      const x=24,y=plan.tableTop,headerBottom=y+plan.headerHeight,columns=projection.columns.slice(plan.columnStart,plan.columnEnd)
      rect(x,y,plan.width,plan.headerHeight,rgb(0.955,0.955,0.955))
      const bodyHeight=plan.bottom-headerBottom
      for(const [index,column]of columns.entries()){
        const left=x+plan.identityWidth+index*plan.columnWidth
        if(column.cancelled){
          rect(left,headerBottom,plan.columnWidth,bodyHeight,rgb(0.985,0.985,0.985))
          // One clipped hatch across the occurrence column; no per-cell "Hủy".
          for(let offset=-bodyHeight;offset<plan.columnWidth;offset+=8){
            const low=Math.max(0,-offset),high=Math.min(bodyHeight,plan.columnWidth-offset)
            if(high>low)line(left+offset+low,plan.bottom-low,left+offset+high,plan.bottom-high,rgb(0.82,0.82,0.82),0.35)
          }
        }else if(column.future)rect(left,headerBottom,plan.columnWidth,bodyHeight,rgb(0.985,0.985,0.985))
        let baseline=y+15
        for(const item of plan.columnHeaders[index]){text(item.value,left+plan.columnWidth/2,baseline,item.size,item.style,item.quiet?quiet:ink,'center');baseline+=item.size+3}
      }
      text('STT',x+12,y+plan.headerHeight/2+3,9,'bold',ink,'center')
      text('Học viên',x+30,y+plan.headerHeight/2+3,10.5,'bold')
      if(projection.showLevel)text('Cấp độ',x+24+plan.nameWidth+plan.levelWidth/2,y+plan.headerHeight/2+3,9.5,'bold',ink,'center')
      let top=headerBottom
      for(let index=plan.rowStart;index<plan.rowEnd;index++){
        const local=index-plan.rowStart,row=projection.rows[index],height=plan.rowHeights[local],cy=top+height/2
        text(String(index+1),x+12,cy+3,9.5,'regular',quiet,'center')
        plan.nameLines[local].forEach((value,lineIndex)=>text(value,x+30,cy-(plan.nameLines[local].length-1)*6+lineIndex*12+3,10.5))
        if(projection.showLevel)plan.levelLines[local].forEach((value,lineIndex)=>text(value,x+24+plan.nameWidth+4,cy-(plan.levelLines[local].length-1)*5.5+lineIndex*11+3,9.5,'regular',quiet))
        for(let col=plan.columnStart;col<plan.columnEnd;col++){
          const cell=row.cells[col],cx=x+plan.identityWidth+(col-plan.columnStart+0.5)*plan.columnWidth
          if(cell.state==='present')check(cx,cy)
          else if(cell.mark)text(cell.mark,cx,cy+3,cell.state==='future'?9:10.5,['absent','makeup'].includes(cell.state)?'bold':'regular',['future','notExpected','unmarked'].includes(cell.state)?quiet:ink,'center')
        }
        top+=height;line(x,top,x+plan.width,top)
      }
      const borders=[x,x+24,x+24+plan.nameWidth,...(projection.showLevel?[x+plan.identityWidth]:[]),...columns.map((_,index)=>x+plan.identityWidth+(index+1)*plan.columnWidth)]
      for(const left of borders)line(left,y,left,plan.bottom)
      line(x,y,x+plan.width,y,quiet,0.65);line(x,headerBottom,x+plan.width,headerBottom,quiet,0.65)
      plan.legend.forEach((value,index)=>{if(index===0)check(x+4,plan.bottom+12);text(value,x+(index===0?12:0),plan.bottom+15+index*11,9,'regular',quiet)})
      plan.notes.forEach((value,index)=>text(value,x,plan.noteTop+12+index*11,9))
      const after=plan.noteTop+12+plan.notes.length*11
      if(after+40<=H-ATTENDANCE_PDF_PAGE.margin-12){text('Ghi chú:',x,after+17,9.5,'italic',quiet);line(x+49,after+22,x+plan.width,after+22);line(x+49,after+40,x+plan.width,after+40)}
    }
    const stamp=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(projection.capturedAt))
    text(`Xuất từ Bảng điểm danh · ${stamp}`,24,H-18,8,'regular',quiet)
    text(`Trang ${pageIndex+1}/${pages.length}`,W-24,H-18,8,'regular',quiet,'right')
  }
  document.setTitle(`Bảng điểm danh · ${projection.centerName}`)
  document.setAuthor('iChess');document.setSubject('Bảng điểm danh A6 · Chỉ xem')
  const bytes=await document.save()
  const filenamePart=projection.centerName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'')
  return {blob:new Blob([bytes],{type:'application/pdf'}),fileName:`attendance-${filenamePart}-${projection.filters.fromDate}-${projection.filters.toDate}.pdf`,
    source:ATTENDANCE_PDF_SOURCE,pageCount:pages.length,pageSize:ATTENDANCE_PDF_PAGE,projection,sections,
    pages:pages.map(plan=>({kind:plan.kind,sectionIndex:plan.sectionIndex,rowStart:plan.rowStart,rowEnd:plan.rowEnd,columnStart:plan.columnStart,columnEnd:plan.columnEnd,columnWidth:plan.columnWidth})),
    ...(options.includeLayoutProof?{textRegions:trace}:{})}
}
