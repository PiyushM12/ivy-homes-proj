import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { login as apiLogin, logout as apiLogout, getStoredAuth, storeAuth, clearStoredAuth } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialize synchronously from localStorage so a page refresh doesn't
  // bounce the user through a flash of "logged out".
  const [auth, setAuth] = useState(() => getStoredAuth());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // If the token expires while the tab is open, drop the session so the UI
  // can react (rather than silently failing on the next request).
  useEffect(() => {
    if (!auth) return;
    const msLeft = auth.expiresAt - Date.now();
    if (msLeft <= 0) {
      setAuth(null);
      return;
    }
    const t = setTimeout(() => setAuth(null), msLeft);
    return () => clearTimeout(t);
  }, [auth]);

  const login = useCallback(async (email, password) => {
    setBusy(true);
    setError(null);
    try {
      const data = await apiLogin(email, password);
      const record = storeAuth({
        token: data.token,
        tokenType: data.token_type,
        expiresIn: data.expires_in,
        user: data.user,
      });
      setAuth(record);
      return record;
    } catch (e) {
      setError(e.detail || e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    clearStoredAuth();
    setAuth(null);
  }, []);

  const value = {
    isAuthenticated: !!auth,
    user: auth?.user ?? null,
    token: auth?.token ?? null,
    error,
    busy,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
