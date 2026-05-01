const { z } = require("zod");

/** Merge into list route `query` objects for ?page=&limit= */
const paginationQueryFields = {
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
};

module.exports = { paginationQueryFields };
