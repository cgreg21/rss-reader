import { afterEach, describe, expect, it, vi } from 'vitest';

import { download, pickedText } from './download';

describe('download helpers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves content through a temporary link', () => {
    URL.createObjectURL = vi.fn(() => 'blob:abc');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    download('data', 'text/plain', 'f.txt');
    expect(click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:abc');
  });

  it('reads the picked file and resets the input', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    const file = new File(['hello'], 'a.txt');
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    expect(await pickedText({ target: input } as unknown as Event)).toBe('hello');
    Object.defineProperty(input, 'files', { configurable: true, value: [] });
    expect(await pickedText({ target: input } as unknown as Event)).toBeNull();
  });
});
