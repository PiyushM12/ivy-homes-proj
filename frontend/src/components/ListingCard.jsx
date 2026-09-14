import { Link } from "react-router-dom";
import { formatINR, formatArea, titleCase } from "../lib/format";
import { useFavourites } from "../context/FavouritesContext";

export default function ListingCard({ listing }) {
  const { isFavourited, toggle } = useFavourites();
  const saved = isFavourited(listing.listing_id);

  return (
    <div className="listing-card">
      <div className="badges">
        {listing.is_verified && <span className="badge verified">Verified</span>}
        <span className="badge">{titleCase(listing.property_type)}</span>
        <span className="badge">{listing.bedroom} BHK</span>
      </div>
      <div className="price">{formatINR(listing.price)}</div>
      <div className="title">{listing.apartment_name || "Unnamed property"}</div>
      <div className="meta">
        {titleCase(listing.locality)} · {formatArea(listing.carpet_area)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <Link to={`/listings/${listing.listing_id}`}>View details →</Link>
        <button
          className="secondary"
          style={{ padding: "4px 10px", fontSize: 12 }}
          onClick={() => toggle(listing)}
        >
          {saved ? "★ Saved" : "☆ Save"}
        </button>
      </div>
    </div>
  );
}
