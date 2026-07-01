// C7.7B TEMPLATE ONLY - DO NOT RUN IN C7.7B.
// This will revoke real admin access if the function is deployed and invoked.
// Do not run this script unless you intentionally want to revoke admin.phongtrong access.

(async () => {
  const storageKey = "sb-zahcfnpaprbnuqpegdmo-auth-token";
  const raw = localStorage.getItem(storageKey);

  if (!raw) {
    console.log("No auth token found. Please log in again with the owner account.");
    return;
  }

  function findAccessToken(value) {
    if (!value || typeof value !== "object") return null;
    if (typeof value.access_token === "string") return value.access_token;
    if (value.currentSession?.access_token) return value.currentSession.access_token;
    if (value.session?.access_token) return value.session.access_token;

    for (const child of Object.values(value)) {
      if (child && typeof child === "object") {
        const found = findAccessToken(child);
        if (found) return found;
      }
    }

    return null;
  }

  const token = findAccessToken(JSON.parse(raw));

  if (!token) {
    console.log("Auth storage key exists, but access_token was not found.");
    return;
  }

  const idempotencyKey =
    "c7-7c-revoke-phongtrong-admin-" +
    new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

  console.log("DO NOT RUN IN C7.7B.");
  console.log("About to call revoke-center-admin-access for real if you continue.");
  console.log("center_id: phongtrong_prod");
  console.log("target_email: admin.phongtrong@ichess.vn");
  console.log("disable_auth_user: false");
  console.log("idempotency_key:", idempotencyKey);

  const response = await fetch(
    "https://zahcfnpaprbnuqpegdmo.supabase.co/functions/v1/revoke-center-admin-access",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        center_id: "phongtrong_prod",
        target_email: "admin.phongtrong@ichess.vn",
        idempotency_key: idempotencyKey,
        reason: "admin_left_center",
        disable_auth_user: false,
      }),
    },
  );

  const text = await response.text();

  console.log("HTTP status:", response.status);
  console.log("Raw response:", text);

  try {
    const json = JSON.parse(text);
    console.log("Parsed response:", json);

    if (json.ok === true && json.code === "center_admin_access_revoked") {
      console.log("PASS: Center admin access revoked.");
      console.log("EMAIL:", json.email);
      console.log("MEMBERSHIP_STATUS:", json.membership_status);
      console.log("AUTH_USER_DISABLED:", json.auth_user_disabled);
      return;
    }

    console.log("NEEDS REVIEW:", json.code);

    if (json.debug) {
      console.log("DEBUG_OBJECT_COPY_THIS_ONLY:", json.debug);
    }
  } catch {
    console.log("Response is not JSON. Needs review.");
  }
})();
