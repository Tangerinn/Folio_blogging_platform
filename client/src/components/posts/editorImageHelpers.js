import { NodeSelection, TextSelection } from '@tiptap/pm/state';

/**
 * Ensures a writable paragraph exists at `boundaryPos` and returns a valid text
 * cursor position inside the adjacent block.
 */
function ensureParagraphAfter(tr, boundaryPos, schema) {
  const $after = tr.doc.resolve(boundaryPos);
  const next = $after.nodeAfter;
  if (next && next.type.name === 'paragraph') {
    return boundaryPos + 1;
  }
  const p = schema.nodes.paragraph.create();
  tr.insert(boundaryPos, p);
  return boundaryPos + 1;
}

/**
 * Builds a ProseMirror Transaction to insert a new block image or update an
 * existing image node without losing surrounding text, formatting, or cursor flow.
 *
 * Returns `{ tr, cursorPos }` or `null` if nothing changed.
 */
export function buildImageTransaction(state, attrs, { selectionRange, editPos } = {}) {
  const { schema } = state;
  const imageNode = schema.nodes.image.create(attrs);
  const tr = state.tr;

  // Editing metadata/source of an existing image node
  if (typeof editPos === 'number') {
    const existing = tr.doc.nodeAt(editPos);
    if (!existing || existing.type.name !== 'image') return null;
    tr.setNodeMarkup(editPos, undefined, { ...existing.attrs, ...attrs });
    const afterPos = editPos + existing.nodeSize;
    const cursorPos = ensureParagraphAfter(tr, afterPos, schema);
    tr.setSelection(TextSelection.create(tr.doc, cursorPos));
    return { tr, cursorPos };
  }

  const maxPos = tr.doc.content.size;
  let from = selectionRange ? Math.max(0, Math.min(selectionRange.from, maxPos)) : state.selection.from;
  let to = selectionRange ? Math.max(0, Math.min(selectionRange.to, maxPos)) : state.selection.to;
  if (from > to) [from, to] = [to, from];

  // If the saved/current selection highlights an atom block (e.g. clicking an existing image),
  // insert the new image *after* that node instead of overwriting it.
  const maybeAtom = tr.doc.nodeAt(from);
  const isAtomSelection =
    state.selection instanceof NodeSelection ||
    (maybeAtom && !maybeAtom.isText && maybeAtom.isAtom && to === from + maybeAtom.nodeSize);

  if (isAtomSelection) {
    const insertPos = to;
    tr.insert(insertPos, imageNode);
    const cursorPos = ensureParagraphAfter(tr, insertPos + imageNode.nodeSize, schema);
    tr.setSelection(TextSelection.create(tr.doc, cursorPos));
    return { tr, cursorPos };
  }

  // Delete selected inline text before inserting if a range was highlighted
  if (from !== to) {
    tr.delete(from, to);
  }

  const mappedPos = Math.min(tr.mapping.map(from), tr.doc.content.size);
  const $pos = tr.doc.resolve(mappedPos);

  // Top-level paragraph: handle empty, start, middle, or end cleanly
  if ($pos.depth === 1 && $pos.parent.type.name === 'paragraph') {
    if ($pos.parent.content.size === 0) {
      const start = $pos.before();
      const end = $pos.after();
      tr.replaceWith(start, end, imageNode);
      const cursorPos = ensureParagraphAfter(tr, start + imageNode.nodeSize, schema);
      tr.setSelection(TextSelection.create(tr.doc, cursorPos));
      return { tr, cursorPos };
    }

    if ($pos.parentOffset === 0) {
      const insertPos = $pos.before();
      tr.insert(insertPos, imageNode);
      const cursorPos = insertPos + imageNode.nodeSize + 1;
      tr.setSelection(TextSelection.create(tr.doc, cursorPos));
      return { tr, cursorPos };
    }

    if ($pos.parentOffset === $pos.parent.content.size) {
      const insertPos = $pos.after();
      tr.insert(insertPos, imageNode);
      const cursorPos = ensureParagraphAfter(tr, insertPos + imageNode.nodeSize, schema);
      tr.setSelection(TextSelection.create(tr.doc, cursorPos));
      return { tr, cursorPos };
    }

    // Middle of paragraph: split into two paragraphs and insert image cleanly between them
    tr.split(mappedPos);
    const afterSplitPos = tr.mapping.map(mappedPos);
    const $second = tr.doc.resolve(afterSplitPos);
    const insertPos = $second.before();
    tr.insert(insertPos, imageNode);
    const cursorPos = insertPos + imageNode.nodeSize + 1;
    tr.setSelection(TextSelection.create(tr.doc, cursorPos));
    return { tr, cursorPos };
  }

  // Root boundary (GapCursor) or another block type (heading, list, quote, codeBlock)
  const insertPos = $pos.depth === 0 ? mappedPos : $pos.after(1);
  tr.insert(insertPos, imageNode);
  const cursorPos = ensureParagraphAfter(tr, insertPos + imageNode.nodeSize, schema);
  tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  return { tr, cursorPos };
}

/**
 * Inserts or focuses a paragraph immediately before or after an image node.
 */
export function buildParagraphAroundImageTransaction(state, imgPos, imgSize, side) {
  const { schema } = state;
  const tr = state.tr;

  if (side === 'before') {
    const $before = tr.doc.resolve(imgPos);
    const prev = $before.nodeBefore;
    if (prev && prev.type.name === 'paragraph' && prev.content.size === 0) {
      const cursorPos = imgPos - 1;
      tr.setSelection(TextSelection.create(tr.doc, cursorPos));
      return { tr, cursorPos };
    }
    tr.insert(imgPos, schema.nodes.paragraph.create());
    const cursorPos = imgPos + 1;
    tr.setSelection(TextSelection.create(tr.doc, cursorPos));
    return { tr, cursorPos };
  }

  const afterPos = imgPos + imgSize;
  const cursorPos = ensureParagraphAfter(tr, afterPos, schema);
  tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  return { tr, cursorPos };
}

/**
 * Removes an image node and moves selection safely into a nearby paragraph.
 */
export function buildRemoveImageTransaction(state, imgPos, imgSize) {
  const { schema } = state;
  const tr = state.tr;
  tr.delete(imgPos, imgPos + imgSize);

  if (tr.doc.childCount === 0) {
    tr.insert(0, schema.nodes.paragraph.create());
  }

  const clamped = Math.min(imgPos, tr.doc.content.size);
  const $near = tr.doc.resolve(clamped);

  if ($near.nodeAfter && $near.nodeAfter.isTextblock) {
    const pos = clamped + 1;
    tr.setSelection(TextSelection.create(tr.doc, pos));
    return tr;
  }
  if ($near.nodeBefore && $near.nodeBefore.isTextblock) {
    const pos = clamped - 1;
    tr.setSelection(TextSelection.create(tr.doc, pos));
    return tr;
  }

  const p = schema.nodes.paragraph.create();
  tr.insert(clamped, p);
  tr.setSelection(TextSelection.create(tr.doc, clamped + 1));
  return tr;
}

/**
 * Ensures the end of the document has an editable paragraph when clicking below trailing blocks.
 */
export function buildTrailingParagraphTransaction(state) {
  const last = state.doc.lastChild;
  if (last && last.type.name === 'paragraph') return null;
  const tr = state.tr;
  const endPos = tr.doc.content.size;
  tr.insert(endPos, state.schema.nodes.paragraph.create());
  tr.setSelection(TextSelection.create(tr.doc, endPos + 1));
  return tr;
}

