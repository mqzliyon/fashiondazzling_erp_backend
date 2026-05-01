const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const createCuttingConversionSchema = z
  .object({
    body: z.object({
      lotId: z.string().regex(objectIdRegex, "lotId must be a valid id"),
      kg: z.coerce.number().positive("kg must be greater than 0"),
      ratioId: z.string().regex(objectIdRegex, "ratioId must be a valid id").optional(),
      fabricType: z.string().trim().optional(),
      date: z.coerce.date().optional(),
    }),
    params: z.object({}).default({}),
    query: z.object({}).default({}),
  })
  .refine(
    (data) => Boolean(data.body.ratioId) || Boolean(data.body.fabricType),
    {
      message: "Provide ratioId or fabricType",
      path: ["body", "ratioId"],
    }
  );

const conversionIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    id: z.string().regex(objectIdRegex, "Invalid conversion id"),
  }),
  query: z.object({}).default({}),
});

const listCuttingConversionSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    lotId: z.string().regex(objectIdRegex, "lotId must be a valid id").optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    ...paginationQueryFields,
  }),
});

module.exports = {
  createCuttingConversionSchema,
  conversionIdSchema,
  listCuttingConversionSchema,
};
