import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { APP_ROUTES } from '@vm-web/shared';

import { isApiProblem } from '../../core/api/api-problem';

/**
 * Loading a page failed: „nicht gefunden“ for 404 (also for elements the person may not see, the API
 * does not reveal them), otherwise the general message.
 */
@Component({
  selector: 'vm-page-problem',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-problem.html',
})
export class PageProblem {
  readonly error = input<unknown>();

  protected readonly homePath = APP_ROUTES.me.root;
  private readonly code = computed(() => {
    const error = this.error();
    return isApiProblem(error) ? error.code : 'unknown';
  });
  protected readonly titleKey = computed(() => (this.code() === 'not-found' ? 'pages.notFound.title' : 'errors.title'));
  protected readonly messageKey = computed(() => `errors.${this.code()}`);
}
