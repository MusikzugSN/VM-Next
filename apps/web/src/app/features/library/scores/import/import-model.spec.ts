import type { FieldDefinition } from '@vm-web/shared';

import { parseCsv } from './csv';
import { buildImportBody, initialMapping, mappingProblems, storeMapping, type ColumnMapping } from './import-model';

const genre: FieldDefinition = { id: '0190a000-0000-7000-8000-000000000001', name: 'Genre', type: 'select', required: false, position: 0, options: [] };
const col = (target: ColumnMapping['target'], newName = '', newType: ColumnMapping['newType'] = 'text'): ColumnMapping => ({ target, newName, newType });

describe('CSV import mapping (N-19)', () => {
  beforeEach(() => localStorage.clear());

  it('proposes targets from known header names and custom field names, each fixed field once', () => {
    const mapping = initialMapping(['Stück', 'Titel', 'Komponist', 'Genre', 'Titel', 'Notenbücher'], [genre]);
    expect(mapping.map((m) => m.target)).toEqual(['ignore', 'fixed:title', 'fixed:composer', `field:${genre.id}`, 'ignore', 'ignore']);
  });

  it('remembers the mapping per column name', () => {
    storeMapping(['Notenbücher', 'Verwendungszwecke'], [col('folder'), col('new', 'Verwendung', 'multiselect')]);
    const mapping = initialMapping(['notenbücher', 'Verwendungszwecke'], []);
    expect(mapping).toEqual([col('folder', 'notenbücher'), col('new', 'Verwendung', 'multiselect')]);
  });

  it('maps a remembered new field to the field the last import created', () => {
    storeMapping(['Genre', 'Stil'], [col('new', 'Genre', 'select'), col('new', 'Epoche', 'select')]);
    const epoche: FieldDefinition = { ...genre, id: '0190a000-0000-7000-8000-000000000002', name: 'epoche', position: 1 };
    const mapping = initialMapping(['Genre', 'Stil'], [genre, epoche]);
    expect(mapping.map((m) => m.target)).toEqual([`field:${genre.id}`, `field:${epoche.id}`]);
    expect(mappingProblems(mapping, [genre, epoche])).not.toContain('newFieldTaken');
  });

  it('keeps a remembered new field while it does not exist yet', () => {
    storeMapping(['Genre'], [col('new', 'Genre', 'select')]);
    expect(initialMapping(['Genre'], [])).toEqual([col('new', 'Genre', 'select')]);
  });

  it('forgets remembered custom fields that no longer exist', () => {
    storeMapping(['Genre'], [col('field:0190a000-0000-7000-8000-00000000dead')]);
    expect(initialMapping(['Genre'], [])[0].target).toBe('ignore');
  });

  it('reports a missing title, duplicate targets and bad new field names', () => {
    expect(mappingProblems([col('fixed:composer')], [])).toEqual(['titleMissing']);
    expect(mappingProblems([col('fixed:title'), col('fixed:title')], [])).toEqual(['duplicateTarget']);
    expect(mappingProblems([col('fixed:title'), col('new', ' ')], [])).toEqual(['newFieldName']);
    expect(mappingProblems([col('fixed:title'), col('new', 'genre')], [genre])).toEqual(['newFieldTaken']);
  });

  it('builds rows with raw cells, new fields, folder and chosen actions', () => {
    const table = parseCsv('Titel,Genre,Mappe,Nr,Egal\nWaldzauber,Walzer,Konzertmappe,3,x\nTokayer,Marsch,,,y');
    const columns = [col('fixed:title'), col('new', 'Genre', 'select'), col('folder'), col('folderNumber'), col('ignore')];
    const body = buildImportBody(table, { columns, fixedFolder: '', folderEnsembleId: 'ens' }, new Map([[3, 'skip']]), true);
    expect(body).toEqual({
      dryRun: true,
      newFields: [{ key: 'col-1', name: 'Genre', type: 'select' }],
      folderEnsembleId: 'ens',
      rows: [
        { line: 2, fixed: { title: 'Waldzauber' }, custom: { 'new:col-1': 'Walzer' }, folder: { name: 'Konzertmappe', number: '3' } },
        { line: 3, fixed: { title: 'Tokayer' }, custom: { 'new:col-1': 'Marsch' }, folder: null, action: 'skip' },
      ],
    });
  });

  it('uses the fixed folder name when no column holds the folder', () => {
    const table = parseCsv('Titel,Nummer\nWaldzauber,3');
    const body = buildImportBody(table, { columns: [col('fixed:title'), col('folderNumber')], fixedFolder: ' Grünes Marschbuch ', folderEnsembleId: 'ens' }, new Map(), false);
    expect(body.rows[0].folder).toEqual({ name: 'Grünes Marschbuch', number: '3' });
    const without = buildImportBody(table, { columns: [col('fixed:title'), col('folderNumber')], fixedFolder: '', folderEnsembleId: 'ens' }, new Map(), false);
    expect(without.rows[0].folder).toBeNull();
    expect(without.folderEnsembleId).toBeNull();
  });
});
