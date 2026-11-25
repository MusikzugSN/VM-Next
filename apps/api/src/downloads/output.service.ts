import { Inject, Injectable } from '@nestjs/common';
import type { MemberSheet, SubstituteMode, VoiceRef } from '@vm-web/shared';
import type { AccessContext } from '../access/access-context';
import { ProblemException } from '../common/problem-details/problem.exception';
import { MeRepository } from '../me/me.repository';
import { MeService } from '../me/me.service';
import { relevantVoiceIds, resolveSheets, sheetsForOutput } from '../me/sheet-resolution';
import { DownloadsRepository, type NumberedScoreRow } from './downloads.repository';

type OutputMode = 'download' | 'print';

export type OutputScope =
  | { kind: 'score'; scoreId: string }
  | { kind: 'folder'; folderId: string }
  | { kind: 'event'; eventId: string }
  | { kind: 'selection'; scoreIds: readonly string[]; folderId?: string; eventId?: string };

type OutputEntry = NumberedScoreRow;

interface OutputDocument extends OutputEntry {
  sheet: MemberSheet;
  fileKey: string;
}

export interface OutputPlan {
  name: string;
  documents: OutputDocument[];
  missing: OutputEntry[];
  activeVoices: VoiceRef[];
}

@Injectable()
export class OutputService {
  constructor(
    @Inject(DownloadsRepository) private readonly repo: DownloadsRepository,
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
    const fileKeys = await this.repo.fileKeys(chosen.map((c) => c.sheet.sheetId));
    return {
      name,
      documents: chosen.map(({ entry, sheet }) => ({ ...entry, sheet, fileKey: fileKeys.get(sheet.sheetId) as string })),
      missing,
      activeVoices: [...voices.active],
    };
  }

  private async entries(access: AccessContext, mode: OutputMode, scope: OutputScope): Promise<{ name: string; entries: OutputEntry[] }> {
    switch (scope.kind) {
      case 'score': {
        const [score] = await this.visibleScores(access, mode, [scope.scoreId]);
        if (!score) throw ProblemException.notFound();
        return { name: score.title, entries: [{ scoreId: score.id, title: score.title, number: null }] };
      }
      case 'folder': {
        const folder = await this.folder(access, mode, scope.folderId);
        return { name: folder.name, entries: await this.repo.folderEntries(scope.folderId) };
      }
      case 'event': {
        const event = await this.event(access, mode, scope.eventId);
        return { name: `${event.date} ${event.name}`, entries: await this.setlistEntries(scope.eventId) };
      }
      case 'selection': {
        const unique = [...new Set(scope.scoreIds)];
        const visible = new Map((await this.visibleScores(access, mode, unique)).map((s) => [s.id, s]));
        if (visible.size !== unique.length) throw ProblemException.notFound('Score not visible');
        const context = await this.selectionContext(access, mode, scope);
        const inContext = context?.filter((e) => visible.has(e.scoreId)) ?? [];
        const rest = unique
          .filter((id) => !inContext.some((e) => e.scoreId === id))
          .map((id) => ({ scoreId: id, title: visible.get(id)?.title ?? '', number: null }));
        return { name: 'Auswahl', entries: [...inContext, ...rest] };
      }
    }
  }

  private async selectionContext(access: AccessContext, mode: OutputMode, scope: { folderId?: string; eventId?: string }): Promise<OutputEntry[] | undefined> {
    if (scope.folderId) {
      await this.folder(access, mode, scope.folderId);
      return this.repo.folderEntries(scope.folderId);
    }
    if (scope.eventId) {
      await this.event(access, mode, scope.eventId);
      return this.setlistEntries(scope.eventId);
    }
    return undefined;
  }

  private visibleScores(access: AccessContext, mode: OutputMode, ids: readonly string[]) {
    const all = mode === 'print' && access.has('score.view');
    return this.repo.scoreTitles(ids, all ? 'all' : access.memberEnsembleIds());
  }

  private async folder(access: AccessContext, mode: OutputMode, folderId: string) {
    const visible = await this.me.folder(access.memberEnsembleIds(), folderId);
    if (visible) return visible;
    if (mode === 'print') {
      const row = await this.repo.folder(folderId);
      if (row && access.has('folder.view', row.ensembleId)) return row;
    }
    throw ProblemException.notFound();
  }

  private async event(access: AccessContext, mode: OutputMode, eventId: string) {
    const visible = await this.me.event(access.memberEnsembleIds(), eventId);
    if (visible) return visible;
    if (mode === 'print') {
      const row = await this.repo.event(eventId);
      if (row && access.has('event.view', row.ensembleId)) return row;
    }
    throw ProblemException.notFound();
  }

  private async setlistEntries(eventId: string): Promise<OutputEntry[]> {
    const rows = await this.repo.setlistEntries(eventId);
    return rows.map((r) => ({ scoreId: r.scoreId, title: r.title, number: String(r.position).padStart(2, '0') }));
  }
}
