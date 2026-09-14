import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import ListingCard from "../components/ListingCard";
import { titleCase } from "../lib/format";

const PAGE_SIZE = 24;

export default function Listings() {
  const { listings, loading, progress, error, meta, fetchedAt, refetch } = useData();

  const [locality, setLocality] = useState("");
  const [bhk, setBhk] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [furnishing, setFurnishing] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("posted_at");
  const [order, setOrder] = useState("desc");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);

  const localities = useMemo(
    () => [...new Set(listings.map((l) => l.locality).filter(Boolean))].sort(),
    [listings]
  );
  const propertyTypes = useMemo(
    () => [...new Set(listings.map((l) => l.property_type).filter(Boolean))].sort(),
    [listings]
  );
  const furnishings = useMemo(
    () => [...new Set(listings.map((l) => l.furnishing).filter(Boolean))].sort(),
    [listings]
  );

  const filtered = useMemo(() => {
    let out = listings;

    // The docs claim /v1/listings only ever returns active listings. Don't
    // take that on faith — if records carry an is_live flag, respect it by
    // default here (this is the field the assignment's own question #3
    // names), while still letting you flip it off to see everything.
    if (!showInactive) {
      out = out.filter((l) => l.is_live === true);
    }

    if (locality) out = out.filter((l) => l.locality === locality);
    if (bhk) out = out.filter((l) => String(l.bedroom) === String(bhk));
    if (propertyType) out = out.filter((l) => l.property_type === propertyType);
    if (furnishing) out = out.filter((l) => l.furnishing === furnishing);
    if (minPrice) out = out.filter((l) => typeof l.price === "number" && l.price >= Number(minPrice));
    if (maxPrice) out = out.filter((l) => typeof l.price === "number" && l.price <= Number(maxPrice));

    const dir = order === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const av = a[sortBy === "bedroom" ? "bedroom" : sortBy];
      const bv = b[sortBy === "bedroom" ? "bedroom" : sortBy];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      return av > bv ? dir : -dir;
    });

    return out;
  }, [listings, locality, bhk, propertyType, furnishing, minPrice, maxPrice, sortBy, order, showInactive]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage(setter) {
    return (v) => {
      setter(v);
      setPage(1);
    };
  }

  if (loading && listings.length === 0) {
    return <div className="loading-state">{progress || "Loading listings…"}</div>;
  }

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
        <button className="secondary" onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Listings</h2>
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
          {filtered.length} of {listings.length} loaded
          {meta.listingsClaimedTotal !== null && ` (server reports total: ${meta.listingsClaimedTotal})`}
          {fetchedAt && ` · refreshed ${new Date(fetchedAt).toLocaleTimeString()}`}
        </span>
      </div>

      <div className="filters">
        <div className="field">
          <label>Locality</label>
          <select value={locality} onChange={(e) => resetPage(setLocality)(e.target.value)}>
            <option value="">All</option>
            {localities.map((l) => (
              <option key={l} value={l}>
                {titleCase(l)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Bedrooms</label>
          <select value={bhk} onChange={(e) => resetPage(setBhk)(e.target.value)}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} BHK
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Type</label>
          <select value={propertyType} onChange={(e) => resetPage(setPropertyType)(e.target.value)}>
            <option value="">Any</option>
            {propertyTypes.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Furnishing</label>
          <select value={furnishing} onChange={(e) => resetPage(setFurnishing)(e.target.value)}>
            <option value="">Any</option>
            {furnishings.map((f) => (
              <option key={f} value={f}>
                {titleCase(f)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Min price (₹)</label>
          <input type="number" value={minPrice} onChange={(e) => resetPage(setMinPrice)(e.target.value)} placeholder="0" />
        </div>

        <div className="field">
          <label>Max price (₹)</label>
          <input type="number" value={maxPrice} onChange={(e) => resetPage(setMaxPrice)(e.target.value)} placeholder="Any" />
        </div>

        <div className="field">
          <label>Sort by</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="posted_at">Date posted</option>
            <option value="price">Price</option>
            <option value="carpet_area">Carpet area</option>
            <option value="bedroom">Bedrooms</option>
          </select>
        </div>

        <div className="field">
          <label>Order</label>
          <select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => resetPage(setShowInactive)(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Include inactive
          </label>
        </div>
      </div>

      {pageItems.length === 0 ? (
        <div className="empty-state">No listings match these filters.</div>
      ) : (
        <div className="grid">
          {pageItems.map((l) => (
            <ListingCard key={l.listing_id} listing={l} />
          ))}
        </div>
      )}

      <div className="pagination">
        <button className="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          ← Prev
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button className="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}
