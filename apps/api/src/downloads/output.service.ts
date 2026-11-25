import { Inject, Injectable } from '@nestjs/common';
import type { MemberSheet, SubstituteMode, VoiceRef } from '@vm-web/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { AccessContext } from '../access/access-context';
import { ProblemException } from '../common/problem-details/problem.exception';
import { DATABASE, type Database } from '../db/database';
import { events, folderEntries, folders, scores, setlistEntries, sheets } from '../db/schema';
import { MeRepository } from '../me/me.repository';
import { MeService } from '../me/me.service';
import { relevantVoiceIds, resolveSheets, sheetsForOutput } from '../me/sheet-resolution';
import { displayFolderNumber } from '../folders/folder-number';

/**
 * Who may output what:
 * - `download`: Mein Bereich only (R-2, M-6)
 * - `print`: Mein Bereich plus scores with `score.view`, folders with `folder.view` and events with
 *   `event.view` in their ensemble, released or not (F-9)
 */
type OutputMode = 'download' | 'print';

export type OutputScope =
  | { kind: 'score'; scoreId: string }
  | { kind: 'folder'; folderId: string }
  | { kind: 'event'; eventId: string }
  | { kind: 'selection'; scoreIds: readonly string[]; folderId?: string; eventId?: string };

interface OutputEntry {
  scoreId: string;
  title: string;
  /** Folder number or setlist position (two digits); `null` without context. */
  number: string | null;
}

interface OutputDocument extends OutputEntry {
  sheet: MemberSheet;
  fileKey: string;
}

export interface OutputPlan {
  /** Name of the folder, event or score – used in file names. */
  name: string;
  documents: OutputDocument[];
  /** Scores without any sheet in the chosen voices (M-3). */
  missing: OutputEntry[];
  activeVoices: VoiceRef[];
}

/** Resolves what goes into a ZIP or print document (M-6, D-1, F-7, F-9). */
@Injectable()
export class OutputService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(MeRepository) private readonly me: MeRepository,
    @Inject(MeService) private readonly meService: MeService,
  ) {}

  async plan(access: AccessContext, mode: OutputMode, scope: OutputScope, voiceIds: readonly string[], substitutes: SubstituteMode): Promise<OutputPlan> {
    const { name, entries } = await this.entries(access, mode, scope);
    const voices = await this.meService.activeVoices(access.userId, voiceIds);
    const sheetMap = await this.me.sheetsFor(
      entries.map((e) => e.scoreId),
      relevantVoiceIds(voices),
    );

    const chosen: { entry: OutputEntry; sheet: MemberSheet }[] = [];
    const missing: OutputEntry[] = [];
    for (const entry of entries) {
      const out = sheetsForOutput(resolveSheets(voices, sheetMap.get(entry.scoreId) ?? []), substitutes);
      if (!out.length) missing.push(entry);
      for (const sheet of out) chosen.push({ entry, sheet });
    }
    const fileKeys = await this.fileKeys(chosen.map((c) => c.sheet.sheetId));
    return {
      name,
      documents: chosen.map(({ entry, sheet }) => ({ ...entry, sheet, fileKey: fileKeys.get(sheet.sheetId) as string })),
      missing,
      activeVoices: [...voices.active],
    };
  }

  // --- scope ------------------------------------------------------------------------------------------------

  private async entries(access: AccessContext, mode: OutputMode, scope: OutputScope): Promise<{ name: string; entries: OutputEntry[] }> {
    switch (scope.kind) {
      case 'score': {
        const [score] = await this.visibleScores(access, mode, [scope.scoreId]);
        if (!score) throw ProblemException.notFound();
        return { name: score.title, entries: [{ scoreId: score.id, title: score.title, number: null }] };
      }
      case 'folder': {
        const folder = await this.folder(access, mode, scope.folderId);
        return { name: folder.name, entries: await this.folderEntries(scope.folderId) };
      }
      case 'event': {
        const event = await this.event(access, mode, scope.eventId);
        return { name: `${event.date} ${event.name}`, entries: await this.setlistEntries(scope.eventId) };
      }
      case 'selection': {
        const unique = [...new Set(scope.scoreIds)];
        const visible = new Map((await this.visibleScores(access, mode, unique)).map((s) => [s.id, s]));
        if (visible.size !== unique.length) throw ProblemException.notFound('Score not visible');
        // context gives numbers and order (folder number / setlist position)
        let context: OutputEntry[] | undefined;
        if (scope.folderId) {
          await this.folder(access, mode, scope.folderId);
          context = await this.folderEntries(scope.folderId);
        } else if (scope.eventId) {
          await this.event(access, mode, scope.eventId);
          context = await this.setlistEntries(scope.eventId);
        }
        const inContext = context?.filter((e) => visible.has(e.scoreId)) ?? [];
        const rest = unique
          .filter((id) => !inContext.some((e) => e.scoreId === id))
          .map((id) => ({ scoreId: id, title: visible.get(id)?.title ?? '', number: null }));
        return { name: 'Auswahl', entries: [...inContext, ...rest] };
      }
    }
  }

  private async visibleScores(access: AccessContext, mode: OutputMode, ids: readonly string[]) {
    if (!ids.length) return [];
    const all = mode === 'print' && access.has('score.view');
    const memberIds = access.memberEnsembleIds();
    if (!all && !memberIds.length) return [];
    return this.db
      .select({ id: scores.id, title: scores.title })
      .from(scores)
      .where(and(inArray(scores.id, [...ids]), all ? undefined : sql`${scores.id} in ${this.me.visibleScoreIdsSql(memberIds)}`));
  }

  private async folder(access: AccessContext, mode: OutputMode, folderId: string) {
    const visible = await this.me.folder(access.memberEnsembleIds(), folderId);
    if (visible) return visible;
    if (mode === 'print') {
      const [row] = await this.db.select({ name: folders.name, ensembleId: folders.ensembleId }).from(folders).where(eq(folders.id, folderId));
      if (row && access.has('folder.view', row.ensembleId)) return row;
    }
    throw ProblemException.notFound();
  }

  private async event(access: AccessContext, mode: OutputMode, eventId: string) {
    const visible = await this.me.event(access.memberEnsembleIds(), eventId);
    if (visible) return visible;
    if (mode === 'print') {
      const [row] = await this.db
        .select({ name: events.name, date: events.date, ensembleId: events.ensembleId })
        .from(events)
        .where(eq(events.id, eventId));
      if (row && access.has('event.view', row.ensembleId)) return row;
    }
    throw ProblemException.notFound();
  }

  private async folderEntries(folderId: string): Promise<OutputEntry[]> {
    return this.db
      .select({ scoreId: scores.id, title: scores.title, number: displayFolderNumber })
      .from(folderEntries)
      .innerJoin(scores, eq(scores.id, folderEntries.scoreId))
      .where(eq(folderEntries.folderId, folderId))
      .orderBy(asc(folderEntries.numberSortKey), asc(scores.id));
  }

  private async setlistEntries(eventId: string): Promise<OutputEntry[]> {
    const rows = await this.db
      .select({ scoreId: scores.id, title: scores.title, position: setlistEntries.position })
      .from(setlistEntries)
      .innerJoin(scores, eq(scores.id, setlistEntries.scoreId))
      .where(eq(setlistEntries.eventId, eventId))
      .orderBy(asc(setlistEntries.position));
    return rows.map((r) => ({ scoreId: r.scoreId, title: r.title, number: String(r.position).padStart(2, '0') }));
  }

  private async fileKeys(sheetIds: readonly string[]): Promise<Map<string, string>> {
    if (!sheetIds.length) return new Map();
    const rows = await this.db.select({ id: sheets.id, fileKey: sheets.fileKey }).from(sheets).where(inArray(sheets.id, [...sheetIds]));
    return new Map(rows.map((r) => [r.id, r.fileKey]));
  }
}
