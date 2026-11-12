import { Link } from 'react-router-dom';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useAuth } from '../../state/AuthContext.jsx';
import { BotanicalSprig } from '../common/BotanicalArt.jsx';
import { Avatar, Chip } from '../common/ui.jsx';

// Right-hand discovery rail (Medium-inspired editorial sidebar in Sylvan Folio's forest palette).
export default function DiscoverySidebar({ activeCategory = '' }) {
  const { user } = useAuth();
  const cats = useAsync(() => api.listCategories(), []);
  const discussed = useAsync(() => api.listPosts({ sort: 'discussed', limit: 3 }), []);

  return (
    <aside aria-label="Discovery sidebar" className="hidden w-80 shrink-0 space-y-6 lg:block">
      {/* Forest Moss Sanctuary / Writing Callout */}
      <div className="relative overflow-hidden rounded-panel border border-pine/40 bg-primary p-6 text-parchment">
        <BotanicalSprig className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 text-on-primary-container/25" />
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-on-primary-container">
          Field Journal
        </p>
        <h2 className="mt-2 font-display text-xl font-bold leading-snug text-parchment">
          {user ? 'Write in a quiet space' : 'Share what you’re learning'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container">
          {user
            ? 'Capture lecture notes, project write-ups, and essays as drafts or publish to the community.'
            : 'Publish structured posts, save helpful reads, and discuss ideas in focused threads.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {user ? (
            <>
              <Link
                to="/write"
                className="inline-flex items-center justify-center rounded-btn bg-parchment px-4 py-2 text-sm font-semibold text-pine transition hover:bg-secondary-container"
              >
                Write a post
              </Link>
              <Link
                to="/my-posts"
                className="inline-flex items-center justify-center rounded-btn border border-on-primary-container/40 px-4 py-2 text-sm font-medium text-parchment transition hover:bg-primary-container"
              >
                My drafts
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-btn bg-parchment px-4 py-2 text-sm font-semibold text-pine transition hover:bg-secondary-container"
              >
                Start writing
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-btn border border-on-primary-container/40 px-4 py-2 text-sm font-medium text-parchment transition hover:bg-primary-container"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Active Discussions */}
      {discussed.data && discussed.data.length > 0 && (
        <section className="rounded-panel border border-outline-variant/50 bg-surface-low p-6">
          <h2 className="font-display text-lg font-bold text-pine">Active discussions</h2>
          <ol className="mt-4 space-y-4">
            {discussed.data.map((p, idx) => (
              <li key={p.id} className="flex items-start gap-3">
                <span className="font-display text-lg font-bold leading-none text-sage" aria-hidden="true">
                  0{idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <Avatar name={p.author.name} size={18} />
                    <Link to={`/users/${p.author.id}`} className="truncate font-medium text-on-surface hover:text-moss">
                      {p.author.name}
                    </Link>
                  </div>
                  <Link
                    to={`/posts/${p.id}`}
                    className="mt-1 block text-sm font-semibold leading-snug text-pine hover:text-moss"
                  >
                    {p.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {p.commentCount} {p.commentCount === 1 ? 'comment' : 'comments'}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Topics / Categories */}
      {cats.data && cats.data.length > 0 && (
        <section className="rounded-panel border border-outline-variant/50 bg-surface-low p-6">
          <h2 className="font-display text-lg font-bold text-pine">Topics to explore</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {cats.data.map((c) => (
              <Link key={c.id} to={`/explore?category=${c.id}`}>
                <Chip active={activeCategory === c.id}>
                  {c.name} <span className="ml-1 opacity-75">· {c.postCount}</span>
                </Chip>
              </Link>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
