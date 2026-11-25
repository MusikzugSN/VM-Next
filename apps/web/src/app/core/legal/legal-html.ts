import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Rendered imprint or privacy policy (S-7). The HTML comes sanitised from the API (only headings,
 * paragraphs, lists, links); Angular sanitises `[innerHTML]` once more. About 72 characters per line.
 */
@Component({
  selector: 'vm-legal-html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './legal-html.html',
})
export class LegalHtml {
  readonly html = input.required<string>();
}
