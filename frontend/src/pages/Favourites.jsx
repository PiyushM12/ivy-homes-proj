import { useFavourites } from "../context/FavouritesContext";
import ListingCard from "../components/ListingCard";

export default function Favourites() {
  const { favourites, loading, error, refresh } = useFavourites();

  if (loading && favourites.length === 0) {
    return <div className="loading-state">Loading saved listings…</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Saved listings</h2>
        <button className="secondary" onClick={refresh}>Refresh</button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {favourites.length === 0 ? (
        <div className="empty-state">
          Nothing saved yet — tap ☆ Save on any listing to add it here. Saved listings persist per
          account, even after a reload or logging back in.
        </div>
      ) : (
        <div className="grid">
          {favourites.map((l) => (
            <ListingCard key={l.listing_id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
