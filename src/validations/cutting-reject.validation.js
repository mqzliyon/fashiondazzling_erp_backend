const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const rejectFromCuttingSchema = z.object({
  body: z.object({
    conversionId: z.string().regex(objectIdRegex, "conversionId must be a valid id"),
    rejectedPieces: z.coerce.number().int().positive("rejectedPieces must be greater than 0"),
    reason: z.string().trim().min(1, "reason is required").max(500),
    date: z.coerce.date().optional(),
    operatorName: z.string().trim().min(1).optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const listCuttingRejectHistorySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    conversionId: z.string().regex(objectIdRegex, "conversionId must be a valid id").optional(),
    lotId: z.string().regex(objectIdRegex, "lotId must be a valid id").optional(),
    ...paginationQueryFields,
  }),
});

const listRejectInventorySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    ...paginationQueryFields,
  }),
});

module.exports = {
  rejectFromCuttingSchema,
  listCuttingRejectHistorySchema,
  getRejectInventorySchema: listRejectInventorySchema,
};
