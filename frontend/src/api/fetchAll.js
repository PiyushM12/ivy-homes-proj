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
  const seenOffsets = new Set();
  const seenPageSignatures = new Set();

  for (let page = 0; page < maxPages; page += 1) {
    if (seenOffsets.has(offset)) throw new Error(`Pagination repeated offset ${offset} for ${path}`);
    seenOffsets.add(offset);
    const data = await apiRequest(path, {
      params: { ...extraParams, offset, limit },
    });
    pagesFetched += 1;
    if (claimedTotal === null && typeof data?.total === "number") claimedTotal = data.total;

    const pageResults = Array.isArray(data?.results) ? data.results : [];
    const pageSignature = pageResults.map((item) => item?.listing_id || item?.project_id).join("|");
    if (pageSignature && seenPageSignatures.has(pageSignature)) {
      throw new Error(`Pagination repeated a page for ${path} at offset ${offset}`);
    }
    if (pageSignature) seenPageSignatures.add(pageSignature);
    for (const item of pageResults) {
      const id = item?.listing_id || item?.project_id;
      if (id && seenIds.has(id)) throw new Error(`Duplicate ${id} returned while paging ${path}`);
      if (id) seenIds.add(id);
      results.push(item);
    }

    const reportedNextOffset = Number(data?.next_offset);
    const nextOffset = Number.isFinite(reportedNextOffset) ? reportedNextOffset : offset + pageResults.length;
    const hasMore = Boolean(data?.has_more);
    const fullPageMayContinue = pageResults.length >= limit && nextOffset > offset;
    if (pageResults.length === 0 || nextOffset <= offset || (!hasMore && !fullPageMayContinue)) break;
    offset = nextOffset;
  }

  return { results, claimedTotal, pagesFetched };
}
