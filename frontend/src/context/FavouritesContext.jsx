import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "./AuthContext";

const FavouritesContext = createContext(null);

export function FavouritesProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [favourites, setFavourites] = useState([]); // full listing objects
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest("/v1/favourites");
      setFavourites(Array.isArray(data?.results) ? data.results : []);
    } catch (e) {
      setError(e.detail || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) refresh();
    else setFavourites([]);
  }, [isAuthenticated, refresh]);

  const isFavourited = useCallback(
    (listingId) => favourites.some((f) => f.listing_id === listingId),
    [favourites]
  );

  const add = useCallback(
    async (listing) => {
      // Optimistic update so the UI feels instant.
      setFavourites((prev) =>
        prev.some((f) => f.listing_id === listing.listing_id) ? prev : [...prev, listing]
      );
      try {
        await apiRequest("/v1/favourites", { method: "POST", body: { id: listing.listing_id } });
      } catch (e) {
        setError(e.detail || e.message);
        refresh(); // reconcile with server truth if the optimistic update was wrong
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (listingId) => {
      setFavourites((prev) => prev.filter((f) => f.listing_id !== listingId));
      try {
        await apiRequest(`/v1/favourites/${listingId}`, { method: "DELETE" });
      } catch (e) {
        setError(e.detail || e.message);
        refresh();
      }
    },
    [refresh]
  );

  const toggle = useCallback(
    (listing) => (isFavourited(listing.listing_id) ? remove(listing.listing_id) : add(listing)),
    [isFavourited, add, remove]
  );

  const value = { favourites, loading, error, isFavourited, add, remove, toggle, refresh };
  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites() {
  const ctx = useContext(FavouritesContext);
  if (!ctx) throw new Error("useFavourites must be used within FavouritesProvider");
  return ctx;
}
