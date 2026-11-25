import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideHouse, lucideSearchX, lucideShieldX } from '@ng-icons/lucide';
import { APP_ROUTES } from '@vm-web/shared';

import { VmButton } from '@vm-web/ui';

/** Kein Zugriff: page needs a permission the person does not have. */
@Component({
  selector: 'vm-forbidden-page',
  imports: [RouterLink, TranslocoPipe, NgIcon, VmButton],
  viewProviders: [provideIcons({ lucideShieldX, lucideHouse })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forbidden-page.html',
})
export class ForbiddenPage {
  protected readonly homePath = APP_ROUTES.me.root;
}

/** Seite nicht gefunden: unknown path inside the app. */
@Component({
  selector: 'vm-not-found-page',
  imports: [RouterLink, TranslocoPipe, NgIcon, VmButton],
  viewProviders: [provideIcons({ lucideSearchX, lucideHouse, lucideArrowLeft })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found-page.html',
})
export class NotFoundPage {
  private readonly location = inject(Location);
  protected readonly homePath = APP_ROUTES.me.root;
  protected readonly requested = inject(Router).url;

  protected back(): void {
    this.location.back();
  }
}
