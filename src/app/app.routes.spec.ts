import { describe, expect, it } from 'vitest';

import { routes } from './app.routes';

describe('routes', () => {
  it('lazy-loads each page', async () => {
    const loaded = await Promise.all(
      routes.filter((r) => r.loadComponent).map((r) => (r.loadComponent as () => Promise<unknown>)()),
    );
    expect(loaded).toHaveLength(4);
  });

  it('redirects unknown paths to the list', () => {
    expect(routes.at(-1)).toMatchObject({ path: '**', redirectTo: '' });
  });
});
