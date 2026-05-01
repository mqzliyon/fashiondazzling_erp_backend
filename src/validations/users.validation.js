const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const listUsersSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    ...paginationQueryFields,
  }),
});

module.exports = {
  listUsersSchema,
};
