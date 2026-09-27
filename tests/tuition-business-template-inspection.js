import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const pdfjsPath = process.env.TBHP_PDFJS_PATH
if (!pdfjsPath) throw new Error('Set TBHP_PDFJS_PATH to the local pdfjs-dist legacy/build/pdf.mjs path.')

const pdfjs = await import(pathToFileURL(pdfjsPath).href)
const bytes = new Uint8Array(fs.readFileSync(process.env.TBHP_INSPECT_PDF
  || 'public/forms/tuition-notice/tuition-notice-template.pdf'))
const pdf = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise
const page = await pdf.getPage(Number(process.env.TBHP_INSPECT_PAGE || 1))
console.log('PAGE_VIEW', page.view)
const content = await page.getTextContent()
for (const item of content.items) {
  if (!item.str?.trim()) continue
  console.log(Math.round(item.transform[4]), Math.round(page.view[3] - item.transform[5]), JSON.stringify(item.str))
}

if (process.env.TBHP_RENDER_TO) {
  const canvasModule = await import(pathToFileURL(process.env.TBHP_CANVAS_PATH).href)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  fs.writeFileSync(process.env.TBHP_RENDER_TO, canvas.toBuffer('image/png'))
}
