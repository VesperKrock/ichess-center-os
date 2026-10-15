import { unzipSync, strFromU8 } from 'fflate'

export async function excelSha256(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('')
}
const nodes = (root, name) => [...root.getElementsByTagNameNS('*', name)]
const xml = bytes => {
  const text = strFromU8(bytes)
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw Error('XML_DTD_NOT_SUPPORTED')
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (nodes(doc, 'parsererror').length) throw Error('INVALID_WORKBOOK_XML')
  return doc
}
const richText = node => nodes(node, 't').map(n => n.textContent).join('')
const column = address => [...address.match(/^[A-Z]+/)[0]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)
const resolvePart = (base, target) => {
  const parts = (target.startsWith('/') ? target.slice(1) : base + '/' + target).split('/'), result = []
  for (const p of parts) { if (p === '..') result.pop(); else if (p && p !== '.') result.push(p) }
  return result.join('/')
}
export async function readOriginalExcel(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > 10 * 1024 * 1024) throw Error('WORKBOOK_MAX_10_MB')
  let expanded = 0
  const files = unzipSync(new Uint8Array(buffer), { filter: entry => {
    expanded += entry.originalSize
    if (expanded > 64 * 1024 * 1024 || entry.originalSize > 16 * 1024 * 1024) throw Error('WORKBOOK_EXPANDED_TOO_LARGE')
    return /\.xml$|\.rels$/.test(entry.name)
  } })
  const doc = part => { if (!files[part]) throw Error('MISSING_WORKBOOK_PART'); return xml(files[part]) }
  const book = doc('xl/workbook.xml'), rels = nodes(doc('xl/_rels/workbook.xml.rels'), 'Relationship')
  const sheets = nodes(book, 'sheet')
  if (sheets.length !== 2 || sheets.some(s => s.getAttribute('state') === 'hidden')) throw Error('REQUIRES_ORIGINAL_TWO_TABS')
  const shared = files['xl/sharedStrings.xml'] ? nodes(doc('xl/sharedStrings.xml'), 'si').map(richText) : []
  const styles = files['xl/styles.xml'] ? doc('xl/styles.xml') : null
  const formats = new Map(styles ? nodes(styles, 'numFmt').map(n => [Number(n.getAttribute('numFmtId')), n.getAttribute('formatCode')]) : [])
  const styleIds = styles ? [...(nodes(styles, 'cellXfs')[0]?.children || [])].map(n => Number(n.getAttribute('numFmtId'))) : []
  const date1904 = ['1', 'true'].includes(nodes(book, 'workbookPr')[0]?.getAttribute('date1904'))
  const result = { sourceSha256: await excelSha256(buffer), sheets: [] }
  for (const s of sheets) {
    const id = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id')
    const rel = rels.find(r => r.getAttribute('Id') === id)
    if (!rel || rel.getAttribute('TargetMode') === 'External') throw Error('EXTERNAL_SHEET_NOT_SUPPORTED')
    const part = resolvePart('xl', rel.getAttribute('Target')), sheet = doc(part), rows = []
    for (const row of nodes(sheet, 'row')) {
      const cells = [], types = {}
      for (const c of [...row.children].filter(n => n.localName === 'c')) {
        const address = c.getAttribute('r'), col = column(address), type = c.getAttribute('t') || 'n'
        if (nodes(c, 'f').length) throw Error(`FORMULA_REQUIRES_VALUES:${address}`)
        const raw = nodes(c, 'v')[0]?.textContent || '', style = styleIds[Number(c.getAttribute('s') || 0)] || 0
        let value = type === 's' ? shared[Number(raw)] : type === 'inlineStr' ? richText(c) : raw
        if (type === 'd' && raw) value = new Date(raw).toISOString().slice(0, 10)
        if (type === 'e') throw Error(`EXCEL_CELL_ERROR:${address}`)
        const format = formats.get(style) || ''
        if (type === 'n' && raw && ((style >= 14 && style <= 17) || /[dy]/i.test(format.replace(/"[^"]*"/g, '')))) {
          const serial = Number(raw); value = new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) + serial * 86400000).toISOString().slice(0, 10)
        }
        cells[col - 1] = String(value ?? ''); types[col] = { type, style, raw, address }
      }
      rows.push({ number: Number(row.getAttribute('r')), cells, types, comments: {} })
    }
    const base = part.slice(0, part.lastIndexOf('/')), relationPart = base + '/_rels/' + part.split('/').at(-1) + '.rels'
    if (files[relationPart]) for (const link of nodes(doc(relationPart), 'Relationship').filter(n => n.getAttribute('Type')?.endsWith('/comments'))) {
      if (link.getAttribute('TargetMode') === 'External') continue
      for (const comment of nodes(doc(resolvePart(base, link.getAttribute('Target'))), 'comment')) {
        const address = comment.getAttribute('ref'), row = rows.find(r => r.number === Number(address.match(/\d+$/)[0]))
        if (row) row.comments[column(address)] = richText(comment)
      }
    }
    result.sheets.push({ name: s.getAttribute('name'), rows })
  }
  return result
}
