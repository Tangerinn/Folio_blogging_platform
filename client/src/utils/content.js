// Helpers for the structured editor JSON (TipTap/ProseMirror format).
// Post.content is a JSON document; see database.md (Post) and security.md §10.

export const isSafeUrl = (url) => typeof url === 'string' && /^https?:\/\//i.test(url.trim());

const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
export const isSafeImageSrc = (src) =>
  typeof src === 'string' && (isSafeUrl(src) || SAFE_DATA_IMAGE.test(src.trim()));

export function extractText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  const inner = (node.content || []).map(extractText).join(node.type === 'doc' ? '\n' : ' ');
  return inner;
}

export function excerpt(doc, max = 160) {
  const text = extractText(doc).replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

export function wordCount(doc) {
  return extractText(doc).split(/\s+/).filter(Boolean).length;
}

export function readTime(doc) {
  return Math.max(1, Math.round(wordCount(doc) / 220));
}

export function firstImage(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'image' && isSafeImageSrc(node.attrs?.src)) {
    return { src: node.attrs.src, alt: node.attrs.alt || '' };
  }
  for (const child of node.content || []) {
    const found = firstImage(child);
    if (found) return found;
  }
  return null;
}

function hasImage(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'image' && isSafeImageSrc(node.attrs?.src)) return true;
  return (node.content || []).some(hasImage);
}

export function isEmptyDoc(doc) {
  return extractText(doc).trim().length === 0 && !hasImage(doc);
}

export const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

// Tiny builders used by the seed data
export const p = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
export const h = (text, level = 2) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
export const li = (text) => ({ type: 'listItem', content: [p(text)] });
export const ul = (...items) => ({ type: 'bulletList', content: items.map(li) });
export const code = (text) => ({ type: 'codeBlock', content: [{ type: 'text', text }] });
export const quote = (text) => ({ type: 'blockquote', content: [p(text)] });
export const img = (src, alt, title) => ({ type: 'image', attrs: { src, alt, title } });
export const doc = (...content) => ({ type: 'doc', content });
