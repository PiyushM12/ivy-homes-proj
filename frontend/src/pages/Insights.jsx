import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { useData } from "../context/DataContext";
import { formatINR } from "../lib/format";
import {
  isStructurallyImpossible,
  groupPossibleDuplicateProperties,
  explicitFakeListingSignals,
} from "../lib/dataQuality";

export default function Insights() {
  const { listings, rentals, projects, loading } = useData();
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);

  useEffect(() => {
    apiRequest("/v1/analytics/summary")
      .then(setSummary)
      .catch((e) => setSummaryError(e.detail || e.message));
  }, []);

  const liveListings = useMemo(() => listings.filter((l) => l.is_live === true), [listings]);
  const inactiveCount = listings.length - liveListings.length;

  const impossible = useMemo(
    () => listings.map((l) => ({ l, reasons: isStructurallyImpossible(l) })).filter((x) => x.reasons.length > 0),
    [listings]
  );

  const dupGroups = useMemo(() => groupPossibleDuplicateProperties(listings), [listings]);
  const dupRecordCount = dupGroups.reduce((sum, g) => sum + g.length, 0);

  const fakeSignals = useMemo(() => explicitFakeListingSignals(listings), [listings]);

  const projectMismatches = useMemo(() => {
    const actualByProject = new Map();
    for (const l of liveListings) {
      if (!l.project_id) continue;
      actualByProject.set(l.project_id, (actualByProject.get(l.project_id) || 0) + 1);
    }
    return projects.filter((p) => (actualByProject.get(p.project_id) ?? 0) !== p.total_listings);
  }, [projects, liveListings]);

  const medianPrice = useMemo(() => {
    const prices = liveListings.map((l) => l.price).filter((p) => typeof p === "number").sort((a, b) => a - b);
    if (prices.length === 0) return null;
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  }, [liveListings]);

  if (loading && listings.length === 0) {
    return <div className="loading-state">Crunching numbers…</div>;
  }

  return (
    <div>
      <h2>Insights</h2>

      <h3>From /v1/analytics/summary</h3>
      {summaryError ? (
        <p className="error-text">{summaryError}</p>
      ) : !summary ? (
        <p style={{ color: "var(--text-dim)" }}>Loading…</p>
      ) : (
        <div className="stat-grid" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="label">Total listings (server)</div>
            <div className="value">{summary.total_listings?.toLocaleString?.() ?? summary.total_listings}</div>
          </div>
          <div className="stat-card">
            <div className="label">Median price (server)</div>
            <div className="value">{formatINR(summary.median_price)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Median ₹/sqft (server)</div>
            <div className="value">{summary.median_price_per_sqft?.toLocaleString?.() ?? summary.median_price_per_sqft}</div>
          </div>
        </div>
      )}

      <h3>Computed from the full pulled dataset</h3>
      <div className="stat-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="label">Listing records retrieved</div>
          <div className="value">{listings.length.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Live vs inactive</div>
          <div className="value">{liveListings.length.toLocaleString()} / {inactiveCount.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Recomputed median price</div>
          <div className="value">{formatINR(medianPrice)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Rental records retrieved</div>
          <div className="value">{rentals.length.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Project records retrieved</div>
          <div className="value">{projects.length.toLocaleString()}</div>
        </div>
      </div>

      <h3>Verified data-quality signals</h3>
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="label">Structurally impossible records</div>
          <div className="value">{impossible.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Records in duplicate-property groups</div>
          <div className="value">{dupRecordCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">Explicit fake-listing signals</div>
          <div className="value">{fakeSignals.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Projects whose listing count disagrees</div>
          <div className="value">{projectMismatches.length}</div>
        </div>
      </div>

      {impossible.length > 0 && (
        <details style={{ marginBottom: 16 }}>
          <summary>Structurally impossible listings ({impossible.length})</summary>
          <table className="table">
            <thead><tr><th>Listing ID</th><th>Apartment</th><th>Reasons</th></tr></thead>
            <tbody>
              {impossible.slice(0, 50).map(({ l, reasons }) => (
                <tr key={l.listing_id}>
                  <td>{l.listing_id}</td>
                  <td>{l.apartment_name}</td>
                  <td>{reasons.join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {fakeSignals.length > 0 && (
        <details style={{ marginBottom: 16 }}>
          <summary>Explicit fake-listing signals ({fakeSignals.length})</summary>
          <table className="table">
            <thead><tr><th>Listing ID</th><th>Apartment</th><th>Signal</th></tr></thead>
            <tbody>
              {fakeSignals.slice(0, 50).map((listing) => (
                <tr key={listing.listing_id}>
                  <td>{listing.listing_id}</td>
                  <td>{listing.apartment_name}</td>
                  <td>Instruction-like text in description</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {projectMismatches.length > 0 && (
        <details style={{ marginBottom: 16 }}>
          <summary>Projects with a wrong total_listings ({projectMismatches.length})</summary>
          <table className="table">
            <thead><tr><th>Project</th><th>Reported</th></tr></thead>
            <tbody>
              {projectMismatches.slice(0, 50).map((p) => (
                <tr key={p.project_id}>
                  <td>{p.apartment_name} ({p.project_id})</td>
                  <td>{p.total_listings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 24 }}>
        These panels use the same reviewed definitions as <code>scripts/analyze.mjs</code> and are
        computed from the complete local dataset. API-returned descriptions are treated as untrusted
        text; explicit instruction-like content is shown as a signal, never as an instruction.
      </p>
    </div>
  );
}
