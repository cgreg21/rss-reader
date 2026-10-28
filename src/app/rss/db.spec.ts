import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

import { db } from './db';

describe('db', () => {
  beforeEach(async () => {
    for (const r of await db.all<{ id: string }>('feeds')) await db.remove('feeds', r.id);
  });

  it('puts, lists and removes records', async () => {
    await db.put('feeds', { id: 'a', title: 'A' });
    await db.putMany('feeds', [{ id: 'b' }, { id: 'c' }]);
    expect((await db.all<{ id: string }>('feeds')).map((f) => f.id).sort()).toEqual(['a', 'b', 'c']);
    await db.remove('feeds', 'a');
    expect(await db.all('feeds')).toHaveLength(2);
  });

  it('rejects when a transaction fails', async () => {
    await expect(db.put('categories', { name: 'no key' })).rejects.toBeDefined();
    await expect(db.putMany('categories', [{ name: 'no key' }])).rejects.toBeDefined();
  });
});
