export const USER_ROLES = Object.freeze({
  SUPERADMIN: "SUPERADMIN",
  ADMIN: "ADMIN",
  INVENTORY_STAFF: "INVENTORY_STAFF",
  CASHIER: "CASHIER",
  AUDITOR: "AUDITOR",
});

export const USER_STATUSES = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
});

export const ROLE_LABELS = Object.freeze({
  SUPERADMIN: "Super Administrator",
  ADMIN: "Administrator",
  INVENTORY_STAFF: "Inventory Staff",
  CASHIER: "Cashier",
  AUDITOR: "Auditor / Viewer",
});

export const ROLE_HOME_ROUTES = Object.freeze({
  SUPERADMIN: "/dashboard",
  ADMIN: "/dashboard",
  INVENTORY_STAFF: "/inventory",
  CASHIER: "/cashier",
  AUDITOR: "/reports",
});

export function isValidUserRole(role) {
  return Object.values(USER_ROLES).includes(role);
}

export function isActiveUser(status) {
  return status === USER_STATUSES.ACTIVE;
}

export function getRoleHomeRoute(role) {
  return ROLE_HOME_ROUTES[role] ?? "/unauthorized";
}