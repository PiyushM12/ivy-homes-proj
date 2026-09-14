import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useData } from "../context/DataContext";
import { useFavourites } from "../context/FavouritesContext";
import ListingCard from "../components/ListingCard";
import { formatINR, formatArea, formatDate, titleCase } from "../lib/format";
import { isStructurallyImpossible } from "../lib/dataQuality";

export default function ListingDetail() {
  const { id } = useParams();
  const { listings } = useData();
  const { isFavourited, toggle } = useFavourites();

  // Prefer the copy we already have cached (instant render); fall back to a
  // direct fetch (e.g. deep link before the cache has loaded, or the record
  // isn't in the /v1/listings cache for some reason — that gap is itself
  // worth noting if it happens).
  const cached = listings.find((l) => l.listing_id === id);
  const [fetched, setFetched] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [error, setError] = useState(null);

  const listing = cached || fetched;

  useEffect(() => {
    if (!cached) {
      apiRequest(`/v1/listing/${id}`)
        .then(setFetched)
        .catch((e) => setError(e.detail || e.message));
    }
  }, [id, cached]);

  useEffect(() => {
    apiRequest(`/v1/listings/${id}/similar`)
      .then((data) => setSimilar(Array.isArray(data?.results) ? data.results : data || []))
      .catch(() => setSimilar([]));
  }, [id]);

  if (!listing) {
    return <div className="loading-state">{error || "Loading listing…"}</div>;
  }

  const issues = isStructurallyImpossible(listing);
  const saved = isFavourited(listing.listing_id);

  return (
    <div>
      <Link to="/listings">← Back to listings</Link>

      <div className="detail-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="badges" style={{ marginBottom: 10 }}>
            {listing.is_verified && <span className="badge verified">Verified</span>}
            {listing.is_live === false && <span className="badge warn">Inactive</span>}
            {issues.length > 0 && <span className="badge warn">Data quality flag</span>}
          </div>
          <h2 style={{ marginTop: 0 }}>{listing.apartment_name || "Unnamed property"}</h2>
          <div className="price" style={{ fontSize: 28 }}>
            {formatINR(listing.price)}
          </div>
          <p style={{ color: "var(--text-dim)" }}>
            {titleCase(listing.locality)} · {titleCase(listing.property_type)} · {listing.bedroom} BHK
          </p>

          {issues.length > 0 && (
            <div className="card" style={{ borderColor: "var(--danger)", marginBottom: 14 }}>
              <strong style={{ color: "var(--danger)" }}>Flagged:</strong> {issues.join("; ")}
            </div>
          )}

          <p>{listing.description}</p>

          <table className="kv-table">
            <tbody>
              <tr><td>Carpet area</td><td>{formatArea(listing.carpet_area)}</td></tr>
              <tr><td>Super built-up area</td><td>{formatArea(listing.super_built_up_area ?? listing.super_builtup_area)}</td></tr>
              <tr><td>Bathrooms</td><td>{listing.bathroom ?? "—"}</td></tr>
              <tr><td>Balcony</td><td>{listing.balcony ?? "—"}</td></tr>
              <tr><td>Floor</td><td>{listing.floor ?? "—"} of {listing.total_floors ?? "—"}</td></tr>
              <tr><td>Facing</td><td>{titleCase(listing.facing_direction) || "—"}</td></tr>
              <tr><td>Furnishing</td><td>{titleCase(listing.furnishing)}</td></tr>
              <tr><td>Covered parking</td><td>{listing.covered_parking ?? "—"}</td></tr>
              <tr><td>Posted</td><td>{formatDate(listing.posted_at)}</td></tr>
              <tr><td>Listing ID</td><td>{listing.listing_id}</td></tr>
              <tr><td>Source</td><td>{listing.website || "—"}</td></tr>
            </tbody>
          </table>

          <button className="primary" style={{ marginTop: 16 }} onClick={() => toggle(listing)}>
            {saved ? "★ Saved to favourites" : "☆ Save to favourites"}
          </button>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Contact</h3>
          <table className="kv-table">
            <tbody>
              <tr><td>Posted by</td><td>{titleCase(listing.posted_by)}</td></tr>
              <tr><td>Name</td><td>{listing.posted_by_name || "—"}</td></tr>
              <tr><td>Contact</td><td>{listing.posted_by_contact || "—"}</td></tr>
            </tbody>
          </table>
          {listing.listing_url && (
            <p style={{ marginTop: 12 }}>
              <a href={listing.listing_url} target="_blank" rel="noreferrer">
                View original listing on {listing.website} ↗
              </a>
            </p>
          )}
          {listing.project_id && (
            <p>
              Part of project <code>{listing.project_id}</code>
            </p>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3>Similar listings</h3>
          <div className="grid">
            {similar.map((l) => (
              <ListingCard key={l.listing_id} listing={l} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
