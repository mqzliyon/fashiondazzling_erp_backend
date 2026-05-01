const { z } = require("zod");
const { paginationQueryFields } = require("./pagination.validation");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const shipmentIdParamsSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid shipment id"),
});

const listForeignShipmentsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    country: z.string().trim().optional(),
    status: z.string().trim().optional(),
    ...paginationQueryFields,
  }),
});

const foreignShipmentIdSchema = z.object({
  body: z.object({}).default({}),
  params: shipmentIdParamsSchema,
  query: z.object({}).default({}),
});

const updateForeignShipmentStatusSchema = z.object({
  body: z.object({
    status: z.enum(["Packed", "Dispatched", "In Transit", "Delivered"]),
  }),
  params: shipmentIdParamsSchema,
  query: z.object({}).default({}),
});

module.exports = {
  listForeignShipmentsSchema,
  foreignShipmentIdSchema,
  updateForeignShipmentStatusSchema,
};
