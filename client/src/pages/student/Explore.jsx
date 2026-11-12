import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import DiscoverySidebar from '../../components/posts/DiscoverySidebar.jsx';
import PostCard from '../../components/posts/PostCard.jsx';
import { Button, Chip, EmptyState, ErrorNote, Input, Spinner } from '../../components/common/ui.jsx';
import { PageTitle } from '../../components/common/PageShell.jsx';

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'discussed', label: 'Most discussed' },
  { key: 'oldest', label: 'Oldest' },
];

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const q = params.get('q') || '';
  const [text, setText] = useState(q);

  useEffect(() => {
    setText(q);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (text === q) return;
      const next = new URLSearchParams(params);
      text.trim() ? next.set('q', text.trim()) : next.delete('q');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    setParams(next);
  };

  const clearFilters = () => {
    setText('');
    setParams({});
  };

  const cats = useAsync(() => api.listCategories(), []);
  const posts = useAsync(() => api.listPosts({ q, category, sort }), [q, category, sort]);
  const hasFilters = Boolean(q || category || sort !== 'newest');
  const activeCat = cats.data?.find((c) => c.id === category);

  return (
    <div className="mx-auto flex w-full max-w-6xl items-start gap-12 px-5 py-8 md:px-10 md:py-10">
      <div className="min-w-0 flex-1 max-w-[720px]">
        <PageTitle
          sub={activeCat?.description || 'Search student stories, filter by topic, or browse what peers are discussing.'}
        >
          {activeCat ? activeCat.name : 'Explore'}
        </PageTitle>

        <search className="space-y-4">
          <Input
            type="search"
            placeholder="Search posts by keyword…"
            aria-label="Search posts"
            enterKeyHint="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Chip active={!category} onClick={() => setParam('category', '')}>All topics</Chip>
            {cats.data?.map((c) => (
              <Chip key={c.id} active={category === c.id} onClick={() => setParam('category', category === c.id ? '' : c.id)}>
                {c.name}
              </Chip>
            ))}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-xs font-semibold text-moss hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </search>

        {/* Medium-style sort tabs */}
        <div role="tablist" aria-label="Sort results" className="mt-6 flex items-center justify-between border-b border-outline-variant/60">
          <div className="flex items-center gap-6">
            {SORTS.map((s) => {
              const active = sort === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setParam('sort', s.key === 'newest' ? '' : s.key)}
                  className={`-mb-px border-b-2 pb-3 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
                    active
                      ? 'border-pine font-semibold text-pine'
                      : 'border-transparent font-medium text-on-surface-variant hover:text-pine'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {posts.data && (
            <span className="pb-3 text-xs font-medium text-on-surface-variant" aria-live="polite">
              {posts.data.length} {posts.data.length === 1 ? 'story' : 'stories'}
            </span>
          )}
        </div>

        {cats.error && <div className="mt-6"><ErrorNote error={cats.error} /></div>}

        {posts.loading ? (
          <Spinner />
        ) : posts.error ? (
          <div className="mt-6"><ErrorNote error={posts.error} /></div>
        ) : posts.data.length === 0 ? (
          <EmptyState
            title="No posts found"
            action={hasFilters && <Button variant="secondary" onClick={clearFilters}>Reset filters</Button>}
          >
            Try a different keyword or topic.
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
