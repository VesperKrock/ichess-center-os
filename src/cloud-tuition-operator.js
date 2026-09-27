import { parseV24PackageCycleSnapshot } from './cloud-authoritative-tuition-cycles.js'
import { parseF5BTuitionReceiptSnapshot } from './cloud-authoritative-tuition-receipts.js'

export async function pullTuitionOperatorSnapshot({
  supabase,
  centerId,
  timeoutMs = 15000,
}) {
  const controller = new AbortController()
  let timer
  try {
    const read = supabase
      .rpc('tuition_operator_read', { p_center_id: centerId })
      .abortSignal(controller.signal)
    const response = await Promise.race([
      read,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          resolve({ error: { message: 'timeout' } })
          controller.abort()
        }, timeoutMs)
      }),
    ])
    if (response.error)
      return { ok: false, outcome_code: 'TUITION_READ_FAILED' }
    return parseTuitionOperatorSnapshot(response.data, centerId)
  } catch {
    return { ok: false, outcome_code: 'TUITION_READ_FAILED' }
  } finally {
    clearTimeout(timer)
  }
}
export function parseTuitionOperatorSnapshot(data, centerId) {
  if (
    !data?.ok ||
    data.contract !== 'tuition-operator-v1' ||
    data.center_id !== centerId ||
    !Array.isArray(data.students)
  )
    return { ok: false, outcome_code: 'INVALID_SERVER_RESULT' }
  const cycles = parseV24PackageCycleSnapshot(data.cycle_state, centerId),
    receipts = parseF5BTuitionReceiptSnapshot(data.receipt_state, centerId)
  if (!cycles.ok || !receipts.ok)
    return { ok: false, outcome_code: 'INVALID_SERVER_RESULT' }
  if (
    data.students.some(
      (s) =>
        !s ||
        typeof s.id !== 'string' ||
        !s.id.trim() ||
        typeof s.fullName !== 'string',
    )
  )
    return { ok: false, outcome_code: 'INVALID_SERVER_RESULT' }
  const ids = new Set(data.students.map((s) => s.id))
  if (
    ids.size !== data.students.length ||
    cycles.students.some((s) => !ids.has(s.studentId))
  )
    return { ok: false, outcome_code: 'INVALID_SERVER_RESULT' }
  return {
    ok: true,
    centerId,
    students: data.students,
    cycleStates: cycles.students,
    catalog: cycles.packageCatalog,
    receipts: receipts.receipts,
    receiptCanWrite: receipts.canWrite,
    initialSetupEnabled: data.initial_student_setup_enabled === true,
    collectorName:
      typeof data.default_collector_name === 'string'
        ? data.default_collector_name
        : 'Admin',
    paymentCategory: data.payment_category || null,
  }
}
