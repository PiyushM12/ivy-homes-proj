// Minimal API client for the offline collection/analysis scripts.
// Node 18+ has fetch built in — no dependencies needed.

const BASE = process.env.IVY_API_BASE || "https://solve.ivy.homes";
const API_KEY = process.env.IVY_API_KEY;

if (!API_KEY) {
  console.error("Set IVY_API_KEY in your environment (see scripts/.env.example).");
  process.exit(1);
}

let token = null;

function buildUrl(path, params = {}) {
  const url = new URL(path.replace(/^\//, ""), BASE + "/");
  url.searchParams.set("api_key", API_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, v);
  }
  return url;
}

export async function login(email, password) {
  const url = buildUrl("/auth/login");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`login failed: ${res.status} ${JSON.stringify(data)}`);
  token = data.token;
  return data;
}

export async function apiGet(path, params = {}) {
  const url = buildUrl(path, params);
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`GET ${path} -> ${res.status}: ${JSON.stringify(data)}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

/**
 * Pages a collection endpoint all the way to the end. Does not trust
 * `total` as the stopping condition — stops on an empty page (with a
 * one-page lookahead past any short page, in case a short page wasn't
 * actually the last one).
 */
export async function fetchAllPages(path, params = {}, { limit = 200, maxPages = 1000 } = {}) {
  const results = [];
  let claimedTotal = null;
  let page = 1;
  let pagesFetched = 0;

  while (page <= maxPages) {
    const data = await apiGet(path, { ...params, page, limit });
    const pageResults = Array.isArray(data?.results) ? data.results : [];
    pagesFetched++;
    if (claimedTotal === null && typeof data?.total === "number") claimedTotal = data.total;

    if (pageResults.length === 0) break;
    results.push(...pageResults);

    if (pageResults.length < limit) {
      const probe = await apiGet(path, { ...params, page: page + 1, limit });
      pagesFetched++;
      const probeResults = Array.isArray(probe?.results) ? probe.results : [];
      if (probeResults.length === 0) break;
      results.push(...probeResults);
      if (probeResults.length < limit) break;
      page += 2;
      continue;
    }
    page += 1;
  }

  return { results, claimedTotal, pagesFetched };
}
