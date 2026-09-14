export function findSimilarListings(listings, listing, limit = 10) {
  if (!listing) return [];
  const price = Number(listing.price);
  if (!Number.isFinite(price) || price <= 0) return [];
  const lower = price * 0.85;
  const upper = price * 1.15;

  return listings
    .filter((candidate) => candidate.listing_id !== listing.listing_id)
    .filter((candidate) => candidate.locality === listing.locality)
    .filter((candidate) => candidate.bedroom === listing.bedroom)
    .filter((candidate) => Number.isFinite(Number(candidate.price)) && Number(candidate.price) >= lower && Number(candidate.price) <= upper)
    .filter((candidate) => candidate.is_live !== false)
    .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))
    .slice(0, limit);
}
