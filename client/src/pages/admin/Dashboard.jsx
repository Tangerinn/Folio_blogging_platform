import { Link } from 'react-router-dom';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { Card, EmptyState, ErrorNote, Spinner } from '../../components/common/ui.jsx';
import { PageTitle } from '../../components/common/PageShell.jsx';
import { timeAgo } from '../../utils/format.js';

function Stat({ label, value, to }) {
  const inner = (
    <Card className={to ? 'transition hover:bg-surface-container' : ''}>
      <p className="text-sm text-on-surface-variant">{label}</p>
      <p className="mt-1 font-display text-4xl font-bold text-pine">{value}</p>
    </Card>
  );
  return to ? <Link to={to} className="block rounded-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-moss">{inner}</Link> : inner;
}

export default function Dashboard() {
  const { data, loading, error } = useAsync(() => api.adminStats(), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} />;

  return (
    <>
      <PageTitle sub="A quick look at how the community is doing.">Dashboard</PageTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={data.users} to="/admin/users" />
        <Stat label="Published posts" value={data.publishedPosts} />
        <Stat label="Comments" value={data.comments} />
        <Stat label="Pending reports" value={data.pendingReports} to="/admin/moderation" />
      </div>

      <h2 className="mb-4 mt-10 font-display text-2xl font-bold text-pine">Recent activity</h2>
      {data.recent.length === 0 ? (
        <EmptyState title="No activity yet">Recent community activity will appear here.</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-outline-variant/50">
            {data.recent.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-3 first:pt-0 last:pb-0 text-sm">
                <span className="text-on-surface">{r.text}</span>
                <span className="shrink-0 text-on-surface-variant">{timeAgo(r.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
