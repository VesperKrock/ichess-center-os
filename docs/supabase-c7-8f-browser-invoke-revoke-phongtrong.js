// C7.8F controlled manual browser script.
// Run only while logged in as owner in the iChess app.
// Target is fixed to Phong Trong only. This script does not log the session token.

(async () => {
  const storageKey = 'sb-zahcfnpaprbnuqpegdmo-auth-token'
  const raw = window.localStorage.getItem(storageKey)

  if (!raw) {
    console.log('No Supabase auth session found. Log in as owner first.')
    return
  }

  function findAccessToken(value) {
    if (!value || typeof value !== 'object') return ''
    if (typeof value.access_token === 'string') return value.access_token
    if (typeof value.currentSession?.access_token === 'string') return value.currentSession.access_token
    if (typeof value.session?.access_token === 'string') return value.session.access_token

    for (const child of Object.values(value)) {
      const found = findAccessToken(child)
      if (found) return found
    }

    return ''
  }

  const accessToken = findAccessToken(JSON.parse(raw))
  if (!accessToken) {
    console.log('Supabase auth session exists, but access token was not found.')
    return
  }

  const body = {
    center_id: 'phongtrong_prod',
    target_email: 'admin.phongtrong@ichess.vn',
    idempotency_key: `c7-8f-revoke-phongtrong-prod-${Date.now()}`,
    reason: 'owner_controlled_revoke_center_admin_access',
    disable_auth_user: false,
  }

  console.log('Invoking controlled revoke for Phong Trong only:', {
    center_id: body.center_id,
    target_email: body.target_email,
    idempotency_key: body.idempotency_key,
    disable_auth_user: body.disable_auth_user,
  })

  const response = await fetch('https://zahcfnpaprbnuqpegdmo.supabase.co/functions/v1/revoke-center-admin-access', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const result = await response.json().catch(async () => ({ raw: await response.text() }))
  console.log('Controlled revoke response:', {
    http_status: response.status,
    ok: result.ok,
    code: result.code,
    center_id: result.center_id,
    email: result.email,
    membership_status: result.membership_status,
    auth_user_disabled: result.auth_user_disabled,
    audit_id: result.audit_id,
  })
})()
