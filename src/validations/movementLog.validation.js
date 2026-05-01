const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const movementLogBodySchema = z.object({
  fromStage: z.string().trim().min(1, "fromStage is required"),
  toStage: z.string().trim().min(1, "toStage is required"),
  lot: z.string().regex(objectIdRegex, "lot must be a valid id"),
  quantity: z.coerce.number().positive("quantity must be greater than 0"),
  unit: z.string().trim().min(1, "unit is required"),
  date: z.coerce.date().optional(),
  user: z.string().trim().min(1, "user is required"),
});

const createMovementLogSchema = z.object({
  body: movementLogBodySchema,
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const movementLogIdParamsSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid movement log id"),
});

const movementLogIdSchema = z.object({
  body: z.object({}).default({}),
  params: movementLogIdParamsSchema,
  query: z.object({}).default({}),
});

const getMovementLogsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    lot: z.string().regex(objectIdRegex, "lot must be a valid id").optional(),
    fromStage: z.string().trim().optional(),
    toStage: z.string().trim().optional(),
    ...paginationQueryFields,
  }),
});

module.exports = {
  createMovementLogSchema,
  movementLogIdSchema,
  getMovementLogsSchema,
};
