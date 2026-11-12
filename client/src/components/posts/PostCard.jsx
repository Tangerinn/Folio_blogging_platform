import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api/index.js';
import { useAuth } from '../../state/AuthContext.jsx';
import { Avatar, Chip } from '../common/ui.jsx';
import { excerpt, firstImage, readTime } from '../../utils/content.js';
import { formatDate } from '../../utils/format.js';

// Medium-inspired editorial post row: author meta, headline + excerpt (+ optional content thumbnail), and inline bookmark.
export default function PostCard({ post, actions, onBookmarkChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [saved, setSaved] = useState(Boolean(post.bookmarked));
  const [savingBookmark, setSavingBookmark] = useState(false);

  useEffect(() => {
    setSaved(Boolean(post.bookmarked));
  }, [post.bookmarked]);

  const thumb = firstImage(post.content);

  const toggleBookmark = async () => {
    if (!user) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    if (savingBookmark) return;
    const next = !saved;
    setSaved(next);
    setSavingBookmark(true);
    try {
      next ? await api.addBookmark(post.id) : await api.removeBookmark(post.id);
      onBookmarkChange?.(post.id, next);
    } catch {
      setSaved(!next);
    } finally {
      setSavingBookmark(false);
    }
  };

  return (
    <article className="border-b border-outline-variant/60 py-7 first:pt-2">
      <div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant sm:text-sm">
        <Avatar name={post.author.name} size={22} />
        <Link to={`/users/${post.author.id}`} className="font-medium text-on-surface hover:text-moss">
          {post.author.name}
        </Link>
        {post.category && (
          <>
            <span aria-hidden="true" className="text-outline">in</span>
            <Link to={`/explore?category=${post.category.id}`} className="font-medium text-moss hover:underline">
              {post.category.name}
            </Link>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span>{formatDate(post.publishedAt || post.updatedAt)}</span>
        {post.status === 'draft' && <Chip tone="warn">Draft</Chip>}
      </div>

      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <Link to={`/posts/${post.id}`} className="group block focus:outline-none">
            <h2 className="font-display text-xl font-bold leading-[1.25] text-pine transition group-hover:text-moss group-focus-visible:underline sm:text-2xl">
              {post.title}
            </h2>
            <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-on-surface-variant">
              {excerpt(post.content, 180)}
            </p>
          </Link>
        </div>

        {thumb && (
          <Link to={`/posts/${post.id}`} className="hidden shrink-0 sm:block" tabIndex={-1} aria-hidden="true">
            <img
              src={thumb.src}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-20 w-28 rounded-field border border-outline-variant/50 bg-surface-container object-cover sm:h-24 sm:w-36"
            />
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant sm:text-sm">
        {post.category && (
          <Link to={`/explore?category=${post.category.id}`} className="hover:opacity-85">
            <Chip>{post.category.name}</Chip>
          </Link>
        )}
        <span>{readTime(post.content)} min read</span>
        <span className="inline-flex items-center gap-1" title={`${post.commentCount} comments`}>
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>{post.commentCount}</span>
          <span className="visually-hidden">{post.commentCount === 1 ? 'comment' : 'comments'}</span>
        </span>

        <div className="ml-auto flex items-center gap-1">
          {actions}
          {!actions && post.status === 'published' && (
            <button
              type="button"
              onClick={toggleBookmark}
              disabled={savingBookmark}
              aria-pressed={saved}
              aria-label={saved ? `Remove ${post.title} from saved` : `Save ${post.title}`}
              className={`rounded-field p-1.5 transition hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
                saved ? 'text-moss' : 'text-on-surface-variant hover:text-pine'
              }`}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={saved ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
