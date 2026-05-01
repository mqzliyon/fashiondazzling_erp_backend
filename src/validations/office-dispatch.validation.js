const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const dispatchIdParamsSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid office dispatch id"),
});

const createOfficeDispatchSchema = z.object({
  body: z.object({
    office: z.string().trim().min(1, "office is required"),
    lot: z.string().regex(objectIdRegex, "lot must be a valid id"),
    quantity: z.coerce.number().int().positive("quantity must be greater than 0"),
    dispatchDate: z.coerce.date().optional(),
    referenceNo: z.string().trim().min(1, "referenceNo is required"),
    status: z.enum(["dispatched", "received", "cancelled"]).optional(),
    source: z.enum(["embroidery", "factory_warehouse"]).optional(),
    grade: z.enum(["A Grade", "B Grade"]).optional(),
  }).superRefine((data, ctx) => {
    if (data.source === "factory_warehouse" && !data.grade) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "grade is required when source is factory_warehouse",
        path: ["grade"],
      });
    }
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({}),
});

const getOfficeDispatchByIdSchema = z.object({
  body: z.object({}).default({}),
  params: dispatchIdParamsSchema,
  query: z.object({}).default({}),
});

const getOfficeDispatchesSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    office: z.string().trim().optional(),
    status: z.enum(["dispatched", "received", "cancelled"]).optional(),
    ...paginationQueryFields,
  }),
});

const updateOfficeDispatchStatusSchema = z.object({
  body: z.object({
    status: z.enum(["dispatched", "received", "cancelled"]),
  }),
  params: dispatchIdParamsSchema,
  query: z.object({}).default({}),
});

const deleteOfficeDispatchSchema = z.object({
  body: z.object({}).default({}),
  params: dispatchIdParamsSchema,
  query: z.object({}).default({}),
});

module.exports = {
  createOfficeDispatchSchema,
  getOfficeDispatchesSchema,
  getOfficeDispatchByIdSchema,
  updateOfficeDispatchStatusSchema,
  deleteOfficeDispatchSchema,
};
