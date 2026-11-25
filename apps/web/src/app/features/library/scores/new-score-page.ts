import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { APP_ROUTES, apiUrl, appPath, createdResponseSchema } from '@vm-web/shared';

import { VmButton } from '@vm-web/ui';

import { ActionRunner } from '../../../core/actions/action-runner';
import { fieldProblemHandler } from '../../../core/actions/field-problem-handler';
import { focusFirstInvalid } from '../../../core/util/focus-invalid';
import { ApiClient } from '../../../core/api/api-client';
import { LibraryOptions } from '../library-options';
import { ScoreForm } from './score-form';
import { buildScoreBody, emptyScoreForm, type ScoreFormErrors, type ScoreFormInput } from './score-form-model';

/** Stück anlegen (N-1, N-2): form with fixed and custom fields; afterwards the new score opens. */
@Component({
  selector: 'vm-library-new-score-page',
  imports: [RouterLink, TranslocoPipe, VmButton, ScoreForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-score-page.html',
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
    const done = await this.actions.runOnce(() => this.api.post(apiUrl('scores', 'createScore'), body, createdResponseSchema), {
      busy: this.saving,
      success: { key: 'library.form.created', params: { title: body.title } },
      onProblem: fieldProblemHandler(this.errors, this.focusInvalid),
    });
    if (done) void this.router.navigateByUrl(appPath(APP_ROUTES.library.score, { scoreId: done.value.id }));
  }
}
