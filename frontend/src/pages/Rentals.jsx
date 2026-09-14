import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { formatINR, formatArea, titleCase } from "../lib/format";

const PAGE_SIZE = 24;

export default function Rentals() {
  const { rentals, loading, progress, error, meta } = useData();
  const [locality, setLocality] = useState("");
  const [bhk, setBhk] = useState("");
  const [furnishing, setFurnishing] = useState("");
  const [page, setPage] = useState(1);

  const localities = useMemo(
    () => [...new Set(rentals.map((r) => r.locality).filter(Boolean))].sort(),
    [rentals]
  );
  const furnishings = useMemo(
    () => [...new Set(rentals.map((r) => r.furnishing).filter(Boolean))].sort(),
    [rentals]
  );

  const filtered = useMemo(() => {
    let out = rentals;
    if (locality) out = out.filter((r) => r.locality === locality);
    if (bhk) out = out.filter((r) => String(r.bedroom) === String(bhk));
    if (furnishing) out = out.filter((r) => r.furnishing === furnishing);
    return out;
  }, [rentals, locality, bhk, furnishing]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading && rentals.length === 0) {
    return <div className="loading-state">{progress || "Loading rentals…"}</div>;
  }
  if (error) return <div className="card error-text">{error}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Rentals</h2>
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
          {filtered.length} of {rentals.length} loaded
          {meta.rentalsClaimedTotal !== null && ` (server reports total: ${meta.rentalsClaimedTotal})`}
        </span>
      </div>

      <div className="filters">
        <div className="field">
          <label>Locality</label>
          <select value={locality} onChange={(e) => { setLocality(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {localities.map((l) => (
              <option key={l} value={l}>{titleCase(l)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Bedrooms</label>
          <select value={bhk} onChange={(e) => { setBhk(e.target.value); setPage(1); }}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} BHK</option>)}
          </select>
        </div>
        <div className="field">
          <label>Furnishing</label>
          <select value={furnishing} onChange={(e) => { setFurnishing(e.target.value); setPage(1); }}>
            <option value="">Any</option>
            {furnishings.map((f) => <option key={f} value={f}>{titleCase(f)}</option>)}
          </select>
        </div>
      </div>

      {pageItems.length === 0 ? (
        <div className="empty-state">No rentals match these filters.</div>
      ) : (
        <div className="grid">
          {pageItems.map((r) => (
            <div key={r.listing_id} className="listing-card">
              <div className="badges">
                <span className="badge">{titleCase(r.property_type)}</span>
                <span className="badge">{r.bedroom} BHK</span>
              </div>
              <div className="price">{formatINR(r.price)}/mo</div>
              <div className="title">{r.apartment_name || r.title}</div>
              <div className="meta">
                {titleCase(r.locality)} · {formatArea(r.carpet_area)}
              </div>
              <div className="meta">Deposit: {formatINR(r.deposit)}</div>
              {r.listing_url && (
                <a href={r.listing_url} target="_blank" rel="noreferrer">
                  View on {r.website} ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pagination">
        <button className="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button className="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
