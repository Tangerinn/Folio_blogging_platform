import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import PostCard from '../../components/posts/PostCard.jsx';
import { Button, Chip, EmptyState, ErrorNote, Input, Spinner } from '../../components/common/ui.jsx';
import { PageTitle, Reading } from '../../components/common/PageShell.jsx';

export default function SavedPosts() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const cats = useAsync(() => api.listCategories(), []);
  const { data, loading, error, reload } = useAsync(
    () => api.listBookmarks({ q: debounced, category }),
    [debounced, category]
  );

  const filtered = (data || []).filter((p) => !category || p.categoryId === category);
  const hasFilters = Boolean(debounced || category);

  const remove = async (postId) => {
    setRemovingId(postId);
    setActionError(null);
    try {
      await api.removeBookmark(postId);
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Reading>
      <PageTitle sub="Posts you’ve bookmarked to read again.">Saved</PageTitle>

      <search>
        <div className="mb-4">
          <Input
            type="search"
            placeholder="Search saved posts…"
            aria-label="Search saved posts"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <Chip active={!category} onClick={() => setCategory('')}>All</Chip>
          {cats.data?.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? '' : c.id)}>
              {c.name}
            </Chip>
          ))}
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setQ(''); setDebounced(''); setCategory(''); }}
              className="ml-auto text-xs font-semibold text-moss hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </search>

      {actionError && <div className="mb-6"><ErrorNote error={actionError} /></div>}

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorNote error={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No matching saved posts' : 'Nothing saved yet'}
          action={
            hasFilters
              ? <Button variant="secondary" onClick={() => { setQ(''); setDebounced(''); setCategory(''); }}>Reset filters</Button>
              : <Link to="/explore"><Button>Explore posts</Button></Link>
          }
        >
          {hasFilters ? 'Try a different search or category.' : 'Tap “Save” on any post to keep it here.'}
        </EmptyState>
      ) : (
        filtered.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            actions={(
              <Button
                variant="ghost"
                className="!px-3 !py-1"
                disabled={removingId === p.id}
                aria-label={`Remove ${p.title} from saved`}
                onClick={() => remove(p.id)}
              >
                {removingId === p.id ? 'Removing…' : 'Remove'}
              </Button>
            )}
          />
        ))
      )}
    </Reading>
  );
}
