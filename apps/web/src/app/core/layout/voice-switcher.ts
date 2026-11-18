import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideMusic2 } from '@ng-icons/lucide';
import { APP_ROUTES } from '@vm-web/shared';

import { ZardDropdownImports } from '@/shared/components/dropdown/dropdown.imports';

import { VoiceContextStore } from '../voices/voice-context.store';

/** Active voice in the header (M-2): shows the voices of Mein Bereich and switches between the own voices. */
@Component({
  selector: 'vm-voice-switcher',
  imports: [NgIcon, RouterLink, TranslocoPipe, ZardDropdownImports],
  viewProviders: [provideIcons({ lucideMusic2, lucideChevronDown })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.needsVoiceSelection()) {
      <a
        [routerLink]="profilePath"
        class="inline-flex h-11 items-center gap-2 rounded-md border border-primary bg-primary-soft px-3 font-medium text-primary no-underline xl:h-8"
      >
        <ng-icon name="lucideMusic2" aria-hidden="true" />{{ 'shell.voice.choose' | transloco }}
      </a>
    } @else if (store.activeVoices().length > 0) {
      <button
        type="button"
        z-dropdown
        [zDropdownMenu]="menu"
        [attr.aria-label]="'shell.voice.label' | transloco: { voices: label() }"
        class="inline-flex h-11 max-w-72 items-center gap-2 rounded-md border border-primary bg-primary-soft px-3 font-medium text-primary xl:h-8"
      >
        <ng-icon name="lucideMusic2" aria-hidden="true" class="shrink-0" />
        <span class="truncate">{{ label() }}</span>
        @if (store.isOverride()) {
          <span class="rounded-sm bg-background px-1 text-xs">{{ 'shell.voice.override' | transloco }}</span>
        }
        <ng-icon name="lucideChevronDown" aria-hidden="true" class="shrink-0" />
      </button>

      <z-dropdown-menu-content #menu="zDropdownMenuContent" zAlign="end" class="w-64">
        <z-dropdown-menu-label>{{ 'shell.voice.menuTitle' | transloco }}</z-dropdown-menu-label>
        <z-dropdown-menu-radio-group [zValue]="selected()" (zValueChange)="select($event)">
          <z-dropdown-menu-radio-item zValue="">{{ 'shell.voice.allOwn' | transloco }}</z-dropdown-menu-radio-item>
          @for (voice of store.profileVoices(); track voice.id) {
            <z-dropdown-menu-radio-item [zValue]="voice.id">{{ voice.name }}</z-dropdown-menu-radio-item>
          }
        </z-dropdown-menu-radio-group>
        <z-dropdown-menu-separator />
        <a z-dropdown-menu-item [routerLink]="profilePath">{{ 'shell.voice.editProfile' | transloco }}</a>
      </z-dropdown-menu-content>
    }
  `,
})
export class VoiceSwitcher {
  protected readonly store = inject(VoiceContextStore);
  protected readonly profilePath = APP_ROUTES.me.profile;

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
