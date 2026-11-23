import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideHouse, lucideSearchX, lucideShieldX } from '@ng-icons/lucide';
import { APP_ROUTES } from '@vm-web/shared';

import { ZardButtonComponent } from '@vm-web/ui/zard/components/button';

/** Kein Zugriff: page needs a permission the person does not have. */
@Component({
  selector: 'vm-forbidden-page',
  imports: [RouterLink, TranslocoPipe, NgIcon, ZardButtonComponent],
  viewProviders: [provideIcons({ lucideShieldX, lucideHouse })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto flex w-full max-w-dialog-lg flex-col gap-6 py-6 md:py-12">
      <span class="flex size-12 items-center justify-center rounded-full bg-muted text-foreground">
        <ng-icon name="lucideShieldX" size="var(--mat-sys-icon-size-md)" aria-hidden="true" />
      </span>
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-semibold">{{ 'pages.forbidden.title' | transloco }}</h1>
        <p class="text-muted-foreground">{{ 'pages.forbidden.text' | transloco }}</p>
      </div>
      <div>
        <a z-button [routerLink]="homePath" class="w-full md:w-auto">
          <ng-icon name="lucideHouse" aria-hidden="true" />{{ 'pages.toHome' | transloco }}
        </a>
      </div>
    </section>
  `,
})
export class ForbiddenPage {
  protected readonly homePath = APP_ROUTES.me.root;
}

/** Seite nicht gefunden: unknown path inside the app. */
@Component({
  selector: 'vm-not-found-page',
  imports: [RouterLink, TranslocoPipe, NgIcon, ZardButtonComponent],
  viewProviders: [provideIcons({ lucideSearchX, lucideHouse, lucideArrowLeft })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto flex w-full max-w-dialog-lg flex-col gap-6 py-6 md:py-12">
      <span class="flex size-12 items-center justify-center rounded-full bg-muted text-foreground">
        <ng-icon name="lucideSearchX" size="var(--mat-sys-icon-size-md)" aria-hidden="true" />
      </span>
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-semibold">{{ 'pages.notFound.title' | transloco }}</h1>
        <p class="text-muted-foreground">{{ 'pages.notFound.text' | transloco }}</p>
        <p class="text-muted-foreground">
          {{ 'pages.notFound.requested' | transloco }} <code class="font-mono text-[13px] text-foreground">{{ requested }}</code>
        </p>
      </div>
      <div class="flex flex-col gap-2 md:flex-row">
        <a z-button [routerLink]="homePath"> <ng-icon name="lucideHouse" aria-hidden="true" />{{ 'pages.toHome' | transloco }} </a>
        <button z-button zType="outline" type="button" (click)="back()">
          <ng-icon name="lucideArrowLeft" aria-hidden="true" />{{ 'common.back' | transloco }}
        </button>
      </div>
    </section>
  `,
})
export class NotFoundPage {
  private readonly location = inject(Location);
  protected readonly homePath = APP_ROUTES.me.root;
  protected readonly requested = inject(Router).url;

  protected back(): void {
    this.location.back();
  }
}
