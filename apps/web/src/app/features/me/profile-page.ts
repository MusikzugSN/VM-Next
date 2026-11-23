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
  template: `
    <h1 class="text-headline-small">{{ 'nav.me.profile' | transloco }}</h1>

    @if (profile.error()) {
      <vm-page-problem [error]="profile.error()" />
    } @else if (profile.hasValue()) {
      @let account = profile.value();
      <section aria-labelledby="h-account" vm-card class="flex flex-col gap-4 p-4 md:p-6">
        <div>
          <h2 id="h-account" class="text-title-large">{{ 'me.profile.account' | transloco }}</h2>
          <p class="text-muted-foreground">{{ 'me.profile.accountHint' | transloco }}</p>
        </div>
        <div class="flex items-center gap-4">
          @if (account.pictureUrl) {
            <img [src]="account.pictureUrl" [alt]="'me.profile.picture' | transloco: { name: account.name }" class="size-16 rounded-full object-cover" />
          } @else {
            <span
              role="img"
              [attr.aria-label]="'me.profile.picture' | transloco: { name: account.name }"
              class="flex size-16 items-center justify-center rounded-full bg-primary-soft text-title-large text-primary"
              >{{ initialsOf(account.name) }}</span
            >
          }
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt class="text-muted-foreground">{{ 'me.profile.name' | transloco }}</dt>
            <dd class="font-medium">{{ account.name }}</dd>
            <dt class="text-muted-foreground">{{ 'me.profile.email' | transloco }}</dt>
            <dd>{{ account.email ?? '–' }}</dd>
          </dl>
        </div>
      </section>

      <section aria-labelledby="h-voices" vm-card class="flex flex-col gap-4 p-4 md:p-6">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 id="h-voices" class="text-title-large">{{ 'me.profile.voices' | transloco }}</h2>
          <button vm-button variant="outlined" type="button" class="w-full md:w-auto" (click)="editVoices.set(true)">
            <ng-icon name="lucidePencil" aria-hidden="true" />{{ 'me.profile.editVoices' | transloco }}
          </button>
        </div>
        @if (account.voices.length) {
          <ul class="flex flex-wrap gap-2">
            @for (voice of account.voices; track voice.id) {
              <li class="inline-flex items-center gap-1.5 rounded-small border border-primary bg-primary-soft px-3 py-1.5 font-medium text-primary">
                <ng-icon name="lucideMusic2" aria-hidden="true" />{{ voice.name }}
              </li>
            }
          </ul>
        } @else {
          <p class="text-muted-foreground">{{ 'me.profile.noVoices' | transloco }}</p>
        }
        <p class="text-muted-foreground">{{ 'me.profile.substituteHint' | transloco }}</p>
      </section>

      <section aria-labelledby="h-ensembles" vm-card class="flex flex-col gap-4 p-4 md:p-6">
        <h2 id="h-ensembles" class="text-title-large">{{ 'me.profile.ensembles' | transloco }}</h2>
        @if (account.memberships.length) {
          <table class="w-full">
            <thead class="text-label-medium text-muted-foreground">
              <tr>
                <th scope="col" class="py-2 text-start">{{ 'terms.ensemble' | transloco }}</th>
                <th scope="col" class="py-2 text-start">{{ 'me.profile.role' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (membership of account.memberships; track membership.ensemble.id + membership.role.id) {
                <tr class="border-t">
                  <td class="py-2">{{ membership.ensemble.name }}</td>
                  <td class="py-2">{{ membership.role.name }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
        @if (account.isAdmin) {
          <p class="text-muted-foreground">{{ 'me.profile.admin' | transloco }}</p>
        }
      </section>

      <button vm-button variant="outlined" type="button" class="w-full md:w-auto md:self-start" (click)="logout()">
        <ng-icon name="lucideLogOut" aria-hidden="true" />{{ 'common.logout' | transloco }}
      </button>
    }

    <vm-voice-selection-dialog [(open)]="editVoices" (saved)="profile.reload()" />
  `,
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
