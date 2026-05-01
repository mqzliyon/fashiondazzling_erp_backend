const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const createRejectEntrySchema = z.object({
  body: z.object({
    lot: z.string().regex(objectIdRegex, "lot must be a valid id"),
    stage: z.enum(["cutting", "embroidery"]),
    quantity: z.coerce.number().int().positive("quantity must be greater than 0"),
    reason: z.string().trim().min(1, "reason is required").max(500),
    date: z.coerce.date().optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const getRejectEntriesSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    lot: z.string().regex(objectIdRegex, "lot must be a valid id").optional(),
    stage: z.enum(["cutting", "embroidery"]).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    ...paginationQueryFields,
  }),
});

const getRejectSummarySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

const rejectEntryIdParamsSchema = z.object({
  entryId: z.string().regex(objectIdRegex, "entryId must be a valid id"),
});

const deleteRejectEntrySchema = z.object({
  body: z.object({}).default({}),
  params: rejectEntryIdParamsSchema,
  query: z.object({}).default({}),
});

module.exports = {
  createRejectEntrySchema,
  getRejectEntriesSchema,
  getRejectSummarySchema,
  deleteRejectEntrySchema,
};
