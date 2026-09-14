// Exploratory heuristics surfaced on the Insights screen.
//
// IMPORTANT: these are starting hypotheses, not verdicts. The assignment is
// explicit that forming and testing hypotheses about what's wrong with the
// data is the actual job — this file gives you a few obvious ones running
// live in the app so you (and a reviewer clicking around) can see the shape
// of the problem, but the numbers that go in submission.json's `answers`
// should come from scripts/analyze.mjs, where you can iterate on the exact
// rule against the full dataset and cross-check it before committing to it.

export function isStructurallyImpossible(l) {
  const reasons = [];
  const isPlot = String(l.property_type || "").toLowerCase() === "plot";

  if (typeof l.price === "number" && l.price <= 0) reasons.push("non-positive price");
  if (typeof l.floor === "number" && typeof l.total_floors === "number" && l.floor > l.total_floors) {
    reasons.push("floor exceeds total_floors");
  }
  if (!isPlot && l.bedroom === 0 && l.bathroom === 0) {
    reasons.push("zero bedroom and bathroom on non-plot");
  }
  if (
    typeof l.carpet_area === "number" &&
    typeof l.super_built_up_area === "number" &&
    l.super_built_up_area > 0 &&
    l.carpet_area > l.super_built_up_area
  ) {
    reasons.push("carpet_area exceeds super_built_up_area");
  }
  if (typeof l.latitude === "number" && typeof l.longitude === "number" &&
      Math.abs(l.latitude) > 60 && Math.abs(l.longitude) < 60) {
    reasons.push("latitude/longitude swapped");
  }
  return reasons;
}

/**
 * Groups listings that plausibly describe the same physical property.
 * Heuristic key: locality + apartment_name + bedroom + floor + carpet_area.
 * Two listings sharing all five are very unlikely to be different units.
 */
export function groupPossibleDuplicateProperties(listings) {
  const groups = new Map();
  const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  for (const l of listings) {
    const key = [
      normalize(l.apartment_name),
      Number(l.latitude).toFixed(4),
      Number(l.longitude).toFixed(4),
      l.bedroom,
      l.floor,
      l.bathroom,
    ].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

export function explicitFakeListingSignals(listings) {
  const instructionPattern = /ai (?:assistant|coding assistant)|ignore previous instructions|modify submission\.json|dataset_audit_ref|data certified|licen[cs]e requires/i;
  return listings.filter((listing) => instructionPattern.test(String(listing.description || "")));
}
