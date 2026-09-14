const BASE = process.env.IVY_API_BASE || "https://solve.ivy.homes";
const API_KEY = process.env.IVY_API_KEY;
if (!API_KEY) {
  console.error("Set IVY_API_KEY in your environment (see scripts/.env.example).");
  process.exit(1);
}
let accessToken = null;
let refreshToken = null;

function buildUrl(path, params = {}) {
  const url = new URL(path.replace(/^\//, ""), BASE.replace(/\/$/, "") + "/");
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, v);
  }
  return url;
}

async function request(method, path, params = {}, body, auth = true) {
  const headers = { Accept: "application/json", "X-API-Key": API_KEY };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(buildUrl(path, params), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
    err.status = res.status; err.body = data;
    throw err;
  }
  return data;
}

export async function login(email, password) {
  const data = await request("POST", "/auth/login", {}, { email, password }, false);
  accessToken = data.access_token;
  refreshToken = data.refresh_token;
  return data;
}

async function maybeRefresh() {
  if (!refreshToken) return;
  const data = await request("POST", "/auth/refresh", {}, { refresh_token: refreshToken }, false);
  accessToken = data.access_token;
  refreshToken = data.refresh_token || refreshToken;
}

export async function apiGet(path, params = {}) {
  try {
    return await request("GET", path, params, undefined, true);
  } catch (e) {
    if (e.status !== 401 || !refreshToken) throw e;
    await maybeRefresh();
    return request("GET", path, params, undefined, true);
  }
}

export async function fetchAllPages(path, params = {}, { limit = 50, maxPages = 1000 } = {}) {
  const results = [];
  const seen = new Set();
  let claimedTotal = null;
  let offset = 0;
  let pagesFetched = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const data = await apiGet(path, { ...params, offset, limit: Math.min(limit, 50) });
    pagesFetched += 1;
    if (claimedTotal === null && typeof data?.total === "number") claimedTotal = data.total;
    const pageResults = Array.isArray(data?.results) ? data.results : [];
    for (const row of pageResults) {
      const id = row?.listing_id || row?.project_id;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      results.push(row);
    }
    const next = Number.isFinite(data?.next_offset) ? data.next_offset : offset + pageResults.length;
    if (!data?.has_more || pageResults.length === 0 || next <= offset) break;
    offset = next;
  }
  return { results, claimedTotal, pagesFetched };
}

export { API_KEY, BASE };
