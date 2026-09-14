// Pulls the full dataset your key can see, once, and saves it to disk so
// analyze.mjs (and any exploration you do in a notebook/REPL) works against
// a stable local snapshot instead of hammering the API every time you tweak
// a hypothesis.
//
// Usage:
//   IVY_API_KEY=... IVY_LOGIN_EMAIL=demo1@ivy.homes IVY_LOGIN_PASSWORD=... node scripts/collect.mjs
// or put those in scripts/.env and use a loader (dotenv, or `node --env-file`).

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { login, apiGet, fetchAllPages } from "./lib/api.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  console.log("→ GET /health (before anything else, as a sanity + clock check)");
  const health = await apiGet("/health").catch((e) => ({ error: String(e) }));
  console.log("  ", JSON.stringify(health));

  const email = process.env.IVY_LOGIN_EMAIL;
  const password = process.env.IVY_LOGIN_PASSWORD;
  if (!email || !password) {
    console.error("Set IVY_LOGIN_EMAIL and IVY_LOGIN_PASSWORD.");
    process.exit(1);
  }

  console.log(`→ POST /auth/login as ${email}`);
  const loginData = await login(email, password);
  console.log("  logged in as", loginData.user?.email, "expires_in", loginData.expires_in);

  console.log("→ pulling /v1/listings to exhaustion…");
  const listings = await fetchAllPages("/v1/listings");
  console.log(
    `   got ${listings.results.length} records over ${listings.pagesFetched} pages (server claimed total: ${listings.claimedTotal})`
  );

  console.log("→ pulling /v1/rentals to exhaustion…");
  const rentals = await fetchAllPages("/v1/rentals");
  console.log(
    `   got ${rentals.results.length} records over ${rentals.pagesFetched} pages (server claimed total: ${rentals.claimedTotal})`
  );

  console.log("→ pulling /v1/projects to exhaustion…");
  const projects = await fetchAllPages("/v1/projects");
  console.log(
    `   got ${projects.results.length} records over ${projects.pagesFetched} pages (server claimed total: ${projects.claimedTotal})`
  );

  console.log("→ GET /v1/analytics/summary");
  const analyticsSummary = await apiGet("/v1/analytics/summary").catch((e) => ({ error: String(e) }));

  // Spot-check: does a single listing's dedicated endpoint agree with its
  // copy inside the collection endpoint? Worth checking once here rather
  // than assuming — any mismatch is a `consistency` finding.
  let singleListingSpotCheck = null;
  if (listings.results.length > 0) {
    const sample = listings.results[0];
    const single = await apiGet(`/v1/listing/${sample.listing_id}`).catch((e) => ({ error: String(e) }));
    singleListingSpotCheck = { listing_id: sample.listing_id, fromCollection: sample, fromSingleEndpoint: single };
  }

  await writeFile(path.join(DATA_DIR, "listings.json"), JSON.stringify(listings.results, null, 2));
  await writeFile(path.join(DATA_DIR, "rentals.json"), JSON.stringify(rentals.results, null, 2));
  await writeFile(path.join(DATA_DIR, "projects.json"), JSON.stringify(projects.results, null, 2));
  await writeFile(path.join(DATA_DIR, "analytics_summary.json"), JSON.stringify(analyticsSummary, null, 2));
  await writeFile(
    path.join(DATA_DIR, "manifest.json"),
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        health,
        listings: {
          count: listings.results.length,
          claimedTotal: listings.claimedTotal,
          pagesFetched: listings.pagesFetched,
        },
        rentals: {
          count: rentals.results.length,
          claimedTotal: rentals.claimedTotal,
          pagesFetched: rentals.pagesFetched,
        },
        projects: {
          count: projects.results.length,
          claimedTotal: projects.claimedTotal,
          pagesFetched: projects.pagesFetched,
        },
        singleListingSpotCheck,
      },
      null,
      2
    )
  );

  console.log("\nSaved to ./data/. Run `node scripts/analyze.mjs` next.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
