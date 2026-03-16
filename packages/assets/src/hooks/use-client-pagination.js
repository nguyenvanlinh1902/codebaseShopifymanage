import {useState, useMemo, useEffect} from 'react';

/**
 * Reusable client-side pagination + search hook.
 * Filters items by search query across specified keys, then paginates.
 *
 * @param {Array} items - Full array of data
 * @param {Object} options
 * @param {number} [options.defaultPerPage=20] - Items per page
 * @param {string[]} [options.searchKeys=[]] - Object keys to search through
 * @returns pagination state and helpers
 */
export default function useClientPagination(items, {defaultPerPage = 10, searchKeys = []} = {}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(defaultPerPage);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search || searchKeys.length === 0) return items;
    const q = search.toLowerCase();
    return items.filter(item =>
      searchKeys.some(key => {
        const val = item[key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [items, search, searchKeys]);

  // Reset to page 1 when search/perPage/data changes
  useEffect(() => {
    setPage(1);
  }, [search, perPage, items]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  return {
    items: paged,
    page: safePage,
    setPage,
    perPage,
    setPerPage,
    search,
    setSearch,
    totalPages,
    totalItems,
    filtered
  };
}
