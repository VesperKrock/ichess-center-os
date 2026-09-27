import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const { createCanvas, loadImage } = await import(pathToFileURL(process.env.TBHP_CANVAS_PATH).href)
const jsQrModule = await import(pathToFileURL(process.env.TBHP_JSQR_PATH).href)
const jsQR = jsQrModule.default || jsQrModule
const png = fs.readFileSync('public/assets/payment/ichess-company-tuition-qr.png')
const qr = await loadImage(png)
assert(qr.width >= 300 && qr.height >= 300)
assert(Math.abs(qr.width - qr.height) <= 2)
const canvas = createCanvas(qr.width + 40, qr.height + 40)
const context = canvas.getContext('2d')
context.fillStyle = '#ffffff'
context.fillRect(0, 0, canvas.width, canvas.height)
context.drawImage(qr, 20, 20)
const image = context.getImageData(0, 0, canvas.width, canvas.height)
const decoded = jsQR(image.data, canvas.width, canvas.height)
assert(decoded?.data, 'Company QR must scan with a quiet zone')
assert(decoded.data.includes('442228866'), 'Company QR must contain approved account number')
assert(!decoded.data.includes('36556207'), 'Old personal account must not be encoded')
console.log('PASS company QR scan: approved account encoded, old account absent')

if (process.env.TBHP_RENDERED_PNG) {
  const rendered = await loadImage(fs.readFileSync(process.env.TBHP_RENDERED_PNG))
  const pageCanvas = createCanvas(rendered.width, rendered.height)
  const pageContext = pageCanvas.getContext('2d')
  pageContext.drawImage(rendered, 0, 0)
  const pagePixels = pageContext.getImageData(0, 0, rendered.width, rendered.height)
  const pageQr = jsQR(pagePixels.data, rendered.width, rendered.height)
  assert(pageQr?.data?.includes('442228866'), 'Rendered TBHP QR must scan to approved account')
  assert.equal(pageQr.data, decoded.data, 'Rendered TBHP QR must match the company QR asset')
  console.log('PASS rendered TBHP QR scan: approved account encoded')
}
