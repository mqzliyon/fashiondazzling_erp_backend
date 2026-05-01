const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const idParamsSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid lot id"),
});

const emptySchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    includeAuto: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (typeof value === "boolean") return value;
        return value.toLowerCase() === "true";
      }),
    ...paginationQueryFields,
  }),
});

const createPieceLotSchema = z.object({
  body: z.object({
    lotNumber: z.string().trim().min(1, "lotNumber is required"),
    date: z.coerce.date().optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const updatePieceLotSchema = z.object({
  body: z.object({
    lotNumber: z.string().trim().min(1).optional(),
    date: z.coerce.date().optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  params: idParamsSchema,
  query: z.object({}).default({}),
});

const pieceLotIdSchema = z.object({
  body: z.object({}).default({}),
  params: idParamsSchema,
  query: z.object({}).default({}),
});

const sendToEmbroiderySchema = z.object({
  body: z.object({
    pieces: z.coerce.number().positive("pieces must be greater than 0"),
    notes: z.string().trim().max(500).optional(),
    date: z.coerce.date().optional(),
  }),
  params: idParamsSchema,
  query: z.object({}).default({}),
});

module.exports = {
  getPieceLotsSchema: emptySchema,
  createPieceLotSchema,
  updatePieceLotSchema,
  pieceLotIdSchema,
  sendToEmbroiderySchema,
};

