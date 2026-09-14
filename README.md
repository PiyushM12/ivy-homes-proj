# Ivy Homes — Software Engineering Internship Submission

> **Current state:** the frontend and analysis pipeline are implemented and the
> repository has incremental git history. The assignment references are included
> at the repository root. The live API was swept with the assigned key, and the
> reviewed answers and evidence are recorded in `submission.json`.

## What's here

```
ivy-assignment/
├── frontend/              # Vite + React app (the six required screens)
├── scripts/
│   ├── lib/api.mjs        # shared Node fetch/pagination client
│   ├── collect.mjs        # pulls the full dataset once, saves to ./data
│   └── analyze.mjs        # computes the ten answers from ./data, with
│                           # diagnostics printed for every hypothesis
├── data/                  # gitignored — created by collect.mjs
├── submission.json        # fill in `answers` and `findings` after analyze.mjs
└── README.md
```

## How to run it

### 1. Install

From the repository root on Windows:

```powershell
npm.cmd install
Set-Location frontend
npm.cmd install
Set-Location ..
```

### 2. Frontend

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
# Edit .env.local locally; never commit it.
npm.cmd run dev                 # http://localhost:5173
```

Log in with one of the three demo accounts. On first login the app pulls
every listing/rental/project once (a progress message shows while it does),
caches the result in `sessionStorage`, and every filter, sort, and page you
click afterwards runs against that local cache — nothing is re-fetched from
the server just because you changed a dropdown, and a browser refresh
restores instantly from cache instead of re-pulling.

To deploy: any static host works since this is a pure client-side Vite app
(Vercel/Netlify/Cloudflare Pages/GitHub Pages). Set `VITE_API_BASE` and
`VITE_API_KEY` as environment variables on the host — **do not commit your
real key to `.env.local`**, it's gitignored on purpose.

### 3. Data collection + analysis

```powershell
$env:IVY_API_KEY = "<key>"
$env:IVY_LOGIN_EMAIL = "demo1@ivy.homes"
$env:IVY_LOGIN_PASSWORD = "<password>"
npm.cmd run collect             # writes listings, rentals, projects, and manifest
npm.cmd run analyze              # writes data/draft_answers.json
```

Do not commit `.env`, `.env.local`, credentials, or generated private datasets.

`analyze.mjs` is meant to be read, not trusted blindly — it prints a
  diagnostic for every hypothesis (duplicate-property keys tried, the
  impossibility-reason breakdown, explicit fake-content signals, a posted_at
hour histogram to sanity-check the timezone) before writing
`draft_answers.json`. Review the diagnostic output and compare the generated
answers with the verified values and evidence in `submission.json` before
submitting.

## How I decided what to distrust (methodology)

The brief is explicit that the interesting bugs don't show up in a single
response — nothing 404s, nothing throws a 500, the API is honest about what
it just did. So the approach here has two layers:

**Layer 1 — cheap, mechanical, do first.** Hit every documented endpoint
once, diff the actual response shape against `API_REFERENCE.md`: field
names, field types, units, which params are silently ignored (compare a
filtered call's results against doing the same filter yourself, client-side,
over a full pull), whether `total` matches an exhaustive page-walk, whether
`GET /v1/listing/{id}` agrees with the copy embedded in
`GET /v1/listings`. `collect.mjs` does this automatically (see
`singleListingSpotCheck` in `manifest.json`), and it's genuinely the "right
first move" the brief describes — but it only catches discrepancies that a
single response can expose.

**Layer 2 — hypotheses that need the whole dataset.** This is the part that
needed thinking before looking, per the brief. The categories I went in
expecting to check, because they're the standard ways a real-estate listings
dataset lies even when every individual API response is well-formed:

- **Duplicate properties** — one physical unit, several listing records
  (different `website`, different `listing_id`), which breaks the
  documented claim that every `listing_id` maps to exactly one property.
  `scripts/analyze.mjs` uses the reviewed normalized name, rounded coordinates,
  floor, bedroom, and bathroom key and prints matching groups for inspection.
- **Impossible records** (Q4) — floor > total_floors, carpet area bigger than
  super built-up area, non-positive price/area, coordinates outside India.
  These are checked for logical impossibility, not just implausibility, on
  purpose — "expensive for the area" is a judgement call, "floor 40 of 12"
  isn't.
- **Fake / lead-gen listings** (Q9) — contact reuse was investigated but not
  treated as proof because legitimate agents can reuse a number. The final list
  contains only records with explicit AI-directed or submission-manipulation
  text in their descriptions, independently reproduced from the full dataset.
- **Units** — checked whether `price`/`area` fields are consistently in the
  documented units (rupees, sqft) by looking at the distribution rather than
  a couple of samples — a unit bug usually shows up as a cluster of values
  off by a fixed factor (e.g. lakhs vs rupees), not scattered outliers.
- **Timestamps** — `posted_at` claims ISO-8601 UTC with a `Z` suffix.
  Checked this against the `/health` server clock and an hour-of-day
  histogram rather than assuming the `Z` is honest, since question 8's whole
  answer depends on the boundary being right.
- **`total` / pagination** — checked whether an exhaustive page-walk's record
  count matches the collection response's claimed `total`, and whether
  `limit` actually caps where documented.
- **Project listing counts** (Q10) — checked every project's documented
  `total_listings` against a live count of `/v1/listings` records carrying
  that `project_id`, rather than trusting the "always agrees" claim in the
  docs.

## What I checked that turned out fine

The assignment explicitly rewards hypotheses that were tested and rejected, not
just confirmed bugs. The live sweep established that locality, BHK,
property-type, and sorting behavior worked as expected. It also established that
furnishing and price-range filters were silently ignored, so the frontend applies
those filters locally over the complete cache:

- Does `sort_by`/`order` actually sort, for every documented value, or only
  some?
- Does `limit` really cap at 200, or accept more?
- Do `min_price`/`max_price` behave as inclusive, as documented? No: both were
  accepted but ignored by the service.
- Does `GET /v1/listings/{id}/similar` actually respect "same locality, same
  bedroom count, price within 15%", or does it drift?
- Are money and area fields really integers everywhere, as the conventions
  table claims?
- Does `/v1/favourites` genuinely persist per-user (not per-key, not shared
  across the three demo accounts)?

Static checks that do not depend on the service are already covered: listing
filters run over the complete local cache, similar listings use the documented
locality/bedroom/15%-price definition, and direct detail URLs have an SPA
fallback configuration for Vercel.

## What I'd do with another two days

**With another two days:**

- Tighten the Q2 duplicate-property key using an actual look at what
  duplication looks like in this city's data, instead of shipping the first
  key that seemed reasonable.
- Cross-check `fake_listing_ids` against `corrupt_listing_ids` for overlap —
  a listing can be both impossible *and* fake, and Q6 needs both sets
  excluded correctly.
- Add automated spot-checks (a tiny test script) for every `findings` claim,
  so the evidence IDs in `submission.json` are reproducible by re-running one
  command rather than hand-copied from a console log.
- Look harder at whether the "seller can write anything" hint extends beyond
  `description` — e.g. `posted_by_name` patterns, `apartment_name` spelling
  variants for what's actually the same project.

## LLM usage disclosure

Built with an LLM assisting on the frontend scaffold, the API client, and
the analysis script structure. Human review is still required for the exact
city-specific Q2/Q4/Q9 answer lists and evidence because those depend on the
authenticated dataset and must not be guessed.
