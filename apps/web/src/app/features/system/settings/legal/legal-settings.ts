import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, output, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideExternalLink, lucideInfo, lucideSparkles } from '@ng-icons/lucide';
import {
  apiUrl,
  APP_ROUTES,
  legalSettingsResponseSchema,
  type LegalDocument,
  type LegalMode,
} from '@vm-web/shared';

import { VmBadge, VmButton, VmCard } from '@vm-web/ui';

import { ActionRunner, ConfirmService } from '../../../../core/actions/action-runner';
import { fieldProblemHandler } from '../../../../core/actions/field-problem-handler';
import { ApiClient } from '../../../../core/api/api-client';
import { BrandingStore } from '../../../../core/branding/branding.store';
import { LegalStatusStore } from '../../../../core/legal/legal-status.store';
import { focusFirstInvalid } from '../../../../core/util/focus-invalid';
import { PageProblem } from '../../../../shared/ui/page-problem';
import { ImprintDataForm } from './imprint-data-form';
import { LegalChoice, type LegalChoiceOption } from './legal-choice';
import { LegalField } from './legal-field';
import { fieldLabelKey, formFromSettings, imprintDataPlace, LEGAL_DOCUMENTS, linkMissing, previewForm, setPath, validateForm, type FieldChange, type LegalForm } from './legal-model';
import { LegalPreview } from './legal-preview';
import { PrivacyDataForm } from './privacy-data-form';

const MODES: readonly LegalChoiceOption<LegalMode>[] = [
  { value: 'link', labelKey: 'system.settings.legal.mode.link', hintKey: 'system.settings.legal.mode.linkHint' },
  { value: 'generated', labelKey: 'system.settings.legal.mode.generated', hintKey: 'system.settings.legal.mode.generatedHint' },
];

/**
 * Tab „Rechtliches“ (S-7): per document link or generated from club data, form with live preview
 * (beside it on wide screens, below on narrow ones), missing required fields and new template versions.
 */
@Component({
  selector: 'vm-legal-settings',
  imports: [
    DatePipe,
    TranslocoPipe,
    NgIcon,
    VmBadge,
    VmButton,
    VmCard,
    PageProblem,
    ImprintDataForm,
    PrivacyDataForm,
    LegalChoice,
    LegalField,
    LegalPreview,
  ],
  viewProviders: [provideIcons({ lucideCircleAlert, lucideExternalLink, lucideInfo, lucideSparkles })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './legal-settings.html',
})
export class LegalSettings {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly branding = inject(BrandingStore);
  private readonly status = inject(LegalStatusStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly focusInvalid = focusFirstInvalid();

  readonly readonly = input(false);
  readonly changed = output<void>();

  protected readonly docs = LEGAL_DOCUMENTS;
  protected readonly modes = MODES;
  protected readonly routes = APP_ROUTES;
  protected readonly labelKey = fieldLabelKey;

  protected readonly settings = rxResource({
    stream: () => this.api.get(apiUrl('system', 'legalSettings'), legalSettingsResponseSchema),
  });
  protected readonly form = signal<LegalForm | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly saving = signal(false);
  protected readonly dirty = signal(false);
  /** Documents whose preview shows the new, not yet accepted template. */
  protected readonly showNewTemplate = signal<Partial<Record<LegalDocument, boolean>>>({});

  /** The data the previews render, without values that are still invalid (the preview debounces). */
  protected readonly previewData = computed(() => {
    const f = this.form();
    return f ? previewForm(f) : null;
  });
  protected readonly imprintPlace = computed(() => {
    const f = this.form();
    return f ? imprintDataPlace(f) : null;
  });

  constructor() {
    effect(() => {
      if (!this.settings.hasValue()) return;
      const value = this.settings.value();
      untracked(() => {
        this.form.set(formFromSettings(value));
        this.dirty.set(false);
      });
    });
  }

  protected setMode(doc: LegalDocument, mode: LegalMode): void {
    this.patch((f) => ({ ...f, [doc]: { ...f[doc], mode } }));
  }

  protected setUrl(doc: LegalDocument, url: string): void {
    this.patch((f) => ({ ...f, [doc]: { ...f[doc], url } }));
  }

  protected setField(part: 'imprintData' | 'privacyData', change: FieldChange): void {
    this.patch((f) => setPath(f, `${part}.${change.path}`, change.value));
  }

  protected linkMissing(doc: LegalDocument): string[] {
    const f = this.form();
    return f ? linkMissing(f[doc]) : [];
  }

  protected docErrors(prefix: string): string | undefined {
    return this.errors()[prefix];
  }

  protected toggleNewTemplate(doc: LegalDocument): void {
    this.showNewTemplate.update((s) => ({ ...s, [doc]: !s[doc] }));
  }

  protected async save(): Promise<void> {
    const f = this.form();
    if (!f) return;
    const result = validateForm(f);
    if ('errors' in result) {
      this.errors.set(result.errors);
      this.focusInvalid(this.host.nativeElement);
      return;
    }
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('system', 'updateLegalSettings'), result.body), {
      busy: this.saving,
      success: { key: 'system.settings.saved' },
      onProblem: fieldProblemHandler(this.errors, () => this.focusInvalid(this.host.nativeElement)),
    });
    if (done) this.afterChange();
  }

  protected async accept(doc: LegalDocument, version: number): Promise<void> {
    const ok = await this.confirm.confirm('system.settings.legal.acceptTitle', 'system.settings.legal.acceptText', { version }, 'system.settings.legal.accept');
    if (!ok) return;
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('system', 'acceptLegalTemplate'), { document: doc, version }), {
      success: { key: 'system.settings.legal.accepted' },
    });
    if (done) {
      this.showNewTemplate.update((s) => ({ ...s, [doc]: false }));
      this.afterChange();
    }
  }

  private patch(change: (f: LegalForm) => LegalForm): void {
    const f = this.form();
    if (!f) return;
    this.form.set(change(f));
    this.dirty.set(true);
    if (Object.keys(this.errors()).length) this.errors.set({});
  }

  private afterChange(): void {
    this.errors.set({});
    this.settings.reload();
    this.branding.reload();
    this.status.reload();
    this.changed.emit();
  }
}
