import { createContext, useContext, useState, useCallback } from "react";
import { login as apiLogin, logout as apiLogout, getStoredAuth, storeAuth, clearStoredAuth } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getStoredAuth());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const login = useCallback(async (email, password) => {
    setBusy(true);
    setError(null);
    try {
      const data = await apiLogin(email, password);
      const record = storeAuth({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
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
    token: auth?.accessToken ?? null,
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
