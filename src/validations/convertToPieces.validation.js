const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const ratioIdParamsSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid conversion ratio id"),
});

const createConversionRatioSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "name is required"),
    piecesPerKg: z.coerce.number().positive("piecesPerKg must be greater than 0"),
    fabricType: z.string().trim().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const updateConversionRatioSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      piecesPerKg: z.coerce.number().positive().optional(),
      fabricType: z.string().trim().optional(),
      isActive: z.boolean().optional(),
      isDefault: z.boolean().optional(),
      notes: z.string().trim().max(500).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required for update",
    }),
  params: ratioIdParamsSchema,
  query: z.object({}).default({}),
});

const conversionRatioByIdSchema = z.object({
  body: z.object({}).default({}),
  params: ratioIdParamsSchema,
  query: z.object({}).default({}),
});

const listConversionRatioSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    isActive: z.string().optional(),
    fabricType: z.string().trim().optional(),
    ...paginationQueryFields,
  }),
});

const convertToPiecesSchema = z
  .object({
    body: z.object({
      kg: z.coerce.number().positive("kg must be greater than 0"),
      ratioId: z.string().regex(objectIdRegex, "Invalid ratioId").optional(),
      fabricType: z.string().trim().optional(),
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({}),
  })
  .refine(
    (data) => Boolean(data.body.ratioId) || Boolean(data.body.fabricType),
    {
      message: "Provide ratioId or fabricType for conversion",
      path: ["body", "ratioId"],
    }
  );

module.exports = {
  createConversionRatioSchema,
  getConversionRatioByIdSchema: conversionRatioByIdSchema,
  listConversionRatioSchema,
  updateConversionRatioSchema,
  convertToPiecesSchema,
};
