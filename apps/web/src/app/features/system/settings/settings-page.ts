import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { APP_ROUTES, apiUrl, configResponseSchema } from '@vm-web/shared';

import { ApiClient } from '../../../core/api/api-client';
import { SessionStore } from '../../../core/auth/session.store';
import { LegalStatusBanner } from '../../../core/legal/legal-status-banner';
import { PageProblem } from '../../../shared/ui/page-problem';
import { ClubSettings } from './club-settings';
import { DefaultsSettings } from './defaults-settings';
import { FieldsSettings } from './fields-settings';
import { LegalSettings } from './legal/legal-settings';
import { PrintSettings } from './print-settings';

type SettingsTab = 'club' | 'legal' | 'defaults' | 'print' | 'fields';

/**
 * Konfiguration (S-4, S-7): Verein & Anmeldung · Rechtliches · Standardwerte · Drucken · Eigene Felder (tab in `?tab=`).
 * The fields tab is also open to librarians (score.edit), the others need config.view.
 */
@Component({
  selector: 'vm-system-settings-page',
  imports: [RouterLink, TranslocoPipe, PageProblem, LegalStatusBanner, ClubSettings, LegalSettings, DefaultsSettings, PrintSettings, FieldsSettings],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h1 class="text-headline-small">{{ 'nav.system.settings' | transloco }}</h1>
      <p class="mt-2 text-muted-foreground">{{ 'system.settings.intro' | transloco }}</p>
    </div>

    @if (canView()) {
      <vm-legal-status-banner [showLink]="current() !== 'legal'" />
    }

    @if (tabs().length > 1) {
      <nav [attr.aria-label]="'system.settings.sections' | transloco" class="flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        @for (t of tabs(); track t) {
          <a
            [routerLink]="path"
            [queryParams]="{ tab: t === tabs()[0] ? null : t }"
            [attr.aria-current]="current() === t ? 'page' : null"
            class="-mb-px inline-flex min-h-target items-center border-b-2 px-3 font-medium whitespace-nowrap no-underline"
            [class]="current() === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
            >{{ 'system.settings.tabs.' + t | transloco }}</a
          >
        }
      </nav>
    }

    @if (current() === 'fields') {
      <vm-fields-settings />
    } @else if (current() === 'legal') {
      <vm-legal-settings [readonly]="!canEdit()" />
    } @else if (config.error()) {
      <vm-page-problem [error]="config.error()" />
    } @else if (config.hasValue() && config.value(); as c) {
      @switch (current()) {
        @case ('club') {
          <vm-club-settings [config]="c" [readonly]="!canEdit()" (changed)="config.reload()" />
        }
        @case ('defaults') {
          <vm-defaults-settings [config]="c" [readonly]="!canEdit()" (changed)="config.reload()" />
        }
        @case ('print') {
          <vm-print-settings [config]="c" [readonly]="!canEdit()" (changed)="config.reload()" />
        }
      }
    }
  `,
})
export class SettingsPage {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);

  /** Query parameter. */
  readonly tab = input<string>();

  protected readonly path = APP_ROUTES.system.settings;
  protected readonly canView = computed(() => this.session.can('config.view'));
  protected readonly canEdit = computed(() => this.session.can('config.edit'));
  protected readonly tabs = computed<SettingsTab[]>(() => {
    const fields = this.session.can('score.edit') || this.session.can('config.edit');
    return [...(this.canView() ? (['club', 'legal', 'defaults', 'print'] as const) : []), ...(fields ? (['fields'] as const) : [])];
  });
  protected readonly current = computed<SettingsTab>(() => {
    const wanted = this.tab() as SettingsTab;
    return this.tabs().includes(wanted) ? wanted : (this.tabs()[0] ?? 'fields');
  });

  protected readonly config = rxResource({
    params: () => (this.canView() && this.current() !== 'fields' && this.current() !== 'legal' ? true : undefined),
    stream: () => this.api.get(apiUrl('system', 'config'), configResponseSchema),
  });
}
