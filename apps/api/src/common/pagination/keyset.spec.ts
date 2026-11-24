import type { SQL } from 'drizzle-orm';
import { MySqlDialect, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';
import { afterNameAndId } from './keyset';

const items = mysqlTable('items', { id: varchar('id', { length: 36 }), name: text('name') });

describe('afterNameAndId', () => {
  it('adds no condition on the first page', () => {
    expect(afterNameAndId(items.name, items.id, undefined)).toBeUndefined();
  });

  it('compares lower(name) and id with the cursor', () => {
    const condition = afterNameAndId(items.name, items.id, ['anna', '01a2076a-7e4d-76c9-aca4-38efbd245a43']);
    const query = new MySqlDialect().sqlToQuery(condition as SQL);

    expect(query.sql).toBe('(lower(`items`.`name`), `items`.`id`) > (?, ?)');
    expect(query.params).toEqual(['anna', '01a2076a-7e4d-76c9-aca4-38efbd245a43']);
  });
});
