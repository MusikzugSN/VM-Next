import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideCircleCheck, lucideClock, lucidePrinter, lucideReplace, lucideUpload } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardSonnerService } from '@/shared/components/sonner';

import { ViewportService } from '../../core/layout/viewport';

/**
 * Temporary page for Stufe 0: shows tokens, buttons, inputs and status colours of the
 * Design Guideline with Zard components. Replaced by the app shell in Stufe 1.
 */
@Component({
  selector: 'vm-design-preview',
  imports: [NgIcon, TranslocoPipe, ZardButtonComponent, ZardInputComponent],
  viewProviders: [
    provideIcons({ lucideUpload, lucideReplace, lucideCircleAlert, lucideClock, lucideCircleCheck, lucidePrinter }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex max-w-content flex-col gap-8 p-4 md:p-6 xl:p-8">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold tracking-tight">{{ 'app.name' | transloco }}</h1>
        <p class="text-muted-foreground">Design-Vorschau · Ansicht: {{ viewport.viewport() }}</p>
      </header>

      <section class="flex flex-col gap-3" aria-labelledby="buttons">
        <h2 id="buttons" class="text-lg font-semibold">Buttons</h2>
        <div class="flex flex-wrap gap-2">
          <button z-button type="button" (click)="toast()">
            <ng-icon name="lucideUpload" />{{ 'common.upload' | transloco }}
          </button>
          <button z-button zType="secondary" type="button">{{ 'common.cancel' | transloco }}</button>
          <button z-button zType="outline" type="button">
            <ng-icon name="lucidePrinter" />{{ 'common.print' | transloco }}
          </button>
          <button z-button zType="ghost" type="button">{{ 'common.edit' | transloco }}</button>
          <button z-button zType="destructive" type="button">{{ 'common.delete' | transloco }}</button>
        </div>
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="fields">
        <h2 id="fields" class="text-lg font-semibold">Felder</h2>
        <label class="flex max-w-sm flex-col gap-1.5">
          <span class="font-medium">{{ 'terms.score' | transloco }}</span>
          <input z-input type="search" [placeholder]="'common.search' | transloco" />
        </label>
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="status">
        <h2 id="status" class="text-lg font-semibold">Status</h2>
        <ul class="flex flex-wrap gap-2">
          <li class="inline-flex items-center gap-1 rounded-sm bg-brass-soft px-2 py-0.5 text-xs font-medium text-brass-ink">
            <ng-icon name="lucideReplace" />{{ 'status.substitute' | transloco: { voice: 'Horn in Es' } }}
          </li>
          <li class="inline-flex items-center gap-1 rounded-sm bg-destructive-soft px-2 py-0.5 text-xs font-medium text-destructive-ink">
            <ng-icon name="lucideCircleAlert" />{{ 'status.missing' | transloco }}
          </li>
          <li class="inline-flex items-center gap-1 rounded-sm bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-ink">
            <ng-icon name="lucideClock" />{{ 'status.pending' | transloco }}
          </li>
          <li class="inline-flex items-center gap-1 rounded-sm bg-success-soft px-2 py-0.5 text-xs font-medium text-success-ink">
            <ng-icon name="lucideCircleCheck" />{{ 'status.approved' | transloco }}
          </li>
          <li class="inline-flex items-center gap-1 rounded-sm bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
            <ng-icon name="lucidePrinter" />{{ 'status.printing' | transloco }}
          </li>
        </ul>
      </section>
    </main>
  `,
})
export class DesignPreview {
  protected readonly viewport = inject(ViewportService);
  private readonly sonner = inject(ZardSonnerService);

  protected toast(): void {
    this.sonner.success('Design-Vorschau', { description: 'Toasts erscheinen unten rechts.' });
  }
}
