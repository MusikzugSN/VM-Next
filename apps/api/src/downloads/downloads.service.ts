import { Inject, Injectable, Logger } from '@nestjs/common';
import { downloadFileName, PRINT_MAX_PAGES, printModeFor, type PrintPlanResponse, type PrintQuery, type SubstituteMode } from '@vm-web/shared';
import { ZipArchive } from 'archiver';
import { once } from 'node:events';
import type { Readable } from 'node:stream';
import type { AccessContext } from '../access/access-context';
import { sheetFileName, uniqueNames } from '../common/files/download-names';
import { ProblemException } from '../common/problem-details/problem.exception';
import { MeRepository } from '../me/me.repository';
import { PrintRulesService } from '../print-rules/print-rules.service';
import { ClubSettingsRepository } from '../settings/club-settings.repository';
import { FILE_STORAGE, type IFileStorage } from '../storage/file-storage';
import { streamToBuffer } from '../storage/stream-utils';
import { DownloadsRepository } from './downloads.repository';
import { OutputService, type OutputPlan, type OutputScope } from './output.service';
import { buildPrintPdf, layoutDocuments, printRoute } from './print-layout';
import { readOrNotFound } from '../storage/read-or-not-found';

interface FileResult<T = Readable> {
  body: T;
  fileName: string;
}

@Injectable()
export class DownloadsService {
  private readonly logger = new Logger('Downloads');

  constructor(
    @Inject(DownloadsRepository) private readonly repo: DownloadsRepository,
    @Inject(MeRepository) private readonly me: MeRepository,
    @Inject(OutputService) private readonly output: OutputService,
    @Inject(ClubSettingsRepository) private readonly settings: ClubSettingsRepository,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
    @Inject(PrintRulesService) private readonly printRules: PrintRulesService,
  ) {}

  async sheet(access: AccessContext, sheetId: string, folderId: string | undefined): Promise<FileResult> {
    const row = await this.repo.sheetWithNames(sheetId);
    const ensembleIds = access.memberEnsembleIds();
    if (!row || !(await this.me.visibleScore(ensembleIds, row.scoreId))) throw ProblemException.notFound();

    let number: string | null = null;
    if (folderId) {
      if (!(await this.me.folder(ensembleIds, folderId))) throw ProblemException.notFound();
      number = await this.me.folderNumber(folderId, row.scoreId);
    }
    return { body: await this.read(row.fileKey), fileName: sheetFileName({ number, title: row.title, voice: row.voice }) };
  }

  async zip(access: AccessContext, scope: OutputScope, voiceIds: readonly string[], substitutes: SubstituteMode): Promise<FileResult> {
    const plan = await this.output.plan(access, 'download', scope, voiceIds, substitutes);
    const names = uniqueNames(plan.documents.map((d) => sheetFileName({ number: d.number, title: d.title, voice: d.sheet.voice.name })));
    const archive = new ZipArchive({ store: true });

    void (async () => {
      try {
        for (const [i, doc] of plan.documents.entries()) {
          const stream = await this.storage.read(doc.fileKey).catch(() => null);
          if (!stream) {
            this.logger.error(`Sheet ${doc.sheet.sheetId}: file ${doc.fileKey} missing, left out of the ZIP`);
            continue;
          }
          archive.append(stream, { name: names[i] });
          await once(archive, 'entry');
        }
        await archive.finalize();
      } catch (error) {
        archive.destroy(error as Error);
      }
    })();

    return { body: archive, fileName: downloadFileName(outputName(plan), 'zip') };
  }

  async printPlan(access: AccessContext, query: PrintQuery): Promise<PrintPlanResponse> {
    const plan = await this.output.plan(access, 'print', scopeOf(query), query.voiceId, query.substitutes);
    const pages = plan.documents.map((d) => d.sheet.pageCount);
    const effective = await this.printRules.effective(await this.contextEnsemble(query));
    const layout = layoutDocuments(
      pages,
      pages.map((p) => printModeFor(p, effective.rules)),
    );
    const { browserPrintPageLimit } = await this.settings.get();
    return {
      totalPages: layout.totalPages,
      pageLimit: browserPrintPageLimit,
      route: printRoute(layout.totalPages, browserPrintPageLimit),
      duplex: layout.duplex,
      rules: { source: effective.source, items: effective.rules },
      documents: plan.documents.map((d, i) => ({
        scoreId: d.scoreId,
        number: d.number,
        title: d.title,
        voice: d.sheet.voice,
        kind: d.sheet.kind,
        pages: d.sheet.pageCount,
        mode: layout.documents[i].mode,
        sheets: layout.documents[i].sheets,
        blankPagesAfter: layout.documents[i].blanks,
      })),
      missing: plan.missing.map((m) => ({ id: m.scoreId, name: m.title })),
    };
  }

  async printDocument(access: AccessContext, query: PrintQuery): Promise<FileResult<Buffer>> {
    const plan = await this.output.plan(access, 'print', scopeOf(query), query.voiceId, query.substitutes);
    if (!plan.documents.length) throw ProblemException.notFound('Nothing to print');
    const sourcePages = plan.documents.reduce((sum, d) => sum + d.sheet.pageCount, 0);
    if (sourcePages > PRINT_MAX_PAGES) {
      throw new ProblemException(413, 'print-too-large', `Print job of ${sourcePages} pages exceeds the limit of ${PRINT_MAX_PAGES}`);
    }
    const sources: Uint8Array[] = [];
    for (const doc of plan.documents) sources.push(await streamToBuffer(await this.read(doc.fileKey)));
    const { rules } = await this.printRules.effective(await this.contextEnsemble(query));
    const pdf = await buildPrintPdf(
      sources,
      plan.documents.map((d) => printModeFor(d.sheet.pageCount, rules)),
    );
    return { body: Buffer.from(pdf.bytes), fileName: downloadFileName(`Druck – ${outputName(plan)}`, 'pdf') };
  }

  private async contextEnsemble(query: PrintQuery): Promise<string | null> {
    if (query.folderId) return (await this.repo.folder(query.folderId))?.ensembleId ?? null;
    if (query.eventId) return (await this.repo.event(query.eventId))?.ensembleId ?? null;
    return null;
  }

  private async read(fileKey: string): Promise<Readable> {
    return readOrNotFound(this.storage, fileKey, this.logger, `File ${fileKey} missing in storage`);
  }
}

function scopeOf(q: PrintQuery): OutputScope {
  switch (q.scope) {
    case 'score':
      return { kind: 'score', scoreId: q.scoreId as string };
    case 'folder':
      return { kind: 'folder', folderId: q.folderId as string };
    case 'event':
      return { kind: 'event', eventId: q.eventId as string };
    case 'selection':
      return { kind: 'selection', scoreIds: q.scoreIds, folderId: q.folderId, eventId: q.eventId };
  }
}

function outputName(plan: OutputPlan): string {
  const voiceNames = plan.activeVoices.map((v) => v.name).join(', ');
  return voiceNames ? `${plan.name} – ${voiceNames}` : plan.name;
}
