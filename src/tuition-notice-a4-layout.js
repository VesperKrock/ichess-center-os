// Top-left coordinates in PDF points, measured from the approved A4 goldens.
// These are two fixed TBHP profiles, not a flowing/paginated document engine.
export const TBHP_A4_PAGE = Object.freeze({ width: 595.2756, height: 841.8898 })

const field = (x, baseline, width, options = {}) => Object.freeze({
  x, y: baseline - 13, width, height: 16, baseline, font: 'regular',
  fontSize: 11, align: 'left', maxLines: 1, lineHeight: 16, ...options,
})

const fields = Object.freeze({
  greeting: field(50, 154, 248),
  introduction: field(50, 180, 248, { height: 32, maxLines: 2 }),
  student: field(129, 223, 169, { height: 33, maxLines: 2, fallbackSize: 10.5 }),
  package: field(134, 255, 164),
  center: field(135, 271, 163),
  progress: field(143, 287, 155),
  reminder: field(50, 310, 248, {
    font: 'italic', fontSize: 10, height: 42, maxLines: 3, lineHeight: 12.5,
  }),
  paymentRequest: field(50, 359, 248, { height: 32, maxLines: 2, lineHeight: 14 }),
  paymentWindow: field(50, 391, 248, { height: 32, maxLines: 2, lineHeight: 14 }),
  tuition: field(50, 427, 248),
  discount: field(50, 443, 248),
  material: field(50, 459, 248),
  total: field(50, 475, 248, { font: 'bold' }),
  notesTitle: field(50, 497, 248, { font: 'bold', underline: true }),
  makeup: field(50, 513, 248, { height: 32, maxLines: 2 }),
  completion: field(50, 545, 248, { height: 32, maxLines: 2 }),
  paymentTitle: field(50, 583, 248, { font: 'bold' }),
  cash: field(50, 599, 350),
  transferTitle: field(50, 615, 350),
  account: field(86, 631, 328),
  beneficiary: field(86, 647, 328),
  bank: field(86, 663, 328),
  transferContent: field(86, 679, 328, { height: 33, maxLines: 2, lineHeight: 14 }),
  footerRequest: field(50, 719, 495, { align: 'center', height: 32, maxLines: 2 }),
  thanks: field(50, 761, 495, { font: 'bold', align: 'center' }),
  hotline: field(63.664, 803.88, 467, { font: 'contact', fontSize: 12 }),
  website: field(63.664, 819.72, 467, { font: 'contact', fontSize: 12 }),
})

const common = Object.freeze({
  page: TBHP_A4_PAGE,
  fields,
  labels: Object.freeze({ bulletX: 64, textX: 78, baselines: [223, 255, 271, 287] }),
  table: Object.freeze({
    x: 308, y: 134, width: 223, headerHeight: 21.5, rowStep: 13.3,
    columns: Object.freeze([308, 339.5, 409, 531]),
    headerBaseline: 148.6, firstRowBaseline: 165.9, fontSize: 10,
    borderWidth: 0.48, padding: 3,
  }),
  qr: Object.freeze({ x: 427, y: 576, width: 104, height: 104, quietZone: 10.6666667 }),
  bankBullet: Object.freeze({ x: 68, size: 2.5, baselineOffset: -5 }),
})

export const TUITION_NOTICE_A4_LAYOUTS = Object.freeze({
  TBHP_A4_16: Object.freeze({ ...common, name: 'TBHP_A4_16', minSessions: 1, maxSessions: 16 }),
  TBHP_A4_24: Object.freeze({ ...common, name: 'TBHP_A4_24', minSessions: 17, maxSessions: 24 }),
})

export function selectTuitionNoticeA4Layout(sessionCount) {
  if (!Number.isSafeInteger(sessionCount) || sessionCount < 1 || sessionCount > 24) return null
  return sessionCount <= 16 ? TUITION_NOTICE_A4_LAYOUTS.TBHP_A4_16 : TUITION_NOTICE_A4_LAYOUTS.TBHP_A4_24
}
