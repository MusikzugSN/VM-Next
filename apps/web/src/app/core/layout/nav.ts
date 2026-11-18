import { APP_ROUTES, type Permission } from '@vm-web/shared';

/** Who may see an entry: members (Mein Bereich, Drucken) or anyone with one of the permissions. */
export type NavAccess = { member: true } | { anyOf: readonly Permission[] };

export interface NavItem {
  readonly labelKey: string;
  readonly path: string;
  readonly icon: string;
  readonly access: NavAccess;
  /** Active only on exactly this path (Start), not on sub-pages. */
  readonly exact?: boolean;
  /** Counter next to the label. */
  readonly badge?: 'review';
}

export interface NavSection {
  readonly labelKey: string;
  readonly items: readonly NavItem[];
}

const member: NavAccess = { member: true };
const anyOf = (...permissions: Permission[]): NavAccess => ({ anyOf: permissions });

/** Sidebar order of the Design Guideline: Mein Bereich – Noten – Drucken – System. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    labelKey: 'nav.me.section',
    items: [
      { labelKey: 'nav.me.start', path: APP_ROUTES.me.root, icon: 'lucideHouse', access: member, exact: true },
      { labelKey: 'nav.me.folders', path: APP_ROUTES.me.folders, icon: 'lucideFolderOpen', access: member },
      { labelKey: 'nav.me.events', path: APP_ROUTES.me.events, icon: 'lucideCalendar', access: member },
      { labelKey: 'nav.me.tags', path: APP_ROUTES.me.tags, icon: 'lucideTag', access: member },
    ],
  },
  {
    labelKey: 'nav.library.section',
    items: [
      { labelKey: 'nav.library.scores', path: APP_ROUTES.library.scores, icon: 'lucideMusic', access: anyOf('score.view') },
      {
        labelKey: 'nav.library.review',
        path: APP_ROUTES.library.review,
        icon: 'lucideClock',
        access: anyOf('sheet.approve'),
        badge: 'review',
      },
      { labelKey: 'nav.library.folders', path: APP_ROUTES.library.folders, icon: 'lucideFolderCog', access: anyOf('folder.view') },
      { labelKey: 'nav.library.events', path: APP_ROUTES.library.events, icon: 'lucideCalendarCog', access: anyOf('event.view') },
      { labelKey: 'nav.library.tags', path: APP_ROUTES.library.tags, icon: 'lucideTags', access: anyOf('tag.view') },
      { labelKey: 'nav.library.voices', path: APP_ROUTES.library.voices, icon: 'lucideMusic2', access: anyOf('voice.view') },
    ],
  },
  {
    labelKey: 'nav.print.section',
    items: [{ labelKey: 'nav.print.history', path: APP_ROUTES.print.root, icon: 'lucidePrinter', access: member }],
  },
  {
    labelKey: 'nav.system.section',
    items: [
      { labelKey: 'nav.system.users', path: APP_ROUTES.system.users, icon: 'lucideUsers', access: anyOf('user.view') },
      { labelKey: 'nav.system.ensembles', path: APP_ROUTES.system.ensembles, icon: 'lucideNetwork', access: anyOf('ensemble.view') },
      { labelKey: 'nav.system.roles', path: APP_ROUTES.system.roles, icon: 'lucideShieldCheck', access: anyOf('role.view') },
      {
        labelKey: 'nav.system.settings',
        path: APP_ROUTES.system.settings,
        icon: 'lucideSettings',
        // Tab „Eigene Felder“ is also for librarians (requirements: Konfiguration).
        access: anyOf('config.view', 'score.edit'),
      },
    ],
  },
];

/** Bottom bar on phones (Design Guideline): Start, Mappen, Events, Profil. */
export const MOBILE_NAV: readonly NavItem[] = [
  NAV_SECTIONS[0].items[0],
  NAV_SECTIONS[0].items[1],
  NAV_SECTIONS[0].items[2],
  { labelKey: 'nav.me.profile', path: APP_ROUTES.me.profile, icon: 'lucideUser', access: member },
];

export function canSee(access: NavAccess, check: { isMember: boolean; can: (permission: Permission) => boolean }): boolean {
  return 'member' in access ? check.isMember : access.anyOf.some((permission) => check.can(permission));
}
