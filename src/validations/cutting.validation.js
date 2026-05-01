const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;
const idParamsSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid cutting batch id"),
});

const receiveTransferredFabricSchema = z.object({
  body: z.object({
    fabricLotId: z.string().regex(objectIdRegex, "fabricLotId must be a valid id"),
    quantityKg: z.coerce.number().positive("quantityKg must be greater than 0"),
    transferDate: z.coerce.date().optional(),
    operatorName: z.string().trim().min(1).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const getCuttingBatchHistorySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    operatorName: z.string().trim().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    ...paginationQueryFields,
  }),
});

const listWithPaginationQuery = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    ...paginationQueryFields,
  }),
});

const cuttingBatchIdSchema = z.object({
  body: z.object({}).default({}),
  params: idParamsSchema,
  query: z.object({}).default({}),
});

const completeCuttingBatchSchema = z.object({
  body: z.object({
    convertedKg: z.coerce.number().positive("convertedKg must be greater than 0"),
    outputPieces: z.coerce.number().positive("outputPieces must be greater than 0"),
    completionDate: z.coerce.date().optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  params: idParamsSchema,
  query: z.object({}).default({}),
});

const sendCompletedToLotSchema = z.object({
  body: z.object({
    pieceLotId: z.string().regex(objectIdRegex, "pieceLotId must be a valid id"),
    pieces: z.coerce.number().positive("pieces must be greater than 0"),
    option: z.string().trim().max(100).optional(),
    date: z.coerce.date().optional(),
  }),
  params: z.object({
    fabricType: z.string().trim().min(1, "fabricType is required"),
  }),
  query: z.object({}).default({}),
});

module.exports = {
  receiveTransferredFabricSchema,
  getCuttingBatchHistorySchema,
  getCurrentCuttingStockSchema: listWithPaginationQuery,
  getCuttingStockSummarySchema: listWithPaginationQuery,
  getCompletedCuttingSummarySchema: listWithPaginationQuery,
  cuttingBatchIdSchema,
  completeCuttingBatchSchema,
  sendCompletedToLotSchema,
};
