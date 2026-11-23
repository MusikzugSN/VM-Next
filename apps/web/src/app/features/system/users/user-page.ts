import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideChevronLeft, lucideLock, lucideLockOpen, lucidePlus, lucideTrash2, lucideX } from '@ng-icons/lucide';
import { MAX_PROFILE_VOICES, APP_ROUTES, apiUrl, userAssignmentOptionsResponseSchema, userDetailsResponseSchema } from '@vm-web/shared';
import { firstValueFrom } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';

import { ActionRunner, ConfirmService } from '../../../core/actions/action-runner';
import { ApiClient } from '../../../core/api/api-client';
import { SessionStore } from '../../../core/auth/session.store';
import { initials } from '../../../core/branding/branding.store';
import { VoiceContextStore } from '../../../core/voices/voice-context.store';
import { FormDialog, runDialogSave } from '../../../shared/ui/form-dialog';
import { PageProblem } from '../../../shared/ui/page-problem';
import { ToggleSwitch } from '../../../shared/ui/toggle-switch';
import { UserStatusBadge } from '../ui/user-status-badge';
import { TreeLabelPipe } from '../../../shared/ui/tree-label.pipe';
import { usePageName } from '../../../core/layout/page';
import { selectOr, valueOr } from '../../../core/util/resource-value';

/** Benutzer-Detail (S-1, A-5, R-1, R-6): roles per ensemble, voices, admin flag, block and delete. */
@Component({
  selector: 'vm-system-user-page',
  imports: [TreeLabelPipe, DatePipe, RouterLink, NgIcon, TranslocoPipe, ZardButtonComponent, ZardNativeSelectDirective, PageProblem, ToggleSwitch, UserStatusBadge, FormDialog],
  viewProviders: [provideIcons({ lucideChevronLeft, lucidePlus, lucideX, lucideCheck, lucideLock, lucideLockOpen, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-page.html',
})
export class UserPage {
  /** Breadcrumb and document title show the loaded element's name. */
  private readonly pageName = usePageName(() => this.user()?.name);
  private readonly api = inject(ApiClient);
  private readonly actions = inject(ActionRunner);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  protected readonly voices = inject(VoiceContextStore);

  /** Route parameter. */
  readonly userId = input.required<string>();

  protected readonly usersPath = APP_ROUTES.system.users;
  protected readonly canEdit = computed(() => this.session.can('user.edit'));
  protected readonly canDelete = computed(() => this.session.can('user.delete'));
  protected readonly isSelf = computed(() => this.session.user()?.id === this.userId());

  protected readonly details = rxResource({
    params: () => this.userId(),
    stream: ({ params }) => this.api.get(apiUrl('system', 'userDetails', { userId: params }), userDetailsResponseSchema),
  });
  protected readonly options = rxResource({
    stream: () => this.api.get(apiUrl('system', 'userAssignmentOptions'), userAssignmentOptionsResponseSchema),
  });
  protected readonly user = computed(() => valueOr(this.details, null));
  /** Ensembles the person is not member of yet, for „Ensemble hinzufügen“. */
  protected readonly freeEnsembles = computed(() => {
    const taken = new Set(this.user()?.memberships.map((m) => m.ensemble.id) ?? []);
    return (selectOr(this.options, (v) => v.ensembles, [])).filter((e) => !taken.has(e.id));
  });

  protected readonly newEnsembleId = signal('');
  protected readonly newRoleId = signal('');
  protected readonly adding = signal(false);
  protected readonly busy = signal(false);
  protected readonly selectedVoices = signal<ReadonlySet<string>>(new Set());
  protected readonly voicesDirty = computed(() => {
    const current = new Set(this.user()?.voices.map((v) => v.id) ?? []);
    const chosen = this.selectedVoices();
    return current.size !== chosen.size || [...chosen].some((id) => !current.has(id));
  });

  constructor() {
    effect(() => {
      const user = this.user();
      if (user) untracked(() => this.selectedVoices.set(new Set(user.voices.map((v) => v.id))));
    });
  }

  protected initialsOf(name: string): string {
    return initials(name);
  }

  protected async setRole(ensembleId: string, roleId: string): Promise<boolean> {
    if (!roleId) return false;
    const done = await this.actions.run(
      () => firstValueFrom(this.api.postVoid(apiUrl('system', 'setMembership', { userId: this.userId() }), { ensembleId, roleId })),
      { success: { key: 'system.user.roleSaved' } },
    );
    if (done) this.changed();
    return !!done;
  }

  protected startAdd(): void {
    this.newEnsembleId.set('');
    this.newRoleId.set('');
    this.adding.set(true);
  }

  protected addMembership(): void {
    if (!this.newEnsembleId() || !this.newRoleId() || this.busy()) return;
    void runDialogSave({ busy: this.busy, open: this.adding }, () => this.setRole(this.newEnsembleId(), this.newRoleId()));
  }

  protected async removeMembership(ensembleId: string, name: string): Promise<void> {
    const done = await this.actions.run(
      () => firstValueFrom(this.api.postVoid(apiUrl('system', 'removeMembership', { userId: this.userId() }), { ensembleId })),
      { success: { key: 'system.user.membershipRemoved', params: { name } } },
    );
    if (done) this.changed();
  }

  protected toggleVoice(id: string): void {
    this.selectedVoices.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PROFILE_VOICES) next.add(id);
      return next;
    });
  }

  protected async saveVoices(): Promise<void> {
    const done = await this.actions.run(
      () => firstValueFrom(this.api.postVoid(apiUrl('system', 'setUserVoices', { userId: this.userId() }), { voiceIds: [...this.selectedVoices()] })),
      { success: { key: 'system.user.voicesSaved' } },
    );
    if (done) this.details.reload();
  }

  protected async setAdmin(isAdmin: boolean): Promise<void> {
    const done = await this.actions.run(
      () => firstValueFrom(this.api.postVoid(apiUrl('system', 'setAdmin', { userId: this.userId() }), { isAdmin })),
      { success: { key: isAdmin ? 'system.user.adminOn' : 'system.user.adminOff' } },
    );
    if (done) this.changed();
  }

  protected async setBlocked(block: boolean): Promise<void> {
    const name = this.user()?.name ?? '';
    const route = block ? 'blockUser' : 'unblockUser';
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('system', route, { userId: this.userId() }))), {
      success: { key: block ? 'system.user.blockedDone' : 'system.user.unblockedDone', params: { name } },
    });
    if (done) this.details.reload();
  }

  protected async remove(): Promise<void> {
    const name = this.user()?.name ?? '';
    if (!(await this.confirm.confirmDelete('system.user.deleteTitle', 'system.user.deleteText', { name }))) return;
    const done = await this.actions.run(() => firstValueFrom(this.api.postVoid(apiUrl('system', 'deleteUser', { userId: this.userId() }))), {
      success: { key: 'system.user.deleted', params: { name } },
    });
    if (done) void this.router.navigateByUrl(this.usersPath);
  }

  /** Memberships or admin flag changed: reload; the own permissions may have changed, too. */
  private changed(): void {
    this.details.reload();
    if (this.isSelf()) void this.session.reload();
  }
}
