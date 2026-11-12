import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { Button, Card, Chip, ConfirmModal, EmptyState, ErrorNote, Spinner } from '../../components/common/ui.jsx';
import { PageTitle } from '../../components/common/PageShell.jsx';
import { timeAgo } from '../../utils/format.js';

export default function Moderation() {
  const [status, setStatus] = useState('pending');
  const [confirm, setConfirm] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const { data, loading, error, reload } = useAsync(() => api.adminListReports({ status }), [status]);

  const act = async (id, action) => {
    setBusyId(id);
    setActionError(null);
    try {
      await api.adminUpdateReport(id, { action });
      setConfirm(null);
      reload();
    } catch (e) {
      setActionError(e);
      throw e;
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageTitle sub="Review reported posts and comments.">Content moderation</PageTitle>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter reports by status">
        {['pending', 'resolved', 'dismissed'].map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </Chip>
        ))}
      </div>

      {(actionError || error) && <div className="mb-6"><ErrorNote error={actionError || error} /></div>}

      {loading && !data ? (
        <Spinner />
      ) : !data ? null : data.length === 0 ? (
        <EmptyState title="Nothing to review">No {status} reports.</EmptyState>
      ) : (
        <div className="space-y-4">
          {data.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                <Chip>{r.targetType}</Chip>
                <span>reported by {r.reporter}</span>
                <span aria-hidden="true">·</span>
                <span>{timeAgo(r.createdAt)}</span>
              </div>
              <p className="mt-3 text-on-surface">
                <span className="font-semibold">Reason:</span> {r.reason}
              </p>
              <blockquote className="mt-3 rounded-field border border-outline-variant/40 bg-surface-container px-4 py-3 text-sm">
                {r.target ? (
                  <>
                    <p className="text-on-surface-variant">
                      {r.targetType === 'post' ? r.target.title : `“${r.target.excerpt}”`}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      by {r.target.author} · <Link className="font-medium text-moss underline" to={`/posts/${r.target.postId}`}>view in context</Link>
                    </p>
                  </>
                ) : (
                  <span className="text-on-surface-variant">Content no longer exists.</span>
                )}
              </blockquote>
              {r.status === 'pending' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="danger" disabled={busyId === r.id} onClick={() => setConfirm(r)}>
                    Remove content
                  </Button>
                  <Button variant="outline" disabled={busyId === r.id} onClick={() => act(r.id, 'dismiss').catch(() => {})}>
                    Dismiss
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          danger
          title="Remove this content?"
          confirmLabel="Remove"
          message={`This permanently deletes the reported ${confirm.targetType}${confirm.targetType === 'post' ? ', its comments and bookmarks' : ' and its replies'}.`}
          onClose={() => setConfirm(null)}
          onConfirm={() => act(confirm.id, 'resolve')}
        />
      )}
    </>
  );
}
