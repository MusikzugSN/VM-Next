import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { APP_ROUTES, apiUrl, appPath, createdResponseSchema } from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';

import { ActionRunner } from '../../../core/actions/action-runner';
import { focusFirstInvalid } from '../../../core/util/focus-invalid';
import { ApiClient } from '../../../core/api/api-client';
import { isApiProblem } from '../../../core/api/api-problem';
import { LibraryOptions } from '../library-options';
import { ScoreForm } from './score-form';
import { buildScoreBody, emptyScoreForm, type ScoreFormErrors, type ScoreFormInput } from './score-form-model';

/** Stück anlegen (N-1, N-2): form with fixed and custom fields; afterwards the new score opens. */
@Component({
  selector: 'vm-library-new-score-page',
  imports: [RouterLink, TranslocoPipe, ZardButtonComponent, ScoreForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-6" novalidate (submit)="$event.preventDefault(); save()">
      <div>
        <h1 class="text-2xl font-semibold">{{ 'pages.newScore' | transloco }}</h1>
        <p class="mt-2 text-muted-foreground">{{ 'library.form.requiredHint' | transloco }}</p>
      </div>

      @if (hasErrors()) {
        <p role="alert" class="rounded-md bg-destructive-soft p-4 text-destructive-ink">{{ 'errors.validation-failed' | transloco }}</p>
      }

      <vm-score-form [(value)]="form" [errors]="errors()" />

      <div class="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <a z-button zType="secondary" [routerLink]="scoresPath">{{ 'common.cancel' | transloco }}</a>
        <button z-button type="submit" [zLoading]="saving()" [zDisabled]="saving() || !options.fieldsLoaded()">
          {{ 'library.form.saveScore' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class NewScorePage {
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly router = inject(Router);
  protected readonly options = inject(LibraryOptions);

  protected readonly scoresPath = APP_ROUTES.library.scores;
  protected readonly form = signal<ScoreFormInput>(emptyScoreForm());
  protected readonly errors = signal<ScoreFormErrors>({});
  private readonly focusInvalid = focusFirstInvalid();
  protected readonly saving = signal(false);
  protected readonly hasErrors = () => Object.keys(this.errors()).length > 0;

  protected async save(): Promise<void> {
    const { body, errors } = buildScoreBody(this.form(), this.options.fields());
    this.errors.set(errors);
    if (!body) {
      this.focusInvalid();
      return;
    }
    const done = await this.actions.run(() => firstValueFrom(this.api.post(apiUrl('scores', 'createScore'), body, createdResponseSchema)), {
      busy: this.saving,
      success: { key: 'library.form.created', params: { title: body.title } },
      onProblem: (problem) => {
        if (isApiProblem(problem) && problem.code === 'validation-failed') {
          this.errors.set(problem.fieldErrors());
          this.focusInvalid();
          return true;
        }
        return false;
      },
    });
    if (done) void this.router.navigateByUrl(appPath(APP_ROUTES.library.score, { scoreId: done.value.id }));
  }
}
