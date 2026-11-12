import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useAuth } from '../../state/AuthContext.jsx';
import RichTextEditor from '../../components/posts/RichTextEditor.jsx';
import { Button, Chip, EmptyState, ErrorNote, Field, Input, Select, Spinner } from '../../components/common/ui.jsx';
import { Reading } from '../../components/common/PageShell.jsx';
import { emptyDoc, isEmptyDoc, readTime, wordCount } from '../../utils/content.js';

export default function CreateEditBlog() {
  const { id } = useParams(); // present when editing
  const { user } = useAuth();
  const navigate = useNavigate();
  const cats = useAsync(() => api.listCategories(), []);
  const existing = useAsync(() => (id ? api.getPost(id) : Promise.resolve(null)), [id]);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [content, setContent] = useState(emptyDoc);
  const [ready, setReady] = useState(!id);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError(null);
    if (!id) {
      setTitle('');
      setCategoryId('');
      setContent(emptyDoc);
      setReady(true);
    } else {
      setReady(false);
    }
  }, [id]);

  useEffect(() => {
    const p = existing.data;
    if (id && p) {
      if (p.author.id !== user?.id) {
        navigate('/', { replace: true });
        return;
      }
      setTitle(p.title);
      setCategoryId(p.categoryId || '');
      setContent(p.content || emptyDoc);
      setReady(true);
    }
  }, [id, existing.data, user?.id, navigate]);

  if (existing.error) {
    return (
      <Reading>
        <EmptyState title="Unable to load post" action={<Link to="/my-posts"><Button>Back to My posts</Button></Link>}>
          {existing.error.message || 'This post could not be opened for editing.'}
        </EmptyState>
      </Reading>
    );
  }

  if (cats.error) {
    return (
      <Reading>
        <ErrorNote error={cats.error} />
      </Reading>
    );
  }

  if (!ready || cats.loading || (id && existing.data?.id !== id)) return <Spinner />;

  const save = async (status) => {
    if (!title.trim()) {
      setError(new Error('A title is required.'));
      return;
    }
    if (status === 'published') {
      if (!categoryId) {
        setError(new Error('Choose a category before publishing.'));
        return;
      }
      if (isEmptyDoc(content)) {
        setError(new Error('Write some content before publishing.'));
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const body = { title: title.trim(), content, categoryId: categoryId || null, status };
      const saved = id ? await api.updatePost(id, body) : await api.createPost(body);
      navigate(status === 'published' ? `/posts/${saved.id}` : '/my-posts');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const wasPublished = existing.data?.status === 'published';
  const words = wordCount(content);

  return (
    <Reading>
      {/* Calm Writer Status Bar */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/50 pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <Chip tone={wasPublished ? 'default' : 'warn'}>
            {wasPublished ? 'Published' : 'Draft'}
          </Chip>
          <span className="text-xs font-medium text-on-surface-variant">
            {words} {words === 1 ? 'word' : 'words'} · {readTime(content)} min read
          </span>
        </div>
        <span className="text-xs font-medium text-on-surface-variant">Title {title.length} / 150</span>
      </div>

      <div className="space-y-6">
        <Field label="Title" required>
          <Input
            placeholder="Tell your story…"
            maxLength={150}
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (error) setError(null); }}
            className="!rounded-none !border-0 !border-b !border-outline-variant/60 !bg-transparent !px-0 font-display !text-3xl font-bold placeholder:text-outline-variant focus:!border-moss focus:!ring-0 md:!text-4xl"
          />
        </Field>

        <Field label="Topic" hint={wasPublished ? 'Required for published posts.' : 'Required when you publish.'}>
          <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); if (error) setError(null); }}>
            <option value="">Choose a topic…</option>
            {(cats.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>

        <RichTextEditor
          key={id || 'new'}
          value={content}
          onChange={(doc) => { setContent(doc); if (error) setError(null); }}
        />

        <ErrorNote error={error} />

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate(id ? `/posts/${id}` : '/my-posts'))}
          >
            Cancel
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => save('draft')}>
            {wasPublished ? 'Revert to draft' : 'Save draft'}
          </Button>
          <Button disabled={busy} onClick={() => save('published')}>
            {wasPublished ? 'Save changes' : 'Publish'}
          </Button>
        </div>
      </div>
    </Reading>
  );
}
