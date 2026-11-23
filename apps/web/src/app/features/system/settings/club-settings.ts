import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideImageUp, lucideTrash2 } from '@ng-icons/lucide';
import { apiUrl, LOGO_FILE_FIELD, LOGO_MAX_BYTES, LOGO_MIME_TYPES, updateClubBodySchema, type ConfigResponse } from '@vm-web/shared';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardSonnerService } from '@/shared/components/sonner';
import { ZardTextareaComponent } from '@/shared/components/textarea';

import { ActionRunner } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { BrandingStore } from '../../../core/branding/branding.store';
import { focusFirstInvalid } from '../../../core/util/focus-invalid';
import { ToggleSwitch } from '../../../shared/ui/toggle-switch';

interface ClubForm {
  clubName: string;
  imprintUrl: string;
  privacyUrl: string;
  loginBanner: string;
  loginAutoRedirect: boolean;
}
type ClubErrors = Partial<Record<keyof ClubForm, string>>;

/** Tab „Verein & Anmeldung“ (S-4, A-2, F-12): name, legal links, login banner, logo. */
@Component({
  selector: 'vm-club-settings',
  imports: [NgIcon, TranslocoPipe, ZardButtonComponent, ZardInputComponent, ZardTextareaComponent, ToggleSwitch],
  viewProviders: [provideIcons({ lucideImageUp, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-6' },
  template: `
    <form #clubForm class="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm md:p-6" novalidate (submit)="$event.preventDefault(); save()">
      <h2 class="text-lg font-semibold">{{ 'system.settings.club.title' | transloco }}</h2>
      <label class="flex flex-col gap-1.5">
        <span class="font-medium">{{ 'system.settings.club.clubName' | transloco }} *</span>
        <input
          z-input
          type="text"
          maxlength="100"
          required
          [readOnly]="readonly()"
          [value]="form().clubName"
          (input)="set('clubName', $any($event.target).value)"
          [attr.aria-invalid]="!!errors().clubName"
          [attr.aria-describedby]="errors().clubName ? 'err-clubName' : null"
        />
        @if (errors().clubName; as e) {
          <span id="err-clubName" class="text-[13px] text-destructive-ink">{{ e | transloco }}</span>
        }
      </label>
      <div class="grid gap-4 md:grid-cols-2">
        @for (f of urlFields; track f) {
          <label class="flex flex-col gap-1.5">
            <span class="font-medium">{{ 'system.settings.club.' + f | transloco }}</span>
            <input
              z-input
              type="url"
              maxlength="500"
              placeholder="https://"
              [readOnly]="readonly()"
              [value]="form()[f]"
              (input)="set(f, $any($event.target).value)"
              [attr.aria-invalid]="!!errors()[f]"
              [attr.aria-describedby]="errors()[f] ? 'err-' + f : null"
            />
            @if (errors()[f]; as e) {
              <span [id]="'err-' + f" class="text-[13px] text-destructive-ink">{{ e | transloco }}</span>
            }
          </label>
        }
      </div>
      <label class="flex flex-col gap-1.5">
        <span class="font-medium">{{ 'system.settings.club.loginBanner' | transloco }}</span>
        <textarea z-textarea rows="3" maxlength="2000" [readOnly]="readonly()" [value]="form().loginBanner" (input)="set('loginBanner', $any($event.target).value)"></textarea>
        <span class="text-[13px] text-muted-foreground">{{ 'system.settings.club.loginBannerHint' | transloco }}</span>
      </label>
      <div class="flex items-center justify-between gap-4">
        <div>
          <span class="font-medium">{{ 'system.settings.club.autoRedirect' | transloco }}</span>
          <p class="text-muted-foreground">{{ 'system.settings.club.autoRedirectHint' | transloco }}</p>
        </div>
        <vm-toggle-switch
          [checked]="form().loginAutoRedirect"
          [label]="'system.settings.club.autoRedirect' | transloco"
          [disabled]="readonly()"
          (toggled)="set('loginAutoRedirect', $event)"
        />
      </div>
      @if (!readonly()) {
        <button z-button type="submit" class="self-end" [zLoading]="saving()" [zDisabled]="saving()">{{ 'common.save' | transloco }}</button>
      }
    </form>

    <section aria-labelledby="h-logo" class="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm md:p-6">
      <div>
        <h2 id="h-logo" class="text-lg font-semibold">{{ 'system.settings.club.logo' | transloco }}</h2>
        <p class="text-muted-foreground">{{ 'system.settings.club.logoHint' | transloco }}</p>
      </div>
      <div class="flex flex-col gap-4 md:flex-row md:items-center">
        <div class="flex size-24 items-center justify-center rounded-lg border bg-background">
          @if (config().club.logoUrl; as url) {
            <img [src]="url" [alt]="'system.settings.club.logoPreview' | transloco" class="max-h-20 max-w-20 object-contain" />
          } @else {
            <span class="text-2xl font-semibold text-muted-foreground" aria-hidden="true">{{ branding.initials() }}</span>
          }
        </div>
        @if (!readonly()) {
          <div class="flex flex-col gap-2 md:flex-row">
            <input #file type="file" class="sr-only" tabindex="-1" aria-hidden="true" [accept]="accept" (change)="upload($any($event.target).files)" />
            <button z-button zType="outline" type="button" [zLoading]="uploading()" [zDisabled]="uploading()" (click)="file.click()">
              <ng-icon name="lucideImageUp" aria-hidden="true" />{{ 'system.settings.club.uploadLogo' | transloco }}
            </button>
            @if (config().club.logoUrl) {
              <button z-button zType="ghost" type="button" class="text-destructive-ink" (click)="removeLogo()">
                <ng-icon name="lucideTrash2" aria-hidden="true" />{{ 'system.settings.club.removeLogo' | transloco }}
              </button>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class ClubSettings {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);
  private readonly actions = inject(ActionRunner);
  private readonly sonner = inject(ZardSonnerService);
  private readonly transloco = inject(TranslocoService);
  protected readonly branding = inject(BrandingStore);

  readonly config = input.required<ConfigResponse>();
  readonly readonly = input(false);
  readonly changed = output<void>();

  protected readonly urlFields = ['imprintUrl', 'privacyUrl'] as const;
  protected readonly accept = LOGO_MIME_TYPES.join(',');
  protected readonly form = signal<ClubForm>({ clubName: '', imprintUrl: '', privacyUrl: '', loginBanner: '', loginAutoRedirect: false });
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
          imprintUrl: club.imprintUrl ?? '',
          privacyUrl: club.privacyUrl ?? '',
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
      imprintUrl: f.imprintUrl.trim() || null,
      privacyUrl: f.privacyUrl.trim() || null,
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
