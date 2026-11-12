import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useAuth } from '../../state/AuthContext.jsx';
import { BotanicalSprig, ForestCanopyArt } from '../../components/common/BotanicalArt.jsx';
import DiscoverySidebar from '../../components/posts/DiscoverySidebar.jsx';
import PostCard from '../../components/posts/PostCard.jsx';
import { Button, Chip, EmptyState, ErrorNote, Input, Spinner } from '../../components/common/ui.jsx';

const TABS = [
  { key: 'newest', label: 'Latest' },
  { key: 'discussed', label: 'Most discussed' },
  { key: 'oldest', label: 'Oldest' },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sort, setSort] = useState('newest');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');

  const posts = useAsync(() => api.listPosts({ sort, category }), [sort, category]);
  const cats = useAsync(() => api.listCategories(), []);

  const handleMobileSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl items-start gap-12 px-5 py-8 md:px-10 md:py-10">
      <div className="min-w-0 flex-1 max-w-[720px]">
        {!user ? (
          <section className="mb-10 overflow-hidden rounded-panel border border-moss/40 bg-primary text-parchment">
            <div className="relative h-44 w-full overflow-hidden sm:h-52">
              <ForestCanopyArt className="h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/25 to-transparent" />
            </div>
            <div className="relative px-6 pb-8 pt-2 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-on-primary-container">
                Student Field Journal
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-parchment sm:text-[44px]">
                Where student writing grows.
              </h1>
              <p className="mt-3 max-w-lg text-base leading-[1.65] text-on-primary-container sm:text-lg">
                Share what you’re learning, read what your peers are thinking, and talk it through in calm, focused threads.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-btn bg-parchment px-5 py-2.5 text-sm font-semibold text-pine transition hover:bg-secondary-container"
                >
                  Start writing
                </Link>
                <Link
                  to="/explore"
                  className="inline-flex items-center justify-center rounded-btn border border-on-primary-container/45 px-5 py-2.5 text-sm font-medium text-parchment transition hover:bg-primary-container"
                >
                  Browse stories
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-field-grid relative mb-8 overflow-hidden rounded-panel border border-sage/40 bg-surface-low px-6 py-6 sm:px-8">
            <BotanicalSprig className="pointer-events-none absolute -bottom-3 -right-3 h-28 w-28 text-sage/30" />
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-moss">Your Reading Desk</p>
            <h1 className="mt-1 font-display text-[26px] font-bold leading-[1.2] text-pine sm:text-[32px]">
              Welcome back, {user.name.split(' ')[0]}
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-on-surface-variant sm:text-base">
              Pick up a fresh post from campus, or open your notebook to draft something new.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/write"><Button className="!py-2">New post</Button></Link>
              <Link to="/my-posts"><Button variant="secondary" className="!py-2">My posts</Button></Link>
            </div>
          </section>
        )}

        {/* Mobile-only search bar (desktop has inline header search) */}
        <search className="mb-6 md:hidden">
          <form onSubmit={handleMobileSearch} className="flex gap-2">
            <Input
              type="search"
              name="q"
              aria-label="Search posts"
              placeholder="Search articles or topics…"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" variant="secondary" className="shrink-0">Search</Button>
          </form>
        </search>

        {/* Medium-style underline feed tabs */}
        <div role="tablist" aria-label="Sort feed" className="flex items-center gap-6 border-b border-outline-variant/60">
          {TABS.map((tab) => {
            const active = sort === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSort(tab.key)}
                className={`-mb-px border-b-2 pb-3 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
                  active
                    ? 'border-pine font-semibold text-pine'
                    : 'border-transparent font-medium text-on-surface-variant hover:text-pine'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Category filter chips */}
        {cats.data && cats.data.length > 0 && (
          <div className="mt-5 mb-2 flex flex-wrap gap-2" aria-label="Filter by category">
            <Chip active={!category} onClick={() => setCategory('')}>All topics</Chip>
            {cats.data.map((c) => (
              <Chip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? '' : c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
        )}

        {posts.loading ? (
          <Spinner />
        ) : posts.error ? (
          <div className="mt-6"><ErrorNote error={posts.error} /></div>
        ) : posts.data.length === 0 ? (
          <EmptyState
            title={category ? 'No posts in this topic yet' : 'Nothing here yet'}
            action={
              category
                ? <Button variant="secondary" onClick={() => setCategory('')}>Show all topics</Button>
                : user && <Link to="/write"><Button>Write the first post</Button></Link>
            }
          >
            {category ? 'Try another topic or be the first to publish here.' : 'Be the first to publish.'}
          </EmptyState>
        ) : (
          <div>
            {posts.data.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </div>

      <DiscoverySidebar activeCategory={category} />
    </div>
  );
}
