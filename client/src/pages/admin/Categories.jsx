import { useState } from 'react';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { Button, Card, ConfirmModal, EmptyState, ErrorNote, Field, Input, Spinner } from '../../components/common/ui.jsx';
import { PageTitle } from '../../components/common/PageShell.jsx';

export default function Categories() {
  const { data, loading, error: loadError, reload } = useAsync(() => api.listCategories(), []);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editing, setEditing] = useState(null); // {id,name,description}
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const add = (e) => {
    e.preventDefault();
    run(async () => {
      await api.adminCreateCategory(form);
      setForm({ name: '', description: '' });
    }).catch(() => {});
  };

  const saveEdit = (e) => {
    e.preventDefault();
    run(async () => {
      await api.adminUpdateCategory(editing.id, editing);
      setEditing(null);
    }).catch(() => {});
  };

  const del = () => run(async () => {
    await api.adminDeleteCategory(toDelete.id);
    setToDelete(null);
  });

  return (
    <>
      <PageTitle sub="Categories organise posts. Students pick one when publishing.">Categories</PageTitle>

      <Card className="mb-8">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <Field label="Name" required>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Button type="submit" disabled={busy}>Add</Button>
        </form>
      </Card>

      {(error || loadError) && <div className="mb-6"><ErrorNote error={error || loadError} /></div>}

      {loading && !data ? (
        <Spinner />
      ) : !data ? null : data.length === 0 ? (
        <EmptyState title="No categories yet">Add your first category above so students can tag their posts.</EmptyState>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.map((c) => (
            <li key={c.id} className="rounded-panel border border-outline-variant/50 bg-surface-low p-6">
              {editing?.id === c.id ? (
                <form onSubmit={saveEdit} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                  <Field label="Category name" required>
                    <Input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </Field>
                  <Field label="Description">
                    <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy}>Save</Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-pine">
                      {c.name} <span className="font-normal text-on-surface-variant">· {c.postCount} {c.postCount === 1 ? 'post' : 'posts'}</span>
                    </p>
                    {c.description && <p className="mt-0.5 text-sm text-on-surface-variant">{c.description}</p>}
                  </div>
                  <Button variant="ghost" onClick={() => setEditing({ id: c.id, name: c.name, description: c.description })}>Edit</Button>
                  <Button variant="ghost" onClick={() => setToDelete(c)}>Delete</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {toDelete && (
        <ConfirmModal
          danger
          title={`Delete “${toDelete.name}”?`}
          confirmLabel="Delete"
          message="This can’t be undone."
          onClose={() => setToDelete(null)}
          onConfirm={del}
        />
      )}
    </>
  );
}
