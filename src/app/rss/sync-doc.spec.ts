import { describe, expect, it } from 'vitest';

import { SyncDoc, canonicalSyncDoc } from './rss.store';

describe('canonicalSyncDoc', () => {
  it('ignores ordering and the legacy number format', () => {
    const a: SyncDoc = {
      feeds: [{ url: 'https://b', title: 'B', category: null }, { url: 'https://a', title: 'A', category: 'X', at: 0 }],
      removed: ['z', 'y', 'y'],
      states: { k2: 1, k1: [3, 0] },
    };
    const b: SyncDoc = {
      feeds: [{ url: 'https://a', title: 'A', category: 'X' }, { url: 'https://b', title: 'B', category: null }],
      removed: ['y', 'z'],
      states: { k1: [3, 0], k2: [1, 0] },
    };
    expect(canonicalSyncDoc(a)).toBe(canonicalSyncDoc(b));
  });

  it('tells different states apart', () => {
    const base: SyncDoc = { feeds: [], removed: [], states: { k: [1, 10] } };
    expect(canonicalSyncDoc(base)).not.toBe(canonicalSyncDoc({ ...base, states: { k: [0, 20] } }));
  });
});
