import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../state/NotificationsContext.jsx';
import { Button, EmptyState, ErrorNote, Spinner } from '../../components/common/ui.jsx';
import { PageTitle, Reading } from '../../components/common/PageShell.jsx';
import { timeAgo } from '../../utils/format.js';

export default function Notifications() {
  const { items, unread, loading, error, refresh, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Reading>
      <PageTitle
        sub="Activity on your posts and comments."
        action={(
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={loading} onClick={refresh}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            {unread > 0 && (
              <Button variant="secondary" onClick={markAllRead}>Mark all read</Button>
            )}
          </div>
        )}
      >
        Notifications
      </PageTitle>

      {error && <div className="mb-6"><ErrorNote error={error} /></div>}

      {loading && items.length === 0 ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="All quiet">Comments and replies on your posts show up here.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                to={`/posts/${n.postId}`}
                onClick={() => !n.read && markRead(n.id)}
                className={`flex items-start gap-3 rounded-panel border px-5 py-4 transition hover:bg-surface-container ${n.read
                    ? 'border-outline-variant/40 bg-surface'
                    : 'border-sage/50 bg-surface-low'
                  }`}
              >
                <span
                  className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-moss'}`}
                  aria-label={n.read ? 'Read' : 'Unread'}
                />
                <span className="flex-1">
                  <span className={n.read ? 'text-on-surface-variant' : 'font-medium text-on-surface'}>
                    {n.message}
                  </span>
                  <span className="mt-0.5 block text-xs text-on-surface-variant">{timeAgo(n.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Reading>
  );
}
