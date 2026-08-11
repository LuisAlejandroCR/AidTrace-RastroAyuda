export async function verifyAccessToken({ token, supabaseUrl, anonKey }) {
  if (!token || typeof token !== "string" || token.length > 4096) {
    return null;
  }

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  let payload;
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    payload = await response.json();
  } catch {
    return null;
  }

  if (payload?.id && typeof payload.id === "string") {
    return { userId: payload.id, email: payload.email || null };
  }

  return null;
}
