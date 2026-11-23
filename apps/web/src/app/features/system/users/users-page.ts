import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';
import { APP_ROUTES, apiUrl, appPath, userAssignmentOptionsResponseSchema, userTableResponseSchema, type UserRow, type UserStatus } from '@vm-web/shared';
import { VmSelect } from '@vm-web/ui';


import { ApiClient } from '../../../core/api/api-client';
import { cursorList } from '../../../core/api/cursor-list';
import { initials } from '../../../core/branding/branding.store';
import { ViewportService } from '../../../core/layout/viewport';
import { debounced } from '../../../core/util/debounced';
import { ListState } from '../../../shared/ui/list-state';
import { SearchField } from '../../../shared/ui/search-field';
import { UserStatusBadge } from '../ui/user-status-badge';
import { TreeLabelPipe } from '../../../shared/ui/tree-label.pipe';

/** Benutzer (S-1): everybody with a club account; accounts are created on first login (A-3). */
@Component({
  selector: 'vm-system-users-page',
  imports: [TreeLabelPipe, DatePipe, RouterLink, NgIcon, TranslocoPipe, VmSelect, ListState, SearchField, UserStatusBadge],
  viewProviders: [provideIcons({ lucideInfo })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users-page.html',
})
export class UsersPage {
  private readonly api = inject(ApiClient);
  protected readonly viewport = inject(ViewportService);

  protected readonly search = signal('');
  private readonly query = debounced(this.search);
  protected readonly status = signal<UserStatus | ''>('');
  protected readonly ensembleId = signal('');

  protected readonly options = rxResource({
    stream: () => this.api.get(apiUrl('system', 'userAssignmentOptions'), userAssignmentOptionsResponseSchema),
  });
  protected readonly list = cursorList({
    params: () => ({ q: this.query().trim() || undefined, status: this.status() || undefined, ensembleId: this.ensembleId() || undefined }),
    fetch: (p, cursor) => this.api.get(apiUrl('system', 'userTable'), userTableResponseSchema, { ...p, cursor }),
  });

  protected link(user: UserRow): string {
    return appPath(APP_ROUTES.system.user, { userId: user.id });
  }

  protected readonly initialsOf = initials;
}
