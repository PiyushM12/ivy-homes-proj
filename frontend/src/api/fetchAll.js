import { apiRequest } from "./client";

/**
 * Fetches every record from a paginated collection endpoint.
 *
 * Deliberately does not stop just because `page * limit >= total` — the
 * documentation's claims about `total` being exact, and about what `limit`
 * caps at, are exactly the kind of thing this assignment expects you not to
 * trust on faith. Instead this walks pages until the server gives back an
 * empty (or short-and-repeating) page, and separately reports whatever
 * `total` the server claimed so you can compare the two.
 *
 * @param {string} path
 * @param {object} [extraParams] - filters etc., merged onto every page request
 * @param {object} [opts]
 * @param {number} [opts.limit=200]
 * @param {number} [opts.maxPages=500] - safety valve against a runaway loop
 * @returns {Promise<{results: any[], claimedTotal: number|null, pagesFetched: number}>}
 */
export async function fetchAllPages(path, extraParams = {}, opts = {}) {
  const limit = opts.limit ?? 200;
  const maxPages = opts.maxPages ?? 500;

  const results = [];
  let claimedTotal = null;
  let page = 1;
  let pagesFetched = 0;

  while (page <= maxPages) {
    const data = await apiRequest(path, {
      params: { ...extraParams, page, limit },
    });

    const pageResults = Array.isArray(data?.results) ? data.results : [];
    pagesFetched += 1;
    if (claimedTotal === null && typeof data?.total === "number") {
      claimedTotal = data.total;
    }

    if (pageResults.length === 0) break;

    results.push(...pageResults);

    // If the server handed back fewer than `limit`, that's almost certainly
    // the last page — but don't assume that's the ONLY termination signal,
    // some servers pad or short a page without being at the actual end, so
    // we also just try one page further whenever in doubt via the loop's
    // natural "empty page" exit above.
    if (pageResults.length < limit) {
      // Try one more page just in case the short page wasn't actually last.
      const probe = await apiRequest(path, {
        params: { ...extraParams, page: page + 1, limit },
      });
      pagesFetched += 1;
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
