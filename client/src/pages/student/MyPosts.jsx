import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import PostCard from '../../components/posts/PostCard.jsx';
import { Button, ConfirmModal, EmptyState, ErrorNote, Spinner } from '../../components/common/ui.jsx';
import { PageTitle, Reading } from '../../components/common/PageShell.jsx';

export default function MyPosts() {
  const { data, loading, error, reload } = useAsync(() => api.myPosts(), []);
  const [filter, setFilter] = useState('all');
  const [toDelete, setToDelete] = useState(null);

  const allPosts = data || [];
  const publishedCount = allPosts.filter((p) => p.status === 'published').length;
  const draftCount = allPosts.filter((p) => p.status === 'draft').length;
  const list = allPosts.filter((p) => filter === 'all' || p.status === filter);

  const counts = {
    all: allPosts.length,
    published: publishedCount,
    draft: draftCount,
  };

  return (
    <Reading>
      <PageTitle
        sub="Manage your published articles and works in progress."
        action={<Link to="/write"><Button>New post</Button></Link>}
      >
        My posts
      </PageTitle>

      <div className="mb-8 flex items-center gap-6 border-b border-outline-variant/45" role="tablist" aria-label="Filter posts by status">
        {[
          { key: 'all', label: 'All' },
          { key: 'published', label: 'Published' },
          { key: 'draft', label: 'Drafts' },
        ].map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(key)}
              className={`-mb-px border-b-2 pb-3 text-sm transition ${
                active
                  ? 'border-pine font-semibold text-pine'
                  : 'border-transparent text-on-surface-variant hover:text-pine'
              }`}
            >
              {label}{data ? ` (${counts[key]})` : ''}
            </button>
          );
        })}
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorNote error={error} />
      ) : list.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'Nothing here yet' : `No ${filter} posts`}
          action={<Link to="/write"><Button>Write a post</Button></Link>}
        >
          {filter === 'all' ? 'Your posts and drafts will appear here.' : 'Switch filters or start a new post.'}
        </EmptyState>
      ) : (
        list.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            actions={(
              <>
                <Link to={`/posts/${p.id}/edit`}>
                  <Button variant="ghost" className="!px-3 !py-1" aria-label={`Edit ${p.title}`}>Edit</Button>
                </Link>
                <Button variant="ghost" className="!px-3 !py-1" aria-label={`Delete ${p.title}`} onClick={() => setToDelete(p)}>
                  Delete
                </Button>
              </>
            )}
          />
        ))
      )}

      {toDelete && (
        <ConfirmModal
          danger
          title="Delete this post?"
          confirmLabel="Delete"
          message={`“${toDelete.title}” and its comments will be permanently removed.`}
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            await api.deletePost(toDelete.id);
            setToDelete(null);
            reload();
          }}
        />
      )}
    </Reading>
  );
}
