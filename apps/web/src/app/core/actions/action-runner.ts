import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, type Observable } from 'rxjs';
import { VmConfirmDialogService } from '@vm-web/ui';

import { ZardSonnerService } from '@vm-web/ui/zard/components/sonner';

import { isApiProblem } from '../api/api-problem';

export interface RunOptions {
  /** Toast after success (i18n key + params). */
  success?: { key: string; params?: Record<string, unknown> };
  /** Called with the problem instead of the toast, e.g. to show field errors in a form. */
  onProblem?: (problem: unknown) => boolean | void;
  /** Flag that is `true` while the action runs, e.g. to disable the save button. */
  busy?: { set(value: boolean): void };
  /** i18n key of the toast for failures that are not API problems (default `errors.unknown`). */
  fallbackKey?: string;
}

/**
 * Runs user actions against the API: shows a success toast if wanted and turns failures into a
 * toast with the text of the problem code (`errors.<code>`). Returns `undefined` on failure.
 */
@Injectable({ providedIn: 'root' })
export class ActionRunner {
  private readonly sonner = inject(ZardSonnerService);
  private readonly transloco = inject(TranslocoService);

  /** Success toast for results that are only known after the action (e.g. counts). */
  notify(key: string, params: Record<string, unknown> = {}): void {
    this.sonner.success(this.transloco.translate(key, params));
  }

  async run<T>(action: () => Promise<T>, options: RunOptions = {}): Promise<{ value: T } | undefined> {
    options.busy?.set(true);
    try {
      const value = await action();
      if (options.success) this.sonner.success(this.transloco.translate(options.success.key, options.success.params ?? {}));
      return { value };
    } catch (error) {
      if (options.onProblem?.(error) === true) return undefined;
      this.sonner.error(this.transloco.translate(isApiProblem(error) ? error.messageKey : (options.fallbackKey ?? 'errors.unknown')));
      return undefined;
    } finally {
      options.busy?.set(false);
    }
  }

  /** `run` for a single API request; the request is only built inside the error handling. */
  runOnce<T>(request: () => Observable<T>, options: RunOptions = {}): Promise<{ value: T } | undefined> {
    return this.run(() => firstValueFrom(request()), options);
  }
}

/** Confirmation for actions that cannot be undone (Design Guideline: only those get a dialog). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly alerts = inject(VmConfirmDialogService);
  private readonly actions = inject(ActionRunner);
  private readonly transloco = inject(TranslocoService);

  /** Resolves `true` when the person confirms. */
  confirmDelete(titleKey: string, textKey: string, params: Record<string, unknown> = {}): Promise<boolean> {
    return this.confirm(titleKey, textKey, params, 'common.delete');
  }

  /** Asks first, then runs the deletion; `undefined` when cancelled or failed. */
  async confirmedDelete<T>(
    titleKey: string,
    textKey: string,
    params: Record<string, unknown>,
    request: () => Observable<T>,
    options: RunOptions = {},
  ): Promise<{ value: T } | undefined> {
    if (!(await this.confirmDelete(titleKey, textKey, params))) return undefined;
    return this.actions.runOnce(request, options);
  }

  /** Like `confirmDelete`, with an own button text (e.g. „Zurücksetzen“, „Übernehmen“). */
  confirm(titleKey: string, textKey: string, params: Record<string, unknown>, okKey: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Escape and a click on the mask go through the cancel path of the overlay as well.
      this.alerts.confirm({
        zTitle: this.transloco.translate(titleKey, params),
        zDescription: this.transloco.translate(textKey, params),
        zOkText: this.transloco.translate(okKey),
        zCancelText: this.transloco.translate('common.cancel'),
        zOkDestructive: true,
        zOnOk: () => resolve(true),
        zOnCancel: () => resolve(false),
      });
    });
  }
}
