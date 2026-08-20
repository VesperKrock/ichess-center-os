export const CORE_SAVE_PRECOMMIT_FAILURE_MESSAGE =
  'Chưa lưu được dữ liệu trung tâm. Thông tin bạn vừa nhập vẫn được giữ nguyên. Vui lòng thử lại.'

export const CORE_SAVE_COMMITTED_REFRESH_FAILED_MESSAGE =
  'Đã lưu dữ liệu nhưng chưa tải lại được thông tin mới nhất. Không cần bấm Lưu lại.'

const ACTIONABLE_PRECOMMIT_OUTCOMES = new Set([
  'CENTER_ACCESS_DENIED',
  'WRITE_ROLE_REQUIRED',
  'VERSION_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'CONCURRENT_CONFLICT',
  'INVALID_PAYLOAD',
  'PAYLOAD_ID_MISMATCH',
  'ENTITY_NOT_FOUND',
])

export function prepareAuthoritativeCoreFormCommand({
  formState = {},
  formValues = {},
  localIdPrefix = 'entity',
  createIdempotencyKey,
  createLocalId = () => `${localIdPrefix}-${Date.now()}`,
  now = () => new Date().toISOString(),
} = {}) {
  const intentFingerprint = stableStringify(formValues)
  const sameIntent = Boolean(
    formState.commandIntentFingerprint
    && formState.commandIntentFingerprint === intentFingerprint,
  )
  const commandIdempotencyKey = sameIntent && formState.commandIdempotencyKey
    ? formState.commandIdempotencyKey
    : createIdempotencyKey?.()
  if (!commandIdempotencyKey) {
    throw new Error('Không tạo được khóa chống gửi trùng cho lệnh lưu.')
  }

  const commandLocalId = formState.commandLocalId || createLocalId()
  const commandCreatedAt = formState.commandCreatedAt || now()

  return {
    commandIdempotencyKey,
    commandLocalId,
    commandCreatedAt,
    commandIntentFingerprint: intentFingerprint,
    formState: {
      ...formState,
      commandIdempotencyKey,
      commandLocalId,
      commandCreatedAt,
      commandIntentFingerprint: intentFingerprint,
    },
  }
}

export async function runAuthoritativeCoreSave({
  executeCommand,
  installCommittedEntity,
  refreshProjection,
  isContextCurrent = () => true,
  entityLabel = 'dữ liệu',
} = {}) {
  let commandResult
  try {
    commandResult = await executeCommand?.()
  } catch (error) {
    commandResult = {
      ok: false,
      outcome_code: 'SERVER_COMMAND_FAILED',
      error: String(error?.message || error),
      detail: error,
    }
  }

  if (!commandResult?.ok) {
    return buildPrecommitFailure(commandResult)
  }

  if (!isContextCurrent()) {
    return buildCommittedRefreshFailure(commandResult, {
      ok: false,
      outcome_code: 'CENTER_CONTEXT_CHANGED',
      error: 'Center context changed after the server commit.',
    })
  }

  let installError = null
  try {
    await installCommittedEntity?.(commandResult.entity, commandResult)
  } catch (error) {
    installError = error
  }

  let refreshResult
  try {
    refreshResult = await refreshProjection?.(commandResult)
  } catch (error) {
    refreshResult = {
      ok: false,
      outcome_code: 'REFRESH_THROWN',
      error: String(error?.message || error),
      detail: error,
    }
  }

  if (!isContextCurrent() || !refreshResult?.ok) {
    return buildCommittedRefreshFailure(commandResult, refreshResult, installError)
  }

  return {
    ...commandResult,
    ok: true,
    committed: true,
    refreshOk: true,
    refreshResult,
    installWarning: installError ? String(installError?.message || installError) : '',
    userMessage: `Đã lưu ${entityLabel} và tải lại dữ liệu trung tâm.`,
  }
}

export function getCoreSaveFailureMessage(result = {}) {
  const outcomeCode = String(result?.outcome_code || '')
  const message = String(result?.error || '').trim()
  return ACTIONABLE_PRECOMMIT_OUTCOMES.has(outcomeCode) && message
    ? message
    : CORE_SAVE_PRECOMMIT_FAILURE_MESSAGE
}

function buildPrecommitFailure(result = {}) {
  return {
    ...result,
    ok: false,
    committed: false,
    refreshOk: false,
    technicalError: String(result?.error || ''),
    error: getCoreSaveFailureMessage(result),
    userMessage: getCoreSaveFailureMessage(result),
  }
}

function buildCommittedRefreshFailure(commandResult, refreshResult = null, installError = null) {
  return {
    ...commandResult,
    ok: true,
    committed: true,
    refreshOk: false,
    commandOutcomeCode: commandResult.outcome_code,
    outcome_code: 'COMMITTED_REFRESH_FAILED',
    refreshResult,
    technicalRefreshError: [
      installError ? String(installError?.message || installError) : '',
      String(refreshResult?.error || ''),
    ].filter(Boolean).join(' '),
    warning: CORE_SAVE_COMMITTED_REFRESH_FAILED_MESSAGE,
    userMessage: CORE_SAVE_COMMITTED_REFRESH_FAILED_MESSAGE,
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
