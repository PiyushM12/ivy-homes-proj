import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { fetchAllPages } from "../api/fetchAll";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);

const CACHE_KEY = "ivy.dataset.v1";
// Cache is only trusted for this long before we refetch in the background.
// (You get a fast reload from cache either way — this just controls staleness.)
const CACHE_TTL_MS = 15 * 60 * 1000;

function loadCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.fetchedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(payload) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Dataset too big for sessionStorage quota — fine, it just won't
    // survive a refresh instantly; it'll refetch instead.
  }
}

export function DataProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [listings, setListings] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [meta, setMeta] = useState({
    listingsClaimedTotal: null,
    rentalsClaimedTotal: null,
    projectsClaimedTotal: null,
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);

  const loadAll = useCallback(async (force = false) => {
    if (!force) {
      const cached = loadCache();
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        setListings(cached.listings);
        setRentals(cached.rentals);
        setProjects(cached.projects);
        setMeta(cached.meta);
        setFetchedAt(cached.fetchedAt);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      setProgress("Fetching listings…");
      const listingsRes = await fetchAllPages("/v1/listings");

      setProgress("Fetching rentals…");
      const rentalsRes = await fetchAllPages("/v1/rentals");

      setProgress("Fetching projects…");
      const projectsRes = await fetchAllPages("/v1/projects");

      const newMeta = {
        listingsClaimedTotal: listingsRes.claimedTotal,
        rentalsClaimedTotal: rentalsRes.claimedTotal,
        projectsClaimedTotal: projectsRes.claimedTotal,
      };
      const now = Date.now();

      setListings(listingsRes.results);
      setRentals(rentalsRes.results);
      setProjects(projectsRes.results);
      setMeta(newMeta);
      setFetchedAt(now);

      saveCache({
        listings: listingsRes.results,
        rentals: rentalsRes.results,
        projects: projectsRes.results,
        meta: newMeta,
        fetchedAt: now,
      });
    } catch (e) {
      setError(e.detail || e.message);
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadAll(false);
  }, [isAuthenticated, loadAll]);

  const value = useMemo(
    () => ({
      listings,
      rentals,
      projects,
      meta,
      loading,
      progress,
      error,
      fetchedAt,
      refetch: () => loadAll(true),
    }),
    [listings, rentals, projects, meta, loading, progress, error, fetchedAt, loadAll]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
