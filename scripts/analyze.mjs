// Computes draft answers for submission.json's `answers` block from the
// files collect.mjs saved into ./data/.
//
// This is written to be READ, not just run. Every question below has a
// short note on the hypothesis it encodes and, where it matters, a
// diagnostic printed to the console so you can eyeball whether the
// hypothesis actually holds for YOUR city's data before trusting the
// number. Question 4 and 9 in particular are graded on precision — do not
// ship this script's first-pass lists without looking at the printed
// samples yourself.
//
// Usage: node scripts/analyze.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

// ---- fill this in from the email you got with your key ----
const ASSIGNED_LOCALITY = "kukatpally";
// -------------------------------------------------------------

const REFERENCE = new Date("2026-09-10T00:00:00+05:30");
const WINDOW_START = new Date(REFERENCE.getTime() - 7 * 24 * 60 * 60 * 1000);

async function loadJSON(name) {
  return JSON.parse(await readFile(path.join(DATA_DIR, name), "utf8"));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------
// Q4 hypothesis: "describes something that cannot exist" = a structural
// impossibility in the record itself, not a judgement call about realism.
// ---------------------------------------------------------------------
const INDIA_LAT = [6, 38];
const INDIA_LNG = [68, 98];

function impossibilityReasons(l) {
  const reasons = [];
  if (typeof l.floor === "number" && typeof l.total_floors === "number" && l.floor > l.total_floors) {
    reasons.push("floor > total_floors");
  }
  if (typeof l.floor === "number" && l.floor < 0) reasons.push("floor < 0");
  if (typeof l.bedroom === "number" && l.bedroom <= 0) reasons.push("bedroom <= 0");
  if (typeof l.bathroom === "number" && l.bathroom <= 0) reasons.push("bathroom <= 0");
  if (typeof l.carpet_area === "number" && l.carpet_area <= 0) reasons.push("carpet_area <= 0");
  if (typeof l.price === "number" && l.price <= 0) reasons.push("price <= 0");
  if (
    typeof l.carpet_area === "number" &&
    typeof l.super_built_up_area === "number" &&
    l.super_built_up_area > 0 &&
    l.carpet_area > l.super_built_up_area
  ) {
    reasons.push("carpet_area > super_built_up_area");
  }
  if (typeof l.latitude === "number" && typeof l.longitude === "number") {
    if (l.latitude < INDIA_LAT[0] || l.latitude > INDIA_LAT[1] || l.longitude < INDIA_LNG[0] || l.longitude > INDIA_LNG[1]) {
      reasons.push("lat/long outside India");
    }
  }
  return reasons;
}

// ---------------------------------------------------------------------
// Q9 hypothesis: lead-gen listings tend to (a) share a contact number
// across many unrelated properties, and/or (b) share verbatim description
// text across many unrelated properties. Real agents legitimately reuse a
// number across ONE project's units — that's not suspicious by itself.
// What's suspicious is the same number/description spanning many
// DIFFERENT apartment names and localities.
// ---------------------------------------------------------------------
function findFakeCandidates(listings) {
  const byContact = new Map();
  const byDescription = new Map();
  for (const l of listings) {
    if (l.posted_by_contact) {
      if (!byContact.has(l.posted_by_contact)) byContact.set(l.posted_by_contact, []);
      byContact.get(l.posted_by_contact).push(l);
    }
    if (l.description) {
      if (!byDescription.has(l.description)) byDescription.set(l.description, []);
      byDescription.get(l.description).push(l);
    }
  }

  const suspiciousContacts = [...byContact.entries()].filter(([, ls]) => {
    const distinctApartments = new Set(ls.map((l) => l.apartment_name)).size;
    const distinctLocalities = new Set(ls.map((l) => l.locality)).size;
    return ls.length >= 8 && distinctApartments >= 5 && distinctLocalities >= 3;
  });

  const suspiciousDescriptions = [...byDescription.entries()].filter(([, ls]) => {
    const distinctApartments = new Set(ls.map((l) => l.apartment_name)).size;
    return ls.length >= 3 && distinctApartments >= 2; // identical text, different properties
  });

  const ids = new Set();
  for (const [, ls] of suspiciousContacts) ls.forEach((l) => ids.add(l.listing_id));
  for (const [, ls] of suspiciousDescriptions) ls.forEach((l) => ids.add(l.listing_id));

  return { ids, suspiciousContacts, suspiciousDescriptions };
}

// ---------------------------------------------------------------------
// Q2 hypothesis: the same physical property gets listed more than once
// (e.g. by more than one website/agent). Try a couple of candidate keys
// and print how many groups collapse under each — pick whichever key
// actually matches how duplication shows up in your city's data (look at
// a few printed groups; a good key should never quietly merge two
// obviously-different units).
// ---------------------------------------------------------------------
function groupBy(listings, keyFn) {
  const groups = new Map();
  for (const l of listings) {
    const key = keyFn(l);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  return groups;
}

function summarizeDuplicateKey(listings, keyFn, label) {
  const groups = groupBy(listings, keyFn);
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  const dupRecords = dupGroups.reduce((s, g) => s + g.length, 0);
  const uniqueCount = groups.size;
  console.log(
    `  [${label}] ${groups.size} distinct groups from ${listings.length} records ` +
      `(${dupGroups.length} groups have duplicates, covering ${dupRecords} records)`
  );
  if (dupGroups.length > 0) {
    const sample = dupGroups[0].map((l) => l.listing_id).join(", ");
    console.log(`    e.g. group of ${dupGroups[0].length}: ${sample}`);
  }
  return { groups, uniqueCount };
}

async function main() {
  const listings = await loadJSON("listings.json");
  const rentals = await loadJSON("rentals.json");
  const projects = await loadJSON("projects.json");

  console.log(`Loaded ${listings.length} listings, ${rentals.length} rentals, ${projects.length} projects.\n`);

  // ---------------- Q1 ----------------
  const total_listing_records = listings.length;
  console.log(`Q1 total_listing_records = ${total_listing_records}`);

  // ---------------- Q3 ----------------
  const hasIsLive = listings.some((l) => "is_live" in l);
  console.log(`\nQ3: does the record carry an "is_live" field? ${hasIsLive}`);
  const active_listings = listings.filter((l) => l.is_live === true).length;
  console.log(`Q3 active_listings (is_live === true) = ${active_listings}`);
  if (!hasIsLive) {
    console.log(
      "  WARNING: no record has an is_live key at all — re-check the field name against a raw sample " +
        "(console.log(listings[0])) before trusting this number."
    );
  }

  // ---------------- Q4 ----------------
  const corrupt = listings
    .map((l) => ({ l, reasons: impossibilityReasons(l) }))
    .filter((x) => x.reasons.length > 0);
  console.log(`\nQ4: ${corrupt.length} structurally impossible records found. Reason breakdown:`);
  const reasonCounts = {};
  for (const { reasons } of corrupt) for (const r of reasons) reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  console.log(" ", reasonCounts);
  const corrupt_listing_ids = corrupt.map((x) => x.l.listing_id).sort();
  console.log("  sample:", corrupt_listing_ids.slice(0, 10));

  // ---------------- Q9 ----------------
  const { ids: fakeIds, suspiciousContacts, suspiciousDescriptions } = findFakeCandidates(listings);
  console.log(`\nQ9: ${suspiciousContacts.length} suspicious contact clusters, ${suspiciousDescriptions.length} suspicious description clusters.`);
  for (const [contact, ls] of suspiciousContacts.slice(0, 5)) {
    console.log(
      `  contact ${contact}: ${ls.length} listings across ${new Set(ls.map((l) => l.apartment_name)).size} apartments / ${new Set(ls.map((l) => l.locality)).size} localities`
    );
  }
  const fake_listing_ids = [...fakeIds].sort();
  console.log(`  -> ${fake_listing_ids.length} candidate fake listing_ids (REVIEW THESE before submitting)`);

  // ---------------- Q2 ----------------
  console.log("\nQ2: trying a few duplicate-property keys —");
  const keyA = (l) => [l.locality, l.apartment_name, l.floor, l.bedroom, l.carpet_area].join("|");
  const keyB = (l) => [l.latitude?.toFixed(4), l.longitude?.toFixed(4), l.floor, l.bedroom].join("|");
  const resA = summarizeDuplicateKey(listings, keyA, "locality+apartment+floor+bedroom+carpet_area");
  const resB = summarizeDuplicateKey(listings, keyB, "lat/long(4dp)+floor+bedroom");
  console.log(
    "  Pick whichever of these (or a refined version) actually matches what you see when you inspect a " +
      "duplicate group by hand — then set unique_properties below accordingly."
  );
  const unique_properties = resA.uniqueCount; // <-- adjust after inspecting the groups above

  // ---------------- Q5 ----------------
  const localityRentals = rentals.filter((r) => (r.locality || "").toLowerCase() === ASSIGNED_LOCALITY);
  const total_monthly_rent = localityRentals.reduce((sum, r) => sum + (r.price || 0), 0);
  console.log(`\nQ5: ${localityRentals.length} rentals in "${ASSIGNED_LOCALITY}", total_monthly_rent = ${total_monthly_rent}`);

  // ---------------- Q6 ----------------
  const excluded = new Set([...corrupt_listing_ids, ...fake_listing_ids]);
  const eligible2bhk = listings.filter(
    (l) => l.is_live === true && l.bedroom === 2 && !excluded.has(l.listing_id) && l.carpet_area > 0
  );
  const ratios = eligible2bhk.map((l) => l.price / l.carpet_area);
  const avg_price_per_sqft_2bhk = ratios.length ? round2(ratios.reduce((a, b) => a + b, 0) / ratios.length) : 0;
  console.log(`\nQ6: ${eligible2bhk.length} eligible 2BHK live listings, avg_price_per_sqft_2bhk = ${avg_price_per_sqft_2bhk}`);

  // ---------------- Q7 ----------------
  let costliest = null;
  for (const p of projects) {
    if (typeof p.price_max !== "number") continue;
    if (!costliest || p.price_max > costliest.price_max) costliest = p;
  }
  const costliest_project = costliest
    ? { project_id: costliest.project_id, price_max_inr: costliest.price_max }
    : { project_id: "", price_max_inr: 0 };
  console.log(`\nQ7 costliest_project =`, costliest_project);

  // ---------------- Q8 ----------------
  console.log(`\nQ8: window [${WINDOW_START.toISOString()}, ${REFERENCE.toISOString()}) (as UTC instants)`);
  // Diagnostic: check posted_at against the server clock we saved from
  // /health at collection time, and eyeball an hour-of-day histogram —
  // both help catch a mislabeled timezone (value is local IST but the
  // string carries a "Z" suffix, or vice versa) before you trust a count
  // that depends entirely on the boundary being right.
  let manifest = null;
  try {
    manifest = await loadJSON("manifest.json");
  } catch {}
  if (manifest?.health) {
    console.log("  /health at collection time:", JSON.stringify(manifest.health));
  }
  const hourHistogram = new Array(24).fill(0);
  for (const l of listings) {
    if (!l.posted_at) continue;
    const d = new Date(l.posted_at);
    if (!Number.isNaN(d.getTime())) hourHistogram[d.getUTCHours()]++;
  }
  console.log("  posted_at hour-of-day histogram (UTC hour -> count):", hourHistogram);
  console.log(
    "  If this bunches suspiciously (e.g. a hard cliff at a particular hour, or activity concentrated " +
      "in what would be the middle of the Indian night if Z really means UTC), posted_at may not be in " +
      "the timezone the docs claim — check a few posted_at values against the /health server clock offset."
  );

  const listings_last_7_days = listings.filter((l) => {
    if (!l.posted_at) return false;
    const d = new Date(l.posted_at);
    return d >= WINDOW_START && d < REFERENCE;
  }).length;
  console.log(`Q8 listings_last_7_days = ${listings_last_7_days}`);

  // ---------------- Q10 ----------------
  const liveByProject = new Map();
  for (const l of listings) {
    if (!l.project_id) continue;
    if (l.is_live === false) continue; // only count live records, matching how a user would see it
    liveByProject.set(l.project_id, (liveByProject.get(l.project_id) || 0) + 1);
  }
  const mismatches = projects.filter((p) => (liveByProject.get(p.project_id) ?? 0) !== p.total_listings);
  console.log(`\nQ10: ${mismatches.length} of ${projects.length} projects have a wrong total_listings.`);
  console.log(
    "  sample:",
    mismatches.slice(0, 5).map((p) => ({
      project_id: p.project_id,
      reported: p.total_listings,
      actual_live: liveByProject.get(p.project_id) ?? 0,
    }))
  );
  const projects_with_wrong_listing_count = mismatches.length;

  const answers = {
    total_listing_records,
    unique_properties,
    active_listings,
    corrupt_listing_ids,
    total_monthly_rent,
    avg_price_per_sqft_2bhk,
    costliest_project,
    listings_last_7_days,
    fake_listing_ids,
    projects_with_wrong_listing_count,
  };

  await writeFile(path.join(DATA_DIR, "draft_answers.json"), JSON.stringify(answers, null, 2));
  console.log("\nWrote data/draft_answers.json — review every WARNING above, then copy the reviewed");
  console.log("values into submission.json (don't paste this blindly, especially Q2/Q4/Q9).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
