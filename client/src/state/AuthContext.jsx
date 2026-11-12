import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api/index.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.me().then((u) => alive && setUser(u)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (creds) => { const u = await api.login(creds); setUser(u); return u; }, []);
  const register = useCallback(async (data) => {
    await api.register(data);
    return login({ email: data.email, password: data.password }); // register, then login (docs: separate steps)
  }, [login]);
  const logout = useCallback(async () => { await api.logout(); setUser(null); }, []);
  const updateUser = useCallback((u) => setUser(u), []);

  const value = useMemo(() => ({ user, loading, login, register, logout, updateUser, isAdmin: user?.role === 'admin' }), [user, loading, login, register, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
