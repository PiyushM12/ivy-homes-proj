import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { FavouritesProvider } from "./context/FavouritesContext";

import Login from "./pages/Login";
import Listings from "./pages/Listings";
import ListingDetail from "./pages/ListingDetail";
import Rentals from "./pages/Rentals";
import Projects from "./pages/Projects";
import Favourites from "./pages/Favourites";
import Insights from "./pages/Insights";

function ProtectedArea({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <DataProvider>
      <FavouritesProvider>{children}</FavouritesProvider>
    </DataProvider>
  );
}

function Topbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  return (
    <div className="topbar">
      <div className="brand">
        ivy<span>.homes</span>
      </div>
      <nav>
        <NavLink to="/listings" className={({ isActive }) => (isActive ? "active" : "")}>
          Listings
        </NavLink>
        <NavLink to="/rentals" className={({ isActive }) => (isActive ? "active" : "")}>
          Rentals
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => (isActive ? "active" : "")}>
          Projects
        </NavLink>
        <NavLink to="/favourites" className={({ isActive }) => (isActive ? "active" : "")}>
          Saved
        </NavLink>
        <NavLink to="/insights" className={({ isActive }) => (isActive ? "active" : "")}>
          Insights
        </NavLink>
      </nav>
      <div className="user">
        <span>{user?.name || user?.email}</span>
        <button
          className="secondary"
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-shell">
          <Topbar />
          <div className="container">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <ProtectedArea>
                    <Routes>
                      <Route path="listings" element={<Listings />} />
                      <Route path="listings/:id" element={<ListingDetail />} />
                      <Route path="rentals" element={<Rentals />} />
                      <Route path="projects" element={<Projects />} />
                      <Route path="favourites" element={<Favourites />} />
                      <Route path="insights" element={<Insights />} />
                      <Route path="*" element={<Navigate to="/listings" replace />} />
                    </Routes>
                  </ProtectedArea>
                }
              />
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
