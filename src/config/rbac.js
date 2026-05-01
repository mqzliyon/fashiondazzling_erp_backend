// Central RBAC source of truth for role names and permission matrix.
// Keep this file as the single place to update access rules.
const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  CUTTING_OPERATOR: "cutting_operator",
  EMBROIDERY_OPERATOR: "embroidery_operator",
  VIEWER: "viewer",
  FABRIC_MANAGER: "fabric_manager",
  CUTTING_USER: "cutting_user",
  EMBROIDERY_USER: "embroidery_user",
  SHIPMENT_USER: "shipment_user",
};

const PERMISSIONS = {
  MANAGE_USERS: "manage_users",
  MANAGE_ORDERS: "manage_orders",
  VIEW_ORDERS: "view_orders",
  CUTTING_WORK: "cutting_work",
  EMBROIDERY_WORK: "embroidery_work",
  VIEW_REPORTS: "view_reports",
  FABRIC_INVENTORY: "fabric_inventory",
  CUTTING: "cutting",
  LOTS: "lots",
  EMBROIDERY: "embroidery",
  REJECT: "reject",
  OFFICE_SHIPMENT: "office_shipment",
  FACTORY_SHIPMENT: "factory_shipment",
  FOREIGN_SHIPMENT: "foreign_shipment",
  REPORTS: "reports",
  SETTINGS: "settings",
};

// Role -> permission mapping for ERP modules.
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.MANAGER]: [
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.VIEW_REPORTS,
  ],
  [ROLES.CUTTING_OPERATOR]: [PERMISSIONS.CUTTING_WORK, PERMISSIONS.VIEW_ORDERS],
  [ROLES.EMBROIDERY_OPERATOR]: [
    PERMISSIONS.EMBROIDERY_WORK,
    PERMISSIONS.VIEW_ORDERS,
  ],
  [ROLES.VIEWER]: [PERMISSIONS.VIEW_ORDERS, PERMISSIONS.VIEW_REPORTS],
  [ROLES.FABRIC_MANAGER]: [PERMISSIONS.FABRIC_INVENTORY, PERMISSIONS.REPORTS],
  [ROLES.CUTTING_USER]: [PERMISSIONS.CUTTING, PERMISSIONS.REPORTS],
  [ROLES.EMBROIDERY_USER]: [PERMISSIONS.EMBROIDERY, PERMISSIONS.REJECT, PERMISSIONS.REPORTS],
  [ROLES.SHIPMENT_USER]: [
    PERMISSIONS.OFFICE_SHIPMENT,
    PERMISSIONS.FACTORY_SHIPMENT,
    PERMISSIONS.FOREIGN_SHIPMENT,
    PERMISSIONS.REPORTS,
  ],
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
};

