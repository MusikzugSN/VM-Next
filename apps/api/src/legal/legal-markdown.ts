import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

/**
 * Markdown → HTML for the legal documents (S-7).
 *
 * Three layers: the renderer escapes every club value, markdown-it ignores raw HTML (`html: false`),
 * and sanitize-html only lets a fixed set of tags through. Links must be http(s) or mailto.
 */
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: true });

const ALLOWED_TAGS = ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'hr', 'code'];

export function markdownToHtml(source: string): string {
  return sanitizeHtml(markdown.render(source), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } }),
    },
  }).trim();
}
