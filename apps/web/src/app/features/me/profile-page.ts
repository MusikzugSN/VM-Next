import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut, lucideMusic2, lucidePencil } from '@ng-icons/lucide';
import { apiUrl, profileResponseSchema } from '@vm-web/shared';

import { VmButton, VmCard } from '@vm-web/ui';

import { ApiClient } from '../../core/api/api-client';
import { SessionStore } from '../../core/auth/session.store';
import { initials } from '../../core/branding/branding.store';
import { PageProblem } from '../../shared/ui/page-problem';
import { VoiceSelectionDialog } from './ui/voice-selection-dialog';

/** Profil (M-1, A-4): account from the identity server (read-only), own voices, ensembles and roles, Abmelden. */
@Component({
  selector: 'vm-me-profile-page',
  imports: [VmCard, NgIcon, TranslocoPipe, VmButton, PageProblem, VoiceSelectionDialog],
  viewProviders: [provideIcons({ lucidePencil, lucideMusic2, lucideLogOut })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-page.html',
})
export class ProfilePage {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionStore);

  protected readonly editVoices = signal(false);
  protected readonly profile = rxResource({ stream: () => this.api.get(apiUrl('me', 'profile'), profileResponseSchema) });
  protected readonly initialsOf = initials;

  protected logout(): void {
    void this.session.logout();
  }
}
