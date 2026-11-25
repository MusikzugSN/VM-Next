import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Rendered imprint or privacy policy (S-7). The HTML comes sanitised from the API (only headings,
 * paragraphs, lists, links); Angular sanitises `[innerHTML]` once more. About 72 characters per line.
 */
@Component({
  selector: 'vm-legal-html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `<div
    class="max-w-[72ch] text-body-large leading-7 [&_a]:break-all [&_code]:font-mono [&_code]:text-body-medium [&_h1]:mb-6 [&_h1]:text-headline-small [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-title-large [&_h2]:break-after-avoid [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-title-medium [&_hr]:my-8 [&_hr]:border-outline-variant [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
    [innerHTML]="html()"
  ></div>`,
})
export class LegalHtml {
  readonly html = input.required<string>();
}
