// Measured from the approved production PDF. Coordinates are points from the
// top-left; baseline is explicit, independent of font ascent and browser DPI.
export const TBHP_A5_PAGE = Object.freeze({ width: 419.5276, height: 595.2756 })
const field = (x, baseline, width, options = {}) => Object.freeze({
  x, y: baseline - 10, baseline, width, height: 12, fontSize: 9.96,
  minFontSize: 8, maxLines: 1, lineHeight: 13.2, font: 'regular', ...options,
})
export const TUITION_NOTICE_A5_LAYOUT = Object.freeze({
  name: 'TBHP_A5', page: TBHP_A5_PAGE,
  fields: Object.freeze({
    studentName: field(127, 157.1, 142, { minFontSize: 7.5 }),
    birthDate: field(319, 157.1, 58),
    sessionCount: field(127, 171.02, 12, { minFontSize: 7 }),
    centerName: field(157, 184.94, 220),
    dueDate: field(56.784, 208.25, 320, { minFontSize: 8.5 }),
    tuitionAmount: field(56.784, 221.45, 320),
    totalAmount: field(114, 234.65, 102, { font: 'bold', color: [0.75, 0, 0] }),
    discount: field(218, 234.65, 159, { font: 'bold', color: [0.75, 0, 0] }),
    note: field(64.784, 272.09, 312, { maxLines: 5, height: 57.5, lineHeight: 11.5, minFontSize: 9 }),
    paymentContent: field(136, 420.57, 145, { maxLines: 2, height: 26.4 }),
    contact: field(56.784, 483.1, 320, { align: 'center' }),
    hotline: field(113, 565.65601, 264, { font: 'bold' }),
    paymentStatus: field(72.024, 339.81, 305, { maxLines: 2, height: 26.4 }),
    paymentTitle: field(57.864, 326.13, 319, { font: 'bold' }),
    footer: field(56.784, 457.18, 320, { align: 'center', maxLines: 2, height: 26.4 }),
  }),
  // QR is already embedded, with its quiet zone, in the approved template.
  qr: Object.freeze({ x: 295.66, y: 363.43, width: 72.04, height: 72.04, authority: 'template' }),
})
