import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideImageUp, lucideTrash2 } from '@ng-icons/lucide';
import { apiUrl, LOGO_FILE_FIELD, LOGO_MAX_BYTES, LOGO_MIME_TYPES, updateClubBodySchema, type ConfigResponse } from '@vm-web/shared';

import { VmButton, VmCard, VmField, VmFieldError, VmFieldLabel, VmInput, VmSwitch, VmTextarea, VmToastService } from '@vm-web/ui';

import { ActionRunner } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { BrandingStore } from '../../../core/branding/branding.store';
import { focusFirstInvalid } from '../../../core/util/focus-invalid';
interface ClubForm {
  clubName: string;
  loginBanner: string;
  loginAutoRedirect: boolean;
}
type ClubErrors = Partial<Record<keyof ClubForm, string>>;

/** Tab „Verein & Anmeldung“ (S-4, A-2, F-12): name, login banner, logo. Imprint and privacy policy: tab „Rechtliches“ (S-7). */
@Component({
  selector: 'vm-club-settings',
  imports: [VmSwitch, VmCard, VmField, VmFieldLabel, VmFieldError, NgIcon, TranslocoPipe, VmButton, VmInput, VmTextarea],
  viewProviders: [provideIcons({ lucideImageUp, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './club-settings.html',
})
export class ClubSettings {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);
  private readonly actions = inject(ActionRunner);
  private readonly sonner = inject(VmToastService);
  private readonly transloco = inject(TranslocoService);
  protected readonly branding = inject(BrandingStore);

  readonly config = input.required<ConfigResponse>();
  readonly readonly = input(false);
  readonly changed = output<void>();

  protected readonly accept = LOGO_MIME_TYPES.join(',');
  protected readonly form = signal<ClubForm>({ clubName: '', loginBanner: '', loginAutoRedirect: false });
  protected readonly errors = signal<ClubErrors>({});
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  private readonly formRef = viewChild.required<ElementRef<HTMLFormElement>>('clubForm');
  private readonly focusInvalid = focusFirstInvalid();

  constructor() {
    effect(() => {
      const club = this.config().club;
      untracked(() =>
        this.form.set({
          clubName: club.clubName,
          loginBanner: club.loginBanner ?? '',
          loginAutoRedirect: club.loginAutoRedirect,
        }),
      );
    });
  }

  protected set<K extends keyof ClubForm>(key: K, value: ClubForm[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
    if (this.errors()[key]) this.errors.update((current) => ({ ...current, [key]: undefined }));
  }

  protected async save(): Promise<void> {
    const f = this.form();
    const body = {
      clubName: f.clubName.trim(),
      loginBanner: f.loginBanner.trim() || null,
      loginAutoRedirect: f.loginAutoRedirect,
    };
    const parsed = updateClubBodySchema.safeParse(body);
    if (!parsed.success) {
      const errors: ClubErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ClubForm;
        errors[key] ??= key === 'clubName' ? 'validation.required' : 'validation.invalid_format';
      }
      this.errors.set(errors);
      this.focusInvalid(this.formRef().nativeElement);
      return;
    }
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('system', 'updateClub'), parsed.data), {
      busy: this.saving,
      success: { key: 'system.settings.saved' },
    });
    if (done) this.afterChange();
  }

  protected async upload(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.type) || file.size > LOGO_MAX_BYTES) {
      this.sonner.error(this.transloco.translate('system.settings.club.logoInvalid'));
      return;
    }
    const form = new FormData();
    form.append(LOGO_FILE_FIELD, file, file.name);
    const done = await this.actions.runOnce(() => this.http.post(apiUrl('system', 'uploadLogo'), form), {
      busy: this.uploading,
      success: { key: 'system.settings.club.logoUploaded' },
    });
    if (done) this.afterChange();
  }

  protected async removeLogo(): Promise<void> {
    const done = await this.actions.runOnce(() => this.api.postVoid(apiUrl('system', 'removeLogo')), {
      success: { key: 'system.settings.club.logoRemoved' },
    });
    if (done) this.afterChange();
  }

  private afterChange(): void {
    this.changed.emit();
    this.branding.reload();
  }
}
