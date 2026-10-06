// Read-only OOXML table export of the same canonical monthly matrix as PDF.
// Inline strings keep names/notes literal; this workbook contains no formulas.
const xml = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char])
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
const dateLabel = date => `${date.slice(8, 10)}/${date.slice(5, 7)}`
const year = student => {
  const value = String(student.birthYear || student.birthDate || student.dateOfBirth || '')
  return /^\d{4}(?:-|$)/.test(value) ? Number(value.slice(0, 4)) : '—'
}
const safeFilename = value => String(value || 'co-so').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)

export function createAttendanceXlsxProjection(model, { centerName = '', classLabel = 'Tất cả ca học',
  teacherLabel = 'Tất cả giáo viên', mainTeacher = 'Chưa rõ' } = {}) {
  if (!model?.columns?.length || !model?.rows?.length || model.filters?.error) {
    throw new Error('Chưa có bảng điểm danh để xuất Excel.')
  }
  const month = model.filters.fromDate.slice(0, 7)
  const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  const headers = ['STT', 'Họ và tên', 'Năm sinh', 'Gói/Buổi', 'Level', ...model.columns.map(column =>
    `${weekdays[new Date(`${column.date}T12:00:00Z`).getUTCDay()]} ${dateLabel(column.date)}\n${column.startTime || '—'}\n${column.classLabel || 'Ca học'}`),
  'Tiến độ', 'Còn lại']
  const rows = model.rows.map((row, index) => [index + 1, row.student.fullName || 'Học viên', year(row.student),
    row.tuition.hasKnownPackage ? `${row.tuition.totalSessions} buổi` : '—', typeof row.student.level === 'string' ? row.student.level : '—',
    ...row.cells.map(cell => ['future', 'today'].includes(cell.state) ? '' : String(cell.mark ?? '')),
    row.tuition.hasKnownPackage ? `${row.tuition.usedSessions}/${row.tuition.totalSessions}` : '—',
    row.tuition.hasKnownPackage ? row.tuition.remainingSessions : '—'])
  if (rows.some(row => row.length !== headers.length)) throw new Error('Bảng điểm danh chưa tải đầy đủ. Vui lòng làm mới.')
  return { sheetName: 'Điểm danh tháng', month, headers, rows,
    context: [['Bảng điểm danh', centerName], [`Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`, `Ca học: ${classLabel}`],
      [`Giáo viên: ${teacherLabel}`, `Giáo viên chính: ${mainTeacher}`], ['Lọc học viên', model.filters.query || 'Tất cả học viên']],
    filename: `bang-diem-danh-${month}-${safeFilename(centerName)}.xlsx` }
}

const encoder = new TextEncoder()
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
const crc32 = bytes => {
  let value = 0xffffffff
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}
const concat = parts => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0))
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return result
}
// ZIP STORE: no compression dependency, timestamps or mutable document state.
function zip(files) {
  const local = [], directory = []
  let offset = 0
  for (const [name, contents] of Object.entries(files)) {
    const filename = encoder.encode(name), data = encoder.encode(contents), checksum = crc32(data)
    const header = new Uint8Array(30), h = new DataView(header.buffer)
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true)
    h.setUint16(12, 0x21, true) // 1980-01-01, valid DOS date
    h.setUint32(14, checksum, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true)
    h.setUint16(26, filename.length, true)
    const entry = new Uint8Array(46), e = new DataView(entry.buffer)
    e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint16(8, 0x800, true)
    e.setUint16(14, 0x21, true); e.setUint32(16, checksum, true)
    e.setUint32(20, data.length, true); e.setUint32(24, data.length, true)
    e.setUint16(28, filename.length, true); e.setUint32(42, offset, true)
    local.push(header, filename, data); directory.push(entry, filename)
    offset += header.length + filename.length + data.length
  }
  const central = concat(directory), end = new Uint8Array(22), view = new DataView(end.buffer)
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, Object.keys(files).length, true)
  view.setUint16(10, Object.keys(files).length, true); view.setUint32(12, central.length, true); view.setUint32(16, offset, true)
  return concat([...local, central, end])
}
const columnName = index => {
  let result = ''
  for (index++; index > 0; index = Math.floor((index - 1) / 26)) result = String.fromCharCode(65 + (index - 1) % 26) + result
  return result
}
const prefix = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

export function generateAttendanceXlsx(model, context = {}) {
  const projection = createAttendanceXlsxProjection(model, context)
  const grid = [...projection.context, projection.headers, ...projection.rows]
  const last = `${columnName(projection.headers.length - 1)}${grid.length}`
  const sheet = prefix + `<worksheet xmlns="${ns}"><dimension ref="A1:${last}"/>
    <sheetViews><sheetView workbookViewId="0"><pane xSplit="5" ySplit="5" topLeftCell="F6" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="F6" sqref="F6"/></sheetView></sheetViews>
    <sheetFormatPr defaultRowHeight="22"/><cols>${projection.headers.map((_, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${[6, 32, 12, 14, 15][i] || (i >= projection.headers.length - 2 ? 12 : 18)}" customWidth="1"/>`).join('')}</cols>
    <sheetData>${grid.map((row, r) => `<row r="${r + 1}"${r === 4 ? ' ht="56" customHeight="1"' : ''}>${row.map((value, c) => {
      const ref = `${columnName(c)}${r + 1}`, style = r === 4 ? 1 : r < 4 ? 2 : c === 1 ? 0 : 3
      return typeof value === 'number' && Number.isFinite(value)
        ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
        : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
    }).join('')}</row>`).join('')}</sheetData><autoFilter ref="A5:${last}"/>
    <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
    <pageSetup orientation="landscape" paperSize="9"/></worksheet>`
  const styles = prefix + `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
    <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF6"/><bgColor indexed="64"/></patternFill></fill></fills>
    <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  const bytes = zip({
    '[Content_Types].xml': prefix + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': prefix + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': prefix + `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="${xml(projection.sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': prefix + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet,
    'xl/styles.xml': styles,
  })
  return { bytes, filename: projection.filename, projection,
    blob: new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }
}
