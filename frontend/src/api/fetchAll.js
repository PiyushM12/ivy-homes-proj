import { apiRequest } from "./client";

/**
 * The running API paginates with offset/has_more. The documented page/limit
 * contract is not reliable, so this intentionally follows what the server
 * actually returns and de-duplicates offsets defensively.
 */
export async function fetchAllPages(path, extraParams = {}, opts = {}) {
  const limit = Math.min(opts.limit ?? 50, 50);
  const maxPages = opts.maxPages ?? 1000;
  const results = [];
  const seenIds = new Set();
  let claimedTotal = null;
  let offset = 0;
  let pagesFetched = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const data = await apiRequest(path, {
      params: { ...extraParams, offset, limit },
    });
    pagesFetched += 1;
    if (claimedTotal === null && typeof data?.total === "number") claimedTotal = data.total;

    const pageResults = Array.isArray(data?.results) ? data.results : [];
    for (const item of pageResults) {
      const id = item?.listing_id || item?.project_id;
      if (id && seenIds.has(id)) continue;
      if (id) seenIds.add(id);
      results.push(item);
    }

    const nextOffset = Number.isFinite(data?.next_offset) ? data.next_offset : offset + pageResults.length;
    const hasMore = Boolean(data?.has_more);
    if (!hasMore || pageResults.length === 0 || nextOffset <= offset) break;
    offset = nextOffset;
  }

  return { results, claimedTotal, pagesFetched };
}
