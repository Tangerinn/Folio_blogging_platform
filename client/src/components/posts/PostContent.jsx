import { isSafeUrl } from '../../utils/content.js';

// Renders structured editor JSON as React elements. No dangerouslySetInnerHTML anywhere
// (security.md §10): unknown node types render nothing, and only http(s) URLs are used.
function Marks({ node }) {
  let el = node.text ?? '';
  (node.marks || []).forEach((m) => {
    if (m.type === 'bold') el = <strong>{el}</strong>;
    else if (m.type === 'italic') el = <em>{el}</em>;
    else if (m.type === 'strike') el = <s>{el}</s>;
    else if (m.type === 'code') el = <code>{el}</code>;
    else if (m.type === 'link' && isSafeUrl(m.attrs?.href)) {
      el = <a href={m.attrs.href} target="_blank" rel="noopener noreferrer nofollow">{el}</a>;
    }
  });
  return <>{el}</>;
}

function Node({ node }) {
  if (!node || typeof node !== 'object') return null;
  const kids = (node.content || []).map((c, i) => <Node key={i} node={c} />);
  switch (node.type) {
    case 'text': return <Marks node={node} />;
    case 'paragraph': return <p>{kids}</p>;
    case 'heading': {
      const T = `h${Math.min(Math.max(node.attrs?.level || 2, 1), 3)}`;
      return <T>{kids}</T>;
    }
    case 'bulletList': return <ul>{kids}</ul>;
    case 'orderedList': return <ol>{kids}</ol>;
    case 'listItem': return <li>{kids}</li>;
    case 'blockquote': return <blockquote>{kids}</blockquote>;
    case 'codeBlock': return <pre><code>{kids}</code></pre>;
    case 'hardBreak': return <br />;
    case 'horizontalRule': return <hr />;
    case 'image': {
      const { src, alt, title } = node.attrs || {};
      if (!isSafeUrl(src)) return null;
      return (
        <figure>
          <img src={src} alt={alt || ''} loading="lazy" referrerPolicy="no-referrer" />
          {title && <figcaption>{title}</figcaption>}
        </figure>
      );
    }
    default: return null;
  }
}

export default function PostContent({ doc }) {
  if (!doc || !Array.isArray(doc.content)) return null;
  return <div className="prose-folio">{doc.content.map((n, i) => <Node key={i} node={n} />)}</div>;
}
