import { getSupabaseClient, getSupabaseConfigStatus } from './supabase-client.js'
import {
  CURRENT_CENTER_ID,
  getCurrentCenterMembership,
  getCurrentSupabaseUser,
} from './supabase-auth.js'
import {
  CLOUD_ENTITY_TYPES,
  CLOUD_ENTITY_TYPE_VALUES,
  buildCloudEntityRecords,
  isAllowedCloudEntityType,
} from './cloud-db-entities.js'
import { SCHEDULE_SESSION_CLOUD_ENTITY_TYPE } from './cloud-schedule-sessions.js'
import {
  createEmptyCloudBootstrapCounts,
  getCloudBootstrapSnapshotCounts,
  hasCloudBootstrapSnapshotData,
} from './cloud-bootstrap.js'
import {
  buildOnlineAccessState,
  canWriteEntity,
  getOnlineAccessMessage,
} from './online-access-control.js'

const CLOUD_ENTITY_SELECT_FIELDS =
  'center_id, entity_type, local_id, payload, source_module, source_version, updated_at, deleted_at'
const CLOUD_ENTITY_READINESS_SELECT_FIELDS = 'local_id, deleted_at, updated_at'

export async function getCloudDbContext(centerId = CURRENT_CENTER_ID) {
  const configStatus = getSupabaseConfigStatus()

  if (configStatus.status !== 'configured') {
    return { ok: false, error: 'Chưa cấu hình Supabase Cloud DB.' }
  }

  const supabase = getSupabaseClient()

  if (!supabase) {
    return { ok: false, error: 'Không khởi tạo được Supabase client.' }
  }

  try {
    const user = await getCurrentSupabaseUser()

    if (!user) {
      return { ok: false, error: 'Vui lòng đăng nhập Supabase trước khi dùng Cloud DB.' }
    }

    let membership = null

    try {
      membership = await getCurrentCenterMembership(user.id, centerId)
    } catch (error) {
      const detail = {
        ...classifyCloudDbError(error, 'center_members'),
        centerId,
      }
      return {
        ok: false,
        error: getCloudDbReadinessMessage(detail),
        detail,
      }
    }

    if (!membership?.role) {
      return {
        ok: false,
        error: `User hiện tại chưa có membership center_members với center_id = ${centerId}.`,
        detail: {
          category: 'missing-membership',
          status: 403,
          target: 'center_members',
          centerId,
        },
      }
    }

    return { ok: true, supabase, user, membership, centerId }
  } catch (error) {
    return { ok: false, error: getCloudDbErrorMessage(error) }
  }
}

export async function checkCloudDbReadiness(centerId = CURRENT_CENTER_ID) {
  const context = await getCloudDbContext(centerId)

  if (!context.ok) {
    const detail = {
      ...classifyCloudDbContextError(context.error),
      centerId,
    }

    return {
      ...context,
      ready: false,
      cloudCounts: null,
      error: getCloudDbReadinessMessage(detail),
      detail,
    }
  }

  const { error } = await context.supabase
    .from('center_cloud_entities')
    .select(CLOUD_ENTITY_READINESS_SELECT_FIELDS, { count: 'exact', head: true })
    .eq('center_id', centerId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) {
    const detail = {
      ...classifyCloudDbError(error, 'center_cloud_entities'),
      centerId,
    }

    return {
      ok: false,
      ready: false,
      cloudCounts: null,
      error: getCloudDbReadinessMessage(detail),
      detail,
    }
  }

  return {
    ok: true,
    ready: true,
    supabase: context.supabase,
    user: context.user,
    membership: context.membership,
    centerId: context.centerId,
  }
}

export async function listCloudEntities({ supabase, centerId = CURRENT_CENTER_ID, entityType } = {}) {
  if (!supabase) {
    return { ok: false, error: 'Thiếu Supabase client.' }
  }

  if (!isAllowedCloudEntityType(entityType)) {
    return { ok: false, error: 'Entity type không thuộc phạm vi C2.' }
  }

  const { data, error } = await supabase
    .from('center_cloud_entities')
    .select(CLOUD_ENTITY_SELECT_FIELDS)
    .eq('center_id', centerId)
    .eq('entity_type', entityType)
    .is('deleted_at', null)
    .order('updated_at', { ascending: true })

  if (error) {
    return {
      ok: false,
      error: getCloudDbErrorMessage(error),
      detail: classifyCloudDbError(error, 'center_cloud_entities'),
    }
  }

  return { ok: true, data: data || [] }
}

export async function listCloudEntityPayloads({
  supabase,
  centerId = CURRENT_CENTER_ID,
  entityType,
} = {}) {
  const result = await listCloudEntities({ supabase, centerId, entityType })

  if (!result.ok) {
    return result
  }

  return {
    ok: true,
    data: result.data
      .map((record) => record.payload)
      .filter((payload) => payload && typeof payload === 'object'),
  }
}

export async function listScheduleSessionCloudPayloads({
  supabase,
  centerId = CURRENT_CENTER_ID,
} = {}) {
  if (!supabase) {
    return { ok: false, error: 'Thiếu Supabase client.' }
  }

  const { data, error } = await supabase
    .from('center_cloud_entities')
    .select(CLOUD_ENTITY_SELECT_FIELDS)
    .eq('center_id', centerId)
    .eq('entity_type', SCHEDULE_SESSION_CLOUD_ENTITY_TYPE)
    .is('deleted_at', null)
    .order('updated_at', { ascending: true })

  if (error) {
    return {
      ok: false,
      error: getCloudDbErrorMessage(error),
      detail: classifyCloudDbError(error, 'center_cloud_entities'),
    }
  }

  return {
    ok: true,
    data: (data || [])
      .map((record) => record.payload)
      .filter((payload) => payload && typeof payload === 'object'),
  }
}

export async function upsertCloudEntities({
  supabase,
  centerId = CURRENT_CENTER_ID,
  entityType,
  items = [],
  userId = null,
} = {}) {
  if (!supabase) {
    return { ok: false, error: 'Thiếu Supabase client.' }
  }

  if (!isAllowedCloudEntityType(entityType)) {
    return { ok: false, error: 'Entity type không thuộc phạm vi C2.' }
  }

  const { records, errors } = buildCloudEntityRecords({ centerId, entityType, items, userId })

  if (errors.length) {
    return { ok: false, error: errors.join(' ') }
  }

  if (!records.length) {
    return { ok: true, count: 0 }
  }

  const { error } = await supabase
    .from('center_cloud_entities')
    .upsert(records, { onConflict: 'center_id,entity_type,local_id' })

  if (error) {
    return {
      ok: false,
      error: getCloudDbErrorMessage(error),
      detail: classifyCloudDbError(error, 'center_cloud_entities'),
    }
  }

  return { ok: true, count: records.length }
}

export async function deleteCloudEntity({
  supabase,
  centerId = CURRENT_CENTER_ID,
  entityType,
  localId,
} = {}) {
  if (!supabase) {
    return { ok: false, error: 'Thiếu Supabase client.' }
  }

  if (!isAllowedCloudEntityType(entityType)) {
    return { ok: false, error: 'Entity type không thuộc phạm vi C2.' }
  }

  const normalizedLocalId = String(localId || '').trim()

  if (!normalizedLocalId) {
    return { ok: false, error: 'Thiếu local_id.' }
  }

  const { error } = await supabase
    .from('center_cloud_entities')
    .update({ deleted_at: new Date().toISOString() })
    .eq('center_id', centerId)
    .eq('entity_type', entityType)
    .eq('local_id', normalizedLocalId)

  if (error) {
    return {
      ok: false,
      error: getCloudDbErrorMessage(error),
      detail: classifyCloudDbError(error, 'center_cloud_entities'),
    }
  }

  return { ok: true }
}

export async function getCloudEntityCounts({ supabase, centerId = CURRENT_CENTER_ID } = {}) {
  if (!supabase) {
    return { ok: false, error: 'Thiếu Supabase client.' }
  }

  const counts = createEmptyCloudEntityCounts()

  for (const entityType of CLOUD_ENTITY_TYPE_VALUES) {
    const { count, error } = await supabase
      .from('center_cloud_entities')
      .select('local_id', { count: 'exact', head: true })
      .eq('center_id', centerId)
      .eq('entity_type', entityType)
      .is('deleted_at', null)

    if (error) {
      return {
        ok: false,
        error: getCloudDbErrorMessage(error),
        detail: classifyCloudDbError(error, 'center_cloud_entities'),
      }
    }

    counts[entityType] = count || 0
  }

  return { ok: true, counts }
}

export async function pushLocalCoreEntitiesToCloud({
  students = [],
  teachers = [],
  classSessions = [],
  centerId = CURRENT_CENTER_ID,
} = {}) {
  const context = await checkCloudDbReadiness(centerId)

  if (!context.ok) {
    return context
  }

  const accessState = buildOnlineAccessState({
    isSupabaseConfigured: true,
    isSignedIn: Boolean(context.user),
    user: context.user,
    centerId: context.centerId,
    membership: context.membership,
    role: context.membership?.role,
    cloudReady: context.ready !== false,
  })

  if (!canWriteEntity(accessState, CLOUD_ENTITY_TYPES.STUDENT)) {
    return {
      ok: false,
      error: getOnlineAccessMessage(accessState),
      detail: {
        category: 'cloud-write-read-only',
        target: 'center_cloud_entities',
        role: accessState.role,
        reason: accessState.reason,
        needsMembershipPatch: accessState.needsMembershipPatch,
      },
    }
  }

  const groups = [
    [CLOUD_ENTITY_TYPES.STUDENT, students],
    [CLOUD_ENTITY_TYPES.TEACHER, teachers],
    [CLOUD_ENTITY_TYPES.CLASS_SESSION, classSessions],
  ]
  const counts = createEmptyCloudEntityCounts()

  for (const [entityType, items] of groups) {
    const result = await upsertCloudEntities({
      supabase: context.supabase,
      centerId,
      entityType,
      items,
      userId: context.user.id,
    })

    if (!result.ok) {
      return result
    }

    counts[entityType] = result.count || 0
  }

  return { ok: true, counts }
}

export async function pullCoreEntitiesFromCloud(centerId = CURRENT_CENTER_ID) {
  try {
    const context = await checkCloudDbReadiness(centerId)

    if (!context.ok) {
      return context
    }

    const studentsResult = await listCloudEntityPayloads({
      supabase: context.supabase,
      centerId,
      entityType: CLOUD_ENTITY_TYPES.STUDENT,
    })
    const teachersResult = await listCloudEntityPayloads({
      supabase: context.supabase,
      centerId,
      entityType: CLOUD_ENTITY_TYPES.TEACHER,
    })
    const classSessionsResult = await listCloudEntityPayloads({
      supabase: context.supabase,
      centerId,
      entityType: CLOUD_ENTITY_TYPES.CLASS_SESSION,
    })
    const failedResult = [studentsResult, teachersResult, classSessionsResult].find(
      (result) => !result.ok,
    )

    if (failedResult) {
      return failedResult
    }

    return {
      ok: true,
      data: {
        students: studentsResult.data,
        teachers: teachersResult.data,
        classSessions: classSessionsResult.data,
      },
    }
  } catch (error) {
    console.warn(`Không thể pull Cloud DB C2. Local data được giữ nguyên. ${error?.message || ''}`.trim())
    return {
      ok: false,
      error: getCloudDbErrorMessage(error),
      detail: classifyCloudDbError(error, 'center_cloud_entities'),
    }
  }
}

export async function pullCloudBootstrapCoreEntities(centerId = CURRENT_CENTER_ID) {
  try {
    const context = await checkCloudDbReadiness(centerId)

    if (!context.ok) {
      return context
    }

    const studentsResult = await listCloudEntityPayloads({
      supabase: context.supabase,
      centerId,
      entityType: CLOUD_ENTITY_TYPES.STUDENT,
    })
    const teachersResult = await listCloudEntityPayloads({
      supabase: context.supabase,
      centerId,
      entityType: CLOUD_ENTITY_TYPES.TEACHER,
    })
    const classSessionsResult = await listCloudEntityPayloads({
      supabase: context.supabase,
      centerId,
      entityType: CLOUD_ENTITY_TYPES.CLASS_SESSION,
    })
    const scheduleSessionsResult = await listScheduleSessionCloudPayloads({
      supabase: context.supabase,
      centerId,
    })
    const failedResult = [studentsResult, teachersResult, classSessionsResult, scheduleSessionsResult].find(
      (result) => !result.ok,
    )

    if (failedResult) {
      return failedResult
    }

    const data = {
      students: studentsResult.data,
      teachers: teachersResult.data,
      classSessions: classSessionsResult.data,
      scheduleSessions: scheduleSessionsResult.data,
    }
    const counts = {
      ...createEmptyCloudBootstrapCounts(),
      ...getCloudBootstrapSnapshotCounts(data),
    }

    return {
      ok: true,
      data,
      counts,
      empty: !hasCloudBootstrapSnapshotData(data),
    }
  } catch (error) {
    console.warn(`Không thể bootstrap dữ liệu cloud. Local cache được giữ nguyên. ${error?.message || ''}`.trim())
    return {
      ok: false,
      error: getCloudDbErrorMessage(error),
      detail: classifyCloudDbError(error, 'center_cloud_entities'),
    }
  }
}

export function createEmptyCloudEntityCounts() {
  return {
    [CLOUD_ENTITY_TYPES.STUDENT]: 0,
    [CLOUD_ENTITY_TYPES.TEACHER]: 0,
    [CLOUD_ENTITY_TYPES.CLASS_SESSION]: 0,
  }
}

export function getCloudDbErrorMessage(error) {
  return String(error?.message || error || 'Không thể thao tác Cloud DB C2.')
}

export function classifyCloudDbError(error, target = 'center_cloud_entities') {
  const code = String(error?.code || '')
  const status = Number(error?.status || (code === '42501' ? 403 : 0)) || null
  const message = String(error?.message || error || '')
  const normalizedMessage = message.toLowerCase()

  if (
    status === 400 ||
    code === '42P01' ||
    code === '42703' ||
    code.startsWith('PGRST') ||
    normalizedMessage.includes('schema cache') ||
    normalizedMessage.includes('does not exist') ||
    normalizedMessage.includes('column')
  ) {
    return {
      category: 'schema-not-ready',
      status: status || 400,
      code,
      target,
      message,
    }
  }

  if (
    status === 403 ||
    code === '42501' ||
    normalizedMessage.includes('permission denied') ||
    normalizedMessage.includes('row-level security')
  ) {
    return {
      category: target === 'center_members' ? 'membership-read-denied' : 'cloud-permission-denied',
      status: status || 403,
      code,
      target,
      message,
    }
  }

  return {
    category: 'unknown',
    status,
    code,
    target,
    message,
  }
}

export function classifyCloudDbContextError(error) {
  const message = String(error?.message || error || '')
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('center_members') || normalizedMessage.includes('dreamhome')) {
    return {
      category: 'missing-membership',
      status: 403,
      target: 'center_members',
      message,
    }
  }

  if (normalizedMessage.includes('đăng nhập') || normalizedMessage.includes('dang nhap')) {
    return {
      category: 'signed-out',
      status: 401,
      target: 'auth',
      message,
    }
  }

  return classifyCloudDbError(error, 'center_members')
}

export function getCloudDbReadinessMessage(detail = {}) {
  const centerId = detail.centerId || 'current center'

  if (detail.category === 'schema-not-ready') {
    return 'Chưa chạy SQL C1/C2.2 hoặc bảng center_cloud_entities chưa sẵn sàng.'
  }

  if (detail.category === 'membership-read-denied') {
    return `Không đọc được quyền từ center_members. Kiểm tra GRANT/RLS và membership center_id = ${centerId}.`
  }

  if (detail.category === 'missing-membership') {
    return `User hiện tại chưa có membership center_members với center_id = ${centerId}.`
  }

  if (detail.category === 'cloud-permission-denied') {
    return `Không đọc được Cloud DB do quyền/RLS của center ${centerId}. Kiểm tra GRANT authenticated, center_members và policy.`
  }

  if (detail.category === 'signed-out') {
    return 'Vui lòng đăng nhập Supabase trước khi dùng Cloud DB.'
  }

  return 'Không thể kiểm tra Cloud DB C2.2 readiness.'
}
