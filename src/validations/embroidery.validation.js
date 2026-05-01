const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const receiveFromCuttingSchema = z.object({
  body: z.object({
    conversionId: z.string().regex(objectIdRegex, "conversionId must be a valid id"),
    pieces: z.coerce.number().int().positive("pieces must be greater than 0"),
    date: z.coerce.date().optional(),
    operatorName: z.string().trim().min(1).optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const rejectFromEmbroiderySchema = z.object({
  body: z.object({
    lotId: z.string().regex(objectIdRegex, "lotId must be a valid id"),
    pieces: z.coerce.number().int().positive("pieces must be greater than 0"),
    reason: z.string().trim().max(500).optional(),
    date: z.coerce.date().optional(),
    operatorName: z.string().trim().min(1).optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const dispatchFromEmbroiderySchema = z.object({
  body: z.object({
    lotId: z.string().regex(objectIdRegex, "lotId must be a valid id"),
    pieces: z.coerce.number().int().positive("pieces must be greater than 0"),
    destination: z.enum(["office", "export"]),
    date: z.coerce.date().optional(),
    operatorName: z.string().trim().min(1).optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const factoryWarehouseTransferSchema = z.object({
  body: z.object({
    lotId: z.string().regex(objectIdRegex, "lotId must be a valid id"),
    pieces: z.coerce.number().int().positive("pieces must be greater than 0"),
    grade: z.enum(["A Grade", "B Grade"]),
    notes: z.string().trim().max(500).optional(),
    date: z.coerce.date().optional(),
    operatorName: z.string().trim().min(1).optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const embroideryLotIdParamsSchema = z.object({
  lotId: z.string().regex(objectIdRegex, "lotId must be a valid id"),
});

const factoryInventoryIdParamsSchema = z.object({
  inventoryId: z.string().regex(objectIdRegex, "inventoryId must be a valid id"),
});

const embroideryLotIdSchema = z.object({
  body: z.object({}).default({}),
  params: embroideryLotIdParamsSchema,
  query: z.object({}).default({}),
});

const factoryInventoryIdSchema = z.object({
  body: z.object({}).default({}),
  params: factoryInventoryIdParamsSchema,
  query: z.object({}).default({}),
});

const getEmbroideryHistorySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    lotId: z.string().regex(objectIdRegex, "lotId must be a valid id").optional(),
    actionType: z
      .enum([
        "receive_from_cutting",
        "reject",
        "send_to_office",
        "send_to_export",
        "send_to_factory_warehouse",
        "return_from_factory_warehouse",
      ])
      .optional(),
    ...paginationQueryFields,
  }),
});

const emptyRequestSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const listStockQuerySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    ...paginationQueryFields,
  }),
});

module.exports = {
  receiveFromCuttingSchema,
  rejectFromEmbroiderySchema,
  dispatchFromEmbroiderySchema,
  factoryWarehouseTransferSchema,
  embroideryLotIdSchema,
  factoryInventoryIdSchema,
  getEmbroideryHistorySchema,
  getEmbroideryStockSchema: listStockQuerySchema,
  getFactoryWarehouseStockSchema: listStockQuerySchema,
  getEmbroideryStockSummarySchema: emptyRequestSchema,
};
