import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useAuth } from '../../state/AuthContext.jsx';
import PostCard from '../../components/posts/PostCard.jsx';
import PostContent from '../../components/posts/PostContent.jsx';
import CommentSection from '../../components/comments/CommentSection.jsx';
import ReportModal from '../../components/common/ReportModal.jsx';
import { Avatar, BotanicalDivider, Button, Card, Chip, ConfirmModal, EmptyState, ErrorNote, Spinner } from '../../components/common/ui.jsx';
import { Reading } from '../../components/common/PageShell.jsx';
import { readTime } from '../../utils/content.js';
import { formatDate } from '../../utils/format.js';

export default function BlogPost() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: post, loading, error, setData } = useAsync(() => api.getPost(id), [id]);
  const related = useAsync(() => api.listPosts({ sort: 'newest' }), [id]);
  const [modal, setModal] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (loading && (!post || post.id !== id)) return <Spinner />;
  if (error) {
    return (
      <Reading>
        <EmptyState title="Post not found" action={<Link to="/explore"><Button>Back to Explore</Button></Link>}>
          It may have been removed or is not publicly available.
        </EmptyState>
      </Reading>
    );
  }

  const mine = user?.id === post.author.id;

  const toggleBookmark = async () => {
    if (!user) return navigate('/login', { state: { from: `/posts/${id}` } });
    setActionError(null);
    const nextBookmarked = !post.bookmarked;
    setData({ ...post, bookmarked: nextBookmarked });
    try {
      nextBookmarked ? await api.addBookmark(id) : await api.removeBookmark(id);
    } catch (err) {
      setData(post);
      setActionError(err);
    }
  };

  const del = async () => {
    await api.deletePost(id);
    navigate('/my-posts');
  };

  const otherPosts = (related.data || []).filter((p) => p.id !== post.id);
  const sameCategory = post.categoryId
    ? otherPosts.filter((p) => p.categoryId === post.categoryId)
    : [];
  const relatedPosts = (sameCategory.length > 0 ? sameCategory : otherPosts).slice(0, 3);

  return (
    <Reading>
      <article>
        {post.status === 'draft' && (
          <div className="mb-4"><Chip tone="warn">Draft — only visible to you</Chip></div>
        )}
        {post.category && (
          <Link to={`/explore?category=${post.category.id}`}>
            <Chip>{post.category.name}</Chip>
          </Link>
        )}
        <h1 className="mt-4 font-display text-4xl font-bold leading-[1.12] tracking-[-0.02em] text-pine md:text-[48px]">
          {post.title}
        </h1>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-outline-variant/50 py-4">
          <Avatar name={post.author.name} size={44} />
          <div className="text-sm">
            <Link to={`/users/${post.author.id}`} className="font-semibold text-on-surface hover:text-moss">
              {post.author.name}
            </Link>
            <p className="text-on-surface-variant">
              {formatDate(post.publishedAt || post.updatedAt)} · {readTime(post.content)} min read
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
            {post.status === 'published' && (
              <Button variant="ghost" className="!px-3" onClick={toggleBookmark} aria-pressed={post.bookmarked}>
                <svg
                  aria-hidden="true"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill={post.bookmarked ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                </svg>
                <span>{post.bookmarked ? 'Saved' : 'Save'}</span>
              </Button>
            )}
            {mine && <Link to={`/posts/${id}/edit`}><Button variant="ghost" className="!px-3">Edit</Button></Link>}
            {mine && <Button variant="ghost" className="!px-3" onClick={() => setModal('delete')}>Delete</Button>}
            {user && !mine && post.status === 'published' && (
              <Button variant="ghost" className="!px-3" onClick={() => setModal('report')}>Report</Button>
            )}
          </div>
        </div>

        {actionError && <div className="mt-4"><ErrorNote error={actionError} /></div>}

        <div className="mt-8">
          <PostContent doc={post.content} />
        </div>
      </article>

      <div className="my-10"><BotanicalDivider /></div>

      {/* Author Bio Footer Card */}
      <Card className="bg-field-grid flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Avatar name={post.author.name} size={56} />
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-moss">Written by</p>
          <Link to={`/users/${post.author.id}`} className="mt-0.5 block font-display text-xl font-bold text-pine hover:text-moss">
            {post.author.name}
          </Link>
          {post.author.bio && <p className="mt-1 text-sm text-on-surface-variant">{post.author.bio}</p>}
        </div>
        <Link to={`/users/${post.author.id}`}><Button variant="secondary">View profile</Button></Link>
      </Card>

      {post.status === 'published' && <CommentSection postId={id} />}

      {post.status === 'published' && relatedPosts.length > 0 && (
        <section aria-label="Related posts" className="mt-16 border-t border-outline-variant/60 pt-10">
          <h2 className="mb-4 font-display text-2xl font-semibold text-pine">
            {sameCategory.length > 0 && post.category ? `More in ${post.category.name}` : 'Recent posts'}
          </h2>
          <div>
            {relatedPosts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        </section>
      )}

      {modal === 'delete' && (
        <ConfirmModal
          danger
          title="Delete this post?"
          confirmLabel="Delete"
          message="The post and all its comments will be permanently removed."
          onClose={() => setModal(null)}
          onConfirm={del}
        />
      )}
      {modal === 'report' && <ReportModal targetType="post" targetId={id} onClose={() => setModal(null)} />}
    </Reading>
  );
}
