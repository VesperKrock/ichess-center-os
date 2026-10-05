import { COMPANY_TUITION_PAYMENT_PROFILE } from '../src/tuition-notice-pdf.js'

export function makeA5Notice(count = 16, legacy = false) {
  const noticeId = 'b840935f-0d0e-4f07-92dc-61eeb136e608'
  const price = count === 8 ? 1250000 : count === 24 ? 3600000 : 2500000
  const discount = price / 10
  return {
    id: noticeId, targetTermNumber: count === 8 || legacy ? 1 : 2,
    issuedAt: '2026-09-25T08:00:00+07:00',
    snapshot: {
      noticeId, documentType: 'TUITION_NOTICE', issuedAt: '2026-09-25T08:00:00+07:00',
      registration: { code: count === 8 || legacy ? 'NEW_REGISTRATION' : 'RENEWAL' },
      center: { name: 'DreamHome', phone: '0365 998 894', website: 'www.ichess.edu.vn' },
      student: { name: legacy ? 'Trần Gia Hân' : count === 8 ? 'Lê Minh An' : count === 24 ? 'Nguyễn Hoàng Minh Anh Bảo Châu An' : 'Nguyễn Minh Anh' },
      tuition: { packageName: `${count} buổi`, termNumber: count === 8 || legacy ? 1 : 2,
        totalSessions: count, maxCompletionWeeks: Math.ceil(count / 2) + 1 },
      paymentWindow: { from: '2026-09-25', to: '2026-09-30' },
      paymentTruth: { status: 'UNPAID', paidBeforeIChess: false },
      money: { tuitionAmount: price, discountAmount: discount, materialFee: 80000, totalAmount: price - discount + 80000 },
      transfer: { ...COMPANY_TUITION_PAYMENT_PROFILE,
        content: count === 8 ? 'HP LE MINH AN KY 1' : count === 24 ? 'HP NGUYEN HOANG MINH ANH KY 2' : legacy ? 'HP TRAN GIA HAN KY 1' : 'HP NGUYEN MINH ANH KY 2' },
    },
  }
}
