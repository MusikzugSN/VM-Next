/**
 * All API paths, shared by frontend and API.
 *
 * - Every feature is one NestJS controller: `@Controller(API_ROUTES.me.base)`, global prefix `API_PREFIX`.
 * - Every endpoint: `@Get(API_ROUTES.me.upcomingEvents.path)`.
 * - Frontend: `apiUrl('me', 'folderScores', { folderId })` → `/internal/v1/me/folders/<id>/scores`.
 *
 * Path parameters use the Express syntax `:name`.
 * `binary: true` marks streamed downloads (PDF, ZIP, CSV), `multipart: true` marks uploads.
 */
export const API_PREFIX = '/internal/v1';

type Method = 'GET' | 'POST';
interface RouteDef {
  readonly method: Method;
  readonly path: string;
  readonly binary?: true;
  readonly multipart?: true;
  /** Reachable without session (auth flow, login page). */
  readonly public?: true;
}

const get = <P extends string>(path: P) => ({ method: 'GET', path }) as const;
const post = <P extends string>(path: P) => ({ method: 'POST', path }) as const;
const binary = <R extends RouteDef>(r: R) => ({ ...r, binary: true }) as const;
const multipart = <R extends RouteDef>(r: R) => ({ ...r, multipart: true }) as const;
const pub = <R extends RouteDef>(r: R) => ({ ...r, public: true }) as const;

export const API_ROUTES = {
  auth: {
    base: 'auth',
    login: pub(get('login')),
    callback: pub(get('callback')),
    logout: post('logout'),
    session: pub(get('session')),
    loginPage: pub(get('login-page')),
    logo: pub(binary(get('branding/logo'))),
  },

  me: {
    base: 'me',
    voiceContext: get('voice-context'),
    voiceOptions: get('voice-options'),
    upcomingEvents: get('upcoming-events'),
    archivedEvents: get('archived-events'),
    folders: get('folders'),
    uploadSummary: get('upload-summary'),
    myUploads: get('my-uploads'),
    folderOverview: get('folders/:folderId/overview'),
    folderScores: get('folders/:folderId/scores'),
    eventOverview: get('events/:eventId/overview'),
    eventSetlist: get('events/:eventId/setlist'),
    tags: get('tags'),
    clubTagScores: get('club-tags/:tagId/scores'),
    personalTagScores: get('personal-tags/:tagId/scores'),
    scoreOverview: get('scores/:scoreId/overview'),
    profile: get('profile'),
    sheetPdf: binary(get('sheets/:sheetId/pdf')),
    folderZip: binary(get('folders/:folderId/zip')),
    eventZip: binary(get('events/:eventId/zip')),
    selectionZip: binary(post('downloads/selection-zip')),
    setVoices: post('profile/set-voices'),
    createPersonalTag: post('personal-tags/create'),
    renamePersonalTag: post('personal-tags/:tagId/rename'),
    deletePersonalTag: post('personal-tags/:tagId/delete'),
    addPersonalTag: post('scores/:scoreId/add-personal-tag'),
    removePersonalTag: post('scores/:scoreId/remove-personal-tag'),
  },

  uploads: {
    base: 'uploads',
    voiceSuggestions: get('voice-suggestions'),
    scoreSearch: get('score-search'),
    uploadSheets: multipart(post('sheets/upload')),
  },

  review: {
    base: 'review',
    queue: get('queue'),
    uploadDetails: get('uploads/:uploadId/details'),
    uploadPdf: binary(get('uploads/:uploadId/pdf')),
    approve: post('uploads/:uploadId/approve'),
    reject: post('uploads/:uploadId/reject'),
  },

  scores: {
    base: 'scores',
    scoreTable: get('score-table'),
    scoreTableExport: binary(get('score-table/export')),
    fieldDefinitions: get('field-definitions'),
    ensembleOptions: get('ensemble-options'),
    tagOptions: get('tag-options'),
    scoreDetails: get('scores/:scoreId/details'),
    scoreCompleteness: get('scores/:scoreId/completeness'),
    scoreSheets: get('scores/:scoreId/sheets'),
    scoreFolders: get('scores/:scoreId/folders'),
    sheetPdf: binary(get('sheets/:sheetId/pdf')),
    createScore: post('scores/create'),
    updateScoreDetails: post('scores/:scoreId/update-details'),
    deleteScore: post('scores/:scoreId/delete'),
    deleteSheet: post('sheets/:sheetId/delete'),
    createField: post('field-definitions/create'),
    updateField: post('field-definitions/:fieldId/update-definition'),
    deleteField: post('field-definitions/:fieldId/delete'),
    reorderFields: post('field-definitions/reorder'),
    importScores: post('scores/import'),
  },

  voices: {
    base: 'voices',
    voiceList: get('voice-list'),
    instrumentSuggestions: get('instrument-suggestions'),
    createVoice: post('voices/create'),
    updateVoice: post('voices/:voiceId/update-details'),
    setSubstitutes: post('voices/:voiceId/set-substitutes'),
    deleteVoice: post('voices/:voiceId/delete'),
    renameInstrument: post('instruments/:instrumentId/rename'),
    reorderInstruments: post('instruments/reorder'),
    reorderVoices: post('instruments/:instrumentId/reorder-voices'),
  },

  folders: {
    base: 'folders',
    ensembleOptions: get('ensemble-options'),
    folderList: get('folder-list'),
    folderDetails: get('folders/:folderId/details'),
    folderEntries: get('folders/:folderId/entries'),
    scoreCandidates: get('folders/:folderId/score-candidates'),
    createFolder: post('folders/create'),
    renameFolder: post('folders/:folderId/rename'),
    setVisibility: post('folders/:folderId/set-visibility'),
    addScore: post('folders/:folderId/add-score'),
    setScoreNumber: post('folders/:folderId/set-score-number'),
    removeScore: post('folders/:folderId/remove-score'),
    deleteFolder: post('folders/:folderId/delete'),
  },

  events: {
    base: 'events',
    ensembleOptions: get('ensemble-options'),
    eventList: get('event-list'),
    eventDetails: get('events/:eventId/details'),
    setlist: get('events/:eventId/setlist'),
    scoreCandidates: get('events/:eventId/score-candidates'),
    createEvent: post('events/create'),
    updateDetails: post('events/:eventId/update-details'),
    setVisibility: post('events/:eventId/set-visibility'),
    setSetlist: post('events/:eventId/set-setlist'),
    deleteEvent: post('events/:eventId/delete'),
  },

  tags: {
    base: 'tags',
    clubTagList: get('club-tag-list'),
    createTag: post('club-tags/create'),
    renameTag: post('club-tags/:tagId/rename'),
    deleteTag: post('club-tags/:tagId/delete'),
  },

  print: {
    base: 'print',
    printPlan: get('print-plan'),
    printDocument: binary(get('document')),
  },

  system: {
    base: 'system',
    // users (S-1)
    userTable: get('user-table'),
    userAssignmentOptions: get('user-assignment-options'),
    userDetails: get('users/:userId/details'),
    setMembership: post('users/:userId/set-membership'),
    removeMembership: post('users/:userId/remove-membership'),
    setUserVoices: post('users/:userId/set-voices'),
    blockUser: post('users/:userId/block'),
    unblockUser: post('users/:userId/unblock'),
    setAdmin: post('users/:userId/set-admin'),
    deleteUser: post('users/:userId/delete'),
    // ensembles (S-2)
    ensembleList: get('ensemble-list'),
    ensembleDetails: get('ensembles/:ensembleId/details'),
    ensembleLineup: get('ensembles/:ensembleId/lineup'),
    ensembleMembers: get('ensembles/:ensembleId/members'),
    createEnsemble: post('ensembles/create'),
    renameEnsemble: post('ensembles/:ensembleId/rename'),
    moveEnsemble: post('ensembles/:ensembleId/set-parent'),
    archiveEnsemble: post('ensembles/:ensembleId/archive'),
    unarchiveEnsemble: post('ensembles/:ensembleId/unarchive'),
    setLineup: post('ensembles/:ensembleId/set-lineup'),
    applyLineupTemplate: post('ensembles/:ensembleId/apply-lineup-template'),
    ensemblePrintRules: get('ensembles/:ensembleId/print-rules'),
    setPrintRules: post('ensembles/:ensembleId/set-print-rules'),
    resetPrintRules: post('ensembles/:ensembleId/reset-print-rules'),
    // roles (S-3, R-7)
    roleList: get('role-list'),
    permissionCatalog: get('permission-catalog'),
    roleDetails: get('roles/:roleId/details'),
    createRole: post('roles/create'),
    renameRole: post('roles/:roleId/rename'),
    setPermissions: post('roles/:roleId/set-permissions'),
    deleteRole: post('roles/:roleId/delete'),
    resetRole: post('roles/:roleId/reset-to-default'),
    resetAllRoles: post('roles/reset-defaults'),
    // configuration (S-4)
    config: get('config'),
    configDefaultOptions: get('config/default-options'),
    updateClub: post('config/update-club'),
    updateDefaults: post('config/update-defaults'),
    updatePrint: post('config/update-print'),
    uploadLogo: multipart(post('config/upload-logo')),
    removeLogo: post('config/remove-logo'),
  },
} as const satisfies Record<string, { base: string } & Record<string, RouteDef | string>>;

export type ApiFeature = keyof typeof API_ROUTES;
export type ApiRouteName<F extends ApiFeature> = Exclude<keyof (typeof API_ROUTES)[F], 'base'>;

/** Builds the absolute URL path of an endpoint, e.g. `apiUrl('me', 'folderScores', { folderId })`. */
export function apiUrl<F extends ApiFeature>(
  feature: F,
  route: ApiRouteName<F>,
  params: Record<string, string> = {},
): string {
  const group = API_ROUTES[feature] as unknown as { base: string } & Record<string, RouteDef>;
  const def = group[route as string];
  const path = def.path.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing path parameter "${name}" for ${feature}.${String(route)}`);
    return encodeURIComponent(value);
  });
  return `${API_PREFIX}/${group.base}/${path}`;
}
