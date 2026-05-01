const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * Read page/limit from query (after Zod coercion) or raw strings.
 */
function getPaginationFromQuery(query = {}) {
  const pageRaw = query.page ?? DEFAULT_PAGE;
  const limitRaw = query.limit ?? DEFAULT_LIMIT;
  const page = Math.max(1, Number(pageRaw) || DEFAULT_PAGE);
  let limit = Number(limitRaw) || DEFAULT_LIMIT;
  if (limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildPaginationMeta({ total, page, limit }) {
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  const totalPages = limit > 0 ? Math.max(1, Math.ceil(safeTotal / limit)) : 1;
  return {
    page,
    limit,
    total: safeTotal,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Paginate an in-memory array (e.g. after aggregation / grouping).
 */
function paginateArray(items, page, limit) {
  const { skip } = getPaginationFromQuery({ page, limit });
  const total = items.length;
  const data = items.slice(skip, skip + limit);
  return {
    data,
    total,
    pagination: buildPaginationMeta({ total, page, limit }),
  };
}

module.exports = {
  getPaginationFromQuery,
  buildPaginationMeta,
  paginateArray,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
