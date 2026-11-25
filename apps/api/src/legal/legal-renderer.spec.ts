import { markdownToHtml } from './legal-markdown';
import {
  escapeMarkdownBlock,
  isSet,
  parseTemplate,
  renderTemplate,
  TemplateError,
  TrustedMarkdown,
  type TemplateContext,
} from './legal-renderer';

const render = (source: string, context: TemplateContext, preview = false) =>
  renderTemplate(parseTemplate(source), context, preview ? { missing: (p) => `[fehlt ${p}]` } : {});

const html = (source: string, context: TemplateContext) => markdownToHtml(render(source, context).markdown);

describe('legal renderer (S-7)', () => {
  describe('placeholders', () => {
    it('inserts nested values', () => {
      expect(render('Hallo {{club.name}} aus {{club.address.city}}', { club: { name: 'MV', address: { city: 'Talheim' } } }).markdown).toBe(
        'Hallo MV aus Talheim\n',
      );
    });

    it('allows spaces inside the braces and numbers as values', () => {
      expect(render('{{ days }} Tage', { days: 14 }).markdown).toBe('14 Tage\n');
    });

    it('fails on unknown placeholders (typo in a template)', () => {
      expect(() => render('{{club.nmae}}', { club: { name: 'MV' } })).toThrow(TemplateError);
      expect(() => render('{{unknown}}', {})).toThrow(/unknown/);
    });

    it('fails on unsupported tags', () => {
      expect(() => parseTemplate('{{#each list}}x{{/each}}')).toThrow(TemplateError);
      expect(() => parseTemplate('{{> modules}}')).toThrow(TemplateError);
      expect(() => parseTemplate('{{a b}}')).toThrow(TemplateError);
    });
  });

  describe('missing values', () => {
    it('reports placeholders without value and renders them empty', () => {
      const result = render('Tel: {{phone}}, Mail: {{mail}}', { phone: null, mail: '' });
      expect(result.missing).toEqual(['phone', 'mail']);
      expect(result.markdown).toBe('Tel: , Mail:\n');
    });

    it('marks them in the preview', () => {
      expect(render('Tel: {{phone}}', { phone: null }, true).markdown).toBe('Tel: [fehlt phone]\n');
    });

    it('treats a value below a missing object as missing, not unknown', () => {
      expect(render('{{dpo.name}}', { dpo: null }).missing).toEqual(['dpo.name']);
    });
  });

  describe('conditions', () => {
    const ctx = { yes: true, no: false, empty: '', zero: 0, none: null, list: [], text: 'x', nested: { flag: true } };

    it.each([
      ['yes', 'A'],
      ['no', 'B'],
      ['empty', 'B'],
      ['zero', 'A'],
      ['none', 'B'],
      ['list', 'B'],
      ['text', 'A'],
      ['nested.flag', 'A'],
    ])('{{#if %s}} → %s', (path, expected) => {
      expect(render(`{{#if ${path}}}A{{else}}B{{/if}}`, ctx).markdown).toBe(`${expected}\n`);
    });

    it('nests and skips missing values in false branches', () => {
      const source = '{{#if a}}1{{#if b}}2{{else}}3{{/if}}{{/if}}{{#if no}}{{missing}}{{/if}}';
      expect(render(source, { a: true, b: false, no: false, missing: null })).toEqual({ markdown: '13\n', missing: [] });
    });

    it('removes the blank lines a false block leaves behind', () => {
      expect(render('A\n\n{{#if no}}\nB\n\n{{/if}}\nC', { no: false }).markdown).toBe('A\n\nC\n');
    });

    it('rejects unbalanced blocks', () => {
      expect(() => parseTemplate('{{#if a}}x')).toThrow(/not closed/);
      expect(() => parseTemplate('x{{/if}}')).toThrow(TemplateError);
      expect(() => parseTemplate('{{else}}')).toThrow(TemplateError);
      expect(() => parseTemplate('{{#if a}}{{else}}{{else}}{{/if}}')).toThrow(TemplateError);
    });

    it('fails on unknown paths in conditions', () => {
      expect(() => render('{{#if nope}}x{{/if}}', {})).toThrow(TemplateError);
    });

    it('isSet follows the documented rules', () => {
      expect([null, undefined, false, '', []].map(isSet)).toEqual([false, false, false, false, false]);
      expect([0, 'a', true, [1], {}].map(isSet)).toEqual([true, true, true, true, true]);
    });
  });

  describe('escaping of club data', () => {
    it('never lets HTML from the data through', () => {
      const out = html('# {{name}}\n\n{{street}}', { name: '<script>alert(1)</script>', street: '<img src=x onerror=alert(1)>' });
      expect(out).not.toMatch(/<script|<img/);
      expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('neutralises Markdown in the data', () => {
      const out = html('{{v}}', { v: '**fett** [Link](javascript:alert(1)) # Titel' });
      expect(out).toBe('<p>**fett** [Link](javascript:alert(1)) # Titel</p>');
      expect(out).not.toContain('<a');
    });

    it('keeps a value on its own line, also with line breaks or list markers', () => {
      expect(html('{{v}}', { v: '- Punkt\n# Titel' })).toBe('<p>- Punkt # Titel</p>');
      expect(html('{{v}}', { v: '1. Eins' })).toBe('<p>1. Eins</p>');
    });

    it('keeps paragraphs of free text but escapes them', () => {
      const block = escapeMarkdownBlock('Absatz *eins*\nZeile zwei\n\n<b>Absatz</b> zwei');
      expect(html('{{t}}', { t: block })).toBe('<p>Absatz *eins*<br />\nZeile zwei</p>\n<p>&lt;b&gt;Absatz&lt;/b&gt; zwei</p>');
    });

    it('inserts trusted Markdown from our own code unchanged', () => {
      expect(html('{{list}}', { list: new TrustedMarkdown('- a\n- b') })).toBe('<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
    });

    it('sanitises the HTML even if a template contained something unsafe', () => {
      const out = markdownToHtml('[x](javascript:alert(1)) [ok](https://example.org) <b>raw</b>');
      expect(out).not.toMatch(/href="javascript:|<b>/);
      expect(out).toContain('<a href="https://example.org" rel="noopener noreferrer">ok</a>');
    });
  });
});
