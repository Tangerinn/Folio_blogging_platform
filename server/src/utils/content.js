const ALLOWED_NODES = new Set([
  'doc',
  'paragraph',
  'heading',
  'text',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'hardBreak',
  'horizontalRule',
  'image',
]);

const ALLOWED_MARKS = new Set(['bold', 'italic', 'strike', 'code', 'link']);
const MAX_DOC_DEPTH = 32;

/**
 * Extracts plain text from a structured TipTap/ProseMirror JSON document.
 */
function extractText(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.text || '';
  return (node.content || []).map(extractText).join(node.type === 'doc' ? '\n' : ' ');
}

/**
 * Checks whether a value is a well-formed http:// or https:// URL.
 */
function isSafeHttpUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function hasValidImage(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'image' && isSafeHttpUrl(node.attrs?.src)) return true;
  return Array.isArray(node.content) && node.content.some(hasValidImage);
}

/**
 * Returns true when a TipTap document contains neither non-whitespace text nor a valid image.
 */
function isEmptyDoc(doc) {
  return extractText(doc).trim().length === 0 && !hasValidImage(doc);
}

function assertPlainObject(val) {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

function sanitizeMarks(marks, fail) {
  if (marks === undefined) return undefined;
  if (!Array.isArray(marks)) fail('Invalid text marks in content.');

  return marks.map((mark) => {
    if (!assertPlainObject(mark) || !ALLOWED_MARKS.has(mark.type)) {
      fail('Unsupported formatting mark in content.');
    }
    if (mark.type !== 'link') {
      return { type: mark.type };
    }
    if (!assertPlainObject(mark.attrs) || !isSafeHttpUrl(mark.attrs.href)) {
      fail('Links must use a valid http:// or https:// URL.');
    }
    const attrs = { href: mark.attrs.href.trim() };
    if (mark.attrs.target !== undefined && mark.attrs.target !== null) {
      if (typeof mark.attrs.target !== 'string') fail('Invalid link target attribute.');
      attrs.target = mark.attrs.target;
    }
    if (mark.attrs.rel !== undefined && mark.attrs.rel !== null) {
      if (typeof mark.attrs.rel !== 'string') fail('Invalid link rel attribute.');
      attrs.rel = mark.attrs.rel;
    }
    return { type: 'link', attrs };
  });
}

function sanitizeNode(node, depth, fail) {
  if (depth > MAX_DOC_DEPTH) {
    fail('Content nesting exceeds the maximum allowed depth.');
  }
  if (!assertPlainObject(node) || typeof node.type !== 'string' || !ALLOWED_NODES.has(node.type)) {
    fail('Unsupported or invalid node type in post content.');
  }
  if (depth > 0 && node.type === 'doc') {
    fail('Nested document nodes are not allowed.');
  }

  if (node.type === 'text') {
    if (typeof node.text !== 'string') {
      fail('Text nodes must contain a string value.');
    }
    if (node.content !== undefined) {
      fail('Text nodes cannot contain child nodes.');
    }
    const cleaned = { type: 'text', text: node.text };
    const marks = sanitizeMarks(node.marks, fail);
    if (marks && marks.length > 0) cleaned.marks = marks;
    return cleaned;
  }

  const cleaned = { type: node.type };

  if (node.type === 'heading') {
    const level = node.attrs?.level ?? 2;
    if (!Number.isInteger(level) || level < 1 || level > 6) {
      fail('Heading level must be an integer between 1 and 6.');
    }
    cleaned.attrs = { level };
  } else if (node.type === 'orderedList' && node.attrs?.start !== undefined) {
    const start = node.attrs.start;
    if (!Number.isInteger(start) || start < 1) {
      fail('Ordered list start must be a positive integer.');
    }
    cleaned.attrs = { start };
  } else if (node.type === 'codeBlock' && node.attrs?.language !== undefined && node.attrs?.language !== null) {
    if (typeof node.attrs.language !== 'string' || node.attrs.language.length > 50) {
      fail('Invalid code block language attribute.');
    }
    cleaned.attrs = { language: node.attrs.language };
  } else if (node.type === 'image') {
    if (!assertPlainObject(node.attrs) || !isSafeHttpUrl(node.attrs.src)) {
      fail('Images must use a valid http:// or https:// URL.');
    }
    const attrs = { src: node.attrs.src.trim() };
    if (node.attrs.alt !== undefined && node.attrs.alt !== null) {
      if (typeof node.attrs.alt !== 'string') fail('Image alt text must be a string.');
      attrs.alt = node.attrs.alt;
    }
    if (node.attrs.title !== undefined && node.attrs.title !== null) {
      if (typeof node.attrs.title !== 'string') fail('Image caption must be a string.');
      attrs.title = node.attrs.title;
    }
    cleaned.attrs = attrs;
  }

  if (node.content !== undefined) {
    if (!Array.isArray(node.content)) {
      fail('Node content must be an array.');
    }
    cleaned.content = node.content.map((child) => sanitizeNode(child, depth + 1, fail));
  } else if (node.type === 'doc') {
    cleaned.content = [];
  }

  return cleaned;
}

/**
 * Validates and sanitizes a TipTap/ProseMirror JSON document.
 */
function validateTipTapDoc(doc, createError) {
  const fail = (message) => {
    throw createError ? createError(message) : new Error(message);
  };
  if (!assertPlainObject(doc) || doc.type !== 'doc') {
    fail('Post content must be a valid rich-text document.');
  }
  return sanitizeNode(doc, 0, fail);
}

module.exports = {
  extractText,
  isSafeHttpUrl,
  isEmptyDoc,
  validateTipTapDoc,
};
