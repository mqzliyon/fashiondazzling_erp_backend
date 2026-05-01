const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const idParamsSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid fabric lot id"),
});

const listFabricLotsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    ...paginationQueryFields,
  }),
});

const createFabricLotSchema = z.object({
  body: z
    .object({
    fabricType: z.string().trim().min(1, "fabricType is required"),
    quantityKg: z.coerce.number().min(0, "quantityKg must be >= 0").optional(),
    receivedKg: z.coerce.number().min(0, "receivedKg must be >= 0").optional(),
    transferredKg: z.coerce.number().min(0, "transferredKg must be >= 0").optional(),
    receiveDate: z.coerce.date().optional(),
    })
    .refine((data) => data.quantityKg !== undefined || data.receivedKg !== undefined, {
      message: "quantityKg is required",
      path: ["quantityKg"],
    }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const updateFabricLotSchema = z.object({
  body: z
    .object({
      fabricType: z.string().trim().min(1).optional(),
      quantityKg: z.coerce.number().min(0).optional(),
      receivedKg: z.coerce.number().min(0).optional(),
      transferredKg: z.coerce.number().min(0).optional(),
      receiveDate: z.coerce.date().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required for update",
    }),
  params: idParamsSchema,
  query: z.object({}).default({}),
});

const fabricLotIdSchema = z.object({
  body: z.object({}).default({}),
  params: idParamsSchema,
  query: z.object({}).default({}),
});

const transferToCuttingSchema = z.object({
  body: z.object({
    quantityKg: z.coerce.number().positive("quantityKg must be greater than 0"),
    cuttingDate: z.coerce.date().optional(),
    operatorName: z.string().trim().min(1).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  params: idParamsSchema,
  query: z.object({}).default({}),
});

module.exports = {
  listFabricLotsSchema,
  createFabricLotSchema,
  updateFabricLotSchema,
  fabricLotIdSchema,
  transferToCuttingSchema,
};
