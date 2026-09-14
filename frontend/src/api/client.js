// Ivy Homes API client.
// The running service was tested independently against this assignment's
// documentation: the API key is carried in X-API-Key, while logged-in
// requests additionally carry Authorization: Bearer <access_token>.

const API_BASE = import.meta.env.VITE_API_BASE || "https://solve.ivy.homes";
const API_KEY = import.meta.env.VITE_API_KEY || "";
const TOKEN_STORAGE_KEY = "ivy.auth.v2";

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken || !parsed?.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeAuth({ accessToken, refreshToken, tokenType, expiresIn, user }) {
  const record = {
    accessToken,
    refreshToken,
    tokenType: tokenType || "Bearer",
    expiresAt: Date.now() + (Number(expiresIn) || 900) * 1000,
    user,
  };
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function buildUrl(path, params = {}) {
  const url = new URL(path.replace(/^\//, ""), API_BASE.replace(/\/$/, "") + "/");
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

class ApiError extends Error {
  constructor(status, detail, url) {
    super(detail || `Request failed with status ${status}`);
    this.status = status;
    this.detail = detail;
    this.url = url;
  }
}

async function rawRequest(path, opts = {}) {
  const { params = {}, auth = true, method = "GET", body, accessToken } = opts;
  const url = buildUrl(path, params);
  const headers = { Accept: "application/json" };
  if (API_KEY) headers["X-API-Key"] = API_KEY;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(0, `Network error calling ${path}: ${networkErr.message}`, url);
  }

  const text = await res.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }

  if (!res.ok) {
    const detail =
      (payload && typeof payload === "object" && payload.detail) ||
      (typeof payload === "string" ? payload : null) ||
      res.statusText;
    throw new ApiError(res.status, detail, url);
  }
  return payload;
}

async function refreshSession(stored) {
  const data = await rawRequest("/auth/refresh", {
    method: "POST",
    auth: false,
    body: { refresh_token: stored.refreshToken },
  });
  return storeAuth({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || stored.refreshToken,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    user: data.user || stored.user,
  });
}

export async function apiRequest(path, opts = {}) {
  const { auth = true } = opts;
  if (!auth) return rawRequest(path, opts);

  let stored = getStoredAuth();
  if (!stored) throw new ApiError(401, "Not logged in", buildUrl(path, opts.params));

  // Refresh before expiry so the assignment's 30+ minute session requirement
  // does not depend on the user making a request at exactly the right moment.
  if (stored.expiresAt - Date.now() < 60_000) {
    try {
      stored = await refreshSession(stored);
    } catch {
      clearStoredAuth();
      throw new ApiError(401, "Session expired; please log in again", buildUrl(path, opts.params));
    }
  }

  try {
    return await rawRequest(path, { ...opts, accessToken: stored.accessToken });
  } catch (e) {
    if (e.status !== 401) throw e;
    // One refresh-and-retry path handles server/client clock skew and a token
    // that expired between the preflight check and the actual request.
    try {
      stored = await refreshSession(stored);
      return await rawRequest(path, { ...opts, accessToken: stored.accessToken });
    } catch {
      clearStoredAuth();
      throw new ApiError(401, "Session expired; please log in again", buildUrl(path, opts.params));
    }
  }
}

export function login(email, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}

export function logout() {
  return apiRequest("/auth/logout", { method: "POST" }).catch(() => {});
}

export { ApiError, API_BASE, API_KEY };
