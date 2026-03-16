/**
 * Server-side pagination + text search for arrays.
 * Applies text search across specified keys, then paginates the result.
 *
 * @param {Array} items - Full array of records
 * @param {Object} options
 * @param {number} [options.page=1] - Current page (1-based)
 * @param {number} [options.perPage=10] - Items per page
 * @param {string} [options.search=''] - Text search query
 * @param {string[]} [options.searchKeys=[]] - Object keys to search through
 * @returns {{data: Array, pagination: {page, perPage, total, totalPages}}}
 */
export function paginateArray(items, {page = 1, perPage = 10, search = '', searchKeys = []} = {}) {
  let filtered = items;

  if (search && searchKeys.length > 0) {
    const q = search.toLowerCase();
    filtered = items.filter(item =>
      searchKeys.some(key => {
        const val = item[key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  const data = filtered.slice(start, start + perPage);

  return {
    data,
    pagination: {page: safePage, perPage, total, totalPages}
  };
}

/**
 * Parse pagination query params from Express request.
 * @param {Object} query - req.query object
 * @returns {{page: number, perPage: number, search: string}}
 */
export function parsePaginationParams(query) {
  return {
    page: parseInt(query.page) || 1,
    perPage: parseInt(query.perPage) || 10,
    search: query.search || ''
  };
}
