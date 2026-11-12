import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useAuth } from '../../state/AuthContext.jsx';
import { BotanicalSprig, LeafMark } from '../../components/common/BotanicalArt.jsx';
import PostCard from '../../components/posts/PostCard.jsx';
import { Avatar, Button, EmptyState, ErrorNote, Field, Input, Spinner, Textarea } from '../../components/common/ui.jsx';
import { formatDate } from '../../utils/format.js';

// /profile → own profile (editable). /users/:id → anyone's public profile.
// Inspired by a framed botanical field journal + Medium's profile tabs.
export default function Profile() {
  const params = useParams();
  const { user, updateUser } = useAuth();
  const id = params.id || user?.id;
  const own = Boolean(user && id === user.id);
  const { data, loading, error, reload } = useAsync(() => api.getProfile(id), [id]);
  const saved = useAsync(() => (own ? api.listBookmarks() : Promise.resolve([])), [own, id]);

  const [tab, setTab] = useState('published');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '' });
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTab('published');
    setEditing(false);
    setSaveError(null);
  }, [id]);

  if (loading && (!data || data.user.id !== id)) return <Spinner />;
  if (error) {
    return (
      <div className="mx-auto max-w-[760px] px-5 py-10">
        <EmptyState title="User not found" action={<Link to="/explore"><Button>Explore posts</Button></Link>}>
          This profile is unavailable.
        </EmptyState>
      </div>
    );
  }

  const startEdit = () => {
    setForm({ name: data.user.name, bio: data.user.bio || '' });
    setSaveError(null);
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setSaveError(new Error('Name is required.'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const u = await api.updateProfile({ name: form.name.trim(), bio: form.bio });
      updateUser({ ...user, ...u });
      setEditing(false);
      reload();
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  const savedPosts = saved.data || [];
  const recentSaved = savedPosts.slice(0, 5);
  const handleSlug = data.user.name.toLowerCase().replace(/[^a-z0-9]+/g, '');

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-10 md:py-10">
      {/* Framed Field-Journal Profile Shell */}
      <div className="bg-field-grid overflow-hidden rounded-panel border border-moss/35 bg-surface-low">
        {/* Journal Title Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-moss/25 bg-surface-container/90 px-5 py-3 text-xs font-medium text-on-surface-variant sm:px-7">
          <div className="flex items-center gap-2">
            <LeafMark className="h-4 w-4 text-moss" />
            <span className="font-semibold text-pine">@{handleSlug || 'writer'}</span>
            <span aria-hidden="true">·</span>
            <span>Member since {formatDate(data.user.createdAt)}</span>
          </div>
          <span className="rounded-full border border-sage/40 bg-sage/15 px-2.5 py-0.5 text-[11px] font-semibold text-moss">
            {own ? 'Your Journal' : 'Author Profile'}
          </span>
        </div>

        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[290px_1fr]">
          {/* Left Deep-Moss Identity Column */}
          <aside className="relative overflow-hidden rounded-panel border border-pine/40 bg-primary p-6 text-parchment self-start">
            <BotanicalSprig className="pointer-events-none -right-5 -bottom-5 absolute h-32 w-32 text-on-primary-container/20" />
            <div className="relative">
              <div className="flex items-center gap-4 lg:flex-col lg:items-start">
                <Avatar name={data.user.name} size={72} />
                <div>
                  <h1 className="font-display text-2xl font-bold leading-tight text-parchment">
                    {data.user.name}
                  </h1>
                  <p className="mt-0.5 text-xs text-on-primary-container">
                    {data.posts.length} published {data.posts.length === 1 ? 'post' : 'posts'}
                    {own && ` · ${savedPosts.length} saved`}
                  </p>
                </div>
              </div>

              {editing ? (
                <form onSubmit={save} className="mt-5 space-y-3 rounded-field bg-surface p-4 text-on-surface">
                  <Field label="Name" required>
                    <Input
                      required
                      maxLength={80}
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => { setForm({ ...form, name: e.target.value }); if (saveError) setSaveError(null); }}
                    />
                  </Field>
                  <Field label="Bio" hint={`${form.bio.length} / 300 characters`}>
                    <Textarea
                      rows={3}
                      maxLength={300}
                      placeholder="Share what you study or write about…"
                      value={form.bio}
                      onChange={(e) => { setForm({ ...form, bio: e.target.value }); if (saveError) setSaveError(null); }}
                    />
                  </Field>
                  <ErrorNote error={saveError} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" className="!py-2" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                    <Button type="button" variant="ghost" className="!py-2" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="mt-5 rounded-field border border-on-primary-container/20 bg-pine/35 p-4 text-sm leading-relaxed text-on-primary-container">
                    {data.user.bio || (own ? 'Add a short note so readers know what you study and write about.' : 'No bio yet.')}
                  </div>

                  {own && (
                    <div className="mt-5 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={startEdit}
                        className="w-full rounded-btn bg-parchment px-4 py-2 text-sm font-semibold text-pine transition hover:bg-secondary-container"
                      >
                        Edit profile
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          to="/write"
                          className="inline-flex items-center justify-center rounded-btn border border-on-primary-container/40 px-3 py-2 text-xs font-semibold text-parchment transition hover:bg-primary-container"
                        >
                          Write post
                        </Link>
                        <Link
                          to="/my-posts"
                          className="inline-flex items-center justify-center rounded-btn border border-on-primary-container/40 px-3 py-2 text-xs font-semibold text-parchment transition hover:bg-primary-container"
                        >
                          My posts
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>

          {/* Right Content Column */}
          <div className="min-w-0 rounded-panel border border-outline-variant/50 bg-surface p-6 sm:p-8">
            <div role="tablist" aria-label="Profile content" className="flex items-center gap-6 border-b border-outline-variant/60">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'published'}
                onClick={() => setTab('published')}
                className={`-mb-px border-b-2 pb-3 text-sm transition focus:outline-none ${
                  tab === 'published'
                    ? 'border-pine font-semibold text-pine'
                    : 'border-transparent font-medium text-on-surface-variant hover:text-pine'
                }`}
              >
                Published ({data.posts.length})
              </button>
              {own && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'saved'}
                  onClick={() => setTab('saved')}
                  className={`-mb-px border-b-2 pb-3 text-sm transition focus:outline-none ${
                    tab === 'saved'
                      ? 'border-pine font-semibold text-pine'
                      : 'border-transparent font-medium text-on-surface-variant hover:text-pine'
                  }`}
                >
                  Recently saved ({savedPosts.length})
                </button>
              )}
            </div>

            {!(tab === 'saved' && own) ? (
              data.posts.length === 0 ? (
                <EmptyState
                  title="No published posts yet"
                  action={own && <Link to="/write"><Button>Write your first post</Button></Link>}
                />
              ) : (
                <div>
                  {data.posts.map((p) => <PostCard key={p.id} post={p} />)}
                </div>
              )
            ) : (
              <div>
                {saved.loading ? (
                  <Spinner />
                ) : saved.error ? (
                  <div className="mt-6"><ErrorNote error={saved.error} /></div>
                ) : recentSaved.length === 0 ? (
                  <EmptyState
                    title="Nothing saved yet"
                    action={<Link to="/explore"><Button variant="secondary">Explore stories</Button></Link>}
                  >
                    Bookmark posts while reading and they’ll appear here.
                  </EmptyState>
                ) : (
                  <>
                    {recentSaved.map((p) => (
                      <PostCard key={p.id} post={p} onBookmarkChange={() => saved.reload()} />
                    ))}
                    {savedPosts.length > 5 && (
                      <div className="pt-6 text-right">
                        <Link to="/saved" className="text-sm font-semibold text-moss hover:underline">
                          View all saved ({savedPosts.length}) →
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
