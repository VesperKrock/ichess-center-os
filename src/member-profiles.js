import { CURRENT_CENTER_ID, getCurrentSupabaseUser } from './supabase-auth.js'
import { getSupabaseClient } from './supabase-client.js'

const profileColumns =
  'user_id, center_id, role, display_name, member_label, email_snapshot, updated_at'

export function mapCenterMemberProfile(row = {}) {
  return {
    userId: row.user_id ?? '',
    centerId: row.center_id ?? '',
    role: row.role ?? '',
    displayName: row.display_name ?? '',
    memberLabel: row.member_label ?? '',
    emailSnapshot: row.email_snapshot ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function buildMemberProfileMap(profiles = []) {
  return profiles.reduce((profileMap, profile) => {
    if (profile?.userId) {
      profileMap[profile.userId] = profile
    }

    return profileMap
  }, {})
}

export function buildMyCenterMemberProfileUpdate({
  displayName,
  memberLabel,
  emailSnapshot,
  updatedAt = new Date().toISOString(),
} = {}) {
  return {
    display_name: String(displayName ?? '').trim(),
    member_label: String(memberLabel ?? '').trim(),
    email_snapshot: String(emailSnapshot ?? '').trim(),
    updated_at: updatedAt,
  }
}

export async function listCenterMemberProfiles({
  centerId = CURRENT_CENTER_ID,
} = {}) {
  const authResult = await getAuthorizedProfileContext()

  if (!authResult.ok) {
    return authResult
  }

  const { data, error } = await authResult.data.client
    .from('center_members')
    .select(profileColumns)
    .eq('center_id', centerId)
    .order('display_name', { ascending: true, nullsFirst: false })

  if (error) {
    return failure(error.message, isMissingProfileSchemaError(error))
  }

  return success((data ?? []).map(mapCenterMemberProfile))
}

export async function getMemberProfileMap(options = {}) {
  const result = await listCenterMemberProfiles(options)

  if (!result.ok) {
    return result
  }

  return success(buildMemberProfileMap(result.data))
}

export async function updateMyCenterMemberProfile({
  centerId = CURRENT_CENTER_ID,
  displayName,
  memberLabel,
  emailSnapshot,
} = {}) {
  const authResult = await getAuthorizedProfileContext()

  if (!authResult.ok) {
    return authResult
  }

  const payload = buildMyCenterMemberProfileUpdate({
    displayName,
    memberLabel,
    emailSnapshot: emailSnapshot || authResult.data.user.email,
  })
  const { data, error } = await authResult.data.client
    .from('center_members')
    .update(payload)
    .eq('center_id', centerId)
    .eq('user_id', authResult.data.user.id)
    .select(profileColumns)
    .maybeSingle()

  if (error) {
    return failure(error.message, isMissingProfileSchemaError(error))
  }

  if (!data) {
    return failure('Không tìm thấy membership hiện tại để cập nhật.')
  }

  return success(mapCenterMemberProfile(data))
}

async function getAuthorizedProfileContext() {
  const client = getSupabaseClient()

  if (!client) {
    return failure('Chưa cấu hình Supabase.')
  }

  try {
    const user = await getCurrentSupabaseUser()

    if (!user) {
      return failure('Chưa đăng nhập Supabase.')
    }

    return success({ client, user })
  } catch (error) {
    return failure(error?.message || 'Không thể kiểm tra phiên Supabase.')
  }
}

function isMissingProfileSchemaError(error) {
  return /display_name|member_label|email_snapshot|updated_at|schema cache|column/i.test(
    String(error?.message ?? ''),
  )
}

function success(data) {
  return {
    ok: true,
    data,
    error: '',
    schemaUnavailable: false,
  }
}

function failure(error, schemaUnavailable = false) {
  return {
    ok: false,
    data: null,
    error: String(error ?? 'Lỗi không xác định.'),
    schemaUnavailable,
  }
}
