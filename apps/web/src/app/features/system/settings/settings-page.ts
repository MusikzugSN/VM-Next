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
  templateUrl: './settings-page.html',
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
