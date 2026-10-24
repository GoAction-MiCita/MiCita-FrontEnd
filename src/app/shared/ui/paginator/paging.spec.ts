import {
  DEFAULT_PAGE_SIZE,
  FIRST_PAGE,
  PageLink,
  pageWindow,
  samePaging,
  toPaging,
  toPagingParams,
} from './paging';

function shown(links: PageLink[]): string {
  return links.map((link) => (link.kind === 'gap' ? '…' : String(link.page + 1))).join(' ');
}

describe('paging', () => {
  it('reads a 1-based page and an allowed size from the URL', () => {
    expect(toPaging({ page: '3', size: '50' })).toEqual({ page: 2, size: 50 });
  });

  it.each([
    [{}, FIRST_PAGE],
    [{ page: '0', size: '30' }, FIRST_PAGE],
    [{ page: '-2', size: '1000' }, FIRST_PAGE],
    [{ page: '2.5', size: 'abc' }, FIRST_PAGE],
    [
      { page: '<script>', size: '100' },
      { page: 0, size: 100 },
    ],
  ])('falls back to the defaults for %o', (params, paging) => {
    expect(toPaging(params)).toEqual(paging);
  });

  it('writes only what is not the default, 1-based', () => {
    expect(toPagingParams(FIRST_PAGE)).toEqual({ page: null, size: null });
    expect(toPagingParams({ page: 1, size: 100 })).toEqual({ page: '2', size: '100' });
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });

  it('round-trips through the URL', () => {
    const paging = { page: 4, size: 50 } as const;
    const params = toPagingParams(paging);

    expect(toPaging(params)).toEqual(paging);
    expect(samePaging(paging, { page: 4, size: 50 })).toBe(true);
    expect(samePaging(paging, { page: 4, size: 20 })).toBe(false);
  });
});

describe('pageWindow', () => {
  it.each([
    [0, 0, ''],
    [0, 1, '1'],
    [1, 3, '1 2 3'],
    [0, 5, '1 2 3 4 5'],
    [0, 10, '1 2 3 4 5 … 10'],
    [5, 10, '1 … 5 6 7 … 10'],
    [9, 10, '1 … 6 7 8 9 10'],
  ])('page %i of %i shows "%s"', (current, total, expected) => {
    expect(shown(pageWindow(current, total))).toBe(expected);
  });
});
