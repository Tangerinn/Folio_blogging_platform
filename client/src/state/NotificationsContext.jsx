import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api/index.js';
import { useAuth } from './AuthContext.jsx';

const Ctx = createContext(null);
export const useNotifications = () => useContext(Ctx);

// Notifications are fetched on page load / navigation, not pushed (no WebSockets in v1).
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listNotifications());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const markRead = useCallback(async (id) => {
    setItems((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.markNotificationRead(id);
    } catch (err) {
      setError(err);
      await refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setItems((l) => l.map((n) => ({ ...n, read: true })));
    try {
      await Promise.all(unreadIds.map((id) => api.markNotificationRead(id)));
    } catch (err) {
      setError(err);
      await refresh();
    }
  }, [items, refresh]);

  const value = useMemo(
    () => ({ items, loading, error, unread: items.filter((n) => !n.read).length, refresh, markRead, markAllRead }),
    [items, loading, error, refresh, markRead, markAllRead]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
