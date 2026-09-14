// Exploratory heuristics surfaced on the Insights screen.
//
// IMPORTANT: these are starting hypotheses, not verdicts. The assignment is
// explicit that forming and testing hypotheses about what's wrong with the
// data is the actual job — this file gives you a few obvious ones running
// live in the app so you (and a reviewer clicking around) can see the shape
// of the problem, but the numbers that go in submission.json's `answers`
// should come from scripts/analyze.mjs, where you can iterate on the exact
// rule against the full dataset and cross-check it before committing to it.

// Rough India bounding box — anything outside this is not just "wrong
// locality", it's not in the country.
const INDIA_LAT = [6, 38];
const INDIA_LNG = [68, 98];

export function isGeoImpossible(l) {
  if (typeof l.latitude !== "number" || typeof l.longitude !== "number") return false;
  return (
    l.latitude < INDIA_LAT[0] ||
    l.latitude > INDIA_LAT[1] ||
    l.longitude < INDIA_LNG[0] ||
    l.longitude > INDIA_LNG[1]
  );
}

export function isStructurallyImpossible(l) {
  const reasons = [];
  if (typeof l.floor === "number" && typeof l.total_floors === "number" && l.floor > l.total_floors) {
    reasons.push("floor exceeds total_floors");
  }
  if (typeof l.bedroom === "number" && l.bedroom <= 0) reasons.push("bedroom <= 0");
  if (typeof l.carpet_area === "number" && l.carpet_area <= 0) reasons.push("carpet_area <= 0");
  if (typeof l.price === "number" && l.price <= 0) reasons.push("price <= 0");
  if (
    typeof l.carpet_area === "number" &&
    typeof l.super_built_up_area === "number" &&
    l.super_built_up_area > 0 &&
    l.carpet_area > l.super_built_up_area
  ) {
    reasons.push("carpet_area exceeds super_built_up_area");
  }
  if (isGeoImpossible(l)) reasons.push("lat/long outside India");
  return reasons;
}

/**
 * Groups listings that plausibly describe the same physical property.
 * Heuristic key: locality + apartment_name + bedroom + floor + carpet_area.
 * Two listings sharing all five are very unlikely to be different units.
 */
export function groupPossibleDuplicateProperties(listings) {
  const groups = new Map();
  for (const l of listings) {
    const key = [
      (l.locality || "").toLowerCase(),
      (l.apartment_name || "").toLowerCase(),
      l.bedroom,
      l.floor,
      l.carpet_area,
    ].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/**
 * Contact numbers reused across an unusual number of listings that don't
 * look like the same project. A busy agent legitimately reuses their number;
 * the same number on wildly different apartment names/localities is the
 * pattern worth a closer look.
 */
export function suspiciousContactReuse(listings, minCount = 8) {
  const byContact = new Map();
  for (const l of listings) {
    const c = l.posted_by_contact;
    if (!c) continue;
    if (!byContact.has(c)) byContact.set(c, []);
    byContact.get(c).push(l);
  }
  return [...byContact.entries()]
    .filter(([, ls]) => ls.length >= minCount)
    .map(([contact, ls]) => ({
      contact,
      count: ls.length,
      distinctApartments: new Set(ls.map((l) => l.apartment_name)).size,
      distinctLocalities: new Set(ls.map((l) => l.locality)).size,
      listings: ls,
    }));
}
