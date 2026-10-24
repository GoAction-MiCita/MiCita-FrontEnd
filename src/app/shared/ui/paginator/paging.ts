/** Page sizes offered by every paginated table. */
export const PAGE_SIZES = [20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 20;

/** Requested page: `page` is 0-based like the API; the UI and the URL show it 1-based. */
export interface Paging {
  readonly page: number;
  readonly size: PageSize;
}

export const FIRST_PAGE: Paging = { page: 0, size: DEFAULT_PAGE_SIZE };

/** Raw `?page=&size=` query params (strings from the URL, possibly missing or tampered). */
export interface PagingParams {
  readonly page?: string | null;
  readonly size?: string | null;
}

/** URL → paging. `page` is 1-based in the URL; anything invalid falls back to the defaults. */
export function toPaging(params: PagingParams): Paging {
  const page = Number(params.page);
  const size = Number(params.size);
  return {
    page: Number.isInteger(page) && page >= 1 ? page - 1 : 0,
    size: isPageSize(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** Paging → URL. Defaults become `null` so the first page has a clean URL. */
export function toPagingParams(paging: Paging): Record<'page' | 'size', string | null> {
  return {
    page: paging.page > 0 ? String(paging.page + 1) : null,
    size: paging.size !== DEFAULT_PAGE_SIZE ? String(paging.size) : null,
  };
}

export function samePaging(a: Paging, b: Paging): boolean {
  return a.page === b.page && a.size === b.size;
}

export function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZES as readonly number[]).includes(value);
}

/** Page number or gap shown by the paginator. */
export type PageLink = { readonly kind: 'page'; readonly page: number } | { readonly kind: 'gap' };

/**
 * Pages to show (0-based): always the first and last, the current one and its neighbours,
 * with a gap where pages are skipped. 1 2 3 4 5 … 10 / 1 … 4 5 6 … 10 / 1 … 6 7 8 9 10.
 */
export function pageWindow(current: number, totalPages: number, neighbours = 1): PageLink[] {
  if (totalPages <= 0) {
    return [];
  }
  const visible = new Set<number>([0, totalPages - 1]);
  // Near an edge, show a few more pages so the bar keeps the same width.
  const start = Math.max(0, Math.min(current - neighbours, totalPages - 3 - neighbours * 2));
  const end = Math.min(totalPages - 1, Math.max(current + neighbours, 2 + neighbours * 2));
  for (let page = start; page <= end; page++) {
    visible.add(page);
  }
  const links: PageLink[] = [];
  let previous = -1;
  for (const page of [...visible].sort((a, b) => a - b)) {
    if (page - previous > 1) {
      links.push({ kind: 'gap' });
    }
    links.push({ kind: 'page', page });
    previous = page;
  }
  return links;
}
