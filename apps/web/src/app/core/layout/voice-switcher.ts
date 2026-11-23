import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideMusic2 } from '@ng-icons/lucide';
import { APP_ROUTES } from '@vm-web/shared';
import { VmMenuImports } from '@vm-web/ui';


import { VoiceContextStore } from '../voices/voice-context.store';
import { StandInDialog } from './stand-in-dialog';

/**
 * Active voice in the header (M-2): shows the voices of Mein Bereich, switches between the own
 * voices or to any other voice („Aushilfe“) without changing the profile.
 */
@Component({
  selector: 'vm-voice-switcher',
  imports: [NgIcon, RouterLink, TranslocoPipe, VmMenuImports, StandInDialog],
  viewProviders: [provideIcons({ lucideMusic2, lucideChevronDown })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.needsVoiceSelection()) {
      <a
        [routerLink]="profilePath"
        class="inline-flex h-control items-center gap-2 rounded-full border border-primary bg-primary-soft px-3 font-medium text-primary no-underline xl:h-8"
      >
        <ng-icon name="lucideMusic2" aria-hidden="true" />{{ 'shell.voice.choose' | transloco }}
      </a>
    } @else if (store.activeVoices().length > 0) {
      <button
        type="button"
        vm-menu-trigger
        [zDropdownMenu]="menu"
        [attr.aria-label]="'shell.voice.label' | transloco: { voices: label() }"
        class="inline-flex h-control max-w-72 items-center gap-2 rounded-full border border-primary bg-primary-soft px-3 font-medium text-primary xl:h-8"
      >
        <ng-icon name="lucideMusic2" aria-hidden="true" class="shrink-0" />
        <span class="truncate">{{ label() }}</span>
        @if (store.isStandIn()) {
          <span class="rounded-small bg-background px-1 text-body-small">{{ 'shell.voice.override' | transloco }}</span>
        }
        <ng-icon name="lucideChevronDown" aria-hidden="true" class="shrink-0" />
      </button>

      <vm-menu-content #menu="zDropdownMenuContent" zAlign="end" class="w-64">
        <vm-menu-label>{{ 'shell.voice.menuTitle' | transloco }}</vm-menu-label>
        <vm-menu-radio-group [zValue]="selected()" (zValueChange)="select($event)">
          <vm-menu-radio-item zValue="">{{ 'shell.voice.allOwn' | transloco }}</vm-menu-radio-item>
          @for (voice of menuVoices(); track voice.id) {
            <vm-menu-radio-item [zValue]="voice.id">{{ voice.name }}</vm-menu-radio-item>
          }
        </vm-menu-radio-group>
        <vm-menu-separator />
        <button type="button" vm-menu-item (click)="standInOpen.set(true)">{{ 'shell.voice.other' | transloco }}</button>
        <a vm-menu-item [routerLink]="profilePath">{{ 'shell.voice.editProfile' | transloco }}</a>
      </vm-menu-content>
      <vm-stand-in-dialog [(open)]="standInOpen" />
    }
  `,
})
export class VoiceSwitcher {
  protected readonly store = inject(VoiceContextStore);
  protected readonly profilePath = APP_ROUTES.me.profile;
  protected readonly standInOpen = signal(false);

  /** Own voices, plus the voice of a stand-in so that the menu shows it as selected (M-2). */
  protected readonly menuVoices = computed(() => {
    const own = this.store.profileVoices();
    const ownIds = new Set(own.map((voice) => voice.id));
    return [...own, ...this.store.activeVoices().filter((voice) => !ownIds.has(voice.id))];
  });

  protected readonly label = computed(() =>
    this.store
      .activeVoices()
      .map((voice) => voice.name)
      .join(', '),
  );

  /** Radio value: '' = all own voices, otherwise the single overriding voice. */
  protected readonly selected = computed(() => {
    const ids = this.store.overrideIds();
    return ids.length === 1 ? ids[0] : '';
  });

  protected select(value: string | undefined): void {
    if (value) this.store.setOverride([value]);
    else this.store.clearOverride();
  }
}
