import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideCircleCheck } from '@ng-icons/lucide';
import { apiUrl, legalPreviewResponseSchema, type ImprintData, type LegalDocument, type LegalPreviewBody, type PrivacyData } from '@vm-web/shared';

import { ApiClient } from '../../../../core/api/api-client';
import { LegalHtml } from '../../../../core/legal/legal-html';
import { fieldLabelKey } from './legal-model';

/**
 * Live preview of a generated document with the unsaved form data (S-7) and the list of missing
 * required fields. Requests are debounced; the last good preview stays visible while loading.
 */
@Component({
  selector: 'vm-legal-preview',
  imports: [DatePipe, TranslocoPipe, NgIcon, LegalHtml],
  viewProviders: [provideIcons({ lucideCircleAlert, lucideCircleCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-4' },
  template: `
    @if (preview.hasValue() && preview.value(); as p) {
      @if (p.missingFields.length) {
        <div class="flex flex-col gap-2 rounded-small bg-warning-soft p-4 text-warning-ink" role="status">
          <p class="flex items-center gap-2 font-medium">
            <ng-icon name="lucideCircleAlert" aria-hidden="true" />{{ 'system.settings.legal.missingTitle' | transloco }}
          </p>
          <ul class="list-disc pl-6">
            @for (f of p.missingFields; track f) {
              <li>{{ labelKey(f) | transloco }}</li>
            }
          </ul>
        </div>
      } @else {
        <p class="flex items-center gap-2 rounded-small bg-success-soft p-4 text-success-ink" role="status">
          <ng-icon name="lucideCircleCheck" aria-hidden="true" />{{ 'system.settings.legal.complete' | transloco }}
        </p>
      }
      <section class="flex flex-col gap-2" [attr.aria-label]="'system.settings.legal.preview' | transloco" [attr.aria-busy]="preview.isLoading()">
        <p class="text-body-medium text-muted-foreground">
          {{ 'system.settings.legal.previewOf' | transloco: { version: p.templateVersion, date: (p.templateDate | date: 'dd.MM.yyyy') } }}
        </p>
        <div class="max-h-[70dvh] overflow-y-auto rounded-small border bg-surface p-4 md:p-6" [class.opacity-60]="preview.isLoading()">
          <vm-legal-html [html]="p.html" />
        </div>
      </section>
    } @else if (preview.error()) {
      <p class="text-destructive-ink" role="alert">{{ 'system.settings.legal.previewFailed' | transloco }}</p>
    } @else {
      <p class="text-muted-foreground" role="status">{{ 'common.loading' | transloco }}</p>
    }
  `,
})
export class LegalPreview {
  private readonly api = inject(ApiClient);

  readonly document = input.required<LegalDocument>();
  readonly imprintData = input.required<ImprintData>();
  readonly privacyData = input.required<PrivacyData>();
  readonly templateVersion = input<'accepted' | 'available'>('accepted');

  private readonly request = computed<LegalPreviewBody>(() => ({
    document: this.document(),
    templateVersion: this.templateVersion(),
    imprintData: this.imprintData(),
    privacyData: this.privacyData(),
  }));
  /** First request at once, then 500 ms after the last change (inputs are only readable after creation). */
  private readonly debouncedRequest = signal<LegalPreviewBody | undefined>(undefined);

  protected readonly preview = rxResource({
    params: () => this.debouncedRequest(),
    stream: ({ params }) => this.api.post(apiUrl('system', 'legalPreview'), params, legalPreviewResponseSchema),
  });
  protected readonly labelKey = fieldLabelKey;

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const request = this.request();
      clearTimeout(timer);
      if (untracked(this.debouncedRequest) === undefined) this.debouncedRequest.set(request);
      else timer = setTimeout(() => this.debouncedRequest.set(request), 500);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
