import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { NodeSelection } from '@tiptap/pm/state';
import { isSafeImageSrc, isSafeUrl } from '../../utils/content.js';
import { api } from '../../services/api/index.js';
import {
  buildImageTransaction,
  buildParagraphAroundImageTransaction,
  buildRemoveImageTransaction,
  buildTrailingParagraphTransaction,
} from './editorImageHelpers.js';
import { Button, ErrorNote, Field, Input, Modal } from '../common/ui.jsx';

const stopMouseDown = (e) => e.preventDefault();

const Btn = ({ active, disabled, onClick, children, label }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={active !== undefined ? Boolean(active) : undefined}
    disabled={disabled}
    onMouseDown={stopMouseDown}
    onClick={onClick}
    className={`rounded-field px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
      active ? 'bg-moss text-parchment' : 'text-on-surface-variant hover:bg-surface-container'
    }`}
  >
    {children}
  </button>
);

const imgActionBtn =
  'rounded-field px-2.5 py-1 text-xs font-medium text-pine transition hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-moss';

function ImageNodeView({ node, selected, getPos, editor, extension }) {
  const { src, alt, title } = node.attrs || {};
  const safeSrc = isSafeImageSrc(src) ? src : '';

  const moveParagraph = (side) => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos !== 'number') return;
    const res = buildParagraphAroundImageTransaction(editor.state, pos, node.nodeSize, side);
    if (!res) return;
    editor.view.dispatch(res.tr.scrollIntoView());
    editor.view.focus();
  };

  const openEdit = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos !== 'number') return;
    extension.options.onEdit?.({ pos, attrs: node.attrs });
  };

  const remove = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos !== 'number') return;
    const tr = buildRemoveImageTransaction(editor.state, pos, node.nodeSize);
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
  };

  const selectThisNode = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (typeof pos !== 'number') return;
    const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos));
    editor.view.dispatch(tr);
  };

  return (
    <NodeViewWrapper as="figure" className="my-6" data-drag-handle="">
      <div
        className={`relative rounded-panel border p-2 transition ${
          selected
            ? 'border-moss bg-sage/10 ring-2 ring-moonlit-sage'
            : 'border-transparent hover:border-outline-variant/60'
        }`}
      >
        {selected && (
          <div
            role="toolbar"
            aria-label="Image actions"
            contentEditable={false}
            className="mb-2 flex flex-wrap items-center justify-between gap-1 rounded-field border border-outline-variant/60 bg-surface px-2 py-1"
          >
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" className={imgActionBtn} onMouseDown={stopMouseDown} onClick={() => moveParagraph('before')}>
                + Type before
              </button>
              <button type="button" className={imgActionBtn} onMouseDown={stopMouseDown} onClick={() => moveParagraph('after')}>
                + Type after
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className={imgActionBtn} onMouseDown={stopMouseDown} onClick={openEdit}>
                Edit
              </button>
              <button
                type="button"
                className="rounded-field px-2.5 py-1 text-xs font-medium text-error transition hover:bg-error-container/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
                onMouseDown={stopMouseDown}
                onClick={remove}
              >
                Remove
              </button>
            </div>
          </div>
        )}

        <img
          src={safeSrc}
          alt={alt || ''}
          title={title || undefined}
          onClick={selectThisNode}
          onDoubleClick={openEdit}
          className="mx-auto block max-h-[520px] w-auto max-w-full cursor-pointer rounded-xl object-contain"
        />

        {title && (
          <figcaption className="mt-2 text-center text-sm text-on-surface-variant">{title}</figcaption>
        )}
      </div>
    </NodeViewWrapper>
  );
}

const FolioImage = Image.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      inline: false,
      allowBase64: true,
      onEdit: null,
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { selection } = this.editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) {
          return false;
        }
        const res = buildParagraphAroundImageTransaction(
          this.editor.state,
          selection.from,
          selection.node.nodeSize,
          'after'
        );
        if (!res) return false;
        this.editor.view.dispatch(res.tr.scrollIntoView());
        return true;
      },
      'Shift-Enter': () => {
        const { selection } = this.editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) {
          return false;
        }
        const res = buildParagraphAroundImageTransaction(
          this.editor.state,
          selection.from,
          selection.node.nodeSize,
          'before'
        );
        if (!res) return false;
        this.editor.view.dispatch(res.tr.scrollIntoView());
        return true;
      },
    };
  },
});

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

function ImageDialog({ initial, onInsert, onClose }) {
  const isEditing = typeof initial?.pos === 'number';
  const initialSrc = initial?.attrs?.src || '';
  const initialIsUrl = isEditing && isSafeUrl(initialSrc);

  const [mode, setMode] = useState(initialIsUrl ? 'url' : 'upload');
  const [urlSrc, setUrlSrc] = useState(initialIsUrl ? initialSrc : '');
  const [uploadedSrc, setUploadedSrc] = useState(!initialIsUrl && isSafeImageSrc(initialSrc) ? initialSrc : '');
  const [fileName, setFileName] = useState('');
  const [alt, setAlt] = useState(initial?.attrs?.alt || '');
  const [title, setTitle] = useState(initial?.attrs?.title || '');
  const [error, setError] = useState(null);
  const [readingFile, setReadingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const fileInputId = useId();

  const handleFile = async (file) => {
    if (!file) return;
    setReadingFile(true);
    setError(null);
    try {
      const res = await api.uploadImage(file);
      setUploadedSrc(res.url);
      setFileName(file.name);
    } catch (err) {
      setError(err.message || 'Could not load that image file.');
    } finally {
      setReadingFile(false);
    }
  };

  const activePreview =
    mode === 'upload'
      ? uploadedSrc
      : isSafeUrl(urlSrc.trim())
        ? urlSrc.trim()
        : '';

  const submit = (e) => {
    e.preventDefault();
    if (readingFile) return;

    const cleanSrc = mode === 'upload' ? uploadedSrc : urlSrc.trim();
    if (mode === 'upload') {
      if (!isSafeImageSrc(cleanSrc)) {
        setError('Choose an image file from your device or switch to From URL.');
        return;
      }
    } else if (!isSafeUrl(cleanSrc)) {
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
    <Modal title={isEditing ? 'Edit image' : 'Insert image'} onClose={onClose} dismissible={!readingFile}>
      <div role="tablist" aria-label="Image source" className="mb-5 flex items-center gap-6 border-b border-outline-variant/60">
        {[
          { key: 'upload', label: 'Upload from device' },
          { key: 'url', label: 'From URL' },
        ].map((tab) => {
          const active = mode === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => { setMode(tab.key); setError(null); }}
              className={`-mb-px border-b-2 pb-2.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
                active
                  ? 'border-pine font-semibold text-pine'
                  : 'border-transparent font-medium text-on-surface-variant hover:text-pine'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} noValidate className="space-y-4">
        {mode === 'upload' ? (
          <div className="space-y-2">
            <label htmlFor={fileInputId} className="block text-sm font-medium text-on-surface-variant">
              Image file <span className="text-error" aria-hidden="true">*</span>
            </label>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="visually-hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer?.files?.[0]);
              }}
              className={`rounded-panel border border-dashed p-4 text-center transition ${
                dragOver
                  ? 'border-moss bg-sage/15'
                  : 'border-sage/60 bg-surface-container'
              }`}
            >
              {uploadedSrc ? (
                <div className="space-y-3">
                  <img
                    src={uploadedSrc}
                    alt={alt || 'Selected preview'}
                    className="mx-auto max-h-40 rounded-field border border-outline-variant/40 object-contain"
                  />
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-on-surface-variant">
                    {fileName && <span className="max-w-[200px] truncate font-medium text-pine">{fileName}</span>}
                    <Button
                      type="button"
                      variant="secondary"
                      className="!px-3 !py-1.5 !text-xs"
                      disabled={readingFile}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Replace image
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <p className="text-sm text-on-surface-variant">
                    {readingFile ? 'Preparing image…' : 'Drop an image here, or choose a file from your device.'}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={readingFile}
                    autoFocus={!initialIsUrl}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {readingFile ? 'Preparing…' : 'Choose image'}
                  </Button>
                  <p className="text-xs text-on-surface-variant">PNG, JPEG, WebP, or GIF · Up to 10 MB</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Image URL" hint="Paste an externally hosted image link (http or https)." required>
              <Input
                type="url"
                autoFocus={mode === 'url'}
                required
                placeholder="https://images.unsplash.com/..."
                value={urlSrc}
                onChange={(e) => { setUrlSrc(e.target.value); setError(null); }}
              />
            </Field>
            {activePreview && (
              <div className="rounded-field border border-outline-variant/40 bg-surface-container p-2">
                <img
                  src={activePreview}
                  alt={alt || 'URL preview'}
                  className="mx-auto max-h-36 rounded-field object-contain"
                />
              </div>
            )}
          </div>
        )}

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
          <Button type="button" variant="ghost" disabled={readingFile} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={readingFile}>
            {readingFile ? 'Preparing…' : isEditing ? 'Save image' : 'Insert image'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RichTextEditor({ value, onChange }) {
  const [dialog, setDialog] = useState(null); // null | { type: 'link' } | { type: 'image', pos?, attrs? }
  const [uploadError, setUploadError] = useState(null);
  const savedSelectionRef = useRef(null);
  const focusTimerRef = useRef(null);
  const editImageHandlerRef = useRef(null);
  const surfaceRef = useRef(null);

  const scheduleFocus = (cursorPos) => {
    if (focusTimerRef.current) cancelAnimationFrame(focusTimerRef.current);
    focusTimerRef.current = requestAnimationFrame(() => {
      if (!editor || editor.isDestroyed) return;
      if (typeof cursorPos === 'number') {
        const clamped = Math.max(0, Math.min(cursorPos, editor.state.doc.content.size));
        editor.chain().setTextSelection(clamped).focus().scrollIntoView().run();
      } else {
        editor.commands.focus();
      }
    });
  };

  useEffect(() => () => {
    if (focusTimerRef.current) cancelAnimationFrame(focusTimerRef.current);
  }, []);

  const imageExtension = useMemo(
    () =>
      FolioImage.configure({
        onEdit: (info) => editImageHandlerRef.current?.(info),
      }),
    []
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, validate: (href) => isSafeUrl(href) }),
      imageExtension,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose-folio focus:outline-none',
        'aria-label': 'Article content',
      },
      handleDrop: (view, event) => {
        const file = Array.from(event.dataTransfer?.files || []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const dropRange = coords ? { from: coords.pos, to: coords.pos } : undefined;
        setUploadError(null);
        readImageFile(file)
          .then((src) => {
            if (view.isDestroyed) return;
            const res = buildImageTransaction(view.state, { src, alt: '' }, { selectionRange: dropRange });
            if (!res) return;
            view.dispatch(res.tr.scrollIntoView());
            view.focus();
          })
          .catch((err) => setUploadError(err.message || 'Could not insert dropped image.'));
        return true;
      },
      handlePaste: (view, event) => {
        const file = Array.from(event.clipboardData?.files || []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        const sel = view.state.selection;
        const pasteRange = { from: sel.from, to: sel.to };
        setUploadError(null);
        readImageFile(file)
          .then((src) => {
            if (view.isDestroyed) return;
            const res = buildImageTransaction(view.state, { src, alt: '' }, { selectionRange: pasteRange });
            if (!res) return;
            view.dispatch(res.tr.scrollIntoView());
            view.focus();
          })
          .catch((err) => setUploadError(err.message || 'Could not paste image.'));
        return true;
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });

  editImageHandlerRef.current = ({ pos, attrs }) => {
    if (!editor) return;
    setUploadError(null);
    savedSelectionRef.current = { from: pos, to: pos };
    setDialog({ type: 'image', pos, attrs });
  };

  if (!editor) return null;

  const openLinkDialog = () => {
    const { from, to } = editor.state.selection;
    savedSelectionRef.current = { from, to };
    setDialog({ type: 'link' });
  };

  const openImageDialog = () => {
    setUploadError(null);
    const { from, to } = editor.state.selection;
    savedSelectionRef.current = { from, to };
    setDialog({ type: 'image' });
  };

  const closeDialog = () => {
    const restorePos = savedSelectionRef.current?.to ?? savedSelectionRef.current?.from;
    setDialog(null);
    scheduleFocus(restorePos);
  };

  const handleSurfaceClick = (e) => {
    if (!editor || editor.isDestroyed) return;
    const isContainerClick = e.target === surfaceRef.current || e.target === editor.view.dom;
    if (!isContainerClick) return;

    const lastChild = editor.view.dom.lastElementChild;
    const clickedBelowLast = !lastChild || e.clientY > lastChild.getBoundingClientRect().bottom;
    if (!clickedBelowLast && e.target !== surfaceRef.current) return;

    const tr = buildTrailingParagraphTransaction(editor.state);
    if (tr) {
      editor.view.dispatch(tr.scrollIntoView());
      editor.view.focus();
    } else if (e.target === surfaceRef.current) {
      editor.chain().focus('end').run();
    }
  };

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
        <Btn label="Insert link" active={editor.isActive('link')} onClick={openLinkDialog}>Link</Btn>
        <Btn label="Insert image" onClick={openImageDialog}>Image</Btn>
        <span className="ml-auto flex items-center gap-1">
          <Btn label="Undo" disabled={!editor.can().undo()} onClick={() => c().undo().run()}>Undo</Btn>
          <Btn label="Redo" disabled={!editor.can().redo()} onClick={() => c().redo().run()}>Redo</Btn>
        </span>
      </div>

      {uploadError && (
        <div className="border-b border-outline-variant/40 px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <ErrorNote error={uploadError} />
            <button
              type="button"
              aria-label="Dismiss image error"
              onClick={() => setUploadError(null)}
              className="rounded-field px-2 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div ref={surfaceRef} onClick={handleSurfaceClick} className="cursor-text px-6 py-5 pb-12">
        <EditorContent editor={editor} />
      </div>

      {dialog?.type === 'link' && (
        <LinkDialog
          initialUrl={editor.getAttributes('link').href}
          hasLink={editor.isActive('link')}
          onSave={(href) => {
            const range = savedSelectionRef.current;
            setDialog(null);
            if (range) {
              editor.chain().setTextSelection(range).extendMarkRange('link').setLink({ href }).run();
            } else {
              editor.chain().extendMarkRange('link').setLink({ href }).run();
            }
            scheduleFocus(range?.to);
          }}
          onRemove={() => {
            const range = savedSelectionRef.current;
            setDialog(null);
            if (range) {
              editor.chain().setTextSelection(range).unsetLink().run();
            } else {
              editor.chain().unsetLink().run();
            }
            scheduleFocus(range?.to);
          }}
          onClose={closeDialog}
        />
      )}

      {dialog?.type === 'image' && (
        <ImageDialog
          initial={dialog}
          onInsert={(attrs) => {
            const editPos = dialog.pos;
            const range = savedSelectionRef.current;
            setDialog(null);
            const res = buildImageTransaction(editor.state, attrs, {
              selectionRange: range,
              editPos,
            });
            if (res) {
              editor.view.dispatch(res.tr);
              scheduleFocus(res.cursorPos);
            } else {
              scheduleFocus(range?.to);
            }
          }}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
