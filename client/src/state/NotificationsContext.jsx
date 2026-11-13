import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api, isMock } from '../services/api/index.js';
import { getAccessToken, getSocketUrl, refreshAccessToken } from '../services/api/realApi.js';
import { useAuth } from './AuthContext.jsx';

const Ctx = createContext(null);
export const useNotifications = () => useContext(Ctx);

// Loads notifications via REST on sign-in and enhances with Socket.IO live updates.
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);

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

  useEffect(() => {
    if (!user || isMock) {
      setSocket(null);
      return undefined;
    }

    const token = getAccessToken();
    if (!token) {
      setSocket(null);
      return undefined;
    }

    let disposed = false;
    let retriedAuth = false;

    const client = io(getSocketUrl(), {
      auth: { token },
      reconnectionAttempts: 5,
    });

    client.on('connect', () => {
      retriedAuth = false;
    });

    client.on('connect_error', async (err) => {
      if (err?.message === 'UNAUTHENTICATED' && !retriedAuth) {
        retriedAuth = true;
        try {
          const nextToken = await refreshAccessToken();
          if (!disposed && nextToken) {
            client.auth = { token: nextToken };
            client.connect();
          }
        } catch {
          client.disconnect();
        }
      }
    });

    client.on('notification:new', (incoming) => {
      if (!incoming || !incoming.id) return;
      setItems((prev) => (prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev]));
    });

    setSocket(client);

    return () => {
      disposed = true;
      client.removeAllListeners();
      client.disconnect();
      setSocket(null);
    };
  }, [user]);

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
    () => ({
      items,
      loading,
      error,
      unread: items.filter((n) => !n.read).length,
      socket,
      refresh,
      markRead,
      markAllRead,
    }),
    [items, loading, error, socket, refresh, markRead, markAllRead]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
