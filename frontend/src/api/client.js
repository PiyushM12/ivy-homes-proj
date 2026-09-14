// Low-level HTTP client for the Ivy Homes API.
//
// Two things get attached to every authenticated request, per API_REFERENCE.md:
//   1. api_key as a query parameter (scopes the request to your city)
//   2. Authorization: Bearer <token> header (identifies the logged-in user)
//
// This file deliberately does NOT hardcode which query params a given
// endpoint "supports" beyond what's needed to build the URL — filtering,
// sorting and pagination correctness are handled at a higher layer
// (see api/fetchAll.js and the page components), because the assignment's
// whole point is that the documentation's claims about params can't be
// trusted blindly. This client's job is just: build the URL, attach auth,
// parse the response, surface errors usefully.

const API_BASE = import.meta.env.VITE_API_BASE || "https://solve.ivy.homes";
const API_KEY = import.meta.env.VITE_API_KEY || "";

const TOKEN_STORAGE_KEY = "ivy.auth.v1";

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.expiresAt) return null;
    if (Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeAuth({ token, tokenType, expiresIn, user }) {
  const record = {
    token,
    tokenType: tokenType || "Bearer",
    // Refresh a little early (60s) so we don't get caught by clock skew.
    expiresAt: Date.now() + (Number(expiresIn) || 0) * 1000 - 60_000,
    user,
  };
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function buildUrl(path, params = {}) {
  const url = new URL(path.replace(/^\//, ""), API_BASE + "/");
  url.searchParams.set("api_key", API_KEY);
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

/**
 * @param {string} path - e.g. "/v1/listings"
 * @param {object} opts
 * @param {object} [opts.params] - query params (api_key is added automatically)
 * @param {boolean} [opts.auth] - attach Authorization header from stored token
 * @param {string} [opts.method]
 * @param {object} [opts.body]
 */
export async function apiRequest(path, opts = {}) {
  const { params = {}, auth = true, method = "GET", body } = opts;
  const url = buildUrl(path, params);

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const stored = getStoredAuth();
    if (!stored) {
      throw new ApiError(401, "Not logged in (no valid session token)", url);
    }
    headers.Authorization = `${stored.tokenType} ${stored.token}`;
  }

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

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
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

export function login(email, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}

export function logout() {
  // Best effort — invalidate server-side, then always clear locally.
  return apiRequest("/auth/logout", { method: "POST" }).catch(() => {});
}

export { ApiError, API_BASE, API_KEY };
