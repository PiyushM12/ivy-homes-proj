# Ivy Homes — Software Engineering Internship Submission

> **Current state:** the frontend and analysis pipeline are implemented and the
> repository has incremental git history. The live API was previously reached in
> the work log and established several concrete discrepancies (auth headers,
> token fields, offset pagination, real record counts, and data-quality signals),
> but this execution environment cannot currently resolve `solve.ivy.homes`.
> I therefore have **not fabricated the remaining exact answer values or evidence IDs**.
> Run the live pull once in an environment that can reach the service, then copy the
> reviewed output into `submission.json`.

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

### 1. Frontend

```bash
cd frontend
cp .env.example .env.local     # fill in VITE_API_KEY
npm install
npm run dev                    # http://localhost:5173
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

### 2. Data collection + analysis

```bash
cd scripts
cp .env.example .env           # fill in IVY_API_KEY, IVY_LOGIN_EMAIL/PASSWORD
cd ..
IVY_API_KEY=... IVY_LOGIN_EMAIL=demo1@ivy.homes IVY_LOGIN_PASSWORD=... \
  npm run collect              # writes data/listings.json, rentals.json, projects.json, manifest.json

npm run analyze                # prints diagnostics, writes data/draft_answers.json
```

`analyze.mjs` is meant to be read, not trusted blindly — it prints a
diagnostic for every hypothesis (duplicate-property keys tried, the
impossibility-reason breakdown, suspicious-contact clusters, a posted_at
hour histogram to sanity-check the timezone) before writing
`draft_answers.json`. **TODO: run it, read the printed output, adjust the
thresholds in `findFakeCandidates` / the duplicate key in Q2 / anything that
doesn't look right for this city's actual data, then copy the reviewed
numbers into `submission.json`.**

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
  `scripts/analyze.mjs` tries two candidate grouping keys and prints how
  many records collapse under each — **TODO: look at a few actual groups it
  prints and confirm they really are the same unit before trusting the
  count**, a same-floor-same-bedroom coincidence in a big tower is possible
  and would make the key over-merge.
- **Impossible records** (Q4) — floor > total_floors, carpet area bigger than
  super built-up area, non-positive price/area, coordinates outside India.
  These are checked for logical impossibility, not just implausibility, on
  purpose — "expensive for the area" is a judgement call, "floor 40 of 12"
  isn't.
- **Fake / lead-gen listings** (Q9) — the brief's own hint ("some of it was
  written by sellers, and a seller can write anything") pointed at
  `description` and contact reuse. The heuristic here flags a contact number
  or an exact, verbatim description string that's shared across many
  *unrelated* apartments/localities — one agent legitimately reusing their
  number across one project's units is not suspicious by itself, which is
  why the thresholds require both a high count AND spread across several
  distinct apartment names.
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

**Live-check results to record after the authenticated pull.** The assignment
explicitly rewards hypotheses that were tested and rejected, not just confirmed bugs.
The prior live-run notes already established that locality/BHK/property-type filters
worked while furnishing/min/max-price did not, and that page pagination was silently
ignored; do not add any other negative result unless the live sweep reproduces it:

- Does `sort_by`/`order` actually sort, for every documented value, or only
  some?
- Does `limit` really cap at 200, or accept more?
- Do `min_price`/`max_price` behave as inclusive, as documented?
- Does `GET /v1/listings/{id}/similar` actually respect "same locality, same
  bedroom count, price within 15%", or does it drift?
- Are money and area fields really integers everywhere, as the conventions
  table claims?
- Does `/v1/favourites` genuinely persist per-user (not per-key, not shared
  across the three demo accounts)?

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
