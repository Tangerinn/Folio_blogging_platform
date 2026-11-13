import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, isMock } from '../../services/api/index.js';
import { useAuth } from '../../state/AuthContext.jsx';
import { useNotifications } from '../../state/NotificationsContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { Avatar, Button, ConfirmModal, ErrorNote, Field, Spinner, Textarea } from '../common/ui.jsx';
import ReportModal from '../common/ReportModal.jsx';
import { timeAgo } from '../../utils/format.js';

function Composer({ label, placeholder, submitLabel, initial = '', onSubmit, onCancel, autoFocus }) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) {
      setError(new Error('Please write something before submitting.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      setText('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <Field label={label}>
        <Textarea
          rows={3}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={text}
          onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
        />
      </Field>
      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={busy}>{busy ? 'Posting…' : submitLabel}</Button>
      </div>
    </form>
  );
}

function CommentItem({ c, isReply, onChanged, canReply }) {
  const { user } = useAuth();
  const [mode, setMode] = useState(null); // 'reply' | 'edit' | 'delete' | 'report'
  const mine = user?.id === c.author.id;

  return (
    <div className="py-4">
      <div className="flex items-center gap-2 text-sm">
        <Avatar name={c.author.name} size={28} />
        <Link to={`/users/${c.author.id}`} className="font-medium text-on-surface hover:text-moss">{c.author.name}</Link>
        <span className="text-on-surface-variant">{timeAgo(c.createdAt)}</span>
      </div>

      {mode === 'edit' ? (
        <div className="mt-2">
          <Composer
            autoFocus
            label={`Edit comment by ${c.author.name}`}
            initial={c.content}
            submitLabel="Save"
            onCancel={() => setMode(null)}
            onSubmit={async (t) => {
              await api.editComment(c.id, { content: t });
              setMode(null);
              onChanged();
            }}
          />
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-on-surface">{c.content}</p>
      )}

      {mode !== 'edit' && user && (
        <div className="mt-1.5 flex flex-wrap gap-1 text-sm">
          {canReply && !isReply && (
            <Button
              variant="ghost"
              className="!px-2.5 !py-1"
              aria-label={`Reply to ${c.author.name}`}
              onClick={() => setMode(mode === 'reply' ? null : 'reply')}
            >
              Reply
            </Button>
          )}
          {mine && (
            <Button
              variant="ghost"
              className="!px-2.5 !py-1"
              aria-label={`Edit comment`}
              onClick={() => setMode('edit')}
            >
              Edit
            </Button>
          )}
          {mine && (
            <Button
              variant="ghost"
              className="!px-2.5 !py-1"
              aria-label={`Delete comment`}
              onClick={() => setMode('delete')}
            >
              Delete
            </Button>
          )}
          {!mine && (
            <Button
              variant="ghost"
              className="!px-2.5 !py-1"
              aria-label={`Report comment by ${c.author.name}`}
              onClick={() => setMode('report')}
            >
              Report
            </Button>
          )}
        </div>
      )}

      {mode === 'reply' && (
        <div className="mt-3 ml-4 sm:ml-6">
          <Composer
            autoFocus
            label={`Reply to ${c.author.name}`}
            placeholder="Write a reply…"
            submitLabel="Reply"
            onCancel={() => setMode(null)}
            onSubmit={async (t) => {
              await api.addReply(c.id, { content: t });
              setMode(null);
              onChanged();
            }}
          />
        </div>
      )}

      {mode === 'delete' && (
        <ConfirmModal
          danger
          title="Delete comment?"
          confirmLabel="Delete"
          message={isReply ? 'This reply will be removed.' : 'This comment and its replies will be removed.'}
          onClose={() => setMode(null)}
          onConfirm={async () => {
            await api.deleteComment(c.id);
            setMode(null);
            onChanged();
          }}
        />
      )}

      {mode === 'report' && <ReportModal targetType="comment" targetId={c.id} onClose={() => setMode(null)} />}

      {c.replies?.length > 0 && (
        <div className="mt-2 ml-4 border-l-2 border-moonlit-sage pl-4 sm:ml-6 sm:pl-5">
          {c.replies.map((r) => <CommentItem key={r.id} c={r} isReply onChanged={onChanged} />)}
        </div>
      )}
    </div>
  );
}

export default function CommentSection({ postId, onCountChange }) {
  const { user } = useAuth();
  const { socket } = useNotifications() || {};
  const location = useLocation();
  const { data, loading, error, reload, setData } = useAsync(() => api.listComments(postId), [postId]);

  useEffect(() => {
    if (!socket || !postId || isMock) return undefined;

    const joinRoom = () => {
      socket.emit('post:join', { postId });
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on('connect', joinRoom);

    const handleNewComment = (incoming) => {
      if (!incoming || incoming.postId !== postId) return;
      let added = false;
      setData((prev) => {
        if (!Array.isArray(prev)) return prev;
        if (!incoming.parentId) {
          if (prev.some((c) => c.id === incoming.id)) return prev;
          added = true;
          return [...prev, { ...incoming, replies: incoming.replies || [] }];
        }
        return prev.map((c) => {
          if (c.id !== incoming.parentId) return c;
          const existingReplies = c.replies || [];
          if (existingReplies.some((r) => r.id === incoming.id)) return c;
          added = true;
          return { ...c, replies: [...existingReplies, incoming] };
        });
      });
      if (added) {
        onCountChange?.();
      }
    };

    socket.on('comment:new', handleNewComment);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('comment:new', handleNewComment);
      socket.emit('post:leave', { postId });
    };
  }, [socket, postId, setData, onCountChange]);

  const changed = () => {
    reload();
    onCountChange?.();
  };
  const total = (data || []).reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);

  return (
    <section aria-label="Discussion" className="mt-12">
      <h2 className="font-display text-2xl font-bold text-pine">
        Discussion {data && <span className="text-on-surface-variant">({total})</span>}
      </h2>

      <div className="mt-6">
        {user ? (
          <Composer
            label="Add a comment"
            placeholder="Share your thoughts on this post…"
            submitLabel="Comment"
            onSubmit={async (t) => {
              await api.addComment(postId, { content: t });
              changed();
            }}
          />
        ) : (
          <p className="rounded-panel border border-outline-variant/50 bg-surface-low p-6 text-on-surface-variant">
            <Link to="/login" state={{ from: location.pathname }} className="font-semibold text-moss underline">
              Sign in
            </Link>{' '}
            to join the discussion.
          </p>
        )}
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <div className="mt-6"><ErrorNote error={error} /></div>
      ) : (
        <div className="mt-4 divide-y divide-outline-variant/50">
          {data.length === 0 && (
            <p className="py-8 text-center text-on-surface-variant">No comments yet. Be the first to share a perspective.</p>
          )}
          {data.map((c) => <CommentItem key={c.id} c={c} canReply onChanged={changed} />)}
        </div>
      )}
    </section>
  );
}
