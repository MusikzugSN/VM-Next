/**
 * Minimal template renderer for the legal documents (S-7): placeholders and conditions only.
 *
 * - `{{a.b}}` inserts a value, always escaped for Markdown (and thereby for HTML).
 * - `{{#if a.b}} … {{else}} … {{/if}}`, nestable.
 *
 * Everything else is Markdown and is converted to HTML afterwards (`legal-markdown.ts`).
 * Values that must not be escaped (generated lists, links) are wrapped in `TrustedMarkdown` by the
 * code building the context – never by data coming from a request.
 */

/** Markdown produced by our own code from already escaped parts. */
export class TrustedMarkdown {
  constructor(readonly markdown: string) {}
}

export type TemplateValue = string | number | boolean | null | TrustedMarkdown | TemplateContext | readonly unknown[];
export interface TemplateContext {
  readonly [key: string]: TemplateValue | undefined;
}

export class TemplateError extends Error {}

type Node =
  | { kind: 'text'; text: string }
  | { kind: 'var'; path: string }
  | { kind: 'if'; path: string; then: Node[]; otherwise: Node[] };

const PATH = /^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)*$/;
const TAG = /\{\{\s*([^}]*?)\s*\}\}/g;

/** Parses a template; unknown tags and unbalanced conditions are errors. */
export function parseTemplate(source: string): Node[] {
  const root: Node[] = [];
  const stack: { node: Extract<Node, { kind: 'if' }>; inElse: boolean }[] = [];
  const target = () => {
    const top = stack.at(-1);
    return top ? (top.inElse ? top.node.otherwise : top.node.then) : root;
  };

  let last = 0;
  for (const match of source.matchAll(TAG)) {
    if (match.index > last) target().push({ kind: 'text', text: source.slice(last, match.index) });
    last = match.index + match[0].length;
    const tag = match[1];
    const ifMatch = /^#if\s+(\S+)$/.exec(tag);
    if (ifMatch) {
      const path = checkPath(ifMatch[1]);
      const node: Extract<Node, { kind: 'if' }> = { kind: 'if', path, then: [], otherwise: [] };
      target().push(node);
      stack.push({ node, inElse: false });
    } else if (tag === 'else') {
      const top = stack.at(-1);
      if (!top || top.inElse) throw new TemplateError('{{else}} without {{#if}}');
      top.inElse = true;
    } else if (tag === '/if') {
      if (!stack.pop()) throw new TemplateError('{{/if}} without {{#if}}');
    } else {
      target().push({ kind: 'var', path: checkPath(tag) });
    }
  }
  if (last < source.length) target().push({ kind: 'text', text: source.slice(last) });
  if (stack.length) throw new TemplateError(`{{#if ${stack[0].node.path}}} is not closed`);
  return root;
}

function checkPath(path: string): string {
  if (!PATH.test(path)) throw new TemplateError(`Unknown template tag {{${path}}}`);
  return path;
}

/** Escapes text so Markdown shows it literally: every ASCII punctuation gets a backslash. */
export function escapeMarkdownInline(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[!-/:-@[-`{-~]/g, '\\$&');
}

/** Like `escapeMarkdownInline`, but keeps paragraphs (blank lines) and single line breaks. */
export function escapeMarkdownBlock(value: string): TrustedMarkdown {
  const paragraphs = value
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((line) => escapeMarkdownInline(line))
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean);
  return new TrustedMarkdown(paragraphs.join('\n\n'));
}

/** Looks up a dotted path. `undefined`: the path does not exist; `null`: the value is not set. */
export function lookup(context: TemplateContext, path: string): TemplateValue | undefined {
  let current: TemplateValue | undefined = context;
  for (const key of path.split('.')) {
    if (current === null) return null;
    if (current === undefined || typeof current !== 'object' || current instanceof TrustedMarkdown || Array.isArray(current)) return undefined;
    current = (current as TemplateContext)[key];
  }
  return current;
}

/** Set: not `null`/`undefined`/`false`/`''`/empty list. Numbers are always set, also `0`. */
export function isSet(value: TemplateValue | undefined): boolean {
  if (value === null || value === undefined || value === false || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export interface RenderOptions {
  /** Text for a placeholder without value; default: empty. The preview shows „[fehlt: …]“. */
  missing?: (path: string) => string;
}

export interface RenderResult {
  markdown: string;
  /** Placeholders that were rendered without value. A published document must have none. */
  missing: string[];
}

/** Renders a parsed template. Unknown paths are errors (a typo in the template, not missing data). */
export function renderTemplate(nodes: readonly Node[], context: TemplateContext, options: RenderOptions = {}): RenderResult {
  const missing: string[] = [];
  const walk = (list: readonly Node[]): string =>
    list
      .map((node) => {
        if (node.kind === 'text') return node.text;
        const value = lookup(context, node.path);
        if (value === undefined) throw new TemplateError(`Unknown placeholder {{${node.path}}}`);
        if (node.kind === 'if') return walk(isSet(value) ? node.then : node.otherwise);
        if (value instanceof TrustedMarkdown) return value.markdown;
        if (value === null || value === '') {
          missing.push(node.path);
          return options.missing?.(node.path) ?? '';
        }
        if (typeof value === 'object') throw new TemplateError(`{{${node.path}}} is not a single value`);
        return escapeMarkdownInline(String(value));
      })
      .join('');
  const markdown = walk(nodes)
    // a false condition on its own line leaves an empty line behind
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { markdown: markdown + '\n', missing };
}

/** Every placeholder and condition path of a template, e.g. for checks in tests. */
export function templatePaths(nodes: readonly Node[]): string[] {
  return nodes.flatMap((n) => (n.kind === 'text' ? [] : n.kind === 'var' ? [n.path] : [n.path, ...templatePaths(n.then), ...templatePaths(n.otherwise)]));
}
