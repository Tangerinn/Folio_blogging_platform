import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { isSafeUrl } from '../../utils/content.js';
import { Button, ErrorNote, Field, Input, Modal } from '../common/ui.jsx';

const Btn = ({ active, disabled, onClick, children, label }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={active !== undefined ? Boolean(active) : undefined}
    disabled={disabled}
    onClick={onClick}
    className={`rounded-field px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
      active ? 'bg-moss text-parchment' : 'text-on-surface-variant hover:bg-surface-container'
    }`}
  >
    {children}
  </button>
);

function LinkDialog({ initialUrl, hasLink, onSave, onRemove, onClose }) {
  const [url, setUrl] = useState(initialUrl || 'https://');
  const [error, setError] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    const clean = url.trim();
    if (!clean) {
      onRemove();
      return;
    }
    if (!isSafeUrl(clean)) {
      setError('Enter a valid http:// or https:// URL.');
      return;
    }
    onSave(clean);
  };

  return (
    <Modal title={hasLink ? 'Edit link' : 'Insert link'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Link URL" hint="External links must start with http:// or https://" required>
          <Input
            type="url"
            autoFocus
            placeholder="https://example.com"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
          />
        </Field>
        {error && <ErrorNote error={error} />}
        <div className="flex flex-wrap justify-end gap-2">
          {hasLink && (
            <Button type="button" variant="outline" className="mr-auto" onClick={onRemove}>
              Remove link
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Apply link</Button>
        </div>
      </form>
    </Modal>
  );
}

function ImageDialog({ onInsert, onClose }) {
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    const cleanSrc = src.trim();
    if (!isSafeUrl(cleanSrc)) {
      setError('Image URL must start with http:// or https://.');
      return;
    }
    onInsert({
      src: cleanSrc,
      alt: alt.trim(),
      title: title.trim() || undefined,
    });
  };

  return (
    <Modal title="Insert image by URL" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Image URL" hint="Paste an externally hosted image link (http or https)." required>
          <Input
            type="url"
            autoFocus
            required
            placeholder="https://images.unsplash.com/..."
            value={src}
            onChange={(e) => { setSrc(e.target.value); setError(null); }}
          />
        </Field>
        <Field label="Alternative text" hint="Describe the image for screen readers.">
          <Input
            placeholder="e.g. Notebook open on a wooden desk"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
          />
        </Field>
        <Field label="Caption (optional)">
          <Input
            placeholder="Shown beneath the image"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        {error && <ErrorNote error={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Insert image</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RichTextEditor({ value, onChange }) {
  const [dialog, setDialog] = useState(null); // null | 'link' | 'image'

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, validate: (href) => isSafeUrl(href) }),
      Image, // external URLs only — no upload in v1 (database.md)
    ],
    content: value,
    editorProps: { attributes: { class: 'prose-folio focus:outline-none', 'aria-label': 'Article content' } },
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });

  if (!editor) return null;

  const c = () => editor.chain().focus();

  return (
    <div className="rounded-panel border border-outline-variant/60 bg-surface-low">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-1 border-b border-outline-variant/50 px-4 py-2.5"
      >
        <Btn label="Bold" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
        <Btn label="Italic" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><i>I</i></Btn>
        <Btn label="Strikethrough" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}><s>S</s></Btn>
        <Btn label="Inline code" active={editor.isActive('code')} onClick={() => c().toggleCode().run()}><code>`a`</code></Btn>
        <span className="mx-1 h-4 w-px bg-outline-variant/60" aria-hidden="true" />
        <Btn label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>H2</Btn>
        <Btn label="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}>H3</Btn>
        <Btn label="Bullet list" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>• List</Btn>
        <Btn label="Numbered list" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>1. List</Btn>
        <Btn label="Blockquote" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}>“ ”</Btn>
        <Btn label="Code block" active={editor.isActive('codeBlock')} onClick={() => c().toggleCodeBlock().run()}>{'</>'}</Btn>
        <Btn label="Divider" onClick={() => c().setHorizontalRule().run()}>—</Btn>
        <span className="mx-1 h-4 w-px bg-outline-variant/60" aria-hidden="true" />
        <Btn label="Link" active={editor.isActive('link')} onClick={() => setDialog('link')}>Link</Btn>
        <Btn label="Image by URL" onClick={() => setDialog('image')}>Image</Btn>
        <span className="ml-auto flex items-center gap-1">
          <Btn label="Undo" disabled={!editor.can().undo()} onClick={() => c().undo().run()}>Undo</Btn>
          <Btn label="Redo" disabled={!editor.can().redo()} onClick={() => c().redo().run()}>Redo</Btn>
        </span>
      </div>
      <div className="px-6 py-5"><EditorContent editor={editor} /></div>

      {dialog === 'link' && (
        <LinkDialog
          initialUrl={editor.getAttributes('link').href}
          hasLink={editor.isActive('link')}
          onSave={(href) => {
            editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
            setDialog(null);
          }}
          onRemove={() => {
            editor.chain().focus().unsetLink().run();
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'image' && (
        <ImageDialog
          onInsert={(attrs) => {
            editor.chain().focus().setImage(attrs).run();
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
