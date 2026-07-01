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
    "c7-6j-reset-phongtrong-admin-" +
    new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

  const response = await fetch(
    "https://zahcfnpaprbnuqpegdmo.supabase.co/functions/v1/reset-center-admin-password",
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
        reason: "rotate_exposed_temporary_password",
      }),
    },
  );

  const text = await response.text();

  console.log("HTTP status:", response.status);
  console.log("Raw response:", text);

  try {
    const json = JSON.parse(text);
    console.log("Parsed response:", json);

    if (json.ok === true && json.code === "center_admin_password_reset") {
      console.log("PASS: Admin password reset.");
      console.log("EMAIL:", json.email);
      console.log("TEMPORARY_PASSWORD_DISPLAY_ONCE:", json.temporary_password);
      console.log("IMPORTANT: Copy the temporary password now. Do not paste it into chat.");
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
